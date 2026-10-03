import fs from 'node:fs/promises';
const s=(await fs.readFile('supabase/nonproduction/10-v2-contract.sql','utf8')).replaceAll('\r\n','\n');
const table=s.match(/create table partyplus_private\.release_control[\s\S]*?alter table partyplus_private\.release_control enable row level security;/)?.[0];
const names=['partyplus_private.require_writes','public.partyplus_v2_commit_party','public.partyplus_v2_rsvp','public.partyplus_v2_claim_item','public.partyplus_v2_suggest_item','public.partyplus_v2_delete_party'];
const functions=names.map(n=>s.match(new RegExp('create function '+n.replaceAll('.','\\.')+'[\\s\\S]*?end \\$\\$;'))?.[0]);
if(!table||functions.some(f=>!f))throw Error('Expected candidate gate and mutation functions');
const sql=`-- ONLY PartyPlus Staging qmbwrbxbbshbavfhkujx. No production authorization.
begin;
${table}
revoke all on partyplus_private.release_control from public,anon,authenticated;
${functions.map(f=>f.replace('create function','create or replace function')).join('\n')}
revoke all on function partyplus_private.require_writes() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
`;
await fs.writeFile('.test-cache/staging-gate-patch.sql',sql);
console.log('Prepared staging-only release gate patch. Existing RPC grants are preserved.');
