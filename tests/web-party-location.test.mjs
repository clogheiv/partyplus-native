import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {partyLocationText,partyLocationMapAddress,emptyLocationDetails}=loadTs('web/src/partyLocation.ts');
const {partyMapLinks}=loadTs('web/src/editorDraft.ts');

test('structured address displays every entered component and drives both map links',()=>{
 const party={location:'Old room',address:'Old street',locationDetails:{version:1,streetAddress:' 14 Synthetic Lane ',city:' Test City ',zipCode:' 01234 '}};
 assert.equal(partyLocationText(party),'14 Synthetic Lane, Test City, 01234');
 const links=partyMapLinks(partyLocationMapAddress(party));
 assert.equal(new URL(links.map).searchParams.get('query'),'14 Synthetic Lane, Test City, 01234');
 assert.equal(new URL(links.directions).searchParams.get('destination'),'14 Synthetic Lane, Test City, 01234');
});
test('older freeform text is never parsed, rewritten or silently discarded',()=>{
 const party={location:'Meet at the old oak, west gate',address:'123 Main St, upstairs; ask at desk'};
 assert.equal(partyLocationText(party),'Meet at the old oak, west gate, 123 Main St, upstairs; ask at desk');
 assert.equal(partyLocationMapAddress(party),party.address);
 assert.equal(partyLocationText({location:'Same exact text',address:'Same exact text'}),'Same exact text');
 assert.equal(party.location,'Meet at the old oak, west gate');
});
test('explicit blank replacement does not revive old address and partial values remain useful',()=>{
 assert.equal(partyLocationText({location:'Old',address:'Stale',locationDetails:emptyLocationDetails()}),'');
 assert.equal(partyLocationMapAddress({address:'Stale',locationDetails:emptyLocationDetails()}),'');
 assert.equal(partyLocationText({locationDetails:{...emptyLocationDetails(),city:'Test City'}}),'Test City');
});
