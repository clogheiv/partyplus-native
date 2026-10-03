-- Metadata-only clone. No production records. Source SHA256: 9830e20e7708dcf596d6c4a2f435ae31da2ae42c64f1fe7fa5854d5fc2639d88
do $$ begin
  if coalesce(current_setting('partyplus.environment',true),'') not in ('synthetic','staging','local')
     or to_regclass('public.parties') is not null or to_regclass('public.party_items') is not null
     or to_regclass('public.party_rsvps') is not null then
    raise exception 'Explicit nonproduction and blank application schema required';
  end if;
end $$;
create table public."parties" (
  "id" text not null,
  "title" text default ''::text not null,
  "datetime" timestamp with time zone,
  "location_name" text,
  "address" text,
  "lat" double precision,
  "lng" double precision,
  "notes" text,
  "host_id" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table public."party_items" (
  "id" uuid default gen_random_uuid() not null,
  "party_id" text not null,
  "name" text not null,
  "qty" text,
  "claimed_by" text,
  "sort_order" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null
);
create table public."party_rsvps" (
  "id" uuid default gen_random_uuid() not null,
  "party_id" text not null,
  "guest_name" text,
  "status" text not null,
  "created_at" timestamp with time zone default now() not null,
  "name" text,
  "attendee_count" integer,
  "updated_at" timestamp with time zone
);
alter table public."parties" add constraint "parties_pkey" PRIMARY KEY (id);
alter table public."party_items" add constraint "party_items_party_id_fkey" FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;
alter table public."party_items" add constraint "party_items_pkey" PRIMARY KEY (id);
alter table public."party_rsvps" add constraint "party_rsvps_party_id_fkey" FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;
alter table public."party_rsvps" add constraint "party_rsvps_party_id_guest_name_key" UNIQUE (party_id, guest_name);
alter table public."party_rsvps" add constraint "party_rsvps_pkey" PRIMARY KEY (party_id, id);
alter table public."party_rsvps" add constraint "party_rsvps_status_check" CHECK ((status = ANY (ARRAY['yes'::text, 'no'::text, 'maybe'::text])));
CREATE INDEX party_rsvps_party_id_idx ON public.party_rsvps USING btree (party_id);
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE TRIGGER trg_parties_updated_at BEFORE UPDATE ON public.parties FOR EACH ROW EXECUTE FUNCTION set_updated_at();
alter table public."parties" enable row level security;
grant all on public."parties" to anon,authenticated;
alter table public."party_items" enable row level security;
grant all on public."party_items" to anon,authenticated;
alter table public."party_rsvps" enable row level security;
grant all on public."party_rsvps" to anon,authenticated;
create policy "public insert parties" on public."parties" as PERMISSIVE for INSERT to "anon","authenticated" with check (true);
create policy "public read parties" on public."parties" as PERMISSIVE for SELECT to "anon","authenticated" using (true);
create policy "public update parties" on public."parties" as PERMISSIVE for UPDATE to "anon","authenticated" using (true) with check (true);
create policy "public delete party_items" on public."party_items" as PERMISSIVE for DELETE to "anon","authenticated" using (true);
create policy "public insert party_items" on public."party_items" as PERMISSIVE for INSERT to "anon","authenticated" with check (true);
create policy "public read party_items" on public."party_items" as PERMISSIVE for SELECT to "anon","authenticated" using (true);
create policy "public update party_items" on public."party_items" as PERMISSIVE for UPDATE to "anon","authenticated" using (true) with check (true);
create policy "public delete party_rsvps" on public."party_rsvps" as PERMISSIVE for DELETE to "anon","authenticated" using (true);
create policy "public insert party_rsvps" on public."party_rsvps" as PERMISSIVE for INSERT to "anon","authenticated" with check (true);
create policy "public read party_rsvps" on public."party_rsvps" as PERMISSIVE for SELECT to "anon","authenticated" using (true);
create policy "public update party_rsvps" on public."party_rsvps" as PERMISSIVE for UPDATE to "anon","authenticated" using (true) with check (true);
