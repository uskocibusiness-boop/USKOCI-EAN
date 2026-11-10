import { uuid } from './serverReceipt';

type Epoch = { retired: boolean; listeners: Set<() => void> };
const epochs = new Map<string, Epoch>();
const history = new Map<string, Set<Epoch>>();
const queues = new Map<string, Promise<unknown>>();
const newEpoch = (accountId: string) => {
  const value: Epoch = { retired: false, listeners: new Set() };
  epochs.set(accountId, value);
  const known = history.get(accountId) ?? new Set(); known.add(value); history.set(accountId, known);
  return value;
};

/** One local queue for all private-message payloads and upload identities of an
 * account. It contains storage operations, never message/provider transport.
 * The explicit logout decision is the only reserved boundary that may wait. */
export function agreementStorageSerial<T>(accountId: string, work: () => Promise<T>): Promise<T> {
  const next = (queues.get(accountId) ?? Promise.resolve()).catch(() => undefined).then(work);
  queues.set(accountId, next);
  void next.finally(() => { if (queues.get(accountId) === next) queues.delete(accountId); }).catch(() => undefined);
  return next;
}
export function captureAgreementStorageOwner(accountId: string) {
  const epoch = epochs.get(accountId) ?? newEpoch(accountId);
  return {
    current: () => !epoch.retired,
    subscribe(retire: () => void) {
      if (epoch.retired) retire(); else epoch.listeners.add(retire);
      return () => { epoch.listeners.delete(retire); };
    },
  };
}

type ErasureStorage = { getAllKeys(): Promise<readonly string[]>; multiRemove(keys: readonly string[]): Promise<unknown> };
/** Reserve BEFORE awaiting Auth. Older owners are retired only on confirmation;
 * newer incarnations wait behind this exact purge and then write safely. */
export function prepareAgreementOutboxErasure(accountId: string, storage: ErasureStorage) {
  if (!uuid(accountId)) return { confirm: () => Promise.resolve(0), cancel: () => Promise.resolve(0) };
  const before = [...(history.get(accountId) ?? [])]; newEpoch(accountId);
  const prefixes = [`uskoci:agreement-outbox:v1:${accountId}:`, `uskoci:agreement-draft:v1:${accountId}:`,
    `uskoci:agreement-voice-outbox:v1:${accountId}:`, `uskoci:agreement-voice-draft:v1:${accountId}:`,
    `uskoci.agreement.photos.v1.${accountId}.`, `uskoci.agreement.voice.v1.${accountId}.`];
  let decide!: (erase: boolean) => void, decided = false;
  const decision = new Promise<boolean>(resolve => { decide = resolve; });
  const task = agreementStorageSerial(accountId, async () => {
    if (!await decision) return 0;
    const keys = (await storage.getAllKeys()).filter(key => prefixes.some(prefix => key.startsWith(prefix)));
    if (keys.length) await storage.multiRemove(keys);
    return keys.length;
  });
  const finish = (erase: boolean) => {
    if (!decided) {
      decided = true;
      if (erase) for (const epoch of before) {
        epoch.retired = true; history.get(accountId)?.delete(epoch);
        for (const retire of epoch.listeners) { try { retire(); } catch { /* One UI subscriber cannot prevent erasure. */ } }
        epoch.listeners.clear();
      }
      decide(erase);
    }
    return task;
  };
  return { confirm: () => finish(true), cancel: () => finish(false) };
}
