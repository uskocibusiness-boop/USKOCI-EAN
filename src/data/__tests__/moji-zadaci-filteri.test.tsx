import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
import { layout } from '../../ui/system/layout';
import { sys } from '../../ui/system/tokens';

/**
 * Moji zadaci, the one control of the bar ("Papir na stolu", the owner's pick of 2026-10-08, and the decision of the same day that the function of
 * "Filteri" is not lost): on the owner's phone (361 dp wide, text scale 1.15) and at every window and text size the control keeps a touch of 44 dp, says
 * its word beside the drawing, says in its spoken name that a filter is on, and stands in the bar with the screen's arrow. The groups' names and the two
 * quiet rows keep every word at 12 px or more. It is structure, not a render: only a phone shows a pixel.
 */
let mockWidth = 361.14, mockScale = 1.15;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  const List = React.forwardRef(({ data, renderItem, ListEmptyComponent, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ scrollToOffset: () => {} }), []);
    return React.createElement('List', props, data.length ? data.map((item: any) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent);
  });
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: mockWidth, height: 900, scale: 2, fontScale: mockScale });
    if (key === 'FlatList') return List;
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
    if (key === 'Keyboard') return { dismiss: jest.fn() };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';

const row = (id: string, patch = {}): MarketplaceItem => ({ id, revizija: 1, naslov: `Pomoć ${id}`, opis: '', stanje: 'OBJAVLJENA', podrucjeTekst: 'Novi Sad',
  vremeTekst: 'Po dogovoru', uslovi: ['Alat'], rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, brojPrijava: 0, brojPrijavaZaIzbor: 0, priblizno: null, ...patch } as MarketplaceItem);
/** Two active tasks (one waits for my choice), two drafts, three closed. */
const wholeList = () => [row('a1', { brojPrijavaZaIzbor: 2 }), row('a2'), row('d1', { stanje: 'NACRT' }), row('d2', { stanje: 'NACRT' }),
  row('h1', { stanje: 'ZATVORENA' }), row('h2', { stanje: 'ZATVORENA' }), row('h3', { stanje: 'ZATVORENA' })];
let rows: MarketplaceItem[] = wholeList(), snapshot: MarketplaceView;
function Screen({ initial = initialMarketplaceView() }: { initial?: MarketplaceView }) {
  const [view, setView] = useState(initial); snapshot = view;
  return <MarketplacePresentation items={rows} loading={false} error={false} view={view} onView={setView} onOpen={jest.fn()} onRefresh={jest.fn()}
    onProfile={jest.fn()} onBack={jest.fn()} />;
}
let tree: ReactTestRenderer;
const render = async (width = 361.14, scale = 1.15, initial?: MarketplaceView) => {
  mockWidth = width; mockScale = scale; await act(async () => { tree = create(<Screen initial={initial} />); });
};
const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const PRESS = 'Press' as React.ElementType, T_ = 'T' as React.ElementType;
const pressIn = (scope: ReactTestInstance, label: string) => scope.findAll(node => node.type === PRESS && node.props.accessibilityLabel === label);
/** The size a drawn word has: its own style, else the variant's. */
const sizeOf = (node: ReactTestInstance) => (style(node).fontSize ?? (sys.type as Record<string, { fontSize?: number }>)[node.props.variant ?? 'body']?.fontSize) as number;
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); rows = wholeList(); mockWidth = 361.14; mockScale = 1.15; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

/** The window and the text size: what a phone is to this bar. The owner's HONOR is 361.14 dp at 1.15. */
const GRID: readonly [width: number, scale: number][] = [320, 361.14, 411].flatMap(width => [1, 1.15, 1.3].map(scale => [width, scale] as [number, number]));

describe('the one control of the bar is touchable and says what it is', () => {
  it.each(GRID)('at %s dp and text scale %s the control keeps a 44 dp touch target, and no word of a group name or of the two rows is under 12 px', async (width, scale) => {
    await render(width, scale);
    const control = pressIn(tree.root, 'Filteri')[0], box = style(control);
    expect([(box.height ?? box.minHeight) as number >= 44, (box.width ?? box.minWidth) as number >= 44]).toEqual([true, true]);
    const words = tree.root.findAll(node => node.type === T_ && /^(Čeka tvoj izbor|Objavljeno|Dogovoreno|Nacrti|Istorija|\d+ (nacrt|zadat))/.test(String(node.props.children)));
    expect(words.length).toBeGreaterThan(5);
    for (const word of words) expect([word.props.children, sizeOf(word) >= 12]).toEqual([word.props.children, true]);
    // Nothing is cut: a group's name and a row's words are never limited to a number of lines.
    for (const word of words) expect(word.props.numberOfLines).toBeUndefined();
  });

  it('carries the word beside the drawing (a bare sliders icon says nothing); the spoken name says when a filter is on, and the control is then "on"', async () => {
    await render();
    const control = pressIn(tree.root, 'Filteri')[0];
    expect(control.findAll(node => node.type === T_ && node.props.children === 'Filteri')).toHaveLength(1);
    expect(control.props.accessibilityState).toEqual({ selected: false });
    await act(async () => { tree.unmount(); });
    await render(361.14, 1.15, { ...initialMarketplaceView(), price: 'OFFERS' });
    expect(pressIn(tree.root, 'Filteri, aktivni')).toHaveLength(1);
    expect(pressIn(tree.root, 'Filteri, aktivni')[0].props.accessibilityState).toEqual({ selected: true });
    // A search that is on counts too: it is one of the filters.
    await act(async () => { tree.unmount(); });
    await render(361.14, 1.15, { ...initialMarketplaceView(), query: 'a1' });
    expect(pressIn(tree.root, 'Filteri, aktivni')).toHaveLength(1);
    // And so does "Čeka tvoj izbor".
    await act(async () => { tree.unmount(); });
    await render(361.14, 1.15, { ...initialMarketplaceView(), attention: true });
    expect(pressIn(tree.root, 'Filteri, aktivni')).toHaveLength(1);
  });

  it('stands in the bar and not in the list: the list has its own padding of the screen\'s edge and holds no control', async () => {
    await render();
    const list = tree.root.findByType('List' as React.ElementType);
    expect(StyleSheet.flatten(list.props.contentContainerStyle)).toMatchObject({ paddingHorizontal: layout.gutter });
    expect(pressIn(list, 'Filteri')).toHaveLength(0);
    expect(pressIn(tree.root, 'Filteri')).toHaveLength(1);
    // The arrow of the screen is in the same bar.
    expect(pressIn(tree.root, 'Nazad')).toHaveLength(1);
  });

  it('opens the sheet from the groups and from a set that was opened, with the same words', async () => {
    await render();
    await act(async () => pressIn(tree.root, 'Filteri')[0].props.onPress());
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži zadatke' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Svi načini' }).length).toBeGreaterThan(0);
    await act(async () => tree.root.findAllByProps({ accessibilityLabel: 'Zatvori filtere' })[0].props.onPress());
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nacrti, 2 nacrta' }).props.onPress());
    expect(snapshot.section).toBe('drafts');
    await act(async () => pressIn(tree.root, 'Filteri')[0].props.onPress());
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži zadatke' }).length).toBeGreaterThan(0);
  });
});
