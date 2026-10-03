// Physical staging-preview controls only. Never opens or modifies production app data.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const adb=path.join(process.env.LOCALAPPDATA,'Android/Sdk/platform-tools/adb.exe');
const serial='R3CY30R3QMJ',pkg='com.partyplus.app.preview';
const [mode,...args]=process.argv.slice(2);
function run(a,binary=false){const r=spawnSync(adb,['-s',serial,...a],{encoding:binary?undefined:'utf8',windowsHide:true,maxBuffer:16*1024*1024});if(r.status!==0)throw Error('Staging device command failed: '+a.slice(0,2).join(' '));return r.stdout;}
const activity=()=>run(['shell','dumpsys','activity','activities']);
if(mode==='launch') run(['shell','monkey','-p',pkg,'-c','android.intent.category.LAUNCHER','1']);
else if(mode==='stop')run(['shell','am','force-stop',pkg]);
else if(mode==='link'){
 assert.ok(/^partyplusnative-preview:\/\/(?:i\/|party\/|account$)/.test(args[0]));
 run(['shell','am','start','-W','-a','android.intent.action.VIEW','-d',args[0],pkg]);
} else if(mode==='observe'){
 assert.ok(/topResumedActivity=.*com\.partyplus\.app\.preview\//.test(activity()),'Unlock the phone and keep staging Preview foreground before observing');
 run(['shell','uiautomator','dump','/sdcard/partyplus-preview-ui.xml']);
 const xml=run(['shell','cat','/sdcard/partyplus-preview-ui.xml']);
 const nodes=[...xml.matchAll(/<node\b([^>]+)>?/g)].map(m=>Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]])))
 .filter(n=>n.text||n['content-desc']||n.class==='android.widget.EditText')
 .map(n=>({text:n.text,label:n['content-desc'],class:n.class,bounds:n.bounds,enabled:n.enabled}));
 const account=nodes.some(n=>/Email address|Email verification code/.test(n.label));
 if(account){for(const n of nodes){if(n.class==='android.widget.EditText'){n.hasValue=!!n.text&&!/^(Email address|Verification code|6-digit code)$/.test(n.text);n.text='[credential field omitted]';}else n.text=n.text.replace(/[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]+/g,'[email omitted]');}}
 else {
  await fs.writeFile('.test-cache/android-preview/current-ui.xml',xml);
  const bytes=run(['exec-out','screencap','-p'],true);
  await fs.writeFile('.test-cache/android-preview/current-screen.png',bytes);
  if(args[0]) {assert.match(args[0],/^[a-z0-9-]+$/);await fs.writeFile('docs/cutover-evidence-2026-10-03/android-'+args[0]+'.png',bytes);}
 }
 console.log(JSON.stringify(nodes,null,2));
} else {
 assert.ok(/topResumedActivity=.*com\.partyplus\.app\.preview\//.test(activity()),'Unlock the phone and keep staging Preview foreground before input');
 if(mode==='tap'){assert.ok(args.length===2&&args.every(n=>/^\d{1,4}$/.test(n)));run(['shell','input','tap',...args]);}
 else if(mode==='text'){assert.match(args[0],/^[A-Za-z0-9 @._+-]+$/);run(['shell','input','text',args[0].replaceAll(' ','%s')]);}
 else if(mode==='back')run(['shell','input','keyevent','4']);
 else if(mode==='swipe'){assert.ok(args.length===4&&args.every(n=>/^\d{1,4}$/.test(n)));run(['shell','input','swipe',...args,'350']);}
 else throw Error('Unsupported staging action');
}
