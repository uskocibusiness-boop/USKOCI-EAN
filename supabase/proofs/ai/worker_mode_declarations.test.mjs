import test from 'node:test';
import assert from 'node:assert/strict';
import { workerModeRequests, preserveWorkerServiceModes } from '../../functions/_shared/workerServiceModeContext.mjs';
import { normalizedClassificationIdentity as key } from '../../functions/_shared/classificationEngine.mjs';
import { buildWorkerFullTreeTaxonomyProposals, indexFullCatalog } from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

// Synthetic owned messages/catalog; execute the actual shared parser, catalog
// gate, continuity owner and single-pass builder. No model, Auth, SQL or Save.
const A = 'Časovi matematike', B = 'Košenje trave', C = 'Popravka računara';
const QA = 'Časove matematike držim onlajn i kod učenika.';
const QB = 'Kosim travu kod naručioca.';
const QC = 'Za popravku računara primam pošiljke iz Srbije.';
const ID = new Map([[A, '11111111-1111-4111-8111-111111111111'],
  [B, '22222222-2222-4222-8222-222222222222'], [C, '33333333-3333-4333-8333-333333333333']]);
const localHandoff = { required: true, localExchange: { countryCode: 'RS', city: 'Novi Sad' } };
const shippingHandoff = { required: true, shippingCountries: ['RS'] };
const validA = () => ({ service: A, modes: ['REMOTE', 'ON_SITE'], evidence: QA });
const validB = () => ({ service: B, modes: ['ON_SITE'], evidence: QB });
const invalidA = () => ({ ...validA(), modes: ['REMOTE', 'UNKNOWN'] });
const asJson = rows => JSON.stringify(rows);
function fixtures() {
  const messages = [{ role: 'USER', body: `${QA}\n${QB}\n${QC}` },
    { role: 'ASSISTANT', body: 'Mogu Vam dodati i druge načine rada.' }];
  const nodes = [A, B, C].map(service => ({ categoryId: ID.get(service), parentId: null,
    label: service, aliases: [], isLeaf: true, modes: service === B ? ['ON_SITE'] : ['REMOTE', 'ON_SITE'] }));
  const catalog = indexFullCatalog(3, 'a'.repeat(32), nodes, true);
  const engineCatalog = { catalogVersion: 3, categories: nodes.map(({ categoryId, ...node }) => ({ id: categoryId, ...node })) };
  const savedServices = [{ service: A, mode: 'REMOTE', categoryId: ID.get(A) },
    { service: B, mode: 'ON_SITE', categoryId: ID.get(B) },
    { service: C, mode: 'REMOTE', categoryId: ID.get(C), handoff: structuredClone(localHandoff) }];
  return { messages, catalog, engineCatalog, context: { messages, candidate: { skills: [A, B, C] } },
    modeContext: { savedServices, draftServices: [] }, offered: new Map([A, B, C].map(s => [key(s), s])) };
}
const hint = (service, mode, extra = {}) => ({ service, mode, action: 'REUSE_EXISTING', categoryId: ID.get(service),
  parentId: '', proposedPath: [], reason: 'Ista konkretna usluga i potvrđen ID iz kataloga.', catalogVersion: 3, ...extra });
const request = (rows, f = fixtures()) => workerModeRequests(asJson(rows), f.context, f.offered);
async function build(json = '[]', changes = {}) {
  const f = fixtures();
  return buildWorkerFullTreeTaxonomyProposals({ skills: [A, B, C], messages: f.messages,
    serviceModeContext: f.modeContext, serviceModeChangesJson: json, suppliedCatalog: f.catalog,
    suppliedDecisions: [hint(A, 'REMOTE'), hint(A, 'ON_SITE'), hint(B, 'ON_SITE'), hint(C, 'REMOTE')],
    ...changes });
}
function assertUnresolvedOnlyA(result) {
  assert.equal(result.proposals.some(p => p.service === A), false);
  assert.deepEqual(result.unresolvedServices, [A]);
  assert.equal(result.failures.some(f => f.service === A && f.code === 'WORKER_MODE_REQUEST_INVALID'), true);
  assert.deepEqual(result.proposals.map(p => p.service), [B, C]);
  assert.deepEqual(result.proposals.find(p => p.service === C).handoff, localHandoff);
}

test('unique quoted mode set remains a Map request, not activation', () => {
  const result = request([validA(), validB()]);
  assert.ok(result instanceof Map);
  assert.deepEqual(result.get(key(A)).modes, ['REMOTE', 'ON_SITE']);
  assert.deepEqual(result.get(key(B)).modes, ['ON_SITE']);
});

const malformed = [
  ['unknown mode', x => ({ ...x, modes: ['REMOTE', 'UNKNOWN'] })],
  ['duplicate mode', x => ({ ...x, modes: ['REMOTE', 'REMOTE'] })],
  ['missing mode set', x => ({ service: x.service, evidence: x.evidence })],
  ['empty quote', x => ({ ...x, evidence: '' })],
  ['foreign quote', x => ({ ...x, evidence: 'Ovu rečenicu nije napisao korisnik.' })],
  ['assistant-only quote', x => ({ ...x, evidence: 'Mogu Vam dodati i druge načine rada.' })],
  ['unknown property', x => ({ ...x, categoryId: ID.get(A) })],
  ['invalid handoff', x => ({ ...x, handoff: { required: true } })],
  ['wrong mode value type', x => ({ ...x, modes: null })],
];
for (const [name, corrupt] of malformed) {
  for (const order of ['valid-first', 'invalid-first']) {
    test(`reject ambiguous service: ${name}, ${order}`, () => {
      const rows = [validA(), corrupt(validA())];
      if (order === 'invalid-first') rows.reverse();
      rows.push(validB());
      const result = request(rows);
      assert.equal(result.has(key(A)), false);
      assert.deepEqual([...result.keys()], [key(B)]);
    });
  }
}

test('two valid duplicates and any later valid occurrence remain rejected', () => {
  for (const rows of [[validA(), validA()], [validA(), invalidA(), validA()], [invalidA(), validA(), validA()]]) {
    assert.equal(request(rows).has(key(A)), false);
  }
});
test('same service across Cyrillic, case and whitespace cannot evade duplicate guard', () => {
  for (const service of ['ЧАСОВИ МАТЕМАТИКЕ', '  Časovi   matematike  ']) {
    assert.equal(request([validA(), { ...invalidA(), service }]).has(key(A)), false);
  }
});
test('unknown or removed service rows do not poison valid offered services', () => {
  const result = request([null, [], 42, { ...invalidA(), service: 'Drugi posao' }, validA()]);
  assert.deepEqual([...result.keys()], [key(A)]);
});
test('unquoted, assistant-only and malformed standalone requests do not pass', () => {
  for (const [, corrupt] of malformed) assert.equal(request([corrupt(validA())]).size, 0);
});
test('physical handoff stays a complete REMOTE-only reviewed object', () => {
  const f = fixtures();
  const row = { service: C, modes: ['REMOTE'], evidence: QC, handoff: shippingHandoff };
  assert.deepEqual(request([row], f).get(key(C)).handoff, shippingHandoff);
  assert.equal(request([{ ...row, modes: ['ON_SITE'] }], f).size, 0);
});
test('valid user facts and input objects are not mutated', () => {
  const f = fixtures(), rows = [validA(), validB()];
  const before = structuredClone({ f, rows });
  request(rows, f);
  assert.deepEqual(f, before.f);
  assert.deepEqual(rows, before.rows);
});

test('single-pass builder rejects valid plus invalid duplicate without losing other services', async () => {
  assertUnresolvedOnlyA(await build(asJson([validA(), invalidA()])));
  assertUnresolvedOnlyA(await build(asJson([invalidA(), validA()])));
});
test('single-pass keeps rejected fresh declaration distinct from an unrelated edit', async () => {
  assertUnresolvedOnlyA(await build(asJson([invalidA()])));
});
test('single-pass preserves unchanged saved IDs and physical handoff', async () => {
  const result = await build();
  assert.deepEqual(result.unresolvedServices, []);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.proposals.map(p => [p.service, p.mode, p.categoryId]),
    [[A, 'REMOTE', ID.get(A)], [B, 'ON_SITE', ID.get(B)], [C, 'REMOTE', ID.get(C)]]);
  assert.deepEqual(result.proposals[2].handoff, localHandoff);
});
test('single-pass accepts unique quoted BOTH only as proposals for the owned resolver', async () => {
  const result = await build(asJson([validA()]));
  assert.deepEqual(result.proposals.filter(p => p.service === A).map(p => p.mode), ['REMOTE', 'ON_SITE']);
  assert.deepEqual(result.unresolvedServices, [A]);
  assert.deepEqual(result.failures, []);
  assert.equal(result.proposals.filter(p => p.service === A).every(p => p.categoryId === ID.get(A)), true);
});
test('single-pass does not capture half of a requested BOTH set', async () => {
  const result = await build(asJson([validA()]), { suppliedDecisions: [hint(A, 'REMOTE')] });
  assert.equal(result.proposals.some(p => p.service === A), false);
  assert.deepEqual(result.proposals.map(p => p.service), [B, C]);
  assert.equal(result.failures.some(f => f.code === 'WORKER_SERVICE_MODE_SET_INCOMPLETE'), true);
});
test('single-pass draft REMOTE replaces saved BOTH; old ON_SITE is not resurrected', async () => {
  const f = fixtures();
  f.modeContext.savedServices.push({ service: A, mode: 'ON_SITE', categoryId: ID.get(A) });
  f.modeContext.draftServices = [{ service: A, mode: 'REMOTE', categoryId: ID.get(A) }];
  const result = await build('[]', { serviceModeContext: f.modeContext });
  assert.deepEqual(result.proposals.filter(p => p.service === A).map(p => p.mode), ['REMOTE']);
});
test('single-pass category ID cannot be changed by a mode declaration', async () => {
  const result = await build(asJson([validA()]), { suppliedDecisions: [hint(A, 'REMOTE', { categoryId: ID.get(C) }), hint(A, 'ON_SITE')] });
  assert.equal(result.proposals.some(p => p.service === A), false);
  assert.equal(result.failures.some(f => f.code === 'WORKER_SERVICE_CATEGORY_ID_CONFLICT'), true);
});
test('single-pass deliberate skill removal stays removed', async () => {
  const result = await build(asJson([validA()]), { skills: [B, C] });
  assert.deepEqual(result.proposals.map(p => p.service), [B, C]);
  assert.deepEqual(result.unresolvedServices, []);
});
test('single-pass catalog mode is not permission to invent a new worker mode', async () => {
  const f = fixtures();
  f.modeContext.savedServices = f.modeContext.savedServices.filter(p => p.service !== A);
  const result = await build('[]', { serviceModeContext: f.modeContext });
  assert.equal(result.proposals.some(p => p.service === A), false);
  assert.ok(result.unresolvedServices.includes(A));
});
for (const [name, json] of [['broken JSON', '['], ['wrong root', '{}'], ['too many rows', asJson(Array(13).fill(validB()))],
  ['too many UTF-8 bytes', asJson([{ ...validA(), evidence: 'č'.repeat(7000) }])]]) {
  test(`single-pass rejects whole malformed batch: ${name}`, async () => {
    const result = await build(json);
    assert.deepEqual(result.proposals, []);
    assert.deepEqual(result.unresolvedServices, [A, B, C]);
  });
}
test('missing, empty and whitespace optional declaration keep supported compatibility', async () => {
  for (const json of [undefined, '', ' ', null]) {
    const result = await build(json);
    assert.deepEqual(result.unresolvedServices, []);
    assert.equal(result.proposals.length, 3);
  }
});
test('legacy preservation does not widen a saved mode from an invalid duplicate', () => {
  const f = fixtures();
  const result = preserveWorkerServiceModes({ raw: { safety: 'ALLOW', patch: {}, serviceModeChangesJson: asJson([validA(), invalidA()]) },
    hints: [hint(A, 'REMOTE'), hint(A, 'ON_SITE'), hint(B, 'ON_SITE'), hint(C, 'REMOTE', { handoff: localHandoff })],
    context: f.context, modeContext: f.modeContext, catalog: f.engineCatalog });
  assert.deepEqual(result.hints.filter(p => p.service === A).map(p => p.mode), ['REMOTE']);
  assert.deepEqual(result.hints.find(p => p.service === C).handoff, localHandoff);
});
test('legacy physical handoff is not widened by a malformed duplicate', () => {
  const f = fixtures();
  const row = { service: C, modes: ['REMOTE'], evidence: QC, handoff: shippingHandoff };
  const result = preserveWorkerServiceModes({ raw: { safety: 'ALLOW', patch: {}, serviceModeChangesJson: asJson([row, { ...row, evidence: '' }]) },
    hints: [hint(A, 'REMOTE'), hint(B, 'ON_SITE'), hint(C, 'REMOTE', { handoff: shippingHandoff })],
    context: f.context, modeContext: f.modeContext, catalog: f.engineCatalog });
  assert.deepEqual(result.hints.find(p => p.service === C).handoff, localHandoff);
});
test('legacy safety refusal still returns no hints', () => {
  const f = fixtures();
  const result = preserveWorkerServiceModes({ raw: { safety: 'BLOCK', patch: {}, serviceModeChangesJson: asJson([validA()]) },
    hints: [hint(A, 'REMOTE')], context: f.context, modeContext: f.modeContext, catalog: f.engineCatalog });
  assert.deepEqual(result.hints, []);
});
