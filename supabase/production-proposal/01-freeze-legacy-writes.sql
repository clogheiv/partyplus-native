-- REVIEW ONLY. Separate Michael production approval is required. No deployment automation.
-- Baseline metadata SHA256 9830e20e7708dcf596d6c4a2f435ae31da2ae42c64f1fe7fa5854d5fc2639d88
-- Before execution, operator must set SESSION partyplus.security_approval='freeze-v1'
-- and partyplus.target_project='typbofemqhjoiwbkdvuc' on the confirmed live connection.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
  if current_setting('partyplus.security_approval',true) is distinct from 'freeze-v1'
     or coalesce(current_setting('partyplus.target_project',true),'') not in ('typbofemqhjoiwbkdvuc','qmbwrbxbbshbavfhkujx','synthetic') then
    raise exception 'Separate reviewed security approval and confirmed target required';
  end if;
  if current_setting('partyplus.target_project',true)='typbofemqhjoiwbkdvuc' and current_user <> 'postgres' then
    raise exception 'Reviewed production owner connection required';
  end if;
end $$;
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
lock table public.parties,public.party_items,public.party_rsvps in access exclusive mode;
drop policy "public insert parties" on public."parties";
drop policy "public update parties" on public."parties";
drop policy "public delete party_items" on public."party_items";
drop policy "public insert party_items" on public."party_items";
drop policy "public update party_items" on public."party_items";
drop policy "public delete party_rsvps" on public."party_rsvps";
drop policy "public insert party_rsvps" on public."party_rsvps";
drop policy "public update party_rsvps" on public."party_rsvps";
revoke all on public.parties from public,anon,authenticated;
grant select on public.parties to anon,authenticated;
revoke all ("id","title","datetime","location_name","address","lat","lng","notes","host_id","created_at","updated_at") on public.parties from public,anon,authenticated;
create policy partyplus_legacy_deny_insert on public.parties as restrictive for insert to anon,authenticated with check (false);
create policy partyplus_legacy_deny_update on public.parties as restrictive for update to anon,authenticated using (false) with check (false);
create policy partyplus_legacy_deny_delete on public.parties as restrictive for delete to anon,authenticated using (false);
revoke all on public.party_items from public,anon,authenticated;
grant select on public.party_items to anon,authenticated;
revoke all ("id","party_id","name","qty","claimed_by","sort_order","created_at") on public.party_items from public,anon,authenticated;
create policy partyplus_legacy_deny_insert on public.party_items as restrictive for insert to anon,authenticated with check (false);
create policy partyplus_legacy_deny_update on public.party_items as restrictive for update to anon,authenticated using (false) with check (false);
create policy partyplus_legacy_deny_delete on public.party_items as restrictive for delete to anon,authenticated using (false);
revoke all on public.party_rsvps from public,anon,authenticated;
grant select on public.party_rsvps to anon,authenticated;
revoke all ("id","party_id","guest_name","status","created_at","name","attendee_count","updated_at") on public.party_rsvps from public,anon,authenticated;
create policy partyplus_legacy_deny_insert on public.party_rsvps as restrictive for insert to anon,authenticated with check (false);
create policy partyplus_legacy_deny_update on public.party_rsvps as restrictive for update to anon,authenticated using (false) with check (false);
create policy partyplus_legacy_deny_delete on public.party_rsvps as restrictive for delete to anon,authenticated using (false);
-- Fail closed if inherited/column privileges would bypass the intended freeze.
do $$ declare v_role text; v_table text; v_column text; begin
  foreach v_role in array array['anon','authenticated'] loop
    foreach v_table in array array['parties','party_items','party_rsvps'] loop
      if has_table_privilege(v_role,'public.'||v_table,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') then raise exception 'Unexpected inherited mutation or maintenance grant'; end if;
      for v_column in select column_name from information_schema.columns where table_schema='public' and table_name=v_table loop
        if has_column_privilege(v_role,'public.'||v_table,v_column,'INSERT,UPDATE,REFERENCES') then raise exception 'Unexpected column mutation grant'; end if;
      end loop;
      if not has_table_privilege(v_role,'public.'||v_table,'SELECT') then raise exception 'Legacy reads unexpectedly missing'; end if;
    end loop;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
