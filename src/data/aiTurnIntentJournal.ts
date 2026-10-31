import AsyncStorage from '@react-native-async-storage/async-storage';
import { record, uuid } from './serverReceipt';

export type AiTurnIntent = { accountId: string; conversationId: string; clientRequestId: string };
const key = (accountId: string) => `uskoci.ai.turn.intent.v1.${accountId}`;
const chains = new Map<string, Promise<unknown>>();
function queue<T>(accountId: string, work: () => Promise<T>): Promise<T> {
  const next = (chains.get(accountId) ?? Promise.resolve()).catch(() => undefined).then(work);
  chains.set(accountId, next);
  void next.finally(() => { if (chains.get(accountId) === next) chains.delete(accountId); }).catch(() => undefined);
  return next;
}
function parse(raw: string | null, accountId: string): AiTurnIntent | null {
  if (!uuid(accountId)) throw new Error('AI_LOCAL_INTENT_INVALID');
  if (raw === null) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('AI_LOCAL_INTENT_INVALID'); }
  const value = record(parsed);
  if (!value || Object.keys(value).length !== 3 || value.accountId !== accountId
    || !uuid(value.conversationId) || !uuid(value.clientRequestId)) throw new Error('AI_LOCAL_INTENT_INVALID');
  return { accountId, conversationId: value.conversationId, clientRequestId: value.clientRequestId };
}
/** Opaque IDs only. Unknown outcomes survive app exit/logout. The calling UI
 * must resolve or explicitly fence the same server command before clearing. */
export const aiTurnIntentJournal = {
  load: (accountId: string) => queue(accountId, async () => parse(await AsyncStorage.getItem(key(accountId)), accountId)),
  save: (intent: AiTurnIntent) => queue(intent.accountId, async () => {
    const encoded = JSON.stringify(intent);
    parse(encoded, intent.accountId);
    const old = parse(await AsyncStorage.getItem(key(intent.accountId)), intent.accountId);
    if (old && (old.conversationId !== intent.conversationId || old.clientRequestId !== intent.clientRequestId))
      throw new Error('AI_UNRESOLVED_INTENT');
    await AsyncStorage.setItem(key(intent.accountId), encoded);
  }),

  /** Explicitly abandon ONLY an unparsable/invalid local ID record. A valid
   * unresolved command is never cleared here, even if the user asks again.
   * Server state is untouched; any unknown server outcome stays unknown.
   */
  discardCorrupt: (accountId: string) => queue(accountId, async () => {
    if (!uuid(accountId)) throw new Error('AI_LOCAL_INTENT_INVALID');
    const storageKey = key(accountId);
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw === null) return false;
    try {
      parse(raw, accountId);
      return false; // Valid pending server command: must use recoverTurn/readback.
    } catch (error) {
      if (!(error instanceof SyntaxError)
          && !(error instanceof Error && error.message === 'AI_LOCAL_INTENT_INVALID')) throw error;
    }
    // Another local write, if any, cannot be discarded on a stale observation.
    if (await AsyncStorage.getItem(storageKey) !== raw) return false;
    await AsyncStorage.removeItem(storageKey);
    return true;
  }),
  clear: (intent: AiTurnIntent) => queue(intent.accountId, async () => {
    const old = parse(await AsyncStorage.getItem(key(intent.accountId)), intent.accountId);
    if (old?.conversationId === intent.conversationId && old.clientRequestId === intent.clientRequestId)
      await AsyncStorage.removeItem(key(intent.accountId));
  }),
};
