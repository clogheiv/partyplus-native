// Administrative synthetic conversion tests identity preservation; NOT delivered email linking.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const c=JSON.parse(await fs.readFile('.test-cache/staging-credentials.json','utf8'));assert.equal(c.url,'https://qmbwrbxbbshbavfhkujx.supabase.co');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},client=()=>createClient(c.url,c.publishableKey,options);
const admin=createClient(c.url,c.secretKey,options),host=client(),guest=client(),returned=client();
const ok=async p=>{const r=await p;if(r.error)throw Error(r.error.message);return r.data;};
const run=randomUUID(),partyId='synthetic-link-'+run,item=randomUUID(),email='synthetic-link-'+run+'@example.test';
const evidence={projectRef:'qmbwrbxbbshbavfhkujx',scope:'Real Auth administrative synthetic conversion and generated OTP recovery; no delivered email; not updateUser/email_change end-to-end proof',checks:[],startedAt:new Date().toISOString()};
try{
  const hostEmail='synthetic-link-host-'+run+'@example.test',password=randomBytes(32).toString('base64url');
  await ok(admin.auth.admin.createUser({email:hostEmail,password,email_confirm:true}));await ok(host.auth.signInWithPassword({email:hostEmail,password}));
  await ok(host.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:0,p_party:{id:partyId,title:'Synthetic account link',items:[{id:item,name:'Ice'}]}}));
  const principal=(await ok(guest.auth.signInAnonymously())).user.id;
  await ok(guest.rpc('partyplus_v2_rsvp',{p_party_id:partyId,p_operation_id:randomUUID(),p_response:{name:'Synthetic linking guest',status:'yes',attendeeCount:2}}));
  await ok(guest.rpc('partyplus_v2_claim_item',{p_party_id:partyId,p_item_id:item,p_claim:true,p_operation_id:randomUUID()}));
  const converted=(await ok(admin.auth.admin.updateUserById(principal,{email,email_confirm:true}))).user;
  assert.equal(converted.id,principal);assert.equal(converted.is_anonymous,false);assert.ok(converted.email_confirmed_at);
  const session=(await ok(guest.auth.getSession())).session;await ok(guest.auth.refreshSession({refresh_token:session.refresh_token}));
  assert.equal((await ok(guest.auth.getUser())).user.id,principal);
  const link=await ok(admin.auth.admin.generateLink({type:'magiclink',email}));
  await ok(returned.auth.verifyOtp({email,token:link.properties.email_otp,type:'email'}));
  assert.equal((await ok(returned.auth.getUser())).user.id,principal);
  const before=await ok(returned.rpc('partyplus_v2_read_party',{p_party_id:partyId}));
  assert.equal(before.canEdit,false);assert.equal(before.rsvps[0].id,principal);assert.equal(before.items[0].claimedByUserId,principal);
  const denied=await returned.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:before.revision,p_party:{...before,title:'Steal host'}});assert.ok(denied.error);assert.match(denied.error.message,/host_access_required/);
  await ok(returned.rpc('partyplus_v2_claim_item',{p_party_id:partyId,p_item_id:item,p_claim:false,p_operation_id:randomUUID()}));
  const ownId=partyId+'-owned';await ok(returned.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:0,p_party:{id:ownId,title:'Verified own party',items:[]}}));
  assert.ok((await ok(returned.rpc('partyplus_v2_list_host_parties',{}))).some(p=>p.id===ownId));
  evidence.checks=['Anonymous principal UUID preserved after synthetic admin email confirmation','Original guest RSVP and claim ownership survive refreshed session and generated OTP on new client','Becoming verified does not grant host ownership of the attended party','Returning principal can release its own claim and create/recover its own host party'];evidence.status='passed';
  console.log('PASS real Auth synthetic conversion preserves principal, guest ownership, and verified host recovery; delivered linking remains unqualified.');
}catch(e){evidence.status='failed';evidence.failure=e.message;throw e;}
finally{evidence.finishedAt=new Date().toISOString();await fs.writeFile('docs/staging-evidence-2026-10-02/account-conversion.json',JSON.stringify(evidence,null,2)+'\n');for(const x of [host,guest,returned])await x.auth.signOut({scope:'local'});}
