import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { Platform } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { brandAction, card, cardCompact, fieldBox, floating, sheetLift, sys } from '../tokens';
import { palette } from '../../../theme/tokens';
import { LARGE_TEXT_SCALE, NARROW_WIDTH, layoutClassFor, useLayoutClass, useWindowRoom, type LayoutClassResult, type WindowRoom } from '../textScale';

/** The window the layout-class hook reads; the one place a test stands in for the device. */
let mockWindow = { width: 411, height: 900, scale: 2, fontScale: 1 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => mockWindow;
    return Reflect.get(target, key);
  } });
});

/**
 * One token source and one motion source (2026-09-24). The files below were moved onto `sys` and onto the one
 * reduced-motion store; this guard keeps them there. A colour, a scale value or a reduced-motion read that a screen
 * spells for itself is exactly what made the app speak with several voices, so the check is on the source text.
 *
 * UI/UX pass, 2026-10-02 (item 1.2): the same guard now also holds the motion literals (a `duration:`, a spring or a
 * press scale spelled outside `tokens.ts`) and the window width (read only by `useLayoutClass`). Both are RATCHETS: the
 * allow-lists below name today's offenders so the suite is green now, and they can only shrink. A file that is not on a
 * list, or that spells more literals than its entry allows, fails. When you move a literal onto a token, lower or delete
 * that file's entry in the same change; never add one.
 */
const repo = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(repo, path), 'utf8');

/** Moved from `theme/tokens`, `aiFirst/tokens` or `v2/tokens` to `sys`. */
const TOKEN_SCOPE = [
  'src/ui/Press.tsx', 'src/ui/Text.tsx', 'src/ui/system/Segmented.tsx', 'src/ui/BuildIdentity.tsx',
  'src/ui/location/ResolvedPinMap.tsx', 'src/ui/media/AuthorizedPhoto.tsx', 'src/ui/media/AgreementPhotoComposer.tsx',
  'src/ui/v2/IntakePresentation.tsx', 'src/app/(app)/pregled-zadatka.tsx', 'src/ui/v2/DiscoveryMap.tsx',
  'src/ui/v2/DiscoveryMap.web.tsx', 'src/ui/v2/icons.tsx',
];
/** Read reduced motion from `ui/system/motion`, never from Reanimated's launch-time value. */
const MOTION_SCOPE = [
  'src/ui/Press.tsx', 'src/ui/v2/DiscoveryMap.tsx', 'src/ui/v2/MarketplacePresentation.tsx', 'src/ui/v2/IntakePresentation.tsx',
  'src/ui/calendar/CalendarControls.tsx', 'src/ui/v2/ApplicationSelectionPresentation.tsx', 'src/ui/system/Appear.tsx',
  'src/hooks/useSystemReducedMotion.ts', 'src/ui/system/motion.ts', 'src/ui/v2/ApplicationComposerPresentation.tsx',
  'src/ui/reviews/AgreementReviewScreen.tsx', 'src/ui/reviews/AgreementReviewPresentation.tsx',
];
/** Held hand-written colours until 2026-09-24. */
const COLOUR_SCOPE = [
  'src/ui/home/HomePresentation.tsx', 'src/ui/home/HomeIllustration.tsx', 'src/ui/Text.tsx',
  'src/ui/v2/TaskCard.tsx', 'src/ui/v2/ApplicationComposerPresentation.tsx', 'src/ui/reviews/AgreementReviewScreen.tsx',
  'src/ui/reviews/AgreementReviewPresentation.tsx', 'src/app/dizajn-prijava.tsx',
];
const EVERY_SCOPED_FILE = [...new Set([...COLOUR_SCOPE, ...TOKEN_SCOPE, ...MOTION_SCOPE])];

const RAW_HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_])/gi;
const NAMED_COLOUR = /\b(?:fill|stroke|stopColor|color|backgroundColor|borderColor|tintColor|shadowColor)\s*[=:]\s*['"](?:white|black)['"]/g;

it.each(EVERY_SCOPED_FILE)('%s spells no colour of its own (no raw #RRGGBB, no white or black by name)', path => {
  const source = read(path);
  expect(source.match(RAW_HEX) ?? []).toEqual([]);
  expect(source.match(NAMED_COLOUR) ?? []).toEqual([]);
});

it.each(TOKEN_SCOPE)('%s reads tokens only from sys', path => {
  const source = read(path);
  expect(source).not.toMatch(/from\s+'[^']*(?:theme\/tokens|aiFirst\/tokens|v2\/tokens)'/);
  // Inside the v2 and aiFirst folders, './tokens' is the old file of that folder.
  if (/src\/ui\/(?:v2|aiFirst)\//.test(path)) expect(source).not.toMatch(/from\s+'\.\/tokens'/);
});

it.each(MOTION_SCOPE)('%s reads reduced motion from the one store', path => {
  const source = read(path);
  expect(source).not.toMatch(/import[^;]*\buseReducedMotion\b[^;]*from\s+'react-native-reanimated'/);
});

it('the one store never imports Reanimated, so every screen suite can load it', () => {
  expect(read('src/ui/system/motion.ts')).not.toMatch(/react-native-reanimated/);
});

it('the motion scale is the agreed one, and it lives in sys only', () => {
  expect({ press: sys.motion.press, toggle: sys.motion.toggle, enter: sys.motion.enter, exit: sys.motion.exit,
    push: sys.motion.push, camera: sys.motion.camera, stagger: sys.motion.stagger })
    .toEqual({ press: 120, toggle: 180, enter: 240, exit: 160, push: 240, camera: 360, stagger: 40 });
  expect(sys.motion.easeOut).toEqual([0.23, 1, 0.32, 1]);
  // Exit is shorter than entry.
  expect(sys.motion.exit).toBeLessThan(sys.motion.enter);
  expect(read('src/theme/tokens.ts')).not.toMatch(/export const motion\b/);
});

// UI/UX pass, item 1.2: the values that screens used to spell for themselves now have a name, in sys only (rules R2, R3,
// R6 and R8 in `tokens.ts`). `pressScale` stays the number the Press component reads until it moves onto the `scale` ladder.
// Motion pass, 2026-10-08 (M-01, M-07b): `push` moved to its 240 target together with the transition spec that reads it
// (`push-transition.test.ts`); the tokens nothing read (`easeInOut`, `sheet`, `springSheet`, `tab`, `fade`) are gone, and
// `loop` and `arrive` are now read by `system/Arrive`.
it('the motion tiers of the UI/UX pass exist, with the agreed values', () => {
  expect(sys.motion.loop).toEqual({ breath: 700, typing: 520, glow: 1600 });
  expect(sys.motion.arrive).toEqual({ duration: 800, easing: [0.22, 0.8, 0.25, 1] });
  // R3: one critically damped spring for every sheet; it never overshoots, because a sheet carries text.
  expect(sys.motion.sheetSpring).toEqual({ stiffness: 300, damping: 30, mass: 1, overshootClamping: true });
  // R8: the press-scale ladder, and the old single number is the button rung.
  expect(sys.motion.scale).toEqual({ button: 0.97, row: 0.985, none: 1 });
  expect(sys.motion.pressScale).toBe(sys.motion.scale.button);
  // R5: the least time between two haptic ticks (`system/haptics`).
  expect(sys.motion.tickGap).toBe(120);
  expect({ push: sys.motion.push, press: sys.motion.press, spring: sys.motion.spring })
    .toEqual({ push: 240, press: 120, spring: { duration: 400, dampingRatio: 0.85 } });
  // R2: a screen that is pushed ENTERS, so it is no longer than something arriving; a quiet loop is slower than any response.
  expect(sys.motion.push).toBeLessThanOrEqual(sys.motion.enter);
  expect(Math.min(...Object.values(sys.motion.loop))).toBeGreaterThan(sys.motion.toggle);
  // Ladder order: a bigger surface gives less.
  expect(sys.motion.scale.button).toBeLessThan(sys.motion.scale.row);
  expect(sys.motion.scale.row).toBeLessThan(sys.motion.scale.none);
});

// Motion pass (M-07b): a token nothing reads is a second place to look and a second value to keep in step. These five had no
// reader anywhere under `src`; one that is needed again is added WITH the code that reads it, and this list loses its name.
it('the five motion tokens that nothing read are gone', () => {
  for (const dead of ['easeInOut', 'sheet', 'springSheet', 'tab', 'fade']) expect(sys.motion).not.toHaveProperty(dead);
});

it('the one sheet spring lives in sys, and ProductSheet only re-exports it', () => {
  const source = read('src/ui/product/ProductSheet.tsx');
  expect(source).toMatch(/export const SHEET_SPRING = sys\.motion\.sheetSpring;/);
  expect(source).not.toMatch(/\b(?:damping|stiffness)\s*:/);
});

/** Every leaf of a token group with its dotted name: `sys.color.art` is a group of tones, not a colour. */
const colourLeaves = (group: Record<string, unknown>, prefix = ''): [string, unknown][] => Object.entries(group)
  .flatMap(([key, value]) => value !== null && typeof value === 'object'
    ? colourLeaves(value as Record<string, unknown>, `${prefix}${key}.`) : [[`${prefix}${key}`, value] as [string, unknown]]);

// `sys.color.art` is the tone set of a FACT picture (FactArt); `sys.art` is the Home drawing's own colours. Two groups with one
// word (wave-1 review): the names below carry the whole path, so a failure says which of them it is.
it('every named colour in sys is a real colour value, named by its whole path (sys.color.* and sys.art.* are different groups)', () => {
  for (const [name, value] of [...colourLeaves(sys.color, 'sys.color.'), ...colourLeaves(sys.art, 'sys.art.')]) {
    expect([name, value]).toEqual([name, expect.stringMatching(/^#(?:[0-9A-F]{6}|[0-9A-F]{8})$/)]);
  }
});

// Emulator critique B6 (2026-09-24): 16/17, 20/26 and 9/13 were corners that nearly agree, so a field and the button
// beside it differed by a pixel. Three steps and the capsule; the role names stay and share them.
// Card review r3 item 8 (2026-09-24): the checkbox's 6 was a magic number dressed as a nested corner. It is now the one
// named corner below the scale, `check`, and the scale itself is unchanged.
it('the corner scale is 12 / 24 / 28 / pill, and a control and the primary action share one corner', () => {
  expect(sys.radius).toEqual({ badge: 12, chip: 12, control: 12, primary: 12, cardCompact: 24, card: 24, sheet: 28, pill: 999, check: 6 });
  const { check, ...scale } = sys.radius;
  expect(new Set(Object.values(scale))).toEqual(new Set([12, 24, 28, 999]));
  expect(check).toBe(6);
  // The filter checkbox retains its small corner. Saving a place is now the confirmation itself;
  // location forms intentionally have no extra checkbox (owner decision, 2026-09-24).
  expect(read('src/ui/v2/offer/ChoiceRow.tsx')).toMatch(/borderRadius: sys\.radius\.check/);
  expect(brandAction.borderRadius).toBe(fieldBox.borderRadius);
});

// Verifier r3b vc, fix 2: the checkbox corner has one name. The magic `nested(sys.radius.control, 6)` it replaced must
// not come back anywhere under src.
it('no file under src still spells the checkbox corner as a nested control corner', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(repo, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:ts|tsx)$/.test(entry.name) && !path.endsWith('one-token-source.test.ts')
        && read(path).includes('nested(sys.radius.control, 6)')) offenders.push(path);
    }
  };
  walk('src');
  expect(offenders).toEqual([]);
});

// Review r3b (Zadaci, low): a sheet's lift is the system's, not a shadow each sheet spells for itself.
// A physically FULL list joins the search surface: clear its lift, otherwise restore the exact docked token.
// Exempt only that complete branch, not arbitrary reads/writes of shadow properties or other token fallbacks.
const DOCKED_FULL_LIFT = /sheetLift\.docked\.boxShadow\s*\?\s*\{\s*boxShadow\s*:\s*full\s*\?\s*\[\s*\]\s*:\s*sheetLift\.docked\.boxShadow\s*\}\s*:\s*\{\s*elevation\s*:\s*full\s*\?\s*0\s*:\s*sheetLift\.docked\.elevation\s*\}/g;
const INLINE_SHEET_SHADOW = /rgba\s*\(|\bboxShadow\b|\belevation\s*:|\bshadow(?:Color|Opacity|Radius|Offset)\s*:/;
const withoutDockedFullLift = (source: string, form: string) => form === 'docked'
  ? source.replace(DOCKED_FULL_LIFT, 'DOCKED_FULL_LIFT') : source;

it('the list sheet and the PeekSheet take their lift from sheetLift and spell no shadow colour', () => {
  expect(sheetLift.docked).toEqual(Platform.OS === 'android' && Number(Platform.Version) < 28 ? { elevation: 6 } : { boxShadow: expect.stringMatching(/^0px -/) });
  expect(sheetLift.detached).toEqual(Platform.OS === 'android' && Number(Platform.Version) < 28 ? { elevation: 6 } : { boxShadow: expect.any(String) });
  for (const [path, form] of [['src/ui/v2/discovery/DiscoveryListSheet.tsx', 'docked'], ['src/ui/system/PeekSheet.tsx', 'detached']]) {
    const source = read(path);
    expect(source).toMatch(new RegExp(`\\.\\.\\.sheetLift\\.${form}\\b`));
    expect(withoutDockedFullLift(source, form)).not.toMatch(INLINE_SHEET_SHADOW);
  }
});

it('the FULL lift exemption cannot admit raw shadows, nonzero elevation, another token or detached sheets', () => {
  const allowed = 'sheetLift.docked.boxShadow ? { boxShadow: full ? [] : sheetLift.docked.boxShadow } : { elevation: full ? 0 : sheetLift.docked.elevation }';
  expect(withoutDockedFullLift(allowed, 'docked')).not.toMatch(INLINE_SHEET_SHADOW);
  const forbidden = [
    allowed.replace('[]', "'0px -2px 12px rgba(0, 0, 0, 0.08)'"),
    allowed.replace('full ? 0', 'full ? 6'),
    allowed.replaceAll('sheetLift.docked', 'sheetLift.detached'),
    `${allowed}, boxShadow: '0px -2px 12px #000000'`,
    `${allowed}, shadowOpacity: 0.08`,
  ];
  for (const source of forbidden) expect(withoutDockedFullLift(source, 'docked')).toMatch(INLINE_SHEET_SHADOW);
  expect(withoutDockedFullLift(allowed, 'detached')).toMatch(INLINE_SHEET_SHADOW);
});

// Emulator critique B5 (2026-09-24): a list card wore a border and a shadow. A card lying on the white screen is drawn
// by its hairline; a shadow says "this floats", and only floating layers keep it.
// Round 2c (verifier vf, should 4): with the shadow gone the edge is the card's only outline, so it is V28's measured card
// edge `cardLine`, not the faintest `line` this pinned before (about 1.17:1 on white, next to no edge at all).
it.each([['card', card], ['cardCompact', cardCompact]] as const)('%s is a hairline card with no shadow', (_name, style) => {
  expect(style).toMatchObject({ borderWidth: 1, borderColor: sys.color.cardLine, backgroundColor: sys.color.surface, borderRadius: 24 });
  for (const key of ['boxShadow', 'elevation', 'shadowColor', 'shadowOpacity', 'shadowRadius', 'shadowOffset']) expect(style).not.toHaveProperty(key);
  expect(floating).toEqual(expect.objectContaining(Platform.OS === 'android' && Number(Platform.Version) < 28 ? { elevation: 1 } : { boxShadow: expect.any(String) }));
});

it('the second motion scale is gone with the v2 token file, and no tone reads below AA on green', () => {
  expect(existsSync(join(repo, 'src/ui/v2/tokens.ts'))).toBe(false);
  // onDarkMuted read 2.4:1 on sys.color.green; it passed only on the retired forest ground.
  expect(sys.color).not.toHaveProperty('onDarkMuted');
  expect(read('src/ui/Text.tsx')).not.toMatch(/'onDarkMuted'|onDarkMuted:/);
  // Round 2c (verifier vf, nit): nothing read the theme palette's copy either, so it is gone there too.
  expect(palette).not.toHaveProperty('onDarkMuted');
});

// ---------------------------------------------------------------------------------------------------------------------
// One tone rule (UI/UX pass, item 1.2; audit ICO-03): the colours of a fact picture are tokens, derived from the UI green.
// ---------------------------------------------------------------------------------------------------------------------
const channels = (hex: string) => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255)
  .map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => { const [r, g, b] = channels(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

describe("sys.color.art, the tones a FACT picture is drawn in (not sys.art: those are the Home drawing's colours)", () => {
  const tones = Object.entries(sys.color.art);

  it('keeps fact tones separate from Home illustration colors', () => {
    expect(Object.keys(sys.color.art)).toEqual(['brand', 'accent', 'quiet', 'danger']);
    expect(Object.keys(sys.art)).not.toContain('brand');
    expect(Object.keys(sys.art)).toContain('leafDeep');
  });

  it('is four tones with the four parts a picture needs, all real colours', () => {
    expect(tones.map(([name]) => name)).toEqual(['brand', 'accent', 'quiet', 'danger']);
    for (const [name, tone] of tones) {
      expect([name, Object.keys(tone)]).toEqual([name, ['front', 'edge', 'light', 'soft']]);
      for (const part of Object.values(tone)) expect(part).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('the default tone IS the UI green, so an icon, a title and the primary action agree (no second emerald)', () => {
    expect(sys.color.art.brand.front).toBe(sys.color.green);
    expect(sys.color.art.accent.front).toBe(sys.color.orange);
    expect(sys.color.art.danger.front).toBe(sys.color.danger);
    expect(sys.color.art.quiet.edge).toBe(sys.color.muted);
  });

  it('every tone has depth (edge darker than front) and a front that stays readable on white', () => {
    for (const [name, tone] of tones) expect([name, luminance(tone.edge) < luminance(tone.front)]).toEqual([name, true]);
    // The mark cut (16-24 px) lets no tone read lighter than 3:1 on white; the brand, danger and quiet fronts meet it.
    expect(contrastOnWhite(sys.color.art.brand.front)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOnWhite(sys.color.art.danger.front)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOnWhite(sys.color.art.quiet.front)).toBeGreaterThanOrEqual(3);
    // The accent is the action orange, which is 2.5:1 on white and so never carries a small picture alone: a mark in
    // the accent is drawn with its `edge` (3.8:1) or beside ink words. It is not held to the floor; it is named here.
    expect(contrastOnWhite(sys.color.art.accent.front)).toBeLessThan(3);
    expect(contrastOnWhite(sys.color.art.accent.edge)).toBeGreaterThan(3);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// One layout class (audit Z11): 'large' text and a 'narrow' window each stack a layout; nothing else reads the width.
// ---------------------------------------------------------------------------------------------------------------------
describe('useLayoutClass', () => {
  it('is large from text scale 1.3, narrow under 340 dp, and the designed compact layout otherwise', () => {
    expect([LARGE_TEXT_SCALE, NARROW_WIDTH]).toEqual([1.3, 340]);
    expect(layoutClassFor(361, 1)).toEqual({ cls: 'compact', stacked: false });
    expect(layoutClassFor(361, 1.15)).toEqual({ cls: 'compact', stacked: false });
    expect(layoutClassFor(411, 1)).toEqual({ cls: 'compact', stacked: false });
    expect(layoutClassFor(339, 1)).toEqual({ cls: 'narrow', stacked: true });
    expect(layoutClassFor(340, 1)).toEqual({ cls: 'compact', stacked: false });
    expect(layoutClassFor(361, 1.3)).toEqual({ cls: 'large', stacked: true });
  });

  it('reads Android\'s 1.2999999523 as the 1.3 step it is, and large wins when both reasons apply', () => {
    expect(layoutClassFor(411, 1.2999999523162842)).toEqual({ cls: 'large', stacked: true });
    expect(layoutClassFor(320, 1.3)).toEqual({ cls: 'large', stacked: true });
    expect(layoutClassFor(320, 1)).toEqual({ cls: 'narrow', stacked: true });
  });

  it('never stacks for a value that is not a measurement, and hands back one shared answer per class', () => {
    expect(layoutClassFor(Number.NaN, 1)).toEqual({ cls: 'compact', stacked: false });
    expect(layoutClassFor(361, Number.NaN)).toEqual({ cls: 'compact', stacked: false });
    expect(layoutClassFor(361, 1)).toBe(layoutClassFor(400, 1.1));
    expect(Object.isFrozen(layoutClassFor(361, 1))).toBe(true);
  });

  it('follows the window of the device it renders on', async () => {
    const seen: LayoutClassResult[] = [];
    const Probe = () => { seen.push(useLayoutClass()); return null; };
    let tree: ReactTestRenderer | undefined;
    const draw = async (width: number, fontScale: number) => {
      mockWindow = { width, height: 800, scale: 2, fontScale };
      await act(async () => { if (tree) tree.update(createElement(Probe)); else tree = create(createElement(Probe)); });
      return seen[seen.length - 1];
    };
    expect(await draw(361, 1)).toEqual({ cls: 'compact', stacked: false }); // the owner's phone at ordinary text
    expect(await draw(361, 1.3)).toEqual({ cls: 'large', stacked: true });
    expect(await draw(320, 1)).toEqual({ cls: 'narrow', stacked: true });
    await act(async () => tree?.unmount());
    mockWindow = { width: 411, height: 900, scale: 2, fontScale: 1 };
  });

  // The one rule that needs HOW MUCH room there is (the task card's head, `v2/cardHeadFit.ts`) asks this sibling of the hook, so
  // the width is still read in this one file.
  it('hands the room itself to that rule: the width in dp and the text scale rounded to hundredths, one object while they hold', async () => {
    const seen: WindowRoom[] = [];
    const Probe = () => { seen.push(useWindowRoom()); return null; };
    let tree: ReactTestRenderer | undefined;
    const draw = async (width: number, fontScale: number) => {
      mockWindow = { width, height: 800, scale: 2, fontScale };
      await act(async () => { if (tree) tree.update(createElement(Probe)); else tree = create(createElement(Probe)); });
      return seen[seen.length - 1];
    };
    const phone = await draw(361.14, 1.1499999);
    expect(phone).toEqual({ width: 361.14, scale: 1.15 });
    expect(await draw(361.14, 1.15)).toBe(phone);
    expect(await draw(340, 1.2999999523)).toEqual({ width: 340, scale: 1.3 });
    await act(async () => tree?.unmount());
    mockWindow = { width: 411, height: 900, scale: 2, fontScale: 1 };
  });
});

/** Every source file under a folder, without tests; the walk the two ratchets below share. */
const sourceFiles = (dir: string): string[] => readdirSync(join(repo, dir), { withFileTypes: true }).flatMap(entry => {
  const path = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
  return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
});

/**
 * The window width is read in ONE place, `textScale.ts` (`useLayoutClass`, and `useWindowRoom` for the one rule that needs the
 * room itself). These are the ways a file can read it. An ALIASED import is a reader too, because the alias hides what is read
 * from every pattern after it: `import { useWindowDimensions as useWin }` and then `useWin().width` would pass the first four.
 * NOT seen: a width that is handed on as a value (`room.width` where `room` came from `useWindowRoom()`); only the files that
 * ask the hook can pass it, and the hook is read by one component today (the task card).
 */
const WINDOW_WIDTH_READS: readonly RegExp[] = [
  /useWindowDimensions\(\)\s*\.\s*width\b/, // useWindowDimensions().width
  /\{[^{}]*\bwidth\b[^{}]*\}\s*=\s*useWindowDimensions\(\)/, // const { width, … } = useWindowDimensions()
  /\b(?:const|let|var)\s+\w+\s*=\s*useWindowDimensions\(\)/, // the whole object kept, so its width is read later
  /\bDimensions\s*\.\s*get\s*\(/, // Dimensions.get('window').width
  /\buseWindowDimensions\s+as\s+\w+/, // import { useWindowDimensions as useWin }: what is read is hidden behind the alias
  /\bDimensions\s+as\s+\w+/, // import { Dimensions as D }: D.get('window').width
  /\b\w+\s*\.\s*(?:useWindowDimensions|Dimensions)\b/, // import * as RN from 'react-native'; RN.useWindowDimensions()
  /\{[^{}]*\bwidth\b[^{}]*\}\s*=\s*useWindowRoom\(\)/, // const { width } = useWindowRoom()
  /useWindowRoom\(\)\s*\.\s*width\b/, // useWindowRoom().width
];
const readsWindowWidth = (source: string) => WINDOW_WIDTH_READS.some(pattern => pattern.test(source));

/**
 * THE RATCHET RULE, for both lists below. A list names today's offenders so the suite is green now, and it can only shrink:
 * a file that is not on it, or that spells MORE than its entry, fails ("use the token, do not raise the entry"); and a file
 * that spells LESS than its entry fails too ("lower the entry, or delete it"). Both ways are equalities, so an entry made
 * stale by the work it was waiting for cannot sit there green: the change that moves the file is the change that lowers the line.
 * It returns what is wrong, as sentences naming the entry.
 */
const ratchetOffences = (path: string, found: Record<string, number>, allowed: Record<string, number>): string[] =>
  [...new Set([...Object.keys(found), ...Object.keys(allowed)])].flatMap(key => {
    const have = found[key] ?? 0, want = allowed[key] ?? 0;
    if (have > want) return [`${path}: ${key} ${have}, allowed ${want}: use the token, do not raise the entry`];
    if (have < want) return [`${path}: ${key} ${have}, the entry says ${want}: lower the entry${have === 0 ? ' (delete it)' : ''}`];
    return [];
  });

/**
 * TODAY'S offenders (UI/UX pass 2026-10-02; the wave-1 review deleted the task card, which item 1.5 moved onto the hook), each
 * the 340 / 360 / 375 / 380 / 390 dp threshold of its own (audit Z11: 26 ad-hoc sites, the owner's phone is 361 dp and fell on
 * the stacked side of some and the compact side of others). Each wave moves its files onto `useLayoutClass()` and deletes the
 * entry; the list never grows, and an entry that no longer reads the width fails.
 * LOCKED (the V4.9 entry composition, never moved in this pass): EntryWelcome.tsx and ReferenceEntryHero.tsx.
 */
const WINDOW_WIDTH_READERS = new Set([
  'src/app/(app)/_layout.tsx', // the tab bar, 340
  'src/ui/agreements/AgreementWorkspace.tsx',
  'src/ui/calendar/AgendaRow.tsx',
  'src/ui/calendar/AgendaScreen.tsx', // 360
  'src/ui/calendar/AvailabilityForm.tsx', // 360
  'src/ui/entry/EntryWelcome.tsx', // LOCKED entry
  'src/ui/referenceEntry/ReferenceEntryHero.tsx', // LOCKED entry
  'src/ui/reviews/AgreementReviewPresentation.tsx',
  'src/ui/system/PickerTile.tsx', // 360
  'src/ui/v2/DiscoveryPresentation.tsx',
  'src/ui/v2/discovery/DiscoverySearchPanel.tsx', // 360 and 380
]);
const THE_LAYOUT_CLASS_HOOK = 'src/ui/system/textScale.ts';

describe('one layout class: no component reads the window width itself', () => {
  it('finds each way of reading the width, aliased imports included, and nothing else', () => {
    for (const source of [
      'const { width } = useWindowDimensions();', 'const { height, width: windowWidth, fontScale } = useWindowDimensions();',
      'const narrow = useWindowDimensions().width < 360;', 'const window = useWindowDimensions();',
      "const { width } = Dimensions.get('window');", 'const {\n  width,\n  height,\n} = useWindowDimensions();',
      // The blind spots the wave-1 review found: an alias hides the hook from the patterns above.
      "import { useWindowDimensions as useWin } from 'react-native';\nconst dims = useWin();\nconst narrow = dims.width < 360;",
      "import { Dimensions as D } from 'react-native';\nconst w = D.get('window').width;",
      "import * as RN from 'react-native';\nconst { width } = RN.useWindowDimensions();",
      'const { width } = useWindowRoom();', 'const narrow = useWindowRoom().width < 360;',
    ]) expect([source, readsWindowWidth(source)]).toEqual([source, true]);
    for (const source of [
      'const { height } = useWindowDimensions();', 'const { height, fontScale } = useWindowDimensions();',
      'const { width } = useLayoutClass();', 'const scale = useTextScale();', 'style={{ width: 360 }}',
      'const room = useWindowRoom();', "import { useWindowDimensions } from 'react-native';", 'const { cls, stacked } = useLayoutClass();',
    ]) expect([source, readsWindowWidth(source)]).toEqual([source, false]);
  });

  it('only the listed files read it, every listed file still does, and the list names real files', () => {
    const readers = sourceFiles('src').filter(path => path !== THE_LAYOUT_CLASS_HOOK && readsWindowWidth(read(path)));
    expect(readers.filter(path => !WINDOW_WIDTH_READERS.has(path)).map(path => `${path}: reads the window width and is not listed; ask useLayoutClass()`)).toEqual([]);
    expect([...WINDOW_WIDTH_READERS].filter(path => existsSync(join(repo, path)) && !readers.includes(path))
      .map(path => `${path}: no longer reads the window width; delete this entry`)).toEqual([]);
    expect([...WINDOW_WIDTH_READERS].filter(path => !existsSync(join(repo, path)))).toEqual([]);
  });

  it('the hook is where the width is read', () => {
    expect(readsWindowWidth(read(THE_LAYOUT_CLASS_HOOK))).toBe(true);
    expect(read(THE_LAYOUT_CLASS_HOOK)).toMatch(/export function useLayoutClass\(\)/);
    expect(read(THE_LAYOUT_CLASS_HOOK)).toMatch(/export function useWindowRoom\(\)/);
  });

  it('the ratchet is an equality: a stale entry fails, and so does a raised one', () => {
    expect(ratchetOffences('a.tsx', { scale: 1 }, { scale: 1 })).toEqual([]);
    expect(ratchetOffences('a.tsx', {}, {})).toEqual([]);
    expect(ratchetOffences('a.tsx', { scale: 2 }, { scale: 1 })).toEqual(['a.tsx: scale 2, allowed 1: use the token, do not raise the entry']);
    expect(ratchetOffences('a.tsx', { scale: 1 }, {})).toEqual(['a.tsx: scale 1, allowed 0: use the token, do not raise the entry']);
    expect(ratchetOffences('a.tsx', { scale: 1 }, { scale: 3 })).toEqual(['a.tsx: scale 1, the entry says 3: lower the entry']);
    expect(ratchetOffences('a.tsx', {}, { scale: 1 })).toEqual(['a.tsx: scale 0, the entry says 1: lower the entry (delete it)']);
    expect(ratchetOffences('a.tsx', { duration: 1 }, { scale: 1 })).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// One motion token source: a duration, a spring or a press scale is spelled in `tokens.ts` only (audit MO-M9).
// ---------------------------------------------------------------------------------------------------------------------
type MotionFamily = 'duration' | 'spring' | 'scale';
const countOf = (source: string, pattern: RegExp) => source.match(pattern)?.length ?? 0;
/** A decimal literal that is not part of a name or a property access: 0.99, .97, 1.5. */
const DECIMAL = /(?<![\w.$])\d*\.\d+/g;
/**
 * How many literals of each family a source spells. `duration: 0` and `.duration(0)` are not durations: they are "no motion"
 * (a reduced-motion sheet, a camera that jumps), so zero is allowed everywhere. A named token (`duration: sys.motion.enter`,
 * `scaleTo={sys.motion.scale.row}`) is not a literal either.
 *
 * A press scale is found in ANY expression handed to `scaleTo`, so `scaleTo={list ? 0.99 : 0.97}` is two (the wave-1 review
 * found it slipping through a pattern that only knew `scaleTo={0.99}`), in a constant named `*PRESS_SCALE`, and in a literal
 * handed to `usePressLift(...)`. NOT seen: a press scale under another name that reaches `withTiming` by some other road
 * (`const GIVE = 0.96`); such a name has to be added here when it appears.
 */
const MOTION_COUNTERS: Record<MotionFamily, (source: string) => number> = {
  duration: source => countOf(source, /\bduration:\s*(?:[1-9]\d*|0\.\d*[1-9])|\.duration\(\s*(?:[1-9]\d*|0\.\d*[1-9])/g),
  spring: source => countOf(source, /\b(?:damping|dampingRatio|stiffness):\s*\d/g),
  scale: source => [...source.matchAll(/\bscaleTo=\{([^{}]*)\}/g)].reduce((sum, match) => sum + countOf(match[1], DECIMAL), 0)
    + countOf(source, /\b[A-Z][A-Z_]*PRESS_SCALE\s*=\s*0?\.\d+/g) + countOf(source, /\busePressLift\(\s*\d*\.\d+/g),
};
const motionLiterals = (source: string): Partial<Record<MotionFamily, number>> => Object.fromEntries(
  (Object.entries(MOTION_COUNTERS) as [MotionFamily, (source: string) => number][])
    .map(([family, count]): [MotionFamily, number] => [family, count(source)])
    .filter(([, count]) => count > 0));

/**
 * TODAY'S offenders (the wave-1 review deleted Segmented, which item 1.4 moved onto the ladder, and moved PickerTile
 * onto it; the motion pass of 2026-10-08, M-07b, deleted Arrive, which now reads `sys.motion.arrive` and `sys.motion.loop`):
 * how many literals of each family a file spells, EXACTLY. Press, Appear, Arrive and Segmented (item 1.4) are clean; the
 * sheets, SuccessMark, the AI shell and the voice composer move onto `sys.motion` in their own items and then lose
 * their entry.
 * LOCKED: `entryV49Math.ts` carries the V4.9 entry's own `ENTRY_V49.duration` (760); the entry is never restyled here.
 * The map camera needs no entry: it spells `duration: 0` (a jump) or `sys.motion.camera`.
 */
const MOTION_LITERALS_ALLOWED: Record<string, Partial<Record<MotionFamily, number>>> = {
  'src/app/(app)/profil/lokacija.tsx': { scale: 1 },
  'src/ui/calendar/AvailabilityForm.tsx': { scale: 4 },
  'src/ui/calendar/CalendarControls.tsx': { scale: 1 },
  'src/ui/entry/entryV49Math.ts': { duration: 1 }, // LOCKED entry
  'src/ui/product/ProductDetails.tsx': { scale: 1 }, // DetailDescription's "Prikaži ceo opis"; DetailLink and ProductPerson (2 of 3) are gone
  'src/ui/reviews/AccountReputation.tsx': { scale: 1 },
  'src/ui/support/SupportPresentation.tsx': { scale: 1 },
  'src/ui/system/Disclosure.tsx': { scale: 1 },
  'src/ui/system/SuccessMark.tsx': { spring: 2 }, // damping 13, stiffness 240
  'src/ui/v2/TaskCard.tsx': { scale: 1 }, // CARD_PRESS_SCALE = 0.986
};
const TOKEN_FILE = 'src/ui/system/tokens.ts';

describe('one motion token source: no duration, spring or press scale is spelled outside tokens.ts', () => {
  it('finds each literal form, in any expression, and lets a named token and a zero through', () => {
    expect(motionLiterals("Animated.timing(v, { toValue: 1, duration: 800 })")).toEqual({ duration: 1 });
    expect(motionLiterals('FadeInDown.duration(240).delay(40)')).toEqual({ duration: 1 });
    expect(motionLiterals('withSpring(1, { damping: 13, stiffness: 240, mass: 0.8 })')).toEqual({ spring: 2 });
    expect(motionLiterals('<Press scaleTo={0.99} /><Press scaleTo={.97} />')).toEqual({ scale: 2 });
    expect(motionLiterals('export const CARD_PRESS_SCALE = 0.986;')).toEqual({ scale: 1 });
    // The blind spots of the wave-1 review: literals inside an expression, and a literal handed to the lift hook.
    expect(motionLiterals('<Press scaleTo={list ? 0.99 : 0.97} />')).toEqual({ scale: 2 });
    expect(motionLiterals('<Press scaleTo={pressed ? sys.motion.scale.row : 0.97} />')).toEqual({ scale: 1 });
    expect(motionLiterals('const lift = usePressLift(0.96);')).toEqual({ scale: 1 });
    expect(motionLiterals('{ duration: 0 } {fade: false} .duration(0) scaleTo={1} scaleTo={scale} duration: sys.motion.enter'
      + ' scaleTo={sys.motion.scale.row} withSpring(1, sys.motion.sheetSpring)')).toEqual({});
    expect(motionLiterals('<Press scaleTo={list ? sys.motion.scale.row : sys.motion.scale.button} /> usePressLift() usePressLift(sys.motion.scale.button)')).toEqual({});
  });

  it('a file outside the list spells none, and a file on it spells exactly its entry: it can only shrink, and shrinks with the code', () => {
    const offences = sourceFiles('src').filter(path => path !== TOKEN_FILE)
      .flatMap(path => ratchetOffences(path, motionLiterals(read(path)) as Record<string, number>, (MOTION_LITERALS_ALLOWED[path] ?? {}) as Record<string, number>));
    expect(offences).toEqual([]);
    expect(Object.keys(MOTION_LITERALS_ALLOWED).filter(path => !existsSync(join(repo, path)))).toEqual([]);
  });

  it('tokens.ts is where the values are written', () => {
    const found = motionLiterals(read(TOKEN_FILE));
    expect(found.duration).toBeGreaterThan(0);
    expect(found.spring).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The rules are written down where a developer looks (audit MO-M9, HP-06): tokens.ts and DESIGN_SKILLS.md.
// ---------------------------------------------------------------------------------------------------------------------
describe('the colour meaning and the eight motion rules are written down', () => {
  const tokens = read('src/ui/system/tokens.ts'), skills = read('docs/implementation/v5-ai-first/DESIGN_SKILLS.md');

  it.each([['tokens.ts', tokens], ['DESIGN_SKILLS.md', skills]])('%s carries rules R1 to R8', (_name, source) => {
    for (let rule = 1; rule <= 8; rule++) expect([rule, new RegExp(`\\bR${rule}\\b`).test(source)]).toEqual([rule, true]);
  });

  it('DESIGN_SKILLS.md names the layout class and its guards', () => {
    expect(skills).toMatch(/useLayoutClass\(\)/);
    expect(skills).toMatch(/one-token-source\.test\.ts/);
    expect(skills).toMatch(/useWindowRoom\(\)/);
    expect(skills).toMatch(/pressDelayFor/);
  });

  // Wave-1 review, MAJOR 2 (documents): two defaults were the team's, not the owner's. Nothing may call them his decision.
  it('DESIGN_SKILLS.md calls the wave\'s defaults the team\'s, pending the owner\'s eye on the phone, never owner defaults', () => {
    const flat = skills.replace(/\s+/g, ' ');
    expect(flat).not.toMatch(/owner defaults/i);
    expect(flat).toMatch(/Two defaults were applied by the team in this wave, pending the owner's eye on the phone/);
    expect(flat).toMatch(/not owner decisions/);
  });

  // Wave-1 review, minor (k): the plan deviations that were explained in code and tracked nowhere. Two of the open items are
  // closed by the motion pass of 2026-10-08 and are no longer pinned here (M-01: `push` is 240 and the layout passes it with
  // `easeOut`; M-07b: `springSheet` is deleted, nothing read it), so their bullets in the document may go without this test
  // failing; the ones that are still open stay pinned.
  it('DESIGN_SKILLS.md records the wave-1 plan deviations as open items, each with the item that removes it', () => {
    const open = skills.slice(skills.indexOf('### Open items carried by wave 1')).replace(/\s+/g, ' ');
    expect(open.length).toBeGreaterThan(200);
    expect(open).toMatch(/`PRESS_DELAY` \(60 ms\) lives in `Press\.tsx`/);
    expect(open).toMatch(/`SHEET_SPRING` in `ProductSheet\.tsx` is an alias/);
    expect(open).toMatch(/EntryWelcome/);
  });

  it('DESIGN_SKILLS.md counts the ratchets as the test lists them, not as they were once', () => {
    const flat = skills.replace(/\s+/g, ' ');
    expect(flat).not.toMatch(/nineteen files|31 files/);
    expect(flat).toContain(`${WINDOW_WIDTH_READERS.size} files are listed today`);
  });
});
