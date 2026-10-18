import { brandFrame, INTRO_DURATION_MS } from '../../ui/entry/spojBrandMath';
import frames from './fixtures/spoj-brand-reference-frames.json';

// Previous browser samples provide diverse inputs, not frozen visual coordinates.
it.each(frames)('keeps brand geometry finite and compositing bounded at $time ms / $phone.width px', input => {
  const frame=brandFrame(input.time,input.phone,input.logo);
  expect(frame.parts.length).toBeGreaterThan(0);
  for(const value of Object.values(frame.mark))expect(Number.isFinite(value)).toBe(true);
  expect(frame.mark.scale).toBeGreaterThan(0);
  for(const part of frame.parts){for(const value of Object.values(part))expect(Number.isFinite(value)).toBe(true);expect(part.opacity).toBeGreaterThanOrEqual(0);expect(part.opacity).toBeLessThanOrEqual(1);expect(part.sx).toBeGreaterThan(0);expect(part.sy).toBeGreaterThan(0);}
  expect(frame.wordClipWidth).toBeGreaterThanOrEqual(0);
});
it('provides the exact final state immediately with reduced motion', () => {
  const { phone, logo } = frames[0];
  const final = brandFrame(0, phone, logo, true);
  expect(final).toEqual(brandFrame(INTRO_DURATION_MS, phone, logo));
  expect(final.choices.enabled).toBe(true);
  expect(final.done).toBe(true);
  const later=brandFrame(INTRO_DURATION_MS*2,phone,logo);
  expect(later.mark).toEqual(final.mark); expect(later.parts).toEqual(final.parts);
});
it('rejects unmeasured or non-finite geometry', () => {
  const { phone, logo } = frames[0];
  expect(() => brandFrame(0, phone, { ...logo, width: 0 })).toThrow(RangeError);
  expect(() => brandFrame(NaN, phone, logo)).toThrow(RangeError);
});
