import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {loadTs} from './load-ts.mjs';
const verified={id:'same-account',email:'host@example.invalid',is_anonymous:false,email_confirmed_at:'2026-01-01'};
function setup({user=null,serverUser=user,signInError,updateError,updatedUser,throwSignIn=false,otpError,throwOtp=false}={}){
 const calls=[],storage=new Map([['partyplus.web.v1.editor','{"title":"Preserve draft"}']]);
 let current=user,options;
 const client={auth:{
  getSession:async()=>({data:{session:current?{user:current}:null},error:null}),
  getUser:async()=>{calls.push(['getUser']);return {data:{user:serverUser},error:null};},
  signInWithPassword:async args=>{calls.push(['signInWithPassword',args]);if(throwSignIn)throw Error('network unavailable');if(signInError)return {data:{user:null,session:null},error:signInError};current=verified;return {data:{user:verified,session:{user:verified}},error:null};},
  signInWithOtp:async args=>{calls.push(['signInWithOtp',args]);if(throwOtp)throw Error('network unavailable');return {error:otpError??null};},
  updateUser:async args=>{calls.push(['updateUser',args]);return {data:{user:updatedUser??serverUser},error:updateError??null};},
  signOut:async()=>{calls.push(['signOut']);current=null;return {error:null};}
 },rpc:async()=>{throw Error('Password actions must not issue party or telemetry RPCs');}};
 const mod={exports:{}};
 const context=vm.createContext({exports:mod.exports,module:mod,require:specifier=>specifier==='@supabase/supabase-js'?{createClient:(_url,_key,config)=>{options=config;return client;}}:loadTs(specifier.includes('partyErrors')?'src/lib/partyErrors.ts':'src/lib/partyValidation.ts'),__PARTYPLUS_WEB_CONFIG__:{environment:'staging',url:'https://example.invalid',key:'public'},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{locks:{request:async(_key,run)=>run()}},crypto:{randomUUID}});
 const output=ts.transpileModule(fs.readFileSync('web/src/api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInContext(output,context);
 return {api:mod.exports.api,calls,storage,options,getUser:()=>current};
}
test('password sign-in uses existing account, retains normal session persistence, and never stores the password',async()=>{
 const h=setup(),password='  synthetic test password  ';
 await h.api.signInWithPassword(' HOST@example.invalid ',password);
 assert.equal(h.calls[0][0],'signInWithPassword');assert.equal(h.calls[0][1].email,'HOST@example.invalid');assert.equal(h.calls[0][1].password,password);
 assert.equal(h.getUser().id,verified.id);assert.equal(h.options.auth.persistSession,true);assert.equal(h.options.auth.autoRefreshToken,true);
 assert.equal(h.storage.get('partyplus.web.v1.editor'),'{"title":"Preserve draft"}');assert.ok(![...h.storage.values()].some(value=>value.includes(password)));
});
test('password sign-in never silently replaces an anonymous or different signed-in account',async()=>{
 for(const user of [{id:'guest',is_anonymous:true},{...verified,email:'different@example.invalid'}]){
  const h=setup({user});await assert.rejects(h.api.signInWithPassword(verified.email,'long enough password'),/guest session|already signed in/);
  assert.equal(h.calls.length,0);assert.equal(h.getUser().id,user.id);
 }
});
test('incorrect email, password, and confirmation errors share generic sign-in feedback',async()=>{
 const messages=[];
 for(const code of ['invalid_credentials','user_not_found','email_not_confirmed']){
  const h=setup({signInError:{code,status:400,message:'Private account details'}});
  await assert.rejects(h.api.signInWithPassword(verified.email,'fake password'),error=>{messages.push(error.message);return /Email or password was not accepted/.test(error.message)&&!error.message.includes('Private');});
 }
 assert.equal(new Set(messages).size,1);
 const offline=setup({throwSignIn:true});await assert.rejects(offline.api.signInWithPassword(verified.email,'fake password'),/connection/);
});
test('setting a password verifies the server principal and changes only that account password',async()=>{
 const h=setup({user:verified}),password='  synthetic password with spaces  ';
 await h.api.setPassword(password);
 assert.deepEqual(h.calls.map(call=>call[0]),['getUser','updateUser']);assert.deepEqual(Object.keys(h.calls[1][1]),['password']);assert.equal(h.calls[1][1].password,password);
 assert.equal(h.storage.get('partyplus.web.v1.editor'),'{"title":"Preserve draft"}');assert.ok(![...h.storage.values()].some(value=>value.includes(password)));
});
test('missing, anonymous, unverified, and mismatched identities cannot set a password',async()=>{
 const cases=[{user:null},{user:{id:'guest',is_anonymous:true}},{user:verified,serverUser:{...verified,email_confirmed_at:null}},{user:verified,serverUser:{...verified,id:'other-principal'}}];
 for(const options of cases){const h=setup(options);await assert.rejects(h.api.setPassword('long enough password'),/Verify/);assert.ok(!h.calls.some(call=>call[0]==='updateUser'));}
 const short=setup({user:verified});await assert.rejects(short.api.setPassword('short'),/at least 8/);assert.equal(short.calls.length,0);
});
test('a changed identity in a password response is not presented as success',async()=>{
 const h=setup({user:verified,updatedUser:{...verified,id:'other-principal'}});
 await assert.rejects(h.api.setPassword('long enough password'),/did not confirm.*current account/);
 assert.ok(!h.calls.some(call=>call[0]==='signOut'));assert.equal(h.getUser().id,verified.id);
});
test('reauthentication and password policy failures keep the account and draft with useful retry instructions',async()=>{
 for(const [error,pattern] of [[{code:'reauthentication_needed',status:422},/Sign in again with an email code/],[{code:'weak_password',status:422},/stronger password/],[{code:'same_password',status:422},/different password/],[{status:429},/Too many attempts/],[{message:'network unavailable'},/Could not confirm the password change/]]){
  const h=setup({user:verified,updateError:error});await assert.rejects(h.api.setPassword('long enough password'),pattern);
  assert.equal(h.getUser().id,verified.id);assert.equal(h.storage.get('partyplus.web.v1.editor'),'{"title":"Preserve draft"}');assert.ok(!h.calls.some(call=>call[0]==='signOut'));
 }
});
test('password recovery requests only an existing account; normal host code requests still allow signup',async()=>{
 const recovery=setup();await recovery.api.sendRecoveryCode(' HOST@example.invalid ');
 assert.equal(recovery.calls[0][0],'signInWithOtp');assert.equal(recovery.calls[0][1].email,'HOST@example.invalid');
 assert.equal(recovery.calls[0][1].options.shouldCreateUser,false);assert.ok(!recovery.calls.some(call=>call[0]==='updateUser'));
 assert.deepEqual(JSON.parse(recovery.storage.get('partyplus.web.v1.authIntent')),{email:'HOST@example.invalid',type:'email'});
 const signup=setup();await signup.api.sendCode('new@example.invalid');assert.equal(signup.calls[0][1].options.shouldCreateUser,true);
});
test('password recovery cannot convert or overwrite an active guest or another signed-in identity',async()=>{
 for(const user of [{id:'guest',is_anonymous:true},{...verified,email:'different@example.invalid'}]){
  const h=setup({user});await assert.rejects(h.api.sendRecoveryCode(verified.email),/guest session|current account email/);
  assert.equal(h.calls.length,0);assert.equal(h.getUser().id,user.id);assert.equal(h.storage.has('partyplus.web.v1.authIntent'),false);
 }
 const same=setup({user:verified});await same.api.sendRecoveryCode(verified.email);assert.equal(same.getUser().id,verified.id);assert.equal(same.calls[0][1].options.shouldCreateUser,false);
});
test('unknown account recovery follows the generic accepted path without creating a session',async()=>{
 for(const code of ['otp_disabled','user_not_found','signup_disabled']){
  const h=setup({otpError:{code,status:422,message:'Private account existence details'}});
  await h.api.sendRecoveryCode('unknown@example.invalid');assert.equal(h.getUser(),null);
  assert.equal(h.calls[0][1].options.shouldCreateUser,false);assert.equal(JSON.parse(h.storage.get('partyplus.web.v1.authIntent')).type,'email');
 }
});
test('recovery transport and service errors never echo private responses or replace stored party drafts',async()=>{
 for(const options of [{throwOtp:true},{otpError:{code:'email_address_not_authorized',status:400,message:'Private provider details'}},{otpError:{status:429}}]){
  const h=setup(options);await assert.rejects(h.api.sendRecoveryCode(verified.email),error=>!/Private/.test(error.message)&&/recovery code|Too many code requests/.test(error.message));
  assert.equal(h.storage.get('partyplus.web.v1.editor'),'{"title":"Preserve draft"}');assert.equal(h.getUser(),null);
 }
});
