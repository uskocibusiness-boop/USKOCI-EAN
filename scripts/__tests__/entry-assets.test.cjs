'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { syncEntryAssets } = require('../sync-entry-reference-assets.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uskoci-entry-assets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'assets/brand/reference-entry');
  fs.cpSync(path.resolve(__dirname, '../../assets/brand/reference-entry'), source, { recursive: true });
  return { root, source };
}
test('installs byte-identical resources without a docs directory or historical HTML', t => {
  const { root, source } = fixture(t);
  assert.equal(syncEntryAssets(root), 3);
  assert.equal(fs.existsSync(path.join(root, 'docs')), false);
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'provenance.json')));
  for (const item of manifest.files) assert.deepEqual(fs.readFileSync(path.join(root, item.target)), fs.readFileSync(path.join(source, item.name)));
  assert.equal(syncEntryAssets(root), 3);
});
test('validates all hashes before writing even the first resource', t => {
  const { root, source } = fixture(t);
  fs.appendFileSync(path.join(source, 'entryReferenceData.ts.txt'), 'corrupted');
  assert.throws(() => syncEntryAssets(root), /ENTRY_ASSET_HASH_MISMATCH/);
  assert.equal(fs.existsSync(path.join(root, 'assets/generated')), false);
});
test('rejects a manifest destination outside its fixed output allowlist', t => {
  const { root, source } = fixture(t);
  const file = path.join(source, 'provenance.json');
  const manifest = JSON.parse(fs.readFileSync(file));
  manifest.files[0].target = '../unexpected.webp';
  fs.writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => syncEntryAssets(root), /ENTRY_ASSET_TARGET_INVALID/);
  assert.equal(fs.existsSync(path.join(root, 'assets/generated')), false);
});
