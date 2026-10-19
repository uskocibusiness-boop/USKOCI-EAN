import React from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
// The artwork registry is tested separately; navigation keeps one original illustration.
jest.mock('../FactArt', () => ({ FactArt: 'FactArt' }));

import { Press } from '../../Press';
import { TAB_BAR_PADDING, TAB_ICON, TAB_INDICATOR, TAB_ITEM_BOTTOM, TAB_ITEM_PADDING, TAB_ITEM_TOP, TAB_LABEL_GAP, TAB_POP, TabBarPreview, TabCapsule, TabGlyph, TabLabel, tabBarHeight, tabBarSurface } from '../TabBarItem';
import { sys } from '../tokens';

/** Selection is a well and readable label, independent of the original artwork.
 * Native-driver and reduced-motion lifecycle remain covered. */
let tree: ReactTestRenderer;
beforeEach(() => { mockReduced = false; });
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const byId = (testID: string) => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === testID)[0];
const pictures = () => tree.root.findAll(node => node.type === ('FactArt' as unknown));
const easeOut = Easing.bezier(...sys.motion.easeOut);

describe('the numbers the bar is built from', () => {
  it('uses compact drawings and spacing while retaining a visible selection marker', () => {
    expect(TAB_ICON).toBe(sys.icon.size.navigation);
    for (const value of [TAB_ICON, TAB_INDICATOR.width, TAB_INDICATOR.height]) expect(value).toBeGreaterThan(0);
    for (const value of [TAB_LABEL_GAP, TAB_ITEM_PADDING]) expect(value).toBeGreaterThanOrEqual(0);
    expect(TAB_POP).toBeGreaterThanOrEqual(1);
    expect(TAB_POP).toBeLessThan(1.2);
  });

  it('leaves room above the drawing for the marker and below the scalable label', () => {
    expect(TAB_ITEM_TOP - TAB_INDICATOR.height).toBeGreaterThanOrEqual(3);
    expect(TAB_ITEM_BOTTOM).toBeGreaterThanOrEqual(3);
  });

  it('makes the bar as high as the icon, the gap, the tab padding, the bar padding and the label actually need', () => {
    const measured = [0, sys.type.navLabel.lineHeight, sys.type.navLabel.lineHeight * 1.3, 64];
    const heights = measured.map(height => tabBarHeight(height, TAB_BAR_PADDING));
    for (let i = 0; i < heights.length; i++) {
      expect(Number.isInteger(heights[i])).toBe(true);
      expect(heights[i] - 2 * TAB_BAR_PADDING).toBeGreaterThanOrEqual(sys.touch.min);
      expect(heights[i]).toBeGreaterThanOrEqual(measured[i] + TAB_ICON + TAB_LABEL_GAP);
      if (i > 0) expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
    }
    expect(tabBarHeight(64, TAB_BAR_PADDING)).toBeGreaterThan(tabBarHeight(sys.type.navLabel.lineHeight, TAB_BAR_PADDING));
  });
});

describe('the capsule of the chosen tab', () => {
  it('is always mounted, over the whole tab, and never takes a touch', async () => {
    await render(<TabCapsule selected={false} radius={20} />);
    const capsule = byId('tab-capsule');
    expect(capsule).toBeDefined();
    expect(flat(capsule)).toMatchObject({ borderRadius: 20, position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 });
    expect(capsule.props.pointerEvents).toBe('none');
    // Not selected: still there, fully transparent.
    expect(flat(capsule).opacity).toBe(0);
    // Chosen: the same element, and it is drawn fully opaque when the bar is first drawn with this tab chosen.
    await act(async () => tree.update(<TabCapsule selected radius={20} />));
    expect(byId('tab-capsule')).toBe(capsule);
    await act(async () => tree.unmount());
    await render(<TabCapsule selected radius={20} />);
    expect(flat(byId('tab-capsule')).opacity).toBe(1);
  });

  it('carries the contrasting orange marker and selected well, which fade together', async () => {
    await render(<TabCapsule selected radius={20} />);
    const pill = flat(byId('tab-indicator'));
    expect(pill).toMatchObject({ width: TAB_INDICATOR.width, height: TAB_INDICATOR.height, backgroundColor: sys.navigation.indicator, position: 'absolute', top: 0, alignSelf: 'center' });
    expect(flat(byId('tab-capsule')).backgroundColor).toBe(sys.navigation.selected);
    expect(pill.borderRadius).toBeGreaterThanOrEqual(TAB_INDICATOR.height / 2);
    // It lives inside the capsule, so its opacity is the capsule's.
    expect(byId('tab-capsule').findAll(node => node.props.testID === 'tab-indicator').length).toBeGreaterThan(0);
  });

  it('fades over the toggle token on the native driver with an ease-out, only when the selection changes', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<TabCapsule selected={false} radius={20} />);
    expect(timing).not.toHaveBeenCalled(); // nothing moves when the bar is first drawn
    await act(async () => tree.update(<TabCapsule selected radius={20} />));
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: sys.motion.toggle, useNativeDriver: true }));
    const easing = (timing.mock.calls[0][1] as { easing: (t: number) => number }).easing;
    expect(easing(0.5)).toBeCloseTo(easeOut(0.5), 6);
    await act(async () => tree.update(<TabCapsule selected radius={20} />)); // the same state again: nothing runs
    expect(timing).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<TabCapsule selected={false} radius={20} />));
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: sys.motion.toggle, useNativeDriver: true }));
  });

  it('under reduced motion is instant: no animation is started and the value is set at once', async () => {
    mockReduced = true;
    const timing = jest.spyOn(Animated, 'timing');
    await render(<TabCapsule selected={false} radius={20} />);
    await act(async () => tree.update(<TabCapsule selected radius={20} />));
    expect(timing).not.toHaveBeenCalled();
    expect(flat(byId('tab-capsule')).opacity).toBe(1);
    await act(async () => tree.update(<TabCapsule selected={false} radius={20} />));
    expect(flat(byId('tab-capsule')).opacity).toBe(0);
  });
});

describe('the icon of a tab', () => {
  it('keeps one original illustration readable at rest and after selection', async () => {
    await render(<TabGlyph kind="home" selected={false} />);
    expect(pictures()).toHaveLength(1);
    const picture = pictures()[0];
    expect(picture.props).toMatchObject({ kind: 'home', size: TAB_ICON, cut: 'art' });
    expect(picture.props.muted).toBeUndefined();
    expect(picture.props.tone).toBeUndefined();
    expect(flat(byId('tab-glyph')).opacity).toBeUndefined();
    await act(async () => tree.update(<TabGlyph kind="home" selected />));
    expect(pictures()).toEqual([picture]);
    expect(flat(byId('tab-glyph')).opacity).toBeUndefined();
  });

  it('pops once, 1.0 to 1.04 to 1, on the native driver only on selection', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const sequence = jest.spyOn(Animated, 'sequence');
    await render(<TabGlyph kind="agreements" selected={false} />);
    expect(timing).not.toHaveBeenCalled();
    expect(sequence).not.toHaveBeenCalled();
    await act(async () => tree.update(<TabGlyph kind="agreements" selected />));
    const calls = timing.mock.calls.map(([, config]) => config as { toValue: number; duration: number; useNativeDriver: boolean; easing: unknown });
    expect(calls.map(call => [call.toValue, call.duration])).toEqual([[TAB_POP, sys.motion.press], [1, sys.motion.toggle]]);
    expect(sequence).toHaveBeenCalledTimes(1);
    expect(calls.every(call => call.useNativeDriver === true && typeof call.easing === 'function')).toBe(true);
    // The pop never goes under 1 and never overshoots the 4 %.
    expect(Math.max(...calls.map(call => call.toValue))).toBe(TAB_POP);
    expect(Math.min(...calls.map(call => call.toValue))).toBeGreaterThanOrEqual(1);
  });

  it('does not pop when it is deselected, nor when it is drawn already selected', async () => {
    const sequence = jest.spyOn(Animated, 'sequence');
    const timing = jest.spyOn(Animated, 'timing');
    await render(<TabGlyph kind="home" selected />);
    expect(sequence).not.toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();
    await act(async () => tree.update(<TabGlyph kind="home" selected={false} />));
    expect(sequence).not.toHaveBeenCalled();
    expect(timing.mock.calls.some(([, config]) => (config as { toValue: number }).toValue === TAB_POP)).toBe(false);
    expect(timing).not.toHaveBeenCalled();
  });

  it('under reduced motion swaps at once: nothing is animated', async () => {
    mockReduced = true;
    const timing = jest.spyOn(Animated, 'timing');
    const sequence = jest.spyOn(Animated, 'sequence');
    await render(<TabGlyph kind="home" selected={false} />);
    await act(async () => tree.update(<TabGlyph kind="home" selected />));
    expect(timing).not.toHaveBeenCalled();
    expect(sequence).not.toHaveBeenCalled();
    expect(pictures()).toHaveLength(1);
    expect(StyleSheet.flatten(byId('tab-glyph').props.style).transform).toEqual([{ scale: 1 }]);
  });
});

describe('the label of a tab', () => {
  it('uses the scalable navLabel role independently of content segments', async () => {
    await render(<TabLabel selected={false}>Zadaci</TabLabel>);
    const text = () => tree.root.findAllByType(Text)[0];
    expect(flat(text())).toMatchObject({ fontSize: sys.type.navLabel.fontSize, lineHeight: sys.type.navLabel.lineHeight, color: sys.navigation.muted, textAlign: 'center', marginTop: TAB_LABEL_GAP });
    // Persistent navigation uses the medium Inter face; content segments keep their own role.
    await act(async () => tree.update(<TabLabel selected>Zadaci</TabLabel>));
    expect(flat(text()).color).toBe(sys.navigation.foreground);
    // It is never shrunk or cut: the person's text size decides.
    expect(text().props.numberOfLines).toBeUndefined();
    expect(text().props.adjustsFontSizeToFit).toBeUndefined();
  });

  it('hands its measured lines on, so the bar can follow them', async () => {
    const seen = jest.fn();
    await render(<TabLabel selected={false} onTextLayout={seen}>Dogovori</TabLabel>);
    const text = tree.root.findAllByType(Text)[0];
    const event = { nativeEvent: { lines: [{ y: 0, height: 20 }] } };
    text.props.onTextLayout(event);
    expect(seen).toHaveBeenCalledWith(event);
  });
});

describe('the preview the design board draws', () => {
  const tabs = () => tree.root.findAll(node => node.type === (Press as unknown));
  const chosen = () => tabs().filter(tab => tab.props.accessibilityState.selected).map(tab => tab.props.accessibilityLabel);

  it('shows the available destinations and an initially selected accessible tab', async () => {
    await render(<TabBarPreview />);
    expect(tabs().map(tab => tab.props.accessibilityLabel)).toEqual(['Početna', 'Zadaci', 'Dogovori', 'Poruke']);
    expect(chosen()).toEqual(['Početna']);
    for (const tab of tabs()) {
      expect(tab.props).toMatchObject({ accessibilityRole: 'tab', haptic: 'none', scaleTo: 1, hitSlop: 0 });
      expect(tab.props.hapticOn).toBeUndefined();
    }
    expect(tabBarSurface).toMatchObject({ backgroundColor: sys.navigation.background, borderColor: sys.navigation.line, padding: TAB_BAR_PADDING });
  });

  it('moves the choice, the capsule and the icon together when a tab is tapped, and says so at once to a screen reader', async () => {
    await render(<TabBarPreview />);
    await act(async () => tabs()[1].props.onPress());
    expect(chosen()).toEqual(['Zadaci']);
    expect(tree.root.findAll(node => node.type === (TabCapsule as unknown)).map(node => node.props.selected)).toEqual([false, true, false, false]);
    expect(tree.root.findAll(node => node.type === (TabGlyph as unknown)).map(node => node.props.selected)).toEqual([false, true, false, false]);
    expect(tree.root.findAll(node => node.type === (TabLabel as unknown)).map(node => node.props.selected)).toEqual([false, true, false, false]);
    await act(async () => tabs()[2].props.onPress());
    expect(chosen()).toEqual(['Dogovori']);
  });
});

/** Protect the defect behind the former technology ban: no orphaned animation after replacement/unmount. */
describe('selection animation lifecycle', () => {
  it('stops replaced and unmounted selection work', async () => {
    const runs: { start: jest.Mock; stop: jest.Mock; reset: jest.Mock }[] = [];
    jest.spyOn(Animated, 'timing').mockImplementation(() => {
      const run = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() }; runs.push(run); return run;
    });
    await render(<TabCapsule selected={false} radius={20} />);
    await act(async () => tree.update(<TabCapsule selected radius={20} />));
    expect(runs[0].start).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<TabCapsule selected={false} radius={20} />));
    expect(runs[0].stop).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
    expect(runs[1].stop).toHaveBeenCalledTimes(1);
  });

  it('cancels an in-flight selection and pop when reduced motion changes live', async () => {
    const fade = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    const pop = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    jest.spyOn(Animated, 'timing').mockReturnValue(fade);
    jest.spyOn(Animated, 'sequence').mockReturnValue(pop);
    const content = (selected: boolean) => <><TabCapsule selected={selected} radius={20} /><TabGlyph kind="home" selected={selected} /></>;
    await render(content(false));
    await act(async () => tree.update(content(true)));
    expect(pop.start).toHaveBeenCalledTimes(1);
    mockReduced = true;
    await act(async () => tree.update(content(true)));
    expect(fade.stop).toHaveBeenCalled();
    expect(pop.stop).toHaveBeenCalledTimes(1);
    expect(flat(byId('tab-capsule')).opacity).toBe(1);
    expect(pictures()).toHaveLength(1);
    expect(flat(byId('tab-glyph')).transform).toEqual([{ scale: 1 }]);
  });
});
