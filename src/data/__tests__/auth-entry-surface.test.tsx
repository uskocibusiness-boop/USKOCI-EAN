import React from 'react';
jest.mock('../../ui/legal/LegalDocuments', () => ({ PublicLegalModal: 'LegalModal' }));
import { type } from '../../theme/tokens';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

const mockRead = jest.fn();
const mockPrepare = jest.fn();
let mockParams: { form?: string } = {};
const mockAuth = { signInWithPassword: jest.fn(), signUp: jest.fn(), resendSignupConfirmation: jest.fn(), sendPhoneOtp: jest.fn(),
  verifyPhoneOtp: jest.fn(), requestPasswordRecovery: jest.fn() };
let mockSession: { user: null | { id: string }; accountRevision: number; signOutReason?: null | { kind: 'RESTRICTED_ACCOUNT'; revision: number } } =
  { user: null, accountRevision: 0, signOutReason: null };
const mockConfirmReason = jest.fn();
let mockForeground: (state: string) => void;
let mockFocus: () => void | (() => void);
let mockBlur: undefined | (() => void);
/** The phone's Back button: the handler the screen registered, so a test can press it. */
let mockBack: undefined | (() => boolean);
const mockOpenUrl = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return { addEventListener: (_: unknown, cb: typeof mockForeground) => {
      mockForeground = cb; return { remove: jest.fn() };
    } };
    if (key === 'BackHandler') return { addEventListener: (_: string, handler: () => boolean) => {
      mockBack = handler; return { remove: () => { if (mockBack === handler) mockBack = undefined; } };
    } };
    if (key === 'Linking') return { openURL: (...args: unknown[]) => mockOpenUrl(...args) };
    return ['View', 'ScrollView', 'ActivityIndicator', 'Pressable', 'Text', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Defs: 'Defs', LinearGradient: 'LinearGradient',
  RadialGradient: 'RadialGradient', Rect: 'Rect', Stop: 'Stop', G: 'G', Path: 'Path', ClipPath: 'ClipPath', Image: 'SvgImage', Use: 'Use',
  Circle: 'Circle', Ellipse: 'Ellipse' }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = jest.requireActual('react');
    React.useEffect(() => {
      mockFocus = effect; mockBlur = effect() || undefined;
      return () => { mockBlur?.(); };
    }, [effect]);
  },
}));
jest.mock('../entryIntentClientService', () => ({ entryIntentClientService: { prepare: (...args: unknown[]) => mockPrepare(...args) } }));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('../../ui/entry/EntryWelcome', () => ({ EntryWelcome: 'Hero' }));
jest.mock('../../hooks/useEntrySplashReady', () => ({ useEntrySplashReady: () => ({ onLayout: jest.fn() }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession, useSesija: () => mockSession,
  potvrdiRazlogOdjave: (...args: unknown[]) => mockConfirmReason(...args) }));
jest.mock('../authAvailabilityClientService', () => ({ authAvailabilityClientService: { read: (...args: unknown[]) => mockRead(...args) } }));
jest.mock('../authClientService', () => ({ authClientService: {
  signInWithPassword: (...args: unknown[]) => mockAuth.signInWithPassword(...args),
  signUp: (...args: unknown[]) => mockAuth.signUp(...args),
  resendSignupConfirmation: (...args: unknown[]) => mockAuth.resendSignupConfirmation(...args),
  sendPhoneOtp: (...args: unknown[]) => mockAuth.sendPhoneOtp(...args),
  verifyPhoneOtp: (...args: unknown[]) => mockAuth.verifyPhoneOtp(...args),
  requestPasswordRecovery: (...args: unknown[]) => mockAuth.requestPasswordRecovery(...args),
} }));

import AuthScreen from '../../app/auth';
import { signupConfirmationIntent } from '../../store/signupConfirmationIntent';
import { PROVIDER_UNAVAILABLE_COPY, RATE_LIMITED_COPY, SIGN_IN_FAILURE_COPY, SignInFailureError, type SignInFailureClass } from '../authFailureClasses';
import { PasswordRecoveryError } from '../../contracts/passwordRecovery';
import { restrictedAccountCopy } from '../../ui/auth/RestrictedAccountPanel';

const emailOnly = { emailPassword: true, emailSignup: true, phoneOtp: false,
  emailConfirmationRequired: true, passwordRecovery: false };
let tree: ReactTestRenderer;
const host = (type: string) => tree.root.findAll(node => node.type === type);
const textOf = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : textOf(child)).join(' ');
const text = () => textOf(tree.root);
// The two ways in are tabs of one switch (N2); a button is anything else with that word, so the switch and the command that
// shares its name ("Napravi nalog") are never mistaken for each other.
const isTab = (node: ReactTestInstance) => node.props.accessibilityRole === 'tab';
const button = (label: string) => host('Pressable').find(node => !isTab(node) && textOf(node).trim() === label)!;
const tab = (label: string) => host('Pressable').find(node => isTab(node) && textOf(node).trim() === label)!;
const intentLine = () => host('Pressable').find(node => node.props.testID === 'auth-intent');
const input = (label: string) => host('TextInput').find(node => node.props.accessibilityLabel === label)!;
async function press(label: string) { await act(async () => button(label).props.onPress()); }
async function pressTab(label: string) { await act(async () => tab(label).props.onPress()); }
async function fill(label: string, value: string) { await act(async () => input(label).props.onChangeText(value)); }
async function render() {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onSignIn());
}
/** What the entry's "Napravi nalog" does, and what a choice of one of its halves does: the form opens on creating an account. */
const signUpFields = ['Ime', 'Prezime', 'Grad', 'Email', 'Lozinka'];
const signUpValues: [string, string][] = [['Ime', 'Ana'], ['Prezime', 'Petrović'], ['Grad', 'Novi Sad'],
  ['Email', 'ana@example.test'], ['Lozinka', 'password']];
const LEGAL = 'Uslovi korišćenja i Politika privatnosti još nisu objavljeni.';
/** The one title of the first step: "Zdravo." said nothing, and it was the same for signing in and for making an account. */
const TITLE = 'Prijavi se ili napravi nalog';
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  jest.clearAllMocks(); mockBack = undefined; mockOpenUrl.mockResolvedValue(undefined);
  mockPrepare.mockResolvedValue(undefined); mockParams = {}; mockRead.mockResolvedValue(emailOnly); mockSession = { user: null, accountRevision: 0, signOutReason: null };
  for (const method of Object.values(mockAuth)) method.mockResolvedValue(undefined);
  mockAuth.signUp.mockResolvedValue({ hasSession: false });
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('keeps email functional and shows no way in that does not work', async () => {
  // Owner decision, 2026-09-18. Google and Apple wait on an OAuth client that server settings alone
  // cannot make ready, and Telefon appears only when the server says it is on. Three dead buttons
  // under "Drugi načini prijave" read as an app that is broken rather than one that is early.
  await render();
  expect(input('Email')).toBeDefined(); expect(button('Prijavi se')).toBeDefined();
  // The other way in is one touch away on the same screen: a switch, not a link to another form.
  expect(tab('Napravi nalog').props.accessibilityState).toMatchObject({ selected: false });
  expect(tab('Prijava').props.accessibilityState).toMatchObject({ selected: true });
  // The small capital-letter line above the title is gone (owner, 2026-10-07: no eyebrow); no intent is echoed without a prepared one.
  expect(text()).not.toContain('JEDAN NALOG · OBE MOGUĆNOSTI');
  expect(intentLine()).toBeUndefined();
  expect(text()).not.toContain('Tražiš pomoć'); expect(text()).not.toContain('Uskačeš');
  expect(text()).not.toContain('Objavi zadatak');
  expect(text()).not.toContain('Uskoči i zaradi');
  for (const provider of ['Google', 'Apple', 'Telefon']) {
    expect(host('Pressable').find(node => node.props.accessibilityLabel === provider)).toBeUndefined();
  }
  expect(text()).not.toContain('Drugi načini prijave');
  expect(text()).not.toContain('Trenutno nije dostupno');
  expect(text()).toContain('Za sada se ulazi email adresom i lozinkom.');
  for (const fake of ['Sačuvali smo', 'istu Priliku', 'ili nastavi preko']) expect(text()).not.toContain(fake);
  expect(Object.values(mockAuth).every(command => command.mock.calls.length === 0)).toBe(true);
});
it('connects the V4.9 welcome signup action to the existing real signup sheet without submitting', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onSignUp());
  // The password is asked once (N2): the eye on it shows what was typed, and there is no second field to match.
  expect(host('TextInput').map(node => node.props.accessibilityLabel)).toEqual(signUpFields);
  expect(button('Napravi nalog')).toBeDefined();
  expect(tab('Napravi nalog').props.accessibilityState).toMatchObject({ selected: true });
  expect(Object.values(mockAuth).every(command => command.mock.calls.length === 0)).toBe(true);
  expect(mockPrepare).not.toHaveBeenCalled();
});

it('is ONE calm screen for both ways in: one greeting, the switch under it, the real fields, the explicit primary command', async () => {
  await render();
  const heading = (value: string) => host('Text').find(node => node.props.accessibilityRole === 'header' && textOf(node) === value)!;
  // The same title in the same size in both ways ("Zdravo." said nothing); the old second title ("Napravi nalog", "Registracija") is gone.
  expect(StyleSheet.flatten(heading(TITLE).props.style).fontSize).toBe(type.pageTitle.fontSize);
  // (The word "Prijava" is the switch's own label; no bar title repeats it above the greeting.)
  expect(host('Text').some(node => textOf(node) === 'Registracija')).toBe(false);
  expect(host('Text').filter(node => textOf(node) === 'Prijava')).toHaveLength(1);
  await pressTab('Napravi nalog');
  expect(StyleSheet.flatten(heading(TITLE).props.style).fontSize).toBe(type.pageTitle.fontSize);
  expect(host('Text').filter(node => node.props.accessibilityRole === 'header').map(node => textOf(node))).toEqual([TITLE]);
  expect(host('TextInput').map(node => node.props.accessibilityLabel)).toEqual(signUpFields);
  expect(text()).toContain('Jedan nalog. Možeš i da tražiš pomoć i da uskočiš drugima.');
  expect(text()).not.toContain('Potvrdi lozinku'); expect(text()).not.toContain('Ponovi lozinku');
  // "Za sada se ulazi ..." stands where the other ways in would, on signing in; on making an account it would be a second note.
  expect(text()).not.toContain('Za sada se ulazi email adresom i lozinkom.');
  expect(button('Napravi nalog')).toBeDefined();
  expect(text()).not.toContain('Korak 1 od 3');
  expect(mockAuth.signUp).not.toHaveBeenCalled();
  await pressTab('Prijava');
  expect(StyleSheet.flatten(heading(TITLE).props.style).fontSize).toBe(type.pageTitle.fontSize);
  expect(host('TextInput').map(node => node.props.accessibilityLabel)).toEqual(['Email', 'Lozinka']);
  expect(text()).not.toContain('Jedan nalog.');
  expect(text()).toContain('Za sada se ulazi email adresom i lozinkom.');
});

// PKG-031 / deep read 8.2: no tick that recorded nothing. While the documents are not published the screen says so, once,
// under the command that creates the account, and not on the way in.
it('says honestly that the legal documents are not published instead of a tick, only when an account is being made', async () => {
  await render();
  expect(text()).not.toContain(LEGAL);
  await pressTab('Napravi nalog');
  expect(host('Text').filter(node => textOf(node) === LEGAL)).toHaveLength(1);
  expect(host('Pressable').filter(node => node.props.accessibilityRole === 'checkbox')).toHaveLength(0);
  expect(host('Text').filter(node => node.props.accessibilityRole === 'link')).toHaveLength(0);
  expect(text()).not.toContain('Ovo je test verzija');
  // It stands with the primary command, in the footer under it, so it is read where the account is made.
  const footer = host('View').find(node => node.findAll(child => String(child.type) === 'Text' && textOf(child) === LEGAL).length === 1
    && node.findAll(child => String(child.type) === 'Pressable' && textOf(child).trim() === 'Napravi nalog' && !isTab(child)).length === 1
    && node.findAllByType('TextInput' as React.ElementType).length === 0)!;
  expect(footer).toBeDefined();
  await pressTab('Prijava');
  expect(text()).not.toContain(LEGAL);
});

it('asks for the password once: the eye is on the field, the sign-up sends what was typed, and nothing else is checked against it', async () => {
  await render(); await pressTab('Napravi nalog');
  expect(host('TextInput').filter(node => node.props.secureTextEntry !== undefined)).toHaveLength(1);
  const eye = host('Pressable').filter(node => node.props.accessibilityLabel === 'Prikaži lozinku');
  expect(eye).toHaveLength(1);
  expect(input('Lozinka').props.autoComplete).toBe('new-password');
  for (const [label, value] of signUpValues) await fill(label, value);
  await press('Napravi nalog');
  expect(mockAuth.signUp.mock.calls).toEqual([[{ email: 'ana@example.test', password: 'password', firstName: 'Ana', lastName: 'Petrović', city: 'Novi Sad' }]]);
});

it('still refuses a short password locally, on the one field there is, and sends nothing', async () => {
  await render(); await pressTab('Napravi nalog');
  for (const [label, value] of signUpValues) await fill(label, label === 'Lozinka' ? 'abc' : value);
  await press('Napravi nalog');
  expect(text()).toContain('Lozinka mora imati najmanje 6 znakova.');
  expect(mockAuth.signUp).not.toHaveBeenCalled();
  expect(host('TextInput').every(node => node.props.editable === true)).toBe(true);
});

it('keeps an empty password submission local and immediately editable', async () => {
  await render(); await press('Prijavi se');
  expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  // Said under the field it is about, one sentence each, and the first of them takes the focus.
  expect(text()).toContain('Unesi email.'); expect(text()).toContain('Unesi lozinku.');
  expect(input('Email').props.editable).toBe(true);
});

// EX-07 S02: the screen shows whatever message the Auth boundary chose, with no wiring of its own; the recovery that
// the message names (retry, the existing "Zaboravljena lozinka?") is already on the form, the email is kept, and the
// next attempt is allowed.
// A restricted account is not a retryable form error any more: it has its own panel (owner decision 2026-10-07, below).
it.each((Object.keys(SIGN_IN_FAILURE_COPY) as SignInFailureClass[]).filter(item => item !== 'RESTRICTED_ACCOUNT'))('a %s sign-in failure shows its own message and leaves the form retryable', async failureClass => {
  await render(); await fill('Email', 'ana@example.test'); await fill('Lozinka', 'password');
  mockAuth.signInWithPassword.mockRejectedValueOnce(new SignInFailureError(failureClass));
  await press('Prijavi se');
  const alert = () => host('Text').find(node => node.props.accessibilityRole === 'alert');
  expect(textOf(alert()!)).toBe(SIGN_IN_FAILURE_COPY[failureClass]);
  expect(input('Email').props.value).toBe('ana@example.test');
  expect(host('TextInput').every(node => node.props.editable === true)).toBe(true);
  expect(button('Zaboravljena lozinka?')).toBeDefined();
  await press('Prijavi se');
  expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(2);
  expect(alert()).toBeUndefined();
});

it('hides a revealed password when switching form mode, preserving the entered value without submitting', async () => {
  await render(); await fill('Lozinka', 'local-dummy-value');
  const loginScroll = host('ScrollView')[0];
  const toggle = () => host('Pressable').find(node => node.props.accessibilityLabel === 'Prikaži lozinku')!;
  await act(async () => toggle().props.onPress());
  expect(input('Lozinka').props.secureTextEntry).toBe(false);
  await pressTab('Napravi nalog');
  // The two ways are one screen with one switch: the same scroll surface, which is wound back to its top by the switch itself
  // (the signup fields must not stay hidden above where the shorter form had been scrolled to, at 200% text size too).
  expect(host('ScrollView')[0]).toBe(loginScroll);
  expect(button('Napravi nalog')).toBeDefined();
  expect(button('Prijavi se')).toBeUndefined();
  expect(tab('Napravi nalog').props.accessibilityState).toMatchObject({ selected: true });
  expect(input('Lozinka').props.value).toBe('local-dummy-value');
  expect(input('Lozinka').props.secureTextEntry).toBe(true);
  await act(async () => toggle().props.onPress());
  expect(host('ScrollView')[0]).toBe(loginScroll);
  await pressTab('Prijava');
  expect(button('Prijavi se')).toBeDefined();
  expect(input('Lozinka').props.secureTextEntry).toBe(true);
  expect(Object.values(mockAuth).every(command => command.mock.calls.length === 0)).toBe(true);
});

// Owner, on the phone and on the emulator, 2026-10-07: "Ne možemo da proverimo dostupne načine prijave" LOCKED the sign-in form when
// the first read of the available ways in failed or was slow. Email and password is the way in; the read only refines it (the phone,
// a closed sign-up). A read that fails is a quiet note under the form with a way to try again, never a closed form.
describe('the form never waits for the check of the available ways in', () => {
  const QUIET = 'Dodatne načine prijave nismo uspeli da proverimo.';
  const typeCredentials = async () => { await fill('Email', 'ana@example.test'); await fill('Lozinka', 'password'); };

  it('is usable while the check is still being made, and signs in without waiting for it', async () => {
    const pending = deferred<unknown>(); mockRead.mockReturnValueOnce(pending.promise);
    await render();
    expect(host('TextInput').map(node => node.props.accessibilityLabel)).toEqual(['Email', 'Lozinka']);
    expect(text()).not.toContain('Proveravamo dostupne'); expect(text()).not.toContain(QUIET);
    expect(button('Prijavi se')).toBeDefined(); expect(tab('Napravi nalog')).toBeDefined();
    await typeCredentials(); await press('Prijavi se');
    expect(mockAuth.signInWithPassword.mock.calls).toEqual([[{ email: 'ana@example.test', password: 'password' }]]);
  });

  it('is usable when the check fails, says so quietly with a way to try again, and signs in without it', async () => {
    mockRead.mockRejectedValue(new Error('offline'));
    await render();
    expect(host('TextInput').map(node => node.props.accessibilityLabel)).toEqual(['Email', 'Lozinka']);
    expect(text()).toContain(QUIET); expect(button('Pokušaj ponovo')).toBeDefined();
    // The words that used to stand in front of the fields are gone, and so is the claim that nothing else is offered.
    expect(text()).not.toContain('Ne možemo da proverimo dostupne načine prijave'); expect(text()).not.toContain('Za sada se ulazi email adresom i lozinkom.');
    expect(host('Text').filter(node => node.props.accessibilityRole === 'alert')).toHaveLength(0);
    await typeCredentials(); await press('Prijavi se');
    expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it('can also make an account when the check failed: the switch and the fields are there, and the command sends them', async () => {
    mockRead.mockRejectedValue(new Error('offline'));
    await render(); await pressTab('Napravi nalog');
    expect(host('TextInput').map(node => node.props.accessibilityLabel)).toEqual(signUpFields);
    for (const [label, value] of signUpValues) await fill(label, value);
    await press('Napravi nalog');
    expect(mockAuth.signUp).toHaveBeenCalledTimes(1);
    // The check could not say whether a confirmation is needed, so the cautious thing is said after the sign-up.
    expect(text()).toContain('Poslaćemo ti poruku za potvrdu emaila');
  });

  it('"Pokušaj ponovo" reads again and keeps what was typed; the note goes when the read succeeds', async () => {
    mockRead.mockRejectedValueOnce(new Error('offline'));
    await render(); await fill('Email', 'ana@example.test');
    await press('Pokušaj ponovo');
    expect(mockRead).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain(QUIET); expect(input('Email').props.value).toBe('ana@example.test');
    expect(text()).toContain('Za sada se ulazi email adresom i lozinkom.');
  });

  it('keeps the form and what was typed when the app comes back to the front and the check is made again', async () => {
    const again = deferred<unknown>();
    await render(); await fill('Email', 'ana@example.test');
    mockRead.mockReturnValueOnce(again.promise);
    await act(async () => mockForeground('active'));
    expect(input('Email').props.value).toBe('ana@example.test'); expect(host('TextInput')).toHaveLength(2);
    await act(async () => again.reject(new Error('offline')));
    expect(input('Email').props.value).toBe('ana@example.test'); expect(text()).toContain(QUIET);
  });

  it('does not take recovery away: a build that can recover a password offers it whatever the check found', async () => {
    process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL = 'uskociapp://oporavak';
    try {
      mockRead.mockRejectedValue(new Error('offline'));
      await render(); await fill('Email', 'ana@example.test'); await press('Zaboravljena lozinka?');
      await press('Pošalji link');
      expect(mockAuth.requestPasswordRecovery.mock.calls).toEqual([['ana@example.test']]);
    } finally { delete process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL; }
  });
});

it('does not offer signup when disabled, while existing email login remains available', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, emailSignup: false });
  await render(); expect(button('Napravi nalog')).toBeUndefined(); expect(button('Prijavi se')).toBeDefined();
  // With nothing to switch to there is no switch.
  expect(host('Pressable').some(isTab)).toBe(false);
  expect(text()).toContain('Otvaranje novih naloga trenutno nije dostupno.');
  // With one way in there is nothing to choose between, so the title names that way.
  expect(host('Text').filter(node => node.props.accessibilityRole === 'header').map(node => textOf(node))).toEqual(['Prijavi se']);
});

it('gives an explicit route back if signup is disabled while the signup form is open', async () => {
  await render(); await pressTab('Napravi nalog');
  mockRead.mockResolvedValue({ ...emailOnly, emailSignup: false });
  await act(async () => mockForeground('active'));
  expect(button('Nazad na prijavu')).toBeDefined(); await press('Nazad na prijavu');
  expect(button('Prijavi se')).toBeDefined();
});

it('blocks duplicate signup, conflicting navigation and editing, then shows accurate confirmation with a real login Back', async () => {
  await render(); await pressTab('Napravi nalog');
  for (const [label, value] of signUpValues) await fill(label, value);
  const pending = deferred<{ hasSession: boolean }>(); mockAuth.signUp.mockReturnValueOnce(pending.promise);
  const submit = button('Napravi nalog').props.onPress;
  await act(async () => { submit(); submit(); });
  expect(mockAuth.signUp).toHaveBeenCalledTimes(1); expect(host('TextInput').every(node => node.props.editable === false)).toBe(true);
  const close = host('Pressable').find(node => node.props.accessibilityLabel === 'Nazad')!;
  expect(close.props.disabled).toBe(true); await act(async () => close.props.onPress());
  expect(host('TextInput')).toHaveLength(5);
  await act(async () => pending.resolve({ hasSession: false }));
  expect(text()).toContain('Poslaćemo ti poruku za potvrdu emaila'); expect(text()).not.toContain('Poslali smo Vam poruku');
  expect(button('Promeni email')).toBeDefined(); await press('Nazad na prijavu');
  expect(button('Prijavi se')).toBeDefined(); expect(input('Email').props.value).toBe('ana@example.test');
});

it('offers an explicit confirmation resend after signup and serializes duplicate taps', async () => {
  await render(); await pressTab('Napravi nalog');
  for (const [label, value] of signUpValues) await fill(label, value);
  await press('Napravi nalog');
  expect(button('Pošalji ponovo potvrdu')).toBeDefined();
  const pending = deferred<void>(); mockAuth.resendSignupConfirmation.mockReturnValueOnce(pending.promise);
  const resend = button('Pošalji ponovo potvrdu').props.onPress;
  await act(async () => { resend(); resend(); });
  expect(mockAuth.resendSignupConfirmation).toHaveBeenCalledTimes(1);
  expect(mockAuth.resendSignupConfirmation).toHaveBeenCalledWith('ana@example.test');
  await act(async () => pending.resolve());
  expect(text()).toContain('Ako email čeka potvrdu, stići će nova poruka.');
});

it('visibly gates unfinished recovery and never sends a broken reset link', async () => {
  await render(); await press('Zaboravljena lozinka?');
  expect(text()).toContain('Oporavak lozinke još nije dostupan');
  // One name for the function, everywhere ("Oporavak pristupa", "Oporavak naloga" and "Vrati pristup nalogu" were three).
  expect(text()).not.toMatch(/Oporavak pristupa|Oporavak naloga|Vrati pristup nalogu/);
  const title = host('Text').find(node => node.props.accessibilityRole === 'header' && textOf(node) === 'Oporavak lozinke')!;
  expect(StyleSheet.flatten(title.props.style).fontSize).toBe(type.pageTitle.fontSize);
  expect(textOf(title)).not.toContain('\n');
  expect(host('TextInput')).toHaveLength(0); expect(button('Pošalji link')).toBeUndefined();
  expect(mockAuth.requestPasswordRecovery).not.toHaveBeenCalled();
  await press('Nazad na prijavu'); expect(button('Prijavi se')).toBeDefined();
});

it('does not promise a confirmation email when autoconfirm is enabled but signup returns no session', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, emailConfirmationRequired: false });
  await render(); await pressTab('Napravi nalog');
  for (const [label, value] of signUpValues) await fill(label, value);
  await press('Napravi nalog');
  expect(text()).toContain('Prijava još nije gotova.'); expect(text()).not.toContain('dobićete poruku');
  expect(button('Nazad na prijavu')).toBeDefined();
});

it('rejects an old login press after the form changes to signup', async () => {
  await render(); await fill('Email', 'ana@example.test'); await fill('Lozinka', 'password');
  const oldPress = button('Prijavi se').props.onPress;
  await pressTab('Napravi nalog'); await act(async () => oldPress());
  expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
});

it('does not invoke an old phone command after fresh settings disable phone', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, phoneOtp: true }); await render(); await press('Telefon');
  const oldPress = button('Pošalji kod').props.onPress;
  mockRead.mockResolvedValue(emailOnly); await act(async () => mockForeground('active'));
  expect(text()).toContain('Prijava telefonom trenutno nije dostupna.');
  await act(async () => oldPress()); expect(mockAuth.sendPhoneOtp).not.toHaveBeenCalled();
  await press('Nazad na prijavu'); expect(button('Prijavi se')).toBeDefined();
});

it('serializes SMS verify and resend through the same command boundary', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, phoneOtp: true }); await render(); await press('Telefon');
  await fill('Broj telefona', '+381601234567'); await press('Pošalji kod'); await fill('Kod', '012345');
  const pending = deferred<void>(); mockAuth.verifyPhoneOtp.mockReturnValueOnce(pending.promise);
  await act(async () => { button('Potvrdi kod').props.onPress(); button('Pošalji novi kod').props.onPress(); });
  expect(mockAuth.verifyPhoneOtp).toHaveBeenCalledTimes(1); expect(mockAuth.sendPhoneOtp).toHaveBeenCalledTimes(1);
  await act(async () => pending.reject(new Error('Kod nije prihvaćen.')));
  expect(text()).toContain('Kod nije prihvaćen.'); await press('Pošalji novi kod');
  expect(mockAuth.sendPhoneOtp).toHaveBeenCalledTimes(2);
});

it('opens a direct auth destination without an intro and submits through the existing service', async () => {
  mockParams = { form: 'login' };
  await act(async () => { tree = create(<AuthScreen />); });
  expect(tree.root.findAllByType('Hero' as React.ElementType)).toHaveLength(0);
  await fill('Email', 'ana@example.test');
  await fill('Lozinka', 'password');
  await press('Prijavi se');
  expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@example.test', password: 'password' });
});

// The sentence the entry's choice stays as (N2): what the person does, never the names of the engine's two sides.
const sentenceOf = (intent: string) => intent === 'REQUESTER' ? 'Tražiš pomoć' : 'Uskačeš';
it.each([['onRequester', 'REQUESTER'], ['onWorker', 'WORKER']])('prepares %s once before opening Auth, on creating an account, with the choice as one sentence', async (action, intent) => {
  await act(async () => { tree = create(<AuthScreen />); });
  const pending = deferred<void>(); mockPrepare.mockReturnValueOnce(pending.promise);
  const press = tree.root.findByType('Hero' as React.ElementType).props[action];
  await act(async () => { press(); press(); });
  expect(mockPrepare).toHaveBeenCalledTimes(1);
  expect(mockPrepare).toHaveBeenCalledWith(intent, expect.any(Function));
  expect(mockPrepare.mock.calls[0][1]()).toBe(true);
  expect(host('TextInput')).toHaveLength(0);
  expect(text()).not.toContain(sentenceOf(intent));
  await act(async () => pending.resolve());
  expect(input('Email')).toBeDefined();
  // A person who has chosen lands directly on making the account: the five fields, the switch on its first way.
  expect(host('TextInput').map(node => node.props.accessibilityLabel)).toEqual(signUpFields);
  expect(tab('Napravi nalog').props.accessibilityState).toMatchObject({ selected: true });
  expect(textOf(intentLine()!)).toContain(sentenceOf(intent));
  expect(intentLine()!.props.accessibilityLabel).toBe(`${sentenceOf(intent)}. Promeni`);
  // The engine's names for the two sides, and the entry's own door names, are not said again.
  for (const word of ['Naručilac', 'Uskočer', 'Objavi zadatak', 'Uskoči i zaradi']) expect(text()).not.toContain(word);
});

it('changes the choice with "Promeni": the same write of the other intent, and nothing typed or opened is disturbed', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onRequester());
  await fill('Ime', 'Ana'); await pressTab('Prijava');
  expect(textOf(intentLine()!)).toContain('Tražiš pomoć');
  mockPrepare.mockClear();
  await act(async () => intentLine()!.props.onPress());
  expect(mockPrepare.mock.calls.map(call => call[0])).toEqual(['WORKER']);
  expect(textOf(intentLine()!)).toContain('Uskačeš'); expect(text()).not.toContain('Tražiš pomoć');
  // Still the sign-in way the person had switched to, still the same sheet, and what was typed is still there.
  expect(tab('Prijava').props.accessibilityState).toMatchObject({ selected: true });
  await pressTab('Napravi nalog');
  expect(input('Ime').props.value).toBe('Ana');
  await act(async () => intentLine()!.props.onPress());
  expect(mockPrepare.mock.calls.map(call => call[0])).toEqual(['WORKER', 'REQUESTER']);
  expect(textOf(intentLine()!)).toContain('Tražiš pomoć');
});

it('keeps the chosen sentence when the change cannot be saved, and says so on the form', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  mockPrepare.mockRejectedValueOnce(new Error('storage offline'));
  await act(async () => intentLine()!.props.onPress());
  expect(textOf(intentLine()!)).toContain('Uskačeš');
  expect(host('Text').find(node => node.props.accessibilityRole === 'alert' && textOf(node).includes('Izbor nije sačuvan'))).toBeDefined();
});

it('does not change the choice while a command runs', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onRequester());
  for (const [label, value] of signUpValues) await fill(label, value);
  const pending = deferred<{ hasSession: boolean }>(); mockAuth.signUp.mockReturnValueOnce(pending.promise);
  await act(async () => { button('Napravi nalog').props.onPress(); });
  expect(intentLine()!.props.disabled).toBe(true);
  mockPrepare.mockClear();
  await act(async () => intentLine()!.props.onPress());
  expect(mockPrepare).not.toHaveBeenCalled();
  await act(async () => pending.resolve({ hasSession: false }));
});

it('retains the entry and exposes retry after failed intent storage', async () => {
  mockPrepare.mockRejectedValueOnce(new Error('storage offline'));
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  expect(tree.root.findByType('Hero' as React.ElementType).props.error).toContain('Pokušaj ponovo');
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  expect(input('Email')).toBeDefined();
});
it.each(['cancel', 'blur', 'route', 'unmount'])('does not open Auth or retain a selection when %s supersedes a pending prepare', async boundary => {
  const pending = deferred<void>(); mockPrepare.mockReturnValueOnce(pending.promise);
  await act(async () => { tree = create(<AuthScreen />); });
  let active = true;
  await act(async () => { tree.root.findByType('Hero' as React.ElementType).props.onRequester({ isCurrent: () => active }); });
  const current = mockPrepare.mock.calls[0][1]; expect(current()).toBe(true);
  expect(host('TextInput')).toHaveLength(0); expect(mockRead).not.toHaveBeenCalled();
  await act(async () => {
    if (boundary === 'cancel') active = false;
    else if (boundary === 'blur') mockBlur?.();
    else if (boundary === 'unmount') tree.unmount();
    else { mockParams = { form: 'recovery' }; tree.update(<AuthScreen />); }
  });
  expect(current()).toBe(false);
  await act(async () => pending.resolve());
  expect(current()).toBe(false);
  expect(mockRead).not.toHaveBeenCalled();
  if (boundary !== 'unmount') {
    expect(host('TextInput')).toHaveLength(0);
    expect(tree.root.findByType('Hero' as React.ElementType).props.error).toBeNull();
  }
});
it('rejects a retained pre-blur callback after refocus while allowing a fresh choice', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  const stale = tree.root.findByType('Hero' as React.ElementType).props.onRequester;
  await act(async () => mockBlur?.());
  await act(async () => { mockBlur = mockFocus() || undefined; });
  await act(async () => stale()); expect(mockPrepare).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  expect(mockPrepare).toHaveBeenCalledTimes(1); expect(input('Email')).toBeDefined();
});
it('ignores a cancelled selection storage error and permits a fresh retry without opening Auth early', async () => {
  const pending = deferred<void>(); mockPrepare.mockReturnValueOnce(pending.promise);
  await act(async () => { tree = create(<AuthScreen />); });
  let active = true;
  await act(async () => { tree.root.findByType('Hero' as React.ElementType).props.onWorker({ isCurrent: () => active }); });
  active = false; await act(async () => pending.reject(new Error('late storage failure')));
  expect(tree.root.findByType('Hero' as React.ElementType).props.error).toBeNull(); expect(host('TextInput')).toHaveLength(0);
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  expect(input('Email')).toBeDefined();
});

it('keeps prepared intent through both ways in and recovery but clears it for explicit plain sign-in or sign-up', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  expect(text()).toContain('Uskačeš');
  await pressTab('Prijava');
  expect(text()).toContain('Uskačeš');
  await press('Zaboravljena lozinka?');
  expect(text()).not.toContain('BEZBEDAN POVRATAK'); expect(intentLine()).toBeUndefined();
  await press('Nazad na prijavu');
  expect(text()).toContain('Uskačeš');
  await act(async () => host('Pressable').find(node => node.props.accessibilityLabel === 'Nazad')!.props.onPress());
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onSignIn());
  expect(text()).not.toContain('JEDAN NALOG · OBE MOGUĆNOSTI');
  expect(intentLine()).toBeUndefined(); expect(text()).not.toContain('Uskačeš');
  // The entry's own pill for making an account is a plain one as well: no choice was made, so none is echoed.
  await act(async () => host('Pressable').find(node => node.props.accessibilityLabel === 'Nazad')!.props.onPress());
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onSignUp());
  expect(tab('Napravi nalog').props.accessibilityState).toMatchObject({ selected: true });
  expect(intentLine()).toBeUndefined();
});

it('does not carry a prepared label across an account incarnation change', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onRequester());
  expect(text()).toContain('Tražiš pomoć');
  mockSession = { user: { id: 'other-account' }, accountRevision: 1 };
  await act(async () => tree.update(<AuthScreen />));
  expect(text()).not.toContain('Tražiš pomoć');
  mockSession = { user: null, accountRevision: 2 };
  await act(async () => tree.update(<AuthScreen />));
  expect(text()).not.toContain('Tražiš pomoć'); expect(intentLine()).toBeUndefined();
});

it('does not accept a late prepare or show its label after signed-out account ABA', async () => {
  const pending = deferred<void>(); mockPrepare.mockReturnValueOnce(pending.promise);
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => { tree.root.findByType('Hero' as React.ElementType).props.onWorker(); });
  mockSession = { user: null, accountRevision: 2 };
  await act(async () => pending.resolve());
  expect(tree.root.findAllByType('Hero' as React.ElementType)).toHaveLength(1);
  expect(host('TextInput')).toHaveLength(0);
  expect(text()).not.toContain('Uskačeš');
});

it('uses neutral presentation for a new direct Auth destination after a prepared selection', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  mockParams = { form: 'login' };
  await act(async () => tree.update(<AuthScreen />));
  expect(text()).not.toContain('JEDAN NALOG · OBE MOGUĆNOSTI');
  expect(text()).not.toContain('Uskačeš'); expect(intentLine()).toBeUndefined();
  expect(tab('Prijava').props.accessibilityState).toMatchObject({ selected: true });
  expect(mockPrepare).toHaveBeenCalledTimes(1);
});

// One step back, for the arrow and the phone's Back (N2): the form closes to the entry from either way in, because the two
// are one screen; any other step returns to the sign-in form first.
describe('Back on the one screen', () => {
  const arrow = () => host('Pressable').find(node => node.props.accessibilityLabel === 'Nazad')!;
  it('closes the sheet to the entry from the signing-up way and from the signing-in way, with the arrow and with the phone Back', async () => {
    await act(async () => { tree = create(<AuthScreen />); });
    await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onSignUp());
    expect(host('TextInput')).toHaveLength(5);
    await act(async () => arrow().props.onPress());
    expect(host('TextInput')).toHaveLength(0);
    await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onSignIn());
    expect(host('TextInput')).toHaveLength(2);
    expect(mockBack).toBeDefined();
    await act(async () => { expect(mockBack!()).toBe(true); });
    expect(host('TextInput')).toHaveLength(0);
    expect(mockBack).toBeUndefined();
  });
  it('steps from a later stage back to the sign-in form, and only then to the entry', async () => {
    mockRead.mockResolvedValue({ ...emailOnly, phoneOtp: true });
    await render(); await press('Telefon');
    expect(button('Pošalji kod')).toBeDefined();
    await act(async () => arrow().props.onPress());
    expect(input('Email')).toBeDefined(); expect(button('Pošalji kod')).toBeUndefined();
    await act(async () => { mockBack!(); });
    expect(host('TextInput')).toHaveLength(0);
  });
});


it('submits recovery only on user action and reports accepted rather than delivered email', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, passwordRecovery: true });
  await render(); await fill('Email', 'ana@example.test');
  await press('Zaboravljena lozinka?');
  expect(mockAuth.requestPasswordRecovery).not.toHaveBeenCalled();
  expect(host('TextInput')).toHaveLength(1);
  await press('Pošalji link');
  expect(mockAuth.requestPasswordRecovery.mock.calls).toEqual([['ana@example.test']]);
  expect(text()).toContain('Ako nalog sa ovim emailom postoji');
  expect(text()).not.toContain('Poslali smo');
  expect(button('Nazad na prijavu')).toBeDefined();
});

it('prevents duplicate recovery sends and keeps a failed request editable', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, passwordRecovery: true });
  const waiting = deferred<void>(); mockAuth.requestPasswordRecovery.mockReturnValue(waiting.promise);
  await render(); await press('Zaboravljena lozinka?'); await fill('Email', 'ana@example.test');
  const send = button('Pošalji link').props.onPress;
  await act(async () => { send(); send(); });
  expect(mockAuth.requestPasswordRecovery).toHaveBeenCalledTimes(1);
  expect(input('Email').props.editable).toBe(false);
  await act(async () => waiting.reject(new Error('Proveri email pre ponovnog pokušaja.')));
  expect(text()).toContain('Proveri email pre ponovnog pokušaja.');
  expect(input('Email').props.editable).toBe(true);
});

// Owner decision 2026-10-07, design proposal N3: signing in to a banned, blocked or closed account gets its own separate, clear
// message, not the generic sign-in error; the same on the phone way in, on the recovery request, and when the provider ended a
// session. It is a SCREEN of its own: one sentence, one way out, no sheet over the entry, no form and no bottom bar.
describe('a restricted account has a screen of its own', () => {
  const screens = () => tree.root.findAll(node => node.props.testID === 'restricted-account-screen' && typeof node.type === 'string');
  const panel = () => tree.root.findAll(node => node.props.testID === 'restricted-account-panel' && typeof node.type === 'string');
  const shown = () => textOf(screens()[0]);
  const withSupportAddress = async (run: () => Promise<void>) => {
    process.env.EXPO_PUBLIC_SUPPORT_EMAIL = 'podrska@example.test';
    try { await run(); } finally { delete process.env.EXPO_PUBLIC_SUPPORT_EMAIL; }
  };
  function expectScreen() {
    expect(screens()).toHaveLength(1); expect(panel()).toHaveLength(1);
    // The heading and ONE sentence; the sentence about writing to support is not said, because there is nothing to write with.
    expect(screens()[0].findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'header').map(textOf)).toEqual([restrictedAccountCopy.title]);
    expect(shown()).toContain(restrictedAccountCopy.body);
    expect(shown()).not.toContain(restrictedAccountCopy.support);
    // Calm, not an error line: nothing is announced as an alert, there is no form, and the sheet beneath is not read or reachable.
    expect(host('Text').filter(node => node.props.accessibilityRole === 'alert')).toHaveLength(0);
    expect(host('TextInput')).toHaveLength(0);
    expect(button('Prijavi se')).toBeUndefined();
    expect(button('Zaboravljena lozinka?')).toBeUndefined();
    expect(tree.root.findAll(node => String(node.type) === 'View' && node.props.accessibilityElementsHidden === true
      && node.props.importantForAccessibility === 'no-hide-descendants')).not.toHaveLength(0);
    expect(screens()[0].props.accessibilityViewIsModal).toBe(true);
    // One green command and nothing to sign out of: nobody is signed in on these screens.
    expect(screens()[0].findAll(node => String(node.type) === 'Pressable').map(textOf)).toEqual(['Nazad na prijavu']);
    expect(button('Odjavi se')).toBeUndefined(); expect(button('Obrati se podršci')).toBeUndefined();
  }

  it('after an email sign-in the provider refused as restricted, with the password cleared and one way back to the same email', async () => {
    await render(); await fill('Email', 'ana@example.test'); await fill('Lozinka', 'password');
    mockAuth.signInWithPassword.mockRejectedValueOnce(new SignInFailureError('RESTRICTED_ACCOUNT'));
    await press('Prijavi se');
    expectScreen();
    expect(shown()).not.toContain(SIGN_IN_FAILURE_COPY.BAD_CREDENTIALS);
    await press('Nazad na prijavu');
    expect(screens()).toHaveLength(0); expect(panel()).toHaveLength(0);
    expect(input('Email').props.value).toBe('ana@example.test');
    expect(input('Lozinka').props.value).toBe('');
    await fill('Lozinka', 'password'); await press('Prijavi se');
    expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(2);
  });

  it.each(['send', 'verify'] as const)('after a phone %s the provider refused as restricted', async step => {
    mockRead.mockResolvedValue({ ...emailOnly, phoneOtp: true }); await render(); await press('Telefon');
    await fill('Broj telefona', '+381601234567');
    if (step === 'send') mockAuth.sendPhoneOtp.mockRejectedValueOnce(new SignInFailureError('RESTRICTED_ACCOUNT'));
    await press('Pošalji kod');
    if (step === 'verify') {
      await fill('Kod', '012345');
      mockAuth.verifyPhoneOtp.mockRejectedValueOnce(new SignInFailureError('RESTRICTED_ACCOUNT'));
      await press('Potvrdi kod');
    }
    expectScreen();
    await press('Nazad na prijavu');
    expect(button('Prijavi se')).toBeDefined();
  });

  it('after a password-recovery request the provider refused as restricted', async () => {
    mockRead.mockResolvedValue({ ...emailOnly, passwordRecovery: true });
    await render(); await fill('Email', 'ana@example.test'); await press('Zaboravljena lozinka?');
    mockAuth.requestPasswordRecovery.mockRejectedValueOnce(new PasswordRecoveryError('RESTRICTED_ACCOUNT'));
    await press('Pošalji link');
    expectScreen();
    expect(text()).not.toContain('Ako nalog sa ovim emailom postoji');
  });

  it('opens on its own, once, when the provider ended the session because the account is restricted', async () => {
    mockSession = { ...mockSession, signOutReason: { kind: 'RESTRICTED_ACCOUNT', revision: 3 } };
    await act(async () => { tree = create(<AuthScreen />); });
    expectScreen();
    expect(mockConfirmReason.mock.calls).toEqual([[3]]);
    // The V4.9 entry stays mounted beneath the screen (not read, not reachable), so going back finds it as it was.
    expect(tree.root.findAllByType('Hero' as React.ElementType)).toHaveLength(1);
    mockSession = { ...mockSession, signOutReason: null };
    await press('Nazad na prijavu');
    expect(button('Prijavi se')).toBeDefined();
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('is left with the phone Back as well, to the sign-in form', async () => {
    mockSession = { ...mockSession, signOutReason: { kind: 'RESTRICTED_ACCOUNT', revision: 4 } };
    await act(async () => { tree = create(<AuthScreen />); });
    expectScreen();
    mockSession = { ...mockSession, signOutReason: null };
    await act(async () => { expect(mockBack!()).toBe(true); });
    expect(screens()).toHaveLength(0);
    expect(button('Prijavi se')).toBeDefined();
  });

  it('draws "Obrati se podršci" as the one green command, and says the sentence about it, only when the owner has given a public address', async () => {
    await withSupportAddress(async () => {
      mockSession = { ...mockSession, signOutReason: { kind: 'RESTRICTED_ACCOUNT', revision: 5 } };
      await act(async () => { tree = create(<AuthScreen />); });
      expect(shown()).toContain(`${restrictedAccountCopy.body} ${restrictedAccountCopy.support}`);
      expect(screens()[0].findAll(node => String(node.type) === 'Pressable').map(textOf)).toEqual(['Obrati se podršci', 'Nazad na prijavu']);
      await press('Obrati se podršci');
      expect(mockOpenUrl.mock.calls).toEqual([[`mailto:podrska@example.test?subject=${encodeURIComponent('USKOČI: ograničen nalog')}`]]);
      expect(shown()).not.toContain(restrictedAccountCopy.supportFailed);
      // No mail application: said calmly, and the command can be tried again.
      mockOpenUrl.mockRejectedValueOnce(new Error('no handler'));
      await press('Obrati se podršci');
      expect(shown()).toContain(restrictedAccountCopy.supportFailed);
      await press('Obrati se podršci');
      expect(shown()).not.toContain(restrictedAccountCopy.supportFailed);
      expect(mockOpenUrl).toHaveBeenCalledTimes(3);
    });
  });

  it('every sentence is plain Serbian in the "ti" voice, without gender, invented contact, reason or duration', () => {
    for (const sentence of [restrictedAccountCopy.title, restrictedAccountCopy.body, restrictedAccountCopy.support, restrictedAccountCopy.supportFailed]) {
      expect(sentence).not.toMatch(/server|podršk|@|https?:|\d/i);
      expect(sentence).not.toMatch(/\b(si|sam|ste|bio|bila|uneo|unela|odjavljena)\b/i);
      expect(sentence).not.toMatch(/zbog|kršen|prekrš|dana|sati|nedelj|zauvek|trajno/i);
    }
    // The owner's own words, exactly.
    expect(`${restrictedAccountCopy.title}. ${restrictedAccountCopy.body} ${restrictedAccountCopy.support}`).toBe(
      'Pristup nalogu je ograničen. Trenutno ne možeš da koristiš obične funkcije aplikacije. Ako misliš da je u pitanju greška, javi nam se.');
    expect(restrictedAccountCopy.supportAction).toBe('Obrati se podršci');
  });
});

// F7, 2026-10-08. What is wrong is said under the field it is about, one sentence each, before anything is sent; the server's own
// answer is said under the form. Nothing here reaches the network.
describe('what is wrong is said under the field it is about', () => {
  /** The whole field: its label, its box and the one line under it. */
  const block = (label: string) => input(label).parent!.parent!;
  const alerts = () => host('Text').filter(node => node.props.accessibilityRole === 'alert').map(node => textOf(node));

  it('names each missing field of an account, sends nothing, and each message stands in its own field and nowhere else', async () => {
    await render(); await pressTab('Napravi nalog'); await press('Napravi nalog');
    const wanted: [string, string][] = [['Ime', 'Unesi ime.'], ['Prezime', 'Unesi prezime.'], ['Grad', 'Unesi grad.'], ['Email', 'Unesi email.'], ['Lozinka', 'Unesi lozinku.']];
    for (const [label, message] of wanted) expect(textOf(block(label))).toContain(message);
    expect([...alerts()].sort()).toEqual(wanted.map(([, message]) => message).sort());
    expect(mockAuth.signUp).not.toHaveBeenCalled();
  });

  it('says a wrong address and a short NEW password, each under its own field', async () => {
    await render(); await pressTab('Napravi nalog');
    for (const [label, value] of signUpValues) await fill(label, label === 'Email' ? 'ana@example' : label === 'Lozinka' ? 'abc' : value);
    await press('Napravi nalog');
    expect(textOf(block('Email'))).toContain('Unesi ispravnu email adresu.');
    expect(textOf(block('Lozinka'))).toContain('Lozinka mora imati najmanje 6 znakova.');
    expect(textOf(block('Ime'))).not.toContain('Unesi'); expect(mockAuth.signUp).not.toHaveBeenCalled();
  });

  it('says the length of a new password BEFORE it can be wrong, and asks for no length when signing in', async () => {
    await render();
    expect(textOf(block('Lozinka'))).not.toContain('Najmanje 6 znakova.');
    await fill('Email', 'ana@example.test'); await fill('Lozinka', 'abc'); await press('Prijavi se');
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@example.test', password: 'abc' });
    await pressTab('Napravi nalog');
    expect(textOf(block('Lozinka'))).toContain('Najmanje 6 znakova.');
  });

  it('forgets what was said about a field as soon as that field is edited, and about the form when the email or the password is', async () => {
    await render(); await press('Prijavi se');
    expect(textOf(block('Email'))).toContain('Unesi email.'); expect(textOf(block('Lozinka'))).toContain('Unesi lozinku.');
    await fill('Email', 'a');
    expect(textOf(block('Email'))).not.toContain('Unesi email.'); expect(textOf(block('Lozinka'))).toContain('Unesi lozinku.');
    await fill('Email', 'ana@example.test'); await fill('Lozinka', 'password');
    mockAuth.signInWithPassword.mockRejectedValueOnce(new SignInFailureError('BAD_CREDENTIALS')); await press('Prijavi se');
    expect(alerts()).toEqual([SIGN_IN_FAILURE_COPY.BAD_CREDENTIALS]);
    // The answer to the command stands under the form: it is not inside either field.
    expect(textOf(block('Email'))).not.toContain(SIGN_IN_FAILURE_COPY.BAD_CREDENTIALS); expect(textOf(block('Lozinka'))).not.toContain(SIGN_IN_FAILURE_COPY.BAD_CREDENTIALS);
    await fill('Lozinka', 'other'); expect(alerts()).toEqual([]);
  });
});

// Owner research R21 (2026-10-07): a sign-up that does not go through may be an account that is already there; an email that is not
// confirmed yet can be asked for again; a city typed carelessly is put right.
describe('the next step of a failure', () => {
  const GENERIC = 'Registracija trenutno nije uspela. Proveri podatke i pokušaj ponovo.';
  const fillAccount = async () => { for (const [label, value] of signUpValues) await fill(label, value); };

  it('offers to sign in after a sign-up that did not go through, and takes the person there with the email kept', async () => {
    mockAuth.signUp.mockRejectedValueOnce(new Error(GENERIC));
    await render(); await pressTab('Napravi nalog'); await fillAccount(); await press('Napravi nalog');
    expect(host('Text').filter(node => node.props.accessibilityRole === 'alert').map(node => textOf(node))).toEqual([GENERIC]);
    expect(text()).toContain('Možda već imaš nalog.');
    await press('Prijavi se');
    expect(tab('Prijava').props.accessibilityState).toMatchObject({ selected: true });
    expect(input('Email').props.value).toBe('ana@example.test');
    expect(text()).not.toContain(GENERIC); expect(text()).not.toContain('Možda već imaš nalog.');
  });

  it.each([RATE_LIMITED_COPY, PROVIDER_UNAVAILABLE_COPY])('does not blame an existing account when the provider only said "%s"', async message => {
    mockAuth.signUp.mockRejectedValueOnce(new Error(message));
    await render(); await pressTab('Napravi nalog'); await fillAccount(); await press('Napravi nalog');
    expect(text()).toContain(message); expect(text()).not.toContain('Možda već imaš nalog.');
  });

  it('offers to send the confirmation again when the email is not confirmed, sends it, and says it was sent', async () => {
    mockAuth.signInWithPassword.mockRejectedValueOnce(new SignInFailureError('EMAIL_NOT_CONFIRMED'));
    await render(); await fill('Email', 'ana@example.test'); await fill('Lozinka', 'password'); await press('Prijavi se');
    expect(button('Pošalji ponovo potvrdu')).toBeDefined();
    await press('Pošalji ponovo potvrdu');
    expect(mockAuth.resendSignupConfirmation).toHaveBeenCalledWith('ana@example.test');
    expect(text()).toContain('Ako email čeka potvrdu, stići će nova poruka.');
    expect(text()).not.toContain(SIGN_IN_FAILURE_COPY.EMAIL_NOT_CONFIRMED); expect(button('Pošalji ponovo potvrdu')).toBeUndefined();
  });

  it('offers nothing extra after a lost connection: the command and "Zaboravljena lozinka?" are already there', async () => {
    await render(); await fill('Email', 'ana@example.test'); await fill('Lozinka', 'password');
    mockAuth.signInWithPassword.mockRejectedValueOnce(new SignInFailureError('CONNECTION')); await press('Prijavi se');
    expect(button('Pošalji ponovo potvrdu')).toBeUndefined(); expect(text()).not.toContain('Možda već imaš nalog.');
    expect(button('Prijavi se')).toBeDefined(); expect(button('Zaboravljena lozinka?')).toBeDefined();
  });

  it('puts the city right when the person leaves the field, and keeps what was typed when it is already right', async () => {
    await render(); await pressTab('Napravi nalog');
    await fill('Grad', 'NovI SAD'); await act(async () => input('Grad').props.onBlur());
    expect(input('Grad').props.value).toBe('Novi Sad');
    await fill('Grad', 'Sremska Kamenica'); await act(async () => input('Grad').props.onBlur());
    expect(input('Grad').props.value).toBe('Sremska Kamenica');
  });

  it('sends the city put right even when the person never left the field', async () => {
    await render(); await pressTab('Napravi nalog');
    for (const [label, value] of signUpValues) await fill(label, label === 'Grad' ? 'NOVI SAD' : value);
    await press('Napravi nalog');
    expect(mockAuth.signUp.mock.calls[0][0]).toMatchObject({ city: 'Novi Sad' });
  });

  it('chains the fields with the keyboard: "next" goes on to the next field and "go" on the password sends the form', async () => {
    await render(); await fill('Email', 'ana@example.test'); await fill('Lozinka', 'password');
    expect(input('Email').props.returnKeyType).toBe('next'); expect(input('Lozinka').props.returnKeyType).toBe('go');
    await act(async () => input('Lozinka').props.onSubmitEditing());
    expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(1);
  });
});

// Owner, on the phone and on the emulator, 2026-10-07: with the keyboard up the "Lozinka" field vanished behind the pinned
// "Prijavi se". The sheet scrolls by exactly what hides the field that is being typed in (ui/auth/keyboardReveal).
describe('the field being typed in stays in view', () => {
  type Measure = (done: (...values: number[]) => void) => void;
  const createWithBoxes = async (scrollTo: jest.Mock, viewport: [number, number], boxes: Record<string, [number, number]>) => {
    await act(async () => { tree = create(<AuthScreen />, { createNodeMock: element => {
      const measure = (top: number, height: number): Measure => done => done(0, top, 361, height);
      if (element.type === 'ScrollView') return { scrollTo, measureInWindow: measure(viewport[0], viewport[1]) };
      const box = boxes[String((element.props as { testID?: string }).testID)];
      return box ? { measureInWindow: measure(box[0], box[1]) } : null;
    } }); });
    await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onSignIn());
  };

  it('scrolls the sheet by exactly what hides the field when it takes focus, and not at all when it is already in view', async () => {
    const scrollTo = jest.fn();
    // The visible part of the sheet is 300 tall from y=100 (the keyboard has shrunk it); the password field is below it.
    await createWithBoxes(scrollTo, [100, 300], { 'auth-field:Email': [150, 78], 'auth-field:Lozinka': [500, 78] });
    await act(async () => input('Email').props.onFocus());
    expect(scrollTo).not.toHaveBeenCalled();
    await act(async () => input('Lozinka').props.onFocus());
    // Its bottom is at 578, the visible part ends at 400, and 16 of air are kept: 194.
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 194, animated: true });
  });

  it('adds the distance to where the sheet is scrolled to, and looks again when the scroll area changes size', async () => {
    const scrollTo = jest.fn();
    await createWithBoxes(scrollTo, [100, 300], { 'auth-field:Lozinka': [500, 78] });
    const scroll = () => host('ScrollView')[0];
    await act(async () => scroll().props.onScroll({ nativeEvent: { contentOffset: { y: 40 } } }));
    await act(async () => input('Lozinka').props.onFocus());
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 234, animated: true });
    // The keyboard came up: the scroll area is a different size now, and the focused field is looked at again.
    scrollTo.mockClear();
    await act(async () => scroll().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 361, height: 300 } } }));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    // A field that let go of the focus is not followed any more.
    await act(async () => input('Lozinka').props.onBlur());
    scrollTo.mockClear();
    await act(async () => scroll().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 361, height: 300 } } }));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('keeps the green command in the foot, outside the scroll area, so it rises with the keyboard and never scrolls away', async () => {
    await render();
    const footer = host('View').find(node => node.props.testID === 'auth-footer')!;
    expect(footer.findAll(node => String(node.type) === 'Pressable').map(node => textOf(node).trim())).toEqual(['Prijavi se']);
    expect(host('ScrollView')[0].findAll(node => String(node.type) === 'Pressable' && textOf(node).trim() === 'Prijavi se')).toHaveLength(0);
  });
});

// A grey command always says why, in a line ABOVE it (the system foot's own `reason`; a line under the button read as the next thing,
// not as the cause). The server having email sign-in switched off is the one time the sign-in step's green command cannot be pressed.
describe('the green command that cannot be pressed says why', () => {
  it('is grey and says "Prijava emailom trenutno nije dostupna." above itself when the server has email sign-in switched off', async () => {
    mockRead.mockResolvedValue({ ...emailOnly, emailPassword: false, emailSignup: false });
    await render();
    expect(host('TextInput')).toHaveLength(0);
    const footer = host('View').find(node => node.props.testID === 'auth-footer')!;
    const inFoot = footer.findAll(() => true);
    const reason = inFoot.findIndex(node => node.props.testID === 'auth-footer-reason' && String(node.type) === 'Text');
    const command = inFoot.findIndex(node => String(node.type) === 'Pressable' && textOf(node).trim() === 'Prijavi se');
    expect(reason).toBeGreaterThanOrEqual(0); expect(command).toBeGreaterThan(reason);
    expect(textOf(inFoot[reason])).toBe('Prijava emailom trenutno nije dostupna.');
    expect(inFoot[command].props.accessibilityState).toMatchObject({ disabled: true });
    // Said once: not a second time in the content, and nothing says that email is the only way in when it is the one that is off.
    expect(text().split('Prijava emailom trenutno nije dostupna.').length - 1).toBe(1);
    expect(text()).not.toContain('Za sada se ulazi email adresom i lozinkom.');
    // The reason is the sentence; what to do about it stands in the content, because nothing else on the screen can be pressed.
    expect(text()).toContain('Pokušaj ponovo malo kasnije.');
  });

  it('draws no reason, and a live green command, when nothing is missing', async () => {
    await render();
    const footer = host('View').find(node => node.props.testID === 'auth-footer')!;
    expect(footer.findAll(node => node.props.testID === 'auth-footer-reason')).toHaveLength(0);
    expect(button('Prijavi se').props.accessibilityState).toMatchObject({ disabled: false });
  });
});

// What the person asked for must be seen: the answer to a command can appear below the part of the form that is in view (a refused
// sign-up stands under the password, which is the last of five fields), so it is brought into view the way a focused field is.
describe('the answer to a command is brought into view when it appears', () => {
  const measure = (top: number, height: number) => (done: (...values: number[]) => void) => done(0, top, 361, height);
  const mount = async (scrollTo: jest.Mock) => {
    await act(async () => { tree = create(<AuthScreen />, { createNodeMock: element => {
      const id = String((element.props as { testID?: string }).testID);
      if (element.type === 'ScrollView') return { scrollTo, measureInWindow: measure(100, 300) };
      if (id === 'auth-failure') return { measureInWindow: measure(500, 60) };
      if (id === 'auth-notice') return { measureInWindow: measure(20, 60) };
      return null;
    } }); });
    await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onSignIn());
  };

  it('scrolls down to a failure that stands below the visible part, and does not scroll for one that is in view', async () => {
    const scrollTo = jest.fn();
    await mount(scrollTo);
    await fill('Email', 'ana@example.test'); await fill('Lozinka', 'password');
    mockAuth.signInWithPassword.mockRejectedValueOnce(new SignInFailureError('BAD_CREDENTIALS'));
    await press('Prijavi se');
    // Its bottom is at 560, the visible part ends at 400, and 16 of air are kept.
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 176, animated: true });
  });

  it('scrolls back up to the confirmation that was sent again, which stands above the visible part', async () => {
    const scrollTo = jest.fn();
    await mount(scrollTo);
    mockAuth.signInWithPassword.mockRejectedValueOnce(new SignInFailureError('EMAIL_NOT_CONFIRMED'));
    await fill('Email', 'ana@example.test'); await fill('Lozinka', 'password'); await press('Prijavi se');
    scrollTo.mockClear();
    await press('Pošalji ponovo potvrdu');
    // The notice (20..80) is above the top of the visible part (100): it is 96 dp up, and the start of the scroll area is as far as that goes.
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: true });
  });
});


describe('signup email return in the real Auth form', () => {
  it('retains a callback while Auth is covered and shows it when Router focuses Auth', async () => {
    await render();
    await act(async () => mockBlur?.());
    await act(async () => signupConfirmationIntent.publish('LINK_UNAVAILABLE'));
    expect(signupConfirmationIntent.snapshot()?.kind).toBe('LINK_UNAVAILABLE');
    expect(button('Pošalji novu potvrdu')).toBeUndefined();
    await act(async () => { mockBlur = mockFocus() || undefined; });
    expect(text()).toContain('Ovaj link više nije važeći.');
    expect(button('Pošalji novu potvrdu')).toBeDefined();
    expect(signupConfirmationIntent.snapshot()).toBeNull();
  });

  it('an expired callback offers a working resend after a previous auto-confirm signup, and reveals each warm return', async () => {
    const scrollTo = jest.fn();
    mockRead.mockResolvedValue({ ...emailOnly, emailConfirmationRequired: false });
    mockParams = { form: 'login' };
    await act(async () => { tree = create(<AuthScreen />, { createNodeMock: element =>
      element.type === 'ScrollView' ? { scrollTo } : null }); });
    await pressTab('Napravi nalog');
    for (const [label, value] of signUpValues) await fill(label, value);
    await press('Napravi nalog');
    await act(async () => signupConfirmationIntent.publish('LINK_UNAVAILABLE'));
    scrollTo.mockClear();
    // Same route and same category still need to reveal the new link's result.
    await act(async () => signupConfirmationIntent.publish('LINK_UNAVAILABLE'));
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
    await press('Pošalji novu potvrdu');
    expect(mockAuth.resendSignupConfirmation).toHaveBeenCalledWith('ana@example.test');
    expect(text()).toContain('Ako email čeka potvrdu, stići će nova poruka.');
  });

  it('a warm callback leaves Proveri email even when the route form has not changed', async () => {
    mockParams = { form: 'login' };
    await act(async () => { tree = create(<AuthScreen />); }); await pressTab('Napravi nalog');
    for (const [label, value] of signUpValues) await fill(label, value);
    await press('Napravi nalog');
    expect(text()).toContain('Proveri email');
    await act(async () => signupConfirmationIntent.publish('RETURNED'));
    expect(button('Prijavi se')).toBeDefined();
    expect(input('Email').props.value).toBe('ana@example.test');
    expect(text()).toContain('Nastavi prijavu svojim emailom i lozinkom.');
    expect(text()).not.toContain('Email je potvrđen');
    expect(signupConfirmationIntent.snapshot()).toBeNull();
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('cold expired callback can resend with just a valid email, preserves CTA while typing and serializes taps', async () => {
    await render();
    await act(async () => signupConfirmationIntent.publish('LINK_UNAVAILABLE'));
    expect(text()).toContain('Ovaj link više nije važeći.');
    await press('Pošalji novu potvrdu');
    expect(mockAuth.resendSignupConfirmation).not.toHaveBeenCalled();
    expect(input('Email').props.accessibilityLabel).toBe('Email');
    await fill('Email', 'ana@example.test');
    expect(button('Pošalji novu potvrdu')).toBeDefined();
    const pending = deferred<void>(); mockAuth.resendSignupConfirmation.mockReturnValueOnce(pending.promise);
    const send = button('Pošalji novu potvrdu').props.onPress;
    await act(async () => { send(); send(); });
    expect(mockAuth.resendSignupConfirmation).toHaveBeenCalledTimes(1);
    expect(input('Lozinka').props.value).toBe('');
    await act(async () => pending.resolve());
    expect(text()).toContain('Ako email čeka potvrdu, stići će nova poruka.');
    expect(button('Pošalji novu potvrdu')).toBeUndefined();
  });

  it('does not interrupt or replay navigation over an in-flight signup', async () => {
    await render(); await pressTab('Napravi nalog');
    for (const [label, value] of signUpValues) await fill(label, value);
    const pending = deferred<{ hasSession: boolean }>(); mockAuth.signUp.mockReturnValueOnce(pending.promise);
    await act(async () => { button('Napravi nalog').props.onPress(); });
    await act(async () => signupConfirmationIntent.publish('RETURNED'));
    expect(host('TextInput')).toHaveLength(5);
    await act(async () => pending.resolve({ hasSession: false }));
    expect(text()).toContain('Proveri email');
    expect(signupConfirmationIntent.snapshot()).toBeNull();
  });

  it('manual form change dismisses the callback; a new callback is a new event', async () => {
    await render();
    await act(async () => signupConfirmationIntent.publish('INVALID_LINK'));
    expect(button('Pošalji novu potvrdu')).toBeDefined();
    await pressTab('Napravi nalog');
    expect(button('Pošalji novu potvrdu')).toBeUndefined();
    await act(async () => signupConfirmationIntent.publish('INVALID_LINK'));
    expect(button('Prijavi se')).toBeDefined(); expect(button('Pošalji novu potvrdu')).toBeDefined();
  });
});
