import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));

import { FlowFooter } from '../FlowFooter';
import { layout, ruleWidth } from '../layout';
import { sys } from '../tokens';

/**
 * The pinned foot of a flow step (round 6): the step's one action on the surface under a line, at the screen gutter,
 * in the closure footer's measure. It trusts the screen's own safe area unless the screen asks it to keep the bottom edge.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const foot = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'flow-footer');

it('pins the action on the surface under a hairline, at the screen gutter, inside the screen\'s own safe area', async () => {
  await render(<FlowFooter><Text>Pošalji predlog izmene</Text></FlowFooter>);
  expect(foot()).toHaveLength(1);
  expect(foot()[0].type).toBe('View');
  expect(StyleSheet.flatten(foot()[0].props.style)).toMatchObject({ backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line,
    paddingHorizontal: sys.space.lg, paddingTop: sys.space.md, paddingBottom: sys.space.md, gap: sys.space.sm });
  expect(tree.root.findAllByType('SafeAreaView' as never)).toHaveLength(0);
  expect(foot()[0].findByType(Text).props.children).toBe('Pošalji predlog izmene');
});

it('keeps clear of the bottom edge itself only where the screen asks it to, with the same surface reaching the edge', async () => {
  await render(<FlowFooter edge="bottom"><Text>Pošalji predlog izmene</Text></FlowFooter>);
  expect(foot()).toHaveLength(1);
  expect(foot()[0].type).toBe('SafeAreaView');
  expect(foot()[0].props.edges).toEqual(['bottom']);
  expect(StyleSheet.flatten(foot()[0].props.style)).toMatchObject({ backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line });
});

// UI/UX pass 2026-10-08 (F8a): the measure every foot has, written with the names of the grid, and the reason line above the actions.
describe('the one measure of a foot: the screen\'s edge across, 12 over, 12 under, 8 between, and a 1 dp line above', () => {
  it('is 20 / 12 / 12 and 8, spelled with the grid: the gutter, and the one divider', async () => {
    await render(<FlowFooter><Text>Dalje</Text></FlowFooter>);
    expect(StyleSheet.flatten(foot()[0].props.style)).toMatchObject({ paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 12, gap: 8,
      borderTopWidth: ruleWidth, borderTopColor: sys.color.line });
    expect([layout.gutter, ruleWidth]).toEqual([20, 1]);
  });

  it('holds one green action and one quiet one, one under the other, as it was handed them', async () => {
    await render(<FlowFooter><Text>Pregledaj predlog</Text><Text>Nazad</Text></FlowFooter>);
    expect(foot()[0].findAllByType(Text).map(node => node.props.children)).toEqual(['Pregledaj predlog', 'Nazad']);
  });
});

describe('reason: why the green action cannot be pressed yet, in a quiet line above the actions', () => {
  const REASON = 'Izaberi dan i vreme da nastaviš.';
  const reasonLine = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'flow-footer-reason')[0];

  it('stands ABOVE the actions, in the `note` type in grey, and the actions follow in the order given', async () => {
    await render(<FlowFooter reason={REASON}><Text>Dalje</Text><Text>Nazad</Text></FlowFooter>);
    expect(foot()[0].findAllByType(Text).map(node => node.props.children)).toEqual([REASON, 'Dalje', 'Nazad']);
    expect(StyleSheet.flatten(reasonLine().props.style)).toMatchObject({ fontSize: sys.type.note.fontSize, lineHeight: sys.type.note.lineHeight, color: sys.color.muted });
  });

  it('is announced politely when it appears or changes, so the person hears what is still missing', async () => {
    await render(<FlowFooter reason={REASON}><Text>Dalje</Text></FlowFooter>);
    expect(reasonLine().props.accessibilityLiveRegion).toBe('polite');
  });

  it('is not drawn at all when nothing is missing: no empty line, and the foot is the same foot', async () => {
    await render(<FlowFooter><Text>Dalje</Text></FlowFooter>);
    expect(reasonLine()).toBeUndefined();
    await act(async () => tree.update(<FlowFooter reason=""><Text>Dalje</Text></FlowFooter>));
    expect(reasonLine()).toBeUndefined();
    expect(foot()[0].findAllByType(Text)).toHaveLength(1);
  });

  it('is wrapped, never cut: a long reason takes two lines and the foot grows', async () => {
    await render(<FlowFooter reason={`${REASON} ${REASON}`}><Text>Dalje</Text></FlowFooter>);
    expect(reasonLine().props.numberOfLines).toBeUndefined();
  });

  it('has the same measure with the bottom edge kept by the foot itself, and the reason is inside it', async () => {
    await render(<FlowFooter edge="bottom" reason={REASON}><Text>Dalje</Text></FlowFooter>);
    expect(foot()[0].type).toBe('SafeAreaView');
    expect(StyleSheet.flatten(foot()[0].props.style)).toMatchObject({ paddingHorizontal: layout.gutter, gap: sys.space.sm });
    expect(foot()[0].findAllByType(Text).map(node => node.props.children)).toEqual([REASON, 'Dalje']);
  });

  it('takes its test id from the foot\'s, so two feet on one screen can be told apart', async () => {
    await render(<FlowFooter testID="korak-2" reason={REASON}><Text>Dalje</Text></FlowFooter>);
    expect(tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'korak-2-reason')).toHaveLength(1);
  });
});
