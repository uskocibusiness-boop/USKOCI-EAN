import { createPasswordChange, NEW_PASSWORD_MIN, passwordChangeMessages, type PasswordChangeFailure } from '../passwordChangeClientService';

/**
 * "Promeni lozinku" for a signed-in person (R22, UI/UX pass 2026-10-08): the current password is proved and the new one written on a
 * TRANSIENT Auth client, once, with a sentence of ours for every refusal. Disposable doubles only: no network, no DEV, no real account;
 * the passwords below are made-up strings that exist only in this file.
 */
jest.mock('../supabaseClient', () => ({ createRecoveryTransport: jest.fn() }));
jest.mock('../../store/sesija', () => ({ sesijaSada: jest.fn() }));

const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const CURRENT = 'test-trenutna-1', NEXT = 'test-nova-2';
let account: { user: { id: string; email?: string | null } | null; accountRevision: number };
const signIn = jest.fn(), update = jest.fn(), dispose = jest.fn(), makeTransport = jest.fn();
const service = (deadlineMs = 50) => createPasswordChange({ account: () => account, transport: makeTransport, deadlineMs });
const signedIn = (id = A) => ({ data: { user: { id } }, error: null });
const refusal = (error: unknown) => ({ data: { user: null }, error });

beforeEach(() => {
  signIn.mockReset(); update.mockReset(); dispose.mockReset(); makeTransport.mockReset();
  account = { user: { id: A, email: ' ana@example.rs ' }, accountRevision: 1 };
  makeTransport.mockReturnValue({ auth: { signInWithPassword: signIn, updateUser: update }, dispose });
  signIn.mockResolvedValue(signedIn()); update.mockResolvedValue(signedIn());
});

describe('a change that works', () => {
  it('proves the current password for the signed-in account\'s email, then writes the new one once, and ends the transient client', async () => {
    const result = await service().change(CURRENT, NEXT);
    expect(result).toEqual({ ok: true });
    expect(signIn.mock.calls).toEqual([[{ email: 'ana@example.rs', password: CURRENT }]]);
    expect(update.mock.calls).toEqual([[{ password: NEXT }]]);
    expect(signIn.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0]);
    expect(makeTransport).toHaveBeenCalledTimes(1); expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps no password in what it returns, whatever the provider said', async () => {
    const done = await service().change(CURRENT, NEXT);
    signIn.mockResolvedValue(refusal({ status: 400, code: 'invalid_credentials', message: `bad ${CURRENT} ${NEXT}` }));
    const refused = await service().change(CURRENT, NEXT);
    for (const result of [done, refused]) expect(JSON.stringify(result)).not.toMatch(new RegExp(`${CURRENT}|${NEXT}`));
  });
});

describe('what it refuses before it asks anything', () => {
  it.each([
    ['nobody is signed in', null], ['the account has no email', { id: A, email: null }], ['the email is blank', { id: A, email: '   ' }],
  ])('says there is no account when %s, and creates no client', async (_name, user) => {
    account = { user, accountRevision: 1 };
    expect(await service().change(CURRENT, NEXT)).toEqual({ ok: false, code: 'NO_ACCOUNT' });
    expect(makeTransport).not.toHaveBeenCalled();
  });

  it('says a short new password is weak, and the same password is the same', async () => {
    expect(await service().change(CURRENT, 'x'.repeat(NEW_PASSWORD_MIN - 1))).toEqual({ ok: false, code: 'WEAK_PASSWORD' });
    expect(await service().change(CURRENT, CURRENT)).toEqual({ ok: false, code: 'SAME_PASSWORD' });
    expect(makeTransport).not.toHaveBeenCalled(); expect(signIn).not.toHaveBeenCalled();
  });

  it('says it is unavailable when the transient client cannot be made, and writes nothing', async () => {
    makeTransport.mockImplementation(() => { throw new Error('SUPABASE_NIJE_KONFIGURISAN'); });
    expect(await service().change(CURRENT, NEXT)).toEqual({ ok: false, code: 'UNAVAILABLE' });
    expect(signIn).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
});

describe('the proof of the current password', () => {
  it.each([
    ['a 400', { status: 400, code: 'invalid_credentials' }, 'WRONG_CURRENT'], ['the code alone', { code: 'invalid_credentials' }, 'WRONG_CURRENT'],
    ['a rate limit by status', { status: 429 }, 'RATE_LIMITED'], ['a rate limit by code', { code: 'over_request_rate_limit' }, 'RATE_LIMITED'],
    ['a server error', { status: 503 }, 'UNAVAILABLE'], ['an error with no shape', 'boom', 'UNAVAILABLE'],
  ] as const)('maps %s to %s and never writes', async (_name, error, code) => {
    signIn.mockResolvedValue(refusal(error));
    expect(await service().change(CURRENT, NEXT)).toEqual({ ok: false, code });
    expect(update).not.toHaveBeenCalled(); expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('says it is unavailable when the read is thrown or never answers, and writes nothing', async () => {
    signIn.mockRejectedValue(new Error('network'));
    expect(await service().change(CURRENT, NEXT)).toEqual({ ok: false, code: 'UNAVAILABLE' });
    signIn.mockReturnValue(new Promise(() => undefined));
    expect(await service(20).change(CURRENT, NEXT)).toEqual({ ok: false, code: 'UNAVAILABLE' });
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a proof that is for another account than the signed-in one', async () => {
    signIn.mockResolvedValue(signedIn(B));
    expect(await service().change(CURRENT, NEXT)).toEqual({ ok: false, code: 'UNAVAILABLE' });
    expect(update).not.toHaveBeenCalled();
  });

  it('drops the whole change when the account moved on while the proof was read', async () => {
    signIn.mockImplementation(async () => { account = { user: { id: B, email: 'b@example.rs' }, accountRevision: 2 }; return signedIn(); });
    expect(await service().change(CURRENT, NEXT)).toEqual({ ok: false, code: 'NO_ACCOUNT' });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('the write', () => {
  it.each([
    ['the provider calls it weak', { code: 'weak_password', status: 422 }, 'WEAK_PASSWORD'], ['the provider calls it the same', { code: 'same_password', status: 422 }, 'SAME_PASSWORD'],
    ['a rate limit', { status: 429 }, 'RATE_LIMITED'], ['another refusal of the request', { status: 422, code: 'other' }, 'UNAVAILABLE'],
    ['a server error, whose outcome nobody knows', { status: 500 }, 'UNKNOWN_OUTCOME'], ['an error with no status', { message: 'x' }, 'UNKNOWN_OUTCOME'],
  ] as const)('maps %s to %s', async (_name, error, code) => {
    update.mockResolvedValue(refusal(error));
    expect(await service().change(CURRENT, NEXT)).toEqual({ ok: false, code });
    expect(update).toHaveBeenCalledTimes(1); expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('says "we do not know" for a write that was thrown or never answered, never a failure and never a success, and does not send it again', async () => {
    update.mockRejectedValue(new Error('connection lost'));
    expect(await service().change(CURRENT, NEXT)).toEqual({ ok: false, code: 'UNKNOWN_OUTCOME' });
    update.mockReset(); update.mockReturnValue(new Promise(() => undefined));
    expect(await service(20).change(CURRENT, NEXT)).toEqual({ ok: false, code: 'UNKNOWN_OUTCOME' });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('says "we do not know" when the answer names another account or none, or comes after the account moved on', async () => {
    update.mockResolvedValue(signedIn(B));
    expect(await service().change(CURRENT, NEXT)).toEqual({ ok: false, code: 'UNKNOWN_OUTCOME' });
    update.mockResolvedValue({ data: { user: null }, error: null });
    expect(await service().change(CURRENT, NEXT)).toEqual({ ok: false, code: 'UNKNOWN_OUTCOME' });
    update.mockImplementation(async () => { account = { user: { id: B, email: 'b@example.rs' }, accountRevision: 2 }; return signedIn(); });
    expect(await service().change(CURRENT, NEXT)).toEqual({ ok: false, code: 'UNKNOWN_OUTCOME' });
  });

  it('survives a transient client that cannot be ended', async () => {
    dispose.mockImplementation(() => { throw new Error('already gone'); });
    expect(await service().change(CURRENT, NEXT)).toEqual({ ok: true });
  });
});

describe('the sentences', () => {
  const CODES = Object.keys(passwordChangeMessages) as PasswordChangeFailure[];

  it('has one sentence of the app\'s own for every refusal, and none carries a password or the provider\'s text', () => {
    expect(CODES.sort()).toEqual(['NO_ACCOUNT', 'RATE_LIMITED', 'SAME_PASSWORD', 'UNAVAILABLE', 'UNKNOWN_OUTCOME', 'WEAK_PASSWORD', 'WRONG_CURRENT']);
    for (const code of CODES) {
      expect([code, passwordChangeMessages[code].length > 10]).toEqual([code, true]);
      expect(passwordChangeMessages[code]).not.toMatch(/supabase|gotrue|auth\b|invalid_|error|status|http/i);
    }
  });

  it('says a lost answer as not knowing, and tells what to do, in the words that fit both outcomes', () => {
    expect(passwordChangeMessages.UNKNOWN_OUTCOME).toMatch(/^Ne znamo da li je lozinka promenjena\./);
    expect(passwordChangeMessages.UNKNOWN_OUTCOME).toContain('novom lozinkom'); expect(passwordChangeMessages.UNKNOWN_OUTCOME).toContain('starom');
    expect(passwordChangeMessages.UNAVAILABLE).toContain('nije promenjena');
  });
});
