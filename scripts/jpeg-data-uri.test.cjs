'use strict';
// The fast native path and the fallback produce the same data URI (owner, 23.11.2026: scrolling stalled on photos).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHarness}=require('./ux-component-harness.cjs');
const {jpegDataUri}=createHarness().load('src/ui/media/jpegDataUri.ts');
test('native btoa path equals the byte-by-byte fallback for every length remainder', () => {
  for (const n of [1,2,3,4,5,40000,70001]) {
    const bytes=new Uint8Array(n).map((_,i)=>(i*37+11)&255).buffer;
    const fast=jpegDataUri(bytes);
    const saved=globalThis.btoa; globalThis.btoa=undefined;
    try { assert.equal(fast, jpegDataUri(bytes), String(n)); } finally { globalThis.btoa=saved; }
    assert.equal(fast, 'data:image/jpeg;base64,'+Buffer.from(new Uint8Array(bytes)).toString('base64'));
  }
});
