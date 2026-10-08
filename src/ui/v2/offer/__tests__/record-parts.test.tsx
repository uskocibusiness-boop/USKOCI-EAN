import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { layout, ruleWidth } from '../../../system/layout';
import { sys } from '../../../system/tokens';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'ScrollView'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../../Press', () => ({ Press: 'Press' }));
jest.mock('../../../Text', () => ({ T: 'T' }));
jest.mock('../../../system/Glyph', () => ({ Glyph: 'Glyph' }));
import { ChoiceRow } from '../ChoiceRow';
import { MoneyLine, RecordFoot, recordBody, recordFlush } from '../RecordParts';

/**
 * The parts the three records of this family share (UI/UX pass 2026-10-08): one of my own tasks, one of my applications and one
 * candidate are the same kind of thing, so they have one money line and one foot, and a sheet of choices has one row.
 */
let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const host = (type: string, root: ReactTestInstance = tree.root) => root.findAll(node => String(node.type) === type);
const flat = (style: unknown) => Object.assign({}, ...[style].flat(4).filter(Boolean));
const texts = () => host('T').flatMap(node => node.children.filter(child => typeof child === 'string'));
const word = (text: string) => host('T').find(node => node.props.children === text)!;

describe('MoneyLine: what a record is worth, on one line', () => {
  const dots = () => host('T').filter(node => node.props.children === '·');

  it('says the amount as money, what it buys as a quiet word beside it, and what belongs with it after a dot', async () => {
    await render(<MoneyLine amount="2.000 RSD" basis="po osobi" notes={['0/2 popunjeno']} />);
    expect(texts()).toEqual(['2.000 RSD', 'po osobi', '·', '0/2 popunjeno']);
    expect(word('2.000 RSD').props.variant).toBe('priceRow');
    expect(flat(word('2.000 RSD').props.style)).toMatchObject({ color: sys.color.money, textAlign: 'left', maxWidth: '100%', flexShrink: 1 });
    for (const quiet of ['po osobi', '0/2 popunjeno']) expect(word(quiet).props).toMatchObject({ variant: 'note', tone: 'muted' });
    expect(flat(host('View')[0].props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
  });

  it('a dot always stays at the END of the part it follows, so a wrapped line never begins with one, and the last part has none', async () => {
    await render(<MoneyLine amount="125.000 RSD" basis="po osobi" notes={['3/12 popunjeno', 'danas']} />);
    expect(dots()).toHaveLength(2);
    // Each part is a row of its own: [what it says][the dot after it]. The parts wrap as wholes.
    const partOf = (text: string) => word(text).parent!;
    const has = (part: ReactTestInstance, text: string) => host('T', part).some(node => node.props.children === text);
    // The amount and what it buys are one part, and the dot after them goes with them.
    const value = word('125.000 RSD').parent!.parent!;
    expect(has(value, 'po osobi')).toBe(true); expect(has(value, '·')).toBe(true); expect(has(value, '3/12 popunjeno')).toBe(false);
    // The next part is the places, with the dot that leads on to the one after it; the last part ends without a dot.
    expect(has(partOf('3/12 popunjeno'), '·')).toBe(true); expect(has(partOf('danas'), '·')).toBe(false);
    for (const dot of dots()) { expect(dot.props.accessible).toBe(false); expect(dot.props.importantForAccessibility).toBe('no'); expect(dot.props.accessibilityElementsHidden).toBe(true); }
    expect(flat(partOf('danas').props.style)).toMatchObject({ flexDirection: 'row', flexShrink: 1, maxWidth: '100%' });
  });

  it('a value that is words (nobody named a price) never wears the weight of money', async () => {
    await render(<MoneyLine word="Tražim ponude" basis="ukupno" notes={['0/1 popunjeno']} />);
    // What an amount buys is said only beside an amount.
    expect(texts()).toEqual(['Tražim ponude', '·', '0/1 popunjeno']);
    expect(word('Tražim ponude').props).toMatchObject({ variant: 'note', tone: 'muted' });
    expect(word('Tražim ponude').props.variant).not.toBe('priceRow');
  });

  it('an amount wins over the words beside it, and a note that is empty is not drawn', async () => {
    await render(<MoneyLine amount="350 RSD" word="Tražim ponude" notes={['', null, undefined, '1 osoba']} />);
    expect(texts()).toEqual(['350 RSD', '·', '1 osoba']);
  });

  it('stacks the parts from the left edge at a large text size, and then draws no dot at all', async () => {
    await render(<MoneyLine amount="350 RSD" basis="ukupno" notes={['1 osoba']} stacked />);
    expect(texts()).toEqual(['350 RSD', 'ukupno', '1 osoba']);
    expect(flat(host('View')[0].props.style)).toMatchObject({ flexDirection: 'column', alignItems: 'flex-start' });
  });

  it('draws nothing at all when there is neither an amount, nor words, nor a note, and no dot beside a line of one part', async () => {
    await render(<MoneyLine />);
    expect(texts()).toEqual([]);
    await act(async () => tree.update(<MoneyLine amount="350 RSD" />));
    expect(texts()).toEqual(['350 RSD']);
  });
});

describe('RecordFoot: the one thing to do next, under a line', () => {
  const foot = (props: Partial<React.ComponentProps<typeof RecordFoot>> = {}) =>
    <RecordFoot label="Uporedi ih i izaberi" tone="muted" accessibilityLabel="Otvori prijave" onPress={() => {}} {...props} />;
  const press = () => host('Press')[0];

  it('is a line of one dp and a target of its own, 48 dp high, with no hit slop beyond the line', async () => {
    const onPress = jest.fn();
    await render(foot({ onPress, accessibilityHint: 'Otvara prijave.' }));
    const line = host('View').find(node => flat(node.props.style).height === ruleWidth)!;
    expect(flat(line.props.style)).toMatchObject({ backgroundColor: sys.color.line }); expect(line.props.pointerEvents).toBe('none');
    expect(press().props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Otvori prijave', accessibilityHint: 'Otvara prijave.',
      accessibilityState: { disabled: false }, hitSlop: 0, haptic: 'select', scaleTo: 1 });
    expect(flat(press().props.style)).toMatchObject({ minHeight: layout.touch, paddingHorizontal: layout.card });
    act(() => press().props.onPress()); expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('hands the press-in and press-out to the record, so the whole card gives under the finger as one object', async () => {
    const onPressIn = jest.fn(), onPressOut = jest.fn();
    await render(foot({ onPressIn, onPressOut }));
    act(() => { press().props.onPressIn(); press().props.onPressOut(); });
    expect(onPressIn).toHaveBeenCalledTimes(1); expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it('a sentence of fact that leads somewhere is grey words with a caret to the right', async () => {
    await render(foot());
    expect(word('Uporedi ih i izaberi').props).toMatchObject({ variant: 'note', tone: 'muted' });
    expect(host('Glyph').map(node => [node.props.name, node.props.tone])).toEqual([['caret-right', 'muted']]);
  });

  it('a command that goes somewhere is green with a green caret, and a rare step that asks first is ink and has no caret', async () => {
    await render(foot({ label: 'Otvori Dogovor', tone: 'green' }));
    expect(flat(word('Otvori Dogovor').props.style).color).toBe(sys.color.green); expect(word('Otvori Dogovor').props.variant).toBe('bodyStrong');
    expect(host('Glyph').map(node => [node.props.name, node.props.tone])).toEqual([['caret-right', 'green']]);
    await act(async () => tree.update(foot({ label: 'Povuci prijavu', tone: 'ink' })));
    expect(flat(word('Povuci prijavu').props.style).color).toBe(sys.color.ink); expect(host('Glyph')).toHaveLength(0);
  });

  it('what waits for me has an orange dot, the words in the warn ink and a caret down for what opens under the card', async () => {
    await render(foot({ label: 'Pregledaj izmene zadatka', tone: 'waiting', caret: 'down' }));
    expect(host('View').some(node => flat(node.props.style).backgroundColor === sys.color.orange)).toBe(true);
    expect(flat(word('Pregledaj izmene zadatka').props.style).color).toBe(sys.color.warn);
    expect(host('Glyph').map(node => node.props.name)).toEqual(['caret-down']);
  });

  it('disabled draws the words muted and says it is disabled, never faded', async () => {
    await render(foot({ label: 'Povuci prijavu', tone: 'waiting', disabled: true }));
    expect(press().props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
    expect(flat(word('Povuci prijavu').props.style).color).toBe(sys.color.muted); expect(word('Povuci prijavu').props.tone).toBe('muted');
    expect(host('View').some(node => flat(node.props.style).backgroundColor === sys.color.muted)).toBe(true);
    for (const node of host('View')) expect(flat(node.props.style)).not.toHaveProperty('opacity');
  });
});

describe('recordBody and recordFlush: what a record is made of', () => {
  it('is 16 inside and 12 between its parts, and a record with a foot takes no padding of its own', () => {
    expect(recordBody).toEqual({ padding: 16, gap: 12 }); expect(recordBody.padding).toBe(layout.card);
    expect(recordFlush).toEqual({ padding: 0 });
  });
});

describe('ChoiceRow: one choice in a sheet', () => {
  const row = (props: Partial<React.ComponentProps<typeof ChoiceRow>> = {}) =>
    <ChoiceRow kind="radio" label="Najniža cena" checked={false} onPress={() => {}} {...props} />;
  const press = () => host('Press')[0];

  it('is one stop for a screen reader, with its role, its words and whether it is chosen', async () => {
    const onPress = jest.fn();
    await render(row({ onPress }));
    expect(press().props).toMatchObject({ accessibilityRole: 'radio', accessibilityLabel: 'Najniža cena', accessibilityState: { checked: false }, 'aria-checked': false });
    await act(async () => tree.update(row({ kind: 'checkbox', label: 'Čeka tvoj izbor', checked: true, onPress })));
    expect(press().props).toMatchObject({ accessibilityRole: 'checkbox', accessibilityLabel: 'Čeka tvoj izbor', accessibilityState: { checked: true }, 'aria-checked': true });
    act(() => press().props.onPress()); expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a choice that is not made is a plain row, and the one that is made is a field with a green edge', async () => {
    await render(row());
    expect(flat(press().props.style)).toMatchObject({ borderColor: 'transparent', minHeight: layout.touch });
    expect(word('Najniža cena').props.variant).toBe('body');
    await act(async () => tree.update(row({ checked: true })));
    expect(flat(press().props.style)).toMatchObject({ borderColor: sys.color.green, backgroundColor: sys.color.greenSoft });
    expect(word('Najniža cena').props.variant).toBe('bodyStrong');
  });

  it('the circle has a dot only when chosen, the square a tick only when chosen, and they are different shapes on purpose', async () => {
    await render(row());
    const box = () => host('View').find(node => flat(node.props.style).width === 22)!;
    expect(flat(box().props.style).borderRadius).toBe(sys.radius.pill); expect(host('Glyph')).toHaveLength(0);
    expect(host('View').some(node => flat(node.props.style).width === 11)).toBe(false);
    await act(async () => tree.update(row({ checked: true })));
    expect(host('View').some(node => flat(node.props.style).width === 11)).toBe(true);
    await act(async () => tree.update(row({ kind: 'checkbox', checked: false })));
    expect(flat(box().props.style).borderRadius).toBe(sys.radius.check); expect(sys.radius.check).not.toBe(sys.radius.pill);
    await act(async () => tree.update(row({ kind: 'checkbox', checked: true })));
    expect(host('Glyph').map(node => [node.props.name, node.props.tone])).toEqual([['check', 'onGreen']]);
    expect(flat(box().props.style).backgroundColor).toBe(sys.color.green);
  });

  it('says what the choice means in a quiet line under the words, which is also its spoken hint, and keeps anything at its end', async () => {
    await render(row({ kind: 'checkbox', label: 'Čeka tvoj izbor', hint: 'Zadaci sa prijavama koje možeš da izabereš.', children: <T_ /> }));
    expect(press().props.accessibilityHint).toBe('Zadaci sa prijavama koje možeš da izabereš.');
    expect(word('Zadaci sa prijavama koje možeš da izabereš.').props).toMatchObject({ variant: 'note', tone: 'muted' });
    expect(word('Čeka tvoj izbor').props.variant).toBe('bodyStrong');
    expect(host('End')).toHaveLength(1);
  });
});

/** Something that belongs at the end of a row. */
function T_() { return React.createElement('End'); }
