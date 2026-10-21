import { workerProfileClientService } from '../workerProfileClientService';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const P = '33333333-3333-4333-8333-333333333333';
let mockAccount: { user: { id: string } | null; accountRevision: number };
const mockAuth = jest.fn(), mockRead = jest.fn(), mockWrite = jest.fn(), mockActivate = jest.fn();
const mockTrace: unknown[] = [];
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({
  auth: { getUser: () => mockAuth() },
  rpc: (...args: unknown[]) => mockActivate(...args),
  from: (table: string) => {
    mockTrace.push(['from', table]);
    const query = {
      eq: (column: string, value: unknown) => { mockTrace.push(['eq', column, value]); return query; },
      select: (_columns: string) => query,
      maybeSingle: () => mockRead(),
      single: () => mockRead(),
      then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => mockRead().then(resolve, reject),
    };
    const write = {
      eq: (column: string, value: unknown) => { mockTrace.push(['write.eq', column, value]); return write; },
      select: (_columns: string) => write,
      maybeSingle: () => mockWrite(), single: () => mockWrite(),
      then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => mockWrite().then(resolve, reject),
    };
    return { ...query,
      insert: (payload: unknown) => { mockTrace.push(['insert', payload]); return write; },
      update: (payload: unknown) => { mockTrace.push(['update', payload]); return write; },
    };
  },
}) }));
const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
beforeEach(() => {
  jest.clearAllMocks(); mockTrace.length = 0; mockAccount = { user: { id: A }, accountRevision: 1 };
  mockAuth.mockResolvedValue({ data: { user: { id: A } }, error: null });
  mockRead.mockResolvedValue({ data: { id: P, account_id: A, kind: 'WORKER' }, error: null });
  mockWrite.mockResolvedValue({ data: { id: P, account_id: A, kind: 'WORKER' }, error: null });
  mockActivate.mockResolvedValue({ data: null, error: null });
});
afterEach(() => jest.useRealTimers());

it.each(['vestine', 'licence'] as const)('rejects empty %s items before a profile mutation', async field => {
  const result = await workerProfileClientService.azurirajRadnikProfil({ [field]: [''] });
  expect(result).toMatchObject({ ok: false, kod: 'PROFILE_CAPABILITY_INPUT_INVALID' });
  expect(mockTrace.some(row => Array.isArray(row) && ['insert','update'].includes(row[0]))).toBe(false);
});
it.each(['alati', 'vozila'] as const)('rejects retired %s writes before any request', async field => {
  const result = await workerProfileClientService.azurirajRadnikProfil({ [field]: ['Legacy value'] });
  expect(result).toMatchObject({ok:false,kod:'WORKER_EQUIPMENT_RETIRED'});
  expect(mockTrace).toHaveLength(0);expect(mockAuth).not.toHaveBeenCalled();
});
it('never continues a stale read into a write or activation after A→B→A', async () => {
  const waiting = deferred(); mockRead.mockReturnValueOnce(waiting.promise);
  const request = workerProfileClientService.azurirajRadnikProfil({ vestine: ['selidbe'], zavrsi: true });
  await Promise.resolve(); await Promise.resolve();
  mockAccount = { user: { id: B }, accountRevision: 2 };
  mockAccount = { user: { id: A }, accountRevision: 3 };
  waiting.resolve({ data: { id: P, account_id: A, kind: 'WORKER' }, error: null });
  await expect(request).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(mockWrite).not.toHaveBeenCalled(); expect(mockActivate).not.toHaveBeenCalled();
});
it('rejects a stale SDK user without touching the profile table', async () => {
  mockAuth.mockResolvedValue({ data: { user: { id: B } }, error: null });
  await expect(workerProfileClientService.azurirajRadnikProfil({ ime: 'Ana' })).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(mockTrace).toHaveLength(0);
});
it('does not claim a successful update from an empty RLS result', async () => {
  mockWrite.mockResolvedValue({ data: null, error: null });
  await expect(workerProfileClientService.azurirajRadnikProfil({ ime: 'Ana', zavrsi: true })).resolves.toMatchObject({ ok: false });
  expect(mockActivate).not.toHaveBeenCalled();
});
it('sanitizes unexpected server errors without exposing backend messages', async () => {
  mockWrite.mockResolvedValue({ data: null, error: { code: '23514', message: 'private-token-and-address' } });
  const result = await workerProfileClientService.azurirajRadnikProfil({ ime: 'Ana' });
  expect(result).toMatchObject({ ok: false, kod: 'PROFILE_UPDATE_FAILED' });
  expect(JSON.stringify(result)).not.toContain('private-token-and-address');
});
it('bounds an unanswered read and never starts a delayed mutation', async () => {
  jest.useFakeTimers(); const waiting = deferred(); mockRead.mockReturnValueOnce(waiting.promise);
  const request = workerProfileClientService.azurirajRadnikProfil({ ime: 'Ana', zavrsi: true });
  await jest.advanceTimersByTimeAsync(15_001);
  await expect(request).resolves.toMatchObject({ ok: false });
  waiting.resolve({ data: { id: P, account_id: A, kind: 'WORKER' }, error: null });
  await Promise.resolve(); expect(mockWrite).not.toHaveBeenCalled(); expect(mockActivate).not.toHaveBeenCalled();
});

it('single-flights a profile command without repeating insert/update/activation', async () => {
  const waiting=deferred();mockRead.mockReturnValueOnce(waiting.promise);
  const first=workerProfileClientService.azurirajRadnikProfil({ime:'Ana',zavrsi:true});
  await expect(workerProfileClientService.azurirajRadnikProfil({ime:'Ana',zavrsi:true})).resolves.toMatchObject({ok:false,kod:'PROFILE_BUSY'});
  waiting.resolve({data:{id:P,account_id:A,kind:'WORKER'},error:null});
  await expect(first).resolves.toMatchObject({ok:true});expect(mockActivate).toHaveBeenCalledTimes(1);
});
it('captures resource values before the request awaits the server', async () => {
  const waiting=deferred();mockRead.mockReturnValueOnce(waiting.promise);
  const terms=[' selidbe '];const request=workerProfileClientService.azurirajRadnikProfil({vestine:terms});
  terms.push('unconfirmed');waiting.resolve({data:{id:P,account_id:A,kind:'WORKER'},error:null});await request;
  expect(mockTrace).toContainEqual(['update',{skills:['selidbe']}]);
});
it('writes optional self-declared licences to the existing licenses column, without verification fields', async () => {
  await expect(workerProfileClientService.azurirajRadnikProfil({licence:[' Category B ']})).resolves.toMatchObject({ok:true});
  expect(mockTrace).toContainEqual(['update',{licenses:['Category B']}]);
});
it('never invokes Auth for a signed-out caller', async () => {
  mockAccount={user:null,accountRevision:2};
  await expect(workerProfileClientService.azurirajRadnikProfil({ime:'Ana'})).resolves.toMatchObject({ok:false,kod:'AUTH_REQUIRED'});
  expect(mockAuth).not.toHaveBeenCalled();
});
it.each([0,15,201,1.5,NaN,Infinity])('refuses generic radius writes independently of numeric validity: %p', async value => {
  await expect(workerProfileClientService.azurirajRadnikProfil({radijusKm:value})).resolves.toMatchObject({ok:false,kod:'PROFILE_LOCATION_REQUIRES_REVIEW'});
  expect(mockWrite).not.toHaveBeenCalled();
});
it.each(['read','write'] as const)('rejects foreign-account data in the %s receipt', async stage => {
  const target=stage==='read'?mockRead:mockWrite;target.mockResolvedValue({data:{id:P,account_id:B,kind:'WORKER'},error:null});
  await expect(workerProfileClientService.azurirajRadnikProfil({ime:'Ana',zavrsi:true})).resolves.toMatchObject({ok:false,kod:'PROFILE_INVALID_RESPONSE'});
  expect(mockActivate).not.toHaveBeenCalled();
});
it('does not activate after a write response arrives for an old account', async () => {
  const waiting=deferred();mockWrite.mockReturnValueOnce(waiting.promise);
  const request=workerProfileClientService.azurirajRadnikProfil({ime:'Ana',zavrsi:true});
  for(let i=0;i<12;i++)await Promise.resolve();
  mockAccount={user:{id:B},accountRevision:2};waiting.resolve({data:{id:P,account_id:A,kind:'WORKER'},error:null});
  await expect(request).resolves.toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});expect(mockActivate).not.toHaveBeenCalled();
});
it('retains same-account token-refresh compatibility', async () => {
  const waiting=deferred();mockRead.mockReturnValueOnce(waiting.promise);
  const request=workerProfileClientService.azurirajRadnikProfil({ime:'Ana'});
  mockAccount={user:{id:A},accountRevision:1};waiting.resolve({data:{id:P,account_id:A,kind:'WORKER'},error:null});
  await expect(request).resolves.toMatchObject({ok:true});
});
it.each([{}, {data:{id:P,account_id:A,kind:'WORKER'},error:false}, {data:{id:P,account_id:A,kind:'WORKER'}}])('rejects a malformed transport envelope: %p', async response => {
  mockWrite.mockResolvedValue(response);
  await expect(workerProfileClientService.azurirajRadnikProfil({ime:'Ana',zavrsi:true})).resolves.toMatchObject({ok:false});
  expect(mockActivate).not.toHaveBeenCalled();
});
it('does not continue to activation after a lost write response', async () => {
  jest.useFakeTimers();const waiting=deferred();mockWrite.mockReturnValueOnce(waiting.promise);
  const request=workerProfileClientService.azurirajRadnikProfil({ime:'Ana',zavrsi:true});
  await jest.advanceTimersByTimeAsync(15_001);
  await expect(request).resolves.toMatchObject({ok:false,kod:'PROFILE_UPDATE_FAILED'});
  waiting.resolve({data:{id:P,account_id:A,kind:'WORKER'},error:null});await Promise.resolve();
  expect(mockActivate).not.toHaveBeenCalled();
});
