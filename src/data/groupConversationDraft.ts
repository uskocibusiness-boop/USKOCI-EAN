import { groupBody, groupBodyHash, normalizeGroupBody, type GroupJournal, type GroupReceipt } from './groupConversationService';
import { record, uuid } from './serverReceipt';

const PREFIX = 'uskoci:group-draft:v1:';
const MAX_TEXT = 32_000;
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };
type Capture = { clientRequestId: string; bodySha256: string; draftRevision: number; confirmed: boolean; body: string | null };
type StoredDraft = { version: 1; accountId: string; agreementId: string; groupId: string; revision: number; text: string; capture: Capture | null };
export type GroupDraftSnapshot = { text: string; groupId: string | null; loaded: boolean; saving: boolean; error: string | null; capture: Capture | null; newerThanCapture: boolean };
const EMPTY: GroupDraftSnapshot = { text: '', groupId: null, loaded: false, saving: false, error: null, capture: null, newerThanCapture: false };
const FAILED = 'Nacrt nije sačuvan na ovom uređaju. Proverite stanje pre izlaska iz razgovora.';
const queues = new Map<string, Promise<void>>();
type Epoch = { retired: boolean };
const epochs = new Map<string, Epoch>();
const history = new Map<string, Set<Epoch>>();
const retired = new Map<string, Map<() => void, Epoch>>();
function newEpoch(accountId: string) { const value = { retired: false }; epochs.set(accountId, value);
  const all = history.get(accountId) ?? new Set<Epoch>(); all.add(value); history.set(accountId, all); return value; }
function epoch(accountId: string) { return epochs.get(accountId) ?? newEpoch(accountId); }
// Draft disk operations, including account erasure, share an account queue.
// Logout reserves its erasure boundary before awaiting Auth, then releases it
// explicitly. A new account incarnation reads only after that boundary settles.
function serial<T>(accountId: string, work: () => Promise<T>): Promise<T> {
  const next = (queues.get(accountId) ?? Promise.resolve()).then(work);
  const tail = next.then(() => undefined, () => undefined); queues.set(accountId, tail);
  void tail.then(() => { if (queues.get(accountId) === tail) queues.delete(accountId); });
  return next;
}
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function parse(raw: string | null, accountId: string, agreementId: string, groupId: string): StoredDraft | null {
  if (raw === null) return null;
  if (raw.length > MAX_TEXT * 6 + 16_384) throw Error('GROUP_DRAFT_INVALID');
  const value = record(JSON.parse(raw));
  if (!value || !exact(value, ['version', 'accountId', 'agreementId', 'groupId', 'revision', 'text', 'capture'])
    || value.version !== 1 || value.accountId !== accountId || value.agreementId !== agreementId || value.groupId !== groupId
    || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 || typeof value.text !== 'string' || value.text.length > MAX_TEXT)
    throw Error('GROUP_DRAFT_INVALID');
  if (value.capture !== null) {
    const c = record(value.capture);
    if (!c || !exact(c, ['clientRequestId', 'bodySha256', 'draftRevision', 'confirmed', 'body']) || !uuid(c.clientRequestId)
      || typeof c.bodySha256 !== 'string' || !/^[a-f0-9]{64}$/.test(c.bodySha256) || !Number.isSafeInteger(c.draftRevision)
      || (c.draftRevision as number) < 1 || (c.draftRevision as number) > (value.revision as number) || typeof c.confirmed !== 'boolean'
      || (c.confirmed ? c.body !== null : !groupBody(c.body) || groupBodyHash(c.body) !== c.bodySha256)) throw Error('GROUP_DRAFT_INVALID');
  }
  return value as StoredDraft;
}
const matches = (capture: Capture | null, command: Pick<GroupJournal, 'clientRequestId' | 'bodySha256'>) =>
  capture?.clientRequestId === command.clientRequestId && capture.bodySha256 === command.bodySha256;

export function createGroupConversationDraft(options: { accountId: string; agreementId: string; storage: Storage; owns: () => boolean }) {
  const { accountId, agreementId, storage } = options;
  const validScope = uuid(accountId) && uuid(agreementId);
  const incarnation = epoch(accountId), listeners = new Set<() => void>();
  let alive = false, snapshot = EMPTY, knownRevision = 0, localRevision = 0, dirty = false;
  const owns = () => validScope && !incarnation.retired && options.owns();
  const notify = () => { for (const listener of listeners) { try { listener(); } catch { /* A UI listener cannot invalidate a durable write or erasure. */ } } };
  const publish = (patch: Partial<GroupDraftSnapshot>) => { if (!alive || !owns()) return;
    snapshot = { ...snapshot, ...patch }; notify(); };
  const forget = () => { snapshot = EMPTY; dirty = false; localRevision++; knownRevision = 0; notify(); };
  const key = (groupId: string) => `${PREFIX}${accountId}:${agreementId}:${groupId}`;
  const read = async (groupId: string) => parse(await storage.getItem(key(groupId)), accountId, agreementId, groupId);
  const check = () => { if (!owns()) throw Error('AUTH_CONTEXT_CHANGED'); };
  const save = async (groupId: string, previous: StoredDraft | null, text: string, capture: Capture | null) => {
    check(); const revision = (previous?.revision ?? 0) + 1;
    if (!Number.isSafeInteger(revision) || text.length > MAX_TEXT) throw Error('GROUP_DRAFT_INVALID');
    const next: StoredDraft = { version: 1, accountId, agreementId, groupId, revision, text, capture };
    await storage.setItem(key(groupId), JSON.stringify(next)); check(); knownRevision = revision; return next;
  };
  const checkedRead = async (groupId: string) => { const previous = await read(groupId); check();
    if ((previous?.revision ?? 0) !== knownRevision) throw Error('GROUP_DRAFT_CHANGED'); return previous; };
  const persist = async (groupId: string) => {
    const previous = await checkedRead(groupId);
    if (!dirty) return previous;
    const edit = localRevision, text = snapshot.text;
    const next = await save(groupId, previous, text, previous?.capture ?? null);
    if (edit === localRevision) { dirty = false; publish({ saving: false, error: null, capture: next.capture,
      newerThanCapture: !!next.capture && next.revision !== next.capture.draftRevision }); }
    return next;
  };
  const guarded = async <T>(work: () => Promise<T>): Promise<T> => {
    try { return await work(); } catch (error) { publish({ saving: false, error: FAILED }); throw error; }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() { alive = true; if (!validScope) return;
      const registry = retired.get(accountId) ?? new Map<() => void, Epoch>(); registry.set(forget, incarnation); retired.set(accountId, registry); },
    dispose() { alive = false; listeners.clear(); const registry = retired.get(accountId); registry?.delete(forget);
      if (registry && !registry.size) retired.delete(accountId); },
    async load(groupId: string) {
      if (!alive || !owns() || !uuid(groupId)) throw Error('GROUP_DRAFT_SCOPE_INVALID');
      if (snapshot.groupId !== groupId) { snapshot = { ...EMPTY, groupId }; dirty = false; knownRevision = 0; localRevision++; }
      const edit = localRevision;
      return guarded(() => serial(accountId, async () => {
        check(); const stored = await read(groupId); check();
        // A failed local edit stays in RAM across a warm return. A cold instance
        // has no dirty text and adopts only this account's authorized group row.
        if (!dirty && localRevision === edit) {
          knownRevision = stored?.revision ?? 0;
          publish({ text: stored?.text ?? '', loaded: true, capture: stored?.capture ?? null, error: null,
            newerThanCapture: !!stored?.capture && stored.revision !== stored.capture.draftRevision });
        } else {
          if ((stored?.revision ?? 0) !== knownRevision) throw Error('GROUP_DRAFT_CHANGED');
          publish({ loaded: true });
        }
        return snapshot;
      }));
    },
    change(text: string) {
      if (!alive || !owns() || !snapshot.loaded || !snapshot.groupId || text.length > MAX_TEXT) return;
      const groupId = snapshot.groupId; localRevision++; dirty = true;
      publish({ text, saving: true, newerThanCapture: !!snapshot.capture });
      void guarded(() => serial(accountId, async () => { check(); if (dirty) await persist(groupId); })).catch(() => undefined);
    },
    async flush() {
      if (!alive || !owns() || !snapshot.loaded || !snapshot.groupId) throw Error('GROUP_DRAFT_NOT_READY');
      const groupId = snapshot.groupId; publish({ saving: true });
      return guarded(() => serial(accountId, async () => {
        check(); await persist(groupId); publish({ saving: false, error: null });
      }));
    },
    async capture(journal: GroupJournal, body: string) {
      if (!alive || !snapshot.loaded || snapshot.groupId !== journal.groupId || journal.version !== 1 || !uuid(journal.clientRequestId)) throw Error('GROUP_DRAFT_NOT_READY');
      return guarded(() => serial(accountId, async () => {
        check(); let previous = await persist(journal.groupId); check();
        if (!groupBody(body) || groupBodyHash(body) !== journal.bodySha256) throw Error('GROUP_DRAFT_CAPTURE_INVALID');
        if (previous?.capture?.confirmed && previous.capture.clientRequestId === journal.clientRequestId) throw Error('GROUP_DRAFT_ALREADY_CONFIRMED');
        if (previous?.capture && !previous.capture.confirmed) {
          if (!matches(previous.capture, journal) || previous.capture.body !== body) throw Error('GROUP_DRAFT_UNRESOLVED');
          return;
        }
        if (!previous || normalizeGroupBody(previous.text) !== body) throw Error('GROUP_DRAFT_CHANGED');
        const capture: Capture = { clientRequestId: journal.clientRequestId, bodySha256: journal.bodySha256,
          draftRevision: previous.revision + 1, body, confirmed: false };
        previous = await save(journal.groupId, previous, previous.text, capture);
        publish({ capture, newerThanCapture: false, error: null });
      }));
    },
    async confirm(receipt: GroupReceipt) {
      if (!alive || receipt.accountId !== accountId || receipt.groupId !== snapshot.groupId) throw Error('GROUP_DRAFT_SCOPE_INVALID');
      return guarded(() => serial(accountId, async () => {
        check(); const previous = await persist(receipt.groupId); check();
        if (!previous?.capture || !matches(previous.capture, receipt) || previous.capture.confirmed) return;
        // Revision ownership matters even if a newer edit has identical bytes.
        const clear = previous.revision === previous.capture.draftRevision;
        const capture = { ...previous.capture, confirmed: true, body: null };
        const edit = localRevision;
        const next = await save(receipt.groupId, previous, clear ? '' : previous.text, capture);
        if (edit === localRevision) { dirty = false; publish({ text: next.text, capture, error: null,
          newerThanCapture: !clear }); }
      }));
    },
  };
}
export type GroupConversationDraft = ReturnType<typeof createGroupConversationDraft>;

type ErasureStorage = {
  getAllKeys(): Promise<readonly string[]>; multiRemove(keys: readonly string[]): Promise<unknown>;
};
/** Capture the logout boundary BEFORE awaiting Auth. New account incarnations
 * queue behind this decision and use a new epoch, so a late old logout cannot
 * erase their edits. An Auth failure releases the boundary without deleting.
 * No network call is made here; only the caller's explicit decision is awaited. */
export function prepareGroupDraftErasure(accountId: string, storage: ErasureStorage) {
  if (!uuid(accountId)) return { confirm: () => Promise.resolve(0), cancel: () => Promise.resolve(0) };
  const before = [...(history.get(accountId) ?? [])]; newEpoch(accountId);
  let decide!: (erase: boolean) => void, decided = false;
  const decision = new Promise<boolean>(resolve => { decide = resolve; });
  const task = serial(accountId, async () => {
    if (!await decision) return 0;
    const keys = (await storage.getAllKeys()).filter(key => key.startsWith(`${PREFIX}${accountId}:`));
    if (keys.length) await storage.multiRemove(keys); return keys.length;
  });
  const finish = (erase: boolean) => {
    if (!decided) {
      decided = true;
      if (erase) {
        for (const value of before) { value.retired = true; history.get(accountId)?.delete(value); }
        for (const [retire, value] of retired.get(accountId) ?? []) if (before.includes(value)) { try { retire(); } catch { /* disk erasure still runs */ } }
      }
      decide(erase);
    }
    return task;
  };
  return { confirm: () => finish(true), cancel: () => finish(false) };
}
export function forgetGroupConversationDrafts(accountId: string, storage: ErasureStorage): Promise<number> {
  return prepareGroupDraftErasure(accountId, storage).confirm();
}
