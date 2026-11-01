// Bounded existing-staging Storage metadata check. No object paths or bytes.
import fs from 'node:fs/promises';
import path from 'node:path';
import tls from 'node:tls';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=path.resolve(process.env.PARTYPLUS_BACKEND_DEPENDENCIES??'.');
const pg=createRequire(path.join(root,'package.json'))('pg');
const ref='qmbwrbxbbshbavfhkujx',password=process.env.PARTYPLUS_STAGING_DB_PASSWORD;
delete process.env.PARTYPLUS_STAGING_DB_PASSWORD;assert.ok(password);
const db=new pg.Client({host:'aws-0-us-east-1.pooler.supabase.com',port:5432,user:`postgres.${ref}`,
  password,database:'postgres',ssl:{rejectUnauthorized:true,ca:[...tls.rootCertificates,await fs.readFile(path.join(root,'.test-cache/production-ca.crt'),'utf8')]},connectionTimeoutMillis:15000});
try{
  await db.connect();assert.equal(db.connection.stream.authorized,true);
  await db.query('begin transaction read only');
  const summary=(await db.query(`select
    (select count(*)::int from storage.buckets) as buckets,
    (select count(*)::int from storage.objects) as objects,
    (select coalesce(sum((metadata->>'size')::bigint),0)::text from storage.objects) as recorded_bytes,
    to_regprocedure('storage.allow_only_operation(text)') is not null as operation_helper,
    to_regprocedure('storage.allow_any_operation(text[])') is not null as operations_helper,
    (select count(*)::int from pg_policies where schemaname='storage' and tablename='objects') as object_policies`)).rows[0];
  const functions=(await db.query(`select p.proname,pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='storage' and p.proname in ('allow_only_operation','allow_any_operation','operation')`)).rows;
  await db.query('rollback');
  console.log(JSON.stringify({at:new Date().toISOString(),projectRef:ref,readOnly:true,objectPathsOrContentsRead:false,summary,functions},null,2));
}finally{await db.end();}
