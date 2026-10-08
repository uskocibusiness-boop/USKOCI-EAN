import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

/**
 * "Promeni lozinku" (R22, UI/UX pass 2026-10-08): the account's email, said and not editable; three secure fields; the one green action in
 * the foot with the reason it is grey in the line above it; a refusal as one sentence of ours under the fields; done as its own state. The
 * words typed live in the route's memory only and go with the screen. Disposable doubles only: the passwords here are made-up strings.
 */
const OLD = 'test-stara-1', NEW = 'test-nova-22';
let mockSession: { user: { id: string; email?: string | null } | null; accountRevision: number };
let mockFocused = true;
const mockChange = jest.fn();
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../../data/passwordChangeClientService', () => ({ ...jest.requireActual('../../../data/passwordChangeClientService'),
  passwordChangeClientService: { change: (...args: unknown[]) => mockChange(...args) } }));
jest.mock('../../../data/supabaseClient', () => ({ createRecoveryTransport: jest.fn() }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../system/textScale', () => ({ useLayoutClass: () => ({ cls: 'compact', stacked: false }) }));
jest.mock('../../system/SuccessMark', () => ({ SuccessMark: 'SuccessMark' }));
jest.mock('../SettingsPresentation', () => ({
  SettingsScreen: ({ children, footer, ...props }: any) => require('react').createElement('Screen', props, children, footer),
  SettingsGroup: 'Group', SettingsAction: 'Action', SettingsText: 'T',
}));
import PromeniLozinku, { passwordChangeReason } from '../../../app/(app)/profil/lozinka';
import { ChangePasswordView, type ChangePasswordField } from '../ChangePasswordPresentation';

let tree: ReactTestRenderer;
const hosts = (name: string) => tree.root.findAll(node => String(node.type) === name);
const texts = () => hosts('T').flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
const field = (label: string): ReactTestInstance => hosts('TextInput').find(node => node.props.accessibilityLabel === label)!;
const action = () => hosts('Action')[0];
const screen = () => hosts('Screen')[0];
const type = async (label: string, value: string) => { await act(async () => field(label).props.onChangeText(value)); };
const fill = async (current = OLD, next = NEW, repeat = NEW) => {
  await type('Trenutna lozinka', current); await type('Nova lozinka', next); await type('Ponovi novu lozinku', repeat);
};
const deferred = <V,>() => { let resolve!: (value: V) => void; const promise = new Promise<V>(done => { resolve = done; }); return { promise, resolve }; };
beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true; mockSession = { user: { id: 'account-a', email: 'ana@example.rs' }, accountRevision: 1 };
  mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the reason the green action waits', () => {
  const values = (current: string, next: string, repeat: string): Record<ChangePasswordField, string> => ({ current, next, repeat });

  it('names the first thing that is missing, in the words of the sign-up, and nothing once the words are fit to send', () => {
    expect(passwordChangeReason(values('', '', ''))).toBe('Upiši trenutnu lozinku.');
    expect(passwordChangeReason(values(OLD, '', ''))).toBe('Nova lozinka mora imati najmanje 6 znakova.');
    expect(passwordChangeReason(values(OLD, OLD, OLD))).toBe('Nova lozinka mora da bude drugačija od trenutne.');
    expect(passwordChangeReason(values(OLD, NEW, ''))).toBe('Nove lozinke se ne poklapaju.');
    expect(passwordChangeReason(values(OLD, NEW, `${NEW}x`))).toBe('Nove lozinke se ne poklapaju.');
    expect(passwordChangeReason(values(OLD, NEW, NEW))).toBeNull();
  });

  it('counts five letters as too short and six as enough', () => {
    expect(passwordChangeReason(values(OLD, 'abcde', 'abcde'))).toBe('Nova lozinka mora imati najmanje 6 znakova.');
    expect(passwordChangeReason(values(OLD, 'abcdef', 'abcdef'))).toBeNull();
  });
});

describe('the screen', () => {
  const view = (patch: Partial<React.ComponentProps<typeof ChangePasswordView>> = {}) => <ChangePasswordView email="ana@example.rs" values={{ current: '', next: '', repeat: '' }}
    onChange={jest.fn()} phase="form" error={null} reason="Upiši trenutnu lozinku." onSubmit={jest.fn()} onBack={jest.fn()} {...patch} />;
  const draw = async (patch: Partial<React.ComponentProps<typeof ChangePasswordView>> = {}) => { await act(async () => { tree = create(view(patch)); }); };

  it('says the account\'s email in a row of its own and offers no field to change it', async () => {
    await draw();
    expect(hosts('Group').map(node => node.props.title)).toEqual(['Nalog', 'Lozinka']);
    expect(texts()).toContain('Email'); expect(texts()).toContain('ana@example.rs');
    expect(hosts('TextInput').map(node => node.props.accessibilityLabel)).toEqual(['Trenutna lozinka', 'Nova lozinka', 'Ponovi novu lozinku']);
  });

  it('says nothing about an email when the account has none', async () => {
    await draw({ email: null });
    expect(hosts('Group').map(node => node.props.title)).toEqual(['Lozinka']); expect(texts()).not.toContain('Email');
  });

  it('draws three secure fields that never autocapitalise, autocorrect or show what is typed, and tell the keychain which is which', async () => {
    await draw();
    for (const input of hosts('TextInput')) expect(input.props).toMatchObject({ secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false, maxLength: 72, editable: true });
    expect(field('Trenutna lozinka').props).toMatchObject({ autoComplete: 'current-password', textContentType: 'password' });
    expect(field('Nova lozinka').props).toMatchObject({ autoComplete: 'new-password', textContentType: 'newPassword' });
    expect(field('Ponovi novu lozinku').props).toMatchObject({ autoComplete: 'new-password', textContentType: 'newPassword' });
  });

  it('hands what is typed to the route, field by field', async () => {
    const onChange = jest.fn();
    await draw({ onChange });
    await type('Nova lozinka', 'abc');
    expect(onChange).toHaveBeenCalledWith('next', 'abc');
  });

  it('has one green action in the foot, grey with its reason in the foot\'s line above it, and live when there is no reason', async () => {
    await draw();
    expect(action().props).toMatchObject({ label: 'Sačuvaj novu lozinku', disabled: true, loading: false });
    expect(screen().props.footerReason).toBe('Upiši trenutnu lozinku.');
    await act(async () => tree.update(view({ reason: null })));
    expect(action().props).toMatchObject({ disabled: false }); expect(screen().props.footerReason).toBeNull();
  });

  it('presses the action only through the route\'s handler', async () => {
    const onSubmit = jest.fn();
    await draw({ reason: null, onSubmit });
    await act(async () => action().props.onPress());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('while it saves, locks the fields and the screen, keeps the action\'s words with a spinner, and says no reason', async () => {
    await draw({ phase: 'saving', reason: null });
    expect(action().props).toMatchObject({ label: 'Sačuvaj novu lozinku', loading: true, disabled: true });
    expect(screen().props).toMatchObject({ disabled: true, footerReason: null });
    for (const input of hosts('TextInput')) expect(input.props.editable).toBe(false);
  });

  it('says a refusal as one sentence under the fields, in the danger note, and nothing else about it', async () => {
    await draw({ error: 'Trenutna lozinka nije tačna.' });
    expect(texts().filter(text => text === 'Trenutna lozinka nije tačna.')).toHaveLength(1);
    expect(texts().join(' ')).not.toMatch(/supabase|gotrue|invalid_|status|http/i);
  });

  it('is done as a state of its own: the sentence, what happens next, one way out, and no field', async () => {
    const onBack = jest.fn();
    await draw({ phase: 'done', onBack });
    expect(texts()).toContain('Lozinka je promenjena.'); expect(texts()).toContain('Sledeći put se prijavljuješ novom lozinkom.');
    expect(hosts('TextInput')).toHaveLength(0);
    expect(hosts('T').find(node => node.children.includes('Lozinka je promenjena.'))!.props.accessibilityRole).toBe('header');
    expect(action().props.label).toBe('Gotovo');
    await act(async () => action().props.onPress()); expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('the route', () => {
  const draw = async () => { await act(async () => { tree = create(<PromeniLozinku />); }); };

  it('starts empty, says the email from the session, and is grey with its first reason', async () => {
    await draw();
    expect(texts()).toContain('ana@example.rs');
    for (const label of ['Trenutna lozinka', 'Nova lozinka', 'Ponovi novu lozinku']) expect(field(label).props.value).toBe('');
    expect(action().props.disabled).toBe(true); expect(screen().props.footerReason).toBe('Upiši trenutnu lozinku.');
  });

  it('walks the reasons as the words are typed, and becomes live when they are fit to send', async () => {
    await draw();
    await type('Trenutna lozinka', OLD); expect(screen().props.footerReason).toBe('Nova lozinka mora imati najmanje 6 znakova.');
    await type('Nova lozinka', NEW); expect(screen().props.footerReason).toBe('Nove lozinke se ne poklapaju.');
    await type('Ponovi novu lozinku', NEW); expect(screen().props.footerReason).toBeNull(); expect(action().props.disabled).toBe(false);
  });

  it('sends the current and the new password to the service once, however many times it is pressed, then says it is done and forgets the words', async () => {
    const pending = deferred<{ ok: true }>();
    mockChange.mockReturnValue(pending.promise);
    await draw(); await fill();
    await act(async () => { action().props.onPress(); action().props.onPress(); });
    expect(mockChange.mock.calls).toEqual([[OLD, NEW]]);
    expect(action().props).toMatchObject({ loading: true, disabled: true });
    await act(async () => pending.resolve({ ok: true }));
    expect(texts()).toContain('Lozinka je promenjena.');
    expect(hosts('TextInput')).toHaveLength(0);
  });

  it.each([
    ['WRONG_CURRENT', 'Trenutna lozinka nije tačna.'], ['WEAK_PASSWORD', 'Nova lozinka je preslaba. Izaberi drugu.'], ['RATE_LIMITED', 'Previše pokušaja. Probaj ponovo malo kasnije.'],
    ['UNAVAILABLE', 'Lozinka nije promenjena. Proveri vezu i pokušaj ponovo.'],
    ['UNKNOWN_OUTCOME', 'Ne znamo da li je lozinka promenjena. Odjavi se pa se prijavi novom lozinkom; ako ne uspe, starom.'],
  ])('says %s with our own sentence, keeps what was typed for another try, and clears the sentence when the person types again', async (code, sentence) => {
    mockChange.mockResolvedValue({ ok: false, code });
    await draw(); await fill();
    await act(async () => action().props.onPress());
    expect(texts()).toContain(sentence);
    for (const [label, value] of [['Trenutna lozinka', OLD], ['Nova lozinka', NEW], ['Ponovi novu lozinku', NEW]]) expect(field(label).props.value).toBe(value);
    await type('Trenutna lozinka', `${OLD}x`);
    expect(texts()).not.toContain(sentence);
  });

  it('presses nothing while the words are not fit to send', async () => {
    await draw();
    await act(async () => action().props.onPress());
    expect(mockChange).not.toHaveBeenCalled();
    await type('Trenutna lozinka', OLD); await type('Nova lozinka', 'kratka');
    await act(async () => action().props.onPress());
    expect(mockChange).not.toHaveBeenCalled();
  });

  it('forgets the words when the screen loses focus, and starts empty when it comes back', async () => {
    await draw(); await fill();
    mockFocused = false; await act(async () => tree.update(<PromeniLozinku />));
    mockFocused = true; await act(async () => tree.update(<PromeniLozinku />));
    for (const label of ['Trenutna lozinka', 'Nova lozinka', 'Ponovi novu lozinku']) expect(field(label).props.value).toBe('');
  });

  it('answers nothing for an account that is not the one that asked: a late answer after the account moved on changes no screen', async () => {
    const pending = deferred<{ ok: true }>();
    mockChange.mockReturnValue(pending.promise);
    await draw(); await fill();
    await act(async () => action().props.onPress());
    mockSession = { user: { id: 'account-b', email: 'b@example.rs' }, accountRevision: 2 };
    await act(async () => { tree.update(<PromeniLozinku />); pending.resolve({ ok: true }); });
    expect(texts()).not.toContain('Lozinka je promenjena.');
    for (const label of ['Trenutna lozinka', 'Nova lozinka', 'Ponovi novu lozinku']) expect(field(label).props.value).toBe('');
    expect(texts()).toContain('b@example.rs');
  });

  it('goes back to where the person came from, or to the profile when nothing is behind, once', async () => {
    await draw();
    await act(async () => { screen().props.onBack(); screen().props.onBack(); });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
    mockRouter.canGoBack.mockReturnValue(false); mockRouter.back.mockClear();
    await draw();
    await act(async () => screen().props.onBack());
    expect(mockRouter.replace).toHaveBeenCalledWith('/profil');
  });

  it('says no email when the session carries none', async () => {
    mockSession = { user: { id: 'account-a', email: null }, accountRevision: 1 };
    await draw();
    expect(hosts('Group').map(node => node.props.title)).toEqual(['Lozinka']);
  });
});
