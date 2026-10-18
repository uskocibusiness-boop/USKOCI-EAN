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
import { layout } from '../layout';
import { Section } from '../Section';
import { sys } from '../tokens';

/**
 * A part of a screen with a name (composition spec 2026-10-07, N2): the `heading` title in ink, spoken as a heading, 12 dp above
 * what it holds, an optional action at the end of the title's line with a 48 dp touch, and no line, no box and no margin of its
 * own. The space between sections is the screen's.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); mockStacked = false; jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const texts = () => tree.root.findAllByType(Text);
const title = (text: string) => texts().find(node => node.props.children === text)!;
const root = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'section')[0];
/** The nearest drawn view above a node: its parent in the test tree is a component, not a view. */
const hostAbove = (node: ReactTestInstance) => { let up = node.parent; while (up && typeof up.type !== 'string') up = up.parent; return up!; };
/** The line of the title: the view that holds the heading. */
const head = () => hostAbove(title('Raspored'));

describe('the title', () => {
  it('is the heading type in ink and is spoken as a heading, and wraps rather than being cut', async () => {
    await render(<Section title="Raspored" testID="section"><Text>sadržaj</Text></Section>);
    expect(title('Raspored').props.accessibilityRole).toBe('header');
    expect(flat(title('Raspored'))).toMatchObject({ fontSize: sys.type.heading.fontSize, lineHeight: sys.type.heading.lineHeight,
      fontFamily: INTER_FACES[600], color: sys.color.ink });
    expect(title('Raspored').props.numberOfLines).toBeUndefined();
  });

  it('separates the heading using shared spacing and preserves content order', async () => {
    await render(<Section title="Raspored" testID="section"><Text>prvo</Text><Text>drugo</Text></Section>);
    expect(flat(head()).marginBottom).toBe(layout.group);
    expect(layout.group).toBeGreaterThanOrEqual(0);
    expect(texts().map(node => node.props.children)).toEqual(['Raspored', 'prvo', 'drugo']);
  });

  it('is optional: a section without one draws no header and no line of its own, only what it holds', async () => {
    await render(<Section testID="section"><Text>sadržaj</Text></Section>);
    expect(tree.root.findAll(node => node.props.accessibilityRole === 'header')).toHaveLength(0);
    expect(texts().map(node => node.props.children)).toEqual(['sadržaj']);
  });
});

describe('a passive section groups content without creating an action', () => {
  it('keeps the heading and content accessible without a phantom command', async () => {
    await render(<Section title="Raspored" testID="section"><Text>sadržaj</Text></Section>);
    expect(texts().map(node => node.props.children)).toEqual(['Raspored', 'sadržaj']);
    expect(title('Raspored').props.accessibilityRole).toBe('header');
    expect(tree.root.findAllByType(Press)).toHaveLength(0);
  });
});

describe('the action: a word at the end of the title\'s line, 15/600 in green, a 48 dp touch', () => {
  const action = { label: 'Ceo raspored', onPress: jest.fn() };

  it('is a button with the word as its name, which runs the caller\'s command and ticks a selection', async () => {
    action.onPress.mockClear();
    await render(<Section title="Raspored" action={action} testID="section"><Text>sadržaj</Text></Section>);
    const press = tree.root.findByType(Press);
    expect(press.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Ceo raspored', haptic: 'select' });
    await act(async () => press.props.onPress());
    expect(action.onPress).toHaveBeenCalledTimes(1);
  });

  it('takes the caller\'s spoken name and test id, so "Ceo raspored" can say more', async () => {
    await render(<Section title="Raspored" action={{ ...action, accessibilityLabel: 'Otvori ceo raspored', testID: 'ceo' }}><Text>x</Text></Section>);
    const press = tree.root.findByType(Press);
    expect(press.props).toMatchObject({ accessibilityLabel: 'Otvori ceo raspored', testID: 'ceo' });
  });

  it('keeps the action label readable through the shared text role', async () => {
    await render(<Section title="Raspored" action={action}><Text>sadržaj</Text></Section>);
    expect(flat(title('Ceo raspored'))).toMatchObject({ fontSize: sys.type.copy.fontSize, lineHeight: sys.type.copy.lineHeight });
    expect(tree.root.findByType(Press).props.accessibilityLabel).toBe('Ceo raspored');
  });

  it('is a touch of 48 dp, and the line it stands in is 48 high: the title is centred in it', async () => {
    await render(<Section title="Raspored" action={action}><Text>sadržaj</Text></Section>);
    expect(flat(tree.root.findByType(Press))).toMatchObject({ minHeight: layout.touch, minWidth: layout.touch });
    expect(layout.touch).toBeGreaterThanOrEqual(48);
    expect(flat(head())).toMatchObject({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: layout.touch });
  });

  it('adding an action preserves the heading and content rather than replacing them', async () => {
    await render(<Section title="Raspored" action={action} testID="section"><Text>sadržaj</Text></Section>);
    expect(texts().map(node => node.props.children)).toEqual(['Raspored', 'Ceo raspored', 'sadržaj']);
    expect(title('Raspored').props.accessibilityRole).toBe('header');
  });

  it('can stand alone, without a title, at the end of its line', async () => {
    await render(<Section action={action}><Text>sadržaj</Text></Section>);
    expect(tree.root.findAll(node => node.props.accessibilityRole === 'header')).toHaveLength(0);
    expect(flat(hostAbove(tree.root.findByType(Press)))).toMatchObject({ justifyContent: 'flex-end' });
  });
});

describe('at a large text size the action goes under the title instead of crushing it, and nothing is pulled up', () => {
  it('stacks the title and the action and starts both at the same edge', async () => {
    mockStacked = true;
    await render(<Section title="Važno za ovaj zadatak" action={{ label: 'Uredi', onPress: jest.fn() }} testID="section"><Text>sadržaj</Text></Section>);
    const line = hostAbove(title('Važno za ovaj zadatak'));
    expect(flat(line)).toMatchObject({ flexDirection: 'column', alignItems: 'flex-start' });
    expect(flat(tree.root.findByType(Press))).toMatchObject({ alignItems: 'flex-start', minHeight: layout.touch });
    expect(flat(root()).marginTop).toBeUndefined();
    expect(title('Važno za ovaj zadatak').props.numberOfLines).toBeUndefined();
  });
});
