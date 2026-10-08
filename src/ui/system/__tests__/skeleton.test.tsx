import React from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
let mockScale = 1;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
// The window of a test is 750 wide at text scale 2: a placeholder and a real row are compared at the text size a test names, and the row at the
// designed (compact) layout.
jest.mock('../textScale', () => ({ ...jest.requireActual('../textScale'), useTextScale: () => mockScale,
  useLayoutClass: () => ({ cls: 'compact', stacked: false }) }));

import { FactArt } from '../FactArt';
import { FACT_ROW_ART, FactRow } from '../FactRow';
import { layout, ruleWidth } from '../layout';
import { ListRow } from '../ListRow';
import { Skeleton, SkeletonCard, SkeletonList } from '../Skeleton';
import { Surface } from '../Surface';
import { sys } from '../tokens';
import type { MarketplaceItem } from '../../../data/marketplaceView';
import { TaskCard } from '../../v2/TaskCard';

/**
 * A placeholder is drawn at the measure of what is coming (composition spec T7: "skelet iste geometrije kao stvarni red"; UI/UX pass
 * 2026-10-08, F8b). The proof is not a look at a picture but a MEASURE: this file lays out a tree of fixed numbers (the way the
 * placeholders and the primitives are written: padding, gap, minimum height, a line's own height, a picture's side) and compares what a
 * `ListRow`, a `FactRow` and a task's record are with what stands in for them.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); mockReduced = false; mockScale = 1; jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const host = (node: ReactTestInstance) => typeof node.type === 'string';
const hosts = () => tree.root.findAll(host);
const size = (nodes: readonly unknown[]) => nodes.length;
/** Draws an element in a renderer of its own (inside act, as React 19 draws nothing outside it), reads what it needs, and puts it away. */
async function aside<T>(element: React.ReactElement, read: (root: ReactTestInstance) => T): Promise<T> {
  let view!: ReactTestRenderer;
  await act(async () => { view = create(element); });
  const found = read(view.root);
  await act(async () => view.unmount());
  return found;
}

/** The host elements a node draws, through the components that only draw them. */
function drawn(node: ReactTestInstance): ReactTestInstance[] {
  return node.children.flatMap(child => typeof child === 'string' ? [] : host(child) ? [child] : drawn(child));
}
const num = (value: unknown): number => typeof value === 'number' ? value : 0;
/** The line box of the amount: 16/21 (`priceRow`). */
const PRICE = sys.type.priceRow.lineHeight ?? 21;
/** The height a host takes in a column of fixed numbers: its own `height`, a line of text at its `lineHeight`, or what it holds plus its padding and edge. */
function measure(node: ReactTestInstance): number {
  const style = flat(node);
  if (typeof style.height === 'number') return style.height;
  if ((node.type as unknown) === 'Text') return num(style.lineHeight);
  const inFlow = drawn(node).filter(child => flat(child).position !== 'absolute');
  const heights = inFlow.map(measure);
  const gap = num(style.gap) || num(style.rowGap);
  const content = style.flexDirection === 'row' ? Math.max(0, ...heights) : heights.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, heights.length - 1);
  const pad = num(style.paddingVertical) * 2 || num(style.padding) * 2 || num(style.paddingTop) + num(style.paddingBottom);
  const edge = num(style.borderWidth) * 2;
  return Math.max(content + pad + edge, num(style.minHeight));
}
/** What the test renderer drew, as the one thing a screen puts in a list: the first host of the tree under the list. */
const first = () => drawn(tree.root)[0];
/** The measure of what a render drew (a list: the placeholders and the gaps between them). */
const heightOfRender = () => measure(first());

describe('a row is the measure of a ListRow', () => {
  const picture = <FactArt kind="pin" size={32} />;

  it('is 68 dp with a picture and two lines, the same as the real row: 12 over and under, 12 between, a 40 slot, a title line and a note line', async () => {
    await render(<ListRow leading={picture} title="Radni profil" subtitle="Aktivan" last onPress={() => undefined} />);
    const real = measure(first());
    await act(async () => tree.update(<Skeleton variant="row" count={1} />));
    expect(heightOfRender()).toBe(real);
    expect(real).toBe(2 * sys.space.md + sys.type.bodyStrong.lineHeight + sys.type.note.lineHeight);
    expect(real).toBe(68);
  });

  it('is 64 dp with a picture and one line (the row\'s least), as the real row is', async () => {
    await render(<ListRow leading={picture} title="Radni profil" last onPress={() => undefined} />);
    const real = measure(first());
    await act(async () => tree.update(<Skeleton variant="row" count={1} rows={1} />));
    expect(heightOfRender()).toBe(real);
    expect(real).toBe(layout.rowMin);
  });

  it('is 80 dp with a face and two lines: the 56 slot decides, as it does in the real row', async () => {
    await render(<ListRow leading={<View style={{ width: 56, height: 56 }} />} faceSlot title="Marko Jovanović" subtitle="Prenos ormana" last onPress={() => undefined} />);
    const real = measure(first());
    await act(async () => tree.update(<Skeleton variant="row" count={1} face />));
    expect(heightOfRender()).toBe(real);
    expect(real).toBe(2 * sys.space.md + layout.slotFace);
  });

  it('draws the slot 40 wide with the 32 picture in it, and the inset rule from 52 to the right edge, 1 dp, under every row but the last', async () => {
    await render(<Skeleton variant="row" count={3} />);
    const slots = hosts().filter(node => flat(node).width === layout.slot);
    expect(size(slots)).toBe(3);
    expect(size(hosts().filter(node => flat(node).width === 32 && flat(node).height === 32 && flat(node).borderRadius === sys.radius.pill))).toBe(3);
    const rules = hosts().filter(node => flat(node).position === 'absolute' && flat(node).height === ruleWidth);
    expect(size(rules)).toBe(2);
    for (const rule of rules) {
      expect(flat(rule)).toMatchObject({ left: layout.slot + sys.space.md, right: 0, bottom: 0, backgroundColor: sys.color.line });
      expect(rule.props.pointerEvents).toBe('none');
    }
  });

  it('starts its rule at 68 with a face, and has no slot and the pill of a switch at the end in a settings list', async () => {
    await render(<Skeleton variant="row" count={2} face />);
    expect(flat(hosts().find(node => flat(node).position === 'absolute')!).left).toBe(layout.slotFace + sys.space.md);
    await act(async () => tree.update(<Skeleton variant="row" count={2} switches />));
    expect(size(hosts().filter(node => flat(node).width === layout.slot))).toBe(0);
    expect(size(hosts().filter(node => flat(node).width === 51 && flat(node).height === 31 && flat(node).borderRadius === sys.radius.pill))).toBe(2);
    expect(flat(hosts().find(node => flat(node).position === 'absolute')!).left).toBe(0);
  });

  it('is 56 dp for a settings row with one line and 64 with two, the real row\'s two heights', async () => {
    await render(<Skeleton variant="row" count={1} switches rows={1} />);
    expect(heightOfRender()).toBe(layout.rowMinPlain);
    await act(async () => tree.update(<Skeleton variant="row" count={1} switches rows={2} />));
    expect(heightOfRender()).toBe(2 * sys.space.md + sys.type.bodyStrong.lineHeight + sys.type.note.lineHeight);
  });

  it('puts a section title\'s bar over the rows when asked: a line of the heading type, 12 above what it holds', async () => {
    await render(<Skeleton variant="row" count={2} heading />);
    const bar = hosts().find(node => flat(node).marginBottom === layout.group)!;
    expect(measure(bar)).toBe(sys.type.heading.lineHeight);
  });

  it('follows the text size: the line boxes grow with the type, so the row does not jump when its words come at 1.3', async () => {
    mockScale = 1.3;
    await render(<Skeleton variant="row" count={1} />);
    expect(heightOfRender()).toBe(2 * sys.space.md + Math.round(sys.type.bodyStrong.lineHeight * 1.3) + Math.round(sys.type.note.lineHeight * 1.3));
  });
});

describe('a fact is the measure of a FactRow', () => {
  it('is the height of its picture for one line, as the real fact is, and stands 8 from the next', async () => {
    await render(<FactRow art="pin" value="Liman, Novi Sad" />);
    const real = measure(first());
    await act(async () => tree.update(<Skeleton variant="fact" count={3} />));
    expect(real).toBe(FACT_ROW_ART);
    const list = first();
    const facts = drawn(list);
    expect(size(facts)).toBe(3);
    for (const fact of facts) expect(measure(fact)).toBe(real);
    expect(flat(list).gap).toBe(sys.space.sm);
    expect(measure(list)).toBe(3 * real + 2 * sys.space.sm);
  });

  it('draws the picture at the side the real fact draws it, and a line whose first line is centred on it', async () => {
    await render(<Skeleton variant="fact" count={1} />);
    expect(size(hosts().filter(node => flat(node).width === FACT_ROW_ART && flat(node).height === FACT_ROW_ART))).toBe(1);
    expect(size(hosts().filter(node => flat(node).paddingTop === (FACT_ROW_ART - sys.type.note.lineHeight) / 2))).toBe(1);
  });
});

describe('a record is the card of a task', () => {
  it('stands in the frame of a Surface record: the same white card, 24 corners, 16 padding, the same edge and shadow', async () => {
    await render(<Skeleton variant="record" count={1} />);
    const frame = (node: ReactTestInstance) => { const { backgroundColor, borderRadius, padding, borderWidth, borderColor } = flat(node); return { backgroundColor, borderRadius, padding, borderWidth, borderColor }; };
    const wanted = await aside(<Surface kind="record"><View /></Surface>, root => frame(root.findAll(host)[0]));
    expect(frame(hosts().find(node => flat(node).borderRadius === sys.radius.card)!)).toEqual(wanted);
    expect(wanted).toMatchObject({ borderRadius: 24, padding: layout.card });
  });

  // F2, finished: a task card is 199 to 251 dp (a state over the title, a second line of title, a condition under the facts; 8 more since the fact
  // pictures became 28), and the list's placeholder was 146, so the list jumped by a hand's breadth when the cards arrived. Title and amount, two
  // facts and the person is the least a card is, and the placeholder is that: about 200 dp.
  it('is the least a task card is with the person and two facts (about 200 dp), and 52 less without the person', async () => {
    await render(<Skeleton variant="record" count={1} foot />);
    const body = sys.type.heading.lineHeight + sys.space.xs + PRICE + sys.space.md
      + (FACT_ROW_ART + sys.space.xs + FACT_ROW_ART) + sys.space.md + layout.slot;
    expect(heightOfRender()).toBe(body + 2 * layout.card + 2);
    expect(heightOfRender()).toBeGreaterThanOrEqual(199);
    expect(heightOfRender()).toBeLessThanOrEqual(215);
    const withPerson = heightOfRender();
    await act(async () => tree.update(<Skeleton variant="record" count={1} />));
    expect(heightOfRender()).toBe(withPerson - sys.space.md - layout.slot);
  });

  it('keeps 12 between the parts of the face and 4 inside a part, as the face does, and stands 12 from the next record', async () => {
    await render(<Skeleton variant="record" count={2} foot />);
    const list = first();
    expect(flat(list).gap).toBe(layout.group);
    expect(size(drawn(list))).toBe(2);
    expect(size(hosts().filter(node => flat(node).gap === sys.space.md && flat(node).flexDirection === undefined))).toBeGreaterThan(0);
    expect(size(hosts().filter(node => flat(node).gap === sys.space.xs))).toBe(4);
  });

  it('draws the person at the foot only when asked, 40 with two lines; `rows` is the number of facts', async () => {
    const people = () => size(hosts().filter(node => flat(node).width === 40 && flat(node).height === 40 && flat(node).borderRadius === sys.radius.pill));
    await render(<Skeleton variant="record" count={3} />);
    expect(people()).toBe(0);
    await act(async () => tree.update(<Skeleton variant="record" count={3} foot />));
    expect(people()).toBe(3);
    await act(async () => tree.update(<Skeleton variant="record" count={1} rows={3} />));
    expect(size(hosts().filter(node => flat(node).width === FACT_ROW_ART && flat(node).height === FACT_ROW_ART))).toBe(3);
  });

  // The owner's pick of 8 Oct 2026: the amount is the first fact of the task card (the place of its picture is a fact's), and the count of people ends the line of the
  // person. The placeholder of a task list has that face, and the height of the real card at the least it is.
  describe('`task` is the face of the task card', () => {
    const NEED = { id: 'need-1', naslov: 'Farbanje dnevne sobe', podrucjeTekst: 'Liman, Novi Sad', vremeTekst: '24. sep · 17:00', statusTekst: 'Otvoren', uslovi: [],
      pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: null, narucilacProfilId: 'profile-1', narucilacIme: 'Nikola Petrović',
      narucilacOcena: '4,8', narucilacBrojOcena: 12, rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL', ponudjenaCena: { iznos: 5500, valuta: 'RSD', prikaz: '5.500 RSD' },
      detalji: { kategorija: 'Krečenje', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: { vestine: [], alati: [], vozila: [], dozvole: [], bitniUslovi: null,
        iskustvoGodina: null, potvrdjenIdentitet: false } } } as unknown as MarketplaceItem;

    it('draws three facts (the amount first, then two), the person\'s 40 picture, and the count of people at the end of the person\'s line', async () => {
      await render(<SkeletonCard variant="task" />);
      expect(size(hosts().filter(node => flat(node).width === FACT_ROW_ART && flat(node).height === FACT_ROW_ART))).toBe(3);
      expect(size(hosts().filter(node => flat(node).width === layout.slot && flat(node).height === layout.slot && flat(node).borderRadius === sys.radius.pill))).toBe(1);
      expect(size(hosts().filter(node => flat(node).width === 40 && flat(node).height === 12))).toBe(1);
      // The amount's row is the first of the facts, with the sum's bar and a shorter one for what it buys.
      const [sum, buys] = hosts().filter(node => flat(node).height === 14 || (flat(node).width === 44 && flat(node).height === 12));
      expect([flat(sum).width, flat(buys).width]).toEqual([96, 44]);
    });

    it('is as tall as the least the real card is: a title of one line, the amount, where, when, and the person; and 4 between the facts, 12 between the parts', async () => {
      await render(<TaskCard item={NEED} onOpen={() => undefined} />);
      const real = heightOfRender();
      await act(async () => tree.update(<SkeletonCard variant="task" />));
      expect(heightOfRender()).toBe(real);
      expect(real).toBe(sys.type.heading.lineHeight + sys.space.md + (3 * FACT_ROW_ART + 2 * sys.space.xs) + sys.space.md + layout.slot + 2 * layout.card + 2);
    });

    it('takes `rows` more facts after the amount, and stands 12 from the next card', async () => {
      await render(<Skeleton variant="task" count={2} rows={3} />);
      expect(size(drawn(first()))).toBe(2);
      expect(flat(first()).gap).toBe(layout.group);
      expect(size(hosts().filter(node => flat(node).width === FACT_ROW_ART && flat(node).height === FACT_ROW_ART))).toBe(8);
    });

    it('grows with the text size as the real card does: the lines are taller, a fact is the taller of its picture and its line, the person the taller of 40 and its two lines', async () => {
      mockScale = 1.3;
      await render(<Skeleton variant="task" count={1} />);
      const px = (n: number) => Math.round(n * 1.3);
      const amount = Math.max(FACT_ROW_ART, (FACT_ROW_ART - PRICE) / 2 + px(PRICE));
      const fact = Math.max(FACT_ROW_ART, (FACT_ROW_ART - sys.type.note.lineHeight) / 2 + px(sys.type.note.lineHeight));
      const person = Math.max(layout.slot, 2 * px(sys.type.note.lineHeight));
      expect(heightOfRender()).toBe(px(sys.type.heading.lineHeight) + sys.space.md + (amount + sys.space.xs + fact + sys.space.xs + fact) + sys.space.md + person
        + 2 * layout.card + 2);
    });
  });

  it('grows with the text size: at 1.3 the card is as tall as the real one, which is taller by the lines it holds', async () => {
    mockScale = 1.3;
    await render(<Skeleton variant="record" count={1} foot />);
    const px = (n: number) => Math.round(n * 1.3);
    // As the real card is at that size: its lines are taller, a fact is the taller of its picture and its line (the half-leading is the
    // unscaled one), and the person is the taller of the 40 picture and its two lines.
    const fact = Math.max(FACT_ROW_ART, (FACT_ROW_ART - sys.type.note.lineHeight) / 2 + px(sys.type.note.lineHeight));
    const person = Math.max(layout.slot, px(sys.type.note.lineHeight) + px(sys.type.meta.lineHeight));
    expect(heightOfRender()).toBe(px(sys.type.heading.lineHeight) + sys.space.xs + px(PRICE) + sys.space.md
      + (fact + sys.space.xs + fact) + sys.space.md + person + 2 * layout.card + 2);
  });
});

describe('the whole list breathes as one, and says nothing to a screen reader', () => {
  it('runs one loop for the list, however many placeholders it holds, and none at all under reduced motion', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    await render(<Skeleton variant="row" count={5} />);
    expect(loop).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
    loop.mockClear(); mockReduced = true;
    await render(<Skeleton variant="record" count={3} />);
    expect(loop).not.toHaveBeenCalled();
  });

  it('is hidden from a screen reader (the sentence under it says it all), unless the caller gives it the one name it has', async () => {
    await render(<Skeleton variant="row" count={2} />);
    expect(first().props).toMatchObject({ importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true });
    expect(first().props.accessible).toBeUndefined();
    await act(async () => tree.update(<Skeleton variant="row" count={2} label="Učitavanje obaveštenja" />));
    expect(first().props).toMatchObject({ accessible: true, accessibilityLabel: 'Učitavanje obaveštenja', importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: false });
  });

  it('draws nothing that spins and nothing that can be pressed', async () => {
    await render(<Skeleton variant="record" count={3} foot />);
    expect(size(tree.root.findAll(node => node.props.onPress !== undefined || node.props.accessibilityRole === 'button'))).toBe(0);
    expect(size(tree.root.findAllByType(ActivityIndicator))).toBe(0);
  });
});

describe('the list: what it is told and what it draws', () => {
  it('is `row` by default under the name `Skeleton`, three of them, with the placeholders of every other variant still reachable by name', async () => {
    await render(<Skeleton />);
    expect(size(drawn(first()))).toBe(3);
    expect(size(hosts().filter(node => flat(node).width === layout.slot))).toBe(3);
    await act(async () => tree.update(<SkeletonList count={2} variant="fact" />));
    expect(size(drawn(first()))).toBe(2);
  });

  it('keeps the gap of every shape: rows touch (their rule parts them), records 12 apart, facts 8, the older cards 12', async () => {
    const gap = (element: React.ReactElement) => aside(element, root => flat(root.findAll(host)[0]).gap);
    expect([await gap(<SkeletonList variant="row" />), await gap(<SkeletonList variant="record" />), await gap(<SkeletonList variant="fact" />),
      await gap(<SkeletonList />), await gap(<SkeletonList variant="thread" />)]).toEqual([0, layout.group, sys.space.sm, 12, undefined]);
  });
});
