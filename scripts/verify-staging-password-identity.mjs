// Same-principal password addition/recovery against a NEW synthetic staging
// account. Generated OTP is administrative fixture setup, never delivery proof.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {createClient} from '@supabase/supabase-js';
const ref='qmbwrbxbbshbavfhkujx';
const vaultRoot=path.resolve(process.env.PARTYPLUS_BACKEND_DEPENDENCIES??'.');
const config=JSON.parse(await fs.readFile(path.join(vaultRoot,'.test-cache/staging-credentials.json'),'utf8'));
assert.equal(config.url,`https://${ref}.supabase.co`);
const keyRows=JSON.parse(process.env.PARTYPLUS_STAGING_KEY_ROWS??'null');
delete process.env.PARTYPLUS_STAGING_KEY_ROWS;
const service=keyRows.find(k=>k.name==='service_role')?.api_key;assert.ok(service);
const claims=JSON.parse(Buffer.from(service.split('.')[1],'base64url'));
assert.equal(claims.ref,ref);assert.equal(claims.role,'service_role');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const client=()=>createClient(config.url,config.publishableKey,options);
const admin=createClient(config.url,service,options),owner=client(),returned=client(),recovery=client(),final=client();
const ok=async pending=>{const result=await pending;assert.equal(result.error,null);return result.data;};
const run=randomUUID(),email=`partyplus.password.${run}@example.invalid`;
const account=(await ok(admin.auth.admin.createUser({email,email_confirm:true,
  app_metadata:{partyplus_synthetic_password_test:true}}))).user;
const uid=account.id;assert.ok(account.email_confirmed_at);
const generatedSignIn=async target=>{
  const generated=await ok(admin.auth.admin.generateLink({type:'magiclink',email}));
  const verified=await ok(target.auth.verifyOtp({email,token:generated.properties.email_otp,type:'email'}));
  assert.equal(verified.user.id,uid);return verified;
};
await generatedSignIn(owner);
const fixture={partyId:randomUUID(),itemId:randomUUID(),joinedPartyId:JSON.parse(await fs.readFile('.test-cache/bring-item-regression-fixture.json','utf8')).partyId};
await fs.writeFile('.test-cache/password-identity-fixture.json',JSON.stringify(fixture,null,2)+'\n');
await ok(owner.rpc('partyplus_v2_commit_party',{p_operation_id:randomUUID(),p_expected_revision:0,
  p_party:{id:fixture.partyId,title:'Synthetic password identity retention',items:[{id:fixture.itemId,name:'Dessert',qty:'Serves 12'}]}}));
await ok(owner.rpc('partyplus_web_join_party',{p_party_id:fixture.joinedPartyId,p_operation_id:randomUUID()}));
const lists=target=>ok(target.rpc('partyplus_web_list_my_parties'));
const before=await lists(owner);assert.ok(before.hosting.some(p=>p.id===fixture.partyId));assert.ok(before.joined.some(p=>p.id===fixture.joinedPartyId));
const password1=randomBytes(30).toString('base64url')+'Aa7!';
const added=await ok(owner.auth.updateUser({password:password1}));assert.equal(added.user.id,uid);
const wrong=await client().auth.signInWithPassword({email,password:randomBytes(30).toString('base64url')});assert.ok(wrong.error);assert.equal(wrong.data.session,null);
const signed=await ok(returned.auth.signInWithPassword({email,password:password1}));assert.equal(signed.user.id,uid);
assert.deepEqual(await lists(returned),before);
await generatedSignIn(recovery);
const password2=randomBytes(30).toString('base64url')+'Aa7!';
const reset=await ok(recovery.auth.updateUser({password:password2}));assert.equal(reset.user.id,uid);
const oldPassword=await client().auth.signInWithPassword({email,password:password1});assert.ok(oldPassword.error);assert.equal(oldPassword.data.session,null);
const finalSignIn=await ok(final.auth.signInWithPassword({email,password:password2}));assert.equal(finalSignIn.user.id,uid);
assert.deepEqual(await lists(final),before);
const evidence={observedAt:new Date().toISOString(),projectRef:ref,productionAccessed:false,
  existingCustomerOrReviewerPasswordChanged:false,globalAuthSettingsChanged:false,emailSent:false,
  fixtureIsNewSyntheticAccount:true,fixturePartyId:fixture.partyId,
  checks:{existingVerifiedPasswordlessPrincipalCanAddPassword:true,passwordUpdateRetainsPrincipal:true,
    incorrectPasswordCreatesNoSession:true,freshPasswordSignInReturnsSamePrincipal:true,
    hostingAndJoinedAccessUnchanged:true,otpAlternativeStillSignsIntoSamePrincipal:true,
    newPasswordAfterOtpRecoveryWorks:true,oldPasswordAfterReplacementDenied:true},
  scopeLimit:'Administrative generated OTP establishes supported Auth API behavior only. Does not prove recipient delivery, browser password-manager UX, or configured old-session reauthentication requirements.'};
await fs.writeFile('supabase/web-rebuild/PASSWORD_IDENTITY_CHECK_2026-10-31.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
for(const target of [owner,returned,recovery,final])await target.auth.signOut({scope:'local'});
