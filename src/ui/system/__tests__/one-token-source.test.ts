import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { Platform } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { brandAction, card, cardCompact, fieldBox, floating, sheetLift, sys } from '../tokens';
import { palette } from '../../../theme/tokens';
import { colorTokens } from '../../../theme/colorTokens';
import { motionTokens } from '../motionTokens';
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
 * Shared token and live preference boundaries. Explicit transitional consumers below
 * remain visible until migrated; new reviewed component roles can extend the owner.
 * No immutable appearance, importer count or historical entry exemption is implied.
 */
const repo = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(repo, path), 'utf8');

/** Moved from `theme/tokens`, `aiFirst/tokens` or `v2/tokens` to `sys`. */
const TOKEN_SCOPE = [
  'src/ui/Press.tsx', 'src/ui/Text.tsx', 'src/ui/system/Segmented.tsx', 'src/ui/BuildIdentity.tsx',
  'src/ui/location/ResolvedPinMap.tsx', 'src/ui/media/AuthorizedPhoto.tsx', 'src/ui/media/AgreementPhotoComposer.tsx',
  'src/ui/v2/IntakePresentation.tsx', 'src/app/(app)/pregled-zadatka.tsx', 'src/ui/v2/DiscoveryMap.tsx',
  'src/ui/v2/DiscoveryMap.web.tsx',
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
  'src/ui/home/HomePresentation.tsx', 'src/ui/Text.tsx',
  'src/ui/v2/TaskCard.tsx', 'src/ui/v2/ApplicationComposerPresentation.tsx', 'src/ui/reviews/AgreementReviewScreen.tsx',
  'src/ui/reviews/AgreementReviewPresentation.tsx', 'src/designLab/dizajn-prijava.tsx',
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

// Live preference events, stale async reads and cleanup are covered by system-reduced-motion-hook.test.tsx.

it('screen and compatibility colors share the pure owner, with one native touch minimum', () => {
  expect(sys.color).toBe(colorTokens.color);
  expect(sys.status).toBe(colorTokens.status);
  expect(sys.conversation).toBe(colorTokens.conversation);
  expect(sys.map).toBe(colorTokens.map);
  expect(palette.orange).toBe(sys.color.orange);
  expect(palette.ink).toBe(sys.color.ink);
  expect(palette.success).toBe(sys.color.success);
  expect(palette.danger).toBe(sys.color.danger);
  expect(sys.touch.min).toBeGreaterThanOrEqual(48);
});

it('sys exposes the single motion source and retains the existing aliases', () => {
  expect(sys.motion).toBe(motionTokens);
  expect(sys.motion.press).toBe(sys.motion.categories.press.button.duration);
  expect(sys.motion.enter).toBe(sys.motion.categories.content.reveal.duration);
  expect(sys.motion.exit).toBe(sys.motion.categories.content.exit.duration);
  expect(sys.motion.sheetSpring).toBe(sys.motion.categories.sheet.open.config);
  expect(sys.motion.sheetClose).toBe(sys.motion.categories.sheet.close.duration);
  expect(sys.motion.pressScale).toBe(sys.motion.scale.button);
  expect(read('src/theme/tokens.ts')).not.toMatch(/export const motion\b/);
});

// Timing ranges and interaction relationships are covered by motion-presets.test.
// This source test protects one definition, not historical exact milliseconds or
// a ban on adding a useful, explicitly scoped variant.

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

// Corner values evolve; named roles and geometry remain coherent.
it('corner roles stay finite and distinguish small marks, cards and large surfaces', () => {
  for (const value of Object.values(sys.radius)) { expect(Number.isFinite(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(0); }
  expect(sys.radius.check).toBeLessThan(sys.radius.control);
  expect(sys.radius.cardCompact).toBeLessThanOrEqual(sys.radius.card);
  expect(sys.radius.hero).toBeGreaterThanOrEqual(sys.radius.cardCompact);
  expect(sys.radius.pill).toBeGreaterThan(sys.radius.sheet);
  expect(brandAction.minHeight).toBeGreaterThanOrEqual(sys.touch.min);
  expect(fieldBox.minHeight).toBeGreaterThanOrEqual(sys.touch.min);
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
  for (const lift of [sheetLift.docked, sheetLift.detached]) {
    if (Platform.OS === 'android' && Number(Platform.Version) < 28) expect(lift.elevation).toBeGreaterThan(0);
    else expect(lift.boxShadow).toEqual(expect.any(String));
  }
  for (const [path, form] of [['src/ui/v2/discovery/DiscoveryListSheet.tsx', 'docked'], ['src/ui/system/PeekSheet.tsx', 'detached']]) {
    const source = read(path);
    expect(source).toMatch(new RegExp(`\\.\\.\\.sheetLift\\.${form}\\b`));
    // Documentation can name the native property; only declarations violate the token rule.
    expect(withoutDockedFullLift(source.replace(/\/\*[\s\S]*?\*\//g, ''), form)).not.toMatch(INLINE_SHEET_SHADOW);
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

// Shared defaults are readable; families may choose flat, outlined, tinted or elevated materials.
it.each([['card', card], ['cardCompact', cardCompact]] as const)('%s keeps a bounded shared material', (_name, style) => {
  expect(style.backgroundColor).toBe(sys.color.surface);
  expect(style.borderRadius).toBeGreaterThanOrEqual(0);
  expect(style.padding).toBeGreaterThan(0);
  expect(floating.boxShadow !== undefined || floating.elevation !== undefined).toBe(true);
});

it('keeps one system facade and readable text on the filled brand material', () => {
  expect(existsSync(join(repo, 'src/ui/v2/tokens.ts'))).toBe(false);
  const ratio = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  expect(ratio(sys.color.onGreen, sys.color.green)).toBeGreaterThanOrEqual(4.5);
  expect(ratio(sys.color.onDark, sys.color.green)).toBeGreaterThanOrEqual(4.5);
  for (const surface of [sys.navigation.background, sys.navigation.selected]) {
    expect(ratio(sys.navigation.foreground, surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(sys.navigation.muted, surface)).toBeGreaterThanOrEqual(4.5);
  }
  // Navigation symbols and labels share semantic colours, including when icon geometry changes.
  expect(sys.navigation.foreground).toBe(sys.color.green);
  expect(sys.navigation.muted).toBe(sys.color.muted);
});

// ---------------------------------------------------------------------------------------------------------------------
// Art colors have shared semantic roles. Brand consistency does not require every illustration to be green.
// ---------------------------------------------------------------------------------------------------------------------
const channels = (hex: string) => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255)
  .map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => { const [r, g, b] = channels(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

describe("sys.color.art, the tones a FACT picture is drawn in (not sys.art: those are the Home drawing's colours)", () => {
  const tones = Object.entries(sys.color.art);

  it('keeps fact tones separate from Home illustration colors', () => {
    expect(Object.keys(sys.color.art)).toEqual(expect.arrayContaining(['brand', 'accent', 'quiet', 'danger']));
    expect(Object.keys(sys.art)).not.toContain('brand');
    expect(Object.keys(sys.art)).toContain('leafDeep');
  });

  it('provides the supported state roles and valid material colors, allowing additional roles', () => {
    expect(tones.map(([name]) => name)).toEqual(expect.arrayContaining(['brand', 'accent', 'quiet', 'danger']));
    for (const [name, tone] of tones) {
      expect(Object.keys(tone)).toEqual(expect.arrayContaining(['front', 'edge', 'light', 'soft']));
      for (const part of Object.values(tone)) expect(part).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('keeps the named brand, accent and danger identities consistent with their UI roles', () => {
    expect(sys.color.art.brand.front).toBe(sys.color.green);
    expect(sys.color.art.accent.front).toBe(sys.color.orange);
    expect(sys.color.art.danger.front).toBe(sys.color.danger);
  });

  it('each state palette supplies a color suitable for a functional mark on white', () => {
    // Actual rendered mark colors, including white details, are checked in fact-art.test.tsx.
    // A light illustration face may coexist with a darker functional variant; neither is fixed to a historic hex or order.
    for (const [, tone] of tones) expect(Math.max(...Object.values(tone).map(contrastOnWhite))).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// One layout class (audit Z11): 'large' text and a 'narrow' window each stack a layout; nothing else reads the width.
// ---------------------------------------------------------------------------------------------------------------------
describe('useLayoutClass', () => {
  it('reflows at the current large-text and narrow-width boundaries', () => {
    expect(LARGE_TEXT_SCALE).toBeGreaterThan(1);
    expect(LARGE_TEXT_SCALE).toBeLessThanOrEqual(1.5);
    expect(NARROW_WIDTH).toBeGreaterThanOrEqual(300);
    expect(NARROW_WIDTH).toBeLessThanOrEqual(390);
    expect(layoutClassFor(NARROW_WIDTH + 50, 1)).toEqual({ cls: 'compact', stacked: false });
    expect(layoutClassFor(NARROW_WIDTH - 1, 1)).toEqual({ cls: 'narrow', stacked: true });
    expect(layoutClassFor(NARROW_WIDTH, 1)).toEqual({ cls: 'compact', stacked: false });
    expect(layoutClassFor(NARROW_WIDTH + 50, LARGE_TEXT_SCALE)).toEqual({ cls: 'large', stacked: true });
  });

  it('tolerates native rounding at the text boundary, and large wins when both reasons apply', () => {
    expect(layoutClassFor(NARROW_WIDTH + 50, LARGE_TEXT_SCALE - 0.00000005)).toEqual({ cls: 'large', stacked: true });
    expect(layoutClassFor(NARROW_WIDTH - 20, LARGE_TEXT_SCALE)).toEqual({ cls: 'large', stacked: true });
    expect(layoutClassFor(NARROW_WIDTH - 20, 1)).toEqual({ cls: 'narrow', stacked: true });
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

/** Explicit ownership of legacy literal families. Counts are not a design freeze.
 * Unlisted families still require a shared token or a reviewed adapter decision;
 * removed families must be removed from the inventory. */
const ratchetOffences = (path: string, found: Record<string, number>, allowed: Record<string, number>): string[] =>
  [...new Set([...Object.keys(found), ...Object.keys(allowed)])].flatMap(key => {
    if ((found[key] ?? 0) > 0 && !(key in allowed)) return [`${path}: ${key}: use the central token or document the adapter`];
    if (!(found[key] > 0) && key in allowed) return [`${path}: ${key}: remove the stale adapter family`];
    return [];
  });

/**
 * TODAY'S offenders (UI/UX pass 2026-10-02; the wave-1 review deleted the task card, which item 1.5 moved onto the hook), each
 * the 340 / 360 / 375 / 380 / 390 dp threshold of its own (audit Z11: 26 ad-hoc sites, the owner's phone is 361 dp and fell on
 * the stacked side of some and the compact side of others). Each wave moves its files onto `useLayoutClass()` and deletes the
 * entry. New responsive primitives may be reviewed explicitly; stale entries fail.
 * Transitional entry consumer: EntryWelcome.tsx.
 */
const WINDOW_WIDTH_READERS = new Set([
  'src/app/(app)/_layout.tsx', // the tab bar, 340
  'src/ui/agreements/AgreementWorkspace.tsx',
  'src/ui/calendar/AgendaRow.tsx',
  'src/ui/calendar/AgendaScreen.tsx', // 360
  'src/ui/calendar/AvailabilityForm.tsx', // 360
  'src/ui/entry/EntryWelcome.tsx', // Transitional entry consumer
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

  it('checks family ownership and stale exceptions without pinning an implementation count', () => {
    expect(ratchetOffences('a.tsx', { scale: 4 }, { scale: 1 })).toEqual([]);
    expect(ratchetOffences('a.tsx', {}, {})).toEqual([]);
    expect(ratchetOffences('a.tsx', { scale: 1 }, {})).toHaveLength(1);
    expect(ratchetOffences('a.tsx', {}, { scale: 1 })).toHaveLength(1);
    expect(ratchetOffences('a.tsx', { duration: 1 }, { scale: 1 })).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// One motion token source: defaults and purpose variants live in motionTokens.ts.
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
 * which literal families remain in transitional components. Historical counts below are inventory only. Press, Appear, Arrive and Segmented (item 1.4) are clean; the
 * sheets, SuccessMark, the AI shell and the voice composer move onto `sys.motion` in their own items and then lose
 * their entry.
 * `entryV49Math.ts` retains an entry-specific duration pending its owner migration.
 * The map camera needs no entry: it spells `duration: 0` (a jump) or `sys.motion.camera`.
 */
const MOTION_LITERALS_ALLOWED: Record<string, Partial<Record<MotionFamily, number>>> = {
  'src/app/(app)/profil/lokacija.tsx': { scale: 1 },
  'src/ui/calendar/AvailabilityForm.tsx': { scale: 4 },
  'src/ui/calendar/CalendarControls.tsx': { scale: 1 },
  'src/ui/entry/entryV49Math.ts': { duration: 1 }, // Transitional entry consumer
  'src/ui/product/ProductDetails.tsx': { scale: 1 }, // DetailDescription's "Prikaži ceo opis"; DetailLink and ProductPerson (2 of 3) are gone
  'src/ui/support/SupportPresentation.tsx': { scale: 1 },
  'src/ui/system/Disclosure.tsx': { scale: 1 },
  'src/ui/system/SuccessMark.tsx': { spring: 2 }, // damping 13, stiffness 240
};
const TOKEN_FILE = 'src/ui/system/motionTokens.ts';

describe('one motion token source: defaults live in motionTokens.ts', () => {
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

  it('shared motion owns new values, with explicit transitional families and no stale exceptions', () => {
    const offences = sourceFiles('src').filter(path => path !== TOKEN_FILE)
      .flatMap(path => ratchetOffences(path, motionLiterals(read(path)) as Record<string, number>, (MOTION_LITERALS_ALLOWED[path] ?? {}) as Record<string, number>));
    expect(offences).toEqual([]);
    expect(Object.keys(MOTION_LITERALS_ALLOWED).filter(path => !existsSync(join(repo, path)))).toEqual([]);
  });

  it('motionTokens.ts defines the values while tokens.ts only exposes that object', () => {
    const found = motionLiterals(read(TOKEN_FILE));
    expect(found.duration).toBeGreaterThan(0);
    expect(found.spring).toBeGreaterThan(0);
    expect(motionLiterals(read('src/ui/system/tokens.ts'))).toEqual({});
  });
});
