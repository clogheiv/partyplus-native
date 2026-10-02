-- Candidate contract for the synthetic schema / schema-matched staging only.
-- This is NOT a production migration. Reconcile authoritative schema before porting.
do $$ begin
  if coalesce(current_setting('partyplus.environment', true), '') not in ('synthetic','staging','local') then
    raise exception 'Explicit nonproduction environment required';
  end if;
end $$;
create schema partyplus_private;
revoke all on schema partyplus_private from public, anon, authenticated;
create table partyplus_private.host_access (
  party_id text not null references public.parties(id), principal_id uuid not null references auth.users(id),
  evidence_reference text not null, granted_at timestamptz not null default now(),
  primary key(party_id,principal_id)
);
create table partyplus_private.operations (
  principal_id uuid not null, operation_id uuid not null, request jsonb not null, receipt jsonb not null,
  created_at timestamptz not null default now(), primary key(principal_id,operation_id)
);
alter table public.parties enable row level security;
alter table public.party_items enable row level security;
alter table public.party_rsvps enable row level security;
alter table partyplus_private.host_access enable row level security;
alter table partyplus_private.operations enable row level security;
revoke all on public.parties, public.party_items, public.party_rsvps from public, anon, authenticated;
revoke all on all tables in schema partyplus_private from public, anon, authenticated;

create function partyplus_private.require_principal(p_host boolean default false) returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists(select 1 from auth.users where id = v_uid) then
    raise exception 'signed_session_required' using errcode = '42501';
  end if;
  if p_host and not exists(select 1 from auth.users where id = v_uid and not is_anonymous
    and (email_confirmed_at is not null or phone_confirmed_at is not null)) then
    raise exception 'verified_host_required' using errcode = '42501';
  end if;
  return v_uid;
end $$;

create function partyplus_private.replay(p_uid uuid, p_operation uuid, p_request jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare v_op partyplus_private.operations;
begin
  if p_operation is null then raise exception 'operation_id_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text || ':' || p_operation::text, 0));
  select * into v_op from partyplus_private.operations where principal_id = p_uid and operation_id = p_operation;
  if found then
    if v_op.request is distinct from p_request then raise exception 'operation_conflict'; end if;
    return v_op.receipt;
  end if;
  return null;
end $$;

create function partyplus_private.remember(p_uid uuid, p_operation uuid, p_request jsonb, p_receipt jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
begin
  insert into partyplus_private.operations values(p_uid,p_operation,p_request,p_receipt,now());
  return p_receipt;
end $$;

create function public.partyplus_v2_read_party(p_party_id text) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object('id',p.id,'title',p.title,'date',p.date,'location',p.location,'notes',p.notes,
    'theme',p.theme,'hostId',p.host_id,'createdAt',p.created_at,'updatedAt',p.updated_at,'revision',p.revision,
    'canEdit',exists(select 1 from partyplus_private.host_access h where h.party_id=p.id and h.principal_id=auth.uid()),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'qty',i.qty,
      'claimedBy',i.claimed_by,'claimedByUserId',i.claimed_by_user_id,'createdBy',i.created_by) order by i.sort_order,i.id)
      from public.party_items i where i.party_id=p.id),'[]'::jsonb),
    'rsvps',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'status',r.status,
      'attendeeCount',r.attendee_count,'updatedAt',r.updated_at) order by r.id)
      from public.party_rsvps r where r.party_id=p.id),'[]'::jsonb))
  from public.parties p where p.id=p_party_id and p.deleted_at is null
$$;

create function partyplus_private.lock_party(p_party_id text) returns void
language plpgsql security definer set search_path = pg_catalog as $$
begin
  -- All mutations acquire operation lock, then party lock in the same order.
  perform pg_advisory_xact_lock(hashtextextended('party:' || p_party_id, 0));
  perform 1 from public.parties where id=p_party_id and deleted_at is null for update;
  if not found then raise exception 'party_missing'; end if;
end $$;

create function public.partyplus_v2_commit_party(p_operation_id uuid, p_expected_revision bigint, p_party jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare v_uid uuid := partyplus_private.require_principal(true);
  v_id text := p_party->>'id'; v_request jsonb := jsonb_build_object('kind','commit','revision',p_expected_revision,'party',p_party);
  v_receipt jsonb; v_revision bigint; v_item jsonb; v_ordinal integer := 0; v_remove text;
begin
  v_receipt := partyplus_private.replay(v_uid,p_operation_id,v_request);
  if v_receipt is not null then return v_receipt; end if;
  if v_id is null or length(v_id) not between 1 and 200 or length(trim(coalesce(p_party->>'title',''))) not between 1 and 200
    or jsonb_typeof(p_party->'items') is distinct from 'array' or jsonb_array_length(p_party->'items') > 200 then
    raise exception 'invalid_party';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('party:' || v_id, 0));
  select revision into v_revision from public.parties where id=v_id for update;
  if found then
    if not exists(select 1 from partyplus_private.host_access where party_id=v_id and principal_id=v_uid)
      or exists(select 1 from public.parties where id=v_id and deleted_at is not null) then
      raise exception 'host_access_required' using errcode='42501';
    end if;
    if v_revision <> p_expected_revision then raise exception 'revision_conflict'; end if;
    update public.parties set title=trim(p_party->>'title'), date=nullif(p_party->>'date','')::timestamptz,
      location=p_party->>'location',notes=p_party->>'notes',theme=p_party->>'theme',
      revision=revision+1,updated_at=now() where id=v_id;
  else
    if p_expected_revision is distinct from 0 then raise exception 'revision_conflict'; end if;
    insert into public.parties(id,title,date,location,notes,theme,host_id)
      values(v_id,trim(p_party->>'title'),nullif(p_party->>'date','')::timestamptz,p_party->>'location',p_party->>'notes',p_party->>'theme',v_uid::text);
    insert into partyplus_private.host_access values(v_id,v_uid,'verified-account-create',now());
  end if;
  for v_item in select value from jsonb_array_elements(p_party->'items') loop
    if length(coalesce(v_item->>'id','')) not between 1 and 200 or length(trim(coalesce(v_item->>'name',''))) not between 1 and 200 then
      raise exception 'invalid_item';
    end if;
    insert into public.party_items(party_id,id,name,qty,created_by,sort_order)
      values(v_id,v_item->>'id',trim(v_item->>'name'),v_item->>'qty',v_uid::text,v_ordinal)
      on conflict(party_id,id) do update set name=excluded.name,qty=excluded.qty,sort_order=excluded.sort_order;
    -- Never accept a claim owner or creator from the host's cached snapshot.
    v_ordinal := v_ordinal+1;
  end loop;
  for v_remove in select jsonb_array_elements_text(coalesce(p_party->'removedItemIds','[]'::jsonb)) loop
    if exists(select 1 from public.party_items where party_id=v_id and id=v_remove and
      (claimed_by_user_id is not null or claimed_by is not null)) then raise exception 'claim_conflict'; end if;
    delete from public.party_items where party_id=v_id and id=v_remove;
  end loop;
  -- RSVP rows are intentionally untouched by host edits.
  v_receipt := jsonb_build_object('committed',true,'operationId',p_operation_id,'party',public.partyplus_v2_read_party(v_id));
  return partyplus_private.remember(v_uid,p_operation_id,v_request,v_receipt);
end $$;

create function public.partyplus_v2_rsvp(p_party_id text,p_operation_id uuid,p_response jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare v_uid uuid := partyplus_private.require_principal();
  v_request jsonb := jsonb_build_object('kind','rsvp','party',p_party_id,'response',p_response); v_receipt jsonb;
  v_name text := trim(p_response->>'name'); v_status text := p_response->>'status'; v_count integer := (p_response->>'attendeeCount')::integer;
begin
  v_receipt := partyplus_private.replay(v_uid,p_operation_id,v_request);
  if v_receipt is not null then return v_receipt; end if;
  if v_name is null or length(v_name) not between 1 and 100 or v_status is null or v_status not in ('yes','maybe','no')
    or v_count is null or v_count not between 1 and 100 then raise exception 'invalid_rsvp'; end if;
  perform partyplus_private.lock_party(p_party_id);
  insert into public.party_rsvps values(p_party_id,v_uid::text,v_name,v_status,v_count,now())
    on conflict(party_id,id) do update set name=excluded.name,status=excluded.status,attendee_count=excluded.attendee_count,updated_at=now();
  update public.party_items set claimed_by=case when v_status='yes' then v_name else null end,
    claimed_by_user_id=case when v_status='yes' then v_uid::text else null end
    where party_id=p_party_id and claimed_by_user_id=v_uid::text;
  update public.parties set revision=revision+1,updated_at=now() where id=p_party_id;
  return partyplus_private.remember(v_uid,p_operation_id,v_request,jsonb_build_object('committed',true,'operationId',p_operation_id,'party',public.partyplus_v2_read_party(p_party_id)));
end $$;

create function public.partyplus_v2_claim_item(p_party_id text,p_item_id text,p_claim boolean,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare v_uid uuid := partyplus_private.require_principal();
  v_request jsonb := jsonb_build_object('kind','claim','party',p_party_id,'item',p_item_id,'claim',p_claim); v_receipt jsonb;
  v_owner text; v_name text; v_label text;
begin
  v_receipt := partyplus_private.replay(v_uid,p_operation_id,v_request);
  if v_receipt is not null then return v_receipt; end if;
  if p_claim is null then raise exception 'invalid_claim'; end if;
  perform partyplus_private.lock_party(p_party_id);
  select claimed_by_user_id,claimed_by into v_owner,v_label from public.party_items where party_id=p_party_id and id=p_item_id for update;
  if not found then raise exception 'item_missing'; end if;
  if p_claim then
    select name into v_name from public.party_rsvps where party_id=p_party_id and id=v_uid::text and status='yes';
    if not found then raise exception 'yes_rsvp_required' using errcode='42501'; end if;
    if (v_owner is not null and v_owner<>v_uid::text) or (v_owner is null and v_label is not null) then raise exception 'claim_conflict'; end if;
    update public.party_items set claimed_by_user_id=v_uid::text,claimed_by=v_name where party_id=p_party_id and id=p_item_id;
  else
    if v_owner is distinct from v_uid::text then raise exception 'claim_owner_required' using errcode='42501'; end if;
    update public.party_items set claimed_by_user_id=null,claimed_by=null where party_id=p_party_id and id=p_item_id;
  end if;
  update public.parties set revision=revision+1,updated_at=now() where id=p_party_id;
  return partyplus_private.remember(v_uid,p_operation_id,v_request,jsonb_build_object('committed',true,'operationId',p_operation_id,'party',public.partyplus_v2_read_party(p_party_id)));
end $$;

create function public.partyplus_v2_suggest_item(p_party_id text,p_item_id text,p_name text,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare v_uid uuid := partyplus_private.require_principal();
  v_request jsonb := jsonb_build_object('kind','suggest','party',p_party_id,'item',p_item_id,'name',p_name); v_receipt jsonb;
begin
  v_receipt := partyplus_private.replay(v_uid,p_operation_id,v_request);
  if v_receipt is not null then return v_receipt; end if;
  if length(coalesce(p_item_id,'')) not between 1 and 200 or length(trim(coalesce(p_name,''))) not between 1 and 200 then raise exception 'invalid_item'; end if;
  perform partyplus_private.lock_party(p_party_id);
  if (select count(*) from public.party_items where party_id=p_party_id) >= 200 then raise exception 'item_limit'; end if;
  insert into public.party_items(party_id,id,name,created_by,sort_order)
    values(p_party_id,p_item_id,trim(p_name),v_uid::text,coalesce((select max(sort_order)+1 from public.party_items where party_id=p_party_id),0));
  update public.parties set revision=revision+1,updated_at=now() where id=p_party_id;
  return partyplus_private.remember(v_uid,p_operation_id,v_request,jsonb_build_object('committed',true,'operationId',p_operation_id,'party',public.partyplus_v2_read_party(p_party_id)));
end $$;

create function public.partyplus_v2_delete_party(p_party_id text,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare v_uid uuid := partyplus_private.require_principal(true);
  v_request jsonb := jsonb_build_object('kind','delete','party',p_party_id); v_receipt jsonb;
begin
  v_receipt := partyplus_private.replay(v_uid,p_operation_id,v_request);
  if v_receipt is not null then return v_receipt; end if;
  perform partyplus_private.lock_party(p_party_id);
  if not exists(select 1 from partyplus_private.host_access where party_id=p_party_id and principal_id=v_uid) then
    raise exception 'host_access_required' using errcode='42501'; end if;
  -- Tombstone preserves IDs, guest data and recovery potential in this candidate contract.
  update public.parties set deleted_at=now(),updated_at=now(),revision=revision+1 where id=p_party_id;
  return partyplus_private.remember(v_uid,p_operation_id,v_request,jsonb_build_object('deleted',true,'operationId',p_operation_id));
end $$;

revoke all on all functions in schema partyplus_private from public,anon,authenticated;
create function public.partyplus_v2_list_host_parties() returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare v_uid uuid := partyplus_private.require_principal(true);
begin
  return coalesce((select jsonb_agg(public.partyplus_v2_read_party(p.id) order by p.updated_at desc)
    from public.parties p join partyplus_private.host_access h on h.party_id=p.id
    where h.principal_id=v_uid and p.deleted_at is null),'[]'::jsonb);
end $$;
revoke all on function public.partyplus_v2_list_host_parties() from public,anon,authenticated;
grant execute on function public.partyplus_v2_list_host_parties() to authenticated;
revoke all on function public.partyplus_v2_read_party(text),public.partyplus_v2_commit_party(uuid,bigint,jsonb),
  public.partyplus_v2_rsvp(text,uuid,jsonb),public.partyplus_v2_claim_item(text,text,boolean,uuid),
  public.partyplus_v2_suggest_item(text,text,text,uuid),public.partyplus_v2_delete_party(text,uuid) from public,anon,authenticated;
grant execute on function public.partyplus_v2_read_party(text) to anon,authenticated;
grant execute on function public.partyplus_v2_commit_party(uuid,bigint,jsonb),public.partyplus_v2_rsvp(text,uuid,jsonb),
  public.partyplus_v2_claim_item(text,text,boolean,uuid),public.partyplus_v2_suggest_item(text,text,text,uuid),
  public.partyplus_v2_delete_party(text,uuid) to authenticated;
