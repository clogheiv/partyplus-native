-- Prepared PartyPlus website installation. Execute only after exact production approval.
-- Source v2, browser, and address inputs recorded in production-manifest.json.
-- Existing legacy writes stay denied; this transaction ends with v2 writes PAUSED.
-- Caller confirms the target and sets partyplus.security_approval=cutover-v2.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table public.parties,public.party_items,public.party_rsvps in access exclusive mode;
create temporary table partyplus_web_preservation on commit drop as select jsonb_build_object('parties',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from public.parties t) s),'party_items',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from public.party_items t) s),'party_rsvps',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from public.party_rsvps t) s)) as snapshot;
alter table partyplus_web_preservation enable row level security;
revoke all on table partyplus_web_preservation from public,anon,authenticated;
-- REVIEW ONLY. Separate Michael production approval is required. No deployment automation.
-- Baseline metadata SHA256 9830e20e7708dcf596d6c4a2f435ae31da2ae42c64f1fe7fa5854d5fc2639d88
-- Before execution, operator must set SESSION partyplus.security_approval='cutover-v2'
-- and partyplus.target_project='typbofemqhjoiwbkdvuc' on the confirmed live connection.
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
  if current_setting('partyplus.security_approval',true) is distinct from 'cutover-v2'
     or coalesce(current_setting('partyplus.target_project',true),'') not in ('typbofemqhjoiwbkdvuc','qmbwrbxbbshbavfhkujx','synthetic') then
    raise exception 'Separate reviewed security approval and confirmed target required';
  end if;
  if current_setting('partyplus.target_project',true)='typbofemqhjoiwbkdvuc' and current_user <> 'postgres' then
    raise exception 'Reviewed production owner connection required';
  end if;
end $$;
do $$ declare v_actual jsonb; begin
  select jsonb_agg(jsonb_build_object('table_name',table_name,'column_name',column_name,'data_type',data_type,'is_nullable',is_nullable,'column_default',column_default) order by table_name,column_name)
    into v_actual from information_schema.columns where table_schema='public' and table_name in ('parties','party_items','party_rsvps');
  if v_actual is distinct from (select jsonb_agg(value order by value->>'table_name',value->>'column_name') from jsonb_array_elements('[{"table_name":"parties","column_name":"id","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"parties","column_name":"title","data_type":"text","is_nullable":"NO","column_default":"''''::text"},{"table_name":"parties","column_name":"datetime","data_type":"timestamp with time zone","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"location_name","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"address","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"lat","data_type":"double precision","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"lng","data_type":"double precision","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"notes","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"host_id","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},{"table_name":"parties","column_name":"updated_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},{"table_name":"party_items","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},{"table_name":"party_items","column_name":"party_id","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"party_items","column_name":"name","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"party_items","column_name":"qty","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"party_items","column_name":"claimed_by","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"party_items","column_name":"sort_order","data_type":"integer","is_nullable":"NO","column_default":"0"},{"table_name":"party_items","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},{"table_name":"party_rsvps","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},{"table_name":"party_rsvps","column_name":"party_id","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"party_rsvps","column_name":"guest_name","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"party_rsvps","column_name":"status","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"party_rsvps","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},{"table_name":"party_rsvps","column_name":"name","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"party_rsvps","column_name":"attendee_count","data_type":"integer","is_nullable":"YES","column_default":null},{"table_name":"party_rsvps","column_name":"updated_at","data_type":"timestamp with time zone","is_nullable":"YES","column_default":null}]'::jsonb)) then
    raise exception 'Baseline column drift: refresh metadata and reconcile';
  end if;
end $$;
do $$ declare v_actual jsonb; begin
  select jsonb_agg(jsonb_build_object('table_name',c.conrelid::regclass::text,'conname',c.conname,'contype',c.contype,'definition',pg_get_constraintdef(c.oid)) order by c.conrelid::regclass::text,c.conname)
    into v_actual from pg_constraint c where c.connamespace='public'::regnamespace and c.contype<>'n';
  if v_actual is distinct from (select jsonb_agg(value order by value->>'table_name',value->>'conname') from jsonb_array_elements('[{"conname":"parties_pkey","contype":"p","definition":"PRIMARY KEY (id)","table_name":"parties"},{"conname":"party_items_party_id_fkey","contype":"f","definition":"FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE","table_name":"party_items"},{"conname":"party_items_pkey","contype":"p","definition":"PRIMARY KEY (id)","table_name":"party_items"},{"conname":"party_rsvps_party_id_fkey","contype":"f","definition":"FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE","table_name":"party_rsvps"},{"conname":"party_rsvps_party_id_guest_name_key","contype":"u","definition":"UNIQUE (party_id, guest_name)","table_name":"party_rsvps"},{"conname":"party_rsvps_pkey","contype":"p","definition":"PRIMARY KEY (party_id, id)","table_name":"party_rsvps"},{"conname":"party_rsvps_status_check","contype":"c","definition":"CHECK ((status = ANY (ARRAY[''yes''::text, ''no''::text, ''maybe''::text])))","table_name":"party_rsvps"}]'::jsonb)) then
    raise exception 'Baseline constraint drift: refresh metadata and reconcile';
  end if;
end $$;
do $$ begin
  if (select count(*) from pg_policies where schemaname='public' and tablename in ('parties','party_items','party_rsvps') and cmd='SELECT' and qual='true') <> 3
    or (select count(*) from pg_policies where schemaname='public' and tablename in ('parties','party_items','party_rsvps') and policyname like 'partyplus_legacy_deny_%' and permissive='RESTRICTIVE') <> 9 then
    raise exception 'Expected approved read-only legacy freeze';
  end if;
  if to_regnamespace('partyplus_private') is not null then raise exception 'Existing contract: reconcile instead of reinstalling'; end if;
end $$;
lock table public.parties,public.party_items,public.party_rsvps in access exclusive mode;
alter table public.parties add column revision bigint not null default 1;
alter table public.parties add column deleted_at timestamptz;
alter table public.parties add column date timestamptz;
alter table public.parties add column location text;
alter table public.parties add column theme text;
-- Preserve historical customer updated_at while adding read aliases.
alter table public.parties disable trigger trg_parties_updated_at;
update public.parties set date=datetime,location=location_name
  where date is distinct from datetime or location is distinct from location_name;
alter table public.parties enable trigger trg_parties_updated_at;
alter table public.party_items add column claimed_by_user_id text;
alter table public.party_items add column created_by text;
-- Keep original UUID primary keys and guest_name uniqueness. No identifier rewriting.
create unique index party_items_party_id_id_v2_idx on public.party_items(party_id,id);
create function public.partyplus_v2_sync_legacy_aliases() returns trigger
language plpgsql set search_path=pg_catalog as $$ begin
  new.datetime := new.date;
  new.location_name := new.location;
  return new;
end $$;
revoke all on function public.partyplus_v2_sync_legacy_aliases() from public,anon,authenticated;
create trigger partyplus_v2_sync_legacy_aliases before insert or update on public.parties
  for each row execute function public.partyplus_v2_sync_legacy_aliases();
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
create table partyplus_private.release_control (
  singleton boolean primary key default true check(singleton),
  writes_enabled boolean not null default false, updated_at timestamptz not null default now()
);
insert into partyplus_private.release_control(singleton,writes_enabled) values(true,false);
alter table partyplus_private.release_control enable row level security;
alter table public.parties enable row level security;
alter table public.party_items enable row level security;
alter table public.party_rsvps enable row level security;
alter table partyplus_private.host_access enable row level security;
alter table partyplus_private.operations enable row level security;
revoke all on public.parties, public.party_items, public.party_rsvps from public, anon, authenticated;
revoke all on all tables in schema partyplus_private from public, anon, authenticated;
-- Revoke the legacy permissive policies too, so later default grants cannot revive them.
do $$ declare v_policy record; begin
  for v_policy in select tablename,policyname from pg_policies
    where schemaname='public' and tablename in ('parties','party_items','party_rsvps') loop
    execute format('drop policy %I on public.%I',v_policy.policyname,v_policy.tablename);
  end loop;
end $$;

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

create function partyplus_private.require_writes() returns void
language plpgsql security definer set search_path = pg_catalog as $$
declare v_enabled boolean;
begin
  -- Hold a shared row lock through commit: pausing drains in-flight mutations
  -- before the owner gate update can commit. Replay remains available above it.
  select writes_enabled into v_enabled from partyplus_private.release_control where singleton for share;
  if not coalesce(v_enabled,false) then
    raise exception 'writes_paused' using errcode='55000';
  end if;
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
    'rsvps',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',coalesce(r.name,to_jsonb(r)->>'guest_name','Guest'),'status',r.status,
      'attendeeCount',greatest(coalesce(r.attendee_count,1),1),'updatedAt',coalesce(r.updated_at::text,to_jsonb(r)->>'created_at','')) order by r.id)
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
  v_typed_item public.party_items;
begin
  v_receipt := partyplus_private.replay(v_uid,p_operation_id,v_request);
  if v_receipt is not null then return v_receipt; end if;
  perform partyplus_private.require_writes();
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
    if v_revision is distinct from p_expected_revision then raise exception 'revision_conflict'; end if;
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
    v_typed_item := jsonb_populate_record(null::public.party_items,v_item);
    insert into public.party_items(party_id,id,name,qty,created_by,sort_order)
      values(v_id,v_typed_item.id,trim(v_item->>'name'),v_item->>'qty',v_uid::text,v_ordinal)
      on conflict(party_id,id) do update set name=excluded.name,qty=excluded.qty,sort_order=excluded.sort_order;
    -- Never accept a claim owner or creator from the host's cached snapshot.
    v_ordinal := v_ordinal+1;
  end loop;
  for v_remove in select jsonb_array_elements_text(coalesce(p_party->'removedItemIds','[]'::jsonb)) loop
    if exists(select 1 from public.party_items where party_id=v_id and id::text=v_remove and
      (claimed_by_user_id is not null or claimed_by is not null)) then raise exception 'claim_conflict'; end if;
    delete from public.party_items where party_id=v_id and id::text=v_remove;
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
  v_typed_rsvp public.party_rsvps;
begin
  v_receipt := partyplus_private.replay(v_uid,p_operation_id,v_request);
  if v_receipt is not null then return v_receipt; end if;
  perform partyplus_private.require_writes();
  if v_name is null or length(v_name) not between 1 and 100 or v_status is null or v_status not in ('yes','maybe','no')
    or v_count is null or v_count not between 1 and 100 then raise exception 'invalid_rsvp'; end if;
  perform partyplus_private.lock_party(p_party_id);
  v_typed_rsvp := jsonb_populate_record(null::public.party_rsvps,jsonb_build_object('id',v_uid));
  insert into public.party_rsvps(party_id,id,name,status,attendee_count,updated_at)
    values(p_party_id,v_typed_rsvp.id,v_name,v_status,v_count,now())
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
  perform partyplus_private.require_writes();
  if p_claim is null then raise exception 'invalid_claim'; end if;
  perform partyplus_private.lock_party(p_party_id);
  select claimed_by_user_id,claimed_by into v_owner,v_label from public.party_items where party_id=p_party_id and id::text=p_item_id for update;
  if not found then raise exception 'item_missing'; end if;
  if p_claim then
    select name into v_name from public.party_rsvps where party_id=p_party_id and id::text=v_uid::text and status='yes';
    if not found then raise exception 'yes_rsvp_required' using errcode='42501'; end if;
    if (v_owner is not null and v_owner<>v_uid::text) or (v_owner is null and v_label is not null) then raise exception 'claim_conflict'; end if;
    update public.party_items set claimed_by_user_id=v_uid::text,claimed_by=v_name where party_id=p_party_id and id::text=p_item_id;
  else
    if v_owner is distinct from v_uid::text then raise exception 'claim_owner_required' using errcode='42501'; end if;
    update public.party_items set claimed_by_user_id=null,claimed_by=null where party_id=p_party_id and id::text=p_item_id;
  end if;
  update public.parties set revision=revision+1,updated_at=now() where id=p_party_id;
  return partyplus_private.remember(v_uid,p_operation_id,v_request,jsonb_build_object('committed',true,'operationId',p_operation_id,'party',public.partyplus_v2_read_party(p_party_id)));
end $$;

create function public.partyplus_v2_suggest_item(p_party_id text,p_item_id text,p_name text,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare v_uid uuid := partyplus_private.require_principal();
  v_request jsonb := jsonb_build_object('kind','suggest','party',p_party_id,'item',p_item_id,'name',p_name); v_receipt jsonb;
  v_typed_item public.party_items;
begin
  v_receipt := partyplus_private.replay(v_uid,p_operation_id,v_request);
  if v_receipt is not null then return v_receipt; end if;
  perform partyplus_private.require_writes();
  if length(coalesce(p_item_id,'')) not between 1 and 200 or length(trim(coalesce(p_name,''))) not between 1 and 200 then raise exception 'invalid_item'; end if;
  perform partyplus_private.lock_party(p_party_id);
  if (select count(*) from public.party_items where party_id=p_party_id) >= 200 then raise exception 'item_limit'; end if;
  v_typed_item := jsonb_populate_record(null::public.party_items,jsonb_build_object('id',p_item_id));
  insert into public.party_items(party_id,id,name,created_by,sort_order)
    values(p_party_id,v_typed_item.id,trim(p_name),v_uid::text,coalesce((select max(sort_order)+1 from public.party_items where party_id=p_party_id),0));
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
  perform partyplus_private.require_writes();
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
-- Only future objects owned by this migration role are changed; existing unrelated grants stay intact.
alter default privileges in schema public revoke all on tables from public,anon,authenticated;
alter default privileges in schema public revoke all on sequences from public,anon,authenticated;
-- PUBLIC function EXECUTE is a global default: a per-schema revoke cannot remove it.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon,authenticated;
alter default privileges in schema partyplus_private revoke all on tables from public,anon,authenticated;
alter default privileges in schema partyplus_private revoke execute on functions from anon,authenticated;
alter function public.set_updated_at() set search_path=pg_catalog;
revoke all on function public.set_updated_at() from public,anon,authenticated;
notify pgrst,'reload schema';

-- Additive browser contract. Requires the hardened v2 contract already installed.
-- Does not reopen legacy table access or change the verified-write release gate.
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
  if to_regprocedure('public.partyplus_v2_read_party(text)') is null
     or to_regclass('partyplus_private.host_access') is null then
    raise exception 'Install and verify the hardened v2 contract first';
  end if;
end $$;

create table partyplus_private.memberships (
  party_id text not null references public.parties(id),
  principal_id uuid not null references auth.users(id),
  joined_at timestamptz not null default now(),
  primary key(party_id,principal_id)
);
create index memberships_principal_idx on partyplus_private.memberships(principal_id,joined_at desc);
alter table partyplus_private.memberships enable row level security;
revoke all on partyplus_private.memberships from public,anon,authenticated;

-- Only real Auth identities with an existing response qualify. A legacy device
-- UUID or party link never creates a host grant or establishes account ownership.
insert into partyplus_private.memberships(party_id,principal_id)
  select distinct r.party_id,u.id from public.party_rsvps r
  join auth.users u on u.id::text=r.id::text
  on conflict do nothing;
insert into partyplus_private.memberships(party_id,principal_id)
  select distinct i.party_id,u.id from public.party_items i
  join auth.users u on u.id::text=i.created_by
  where not exists(select 1 from partyplus_private.host_access h
    where h.party_id=i.party_id and h.principal_id=u.id)
  on conflict do nothing;

create function partyplus_private.remember_rsvp_membership() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is not null and new.id::text=v_uid::text
     and exists(select 1 from auth.users where id=v_uid) then
    insert into partyplus_private.memberships(party_id,principal_id)
      values(new.party_id,v_uid) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger partyplus_web_rsvp_membership after insert or update on public.party_rsvps
  for each row execute function partyplus_private.remember_rsvp_membership();

create function partyplus_private.remember_suggestion_membership() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is not null and new.created_by=v_uid::text
     and exists(select 1 from auth.users where id=v_uid)
     and not exists(select 1 from partyplus_private.host_access
       where party_id=new.party_id and principal_id=v_uid) then
    insert into partyplus_private.memberships(party_id,principal_id)
      values(new.party_id,v_uid) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger partyplus_web_suggestion_membership after insert on public.party_items
  for each row execute function partyplus_private.remember_suggestion_membership();

-- Shared by live reads and old operation-receipt replay. No client-supplied
-- authorization flags are trusted. The invitation is a bearer link for party
-- details and the bring list; response names are visible to the host and self.
create function partyplus_private.web_projection(p_party jsonb) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_uid uuid := auth.uid(); v_host boolean; v_own jsonb; v_rsvps jsonb;
begin
  if p_party is null then return null; end if;
  -- Already-projected committed receipts retain byte-for-byte replay semantics.
  if p_party->>'projectionVersion'='web-1' then return p_party; end if;
  select exists(select 1 from partyplus_private.host_access
    where party_id=p_party->>'id' and principal_id=v_uid) into v_host;
  select value into v_own from jsonb_array_elements(coalesce(p_party->'rsvps','[]'::jsonb))
    where value->>'id'=v_uid::text limit 1;
  select coalesce(jsonb_agg(case when value->>'id'=v_uid::text then value
      else jsonb_set(value,'{id}',to_jsonb(md5((p_party->>'id')||':'||(value->>'id')))) end),'[]'::jsonb)
    into v_rsvps from jsonb_array_elements(coalesce(p_party->'rsvps','[]'::jsonb))
    where v_host or value->>'id'=v_uid::text;
  return (p_party-'hostId'-'items'-'rsvps'-'canEdit') || jsonb_build_object(
    'projectionVersion','web-1','canEdit',v_host,
    'isJoined',exists(select 1 from partyplus_private.memberships
      where party_id=p_party->>'id' and principal_id=v_uid),
    'ownRsvp',v_own,'rsvps',v_rsvps,
    'items',coalesce((select jsonb_agg((value-'claimedByUserId'-'createdBy')||
      jsonb_build_object('isMine',coalesce(value->>'claimedByUserId'=v_uid::text,false)))
      from jsonb_array_elements(coalesce(p_party->'items','[]'::jsonb))),'[]'::jsonb),
    'totals',jsonb_build_object(
      'yes',(select count(*) from jsonb_array_elements(coalesce(p_party->'rsvps','[]'::jsonb)) where value->>'status'='yes'),
      'maybe',(select count(*) from jsonb_array_elements(coalesce(p_party->'rsvps','[]'::jsonb)) where value->>'status'='maybe'),
      'no',(select count(*) from jsonb_array_elements(coalesce(p_party->'rsvps','[]'::jsonb)) where value->>'status'='no'),
      'attending',(select coalesce(sum((value->>'attendeeCount')::integer),0)
        from jsonb_array_elements(coalesce(p_party->'rsvps','[]'::jsonb)) where value->>'status'='yes')));
end $$;

create or replace function public.partyplus_v2_read_party(p_party_id text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select partyplus_private.web_projection(jsonb_build_object(
    'id',p.id,'title',p.title,'date',p.date,'location',p.location,'notes',p.notes,
    'theme',p.theme,'createdAt',p.created_at,'updatedAt',p.updated_at,'revision',p.revision,
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'qty',i.qty,
      'claimedBy',i.claimed_by,'claimedByUserId',i.claimed_by_user_id) order by i.sort_order,i.id)
      from public.party_items i where i.party_id=p.id),'[]'::jsonb),
    'rsvps',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,
      'name',coalesce(r.name,to_jsonb(r)->>'guest_name','Guest'),'status',r.status,
      'attendeeCount',greatest(coalesce(r.attendee_count,1),1),
      'updatedAt',coalesce(r.updated_at::text,to_jsonb(r)->>'created_at','')) order by r.id)
      from public.party_rsvps r where r.party_id=p.id),'[]'::jsonb)))
  from public.parties p where p.id=p_party_id and p.deleted_at is null
$$;

create or replace function partyplus_private.replay(p_uid uuid,p_operation uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_op partyplus_private.operations;
begin
  if p_operation is null then raise exception 'operation_id_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text||':'||p_operation::text,0));
  select * into v_op from partyplus_private.operations where principal_id=p_uid and operation_id=p_operation;
  if found then
    if v_op.request is distinct from p_request then raise exception 'operation_conflict'; end if;
    if v_op.receipt ? 'party' then
      return jsonb_set(v_op.receipt,'{party}',partyplus_private.web_projection(v_op.receipt->'party'));
    end if;
    return v_op.receipt;
  end if;
  return null;
end $$;

create function public.partyplus_web_read_party(p_party_id text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select public.partyplus_v2_read_party(p_party_id)
$$;

create function public.partyplus_web_join_party(p_party_id text,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_uid uuid := partyplus_private.require_principal(); v_receipt jsonb;
  v_request jsonb := jsonb_build_object('kind','join','party',p_party_id);
begin
  v_receipt := partyplus_private.replay(v_uid,p_operation_id,v_request);
  if v_receipt is not null then return v_receipt; end if;
  perform partyplus_private.require_writes();
  perform partyplus_private.lock_party(p_party_id);
  if not exists(select 1 from partyplus_private.host_access where party_id=p_party_id and principal_id=v_uid) then
    insert into partyplus_private.memberships(party_id,principal_id) values(p_party_id,v_uid) on conflict do nothing;
  end if;
  return partyplus_private.remember(v_uid,p_operation_id,v_request,
    jsonb_build_object('committed',true,'operationId',p_operation_id,'party',public.partyplus_v2_read_party(p_party_id)));
end $$;

create function public.partyplus_web_list_my_parties() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_uid uuid := partyplus_private.require_principal();
begin
  return jsonb_build_object(
    'hosting',coalesce((select jsonb_agg(public.partyplus_v2_read_party(p.id) order by p.updated_at desc,p.id)
      from public.parties p join partyplus_private.host_access h on h.party_id=p.id
      where h.principal_id=v_uid and p.deleted_at is null),'[]'::jsonb),
    'joined',coalesce((select jsonb_agg(public.partyplus_v2_read_party(p.id) order by m.joined_at desc,p.id)
      from public.parties p join partyplus_private.memberships m on m.party_id=p.id
      where m.principal_id=v_uid and p.deleted_at is null
      and not exists(select 1 from partyplus_private.host_access h where h.party_id=p.id and h.principal_id=v_uid)),'[]'::jsonb));
end $$;

create table partyplus_private.web_events (
  event_id uuid primary key, principal_id uuid references auth.users(id),
  kind text not null check(kind in ('party_created','invitation_link_copied',
    'invitation_share_sheet_opened','invitation_opened','rsvp_saved',
    'bring_item_claimed','bring_item_suggested','returning_use')),
  created_at timestamptz not null default now()
);
alter table partyplus_private.web_events enable row level security;
revoke all on partyplus_private.web_events from public,anon,authenticated;
create function public.partyplus_web_record_event(p_event_id uuid,p_kind text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare v_uid uuid := auth.uid(); v_event partyplus_private.web_events;
begin
  perform partyplus_private.require_writes();
  if v_uid is null then
    if p_kind is distinct from 'invitation_opened' then
      raise exception 'signed_session_required' using errcode='42501';
    end if;
  else
    perform partyplus_private.require_principal();
  end if;
  if p_event_id is null then raise exception 'event_id_required'; end if;
  insert into partyplus_private.web_events(event_id,principal_id,kind)
    values(p_event_id,v_uid,p_kind) on conflict do nothing;
  select * into v_event from partyplus_private.web_events where event_id=p_event_id;
  if v_event.principal_id is distinct from v_uid or v_event.kind is distinct from p_kind then
    raise exception 'event_conflict';
  end if;
  return true;
end $$;

revoke all on all functions in schema partyplus_private from public,anon,authenticated;
revoke all on function public.partyplus_web_read_party(text),
  public.partyplus_web_join_party(text,uuid),public.partyplus_web_list_my_parties(),
  public.partyplus_web_record_event(uuid,text) from public,anon,authenticated;
grant execute on function public.partyplus_web_read_party(text),
  public.partyplus_web_record_event(uuid,text) to anon,authenticated;
grant execute on function public.partyplus_web_join_party(text,uuid),
  public.partyplus_web_list_my_parties(),public.partyplus_web_record_event(uuid,text) to authenticated;

-- Preserve the separately stored street address on legacy invitation reads.
-- No data/grant/auth changes; new browser parties use the single location field.
create or replace function public.partyplus_v2_read_party(p_party_id text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select partyplus_private.web_projection(jsonb_build_object(
    'id',p.id,'title',p.title,'date',p.date,'location',p.location,
    'address',to_jsonb(p)->>'address','notes',p.notes,
    'theme',p.theme,'createdAt',p.created_at,'updatedAt',p.updated_at,'revision',p.revision,
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'qty',i.qty,
      'claimedBy',i.claimed_by,'claimedByUserId',i.claimed_by_user_id) order by i.sort_order,i.id)
      from public.party_items i where i.party_id=p.id),'[]'::jsonb),
    'rsvps',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,
      'name',coalesce(r.name,to_jsonb(r)->>'guest_name','Guest'),'status',r.status,
      'attendeeCount',greatest(coalesce(r.attendee_count,1),1),
      'updatedAt',coalesce(r.updated_at::text,to_jsonb(r)->>'created_at','')) order by r.id)
      from public.party_rsvps r where r.party_id=p.id),'[]'::jsonb)))
  from public.parties p where p.id=p_party_id and p.deleted_at is null
$$;
notify pgrst,'reload schema';

do $$ begin
  if (select snapshot from pg_temp.partyplus_web_preservation) is distinct from jsonb_build_object('parties',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t) - array['revision','deleted_at','date','location','theme'])::text value from public.parties t) s),'party_items',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t) - array['claimed_by_user_id','created_by'])::text value from public.party_items t) s),'party_rsvps',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from public.party_rsvps t) s)) then
    raise exception 'Customer original-column preservation check failed';
  end if;
  if not (select relrowsecurity from pg_class where oid='pg_temp.partyplus_web_preservation'::regclass)
    or has_table_privilege('anon','pg_temp.partyplus_web_preservation','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','pg_temp.partyplus_web_preservation','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Preservation temporary table must remain client-inaccessible with RLS';
  end if;
  if (select writes_enabled from partyplus_private.release_control where singleton) is distinct from false then
    raise exception 'Installation must keep verified writes paused';
  end if;
  if exists(select 1 from (values('anon'),('authenticated')) roles(r)
    cross join (values('public.parties'),('public.party_items'),('public.party_rsvps')) tables(t)
    where has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) then
    raise exception 'Unexpected raw client grants';
  end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.parties'::regclass
    and tgname='trg_parties_updated_at' and tgenabled='O') then
    raise exception 'Original updated_at trigger must remain enabled';
  end if;
end $$;
notify pgrst,'reload schema';
commit;
