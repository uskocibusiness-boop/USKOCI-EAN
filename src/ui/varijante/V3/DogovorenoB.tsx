import { Animated, StyleSheet, View } from 'react-native';
import type { KandidatProjekcija, PotrebaProjekcija } from '../../../contracts/projections';
import { BrandMark } from '../../entry/BrandAssets';
import { osoba } from '../../system/plural';
import { Screen } from '../../system/Screen';
import { brandAction, sys } from '../../system/tokens';
import { T } from '../../Text';
import { V2Action } from '../../v2/V2Action';
import { Cedulja, KadarOznaka, Pozornica, nazadNaSpisak, useSat, useTikU, uskok } from './pomocno';
import { dogovorenoRedovi } from './podaci';

/**
 * „Dogovoreno!“ · varijanta B „Reč i priznanica“ (iz broja; pravac B5 + B3, K2 glas).
 *
 * Šta vodi: REČ „Dogovoreno!“ 32/700 i pod njom priznanica (cedulja) sa onim što sad važi za obe strane: s kim, kad, koliko, koliko
 * ljudi, šta osoba ima. Znak stoji ceo i miran, 56, iznad reči: ne glumi, potpisuje. Sve stiže kao jedan papir odozdo (moje ide na
 * sto, B1), 240 ms; brojevi se ne animiraju (ulaze gotovi u cedulji). Tik `success` na dolasku. Jedna zelena „Otvori Dogovor“.
 */
export const DOGOVORENO_B_TRAJANJE = sys.motion.enter;

export function DogovorenoB({ candidate, need, holdAt }: { candidate: KandidatProjekcija; need: PotrebaProjekcija; holdAt?: number }) {
  const sat = useSat(DOGOVORENO_B_TRAJANJE, holdAt);
  useTikU('success', 0, sat);
  const redovi = dogovorenoRedovi(candidate, need);
  const cedulja = [{ label: 'Dogovor', value: redovi.ljudi }, { label: 'Termin', value: redovi.termin },
    { label: 'Ukupno', value: redovi.iznos, price: redovi.iznos !== 'Cena nije navedena' }, { label: 'Ljudi', value: osoba(candidate.pokrivaMesta) },
    ...(redovi.ima ? [{ label: 'Ima', value: redovi.ima }] : [])];
  return <Screen kind="detail" scroll={false}>
    <Pozornica>
      <Animated.View style={[s.papir, uskok(sat.clock, 0, 'below')]}>
        <View style={s.znak} accessible accessibilityRole="image" accessibilityLabel="Znak USKOČI"><BrandMark size={56} /></View>
        <T variant="display" accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.naslov}>Dogovoreno!</T>
        <Cedulja redovi={cedulja} />
        <V2Action label="Otvori Dogovor" style={brandAction} onPress={nazadNaSpisak} />
      </Animated.View>
    </Pozornica>
    <KadarOznaka t={holdAt} />
  </Screen>;
}

const s = StyleSheet.create({
  papir: { alignSelf: 'stretch', alignItems: 'center', gap: sys.space.xl, maxWidth: 360, width: '100%' },
  znak: { alignItems: 'center' },
  naslov: { color: sys.color.ink, textAlign: 'center' },
});
