const mockAuth = {
  signInWithPassword: jest.fn(), signUp: jest.fn(), signInWithOtp: jest.fn(), verifyOtp: jest.fn(),
  resetPasswordForEmail: jest.fn(), getSession: jest.fn(), signOut: jest.fn(),
};
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ auth: mockAuth }) }));
jest.mock('../pushDeviceClientService', () => ({ revokePushBeforeLogout: jest.fn().mockResolvedValue(true) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: null, session: null, accountRevision: 0 }) }));

import { authClientService } from '../authClientService';

beforeEach(() => {
  jest.resetAllMocks();
  mockAuth.signInWithPassword.mockResolvedValue({ error: null });
  mockAuth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mockAuth.signInWithOtp.mockResolvedValue({ error: null });
  mockAuth.verifyOtp.mockResolvedValue({ error: null });
});

describe('PKG-002 safe Auth error boundary', () => {
  it.each([
    ['sign in', () => authClientService.signInWithPassword({ email: 'ana@example.test', password: 'secret' }), 'signInWithPassword'],
    ['sign up', () => authClientService.signUp({ email: 'ana@example.test', password: 'secret', firstName: 'Ana', lastName: 'Ivić', city: 'Novi Sad' }), 'signUp'],
    ['send phone code', () => authClientService.sendPhoneOtp({ phone: '+381601234567' }), 'signInWithOtp'],
    ['verify phone code', () => authClientService.verifyPhoneOtp({ phone: '+381601234567', token: '012345' }), 'verifyOtp'],
  ] as const)('does not expose arbitrary upstream detail for %s', async (_label, command, method) => {
    mockAuth[method].mockResolvedValue({ data: null, error: { message: 'AUTH_UPSTREAM_INTERNAL_SENTINEL private://token', status: 400, code: 'provider_internal' } });
    await expect(command()).rejects.toThrow();
    try { await command(); } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain('AUTH_UPSTREAM_INTERNAL_SENTINEL');
      expect((error as Error).message).not.toContain('private://token');
    }
  });

  it('keeps a safe bounded rate-limit message without reflecting provider text', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ error: { message: 'secret provider body', status: 429, code: 'over_request_rate_limit' } });
    await expect(authClientService.signInWithPassword({ email: 'ana@example.test', password: 'secret' }))
      .rejects.toThrow('Previše pokušaja. Sačekajte kratko pa pokušajte ponovo.');
  });

  it('preserves legitimate sign-in, signup metadata and OTP payloads', async () => {
    const signIn = { email: 'ana@example.test', password: '  čuvaj lozinku  ' };
    await authClientService.signInWithPassword(signIn);
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith(signIn);

    mockAuth.signUp.mockResolvedValue({ data: { session: { user: { id: 'account-a' } } }, error: null });
    await expect(authClientService.signUp({ email: 'ana@example.test', password: 'secret', firstName: ' Ana ', lastName: ' Ivić ', city: 'Novi Sad' }))
      .resolves.toEqual({ hasSession: true });
    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'ana@example.test', password: 'secret', options: {
        emailRedirectTo: 'uskociapp://auth?form=login',
        data: {
          first_name: ' Ana ', last_name: ' Ivić ', full_name: 'Ana Ivić', city: 'Novi Sad',
        },
      },
    });

    await authClientService.sendPhoneOtp({ phone: '+381601234567' });
    await authClientService.verifyPhoneOtp({ phone: '+381601234567', token: '012345' });
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({ phone: '+381601234567' });
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({ phone: '+381601234567', token: '012345', type: 'sms' });
  });
});
