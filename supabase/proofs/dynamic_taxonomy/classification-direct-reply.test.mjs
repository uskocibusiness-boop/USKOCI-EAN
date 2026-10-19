import test from 'node:test';
import assert from 'node:assert/strict';
import { canAcceptDirectClassification } from '../../functions/_shared/classificationDirectReply.mjs';
import { inspectGeminiClassificationShadow } from '../../functions/_shared/classificationGeminiShadow.mjs';
import { normalizedClassificationIdentity as norm } from '../../functions/_shared/classificationEngine.mjs';

const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const printing = '3D printovanje', painting = 'Krečenje zidova';
const shipping = { required: true, shippingCountries: ['RS'] };
const nodes = [
  { id: id(1), label: printing, aliases: ['3D štampa'], modes: ['REMOTE', 'ON_SITE'], parentId: null },
  { id: id(2), label: painting, aliases: [], modes: ['ON_SITE'], parentId: null },
];
function catalog(services = [printing, painting], rows = nodes) {
  return { catalogVersion: 7, catalogFingerprint: 'a'.repeat(32), categories: rows,
    navigation: { kind: 'SERVER_QUERIES', searchedServices: services.map(norm),
      identityChecks: services.map(service => ({ service: norm(service), categoryIds: rows.filter(row =>
        [row.label, ...row.aliases].some(label => norm(label) === norm(service))).map(row => row.id) })) } };
}
const plan = (change = {}) => ({ service: printing, mode: 'REMOTE', action: 'REUSE_EXISTING',
  categoryId: id(1), parentId: '', proposedPath: [], reason: 'Ista konkretna usluga u aktuelnom katalogu.',
  catalogVersion: 7, handoff: shipping, ...change });
const onsite = () => { const { handoff, ...value } = plan({ service: painting, mode: 'ON_SITE', categoryId: id(2) }); return value; };
function input(plans = [plan()], extra = {}, snapshot = catalog()) {
  const purpose = extra.purpose ?? 'WORKER_CAPABILITY', safety = extra.safety ?? 'ALLOW';
  const raw = { assistantMessage: 'Podaci su u nacrtu.', safety, patch: {}, classificationShadowJson: JSON.stringify(plans) };
  return { inspection: inspectGeminiClassificationShadow(raw, snapshot, purpose), services: [printing],
    purpose, safety, ...extra };
}

test('fresh canonical current-turn reply covers the saved or unsaved complete choice', () => {
  const value = input([plan()], { expectedServiceModes: [{ service: printing, modes: ['REMOTE'], handoff: shipping }] });
  const before = structuredClone(value);
  assert.equal(canAcceptDirectClassification(value), true);
  assert.deepEqual(value, before);
});
test('a registered alias uses current global identity and does not require another model round', () => {
  const alias = '3D štampa';
  assert.equal(canAcceptDirectClassification(input([plan({ service: alias, action: 'REUSE_ALIAS' })],
    { services: [alias] }, catalog([alias]))), true);
});
test('all effective typed services must be covered, with no extra service hint', () => {
  assert.equal(canAcceptDirectClassification(input([plan()], { services: [printing, painting] })), false);
  assert.equal(canAcceptDirectClassification(input([plan(), onsite()])), false);
  assert.equal(canAcceptDirectClassification(input([plan(), onsite()], { services: [printing, painting] })), true);
});
test('existing unsaved REMOTE choice cannot silently gain ON_SITE through a complete-looking reply', () => {
  const { handoff, ...additionalMode } = plan({ mode: 'ON_SITE' });
  assert.equal(canAcceptDirectClassification(input([plan(), additionalMode], {
    expectedServiceModes: [{ service: printing, modes: ['REMOTE'], handoff: shipping }],
  })), false);
});
test('an explicit effective BOTH choice requires both new current-turn hints', () => {
  const { handoff, ...onsitePrint } = plan({ mode: 'ON_SITE' });
  const options = { expectedServiceModes: [{ service: printing, modes: ['REMOTE', 'ON_SITE'], handoff: shipping }] };
  assert.equal(canAcceptDirectClassification(input([plan()], options)), false);
  assert.equal(canAcceptDirectClassification(input([plan(), onsitePrint], options)), true);
});
test('missing handoff stays unresolved, and unknown earlier handoff cannot become unrestricted', () => {
  const { handoff, ...unknown } = plan();
  assert.equal(canAcceptDirectClassification(input([unknown])), false);
  assert.equal(canAcceptDirectClassification(input([plan({ handoff: { required: false } })], {
    expectedServiceModes: [{ service: printing, modes: ['REMOTE'] }],
  })), false);
});
test('handoff comparison preserves the actual countries and local exchange constraint', () => {
  const both = { required: true, shippingCountries: ['RS'], localExchange: { countryCode: 'RS', city: 'Novi Sad' } };
  const options = { expectedServiceModes: [{ service: printing, modes: ['REMOTE'], handoff: both }] };
  assert.equal(canAcceptDirectClassification(input([plan()], options)), false);
  assert.equal(canAcceptDirectClassification(input([plan({ handoff: { ...both, shippingCountries: ['HU'] } })], options)), false);
  assert.equal(canAcceptDirectClassification(input([plan({ handoff: both })], options)), true);
});
test('a digital no-exchange constraint is complete, not an absent handoff', () => {
  assert.equal(canAcceptDirectClassification(input([plan({ handoff: { required: false } })], {
    expectedServiceModes: [{ service: printing, modes: ['REMOTE'], handoff: { required: false } }],
  })), true);
});
test('task reply must match its effective typed geography mode and typed handoff', () => {
  const value = input([plan()], { purpose: 'NEED_SERVICE', taskMode: 'REMOTE', taskHandoff: shipping });
  assert.equal(canAcceptDirectClassification(value), true);
  assert.equal(canAcceptDirectClassification({ ...value, taskMode: 'ON_SITE' }), false);
  assert.equal(canAcceptDirectClassification({ ...value, taskHandoff: { required: false } }), false);
  assert.equal(canAcceptDirectClassification({ ...value, taskHandoff: undefined }), false);
  assert.equal(canAcceptDirectClassification(input([onsite()], { purpose: 'NEED_SERVICE', services: [painting], taskMode: 'ON_SITE' })), true);
});
test('a real unresolved mode question finishes without pointless catalog retries', () => {
  const { handoff, ...question } = plan({ mode: 'UNCONFIRMED' });
  assert.equal(canAcceptDirectClassification(input([question], { safety: 'CLARIFY' })), true);
});
test('a real semantic clarification covers the service but not unrelated missing services', () => {
  const question = plan({ service: 'Nejasna usluga', mode: 'UNCONFIRMED', action: 'ASK_CLARIFICATION', categoryId: '', handoff: undefined });
  delete question.handoff;
  assert.equal(canAcceptDirectClassification(input([question], { services: [question.service], safety: 'CLARIFY' }, catalog([question.service]))), true);
  assert.equal(canAcceptDirectClassification(input([question], { services: [question.service, painting], safety: 'CLARIFY' }, catalog([question.service]))), false);
});
test('mixed reuse and real clarification may finish, but missing/invalid research may not', () => {
  const question = { ...onsite(), mode: 'UNCONFIRMED' };
  assert.equal(canAcceptDirectClassification(input([plan(), question], { services: [printing, painting], safety: 'CLARIFY' })), true);
  assert.equal(canAcceptDirectClassification(input([plan({ catalogVersion: 6 }), question], { services: [printing, painting], safety: 'CLARIFY' })), false);
});
test('safety BLOCK and REVIEW never ask the routing layer for an additional model attempt', () => {
  for (const safety of ['BLOCK', 'REVIEW']) assert.equal(canAcceptDirectClassification({ purpose: 'WORKER_CAPABILITY', safety }), true);
});
test('an honest empty draft can continue talking; missing shadow cannot impersonate it', () => {
  assert.equal(canAcceptDirectClassification(input([], { services: [], safety: 'CLARIFY' })), true);
  const value = input([], { services: [] });
  value.inspection = inspectGeminiClassificationShadow({ safety: 'CLARIFY', patch: {}, assistantMessage: 'Koji posao nudiš?' }, catalog(), 'WORKER_CAPABILITY');
  assert.equal(canAcceptDirectClassification(value), false);
});
test('new branch and mode extension remain research/admission proposals, never the direct reuse path', () => {
  const service = 'Izrada papirnih maketa';
  const { handoff, ...newBranch } = plan({ service, mode: 'ON_SITE', action: 'CREATE_NEW_BRANCH', categoryId: '', proposedPath: [service] });
  assert.equal(canAcceptDirectClassification(input([newBranch], { services: [service] }, catalog([service]))), false);
  const extend = { ...onsite(), action: 'EXTEND_MODE', mode: 'REMOTE', handoff: { required: false } };
  assert.equal(canAcceptDirectClassification(input([extend], { services: [painting] })), false);
});
test('duplicates, stale versions, wrong identity and unsupported category mode fail closed', () => {
  assert.equal(canAcceptDirectClassification(input([plan(), plan()])), false);
  assert.equal(canAcceptDirectClassification(input([plan({ catalogVersion: 6 })])), false);
  assert.equal(canAcceptDirectClassification(input([plan({ categoryId: id(2) })])), false);
  assert.equal(canAcceptDirectClassification(input([plan({ service: painting, categoryId: id(2) })], { services: [painting] })), false);
});
test('withdrawn category or missing global exact proof cannot pass as fresh seed reuse', () => {
  assert.equal(canAcceptDirectClassification(input([plan()], {}, catalog([printing], []))), false);
  const snapshot = catalog(); snapshot.navigation.identityChecks = [];
  assert.equal(canAcceptDirectClassification(input([plan()], {}, snapshot)), false);
});
test('a guard may not erase invalid original metadata merely by supplying a plausible retained hint', () => {
  const value = input([plan({ categoryId: id(2) })]);
  value.inspection.reviewProposals = [plan()];
  assert.equal(canAcceptDirectClassification(value), false);
});
test('malformed expected mode sets and conflicting duplicate choices are not silently normalized', () => {
  const expected = { service: printing, modes: ['REMOTE'], handoff: shipping };
  for (const expectedServiceModes of [[{ ...expected, modes: ['REMOTE', 'REMOTE'] }], [expected, expected],
    [{ ...expected, service: painting }], [{ ...expected, handoff: null }]]) {
    assert.equal(canAcceptDirectClassification(input([plan()], { expectedServiceModes })), false);
  }
});
