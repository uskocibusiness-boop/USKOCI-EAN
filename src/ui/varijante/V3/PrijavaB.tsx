import { Animated, StyleSheet, View } from 'react-native';
import type { PotrebaProjekcija } from '../../../contracts/projections';
import { readableTitle } from '../../../data/needDetailPresentation';
import { ProductHeader } from '../../product/ProductDetails';
import { FlowFooter } from '../../system/FlowFooter';
import { Screen } from '../../system/Screen';
import { StatusChip } from '../../system/StatusChip';
import { brandAction, sys } from '../../system/tokens';
import { T } from '../../Text';
import { V2Action } from '../../v2/V2Action';
import { Cedulja, KadarOznaka, Lice, nazadNaSpisak, useSat, useTikU, uskok } from './pomocno';
import { PRIJAVA_RECENICA, VLASNIK, razdvojIznos, type PRIJAVA } from './podaci';

/**
 * Prijava je poslata · varijanta B „Veliki iznos“ (iz broja; pravac B5 glas broja; display samo u trenutku, a ovo jeste trenutak).
 *
 * Šta vodi: IZNOS 32/700 tabular na vrhu, pod njim „ukupno · 2 osobe“; ispod red „Poslato · Marija Ilić“ sa licem osobe kojoj je prijava
 * otišla (ime iz zadatka, nikad izmišljeno; bez imena samo „Poslato“) i pilula stanja mirna uz red. Priznanica (zadatak, termin, poruka)
 * ispod, bez pečata, bez predmeta. Iznos se nikad ne animira: ceo papir stiže odozdo gotov. Jedna zelena u podnožju, tiha „Nazad na
 * zadatak“ uz nju.
 */
export const PRIJAVA_B_TRAJANJE = sys.motion.enter;

export function PrijavaB({ need, prijava, holdAt }: { need: PotrebaProjekcija; prijava: typeof PRIJAVA; holdAt?: number }) {
  const sat = useSat(PRIJAVA_B_TRAJANJE, holdAt);
  useTikU('light', 0, sat);
  const redovi = [{ label: 'Zadatak', value: readableTitle(need.naslov) }, { label: 'Termin', value: prijava.termin }, { label: 'Poruka', value: prijava.poruka }];
  return <Screen kind="flow" header={<ProductHeader title="Tvoja prijava" backLabel="Nazad na zadatak" back={nazadNaSpisak} />}
    footer={<FlowFooter>
      <V2Action label="Otvori moje prijave" style={brandAction} onPress={nazadNaSpisak} />
      <V2Action label="Nazad na zadatak" kind="quiet" onPress={nazadNaSpisak} />
    </FlowFooter>}>
    <Animated.View style={[s.papir, uskok(sat.clock, 0, 'below')]}>
      <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={`Prijava je poslata. ${prijava.iznos} ${prijava.osnova}, ${prijava.ljudi}.`} style={s.iznosBlok}>
        <T variant="display" style={s.iznos}>{razdvojIznos(prijava.iznos)[0]}</T>
        <T variant="note" tone="muted">{`${razdvojIznos(prijava.iznos)[1]} ${prijava.osnova} · ${prijava.ljudi}`.trim()}</T>
      </View>
      <View style={s.kome} accessible accessibilityLabel={`Poslato, ${VLASNIK.ime}`}>
        <Lice inicijali={VLASNIK.inicijali} size={40} />
        <View style={s.komeTekst}>
          <T variant="bodyStrong" style={s.ime}>{`Poslato · ${VLASNIK.ime}`}</T>
          <T variant="meta" tone="muted">{PRIJAVA_RECENICA}</T>
        </View>
        <StatusChip status="application.sent" />
      </View>
      <Cedulja redovi={redovi} />
    </Animated.View>
    <KadarOznaka t={holdAt} />
  </Screen>;
}

const s = StyleSheet.create({
  papir: { gap: sys.space.xl },
  iznosBlok: { gap: sys.space.xs },
  iznos: { color: sys.color.money, fontVariant: ['tabular-nums'] },
  kome: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  komeTekst: { flex: 1, minWidth: 0, gap: 2 },
  ime: { color: sys.color.ink },
});
