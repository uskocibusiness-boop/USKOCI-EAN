// Background Taxonomy Architect ("Drugi Gemini u pozadini").
// Sees the ENTIRE taxonomy tree (all roots, branches, and leaf categories),
// caches the full tree in memory by catalogVersion + catalogFingerprint,
// resolves exact/alias/mode-extension matches deterministically in 0ms,
// detects ambiguity and emits clarificationRequest hints without falling back to Zanati i popravke,
// and invokes a fast focused Gemini call for genuinely novel services
// without ever blocking the user-facing conversational response.

import { normalizedClassificationIdentity } from './classificationEngine.mjs';
import { decodeServiceHandoff } from './serviceHandoff.mjs';

let cachedFullCatalog = null;
const cachedNovelDecisions = new Map();

// In-memory store for asynchronous clarification hints across conversation turns
const clarificationHintsByConversation = new Map();

export function storeClarificationHint(conversationId, draftRevision, hint) {
  if (!conversationId) return;
  const existing = clarificationHintsByConversation.get(conversationId) ?? [];
  const filtered = existing.filter((h) => h.draftRevision !== draftRevision);
  filtered.push({
    ...hint,
    conversationId,
    draftRevision: draftRevision ?? null,
    consumed: false,
    timestamp: Date.now(),
  });
  clarificationHintsByConversation.set(conversationId, filtered);
}

export function getUnconsumedClarificationHint(conversationId, draftRevision) {
  if (!conversationId) return null;
  const list = clarificationHintsByConversation.get(conversationId);
  if (!Array.isArray(list) || list.length === 0) return null;
  const found = list.find((h) => !h.consumed);
  return found ?? null;
}

export function consumeClarificationHint(conversationId, service) {
  if (!conversationId) return;
  const list = clarificationHintsByConversation.get(conversationId);
  if (!Array.isArray(list)) return;
  for (const h of list) {
    if (!service || h.service === service) {
      h.consumed = true;
    }
  }
}

export async function persistClarificationHint(rpc, hint) {
  if (!hint?.conversationId) return;
  storeClarificationHint(hint.conversationId, hint.draftRevision, hint);
  if (typeof rpc === 'function') {
    try {
      await rpc('rpc_taxonomy_store_classification_turn_hint_service', {
        p_conversation_id: hint.conversationId,
        p_draft_revision: hint.draftRevision ?? null,
        p_service: hint.service,
        p_mode: hint.mode ?? null,
        p_ambiguity_prompt: hint.ambiguityPrompt,
        p_reason: hint.reason,
      });
    } catch {
      // Non-fatal if table/rpc not yet deployed; in-memory cache handles current edge instance
    }
  }
}

/** Marks the question as asked: in this instance's memory at once, and in the database so another instance never repeats it. */
export async function persistConsumeClarificationHint(rpc, conversationId, service) {
  if (!conversationId) return;
  consumeClarificationHint(conversationId, service);
  if (typeof rpc === 'function') {
    try {
      await rpc('rpc_taxonomy_consume_turn_hint_service', {
        p_conversation_id: conversationId,
        p_service: service ?? null,
      });
    } catch {
      // The in-memory mark already prevents a repeat on this instance.
    }
  }
}

export async function fetchUnconsumedClarificationHint(rpc, conversationId, draftRevision) {
  const mem = getUnconsumedClarificationHint(conversationId, draftRevision);
  if (mem) return mem;
  if (typeof rpc === 'function' && conversationId) {
    try {
      const res = await rpc('rpc_taxonomy_get_unconsumed_turn_hint_service', {
        p_conversation_id: conversationId,
        p_draft_revision: draftRevision ?? null,
      });
      const data = res?.ok ? res.data : res;
      if (data && typeof data.ambiguityPrompt === 'string') {
        storeClarificationHint(conversationId, draftRevision, data);
        return data;
      }
    } catch {
      // Graceful fallback
    }
  }
  return null;
}

export function runInBackground(promise) {
  const safe = Promise.resolve(promise).catch((err) => {
    console.warn('BG_TAXONOMY_ARCHITECT_WARN', err?.message ?? 'UNKNOWN');
  });
  if (typeof globalThis.EdgeRuntime?.waitUntil === 'function') {
    globalThis.EdgeRuntime.waitUntil(safe);
    return Promise.resolve();
  }
  return safe;
}

export function indexFullCatalog(catalogVersion, catalogFingerprint, categories) {
  const byNormalizedKey = new Map();
  for (const cat of categories) {
    const labelKey = normalizedClassificationIdentity(cat.label);
    if (labelKey) {
      const list = byNormalizedKey.get(labelKey) ?? [];
      list.push(cat);
      byNormalizedKey.set(labelKey, list);
    }
    for (const alias of cat.aliases ?? []) {
      const aliasKey = normalizedClassificationIdentity(alias);
      if (aliasKey) {
        const list = byNormalizedKey.get(aliasKey) ?? [];
        if (!list.includes(cat)) list.push(cat);
        byNormalizedKey.set(aliasKey, list);
      }
    }
  }

  cachedFullCatalog = {
    catalogVersion,
    catalogFingerprint,
    categories,
    byNormalizedKey,
  };
  return cachedFullCatalog;
}

export async function loadFullCatalogTree(rpc, signal) {
  // 1. Target primary path: Single-query PostgreSQL JSONB snapshot loader (1 roundtrip ~15ms)
  try {
    const snapRes = await rpc('rpc_taxonomy_fetch_snapshot_v1', { p_generation: 1 }, signal, 2500);
    const snap = snapRes?.ok ? snapRes.data : snapRes;
    if (snap && Number.isSafeInteger(snap.catalogVersion) && Array.isArray(snap.categories)) {
      if (
        cachedFullCatalog &&
        cachedFullCatalog.catalogVersion === snap.catalogVersion &&
        cachedFullCatalog.catalogFingerprint === snap.catalogFingerprint
      ) {
        return cachedFullCatalog;
      }
      return indexFullCatalog(snap.catalogVersion, snap.catalogFingerprint, snap.categories);
    }
  } catch {
    // Graceful fallback to query catalog service if snapshot RPC is not yet deployed
  }

  // 2. Fast META check (~80ms) to verify if cached full tree is still current
  const metaRes = await rpc('rpc_taxonomy_query_catalog_service', {
    p_query: { operation: 'META', scope: 'ALL', limit: 1 },
  }, signal, 3000);
  const meta = metaRes?.ok ? metaRes.data : metaRes;
  if (
    cachedFullCatalog &&
    meta &&
    Number.isSafeInteger(meta.catalogVersion) &&
    cachedFullCatalog.catalogVersion === meta.catalogVersion &&
    cachedFullCatalog.catalogFingerprint === meta.catalogFingerprint
  ) {
    return cachedFullCatalog;
  }

  // 3. Fallback level-by-level walk: query roots and children
  const rootsRes = await rpc('rpc_taxonomy_query_catalog_service', {
    p_query: { operation: 'ROOTS', scope: 'ALL', limit: 100 },
  }, signal, 4000);
  const rootsPage = rootsRes?.ok ? rootsRes.data : rootsRes;
  if (!rootsPage || !Array.isArray(rootsPage.items)) {
    throw new Error('FULL_CATALOG_ROOTS_UNAVAILABLE');
  }

  const catalogVersion = rootsPage.catalogVersion;
  const catalogFingerprint = rootsPage.catalogFingerprint;
  const allNodes = new Map();
  const queue = [];

  for (const item of rootsPage.items) {
    allNodes.set(item.categoryId, item);
    if (!item.isLeaf) queue.push(item.categoryId);
  }

  let depthGuard = 0;
  while (queue.length > 0 && depthGuard++ < 6) {
    const batch = queue.splice(0, 32);
    const childrenPages = await Promise.all(
      batch.map(async (categoryId) => {
        const res = await rpc('rpc_taxonomy_query_catalog_service', {
          p_query: {
            operation: 'CHILDREN',
            categoryId,
            scope: 'ALL',
            limit: 100,
            catalogVersion,
            catalogFingerprint,
          },
        }, signal, 4000);
        return res?.ok ? res.data : res;
      })
    );
    for (const page of childrenPages) {
      if (!page || !Array.isArray(page.items)) continue;
      for (const item of page.items) {
        if (!allNodes.has(item.categoryId)) {
          allNodes.set(item.categoryId, item);
          if (!item.isLeaf) queue.push(item.categoryId);
        }
      }
    }
  }

  return indexFullCatalog(catalogVersion, catalogFingerprint, [...allNodes.values()]);
}

async function classifyNovelServicesWithGemini({
  geminiKey,
  geminiModel,
  catalog,
  unresolvedItems,
  signal,
}) {
  const treeLines = catalog.categories.map((c) => {
    const indent = '  '.repeat(Math.max(0, (c.path?.length ?? 1) - 1));
    return `${indent}- ${c.label} [id:${c.categoryId}] [modes:${(c.modes ?? []).join(',')}]`;
  }).join('\n');

  const systemText = [
    'Ti si USKOČI Arhitekta stabla usluga (drugi Gemini u pozadini).',
    'Ispred sebe vidiš KOMPLETNO stablo svih postojećih kategorija i podkategorija u bazi.',
    'Za svaku traženu uslugu (service + mode):',
    '1. Prvo proveri da li u stablu već postoji kategorija sa tim značenjem (ne praveći duple grane).',
    '2. Ako u stablu ne postoji tačna kategorija, ali je namera potpuno jasna i nedvosmislena, izaberi NAJPRECIZNIJEG postojećeg roditelja (parentId UUID iz stabla — može biti koren ili postojeća podgrana na dubljem nivou) pod kojim treba napraviti novu podgranu (action="CREATE_CHILD").',
    '3. Za CREATE_CHILD polje parentId MORA biti tačan UUID postojećeg čvora iz stabla, a proposedPath sadrži SAMO novu podgranu ispod tog roditelja (npr. [service]).',
    '4. KRITIČNO PRAVILO ZA DVOSMISLENE USLUGE: Ako je tražena usluga dvosmislena, neodređena ili se može odnositi na više bitno različitih poslova (npr. samo "klima" — da li je montaža/ugradnja nove klime ili redovan servis/čišćenje/dopuna freona?; ili "nameštaj" — da li je sklapanje/montaža gotovog nameštaja, izrada po meri ili tapaciranje/restauracija?), NIKADA nemoj nagađati roditelja i NIKADA nemoj stavljati u opšte Zanati i popravke. U tom slučaju vrati action="NEEDS_CLARIFICATION", parentId="", i u ambiguityPrompt postavi prirodno, kratko pitanje na srpskom koje razjašnjava tačnu vrstu posla.',
    '5. Polje reason mora biti kratko obrazloženje na srpskom (15 do 200 znakova).',
  ].join(' ');

  const userText = JSON.stringify({
    catalogVersion: catalog.catalogVersion,
    servicesToClassify: unresolvedItems,
    completeCatalogTree: treeLines,
  });

  const responseSchema = {
    type: 'OBJECT',
    required: ['decisions'],
    properties: {
      decisions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          required: ['service', 'mode', 'parentId', 'reason'],
          properties: {
            service: { type: 'STRING' },
            mode: { type: 'STRING', enum: ['ON_SITE', 'REMOTE'] },
            action: { type: 'STRING', enum: ['CREATE_CHILD', 'NEEDS_CLARIFICATION', 'AMBIGUOUS'] },
            parentId: { type: 'STRING' },
            ambiguityPrompt: { type: 'STRING' },
            reason: { type: 'STRING' },
          },
        },
      },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema,
        ...(String(geminiModel).includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
    signal,
  });

  if (!res.ok) throw new Error(`GEMINI_ARCHITECT_HTTP_${res.status}`);
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const parsed = JSON.parse(rawText);
  return Array.isArray(parsed?.decisions) ? parsed.decisions : [];
}

/**
 * Builds verified proposals for rpc_taxonomy_capture_gemini_turn_hints_service
 * using the complete catalog tree and, when needed, the second Gemini architect.
 * Eliminates defaultRootFallback: returns NEEDS_CLARIFICATION / AMBIGUOUS when uncertain.
 */
export async function buildFullTreeTaxonomyProposals({
  rpc,
  geminiKey,
  geminiModel,
  items,
  conversationId,
  draftRevision,
  signal,
}) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const catalog = await loadFullCatalogTree(rpc, signal);
  const validNodeIds = new Set(catalog.categories.map((c) => c.categoryId));

  const proposals = [];
  const unresolved = [];
  const clarifications = [];

  for (const item of items) {
    const service = typeof item?.service === 'string' ? item.service.trim() : '';
    const mode = item?.mode === 'REMOTE' ? 'REMOTE' : item?.mode === 'ON_SITE' ? 'ON_SITE' : null;
    if (!service || service.length < 3 || !mode) continue;
    const norm = normalizedClassificationIdentity(service);
    if (!norm) continue;
    const decodedHandoff = mode === 'REMOTE' ? (decodeServiceHandoff(item.handoff) ?? { required: false }) : undefined;

    const matches = catalog.byNormalizedKey.get(norm) ?? [];
    if (matches.length === 1) {
      const match = matches[0];
      const hasMode = Array.isArray(match.modes) && match.modes.includes(mode);
      proposals.push({
        service,
        mode,
        action: hasMode ? 'REUSE_EXISTING' : 'EXTEND_MODE',
        categoryId: match.categoryId,
        parentId: '',
        proposedPath: [],
        reason: hasMode
          ? `Usluga je pronađena u postojećem katalogu (${match.path.join(' > ')}).`
          : `Postojeća kategorija (${match.path.join(' > ')}) proširuje se za ${mode === 'REMOTE' ? 'rad na daljinu' : 'rad na lokaciji'}.`,
        catalogVersion: catalog.catalogVersion,
        ...(decodedHandoff ? { handoff: decodedHandoff } : {}),
      });
    } else {
      const cacheKey = `${catalog.catalogVersion}|${norm}|${mode}`;
      const cachedDecision = cachedNovelDecisions.get(cacheKey);
      if (cachedDecision && validNodeIds.has(cachedDecision.parentId)) {
        proposals.push({
          service,
          mode,
          action: 'CREATE_CHILD',
          categoryId: '',
          parentId: cachedDecision.parentId,
          proposedPath: [service],
          reason: cachedDecision.reason,
          catalogVersion: catalog.catalogVersion,
          ...(decodedHandoff ? { handoff: decodedHandoff } : {}),
        });
      } else {
        unresolved.push({ service, mode, handoff: decodedHandoff });
      }
    }
  }

  if (unresolved.length > 0) {
    let aiDecisions = [];
    if (geminiKey && geminiModel) {
      try {
        aiDecisions = await classifyNovelServicesWithGemini({
          geminiKey,
          geminiModel,
          catalog,
          unresolvedItems: unresolved.map(({ service, mode }) => ({ service, mode })),
          signal,
        });
      } catch (err) {
        console.warn('BG_GEMINI_ARCHITECT_FALLBACK', err?.message ?? 'ERR');
      }
    }

    for (const item of unresolved) {
      const norm = normalizedClassificationIdentity(item.service);
      const decision = aiDecisions.find(
        (d) => normalizedClassificationIdentity(d?.service) === norm && d?.mode === item.mode
      );

      const isAmbiguous = decision?.action === 'NEEDS_CLARIFICATION' ||
        decision?.action === 'AMBIGUOUS' ||
        !decision?.parentId ||
        !validNodeIds.has(decision.parentId);

      if (isAmbiguous) {
        const ambiguityPrompt = (typeof decision?.ambiguityPrompt === 'string' && decision.ambiguityPrompt.trim().length >= 8)
          ? decision.ambiguityPrompt.trim()
          : `Da li možete da pojasnite šta tačno podrazumeva usluga „${item.service}“?`;
        const reason = (typeof decision?.reason === 'string' && decision.reason.trim().length >= 10)
          ? decision.reason.trim().slice(0, 900)
          : `Usluga „${item.service}“ je višeznačna i zahteva pojašnjenje tačnog obima posla.`;

        const clarification = {
          conversationId: conversationId ?? null,
          draftRevision: draftRevision ?? null,
          service: item.service,
          mode: item.mode,
          action: 'NEEDS_CLARIFICATION',
          ambiguityPrompt,
          reason,
          createdAt: new Date().toISOString(),
        };
        clarifications.push(clarification);
        if (conversationId) {
          storeClarificationHint(conversationId, draftRevision, clarification);
          void persistClarificationHint(rpc, clarification).catch(() => null);
        }
      } else {
        const parentId = decision.parentId;
        const rawReason = typeof decision?.reason === 'string' && decision.reason.trim().length >= 10
          ? decision.reason.trim().slice(0, 900)
          : `Nova specifična usluga „${item.service}“ raspoređena pod odgovarajuću granu kataloga.`;

        cachedNovelDecisions.set(`${catalog.catalogVersion}|${norm}|${item.mode}`, {
          parentId,
          reason: rawReason,
        });
        proposals.push({
          service: item.service,
          mode: item.mode,
          action: 'CREATE_CHILD',
          categoryId: '',
          parentId,
          proposedPath: [item.service],
          reason: rawReason,
          catalogVersion: catalog.catalogVersion,
          ...(item.handoff ? { handoff: item.handoff } : {}),
        });
      }
    }
  }

  return {
    catalogVersion: catalog.catalogVersion,
    proposals,
    clarifications,
    clarificationHint: clarifications[0] ?? null,
  };
}

async function classifyWorkerServicesWithGemini({
  geminiKey,
  geminiModel,
  catalog,
  skills,
  userMessages,
  priorModes,
  hasWorkAreas,
  signal,
}) {
  const treeLines = catalog.categories.map((c) => {
    const indent = '  '.repeat(Math.max(0, (c.path?.length ?? 1) - 1));
    return `${indent}- ${c.label} [id:${c.categoryId}] [modes:${(c.modes ?? []).join(',')}]`;
  }).join('\n');

  const systemText = [
    'Ti si USKOČI Arhitekta stabla usluga za radni profil (drugi Gemini u pozadini).',
    'Ispred sebe vidiš KOMPLETNO stablo svih postojećih kategorija u bazi, listu usluga radnika (skills) i njegove poruke.',
    'Za SVAKU uslugu iz liste skills odredi:',
    '1. mode: "ON_SITE" (rad na lokaciji/terenu) ili "REMOTE" (rad na daljinu/od kuće/online). Ako je usluga već imala potvrđen mode u priorModes a korisnik ga nije menjao, zadrži taj mode. Ako je usluga fizički/terenski posao ili radnik navodi područje rada (hasWorkAreas=true) bez rada na daljinu, koristi "ON_SITE".',
    '2. Ako usluga ne postoji u stablu pod tim nazivom, izaberi NAJPRECIZNIJEG postojećeg roditelja iz stabla (parentId UUID). Ako je veština preširoka ili višeznačna (npr. samo "klima" bez montaža/servis ili "nameštaj"), vrati action="NEEDS_CLARIFICATION", parentId="", i u ambiguityPrompt postavi pitanje za radnika.',
    '3. Za REMOTE uslugu odredi handoffKind: "NONE" (digitalna isporuka bez fizičke predaje), "SHIPPING_RS" (slanje poštom/kurirskom službom u Srbiji), ili "LOCAL_EXCHANGE" (lično preuzimanje u gradu handoffCity).',
    '4. reason: kratko obrazloženje na srpskom (15 do 200 znakova).',
  ].join(' ');

  const userText = JSON.stringify({
    catalogVersion: catalog.catalogVersion,
    skills,
    hasWorkAreas,
    priorModes,
    recentUserMessages: userMessages.slice(-10),
    completeCatalogTree: treeLines,
  });

  const responseSchema = {
    type: 'OBJECT',
    required: ['items'],
    properties: {
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          required: ['service', 'mode', 'parentId', 'handoffKind', 'handoffCity', 'reason'],
          properties: {
            service: { type: 'STRING' },
            mode: { type: 'STRING', enum: ['ON_SITE', 'REMOTE'] },
            action: { type: 'STRING', enum: ['CREATE_CHILD', 'NEEDS_CLARIFICATION', 'AMBIGUOUS'] },
            parentId: { type: 'STRING' },
            ambiguityPrompt: { type: 'STRING' },
            handoffKind: { type: 'STRING', enum: ['NONE', 'SHIPPING_RS', 'LOCAL_EXCHANGE'] },
            handoffCity: { type: 'STRING' },
            reason: { type: 'STRING' },
          },
        },
      },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema,
        ...(String(geminiModel).includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
    signal,
  });

  if (!res.ok) throw new Error(`GEMINI_WORKER_ARCHITECT_HTTP_${res.status}`);
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const parsed = JSON.parse(rawText);
  return Array.isArray(parsed?.items) ? parsed.items : [];
}

export async function buildWorkerFullTreeTaxonomyProposals({
  rpc,
  geminiKey,
  geminiModel,
  skills,
  messages,
  serviceModeContext,
  hasWorkAreas,
  conversationId,
  draftRevision,
  signal,
}) {
  const cleanSkills = Array.isArray(skills)
    ? skills.filter((s) => typeof s === 'string' && s.trim().length >= 3).map((s) => s.trim())
    : [];
  if (cleanSkills.length === 0) return null;

  const catalog = await loadFullCatalogTree(rpc, signal);
  const validNodeIds = new Set(catalog.categories.map((c) => c.categoryId));

  const priorModes = [
    ...(Array.isArray(serviceModeContext?.savedServices) ? serviceModeContext.savedServices : []),
    ...(Array.isArray(serviceModeContext?.draftServices) ? serviceModeContext.draftServices : []),
  ];
  const userMessages = Array.isArray(messages)
    ? messages.filter((m) => m?.role === 'USER' && typeof m?.body === 'string').map((m) => m.body)
    : [];

  let aiItems = [];
  if (geminiKey && geminiModel) {
    try {
      aiItems = await classifyWorkerServicesWithGemini({
        geminiKey,
        geminiModel,
        catalog,
        skills: cleanSkills,
        userMessages,
        priorModes,
        hasWorkAreas: Boolean(hasWorkAreas),
        signal,
      });
    } catch (err) {
      console.warn('BG_WORKER_GEMINI_ARCHITECT_FALLBACK', err?.message ?? 'ERR');
    }
  }

  const proposals = [];
  const clarifications = [];
  const seenKeys = new Set();

  for (const service of cleanSkills) {
    const norm = normalizedClassificationIdentity(service);
    if (!norm) continue;

    const matchingAi = aiItems.filter((item) => normalizedClassificationIdentity(item?.service) === norm);
    const matchingPrior = priorModes.filter((item) => normalizedClassificationIdentity(item?.service) === norm);

    let chosenEntries = [];
    if (matchingAi.length > 0) {
      chosenEntries = matchingAi.map((entry) => {
        const mode = entry.mode === 'REMOTE' ? 'REMOTE' : 'ON_SITE';
        let handoff = undefined;
        if (mode === 'REMOTE') {
          if (entry.handoffKind === 'SHIPPING_RS') {
            handoff = { required: true, shippingCountries: ['RS'] };
          } else if (entry.handoffKind === 'LOCAL_EXCHANGE' && typeof entry.handoffCity === 'string' && entry.handoffCity.trim().length >= 3) {
            handoff = { required: true, localExchange: { countryCode: 'RS', city: entry.handoffCity.trim() } };
          } else {
            handoff = { required: false };
          }
        }
        return {
          mode,
          handoff,
          action: entry.action ?? 'CREATE_CHILD',
          parentId: entry.parentId,
          ambiguityPrompt: entry.ambiguityPrompt,
          reason: entry.reason,
        };
      });
    } else if (matchingPrior.length > 0) {
      chosenEntries = matchingPrior.map((entry) => ({
        mode: entry.mode === 'REMOTE' ? 'REMOTE' : 'ON_SITE',
        handoff: entry.mode === 'REMOTE' ? (decodeServiceHandoff(entry.handoff) ?? { required: false }) : undefined,
        action: 'REUSE_EXISTING',
        parentId: '',
        reason: 'Zadržan ranije izabran način rada za ovu uslugu.',
      }));
    } else {
      const catMatches = catalog.byNormalizedKey.get(norm) ?? [];
      const defaultMode = catMatches.length === 1 && Array.isArray(catMatches[0].modes) && catMatches[0].modes.length === 1
        ? catMatches[0].modes[0]
        : 'ON_SITE';
      chosenEntries = [{
        mode: defaultMode,
        handoff: defaultMode === 'REMOTE' ? { required: false } : undefined,
        action: catMatches.length === 1 ? 'REUSE_EXISTING' : 'NEEDS_CLARIFICATION',
        parentId: '',
        reason: 'Standardni način izvršenja usluge prema profilu i katalogu.',
      }];
    }

    for (const chosen of chosenEntries) {
      const dedupeKey = `${norm}|${chosen.mode}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      const matches = catalog.byNormalizedKey.get(norm) ?? [];
      if (matches.length === 1) {
        const match = matches[0];
        const hasMode = Array.isArray(match.modes) && match.modes.includes(chosen.mode);
        proposals.push({
          service,
          mode: chosen.mode,
          action: hasMode ? 'REUSE_EXISTING' : 'EXTEND_MODE',
          categoryId: match.categoryId,
          parentId: '',
          proposedPath: [],
          reason: hasMode
            ? `Usluga je pronađena u postojećem katalogu (${match.path.join(' > ')}).`
            : `Postojeća kategorija (${match.path.join(' > ')}) proširuje se za ${chosen.mode === 'REMOTE' ? 'rad na daljinu' : 'rad na lokaciji'}.`,
          catalogVersion: catalog.catalogVersion,
          ...(chosen.mode === 'REMOTE' && chosen.handoff ? { handoff: chosen.handoff } : {}),
        });
      } else {
        const isValidParent = chosen.parentId && validNodeIds.has(chosen.parentId);
        if (isValidParent && chosen.action !== 'NEEDS_CLARIFICATION' && chosen.action !== 'AMBIGUOUS') {
          const rawReason = typeof chosen.reason === 'string' && chosen.reason.trim().length >= 10
            ? chosen.reason.trim().slice(0, 900)
            : `Nova specifična usluga „${service}“ raspoređena pod odgovarajuću granu kataloga.`;
          proposals.push({
            service,
            mode: chosen.mode,
            action: 'CREATE_CHILD',
            categoryId: '',
            parentId: chosen.parentId,
            proposedPath: [service],
            reason: rawReason,
            catalogVersion: catalog.catalogVersion,
            ...(chosen.mode === 'REMOTE' && chosen.handoff ? { handoff: chosen.handoff } : {}),
          });
        } else {
          // Never dump into default root fallback; emit clarification hint
          const ambiguityPrompt = (typeof chosen.ambiguityPrompt === 'string' && chosen.ambiguityPrompt.trim().length >= 8)
            ? chosen.ambiguityPrompt.trim()
            : `Da li možete da pojasnite koje tačno radove podrazumeva „${service}“?`;
          const clarification = {
            conversationId: conversationId ?? null,
            draftRevision: draftRevision ?? null,
            service,
            mode: chosen.mode,
            action: 'NEEDS_CLARIFICATION',
            ambiguityPrompt,
            reason: chosen.reason || `Usluga „${service}“ zahteva pojašnjenje tačnih kompetencija.`,
            createdAt: new Date().toISOString(),
          };
          clarifications.push(clarification);
          if (conversationId) {
            storeClarificationHint(conversationId, draftRevision, clarification);
            void persistClarificationHint(rpc, clarification).catch(() => null);
          }
        }
      }
    }
  }

  return {
    catalogVersion: catalog.catalogVersion,
    proposals,
    clarifications,
    clarificationHint: clarifications[0] ?? null,
  };
}
