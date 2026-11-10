'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..', 'docs', 'legal', 'rc3-review');
const names = [
  '01_uslovi_koriscenja.html',
  '02_politika_privatnosti.html',
  '03_pravila_zajednice_i_bezbednost.html',
  '04_podrska_prijave_i_prigovori.html',
  '05_brisanje_naloga.html',
  '06_rangiranje_i_preporuke.html',
  '07_ai_lokacija_dozvole.html',
  '08_operater_i_kontakt.html',
  '09_prava_potrosaca_i_odustanak.html',
];
const documents = names.map(name => ({ name, html: fs.readFileSync(path.join(root, name), 'utf8') }));
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('RC3 review files are complete and not presented as active policies', () => {
  assert.equal(documents.length, 9);
  for (const { name, html } of documents) {
    assert.ok(html.length > 2000, name + ' is truncated');
    assert.match(html, /<html lang="sr-Latn">/);
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
    assert.match(html, /RC3/);
    assert.match(html, /nije na snazi/);
    assert.match(html, /uskoci\.support@gmail\.com/);
    assert.match(html, /<h1 id="doc-\d\d">/);
    assert.match(html, /<\/html>\s*$/);
    assert.doesNotMatch(html, /<script\b/i);
    assert.doesNotMatch(html, /href="#"/);
    assert.doesNotMatch(html, /100% (?:legal|usklađen|sigur)/i);
  }
});

test('Review-only index and links resolve locally', () => {
  assert.match(index, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(index, /nije javno aktivirana/i);
  for (const name of names) {
    assert.match(index, new RegExp(name.replaceAll('.', '\\.'), 'g'));
  }
  for (const { name, html } of documents) {
    const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    for (const href of links) {
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      const local = href.split('#')[0].split('?')[0];
      assert.ok(fs.existsSync(path.join(root, local)), name + ' broken link ' + href);
    }
  }
});

test('Unresolved mandatory facts remain visibly unresolved, not invented', () => {
  const entire = index + documents.map(x => x.html).join('\n');
  for (const key of ['DATUM_PRIMENE','ADRESA_ZA_PISMENA','TELEFON_OPERATERA','REGISTAR_PRENOSA_I_GARANCIJA']) {
    assert.match(entire, new RegExp('\\{\\{' + key + '\\}\\}'), key);
  }
  assert.doesNotMatch(entire, /<meta name="robots" content="index,follow">/);
  assert.doesNotMatch(entire, /pravni dokumenti su aktivirani/i);
});
