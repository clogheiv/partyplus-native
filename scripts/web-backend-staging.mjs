// Staging-only administration. Credentials arrive in process environment from
// the existing Windows DPAPI vault; neither credential nor row content is output.
import fs from 'node:fs/promises';
import path from 'node:path';
import tls from 'node:tls';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const [mode='inspect']=process.argv.slice(2);
assert.ok(['inspect','rehearse','install','patch-address'].includes(mode));
const dependencyRoot=path.resolve(process.env.PARTYPLUS_BACKEND_DEPENDENCIES??'.');
const pg=createRequire(path.join(dependencyRoot,'package.json'))('pg');
const ref='qmbwrbxbbshbavfhkujx';
const password=process.env.PARTYPLUS_STAGING_DB_PASSWORD;
delete process.env.PARTYPLUS_STAGING_DB_PASSWORD;
assert.ok(password,'Existing staging database credential required in process environment');
const ca=await fs.readFile(path.join(dependencyRoot,'.test-cache/production-ca.crt'),'utf8');
assert.equal(crypto.createHash('sha256').update(ca).digest('hex'),'700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7');
const db=new pg.Client({host:'aws-0-us-east-1.pooler.supabase.com',port:5432,
  user:`postgres.${ref}`,password,database:'postgres',
  ssl:{rejectUnauthorized:true,ca:[...tls.rootCertificates,ca]},
  connectionTimeoutMillis:15000,application_name:'partyplus_web_staging_'+mode});
const evidence={at:new Date().toISOString(),projectRef:ref,mode,productionAccessed:false};
async function snapshot(){
  const result={};
  for(const table of ['public.parties','public.party_items','public.party_rsvps',
    'partyplus_private.host_access','partyplus_private.operations','auth.users']){
    assert.match(table,/^[a-z_]+\.[a-z_]+$/);
    const row=(await db.query(`select count(*)::int as count,md5(coalesce(string_agg(value,E'\\n' order by value),'')) as fingerprint from (select to_jsonb(t)::text as value from ${table} t) s`)).rows[0];
    result[table]=row;
  }
  return result;
}
try{
  await db.connect();assert.equal(db.connection.stream.authorized,true);
  await db.query(mode==='inspect'?'begin isolation level repeatable read read only':'begin isolation level serializable');
  evidence.before=await snapshot();
  evidence.writesEnabled=(await db.query('select writes_enabled from partyplus_private.release_control where singleton')).rows[0]?.writes_enabled;
  evidence.browserContractInstalled=Boolean((await db.query("select to_regprocedure('public.partyplus_web_list_my_parties()')::text as fn")).rows[0].fn);
  if(mode!=='inspect'){
    assert.equal(evidence.browserContractInstalled,mode==='patch-address','Unexpected installed state; inspect and reconcile, never blindly reinstall');
    const sql=await fs.readFile('supabase/web-rebuild/'+(mode==='patch-address'?'02-invitation-address.sql':'01-browser-contract.sql'),'utf8');
    evidence.migrationSha256=crypto.createHash('sha256').update(sql.replace(/\r\n/g,'\n')).digest('hex');
    await db.query(sql.replace(/^begin;\r?\n/m,'').replace(/^commit;\s*$/m,''));
    evidence.after=await snapshot();assert.deepEqual(evidence.after,evidence.before,'Existing synthetic data changed unexpectedly');
    assert.equal((await db.query('select writes_enabled from partyplus_private.release_control where singleton')).rows[0]?.writes_enabled,evidence.writesEnabled);
    evidence.browserContractInstalled=true;
  }
  const privileges=(await db.query(`select role,tablename,
    has_table_privilege(role,tablename,'SELECT') as read,
    has_table_privilege(role,tablename,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as mutation
    from (values('anon'),('authenticated')) roles(role)
    cross join (values('public.parties'),('public.party_items'),('public.party_rsvps')) tables(tablename)`)).rows;
  assert.ok(privileges.every(x=>!x.read&&!x.mutation),'Legacy raw access must stay revoked');
  evidence.rawClientGrantsDenied=privileges.length;
  if(mode==='inspect'){
    let fixture;
    try{fixture=JSON.parse(await fs.readFile('.test-cache/web-browser-fixture.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    if(fixture?.partyId)evidence.browserFixture=(await db.query(`select
      exists(select 1 from public.parties where id=$1) as party_found,
      (select count(*)::int from public.party_rsvps where party_id=$1) as responses,
      (select coalesce(sum(attendee_count),0)::int from public.party_rsvps where party_id=$1 and status='yes') as attending,
      (select count(*)::int from public.party_items where party_id=$1) as items,
      (select count(*)::int from public.party_items where party_id=$1 and claimed_by_user_id is not null) as claims,
      not exists(select 1 from public.party_rsvps r where r.party_id=$1 and not exists(
        select 1 from partyplus_private.memberships m where m.party_id=r.party_id and m.principal_id::text=r.id::text)) as response_memberships_present,
      not exists(select 1 from public.party_rsvps r join partyplus_private.host_access h
        on h.party_id=r.party_id and h.principal_id::text=r.id::text where r.party_id=$1) as guests_have_no_host_grants`,[fixture.partyId])).rows[0];
  }
  if(['install','patch-address'].includes(mode))await db.query('commit');else await db.query('rollback');
  evidence.committed=['install','patch-address'].includes(mode);
  console.log(JSON.stringify(evidence,null,2));
}catch(error){
  await db.query('rollback').catch(()=>{});
  console.error(JSON.stringify({projectRef:ref,mode,committed:false,code:error.code,message:error.message}));
  process.exitCode=1;
}finally{await db.end();}
