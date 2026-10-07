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
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return { addEventListener: (_: unknown, cb: typeof mockForeground) => {
      mockForeground = cb; return { remove: jest.fn() };
    } };
    return ['View', 'ScrollView', 'ActivityIndicator', 'Pressable', 'Text', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' },
  Easing: { bezier: () => undefined }, interpolate: () => 0, useAnimatedStyle: () => ({}),
  useSharedValue: () => ({ value: 0 }), withTiming: (value: unknown) => value }));
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
import { SIGN_IN_FAILURE_COPY, SignInFailureError, type SignInFailureClass } from '../authFailureClasses';
import { PasswordRecoveryError } from '../../contracts/passwordRecovery';
import { restrictedAccountCopy } from '../../ui/auth/RestrictedAccountPanel';

const emailOnly = { emailPassword: true, emailSignup: true, phoneOtp: false,
  emailConfirmationRequired: true, passwordRecovery: false };
let tree: ReactTestRenderer;
const host = (type: string) => tree.root.findAll(node => node.type === type);
const textOf = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : textOf(child)).join(' ');
const text = () => textOf(tree.root);
const button = (label: string) => host('Pressable').find(node => textOf(node).trim() === label)!;
const input = (placeholder: string) => host('TextInput').find(node => node.props.placeholder === placeholder)!;
async function press(label: string) { await act(async () => button(label).props.onPress()); }
async function fill(placeholder: string, value: string) { await act(async () => input(placeholder).props.onChangeText(value)); }
async function render() {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onSignIn());
}
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  jest.clearAllMocks(); mockPrepare.mockResolvedValue(undefined); mockParams = {}; mockRead.mockResolvedValue(emailOnly); mockSession = { user: null, accountRevision: 0, signOutReason: null };
  for (const method of Object.values(mockAuth)) method.mockResolvedValue(undefined);
  mockAuth.signUp.mockResolvedValue({ hasSession: false });
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('keeps email functional and shows no way in that does not work', async () => {
  // Owner decision, 2026-09-18. Google and Apple wait on an OAuth client that server settings alone
  // cannot make ready, and Telefon appears only when the server says it is on. Three dead buttons
  // under "Drugi načini prijave" read as an app that is broken rather than one that is early.
  await render();
  expect(input('ime@primer.rs')).toBeDefined(); expect(button('Prijavi se')).toBeDefined();
  expect(button('Napravi nalog').props.accessibilityRole).toBe('button');
  expect(text()).toContain('JEDAN NALOG · OBE MOGUĆNOSTI');
  expect(text()).not.toContain('OBJAVI ZADATAK · ISTI NALOG');
  expect(text()).not.toContain('USKOČI I ZARADI · ISTI NALOG');
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
  expect(host('TextInput').map(node => node.props.accessibilityLabel)).toEqual(['Ime', 'Prezime', 'Grad', 'Email', 'Lozinka', 'Potvrdi lozinku']);
  expect(button('Napravi nalog')).toBeDefined();
  expect(Object.values(mockAuth).every(command => command.mock.calls.length === 0)).toBe(true);
  expect(mockPrepare).not.toHaveBeenCalled();
});

it('uses the flatter signup stage while retaining all real fields and the explicit primary command', async () => {
  await render();
  const heading = (value: string) => host('Text').find(node => node.props.accessibilityRole === 'header' && textOf(node) === value)!;
  // The two compositions are different sizes from the one scale, not two hand-picked numbers.
  expect(StyleSheet.flatten(heading('Zdravo.').props.style)).toMatchObject(type.hero);
  await press('Napravi nalog');
  expect(StyleSheet.flatten(heading('Napravi nalog').props.style)).toMatchObject(type.pageTitle);
  expect(type.pageTitle.fontSize).toBeLessThan(type.hero.fontSize);
  expect(host('TextInput').map(node => node.props.accessibilityLabel)).toEqual(['Ime', 'Prezime', 'Grad', 'Email', 'Lozinka', 'Potvrdi lozinku']);
  const form = host('View').find(node => node.findAllByType('TextInput' as React.ElementType).length === 6 && StyleSheet.flatten(node.props.style)?.borderBottomWidth === 1)!;
  expect(StyleSheet.flatten(form.props.style)).toMatchObject({ backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0 });
  // Deep read 8.2: no tick for documents that are not published; the screen says so instead.
  expect(host('Pressable').filter(node => node.props.accessibilityRole === 'checkbox')).toHaveLength(0);
  expect(text()).toContain('Ovo je test verzija. Uslovi korišćenja i Politika privatnosti biće objavljeni pre javnog pokretanja.');
  expect(button('Napravi nalog')).toBeDefined();
  expect(text()).not.toContain('Korak 1 od 3');
  expect(mockAuth.signUp).not.toHaveBeenCalled();
  await press('Već imaš nalog? Prijavi se');
  expect(StyleSheet.flatten(heading('Zdravo.').props.style).fontSize).toBe(type.hero.fontSize);
});

it('keeps an empty password submission local and immediately editable', async () => {
  await render(); await press('Prijavi se');
  expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  expect(text()).toContain('Unesi email i lozinku.');
  expect(input('ime@primer.rs').props.editable).toBe(true);
});

// EX-07 S02: the screen shows whatever message the Auth boundary chose, with no wiring of its own; the recovery that
// the message names (retry, the existing "Zaboravljena lozinka?") is already on the form, the email is kept, and the
// next attempt is allowed.
// A restricted account is not a retryable form error any more: it has its own panel (owner decision 2026-10-07, below).
it.each((Object.keys(SIGN_IN_FAILURE_COPY) as SignInFailureClass[]).filter(item => item !== 'RESTRICTED_ACCOUNT'))('a %s sign-in failure shows its own message and leaves the form retryable', async failureClass => {
  await render(); await fill('ime@primer.rs', 'ana@example.test'); await fill('Unesi lozinku', 'password');
  mockAuth.signInWithPassword.mockRejectedValueOnce(new SignInFailureError(failureClass));
  await press('Prijavi se');
  const alert = () => host('Text').find(node => node.props.accessibilityRole === 'alert');
  expect(textOf(alert()!)).toBe(SIGN_IN_FAILURE_COPY[failureClass]);
  expect(input('ime@primer.rs').props.value).toBe('ana@example.test');
  expect(host('TextInput').every(node => node.props.editable === true)).toBe(true);
  expect(button('Zaboravljena lozinka?')).toBeDefined();
  await press('Prijavi se');
  expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(2);
  expect(alert()).toBeUndefined();
});

it('hides a revealed password when switching form mode, preserving the entered value without submitting', async () => {
  await render(); await fill('Unesi lozinku', 'local-dummy-value');
  const loginScroll = host('ScrollView')[0];
  const toggle = () => host('Pressable').find(node => node.props.accessibilityLabel === 'Prikaži lozinku')!;
  await act(async () => toggle().props.onPress());
  expect(input('Unesi lozinku').props.secureTextEntry).toBe(false);
  await press('Napravi nalog');
  const signupScroll = host('ScrollView')[0];
  // Each form starts at its own top; the old login offset must not hide signup
  // fields at200% text size. Ordinary editing stays in the same scroll surface.
  expect(signupScroll).not.toBe(loginScroll);
  expect(button('Već imaš nalog? Prijavi se').props.accessibilityRole).toBe('button');
  expect(button('Prijavi se')).toBeUndefined();
  expect(host('Pressable').some(node => node.props.accessibilityRole === 'tab')).toBe(false);
  expect(input('Unesi lozinku').props.value).toBe('local-dummy-value');
  expect(input('Unesi lozinku').props.secureTextEntry).toBe(true);
  await act(async () => toggle().props.onPress());
  expect(host('ScrollView')[0]).toBe(signupScroll);
  await press('Već imaš nalog? Prijavi se');
  expect(host('ScrollView')[0]).not.toBe(signupScroll);
  expect(input('Unesi lozinku').props.secureTextEntry).toBe(true);
  expect(Object.values(mockAuth).every(command => command.mock.calls.length === 0)).toBe(true);
});

it('shows loading/error/retry before enabling a form and preserves entered credentials across a settings retry', async () => {
  const pending = deferred<unknown>(); mockRead.mockReturnValueOnce(pending.promise);
  await render(); expect(text()).toContain('Proveravamo dostupne'); expect(host('TextInput')).toHaveLength(0);
  await act(async () => pending.reject(new Error('offline')));
  expect(text()).toContain('Ne možemo da proverimo');
  await press('Pokušaj ponovo'); await fill('ime@primer.rs', 'ana@example.test');
  await act(async () => mockForeground('active'));
  expect(input('ime@primer.rs').props.value).toBe('ana@example.test');
});

it('does not offer signup when disabled, while existing email login remains available', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, emailSignup: false });
  await render(); expect(button('Napravi nalog')).toBeUndefined(); expect(button('Prijavi se')).toBeDefined();
  expect(text()).toContain('Otvaranje novih naloga trenutno nije dostupno.');
});

it('gives an explicit route back if signup is disabled while the signup form is open', async () => {
  await render(); await press('Napravi nalog');
  mockRead.mockResolvedValue({ ...emailOnly, emailSignup: false });
  await act(async () => mockForeground('active'));
  expect(button('Nazad na prijavu')).toBeDefined(); await press('Nazad na prijavu');
  expect(button('Prijavi se')).toBeDefined();
});

it('blocks duplicate signup, conflicting navigation and editing, then shows accurate confirmation with a real login Back', async () => {
  await render(); await press('Napravi nalog');
  for (const [placeholder, value] of [['Ime', 'Ana'], ['Prezime', 'Petrović'], ['Tvoj grad', 'Novi Sad'],
    ['ime@primer.rs', 'ana@example.test'], ['Unesi lozinku', 'password'], ['Ponovi lozinku', 'password']]) await fill(placeholder, value);
  const pending = deferred<{ hasSession: boolean }>(); mockAuth.signUp.mockReturnValueOnce(pending.promise);
  const submit = button('Napravi nalog').props.onPress;
  await act(async () => { submit(); submit(); });
  expect(mockAuth.signUp).toHaveBeenCalledTimes(1); expect(host('TextInput').every(node => node.props.editable === false)).toBe(true);
  const close = host('Pressable').find(node => node.props.accessibilityLabel === 'Nazad')!;
  expect(close.props.disabled).toBe(true); await act(async () => close.props.onPress());
  expect(host('TextInput')).toHaveLength(6);
  await act(async () => pending.resolve({ hasSession: false }));
  expect(text()).toContain('Ako je registracija prihvaćena'); expect(text()).not.toContain('Poslali smo Vam poruku');
  expect(button('Izmeni email')).toBeDefined(); await press('Nazad na prijavu');
  expect(button('Prijavi se')).toBeDefined(); expect(input('ime@primer.rs').props.value).toBe('ana@example.test');
});

it('offers an explicit confirmation resend after signup and serializes duplicate taps', async () => {
  await render(); await press('Napravi nalog');
  for (const [placeholder, value] of [['Ime', 'Ana'], ['Prezime', 'Petrović'], ['Tvoj grad', 'Novi Sad'],
    ['ime@primer.rs', 'ana@example.test'], ['Unesi lozinku', 'password'], ['Ponovi lozinku', 'password']]) await fill(placeholder, value);
  await press('Napravi nalog');
  expect(button('Pošalji ponovo potvrdu')).toBeDefined();
  const pending = deferred<void>(); mockAuth.resendSignupConfirmation.mockReturnValueOnce(pending.promise);
  const resend = button('Pošalji ponovo potvrdu').props.onPress;
  await act(async () => { resend(); resend(); });
  expect(mockAuth.resendSignupConfirmation).toHaveBeenCalledTimes(1);
  expect(mockAuth.resendSignupConfirmation).toHaveBeenCalledWith('ana@example.test');
  await act(async () => pending.resolve());
  expect(text()).toContain('Zahtev za novu potvrdu je prihvaćen.');
});

it('visibly gates unfinished recovery and never sends a broken reset link', async () => {
  await render(); await press('Zaboravljena lozinka?');
  expect(text()).toContain('Oporavak lozinke još nije dostupan');
  expect(host('Text').some(node => textOf(node) === 'Oporavak pristupa')).toBe(true);
  const title = host('Text').find(node => node.props.accessibilityRole === 'header' && textOf(node) === 'Vrati pristup nalogu.')!;
  expect(StyleSheet.flatten(title.props.style).fontSize).toBe(type.pageTitle.fontSize);
  expect(textOf(title)).not.toContain('\n');
  expect(host('TextInput')).toHaveLength(0); expect(button('Pošalji link')).toBeUndefined();
  expect(mockAuth.requestPasswordRecovery).not.toHaveBeenCalled();
  await press('Nazad na prijavu'); expect(button('Prijavi se')).toBeDefined();
});

it('does not promise a confirmation email when autoconfirm is enabled but signup returns no session', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, emailConfirmationRequired: false });
  await render(); await press('Napravi nalog');
  for (const [placeholder, value] of [['Ime', 'Ana'], ['Prezime', 'Petrović'], ['Tvoj grad', 'Novi Sad'],
    ['ime@primer.rs', 'ana@example.test'], ['Unesi lozinku', 'password'], ['Ponovi lozinku', 'password']]) await fill(placeholder, value);
  await press('Napravi nalog');
  expect(text()).toContain('Nalog još nije prijavljen.'); expect(text()).not.toContain('dobićete poruku');
  expect(button('Nazad na prijavu')).toBeDefined();
});

it('rejects an old login press after the form changes to signup', async () => {
  await render(); await fill('ime@primer.rs', 'ana@example.test'); await fill('Unesi lozinku', 'password');
  const oldPress = button('Prijavi se').props.onPress;
  await press('Napravi nalog'); await act(async () => oldPress());
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
  await fill('+381 6x xxx xxxx', '+381601234567'); await press('Pošalji kod'); await fill('123456', '012345');
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
  await fill('ime@primer.rs', 'ana@example.test');
  await fill('Unesi lozinku', 'password');
  await press('Prijavi se');
  expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@example.test', password: 'password' });
});

it.each([['onRequester', 'REQUESTER'], ['onWorker', 'WORKER']])('prepares %s once before opening Auth', async (action, intent) => {
  await act(async () => { tree = create(<AuthScreen />); });
  const pending = deferred<void>(); mockPrepare.mockReturnValueOnce(pending.promise);
  const press = tree.root.findByType('Hero' as React.ElementType).props[action];
  await act(async () => { press(); press(); });
  expect(mockPrepare).toHaveBeenCalledTimes(1);
  expect(mockPrepare).toHaveBeenCalledWith(intent, expect.any(Function));
  expect(mockPrepare.mock.calls[0][1]()).toBe(true);
  expect(host('TextInput')).toHaveLength(0);
  expect(text()).not.toContain('ISTI NALOG');
  await act(async () => pending.resolve());
  expect(input('ime@primer.rs')).toBeDefined();
  expect(text()).toContain(intent === 'REQUESTER' ? 'OBJAVI ZADATAK · ISTI NALOG' : 'USKOČI I ZARADI · ISTI NALOG');
  expect(text()).toContain(intent === 'REQUESTER' ? 'Nastavi do svojih Zadataka i Dogovora.' : 'Nastavi do Prijava, Zadataka i Dogovora.');
});

it('retains the entry and exposes retry after failed intent storage', async () => {
  mockPrepare.mockRejectedValueOnce(new Error('storage offline'));
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  expect(tree.root.findByType('Hero' as React.ElementType).props.error).toContain('Pokušaj ponovo');
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  expect(input('ime@primer.rs')).toBeDefined();
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
  expect(mockPrepare).toHaveBeenCalledTimes(1); expect(input('ime@primer.rs')).toBeDefined();
});
it('ignores a cancelled selection storage error and permits a fresh retry without opening Auth early', async () => {
  const pending = deferred<void>(); mockPrepare.mockReturnValueOnce(pending.promise);
  await act(async () => { tree = create(<AuthScreen />); });
  let active = true;
  await act(async () => { tree.root.findByType('Hero' as React.ElementType).props.onWorker({ isCurrent: () => active }); });
  active = false; await act(async () => pending.reject(new Error('late storage failure')));
  expect(tree.root.findByType('Hero' as React.ElementType).props.error).toBeNull(); expect(host('TextInput')).toHaveLength(0);
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  expect(input('ime@primer.rs')).toBeDefined();
});

it('keeps prepared intent through signup and recovery but clears it for explicit plain sign-in', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  await press('Napravi nalog');
  expect(text()).not.toContain('USKOČI I ZARADI · ISTI NALOG');
  await press('Već imaš nalog? Prijavi se');
  expect(text()).toContain('USKOČI I ZARADI · ISTI NALOG');
  await press('Zaboravljena lozinka?');
  expect(text()).toContain('BEZBEDAN POVRATAK');
  await press('Nazad na prijavu');
  expect(text()).toContain('USKOČI I ZARADI · ISTI NALOG');
  await act(async () => host('Pressable').find(node => node.props.accessibilityLabel === 'Nazad')!.props.onPress());
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onSignIn());
  expect(text()).toContain('JEDAN NALOG · OBE MOGUĆNOSTI');
  expect(text()).not.toContain('USKOČI I ZARADI · ISTI NALOG');
});

it('does not carry a prepared label across an account incarnation change', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onRequester());
  expect(text()).toContain('OBJAVI ZADATAK · ISTI NALOG');
  mockSession = { user: { id: 'other-account' }, accountRevision: 1 };
  await act(async () => tree.update(<AuthScreen />));
  expect(text()).not.toContain('OBJAVI ZADATAK · ISTI NALOG');
  mockSession = { user: null, accountRevision: 2 };
  await act(async () => tree.update(<AuthScreen />));
  expect(text()).not.toContain('OBJAVI ZADATAK · ISTI NALOG');
});

it('does not accept a late prepare or show its label after signed-out account ABA', async () => {
  const pending = deferred<void>(); mockPrepare.mockReturnValueOnce(pending.promise);
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => { tree.root.findByType('Hero' as React.ElementType).props.onWorker(); });
  mockSession = { user: null, accountRevision: 2 };
  await act(async () => pending.resolve());
  expect(tree.root.findAllByType('Hero' as React.ElementType)).toHaveLength(1);
  expect(host('TextInput')).toHaveLength(0);
  expect(text()).not.toContain('USKOČI I ZARADI · ISTI NALOG');
});

it('uses neutral presentation for a new direct Auth destination after a prepared selection', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  await act(async () => tree.root.findByType('Hero' as React.ElementType).props.onWorker());
  mockParams = { form: 'login' };
  await act(async () => tree.update(<AuthScreen />));
  expect(text()).toContain('JEDAN NALOG · OBE MOGUĆNOSTI');
  expect(text()).not.toContain('USKOČI I ZARADI · ISTI NALOG');
  expect(mockPrepare).toHaveBeenCalledTimes(1);
});


it('submits recovery only on user action and reports accepted rather than delivered email', async () => {
  mockRead.mockResolvedValue({ ...emailOnly, passwordRecovery: true });
  await render(); await fill('ime@primer.rs', 'ana@example.test');
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
  await render(); await press('Zaboravljena lozinka?'); await fill('ime@primer.rs', 'ana@example.test');
  const send = button('Pošalji link').props.onPress;
  await act(async () => { send(); send(); });
  expect(mockAuth.requestPasswordRecovery).toHaveBeenCalledTimes(1);
  expect(input('ime@primer.rs').props.editable).toBe(false);
  await act(async () => waiting.reject(new Error('Proveri email pre ponovnog pokušaja.')));
  expect(text()).toContain('Proveri email pre ponovnog pokušaja.');
  expect(input('ime@primer.rs').props.editable).toBe(true);
});

// Owner decision 2026-10-07: signing in to a banned, blocked or closed account gets its own separate, clear message, not
// the generic sign-in error; the same on the phone way in, on the recovery request, and when the provider ended a session.
describe('a restricted account has its own panel on the sign-in sheet', () => {
  const panel = () => tree.root.findAll(node => node.props.testID === 'restricted-account-panel' && typeof node.type === 'string');
  const header = (value: string) => host('Text').find(node => node.props.accessibilityRole === 'header' && textOf(node) === value);
  function expectPanel(body: string) {
    expect(panel()).toHaveLength(1);
    expect(header(restrictedAccountCopy.title)).toBeDefined();
    expect(text()).toContain(body);
    // Calm, not an error line: nothing on the sheet is announced as an alert, and the form is gone.
    expect(host('Text').filter(node => node.props.accessibilityRole === 'alert')).toHaveLength(0);
    expect(host('TextInput')).toHaveLength(0);
    expect(button('Prijavi se')).toBeUndefined();
    expect(button('Zaboravljena lozinka?')).toBeUndefined();
    expect(text()).not.toContain('Zdravo.');
  }

  it('after an email sign-in the provider refused as restricted, with the password cleared and one way back to the same email', async () => {
    await render(); await fill('ime@primer.rs', 'ana@example.test'); await fill('Unesi lozinku', 'password');
    mockAuth.signInWithPassword.mockRejectedValueOnce(new SignInFailureError('RESTRICTED_ACCOUNT'));
    await press('Prijavi se');
    expectPanel(restrictedAccountCopy.body.SIGN_IN);
    expect(text()).not.toContain(SIGN_IN_FAILURE_COPY.BAD_CREDENTIALS);
    await press('Nazad na prijavu');
    expect(panel()).toHaveLength(0);
    expect(input('ime@primer.rs').props.value).toBe('ana@example.test');
    expect(input('Unesi lozinku').props.value).toBe('');
    await fill('Unesi lozinku', 'password'); await press('Prijavi se');
    expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(2);
  });

  it.each(['send', 'verify'] as const)('after a phone %s the provider refused as restricted', async step => {
    mockRead.mockResolvedValue({ ...emailOnly, phoneOtp: true }); await render(); await press('Telefon');
    await fill('+381 6x xxx xxxx', '+381601234567');
    if (step === 'send') mockAuth.sendPhoneOtp.mockRejectedValueOnce(new SignInFailureError('RESTRICTED_ACCOUNT'));
    await press('Pošalji kod');
    if (step === 'verify') {
      await fill('123456', '012345');
      mockAuth.verifyPhoneOtp.mockRejectedValueOnce(new SignInFailureError('RESTRICTED_ACCOUNT'));
      await press('Potvrdi kod');
    }
    expectPanel(restrictedAccountCopy.body.PHONE);
    await press('Nazad na prijavu');
    expect(button('Prijavi se')).toBeDefined();
  });

  it('after a password-recovery request the provider refused as restricted', async () => {
    mockRead.mockResolvedValue({ ...emailOnly, passwordRecovery: true });
    await render(); await fill('ime@primer.rs', 'ana@example.test'); await press('Zaboravljena lozinka?');
    mockAuth.requestPasswordRecovery.mockRejectedValueOnce(new PasswordRecoveryError('RESTRICTED_ACCOUNT'));
    await press('Pošalji link');
    expectPanel(restrictedAccountCopy.body.RECOVERY);
    expect(text()).not.toContain('Ako nalog sa ovim emailom postoji');
  });

  it('opens on its own, once, when the provider ended the session because the account is restricted', async () => {
    mockSession = { ...mockSession, signOutReason: { kind: 'RESTRICTED_ACCOUNT', revision: 3 } };
    await act(async () => { tree = create(<AuthScreen />); });
    expectPanel(restrictedAccountCopy.body.SESSION);
    expect(mockConfirmReason.mock.calls).toEqual([[3]]);
    // The V4.9 entry stays the backdrop behind the sheet.
    expect(tree.root.findAllByType('Hero' as React.ElementType)).toHaveLength(1);
    mockSession = { ...mockSession, signOutReason: null };
    await press('Nazad na prijavu');
    expect(button('Prijavi se')).toBeDefined();
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('every panel sentence is plain Serbian in the "ti" voice, without gender, invented contact, reason or duration', () => {
    for (const sentence of [restrictedAccountCopy.title, ...Object.values(restrictedAccountCopy.body)]) {
      expect(sentence).not.toMatch(/server|podršk|@|https?:|\d/i);
      expect(sentence).not.toMatch(/\b(si|sam|ste|bio|bila|uneo|unela|odjavljena)\b/i);
      expect(sentence).not.toMatch(/zbog|kršen|prekrš|dana|sati|nedelj|zauvek|trajno/i);
    }
  });
});
