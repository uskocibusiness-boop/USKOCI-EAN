'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'aiRoleHandoff.ts'), 'utf8');
const { outputText, diagnostics } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true,
});
assert.equal(diagnostics.length, 0);
const sandboxModule = { exports: {} };
vm.runInNewContext(outputText, { module: sandboxModule, exports: sandboxModule.exports, Date }, { timeout: 3000 });
const { isExplicitWorkerOffer, stageWorkerText, takeWorkerText } = sandboxModule.exports;
for (const [input, expected] of [
  ['Želim da ponudim svoje usluge', true],
  ['Poželim da ponudim svoje usluge', true],
  ['Нудим приватне часове француског', true],
  ['Желим да нудим услуге', true],
  ['Radim kao moler', true],
  ['Držim časove francuskog', true],
  ['Nudim usluge', true],
  ['Treba mi profesor francuskog', false],
  ['Treba mi neko ko nudi privatne časove', false],
  ['Nudim prevoz, ali treba mi nosač', false],
  ['Ne nudim prevoz', false],
  ['Prevoz veš mašine za 3.000 dinara', false],
  ['Ćao, zanima me nešto', false],
  ['Trebaju mi dva nosača', false],
  ['Želim da mi neko okreči sobu', false],
]) test('role intent: '+input, () => assert.equal(isExplicitWorkerOffer(input), expected));
const owner = { accountId: '22222222-2222-4222-8222-222222222222', accountRevision: 8 };
const token = '11111111-1111-4111-8111-111111111111';
test('one-use token, account generation and no automatic send', () => {
  assert.equal(stageWorkerText({ ...owner, token, text: 'Nudim privatne časove' }, 1000), true);
  assert.equal(takeWorkerText({ ...owner, token: '33333333-3333-4333-8333-333333333333' }, 1001), null);
  assert.equal(takeWorkerText({ ...owner, accountRevision: 9, token }, 1001), null);
  assert.equal(takeWorkerText({ ...owner, token }, 1002), 'Nudim privatne časove');
  assert.equal(takeWorkerText({ ...owner, token }, 1002), null);
});
test('expired text is discarded', () => {
  assert.equal(stageWorkerText({ ...owner, token, text: 'Radim kao moler' }, 1000), true);
  assert.equal(takeWorkerText({ ...owner, token }, 301001), null);
});
test('mixed intent cannot be transferred', () => {
  assert.equal(stageWorkerText({ ...owner, token, text: 'Nudim prevoz ali treba mi radnik' }, 1000), false);
});
