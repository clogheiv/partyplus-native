// Disposable STAGING parties only. No production URL or credentials accepted.
import fs from 'node:fs/promises';
import path from 'node:path';
import tls from 'node:tls';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
const root=path.resolve(process.env.PARTYPLUS_BACKEND_DEPENDENCIES??'.');
const ref='qmbwrbxbbshbavfhkujx';
const config=JSON.parse(await fs.readFile(path.join(root,'.test-cache/staging-credentials.json'),'utf8'));
assert.equal(config.url,`https://${ref}.supabase.co`);
const vault=JSON.parse(process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS??'null');delete process.env.PARTYPLUS_STAGING_REVIEW_ACCOUNTS;assert.equal(vault.ref,ref);
const password=process.env.PARTYPLUS_STAGING_DB_PASSWORD;delete process.env.PARTYPLUS_STAGING_DB_PASSWORD;assert.ok(password);
const pg=createRequire(path.join(root,'package.json'))('pg');
const db=new pg.Client({host:'aws-0-us-east-1.pooler.supabase.com',port:5432,user:`postgres.${ref}`,password,database:'postgres',ssl:{rejectUnauthorized:true,ca:[...tls.rootCertificates,await fs.readFile(path.join(root,'.test-cache/production-ca.crt'),'utf8')]},connectionTimeoutMillis:15000});
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const client=()=>createClient(config.url,config.publishableKey,options);
const host=client(),stranger=client(),guest=client(),unsigned=client();
const ok=async request=>{const r=await request;assert.equal(r.error,null);return r.data;};
const deletedId=randomUUID(),uiId=randomUUID(),fixtureIds=[deletedId,uiId];
const snapshot=async()=>{
 const result={};
 for(const [table,filter] of [['public.parties','id <> all($1::text[])'],['public.party_items','party_id <> all($1::text[])'],['public.party_rsvps','party_id <> all($1::text[])'],['partyplus_private.host_access','party_id <> all($1::text[])'],['partyplus_private.memberships','party_id <> all($1::text[])'],['partyplus_private.operations',"coalesce(request->'party'->>'id',request->>'party','') <> all($1::text[])"]]){
  result[table]=(await db.query(`select count(*)::int count,md5(coalesce(string_agg(value,E'\\n' order by value),'')) fingerprint from (select to_jsonb(t)::text value from ${table} t where ${filter}) rows`,[fixtureIds])).rows[0];
 }
 return result;
};
const read=(c,id)=>ok(c.rpc('partyplus_web_read_party',{p_party_id:id}));
try{
 await db.connect();assert.equal(db.connection.stream.authorized,true);
 for(const [c,account] of [[host,vault.accounts[0]],[stranger,vault.accounts[1]]]){const signed=await ok(c.auth.signInWithPassword({email:account.email,password:account.password}));assert.equal(signed.user.id,account.id);assert.ok(signed.user.email_confirmed_at);}
 const baseline=await snapshot();
 const make=async(id,title)=>ok(host.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:0,p_party:{id,title,date:'2026-12-15T18:00:00.000Z',location:'Synthetic staging fixture only',items:[{id:randomUUID(),name:'Disposable dessert',qty:'Serves 2'}]}}));
 await make(deletedId,'Disposable lifecycle RPC deletion verification');
 await make(uiId,'Disposable host manage and confirmation UI verification');
 const before=await read(host,deletedId);assert.equal(before.canEdit,true);assert.equal((await read(stranger,deletedId)).canEdit,false);
 await ok(guest.auth.signInAnonymously());
 await ok(guest.rpc('partyplus_v2_rsvp',{p_party_id:deletedId,p_operation_id:randomUUID(),p_response:{name:'Disposable lifecycle guest',status:'yes',attendeeCount:2}}));
 await ok(guest.rpc('partyplus_v2_claim_item',{p_party_id:deletedId,p_item_id:before.items[0].id,p_claim:true,p_operation_id:randomUUID()}));
 assert.ok((await ok(guest.rpc('partyplus_web_list_my_parties'))).joined.some(p=>p.id===deletedId));
 const denied=await stranger.rpc('partyplus_v2_delete_party',{p_party_id:deletedId,p_operation_id:randomUUID()});assert.equal(denied.error?.code,'42501');assert.ok(await read(unsigned,deletedId));
 const guestDenied=await guest.rpc('partyplus_v2_delete_party',{p_party_id:deletedId,p_operation_id:randomUUID()});assert.equal(guestDenied.error?.code,'42501');
 const operationId=randomUUID(),receipt=await ok(host.rpc('partyplus_v2_delete_party',{p_party_id:deletedId,p_operation_id:operationId}));assert.equal(receipt.deleted,true);assert.equal(receipt.operationId,operationId);
 assert.deepEqual(await ok(host.rpc('partyplus_v2_delete_party',{p_party_id:deletedId,p_operation_id:operationId})),receipt);
 for(const c of [host,stranger,guest,unsigned]){assert.equal(await read(c,deletedId),null);assert.equal(await ok(c.rpc('partyplus_v2_read_party',{p_party_id:deletedId})),null);}
 assert.ok(!(await ok(host.rpc('partyplus_web_list_my_parties'))).hosting.some(p=>p.id===deletedId));
 assert.ok(!(await ok(guest.rpc('partyplus_web_list_my_parties'))).joined.some(p=>p.id===deletedId));
 const lateRsvp=await guest.rpc('partyplus_v2_rsvp',{p_party_id:deletedId,p_operation_id:randomUUID(),p_response:{name:'Disposable lifecycle guest',status:'yes',attendeeCount:3}});assert.ok(lateRsvp.error);
 const tombstone=(await db.query('select deleted_at is not null tombstoned,(select count(*) from public.party_items where party_id=$1)::int items,(select count(*) from public.party_rsvps where party_id=$1)::int rsvps from public.parties where id=$1',[deletedId])).rows[0];assert.equal(tombstone.tombstoned,true);assert.equal(tombstone.items,1);assert.equal(tombstone.rsvps,1);
 const after=await snapshot();assert.deepEqual(after,baseline,'Unrelated staging party records changed');
 const result={at:new Date().toISOString(),projectRef:ref,productionAccessed:false,customerDataUsed:false,deletedSyntheticPartyId:deletedId,retainedUiPartyId:uiId,checks:{verifiedHostOwnsFixture:true,strangerDeleteDenied:true,anonymousGuestDeleteDenied:true,hostDeletionReceiptAndReplayConfirmed:true,unsignedGuestHostAndStrangerReadsGone:true,oldV2InvitationReadGone:true,hostingAndJoinedListsExcludeDeleted:true,newGuestWritesDeniedAfterDelete:true,tombstoneRetainsGuestData:true,unrelatedPartyFingerprintsPreserved:true},unrelatedBefore:baseline,unrelatedAfter:after};
 await fs.writeFile('docs/staging-party-lifecycle-2026-11-01.json',JSON.stringify(result,null,2)+'\n');
 await fs.writeFile('.test-cache/lifecycle-ui-fixture.json',JSON.stringify({partyId:uiId,hostAccountIndex:0},null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}finally{await db.end();for(const c of [host,stranger,guest])await c.auth.signOut({scope:'local'}).catch(()=>{});}
