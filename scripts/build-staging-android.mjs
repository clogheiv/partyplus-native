// Local internal APK only. No EAS spending, production build, upload or publication.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const c=JSON.parse(await fs.readFile('.test-cache/staging-credentials.json','utf8'));
assert.equal(c.url,'https://qmbwrbxbbshbavfhkujx.supabase.co');
assert.ok(c.publishableKey.startsWith('sb_publishable_'));
const env={...process.env,EXPO_NO_DOTENV:'1',CI:'1',PARTYPLUS_APP_VARIANT:'preview',EXPO_PUBLIC_BACKEND_ENV:'staging',EXPO_PUBLIC_SUPABASE_URL:c.url,EXPO_PUBLIC_SUPABASE_ANON_KEY:c.publishableKey};
env.ANDROID_HOME=path.join(process.env.LOCALAPPDATA,'Android','Sdk');
const expo=path.resolve('node_modules/expo/bin/cli');
const run=(exe,args,opts={})=>{const r=spawnSync(exe,args,{env,encoding:'utf8',stdio:'inherit',...opts});if(r.status!==0)throw Error('Local preview build step failed: '+exe);return r;};
const config=JSON.parse(run(process.execPath,[expo,'config','--type','public','--json'],{stdio:'pipe'}).stdout);
assert.equal(config.android.package,'com.partyplus.app.preview');assert.equal(config.scheme,'partyplusnative-preview');
await fs.mkdir('.test-cache/android-preview',{recursive:true});
run(process.execPath,[expo,'prebuild','--platform','android','--no-install']);
await fs.writeFile('android/local.properties','sdk.dir='+env.ANDROID_HOME.replaceAll('\\','/')+'\n');
// Ninja in the installed SDK rejects paths above 260 characters. Keep only the
// generated app CMake staging directory short; no OS long-path setting changes.
const cmakeStage=path.join(os.tmpdir(),'partyplus-cxx',createHash('sha256').update(process.cwd()).digest('hex').slice(0,8));
await fs.mkdir(cmakeStage,{recursive:true});
const gradlePath='android/app/build.gradle',gradle=await fs.readFile(gradlePath,'utf8');
const marker='// PartyPlus local staging path workaround';
if(!gradle.includes(marker))await fs.appendFile(gradlePath,`\n${marker}\nandroid {\n externalNativeBuild { cmake { buildStagingDirectory file('${cmakeStage.replaceAll('\\','/')}') } }\n defaultConfig { externalNativeBuild { cmake { arguments '-DCMAKE_OBJECT_PATH_MAX=240' } } }\n}\n`);
run('cmd.exe',['/d','/c','gradlew.bat','app:assembleRelease','--no-daemon'],{cwd:path.resolve('android')});
const from='android/app/build/outputs/apk/release/app-release.apk',to='.test-cache/android-preview/partyplus-staging.apk';
await fs.copyFile(from,to);
const bytes=await fs.readFile(to);
const git=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
await fs.writeFile('docs/staging-evidence-2026-10-02/android-preview-build.json',JSON.stringify({status:'built-not-device-qualified',package:config.android.package,scheme:config.scheme,backendRef:'qmbwrbxbbshbavfhkujx',sourceCommit:git,sourceMayIncludeUncommittedBatch:true,apkSha256:createHash('sha256').update(bytes).digest('hex'),apkPath:path.resolve(to),signing:'Local generated debug signing, internal staging only; unsuitable for production/store upgrade',physicalDeviceTested:false,capturedAt:new Date().toISOString()},null,2)+'\n');
console.log('Built internal staging APK. Production identity, EAS and stores were not used.');
