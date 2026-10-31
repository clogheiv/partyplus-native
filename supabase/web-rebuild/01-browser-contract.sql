-- Additive browser contract. Requires the hardened v2 contract already installed.
-- Does not reopen legacy table access or change the verified-write release gate.
begin;
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
commit;
