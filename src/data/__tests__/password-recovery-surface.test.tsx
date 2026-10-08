import React from 'react';
import { type } from '../../theme/tokens';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { PasswordRecoveryError } from '../../contracts/passwordRecovery';

let mockLink: string | null = 'uskociapp://oporavak#synthetic';
let mockAccount: { user: { id: string } | null; accountRevision: number } = { user: null, accountRevision: 0 };
const mockReplace = jest.fn();
const mockClear = jest.fn();
const mockVerify = jest.fn();
const mockSave = jest.fn();
const mockDispose = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'Pressable', 'Text', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
let mockIntent: { id: number; link: string } | null = null;
jest.mock('../../store/passwordRecoveryIntent', () => ({ passwordRecoveryIntent: {
  subscribe: () => () => {}, serverSnapshot: () => null,
  snapshot: () => {
    if (mockIntent?.link !== mockLink) mockIntent = mockLink ? { id: (mockIntent?.id ?? 0) + 1, link: mockLink } : null;
    return mockIntent;
  }, clear: (...args: unknown[]) => mockClear(...args),
} }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockAccount, sesijaSada: () => mockAccount }));
jest.mock('../passwordRecoveryClientService', () => ({ passwordRecoveryClientService: {
  createSession: () => ({ verify: mockVerify, updatePassword: mockSave, dispose: mockDispose }),
} }));
import PasswordRecoveryScreen from '../../app/oporavak';
let tree: ReactTestRenderer;
const hosts = (type: string, within: ReactTestInstance = tree.root) => within.findAll(node => node.type === type);
const textOf = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : textOf(child)).join(' ');
const text = () => textOf(tree.root);
const button = (label: string) => hosts('Pressable').find(node => node.props.accessibilityLabel === label || textOf(node).trim() === label)!;
const field = (label: string) => hosts('TextInput').find(node => node.props.accessibilityLabel === label)!;
async function render() { await act(async () => { tree = create(<PasswordRecoveryScreen />); }); }
async function fill(label: string, value: string) { await act(async () => field(label).props.onChangeText(value)); }
async function press(label: string) { await act(async () => button(label).props.onPress()); }
const deferred = <T,>() => {
  let resolve!: (value: T) => void; let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { resolve, reject, promise };
};
beforeEach(() => {
  jest.clearAllMocks(); mockIntent = null; mockLink = 'uskociapp://oporavak#synthetic'; mockAccount = { user: null, accountRevision: 0 };
  mockVerify.mockResolvedValue({ email: 'account-a@example.test' }); mockSave.mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('does not render password controls or success before server verification finishes', async () => {
  const waiting = deferred<{ email: string }>(); mockVerify.mockReturnValue(waiting.promise);
  await render(); expect(text()).toContain('Proveravamo link'); expect(hosts('TextInput')).toHaveLength(0);
  expect(mockClear).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => waiting.resolve({ email: 'account-a@example.test' }));
  expect(field('Nova lozinka').props.secureTextEntry).toBe(true);
  expect(field('Nova lozinka').props.autoComplete).toBe('new-password');
  expect(text()).toContain('account-a@example.test');
  const title = hosts('Text').find(node => node.props.accessibilityRole === 'header' && textOf(node) === 'Postavi novu lozinku.')!;
  expect(StyleSheet.flatten(title.props.style).fontSize).toBe(type.pageTitle.fontSize);
  // The fields stand on the screen itself: the block that holds them is not a card.
  const form = hosts('View').filter(node => node.findAllByType('TextInput' as React.ElementType).length === 2).pop()!;
  expect(StyleSheet.flatten(form.props.style) ?? {}).not.toHaveProperty('backgroundColor');
  expect(StyleSheet.flatten(form.props.style) ?? {}).not.toHaveProperty('borderWidth');
  expect(field('Potvrdi novu lozinku').props.secureTextEntry).toBe(true);
  expect(mockSave).not.toHaveBeenCalled();
});
it('validates confirmation locally, single-flights the write and waits for confirmed success', async () => {
  await render(); await fill('Nova lozinka', '  Nova Lozinka!  '); await fill('Potvrdi novu lozinku', 'different');
  await press('Sačuvaj novu lozinku'); expect(mockSave).not.toHaveBeenCalled(); expect(text()).toContain('Lozinke se ne poklapaju.');
  await fill('Potvrdi novu lozinku', '  Nova Lozinka!  ');
  const waiting = deferred<void>(); mockSave.mockReturnValue(waiting.promise);
  const send = button('Sačuvaj novu lozinku').props.onPress;
  await act(async () => { send(); send(); });
  expect(mockSave.mock.calls).toEqual([['  Nova Lozinka!  ']]);
  expect(field('Nova lozinka').props.editable).toBe(false);
  expect(text()).not.toContain('Lozinka je promenjena.');
  await act(async () => waiting.resolve());
  expect(text()).toContain('Lozinka je promenjena.'); expect(hosts('TextInput')).toHaveLength(0);
  expect(mockReplace).not.toHaveBeenCalled();
  await press('Prijavi se'); expect(mockReplace).toHaveBeenCalledWith({ pathname: '/auth', params: { form: 'login' } });
});
it('refuses a signed-in actor before checking the supplied link', async () => {
  mockAccount = { user: { id: 'another-account' }, accountRevision: 1 }; await render();
  expect(text()).toContain('Najpre se odjavi'); expect(mockVerify).not.toHaveBeenCalled();
  expect(hosts('TextInput')).toHaveLength(0); await press('Nazad u aplikaciju'); expect(mockReplace).toHaveBeenCalledWith('/');
});
it('drops a late verified identity after account change and never displays its email', async () => {
  const waiting = deferred<{ email: string }>(); mockVerify.mockReturnValue(waiting.promise); await render();
  mockAccount = { user: { id: 'another-account' }, accountRevision: 1 };
  await act(async () => { tree.update(<PasswordRecoveryScreen />); waiting.resolve({ email: 'old-private@example.test' }); });
  expect(text()).not.toContain('old-private@example.test'); expect(mockDispose).toHaveBeenCalled();
});
it('shows a used/expired link without a password form and offers the recovery request route', async () => {
  mockVerify.mockRejectedValue(new PasswordRecoveryError('INVALID_LINK')); await render();
  expect(text()).toContain('Link je nevažeći ili je istekao'); expect(hosts('TextInput')).toHaveLength(0);
  await press('Zatraži novi link'); expect(mockReplace).toHaveBeenCalledWith({ pathname: '/auth', params: { form: 'recovery' } });
});
it('retries a verification read with a new lease, not a password update', async () => {
  mockVerify.mockRejectedValueOnce(new PasswordRecoveryError('VERIFY_UNAVAILABLE')); await render();
  await press('Pokušaj ponovo'); expect(mockVerify).toHaveBeenCalledTimes(2); expect(mockSave).not.toHaveBeenCalled();
  expect(field('Nova lozinka')).toBeDefined();
});
it('does not claim success or offer blind write retry after an unknown outcome', async () => {
  await render(); await fill('Nova lozinka', 'new-password'); await fill('Potvrdi novu lozinku', 'new-password');
  mockSave.mockRejectedValue(new PasswordRecoveryError('UPDATE_UNKNOWN')); await press('Sačuvaj novu lozinku');
  expect(text()).toContain('Nije potvrđeno da li je lozinka promenjena'); expect(hosts('TextInput')).toHaveLength(0);
  expect(button('Pokušaj ponovo')).toBeUndefined(); expect(mockSave).toHaveBeenCalledTimes(1);
});
it('clears entered secrets when another recovery link arrives', async () => {
  await render(); await fill('Nova lozinka', 'previous-password'); await fill('Potvrdi novu lozinku', 'previous-password');
  mockLink = 'uskociapp://oporavak#different-synthetic'; mockVerify.mockResolvedValue({ email: 'account-b@example.test' });
  await act(async () => tree.update(<PasswordRecoveryScreen />));
  expect(field('Nova lozinka').props.value).toBe(''); expect(field('Potvrdi novu lozinku').props.value).toBe('');
  expect(text()).toContain('account-b@example.test'); expect(mockSave).not.toHaveBeenCalled();
});
it('does not hide an interrupted write behind a newer link or a late success', async () => {
  await render(); await fill('Nova lozinka', 'new-password'); await fill('Potvrdi novu lozinku', 'new-password');
  const waiting = deferred<void>(); mockSave.mockReturnValue(waiting.promise);
  await act(async () => button('Sačuvaj novu lozinku').props.onPress());
  mockLink = 'uskociapp://oporavak#different-synthetic';
  await act(async () => tree.update(<PasswordRecoveryScreen />));
  await act(async () => waiting.resolve());
  expect(text()).toContain('Nije potvrđeno da li je lozinka promenjena'); expect(mockVerify).toHaveBeenCalledTimes(1);
});


it('clears the fragment in the installed Expo serializer, not just a mocked router', () => {
  const { getPathFromState } = require('expo-router/build/fork/getPathFromState');
  const state = { routes: [{ name: 'oporavak', params: { '#': '' } }], index: 0 };
  expect(getPathFromState(state, { screens: { oporavak: 'oporavak' } })).toBe('/oporavak');
});


it('scrubs the focused route rather than just the enclosing navigator params', () => {
  const { BaseRouter } = require('expo-router/build/react-navigation/routers/BaseRouter');
  const { getPathFromState } = require('expo-router/build/fork/getPathFromState');
  const config = { screens: { slot: { path: '', screens: { oporavak: 'oporavak' } } } };
  const leaf = { key: 'leaf-stack', type: 'stack', stale: false, index: 0, routeNames: ['oporavak'],
    routes: [{ key: 'recovery-route', name: 'oporavak', params: { '#': 'synthetic-secret' } }] };
  const state = { key: 'root', type: 'stack', stale: false, index: 0, routeNames: ['slot'],
    routes: [{ key: 'slot-route', name: 'slot', state: leaf }] };
  const action = { type: 'SET_PARAMS', payload: { params: { '#': '' } } };
  const wrongOwner = BaseRouter.getStateForAction(state, action);
  expect(getPathFromState(wrongOwner, config)).toBe('/oporavak#synthetic-secret');
  const cleanLeaf = BaseRouter.getStateForAction(leaf, { ...action, source: 'recovery-route' });
  const clean = { ...state, routes: [{ ...state.routes[0], state: cleanLeaf }] };
  expect(getPathFromState(clean, config)).toBe('/oporavak');
});

it('revalidates a repeated OS callback instead of displaying the preceding success', async () => {
  await render();
  await fill('Nova lozinka', 'new-password');
  await fill('Potvrdi novu lozinku', 'new-password');
  await press('Sačuvaj novu lozinku');
  expect(text()).toContain('Lozinka je promenjena.');
  mockVerify.mockRejectedValueOnce(new PasswordRecoveryError('INVALID_LINK'));
  mockIntent = { id: mockIntent!.id + 1, link: mockLink! };
  await act(async () => tree.update(<PasswordRecoveryScreen />));
  expect(mockVerify).toHaveBeenCalledTimes(2);
  expect(text()).not.toContain('Lozinka je promenjena.');
  expect(text()).toContain('Link je nevažeći ili je istekao');
  expect(hosts('TextInput')).toHaveLength(0);
  expect(mockSave).toHaveBeenCalledTimes(1);
});

// Owner decision 2026-10-07, design proposal N3: the recovery link of a restricted account shows the restricted-account SCREEN
// (one sentence, one way out, nothing of the recovery form around it); a new link would change nothing, so none is offered,
// and the one way on is back.
it.each([false, true])('a restricted account is its own screen, not an expired link (failed while saving: %s)', async whileSaving => {
  if (!whileSaving) mockVerify.mockRejectedValue(new PasswordRecoveryError('RESTRICTED_ACCOUNT'));
  else mockSave.mockRejectedValue(new PasswordRecoveryError('RESTRICTED_ACCOUNT'));
  await render();
  if (whileSaving) {
    await fill('Nova lozinka', 'new-password'); await fill('Potvrdi novu lozinku', 'new-password');
    await press('Sačuvaj novu lozinku');
  }
  const screens = tree.root.findAll(node => node.props.testID === 'restricted-account-screen' && typeof node.type === 'string');
  expect(screens).toHaveLength(1);
  expect(tree.root.findAll(node => node.props.testID === 'restricted-account-panel' && typeof node.type === 'string')).toHaveLength(1);
  expect(text()).toContain('Pristup nalogu je ograničen');
  expect(text()).toContain('Trenutno ne možeš da koristiš obične funkcije aplikacije.');
  // Nothing of the recovery form is left around it, and no support is promised: nobody is signed in and no address is given.
  expect(text()).not.toContain('Postavi novu lozinku'); expect(text()).not.toContain('Bezbedan povratak');
  expect(text()).not.toContain('javi nam se'); expect(button('Piši podršci')).toBeUndefined();
  expect(text()).not.toContain('Link je nevažeći ili je istekao');
  expect(hosts('Text').filter(node => node.props.accessibilityRole === 'alert')).toHaveLength(0);
  expect(button('Zatraži novi link')).toBeUndefined();
  expect(button('Pokušaj ponovo')).toBeUndefined();
  expect(hosts('TextInput')).toHaveLength(0);
  await press('Nazad na prijavu');
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/auth', params: { form: 'login' } });
});

// F7, 2026-10-08: the link screen is the same frame as every step of the sign-in sheet.
describe('the frame of the link screen', () => {
  const footer = () => hosts('View').find(node => node.props.testID === 'auth-footer')!;

  it('names the flow ONCE ("Oporavak lozinke" in the bar), has one title in the content, and no line with the build\'s version', async () => {
    await render();
    expect(hosts('Text').filter(node => textOf(node) === 'Oporavak lozinke')).toHaveLength(1);
    expect(text()).not.toMatch(/Oporavak naloga|Oporavak pristupa|Vrati pristup nalogu|Bezbedan povratak/);
    expect(hosts('Text').filter(node => node.props.accessibilityRole === 'header' && textOf(node) === 'Postavi novu lozinku.')).toHaveLength(1);
    expect(text()).not.toMatch(/USKOČI ·|verzija/);
    // The arrow in the bar is the only way back that is not a command of the step.
    expect(hosts('Pressable').filter(node => node.props.accessibilityLabel === 'Nazad')).toHaveLength(1);
  });

  it('has exactly ONE command in the foot of the screen in every state, and it is the one green command', async () => {
    const commands = () => hosts('Pressable', footer()).map(node => textOf(node).trim());
    await render();
    expect(commands()).toEqual(['Sačuvaj novu lozinku']);
    await fill('Nova lozinka', 'new-password'); await fill('Potvrdi novu lozinku', 'new-password'); await press('Sačuvaj novu lozinku');
    expect(commands()).toEqual(['Prijavi se']);
    await act(async () => tree.unmount());
    mockVerify.mockRejectedValueOnce(new PasswordRecoveryError('INVALID_LINK')); await render();
    expect(commands()).toEqual(['Zatraži novi link']);
    await act(async () => tree.unmount());
    mockVerify.mockRejectedValueOnce(new PasswordRecoveryError('VERIFY_UNAVAILABLE')); await render();
    // A link that could not be checked: try again is the green one, a new link is the other way, said in words in the content.
    expect(commands()).toEqual(['Pokušaj ponovo']);
    expect(button('Zatraži novi link')).toBeDefined();
  });

  it('says a short new password under its own field, and a mismatch under the confirmation, before anything is sent', async () => {
    await render();
    const block = (label: string) => field(label).parent!.parent!;
    await fill('Nova lozinka', 'abc'); await fill('Potvrdi novu lozinku', 'abc'); await press('Sačuvaj novu lozinku');
    expect(textOf(block('Nova lozinka'))).toContain('Lozinka mora imati najmanje 6 znakova.');
    expect(textOf(block('Potvrdi novu lozinku'))).not.toContain('najmanje 6 znakova');
    expect(mockSave).not.toHaveBeenCalled();
    await fill('Nova lozinka', 'new-password');
    expect(text()).not.toContain('Lozinka mora imati najmanje 6 znakova.');
    await press('Sačuvaj novu lozinku');
    expect(textOf(block('Potvrdi novu lozinku'))).toContain('Lozinke se ne poklapaju.');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('draws a refused or unconfirmed step with a title that says what happened, never a code, and the contract\'s own sentence', async () => {
    mockVerify.mockRejectedValueOnce(new PasswordRecoveryError('INVALID_LINK')); await render();
    expect(hosts('Text').some(node => node.props.accessibilityRole === 'header' && textOf(node) === 'Link ne važi')).toBe(true);
    expect(hosts('Text').filter(node => node.props.accessibilityRole === 'alert').map(textOf)).toEqual(['Link je nevažeći ili je istekao. Zatraži novi link.']);
  });
});
