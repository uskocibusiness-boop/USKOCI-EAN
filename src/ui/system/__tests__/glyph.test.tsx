import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Glyph, GLYPH_NAMES, GLYPH_SIZES, GLYPH_TONES, glyphWeight, type GlyphName } from '../Glyph';
import { sys } from '../tokens';

/**
 * The one wrapper for a control glyph (UI/UX pass, wave 2, item 2.3; audit ICO-08). 47 Phosphor icons were drawn at ten sizes in
 * three weights and as many colours, chosen at each call site, so every top bar and every row carried slightly different line
 * icons. These checks hold the closed registry, the three sizes, the five tones and the one weight rule. The Phosphor mock of
 * the repository draws each icon as a host element named after it, so "this name draws that icon" is read from the tree.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
/** The Phosphor host element a Glyph drew (the mock names it after the icon). */
const drawn = () => tree.root.findAll(node => typeof node.type === 'string')[0];

// The registry, tight both ways: a new name has to be added here on purpose, and a name that disappears fails too.
const REGISTRY: Record<string, string> = {
  back: 'ArrowLeft', close: 'X', 'caret-right': 'CaretRight', 'caret-left': 'CaretLeft', 'caret-down': 'CaretDown', 'caret-up': 'CaretUp',
  plus: 'Plus', minus: 'Minus', check: 'Check', send: 'PaperPlaneTilt', search: 'MagnifyingGlass', filters: 'SlidersHorizontal',
  more: 'DotsThree', mic: 'Microphone', wave: 'Waveform', 'arrow-right': 'ArrowRight', 'arrow-up': 'ArrowUp', 'arrow-up-right': 'ArrowUpRight',
  refresh: 'ArrowClockwise', trash: 'Trash', camera: 'Camera', image: 'Image', eye: 'Eye', 'eye-off': 'EyeSlash', external: 'ArrowSquareOut',
  expand: 'ArrowsOutSimple', info: 'Info', map: 'MapTrifold', profile: 'User', calendar: 'CalendarBlank',
  home: 'HouseSimple', agreements: 'Handshake', messages: 'ChatCircle', notifications: 'Bell', edit: 'PencilSimpleLine', settings: 'GearSix',
};

describe('the closed registry', () => {
  it('names exactly the controls the app draws, no more and no fewer', () => {
    expect([...GLYPH_NAMES].sort()).toEqual(Object.keys(REGISTRY).sort());
    expect(new Set(GLYPH_NAMES).size).toBe(GLYPH_NAMES.length);
  });

  it.each(Object.entries(REGISTRY))('%s draws the Phosphor icon %s', async (name, icon) => {
    await render(<Glyph name={name as GlyphName} />);
    expect(drawn().type).toBe(icon);
  });

  it('gives no two names the same drawing: one meaning, one picture', async () => {
    const seen = new Set<string>();
    for (const name of GLYPH_NAMES) { expect(seen.has(REGISTRY[name])).toBe(false); seen.add(REGISTRY[name]); }
  });
});

// The registry is closed for the compiler too. These lines are not run as a render: `tsc --noEmit` is the check, and it fails with
// "Unused '@ts-expect-error' directive" if any of them ever compiles (a name, a size, a tone or a weight a call site could invent).
describe('the registry is closed at compile time', () => {
  it('refuses a name that is not in it, a size off the 16, 20, 24 ladder, a tone outside the five, and a weight of the caller\'s own', () => {
    // @ts-expect-error 'nope' is not a GlyphName: a new control gets a new name in the registry, on purpose.
    const unknownName = <Glyph name="nope" />;
    // @ts-expect-error 22 is not on the ladder: a glyph is 16 in text, 20 in a row, 24 in the chrome.
    const offLadder = <Glyph name="back" size={22} />;
    // @ts-expect-error 'orange' is not one of ink, green, muted, onGreen and danger.
    const unknownTone = <Glyph name="back" tone="orange" />;
    // @ts-expect-error nothing outside the file picks a weight (`on` and `strong` are the only two doors).
    const ownWeight = <Glyph name="back" weight="thin" />;
    expect([unknownName, offLadder, unknownTone, ownWeight].every(element => React.isValidElement(element))).toBe(true);
  });
});

describe('three sizes, five tones', () => {
  it('has chrome 24, row 20 and in-text 16, and draws 20 in ink unless told otherwise', async () => {
    expect([...GLYPH_SIZES]).toEqual([16, 20, 24]);
    await render(<Glyph name="search" />);
    expect(drawn().props).toMatchObject({ size: 20, color: sys.color.ink });
    for (const size of GLYPH_SIZES) {
      await act(async () => tree.update(<Glyph name="search" size={size} />));
      expect(drawn().props.size).toBe(size);
    }
  });

  it('draws each tone in its token colour and no other', async () => {
    expect([...GLYPH_TONES]).toEqual(['ink', 'green', 'muted', 'onGreen', 'danger']);
    const colour = { ink: sys.color.ink, green: sys.color.green, muted: sys.color.muted, onGreen: sys.color.onGreen, danger: sys.color.danger };
    await render(<Glyph name="plus" />);
    for (const tone of GLYPH_TONES) {
      await act(async () => tree.update(<Glyph name="plus" tone={tone} />));
      expect(drawn().props.color).toBe(colour[tone]);
    }
  });
});

describe('the one weight rule, resolved inside', () => {
  it('is bold at 16 and below, and for check, close, plus and minus at any size', () => {
    for (const name of GLYPH_NAMES) expect([name, glyphWeight(name, 16)]).toEqual([name, 'bold']);
    for (const name of ['check', 'close', 'plus', 'minus'] as const) for (const size of GLYPH_SIZES) expect([name, size, glyphWeight(name, size)]).toEqual([name, size, 'bold']);
  });

  it('is regular at 20 and 24 for everything else', () => {
    for (const name of GLYPH_NAMES.filter(candidate => !['check', 'close', 'plus', 'minus'].includes(candidate))) {
      for (const size of [20, 24] as const) expect([name, size, glyphWeight(name, size)]).toEqual([name, size, 'regular']);
    }
  });

  it('is fill only for an on-state, which wins over everything else', () => {
    expect(glyphWeight('filters', 24, true)).toBe('fill');
    expect(glyphWeight('check', 16, true)).toBe('fill');
    expect(glyphWeight('search', 20, true, true)).toBe('fill');
    for (const name of GLYPH_NAMES) for (const size of GLYPH_SIZES) {
      expect([name, size, glyphWeight(name, size, false)]).not.toEqual([name, size, 'fill']);
      expect([name, size, glyphWeight(name, size, false, true)]).not.toEqual([name, size, 'fill']);
    }
  });

  // The chrome draws a glyph beside a 700-weight title, so it asks for bold at 24 (the owner asked for stronger, not larger).
  // It is a flag, never a free weight: nothing outside this file picks thin, light or duotone.
  it('lets the chrome ask for bold at any size, and nothing picks a weight of its own', async () => {
    expect(glyphWeight('back', 24, false, true)).toBe('bold');
    expect(glyphWeight('back', 24)).toBe('regular');
    await render(<Glyph name="back" size={24} strong />);
    expect(drawn().props.weight).toBe('bold');
    await act(async () => tree.update(<Glyph name="back" size={24} on />));
    expect(drawn().props.weight).toBe('fill');
    await act(async () => tree.update(<Glyph name="back" size={24} />));
    expect(drawn().props.weight).toBe('regular');
    expect(readFileSync(join(__dirname, '../Glyph.tsx'), 'utf8')).not.toMatch(/weight\??:\s*(?:IconWeight|string)/);
  });
});
