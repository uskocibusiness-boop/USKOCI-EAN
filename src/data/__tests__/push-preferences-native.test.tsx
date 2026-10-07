import React from 'react';
import { sys } from '../../ui/system/tokens';
import Renderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, AppState, Linking, Platform, StyleSheet } from 'react-native';
import { PushPreferences, PushPreferencesView } from '../../ui/notifications/PushPreferences';
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
const settings = {
 in_app_enabled: true, push_enabled: false, opportunities_enabled: true, responses_enabled: true, dogovor_enabled: true,
 execution_enabled: true, recovery_enabled: true, account_enabled: true, quiet_hours_enabled: true,
 quiet_start: '22:00:00', quiet_end: '07:00:00', quiet_timezone: 'Europe/Belgrade', urgent_overrides_quiet_hours: false,
};
const preferences = { userId: '11111111-1111-4111-8111-111111111111', roleContext: 'REQUESTER', exists: true, revision: 2, updatedAt: '2026-09-10T20:00:00Z', settings };
let tree: Renderer.ReactTestRenderer;
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const button = (label: string) => tree.root.findAllByType('Button' as never).find(x => x.props.label === label)!;
const control = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const openPhoneManagement = async () => {
 expect(control('Upravljanje telefonom').props.accessibilityState.expanded).toBe(false);
 await act(async () => { control('Upravljanje telefonom').props.onPress(); });
 expect(control('Upravljanje telefonom').props.accessibilityState.expanded).toBe(true);
};
async function mount(role: 'REQUESTER' | 'WORKER' = 'REQUESTER', onDirtyChange?: (dirty: boolean) => void) {
 await act(async () => { tree = Renderer.create(<PushPreferences role={role} onDirtyChange={onDirtyChange} />); await flush(); });
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
beforeEach(() => {
 jest.useRealTimers(); jest.resetAllMocks(); mockAccount = { user: { id: preferences.userId }, accountRevision: 1 };
 mockRead.mockResolvedValue(preferences); mockNative.mockResolvedValue({ kind: 'READY', token: 'ExpoPushToken[synthetic]', platform: 'ANDROID' });
 mockGet.mockResolvedValue({ ok: true, podatak: { exists: false, revision: 0, active: false, sessionBound: false } });
 mockReadiness.mockResolvedValue({ ok: false });
 mockSet.mockResolvedValue({ ok: true, podatak: { exists: true, revision: 1, active: true, sessionBound: true } }); mockSave.mockResolvedValue({ ...preferences, revision: 3 });
});
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); });
it('focus reads state without prompting, registering or changing consent', async () => { await mount(); expect(mockNative).toHaveBeenCalledWith(false, expect.any(Function)); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled(); });
it('a failed initial read can be retried without prompting or writing preferences', async () => {
 mockRead.mockRejectedValueOnce(Error('offline')); await mount();
 expect(button('Proveri stanje').props.disabled).toBe(false);
 await act(async () => { button('Proveri stanje').props.onPress(); await flush(); });
 expect(mockRead).toHaveBeenCalledTimes(2);
 expect(button('Proveri stanje')).toBeUndefined();
 expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(false);
 expect(mockNative).toHaveBeenCalledWith(false, expect.any(Function));
 expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
});
it('after an uncertain save only readback is available, and repeated retry taps start one read', async () => {
 await mount(); act(() => control('Dogovor i poruke').props.onPress());
 mockSave.mockRejectedValueOnce(Error('lost acknowledgement'));
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(button('Sačuvaj podešavanja').props.disabled).toBe(true);
 expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(true);
 expect(control('Početak tihih sati').props.accessibilityState.disabled).toBe(true);
 expect(button('Proveri stanje').props.disabled).toBe(false);
 let done!: (value: unknown) => void;
 mockRead.mockReturnValueOnce(new Promise(resolve => { done = resolve; }));
 const retry = button('Proveri stanje').props.onPress;
 await act(async () => { retry(); retry(); await flush(); });
 expect(mockRead).toHaveBeenCalledTimes(2);
 expect(button('Sačuvaj podešavanja').props.disabled).toBe(true);
 await act(async () => { done({ ...preferences, revision: 3, settings: { ...settings, dogovor_enabled: false } }); await flush(); });
 expect(control('Dogovor i poruke').props.accessibilityState.checked).toBe(false);
 expect(button('Sačuvaj podešavanja')).toBeUndefined();
 expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(false);
 expect(mockSave).toHaveBeenCalledTimes(1); expect(mockSet).not.toHaveBeenCalled();
});
it('explicit enable preserves category/quiet fields, registers once and writes role-scoped consent', async () => {
 await mount(); const onPress = button('Uključi obaveštenja na telefonu').props.onPress;
 await act(async () => { onPress(); onPress(); await flush(); });
 expect(mockSet).toHaveBeenCalledTimes(1); expect(mockSave).toHaveBeenCalledTimes(1);
 expect(mockSave).toHaveBeenCalledWith(preferences.userId, 'REQUESTER', { ...preferences.settings, push_enabled: true }, 2);
 expect(mockNative).toHaveBeenCalledWith(true, expect.any(Function));
});
it('OS denial never registers or opts in', async () => { await mount(); mockNative.mockResolvedValue({ kind: 'DENIED' }); await act(async () => { button('Uključi obaveštenja na telefonu').props.onPress(); await flush(); }); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled(); });
it('unknown registration clears action and requires readback; retained callback cannot resend', async () => {
 await mount(); const old = button('Uključi obaveštenja na telefonu').props.onPress; mockSet.mockResolvedValue({ ok: false });
 // The settings are no longer wiped off the screen by an unconfirmed outcome, so the control is
 // still there — locked until the state is read back, which is what it was protecting.
 await act(async () => { old(); await flush(); }); expect(button('Proveri stanje')).toBeDefined();
 expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(true);
 await act(async () => { old(); await flush(); }); expect(mockSet).toHaveBeenCalledTimes(1); expect(mockSave).not.toHaveBeenCalled();
});
it('blur during permission/registration prevents later preference opt-in', async () => {
 await mount(); let done!: (value: unknown) => void; mockSet.mockReturnValue(new Promise(r => { done = r; }));
 await act(async () => { button('Uključi obaveštenja na telefonu').props.onPress(); await flush(); });
 act(() => mockBlur?.()); done({ ok: true, podatak: {} }); await act(flush); expect(mockSave).not.toHaveBeenCalled();
});
it('account ABA while registration is pending cannot write preferences or expose old device state', async () => {
 await mount(); let done!: (value: unknown) => void; mockSet.mockReturnValue(new Promise(r => { done = r; }));
 await act(async () => { button('Uključi obaveštenja na telefonu').props.onPress(); await flush(); });
 mockAccount = { user: { id: preferences.userId }, accountRevision: 3 }; await act(async () => { tree.update(<PushPreferences role="REQUESTER" />); await flush(); });
 done({ ok: true, podatak: {} }); await act(flush); expect(mockSave).not.toHaveBeenCalled();
});
it('role switch makes retained old action inert', async () => {
 await mount(); const old = button('Uključi obaveštenja na telefonu').props.onPress;
 act(() => { tree.update(<PushPreferences role="WORKER" />); }); await act(flush);
 await act(async () => { old(); await flush(); }); expect(mockSet).not.toHaveBeenCalled();
});
it('disable uses displayed revision and preserves all other settings', async () => {
 mockRead.mockResolvedValue({ ...preferences, settings: { ...preferences.settings, push_enabled: true } }); await mount();
 await openPhoneManagement();
 await act(async () => { button('Isključi za moje zadatke').props.onPress(); await flush(); }); expect(mockSave).toHaveBeenCalledWith(preferences.userId, 'REQUESTER', { ...preferences.settings, push_enabled: false }, 2); expect(mockSet).not.toHaveBeenCalled();
});
const screenText = () => tree.root.findAllByType('Text' as never).map(x => x.props.children).flat().join(' ');
const toggleDetails = async () => { await act(async () => { control('Detalji telefona i slanja').props.onPress(); }); };
it('reads actual transport evidence independently and never turns a healthy tick into device delivery', async () => {
 mockReadiness.mockResolvedValue({ ok: true, podatak: { state: 'OPERATIONAL', checkedAt: '2026-09-13T00:00:00Z' } });
 await mount(); expect(mockReadiness).toHaveBeenCalledTimes(1);
 expect(control('Detalji telefona i slanja').props.accessibilityState.expanded).toBe(false);
 expect(control('Dogovor i poruke').props.accessibilityState.checked).toBe(true);
 expect(screenText()).not.toContain('Sistem za slanje je radio pri poslednjoj proveri.');
 await toggleDetails();
 expect(control('Detalji telefona i slanja').props.accessibilityState.expanded).toBe(true);
 expect(screenText()).toContain('Sistem za slanje je radio pri poslednjoj proveri.');
 expect(screenText()).toContain('Ova provera ne potvrđuje da je obaveštenje stiglo na tvoj telefon.'); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
 await toggleDetails();
 expect(control('Detalji telefona i slanja').props.accessibilityState.expanded).toBe(false);
 expect(screenText()).not.toContain('Sistem za slanje je radio pri poslednjoj proveri.');
 expect(mockReadiness).toHaveBeenCalledTimes(1); expect(mockRead).toHaveBeenCalledTimes(1);
 expect(mockNative).not.toHaveBeenCalledWith(true, expect.any(Function));
 expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
});
it('transport failure preserves available device controls with honest missing evidence', async () => {
 mockReadiness.mockRejectedValue(Error('offline')); await mount(); await toggleDetails(); expect(screenText()).toContain('Rad sistema za slanje još nije potvrđen.');
 expect(button('Uključi obaveštenja na telefonu')).toBeDefined(); expect(mockSet).not.toHaveBeenCalled();
});
it('late transport result cannot replace a new account snapshot', async () => {
 let done!: (value: unknown) => void; mockReadiness.mockReturnValueOnce(new Promise(resolve => { done = resolve; }));
 await mount(); mockAccount = { user: { id: preferences.userId }, accountRevision: 3 };
 await act(async () => { tree.update(<PushPreferences role="REQUESTER" />); await flush(); });
 await act(async () => { done({ ok: true, podatak: { state: 'OPERATIONAL', checkedAt: '2026-09-13T00:00:00Z' } }); await flush(); });
 await toggleDetails(); // Inspect the new account's evidence, rather than merely a closed disclosure.
 expect(screenText()).not.toContain('Sistem za slanje je radio pri poslednjoj proveri.'); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
});

it('exposes category controls and saves an explicit opt-out without silently enabling push', async () => {
 await mount();
 act(() => control('Prijave i odgovori').props.onPress());
 expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(true);
 // The phone waits for the change to be saved first, and says so.
 expect(button('Uključi obaveštenja na telefonu').props.reason).toBe('Prvo sačuvaj izmene kategorija i tihih sati.');
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(mockSave).toHaveBeenCalledTimes(1);
 // The REQUESTER set has no "Novi zadaci" switch, and the value it would hold is written back unchanged.
 expect(mockSave).toHaveBeenCalledWith(preferences.userId, 'REQUESTER', { ...settings, responses_enabled: false }, 2);
 expect(mockNative).not.toHaveBeenCalledWith(true, expect.any(Function));
 expect(mockSet).not.toHaveBeenCalled();
});
it('saves overnight quiet hours, timezone and explicit HITNO override through the same revisioned settings writer', async () => {
 await mount();
 await pickTime('Početak tihih sati', 23, 15);
 await pickTime('Kraj tihih sati', 6, 45);
 // The zone is no longer typed by hand; the saved value is the one that was read back, and the
 // only way to change it is the explicit "use the phone's zone" action.
 act(() => control('Hitno može i tokom tihih sati').props.onPress());
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(mockSave).toHaveBeenCalledWith(preferences.userId, 'REQUESTER', {
  ...settings, quiet_start: '23:15', quiet_end: '06:45', urgent_overrides_quiet_hours: true,
 }, 2);
 expect(mockSet).not.toHaveBeenCalled();
// Two picker round trips and a save: an explicit budget, so a loaded machine does not fail it at Jest's 5 s default
// (seen in the round-5 review at 4.8 s).
}, 30_000);
it('enabled quiet hours refuse incomplete or malformed local times before any write', async () => {
 // A time can no longer be typed; a malformed one can still come back from the server, and it is never written on.
 mockRead.mockResolvedValue({ ...preferences, settings: { ...settings, quiet_start: '25:99' } }); await mount();
 act(() => control('Dogovor i poruke').props.onPress());
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(mockSave).not.toHaveBeenCalled(); expect(screenText()).toContain('Vreme tihih sati nije ispravno');
});
it('enabled quiet hours without an end are refused with a sentence that says what to pick', async () => {
 mockRead.mockResolvedValue({ ...preferences, settings: { ...settings, quiet_end: null } }); await mount();
 act(() => control('Dogovor i poruke').props.onPress());
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(mockSave).not.toHaveBeenCalled(); expect(screenText()).toContain('Za tihe sate izaberi početak i kraj.');
});
it('a preference write with unknown outcome requires authoritative readback instead of a blind second write', async () => {
 await mount(); let done!: (value: unknown) => void; mockSave.mockReturnValueOnce(new Promise(resolve => { done = resolve; }));
 act(() => control('Dogovor i poruke').props.onPress()); const save = button('Sačuvaj podešavanja').props.onPress;
 await act(async () => { save(); await flush(); });
 expect(mockSave).toHaveBeenCalledTimes(1);
 mockAccount = { user: { id: preferences.userId }, accountRevision: 3 };
 await act(async () => { tree.update(<PushPreferences role="REQUESTER" />); await flush(); });
 done({ ...preferences, revision: 3 }); await act(flush);
 expect(mockSave).toHaveBeenCalledTimes(1);
});

// Step 11a (2026-09-24): the look of the screen, over the same commands.
it('shows the "Novi zadaci" switch only in the set that receives new tasks', async () => {
 await mount('WORKER');
 expect(control('Novi zadaci')).toBeDefined();
 act(() => tree.unmount());
 await mount('REQUESTER');
 expect(tree.root.findAllByProps({ accessibilityLabel: 'Novi zadaci' })).toHaveLength(0);
 expect(screenText()).not.toContain('Nove prilike');
});
it('a switch row is one focus stop, spoken as a switch, drawn green on white instead of the platform teal', async () => {
 await mount();
 const row = control('Dogovor i poruke');
 expect(row.props.accessibilityRole).toBe('switch');
 expect(row.props.accessibilityState).toEqual({ checked: true, disabled: false });
 const drawn = row.findByProps({ importantForAccessibility: 'no-hide-descendants' });
 const toggle = drawn.findByProps({ value: true });
 expect(toggle.props.accessibilityLabel).toBeUndefined();
 expect(toggle.props.trackColor).toEqual({ false: sys.color.lineStrong, true: sys.color.green });
 expect(toggle.props.thumbColor).toBe(sys.color.surface);
});
it('clean settings leave the categories visible; one sticky Save appears after an edit', async () => {
 await mount();
 expect(button('Sačuvaj podešavanja')).toBeUndefined();
 expect(tree.root.findAllByProps({ testID: 'settings-primary-footer' })).toHaveLength(0);
 act(() => control('Dogovor i poruke').props.onPress());
 const save = button('Sačuvaj podešavanja');
 expect(StyleSheet.flatten(save.props.style).backgroundColor).toBe(sys.color.green);
 expect(save.props.disabled).toBe(false);
 expect(save.props.reason).toBeNull();
 expect(tree.root.findByProps({ testID: 'settings-primary-footer' }).findAllByType('Button' as never).map(x => x.props.label)).toEqual(['Sačuvaj podešavanja']);
 const greens = tree.root.findAllByType('Button' as never).filter(x => StyleSheet.flatten(x.props.style)?.backgroundColor === sys.color.green);
 expect(greens).toHaveLength(1);
});
it('reports unsaved changes to the route, and shows the check only once the saved values are read back', async () => {
 const dirty = jest.fn(); await mount('REQUESTER', dirty);
 expect(dirty).toHaveBeenLastCalledWith(false);
 act(() => control('Dogovor i poruke').props.onPress());
 expect(dirty).toHaveBeenLastCalledWith(true);
 let answer!: (value: unknown) => void; mockSave.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(button('Sačuvaj podešavanja').props.loading).toBe(true); expect(button('Sačuvaj podešavanja').props.success).toBe(false);
 // Round-5 review: the change is on its way while it saves, so the route must not offer to throw it away.
 expect(dirty).toHaveBeenLastCalledWith(false);
 expect(screenText()).not.toContain('Podešavanja su sačuvana.');
 mockRead.mockResolvedValueOnce({ ...preferences, revision: 3, settings: { ...settings, dogovor_enabled: false } });
 await act(async () => { answer({ ...preferences, revision: 3 }); await flush(); });
 expect(button('Sačuvaj podešavanja').props.success).toBe(true);
 expect(control('Dogovor i poruke').props.accessibilityState.checked).toBe(false);
 expect(dirty).toHaveBeenLastCalledWith(false);
 // The confirmed save is said in words, and the grey button no longer claims it waits for a change (that sentence was
 // what a screen reader heard after every save).
 const saved = tree.root.findAllByType('Text' as never).find(node => node.props.children === 'Podešavanja su sačuvana.')!;
 expect(saved.props.tone).toBe('success'); expect(saved.props.accessibilityLiveRegion).toBe('polite');
 expect(button('Sačuvaj podešavanja').props.reason).toBeNull();
 act(() => control('Izvršenje i završetak').props.onPress());
 expect(button('Sačuvaj podešavanja').props.success).toBe(false);
 expect(screenText()).not.toContain('Podešavanja su sačuvana.');
});
it('an emulator is told honestly that it cannot receive notifications, with nothing to press', async () => {
 mockNative.mockResolvedValue({ kind: 'UNSUPPORTED' }); await mount();
 expect(screenText()).toContain('Nije dostupno na ovom uređaju');
 for (const label of ['Uključi obaveštenja na telefonu', 'Isključi za moje zadatke', 'Podešavanja telefona', 'Osveži stanje']) expect(button(label)).toBeUndefined();
});
it('a phone that refuses notifications says so first and reads again when the person comes back from its settings', async () => {
 const listeners: ((state: string) => void)[] = [];
 const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: (state: string) => void) => {
  listeners.push(handler); return { remove: jest.fn() }; }) as never);
 try {
  mockNative.mockResolvedValue({ kind: 'DENIED' }); await mount();
  expect(screenText()).toContain('Telefon ne dozvoljava obaveštenja');
  expect(button('Podešavanja telefona')).toBeDefined(); expect(button('Uključi obaveštenja na telefonu')).toBeUndefined();
  expect(mockRead).toHaveBeenCalledTimes(1);
  mockNative.mockResolvedValue({ kind: 'READY', token: 'ExpoPushToken[synthetic]', platform: 'ANDROID' });
  await act(async () => { listeners.forEach(listener => listener('active')); await flush(); });
  expect(mockRead).toHaveBeenCalledTimes(2); expect(mockNative).toHaveBeenLastCalledWith(false, expect.any(Function));
  expect(button('Uključi obaveštenja na telefonu')).toBeDefined();
  expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
 } finally { spy.mockRestore(); }
});
it('failed OS settings launch leaves notification edits intact and never writes consent', async () => {
 const open = jest.spyOn(Linking, 'openSettings').mockRejectedValueOnce(Error('unavailable')).mockResolvedValue(undefined);
 try {
  mockNative.mockResolvedValue({ kind: 'DENIED' }); await mount();
  act(() => control('Dogovor i poruke').props.onPress());
  await act(async () => { button('Podešavanja telefona').props.onPress(); await flush(); });
  expect(button('Podešavanja telefona').props.error).toContain('Otvaranje podešavanja nije potvrđeno.');
  expect(control('Dogovor i poruke').props.accessibilityState.checked).toBe(false);
  expect(button('Sačuvaj podešavanja').props.disabled).toBe(false);
  await act(async () => { button('Podešavanja telefona').props.onPress(); await flush(); });
  expect(button('Podešavanja telefona').props.error).toBeNull();
  expect(open).toHaveBeenCalledTimes(2);
  expect(mockRead).toHaveBeenCalledTimes(1);
  expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
 } finally { open.mockRestore(); }
});
it('coming back to the app never reads over unsaved changes', async () => {
 const listeners: ((state: string) => void)[] = [];
 const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: (state: string) => void) => {
  listeners.push(handler); return { remove: jest.fn() }; }) as never);
 try {
  mockNative.mockResolvedValue({ kind: 'DENIED' }); await mount();
  act(() => control('Dogovor i poruke').props.onPress());
  await act(async () => { listeners.forEach(listener => listener('active')); await flush(); });
  expect(mockRead).toHaveBeenCalledTimes(1);
  expect(control('Dogovor i poruke').props.accessibilityState.checked).toBe(false);
 } finally { spy.mockRestore(); }
});

// Round-5 review (2026-09-24): the phone section never claims what this phone does not do, and names its set. Round 5c:
// the set's choice is said with the buttons' noun ("Obaveštenja na telefon"); "slanje" is left to the send check.
const on = { ...preferences, settings: { ...settings, push_enabled: true } };
it('sending on for the set but this phone not connected says the phone first, and the step is to connect it', async () => {
 mockRead.mockResolvedValue(on); await mount();
 expect(screenText()).toContain('Ovaj telefon još nije povezan');
 await toggleDetails();
 expect(screenText()).toContain('Obaveštenja na telefon su uključena za Moje zadatke.');
 expect(screenText()).not.toContain('Ovaj telefon je povezan');
 expect(button('Uključi obaveštenja na telefonu')).toBeUndefined();
 expect(button('Poveži ovaj telefon').props.disabled).toBe(false);
 // Connecting is the same explicit command: it asks the phone once, registers it and writes nothing else.
 await act(async () => { button('Poveži ovaj telefon').props.onPress(); await flush(); });
 expect(mockNative).toHaveBeenCalledWith(true, expect.any(Function)); expect(mockSet).toHaveBeenCalledTimes(1); expect(mockSave).not.toHaveBeenCalled();
});
it('a connected phone names the set its choice belongs to', async () => {
 mockRead.mockResolvedValue(on); mockGet.mockResolvedValue({ ok: true, podatak: { exists: true, revision: 1, active: true, sessionBound: true } });
 await mount('WORKER');
 // A short headline without a period, like the others; the set is in the sentence under it.
 const titles = tree.root.findAllByType('Text' as never).map(node => node.props.children);
 expect(titles).toContain('Obaveštenja su uključena');
 await toggleDetails();
 expect(screenText()).toContain('Važi za Moje prijave. Ovaj telefon je povezan sa tvojim nalogom.');
 expect(button('Isključi za moje prijave')).toBeDefined(); expect(button('Poveži ovaj telefon')).toBeUndefined();
});
it('on a device without notifications there is still nothing to press, and a set that sends elsewhere says so', async () => {
 mockRead.mockResolvedValue(on); mockNative.mockResolvedValue({ kind: 'UNSUPPORTED' }); await mount();
 expect(screenText()).toContain('Nije dostupno na ovom uređaju');
 await toggleDetails();
 expect(screenText()).toContain('Obaveštenja na telefon su uključena za Moje zadatke.');
 for (const label of ['Uključi obaveštenja na telefonu', 'Poveži ovaj telefon', 'Isključi za moje zadatke', 'Osveži stanje']) expect(button(label)).toBeUndefined();
});
it('a phone that refuses notifications keeps the switch-off for a set that is on, under a headline that says so', async () => {
 mockRead.mockResolvedValue(on); mockNative.mockResolvedValue({ kind: 'DENIED' }); await mount();
 expect(screenText()).toContain('Telefon ne dozvoljava obaveštenja');
 await toggleDetails();
 expect(screenText()).toContain('Obaveštenja na telefon su uključena za Moje zadatke.');
 await openPhoneManagement();
 expect(button('Isključi za moje zadatke')).toBeDefined();
});
it('an unconfirmed state offers one re-read, and says "Prvo proveri stanje." once, on Save', async () => {
 await mount(); await openPhoneManagement(); act(() => control('Dogovor i poruke').props.onPress());
 mockSave.mockRejectedValueOnce(Error('lost acknowledgement'));
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(button('Proveri stanje').props.disabled).toBe(false);
 expect(button('Osveži stanje')).toBeUndefined();
 // The save cannot be the way forward (it is locked too), so the wait points at the check. Round 5c: only Save says it;
 // the phone button stands right under the alert and "Proveri stanje", and a second copy was spoken twice in a row.
 expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(true);
 expect(button('Uključi obaveštenja na telefonu').props.reason).toBeNull();
 expect(button('Sačuvaj podešavanja').props.reason).toBe('Prvo proveri stanje.');
});
// Round 5c (2026-09-24): after an unconfirmed save it is not known whether the changes were saved.
it('after an unconfirmed save the route is not told the changes are unsaved, so Back does not claim they are', async () => {
 const dirty = jest.fn(); await mount('REQUESTER', dirty);
 act(() => control('Dogovor i poruke').props.onPress());
 expect(dirty).toHaveBeenLastCalledWith(true);
 mockSave.mockRejectedValueOnce(Error('lost acknowledgement'));
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(button('Proveri stanje')).toBeDefined();
 expect(dirty).toHaveBeenLastCalledWith(false);
});
// Round 5c (2026-09-24): a reason that disappears while a command runs comes back afterwards and is spoken again.
it('a clean phone refresh does not introduce a Save action or repeat an irrelevant announcement', async () => {
 await mount(); await openPhoneManagement();
 expect(button('Sačuvaj podešavanja')).toBeUndefined();
 let answer!: (value: unknown) => void; mockRead.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
 await act(async () => { button('Osveži stanje').props.onPress(); await flush(); });
 expect(button('Osveži stanje').props.loading).toBe(true);
 expect(button('Sačuvaj podešavanja')).toBeUndefined();
 await act(async () => { answer(preferences); await flush(); });
 expect(button('Sačuvaj podešavanja')).toBeUndefined();
 // While Save itself runs it has no reason: the spinner is the answer.
 act(() => control('Dogovor i poruke').props.onPress());
 mockSave.mockReturnValueOnce(new Promise(() => undefined));
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(button('Sačuvaj podešavanja').props.reason).toBeNull();
});
it('a retained press that is refused while another command runs does not take that command\'s spinner', async () => {
 await mount(); await openPhoneManagement();
 const refresh = button('Osveži stanje').props.onPress;
 act(() => control('Dogovor i poruke').props.onPress());
 let answer!: (value: unknown) => void; mockSave.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(button('Sačuvaj podešavanja').props.loading).toBe(true);
 const reads = mockRead.mock.calls.length;
 await act(async () => { refresh(); await flush(); });
 expect(mockRead).toHaveBeenCalledTimes(reads);
 // It used to move the spinner to "Osveži stanje" and bring back "Proveravamo stanje…" in the middle of the save.
 expect(button('Sačuvaj podešavanja').props.loading).toBe(true);
 expect(button('Osveži stanje').props.loading).toBe(false);
 expect(screenText()).not.toContain('Proveravamo stanje');
 await act(async () => { answer({ ...preferences, revision: 3 }); await flush(); });
 expect(mockSave).toHaveBeenCalledTimes(1);
});
it('tells the route while a write runs, and never while it only reads', async () => {
 const writing = jest.fn();
 await act(async () => { tree = Renderer.create(<PushPreferences role="REQUESTER" onWritingChange={writing} />); await flush(); });
 expect(writing).toHaveBeenLastCalledWith(false); expect(writing).not.toHaveBeenCalledWith(true);
 act(() => control('Dogovor i poruke').props.onPress());
 let answer!: (value: unknown) => void; mockSave.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(writing).toHaveBeenLastCalledWith(true);
 await act(async () => { answer({ ...preferences, revision: 3 }); await flush(); });
 expect(writing).toHaveBeenLastCalledWith(false);
});
it('while a command runs, the choices wait in muted words and are not faded a second time', async () => {
 await mount(); act(() => control('Dogovor i poruke').props.onPress());
 mockSave.mockReturnValueOnce(new Promise(() => undefined));
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(control('Dogovor i poruke').props.accessibilityState.disabled).toBe(true);
 const faded = tree.root.findAll(node => (node.type as unknown) === 'View' && (StyleSheet.flatten(node.props.style)?.opacity ?? 1) < 1);
 expect(faded).toHaveLength(0);
});
it('the note about every category stands under the first category group, and the send check is a heading', async () => {
 await mount();
 const copy = screenText();
 const note = copy.indexOf('Isključena kategorija ne stiže ni u aplikaciju ni na telefon.');
 expect(note).toBeGreaterThan(copy.indexOf('Prijave i odgovori')); expect(note).toBeLessThan(copy.indexOf('Dogovor i poruke'));
 await toggleDetails();
 expect(tree.root.findAllByType('Text' as never).find(node => node.props.children === 'Poslednja provera slanja')!.props.accessibilityRole).toBe('header');
});

// The quiet-hours zone is shown only where it matters and is changed only by the explicit "use the phone's zone".
const phoneZone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } })();
it('a zone that is not the phone\'s is shown with quiet hours on, hidden with them off, and replaced only on request', async () => {
 const away = phoneZone === 'Pacific/Chatham' ? 'Pacific/Easter' : 'Pacific/Chatham';
 mockRead.mockResolvedValue({ ...preferences, settings: { ...settings, quiet_timezone: away } }); await mount();
 expect(screenText()).toContain('Vremenska zona tihih sati');
 expect(screenText()).toContain(away.split('/')[1]);
 const use = tree.root.findAllByType('Button' as never).find(node => String(node.props.label).startsWith('Koristi zonu telefona'));
 if (!phoneZone) { expect(use).toBeUndefined(); return; }
 await act(async () => { use!.props.onPress(); });
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(mockSave).toHaveBeenCalledWith(preferences.userId, 'REQUESTER', { ...settings, quiet_timezone: phoneZone }, 2);
 act(() => tree.unmount());
 mockRead.mockResolvedValue({ ...preferences, settings: { ...settings, quiet_timezone: away, quiet_hours_enabled: false } }); await mount();
 expect(screenText()).not.toContain('Vremenska zona tihih sati');
 expect(tree.root.findAllByType('Button' as never).filter(node => String(node.props.label).startsWith('Koristi zonu telefona'))).toHaveLength(0);
});
it('an empty zone (the reader refuses one, so only a draft could hold it) says "Nije izabrana." next to its fix', async () => {
 const onEdit = jest.fn();
 await act(async () => { tree = Renderer.create(<PushPreferencesView role="REQUESTER" signedIn deviceZone="Europe/Belgrade"
  data={{ settings: { ...settings, quiet_timezone: '' }, native: 'READY', enabled: false, registered: false, readiness: null }}
  busy={false} error={false} locked={false} dirty={false} validation={null} working={null} justSaved={false}
  onEdit={onEdit} onSave={jest.fn()} onEnable={jest.fn()} onDisable={jest.fn()} onRefresh={jest.fn()} onOpenSystemSettings={jest.fn()} />); });
 expect(screenText()).toContain('Nije izabrana.');
 await act(async () => { button('Koristi zonu telefona (Vreme u Srbiji)').props.onPress(); });
 expect(onEdit).toHaveBeenCalledWith('quiet_timezone', 'Europe/Belgrade');
});
// Round 5c (2026-09-24): iOS ignores the live region, so there the saved line is said once when it appears; Android keeps
// only the live region, so it is not heard twice.
it('the saved line is announced once on iOS and left to the live region on Android', async () => {
 const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
 const view = (justSaved: boolean) => <PushPreferencesView role="REQUESTER" signedIn deviceZone="Europe/Belgrade"
  data={{ settings, native: 'READY', enabled: false, registered: false, readiness: null }}
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


it('open phone details follow capability changes without opting in or retaining a connected claim', async () => {
 const onEdit = jest.fn(), onSave = jest.fn(), onEnable = jest.fn(), onDisable = jest.fn(), onRefresh = jest.fn();
 const view = (native: 'READY' | 'UNSUPPORTED') => <PushPreferencesView role="REQUESTER" signedIn deviceZone="Europe/Belgrade"
  data={{ settings, native, enabled: false, registered: false, readiness: null }}
  busy={false} error={false} locked={false} dirty={false} validation={null} working={null} justSaved={false}
  onEdit={onEdit} onSave={onSave} onEnable={onEnable} onDisable={onDisable} onRefresh={onRefresh} />;
 await act(async () => { tree = Renderer.create(view('READY')); });
 await toggleDetails();
 expect(button('Uključi obaveštenja na telefonu')).toBeDefined();
 await act(async () => { tree.update(view('UNSUPPORTED')); });
 expect(control('Detalji telefona i slanja').props.accessibilityState.expanded).toBe(true);
 expect(screenText()).toContain('Nije dostupno na ovom uređaju');
 expect(screenText()).not.toContain('Obaveštenja su uključena');
 expect(button('Uključi obaveštenja na telefonu')).toBeUndefined();
 expect(button('Isključi za moje zadatke')).toBeUndefined();
 await act(async () => { tree.update(view('READY')); });
 expect(button('Uključi obaveštenja na telefonu')).toBeDefined();
 expect(button('Isključi za moje zadatke')).toBeUndefined();
 for (const callback of [onEdit, onSave, onEnable, onDisable, onRefresh]) expect(callback).not.toHaveBeenCalled();
});
