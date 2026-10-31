// Isolate-only admission tests; not a hosted/Storage/Gemini/device acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaUploadAdmission} from '../../functions/_shared/mediaUploadAdmission.mjs';
const owned=()=>new AbortController();

test('FIFO image waiters never overlap the one WASM permit',async()=>{
 const gate=createMediaUploadAdmission({activeLimit:1,waitingLimit:2,waitMs:250});
 const a=owned(),b=owned(),c=owned(),first=await gate.acquire(a.signal);
 const order=[],second=gate.acquire(b.signal).then(r=>{order.push('second');return r;});
 const third=gate.acquire(c.signal).then(r=>{order.push('third');return r;});
 first();const two=await second;assert.deepEqual(order,['second']);
 two();const three=await third;assert.deepEqual(order,['second','third']);three();
});
test('full wait queue rejects only overflow and keeps original waiter',async()=>{
 const gate=createMediaUploadAdmission({activeLimit:1,waitingLimit:1,waitMs:250});
 const a=owned(),b=owned(),c=owned(),held=await gate.acquire(a.signal);
 const waiting=gate.acquire(b.signal);assert.equal(await gate.acquire(c.signal),null);
 held();const next=await waiting;assert.equal(typeof next,'function');next();
});
test('aborted waiter is removed before the next request is admitted',async()=>{
 const gate=createMediaUploadAdmission({activeLimit:1,waitingLimit:2,waitMs:250});
 const a=owned(),b=owned(),c=owned(),held=await gate.acquire(a.signal);
 const waiting=gate.acquire(b.signal),following=gate.acquire(c.signal);
 b.abort();assert.equal(await waiting,null);held();
 const next=await following;assert.equal(typeof next,'function');next();
});
test('timeout frees a queue slot and does not steal the active permit',async()=>{
 const gate=createMediaUploadAdmission({activeLimit:1,waitingLimit:1,waitMs:15});
 const a=owned(),b=owned(),c=owned(),held=await gate.acquire(a.signal);
 assert.equal(await gate.acquire(b.signal),null);held();
 const fresh=await gate.acquire(c.signal);assert.equal(typeof fresh,'function');fresh();
});
test('idempotent release cannot create two simultaneous owners',async()=>{
 const gate=createMediaUploadAdmission({activeLimit:1,waitingLimit:1,waitMs:25});
 const a=owned(),b=owned(),c=owned(),held=await gate.acquire(a.signal);
 const waiting=gate.acquire(b.signal);held();held();
 const next=await waiting;assert.equal(typeof next,'function');
 assert.equal(await gate.acquire(c.signal),null);next();
});
test('one photo and two voice uploads can run independently',async()=>{
 const photo=createMediaUploadAdmission({activeLimit:1,waitingLimit:0,waitMs:25});
 const voice=createMediaUploadAdmission({activeLimit:2,waitingLimit:0,waitMs:25});
 const a=owned(),b=owned(),c=owned(),d=owned();
 const p=await photo.acquire(a.signal),v1=await voice.acquire(b.signal),v2=await voice.acquire(c.signal);
 assert.equal(typeof p,'function');assert.equal(typeof v1,'function');assert.equal(typeof v2,'function');
 assert.equal(await voice.acquire(d.signal),null);p();v1();v2();
});
test('already aborted request never claims an idle slot',async()=>{
 const gate=createMediaUploadAdmission({activeLimit:1,waitingLimit:0,waitMs:25}),a=owned();a.abort();
 assert.equal(await gate.acquire(a.signal),null);
 const b=owned(),released=await gate.acquire(b.signal);
 assert.equal(typeof released,'function');released();
});
