import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs,memoryStorage} from './load-ts.mjs';
const {createLocalRepository}=loadTs('src/lib/localRepository.ts');
const {createPartyOutbox}=loadTs('src/lib/partyOutbox.ts');
test('paused guest changes survive restart and retry with the same principal and operation',async()=>{
  const storage=memoryStorage(),store=createLocalRepository(storage);let sent,paused=true;
  const send=async op=>{sent=structuredClone(op);if(paused)throw {code:'55000',message:'writes_paused'};return {id:'party',title:'Party',items:[],revision:2};};
  const first=createPartyOutbox(store,()=> 'stable-operation',async()=> 'guest-principal',send);
  await assert.rejects(first.run('party',{kind:'rsvp',response:{name:'Guest',status:'yes',attendeeCount:2}}),{kind:'paused'});
  const saved=await store.getDraft('outbox:party');assert.equal(saved.operationId,'stable-operation');assert.equal(saved.principalId,'guest-principal');
  paused=false;
  const restarted=createPartyOutbox(createLocalRepository(storage),()=>assert.fail('Retry must not allocate'),async()=> 'guest-principal',send);
  assert.equal((await restarted.run('party')).revision,2);assert.deepEqual(sent,saved);assert.equal(await store.getDraft('outbox:party'),undefined);
});
