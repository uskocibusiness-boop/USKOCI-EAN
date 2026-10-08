import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { ListRow } from '../ui/system/ListRow';
import { Screen } from '../ui/system/Screen';
import { Section } from '../ui/system/Section';
import { sys } from '../ui/system/tokens';
import { T } from '../ui/Text';
import { EKRANI, SCENE, scenaPoId } from '../ui/varijante/V3/scena';

/**
 * Varijante grupe V3 u laboratoriji (kreativni pravac „Preko stola“, 8. okt 2026): Kandidati + „Dogovoreno!“, AI razgovor + nacrt +
 * „Objavljeno“, Prijava poslata. Tri strukturno različite polazne tačke po ekranu (A iz predmeta/osobe, B iz reči i broja, C iz
 * pokreta) i „sada“ (današnji proizvodni ekran sa istim lažnim podacima). Dostupno samo u internom izdanju (`__DEV__` ili paket
 * `.dev`); izdanje za prodavnicu ne pokazuje ništa. `?scene=<ekran>-<A|B|C|sada>[-stanje]` crta scenu preko celog ekrana;
 * `&t=<ms>` zaustavlja trenutak u kadru. Bez parametra: spisak scena. Ništa se ne čita i ne šalje.
 */
export default function DizajnVarV3() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string | string[]; t?: string | string[] }>();
  const scena = scenaPoId(typeof params.scene === 'string' ? params.scene : undefined);
  const t = typeof params.t === 'string' && /^\d+$/.test(params.t) ? Number(params.t) : undefined;
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  if (scena) return <View key={`${scena.id}:${t ?? ''}`} style={s.screen}>{scena.draw(t)}</View>;
  return <Screen kind="detail" header={<DetailTopBar title="Varijante V3" backLabel="Zatvori" onBack={() => router.back()} />}>
    <T variant="note" tone="muted">Objava i izbor: tri polazne tačke po ekranu i „sada“. Izmišljeni podaci, ništa se ne čita i ne šalje.</T>
    {EKRANI.map(ekran => <Section key={ekran} title={ekran}>
      {SCENE.filter(scene => scene.ekran === ekran).map((scene, index, all) => <ListRow key={scene.id} title={scene.naziv}
        subtitle={scene.kadrovi ? `Kadrovi: ${scene.kadrovi.join(', ')} ms` : undefined} last={index === all.length - 1}
        accessibilityLabel={`${ekran}: ${scene.naziv}`} onPress={() => router.setParams({ scene: scene.id, t: '' })} />)}
    </Section>)}
  </Screen>;
}

const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: sys.color.surface } });
