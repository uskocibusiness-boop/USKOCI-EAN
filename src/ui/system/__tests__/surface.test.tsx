import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));

import { Press } from '../../Press';
import { layout, ruleWidth } from '../layout';
import { Surface, speaks, surfaceWarnings, type SurfaceKind } from '../Surface';
import { cardCompact, floating, inset, raisedItem, sys } from '../tokens';

/**
 * The one container (composition spec 2026-10-07, N6): four kinds, and what each one means. A shadow means "touch me", so only
 * a record has one and only a record is pressed; a panel is a frame for something that is read; a float lies over something; a
 * note is a tint and not a card. A Surface inside a Surface is told off in development builds, never under Jest.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const host = (testID: string) => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === testID)[0];
const SHADOWS = ['boxShadow', 'elevation', 'shadowColor', 'shadowOpacity', 'shadowRadius', 'shadowOffset'] as const;

describe('record: a thing that is touched', () => {
  it('is white with the shadow of a raised item, 24 corners and 16 padding', async () => {
    await render(<Surface kind="record" testID="s"><Text>Prenos ormana</Text></Surface>);
    expect(flat(host('s'))).toMatchObject({ ...raisedItem, borderRadius: sys.radius.card, padding: layout.card });
    expect(flat(host('s')).backgroundColor).toBe(sys.color.surface);
    // The shadow is the whole point of a record: one of the two forms of `raisedItem` is there.
    expect(SHADOWS.some(key => flat(host('s'))[key] !== undefined)).toBe(true);
  });

  it('with onPress is one button for the whole card, that gives on the row rung and says its label and hint', async () => {
    const onPress = jest.fn();
    await render(<Surface kind="record" testID="s" onPress={onPress} accessibilityLabel="Prenos ormana, 5.500 RSD" accessibilityHint="Otvara zadatak">
      <Text>Prenos ormana</Text></Surface>);
    const press = tree.root.findByType(Press);
    expect(press.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Prenos ormana, 5.500 RSD',
      accessibilityHint: 'Otvara zadatak', scaleTo: sys.motion.scale.row, haptic: 'select' });
    expect(flat(host('s'))).toMatchObject({ borderRadius: sys.radius.card, padding: layout.card });
    await act(async () => press.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('without onPress is a plain view: nothing is pressed, and nothing is said unless the caller labels it', async () => {
    await render(<Surface kind="record" testID="s"><Text>Prenos ormana</Text></Surface>);
    expect(tree.root.findAllByType(Press)).toHaveLength(0);
    expect(host('s').props.accessible).toBeUndefined();
    await act(async () => tree.update(<Surface kind="record" testID="s" accessibilityLabel="Zapis"><Text>x</Text></Surface>));
    expect(host('s').props).toMatchObject({ accessible: true, accessibilityLabel: 'Zapis' });
  });

  it('keeps the caller\'s style last, so a card can be told its width or its margin', async () => {
    await render(<Surface kind="record" testID="s" style={{ width: 200 }}><Text>x</Text></Surface>);
    expect(flat(host('s'))).toMatchObject({ width: 200, padding: layout.card });
  });
});

describe('panel: a thing that is only read, with a frame and no shadow', () => {
  it('is the compact card: a 1 dp edge in cardLine, 24 corners, 16 padding, and no shadow of any kind', async () => {
    await render(<Surface kind="panel" testID="s"><Text>Izvoz podataka</Text></Surface>);
    expect(flat(host('s'))).toMatchObject({ ...cardCompact, borderWidth: 1, borderColor: sys.color.cardLine, borderRadius: sys.radius.card,
      padding: layout.card, backgroundColor: sys.color.surface });
    for (const key of SHADOWS) expect([key, flat(host('s'))[key]]).toEqual([key, undefined]);
  });
});

describe('float: what lies over something else', () => {
  it('is the floating lift with the 1 dp line, white, and takes its corner from the caller', async () => {
    await render(<Surface kind="float" testID="s" style={{ borderRadius: sys.radius.pill }}><Text>Pretraga</Text></Surface>);
    expect(flat(host('s'))).toMatchObject({ ...floating, backgroundColor: sys.color.surface, borderWidth: ruleWidth, borderColor: sys.color.line,
      borderRadius: sys.radius.pill });
    expect(ruleWidth).toBe(1);
  });

  it('has a corner of its own when the caller names none', async () => {
    await render(<Surface kind="float" testID="s"><Text>Pretraga</Text></Surface>);
    expect(flat(host('s')).borderRadius).toBe(sys.radius.card);
  });
});

describe('note: a sentence that has to stand out, as a tint and not a card', () => {
  it.each([['wash', sys.color.wash], ['warn', sys.color.warnSoft], ['danger', sys.color.dangerSoft]] as const)('tone %s is the tint %s, flat: no edge, no shadow', async (tone, tint) => {
    await render(<Surface kind="note" tone={tone} testID="s"><Text>Ovo se čuva privatno.</Text></Surface>);
    expect(flat(host('s'))).toMatchObject({ backgroundColor: tint, borderRadius: inset.borderRadius });
    for (const key of ['borderWidth', ...SHADOWS]) expect([key, flat(host('s'))[key as keyof ReturnType<typeof flat>]]).toEqual([key, undefined]);
  });

  it('is a wash when no tone is given, and takes its padding from the scale (12 over and under, 16 across; `inset` pads 14)', async () => {
    await render(<Surface kind="note" testID="s"><Text>Ovo se čuva privatno.</Text></Surface>);
    expect(flat(host('s'))).toMatchObject({ backgroundColor: sys.color.wash, paddingVertical: sys.space.md, paddingHorizontal: sys.space.base });
  });

  it('the tone belongs to a note alone: a record stays white whatever it is told', async () => {
    await render(<Surface kind="record" tone="danger" testID="s"><Text>x</Text></Surface>);
    expect(flat(host('s')).backgroundColor).toBe(sys.color.surface);
  });
});

describe('only a record is pressed', () => {
  it.each(['panel', 'float', 'note'] as const)('a %s ignores onPress: it is read, not touched', async kind => {
    const onPress = jest.fn();
    await render(<Surface kind={kind} testID="s" onPress={onPress}><Text>x</Text></Surface>);
    expect(tree.root.findAllByType(Press)).toHaveLength(0);
    expect(host('s').props.onPress).toBeUndefined();
    expect(surfaceWarnings({ kind, enclosing: null, pressed: true })).toEqual([`Surface: onPress is ignored on a ${kind}; only a record is touched.`]);
  });
});

describe('a Surface inside a Surface is told off, in development builds only', () => {
  const kinds: SurfaceKind[] = ['record', 'panel', 'float', 'note'];

  it('says so for a card inside a card, in every pairing, and names both', () => {
    for (const outer of kinds) for (const inner of ['record', 'panel', 'float'] as const) {
      const [message] = surfaceWarnings({ kind: inner, enclosing: outer, pressed: false });
      expect(message).toBe(`Surface: a ${inner} stands inside a ${outer}. A card is never inside a card: use a Section, a ListRow or a note.`);
    }
  });

  it('says nothing for the first Surface, and nothing for a note: a tint may stand in a card', () => {
    for (const kind of kinds) expect(surfaceWarnings({ kind, enclosing: null, pressed: false })).toEqual([]);
    for (const outer of kinds) expect(surfaceWarnings({ kind: 'note', enclosing: outer, pressed: false })).toEqual([]);
  });

  it('is spoken in a development build and in no other, and never under Jest (which has __DEV__ on too)', () => {
    expect(speaks({ dev: true, test: false })).toBe(true);
    expect(speaks({ dev: true, test: true })).toBe(false);
    expect(speaks({ dev: false, test: false })).toBe(false);
    expect(speaks({ dev: false, test: true })).toBe(false);
  });

  it('prints nothing under Jest, though __DEV__ is on here: the nesting is drawn and nobody is told', async () => {
    expect(__DEV__).toBe(true);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await render(<Surface kind="record" testID="outer"><Surface kind="panel" testID="inner"><Text>x</Text></Surface></Surface>);
    expect(host('outer')).toBeDefined(); expect(host('inner')).toBeDefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('prints it once, with both names, when the build is a development build outside Jest', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { NODE_ENV, JEST_WORKER_ID } = process.env;
    delete process.env.JEST_WORKER_ID; (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    try {
      await render(<Surface kind="record" testID="outer"><Surface kind="panel" testID="inner"><Text>x</Text></Surface></Surface>);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = NODE_ENV; process.env.JEST_WORKER_ID = JEST_WORKER_ID;
    }
    expect(warn.mock.calls.map(call => call[0])).toEqual(['Surface: a panel stands inside a record. A card is never inside a card: use a Section, a ListRow or a note.']);
  });
});
