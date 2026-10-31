import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {includePendingItem,partyMapLinks}=loadTs('web/src/editorDraft.ts');
test('save includes a typed item and quantity with a stable identity; Add then Save cannot duplicate it',()=>{
 const draft={id:'party',items:[{id:'ice',name:'Ice'}],pendingItemName:' Dessert ',pendingItemQty:' Serves 8 ',pendingItemId:'dessert'};
 const saved=includePendingItem(draft,()=>{throw Error('Reserved identity must be reused');});
 assert.deepEqual(saved.items,[{id:'ice',name:'Ice'},{id:'dessert',name:'Dessert',qty:'Serves 8'}]);
 assert.equal(saved.pendingItemName,'');assert.equal(saved.pendingItemQty,'');
 assert.deepEqual(includePendingItem(saved,()=>{throw Error('No second allocation');}),saved);
 assert.equal(draft.pendingItemName,' Dessert ');
});
test('pending text survives serialized draft recovery before auth and becomes one listed item',()=>{
 const recovered=JSON.parse(JSON.stringify({items:[],pendingItemName:'Chips',pendingItemQty:'2 bags',pendingItemId:'chips'}));
 const prepared=includePendingItem(recovered,()=>{throw Error('Must retain saved ID');});
 const returned=JSON.parse(JSON.stringify(prepared));
 assert.deepEqual(includePendingItem(returned,()=>{throw Error('No duplicate after auth');}).items,[{id:'chips',name:'Chips',qty:'2 bags'}]);
});
test('an existing reserved item does not duplicate and same names may still represent distinct items',()=>{
 assert.equal(includePendingItem({items:[{id:'a',name:'Cake'}],pendingItemName:'Cake',pendingItemId:'a'},()=> '').items.length,1);
 assert.equal(includePendingItem({items:[{id:'a',name:'Cake'}],pendingItemName:'Cake',pendingItemId:'b'},()=> '').items.length,2);
});
test('map and directions prefer the actual street address, encode it, and need no API credential',()=>{
 const links=partyMapLinks('Garden room','123 Test St, Chicago IL');
 assert.equal(new URL(links.map).searchParams.get('query'),'123 Test St, Chicago IL');
 assert.equal(new URL(links.directions).searchParams.get('destination'),'123 Test St, Chicago IL');
 assert.equal(new URL(links.map).searchParams.has('key'),false);
 assert.equal(partyMapLinks('',undefined),null);
 assert.equal(new URL(partyMapLinks('Test hall').map).searchParams.get('query'),'Test hall');
});
