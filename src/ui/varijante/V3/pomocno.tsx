import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Avatar, type AvatarSize } from '../../system/Avatar';
import { KeyValueRow } from '../../system/KeyValueRow';
import { layout } from '../../system/layout';
import { useReducedMotion } from '../../system/motion';
import { Surface } from '../../system/Surface';
import { tick, type Tick } from '../../system/haptics';
import { sys } from '../../system/tokens';
import { T } from '../../Text';

/**
 * Zajednički delovi varijanti grupe V3 (laboratorija, 8. okt 2026). Ništa ovde ne menja sistem: `Appear`/`Arrive` ostaju kakvi
 * su; ovo je lokalni omotač za jedan JEDINI sat trenutka, iz kojeg se svaki pokret čita interpolacijom, da bi laboratorija mogla
 * da zaustavi trenutak u tačnom kadru (`?t=150`). Sve je RN `Animated` na native driveru, samo `transform` i `opacity` (B22).
 */

export const EASE_OUT = Easing.bezier(...sys.motion.easeOut);
/** Koliko stvar uskoči u kadar: 8 dp (pravac B1), isti broj kao red koji stiže u `Appear`. */
export const USKOK_DP = sys.space.sm;
/** Dolazak dve strane u Stisku i Susretu: 20 dp sa svake strane (pravac B2); nema tokena za razdaljinu, zato ime ovde. */
export const STISAK_DP = 20;
/** Pečat pada za 140 ms (pravac B3). Tokena nema (press 120, toggle 180): ako vlasnik izabere pečat, predlog je `sys.motion.stamp`. */
export const PECAT_MS = 140;
/** Nagib pilule-pečata, samo na pilulji, nikad na činjenicama (B3). */
export const PECAT_NAGIB = '-4deg';
/** Pin i osmeh se otkriju kad se ruke dodirnu: 120 ms (B2). Isti broj kao `press`; ime kaže šta je. */
export const OTKRIVANJE_MS = sys.motion.press;

/**
 * Jedan sat za ceo trenutak, u milisekundama od okidača. Teče jednom, linearno, do `total`; svaki deo trenutka je interpolacija
 * tog sata sa svojom krivom (`kadar`). `holdAt` zaustavlja sat u kadru (laboratorija); smanjen pokret stavlja sat na kraj: ista
 * slika, bez kretanja (R7).
 */
export function useSat(total: number, holdAt?: number) {
  const reduced = useReducedMotion();
  const held = holdAt !== undefined;
  const clock = useRef(new Animated.Value(held ? Math.min(holdAt, total) : reduced ? total : 0)).current;
  useEffect(() => {
    if (held) { clock.setValue(Math.min(holdAt, total)); return; }
    if (reduced) { clock.setValue(total); return; }
    clock.setValue(0);
    const run = Animated.timing(clock, { toValue: total, duration: total, easing: Easing.linear, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [clock, held, holdAt, reduced, total]);
  return { clock, reduced, held };
}

/** Jedan deo trenutka: od `from` do `to` ms, vrednost ide po `outputRange`, podrazumevano na `easeOut` (R2). Van opsega stoji. */
export function kadar(clock: Animated.Value, from: number, to: number, outputRange: readonly number[], easing = EASE_OUT) {
  return clock.interpolate({ inputRange: [from, Math.max(to, from + 1)], outputRange: [...outputRange], extrapolate: 'clamp', easing });
}

/** Uskok sa smerom (B1): odozgo stiže tuđe, odozdo stiže moje; providnost 0 → 1 i 8 dp puta. */
export function uskok(clock: Animated.Value, start: number, from: 'above' | 'below' | 'still' = 'below', trajanje = sys.motion.enter) {
  const dy = from === 'above' ? -USKOK_DP : from === 'below' ? USKOK_DP : 0;
  return { opacity: kadar(clock, start, start + trajanje, [0, 1]), transform: [{ translateY: kadar(clock, start, start + trajanje, [dy, 0]) }] };
}

/** Pečat (B3): pilula 1,25× i providna pada na svoje mesto za `PECAT_MS`, nagnuta −4°, bez preskoka. */
export function pecat(clock: Animated.Value, start: number) {
  const PECAT_SKALA = 1.25;
  return { opacity: kadar(clock, start, start + PECAT_MS, [0, 1]),
    transform: [{ rotate: PECAT_NAGIB }, { scale: kadar(clock, start, start + PECAT_MS, [PECAT_SKALA, 1]) }] };
}

/**
 * Dolazak predmeta (R6, V41 „art arrive“, isti brojevi kao sistemski `Arrive`: 800 ms, mali uzlet 4 → −3 → 0, nagib −3° → 1° → 0°,
 * providnost 0,65 → 1), ali čitan sa sata trenutka, da bi kadar mogao da stane. `Arrive` sam ostaje netaknut.
 */
export function dolazak(clock: Animated.Value, start: number) {
  const progress = kadar(clock, start, start + sys.motion.arrive.duration, [0, 1], Easing.bezier(...sys.motion.arrive.easing));
  return { opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.65, 1, 1] }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [4, -3, 0] }) },
      { rotate: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: ['-3deg', '1deg', '0deg'] }) }] };
}

/** Tik tačno u kadru (R5, MOTION N5): kad se ruke dodirnu, kad pečat padne. Zaustavljen sat (laboratorija) ne tiče; smanjen pokret tiče odmah. */
export function useTikU(kind: Tick, at: number, sat: { held: boolean; reduced: boolean }) {
  useEffect(() => {
    if (sat.held) return;
    const timer = setTimeout(() => tick(kind), sat.reduced ? 0 : at);
    return () => clearTimeout(timer);
  }, [kind, at, sat.held, sat.reduced]);
}

/** Lice osobe (B4): sistemski `Avatar`; glavna osoba nosi belu ivicu 2 i jednu senku (nalepnica), ostala lica ništa. */
export function Lice({ inicijali, size, istaknuto = false }: { inicijali: string | null | undefined; size: AvatarSize; istaknuto?: boolean }) {
  return <View style={[s.lice, istaknuto && s.nalepnica]}><Avatar initials={inicijali} size={size} /></View>;
}

/** Zvezdica 16 ravna uz broj („4,8 · 11 ocena“), nikad reč „ocena“ bez broja; bez broja piše šta piše (B5). */
export { CandidateTrustLine as Ocena } from '../../v2/CandidateFace';

/**
 * Cedulja: priznanica kao `panel` (okvir, bez senke: samo se čita) sa redovima label/vrednost. Jedan oblik za „Ovo šalješ“,
 * „Prijava je poslata“, nacrt kao priznanicu i „Dogovoreno!“ kao reč (B2 rezerva, K2 glas).
 */
export function Cedulja({ redovi, style, children }: { redovi: { label: string; value: string; price?: boolean }[]; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return <Surface kind="panel" style={[s.cedulja, style]}>
    {redovi.map((red, index) => <KeyValueRow key={red.label} label={red.label} value={red.value} emphasis={red.price ? 'price' : undefined} last={index === redovi.length - 1} />)}
    {children}
  </Surface>;
}

/** Kolona trenutka: sve na sredini, 24 između blokova, radnja široka koliko i reči (320), nikad na mestu prethodnog dugmeta. */
export function Pozornica({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.pozornica, style]}>{children}</View>;
}

/** Oznaka u laboratoriji: koji je ovo kadar (ms od okidača). Nije deo ekrana; crta se samo kad je sat zaustavljen. */
export function KadarOznaka({ t }: { t?: number }) {
  if (t === undefined) return null;
  return <View pointerEvents="none" style={s.kadar}><T variant="label" tone="muted">{`t = ${t} ms`}</T></View>;
}

/** Povratak na spisak scena laboratorije: ista ruta, bez parametra. */
export function nazadNaSpisak() { router.setParams({ scene: '', t: '' }); }
/** Prelaz na drugu scenu iste rute (dodir kartice vodi na trenutak). */
export function naScenu(scene: string) { router.setParams({ scene, t: '' }); }

const s = StyleSheet.create({
  lice: { borderRadius: sys.radius.pill },
  nalepnica: { borderWidth: 2, borderColor: sys.color.surface, ...sys.elevation.card, backgroundColor: sys.color.surface },
  cedulja: { alignSelf: 'stretch' },
  pozornica: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: layout.section, paddingHorizontal: layout.gutter },
  kadar: { position: 'absolute', top: sys.space.sm, right: layout.gutter },
});
