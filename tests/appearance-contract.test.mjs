import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {backendHarness,users} from './backend-harness.mjs';
const appearance={version:1,design:'partyplus',layout:'illustrated',accent:'navy',font:'editorial',artwork:'partyplus'};
async function storageFixture(db){
 await db.exec(`create schema storage;
   create table storage.objects(bucket_id text,name text,metadata jsonb,primary key(bucket_id,name));
   alter table storage.objects enable row level security;
   grant usage on schema storage to anon,authenticated;
   grant select,insert,update,delete on storage.objects to anon,authenticated;
   create function storage.allow_any_operation(names text[]) returns boolean language sql stable as
     $$select replace(coalesce(current_setting('storage.operation',true),''),'storage.','')=any(names)$$;
 `);
}

test('appearance contract, upload reservations, and Storage boundaries',async t=>{
 const h=await backendHarness({observed:true});t.after(()=>h.close());
 await h.db.exec(await fs.readFile('supabase/web-rebuild/01-browser-contract.sql','utf8'));
 await h.db.exec(await fs.readFile('supabase/web-rebuild/02-invitation-address.sql','utf8'));
 // Simulated Storage metadata only. Real Storage object/bucket operations always
 // use its HTTP API; a separate hosted staging check qualifies that boundary.
 await storageFixture(h.db);
 const rpc=(uid,name,args=[],role='authenticated')=>h.transaction(uid,role,async tx=>{
  assert.match(name,/^partyplus_(v2|web)_[a-z_]+$/);
  return (await tx.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as value',args)).rows[0].value;
 });
 const commit=(uid,party,revision=0,op=randomUUID())=>rpc(uid,'partyplus_v2_commit_party',[op,revision,party]);
 const read=(uid,id)=>rpc(uid,'partyplus_web_read_party',[id],uid?'authenticated':'anon');
 const baseId='legacy-appearance-fixture',itemId=randomUUID(),historicOp=randomUUID();
 await commit(users.host,{id:baseId,title:'Preserve existing',items:[{id:itemId,name:'Dessert',qty:'Serves 12'}]});
 const oldResponse={name:'Synthetic Guest',status:'yes',attendeeCount:2};
 const oldReceipt=await rpc(users.guestA,'partyplus_v2_rsvp',[baseId,historicOp,oldResponse]);
 await rpc(users.guestA,'partyplus_v2_claim_item',[baseId,itemId,true,randomUUID()]);
 const before=(await h.db.query('select to_jsonb(p) as p from public.parties p where id=$1',[baseId])).rows[0].p;
 const oldOperations=(await h.db.query('select to_jsonb(o) as o from partyplus_private.operations o order by operation_id')).rows;
 await h.db.exec(await fs.readFile('supabase/appearance/01-appearance-contract.sql','utf8'));

 await t.test('additive install changes no original field, receipt, guest response or claim',async()=>{
  const after=(await h.db.query('select to_jsonb(p)-\'appearance\' as p from public.parties p where id=$1',[baseId])).rows[0].p;
  assert.deepEqual(after,before);
  assert.deepEqual((await h.db.query('select to_jsonb(o) as o from partyplus_private.operations o order by operation_id')).rows,oldOperations);
  assert.deepEqual(await rpc(users.guestA,'partyplus_v2_rsvp',[baseId,historicOp,oldResponse]),oldReceipt);
  const p=await read(users.guestA,baseId);assert.equal(p.appearance,null);assert.equal(p.items[0].isMine,true);
 });
 await t.test('host appearance save is atomic; old-client omission preserves it and guest state',async()=>{
  let current=await read(users.host,baseId);
  const first=await commit(users.host,{id:baseId,title:'Styled',items:[],appearance},current.revision);
  assert.deepEqual(first.party.appearance,appearance);assert.equal(first.party.items[0].claimedBy,'Synthetic Guest');
  const edited=await commit(users.host,{id:baseId,title:'Old client edit',items:[]},first.party.revision);
  assert.deepEqual(edited.party.appearance,appearance);assert.equal(edited.party.rsvps.length,1);
  assert.deepEqual((await read(null,baseId)).appearance,appearance);
  const listed=await rpc(users.host,'partyplus_web_list_my_parties');assert.deepEqual(listed.hosting[0].appearance,appearance);
 });
 await t.test('invalid enums, extra CSS/URLs and position values roll back all save effects',async()=>{
  const p=await read(users.host,baseId);
  for(const value of [{...appearance,version:2},{...appearance,layout:'unknown'},{...appearance,accent:'navy;url(evil)'},
   {...appearance,font:'remote-font'},{...appearance,css:'color:red'},
   {...appearance,image:{id:randomUUID(),positionX:-1,positionY:50,zoom:1}},
   {...appearance,image:{id:randomUUID(),positionX:50,positionY:50,zoom:3}}]){
   await assert.rejects(commit(users.host,{id:baseId,title:'Must not save',items:[],appearance:value},p.revision),/invalid_appearance|invalid_image_position/);
   assert.deepEqual(await read(users.host,baseId),p);
  }
 });
 await t.test('guest and stranger cannot edit appearance or bypass the private old core',async()=>{
  const p=await read(users.host,baseId);
  for(const uid of [users.guestA,users.unverified,users.otherHost])await assert.rejects(commit(uid,{id:baseId,title:'Forbidden',items:[],appearance},p.revision),{code:'42501'});
  await assert.rejects(h.transaction(users.host,'authenticated',tx=>tx.query('select * from public.parties')),{code:'42501'});
  await assert.rejects(h.transaction(users.host,'authenticated',tx=>tx.query('select partyplus_private.commit_party_before_appearance($1,0,$2)',[randomUUID(),{}])),{code:'42501'});
 });

 const pendingParty=randomUUID(),imageId=randomUUID(),hash='a'.repeat(64),size=1234;
 const prepare=(uid,pid=pendingParty,id=imageId,bytes=size,digest=hash)=>rpc(uid,'partyplus_web_prepare_image',[pid,id,bytes,digest]);
 await t.test('verified upload reservation binds unsaved party intent without creating a party',async()=>{
  for(const uid of [users.guestA,users.unverified,null])await assert.rejects(prepare(uid),{code:'42501'});
  const count=(await h.db.query('select count(*)::int as n from public.parties')).rows[0].n;
  const reserved=await prepare(users.host);assert.deepEqual(reserved,{imageId,bucket:'partyplus-party-images',path:imageId+'.jpg'});
  assert.deepEqual(await prepare(users.host),reserved);
  assert.equal((await h.db.query('select count(*)::int as n from public.parties')).rows[0].n,count);
  await assert.rejects(prepare(users.otherHost),{code:'42501'});
  await assert.rejects(commit(users.otherHost,{id:pendingParty,title:'Steal pending identity',items:[]}),{code:'42501'});
  await assert.rejects(prepare(users.host,pendingParty,imageId,size+1),/image_operation_conflict/);
  await assert.rejects(prepare(users.host,pendingParty,randomUUID(),1500001),/invalid_image/);
  await assert.rejects(prepare(users.host,pendingParty,randomUUID(),size,'not-a-hash'),/invalid_image/);
 });
 const storageInsert=(uid,name=imageId+'.jpg',metadata={mimetype:'image/jpeg',size})=>h.transaction(uid,'authenticated',tx=>tx.query('insert into storage.objects values($1,$2,$3)',['partyplus-party-images',name,metadata]));
 const withImage={...appearance,layout:'photo',image:{id:imageId,positionX:45,positionY:60,zoom:1.2}};
 await t.test('only the bound verified host inserts the immutable registered image path',async()=>{
  for(const uid of [users.guestA,users.otherHost])await assert.rejects(storageInsert(uid),{code:'42501'});
  await assert.rejects(storageInsert(users.host,randomUUID()+'.jpg'),{code:'42501'});
  await assert.rejects(storageInsert(users.host,imageId+'.png'),{code:'42501'});
  await assert.rejects(commit(users.host,{id:pendingParty,title:'No uploaded object',items:[],appearance:withImage}),/image_upload_required/);
  await storageInsert(users.host,imageId+'.jpg',{mimetype:'image/svg+xml',size});
  await assert.rejects(commit(users.host,{id:pendingParty,title:'Wrong MIME',items:[],appearance:withImage}),/image_upload_required/);
  await h.db.query('update storage.objects set metadata=$1 where name=$2',[{mimetype:'image/jpeg',size:size+1},imageId+'.jpg']);
  await assert.rejects(commit(users.host,{id:pendingParty,title:'Wrong size',items:[],appearance:withImage}),/image_upload_required/);
  await h.db.query('update storage.objects set metadata=$1 where name=$2',[{mimetype:'image/jpeg',size},imageId+'.jpg']);
  const op=randomUUID(),party={id:pendingParty,title:'Photo saved',items:[],appearance:withImage};
  const saved=await commit(users.host,party,0,op);assert.deepEqual(saved.party.appearance,withImage);
  assert.deepEqual(await commit(users.host,party,0,op),saved);
  assert.deepEqual((await read(null,pendingParty)).appearance,withImage);
  const other=randomUUID();await commit(users.host,{id:other,title:'Another own party',items:[]});
  await assert.rejects(commit(users.host,{id:other,title:'Adopt other party photo',items:[],appearance:withImage},1),/image_upload_required/);
 });
 await t.test('bucket listing and overwrites are denied, including by the uploading host',async()=>{
  for(const [uid,role] of [[null,'anon'],[users.guestA,'authenticated'],[users.host,'authenticated']]){
   const listed=await h.transaction(uid,role,async tx=>{
    await tx.query("select set_config('storage.operation','object.list',true)");
    return tx.query('select name from storage.objects');
   });assert.deepEqual(listed.rows,[]);
  }
  const updated=await h.transaction(users.host,'authenticated',tx=>tx.query("update storage.objects set metadata='{}' returning name"));assert.deepEqual(updated.rows,[]);
 });
 await t.test('removal intent prevents deleting a live photo or racing a later re-adoption',async()=>{
  await assert.rejects(rpc(users.host,'partyplus_web_begin_image_removal',[imageId]),/image_in_use/);
  const remove=()=>h.transaction(users.host,'authenticated',async tx=>{
   await tx.query("select set_config('storage.operation','object.delete_many',true)");
   return tx.query('delete from storage.objects where name=$1 returning name',[imageId+'.jpg']);
  });
  assert.deepEqual((await remove()).rows,[]);
  let p=await read(users.host,pendingParty);
  await commit(users.host,{id:pendingParty,title:p.title,items:[],appearance},p.revision);
  await assert.rejects(rpc(users.otherHost,'partyplus_web_begin_image_removal',[imageId]),{code:'42501'});
  await rpc(users.host,'partyplus_web_begin_image_removal',[imageId]);
  p=await read(users.host,pendingParty);
  await assert.rejects(commit(users.host,{id:pendingParty,title:p.title,items:[],appearance:withImage},p.revision),/image_upload_required/);
  await assert.rejects(rpc(users.host,'partyplus_web_release_image',[imageId]),/image_still_exists/);
  assert.equal((await remove()).rows.length,1);
  assert.equal(await rpc(users.host,'partyplus_web_release_image',[imageId]),true);
  assert.equal(await rpc(users.host,'partyplus_web_release_image',[imageId]),true);
  await assert.rejects(prepare(users.host),/image_operation_conflict/);
 });
 await t.test('paused writes reject new reservations and saves but preserve reads and receipt replay',async()=>{
  const p=await read(users.host,baseId),op=randomUUID(),request={id:baseId,title:p.title,items:[],appearance};
  const receipt=await commit(users.host,request,p.revision,op);
  await h.db.exec('update partyplus_private.release_control set writes_enabled=false');
  assert.deepEqual(await commit(users.host,request,p.revision,op),receipt);
  await assert.rejects(prepare(users.host,baseId,randomUUID()),{code:'55000'});
  await assert.rejects(commit(users.host,request,receipt.party.revision),{code:'55000'});
  assert.deepEqual((await read(null,baseId)).appearance,appearance);
 });
 await t.test('photo-specific rollback preserves saved photo reads and ordinary guest/host writes',async()=>{
  await h.db.exec('update partyplus_private.release_control set writes_enabled=true');
  const retained=randomUUID();await prepare(users.host,baseId,retained);
  await storageInsert(users.host,retained+'.jpg');
  const photo={...appearance,layout:'photo',image:{id:retained,positionX:50,positionY:50,zoom:1}};
  const current=await read(users.host,baseId);
  await commit(users.host,{id:baseId,title:current.title,items:[],appearance:photo},current.revision);
  await h.db.exec(await fs.readFile('supabase/appearance/02-pause-new-photo-writes.sql','utf8'));
  assert.deepEqual((await read(null,baseId)).appearance,photo);
  assert.equal((await h.db.query('select count(*)::int n from storage.objects')).rows[0].n,1);
  await assert.rejects(prepare(users.host,baseId,randomUUID()),{code:'42501'});
  await assert.rejects(storageInsert(users.host,randomUUID()+'.jpg'),{code:'42501'});
  const hostView=await read(users.host,baseId);
  const edited=await commit(users.host,{id:baseId,title:'Still editable',items:[]},hostView.revision);
  assert.deepEqual(edited.party.appearance,photo);
  const response=await rpc(users.guestA,'partyplus_v2_rsvp',[baseId,randomUUID(),oldResponse]);
  assert.equal(response.party.ownRsvp.attendeeCount,2);
 });
});

test('production preservation wrapper runs the exact approved appearance migration atomically',async t=>{
 const h=await backendHarness({observed:true});t.after(()=>h.close());
 await h.db.exec(await fs.readFile('supabase/web-rebuild/01-browser-contract.sql','utf8'));
 await h.db.exec(await fs.readFile('supabase/web-rebuild/02-invitation-address.sql','utf8'));
 await storageFixture(h.db);
 await h.rpc(users.host,'partyplus_v2_commit_party',[randomUUID(),0,{id:'existing-preserved-party',title:'Retain original',items:[]}]);
 const original=(await h.db.query('select to_jsonb(p) p from public.parties p')).rows[0].p;
 await h.db.exec(await fs.readFile('supabase/appearance/production-guarded.sql','utf8'));
 const after=(await h.db.query("select to_jsonb(p)-'appearance' p from public.parties p")).rows[0].p;
 assert.deepEqual(after,original);
 assert.equal((await h.db.query('select writes_enabled from partyplus_private.release_control where singleton')).rows[0].writes_enabled,true);
});
