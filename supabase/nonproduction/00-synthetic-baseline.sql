-- Synthetic blank database only. Never run this against Supabase or production.
do $$ begin
  if current_setting('partyplus.environment', true) is distinct from 'synthetic'
     or exists(select 1 from pg_namespace where nspname = 'auth') then
    raise exception 'Requires an explicitly marked blank synthetic database';
  end if;
end $$;
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (
  id uuid primary key, is_anonymous boolean not null default false,
  email_confirmed_at timestamptz, phone_confirmed_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.parties (
  id text primary key, title text not null, date timestamptz, location text, notes text, theme text,
  host_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision bigint not null default 1, deleted_at timestamptz
);
create table public.party_items (
  party_id text not null references public.parties(id), id text not null, name text not null,
  qty text, claimed_by text, claimed_by_user_id text, created_by text, sort_order integer not null default 0,
  primary key(party_id,id)
);
create table public.party_rsvps (
  party_id text not null references public.parties(id), id text not null, name text not null,
  status text not null check(status in ('yes','maybe','no')),
  attendee_count integer not null check(attendee_count between 1 and 100),
  updated_at timestamptz not null default now(), primary key(party_id,id)
);
