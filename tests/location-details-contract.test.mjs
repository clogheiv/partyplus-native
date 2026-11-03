import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {backendHarness,users} from './backend-harness.mjs';
const look={version:1,design:'holiday',layout:'illustrated',accent:'forest',font:'classic',artwork:'evergreen'};
const details={version:1,streetAddress:'123 Synthetic Lane',city:'Testville',zipCode:'12345-6789'};
test('structured location keeps legacy, appearance, guest state and durable receipts',async t=>{
 const h=await backendHarness({observed:true});t.after(()=>h.close());
 await h.db.exec(await fs.readFile('supabase/web-rebuild/01-browser-contract.sql','utf8'));
 await h.db.exec(await fs.readFile('supabase/web-rebuild/02-invitation-address.sql','utf8'));
 await h.db.exec(`create schema storage;create table storage.objects(bucket_id text,name text,metadata jsonb);
 alter table storage.objects enable row level security;
 create function storage.allow_any_operation(text[]) returns boolean language sql as $$select false$$;`);
 await h.db.exec(await fs.readFile('supabase/appearance/01-appearance-contract.sql','utf8'));
 const rpc=(uid,name,args=[],role=uid?'authenticated':'anon')=>h.transaction(uid,role,async tx=>(await tx.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') value',args)).rows[0].value);
 const commit=(uid,p,rev=0,op=randomUUID())=>rpc(uid,'partyplus_v2_commit_party',[op,rev,p]);
 const read=(uid,id)=>rpc(uid,'partyplus_web_read_party',[id]);
 const id=randomUUID(),item=randomUUID(),oldOp=randomUUID();
 const oldPayload={id,title:'Legacy unparsed address',location:'The community room, ask at front desk',items:[{id:item,name:'Dessert'}],appearance:look};
 const oldReceipt=await commit(users.host,oldPayload,0,oldOp);
 await h.db.query('update public.parties set address=$1 where id=$2',['Apt 4B, 123 Old St; Somewhere 01234 (rear entrance)',id]);
 await rpc(users.guestA,'partyplus_v2_rsvp',[id,randomUUID(),{name:'Synthetic Guest',status:'yes',attendeeCount:2}]);
 await rpc(users.guestA,'partyplus_v2_claim_item',[id,item,true,randomUUID()]);
 const originals=(await h.db.query('select to_jsonb(p) p from public.parties p')).rows;
 const oldReceipts=(await h.db.query('select to_jsonb(o) o from partyplus_private.operations o order by operation_id')).rows;
 await h.db.exec(await fs.readFile('supabase/location-details/production-guarded.sql','utf8'));
 await t.test('migration preserves every original party field and historical receipt',async()=>{
  assert.deepEqual((await h.db.query("select to_jsonb(p)-'location_details' p from public.parties p")).rows,originals);
  assert.deepEqual((await h.db.query('select to_jsonb(o) o from partyplus_private.operations o order by operation_id')).rows,oldReceipts);
  assert.deepEqual(await commit(users.host,oldPayload,0,oldOp),oldReceipt);
  const p=await read(null,id);assert.equal(p.locationDetails,null);assert.equal(p.location,oldPayload.location);assert.equal(p.address,'Apt 4B, 123 Old St; Somewhere 01234 (rear entrance)');
 });
 await t.test('verified host roundtrip, receipt, list, guest read preserve appearance and claims',async()=>{
  const p=await read(users.host,id),op=randomUUID(),payload={id,title:p.title,items:[],location:p.location,locationDetails:details};
  const saved=await commit(users.host,payload,p.revision,op);assert.deepEqual(saved.party.locationDetails,details);
  assert.deepEqual(await commit(users.host,payload,p.revision,op),saved);
  assert.deepEqual((await read(null,id)).locationDetails,details);
  const lists=await rpc(users.host,'partyplus_web_list_my_parties');assert.deepEqual(lists.hosting.find(p=>p.id===id).locationDetails,details);
  assert.deepEqual(saved.party.appearance,look);assert.equal(saved.party.rsvps[0].attendeeCount,2);assert.equal((await read(users.guestA,id)).items[0].isMine,true);
  assert.equal(saved.party.location,oldPayload.location);assert.equal(saved.party.address,'Apt 4B, 123 Old St; Somewhere 01234 (rear entrance)');
 });
 await t.test('old client omission preserves structured value; explicit blank stays explicit',async()=>{
  let p=await read(users.host,id);p=(await commit(users.host,{id,title:'Old client edit',location:p.location,items:[]},p.revision)).party;assert.deepEqual(p.locationDetails,details);
  p=(await commit(users.host,{id,title:p.title,location:p.location,items:[],locationDetails:null},p.revision)).party;assert.deepEqual(p.locationDetails,details);
  const empty={version:1,streetAddress:'',city:'',zipCode:''};p=(await commit(users.host,{id,title:p.title,location:p.location,items:[],locationDetails:empty},p.revision)).party;assert.deepEqual(p.locationDetails,empty);assert.equal(p.address,'Apt 4B, 123 Old St; Somewhere 01234 (rear entrance)');
 });
 await t.test('strict version, exact keys, strings and bounds fail atomically',async()=>{
  const p=await read(users.host,id);
  for(const value of [{}, {...details,version:'1'},{...details,version:2},{...details,country:'guess'}, {...details,city:123},{...details,streetAddress:'x'.repeat(301)},{...details,city:'x'.repeat(121)},{...details,zipCode:'x'.repeat(21)},{...details,city:'line\nbreak'}]){
   await assert.rejects(commit(users.host,{id,title:'Must roll back',items:[],locationDetails:value},p.revision),/invalid_location_details/);assert.deepEqual(await read(users.host,id),p);
  }
 });
 await t.test('host ownership, raw access and revision protection are unchanged',async()=>{
  const p=await read(users.host,id);
  for(const uid of [users.otherHost,users.guestA,users.unverified])await assert.rejects(commit(uid,{id,title:p.title,items:[],locationDetails:details},p.revision),{code:'42501'});
  await assert.rejects(commit(users.host,{id,title:p.title,items:[],locationDetails:details},p.revision-1),/revision_conflict/);
  await assert.rejects(h.transaction(users.host,'authenticated',tx=>tx.query('select * from public.parties')),{code:'42501'});
  await assert.rejects(h.transaction(users.host,'authenticated',tx=>tx.query('select partyplus_private.commit_party_before_location_details($1,0,$2)',[randomUUID(),{}])),{code:'42501'});
  const guest=await read(null,id);assert.equal(Object.hasOwn(guest,'hostId'),false);assert.deepEqual(guest.rsvps,[]);assert.equal(Object.hasOwn(guest.items[0],'claimedByUserId'),false);
 });
});
