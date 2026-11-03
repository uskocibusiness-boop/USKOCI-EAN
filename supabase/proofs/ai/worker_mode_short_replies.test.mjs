import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWorkerModeRequests, workerModeRequests, workerServiceModeInstruction,
  preserveWorkerServiceModes } from '../../functions/_shared/workerServiceModeContext.mjs';
import { normalizedClassificationIdentity as key } from '../../functions/_shared/classificationEngine.mjs';
import { buildWorkerFullTreeTaxonomyProposals, indexFullCatalog } from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

// Actual runtime parser/continuity/builder, synthetic owned context and catalog.
// No paid provider, SQL write, activation, notification or device attestation.
const service = 'Časovi arapskog jezika';
const other = 'Lektura tekstova';
const id = '55555555-5555-4555-8555-555555555555';
const otherId = '44444444-4444-4444-8444-444444444444';
const question = 'Da li časove arapskog jezika držite onlajn ili uživo?';
const handoff = { required: true, shippingCountries: ['RS'] };
const offered = () => new Map([service, other].map(value => [key(value), value]));
function fixture(answer = 'Uživo', modes = ['ON_SITE'], changes = {}) {
  const row = { service, modes, evidence: answer, ...changes };
  const context = {
    revision: 7,
    candidate: { skills: [service, other] },
    messages: [{ role: 'ASSISTANT', body: question }, { role: 'USER', body: answer }],
    serviceModeContext: { revision: 7, savedServices: [], draftServices: [], unresolvedServices: [service] },
  };
  return { row, context, offered: offered() };
}
const inspect = f => inspectWorkerModeRequests(JSON.stringify([f.row]), f.context, f.offered);
const positive = [
  ['Uživo', ['ON_SITE']], ['Uživo.', ['ON_SITE']], ['Уживо!', ['ON_SITE']], ['uzivo', ['ON_SITE']],
  ['Lično', ['ON_SITE']], ['licno', ['ON_SITE']], ['Лично', ['ON_SITE']],
  ['na lokaciji', ['ON_SITE']], ['Na terenu', ['ON_SITE']],
  ['Onlajn', ['REMOTE']], ['ONLINE!', ['REMOTE']], ['онлајн', ['REMOTE']], ['na daljinu', ['REMOTE']],
  ['Oba', ['REMOTE', 'ON_SITE']], ['Oboje', ['REMOTE', 'ON_SITE']], ['оба', ['REMOTE', 'ON_SITE']],
  ['обоје.', ['REMOTE', 'ON_SITE']], ['oba načina', ['REMOTE', 'ON_SITE']],
  ['Na oba načina', ['REMOTE', 'ON_SITE']], ['I jedno i drugo', ['REMOTE', 'ON_SITE']],
];
for (const [answer, modes] of positive) {
  test(`owned short mode choice: ${answer}`, () => {
    const f = fixture(answer, modes), before = structuredClone(f);
    const result = inspect(f);
    assert.deepEqual(result.requests.get(key(service)), f.row);
    assert.equal(result.requests.has(key(other)), false);
    assert.equal(result.invalidServices.size, 0);
    assert.deepEqual(f, before, 'no context, catalog, profile or user-text mutation');
    assert.deepEqual([...workerModeRequests(JSON.stringify([f.row]), f.context, f.offered)], [...result.requests]);
  });
}
for (const answer of ['Uživo', 'Uživo.', 'Uživo!!!', 'Oba', 'Oba...', 'Onlajn', 'Onlajn.']) {
  test(`punctuation/length cannot authorize a wrong mode: ${answer}`, () => {
    const expectedWrong = /oba/i.test(answer) ? ['REMOTE'] : ['REMOTE', 'ON_SITE'];
    const f = fixture(answer, expectedWrong), result = inspect(f);
    assert.equal(result.requests.size, 0);
    assert.deepEqual([...result.invalidServices], [key(service)]);
  });
}
for (const answer of ['Da', 'Da....', 'ДА!!!!', 'Ne...', 'Не!!!!', 'Može', 'Može!!', 'Važi...', 'Важи!!']) {
  test(`ambiguous answer does not expand capability: ${answer}`, () => {
    assert.equal(inspect(fixture(answer, ['REMOTE', 'ON_SITE'])).requests.size, 0);
  });
}
const invalidContexts = [
  ['stale revision', f => { f.context.revision = 8; }],
  ['missing mode context', f => { delete f.context.serviceModeContext; }],
  ['missing revision', f => { delete f.context.revision; }],
  ['different service', f => { f.row.service = other; }],
  ['non-mode question', f => { f.context.messages[0].body = 'Kada Vam odgovaraju časovi arapskog jezika?'; }],
  ['two named services', f => { f.context.messages[0].body = 'Da li časove arapskog jezika i lekturu tekstova radite onlajn ili uživo?'; }],
  ['two questions', f => { f.context.messages[0].body += ' Koje Vam vreme odgovara?'; }],
  ['unowned question', f => { f.context.messages[0].role = 'USER'; }],
  ['assistant-only answer', f => { f.context.messages[1].role = 'ASSISTANT'; }],
  ['unquoted answer', f => { f.context.messages[1].body = 'Onlajn'; }],
  ['substring of a longer answer', f => { f.context.messages[1].body = 'Uživo ne mogu.'; }],
  ['later unrelated question', f => { f.context.messages.push({ role: 'ASSISTANT', body: 'U kom gradu?' }); }],
  ['no question marker', f => { f.context.messages[0].body = question.replace('?', '.'); }],
];
for (const [reason, change] of invalidContexts) {
  test(`short mode reply is rejected for ${reason}`, () => {
    const f = fixture(); change(f);
    assert.equal(inspect(f).requests.size, 0);
  });
}
test('mode-only answer cannot add a shipping or exchange permission', () => {
  const result = inspect(fixture('Oba', ['REMOTE', 'ON_SITE'], { handoff }));
  assert.equal(result.requests.size, 0);
  assert.deepEqual([...result.invalidServices], [key(service)]);
});
test('long explicit declaration still uses the existing owned-quote contract', () => {
  const f = fixture('Časove arapskog jezika držim uživo.', ['ON_SITE']);
  delete f.context.serviceModeContext;
  assert.deepEqual(inspect(f).requests.get(key(service)), f.row);
});
test('duplicate short declarations stay unresolved rather than last-writer-wins', () => {
  const f = fixture();
  const rows = [f.row, { ...f.row, modes: ['REMOTE'] }, f.row];
  const result = inspectWorkerModeRequests(JSON.stringify(rows), f.context, f.offered);
  assert.equal(result.requests.size, 0);
  assert.deepEqual([...result.invalidServices], [key(service)]);
});

const nodes = [
  { categoryId: id, parentId: null, label: service, aliases: [], isLeaf: true, modes: ['REMOTE', 'ON_SITE'] },
  { categoryId: otherId, parentId: null, label: other, aliases: [], isLeaf: true, modes: ['REMOTE'] },
];
const catalog = () => indexFullCatalog(3, 'a'.repeat(32), nodes, true);
const engineCatalog = () => ({ catalogVersion: 3, categories: nodes.map(({ categoryId, ...node }) => ({ ...node, id: categoryId })) });
const hint = (name, mode, categoryId, extra = {}) => ({ service: name, mode, categoryId, action: 'REUSE_EXISTING',
  parentId: '', proposedPath: [], reason: 'Existing concrete service with the same confirmed identity.', catalogVersion: 3, ...extra });
for (const [answer, modes] of [['Uživo', ['ON_SITE']], ['Onlajn', ['REMOTE']], ['Oboje', ['REMOTE', 'ON_SITE']]]) {
  test(`single-pass preserves other services while applying ${answer}`, async () => {
    const f = fixture(answer, modes);
    f.context.serviceModeContext.savedServices = [{ service: other, mode: 'REMOTE', categoryId: otherId }];
    const result = await buildWorkerFullTreeTaxonomyProposals({
      skills: [service, other], messages: f.context.messages, draftRevision: 8,
      serviceModeContext: f.context.serviceModeContext, serviceModeChangesJson: JSON.stringify([f.row]),
      suppliedCatalog: catalog(), suppliedDecisions: [hint(service, 'REMOTE', id), hint(service, 'ON_SITE', id), hint(other, 'REMOTE', otherId)],
    });
    assert.deepEqual(result.proposals.filter(p => p.service === service).map(p => p.mode).sort(), [...modes].sort());
    assert.deepEqual(result.proposals.filter(p => p.service === other).map(p => [p.mode, p.categoryId]), [['REMOTE', otherId]]);
    // A model proposal is deliberately still unresolved until the existing SQL
    // admission binds it. A passing short reply must not bypass that boundary.
    assert.deepEqual(result.unresolvedServices, [service]);
    assert.equal(result.failures.some(row => row.code === 'WORKER_MODE_REQUEST_INVALID'), false);
  });
}
test('short REMOTE answer preserves saved handoff without inventing a new one', () => {
  const f = fixture('Onlajn', ['REMOTE']);
  const savedServices = [{ service, mode: 'REMOTE', categoryId: id, handoff }];
  f.context.serviceModeContext.savedServices = savedServices;
  const result = preserveWorkerServiceModes({
    raw: { safety: 'ALLOW', patch: {}, serviceModeChangesJson: JSON.stringify([f.row]) },
    hints: [hint(service, 'REMOTE', id), hint(other, 'REMOTE', otherId)], context: f.context,
    modeContext: f.context.serviceModeContext, catalog: engineCatalog(),
  });
  assert.deepEqual(result.hints.find(row => row.service === service).handoff, handoff);
  assert.equal(Object.hasOwn(result.hints.find(row => row.service === other), 'handoff'), false);
});
test('prompt does not ask the model to pad evidence or repeat completed choices', () => {
  const copy = workerServiceModeInstruction({ revision: 7 }, false, false);
  for (const expected of ['Uživo', 'Lično', 'Onlajn', 'Oba', 'never pad or invent a quote',
    'omit handoff', 'Unchanged server draft choices need no repeated declaration', 'explicit Save']) assert.ok(copy.includes(expected));
});
