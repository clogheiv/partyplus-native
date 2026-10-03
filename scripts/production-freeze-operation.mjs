// Opt-in approved phase-1 operation only. Never installs or enables v2.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import tls from 'node:tls';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';
const mode=process.argv[2];
assert.ok(['backup','apply-approved-freeze'].includes(mode));
const root=process.cwd(), evidence=path.join(root,'docs/production-freeze-evidence-2026-10-03');
const credentialFile=path.join(root,'.test-cache/production-backup-connection.json');
const c=JSON.parse(await fs.readFile(credentialFile,'utf8'));
assert.equal(c.projectRef,'typbofemqhjoiwbkdvuc');assert.equal(c.host,'aws-1-us-east-1.pooler.supabase.com');
assert.equal(c.user,'postgres.typbofemqhjoiwbkdvuc');assert.equal(c.database,'postgres');assert.equal(c.port,5432);assert.ok(c.password);
const caPath=path.join(root,'.test-cache/production-ca.crt');
const ca=await fs.readFile(caPath,'utf8');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(ca),'700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7');
const sqlFile='supabase/production-proposal/01-freeze-legacy-writes.sql';
const freeze=await fs.readFile(sqlFile,'utf8');
const freezeSha=sha(freeze.replace(/\r\n/g,'\n'));
assert.equal(freezeSha,'b87fef62a48798d71d633a7e0d4074e29abeb884507d51ba9511d22d1796959b');
const db=new pg.Client({host:c.host,port:c.port,user:c.user,password:c.password,database:c.database,
 ssl:{rejectUnauthorized:true,ca:[...tls.rootCertificates,ca]},connectionTimeoutMillis:15000,application_name:'partyplus_approved_freeze_'+mode});
const bin=path.join(root,'.test-cache/postgresql-17.11-runtime/pgsql/bin');
const env={...process.env,PGHOST:c.host,PGPORT:String(c.port),PGUSER:c.user,PGDATABASE:c.database,PGPASSWORD:c.password,
 PGSSLMODE:'verify-full',PGSSLROOTCERT:caPath,PGCONNECT_TIMEOUT:'15',PGAPPNAME:'partyplus_approved_backup',PGOPTIONS:'-c default_transaction_read_only=on'};
function canon(x){if(Array.isArray(x))return x.map(canon).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])]));return x;}
const same=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
const save=async(name,data)=>fs.writeFile(path.join(evidence,name),JSON.stringify(data,null,2)+'\n');
async function run(exe,args,{capture=true,childEnv=env}={}) {return new Promise((resolve,reject)=>{let out='',err='';const p=spawn(exe,args,{env:childEnv,windowsHide:true,stdio:['ignore',capture?'pipe':'ignore','pipe']});p.stdout?.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',code=>code===0?resolve(out):reject(Error(path.basename(exe)+' failed: '+err.replaceAll(c.password,'[redacted]'))));});}
async function metadata({snapshot=false}={}){
 let sql=await fs.readFile(path.join(evidence,'read-only-preflight.sql'),'utf8');
 if(snapshot){sql=sql.replace('begin transaction read only;','begin isolation level repeatable read read only;').replace(/commit;\s*$/,'');}
 const results=await db.query(sql), rows=(Array.isArray(results)?results:[results]).find(r=>r.rows?.[0]?.metadata)?.rows;
 assert.ok(rows?.[0]?.metadata);const data=JSON.parse(rows[0].metadata);
 const baseline=JSON.parse(await fs.readFile('docs/staging-evidence-2026-10-02/production-metadata.json','utf8'));
 const differences=Object.keys(baseline).filter(k=>k!=='captured_at'&&!same(baseline[k],data[k]));
 assert.deepEqual(differences,[],'Material production metadata drift; stop before execution');
 assert.equal(data.operator,'postgres');assert.equal(data.read_only,'on');assert.equal(data.freeze_preflight_matches,true);return data;
}
async function counts(){const result={};for(const t of ['parties','party_items','party_rsvps'])result[t]=(await db.query(`select count(*)::text as total,max(created_at) as latest_created_at${t==='party_items'?'':',max(updated_at) as latest_updated_at'} from public.${t}`)).rows[0];return result;}
try {
 await db.connect();assert.equal(db.connection.stream.authorized,true,'Strict client TLS required');
 if(mode==='backup') {
  const start=new Date().toISOString(),dir=path.join(root,'.test-cache/production-backups',start.replace(/[:.]/g,'-'));await fs.mkdir(dir,{recursive:true});
  const protectScript=path.join(root,'.test-cache/protect-backup.ps1');
  await fs.writeFile(protectScript,`param([string]$BackupDirectory,[string]$FileName)\n$ErrorActionPreference='Stop'\nAdd-Type -AssemblyName System.Security\n$absolute=[IO.Path]::GetFullPath($BackupDirectory)\nif(-not $absolute.StartsWith([IO.Path]::GetFullPath('${root.replaceAll("'","''")}/.test-cache/production-backups/'),[StringComparison]::OrdinalIgnoreCase)){throw 'Outside backup workspace'}\nif($FileName -eq ''){\n $acl=New-Object System.Security.AccessControl.DirectorySecurity\n $acl.SetAccessRuleProtection($true,$false)\n foreach($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18','S-1-5-32-544')){\n  $identity=New-Object Security.Principal.SecurityIdentifier($sid)\n  $rule=New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')\n  $acl.AddAccessRule($rule)\n }\n [IO.Directory]::SetAccessControl($absolute,$acl)\n exit\n}\nif($FileName -notin @('production.dump','roles.sql')){throw 'Unexpected backup filename'}\n$source=Join-Path $absolute $FileName\n$target=$source+'.dpapi'\n$plain=[IO.File]::ReadAllBytes($source)\n$encrypted=[Security.Cryptography.ProtectedData]::Protect($plain,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)\n[IO.File]::WriteAllBytes($target,$encrypted)\n$decoded=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($target),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)\n$hash=[Security.Cryptography.SHA256]::Create()\n$a=[BitConverter]::ToString($hash.ComputeHash($plain));$b=[BitConverter]::ToString($hash.ComputeHash($decoded))\nif($a -ne $b){throw 'Protected backup verification failed'}\nRemove-Item -LiteralPath $source\n@{verified=$true;plainSha256=$a.Replace('-','').ToLowerInvariant();bytes=$plain.Length;encryptedBytes=$encrypted.Length}|ConvertTo-Json -Compress\n`);
  await run('powershell.exe',['-NoProfile','-File',protectScript,'-BackupDirectory',dir],{childEnv:process.env});
  const before=await metadata({snapshot:true});await save('backup-preflight.json',before);
  const snapshot=(await db.query('select pg_export_snapshot() as snapshot')).rows[0].snapshot;
  console.log('Read-only snapshot and reviewed production baseline verified. Capturing opaque backup.');
  const archive=path.join(dir,'production.dump'),roles=path.join(dir,'roles.sql');
  await run(path.join(bin,'pg_dump.exe'),['--format=custom','--no-password','--snapshot='+snapshot,'--lock-wait-timeout=5s','--file='+archive]);
  const toc=await run(path.join(bin,'pg_restore.exe'),['--list',archive]);
  const appTables=['parties','party_items','party_rsvps'];
  for(const t of [...appTables,'users']) assert.ok(toc.split('\n').some(l=>l.includes(`TABLE DATA ${t==='users'?'auth':'public'} ${t} `)),t+' backup data entry missing');
  await run(path.join(bin,'pg_restore.exe'),['--file=NUL',archive],{capture:false});
  await run(path.join(bin,'pg_dumpall.exe'),['--roles-only','--no-role-passwords','--no-password','--file='+roles]);
  await db.query('commit');
  const files={};for(const f of ['production.dump','roles.sql'])files[f]=JSON.parse(await run('powershell.exe',['-NoProfile','-File',protectScript,'-BackupDirectory',dir,'-FileName',f],{childEnv:process.env}));
  const record={status:'VERIFIED_FRESH_BACKUP',projectRef:c.projectRef,capturedAt:start,completedAt:new Date().toISOString(),snapshotConsistent:true,archiveEntries:toc.split('\n').filter(l=>l&&!l.startsWith(';')).length,
   verification:'pg_dump successful; expected app/Auth data entries present; pg_restore decoded the entire archive to NUL without executing SQL; DPAPI decrypt matches original SHA256',files,backupDirectory:dir,
   clientTlsVerified:true,caSha256:sha(ca),customerContentInspected:false,usedAsTestData:false,restoredToDatabase:false,
   custody:'Ignored local directory restricted to current Windows user, SYSTEM and Administrators. DPAPI CurrentUser encryption; preserve this Windows identity/key for recovery. Not an offsite backup.',
   limitations:'Archive integrity verified; no full hosted restoration performed. Storage binary objects/external configuration and role passwords are outside this logical database/role backup.'};
  await save('fresh-backup.json',record);await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify({status:record.status,capturedAt:start,completedAt:record.completedAt,archiveEntries:record.archiveEntries,usage:before.usage,backupDirectory:dir}));
 } else {
  const backup=JSON.parse(await fs.readFile(path.join(evidence,'fresh-backup.json'),'utf8'));
  assert.equal(backup.status,'VERIFIED_FRESH_BACKUP');assert.equal(backup.projectRef,c.projectRef);assert.ok(Date.now()-Date.parse(backup.completedAt)<30*60*1000,'Backup older than approved execution window');
  for(const f of ['production.dump','roles.sql'])assert.ok((await fs.stat(path.join(backup.backupDirectory,f+'.dpapi'))).size===backup.files[f].encryptedBytes);
  const before=await metadata();await save('execution-preflight.json',before);
  await db.query('begin transaction read only');const beforeCounts=await counts();await db.query('commit');
  await save('execution-start.json',{status:'ABOUT_TO_EXECUTE_APPROVED_FILE_01',startedAt:new Date().toISOString(),freezeSha256:freezeSha,beforeCounts,backupCapturedAt:backup.capturedAt});
  await db.query("select set_config('partyplus.security_approval','freeze-v1',false),set_config('partyplus.target_project','typbofemqhjoiwbkdvuc',false)");
  console.log('Fresh backup and baseline verified. Executing ONLY reviewed file 01.');
  await db.query(freeze);
  await save('commit-receipt.json',{status:'FILE_01_COMMITTED',committedAt:new Date().toISOString(),freezeSha256:freezeSha});
  await db.query("reset partyplus.security_approval;reset partyplus.target_project;");
  await db.query('begin transaction read only');
  let exportSql=await fs.readFile('supabase/production-metadata-export.sql','utf8');exportSql=exportSql.replace('begin transaction read only;','').replace(/commit;\s*$/,'');
  const post=JSON.parse((await db.query(exportSql)).rows[0].metadata),afterCounts=await counts();await save('production-post-freeze.json',post);
  const dataCountsUnchanged=same(beforeCounts,afterCounts);assert.ok(dataCountsUnchanged,'Data counts/timestamps changed across execution; investigate');
  const preserved=['tables','columns','indexes','schemas','version','database','triggers','functions','constraints','publications','default_grants','migration_ledger','publication_tables'];
  const unchanged=Object.fromEntries(preserved.map(k=>[k,k==='tables'?same(before.tables.map(({acl,...v})=>v),post.tables.map(({acl,...v})=>v)):same(before[k],post[k])]));
  assert.ok(Object.values(unchanged).every(Boolean),'Unexpected metadata change');
  assert.equal(post.policies.length,12);assert.equal(post.policies.filter(p=>p.cmd==='SELECT'&&p.qual==='true').length,3);
  assert.equal(post.policies.filter(p=>p.permissive==='RESTRICTIVE'&&p.policyname.startsWith('partyplus_legacy_deny_')).length,9);
  const checks=[];
  for(const role of ['anon','authenticated']) {
   for(const table of ['parties','party_items','party_rsvps']){
    const priv=(await db.query("select has_table_privilege($1,$2,'SELECT') as reads,has_table_privilege($1,$2,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') as unsafe",[role,'public.'+table])).rows[0];assert.equal(priv.reads,true);assert.equal(priv.unsafe,false);
    await db.query('savepoint rolecheck');await db.query('set local role '+role);
    const visible=(await db.query('select count(*)::text as total from public.'+table)).rows[0].total;assert.equal(visible,afterCounts[table].total);await db.query('rollback to savepoint rolecheck');
    for(const [op,statement] of [['INSERT',`insert into public.${table} default values`],['UPDATE',`update public.${table} set id=id where false`],['DELETE',`delete from public.${table} where false`]]) {
     await db.query('savepoint accesscheck');await db.query('set local role '+role);let denied=false;
     try{await db.query('explain '+statement);}catch(e){assert.equal(e.code,'42501');denied=true;}finally{await db.query('rollback to savepoint accesscheck');}
     assert.ok(denied,'Unexpected access for '+role+' '+table+' '+op);checks.push({role,table,operation:op,result:'42501_PERMISSION_DENIED',probe:'EXPLAIN only; no DML executed'});
    }
   }
  }
  await db.query('commit');
  const record={status:'APPROVED_LEGACY_WRITE_FREEZE_VERIFIED',verifiedAt:new Date().toISOString(),projectRef:c.projectRef,freezeSha256:freezeSha,backupCapturedAt:backup.capturedAt,beforeCounts,afterCounts,dataCountsUnchanged,
   unchangedMetadata:unchanged,retainedSelectPolicies:3,restrictiveWriteDenies:9,removedUnsafeWritePolicies:8,permissionChecks:checks,roleReadCountsMatched:true,otherProductionMigrationsApplied:false,
   rollback:'Pre-commit transactional rollback; post-commit retain safe read-only freeze. No unsafe unfreeze is authorized. File04 v2 gate is absent and inapplicable.',
   compatibilityDeadline:new Date(Date.now()+7*24*60*60*1000).toISOString(),deadlineMeaning:'Review/upgrade deadline; NO automatic restoration of unsafe write permissions',customerContentInspected:false};
  await save('execution-verification.json',record);console.log(JSON.stringify(record));
  c.password='';await fs.writeFile(credentialFile,JSON.stringify(c,null,2)+'\n');
 }
} catch(e) {try{await db.query('rollback');}catch{}console.error({status:'STOPPED',code:e.code,message:String(e.message).replaceAll(c.password,'[redacted]')});process.exitCode=1;}
finally {await db.end();}
