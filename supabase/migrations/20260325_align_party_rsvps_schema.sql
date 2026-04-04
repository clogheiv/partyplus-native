alter table if exists public.party_rsvps
  add column if not exists name text,
  add column if not exists status text,
  add column if not exists attendee_count integer,
  add column if not exists updated_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'party_rsvps'
      and column_name = 'attendee_name'
  ) then
    execute 'update public.party_rsvps set name = coalesce(name, attendee_name) where name is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'party_rsvps'
      and column_name = 'guest_name'
  ) then
    execute 'update public.party_rsvps set name = coalesce(name, guest_name) where name is null';
    execute 'update public.party_rsvps set guest_name = coalesce(guest_name, name, ''Guest'') where guest_name is null';
    execute 'alter table public.party_rsvps alter column guest_name drop not null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'party_rsvps'
      and column_name = 'rsvp_status'
  ) then
    execute 'update public.party_rsvps set status = coalesce(status, rsvp_status) where status is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'party_rsvps'
      and column_name = 'response'
  ) then
    execute 'update public.party_rsvps set status = coalesce(status, response) where status is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'party_rsvps'
      and column_name = 'count'
  ) then
    execute 'update public.party_rsvps set attendee_count = coalesce(attendee_count, count) where attendee_count is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'party_rsvps'
      and column_name = 'party_size'
  ) then
    execute 'update public.party_rsvps set attendee_count = coalesce(attendee_count, party_size) where attendee_count is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'party_rsvps'
      and column_name = 'created_at'
  ) then
    execute 'update public.party_rsvps set updated_at = coalesce(updated_at, created_at) where updated_at is null';
  end if;
end $$;

update public.party_rsvps
set
  name = coalesce(nullif(trim(name), ''), 'Guest'),
  status = case when status in ('yes', 'no', 'maybe') then status else 'maybe' end,
  attendee_count = greatest(coalesce(attendee_count, 1), 1),
  updated_at = coalesce(updated_at, timezone('utc', now()));
