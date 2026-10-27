import test from 'node:test';
import assert from 'node:assert/strict';
import { runInBackground } from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

async function isolated(run) {
  const runtime = globalThis.EdgeRuntime, warn = console.warn;
  const warnings = [];
  delete globalThis.EdgeRuntime;
  console.warn = (...args) => warnings.push(args);
  try { await run(warnings); }
  finally {
    console.warn = warn;
    if (runtime === undefined) delete globalThis.EdgeRuntime;
    else globalThis.EdgeRuntime = runtime;
  }
}

test('local background fallback retains the successful result without logging', async () => isolated(async warnings => {
  assert.equal(await runInBackground(Promise.resolve(7)), 7);
  assert.deepEqual(warnings, []);
}));

test('background failure logs only a fixed status, not exception text', async () => isolated(async warnings => {
  await runInBackground(Promise.reject(new Error('SYNTHETIC_PRIVATE_PROVIDER_BODY')));
  assert.deepEqual(warnings, [['BG_TAXONOMY_ARCHITECT_WARN', 'FAILED']]);
}));

test('background failure never accesses a rejected object message getter', async () => isolated(async warnings => {
  let read = false;
  const rejection = { get message() { read = true; throw new Error('SYNTHETIC_GETTER_FAILURE'); } };
  await assert.doesNotReject(runInBackground(Promise.reject(rejection)));
  assert.equal(read, false);
  assert.deepEqual(warnings, [['BG_TAXONOMY_ARCHITECT_WARN', 'FAILED']]);
}));

test('a failed warning sink cannot turn handled background failure into a rejection', async () => isolated(async () => {
  console.warn = () => { throw new Error('SYNTHETIC_LOG_FAILURE'); };
  await assert.doesNotReject(runInBackground(Promise.reject(new Error('SYNTHETIC_OPERATION_FAILURE'))));
}));

test('Edge runtime receives the guarded promise without blocking the foreground', async () => isolated(async warnings => {
  let reject, registered;
  const work = new Promise((_, no) => { reject = no; });
  globalThis.EdgeRuntime = { waitUntil(promise) { registered = promise; } };
  await runInBackground(work);
  assert.ok(registered instanceof Promise);
  assert.deepEqual(warnings, []);
  reject(new Error('SYNTHETIC_PRIVATE_BACKGROUND_ERROR'));
  await assert.doesNotReject(registered);
  assert.deepEqual(warnings, [['BG_TAXONOMY_ARCHITECT_WARN', 'FAILED']]);
}));
