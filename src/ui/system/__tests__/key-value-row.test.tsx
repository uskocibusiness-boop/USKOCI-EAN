import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
let mockStacked = false;
jest.mock('../textScale', () => ({ ...jest.requireActual('../textScale'),
  useLayoutClass: () => mockStacked ? { cls: 'large', stacked: true } : { cls: 'compact', stacked: false } }));

import { INTER_FACES } from '../../interFont';
import { Press } from '../../Press';
import { layout, ruleWidth } from '../layout';
import { KeyValueRow, LONG_VALUE } from '../KeyValueRow';
import { sys } from '../tokens';

/**
 * A label and its value, as a row (composition spec 2026-10-07, N5): the label small and grey at the start, the value in the body
 * type at the end, 12 dp above and below, a 1 dp divider from the left edge except under the last row; at a large text size the
 * value goes under the label.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); mockStacked = false; jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const texts = () => tree.root.findAllByType(Text);
const word = (text: string) => texts().find(node => node.props.children === text)!;
const hosts = () => tree.root.findAll(node => typeof node.type === 'string');
const row = () => hosts().find(node => node.props.testID === 'kv')!;
const divider = () => hosts().filter(node => flat(node).height === ruleWidth && flat(node).position === 'absolute');
/** The nearest drawn view above a node: its parent in the test tree is a component, not a view. */
const hostAbove = (node: ReactTestInstance) => { let up = node.parent; while (up && typeof up.type !== 'string') up = up.parent; return up!; };

describe('what it says', () => {
  it('draws the label in `meta`, grey, and the value in `body`, in ink', async () => {
    await render(<KeyValueRow label="Termin" value="26. sep · 17:00–19:00" testID="kv" />);
    expect(flat(word('Termin'))).toMatchObject({ fontSize: sys.type.meta.fontSize, lineHeight: sys.type.meta.lineHeight, color: sys.color.muted });
    expect(flat(word('26. sep · 17:00–19:00'))).toMatchObject({ fontSize: 16, lineHeight: 24, color: sys.color.ink, fontFamily: INTER_FACES[400] });
  });

  it('draws the one amount of a screen in the `priceLarge` type with `emphasis="price"`', async () => {
    await render(<KeyValueRow label="Dogovoreno ukupno" value="5.500 RSD" emphasis="price" testID="kv" />);
    expect(flat(word('5.500 RSD'))).toMatchObject({ fontSize: sys.type.priceLarge.fontSize, lineHeight: sys.type.priceLarge.lineHeight });
    expect(sys.type.priceLarge).toMatchObject({ fontSize: 24, lineHeight: 30 });
  });

  it('draws a node as it was given, at the end of the line', async () => {
    await render(<KeyValueRow label="Stanje" value={<View testID="chip" />} testID="kv" />);
    expect(hosts().filter(node => node.props.testID === 'chip')).toHaveLength(1);
    // A row that ends at the right edge, so a node that places itself (a chip is `alignSelf: 'flex-start'`) still ends there.
    expect(flat(hostAbove(hosts().find(node => node.props.testID === 'chip')!))).toMatchObject({ flexDirection: 'row', justifyContent: 'flex-end', flex: 1 });
  });

  it('wraps a long label and a long value: nothing is cut with an ellipsis', async () => {
    const long = 'Prenos starog trokrilnog ormara iz stana na petom spratu bez lifta do kombija parkiranog u dvorištu';
    await render(<KeyValueRow label={long} value={long} action={{ label: 'Izmeni', onPress: () => undefined }} />);
    for (const node of texts()) expect([node.props.children, node.props.numberOfLines]).toEqual([node.props.children, undefined]);
  });
});

describe('the measure of a row', () => {
  it('is 12 above and under, 12 between the label and the value, and never under 48 dp, with the value at the end of the line', async () => {
    await render(<KeyValueRow label="Termin" value="26. sep" testID="kv" />);
    const pair = hostAbove(word('Termin'));
    expect(flat(pair)).toMatchObject({ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: sys.space.md, gap: sys.space.md, flex: 1 });
    expect(flat(row())).toMatchObject({ minHeight: layout.touch, flexDirection: 'row' });
    expect(flat(word('26. sep'))).toMatchObject({ textAlign: 'right', flex: 1 });
  });

  it('lets the label take at most 45 % and wrap, so a long label never leaves the value no room', async () => {
    await render(<KeyValueRow label="Dogovoreno ukupno" value="5.500 RSD" testID="kv" />);
    expect(flat(word('Dogovoreno ukupno'))).toMatchObject({ flexShrink: 1, maxWidth: '45%' });
  });
});

describe('the divider', () => {
  it('is 1 dp in `line`, from the left edge (the label starts there) to the right, and does not take the touch', async () => {
    await render(<KeyValueRow label="Termin" value="26. sep" testID="kv" />);
    expect(divider()).toHaveLength(1);
    expect(flat(divider()[0])).toMatchObject({ left: 0, right: 0, bottom: 0, height: 1, backgroundColor: sys.color.line });
    expect(divider()[0].props.pointerEvents).toBe('none');
  });

  it('is not drawn under the last row of a group, and the row has no border of its own', async () => {
    await render(<KeyValueRow label="Obim" value="Prenos ormana" last testID="kv" />);
    expect(divider()).toHaveLength(0);
    for (const node of hosts()) for (const key of ['borderBottomWidth', 'borderTopWidth', 'borderWidth']) expect([key, flat(node)[key as 'borderWidth']]).toEqual([key, undefined]);
  });
});

describe('the action: "Izmeni", 15/600 in green, a 48 dp touch', () => {
  const action = { label: 'Izmeni', onPress: jest.fn() };

  it('is a button named with the label it belongs to, which runs the caller\'s command', async () => {
    action.onPress.mockClear();
    await render(<KeyValueRow label="Termin" value="26. sep" action={action} testID="kv" />);
    const press = tree.root.findByType(Press);
    expect(press.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Izmeni, Termin', haptic: 'select' });
    await act(async () => press.props.onPress());
    expect(action.onPress).toHaveBeenCalledTimes(1);
  });

  it('is written 15/600 in green and is a touch of 48 dp that fits the row, which is 48 high', async () => {
    await render(<KeyValueRow label="Termin" value="26. sep" action={action} testID="kv" />);
    expect(flat(word('Izmeni'))).toMatchObject({ fontSize: 15, lineHeight: 22, color: sys.color.green, fontFamily: INTER_FACES[600] });
    expect(flat(tree.root.findByType(Press))).toMatchObject({ minHeight: layout.touch, minWidth: layout.touch });
    expect(flat(row()).minHeight).toBe(layout.touch);
  });

  it('stands after the value, not inside the sentence a screen reader says for the label and the value', async () => {
    await render(<KeyValueRow label="Termin" value="26. sep" action={action} testID="kv" />);
    const pair = hostAbove(word('Termin'));
    expect(pair.findAllByType(Press as never)).toHaveLength(0);
    expect(pair.props).toMatchObject({ accessible: true, accessibilityLabel: 'Termin: 26. sep' });
  });
});

describe('for a screen reader', () => {
  it('reads a string value together with its label as one sentence, and a node as it is', async () => {
    await render(<KeyValueRow label="Termin" value="26. sep" testID="kv" />);
    const pair = hostAbove(word('Termin'));
    expect(pair.props).toMatchObject({ accessible: true, accessibilityRole: 'text', accessibilityLabel: 'Termin: 26. sep' });
    await act(async () => tree.update(<KeyValueRow label="Stanje" value={<View testID="chip" />} testID="kv" />));
    const group = hostAbove(word('Stanje'));
    expect(group.props.accessible).toBeUndefined();
    expect(group.props.accessibilityLabel).toBeUndefined();
  });
});

describe('at a large text size the value goes under the label, and the action under the value', () => {
  it('stacks them in one column that starts at one edge, with no right alignment and no share of the width', async () => {
    mockStacked = true;
    await render(<KeyValueRow label="Termin" value="26. sep · 17:00–19:00" action={{ label: 'Izmeni', onPress: jest.fn() }} testID="kv" />);
    expect(flat(row())).toMatchObject({ flexDirection: 'column', alignItems: 'stretch' });
    const pair = hostAbove(word('Termin'));
    expect(flat(pair)).toMatchObject({ flexDirection: 'column', alignItems: 'flex-start', paddingVertical: sys.space.md });
    expect(flat(word('Termin')).maxWidth).toBeUndefined();
    expect(flat(word('26. sep · 17:00–19:00')).textAlign).toBeUndefined();
    expect(flat(tree.root.findByType(Press))).toMatchObject({ alignSelf: 'flex-start', minHeight: layout.touch });
    // The label is first, then the value, then the action.
    expect(texts().map(node => node.props.children)).toEqual(['Termin', '26. sep · 17:00–19:00', 'Izmeni']);
  });
});

describe('a long value reads under its label, from the left, at any text size', () => {
  const PARAGRAPH = 'Prenos ormana u dva dela sa trećeg sprata do kombija ispred ulaza, bez lifta, uz zaštitu stepeništa i vrata';

  it('is more than 40 characters: the scope of a task is a paragraph, not a figure', async () => {
    expect(LONG_VALUE).toBe(40);
    expect(PARAGRAPH.length).toBeGreaterThan(LONG_VALUE);
    await render(<KeyValueRow label="Obim" value={PARAGRAPH} testID="kv" />);
    expect(flat(hostAbove(word('Obim')))).toMatchObject({ flexDirection: 'column', alignItems: 'flex-start' });
    expect(flat(word(PARAGRAPH)).textAlign).toBeUndefined();
    expect(flat(word('Obim')).maxWidth).toBeUndefined();
    expect(texts().map(node => node.props.children)).toEqual(['Obim', PARAGRAPH]);
  });

  it('keeps a value of 40 characters or fewer on the line, at the end, as a figure', async () => {
    const edge = 'x'.repeat(LONG_VALUE);
    await render(<KeyValueRow label="Termin" value={edge} testID="kv" />);
    expect(flat(hostAbove(word('Termin'))).flexDirection).toBe('row');
    expect(flat(word(edge)).textAlign).toBe('right');
  });

  it('never stacks a node by its length: a node is drawn as given', async () => {
    await render(<KeyValueRow label="Stanje" value={<View testID="chip" />} testID="kv" />);
    expect(flat(hostAbove(word('Stanje'))).flexDirection).toBe('row');
  });

  it('puts the action under the long value, with the same 48 dp touch', async () => {
    await render(<KeyValueRow label="Obim" value={PARAGRAPH} action={{ label: 'Izmeni', onPress: () => undefined }} testID="kv" />);
    expect(flat(row())).toMatchObject({ flexDirection: 'column', alignItems: 'stretch' });
    expect(flat(tree.root.findByType(Press))).toMatchObject({ alignSelf: 'flex-start', minHeight: layout.touch });
    expect(texts().map(node => node.props.children)).toEqual(['Obim', PARAGRAPH, 'Izmeni']);
  });
});
