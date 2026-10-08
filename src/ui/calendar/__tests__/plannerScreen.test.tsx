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

import type { AvailabilityRule } from '../../../contracts/workerAvailability';
import { sys } from '../../system/tokens';
import { AgendaScreen } from '../AgendaScreen';
import { plannerWindow } from '../serbianDays';
import { SWIPE_DISTANCE } from '../weekSwipe';
import { NO_POSAO, agreementOf, applicationOf, eventOf, fixedWindow, needOf, serbian, taskFacts, workerAgreementOf } from './fixtures';

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
const rows = () => presses().filter(node => /^Otvori (Dogovor|zadatak|prijavu)/.test(String(node.props.accessibilityLabel))).map(node => node.props.accessibilityLabel);
const tab = (label: string) => presses().find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label)!;
const days = () => presses().filter(node => WEEKDAY.test(String(node.props.accessibilityLabel)));
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const cellsOf = (holder: ReactTestInstance) => holder.findAll(node => node.type === 'Press' as React.ElementType && WEEKDAY.test(String(node.props.accessibilityLabel)));
/** What a day of the strip draws for its mark: the circle, or none. */
const markOf = (cell: ReactTestInstance) => cell.findAllByType(Circle)[0]?.props as Record<string, unknown> | undefined;

type Props = Partial<React.ComponentProps<typeof AgendaScreen>>;
const draw = async (patch: Props = {}) => {
  const handlers = { onSelect: jest.fn(), onBack: jest.fn(), onRefresh: jest.fn(), onRetry: jest.fn(), onRetryList: jest.fn(), onOpen: jest.fn(),
    onOpenTask: jest.fn(), onOpenApplication: jest.fn(), onAvailability: jest.fn(), onArchive: jest.fn() };
  await act(async () => { tree = create(<AgendaScreen selected={DAY} today={DAY} schedule={{ state: 'ready', events: [] }}
    list={{ state: 'ready', agreements: [] }} refreshing={false} phoneZone="Europe/Belgrade" now={NOW} {...handlers} {...patch} />); });
  return handlers;
};
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); mockFontScale = 1; mockWidth = 390; });

/** A day with all three kinds: my work 09-11 (the Dogovor), my application 10-12 on top of it, my task 12-14 with three applications to choose from. */
const busy = (): Props => ({
  schedule: { state: 'ready', events: [eventOf('e1', 'w1', serbian(DAY, '09:00'), serbian(DAY, '11:00'))] },
  list: { state: 'ready', agreements: [workerAgreementOf('w1', { naslov: 'Montaža police', cena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' } })] },
  needs: { state: 'ready', needs: [needOf('n1', { naslov: 'Selidba ormara', stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 3,
    schedule: fixedWindow(serbian(DAY, '12:00'), serbian(DAY, '14:00')) })] },
  applications: { state: 'ready', applications: [applicationOf('p1', { naslov: 'Košenje trave', zadatak: taskFacts(fixedWindow(serbian(DAY, '10:00'), serbian(DAY, '12:00'))) })] },
});

/** Two kinds of thing in the window, none of them on the chosen day: the chips have something to choose between, and the day itself is empty. */
const twoKinds = (): Props => ({
  list: { state: 'ready', agreements: [agreementOf('d9', { tacanTermin: { pocetak: serbian('2026-10-20', '09:00'), kraj: serbian('2026-10-20', '10:00') } })] },
  applications: { state: 'ready', applications: [applicationOf('p9', { zadatak: taskFacts(fixedWindow(serbian('2026-10-21', '09:00'), serbian('2026-10-21', '10:00'))) })] },
});
/** Every chip that is on screen. */
const chipLabels = () => presses().filter(node => node.props.accessibilityRole === 'tab').map(node => node.props.accessibilityLabel);

describe('the day by the hour', () => {
  it('draws my Dogovori, my published tasks and my sent applications in one list, in the order of their start, each with its chip', async () => {
    await draw(busy());
    expect(rows()).toEqual(['Otvori Dogovor Montaža police', 'Otvori prijavu Košenje trave', 'Otvori zadatak Selidba ormara']);
    expect(text()).toContain('Dogovoren'); expect(text()).toContain('Prijava poslata'); expect(text()).toContain('Bira se · 3');
    expect(text()).toContain('Uskačeš · Ana'); expect(text()).toContain('2.000 RSD');
  });
  it('writes the time as the FIRST line of each card, and an application says what it is in its chip, not in a second line', async () => {
    await draw(busy());
    const firstLine = (label: string) => press(label).findAll(node => node.type === 'T' as React.ElementType)[0].children.join('');
    expect(firstLine('Otvori Dogovor Montaža police')).toBe('09:00–11:00');
    expect(firstLine('Otvori prijavu Košenje trave')).toBe('10:00–12:00');
    expect(firstLine('Otvori zadatak Selidba ormara')).toBe('12:00–14:00');
    // "Tvoja prijava" would say twice what "Prijava poslata" says; it stays in the spoken line.
    expect(press('Otvori prijavu Košenje trave').findAll(node => node.type === 'T' as React.ElementType).map(node => node.children.join(''))).not.toContain('Tvoja prijava');
    expect(press('Otvori prijavu Košenje trave').props.accessibilityValue.text).toContain('Tvoja prijava');
  });
  it('says "U toku" once the agreed time has arrived, and not before', async () => {
    await draw(busy());
    expect(text()).not.toContain('U toku');
    await act(async () => tree.unmount());
    await draw({ ...busy(), now: new Date('2026-10-07T07:30:00Z') });
    expect(text()).toContain('U toku'); expect(text()).not.toContain('Dogovoren');
  });
  it('draws no dashed edge at all: an application is a card like the others, and its chip is the ring "Prijava poslata"', async () => {
    await draw(busy());
    expect(tree.root.findAll(node => flat(node).borderStyle === 'dashed')).toHaveLength(0);
    const chip = press('Otvori prijavu Košenje trave').findAll(node => node.props.testID === 'status-chip')[0];
    expect(chip.props.accessibilityLabel).toBe('Prijava poslata');
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
  it('names the other term in an orange line when two of my terms overlap, and leaves a task out of it', async () => {
    await draw(busy());
    expect(text()).toContain('Preklapa se sa Košenje trave'); expect(text()).toContain('Preklapa se sa Montaža police');
    expect(text().match(/Preklapa se/g)).toHaveLength(2);
    expect(press('Otvori prijavu Košenje trave').props.accessibilityValue.text).toContain('Preklapa se sa Montaža police');
  });
  it('speaks each row with its chip, its role, its time and its place', async () => {
    await draw(busy());
    const spoken = press('Otvori zadatak Selidba ormara').props.accessibilityValue.text as string;
    expect(spoken).toContain('Bira se, 3'); expect(spoken).toContain('Tvoj zadatak'); expect(spoken).toContain('Detelinara, Novi Sad');
  });
  it('writes a lone stored bound as one bound ("od 14:00"), never inventing the other end', async () => {
    await draw({ needs: { state: 'ready', needs: [needOf('n2', { naslov: 'Popravka slavine', schedule: fixedWindow(serbian(DAY, '14:00'), null) })] } });
    expect(text()).toContain('od 14:00');
    expect(rows()).toEqual(['Otvori zadatak Popravka slavine']);
  });
  it('opens the Dogovor, the candidates of a task that has applications to choose from, and the application', async () => {
    const handlers = await draw(busy());
    await act(async () => press('Otvori Dogovor Montaža police').props.onPress());
    await act(async () => press('Otvori zadatak Selidba ormara').props.onPress());
    await act(async () => press('Otvori prijavu Košenje trave').props.onPress());
    expect(handlers.onOpen).toHaveBeenCalledWith('w1');
    expect(handlers.onOpenTask).toHaveBeenCalledWith('n1', 3);
    expect(handlers.onOpenApplication).toHaveBeenCalledWith('p1');
  });
  it('is one quiet line for an empty day, by the chip that is on, never a box', async () => {
    await draw(twoKinds());
    expect(text()).toContain('Ništa nije zakazano za ovaj dan.');
    for (const [label, line] of [['Dogovori', 'Nema Dogovora za ovaj dan.'], ['Moji zadaci', 'Nema tvojih zadataka za ovaj dan.'], ['Moje prijave', 'Nema prijava za ovaj dan.']]) {
      await act(async () => tab(label).props.onPress());
      expect(text()).toContain(line);
    }
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

describe('the chips "Sve · Dogovori · Moji zadaci · Moje prijave"', () => {
  it('are those four, in that order, as the tabs of one list', async () => {
    await draw(busy());
    expect(chipLabels()).toEqual(['Sve', 'Dogovori', 'Moji zadaci', 'Moje prijave']);
    expect(tab('Sve').props.accessibilityState).toEqual({ selected: true });
  });
  it('are the one row of controls over the day, and are not there at all when everything is of one kind (nothing to choose between)', async () => {
    await draw();
    expect(chipLabels()).toEqual([]);                                                 // nothing at all
    await act(async () => tree.unmount());
    await draw({ list: twoKinds().list });
    expect(chipLabels()).toEqual([]);                                                 // only Dogovori
    await act(async () => tree.unmount());
    await draw({ applications: { state: 'ready', applications: [applicationOf('p1', { zadatak: taskFacts(fixedWindow(serbian(DAY, '10:00'), serbian(DAY, '12:00'))) }), applicationOf('p2')] } });
    expect(chipLabels()).toEqual([]);                                                 // placed and loose, but all applications
    await act(async () => tree.unmount());
    await draw(twoKinds());
    expect(chipLabels()).toEqual(['Sve', 'Dogovori', 'Moji zadaci', 'Moje prijave']);  // two kinds, even though none of them is on this day
  });
  it('are a row of chips that scrolls on its own, not equal tabs that would cut a word: four options are chips', async () => {
    await draw(busy());
    const holder = tree.root.findAll(node => node.type === 'ScrollView' as React.ElementType && node.props.horizontal)[0];
    expect(holder).toBeDefined();
    expect(holder.findAll(node => node.props.accessibilityRole === 'tab')).toHaveLength(4);
  });
  it('show one kind of the day at a time, and "Sve" all of it again', async () => {
    await draw(busy());
    const only = async (label: string, expected: string[]) => {
      await act(async () => tab(label).props.onPress());
      expect([label, rows()]).toEqual([label, expected]);
      expect(tab(label).props.accessibilityState).toEqual({ selected: true });
    };
    await only('Dogovori', ['Otvori Dogovor Montaža police']);
    await only('Moji zadaci', ['Otvori zadatak Selidba ormara']);
    await only('Moje prijave', ['Otvori prijavu Košenje trave']);
    await only('Sve', ['Otvori Dogovor Montaža police', 'Otvori prijavu Košenje trave', 'Otvori zadatak Selidba ormara']);
  });
  it('still name the other term of an overlap when the chip hides it', async () => {
    await draw(busy());
    await act(async () => tab('Dogovori').props.onPress());
    expect(text()).toContain('Preklapa se sa Košenje trave');
  });
  it('mark the days of the week by the chip that is on', async () => {
    const week = { list: { state: 'ready' as const, agreements: [agreementOf('d1', { tacanTermin: { pocetak: serbian('2026-10-05', '09:00'), kraj: serbian('2026-10-05', '10:00') } })] },
      needs: { state: 'ready' as const, needs: [needOf('n1', { schedule: fixedWindow(serbian('2026-10-06', '09:00'), serbian('2026-10-06', '10:00')) })] } };
    await draw(week);
    expect(days().map(cell => markOf(cell)?.fill)).toEqual([sys.color.green, 'none', undefined, undefined, undefined, undefined, undefined]);
    await act(async () => tab('Moji zadaci').props.onPress());
    expect(days().map(cell => markOf(cell) !== undefined)).toEqual([false, true, false, false, false, false, false]);
  });
});

describe('the week', () => {
  const week = (): Props => ({
    list: { state: 'ready', agreements: [
      agreementOf('active', { tacanTermin: { pocetak: serbian('2026-10-05', '09:00'), kraj: serbian('2026-10-05', '10:00') } }),
      agreementOf('done', { stanje: 'COMPLETED', tacanTermin: { pocetak: serbian('2026-10-06', '09:00'), kraj: serbian('2026-10-06', '10:00') } }),
    ] },
    needs: { state: 'ready', needs: [needOf('choose', { stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 2, schedule: fixedWindow(serbian(DAY, '09:00'), serbian(DAY, '10:00')) })] },
    applications: { state: 'ready', applications: [applicationOf('mine', { zadatak: taskFacts(fixedWindow(serbian('2026-10-08', '09:00'), serbian('2026-10-08', '10:00'))) })] },
  });
  it('shows seven equal columns that always fit, the weekday shrinking to its letter at a very large text', async () => {
    await draw();
    expect(days()).toHaveLength(7);
    for (const cell of days()) expect(flat(cell)).toMatchObject({ flex: 1, minWidth: 0 });
    expect(days().map(cell => cell.findAllByType('T' as React.ElementType)[0].props.children)).toEqual(['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned']);
    expect(days()[0].props.accessibilityLabel).toMatch(/^Ponedeljak, 5\. okt/);
    // The only sideways scroll is the chips'; no day is inside it.
    for (const scroll of tree.root.findAll(node => node.type === 'ScrollView' as React.ElementType && node.props.horizontal)) {
      expect(scroll.findAll(node => WEEKDAY.test(String(node.props.accessibilityLabel)))).toHaveLength(0);
    }
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
  it('marks each day by the one thing that matters most on it: a green dot, an orange ring, a dashed outline, a grey dot', async () => {
    // Friday is chosen, so the other days wear their own colours.
    await draw({ ...week(), selected: '2026-10-09' });
    const [monday, tuesday, wednesday, thursday, friday] = days().map(markOf);
    expect(monday).toMatchObject({ fill: sys.color.green });
    expect(tuesday).toMatchObject({ fill: sys.color.muted });
    expect(wednesday).toMatchObject({ fill: 'none', stroke: sys.color.orangeInk }); expect(wednesday?.strokeDasharray).toBeUndefined();
    expect(thursday).toMatchObject({ fill: 'none', stroke: sys.color.muted }); expect(thursday?.strokeDasharray).toBeDefined();
    expect(friday).toBeUndefined();
    // The chosen day is filled green, so its mark is white; its shape still says what it says.
    await act(async () => tree.unmount());
    await draw({ ...week(), selected: '2026-10-08' });
    expect(markOf(days()[2])).toMatchObject({ fill: 'none', stroke: sys.color.orangeInk });
    expect(markOf(days()[3])).toMatchObject({ fill: 'none', stroke: sys.color.onDark }); expect(markOf(days()[3])?.strokeDasharray).toBeDefined();
  });
  it('says in words what each mark draws, and a day without one says nothing more', async () => {
    await draw({ ...week(), selected: '2026-10-09' });
    const labels = days().map(cell => cell.props.accessibilityLabel);
    expect(labels[0]).toBe('Ponedeljak, 5. okt, ima Dogovor');
    expect(labels[1]).toBe('Utorak, 6. okt, ima završen Dogovor');
    expect(labels[2]).toBe('Sreda, 7. okt, danas, nešto čeka tebe');
    expect(labels[3]).toBe('Četvrtak, 8. okt, ima zadatak ili prijavu na čekanju');
    expect(labels[4]).toBe('Petak, 9. okt');
  });
  it('marks no day while the schedule is still being read, and calls none empty', async () => {
    await draw({ schedule: { state: 'loading' } });
    expect(days().map(markOf)).toEqual(Array(7).fill(undefined));
    expect(text()).toContain('Učitavamo raspored…'); expect(text()).not.toContain('Ništa nije zakazano');
  });
  it('shades the days a worker has said they can work, from today on, and says the hours in the day\'s name', async () => {
    const rule: AvailabilityRule = { id: 'r1', weekdays: [1, 2, 3, 4, 5], startTime: '09:00:00', endTime: '17:00:00', startsOn: '2026-01-01', endsOn: null, label: '', active: true };
    await draw({ availability: { state: 'ready', value: { timezone: 'Europe/Belgrade', rules: [rule], windows: [] } } });
    const shades = days().map(cell => flat(cell.findByProps({ testID: 'day-shade' })));
    expect(shades.map(shade => shade.height)).toEqual(Array(7).fill(4));
    // Monday and Tuesday are past, Saturday and Sunday are not working days: no shade. Wednesday is chosen (white on green).
    expect(shades.map(shade => shade.backgroundColor)).toEqual([undefined, undefined, sys.color.onDark, sys.color.art.brand.light, sys.color.art.brand.light, undefined, undefined]);
    expect(days()[3].props.accessibilityLabel).toBe('Četvrtak, 8. okt, dostupan 09:00–17:00');
    expect(days()[0].props.accessibilityLabel).toBe('Ponedeljak, 5. okt');
  });
  it('keeps the place of the shade whether there is one or not', async () => {
    await draw();
    for (const cell of days()) expect(flat(cell.findByProps({ testID: 'day-shade' }))).toMatchObject({ width: 20, height: 4 });
  });
  it('chooses a day by a press and speaks which one is chosen', async () => {
    const handlers = await draw();
    await act(async () => days()[4].props.onPress());
    expect(handlers.onSelect).toHaveBeenCalledWith('2026-10-09');
    expect(days().map(cell => cell.props.accessibilityState.selected)).toEqual([false, false, true, false, false, false, false]);
    expect(days()[2].props.accessibilityLabel).toContain('danas');
  });
  it('steps by a week with the arrows, and names today\'s week only when today is in another one', async () => {
    const handlers = await draw();
    await act(async () => button('Prethodna nedelja').props.onPress());
    await act(async () => button('Sledeća nedelja').props.onPress());
    expect(handlers.onSelect.mock.calls).toEqual([['2026-09-30'], ['2026-10-14']]);
    expect(button('Danas')).toBeUndefined();
    await act(async () => tree.unmount());
    await draw({ selected: '2026-10-21' });
    expect(button('Danas')).toBeDefined();
  });
});

describe('swipe changes the week', () => {
  const capture = async () => {
    const spy = jest.spyOn(PanResponder, 'create');
    const handlers = await draw();
    return { config: spy.mock.calls[0][0], handlers };
  };
  it('goes to the next week on a clear move to the left and to the previous on one to the right', async () => {
    const { config, handlers } = await capture();
    await act(async () => { config.onPanResponderRelease?.({} as never, { dx: -(SWIPE_DISTANCE + 4), dy: 6, vx: -0.1 } as never); });
    await act(async () => { config.onPanResponderRelease?.({} as never, { dx: SWIPE_DISTANCE + 4, dy: -6, vx: 0.1 } as never); });
    expect(handlers.onSelect.mock.calls).toEqual([['2026-10-14'], ['2026-09-30']]);
  });
  it('counts a short, quick flick, and not a slow short drag, a mostly vertical move, or a tap', async () => {
    const { config, handlers } = await capture();
    const release = (dx: number, dy: number, vx: number) => config.onPanResponderRelease?.({} as never, { dx, dy, vx } as never);
    await act(async () => { release(-40, 4, -0.8); });
    expect(handlers.onSelect.mock.calls).toEqual([['2026-10-14']]);
    await act(async () => { release(-40, 4, -0.1); release(-90, 60, -0.9); release(2, 0, 0); });
    expect(handlers.onSelect).toHaveBeenCalledTimes(1);
  });
  it('takes the touch only when the move is clearly sideways, so scrolling the day is never taken over', async () => {
    const { config } = await capture();
    const start = (dx: number, dy: number) => config.onMoveShouldSetPanResponder?.({} as never, { dx, dy } as never);
    expect(start(-30, 4)).toBe(true); expect(start(30, -4)).toBe(true);
    expect(start(-10, 0)).toBe(false); expect(start(-30, 20)).toBe(false); expect(start(2, 60)).toBe(false);
    expect(config.onPanResponderTerminationRequest?.({} as never, {} as never)).toBe(false);
  });
  it('is spread over the week and over the day, and not over the chips, which scroll on their own', async () => {
    await draw();
    const swipers = tree.root.findAll(node => node.type === 'View' as React.ElementType && typeof node.props.onResponderRelease === 'function');
    expect(swipers).toHaveLength(2);
    expect(swipers[0].findAll(node => node.props.accessibilityRole === 'tab')).toHaveLength(0);
    expect(swipers[1].findAll(node => node.props.accessibilityRole === 'tab')).toHaveLength(0);
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
    await draw({ list: { state: 'ready', agreements: [agreementOf('d', { tacanTermin: { pocetak: serbian('2026-10-20', '09:00'), kraj: serbian('2026-10-20', '10:00') } })] } });
    await act(async () => press('5–11. okt').props.onPress());
    const marked = grid().findAll(node => node.type === 'Press' as React.ElementType && / ima Dogovor$/.test(String(node.props.accessibilityLabel)));
    expect(marked).toHaveLength(1); expect(marked[0].props.accessibilityLabel).toMatch(/^Utorak, 20\. okt/);
    expect(markOf(marked[0])).toMatchObject({ fill: sys.color.green });
    await act(async () => button('Prethodni mesec').props.onPress());
    expect(text()).toContain('Septembar 2026');
    expect(grid().findAllByType(Circle)).toHaveLength(0);
  });
  it('marks the month on each side as well when the schedule was read for them, and no month beyond what was read', async () => {
    const dogovor = (day: string) => agreementOf(`d-${day}`, { tacanTermin: { pocetak: serbian(day, '09:00'), kraj: serbian(day, '10:00') } });
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
    const handlers = await draw();
    await act(async () => press('5–11. okt').props.onPress());
    await act(async () => dayCell(/^Utorak, 20\. okt/).props.onPress());
    expect(handlers.onSelect).toHaveBeenCalledWith('2026-10-20');
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

describe('"Bez tačnog termina"', () => {
  const flexible = (id: string, title: string) => needOf(id, { naslov: title, schedule: { kind: 'FLEXIBLE', startsAt: null, endsAt: null }, vremeTekst: 'Fleksibilan termin' });
  const loose = (): Props => ({
    list: { state: 'ready', agreements: [agreementOf('l1', { naslov: 'Košenje živice', vremeTekst: 'Termin nije potvrđen' }),
      agreementOf('l2', { naslov: 'Farbanje ograde', vremeTekst: '12. okt · 10:00 · kraj nije potvrđen' })] },
    needs: { state: 'ready', needs: [flexible('f1', 'Čišćenje tavana'), flexible('f2', 'Pomoć oko računara'), flexible('f3', 'Odvoz šuta')] },
  });
  it('lists what has no exact term under its own words for the time, with the counts in the right plural', async () => {
    await draw(loose());
    expect(text()).toContain('Bez tačnog termina'); expect(text()).toContain('2 Dogovora · 3 zadatka');
    expect(text()).toContain('Termin nije potvrđen'); expect(text()).toContain('12. okt · 10:00 · kraj nije potvrđen'); expect(text()).toContain('Fleksibilan termin');
    expect(rows()).toEqual(['Otvori Dogovor Košenje živice', 'Otvori Dogovor Farbanje ograde', 'Otvori zadatak Čišćenje tavana']);
  });
  it('shows the first three, and the rest on a press that can be taken back', async () => {
    await draw(loose());
    expect(button('Prikaži još 2')).toBeDefined();
    await act(async () => button('Prikaži još 2').props.onPress());
    expect(rows()).toHaveLength(5); expect(button('Prikaži manje')).toBeDefined();
    await act(async () => button('Prikaži manje').props.onPress());
    expect(rows()).toHaveLength(3);
  });
  it('counts one Dogovor and one task in the singular, and shows no "Prikaži još" for three or fewer', async () => {
    await draw({ list: { state: 'ready', agreements: [agreementOf('l1', { naslov: 'Košenje živice' })] }, needs: { state: 'ready', needs: [flexible('f1', 'Čišćenje tavana')] } });
    expect(text()).toContain('1 Dogovor · 1 zadatak'); expect(button('Prikaži još 1')).toBeUndefined();
  });
  it('follows the chip, and is not there at all when there is nothing to list', async () => {
    await draw(loose());
    await act(async () => tab('Dogovori').props.onPress());
    expect(text()).toContain('2 Dogovora'); expect(text()).not.toContain('zadatka');
    await act(async () => tab('Moje prijave').props.onPress());
    expect(text()).not.toContain('Bez tačnog termina');
    await act(async () => tree.unmount());
    await draw();
    expect(text()).not.toContain('Bez tačnog termina');
  });
  it('keeps a flexible range to the week it reaches into, and a task without a range to every week', async () => {
    const thisWeek = needOf('w1', { naslov: 'Ove nedelje', schedule: { kind: 'WEEK_FLEXIBLE', startsAt: serbian('2026-10-05', '00:00'), endsAt: serbian('2026-10-12', '00:00') } });
    const nextWeek = needOf('w2', { naslov: 'Sledeće nedelje', schedule: { kind: 'WEEK_FLEXIBLE', startsAt: serbian('2026-10-12', '00:00'), endsAt: serbian('2026-10-19', '00:00') } });
    await draw({ needs: { state: 'ready', needs: [thisWeek, nextWeek, flexible('f1', 'Bilo kada')] } });
    expect(rows()).toEqual(['Otvori zadatak Ove nedelje', 'Otvori zadatak Bilo kada']);
    await act(async () => tree.unmount());
    await draw({ selected: '2026-10-14', needs: { state: 'ready', needs: [thisWeek, nextWeek, flexible('f1', 'Bilo kada')] } });
    expect(rows()).toEqual(['Otvori zadatak Sledeće nedelje', 'Otvori zadatak Bilo kada']);
  });
  it('leaves the Dogovori out while the list does not say which of them have an exact term', async () => {
    await draw({ list: { state: 'ready', agreements: [agreementOf('x', { tacanTermin: undefined }), agreementOf('l1', { naslov: 'Košenje živice' })] } });
    expect(text()).not.toContain('Bez tačnog termina');
    expect(text()).toContain('Nema termina u kojima uskačeš.');
  });
});

describe('"Čekaju odgovor"', () => {
  // A Dogovor on another day is there so that the chips have two kinds to choose between.
  const waiting = (): Props => ({ list: twoKinds().list,
    applications: { state: 'ready', applications: [applicationOf('a1', { naslov: 'Košenje trave' }), applicationOf('a2', { naslov: 'Pomoć pri selidbi', stanje: 'VIEWED' })] } });
  it('lists my open applications that cannot be put on a day, with their own words for the time and their chip', async () => {
    await draw(waiting());
    expect(text()).toContain('Čekaju odgovor'); expect(text()).toContain('2 prijave'); expect(text()).toContain('Fleksibilno');
    expect(text()).toContain('Prijava poslata'); expect(text()).toContain('Prijava viđena');
    expect(rows()).toEqual(['Otvori prijavu Košenje trave', 'Otvori prijavu Pomoć pri selidbi']);
    expect(text()).not.toContain('Bez tačnog termina');
  });
  it('is under "Sve" and "Moje prijave" and nowhere else', async () => {
    await draw(waiting());
    for (const [label, shown] of [['Dogovori', false], ['Moji zadaci', false], ['Moje prijave', true], ['Sve', true]] as const) {
      await act(async () => tab(label).props.onPress());
      expect([label, text().includes('Čekaju odgovor')]).toEqual([label, shown]);
    }
  });
  it('says "Zadatak je izmenjen" in orange for an application whose task changed, and "U užem izboru" for a short list', async () => {
    await draw({ applications: { state: 'ready', applications: [applicationOf('a1', { naslov: 'Prva', stanje: 'STALE_REVIEW_REQUIRED' }), applicationOf('a2', { naslov: 'Druga', stanje: 'SHORTLISTED' })] } });
    expect(text()).toContain('Zadatak je izmenjen'); expect(text()).toContain('U užem izboru');
  });
  it('uses the singular for one', async () => {
    await draw({ applications: { state: 'ready', applications: [applicationOf('a1')] } });
    expect(text()).toContain('1 prijava');
  });
});

describe('a read that failed is said, and a day is never called empty for it', () => {
  it('shows a loading list, not an empty day, while a read the day depends on is still going', async () => {
    for (const patch of [{ list: { state: 'loading' } }, { needs: { state: 'loading' } }, { applications: { state: 'loading' } }] as Props[]) {
      await draw(patch);
      expect(text()).toContain('Učitavamo raspored…'); expect(text()).not.toContain('Ništa nije zakazano');
      await act(async () => tree.unmount());
    }
  });
  it('does not wait for a read the chip does not show', async () => {
    await draw({ list: twoKinds().list, applications: { state: 'loading' },
      needs: { state: 'ready', needs: [needOf('n9', { schedule: fixedWindow(serbian('2026-10-22', '09:00'), serbian('2026-10-22', '10:00')) })] } });
    await act(async () => tab('Dogovori').props.onPress());
    expect(text()).toContain('Nema Dogovora za ovaj dan.');
  });
  it('says the schedule failed with its own message and offers to read it again', async () => {
    const handlers = await draw({ schedule: { state: 'error', message: 'Nalog je promenjen. Ponovo otvori Raspored.' } });
    expect(text()).toContain('Raspored nije učitan.'); expect(text()).toContain('Nalog je promenjen. Ponovo otvori Raspored.'); expect(text()).not.toContain('Ništa nije zakazano');
    await act(async () => button('Pokušaj ponovo').props.onPress());
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });
  it('says only the work I do is shown when the Dogovori did not load, and reads them again on a press', async () => {
    const handlers = await draw({ list: { state: 'error' } });
    expect(text()).toContain('Nema termina u kojima uskačeš.'); expect(text()).not.toContain('Ništa nije zakazano');
    await act(async () => button('Pokušaj ponovo').props.onPress());
    expect(handlers.onRetryList).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
    await draw({ ...busy(), list: { state: 'error' } });
    expect(text()).toContain('Učitani su samo termini u kojima uskačeš.'); expect(rows()).toContain('Otvori prijavu Košenje trave');
  });
  it('says my tasks, or my applications, did not load, once for each, with one way to read them again', async () => {
    const handlers = await draw({ needs: { state: 'error' }, applications: { state: 'error' } });
    expect(text()).toContain('Moji zadaci nisu učitani.'); expect(text()).toContain('Moje prijave nisu učitane.'); expect(text()).not.toContain('Ništa nije zakazano');
    expect(tree.root.findAll(node => node.props.label === 'Pokušaj ponovo')).toHaveLength(1);
    await act(async () => button('Pokušaj ponovo').props.onPress());
    expect(handlers.onRetryList).toHaveBeenCalledTimes(1);
  });
  it('says nothing about a failed read the chip does not show', async () => {
    await draw({ ...twoKinds(), needs: { state: 'error' } });
    await act(async () => tab('Dogovori').props.onPress());
    expect(text()).not.toContain('Moji zadaci nisu učitani.'); expect(text()).toContain('Nema Dogovora za ovaj dan.');
    await act(async () => tab('Moji zadaci').props.onPress());
    expect(text()).toContain('Moji zadaci nisu učitani.'); expect(text()).not.toContain('Nema tvojih zadataka');
  });
  it('keeps what it has under the line that says what is missing', async () => {
    await draw({ ...busy(), needs: { state: 'error' } });
    expect(text()).toContain('Moji zadaci nisu učitani.');
    expect(rows()).toEqual(['Otvori Dogovor Montaža police', 'Otvori prijavu Košenje trave']);
  });
});

describe('the foot, the pull and the screen reader', () => {
  it('leads to my availability and to the Arhiva, in that order, by their visible words', async () => {
    const handlers = await draw();
    const foot = presses().filter(node => node.props.accessibilityLabel === 'Moja dostupnost za rad' || node.props.accessibilityLabel === 'Arhiva');
    expect(foot.map(node => node.props.accessibilityLabel)).toEqual(['Moja dostupnost za rad', 'Arhiva']);
    await act(async () => foot[0].props.onPress()); await act(async () => foot[1].props.onPress());
    expect(handlers.onAvailability).toHaveBeenCalledTimes(1); expect(handlers.onArchive).toHaveBeenCalledTimes(1);
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
    const handlers = await draw();
    const scroll = tree.root.findAllByType('ScrollView' as React.ElementType)[0];
    expect(scroll.props.accessibilityActions).toBeUndefined();
    const heading = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.accessibilityActions)[0];
    expect(heading.props.accessibilityRole).toBe('header');
    await act(async () => heading.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    expect(handlers.onRefresh).not.toHaveBeenCalled();
    await act(async () => heading.props.onAccessibilityAction({ nativeEvent: { actionName: 'refresh' } }));
    expect(handlers.onRefresh).toHaveBeenCalledTimes(1);
    expect(scroll.props.refreshControl.props.onRefresh).toBe(handlers.onRefresh);
  });
  it('is called "Raspored" in its bar, names the day in the heading and the sections as headings', async () => {
    await draw({ ...busy(), applications: { state: 'ready', applications: [applicationOf('a1')] } });
    expect(text()).toContain('Raspored'); expect(text()).not.toContain('Kalendar obaveza');
    expect(text()).toContain('Sreda, 7. okt');
    const headings = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.accessibilityRole === 'header').map(node => node.props.children);
    expect(headings).toEqual(expect.arrayContaining(['Sreda, 7. okt', 'Čekaju odgovor']));
  });
  it('never says "posao" anywhere on the screen, in any of its states', async () => {
    const states: Props[] = [busy(), { ...busy(), applications: { state: 'ready', applications: [applicationOf('a1'), applicationOf('a2', { stanje: 'SHORTLISTED' })] } },
      { list: { state: 'error' }, needs: { state: 'error' }, applications: { state: 'error' } }, { schedule: { state: 'loading' } },
      { schedule: { state: 'error', message: null } }, {}];
    for (const patch of states) {
      await draw(patch);
      // The chips are there only when the window holds two kinds: every one that is on screen is tried, and a state without chips is read as it is.
      const labels = chipLabels().map(String);
      for (const label of labels.length ? labels : [null]) {
        if (label) await act(async () => tab(label).props.onPress());
        expect(text()).not.toMatch(NO_POSAO);
        expect(rows().concat(days().map(cell => String(cell.props.accessibilityLabel))).join(' ')).not.toMatch(NO_POSAO);
      }
      await act(async () => tree.unmount());
    }
  });
  it('goes back by the arrow of its bar', async () => {
    const handlers = await draw();
    await act(async () => button('Nazad').props.onPress());
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
  });
});
