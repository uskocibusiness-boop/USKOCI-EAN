// Synthetic provider/catalog transports only. No live Gemini or database writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFullTreeTaxonomyProposals, buildWorkerFullTreeTaxonomyProposals } from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

const categoryId = '11111111-1111-4111-8111-111111111111';
let version = 800000;
function fixture(t, provider, modes = ['ON_SITE'], categoryPatch = {}) {
  const catalogVersion = ++version;
  const calls = [];
  const requestOptions = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    requestOptions.push({ method: init.method, redirect: init.redirect });
    calls.push(JSON.parse(init.body));
    return provider(init);
  });
  const rpc = async name => {
    assert.equal(name, 'rpc_taxonomy_fetch_snapshot_v1');
    return { ok: true, data: { catalogVersion, catalogFingerprint: String(catalogVersion), count: 1, categories: [
      { categoryId, parentId: null, isLeaf: true,
        label: 'Servis klima', aliases: [], modes,
        path: ['Servis klima'], pathIds: [categoryId], ...categoryPatch },
    ] } };
  };
  return { calls, requestOptions, args: { rpc, geminiKey: 'synthetic', geminiModel: 'synthetic', conversationId: 'synthetic-conversation', draftRevision: 4 } };
}
const response = (value, extra = {}) => new Response(JSON.stringify({ candidates: [
  { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] }, ...extra },
] }));
const worker = (args, extra = {}) => buildWorkerFullTreeTaxonomyProposals({
  ...args, skills: ['Popravka klima'], messages: [], hasWorkAreas: true,
  serviceModeContext: { savedServices: [], draftServices: [] }, ...extra,
});
const need = args => buildFullTreeTaxonomyProposals({ ...args, items: [{ service: 'Popravka klima', mode: 'ON_SITE' }] });
const failureCases = [
  ['rate limit', () => new Response('{}', { status: 429 }), 'RETRYABLE_PROVIDER'],
  ['unavailable', () => new Response('{}', { status: 503 }), 'RETRYABLE_PROVIDER'],
  ['invalid credentials', () => new Response('{}', { status: 401 }), 'PROVIDER_PERMANENT_FAILURE'],
  ['abort', () => { throw new DOMException('Synthetic cancellation', 'AbortError'); }, 'RETRYABLE_PROVIDER'],
  ['invalid JSON', () => new Response('{'), 'RETRYABLE_PROVIDER'],
  ['invalid model JSON', () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{' }] } }] })), 'RETRYABLE_PROVIDER'],
  ['truncated', () => response({ decisions: [], items: [] }, { finishReason: 'MAX_TOKENS' }), 'RETRYABLE_PROVIDER'],
  ['refused', () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } })), 'PROVIDER_PERMANENT_FAILURE'],
  ['missing decisions', () => response({}), 'RETRYABLE_PROVIDER'],
  ['empty decisions', () => response({ decisions: [], items: [] }), 'RETRYABLE_PROVIDER'],
];
for (const [label, provider, expected] of failureCases) {
  for (const [purpose, build] of [['need', need], ['worker', worker]]) {
    test(`${purpose}: ${label} is technical failure, never invented user ambiguity`, async t => {
      const f = fixture(t, provider);
      const result = await build(f.args);
      assert.deepEqual(result.proposals, []);
      assert.deepEqual(result.clarifications, []);
      assert.equal(result.clarificationHint, null);
      assert.ok(result.failures.some(failure => failure.status === expected));
      assert.equal(f.calls.length, 1, 'no automatic paid retry');
    });
  }
}

for (const [purpose, build] of [['need', need], ['worker', worker]]) {
  test(`R06 ${purpose}: provider redirect is rejected before following an unexpected destination`, async t => {
    // Simulate Fetch's redirect:'error' rejection, without contacting a provider
    // or copying the synthetic API key into the simulated second hop.
    const f = fixture(t, init => {
      if (init.redirect === 'error') throw new TypeError('simulated redirect refusal');
      return response({ decisions: [{ service: 'Popravka klima', mode: 'ON_SITE',
        action: 'CREATE_CHILD', parentId: categoryId, reason: 'Valid synthetic categorization.' }],
        items: [] });
    });
    const result = await build(f.args);
    assert.deepEqual(f.requestOptions, [{ method: 'POST', redirect: 'error' }]);
    assert.equal(f.calls.length, 1, 'never retry a possibly dispatched paid request');
    assert.deepEqual(result.proposals, [], 'redirect may not yield an accepted classification');
    assert.deepEqual(result.clarifications, []);
    assert.ok(result.failures.some(failure => failure.code === 'PROVIDER_TRANSPORT_FAILURE'));
  });
}
test('R06 need: a normal non-redirecting response still classifies a new service', async t => {
  const f = fixture(t, () => response({ decisions: [{ service: 'Popravka klima', mode: 'ON_SITE',
    action: 'CREATE_CHILD', parentId: categoryId, reason: 'Valid synthetic categorization.' }] }));
  const result = await need(f.args);
  assert.deepEqual(f.requestOptions, [{ method: 'POST', redirect: 'error' }]);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].action, 'CREATE_CHILD');
  assert.deepEqual(result.failures, []);
});

test('missing credentials do not call a provider or invent a question', async t => {
  const f = fixture(t, () => { throw new Error('must not call'); });
  for (const build of [need, worker]) {
    const result = await build({ ...f.args, geminiKey: '' });
    assert.deepEqual(result.clarifications, []);
    assert.deepEqual(result.proposals, []);
    assert.equal(result.failures[0].status, 'PROVIDER_PERMANENT_FAILURE');
  }
  assert.equal(f.calls.length, 0);
});
test('catalog mode and work area never establish a worker execution choice', async t => {
  const f = fixture(t, () => response({ items: [] }));
  const result = await worker({ ...f.args, geminiKey: '' }, { skills: ['Servis klima'] });
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(result.clarifications, []);
});
for (const mode of [undefined, 'UNKNOWN', 'BOTH', 'REMOTE']) {
  test(`unconfirmed worker mode ${mode} cannot broaden a service`, async t => {
    const f = fixture(t, () => response({ items: [{ service: 'Servis klima', mode,
      action: 'CREATE_CHILD', parentId: categoryId, handoffKind: 'NONE', handoffCity: '', reason: 'Synthetic response.' }] }));
    const result = await worker(f.args, { skills: ['Servis klima'] });
    assert.deepEqual(result.proposals, []);
  });
}
test('provider failure preserves saved mode and physical handoff exactly, never draft modes', async t => {
  const f = fixture(t, () => new Response('{}', { status: 503 }));
  const handoff = { required: true, shippingCountries: ['RS'] };
  const result = await worker(f.args, { skills: ['Servis klima'], serviceModeContext: {
    savedServices: [{ service: 'Servis klima', mode: 'REMOTE', categoryId, handoff }],
    draftServices: [{ service: 'Servis klima', mode: 'ON_SITE', categoryId }],
  } });
  // This catalog does not yet offer REMOTE: retain only a validated existing mode,
  // never use provider failure to create a new extension or authorize ON_SITE.
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(result.clarifications, []);
});
test('confirmed saved REMOTE continuity survives provider failure for another unresolved service', async t => {
  const f = fixture(t, () => new Response('{}', { status: 503 }), ['REMOTE', 'ON_SITE']);
  const handoff = { required: true, localExchange: { countryCode: 'RS', city: 'Novi Sad' } };
  const result = await worker(f.args, { skills: ['Servis klima', 'Popravka klima'], serviceModeContext: {
    savedServices: [{ service: 'Servis klima', mode: 'REMOTE', categoryId, handoff }],
    draftServices: [{ service: 'Servis klima', mode: 'ON_SITE', categoryId }],
  } });
  assert.deepEqual(result.proposals.map(p => [p.mode, p.handoff, p.action]), [['REMOTE', handoff, 'REUSE_EXISTING']]);
  assert.deepEqual(result.clarifications, []);
  assert.equal(result.failures[0].status, 'RETRYABLE_PROVIDER');
  assert.equal(f.calls.length, 1);
  assert.deepEqual(result.unresolvedServices, ['Popravka klima']);
});
test('saved missing handoff stays unknown even if the provider proposes worldwide digital work', async t => {
  const f = fixture(t, () => response({ items: [{ service: 'Servis klima', mode: 'REMOTE', action: 'CREATE_CHILD',
    parentId: categoryId, handoffKind: 'NONE', handoffCity: '', reason: 'Synthetic provider suggestion.' }] }), ['REMOTE']);
  const result = await worker(f.args, { skills: ['Servis klima'], serviceModeContext: {
    savedServices: [{ service: 'Servis klima', mode: 'REMOTE', categoryId }], draftServices: [],
  } });
  assert.equal(result.proposals.length, 1);
  assert.ok(!Object.hasOwn(result.proposals[0], 'handoff'));
});
test('explicit USER-quoted fresh mode can classify a new service without catalog-derived consent', async t => {
  const f = fixture(t, () => response({ items: [{ service: 'Popravka klima', mode: 'ON_SITE', action: 'CREATE_CHILD',
    parentId: categoryId, handoffKind: 'NONE', handoffCity: '', reason: 'Jasna popravka pod odgovarajućom granom.' }] }));
  const evidence = 'Popravke klima nudim kod klijenta.';
  const result = await worker(f.args, { messages: [{ role: 'USER', body: evidence }],
    serviceModeChangesJson: JSON.stringify([{ service: 'Popravka klima', modes: ['ON_SITE'], evidence }]) });
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].action, 'CREATE_CHILD');
  assert.equal(result.proposals[0].mode, 'ON_SITE');
  assert.deepEqual(result.clarifications, []);
});
test('an unresolved explicit fresh change never silently returns the old saved mode', async t => {
  const f = fixture(t, () => new Response('{}', { status: 503 }));
  const evidence = 'Od sada servis klima nudim samo na daljinu.';
  const result = await worker(f.args, { skills: ['Servis klima'], messages: [{ role: 'USER', body: evidence }],
    serviceModeChangesJson: JSON.stringify([{ service: 'Servis klima', modes: ['REMOTE'], evidence }]),
    serviceModeContext: { savedServices: [{ service: 'Servis klima', mode: 'ON_SITE', categoryId }], draftServices: [] },
  });
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(result.clarifications, []);
});
for (const modes of [['ON_SITE'], ['ON_SITE', 'REMOTE']]) {
  test(`provider outage cannot authorize a fresh mode even when catalog supports it: ${modes}`, async t => {
    const f = fixture(t, () => new Response('{}', { status: 503 }), modes);
    const evidence = 'Od sada servis klima nudim samo na daljinu.';
    const result = await worker(f.args, { skills: ['Servis klima'], messages: [{ role: 'USER', body: evidence }],
      serviceModeChangesJson: JSON.stringify([{ service: 'Servis klima', modes: ['REMOTE'], evidence }]),
      serviceModeContext: { savedServices: [{ service: 'Servis klima', mode: 'ON_SITE', categoryId }], draftServices: [] },
    });
    assert.deepEqual(result.proposals, []);
    assert.deepEqual(result.clarifications, []);
  });
}
for (const decision of [
  { service: 'Druga usluga', mode: 'REMOTE', action: 'CREATE_CHILD', parentId: categoryId },
  { service: 'Servis klima', mode: 'REMOTE', action: 'UNKNOWN_ACTION', parentId: categoryId },
  { service: 'Servis klima', mode: 'REMOTE', parentId: categoryId },
]) {
  test(`incomplete/invalid provider decision cannot authorize requested extension: ${JSON.stringify(decision)}`, async t => {
    const f = fixture(t, () => response({ items: [{ ...decision, reason: 'Synthetic provider description.' }] }));
    const evidence = 'Od sada servis klima nudim samo na daljinu.';
    const result = await worker(f.args, { skills: ['Servis klima'], messages: [{ role: 'USER', body: evidence }],
      serviceModeChangesJson: JSON.stringify([{ service: 'Servis klima', modes: ['REMOTE'], evidence }]),
    });
    assert.deepEqual(result.proposals, []);
    assert.deepEqual(result.clarifications, []);
    assert.ok(result.failures.some(f => f.code === 'PROVIDER_INVALID_DECISION'));
  });
}
test('conflicting saved IDs cannot select one identity or mode by accident', async t => {
  const f = fixture(t, () => new Response('{}', { status: 503 }), ['REMOTE', 'ON_SITE']);
  const result = await worker(f.args, { skills: ['Servis klima'], serviceModeContext: { savedServices: [
    { service: 'Servis klima', mode: 'ON_SITE', categoryId },
    { service: 'Servis klima', mode: 'REMOTE', categoryId: '22222222-2222-4222-8222-222222222222' },
  ], draftServices: [] } });
  assert.deepEqual(result.proposals, []);
});
for (const kind of ['duplicate', 'invented-quote', 'malformed']) {
  test(`invalid fresh ${kind} mode request cannot quietly restore a saved mode`, async t => {
    const f = fixture(t, () => new Response('{}', { status: 503 }));
    const evidence = 'Od sada servis klima nudim samo na daljinu.';
    const change = { service: 'Servis klima', modes: ['REMOTE'], evidence };
    const result = await worker(f.args, { skills: ['Servis klima'],
      messages: [{ role: 'USER', body: kind === 'invented-quote' ? 'Dopuni biografiju.' : evidence }],
      serviceModeChangesJson: kind === 'malformed' ? '{' : JSON.stringify(kind === 'duplicate' ? [change, change] : [change]),
      serviceModeContext: { savedServices: [{ service: 'Servis klima', mode: 'ON_SITE', categoryId }], draftServices: [] },
    });
    assert.deepEqual(result.proposals, []);
    assert.deepEqual(result.clarifications, []);
    assert.ok(result.failures.some(f => f.code === 'WORKER_MODE_REQUEST_INVALID'));
  });
}
test('provider diagnostics never log returned private prose or exception details', async t => {
  const logs = [];
  t.mock.method(console, 'warn', (...args) => logs.push(args));
  const f = fixture(t, () => { throw new Error('PRIVATE ADDRESS AND TOKEN'); });
  await need(f.args);
  assert.equal(logs.length, 1);
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE|ADDRESS|TOKEN/);
  assert.match(JSON.stringify(logs), /PROVIDER_TRANSPORT_FAILURE/);
});
test('R04/F05: requester can preserve an unregistered synonym as a pending existing-ID hint', async t => {
  const f = fixture(t, () => response({ decisions: [{ service: 'Popravka klima', mode: 'ON_SITE',
    action: 'REUSE_EXISTING', categoryId, parentId: '',
    reason: 'Popravka klima je isti konkretan servis postojeće kategorije.' }] }));
  const result = await need(f.args);
  assert.equal(result.proposals.length, 1);
  assert.deepEqual({ action: result.proposals[0].action, categoryId: result.proposals[0].categoryId,
    parentId: result.proposals[0].parentId, proposedPath: result.proposals[0].proposedPath },
  { action: 'REUSE_EXISTING', categoryId, parentId: '', proposedPath: [] });
  assert.equal(result.proposals[0].catalogVersion, result.catalogVersion);
  assert.deepEqual(result.clarifications, []);
  assert.deepEqual(result.failures, []);
  assert.ok(f.calls[0].generationConfig.responseSchema.properties.decisions.items.properties.categoryId);
  // The deployed SQL review still returns PENDING for this unregistered synonym;
  // no category, alias, consent, capability or READY is granted by this object.
  assert.ok(!Object.hasOwn(result, 'canAccept'));
});
test('an explicit semantic clarification stays a single question', async t => {
  const f = fixture(t, () => response({ decisions: [{ service: 'Popravka klima', mode: 'ON_SITE',
    action: 'NEEDS_CLARIFICATION', parentId: '', ambiguityPrompt: 'Da li treba popravka ili samo čišćenje?',
    reason: 'Tražena vrsta rada nije jasna.' }] }));
  const result = await need(f.args);
  assert.deepEqual(result.proposals, []);
  assert.equal(result.clarifications.length, 1);
  assert.equal(result.clarificationHint.ambiguityPrompt, 'Da li treba popravka ili samo čišćenje?');
});

const explicitBoth = {
  service:'Popravka klima',modes:['ON_SITE','REMOTE'],
  evidence:'Radim popravku klima kod klijenta i na daljinu, uz slanje poštom.',
  handoff:{required:true,shippingCountries:['RS']},
};
const bothRequest = {messages:[{role:'USER',body:explicitBoth.evidence}],
  serviceModeChangesJson:JSON.stringify([explicitBoth])};
const fullDecision = mode=>({service:'Popravka klima',mode,action:'CREATE_CHILD',
  parentId:categoryId,handoffKind:mode==='REMOTE'?'SHIPPING_RS':'NONE',
  handoffCity:'',reason:'Potvrđena nova usluga sa konkretnim izvršenjem.'});

test('R04 BOTH: two explicit modes preserve one category parent and requested REMOTE handoff',async t=>{
  const f=fixture(t,()=>response({items:[fullDecision('ON_SITE'),fullDecision('REMOTE')]}));
  const result=await worker(f.args,bothRequest);
  assert.equal(f.calls.length,1);
  assert.deepEqual(f.requestOptions, [{ method: 'POST', redirect: 'error' }]);
  assert.deepEqual(result.proposals.map(p=>p.mode),['ON_SITE','REMOTE']);
  assert.deepEqual(result.proposals.map(p=>p.parentId),[categoryId,categoryId]);
  assert.equal(result.proposals[0].action,'CREATE_CHILD');
  assert.equal(result.proposals[1].action,'CREATE_CHILD');
  assert.ok(!Object.hasOwn(result.proposals[0],'handoff'));
  assert.deepEqual(result.proposals[1].handoff,explicitBoth.handoff);
  assert.deepEqual(result.unresolvedServices,[]);
});

test('R04 BOTH: one provider result does not conceal the unclassified second mode',async t=>{
  const f=fixture(t,()=>response({items:[fullDecision('ON_SITE')]}));
  const result=await worker(f.args,bothRequest);
  assert.deepEqual(result.proposals,[]);
  assert.deepEqual(result.unresolvedServices,['Popravka klima']);
  assert.ok(result.failures.some(f=>f.code==='PROVIDER_INVALID_DECISION'&&f.mode==='REMOTE'));
  assert.deepEqual(result.clarifications,[]);
});

test('R04/F05: explicit worker semantic REUSE retains the same ID but remains unresolved for signed review',async t=>{
  const f=fixture(t,()=>response({items:[{
    service:'Popravka klima',mode:'ON_SITE',action:'REUSE_EXISTING',
    categoryId,parentId:'',handoffKind:'NONE',handoffCity:'',
    reason:'Popravka je po zadatom obimu ista usluga servisiranja klima.'
  }]}));
  const requested={...bothRequest,
    serviceModeChangesJson:JSON.stringify([{service:explicitBoth.service,
      modes:['ON_SITE'],evidence:explicitBoth.evidence}])};
  const result=await worker(f.args,requested);
  assert.equal(result.proposals.length,1);
  assert.equal(result.proposals[0].categoryId,categoryId);
  assert.equal(result.proposals[0].action,'REUSE_EXISTING');
  assert.deepEqual(result.proposals[0].proposedPath,[]);
  assert.deepEqual(result.unresolvedServices,['Popravka klima']);
  assert.deepEqual(result.failures,[]);
  assert.ok(!Object.hasOwn(result.proposals[0],'handoff'));
  assert.ok(f.calls[0].generationConfig.responseSchema.properties.items.items.properties.categoryId);
});


for(const [label,candidateId,modes,patch] of [
  ['fabricated', '99999999-9999-4999-8999-999999999999', ['ON_SITE'], {}],
  ['wrong mode', categoryId, ['REMOTE'], {}],
  ['non-leaf parent', categoryId, ['ON_SITE'], {isLeaf:false}],
]) {
  test(`R04/F05: model cannot reuse ${label}`,async t=>{
    const f=fixture(t,()=>response({decisions:[{
      service:'Popravka klima',mode:'ON_SITE',action:'REUSE_EXISTING',
      categoryId:candidateId,parentId:'',
      reason:'Model smatra da se rad odnosi na istu postojeću uslugu.'
    }]}),modes,patch);
    const result=await need(f.args);
    assert.deepEqual(result.proposals,[],label);
    assert.deepEqual(result.clarifications,[],label);
    assert.ok(result.failures.some(x=>x.code==='SEMANTIC_REUSE_ADMISSION_UNAVAILABLE'),label);
  });
}

test('R04/F05: a mismatched model service or forged parent cannot bind an existing ID',async t=>{
  const f=fixture(t,()=>response({decisions:[{
    service:'Montaža klima',mode:'ON_SITE',action:'REUSE_EXISTING',
    categoryId,parentId:'',reason:'Isto postojeće značenje po odgovoru modela.'
  }]}));
  const result=await need(f.args);
  assert.deepEqual(result.proposals,[]);
  assert.deepEqual(result.clarifications,[]);
  assert.ok(result.failures.length>0);
});

test('R04/F05: worker BOTH cannot silently assign two distinct existing category IDs',async t=>{
  const secondId='22222222-2222-4222-8222-222222222222';
  const catalogVersion=987654307;
  const calls=[];
  t.mock.method(globalThis,'fetch',async (_url,init)=>{
    calls.push(JSON.parse(init.body));
    const items=['ON_SITE','REMOTE'].map((mode,i)=>({
      service:'Popravka klima',mode,action:'REUSE_EXISTING',
      categoryId:i===0?categoryId:secondId,parentId:'',
      handoffKind:'NONE',handoffCity:'',
      reason:'Izabrani postojeći list navodno predstavlja isto značenje rada.'
    }));
    return response({items});
  });
  const cats=[categoryId,secondId].map((id,i)=>({
    categoryId:id,parentId:null,isLeaf:true,label:i?'Servis elektrike':'Servis klima',
    aliases:[],modes:['ON_SITE','REMOTE'],path:[i?'Servis elektrike':'Servis klima'],
    pathIds:[id]
  }));
  const rpc=async name=>{
    assert.equal(name,'rpc_taxonomy_fetch_snapshot_v1');
    return {ok:true,data:{catalogVersion,catalogFingerprint:'b'.repeat(32),
      count:cats.length,categories:cats}};
  };
  const evidence='Popravku klima nudim i kod Vas i na daljinu.';
  const result=await worker({rpc,geminiKey:'synthetic',geminiModel:'synthetic'},{
    skills:['Popravka klima'],messages:[{role:'USER',body:evidence}],
    serviceModeChangesJson:JSON.stringify([{service:'Popravka klima',
      modes:['ON_SITE','REMOTE'],evidence}])});
  assert.equal(calls.length,1);
  assert.deepEqual(result.proposals,[]);
  assert.deepEqual(result.unresolvedServices,['Popravka klima']);
  assert.ok(result.failures.some(x=>x.code==='WORKER_SERVICE_CATEGORY_ID_CONFLICT'));
});

test('R04/F05: valid worker BOTH semantic reuse retains one ID without inventing handoff or READY',async t=>{
  const f=fixture(t,()=>response({items:['ON_SITE','REMOTE'].map(mode=>({
    service:'Popravka klima',mode,action:'REUSE_EXISTING',categoryId,parentId:'',
    handoffKind:'NONE',handoffCity:'',
    reason:'Ista konkretna servisna usluga bez stvaranja drugog ID-a.'
  }))}),['ON_SITE','REMOTE']);
  const evidence='Popravku klima nudim kod klijenta i na daljinu.';
  const result=await worker(f.args,{
    messages:[{role:'USER',body:evidence}],
    serviceModeChangesJson:JSON.stringify([{service:'Popravka klima',
      modes:['ON_SITE','REMOTE'],evidence}])
  });
  assert.deepEqual(result.proposals.map(x=>[x.mode,x.categoryId]),
    [['ON_SITE',categoryId],['REMOTE',categoryId]]);
  assert.deepEqual(result.unresolvedServices,['Popravka klima']);
  assert.ok(result.proposals.every(x=>!Object.hasOwn(x,'handoff')));
});


test('R04/F08: remote requester never invents digital handoff if the user did not supply one',async t=>{
  const f=fixture(t,()=>response({decisions:[{
    service:'Popravka klima',mode:'REMOTE',action:'CREATE_CHILD',parentId:categoryId,
    reason:'Jasno izdvojen posao za pripremu nove kategorije.'
  }]}),['REMOTE']);
  const result=await buildFullTreeTaxonomyProposals({...f.args,
    items:[{service:'Popravka klima',mode:'REMOTE'}]});
  assert.equal(result.proposals.length,1);
  assert.equal(result.proposals[0].action,'CREATE_CHILD');
  assert.equal(Object.hasOwn(result.proposals[0],'handoff'),false,
    'missing remote handoff is unknown, not digital delivery');
});

test('R04/F05/F08: semantic remote existing-ID hint never fabricates physical or digital handoff',async t=>{
  const f=fixture(t,()=>response({decisions:[{
    service:'Popravka klima',mode:'REMOTE',action:'REUSE_EXISTING',categoryId,parentId:'',
    reason:'Ista konkretna servisna usluga u katalogu bez stvaranja nove kategorije.'
  }]}),['REMOTE']);
  const plain=await buildFullTreeTaxonomyProposals({...f.args,
    items:[{service:'Popravka klima',mode:'REMOTE'}]});
  assert.equal(plain.proposals.length,1);
  assert.equal(plain.proposals[0].categoryId,categoryId);
  assert.equal(Object.hasOwn(plain.proposals[0],'handoff'),false);
  const approvedHandoff={required:true,shippingCountries:['RS']};
  const explicit=await buildFullTreeTaxonomyProposals({...f.args,
    items:[{service:'Popravka klima',mode:'REMOTE',handoff:approvedHandoff}]});
  assert.equal(explicit.proposals.length,1);
  assert.deepEqual(explicit.proposals[0].handoff,approvedHandoff);
});

test('R04/F05: worker may not convert semantic hint into a mode without USER evidence',async t=>{
  const f=fixture(t,()=>response({items:[{
    service:'Popravka klima',mode:'ON_SITE',action:'REUSE_EXISTING',
    categoryId,parentId:'',reason:'Isti postojeći rad za kategoriju.'
  }]}));
  const result=await worker(f.args);
  assert.deepEqual(result.proposals,[]);
  assert.deepEqual(result.unresolvedServices,['Popravka klima']);
});

test('a valid clarification for one explicit mode keeps the whole service out of capture',async t=>{
  const f=fixture(t,()=>response({items:[
    fullDecision('ON_SITE'),
    {service:'Popravka klima',mode:'REMOTE',action:'NEEDS_CLARIFICATION',
      parentId:'',ambiguityPrompt:'Da li usluga uključuje fizičku predaju?',
      handoffKind:'SHIPPING_RS',handoffCity:'',
      reason:'Za rad na daljinu nedostaje razjašnjenje predaje.'}
  ]}));
  const result=await worker(f.args,bothRequest);
  assert.deepEqual(result.proposals,[]);
  assert.equal(result.clarifications.length,1);
  assert.equal(result.clarifications[0].mode,'REMOTE');
  assert.deepEqual(result.unresolvedServices,['Popravka klima']);
});

for (const missingMode of ['ON_SITE', 'REMOTE']) {
  test(`R04 BOTH capture boundary: missing ${missingMode} cannot narrow the proposed service`, async t => {
    const presentMode = missingMode === 'ON_SITE' ? 'REMOTE' : 'ON_SITE';
    const otherService = 'Montaža klima';
    const evidence = `${explicitBoth.evidence} Montažu klima radim kod klijenta.`;
    const f = fixture(t, () => response({ items: [fullDecision(presentMode),
      { ...fullDecision('ON_SITE'), service: otherService },
    ] }));
    const result = await worker(f.args, {
      skills: ['Popravka klima', otherService], messages: [{ role: 'USER', body: evidence }],
      serviceModeChangesJson: JSON.stringify([
        { ...explicitBoth, evidence }, { service: otherService, modes: ['ON_SITE'], evidence },
      ]),
    });
    // Edge capture persists only proposals, not unresolvedServices. Its payload
    // must therefore never contain half of a user-requested mode set.
    assert.deepEqual(result.proposals.map(p => [p.service, p.mode]), [[otherService, 'ON_SITE']]);
    assert.deepEqual(result.unresolvedServices, ['Popravka klima']);
    assert.ok(result.failures.some(f => f.code === 'WORKER_SERVICE_MODE_SET_INCOMPLETE'));
    assert.equal(f.calls.length, 1, 'no paid automatic repair call');
  });
}

test('R04 BOTH: two CREATE_CHILD hints cannot put one service under different parents', async t => {
  const otherParent = '22222222-2222-4222-8222-222222222222';
  const catalogVersion = ++version;
  t.mock.method(globalThis, 'fetch', async () => response({ items: [fullDecision('ON_SITE'),
    { ...fullDecision('REMOTE'), parentId: otherParent },
  ] }));
  const rpc = async () => ({ ok: true, data: { catalogVersion, catalogFingerprint: String(catalogVersion), count: 2,
    categories: [categoryId, otherParent].map((id, i) => ({ categoryId: id, parentId: null,
      isLeaf: true, label: i ? 'Računari' : 'Servis klima', aliases: [], modes: ['ON_SITE', 'REMOTE'],
      path: [i ? 'Računari' : 'Servis klima'], pathIds: [id] })),
  } });
  const result = await worker({ rpc, geminiKey: 'synthetic', geminiModel: 'synthetic' }, bothRequest);
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(result.unresolvedServices, ['Popravka klima']);
  assert.ok(result.failures.some(f => f.code === 'WORKER_SERVICE_CATEGORY_ID_CONFLICT'));
});
