import {
  ArrowClockwise, ArrowLeft, ArrowRight, ArrowSquareOut, ArrowUp, ArrowUpRight, ArrowsOutSimple, CalendarBlank, Camera, CaretDown, CaretLeft,
  CaretRight, CaretUp, Check, DotsThree, Eye, EyeSlash, Image, Info, MagnifyingGlass, MapTrifold, Microphone, Minus, PaperPlaneTilt, Plus,
  Bell, ChatCircle, GearSix, Handshake, HouseSimple, PencilSimpleLine,
  SlidersHorizontal, Trash, User, Waveform, X, type Icon, type IconWeight,
} from 'phosphor-react-native';
import { sys } from './tokens';

/**
 * The ONE wrapper for a control glyph (UI/UX pass, wave 2, item 2.3; audit ICO-08). 47 Phosphor icons were drawn in 63 files at
 * ten sizes (13 to 40), in three weights and as many colours, each chosen at its call site, so every top bar and every row carried
 * slightly different line icons: the thin back arrow beside a 700-weight title, a magnifier green 20 and the sliders ink 22 in one
 * pill. This file is the only one that may import `phosphor-react-native` (`src/ui/system/__tests__/glyph-import-guard.test.ts` holds
 * that, with a list of the files that still do which can only shrink); every other file asks it for a NAME.
 *
 * THREE REGISTERS (`docs/implementation/design-system/ICON_SYSTEM.md`): a fact picture (`FactArt`) says what a thing IS, a glyph
 * says what tapping DOES, a status mark says where a thing STANDS. A glyph is for a control only, and a primary control carries a
 * word beside it (`ChromeIconButton` has a `caption` for that). A glyph is never a fact.
 *
 * THE RULES, resolved here and never at a call site:
 *   size    16 in a line of text, 20 in a row or beside a word, 24 in the chrome. Nothing else (13, 14, 18, 21, 22, 28 and 40 are
 *           gone).
 *   tone    ink (the default), green (the control that is on, or the whole row's action), muted (a chevron, a disabled control),
 *           onGreen (on the one green primary action) and danger (a destructive one). A chevron is muted everywhere unless the
 *           whole row is the green action.
 *   weight  bold at 16 and below, because a hairline stroke dies at that size, and for check, close, plus and minus at any size,
 *           because they are short marks that read thin; regular at 20 and 24; fill only for an on-state (`on`).
 *           Persistent tabs keep the regular outline in both states; their marker and color carry selection.
 *           `strong` remains available to existing compact controls, not as the chrome default.
 *
 * The registry is closed for TypeScript and checked for unique drawings. Root navigation adds home, agreements,
 * messages and notifications here instead of importing a second icon family in each screen.
 *
 * HOW TO CONTINUE (for whoever picks this up with no memory of the session). Proof level: SOURCE and jest only. A file is migrated
 * by replacing its Phosphor imports with `<Glyph name="..." />` (or `glyph="..."` on `ChromeIconButton` / `HeaderIconButton`); the
 * change that does it deletes that file's line from `PHOSPHOR_IMPORTERS` in `src/ui/system/__tests__/glyph-import-guard.test.ts` and
 * lowers the size pinned there (63 at the end of wave 2): the guard fails both ways, so a stale line cannot stay. A control that
 * nobody can guess from a drawing (Filteri, Raspored) takes a `caption` on the chrome button, and its spoken `label` contains that
 * word. Chrome uses the registry weight; call sites never pick a weight directly.
 */
export const GLYPH_NAMES = ['back', 'close', 'caret-right', 'caret-left', 'caret-down', 'caret-up', 'plus', 'minus', 'check', 'send',
  'search', 'filters', 'more', 'mic', 'wave', 'arrow-right', 'arrow-up', 'arrow-up-right', 'refresh', 'trash', 'camera', 'image', 'eye',
  'eye-off', 'external', 'expand', 'info', 'map', 'profile', 'calendar', 'home', 'agreements', 'messages', 'notifications', 'edit', 'settings'] as const;
export type GlyphName = (typeof GLYPH_NAMES)[number];

/** In-text, row or beside a word, chrome. */
export const GLYPH_SIZES = [16, 20, 24] as const;
export type GlyphSize = (typeof GLYPH_SIZES)[number];

export const GLYPH_TONES = ['ink', 'green', 'muted', 'onGreen', 'danger'] as const;
export type GlyphTone = (typeof GLYPH_TONES)[number];

/** The colour of each tone: tokens only. */
export const GLYPH_COLOUR: Record<GlyphTone, string> = {
  ink: sys.color.ink, green: sys.color.green, muted: sys.color.muted, onGreen: sys.color.onGreen, danger: sys.color.danger,
};

/** A Phosphor icon component, for the callers that still pass one (`ChromeIconButton`'s `icon`). Only the type crosses this file. */
export type GlyphIcon = Icon;

const REGISTRY: Record<GlyphName, Icon> = {
  back: ArrowLeft, close: X, 'caret-right': CaretRight, 'caret-left': CaretLeft, 'caret-down': CaretDown, 'caret-up': CaretUp,
  plus: Plus, minus: Minus, check: Check, send: PaperPlaneTilt, search: MagnifyingGlass, filters: SlidersHorizontal, more: DotsThree,
  mic: Microphone, wave: Waveform, 'arrow-right': ArrowRight, 'arrow-up': ArrowUp, 'arrow-up-right': ArrowUpRight, refresh: ArrowClockwise,
  trash: Trash, camera: Camera, image: Image, eye: Eye, 'eye-off': EyeSlash, external: ArrowSquareOut, expand: ArrowsOutSimple, info: Info,
  map: MapTrifold, profile: User, calendar: CalendarBlank,
  home: HouseSimple, agreements: Handshake, messages: ChatCircle, notifications: Bell, edit: PencilSimpleLine,
  // The cog of "Podesi obaveštenja" (the inbox bar) and of every settings control after it: the notification screens drew it with a Phosphor import of their own.
  settings: GearSix,
};

/** The short marks that read thin at any size. */
const SHORT_MARKS: ReadonlySet<GlyphName> = new Set<GlyphName>(['check', 'close', 'plus', 'minus']);

/** The weight a glyph is drawn in: the one rule, in one place (see the header). `on` wins over everything, then `strong`. */
export function glyphWeight(name: GlyphName, size: GlyphSize, on = false, strong = false): IconWeight {
  if (on) return 'fill';
  if (strong || size <= 16 || SHORT_MARKS.has(name)) return 'bold';
  return 'regular';
}

type GlyphProps = {
  name: GlyphName;
  /** 20 by default: a row, or beside a word. */
  size?: GlyphSize;
  /** `ink` by default. */
  tone?: GlyphTone;
  /** The control is on (a toggle that is set): drawn filled. The only way to get a fill. */
  on?: boolean;
  /** Bold at any size: for a glyph that stands beside bold type in the chrome. */
  strong?: boolean;
};

/** A control glyph. Decorative, like the control's own label says what it does; the Phosphor icon draws as an SVG. */
export function Glyph({ name, size = 20, tone = 'ink', on = false, strong = false }: GlyphProps) {
  const Drawing = REGISTRY[name];
  return <Drawing size={size} color={GLYPH_COLOUR[tone]} weight={glyphWeight(name, size, on, strong)} />;
}
