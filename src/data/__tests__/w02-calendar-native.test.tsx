import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerAvailability } from '../../contracts/workerAvailability';
import { StyleSheet } from 'react-native';
import { Circle } from 'react-native-svg';
import { civilDay, civilInstant, displayTime, localDayRange, overlapsInterval, shiftDate, weekDates } from '../../ui/calendar/calendarPresentation';
import { monthDistance } from '../../ui/calendar/months';

let mockFontScale = 1, mockWidth = 390;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'useWindowDimensions') return () => ({ width: mockWidth, height: 844, scale: 3, fontScale: mockFontScale });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Modal', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));
// Reduced motion is read from the one store (ui/system/motion) since 2026-09-24, no longer from Reanimated.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), navigate: jest.fn() } }));
let mockIntent = 'uskocer';
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent }));
jest.mock('../workerCalendarClientService', () => ({ workerCalendarClientService: { readRange: jest.fn() } }));
jest.mock('../agreementClientService', () => ({ agreementClientService: { mojiDogovori: jest.fn() } }));
jest.mock('../needClientService', () => ({ needClientService: { mojePotrebe: jest.fn() } }));
jest.mock('../applicationClientService', () => ({ applicationClientService: { mojePrijave: jest.fn() } }));
jest.mock('../workerAvailabilityClientService', () => ({ workerAvailabilityClientService: { read: jest.fn() } }));
// A read that throws is the resource's error state; one that answers null has not settled yet (owner step 10: the
// calendar says a day is empty only when both of its reads have settled).
// Every resource hands out its own refresh, recorded in the order the route asks for them, so a test can tell which were called.
const mockRefreshes: jest.Mock[] = [];
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: (read: () => unknown) => {
  const refresh = jest.fn();
  mockRefreshes.push(refresh);
  try { return { data: read(), loading: false, error: false, refreshing: false, refresh }; }
  catch { return { data: null, loading: false, error: true, refreshing: false, refresh }; }
} }));

import { AvailabilityForm } from '../../ui/calendar/AvailabilityForm';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';
import { sys } from '../../ui/system/tokens';
import Raspored from '../../app/(app)/raspored';
import { AgendaScreen } from '../../ui/calendar/AgendaScreen';
import { plannerWindow, serbianToday } from '../../ui/calendar/serbianDays';
import { agreementOf, applicationOf, fixedWindow, needOf, serbian, taskFacts, workerAgreementOf } from '../../ui/calendar/__tests__/fixtures';
import { workerCalendarClientService } from '../workerCalendarClientService';
import { agreementClientService } from '../agreementClientService';
import { needClientService } from '../needClientService';
import { applicationClientService } from '../applicationClientService';
import { workerAvailabilityClientService } from '../workerAvailabilityClientService';
const ruleId = '00000000-0000-4000-8000-000000000001';
const windowId = '00000000-0000-4000-8000-000000000002';
const availability = (): WorkerAvailability => ({ accountId: 'owned-account', profileId: 'owned-profile', revision: 'a'.repeat(64),
  timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] });
let tree: ReactTestRenderer;
const button = (label: string) => tree.root.findAll(node => node.props.label === label || node.props.accessibilityLabel === label)[0];
const press = async (label: string) => { await act(async () => button(label).props.onPress()); };
// Updated deliberately (review of owner step 10): a day row with slots is named by its day and speaks its slots as its
// value, so it is found by its name and its `expanded` state instead of "Prikaži termine — <dan>".
const dayRow = (name: string) => tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === name
  && node.props.accessibilityState && 'expanded' in node.props.accessibilityState)[0];
const openDay = async (name: string) => { await act(async () => dayRow(name).props.onPress()); };
const edit = async (label: string, value: string) => {
  await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onChangeText(value));
};
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const render = async (onSave = jest.fn(), value = availability()) => {
  await act(async () => { tree = create(<AvailabilityForm availability={value} busy={false} uncertain={false} onSave={onSave} />); });
  return onSave;
};
// "Mogu odmah" saves on its own since the owner's decision of 2026-09-24, so a test that needs an unsaved edit makes one
// in the week: a Monday slot, applied to the draft and not saved.
const addMonday = async () => {
  await press('Dodaj — Ponedeljak'); await edit('Početak termina', '09:00'); await edit('Kraj termina', '12:00');
  await press('Primeni termin');
};
const toggleStatus = async (value: boolean) => {
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.onValueChange(value));
};
afterEach(async () => { await act(async () => tree?.unmount()); jest.clearAllMocks(); mockFontScale = 1; mockWidth = 390; });

it('says that being available now means nothing while the work profile is still a draft', async () => {
  // The two screens contradicted each other: the work profile said it was a draft and so nothing
  // would be offered, and this one showed "Dostupan sada" as if it decided something.
  await act(async () => { tree = create(<AvailabilityForm availability={availability()} busy={false} uncertain={false}
    onSave={jest.fn()} profileDraft />); });
  expect(text()).toContain('Radni profil je nacrt');
  expect(text()).not.toContain('Čuva se odmah.');

  await act(async () => tree.unmount());
  await render();
  expect(text()).toContain('Čuva se odmah.');
  expect(text()).not.toContain('Radni profil je nacrt');
});

describe('actual availability editor interactions', () => {
  // Updated deliberately (owner decision 2026-09-24, "Mogu odmah" saves on its own): the switch used to wait for Save.
  // The intent kept: the save carries the existing owned data unchanged, and only the status moves.
  it('saves Mogu odmah on its own, with the saved week unchanged', async () => {
    const loaded = { ...availability(), rules: [{ id: ruleId, weekdays: [1, 3], startTime: '09:00:00', endTime: '12:00:00', startsOn: '2026-09-01', endsOn: null, label: 'Redovno', active: true }] };
    const pending = jest.fn(() => new Promise<void>(() => {}));
    const onSave = await render(pending, loaded);
    expect(button('Sačuvaj dostupnost')).toBeUndefined();
    expect(button('O statusu Mogu odmah')).toBeUndefined();
    expect(text()).toContain('Čuva se odmah.');
    expect(text()).toContain('Ne uključuje HITNO');
    await toggleStatus(true);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ timezone: loaded.timezone, availableNow: true, rules: loaded.rules, windows: [] });
    // While its own save runs, the line under the switch says so and no Save footer appears for it.
    await act(async () => tree.update(<AvailabilityForm availability={loaded} busy uncertain={false} onSave={onSave} />));
    expect(text()).toContain('Čuvamo status…');
    expect(button('Sačuvaj dostupnost')).toBeUndefined();
    expect(text()).not.toContain('Imaš nesačuvane izmene.');
  });

  it('lets the status join other unsaved edits, and saves them together with Save', async () => {
    const onSave = await render();
    await addMonday();
    expect(text()).toContain('Sačuvaće se zajedno sa ostalim izmenama');
    await toggleStatus(true);
    expect(onSave).not.toHaveBeenCalled();
    await press('Sačuvaj dostupnost');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ availableNow: true,
      rules: [expect.objectContaining({ weekdays: [1], startTime: '09:00:00', endTime: '12:00:00' })] });
  });

  it('keeps the status a draft change in the profile conversation, where the profile is saved in one final step', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<AvailabilityForm availability={availability()} busy={false} uncertain={false} onSave={onSave} candidateMode />); });
    await toggleStatus(true);
    expect(onSave).not.toHaveBeenCalled();
    expect(text()).toContain('Važi kada sačuvaš profil');
    await press('Primeni na pregled profila');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ availableNow: true }));
  });

  it('turning the status back before its save starts writes nothing', async () => {
    // A save refused before it starts (the editor's own guards) leaves the change unsaved; switching it back is no change.
    const onSave = await render(jest.fn(() => Promise.resolve()));
    await toggleStatus(true);
    expect(onSave).toHaveBeenCalledTimes(1);
    await toggleStatus(false);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(button('Sačuvaj dostupnost')).toBeUndefined();
  });

  it('reveals one day at a time without changing a shared weekly rule or saving', async () => {
    const shared = { id: ruleId, weekdays: [1, 3], startTime: '09:00:00.123456', endTime: '12:00:00.654321', startsOn: '2026-09-01', endsOn: null, label: 'Isti termin', active: true };
    const loaded = { ...availability(), rules: [shared] }, onSave = await render(jest.fn(), loaded);
    // The labels speak minutes since 2026-09-23 ("Uredi Ponedeljak 09:00", not "09:00:00.123456"); the saved rule below
    // still carries its exact stored times.
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Uredi Ponedeljak 09:00' })).toHaveLength(0);
    await openDay('Ponedeljak');
    expect(dayRow('Ponedeljak').props.accessibilityState.expanded).toBe(true);
    expect(button('Uredi Ponedeljak 09:00')).toBeTruthy();
    await openDay('Sreda');
    expect(dayRow('Ponedeljak').props.accessibilityState.expanded).toBe(false);
    expect(dayRow('Sreda').props.accessibilityState.expanded).toBe(true);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Uredi Ponedeljak 09:00' })).toHaveLength(0);
    expect(button('Uredi Sreda 09:00')).toBeTruthy();
    // Opening days changes nothing, so there is nothing to save (owner step 10: no footer on a clean form).
    expect(button('Sačuvaj dostupnost')).toBeUndefined();
    expect(onSave).not.toHaveBeenCalled();
    // The status saves on its own (owner decision 2026-09-24); the shared weekly rule goes with it unchanged.
    await toggleStatus(true);
    expect(onSave).toHaveBeenCalledWith({ timezone: loaded.timezone, availableNow: true, rules: [shared], windows: [] });
  });

  it('keeps save, discard and the open editor action outside scrolling fields', async () => {
    const onSave = await render();
    const insideScroll = (node: ReturnType<typeof button>) => {
      for (let parent = node.parent; parent; parent = parent.parent) if (parent.type === 'ScrollView' as React.ElementType) return true;
      return false;
    };
    await addMonday();
    expect(insideScroll(button('Sačuvaj dostupnost'))).toBe(false);
    expect(insideScroll(button('Odustani od izmena'))).toBe(false);
    await press('Dodaj — Ponedeljak');
    expect(insideScroll(button('Primeni termin'))).toBe(false);
    await press('Primeni termin');
    const alert = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.accessibilityRole === 'alert')[0];
    expect(insideScroll(alert)).toBe(false);
    expect(text()).toContain('različito vreme početka i kraja');
    expect(button('Sačuvaj dostupnost').props.disabled).toBe(true);
    expect(tree.root.findByType('Modal' as React.ElementType).props.animationType).toBe('none');
    await press('Odustani od termina');
    await press('Dodaj datum');
    expect(insideScroll(button('Primeni datum'))).toBe(false);
    expect(button('Sačuvaj dostupnost').props.disabled).toBe(true);
    await press('Odustani od datuma');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('splits explicit overnight input into adjacent canonical rules with shifted dates', async () => {
    const onSave = await render();
    await press('Dodaj — Ponedeljak');
    // The start date is a rare setting since owner step 10: it waits behind "Više podešavanja".
    await edit('Početak termina', '22:00'); await edit('Kraj termina', '02:00');
    await act(async () => tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === 'Više podešavanja')[0].props.onPress());
    await edit('Važi od', '2026-09-14');
    await press('Primeni termin');
    expect(onSave).not.toHaveBeenCalled();
    await press('Sačuvaj dostupnost');
    expect(onSave.mock.calls[0][0].rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ weekdays: [1], startTime: '22:00:00', endTime: '24:00:00', startsOn: '2026-09-14' }),
      expect.objectContaining({ weekdays: [2], startTime: '00:00:00', endTime: '02:00:00', startsOn: '2026-09-15' }),
    ]));
  });

  it('does not turn equal times with different precision into a whole-day rule', async () => {
    const onSave = await render();
    await press('Dodaj — Ponedeljak'); await edit('Početak termina', '17:00:00'); await edit('Kraj termina', '17:00');
    await press('Primeni termin');
    expect(text()).toContain('različito vreme');
    await press('Odustani od termina');
    // Nothing reached the draft, so there is no Save to press (owner step 10).
    expect(button('Sačuvaj dostupnost')).toBeUndefined();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves a dated exception in the stored zone and leaves recurring rules intact', async () => {
    const onSave = await render(); await press('Dodaj datum');
    await edit('Datum početka', '2026-09-11'); await edit('Vreme početka', '09:30');
    await edit('Datum kraja', '2026-09-11'); await edit('Vreme kraja', '12:00');
    await press('Primeni datum'); await press('Sačuvaj dostupnost');
    expect(onSave.mock.calls[0][0]).toMatchObject({ rules: [], windows: [expect.objectContaining({
      startsAt: '2026-09-11T07:30:00.000Z', endsAt: '2026-09-11T10:00:00.000Z', state: 'UNAVAILABLE',
    })] });
  });

  it.each([['2026-03-29', 'ne postoji'], ['2026-10-25', 'se ponavlja']])('rejects ambiguous/missing civil time on %s', async (date, message) => {
    const onSave = await render(); await press('Dodaj datum');
    await edit('Datum početka', date); await edit('Vreme početka', '02:30');
    await edit('Datum kraja', date); await edit('Vreme kraja', '04:00');
    await press('Primeni datum'); expect(text()).toContain(message);
    await press('Odustani od datuma');
    expect(button('Sačuvaj dostupnost')).toBeUndefined(); expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps exact historical fractional instants when only an exception label changes', async () => {
    const loaded = { ...availability(), windows: [{ id: windowId, startsAt: '2026-10-25T00:30:00.123456Z', endsAt: '2026-10-25T02:30:00.654321Z', state: 'UNAVAILABLE' as const, label: 'Staro' }] };
    const onSave = await render(jest.fn(), loaded);
    // The special dates are always listed since owner step 10; there is no toggle to open first.
    await press(`Uredi datum ${civilDay('2026-10-25')}`); await edit('Naziv (opciono)', 'Novo'); await press('Primeni datum'); await press('Sačuvaj dostupnost');
    expect(onSave.mock.calls[0][0].windows).toEqual([{ ...loaded.windows[0], label: 'Novo' }]);
  });

  it.each([
    { name: 'fractional start', date: '2026-09-11', startsAt: '2026-09-11T07:30:00.123456Z', endsAt: '2026-09-11T10:30:00.654321Z',
      field: 'Vreme kraja', time: '13:00', expectedStart: '2026-09-11T07:30:00.123456Z', expectedEnd: '2026-09-11T11:00:00.000Z' },
    { name: 'fractional end', date: '2026-09-11', startsAt: '2026-09-11T07:30:00.123456Z', endsAt: '2026-09-11T10:30:00.654321Z',
      field: 'Vreme početka', time: '09:00', expectedStart: '2026-09-11T07:00:00.000Z', expectedEnd: '2026-09-11T10:30:00.654321Z' },
    { name: 'first DST-fold start', date: '2026-10-25', startsAt: '2026-10-25T00:30:00.123456Z', endsAt: '2026-10-25T02:30:00Z',
      field: 'Vreme kraja', time: '04:00', expectedStart: '2026-10-25T00:30:00.123456Z', expectedEnd: '2026-10-25T03:00:00.000Z' },
    { name: 'second DST-fold end', date: '2026-10-25', startsAt: '2026-10-24T22:00:00Z', endsAt: '2026-10-25T01:30:00.654321Z',
      field: 'Vreme početka', time: '01:00', expectedStart: '2026-10-24T23:00:00.000Z', expectedEnd: '2026-10-25T01:30:00.654321Z' },
  ])('preserves the unchanged $name when only the opposite endpoint is edited', async item => {
    const loaded = { ...availability(), windows: [{ id: windowId, startsAt: item.startsAt, endsAt: item.endsAt,
      state: 'UNAVAILABLE' as const, label: 'Sačuvan izuzetak' }] };
    const onSave = await render(jest.fn(), loaded);
    await press(`Uredi datum ${civilDay(item.date)}`);
    await edit(item.field, item.time);
    await press('Primeni datum'); await press('Sačuvaj dostupnost');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ windows: [{ ...loaded.windows[0],
      startsAt: item.expectedStart, endsAt: item.expectedEnd }] }));
  });

  it.each(['busy', 'uncertain'] as const)('blocks an already edited command while %s', async state => {
    const loaded = availability(), onSave = await render(jest.fn(), loaded);
    await addMonday();
    await act(async () => tree.update(<AvailabilityForm availability={loaded} busy={state === 'busy'} uncertain={state === 'uncertain'} onSave={onSave} />));
    // Updated deliberately (owner step 10): a saving button keeps its words and shows that it works (V2Action loading),
    // instead of swapping its label for "Čuvamo unos…".
    const label = 'Sačuvaj dostupnost';
    expect(button(label).props.disabled).toBe(true);
    if (state === 'busy') {
      expect(button(label).props.loading).toBe(true);
      expect(tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === label)[0]
        .props.accessibilityState).toEqual({ disabled: true, busy: true });
    } else expect(button(label).props.reason).toBe('Prvo učitaj sačuvano stanje. Ishod izmene još nije potvrđen.');
    await press(label); expect(onSave).not.toHaveBeenCalled();
  });

  it('discard restores the server value without any save', async () => {
    const onSave = await render();
    // With another edit unsaved, the status joins the draft, so Discard takes both back.
    await addMonday();
    await toggleStatus(true);
    await press('Odustani od izmena');
    expect(tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.value).toBe(false);
    expect(button('Sačuvaj dostupnost')).toBeUndefined(); expect(onSave).not.toHaveBeenCalled();
  });
  // Updated deliberately (owner step 10): a change that is undone is no change now, so the old on-then-off path had nothing
  // to save. The intent is kept: an equal receipt at the same revision ends the edit.
  it('accepted idempotent receipt clears dirty edits even if revision is unchanged', async () => {
    const loaded = availability(), onSave = await render(jest.fn(), loaded);
    await addMonday();
    await press('Sačuvaj dostupnost');
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<AvailabilityForm availability={{ ...loaded, ...onSave.mock.calls[0][0] }} busy={false} uncertain={false} onSave={onSave} />));
    expect(button('Sačuvaj dostupnost')).toBeUndefined();
    expect(text()).not.toContain('nesačuvane');
  });

  // Updated deliberately (owner decision 2026-09-24): the status saves on its own, so the change that is made and then
  // undone is an exception's name now. The intent is unchanged.
  it('shows the footer only while something has changed, and takes it away when the change is undone', async () => {
    const loaded = { ...availability(), windows: [{ id: windowId, startsAt: '2026-10-25T08:00:00Z', endsAt: '2026-10-25T10:00:00Z',
      state: 'UNAVAILABLE' as const, label: 'Staro' }] };
    await render(jest.fn(), loaded);
    expect(button('Sačuvaj dostupnost')).toBeUndefined();
    const rename = async (label: string) => {
      await press(`Uredi datum ${civilDay('2026-10-25')}`); await edit('Naziv (opciono)', label); await press('Primeni datum');
    };
    await rename('Novo');
    expect(button('Sačuvaj dostupnost')).toBeTruthy(); expect(text()).toContain('Imaš nesačuvane izmene.');
    await rename('Staro');
    expect(button('Sačuvaj dostupnost')).toBeUndefined(); expect(text()).not.toContain('Imaš nesačuvane izmene.');
  });

  // Round-5c: the off track was the hairline grey, about 1.4:1 on white; it is the muted grey now.
  it('draws the switch with a white thumb in both states (B19: not the platform teal), and a visible off track', async () => {
    await render();
    const toggle = tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' });
    expect(toggle.props.thumbColor).toBe(sys.color.surface);
    expect(toggle.props.trackColor).toEqual({ true: sys.color.green, false: sys.color.muted });
    expect(toggle.props.ios_backgroundColor).toBe(sys.color.muted);
  });

  it('tells the screen whether there are unsaved changes, and false when it goes away', async () => {
    const onDirtyChange = jest.fn();
    await act(async () => { tree = create(<AvailabilityForm availability={availability()} busy={false} uncertain={false} onSave={jest.fn()} onDirtyChange={onDirtyChange} />); });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await addMonday();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await act(async () => tree.unmount());
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await act(async () => { tree = create(<></>); });
  });

  it('says a confirmed save in the footer, and only when the screen says it was confirmed', async () => {
    await act(async () => { tree = create(<AvailabilityForm availability={availability()} busy={false} uncertain={false} onSave={jest.fn()} />); });
    expect(text()).not.toContain('Dostupnost je sačuvana.');
    await act(async () => tree.update(<AvailabilityForm availability={availability()} busy={false} uncertain={false} onSave={jest.fn()} saved />));
    expect(text()).toContain('Dostupnost je sačuvana.');
  });

  it('after an unconfirmed outcome offers only reading the saved state, with the reason', async () => {
    const onReconcile = jest.fn(), onSave = jest.fn();
    await act(async () => { tree = create(<AvailabilityForm availability={availability()} busy={false} uncertain onSave={onSave}
      problem="Čuvanje nije potvrđeno. Proveri sačuvano stanje pre novog pokušaja." onReconcile={onReconcile} />); });
    expect(button('Sačuvaj dostupnost')).toBeUndefined();
    expect(text()).toContain('Čuvanje nije potvrđeno.');
    await press('Učitaj sačuvano stanje');
    expect(onReconcile).toHaveBeenCalledTimes(1); expect(onSave).not.toHaveBeenCalled();
  });

  it('shows a failed read above the form as one line, and keeps the form', async () => {
    await act(async () => { tree = create(<AvailabilityForm availability={availability()} busy={false} uncertain={false} onSave={jest.fn()}
      problem="Podaci nisu učitani. Proveri vezu i pokušaj ponovo." />); });
    const alert = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.accessibilityRole === 'alert');
    expect(alert.map(node => node.props.children)).toContain('Podaci nisu učitani. Proveri vezu i pokušaj ponovo.');
    expect(tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' })).toBeTruthy();
  });
});

describe('actual agenda screen', () => {
  // Raspored (owner, 2026-10-07): a day is a day of Serbian time and so is every clock on it, so these cases state their times in
  // Serbian clocks and mean the same whatever zone the suite runs in. "Today" is the Serbian today, the day the route opens on.
  const today = () => serbianToday();
  const term = (clock: string, endClock: string) => ({ pocetak: serbian(today(), clock), kraj: serbian(today(), endClock) });
  const scheduleOf = (events: unknown[]) => (workerCalendarClientService.readRange as jest.Mock).mockImplementation((from, to) =>
    ({ ok: true, podatak: { from, to, authoritative: true, events } }));
  const event = (agreementId: string, clock: string, endClock: string, version = 1, fraction = '') => ({ eventId: 'event-1', agreementId, agreementVersion: version,
    startsAt: serbian(today(), clock).replace('.000', fraction), endsAt: serbian(today(), endClock).replace('.000', fraction), agreementStatus: 'CONFIRMED', source: 'AGREEMENT' });
  const cells = () => tree.root.findAll(node => node.type === 'Press' as React.ElementType
    && /^(Ponedeljak|Utorak|Sreda|Četvrtak|Petak|Subota|Nedelja), /.test(String(node.props.accessibilityLabel)));
  const markOf = (cell: ReactTestInstance) => cell.findAllByType(Circle)[0]?.props;
  const navigate = () => jest.requireMock('expo-router').router.navigate as jest.Mock;
  beforeEach(() => {
    mockIntent = 'narucilac'; mockRefreshes.length = 0;
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([]);
    (needClientService.mojePotrebe as jest.Mock).mockReturnValue([]);
    (applicationClientService.mojePrijave as jest.Mock).mockReturnValue([]);
    (workerAvailabilityClientService.read as jest.Mock).mockReturnValue({ ok: false, kod: 'WORKER_PROFILE_REQUIRED', poruka: 'Najpre sačuvaj svoj radni profil.' });
    scheduleOf([]);
  });
  it('reads the schedule for the three months around the Serbian today, invents no bookings from empty data, and always offers the availability editor and the Arhiva', async () => {
    await act(async () => { tree = create(<Raspored />); });
    expect(workerCalendarClientService.readRange).toHaveBeenCalledTimes(1);
    const [from, to] = (workerCalendarClientService.readRange as jest.Mock).mock.calls[0];
    expect({ from, to }).toEqual({ from: plannerWindow(today(), 1).from, to: plannerWindow(today(), 1).to });
    expect(Date.parse(to) - Date.parse(from)).toBeGreaterThanOrEqual(84 * 86_400_000);
    // Updated deliberately (Raspored, 2026-10-07): the planner holds my tasks and applications as well, so an empty day is one
    // quiet line that does not say "Dogovori"; the scope disclaimer and the button that repeated Back are gone.
    expect(text()).toContain('Ništa nije zakazano za ovaj dan.');
    expect(button('Otvori sve Dogovore')).toBeUndefined();
    // Owner decision 1 (2026-09-19): when I can work is mine to set whenever I like. The row is spoken by its visible words.
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Moja dostupnost za rad' })).toHaveLength(1);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Arhiva' })).toHaveLength(1);
  });
  it('reads the schedule again only when the chosen day goes beyond the months already read, not for a week or a month on either side', async () => {
    await act(async () => { tree = create(<Raspored />); });
    const windows = () => new Set((workerCalendarClientService.readRange as jest.Mock).mock.calls.map(([from, to]) => `${from}|${to}`)).size;
    // Step a week at a time. The chosen day may move a month away and the schedule is not read again; two months away, it is.
    for (let step = 1; step <= 14; step++) {
      await press('Sledeća nedelja');
      const far = monthDistance(shiftDate(today(), 7 * step).slice(0, 7), today().slice(0, 7)) > 1;
      expect([step, windows()]).toEqual([step, far ? 2 : 1]);
      if (far) break;
    }
    expect(windows()).toBe(2);
  });
  it('reads my Dogovori, my tasks, my applications and my availability the way Početna and Dostupnost do, each once', async () => {
    await act(async () => { tree = create(<Raspored />); });
    expect(agreementClientService.mojiDogovori).toHaveBeenCalledTimes(1);
    expect(agreementClientService.mojiDogovori).toHaveBeenCalledWith({ includeRatings: false });
    expect(needClientService.mojePotrebe).toHaveBeenCalledTimes(1);
    expect(needClientService.mojePotrebe).toHaveBeenCalledWith({ includeUrgency: false });
    expect(applicationClientService.mojePrijave).toHaveBeenCalledTimes(1);
    expect(workerAvailabilityClientService.read).toHaveBeenCalledTimes(1);
  });
  it('does not show empty success or fabricated dates when the calendar receipt fails', async () => {
    (workerCalendarClientService.readRange as jest.Mock).mockReturnValue({ ok: false, poruka: 'Kalendar nije učitan.' });
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).toContain('Kalendar nije učitan.');
    expect(text()).not.toContain('Ništa nije zakazano');
    expect(button('Pokušaj ponovo')).toBeTruthy();
  });
  it.each([{ scale: 2, fraction: '.000', layout: 'column' }, { scale: 1, fraction: '.123456', layout: 'row' }])('writes the window to the minute, with the rail only at a normal font (scale $scale, precision $fraction)', async ({ scale, fraction, layout }) => {
    mockFontScale = scale;
    scheduleOf([event('agreement-1', '09:15', '10:45', 2, fraction)]);
    await act(async () => { tree = create(<Raspored />); });
    // An agreed term reads in Serbian time everywhere (rule 8.27), and the heading already names the day, so the row carries the
    // clocks alone.
    expect(text()).toContain('09:15'); expect(text()).toContain('10:45');
    if (layout === 'column') expect(text()).toContain('09:15–10:45');
    expect(text()).not.toContain('.123456');
    expect(button('Otvori Dogovor sa potvrđenim terminom').parent?.props.style.flexDirection).toBe(layout);
  });

  it('renders an exact receipt and never mixes an older Agreement version into it', async () => {
    scheduleOf([event('agreement-1', '09:15', '10:45', 2)]);
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([agreementOf('agreement-1', { verzija: 1, stanje: 'CONFIRMED', naslov: 'Stari naslov', cena: { iznos: 999, valuta: 'RSD', prikaz: '999 RSD' } })]);
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).toContain('09:15'); expect(text()).toContain('10:45');
    // "Potvrđena satnica" under every row is gone (2026-09-23): every row on this screen is a confirmed term.
    expect(text()).not.toContain('Potvrđena satnica'); expect(text()).toContain('Potvrđen Dogovor');
    expect(text()).not.toContain('999'); expect(text()).not.toContain('Stari naslov');
  });

  // The seventh day was cut off on the phone (2026-09-23): the strip scrolled sideways. Seven equal columns now always
  // fit, and at a very large font the weekday shrinks to its letter while the spoken label keeps the whole name.
  it.each([[1, ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned']], [1.5, ['P', 'U', 'S', 'Č', 'P', 'S', 'N']]])(
    'lays the week out as seven equal columns that always fit (font scale %s)', async (scale, letters) => {
      mockFontScale = scale;
      await act(async () => { tree = create(<Raspored />); });
      expect(cells()).toHaveLength(7);
      for (const day of cells()) expect(day.props.style).toEqual(expect.objectContaining({ flex: 1, minWidth: 0 }));
      // The chips scroll sideways on their own; no day is inside that scroll.
      for (const scroll of tree.root.findAll(node => node.type === 'ScrollView' as React.ElementType && node.props.horizontal)) {
        expect(scroll.findAll(node => cells().includes(node))).toHaveLength(0);
      }
      expect(cells().map(day => day.findAllByType('T' as React.ElementType)[0].props.children)).toEqual(letters);
      expect(cells()[0].props.accessibilityLabel).toMatch(/^Ponedeljak, /);
    });

  it('shows a Dogovor without a saved amount in words, never as an amount', async () => {
    scheduleOf([event('agreement-1', '09:15', '10:45')]);
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([workerAgreementOf('agreement-1', { naslov: 'Selidba',
      cena: { iznos: 0, valuta: 'RSD', prikaz: '' }, putanjaTekst: 'Novi Sad' })]);
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).toContain('Selidba'); expect(text()).toContain('Iznos nije sačuvan'); expect(text()).not.toContain('0 RSD');
  });

  // Owner step 10 (critique A15): the calendar missed my own tasks and every finished Dogovor. The R1 capture showed an
  // empty 24 Sep while "Pomoć oko krečenja stana" (24. sep 12:00–19:00, finished) existed.
  it.each([{ width: 361, scale: 1.15, layout: 'column' }, { width: 600, scale: 1, layout: 'row' },
    { width: 361, scale: 1.3, layout: 'column' }])('places my task with all its facts and a title/amount that share only sufficient card space ($width dp, scale $scale)', async ({ width, scale, layout }) => {
    mockWidth = width; mockFontScale = scale;
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([agreementOf('agreement-2', { tacanTermin: term('12:00', '17:00') })]);
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).toContain('Pomoć oko krečenja stana'); expect(text()).toContain('Tvoj zadatak · Marko');
    expect(text()).toContain('4.000 RSD'); expect(text()).toContain('Liman, Novi Sad');
    expect(text()).not.toContain('Ništa nije zakazano');
    const row = tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === 'Otvori Dogovor Pomoć oko krečenja stana')[0];
    expect(row.props.accessibilityValue.text).toContain('Tvoj zadatak');
    const title = row.findAll(node => node.type === 'T' as React.ElementType && node.props.children === 'Pomoć oko krečenja stana')[0];
    expect(title.parent?.props.style.flexDirection ?? 'column').toBe(layout);
    expect(row.props.accessibilityValue.text).toContain('4.000 RSD');
    await act(async () => row.props.onPress());
    expect(navigate()).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'agreement-2' } });
  });

  it('keeps a finished Dogovor on its day, quiet and marked finished, and never a cancelled one', async () => {
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([
      agreementOf('agreement-3', { stanje: 'COMPLETED', tacanTermin: term('12:00', '19:00') }),
      agreementOf('agreement-4', { stanje: 'CANCELLED', naslov: 'Otkazana selidba', tacanTermin: term('10:00', '11:00') }),
    ]);
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).toContain('Završen'); expect(text()).toContain('Pomoć oko krečenja stana');
    expect(text()).not.toContain('Otkazana selidba');
  });

  it('marks a day with something active by a green dot, not orange', async () => {
    const other = weekDates(today()).find(day => day !== today())!;
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([agreementOf('agreement-5', { tacanTermin: { pocetak: serbian(other, '12:00'), kraj: serbian(other, '13:00') } })]);
    await act(async () => { tree = create(<Raspored />); });
    const marked = cells().filter(cell => / ima Dogovor$/.test(String(cell.props.accessibilityLabel)));
    expect(marked).toHaveLength(1);
    expect(markOf(marked[0])).toMatchObject({ fill: sys.color.green });
    expect(text()).toContain('Ništa nije zakazano za ovaj dan.');
  });

  it('names the weekday in the day heading', async () => {
    await act(async () => { tree = create(<Raspored />); });
    const { dayHeading } = jest.requireActual('../../ui/calendar/calendarPresentation') as typeof import('../../ui/calendar/calendarPresentation');
    expect(text()).toContain(dayHeading(today()));
    expect(text()).not.toContain('Dogovoreno za');
  });

  it('says it shows only my work when the Dogovori did not load, and offers to read them again', async () => {
    (agreementClientService.mojiDogovori as jest.Mock).mockImplementation(() => { throw new Error('AGREEMENT_LIST_FAILED'); });
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).toContain('Nema termina u kojima uskačeš.'); expect(text()).not.toContain('Ništa nije zakazano');
    expect(button('Pokušaj ponovo')).toBeTruthy();
    await act(async () => tree.unmount());
    scheduleOf([event('agreement-1', '11:15', '12:45')]);
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).toContain('Učitani su samo termini u kojima uskačeš.'); expect(text()).toContain('Potvrđen Dogovor');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Svi Dogovori' })).toHaveLength(0);
  });

  it('never calls a day empty before the reads have settled', async () => {
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue(null);
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).not.toContain('Ništa nije zakazano'); expect(text()).toContain('Učitavamo raspored…');
  });

  it('lists the active Dogovori without an exact time under "Bez tačnog termina", in their own words, and opens them', async () => {
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([agreementOf('agreement-6', { naslov: 'Košenje živice', vremeTekst: 'Termin nije potvrđen' }),
      agreementOf('agreement-7', { stanje: 'COMPLETED', naslov: 'Završena bez termina' })]);
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).toContain('Bez tačnog termina'); expect(text()).toContain('1 Dogovor'); expect(text()).toContain('Termin nije potvrđen');
    expect(text()).not.toContain('Završena bez termina');
    const row = tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === 'Otvori Dogovor Košenje živice')[0];
    await act(async () => row.props.onPress());
    expect(navigate()).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'agreement-6' } });
  });

  it('says it shows only my work while the list does not say which Dogovori have an exact time', async () => {
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([agreementOf('agreement-8', { tacanTermin: undefined })]);
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).toContain('Nema termina u kojima uskačeš.'); expect(text()).not.toContain('Ništa nije zakazano');
    expect(button('Pokušaj ponovo')).toBeUndefined();
  });

  // Review of owner step 10: a finished or waiting Dogovor from the list is not called confirmed when it has no title.
  it('names an untitled Dogovor from the list without calling it confirmed', async () => {
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([agreementOf('agreement-9', { naslov: '', stanje: 'COMPLETED', tacanTermin: term('12:00', '13:00') })]);
    await act(async () => { tree = create(<Raspored />); });
    expect(tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === 'Otvori Dogovor')).toHaveLength(1);
    expect(button('Otvori Dogovor sa potvrđenim terminom')).toBeUndefined();
  });

  it('marks a day with only finished work by the muted grey, which reads on white', async () => {
    const other = weekDates(today()).find(day => day !== today())!;
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([agreementOf('agreement-10', { stanje: 'COMPLETED',
      tacanTermin: { pocetak: serbian(other, '12:00'), kraj: serbian(other, '13:00') } })]);
    await act(async () => { tree = create(<Raspored />); });
    const marked = cells().filter(cell => / ima završen Dogovor$/.test(String(cell.props.accessibilityLabel)));
    expect(markOf(marked[0])).toMatchObject({ fill: sys.color.muted });
  });

  it('puts my own task and my open application beside the Dogovori on their day, from the reads Početna makes', async () => {
    (needClientService.mojePotrebe as jest.Mock).mockReturnValue([needOf('need-1', { naslov: 'Selidba ormara', stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 2,
      schedule: fixedWindow(serbian(today(), '14:00'), serbian(today(), '16:00')) })]);
    (applicationClientService.mojePrijave as jest.Mock).mockReturnValue([applicationOf('application-1', { naslov: 'Košenje trave',
      zadatak: taskFacts(fixedWindow(serbian(today(), '09:00'), serbian(today(), '11:00'))) })]);
    await act(async () => { tree = create(<Raspored />); });
    const labels = tree.root.findAll(node => node.type === 'Press' as React.ElementType && /^Otvori (Dogovor|zadatak|prijavu)/.test(String(node.props.accessibilityLabel)))
      .map(node => node.props.accessibilityLabel);
    expect(labels).toEqual(['Otvori prijavu Košenje trave', 'Otvori zadatak Selidba ormara']);
    expect(text()).toContain('Bira se · 2'); expect(text()).toContain('Poslata');
  });

  it('opens the candidates of a task with applications to choose from, the task otherwise, and the application in Moje prijave', async () => {
    (needClientService.mojePotrebe as jest.Mock).mockReturnValue([
      needOf('need-1', { naslov: 'Prva', stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 2, schedule: fixedWindow(serbian(today(), '14:00'), serbian(today(), '15:00')) }),
      needOf('need-2', { naslov: 'Druga', schedule: fixedWindow(serbian(today(), '15:00'), serbian(today(), '16:00')) })]);
    (applicationClientService.mojePrijave as jest.Mock).mockReturnValue([applicationOf('application-1', { naslov: 'Treća',
      zadatak: taskFacts(fixedWindow(serbian(today(), '17:00'), serbian(today(), '18:00'))) })]);
    await act(async () => { tree = create(<Raspored />); });
    const open = async (label: string) => act(async () => tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === label)[0].props.onPress());
    await open('Otvori zadatak Prva'); await open('Otvori zadatak Druga'); await open('Otvori prijavu Treća');
    expect(navigate().mock.calls).toEqual([[{ pathname: '/potrebe/[id]/kandidati', params: { id: 'need-1' } }],
      [{ pathname: '/potrebe/[id]/pregled', params: { id: 'need-2' } }], [{ pathname: '/moje-prijave', params: { prijavaId: 'application-1' } }]]);
  });

  it('shades the days of a worker from the availability the worker keeps, and draws nothing for a person with no work profile', async () => {
    const shaded = () => tree.root.findAll(node => node.props.testID === 'day-shade' && StyleSheet.flatten(node.props.style)?.backgroundColor !== undefined);
    await act(async () => { tree = create(<Raspored />); });
    expect(shaded()).toHaveLength(0);
    await act(async () => tree.unmount());
    (workerAvailabilityClientService.read as jest.Mock).mockReturnValue({ ok: true, podatak: { ...availability(), rules: [
      { id: ruleId, weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '08:00:00', endTime: '16:00:00', startsOn: '2026-01-01', endsOn: null, label: '', active: true }] } });
    await act(async () => { tree = create(<Raspored />); });
    // Every day from today to the end of this week; the days before today are not shaded.
    expect(shaded()).toHaveLength(weekDates(today()).filter(day => day >= today()).length);
  });

  it('opens the availability editor and the Arhiva, and goes back', async () => {
    await act(async () => { tree = create(<Raspored />); });
    await press('Moja dostupnost za rad'); await press('Arhiva'); await press('Nazad');
    expect(navigate().mock.calls).toEqual([['/profil/dostupnost'], ['/arhiva']]);
    expect(jest.requireMock('expo-router').router.back).toHaveBeenCalledTimes(1);
  });

  it('reads everything again on a pull, keeping what is on screen, and only what failed on "Pokušaj ponovo"', async () => {
    await act(async () => { tree = create(<Raspored />); });
    const refreshControl = tree.root.findAllByType('ScrollView' as React.ElementType)[0].props.refreshControl;
    const latest = mockRefreshes.slice(-5);
    await act(async () => refreshControl.props.onRefresh());
    for (const refresh of latest) expect(refresh).toHaveBeenCalledWith('keep');
    await act(async () => tree.unmount());
    mockRefreshes.length = 0;
    (needClientService.mojePotrebe as jest.Mock).mockImplementation(() => { throw new Error('NEED_LIST_FAILED'); });
    await act(async () => { tree = create(<Raspored />); });
    const [calendar, agreements, needs, applications, hours] = mockRefreshes.slice(-5);
    await press('Pokušaj ponovo');
    expect(needs).toHaveBeenCalledWith('keep');
    for (const refresh of [calendar, agreements, applications, hours]) expect(refresh).not.toHaveBeenCalled();
  });
});

// Review of owner step 10: the calendar's own presentation, drawn without the route.
describe('the agenda screen', () => {
  const draw = async (patch: Partial<React.ComponentProps<typeof AgendaScreen>> = {}) => {
    const onRefresh = jest.fn();
    await act(async () => { tree = create(<AgendaScreen selected="2026-09-24" today="2026-09-24" schedule={{ state: 'ready', events: [] }}
      list={{ state: 'ready', agreements: [] }} refreshing={false} onSelect={jest.fn()} onBack={jest.fn()} onRefresh={onRefresh} onRetry={jest.fn()}
      onRetryList={jest.fn()} onOpen={jest.fn()} onWithoutTerm={jest.fn()} onAvailability={jest.fn()} phoneZone="Europe/Belgrade" {...patch} />); });
    return onRefresh;
  };

  // Round-5c: the action sat on the ScrollView, which TalkBack and VoiceOver never offer it on. It is on the day's heading,
  // a focusable element, under its own name, so the heading does not become a button.
  it('lets a screen reader read the calendar again from the day heading, as the pull does', async () => {
    const onRefresh = await draw();
    expect(tree.root.findAllByType('ScrollView' as React.ElementType)[0].props.accessibilityActions).toBeUndefined();
    const heading = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.accessibilityActions)[0];
    expect(heading.props.accessibilityRole).toBe('header');
    expect(heading.props.accessibilityActions).toEqual([{ name: 'refresh', label: 'Osveži raspored' }]);
    await act(async () => heading.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    expect(onRefresh).not.toHaveBeenCalled();
    await act(async () => heading.props.onAccessibilityAction({ nativeEvent: { actionName: 'refresh' } }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('lines "Danas" up with the week label when it moves under it', async () => {
    mockFontScale = 1.3;
    await draw({ selected: '2026-12-31', today: '2026-09-24' });
    const today = tree.root.findAll(node => node.props.label === 'Danas' && typeof node.type !== 'string')[0];
    expect(today.parent!.props.style).toEqual(expect.objectContaining({ marginLeft: -sys.space.base }));
  });

  it.each([[1, true], [1.3, false]])('never cuts the week label, and moves "Danas" under it on a narrow row (text size %s)', async (scale, beside) => {
    mockFontScale = scale;
    await draw({ selected: '2026-12-31', today: '2026-09-24' });
    // The week that crosses the new year, the longest label there is.
    const label = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.children === '28. dec 2026 – 3. jan 2027')[0];
    // The name of the week is the press that opens the month, so it is a button; the day's heading is the header.
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.parent!.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: '28. dec 2026 – 3. jan 2027', accessibilityHint: 'Otvara mesec' });
    const today = tree.root.findAll(node => node.props.label === 'Danas' && typeof node.type !== 'string')[0];
    expect(today.parent!.findAll(node => node.props.label === 'Sledeća nedelja').length > 0).toBe(beside);
  });
});

// Dostupnost on the phone (2026-09-23) read "16:00:00", "2026-09-23" and "Europe/Belgrade". The stored values stay exact;
// the screen writes minutes, the app's day ("23. sep") and Serbian time by name, and no line explains a button.
describe('availability reads the way the rest of the app writes time', () => {
  const loaded = () => ({ ...availability(),
    rules: [{ id: ruleId, weekdays: [1], startTime: '16:00:00', endTime: '20:30:00.000001', startsOn: '2026-09-23', endsOn: '2027-01-05', label: '', active: true }],
    windows: [{ id: windowId, startsAt: '2026-10-02T07:30:00Z', endsAt: '2026-10-02T10:00:00Z', state: 'UNAVAILABLE' as const, label: '' }] });

  it('writes the weekly rule to the minute, its dates as days and the zone in words', async () => {
    await render(jest.fn(), loaded());
    expect(text()).toContain('16:00–20:30'); expect(text()).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(text()).toContain('Po vremenu u Srbiji.'); expect(text()).not.toContain('Europe/Belgrade');
    await openDay('Ponedeljak');
    expect(text()).toContain(`Od ${civilDay('2026-09-23')} do ${civilDay('2027-01-05')}`); expect(text()).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(button('Uredi Ponedeljak 16:00')).toBeTruthy();
  });

  it('writes a special date as one moment, in the schedule zone', async () => {
    await render(jest.fn(), loaded());
    // Updated deliberately (owner step 10): the special dates are always listed, so their count line and toggle are gone.
    expect(text()).not.toContain('1 poseban datum');
    expect(text()).toMatch(/2\. okt( 2026)? · 09:30–12:00/); expect(text()).not.toContain('2026-10-02');
    expect(button(`Uredi datum ${civilDay('2026-10-02')}`)).toBeTruthy();
  });

  it('asks in the app before removing a slot, and removing one only changes the unsaved draft', async () => {
    const onSave = await render(jest.fn(), loaded());
    await openDay('Ponedeljak'); await press('Ukloni Ponedeljak 16:00');
    const ask = () => tree.root.findByType(ConfirmSheet);
    expect(ask().props).toMatchObject({ title: 'Ukloniti termin?', cancelLabel: 'Odustani', confirmLabel: 'Ukloni', tone: 'danger',
      message: 'Promena će se sačuvati tek kada sačuvaš dostupnost. Dogovori ostaju nepromenjeni.' });
    await act(async () => ask().findByProps({ testID: 'confirm-sheet-cancel' }).props.onPress());
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0); expect(text()).toContain('16:00–20:30'); expect(text()).not.toContain('Imaš nesačuvane izmene.');
    await press('Ukloni Ponedeljak 16:00');
    await act(async () => ask().findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress());
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0); expect(text()).not.toContain('16:00–20:30');
    expect(text()).toContain('Imaš nesačuvane izmene.'); expect(onSave).not.toHaveBeenCalled();
  });

  // One word for one thing (T4b1, 2026-10-07; UX plan 3.8): a slot of the week is a "termin", a special date is a "datum".
  it('asks "Ukloniti datum?" before removing a special date, and still only changes the unsaved draft', async () => {
    const onSave = await render(jest.fn(), loaded());
    await press(`Ukloni datum ${civilDay('2026-10-02')}`);
    const ask = () => tree.root.findByType(ConfirmSheet);
    expect(ask().props).toMatchObject({ title: 'Ukloniti datum?', cancelLabel: 'Odustani', confirmLabel: 'Ukloni', tone: 'danger',
      message: 'Promena će se sačuvati tek kada sačuvaš dostupnost. Dogovori ostaju nepromenjeni.' });
    await act(async () => ask().findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress());
    expect(text()).toContain('Nema posebnih datuma.'); expect(text()).toContain('Imaš nesačuvane izmene.'); expect(onSave).not.toHaveBeenCalled();
  });

  it('drops the eyebrow over the special-date sheet, the zone name and the line that explained the save button', async () => {
    await render();
    expect(text()).not.toContain('Dugme se uključuje');
    await press('Dodaj — Ponedeljak');
    expect(text()).toContain('Po vremenu u Srbiji.'); expect(text()).not.toContain('Vremenska zona');
    await press('Odustani od termina');
    await press('Dodaj datum');
    expect(text()).not.toContain('Izuzetak od nedelje'); expect(text()).not.toContain('Promeni dostupnost za poseban termin.');
    expect(text()).toContain('Redovni termini ostaju sačuvani. Po vremenu u Srbiji.');
  });

  it('refreshes by pulling the list, and holds every edit while the saved state is read again', async () => {
    const onRefresh = jest.fn(), onSave = jest.fn(), value = availability();
    await act(async () => { tree = create(<AvailabilityForm availability={value} busy={false} uncertain={false} onSave={onSave} onRefresh={onRefresh} />); });
    const control = tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl;
    expect(control.props.refreshing).toBe(false);
    await act(async () => control.props.onRefresh());
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<AvailabilityForm availability={value} busy={false} uncertain={false} onSave={onSave} onRefresh={onRefresh} refreshing />));
    expect(tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl.props.refreshing).toBe(true);
    expect(tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.disabled).toBe(true);
    expect(button('Dodaj — Ponedeljak').props.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  // A pull while there were unsaved edits threw them away without asking (review of plan step 0, 2026-09-24): the read
  // returns a new value and the form resets to it. The pull now does nothing until the edits are saved or discarded.
  it('refuses a pull while there are unsaved edits, and keeps them', async () => {
    const onRefresh = jest.fn(), onSave = jest.fn();
    await act(async () => { tree = create(<AvailabilityForm availability={availability()} busy={false} uncertain={false} onSave={onSave} onRefresh={onRefresh} />); });
    await addMonday();
    await toggleStatus(true);
    const control = tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl;
    expect(control.props.enabled).toBe(false);
    await act(async () => control.props.onRefresh());
    expect(onRefresh).not.toHaveBeenCalled();
    expect(text()).toContain('Imaš nesačuvane izmene.');
    expect(tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.value).toBe(true);
    // Once the edits are discarded, the same pull reads again.
    await press('Odustani od izmena');
    const clean = tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl;
    expect(clean.props.enabled).toBe(true);
    await act(async () => clean.props.onRefresh());
    expect(onRefresh).toHaveBeenCalledTimes(1); expect(onSave).not.toHaveBeenCalled();
  });

  // The standing "Osveži dostupnost" button was the only way a screen reader could read the saved state again. Round-5c:
  // on the ScrollView the action was never offered (Android's scroll view keeps its own delegate); it is on the heading.
  it('lets a screen reader reach the same read as an action on the week heading, never over unsaved edits', async () => {
    const onRefresh = jest.fn();
    await act(async () => { tree = create(<AvailabilityForm availability={availability()} busy={false} uncertain={false} onSave={jest.fn()} onRefresh={onRefresh} />); });
    expect(tree.root.findByType('ScrollView' as React.ElementType).props.accessibilityActions).toBeUndefined();
    const heading = () => tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.children === 'Redovna nedelja')[0];
    expect(heading().props.accessibilityRole).toBe('header');
    expect(heading().props.accessibilityActions).toEqual([{ name: 'refresh', label: 'Učitaj sačuvano stanje' }]);
    await act(async () => heading().props.onAccessibilityAction({ nativeEvent: { actionName: 'refresh' } }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await addMonday();
    expect(heading().props.accessibilityActions).toBeUndefined();
    await act(async () => heading().props.onAccessibilityAction({ nativeEvent: { actionName: 'refresh' } }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Imaš nesačuvane izmene.');
  });
});

describe('calendar civil date boundaries', () => {
  it('round-trips a non-whole-hour timezone and rejects nonexistent calendar dates', () => {
    expect(civilInstant('2026-09-11', '09:30', 'Asia/Kathmandu').value).toBe('2026-09-11T03:45:00.000Z');
    expect(civilInstant('2026-02-30', '09:30', 'Europe/Belgrade').value).toBeNull();
  });
  it('moves through year boundaries without assuming a fixed week in milliseconds', () => {
    expect(weekDates('2027-01-01')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
    const day = localDayRange('2026-09-11'); expect(Date.parse(day.to) - Date.parse(day.from)).toBe(86_400_000);
  });
  it('retains microsecond boundary overlap and shows the clock to the minute', () => {
    expect(overlapsInterval('2026-09-10T23:59:59Z', '2026-09-11T00:00:00.000001Z', '2026-09-11T00:00:00Z', '2026-09-12T00:00:00Z')).toBe(true);
    expect(overlapsInterval('2026-09-10T23:59:59Z', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z', '2026-09-12T00:00:00Z')).toBe(false);
    expect(displayTime('2026-09-11T09:00:01.123456Z')).toBe('09:00');
  });
});
