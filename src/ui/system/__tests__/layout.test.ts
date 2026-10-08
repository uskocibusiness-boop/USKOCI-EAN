import { readFileSync } from 'fs';
import { join } from 'path';
import { layout, ruleWidth } from '../layout';
import { sys } from '../tokens';

/**
 * The grid every screen stands on (composition spec 2026-10-07, section 2): the numbers of `layout.ts` are the contract that
 * `PRIMITIVI_UGOVOR_20261008.md` locks, so they are pinned here by name, and tied to the spacing scale they are built from.
 */
describe('layout: the values of the contract', () => {
  it('is exactly the agreed set of names and values', () => {
    expect(layout).toEqual({
      gutter: 20, mapInset: 16, chatList: 16, chatComposer: 12, section: 24, group: 12, card: 16, zone: 32, touch: 48,
      rowMin: 64, rowMinPlain: 56, slot: 40, slotFace: 56, maxWidth: 640,
    });
  });

  it('has one divider, 1 dp, and it is not the platform\'s hairline', () => {
    expect(ruleWidth).toBe(1);
  });
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

describe('layout.ts stands alone', () => {
  const source = readFileSync(join(__dirname, '..', 'layout.ts'), 'utf8');

  it('imports nothing: `tokens.ts` includes it later, and a token file is not reached by a cycle through its own numbers', () => {
    expect(source).not.toMatch(/^\s*import\b/m);
    expect(source).not.toMatch(/from\s+['"][^'"]*tokens['"]/);
    expect(source).not.toMatch(/\brequire\(/);
  });

  it('exports exactly `layout` and `ruleWidth`', () => {
    const names = [...source.matchAll(/^export const (\w+)/gm)].map(match => match[1]);
    expect(names).toEqual(['layout', 'ruleWidth']);
  });
});
