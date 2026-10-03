// Pinned synthetic staging checks. Generated OTP tests never claim email delivery.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const mode=process.argv[2];
assert.ok(['prepare','paused','enabled','phone-check','phone-host-edit','web-check'].includes(mode));
const c=JSON.parse(await fs.readFile('.test-cache/staging-credentials.json','utf8'));
assert.equal(c.url,'https://qmbwrbxbbshbavfhkujx.supabase.co');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const client=()=>createClient(c.url,c.publishableKey,options),admin=createClient(c.url,c.secretKey,options);
const reader=client(),host=client(),stranger=client(),guest=client();
const ok=async p=>{const r=await p;if(r.error)throw Error(r.error.code+': '+r.error.message);return r.data;};
const denied=async(p,pattern)=>{const r=await p;assert.ok(r.error,'Expected denial');assert.match(r.error.message,pattern);return r.error.code;};
const rpc=(who,name,args)=>ok(who.rpc('partyplus_v2_'+name,args));
const fixturePath='.test-cache/cutover-fixtures.json';
let f;
const evidence={projectRef:'qmbwrbxbbshbavfhkujx',mode,startedAt:new Date().toISOString(),checks:[]};
const check=s=>{evidence.checks.push(s);console.log('PASS '+s);};
try {
 if(mode==='prepare'){
  f={partyId:'synthetic-android-'+randomUUID(),itemId:randomUUID(),createOp:randomUUID(),hostEmail:'synthetic-cutover-host-'+randomUUID()+'@example.test',strangerEmail:'synthetic-cutover-stranger-'+randomUUID()+'@example.test',password:randomBytes(32).toString('base64url')};
  for(const email of [f.hostEmail,f.strangerEmail])await ok(admin.auth.admin.createUser({email,password:f.password,email_confirm:true}));
  await ok(host.auth.signInWithPassword({email:f.hostEmail,password:f.password}));
  await ok(stranger.auth.signInWithPassword({email:f.strangerEmail,password:f.password}));
  f.hostId=(await ok(host.auth.getUser())).user.id;f.strangerId=(await ok(stranger.auth.getUser())).user.id;
  f.guestId=(await ok(guest.auth.signInAnonymously())).user.id;
  f.party={id:f.partyId,title:'Android Staging Core Loop',date:'2027-01-01T18:00:00Z',location:'Synthetic Hall',items:[{id:f.itemId,name:'Ice'}]};
  f.createReceipt=await rpc(host,'commit_party',{p_operation_id:f.createOp,p_expected_revision:0,p_party:f.party});
  await fs.writeFile(fixturePath,JSON.stringify(f));
  check('Verified synthetic host, verified stranger and signed anonymous guest; durable phone fixture created');
 } else {
  f=JSON.parse(await fs.readFile(fixturePath,'utf8'));assert.ok(f.partyId.startsWith('synthetic-android-'));
  await ok(host.auth.signInWithPassword({email:f.hostEmail,password:f.password}));
  await ok(stranger.auth.signInWithPassword({email:f.strangerEmail,password:f.password}));
  await ok(guest.auth.signInAnonymously());
  const read=()=>rpc(reader,'read_party',{p_party_id:f.partyId});
  const before=await read();assert.equal(before.id,f.partyId);
  if(mode==='paused'){
   await denied(host.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:before.revision,p_party:{...before,title:'Paused change'}}),/writes_paused/);
   await denied(guest.rpc('partyplus_v2_rsvp',{p_party_id:f.partyId,p_operation_id:randomUUID(),p_response:{name:'Paused guest',status:'yes',attendeeCount:1}}),/writes_paused/);
   assert.deepEqual(await rpc(host,'commit_party',{p_operation_id:f.createOp,p_expected_revision:0,p_party:f.party}),f.createReceipt);
   assert.deepEqual(await read(),before);
   check('Committed staging pause denies new host/guest writes and preserves reads/data; original create receipt still replays');
  } else if(mode==='enabled'){
   for(const who of [reader,host,stranger,guest]){
    for(const table of ['parties','party_items','party_rsvps']){
     assert.ok((await who.from(table).select('*').limit(1)).error,'Raw enumeration must fail');
     assert.ok((await who.from(table).delete().eq(table==='parties'?'id':'party_id',f.partyId)).error,'Legacy deletion must fail');
    }
   }
   await denied(stranger.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:before.revision,p_party:{...before,hostId:f.hostId,title:'Stranger attack'}}),/host_access_required/);
   await denied(stranger.rpc('partyplus_v2_delete_party',{p_party_id:f.partyId,p_operation_id:randomUUID()}),/host_access_required/);
   await denied(guest.rpc('partyplus_v2_delete_party',{p_party_id:f.partyId,p_operation_id:randomUUID()}),/verified_host_required/);
   assert.deepEqual(await read(),before);
   assert.deepEqual(await rpc(stranger,'list_host_parties',{}),[]);
   check('Host, guest, stranger and unsigned legacy reads/deletes denied; no partial loss; forged host ID grants no access');
   const receipt=await rpc(host,'commit_party',{p_operation_id:randomUUID(),p_expected_revision:before.revision,p_party:before});
   assert.equal(receipt.committed,true);
   check('Exact committed enable gate permits only authorized verified host writes');
  } else {
   const response=before.rsvps.find(r=>r.name==='Android Guest');assert.ok(response);assert.equal(response.attendeeCount,2);
   assert.equal(before.items.find(i=>i.id===f.itemId).claimedByUserId,response.id);
   assert.equal(before.items.filter(i=>i.name==='Android Cups').length,1);
   check('Independent verified host sees physical Android RSVP/2, same-principal claim and one suggestion');
   if(mode==='web-check'){
    const web=before.rsvps.filter(r=>r.name==='Desktop Guest');assert.equal(web.length,1);assert.equal(web[0].attendeeCount,1);assert.notEqual(web[0].id,response.id);
    check('Independent web and phone principals retain separate RSVP rows; original phone claim is unchanged');
   }
   if(mode==='phone-host-edit'){
    const after=(await rpc(host,'commit_party',{p_operation_id:randomUUID(),p_expected_revision:before.revision,p_party:{...before,title:'Android Host Reviewed'}})).party;
    assert.deepEqual(after.rsvps,before.rsvps);assert.deepEqual(after.items,before.items);
    check('Host title edit preserves exact physical guest rows, claims and suggestions');
   }
  }
 }
 evidence.status='passed';evidence.partyId=f.partyId;
} catch(e){evidence.status='failed';evidence.failure=e.message;throw e;}
finally {
 evidence.finishedAt=new Date().toISOString();
 await fs.mkdir('docs/cutover-evidence-2026-10-03',{recursive:true});
 await fs.writeFile('docs/cutover-evidence-2026-10-03/http-'+mode+'.json',JSON.stringify(evidence,null,2)+'\n');
 for(const who of [host,stranger,guest])await who.auth.signOut({scope:'local'});
}
