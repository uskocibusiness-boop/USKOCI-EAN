import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { T } from '../ui/Text';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { ListRow } from '../ui/system/ListRow';
import { Screen } from '../ui/system/Screen';
import { Section } from '../ui/system/Section';
import { sys } from '../ui/system/tokens';
import { LabClock } from '../ui/varijante/V4/lab';
import { EKRANI, sceneByKey } from '../ui/varijante/V4/scenes';

/**
 * The V4 variants of the design lab (Dogovori list and detail with "Potvrđeno", the rating with "Ocena je sačuvana", my profile and the
 * public profile; pravac "Preko stola", 8 Oct 2026): three structural starting points per screen beside today's screen, all on fake
 * data. Reached only by its address in the internal build (`/dizajn-var-V4?scene=<ekran>-<A|B|C|sada>`); the store package shows
 * nothing. Without a scene it lists them as links. A scene fills the whole screen, with no gallery frame above it; a frame key
 * (`…-k2`) freezes the scene's motion at the moment the lab photographs (`LabClock`). Nothing here reads or writes anything.
 */
export default function DizajnVarV4() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string | string[] }>();
  const requested = typeof params.scene === 'string' ? params.scene : undefined;
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  const scene = sceneByKey(requested);
  if (scene) return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <LabClock.Provider value={scene.t ?? null}>
      <View key={scene.key} style={s.fill}>{scene.draw()}</View>
    </LabClock.Provider>
  </SafeAreaView>;
  return <Screen kind="detail" header={<DetailTopBar title="Varijante V4" onBack={() => router.back()} />}>
    {EKRANI.map(ekran => <Section key={ekran.id} title={ekran.naziv}>
      {ekran.scenes.map((item, index) => <ListRow key={item.key} title={item.naziv} meta={item.key} last={index === ekran.scenes.length - 1}
        accessibilityLabel={`${ekran.naziv}: ${item.naziv}`} onPress={() => router.setParams({ scene: item.key })} />)}
    </Section>)}
  </Screen>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  fill: { flex: 1 },
});
