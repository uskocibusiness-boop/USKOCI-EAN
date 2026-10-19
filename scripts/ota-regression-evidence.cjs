'use strict';

const BRANCH = 'feature/unified-qa-master-20261017';
const WORKFLOW = '.github/workflows/build-latest-v5-preview-apk.yml';
const BASELINE = 'f56c94c35c8eb0f2f28a6961fb4bf358228c241c';
const REQUIRED_STEPS = ['TypeScript', 'Current source ownership', 'Full regression suite'];

/** A completed APK run proves the same immutable client; no second full suite. */
function verifyRegressionEvidence({ run, jobs, sourceSha, repository, runId }) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha || '') || run?.head_sha !== sourceSha)
    throw new Error('OTA_REGRESSION_SOURCE_MISMATCH');
  if (String(run.id) !== String(runId) || run.repository?.full_name !== repository
    || run.head_repository?.full_name !== repository || run.head_branch !== BRANCH
    || run.path !== WORKFLOW || !['push', 'workflow_dispatch'].includes(run.event))
    throw new Error('OTA_REGRESSION_IDENTITY_MISMATCH');
  if (run.status !== 'completed' || run.conclusion !== 'success')
    throw new Error('OTA_REGRESSION_NOT_SUCCESSFUL');
  const proof = jobs?.find(job => job.name === 'android' && job.head_sha === sourceSha
    && job.status === 'completed' && job.conclusion === 'success');
  if (!proof || !REQUIRED_STEPS.every(name => proof.steps?.some(step => step.name === name
    && step.status === 'completed' && step.conclusion === 'success')))
    throw new Error('OTA_REGRESSION_REQUIRED_STEP_MISSING');
  return { sourceSha, regressionRunId: String(runId), regressionJobId: proof.id,
    installedNativeBaseline: BASELINE, branch: BRANCH, result: 'EXACT_SOURCE_REGRESSION_PASS' };
}

async function main() {
  const { GITHUB_REPOSITORY: repository, GITHUB_SHA: sourceSha, GITHUB_TOKEN: token,
    OTA_REGRESSION_RUN_ID: runId, OTA_EXPECTED_SOURCE: expectedSource,
    GITHUB_REF: ref } = process.env;
  if (expectedSource !== sourceSha || ref !== `refs/heads/${BRANCH}`
    || !/^\d+$/.test(runId || '') || !token || !/^[\w.-]+\/[\w.-]+$/.test(repository || ''))
    throw new Error('OTA_DISPATCH_IDENTITY_MISMATCH');
  const get = async suffix => {
    const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs/${runId}${suffix}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`OTA_REGRESSION_API_${response.status}`);
    return response.json();
  };
  const [run, page] = await Promise.all([get(''), get('/jobs?filter=latest&per_page=100')]);
  if (!Array.isArray(page.jobs) || page.total_count > 100) throw new Error('OTA_REGRESSION_JOBS_INCOMPLETE');
  const proof = verifyRegressionEvidence({ run, jobs: page.jobs, sourceSha, repository, runId });
  const fs = require('node:fs'), path = require('node:path');
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP, 'uskoci-ota-regression.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
}

module.exports = { verifyRegressionEvidence, BASELINE, BRANCH, WORKFLOW };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
