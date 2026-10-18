import { readFileSync } from 'fs';
import { join } from 'path';
import { layout, ruleWidth } from '../layout';
import { sys } from '../tokens';

/** Defaults may evolve; accessibility, finite dimensions and grouping remain contracts. */
describe('layout geometry and grouping',()=>{
  it('has finite positive role dimensions and bounded reading width',()=>{
    for(const value of Object.values(layout)){expect(Number.isFinite(value)).toBe(true);expect(value).toBeGreaterThan(0);}
    expect(layout.maxWidth).toBeGreaterThanOrEqual(412);expect(layout.maxWidth).toBeLessThanOrEqual(900);
    expect(layout.group).toBeLessThanOrEqual(layout.section);expect(layout.section).toBeLessThanOrEqual(layout.zone);
  });
  it('keeps a visible default divider without freezing its optical thickness',()=>{expect(ruleWidth).toBeGreaterThan(0);expect(ruleWidth).toBeLessThanOrEqual(2);});
});

describe('layout is built on the spacing scale, and the edge is the one value that is not a space', () => {
  it('every distance between things is a step of sys.space', () => {
    expect(layout.section).toBe(sys.space.xl);
    expect(layout.group).toBe(sys.space.md);
    expect(layout.card).toBe(sys.space.base);
    expect(layout.zone).toBe(sys.space.xxl);
    expect(layout.chatComposer).toBe(sys.space.md);
    expect(layout.chatList).toBe(sys.space.base);
    expect(layout.mapInset).toBe(sys.space.base);
  });

  it('the edge of the screen is `sys.space.lg` (20): the one step that is an edge and never a distance between things', () => {
    expect(layout.gutter).toBe(sys.space.lg);
    // The distances of the layout are all steps of the scale except the edge, which is read as the edge, not as a gap.
    const steps = new Set<number>(Object.values(sys.space));
    for (const key of ['mapInset', 'chatList', 'chatComposer', 'section', 'group', 'card', 'zone'] as const) expect([key, steps.has(layout[key])]).toEqual([key, true]);
  });

  it('a touch is never smaller than the system\'s minimum, and a row is at least a touch high', () => {
    expect(layout.touch).toBeGreaterThanOrEqual(sys.touch.min);
    expect(layout.rowMinPlain).toBeGreaterThanOrEqual(layout.touch);
    expect(layout.rowMin).toBeGreaterThan(layout.rowMinPlain);
    expect(layout.slotFace).toBeGreaterThan(layout.slot);
  });
});

describe('layout.ts depends only on pure shared values', () => {
  const source = readFileSync(join(__dirname, '..', 'layout.ts'), 'utf8');

  it('avoids runtime UI dependencies and cyclic sys imports', () => {
    // Pure base tokens are safe; runtime UI dependencies would create cycles.
    expect(source).not.toMatch(/from\s+['"](?:react|react-native|[^'"]*system\/tokens)['"]/);
    expect(layout.touch).toBeGreaterThanOrEqual(48);
    expect(source).not.toMatch(/\brequire\(/);
  });

  it('exports the shared layout and divider roles', () => {
    const names = [...source.matchAll(/^export const (\w+)/gm)].map(match => match[1]);
    expect(names).toEqual(expect.arrayContaining(['layout', 'ruleWidth']));
  });
});
