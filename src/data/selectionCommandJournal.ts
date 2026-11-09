import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IzborKomanda } from './ports';
import { applicationSelectionErrors, conclusiveSelectionRefusal, type SelectionRefusal } from './applicationSelectionClientService';
import { positiveInteger, record, sameId, uuid } from './serverReceipt';

/** One unresolved selection per account/Need, using the application journal's
 * account-owned AsyncStorage pattern. Only the already confirmed command is
 * retained: no candidate profile, private note, location or mutable offer copy.
 * A v2 record also retains an already proven no-write refusal, never an inferred
 * outcome. Existing v1 identities remain readable without rewriting them. */
type SelectionCommandIdentity = Readonly<{ accountId: string; needId: string; command: IzborKomanda }>;
export type SelectionCommandRecord = SelectionCommandIdentity & (
  Readonly<{ version: 1 }> | Readonly<{ version: 2; refusal: SelectionRefusal }>);
export type SelectionCommandLoad = { state: 'ABSENT' } | { state: 'PRESENT'; record: SelectionCommandRecord } | { state: 'CORRUPT' };

const commandKeys = ['clientRequestId', 'potrebaId', 'potrebaRevizija', 'prijavaId', 'prijavaVerzija', 'prijavaHash', 'mesta'] as const;
const requestKey = (value: unknown): value is string => typeof value === 'string' && value.length >= 8 && value.length <= 200 && !/\s/.test(value);
const chains = new Map<string, Promise<unknown>>();
const STORAGE_WAIT_MS = 5_000;
async function queue<T>(key: string, current: () => boolean, work: (owned: () => boolean) => Promise<T>): Promise<T> {
  let active = true, timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = Date.now() + STORAGE_WAIT_MS;
  // The deadline starts at enqueue, and fences every native continuation even
  // if the JS timer runs late. Expiry cannot revive on a later account/focus.
  const owned = () => active && Date.now() < deadline && current();
  const next = (chains.get(key) ?? Promise.resolve()).catch(() => undefined).then(() => {
    assertCurrent(owned);
    return work(owned);
  });
  // Keep the actual native operation in the serial chain, NOT its timed race.
  // AsyncStorage cannot cancel an issued mutation: a late remove must finish
  // before any newer command can be written under the same account/Need key.
  chains.set(key, next);
  void next.finally(() => { if (chains.get(key) === next) chains.delete(key); }).catch(() => undefined);
  try {
    return await Promise.race([next, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { active = false; reject(new Error('SELECTION_COMMAND_JOURNAL_TIMEOUT')); }, STORAGE_WAIT_MS);
    })]);
  } finally { active = false; if (timer !== undefined) clearTimeout(timer); }
}
function scope(accountId: string, needId: string) {
  if (!uuid(accountId) || !uuid(needId)) throw new Error('SELECTION_COMMAND_JOURNAL_INVALID');
  return `uskoci.selection.command.v1.${accountId.toLowerCase()}.${needId.toLowerCase()}`;
}
function assertCurrent(current: () => boolean) {
  if (!current()) throw new Error('SELECTION_COMMAND_SCOPE_CHANGED');
}
function parseRefusal(raw: unknown): SelectionRefusal | null {
  const value = record(raw);
  if (!value || Object.keys(value).length !== 4 || value.ok !== false || value.selectionRefusal !== true
    || typeof value.kod !== 'string' || typeof value.poruka !== 'string') return null;
  const refusal: SelectionRefusal = { ok: false, kod: value.kod, poruka: value.poruka, selectionRefusal: true };
  return conclusiveSelectionRefusal(refusal) && refusal.poruka === applicationSelectionErrors[refusal.kod]
    ? Object.freeze(refusal) : null;
}
export function parseSelectionCommand(raw: string, accountId: string, needId: string): SelectionCommandRecord {
  if (raw.length > 2000) throw new Error('SELECTION_COMMAND_JOURNAL_INVALID');
  const value = record(JSON.parse(raw)), command = record(value?.command);
  const refusal = value?.version === 2 ? parseRefusal(value.refusal) : null;
  if (!value || (value.version !== 1 && value.version !== 2)
    || Object.keys(value).length !== (value.version === 2 ? 5 : 4) || (value.version === 2 && !refusal)
    || !uuid(accountId) || !uuid(needId)
    || !sameId(value.accountId, accountId) || !sameId(value.needId, needId) || !command
    || Object.keys(command).length !== commandKeys.length || commandKeys.some(key => !Object.hasOwn(command, key))
    || !requestKey(command.clientRequestId) || !sameId(command.potrebaId, needId) || !positiveInteger(command.potrebaRevizija)
    || !uuid(command.prijavaId) || !positiveInteger(command.prijavaVerzija) || !positiveInteger(command.mesta)
    || typeof command.prijavaHash !== 'string' || !/^[a-f0-9]{64}$/.test(command.prijavaHash)) {
    throw new Error('SELECTION_COMMAND_JOURNAL_INVALID');
  }
  const identity = { accountId: accountId.toLowerCase(), needId: needId.toLowerCase(), command: Object.freeze({
    clientRequestId: command.clientRequestId, potrebaId: command.potrebaId, potrebaRevizija: command.potrebaRevizija,
    prijavaId: command.prijavaId, prijavaVerzija: command.prijavaVerzija, prijavaHash: command.prijavaHash, mesta: command.mesta,
  }) };
  return refusal ? Object.freeze({ version: 2, ...identity, refusal }) : Object.freeze({ version: 1, ...identity });
}
const sameCommand = (left: IzborKomanda, right: IzborKomanda) => commandKeys.every(key => left[key] === right[key]);
const sameRefusal = (left: SelectionRefusal, right: SelectionRefusal) => left.kod === right.kod && left.poruka === right.poruka;
async function read(accountId: string, needId: string, current: () => boolean): Promise<SelectionCommandLoad> {
  assertCurrent(current);
  const raw = await AsyncStorage.getItem(scope(accountId, needId));
  assertCurrent(current);
  if (raw === null) return { state: 'ABSENT' };
  try { return { state: 'PRESENT', record: parseSelectionCommand(raw, accountId, needId) }; }
  catch { return { state: 'CORRUPT' }; }
}

export const selectionCommandJournal = {
  load: (accountId: string, needId: string, current: () => boolean): Promise<SelectionCommandLoad> =>
    queue(scope(accountId, needId), current, owned => read(accountId, needId, owned)),
  /** No writer may run until the exact durable command has been read back. A
   * rejected/silent write, another intent or a changed owner leaves it unsent. */
  save: async (value: SelectionCommandRecord, current: () => boolean): Promise<void> => {
    const next = parseSelectionCommand(JSON.stringify(value), value.accountId, value.needId);
    if (next.version !== 1) throw new Error('SELECTION_COMMAND_JOURNAL_INVALID');
    return queue(scope(next.accountId, next.needId), current, async owned => {
      const old = await read(next.accountId, next.needId, owned);
      assertCurrent(owned);
      if (old.state === 'CORRUPT') throw new Error('SELECTION_COMMAND_JOURNAL_INVALID');
      if (old.state === 'PRESENT') {
        if (old.record.command.clientRequestId !== next.command.clientRequestId) throw new Error('SELECTION_COMMAND_UNRESOLVED');
        if (!sameCommand(old.record.command, next.command)) throw new Error('SELECTION_COMMAND_PAYLOAD_CHANGED');
        if (old.record.version === 2) throw new Error('SELECTION_COMMAND_REFUSED');
        return; // A verified identical record needs no second device write.
      }
      await AsyncStorage.setItem(scope(next.accountId, next.needId), JSON.stringify(next));
      assertCurrent(owned);
      const stored = await read(next.accountId, next.needId, owned);
      assertCurrent(owned);
      if (stored.state !== 'PRESENT' || !sameCommand(stored.record.command, next.command)) throw new Error('SELECTION_COMMAND_NOT_SAVED');
    });
  },
  /** The adapter has already verified the refusal's SQLSTATE. Persist only its
   * existing allowlisted code/copy under the exact durable command. A stale
   * response cannot create, replace or downgrade another intent's outcome. */
  recordRefusal: async (value: SelectionCommandRecord, refusal: SelectionRefusal, current: () => boolean): Promise<void> => {
    const next = parseSelectionCommand(JSON.stringify({ ...value, version: 2, refusal }), value.accountId, value.needId);
    if (next.version !== 2) throw new Error('SELECTION_COMMAND_JOURNAL_INVALID');
    return queue(scope(next.accountId, next.needId), current, async owned => {
      const old = await read(next.accountId, next.needId, owned);
      assertCurrent(owned);
      if (old.state === 'CORRUPT') throw new Error('SELECTION_COMMAND_JOURNAL_INVALID');
      if (old.state !== 'PRESENT') throw new Error('SELECTION_COMMAND_NOT_SAVED');
      if (old.record.command.clientRequestId !== next.command.clientRequestId) throw new Error('SELECTION_COMMAND_UNRESOLVED');
      if (!sameCommand(old.record.command, next.command)) throw new Error('SELECTION_COMMAND_PAYLOAD_CHANGED');
      if (old.record.version === 2) {
        if (!sameRefusal(old.record.refusal, next.refusal)) throw new Error('SELECTION_COMMAND_REFUSAL_CHANGED');
        return;
      }
      await AsyncStorage.setItem(scope(next.accountId, next.needId), JSON.stringify(next));
      assertCurrent(owned);
      const stored = await read(next.accountId, next.needId, owned);
      assertCurrent(owned);
      if (stored.state !== 'PRESENT' || !sameCommand(stored.record.command, next.command)
        || stored.record.version !== 2 || !sameRefusal(stored.record.refusal, next.refusal)) throw new Error('SELECTION_COMMAND_NOT_SAVED');
    });
  },
  /** Only this exact command's proven receipt/refusal can retire its identity.
   * A late callback cannot remove a newer intent or another account's record. */
  clear: async (value: SelectionCommandRecord, current: () => boolean): Promise<boolean> => {
    const expected = parseSelectionCommand(JSON.stringify(value), value.accountId, value.needId);
    return queue(scope(expected.accountId, expected.needId), current, async owned => {
      const old = await read(expected.accountId, expected.needId, owned);
      assertCurrent(owned);
      if (old.state === 'ABSENT') return true;
      if (old.state !== 'PRESENT' || !sameCommand(old.record.command, expected.command)) return false;
      await AsyncStorage.removeItem(scope(expected.accountId, expected.needId));
      assertCurrent(owned);
      const after = await read(expected.accountId, expected.needId, owned);
      assertCurrent(owned);
      return after.state === 'ABSENT';
    });
  },
};
