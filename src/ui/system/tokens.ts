import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { elevation, palette, radius, space, touch, type } from '../../theme/tokens';
import { withInter } from '../interFont';
import { layout, ruleWidth } from './layout';

/**
 * `sys` is the one surface screens and components read for colour, type, space, corners, touch and motion (2026-09-24:
 * the `v2` token file with its second motion scale is deleted, and the screens moved that day no longer read
 * `theme/tokens` or `aiFirst`; the sign-in screens and the AI conversation still do, as views of the same values). It
 * may build on the theme scale here, inside the system. A nested corner is geometry, not a value, so it is exported
 * beside `sys`.
 */
export { nested } from '../../theme/tokens';

const WHITE = '#FFFFFF', BLACK = '#000000';
/** The one divider colour: `sys.color.line` and `sys.rule.color` are this value. */
const LINE = '#EBEBEB';
/** The four colours the fact-picture tones in `sys.color.art` are derived from; `sys.color` spells the same values by name. */
const GREEN = '#00845A', ORANGE = '#FF7A1A', MUTED = '#525252', DANGER = '#963F34';
const hexChannels = (hex: string) => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
/** `from` moved `amount` (0 to 1) of the way towards `toward`, as upper-case #RRGGBB: the only way an art tone is made. */
function mix(from: string, toward: string, amount: number): string {
  const a = hexChannels(from), b = hexChannels(toward);
  return `#${a.map((value, at) => Math.round(value + (b[at] - value) * amount).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
/** One tone of a fact picture: the face, the darker edge it stands on, a light detail and a soft fill. */
function artTone(front: string, edge = mix(front, BLACK, 0.3)) {
  return { front, edge, light: mix(front, WHITE, 0.5), soft: mix(front, WHITE, 0.9) };
}
/**
 * How far a pressed surface gives (rule R8): a button gives the most, a row or a card less, a big surface not at all.
 * `sys.motion.scale` is this ladder; `sys.motion.pressScale` stays as its button rung for the one component that reads it.
 */
const PRESS_LADDER = { button: 0.97, row: 0.985, none: 1 } as const;

/**
 * Shared consumer UI system, owner takeover 2026-10-02. White reading surfaces;
 * ink for content and money, green for the primary action/confirmed success,
 * warm orange for attention. Blue communication/location, coral people and gold
 * time belong to selective artwork, not invented status. Small orange labels use
 * the contrast-safe orangeInk; orange surfaces use dark labels. Neutral wells are
 * controls, not a requirement to wrap every fact in another card. Entry artwork's
 * own palette remains scoped. Historical design decisions live in Design Master.
 */
export const sys = {
  color: {
    surface: '#FFFFFF',
    /** Screens and reading groups are white; `wash` is a neutral control/recessed-state surface. */
    ground: '#FFFFFF',
    wash: '#F7F7F7',
    /** Segmented track and icon wells. */
    control: '#E8E8E8',
    iconWell: '#F5F5F5',
    ink: '#202020',
    muted: MUTED,
    green: GREEN,
    /** Legacy name: a neutral selection well; the icon, edge or label carries green. */
    greenSoft: '#F3F3F3',
    orange: ORANGE,
    orangeSoft: '#FFF5E9',
    onOrange: '#30200F',
    /** The label on the one primary action, which is green. */
    onGreen: '#FFFFFF',
    line: LINE,
    lineStrong: '#CDCDCD',
    cardLine: '#DEDEDE',
    danger: DANGER,
    dangerSoft: '#FBECE9',
    warn: '#8A5100',
    warnSoft: '#FFF4DF',
    /** Owner 2026-10-02: prices are ink; color and depth belong to artwork and meaningful actions. */
    money: '#202020',
    skeleton: '#EEEEEE',
    scrim: '#00000066',
    /** The dim behind a centred dialog (plan 2.20: 0.35; a bottom sheet's own backdrop is 0.3 and lives in the sheet engine). */
    dim: '#00000059',
    /**
     * The white veil a full-screen step panel lies on over the map (the Zadaci search, Discovery V47): the map still shows
     * through it, the white cards on it are what is read. No blur: there is no blur package, and none is added for this.
     */
    veil: '#FFFFFFE6',
    /** Hairlines on a filled control, and the ring that appears only while listening. */
    greenEdge: '#226B52',
    orangeEdge: '#E57917',
    orangeHalo: '#FFD2A8',
    /** A fact beside its icon on a card (where, when): a step darker than muted, so a scanned list reads. */
    fact: '#404040',
    /** A count that asks for attention, on white: few places left. */
    attentionInk: '#985223',
    /** The words on a waiting chip, which sits on orangeSoft. */
    waitingInk: '#874515',
    /** Orange as words. The action orange fails as text (2.5:1), so a word that must read orange uses this. */
    orangeInk: palette.orangeInk,
    /**
     * Words on a filled green surface that is not the primary action (a chosen day). It has no quiet partner: the old
     * `onDarkMuted` read 2.4:1 on green (it passed only on the retired forest ground), so nothing may say it.
     */
    onDark: palette.onDark,
    /** Material tones derive from the actual brand tokens. FactArt caches each static drawing;
     * small functional marks remain flat, with contrast-safe state colors. */
    art: {
      brand: artTone(GREEN),
      accent: artTone(ORANGE, mix(ORANGE, BLACK, 0.2)),
      quiet: artTone(mix(MUTED, WHITE, 0.35), MUTED),
      danger: artTone(DANGER),
    },
    /** Semantic artwork roles: restrained color for place, communication, people and time; never a status inferred from art. */
    artRole: {
      location: artTone('#3979C4'),
      ai: artTone('#3979C4'),
      skills: artTone('#168579'),
      people: artTone('#D76B5C'),
      time: artTone('#DBAC35', '#8D6B12'),
      confirmed: artTone(GREEN),
      waiting: artTone(ORANGE, mix(ORANGE, BLACK, 0.2)),
    },
  },
  /** White conversations; speaker alignment, a quiet edge and the solid own-message fill establish hierarchy. */
  conversation: {
    ground: '#FFFFFF',
    surface: '#FFFFFF',
    summary: '#FFFFFF',
    edge: '#DEDEDE',
    user: '#292929',
    onUser: '#FFFFFF',
    iconWell: '#F5F5F5',
  },
  /**
   * Public map geography: colors only, independent from the interactive brand markers and their states.
   * Owner 2026-10-07 ("obojenije, da se vide lepo ulice"): a warm light ground so white streets read against it, firmer
   * street edges, light-yellow main streets, greener parks and bluer water. Supersedes the near-white palette (U07 default).
   */
  map: {
    ground: '#EFEDE8',
    residential: '#E9E7E1',
    park: '#BEE09F',
    woodland: '#A5D387',
    water: '#8DCAEE',
    waterLine: '#5FAED6',
    waterLabel: '#2B5A72',
    building: '#DCDAD4',
    buildingEdge: '#C9C6BF',
    road: '#FFFFFF',
    roadEdge: '#C2C6CA',
    roadMajor: '#FFE9A6',
    roadMajorEdge: '#E1BD5C',
    path: '#AFC498',
    transit: '#A8B1B7',
    boundary: '#98A2A7',
    label: '#2E393F',
    roadLabel: '#46525A',
  },
  /**
   * Illustration tones: the Home drawing's own greens, paper and spark. Only for pictures, never for words or controls.
   * NOT `sys.color.art` (above): that is the tone set of a fact picture (FactArt). Two things with one word; do not
   * rename this one, `HomeIllustration` imports `sys.art`.
   * Where the drawing used a colour a hair off the palette it now uses the palette colour (its ground shadow is iconWell,
   * the back sheet greenSoft, the pin orange); these are the tones that are deliberately its own.
   */
  art: {
    /** The two ends of the green disc's gradient. */
    leafLight: '#21A879',
    leafDeep: GREEN,
    paperEdge: '#D8E7DF',
    /** The title line on the paper, and the two quieter lines under it. */
    paperTitle: '#327960',
    paperRule: '#C8DBD0',
    spark: '#FFAD60',
    dot: '#AECDBB',
  },
  /**
   * One scale, defined once in `theme/tokens`: 12 for what is touched or sits in a row (control, chip, badge and the
   * primary action alike), 24 for a card, 28 for a sheet. A circle or capsule is `pill`, never half of its own width.
   *
   * `check` (6) is the one corner below that scale: the corner of a checkbox box (22–24 px); nothing but a checkbox uses
   * it. The row corner (12) on a box that small drew a circle, which reads as a radio (card review r3 item 8).
   */
  radius: { ...radius, check: 6 },
  space,
  type: {
    ...type,
    /** Money and counts use tabular figures so columns and cards line up. */
    price: { fontSize: 23, lineHeight: 28, fontWeight: '700', letterSpacing: -0.7, fontVariant: ['tabular-nums'] } as TextStyle,
    cardTitle: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: -0.6 } as TextStyle,
    /** The title of a card that is showing itself small, inside a list of other cards. */
    cardTitleCompact: { fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -0.3 } as TextStyle,
    /** The one money figure a detail screen is built around. */
    priceLarge: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.7, fontVariant: ['tabular-nums'] } as TextStyle,
    /** Money inside a row that is compared with other rows. */
    priceSmall: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] } as TextStyle,
    /** Money on one line with a compact title (`cardTitleCompact`), as in a place's rows on the map: the same size. */
    priceRow: { fontSize: 16, lineHeight: 21, fontWeight: '700', fontVariant: ['tabular-nums'] } as TextStyle,
    /** The letter standing in for a photo, on a 96px avatar. */
    monogram: { fontSize: 30, lineHeight: 36, fontWeight: '700' } as TextStyle,
    /**
     * The answer in voice mode, read at a glance from arm's length while the thread's own `speech` (16/26) is read up
     * close: the same voice, a step larger.
     */
    speechLarge: { fontSize: 20, lineHeight: 30, fontWeight: '500' } as TextStyle,
  },
  /**
   * Motion, in milliseconds. Short, and only on a real change of state: a press, a switch, something arriving or
   * leaving, a screen pushed, the map camera moving. Exit is shorter than entry, and UI never eases in.
   *
   * THE RULE: nothing that states a fact animates. A price, an amount, a time, a place, a count, a status word or a
   * button label appears in its final form — never counted up, cross-faded between values or slid in on its own. What
   * moves is the container that carries it (a row arriving, a sheet opening), and under reduced motion nothing moves
   * at all: read `useReducedMotion` from `ui/system/motion`, the one source for that preference.
   *
   * THE EIGHT RULES (UI/UX pass, 2026-10-02; audit MO-M9). Every motion value is a token below, and
   * `__tests__/one-token-source.test.ts` fails on a `duration:`, a spring or a `scaleTo={0.9x}` spelled anywhere else:
   *
   *   R1 Only transform and opacity move: never height, width, top or an SVG prop (the locked V4.9 entry scene is the one
   *      exception). An SVG draw pass is what the B22 Reanimated flood replays.
   *   R2 Enter decelerates and is longer than exit: `easeOut` is passed explicitly to every React Navigation, Reanimated
   *      entrance or Animated.timing spec (a spec without a curve runs on the library's own ease-in-out, which spends the
   *      first tenth of the time at 3 % of the way). enter 240, exit 160, push 240, toggle 180, press 120 in and the `spring` out.
   *   R3 Sheets and anything the finger carries settle on ONE critically damped spring, `sheetSpring`. Nothing that carries
   *      text overshoots.
   *   R4 B22 (a flood of dead Reanimated native views): mounted-forever views; no `exiting` or layout animation anywhere; a
   *      row's animated wrapper is decided at mount and never switches; at most two Reanimated views per list row; an
   *      `entering` only for a genuinely new id, capped at six rows (`stagger`); loops (`loop`: the skeleton breath, the
   *      typing dots, the glow) run only on the focused screen, stop in the background and under reduced motion, and never
   *      more than four at once. New motion is RN Animated on the native driver, not Reanimated.
   *   R5 Haptics are outcomes, not touches: a tick belongs to a toggle or a confirmed result, never to a finger that has
   *      only gone down on navigation (which may be the start of a scroll). Every tick is made by `ui/system/haptics`: the
   *      system's own constants on Android, the generators on iOS, never closer than `tickGap`, and it stays under reduced
   *      motion (a tick is not movement).
   *   R6 Warm is still; cold after a skeleton arrives once (`arrive`); photos cross-dissolve (`toggle`, 180 ms); a spinner
   *      lives only inside a button.
   *   R7 One reduced-motion source, `ui/system/motion`: movement off, state changes instant, Lottie on its first frame,
   *      navigation 'none'.
   *   R8 The press-scale ladder `scale`: 0.97 a button, 0.985 a row or card, none for a big surface.
   */
  motion: {
    /** Response to a finger. */
    press: 120,
    /** A switch, a chip, a segment. */
    toggle: 180,
    /** Something arriving: a row, a panel, a confirmation. */
    enter: 240,
    exit: 160,
    /**
     * A screen pushed onto the stack: it enters, so it is as long as `enter` and decelerates. `(app)/_layout.tsx` passes
     * this duration AND `easeOut` to the navigator's transition spec; with only a duration React Native falls back to its
     * own ease-in-out, a slow start that reads as lag (rule R2).
     */
    push: 240,
    /** The map camera flying to a place. */
    camera: 360,
    /** The step between rows arriving together; stops after six rows. */
    stagger: 40,
    /** Decelerating: fast at the start, settling at the end. The one curve for everything that enters. */
    easeOut: [0.23, 1, 0.32, 1] as const,
    /**
     * The least time between two ticks of the same weight or a lighter one (`ui/system/haptics.ts`, rule R5): "less is
     * more" on a phone, and two taps of the vibrator a hair apart feel like one buzz. A heavier tick (an outcome after a
     * touch) is never held back by a lighter one.
     */
    tickGap: 120,
    /** How far a pressed surface gives under the finger. Legacy name: the button rung of `scale`, read by Press. */
    pressScale: PRESS_LADDER.button,
    /** The press-scale ladder (rule R8): `button`, `row` (a row or a card), `none` (a big surface). */
    scale: PRESS_LADDER,
    /** Everything under a finger settles on a spring, not a timing curve. */
    spring: { duration: 400, dampingRatio: 0.85 },
    /**
     * The one settle for every sheet (rule R3): critically damped, no bounce, in the form Gorhom's `animationConfigs` takes.
     * Reduced motion replaces it with `{ duration: 0 }`.
     */
    sheetSpring: { stiffness: 300, damping: 30, mass: 1, overshootClamping: true },
    /**
     * A sheet that a COMMAND closes (a button, the ×, Android Back, a tap outside): a short timing on `easeOut`, 160-180 ms,
     * quicker than the spring that opens it (plan 2.20; rule R2: exit is shorter than entry). Gorhom's `close()` takes it as
     * its own configuration; what the finger carries (a drag down) keeps `sheetSpring`.
     */
    sheetClose: 170,
    /**
     * A centred dialog (plan 2.20): the card opens on a scale from `from` to 1 over `enter`, decelerating (`easeOut`), inside the
     * native Modal's own fade. It leaves on that same window fade, which the platform plays after the screen has already been
     * told the question is over, so no JS exit is spelled here (plan: 140 ms; the system's short animation time is what the
     * window fade takes). Under reduced motion it neither fades nor scales: it is there, and then it is gone.
     */
    dialog: { enter: 200, from: 0.96 },
    /**
     * Loops, in milliseconds per half-turn (rule R4: focused screen only, never more than four at once, stopped in the
     * background and under reduced motion): the skeleton breath, the typing dots, the glow while listening.
     */
    loop: { breath: 700, typing: 520, glow: 1600 },
    /**
     * A moment, not a response: the picture of an empty state settling in once (rule R6). Long on purpose, so it is
     * never used for a control, a fact or anything the finger waits on.
     */
    arrive: { duration: 800, easing: [0.22, 0.8, 0.25, 1] as const },
  },
  touch,
  elevation,
  /**
   * The grid every screen stands on (UI pass 2026-10-08, `layout.ts`): the edge of a screen 20, sections 24 apart, a group 12,
   * a zone 32. Spaces between things are `sys.space` (4 8 12 16 24 32 48); `sys.space.lg` (20) is only the edge.
   */
  layout,
  /** The one divider: 1 dp, never `StyleSheet.hairlineWidth` (one physical pixel, a different line on every phone). */
  rule: { width: ruleWidth, color: LINE },
} as const;

/** Flat reading panels retain their original edge/padding. Navigable marketplace items explicitly opt into raisedItem. */
export const card: ViewStyle = { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1,
  borderColor: sys.color.cardLine, padding: 20 };
export const cardCompact: ViewStyle = { ...card, borderRadius: sys.radius.cardCompact, padding: 16 };
/** boxShadow needs Android 9+; minSdk is 24, so the phones before it get an elevation instead. */
const NO_BOX_SHADOW = Platform?.OS === 'android' && typeof Platform?.Version === 'number' && Platform.Version < 28;
/** Targeted lift for navigable marketplace items (owner material direction). No geometry or animation is imposed. */
export const raisedItem: ViewStyle = {
  backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line,
  ...(NO_BOX_SHADOW ? { elevation: 2 }
    : { boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.055), 0px 5px 12px rgba(0, 0, 0, 0.07)' }),
};
/** Neutral lift for floating layers; marketplace rows opt into the separate raisedItem material. */
export const floating: ViewStyle = NO_BOX_SHADOW ? { elevation: 1 }
  : { boxShadow: '0px 5px 18px rgba(0, 0, 0, 0.063), 0px 1px 2px rgba(0, 0, 0, 0.027)' };
/** Tactile map controls. Figma MaterialFilterChip 93:18; inset shadows require Android 10+. */
export const materialControl = {
  raised: (NO_BOX_SHADOW ? { elevation: 2 }
    : { boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.14), 0px 5px 12px rgba(0, 0, 0, 0.04)' }) as ViewStyle,
  inset: (Platform?.OS === 'android' && Number(Platform.Version) < 29 ? { elevation: 0, boxShadow: [] }
    : { boxShadow: 'inset 0px 2px 3px rgba(0, 0, 0, 0.17), inset 0px -1px 1px rgba(255, 255, 255, 0.9)' }) as ViewStyle,
} as const;
/**
 * The lift of a sheet over the map, in the system's shadow ink (review r3b: it was spelled in each sheet). A `docked`
 * sheet rises from the bottom edge (the Zadaci list), so its shadow falls upwards; a `detached` one floats free above
 * it (the PeekSheet with a pin's card), so its shadow falls below, deeper than `floating` because it covers more.
 */
export const sheetLift = {
  docked: (NO_BOX_SHADOW ? { elevation: 6 } : { boxShadow: '0px -2px 12px rgba(0, 0, 0, 0.08)' }) as ViewStyle,
  detached: (NO_BOX_SHADOW ? { elevation: 6 }
    : { boxShadow: '0px 10px 28px rgba(0, 0, 0, 0.14), 0px 2px 6px rgba(0, 0, 0, 0.06)' }) as ViewStyle,
} as const;
/** The one text field: 52px high, control corners, the strong hairline, body text. A multiline field adds its height. */
export const fieldBox = { minHeight: 52, borderWidth: 1, borderColor: sys.color.lineStrong, borderRadius: sys.radius.control,
  paddingHorizontal: 14, paddingVertical: 12, backgroundColor: sys.color.surface } satisfies ViewStyle;
/** Without `cursor`: expo's react-native-web typings widen TextStyle.cursor to `string`, which a Press (a ViewStyle) refuses; no field sets a cursor. */
export const field: Omit<TextStyle, 'cursor'> = { ...fieldBox, ...withInter(sys.type.body), color: sys.color.ink };
/** A note inside a screen or a card: a flat tint, no border, no shadow. */
export const inset: ViewStyle = { borderRadius: sys.radius.control, padding: 14 };
/**
 * A chosen pill chip (one look over the map and in the search panel): a neutral well with a 2 px
 * green edge, and the caller writes its label in green beside a green tick. Never the green fill:
 * that is the one primary action's. A free chip has a 1 px edge, so a chosen one takes 1 px off its side padding
 * (`CHIP_CHOSEN_INSET`) and its words do not move.
 */
export const chipChosen: ViewStyle = { backgroundColor: sys.color.greenSoft, borderWidth: 2, borderColor: sys.color.green };
export const CHIP_CHOSEN_INSET = 1;

/**
 * The one primary action on a screen: green surface with a white label, as V28 and V41 draw it. The owner, looking at
 * the orange "Oceni saradnju" on his phone (2026-09-23 evening): "nije ove boje … loš fazon". Every other action stays
 * white with a green label; orange is an accent only (the Home publish tile, what waits for you, the map's "+").
 * Pass as `style` to a V2Action; V2Action reads the surface and writes the label in `onGreen`.
 */
export const brandAction: ViewStyle = { backgroundColor: sys.color.green, borderWidth: 0, minHeight: 54, borderRadius: sys.radius.primary };

/**
 * 48px icon control in a quiet well (V5 head icon button). The screen chrome no longer draws it: its arrow, X, profile,
 * bell and "···" are `ChromeIconButton` (ui/system/ScreenChrome, 2026-09-24). The AI conversation's options button is
 * the one place left that still uses this token, until that bar moves onto the chrome.
 */
export const iconButton: ViewStyle = { width: 48, height: 48, borderRadius: sys.radius.chip, backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center' };
/**
 * The 48px well a menu row's picture sits in (the "···" sheet). It is a picture box, not a button, and has its own token
 * so that redrawing the icon button never changes the menu.
 */
export const pictureWell: ViewStyle = { width: 48, height: 48, borderRadius: sys.radius.chip, backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center' };

