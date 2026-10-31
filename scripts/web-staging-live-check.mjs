// Focused real Auth/RPC loop, isolated to one durable synthetic staging fixture.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const ref='qmbwrbxbbshbavfhkujx';
const oldRoot=path.resolve(process.env.PARTYPLUS_BACKEND_DEPENDENCIES??'.');
const config=JSON.parse(await fs.readFile(path.join(oldRoot,'.test-cache/staging-credentials.json'),'utf8'));
assert.equal(config.url,`https://${ref}.supabase.co`);
const vault=JSON.parse(process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS??'null');
delete process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS;assert.equal(vault.ref,ref);
const client=()=>createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const host=client(),stranger=client(),guest=client(),unsigned=client();
for(const [c,account] of [[host,vault.accounts[0]],[stranger,vault.accounts[1]]]){
  const result=await c.auth.signInWithPassword({email:account.email,password:account.password});
  assert.equal(result.error,null);assert.equal(result.data.user.id,account.id);assert.ok(result.data.user.email_confirmed_at);
}
const anon=await guest.auth.signInAnonymously();assert.equal(anon.error,null);assert.equal(anon.data.user.is_anonymous,true);
const guestId=anon.data.user.id;
const fixture={partyId:crypto.randomUUID(),itemId:crypto.randomUUID(),suggestionId:crypto.randomUUID()};
await fs.mkdir('.test-cache',{recursive:true});
await fs.writeFile('.test-cache/web-backend-loop.json',JSON.stringify(fixture,null,2)+'\n');
const checks=[];
const rpc=async(c,name,args={})=>{const r=await c.rpc(name,args);assert.equal(r.error,null,name);return r.data;};
const read=c=>rpc(c,'partyplus_web_read_party',{p_party_id:fixture.partyId});
const createOp=crypto.randomUUID();
const request={p_operation_id:createOp,p_expected_revision:0,p_party:{id:fixture.partyId,title:'Backend browser contract verification',items:[{id:fixture.itemId,name:'Synthetic cups'}]}};
const created=await rpc(host,'partyplus_v2_commit_party',request);
assert.equal(created.committed,true);assert.equal(created.party.canEdit,true);
assert.deepEqual(await rpc(host,'partyplus_v2_commit_party',request),created);
assert.ok((await rpc(host,'partyplus_web_list_my_parties')).hosting.some(p=>p.id===fixture.partyId));
checks.push('verified-host-create-replay-and-automatic-hosting');
assert.equal((await read(unsigned)).canEdit,false);
assert.ok(!(await rpc(guest,'partyplus_web_list_my_parties')).joined.some(p=>p.id===fixture.partyId));
const suggested=await rpc(guest,'partyplus_v2_suggest_item',{p_party_id:fixture.partyId,p_item_id:fixture.suggestionId,p_name:'Synthetic napkins',p_operation_id:crypto.randomUUID()});
assert.equal(suggested.party.isJoined,true);assert.equal(suggested.party.ownRsvp,null);
assert.ok((await rpc(guest,'partyplus_web_list_my_parties')).joined.some(p=>p.id===fixture.partyId));
checks.push('anonymous-auth-guest-suggestion-persists-membership');
const rsvpRequest={p_party_id:fixture.partyId,p_operation_id:crypto.randomUUID(),p_response:{name:'Synthetic API Guest',status:'yes',attendeeCount:2}};
const response=await rpc(guest,'partyplus_v2_rsvp',rsvpRequest);
assert.equal(response.party.ownRsvp.id,guestId);assert.equal(response.party.ownRsvp.attendeeCount,2);
assert.deepEqual(await rpc(guest,'partyplus_v2_rsvp',rsvpRequest),response);
const claimRequest={p_party_id:fixture.partyId,p_item_id:fixture.itemId,p_claim:true,p_operation_id:crypto.randomUUID()};
const claimed=await rpc(guest,'partyplus_v2_claim_item',claimRequest);
assert.equal(claimed.party.items.find(i=>i.id===fixture.itemId).isMine,true);
assert.deepEqual(await rpc(guest,'partyplus_v2_claim_item',claimRequest),claimed);
checks.push('rsvp-claim-and-idempotent-receipts');
for(const name of ['partyplus_v2_read_party','partyplus_web_read_party']){
  const pub=await rpc(unsigned,name,{p_party_id:fixture.partyId});
  assert.deepEqual(pub.rsvps,[]);assert.equal(pub.ownRsvp,null);assert.equal(pub.hostId,undefined);
  assert.ok(!JSON.stringify(pub).includes(guestId));assert.ok(!JSON.stringify(pub).includes(vault.accounts[0].id));
}
const owner=await read(host);assert.equal(owner.rsvps.length,1);assert.notEqual(owner.rsvps[0].id,guestId);
assert.equal(owner.totals.attending,2);assert.equal(owner.items.find(i=>i.id===fixture.itemId).claimedByUserId,undefined);
checks.push('unsigned-and-host-privacy-projections');
const stale=await host.rpc('partyplus_v2_commit_party',{p_operation_id:crypto.randomUUID(),p_expected_revision:1,p_party:{id:fixture.partyId,title:'Stale',items:[]}});
assert.ok(stale.error);assert.match(stale.error.message,/revision_conflict/);
const current=await read(host);
const edited=await rpc(host,'partyplus_v2_commit_party',{p_operation_id:crypto.randomUUID(),p_expected_revision:current.revision,p_party:{id:fixture.partyId,title:'Backend verified',items:[]}});
assert.equal(edited.party.rsvps.length,1);assert.equal(edited.party.items.length,2);
assert.equal((await read(guest)).items.find(i=>i.id===fixture.itemId).isMine,true);
checks.push('stale-edit-conflict-and-guest-state-preserved-on-host-edit');
for(const [name,args] of [
  ['partyplus_v2_commit_party',{p_operation_id:crypto.randomUUID(),p_expected_revision:edited.party.revision,p_party:{id:fixture.partyId,title:'Forbidden',items:[]}}],
  ['partyplus_v2_delete_party',{p_party_id:fixture.partyId,p_operation_id:crypto.randomUUID()}],
  ['partyplus_v2_claim_item',{p_party_id:fixture.partyId,p_item_id:fixture.itemId,p_claim:false,p_operation_id:crypto.randomUUID()}]
]){const denied=await stranger.rpc(name,args);assert.ok(denied.error);assert.equal(denied.error.code,'42501');}
assert.ok(!(await rpc(stranger,'partyplus_web_list_my_parties')).hosting.some(p=>p.id===fixture.partyId));
assert.ok(!(await rpc(stranger,'partyplus_web_list_my_parties')).joined.some(p=>p.id===fixture.partyId));
checks.push('stranger-edit-delete-unclaim-and-list-denied');
const event=crypto.randomUUID();assert.equal(await rpc(unsigned,'partyplus_web_record_event',{p_event_id:event,p_kind:'invitation_opened'}),true);
assert.equal(await rpc(unsigned,'partyplus_web_record_event',{p_event_id:event,p_kind:'invitation_opened'}),true);
const deniedEvent=await unsigned.rpc('partyplus_web_record_event',{p_event_id:crypto.randomUUID(),p_kind:'party_created'});assert.equal(deniedEvent.error?.code,'42501');
checks.push('unsigned-open-deduplication-and-other-events-denied');
for(const c of [unsigned,guest]){const raw=await c.from('parties').select('id').limit(1);assert.ok(raw.error);assert.equal(raw.error.code,'42501');}
checks.push('signed-and-unsigned-raw-enumeration-denied');
const result={at:new Date().toISOString(),projectRef:ref,partyId:fixture.partyId,checks,checksPassed:checks.length,
  emailDeliveryTested:false,productionAccessed:false,customerRowsUsed:false};
await fs.writeFile('supabase/web-rebuild/LIVE_STAGING_CHECK_2026-10-31.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
