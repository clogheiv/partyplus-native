import {useState,type FormEvent} from 'react';
import {api} from './api';
import {Icon,Notice} from './ui';

type Session=Awaited<ReturnType<typeof api.getSession>>;
const message=(error:unknown)=>error instanceof Error?error.message:'Sign-in could not be completed. Please try again.';
type Props={session:Session;refresh:()=>Promise<Session>;navigate:(path:string)=>void;notify:(text:string)=>void};

export default function Account({session,refresh,navigate,notify}:Props){
 const [email,setEmail]=useState(session?.email||'');
 const [code,setCode]=useState('');
 const [password,setPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [mode,setMode]=useState<'code'|'password'>('code');
 const [sent,setSent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [switching,setSwitching]=useState(false);
 const [settingPassword,setSettingPassword]=useState(false);
 const [recovering,setRecovering]=useState(false);
 const [reverifying,setReverifying]=useState(false);
 const verified=!!session&&!session.isAnonymous;
 const afterLogin=async()=>{
  await refresh();setPassword('');setConfirmPassword('');
  if(recovering||reverifying){setSent(false);setCode('');setRecovering(false);setReverifying(false);setSettingPassword(true);notify('Email verified. You can set a new password on this account.');return;}
  notify('You’re signed in. Your parties are ready.');
  const next=new URLSearchParams(location.search).get('next');
  navigate(next?.startsWith('/')&&!next.startsWith('//')?next:'/');
 };
 const submit=async(event:FormEvent)=>{
  event.preventDefault();setBusy(true);setError('');
  try{
   if(mode==='password'){await api.signInWithPassword(email.trim(),password);await afterLogin();}
   else if(sent){await api.verifyCode(email.trim(),code.trim());await afterLogin();}
   else{if(recovering||reverifying)await api.sendRecoveryCode(email.trim());else await api.sendCode(email.trim());setSent(true);}
  }catch(error){setError(message(error));}finally{setBusy(false);}
 };
 const savePassword=async(event:FormEvent)=>{
  event.preventDefault();setError('');
  if(password!==confirmPassword){setError('The passwords do not match. Enter the same password twice.');return;}
  setBusy(true);
  try{await api.setPassword(password);setPassword('');setConfirmPassword('');setSettingPassword(false);notify('Password saved. Your hosted and joined parties stay on this account.');}
  catch(error){setError(message(error));}finally{setBusy(false);}
 };
 const recover=()=>{setMode('code');setSent(false);setCode('');setPassword('');setConfirmPassword('');setRecovering(true);setError('');};
 return <>
  <div className="page-heading"><span className="eyebrow">A FAMILIAR FACE</span><h1>{verified?'You’re right at home.':'Keep the good times together.'}</h1><p>{verified?'Your account keeps your parties close.':'Sign in with an email code or your password.'}</p></div>
  <div className="account-layout"><section className="panel account-panel">
   <div className="account-icon"><Icon name="people" size={28}/></div>
   <h2>{verified&&!reverifying?'My account':sent?'Check your inbox':'Welcome to PartyPlus'}</h2>
   {verified&&!reverifying?<>
    <p className="muted">You’re signed in as</p><strong className="account-email">{session?.email}</strong>
    <p className="muted">Your hosted and joined parties are linked to this account.</p>
    <button className="button primary full-width" onClick={()=>navigate('/')}>Go to my parties <Icon name="arrow" size={17}/></button>
    <section className="password-settings"><h3>Optional password</h3><p>Set a password to sign in on another device. Email codes remain available.</p>
     {!settingPassword?<button className="button outline full-width" onClick={()=>{setSettingPassword(true);setPassword('');setConfirmPassword('');setError('');}}>Set or change password</button>:<form onSubmit={savePassword}>
      <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event=>setPassword(event.target.value)}/><small>Use at least 8 characters. Any additional account policy also applies.</small></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)}/></label>
      <button className="button primary full-width" disabled={busy}>{busy?'Saving password…':'Save password'}</button>
      <button type="button" className="text-button" disabled={busy} onClick={()=>{setSettingPassword(false);setPassword('');setConfirmPassword('');}}>Cancel</button>
     </form>}
     <button className="text-button" disabled={busy} onClick={()=>{setEmail(session?.email||'');setPassword('');setConfirmPassword('');setReverifying(true);setMode('code');setSent(false);setCode('');setError('');}}>Verify with an email code</button>
    </section>
    <button className="text-button sign-out" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api.signOut();setPassword('');await refresh();notify('You’re signed out.');navigate('/');}catch(error){setError(message(error));}finally{setBusy(false);}}}>Sign out</button>
   </>:<>
    {recovering&&<Notice>Sign in with an email code to recover access. Then set a new password in My account.</Notice>}
    {reverifying&&<Notice>Verify a fresh email code, then set your password again.</Notice>}
    {!sent&&!reverifying&&!session?.isAnonymous&&<div className="auth-methods" aria-label="Sign-in method"><button type="button" className={mode==='code'?'selected':''} aria-pressed={mode==='code'} onClick={()=>{setMode('code');setPassword('');setError('');}}>Email code</button><button type="button" className={mode==='password'?'selected':''} aria-pressed={mode==='password'} onClick={()=>{setMode('password');setRecovering(false);setError('');}}>Password</button></div>}
    <p className="muted">{sent?(recovering||reverifying?'If this account can receive a code, check your email and enter it below.':`We sent a sign-in code to ${email}. Enter it below to continue.`):mode==='password'?'Use the password you set on your verified PartyPlus account.':'Host a party or find the gatherings you’ve already joined.'}</p>
    <form onSubmit={submit}>
     <label>Email address<input type="email" autoComplete="email" required disabled={sent||reverifying} value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com"/></label>
     {mode==='password'?<label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/></label>:sent&&<label>Sign-in code<input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,''))} placeholder="Enter your email code"/><small>Use the 6–10 digit code from your email.</small></label>}
     <button className="button primary full-width" disabled={busy}>{busy?(sent||mode==='password'?'Signing in…':'Sending code…'):mode==='password'?'Sign in with password':sent?'Verify & sign in':'Send sign-in code'}<Icon name="arrow" size={17}/></button>
    </form>
    {mode==='password'&&<button className="text-button sign-out" disabled={busy} onClick={recover}>Forgot password? Use an email code</button>}
    {sent&&<button className="text-button sign-out" disabled={busy} onClick={()=>{setSent(false);setCode('');setError('');}}>{reverifying?'Request a new code':'Use another email or request a new code'}</button>}
    {reverifying&&<button className="text-button" disabled={busy} onClick={()=>{setReverifying(false);setCode('');}}>Back to my account</button>}
    <p className="form-fine-print">{session?.isAnonymous?'Your joined parties stay with you when you verify a new email in this browser.':'Email verification is required to host. Guests can RSVP without creating an account.'}</p>
   </>}
   {error&&<Notice kind="error">{error}</Notice>}
   {session?.isAnonymous&&<div className="guest-account-help"><button className="text-button" disabled={busy} onClick={()=>setSwitching(true)}>Sign in to an existing account</button>{switching&&<div className="notice warning" role="alertdialog" aria-labelledby="switch-title"><strong id="switch-title">Leave this guest session?</strong><p>Verifying a new email keeps your guest responses with you. Signing in to a different existing account ends this guest session and may prevent you from updating its responses. Save your invitation links first.</p><button className="button secondary small" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api.signOut();await refresh();setSent(false);setCode('');setSwitching(false);notify('Guest session ended. You can now sign in to your existing account.');}catch(error){setError(message(error));}finally{setBusy(false);}}}>Continue to existing account</button><button className="text-button" onClick={()=>setSwitching(false)}>Keep guest access</button></div>}</div>}
  </section><aside className="account-story"><span aria-hidden="true">✳</span><h2>More “see you there.”<br/>Less back and forth.</h2><p>One place for the plan, the people, and what everyone’s bringing.</p></aside></div>
 </>;
}
