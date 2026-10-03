// Existing EAS artifact downloads only. No builds, submissions or private app data.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const builds=JSON.parse((await fs.readFile('.test-cache/cutover-eas-builds.json','utf8')).replace(/^\uFEFF/,''));
const ids=['02cf1dd2-fbf1-4e43-84fa-d0282a19636c','0a4769b4-5929-45fb-ae5a-712c2d7c4a0d','ebad06eb-0e0c-43fc-a0fe-0ea9f7d6c7f2'];
const evidence={capturedAt:new Date().toISOString(),scope:'Existing build artifacts; not current App Store Connect/Play release proof',builds:[]};
await fs.mkdir('.test-cache/store-provenance',{recursive:true});
for(const id of ids){
 const b=builds.find(b=>b.id===id);assert.ok(b);const url=new URL(b.artifacts.buildUrl);assert.equal(url.hostname,'expo.dev');
 const metadata={id,platform:b.platform,status:b.status,distribution:b.distribution,appVersion:b.appVersion,appBuildVersion:b.appBuildVersion,gitCommitHash:b.gitCommitHash,createdAt:b.createdAt};
 let r;try {r=await fetch(url,{signal:AbortSignal.timeout(60000)});}catch {evidence.builds.push({...metadata,artifactAccessible:false,reason:'Download failed or timed out'});continue;}
 if(!r.ok){evidence.builds.push({...metadata,artifactAccessible:false,httpStatus:r.status});console.log('Existing '+b.platform+' artifact HTTP '+r.status);continue;}
 const bytes=Buffer.from(await r.arrayBuffer());assert.ok(bytes.length<200*1024*1024);
 const extension=path.extname(url.pathname);assert.ok(['.apk','.aab','.ipa'].includes(extension));
 await fs.writeFile('.test-cache/store-provenance/'+id+extension,bytes);
 evidence.builds.push({...metadata,artifactAccessible:true,artifactBytes:bytes.length,artifactSha256:createHash('sha256').update(bytes).digest('hex'),artifactFilename:id+extension});
 console.log('Verified existing '+b.platform+' '+b.distribution+' artifact '+id);
}
await fs.writeFile('docs/cutover-evidence-2026-10-03/eas-artifact-provenance.json',JSON.stringify(evidence,null,2)+'\n');
