do $$
begin
  if to_regclass('public.party_rsvps') is null then
    return;
  end if;

  execute 'alter table public.party_rsvps drop constraint if exists party_rsvps_pkey';
  execute 'alter table public.party_rsvps alter column party_id set not null';
  execute 'alter table public.party_rsvps alter column id set not null';
  execute 'alter table public.party_rsvps add constraint party_rsvps_pkey primary key (party_id, id)';
end $$;
