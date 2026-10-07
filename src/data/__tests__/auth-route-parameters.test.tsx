import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

const mockRead = jest.fn();
const mockPrepare = jest.fn();
const mockFormLayout = jest.fn();
const mockSplashOptions = jest.fn();
let mockParams: { form?: string } = {};
const mockAuth = { signInWithPassword: jest.fn(), signUp: jest.fn(), sendPhoneOtp: jest.fn(),
  verifyPhoneOtp: jest.fn(), requestPasswordRecovery: jest.fn() };
let mockSession = { user: null as null | { id: string }, accountRevision: 0 };
let mockForeground: (state: string) => void;
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
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('../entryIntentClientService', () => ({ entryIntentClientService: { prepare: (...args: unknown[]) => mockPrepare(...args) } }));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('../../ui/entry/EntryWelcome', () => ({ EntryWelcome: 'Hero' }));
jest.mock('../../ui/legal/LegalDocuments', () => ({ PublicLegalModal: 'LegalModal' }));
jest.mock('../../hooks/useEntrySplashReady', () => ({ useEntrySplashReady: (options: unknown) => {
  mockSplashOptions(options); return { onLayout: mockFormLayout };
} }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession, useSesija: () => mockSession, potvrdiRazlogOdjave: jest.fn() }));
jest.mock('../authAvailabilityClientService', () => ({ authAvailabilityClientService: { read: (...args: unknown[]) => mockRead(...args) } }));
jest.mock('../authClientService', () => ({ authClientService: {
  signInWithPassword: (...args: unknown[]) => mockAuth.signInWithPassword(...args),
  signUp: (...args: unknown[]) => mockAuth.signUp(...args),
  sendPhoneOtp: (...args: unknown[]) => mockAuth.sendPhoneOtp(...args),
  verifyPhoneOtp: (...args: unknown[]) => mockAuth.verifyPhoneOtp(...args),
  requestPasswordRecovery: (...args: unknown[]) => mockAuth.requestPasswordRecovery(...args),
} }));

import AuthScreen from '../../app/auth';

const emailOnly = { emailPassword: true, emailSignup: true, phoneOtp: false,
  emailConfirmationRequired: true, passwordRecovery: false };
let tree: ReactTestRenderer;
const host = (type: string) => tree.root.findAll(node => node.type === type);
const textOf = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : textOf(child)).join(' ');
// The two ways in are tabs of one switch; a button is anything else with that word.
const isTab = (node: ReactTestInstance) => node.props.accessibilityRole === 'tab';
const button = (label: string) => host('Pressable').find(node => !isTab(node) && textOf(node).trim() === label)!;
const tab = (label: string) => host('Pressable').find(node => isTab(node) && textOf(node).trim() === label)!;
const input = (placeholder: string) => host('TextInput').find(node => node.props.placeholder === placeholder)!;
async function press(label: string) { await act(async () => button(label).props.onPress()); }
async function pressTab(label: string) { await act(async () => tab(label).props.onPress()); }
async function fill(placeholder: string, value: string) { await act(async () => input(placeholder).props.onChangeText(value)); }
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  jest.clearAllMocks(); mockPrepare.mockResolvedValue(undefined); mockParams = {}; mockRead.mockResolvedValue(emailOnly); mockSession = { user: null, accountRevision: 0 };
  for (const method of Object.values(mockAuth)) method.mockResolvedValue(undefined);
  mockAuth.signUp.mockResolvedValue({ hasSession: false });
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('says the legal documents are not published yet instead of asking to accept them (deep read 8.2)', async () => {
  mockParams = { form: 'login' };
  await act(async () => { tree = create(<AuthScreen />); });
  await pressTab('Napravi nalog');
  await fill('ime@primer.rs', 'ana@example.test');
  expect(host('Pressable').filter(node => node.props.accessibilityRole === 'checkbox')).toHaveLength(0);
  expect(host('Text').filter(node => node.props.accessibilityRole === 'link')).toHaveLength(0);
  expect(host('LegalModal')).toHaveLength(0);
  expect(textOf(tree.root)).toContain('Uslovi korišćenja i pravila privatnosti još nisu objavljeni.');
  expect(input('ime@primer.rs').props.value).toBe('ana@example.test');
  expect(mockAuth.signUp).not.toHaveBeenCalled();
});

it('opens a cold native login destination whose query arrives after the Auth screen mounts', async () => {
  await act(async () => { tree = create(<AuthScreen />); });
  expect(tree.root.findAllByType('Hero' as React.ElementType)).toHaveLength(1);
  expect(mockSplashOptions).toHaveBeenLastCalledWith({ enabled: false });
  mockParams = { form: 'login' };
  await act(async () => tree.update(<AuthScreen />));
  // An already displayed original entry stays behind the V5 sheet but is inaccessible.
  expect(tree.root.findAllByType('Hero' as React.ElementType)).toHaveLength(1);
  expect(host('View').some(node => node.props.importantForAccessibility === 'no-hide-descendants' && node.props.pointerEvents === 'none')).toBe(true);
  expect(input('ime@primer.rs')).toBeDefined();
  expect(button('Prijavi se')).toBeDefined();
  expect(mockSplashOptions).toHaveBeenLastCalledWith({ enabled: true });
  expect(host('View').some(node => node.props.onLayout === mockFormLayout)).toBe(true);
  expect(Object.values(mockAuth).every(command => command.mock.calls.length === 0)).toBe(true);
});

it('handles a later recovery destination without remounting or carrying an entered password across forms', async () => {
  mockParams = { form: 'login' };
  mockRead.mockResolvedValue({ ...emailOnly, passwordRecovery: true });
  await act(async () => { tree = create(<AuthScreen />); });
  await fill('ime@primer.rs', 'ana@example.test'); await fill('Unesi lozinku', 'private-password');
  const oldLogin = button('Prijavi se').props.onPress;
  mockParams = { form: 'recovery' };
  await act(async () => tree.update(<AuthScreen />));
  expect(button('Pošalji link')).toBeDefined();
  expect(host('TextInput')).toHaveLength(1);
  expect(input('ime@primer.rs').props.value).toBe('ana@example.test');
  await act(async () => oldLogin());
  expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  await press('Nazad na prijavu');
  expect(input('Unesi lozinku').props.value).toBe('');
});

it('does not replay an unchanged route parameter over the user-selected registration form', async () => {
  mockParams = { form: 'login' };
  await act(async () => { tree = create(<AuthScreen />); });
  await pressTab('Napravi nalog'); await fill('Ime', 'Ana');
  await act(async () => tree.update(<AuthScreen />));
  expect(tab('Napravi nalog').props.accessibilityState).toMatchObject({ selected: true });
  expect(button('Prijavi se')).toBeUndefined();
  expect(input('Ime').props.value).toBe('Ana');
});

it('does not interrupt or silently queue a conflicting route during an in-flight login', async () => {
  mockParams = { form: 'login' };
  mockRead.mockResolvedValue({ ...emailOnly, passwordRecovery: true });
  await act(async () => { tree = create(<AuthScreen />); });
  await fill('ime@primer.rs', 'ana@example.test'); await fill('Unesi lozinku', 'private-password');
  const pending = deferred<void>(); mockAuth.signInWithPassword.mockReturnValueOnce(pending.promise);
  await act(async () => button('Prijavi se').props.onPress());
  mockParams = { form: 'recovery' };
  await act(async () => tree.update(<AuthScreen />));
  expect(host('TextInput')).toHaveLength(2);
  expect(button('Pošalji link')).toBeUndefined();
  await act(async () => pending.reject(new Error('Prijava nije potvrđena.')));
  expect(input('Unesi lozinku').props.value).toBe('private-password');
  expect(button('Pošalji link')).toBeUndefined();
  expect(mockAuth.requestPasswordRecovery).not.toHaveBeenCalled();
});

it('ignores an unknown or removed form parameter without discarding user input', async () => {
  mockParams = { form: 'login' };
  await act(async () => { tree = create(<AuthScreen />); });
  await fill('ime@primer.rs', 'ana@example.test');
  for (const form of ['untrusted', undefined]) {
    mockParams = { form }; await act(async () => tree.update(<AuthScreen />));
    expect(input('ime@primer.rs').props.value).toBe('ana@example.test');
    expect(button('Prijavi se')).toBeDefined();
  }
});
