// Loopback-only staging invitation site. No hosting deployment or email messages.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const c=JSON.parse(await fs.readFile('.test-cache/staging-credentials.json','utf8'));
assert.equal(c.url,'https://qmbwrbxbbshbavfhkujx.supabase.co');
const result=spawnSync(process.execPath,['scripts/build-invite.mjs'],{stdio:'inherit',windowsHide:true,env:{...process.env,PARTYPLUS_BACKEND_ENV:'staging',PARTYPLUS_SUPABASE_URL:c.url,PARTYPLUS_SUPABASE_PUBLISHABLE_KEY:c.publishableKey,PARTYPLUS_NATIVE_SCHEME:'partyplusnative-preview'}});
assert.equal(result.status,0);const root=path.resolve('.test-cache/invite-site');
const server=http.createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
 const file=path.resolve(root,pathname.startsWith('/i/')||pathname==='/'?'index.html':'.'+pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 const bytes=await fs.readFile(file);const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg'};
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'});res.end(bytes);
}catch{res.writeHead(404);res.end();}});
server.listen(8090,'127.0.0.1',()=>console.log('Isolated staging invitations served only at http://127.0.0.1:8090'));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
