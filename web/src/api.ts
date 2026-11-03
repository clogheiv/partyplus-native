import { createClient } from '@supabase/supabase-js';
import type { Party, PartyItem, PartyRsvp } from '../../src/lib/partyTypes';
import { classifyPartyError } from '../../src/lib/partyErrors';
import { requireParty, requireCommitReceipt } from '../../src/lib/partyValidation';
import type { PartyAppearance } from './appearance';
import type { LocationDetails } from './partyLocation';

export type WebParty = Omit<Party,'items'> & {
  appearance?:PartyAppearance;
  address?:string;
  locationDetails?:LocationDetails|null;
  items: (PartyItem & {isMine?:boolean})[];
  ownRsvp?: PartyRsvp | null;
  isJoined?:boolean;
  totals?: {yes:number;maybe:number;no:number;attending:number};
};
export type WebEditorDraft = Partial<WebParty> & {pendingItemName?:string;pendingItemQty?:string;pendingItemId?:string};
declare const __PARTYPLUS_WEB_CONFIG__: {environment:string;url:string;key:string};
const config=__PARTYPLUS_WEB_CONFIG__;
const client=createClient(config.url,config.key,{auth:{detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
const prefix='partyplus.web.v1.';
type Pending={id:string;operationId:string;principal:string;name:string;args:Record<string,unknown>;attempted:boolean};
type PhotoWork={principal:string;partyId:string;imageId:string};
function read<T>(key:string):T|null { const value=localStorage.getItem(prefix+key); if (!value) return null; try {return JSON.parse(value);} catch {throw Error('Saved browser data needs recovery. Its original copy has been preserved.');} }
function write(key:string,value:unknown) {localStorage.setItem(prefix+key,JSON.stringify(value));}
async function session() {
  const {data,error}=await client.auth.getSession(); if(error) throw classifyPartyError(error);
  const user=data.session?.user;
  return user ? {id:user.id,email:user.email,isAnonymous:!!user.is_anonymous}:null;
}
let signing:Promise<string>|undefined;
async function identify() {
  const current=await session(); if(current) return current.id;
  if(!signing) signing=(async()=>{const {data,error}=await client.auth.signInAnonymously(); if(error) throw classifyPartyError(error); if(!data.user)throw Error('Your guest session could not be saved. Please try again.');return data.user.id;})();
  try{return await signing;}finally{signing=undefined;}
}
async function rpc(name:string,args:Record<string,unknown>={}) { const {data,error}=await client.rpc(name,args); if(error)throw classifyPartyError(error); return data; }
function authFailure(error:{code?:string;status?:number;message?:string}):Error {
 if(error.code==='otp_expired')return Error('That code is incorrect or has expired. Request a new code and try again.');
 if(error.status===429||/rate_limit|over_email_send_rate_limit/.test(error.code??''))return Error('Too many code requests. Wait a few minutes before requesting another.');
 if(/email_exists|user_already_exists|email_address_not_authorized/.test(error.code??''))return Error('That email could not be used for this guest session. If you already have an account, return to My Parties and sign in before responding. Your guest access remains in this browser.');
 if(/fetch|network|timeout/i.test(error.message??''))return Error('Could not reach the sign-in service. Check your connection and try again.');
 return Error('Sign-in could not be completed. Check your email address and code, then try again.');
}
function passwordFailure(error:unknown,setting=false):Error {
 const failure=error as {code?:string;status?:number;message?:string};
 if(failure?.status===429||/rate_limit/.test(failure?.code??''))return Error('Too many attempts. Wait a few minutes before trying again, or use an email code.');
 if(/fetch|network|timeout/i.test(failure?.message??''))return Error(setting?'Could not confirm the password change. Check your connection, then try the new password or use an email code.':'Could not reach the sign-in service. Check your connection and try again.');
 if(setting && (/reauthentication|session|jwt|refresh_token/.test(failure?.code??'')||failure?.status===401))return Error('Sign in again with an email code, then set your password. Your parties stay with your account.');
 if(setting && failure?.code==='weak_password')return Error('Choose a stronger password with at least 8 characters. The sign-in service may require a longer password or a mix of characters.');
 if(setting && failure?.code==='same_password')return Error('Choose a different password, or keep using your current password.');
 return Error(setting?'The password change could not be confirmed. Try again, or sign in with an email code first.':'Email or password was not accepted. Try again or use an email code.');
}
async function lock<T>(id:string,operation:()=>Promise<T>):Promise<T> {
  if(!navigator.locks) throw Error('Please update your browser before saving. You can still view invitations.');
  return navigator.locks.request(prefix+id,operation);
}
function appearanceFingerprint(value:unknown):string {
 if(value===null)return 'null';if(!value||typeof value!=='object')return 'missing';
 const p=value as Record<string,unknown>;const image=p.image as Record<string,unknown>|undefined;
 return JSON.stringify([p.version,p.design,p.layout,p.accent,p.font,p.artwork,image?[image.id,image.positionX,image.positionY,image.zoom]:null]);
}
function locationFingerprint(value:unknown):string {
 if(!value||typeof value!=='object')return 'missing';
 const p=value as Record<string,unknown>;
 return JSON.stringify([p.version,p.streetAddress,p.city,p.zipCode]);
}
async function mutation(id:string,name?:string,args?:Record<string,unknown>):Promise<WebParty|null> {
 return lock(id,async()=>{
  const key='pending.'+id;
  const saved=read<Pending>(key);
  if(saved && name && (saved.name!==name || JSON.stringify(saved.args)!==JSON.stringify(args)))throw Error('Retry your pending change before sending a different one. Your new draft is preserved.');
  if(!saved && !name)throw Error('There is no pending change to retry.');
  const principal=await identify();
  if(saved && saved.principal!==principal)throw Error('Sign in to the account that started this pending change.');
  const pending:Pending=saved??{id,operationId:crypto.randomUUID(),principal,name:name!,args:args!,attempted:false};
  const previousAttempt=pending.attempted;
  pending.attempted=true;write(key,pending);
  let result;
  try { result=await rpc(pending.name,{...pending.args,p_operation_id:pending.operationId}); }
  catch(error) {
    const failure=classifyPartyError(error);
    if(failure.serverRejected && !previousAttempt){write('rejected.'+pending.operationId,pending);localStorage.removeItem(prefix+key);}
    throw failure;
  }
  let party:WebParty|null=null;
  if(pending.name!=='partyplus_v2_delete_party')party=requireCommitReceipt(result,id,pending.operationId).party as WebParty;
  else if(result?.deleted!==true || result.operationId!==pending.operationId)throw Error('The server did not confirm this deletion. Retry the pending change.');
  const submitted=pending.args.p_party as Record<string,unknown>|undefined;
  if(pending.name==='partyplus_v2_commit_party'&&submitted&&Object.hasOwn(submitted,'appearance')&&appearanceFingerprint(submitted.appearance)!==appearanceFingerprint(party?.appearance))throw Error('The server did not confirm your invitation appearance. Your draft is preserved. Retry the saved change.');
  if(pending.name==='partyplus_v2_commit_party'&&submitted&&Object.hasOwn(submitted,'locationDetails')&&locationFingerprint(submitted.locationDetails)!==locationFingerprint(party?.locationDetails))throw Error('The server did not confirm your party location. Your draft is preserved. Retry the saved change.');
  localStorage.removeItem(prefix+key);
  return party;
 });
}
async function track(kind:string) {
  // Telemetry cannot change a successful product action into a failure. No names,
  // invitation URLs, party IDs, email addresses, or delivery claims are collected.
  try {await rpc('partyplus_web_record_event',{p_event_id:crypto.randomUUID(),p_kind:kind});}catch{/* best effort */}
}
export const api={
 config,
 getSession:session,
 partyPhotoUrl(imageId?:string):string|undefined{
  if(!imageId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(imageId))return undefined;
  return `${config.url}/storage/v1/object/public/partyplus-party-images/${imageId.toLowerCase()}.jpg`;
 },
 async uploadPartyPhoto(partyId:string,imageId:string,photo:Blob):Promise<void>{
  const current=await session();if(!current||current.isAnonymous)throw Error('Verify your email before uploading this photo. Your photo draft stays in this browser.');
  if(api.hasPending(partyId))throw Error('Retry your pending party change before uploading a different photo.');
  if(!api.partyPhotoUrl(imageId)||photo.type!=='image/jpeg'||photo.size<1||photo.size>1_500_000)throw Error('Choose and prepare a JPEG photo under 1.5 MB.');
  const bytes=await photo.arrayBuffer();const header=new Uint8Array(bytes,0,Math.min(bytes.byteLength,3));
  if(header.length<3||header[0]!==255||header[1]!==216||header[2]!==255)throw Error('The prepared photo is not a JPEG. Choose the photo again.');
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
  const prepared=await client.rpc('partyplus_web_prepare_image',{p_party_id:partyId,p_image_id:imageId,p_byte_size:photo.size,p_sha256:sha256});
  if(prepared.error){
   if(prepared.error.message.includes('image_capacity_reached'))throw Error('Photo storage is at its current safety limit. Keep gallery artwork for now, or remove an unused photo and try again. Your draft is preserved.');
   throw classifyPartyError(prepared.error);
  }
  const slot=prepared.data;
  const imagePath=imageId.toLowerCase()+'.jpg';
  if(slot?.imageId!==imageId||slot.bucket!=='partyplus-party-images'||slot.path!==imagePath)throw Error('The server could not authorize this photo upload. Your draft is preserved.');
  let uncertain=false;
  try{const result=await client.storage.from(slot.bucket).upload(slot.path,photo,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});uncertain=!!result.error;}catch{uncertain=true;}
  if(uncertain){
   // A dropped upload response or duplicate retry is safe only if the exact
   // immutable bytes are already present; never overwrite a prior object.
   try{
    const response=await fetch(api.partyPhotoUrl(imageId)!,{signal:AbortSignal.timeout(20000)});
    if(!response.ok||Number(response.headers.get('content-length'))>1_500_000)throw Error();
    const stored=await response.arrayBuffer();if(stored.byteLength!==photo.size)throw Error();
    const storedHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',stored)),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(storedHash!==sha256)throw Error();
   }catch{throw Error('The photo upload could not be confirmed. Your draft is preserved. Check your connection and save again.');}
  }
  await lock('photo-work',async()=>{
   const uploaded=read<PhotoWork[]>('uploadedPhotos')??[];
   write('uploadedPhotos',[...uploaded.filter(entry=>entry.imageId!==imageId),{principal:current.id,partyId,imageId}]);
  });
 },
 async finalizePartyPhotos(partyId:string,keepImageId?:string,previousImageId?:string):Promise<number>{
  const current=await session();if(!current||current.isAnonymous)return 0;
  await lock('photo-work',async()=>{
   const uploaded=read<PhotoWork[]>('uploadedPhotos')??[];
   const queued=read<PhotoWork[]>('photoCleanup')??[];
   const candidates=[...uploaded.filter(entry=>entry.principal===current.id&&entry.partyId===partyId&&entry.imageId!==keepImageId),...(previousImageId&&previousImageId!==keepImageId?[{principal:current.id,partyId,imageId:previousImageId}]:[])];
   const next=[...queued];for(const entry of candidates)if(!next.some(saved=>saved.principal===entry.principal&&saved.imageId===entry.imageId))next.push(entry);
   write('photoCleanup',next);
   write('uploadedPhotos',uploaded.filter(entry=>entry.principal!==current.id||entry.partyId!==partyId));
  });
  return api.retryPhotoCleanup();
 },
 async retryPhotoCleanup():Promise<number>{
  const current=await session();if(!current||current.isAnonymous)return 0;
  return lock('photo-work',async()=>{
  const queued=read<PhotoWork[]>('photoCleanup')??[];const remaining:PhotoWork[]=[];let attempted=0;
  if(!queued.length)return 0;
  for(const entry of queued){
   if(entry.principal!==current.id||attempted>=4){remaining.push(entry);continue;}attempted++;
   try{
    const slot=await rpc('partyplus_web_begin_image_removal',{p_image_id:entry.imageId});
    if(slot?.imageId!==entry.imageId||slot.bucket!=='partyplus-party-images'||slot.path!==entry.imageId.toLowerCase()+'.jpg')throw Error('Invalid removal authorization');
    const {error}=await client.storage.from(slot.bucket).remove([slot.path]);if(error)throw error;
    if(await rpc('partyplus_web_release_image',{p_image_id:entry.imageId})!==true)throw Error('Removal not confirmed');
   }catch{remaining.push(entry);}
  }
  write('photoCleanup',remaining);return remaining.filter(entry=>entry.principal===current.id).length;
  });
 },
 async listParties():Promise<{hosting:WebParty[];joined:WebParty[]}>{
  if(!await session())return {hosting:[],joined:[]};
  const result=await rpc('partyplus_web_list_my_parties');
  if(!result || !Array.isArray(result.hosting)||!Array.isArray(result.joined))throw Error('The server could not load your parties. Please retry.');
  return {hosting:result.hosting.map((p:Party)=>requireParty(p,p.id)),joined:result.joined.map((p:Party)=>requireParty(p,p.id))};
 },
 async readParty(id:string):Promise<WebParty|null>{const result=await rpc('partyplus_web_read_party',{p_party_id:id});return result?requireParty(result,id) as WebParty:null;},
 async joinParty(id:string){await mutation(id,'partyplus_web_join_party',{p_party_id:id});},
 async saveParty(party:WebParty):Promise<WebParty>{
  const current=await session();if(!current||current.isAnonymous)throw Error('Sign in with your email to save your party. Your draft is preserved.');
  const created=!party.revision;
  const {locationDetails,...rest}=party;
  const submitted=locationDetails?{...rest,locationDetails:{version:1,streetAddress:locationDetails.streetAddress.trim(),city:locationDetails.city.trim(),zipCode:locationDetails.zipCode.trim()}}:rest;
  const result=await mutation(party.id,'partyplus_v2_commit_party',{p_expected_revision:party.revision??0,p_party:submitted});
  if(created)void track('party_created');return result!;
 },
 async rsvp(id:string,response:{name:string;status:'yes'|'maybe'|'no';attendeeCount:number}){const result=await mutation(id,'partyplus_v2_rsvp',{p_party_id:id,p_response:response});void track('rsvp_saved');return result!;},
 async claim(id:string,itemId:string,claim:boolean){const result=await mutation(id,'partyplus_v2_claim_item',{p_party_id:id,p_item_id:itemId,p_claim:claim});if(claim)void track('bring_item_claimed');return result!;},
 async suggest(id:string,name:string){
  const pending=read<Pending>('pending.'+id);
  const itemId=pending?.name==='partyplus_v2_suggest_item'?pending.args.p_item_id:crypto.randomUUID();
  const result=await mutation(id,'partyplus_v2_suggest_item',{p_party_id:id,p_item_id:itemId,p_name:name});void track('bring_item_suggested');return result!;
 },
 async deleteParty(id:string){await mutation(id,'partyplus_v2_delete_party',{p_party_id:id});},
 retry:(id:string)=>mutation(id),
 hasPending:(id:string)=>!!read<Pending>('pending.'+id),
 async sendCode(email:string){
  const current=await session();
  const result=current?.isAnonymous?await client.auth.updateUser({email}):await client.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
  if(result.error)throw authFailure(result.error);
  write('authIntent',{email,type:current?.isAnonymous?'email_change':'email'});
 },
 async sendRecoveryCode(email:string):Promise<void>{
  if(signing)await signing;
  const current=await session();
  if(current?.isAnonymous)throw Error('Your guest session is still active. Keep guest access or explicitly switch to an existing account before recovering a password.');
  const address=email.trim();
  if(current && current.email?.toLowerCase()!==address.toLowerCase())throw Error('You are already signed in. Use the current account email or sign out before recovering another account.');
  let result;
  try {result=await client.auth.signInWithOtp({email:address,options:{shouldCreateUser:false}});}
  catch {throw Error('Could not request a recovery code. Check your connection and try again.');}
  // Unknown-account responses follow the same visible path as accepted requests.
  // Recovery never creates an account or converts an existing guest identity.
  if(result.error && !['otp_disabled','user_not_found','signup_disabled'].includes(result.error.code??'')){
   if(result.error.status===429||/rate_limit/.test(result.error.code??''))throw Error('Too many code requests. Wait a few minutes before trying again.');
   throw Error('Could not request a recovery code. Check the email address or try again later.');
  }
  write('authIntent',{email:address,type:'email'});
 },
 async verifyCode(email:string,token:string){
  const intent=read<{email:string;type:'email'|'email_change'}>('authIntent');
  const {error}=await client.auth.verifyOtp({email,token,type:intent?.email===email?intent.type:'email'});
  if(error)throw authFailure(error);
  localStorage.removeItem(prefix+'authIntent');
 },
 async signInWithPassword(email:string,password:string):Promise<void>{
  if(signing)await signing;
  const current=await session();
  if(current?.isAnonymous)throw Error('Your guest session is still active. Keep guest access or explicitly switch to an existing account before signing in with a password.');
  const address=email.trim();
  if(current && current.email?.toLowerCase()!==address.toLowerCase())throw Error('You are already signed in. Sign out before using a different account.');
  let result;
  try {result=await client.auth.signInWithPassword({email:address,password});}
  catch(error){throw passwordFailure(error);}
  if(result.error)throw passwordFailure(result.error);
  const user=result.data.user;
  if(!result.data.session || !user || user.is_anonymous || !user.email_confirmed_at
    || user.email?.toLowerCase()!==address.toLowerCase() || (current && user.id!==current.id)){
   throw Error('The sign-in service did not confirm this account. Use an email code to sign in again.');
  }
  localStorage.removeItem(prefix+'authIntent');
 },
 async setPassword(password:string):Promise<void>{
  if(typeof password!=='string'||password.length<8)throw Error('Use a password with at least 8 characters.');
  const current=await session();
  if(!current || current.isAnonymous)throw Error('Verify your email with a sign-in code before setting a password.');
  let verified;
  try {verified=await client.auth.getUser();}
  catch(error){throw passwordFailure(error,true);}
  if(verified.error)throw passwordFailure(verified.error,true);
  const user=verified.data.user;
  if(!user || user.id!==current.id || user.is_anonymous || !user.email || !user.email_confirmed_at){
   throw Error('Verify your current account email with a sign-in code before setting a password.');
  }
  let result;
  try {result=await client.auth.updateUser({password});}
  catch(error){throw passwordFailure(error,true);}
  if(result.error)throw passwordFailure(result.error,true);
  if(!result.data.user || result.data.user.id!==user.id || result.data.user.is_anonymous || !result.data.user.email_confirmed_at){
   throw Error('The sign-in service did not confirm a password for your current account. Use an email code to sign in again.');
  }
 },
 async signOut(){const {error}=await client.auth.signOut();if(error)throw classifyPartyError(error);},
 track:async(kind:string,_partyId?:string)=>track(kind),
 loadDraft:()=>read<WebEditorDraft>('editor'),
 storeDraft:(draft:WebEditorDraft)=>write('editor',draft),
 clearDraft:()=>localStorage.removeItem(prefix+'editor'),
};
