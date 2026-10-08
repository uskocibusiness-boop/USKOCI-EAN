import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ScrolledBar, useScrolledUnderBar } from '../ScrolledBar';
import { ruleWidth } from '../../system/layout';
import { sys } from '../../system/tokens';

/**
 * The bar of a screen whose content scrolls (owner's phone, 8 Oct 2026, Podrška and Novi zahtev): a row cut off by the bar with nothing to say why.
 * Once the content has moved under it the bar stands on its line. The line is the system's one divider, a drawn view of `ruleWidth`, not an edge border
 * (`rule-width-ratchet`), and it is there at rest in the ground's own colour, so the bar never changes height when it appears.
 */
let tree: ReactTestRenderer, latest: ReturnType<typeof useScrolledUnderBar>, renders = 0;
function Probe() {
  latest = useScrolledUnderBar(); renders++;
  return <ScrolledBar scrolled={latest.scrolled}><Text>Podrška</Text></ScrolledBar>;
}
const event = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y } } }) as never;
const line = () => StyleSheet.flatten(tree.root.findByProps({ testID: 'settings-bar-line' }).props.style);
const bar = () => StyleSheet.flatten(tree.root.findByProps({ testID: 'settings-bar' }).props.style);
beforeEach(async () => { renders = 0; await act(async () => { tree = create(<Probe />); }); });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('stands on the ground with the line in the ground\'s own colour at rest, 1 dp high, so nothing changes height when it appears', () => {
  expect(bar().backgroundColor).toBe(sys.color.ground);
  expect(line()).toMatchObject({ height: ruleWidth, backgroundColor: sys.color.ground, position: 'absolute', bottom: 0, left: 0, right: 0 });
  expect(ruleWidth).toBe(1);
});

it('draws the line once the content has moved under the bar, and takes it away at the top again', async () => {
  await act(async () => latest.onScroll(event(0.5)));
  expect(line().backgroundColor).toBe(sys.color.line);
  await act(async () => latest.onScroll(event(0)));
  expect(line().backgroundColor).toBe(sys.color.ground);
  await act(async () => latest.onScroll(event(-12)));   // the pull past the top is not a scroll under the bar
  expect(line().backgroundColor).toBe(sys.color.ground);
});

it('draws the screen again only when the content crosses its first dp, not on every frame of a scroll', async () => {
  const before = renders;
  await act(async () => latest.onScroll(event(10)));
  const crossed = renders;
  expect(crossed).toBeGreaterThan(before);
  for (const y of [40, 80, 160, 320]) await act(async () => latest.onScroll(event(y)));
  // React may render a component once more before it bails out of a same-value update; four frames of scrolling are not four renders.
  expect(renders - crossed).toBeLessThanOrEqual(1);
});

it('draws its line as a view and takes no part of the screen\'s touches; the bar has no edge border', () => {
  expect(tree.root.findByProps({ testID: 'settings-bar-line' }).props.pointerEvents).toBe('none');
  expect(bar()).not.toHaveProperty('borderBottomWidth'); expect(bar()).not.toHaveProperty('borderTopWidth');
  expect(line()).not.toHaveProperty('borderBottomWidth');
});
