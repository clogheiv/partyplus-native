// Browser QA only. Ephemeral synthetic principals and fixed codes are never
// production authentication. This process binds loopback and ships no artifact.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {backendHarness,users} from '../tests/backend-harness.mjs';
if(process.env.PARTYPLUS_TEST_DATABASE_URL)throw Error('Synthetic browser server requires an ephemeral database.');
Object.assign(process.env,{PARTYPLUS_BACKEND_ENV:'local',PARTYPLUS_SUPABASE_URL:'http://127.0.0.1:8091',PARTYPLUS_SUPABASE_PUBLISHABLE_KEY:'synthetic-placeholder'});
await import('./build-web.mjs');
const h=await backendHarness();
await h.db.exec(await fs.readFile('supabase/web-rebuild/01-browser-contract.sql','utf8'));
const rpc=(uid,name,args,role=uid?'authenticated':'anon')=>h.transaction(uid,role,async tx=>(await tx.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as result',args)).rows[0].result);
await h.rpc(users.host,'partyplus_v2_commit_party',[randomUUID(),0,{id:'welcome-dinner',title:'A little dinner, a lot of good company',date:'2026-11-20T18:00:00-06:00',location:'The garden room',notes:'Come as you are. Bring something to share if you like, and let us know about dietary needs.',items:[{id:'ice',name:'Ice',qty:'2 bags'},{id:'bread',name:'Fresh bread'},{id:'dessert',name:'Something sweet'}]}]);
const sessions=new Map(),refreshes=new Map(),emails=new Map();
const userInfo=(id,anonymous,email)=>({id,aud:'authenticated',role:'authenticated',is_anonymous:anonymous,email,email_confirmed_at:anonymous?undefined:new Date().toISOString(),app_metadata:{provider:anonymous?'anonymous':'email'},user_metadata:{},created_at:new Date().toISOString()});
function session(info){const token=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:info.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,is_anonymous:info.is_anonymous})).toString('base64url')+'.synthetic';const refresh=randomUUID();sessions.set(token,info);refreshes.set(refresh,info);return {access_token:token,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:refresh,user:info};}
const signatures={partyplus_web_read_party:['p_party_id'],partyplus_web_join_party:['p_party_id','p_operation_id'],partyplus_web_list_my_parties:[],partyplus_web_record_event:['p_event_id','p_kind'],partyplus_v2_commit_party:['p_operation_id','p_expected_revision','p_party'],partyplus_v2_rsvp:['p_party_id','p_operation_id','p_response'],partyplus_v2_claim_item:['p_party_id','p_item_id','p_claim','p_operation_id'],partyplus_v2_suggest_item:['p_party_id','p_item_id','p_name','p_operation_id'],partyplus_v2_delete_party:['p_party_id','p_operation_id']};
const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
async function body(req){let raw='';for await(const data of req){raw+=data;if(raw.length>200000)throw Error('Request too large');}return raw?JSON.parse(raw):{};}
let failNext=false;
const server=http.createServer(async(req,res)=>{
 if(req.headers.origin==='http://localhost:8091'){
  res.setHeader('access-control-allow-origin','http://localhost:8091');
  res.setHeader('access-control-allow-headers',req.headers['access-control-request-headers']??'authorization,apikey,content-type,x-client-info,x-supabase-api-version,content-profile,accept-profile');
  res.setHeader('access-control-allow-methods','GET,POST,PUT,OPTIONS');
 }
 const route=new URL(req.url,'http://127.0.0.1').pathname;
 try{
  if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
  const principal=sessions.get((req.headers.authorization??'').replace(/^Bearer /,''));
  if(route==='/_synthetic/fail-next'&&req.method==='POST'){failNext=true;json(res,200,{armed:true});return;}
  if(route.startsWith('/auth/')){
   const input=await body(req);
   if(route==='/auth/v1/signup'){const id=randomUUID();await h.db.query('insert into auth.users(id,is_anonymous) values($1,true)',[id]);json(res,200,session(userInfo(id,true)));return;}
   if(route==='/auth/v1/user'&&req.method==='PUT'){if(!principal)throw Error('Missing session');emails.set(input.email,principal.id);json(res,200,{...principal,new_email:input.email});return;}
   if(route==='/auth/v1/user'){json(res,200,principal??{});return;}
   if(route==='/auth/v1/otp'){json(res,200,{});return;}
   if(route==='/auth/v1/verify'){
    if(input.token!=='12345678'){json(res,403,{code:'otp_expired',message:'Token has expired or is invalid'});return;}
    const id=emails.get(input.email)??randomUUID();emails.set(input.email,id);
    await h.db.query('insert into auth.users(id,is_anonymous,email_confirmed_at) values($1,false,now()) on conflict(id) do update set is_anonymous=false,email_confirmed_at=now()',[id]);
    json(res,200,session(userInfo(id,false,input.email)));return;
   }
   if(route==='/auth/v1/token'){const info=refreshes.get(input.refresh_token);if(!info)throw Error('Unknown refresh');json(res,200,session(info));return;}
   if(route==='/auth/v1/logout'){json(res,200,{});return;}
  }
  const fn=route.replace('/rest/v1/rpc/','');
  if(req.method==='POST'&&fn in signatures){
   const input=await body(req);const result=await rpc(principal?.id??null,fn,signatures[fn].map(key=>input[key]),principal?'authenticated':'anon');
   if(failNext&&fn!=='partyplus_web_record_event'&&fn!=='partyplus_web_read_party'&&fn!=='partyplus_web_list_my_parties'){failNext=false;json(res,503,{message:'Synthetic network timeout after commit'});return;}
   json(res,200,result);return;
  }
  const base=path.resolve('web-dist');const file=path.resolve(base,'.'+route);
  let selected=path.join(base,'index.html');if(file.startsWith(base+path.sep)&&['.js','.css','.svg'].includes(path.extname(file)))selected=file;
  const data=await fs.readFile(selected);res.writeHead(200,{'content-type':({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html'})[path.extname(selected)],'cache-control':'no-store'});res.end(data);
 }catch(error){json(res,error.code==='42501'?403:409,{code:error.code??'synthetic_error',message:error.message});}
});
server.listen(8091,'127.0.0.1',()=>console.log('Synthetic-only browser QA http://127.0.0.1:8091/i/welcome-dinner — email code 12345678'));
process.on('SIGINT',()=>server.close(async()=>{await h.close();process.exit(0);}));
