'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyRegressionEvidence, BASELINE, BRANCH, WORKFLOW } = require('../ota-regression-evidence.cjs');
const sha = 'a'.repeat(40);
function evidence() {
  return { sourceSha: sha, repository: 'owner/uskoci', runId: '123',
    run: { id: 123, head_sha: sha, head_branch: BRANCH, path: WORKFLOW, event: 'workflow_dispatch',
      repository: { full_name: 'owner/uskoci' }, head_repository: { full_name: 'owner/uskoci' },
      status: 'completed', conclusion: 'success' },
    jobs: [{ id: 456, name: 'android', head_sha: sha, status: 'completed', conclusion: 'success',
      steps: ['TypeScript', 'Current source ownership', 'Full regression suite']
        .map(name => ({ name, status: 'completed', conclusion: 'success' })) }] };
}
test('completed same-source regression admits only that client release', () => {
  assert.equal(verifyRegressionEvidence(evidence()).sourceSha, sha);
});
for (const mutation of [
  x => { x.run.head_sha = 'b'.repeat(40); },
  x => { x.run.head_repository.full_name = 'fork/uskoci'; },
  x => { x.run.path = '.github/workflows/other.yml'; },
  x => { x.run.head_branch = 'other'; },
  x => { x.run.id = 999; },
  x => { x.run.status = 'in_progress'; x.run.conclusion = null; },
  x => { x.run.conclusion = 'failure'; },
  x => { x.jobs[0].head_sha = 'b'.repeat(40); },
  x => { x.jobs[0].steps.pop(); },
  x => { x.jobs[0].steps[2].conclusion = 'skipped'; },
  x => { x.jobs[0].steps[2].conclusion = 'failure'; },
]) test(`reject incompatible or incomplete evidence: ${mutation.toString()}`, () => {
  const input = evidence(); mutation(input);
  assert.throws(() => verifyRegressionEvidence(input), /OTA_REGRESSION_/);
});

test('candidate ARM64 baseline is pinned in OTA workflow and regression receipt', () => {
  // Run 39627184837 produced a successful ARM64 preview APK for this SHA.
  // This proves source compatibility only: it cannot attest what is installed on a phone.
  assert.equal(BASELINE, 'ababbdbcc70ee08df4408cfb318a5d028188d168');
  const workflow = fs.readFileSync(path.resolve(__dirname,
    '../../.github/workflows/dev-android-preview-ota-20261014.yml'), 'utf8');
  const match = workflow.match(/^\s*OTA_NATIVE_BASELINE:\s*([a-f0-9]{40})\s*$/m);
  assert.ok(match, 'preview OTA workflow must pin an exact 40-character baseline');
  assert.equal(match[1], BASELINE, 'workflow and runtime evidence must use the same SHA');
  assert.equal(verifyRegressionEvidence(evidence()).installedNativeBaseline, BASELINE);
});
