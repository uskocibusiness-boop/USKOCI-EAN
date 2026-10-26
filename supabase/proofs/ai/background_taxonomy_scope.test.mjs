import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFullTreeTaxonomyProposals, consumeClarificationHint, fetchUnconsumedClarificationHint,
  getUnconsumedClarificationHint, hintDraftRevision, persistClarificationHint, storeClarificationHint,
  taskTaxonomyMode, taskTaxonomyScope } from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

test('clarification RPC receives a bigint-compatible revision, never a turn UUID', async () => {
  const turnId = '22222222-2222-4222-8222-222222222222';
  assert.equal(hintDraftRevision(turnId), null);
  assert.equal(hintDraftRevision(4), 4);
  assert.equal(hintDraftRevision(-1), null);
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args });
    return null;
  };
  assert.equal(await persistClarificationHint(rpc, {
    conversationId: '33333333-3333-4333-8333-333333333333', draftRevision: turnId,
    service: 'klima', mode: 'ON_SITE', ambiguityPrompt: 'Koju vrstu rada na klimi tražite?',
    reason: 'Vrsta rada nije jasna.',
  }),false);
  await fetchUnconsumedClarificationHint(rpc, '44444444-4444-4444-8444-444444444444', turnId);
  assert.deepEqual(calls,[]);
});

test('in-memory hints are revision-exact and consuming one revision cannot erase another',()=>{
 const conversationId='55555555-5555-4555-8555-555555555555';
 const hint=(draftRevision,service)=>({conversationId,draftRevision,service,mode:'ON_SITE',
  ambiguityPrompt:`Šta tačno znači ${service}?`,reason:'Potrebno pojašnjenje.'});
 storeClarificationHint(conversationId,4,hint(4,'montaža'));
 storeClarificationHint(conversationId,5,hint(5,'servis'));
 assert.equal(getUnconsumedClarificationHint(conversationId,3),null);
 assert.equal(getUnconsumedClarificationHint(conversationId,4).service,'montaža');
 assert.equal(getUnconsumedClarificationHint(conversationId,5).service,'servis');
 consumeClarificationHint(conversationId,4,'montaža');
 assert.equal(getUnconsumedClarificationHint(conversationId,4),null);
 assert.equal(getUnconsumedClarificationHint(conversationId,5).service,'servis');
});

test('task taxonomy does not turn missing or malformed geography into on-site consent', () => {
  assert.equal(taskTaxonomyMode(null), null);
  assert.equal(taskTaxonomyMode({}), null);
  assert.equal(taskTaxonomyMode({ mode: 'UNKNOWN' }), null);
  assert.equal(taskTaxonomyMode({ mode: 'REMOTE' }), 'REMOTE');
  for (const mode of ['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED']) {
    assert.equal(taskTaxonomyMode({ mode }), 'ON_SITE');
  }
});

test('task taxonomy keeps known scope but never carries it to a different service', () => {
  const known = { priorCategory: 'Krečenje', priorDescription: 'Krečenje dnevne sobe' };
  assert.equal(taskTaxonomyScope({ ...known, category: 'Krečenje' }), known.priorDescription);
  assert.equal(taskTaxonomyScope({ ...known, category: 'Selidba' }), '');
  assert.equal(taskTaxonomyScope({ ...known, category: 'Selidba', proposedDescription: 'Prenos ormana' }), 'Prenos ormana');
  assert.equal(taskTaxonomyScope({ priorCategory: null, category: 'Krečenje', priorDescription: known.priorDescription }), known.priorDescription);
});

test('novel task classification receives bounded public scope and does not reuse a decision for a different scope', async () => {
  const parentId = '11111111-1111-4111-8111-111111111111';
  const payloads = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    payloads.push(JSON.parse(body.contents[0].parts[0].text));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      decisions: [{ service: 'klima', mode: 'ON_SITE', action: 'CREATE_CHILD', parentId,
        reason: 'Potvrđeni obim određuje granu klimatizacije.' }],
    }) }] } }] }), { status: 200 });
  };
  const rpc = async (name) => {
    assert.equal(name, 'rpc_taxonomy_fetch_snapshot_v1');
    return { ok: true, data: { catalogVersion: 987654321, catalogFingerprint: 'scope-test',
      categories: [{ categoryId: parentId, label: 'Klimatizacija', path: ['Klimatizacija'],
        aliases: [], modes: ['ON_SITE'] }] } };
  };
  const classify = (scopeSummary) => buildFullTreeTaxonomyProposals({
    rpc, geminiKey: 'test-key', geminiModel: 'test-model',
    items: [{ service: 'klima', mode: 'ON_SITE' }], scopeSummary,
  });
  try {
    const first = await classify('Servis i čišćenje klime');
    assert.equal(first.proposals[0].action, 'CREATE_CHILD');
    assert.equal(payloads[0].scopeSummary, 'Servis i čišćenje klime');
    await classify('Montaža nove klime');
    assert.equal(payloads[1].scopeSummary, 'Montaža nove klime');
    assert.equal(payloads.length, 2);
    await classify('Montaža nove klime');
    assert.equal(payloads.length, 2);
    await classify('x'.repeat(600));
    assert.equal(payloads[2].scopeSummary.length, 500);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
