// Bounded read-only check of the expressly disposable UI deletion fixture.
import fs from 'node:fs/promises';
import path from 'node:path';
import tls from 'node:tls';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=path.resolve(process.env.PARTYPLUS_BACKEND_DEPENDENCIES??'.');
const password=process.env.PARTYPLUS_STAGING_DB_PASSWORD;delete process.env.PARTYPLUS_STAGING_DB_PASSWORD;assert.ok(password);
const pg=createRequire(path.join(root,'package.json'))('pg');
const db=new pg.Client({host:'aws-0-us-east-1.pooler.supabase.com',port:5432,user:'postgres.qmbwrbxbbshbavfhkujx',password,database:'postgres',ssl:{rejectUnauthorized:true,ca:[...tls.rootCertificates,await fs.readFile(path.join(root,'.test-cache/production-ca.crt'),'utf8')]},connectionTimeoutMillis:15000});
const id='f8a4bad6-e418-4ed2-8ac3-6a0d536d9d07';
try{
 await db.connect();assert.equal(db.connection.stream.authorized,true);await db.query('begin transaction read only');
 const state=(await db.query('select deleted_at is not null tombstoned,public.partyplus_web_read_party(id) is null web_read_null,public.partyplus_v2_read_party(id) is null v2_read_null from public.parties where id=$1',[id])).rows[0];
 const receipts=(await db.query("select (select jsonb_agg(k order by k) from jsonb_object_keys(receipt) k) receipt_keys,receipt->'deleted'=to_jsonb(true) deleted_true,receipt ? 'committed' committed_key_present,receipt->>'operationId'=operation_id::text operation_id_matches_record from partyplus_private.operations where request->>'kind'='delete' and request->>'party'=$1",[id])).rows;
 await db.query('rollback');
 const result={at:new Date().toISOString(),projectRef:'qmbwrbxbbshbavfhkujx',productionAccessed:false,readOnly:true,fixture:id,state,deleteReceiptCount:receipts.length,receipts};
 await fs.writeFile('docs/staging-delete-acknowledgement-2026-11-01.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await db.end();}
