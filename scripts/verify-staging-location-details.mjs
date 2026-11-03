// Real existing staging RPC boundary; only new synthetic fixture mutations.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const root=path.resolve(process.env.PARTYPLUS_BACKEND_DEPENDENCIES??'.'),ref='qmbwrbxbbshbavfhkujx';
const config=JSON.parse(await fs.readFile(path.join(root,'.test-cache/staging-credentials.json'),'utf8'));assert.equal(config.url,`https://${ref}.supabase.co`);
const vault=JSON.parse(process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS??'null');delete process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS;assert.equal(vault.ref,ref);
const client=()=>createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const host=client(),returned=client(),stranger=client(),guest=client(),unsigned=client();
const ok=async request=>{const r=await request;assert.equal(r.error,null);return r.data;};
const login=async(c,a)=>{const r=await ok(c.auth.signInWithPassword({email:a.email,password:a.password}));assert.equal(r.user.id,a.id);};
const id=randomUUID(),item=randomUUID(),legacy='Synthetic community room — rear entrance, ask at front desk; no components guessed';
const appearance={version:1,design:'holiday',layout:'illustrated',accent:'forest',font:'classic',artwork:'evergreen'};
const details={version:1,streetAddress:'123 Synthetic Lane',city:'Testville',zipCode:'12345-6789'};
const read=c=>ok(c.rpc('partyplus_web_read_party',{p_party_id:id}));
const commit=(party,revision,operationId=randomUUID())=>ok(host.rpc('partyplus_v2_commit_party',{p_operation_id:operationId,p_expected_revision:revision,p_party:party}));
try{
 await login(host,vault.accounts[0]);await login(stranger,vault.accounts[1]);
 if(process.argv[2]==='prepare-ui-legacy'){
  const saved=await commit({id,title:'Synthetic legacy freeform location UI check',location:legacy,items:[],appearance},0);
  assert.equal(saved.party.locationDetails,null);assert.equal(saved.party.location,legacy);
  const result={at:new Date().toISOString(),projectRef:ref,productionAccessed:false,syntheticPartyId:id,legacyFreeformPreserved:true};
  await fs.writeFile('docs/location-details-ui-legacy-2026-11-02.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }else if(process.argv[2]==='verify-null-echo'){
  const fixture=JSON.parse(await fs.readFile('docs/location-details-staging-roundtrip-2026-11-02.json','utf8'));
  const current=await ok(host.rpc('partyplus_web_read_party',{p_party_id:fixture.syntheticPartyId}));assert.match(current.title,/^Synthetic/);assert.deepEqual(current.locationDetails,details);
  const saved=await ok(host.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:current.revision,p_party:{id:current.id,title:current.title,location:current.location,items:[],locationDetails:null}}));
  assert.deepEqual(saved.party.locationDetails,current.locationDetails);assert.deepEqual(saved.party.appearance,current.appearance);assert.deepEqual(saved.party.items,current.items);assert.deepEqual(saved.party.rsvps,current.rsvps);
  const result={at:new Date().toISOString(),projectRef:ref,productionAccessed:false,legacyNullEchoPreservesSavedDetails:true,appearanceClaimsAndRsvpsPreserved:true};
  await fs.writeFile('docs/location-details-null-echo-2026-11-02.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }else{
 const legacyReceipt=await commit({id,title:'Synthetic structured-location roundtrip',location:legacy,items:[{id:item,name:'Dessert'}],appearance},0);
 assert.equal((await read(unsigned)).location,legacy);assert.equal((await read(unsigned)).locationDetails,null);
 await ok(guest.auth.signInAnonymously());await ok(guest.rpc('partyplus_v2_rsvp',{p_party_id:id,p_operation_id:randomUUID(),p_response:{name:'Synthetic location guest',status:'yes',attendeeCount:2}}));
 await ok(guest.rpc('partyplus_v2_claim_item',{p_party_id:id,p_item_id:item,p_claim:true,p_operation_id:randomUUID()}));
 let p=await read(host);p=(await commit({id,title:p.title,location:p.location,items:[]},p.revision)).party;assert.equal(p.location,legacy);assert.equal(p.locationDetails,null);
 const op=randomUUID(),payload={id,title:p.title,location:p.location,items:[],locationDetails:details},rev=p.revision;
 const receipt=await commit(payload,rev,op);assert.deepEqual(receipt.party.locationDetails,details);assert.deepEqual(await commit(payload,rev,op),receipt);
 await login(returned,vault.accounts[0]);assert.deepEqual((await read(returned)).locationDetails,details);assert.deepEqual((await read(unsigned)).locationDetails,details);
 const lists=await ok(returned.rpc('partyplus_web_list_my_parties'));assert.deepEqual(lists.hosting.find(p=>p.id===id).locationDetails,details);
 assert.deepEqual(receipt.party.appearance,appearance);assert.equal(receipt.party.rsvps[0].attendeeCount,2);assert.equal((await read(guest)).items[0].isMine,true);assert.equal(receipt.party.location,legacy);
 p=await read(host);p=(await commit({id,title:p.title,location:p.location,items:[]},p.revision)).party;assert.deepEqual(p.locationDetails,details);
 for(const c of [stranger,guest]){const denied=await c.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:p.revision,p_party:{...payload,title:'Must not save'}});assert.equal(denied.error?.code,'42501');}
 const invalid=await host.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:p.revision,p_party:{...payload,locationDetails:{...details,zipCode:'x'.repeat(21)}}});assert.ok(invalid.error?.message.includes('invalid_location_details'));assert.deepEqual(await read(host),p);
 const result={at:new Date().toISOString(),projectRef:ref,productionAccessed:false,customerDataUsed:false,syntheticPartyId:id,checks:{legacyFreeformUnparsedAndPreserved:true,hostReceiptAndReplayExact:true,crossSessionAndUnsignedReadRoundtrip:true,myPartiesRoundtrip:true,oldClientOmissionPreserves:true,appearanceRsvpAndClaimRetained:true,guestAndStrangerWriteDenied:true,invalidInputRollsBack:true},newFields:{version:1,streetAddressMax:300,cityMax:120,zipCodeMax:20}};
 await fs.writeFile('docs/location-details-staging-roundtrip-2026-11-02.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }
}finally{for(const c of [host,returned,stranger,guest])await c.auth.signOut({scope:'local'}).catch(()=>{});}
