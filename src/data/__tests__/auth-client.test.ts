import { authClientService } from '../authClientService';
const mockRevokePush = jest.fn();
jest.mock('../pushDeviceClientService', () => ({ revokePushBeforeLogout: (scope: unknown) => mockRevokePush(scope) }));

const mockAuth = {
  signInWithPassword: jest.fn(), signUp: jest.fn(), resend: jest.fn(), signInWithOtp: jest.fn(),
  verifyOtp: jest.fn(), resetPasswordForEmail: jest.fn(), getSession: jest.fn(), signOut: jest.fn(),
};
let mockCurrent: { user: { id: string } | null; accountRevision: number } = { user: { id: 'account-a' }, accountRevision: 1 };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ auth: mockAuth }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockCurrent }));

const actor = { accountId: 'account-a', accountRevision: 1 };
beforeEach(() => {
  jest.resetAllMocks();
  mockRevokePush.mockResolvedValue(true);
  process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL = 'uskociapp://oporavak';
  mockCurrent = { user: { id: 'account-a' }, accountRevision: 1 };
  for (const method of Object.values(mockAuth)) method.mockResolvedValue({ error: null });
  mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'account-a' } } }, error: null });
});

describe('central Auth client boundary', () => {
  it('preserves password bytes and the existing email/password sign-in payload', async () => {
    const command = { email: 'ana@example.test', password: '  čuvaj Lozinku!  ' };
    await expect(authClientService.signInWithPassword(command)).resolves.toBeUndefined();
    expect(mockAuth.signInWithPassword.mock.calls).toEqual([[command]]);
  });

  it.each([null, { access_token: 'never-projected', user: { id: 'account-a' } }])(
    'preserves signup metadata and projects only the presence of its session', async session => {
      mockAuth.signUp.mockResolvedValue({ data: { session, user: { id: 'account-a' } }, error: null });
      const result = await authClientService.signUp({ email: 'ana@example.test', password: 'password',
        firstName: 'Ana', lastName: 'Petrović', city: 'Novi Sad' });
      expect(mockAuth.signUp.mock.calls).toEqual([[{
        email: 'ana@example.test', password: 'password',
        options: { emailRedirectTo: 'uskociapp://auth?form=login',
          data: { first_name: 'Ana', last_name: 'Petrović', full_name: 'Ana Petrović', city: 'Novi Sad' } },
      }]]);
      expect(result).toEqual({ hasSession: !!session });
    },
  );

  it('supplies the trigger display name from explicit Unicode names, never from email', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await authClientService.signUp({ email: 'private-prefix@example.test', password: '  untouched  ',
      firstName: '  Đorđe ', lastName: ' Ćurčić  ', city: 'Žabalj' });
    expect(mockAuth.signUp.mock.calls[0][0]).toEqual({
      email: 'private-prefix@example.test', password: '  untouched  ', options: {
        emailRedirectTo: 'uskociapp://auth?form=login', data: {
          first_name: '  Đorđe ', last_name: ' Ćurčić  ', full_name: 'Đorđe Ćurčić', city: 'Žabalj',
        },
      },
    });
  });

  it('omits optional city metadata when signup has no city input, preserving the trigger default', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await authClientService.signUp({ email: 'ana@example.test', password: 'password', firstName: 'Ana', lastName: 'Petrović' });
    expect(mockAuth.signUp.mock.calls[0][0].options.data).toEqual({
      first_name: 'Ana', last_name: 'Petrović', full_name: 'Ana Petrović',
    });
  });

  it('binds signup and signup-confirmation resend to the same stable native callback', async () => {
    mockCurrent = { user: null, accountRevision: 0 };
    mockAuth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'account-a' } }, error: null });
    await authClientService.signUp({ email: 'ana@example.test', password: 'password', firstName: 'Ana', lastName: 'P', city: 'Novi Sad' });
    await authClientService.resendSignupConfirmation(' ana@example.test ');
    expect(mockAuth.signUp.mock.calls[0][0].options.emailRedirectTo).toBe('uskociapp://auth?form=login');
    expect(mockAuth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'ana@example.test',
      options: { emailRedirectTo: 'uskociapp://auth?form=login' } });
  });

  it('does not resend signup confirmation from a signed-in or changed account', async () => {
    await expect(authClientService.resendSignupConfirmation('ana@example.test')).rejects.toThrow('neprijavljenom');
    expect(mockAuth.resend).not.toHaveBeenCalled();
    mockCurrent = { user: null, accountRevision: 0 };
    let resolve!: (value: unknown) => void;
    mockAuth.resend.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const pending = authClientService.resendSignupConfirmation('ana@example.test');
    mockCurrent = { user: null, accountRevision: 2 };
    resolve({ error: null });
    await expect(pending).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
  });

  it('keeps account-change precedence when a stale resend rejects', async () => {
    mockCurrent = { user: null, accountRevision: 0 };
    let reject!: (reason: unknown) => void;
    mockAuth.resend.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    const pending = authClientService.resendSignupConfirmation('ana@example.test');
    mockCurrent = { user: { id: 'another-account' }, accountRevision: 1 };
    reject(new Error('provider secret https://private/token?secret'));
    await expect(pending).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
  });

  it('keeps existing phone OTP options and explicitly verifies an sms token', async () => {
    await authClientService.sendPhoneOtp({ phone: '+381601234567' });
    await authClientService.verifyPhoneOtp({ phone: '+381601234567', token: '012345' });
    expect(mockAuth.signInWithOtp.mock.calls).toEqual([[{ phone: '+381601234567' }]]);
    expect(mockAuth.verifyOtp.mock.calls).toEqual([[{ phone: '+381601234567', token: '012345', type: 'sms' }]]);
  });

  it('binds the signed-out recovery request to the exact configured callback', async () => {
    mockCurrent = { user: null, accountRevision: 0 };
    await authClientService.requestPasswordRecovery(' ana@example.test ');
    expect(mockAuth.resetPasswordForEmail.mock.calls).toEqual([['ana@example.test', { redirectTo: 'uskociapp://oporavak' }]]);
  });

  it('keeps recovery unavailable without a configured redirect and never sends a fallback link', async () => {
    mockCurrent = { user: null, accountRevision: 0 };
    delete process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL;
    await expect(authClientService.requestPasswordRecovery('ana@example.test')).rejects.toMatchObject({ code: 'UNCONFIGURED' });
    expect(mockAuth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('refuses a recovery request from a signed-in account', async () => {
    await expect(authClientService.requestPasswordRecovery('ana@example.test')).rejects.toMatchObject({ code: 'SIGNED_IN' });
    expect(mockAuth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('sanitizes provider failures without exposing their URL, tokens or internal message', async () => {
    mockCurrent = { user: null, accountRevision: 0 };
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: new Error('https://private/token?secret') });
    await expect(authClientService.requestPasswordRecovery('ana@example.test')).rejects.toMatchObject({ code: 'REQUEST_UNCONFIRMED' });
  });

  it('validates the email locally before asking the provider', async () => {
    mockCurrent = { user: null, accountRevision: 0 };
    await expect(authClientService.requestPasswordRecovery('not an email')).rejects.toMatchObject({ code: 'INVALID_EMAIL' });
    expect(mockAuth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it.each([
    // EX-07 S02: a rejection the app does not recognise (code 'provider_internal') is an unexpected failure, no longer
    // reported as wrong credentials; 'Prijava nije uspela.' is now only what invalid_credentials says (auth-failure-classes).
    ['signInWithPassword', 'Prijava trenutno nije dostupna.'],
    ['signUp', 'Registracija trenutno nije uspela.'],
    ['signInWithOtp', 'Kod trenutno nije moguće poslati.'],
    ['verifyOtp', 'Kod nije potvrđen.'],
  ] as const)(
    'sanitizes the %s SDK/provider error before presentation while keeping bounded operation-specific copy', async (method, expected) => {
      const error = { message: 'Existing Auth message https://private/token?secret', status: 400, code: 'provider_internal' };
      mockAuth[method].mockResolvedValue({ data: null, error });
      const commands = {
        signInWithPassword: () => authClientService.signInWithPassword({ email: 'a', password: 'b' }),
        signUp: () => authClientService.signUp({ email: 'a', password: 'b', firstName: 'c', lastName: 'd', city: 'e' }),
        signInWithOtp: () => authClientService.sendPhoneOtp({ phone: 'a' }),
        verifyOtp: () => authClientService.verifyPhoneOtp({ phone: 'a', token: 'b' }),
      };
      await expect(commands[method]()).rejects.toThrow(expected);
      try { await commands[method](); } catch (sanitized) {
        expect((sanitized as Error).message).not.toContain('Existing Auth message');
        expect((sanitized as Error).message).not.toContain('private/token');
      }
    },
  );

  it.each([
    ['signUp', 'Registracija trenutno nije uspela.'],
    ['resend', 'Novu potvrdu trenutno nije moguće zatražiti.'],
    ['signInWithOtp', 'Kod trenutno nije moguće poslati.'],
    ['verifyOtp', 'Kod nije potvrđen.'],
  ] as const)('sanitizes rejected %s SDK calls without exposing provider text', async (method, expected) => {
    mockCurrent = { user: null, accountRevision: 0 };
    mockAuth[method].mockRejectedValueOnce(new Error('provider secret https://private/token?secret'));
    const commands = {
      signUp: () => authClientService.signUp({ email: 'a@example.test', password: 'password', firstName: 'A', lastName: 'B', city: 'Novi Sad' }),
      resend: () => authClientService.resendSignupConfirmation('a@example.test'),
      signInWithOtp: () => authClientService.sendPhoneOtp({ phone: '+381601234567' }),
      verifyOtp: () => authClientService.verifyPhoneOtp({ phone: '+381601234567', token: '012345' }),
    };
    await expect(commands[method]()).rejects.toThrow(expected);
  });

  it('logs out only the current account with the existing local scope', async () => {
    await expect(authClientService.signOutLocal(actor)).resolves.toBeUndefined();
    expect(mockAuth.signOut.mock.calls).toEqual([[{ scope: 'local' }]]);
    expect(mockRevokePush).toHaveBeenCalledWith(actor);
    expect(mockRevokePush.mock.invocationCallOrder[0]).toBeLessThan(mockAuth.signOut.mock.invocationCallOrder[0]);
    expect(mockCurrent).toEqual({ user: { id: 'account-a' }, accountRevision: 1 });
  });

  it('continues Auth logout after an unconfirmed bounded push revoke', async () => {
    mockRevokePush.mockResolvedValue(false);
    await expect(authClientService.signOutLocal(actor)).resolves.toBeUndefined();
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });

  it('a late push revoke completion cannot log out a different account incarnation', async () => {
    let done!: (value: boolean) => void;
    mockRevokePush.mockImplementation(() => new Promise(resolve => { done = resolve; }));
    const pending = authClientService.signOutLocal(actor);
    await Promise.resolve();
    mockCurrent = { user: { id: 'account-a' }, accountRevision: 3 };
    done(true);
    await expect(pending).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('rejects a stale actor before starting any Auth read or logout', async () => {
    mockCurrent = { user: { id: 'account-a' }, accountRevision: 3 };
    await expect(authClientService.signOutLocal(actor)).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
    expect(mockAuth.getSession).not.toHaveBeenCalled();
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('rejects batched A→B→A while its local session read is deferred', async () => {
    let resolve!: (value: unknown) => void;
    mockAuth.getSession.mockReturnValue(new Promise(done => { resolve = done; }));
    const command = authClientService.signOutLocal(actor);
    mockCurrent = { user: { id: 'account-b' }, accountRevision: 2 };
    mockCurrent = { user: { id: 'account-a' }, accountRevision: 3 };
    resolve({ data: { session: { user: { id: 'account-a' } } }, error: null });
    await expect(command).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('rejects an SDK session belonging to a different account even before the runtime catches up', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'account-b' } } }, error: null });
    await expect(authClientService.signOutLocal(actor)).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('does not claim logout after a failed session read and keeps SDK logout failure retryable', async () => {
    const error = new Error('Auth unavailable');
    mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error });
    await expect(authClientService.signOutLocal(actor)).rejects.toBe(error);
    expect(mockAuth.signOut).not.toHaveBeenCalled();
    mockAuth.signOut.mockResolvedValueOnce({ error });
    await expect(authClientService.signOutLocal(actor)).rejects.toBe(error);
    await expect(authClientService.signOutLocal(actor)).resolves.toBeUndefined();
    expect(mockAuth.signOut).toHaveBeenCalledTimes(2);
  });
});
