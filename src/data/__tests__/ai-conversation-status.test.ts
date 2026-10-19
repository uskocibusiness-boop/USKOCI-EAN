import { aiNeedV2Production as client } from '../aiNeedV2Production';
import { NEED_FACT_V2_DEFINITIONS, REQUIRED_NEED_FACT_V2_KEYS, type NeedFactV2Key } from '../../contracts/needFactsV2';

const ACCOUNT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const C = '11111111-1111-4111-8111-111111111111';
const NEED = '22222222-2222-4222-8222-222222222222';
const MESSAGE = '33333333-3333-4333-8333-333333333333';
const FACT = '44444444-4444-4444-8444-444444444444';
let mockOwner: { user: { id: string } | null; accountRevision: number };
const mockHeader = jest.fn(), mockMessages = jest.fn(), mockRpc = jest.fn(), mockSelect = jest.fn(), mockEq = jest.fn();
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockOwner }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({
  from: (table: string) => {
    const query = { select: (...args: unknown[]) => { mockSelect(table, ...args); return query; },
      eq: (...args: unknown[]) => { mockEq(table, ...args); return query; },
      maybeSingle: () => mockHeader(), order: () => mockMessages() };
    return query;
  }, rpc: (...args: unknown[]) => mockRpc(...args),
}) }));
const header = (status = 'OPEN') => ({ id: C, account_id: ACCOUNT, purpose: 'NEED_INTAKE',
  status, fact_schema_version: 'NEED_FACT_V2', bound_need_id: NEED });
const message = () => ({ id: MESSAGE, account_id: ACCOUNT, conversation_id: C, role: 'ASSISTANT',
  body: 'Proveri podatke.', safety: 'REVIEW', proposed_fact_ids: [], sequence_no: 1 });
function fact(key: NeedFactV2Key = 'need.title', value: unknown = 'Montiranje police') {
  const definition = NEED_FACT_V2_DEFINITIONS[key];
  return { id: FACT, key, value, displayValue: 'Potvrdi podatak', status: 'CONFIRMED', source: 'EXPLICIT_USER_ANSWER',
    evidence: null, schemaVersion: 'NEED_FACT_V2', valueType: definition.valueType, privacyClass: definition.privacyClass,
    requiredForDraft: definition.requiredForDraft, material: true };
}
const review = (facts: ReturnType<typeof fact>[] = [], status = 'OPEN') => ({
  conversationId: C, schemaVersion: 'NEED_FACT_V2', status, boundNeedId: NEED, facts,
  missingRequired: REQUIRED_NEED_FACT_V2_KEYS.filter(key => !facts.some(item => item.key === key && item.status === 'CONFIRMED')),
  safety: 'REVIEW', canSaveDraft: false,
});
const ok = (data: unknown) => ({ data, error: null });
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  jest.useRealTimers(); jest.clearAllMocks(); mockHeader.mockReset(); mockMessages.mockReset(); mockRpc.mockReset();
  mockOwner = { user: { id: ACCOUNT }, accountRevision: 1 };
  mockHeader.mockResolvedValue(ok(header())); mockMessages.mockResolvedValue({ ...ok([]), count: 0 }); mockRpc.mockResolvedValue(ok(review()));
});
afterEach(() => jest.useRealTimers());

describe('whole owned conversation projection', () => {
  it('reads explicit handoff as a public optional typed fact without creating a work location', async () => {
    const value = { required: true, localExchange: { countryCode: 'RS', city: 'Novi Sad' } };
    mockRpc.mockResolvedValue(ok(review([fact('need.handoff', value)])));
    const result = await client.loadConversation(C);
    expect(result?.facts).toEqual([expect.objectContaining({key:'need.handoff',value,privacyClass:'PUBLIC',requiredForDraft:false,valueType:'OBJECT'})]);
    expect(result?.facts.some(item=>item.key==='need.task_geography')).toBe(false);
    mockRpc.mockResolvedValue(ok(review([fact('need.handoff', {...value, exactAddress:'PRIVATE 42'})])));
    await expect(client.loadConversation(C)).rejects.toThrow();
  });
  it.each(['OPEN', 'COMPLETED', 'ABANDONED'])('preserves actual stored %s and its bound review', async status => {
    mockHeader.mockResolvedValue(ok(header(status))); mockRpc.mockResolvedValue(ok(review([], status)));
    const result = await client.loadConversation(C);
    expect(result).toMatchObject({ conversationId: C, status, safety: 'REVIEW', review: { boundNeedId: NEED, canSaveDraft: false } });
    expect(mockEq).toHaveBeenCalledWith('ai_conversations', 'account_id', ACCOUNT);
    expect(mockEq).toHaveBeenCalledWith('ai_messages', 'account_id', ACCOUNT);
    expect(mockSelect).toHaveBeenCalledWith('ai_messages', expect.stringContaining('sequence_no'), { count: 'exact' });
    expect(mockRpc).toHaveBeenCalledWith('rpc_ai_need_review_v2', { p_conversation_id: C });
  });
  it.each(['PUBLISHED', 'UNKNOWN', 'open', null, undefined])('rejects unknown lifecycle %j before secondary reads', async status => {
    mockHeader.mockResolvedValue(ok({ ...header(), status }));
    await expect(client.loadConversation(C)).rejects.toThrow(); expect(mockMessages).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
  });
  it('returns null only for an actual missing owned conversation', async () => {
    mockHeader.mockResolvedValue(ok(null)); await expect(client.loadConversation(C)).resolves.toBeNull(); expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each([0, [], {}, { ...header(), account_id: NEED }, { ...header(), id: NEED }, { ...header(), purpose: 'SUPPORT' },
    { ...header(), fact_schema_version: 'LEGACY_TEXT_V1' }, { ...header(), bound_need_id: 'bad' }])('rejects malformed/foreign header %j', async data => {
    mockHeader.mockResolvedValue(ok(data)); await expect(client.loadConversation(C)).rejects.toThrow(); expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each([{ status: 'COMPLETED' }, { conversationId: NEED }, { boundNeedId: null }, { schemaVersion: 'NEED_FACT_V3' },
    { canSaveDraft: true }, { canSaveDraft: 'false' }, { missingRequired: [] }, { missingRequired: ['unknown'] },
    { facts: null }, { extra: 'private' }, { safety: 'UNKNOWN' }])('rejects incomplete/inconsistent review %j', async patch => {
    mockRpc.mockResolvedValue(ok({ ...review(), ...patch })); await expect(client.loadConversation(C)).rejects.toThrow();
  });
  it('preserves authoritative false canSaveDraft with all required fields confirmed', async () => {
    const values: Partial<Record<NeedFactV2Key, unknown>> = { 'need.price_mode': 'OFFERS', 'need.schedule_kind': 'FLEXIBLE',
      'need.people_needed': 1, 'need.task_country_code': 'RS', 'need.task_geography': { mode: 'REMOTE' } };
    const facts = REQUIRED_NEED_FACT_V2_KEYS.map((key, index) => ({ ...fact(key, values[key] ?? 'Tekst'),
      id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}` }));
    mockRpc.mockResolvedValue(ok(review(facts)));
    await expect(client.loadConversation(C)).resolves.toMatchObject({ review: { canSaveDraft: false, missingRequired: [] } });
  });
  it('keeps supported typed values, order, case and duplicates unchanged', async () => {
    const value = ['Vozač', 'VOZAČ', 'Vozač']; mockRpc.mockResolvedValue(ok(review([fact('need.required_skills', value)])));
    expect((await client.loadConversation(C))?.facts[0].value).toEqual(value);
  });
  it.each([{ id: 'bad' }, { key: 'need.unknown' }, { schemaVersion: 'LEGACY_TEXT_V1' }, { status: 'READY' },
    { source: 'PROVIDER' }, { valueType: 'INTEGER' }, { privacyClass: 'PRIVATE' }, { requiredForDraft: false },
    { material: 'true' }, { displayValue: '' }, { value: null }, { value: 'x'.repeat(141) }, { evidence: {} }, { extra: true }])('rejects a bad fact without silently filtering it %j', async patch => {
    mockRpc.mockResolvedValue(ok({ ...review([fact()]), facts: [{ ...fact(), ...patch }] }));
    await expect(client.loadConversation(C)).rejects.toThrow();
  });
  it('rejects duplicate fact identities and keys', async () => {
    for (const second of [fact('need.category'), { ...fact(), id: NEED }]) {
      mockRpc.mockResolvedValue(ok({ ...review([fact()]), facts: [fact(), second] })); await expect(client.loadConversation(C)).rejects.toThrow();
    }
  });
  it('keeps human-confirmed private points while redacting their presentation label', async () => {
    const value = { version: 1, binding: { taskCountryCode: 'RS', geography: { mode: 'STATIONARY', start: { city: 'Novi Sad' } }, exactAddress: null },
      points: [{ slot: 'start', latitudeE6: 45255000, longitudeE6: 19845000, origin: { kind: 'MANUAL_PIN' } }] };
    const privateFact = fact('need.resolved_location', value); privateFact.displayValue = 'Private provider metadata';
    mockRpc.mockResolvedValue(ok(review([privateFact])));
    expect((await client.loadConversation(C))?.facts[0]).toMatchObject({ value, displayValue: 'Potvrđene privatne tačke: 1', evidence: null });
    for (const patch of [{ status: 'INFERRED' }, { source: 'AI_INFERENCE' }, { evidence: 'provider detail' }]) {
      mockRpc.mockResolvedValue(ok({ ...review([privateFact]), facts: [{ ...privateFact, ...patch }] })); await expect(client.loadConversation(C)).rejects.toThrow();
    }
  });
});

describe('complete ordered messages and assistant safety', () => {
  it('keeps the last assistant safety over a later USER value', async () => {
    const rows = [{ ...message(), safety: 'BLOCK' }, { ...message(), id: FACT, role: 'USER', sequence_no: 2, safety: 'ALLOW' }];
    mockMessages.mockResolvedValue({ ...ok(rows), count: rows.length }); mockRpc.mockResolvedValue(ok({ ...review(), safety: 'BLOCK' }));
    await expect(client.loadConversation(C)).resolves.toMatchObject({ safety: 'BLOCK', messages: [
      { id: MESSAGE, fromAi: true, safety: 'BLOCK' }, { id: FACT, fromAi: false, safety: 'ALLOW' },
    ] });
  });
  it.each([null, {}, 0, [null]])('rejects malformed message collection %j', async data => {
    mockMessages.mockResolvedValue({ ...ok(data), count: 0 }); await expect(client.loadConversation(C)).rejects.toThrow();
  });
  it.each([{ account_id: NEED }, { conversation_id: NEED }, { id: 'bad' }, { role: 'SYSTEM' }, { body: '' },
    { body: 'x'.repeat(1501) }, { safety: 'UNKNOWN' }, { proposed_fact_ids: ['bad'] }, { sequence_no: '1' },
    { sequence_no: 0 }, { sequence_no: 1.5 }, { extra: 'detail' }])('rejects malformed row rather than dropping it %j', async patch => {
    mockMessages.mockResolvedValue({ ...ok([{ ...message(), ...patch }]), count: 1 }); await expect(client.loadConversation(C)).rejects.toThrow();
  });
  it.each([null, '1', 0, 2])('rejects truncated/unknown total count %j', async count => {
    mockMessages.mockResolvedValue({ ...ok([message()]), count }); await expect(client.loadConversation(C)).rejects.toThrow();
  });
  it('rejects duplicate IDs, unordered sequence and review/message safety mismatch', async () => {
    for (const rows of [[message(), { ...message(), sequence_no: 2 }], [message(), { ...message(), id: FACT }], [{ ...message(), safety: 'BLOCK' }]]) {
      mockMessages.mockResolvedValue({ ...ok(rows), count: rows.length }); await expect(client.loadConversation(C)).rejects.toThrow();
    }
  });
});

describe('bounded account-scoped reads', () => {
  it('refuses signed-out and invalid identity without dispatch', async () => {
    mockOwner = { user: null, accountRevision: 2 };
    await expect(client.loadConversation(C)).rejects.toThrow(); await expect(client.loadConversation('bad')).rejects.toThrow();
    expect(mockHeader).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
  });
  it('does not issue secondary reads after same-account reincarnation', async () => {
    const wait = deferred(); mockHeader.mockReturnValue(wait.promise); const pending = client.loadConversation(C);
    mockOwner = { ...mockOwner, accountRevision: 3 }; wait.resolve(ok(header()));
    await expect(pending).rejects.toThrow(); expect(mockMessages).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
  });
  it('rejects data returned after reincarnation during parallel reads', async () => {
    const wait = deferred(); mockRpc.mockReturnValue(wait.promise); const pending = client.loadConversation(C);
    await Promise.resolve(); await Promise.resolve(); mockOwner = { ...mockOwner, accountRevision: 3 }; wait.resolve(ok(review()));
    await expect(pending).rejects.toThrow();
  });
  it('does not start secondary reads after the header outlives its deadline', async () => {
    jest.useFakeTimers(); const wait = deferred(); mockHeader.mockReturnValue(wait.promise);
    const pending = client.loadConversation(C).catch(error => error); await jest.advanceTimersByTimeAsync(15001);
    expect(await pending).toBeInstanceOf(Error); wait.resolve(ok(header())); await jest.advanceTimersByTimeAsync(0);
    expect(mockOwner.accountRevision).toBe(1); expect(mockMessages).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each(['header', 'messages', 'review'])('does not expose raw %s backend details', async stage => {
    const response = { data: null, error: { message: 'secret provider detail', code: 'private' } };
    (stage === 'header' ? mockHeader : stage === 'messages' ? mockMessages : mockRpc).mockResolvedValue(response);
    const result = await client.loadConversation(C).catch(error => error);
    expect(result).toBeInstanceOf(Error); expect(result.message).not.toMatch(/secret|provider|private/);
  });
});
