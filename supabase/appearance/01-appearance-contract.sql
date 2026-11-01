-- Additive appearance/image-slot contract. Bucket creation uses the Storage API
-- separately; this migration never inserts/deletes Storage metadata or objects.
-- Images in the reviewed PUBLIC bucket are visible to anyone with their URL.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
  if to_regprocedure('public.partyplus_web_read_party(text)') is null
    or to_regprocedure('storage.allow_any_operation(text[])') is null then
    raise exception 'Existing web contract and Storage operation helpers required';
  end if;
  if to_regprocedure('partyplus_private.commit_party_before_appearance(uuid,bigint,jsonb)') is not null
    or exists(select 1 from information_schema.columns where table_schema='public' and table_name='parties' and column_name='appearance') then
    raise exception 'Appearance already installed: inspect rather than reinstall';
  end if;
  if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects') then
    raise exception 'Existing Storage policies need explicit compatibility review';
  end if;
end $$;

-- Nullable/no backfill: every existing customer field/timestamp is untouched.
alter table public.parties add column appearance jsonb;
create table partyplus_private.image_creation_intents (
  party_id text primary key, principal_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table partyplus_private.party_images (
  id uuid primary key, party_id text not null,
  principal_id uuid not null references auth.users(id),
  byte_size integer not null check(byte_size between 1 and 1500000),
  client_sha256 text not null check(client_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(), retiring_at timestamptz, released_at timestamptz
);
create index party_images_party_idx on partyplus_private.party_images(party_id) where released_at is null;
create index party_images_principal_idx on partyplus_private.party_images(principal_id) where released_at is null;
alter table partyplus_private.image_creation_intents enable row level security;
alter table partyplus_private.party_images enable row level security;
revoke all on partyplus_private.image_creation_intents,partyplus_private.party_images from public,anon,authenticated;

create function partyplus_private.image_host(p_party_id text,p_uid uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case when exists(select 1 from public.parties where id=p_party_id)
    then exists(select 1 from partyplus_private.host_access where party_id=p_party_id and principal_id=p_uid)
    else exists(select 1 from partyplus_private.image_creation_intents where party_id=p_party_id and principal_id=p_uid)
  end
$$;

create function public.partyplus_web_prepare_image(p_party_id text,p_image_id uuid,p_byte_size integer,p_sha256 text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_uid uuid:=partyplus_private.require_principal(true); v_existing partyplus_private.party_images;
begin
  perform partyplus_private.require_writes();
  if length(coalesce(p_party_id,'')) not between 1 and 200 or p_image_id is null
    or p_byte_size is null or p_byte_size not between 1 and 1500000
    or coalesce(p_sha256,'') !~ '^[0-9a-f]{64}$' then raise exception 'invalid_image'; end if;
  perform pg_advisory_xact_lock(hashtextextended('party:'||p_party_id,0));
  if exists(select 1 from public.parties where id=p_party_id) then
    if not exists(select 1 from public.parties where id=p_party_id and deleted_at is null)
      or not partyplus_private.image_host(p_party_id,v_uid) then
      raise exception 'host_access_required' using errcode='42501';
    end if;
  else
    -- Only fresh random UUID party identities may reserve an unsaved image slot.
    if p_party_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'invalid_party'; end if;
    insert into partyplus_private.image_creation_intents(party_id,principal_id)
      values(p_party_id,v_uid) on conflict do nothing;
    if not partyplus_private.image_host(p_party_id,v_uid) then raise exception 'host_access_required' using errcode='42501'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('partyplus:image-budget',0));
  select * into v_existing from partyplus_private.party_images where id=p_image_id for update;
  if found then
    if v_existing.principal_id<>v_uid or v_existing.party_id<>p_party_id or v_existing.released_at is not null or v_existing.retiring_at is not null
      or v_existing.byte_size<>p_byte_size or v_existing.client_sha256<>p_sha256 then
      raise exception 'image_operation_conflict';
    end if;
  else
    -- Worst-case reserved capacity, not untrusted declared bytes: <=240 MB total,
    -- <=60 MB per principal, <=12 MB per party. No overage/paid feature enabled.
    if (select count(*) from partyplus_private.party_images where released_at is null)>=160
      or (select count(*) from partyplus_private.party_images where released_at is null and principal_id=v_uid)>=40
      or (select count(*) from partyplus_private.party_images where released_at is null and party_id=p_party_id)>=8 then
      raise exception 'image_capacity_reached';
    end if;
    insert into partyplus_private.party_images(id,party_id,principal_id,byte_size,client_sha256)
      values(p_image_id,p_party_id,v_uid,p_byte_size,p_sha256);
  end if;
  return jsonb_build_object('imageId',p_image_id,'bucket','partyplus-party-images','path',p_image_id::text||'.jpg');
end $$;

create function partyplus_private.validate_appearance(p_value jsonb,p_party_id text,p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_image jsonb; v_image_id uuid;
begin
  if p_value is null or p_value='null'::jsonb then return null; end if;
  if jsonb_typeof(p_value)<>'object' or octet_length(p_value::text)>2000 then raise exception 'invalid_appearance'; end if;
  if exists(select 1 from jsonb_object_keys(p_value) key where key not in ('version','design','layout','accent','font','artwork','image'))
    or p_value->'version' is distinct from '1'::jsonb
    or coalesce(p_value->>'design','') not in ('partyplus','casual','birthday','cookout','holiday','shower','game-night')
    or coalesce(p_value->>'layout','') not in ('illustrated','photo','elegant')
    or coalesce(p_value->>'accent','') not in ('navy','cobalt','orchid','forest','coral','gold')
    or coalesce(p_value->>'font','') not in ('editorial','modern','classic')
    or coalesce(p_value->>'artwork','') not in ('partyplus','confetti','balloons','citrus','evergreen','blossom','game-night','none') then
    raise exception 'invalid_appearance';
  end if;
  v_image:=p_value->'image';
  if v_image is null or v_image='null'::jsonb then return p_value-'image'; end if;
  if jsonb_typeof(v_image)<>'object'
    or exists(select 1 from jsonb_object_keys(v_image) key where key not in ('id','positionX','positionY','zoom'))
    or coalesce(v_image->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(v_image->'positionX') is distinct from 'number'
    or jsonb_typeof(v_image->'positionY') is distinct from 'number'
    or jsonb_typeof(v_image->'zoom') is distinct from 'number' then raise exception 'invalid_image_position'; end if;
  if (v_image->>'positionX')::numeric not between 0 and 100
    or (v_image->>'positionY')::numeric not between 0 and 100
    or (v_image->>'zoom')::numeric not between 1 and 2 then raise exception 'invalid_image_position'; end if;
  v_image_id:=(v_image->>'id')::uuid;
  if not exists(select 1 from partyplus_private.party_images a join storage.objects o
    on o.bucket_id='partyplus-party-images' and o.name=a.id::text||'.jpg'
    where a.id=v_image_id and a.party_id=p_party_id and a.principal_id=p_uid and a.released_at is null and a.retiring_at is null
      and o.metadata->>'mimetype'='image/jpeg' and (o.metadata->>'size')::numeric=a.byte_size) then
    raise exception 'image_upload_required';
  end if;
  return p_value;
end $$;

-- Keep the tested transaction/revision/claim/RSVP core intact behind a private
-- wrapper. It cannot be called directly by clients to bypass appearance checks.
alter function public.partyplus_v2_commit_party(uuid,bigint,jsonb) set schema partyplus_private;
alter function partyplus_private.partyplus_v2_commit_party(uuid,bigint,jsonb) rename to commit_party_before_appearance;
revoke all on function partyplus_private.commit_party_before_appearance(uuid,bigint,jsonb) from public,anon,authenticated;
create function public.partyplus_v2_commit_party(p_operation_id uuid,p_expected_revision bigint,p_party jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_uid uuid:=partyplus_private.require_principal(true); v_id text:=p_party->>'id';
  v_request jsonb:=jsonb_build_object('kind','commit','revision',p_expected_revision,'party',p_party);
  v_receipt jsonb; v_appearance jsonb;
begin
  v_receipt:=partyplus_private.replay(v_uid,p_operation_id,v_request);
  if v_receipt is not null then return v_receipt; end if;
  perform partyplus_private.require_writes();
  perform pg_advisory_xact_lock(hashtextextended('party:'||coalesce(v_id,''),0));
  if not exists(select 1 from public.parties where id=v_id)
    and exists(select 1 from partyplus_private.image_creation_intents where party_id=v_id and principal_id<>v_uid) then
    raise exception 'host_access_required' using errcode='42501';
  end if;
  if p_party?'appearance' then
    v_appearance:=partyplus_private.validate_appearance(p_party->'appearance',v_id,v_uid);
  end if;
  v_receipt:=partyplus_private.commit_party_before_appearance(p_operation_id,p_expected_revision,p_party);
  if p_party?'appearance' then
    update public.parties set appearance=v_appearance where id=v_id;
    v_receipt:=jsonb_set(v_receipt,'{party}',public.partyplus_v2_read_party(v_id));
    update partyplus_private.operations set receipt=v_receipt where principal_id=v_uid and operation_id=p_operation_id;
  end if;
  return v_receipt;
end $$;

create or replace function public.partyplus_v2_read_party(p_party_id text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select partyplus_private.web_projection(jsonb_build_object(
    'id',p.id,'title',p.title,'date',p.date,'location',p.location,'address',to_jsonb(p)->>'address',
    'notes',p.notes,'theme',p.theme,'appearance',p.appearance,'createdAt',p.created_at,'updatedAt',p.updated_at,'revision',p.revision,
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

create function public.partyplus_web_can_upload_image(p_name text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null or not exists(select 1 from auth.users where id=v_uid and not is_anonymous and email_confirmed_at is not null) then return false; end if;
  perform partyplus_private.require_writes();
  return exists(select 1 from partyplus_private.party_images a where a.id::text||'.jpg'=p_name
    and a.principal_id=v_uid and a.released_at is null and a.retiring_at is null and partyplus_private.image_host(a.party_id,v_uid)
    and not exists(select 1 from public.parties where id=a.party_id and deleted_at is not null));
end $$;
create function public.partyplus_web_can_delete_image(p_name text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null or not exists(select 1 from auth.users where id=v_uid and not is_anonymous and email_confirmed_at is not null) then return false; end if;
  perform partyplus_private.require_writes();
  return exists(select 1 from partyplus_private.party_images a where a.id::text||'.jpg'=p_name
    and a.principal_id=v_uid and a.released_at is null and a.retiring_at is not null and partyplus_private.image_host(a.party_id,v_uid)
    and not exists(select 1 from public.parties p where p.deleted_at is null and p.appearance->'image'->>'id'=a.id::text));
end $$;

create policy partyplus_image_insert on storage.objects for insert to authenticated
  with check(bucket_id='partyplus-party-images' and public.partyplus_web_can_upload_image(name));
-- Public GET is the reviewed bearer-capability model; there is deliberately NO
-- public SELECT/list policy. This SELECT permission is only for host deletion.
create policy partyplus_image_delete_lookup on storage.objects for select to authenticated
  using(bucket_id='partyplus-party-images'
    and storage.allow_any_operation(array['object.delete','object.delete_many'])
    and public.partyplus_web_can_delete_image(name));
create policy partyplus_image_delete on storage.objects for delete to authenticated
  using(bucket_id='partyplus-party-images' and public.partyplus_web_can_delete_image(name));

-- A committed removal intent closes the cross-request race: after this point a
-- concurrent host save cannot newly reference an object the Storage API removes.
create function public.partyplus_web_begin_image_removal(p_image_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_uid uuid:=partyplus_private.require_principal(true); v_asset partyplus_private.party_images;
begin
  perform partyplus_private.require_writes();
  select * into v_asset from partyplus_private.party_images where id=p_image_id;
  if not found or v_asset.principal_id<>v_uid or not partyplus_private.image_host(v_asset.party_id,v_uid) then
    raise exception 'host_access_required' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('party:'||v_asset.party_id,0));
  if exists(select 1 from public.parties p where p.deleted_at is null and p.appearance->'image'->>'id'=p_image_id::text) then raise exception 'image_in_use'; end if;
  update partyplus_private.party_images set retiring_at=coalesce(retiring_at,now()) where id=p_image_id;
  return jsonb_build_object('imageId',p_image_id,'bucket','partyplus-party-images','path',p_image_id::text||'.jpg');
end $$;

create function public.partyplus_web_release_image(p_image_id uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare v_uid uuid:=partyplus_private.require_principal(true); v_asset partyplus_private.party_images;
begin
  perform partyplus_private.require_writes();
  select * into v_asset from partyplus_private.party_images where id=p_image_id;
  if not found or v_asset.principal_id<>v_uid or not partyplus_private.image_host(v_asset.party_id,v_uid) then
    raise exception 'host_access_required' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('party:'||v_asset.party_id,0));
  if v_asset.retiring_at is null then raise exception 'image_removal_intent_required'; end if;
  if exists(select 1 from public.parties p where p.deleted_at is null and p.appearance->'image'->>'id'=p_image_id::text) then raise exception 'image_in_use'; end if;
  if exists(select 1 from storage.objects where bucket_id='partyplus-party-images' and name=p_image_id::text||'.jpg') then raise exception 'image_still_exists'; end if;
  update partyplus_private.party_images set released_at=coalesce(released_at,now()) where id=p_image_id;
  return true;
end $$;

revoke all on all functions in schema partyplus_private from public,anon,authenticated;
revoke all on function public.partyplus_v2_commit_party(uuid,bigint,jsonb),
  public.partyplus_web_prepare_image(text,uuid,integer,text),public.partyplus_web_release_image(uuid),
  public.partyplus_web_begin_image_removal(uuid),
  public.partyplus_web_can_upload_image(text),public.partyplus_web_can_delete_image(text) from public,anon,authenticated;
grant execute on function public.partyplus_v2_commit_party(uuid,bigint,jsonb),
  public.partyplus_web_prepare_image(text,uuid,integer,text),public.partyplus_web_release_image(uuid),
  public.partyplus_web_begin_image_removal(uuid),
  public.partyplus_web_can_upload_image(text),public.partyplus_web_can_delete_image(text) to authenticated;
notify pgrst,'reload schema';
commit;
