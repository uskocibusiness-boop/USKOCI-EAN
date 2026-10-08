import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockPackage: string | undefined = 'rs.uskoci.app.dev';
let mockParams: { scene?: string | string[]; [key: string]: unknown } = {};
const mockRouter = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-constants', () => ({ get expoConfig() { return { android: { package: mockPackage } }; } }));
// `router` is read when it is used: the factory runs before the const below is set, so it is not captured here.
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock('../../../data/supabaseClient', () => { throw new Error('The system gallery must not load a data client.'); });
jest.mock('../../../store/uloga', () => { throw new Error('The system gallery must not read account data.'); });

import Gallery from '../../../app/dizajn-sistem';
import { Press } from '../../Press';
import { FlowFooter } from '../FlowFooter';
import { KeyValueRow } from '../KeyValueRow';
import { ListRow } from '../ListRow';
import { Section } from '../Section';
import { Segmented } from '../Segmented';
import { Surface } from '../Surface';
import { V2Action } from '../../v2/V2Action';
import { OfflineLine } from '../OfflineLine';
import { OutcomeUncertain } from '../OutcomeUncertain';
import { SkeletonList } from '../Skeleton';
import { STATE_SCENES } from '../StateGallery';
import { StateView } from '../StateView';

/**
 * The gallery of the system's primitives (`uskociapp://dizajn-sistem`, UI/UX pass 2026-10-08, F8a): every scene the lead
 * photographs must draw, from fixtures, with no data and no live action, and only in an internal build.
 */
let tree: ReactTestRenderer;
const originalDev = __DEV__;
const testRuntime = globalThis as unknown as { __DEV__: boolean };
const render = async () => { await act(async () => { tree = create(<Gallery />); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const texts = () => tree.root.findAllByType(Text).map(node => node.props.children).filter(child => typeof child === 'string') as string[];
const scenes = ['normalno', 'redovi', 'zapisi', 'uslovi', 'izbor', 'podnozje', 'dugi', 'veliki', 'stanja'] as const;

beforeEach(() => { jest.clearAllMocks(); testRuntime.__DEV__ = true; mockPackage = 'rs.uskoci.app.dev'; mockParams = {}; });
afterEach(async () => { await act(async () => tree?.unmount()); testRuntime.__DEV__ = originalDev; });

it.each(['rs.uskoci.app', 'rs.uskoci.app.dev.store', undefined])('refuses fixture content in a store build (%s), regardless of the scene query', async packageName => {
  testRuntime.__DEV__ = false; mockPackage = packageName; mockParams = { scene: 'redovi', internal: 'true', dev: 'true' };
  await render();
  expect(texts()).toEqual(['Nije dostupno.']);
  expect(tree.root.findAllByType(ListRow)).toHaveLength(0);
});

describe('the index', () => {
  it('lists the nine scenes as rows with an arrow, in the order of the plan, and draws nothing else of the system until one is chosen', async () => {
    await render();
    const rows = tree.root.findAllByType(ListRow);
    expect(rows).toHaveLength(scenes.length);
    expect(rows.map(row => row.props.title)).toEqual(['Normalno', 'Redovi i odeljci', 'Zapisi i okviri', 'Činjenice i uslovi', 'Izbor skupa', 'Podnožje sa razlogom', 'Dugi nazivi', 'Veliki tekst (1,3)', 'Stanja']);
    for (const row of rows) expect([row.props.title, typeof row.props.onPress]).toEqual([row.props.title, 'function']);
    expect(rows[rows.length - 1].props.last).toBe(true);
  });

  it('opens a scene when its row is pressed and returns to the index with the arrow back', async () => {
    await render();
    await act(async () => tree.root.findAllByType(ListRow)[1].props.onPress());
    expect(tree.root.findAllByType(Section).length).toBeGreaterThan(3);
    await act(async () => tree.root.findAll(node => node.props.accessibilityLabel === 'Nazad' && node.type === Press)[0].props.onPress());
    expect(tree.root.findAllByType(ListRow)).toHaveLength(scenes.length);
  });

  it('leaves the gallery by the router when there is something to go back to, and to the start when there is not', async () => {
    await render();
    const back = () => tree.root.findAll(node => node.props.accessibilityLabel === 'Nazad' && node.type === Press)[0];
    await act(async () => back().props.onPress());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    mockRouter.canGoBack.mockReturnValueOnce(false);
    await act(async () => back().props.onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});

describe.each(scenes)('scene %s, opened by its address', scene => {
  beforeEach(() => { mockParams = { scene }; });

  it('draws from fixtures only, with no data client and no account, and every press is inert', async () => {
    await render();
    expect(tree.root.findAllByType(Section).length).toBeGreaterThan(0);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});

describe('what each scene shows', () => {
  it('redovi: touched rows have an arrow, info rows have none, the last of a group has no divider, a face row has the 56 slot', async () => {
    mockParams = { scene: 'redovi' }; await render();
    const rows = tree.root.findAllByType(ListRow);
    expect(rows.length).toBeGreaterThanOrEqual(14);
    expect(rows.some(row => row.props.onPress === undefined)).toBe(true);
    expect(rows.some(row => row.props.onPress !== undefined && row.props.last)).toBe(true);
    expect(rows.some(row => row.props.faceSlot)).toBe(true);
    expect(rows.some(row => row.props.tone === 'quiet')).toBe(true);
    expect(rows.some(row => row.props.tone === 'danger')).toBe(true);
    // A row that says what is chosen and opens its choices, closed and open (F8b, at F2's request).
    expect(rows.filter(row => row.props.value !== undefined && row.props.expanded !== undefined).map(row => [row.props.title, row.props.value, row.props.expanded]))
      .toEqual([['Gde', 'Novi Sad', false], ['Kada', 'Ovog meseca', true], ['Vrsta pomoći', 'Sve vrste', false]]);
    expect(tree.root.findAllByType(Section).some(section => section.props.action?.label === 'Pomoć')).toBe(true);
  });

  it('zapisi: a record that is touched, a panel, a float and the three tints of a note', async () => {
    mockParams = { scene: 'zapisi' }; await render();
    const kinds = tree.root.findAllByType(Surface).map(surface => [surface.props.kind, surface.props.tone ?? null]);
    expect(kinds).toEqual(expect.arrayContaining([['record', null], ['panel', null], ['float', null], ['note', null], ['note', 'warn'], ['note', 'danger']]));
    expect(tree.root.findAllByType(Surface).filter(surface => surface.props.kind === 'record').every(surface => typeof surface.props.onPress === 'function')).toBe(true);
  });

  it('uslovi: facts on a detail screen, and the terms with a price, an action and a node as a value', async () => {
    mockParams = { scene: 'uslovi' }; await render();
    const rows = tree.root.findAllByType(KeyValueRow);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.some(row => row.props.emphasis === 'price')).toBe(true);
    expect(rows.some(row => row.props.action?.label === 'Izmeni')).toBe(true);
    expect(rows.some(row => typeof row.props.value !== 'string')).toBe(true);
    expect(rows[rows.length - 1].props.last).toBe(true);
  });

  it('izbor: two options, three options (also with the old flags) and five chips that scroll', async () => {
    mockParams = { scene: 'izbor' }; await render();
    const sets = tree.root.findAllByType(Segmented);
    expect(sets.map(set => set.props.options.length).sort()).toEqual([2, 2, 3, 3, 5]);
    // The set that shares a row with an icon button has no width of its own: it is `inline` (F8b, at F2's request).
    expect(sets.filter(set => set.props.inline).length).toBe(1);
    expect(sets.some(set => set.props.contentSized && set.props.scroll)).toBe(true);
    // The screen's own scroller, and the one row of chips that scrolls sideways.
    expect(tree.root.findAllByType(ScrollView).filter(scroller => scroller.props.horizontal)).toHaveLength(1);
    expect(sets.find(set => set.props.options.length === 2)!.props.options[0]).toMatchObject({ badgeTone: 'attention', badge: 3 });
  });

  it('podnozje: a flow whose foot says why the green action cannot be pressed, and lets it go when it can', async () => {
    mockParams = { scene: 'podnozje' }; await render();
    const foot = () => tree.root.findByType(FlowFooter);
    expect(foot().props.reason).toBe('Izaberi dan i vreme da nastaviš.');
    const modes = tree.root.findByType(Segmented);
    await act(async () => modes.props.onChange('spremno'));
    expect(foot().props.reason).toBeUndefined();
    await act(async () => tree.root.findByType(Segmented).props.onChange('dva'));
    expect(texts()).toContain('Sačuvaj kao nacrt');
  });

  it('dugi: the longest names the app meets are drawn whole, in a wrapped title, never cut', async () => {
    mockParams = { scene: 'dugi' }; await render();
    expect(texts().some(text => text.startsWith('Prenos starog trokrilnog ormara'))).toBe(true);
    // The words of the sections: the bar's own title may take two lines and an avatar's two letters one, but a name is never limited.
    for (const section of tree.root.findAllByType(Section)) for (const node of section.findAllByType(Text)) {
      if (typeof node.props.children === 'string' && node.props.children.length > 12) expect([node.props.children, node.props.numberOfLines]).toEqual([node.props.children, undefined]);
    }
  });

  it('veliki: the components are told "large" by the override, so a key-value row stacks and a section\'s action goes under its title', async () => {
    mockParams = { scene: 'veliki' }; await render();
    const labelled = tree.root.findAllByType(KeyValueRow)[0];
    const pair = labelled.findAll(node => typeof node.type === 'string' && flat(node).paddingVertical === 12 && flat(node).flexDirection !== undefined)[0];
    expect(flat(pair).flexDirection).toBe('column');
    const section = tree.root.findAllByType(Section).find(candidate => candidate.props.action)!;
    expect(flat(section.findAll(node => typeof node.type === 'string' && flat(node).flexDirection !== undefined)[0]).flexDirection).toBe('column');
  });
});

// The state scenes (`?scene=stanja`, UI/UX pass 2026-10-08, F8b): every state the system draws, each FULL screen under its bar, from fixtures.
describe('the state scenes', () => {
  const states = STATE_SCENES.map(option => option.key);
  const open = (stanje: string, extra: Record<string, unknown> = {}) => { mockParams = { scene: 'stanja', stanje, ...extra }; };

  it('lists the states as rows of their own, with an arrow, and opens one full screen under its bar, with the arrow back to the list', async () => {
    mockParams = { scene: 'stanja' }; await render();
    const rows = tree.root.findAllByType(ListRow);
    expect(rows.map(row => row.props.title)).toEqual(STATE_SCENES.map(option => option.label));
    for (const row of rows) expect([row.props.title, typeof row.props.onPress]).toEqual([row.props.title, 'function']);
    expect(rows[rows.length - 1].props.last).toBe(true);
    await act(async () => rows[3].props.onPress());
    expect(tree.root.findAllByType(ListRow)).toHaveLength(0);
    await act(async () => tree.root.findAll(node => node.props.accessibilityLabel === 'Nazad' && node.type === Press)[0].props.onPress());
    expect(tree.root.findAllByType(ListRow)).toHaveLength(STATE_SCENES.length);
  });

  it('names every state a person meets: empty three ways, a wait in three shapes, a failed read, no connection (a screen and a strip), a service that is down, and an unknown outcome three ways', () => {
    expect(states).toEqual(['prazno-prvi', 'prazno-filter', 'prazno-gotovo', 'ucitavanje-redovi', 'ucitavanje-zapisi', 'ucitavanje-cinjenice', 'greska', 'bez-veze',
      'bez-veze-traka', 'usluga', 'nije-sigurno', 'nije-sigurno-provera', 'nije-sigurno-traka', 'sekcija', 'dugi']);
  });

  describe.each(states)('state %s, opened by its address', state => {
    it('draws from fixtures only: no data client, no account, and every press is inert', async () => {
      open(state); await render();
      expect(tree.root.findAllByType(StateView).length + tree.root.findAllByType(OfflineLine).length + tree.root.findAllByType(OutcomeUncertain).length).toBeGreaterThan(0);
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('is also drawn at text scale 1.3, by `&veliki=1`', async () => {
      open(state, { veliki: '1' }); await render();
      expect(tree.root.findAllByType(StateView).length + tree.root.findAllByType(OfflineLine).length + tree.root.findAllByType(OutcomeUncertain).length).toBeGreaterThan(0);
    });
  });

  it('puts an empty state in a screen that does not scroll, so the block has the whole room to lie a third of the way down in, and a wait in one that does', async () => {
    open('prazno-prvi'); await render();
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
    await act(async () => tree.unmount());
    open('ucitavanje-redovi'); await render();
    expect(tree.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
  });

  it('draws the three empty lists as the rules of StateView write them: the first time, a filter and everything done', async () => {
    open('prazno-prvi'); await render();
    expect(texts()).toEqual(expect.arrayContaining(['Još nemaš zadatak', 'Objavi prvi zadatak']));
    await act(async () => tree.unmount());
    open('prazno-filter'); await render();
    expect(texts()).toEqual(expect.arrayContaining(['Nema zadataka u ovom prikazu', 'Poništi filtere']));
    expect(texts().some(text => text.startsWith('Još nem'))).toBe(false);
    await act(async () => tree.unmount());
    open('prazno-gotovo'); await render();
    expect(tree.root.findAllByType(V2Action)).toHaveLength(0);
  });

  it('waits in rows, records and facts: each is the shape the list is told, and nothing in it can be pressed', async () => {
    for (const [state, variant] of [['ucitavanje-redovi', 'row'], ['ucitavanje-zapisi', 'record'], ['ucitavanje-cinjenice', 'fact']] as const) {
      open(state); await render();
      expect([state, tree.root.findByType(SkeletonList).props.variant]).toEqual([state, variant]);
      expect(tree.root.findAllByType(V2Action)).toHaveLength(0);
      await act(async () => tree.unmount());
    }
  });

  it('says a read that did not arrive, no connection and a service that is down in the words of the table, each with the one button', async () => {
    for (const [state, title, button] of [['greska', 'Ne možemo da učitamo Dogovore', 'Pokušaj ponovo'], ['bez-veze', 'Nema internet veze', 'Pokušaj ponovo'],
      ['usluga', 'Usluga trenutno nije dostupna', 'Pokušaj ponovo']] as const) {
      open(state); await render();
      expect([state, texts()]).toEqual([state, expect.arrayContaining([title, button])]);
      expect([state, tree.root.findAllByType(V2Action).map(action => action.props.label)]).toEqual([state, [button]]);
      await act(async () => tree.unmount());
    }
  });

  it('draws "no connection" as a strip over the rows the screen already has, with the one word that reads again', async () => {
    open('bez-veze-traka'); await render();
    expect(tree.root.findAllByType(OfflineLine)).toHaveLength(1);
    expect(texts()).toEqual(expect.arrayContaining(['Nema veze. Prikazano je poslednje učitano.', 'Osveži', 'Montaža police u hodniku']));
    expect(tree.root.findAllByType(StateView)).toHaveLength(0);
  });

  it('draws "we do not know" as a screen with the one button Proveri, then as the button at work, and as a note in the foot of a flow that stays', async () => {
    open('nije-sigurno'); await render();
    expect(tree.root.findByType(OutcomeUncertain).props).toMatchObject({ about: 'application' });
    expect(tree.root.findByType(OutcomeUncertain).props.checking).toBeFalsy();
    expect(tree.root.findAllByType(V2Action).map(action => action.props.label)).toEqual(['Proveri', 'Nazad na zadatak']);
    await act(async () => tree.unmount());
    open('nije-sigurno-provera'); await render();
    expect(tree.root.findByType(OutcomeUncertain).props.checking).toBe(true);
    expect(tree.root.findAllByType(V2Action)[0].props).toMatchObject({ label: 'Proveri', loading: true });
    await act(async () => tree.unmount());
    open('nije-sigurno-traka'); await render();
    const foot = tree.root.findByType(FlowFooter);
    expect(foot.findByType(OutcomeUncertain).props.layout).toBe('inline');
    const [check, send] = foot.findAllByType(V2Action);
    expect([check.props.label, send.props.label, send.props.disabled]).toEqual(['Proveri', 'Pošalji prijavu', true]);
    expect(tree.root.findAllByType(Text).some(node => node.props.children === 'Tvoja prijava')).toBe(true);
    // The one press that does something in the gallery: "Proveri" shows its spinner and the next press takes it away.
    await act(async () => check.props.onPress());
    expect(foot.findAllByType(V2Action)[0].props.loading).toBe(true);
    await act(async () => foot.findAllByType(V2Action)[0].props.onPress());
    expect(foot.findAllByType(V2Action)[0].props.loading).toBe(false);
  });

  it('draws the compact state inside two sections of a screen that scrolls, and the longest words of a failure whole', async () => {
    open('sekcija'); await render();
    expect(tree.root.findAllByType(StateView).map(view => view.props.compact)).toEqual([true, true]);
    expect(tree.root.findAllByType(Section).length).toBe(2);
    await act(async () => tree.unmount());
    open('dugi'); await render();
    expect(texts().some(text => text.startsWith('Ne možemo da učitamo Dogovore za montažu nameštaja'))).toBe(true);
    for (const node of tree.root.findAllByType(Text)) {
      if (typeof node.props.children === 'string' && node.props.children.length > 20) expect([node.props.children, node.props.numberOfLines]).toEqual([node.props.children, undefined]);
    }
  });
});
