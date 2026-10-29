import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFullTreeTaxonomyProposals, buildWorkerFullTreeTaxonomyProposals, consumeClarificationHint, fetchUnconsumedClarificationHint,
  getUnconsumedClarificationHint, hintDraftRevision, persistClarificationHint, storeClarificationHint,
  taskClassificationFingerprint, taskTaxonomyMode, taskTaxonomyScope, workerSkillsFingerprint } from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

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

for (const [label, reason] of [
  ['301 characters', 'r'.repeat(301)],
  ['900+ characters', 'razlog'.repeat(160)],
  ['emoji boundary', 'r'.repeat(299) + '🛠️' + ' ostatak'.repeat(100)],
  ['emoji-only', '🧑'.repeat(901)],
]) {
  test(`clarification persistence bounds ${label} to the database's 300 codepoints`, async () => {
    const conversationId = `reason-bound-${label}`;
    const calls = [];
    const rpc = async (name, args) => {
      calls.push({ name, args });
      // Mirrors only the verified length contract, not a database execution.
      return { stored: Array.from(args.p_reason).length <= 300, draftRevision: args.p_draft_revision };
    };
    const hint = { conversationId, draftRevision: 7, service: 'klima', mode: null,
      ambiguityPrompt: 'Koju vrstu rada na klimi tražite?', reason };
    assert.equal(await persistClarificationHint(rpc, hint), true);
    assert.equal(calls.length, 1);
    const outgoing = calls[0].args;
    const stored = getUnconsumedClarificationHint(conversationId, 7);
    assert.equal(outgoing.p_reason, Array.from(reason).slice(0, 300).join(''));
    assert.equal(Array.from(outgoing.p_reason).length, 300);
    assert.equal(stored.reason, outgoing.p_reason, 'local and durable representations cannot diverge');
    assert.equal(outgoing.p_mode, null);
    assert.equal(stored.mode, null);
    assert.equal(outgoing.p_draft_revision, 7);
    assert.equal(stored.draftRevision, 7);
    assert.equal(getUnconsumedClarificationHint(conversationId, 6), null);
    assert.equal(hint.reason, reason, 'normalization must not mutate the caller input');
  });
}

for (const [label, result] of [['direct rejection', { stored: false }],
  ['wrapped rejection', { ok: true, data: { stored: false } }], ['transport rejection', { ok: false }]]) {
  test(`a bounded clarification with ${label} is not cached`, async () => {
    const conversationId = `reason-rejected-${label}`;
    assert.equal(await persistClarificationHint(async () => result, {
      conversationId, draftRevision: 9, service: 'klima', mode: null,
      ambiguityPrompt: 'Koju vrstu rada na klimi tražite?', reason: 'r'.repeat(901),
    }), false);
    assert.equal(getUnconsumedClarificationHint(conversationId, 9), null);
  });
}

test('clarification reason normalization preserves SQL nullable reason semantics', async () => {
  for (const reason of [null, '   ', '  Dovoljno kratko obrazloženje.  ']) {
    const conversationId = `nullable-reason-${String(reason)}`;
    let outgoing;
    assert.equal(await persistClarificationHint(async (_name, args) => { outgoing = args; return { stored: true, draftRevision: args.p_draft_revision }; }, {
      conversationId, draftRevision: 0, service: 'klima', mode: null,
      ambiguityPrompt: 'Koju vrstu rada na klimi tražite?', reason,
    }), true);
    const expected = typeof reason === 'string' ? reason.replace(/^ +| +$/g, '') || null : reason;
    assert.equal(outgoing.p_reason, expected);
    assert.equal(getUnconsumedClarificationHint(conversationId, 0).reason, expected);
    assert.equal(outgoing.p_draft_revision, 0);
  }
});

for (const purpose of ['need', 'worker']) {
  for (const short of [false, true]) {
    test(`${purpose} clarification uses PostgreSQL codepoints for bounds, short=${short}`, async t => {
      const reason = '🧑'.repeat(950);
      const ambiguityPrompt = short ? '😀😀😀😀' : 'r'.repeat(499) + '🛠️' + 'z'.repeat(200);
      const decision = { service: 'klima', mode: 'ON_SITE', action: 'NEEDS_CLARIFICATION', parentId: '',
        ambiguityPrompt, reason };
      t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP',
        content: { parts: [{ text: JSON.stringify(purpose === 'need' ? { decisions: [decision] } : { items: [decision] }) }] },
      }] })));
      const args = { geminiKey: 'synthetic', geminiModel: 'synthetic',
        rpc: async () => ({ ok: true, data: { catalogVersion: 809040 + Number(short), catalogFingerprint: purpose + short, count: 1,
          categories: [{ categoryId: '11111111-1111-4111-8111-111111111111', parentId: null, isLeaf: true,
            label: 'Servis uređaja', path: ['Servis uređaja'],
            pathIds: ['11111111-1111-4111-8111-111111111111'],
            aliases: [], modes: ['ON_SITE'] }] } }),
      };
      const result = purpose === 'need'
        ? await buildFullTreeTaxonomyProposals({ ...args, items: [{ service: 'klima', mode: 'ON_SITE' }] })
        : await buildWorkerFullTreeTaxonomyProposals({ ...args, skills: ['klima'], messages: [],
          serviceModeContext: { savedServices: [], draftServices: [] } });
      if (short) {
        assert.deepEqual(result.clarifications, [], 'four emoji are four characters, below the SQL minimum of eight');
      } else {
        assert.equal(result.clarifications.length, 1);
        assert.equal(result.clarificationHint.reason, Array.from(reason).slice(0, 300).join(''));
        assert.equal(result.clarificationHint.ambiguityPrompt, Array.from(ambiguityPrompt).slice(0, 500).join(''));
        assert.equal(Array.from(result.clarificationHint.ambiguityPrompt).length, 500);
      }
    });
  }
}

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

test('classification fingerprints ignore formatting but detect meaning, mode and handoff changes',()=>{
 const base={service:' Krečenje ',scopeSummary:'Krečenje dnevne  sobe',mode:'ON_SITE',handoff:null};
 assert.equal(taskClassificationFingerprint(base),taskClassificationFingerprint({...base,service:'krečenje',scopeSummary:'  krečenje dnevne sobe '}));
 assert.notEqual(taskClassificationFingerprint(base),taskClassificationFingerprint({...base,scopeSummary:'Gletovanje i krečenje'}));
 assert.notEqual(taskClassificationFingerprint(base),taskClassificationFingerprint({...base,mode:'REMOTE',handoff:{required:false}}));
 assert.notEqual(taskClassificationFingerprint({...base,mode:'REMOTE',handoff:{required:false}}),
  taskClassificationFingerprint({...base,mode:'REMOTE',handoff:{required:true,shippingCountries:['RS']}}));
 assert.equal(taskClassificationFingerprint({...base,mode:null}),null);
});

test('worker skill fingerprint treats the same full replacement as unchanged',()=>{
 assert.equal(workerSkillsFingerprint(['Krečenje','Gletovanje']),workerSkillsFingerprint([' gletovanje ','krečenje','KREČENJE']));
 assert.notEqual(workerSkillsFingerprint(['Krečenje']),workerSkillsFingerprint(['Krečenje','Gletovanje']));
 assert.equal(workerSkillsFingerprint(null),null);
});

test('novel task classification receives bounded public scope and does not reuse a decision for a different scope', async () => {
  const parentId = '11111111-1111-4111-8111-111111111111';
  const payloads = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    payloads.push(JSON.parse(body.contents[0].parts[0].text));
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({
      decisions: [{ service: 'klima', mode: 'ON_SITE', action: 'CREATE_CHILD', parentId,
        reason: 'Potvrđeni obim određuje granu klimatizacije.' }],
    }) }] } }] }), { status: 200 });
  };
  const rpc = async (name) => {
    assert.equal(name, 'rpc_taxonomy_fetch_snapshot_v1');
    return { ok: true, data: { catalogVersion: 987654321, catalogFingerprint: 'scope-test', count: 1,
      categories: [{ categoryId: parentId, parentId: null, isLeaf: true,
        label: 'Klimatizacija', path: ['Klimatizacija'],
        pathIds: [parentId], aliases: [], modes: ['ON_SITE'] }] } };
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
