// Existing staging only. Object/bucket mutations use the Storage API elsewhere;
// this script applies/rolls back SQL contract/policy changes with preservation.
import fs from 'node:fs/promises';
import path from 'node:path';
import tls from 'node:tls';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const [mode='rehearse']=process.argv.slice(2);assert.ok(['rehearse','install','inspect'].includes(mode));
const root=path.resolve(process.env.PARTYPLUS_BACKEND_DEPENDENCIES??'.');
const pg=createRequire(path.join(root,'package.json'))('pg');
const password=process.env.PARTYPLUS_STAGING_DB_PASSWORD;delete process.env.PARTYPLUS_STAGING_DB_PASSWORD;assert.ok(password);
const ref='qmbwrbxbbshbavfhkujx';
const db=new pg.Client({host:'aws-0-us-east-1.pooler.supabase.com',port:5432,user:`postgres.${ref}`,password,database:'postgres',
  ssl:{rejectUnauthorized:true,ca:[...tls.rootCertificates,await fs.readFile(path.join(root,'.test-cache/production-ca.crt'),'utf8')]},connectionTimeoutMillis:15000});
const snapshot=async after=>{
 const result={};
 for(const table of ['public.parties','public.party_items','public.party_rsvps','partyplus_private.host_access','partyplus_private.memberships','partyplus_private.operations','auth.users','storage.objects']){
  const value=table==='public.parties'&&after?"to_jsonb(t)-'appearance'":'to_jsonb(t)';
  result[table]=(await db.query(`select count(*)::int count,md5(coalesce(string_agg(value,E'\\n' order by value),'')) fingerprint from (select (${value})::text value from ${table} t) x`)).rows[0];
 }
 return result;
};
try{
 await db.connect();assert.equal(db.connection.stream.authorized,true);
 await db.query(mode==='inspect'?'begin transaction read only':'begin isolation level serializable');
 const installed=Boolean((await db.query("select to_regprocedure('public.partyplus_web_prepare_image(text,uuid,integer,text)')::text fn")).rows[0].fn);
 const evidence={at:new Date().toISOString(),projectRef:ref,mode,productionAccessed:false,installedBefore:installed,
  gate:(await db.query('select writes_enabled from partyplus_private.release_control where singleton')).rows[0].writes_enabled,
  before:await snapshot(installed)};
 if(mode!=='inspect'){
  assert.equal(installed,false,'Already installed; reconcile rather than rerun');
  const sql=await fs.readFile('supabase/appearance/01-appearance-contract.sql','utf8');
  evidence.sqlSha256=crypto.createHash('sha256').update(sql.replace(/\r\n/g,'\n')).digest('hex');
  await db.query(sql.replace(/^begin;\r?\n/m,'').replace(/^commit;\s*$/m,''));
  evidence.after=await snapshot(true);assert.deepEqual(evidence.after,evidence.before,'Original data/receipts changed');
  assert.equal((await db.query('select writes_enabled from partyplus_private.release_control where singleton')).rows[0].writes_enabled,evidence.gate);
  assert.equal((await db.query("select count(*)::int n from pg_policies where schemaname='storage' and tablename='objects'")).rows[0].n,3);
 }
 const grants=(await db.query(`select has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') allowed
  from (values('anon'),('authenticated')) roles(r) cross join (values('public.parties'),('public.party_items'),('public.party_rsvps')) tables(t)`)).rows;
 assert.ok(grants.every(r=>!r.allowed));evidence.rawClientGrantChecksDenied=grants.length;
 if(mode==='install')await db.query('commit');else await db.query('rollback');
 evidence.committed=mode==='install';
 await fs.mkdir('docs/appearance-evidence-2026-11-01',{recursive:true});
 await fs.writeFile(`docs/appearance-evidence-2026-11-01/backend-${mode}.json`,JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify(evidence,null,2));
}catch(error){await db.query('rollback').catch(()=>{});console.error(JSON.stringify({mode,committed:false,message:error.message,code:error.code}));process.exitCode=1;}
finally{await db.end();}
