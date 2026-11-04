import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('@react-native-async-storage/async-storage', () => { const values = new Map<string, string>(); return {
  getItem: jest.fn(async (key: string) => values.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { values.delete(key); }), clear: jest.fn(async () => { values.clear(); }),
}; });
import { aiTurnIntentJournal as journal } from '../aiTurnIntentJournal';
import { workerAiTurnIntentJournal as workerJournal } from '../workerAiTurnIntentJournal';
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333', K = '44444444-4444-4444-8444-444444444444';
const intent = { accountId: A, conversationId: C, clientRequestId: K };
beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });
it('persists exactly three opaque UUIDs and keeps accounts isolated', async () => {
  await journal.save(intent); expect(await journal.load(A)).toEqual(intent); expect(await journal.load(B)).toBeNull();
  expect(JSON.parse((await AsyncStorage.getItem('uskoci.ai.turn.intent.v1.' + A))!)).toEqual(intent);
});
it('serializes competing capture without overwriting the unresolved UUID', async () => {
  const outcomes = await Promise.allSettled([journal.save(intent), journal.save({ ...intent, clientRequestId: B })]);
  expect(outcomes.map(o => o.status)).toEqual(['fulfilled', 'rejected']); expect(await journal.load(A)).toEqual(intent);
});
it('a stale clear cannot retire a different command or conversation', async () => {
  await journal.save(intent); await journal.clear({ ...intent, clientRequestId: B });
  await journal.clear({ ...intent, conversationId: B }); expect(await journal.load(A)).toEqual(intent);
  await journal.clear(intent); expect(await journal.load(A)).toBeNull();
});
it('discardCorrupt removes only malformed local IDs after explicit request, never a valid unresolved command',async()=>{
  await journal.save(intent);
  expect(await journal.discardCorrupt(A)).toBe(false);
  expect(await journal.load(A)).toEqual(intent);
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  await AsyncStorage.setItem('uskoci.ai.turn.intent.v1.'+B,JSON.stringify({...intent,accountId:B}));
  await AsyncStorage.setItem('uskoci.ai.turn.intent.v1.'+A,'not-json');
  await expect(journal.load(A)).rejects.toThrow();
  expect(await journal.discardCorrupt(A)).toBe(true);
  expect(await journal.load(A)).toBeNull();
  expect(JSON.parse((await AsyncStorage.getItem('uskoci.ai.turn.intent.v1.'+B))!)).toEqual({...intent,accountId:B});
  await journal.save(intent);
  expect(await journal.load(A)).toEqual(intent);
});

it('discardCorrupt cannot silently remove a valid concurrent captured command',async()=>{
  const fresh={...intent,clientRequestId:B};
  await journal.save(intent);
  const results=await Promise.all([journal.discardCorrupt(A),journal.clear(fresh)]);
  expect(results[0]).toBe(false);
  expect(await journal.load(A)).toEqual(intent);
});

it.each(['not-json', JSON.stringify({ ...intent, text: 'private' }), JSON.stringify({ ...intent, accountId: B })])(
  'fails closed on invalid persisted state without replacing it', async raw => {
    await AsyncStorage.setItem('uskoci.ai.turn.intent.v1.' + A, raw);
    await expect(journal.load(A)).rejects.toThrow('AI_LOCAL_INTENT_INVALID');
    await expect(journal.save(intent)).rejects.toThrow('AI_LOCAL_INTENT_INVALID');
    expect(await AsyncStorage.getItem('uskoci.ai.turn.intent.v1.' + A)).toBe(raw);
  });

it('isolates Need and Worker recovery intents for the same account and survives clearing either one', async () => {
  const workerIntent = { ...intent, conversationId: B, clientRequestId: B };
  const stored = await Promise.allSettled([journal.save(intent), workerJournal.save(workerIntent)]);
  expect(stored.map(x => x.status)).toEqual(['fulfilled', 'fulfilled']);
  expect(await journal.load(A)).toEqual(intent);
  expect(await workerJournal.load(A)).toEqual(workerIntent);
  expect(await AsyncStorage.getItem('uskoci.ai.turn.intent.v1.' + A)).toBe(JSON.stringify(intent));
  expect(await AsyncStorage.getItem('uskoci.worker.ai.turn.intent.v1.' + A)).toBe(JSON.stringify(workerIntent));
  await journal.clear(intent);
  expect(await journal.load(A)).toBeNull();
  expect(await workerJournal.load(A)).toEqual(workerIntent);
  await workerJournal.clear(workerIntent);
  expect(await workerJournal.load(A)).toBeNull();
});

it('an invalid Need journal never authorizes discarding the Worker pending command', async () => {
  const workerIntent = { ...intent, clientRequestId: B };
  await workerJournal.save(workerIntent);
  await AsyncStorage.setItem('uskoci.ai.turn.intent.v1.' + A, 'broken-json');
  expect(await journal.discardCorrupt(A)).toBe(true);
  expect(await workerJournal.load(A)).toEqual(workerIntent);
  expect(await workerJournal.discardCorrupt(A)).toBe(false);
});
