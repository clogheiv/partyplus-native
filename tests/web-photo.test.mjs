import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {validatePhotoHeader,photoDimensions,partyPhotoLimit}=loadTs('web/src/draftMedia.ts');
test('personal image admission checks content signatures instead of trusting a filename or MIME label',()=>{
 assert.equal(validatePhotoHeader(Uint8Array.from([255,216,255,224]),'image/jpeg'),true);
 assert.equal(validatePhotoHeader(Uint8Array.from([137,80,78,71,13,10,26,10]),'image/png'),true);
 assert.equal(validatePhotoHeader(new TextEncoder().encode('RIFF0000WEBP'),'image/webp'),true);
 for(const mime of ['image/jpeg','image/png','image/webp','image/svg+xml'])assert.equal(validatePhotoHeader(new TextEncoder().encode('<svg onload="bad()"/>'),mime),false);
 assert.equal(validatePhotoHeader(Uint8Array.from([255,216,255]),'image/png'),false);
 assert.equal(validatePhotoHeader(new Uint8Array(),'image/png'),false);
});
test('phone and landscape photo dimensions stay proportional and bounded without upscaling small images',()=>{
 assert.deepEqual(photoDimensions(4032,3024),{width:1600,height:1200});
 assert.deepEqual(photoDimensions(3024,4032),{width:1200,height:1600});
 assert.deepEqual(photoDimensions(400,300),{width:400,height:300});
 assert.equal(partyPhotoLimit,1_500_000);
 assert.throws(()=>photoDimensions(0,300));assert.throws(()=>photoDimensions(10000,10000));
});
