'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const sourcePath = path.join(__dirname, '..', 'src', 'ui', 'location', 'LocationPointEditor.tsx');
const source = fs.readFileSync(sourcePath, 'utf8');

const parsed = ts.createSourceFile('LocationPointEditor.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// Extract only statements up to Props type definition (all the pure search/token/fallback functions)
const statementsToKeep = [];
for (const stmt of parsed.statements) {
  if (ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'Props') break;
  if (ts.isImportDeclaration(stmt)) continue;
  statementsToKeep.push(stmt.getText(parsed));
}

const extractedSource = statementsToKeep.join('\n\n');
const compiled = ts.transpileModule(extractedSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;

const context = {
  console,
  exports: {},
  module: { exports: {} },
  toSerbianLatin: (str) => {
    // Basic test fallback for toSerbianLatin if needed
    const cyr = 'абвгдђежзијклљмнњопрстћуфхцчџшАБВГДЂЕЖЗИЈКЛЉМНЊОПРСТЋУФХЦЧЏШ';
    const lat = ['a','b','v','g','d','đ','e','ž','z','i','j','k','l','lj','m','n','nj','o','p','r','s','t','ć','u','f','h','c','č','dž','š',
                 'A','B','V','G','D','Đ','E','Ž','Z','I','J','K','L','Lj','M','N','Nj','O','P','R','S','T','Ć','U','F','H','C','Č','Dž','Š'];
    let res = '';
    for (const ch of str) {
      const idx = cyr.indexOf(ch);
      res += idx >= 0 ? lat[idx] : ch;
    }
    return res;
  },
};

vm.runInNewContext(
  `
  ${compiled}
  this.candidateFitsSeed = candidateFitsSeed;
  this.resolveLocalPlaceFallback = resolveLocalPlaceFallback;
  this.normalizeConversationalPlaceQuery = normalizeConversationalPlaceQuery;
  this.searchTokens = searchTokens;
  `,
  context
);

test('LOCAL_PLACE_FALLBACKS: resolves specific POIs to precise coordinates before generic city center', () => {
  const savskaPosta = context.resolveLocalPlaceFallback('pošta u Savskoj');
  assert.ok(savskaPosta, 'Savska pošta must resolve');
  assert.equal(savskaPosta.latitude, 44.8086);
  assert.equal(savskaPosta.longitude, 20.4547);

  const takovskaPosta = context.resolveLocalPlaceFallback('Glavna pošta Takovska');
  assert.ok(takovskaPosta, 'Glavna pošta Takovska must resolve');
  assert.equal(takovskaPosta.latitude, 44.8115);
  assert.equal(takovskaPosta.longitude, 20.4682);

  const bgPosta = context.resolveLocalPlaceFallback('pošta Beograd');
  assert.ok(bgPosta, 'pošta Beograd must resolve to Glavna pošta rather than generic Trg Republike');
  assert.equal(bgPosta.latitude, 44.8115);
  assert.equal(bgPosta.longitude, 20.4682);

  const nsPosta = context.resolveLocalPlaceFallback('pošta Novi Sad');
  assert.ok(nsPosta, 'pošta Novi Sad must resolve to Glavna pošta Novi Sad');
  assert.equal(nsPosta.latitude, 45.2536);
  assert.equal(nsPosta.longitude, 19.8436);

  const bareBg = context.resolveLocalPlaceFallback('u Beogradu');
  assert.ok(bareBg, 'bare city fallback remains valid for pure city context');
  assert.equal(bareBg.latitude, 44.8125);
  assert.equal(bareBg.longitude, 20.4612);
});

test('candidateFitsSeed: matches POI + city queries with or without comma', () => {
  const candidate = 'Pošta 11000 Beograd 6, Savska 2, Savski Venac, Beograd, Centralna Srbija, Srbija';

  assert.equal(context.candidateFitsSeed('pošta, beograd', candidate), true, 'comma query matches');
  assert.equal(context.candidateFitsSeed('pošta beograd', candidate), true, 'space query matches both tokens');
  assert.equal(context.candidateFitsSeed('pošta savska', candidate), true, 'street + POI matches');
});

test('candidateFitsSeed: keeps bare city as context-only (never an auto-pin)', () => {
  const candidate = 'Pošta 11000 Beograd 6, Savska 2, Savski Venac, Beograd, Centralna Srbija, Srbija';
  assert.equal(context.candidateFitsSeed('beograd', candidate), false, 'bare city without POI must not match a specific building');
  assert.equal(context.candidateFitsSeed('novi sad', candidate), false, 'other bare city fails');
});

test('normalizeConversationalPlaceQuery: normalizes Serbian locative cases for POIs and landmarks', () => {
  assert.match(context.normalizeConversationalPlaceQuery('u pošti u Savskoj'), /Pošta.*Savska/);
  assert.match(context.normalizeConversationalPlaceQuery('u poštu na Dorćolu'), /Pošta.*Dorćol/);
  assert.match(context.normalizeConversationalPlaceQuery('kod pošte u Takovskoj'), /Pošta.*Takovska/);
});
