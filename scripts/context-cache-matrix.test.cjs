const test = require('node:test');
const assert = require('node:assert/strict');

test('Gemini context cache builder and craft question matrix', async () => {
  const {
    craftQuestionMatrixText,
    craftFewShotExamplesText,
    isCyrillicInput,
  } = await import('../supabase/functions/_shared/craftQuestionMatrix.mjs');

  const {
    buildUskociCachedKnowledge,
    getOrCreateGeminiContextCache,
    clearActiveGeminiCacheHandles,
  } = await import('../supabase/functions/_shared/geminiContextCache.mjs');

  const { interviewVoiceInstruction } = await import('../supabase/functions/_shared/interviewVoiceInstruction.mjs');
  const { indexFullCatalog } = await import('../supabase/functions/_shared/backgroundTaxonomyArchitect.mjs');

  // 1. Verify craft matrix contents
  const matrix = craftQuestionMatrixText();
  assert.ok(matrix.includes('SELIDBE, PREVOZ I NOŠENJE TERETA'));
  assert.ok(matrix.includes('MOLERAJ I ZAVRŠNI GRAĐEVINSKI RADOVI'));
  assert.ok(matrix.includes('VODOINSTALATERSKE INTERVENCIJE'));
  assert.ok(matrix.includes('ELEKTROINSTALACIJE'));
  assert.ok(matrix.includes('MONTAŽA I POPRAVKA NAMEŠTAJA'));
  assert.ok(matrix.includes('KOŠENJE TRAVE'));
  assert.ok(matrix.includes('ČIŠĆENJE I PRANJE'));
  assert.ok(matrix.includes('DIGITALNE USLUGE, ČASOVI'));

  // 2. Verify few-shot examples
  const fewShot = craftFewShotExamplesText();
  assert.ok(fewShot.includes('Prevoz troseda sa Dorćola na Zvezdaru'));
  assert.ok(fewShot.includes('Поздрав! Наравно.')); // Cyrillic response
  assert.ok(fewShot.includes('Curenje slavine'));

  // 3. Verify script mirroring helper
  assert.equal(isCyrillicInput('Поздрав, треба ми превоз'), true);
  assert.equal(isCyrillicInput('Поздрав!'), true);
  assert.equal(isCyrillicInput('Pozdrav, treba mi prevoz'), false);
  assert.equal(isCyrillicInput('12345'), false);
  assert.equal(isCyrillicInput(''), false);

  // 4. Verify voice instruction terminology rules
  const voice = interviewVoiceInstruction();
  assert.ok(voice.includes('PISMO-OGLEDALO'));
  assert.ok(voice.includes('PRAVNI ŠTIT I TERMINOLOGIJA'));
  assert.ok(voice.includes('ZANATSKO GRUPISANJE PITANJA'));
  assert.ok(!voice.includes('naručilac'));
  assert.ok(!voice.includes('uskočer'));

  // 5. Verify buildUskociCachedKnowledge with catalog
  const sampleNodes = [
    { categoryId: 'root-craft', parentId: null, label: 'Zanatske usluge', isLeaf: false, modes: ['ON_SITE'], aliases: [] },
    { categoryId: 'cat-lawn', parentId: 'root-craft', label: 'Košenje trave', isLeaf: true, modes: ['ON_SITE'], aliases: ['kosenje'] },
  ];
  const catalog = indexFullCatalog(14, 'test-fingerprint', sampleNodes, true);

  const cachedKnowledge = buildUskociCachedKnowledge(catalog, 'NEED_SERVICE');
  assert.ok(cachedKnowledge.includes('USKOCI CENTRALNI ZANATSKI MOZAK'));
  assert.ok(cachedKnowledge.includes('KOMPLETNO STABLO KATEGORIJA USKOCI'));
  assert.ok(cachedKnowledge.includes('[cat-lawn LEAF ON_SITE] Košenje trave'));

  // 6. The explicit cache entry point is deliberately disabled.
  clearActiveGeminiCacheHandles();
  const nullCache = await getOrCreateGeminiContextCache({
    geminiApiKey: '',
    catalogVersion: 14,
    catalog,
  });
  assert.equal(nullCache, null);
});

test('configured explicit-cache compatibility seam remains a no-op without provider I/O', async () => {
  const { getOrCreateGeminiContextCache, clearActiveGeminiCacheHandles } = await import('../supabase/functions/_shared/geminiContextCache.mjs');
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Provider I/O is not admitted by this compatibility helper'); };
  try {
    for (const purpose of ['NEED_SERVICE', 'WORKER_CAPABILITY']) {
      assert.equal(await getOrCreateGeminiContextCache({ geminiApiKey: 'synthetic-not-a-provider-key',
        model: 'gemini-3.8-flash', catalogVersion: 14,
        catalog: { verifiedComplete: true, catalogVersion: 14, categories: [] }, purpose }), null);
    }
    clearActiveGeminiCacheHandles();
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
