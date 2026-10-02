import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./load-ts.mjs";
const {handler}=loadTs("invite-web/netlify/functions/party.ts");
const {validateBackendBoundary}=loadTs("src/lib/backendBoundary.ts");
test("read-only invitation adapter refuses mutation verbs and unconfigured or production targets",async()=>{
  assert.equal((await handler({httpMethod:"POST",queryStringParameters:{id:"old-id"}})).statusCode,405);
  assert.equal((await handler({httpMethod:"GET"})).statusCode,400);
  assert.equal((await handler({httpMethod:"GET",queryStringParameters:{partyId:"old-id"}})).statusCode,503);
  process.env.PARTYPLUS_BACKEND_ENV="staging";
  process.env.PARTYPLUS_SUPABASE_URL="https://typbofemqhjoiwbkdvuc.supabase.co";
  process.env.PARTYPLUS_SUPABASE_PUBLISHABLE_KEY="public";
  try {assert.equal((await handler({httpMethod:"GET",queryStringParameters:{id:"old-id"}})).statusCode,503);}
  finally {delete process.env.PARTYPLUS_BACKEND_ENV;delete process.env.PARTYPLUS_SUPABASE_URL;delete process.env.PARTYPLUS_SUPABASE_PUBLISHABLE_KEY;}
});
test("client boundary rejects service-role and URL-embedded credentials",()=>{
  const key="eyJhbGciOiJIUzI1NiJ9."+Buffer.from(JSON.stringify({role:"service_role"})).toString("base64url")+".signature";
  assert.equal(validateBackendBoundary("local","http://127.0.0.1:54321",key,true).configured,false);
  assert.equal(validateBackendBoundary("staging","https://stage.supabase.co","sb_secret_not-for-clients",true).configured,false);
  assert.equal(validateBackendBoundary("local","http://name:secret@127.0.0.1:54321","key",true).configured,false);
});
