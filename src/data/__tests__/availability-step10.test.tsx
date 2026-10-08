import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerAvailability } from '../../contracts/workerAvailability';

/**
 * Owner step 10 (2026-09-24): Dostupnost za rad. The week is filled by copying a day (critique A18), the editors are the
 * one sheet engine and ask before dropping input, the zone is said only outside Serbian time (A19), and leaving the
 * screen with unsaved changes asks first (A17).
 */
const mockBack: { handlers: (() => boolean)[] } = { handlers: [] };
let mockFontScale = 1;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: mockFontScale });
    if (key === 'BackHandler') return { addEventListener: (_: string, handler: () => boolean) => {
      mockBack.handlers.push(handler);
      return { remove: () => { mockBack.handlers = mockBack.handlers.filter(item => item !== handler); } };
    } };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Modal', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), navigate: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, []) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: 'owned-account' }, accountRevision: 0 }) }));
jest.mock('../workerAvailabilityClientService', () => ({ workerAvailabilityClientService: { read: jest.fn(), save: jest.fn() } }));
jest.mock('../ownProfileClientService', () => ({ ownProfileClientService: { read: jest.fn() } }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: () => ({ data: null, loading: false, error: false, refresh: jest.fn() }) }));
let mockEditor: Record<string, unknown> = {};
jest.mock('../../hooks/useOwnedEditor', () => ({ useOwnedEditor: () => mockEditor }));

import { router } from 'expo-router';
import Dostupnost from '../../app/(app)/profil/dostupnost';
import { AvailabilityForm, RuleSheet } from '../../ui/calendar/AvailabilityForm';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';

const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'];
const rule = (id: string, weekdays: number[], startTime: string, endTime: string) =>
  ({ id, weekdays, startTime, endTime, startsOn: '2026-09-01', endsOn: null, label: '', active: true });
const availability = (patch: Partial<WorkerAvailability> = {}): WorkerAvailability => ({ accountId: 'owned-account', profileId: 'owned-profile',
  revision: 'a'.repeat(64), timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [], ...patch });
let tree: ReactTestRenderer;
const all = (label: string) => tree.root.findAll(node => node.props.label === label || node.props.accessibilityLabel === label);
const host = (label: string) => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityLabel === label)[0];
const press = async (label: string) => { await act(async () => all(label)[0].props.onPress()); };
// Updated deliberately (review of owner step 10): a day row with slots is named by its day and speaks its slots as its
// value ("Prikaži termine — Ponedeljak" was wrong once the day was open), so it is found by its name and its `expanded`.
const dayRow = (name: string) => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityLabel === name
  && node.props.accessibilityRole === 'button' && node.props.accessibilityState && 'expanded' in node.props.accessibilityState)[0];
const openDay = async (name: string) => { await act(async () => dayRow(name).props.onPress()); };
const toggleCopyOptions = async () => { await act(async () => host('Kopiraj termine…').props.onPress()); };
/** A day of a sheet's day picker (a checkbox), not the day row of the week behind the sheet. */
const pick = async (name: string) => { await act(async () => tree.root.findAll(node => node.type === ('Press' as React.ElementType)
  && node.props.accessibilityRole === 'checkbox' && node.props.accessibilityLabel === name)[0].props.onPress()); };
const edit = async (label: string, value: string) => { await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onChangeText(value)); };
const text = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const form = async (value = availability(), extra: Partial<React.ComponentProps<typeof AvailabilityForm>> = {}) => {
  const onSave = jest.fn();
  await act(async () => { tree = create(<AvailabilityForm availability={value} busy={false} uncertain={false} onSave={onSave} {...extra} />); });
  return onSave;
};
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.clearAllMocks(); mockBack.handlers = []; mockFontScale = 1; });

describe('P5: a calendar edit belongs to the draft it opened', () => {
  it.each(['delete', 'copy'])('a retained %s confirmation cannot replace a newly read schedule', async operation => {
    const previous = availability({ rules: [rule(ids[0], [1], '09:00', '17:00'), rule(ids[1], [2], '10:00', '14:00')] });
    const fresh = availability({ revision: 'b'.repeat(64), rules: [rule(ids[0], [1], '09:00', '17:00'), rule(ids[2], [2], '18:00', '20:00')] });
    const onSave = await form(previous, { candidateMode: true });
    await openDay('Ponedeljak');
    if (operation === 'copy') await toggleCopyOptions();
    await press(operation === 'delete' ? 'Ukloni Ponedeljak 09:00' : 'Isto za sve radne dane kao Ponedeljak');
    const retainedConfirm = tree.root.findByType(ConfirmSheet).props.onConfirm;
    await act(async () => tree.update(<AvailabilityForm availability={fresh} busy={false} uncertain={false} candidateMode onSave={onSave} />));
    await act(async () => retainedConfirm());
    await act(async () => tree.root.findByType('Switch' as React.ElementType).props.onValueChange(true));
    await press('Primeni na pregled profila');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].rules).toEqual(fresh.rules.map(item => ({ ...item, startTime: `${item.startTime}:00`, endTime: `${item.endTime}:00` })));
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  it('a question retired by a read stays retired when the same schedule becomes editable again', async () => {
    const value = availability({ rules: [rule(ids[0], [1], '09:00', '17:00')] });
    const onSave = await form(value, { candidateMode: true });
    await openDay('Ponedeljak'); await press('Ukloni Ponedeljak 09:00');
    const retainedConfirm = tree.root.findByType(ConfirmSheet).props.onConfirm;
    await act(async () => tree.update(<AvailabilityForm availability={value} busy={false} uncertain={false} candidateMode refreshing onSave={onSave} />));
    await act(async () => tree.update(<AvailabilityForm availability={value} busy={false} uncertain={false} candidateMode onSave={onSave} />));
    await act(async () => retainedConfirm());
    await act(async () => tree.root.findByType('Switch' as React.ElementType).props.onValueChange(true));
    await press('Primeni na pregled profila');
    expect(onSave.mock.calls[0][0].rules).toEqual(value.rules.map(item => ({ ...item, startTime: `${item.startTime}:00`, endTime: `${item.endTime}:00` })));
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  it('a dismissed term editor cannot later add its old draft to the current schedule', async () => {
    const onSave = await form(availability(), { candidateMode: true });
    await press('Dodaj — Ponedeljak');
    const dismissed = tree.root.findByType(RuleSheet).props;
    await act(async () => { dismissed.close(); dismissed.accept([rule(ids[0], [1], '09:00', '17:00')]); });
    await act(async () => tree.root.findByType('Switch' as React.ElementType).props.onValueChange(true));
    await press('Primeni na pregled profila');
    expect(onSave.mock.calls[0][0].rules).toEqual([]);
  });

  it('the current deletion still applies and saves only on explicit apply', async () => {
    const value = availability({ rules: [rule(ids[0], [1], '09:00', '17:00')] });
    const onSave = await form(value, { candidateMode: true });
    await openDay('Ponedeljak'); await press('Ukloni Ponedeljak 09:00'); await press('Ukloni');
    expect(onSave).not.toHaveBeenCalled();
    await press('Primeni na pregled profila');
    expect(onSave).toHaveBeenCalledTimes(1); expect(onSave.mock.calls[0][0].rules).toEqual([]);
  });

  it('the current draft remains editable after StrictMode remounts effects', async () => {
    const value = availability(), onSave = jest.fn();
    await act(async () => { tree = create(<React.StrictMode><AvailabilityForm availability={value} busy={false} uncertain={false}
      candidateMode onSave={onSave} /></React.StrictMode>); });
    await act(async () => tree.root.findByType('Switch' as React.ElementType).props.onValueChange(true));
    expect(onSave).not.toHaveBeenCalled(); await press('Primeni na pregled profila');
    expect(onSave).toHaveBeenCalledTimes(1); expect(onSave.mock.calls[0][0].availableNow).toBe(true);
  });
});

describe('the Termin sheet', () => {
  it('explains work over midnight only when the end is before the start', async () => {
    await form();
    await press('Dodaj — Ponedeljak');
    expect(text()).toContain('Novi termin');
    expect(text()).not.toContain('Kraj pre početka');
    await edit('Početak termina', '22:00'); await edit('Kraj termina', '02:00');
    expect(text()).toContain('Kraj pre početka znači rad preko ponoći.');
    await edit('Kraj termina', '23:00');
    expect(text()).not.toContain('Kraj pre početka');
  });

  it('draws the days as two rows of 48 px checkboxes', async () => {
    await form();
    await press('Dodaj — Sreda');
    const days = tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityRole === 'checkbox');
    expect(days.map(day => day.props.accessibilityLabel)).toEqual(['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja']);
    expect(days.find(day => day.props.accessibilityLabel === 'Sreda')!.props.accessibilityState).toEqual({ checked: true });
  });

  it('asks before throwing away what was typed when the sheet is closed by Back', async () => {
    await form();
    await press('Dodaj — Ponedeljak');
    await edit('Početak termina', '09:00');
    await act(async () => tree.root.findByType('Modal' as React.ElementType).props.onRequestClose());
    expect(text()).toContain('Odbaciti izmene?');
    expect(all('Nastavi uređivanje')).not.toHaveLength(0);
  });

  it('keeps the day just filled open and its copy options available on demand', async () => {
    await form();
    await press('Dodaj — Utorak');
    await edit('Početak termina', '09:00'); await edit('Kraj termina', '17:00');
    await press('Primeni termin');
    expect(dayRow('Utorak').props.accessibilityState.expanded).toBe(true);
    expect(all('Isto za sve radne dane kao Utorak')).toHaveLength(0);
    expect(host('Kopiraj termine…').props.accessibilityState.expanded).toBe(false);
    await toggleCopyOptions();
    expect(all('Isto za sve radne dane kao Utorak')).not.toHaveLength(0);
  });
});

describe('the zone line', () => {
  it('is quiet for a Serbian schedule on a phone in Serbian time, in the form and in both sheets', async () => {
    await form(availability(), { phoneZone: 'Europe/Belgrade' });
    expect(text()).not.toContain('Po vremenu u Srbiji');
    await press('Dodaj — Ponedeljak');
    expect(text()).not.toContain('Po vremenu u Srbiji');
    await press('Odustani od termina');
    await press('Dodaj datum');
    expect(text()).toContain('Redovni termini ostaju sačuvani.'); expect(text()).not.toContain('Po vremenu u Srbiji');
  });
  it('says Serbian time on a phone set elsewhere', async () => {
    await form(availability(), { phoneZone: 'Europe/Vienna' });
    expect(text()).toContain('Po vremenu u Srbiji.');
  });
});

describe('the Poseban datum sheet', () => {
  it('lets a new special date end on the day it starts, and never moves the end of a saved one', async () => {
    await form();
    await press('Dodaj datum');
    await edit('Datum početka', '2026-10-02');
    expect(tree.root.findByProps({ accessibilityLabel: 'Datum kraja' }).props.value).toBe('2026-10-02');
    expect(text()).toContain('Poseban datum ima prednost nad redovnom nedeljom i ne otkazuje postojeće Dogovore. Potvrđen termin ostaje obaveza.');
    await press('Odustani od datuma');
    await act(async () => tree.unmount());
    await form(availability({ windows: [{ id: ids[1], startsAt: '2026-10-02T07:30:00Z', endsAt: '2026-10-03T10:00:00Z', state: 'UNAVAILABLE', label: '' }] }));
    await press('Uredi datum 2. okt');
    await edit('Datum početka', '2026-10-01');
    expect(tree.root.findByProps({ accessibilityLabel: 'Datum kraja' }).props.value).toBe('2026-10-03');
  });

  it('lists a past special date quietly, after the coming ones, marked "Prošlo"', async () => {
    await form(availability({ windows: [
      { id: ids[0], startsAt: '2020-01-10T08:00:00Z', endsAt: '2020-01-10T10:00:00Z', state: 'UNAVAILABLE', label: 'Staro' },
      { id: ids[1], startsAt: '2099-01-10T08:00:00Z', endsAt: '2099-01-10T10:00:00Z', state: 'AVAILABLE', label: '' },
    ] }));
    expect(text()).toContain('Prošlo · Zauzeto · Staro'); expect(text()).toContain('Slobodno za rad');
    const rows = tree.root.findAll(node => node.type === ('Press' as React.ElementType) && /^Uredi datum /.test(String(node.props.accessibilityLabel)));
    expect(rows.map(row => row.props.accessibilityLabel)).toEqual(['Uredi datum 10. jan 2099', 'Uredi datum 10. jan 2020']);
  });

  it('says there are none in one line, and still offers to add one', async () => {
    await form();
    expect(text()).toContain('Nema posebnih datuma.');
    expect(all('Dodaj datum')).not.toHaveLength(0);
    expect(all('Prikaži posebne datume')).toHaveLength(0);
  });
});

describe('copy actions disclosure', () => {
  it('does not dirty or save availability and closes when the day is closed', async () => {
    const onDirtyChange = jest.fn();
    const onSave = await form(availability({ rules: [rule(ids[0], [1], '09:00', '17:00')] }), { onDirtyChange });
    await openDay('Ponedeljak');
    expect(all('Isto za sve radne dane kao Ponedeljak')).toHaveLength(0);
    await toggleCopyOptions();
    expect(host('Kopiraj termine…').props.accessibilityState.expanded).toBe(true);
    expect(all('Isto za sve radne dane kao Ponedeljak')).not.toHaveLength(0);
    expect(all('Kopiraj Ponedeljak na druge dane')).not.toHaveLength(0);
    await openDay('Ponedeljak'); await openDay('Ponedeljak');
    expect(host('Kopiraj termine…').props.accessibilityState.expanded).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    expect(onDirtyChange.mock.calls.some(([dirty]) => dirty === true)).toBe(false);
  });

  it('retires the opened copy options when a fresh schedule replaces its source', async () => {
    const previous = availability({ rules: [rule(ids[0], [1], '09:00', '17:00')] });
    const onSave = await form(previous);
    await openDay('Ponedeljak'); await toggleCopyOptions();
    const fresh = availability({ revision: 'b'.repeat(64), rules: [rule(ids[0], [1], '10:00', '18:00')] });
    await act(async () => tree.update(<AvailabilityForm availability={fresh} busy={false} uncertain={false} onSave={onSave} />));
    expect(host('Kopiraj termine…').props.accessibilityState.expanded).toBe(false);
    expect(all('Isto za sve radne dane kao Ponedeljak')).toHaveLength(0);
    expect(dayRow('Ponedeljak').props.accessibilityValue.text).toBe('10:00–18:00');
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('copying a day', () => {
  const week = () => availability({ rules: [rule(ids[0], [1], '09:00:00', '12:00:00'), rule(ids[1], [3], '13:00:00', '15:00:00')] });

  it('asks before "Isto za sve radne dane" replaces a day\'s own slots, and replaces them only on yes', async () => {
    const onSave = await form(week());
    await openDay('Ponedeljak');
    await toggleCopyOptions();
    await press('Isto za sve radne dane kao Ponedeljak');
    const ask = tree.root.findByType(ConfirmSheet);
    // Updated deliberately (review of owner step 10): weekdays are lower-case inside a Serbian sentence.
    expect(ask.props).toMatchObject({ title: 'Zameniti termine?', confirmLabel: 'Zameni', cancelLabel: 'Odustani',
      message: 'Utorak, sreda, četvrtak i petak dobijaju iste termine kao ponedeljak. Promena će se sačuvati tek kada sačuvaš dostupnost.' });
    await act(async () => ask.findByProps({ testID: 'confirm-sheet-cancel' }).props.onPress());
    expect(text()).toContain('13:00–15:00'); expect(text()).not.toContain('Imaš nesačuvane izmene.');
    await press('Isto za sve radne dane kao Ponedeljak');
    await act(async () => tree.root.findByType(ConfirmSheet).findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress());
    expect(text()).not.toContain('13:00–15:00');
    for (const day of ['Utorak', 'Sreda', 'Četvrtak', 'Petak']) expect(dayRow(day)).toBeTruthy();
    expect(host('Dodaj — Subota')).toBeTruthy();
    await press('Sačuvaj dostupnost');
    expect(onSave.mock.calls[0][0].rules).toEqual([rule(ids[0], [1, 2, 3, 4, 5], '09:00:00', '12:00:00')]);
  });

  it('copies at once when no chosen day loses a slot of its own', async () => {
    await form(availability({ rules: [rule(ids[0], [1], '09:00:00', '12:00:00')] }));
    await openDay('Ponedeljak');
    await toggleCopyOptions();
    await press('Isto za sve radne dane kao Ponedeljak');
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
    expect(dayRow('Petak')).toBeTruthy();
  });

  it('holds "Kopiraj" until a day is chosen, says why, and copies onto the chosen days', async () => {
    await form(week());
    await openDay('Ponedeljak');
    await toggleCopyOptions();
    await press('Kopiraj Ponedeljak na druge dane');
    expect(text()).toContain('Ponedeljak: 09:00–12:00');
    const copy = () => all('Kopiraj')[0];
    expect(copy().props).toMatchObject({ disabled: true, reason: 'Izaberi bar jedan dan.' });
    await act(async () => copy().props.onPress());
    expect(tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityLabel === 'Subota')).toHaveLength(1);
    await pick('Subota');
    expect(copy().props.disabled).toBe(false);
    expect(text()).not.toContain('Postojeći termini izabranih dana se zamenjuju.');
    await pick('Sreda');
    expect(text()).toContain('Postojeći termini izabranih dana se zamenjuju.');
    await press('Kopiraj');
    expect(dayRow('Subota')).toBeTruthy(); expect(text()).not.toContain('13:00–15:00');
    expect(text()).toContain('Imaš nesačuvane izmene.');
  });
});

describe('leaving Dostupnost', () => {
  const data = availability();
  const editor = (patch: Record<string, unknown> = {}) => ({ data, loading: false, busy: false, error: null, uncertain: false, saved: false,
    refresh: jest.fn().mockResolvedValue(undefined), save: jest.fn(), ...patch });
  const screen = async () => { await act(async () => { tree = create(<Dostupnost />); }); };
  const back = async () => { await act(async () => host('Nazad').props.onPress()); };
  const toggle = async () => { await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.onValueChange(true)); };

  it('saves "Mogu odmah" through the editor at once (owner decision 2026-09-24)', async () => {
    mockEditor = editor(); await screen();
    await toggle();
    expect(mockEditor.save).toHaveBeenCalledTimes(1);
  });

  it('goes back at once when nothing has changed', async () => {
    mockEditor = editor(); await screen();
    await back();
    expect(router.back).toHaveBeenCalledTimes(1); expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
    expect(mockBack.handlers[0]()).toBe(false);
  });

  it('asks before dropping unsaved changes, and leaves only on "Odbaci izmene"', async () => {
    mockEditor = editor(); await screen();
    await toggle();
    await back();
    expect(router.back).not.toHaveBeenCalled();
    const ask = tree.root.findByType(ConfirmSheet);
    expect(ask.props).toMatchObject({ title: 'Odbaciti izmene?', message: 'Unete izmene neće biti sačuvane.', confirmLabel: 'Odbaci izmene',
      cancelLabel: 'Nastavi uređivanje', tone: 'danger' });
    await act(async () => ask.findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress());
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('hears the hardware Back only while there is something to lose', async () => {
    mockEditor = editor(); await screen();
    expect(mockBack.handlers).toHaveLength(1);
    await toggle();
    let handled = false;
    await act(async () => { handled = mockBack.handlers[0](); });
    expect(handled).toBe(true); expect(tree.root.findByType(ConfirmSheet).props.title).toBe('Odbaciti izmene?');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('does not ask while a save runs: the editor settles the write either way', async () => {
    mockEditor = editor(); await screen();
    await toggle();
    mockEditor = editor({ busy: true });
    await act(async () => tree.update(<Dostupnost />));
    expect(mockBack.handlers[0]()).toBe(false);
    await back();
    expect(router.back).toHaveBeenCalledTimes(1); expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  it('shows a first read that failed as the shared error state, with the read again as its one action', async () => {
    mockEditor = editor({ data: null, error: 'Podaci nisu učitani. Proveri vezu i pokušaj ponovo.' }); await screen();
    expect(text()).toContain('Dostupnost nije učitana.'); expect(text()).toContain('Podaci nisu učitani.');
    await press('Pokušaj ponovo');
    expect(mockEditor.refresh).toHaveBeenCalledTimes(1);
  });

  // Review of owner step 10: after a save whose outcome was not confirmed, "Unete izmene neće biti sačuvane." could be
  // untrue (the save may have gone through), so Back leaves without that question; the next visit reads the saved state.
  it('does not claim the changes will be lost after a save that was not confirmed', async () => {
    mockEditor = editor(); await screen();
    await toggle();
    mockEditor = editor({ uncertain: true, error: 'Čuvanje nije potvrđeno. Proveri sačuvano stanje pre novog pokušaja.' });
    await act(async () => tree.update(<Dostupnost />));
    expect(mockBack.handlers[0]()).toBe(false);
    await back();
    expect(router.back).toHaveBeenCalledTimes(1); expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  // Review of owner step 10: without a work profile, reading again cannot help; the one action leads to the profile.
  it('leads to the work profile when there is none to read availability from', async () => {
    mockEditor = editor({ data: null, error: 'Najpre sačuvaj svoj radni profil.' }); await screen();
    // Round-5c: a precondition, not a failed read. Drawn as an empty state whose title is the whole message, said once.
    expect(text()).not.toContain('Dostupnost nije učitana.');
    expect(text().split('Najpre sačuvaj svoj radni profil.')).toHaveLength(2);
    expect(tree.root.findAll(node => node.props.kind === 'empty' && node.props.title === 'Najpre sačuvaj svoj radni profil.').length).toBeGreaterThan(0);
    expect(tree.root.findAll(node => node.props.kind === 'error')).toHaveLength(0);
    expect(all('Pokušaj ponovo')).toHaveLength(0);
    await press('Dopuni radni profil');
    expect(router.navigate).toHaveBeenCalledWith('/profil/radnik'); expect(mockEditor.refresh).not.toHaveBeenCalled();
    // The screen matches the words of the availability read's WORKER_PROFILE_REQUIRED; the two copies stay one.
    const service = readFileSync(join(__dirname, '../workerAvailabilityClientService.ts'), 'utf8');
    expect(service).toContain("WORKER_PROFILE_REQUIRED: 'Najpre sačuvaj svoj radni profil.'");
  });
});

// Review of owner step 10: a slot over midnight is two rules (22:00–24:00, then 00:00–06:00 on the next day). Copying the
// day used to end every night at midnight without saying so.
describe('copying a day with a slot over midnight', () => {
  const night = () => availability({ rules: [rule(ids[0], [1], '22:00:00', '24:00:00'),
    { ...rule(ids[1], [2], '00:00:00', '06:00:00'), startsOn: '2026-09-02' }] });

  it('copies the whole night onto the working days at once, since no day loses a slot of its own', async () => {
    const onSave = await form(night());
    await openDay('Ponedeljak');
    await toggleCopyOptions();
    await press('Isto za sve radne dane kao Ponedeljak');
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
    await press('Sačuvaj dostupnost');
    expect(onSave.mock.calls[0][0].rules).toEqual([rule(ids[0], [1, 2, 3, 4, 5], '22:00:00', '24:00:00'),
      { ...rule(ids[1], [2, 3, 4, 5, 6], '00:00:00', '06:00:00'), startsOn: '2026-09-02' }]);
  });

  it('does not say Utorak is replaced when it only holds the rest of Monday\'s night', async () => {
    await form(night());
    await openDay('Ponedeljak');
    await toggleCopyOptions();
    await press('Kopiraj Ponedeljak na druge dane');
    await pick('Utorak');
    expect(text()).not.toContain('Postojeći termini izabranih dana se zamenjuju.');
  });

  // Round-5c: copying a night puts its after-midnight part on the day after each chosen day, which "22:00–24:00" did not
  // show; the sheet, the question and the announcement say it.
  it('says the copied night goes on to the next day, in the sheet, the question and the announcement', async () => {
    const note = 'Noćni termin se nastavlja do 06:00 sledećeg dana.';
    const announce = jest.spyOn(jest.requireActual('react-native').AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    try {
      const week = availability({ rules: [...night().rules, rule(ids[2], [3], '09:00:00', '12:00:00')] });
      await form(week);
      await openDay('Ponedeljak');
      await toggleCopyOptions();
      await press('Kopiraj Ponedeljak na druge dane');
      expect(text()).toContain(note);
      await act(async () => tree.unmount());
      await form(week);
      await openDay('Ponedeljak');
      await toggleCopyOptions();
      await press('Isto za sve radne dane kao Ponedeljak');
      expect(tree.root.findByType(ConfirmSheet).props.message).toContain(`kao ponedeljak. ${note}`);
      await act(async () => tree.root.findByType(ConfirmSheet).props.onConfirm());
      expect(announce).toHaveBeenCalledWith(`Termini su kopirani na radne dane. ${note}`);
    } finally { announce.mockRestore(); }
  });

  it('says nothing of a night when the copied day has none', async () => {
    await form(availability({ rules: [rule(ids[0], [1], '09:00:00', '12:00:00')] }));
    await openDay('Ponedeljak');
    await toggleCopyOptions();
    await press('Kopiraj Ponedeljak na druge dane');
    expect(text()).not.toContain('Noćni termin');
  });
});

// Round-5c: a failed read says "…pokušaj ponovo", and the way to do it stands beside it while nothing is unsaved.
describe('a failed read', () => {
  const problem = 'Podaci nisu učitani. Proveri vezu i pokušaj ponovo.';
  it('offers "Pokušaj ponovo" beside the line, which reads again', async () => {
    const onRefresh = jest.fn();
    await form(availability(), { problem, onRefresh });
    await press('Pokušaj ponovo');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
  it('hides it over unsaved edits, and without a way to read', async () => {
    const onRefresh = jest.fn();
    await form(availability(), { problem, onRefresh });
    // An unsaved edit in the week ("Mogu odmah" saves on its own since the owner's decision of 2026-09-24).
    await press('Dodaj — Ponedeljak'); await edit('Početak termina', '09:00'); await edit('Kraj termina', '12:00');
    await press('Primeni termin');
    expect(all('Pokušaj ponovo')).toHaveLength(0);
    await act(async () => tree.unmount());
    await form(availability(), { problem });
    expect(all('Pokušaj ponovo')).toHaveLength(0);
  });
});

describe('what a screen reader hears', () => {
  it('names a day by its day and speaks its slots as the value, open or not', async () => {
    await form(availability({ rules: [rule(ids[0], [1], '09:00:00', '12:00:00')] }));
    expect(dayRow('Ponedeljak').props.accessibilityValue).toEqual({ text: '09:00–12:00' });
    expect(dayRow('Ponedeljak').props.accessibilityHint).toBeUndefined();
    await openDay('Ponedeljak');
    expect(dayRow('Ponedeljak').props.accessibilityState.expanded).toBe(true);
    expect(dayRow('Ponedeljak').props.accessibilityValue).toEqual({ text: '09:00–12:00' });
  });

  it('speaks every fact of a slot row and of a special-date row', async () => {
    await form(availability({
      rules: [{ ...rule(ids[0], [1, 3], '09:00:00', '12:00:00'), label: 'Jutro', active: false }],
      windows: [{ id: ids[1], startsAt: '2099-01-10T08:00:00Z', endsAt: '2099-01-10T10:00:00Z', state: 'AVAILABLE', label: 'Sajam' }],
    }));
    await openDay('Ponedeljak');
    expect(host('Uredi Ponedeljak 09:00').props.accessibilityValue.text)
      .toMatch(/^09:00–12:00, Jutro, Od 1\. sep( 2026)? · bez završnog datuma, Zajednički termin: ponedeljak, sreda, Pauzirano$/);
    expect(host('Uredi datum 10. jan 2099').props.accessibilityValue.text).toBe('10. jan 2099 · 09:00–11:00, Slobodno za rad · Sajam');
  });

  // Round-5c: the explanation is read as its own line, not as the switch's hint, which goes unheard with hints off.
  it('hears the "Mogu odmah" switch once, its explanation as a line of its own, and its words switch it too', async () => {
    const onSave = await form();
    const words = tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.importantForAccessibility === 'no')[0];
    expect(words.props.accessible).toBe(false); expect(words.props.accessibilityElementsHidden).toBeFalsy();
    const [label] = words.findAll(node => node.type === ('T' as React.ElementType));
    const explanation = tree.root.findAll(node => node.type === ('T' as React.ElementType)
      && typeof node.props.children === 'string' && node.props.children.includes('Čuva se odmah.'))[0];
    expect(label.props.children).toBe('Mogu odmah');
    expect(label.props.importantForAccessibility).toBe('no'); expect(label.props.accessibilityElementsHidden).toBe(true);
    expect(explanation.props.children).toContain('Čuva se odmah.');
    expect(explanation.props.importantForAccessibility).toBeUndefined(); expect(explanation.props.accessibilityElementsHidden).toBeUndefined();
    const toggle = tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' });
    expect(toggle.props.accessibilityHint).toBeUndefined();
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Mogu odmah')).toHaveLength(1);
    await act(async () => words.props.onPress());
    expect(tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.value).toBe(true);
    // Updated deliberately (owner decision 2026-09-24): the status saves on its own, from its words as from the switch.
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ availableNow: true }));
  });

  it('says a confirmed save out loud, since the focused Save leaves with its footer', async () => {
    const announce = jest.spyOn(jest.requireActual('react-native').AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    await form();
    await act(async () => tree.update(<AvailabilityForm availability={availability()} busy={false} uncertain={false} onSave={jest.fn()} saved />));
    expect(announce).toHaveBeenCalledWith('Dostupnost je sačuvana.');
    announce.mockRestore();
  });

  it('draws a sheet\'s error with its button, announced as it appears', async () => {
    await form();
    await press('Dodaj — Ponedeljak');
    await press('Primeni termin');
    const primary = all('Primeni termin').find(node => node.props.error !== undefined)!;
    expect(primary.props.error).toBe('Izaberi različito vreme početka i kraja.');
  });

  it('marks the chosen state of a special date as checked', async () => {
    await form();
    await press('Dodaj datum');
    expect(host('Zauzeto').props.accessibilityState).toEqual({ checked: true });
    expect(host('Slobodno za rad').props.accessibilityState).toEqual({ checked: false });
  });
});

describe('the profile conversation', () => {
  it('names the way forward that screen has when the outcome of a change is not confirmed', async () => {
    await form(availability(), { uncertain: true, candidateMode: true });
    expect(all('Primeni na pregled profila')[0].props.reason).toBe('Prvo proveri stanje razgovora. Ne znamo da li je izmena sačuvana.');
    expect(text()).toContain('Važi kada sačuvaš profil');
  });
});

describe('a very large text size', () => {
  it('writes one letter in each day circle, and keeps the whole name spoken', async () => {
    mockFontScale = 2;
    await form();
    await press('Dodaj — Sreda');
    const days = tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityRole === 'checkbox');
    expect(days.map(day => day.findByType('T' as React.ElementType).props.children)).toEqual(['P', 'U', 'S', 'Č', 'P', 'S', 'N']);
    expect(days[0].props.accessibilityLabel).toBe('Ponedeljak');
  });
});
