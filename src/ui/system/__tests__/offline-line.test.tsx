import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
let mockStacked = false;
jest.mock('../textScale', () => ({ ...jest.requireActual('../textScale'),
  useLayoutClass: () => mockStacked ? { cls: 'large', stacked: true } : { cls: 'compact', stacked: false } }));

import { INTER_FACES } from '../../interFont';
import { Press } from '../../Press';
import { layout } from '../layout';
import { OfflineLine } from '../OfflineLine';
import { Surface } from '../Surface';
import { sys } from '../tokens';

/**
 * "Nema veze" as a line (R31; composition spec T7): a read failed because the phone is not connected, the screen keeps what it loaded
 * before, and one flat line under the bar says so, with the one word that reads again. It is not a screen and it is not a card.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); mockStacked = false; });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const texts = () => tree.root.findAllByType(Text).map(node => node.props.children).filter(child => typeof child === 'string');
const size = (nodes: readonly unknown[]) => nodes.length;

describe('what it says', () => {
  it('says the screen shows the last thing that was loaded, and offers the one word that reads again', async () => {
    const refresh = jest.fn();
    await render(<OfflineLine onRefresh={refresh} />);
    expect(texts()).toEqual(['Nema veze. Prikazano je poslednje učitano.', 'Osveži']);
    await act(async () => tree.root.findByType(Press).props.onPress());
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('says only "Nema veze." when there is nothing yet to show', async () => {
    await render(<OfflineLine hasLast={false} onRefresh={() => undefined} />);
    expect(texts()).toEqual(['Nema veze.', 'Osveži']);
  });

  it('only tells, with no word to press, when the screen cannot read again', async () => {
    await render(<OfflineLine />);
    expect(texts()).toEqual(['Nema veze. Prikazano je poslednje učitano.']);
    expect(size(tree.root.findAllByType(Press))).toBe(0);
  });
});

describe('what it is', () => {
  it('is a note: a flat tint, not a card and not a shadow, and not the state view', async () => {
    await render(<OfflineLine onRefresh={() => undefined} testID="strip" />);
    expect(tree.root.findByType(Surface).props).toMatchObject({ kind: 'note', testID: 'strip' });
    const style = flat(tree.root.findAll(node => typeof node.type === 'string')[0]);
    for (const key of ['boxShadow', 'elevation', 'borderWidth']) expect([key, style[key as 'borderWidth']]).toEqual([key, undefined]);
  });

  it('is as high as a touch and no higher: the sentence centres in the 48 dp that the word is', async () => {
    await render(<OfflineLine onRefresh={() => undefined} />);
    const line = tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityLiveRegion === 'polite')[0];
    expect(flat(line)).toMatchObject({ flexDirection: 'row', alignItems: 'center', minHeight: layout.touch });
    const word = tree.root.findByType(Press);
    expect(flat(word)).toMatchObject({ minWidth: layout.touch, minHeight: layout.touch });
    expect(word.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Osveži' });
  });

  it('asks for balanced lines, so a sentence of two lines is not a long one and a lonely word', async () => {
    await render(<OfflineLine onRefresh={() => undefined} />);
    expect(tree.root.findAll(node => node.type === Text && node.props.accessibilityRole === 'alert')[0].props.textBreakStrategy).toBe('balanced');
  });

  it('is announced as an alert, once, when it appears', async () => {
    await render(<OfflineLine onRefresh={() => undefined} />);
    expect(size(tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'alert'))).toBe(1);
    expect(size(tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityLiveRegion === 'polite'))).toBe(1);
  });

  it('writes the word in green, 15/600, and in grey while it reads', async () => {
    await render(<OfflineLine onRefresh={() => undefined} />);
    const word = tree.root.findAll(node => node.type === Text && node.props.children === 'Osveži')[0];
    expect(flat(word)).toMatchObject({ color: sys.color.green, fontSize: sys.type.copy.fontSize, fontFamily: INTER_FACES[600] });
    await act(async () => tree.update(<OfflineLine onRefresh={() => undefined} refreshing />));
    expect(flat(tree.root.findAll(node => node.type === Text && node.props.children === 'Osveži')[0]).color).toBe(sys.color.muted);
    expect(tree.root.findByType(Press).props).toMatchObject({ disabled: true, accessibilityState: { disabled: true }, haptic: 'none' });
  });
});

describe('at a large text size', () => {
  it('puts the word under the sentence instead of crushing it', async () => {
    mockStacked = true;
    await render(<OfflineLine onRefresh={() => undefined} />);
    const line = tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityLiveRegion === 'polite')[0];
    expect(flat(line)).toMatchObject({ flexDirection: 'column', alignItems: 'flex-start' });
    expect(flat(tree.root.findByType(Press)).alignItems).toBe('flex-start');
  });
});
