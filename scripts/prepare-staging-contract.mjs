// Builds a metadata-only legacy clone plus the candidate contract; never executes SQL remotely.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const metadataPath='docs/staging-evidence-2026-10-02/production-metadata.json';
const raw=(await fs.readFile(metadataPath,'utf8')).replaceAll('\r\n','\n');
const metadata=JSON.parse(raw);
if(metadata.read_only!=='on') throw Error('Expected metadata from a read-only transaction');
const quote=value=>'"'+value.replaceAll('"','""')+'"';
const tables=['parties','party_items','party_rsvps'];
if(JSON.stringify(metadata.tables.map(t=>t.relname))!==JSON.stringify(tables)) throw Error('Unexpected observed table set; reconcile manually');
let sql=`-- Metadata-only clone. No production records. Source SHA256: ${createHash('sha256').update(raw).digest('hex')}\n`;
sql+=`do $$ begin
  if coalesce(current_setting('partyplus.environment',true),'') not in ('synthetic','staging','local')
     or to_regclass('public.parties') is not null or to_regclass('public.party_items') is not null
     or to_regclass('public.party_rsvps') is not null then
    raise exception 'Explicit nonproduction and blank application schema required';
  end if;
end $$;\n`;
for(const table of tables){
  const columns=metadata.columns.filter(c=>c.table_schema==='public'&&c.table_name===table);
  sql+=`create table public.${quote(table)} (\n`+columns.map(c=>
    `  ${quote(c.column_name)} ${c.data_type}${c.column_default?' default '+c.column_default:''}${c.is_nullable==='NO'?' not null':''}`
  ).join(',\n')+'\n);\n';
}
for(const constraint of metadata.constraints) sql+=`alter table public.${quote(constraint.table_name)} add constraint ${quote(constraint.conname)} ${constraint.definition};\n`;
for(const index of metadata.indexes.filter(i=>!metadata.constraints.some(c=>c.conname===i.indexname))) sql+=index.indexdef+';\n';
for(const fn of metadata.functions) sql+=fn.definition+';\n';
for(const trigger of metadata.triggers) sql+=trigger.definition+';\n';
for(const table of tables) sql+=`alter table public.${quote(table)} enable row level security;\ngrant all on public.${quote(table)} to anon,authenticated;\n`;
for(const policy of metadata.policies) sql+=`create policy ${quote(policy.policyname)} on public.${quote(policy.tablename)} as ${policy.permissive} for ${policy.cmd} to ${policy.roles.map(quote).join(',')}${policy.qual?' using ('+policy.qual+')':''}${policy.with_check?' with check ('+policy.with_check+')':''};\n`;
await fs.writeFile('supabase/nonproduction/observed-legacy-schema.sql',sql);
await fs.mkdir('.test-cache',{recursive:true});
const reconcile=await fs.readFile('supabase/nonproduction/05-reconcile-observed-schema.sql','utf8');
const contract=await fs.readFile('supabase/nonproduction/10-v2-contract.sql','utf8');
await fs.writeFile('.test-cache/staging-install.sql',`-- ISOLATED STAGING ONLY. Confirm the dashboard project is PartyPlus Staging.\nbegin;\nselect set_config('partyplus.environment','staging',true);\n${sql}\n${reconcile}\n${contract}\ncommit;\n`);
const commitFunction=contract.match(/create function public\.partyplus_v2_commit_party[\s\S]*?end \$\$;/)?.[0];
if(!commitFunction)throw Error('Commit function was not found');
await fs.writeFile('.test-cache/staging-revision-patch.sql',`-- ONLY PartyPlus Staging qmbwrbxbbshbavfhkujx. No production authorization.\nbegin;\n${commitFunction.replace('create function','create or replace function')}\ncommit;\n`);
console.log('Prepared metadata-only legacy clone and atomic staging installation; no remote writes performed.');
