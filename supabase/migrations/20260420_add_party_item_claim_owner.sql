alter table if exists public.party_items
  add column if not exists claimed_by_user_id text;

create index if not exists party_items_claimed_by_user_id_idx
  on public.party_items (claimed_by_user_id);
