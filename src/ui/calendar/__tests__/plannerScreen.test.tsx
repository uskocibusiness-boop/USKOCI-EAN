import React from 'react';
import { PanResponder, StyleSheet } from 'react-native';
import { Circle } from 'react-native-svg';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockFontScale = 1, mockWidth = 390;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: mockWidth, height: 844, scale: 3, fontScale: mockFontScale });
    return ['View', 'ScrollView', 'ActivityIndicator', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press', PRESS_DELAY: 60 }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => true }));
// The sheet engine needs the native modal and gesture stack; its content is what is tested here, and closing it calls onClose.
jest.mock('../../product/ProductSheet', () => ({
  ProductSheet: ({ label, children, onClose }: { label: string; children: (dismiss: () => void) => React.ReactNode; onClose: () => void }) =>
    require('react').createElement('Sheet', { label, onClose }, children(() => onClose())),
}));

import type { DogovorProjekcija } from '../../../contracts/projections';
import { sys } from '../../system/tokens';
import { PULL_GRACE_MS } from '../../system/usePullRefresh';
import { AgendaScreen } from '../AgendaScreen';
import { plannerWindow } from '../serbianDays';
import { SWIPE_DISTANCE } from '../weekSwipe';
import { NO_POSAO, agreementOf, eventOf, serbian, workerAgreementOf } from './fixtures';

// The planner on the owner's phone: Wednesday 7 October 2026, Serbian time. Everything is stated in Serbian clocks, so these cases
// mean the same in any zone the suite runs in (it runs in UTC, two hours behind).
const DAY = '2026-10-07';
const NOW = new Date('2026-10-07T05:00:00Z');
const WEEKDAY = /^(Ponedeljak|Utorak|Sreda|Četvrtak|Petak|Subota|Nedelja), /;

let tree: ReactTestRenderer;
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAll(node => node.type === 'Press' as React.ElementType);
const press = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
const button = (label: string) => tree.root.findAll(node => node.props.label === label || node.props.accessibilityLabel === label)[0];
/** The cards of Dogovori, by the name they open. */
const rows = () => presses().filter(node => /^Otvori Dogovor/.test(String(node.props.accessibilityLabel))).map(node => node.props.accessibilityLabel);
/** The "Predloži termin" commands on screen, by the Dogovor they are for. */
const proposals = () => presses().filter(node => /^Predloži termin\. /.test(String(node.props.accessibilityLabel))).map(node => node.props.accessibilityLabel);
const days = () => presses().filter(node => WEEKDAY.test(String(node.props.accessibilityLabel)));
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const cellsOf = (holder: ReactTestInstance) => holder.findAll(node => node.type === 'Press' as React.ElementType && WEEKDAY.test(String(node.props.accessibilityLabel)));
/** What a day of the strip draws for its mark: the circle, or none. */
const markOf = (cell: ReactTestInstance) => cell.findAllByType(Circle)[0]?.props as Record<string, unknown> | undefined;
const headings = () => tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.accessibilityRole === 'header').map(node => node.props.children);
const pullControl = () => tree.root.findAllByType('ScrollView' as React.ElementType)[0].props.refreshControl as { props: { refreshing: boolean; onRefresh?: () => void } };

type Props = Partial<React.ComponentProps<typeof AgendaScreen>>;
const handlers = () => ({ onSelect: jest.fn(), onBack: jest.fn(), onRefresh: jest.fn(), onRetry: jest.fn(), onRetryList: jest.fn(), onOpen: jest.fn(),
  onProposeTerm: jest.fn(), onAvailability: jest.fn(), onArchive: jest.fn() });
const element = (given: ReturnType<typeof handlers>, patch: Props = {}) => <AgendaScreen selected={DAY} today={DAY} schedule={{ state: 'ready', events: [] }}
  list={{ state: 'ready', agreements: [] }} refreshing={false} phoneZone="Europe/Belgrade" now={NOW} {...given} {...patch} />;
const draw = async (patch: Props = {}) => {
  const given = handlers();
  await act(async () => { tree = create(element(given, patch)); });
  return given;
};
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); mockFontScale = 1; mockWidth = 390; });

const start = (id: string, at: string, patch: Partial<DogovorProjekcija> = {}) =>
  agreementOf(id, { tacanTermin: null, prihvacenPocetak: at, vremeTekst: 'Od 7. okt · 14:00 · kraj nije potvrđen', ...patch });
const window = (day: string, from: string, to: string) => ({ pocetak: serbian(day, from), kraj: serbian(day, to) });

/** A day with the three ways a Dogovor stands on it: my work 09-11 (the schedule), a Dogovor of mine as the requester 10-12 on top of it, and one with only a start. */
const busy = (): Props => ({
  schedule: { state: 'ready', events: [eventOf('e1', 'w1', serbian(DAY, '09:00'), serbian(DAY, '11:00'))] },
  list: { state: 'ready', agreements: [
    workerAgreementOf('w1', { naslov: 'Montaža police', cena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' } }),
    agreementOf('r1', { naslov: 'Čišćenje stana', tacanTermin: window(DAY, '10:00', '12:00') }),
    start('s1', serbian(DAY, '14:00'), { naslov: 'Šišanje živice' }),
  ] },
});

describe('the day by the hour', () => {
  it('draws my Dogovori, both sides, in one list in the order of their start, each with its chip', async () => {
    await draw(busy());
    expect(rows()).toEqual(['Otvori Dogovor Montaža police', 'Otvori Dogovor Čišćenje stana', 'Otvori Dogovor Šišanje živice']);
    expect(text()).toContain('Dogovoren'); expect(text()).toContain('Uskačeš · Ana'); expect(text()).toContain('Tvoj zadatak · Marko'); expect(text()).toContain('2.000 RSD');
  });
  it('writes the time as the FIRST line of each card: a window, or one stored bound as "od 14:00"', async () => {
    await draw(busy());
    const firstLine = (label: string) => press(label).findAll(node => node.type === 'T' as React.ElementType)[0].children.join('');
    expect(firstLine('Otvori Dogovor Montaža police')).toBe('09:00–11:00');
    expect(firstLine('Otvori Dogovor Čišćenje stana')).toBe('10:00–12:00');
    // The Dogovor with an accepted start stands on its day, as Početna writes it ("Danas · od 14:00"); the end is never invented.
    expect(firstLine('Otvori Dogovor Šišanje živice')).toBe('od 14:00');
  });
  it('says "U toku" once the agreed time has arrived, and not before', async () => {
    await draw(busy());
    expect(text()).not.toContain('U toku');
    await act(async () => tree.unmount());
    await draw({ ...busy(), now: new Date('2026-10-07T07:30:00Z') });
    expect(text()).toContain('U toku');
    expect(press('Otvori Dogovor Montaža police').props.accessibilityValue.text).toContain('U toku');
    expect(press('Otvori Dogovor Čišćenje stana').props.accessibilityValue.text).not.toContain('U toku');
  });
  it('draws no dashed edge at all, and no ring anywhere on the cards', async () => {
    await draw(busy());
    expect(tree.root.findAll(node => flat(node).borderStyle === 'dashed')).toHaveLength(0);
  });
  it('draws no clock rail and no line beside the card, at a normal text size or a large one: the window is the first line of the card', async () => {
    await draw(busy());
    // The start is written once: a rail would have said "09:00" beside the card and the card its own window again.
    expect(text()).toContain('09:00–11:00'); expect(text().match(/09:00/g)).toHaveLength(1);
    await act(async () => tree.unmount());
    mockFontScale = 1.5;
    await draw(busy());
    expect(text()).toContain('09:00–11:00'); expect(text().match(/09:00/g)).toHaveLength(1);
  });
  it('names the other term in an orange line when two of my terms overlap, and leaves a Dogovor with only a start out of it', async () => {
    await draw(busy());
    expect(text()).toContain('Preklapa se sa Čišćenje stana'); expect(text()).toContain('Preklapa se sa Montaža police');
    expect(text().match(/Preklapa se/g)).toHaveLength(2);
    expect(press('Otvori Dogovor Čišćenje stana').props.accessibilityValue.text).toContain('Preklapa se sa Montaža police');
    expect(press('Otvori Dogovor Šišanje živice').props.accessibilityValue.text).not.toContain('Preklapa se');
  });
  it('speaks each row with its chip, its role, its time and its place', async () => {
    await draw(busy());
    const spoken = press('Otvori Dogovor Čišćenje stana').props.accessibilityValue.text as string;
    expect(spoken).toContain('Dogovoren'); expect(spoken).toContain('Tvoj zadatak'); expect(spoken).toContain('10:00–12:00'); expect(spoken).toContain('Liman, Novi Sad');
    expect(press('Otvori Dogovor Šišanje živice').props.accessibilityValue.text).toContain('od 14:00');
  });
  it('opens the Dogovor by a press on its card, and offers no command of a term on a card that has one', async () => {
    const given = await draw(busy());
    await act(async () => press('Otvori Dogovor Montaža police').props.onPress());
    await act(async () => press('Otvori Dogovor Šišanje živice').props.onPress());
    expect(given.onOpen.mock.calls).toEqual([['w1'], ['s1']]);
    expect(proposals()).toEqual([]);
  });
  it('is one quiet line for an empty day, never a box', async () => {
    await draw({ list: { state: 'ready', agreements: [agreementOf('d9', { tacanTermin: window('2026-10-20', '09:00', '10:00') })] } });
    expect(text()).toContain('Ništa nije zakazano za ovaj dan.');
    expect(rows()).toEqual([]);
  });
  it('gives an empty day no minimum height: the block is exactly its one line, and whatever follows stands the screen\'s own space under it', async () => {
    await draw();
    const block = tree.root.findByProps({ testID: 'day-block' });
    expect(flat(block).minHeight).toBeUndefined();
    expect(block.findAll(node => node.type === 'T' as React.ElementType).map(node => node.children.join(''))).toEqual(['Ništa nije zakazano za ovaj dan.']);
  });
  it('says the day in Serbian time, and says so in words only on a phone set to another zone', async () => {
    await draw(busy());
    expect(text()).not.toContain('Po vremenu u Srbiji');
    expect(press('Otvori Dogovor Montaža police').props.accessibilityValue.text).not.toContain('po vremenu u Srbiji');
    await act(async () => tree.unmount());
    await draw({ ...busy(), phoneZone: 'America/New_York' });
    expect(text()).toContain('Po vremenu u Srbiji');
    expect(press('Otvori Dogovor Montaža police').props.accessibilityValue.text).toContain('po vremenu u Srbiji');
  });
  it('puts a Dogovor at half past midnight Serbian time on the day it falls on, with the clock its row writes', async () => {
    const next = '2026-10-08';
    await draw({ selected: next, schedule: { state: 'ready', events: [eventOf('e9', 'w9', '2026-10-07T22:30:00Z', '2026-10-07T23:30:00Z')] },
      list: { state: 'ready', agreements: [workerAgreementOf('w9', { naslov: 'Noćna smena' })] } });
    expect(rows()).toEqual(['Otvori Dogovor Noćna smena']); expect(text()).toContain('00:30');
    await act(async () => tree.unmount());
    await draw({ selected: DAY, schedule: { state: 'ready', events: [eventOf('e9', 'w9', '2026-10-07T22:30:00Z', '2026-10-07T23:30:00Z')] },
      list: { state: 'ready', agreements: [workerAgreementOf('w9', { naslov: 'Noćna smena' })] } });
    expect(rows()).toEqual([]);
  });
});

describe('Raspored holds the Dogovori and nothing else', () => {
  it('has no chips, no row of options, and nothing to scroll sideways, whatever is on the day', async () => {
    await draw(busy());
    expect(presses().filter(node => node.props.accessibilityRole === 'tab')).toHaveLength(0);
    expect(tree.root.findAll(node => node.type === 'ScrollView' as React.ElementType && node.props.horizontal)).toHaveLength(0);
    for (const word of ['Sve', 'Moji zadaci', 'Moje prijave', 'Prijava poslata', 'Čekaju odgovor', 'Bez tačnog termina']) expect(text()).not.toContain(word);
  });
  it('marks no day with a dashed outline or a ring: a day with a Dogovor on it has a dot, and the rest has nothing', async () => {
    await draw(busy());
    const circles = tree.root.findAllByType(Circle);
    expect(circles).toHaveLength(1);
    expect(circles[0].props).toMatchObject({ fill: sys.color.onDark });   // today, the chosen day: white on green
    for (const circle of circles) { expect(circle.props.stroke).toBeUndefined(); expect(circle.props.strokeDasharray).toBeUndefined(); }
  });
  it('draws no shade of the availability under the days: that is Dostupnost\'s to show', async () => {
    await draw(busy());
    expect(tree.root.findAll(node => node.props.testID === 'day-shade')).toHaveLength(0);
  });
});

describe('the week', () => {
  const week = (): Props => ({
    list: { state: 'ready', agreements: [
      agreementOf('active', { tacanTermin: window('2026-10-05', '09:00', '10:00') }),
      agreementOf('done', { stanje: 'COMPLETED', tacanTermin: window('2026-10-06', '09:00', '10:00') }),
      agreementOf('confirm', { stanje: 'AWAITING_REQUESTER', tacanTermin: window(DAY, '09:00', '10:00') }),
      start('from', serbian('2026-10-08', '09:00')),
    ] },
  });
  it('shows seven equal columns that always fit, the weekday shrinking to its letter at a very large text', async () => {
    await draw();
    expect(days()).toHaveLength(7);
    for (const cell of days()) expect(flat(cell)).toMatchObject({ flex: 1, minWidth: 0 });
    expect(days().map(cell => cell.findAllByType('T' as React.ElementType)[0].props.children)).toEqual(['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned']);
    expect(days()[0].props.accessibilityLabel).toMatch(/^Ponedeljak, 5\. okt/);
    await act(async () => tree.unmount());
    mockFontScale = 1.5;
    await draw();
    expect(days().map(cell => cell.findAllByType('T' as React.ElementType)[0].props.children)).toEqual(['P', 'U', 'S', 'Č', 'P', 'S', 'N']);
    expect(days()[0].props.accessibilityLabel).toMatch(/^Ponedeljak, /);
  });
  it('gives every day a touch of at least 44 dp on the phone of 361 dp, without hit slop reaching into its neighbour', async () => {
    await draw();
    for (const cell of days()) expect(cell.props.hitSlop).toBe(0);
    // The view that holds the week reaches past the gutters by its bleed, so every touch lands inside the bounds of a view that
    // receives it; each day is a seventh of it, less its own two margins.
    const holder = tree.root.findAll(node => node.type === 'View' as React.ElementType && typeof node.props.onResponderRelease === 'function')[0];
    const bleed = -Number(flat(holder).marginHorizontal), margin = Number(flat(days()[0]).marginHorizontal);
    expect(bleed).toBeGreaterThan(0);
    expect(cellsOf(holder)).toHaveLength(7);
    expect((361 - 2 * sys.space.lg + 2 * bleed) / 7 - 2 * margin).toBeGreaterThanOrEqual(44);
  });
  it('marks each day with a dot of the one colour that matters most on it: green, grey, orange; a start alone counts as a Dogovor', async () => {
    // Friday is chosen, so the other days wear their own colours.
    await draw({ ...week(), selected: '2026-10-09' });
    const [monday, tuesday, wednesday, thursday, friday] = days().map(markOf);
    expect(monday).toMatchObject({ fill: sys.color.green });
    expect(tuesday).toMatchObject({ fill: sys.color.muted });
    expect(wednesday).toMatchObject({ fill: sys.color.orangeInk });
    expect(thursday).toMatchObject({ fill: sys.color.green });
    expect(friday).toBeUndefined();
    // The chosen day is filled green, so its dot is white.
    await act(async () => tree.unmount());
    await draw({ ...week(), selected: '2026-10-08' });
    expect(markOf(days()[3])).toMatchObject({ fill: sys.color.onDark });
    expect(markOf(days()[2])).toMatchObject({ fill: sys.color.orangeInk });
  });
  it('never draws any shape but the dot', async () => {
    await draw({ ...week(), selected: '2026-10-09' });
    for (const circle of tree.root.findAllByType(Circle)) {
      expect(circle.props).toMatchObject({ r: 3.2 });
      expect(circle.props.stroke).toBeUndefined(); expect(circle.props.strokeDasharray).toBeUndefined();
    }
  });
  it('says in words what each dot means, and a day without one says nothing more', async () => {
    await draw({ ...week(), selected: '2026-10-09' });
    const labels = days().map(cell => cell.props.accessibilityLabel);
    expect(labels[0]).toBe('Ponedeljak, 5. okt, ima Dogovor');
    expect(labels[1]).toBe('Utorak, 6. okt, ima završen Dogovor');
    expect(labels[2]).toBe('Sreda, 7. okt, danas, nešto čeka tebe');
    expect(labels[3]).toBe('Četvrtak, 8. okt, ima Dogovor');
    expect(labels[4]).toBe('Petak, 9. okt');
  });
  it('marks no day while the schedule is still being read, and calls none empty', async () => {
    await draw({ schedule: { state: 'loading' } });
    expect(days().map(markOf)).toEqual(Array(7).fill(undefined));
    expect(text()).toContain('Učitavamo raspored…'); expect(text()).not.toContain('Ništa nije zakazano');
  });
  it('chooses a day by a press and speaks which one is chosen', async () => {
    const given = await draw();
    await act(async () => days()[4].props.onPress());
    expect(given.onSelect).toHaveBeenCalledWith('2026-10-09');
    expect(days().map(cell => cell.props.accessibilityState.selected)).toEqual([false, false, true, false, false, false, false]);
    expect(days()[2].props.accessibilityLabel).toContain('danas');
  });
  it('steps by a week with the arrows, and names today\'s week only when today is in another one', async () => {
    const given = await draw();
    await act(async () => button('Prethodna nedelja').props.onPress());
    await act(async () => button('Sledeća nedelja').props.onPress());
    expect(given.onSelect.mock.calls).toEqual([['2026-09-30'], ['2026-10-14']]);
    expect(button('Danas')).toBeUndefined();
    await act(async () => tree.unmount());
    await draw({ selected: '2026-10-21' });
    expect(button('Danas')).toBeDefined();
  });
});

describe('swipe changes the week', () => {
  const capture = async () => {
    const spy = jest.spyOn(PanResponder, 'create');
    const given = await draw();
    return { config: spy.mock.calls[0][0], given };
  };
  it('goes to the next week on a clear move to the left and to the previous on one to the right', async () => {
    const { config, given } = await capture();
    await act(async () => { config.onPanResponderRelease?.({} as never, { dx: -(SWIPE_DISTANCE + 4), dy: 6, vx: -0.1 } as never); });
    await act(async () => { config.onPanResponderRelease?.({} as never, { dx: SWIPE_DISTANCE + 4, dy: -6, vx: 0.1 } as never); });
    expect(given.onSelect.mock.calls).toEqual([['2026-10-14'], ['2026-09-30']]);
  });
  it('counts a short, quick flick, and not a slow short drag, a mostly vertical move, or a tap', async () => {
    const { config, given } = await capture();
    const release = (dx: number, dy: number, vx: number) => config.onPanResponderRelease?.({} as never, { dx, dy, vx } as never);
    await act(async () => { release(-40, 4, -0.8); });
    expect(given.onSelect.mock.calls).toEqual([['2026-10-14']]);
    await act(async () => { release(-40, 4, -0.1); release(-90, 60, -0.9); release(2, 0, 0); });
    expect(given.onSelect).toHaveBeenCalledTimes(1);
  });
  it('takes the touch only when the move is clearly sideways, so scrolling the day is never taken over', async () => {
    const { config } = await capture();
    const startOf = (dx: number, dy: number) => config.onMoveShouldSetPanResponder?.({} as never, { dx, dy } as never);
    expect(startOf(-30, 4)).toBe(true); expect(startOf(30, -4)).toBe(true);
    expect(startOf(-10, 0)).toBe(false); expect(startOf(-30, 20)).toBe(false); expect(startOf(2, 60)).toBe(false);
    expect(config.onPanResponderTerminationRequest?.({} as never, {} as never)).toBe(false);
  });
  it('is spread over the week and over the day', async () => {
    await draw();
    const swipers = tree.root.findAll(node => node.type === 'View' as React.ElementType && typeof node.props.onResponderRelease === 'function');
    expect(swipers).toHaveLength(2);
    expect(swipers[0].findAll(node => WEEKDAY.test(String(node.props.accessibilityLabel))).length).toBe(7);
  });
});

describe('the month, from the name of the week', () => {
  const grid = () => tree.root.findByProps({ testID: 'month-grid' });
  const dayCell = (label: RegExp) => grid().findAll(node => node.type === 'Press' as React.ElementType && label.test(String(node.props.accessibilityLabel)))[0];
  it('opens as a panel when the name of the week is pressed, and is not there before', async () => {
    await draw();
    expect(tree.root.findAll(node => node.type === 'Sheet' as React.ElementType)).toHaveLength(0);
    expect(press('5–11. okt').props.accessibilityHint).toBe('Otvara mesec');
    await act(async () => press('5–11. okt').props.onPress());
    expect(tree.root.findAllByType('Sheet' as React.ElementType)).toHaveLength(1);
    expect(text()).toContain('Oktobar 2026');
  });
  it('marks the days of the month the planner has read with the marks of the week, and none for a month it has not', async () => {
    await draw({ list: { state: 'ready', agreements: [agreementOf('d', { tacanTermin: window('2026-10-20', '09:00', '10:00') })] } });
    await act(async () => press('5–11. okt').props.onPress());
    const marked = grid().findAll(node => node.type === 'Press' as React.ElementType && / ima Dogovor$/.test(String(node.props.accessibilityLabel)));
    expect(marked).toHaveLength(1); expect(marked[0].props.accessibilityLabel).toMatch(/^Utorak, 20\. okt/);
    expect(markOf(marked[0])).toMatchObject({ fill: sys.color.green });
    await act(async () => button('Prethodni mesec').props.onPress());
    expect(text()).toContain('Septembar 2026');
    expect(grid().findAllByType(Circle)).toHaveLength(0);
  });
  it('marks the month on each side as well when the schedule was read for them, and no month beyond what was read', async () => {
    const dogovor = (day: string) => agreementOf(`d-${day}`, { tacanTermin: window(day, '09:00', '10:00') });
    await draw({ readWindow: plannerWindow(DAY, 1), list: { state: 'ready', agreements: [dogovor('2026-09-15'), dogovor('2026-11-10'), dogovor('2026-12-01')] } });
    await act(async () => press('5–11. okt').props.onPress());
    const marked = () => grid().findAll(node => node.type === 'Press' as React.ElementType && / ima Dogovor$/.test(String(node.props.accessibilityLabel)))
      .map(node => String(node.props.accessibilityLabel).split(',')[1].trim());
    await act(async () => button('Sledeći mesec').props.onPress());
    expect(text()).toContain('Novembar 2026'); expect(marked()).toEqual(['10. nov']);
    // December is read only as far as its first week: a month that is only partly read is not drawn with marks at all.
    await act(async () => button('Sledeći mesec').props.onPress());
    expect(text()).toContain('Decembar 2026'); expect(marked()).toEqual([]);
    await act(async () => button('Prethodni mesec').props.onPress()); await act(async () => button('Prethodni mesec').props.onPress());
    await act(async () => button('Prethodni mesec').props.onPress());
    expect(text()).toContain('Septembar 2026'); expect(marked()).toEqual(['15. sep']);
  });
  it('goes back as well as forward, and across the year', async () => {
    await draw({ selected: '2027-01-14', today: DAY });
    await act(async () => press('11–17. jan 2027').props.onPress());
    expect(text()).toContain('Januar 2027');
    await act(async () => button('Prethodni mesec').props.onPress());
    expect(text()).toContain('Decembar 2026');
    await act(async () => button('Sledeći mesec').props.onPress()); await act(async () => button('Sledeći mesec').props.onPress());
    expect(text()).toContain('Februar 2027');
  });
  it('chooses a day, tells the screen, and closes', async () => {
    const given = await draw();
    await act(async () => press('5–11. okt').props.onPress());
    await act(async () => dayCell(/^Utorak, 20\. okt/).props.onPress());
    expect(given.onSelect).toHaveBeenCalledWith('2026-10-20');
    expect(tree.root.findAll(node => node.type === 'Sheet' as React.ElementType)).toHaveLength(0);
  });
  it('speaks the chosen day, today, and the weekday of every day', async () => {
    await draw();
    await act(async () => press('5–11. okt').props.onPress());
    expect(dayCell(/^Sreda, 7\. okt/).props.accessibilityLabel).toBe('Sreda, 7. okt, danas');
    expect(dayCell(/^Sreda, 7\. okt/).props.accessibilityState).toEqual({ selected: true });
    expect(grid().findAll(node => node.type === 'Press' as React.ElementType && WEEKDAY.test(String(node.props.accessibilityLabel)))).toHaveLength(31);
  });
  it('draws no marks while the schedule is still being read', async () => {
    await draw({ schedule: { state: 'loading' } });
    await act(async () => press('5–11. okt').props.onPress());
    expect(grid().findAllByType(Circle)).toHaveLength(0);
  });
});

describe('"Termin još nije dogovoren"', () => {
  const loose = (): Props => ({
    list: { state: 'ready', agreements: [
      agreementOf('l1', { naslov: 'Košenje živice', vremeTekst: 'Termin nije dogovoren', prihvacenPocetak: null }),
      agreementOf('l2', { naslov: 'Farbanje ograde', vremeTekst: 'Do 09. okt · 18:00 · početak nije potvrđen', prihvacenPocetak: null }),
      agreementOf('l3', { naslov: 'Montaža nadstrešnice', vremeTekst: 'Termin nije dogovoren', stanje: 'AWAITING_REQUESTER', prihvacenPocetak: null }),
      // A start of 12 Oct: it has a day, so it is not listed here (it stands on 12 Oct).
      start('s1', serbian('2026-10-12', '10:00'), { naslov: 'Čišćenje tavana' }),
    ] },
  });
  it('lists only the Dogovori that have no accepted start, under a heading that is true of every one of them', async () => {
    await draw(loose());
    expect(headings()).toEqual(expect.arrayContaining(['Termin još nije dogovoren']));
    expect(rows()).toEqual(['Otvori Dogovor Košenje živice', 'Otvori Dogovor Farbanje ograde', 'Otvori Dogovor Montaža nadstrešnice']);
    expect(text()).not.toContain('Čišćenje tavana'); expect(text()).not.toContain('Bez tačnog termina');
  });
  it('says nothing about the time of a Dogovor that has none (the heading says it), and the stored words for one that has an end', async () => {
    await draw(loose());
    const firstLine = (label: string) => press(label).findAll(node => node.type === 'T' as React.ElementType)[0].children.join('');
    expect(text()).not.toContain('Termin nije dogovoren'); expect(text()).not.toContain('Termin nije potvrđen');
    // The first line of a card with no words is its title, not a time.
    expect(firstLine('Otvori Dogovor Košenje živice')).toBe('Košenje živice');
    expect(firstLine('Otvori Dogovor Farbanje ograde')).toBe('Do 9. okt · 18:00 · početak nije potvrđen');
  });
  it('does not wear the plain "Dogovoren" under it, and keeps every other word of standing', async () => {
    await draw(loose());
    expect(text()).not.toContain('Dogovoren');
    expect(text()).toContain('Čeka potvrdu');
    expect(press('Otvori Dogovor Košenje živice').props.accessibilityValue.text).not.toContain('Dogovoren');
    expect(press('Otvori Dogovor Montaža nadstrešnice').props.accessibilityValue.text).toContain('Čeka potvrdu');
  });
  it('offers "Predloži termin" under each one that may ask for a term, as a press of its own beside the body, and not under one that waits for a confirmation', async () => {
    const given = await draw(loose());
    expect(proposals()).toEqual(['Predloži termin. Košenje živice', 'Predloži termin. Farbanje ograde']);
    expect(press('Otvori Dogovor Košenje živice').findAll(node => /^Predloži termin/.test(String(node.props.accessibilityLabel)))).toHaveLength(0);
    await act(async () => press('Predloži termin. Farbanje ograde').props.onPress());
    expect(given.onProposeTerm).toHaveBeenCalledWith('l2'); expect(given.onOpen).not.toHaveBeenCalled();
    await act(async () => press('Otvori Dogovor Farbanje ograde').props.onPress());
    expect(given.onOpen).toHaveBeenCalledWith('l2');
  });
  it('offers the command at no time of a Dogovor with a change waiting for an answer, or when the screen is given no way to propose', async () => {
    await draw({ list: { state: 'ready', agreements: [agreementOf('l1', { naslov: 'Košenje živice', prihvacenPocetak: null, izmenaCeka: { predlogId: 'p1', mojPredlog: false } })] } });
    expect(proposals()).toEqual([]);
    await act(async () => tree.unmount());
    await draw({ ...loose(), onProposeTerm: undefined });
    expect(proposals()).toEqual([]); expect(rows()).toHaveLength(3);
  });
  it('shows the first three, and the rest on a press that can be taken back', async () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map(id => agreementOf(id, { naslov: `Posao ${id}`, prihvacenPocetak: null }));
    await draw({ list: { state: 'ready', agreements: many } });
    expect(rows()).toHaveLength(3);
    expect(button('Prikaži još 2')).toBeDefined();
    await act(async () => button('Prikaži još 2').props.onPress());
    expect(rows()).toHaveLength(5); expect(button('Prikaži manje')).toBeDefined();
    await act(async () => button('Prikaži manje').props.onPress());
    expect(rows()).toHaveLength(3);
  });
  it('shows no "Prikaži još" for three or fewer, and no heading at all when there is nothing to list', async () => {
    await draw(loose());
    expect(button('Prikaži još 1')).toBeUndefined();
    await act(async () => tree.unmount());
    await draw();
    expect(headings()).not.toContain('Termin još nije dogovoren');
  });
  it('holds a Dogovor with only a start on its own day, whichever week is chosen, and not under the heading', async () => {
    await draw({ ...loose(), selected: '2026-10-12' });
    // On its day first, then the three that have no start under the heading, whatever day is chosen.
    expect(rows()).toEqual(['Otvori Dogovor Čišćenje tavana', 'Otvori Dogovor Košenje živice', 'Otvori Dogovor Farbanje ograde', 'Otvori Dogovor Montaža nadstrešnice']);
    expect(press('Otvori Dogovor Čišćenje tavana').findAll(node => node.type === 'T' as React.ElementType)[0].children.join('')).toBe('od 10:00');
    expect(headings()).toEqual(expect.arrayContaining(['Termin još nije dogovoren']));
    // On the day it is not, the start is not repeated under the heading.
    await act(async () => tree.unmount());
    await draw(loose());
    expect(rows()).not.toContain('Otvori Dogovor Čišćenje tavana');
  });
  it('leaves the Dogovori out while the list does not say which of them have an exact term', async () => {
    await draw({ list: { state: 'ready', agreements: [agreementOf('x', { tacanTermin: undefined }), agreementOf('l1', { naslov: 'Košenje živice', prihvacenPocetak: null })] } });
    expect(headings()).not.toContain('Termin još nije dogovoren');
    expect(text()).toContain('Nema termina u kojima uskačeš.');
  });
  it('is not a place for a finished or cancelled Dogovor', async () => {
    await draw({ list: { state: 'ready', agreements: [agreementOf('c', { stanje: 'CANCELLED', prihvacenPocetak: null }), agreementOf('f', { stanje: 'COMPLETED', prihvacenPocetak: null })] } });
    expect(headings()).not.toContain('Termin još nije dogovoren'); expect(rows()).toEqual([]);
  });
});

describe('a read that failed is said, and a day is never called empty for it', () => {
  it('shows a loading list, not an empty day, while the Dogovori are still being read', async () => {
    await draw({ list: { state: 'loading' } });
    expect(text()).toContain('Učitavamo raspored…'); expect(text()).not.toContain('Ništa nije zakazano');
  });
  it('says the schedule failed with its own message and offers to read it again', async () => {
    const given = await draw({ schedule: { state: 'error', message: 'Nalog je promenjen. Ponovo otvori Raspored.' } });
    expect(text()).toContain('Raspored nije učitan.'); expect(text()).toContain('Nalog je promenjen. Ponovo otvori Raspored.'); expect(text()).not.toContain('Ništa nije zakazano');
    await act(async () => button('Pokušaj ponovo').props.onPress());
    expect(given.onRetry).toHaveBeenCalledTimes(1);
  });
  it('says only the work I do is shown when the Dogovori did not load, and reads them again on a press', async () => {
    const given = await draw({ list: { state: 'error' } });
    expect(text()).toContain('Nema termina u kojima uskačeš.'); expect(text()).not.toContain('Ništa nije zakazano');
    await act(async () => button('Pokušaj ponovo').props.onPress());
    expect(given.onRetryList).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
    await draw({ ...busy(), list: { state: 'error' } });
    expect(text()).toContain('Učitani su samo termini u kojima uskačeš.'); expect(rows()).toEqual(['Otvori Dogovor sa potvrđenim terminom']);
  });
  it('says the same when the list does not say whether its Dogovori have an exact term, but cannot be read again for it', async () => {
    await draw({ ...busy(), list: { state: 'ready', agreements: [agreementOf('x', { tacanTermin: undefined })] } });
    expect(text()).toContain('Učitani su samo termini u kojima uskačeš.');
    expect(button('Pokušaj ponovo')).toBeUndefined();
  });
});

describe('the foot, the pull and the screen reader', () => {
  it('leads to my availability and to the Arhiva, in that order, by their visible words', async () => {
    const given = await draw();
    const foot = presses().filter(node => node.props.accessibilityLabel === 'Moja dostupnost za rad' || node.props.accessibilityLabel === 'Arhiva');
    expect(foot.map(node => node.props.accessibilityLabel)).toEqual(['Moja dostupnost za rad', 'Arhiva']);
    await act(async () => foot[0].props.onPress()); await act(async () => foot[1].props.onPress());
    expect(given.onAvailability).toHaveBeenCalledTimes(1); expect(given.onArchive).toHaveBeenCalledTimes(1);
  });
  it('does not draw the Arhiva row where there is no archive to go to', async () => {
    await draw({ onArchive: undefined });
    expect(presses().filter(node => node.props.accessibilityLabel === 'Arhiva')).toHaveLength(0);
    expect(presses().filter(node => node.props.accessibilityLabel === 'Moja dostupnost za rad')).toHaveLength(1);
  });
  it('no longer offers a row of Dogovori without a term: they stand under the day now', async () => {
    await draw({ list: { state: 'ready', agreements: [agreementOf('l1')] } });
    expect(presses().filter(node => node.props.accessibilityLabel === 'Svi Dogovori')).toHaveLength(0);
  });
  it('lets a screen reader read the planner again from the day\'s heading, as the pull does', async () => {
    const given = await draw();
    const scroll = tree.root.findAllByType('ScrollView' as React.ElementType)[0];
    expect(scroll.props.accessibilityActions).toBeUndefined();
    const heading = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.accessibilityActions)[0];
    expect(heading.props.accessibilityRole).toBe('header');
    await act(async () => heading.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    expect(given.onRefresh).not.toHaveBeenCalled();
    await act(async () => heading.props.onAccessibilityAction({ nativeEvent: { actionName: 'refresh' } }));
    expect(given.onRefresh).toHaveBeenCalledTimes(1);
  });
  it('raises the spinner only for a pull, never for a read the screen starts for another reason, and lets go when that read ends', async () => {
    const given = handlers();
    await act(async () => { tree = create(element(given, { refreshing: true })); });
    // A read that is running for another reason (a focus, a retry): the list draws no spinner for it.
    expect(pullControl().props.refreshing).toBe(false);
    await act(async () => pullControl().props.onRefresh?.());
    expect(given.onRefresh).toHaveBeenCalledTimes(1);
    expect(pullControl().props.refreshing).toBe(true);
    await act(async () => { tree.update(element(given, { refreshing: false })); });
    expect(pullControl().props.refreshing).toBe(false);
    // A later read is not the pull's: the spinner does not come back.
    await act(async () => { tree.update(element(given, { refreshing: true })); });
    expect(pullControl().props.refreshing).toBe(false);
  });
  it('lets a pull that started nothing go after a moment, so a read that begins later does not borrow it', async () => {
    jest.useFakeTimers();
    const given = handlers();
    await act(async () => { tree = create(element(given, { refreshing: false })); });
    await act(async () => pullControl().props.onRefresh?.());
    await act(async () => { jest.advanceTimersByTime(PULL_GRACE_MS + 10); });
    await act(async () => { tree.update(element(given, { refreshing: true })); });
    expect(pullControl().props.refreshing).toBe(false);
  });
  it('is called "Raspored" in its bar, names the day in the heading and the section as a heading', async () => {
    await draw({ list: { state: 'ready', agreements: [agreementOf('l1', { naslov: 'Košenje živice', prihvacenPocetak: null })] } });
    expect(text()).toContain('Raspored'); expect(text()).not.toContain('Kalendar obaveza');
    expect(text()).toContain('Sreda, 7. okt');
    expect(headings()).toEqual(expect.arrayContaining(['Sreda, 7. okt', 'Termin još nije dogovoren']));
  });
  it('never says "posao" anywhere on the screen, in any of its states', async () => {
    const states: Props[] = [busy(), { list: { state: 'ready', agreements: [agreementOf('l1', { prihvacenPocetak: null }), agreementOf('l2', { prihvacenPocetak: null, stanje: 'AWAITING_REQUESTER' })] } },
      { list: { state: 'error' } }, { schedule: { state: 'loading' } }, { schedule: { state: 'error', message: null } }, {}];
    for (const patch of states) {
      await draw(patch);
      expect(text()).not.toMatch(NO_POSAO);
      expect(rows().concat(proposals(), days().map(cell => String(cell.props.accessibilityLabel))).join(' ')).not.toMatch(NO_POSAO);
      await act(async () => tree.unmount());
    }
  });
  it('goes back by the arrow of its bar', async () => {
    const given = await draw();
    await act(async () => button('Nazad').props.onPress());
    expect(given.onBack).toHaveBeenCalledTimes(1);
  });
});
