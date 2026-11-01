import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {loadTs} from './load-ts.mjs';
const party={id:'party-1',title:'A gathering',revision:1,items:[],rsvps:[],createdAt:'2026-10-31',updatedAt:'2026-10-31'};
function setup({storage=new Map(),rpc,anonymous=false}={}){
 const calls=[];let user={id:'principal-1',is_anonymous:anonymous,email:anonymous?undefined:'test@example.invalid'};
 const client={auth:{getSession:async()=>({data:{session:user?{user}:null}}),signInAnonymously:async()=>{user={id:'guest-1',is_anonymous:true};return {data:{user}};},updateUser:async args=>{calls.push(['updateUser',args]);return {};},signInWithOtp:async args=>{calls.push(['signInWithOtp',args]);return {};},verifyOtp:async args=>{calls.push(['verifyOtp',args]);return {};},signOut:async()=>{user=null;return {};}},rpc:async(name,args)=>{calls.push([name,args]);return rpc?rpc(name,args):{data:{committed:true,operationId:args.p_operation_id,party}};}};
 const mod={exports:{}};
 const context=vm.createContext({exports:mod.exports,module:mod,require:specifier=>specifier==='@supabase/supabase-js'?{createClient:()=>client}:loadTs(specifier.includes('partyErrors')?'src/lib/partyErrors.ts':'src/lib/partyValidation.ts'),__PARTYPLUS_WEB_CONFIG__:{environment:'staging',url:'https://example.invalid',key:'public'},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{locks:{request:async(_key,run)=>run()}},crypto:{randomUUID}});
 const output=ts.transpileModule(fs.readFileSync('web/src/api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInContext(output,context);return {api:mod.exports.api,calls,storage,setUser:value=>{user=value;}};
}
test('unconfirmed host save survives reload and retries exact operation; conflicting draft is not sent',async()=>{
 const storage=new Map();const first=setup({storage,rpc:async()=>({error:{message:'network unavailable'}})});
 await assert.rejects(first.api.saveParty({...party,revision:0}),/confirm/);
 assert.equal(first.api.hasPending(party.id),true);
 const resumed=setup({storage});
 await assert.rejects(resumed.api.saveParty({...party,title:'Different',revision:0}),/pending/);
 assert.equal(resumed.calls.length,0);
 await resumed.api.retry(party.id);
 assert.equal(resumed.calls[0][1].p_operation_id,first.calls[0][1].p_operation_id);
 assert.equal(resumed.api.hasPending(party.id),false);
});
test('pending operation refuses a different identity after sign-in',async()=>{
 const instance=setup({rpc:async()=>({error:{message:'network unavailable'}})});
 await assert.rejects(instance.api.rsvp(party.id,{name:'Guest',status:'yes',attendeeCount:2}));
 instance.setUser({id:'principal-2',is_anonymous:false});
 await assert.rejects(instance.api.retry(party.id),/account that started/);
 assert.equal(instance.calls.length,1);
});
test('anonymous email conversion uses updateUser and email_change to preserve membership identity',async()=>{
 const instance=setup({anonymous:true});
 await instance.api.sendCode('guest@example.invalid');await instance.api.verifyCode('guest@example.invalid','12345678');
 assert.equal(instance.calls[0][0],'updateUser');assert.equal(instance.calls[1][1].type,'email_change');
});
test('anonymous hosts cannot send create; draft remains available',async()=>{
 const instance=setup({anonymous:true});instance.api.storeDraft(party);
 await assert.rejects(instance.api.saveParty(party),/Sign in/);
 assert.equal(instance.calls.length,0);assert.equal(instance.api.loadDraft().id,party.id);
});
test('definite rejection archives operation and allows revised input',async()=>{
 let reject=true;const instance=setup({rpc:async(_name,args)=>reject?{error:{code:'P0001',message:'revision_conflict'}}:{data:{committed:true,operationId:args.p_operation_id,party}}});
 await assert.rejects(instance.api.saveParty(party));assert.equal(instance.api.hasPending(party.id),false);
 reject=false;await instance.api.saveParty({...party,revision:2});assert.equal(instance.calls.length,2);
});
test('measurement has no party identity, names, links, or delivery claim; telemetry failure is isolated',async()=>{
 const instance=setup({rpc:async()=>({error:{message:'network unavailable'}})});
 await instance.api.track('invitation_link_copied','private-party');
 assert.deepEqual(Object.keys(instance.calls[0][1]).sort(),['p_event_id','p_kind']);
});

test('appearance save is not acknowledged when a backend drops it; exact pending payload remains retryable',async()=>{
 const appearance={version:1,design:'birthday',layout:'illustrated',accent:'orchid',font:'editorial',artwork:'balloons'};
 const h=setup();await assert.rejects(h.api.saveParty({...party,appearance}),/did not confirm.*appearance/);
 assert.equal(h.api.hasPending(party.id),true);
 const pending=JSON.parse(h.storage.get('partyplus.web.v1.pending.'+party.id));assert.deepEqual(pending.args.p_party.appearance,appearance);
});

test('appearance receipts accept canonical server key order and preserve the same photo crop in a saved retry',async()=>{
 const appearance={version:1,design:'casual',layout:'photo',accent:'cobalt',font:'modern',artwork:'confetti',image:{id:'10667f51-1e84-4784-b2ba-895b86d91fa0',positionX:72,positionY:24,zoom:1.25}};
 const h=setup({rpc:async(_name,args)=>({data:{committed:true,operationId:args.p_operation_id,party:{...party,appearance:{image:{zoom:1.25,positionY:24,positionX:72,id:appearance.image.id},artwork:'confetti',font:'modern',accent:'cobalt',layout:'photo',design:'casual',version:1}}}})});
 const saved=await h.api.saveParty({...party,appearance});assert.equal(saved.appearance.image.positionX,72);assert.equal(h.api.hasPending(party.id),false);
});
