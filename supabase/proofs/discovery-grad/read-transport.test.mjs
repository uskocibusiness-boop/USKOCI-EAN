import test from 'node:test';
import assert from 'node:assert/strict';
import {readWithSocketRecovery} from './read-transport.mjs';
const socket = {status: 0, error: {code: '', message: 'TypeError: fetch failed', details: 'SocketError: other side closed (UND_ERR_SOCKET)'}};

test('one socket reconnect preserves the exact read and reports both outcomes', async () => {
  const request = Object.freeze({mode: 'PAGE', anchor: Object.freeze({publishedThrough: '2026-10-09T00:00:00Z'})});
  const calls = [], observations = [], success = {status: 200, error: null, data: {items: []}};
  const read = () => { calls.push(request); return Promise.resolve(calls.length === 1 ? socket : success); };
  assert.equal(await readWithSocketRecovery(read, (...entry) => observations.push(entry)), success);
  assert.equal(calls.length, 2); assert.ok(calls.every(item => item === request));
  assert.deepEqual(observations, [['RETRYING', socket], ['RECOVERED', success]]);
});
test('HTTP/SQL errors, timeout and success never trigger transport recovery', async () => {
  for (const response of [{...socket, status: 401}, {...socket, status: 500}, {...socket, error: {...socket.error, code: 'PT409'}},
    {status: 0, error: {code: '', details: 'TimeoutError'}}, {status: 0, error: {details: 'UND_ERR_CONNECT_TIMEOUT'}},
    {status: 200, error: null, data: {malformed: true}}]) {
    let calls = 0;
    assert.equal(await readWithSocketRecovery(async () => { calls++; return response; }, () => assert.fail('unexpected retry')), response);
    assert.equal(calls, 1);
  }
});
test('a second socket failure is final, never a loop', async () => {
  let calls = 0; const observations = [];
  assert.equal(await readWithSocketRecovery(async () => { calls++; return socket; }, (...x) => observations.push(x)), socket);
  assert.equal(calls, 2); assert.deepEqual(observations.map(x => x[0]), ['RETRYING', 'FAILED']);
});
test('a thrown retry still reports failure and preserves the exception', async () => {
  let calls = 0; const observations = [], failure = new Error('fixture');
  await assert.rejects(readWithSocketRecovery(async () => { if (++calls === 1) return socket; throw failure; }, (...x) => observations.push(x)), error => error === failure);
  assert.equal(calls, 2); assert.deepEqual(observations, [['RETRYING', socket], ['THREW', null]]);
});
