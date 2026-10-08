import { Animated, StyleSheet, View } from 'react-native';
import type { PotrebaProjekcija } from '../../../contracts/projections';
import { readableTitle } from '../../../data/needDetailPresentation';
import { ProductHeader } from '../../product/ProductDetails';
import { FactArt } from '../../system/FactArt';
import { Screen } from '../../system/Screen';
import { StatusChip } from '../../system/StatusChip';
import { brandAction, sys } from '../../system/tokens';
import { T } from '../../Text';
import { V2Action } from '../../v2/V2Action';
import { Cedulja, KadarOznaka, Pozornica, USKOK_DP, kadar, nazadNaSpisak, useSat, useTikU, uskok } from './pomocno';
import { PRIJAVA_RECENICA, type PRIJAVA } from './podaci';

/**
 * Prijava je poslata · varijanta C „Etiketa odlazi“ (iz pokreta; pravac B1 smer „moje ide ka njima“ + B5 prazna etiketa).
 *
 * Šta vodi: TVOJA ETIKETA (predmet `offers`, 96) stoji trenutak na sredini, pa USKOČI nagore ka drugoj strani stola (8 dp, providnost
 * 1 → 0, 160 ms: izlaz je kraći od ulaza) i na njenom mestu ostane mali red „Poslata · 4.500 RSD ukupno“ sa etiketom 28 — tvoja ponuda je
 * otišla preko stola i sad je red u tvojoj listi. Tik `light` kad ode. Ispod: „Prijava je poslata.“, priznanica, jedna zelena. Samo
 * RN `Animated` na native driveru, bez Reanimated `exiting`; smanjen pokret = krajnje stanje (mali red), tik ostaje.
 */
/** Koliko etiketa stoji pre nego što ode: pola puta dolaska predmeta. Tokena za „zadržavanje“ nema: ime ovde. */
const ZADRZI = sys.motion.arrive.duration / 2;
const ODE = ZADRZI + sys.motion.exit;
export const PRIJAVA_C_TRAJANJE = ODE + sys.motion.enter;

export function PrijavaC({ need, prijava, holdAt }: { need: PotrebaProjekcija; prijava: typeof PRIJAVA; holdAt?: number }) {
  const sat = useSat(PRIJAVA_C_TRAJANJE, holdAt);
  useTikU('light', ODE, sat);
  const etiketa = { opacity: kadar(sat.clock, ZADRZI, ODE, [1, 0]), transform: [{ translateY: kadar(sat.clock, ZADRZI, ODE, [0, -USKOK_DP]) }] };
  const redovi = [{ label: 'Zadatak', value: readableTitle(need.naslov) }, { label: 'Ljudi', value: prijava.ljudi }, { label: 'Termin', value: prijava.termin }, { label: 'Poruka', value: prijava.poruka }];
  return <Screen kind="flow" scroll header={<ProductHeader title="Tvoja prijava" backLabel="Nazad na zadatak" back={nazadNaSpisak} />}>
    <Pozornica style={s.pozornica}>
      <View style={s.sto}>
        <Animated.View style={[s.velika, etiketa]}><FactArt kind="offers" size={96} /></Animated.View>
        <Animated.View style={[s.red, uskok(sat.clock, ODE - sys.motion.press, 'below')]} accessible accessibilityLabel={`Poslata, ${prijava.iznos} ${prijava.osnova}`}>
          <FactArt kind="offers" size={28} />
          <StatusChip status="application.sent" />
          <T variant="priceRow" style={s.novac}>{prijava.iznos}</T>
          <T variant="note" tone="muted">{prijava.osnova}</T>
        </Animated.View>
      </View>
      <View style={s.reci}>
        <T accessibilityRole="alert" accessibilityLiveRegion="polite" variant="title" style={s.naslov}>Prijava je poslata.</T>
        <T variant="copy" tone="muted" style={s.naslov}>{PRIJAVA_RECENICA}</T>
      </View>
      <Cedulja redovi={redovi} style={s.cedulja} />
      <View style={s.radnje}>
        <V2Action label="Otvori moje prijave" style={brandAction} onPress={nazadNaSpisak} />
        <V2Action label="Nazad na zadatak" kind="quiet" onPress={nazadNaSpisak} />
      </View>
    </Pozornica>
    <KadarOznaka t={holdAt} />
  </Screen>;
}

const s = StyleSheet.create({
  pozornica: { paddingHorizontal: 0, justifyContent: 'flex-start', gap: sys.space.xl },
  // Mesto etikete ostaje rezervisano (samo transform/opacity): velika etiketa gore, mali red na dnu istog polja.
  sto: { height: 96 + sys.space.xl, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'flex-start' },
  velika: { position: 'absolute', top: 0 },
  red: { position: 'absolute', bottom: 0, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  novac: { color: sys.color.money },
  reci: { alignItems: 'center', gap: sys.space.sm, maxWidth: 320 },
  naslov: { color: sys.color.ink, textAlign: 'center' },
  cedulja: { maxWidth: 360, width: '100%' },
  radnje: { alignSelf: 'center', maxWidth: 320, width: '100%', gap: sys.space.sm },
});
