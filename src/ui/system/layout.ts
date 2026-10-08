/**
 * The grid every screen stands on (UI/UX pass, 2026-10-08; composition spec 2026-10-07, section 2 "A, B, C, E").
 *
 * Until now the left and right edge of a screen had four values (16, 20, 22, 24), the space between blocks seven, and a
 * row of a list started its text 0, 44, 46, 48, 52, 56 or 68 dp from the edge, so every screen was a variant of the same
 * shape and nothing lined up from one screen to the next. These are the numbers that replace all of them. A screen, a
 * section, a row and a card are built from them (`Screen`, `Section`, `ListRow`, `FactRow`, `KeyValueRow`, `Surface`), and a
 * screen that needs another number is asking for a new rule, not for a literal.
 *
 * The scale underneath is `sys.space`: 4 · 8 · 12 · 16 · 24 · 32 · 48. `sys.space.lg` (20) is NOT a space between things; it
 * is the edge of the screen, and it is `gutter` below. Nothing else (6, 10, 14, 18, 22, 28).
 *
 * This file imports nothing, on purpose: `tokens.ts` will include it later as `sys.layout` and `sys.rule`, and a token file
 * must not be reached by a cycle through the numbers it carries.
 */
export const layout = {
  /** The left and right edge of EVERY screen: Početna, a list, a detail, a flow, a sheet. */
  gutter: 20,
  /** What floats over the map keeps 16 from the edge of the screen, so the map shows around it. */
  mapInset: 16,
  /** The conversation is the one screen with its own edges: a list of messages 16 from the edge, the composer 12. */
  chatList: 16,
  chatComposer: 12,
  /** Between one section and the next (a `Section` has no margin of its own: the screen spaces them). */
  section: 24,
  /** From a section's title to what it holds, and from one card to the next. */
  group: 12,
  /** Inside a record: the padding of a card that is touched. */
  card: 16,
  /** Between one zone of a screen and the next, and under the last thing in a scroll. */
  zone: 32,
  /** The least a control may be to touch: 48 dp. */
  touch: 48,
  /** The height of a row with a second line or a picture, and of one with neither. */
  rowMin: 64,
  rowMinPlain: 56,
  /** The width of the picture slot at the start of a row, and of a slot that holds a person's face. */
  slot: 40,
  slotFace: 56,
  /** A screen on a tablet is a column this wide, centred. */
  maxWidth: 640,
} as const;

/**
 * The one divider: 1 dp, in `sys.color.line`. Never the platform's hairline (one PHYSICAL pixel, so a different line on every
 * phone: it was 23 of the 104 lines in the app, beside 81 of 1 dp).
 */
export const ruleWidth = 1;
