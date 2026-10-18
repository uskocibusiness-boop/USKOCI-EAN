import { layout } from '../layout';
import { sys } from '../tokens';
import { read, withoutComments } from './ratchetKit';

/** Shared primitives use central spacing roles. Optical defaults may evolve;
 * this check prevents new component-local scales, not new named roles or hairlines. */
/** The seven files of the grid: the numbers, and the six primitives that stand on them. */
const GRID_FILES = ['layout', 'Screen', 'Section', 'ListRow', 'FactRow', 'KeyValueRow', 'Surface'].map(name => `src/ui/system/${name}.${name === 'layout' ? 'ts' : 'tsx'}`);
const LADDER = new Set<number>([0, 1, 2, ...Object.values(sys.space)]);

const SPACING_KEY = /\b(?:padding|margin)(?:Top|Bottom|Left|Right|Horizontal|Vertical|Start|End)?\s*:\s*(-?\d+(?:\.\d+)?)\b|\b(?:gap|rowGap|columnGap)\s*:\s*(-?\d+(?:\.\d+)?)\b/g;
/** Every numeric spacing literal in a source: the number as written (a name is not a literal, and is the way to write a space). */
const spacingLiterals = (source: string): number[] => [...withoutComments(source).matchAll(SPACING_KEY)].map(match => Math.abs(Number(match[1] ?? match[2])));

describe('the scanner finds a spacing literal and nothing else', () => {
  it('reads each way a space is written as a number', () => {
    expect(spacingLiterals('{ padding: 12, margin: -6, gap: 10 }')).toEqual([12, 6, 10]);
    expect(spacingLiterals('{ paddingHorizontal: 14, marginTop: 28, rowGap: 22, columnGap: 18, paddingStart: 6 }')).toEqual([14, 28, 22, 18, 6]);
    expect(spacingLiterals('s = { gap:3 }')).toEqual([3]);
  });

  it('lets a name through: a space written as `sys.space.md`, `-sys.space.md` or `layout.group` is the way', () => {
    expect(spacingLiterals('{ padding: sys.space.md, margin: -sys.space.md, gap: layout.group, paddingTop: sys.space.sm }')).toEqual([]);
  });

  it('does not take a size for a space, and does not read a comment', () => {
    expect(spacingLiterals('{ width: 40, height: 6, minHeight: 56, borderRadius: 10, fontSize: 14 }')).toEqual([]);
    expect(spacingLiterals('// padding: 14\n/* gap: 10 */ { gap: 8 }')).toEqual([8]);
  });
});

describe('shared grid primitives use central spacing', () => {
  it.each(GRID_FILES)('%s spells no padding, margin or gap off the ladder', path => {
    const off = spacingLiterals(read(path)).filter(value => !LADDER.has(value));
    expect([path, off]).toEqual([path, []]);
  });

  it('looks at real files: each primitive is long enough and spaces itself by name, so an empty read cannot pass for a clean one', () => {
    expect(new Set(GRID_FILES).size).toBe(GRID_FILES.length);
    for (const path of GRID_FILES) expect(read(path)).toMatch(/export (?:const|function|type)/);
    for (const path of GRID_FILES.filter(file => !/layout.ts$|FactRow|Surface/.test(file))) expect([path, /sys.space.|layout./.test(read(path))]).toEqual([path, true]);
  });
});

describe('the ladder is the spacing scale plus the two fine steps', () => {
  it('is every step of sys.space (4 · 8 · 12 · 16 · 20 · 24 · 32 · 48), and 0, 1 and 2 for a line and a half-leading', () => {
    for (const step of Object.values(sys.space)) expect([step, LADDER.has(step)]).toEqual([step, true]);
    for(const value of LADDER){expect(Number.isFinite(value)).toBe(true);expect(value).toBeGreaterThanOrEqual(0);}
  });

  it('every distance in layout.ts is on it', () => {
    for (const key of ['mapInset', 'chatList', 'chatComposer', 'section', 'group', 'card', 'zone', 'gutter'] as const) expect([key, LADDER.has(layout[key])]).toEqual([key, true]);
  });
});
