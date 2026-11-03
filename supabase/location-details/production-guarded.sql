-- Additive location source SHA256 181754752dd6804a10460b2755df4aca19fd2c5dc593664ca9ddc2f918ea7ee0; no backfill or customer writes.
begin isolation level repeatable read;
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table public.parties in access exclusive mode;
create temporary table partyplus_location_preservation on commit drop as select jsonb_build_object('public.parties',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from public.parties t) s),'public.party_items',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from public.party_items t) s),'public.party_rsvps',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from public.party_rsvps t) s),'partyplus_private.host_access',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from partyplus_private.host_access t) s),'partyplus_private.memberships',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from partyplus_private.memberships t) s),'partyplus_private.operations',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from partyplus_private.operations t) s),'auth.users',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from auth.users t) s),'storage.objects',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from storage.objects t) s)) snapshot,jsonb_build_object('gate',(select writes_enabled from partyplus_private.release_control where singleton),'rpc',(select jsonb_agg(jsonb_build_object('function',p.oid::regprocedure::text,'role',r,'execute',has_function_privilege(r,p.oid,'EXECUTE')) order by p.oid::regprocedure::text,r) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join (values('anon'),('authenticated')) roles(r) where n.nspname='public' and p.proname like 'partyplus_%'),'raw',(select jsonb_agg(jsonb_build_object('table',t,'role',r,'allowed',has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) order by t,r) from (values('anon'),('authenticated')) roles(r) cross join (values('public.parties'),('public.party_items'),('public.party_rsvps')) tables(t))) access;
alter table partyplus_location_preservation enable row level security;
revoke all on partyplus_location_preservation from public,anon,authenticated;
-- Additive structured location. No backfill, parsing, legacy field rewrite,
-- new client permission, Storage/Auth setting or existing receipt mutation.
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
 if to_regprocedure('partyplus_private.commit_party_before_appearance(uuid,bigint,jsonb)') is null
 or to_regprocedure('partyplus_private.commit_party_before_location_details(uuid,bigint,jsonb)') is not null then
  raise exception 'Expected installed appearance contract without location-details migration';
 end if;
end $$;
alter table public.parties add column location_details jsonb;

create function partyplus_private.validate_location_details(p_value jsonb) returns jsonb
language plpgsql immutable set search_path=pg_catalog as $$
declare v_key text; v_limit integer;
begin
 if p_value is null or jsonb_typeof(p_value) is distinct from 'object'
 or octet_length(p_value::text)>3000
 or p_value->'version' is distinct from '1'::jsonb
 or exists(select 1 from jsonb_object_keys(p_value) k where k not in ('version','streetAddress','city','zipCode')) then
  raise exception 'invalid_location_details';
 end if;
 for v_key,v_limit in select * from (values('streetAddress',300),('city',120),('zipCode',20)) bounds(key,max_length) loop
  if jsonb_typeof(p_value->v_key) is distinct from 'string'
  or length(p_value->>v_key)>v_limit or (p_value->>v_key) ~ '[[:cntrl:]]' then
   raise exception 'invalid_location_details';
  end if;
 end loop;
 return jsonb_build_object('version',1,'streetAddress',btrim(p_value->>'streetAddress'),
   'city',btrim(p_value->>'city'),'zipCode',btrim(p_value->>'zipCode'));
end $$;
revoke all on function partyplus_private.validate_location_details(jsonb) from public,anon,authenticated;

-- Retain the proven privacy projection and function identity/grants.
create or replace function public.partyplus_v2_read_party(p_party_id text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select partyplus_private.web_projection(jsonb_build_object(
  'id',p.id,'title',p.title,'date',p.date,'location',p.location,'address',to_jsonb(p)->>'address',
  'notes',p.notes,'theme',p.theme,'appearance',p.appearance,'locationDetails',p.location_details,
  'createdAt',p.created_at,'updatedAt',p.updated_at,'revision',p.revision,
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

alter function public.partyplus_v2_commit_party(uuid,bigint,jsonb) set schema partyplus_private;
alter function partyplus_private.partyplus_v2_commit_party(uuid,bigint,jsonb) rename to commit_party_before_location_details;
revoke all on function partyplus_private.commit_party_before_location_details(uuid,bigint,jsonb) from public,anon,authenticated;
create function public.partyplus_v2_commit_party(p_operation_id uuid,p_expected_revision bigint,p_party jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_uid uuid:=partyplus_private.require_principal(true);v_id text:=p_party->>'id';
 v_request jsonb:=jsonb_build_object('kind','commit','revision',p_expected_revision,'party',p_party);
 v_receipt jsonb;v_details jsonb;
 v_has_details boolean:=p_party?'locationDetails' and p_party->'locationDetails' is distinct from 'null'::jsonb;
begin
 v_receipt:=partyplus_private.replay(v_uid,p_operation_id,v_request);
 if v_receipt is not null then return v_receipt;end if;
 perform partyplus_private.require_writes();
 perform pg_advisory_xact_lock(hashtextextended('party:'||coalesce(v_id,''),0));
 -- Older clients can echo a null read-only projection property. Treat that as
 -- omission; intentional clearing requires the complete empty version-1 object.
 if v_has_details then v_details:=partyplus_private.validate_location_details(p_party->'locationDetails');end if;
 v_receipt:=partyplus_private.commit_party_before_location_details(p_operation_id,p_expected_revision,p_party);
 if v_has_details then
  update public.parties set location_details=v_details where id=v_id;
  v_receipt:=jsonb_set(v_receipt,'{party}',public.partyplus_v2_read_party(v_id));
  update partyplus_private.operations set receipt=v_receipt where principal_id=v_uid and operation_id=p_operation_id;
 end if;
 return v_receipt;
end $$;
revoke all on function public.partyplus_v2_commit_party(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.partyplus_v2_commit_party(uuid,bigint,jsonb) to authenticated;
notify pgrst,'reload schema';

do $$ begin
 if (select snapshot from pg_temp.partyplus_location_preservation) is distinct from jsonb_build_object('public.parties',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t)-'location_details')::text value from public.parties t) s),'public.party_items',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from public.party_items t) s),'public.party_rsvps',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from public.party_rsvps t) s),'partyplus_private.host_access',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from partyplus_private.host_access t) s),'partyplus_private.memberships',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from partyplus_private.memberships t) s),'partyplus_private.operations',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from partyplus_private.operations t) s),'auth.users',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from auth.users t) s),'storage.objects',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\n' order by value),''))) from (select (to_jsonb(t))::text value from storage.objects t) s)) then raise exception 'Original location migration data changed';end if;
 if (select access from pg_temp.partyplus_location_preservation) is distinct from jsonb_build_object('gate',(select writes_enabled from partyplus_private.release_control where singleton),'rpc',(select jsonb_agg(jsonb_build_object('function',p.oid::regprocedure::text,'role',r,'execute',has_function_privilege(r,p.oid,'EXECUTE')) order by p.oid::regprocedure::text,r) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join (values('anon'),('authenticated')) roles(r) where n.nspname='public' and p.proname like 'partyplus_%'),'raw',(select jsonb_agg(jsonb_build_object('table',t,'role',r,'allowed',has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) order by t,r) from (values('anon'),('authenticated')) roles(r) cross join (values('public.parties'),('public.party_items'),('public.party_rsvps')) tables(t))) then raise exception 'Existing access or write gate changed';end if;
end $$;
select jsonb_build_object('at',now(),'originalDataPreserved',true,'existingAccessAndGateUnchanged',true,'snapshots',(select snapshot from pg_temp.partyplus_location_preservation)) location_install;
commit;
