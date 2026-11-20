'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/ui/notifications/publicInboxCopy.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true,
});
assert.deepEqual(compiled.diagnostics, []);
const uuid = '00000000-0000-4000-8000-000000000001';
const publicPushTarget = value => value && value.kind === 'INBOX' && value.eventType === 'OPPORTUNITY_AVAILABLE'
  && value.eventId === uuid ? { kind: 'OPPORTUNITY_EVENT', eventId: uuid } : null;
const sandbox = { exports: {}, require: name => name === './pushTarget' ? { publicPushTarget } : {} };
vm.runInNewContext(compiled.outputText, sandbox, { timeout: 1000 });
const { isPublicInboxCopy, isPublicInboxNotification } = sandbox.exports;

function notification(title, body) {
  return { request: { identifier: 'push-1', trigger: { type: 'push' }, content: {
    title, body, data: { kind: 'INBOX', eventType: 'OPPORTUNITY_AVAILABLE', eventId: uuid }, sound: 'default',
  } } };
}

test('normal opportunity notifications remain admitted', () => {
  const title = 'Novi zadatak za tebe', body = 'Pojavila se nova prilika koja može da ti odgovara.';
  assert.equal(isPublicInboxCopy(title, body), true);
  assert.equal(isPublicInboxNotification(notification(title, body)), true);
});

test('retired urgent notification titles are not accepted or shown in foreground', () => {
  for (const body of [
    'Pojavila se nova prilika koja može da ti odgovara.',
    'Pojavila se nova prilika koja može da Vam odgovara.',
    'Pojavio se novi zadatak koji može da Vam odgovara.',
  ]) {
    const value = notification('HITNO — nova prilika', body);
    assert.equal(isPublicInboxCopy(value.request.content.title, body), false);
    assert.equal(isPublicInboxNotification(value), false);
  }
  assert.doesNotMatch(source, /HITNO|NEHITNO|urgent/i);
});
