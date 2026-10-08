import React from 'react';
import { sys } from '../../ui/system/tokens';
import Renderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, AppState, Linking, Platform, StyleSheet } from 'react-native';
import {
  PushPreferences, PushPreferencesView, CHOICE_CATEGORIES, SWITCHED_OFF, choiceState, editSettings, pushScope, sharedFlag, sharedQuiet,
} from '../../ui/notifications/PushPreferences';
import { ListSkeleton } from '../../ui/notifications/ListSkeleton';
import type { NotificationRole, NotificationSettings } from '../../contracts/notificationPreferences';
const mockRead = jest.fn(), mockSave = jest.fn(), mockNative = jest.fn(), mockGet = jest.fn(), mockSet = jest.fn(), mockReadiness = jest.fn();
let mockAccount = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 };
let mockBlur: (() => void) | undefined;
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void | (() => void)) => { const React = require('react'); React.useEffect(() => { const cleanup = callback(); mockBlur = typeof cleanup === 'function' ? cleanup : undefined; return cleanup; }, [callback]); } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockAccount, sesijaSada: () => mockAccount }));
jest.mock('../notificationPreferencesClientService', () => ({ notificationPreferencesClientService: { read: (...args: unknown[]) => mockRead(...args), save: (...args: unknown[]) => mockSave(...args) } }));
jest.mock('../nativePushDevice', () => ({ nativePushDevice: (...args: unknown[]) => mockNative(...args) }));
jest.mock('../pushDeviceClientService', () => ({ pushDeviceClientService: { read: (...args: unknown[]) => mockGet(...args), set: (...args: unknown[]) => mockSet(...args) } }));
jest.mock('../pushReadinessClientService', () => ({ pushReadinessClientService: { read: () => mockReadiness() } }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: (props: unknown) => require('react').createElement('Button', props) }));
jest.mock('../../ui/Text', () => ({ T: (props: unknown) => require('react').createElement('Text', props) }));
// The settings rows are pressable now; Press reaches the native gesture and haptics layers.
jest.mock('../../ui/Press', () => ({ Press: (props: unknown) => require('react').createElement('Press', props) }));
// Quiet hours are picked, no longer typed: the native picker is a host here, driven the way the calendar suites drive it.
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
// The sheet engine needs the native modal and gesture stack; the explanation behind "ⓘ" is its content, and closing it calls onClose.
// The iOS time picker of the quiet hours stands in the same sheet, with its "Izaberi" in the foot.
jest.mock('../../ui/product/ProductSheet', () => ({
  ProductSheet: ({ title, children, footer, onClose }: { title: string; children: (dismiss: () => void) => React.ReactNode;
    footer?: (dismiss: () => void) => React.ReactNode; onClose: () => void }) => {
    const dismiss = () => onClose();
    return require('react').createElement('Sheet', { title, onClose }, children(dismiss), footer ? footer(dismiss) : null);
  },
}));
// React Native loads its native Switch on first use; resetAllMocks (below) would otherwise reset the mock that builds it.
void require('react-native').Switch;
const USER = '11111111-1111-4111-8111-111111111111';
const settings = {
 in_app_enabled: true, push_enabled: false, opportunities_enabled: true, responses_enabled: true, dogovor_enabled: true,
 execution_enabled: true, recovery_enabled: true, account_enabled: true, quiet_hours_enabled: true,
 quiet_start: '22:00:00', quiet_end: '07:00:00', quiet_timezone: 'Europe/Belgrade', urgent_overrides_quiet_hours: false,
};
/** The server keeps one record for each set, each with its own revision: the two are written apart and never against each other's. */
const REVISION: Record<NotificationRole, number> = { REQUESTER: 2, WORKER: 5 };
const record = (role: NotificationRole, patch: Partial<NotificationSettings> = {}, revision = REVISION[role]) =>
 ({ userId: USER, roleContext: role, exists: true, revision, updatedAt: '2026-09-10T20:00:00Z', settings: { ...settings, ...patch } });
let held: Record<NotificationRole, ReturnType<typeof record>>;
/** What the server holds for each set; `patch` changes the parts a case needs. */
const serve = (patch: Partial<Record<NotificationRole, Partial<NotificationSettings>>> = {}) => {
 held = { REQUESTER: record('REQUESTER', patch.REQUESTER), WORKER: record('WORKER', patch.WORKER) };
 mockRead.mockImplementation((_account: string, role: NotificationRole) => Promise.resolve(held[role]));
};
let tree: Renderer.ReactTestRenderer;
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
const button = (label: string) => tree.root.findAllByType('Button' as never).find(x => x.props.label === label)!;
const control = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const openPhoneManagement = async () => {
 expect(control('Upravljanje telefonom').props.accessibilityState.expanded).toBe(false);
 await act(async () => { control('Upravljanje telefonom').props.onPress(); });
 expect(control('Upravljanje telefonom').props.accessibilityState.expanded).toBe(true);
};
/** "Napredno" is closed on arrival (R33): the categories one by one, the app's own list and the facts of the phone are inside it. */
const openAdvanced = async () => {
 if (control('Napredno').props.accessibilityState.expanded) return;
 await act(async () => { control('Napredno').props.onPress(); });
 expect(control('Napredno').props.accessibilityState.expanded).toBe(true);
};
/** Opens "Napredno" if it is closed and presses one of the categories in it, in the set the spoken name says. */
const pressCategory = async (label: string, where: 'kad objavljuješ' | 'kad uskačeš' = 'kad objavljuješ') => {
 await openAdvanced(); act(() => control(`${label}, ${where}`).props.onPress());
};
/** The spoken names of every switch on the screen, in the order they are drawn. */
const switchLabels = () => tree.root.findAll(node => node.props.accessibilityRole === 'switch' && !!node.props.accessibilityLabel, { deep: false })
 .map(node => node.props.accessibilityLabel as string);
async function mount(onDirtyChange?: (dirty: boolean) => void) {
 await act(async () => { tree = Renderer.create(<PushPreferences onDirtyChange={onDirtyChange} />); await flush(); });
}
/** Picks a clock time in a quiet-hours field the way a person does: open the picker, choose, accept (iOS asks to accept). */
async function pickTime(label: string, hours: number, minutes: number) {
 await act(async () => { control(label).props.onPress(); });
 // The runner is in UTC, so the picker's local clock is the UTC clock of this instant.
 const chosen = new Date(Date.UTC(2026, 8, 24, hours, minutes));
 await act(async () => { tree.root.findByType('DateTimePicker' as never).props.onValueChange({}, chosen); });
 const accept = tree.root.findAllByType('Button' as never).find(x => x.props.label === 'Izaberi');
 if (accept) await act(async () => { accept.props.onPress(); });
}
const screenText = () => tree.root.findAllByType('Text' as never).map(x => x.props.children).flat().join(' ');
const toggleDetails = async () => { await openAdvanced(); };
beforeEach(() => {
 jest.useRealTimers(); jest.resetAllMocks(); mockAccount = { user: { id: USER }, accountRevision: 1 };
 serve(); mockNative.mockResolvedValue({ kind: 'READY', token: 'ExpoPushToken[synthetic]', platform: 'ANDROID' });
 mockGet.mockResolvedValue({ ok: true, podatak: { exists: false, revision: 0, active: false, sessionBound: false } });
 mockReadiness.mockResolvedValue({ ok: false });
 mockSet.mockResolvedValue({ ok: true, podatak: { exists: true, revision: 1, active: true, sessionBound: true } });
 mockSave.mockImplementation((_account: string, role: NotificationRole, saved: NotificationSettings, revision: number) =>
  Promise.resolve({ ...held[role], revision: revision + 1, settings: saved }));
});
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); });

describe('reading and commands', () => {
 it('focus reads both sets and the phone without prompting, registering or changing consent', async () => {
  await mount();
  expect(mockRead).toHaveBeenCalledTimes(2);
  expect(mockRead.mock.calls.map(call => call[1]).sort()).toEqual(['REQUESTER', 'WORKER']);
  expect(mockNative).toHaveBeenCalledWith(false, expect.any(Function)); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
 });
 it('a failed initial read can be retried without prompting or writing preferences', async () => {
  mockRead.mockRejectedValueOnce(Error('offline')); await mount();
  expect(button('Pokušaj ponovo').props.disabled).toBe(false);
  await act(async () => { button('Pokušaj ponovo').props.onPress(); await flush(); });
  // Two sets at mount, two more for the one retry.
  expect(mockRead).toHaveBeenCalledTimes(4);
  expect(button('Pokušaj ponovo')).toBeUndefined();
  expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(false);
  expect(mockNative).toHaveBeenCalledWith(false, expect.any(Function));
  expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
 });
 it('while the first read is on its way the screen shows the rows that are coming, not a stack of cards, and says so in words', async () => {
  let answer!: (value: unknown) => void; mockRead.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
  await mount();
  expect(tree.root.findAllByType(ListSkeleton)).toHaveLength(1);
  expect(tree.root.findByType(ListSkeleton).props).toMatchObject({ switches: true, heading: true });
  expect(screenText()).toContain('Učitavamo podešavanja obaveštenja…');
  await act(async () => { answer(held.REQUESTER); await flush(); });
  expect(tree.root.findAllByType(ListSkeleton)).toHaveLength(0);
  expect(control('Prijave i poruke, kad objavljuješ').props.accessibilityState.checked).toBe(true);
 });
 it('after an uncertain save only readback is available, and repeated retry taps start one read', async () => {
  await mount(); await pressCategory('Dogovor i poruke');
  mockSave.mockRejectedValueOnce(Error('lost acknowledgement'));
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(button('Sačuvaj podešavanja').props.disabled).toBe(true);
  expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(true);
  expect(control('Početak tihih sati').props.accessibilityState.disabled).toBe(true);
  expect(button('Pokušaj ponovo').props.disabled).toBe(false);
  let done!: (value: unknown) => void;
  mockRead.mockReturnValueOnce(new Promise(resolve => { done = resolve; }));
  const retry = button('Pokušaj ponovo').props.onPress;
  await act(async () => { retry(); retry(); await flush(); });
  expect(mockRead).toHaveBeenCalledTimes(4);
  expect(button('Sačuvaj podešavanja').props.disabled).toBe(true);
  await act(async () => { done(record('REQUESTER', { dogovor_enabled: false }, 3)); await flush(); });
  expect(control('Dogovor i poruke, kad objavljuješ').props.accessibilityState.checked).toBe(false);
  expect(button('Sačuvaj podešavanja')).toBeUndefined();
  expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(false);
  expect(mockSave).toHaveBeenCalledTimes(1); expect(mockSet).not.toHaveBeenCalled();
 });
 it('explicit enable registers once and writes consent for both sets, each against its own revision, keeping everything else', async () => {
  await mount(); const onPress = button('Uključi obaveštenja na telefonu').props.onPress;
  await act(async () => { onPress(); onPress(); await flush(); });
  expect(mockSet).toHaveBeenCalledTimes(1); expect(mockSave).toHaveBeenCalledTimes(2);
  expect(mockSave).toHaveBeenCalledWith(USER, 'REQUESTER', { ...settings, push_enabled: true }, 2);
  expect(mockSave).toHaveBeenCalledWith(USER, 'WORKER', { ...settings, push_enabled: true }, 5);
  expect(mockNative).toHaveBeenCalledWith(true, expect.any(Function));
 });
 it('enable writes only the set that is still off', async () => {
  serve({ WORKER: { push_enabled: true } }); await mount();
  await act(async () => { button('Uključi obaveštenja na telefonu').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave).toHaveBeenCalledWith(USER, 'REQUESTER', { ...settings, push_enabled: true }, 2);
 });
 it('OS denial never registers or opts in', async () => { await mount(); mockNative.mockResolvedValue({ kind: 'DENIED' }); await act(async () => { button('Uključi obaveštenja na telefonu').props.onPress(); await flush(); }); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled(); });
 it('unknown registration clears action and requires readback; retained callback cannot resend', async () => {
  await mount(); const old = button('Uključi obaveštenja na telefonu').props.onPress; mockSet.mockResolvedValue({ ok: false });
  // The settings are no longer wiped off the screen by an unconfirmed outcome, so the control is
  // still there — locked until the state is read back, which is what it was protecting.
  await act(async () => { old(); await flush(); }); expect(button('Pokušaj ponovo')).toBeDefined();
  expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(true);
  await act(async () => { old(); await flush(); }); expect(mockSet).toHaveBeenCalledTimes(1); expect(mockSave).not.toHaveBeenCalled();
 });
 it('blur during permission/registration prevents later preference opt-in', async () => {
  await mount(); let done!: (value: unknown) => void; mockSet.mockReturnValue(new Promise(r => { done = r; }));
  await act(async () => { button('Uključi obaveštenja na telefonu').props.onPress(); await flush(); });
  act(() => mockBlur?.()); done({ ok: true, podatak: {} }); await act(flush); expect(mockSave).not.toHaveBeenCalled();
 });
 it('blur between the two writes of an enable stops the second one', async () => {
  await mount(); let done!: (value: unknown) => void; mockSave.mockReturnValueOnce(new Promise(r => { done = r; }));
  await act(async () => { button('Uključi obaveštenja na telefonu').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledTimes(1);
  act(() => mockBlur?.()); done(held.REQUESTER); await act(flush);
  expect(mockSave).toHaveBeenCalledTimes(1);
 });
 it('account ABA while registration is pending cannot write preferences or expose old device state', async () => {
  await mount(); let done!: (value: unknown) => void; mockSet.mockReturnValue(new Promise(r => { done = r; }));
  await act(async () => { button('Uključi obaveštenja na telefonu').props.onPress(); await flush(); });
  mockAccount = { user: { id: USER }, accountRevision: 3 }; await act(async () => { tree.update(<PushPreferences />); await flush(); });
  done({ ok: true, podatak: {} }); await act(flush); expect(mockSave).not.toHaveBeenCalled();
 });
 it('disable writes every set that sends, each against the revision it was read at, and preserves all other settings', async () => {
  serve({ REQUESTER: { push_enabled: true }, WORKER: { push_enabled: true } }); await mount();
  await openPhoneManagement();
  await act(async () => { button('Isključi obaveštenja na telefonu').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledTimes(2);
  expect(mockSave).toHaveBeenCalledWith(USER, 'REQUESTER', { ...settings, push_enabled: false }, 2);
  expect(mockSave).toHaveBeenCalledWith(USER, 'WORKER', { ...settings, push_enabled: false }, 5);
  expect(mockSet).not.toHaveBeenCalled();
 });
 it('disable leaves a set that already does not send as it is', async () => {
  serve({ WORKER: { push_enabled: true } }); await mount(); await openPhoneManagement();
  await act(async () => { button('Isključi obaveštenja na telefonu').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave).toHaveBeenCalledWith(USER, 'WORKER', { ...settings, push_enabled: false }, 5);
 });
});

describe('the facts of the phone and of sending', () => {
 it('reads actual transport evidence independently and never turns a healthy tick into device delivery', async () => {
  mockReadiness.mockResolvedValue({ ok: true, podatak: { state: 'OPERATIONAL', checkedAt: '2026-09-13T00:00:00Z' } });
  await mount(); expect(mockReadiness).toHaveBeenCalledTimes(1);
  expect(control('Napredno').props.accessibilityState.expanded).toBe(false);
  expect(control('Prijave i poruke, kad objavljuješ').props.accessibilityState.checked).toBe(true);
  expect(screenText()).not.toContain('Slanje obaveštenja je radilo pri poslednjoj proveri.');
  await toggleDetails();
  expect(screenText()).toContain('Slanje obaveštenja je radilo pri poslednjoj proveri.');
  expect(screenText()).toContain('Ova provera ne potvrđuje da je obaveštenje stiglo na tvoj telefon.'); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
  await act(async () => { control('Napredno').props.onPress(); });
  expect(control('Napredno').props.accessibilityState.expanded).toBe(false);
  expect(screenText()).not.toContain('Slanje obaveštenja je radilo pri poslednjoj proveri.');
  expect(mockReadiness).toHaveBeenCalledTimes(1); expect(mockRead).toHaveBeenCalledTimes(2);
  expect(mockNative).not.toHaveBeenCalledWith(true, expect.any(Function));
  expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
 });
 it('transport failure preserves available device controls with honest missing evidence', async () => {
  mockReadiness.mockRejectedValue(Error('offline')); await mount(); await toggleDetails(); expect(screenText()).toContain('Ne znamo da li slanje obaveštenja radi.');
  expect(button('Uključi obaveštenja na telefonu')).toBeDefined(); expect(mockSet).not.toHaveBeenCalled();
 });
 it('late transport result cannot replace a new account snapshot', async () => {
  let done!: (value: unknown) => void; mockReadiness.mockReturnValueOnce(new Promise(resolve => { done = resolve; }));
  await mount(); mockAccount = { user: { id: USER }, accountRevision: 3 };
  await act(async () => { tree.update(<PushPreferences />); await flush(); });
  await act(async () => { done({ ok: true, podatak: { state: 'OPERATIONAL', checkedAt: '2026-09-13T00:00:00Z' } }); await flush(); });
  await toggleDetails(); // Inspect the new account's evidence, rather than merely a closed disclosure.
  expect(screenText()).not.toContain('Slanje obaveštenja je radilo pri poslednjoj proveri.'); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
 });
 it('the send check is a heading, and the privacy line is there once, among the facts', async () => {
  await mount(); await toggleDetails();
  expect(tree.root.findAllByType('Text' as never).find(node => node.props.children === 'Poslednja provera slanja')!.props.accessibilityRole).toBe('header');
  expect(screenText().split('Na zaključanom ekranu prikazujemo samo da imaš novo obaveštenje.')).toHaveLength(2);
 });
});

describe('one screen for both sets', () => {
 it('is "Ovaj telefon", "Kad objavljuješ", "Kad uskačeš", "Tihi sati" and "Napredno", in that order, and the one sentence under them', async () => {
  await mount();
  const headings = tree.root.findAllByType('Text' as never).filter(node => node.props.accessibilityRole === 'header').map(node => node.props.children);
  expect(headings.filter(name => ['Ovaj telefon', 'Kad objavljuješ', 'Kad uskačeš', 'Tihi sati'].includes(name))).toEqual(['Ovaj telefon', 'Kad objavljuješ', 'Kad uskačeš', 'Tihi sati']);
  const copy = screenText();
  const at = (word: string) => copy.indexOf(word);
  expect(at('Ovaj telefon')).toBeLessThan(at('Kad objavljuješ')); expect(at('Kad objavljuješ')).toBeLessThan(at('Kad uskačeš'));
  expect(at('Kad uskačeš')).toBeLessThan(at('Tihi sati')); expect(at('Tihi sati')).toBeLessThan(at(SWITCHED_OFF));
  // The sentence stands at the bottom, once, and nothing else on the screen explains.
  expect(copy.split(SWITCHED_OFF)).toHaveLength(2);
  const sentences = tree.root.findAllByType('Text' as never).filter(node => /[.!?]$/.test(String(node.props.children)) && node.props.variant === 'note');
  expect(sentences.map(node => node.props.children)).toEqual([SWITCHED_OFF]);
  for (const word of ['Moji zadaci', 'Moje prijave', 'Isključivanje ne briše', 'Bez obaveštenja na telefon u ovom periodu']) expect(copy).not.toContain(word);
  expect(tree.root.findAll(node => node.props.accessibilityRole === 'tab')).toHaveLength(0);
 });
 it('names the same choice once in each set, and a screen reader hears which set it is in', async () => {
  await mount();
  expect(switchLabels()).toEqual(expect.arrayContaining(['Prijave i poruke, kad objavljuješ', 'Ostalo, kad objavljuješ', 'Novi zadaci, kad uskačeš',
   'Prijave i poruke, kad uskačeš', 'Ostalo, kad uskačeš', 'Uključi tihe sate']));
  expect(new Set(switchLabels()).size).toBe(switchLabels().length);
  // Seen: "Prijave i poruke" and "Ostalo" under each heading.
  expect(screenText().split('Prijave i poruke')).toHaveLength(3); expect(screenText().split('Ostalo')).toHaveLength(3);
 });
 it('shows the "Novi zadaci" switch only in the set that receives new tasks', async () => {
  await mount();
  expect(control('Novi zadaci, kad uskačeš')).toBeDefined();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Novi zadaci, kad objavljuješ' })).toHaveLength(0);
  expect(screenText().split('Novi zadaci')).toHaveLength(2);
  expect(screenText()).not.toContain('Nove prilike');
 });
 it('writes only the set that was changed, against its own revision', async () => {
  await mount(); await pressCategory('Prijave i odgovori', 'kad uskačeš');
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave).toHaveBeenCalledWith(USER, 'WORKER', { ...settings, responses_enabled: false }, 5);
 });
 it('writes both sets for what is the account\'s, and the app\'s own list is one switch for both', async () => {
  await mount(); await openAdvanced();
  expect(switchLabels().filter(label => label === 'Obaveštenja u aplikaciji')).toHaveLength(1);
  act(() => control('Obaveštenja u aplikaciji').props.onPress());
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledTimes(2);
  expect(mockSave).toHaveBeenCalledWith(USER, 'REQUESTER', { ...settings, in_app_enabled: false }, 2);
  expect(mockSave).toHaveBeenCalledWith(USER, 'WORKER', { ...settings, in_app_enabled: false }, 5);
 });
 it('a partial failure of the two writes leaves the read-back to say what the server holds', async () => {
  await mount(); await openAdvanced();
  act(() => control('Obaveštenja u aplikaciji').props.onPress());
  mockSave.mockImplementationOnce((_a: string, role: NotificationRole, saved: NotificationSettings, revision: number) => {
   held[role] = { ...held[role], revision: revision + 1, settings: saved }; return Promise.resolve(held[role]);
  }).mockRejectedValueOnce(Error('lost acknowledgement'));
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledTimes(2);
  expect(button('Pokušaj ponovo')).toBeDefined(); expect(button('Sačuvaj podešavanja').props.disabled).toBe(true);
  await act(async () => { button('Pokušaj ponovo').props.onPress(); await flush(); });
  // The first set was saved and the second was not: the screen shows exactly that, and the change that is left is still to be made.
  expect(button('Pokušaj ponovo')).toBeUndefined();
  expect(mockSave).toHaveBeenCalledTimes(2);
  expect(held.REQUESTER.settings.in_app_enabled).toBe(false); expect(held.WORKER.settings.in_app_enabled).toBe(true);
 });
 it('a set whose app list differs from the other reads as off and says so, and one touch makes both the same', async () => {
  serve({ WORKER: { in_app_enabled: false } }); await mount(); await openAdvanced();
  expect(control('Obaveštenja u aplikaciji').props.accessibilityState.checked).toBe(false);
  expect(control('Obaveštenja u aplikaciji').props.accessibilityHint).toContain('Delimično uključeno.');
  expect(button('Sačuvaj podešavanja')).toBeUndefined();
  act(() => control('Obaveštenja u aplikaciji').props.onPress());
  expect(control('Obaveštenja u aplikaciji').props.accessibilityState.checked).toBe(true);
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  // Only the set that differed is written: the other already held what the person now sees.
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave).toHaveBeenCalledWith(USER, 'WORKER', { ...settings, in_app_enabled: true }, 5);
 });
});

describe('the quiet hours', () => {
 it('saves overnight quiet hours, timezone and explicit HITNO override, in both sets, through the same revisioned settings writer', async () => {
  await mount();
  await pickTime('Početak tihih sati', 23, 15);
  await pickTime('Kraj tihih sati', 6, 45);
  // The zone is no longer typed by hand; the saved value is the one that was read back, and the
  // only way to change it is the explicit "use the phone's zone" action.
  act(() => control('Hitno može i tokom tihih sati').props.onPress());
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  const wanted = { ...settings, quiet_start: '23:15', quiet_end: '06:45', urgent_overrides_quiet_hours: true };
  expect(mockSave).toHaveBeenCalledTimes(2);
  expect(mockSave).toHaveBeenCalledWith(USER, 'REQUESTER', wanted, 2);
  expect(mockSave).toHaveBeenCalledWith(USER, 'WORKER', wanted, 5);
  expect(mockSet).not.toHaveBeenCalled();
 // Two picker round trips and a save: an explicit budget, so a loaded machine does not fail it at Jest's 5 s default
 // (seen in the round-5 review at 4.8 s).
 }, 30_000);
 it('one edit makes the whole of the quiet hours the same in both sets, whatever they were apart', async () => {
  serve({ WORKER: { quiet_end: '08:30:00' } }); await mount();
  await pickTime('Početak tihih sati', 23, 15);
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  // The end the person saw was the first set's; the second set's own end (08:30) is replaced by it, since there is one value on the screen.
  expect(mockSave).toHaveBeenCalledWith(USER, 'REQUESTER', { ...settings, quiet_start: '23:15' }, 2);
  expect(mockSave).toHaveBeenCalledWith(USER, 'WORKER', { ...settings, quiet_start: '23:15', quiet_end: '07:00:00' }, 5);
 }, 30_000);
 it('draws the quiet hours of the set that has them on, when the other has none', async () => {
  serve({ REQUESTER: { quiet_hours_enabled: false }, WORKER: { quiet_start: '21:00:00' } }); await mount();
  expect(control('Uključi tihe sate').props.accessibilityState.checked).toBe(true);
  act(() => control('Uključi tihe sate').props.onPress());
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledWith(USER, 'WORKER', { ...settings, quiet_start: '21:00:00', quiet_hours_enabled: false }, 5);
  expect(mockSave).toHaveBeenCalledWith(USER, 'REQUESTER', { ...settings, quiet_start: '21:00:00', quiet_hours_enabled: false }, 2);
 });
 it('has its explanation behind the mark at the end of the title, not on the screen', async () => {
  await mount();
  expect(screenText()).not.toContain('Period može da prelazi preko ponoći.');
  expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
  await act(async () => { control('Objašnjenje: Tihi sati').props.onPress(); });
  const sheet = tree.root.findByType('Sheet' as never);
  expect(sheet.props.title).toBe('Tihi sati');
  expect(sheet.findAllByType('Text' as never).map(node => node.props.children).join(' ')).toContain('Period može da prelazi preko ponoći.');
  expect(mockSave).not.toHaveBeenCalled();
 });
 it('enabled quiet hours refuse incomplete or malformed local times before any write', async () => {
  // A time can no longer be typed; a malformed one can still come back from the server, and it is never written on.
  serve({ REQUESTER: { quiet_start: '25:99' }, WORKER: { quiet_start: '25:99' } }); await mount();
  await pressCategory('Dogovor i poruke');
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(mockSave).not.toHaveBeenCalled(); expect(screenText()).toContain('Vreme tihih sati nije ispravno');
 });
 it('enabled quiet hours without an end are refused with a sentence that says what to pick', async () => {
  serve({ REQUESTER: { quiet_end: null }, WORKER: { quiet_end: null } }); await mount();
  await pressCategory('Dogovor i poruke');
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(mockSave).not.toHaveBeenCalled(); expect(screenText()).toContain('Za tihe sate izaberi početak i kraj.');
 });
 // The quiet-hours zone is shown only where it matters and is changed only by the explicit "use the phone's zone".
 const phoneZone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } })();
 it('a zone that is not the phone\'s is shown with quiet hours on, hidden with them off, and replaced only on request', async () => {
  const away = phoneZone === 'Pacific/Chatham' ? 'Pacific/Easter' : 'Pacific/Chatham';
  serve({ REQUESTER: { quiet_timezone: away }, WORKER: { quiet_timezone: away } }); await mount();
  expect(screenText()).toContain('Vremenska zona tihih sati');
  expect(screenText()).toContain(away.split('/')[1]);
  const use = tree.root.findAllByType('Button' as never).find(node => String(node.props.label).startsWith('Koristi zonu telefona'));
  if (!phoneZone) { expect(use).toBeUndefined(); return; }
  await act(async () => { use!.props.onPress(); });
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledWith(USER, 'REQUESTER', { ...settings, quiet_timezone: phoneZone }, 2);
  expect(mockSave).toHaveBeenCalledWith(USER, 'WORKER', { ...settings, quiet_timezone: phoneZone }, 5);
  act(() => tree.unmount());
  serve({ REQUESTER: { quiet_timezone: away, quiet_hours_enabled: false }, WORKER: { quiet_timezone: away, quiet_hours_enabled: false } }); await mount();
  expect(screenText()).not.toContain('Vremenska zona tihih sati');
  expect(tree.root.findAllByType('Button' as never).filter(node => String(node.props.label).startsWith('Koristi zonu telefona'))).toHaveLength(0);
 });
 it('an empty zone (the reader refuses one, so only a draft could hold it) says "Nije izabrana." next to its fix', async () => {
  const onEdit = jest.fn();
  await act(async () => { tree = Renderer.create(<PushPreferencesView signedIn deviceZone="Europe/Belgrade"
   data={{ settings: { REQUESTER: { ...settings, quiet_timezone: '' }, WORKER: { ...settings, quiet_timezone: '' } }, native: 'READY', push: { state: 'none' }, registered: false, readiness: null }}
   busy={false} error={false} locked={false} dirty={false} validation={null} working={null} justSaved={false}
   onEdit={onEdit} onSave={jest.fn()} onEnable={jest.fn()} onDisable={jest.fn()} onRefresh={jest.fn()} onOpenSystemSettings={jest.fn()} />); });
  expect(screenText()).toContain('Nije izabrana.');
  await act(async () => { button('Koristi zonu telefona (Vreme u Srbiji)').props.onPress(); });
  expect(onEdit).toHaveBeenCalledWith('ALL', 'quiet_timezone', 'Europe/Belgrade');
 });
});

describe('the choices of each set', () => {
 // R33 (UI/UX pass, 2026-10-08): six categories named for the engine became three choices a person understands, and the categories
 // one by one are under a closed "Napredno". A choice is a view over its categories; the server still keeps the categories.
 const ADVANCED = ['Prijave i odgovori', 'Dogovor i poruke', 'Završetak zadatka', 'Nedovršeno', 'Nalog i ostalo'];
 it('offers the choices, keeps the categories of each set one by one under a closed "Napredno", and draws no category twice', async () => {
  await mount();
  expect(switchLabels()).toEqual(expect.arrayContaining(['Novi zadaci, kad uskačeš', 'Prijave i poruke, kad uskačeš', 'Ostalo, kad uskačeš']));
  for (const label of ADVANCED) for (const where of ['kad objavljuješ', 'kad uskačeš']) expect(switchLabels()).not.toContain(`${label}, ${where}`);
  expect(control('Napredno').props.accessibilityState.expanded).toBe(false);
  expect(control('Napredno').props.accessibilityHint).toBeUndefined();
  await openAdvanced();
  for (const label of ADVANCED) for (const where of ['kad objavljuješ', 'kad uskačeš']) expect(switchLabels()).toContain(`${label}, ${where}`);
  // "Novi zadaci" is the one category of its choice, so it is not drawn a second time under "Napredno".
  expect(switchLabels().filter(label => label.startsWith('Novi zadaci'))).toHaveLength(1);
  // The engine's names are gone from everything a person reads.
  for (const word of ['Oporavak', 'Izvršenje i završetak', 'Zadaci i prijave', 'Sve ostalo']) expect(screenText()).not.toContain(word);
 });
 it('the set that receives no new tasks has two choices, not three', async () => {
  await mount();
  const requester = switchLabels().filter(label => label.endsWith('kad objavljuješ'));
  expect(requester).toEqual(['Prijave i poruke, kad objavljuješ', 'Ostalo, kad objavljuješ']);
  expect(switchLabels().filter(label => label.endsWith('kad uskačeš'))).toEqual(['Novi zadaci, kad uskačeš', 'Prijave i poruke, kad uskačeš', 'Ostalo, kad uskačeš']);
 });
 it('one touch on a choice switches every category it stands for, and one save writes them all, in that set only', async () => {
  await mount();
  act(() => control('Prijave i poruke, kad uskačeš').props.onPress());
  expect(control('Prijave i poruke, kad uskačeš').props.accessibilityState.checked).toBe(false);
  expect(control('Prijave i poruke, kad objavljuješ').props.accessibilityState.checked).toBe(true);
  await openAdvanced();
  // The three categories were changed one after the other and none of them undid the one before it.
  for (const label of ['Prijave i odgovori', 'Dogovor i poruke', 'Završetak zadatka']) expect([label, control(`${label}, kad uskačeš`).props.accessibilityState.checked]).toEqual([label, false]);
  for (const label of ['Nedovršeno', 'Nalog i ostalo']) expect([label, control(`${label}, kad uskačeš`).props.accessibilityState.checked]).toEqual([label, true]);
  expect(control('Novi zadaci, kad uskačeš').props.accessibilityState.checked).toBe(true);
  for (const label of ADVANCED) expect([label, control(`${label}, kad objavljuješ`).props.accessibilityState.checked]).toEqual([label, true]);
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave).toHaveBeenCalledWith(USER, 'WORKER', { ...settings, responses_enabled: false, dogovor_enabled: false, execution_enabled: false }, 5);
  expect(mockSet).not.toHaveBeenCalled();
 });
 it('"Ostalo" stands for the unfinished actions and the account, and "Novi zadaci" for the new tasks alone', async () => {
  await mount();
  act(() => control('Ostalo, kad uskačeš').props.onPress()); act(() => control('Novi zadaci, kad uskačeš').props.onPress());
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledWith(USER, 'WORKER', { ...settings, recovery_enabled: false, account_enabled: false, opportunities_enabled: false }, 5);
 });
 it('a choice whose categories differ reads as off, says the details are under "Napredno", and one touch makes them all the same', async () => {
  serve({ REQUESTER: { dogovor_enabled: false } }); await mount();
  expect(control('Prijave i poruke, kad objavljuješ').props.accessibilityState.checked).toBe(false);
  expect(control('Prijave i poruke, kad objavljuješ').props.accessibilityHint).toContain('Delimično uključeno. Pojedinosti su u Naprednom.');
  expect(screenText()).toContain('Delimično uključeno. Pojedinosti su u Naprednom.');
  expect(control('Ostalo, kad objavljuješ').props.accessibilityHint).toBeUndefined();
  expect(control('Prijave i poruke, kad uskačeš').props.accessibilityHint).toBeUndefined();
  expect(button('Sačuvaj podešavanja')).toBeUndefined();
  act(() => control('Prijave i poruke, kad objavljuješ').props.onPress());
  expect(control('Prijave i poruke, kad objavljuješ').props.accessibilityState.checked).toBe(true);
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledWith(USER, 'REQUESTER', { ...settings }, 2);
 });
 it('a category changed under "Napredno" moves its choice to the middle and back, and back at what is saved nothing waits to be saved', async () => {
  await mount(); await pressCategory('Dogovor i poruke');
  expect(control('Prijave i poruke, kad objavljuješ').props.accessibilityState.checked).toBe(false);
  expect(control('Prijave i poruke, kad objavljuješ').props.accessibilityHint).toContain('Delimično uključeno.');
  expect(button('Sačuvaj podešavanja')).toBeDefined();
  act(() => control('Dogovor i poruke, kad objavljuješ').props.onPress());
  expect(control('Prijave i poruke, kad objavljuješ').props.accessibilityState.checked).toBe(true);
  expect(control('Prijave i poruke, kad objavljuješ').props.accessibilityHint).toBeUndefined();
  expect(button('Sačuvaj podešavanja')).toBeUndefined();
 });
 it('exposes category controls and saves an explicit opt-out without silently enabling push', async () => {
  await mount();
  await pressCategory('Prijave i odgovori');
  expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(true);
  // The phone waits for the change to be saved first, and says so.
  expect(button('Uključi obaveštenja na telefonu').props.reason).toBe('Prvo sačuvaj izmene.');
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledTimes(1);
  // The set that publishes has no "Novi zadaci" switch, and the value it would hold is written back unchanged.
  expect(mockSave).toHaveBeenCalledWith(USER, 'REQUESTER', { ...settings, responses_enabled: false }, 2);
  expect(mockNative).not.toHaveBeenCalledWith(true, expect.any(Function));
  expect(mockSet).not.toHaveBeenCalled();
 });
 it('the three choices cover the six categories exactly once, and a choice is on, off or in the middle by its categories', () => {
  const covered = Object.values(CHOICE_CATEGORIES).flat();
  expect([...covered].sort()).toEqual(['account_enabled', 'dogovor_enabled', 'execution_enabled', 'opportunities_enabled', 'recovery_enabled', 'responses_enabled']);
  expect(new Set(covered).size).toBe(covered.length);
  expect(choiceState(settings, 'talk')).toBe('on');
  expect(choiceState({ ...settings, responses_enabled: false }, 'talk')).toBe('mixed');
  expect(choiceState({ ...settings, responses_enabled: false, dogovor_enabled: false, execution_enabled: false }, 'talk')).toBe('off');
  expect(choiceState({ ...settings, opportunities_enabled: false }, 'tasks')).toBe('off');
  expect(choiceState({ ...settings, recovery_enabled: false }, 'other')).toBe('mixed');
 });
 it('a switch row is one focus stop, spoken as a switch, drawn green on white instead of the platform teal', async () => {
  await mount();
  const row = control('Prijave i poruke, kad objavljuješ');
  expect(row.props.accessibilityRole).toBe('switch');
  expect(row.props.accessibilityState).toEqual({ checked: true, disabled: false });
  const drawn = row.findByProps({ importantForAccessibility: 'no-hide-descendants' });
  const toggle = drawn.findByProps({ value: true });
  expect(toggle.props.accessibilityLabel).toBeUndefined();
  expect(toggle.props.trackColor).toEqual({ false: sys.color.lineStrong, true: sys.color.green });
  expect(toggle.props.thumbColor).toBe(sys.color.surface);
 });
});

describe('what is shared, and what is one set\'s, as pure rules', () => {
 const both = (requester: Partial<NotificationSettings> = {}, worker: Partial<NotificationSettings> = {}) => ({ REQUESTER: { ...settings, ...requester }, WORKER: { ...settings, ...worker } });
 it('reads a flag as on, off or in the middle by both sets, and the phone as sent all, some or none of them', () => {
  expect(sharedFlag(both(), 'in_app_enabled')).toBe('on');
  expect(sharedFlag(both({ in_app_enabled: false }, { in_app_enabled: false }), 'in_app_enabled')).toBe('off');
  expect(sharedFlag(both({ in_app_enabled: false }), 'in_app_enabled')).toBe('mixed');
  expect(pushScope(both({ push_enabled: true }, { push_enabled: true }))).toEqual({ state: 'all' });
  expect(pushScope(both())).toEqual({ state: 'none' });
  expect(pushScope(both({ push_enabled: true }))).toEqual({ state: 'some', on: 'REQUESTER' });
  expect(pushScope(both({}, { push_enabled: true }))).toEqual({ state: 'some', on: 'WORKER' });
 });
 it('speaks the quiet hours of the set that has them on, else of the first', () => {
  expect(sharedQuiet(both({ quiet_start: '20:00:00' }, { quiet_start: '21:00:00' })).quiet_start).toBe('20:00:00');
  expect(sharedQuiet(both({ quiet_hours_enabled: false, quiet_start: '20:00:00' }, { quiet_start: '21:00:00' })).quiet_start).toBe('21:00:00');
  expect(sharedQuiet(both({ quiet_hours_enabled: false }, { quiet_hours_enabled: false })).quiet_hours_enabled).toBe(false);
 });
 it('applies an edit to its set, or to both for what is the account\'s, and the quiet hours as one value', () => {
  const held = both({}, { quiet_end: '08:30:00' });
  expect(editSettings(held, 'WORKER', 'responses_enabled', false).WORKER.responses_enabled).toBe(false);
  expect(editSettings(held, 'WORKER', 'responses_enabled', false).REQUESTER.responses_enabled).toBe(true);
  const inApp = editSettings(held, 'ALL', 'in_app_enabled', false);
  expect([inApp.REQUESTER.in_app_enabled, inApp.WORKER.in_app_enabled]).toEqual([false, false]);
  const start = editSettings(held, 'ALL', 'quiet_start', '23:00:00');
  expect([start.REQUESTER.quiet_start, start.WORKER.quiet_start]).toEqual(['23:00:00', '23:00:00']);
  expect([start.REQUESTER.quiet_end, start.WORKER.quiet_end]).toEqual(['07:00:00', '07:00:00']);
  // The drafts it was given are not changed.
  expect(held.WORKER.quiet_end).toBe('08:30:00');
 });
});

describe('the phone', () => {
 it('the sentence before the phone\'s permission is not on the screen: the headline and the one button say it', async () => {
  mockNative.mockResolvedValue({ kind: 'PERMISSION_REQUIRED' }); await mount();
  const order = () => tree.root.findAll(node => (node.type as unknown) === 'Text' || (node.type as unknown) === 'Button').map(node => String(node.props.children ?? node.props.label));
  expect(order().indexOf('Potrebna je dozvola telefona')).toBeGreaterThan(-1);
  expect(order().indexOf('Uključi obaveštenja na telefonu')).toBeGreaterThan(order().indexOf('Potrebna je dozvola telefona'));
  expect(order().filter(line => line.startsWith('Dugme ispod traži dozvolu'))).toHaveLength(0);
  await toggleDetails();
  expect(order().filter(line => line.startsWith('Dugme ispod traži dozvolu'))).toHaveLength(1);
 });
 it('an emulator is told honestly that it cannot receive notifications, with nothing to press', async () => {
  mockNative.mockResolvedValue({ kind: 'UNSUPPORTED' }); await mount();
  expect(screenText()).toContain('Nije dostupno na ovom uređaju');
  for (const label of ['Uključi obaveštenja na telefonu', 'Isključi obaveštenja na telefonu', 'Podešavanja telefona', 'Osveži']) expect(button(label)).toBeUndefined();
 });
 it('a phone that refuses notifications says so first and reads again when the person comes back from its settings', async () => {
  const listeners: ((state: string) => void)[] = [];
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: (state: string) => void) => {
   listeners.push(handler); return { remove: jest.fn() }; }) as never);
  try {
   mockNative.mockResolvedValue({ kind: 'DENIED' }); await mount();
   expect(screenText()).toContain('Telefon ne dozvoljava obaveštenja');
   expect(button('Podešavanja telefona')).toBeDefined(); expect(button('Uključi obaveštenja na telefonu')).toBeUndefined();
   expect(mockRead).toHaveBeenCalledTimes(2);
   mockNative.mockResolvedValue({ kind: 'READY', token: 'ExpoPushToken[synthetic]', platform: 'ANDROID' });
   await act(async () => { listeners.forEach(listener => listener('active')); await flush(); });
   expect(mockRead).toHaveBeenCalledTimes(4); expect(mockNative).toHaveBeenLastCalledWith(false, expect.any(Function));
   expect(button('Uključi obaveštenja na telefonu')).toBeDefined();
   expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
 });
 it('failed OS settings launch leaves notification edits intact and never writes consent', async () => {
  const open = jest.spyOn(Linking, 'openSettings').mockRejectedValueOnce(Error('unavailable')).mockResolvedValue(undefined);
  try {
   mockNative.mockResolvedValue({ kind: 'DENIED' }); await mount();
   await pressCategory('Dogovor i poruke');
   await act(async () => { button('Podešavanja telefona').props.onPress(); await flush(); });
   expect(button('Podešavanja telefona').props.error).toContain('Otvaranje podešavanja nije potvrđeno.');
   expect(control('Dogovor i poruke, kad objavljuješ').props.accessibilityState.checked).toBe(false);
   expect(button('Sačuvaj podešavanja').props.disabled).toBe(false);
   await act(async () => { button('Podešavanja telefona').props.onPress(); await flush(); });
   expect(button('Podešavanja telefona').props.error).toBeNull();
   expect(open).toHaveBeenCalledTimes(2);
   expect(mockRead).toHaveBeenCalledTimes(2);
   expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
  } finally { open.mockRestore(); }
 });
 it('coming back to the app never reads over unsaved changes', async () => {
  const listeners: ((state: string) => void)[] = [];
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: (state: string) => void) => {
   listeners.push(handler); return { remove: jest.fn() }; }) as never);
  try {
   mockNative.mockResolvedValue({ kind: 'DENIED' }); await mount();
   await pressCategory('Dogovor i poruke');
   await act(async () => { listeners.forEach(listener => listener('active')); await flush(); });
   expect(mockRead).toHaveBeenCalledTimes(2);
   expect(control('Dogovor i poruke, kad objavljuješ').props.accessibilityState.checked).toBe(false);
  } finally { spy.mockRestore(); }
 });

 // The phone section never claims what this phone does not do. The account's choice is said with the buttons' noun ("Obaveštenja na
 // telefon"); "slanje" is left to the send check.
 const sending = (...roles: NotificationRole[]) => serve(Object.fromEntries(roles.map(role => [role, { push_enabled: true }])));
 it('sending on for both sets but this phone not connected says the phone first, and the step is to connect it', async () => {
  sending('REQUESTER', 'WORKER'); await mount();
  expect(screenText()).toContain('Ovaj telefon još nije povezan');
  await toggleDetails();
  expect(screenText()).toContain('Obaveštenja na telefon su uključena.');
  expect(screenText()).not.toContain('Ovaj telefon je povezan');
  expect(button('Uključi obaveštenja na telefonu')).toBeUndefined();
  expect(button('Poveži ovaj telefon').props.disabled).toBe(false);
  // Connecting is the same explicit command: it asks the phone once, registers it and writes nothing else.
  await act(async () => { button('Poveži ovaj telefon').props.onPress(); await flush(); });
  expect(mockNative).toHaveBeenCalledWith(true, expect.any(Function)); expect(mockSet).toHaveBeenCalledTimes(1); expect(mockSave).not.toHaveBeenCalled();
 });
 it('a connected phone says the account\'s choice once, in a headline without a period', async () => {
  sending('REQUESTER', 'WORKER'); mockGet.mockResolvedValue({ ok: true, podatak: { exists: true, revision: 1, active: true, sessionBound: true } });
  await mount();
  const titles = tree.root.findAllByType('Text' as never).map(node => node.props.children);
  expect(titles).toContain('Obaveštenja su uključena');
  await toggleDetails();
  expect(screenText()).toContain('Ovaj telefon je povezan sa tvojim nalogom.');
  expect(button('Poveži ovaj telefon')).toBeUndefined();
  await openPhoneManagement();
  expect(button('Isključi obaveštenja na telefonu')).toBeDefined();
 });
 it('a phone sent the notifications of one set only says which, and its step is to switch the other on', async () => {
  sending('WORKER'); mockGet.mockResolvedValue({ ok: true, podatak: { exists: true, revision: 1, active: true, sessionBound: true } });
  await mount();
  expect(screenText()).toContain('Obaveštenja su delimično uključena');
  await toggleDetails();
  expect(screenText()).toContain('Obaveštenja stižu samo za „Kad uskačeš“.');
  await act(async () => { button('Uključi obaveštenja na telefonu').props.onPress(); await flush(); });
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave).toHaveBeenCalledWith(USER, 'REQUESTER', { ...settings, push_enabled: true }, 2);
 });
 it('on a device without notifications there is still nothing to press, and a set that sends elsewhere says so', async () => {
  sending('REQUESTER', 'WORKER'); mockNative.mockResolvedValue({ kind: 'UNSUPPORTED' }); await mount();
  expect(screenText()).toContain('Nije dostupno na ovom uređaju');
  await toggleDetails();
  expect(screenText()).toContain('Obaveštenja na telefon su uključena.');
  for (const label of ['Uključi obaveštenja na telefonu', 'Poveži ovaj telefon', 'Isključi obaveštenja na telefonu', 'Osveži']) expect(button(label)).toBeUndefined();
 });
 it('a phone that refuses notifications keeps the switch-off for sets that are on, under a headline that says so', async () => {
  sending('REQUESTER', 'WORKER'); mockNative.mockResolvedValue({ kind: 'DENIED' }); await mount();
  expect(screenText()).toContain('Telefon ne dozvoljava obaveštenja');
  await toggleDetails();
  expect(screenText()).toContain('Obaveštenja na telefon su uključena.');
  await openPhoneManagement();
  expect(button('Isključi obaveštenja na telefonu')).toBeDefined();
 });
 it('an unconfirmed state offers one re-read, and says "Prvo pokušaj ponovo." once, on Save', async () => {
  await mount(); await openPhoneManagement(); await pressCategory('Dogovor i poruke');
  mockSave.mockRejectedValueOnce(Error('lost acknowledgement'));
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(button('Pokušaj ponovo').props.disabled).toBe(false);
  expect(button('Osveži')).toBeUndefined();
  expect(screenText()).toContain('Poslednje potvrđeno stanje');
  // The save cannot be the way forward (it is locked too), so the wait points at the check. Round 5c: only Save says it;
  // the phone button stands right under the alert and "Pokušaj ponovo", and a second copy was spoken twice in a row.
  expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(true);
  expect(button('Uključi obaveštenja na telefonu').props.reason).toBeNull();
  expect(button('Sačuvaj podešavanja').props.reason).toBe('Prvo pokušaj ponovo.');
 });
 // The disclosure of the phone's commands follows the capability of the phone.
 it('open phone commands follow capability changes without opting in or retaining a connected claim', async () => {
  const onEdit = jest.fn(), onSave = jest.fn(), onEnable = jest.fn(), onDisable = jest.fn(), onRefresh = jest.fn();
  const view = (native: 'READY' | 'UNSUPPORTED') => <PushPreferencesView signedIn deviceZone="Europe/Belgrade"
   data={{ settings: { REQUESTER: settings, WORKER: settings }, native, push: { state: 'none' }, registered: false, readiness: null }}
   busy={false} error={false} locked={false} dirty={false} validation={null} working={null} justSaved={false}
   onEdit={onEdit} onSave={onSave} onEnable={onEnable} onDisable={onDisable} onRefresh={onRefresh} />;
  await act(async () => { tree = Renderer.create(view('READY')); });
  await openPhoneManagement();
  expect(button('Uključi obaveštenja na telefonu')).toBeDefined(); expect(button('Osveži')).toBeDefined();
  await act(async () => { tree.update(view('UNSUPPORTED')); });
  expect(screenText()).toContain('Nije dostupno na ovom uređaju');
  expect(screenText()).not.toContain('Obaveštenja su uključena');
  expect(button('Uključi obaveštenja na telefonu')).toBeUndefined(); expect(button('Osveži')).toBeUndefined();
  expect(button('Isključi obaveštenja na telefonu')).toBeUndefined();
  await act(async () => { tree.update(view('READY')); });
  expect(button('Uključi obaveštenja na telefonu')).toBeDefined();
  expect(button('Isključi obaveštenja na telefonu')).toBeUndefined();
  for (const callback of [onEdit, onSave, onEnable, onDisable, onRefresh]) expect(callback).not.toHaveBeenCalled();
 });
});

describe('saving', () => {
 it('clean settings leave the choices visible; one sticky Save appears after an edit', async () => {
  await mount();
  expect(button('Sačuvaj podešavanja')).toBeUndefined();
  expect(tree.root.findAllByProps({ testID: 'settings-primary-footer' })).toHaveLength(0);
  await pressCategory('Dogovor i poruke');
  const save = button('Sačuvaj podešavanja');
  expect(StyleSheet.flatten(save.props.style).backgroundColor).toBe(sys.color.green);
  expect(save.props.disabled).toBe(false);
  expect(save.props.reason).toBeNull();
  expect(tree.root.findByProps({ testID: 'settings-primary-footer' }).findAllByType('Button' as never).map(x => x.props.label)).toEqual(['Sačuvaj podešavanja']);
  const greens = tree.root.findAllByType('Button' as never).filter(x => StyleSheet.flatten(x.props.style)?.backgroundColor === sys.color.green);
  expect(greens).toHaveLength(1);
 });
 it('reports unsaved changes to the route, and shows the check only once the saved values are read back', async () => {
  const dirty = jest.fn(); await mount(dirty);
  expect(dirty).toHaveBeenLastCalledWith(false);
  await pressCategory('Dogovor i poruke');
  expect(dirty).toHaveBeenLastCalledWith(true);
  let answer!: (value: unknown) => void; mockSave.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(button('Sačuvaj podešavanja').props.loading).toBe(true); expect(button('Sačuvaj podešavanja').props.success).toBe(false);
  // Round-5 review: the change is on its way while it saves, so the route must not offer to throw it away.
  expect(dirty).toHaveBeenLastCalledWith(false);
  expect(screenText()).not.toContain('Podešavanja su sačuvana.');
  held.REQUESTER = record('REQUESTER', { dogovor_enabled: false }, 3);
  await act(async () => { answer(held.REQUESTER); await flush(); });
  expect(button('Sačuvaj podešavanja').props.success).toBe(true);
  expect(control('Dogovor i poruke, kad objavljuješ').props.accessibilityState.checked).toBe(false);
  expect(dirty).toHaveBeenLastCalledWith(false);
  // The confirmed save is said in words, and the grey button no longer claims it waits for a change (that sentence was
  // what a screen reader heard after every save).
  const saved = tree.root.findAllByType('Text' as never).find(node => node.props.children === 'Podešavanja su sačuvana.')!;
  expect(saved.props.tone).toBe('success'); expect(saved.props.accessibilityLiveRegion).toBe('polite');
  expect(button('Sačuvaj podešavanja').props.reason).toBeNull();
  await pressCategory('Završetak zadatka');
  expect(button('Sačuvaj podešavanja').props.success).toBe(false);
  expect(screenText()).not.toContain('Podešavanja su sačuvana.');
 });
 it('after an unconfirmed save the route is not told the changes are unsaved, so Back does not claim they are', async () => {
  const dirty = jest.fn(); await mount(dirty);
  await pressCategory('Dogovor i poruke');
  expect(dirty).toHaveBeenLastCalledWith(true);
  mockSave.mockRejectedValueOnce(Error('lost acknowledgement'));
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(button('Pokušaj ponovo')).toBeDefined();
  expect(dirty).toHaveBeenLastCalledWith(false);
 });
 it('a preference write with unknown outcome requires authoritative readback instead of a blind second write', async () => {
  await mount(); let done!: (value: unknown) => void; mockSave.mockReturnValueOnce(new Promise(resolve => { done = resolve; }));
  await pressCategory('Dogovor i poruke'); const save = button('Sačuvaj podešavanja').props.onPress;
  await act(async () => { save(); await flush(); });
  expect(mockSave).toHaveBeenCalledTimes(1);
  mockAccount = { user: { id: USER }, accountRevision: 3 };
  await act(async () => { tree.update(<PushPreferences />); await flush(); });
  done({ ...held.REQUESTER, revision: 3 }); await act(flush);
  expect(mockSave).toHaveBeenCalledTimes(1);
 });
 // Round 5c (2026-09-24): a reason that disappears while a command runs comes back afterwards and is spoken again.
 it('a clean phone refresh does not introduce a Save action or repeat an irrelevant announcement', async () => {
  await mount(); await openPhoneManagement();
  expect(button('Sačuvaj podešavanja')).toBeUndefined();
  let answer!: (value: unknown) => void; mockRead.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
  await act(async () => { button('Osveži').props.onPress(); await flush(); });
  expect(button('Osveži').props.loading).toBe(true);
  expect(button('Sačuvaj podešavanja')).toBeUndefined();
  await act(async () => { answer(held.REQUESTER); await flush(); });
  expect(button('Sačuvaj podešavanja')).toBeUndefined();
  // While Save itself runs it has no reason: the spinner is the answer.
  await pressCategory('Dogovor i poruke');
  mockSave.mockReturnValueOnce(new Promise(() => undefined));
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(button('Sačuvaj podešavanja').props.reason).toBeNull();
 });
 it('a retained press that is refused while another command runs does not take that command\'s spinner', async () => {
  await mount(); await openPhoneManagement();
  const refresh = button('Osveži').props.onPress;
  await pressCategory('Dogovor i poruke');
  let answer!: (value: unknown) => void; mockSave.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(button('Sačuvaj podešavanja').props.loading).toBe(true);
  const reads = mockRead.mock.calls.length;
  await act(async () => { refresh(); await flush(); });
  expect(mockRead).toHaveBeenCalledTimes(reads);
  // It used to move the spinner to "Osveži" and bring back "Proveravamo stanje…" in the middle of the save.
  expect(button('Sačuvaj podešavanja').props.loading).toBe(true);
  expect(button('Osveži').props.loading).toBe(false);
  expect(screenText()).not.toContain('Proveravamo stanje');
  await act(async () => { answer({ ...held.REQUESTER, revision: 3 }); await flush(); });
  expect(mockSave).toHaveBeenCalledTimes(1);
 });
 it('tells the route while a write runs, and never while it only reads', async () => {
  const writing = jest.fn();
  await act(async () => { tree = Renderer.create(<PushPreferences onWritingChange={writing} />); await flush(); });
  expect(writing).toHaveBeenLastCalledWith(false); expect(writing).not.toHaveBeenCalledWith(true);
  await pressCategory('Dogovor i poruke');
  let answer!: (value: unknown) => void; mockSave.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(writing).toHaveBeenLastCalledWith(true);
  await act(async () => { answer({ ...held.REQUESTER, revision: 3 }); await flush(); });
  expect(writing).toHaveBeenLastCalledWith(false);
 });
 it('while a command runs, the choices wait in muted words and are not faded a second time', async () => {
  await mount(); await pressCategory('Dogovor i poruke');
  mockSave.mockReturnValueOnce(new Promise(() => undefined));
  await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
  expect(control('Dogovor i poruke, kad objavljuješ').props.accessibilityState.disabled).toBe(true);
  const faded = tree.root.findAll(node => (node.type as unknown) === 'View' && (StyleSheet.flatten(node.props.style)?.opacity ?? 1) < 1);
  expect(faded).toHaveLength(0);
 });
 // Round 5c (2026-09-24): iOS ignores the live region, so there the saved line is said once when it appears; Android keeps
 // only the live region, so it is not heard twice.
 it('the saved line is announced once on iOS and left to the live region on Android', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  const view = (justSaved: boolean) => <PushPreferencesView signedIn deviceZone="Europe/Belgrade"
   data={{ settings: { REQUESTER: settings, WORKER: settings }, native: 'READY', push: { state: 'none' }, registered: false, readiness: null }}
   busy={false} error={false} locked={false} dirty={false} validation={null} working={null} justSaved={justSaved}
   onEdit={jest.fn()} onSave={jest.fn()} onEnable={jest.fn()} onDisable={jest.fn()} onRefresh={jest.fn()} onOpenSystemSettings={jest.fn()} />;
  const os = Platform.OS;
  try {
   (Platform as { OS: string }).OS = 'android';
   await act(async () => { tree = Renderer.create(view(false)); });
   await act(async () => { tree.update(view(true)); });
   expect(announce).not.toHaveBeenCalled();
   act(() => tree.unmount());
   (Platform as { OS: string }).OS = 'ios';
   await act(async () => { tree = Renderer.create(view(false)); });
   await act(async () => { tree.update(view(true)); });
   await act(async () => { tree.update(view(true)); });
   expect(announce).toHaveBeenCalledTimes(1); expect(announce).toHaveBeenCalledWith('Podešavanja su sačuvana.');
  } finally { (Platform as { OS: string }).OS = os; announce.mockRestore(); }
 });
});
