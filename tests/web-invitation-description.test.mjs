import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const compiled=buildSync({entryPoints:['web/src/PartyAppearance.tsx'],bundle:true,platform:'node',format:'cjs',write:false,loader:{'.css':'empty'},external:['react','react/jsx-runtime']}).outputFiles[0].text;
const module={exports:{}};vm.runInNewContext(compiled,{module,exports:module.exports,require});
const {AppearancePoster}=module.exports;
const note='Bon fire and Karaoke.';
for(const layout of ['illustrated','photo','elegant'])for(const preview of [false,true])test(`${layout} ${preview?'preview':'invitation'} uses only the exact host note, with no empty description element`,()=>{
 const party={id:'synthetic-friendsgiving',title:'Synthetic Friendsgiving',appearance:{version:1,design:'partyplus',layout,accent:'navy',font:'editorial',artwork:'partyplus'}};
 const html=renderToStaticMarkup(createElement(AppearancePoster,{party:{...party,notes:note},preview}));
 assert.equal(html.split(note).length-1,1);assert.match(html,/class="ap-party-description"/);
 assert.ok(!/A little something to look forward to\.|Good company\. You included\./.test(html));
 for(const notes of [undefined,'',' \n\t ']){
  const blank=renderToStaticMarkup(createElement(AppearancePoster,{party:{...party,notes},preview}));
  assert.ok(!blank.includes('ap-party-description'));assert.ok(!blank.includes(note));
  assert.ok(!/A little something to look forward to\.|Good company\. You included\./.test(blank));
 }
 const multiline='Bon fire and Karaoke.\nBring <your favorite> song & smile.';
 const escaped=renderToStaticMarkup(createElement(AppearancePoster,{party:{...party,notes:multiline},preview}));
 assert.ok(escaped.includes('Bon fire and Karaoke.\nBring &lt;your favorite&gt; song &amp; smile.'));
});
