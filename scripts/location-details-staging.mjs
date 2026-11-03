import fs from 'node:fs/promises';
import path from 'node:path';
import tls from 'node:tls';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {snapshots,access,sha} from './prepare-location-details-production.mjs';
const mode=process.argv[2]??'rehearse';assert.ok(['rehearse','install','reconcile-null-echo'].includes(mode));
const root=path.resolve(process.env.PARTYPLUS_BACKEND_DEPENDENCIES??'.');
const password=process.env.PARTYPLUS_STAGING_DB_PASSWORD;delete process.env.PARTYPLUS_STAGING_DB_PASSWORD;assert.ok(password);
const pg=createRequire(path.join(root,'package.json'))('pg');
const db=new pg.Client({host:'aws-0-us-east-1.pooler.supabase.com',port:5432,user:'postgres.qmbwrbxbbshbavfhkujx',password,database:'postgres',ssl:{rejectUnauthorized:true,ca:[...tls.rootCertificates,await fs.readFile(path.join(root,'.test-cache/production-ca.crt'),'utf8')]},connectionTimeoutMillis:15000});
try{
 await db.connect();assert.equal(db.connection.stream.authorized,true);await db.query('begin isolation level repeatable read');await db.query('lock table public.parties in access exclusive mode');
 const before=(await db.query(`select ${snapshots(false)} snapshot,${access} access`)).rows[0];
 const source=await fs.readFile('supabase/location-details/01-location-details.sql','utf8');
 if(mode==='reconcile-null-echo'){
  assert.ok((await db.query("select to_regprocedure('partyplus_private.commit_party_before_location_details(uuid,bigint,jsonb)') is not null installed")).rows[0].installed);
  const wrapper=source.match(/create function public\.partyplus_v2_commit_party[\s\S]+?end \$\$;/)[0].replace('create function','create or replace function');
  await db.query(wrapper);
 }else await db.query(source.replace(/^begin;\r?\n/m,'').replace(/^commit;\s*$/m,''));
 const after=(await db.query(`select ${snapshots(mode!=='reconcile-null-echo')} snapshot,${access} access`)).rows[0];assert.deepEqual(after,before);
 await db.query(mode==='rehearse'?'rollback':'commit');
 const result={at:new Date().toISOString(),projectRef:'qmbwrbxbbshbavfhkujx',mode,committed:mode!=='rehearse',productionAccessed:false,sourceSha256:sha(source),allEightOriginalFingerprintsPreserved:true,allExistingRpcAccessRawGrantsAndGateUnchanged:true,before:before.snapshot,after:after.snapshot};
 await fs.writeFile(`docs/location-details-staging-${mode}-2026-11-02.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}catch(e){await db.query('rollback').catch(()=>{});throw e;}finally{await db.end();}
