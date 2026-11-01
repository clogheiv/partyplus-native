// Existing STAGING only. Secrets arrive from current-user DPAPI in memory.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {createClient} from '@supabase/supabase-js';
const [mode='verify']=process.argv.slice(2);assert.ok(['create-bucket','verify','check-delete'].includes(mode));
const root=path.resolve(process.env.PARTYPLUS_BACKEND_DEPENDENCIES??'.'),ref='qmbwrbxbbshbavfhkujx';
const config=JSON.parse(await fs.readFile(path.join(root,'.test-cache/staging-credentials.json'),'utf8'));
assert.equal(config.url,`https://${ref}.supabase.co`);
const keys=JSON.parse(process.env.PARTYPLUS_STAGING_KEY_ROWS??'null');delete process.env.PARTYPLUS_STAGING_KEY_ROWS;
const service=keys.find(k=>k.name==='service_role')?.api_key;assert.ok(service);
const claims=JSON.parse(Buffer.from(service.split('.')[1],'base64url'));assert.equal(claims.ref,ref);assert.equal(claims.role,'service_role');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const client=()=>createClient(config.url,config.publishableKey,options),admin=createClient(config.url,service,options);
const bucket='partyplus-party-images';
const ok=async pending=>{const result=await pending;assert.equal(result.error,null);return result.data;};
const bucketConfig=JSON.parse(await fs.readFile('supabase/appearance/bucket-config.json','utf8'));
if(mode==='create-bucket'){
 const current=await admin.storage.getBucket(bucket);
 if(current.error){assert.ok([400,404].includes(current.error.status)&&/bucket.*not found/i.test(current.error.message));await ok(admin.storage.createBucket(bucket,{public:true,fileSizeLimit:1500000,allowedMimeTypes:['image/jpeg']}));}
 const saved=await ok(admin.storage.getBucket(bucket));
 assert.equal(saved.public,true);assert.equal(Number(saved.file_size_limit),bucketConfig.fileSizeLimit);assert.deepEqual(saved.allowed_mime_types,['image/jpeg']);
 const result={at:new Date().toISOString(),projectRef:ref,bucket,public:true,fileSizeLimit:1500000,allowedMimeTypes:['image/jpeg'],productionAccessed:false,createdOrVerifiedViaStorageApi:true};
 await fs.writeFile('docs/appearance-evidence-2026-11-01/staging-bucket.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}else if(mode==='check-delete'){
 const vault=JSON.parse(process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS??'null');delete process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS;assert.equal(vault.ref,ref);
 const fixture=JSON.parse(await fs.readFile('.test-cache/appearance-ui-fixture.json','utf8'));
 const other=client(),account=vault.accounts[1];
 const signed=await ok(other.auth.signInWithPassword({email:account.email,password:account.password}));assert.equal(signed.user.id,account.id);
 const intent=await other.rpc('partyplus_web_begin_image_removal',{p_image_id:fixture.imageId});assert.equal(intent.error?.code,'42501');
 // RLS may return an empty successful remove; authoritative owner metadata must
 // prove that the unauthorized request did not remove the referenced object.
 await other.storage.from(bucket).remove([fixture.imageId+'.jpg']);
 const objects=await ok(admin.storage.from(bucket).list('',{limit:100}));assert.ok(objects.some(o=>o.name===fixture.imageId+'.jpg'));
 const result={at:new Date().toISOString(),projectRef:ref,productionAccessed:false,crossHostRemovalIntentDenied:true,crossHostStorageDeleteDidNotRemoveObject:true};
 await fs.writeFile('docs/appearance-evidence-2026-11-01/staging-cross-host-delete.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));await other.auth.signOut({scope:'local'});
}else{
 const vault=JSON.parse(process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS??'null');delete process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS;assert.equal(vault.ref,ref);
 const host=client(),stranger=client(),returned=client(),guest=client(),unsigned=client();
 const login=async(c,a)=>{const signed=await ok(c.auth.signInWithPassword({email:a.email,password:a.password}));assert.equal(signed.user.id,a.id);assert.ok(signed.user.email_confirmed_at);};
 await login(host,vault.accounts[0]);await login(stranger,vault.accounts[1]);
 const bytes=await fs.readFile('.test-cache/appearance-test.jpg');assert.equal(bytes[0],255);assert.equal(bytes[1],216);assert.ok(bytes.length<1500000);
 const hash=createHash('sha256').update(bytes).digest('hex'),partyId=randomUUID(),imageId=randomUUID(),itemId=randomUUID();
 const evidence={at:new Date().toISOString(),projectRef:ref,productionAccessed:false,customerDataUsed:false,syntheticPartyId:partyId,checks:{}};
 const prepare=(c,id,byteSize=bytes.length,digest=hash)=>ok(c.rpc('partyplus_web_prepare_image',{p_party_id:partyId,p_image_id:id,p_byte_size:byteSize,p_sha256:digest}));
 const read=c=>ok(c.rpc('partyplus_web_read_party',{p_party_id:partyId}));
 const upload=(c,id,data=bytes,type='image/jpeg',upsert=false)=>c.storage.from(bucket).upload(id+'.jpg',data,{contentType:type,cacheControl:'60',upsert});
 const retire=async id=>{await ok(host.rpc('partyplus_web_begin_image_removal',{p_image_id:id}));const removed=await host.storage.from(bucket).remove([id+'.jpg']);assert.ok(!removed.error||removed.error.status===404);await ok(host.rpc('partyplus_web_release_image',{p_image_id:id}));};
 assert.equal(await read(unsigned),null);const slot=await prepare(host,imageId);assert.equal(slot.bucket,bucket);assert.equal(slot.path,imageId+'.jpg');assert.equal(await read(unsigned),null);
 evidence.checks.unsavedReservationCreatesNoParty=true;
 await ok(upload(host,imageId));
 const url=unsigned.storage.from(bucket).getPublicUrl(imageId+'.jpg').data.publicUrl;
 const fetched=await fetch(url);assert.equal(fetched.status,200);assert.equal(createHash('sha256').update(Buffer.from(await fetched.arrayBuffer())).digest('hex'),hash);
 evidence.checks.publicGuestGetWithoutAccountReturnsExactJpeg=true;
 const look={version:1,design:'birthday',layout:'photo',accent:'orchid',font:'editorial',artwork:'balloons',image:{id:imageId,positionX:62,positionY:35,zoom:1.4}};
 const payload={id:partyId,title:'Synthetic appearance upload verification',items:[{id:itemId,name:'Dessert',qty:'Serves 12'}],appearance:look};
 const created=await ok(host.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:0,p_party:payload}));assert.deepEqual(created.party.appearance,look);
 assert.deepEqual((await read(unsigned)).appearance,look);await login(returned,vault.accounts[0]);assert.deepEqual((await read(returned)).appearance,look);
 const list=await ok(returned.rpc('partyplus_web_list_my_parties'));assert.deepEqual(list.hosting.find(p=>p.id===partyId).appearance,look);
 evidence.checks.savedAppearanceReturnsAcrossHostSessionGuestInviteAndMyParties=true;
 for(const c of [unsigned,host,stranger]){const listed=await c.storage.from(bucket).list('',{limit:100});assert.ok(listed.error||!listed.data?.length);}
 evidence.checks.bucketListingDeniedForGuestHostAndStranger=true;
 assert.ok((await upload(stranger,imageId)).error);assert.ok((await upload(host,imageId,Buffer.from('replacement'),'image/jpeg',true)).error);
 const retained=await fetch(url);assert.equal(createHash('sha256').update(Buffer.from(await retained.arrayBuffer())).digest('hex'),hash);
 assert.ok((await stranger.rpc('partyplus_web_prepare_image',{p_party_id:partyId,p_image_id:randomUUID(),p_byte_size:bytes.length,p_sha256:hash})).error);
 evidence.checks.crossHostWriteAndOverwriteDenied=true;
 const oversized=randomUUID();await prepare(host,oversized,1500000,'b'.repeat(64));assert.ok((await upload(host,oversized,Buffer.alloc(1500001),'image/jpeg')).error);await retire(oversized);
 const wrongMime=randomUUID();await prepare(host,wrongMime,bytes.length);assert.ok((await upload(host,wrongMime,bytes,'image/svg+xml')).error);await retire(wrongMime);
 evidence.checks.bucketRejectsOversizeAndUnapprovedMime=true;
 await ok(guest.auth.signInAnonymously());await ok(guest.rpc('partyplus_v2_rsvp',{p_party_id:partyId,p_operation_id:randomUUID(),p_response:{name:'Synthetic Appearance Guest',status:'yes',attendeeCount:2}}));
 await ok(guest.rpc('partyplus_v2_claim_item',{p_party_id:partyId,p_item_id:itemId,p_claim:true,p_operation_id:randomUUID()}));
 const current=await read(host);const edited=await ok(host.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:current.revision,p_party:{id:partyId,title:'Synthetic legacy-client edit',items:[]}}));assert.deepEqual(edited.party.appearance,look);assert.equal((await read(guest)).items[0].isMine,true);
 evidence.checks.oldClientEditRetainsPhotoAndGuestClaim=true;
 const deniedRemoval=await host.rpc('partyplus_web_begin_image_removal',{p_image_id:imageId});assert.ok(deniedRemoval.error);assert.match(deniedRemoval.error.message,/image_in_use/);
 const replacement=randomUUID();await prepare(host,replacement);await ok(upload(host,replacement));
 const latest=await read(host),nextLook={...look,image:{...look.image,id:replacement}};
 await ok(host.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:latest.revision,p_party:{id:partyId,title:latest.title,items:[],appearance:nextLook}}));
 await retire(imageId);
 const authoritative=await ok(admin.storage.from(bucket).list('',{limit:100}));assert.ok(!authoritative.some(o=>o.name===imageId+'.jpg'));assert.ok(authoritative.some(o=>o.name===replacement+'.jpg'));
 assert.deepEqual((await read(unsigned)).appearance,nextLook);assert.equal((await read(guest)).items[0].isMine,true);
 evidence.checks.referencedPhotoRemovalDeniedAndReplacementCleanupConfirmed=true;
 evidence.publicUrlRevocationIsNotClaimed=true;evidence.completedAt=new Date().toISOString();
 await fs.writeFile('docs/appearance-evidence-2026-11-01/staging-storage-api.json',JSON.stringify(evidence,null,2)+'\n');
 await fs.writeFile('.test-cache/appearance-ui-fixture.json',JSON.stringify({partyId,imageId:replacement},null,2)+'\n');
 console.log(JSON.stringify(evidence,null,2));for(const c of [host,stranger,returned,guest])await c.auth.signOut({scope:'local'});
}
