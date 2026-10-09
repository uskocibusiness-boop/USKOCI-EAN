import { hasSignupReturnData, signupReturnKind } from '../signupConfirmationReturn';
import { signupConfirmationIntent as intent } from '../../store/signupConfirmationIntent';
import { captureInitialWebSignup } from '../../bootstrap/signupConfirmationBootstrap';

const redirect = 'uskociapp://auth?form=login';
const fragment = '#access_token=SYNTHETIC_ACCESS&refresh_token=SYNTHETIC_REFRESH&type=signup&token_type=bearer';
afterEach(() => { const value = intent.snapshot(); if (value) intent.clear(value.id); });

it('retains only a neutral category, never a confirmed-account assertion or credential', () => {
  expect(signupReturnKind(redirect + fragment, redirect)).toBe('RETURNED');
  intent.publish(signupReturnKind(redirect + fragment, redirect));
  expect(Object.keys(intent.snapshot()!).sort()).toEqual(['id', 'kind']);
  expect(JSON.stringify(intent.snapshot())).not.toMatch(/SYNTHETIC|token|email|link/i);
  expect(intent.serverSnapshot()).toBeNull();
});

it.each([
  'uskociapp://other?form=login' + fragment,
  'uskociapp://auth/path?form=login' + fragment,
  'uskociapp://person:password@auth?form=login' + fragment,
  redirect + '&next=https://example.test' + fragment,
  redirect + '&access_token=SYNTHETIC_ACCESS' + fragment,
  redirect + fragment.replace('signup', 'recovery'),
  redirect + fragment + '&type=signup',
  redirect + fragment + '&error=bad',
  redirect + fragment.replace('SYNTHETIC_ACCESS', '%20'),
  redirect + fragment.replace('SYNTHETIC_ACCESS', '%NO'),
  redirect + '#code=some-code',
  redirect + fragment.replace('SYNTHETIC_ACCESS', 'x'.repeat(24_577)),
])('refuses malformed/wrong-flow callbacks without exposing their contents', link => {
  expect(signupReturnKind(link, redirect)).toBe('INVALID_LINK');
});

it('does not call a plain login link a confirmation, and merges expired/used into honest copy', () => {
  expect(hasSignupReturnData(new URL(redirect))).toBe(false);
  expect(hasSignupReturnData(new URL(redirect + '&code=anything'))).toBe(true);
  expect(signupReturnKind(redirect + '#error=access_denied&error_code=otp_expired&error_description=RAW', redirect)).toBe('LINK_UNAVAILABLE');
});

it('a repeated identical callback is a new event; clearing an old event cannot erase the newer one', async () => {
  intent.publish('RETURNED'); const first = intent.snapshot()!;
  const stop = intent.subscribe(() => {});
  stop();
  const stop2 = intent.subscribe(() => {});
  await Promise.resolve();
  expect(intent.snapshot()).toBe(first);
  intent.publish('RETURNED'); const second = intent.snapshot()!;
  expect(second.id).toBeGreaterThan(first.id);
  intent.clear(first.id); expect(intent.snapshot()).toBe(second);
  stop2(); await Promise.resolve(); expect(intent.snapshot()).toBeNull();
});

it('scrubs web history BEFORE publishing, including provider errors, leaving no secret in history or handoff', () => {
  const href = 'https://app.example.test/auth?form=login' + fragment;
  const history = { replaceState: jest.fn(() => expect(intent.snapshot()).toBeNull()) };
  captureInitialWebSignup({ location: { pathname: '/auth', href, replace: jest.fn() }, history });
  expect(history.replaceState).toHaveBeenCalledWith(null, '', '/auth?form=login');
  expect(intent.snapshot()?.kind).toBe('RETURNED');
});

it('history failure leaves no handoff and replaces the page with a credential-free route', () => {
  const replace = jest.fn();
  captureInitialWebSignup({ location: { pathname: '/auth', href: 'https://app.example.test/auth?form=login' + fragment, replace },
    history: { replaceState: () => { throw new Error('blocked'); } } });
  expect(replace).toHaveBeenCalledWith('/auth?form=login');
  expect(intent.snapshot()).toBeNull();
});

it('does not touch recovery or ordinary login navigation', () => {
  const replaceState = jest.fn(); const replace = jest.fn();
  for (const [pathname, href] of [['/oporavak', 'https://app.example.test/oporavak' + fragment], ['/auth', 'https://app.example.test/auth?form=login']]) {
    captureInitialWebSignup({ location: { pathname, href, replace }, history: { replaceState } });
  }
  expect(replaceState).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled(); expect(intent.snapshot()).toBeNull();
});
