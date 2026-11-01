import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID,webcrypto} from 'node:crypto';
import ts from 'typescript';
import {loadTs} from './load-ts.mjs';
const id='10667f51-1e84-4784-b2ba-895b86d91fa0';
const photo=new Blob([Uint8Array.from([255,216,255,224,1,2,3])],{type:'image/jpeg'});
function setup({anonymous=false,slotOverride={},uploadError,uploadThrows=false,stored=photo,prepareDenied=false}={}){
 const calls=[],storage=new Map([['partyplus.web.v1.editor','{"title":"Keep my photo draft"}']]);
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'host-1',is_anonymous:anonymous,email:'test@example.invalid'}}}})},rpc:async(name,args)=>{calls.push([name,args]);return prepareDenied?{error:{code:'42501',message:'not_allowed'}}:{data:{imageId:id,bucket:'partyplus-party-images',path:id+'.jpg',...slotOverride}};},storage:{from:bucket=>({upload:async(path,body,options)=>{calls.push(['upload',{bucket,path,body,options}]);if(uploadThrows)throw Error('network unavailable');return {error:uploadError??null};}})}};
 const mod={exports:{}};
 const context=vm.createContext({exports:mod.exports,module:mod,require:specifier=>specifier==='@supabase/supabase-js'?{createClient:()=>client}:loadTs(specifier.includes('partyErrors')?'src/lib/partyErrors.ts':'src/lib/partyValidation.ts'),__PARTYPLUS_WEB_CONFIG__:{environment:'staging',url:'https://fixture.supabase.co',key:'public'},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{locks:{request:async(_key,run)=>run()}},crypto:{randomUUID,subtle:webcrypto.subtle},Uint8Array,AbortSignal,fetch:async url=>{calls.push(['fetch',url]);return new Response(stored);}});
 vm.runInContext(ts.transpileModule(fs.readFileSync('web/src/api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {api:mod.exports.api,calls,storage,client};
}
test('prepared photo upload is host-gated, slot-bound and immutable, with no bytes or photo in localStorage',async()=>{
 const h=setup();await h.api.uploadPartyPhoto('party-1',id,photo);
 const prepare=h.calls[0];assert.equal(prepare[0],'partyplus_web_prepare_image');assert.equal(prepare[1].p_byte_size,photo.size);assert.match(prepare[1].p_sha256,/^[a-f0-9]{64}$/);
 assert.equal(h.calls[1][1].options.upsert,false);assert.equal(h.calls[1][1].options.contentType,'image/jpeg');assert.equal(h.calls[1][1].path,id+'.jpg');
 assert.equal(h.storage.size,2);assert.equal(h.storage.get('partyplus.web.v1.editor'),'{"title":"Keep my photo draft"}');
 assert.deepEqual(JSON.parse(h.storage.get('partyplus.web.v1.uploadedPhotos')),[{principal:'host-1',partyId:'party-1',imageId:id}]);
 const guest=setup({anonymous:true});await assert.rejects(guest.api.uploadPartyPhoto('p',id,photo),/Verify your email/);assert.equal(guest.calls.length,0);
 const denied=setup({prepareDenied:true});await assert.rejects(denied.api.uploadPartyPhoto('p',id,photo));assert.equal(denied.calls.length,1);
});

test('photo retirement is owner-bound, ordered before Storage removal, and durable until release confirms',async()=>{
 const h=setup();const other=randomUUID();let failRemove=true;
 h.storage.set('partyplus.web.v1.photoCleanup',JSON.stringify([{principal:'another-account',partyId:'their-party',imageId:other}]));
 h.client.rpc=async(name,args)=>{h.calls.push([name,args]);return {data:name==='partyplus_web_release_image'?true:{imageId:id,bucket:'partyplus-party-images',path:id+'.jpg'}};};
 h.client.storage.from=bucket=>({remove:async paths=>{h.calls.push(['remove',{bucket,paths}]);return {error:failRemove?{message:'network'}:null};}});
 assert.equal(await h.api.finalizePartyPhotos('p',undefined,id),1);
 assert.deepEqual(h.calls.map(call=>call[0]),['partyplus_web_begin_image_removal','remove']);
 assert.equal(JSON.parse(h.storage.get('partyplus.web.v1.photoCleanup')).length,2);
 failRemove=false;h.calls.length=0;assert.equal(await h.api.retryPhotoCleanup(),0);
 assert.deepEqual(h.calls.map(call=>call[0]),['partyplus_web_begin_image_removal','remove','partyplus_web_release_image']);
 assert.equal(JSON.parse(h.storage.get('partyplus.web.v1.photoCleanup'))[0].principal,'another-account');
});

test('media capacity feedback keeps the draft and suggests gallery artwork without a hosting paywall',async()=>{
 const h=setup();h.client.rpc=async()=>({error:{code:'P0001',message:'image_capacity_reached'}});
 await assert.rejects(h.api.uploadPartyPhoto('p',id,photo),/gallery artwork.*draft is preserved/);
 assert.equal(h.storage.get('partyplus.web.v1.editor'),'{"title":"Keep my photo draft"}');
});
test('upload response loss and duplicate retries succeed only when the exact existing public bytes hash-match',async()=>{
 for(const options of [{uploadError:{statusCode:'409'}},{uploadThrows:true}]){const h=setup(options);await h.api.uploadPartyPhoto('p',id,photo);assert.equal(h.calls.filter(c=>c[0]==='fetch').length,1);}
 const different=setup({uploadError:{statusCode:'409'},stored:new Blob([Uint8Array.from([255,216,255,224,9,9,9])])});
 await assert.rejects(different.api.uploadPartyPhoto('p',id,photo),/could not be confirmed/);assert.equal(different.storage.size,1);
});
test('unsafe slot paths, unexpected buckets, unsupported bytes and a pending party mutation never upload',async()=>{
 for(const slotOverride of [{path:'someone-else.jpg'},{bucket:'different-bucket'},{imageId:randomUUID()}]){const h=setup({slotOverride});await assert.rejects(h.api.uploadPartyPhoto('p',id,photo),/authorize/);assert.equal(h.calls.length,1);}
 const invalid=setup();await assert.rejects(invalid.api.uploadPartyPhoto('p',id,new Blob(['<svg/>'],{type:'image/jpeg'})),/not a JPEG/);assert.equal(invalid.calls.length,0);
 invalid.storage.set('partyplus.web.v1.pending.p','{"principal":"host-1"}');await assert.rejects(invalid.api.uploadPartyPhoto('p',id,photo),/pending/);assert.equal(invalid.calls.length,0);
 assert.equal(invalid.api.partyPhotoUrl('../secret'),undefined);assert.match(invalid.api.partyPhotoUrl(id),new RegExp('/'+id+'\\.jpg$'));
});
