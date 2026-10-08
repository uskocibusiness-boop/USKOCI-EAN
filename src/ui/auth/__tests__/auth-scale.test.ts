import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { layout } from '../../system/layout';
import { sys } from '../../system/tokens';

/**
 * ONE SCALE FOR THE SIGN-IN SCREENS (F7, 2026-10-08; composition spec 2026-10-07, 4.16: "0 values off the scale in auth/*").
 *
 * The sign-in sheet, the recovery screens and the questions before a permission were built with their own numbers: an edge of 22,
 * paddings and gaps of 5, 9, 14, 15, 17 and 20, corners of 9 and 32, type sizes read from the old theme file, pale (transparent)
 * disabled buttons and a phone's own typeface instead of Inter. The sheet's rhythm is now the app's: space is 4 / 8 / 12 / 16 / 24 /
 * 32 / 48 (`sys.space`, `layout`), the edge is `layout.gutter` (20) and is never spelled as a number, a corner is a `sys.radius`, a
 * letter is a `T` (Inter) or a token, a colour is a `sys.color`. This guard keeps the screens there. It reads the source text, so a
 * number that a screen spells for itself is exactly what fails; tokens and expressions of tokens are never a number.
 */
const repo = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(repo, path), 'utf8');
const sources = (dir: string): string[] => readdirSync(join(repo, dir), { withFileTypes: true }).flatMap(entry => {
  const path = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path);
  return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
});

/** The files of the sign-in family. The gallery route (`dizajn-prijava.tsx`) also holds the application and rating scenes of other teams and is not in it. */
const SCOPE = ['src/app/auth.tsx', 'src/app/oporavak.tsx', ...sources('src/ui/auth'), ...sources('src/ui/permissions')];

/** A line that is only a comment explains a number to a programmer and is never drawn. */
const codeOf = (source: string) => source.split(/\r?\n/).filter(line => !/^\s*(?:\/\/|\*|\/\*)/.test(line)).join('\n');

const SCALE = [0, 4, 8, 12, 16, 24, 32, 48];
const SPACING = /\b(?:padding(?:Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?|margin(?:Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?|gap|rowGap|columnGap)\s*:\s*(-?\d+(?:\.\d+)?)(?![\w.])/g;
const spacingOffScale = (source: string): string[] => [...codeOf(source).matchAll(SPACING)].map(match => match[0]).filter(found => {
  const value = Number(found.split(':')[1]);
  return !SCALE.includes(value);
});

const LITERALS: readonly [string, RegExp][] = [
  ['a type size of its own (use a T variant or sys.type)', /\bfontSize\s*:\s*\d/],
  ['a line height of its own', /\blineHeight\s*:\s*\d/],
  ['a corner of its own (use sys.radius)', /\bborderRadius\s*:\s*\d/],
  ['a pale control (a disabled control is the system\'s grey well with muted words, never transparent)', /\bopacity\s*:\s*(?:0?\.\d|0\b)/],
  ['a raw colour', /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_])/i],
  ['a hairline of its own (the rule is 1 dp: ruleWidth)', /\bhairlineWidth\b/],
  ['a dashed edge', /\bborderStyle\s*:\s*['"]dashed['"]/],
  ['the phone\'s own typeface (a Text of react-native instead of T)', /import\s*\{[^}]*\bText\b[^}]*\}\s*from\s*'react-native'/],
  ['the old theme scale (read sys, the one token surface)', /from\s+'[^']*theme\/tokens'/],
  ['a window width read of its own', /\buseWindowDimensions\(\)\s*\.\s*width\b|\bDimensions\s*\.\s*get\s*\(/],
];

describe('the sign-in screens stand on the one scale', () => {
  it('finds a number that is off the scale, and lets a token, an expression of tokens and the scale itself through', () => {
    expect(spacingOffScale('padding: 22, gap: 14, marginTop: -6, paddingHorizontal: 20, rowGap: 10')).toEqual(
      ['padding: 22', 'gap: 14', 'marginTop: -6', 'paddingHorizontal: 20', 'rowGap: 10']);
    expect(spacingOffScale('padding: sys.space.lg, gap: layout.section, paddingBottom: layout.zone + sys.space.base')).toEqual([]);
    expect(spacingOffScale('gap: 0, gap: 4, gap: 8, padding: 12, padding: 16, margin: 24, paddingTop: 32, marginBottom: 48')).toEqual([]);
    expect(spacingOffScale('// padding: 22 said in a comment\n * gap: 14')).toEqual([]);
  });

  it('the scale and the edge are the system\'s: 4 / 8 / 12 / 16 / 24 / 32 / 48, and an edge of 20 that is not a space', () => {
    expect([sys.space.xs, sys.space.sm, sys.space.md, sys.space.base, sys.space.xl, sys.space.xxl, sys.space.huge]).toEqual([4, 8, 12, 16, 24, 32, 48]);
    expect([layout.gutter, layout.section, layout.group, layout.zone, layout.touch]).toEqual([20, 24, 12, 32, 48]);
  });

  it('the family is the files it says it is', () => {
    expect(SCOPE).toEqual(expect.arrayContaining(['src/app/auth.tsx', 'src/app/oporavak.tsx', 'src/ui/auth/AuthControls.tsx',
      'src/ui/auth/AuthFlowFrame.tsx', 'src/ui/auth/AuthFormStep.tsx', 'src/ui/permissions/PermissionAskHost.tsx']));
    expect(SCOPE.some(path => path.includes('__tests__'))).toBe(false);
  });

  it.each(SCOPE)('%s spells no padding, margin or gap off the scale', path => {
    expect(spacingOffScale(read(path))).toEqual([]);
  });

  it.each(SCOPE)('%s spells no size, corner, colour, hairline or typeface of its own', path => {
    const code = codeOf(read(path));
    expect(LITERALS.filter(([, pattern]) => pattern.test(code)).map(([what]) => what)).toEqual([]);
  });
});
