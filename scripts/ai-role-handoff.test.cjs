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
const { isExplicitWorkerOffer } = sandboxModule.exports;
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
  ['Da li ovde mogu da nudim prevoz?', false],
  ['Да ли овде могу да нудим превоз', false],
  ['Kako mogu da nudim časove?', false],
  ['Mogu li da nudim prevoz', false],
  ['Nudim časove. Kako radi aplikacija?', false],
  ['Ne želim da radim kao moler', false],
  ['Не желим да радим као молер', false],
  ['Više ne držim časove francuskog', false],
  ['Nudim prevoz, ne radim utovar', true],
  ['Нудим превоз, не радим утовар', true],
  ['Držim časove, ne radim vikendom', true],
  ['Nudim prevoz, nisam slobodan nedeljom', true],
  ['Nudim prevoz, ali ipak ne želim da nudim prevoz', false],
  ['Neću da nudim prevoz', false],
  ['Radim kao pomoćnik pri selidbi, nemam kombi', true],
  ['Držim onlajn časove francuskog', true],
  ['Ćao.', false], ['Da.', false], ['Ne.', false], ['To je to.', false],
  ['Sutra.', false], ['Posle četiri.', false], ['Nemam kombi.', false],
  ['Samo utovar.', false], ['Mislim na evre.', false], ['Ne treba odvoz.', false],
  ['Može i petak.', false], ['I subotu bih mogao.', false], ['Promenio sam mišljenje.', false],
]) test('role intent: '+input, () => assert.equal(isExplicitWorkerOffer(input), expected));
const needScreen = fs.readFileSync(path.join(__dirname, '..', 'src/app/(app)/nova.tsx'), 'utf8');
const workerScreen = fs.readFileSync(path.join(__dirname, '..', 'src/app/(app)/profil/razgovor.tsx'), 'utf8');

test('cross-role navigation opens a blank conversation and never transfers the message', () => {
  assert.doesNotMatch(needScreen, /stageWorkerText|stageAiRoleText/u);
  assert.doesNotMatch(workerScreen, /stageAiRoleText/u);
  assert.match(needScreen, /params: \{ entryKey: noviUuidZahtevId\(\) \} \}\)\);/u);
  assert.match(workerScreen, /params:\{entryKey:noviUuidZahtevId\(\)\}\}\)\);/u);
  assert.match(needScreen, /ova poruka se neće preneti niti poslati/u);
  assert.match(workerScreen, /prethodna poruka se ne prenosi/u);
});
