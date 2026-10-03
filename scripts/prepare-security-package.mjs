// Review artifacts only. No network calls; never executes production SQL.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='supabase/production-proposal';
await fs.mkdir(root,{recursive:true});
const read=path=>fs.readFile(path,'utf8').then(s=>s.replaceAll('\r\n','\n'));
const raw=await read('docs/staging-evidence-2026-10-02/production-metadata.json');
const m=JSON.parse(raw),sha=s=>createHash('sha256').update(s).digest('hex');
const literal=s=>"'"+s.replaceAll("'","''")+"'";
const identifier=s=>'"'+s.replaceAll('"','""')+'"';
const tables=['parties','party_items','party_rsvps'];
const guard=phase=>`-- REVIEW ONLY. Separate Michael production approval is required. No deployment automation.
-- Baseline metadata SHA256 ${sha(raw)}
-- Before execution, operator must set SESSION partyplus.security_approval='${phase}'
-- and partyplus.target_project='typbofemqhjoiwbkdvuc' on the confirmed live connection.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
  if current_setting('partyplus.security_approval',true) is distinct from '${phase}'
     or coalesce(current_setting('partyplus.target_project',true),'') not in ('typbofemqhjoiwbkdvuc','qmbwrbxbbshbavfhkujx','synthetic') then
    raise exception 'Separate reviewed security approval and confirmed target required';
  end if;
  if current_setting('partyplus.target_project',true)='typbofemqhjoiwbkdvuc' and current_user <> 'postgres' then
    raise exception 'Reviewed production owner connection required';
  end if;
end $$;
`;
const policyProjection=p=>({tablename:p.tablename,policyname:p.policyname,cmd:p.cmd,qual:p.qual,with_check:p.with_check,roles:p.roles});
const baselinePolicies=m.policies.map(policyProjection);
const columns=m.columns.filter(c=>c.table_schema==='public').map(c=>({table_name:c.table_name,column_name:c.column_name,data_type:c.data_type,is_nullable:c.is_nullable,column_default:c.column_default}));
const baselineCheck=`do $$ declare v_actual jsonb; begin
  select jsonb_agg(jsonb_build_object('table_name',table_name,'column_name',column_name,'data_type',data_type,'is_nullable',is_nullable,'column_default',column_default) order by table_name,column_name)
    into v_actual from information_schema.columns where table_schema='public' and table_name in ('parties','party_items','party_rsvps');
  if v_actual is distinct from (select jsonb_agg(value order by value->>'table_name',value->>'column_name') from jsonb_array_elements(${literal(JSON.stringify(columns))}::jsonb)) then
    raise exception 'Baseline column drift: refresh metadata and reconcile';
  end if;
  select jsonb_agg(jsonb_build_object('tablename',tablename,'policyname',policyname,'cmd',cmd,'qual',qual,'with_check',with_check,'roles',roles) order by tablename,policyname)
    into v_actual from pg_policies where schemaname='public' and tablename in ('parties','party_items','party_rsvps');
  if v_actual is distinct from ${literal(JSON.stringify(baselinePolicies))}::jsonb then
    raise exception 'Baseline policy drift: refresh metadata and reconcile';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('parties','party_items','party_rsvps') and (not c.relrowsecurity or pg_get_userbyid(c.relowner)<>current_user)) then
    raise exception 'Unexpected RLS or table owner';
  end if;
  if to_regnamespace('partyplus_private') is not null then raise exception 'Existing contract: reconcile instead of reinstalling'; end if;
end $$;
`;
const structuralCheck=baselineCheck.slice(0,baselineCheck.indexOf("  select jsonb_agg(jsonb_build_object('tablename'"))+`end $$;\n`+`do $$ declare v_actual jsonb; begin
  select jsonb_agg(jsonb_build_object('table_name',c.conrelid::regclass::text,'conname',c.conname,'contype',c.contype,'definition',pg_get_constraintdef(c.oid)) order by c.conrelid::regclass::text,c.conname)
    into v_actual from pg_constraint c where c.connamespace='public'::regnamespace and c.contype<>'n';
  if v_actual is distinct from (select jsonb_agg(value order by value->>'table_name',value->>'conname') from jsonb_array_elements(${literal(JSON.stringify(m.constraints))}::jsonb)) then
    raise exception 'Baseline constraint drift: refresh metadata and reconcile';
  end if;
end $$;
`;
let freeze=guard('freeze-v1')+baselineCheck;
freeze+=structuralCheck;
freeze+='lock table public.parties,public.party_items,public.party_rsvps in access exclusive mode;\n';
for(const p of m.policies.filter(p=>p.cmd!=='SELECT')) freeze+=`drop policy ${identifier(p.policyname)} on public.${identifier(p.tablename)};\n`;
for(const table of tables){
  freeze+=`revoke all on public.${table} from public,anon,authenticated;\ngrant select on public.${table} to anon,authenticated;\n`;
  freeze+=`revoke all (${columns.filter(c=>c.table_name===table).map(c=>identifier(c.column_name)).join(',')}) on public.${table} from public,anon,authenticated;\n`;
  for(const cmd of ['insert','update','delete']) freeze+=`create policy partyplus_legacy_deny_${cmd} on public.${table} as restrictive for ${cmd} to anon,authenticated ${cmd==='insert'?'with check (false)':cmd==='update'?'using (false) with check (false)':'using (false)'};\n`;
}
freeze+=`-- Fail closed if inherited/column privileges would bypass the intended freeze.
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
`;
await fs.writeFile(root+'/01-freeze-legacy-writes.sql',freeze);
const stripGuard=s=>s.replace(/^[\s\S]*?end \$\$;\n/,'');
let reconcile=stripGuard(await read('supabase/nonproduction/05-reconcile-observed-schema.sql'));
let contract=stripGuard(await read('supabase/nonproduction/10-v2-contract.sql'));
contract=contract.replace('values(true,true);','values(true,false);');
const hardDefaults=`-- Only future objects owned by this migration role are changed; existing unrelated grants stay intact.
alter default privileges in schema public revoke all on tables from public,anon,authenticated;
alter default privileges in schema public revoke all on sequences from public,anon,authenticated;
-- PUBLIC function EXECUTE is a global default: a per-schema revoke cannot remove it.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon,authenticated;
alter default privileges in schema partyplus_private revoke all on tables from public,anon,authenticated;
alter default privileges in schema partyplus_private revoke execute on functions from anon,authenticated;
alter function public.set_updated_at() set search_path=pg_catalog;
revoke all on function public.set_updated_at() from public,anon,authenticated;
`;
const cutoverCheck=`do $$ begin
  if (select count(*) from pg_policies where schemaname='public' and tablename in ('parties','party_items','party_rsvps') and cmd='SELECT' and qual='true') <> 3
    or (select count(*) from pg_policies where schemaname='public' and tablename in ('parties','party_items','party_rsvps') and policyname like 'partyplus_legacy_deny_%' and permissive='RESTRICTIVE') <> 9 then
    raise exception 'Expected approved read-only legacy freeze';
  end if;
  if to_regnamespace('partyplus_private') is not null then raise exception 'Existing contract: reconcile instead of reinstalling'; end if;
end $$;
`;
const cutover=guard('cutover-v2')+structuralCheck+cutoverCheck+'lock table public.parties,public.party_items,public.party_rsvps in access exclusive mode;\n'+reconcile+contract+hardDefaults+"notify pgrst,'reload schema';\ncommit;\n";
await fs.writeFile(root+'/02-install-verified-contract.sql',cutover);
const gate=(phase,enabled)=>guard(phase)+`update partyplus_private.release_control set writes_enabled=${enabled},updated_at=now() where singleton;
do $$ begin if not exists(select 1 from partyplus_private.release_control where singleton and writes_enabled=${enabled}) then raise exception 'Release control missing'; end if; end $$;
commit;
`;
await fs.writeFile(root+'/03-enable-verified-writes.sql',gate('enable-v2',true));
await fs.writeFile(root+'/04-safe-rollback-pause.sql',gate('pause-v2',false));
const files={};for(const name of ['01-freeze-legacy-writes.sql','02-install-verified-contract.sql','03-enable-verified-writes.sql','04-safe-rollback-pause.sql']) files[name]=sha(await read(root+'/'+name));
await fs.writeFile(root+'/manifest.json',JSON.stringify({status:'review-only-not-production-authorized',hashEncoding:'UTF-8 with CRLF normalized to LF',baselineMetadataSha256:sha(raw),files},null,2)+'\n');
console.log('Prepared four guarded review-only SQL files and checksum manifest. No remote actions.');
