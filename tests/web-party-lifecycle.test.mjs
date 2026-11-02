import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {isPartyPast}=loadTs('web/src/partyLifecycle.ts');
const now=Date.parse('2026-11-01T22:00:00.000Z');
test('past classification uses the exact saved timestamp, including earlier on the same day',()=>{
 assert.equal(isPartyPast('2026-11-01T21:59:59.999Z',now),true);
 assert.equal(isPartyPast('2026-11-01T22:00:00.000Z',now),false);
 assert.equal(isPartyPast('2026-11-01T22:00:00.001Z',now),false);
 assert.equal(isPartyPast('2026-11-01T15:59:59-06:00',now),true);
 assert.equal(isPartyPast('2026-11-01T17:00:00-06:00',now),false);
});
test('crossing the boundary or rescheduling changes the view without touching party contents',()=>{
 const original={date:'2026-11-01T22:00:00.000Z',items:[{id:'dessert',claimedBy:'Synthetic guest'}],rsvps:[{status:'yes',attendeeCount:2}],appearance:{image:{id:'opaque-photo'}}};
 assert.equal(isPartyPast(original.date,now+1),true);
 const rescheduled={...original,date:'2026-11-02T22:00:00Z'};
 assert.equal(isPartyPast(rescheduled.date,now+1),false);
 assert.equal(rescheduled.items,original.items);assert.equal(rescheduled.rsvps,original.rsvps);assert.equal(rescheduled.appearance,original.appearance);
});
test('undated, blank and unparseable dates remain active',()=>{
 for(const value of [undefined,'','not-a-date','2026-99-99'])assert.equal(isPartyPast(value,now),false);
});
