-- Metadata only. No application/customer rows, writes, or configuration changes.
begin transaction read only;
set local statement_timeout='30s';
do $$ declare v_actual jsonb; begin
  select jsonb_agg(jsonb_build_object('table_name',table_name,'column_name',column_name,'data_type',data_type,'is_nullable',is_nullable,'column_default',column_default) order by table_name,column_name)
    into v_actual from information_schema.columns where table_schema='public' and table_name in ('parties','party_items','party_rsvps');
  if v_actual is distinct from (select jsonb_agg(value order by value->>'table_name',value->>'column_name') from jsonb_array_elements('[{"table_name":"parties","column_name":"id","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"parties","column_name":"title","data_type":"text","is_nullable":"NO","column_default":"''''::text"},{"table_name":"parties","column_name":"datetime","data_type":"timestamp with time zone","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"location_name","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"address","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"lat","data_type":"double precision","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"lng","data_type":"double precision","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"notes","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"host_id","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},{"table_name":"parties","column_name":"updated_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},{"table_name":"party_items","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},{"table_name":"party_items","column_name":"party_id","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"party_items","column_name":"name","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"party_items","column_name":"qty","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"party_items","column_name":"claimed_by","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"party_items","column_name":"sort_order","data_type":"integer","is_nullable":"NO","column_default":"0"},{"table_name":"party_items","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},{"table_name":"party_rsvps","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},{"table_name":"party_rsvps","column_name":"party_id","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"party_rsvps","column_name":"guest_name","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"party_rsvps","column_name":"status","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"party_rsvps","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},{"table_name":"party_rsvps","column_name":"name","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"party_rsvps","column_name":"attendee_count","data_type":"integer","is_nullable":"YES","column_default":null},{"table_name":"party_rsvps","column_name":"updated_at","data_type":"timestamp with time zone","is_nullable":"YES","column_default":null}]'::jsonb)) then
    raise exception 'Baseline column drift: refresh metadata and reconcile';
  end if;
  select jsonb_agg(jsonb_build_object('tablename',tablename,'policyname',policyname,'cmd',cmd,'qual',qual,'with_check',with_check,'roles',roles) order by tablename,policyname)
    into v_actual from pg_policies where schemaname='public' and tablename in ('parties','party_items','party_rsvps');
  if v_actual is distinct from '[{"tablename":"parties","policyname":"public insert parties","cmd":"INSERT","qual":null,"with_check":"true","roles":["anon","authenticated"]},{"tablename":"parties","policyname":"public read parties","cmd":"SELECT","qual":"true","with_check":null,"roles":["anon","authenticated"]},{"tablename":"parties","policyname":"public update parties","cmd":"UPDATE","qual":"true","with_check":"true","roles":["anon","authenticated"]},{"tablename":"party_items","policyname":"public delete party_items","cmd":"DELETE","qual":"true","with_check":null,"roles":["anon","authenticated"]},{"tablename":"party_items","policyname":"public insert party_items","cmd":"INSERT","qual":null,"with_check":"true","roles":["anon","authenticated"]},{"tablename":"party_items","policyname":"public read party_items","cmd":"SELECT","qual":"true","with_check":null,"roles":["anon","authenticated"]},{"tablename":"party_items","policyname":"public update party_items","cmd":"UPDATE","qual":"true","with_check":"true","roles":["anon","authenticated"]},{"tablename":"party_rsvps","policyname":"public delete party_rsvps","cmd":"DELETE","qual":"true","with_check":null,"roles":["anon","authenticated"]},{"tablename":"party_rsvps","policyname":"public insert party_rsvps","cmd":"INSERT","qual":null,"with_check":"true","roles":["anon","authenticated"]},{"tablename":"party_rsvps","policyname":"public read party_rsvps","cmd":"SELECT","qual":"true","with_check":null,"roles":["anon","authenticated"]},{"tablename":"party_rsvps","policyname":"public update party_rsvps","cmd":"UPDATE","qual":"true","with_check":"true","roles":["anon","authenticated"]}]'::jsonb then
    raise exception 'Baseline policy drift: refresh metadata and reconcile';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('parties','party_items','party_rsvps') and (not c.relrowsecurity or pg_get_userbyid(c.relowner)<>current_user)) then
    raise exception 'Unexpected RLS or table owner';
  end if;
  if to_regnamespace('partyplus_private') is not null then raise exception 'Existing contract: reconcile instead of reinstalling'; end if;
end $$;
do $$ declare v_actual jsonb; begin
  select jsonb_agg(jsonb_build_object('table_name',table_name,'column_name',column_name,'data_type',data_type,'is_nullable',is_nullable,'column_default',column_default) order by table_name,column_name)
    into v_actual from information_schema.columns where table_schema='public' and table_name in ('parties','party_items','party_rsvps');
  if v_actual is distinct from (select jsonb_agg(value order by value->>'table_name',value->>'column_name') from jsonb_array_elements('[{"table_name":"parties","column_name":"id","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"parties","column_name":"title","data_type":"text","is_nullable":"NO","column_default":"''''::text"},{"table_name":"parties","column_name":"datetime","data_type":"timestamp with time zone","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"location_name","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"address","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"lat","data_type":"double precision","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"lng","data_type":"double precision","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"notes","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"host_id","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"parties","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},{"table_name":"parties","column_name":"updated_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},{"table_name":"party_items","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},{"table_name":"party_items","column_name":"party_id","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"party_items","column_name":"name","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"party_items","column_name":"qty","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"party_items","column_name":"claimed_by","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"party_items","column_name":"sort_order","data_type":"integer","is_nullable":"NO","column_default":"0"},{"table_name":"party_items","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},{"table_name":"party_rsvps","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},{"table_name":"party_rsvps","column_name":"party_id","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"party_rsvps","column_name":"guest_name","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"party_rsvps","column_name":"status","data_type":"text","is_nullable":"NO","column_default":null},{"table_name":"party_rsvps","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},{"table_name":"party_rsvps","column_name":"name","data_type":"text","is_nullable":"YES","column_default":null},{"table_name":"party_rsvps","column_name":"attendee_count","data_type":"integer","is_nullable":"YES","column_default":null},{"table_name":"party_rsvps","column_name":"updated_at","data_type":"timestamp with time zone","is_nullable":"YES","column_default":null}]'::jsonb)) then
    raise exception 'Baseline column drift: refresh metadata and reconcile';
  end if;
end $$;
do $$ declare v_actual jsonb; begin
  select jsonb_agg(jsonb_build_object('table_name',c.conrelid::regclass::text,'conname',c.conname,'contype',c.contype,'definition',pg_get_constraintdef(c.oid)) order by c.conrelid::regclass::text,c.conname)
    into v_actual from pg_constraint c where c.connamespace='public'::regnamespace and c.contype<>'n';
  if v_actual is distinct from (select jsonb_agg(value order by value->>'table_name',value->>'conname') from jsonb_array_elements('[{"conname":"parties_pkey","contype":"p","definition":"PRIMARY KEY (id)","table_name":"parties"},{"conname":"party_items_party_id_fkey","contype":"f","definition":"FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE","table_name":"party_items"},{"conname":"party_items_pkey","contype":"p","definition":"PRIMARY KEY (id)","table_name":"party_items"},{"conname":"party_rsvps_party_id_fkey","contype":"f","definition":"FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE","table_name":"party_rsvps"},{"conname":"party_rsvps_party_id_guest_name_key","contype":"u","definition":"UNIQUE (party_id, guest_name)","table_name":"party_rsvps"},{"conname":"party_rsvps_pkey","contype":"p","definition":"PRIMARY KEY (party_id, id)","table_name":"party_rsvps"},{"conname":"party_rsvps_status_check","contype":"c","definition":"CHECK ((status = ANY (ARRAY[''yes''::text, ''no''::text, ''maybe''::text])))","table_name":"party_rsvps"}]'::jsonb)) then
    raise exception 'Baseline constraint drift: refresh metadata and reconcile';
  end if;
end $$;

select jsonb_pretty(jsonb_build_object(
  'freeze_preflight_matches',true,'operator',current_user,'project_ref','typbofemqhjoiwbkdvuc','usage',jsonb_build_object('parties',(select jsonb_build_object('total',count(*),'latest_created_at',max(created_at),'created_24h',count(*) filter(where created_at>=now()-interval '24 hours'),'created_7d',count(*) filter(where created_at>=now()-interval '7 days'),'created_30d',count(*) filter(where created_at>=now()-interval '30 days'),'latest_updated_at',max(updated_at),'updated_24h',count(*) filter(where updated_at>=now()-interval '24 hours'),'updated_7d',count(*) filter(where updated_at>=now()-interval '7 days'),'updated_30d',count(*) filter(where updated_at>=now()-interval '30 days'),'updated_at_null',count(*) filter(where updated_at is null)) from public.parties),'party_items',(select jsonb_build_object('total',count(*),'latest_created_at',max(created_at),'created_24h',count(*) filter(where created_at>=now()-interval '24 hours'),'created_7d',count(*) filter(where created_at>=now()-interval '7 days'),'created_30d',count(*) filter(where created_at>=now()-interval '30 days')) from public.party_items),'party_rsvps',(select jsonb_build_object('total',count(*),'latest_created_at',max(created_at),'created_24h',count(*) filter(where created_at>=now()-interval '24 hours'),'created_7d',count(*) filter(where created_at>=now()-interval '7 days'),'created_30d',count(*) filter(where created_at>=now()-interval '30 days'),'latest_updated_at',max(updated_at),'updated_24h',count(*) filter(where updated_at>=now()-interval '24 hours'),'updated_7d',count(*) filter(where updated_at>=now()-interval '7 days'),'updated_30d',count(*) filter(where updated_at>=now()-interval '30 days'),'updated_at_null',count(*) filter(where updated_at is null)) from public.party_rsvps)),'captured_at',now(), 'database',current_database(), 'version',version(),
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
