import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import pg from 'pg';
const source=new URL(process.env.PARTYPLUS_TEST_DATABASE_URL);
assert.equal(source.hostname,'127.0.0.1');assert.equal(source.pathname,'/partyplus_synthetic');
const restored=new URL(source);restored.pathname='/partyplus_restore';
const a=new pg.Client({connectionString:source.href}),b=new pg.Client({connectionString:restored.href});
try {
  await a.connect();await b.connect();
  for(const relation of ['public.parties','public.party_items','public.party_rsvps','partyplus_private.host_access','partyplus_private.operations','partyplus_private.release_control','auth.users']) {
    const query=`select to_jsonb(t) as row from ${relation} t order by to_jsonb(t)::text`;
    assert.deepEqual((await b.query(query)).rows,(await a.query(query)).rows,relation+' restores exactly');
  }
  const grants="select table_schema,table_name,grantee,privilege_type from information_schema.table_privileges where table_schema in ('public','partyplus_private') order by 1,2,3,4";
  assert.deepEqual((await b.query(grants)).rows,(await a.query(grants)).rows);
  const policies="select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','partyplus_private') order by 1,2,3";
  assert.deepEqual((await b.query(policies)).rows,(await a.query(policies)).rows);
  // pg_restore may encode owner-only ACL as NULL (the identical default ACL).
  const protections="select n.nspname,c.relname,c.relrowsecurity,coalesce(c.relacl,acldefault('r',c.relowner))::text as acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','partyplus_private') and c.relkind='r' order by 1,2";
  assert.deepEqual((await b.query(protections)).rows,(await a.query(protections)).rows);
  const functions="select n.nspname,p.proname,pg_get_functiondef(p.oid),p.prosecdef,p.proconfig,coalesce(p.proacl,acldefault('f',p.proowner))::text as acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','partyplus_private') order by 1,2";
  assert.deepEqual((await b.query(functions)).rows,(await a.query(functions)).rows);
  await b.query('begin');await b.query('set local role anon');
  await assert.rejects(b.query('delete from public.parties'),{code:'42501'});await b.query('rollback');
  const op=(await b.query("select * from partyplus_private.operations where request->>'kind'='rsvp' limit 1")).rows[0];assert.ok(op);
  await b.query('begin');await b.query("select set_config('request.jwt.claim.sub',$1,true)",[op.principal_id]);await b.query('set local role authenticated');
  const replay=(await b.query('select public.partyplus_v2_rsvp($1,$2,$3) as receipt',[op.request.party,op.operation_id,op.request.response])).rows[0].receipt;
  assert.deepEqual(replay,op.receipt);await b.query('commit');
  const host=(await b.query('select * from partyplus_private.host_access limit 1')).rows[0];assert.ok(host);
  await b.query('begin');await b.query("select set_config('request.jwt.claim.sub',$1,true)",[host.principal_id]);await b.query('set local role authenticated');
  const list=(await b.query('select public.partyplus_v2_list_host_parties() as parties')).rows[0].parties;
  assert.ok(list.some(p=>p.id===host.party_id&&p.canEdit));await b.query('commit');
  const evidence={status:'passed',engine:'PostgreSQL 17.11 pg_dump custom archive / pg_restore',scope:'Metadata-matched synthetic database into separate blank loopback database, same cluster roles',checks:['Exact rows, IDs, legacy fields, guest state, host evidence and operation receipts','Table/function grants, RLS flags/policies and function definitions restored','Anonymous deletion denied after restore','Prior RSVP operation receipt replays exactly','Verified bridged host can list restored legacy party'],capturedAt:new Date().toISOString()};
  await fs.writeFile('docs/staging-evidence-2026-10-02/postgresql-restore.json',JSON.stringify(evidence,null,2)+'\n');
  console.log('PASS PostgreSQL pg_dump/pg_restore preserves data, grants, RLS, host evidence and replayable receipts');
} finally {await a.end();await b.end();}
