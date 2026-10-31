// Creates/replays only a synthetic browser fixture in the named existing staging
// project. Existing reviewer credentials arrive from the DPAPI vault in memory.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const ref='qmbwrbxbbshbavfhkujx';
const dependencyRoot=path.resolve(process.env.PARTYPLUS_BACKEND_DEPENDENCIES??'.');
const config=JSON.parse(await fs.readFile(path.join(dependencyRoot,'.test-cache/staging-credentials.json'),'utf8'));
assert.equal(config.url,`https://${ref}.supabase.co`);
const vault=JSON.parse(process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS??'null');
delete process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS;
assert.equal(vault?.ref,ref);
const account=vault.accounts[0];
const client=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const signIn=await client.auth.signInWithPassword({email:account.email,password:account.password});
assert.equal(signIn.error,null);assert.equal(signIn.data.user.id,account.id);
assert.equal(signIn.data.user.is_anonymous,false);assert.ok(signIn.data.user.email_confirmed_at);
await fs.mkdir('.test-cache',{recursive:true});
const filename='.test-cache/web-browser-fixture.json';
let fixture;
try{fixture=JSON.parse(await fs.readFile(filename,'utf8'));}catch(error){
  if(error.code!=='ENOENT')throw error;
  fixture={partyId:crypto.randomUUID(),operationId:crypto.randomUUID(),items:['Ice','Napkins','Cups'].map(name=>({id:crypto.randomUUID(),name}))};
  await fs.writeFile(filename,JSON.stringify(fixture,null,2)+'\n');
}
const result=await client.rpc('partyplus_v2_commit_party',{
  p_operation_id:fixture.operationId,p_expected_revision:0,
  p_party:{id:fixture.partyId,title:'Browser rebuild verification',date:'2026-12-05T19:00:00.000Z',
    location:'Synthetic test venue',notes:'Synthetic preview fixture for the browser verification journey.',items:fixture.items}
});
assert.equal(result.error,null);assert.equal(result.data.committed,true);assert.equal(result.data.party.id,fixture.partyId);
assert.equal(result.data.party.canEdit,true);
const read=await client.rpc('partyplus_web_read_party',{p_party_id:fixture.partyId});assert.equal(read.error,null);
assert.equal(read.data.canEdit,true);assert.equal(read.data.hostId,undefined);
const listing=await client.rpc('partyplus_web_list_my_parties');assert.equal(listing.error,null);
assert.ok(listing.data.hosting.some(p=>p.id===fixture.partyId));assert.ok(!listing.data.joined.some(p=>p.id===fixture.partyId));
console.log(JSON.stringify({at:new Date().toISOString(),projectRef:ref,partyId:fixture.partyId,
  fixtureIsSynthetic:true,verifiedHost:true,automaticallyInHosting:true,publicPrincipalLeak:false,
  emailSent:false,customerDataAccessed:false,productionAccessed:false},null,2));
