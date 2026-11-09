'use strict';
// Read-only verification of restored historical evidence. This does not run
// either integration runner, contact DEV or extend a historical test result.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file));
const json = file => JSON.parse(read(file).toString('utf8'));
const hash = file => createHash('sha256').update(read(file)).digest('hex');
const receiptPath = 'docs/plan/proofs/p6-discovery-integration-20261108.json';
const published = json('docs/plan/proofs/forensic-local-integration-20261109.json');
const anchor = published.prior_receipts['p6-discovery-integration-20261108.json'];
assert.equal(hash(receiptPath), anchor.sha256, 'Original receipt must match its already-published forensic anchor');
assert.equal(read(receiptPath).length, anchor.bytes);
const receipt = json(receiptPath);
const expected = { [receiptPath]: anchor.sha256, ...receipt.proofFiles };
for (const runner of ['scripts/p6-discovery-pagination-native.cjs', 'scripts/p6-discovery-authenticated-http.cjs']) {
  expected[runner] = receipt.sourceFiles[runner];
}
assert.equal(Object.keys(expected).length, 7);
const recovery = json('docs/plan/proofs/p6-evidence-recovery-20261109.json');
assert.equal(recovery.status, 'HISTORICAL_EVIDENCE_RECOVERED_NOT_REEXECUTED');
assert.equal(recovery.originalProducingCommit, receipt.sourceCommit);
assert.deepEqual(recovery.recoveredArtifacts.map(item => item.path).sort(), Object.keys(expected).sort());
for (const artifact of recovery.recoveredArtifacts) {
  assert.equal(artifact.sha256, expected[artifact.path], artifact.path);
  assert.equal(hash(artifact.path), expected[artifact.path], artifact.path);
  assert.equal(read(artifact.path).length, artifact.bytes, artifact.path);
}
const native = json('docs/plan/proofs/p6-pagination-native-20261108.json');
// Differences are disclosed, not used to reinterpret a historical PASS as a
// current-source result or to overwrite a newer dependency.
const currentSource = Object.entries(native.sourceFiles).map(([file, expectedHash]) => ({
  path: file, state: hash(file) === expectedHash ? 'SAME_BYTES' : 'CHANGED_SINCE_HISTORICAL_RUN',
}));
console.log(JSON.stringify({
  status: 'RECOVERED_ARTIFACT_INTEGRITY_PASS', artifacts: Object.keys(expected).length,
  historicalSource: receipt.sourceCommit, currentSource,
  scope: 'Manifest integrity only; no integration, Auth, SQL, provider or Android execution.',
}, null, 2));
