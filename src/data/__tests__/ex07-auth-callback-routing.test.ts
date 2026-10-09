/**
 * EX-07 S03 - the APP-SIDE contract of the signup-confirmation and recovery callbacks (gap G05, cards N02/N03).
 *
 * What the provider hands to the app (a deep link with session tokens in the URL FRAGMENT) is proved elsewhere, on a disposable GoTrue +
 * Mailpit + emulator (.github/workflows/ex07-s03-auth-callbacks-proof.yml). This file proves, with the INSTALLED Expo Router, the real
 * `+native-intent` and the real root layout (no mocked router, no mocked Stack), what the app does with such a link BEFORE any provider
 * answers: which route it opens, that no credential ever reaches router state, route params or the console, that a signed-in account is
 * not replaced, and that the recovery parser refuses everything that is not a recovery callback. It is SOURCE/Jest evidence, not device
 * evidence. It also pins the words the emulator driver waits for (supabase/proofs/ex07/s03/ui_labels.json) so a copy change fails here,
 * in the ordinary test run, and not after a 50-minute CI run.
 */
import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, Linking } from 'react-native';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { inMemoryContext } from 'expo-router/build/testing-library/context-stubs';
import { Stack, useGlobalSearchParams, useLocalSearchParams, usePathname, useRootNavigationState, useSegments } from 'expo-router';
import RootLayout from '../../app/_layout';
import * as nativeIntent from '../../app/+native-intent';
import { passwordRecoveryIntent } from '../../store/passwordRecoveryIntent';
import { configuredRecoveryRedirect, parseRecoveryCallback } from '../passwordRecoveryLink';
import { signupConfirmationRedirect } from '../authSignupRedirect';

const mockCurrent: { isLoaded: boolean; session: null | { user: { id: string } }; user: null | { id: string };
  sessionEpoch: number; accountRevision: number; returnTargetRevision: number } = {
  isLoaded: true, session: null, user: null, sessionEpoch: 1, accountRevision: 0, returnTargetRevision: 0,
};
jest.mock('../../store/sesija', () => ({ useSesija: () => mockCurrent, sesijaSada: () => mockCurrent }));
jest.mock('../../store/povratniCilj', () => ({ povratniCilj: { consumeCompleted: jest.fn(() => Promise.resolve(null)) } }));
jest.mock('../../ui/notifications/PushRuntime', () => ({ PushRuntime: () => null }));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'GestureHandlerRootView' }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return key === 'Platform' ? { ...native.Platform, OS: 'android' } : Reflect.get(target, key);
  } });
});

const root = path.resolve(__dirname, '../../..');
const proofDir = path.join(root, 'supabase', 'proofs', 'ex07', 's03');
const readText = (file: string) => fs.readFileSync(file, 'utf8');
const shapes = JSON.parse(readText(path.join(proofDir, 'callback_shapes.json'))) as {
  redirects: { signup: string; recovery: string };
  cases: { id: string; url: string; appRecoveryParse: 'ACCEPTED' | 'INVALID_LINK' }[];
};

// Synthetic credentials: distinctive on purpose, so that finding one anywhere is unambiguous.
const ACCESS = 'SYNTHACCESSROUTING0001';
const REFRESH = 'SYNTHREFRESHROUTING01';
const SIGNUP_CALLBACK = `${shapes.redirects.signup}#access_token=${ACCESS}&expires_at=1893456000&expires_in=3600&refresh_token=${REFRESH}&token_type=bearer&type=signup`;
const SIGNUP_ERROR_CALLBACK = `${shapes.redirects.signup}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`;
const RECOVERY_CALLBACK = `${shapes.redirects.recovery}#access_token=${ACCESS}&expires_at=1893456000&expires_in=3600&refresh_token=${REFRESH}&token_type=bearer&type=recovery`;
const CREDENTIALS = [ACCESS, REFRESH];

type Frame = { screen: string; params: Record<string, unknown>; globalParams: Record<string, unknown>; segments: string[]; pathname: string; state: string };
const frames: Frame[] = [];
const logged: string[] = [];
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

function AuthProbe() {
  const params = useLocalSearchParams();
  const globalParams = useGlobalSearchParams();
  const segments = useSegments();
  const pathname = usePathname();
  const state = useRootNavigationState();
  frames.push({ screen: 'auth', params, globalParams, segments, pathname, state: JSON.stringify(state) });
  return React.createElement(Text, null, String(params.form ?? 'intro'));
}
function PrivateProbe() {
  const params = useLocalSearchParams();
  const state = useRootNavigationState();
  frames.push({ screen: 'private', params, globalParams: {}, segments: [], pathname: 'private', state: JSON.stringify(state) });
  return React.createElement(Text, null, 'private');
}
function RecoveryProbe() {
  const params = useLocalSearchParams();
  const state = useRootNavigationState();
  frames.push({ screen: 'oporavak', params, globalParams: {}, segments: [], pathname: 'oporavak', state: JSON.stringify(state) });
  return React.createElement(Text, null, 'recovery');
}
function Group() { return React.createElement(Stack); }

const redirectCalls: { path: string; initial: boolean }[] = [];
const redirectReturns: (string | null)[] = [];
const context = inMemoryContext({
  _layout: RootLayout, auth: AuthProbe, oporavak: RecoveryProbe,
  '(app)/_layout': Group, '(app)/index': PrivateProbe,
  'dogovor/[id]': PrivateProbe, obavestenja: PrivateProbe, prijave: PrivateProbe,
  // The REAL +native-intent, observed: the router calls it with the whole URL, fragment included.
  '+native-intent': {
    redirectSystemPath: (args: { path: string; initial: boolean }) => {
      redirectCalls.push(args);
      const returned = nativeIntent.redirectSystemPath(args);
      redirectReturns.push(returned);
      return returned;
    },
  } as never,
});

type Outcome = { frames: Frame[]; everything: string; calls: typeof redirectCalls; returns: (string | null)[] };

/** Boots the installed router at `initial`, then delivers each `events` URL as a warm OS event. */
async function launch(options: { initial?: string; signedIn?: boolean; events?: string[] }): Promise<Outcome> {
  frames.length = 0; redirectCalls.length = 0; redirectReturns.length = 0; logged.length = 0;
  const existing = passwordRecoveryIntent.snapshot();
  if (existing) passwordRecoveryIntent.clear(existing.id);
  mockCurrent.session = options.signedIn ? { user: { id: 'account-b' } } : null;
  mockCurrent.user = options.signedIn ? { id: 'account-b' } : null;
  const handlers: { type: string; callback: (event: { url: string }) => unknown }[] = [];
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue((options.initial ?? 'uskociapp://') as never);
  jest.spyOn(Linking, 'addEventListener').mockImplementation(((type: string, callback: (event: { url: string }) => unknown) => {
    handlers.push({ type, callback });
    return { remove: jest.fn() };
  }) as never);
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => { logged.push(util.format(...args)); });
  }
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(React.createElement(ExpoRoot, { context } as never));
      await sleep(300);
    });
    for (const url of options.events ?? []) {
      await act(async () => {
        for (const handler of handlers.filter(h => h.type === 'url')) await handler.callback({ url });
        await sleep(300);
      });
    }
    const everything = JSON.stringify(frames) + '\n' + logged.join('\n');
    return { frames: [...frames], everything, calls: [...redirectCalls], returns: [...redirectReturns] };
  } finally {
    await act(async () => tree?.unmount());
    jest.restoreAllMocks();
  }
}

const leaksNothing = (outcome: Outcome) => {
  for (const credential of CREDENTIALS) expect(outcome.everything).not.toContain(credential);
  expect(outcome.everything).not.toMatch(/access_token|refresh_token|SYNTHACCESS|SYNTHREFRESH/);
};

afterEach(() => {
  const existing = passwordRecoveryIntent.snapshot();
  if (existing) passwordRecoveryIntent.clear(existing.id);
});

describe('the installed Expo Router, the real +native-intent and the real root layout', () => {
  it('opens the login form for a cold signup-confirmation callback and keeps the fragment out of router state, params and the console', async () => {
    const outcome = await launch({ initial: SIGNUP_CALLBACK });
    const last = outcome.frames.at(-1)!;
    expect(last).toMatchObject({ screen: 'auth', params: { form: 'login' }, globalParams: { form: 'login' }, segments: ['auth'], pathname: '/auth' });
    expect(outcome.frames.every(frame => frame.screen === 'auth')).toBe(true);
    // The native boundary removes credentials before Router receives the path.
    expect(outcome.calls[0]).toEqual({ path: SIGNUP_CALLBACK, initial: true });
    expect(outcome.returns[0]).toBe('/auth?form=login');
    leaksNothing(outcome);
    // A signup callback is never a recovery callback: nothing is published for the recovery screen.
    expect(passwordRecoveryIntent.snapshot()).toBeNull();
  });

  it('keeps a warm signup-confirmation callback on the same login form, again without any credential in state', async () => {
    const outcome = await launch({ initial: shapes.redirects.signup, events: [SIGNUP_CALLBACK] });
    expect(outcome.calls.map(call => call.initial)).toEqual([true, false]);
    expect(outcome.calls[1].path).toBe(SIGNUP_CALLBACK);
    expect(outcome.frames.at(-1)).toMatchObject({ screen: 'auth', params: { form: 'login' }, pathname: '/auth' });
    leaksNothing(outcome);
    expect(passwordRecoveryIntent.snapshot()).toBeNull();
  });

  it('opens the same login form for an expired, used or wrong signup link (provider error in the fragment): nothing from the error reaches router state', async () => {
    const outcome = await launch({ initial: SIGNUP_ERROR_CALLBACK });
    expect(outcome.frames.at(-1)).toMatchObject({ screen: 'auth', params: { form: 'login' }, segments: ['auth'] });
    expect(outcome.everything).not.toMatch(/otp_expired|access_denied|invalid or has expired/);
    expect(passwordRecoveryIntent.snapshot()).toBeNull();
  });

  it('does not let another account\'s confirmation callback replace the signed-in account or open the login form', async () => {
    const outcome = await launch({ signedIn: true, events: [SIGNUP_CALLBACK] });
    expect(outcome.calls.at(-1)).toEqual({ path: SIGNUP_CALLBACK, initial: false });
    // The protected auth route is never rendered with the session present, and the private shell stays.
    expect(outcome.frames.some(frame => frame.screen === 'auth')).toBe(false);
    expect(outcome.frames.at(-1)!.screen).toBe('private');
    leaksNothing(outcome);
    expect(passwordRecoveryIntent.snapshot()).toBeNull();
  });

  it('routes a cold recovery callback to the clean /oporavak route: the credentials live only in the transient in-memory handoff, never in router state', async () => {
    const outcome = await launch({ initial: RECOVERY_CALLBACK });
    const last = outcome.frames.at(-1)!;
    expect(last.screen).toBe('oporavak');
    expect(last.params).toEqual({});
    expect(outcome.returns[0]).toBe('/oporavak');
    leaksNothing(outcome);
    expect(passwordRecoveryIntent.snapshot()?.link).toBe(RECOVERY_CALLBACK);
  });

  it('routes a warm recovery callback while another account is signed in to /oporavak too (the screen, not the router, refuses it) with clean params', async () => {
    const outcome = await launch({ signedIn: true, events: [RECOVERY_CALLBACK] });
    const last = outcome.frames.at(-1)!;
    expect(last.screen).toBe('oporavak');
    expect(last.params).toEqual({});
    leaksNothing(outcome);
    expect(passwordRecoveryIntent.snapshot()?.link).toBe(RECOVERY_CALLBACK);
  });
});

describe('what the app may treat as password-recovery authority (the shared callback shapes, parsed by the REAL parser)', () => {
  it('has a case for every shape the provider proof classifies', () => {
    expect(shapes.cases.map(c => c.id)).toEqual(expect.arrayContaining([
      'signup-session-tokens', 'recovery-session-tokens', 'signup-tokens-at-recovery-host', 'signup-provider-error', 'recovery-provider-error',
    ]));
  });

  it.each(shapes.cases.map(c => [c.id, c.url, c.appRecoveryParse] as const))('%s -> %s', (_id, url, expected) => {
    if (expected === 'ACCEPTED') {
      const tokens = parseRecoveryCallback(url, shapes.redirects.recovery);
      expect(Object.keys(tokens).sort()).toEqual(['access_token', 'refresh_token']);
    } else {
      expect(() => parseRecoveryCallback(url, shapes.redirects.recovery)).toThrow(expect.objectContaining({ code: 'INVALID_LINK' }));
    }
  });

  it('never accepts the signup confirmation callback as recovery authority, whatever its host', () => {
    for (const base of [shapes.redirects.signup, shapes.redirects.recovery]) {
      const url = SIGNUP_CALLBACK.replace(shapes.redirects.signup, base);
      expect(() => parseRecoveryCallback(url, shapes.redirects.recovery)).toThrow(expect.objectContaining({ code: 'INVALID_LINK' }));
    }
  });
});

describe('the redirects the app really sends are the ones the disposable stack allowlists', () => {
  const saved = process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL;
  afterEach(() => { if (saved === undefined) delete process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL; else process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL = saved; });

  it('sends exactly uskociapp://auth?form=login after a signup and accepts exactly uskociapp://oporavak for a recovery on native', () => {
    expect(signupConfirmationRedirect()).toBe(shapes.redirects.signup);
    process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL = shapes.redirects.recovery;
    expect(configuredRecoveryRedirect()).toBe(shapes.redirects.recovery);
    for (const wrong of ['uskociapp://oporavak/', 'uskociapp://oporavak?x=1', 'uskociapp://auth?form=login', 'https://example.test/oporavak', 'exp://127.0.0.1/--/oporavak']) {
      process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL = wrong;
      expect(configuredRecoveryRedirect()).toBeNull();
    }
  });

  it('is allowlisted, both URLs and nothing else, by the disposable stack config the proof starts', () => {
    const env = readText(path.join(proofDir, 'ex07_s03_env.sh'));
    const allowlist = /additional_redirect_urls = \[(.*?)\]/.exec(env)?.[1].match(/"([^"]+)"/g)?.map(s => s.slice(1, -1)).sort();
    expect(allowlist).toEqual([shapes.redirects.signup, shapes.redirects.recovery].sort());
    expect(env).toContain('enable_confirmations = true');
  });

  it('opens through the scheme the app registers', () => {
    expect(JSON.parse(readText(path.join(root, 'app.json'))).expo.scheme).toBe('uskociapp');
  });
});

describe('the words the emulator driver waits for still exist in the app source', () => {
  const labels = JSON.parse(readText(path.join(proofDir, 'ui_labels.json'))).labels as { id: string; text: string; sources: string[] }[];

  it('has every driver label verbatim in its source file', () => {
    const missing = labels.filter(label => !label.sources.some(source => readText(path.join(root, source)).includes(label.text)))
      .map(label => `${label.id}: "${label.text}" (${label.sources.join(', ')})`);
    expect(missing).toEqual([]);
  });
});
