import { authAvailabilityClientService } from '../authAvailabilityClientService';
import { readPublicSupabaseConfig } from '../publicSupabaseConfig';

const fetchMock = jest.fn();
const originalFetch = global.fetch;
const settings = { external: { email: true, phone: false, google: false, apple: false },
  disable_signup: false, mailer_autoconfirm: false };
beforeEach(() => {
  delete process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL;
  jest.useFakeTimers();
  fetchMock.mockReset(); global.fetch = fetchMock;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://configured.example.test/';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-test-key';
  fetchMock.mockResolvedValue({ ok: true, json: async () => settings });
});
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

it('reads only public settings with the configured public key and projects current email-only availability', async () => {
  await expect(authAvailabilityClientService.read()).resolves.toEqual({ emailPassword: true, emailSignup: true,
    phoneOtp: false, emailConfirmationRequired: true, passwordRecovery: false });
  expect(fetchMock).toHaveBeenCalledWith('https://configured.example.test/auth/v1/settings', {
    method: 'GET', headers: { apikey: 'public-anon-test-key' }, signal: expect.any(AbortSignal),
  });
});

it('uses exactly the same canonical DEV fallback for both missing public settings', async () => {
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const config = readPublicSupabaseConfig();
  expect(config?.url).toBe('https://leqcwgzvjsxugfgzdmth.supabase.co');
  await expect(authAvailabilityClientService.read()).resolves.toMatchObject({ emailPassword: true });
  expect(fetchMock).toHaveBeenCalledWith(`${config?.url}/auth/v1/settings`, {
    method: 'GET', headers: { apikey: config?.anonKey }, signal: expect.any(AbortSignal),
  });
});

it.each(['URL only', 'key only', 'blank key'])('blocks partial public configuration instead of mixing targets: %s', async variant => {
  if (variant === 'URL only') delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (variant === 'key only') delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (variant === 'blank key') process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = ' ';
  expect(readPublicSupabaseConfig()).toBeNull();
  await expect(authAvailabilityClientService.read()).rejects.toThrow('AUTH_SETTINGS_UNCONFIGURED');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('does not activate unimplemented OAuth when future server flags become true', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...settings,
    external: { ...settings.external, google: true, apple: true, unknown_provider: true } }) });
  const result = await authAvailabilityClientService.read();
  expect(Object.keys(result).sort()).toEqual(['emailConfirmationRequired', 'emailPassword', 'emailSignup', 'passwordRecovery', 'phoneOtp']);
});

it('separates disabled signup from existing email login and exposes the implemented SMS path only if enabled', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...settings,
    external: { email: true, phone: true }, disable_signup: true, mailer_autoconfirm: true }) });
  await expect(authAvailabilityClientService.read()).resolves.toEqual({ emailPassword: true, emailSignup: false,
    phoneOtp: true, emailConfirmationRequired: false, passwordRecovery: false });
});

it('keeps disabled email from creating a signup path even when server signup is globally allowed', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...settings, external: { email: false, phone: false } }) });
  await expect(authAvailabilityClientService.read()).resolves.toMatchObject({ emailPassword: false, emailSignup: false });
});

it.each([null, {}, { ...settings, external: {} }, { ...settings, external: { email: 'true', phone: false } },
  { ...settings, disable_signup: null }, { ...settings, mailer_autoconfirm: 'false' }])('rejects malformed settings instead of inventing enabled methods: %p', async value => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => value });
  await expect(authAvailabilityClientService.read()).rejects.toThrow('AUTH_SETTINGS_INVALID');
});

it('rejects an HTTP failure and allows a fresh read after recovery', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false });
  await expect(authAvailabilityClientService.read()).rejects.toThrow('AUTH_SETTINGS_UNAVAILABLE');
  await expect(authAvailabilityClientService.read()).resolves.toMatchObject({ emailPassword: true });
});

it('does not start a request for an already cancelled caller', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(authAvailabilityClientService.read(controller.signal)).rejects.toThrow('AUTH_SETTINGS_CANCELLED');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('cancels pending fetch after ten seconds, then accepts a retry', async () => {
  fetchMock.mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const pending = expect(authAvailabilityClientService.read()).rejects.toThrow('AUTH_SETTINGS_CANCELLED');
  await jest.advanceTimersByTimeAsync(10_000);
  await pending;
  await expect(authAvailabilityClientService.read()).resolves.toMatchObject({ emailPassword: true });
});

it('also bounds a transport that ignores abort completely', async () => {
  fetchMock.mockImplementationOnce(() => new Promise(() => {}));
  const pending = expect(authAvailabilityClientService.read()).rejects.toThrow('AUTH_SETTINGS_CANCELLED');
  await jest.advanceTimersByTimeAsync(10_000);
  await pending;
});

it('ignores a body arriving after caller cancellation even if the transport ignores AbortSignal', async () => {
  let resolve!: (value: unknown) => void;
  fetchMock.mockResolvedValue({ ok: true, json: () => new Promise(done => { resolve = done; }) });
  const controller = new AbortController();
  const read = authAvailabilityClientService.read(controller.signal);
  await Promise.resolve(); controller.abort(); resolve(settings);
  await expect(read).rejects.toThrow('AUTH_SETTINGS_CANCELLED');
});


it('offers recovery only with both email enabled and the exact configured native callback', async () => {
  process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL = 'uskociapp://oporavak';
  await expect(authAvailabilityClientService.read()).resolves.toMatchObject({ passwordRecovery: true });
  process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL = 'https://unrelated.example/oporavak';
  await expect(authAvailabilityClientService.read()).resolves.toMatchObject({ passwordRecovery: false });
  process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL = 'uskociapp://oporavak';
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...settings, external: { email: false, phone: false } }) });
  await expect(authAvailabilityClientService.read()).resolves.toMatchObject({ passwordRecovery: false });
});
