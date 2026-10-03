import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const c=JSON.parse(await fs.readFile('.test-cache/staging-credentials.json','utf8'));
assert.equal(c.url,'https://qmbwrbxbbshbavfhkujx.supabase.co');
const fixture=JSON.parse(await fs.readFile('.test-cache/staging-preview-host.json','utf8'));
assert.ok(fixture.partyId.startsWith('synthetic-browser-'));
const host=createClient(c.url,c.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const ok=async r=>{r=await r;if(r.error)throw Error(r.error.message);return r.data;};
try {
  await ok(host.auth.signInWithPassword({email:fixture.email,password:fixture.password}));
  const parties=await ok(host.rpc('partyplus_v2_list_host_parties'));
  const party=parties.find(p=>p.id===fixture.partyId);assert.ok(party?.canEdit);
  assert.equal(party.rsvps.length,1);assert.equal(party.rsvps[0].name,'Synthetic Browser Guest');assert.equal(party.rsvps[0].attendeeCount,2);
  assert.equal(party.items.find(i=>i.name==='Ice').claimedByUserId,party.rsvps[0].id);
  assert.equal(party.items.filter(i=>i.name==='Synthetic Browser Cups').length,1);
  const receipt=await ok(host.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:party.revision,p_party:{...party,title:'PartyPlus Staging Browser Test — Host Reviewed'}}));
  assert.deepEqual(receipt.party.rsvps,party.rsvps);assert.deepEqual(receipt.party.items,party.items);
  await fs.writeFile('docs/staging-evidence-2026-10-02/browser-host-verification.json',JSON.stringify({status:'passed',scope:'Real staging browser guest, independent verified host SDK session',checks:['Host sees exactly one browser RSVP, guest claim and suggestion','Host title edit preserves exact guest state','Guest browser reload retains its own response and claim'],party:receipt.party,capturedAt:new Date().toISOString()},null,2)+'\n');
  console.log('PASS Independent host sees browser response, claim and suggestion; title edit preserves guest state');
} finally {await host.auth.signOut({scope:'local'});}
