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

/**
 * A set of choices that never cuts a word (composition spec 2026-10-07, U7 and N-Segmented; UI/UX pass 2026-10-08, F8a). The old
 * control scrolled sideways from two options on and cut "Istorija 7" and "Moje pr…" at the owner's text size. Now: up to three
 * options share the width EQUALLY, in a track that never scrolls, and their words wrap to a second line at a large text size; from
 * four on the set is a row of chips, the one place in the app that scrolls sideways. A count is drawn only for what waits for the
 * person (`badgeTone="attention"`); `contentSized` and `scroll` stay accepted, so no call breaks, and are ignored by the layout.
 */
type Key = 'a' | 'b' | 'c' | 'd' | 'e';
const labels: Record<Key, string> = { a: 'Aktivni', b: 'Nacrti', c: 'Istorija', d: 'Dogovori', e: 'Arhiva' };
const make = (count: number, patch: Partial<Record<Key, Partial<SegmentedOption<Key>>>> = {}): SegmentedOption<Key>[] =>
  (['a', 'b', 'c', 'd', 'e'] as Key[]).slice(0, count).map(key => ({ key, label: labels[key], ...patch[key] }));
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

describe('up to three options share the width equally, in a track that never scrolls', () => {
  it.each([2, 3])('%i options: one track, no scroller, every tab the same share and 48 dp high, and a track of 56', async count => {
    await render(make(count));
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
    expect(track().props.accessibilityRole).toBe('tablist');
    expect(flat(track())).toMatchObject({ flexDirection: 'row', padding: sys.space.xs, gap: sys.space.xs, backgroundColor: sys.color.control });
    for (const node of tabs()) expect(flat(node)).toMatchObject({ flexGrow: 1, flexBasis: 0, minHeight: layout.touch });
    expect(tabs()).toHaveLength(count);
    // 48 of tab and 4 of track padding on each side: the row the spec calls 56.
    expect(layout.touch + 2 * sys.space.xs).toBe(56);
  });

  it('keeps accepting contentSized and scroll, and ignores them: equal shares, no scroller, no intrinsic widths', async () => {
    await render(make(3), { contentSized: true, scroll: true });
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
    await render(make(3, { a: { label: 'Čekaju tvoj odgovor' } }));
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

  it('paints the chosen tab before it is measured, then moves one white pill to it', async () => {
    await render(make(3));
    expect(flat(tab('Aktivni')).backgroundColor).toBe(sys.color.surface);
    expect(tree.root.findAllByType(Animated.View)).toHaveLength(0);
    await act(async () => tab('Aktivni').props.onLayout({ nativeEvent: { layout: { x: 4, y: 0, width: 100, height: 48 } } }));
    expect(flat(tab('Aktivni')).backgroundColor).toBeUndefined();
    const pill = tree.root.findByType(Animated.View);
    expect(flat(pill)).toMatchObject({ width: 100, backgroundColor: sys.color.surface, borderWidth: ruleWidth, borderColor: sys.color.line });
  });
});

describe('from four options on the set is a row of chips, the one place that scrolls sideways', () => {
  it('draws 4 and 5 options as chips in a horizontal scroller, not in a track', async () => {
    expect(SEGMENTED_CHIPS_FROM).toBe(4);
    for (const count of [4, 5]) {
      await render(make(count));
      const scroller = tree.root.findByType(ScrollView);
      expect(scroller.props).toMatchObject({ horizontal: true, showsHorizontalScrollIndicator: false, accessibilityRole: 'tablist', keyboardShouldPersistTaps: 'handled' });
      expect(tabs()).toHaveLength(count);
      await act(async () => tree.unmount());
    }
  });

  it('is the boundary: three options are a track, four are chips', async () => {
    await render(make(3));
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
    await act(async () => tree.update(<Segmented options={make(4)} value="a" onChange={change} />));
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
  });

  it('chips with `scroll` or `contentSized` are the same chips: the flags change nothing', async () => {
    await render(make(5), { scroll: true, contentSized: true });
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
    expect(flat(tabs()[0])).toMatchObject({ minHeight: layout.touch, borderRadius: sys.radius.pill });
  });

  it('draws a chip 48 dp high with a 1 dp edge and room for its word: nothing is cut, 8 apart', async () => {
    await render(make(5));
    // A chip that is not chosen: white, with the strong 1 dp edge.
    expect(flat(tab('Nacrti'))).toMatchObject({ minHeight: layout.touch, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill,
      borderWidth: ruleWidth, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface });
    expect(StyleSheet.flatten(tree.root.findByType(ScrollView).props.contentContainerStyle)).toMatchObject({ gap: sys.space.sm });
    expect(word('Nacrti').props.numberOfLines).toBeUndefined();
  });

  it('marks the chosen chip with a quiet well and an ink edge and a bold ink word, and there is no sliding pill', async () => {
    await render(make(5), {}, 'c');
    expect(flat(tab('Istorija'))).toMatchObject({ backgroundColor: sys.color.greenSoft, borderColor: sys.color.ink });
    expect(flat(tab('Aktivni')).backgroundColor).toBe(sys.color.surface);
    expect(tree.root.findAllByType(Animated.View)).toHaveLength(0);
    expect(tab('Istorija').props.accessibilityState).toEqual({ selected: true });
    expect(tab('Aktivni').props.accessibilityState).toEqual({ selected: false });
  });

  it('waits out the press delay and has no extra reach (the chips are 8 apart), because a finger on a chip may be a scroll', async () => {
    await render(make(5));
    for (const node of tabs()) expect(node.props).toMatchObject({ unstable_pressDelay: 60, hitSlop: 0 });
  });

  it('commits on a press of a chip that is not chosen, and ticks only then', async () => {
    await render(make(5));
    await act(async () => tab('Arhiva').props.onPress());
    expect(change).toHaveBeenCalledWith('e');
    expect(tab('Arhiva').props.haptic).toBe('select');
    expect(tab('Aktivni').props.haptic).toBe('none');
  });

  it('runs out to the screen\'s edges by default (the gutter), so a chip scrolls under the edge and not under a strip of white', async () => {
    await render(make(5));
    const scroller = tree.root.findByType(ScrollView);
    expect(flat(scroller)).toMatchObject({ marginHorizontal: -layout.gutter, flexGrow: 0 });
    expect(StyleSheet.flatten(scroller.props.contentContainerStyle)).toMatchObject({ paddingHorizontal: layout.gutter, flexDirection: 'row', gap: sys.space.sm });
    await act(async () => tree.update(<Segmented options={make(5)} value="a" onChange={change} bleed={false} />));
    expect(flat(tree.root.findByType(ScrollView)).marginHorizontal).toBeUndefined();
    expect(StyleSheet.flatten(tree.root.findByType(ScrollView).props.contentContainerStyle).paddingHorizontal).toBeUndefined();
  });

  it('puts the caller\'s style on the scroller', async () => {
    await render(make(5), { style: { marginTop: 8 } });
    expect(flat(tree.root.findByType(ScrollView))).toMatchObject({ marginTop: 8 });
  });
});

describe('the underline appearance is the same as it was, whatever the number of options', () => {
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
  it('keeps the underline tabs in a track for five options too: it is not the chips', async () => {
    await render(make(5), { appearance: 'underline' });
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
    expect(flat(track())).toMatchObject({ borderBottomWidth: ruleWidth, borderBottomColor: sys.color.line, padding: 0 });
    for (const node of tabs()) expect(flat(node)).toMatchObject({ flexGrow: 0, flexBasis: 'auto', borderBottomWidth: 3 });
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
    expect(flat(pill)).toMatchObject({ minWidth: 24, height: 24, borderRadius: sys.radius.badge, paddingHorizontal: sys.space.sm });
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
    await render(make(5, { d: { badge: 4, badgeTone: 'attention' }, e: { badge: 9 } }));
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
  it('draws each tab at the width of its word, 16 on each side, and lets the track give way before it pushes its neighbour out of the row', async () => {
    await render(make(2), { inline: true });
    expect(flat(track())).toMatchObject({ flexDirection: 'row', flexShrink: 1, maxWidth: '100%', padding: sys.space.xs, gap: sys.space.xs, backgroundColor: sys.color.control });
    for (const node of tabs()) {
      expect(flat(node)).toMatchObject({ flexGrow: 0, flexShrink: 1, flexBasis: 'auto', paddingHorizontal: sys.space.base, minHeight: layout.touch });
    }
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
  });

  it('keeps a tab 48 dp high, a word that does not fit going to a second line, and the tab semantics of the set it is', async () => {
    await render(make(3, { a: { label: 'Čekaju tvoj odgovor' } }), { inline: true }, 'b');
    expect(flat(tab('Čekaju tvoj odgovor'))).toMatchObject({ flexWrap: 'wrap', minHeight: layout.touch, alignContent: 'center' });
    expect(word('Čekaju tvoj odgovor').props.numberOfLines).toBeUndefined();
    expect(tab('Nacrti').props).toMatchObject({ accessibilityRole: 'tab', accessibilityState: { selected: true }, haptic: 'none' });
    await act(async () => tab('Istorija').props.onPress());
    expect(change).toHaveBeenCalledWith('c');
  });

  it('is nothing the set had before: without it the tabs are equal shares of the width they are given, as always', async () => {
    await render(make(2));
    expect(flat(track()).flexShrink).toBeUndefined();
    expect(flat(track()).maxWidth).toBeUndefined();
    for (const node of tabs()) {
      expect(flat(node)).toMatchObject({ flexGrow: 1, flexBasis: 0, paddingHorizontal: sys.space.sm });
      expect(flat(node).flexShrink).toBeUndefined();
    }
    await act(async () => tree.update(<Segmented options={make(2)} value="a" onChange={change} inline={false} />));
    for (const node of tabs()) expect(flat(node)).toMatchObject({ flexGrow: 1, flexBasis: 0 });
  });

  it('changes nothing for chips (four or more options already are the width of their words) and nothing for the underline strip', async () => {
    await render(make(5), { inline: true });
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
    for (const node of tabs()) expect(flat(node).flexBasis).toBeUndefined();
    await act(async () => tree.unmount());
    await render(make(3), { inline: true, appearance: 'underline' });
    expect(flat(track()).flexShrink).toBeUndefined();
    for (const node of tabs()) expect(flat(node)).toMatchObject({ flexGrow: 0, flexBasis: 'auto', paddingHorizontal: sys.space.xs });
  });

  it("takes the caller's own style after its own, so a column can put it at the left", async () => {
    await render(make(2), { inline: true, style: { alignSelf: 'flex-start' } });
    expect(flat(track())).toMatchObject({ alignSelf: 'flex-start', flexShrink: 1 });
  });
});
