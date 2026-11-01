// Diagnostic reproduction, not an acceptance test that should preserve this bug.
// Run from the repository root with installed dependencies:
// node docs/continuation/r04-audit-20261102/reproduce-client-contract.cjs
// Uses actual client decoders. Only session/network entry points are disabled.
// After the contract is fixed, replace these expected-rejection assertions with
// permanent positive/negative tests under the existing client test suites.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(?:^|\/)(?:sesija|supabaseClient|aiNeedTurnStream)$/.test(request)) {
    const refused = () => { throw new Error('DIAGNOSTIC_NETWORK_FORBIDDEN'); };
    return { sesijaSada: () => ({ user: null, accountRevision: 0 }),
      supabaseKlijent: refused, requestAiTurnStream: refused };
  }
  return originalLoad.apply(this, arguments);
};
Module._extensions['.ts'] = function (mod, file) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  mod._compile(output, file);
};
const { decodeAiTaskReview } = require(path.join(root, 'src/data/aiTaskReviewClientService.ts'));
const { decodeWorkerAiReview } = require(path.join(root, 'src/data/workerAiClientService.ts'));
const owner = '11111111-1111-4111-8111-111111111111';
const conversation = '22222222-2222-4222-8222-222222222222';
const reviewId = '33333333-3333-4333-8333-333333333333';
const plan = { action: 'REUSE_EXISTING', service: 'Lektura', mode: 'REMOTE',
  categoryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', catalogVersion: 17,
  reason: 'Isti konkretan posao kao postojeca kategorija.', handoff: { required: false } };
const classification = { classificationState: 'READY', classificationCandidates: [plan],
  classificationCatalogVersion: 17, classificationCatalogFingerprint: 'a'.repeat(32) };
const fact = (key, value, displayValue) => ({ id: null, key, value, displayValue,
  privacyClass: 'PUBLIC', source: 'EXPLICIT_USER_ANSWER', status: 'CONFIRMED' });
const need = { reviewId, accountId: owner, conversationId: conversation, schemaVersion: 'NEED_FACT_V2',
  draftId: null, draftRevision: 0, displayedContentDigest: 'a'.repeat(64), factsRevision: 'b'.repeat(64),
  sourceTurnRevision: 2, geographyRevision: 'c'.repeat(64), expiresAt: '2026-12-01T00:00:00Z',
  responseDeadline: null, publicProjection: [fact('need.category', 'Lektura', 'Lektura'),
    fact('need.handoff', { required: false }, 'Digitalna isporuka')], ownerPrivateProjection: [],
  location: { taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null,
    accessNotes: null, resolvedLocation: null }, missingRequired: [], canAccept: true, safety: 'ALLOW',
  ...classification, reviewedServiceModes: [] };
const profile = { displayName: 'Petar', bio: 'Lektura teksta', skills: ['Lektura'], tools: [],
  vehicles: [], licenses: [], teamCapacity: 1, location: { operatingCountryCode: 'RS', city: 'Beograd',
    radiusKm: 25, approximatePosition: null },
  availability: { timezone: 'Europe/Belgrade', availableNow: true, rules: [], windows: [] } };
const worker = { schemaVersion: 'WORKER_PROFILE_V1', reviewId, conversationId: conversation,
  accountId: owner, profileId: '44444444-4444-4444-8444-444444444444', revision: 2, profile,
  activate: true, missingRequired: [], canAccept: true, expiresAt: '2026-12-01T00:00:00Z',
  displayedContentDigest: 'a'.repeat(64), ...classification,
  reviewedServiceModes: [{ service: 'Lektura', mode: 'REMOTE' }] };
const sqlShape = value => ({ ...value, classificationCandidates: [{ ...plan,
  categoryLabel: 'Lektura i korektura', categoryParentId: null }] });
const results = {
  needExistingShapeAccepted: decodeAiTaskReview(need, owner) !== null,
  needNewSqlShapeAccepted: decodeAiTaskReview(sqlShape(need), owner) !== null,
  workerExistingShapeAccepted: decodeWorkerAiReview(worker, owner, conversation) !== null,
  workerNewSqlShapeAccepted: decodeWorkerAiReview(sqlShape(worker), owner, conversation) !== null,
};
assert.deepEqual(results, { needExistingShapeAccepted: true, needNewSqlShapeAccepted: false,
  workerExistingShapeAccepted: true, workerNewSqlShapeAccepted: false });
console.log(JSON.stringify({ status: 'BUG_REPRODUCED_NOT_FIXED', ...results }));
