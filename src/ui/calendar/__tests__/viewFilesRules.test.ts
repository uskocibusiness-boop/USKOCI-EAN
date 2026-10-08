import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The files of the three views (Mesec, Nedelja, Dan) follow the rules of the one system, and this holds the ones the system's own ratchets do
 * not read file by file (`one-token-source`, `rule-width-ratchet` and `surface-kinds-ratchet` hold the motion literals, the lines and the
 * containers for the whole tree): every colour is a `sys` token (the colours of a Dogovor's side come from `roleTone.ts`, which takes them from
 * `sys.color.artRole`), no colour is spelled by name, every spacing is a step of the ladder, and none of them reads the window's width (only the
 * two files that did before the views, which are on the ratchet's list, still do).
 */
const dir = join(__dirname, '..');
const VIEW_FILES = ['AgendaScreen', 'AgendaRow', 'DayBlock', 'DayCell', 'DayView', 'LooseTerms', 'MonthView', 'PeriodControls', 'WeekDays', 'WeekStrip', 'roleTone']
  .map(name => `${name}.${name === 'roleTone' ? 'ts' : 'tsx'}`);
const read = (file: string) => readFileSync(join(dir, file), 'utf8');
/** Code without its comments: a comment may name a colour the code does not use. */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const RAW_HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_])/gi;
const NAMED_COLOUR = /\b(?:fill|stroke|stopColor|color|backgroundColor|borderColor|tintColor|shadowColor)\s*[=:]\s*['"](?:white|black|red|green)['"]/g;
const RGB = /\brgba?\s*\(/;
const LADDER = new Set([0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 48]);
const SPACING = /\b(?:padding|margin)(?:Top|Bottom|Left|Right|Horizontal|Vertical)?\s*:\s*(-?\d+(?:\.\d+)?)\b|\b(?:gap|rowGap|columnGap)\s*:\s*(-?\d+(?:\.\d+)?)\b/g;

describe.each(VIEW_FILES)('%s', file => {
  const source = code(read(file));
  it('spells no colour of its own: no #RRGGBB, no rgb(), no white or black by name', () => {
    expect(source.match(RAW_HEX) ?? []).toEqual([]);
    expect(source.match(NAMED_COLOUR) ?? []).toEqual([]);
    expect(RGB.test(source)).toBe(false);
  });
  it('spaces itself on the ladder: a padding, a margin or a gap is a name or a step of 0 1 2 4 8 12 16 20 24 32 48', () => {
    const off = [...source.matchAll(SPACING)].map(match => Math.abs(Number(match[1] ?? match[2]))).filter(value => !LADDER.has(value));
    expect([file, off]).toEqual([file, []]);
  });
  it('draws no platform hairline and no border on one edge (a line is `ruleWidth`, a full border or nothing)', () => {
    expect(/\bhairlineWidth\b/.test(source)).toBe(false);
    expect(/\bborder(?:Top|Bottom)Width\b/.test(source)).toBe(false);
  });
  it('takes no container from the system tokens (a record, a panel or a note is a Surface)', () => {
    expect(source).not.toMatch(/import\s*\{[^}]*\b(?:raisedItem|cardCompact|floating|inset)\b[^}]*\}\s*from\s*'[^']*system\/tokens'/);
  });
  it('imports no icon library: a glyph is asked of `Glyph` by name', () => {
    expect(source).not.toMatch(/phosphor-react-native/);
  });
});

describe('the width of the window', () => {
  it('is read only by the two files the system\'s ratchet lists, and by none of the others', () => {
    const readers = VIEW_FILES.filter(file => /useWindowDimensions\(\)|Dimensions\.get\(/.test(code(read(file))));
    expect(readers.sort()).toEqual(['AgendaRow.tsx', 'AgendaScreen.tsx']);
  });
});
