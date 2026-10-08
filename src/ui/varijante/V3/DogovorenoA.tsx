import { Animated, StyleSheet, View } from 'react-native';
import Svg, { G } from 'react-native-svg';
import type { KandidatProjekcija, PotrebaProjekcija } from '../../../contracts/projections';
import { BrandRasterDefs, BrandRasterMark, useBrandRasterId } from '../../entry/BrandRaster';
import { BRAND_PARTS } from '../../entry/spojBrandMath';
import { FactRow } from '../../system/FactRow';
import { Screen } from '../../system/Screen';
import { brandAction, sys } from '../../system/tokens';
import { T } from '../../Text';
import { V2Action } from '../../v2/V2Action';
import { KadarOznaka, OTKRIVANJE_MS, Pozornica, STISAK_DP, kadar, nazadNaSpisak, useSat, useTikU, uskok } from './pomocno';
import { dogovorenoRedovi } from './podaci';

/**
 * „Dogovoreno!“ · varijanta A „Stisak“ (pravac B2 + B4 + B1; vrh C.3). Nova lokalna komponenta trenutka: `SuccessMark` se ne dira,
 * `src/ui/entry/**` se samo uvozi (isti atlas znaka, isti delovi; ulaz V4.9 ostaje netaknut).
 *
 * Zelena figura (glava 2 + ruka 5) dolazi s LEVE, narandžasta (glava 3 + ruka 6) s DESNE strane, 20 dp svaka, 240 ms na `easeOut`,
 * i ruke se dodirnu. U tom kadru se za 120 ms otkriju prsti (4), pin (1) i osmeh (0) i znak postane ceo; `tick('success')` tačno na
 * dodiru. Pa „Dogovoreno!“ (display, jedini uzvičnik), tri reda (Ti i Milan · termin · iznos) jedan za drugim, pa jedno zeleno
 * „Otvori Dogovor“ na sredini, nikad na mestu prethodnog dugmeta. Pomera se samo `translate` i `opacity`; skala znaka ostaje 1.
 *
 * Tri `Svg` sa po jednim klipom istog atlasa (levo, desno, otkriveno), jedan preko drugog, u tri `Animated.View`: dva omotača za
 * strane i jedan za otkrivanje, kako pravac traži. Nema petlje, nema preskoka (D3: preporuka bez odskoka). Smanjen pokret: ceo
 * znak odmah, tik ostaje. `holdAt` zaustavlja sat u kadru za laboratoriju.
 */
const ZNAK = 160;
const ZNAK_VISINA = Math.round(ZNAK * 291 / 280);
const DODIR = sys.motion.enter;
const REC = DODIR + OTKRIVANJE_MS;
const REDOVI = REC + sys.motion.enter / 2;
const RADNJA = REDOVI + 3 * sys.motion.stagger + sys.motion.enter / 2;
export const DOGOVORENO_A_TRAJANJE = RADNJA + sys.motion.enter;

/** Delovi atlasa po strani (indeksi iz `BRAND_PARTS`): leva figura, desna figura, ono što se otkrije na dodiru. */
const LEVO = [2, 5] as const, DESNO = [3, 6] as const, OTKRIVENO = [4, 1, 0] as const;

export function DogovorenoA({ candidate, need, holdAt }: { candidate: KandidatProjekcija; need: PotrebaProjekcija; holdAt?: number }) {
  const sat = useSat(DOGOVORENO_A_TRAJANJE, holdAt);
  useTikU('success', DODIR, sat);
  const redovi = dogovorenoRedovi(candidate, need);
  const strana = (smer: -1 | 1) => ({ opacity: kadar(sat.clock, 0, OTKRIVANJE_MS, [0, 1]),
    transform: [{ translateX: kadar(sat.clock, 0, DODIR, [smer * STISAK_DP, 0]) }] });
  const otkriveno = { opacity: kadar(sat.clock, DODIR, DODIR + OTKRIVANJE_MS, [0, 1]) };
  return <Screen kind="detail" scroll={false}>
    <Pozornica>
      <View style={s.znak} accessible accessibilityRole="image" accessibilityLabel="Znak USKOČI: dve figure se rukuju">
        <Animated.View style={[s.sloj, strana(-1)]}><Delovi delovi={LEVO} /></Animated.View>
        <Animated.View style={[s.sloj, strana(1)]}><Delovi delovi={DESNO} /></Animated.View>
        <Animated.View style={[s.sloj, otkriveno]}><Delovi delovi={OTKRIVENO} /></Animated.View>
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

/** Jedan sloj znaka: svoje definicije atlasa i samo navedeni delovi, na mestu koje imaju u celom znaku. */
function Delovi({ delovi }: { delovi: readonly number[] }) {
  const id = useBrandRasterId();
  return <Svg width={ZNAK} height={ZNAK_VISINA} viewBox="0 0 280 291" accessible={false}>
    <BrandRasterDefs id={id} />
    {delovi.map(index => <G key={index} transform={`translate(${BRAND_PARTS[index][0]} ${BRAND_PARTS[index][1]})`}>
      <BrandRasterMark id={id} part={index} />
    </G>)}
  </Svg>;
}

const s = StyleSheet.create({
  znak: { width: ZNAK, height: ZNAK_VISINA },
  sloj: { position: 'absolute', left: 0, top: 0 },
  reci: { alignItems: 'center' },
  naslov: { color: sys.color.ink, textAlign: 'center' },
  redovi: { alignSelf: 'stretch', gap: sys.space.md, maxWidth: 320, width: '100%' },
  radnja: { alignSelf: 'center', maxWidth: 320, width: '100%' },
});
