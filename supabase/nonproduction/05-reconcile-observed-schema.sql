-- Nonproduction only: additive reconciliation of the metadata captured 2026-10-02.
-- Apply after a synthetic metadata-only clone, before 10-v2-contract.sql.
-- Not an approved production migration; no customer data has been inspected.
do $$ begin
  if coalesce(current_setting('partyplus.environment',true),'') not in ('synthetic','staging','local') then
    raise exception 'Explicit nonproduction environment required';
  end if;
end $$;
alter table public.parties add column revision bigint not null default 1;
alter table public.parties add column deleted_at timestamptz;
alter table public.parties add column date timestamptz;
alter table public.parties add column location text;
alter table public.parties add column theme text;
update public.parties set date=datetime,location=location_name;
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
