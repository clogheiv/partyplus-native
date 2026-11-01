import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Existing resources only. This helper intentionally cannot publish a deploy.
const sites={
  staging:{id:'ef1de4c4-a3eb-4c64-939f-71392a2d24be',name:'famous-fairy-b9cb63',backend:'qmbwrbxbbshbavfhkujx.supabase.co'},
  production:{id:'f7af2b09-2f8a-44d7-bf17-b8993eb17492',name:'partyplus-invite',backend:'typbofemqhjoiwbkdvuc.supabase.co'},
};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const values=new Map();
const switches=new Set();
for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(['--environment','--site-id','--config-file'].includes(arg)){
    if(values.has(arg)||!args[i+1]||args[i+1].startsWith('--'))throw Error(`Provide one value for ${arg}.`);
    values.set(arg,args[++i]);
  }else if(['--build','--draft','--execute','--allow-production-draft','--help'].includes(arg))switches.add(arg);
  else throw Error(`Unsupported argument: ${arg}`);
}
if(switches.has('--help')){
  console.log('Usage: node scripts/deploy-web-netlify.mjs --environment staging --site-id ef1de4c4-a3eb-4c64-939f-71392a2d24be --config-file <public-config.json> [--build] --draft [--execute]');
  console.log('Without --execute: validate artifacts and inspect existing resources only. No deployment is created. Production drafts additionally require --allow-production-draft. Publishing is not supported.');
  process.exit(0);
}
const environment=values.get('--environment');
const target=sites[environment];
if(!target||values.get('--site-id')!==target.id)throw Error('Explicit environment and its allowlisted existing site ID are required.');
if(!switches.has('--draft'))throw Error('Only explicit --draft deployments are supported.');
if(environment==='production'&&!switches.has('--allow-production-draft'))throw Error('Production drafts require an additional --allow-production-draft flag. This does not authorize publication.');
if(!values.get('--config-file'))throw Error('Provide --config-file pointing to public url/publishableKey configuration.');
const publicConfig=JSON.parse(await fs.readFile(path.resolve(values.get('--config-file')),'utf8'));
if(Object.keys(publicConfig).some(k=>!['url','publishableKey'].includes(k)))throw Error('Public configuration contains unexpected fields. Supply only url and publishableKey.');
const backend=new URL(publicConfig.url);
if(backend.protocol!=='https:'||backend.hostname!==target.backend||backend.username||backend.password||backend.search||backend.hash||!['','/'].includes(backend.pathname))throw Error('Public backend URL does not match the selected environment.');
const publicKey=publicConfig.publishableKey;
if(typeof publicKey!=='string')throw Error('Missing public publishable key.');
if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey)){
  let payload;
  try{payload=JSON.parse(Buffer.from(publicKey.split('.')[1],'base64url').toString());}catch{throw Error('Only a publishable key or legacy anon JWT is permitted.');}
  if(payload.role!=='anon')throw Error('Privileged keys cannot be included in a browser artifact.');
}

if(switches.has('--build')){
  const build=spawnSync(process.execPath,[path.join(root,'scripts/build-web.mjs')],{cwd:root,env:{...process.env,PARTYPLUS_BACKEND_ENV:environment,PARTYPLUS_SUPABASE_URL:publicConfig.url,PARTYPLUS_SUPABASE_PUBLISHABLE_KEY:publicKey},stdio:'inherit'});
  if(build.status!==0)throw Error('Public browser build failed.');
}
const artifact=path.join(root,'web-dist');
const allowed=new Set(['index.html','app.js','app.css','favicon.svg','_headers','_redirects']);
const allowedFonts=new Set(['SpaceGrotesk-Variable.woff2','Fraunces-Display-Semibold.woff2','Fraunces-Display-Italic.woff2','SpaceGrotesk-OFL.txt','Fraunces-OFL.txt','SOURCES.json'].map(name=>'assets/fonts/'+name));
const allowedBrand=new Set(['partyplus-icon.png','partyplus-banner.jpg','partyplus-banner-small.jpg','favicon.png','apple-touch-icon.png','SOURCES.json'].map(name=>'assets/brand/'+name));
const files={};
const bodies=new Map();
const sha256={};
let totalBytes=0;
async function collect(relative=''){
for(const entry of await fs.readdir(path.join(artifact,relative),{withFileTypes:true})){
  const asset=relative?relative+'/'+entry.name:entry.name;
  if(entry.isDirectory()&&['assets','assets/fonts','assets/brand'].includes(asset)){await collect(asset);continue;}
  if(!entry.isFile()||(!allowed.has(asset)&&!allowedFonts.has(asset)&&!allowedBrand.has(asset)))throw Error('Artifact contains an unexpected file, directory, or link. Upload stopped.');
  const body=await fs.readFile(path.join(artifact,asset));
  if(body.length>10_000_000)throw Error('Unexpectedly large browser asset.');
  if(asset.endsWith('.woff2')&&body.subarray(0,4).toString()!=='wOF2')throw Error('Font asset is not the expected WOFF2 format.');
  if(asset.endsWith('.png')&&body.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Brand icon is not the expected PNG format.');
  if(asset.endsWith('.jpg')&&body.subarray(0,3).toString('hex')!=='ffd8ff')throw Error('Brand banner is not the expected JPEG format.');
  const source=body.toString('utf8');
  if(/sb_secret_[A-Za-z0-9_-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:NETLIFY_AUTH_TOKEN|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]/.test(source))throw Error('Artifact secret scan rejected an asset.');
  for(const jwt of source.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){
    try{if(JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString()).role==='service_role')throw Error('Privileged JWT found in public artifact.');}catch(error){if(error.message==='Privileged JWT found in public artifact.')throw error;}
  }
  const file='/'+asset;
  const hash=createHash('sha1').update(body).digest('hex');
  files[file]=hash;bodies.set(hash,{file,body});sha256[file]=createHash('sha256').update(body).digest('hex');totalBytes+=body.length;
}
}
await collect();
for(const name of allowed)if(!files['/'+name])throw Error(`Required browser artifact is missing: ${name}`);
for(const name of allowedBrand)if(!files['/'+name])throw Error('Required original brand asset is missing: '+name);
if((await fs.readFile(path.join(artifact,'app.css'),'utf8')).includes('/assets/fonts/'))for(const name of allowedFonts)if(!files['/'+name])throw Error('Required local font or license asset is missing: '+name);
if(totalBytes>25_000_000)throw Error('Unexpectedly large browser artifact.');
const app=(await fs.readFile(path.join(artifact,'app.js'))).toString('utf8');
if(!app.includes(publicConfig.url)||!app.includes(publicKey)||!app.includes(`environment:"${environment}"`))throw Error('Built public configuration does not match the selected environment. Rebuild first.');
if(environment==='staging'&&app.includes(sites.production.backend))throw Error('Staging artifact references the production backend.');

const loginPath=path.join(process.env.APPDATA||path.join(os.homedir(),'AppData/Roaming'),'netlify/Config/config.json');
const login=JSON.parse(await fs.readFile(loginPath,'utf8'));
const token=login.users?.[login.userId]?.auth?.token;
if(typeof token!=='string'||!token)throw Error('An existing local Netlify login is required.');
for(const asset of bodies.values())if(asset.body.includes(Buffer.from(token)))throw Error('The browser artifact contains a hosting credential. Upload stopped.');
async function request(endpoint,{method='GET',body,binary=false}={}){
  const response=await fetch('https://api.netlify.com/api/v1'+endpoint,{method,redirect:'error',signal:AbortSignal.timeout(30_000),headers:{Authorization:`Bearer ${token}`,'User-Agent':'PartyPlus-Web-Preview/1.0',...(body?{'Content-Type':binary?'application/octet-stream':'application/json'}:{})},body:body?(binary?body:JSON.stringify(body)):undefined});
  if(!response.ok)throw Error(`Netlify ${method} ${endpoint.split('?')[0]} returned ${response.status}. Credentials and response bodies are omitted.`);
  return response.status===204?null:response.json();
}
const before=await request('/sites/'+target.id);
if(before.id!==target.id||before.name!==target.name)throw Error('Existing site identity does not match the allowlist.');
const productionBefore=environment==='staging'?await request('/sites/'+sites.production.id):before;
const account=await request('/accounts/'+encodeURIComponent(before.account_id));
const credits=account.capabilities?.credits;
const creditsExhausted=typeof credits?.included==='number'&&typeof credits?.used==='number'&&credits.used>=credits.included;
if(creditsExhausted)throw Error('Existing included account credits are exhausted. No deploy was created.');
const record={createdAt:new Date().toISOString(),environment,draft:true,site:{id:before.id,name:before.name,url:before.ssl_url},previousPublished:{id:before.published_deploy?.id??null,url:before.published_deploy?.deploy_ssl_url??null},productionPublishedBefore:productionBefore.published_deploy?.id??null,account:{id:account.id,plan:account.type_name??account.type??'not exposed',credits:credits??'not exposed',concurrentBuilds:account.capabilities?.concurrent_builds??'not exposed'},artifact:{files:sha256,totalBytes},executed:switches.has('--execute')};
const evidenceDir=path.join(root,'.test-cache/web-deploy');
await fs.mkdir(evidenceDir,{recursive:true});
const evidencePath=path.join(evidenceDir,`${environment}-${Date.now()}.json`);
const saveEvidence=()=>fs.writeFile(evidencePath,JSON.stringify(record,null,2)+'\n');
await saveEvidence();
console.log(JSON.stringify({validated:true,environment,siteId:target.id,files:Object.keys(files).length,totalBytes,previousPublished:record.previousPublished,account:record.account,evidence:evidencePath},null,2));
if(!switches.has('--execute')){console.log('Read-only check finished. No deploy created.');process.exit(0);}

// No site creation, settings changes, plan changes, or publication endpoints exist here.
let deploy=await request(`/sites/${target.id}/deploys`,{method:'POST',body:{files,draft:true,title:`PartyPlus web ${environment} preview`}});
if(deploy.site_id!==target.id)throw Error('Unexpected draft deployment site identity. Upload stopped.');
record.deploy={id:deploy.id,state:deploy.state,url:deploy.deploy_ssl_url??null};await saveEvidence();
for(const hash of deploy.required||[]){
  const asset=bodies.get(hash);if(!asset)throw Error('Netlify requested an unknown artifact digest.');
  const encoded=asset.file.slice(1).split('/').map(encodeURIComponent).join('/');
  await request(`/deploys/${encodeURIComponent(deploy.id)}/files/${encoded}`,{method:'PUT',body:asset.body,binary:true});
}
const deadline=Date.now()+180_000;
while(deploy.state!=='ready'){
  if(['error','failed','rejected'].includes(deploy.state))throw Error(`Draft deploy stopped with state ${deploy.state}. Published deploy preserved.`);
  if(Date.now()>deadline)throw Error(`Draft deploy is still ${deploy.state}. Poll deploy ${deploy.id}; do not create a duplicate.`);
  await new Promise(resolve=>setTimeout(resolve,2000));
  deploy=await request('/deploys/'+encodeURIComponent(deploy.id));
  record.deploy={id:deploy.id,state:deploy.state,url:deploy.deploy_ssl_url??null};await saveEvidence();
}
if(deploy.site_id!==target.id)throw Error('Unexpected deploy site identity.');
const after=await request('/sites/'+target.id);
const productionAfter=environment==='staging'?await request('/sites/'+sites.production.id):after;
record.publishedUnchanged=after.published_deploy?.id===before.published_deploy?.id;
record.productionUnchanged=productionAfter.published_deploy?.id===productionBefore.published_deploy?.id;
record.completedAt=new Date().toISOString();await saveEvidence();
if(!record.publishedUnchanged||!record.productionUnchanged)throw Error('Published deployment changed during preview. Inspect saved metadata before continuing.');
console.log(JSON.stringify({ready:true,draft:true,deployId:deploy.id,url:deploy.deploy_ssl_url,publishedUnchanged:true,productionUnchanged:true,evidence:evidencePath},null,2));
