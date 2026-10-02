// Loopback-only demonstration transport. Tokens here are synthetic, not Supabase JWT verification.
// This is never shipped by Netlify or used as production authentication.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { backendHarness, users } from "../tests/backend-harness.mjs";
if (process.env.PARTYPLUS_TEST_DATABASE_URL) throw Error("Demo uses an ephemeral in-memory database only.");
process.env.PARTYPLUS_BACKEND_ENV="local";
const sitePort=Number(process.env.PARTYPLUS_SYNTHETIC_SITE_PORT ?? 8089);
if (!Number.isInteger(sitePort) || sitePort<1024 || sitePort>65535) throw Error("Invalid synthetic site port");
process.env.PARTYPLUS_SUPABASE_URL="http://127.0.0.1:" + sitePort;
process.env.PARTYPLUS_SUPABASE_PUBLISHABLE_KEY="synthetic-placeholder";
await import("./build-invite.mjs");
const h = await backendHarness();
const id = "legacy-demo-party";
await h.rpc(users.host,"partyplus_v2_commit_party",[randomUUID(),0,{
  id,title:"Synthetic Birthday <script>never executes</script>",location:"123 Test Street",notes:"Synthetic data only. No installation needed.",
  items:[{id:"legacy-ice",name:"Ice"},{id:"legacy-cups",name:"Cups"}],
}]);
const sessions=new Map();
const requests=[];
let failNextRsvp=false;
const params={
  partyplus_v2_read_party:["p_party_id"], partyplus_v2_commit_party:["p_operation_id","p_expected_revision","p_party"],
  partyplus_v2_rsvp:["p_party_id","p_operation_id","p_response"],
  partyplus_v2_claim_item:["p_party_id","p_item_id","p_claim","p_operation_id"],
  partyplus_v2_suggest_item:["p_party_id","p_item_id","p_name","p_operation_id"],
};
function json(res,status,value) { res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(value)); }
async function body(req) { let data="";for await(const chunk of req) {data+=chunk;if(data.length>50000)throw Error("Request too large");}return data?JSON.parse(data):{}; }
const api=http.createServer(async(req,res)=>{
  res.setHeader("access-control-allow-origin","http://127.0.0.1:" + sitePort);
  res.setHeader("access-control-allow-headers","authorization,apikey,content-type,x-client-info,x-supabase-api-version");
  res.setHeader("access-control-allow-methods","GET,POST,OPTIONS");
  if(req.method==="OPTIONS") {res.writeHead(204);res.end();return;}
  const route=new URL(req.url,"http://127.0.0.1").pathname;
  try {
    if(route==="/_synthetic/status") {json(res,200,{requests,party:await h.rpc(null,"partyplus_v2_read_party",[id],"anon")});return;}
    if(route==="/_synthetic/fail-next-rsvp" && req.method==="POST") {failNextRsvp=true;json(res,200,{armed:true});return;}
    if(route==="/auth/v1/signup" && req.method==="POST") {
      requests.push({kind:"guest-session"});
      const uid=randomUUID();await h.db.query("insert into auth.users(id,is_anonymous) values($1,true)",[uid]);
      const token=Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url")+"."+
        Buffer.from(JSON.stringify({sub:uid,role:"authenticated",exp:Math.floor(Date.now()/1000)+3600,is_anonymous:true})).toString("base64url")+".synthetic";
      sessions.set(token,uid);
      json(res,200,{access_token:token,token_type:"bearer",expires_in:3600,refresh_token:randomUUID(),user:{id:uid,aud:"authenticated",role:"authenticated",is_anonymous:true,app_metadata:{provider:"anonymous"},user_metadata:{},created_at:new Date().toISOString()}});return;
    }
    const fn=route.replace("/rest/v1/rpc/","");
    if(req.method!=="POST" || !params[fn]) {json(res,404,{message:"Synthetic endpoint not found"});return;}
    const payload=await body(req);
    const uid=sessions.get((req.headers.authorization??"").replace(/^Bearer /,""))??null;
    const read=fn==="partyplus_v2_read_party";
    requests.push({kind:read?"read":"mutation",fn,operationId:payload.p_operation_id});
    const result=await h.rpc(uid,fn,params[fn].map(key=>payload[key]),read&&!uid?"anon":"authenticated");
    if(fn==="partyplus_v2_rsvp" && failNextRsvp) {failNextRsvp=false;json(res,503,{message:"Synthetic network timeout after commit"});return;}
    json(res,200,result);
  }catch(error){json(res,error.code==="42501"?403:409,{code:error.code??"synthetic_error",message:error.message});}
});
const directory=path.resolve(".test-cache/invite-site");
const site=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,"http://127.0.0.1").pathname;
  if (pathname.startsWith("/rest/") || pathname.startsWith("/auth/")) { api.emit("request",req,res);return; }
  const file=path.resolve(directory,"."+(pathname.startsWith("/assets/")||["/invite.js","/invite.js.map"].includes(pathname)?pathname:"/index.html"));
  if(!file.startsWith(directory+path.sep)) {res.writeHead(403);res.end();return;}
  try {const data=await fs.readFile(file);res.setHeader("content-type",file.endsWith(".js")?"application/javascript":file.endsWith(".png")?"image/png":file.endsWith(".html")?"text/html":"application/json");res.end(data);}
  catch {res.writeHead(404);res.end();}
});
await Promise.all([new Promise((resolve,reject)=>{api.once("error",reject);api.listen(54321,"127.0.0.1",resolve);}),new Promise((resolve,reject)=>{site.once("error",reject);site.listen(sitePort,"127.0.0.1",resolve);})]);
console.log("Synthetic invite: http://127.0.0.1:" + sitePort + "/i/legacy-demo-party");
const close=async()=>{api.close();site.close();await h.close();process.exit(0);};
process.on("SIGINT",close);process.on("SIGTERM",close);
