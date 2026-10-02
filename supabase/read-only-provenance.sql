-- Run with an authorized read-only administrative connection. No customer rows selected.
begin transaction read only;
select current_database() as database_name, version() as postgres_version;
select n.nspname as schema_name,c.relname,c.relrowsecurity,c.relforcerowsecurity,
  pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p') order by 1,2;
select table_schema,table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public' order by table_name,ordinal_position;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname='public' order by tablename,policyname;
select table_schema,table_name,grantee,privilege_type,is_grantable
from information_schema.table_privileges where table_schema in ('public','auth') order by 1,2,3,4;
select n.nspname as schema_name,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,p.proconfig,p.proacl,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f' order by p.proname;
select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid) as definition
from pg_constraint where connamespace='public'::regnamespace order by 1,2;
select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname='public' order by 2,3;
select pubname,schemaname,tablename from pg_publication_tables order by 1,2,3;
-- Migration ledger metadata is intentionally separate from application/customer tables.
select to_regclass('supabase_migrations.schema_migrations') as migration_ledger;
commit;
