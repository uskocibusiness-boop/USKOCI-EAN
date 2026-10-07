/**
 * EX-07 S02 (gap G04, plan card N01 "loši podaci / mreža / ograničen nalog imaju različit recovery"): a failed sign-in is
 * told apart by what the Auth client reports, and a person is shown one plain message per class, never the provider's
 * own text or code.
 *
 * Evidence level of this file: SOURCE. The errors come from the INSTALLED @supabase/auth-js 2.112.4 (its own classes, and
 * its own `_request`/`handleError` path fed with GoTrue-shaped HTTP answers). The "provider" below is a fake modelled on
 * supabase/auth `internal/api/token.go` `ResourceOwnerPasswordGrant` as read on 2026-10-02 (user lookup, no password,
 * banned, wrong password, unconfirmed email, in that order). It is NOT the hosted DEV provider, which was not probed.
 */
// The declared package re-exports the auth-js classes; "@supabase/auth-js" itself is only hoisted, not a declared dependency.
import {
  AuthApiError, AuthInvalidTokenResponseError, AuthRetryableFetchError, AuthUnknownError, GoTrueClient,
} from '@supabase/supabase-js';

const mockAuth = {
  signInWithPassword: jest.fn(), signUp: jest.fn(), resend: jest.fn(), signInWithOtp: jest.fn(), verifyOtp: jest.fn(),
  resetPasswordForEmail: jest.fn(), getSession: jest.fn(), signOut: jest.fn(),
};
let mockClient: () => unknown = () => ({ auth: mockAuth });
let mockCurrent: { user: { id: string } | null; accountRevision: number } = { user: null, accountRevision: 0 };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => mockClient() }));
jest.mock('../pushDeviceClientService', () => ({ revokePushBeforeLogout: jest.fn().mockResolvedValue(true) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockCurrent }));

import { authClientService } from '../authClientService';
import {
  classifySignInFailure, isRestrictedAccountFailure, isRestrictedAccountSignal, restrictedRefreshRefusal, SIGN_IN_FAILURE_COPY,
  SignInFailureError, type SignInFailureClass,
} from '../authFailureClasses';
import { PasswordRecoveryError } from '../../contracts/passwordRecovery';

const EMAIL = 'ana@example.test';
const PASSWORD = 'tajna-lozinka-123';
const SENTINEL = 'PROVIDER_TEXT_SENTINEL https://private.example/token?secret=1';
const signIn = () => authClientService.signInWithPassword({ email: EMAIL, password: PASSWORD });

/** The six messages, pinned. The first, fifth and sixth are the messages the app already had; they must not move. */
const COPY: Record<SignInFailureClass, string> = {
  BAD_CREDENTIALS: 'Prijava nije uspela. Proveri email i lozinku i pokušaj ponovo.',
  CONNECTION: 'Ne možemo da se povežemo, pa prijava nije uspela. Proveri vezu i pokušaj ponovo.',
  EMAIL_NOT_CONFIRMED: 'Email još nije potvrđen. Otvori poruku za potvrdu (proveri i neželjenu poštu), pa se prijavi ponovo.',
  RESTRICTED_ACCOUNT: 'Pristup ovom nalogu je ograničen, pa prijava trenutno nije moguća. Pokušaj ponovo kada se ograničenje ukloni.',
  RATE_LIMITED: 'Previše pokušaja. Sačekaj kratko pa pokušaj ponovo.',
  UNAVAILABLE: 'Prijava trenutno nije dostupna. Pokušaj ponovo.',
};
const CLASSES = Object.keys(COPY) as SignInFailureClass[];

beforeEach(() => {
  jest.resetAllMocks();
  mockClient = () => ({ auth: mockAuth });
  mockCurrent = { user: null, accountRevision: 0 };
  process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL = 'uskociapp://oporavak';
  mockAuth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: null });
  mockAuth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mockAuth.resend.mockResolvedValue({ error: null });
  mockAuth.signInWithOtp.mockResolvedValue({ error: null });
  mockAuth.verifyOtp.mockResolvedValue({ error: null });
});

describe('the six sign-in messages', () => {
  it('are the pinned copy, and each one is its own', () => {
    expect(SIGN_IN_FAILURE_COPY).toEqual(COPY);
    expect(new Set(Object.values(SIGN_IN_FAILURE_COPY)).size).toBe(CLASSES.length);
  });

  const WHAT_HAPPENED: Record<SignInFailureClass, RegExp> = {
    BAD_CREDENTIALS: /^Prijava nije uspela\./, CONNECTION: /^Ne možemo da se povežemo/, EMAIL_NOT_CONFIRMED: /^Email još nije potvrđen\./,
    RESTRICTED_ACCOUNT: /^Pristup ovom nalogu je ograničen/, RATE_LIMITED: /^Previše pokušaja\./, UNAVAILABLE: /^Prijava trenutno nije dostupna\./,
  };
  /** The one thing the person can do, and the screen already offers it: retry, check the connection, confirm the email, wait. */
  const RECOVERY: Record<SignInFailureClass, RegExp> = {
    BAD_CREDENTIALS: /Proveri email i lozinku i pokušaj ponovo\.$/, CONNECTION: /Proveri vezu i pokušaj ponovo\.$/,
    EMAIL_NOT_CONFIRMED: /Otvori poruku za potvrdu .*pa se prijavi ponovo\.$/, RESTRICTED_ACCOUNT: /Pokušaj ponovo kada se ograničenje ukloni\.$/,
    RATE_LIMITED: /Sačekaj kratko pa pokušaj ponovo\.$/, UNAVAILABLE: /Pokušaj ponovo\.$/,
  };
  it.each(CLASSES)('%s names what happened, carries one recovery action and speaks plain Serbian in the "ti" voice', failureClass => {
    const message = COPY[failureClass];
    expect(message).toMatch(WHAT_HAPPENED[failureClass]);
    expect(message).toMatch(RECOVERY[failureClass]);
    expect(message).not.toMatch(/server/i);
    expect(message).not.toMatch(/\b(si|sam|ste)\b/i);
    // Nothing of the provider's vocabulary, codes or numbers reaches a person.
    expect(message).not.toMatch(/invalid|credentials|confirmed|banned|too many|rate limit|timeout|timed out|request|supabase|gotrue|token|auth\b/i);
    expect(message).not.toMatch(/\d/);
    // No support entry is reachable from the signed-out sign-in screen, so none is promised.
    expect(message).not.toMatch(/podršk/i);
  });
});

describe('what the installed auth-js reports becomes one class', () => {
  const api = (status: number, code: string | undefined) => new AuthApiError(SENTINEL, status, code);
  const retryable = (status: number) => new AuthRetryableFetchError(SENTINEL, status);
  const cases: [string, unknown, SignInFailureClass][] = [
    ['invalid_credentials (400): unknown email and wrong password are the same answer', api(400, 'invalid_credentials'), 'BAD_CREDENTIALS'],
    ['email_not_confirmed (400)', api(400, 'email_not_confirmed'), 'EMAIL_NOT_CONFIRMED'],
    ['user_banned (400)', api(400, 'user_banned'), 'RESTRICTED_ACCOUNT'],
    ['user_banned (403)', api(403, 'user_banned'), 'RESTRICTED_ACCOUNT'],
    ['over_request_rate_limit (429)', api(429, 'over_request_rate_limit'), 'RATE_LIMITED'],
    ['over_email_send_rate_limit (429)', api(429, 'over_email_send_rate_limit'), 'RATE_LIMITED'],
    ['429 without a code', api(429, undefined), 'RATE_LIMITED'],
    ['a provider code is compared in lower case', api(400, 'INVALID_CREDENTIALS'), 'BAD_CREDENTIALS'],
    ['a rate-limit code is enough without the 429 status', api(400, 'over_request_rate_limit'), 'RATE_LIMITED'],
    ['AuthRetryableFetchError status 0: no answer at all (offline, DNS, TLS, socket timeout, abort)', retryable(0), 'CONNECTION'],
    ['AuthRetryableFetchError 500', retryable(500), 'UNAVAILABLE'],
    ['AuthRetryableFetchError 502', retryable(502), 'UNAVAILABLE'],
    ['AuthRetryableFetchError 503', retryable(503), 'UNAVAILABLE'],
    ['AuthRetryableFetchError 504 (the provider timed out: request_timeout)', retryable(504), 'UNAVAILABLE'],
    ['unexpected_failure (500)', api(500, 'unexpected_failure'), 'UNAVAILABLE'],
    ['a code nobody here knows (400) no longer reads as wrong credentials', api(400, 'provider_internal'), 'UNAVAILABLE'],
    ['validation_failed (400)', api(400, 'validation_failed'), 'UNAVAILABLE'],
    ['email_provider_disabled (422)', api(422, 'email_provider_disabled'), 'UNAVAILABLE'],
    ['a rejection without a code (401 from a gateway)', api(401, undefined), 'UNAVAILABLE'],
    ['AuthUnknownError: a non-JSON error page has neither status nor code', new AuthUnknownError(SENTINEL, new SyntaxError('x')), 'UNAVAILABLE'],
    ['AuthInvalidTokenResponseError', new AuthInvalidTokenResponseError(), 'UNAVAILABLE'],
    ['a thrown plain Error', new Error(SENTINEL), 'UNAVAILABLE'],
    ['a thrown TypeError is not guessed to be the network from its text', new TypeError('Network request failed'), 'UNAVAILABLE'],
    ['a thrown string', SENTINEL, 'UNAVAILABLE'],
    ['null', null, 'UNAVAILABLE'],
    ['undefined', undefined, 'UNAVAILABLE'],
    ['a number', 0, 'UNAVAILABLE'],
    ['an object whose status is not a number', { status: '0', code: 7 }, 'UNAVAILABLE'],
  ];
  it.each(cases)('%s', (_label, error, expected) => {
    expect(classifySignInFailure(error)).toBe(expected);
  });

  it('the code decides before the status: a banned or unconfirmed answer is never mistaken for an outage', () => {
    expect(classifySignInFailure(api(500, 'user_banned'))).toBe('RESTRICTED_ACCOUNT');
    expect(classifySignInFailure(api(500, 'email_not_confirmed'))).toBe('EMAIL_NOT_CONFIRMED');
  });

  it('codes are compared whole, so a longer unknown code never borrows a class', () => {
    expect(classifySignInFailure(api(400, 'not_invalid_credentials'))).toBe('UNAVAILABLE');
    expect(classifySignInFailure(api(400, 'email_not_confirmed_yet'))).toBe('UNAVAILABLE');
    expect(classifySignInFailure(api(400, 'user_banned_forever'))).toBe('UNAVAILABLE');
  });
});

describe('the service turns every failed sign-in into the typed, safe error', () => {
  const returned = (error: unknown) => mockAuth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error });
  const cases: [string, unknown, SignInFailureClass][] = [
    ['invalid_credentials', new AuthApiError(SENTINEL, 400, 'invalid_credentials'), 'BAD_CREDENTIALS'],
    ['email_not_confirmed', new AuthApiError(SENTINEL, 400, 'email_not_confirmed'), 'EMAIL_NOT_CONFIRMED'],
    ['user_banned', new AuthApiError(SENTINEL, 400, 'user_banned'), 'RESTRICTED_ACCOUNT'],
    ['over_request_rate_limit', new AuthApiError(SENTINEL, 429, 'over_request_rate_limit'), 'RATE_LIMITED'],
    ['status 0', new AuthRetryableFetchError(SENTINEL, 0), 'CONNECTION'],
    ['503', new AuthRetryableFetchError(SENTINEL, 503), 'UNAVAILABLE'],
    ['unknown code', new AuthApiError(SENTINEL, 400, 'provider_internal'), 'UNAVAILABLE'],
  ];
  it.each(cases)('a returned %s error rejects with its class and only its message', async (_label, error, failureClass) => {
    returned(error);
    const thrown = await signIn().then(() => null, caught => caught);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).toBeInstanceOf(SignInFailureError);
    expect(thrown.failureClass).toBe(failureClass);
    expect(thrown.message).toBe(COPY[failureClass]);
  });

  it('a rejection from the Auth client (storage, a listener, client setup) is a failed sign-in too, never raw text', async () => {
    mockAuth.signInWithPassword.mockRejectedValue(new Error(SENTINEL));
    await expect(signIn()).rejects.toMatchObject({ failureClass: 'UNAVAILABLE', message: COPY.UNAVAILABLE });
    mockClient = () => { throw new Error('SUPABASE_NIJE_KONFIGURISAN: nedostaje EXPO_PUBLIC_SUPABASE_URL ili EXPO_PUBLIC_SUPABASE_ANON_KEY.'); };
    await expect(signIn()).rejects.toMatchObject({ failureClass: 'UNAVAILABLE', message: COPY.UNAVAILABLE });
    mockClient = () => ({ auth: mockAuth });
    mockAuth.signInWithPassword.mockResolvedValue(undefined);
    await expect(signIn()).rejects.toMatchObject({ failureClass: 'UNAVAILABLE', message: COPY.UNAVAILABLE });
  });

  it('an Auth error that is thrown, as a client configured with throwOnError does, is classified like a returned one', async () => {
    mockAuth.signInWithPassword.mockRejectedValue(new AuthApiError(SENTINEL, 400, 'invalid_credentials'));
    await expect(signIn()).rejects.toMatchObject({ failureClass: 'BAD_CREDENTIALS', message: COPY.BAD_CREDENTIALS });
    mockAuth.signInWithPassword.mockRejectedValue(new AuthRetryableFetchError(SENTINEL, 0));
    await expect(signIn()).rejects.toMatchObject({ failureClass: 'CONNECTION', message: COPY.CONNECTION });
  });

  it('a sign-in that works still resolves with nothing and sends the credentials untouched', async () => {
    await expect(authClientService.signInWithPassword({ email: EMAIL, password: `  ${PASSWORD}  ` })).resolves.toBeUndefined();
    expect(mockAuth.signInWithPassword.mock.calls).toEqual([[{ email: EMAIL, password: `  ${PASSWORD}  ` }]]);
  });

  it('carries no provider text, code, status, email or password anywhere on the error', async () => {
    for (const [, error] of cases) {
      returned(error);
      const thrown: Error = await signIn().then(() => null, caught => caught);
      const everything = Object.getOwnPropertyNames(thrown).map(name => String((thrown as unknown as Record<string, unknown>)[name])).join('\n') + JSON.stringify(thrown);
      for (const needle of [SENTINEL, 'PROVIDER_TEXT', 'invalid_credentials', 'email_not_confirmed', 'user_banned', 'over_request_rate_limit', 'provider_internal', EMAIL, PASSWORD, 'AuthApiError', 'AuthRetryableFetchError']) {
        expect(everything).not.toContain(needle);
      }
      expect('cause' in thrown).toBe(false);
    }
  });
});

describe('every other Auth operation keeps its copy exactly (sign-up, resend and phone are outside this slice)', () => {
  const UNAVAILABLE = 'Prijava trenutno nije dostupna. Pokušaj ponovo.';
  const RATE = 'Previše pokušaja. Sačekaj kratko pa pokušaj ponovo.';
  const operations = [
    ['SIGN_UP', 'signUp', () => authClientService.signUp({ email: EMAIL, password: PASSWORD, firstName: 'Ana', lastName: 'Ivić', city: 'Novi Sad' }),
      'Registracija trenutno nije uspela. Proveri podatke i pokušaj ponovo.'],
    ['SIGNUP_RESEND', 'resend', () => authClientService.resendSignupConfirmation(EMAIL), 'Novu potvrdu trenutno nije moguće zatražiti. Pokušaj ponovo.'],
    ['PHONE_SEND', 'signInWithOtp', () => authClientService.sendPhoneOtp({ phone: '+381601234567' }), 'Kod trenutno nije moguće poslati. Proveri broj i pokušaj ponovo.'],
    ['PHONE_VERIFY', 'verifyOtp', () => authClientService.verifyPhoneOtp({ phone: '+381601234567', token: '012345' }), 'Kod nije potvrđen. Proveri kod i pokušaj ponovo.'],
  ] as const;
  const signals: [string, unknown, 'DEFAULT' | 'RATE' | 'UNAVAILABLE' | 'BANNED'][] = [
    ['no answer at all (status 0)', new AuthRetryableFetchError(SENTINEL, 0), 'DEFAULT'],
    ['invalid_credentials', new AuthApiError(SENTINEL, 400, 'invalid_credentials'), 'DEFAULT'],
    ['email_not_confirmed', new AuthApiError(SENTINEL, 400, 'email_not_confirmed'), 'DEFAULT'],
    ['user_banned', new AuthApiError(SENTINEL, 400, 'user_banned'), 'BANNED'],
    ['user_banned (403)', new AuthApiError(SENTINEL, 403, 'user_banned'), 'BANNED'],
    ['a longer code that only contains user_banned', new AuthApiError(SENTINEL, 400, 'user_banned_forever'), 'DEFAULT'],
    ['an unknown code', new AuthApiError(SENTINEL, 400, 'provider_internal'), 'DEFAULT'],
    ['429', new AuthApiError(SENTINEL, 429, 'over_request_rate_limit'), 'RATE'],
    ['over_email_send_rate_limit', new AuthApiError(SENTINEL, 429, 'over_email_send_rate_limit'), 'RATE'],
    ['503', new AuthRetryableFetchError(SENTINEL, 503), 'UNAVAILABLE'],
    ['unexpected_failure', new AuthApiError(SENTINEL, 500, 'unexpected_failure'), 'UNAVAILABLE'],
  ];
  // Owner decision 2026-10-07: the phone way in tells a restricted account apart too; sign-up and resend do not.
  const PHONE = new Set<string>(['PHONE_SEND', 'PHONE_VERIFY']);
  describe.each(operations)('%s', (operation, method, run, fallback) => {
    it.each(signals)('%s', async (_label, error, expected) => {
      mockAuth[method].mockResolvedValue({ data: null, error });
      const thrown = await run().then(() => null, (caught: unknown) => caught as Error);
      expect(thrown).toBeInstanceOf(Error);
      if (expected === 'BANNED' && PHONE.has(operation)) {
        expect(thrown).toBeInstanceOf(SignInFailureError);
        expect(thrown).toMatchObject({ failureClass: 'RESTRICTED_ACCOUNT', message: COPY.RESTRICTED_ACCOUNT });
        return;
      }
      expect(thrown).not.toBeInstanceOf(SignInFailureError);
      expect(thrown!.message).toBe(expected === 'RATE' ? RATE : expected === 'UNAVAILABLE' ? UNAVAILABLE : fallback);
    });
  });

  it('a restricted phone answer carries nothing of the provider either', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ data: null, error: new AuthApiError(SENTINEL, 403, 'user_banned') });
    mockAuth.verifyOtp.mockResolvedValue({ data: null, error: new AuthApiError(SENTINEL, 403, 'user_banned') });
    for (const run of [() => authClientService.sendPhoneOtp({ phone: '+381601234567' }),
      () => authClientService.verifyPhoneOtp({ phone: '+381601234567', token: '012345' })]) {
      const thrown: Error = await run().then(() => { throw new Error('expected a refusal'); }, (caught: Error) => caught);
      const everything = Object.getOwnPropertyNames(thrown).map(name => String((thrown as unknown as Record<string, unknown>)[name])).join('\n');
      for (const needle of [SENTINEL, 'user_banned', 'AuthApiError', '+381601234567']) expect(everything).not.toContain(needle);
      expect('cause' in thrown).toBe(false);
    }
  });

  it('the resend and recovery refusals, which the task keeps unchanged, say what they said', async () => {
    mockCurrent = { user: { id: 'account-a' }, accountRevision: 1 };
    await expect(authClientService.resendSignupConfirmation(EMAIL)).rejects.toThrow(new Error('Potvrda registracije je namenjena neprijavljenom nalogu.'));
    await expect(authClientService.requestPasswordRecovery(EMAIL)).rejects.toMatchObject({ code: 'SIGNED_IN' });
    mockCurrent = { user: null, accountRevision: 0 };
    await expect(authClientService.resendSignupConfirmation('not an email')).rejects.toThrow(new Error('Unesi ispravnu email adresu.'));
    delete process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL;
    await expect(authClientService.requestPasswordRecovery(EMAIL)).rejects.toMatchObject({
      code: 'UNCONFIGURED', message: 'Oporavak lozinke još nije podešen za ovu verziju aplikacije.',
    });
    expect(mockAuth.resend).not.toHaveBeenCalled();
    expect(mockAuth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

/** A GoTrue-shaped HTTP answer, in the shape fetch hands to auth-js. A string body is not JSON. */
function answer(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300, status, statusText: '',
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => { if (typeof body === 'string') throw new SyntaxError('Unexpected token < in JSON'); return body; },
  };
}
let clients = 0;
/** The REAL auth-js client in front of a stand-in transport; only the network is fake. */
function realClient(transport: (url: unknown, init?: { body?: string }) => Promise<unknown>) {
  return new GoTrueClient({
    url: 'https://provider.test/auth/v1', headers: {}, storageKey: `ex07-s02-${++clients}`, persistSession: false,
    autoRefreshToken: false, detectSessionInUrl: false, skipAutoInitialize: true, fetch: transport as unknown as typeof fetch,
  });
}
async function realFailure(transport: Parameters<typeof realClient>[0]) {
  const client = realClient(transport);
  mockClient = () => ({ auth: client });
  return signIn().then(() => null, (caught: SignInFailureError) => caught);
}

describe('through the real auth-js client, from the wire to the screen', () => {
  const V2024 = { 'x-supabase-api-version': '2024-01-01' };
  const reject = (code: string, message: string, format: 'V2024' | 'LEGACY') => format === 'V2024'
    ? answer(400, { code, message }, V2024) : answer(400, { code: 400, error_code: code, msg: message });

  it('a lost connection is an AuthRetryableFetchError with status 0 and no code (the G04 finding, read from the installed library)', async () => {
    const offline = realClient(async () => { throw new TypeError('Network request failed'); });
    const { error } = await offline.signInWithPassword({ email: EMAIL, password: PASSWORD });
    expect(error).toBeInstanceOf(AuthRetryableFetchError);
    expect(error).toMatchObject({ status: 0 });
    expect((error as AuthRetryableFetchError).code).toBeUndefined();
    // ... and it is the CONNECTION class, no longer the "check email and password" message.
    const thrown = await realFailure(async () => { throw new TypeError('Network request failed'); });
    expect(thrown).toMatchObject({ failureClass: 'CONNECTION', message: COPY.CONNECTION });
    expect(thrown?.message).not.toBe(COPY.BAD_CREDENTIALS);
  });

  it.each(['V2024', 'LEGACY'] as const)('wrong credentials are AuthApiError invalid_credentials on the %s wire, and stay BAD_CREDENTIALS', async format => {
    expect(await realFailure(async () => reject('invalid_credentials', 'Invalid login credentials', format)))
      .toMatchObject({ failureClass: 'BAD_CREDENTIALS', message: COPY.BAD_CREDENTIALS });
  });

  it.each([
    ['an answer that is not JSON although the status is 200 (a captive portal)', () => answer(200, '<html>portal</html>'), 'CONNECTION'],
    ['a 503 page', () => answer(503, '<html>unavailable</html>'), 'UNAVAILABLE'],
    ['a 504 from the provider: request_timeout', () => answer(504, { code: 'request_timeout', message: 'Processing this request timed out, please retry after a moment.' }, V2024), 'UNAVAILABLE'],
    ['a 500 unexpected_failure', () => answer(500, { code: 'unexpected_failure', message: 'Database error querying schema' }, V2024), 'UNAVAILABLE'],
    ['a 429 from the provider', () => answer(429, { code: 'over_request_rate_limit', message: 'Request rate limit reached' }, V2024), 'RATE_LIMITED'],
    ['a 429 page that is not JSON (a proxy): the library keeps neither status nor code, so it cannot be told from any unexpected failure', () => answer(429, '<html>slow down</html>'), 'UNAVAILABLE'],
    ['a 403 page (a proxy: AuthUnknownError, no status, no code)', () => answer(403, '<html>blocked</html>'), 'UNAVAILABLE'],
    ['a 401 from the gateway (an invalid API key is a setup problem, not a wrong password)', () => answer(401, { message: 'Invalid API key' }), 'UNAVAILABLE'],
    ['a 422 email_provider_disabled', () => answer(422, { code: 'email_provider_disabled', message: 'Email logins are disabled' }, V2024), 'UNAVAILABLE'],
  ] as const)('%s', async (_label, wire, expected) => {
    expect(await realFailure(async () => wire())).toMatchObject({ failureClass: expected, message: COPY[expected] });
  });

  describe.each(['V2024', 'LEGACY'] as const)('a fake provider that answers in the order of supabase/auth ResourceOwnerPasswordGrant (%s wire)', format => {
    type Account = { email: string; password: string | null; confirmed: boolean; banned: boolean };
    const accounts: Account[] = [
      { email: 'ana@example.test', password: 'right', confirmed: true, banned: false },
      { email: 'nina@example.test', password: 'right', confirmed: false, banned: false },
      { email: 'bojan@example.test', password: 'right', confirmed: true, banned: true },
      { email: 'olga@example.test', password: null, confirmed: true, banned: false },
    ];
    const provider = async (_url: unknown, init?: { body?: string }) => {
      const { email, password } = JSON.parse(init?.body ?? '{}') as { email: string; password: string };
      const account = accounts.find(item => item.email === String(email).toLowerCase());
      if (!account) return reject('invalid_credentials', 'Invalid login credentials', format);
      if (!account.password) return reject('invalid_credentials', 'Invalid login credentials', format);
      if (account.banned) return reject('user_banned', 'User is banned', format);
      if (password !== account.password) return reject('invalid_credentials', 'Invalid login credentials', format);
      if (!account.confirmed) return reject('email_not_confirmed', 'Email not confirmed', format);
      return answer(200, { access_token: 'a', refresh_token: 'r', expires_in: 3600, token_type: 'bearer', user: { id: 'user-1', email: account.email } }, V2024);
    };
    const attempt = async (email: string, password: string) => {
      const client = realClient(provider);
      mockClient = () => ({ auth: client });
      return authClientService.signInWithPassword({ email, password }).then(() => null, (caught: SignInFailureError) => caught);
    };

    it('lets the right person in, so the fake is a working provider', async () => {
      expect(await attempt('ana@example.test', 'right')).toBeNull();
    });

    it('answers an unknown email, a wrong password, an account without a password and an unconfirmed account with the wrong password in ONE way', async () => {
      const results = [];
      for (const [email, password] of [['nobody@example.test', 'right'], ['ana@example.test', 'wrong'],
        ['olga@example.test', 'right'], ['nina@example.test', 'wrong']]) results.push(await attempt(email, password));
      expect(results.map(result => result?.failureClass)).toEqual(Array(4).fill('BAD_CREDENTIALS'));
      expect(new Set(results.map(result => result?.message))).toEqual(new Set([COPY.BAD_CREDENTIALS]));
    });

    it('says the email is not confirmed only to the person who knows the password', async () => {
      expect(await attempt('nina@example.test', 'wrong')).toMatchObject({ failureClass: 'BAD_CREDENTIALS' });
      expect(await attempt('nina@example.test', 'right')).toMatchObject({ failureClass: 'EMAIL_NOT_CONFIRMED', message: COPY.EMAIL_NOT_CONFIRMED });
    });

    // KNOWN, and it is the provider's order rather than ours: GoTrue checks banned_until BEFORE it checks the password,
    // so whoever types a restricted account's email, with any password, is told so. The message below only relays it.
    it('relays the restricted answer, which the provider gives before it looks at the password', async () => {
      expect(await attempt('bojan@example.test', 'wrong')).toMatchObject({ failureClass: 'RESTRICTED_ACCOUNT', message: COPY.RESTRICTED_ACCOUNT });
      expect(await attempt('bojan@example.test', 'right')).toMatchObject({ failureClass: 'RESTRICTED_ACCOUNT' });
    });
  });
});

/**
 * Owner decision 2026-10-07: a banned, blocked or closed account gets its own message on every way in (email, phone, the
 * recovery link) and when the provider ends a session because of it. These are the boundary's own predicates.
 */
describe('the restricted account is told apart wherever the provider says so', () => {
  it('reads only the whole provider code', () => {
    expect(isRestrictedAccountSignal(new AuthApiError(SENTINEL, 400, 'user_banned'))).toBe(true);
    expect(isRestrictedAccountSignal(new AuthApiError(SENTINEL, 403, 'USER_BANNED'))).toBe(true);
    for (const other of [new AuthApiError('User is banned', 400, 'invalid_credentials'), new AuthApiError(SENTINEL, 400, 'user_banned_x'),
      new AuthRetryableFetchError(SENTINEL, 0), new Error('user_banned'), 'user_banned', null, undefined, { code: 7 }]) {
      expect(isRestrictedAccountSignal(other)).toBe(false);
    }
  });

  it('draws the restricted panel for a restricted sign-in or recovery, and for nothing else', () => {
    expect(isRestrictedAccountFailure(new SignInFailureError('RESTRICTED_ACCOUNT'))).toBe(true);
    expect(isRestrictedAccountFailure(new PasswordRecoveryError('RESTRICTED_ACCOUNT'))).toBe(true);
    for (const failureClass of CLASSES.filter(item => item !== 'RESTRICTED_ACCOUNT')) {
      expect(isRestrictedAccountFailure(new SignInFailureError(failureClass))).toBe(false);
    }
    for (const other of [new PasswordRecoveryError('INVALID_LINK'), new AuthApiError(SENTINEL, 400, 'user_banned'),
      new Error(COPY.RESTRICTED_ACCOUNT), { failureClass: 'RESTRICTED_ACCOUNT' }, null, 'RESTRICTED_ACCOUNT']) {
      expect(isRestrictedAccountFailure(other)).toBe(false);
    }
  });

  describe('a refused refresh, read from the auth client the way the installed auth-js keeps it', () => {
    const now = 1_000_000;
    const refusal = (error: unknown, expiresAt = now + 1) => ({ lastRefreshFailure: { refreshToken: 'r', result: { data: null, error }, expiresAt } });
    it('returns the refusal itself only while its cooldown lasts and only for the restricted code', () => {
      const banned = new AuthApiError(SENTINEL, 400, 'user_banned');
      expect(restrictedRefreshRefusal(refusal(banned), now)).toBe(banned);
      expect(restrictedRefreshRefusal(refusal(banned, now), now)).toBeNull();
      expect(restrictedRefreshRefusal(refusal(new AuthApiError(SENTINEL, 400, 'refresh_token_not_found')), now)).toBeNull();
      expect(restrictedRefreshRefusal(refusal(new AuthRetryableFetchError(SENTINEL, 0)), now)).toBeNull();
      for (const shape of [null, undefined, {}, { lastRefreshFailure: null }, { lastRefreshFailure: { result: { error: banned } } },
        { lastRefreshFailure: { result: null, expiresAt: now + 1 } }, { lastRefreshFailure: { result: { error: 'user_banned' }, expiresAt: now + 1 } },
        { lastRefreshFailure: { result: { error: banned }, expiresAt: String(now + 1) } }]) {
        expect(restrictedRefreshRefusal(shape, now)).toBeNull();
      }
    });
  });

  /**
   * SOURCE evidence on the INSTALLED auth-js 2.112.4: the real GoTrueClient in front of a stand-in transport that refuses the
   * refresh as user_banned. It proves the three facts the session store relies on: the provider's refusal reaches the app
   * only as a bare SIGNED_OUT; at that moment the refusal is not yet recorded; and asking for the session afterwards resolves
   * only once it is, without another request. The hosted DEV provider's refresh answer for a banned account was NOT probed.
   */
  describe('through the real auth-js client, when the provider refuses the refresh', () => {
    const V2024 = { 'x-supabase-api-version': '2024-01-01' };
    type Observed = { events: string[]; atDispatch: unknown[]; afterSession: unknown[]; requests: string[] };
    async function observe(code: string, autoRefreshToken: boolean): Promise<Observed & { stored: boolean }> {
      const storageKey = `restricted-refresh-${++clients}`;
      const memory = new Map<string, string>([[storageKey, JSON.stringify({ access_token: 'expired-access', refresh_token: 'refresh-1',
        token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) - 60, user: { id: 'user-1', aud: 'authenticated' } })]]);
      const observed: Observed = { events: [], atDispatch: [], afterSession: [], requests: [] };
      const client = new GoTrueClient({
        url: 'https://provider.test/auth/v1', headers: {}, storageKey, persistSession: true, autoRefreshToken, detectSessionInUrl: false,
        storage: { getItem: async (key: string) => memory.get(key) ?? null, setItem: async (key: string, value: string) => { memory.set(key, value); },
          removeItem: async (key: string) => { memory.delete(key); } },
        fetch: (async (url: unknown) => {
          observed.requests.push(String(url));
          return answer(400, { code, message: 'Invalid Refresh Token' }, V2024);
        }) as unknown as typeof fetch,
      });
      const settled = new Promise<void>(done => {
        // The same steps as store/sesija: subscribe at once, and on SIGNED_OUT ask for the session before reading the refusal.
        client.onAuthStateChange(event => {
          observed.events.push(event);
          if (event !== 'SIGNED_OUT') return;
          observed.atDispatch.push(restrictedRefreshRefusal(client));
          void client.getSession().then(() => setTimeout(() => { observed.afterSession.push(restrictedRefreshRefusal(client)); done(); }, 0));
        });
      });
      const silence = jest.spyOn(console, 'error').mockImplementation(() => {});
      const quiet = jest.spyOn(console, 'warn').mockImplementation(() => {});
      let bound: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([settled, new Promise(done => { bound = setTimeout(done, 3000); })]);
      } finally {
        if (bound !== undefined) clearTimeout(bound);
        await client.stopAutoRefresh();
        silence.mockRestore(); quiet.mockRestore();
      }
      return { ...observed, stored: memory.has(storageKey) };
    }

    // autoRefreshToken=true is the app's own configuration: the restore refreshes during initialize, and auth-js holds that
    // SIGNED_OUT back until initialize has finished, so the refusal is already recorded when it arrives. autoRefreshToken=false
    // makes the session read itself refresh, which dispatches SIGNED_OUT BEFORE the refusal is recorded: the reason the store
    // waits instead of reading at the event.
    it.each([true, false])('the restricted refusal is readable once the session has been asked for again (autoRefreshToken=%s)', async autoRefreshToken => {
      const seen = await observe('user_banned', autoRefreshToken);
      expect(seen.events).toContain('SIGNED_OUT');
      expect(seen.stored).toBe(false);
      if (!autoRefreshToken) expect(seen.atDispatch).toEqual([null]);
      expect(seen.afterSession).toHaveLength(1);
      expect(seen.afterSession[0]).toBeInstanceOf(AuthApiError);
      expect(seen.afterSession[0]).toMatchObject({ code: 'user_banned' });
      // Asking for the session afterwards sent nothing: one refresh request, and only that one.
      expect(seen.requests).toHaveLength(1);
      expect(seen.requests[0]).toContain('/token?grant_type=refresh_token');
    });

    it('a refresh refused for any other reason is a plain sign-out with no reason', async () => {
      const seen = await observe('refresh_token_not_found', true);
      expect(seen.events).toContain('SIGNED_OUT');
      expect(seen.afterSession).toEqual([null]);
    });
  });
});
