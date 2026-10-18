const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// PKG-012 — one current source/documentation authority; legacy isolated, not deleted.
const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(ROOT, relative));
const ENTRY_MAP = 'docs/implementation/execution/CURRENT_ENTRY_MAP_20260916.md';
const HISTORICAL = [
  'HANDOFF.md',
  'docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md',
  'docs/implementation/CURRENT_IMPLEMENTATION_STATUS.md',
  'docs/implementation/IMPLEMENTATION_CONTINUITY.md',
  'docs/implementation/v5-ai-first/EXECUTION.md',
];

function walk(directory, out = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(full, out); }
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

test('the current entry map exists and names the reconciliation, the Ledger and the design authority', () => {
  assert.ok(exists(ENTRY_MAP), 'entry map missing');
  const text = read(ENTRY_MAP);
  for (const needle of ['PACKAGE_RECONCILIATION_20260916.md', 'EXECUTION_LEDGER.jsonl', 'PKG011B_PREMIUM_UNUTRASNJOST_20260916.md', 'Legacy inventory']) {
    assert.ok(text.includes(needle), `entry map does not mention ${needle}`);
  }
});

test('every historical entry document opens with the HISTORICAL banner that points to the entry map', () => {
  for (const relative of HISTORICAL) {
    const head = read(relative).split(/\r?\n/).slice(0, 3).join('\n');
    assert.ok(/HISTORICAL/.test(head), `${relative} lacks the HISTORICAL banner in its first lines`);
    assert.ok(head.includes('CURRENT_ENTRY_MAP_20260916.md'), `${relative} banner does not point to the entry map`);
  }
});

test('AGENTS.md points to the active resume and its single current owner manifest', () => {
  const agents = read('AGENTS.md');
  const current = JSON.parse(read('docs/current/CURRENT_BASELINE_20261018.json'));
  assert.equal(current.activeOwners.workInstructions, 'AGENTS.md');
  for (const entry of ['docs/current/README_USKOCI_LIVE_MASTER_PLAN.md', current.activeOwners.workStatus,
    current.activeOwners.designCanon]) {
    assert.ok(agents.includes(entry), `AGENTS.md does not name current owner ${entry}`);
    assert.ok(fs.statSync(path.join(ROOT, entry)).isFile(), `Missing current owner ${entry}`);
  }
});

test('the fake data source is reachable only through the explicit composition boundary', () => {
  const importers = walk(path.join(ROOT, 'src')).filter(file => {
    const text = fs.readFileSync(file, 'utf8');
    return /from '\.\.?\/(?:.*\/)?lazniIzvor'|from '\.\.?\/(?:.*\/)?lazniAi'/.test(text);
  }).map(file => path.relative(ROOT, file).replace(/\\/g, '/')).sort();
  assert.deepEqual(importers, ['src/data/index.ts', 'src/data/lazniIzvor.ts'], `unexpected fake-source importers: ${importers.join(', ')}`);
  const index = read('src/data/index.ts');
  assert.ok(index.includes("process.env.EXPO_PUBLIC_USE_FAKE_SOURCE === '1'"), 'fake source must require the explicit DEV switch');
  assert.ok(index.includes('SUPABASE_NIJE_KONFIGURISAN'), 'production path must fail loudly without Supabase config');
});

test('acceptance builds and mobile proofs exclude the fake source', () => {
  assert.ok(/EXPO_PUBLIC_USE_FAKE_SOURCE:\s*'0'/.test(read('.github/workflows/build-android-dev-apk.yml')), 'APK build must set the fake source switch to 0');
  const proofs = fs.readdirSync(path.join(ROOT, '.github/workflows')).filter(name => /mobile-proof\.yml$/.test(name));
  for (const name of proofs) {
    const text = read(`.github/workflows/${name}`);
    if (text.includes('EXPO_PUBLIC_USE_FAKE_SOURCE')) assert.ok(text.includes('EXPO_PUBLIC_USE_FAKE_SOURCE=0'), `${name} must not enable the fake source`);
  }
});

test('legacy routes resolve explicitly until PKG-023 retires them with parity and approval', () => {
  assert.ok(exists('src/app/(app)/pregled-nacrta.tsx'), 'pregled-nacrta route file missing');
  assert.ok(read('src/app/(app)/_layout.tsx').includes('name="pregled-nacrta"'), 'pregled-nacrta must stay a registered hidden tab route');
  const prijave = read('src/app/prijave.tsx');
  assert.ok(/Redirect/.test(prijave) && prijave.includes("'/auth'"), 'prijave must remain an explicit redirect');
});
