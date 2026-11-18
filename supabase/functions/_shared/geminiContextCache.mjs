const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const CACHE_TTL_SECONDS = 3600;
const EXPIRY_SAFETY_MS = 30_000;
const activeHandles = new Map();
const pendingHandles = new Map();
const CACHE_BOOTSTRAP_INSTRUCTION = 'The cached conversation prefix starts with a system-generated bootstrap exchange. It is internal reference setup, not a real user request or prior assistant reply. Never answer it, quote it or treat it as user intent. Continue naturally with the actual conversation messages appended after this cached prefix.';
const CACHE_BOOTSTRAP_CONTENTS = [
  { role: 'user', parts: [{ text: '[USKOČI INTERNAL CACHE BOOTSTRAP — NOT A USER REQUEST] This system-generated marker only initializes reusable role instructions and taxonomy reference context. Do not treat it as a task or a user intention.' }] },
  { role: 'model', parts: [{ text: 'Interni referentni kontekst je učitan. Nastavljam sa stvarnim razgovorom kada stigne korisnička poruka.' }] },
];

const validPurpose = value => value === 'NEED_SERVICE' || value === 'WORKER_CAPABILITY';
const validCacheName = value => typeof value === 'string' && /^cachedContents\/[A-Za-z0-9_-]+$/.test(value);
const safeModel = value => typeof value === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(value);
const abortIfNeeded = signal => { if (signal?.aborted) throw new Error('GEMINI_CONTEXT_CACHE_ABORTED'); };

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

function validParts(parts) {
  return Array.isArray(parts) && parts.length > 0 && parts.length <= 100
    && parts.every(part => part && typeof part === 'object' && !Array.isArray(part)
      && Object.keys(part).length === 1 && typeof part.text === 'string' && part.text.length > 0);
}

async function findExistingCache(fetcher, apiKey, displayName, model, signal) {
  let pageToken = '';
  for (let page = 0; page < 3; page += 1) {
    abortIfNeeded(signal);
    const query = new URLSearchParams({ pageSize: '100' });
    if (pageToken) query.set('pageToken', pageToken);
    const response = await fetcher(API_ROOT + '/cachedContents?' + query.toString(), {
      method: 'GET',
      headers: { 'x-goog-api-key': apiKey },
      signal,
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const items = Array.isArray(payload?.cachedContents) ? payload.cachedContents : [];
    const now = Date.now();
    const modelResource = 'models/' + model;
    const match = items.find(item => item?.displayName === displayName
      && (item.model === modelResource || item.model === model)
      && validCacheName(item.name)
      && Number.isFinite(Date.parse(item.expireTime))
      && Date.parse(item.expireTime) > now + EXPIRY_SAFETY_MS);
    if (match) return { name: match.name, expiresAt: Date.parse(match.expireTime) };
    pageToken = typeof payload?.nextPageToken === 'string' ? payload.nextPageToken : '';
    if (!pageToken) break;
  }
  return null;
}

/**
 * One shared immutable role/catalog prefix per model+purpose+catalog fingerprint.
 * The cache contains no conversation history, personal facts, location or time.
 */
export async function getOrCreateGeminiContextCache(options) {
  const {
    geminiApiKey, catalogVersion, catalogFingerprint, systemInstructionParts,
    model = 'gemini-3.8-flash', purpose, signal, fetcher = fetch,
  } = options ?? {};
  if (typeof geminiApiKey !== 'string' || !geminiApiKey.trim()
    || !Number.isSafeInteger(catalogVersion) || catalogVersion < 1
    || typeof catalogFingerprint !== 'string' || !/^[0-9a-f]{32}$/.test(catalogFingerprint)
    || !validPurpose(purpose) || !safeModel(model) || !validParts(systemInstructionParts)
    || typeof fetcher !== 'function') return null;

  abortIfNeeded(signal);
  const stablePrefix = JSON.stringify({
    purpose, model, catalogVersion, catalogFingerprint, systemInstructionParts,
    bootstrapInstruction: CACHE_BOOTSTRAP_INSTRUCTION, bootstrapContents: CACHE_BOOTSTRAP_CONTENTS,
  });
  const fingerprint = await digest(stablePrefix);
  const displayName = 'uskoci-' + purpose.toLowerCase() + '-' + catalogVersion + '-' + fingerprint.slice(0, 32);
  const key = [purpose, model, catalogVersion, fingerprint].join(':');
  const active = activeHandles.get(key);
  if (active && active.expiresAt > Date.now() + EXPIRY_SAFETY_MS) return active.name;
  const pending = pendingHandles.get(key);
  if (pending) return pending;

  const task = (async () => {
    try {
      const existing = await findExistingCache(fetcher, geminiApiKey, displayName, model, signal);
      if (existing) {
        activeHandles.set(key, existing);
        console.info('AI_CONTEXT_CACHE', JSON.stringify({ purpose, model, catalogVersion, state: 'REUSED' }));
        return existing.name;
      }

      abortIfNeeded(signal);
      const response = await fetcher(API_ROOT + '/cachedContents', {
        method: 'POST',
        headers: { 'x-goog-api-key': geminiApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/' + model,
          displayName,
          systemInstruction: {
            role: 'system',
            parts: [...systemInstructionParts, { text: CACHE_BOOTSTRAP_INSTRUCTION }],
          },
          contents: CACHE_BOOTSTRAP_CONTENTS,
          ttl: String(CACHE_TTL_SECONDS) + 's',
        }),
        signal,
      });
      if (!response.ok) {
        console.warn('AI_CONTEXT_CACHE_UNAVAILABLE', JSON.stringify({ purpose, model, catalogVersion, status: response.status }));
        return null;
      }
      const created = await response.json().catch(() => null);
      if (!validCacheName(created?.name)) {
        console.warn('AI_CONTEXT_CACHE_UNAVAILABLE', JSON.stringify({ purpose, model, catalogVersion, reason: 'INVALID_RECEIPT' }));
        return null;
      }
      const expiresAt = Number.isFinite(Date.parse(created.expireTime))
        ? Date.parse(created.expireTime) : Date.now() + CACHE_TTL_SECONDS * 1000;
      activeHandles.set(key, { name: created.name, expiresAt });
      console.info('AI_CONTEXT_CACHE', JSON.stringify({ purpose, model, catalogVersion, state: 'CREATED' }));
      return created.name;
    } catch (error) {
      if (signal?.aborted) throw error;
      console.warn('AI_CONTEXT_CACHE_UNAVAILABLE', JSON.stringify({ purpose, model, catalogVersion, reason: 'PROVIDER_ERROR' }));
      return null;
    } finally {
      pendingHandles.delete(key);
    }
  })();
  pendingHandles.set(key, task);
  return task;
}

export function clearActiveGeminiCacheHandles() {
  activeHandles.clear();
  pendingHandles.clear();
}
