import { memo, type ReactNode } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { BrandMark } from '../../entry/BrandAssets';
import { T } from '../../Text';
import { Avatar, type AvatarSize } from '../../system/Avatar';
import { FactArt } from '../../system/FactArt';
import { STATUS_TONES, StatusMark } from '../../system/StatusChip';
import { sys } from '../../system/tokens';
import { useProgress } from './lab';

/**
 * The small pieces the V4 variants share. Each is a LOCAL stand-in for something the system would get if the owner chooses the
 * variant (the report names the change): `Lice` is `Avatar` with `edge` and `ring`, `ParLica` is the `PairFaces` of pravac B4,
 * `ZvezdaNalepnica` is the vector stand-in for the star drawing G2, `TriBroja` is the three figures of pravac B5, `Uskok` is
 * `Appear` with a direction (B1), `Pecat` and `Sjaj` are the two moments of the saved rating (B3, R4 M4). Nothing here is read
 * by production code.
 */

/** The white sticker edge of the main person's face (pravac A, R4 S7) and the ring that carries a state: 2 dp, two rules wide; no token holds it. */
export const FACE_EDGE = 2;
/** What the ring around the main face says: the Dogovor is live (agreed, under way, waiting for a confirmation), or over. */
export type FaceRing = 'none' | 'live' | 'over';

/** A face. `edge`: the main person, a white edge and one soft shadow (a sticker). `ring`: the state, in colour and shape together with the words beside it. */
export function Lice({ initials, size, edge = false, ring = 'none' }: { initials: string | null | undefined; size: AvatarSize; edge?: boolean; ring?: FaceRing }) {
  const ringColor = ring === 'live' ? sys.color.green : ring === 'over' ? sys.color.lineStrong : null;
  return <View accessible={false} style={[s.face, edge && s.faceEdge, edge && sys.elevation.soft, ringColor ? { borderWidth: FACE_EDGE, borderColor: ringColor } : null]}>
    <Avatar initials={initials} size={size} />
  </View>;
}

/** How far the two faces of a pair overlap: 12 dp (pravac B4). */
const PAIR_OVERLAP = sys.space.md;
/** Two people in one Dogovor, seen together: the other person in front with the ring, me behind (pravac B4 "Par"). Decoration: the names stand beside it. */
export function ParLica({ other, me, ring, size = 56 }: { other: string | null | undefined; me: string | null | undefined; ring: FaceRing; size?: 56 | 40 }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.pair}>
    <View style={s.pairFront}><Lice initials={other} size={size} edge ring={ring} /></View>
    <View style={[s.pairBack, { marginLeft: -PAIR_OVERLAP }]}><Lice initials={me} size={size} edge /></View>
  </View>;
}

/** The seal of a Dogovor: the mark at 28, the vector cut of `BrandMark` (pravac B2 "ostatak": the first step of the way is the handshake). */
export const SEAL = 28;
export function ZnakPecat() {
  return <View accessible={false} style={s.seal}><BrandMark size={SEAL} /></View>;
}

/** The star of the FactArt sticker, drawn once more here so a full and an empty star share one geometry (G2, until the owner's drawing). */
const STAR = 'M16 2.9 19.06 11.29 27.98 11.61 20.95 17.11 23.41 25.69 16 20.7 8.59 25.69 11.05 17.11 4.02 11.61 12.94 11.29Z';
const STAR_EDGE = 1.5;
/**
 * A rating star as a 2.5D sticker (pravac P8): the full one in the accent enamel (orange face, darker edge 1.5 under it, one
 * shine), the empty one in cream enamel (the orange's soft tint with its halo as the edge), the same shape. Vector, until the
 * owner approves the drawing G2 (then this becomes an `expo-image` of it). Decoration: the words beside the stars say the rating.
 */
export const ZvezdaNalepnica = memo(function ZvezdaNalepnica({ size, full }: { size: number; full: boolean }) {
  const face = full ? sys.color.art.accent.front : sys.color.orangeSoft;
  const edge = full ? sys.color.art.accent.edge : sys.color.orangeHalo;
  const light = full ? sys.color.art.accent.light : sys.color.surface;
  return <View aria-hidden accessible={false} style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Ellipse cx={16} cy={29.4} rx={10.2} ry={1.6} fill={sys.color.ink} opacity={0.07} />
      <Path d={STAR} fill={edge} stroke={edge} strokeWidth={2.2} strokeLinejoin="round" transform={`translate(0 ${STAR_EDGE})`} />
      <Path d={STAR} fill={face} stroke={face} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M13.8 11.1l1.5-4.2" fill="none" stroke={light} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  </View>;
});

/** A flat star (variants B and C): the `mark` cut of the FactArt star, orange when full, quiet when empty. */
export function ZvezdaRavna({ size, full }: { size: number; full: boolean }) {
  return <FactArt kind="star" size={size} cut="mark" tone={full ? 'accent' : 'quiet'} />;
}

export type Broj = {
  /** The figure, as the server gave it ("4,8", "9", "90 %"); null when there is none, and `word` says so. */
  value: string | null;
  /** The words in place of a figure that does not exist yet ("Nova ocena"): never a zero that was not counted. */
  word?: string;
  /** What the figure is, under it, in the smallest type (12). */
  label: string;
  /** The rating carries the flat star beside its figure. */
  star?: boolean;
};
/** Display 32 at 700 with tabular figures: the type scale has `display` at 600; a figure that leads a screen (variant B) is 700, as every amount is. */
const DISPLAY_NUMBER: TextStyle = { ...sys.type.display, fontWeight: '700', fontVariant: ['tabular-nums'] };
/**
 * Three figures in one row, the only "table" without lines (pravac B5, C.15): rating · finished · comes as agreed. Each figure is the
 * server's or it is a word; the row is one stop for a screen reader. `large` is 24/700 (`priceLarge`), `display` 32/700 for the
 * variant where the figures lead the screen.
 */
export function TriBroja({ cells, size = 'large', align = 'center', testID }: { cells: readonly [Broj, Broj, Broj]; size?: 'large' | 'display'; align?: 'center' | 'left'; testID?: string }) {
  const spoken = cells.map(cell => `${cell.value ?? cell.word ?? ''} ${cell.label}`.trim()).join('; ');
  const left = align === 'left';
  return <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={spoken} style={s.tri}>
    {cells.map((cell, index) => <View key={index} style={[s.cell, left && s.cellLeft]}>
      {cell.value ? <View style={s.valueRow}>
        {cell.star ? <FactArt kind="star" size={16} /> : null}
        <T style={[size === 'display' ? DISPLAY_NUMBER : sys.type.priceLarge, s.ink]}>{cell.value}</T>
      </View> : <T variant="bodyStrong" style={[s.word, left && s.wordLeft]}>{cell.word}</T>}
      <T variant="label" tone="muted" style={[s.label, left && s.labelLeft]}>{cell.label}</T>
    </View>)}
  </View>;
}

/** How far a thing that arrives starts from its place: 8 dp, as `Appear` has it. */
const USKOK = sys.space.sm;
/**
 * The family movement with a direction (pravac B1): what comes from the OTHER side enters from above, what I lay on the table from
 * below; 8 dp and `enter` (240 ms), decelerating. RN Animated on the native driver, transform and opacity only; still under reduced
 * motion and frozen in the lab.
 */
export function Uskok({ from, delay = 0, style, children }: { from: 'above' | 'below'; delay?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const progress = useProgress(sys.motion.enter, delay);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [from === 'above' ? -USKOK : USKOK, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** The stamp (pravac B3): it falls from 1,25× to 1 and from nothing to whole in 140 ms, tilted −4°. Below `toggle` (180) on purpose: a stamp is shorter than a switch; no token names it. */
export const PECAT_MS = 140;
const PECAT_FROM = 1.25;
const PECAT_TILT = '-4deg';
export function Pecat({ delay = 0, style, children }: { delay?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const progress = useProgress(PECAT_MS, delay);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [PECAT_FROM, 1] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ scale }, { rotate: PECAT_TILT }] }]}>{children}</Animated.View>;
}

/** The one glow in the app (pravac C.5, R4 M4): a white band crosses the full stars once, 420 ms; longer than `enter`, shorter than `arrive`; no token names it. */
export const SJAJ_MS = 420;
/** The band is about a third of the row. */
const SJAJ_SHARE = 0.35;
export function Sjaj({ width, delay = 0, children }: { width: number; delay?: number; children: ReactNode }) {
  const progress = useProgress(SJAJ_MS, delay);
  const band = Math.round(width * SJAJ_SHARE);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-band, width] });
  const opacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.8, 0] });
  return <View style={[s.sjaj, { width }]}>
    {children}
    <Animated.View pointerEvents="none" style={[s.band, { width: band, opacity, transform: [{ translateX }, { skewX: '-16deg' }] }]} />
  </View>;
}

/** The state pill "Ocenjeno": the measure of `StatusChip` (which has no key for a rating yet), with the check and the green tone. */
export function PilulaOcenjeno() {
  const palette = STATUS_TONES.green;
  return <View accessible accessibilityRole="text" accessibilityLabel="Ocenjeno" style={[s.pill, { backgroundColor: palette.ground }]}>
    <StatusMark shape="check" tone="green" />
    <T variant="label" style={[s.pillWord, { color: palette.word }]}>Ocenjeno</T>
  </View>;
}

/** The orange dot before a move that is mine (the one accent of a card), the measure of the waiting foot's dot. */
export function TackaCeka() {
  return <View accessible={false} style={s.dot} />;
}

const s = StyleSheet.create({
  face: { borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  faceEdge: { padding: FACE_EDGE },
  pair: { flexDirection: 'row', alignItems: 'center' },
  pairFront: { zIndex: 1 },
  pairBack: {},
  seal: { width: SEAL, height: SEAL, alignItems: 'center', justifyContent: 'center' },
  tri: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  cell: { flex: 1, minWidth: 0, alignItems: 'center', gap: sys.space.xs },
  cellLeft: { alignItems: 'flex-start' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  ink: { color: sys.color.ink },
  word: { color: sys.color.ink, textAlign: 'center' },
  wordLeft: { textAlign: 'left' },
  // The `label` type tracks wide for capitals; these are words, so the tracking is taken back.
  label: { letterSpacing: 0, textAlign: 'center' },
  labelLeft: { textAlign: 'left' },
  sjaj: { overflow: 'hidden', borderRadius: sys.radius.control, alignSelf: 'center' },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: sys.color.surface },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingVertical: sys.space.xs,
    paddingLeft: sys.space.sm, paddingRight: sys.space.md, borderRadius: sys.radius.pill },
  pillWord: { letterSpacing: 0 },
  dot: { width: 10, height: 10, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
});
