import { createClient } from '@supabase/supabase-js';
import type { Party, PartyItem, PartyRsvp } from '../../src/lib/partyTypes';
import { classifyPartyError } from '../../src/lib/partyErrors';
import { requireParty, requireCommitReceipt } from '../../src/lib/partyValidation';

export type WebParty = Omit<Party,'items'> & {
  address?:string;
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
async function lock<T>(id:string,operation:()=>Promise<T>):Promise<T> {
  if(!navigator.locks) throw Error('Please update your browser before saving. You can still view invitations.');
  return navigator.locks.request(prefix+id,operation);
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
  else if(result?.committed!==true || result.operationId!==pending.operationId)throw Error('The server did not confirm this deletion. Retry the pending change.');
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
 async listParties():Promise<{hosting:WebParty[];joined:WebParty[]}>{
  if(!await session())return {hosting:[],joined:[]};
  const result=await rpc('partyplus_web_list_my_parties');
  if(!result || !Array.isArray(result.hosting)||!Array.isArray(result.joined))throw Error('The server could not load your parties. Please retry.');
  return {hosting:result.hosting.map((p:Party)=>requireParty(p,p.id)),joined:result.joined.map((p:Party)=>requireParty(p,p.id))};
 },
 async readParty(id:string):Promise<WebParty|null>{const result=await rpc('partyplus_web_read_party',{p_party_id:id});return result?requireParty(result,id) as WebParty:null;},
 async joinParty(id:string){await mutation(id,'partyplus_web_join_party',{p_party_id:id});},
 async saveParty(party:Party):Promise<WebParty>{
  const current=await session();if(!current||current.isAnonymous)throw Error('Sign in with your email to save your party. Your draft is preserved.');
  const created=!party.revision;
  const result=await mutation(party.id,'partyplus_v2_commit_party',{p_expected_revision:party.revision??0,p_party:party});
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
 async verifyCode(email:string,token:string){
  const intent=read<{email:string;type:'email'|'email_change'}>('authIntent');
  const {error}=await client.auth.verifyOtp({email,token,type:intent?.email===email?intent.type:'email'});
  if(error)throw authFailure(error);
  localStorage.removeItem(prefix+'authIntent');
 },
 async signOut(){const {error}=await client.auth.signOut();if(error)throw classifyPartyError(error);},
 track:async(kind:string,_partyId?:string)=>track(kind),
 loadDraft:()=>read<WebEditorDraft>('editor'),
 storeDraft:(draft:WebEditorDraft)=>write('editor',draft),
 clearDraft:()=>localStorage.removeItem(prefix+'editor'),
};
