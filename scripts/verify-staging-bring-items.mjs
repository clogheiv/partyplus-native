// Focused regression: explicitly submitted bring items survive create, return,
// guest claim and host editing. Only synthetic staging records are touched.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const ref='qmbwrbxbbshbavfhkujx';
const vaultRoot=path.resolve(process.env.PARTYPLUS_BACKEND_DEPENDENCIES??'.');
const config=JSON.parse(await fs.readFile(path.join(vaultRoot,'.test-cache/staging-credentials.json'),'utf8'));
assert.equal(config.url,`https://${ref}.supabase.co`);
const vault=JSON.parse(process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS??'null');
delete process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS;
assert.equal(vault?.ref,ref);
const client=()=>createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const host=client(),returnedHost=client(),guest=client(),unsigned=client();
const ok=async pending=>{const result=await pending;assert.equal(result.error,null);return result.data;};
const hostAccount=vault.accounts[0];
const login=async target=>{
  const result=await ok(target.auth.signInWithPassword({email:hostAccount.email,password:hostAccount.password}));
  assert.equal(result.user.id,hostAccount.id);assert.ok(result.user.email_confirmed_at);
};
await login(host);
const guestUser=(await ok(guest.auth.signInAnonymously())).user;
assert.equal(guestUser.is_anonymous,true);
const fixture={partyId:randomUUID(),itemId:randomUUID(),createOperation:randomUUID()};
await fs.mkdir('.test-cache',{recursive:true});
await fs.writeFile('.test-cache/bring-item-regression-fixture.json',JSON.stringify(fixture,null,2)+'\n');
const payload={id:fixture.partyId,title:'Synthetic bring item persistence',items:[{id:fixture.itemId,name:'Dessert',qty:'Serves 12'}]};
const createArgs={p_operation_id:fixture.createOperation,p_expected_revision:0,p_party:payload};
const receipt=await ok(host.rpc('partyplus_v2_commit_party',createArgs));
const exactItem=party=>{
  assert.equal(party.id,fixture.partyId);assert.equal(party.items.length,1);
  assert.equal(party.items[0].id,fixture.itemId);assert.equal(party.items[0].name,'Dessert');
  assert.equal(party.items[0].qty,'Serves 12');
};
exactItem(receipt.party);assert.equal(receipt.committed,true);
assert.deepEqual(await ok(host.rpc('partyplus_v2_commit_party',createArgs)),receipt);
const read=target=>ok(target.rpc('partyplus_web_read_party',{p_party_id:fixture.partyId}));
exactItem(await read(host));exactItem(await read(guest));exactItem(await read(unsigned));
await login(returnedHost);
const returned=await read(returnedHost);exactItem(returned);assert.equal(returned.canEdit,true);
await ok(guest.rpc('partyplus_v2_rsvp',{p_party_id:fixture.partyId,p_operation_id:randomUUID(),p_response:{name:'Synthetic Dessert Guest',status:'yes',attendeeCount:2}}));
await ok(guest.rpc('partyplus_v2_claim_item',{p_party_id:fixture.partyId,p_item_id:fixture.itemId,p_claim:true,p_operation_id:randomUUID()}));
const beforeEdit=await read(returnedHost);exactItem(beforeEdit);
assert.equal(beforeEdit.items[0].claimedBy,'Synthetic Dessert Guest');
const editArgs={p_operation_id:randomUUID(),p_expected_revision:beforeEdit.revision,p_party:{...payload,title:'Synthetic bring item edited',rsvps:[]}};
const editReceipt=await ok(returnedHost.rpc('partyplus_v2_commit_party',editArgs));
exactItem(editReceipt.party);assert.equal(editReceipt.party.rsvps.length,1);
assert.deepEqual(await ok(returnedHost.rpc('partyplus_v2_commit_party',editArgs)),editReceipt);
const guestAfter=await read(guest);exactItem(guestAfter);
assert.equal(guestAfter.items[0].isMine,true);assert.equal(guestAfter.ownRsvp.attendeeCount,2);
assert.equal(guestAfter.ownRsvp.id,guestUser.id);
exactItem(await read(unsigned));
const evidence={observedAt:new Date().toISOString(),projectRef:ref,productionAccessed:false,
  actualMichaelPartyOrTiffanyResponseAccessed:false,fixtureIsSynthetic:true,fixturePartyId:fixture.partyId,
  checks:{explicitDessertAndQuantitySubmitted:true,createReceiptRetainsItem:true,
    replayDoesNotDuplicateItem:true,freshHostAndGuestAndUnsignedReadsRetainItem:true,
    independentHostSignInRetainsItemAndOwnership:true,hostEditRetainsSameItemIdentityAndQuantity:true,
    hostEditPreservesGuestClaimAndRsvp:true,editReplayDoesNotDuplicateItem:true},
  scopeLimit:'Proves explicitly included payload items persist. Does not prove a pending unadded form input was included in the released UI request.'};
await fs.writeFile('supabase/web-rebuild/BRING_ITEM_SAVE_CHECK_2026-10-31.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
for(const target of [host,returnedHost,guest])await target.auth.signOut({scope:'local'});
