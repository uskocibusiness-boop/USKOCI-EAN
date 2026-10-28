import { workerProfileClientService } from '../workerProfileClientService';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const P = '33333333-3333-4333-8333-333333333333';
let mockAccount: { user: { id: string } | null; accountRevision: number };
const mockAuth = jest.fn(), mockRead = jest.fn(), mockWrite = jest.fn();
const mockTrace: unknown[] = [];
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({
  auth: { getUser: () => mockAuth() },
  from: (table: string) => {
    mockTrace.push(['from', table]);
    const read = {
      eq: (key: string, value: unknown) => { mockTrace.push(['read.eq', key, value]); return read; },
      select: () => read,
      maybeSingle: () => mockRead(),
    };
    const write = {
      eq: (key: string, value: unknown) => { mockTrace.push(['write.eq', key, value]); return write; },
      select: () => write,
      then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => mockWrite().then(resolve, reject),
    };
    return { ...read, update: (patch: unknown) => { mockTrace.push(['update', patch]); return write; } };
  },
}) }));
const row = (skills: string[], extra = {}) => ({ id: P, account_id: A, kind: 'WORKER', skills, ...extra });
const response = (data: unknown) => ({ data, error: null });
const input = () => ({ accountId: A, accountRevision: 1, profileId: P, skill: 'Selidbe' });
const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
beforeEach(() => {
  jest.resetAllMocks(); mockTrace.length = 0;
  mockAccount = { user: { id: A }, accountRevision: 1 };
  mockAuth.mockResolvedValue(response({ user: { id: A } }));
  mockRead.mockResolvedValue(response(row(['Moleraj'])));
  mockWrite.mockResolvedValue(response([row(['Moleraj', 'Selidbe'])]));
});
afterEach(() => jest.useRealTimers());

it('appends to the fresh exact array with captured owner/profile/kind filters', async () => {
  const skills = [' Moleraj ', 'Moleraj', 'a,b', 'a"b', 'a\\b', 'line\nbreak', 'NULL', '{x}'];
  mockRead.mockResolvedValue(response(row(skills)));
  mockWrite.mockResolvedValue(response([row([...skills, 'Selidbe'])]));
  await expect(workerProfileClientService.addSkill(input(), () => true)).resolves.toEqual({ ok: true, podatak: null });
  expect(mockTrace).toContainEqual(['update', { skills: [...skills, 'Selidbe'] }]);
  expect(mockTrace).toContainEqual(['write.eq', 'skills', '{" Moleraj ","Moleraj","a,b","a\\"b","a\\\\b","line\nbreak","NULL","{x}"}']);
  for (const stage of ['read.eq', 'write.eq']) {
    expect(mockTrace).toContainEqual([stage, 'id', P]);
    expect(mockTrace).toContainEqual([stage, 'account_id', A]);
    expect(mockTrace).toContainEqual([stage, 'kind', 'WORKER']);
  }
});
it('merges a concurrent addition only after a confirmed zero-row comparison miss', async () => {
  mockRead.mockResolvedValueOnce(response(row(['Moleraj']))).mockResolvedValueOnce(response(row(['Moleraj', 'Čišćenje'])));
  mockWrite.mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([row(['Moleraj', 'Čišćenje', 'Selidbe'])]));
  await expect(workerProfileClientService.addSkill(input(), () => true)).resolves.toMatchObject({ ok: true });
  expect(mockTrace.filter(value => Array.isArray(value) && value[0] === 'update')).toEqual([
    ['update', { skills: ['Moleraj', 'Selidbe'] }], ['update', { skills: ['Moleraj', 'Čišćenje', 'Selidbe'] }],
  ]);
  expect(mockWrite).toHaveBeenCalledTimes(2); expect(mockRead).toHaveBeenCalledTimes(2);
});
it('stops after a second confirmed conflict', async () => {
  mockWrite.mockResolvedValue(response([]));
  await expect(workerProfileClientService.addSkill(input(), () => true)).resolves.toMatchObject({ ok: false, kod: 'PROFILE_SKILLS_CHANGED' });
  expect(mockRead).toHaveBeenCalledTimes(2); expect(mockWrite).toHaveBeenCalledTimes(2);
});
it('accepts a concurrently added equivalent skill without a second write', async () => {
  mockWrite.mockResolvedValueOnce(response([]));
  mockRead.mockResolvedValueOnce(response(row([]))).mockResolvedValueOnce(response(row([' selidbe '])));
  await expect(workerProfileClientService.addSkill(input(), () => true)).resolves.toMatchObject({ ok: true });
  expect(mockWrite).toHaveBeenCalledTimes(1);
});
it('does not rewrite or deduplicate a list that already contains the skill, even at the limit', async () => {
  const skills = [' SELIDBE ', ...Array.from({ length: 49 }, () => 'Moleraj')];
  mockRead.mockResolvedValue(response(row(skills)));
  await expect(workerProfileClientService.addSkill(input(), () => true)).resolves.toMatchObject({ ok: true });
  expect(mockWrite).not.toHaveBeenCalled();
});
it('refuses a 51st skill without dropping an existing item', async () => {
  mockRead.mockResolvedValue(response(row(Array.from({ length: 50 }, (_, i) => `Veština ${i}`))));
  await expect(workerProfileClientService.addSkill(input(), () => true)).resolves.toMatchObject({ ok: false, kod: 'V2_FACT_TYPE_INVALID' });
  expect(mockWrite).not.toHaveBeenCalled();
});
it.each([null, row(['Moleraj'], { account_id: B }), row(['Moleraj'], { id: B }), row(['Moleraj'], { kind: 'REQUESTER' }),
  row(['']), row(['bad\0term']), row(['Moleraj'], { skills: null })])('does not write for a missing, foreign or malformed profile: %p', async data => {
  mockRead.mockResolvedValue(response(data));
  await expect(workerProfileClientService.addSkill(input(), () => true)).resolves.toMatchObject({ ok: false });
  expect(mockWrite).not.toHaveBeenCalled();
});
it.each(['', '   ', 'bad\0term', 'x'.repeat(501)])('rejects an invalid new skill before Auth: %p', async skill => {
  await expect(workerProfileClientService.addSkill({ ...input(), skill }, () => true)).resolves.toMatchObject({ ok: false, kod: 'PROFILE_INPUT_INVALID' });
  expect(mockAuth).not.toHaveBeenCalled();
});
it('freezes input before awaiting Auth', async () => {
  const waiting = deferred(); mockAuth.mockReturnValueOnce(waiting.promise);
  const command = input(), request = workerProfileClientService.addSkill(command, () => true);
  command.skill = 'unexpected'; command.profileId = B; command.accountId = B; command.accountRevision = 7;
  waiting.resolve(response({ user: { id: A } }));
  await expect(request).resolves.toMatchObject({ ok: true });
  expect(mockTrace).toContainEqual(['update', { skills: ['Moleraj', 'Selidbe'] }]);
  expect(mockTrace).toContainEqual(['write.eq', 'id', P]);
});
it('does not begin an expired intent', async () => {
  await expect(workerProfileClientService.addSkill(input(), () => false)).resolves.toMatchObject({ ok: false, kod: 'PROFILE_SKILL_INTENT_EXPIRED' });
  expect(mockAuth).not.toHaveBeenCalled();
});
it.each(['auth', 'read', 'write'] as const)('fences an expired screen during %s without continuing/replaying', async stage => {
  const waiting = deferred(); let current = true;
  const target = stage === 'auth' ? mockAuth : stage === 'read' ? mockRead : mockWrite;
  target.mockReturnValueOnce(waiting.promise);
  const request = workerProfileClientService.addSkill(input(), () => current);
  await flush(); current = false;
  waiting.resolve(response(stage === 'auth' ? { user: { id: A } } : stage === 'read' ? row([]) : []));
  await expect(request).resolves.toMatchObject({ ok: false, kod: 'PROFILE_SKILL_INTENT_EXPIRED' });
  expect(mockWrite).toHaveBeenCalledTimes(stage === 'write' ? 1 : 0);
  expect(mockRead).toHaveBeenCalledTimes(stage === 'auth' ? 0 : 1);
});
it.each(['auth', 'read', 'write'] as const)('fences an A→B→A account generation change during %s', async stage => {
  const waiting = deferred(); const target = stage === 'auth' ? mockAuth : stage === 'read' ? mockRead : mockWrite;
  target.mockReturnValueOnce(waiting.promise);
  const request = workerProfileClientService.addSkill(input(), () => true);
  await flush(); mockAccount = { user: { id: B }, accountRevision: 2 }; mockAccount = { user: { id: A }, accountRevision: 3 };
  waiting.resolve(response(stage === 'auth' ? { user: { id: A } } : stage === 'read' ? row([]) : []));
  await expect(request).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(mockWrite).toHaveBeenCalledTimes(stage === 'write' ? 1 : 0);
});
it('rejects a foreign SDK user before reading or writing profiles', async () => {
  mockAuth.mockResolvedValue(response({ user: { id: B } }));
  await expect(workerProfileClientService.addSkill(input(), () => true)).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(mockRead).not.toHaveBeenCalled(); expect(mockWrite).not.toHaveBeenCalled();
});
it.each([
  {}, { data: [], error: false }, response(null), response([row(['wrong'])]), response([row(['Moleraj', 'Selidbe'], { id: B })]),
  response([row(['Moleraj', 'Selidbe']), row(['Moleraj', 'Selidbe'])]),
  { data: [], error: { code: '23514', message: 'private-token-and-address' } },
])('never treats a malformed/failed write as a conflict eligible for retry: %p', async receipt => {
  mockWrite.mockResolvedValue(receipt);
  const result = await workerProfileClientService.addSkill(input(), () => true);
  expect(result).toMatchObject({ ok: false }); expect(JSON.stringify(result)).not.toContain('private-token-and-address');
  expect(mockRead).toHaveBeenCalledTimes(1); expect(mockWrite).toHaveBeenCalledTimes(1);
});
it('never retries a timed-out write, including after its late zero-row response', async () => {
  jest.useFakeTimers(); const waiting = deferred(); mockWrite.mockReturnValueOnce(waiting.promise);
  const request = workerProfileClientService.addSkill(input(), () => true);
  await jest.advanceTimersByTimeAsync(15_001);
  await expect(request).resolves.toMatchObject({ ok: false, kod: 'PROFILE_UPDATE_FAILED' });
  waiting.resolve(response([])); await flush();
  expect(mockWrite).toHaveBeenCalledTimes(1); expect(mockRead).toHaveBeenCalledTimes(1);
});
it('shares the existing local profile-write latch', async () => {
  const waiting = deferred(); mockRead.mockReturnValueOnce(waiting.promise);
  const first = workerProfileClientService.addSkill(input(), () => true);
  await expect(workerProfileClientService.addSkill(input(), () => true)).resolves.toMatchObject({ ok: false, kod: 'PROFILE_BUSY' });
  await expect(workerProfileClientService.azurirajRadnikProfil({ ime: 'Ana' })).resolves.toMatchObject({ ok: false, kod: 'PROFILE_BUSY' });
  waiting.resolve(response(row(['Selidbe']))); await expect(first).resolves.toMatchObject({ ok: true });
});
