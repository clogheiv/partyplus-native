-- Blank synthetic database only; real Supabase staging uses its own Auth schema.
do $$ begin
  if current_setting('partyplus.environment',true) is distinct from 'synthetic'
    or exists(select 1 from pg_namespace where nspname='auth') then
    raise exception 'Explicit blank synthetic database required';
  end if;
end $$;
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (
  id uuid primary key,is_anonymous boolean not null default false,
  email_confirmed_at timestamptz,phone_confirmed_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
