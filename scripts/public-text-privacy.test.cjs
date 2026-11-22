const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'publicTextPrivacy.mjs')).href);

test('exact house numbers are removed from a public description, street names stay', async () => {
  const { scrubPublicText } = await load();
  const out = scrubPublicText('Iznošenje stvari iz stana u Lenke Dunđerski 11 u Novom Sadu i unošenje u Dositejevoj 12.');
  assert.equal(out.text, 'Iznošenje stvari iz stana u Lenke Dunđerski u Novom Sadu i unošenje u Dositejevoj.');
  assert.deepEqual(out.removed, ['EXACT_ADDRESS']);
  assert.equal(scrubPublicText('Montaža police, ulica Cara Dušana 5a, Zemun').text, 'Montaža police, ulica Cara Dušana, Zemun');
  assert.equal(scrubPublicText('Bulevar oslobođenja br. 46, stan 3').text.startsWith('Bulevar oslobođenja,'), true);
});

test('phones, e-mail, links and handles are removed and reported once', async () => {
  const { scrubPublicText } = await load();
  for (const raw of ['Pozovite me na 064 123 4567 posle 17h', 'Pozovite me na +381641234567 posle 17h', 'Pozovite me na 064/123-45-67 posle 17h']) {
    const out = scrubPublicText(raw);
    assert.equal(out.text, 'Pozovite me na posle 17h', raw);
    assert.deepEqual(out.removed, ['CONTACT']);
  }
  assert.equal(scrubPublicText('Pišite na pera.peric@gmail.com ili instagram @pera_majstor').text, 'Pišite na ili instagram');
  assert.equal(scrubPublicText('Detalji na www.primer.rs').text, 'Detalji na');
});

test('dates, times, counts, sizes and prices are never treated as contacts or addresses', async () => {
  const { scrubPublicText } = await load();
  for (const keep of [
    'Za 28.11. trebaju mi 4 momka',
    'Prevod 5 strana sa nemačkog, 3.000 RSD',
    'Selidba 28.11.2026. u 17:00, plaćam 5500 po osobi',
    'Subota 17 h, dva radnika',
    'Krečenje 45 m2 u Novom Sadu',
    'Treba mi 2 radnika na 3 dana',
    'Ukupno 12000 dinara',
    'Renoviranje kupatila, 150000 RSD',
    'Subota 22.',
  ]) {
    const out = scrubPublicText(keep);
    assert.equal(out.text, keep, keep);
    assert.deepEqual(out.removed, [], keep);
  }
});

test('turn guard scrubs only title/description and tells the user once', async () => {
  const { scrubPublicTaskProposals } = await load();
  const turn = {
    assistantMessage: 'Za koji datum planirate selidbu?',
    proposals: [
      { key: 'need.title', value: 'Selidba Dositejeva 12', displayValue: 'Selidba Dositejeva 12' },
      { key: 'need.description', value: 'Iznošenje iz Lenke Dunđerski 11, pozvati 0641234567.' },
      { key: 'need.price_rsd', value: 5500 },
    ],
  };
  const { turn: out, removed } = scrubPublicTaskProposals(turn);
  assert.deepEqual(removed.sort(), ['CONTACT', 'EXACT_ADDRESS']);
  assert.equal(out.proposals[0].value, 'Selidba Dositejeva');
  assert.equal(out.proposals[0].displayValue, 'Selidba Dositejeva');
  assert.equal(out.proposals[1].value, 'Iznošenje iz Lenke Dunđerski, pozvati.');
  assert.equal(out.proposals[2].value, 5500);
  assert.match(out.assistantMessage, /Tačnu adresu sam izostavio/);
  assert.match(out.assistantMessage, /kontakte ne objavljujemo/);
  assert.ok(out.assistantMessage.endsWith('Za koji datum planirate selidbu?'), 'the question stays last');
  const clean = { assistantMessage: 'Važi.', proposals: [{ key: 'need.description', value: 'Prevod 5 strana' }] };
  assert.equal(scrubPublicTaskProposals(clean).turn, clean, 'nothing removed leaves the turn untouched');
});
