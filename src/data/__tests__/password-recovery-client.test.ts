import { createRecoverySession, type RecoveryDependencies } from '../passwordRecoveryClientService';
import { parseRecoveryCallback } from '../passwordRecoveryLink';
import { PasswordRecoveryError } from '../../contracts/passwordRecovery';
import { recoveryError } from '../passwordRecoveryErrors';

jest.mock('../supabaseClient', () => ({ createRecoveryTransport: jest.fn() }));
jest.mock('../../store/sesija', () => ({ sesijaSada: jest.fn() }));
const target = 'uskociapp://oporavak';
const link = `${target}#access_token=synthetic-access&refresh_token=synthetic-refresh&type=recovery&token_type=bearer`;
const user = { id: 'recovery-account', email: 'recovery@example.test' };
let scope: { user: { id: string } | null; accountRevision: number };
const auth = { setSession: jest.fn(), getUser: jest.fn(), updateUser: jest.fn() };
const dispose = jest.fn();
const transport = jest.fn(() => ({ auth, dispose }));
const deps: RecoveryDependencies = { account: () => scope, redirect: () => target, transport };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { resolve, promise };
};
beforeEach(() => {
  jest.clearAllMocks(); scope = { user: null, accountRevision: 0 };
  auth.setSession.mockResolvedValue({ data: { session: { user } }, error: null });
  auth.getUser.mockResolvedValue({ data: { user }, error: null });
  auth.updateUser.mockResolvedValue({ data: { user }, error: null });
});
afterEach(() => jest.useRealTimers());

it('parses only credentials from an exact implicit recovery callback', () => {
  expect(parseRecoveryCallback(link, target)).toEqual({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' });
});
it.each([
  link.replace('uskociapp:', 'https:'), link.replace('//oporavak', '//other'),
  link.replace('#', '/extra#'), link.replace('#', '?access_token=leak#'),
  link.replace('type=recovery', 'type=signup'), link.replace('type=recovery', 'type=magiclink'),
  link.replace('refresh_token=synthetic-refresh', 'refresh_token='),
  link.replace('synthetic-access', 'with%20space'), link + '&type=recovery',
  link + '&error=secret-provider-message', link + '&error_code=otp_expired',
  'uskociapp://user:password@oporavak#type=recovery', 'not a url', target,
])('rejects malformed, foreign, duplicate, non-recovery and expired callbacks without an Auth call: %s', value => {
  expect(() => parseRecoveryCallback(value, target)).toThrow(PasswordRecoveryError);
  expect(transport).not.toHaveBeenCalled();
});
it('bounds callback size without echoing credential-bearing input', () => {
  expect(() => parseRecoveryCallback(link + 'x'.repeat(25_000), target)).toThrow('Link je nevažeći');
});
it('verifies the server user and exposes no tokens or marketplace session', async () => {
  const session = createRecoverySession(deps);
  await expect(session.verify(link)).resolves.toEqual({ email: user.email });
  expect(auth.getUser).toHaveBeenCalledTimes(1);
  expect(scope).toEqual({ user: null, accountRevision: 0 });
  expect(auth.updateUser).not.toHaveBeenCalled(); session.dispose();
});
it('rejects a logged-in actor, missing configuration and a password write without verification', async () => {
  scope.user = { id: 'another-account' };
  await expect(createRecoverySession(deps).verify(link)).rejects.toMatchObject({ code: 'SIGNED_IN' });
  scope.user = null;
  await expect(createRecoverySession({ ...deps, redirect: () => null }).verify(link)).rejects.toMatchObject({ code: 'UNCONFIGURED' });
  await expect(createRecoverySession(deps).updatePassword('new-password')).rejects.toMatchObject({ code: 'INVALID_LINK' });
  expect(transport).not.toHaveBeenCalled();
});
it.each([null, { id: 'wrong-user', email: user.email }, { id: user.id }])('rejects an absent or mismatched server identity %p', async verified => {
  auth.getUser.mockResolvedValue({ data: { user: verified }, error: null });
  await expect(createRecoverySession(deps).verify(link)).rejects.toMatchObject({ code: 'INVALID_LINK' });
  expect(dispose).toHaveBeenCalledTimes(1); expect(auth.updateUser).not.toHaveBeenCalled();
});
it('rejects stale verification after sign-in and sign-out even when React has not rendered yet', async () => {
  const waiting = deferred<unknown>(); auth.getUser.mockReturnValue(waiting.promise);
  const session = createRecoverySession(deps); const pending = session.verify(link);
  await Promise.resolve(); await Promise.resolve();
  scope = { user: null, accountRevision: 2 }; waiting.resolve({ data: { user }, error: null });
  await expect(pending).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
  expect(auth.updateUser).not.toHaveBeenCalled();
});
it('does not reopen a disposed verification after a late server response', async () => {
  const waiting = deferred<unknown>(); auth.setSession.mockReturnValue(waiting.promise);
  const session = createRecoverySession(deps); const pending = session.verify(link); session.dispose();
  waiting.resolve({ data: { session: { user } }, error: null });
  await expect(pending).rejects.toMatchObject({ code: 'INVALID_LINK' });
  expect(auth.getUser).not.toHaveBeenCalled();
});
it('revalidates identity before the write and preserves password bytes', async () => {
  const session = createRecoverySession(deps); await session.verify(link);
  await session.updatePassword('  Nova čuvana Lozinka!  ');
  expect(auth.getUser).toHaveBeenCalledTimes(2);
  expect(auth.updateUser.mock.calls).toEqual([[{ password: '  Nova čuvana Lozinka!  ' }]]);
  expect(dispose).toHaveBeenCalledTimes(1);
  await expect(session.updatePassword('another-password')).rejects.toMatchObject({ code: 'INVALID_LINK' });
});
it('refuses concurrent password writes instead of replaying a provider mutation', async () => {
  const session = createRecoverySession(deps); await session.verify(link);
  const waiting = deferred<unknown>(); auth.updateUser.mockReturnValue(waiting.promise);
  const first = session.updatePassword('first-password');
  await expect(session.updatePassword('second-password')).rejects.toMatchObject({ code: 'BUSY' });
  waiting.resolve({ data: { user }, error: null }); await first;
  expect(auth.updateUser).toHaveBeenCalledTimes(1);
});
it('refuses a changed identity during the final server check before sending the password', async () => {
  const session = createRecoverySession(deps); await session.verify(link);
  auth.getUser.mockResolvedValue({ data: { user: { id: 'other' } }, error: null });
  await expect(session.updatePassword('new-password')).rejects.toMatchObject({ code: 'INVALID_LINK' });
  expect(auth.updateUser).not.toHaveBeenCalled();
});
it.each([['weak_password', 'WEAK_PASSWORD'], ['same_password', 'SAME_PASSWORD']])('retains a verified form after an explicit %s refusal', async (provider, code) => {
  const session = createRecoverySession(deps); await session.verify(link);
  auth.updateUser.mockResolvedValueOnce({ data: { user: null }, error: { code: provider, status: 422 } });
  await expect(session.updatePassword('new-password')).rejects.toMatchObject({ code });
  expect(dispose).not.toHaveBeenCalled();
  await expect(session.updatePassword('another-password')).resolves.toBeUndefined();
});
it('bounds a lost write response, closes the lease, and refuses blind retry', async () => {
  jest.useFakeTimers(); const session = createRecoverySession(deps); await session.verify(link);
  const waiting = deferred<unknown>(); auth.updateUser.mockReturnValue(waiting.promise);
  const result = expect(session.updatePassword('new-password')).rejects.toMatchObject({ code: 'UPDATE_UNKNOWN' });
  await jest.advanceTimersByTimeAsync(15_001); await result;
  expect(dispose).toHaveBeenCalled();
  await expect(session.updatePassword('new-password')).rejects.toMatchObject({ code: 'INVALID_LINK' });
  waiting.resolve({ data: { user }, error: null }); await Promise.resolve();
  expect(auth.updateUser).toHaveBeenCalledTimes(1);
});
it('times out verification without suggesting the password was changed', async () => {
  jest.useFakeTimers(); auth.setSession.mockReturnValue(new Promise(() => {}));
  const result = expect(createRecoverySession(deps).verify(link)).rejects.toMatchObject({ code: 'VERIFY_UNAVAILABLE' });
  await jest.advanceTimersByTimeAsync(15_001); await result;
  expect(dispose).toHaveBeenCalled(); expect(auth.updateUser).not.toHaveBeenCalled();
});
it('never exposes raw provider error text or credential URLs', () => {
  const message = 'sensitive-token=https://private.example';
  for (const stage of ['request', 'verify', 'update'] as const) {
    expect(recoveryError(new Error(message), stage).message).not.toContain(message);
  }
});

// Owner decision 2026-10-07: a restricted account's recovery is told so, not that its link expired. Real expiry and every
// other refusal keep "Link je nevažeći ili je istekao.".
describe('a restricted account is not an expired link', () => {
  const banned = { status: 403, code: 'user_banned', message: 'User is banned' };
  it.each(['request', 'verify', 'update'] as const)('the restricted code decides before any status at %s', stage => {
    expect(recoveryError(banned, stage)).toMatchObject({ code: 'RESTRICTED_ACCOUNT' });
    expect(recoveryError({ ...banned, status: 400, code: 'USER_BANNED' }, stage)).toMatchObject({ code: 'RESTRICTED_ACCOUNT' });
    expect(recoveryError(banned, stage).message).toBe('Pristup ovom nalogu je ograničen, pa oporavak lozinke trenutno nije moguć.');
    expect(recoveryError(banned, stage).message).not.toMatch(/istekao|User is banned|user_banned/);
  });
  it.each([
    [{ status: 403, code: 'otp_expired' }], [{ status: 401, code: 'session_expired' }], [{ status: 400, code: 'user_banned_x' }], [{ status: 404 }],
  ])('a real expiry or any other 4xx is still the invalid link: %j', error => {
    expect(recoveryError(error, 'verify')).toMatchObject({ code: 'INVALID_LINK', message: 'Link je nevažeći ili je istekao. Zatraži novi link.' });
  });
  it.each(['setSession', 'getUser'] as const)('a %s the provider refused as restricted ends the lease as restricted', async step => {
    if (step === 'setSession') auth.setSession.mockResolvedValue({ data: { session: null }, error: banned });
    else auth.getUser.mockResolvedValue({ data: { user: null }, error: banned });
    await expect(createRecoverySession(deps).verify(link)).rejects.toMatchObject({ code: 'RESTRICTED_ACCOUNT' });
    expect(dispose).toHaveBeenCalledTimes(1); expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it('a password write the provider refused as restricted closes the lease instead of keeping the form', async () => {
    const session = createRecoverySession(deps); await session.verify(link);
    auth.updateUser.mockResolvedValueOnce({ data: { user: null }, error: banned });
    await expect(session.updatePassword('new-password')).rejects.toMatchObject({ code: 'RESTRICTED_ACCOUNT' });
    expect(dispose).toHaveBeenCalledTimes(1);
    await expect(session.updatePassword('another-password')).rejects.toMatchObject({ code: 'INVALID_LINK' });
  });
});
