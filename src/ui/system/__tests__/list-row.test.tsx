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
import { FactArt } from '../FactArt';
import { layout, ruleWidth } from '../layout';
import { ListRow } from '../ListRow';
import { sys } from '../tokens';

/**
 * The one row of a list (composition spec 2026-10-07, N3): the text starts at one place, the divider runs from there to the right
 * edge, an arrow stands only where a press goes somewhere, and a row that only tells has neither the arrow nor a press.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); mockStacked = false; jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const texts = () => tree.root.findAllByType(Text);
const word = (text: string) => texts().find(node => node.props.children === text)!;
const hosts = () => tree.root.findAll(node => typeof node.type === 'string');
const row = () => hosts().find(node => node.props.testID === 'row')!;
/** The divider: the one drawn view that is `ruleWidth` high. */
const divider = () => hosts().filter(node => flat(node).height === ruleWidth && flat(node).position === 'absolute');
const arrow = () => tree.root.findAll(node => node.type === ('CaretRight' as unknown));
const dot = <View testID="dot" style={{ width: 8, height: 8 }} />;
const art = (kind: 'pin' | 'bell' = 'pin') => <FactArt kind={kind} size={32} />;

describe('what it says', () => {
  it('draws the title at 16/24, then the subtitle as `note` and the meta line as `meta`, both grey, in that order', async () => {
    await render(<ListRow title="Podešavanja obaveštenja" subtitle="Šta stiže i kada" meta="18:19 · Otvara zadatak" onPress={() => undefined} testID="row" />);
    expect(texts().map(node => node.props.children)).toEqual(['Podešavanja obaveštenja', 'Šta stiže i kada', '18:19 · Otvara zadatak']);
    expect(flat(word('Podešavanja obaveštenja'))).toMatchObject({ fontSize: 16, lineHeight: 24, color: sys.color.ink });
    expect(flat(word('Šta stiže i kada'))).toMatchObject({ fontSize: sys.type.note.fontSize, lineHeight: sys.type.note.lineHeight, color: sys.color.muted });
    expect(flat(word('18:19 · Otvara zadatak'))).toMatchObject({ fontSize: sys.type.meta.fontSize, lineHeight: sys.type.meta.lineHeight, color: sys.color.muted });
  });

  it('writes the title in 600 when the row is touched and in 400 when it only tells', async () => {
    await render(<ListRow title="Radni profil" onPress={() => undefined} />);
    expect(flat(word('Radni profil')).fontFamily).toBe(INTER_FACES[600]);
    await act(async () => tree.update(<ListRow title="Radni profil" />));
    expect(flat(word('Radni profil')).fontFamily).toBe(INTER_FACES[400]);
  });

  it('never cuts a long title or line with an ellipsis: it wraps', async () => {
    const long = 'Prenos starog trokrilnog ormara iz stana na petom spratu bez lifta do kombija parkiranog u dvorištu';
    await render(<ListRow title={long} subtitle={long} meta={long} onPress={() => undefined} />);
    for (const node of texts()) expect([node.props.children, node.props.numberOfLines]).toEqual([long, undefined]);
  });
});

describe('the measure of a row', () => {
  it('is 56 dp high with neither a second line nor a picture, and 64 with either; 12 of padding and 12 between its parts', async () => {
    await render(<ListRow title="Odjavi se" onPress={() => undefined} testID="row" />);
    expect(flat(row())).toMatchObject({ minHeight: layout.rowMinPlain, paddingVertical: sys.space.md, gap: sys.space.md, flexDirection: 'row', alignItems: 'center' });
    for (const element of [<ListRow title="Radni profil" subtitle="Aktivan" testID="row" />, <ListRow title="Radni profil" meta="Aktivan" testID="row" />,
      <ListRow title="Radni profil" leading={art()} testID="row" />]) {
      await act(async () => tree.update(element));
      expect(flat(row()).minHeight).toBe(layout.rowMin);
    }
    expect([layout.rowMinPlain, layout.rowMin]).toEqual([56, 64]);
  });

  it('is never a touch smaller than 48 dp', async () => {
    await render(<ListRow title="Odjavi se" onPress={() => undefined} testID="row" />);
    expect(flat(row()).minHeight).toBeGreaterThanOrEqual(layout.touch);
  });
});

describe('where the text starts, and the divider that starts with it', () => {
  it('starts at the edge without a picture: the divider runs the whole width', async () => {
    await render(<ListRow title="Privatnost i podaci" onPress={() => undefined} testID="row" />);
    expect(divider()).toHaveLength(1);
    expect(flat(divider()[0])).toMatchObject({ left: 0, right: 0, bottom: 0, height: 1, backgroundColor: sys.color.line });
  });

  it('starts 52 from the edge with a picture (slot 40 + 12): the divider is inset by that', async () => {
    await render(<ListRow title="Radni profil" leading={art()} onPress={() => undefined} testID="row" />);
    const slot = hosts().find(node => flat(node).width === layout.slot)!;
    expect(flat(slot)).toMatchObject({ width: 40, alignItems: 'center', justifyContent: 'center' });
    expect(flat(divider()[0]).left).toBe(layout.slot + sys.space.md);
    expect(layout.slot + sys.space.md).toBe(52);
  });

  it('starts 68 from the edge with a face (slot 56 + 12), for the lists of people', async () => {
    await render(<ListRow title="Marko Jovanović" leading={<View testID="face" />} faceSlot onPress={() => undefined} testID="row" />);
    expect(flat(hosts().find(node => flat(node).width === layout.slotFace)!)).toMatchObject({ width: 56 });
    expect(flat(divider()[0]).left).toBe(layout.slotFace + sys.space.md);
    expect(layout.slotFace + sys.space.md).toBe(68);
  });

  it('is 1 dp, never a hairline, and the last row of a group draws none', async () => {
    await render(<ListRow title="Odjavi se" last onPress={() => undefined} testID="row" />);
    expect(divider()).toHaveLength(0);
    await act(async () => tree.update(<ListRow title="Odjavi se" onPress={() => undefined} testID="row" />));
    expect(divider()).toHaveLength(1);
    expect(flat(divider()[0]).height).toBe(1);
    // The row has no border of its own: the divider is not one, so it can start where the words do.
    for (const node of hosts()) for (const key of ['borderBottomWidth', 'borderTopWidth', 'borderWidth']) expect([key, flat(node)[key as 'borderWidth']]).toEqual([key, undefined]);
  });

  it('does not take the touch: the divider lets it through', async () => {
    await render(<ListRow title="Odjavi se" onPress={() => undefined} testID="row" />);
    expect(divider()[0].props.pointerEvents).toBe('none');
  });
});

describe('a row that is touched, and a row that only tells', () => {
  it('with onPress it is a button with the arrow, a press that gives on the row rung, a tick, and the caller\'s name and hint', async () => {
    const onPress = jest.fn();
    await render(<ListRow title="Podrška" subtitle="Privatni zahtevi" onPress={onPress} accessibilityLabel="Podrška, privatni zahtevi" accessibilityHint="Otvara podršku" testID="row" />);
    const press = tree.root.findByType(Press);
    expect(press.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Podrška, privatni zahtevi', accessibilityHint: 'Otvara podršku',
      accessibilityState: { disabled: false }, scaleTo: sys.motion.scale.row, haptic: 'select', testID: 'row' });
    expect(arrow()).toHaveLength(1);
    expect(arrow()[0].props).toMatchObject({ size: 20, color: sys.color.muted });
    await act(async () => press.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('without onPress it has no arrow and no press, and is one stop for a screen reader that says all its lines', async () => {
    await render(<ListRow title="Verzija" subtitle="1.0.0" meta="Izdanje" testID="row" />);
    expect(tree.root.findAllByType(Press)).toHaveLength(0);
    expect(arrow()).toHaveLength(0);
    expect(row().props).toMatchObject({ accessible: true, accessibilityLabel: 'Verzija, 1.0.0, Izdanje' });
    expect(row().props.accessibilityRole).toBeUndefined();
  });

  it('an info row that holds a node of its own is not made one stop, so that node can still be reached', async () => {
    await render(<ListRow title="Dogovor" trailing={dot} testID="row" />);
    expect(row().props.accessible).toBeUndefined();
    expect(row().props.accessibilityLabel).toBeUndefined();
  });

  it('a name from the caller wins on an info row too', async () => {
    await render(<ListRow title="Verzija" subtitle="1.0.0" accessibilityLabel="Verzija aplikacije 1.0.0" testID="row" />);
    expect(row().props.accessibilityLabel).toBe('Verzija aplikacije 1.0.0');
  });
});

describe('the arrow: a touched row has it, a red row (a command) does not, and the caller can say it either way', () => {
  it('a danger row is pressed and has no arrow: "Odjavi se" does something, it does not open a screen', async () => {
    const onPress = jest.fn();
    await render(<ListRow title="Odjavi se" tone="danger" onPress={onPress} testID="row" />);
    expect(tree.root.findByType(Press).props.accessibilityRole).toBe('button');
    expect(arrow()).toHaveLength(0);
    await act(async () => tree.root.findByType(Press).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('`arrow` overrides the default in both directions: a red row that opens a flow keeps its arrow, and a plain one can drop it', async () => {
    await render(<ListRow title="Zatvori nalog" tone="danger" arrow onPress={() => undefined} />);
    expect(arrow()).toHaveLength(1);
    await act(async () => tree.update(<ListRow title="Izvoz podataka" arrow={false} onPress={() => undefined} />));
    expect(arrow()).toHaveLength(0);
  });

  it('never draws an arrow for a row that only tells, whatever `arrow` says: nothing that looks like a link goes nowhere', async () => {
    await render(<ListRow title="Verzija" arrow />);
    expect(arrow()).toHaveLength(0);
    expect(tree.root.findAllByType(Press)).toHaveLength(0);
  });
});

describe('the node at the end', () => {
  it('stands after the text and before the arrow, so a chip or a dot is not under the arrow', async () => {
    await render(<ListRow title="Dogovor" trailing={dot} onPress={() => undefined} testID="row" />);
    const order = hosts().filter(node => node.props.testID === 'dot' || node.type === ('CaretRight' as unknown)).map(node => node.props.testID ?? node.type);
    expect(order).toEqual(['dot', 'CaretRight']);
    const copy = hosts().find(node => flat(node).flex === 1 && flat(node).minWidth === 0)!;
    expect(copy.findAll(node => typeof node.type === 'string' && node.props.testID === 'dot')).toHaveLength(0);
  });

  it('goes UNDER the words at a large text size, so it does not crush them, and the arrow stays at the end', async () => {
    mockStacked = true;
    await render(<ListRow title="Prenos ormana do kombija" subtitle="Čeka tvoj odgovor" trailing={dot} onPress={() => undefined} testID="row" />);
    const copy = hosts().find(node => flat(node).flex === 1 && flat(node).minWidth === 0)!;
    expect(copy.findAll(node => typeof node.type === 'string' && node.props.testID === 'dot')).toHaveLength(1);
    expect(arrow()).toHaveLength(1);
  });
});

// F8b, at F2's request: a settings-like row that says what is chosen ("Gde", "Novi Sad") and opens its choices under itself. Both are optional, and a
// row that says neither is exactly the row it was.
describe('the answer a row carries, and a row that opens in place', () => {
  const caret = (name: 'CaretRight' | 'CaretDown' | 'CaretUp') => tree.root.findAll(node => node.type === (name as unknown));
  const onlyCaret = () => (['CaretRight', 'CaretDown', 'CaretUp'] as const).filter(name => caret(name).length > 0);

  it('draws the value in grey after the words and before the caret, and speaks it after the title', async () => {
    await render(<ListRow title="Gde" value="Novi Sad" onPress={() => undefined} testID="row" />);
    expect(texts().map(node => node.props.children)).toEqual(['Gde', 'Novi Sad']);
    expect(flat(word('Novi Sad'))).toMatchObject({ fontSize: sys.type.note.fontSize, lineHeight: sys.type.note.lineHeight, color: sys.color.muted, textAlign: 'right' });
    const order = tree.root.findAll(node => node.type === ('CaretRight' as unknown) || (node.type === Text && node.props.children === 'Novi Sad')).map(node => node.type === Text ? 'value' : 'caret');
    expect(order).toEqual(['value', 'caret']);
  });

  it('wraps a long value inside half the row and never cuts it', async () => {
    const long = 'Novi Sad, Petrovaradin, Sremska Kamenica i okolina do 25 km';
    await render(<ListRow title="Gde" value={long} onPress={() => undefined} />);
    expect(word(long).props.numberOfLines).toBeUndefined();
    expect(flat(word(long))).toMatchObject({ flexShrink: 1, maxWidth: '50%' });
  });

  it('puts the value under the title at a large text size, with the node at the end, so it does not crush the words', async () => {
    mockStacked = true;
    await render(<ListRow title="Gde" value="Novi Sad" trailing={dot} onPress={() => undefined} />);
    const copy = hosts().find(node => flat(node).flex === 1 && flat(node).minWidth === 0)!;
    expect(copy.findAll(node => node.type === Text && node.props.children === 'Novi Sad').length).toBe(1);
    expect(copy.findAll(node => typeof node.type === 'string' && node.props.testID === 'dot').length).toBe(1);
  });

  it('on a row that only tells the value is one stop with the title, after it', async () => {
    await render(<ListRow title="Verzija" value="1.0.0" subtitle="Izdanje 214" testID="row" />);
    expect(row().props).toMatchObject({ accessible: true, accessibilityLabel: 'Verzija, 1.0.0, Izdanje 214' });
    expect(onlyCaret()).toEqual([]);
  });

  it('expanded={false} draws the caret DOWN and says "not expanded"; expanded draws it UP and says "expanded"', async () => {
    await render(<ListRow title="Gde" value="Novi Sad" expanded={false} onPress={() => undefined} />);
    expect(onlyCaret()).toEqual(['CaretDown']);
    expect(caret('CaretDown')[0].props).toMatchObject({ size: 20, color: sys.color.muted });
    expect(tree.root.findByType(Press).props.accessibilityState).toEqual({ disabled: false, expanded: false });
    await act(async () => tree.update(<ListRow title="Gde" value="Novi Sad" expanded onPress={() => undefined} />));
    expect(onlyCaret()).toEqual(['CaretUp']);
    expect(tree.root.findByType(Press).props.accessibilityState).toEqual({ disabled: false, expanded: true });
  });

  it('is still a button that gives on the row rung and ticks, and presses through', async () => {
    const onPress = jest.fn();
    await render(<ListRow title="Gde" expanded={false} onPress={onPress} />);
    expect(tree.root.findByType(Press).props).toMatchObject({ accessibilityRole: 'button', scaleTo: sys.motion.scale.row, haptic: 'select' });
    await act(async () => tree.root.findByType(Press).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a row without `expanded` is exactly the row it was: the arrow to the right and no expanded state at all', async () => {
    await render(<ListRow title="Podrška" onPress={() => undefined} />);
    expect(onlyCaret()).toEqual(['CaretRight']);
    expect(tree.root.findByType(Press).props.accessibilityState).toEqual({ disabled: false });
    expect('expanded' in tree.root.findByType(Press).props.accessibilityState).toBe(false);
  });

  it('only a touched row can be expanded: on a row that only tells it is ignored, with no caret and no state', async () => {
    await render(<ListRow title="Verzija" expanded testID="row" />);
    expect(onlyCaret()).toEqual([]);
    expect(tree.root.findAllByType(Press).length).toBe(0);
    expect(row().props.accessibilityState).toBeUndefined();
  });

  it('`arrow={false}` still takes the caret away from an expanded row, and a disabled one is greyed and says it', async () => {
    await render(<ListRow title="Gde" expanded arrow={false} onPress={() => undefined} />);
    expect(onlyCaret()).toEqual([]);
    expect(tree.root.findByType(Press).props.accessibilityState).toEqual({ disabled: false, expanded: true });
    await act(async () => tree.update(<ListRow title="Gde" expanded={false} disabled onPress={() => undefined} />));
    expect(tree.root.findByType(Press).props).toMatchObject({ disabled: true, accessibilityState: { disabled: true, expanded: false }, haptic: 'none' });
  });
});

describe('tone, and not now', () => {
  it('`danger` writes the words in red', async () => {
    await render(<ListRow title="Odjavi se" tone="danger" onPress={() => undefined} />);
    expect(flat(word('Odjavi se')).color).toBe(sys.color.danger);
  });

  it('`danger` turns a FactArt picture red with its words, and `quiet` turns it quiet; a face is left as it was given', async () => {
    await render(<ListRow title="Odjavi se" tone="danger" leading={art()} onPress={() => undefined} />);
    expect(tree.root.findAll(node => node.props.kind === 'pin')[0].props).toMatchObject({ tone: 'danger', size: 32 });
    await act(async () => tree.update(<ListRow title="Privatnost" tone="quiet" leading={art()} onPress={() => undefined} />));
    expect(tree.root.findAll(node => node.props.kind === 'pin')[0].props.muted).toBe(true);
    // The words of a quiet row stay readable: it is the picture that goes quiet.
    expect(flat(word('Privatnost')).color).toBe(sys.color.ink);
    await act(async () => tree.update(<ListRow title="Marko" tone="quiet" leading={<View testID="face" />} faceSlot />));
    expect(tree.root.findAll(node => node.props.testID === 'face')[0].props.muted).toBeUndefined();
  });

  it('disabled (the screen is working) greys the words and the picture, cannot be pressed and ticks nothing', async () => {
    await render(<ListRow title="Dostupnost" disabled leading={art()} onPress={() => undefined} />);
    const press = tree.root.findByType(Press);
    expect(press.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true }, haptic: 'none' });
    expect(flat(word('Dostupnost')).color).toBe(sys.color.muted);
    expect(tree.root.findAll(node => node.props.kind === 'pin')[0].props.muted).toBe(true);
  });
});
