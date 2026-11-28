const test = require('node:test');
const assert = require('node:assert/strict');

test('compact tree hierarchy formatting and smart bypass synthesis', async () => {
  const {
    formatFullCatalogHierarchy,
    indexFullCatalog,
    buildFullTreeTaxonomyProposals,
    buildWorkerFullTreeTaxonomyProposals,
    normalizedClassificationIdentity,
    taskTaxonomyMode,
  } = await import('../supabase/functions/_shared/backgroundTaxonomyArchitect.mjs');
  const { singlePassTaxonomyInstruction, singlePassCapturePlan } = await import('../supabase/functions/_shared/singlePassTaxonomy.mjs');

  const sampleNodes = [
    { categoryId: 'root-craft', parentId: null, label: 'Zanatske usluge', isLeaf: false, modes: ['ON_SITE'], aliases: [] },
    { categoryId: 'cat-lawn', parentId: 'root-craft', label: 'Košenje trave', isLeaf: true, modes: ['ON_SITE'], aliases: ['kosenje dvorista', 'kosenje'] },
    { categoryId: 'cat-paint', parentId: 'root-craft', label: 'Krečenje', isLeaf: true, modes: ['ON_SITE'], aliases: ['krecenje stana', 'moleraj'] },
    { categoryId: 'root-digital', parentId: null, label: 'Digitalne usluge', isLeaf: false, modes: ['REMOTE'], aliases: [] },
    { categoryId: 'cat-translate', parentId: 'root-digital', label: 'Prevođenje', isLeaf: true, modes: ['REMOTE'], aliases: ['prevod tekstova'] },
  ];

  const catalog = indexFullCatalog(42, 'sha-test-catalog', sampleNodes, true);

  // 1. Verify compact formatted hierarchy
  const formatted = formatFullCatalogHierarchy(catalog);
  assert.ok(formatted.includes('[root-craft ON_SITE] Zanatske usluge'));
  assert.ok(formatted.includes('  [cat-lawn LEAF ON_SITE] Košenje trave ~ kosenje dvorista, kosenje'));
  assert.ok(formatted.includes('  [cat-paint LEAF ON_SITE] Krečenje ~ krecenje stana, moleraj'));
  assert.ok(formatted.includes('[root-digital REMOTE] Digitalne usluge'));
  assert.ok(formatted.includes('  [cat-translate LEAF REMOTE] Prevođenje ~ prevod tekstova'));

  // 2. Verify instruction text includes the compact hierarchy
  const instruction = singlePassTaxonomyInstruction(catalog, 'NEED_SERVICE');
  assert.ok(instruction.includes('[cat-lawn LEAF ON_SITE] Košenje trave'));

  // 3. Verify synthesis of effectiveDecisions when tree is bypassed on follow-up turn
  const effCategory = 'kosenje trave';
  const effGeo = { mode: 'STATIONARY' };
  const effMode = taskTaxonomyMode(effGeo);
  assert.equal(effMode, 'ON_SITE');

  const normCat = normalizedClassificationIdentity(effCategory.trim());
  const catCandidates = catalog.byNormalizedKey.get(normCat) ?? [];
  const stripDiacritics = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const effStripped = stripDiacritics(effCategory);
  const matchingLeaf = catCandidates.find((c) => c.isLeaf && c.modes.includes(effMode))
    ?? catCandidates.find((c) => c.isLeaf)
    ?? catalog.categories.find((c) => c.isLeaf && normalizedClassificationIdentity(c.label) === normCat)
    ?? catalog.categories.find((c) => c.isLeaf && (stripDiacritics(c.label) === effStripped || (Array.isArray(c.aliases) && c.aliases.some((a) => stripDiacritics(a) === effStripped))));

  assert.ok(matchingLeaf, 'Matching leaf must be found');
  assert.equal(matchingLeaf.categoryId, 'cat-lawn');

  const effectiveDecisions = [{
    service: effCategory.trim(),
    mode: effMode,
    action: matchingLeaf.modes.includes(effMode) ? 'REUSE_EXISTING' : 'EXTEND_MODE',
    categoryId: matchingLeaf.categoryId,
    parentId: '',
    proposedPath: [],
    ambiguityPrompt: '',
    reason: `Zadržana potvrđena kategorija „${effCategory.trim()}“ iz prethodnog koraka razgovora.`,
  }];

  const builtTaxonomy = await buildFullTreeTaxonomyProposals({
    suppliedCatalog: catalog,
    suppliedDecisions: effectiveDecisions,
    items: [{ service: effCategory, mode: effMode }],
    conversationId: 'c1234567-0000-0000-0000-000000000001',
    draftRevision: 3,
  });

  assert.ok(builtTaxonomy);
  assert.equal(builtTaxonomy.proposals.length, 1);
  assert.equal(builtTaxonomy.proposals[0].categoryId, 'cat-lawn');
  assert.equal(builtTaxonomy.proposals[0].action, 'REUSE_EXISTING');

  const plan = singlePassCapturePlan(builtTaxonomy, catalog);
  assert.ok(plan);
  assert.equal(plan.catalogVersion, 42);
  assert.equal(plan.proposals.length, 1);
  assert.equal(plan.anchors.length, 2); // cat-lawn and root-craft

  // 4. Verify worker interview preserved identities when needsWorkerTree is false
  const workerBuilt = await buildWorkerFullTreeTaxonomyProposals({
    skills: ['Košenje trave', 'Krečenje'],
    messages: [],
    serviceModeContext: {
      savedServices: [
        { service: 'Košenje trave', mode: 'ON_SITE', categoryId: 'cat-lawn' },
        { service: 'Krečenje', mode: 'ON_SITE', categoryId: 'cat-paint' },
      ],
      draftServices: [],
      unresolvedServices: [],
    },
    conversationId: 'c1234567-0000-0000-0000-000000000002',
    draftRevision: 5,
    suppliedCatalog: catalog,
    suppliedDecisions: [], // Empty decisions because tree was bypassed!
  });

  assert.ok(workerBuilt);
  assert.equal(workerBuilt.proposals.length, 2);
  assert.equal(workerBuilt.proposals[0].categoryId, 'cat-lawn');
  assert.equal(workerBuilt.proposals[1].categoryId, 'cat-paint');

  const workerPlan = singlePassCapturePlan(workerBuilt, catalog);
  assert.ok(workerPlan);
  assert.equal(workerPlan.proposals.length, 2);
  assert.equal(workerPlan.anchors.length, 3); // cat-lawn, cat-paint, root-craft
});

test('specific language lessons keep distinct service identities through need and worker taxonomy proposals', async () => {
  const { indexFullCatalog, buildFullTreeTaxonomyProposals, buildWorkerFullTreeTaxonomyProposals } =
    await import('../supabase/functions/_shared/backgroundTaxonomyArchitect.mjs');
  const { singlePassTaxonomyInstruction } = await import('../supabase/functions/_shared/singlePassTaxonomy.mjs');
  const family = '00000000-0000-4000-8000-000000000802';
  const english = '00000000-0000-4000-8000-000000000803';
  const french = '00000000-0000-4000-8000-000000000804';
  const familyOnly = indexFullCatalog(12, 'catalog-before', [
    { categoryId: family, parentId: null, label: 'Časovi stranih jezika', isLeaf: true, modes: ['REMOTE'], aliases: [] },
  ], true);
  const needInstruction = singlePassTaxonomyInstruction(familyOnly, 'NEED_SERVICE');
  const workerInstruction = singlePassTaxonomyInstruction(familyOnly, 'WORKER_CAPABILITY');
  for (const instruction of [needInstruction, workerInstruction]) {
    assert.match(instruction, /English\/French\/Chinese lessons require different teaching ability/);
    assert.match(instruction, /translation is not proofreading/);
    assert.match(instruction, /CREATE_CHILD under the broad family/);
  }
  const chinese = 'Časovi kineskog jezika';
  const newNeed = await buildFullTreeTaxonomyProposals({
    suppliedCatalog: familyOnly,
    suppliedDecisions: [{ service: chinese, mode: 'REMOTE', action: 'CREATE_CHILD', categoryId: '', parentId: family,
      proposedPath: [chinese], ambiguityPrompt: '', reason: 'Kineski jezik zahteva drugačiju nastavnu sposobnost.' }],
    items: [{ service: chinese, mode: 'REMOTE' }], conversationId: 'need-language', draftRevision: 1,
  });
  assert.equal(newNeed.proposals.length, 1);
  assert.equal(newNeed.proposals[0].parentId, family);
  assert.deepEqual(newNeed.proposals[0].proposedPath, [chinese]);

  const specific = indexFullCatalog(13, 'catalog-after', [
    { categoryId: family, parentId: null, label: 'Časovi stranih jezika', isLeaf: false, modes: ['REMOTE'], aliases: [] },
    { categoryId: english, parentId: family, label: 'Časovi engleskog jezika', isLeaf: true, modes: ['REMOTE'], aliases: [] },
    { categoryId: french, parentId: family, label: 'Časovi francuskog jezika', isLeaf: true, modes: ['REMOTE'], aliases: [] },
  ], true);
  const worker = await buildWorkerFullTreeTaxonomyProposals({
    skills: ['Časovi engleskog jezika', 'Časovi francuskog jezika'], messages: [],
    serviceModeContext: { savedServices: [
      { service: 'Časovi engleskog jezika', mode: 'REMOTE', categoryId: english },
      { service: 'Časovi francuskog jezika', mode: 'REMOTE', categoryId: french },
    ], draftServices: [], unresolvedServices: [] },
    conversationId: 'worker-languages', draftRevision: 2, suppliedCatalog: specific, suppliedDecisions: [],
  });
  assert.deepEqual(worker.proposals.map(p => p.categoryId), [english, french]);
  assert.ok(worker.proposals.every(p => p.categoryId !== family));
});
