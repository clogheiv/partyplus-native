// Windows preparation only: iOS JS/assets/config, never signing/build/submission.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const c=JSON.parse(await fs.readFile('.test-cache/staging-credentials.json','utf8'));
assert.equal(c.url,'https://qmbwrbxbbshbavfhkujx.supabase.co');
const env={...process.env,EXPO_NO_DOTENV:'1',CI:'1',PARTYPLUS_APP_VARIANT:'preview',EXPO_PUBLIC_BACKEND_ENV:'staging',EXPO_PUBLIC_SUPABASE_URL:c.url,EXPO_PUBLIC_SUPABASE_ANON_KEY:c.publishableKey,EXPO_PUBLIC_INVITE_BASE_URL:'http://127.0.0.1:8090'};
const exe=path.resolve('node_modules/expo/bin/cli');
const configRun=spawnSync(process.execPath,[exe,'config','--type','public','--json'],{env,encoding:'utf8',windowsHide:true});
assert.equal(configRun.status,0);const config=JSON.parse(configRun.stdout);
assert.equal(config.ios.bundleIdentifier,'com.partyplus.app.preview');assert.equal(config.scheme,'partyplusnative-preview');
const result=spawnSync(process.execPath,[exe,'export','--platform','ios','--output-dir','.test-cache/ios-cutover-export'],{env,stdio:'inherit',windowsHide:true});
assert.equal(result.status,0,'iOS JS/assets compilation failed');
await fs.writeFile('docs/cutover-evidence-2026-10-03/ios-preparation.json',JSON.stringify({status:'ios-js-assets-compiled',bundleIdentifier:config.ios.bundleIdentifier,scheme:config.scheme,backendRef:'qmbwrbxbbshbavfhkujx',physicalIphoneTested:false,nativeIosBuildProduced:false,signingChanged:false,easBuildStarted:false,publication:false,limitations:'Loopback invitation URL for local preparation only; iPhone-accessible staging URL, native build/signing, device and store-upgrade qualification still required.',capturedAt:new Date().toISOString()},null,2)+'\n');
