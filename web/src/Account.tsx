import {useState,type FormEvent} from 'react';
import {api} from './api';
import {Icon,Notice} from './ui';
import './accountAccess.css';
type Session=Awaited<ReturnType<typeof api.getSession>>;
type Props={session:Session;refresh:()=>Promise<Session>;navigate:(path:string)=>void;notify:(text:string)=>void};
const message=(error:unknown)=>error instanceof Error?error.message:'Sign-in could not be completed. Please try again.';
const nextPath=()=>{const next=new URLSearchParams(location.search).get('next');return next?.startsWith('/')&&!next.startsWith('//')?next:'/';};
export default function Account({session,refresh,navigate,notify}:Props){
 const guest=!!session?.isAnonymous;
 const [email,setEmail]=useState(session?.email||'');
 const [code,setCode]=useState('');
 const [password,setPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [mode,setMode]=useState<'code'|'password'>(guest?'code':'password');
 const [creatingAccount,setCreatingAccount]=useState(guest);
 const [sent,setSent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [switching,setSwitching]=useState(false);
 const [settingPassword,setSettingPassword]=useState(false);
 const [passwordOffer,setPasswordOffer]=useState(false);
 const [recovering,setRecovering]=useState(false);
 const [reverifying,setReverifying]=useState(false);
 const verified=!!session&&!session.isAnonymous;
 const clearSecrets=()=>{setPassword('');setConfirmPassword('');setCode('');};
 const afterLogin=async()=>{
  await refresh();clearSecrets();setSent(false);
  if(recovering||reverifying){setRecovering(false);setReverifying(false);setSettingPassword(true);notify('Email verified. You can set a new password on this account.');return;}
  if(creatingAccount){setCreatingAccount(false);setPasswordOffer(true);notify('Email verified. Your account is ready.');return;}
  notify('You’re signed in. Your parties are ready.');navigate(nextPath());
 };
 const submit=async(event:FormEvent)=>{
  event.preventDefault();setBusy(true);setError('');
  try{
   if(mode==='password'){await api.signInWithPassword(email.trim(),password);await afterLogin();}
   else if(sent){await api.verifyCode(email.trim(),code.trim());await afterLogin();}
   else{if(creatingAccount||guest)await api.sendCode(email.trim());else await api.sendRecoveryCode(email.trim());setSent(true);}
  }catch(error){setError(message(error));}finally{setBusy(false);}
 };
 const savePassword=async(event:FormEvent)=>{
  event.preventDefault();setError('');
  if(password!==confirmPassword){setError('The passwords do not match. Enter the same password twice.');return;}
  setBusy(true);
  try{await api.setPassword(password);clearSecrets();setSettingPassword(false);setPasswordOffer(false);notify('Password saved. Use your email and password to sign in on other devices.');if(passwordOffer)navigate(nextPath());}
  catch(error){setError(message(error));}finally{setBusy(false);}
 };
 const showPasswordSignIn=()=>{setMode('password');setCreatingAccount(false);setRecovering(false);setSent(false);clearSecrets();setError('');};
 const showEmailCode=(recovery=false)=>{setMode('code');setCreatingAccount(false);setRecovering(recovery);setSent(false);clearSecrets();setError('');};
 const createAccount=()=>{setMode('code');setCreatingAccount(true);setRecovering(false);setSent(false);clearSecrets();setError('');};
 const continueWithoutPassword=()=>{setPasswordOffer(false);setSettingPassword(false);clearSecrets();navigate(nextPath());};
 const passwordForm=<form onSubmit={savePassword}>
  <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event=>setPassword(event.target.value)}/><small>Use at least 8 characters. Any additional account policy also applies.</small></label>
  <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)}/></label>
  <button className="button primary full-width" disabled={busy}>{busy?'Saving password…':'Save password'}</button>
  <button type="button" className="text-button" disabled={busy} onClick={passwordOffer?continueWithoutPassword:()=>{setSettingPassword(false);clearSecrets();}}>{passwordOffer?'Continue without a password':'Cancel'}</button>
 </form>;
 return <>
  <div className="page-heading"><h1>{verified?'My account':creatingAccount&&!guest?'Create your account':'Sign in to your account'}</h1><p>{verified?'Your hosted and joined parties stay with this account.':creatingAccount&&!guest?'Verify your email first. Then you can create an optional password.':'Find your hosted and joined parties on this device.'}</p></div>
  <div className="account-layout"><section className="panel account-panel account-access-panel">
   {guest&&<section className="guest-existing-access"><h2>Already have an account?</h2><button className="button primary full-width" disabled={busy} onClick={()=>setSwitching(true)}>Sign in to an existing account<Icon name="arrow" size={17}/></button>
    {switching&&<div className="notice warning" role="alertdialog" aria-labelledby="switch-title"><h3 id="switch-title">Leave this guest session?</h3><p>Your guest RSVPs and item claims stay with this guest identity. They will not move to your existing account. Ending this session may prevent you from updating them. Save your invitation links first.</p><p>Verifying a new email below keeps the same guest identity and its responses.</p><button className="button secondary small" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api.signOut();await refresh();setEmail('');setSwitching(false);setReverifying(false);setSettingPassword(false);setPasswordOffer(false);showPasswordSignIn();notify('Guest session ended. Sign in to your existing account below.');}catch(error){setError(message(error));}finally{setBusy(false);}}}>Continue to account sign-in</button><button className="text-button" disabled={busy} onClick={()=>setSwitching(false)}>Keep guest access</button></div>}
    <h3>Keep this guest access</h3><p>Verify a new email below to return to these responses on other devices. Guests can also keep using this browser without an account.</p></section>}
   <h2>{verified&&!reverifying?passwordOffer?'Email verified':'My account':sent?'Check your email':guest?'Verify a new email':creatingAccount?'Create an account':'Welcome back'}</h2>
   {verified&&!reverifying?<>
    <p className="muted">You’re signed in as</p><strong className="account-email">{session?.email}</strong>
    {passwordOffer?<section className="account-password-offer"><h3>Create a password</h3><p>Use your email and password to sign in on other devices. This is optional; email codes remain available.</p>{settingPassword?passwordForm:<><button className="button primary full-width" onClick={()=>{setSettingPassword(true);clearSecrets();setError('');}}>Create a password</button><button className="text-button full-width" onClick={continueWithoutPassword}>Continue without a password</button></>}</section>:<>
     <button className="button primary full-width" onClick={()=>navigate('/')}>Go to my parties<Icon name="arrow" size={17}/></button>
     <section className="password-settings"><h3>Optional password</h3><p>Create or change a password to sign in on other devices. Email codes remain available.</p>{settingPassword?passwordForm:<button className="button outline full-width" onClick={()=>{setSettingPassword(true);clearSecrets();setError('');}}>Create or change password</button>}
      <button className="text-button" disabled={busy} onClick={()=>{setEmail(session?.email||'');clearSecrets();setReverifying(true);setCreatingAccount(false);setMode('code');setSent(false);setError('');}}>Verify with an email code</button>
     </section>
    </>}
    <button className="text-button sign-out" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api.signOut();clearSecrets();await refresh();notify('You’re signed out.');navigate('/');}catch(error){setError(message(error));}finally{setBusy(false);}}}>Sign out</button>
   </>:<>
    {recovering&&<Notice>Use an email code to sign in without a password. You can then create or change your password in My account.</Notice>}
    {reverifying&&<Notice>Verify a fresh email code, then set your password again.</Notice>}
    {!sent&&!reverifying&&!guest&&!creatingAccount&&<div className="auth-methods" aria-label="Sign-in method"><button type="button" className={mode==='password'?'selected':''} aria-pressed={mode==='password'} onClick={showPasswordSignIn}>Email &amp; password</button><button type="button" className={mode==='code'?'selected':''} aria-pressed={mode==='code'} onClick={()=>showEmailCode()}>Email code</button></div>}
    <p className="muted">{sent?(creatingAccount||guest?`We sent a verification code to ${email}. Enter it below to continue.`:'If this account can receive a code, check your email and enter it below.'):mode==='password'?'Enter the email and password for your existing account.':guest?'Use a new email to keep your guest responses on the same account.':creatingAccount?'Enter your email to start. A password can be added after verification.':'No password needed. Use an email code for your existing account.'}</p>
    <form onSubmit={submit}>
     <label>Email address<input type="email" autoComplete="email" required disabled={sent||reverifying} value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com"/></label>
     {mode==='password'?<label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/></label>:sent&&<label>Sign-in code<input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,''))} placeholder="Enter your email code"/><small>Use the 6–10 digit code from your email.</small></label>}
     <button className="button primary full-width" disabled={busy}>{busy?(sent||mode==='password'?'Signing in…':'Sending code…'):mode==='password'?'Sign in':sent?'Verify email & continue':'Send email code'}<Icon name="arrow" size={17}/></button>
    </form>
    {mode==='password'&&<button className="text-button full-width code-access-alternative" disabled={busy} onClick={()=>showEmailCode(true)}>No password or forgot it? Use an email code</button>}
    {sent&&<button className="text-button sign-out" disabled={busy} onClick={()=>{setSent(false);setCode('');setError('');}}>Use another email or request a new code</button>}
    {!guest&&!sent&&!reverifying&&<div className="account-route-choice">{creatingAccount?<button className="text-button" onClick={showPasswordSignIn}>Already have an account? Sign in</button>:<><p>New to PartyPlus?</p><button className="button outline full-width" onClick={createAccount}>Create an account</button></>}</div>}
    {reverifying&&<button className="text-button" disabled={busy} onClick={()=>{setReverifying(false);clearSecrets();}}>Back to my account</button>}
    <p className="form-fine-print">Email verification is required to host. Guests can RSVP without creating an account.</p>
   </>}
   {error&&<Notice kind="error">{error}</Notice>}
  </section><aside className="account-story"><span aria-hidden="true">✳</span><h2>Your parties,<br/>on any device.</h2><p>Sign in to the same account to find the parties you host and the gatherings you’ve joined.</p></aside></div>
 </>;
}
