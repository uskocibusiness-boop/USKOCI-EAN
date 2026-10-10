import React from 'react';
import { PanResponder, StyleSheet } from 'react-native';
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
  ProductSheet: ({ label, title, children, onClose }: { label?: string; title?: string; children: (dismiss: () => void) => React.ReactNode; onClose: () => void }) =>
    require('react').createElement('Sheet', { label, title, onClose }, children(() => onClose())),
}));

import type { DogovorProjekcija } from '../../../contracts/projections';
import { sys } from '../../system/tokens';
import { PULL_GRACE_MS } from '../../system/usePullRefresh';
import { AgendaScreen, type AgendaAvailability } from '../AgendaScreen';
import { HOUR_HEIGHT } from '../calendarViews';
import { ROLE_TONES } from '../roleTone';
import { plannerWindow } from '../serbianDays';
import { SWIPE_DISTANCE } from '../weekSwipe';
import { NO_POSAO, agreementOf, eventOf, serbian, workerAgreementOf } from './fixtures';

// Raspored on the owner's phone: Wednesday 7 October 2026, Serbian time. Everything is stated in Serbian clocks, so these cases
// mean the same in any zone the suite runs in (it runs in UTC, two hours behind).
const DAY = '2026-10-07';
const NOW = new Date('2026-10-07T05:00:00Z');
const WEEKDAY = /^(Ponedeljak|Utorak|Sreda|Četvrtak|Petak|Subota|Nedelja), /;

let tree: ReactTestRenderer;
const scrollTo = jest.fn();
/** A ScrollView that can be told to scroll: the one ref a screen takes. */
const nodes = (element: { type: unknown }) => element.type === 'ScrollView' ? { scrollTo } : null;
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAll(node => node.type === 'Press' as React.ElementType);
const press = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
const button = (label: string) => tree.root.findAll(node => node.props.label === label || node.props.accessibilityLabel === label)[0];
const byId = (testID: string) => tree.root.findAll(node => node.props.testID === testID);
/** The cards of Dogovori in a list (a block on the hours is not one), by the name they open. */
const cards = () => presses().filter(node => node.props.testID === 'agenda-card').map(node => String(node.props.accessibilityLabel));
/** Everything that opens a Dogovor, card or block. */
const opens = () => presses().filter(node => /^Otvori Dogovor/.test(String(node.props.accessibilityLabel))).map(node => String(node.props.accessibilityLabel));
const proposals = () => presses().filter(node => /^Predloži termin\. /.test(String(node.props.accessibilityLabel))).map(node => String(node.props.accessibilityLabel));
const cells = () => presses().filter(node => WEEKDAY.test(String(node.props.accessibilityLabel)));
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const headings = () => tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.accessibilityRole === 'header').map(node => node.props.children);
const pullControl = () => tree.root.findAllByType('ScrollView' as React.ElementType)[0].props.refreshControl as { props: { refreshing: boolean; onRefresh?: () => void } };
/** The dots of a cell, by the colour they are drawn in, and the "+N" it says. */
const dotsOf = (cell: ReactTestInstance) => cell.findAll(node => node.props.testID === 'day-dot').map(node => flat(node).backgroundColor);
const moreOf = (cell: ReactTestInstance) => cell.findAll(node => node.props.testID === 'day-more' || (node.type === 'T' as React.ElementType && /^\+\d+$/.test(String(node.props.children)))).map(node => node.props.children);
const cell = (label: RegExp) => cells().find(node => label.test(String(node.props.accessibilityLabel)))!;
const tab = (label: string) => presses().find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label)!;

type Props = Partial<React.ComponentProps<typeof AgendaScreen>>;
const handlers = () => ({ onSelect: jest.fn(), onBack: jest.fn(), onRefresh: jest.fn(), onRetry: jest.fn(), onRetryList: jest.fn(), onOpen: jest.fn(),
  onProposeTerm: jest.fn(), onAvailability: jest.fn(), onArchive: jest.fn() });
const element = (given: ReturnType<typeof handlers>, patch: Props = {}) => <AgendaScreen selected={DAY} today={DAY} schedule={{ state: 'ready', events: [] }}
  list={{ state: 'ready', agreements: [] }} refreshing={false} phoneZone="Europe/Belgrade" now={NOW} {...given} {...patch} />;
const draw = async (patch: Props = {}) => {
  const given = handlers();
  await act(async () => { tree = create(element(given, patch), { createNodeMock: nodes }); });
  return given;
};
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); scrollTo.mockClear(); mockFontScale = 1; mockWidth = 390; });

const start = (id: string, at: string, patch: Partial<DogovorProjekcija> = {}) =>
  agreementOf(id, { tacanTermin: null, prihvacenPocetak: at, vremeTekst: 'Od 7. okt · 14:00 · kraj nije potvrđen', ...patch });
const window = (day: string, from: string, to: string) => ({ pocetak: serbian(day, from), kraj: serbian(day, to) });
const on = (day: string, id: string, from: string, to: string, patch: Partial<DogovorProjekcija> = {}) =>
  agreementOf(id, { naslov: `Zadatak ${id}`, tacanTermin: window(day, from, to), ...patch });

/** A day with the three ways a Dogovor stands on it: my work 09-11 (the schedule), a Dogovor of mine as the requester 10-12 on top of it, and one with only a start. */
const busy = (): Props => ({
  schedule: { state: 'ready', events: [eventOf('e1', 'w1', serbian(DAY, '09:00'), serbian(DAY, '11:00'))] },
  list: { state: 'ready', agreements: [
    workerAgreementOf('w1', { naslov: 'Montaža police', cena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' } }),
    agreementOf('r1', { naslov: 'Čišćenje stana', tacanTermin: window(DAY, '10:00', '12:00') }),
    start('s1', serbian(DAY, '14:00'), { naslov: 'Šišanje živice' }),
  ] },
});
/** A worker with an active profile who works Monday to Friday, 09:00 to 17:00. */
const WORKING: AgendaAvailability = { active: true, value: { timezone: 'Europe/Belgrade', windows: [], rules: [{ id: 'rule-1', weekdays: [1, 2, 3, 4, 5],
  startTime: '09:00:00', endTime: '17:00:00', startsOn: '2026-01-01', endsOn: null, label: '', active: true }] } };

describe('the frame', () => {
  it('is called "Raspored" in its bar, goes back by its arrow, and opens on the month with Mesec, Nedelja and Dan to choose from', async () => {
    const given = await draw();
    expect(text()).toContain('Raspored'); expect(text()).not.toContain('Kalendar obaveza');
    await act(async () => button('Nazad').props.onPress());
    expect(given.onBack).toHaveBeenCalledTimes(1);
    const tabs = presses().filter(node => node.props.accessibilityRole === 'tab');
    expect(tabs.map(node => node.props.accessibilityLabel)).toEqual(['Mesec', 'Nedelja', 'Dan']);
    expect(tabs.map(node => node.props.accessibilityState.selected)).toEqual([true, false, false]);
    expect(byId('month-grid')).toHaveLength(1);
  });
  it('holds the Dogovori and nothing else: no chip of tasks or applications, no sideways scroll', async () => {
    await draw(busy());
    expect(tree.root.findAll(node => node.type === 'ScrollView' as React.ElementType && node.props.horizontal)).toHaveLength(0);
    for (const word of ['Moji zadaci', 'Moje prijave', 'Prijava poslata', 'Čekaju odgovor', 'Bez tačnog termina', 'Svi Dogovori']) expect(text()).not.toContain(word);
  });
  it('switches the view by a press, keeps the day, and says which view it is on', async () => {
    const given = await draw();
    await act(async () => tab('Nedelja').props.onPress());
    expect(byId('month-grid')).toHaveLength(0); expect(byId('week-days')).toHaveLength(1);
    expect(presses().filter(node => node.props.accessibilityRole === 'tab').map(node => node.props.accessibilityState.selected)).toEqual([false, true, false]);
    await act(async () => tab('Dan').props.onPress());
    expect(byId('week-days')).toHaveLength(0); expect(byId('day-hours')).toHaveLength(1);
    await act(async () => tab('Mesec').props.onPress());
    expect(byId('month-grid')).toHaveLength(1);
    // Switching a view chooses no other day.
    expect(given.onSelect).not.toHaveBeenCalled();
  });
  it('opens on the view a gallery asks for', async () => {
    await draw({ initialView: 'week' });
    expect(byId('week-days')).toHaveLength(1);
    await act(async () => tree.unmount());
    await draw({ initialView: 'day' });
    expect(byId('day-hours')).toHaveLength(1);
  });
  it('has the legend behind an "i": the colours and the dots, the shade only when it is drawn, and the red line', async () => {
    await draw();
    const legend = () => presses().find(node => node.props.testID === 'calendar-legend')!;
    expect(legend().props.accessibilityLabel).toBe('Objašnjenje: Šta znače boje');
    await act(async () => legend().props.onPress());
    expect(text()).toContain('Zelena tačka: Dogovor u kome uskačeš.'); expect(text()).toContain('Koralna tačka: Dogovor za tvoj zadatak.');
    expect(text()).toContain('Crvena linija u prikazu dana: trenutno vreme.'); expect(text()).toContain('Narandžasta tačka u prikazu dana: nešto čeka tebe.');
    expect(text()).not.toContain('Osenčen dan');
    await act(async () => tree.unmount());
    await draw({ availability: WORKING });
    await act(async () => legend().props.onPress());
    expect(text()).toContain('Osenčen dan: dan iz tvoje dostupnosti za rad.');
  });
  it('has "Danas" in the bar, quiet on today and a press on any other day, and puts it under the period at a large text size', async () => {
    const given = await draw();
    expect(button('Danas').props.disabled).toBe(true);
    await act(async () => tree.unmount());
    const other = await draw({ selected: '2026-11-12' });
    expect(button('Danas').props.disabled).toBe(false);
    await act(async () => button('Danas').props.onPress());
    expect(other.onSelect).toHaveBeenCalledWith(DAY); expect(given.onSelect).not.toHaveBeenCalled();
    // In the bar, beside the legend, and not in the block of the period.
    expect(byId('period-header')[0].findAll(node => node.props.accessibilityLabel === 'Danas')).toHaveLength(0);
    await act(async () => tree.unmount());
    mockFontScale = 1.3;
    await draw({ selected: '2026-11-12' });
    // At 1.3 the bar has no room beside the legend: "Danas" stands in the period's own block.
    expect(byId('period-header')[0].findAll(node => node.props.accessibilityLabel === 'Danas')).toHaveLength(1);
  });
});

describe('the month', () => {
  it('is the grid of five weeks, Monday first, with the days of the neighbouring months dimmed, never touched and carrying nothing', async () => {
    await draw();
    expect(text()).toContain('Oktobar 2026');
    expect(cells()).toHaveLength(31);
    expect(cells()[0].props.accessibilityLabel).toMatch(/^Četvrtak, 1\. okt/);
    expect(byId('day-outside')).toHaveLength(4);
    for (const outside of byId('day-outside')) {
      expect(outside.props.accessibilityElementsHidden).toBe(true);
      expect(outside.findAll(node => node.props.testID === 'day-dot')).toHaveLength(0);
    }
    expect(tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.children === 'Pon').length).toBe(1);
  });
  it('rings today, fills the chosen day, and says both in words', async () => {
    await draw({ selected: '2026-10-12' });
    expect(byId('day-selected')).toHaveLength(1);
    expect(byId('day-today')).toHaveLength(1);
    expect(flat(byId('day-selected')[0]).backgroundColor).toBe(sys.color.green);
    expect(flat(byId('day-today')[0]).borderColor).toBe(sys.color.ink);
    expect(cell(/^Sreda, 7\. okt/).props.accessibilityLabel).toBe('Sreda, 7. okt, danas');
    expect(cell(/^Ponedeljak, 12\. okt/).props.accessibilityState).toEqual({ selected: true });
    expect(cell(/^Utorak, 13\. okt/).props.accessibilityState).toEqual({ selected: false });
  });
  it('fills the chosen day when it is today, and leaves no second ring', async () => {
    await draw();
    expect(byId('day-selected')).toHaveLength(1); expect(byId('day-today')).toHaveLength(0);
  });
  it('draws a dot a Dogovor in the colour of my side of it, two at most, and "+N" for the rest', async () => {
    await draw({
      schedule: { state: 'ready', events: [eventOf('e1', 'w1', serbian('2026-10-21', '09:00'), serbian('2026-10-21', '10:00'))] },
      list: { state: 'ready', agreements: [
        on('2026-10-20', 'a', '09:00', '10:00'),
        workerAgreementOf('w1', { naslov: 'Montaža police' }), on('2026-10-21', 'b', '11:00', '12:00'),
        on('2026-10-22', 'c', '09:00', '10:00'), on('2026-10-22', 'd', '11:00', '12:00'), on('2026-10-22', 'e', '13:00', '14:00'),
      ] },
    });
    const worker = ROLE_TONES.worker.front, requester = ROLE_TONES.requester.front;
    expect(dotsOf(cell(/^Utorak, 20\. okt/))).toEqual([requester]);
    expect(dotsOf(cell(/^Sreda, 21\. okt/))).toEqual([worker, requester]);
    expect(dotsOf(cell(/^Četvrtak, 22\. okt/))).toEqual([requester, requester]);
    expect(moreOf(cell(/^Četvrtak, 22\. okt/))).toEqual(['+1']);
    expect(moreOf(cell(/^Sreda, 21\. okt/))).toEqual([]);
    expect(dotsOf(cell(/^Petak, 23\. okt/))).toEqual([]);
    expect(worker).not.toBe(requester);
  });
  it('says in words what the dots only draw, and calls no day empty that it did not read', async () => {
    await draw({ list: { state: 'ready', agreements: [on('2026-10-20', 'a', '09:00', '10:00'), on('2026-10-20', 'b', '11:00', '12:00', { stanje: 'AWAITING_REQUESTER' })] } });
    expect(cell(/^Utorak, 20\. okt/).props.accessibilityLabel).toBe('Utorak, 20. okt, 2 Dogovora, Tvoj zadatak, nešto čeka tebe');
    expect(cell(/^Petak, 23\. okt/).props.accessibilityLabel).toBe('Petak, 23. okt');
  });
  it('has no dots at all while the schedule is read, and calls no day empty', async () => {
    await draw({ schedule: { state: 'loading' } });
    expect(byId('day-dot')).toHaveLength(0);
    expect(text()).toContain('Učitavamo raspored…'); expect(text()).not.toContain('Ništa nije zakazano');
    expect(cells()).toHaveLength(31);
  });
  it('tints the days the worker can work, only for an active work profile', async () => {
    await draw({ availability: WORKING });
    // October 2026 has 22 days from Monday to Friday; the weekends carry no tint, and neither do the neighbours' days.
    expect(byId('day-shade')).toHaveLength(22);
    expect(cell(/^Sub, |^Subota, 3\. okt/).findAll(node => node.props.testID === 'day-shade')).toHaveLength(0);
    expect(cell(/^Četvrtak, 1\. okt/).findAll(node => node.props.testID === 'day-shade')).toHaveLength(1);
    expect(flat(byId('day-shade')[0]).backgroundColor).toBe(sys.color.artRole.location.soft);
    await act(async () => tree.unmount());
    // A draft profile gives nobody anything, so its days are not "days I can work"; no profile has no days at all.
    await draw({ availability: { ...WORKING, active: false } });
    expect(byId('day-shade')).toHaveLength(0);
    await act(async () => tree.unmount());
    await draw();
    expect(byId('day-shade')).toHaveLength(0);
  });
  it('chooses a day by a press and shows the Dogovori of the chosen day under the grid, under its own heading', async () => {
    const given = await draw(busy());
    await act(async () => cell(/^Utorak, 13\. okt/).props.onPress());
    expect(given.onSelect).toHaveBeenCalledWith('2026-10-13');
    expect(headings()).toEqual(expect.arrayContaining(['Oktobar 2026', 'Danas, sreda 7. okt']));
    expect(cards()).toEqual(['Otvori Dogovor Montaža police', 'Otvori Dogovor Čišćenje stana', 'Otvori Dogovor Šišanje živice']);
    await act(async () => tree.unmount());
    await draw({ ...busy(), selected: '2026-10-13' });
    expect(headings()).toContain('Utorak, 13. okt'); expect(cards()).toEqual([]); expect(text()).toContain('Ništa nije zakazano za ovaj dan.');
  });
  it('steps by a month with the arrows, to the same day of it, and by a swipe the same', async () => {
    const given = await draw();
    await act(async () => button('Prethodni mesec').props.onPress());
    await act(async () => button('Sledeći mesec').props.onPress());
    expect(given.onSelect.mock.calls).toEqual([['2026-09-07'], ['2026-11-07']]);
    await act(async () => tree.unmount());
    const spy = jest.spyOn(PanResponder, 'create');
    const swiped = await draw();
    const config = spy.mock.calls[0][0];
    await act(async () => { config.onPanResponderRelease?.({} as never, { dx: -(SWIPE_DISTANCE + 4), dy: 6, vx: -0.1 } as never); });
    await act(async () => { config.onPanResponderRelease?.({} as never, { dx: SWIPE_DISTANCE + 4, dy: -6, vx: 0.1 } as never); });
    expect(swiped.onSelect.mock.calls).toEqual([['2026-11-07'], ['2026-09-07']]);
  });
  it('lands on the last day of a month that is shorter', async () => {
    const given = await draw({ selected: '2026-01-31', today: DAY });
    await act(async () => button('Sledeći mesec').props.onPress());
    expect(given.onSelect).toHaveBeenCalledWith('2026-02-28');
  });
  it('names the month as a heading and a polite live region, and the same heading reads the planner again for a screen reader', async () => {
    const given = await draw();
    const heading = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.children === 'Oktobar 2026')[0];
    expect(heading.props).toMatchObject({ accessibilityRole: 'header', accessibilityLiveRegion: 'polite' });
    expect(tree.root.findAllByType('ScrollView' as React.ElementType)[0].props.accessibilityActions).toBeUndefined();
    expect(heading.props.accessibilityActions).toEqual([{ name: 'refresh', label: 'Osveži raspored' }]);
    await act(async () => heading.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    expect(given.onRefresh).not.toHaveBeenCalled();
    await act(async () => heading.props.onAccessibilityAction({ nativeEvent: { actionName: 'refresh' } }));
    expect(given.onRefresh).toHaveBeenCalledTimes(1);
  });
  it('reads a month in another year with its year and in another month of this one', async () => {
    await draw({ selected: '2027-01-14' });
    expect(text()).toContain('Januar 2027');
    expect(cells()).toHaveLength(31);
  });
});

describe('a Dogovor in a list', () => {
  it('writes the time as the FIRST line of the card: a window, or one stored bound as "od 14:00"', async () => {
    await draw(busy());
    const firstLine = (label: string) => press(label).findAll(node => node.type === 'T' as React.ElementType)[0].children.join('');
    expect(firstLine('Otvori Dogovor Montaža police')).toBe('09:00–11:00');
    expect(firstLine('Otvori Dogovor Čišćenje stana')).toBe('10:00–12:00');
    // The Dogovor with an accepted start stands on its day, as Početna writes it ("Danas · od 14:00"); the end is never invented.
    expect(firstLine('Otvori Dogovor Šišanje živice')).toBe('od 14:00');
  });
  it('says whose side it is in words and colour, and draws the other person with their place', async () => {
    await draw(busy());
    const edge = (label: string) => flat(press(label).parent!.findAll(node => node.props.testID === 'role-edge')[0]).backgroundColor;
    expect(text()).toContain('Uskačeš'); expect(text()).toContain('Tvoj zadatak');
    expect(edge('Otvori Dogovor Montaža police')).toBe(ROLE_TONES.worker.front);
    expect(edge('Otvori Dogovor Čišćenje stana')).toBe(ROLE_TONES.requester.front);
    expect(text()).toContain('Ana'); expect(text()).toContain('Marko · Liman, Novi Sad');
    expect(text()).toContain('2.000 RSD');
  });
  it('draws no chip for "Dogovoren" (it is what everything on a schedule is), and says "U toku" once the agreed time has arrived', async () => {
    await draw(busy());
    expect(text()).not.toContain('Dogovoren'); expect(text()).not.toContain('U toku');
    await act(async () => tree.unmount());
    await draw({ ...busy(), now: new Date('2026-10-07T07:30:00Z') });
    expect(text()).toContain('U toku');
    expect(press('Otvori Dogovor Montaža police').props.accessibilityValue.text).toContain('U toku');
    expect(press('Otvori Dogovor Čišćenje stana').props.accessibilityValue.text).not.toContain('U toku');
  });
  it('draws a finished Dogovor and one that waits for me with their words', async () => {
    await draw({ list: { state: 'ready', agreements: [on(DAY, 'done', '09:00', '10:00', { stanje: 'COMPLETED' }), on(DAY, 'wait', '11:00', '12:00', { stanje: 'AWAITING_REQUESTER' })] } });
    expect(text()).toContain('Završen'); expect(text()).toContain('Čeka potvrdu');
  });
  it('draws no dashed edge at all, and no clock rail beside the card, at a normal text size or a large one', async () => {
    await draw(busy());
    expect(tree.root.findAll(node => flat(node).borderStyle === 'dashed')).toHaveLength(0);
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
  it('speaks each card with its side, its time, the other person, its amount and its place', async () => {
    await draw(busy());
    const spoken = press('Otvori Dogovor Čišćenje stana').props.accessibilityValue.text as string;
    expect(spoken).toContain('Tvoj zadatak'); expect(spoken).toContain('10:00–12:00'); expect(spoken).toContain('Liman, Novi Sad'); expect(spoken).toContain('Marko');
    expect(press('Otvori Dogovor Šišanje živice').props.accessibilityValue.text).toContain('od 14:00');
  });
  it('opens the Dogovor by a press on its card, and offers no command of a term on a card that has one', async () => {
    const given = await draw(busy());
    await act(async () => press('Otvori Dogovor Montaža police').props.onPress());
    await act(async () => press('Otvori Dogovor Šišanje živice').props.onPress());
    expect(given.onOpen.mock.calls).toEqual([['w1'], ['s1']]);
    expect(proposals()).toEqual([]);
  });
  it('writes a missing amount as a word, never as 0 RSD, and an unknown one not at all', async () => {
    await draw({ list: { state: 'ready', agreements: [on(DAY, 'free', '09:00', '10:00', { cena: { iznos: 0, valuta: 'RSD', prikaz: '' } })] } });
    expect(text()).toContain('Iznos nije sačuvan'); expect(text()).not.toContain('0 RSD');
  });
  it('draws the other person\'s face as the letters of their name, and as their photo when the route can read it, by their public profile id', async () => {
    const withFace = (profilId: string | null): Props => ({ list: { state: 'ready', agreements: [on(DAY, 'f', '09:00', '10:00', { ucesnici: [
      { id: 'me', profilId: null, ime: 'Ti', inicijali: '', uloga: 'narucilac', mesta: null, viSte: true, telefon: null },
      { id: 'other', profilId, ime: 'Marko Marković', inicijali: 'MM', uloga: 'uskocer', mesta: 1, viSte: false, telefon: null }] })] } });
    await draw(withFace('profile-9'));
    expect(text()).toContain('MM');
    await act(async () => tree.unmount());
    const photo = jest.fn((profileId: string, standIn: React.ReactNode) => React.createElement('Photo', { profileId }, standIn));
    await draw({ ...withFace('profile-9'), photo });
    expect(photo).toHaveBeenCalledWith('profile-9', expect.anything());
    expect(tree.root.findAllByType('Photo' as React.ElementType)).toHaveLength(1);
    await act(async () => tree.unmount());
    // Without a public profile id there is no photo to read, whatever the route can do: the letters stand.
    photo.mockClear();
    await draw({ ...withFace(null), photo });
    expect(photo).not.toHaveBeenCalled(); expect(text()).toContain('MM');
  });
  it('says the time in Serbian time, and says so in words only on a phone set to another zone', async () => {
    await draw(busy());
    expect(text()).not.toContain('Po vremenu u Srbiji');
    expect(press('Otvori Dogovor Montaža police').props.accessibilityValue.text).not.toContain('po vremenu u Srbiji');
    await act(async () => tree.unmount());
    await draw({ ...busy(), phoneZone: 'America/New_York' });
    expect(text()).toContain('Po vremenu u Srbiji');
    expect(press('Otvori Dogovor Montaža police').props.accessibilityValue.text).toContain('po vremenu u Srbiji');
  });
  it('puts a Dogovor at half past midnight Serbian time on the day it falls on, with the clock its card writes', async () => {
    const next = '2026-10-08';
    const night = { schedule: { state: 'ready' as const, events: [eventOf('e9', 'w9', '2026-10-07T22:30:00Z', '2026-10-07T23:30:00Z')] },
      list: { state: 'ready' as const, agreements: [workerAgreementOf('w9', { naslov: 'Noćna smena' })] } };
    await draw({ selected: next, ...night });
    expect(cards()).toEqual(['Otvori Dogovor Noćna smena']); expect(text()).toContain('00:30');
    await act(async () => tree.unmount());
    await draw({ selected: DAY, ...night });
    expect(cards()).toEqual([]);
  });
  it('names an untitled Dogovor from the list without calling it confirmed, and one from the schedule by its confirmed term', async () => {
    await draw({ list: { state: 'ready', agreements: [on(DAY, 'x', '09:00', '10:00', { naslov: '', stanje: 'COMPLETED' })] } });
    expect(opens()).toEqual(['Otvori Dogovor']);
    await act(async () => tree.unmount());
    await draw({ schedule: { state: 'ready', events: [eventOf('e1', 'w1', serbian(DAY, '09:00'), serbian(DAY, '10:00'))] } });
    expect(opens()).toEqual(['Otvori Dogovor sa potvrđenim terminom']);
  });
});

describe('the week', () => {
  const week = (): Props => ({ initialView: 'week', list: { state: 'ready', agreements: [
    on('2026-10-05', 'mon', '09:00', '10:00'), on('2026-10-06', 'tue', '09:00', '10:00', { stanje: 'COMPLETED' }),
    on(DAY, 'wed', '09:00', '10:00', { stanje: 'AWAITING_REQUESTER' }), start('thu', serbian('2026-10-08', '09:00'), { naslov: 'Zadatak thu' }),
  ] } });
  it('is the strip of seven days with its dots, and the seven days one under another: the busy ones with their cards, the others "Slobodno"', async () => {
    await draw(week());
    expect(text()).toContain('5–11. okt');
    expect(cells()).toHaveLength(7);
    expect(cells().map(node => node.props.accessibilityLabel)).toEqual([
      'Ponedeljak, 5. okt, 1 Dogovor, Tvoj zadatak', 'Utorak, 6. okt, 1 Dogovor, Tvoj zadatak', 'Sreda, 7. okt, danas, 1 Dogovor, Tvoj zadatak, nešto čeka tebe',
      'Četvrtak, 8. okt, 1 Dogovor, Tvoj zadatak', 'Petak, 9. okt', 'Subota, 10. okt', 'Nedelja, 11. okt']);
    expect(byId('busy-day')).toHaveLength(4); expect(byId('free-day')).toHaveLength(3);
    expect(headings()).toEqual(expect.arrayContaining(['Ponedeljak, 5. okt', 'Utorak, 6. okt', 'Danas, sreda 7. okt', 'Četvrtak, 8. okt']));
    expect(byId('free-day').map(node => node.props.accessibilityLabel)).toEqual(['Petak, 9. okt, slobodno', 'Subota, 10. okt, slobodno', 'Nedelja, 11. okt, slobodno']);
    expect(text().match(/Slobodno/g)).toHaveLength(3);
    expect(cards()).toEqual(['Otvori Dogovor Zadatak mon', 'Otvori Dogovor Zadatak tue', 'Otvori Dogovor Zadatak wed', 'Otvori Dogovor Zadatak thu']);
    expect(text()).toContain('od 09:00');
  });
  it('weekday short names shrink to their letter at a very large text size, and every cell is a seventh of the width, touching none', async () => {
    await draw(week());
    for (const one of cells()) expect(flat(one)).toMatchObject({ flex: 1, minWidth: 0 });
    for (const one of cells()) expect(one.props.hitSlop).toBe(0);
    expect(cells().map(node => node.findAllByType('T' as React.ElementType)[0].props.children)).toEqual(['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned']);
    await act(async () => tree.unmount());
    mockFontScale = 1.5;
    await draw(week());
    expect(cells().map(node => node.findAllByType('T' as React.ElementType)[0].props.children)).toEqual(['P', 'U', 'S', 'Č', 'P', 'S', 'N']);
    expect(cells()[0].props.accessibilityLabel).toMatch(/^Ponedeljak, /);
  });
  it('gives every day of the strip a touch of at least 44 dp on the phone of 361 dp, wide and tall', async () => {
    await draw(week());
    expect((361 - 2 * sys.layout.gutter) / 7).toBeGreaterThanOrEqual(44);
    for (const one of cells()) expect(Number(flat(one).minHeight)).toBeGreaterThanOrEqual(44);
  });
  it('colours the dots by the side, in the strip as in the month', async () => {
    await draw(week());
    expect(dotsOf(cells()[0])).toEqual([ROLE_TONES.requester.front]);
    expect(dotsOf(cells()[4])).toEqual([]);
  });
  it('chooses a day by a press, speaks which is chosen, and scrolls to its place in the list', async () => {
    const given = await draw(week());
    // The system lays the page out in a phone; here the test reports where each part begins: the view, the list of days in it, and each day.
    const placed = () => tree.root.findAll(node => node.type === 'View' as React.ElementType && typeof node.props.onLayout === 'function');
    await act(async () => { placed().forEach((node, at) => node.props.onLayout({ nativeEvent: { layout: { y: at === 0 ? 10 : at === 1 ? 100 : (at - 2) * 80 } } })); });
    scrollTo.mockClear();
    // Friday is the fifth day: it begins 4 × 80 into the list, which begins 100 into the view, which begins 10 into the page; 8 dp of air above it.
    await act(async () => cells()[4].props.onPress());
    expect(given.onSelect).toHaveBeenCalledWith('2026-10-09');
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 10 + 100 + 4 * 80 - 8, animated: false });
    // The chosen day is the screen's to say (the route holds it): here it is still Wednesday, and said so.
    expect(cells().map(node => node.props.accessibilityState.selected)).toEqual([false, false, true, false, false, false, false]);
    expect(cells()[2].props.accessibilityLabel).toContain('danas');
    await act(async () => tree.unmount());
    await draw({ ...week(), selected: '2026-10-09' });
    expect(cells().map(node => node.props.accessibilityState.selected)).toEqual([false, false, false, false, true, false, false]);
  });
  it('steps by a week with the arrows and with a swipe', async () => {
    const given = await draw(week());
    await act(async () => button('Prethodna nedelja').props.onPress());
    await act(async () => button('Sledeća nedelja').props.onPress());
    expect(given.onSelect.mock.calls).toEqual([['2026-09-30'], ['2026-10-14']]);
    await act(async () => tree.unmount());
    const spy = jest.spyOn(PanResponder, 'create');
    const swiped = await draw(week());
    await act(async () => { spy.mock.calls[0][0].onPanResponderRelease?.({} as never, { dx: -(SWIPE_DISTANCE + 4), dy: 6, vx: -0.1 } as never); });
    expect(swiped.onSelect).toHaveBeenCalledWith('2026-10-14');
  });
  it('never says a day is free before the schedule is read, or when only what the schedule says is shown', async () => {
    await draw({ ...week(), schedule: { state: 'loading' } });
    expect(text()).toContain('Učitavamo raspored…'); expect(text()).not.toContain('Slobodno'); expect(byId('free-day')).toHaveLength(0);
    expect(cells().map(node => dotsOf(node).length)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    await act(async () => tree.unmount());
    await draw({ initialView: 'week', list: { state: 'error' }, schedule: { state: 'ready', events: [eventOf('e1', 'w1', serbian('2026-10-06', '09:00'), serbian('2026-10-06', '10:00'))] } });
    expect(text()).toContain('Učitani su samo termini u kojima uskačeš.');
    expect(text()).not.toContain('Slobodno');
    expect(byId('free-day')).toHaveLength(6);
  });
  it('says there is nothing to show when the Dogovori did not load and the schedule has nothing', async () => {
    const given = await draw({ initialView: 'week', list: { state: 'error' } });
    expect(text()).toContain('Nema termina u kojima uskačeš.'); expect(text()).not.toContain('Ništa nije zakazano');
    await act(async () => button('Pokušaj ponovo').props.onPress());
    expect(given.onRetryList).toHaveBeenCalledTimes(1);
  });
  it('is all "Slobodno" for a week with nothing in it', async () => {
    await draw({ initialView: 'week' });
    expect(text().match(/Slobodno/g)).toHaveLength(7); expect(byId('busy-day')).toHaveLength(0);
  });
});

describe('the day on its hours', () => {
  const afternoon = (): Props => ({ initialView: 'day', ...busy() });
  const top = (label: string) => Number(flat(press(label).parent!).top ?? flat(press(label)).top);
  it('draws the hours from 07:00 to 22:00, one line and one label each, with nothing but them when the day is empty', async () => {
    await draw({ initialView: 'day' });
    expect(text()).toContain('Danas, sreda 7. okt');
    const labels = tree.root.findAll(node => node.type === 'T' as React.ElementType && /^\d{2}:00$/.test(String(node.props.children))).map(node => node.props.children);
    expect(labels).toEqual(Array.from({ length: 16 }, (_, at) => `${String(7 + at).padStart(2, '0')}:00`));
    expect(text()).toContain('Ništa nije zakazano za ovaj dan.');
    expect(byId('day-block')).toHaveLength(0); expect(byId('day-band')).toHaveLength(0);
  });
  it('draws a Dogovor as a block from its start to its end, at the place of its hours', async () => {
    await draw(afternoon());
    expect(opens()).toEqual(['Otvori Dogovor Montaža police', 'Otvori Dogovor Čišćenje stana', 'Otvori Dogovor Šišanje živice']);
    // 09:00 is two hours after 07:00; the block lasts two hours (the 2 dp round it are the air between neighbours).
    const styleOf = (label: string) => flat(press(label));
    expect(styleOf('Otvori Dogovor Montaža police')).toMatchObject({ top: 2 * HOUR_HEIGHT, height: 2 * HOUR_HEIGHT });
    expect(styleOf('Otvori Dogovor Čišćenje stana')).toMatchObject({ top: 3 * HOUR_HEIGHT, height: 2 * HOUR_HEIGHT });
    expect(top('Otvori Dogovor Šišanje živice')).toBe(7 * HOUR_HEIGHT);
    expect(byId('day-block')).toHaveLength(3);
  });
  it('puts blocks that overlap side by side, and a block that stands alone across the whole width', async () => {
    await draw(afternoon());
    const style = (label: string) => flat(press(label));
    expect(style('Otvori Dogovor Montaža police')).toMatchObject({ left: '0%', width: '50%' });
    expect(style('Otvori Dogovor Čišćenje stana')).toMatchObject({ left: '50%', width: '50%' });
    expect(style('Otvori Dogovor Šišanje živice')).toMatchObject({ left: '0%', width: '100%' });
  });
  it('draws each block in the tint of its side, with the edge of it', async () => {
    await draw(afternoon());
    const tint = (label: string) => flat(press(label).findAll(node => node.props.testID === 'day-block')[0]).backgroundColor;
    expect(tint('Otvori Dogovor Montaža police')).toBe(ROLE_TONES.worker.soft);
    expect(tint('Otvori Dogovor Čišćenje stana')).toBe(ROLE_TONES.requester.soft);
  });
  it('draws the orange dot of what is mine to do on a block that waits for me, and on no other', async () => {
    await draw({ initialView: 'day', list: { state: 'ready', agreements: [on(DAY, 'wait', '09:00', '10:00', { stanje: 'AWAITING_REQUESTER' }), on(DAY, 'fine', '11:00', '12:00')] } });
    expect(byId('block-waits')).toHaveLength(1);
    expect(press('Otvori Dogovor Zadatak wait').findAll(node => node.props.testID === 'block-waits')).toHaveLength(1);
    expect(flat(byId('block-waits')[0]).backgroundColor).toBe(sys.color.orange);
    expect(press('Otvori Dogovor Zadatak wait').props.accessibilityValue.text).toContain('Čeka potvrdu');
    expect(press('Otvori Dogovor Zadatak fine').findAll(node => node.props.testID === 'block-waits')).toHaveLength(0);
  });
  it('speaks each block as it speaks a card, and opens the Dogovor by a press', async () => {
    const given = await draw(afternoon());
    expect(press('Otvori Dogovor Čišćenje stana').props.accessibilityValue.text).toContain('Preklapa se sa Montaža police');
    expect(press('Otvori Dogovor Čišćenje stana').props.accessibilityValue.text).toContain('10:00–12:00');
    await act(async () => press('Otvori Dogovor Čišćenje stana').props.onPress());
    expect(given.onOpen).toHaveBeenCalledWith('r1');
  });
  it('says the other person and the time in a block tall enough for them, and a face in one taller still, and only the title in a short one', async () => {
    await draw({ initialView: 'day', list: { state: 'ready', agreements: [
      on(DAY, 'tall', '09:00', '12:00'), on(DAY, 'mid', '13:00', '14:00'), on(DAY, 'short', '15:00', '15:30')] } });
    const inside = (label: string) => press(label).findAll(node => node.type === 'T' as React.ElementType).map(node => node.props.children).flat();
    expect(inside('Otvori Dogovor Zadatak tall')).toEqual(expect.arrayContaining(['Zadatak tall', 'Marko', '09:00–12:00']));
    expect(inside('Otvori Dogovor Zadatak tall')).toContain('MM'.slice(0, 1));
    expect(inside('Otvori Dogovor Zadatak mid')).toEqual(['Zadatak mid', 'Marko · 13:00–14:00']);
    expect(inside('Otvori Dogovor Zadatak short')).toEqual(['Zadatak short']);
  });
  it('draws the worker\'s hours as a band beside the hours, with its words, for an active work profile only', async () => {
    await draw({ ...afternoon(), availability: WORKING });
    expect(byId('day-band')).toHaveLength(1);
    expect(byId('day-band')[0].props.accessibilityLabel).toBe('Mogu da radim, 09:00–17:00');
    expect(text()).toContain('Mogu da radim');
    // From 09:00, for eight hours: the band is as tall as the hours it names.
    expect(flat(byId('day-band')[0])).toMatchObject({ top: 12 + 2 * HOUR_HEIGHT, height: 8 * HOUR_HEIGHT });
    // The blocks make room for it.
    expect(Number(flat(byId('day-blocks')[0]).left)).toBeGreaterThan(52);
    await act(async () => tree.unmount());
    await draw({ ...afternoon(), availability: { ...WORKING, active: false } });
    expect(byId('day-band')).toHaveLength(0); expect(Number(flat(byId('day-blocks')[0]).left)).toBe(52);
  });
  it('draws no band on a day the worker has given nothing, and none for a band too short to say its words', async () => {
    await draw({ ...afternoon(), selected: '2026-10-10', availability: WORKING });
    expect(byId('day-band')).toHaveLength(0);
    await act(async () => tree.unmount());
    await draw({ ...afternoon(), availability: { active: true, value: { ...WORKING.value, rules: [{ ...WORKING.value.rules[0], startTime: '09:00:00', endTime: '10:00:00' }] } } });
    expect(byId('day-band')).toHaveLength(1);
    expect(text()).not.toContain('Mogu da radim');
  });
  it('draws the line of "sada" on today alone, where the minute says, and never on another day', async () => {
    await draw({ ...afternoon(), now: new Date('2026-10-07T07:30:00Z') });
    // 09:30 in Serbia.
    expect(byId('now-line')).toHaveLength(1);
    expect(flat(byId('now-line')[0])).toMatchObject({ top: 2.5 * HOUR_HEIGHT, backgroundColor: sys.color.danger });
    await act(async () => tree.unmount());
    await draw({ ...afternoon(), selected: '2026-10-08', today: DAY });
    expect(byId('now-line')).toHaveLength(0);
  });
  it('draws no line when "sada" is outside the hours drawn', async () => {
    await draw({ ...afternoon(), now: new Date('2026-10-07T21:30:00Z') });
    expect(byId('now-line')).toHaveLength(0);
  });
  it('asks the clock again each minute while the day is today, so the line moves', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-07T07:00:00Z') });
    const given = handlers();
    await act(async () => { tree = create(<AgendaScreen selected={DAY} today={DAY} schedule={{ state: 'ready', events: [] }} list={{ state: 'ready', agreements: [] }}
      refreshing={false} phoneZone="Europe/Belgrade" initialView="day" {...given} />, { createNodeMock: nodes }); });
    expect(flat(byId('now-line')[0]).top).toBe(2 * HOUR_HEIGHT);
    await act(async () => { jest.advanceTimersByTime(60 * 60_000); });
    expect(flat(byId('now-line')[0]).top).toBe(3 * HOUR_HEIGHT);
  });
  it('moves the edge of the hours outwards to take in a Dogovor before the first or after the last', async () => {
    await draw({ initialView: 'day', list: { state: 'ready', agreements: [on(DAY, 'early', '05:30', '07:30'), on(DAY, 'late', '22:30', '23:30')] } });
    const labels = tree.root.findAll(node => node.type === 'T' as React.ElementType && /^\d{2}:00$/.test(String(node.props.children))).map(node => node.props.children);
    expect(labels[0]).toBe('05:00'); expect(labels[labels.length - 1]).toBe('24:00');
    expect(flat(press('Otvori Dogovor Zadatak early'))).toMatchObject({ top: 0.5 * HOUR_HEIGHT });
  });
  it('lists a Dogovor that would need a fourth column under the hours, as a card', async () => {
    const agreements = ['a', 'b', 'c', 'd'].map((id, at) => on(DAY, id, `09:${String(at * 10).padStart(2, '0')}`, '11:00'));
    await draw({ initialView: 'day', list: { state: 'ready', agreements } });
    expect(opens()).toHaveLength(4);
    expect(byId('day-block')).toHaveLength(3);
    expect(byId('day-overflow')).toHaveLength(1);
    expect(cards()).toEqual(['Otvori Dogovor Zadatak d']);
    expect(headings()).toContain('Još termina');
  });
  it('steps by a day with the arrows and with a swipe, and names the day in the heading', async () => {
    const given = await draw(afternoon());
    expect(headings()).toContain('Danas, sreda 7. okt');
    await act(async () => button('Prethodni dan').props.onPress());
    await act(async () => button('Sledeći dan').props.onPress());
    expect(given.onSelect.mock.calls).toEqual([['2026-10-06'], ['2026-10-08']]);
    await act(async () => tree.unmount());
    const spy = jest.spyOn(PanResponder, 'create');
    const swiped = await draw(afternoon());
    await act(async () => { spy.mock.calls[0][0].onPanResponderRelease?.({} as never, { dx: SWIPE_DISTANCE + 4, dy: -6, vx: 0.1 } as never); });
    expect(swiped.onSelect).toHaveBeenCalledWith('2026-10-06');
  });
  it('begins the page at the hour that matters: an hour above "sada" on today, an hour above the first Dogovor on another day', async () => {
    await draw({ ...afternoon(), now: new Date('2026-10-07T07:30:00Z') });
    const hours = byId('day-hours')[0];
    await act(async () => hours.props.onLayout({ nativeEvent: { layout: { y: 0 } } }));
    // The line stands 2.5 hours down; the page begins one hour above it, 12 dp of air above the first hour included.
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 12 + 2.5 * HOUR_HEIGHT - HOUR_HEIGHT, animated: false });
    await act(async () => tree.unmount());
    scrollTo.mockClear();
    await draw({ ...afternoon(), selected: '2026-10-08', today: DAY });
    await act(async () => byId('day-hours')[0].props.onLayout({ nativeEvent: { layout: { y: 0 } } }));
    // Nothing on the 8th and it is not today: nothing to begin at, so the page stays where the view began (no scroll but that one).
    expect(scrollTo.mock.calls).toEqual([[{ y: 0, animated: false }]]);
    await act(async () => tree.unmount());
    scrollTo.mockClear();
    await draw({ ...afternoon(), selected: '2026-10-08', today: DAY, list: { state: 'ready', agreements: [on('2026-10-08', 'f', '11:00', '12:00')] } });
    await act(async () => byId('day-hours')[0].props.onLayout({ nativeEvent: { layout: { y: 0 } } }));
    // The first Dogovor of the 8th is at 11:00, four hours down; the page begins an hour above it, with the 12 dp of air above the first hour.
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 12 + 4 * HOUR_HEIGHT - HOUR_HEIGHT, animated: false });
  });
  it('reads a day with a clock change by the clocks it writes', async () => {
    await draw({ initialView: 'day', selected: '2026-10-25', today: '2026-10-25', list: { state: 'ready', agreements: [on('2026-10-25', 'x', '09:00', '10:00')] }, now: new Date('2026-10-25T12:00:00Z') });
    expect(press('Otvori Dogovor Zadatak x').props.accessibilityValue.text).toContain('09:00–10:00');
    expect(flat(press('Otvori Dogovor Zadatak x'))).toMatchObject({ top: 2 * HOUR_HEIGHT });
  });
});

describe('the Dogovori without a term', () => {
  const loose = (): Props => ({ list: { state: 'ready', agreements: [
    agreementOf('l1', { naslov: 'Košenje živice', vremeTekst: 'Termin nije dogovoren', prihvacenPocetak: null }),
    agreementOf('l2', { naslov: 'Farbanje ograde', vremeTekst: 'Do 09. okt · 18:00 · početak nije potvrđen', prihvacenPocetak: null }),
    agreementOf('l3', { naslov: 'Montaža nadstrešnice', vremeTekst: 'Termin nije dogovoren', stanje: 'AWAITING_REQUESTER', prihvacenPocetak: null }),
    // A start of 12 Oct: it has a day, so it is not among them (it stands on 12 Oct).
    start('s1', serbian('2026-10-12', '10:00'), { naslov: 'Čišćenje tavana' }),
  ] } });
  const bar = () => presses().find(node => /bez termina$/.test(String(node.props.accessibilityLabel)))!;
  it('are a bar over the calendar that counts them, and only when there are some', async () => {
    await draw();
    expect(bar()).toBeUndefined();
    await act(async () => tree.unmount());
    await draw(loose());
    expect(bar().props.accessibilityLabel).toBe('3 Dogovora bez termina');
    expect(text()).toContain('3 Dogovora bez termina');
    expect(bar().props.accessibilityHint).toBe('Otvara spisak');
    // The bar is above the period and the view, whichever view it is.
    for (const view of ['Nedelja', 'Dan']) {
      await act(async () => tab(view).props.onPress());
      expect(bar()).toBeDefined();
    }
  });
  it('are not a card under the day any more, and never under a heading that denies a date', async () => {
    await draw(loose());
    expect(cards()).toEqual([]);
    expect(headings()).not.toContain('Termin još nije dogovoren'); expect(text()).not.toContain('Termin još nije dogovoren'); expect(text()).not.toContain('Bez tačnog termina');
  });
  it('open a sheet of them, each with its title, its side and the other person, and its own words for the time', async () => {
    await draw(loose());
    await act(async () => bar().props.onPress());
    const sheet = tree.root.findByType('Sheet' as React.ElementType);
    expect(sheet.props.title).toBe('3 Dogovora bez termina');
    expect(text()).toContain('Košenje živice'); expect(text()).toContain('Farbanje ograde'); expect(text()).toContain('Montaža nadstrešnice');
    // The words that would only say what the bar says are not drawn; the stored words for an end are, written without the zero a phone puts in a day.
    expect(text()).not.toContain('Termin nije dogovoren'); expect(text()).toContain('Do 9. okt · 18:00 · početak nije potvrđen');
    expect(text()).toContain('Tvoj zadatak · Marko');
    expect(text()).not.toContain('Čišćenje tavana');
  });
  it('offer "Predloži termin" at the end of each row that may ask for a term, and not at the end of one that waits for a confirmation', async () => {
    const given = await draw(loose());
    await act(async () => bar().props.onPress());
    expect(proposals()).toEqual(['Predloži termin. Košenje živice', 'Predloži termin. Farbanje ograde']);
    expect(text().match(/Predloži termin/g)).toHaveLength(2);
    expect(text()).toContain('Čeka potvrdu');
    await act(async () => press('Predloži termin. Farbanje ograde').props.onPress());
    expect(given.onProposeTerm).toHaveBeenCalledWith('l2'); expect(given.onOpen).not.toHaveBeenCalled();
    // The sheet closes behind the choice.
    expect(tree.root.findAllByType('Sheet' as React.ElementType)).toHaveLength(0);
  });
  it('open the Dogovor from a row that cannot ask for a term', async () => {
    const given = await draw(loose());
    await act(async () => bar().props.onPress());
    await act(async () => press('Otvori Dogovor Montaža nadstrešnice').props.onPress());
    expect(given.onOpen).toHaveBeenCalledWith('l3'); expect(given.onProposeTerm).not.toHaveBeenCalled();
  });
  it('go straight to the form that proposes a term when there is just one and it may ask for one', async () => {
    const given = await draw({ list: { state: 'ready', agreements: [agreementOf('only', { naslov: 'Košenje živice', prihvacenPocetak: null })] } });
    expect(bar().props.accessibilityLabel).toBe('1 Dogovor bez termina');
    expect(bar().props.accessibilityHint).toBe('Otvara predlog termina');
    await act(async () => bar().props.onPress());
    expect(given.onProposeTerm).toHaveBeenCalledWith('only');
    expect(tree.root.findAllByType('Sheet' as React.ElementType)).toHaveLength(0);
  });
  it('open the sheet for a single one that cannot ask (a change of its term waits for an answer), and offer no command when the screen cannot take one', async () => {
    await draw({ list: { state: 'ready', agreements: [agreementOf('l1', { naslov: 'Košenje živice', prihvacenPocetak: null, izmenaCeka: { predlogId: 'p1', mojPredlog: false } })] } });
    await act(async () => bar().props.onPress());
    expect(tree.root.findAllByType('Sheet' as React.ElementType)).toHaveLength(1);
    expect(proposals()).toEqual([]);
    await act(async () => tree.unmount());
    await draw({ ...loose(), onProposeTerm: undefined });
    await act(async () => bar().props.onPress());
    expect(proposals()).toEqual([]); expect(opens()).toHaveLength(3);
  });
  it('are left out while the list does not say which of its Dogovori have an exact term, and a finished or cancelled one is none of them', async () => {
    await draw({ list: { state: 'ready', agreements: [agreementOf('x', { tacanTermin: undefined }), agreementOf('l1', { naslov: 'Košenje živice', prihvacenPocetak: null })] } });
    expect(bar()).toBeUndefined();
    expect(text()).toContain('Nema termina u kojima uskačeš.');
    await act(async () => tree.unmount());
    await draw({ list: { state: 'ready', agreements: [agreementOf('c', { stanje: 'CANCELLED', prihvacenPocetak: null }), agreementOf('f', { stanje: 'COMPLETED', prihvacenPocetak: null })] } });
    expect(bar()).toBeUndefined();
  });
  it('hold a Dogovor with only a start on its own day, whichever week is chosen', async () => {
    await draw({ ...loose(), selected: '2026-10-12' });
    expect(cards()).toEqual(['Otvori Dogovor Čišćenje tavana']);
    expect(press('Otvori Dogovor Čišćenje tavana').findAll(node => node.type === 'T' as React.ElementType)[0].children.join('')).toBe('od 10:00');
  });
});

describe('a read that failed is said, and a day is never called empty for it', () => {
  it('shows a loading list, not an empty day, while the Dogovori are still being read', async () => {
    await draw({ list: { state: 'loading' } });
    expect(text()).toContain('Učitavamo raspored…'); expect(text()).not.toContain('Ništa nije zakazano');
  });
  it('says the schedule failed with its own message and offers to read it again, in the month as in the other views', async () => {
    const given = await draw({ schedule: { state: 'error', message: 'Nalog je promenjen. Ponovo otvori Raspored.' } });
    expect(text()).toContain('Raspored nije učitan.'); expect(text()).toContain('Nalog je promenjen. Ponovo otvori Raspored.'); expect(text()).not.toContain('Ništa nije zakazano');
    // The grid is still a calendar to look at; it has no dots and calls nothing empty.
    expect(cells()).toHaveLength(31); expect(byId('day-dot')).toHaveLength(0);
    await act(async () => button('Pokušaj ponovo').props.onPress());
    expect(given.onRetry).toHaveBeenCalledTimes(1);
    for (const view of ['Nedelja', 'Dan']) {
      await act(async () => tab(view).props.onPress());
      expect(text()).toContain('Raspored nije učitan.'); expect(text()).not.toContain('Slobodno');
    }
  });
  it('calls no day empty that lies beyond the weeks the schedule was read for, in any of the views: it is read again, and until then it is loading', async () => {
    // The schedule was read for the weeks of October; the chosen day is in February.
    const read = plannerWindow(DAY);
    for (const initialView of ['month', 'week', 'day'] as const) {
      await draw({ initialView, selected: '2027-02-10', readWindow: read, list: { state: 'ready', agreements: [] } });
      expect([initialView, text().includes('Učitavamo raspored…'), text().includes('Ništa nije zakazano'), text().includes('Slobodno')]).toEqual([initialView, true, false, false]);
      expect(byId('day-dot')).toHaveLength(0);
      await act(async () => tree.unmount());
    }
  });
  it('shows the bar of the Dogovori without a term only once the schedule is read', async () => {
    const loose = { list: { state: 'ready' as const, agreements: [agreementOf('l1', { prihvacenPocetak: null }), agreementOf('l2', { prihvacenPocetak: null })] } };
    const bars = () => presses().filter(node => /bez termina$/.test(String(node.props.accessibilityLabel)));
    await draw({ ...loose, schedule: { state: 'loading' } });
    expect(bars()).toHaveLength(0);
    await act(async () => tree.unmount());
    await draw({ ...loose, schedule: { state: 'error', message: null } });
    expect(bars()).toHaveLength(0);
    await act(async () => tree.unmount());
    await draw(loose);
    expect(bars()).toHaveLength(1);
  });
  it('says the zone in words under the period, in every view, when the phone is not in Serbian time', async () => {
    for (const initialView of ['month', 'week', 'day'] as const) {
      await draw({ initialView, phoneZone: 'America/New_York' });
      expect(byId('period-header')[0].findAll(node => node.type === 'T' as React.ElementType && node.props.children === 'Po vremenu u Srbiji')).toHaveLength(1);
      await act(async () => tree.unmount());
    }
  });
  it('disables the retry while the schedule is being read again', async () => {
    await draw({ schedule: { state: 'error', message: null }, retrying: true });
    expect(button('Pokušaj ponovo').props.disabled).toBe(true);
    expect(text()).toContain('Proveri vezu pa pokušaj ponovo.');
  });
  it('says only the work I do is shown when the Dogovori did not load, and reads them again on a press', async () => {
    const given = await draw({ list: { state: 'error' } });
    expect(text()).toContain('Nema termina u kojima uskačeš.'); expect(text()).not.toContain('Ništa nije zakazano');
    await act(async () => button('Pokušaj ponovo').props.onPress());
    expect(given.onRetryList).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
    await draw({ ...busy(), list: { state: 'error' } });
    expect(text()).toContain('Učitani su samo termini u kojima uskačeš.'); expect(cards()).toEqual(['Otvori Dogovor sa potvrđenim terminom']);
  });
  it('says the same when the list does not say whether its Dogovori have an exact term, but cannot be read again for it', async () => {
    await draw({ ...busy(), list: { state: 'ready', agreements: [agreementOf('x', { tacanTermin: undefined })] } });
    expect(text()).toContain('Učitani su samo termini u kojima uskačeš.');
    expect(button('Pokušaj ponovo')).toBeUndefined();
  });
  it('names the Dogovor of the schedule only by its confirmed term when the list did not load', async () => {
    await draw({ ...busy(), list: { state: 'error' }, initialView: 'day' });
    expect(opens()).toEqual(['Otvori Dogovor sa potvrđenim terminom']);
    expect(text()).toContain('Učitani su samo termini u kojima uskačeš.');
  });
});

describe('the foot, the pull and the screen reader', () => {
  it('leads to my availability and to the Arhiva, in that order, by their visible words, when I have a work profile', async () => {
    const given = await draw({ availability: WORKING });
    const foot = presses().filter(node => node.props.accessibilityLabel === 'Moja dostupnost' || node.props.accessibilityLabel === 'Arhiva');
    expect(foot.map(node => node.props.accessibilityLabel)).toEqual(['Moja dostupnost', 'Arhiva']);
    await act(async () => foot[0].props.onPress()); await act(async () => foot[1].props.onPress());
    expect(given.onAvailability).toHaveBeenCalledTimes(1); expect(given.onArchive).toHaveBeenCalledTimes(1);
  });
  it('shows "Moja dostupnost" for a draft profile too (it can still be set), and not at all without a work profile', async () => {
    await draw({ availability: { ...WORKING, active: false } });
    expect(press('Moja dostupnost')).toBeDefined();
    await act(async () => tree.unmount());
    await draw();
    expect(presses().filter(node => node.props.accessibilityLabel === 'Moja dostupnost')).toHaveLength(0);
    expect(presses().filter(node => node.props.accessibilityLabel === 'Arhiva')).toHaveLength(1);
  });
  it('is under every view, and does not draw the Arhiva where there is no archive to go to', async () => {
    await draw({ availability: WORKING, onArchive: undefined });
    expect(presses().filter(node => node.props.accessibilityLabel === 'Arhiva')).toHaveLength(0);
    for (const view of ['Nedelja', 'Dan']) {
      await act(async () => tab(view).props.onPress());
      expect(press('Moja dostupnost')).toBeDefined();
    }
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
  it('begins every view at the top of the page', async () => {
    await draw();
    scrollTo.mockClear();
    await act(async () => tab('Nedelja').props.onPress());
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
  });
  it('never says "posao" anywhere on the screen, in any of its states and views', async () => {
    const states: Props[] = [busy(), { list: { state: 'ready', agreements: [agreementOf('l1', { prihvacenPocetak: null }), agreementOf('l2', { prihvacenPocetak: null, stanje: 'AWAITING_REQUESTER' })] } },
      { list: { state: 'error' } }, { schedule: { state: 'loading' } }, { schedule: { state: 'error', message: null } }, { availability: WORKING }, {}];
    for (const patch of states) for (const initialView of ['month', 'week', 'day'] as const) {
      await draw({ ...patch, initialView });
      expect(text()).not.toMatch(NO_POSAO);
      expect(opens().concat(proposals(), cells().map(node => String(node.props.accessibilityLabel)), byId('day-band').map(node => String(node.props.accessibilityLabel))).join(' '))
        .not.toMatch(NO_POSAO);
      await act(async () => tree.unmount());
    }
  });
  it('never names a side of a task by its internal name', async () => {
    await draw(busy());
    expect(text()).not.toMatch(/Naručilac|Uskočer/i);
  });
});


it('puts a late-only appointment in a readable row before the hours and does not scroll past it to now', async () => {
  const given = await draw({ initialView: 'day', list: { state: 'ready', agreements: [start('late', serbian(DAY, '23:50'))] } });
  expect(byId('day-block')).toHaveLength(0); expect(byId('day-overflow')).toHaveLength(1);
  const choices = presses().filter(node => /^Otvori Dogovor/.test(String(node.props.accessibilityLabel)));
  expect(choices).toHaveLength(1);
  await act(async () => choices[0].props.onPress()); expect(given.onOpen).toHaveBeenCalledWith('late');
  await act(async () => byId('day-hours')[0].props.onLayout({ nativeEvent: { layout: { y: 160 } } }));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
  const order = tree.root.findAll(node => String(node.type) === 'View' && ['day-overflow', 'day-hours'].includes(node.props.testID)).map(node => node.props.testID);
  expect(order).toEqual(['day-overflow', 'day-hours']);
});

it('does not reuse a late-only rail offset when the retained view changes to a normal day and back', async () => {
  const next = '2026-10-08';
  const list = { state: 'ready' as const, agreements: [start('late', serbian(DAY, '23:50')), on(next, 'normal', '12:00', '13:00')] };
  const given = await draw({ initialView: 'day', list });
  await act(async () => byId('day-hours')[0].props.onLayout({ nativeEvent: { layout: { y: 160 } } }));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
  await act(async () => tree.update(element(given, { selected: next, initialView: 'day', list })));
  // The old measurement still says 160 until native layout reports the new rail.
  const expected = { y: sys.space.md + 4 * HOUR_HEIGHT, animated: false };
  expect(scrollTo).toHaveBeenLastCalledWith(expected);
  await act(async () => byId('day-hours')[0].props.onLayout({ nativeEvent: { layout: { y: 0 } } }));
  expect(scrollTo).toHaveBeenLastCalledWith(expected);
  await act(async () => tree.update(element(given, { selected: DAY, initialView: 'day', list })));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
  await act(async () => byId('day-hours')[0].props.onLayout({ nativeEvent: { layout: { y: 160 } } }));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
});
