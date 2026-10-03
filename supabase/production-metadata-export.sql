-- Metadata only. No application/customer rows, writes, or configuration changes.
begin transaction read only;
select jsonb_pretty(jsonb_build_object(
  'captured_at',now(), 'database',current_database(), 'version',version(),
  'read_only',current_setting('transaction_read_only'),
  'schemas',(select jsonb_agg(to_jsonb(s)) from (
    select nspname,pg_get_userbyid(nspowner) as owner,nspacl::text as acl
    from pg_namespace where nspname in ('public','auth','realtime','supabase_migrations')
  ) s),
  'tables',(select jsonb_agg(to_jsonb(t)) from (
    select n.nspname as schema,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
      pg_get_userbyid(c.relowner) as owner,c.relacl::text as acl
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m','S') order by c.relname
  ) t),
  'columns',(select jsonb_agg(to_jsonb(c)) from (
    select table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default,
      is_identity,is_generated
    from information_schema.columns where table_schema='public'
      or (table_schema='auth' and table_name='users' and column_name in
        ('id','is_anonymous','email_confirmed_at','phone_confirmed_at'))
    order by table_schema,table_name,ordinal_position
  ) c),
  'policies',(select jsonb_agg(to_jsonb(p)) from (
    select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
    from pg_policies where schemaname='public' order by tablename,policyname
  ) p),
  'grants',(select jsonb_agg(to_jsonb(g)) from (
    select table_schema,table_name,grantee,privilege_type,is_grantable
    from information_schema.table_privileges where table_schema='public'
    order by table_name,grantee,privilege_type
  ) g),
  'functions',(select jsonb_agg(to_jsonb(f)) from (
    select n.nspname as schema,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
      pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.proconfig,p.proacl::text as acl,
      pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
      and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass
        and d.objid=p.oid and d.deptype='e') order by p.proname
  ) f),
  'constraints',(select jsonb_agg(to_jsonb(k)) from (
    select conrelid::regclass::text as table_name,conname,contype,
      pg_get_constraintdef(oid) as definition
    from pg_constraint where connamespace='public'::regnamespace order by conrelid,conname
  ) k),
  'indexes',(select jsonb_agg(to_jsonb(i)) from (
    select schemaname,tablename,indexname,indexdef from pg_indexes
    where schemaname='public' order by tablename,indexname
  ) i),
  'triggers',(select jsonb_agg(to_jsonb(t)) from (
    select c.relname,t.tgname,pg_get_triggerdef(t.oid) as definition
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname
  ) t),
  'default_grants',(select jsonb_agg(to_jsonb(d)) from (
    select pg_get_userbyid(defaclrole) as owner,defaclnamespace::regnamespace::text as schema,
      defaclobjtype,defaclacl::text as acl from pg_default_acl
  ) d),
  'publications',(select jsonb_agg(to_jsonb(p)) from (
    select pubname,puballtables,pubinsert,pubupdate,pubdelete,pubtruncate from pg_publication
  ) p),
  'publication_tables',(select jsonb_agg(to_jsonb(p)) from (
    select pubname,schemaname,tablename from pg_publication_tables order by pubname,schemaname,tablename
  ) p),
  'migration_ledger',to_regclass('supabase_migrations.schema_migrations')::text
)) as metadata;
commit;
