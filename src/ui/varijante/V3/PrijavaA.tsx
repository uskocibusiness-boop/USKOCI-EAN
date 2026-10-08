import { Animated, StyleSheet, View } from 'react-native';
import type { PotrebaProjekcija } from '../../../contracts/projections';
import { readableTitle } from '../../../data/needDetailPresentation';
import { ProductHeader } from '../../product/ProductDetails';
import { Screen } from '../../system/Screen';
import { StatusChip } from '../../system/StatusChip';
import { brandAction, sys } from '../../system/tokens';
import { T } from '../../Text';
import { V2Action } from '../../v2/V2Action';
import { Cedulja, KadarOznaka, PECAT_MS, Pozornica, nazadNaSpisak, pecat, useSat, useTikU, uskok } from './pomocno';
import { PRIJAVA_RECENICA, type PRIJAVA } from './podaci';

/**
 * Prijava je poslata · varijanta A „Cedulja sa pečatom“ (iz predmeta; pravac B3 Pečat; vrh C.2).
 *
 * Šta vodi: PRIZNANICA stoji na sredini kao cedulja koju si položio na sto (zadatak, ponuda, ljudi, termin, poruka), a na njen gornji
 * desni ugao PADNE pilula „Poslata“: ista sistemska pilula stanja, nagnuta −4°, 1,25× → 1 i providnost 0 → 1 za 140 ms, bez preskoka,
 * tik `light` na dodiru. Reč stanja ulazi gotova u pilulji (ne animira se tekst, pomera se kontejner); nagib je samo na pilulji. Iznad:
 * „Prijava je poslata.“; ispod: „Ako te izaberu, odmah nastaje Dogovor.“ i jedno zeleno „Otvori moje prijave“. Cedulja sama stiže
 * odozdo (moje ide na sto, B1), pečat tek kad legne.
 */
const CEDULJA = sys.motion.enter;
export const PRIJAVA_A_TRAJANJE = CEDULJA + PECAT_MS + sys.motion.enter;

export function PrijavaA({ need, prijava, holdAt }: { need: PotrebaProjekcija; prijava: typeof PRIJAVA; holdAt?: number }) {
  const sat = useSat(PRIJAVA_A_TRAJANJE, holdAt);
  useTikU('light', CEDULJA, sat);
  const redovi = [{ label: 'Zadatak', value: readableTitle(need.naslov) }, { label: 'Ukupna ponuda', value: `${prijava.iznos} ${prijava.osnova}`, price: true },
    { label: 'Ljudi', value: prijava.ljudi }, { label: 'Termin', value: prijava.termin }, { label: 'Poruka', value: prijava.poruka }];
  return <Screen kind="flow" scroll header={<ProductHeader title="Tvoja prijava" backLabel="Nazad na zadatak" back={nazadNaSpisak} />}>
    <Pozornica style={s.pozornica}>
      <T accessibilityRole="alert" accessibilityLiveRegion="polite" variant="title" style={s.naslov}>Prijava je poslata.</T>
      <Animated.View style={[s.cedulja, uskok(sat.clock, 0, 'below')]}>
        <Cedulja redovi={redovi} />
        <Animated.View style={[s.pecat, pecat(sat.clock, CEDULJA)]}><StatusChip status="application.sent" /></Animated.View>
      </Animated.View>
      <T variant="copy" tone="muted" style={s.naslov}>{PRIJAVA_RECENICA}</T>
      <Animated.View style={[s.radnje, uskok(sat.clock, CEDULJA + PECAT_MS, 'below')]}>
        <V2Action label="Otvori moje prijave" style={brandAction} onPress={nazadNaSpisak} />
        <V2Action label="Nazad na zadatak" kind="quiet" onPress={nazadNaSpisak} />
      </Animated.View>
    </Pozornica>
    <KadarOznaka t={holdAt} />
  </Screen>;
}

const s = StyleSheet.create({
  pozornica: { paddingHorizontal: 0, paddingTop: sys.space.base, justifyContent: 'flex-start' },
  naslov: { color: sys.color.ink, textAlign: 'center', maxWidth: 320 },
  cedulja: { alignSelf: 'stretch', maxWidth: 360, width: '100%', paddingTop: sys.space.sm },
  // Pečat sedi preko gornjeg desnog ugla cedulje: 8 iznad ivice, 8 van nje.
  pecat: { position: 'absolute', top: -sys.space.xs, right: -sys.space.sm },
  radnje: { alignSelf: 'center', maxWidth: 320, width: '100%', gap: sys.space.sm },
});
