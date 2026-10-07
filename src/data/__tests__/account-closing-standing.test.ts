/**
 * Owner decision 2026-10-07 / audit: an account in its closing stage signs in and used to land on Početna, whose every read
 * the pre-request guard refuses with ACCOUNT_CLOSING. The root now asks, through the two EXISTING closure reads and no new
 * server contract, whether the account is closing. SOURCE evidence with a mocked RPC transport; the guard's refusal shape
 * (message ACCOUNT_CLOSING, errcode 42501) is the one in supabase/migrations/20260913045824_clean_v5_support_case_authority.sql.
 */
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockOwner }));
import { readAccountClosingStanding } from '../accountClosingStanding';

const A = '11111111-1111-4111-8111-111111111111', R = '22222222-2222-4222-8222-222222222222';
const G = '33333333-3333-4333-8333-333333333333', K = '44444444-4444-4444-8444-444444444444';
let mockOwner: { user: { id: string } | null; accountRevision: number } = { user: { id: A }, accountRevision: 1 };
const mockRpc = jest.fn();
const owner = { accountId: A, accountRevision: 1 };
const open = { accountId: A, request: null, revision: 0, restricted: false, canExecute: false, authoritative: true };
const guardRefusal = { data: null, error: { message: 'ACCOUNT_CLOSING', code: '42501', details: null, hint: null }, status: 403 };
const receipt = { accountId: A, requestId: R, generation: G, state: 'EXECUTING', policySha256: 'a'.repeat(64), clientRequestId: K,
  idempotentReplay: false, authoritative: true };
const executing = { accountId: A, requestId: R, generation: G, state: 'EXECUTING', policySha256: 'a'.repeat(64),
  adapterVersion: 'OWNER_AF_D22_EVENT_ERASURE_V1', ordinaryContentErased: false, completedSteps: 3, totalSteps: 8, exceptions: [], authoritative: true };
const found = (execution: unknown) => ({ data: { accountId: A, clientRequestId: K, found: true, receipt, execution, authoritative: true }, error: null });
const routes = (answers: Record<string, unknown>) => mockRpc.mockImplementation(async (name: string) => {
  if (!(name in answers)) throw new Error(`unexpected ${name}`);
  return answers[name];
});
const noSavedStart = jest.fn(async () => null as string | null);

beforeEach(() => { mockRpc.mockReset(); noSavedStart.mockClear(); mockOwner = { user: { id: A }, accountRevision: 1 }; });

it('an open account is not closing, and nothing else is read', async () => {
  routes({ rpc_get_account_closure: { data: open, error: null } });
  expect(await readAccountClosingStanding(owner, noSavedStart)).toEqual({ ok: true, podatak: { closing: false } });
  expect(mockRpc.mock.calls).toEqual([['rpc_get_account_closure', { p_expected_user_id: A }]]);
  expect(noSavedStart).not.toHaveBeenCalled();
});

it('the guard refusing the status read is the closing stage; without this device\'s start nothing about progress is guessed', async () => {
  routes({ rpc_get_account_closure: guardRefusal });
  expect(await readAccountClosingStanding(owner, noSavedStart)).toEqual({ ok: true, podatak: { closing: true, execution: null } });
  expect(noSavedStart).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

it('with this device\'s own start, the execution read the guard admits says how far the closing has got', async () => {
  routes({ rpc_get_account_closure: guardRefusal, rpc_read_account_closure_execution: found(executing) });
  const result = await readAccountClosingStanding(owner, async () => K);
  expect(result).toMatchObject({ ok: true, podatak: { closing: true, execution: { state: 'EXECUTING', completedSteps: 3, totalSteps: 8 } } });
  expect(mockRpc).toHaveBeenLastCalledWith('rpc_read_account_closure_execution', { p_expected_user_id: A, p_client_request_id: K });
});

it.each([
  ['the start is not found', { data: { accountId: A, clientRequestId: K, found: false, receipt: null, execution: null, authoritative: true }, error: null }],
  ['the execution read fails', { data: null, error: { message: 'offline' }, status: 0 }],
  ['the execution answer does not decode', found({ ...executing, completedSteps: 99 })],
])('still closing, with no progress, when %s', async (_label, answer) => {
  routes({ rpc_get_account_closure: guardRefusal, rpc_read_account_closure_execution: answer });
  expect(await readAccountClosingStanding(owner, async () => K)).toEqual({ ok: true, podatak: { closing: true, execution: null } });
});

it('a broken local journal is no start at all', async () => {
  routes({ rpc_get_account_closure: guardRefusal });
  expect(await readAccountClosingStanding(owner, async () => { throw new Error('CLOSURE_LOCAL_STATE_INVALID'); }))
    .toEqual({ ok: true, podatak: { closing: true, execution: null } });
});

it.each([
  ['no answer', { data: null, error: { message: '', code: '' }, status: 0 }],
  ['another refusal', { data: null, error: { message: 'AUTH_CONTEXT_CHANGED', code: '28000' }, status: 401 }],
  ['an unexpected text', { data: null, error: { message: 'PRIVATE_NARRATIVE ACCOUNT_CLOSING', code: '42501' }, status: 403 }],
  ['an answer that does not decode', { data: { ...open, restricted: true }, error: null }],
])('anything but the guard\'s own refusal says nothing about closing: %s', async (_label, answer) => {
  routes({ rpc_get_account_closure: answer });
  const result = await readAccountClosingStanding(owner, noSavedStart);
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain('PRIVATE_NARRATIVE');
  expect(noSavedStart).not.toHaveBeenCalled();
});

it('an account that changed while the read ran is not judged', async () => {
  let answer!: (value: unknown) => void;
  mockRpc.mockReturnValueOnce(new Promise(done => { answer = done; }));
  const pending = readAccountClosingStanding(owner, noSavedStart);
  mockOwner = { user: { id: A }, accountRevision: 2 };
  answer(guardRefusal);
  expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
