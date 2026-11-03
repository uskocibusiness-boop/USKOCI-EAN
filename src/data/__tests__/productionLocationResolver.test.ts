import { createProductionLocationResolver } from '../productionLocationResolver';

const mockGetSession = jest.fn(), mockInvoke = jest.fn();
let mockConfigured = true;
let mockOwner = { user: { id: 'account-A' }, accountRevision: 1 };
jest.mock('../supabaseClient', () => ({ supabaseKonfigurisan: () => mockConfigured,
  supabaseKlijent: () => ({ auth: { getSession: mockGetSession }, functions: { invoke: mockInvoke } }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockOwner }));

const query = { text: 'Novi Sad', countryCode: 'RS', scopeKey: 'LOCAL_ACCOUNT_AND_POINT_MUST_NOT_BE_SENT' };
const candidates = [{ label: 'Synthetic public city', countryCode: 'RS', position: { latitude: 45.251234, longitude: 19.831234 },
  providerHint: 'locationiq', candidateId: 'synthetic-candidate' }];
const session = (account = 'account-A', token = 'SYNTHETIC_USER_JWT') => ({ data: { session: { user: { id: account }, access_token: token } }, error: null });
const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL, oldKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, oldHint = process.env.EXPO_PUBLIC_LOCATION_PROVIDER_HINT;
const deferred = <T,>() => { let resolve!: (value: T) => void;const promise = new Promise<T>(done => { resolve = done; });return { promise, resolve }; };
beforeEach(() => {
  jest.clearAllMocks();mockOwner = { user: { id: 'account-A' }, accountRevision: 1 };mockConfigured = true;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.test.invalid';process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'SYNTHETIC_PUBLIC_KEY';
  process.env.EXPO_PUBLIC_LOCATION_PROVIDER_HINT = 'approved-provider';
  mockGetSession.mockResolvedValue(session());mockInvoke.mockResolvedValue({ data: { candidates }, error: null });
});
afterAll(() => {
  if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
  if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  if (oldHint === undefined) delete process.env.EXPO_PUBLIC_LOCATION_PROVIDER_HINT;else process.env.EXPO_PUBLIC_LOCATION_PROVIDER_HINT = oldHint;
});

it.each(['url', 'supabase'])('keeps missing %s configuration blocked without Auth/provider calls', async missing => {
  if (missing === 'url') delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (missing === 'supabase') mockConfigured = false;
  await expect(createProductionLocationResolver().search(query)).resolves.toEqual({ status: 'PROVIDER_ACTIVATION_BLOCKED' });
  expect(mockGetSession).not.toHaveBeenCalled();expect(mockInvoke).not.toHaveBeenCalled();
});

it('retains canonical DEV fallback only for an entirely absent public pair', async () => {
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  await expect(createProductionLocationResolver().search(query)).resolves.toMatchObject({ status: 'PROPOSALS' });
  expect(mockGetSession).toHaveBeenCalledTimes(1);
  expect(mockInvoke).toHaveBeenCalledTimes(1);
});

it('blocks malformed or mismatched config before any session or Edge call', async () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://custom.example.test/evil?key=PRIVATE';
  await expect(createProductionLocationResolver().search(query)).resolves.toEqual({ status: 'PROVIDER_ACTIVATION_BLOCKED' });
  expect(mockGetSession).not.toHaveBeenCalled();
  expect(mockInvoke).not.toHaveBeenCalled();
});

it('uses the approved public provider identity without a client token or optional hint variable', async () => {
  delete process.env.EXPO_PUBLIC_LOCATION_PROVIDER_HINT;
  await expect(createProductionLocationResolver().search(query)).resolves.toMatchObject({ status: 'PROPOSALS', candidates: [
    { origin: { providerHint: 'locationiq' } },
  ] });
  expect(JSON.stringify(mockInvoke.mock.calls)).not.toMatch(/LOCATIONIQ_ACCESS_TOKEN|locationiq\.com|[?&]key=/);
});

it('preserves the Edge rate limit without reading its response body or retrying', async () => {
  const context = new Response('PRIVATE_UPSTREAM_ERROR', { status: 429 });
  const readBody = jest.spyOn(context, 'json');
  mockInvoke.mockResolvedValue({ data: null, error: { context } });
  await expect(createProductionLocationResolver().search(query)).resolves.toEqual({ status: 'RATE_LIMITED' });
  expect(readBody).not.toHaveBeenCalled();expect(mockInvoke).toHaveBeenCalledTimes(1);
});

it('invokes only the owned Edge function with fresh JWT, body allowlist and AbortSignal', async () => {
  const resolver = createProductionLocationResolver();expect(mockGetSession).not.toHaveBeenCalled();expect(mockInvoke).not.toHaveBeenCalled();
  await expect(resolver.search(query)).resolves.toMatchObject({ status: 'PROPOSALS', requiresConfirmation: true });
  expect(mockGetSession).toHaveBeenCalledTimes(1);
  expect(mockInvoke).toHaveBeenCalledWith('uskoci-location-search', { body: { countryCode: 'RS', text: 'Novi Sad' },
    headers: { Authorization: 'Bearer SYNTHETIC_USER_JWT' }, signal: expect.any(AbortSignal) });
  expect(JSON.stringify(mockInvoke.mock.calls)).not.toContain(query.scopeKey);
  mockGetSession.mockResolvedValue(session('account-A', 'SYNTHETIC_REFRESHED_JWT'));await resolver.search(query);
  expect(mockInvoke.mock.calls[1][1].headers.Authorization).toBe('Bearer SYNTHETIC_REFRESHED_JWT');
});

it('cancels SDK invocation and ignores its late data even when invoke ignores AbortSignal', async () => {
  const provider = deferred<{ data: { candidates: typeof candidates }; error: null }>();mockInvoke.mockReturnValue(provider.promise);
  const resolver = createProductionLocationResolver(), controller = new AbortController();
  const result = resolver.search(query, controller.signal);await Promise.resolve();await Promise.resolve();
  expect(mockInvoke).toHaveBeenCalledTimes(1);controller.abort();
  await expect(result).resolves.toEqual({ status: 'CANCELLED' });expect(mockInvoke.mock.calls[0][1].signal.aborted).toBe(true);
  provider.resolve({ data: { candidates }, error: null });
});

it('an A-B-A account incarnation change during token lookup cannot send the old query or token', async () => {
  const token = deferred<ReturnType<typeof session>>();mockGetSession.mockReturnValue(token.promise);
  const resolver = createProductionLocationResolver(), result = resolver.search(query);
  mockOwner = { user: { id: 'account-B' }, accountRevision: 2 };mockOwner = { user: { id: 'account-A' }, accountRevision: 3 };
  token.resolve(session());await expect(result).resolves.toEqual({ status: 'UNAVAILABLE' });expect(mockInvoke).not.toHaveBeenCalled();
});

it('an A-B-A account incarnation change during invoke cannot return provider candidates', async () => {
  const provider = deferred<{ data: { candidates: typeof candidates }; error: null }>();mockInvoke.mockReturnValue(provider.promise);
  const resolver = createProductionLocationResolver(), result = resolver.search(query);await Promise.resolve();await Promise.resolve();
  expect(mockInvoke).toHaveBeenCalledTimes(1);
  mockOwner = { user: { id: 'account-B' }, accountRevision: 2 };mockOwner = { user: { id: 'account-A' }, accountRevision: 3 };
  provider.resolve({ data: { candidates }, error: null });await expect(result).resolves.toEqual({ status: 'UNAVAILABLE' });
});

it.each(['wrong-user', 'missing-session', 'error'])('does not invoke with %s session data', async failure => {
  mockGetSession.mockResolvedValue(failure === 'wrong-user' ? session('account-B') : failure === 'missing-session'
    ? { data: { session: null }, error: null } : { data: { session: null }, error: { message: 'PRIVATE_AUTH_ERROR' } });
  await expect(createProductionLocationResolver().search(query)).resolves.toEqual({ status: 'UNAVAILABLE' });expect(mockInvoke).not.toHaveBeenCalled();
});

it('sanitizes SDK errors and refuses a provider or country mismatch without a fallback request', async () => {
  const resolver = createProductionLocationResolver();
  mockInvoke.mockResolvedValueOnce({ data: 'PRIVATE_PROVIDER_BODY', error: { message: 'PRIVATE_PROVIDER_ERROR' } });
  await expect(resolver.search(query)).resolves.toEqual({ status: 'UNAVAILABLE' });
  mockInvoke.mockResolvedValueOnce({ data: { candidates: [{ ...candidates[0], providerHint: 'other-provider' }] }, error: null });
  await expect(resolver.search(query)).resolves.toEqual({ status: 'UNAVAILABLE' });
  mockInvoke.mockResolvedValueOnce({ data: { candidates: [{ ...candidates[0], countryCode: 'BA' }] }, error: null });
  await expect(resolver.search(query)).resolves.toEqual({ status: 'UNAVAILABLE' });expect(mockInvoke).toHaveBeenCalledTimes(3);
});
