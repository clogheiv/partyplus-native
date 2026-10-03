import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const c=JSON.parse(await fs.readFile('.test-cache/staging-credentials.json','utf8'));
assert.equal(c.url,'https://qmbwrbxbbshbavfhkujx.supabase.co');
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(c.url,c.secretKey,opts),host=createClient(c.url,c.publishableKey,opts);
const email='synthetic-preview-'+randomUUID()+'@example.test',password=randomBytes(32).toString('base64url');
const ok=async task=>{const r=await task;if(r.error)throw Error(r.error.message);return r.data;};
await ok(admin.auth.admin.createUser({email,password,email_confirm:true}));
await ok(host.auth.signInWithPassword({email,password}));
const partyId='synthetic-browser-'+randomUUID();
await ok(host.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:0,p_party:{id:partyId,title:'PartyPlus Staging Browser Test',date:'2027-01-01T18:00:00Z',location:'Synthetic Hall',items:[{id:randomUUID(),name:'Ice'}]}}));
await fs.writeFile('.test-cache/staging-preview-host.json',JSON.stringify({email,password,partyId}));
await fs.writeFile('docs/staging-evidence-2026-10-02/browser-party.json',JSON.stringify({projectRef:'qmbwrbxbbshbavfhkujx',partyId},null,2)+'\n');
const built=spawnSync(process.execPath,['scripts/build-invite.mjs'],{stdio:'inherit',env:{...process.env,PARTYPLUS_BACKEND_ENV:'staging',PARTYPLUS_SUPABASE_URL:c.url,PARTYPLUS_SUPABASE_PUBLISHABLE_KEY:c.publishableKey,PARTYPLUS_NATIVE_SCHEME:'partyplusnative-dev'}});
assert.equal(built.status,0);
const root=path.resolve('.test-cache/invite-site');
const server=http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const file=path.resolve(root,pathname.startsWith('/i/')?'index.html':'.'+pathname);
    if(!file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
    const data=await fs.readFile(file);const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg'}[path.extname(file)]??'application/octet-stream';
    res.writeHead(200,{'Content-Type':type});res.end(data);
  } catch {res.writeHead(404);res.end();}
});
server.listen(8090,'127.0.0.1',()=>console.log('Staging invitation preview: http://127.0.0.1:8090/i/'+partyId));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
