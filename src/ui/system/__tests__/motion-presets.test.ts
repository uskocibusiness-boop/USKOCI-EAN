import { readFileSync } from 'fs';
import { join } from 'path';
import { getMotionPreset, motionTokens as motion } from '../motionTokens';

const within = (value: number, min: number, max: number) => {
  expect(Number.isFinite(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
};

it('offers purpose-specific variants without one universal animation duration', () => {
  expect(Object.keys(motion.categories)).toEqual(expect.arrayContaining(['assistant', 'content', 'feedback', 'navigation', 'press', 'sheet']));
  for (const variants of Object.values(motion.categories)) expect(Object.keys(variants).length).toBeGreaterThan(0);
  expect(getMotionPreset('content', 'replace')).toBe(motion.categories.content.replace);
  expect(getMotionPreset('sheet', 'open')).toBe(motion.categories.sheet.open);
  const timings = [motion.press, motion.toggle, motion.enter, motion.exit, motion.sheetClose];
  expect(new Set(timings).size).toBeGreaterThan(2);
});

it('frequent press feedback stays brief and a large quiet surface need not move', () => {
  for (const preset of [motion.categories.press.button, motion.categories.press.row]) {
    within(preset.duration, 80, 150);
    within(preset.scale, 0.94, 1);
    expect(preset.release).toBe(motion.spring);
  }
  expect(motion.categories.press.button.scale).toBeLessThan(motion.categories.press.row.scale);
  expect(motion.categories.press.row.scale).toBeLessThan(1);
  expect(motion.categories.press.quiet).toMatchObject({ kind: 'static', duration: 0, scale: 1 });
});

it('feedback and content settle quickly, with exit no slower than entry', () => {
  for (const preset of Object.values(motion.categories.feedback)) within(preset.duration, 100, 300);
  for (const preset of Object.values(motion.categories.content)) within(preset.duration, 100, 300);
  expect(motion.categories.content.exit.duration).toBeLessThanOrEqual(motion.categories.content.reveal.duration);
  within(motion.categories.content.reveal.translateY, 0, 16);
  expect(motion.categories.content.replace.translateY).toBe(0);
});

it('uses bounded easing curves with a prompt start and keeps new navigation native', () => {
  for (const value of motion.easeOut) within(value, 0, 1);
  expect(motion.easeOut[1]).toBeGreaterThan(motion.easeOut[0]);
  expect(motion.categories.navigation.stack).toEqual({ kind: 'native', animation: 'default' });
  expect(motion.categories.navigation.tab).toEqual({ kind: 'native', animation: 'none' });
  expect(motion.categories.navigation.stack).not.toHaveProperty('duration');
});

it('sheet content does not overshoot its edge and command dismissal is short', () => {
  const { config } = motion.categories.sheet.open;
  expect(config.overshootClamping).toBe(true);
  expect(config.stiffness).toBeGreaterThan(0); expect(config.damping).toBeGreaterThan(0); expect(config.mass).toBeGreaterThan(0);
  within(motion.categories.sheet.close.duration, 100, 250);
  within(motion.categories.sheet.dialog.duration, 120, 300);
  within(motion.categories.sheet.dialog.fromScale, 0.9, 1);
});

it('assistant loops are explicitly scoped and slower than interaction feedback', () => {
  for (const preset of Object.values(motion.categories.assistant)) {
    expect(preset.kind).toBe('loop'); expect(preset.requiresActiveScreen).toBe(true);
    expect(preset.halfCycle).toBeGreaterThan(motion.toggle);
  }
  expect(motion.categories.assistant.thinking.halfCycle).toBe(motion.loop.typing);
  expect(motion.categories.assistant.listening.halfCycle).toBe(motion.loop.glow);
  expect(motion.categories.assistant.illustration.halfCycle).toBe(motion.assistant.floatHalf);
});

it('preserves legacy aliases while keeping the data independent of React and native runtimes', () => {
  for (const key of ['press','toggle','enter','exit','push','camera','stagger','easeOut','tickGap','pressScale',
    'scale','spring','sheetSpring','sheetClose','dialog','loop','assistant','radarSweep','arrive']) expect(motion).toHaveProperty(key);
  expect(motion.pressScale).toBe(motion.scale.button);
  expect(motion.sheetSpring).toBe(motion.categories.sheet.open.config);
  const source = readFileSync(join(__dirname, '../motionTokens.ts'), 'utf8');
  expect(source).not.toMatch(/^import\s/m);
  expect(source).not.toMatch(/\b(?:setTimeout|setInterval|requestAnimationFrame)\s*\(/);
});
