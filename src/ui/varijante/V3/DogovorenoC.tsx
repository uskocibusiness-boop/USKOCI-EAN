import { Animated, StyleSheet, View } from 'react-native';
import type { KandidatProjekcija, PotrebaProjekcija } from '../../../contracts/projections';
import { FactRow } from '../../system/FactRow';
import { Screen } from '../../system/Screen';
import { brandAction, sys } from '../../system/tokens';
import { T } from '../../Text';
import { V2Action } from '../../v2/V2Action';
import { KadarOznaka, Lice, Pozornica, STISAK_DP, kadar, nazadNaSpisak, useSat, useTikU, uskok } from './pomocno';
import { VLASNIK, dogovorenoRedovi } from './podaci';

/**
 * „Dogovoreno!“ · varijanta C „Susret“ (iz pokreta i osobe; pravac B4 Par + B1; rezerva B2 bez znaka).
 *
 * Šta vodi: DVA LICA, ti i osoba koju si izabrao, idu jedno ka drugom 20 dp i stanu preklopljena 12 (pravac B4 `PairFaces`),
 * 240 ms, bez preskoka; tik `success` tačno kad se dodirnu. Nema znaka ni kvačice: susret dvoje ljudi JE potvrda. Pa
 * „Dogovoreno!“, tri reda, „Otvori Dogovor“ na sredini. Dva lica su dve senke, jedine na ekranu.
 *
 * Smanjen pokret: par stoji preklopljen od prvog kadra, tik ostaje. `holdAt` je kadar za laboratoriju.
 */
const LICE = 72;
/** Preklop para, 12 dp (B4). */
const PREKLOP = sys.space.md;
const DODIR = sys.motion.enter;
const REC = DODIR + sys.motion.press;
const REDOVI = REC + sys.motion.enter / 2;
const RADNJA = REDOVI + 3 * sys.motion.stagger + sys.motion.enter / 2;
export const DOGOVORENO_C_TRAJANJE = RADNJA + sys.motion.enter;

export function DogovorenoC({ candidate, need, holdAt }: { candidate: KandidatProjekcija; need: PotrebaProjekcija; holdAt?: number }) {
  const sat = useSat(DOGOVORENO_C_TRAJANJE, holdAt);
  useTikU('success', DODIR, sat);
  const redovi = dogovorenoRedovi(candidate, need);
  // Krajnje mesto: centri lica razmaknuti za (LICE − PREKLOP); polazno: još STISAK_DP dalje sa svake strane.
  const pola = (LICE - PREKLOP) / 2;
  const lice = (smer: -1 | 1) => ({ transform: [{ translateX: kadar(sat.clock, 0, DODIR, [smer * (pola + STISAK_DP), smer * pola]) }] });
  return <Screen kind="detail" scroll={false}>
    <Pozornica>
      <View style={s.par} accessible accessibilityLabel={`${VLASNIK.ime} i ${candidate.ime}`}>
        <Animated.View style={[s.lice, lice(-1)]}><Lice inicijali={VLASNIK.inicijali} size={72} istaknuto /></Animated.View>
        <Animated.View style={[s.lice, lice(1)]}><Lice inicijali={candidate.inicijali} size={72} istaknuto /></Animated.View>
      </View>
      <Animated.View style={[s.reci, uskok(sat.clock, REC, 'below')]}>
        <T variant="display" accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.naslov}>Dogovoreno!</T>
      </Animated.View>
      <View style={s.redovi}>
        {[{ art: 'users' as const, value: redovi.ljudi }, { art: 'calendar' as const, value: redovi.termin }, { art: 'offers' as const, value: redovi.iznos }]
          .map((red, index) => <Animated.View key={red.art} style={uskok(sat.clock, REDOVI + index * sys.motion.stagger, 'below')}>
            <FactRow art={red.art} value={red.value} size="detail" />
          </Animated.View>)}
      </View>
      <Animated.View style={[s.radnja, uskok(sat.clock, RADNJA, 'below')]}>
        <V2Action label="Otvori Dogovor" style={brandAction} onPress={nazadNaSpisak} />
      </Animated.View>
    </Pozornica>
    <KadarOznaka t={holdAt} />
  </Screen>;
}

const s = StyleSheet.create({
  par: { height: LICE + sys.space.xs, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  lice: { position: 'absolute' },
  reci: { alignItems: 'center' },
  naslov: { color: sys.color.ink, textAlign: 'center' },
  redovi: { alignSelf: 'stretch', gap: sys.space.md, maxWidth: 320, width: '100%' },
  radnja: { alignSelf: 'center', maxWidth: 320, width: '100%' },
});
