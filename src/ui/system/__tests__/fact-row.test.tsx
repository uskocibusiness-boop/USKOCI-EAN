import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { FactRow } from '../FactRow';
import { sys } from '../tokens';

/**
 * One fact of a thing, as a row (composition spec 2026-10-07, N4): the 2.5D picture at 28 dp (the owner asked for it back, 2026-10-08), 12 dp, the fact. In a record the fact is
 * the `note` type in the `fact` colour, on a detail screen the `body` type in ink; it wraps and is never cut with an ellipsis.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const texts = () => tree.root.findAllByType(Text);
const word = (text: string) => texts().find(node => node.props.children === text)!;
const hosts = () => tree.root.findAll(node => typeof node.type === 'string');
const row = () => hosts().find(node => node.props.testID === 'fact')!;
/** The picture: the FactArt element (its drawn host is a view of its own size). */
const art = () => tree.root.findAll(node => node.props.kind !== undefined && node.props.size !== undefined)[0];

describe('the picture and the air after it', () => {
  it('is a 28 dp picture of the kind asked for (above 24 it is the 2.5D sticker, not the flat mark), 12 dp before the fact', async () => {
    await render(<FactRow art="pin" value="Liman, Novi Sad" testID="fact" />);
    expect(art().props).toMatchObject({ kind: 'pin', size: 28 });
    expect(art().props.size).toBeGreaterThan(24);
    expect(flat(row())).toMatchObject({ flexDirection: 'row', gap: sys.space.md, alignItems: 'flex-start' });
    expect(sys.space.md).toBe(12);
    const slot = hosts().find(node => flat(node).width === 28 && flat(node).height === 28)!;
    expect(slot).toBeDefined();
  });

  it('keeps its picture on the FIRST line: a fact that wraps does not centre it on the middle one', async () => {
    await render(<FactRow art="calendar" value="Fleksibilan raspon · 24. sep – 30. sep, radnim danima posle 17:00" testID="fact" />);
    expect(flat(row()).alignItems).toBe('flex-start');
    expect(flat(row()).minHeight).toBe(28);
  });
});

describe('card: a fact inside a record', () => {
  it('is the `note` type (14/20) in the `fact` colour; the note under it is `meta`, grey', async () => {
    await render(<FactRow art="users" value="Potrebno: 2 osobe" note="0 od 2 popunjeno" testID="fact" />);
    expect(flat(word('Potrebno: 2 osobe'))).toMatchObject({ fontSize: sys.type.note.fontSize, lineHeight: sys.type.note.lineHeight, color: sys.color.fact });
    expect(flat(word('0 od 2 popunjeno'))).toMatchObject({ fontSize: sys.type.meta.fontSize, lineHeight: sys.type.meta.lineHeight, color: sys.color.muted });
  });

  it('is the card size when nothing is said', async () => {
    await render(<FactRow art="pin" value="Liman" />);
    expect(flat(word('Liman')).fontSize).toBe(14);
  });

  it('centres the first line of 20 on a picture of 28: the text starts 4 dp down', async () => {
    await render(<FactRow art="pin" value="Liman" testID="fact" />);
    const copy = word('Liman').parent!.parent!;
    expect(flat(copy)).toMatchObject({ paddingTop: (28 - sys.type.note.lineHeight) / 2 });
    expect((28 - sys.type.note.lineHeight) / 2).toBe(4);
  });
});

describe('detail: a fact on a detail screen', () => {
  it('is the `body` type (16/24) in ink; the note under it is `note`, grey', async () => {
    await render(<FactRow art="clock" size="detail" value="Sutra · 09:00–11:00" note="Po vremenu u Srbiji" testID="fact" />);
    expect(flat(word('Sutra · 09:00–11:00'))).toMatchObject({ fontSize: 16, lineHeight: 24, color: sys.color.ink });
    expect(flat(word('Po vremenu u Srbiji'))).toMatchObject({ fontSize: sys.type.note.fontSize, color: sys.color.muted });
  });

  it('centres the first line of 24 on the picture of 28: the text starts 2 dp down', async () => {
    await render(<FactRow art="clock" size="detail" value="Sutra" testID="fact" />);
    const copy = word('Sutra').parent!.parent!;
    expect(flat(copy).paddingTop).toBe(2);
  });
});

describe('what it never does', () => {
  it('cuts nothing with an ellipsis: a long fact and a long note wrap, at any size', async () => {
    const long = 'Bulevar oslobođenja, Novo naselje, Novi Sad, kod Ekonomske škole, ulaz iz dvorišta zgrade';
    for (const size of ['card', 'detail'] as const) {
      await render(<FactRow art="pin" size={size} value={long} note={long} />);
      for (const node of texts()) expect([size, node.props.numberOfLines]).toEqual([size, undefined]);
      await act(async () => tree.unmount());
    }
  });

  it('is one sentence for a screen reader: the fact, then its note; the picture says nothing', async () => {
    await render(<FactRow art="users" value="Potrebno: 2 osobe" note="0 od 2 popunjeno" testID="fact" />);
    expect(row().props).toMatchObject({ accessible: true, accessibilityRole: 'text', accessibilityLabel: 'Potrebno: 2 osobe, 0 od 2 popunjeno' });
    await act(async () => tree.update(<FactRow art="users" value="Potrebno: 2 osobe" testID="fact" />));
    expect(row().props.accessibilityLabel).toBe('Potrebno: 2 osobe');
  });

  it('has no divider, no border and no background: a fact is a line, not a box', async () => {
    await render(<FactRow art="pin" value="Liman" note="blizu" testID="fact" />);
    // (The picture's SVG root carries its own `borderWidth: 0` and a transparent ground: that is not a border and not a background.)
    const set = (value: unknown) => value === 0 || value === 'transparent' ? undefined : value;
    for (const node of hosts()) for (const key of ['borderWidth', 'borderBottomWidth', 'borderTopWidth', 'backgroundColor', 'boxShadow']) {
      expect([key, set((flat(node) as Record<string, unknown>)[key])]).toEqual([key, undefined]);
    }
  });
});
