import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

// Faithful resizing/encoding of the supplied originals; no redraw, crop or recolor.
// Uses the image utility already bundled with Expo, with no new dependency/service.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const Jimp=require(require.resolve('jimp-compact',{paths:[path.dirname(require.resolve('@expo/image-utils'))]}));
const output=path.join(root,'web/assets/brand');
await fs.mkdir(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources={icon:'assets/partyplus-icon.png',banner:'invite-web/assets/PartyPlusbanner.png'};
const records={};
for(const [kind,relative] of Object.entries(sources)){
  const bytes=await fs.readFile(path.join(root,relative));
  const image=await Jimp.read(bytes);
  records[kind]={path:relative,sha256:hash(bytes),bytes:bytes.length,width:image.bitmap.width,height:image.bitmap.height};
}
const variants=[
  ['partyplus-icon.png','icon',256,'image/png'],
  ['favicon.png','icon',48,'image/png'],
  ['apple-touch-icon.png','icon',180,'image/png'],
  ['partyplus-banner.jpg','banner',1440,'image/jpeg'],
  ['partyplus-banner-small.jpg','banner',768,'image/jpeg'],
];
const derivatives=[];
for(const [name,kind,width,mime] of variants){
  const image=await Jimp.read(path.join(root,sources[kind]));
  image.resize(width,Jimp.AUTO,Jimp.RESIZE_BICUBIC);
  if(mime==='image/jpeg')image.quality(86);
  const bytes=await image.getBufferAsync(mime);
  await fs.writeFile(path.join(output,name),bytes);
  derivatives.push({file:name,source:kind,width:image.bitmap.width,height:image.bitmap.height,bytes:bytes.length,sha256:hash(bytes),transformation:'Proportional resize only; full original composition and colors retained.',...(mime==='image/jpeg'?{jpegQuality:86}:{})});
}
const provenance={preparedAt:'2026-11-01',artwork:'Original PartyPlus repository artwork supplied by the owner. No generated replacement artwork.',sources:records,derivatives};
await fs.writeFile(path.join(output,'SOURCES.json'),JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify({sourceBytes:Object.values(records).reduce((n,r)=>n+r.bytes,0),derivatives:derivatives.map(({file,width,height,bytes})=>({file,width,height,bytes})),totalBytes:derivatives.reduce((n,r)=>n+r.bytes,0)},null,2));
