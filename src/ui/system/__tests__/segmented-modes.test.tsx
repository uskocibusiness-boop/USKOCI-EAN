import React from 'react';
import { Animated, ScrollView, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../Press', () => ({ PRESS_DELAY: 60, Press: 'Press' }));
jest.mock('../../Text', () => ({ T: 'T' }));

import { layout, ruleWidth } from '../layout';
import { SEGMENTED_CHIPS_FROM, Segmented, type SegmentedOption } from '../Segmented';
import { sys } from '../tokens';

/** Choice identity, accessible labels, caller behavior and the configured responsive boundary are protected.
 * The threshold and decorative proportions may evolve without losing these contracts. */
type Key = string;
const labels: Record<Key, string> = { a: 'Aktivni', b: 'Nacrti', c: 'Istorija', d: 'Dogovori', e: 'Arhiva' };
const namedKeys = Object.keys(labels);
const make = (count: number, patch: Partial<Record<Key, Partial<SegmentedOption<Key>>>> = {}): SegmentedOption<Key>[] =>
  Array.from({ length: count }, (_, index) => {
    const key = namedKeys[index] ?? `option-${index}`;
    return { key, label: labels[key] ?? `Opcija ${index + 1}`, ...patch[key] };
  });
const TRACK_COUNT = SEGMENTED_CHIPS_FROM - 1;
const CHIPS_COUNT = Math.max(namedKeys.length, SEGMENTED_CHIPS_FROM + 1);
const change = jest.fn();
let tree: ReactTestRenderer;
const render = async (options: SegmentedOption<Key>[], extra: Partial<React.ComponentProps<typeof Segmented<Key>>> = {}, value: Key = 'a') =>
  act(async () => { tree = create(<Segmented options={options} value={value} onChange={change} {...extra} />); });
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const tab = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const tabs = () => tree.root.findAll(node => node.props.accessibilityRole === 'tab');
const track = () => tree.root.findAll(node => node.props.accessibilityRole === 'tablist')[0];
const word = (label: string) => tab(label).findAll(node => node.type === ('T' as unknown) && node.props.variant === 'meta')[0];
const badgeTexts = (label: string) => tab(label).findAll(node => node.type === ('T' as unknown) && node.props.variant === 'label').map(node => node.props.children);

beforeEach(() => { jest.useFakeTimers(); change.mockClear(); });
afterEach(async () => { await act(async () => tree?.unmount()); mockReduced = false; jest.restoreAllMocks(); jest.useRealTimers(); });

describe('choices below the configured boundary share a non-scrolling track', () => {
  it.each([...new Set([1, TRACK_COUNT])])('%i options: every tab keeps its label, equal space and a full touch target', async count => {
    await render(make(count));
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
    expect(track().props.accessibilityRole).toBe('tablist');
    expect(flat(track())).toMatchObject({ flexDirection: 'row', padding: sys.space.xs, gap: sys.space.xs, backgroundColor: sys.color.control });
    for (const node of tabs()) expect(flat(node)).toMatchObject({ flexGrow: 1, flexBasis: 0, minHeight: layout.touch });
    expect(tabs()).toHaveLength(count);
  });

  it('keeps accepting contentSized and scroll, and ignores them: equal shares, no scroller, no intrinsic widths', async () => {
    await render(make(TRACK_COUNT), { contentSized: true, scroll: true });
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
    for (const node of tabs()) {
      expect(flat(node)).toMatchObject({ flexGrow: 1, flexBasis: 0 });
      expect(flat(node).flexShrink).toBeUndefined();
    }
  });

  it('still lets the give of a tab wait out the press delay when the caller said `scroll`, as a row in a scrolling list does', async () => {
    await render(make(2), { scroll: true });
    for (const node of tabs()) expect(node.props.unstable_pressDelay).toBe(60);
    await act(async () => tree.update(<Segmented options={make(2)} value="a" onChange={change} />));
    for (const node of tabs()) expect(node.props.unstable_pressDelay).toBeUndefined();
  });

  it('wraps a word that does not fit instead of cutting it: no line limit, and the tab may hold two lines', async () => {
    await render(make(TRACK_COUNT, { a: { label: 'Čekaju tvoj odgovor' } }));
    expect(word('Čekaju tvoj odgovor').props.numberOfLines).toBeUndefined();
    // `alignContent: 'center'`: a wrapping row lays its lines at the TOP of the 48 dp otherwise, and the words sat above the middle.
    expect(flat(tab('Čekaju tvoj odgovor'))).toMatchObject({ flexWrap: 'wrap', alignItems: 'center', alignContent: 'center', justifyContent: 'center' });
    expect(flat(word('Čekaju tvoj odgovor'))).toMatchObject({ flexShrink: 1, textAlign: 'center' });
  });

  it('is a tab for a screen reader, says which is chosen, and gives on the button rung with a tick for the one that is not', async () => {
    await render(make(3), {}, 'b');
    expect(tab('Nacrti').props).toMatchObject({ accessibilityRole: 'tab', accessibilityState: { selected: true }, haptic: 'none', scaleTo: sys.motion.scale.button });
    expect(tab('Aktivni').props).toMatchObject({ accessibilityState: { selected: false }, haptic: 'select' });
    await act(async () => tab('Aktivni').props.onPress());
    expect(change).toHaveBeenCalledWith('a');
    change.mockClear();
    await act(async () => tab('Nacrti').props.onPress());
    expect(change).not.toHaveBeenCalled();
  });

  it('keeps selection visible before measurement and anchors the indicator to the measured tab', async () => {
    await render(make(TRACK_COUNT));
    expect(flat(tab('Aktivni')).backgroundColor).toBe(sys.color.surface);
    expect(tree.root.findAllByType(Animated.View)).toHaveLength(0);
    await act(async () => tab('Aktivni').props.onLayout({ nativeEvent: { layout: { x: 4, y: 0, width: 100, height: 48 } } }));
    expect(flat(tab('Aktivni')).backgroundColor).toBeUndefined();
    const pill = tree.root.findByType(Animated.View);
    expect(flat(pill)).toMatchObject({ width: 100, backgroundColor: sys.color.surface, borderWidth: ruleWidth, borderColor: sys.color.line });
  });
});

describe('choices at the configured boundary remain reachable in a horizontal row', () => {
  it('keeps every option reachable at and above the configured chip threshold', async () => {
    expect(Number.isInteger(SEGMENTED_CHIPS_FROM)).toBe(true);
    expect(SEGMENTED_CHIPS_FROM).toBeGreaterThan(1);
    for (const count of [SEGMENTED_CHIPS_FROM, SEGMENTED_CHIPS_FROM + 1]) {
      await render(make(count));
      const scroller = tree.root.findByType(ScrollView);
      expect(scroller.props).toMatchObject({ horizontal: true, showsHorizontalScrollIndicator: false, accessibilityRole: 'tablist', keyboardShouldPersistTaps: 'handled' });
      expect(tabs()).toHaveLength(count);
      await act(async () => tree.unmount());
    }
  });

  it('switches layout at the exported boundary without losing an option', async () => {
    await render(make(TRACK_COUNT));
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
    await act(async () => tree.update(<Segmented options={make(SEGMENTED_CHIPS_FROM)} value="a" onChange={change} />));
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
  });

  it('chips with `scroll` or `contentSized` are the same chips: the flags change nothing', async () => {
    await render(make(CHIPS_COUNT), { scroll: true, contentSized: true });
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
    expect(flat(tabs()[0])).toMatchObject({ minHeight: layout.touch, borderRadius: sys.radius.pill });
  });

  it('gives chips full touch targets and lets long labels remain readable', async () => {
    await render(make(CHIPS_COUNT));
    // A chip that is not chosen: white, with the strong 1 dp edge.
    expect(flat(tab('Nacrti'))).toMatchObject({ minHeight: layout.touch, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill,
      borderWidth: ruleWidth, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface });
    expect(StyleSheet.flatten(tree.root.findByType(ScrollView).props.contentContainerStyle)).toMatchObject({ gap: sys.space.sm });
    expect(word('Nacrti').props.numberOfLines).toBeUndefined();
  });

  it('marks the chosen chip with a quiet well and an ink edge and a bold ink word, and there is no sliding pill', async () => {
    await render(make(CHIPS_COUNT), {}, 'c');
    expect(flat(tab('Istorija'))).toMatchObject({ backgroundColor: sys.color.greenSoft, borderColor: sys.color.ink });
    expect(flat(tab('Aktivni')).backgroundColor).toBe(sys.color.surface);
    expect(tree.root.findAllByType(Animated.View)).toHaveLength(0);
    expect(tab('Istorija').props.accessibilityState).toEqual({ selected: true });
    expect(tab('Aktivni').props.accessibilityState).toEqual({ selected: false });
  });

  it('waits out the press delay and does not extend touch areas into neighboring chips', async () => {
    await render(make(CHIPS_COUNT));
    for (const node of tabs()) expect(node.props).toMatchObject({ unstable_pressDelay: 60, hitSlop: 0 });
  });

  it('commits on a press of a chip that is not chosen, and ticks only then', async () => {
    await render(make(CHIPS_COUNT));
    await act(async () => tab('Arhiva').props.onPress());
    expect(change).toHaveBeenCalledWith('e');
    expect(tab('Arhiva').props.haptic).toBe('select');
    expect(tab('Aktivni').props.haptic).toBe('none');
  });

  it('runs out to the screen\'s edges by default (the gutter), so a chip scrolls under the edge and not under a strip of white', async () => {
    await render(make(CHIPS_COUNT));
    const scroller = tree.root.findByType(ScrollView);
    expect(flat(scroller)).toMatchObject({ marginHorizontal: -layout.gutter, flexGrow: 0 });
    expect(StyleSheet.flatten(scroller.props.contentContainerStyle)).toMatchObject({ paddingHorizontal: layout.gutter, flexDirection: 'row', gap: sys.space.sm });
    await act(async () => tree.update(<Segmented options={make(CHIPS_COUNT)} value="a" onChange={change} bleed={false} />));
    expect(flat(tree.root.findByType(ScrollView)).marginHorizontal).toBeUndefined();
    expect(StyleSheet.flatten(tree.root.findByType(ScrollView).props.contentContainerStyle).paddingHorizontal).toBeUndefined();
  });

  it('puts the caller\'s style on the scroller', async () => {
    await render(make(CHIPS_COUNT), { style: { marginTop: 8 } });
    expect(flat(tree.root.findByType(ScrollView))).toMatchObject({ marginTop: 8 });
  });
});

describe('the underline appearance preserves its explicit layout and selection contract', () => {
  it.each([2, 3])('opt-in equal underlines keep %i long labels within their allocated width and preserve selection', async count => {
    await render(make(count, { a: { label: 'Čekaju tvoj odgovor' } }), { appearance: 'underline', equal: true });
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
    expect(flat(track()).gap).toBe(sys.space.sm);
    for (const node of tabs()) {
      expect(flat(node)).toMatchObject({ flexGrow: 1, flexBasis: 0, minWidth: 0, flexShrink: 1, minHeight: layout.touch, flexWrap: 'wrap' });
    }
    expect(word('Čekaju tvoj odgovor').props.numberOfLines).toBeUndefined();
    await act(async () => tab('Nacrti').props.onPress());
    expect(change).toHaveBeenCalledWith('b');
    await act(async () => tree.update(<Segmented options={make(count)} value="b" onChange={change} appearance="underline" equal />));
    expect(tab('Nacrti').props.accessibilityState.selected).toBe(true);
  });
  it('keeps underline tabs in their own track even above the chip threshold', async () => {
    await render(make(CHIPS_COUNT), { appearance: 'underline' });
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
    expect(track().props.accessibilityRole).toBe('tablist');
    expect(tabs()).toHaveLength(CHIPS_COUNT);
    for (const node of tabs()) expect(flat(node).minHeight).toBeGreaterThanOrEqual(layout.touch);
    expect(tab('Aktivni').props.accessibilityState.selected).toBe(true);
  });

  it('with `scroll` it is still a scroller (the underline has its own scrolling row), with the delay', async () => {
    await render(make(2), { appearance: 'underline', scroll: true });
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
    for (const node of tabs()) expect(node.props.unstable_pressDelay).toBe(60);
  });
});

describe('a number is drawn only for what waits for the person', () => {
  const counted = { a: { badge: 3, badgeTone: 'attention' as const, badgeLabel: '3 čekaju tebe' }, b: { badge: 2, badgeLabel: '2 nacrta' }, c: { badge: 25 } };

  it('draws the number of an attention tab, in the orange of what waits, and none for a quiet count', async () => {
    await render(make(3, counted));
    expect(badgeTexts('Aktivni')).toEqual(['3']);
    expect(badgeTexts('Nacrti')).toEqual([]);
    expect(badgeTexts('Istorija')).toEqual([]);
    const pill = tab('Aktivni').findAll(node => typeof node.type === 'string' && flat(node).backgroundColor === sys.color.orange)[0];
    expect(flat(pill).minWidth).toBeGreaterThan(0);
    expect(flat(pill).height).toBeGreaterThan(0);
    const number = tab('Aktivni').findAll(node => node.type === ('T' as unknown) && node.props.variant === 'label')[0];
    expect(flat(number)).toMatchObject({ color: sys.color.onOrange });
  });

  it('still SAYS a count the caller named, so a screen reader hears what the eye is not given, and retires one that went away', async () => {
    await render(make(3, counted));
    expect(tab('Aktivni').props.accessibilityValue).toEqual({ text: '3 čekaju tebe' });
    expect(tab('Nacrti').props.accessibilityValue).toEqual({ text: '2 nacrta' });
    // A count with no words says nothing, and an explicit empty text retires what was spoken before it (Android keeps the old one).
    expect(tab('Istorija').props.accessibilityValue).toEqual({ text: '' });
    await act(async () => tree.update(<Segmented options={make(3)} value="a" onChange={change} />));
    expect(tab('Aktivni').props.accessibilityValue).toEqual({ text: '' });
  });

  it('draws it in the chips as well, and nowhere a quiet count was drawn before', async () => {
    await render(make(CHIPS_COUNT, { d: { badge: 4, badgeTone: 'attention' }, e: { badge: 9 } }));
    expect(badgeTexts('Dogovori')).toEqual(['4']);
    expect(badgeTexts('Arhiva')).toEqual([]);
    expect(badgeTexts('Aktivni')).toEqual([]);
  });

  it('draws a number given as a word too, and nothing for an attention tab with no number', async () => {
    await render(make(2, { a: { badge: '99+', badgeTone: 'attention' }, b: { badgeTone: 'attention' } }));
    expect(badgeTexts('Aktivni')).toEqual(['99+']);
    expect(badgeTexts('Nacrti')).toEqual([]);
  });
});

// F8b, at F2's request: a set that stands in a row beside an icon button or a pill used to have two ways to say how wide it was (a wrapper with
// `flex: 1`, or a fixed width of dp). `inline` is the third, and the one that needs no number: the track is as wide as its words.
describe('inline: the track is the width of its words, to stand in a row beside another control', () => {
  it('lets an inline track give way before pushing a neighboring control out of the row', async () => {
    await render(make(TRACK_COUNT), { inline: true });
    expect(flat(track())).toMatchObject({ flexDirection: 'row', flexShrink: 1, maxWidth: '100%', padding: sys.space.xs, gap: sys.space.xs, backgroundColor: sys.color.control });
    for (const node of tabs()) {
      expect(flat(node)).toMatchObject({ flexGrow: 0, flexShrink: 1, flexBasis: 'auto', paddingHorizontal: sys.space.base, minHeight: layout.touch });
    }
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
  });

  it('keeps a tab 48 dp high, a word that does not fit going to a second line, and the tab semantics of the set it is', async () => {
    await render(make(3, { a: { label: 'Čekaju tvoj odgovor' } }), { inline: true }, 'b');
    expect(flat(tab('Čekaju tvoj odgovor')).minHeight).toBeGreaterThanOrEqual(layout.touch);
    expect(word('Čekaju tvoj odgovor').props.numberOfLines).toBeUndefined();
    expect(tab('Nacrti').props).toMatchObject({ accessibilityRole: 'tab', accessibilityState: { selected: true }, haptic: 'none' });
    await act(async () => tab('Istorija').props.onPress());
    expect(change).toHaveBeenCalledWith('c');
  });

  it('is nothing the set had before: without it the tabs are equal shares of the width they are given, as always', async () => {
    await render(make(TRACK_COUNT));
    expect(flat(track()).flexShrink).toBeUndefined();
    expect(flat(track()).maxWidth).toBeUndefined();
    for (const node of tabs()) {
      expect(flat(node)).toMatchObject({ flexGrow: 1, flexBasis: 0, paddingHorizontal: sys.space.sm });
      expect(flat(node).flexShrink).toBeUndefined();
    }
    await act(async () => tree.update(<Segmented options={make(TRACK_COUNT)} value="a" onChange={change} inline={false} />));
    for (const node of tabs()) expect(flat(node)).toMatchObject({ flexGrow: 1, flexBasis: 0 });
  });

  it('keeps chips and underline modes reachable when inline is supplied', async () => {
    await render(make(CHIPS_COUNT), { inline: true });
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
    for (const node of tabs()) expect(flat(node).flexBasis).toBeUndefined();
    await act(async () => tree.unmount());
    await render(make(3), { inline: true, appearance: 'underline' });
    expect(flat(track()).flexShrink).toBeUndefined();
    for (const node of tabs()) expect(flat(node)).toMatchObject({ flexGrow: 0, flexBasis: 'auto', paddingHorizontal: sys.space.xs });
  });

  it("takes the caller's own style after its own, so a column can put it at the left", async () => {
    await render(make(TRACK_COUNT), { inline: true, style: { alignSelf: 'flex-start' } });
    expect(flat(track())).toMatchObject({ alignSelf: 'flex-start', flexShrink: 1 });
  });
});
