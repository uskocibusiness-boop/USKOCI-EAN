const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '../..');
const template = fs.readFileSync(path.join(root, 'docs/control/tabla.template.html'), 'utf8');
const state = JSON.parse(fs.readFileSync(path.join(root, 'docs/control/stanje.json'), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const markup = '<img data-proof="element" src="data:," onerror="window.__proof=1">';
const attribute = 'sivo" data-proof="attribute" onmouseover="window.__proof=1';
const encode = value => JSON.stringify(value).replace(/</g, '\\u003c');
async function open(file) {
  let snapshot, saved;
  const errors = [];
  const html = file || template.replace('__STANJE__', encode(state));
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://control.invalid/',
    virtualConsole: new VirtualConsole().on('jsdomError', e => errors.push(e)),
    beforeParse(window) {
      window.claude = { use: async name => name === 'db' ? { doc: () => ({
        onSnapshot: fn => { snapshot = fn; }, set: async data => { saved = data; }
      }) } : { isOwner: () => true, canEdit: () => true } };
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  return { dom, errors, shared(data) { snapshot({ exists: true, data: () => ({ stanje: JSON.stringify(data) }) }); },
    async upload(data) {
      const input = dom.window.document.getElementById('fajl');
      Object.defineProperty(input, 'files', { configurable: true, value: [{ text: async () => JSON.stringify(data) }] });
      input.dispatchEvent(new dom.window.Event('change'));
      await new Promise(resolve => setImmediate(resolve));
      return saved;
    } };
}
function nextState() {
  const s = clone(state);
  s.meta.osvezeno = '9999-12-31T23:59:59Z';
  return s;
}
function noMarkup(page) {
  assert.equal(page.dom.window.document.querySelector('[data-proof]'), null, 'imported text became an element or attribute');
  assert.equal(page.dom.window.__proof, undefined);
}
test('legitimate embedded and newer shared state keep rows, counts and status text', async () => {
  const page = await open();
  try {
    assert.equal(page.errors.length, 0);
    assert.equal(page.dom.window.document.querySelectorAll('details.row').length, state.redovi.length);
    const s = nextState(); s.counts.PROBLEM = 7; s.meta.head_poruka = 'Novi pregled <samo tekst> & detalji';
    page.shared(s);
    assert.equal(page.dom.window.document.querySelector('#tiles b').textContent, '7');
    assert.ok(page.dom.window.document.querySelector('#meta').textContent.includes(s.meta.head_poruka));
    noMarkup(page);
  } finally { page.dom.window.close(); }
});
const injections = [
 ['count', s => { s.counts.PROBLEM = markup; }],
 ['edge version', s => { s.meta.server.edge = [{slug:'uskoci-test', version:markup}]; }],
 ['snapshot count', s => { s.snimak.fajlova = markup; }],
 ['light attribute', s => { s.redovi[0].lights.nacrt = attribute; }],
 ['summary count', s => { s.tokovi.sazetak.tacno = markup; }],
 ['route total', s => { s.rute.ukupno = markup; s.rute.u_redovima = markup; }]
];
for (const [name, mutate] of injections) test('shared snapshot treats ' + name + ' as data', async () => {
  const page = await open();
  try { const s = nextState(); mutate(s); page.shared(s); noMarkup(page); }
  finally { page.dom.window.close(); }
});
test('owner import uses the same safe renderer after storage acknowledgement', async () => {
  const page = await open();
  try {
    const s = nextState(); s.counts.PROBLEM = markup;
    const saved = await page.upload(s);
    assert.equal(saved.stanje, JSON.stringify(s));
    noMarkup(page);
    assert.match(page.dom.window.document.querySelector('#ucitaj-poruka').textContent, /Učitano/);
  } finally { page.dom.window.close(); }
});
test('HTML entities in imported text are not decoded into markup', async () => {
  const page = await open();
  try {
    const s = nextState(); s.counts.PROBLEM = '&lt;img data-proof="entity"&gt;';
    page.shared(s); noMarkup(page);
    assert.equal(page.dom.window.document.querySelector('#tiles b').textContent, s.counts.PROBLEM);
  } finally { page.dom.window.close(); }
});
test('generated table carries exactly the template renderer with its embedded snapshot', () => {
  const generated = fs.readFileSync(path.join(root, 'docs/control/out/tabla.html'), 'utf8');
  const data = generated.match(/(<script type="application\/json" id="data">)([\s\S]*?)(<\/script>)/);
  assert.ok(data);
  const reconstructed = generated.replace(data[0], data[1] + '__STANJE__' + data[3]);
  assert.equal(reconstructed.replace(/\r\n/g, '\n'), template.replace(/\r\n/g, '\n'));
});
test('historical snapshots may omit optional overlays', async () => {
  const page = await open();
  try {
    const s = nextState();
    for (const key of ['snimak', 'tokovi', 'nivoi', 'rute', 'praznine', 'ci']) delete s[key];
    page.shared(s);
    assert.equal(page.dom.window.document.querySelectorAll('details.row').length, state.redovi.length);
    assert.match(page.dom.window.document.querySelector('#tokovi').textContent, /pre nego/);
    noMarkup(page);
  } finally { page.dom.window.close(); }
});
test('unknown and inherited status keys never masquerade as verified lights', async () => {
  const page = await open();
  try {
    const s = nextState();
    s.redovi[0].lights.nacrt = 'constructor';
    s.redovi[0].lights.ekran = 'zeleno crveno';
    page.shared(s);
    const icons = page.dom.window.document.querySelectorAll('details.row .lights .dot');
    assert.equal(icons[0].className, 'dot sivo');
    assert.equal(icons[1].className, 'dot sivo');
    assert.match(icons[0].getAttribute('aria-label'), /nije provereno/);
  } finally { page.dom.window.close(); }
});
