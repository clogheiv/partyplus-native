create table if not exists public.party_rsvps (
  party_id text not null references public.parties (id) on delete cascade,
  id text not null,
  name text not null,
  status text not null check (status in ('yes', 'no', 'maybe')),
  attendee_count integer not null default 1 check (attendee_count >= 1),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (party_id, id)
);

create index if not exists party_rsvps_party_id_idx
  on public.party_rsvps (party_id);
