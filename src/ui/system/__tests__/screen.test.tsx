import React from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));

import { layout } from '../layout';
import { Screen } from '../Screen';
import { sys } from '../tokens';

/** Shared screen behavior: safe areas, readable column, keyboard, scroll and caller-owned content. */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance | undefined) => StyleSheet.flatten(node?.props.style) ?? {};
const safe = () => tree.root.findByType('SafeAreaView' as never);
const scroller = () => tree.root.findByType(ScrollView);
const content = () => StyleSheet.flatten(scroller().props.contentContainerStyle) ?? {};
/** The nearest drawn view above a node: its parent in the test tree is a component, not a view. */
const hostAbove = (node: ReactTestInstance) => { let up = node.parent; while (up && typeof up.type !== 'string') up = up.parent; return up!; };
const bar = <Text testID="bar">traka</Text>;
const foot = <View testID="foot"><Text>podnožje</Text></View>;
/** The order the parts stand in, top to bottom, by the test ids they carry. */
const order = () => tree.root.findAll(node => typeof node.type === 'string' && ['bar', 'scroll-body', 'foot'].includes(node.props.testID)).map(node => node.props.testID);

describe('the safe area', () => {
  it('a tab has the tab bar under it, so it keeps clear of the top and the sides only', async () => {
    await render(<Screen kind="root">x</Screen>);
    expect(safe().props.edges).toEqual(['top', 'left', 'right']);
  });

  it.each(['detail', 'flow'] as const)('a %s is the last thing before the system\'s bottom, so it keeps clear of every edge', async kind => {
    await render(<Screen kind={kind}>x</Screen>);
    expect(safe().props.edges).toEqual(['top', 'bottom', 'left', 'right']);
  });

  it('is white and fills the room, and carries the test id', async () => {
    await render(<Screen kind="detail" testID="screen">x</Screen>);
    expect(flat(safe())).toMatchObject({ flex: 1, backgroundColor: sys.color.ground });
    expect(safe().props.testID).toBe('screen');
  });
});

describe('the measure of the content', () => {
  it('uses shared content spacing', async () => {
    await render(<Screen kind="detail"><Text>prvo</Text><Text>drugo</Text></Screen>);
    expect(content()).toMatchObject({ paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, gap: layout.section, paddingBottom: layout.zone });
  });

  it('uses the shared footer spacing', async () => {
    await render(<Screen kind="flow" footer={foot}><Text>prvo</Text></Screen>);
    expect(content().paddingBottom).toBe(layout.section);
  });

  it('bounds and centers the reading column on wide screens', async () => {
    await render(<Screen kind="detail"><Text>x</Text></Screen>);
    expect(content()).toMatchObject({ width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' });
    expect(Number.isFinite(layout.maxWidth)).toBe(true);
    expect(layout.maxWidth).toBeGreaterThan(0);
  });

  it('takes the caller\'s own style last, for the rare exception', async () => {
    await render(<Screen kind="detail" contentStyle={{ paddingTop: 0, backgroundColor: 'transparent' }}><Text>x</Text></Screen>);
    expect(content()).toMatchObject({ paddingTop: 0, paddingHorizontal: layout.gutter, gap: layout.section });
  });


});

describe('the bar and the foot are handed in, and placed', () => {
  it('puts the bar above the scroll and the foot below it, inside the same frame', async () => {
    await render(<Screen kind="flow" header={bar} footer={foot}><View testID="scroll-body" /></Screen>);
    expect(order()).toEqual(['bar', 'scroll-body', 'foot']);
  });

  it('draws what is handed in and nothing in its place: no bar, no foot when there are none', async () => {
    await render(<Screen kind="root"><View testID="scroll-body" /></Screen>);
    expect(order()).toEqual(['scroll-body']);
  });

  it('keeps the foot to the same reading column as the content', async () => {
    await render(<Screen kind="flow" footer={foot}><Text>x</Text></Screen>);
    const wrapper = hostAbove(tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'foot')[0]);
    expect(flat(wrapper)).toMatchObject({ width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' });
  });

  it('hands the scroll position to the bar through onScroll, at 16 ms, so the title can appear once the large one has gone', async () => {
    const onScroll = jest.fn();
    await render(<Screen kind="detail" onScroll={onScroll}><Text>x</Text></Screen>);
    expect(scroller().props).toMatchObject({ onScroll, scrollEventThrottle: 16 });
    await act(async () => tree.update(<Screen kind="detail"><Text>x</Text></Screen>));
    expect(scroller().props.scrollEventThrottle).toBeUndefined();
  });

  it('hands the refresh control through, and keeps taps working while a field is focused', async () => {
    const refresh = <View testID="refresh" />;
    await render(<Screen kind="root" refreshControl={refresh}><Text>x</Text></Screen>);
    expect(scroller().props.refreshControl).toBe(refresh);
    expect(scroller().props.keyboardShouldPersistTaps).toBe('handled');
  });
});

describe('scroll', () => {
  it('scrolls by default', async () => {
    await render(<Screen kind="root"><Text>x</Text></Screen>);
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
  });

  it('is a plain column that fills the room with `scroll={false}`, with the same measure', async () => {
    await render(<Screen kind="detail" scroll={false} footer={foot}><View testID="fill" /></Screen>);
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
    const column = hostAbove(tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'fill')[0]);
    expect(flat(column)).toMatchObject({ flex: 1, paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, gap: layout.section,
      paddingBottom: layout.section, maxWidth: layout.maxWidth, alignSelf: 'center' });
  });
});

describe('the keyboard', () => {
  it('lifts a flow, so its foot rises with the keyboard, and nothing else by default', async () => {
    await render(<Screen kind="flow" footer={foot}><Text>x</Text></Screen>);
    expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(1);
    for (const kind of ['root', 'detail'] as const) {
      await act(async () => tree.update(<Screen kind={kind} footer={foot}><Text>x</Text></Screen>));
      expect([kind, tree.root.findAllByType(KeyboardAvoidingView).length]).toEqual([kind, 0]);
    }
  });

  it('can be told either way, whatever the kind', async () => {
    await render(<Screen kind="detail" keyboardAvoiding footer={foot}><Text>x</Text></Screen>);
    expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(1);
    await act(async () => tree.update(<Screen kind="flow" keyboardAvoiding={false} footer={foot}><Text>x</Text></Screen>));
    expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(0);
  });

  it('keeps the foot inside the keyboard avoidance and under the scroll, so it rises with the field it belongs to', async () => {
    await render(<Screen kind="flow" header={bar} footer={foot}><View testID="scroll-body" /></Screen>);
    const avoiding = tree.root.findByType(KeyboardAvoidingView);
    expect(avoiding.findAll(node => node.props.testID === 'foot').length).toBeGreaterThan(0);
    expect(avoiding.findAll(node => node.props.testID === 'bar')).toHaveLength(0);
  });
});
