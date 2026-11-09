'use strict';
// Opt-in proof of the two already-published selectMarker branches. Actual TS
// session/transport/decoders execute; only RPC answers and delays are controlled.
// No SQL, network, Auth, provider, UI rendering or source-file mutation.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '../../..');
const { clients, rpcFor, syntheticServer, id, deferred } = require(path.join(ROOT, 'scripts/p6-discovery-integration-harness.cjs'));
const sourcePath = 'src/data/discoveryV1ScreenSession.ts';
const sourceFile = path.join(ROOT, sourcePath), currentSource = fs.readFileSync(sourceFile, 'utf8');
const currentLines = [
  "if(loaded){peek={kind:'TASK',item:discoveryV1Opportunities([loaded])[0]};if(priceReadGeneration===priceGeneration)exactTaskId=loaded.id;}",
  "if(known){peek={kind:'PLACE',point:{...marker.point},items:discoveryV1Opportunities(known),totalCount:marker.taskCount};if(priceReadGeneration===priceGeneration)verifiedPlaceKey=key;}",
];
const previousLines = [
  "if(loaded) peek={kind:'TASK',item:discoveryV1Opportunities([loaded])[0]};",
  "if(known) peek={kind:'PLACE',point:{...marker.point},items:discoveryV1Opportunities(known),totalCount:marker.taskCount};",
];
let priorSource = currentSource;
for (let i = 0; i < currentLines.length; i++) {
  assert.equal(priorSource.split(currentLines[i]).length, 2, 'Exact published line must occur once');
  priorSource = priorSource.replace(currentLines[i], previousLines[i]);
}
const point = { lat: 45.25, lng: 19.84 }, frame = [19, 45, 20, 46];
function sessionModule(h, prior) {
  const original = fs.readFileSync;
  if (prior) fs.readFileSync = function(file, options) {
    if (typeof file !== 'string' || path.resolve(file) !== sourceFile) return original.apply(this, arguments);
    const encoding = typeof options === 'string' ? options : options?.encoding;
    return encoding ? priorSource : Buffer.from(priorSource);
  };
  try { return h.load(sourcePath); } finally { fs.readFileSync = original; }
}
async function probe(kind, prior = false) {
  const total = kind === 'TASK' ? 1 : 2, model = syntheticServer(total), delayed = deferred();
  void delayed.promise.catch(() => undefined); // Cleanup is also safe before a request consumes it.
  let pendingRequest = null;
  const rpc = rpcFor(request => {
    if (kind === 'TASK' ? request.mode === 'EXACT_PUBLIC'
      : request.mode === 'PAGE' && request.scope.kind === 'POINT_MEMBERS') {
      pendingRequest = request; return delayed.promise;
    }
    const answer = model.answer(request);
    if (kind === 'TASK' && request.mode === 'MAP') answer.buckets = [{ kind: 'TASK', key: 'known-task', point, taskId: id(1) }];
    return answer;
  });
  const h = clients(rpc.client), session = sessionModule(h, prior).createDiscoveryV1ScreenSession(h.transport);
  let pending;
  try {
    assert.equal((await session.open(h.view({ where: 'onsite', area: frame,
      viewport: { center: [19.5, 45.5], zoom: 10, bounds: frame } }))).kind, 'applied');
    assert.equal(session.snapshot().items.length, total);
    const marker = session.snapshot().mapMarkers[0];
    assert.equal(marker.kind, kind);
    pending = session.selectMarker(marker);
    assert.ok(pendingRequest, 'The normal authoritative refresh still starts');
    const immediate = session.snapshot();
    assert.equal(immediate.peek.kind, kind);
    const observed = kind === 'TASK' ? immediate.exactTaskId : immediate.verifiedPlaceKey;
    const expected = kind === 'TASK' ? id(1) : h.load('src/data/marketplaceView.ts').pointKey(point);
    if (prior) {
      assert.equal(observed, null, 'Negative control must reproduce the missing current-page binding');
      assert.throws(() => assert.equal(observed, expected), { code: 'ERR_ASSERTION' });
    } else assert.equal(observed, expected, 'Accepted loaded rows bind immediately before refresh replies');
    // A fresh map response retires this proof. A delayed failure cannot revive
    // the old binding; its known card may remain visible under the real owner.
    await session.refreshMap([18, 44, 21, 47]);
    assert.equal(kind === 'TASK' ? session.snapshot().exactTaskId : session.snapshot().verifiedPlaceKey, null);
    delayed.reject(new Error('CONTROLLED_SELECTION_REFRESH_FAILURE'));
    assert.deepEqual(await pending, { kind, applied: true });
    assert.equal(kind === 'TASK' ? session.snapshot().exactTaskId : session.snapshot().verifiedPlaceKey, null);
    assert.equal(session.snapshot().peek.kind, kind);
    return { kind, result: prior ? 'EXPECTED_BASELINE_FAILURE' : 'PASS', initialRows: total,
      immediateAcceptedRowsBinding: !prior, authoritativeRefreshStarted: true,
      freshMapRetiresBinding: true, lateFailureDoesNotReviveBinding: true,
      transportBoundary: 'Controlled decoded RPC answers; no SQL/HTTP.' };
  } finally {
    delayed.reject(new Error('CONTROLLED_PROBE_CLEANUP'));
    if (pending) await pending.catch(() => undefined);
    session.retire();
  }
}
(async () => {
  const output = process.argv[2]; assert.ok(output, 'Explicit output path required');
  const checks = [], negativeControls = [];
  for (const kind of ['TASK', 'PLACE']) {
    checks.push(await probe(kind)); negativeControls.push(await probe(kind, true));
  }
  const sha = value => createHash('sha256').update(value).digest('hex');
  const result = { recordedAt: new Date().toISOString(),
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    sourceFiles: { [sourcePath]: sha(currentSource),
      'scripts/p6-discovery-integration-harness.cjs': sha(fs.readFileSync(path.join(ROOT, 'scripts/p6-discovery-integration-harness.cjs'))) },
    probeSha256: sha(fs.readFileSync(__filename)), checks, negativeControls,
    negativeControlMethod: 'Replace only the two cf802823 additions in memory while loading the actual TS module; no file changes.',
    summary: { currentBranchesPassed: checks.length, expectedBaselineFailures: negativeControls.length, unexpectedFailures: 0 },
    limitations: ['Controlled transport and delayed failure, not real SQL/HTTP, Android rendering or native gestures.',
      'The separate p6-pagination-native-20261109.json records actual PostgreSQL/PostGIS pagination.',
      'No runtime, feature flag, package, migration or master-plan change.'] };
  fs.writeFileSync(path.resolve(output), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result.summary));
})().catch(error => { console.error(error); process.exitCode = 1; });
