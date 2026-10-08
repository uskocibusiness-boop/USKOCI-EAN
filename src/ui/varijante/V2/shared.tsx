import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { inicijali } from '../../../lib/inicijali';
import { T } from '../../Text';
import { Avatar, type AvatarSize } from '../../system/Avatar';
import { FactArt } from '../../system/FactArt';
import { layout, ruleWidth } from '../../system/layout';
import { useReducedMotion } from '../../system/motion';
import { plural } from '../../system/plural';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { Surface } from '../../system/Surface';
import { TAB_BAR_PADDING, TAB_CAPSULE, TAB_ITEM_BOTTOM, TAB_ITEM_PADDING, TAB_ITEM_TOP, TabCapsule, TabGlyph, TabLabel, tabBarHeight, tabBarSurface } from '../../system/TabBarItem';
import { useTextScale } from '../../system/textScale';
import { sys } from '../../system/tokens';
import { countWords, NEWEST_FIRST } from '../../v2/discovery/discoveryWords';

/**
 * Zajednički delovi varijanti grupe V2 (laboratorija, lažni podaci). Ništa odavde nije proizvodni fajl: ono što vlasnik izabere prenosi se
 * kasnije u `TaskRecordBody`, `PublicNeedPresentation` i `DiscoverySearchPanel`; ovde su samo lokalni omotači nad postojećim primitivama.
 */

/* ------------------------------------------------------------------------------------------ B1 · Uskok sa smerom */

/** Kriva `sys.motion.easeOut` kao funkcija napretka po vremenu, da zamrznut kadar stoji tačno gde bi pokret bio u tom trenutku. */
function bezier(p1x: number, p1y: number, p2x: number, p2y: number): (x: number) => number {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  const slope = (a: number, b: number, t: number) => 3 * (1 - t) * (1 - t) * a + 6 * (1 - t) * t * (b - a) + 3 * t * t * (1 - b);
  return x => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = slope(p1x, p2x, t);
      if (Math.abs(dx) < 1e-6) break;
      t = Math.min(1, Math.max(0, t - (at(p1x, p2x, t) - x) / dx));
    }
    return at(p1y, p2y, t);
  };
}
const easeOut = bezier(...sys.motion.easeOut);

/** Napredak (0..1) pokreta koji traje `duration` i počinje posle `delay`, u trenutku `ms` od okidača. */
export function napredakU(ms: number, duration: number, delay = 0): number {
  const x = Math.min(1, Math.max(0, (ms - delay) / duration));
  return easeOut(x);
}

/** Koliko stvar uskače: 8 dp, kao `Appear` (B1). */
const USKOK = sys.space.sm;

/**
 * Uskok sa smerom (pravac B1): ono što stiže od druge strane ulazi odozgo (−8 → 0), ono što ti polažeš odozdo (+8 → 0), uz providnost
 * 0 → 1, `enter` 240 ms na `easeOut`, RN Animated na nativnom pokretaču. Pod smanjenim pokretom stoji odmah.
 *
 * `kadar` zamrzava pokret u milisekundi od okidača: laboratorija tako snima niz kadrova iste krive (slika ne pokazuje pokret). U aplikaciji
 * `kadar` ne postoji: ovo je `Appear` sa `from`, što je predlog izmene sistemske primitive, ne nova.
 */
export function Uskok({ from = 'above', play = true, delay = 0, kadar, style, children }: {
  from?: 'above' | 'below'; play?: boolean; delay?: number; kadar?: number; style?: StyleProp<ViewStyle>; children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const still = reduced || !play;
  const start = still ? 1 : kadar !== undefined ? napredakU(kadar, sys.motion.enter, delay) : 0;
  const value = useRef(new Animated.Value(start)).current;
  useEffect(() => {
    if (still) { value.setValue(1); return; }
    if (kadar !== undefined) { value.setValue(napredakU(kadar, sys.motion.enter, delay)); return; }
    const run = Animated.timing(value, { toValue: 1, duration: sys.motion.enter, delay, easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [still, kadar, delay, value]);
  const translateY = value.interpolate({ inputRange: [0, 1], outputRange: [from === 'above' ? -USKOK : USKOK, 0] });
  return <Animated.View style={[style, { opacity: value, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/* ------------------------------------------------------------------------------------------------- B4 · Lice */

/**
 * Lice kao nalepnica (B4): postojeći `Avatar` sa belom ivicom 2; senku dobija samo glavna osoba ekrana (`senka`), nikad u listi, da u
 * kadru ne bude više od šest senki. Predlog za `Avatar`: `edge` i `ring` kao opciona svojstva.
 */
export function Lice({ ime, size, senka = false }: { ime: string | null | undefined; size: AvatarSize; senka?: boolean }) {
  return <View style={[s.lice, senka && sys.elevation.card]}>
    <Avatar initials={inicijali(ime)} size={size} />
  </View>;
}

/** Prvo ime iz podataka („Marija Ilić“ → „Marija“, „Jelena N.“ → „Jelena“); null kad imena nema, da se ništa ne izmisli. */
export function prvoIme(ime: string | null | undefined): string | null {
  const first = (ime ?? '').trim().split(/\s+/)[0] ?? '';
  return first.length > 1 ? first : null;
}

/**
 * Ocena kako je vidi detalj (pravac, detalj A): tri i više ocena = zvezdica i broj, jedna ili dve = „Nova ocena“, nijedna = „Još nema ocena“,
 * nepoznato = ništa. Nikad se ne izmišlja broj.
 */
export function poverenje(rating: string | null | undefined, count: number | null | undefined): { text: string; star: boolean } | null {
  if (count === 0) return { text: 'Još nema ocena', star: false };
  if (!rating) return null;
  if (typeof count === 'number' && count > 0 && count < 3) return { text: 'Nova ocena', star: false };
  if (typeof count === 'number' && count >= 3) return { text: `${rating} · ${plural(count, 'ocena', 'ocene', 'ocena')}`, star: true };
  return { text: rating, star: true };
}

/* --------------------------------------------------------------------------------------- B5 · Prazna etiketa */

/** Nepoznata cena je predmet i reč, nikad broj: etiketa 28 (narandžasta) + „Prima ponude“ / „Cena nije navedena“ u `note`. */
export function PraznaEtiketa({ rec, align = 'end' }: { rec: string; align?: 'start' | 'end' }) {
  return <View style={[s.etiketa, align === 'end' ? s.etiketaEnd : s.etiketaStart]}>
    <FactArt kind="offers" size={28} cut="art" />
    <T variant="note" tone="muted" style={align === 'end' ? s.desno : undefined}>{rec}</T>
  </View>;
}

/** Jedan merljiv razlog iz podataka („Imaš kombi“), sa kvačicom 16 koja sme da kaže „potvrđeno“ jer profil to potvrđuje. */
export function Razlog({ text }: { text: string }) {
  return <View style={s.razlog} accessible accessibilityRole="text" accessibilityLabel={text}>
    <FactArt kind="check" size={16} />
    <T variant="note" style={s.razlogText}>{text}</T>
  </View>;
}

/* ---------------------------------------------------------------------------------------------- okviri scena */

/** Traka tabova korena, nacrtana od istih delova kao prava (`TabBarItem`), sa „Zadaci“ izabranim; ne vodi nikud. */
export function TrakaTabova() {
  const labelHeight = sys.type.navLabel.lineHeight * useTextScale();
  const tabs = [{ kind: 'home', title: 'Početna' }, { kind: 'map', title: 'Zadaci' }, { kind: 'agreements', title: 'Dogovori' }, { kind: 'chat', title: 'Poruke' }] as const;
  return <View style={[tabBarSurface, s.traka, { height: tabBarHeight(labelHeight, TAB_BAR_PADDING) }]} accessibilityRole="tablist">
    {tabs.map((tab, index) => <View key={tab.kind} accessibilityRole="tab" accessibilityState={{ selected: index === 1 }} style={s.tab}>
      <TabCapsule selected={index === 1} radius={TAB_CAPSULE} />
      <View style={s.tabIcon}><TabGlyph kind={tab.kind} selected={index === 1} /></View>
      <TabLabel selected={index === 1}>{tab.title}</TabLabel>
    </View>)}
  </View>;
}

/**
 * Lista Zadataka kao list preko mape: traka mape gore (samo boja tla mape, mapa i pin se ne crtaju ni ne diraju), beli list sa gornjim
 * uglovima 28, red brojača („6 zadataka · Najnovije prvo“) kao u pravom listu, kartice ispod, traka tabova na dnu.
 */
export function ListaOkvir({ count, children }: { count: number; children: ReactNode }) {
  return <SafeAreaView edges={['top']} style={s.screen}>
    <View style={s.mapa} />
    <View style={s.list}>
      <View style={s.brojac} accessible accessibilityRole="header" accessibilityLabel={`${countWords(count)}, ${NEWEST_FIRST}`}>
        <T variant="heading" style={s.ink}>{countWords(count)}</T>
        <T variant="note" tone="muted">{NEWEST_FIRST}</T>
      </View>
      <ScrollView contentContainerStyle={s.kartice}>{children}</ScrollView>
    </View>
    <TrakaTabova />
  </SafeAreaView>;
}

/**
 * Kartica izabranog pina: jedan plutajući okvir 16 od ivica iznad trake tabova (kao `DiscoveryPeek`), sa × gore desno; lice kartice unutra
 * je isto lice koje lista crta, pa prvi red čuva mesto za ×. Tlo je boja mape bez mape.
 */
export function PeekOkvir({ children }: { children: ReactNode }) {
  return <SafeAreaView edges={['top']} style={s.screen}>
    <View style={s.mapaCela}>
      <View style={s.peek}>
        <Surface kind="float" style={s.peekSurface} accessibilityLabel="Zadatak na mapi">
          <View style={s.peekBody}>{children}</View>
          <View style={s.peekClose}><ChromeIconButton label="Zatvori pregled zadatka" glyph="close" onPress={() => undefined} /></View>
        </Surface>
      </View>
    </View>
    <TrakaTabova />
  </SafeAreaView>;
}

/** Prvi red lica kartice u peek okviru ostavlja mesto za × (jedna kontrola hroma, 48). */
export const clearOfCloseStyle: ViewStyle = { marginRight: layout.touch, minHeight: layout.touch };

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  ink: { color: sys.color.ink },
  desno: { textAlign: 'right' },
  lice: { borderRadius: sys.radius.pill, borderWidth: 2, borderColor: sys.color.surface, backgroundColor: sys.color.surface },
  etiketa: { gap: sys.space.xs, flexShrink: 0 },
  etiketaEnd: { alignItems: 'flex-end' },
  etiketaStart: { alignItems: 'flex-start' },
  razlog: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  razlogText: { color: sys.color.ink, fontWeight: '600', flexShrink: 1 },
  traka: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', paddingHorizontal: TAB_ITEM_PADDING, paddingTop: TAB_ITEM_TOP, paddingBottom: TAB_ITEM_BOTTOM,
    borderRadius: TAB_CAPSULE, overflow: 'hidden' },
  tabIcon: { width: 31, height: 28, alignItems: 'center', justifyContent: 'center' },
  // Traka mape iznad lista: boja tla mape (sys.map), bez mape. 96 je visina trake mape koja ostaje vidljiva na punoj visini lista.
  mapa: { height: 96, backgroundColor: sys.map.ground },
  mapaCela: { flex: 1, backgroundColor: sys.map.ground, justifyContent: 'flex-end' },
  list: { flex: 1, backgroundColor: sys.color.surface, borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet,
    borderWidth: ruleWidth, borderColor: sys.color.line },
  brojac: { flexDirection: 'row', alignItems: 'baseline', gap: sys.space.sm, paddingHorizontal: layout.gutter, paddingTop: sys.space.base, paddingBottom: sys.space.sm },
  kartice: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: layout.zone, gap: layout.group },
  peek: { marginHorizontal: layout.mapInset, marginBottom: sys.space.md },
  peekSurface: { borderRadius: sys.radius.card },
  peekBody: { padding: sys.space.base },
  peekClose: { position: 'absolute', top: sys.space.sm, right: sys.space.sm },
});
