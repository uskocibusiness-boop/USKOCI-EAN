/** Offline native visual probe. Explicit alternate export entry, never imported by app routes.
 * Fixtures exercise production presentation components. No services, sessions or write commands.
 * export:embed --entry-file scripts/proofs/native-ui-package-1.preview.tsx ... (local emulator only)
 */
import React, { useEffect, useState } from 'react';
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { PotrebaProjekcija, PrilikaProjekcija } from '../../src/contracts/projections';
import { ApplicationComposerPresentation, type ApplicationDraft } from '../../src/ui/v2/ApplicationComposerPresentation';
import { PublicNeedPresentation } from '../../src/ui/v2/PublicNeedPresentation';
import { useReducedMotionRoot } from '../../src/ui/system/motion';

const noop = () => {};
const need: PotrebaProjekcija = {
  id: 'offline-visual-probe', revizija: 3, naslov: 'Unos ormara na treći sprat',
  opis: 'Ormar je rasklopljen u kutijama. Treba ga uneti na treći sprat zgrade bez lifta.',
  stanje: 'CEKA_PRIJAVE', brojPrijava: 8,
  podrucjeTekst: 'Liman, Novi Sad', taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
  vremeTekst: '26. okt · 09:00–11:00', uslovi: [],
  schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-10-26T08:00:00Z', endsAt: '2026-10-26T10:00:00Z' },
  pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 }, rezimCene: 'OFFERS',
};
const opportunity: PrilikaProjekcija = { ...need, statusTekst: 'Otvoren', primaNovePrijave: true, rokZaPrijaveIso: null,
  narucilacProfilId: 'offline-owner', narucilacAvatarId: null, narucilacIme: 'Primer objavljivača',
  narucilacOcena: null, narucilacBrojOcena: 0, priblizno: null };
type Scene = 'Detalj' | 'Forma' | 'Pregled' | 'Nepoznat ishod' | 'Učitavanje' | 'Greška';
const scenes: Scene[] = ['Detalj', 'Forma', 'Pregled', 'Nepoznat ishod', 'Učitavanje', 'Greška'];
const initial: ApplicationDraft = { price: '125000', people: '2', note: 'Dolazimo nas dvojica. Donosimo trake i zaštitu za nameštaj.', start: null, end: null };

function Probe({ scene, home }: { scene: Scene; home: () => void }) {
  const [draft, change] = useState(initial);
  if (scene === 'Detalj' || scene === 'Učitavanje' || scene === 'Greška') {
    return <PublicNeedPresentation need={scene === 'Detalj' ? { ...opportunity, rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL',
      ponudjenaCena: { iznos: 125000, valuta: 'RSD', prikaz: '125.000 RSD' } } : null}
      loading={scene === 'Učitavanje'} error={scene === 'Greška'} missing={false} stale={false} busy={false}
      canApply canRetry relation={{ kind: 'NONE' }} back={home} retry={noop} apply={noop}
      onOwnTask={noop} onOwnApplication={noop} />;
  }
  return <ApplicationComposerPresentation need={need} opportunity={opportunity} draft={draft} change={change}
    submit={noop} back={home} busy={false} pending={scene === 'Nepoznat ishod'} uncertain={scene === 'Nepoznat ishod'}
    refresh={noop} error={scene === 'Nepoznat ishod' ? 'Ishod slanja nije poznat. Proveri pre novog pokušaja.' : null}
    confirmed={false} openApplications={noop} canSubmit={!!draft.price && Number(draft.people) > 0}
    initialSheet={scene === 'Pregled' ? 'review' : undefined} />;
}

function App() {
  const [scene, setScene] = useState<Scene | null>(null);
  useReducedMotionRoot(false);
  useEffect(() => { void SplashScreen.hideAsync(); }, []);
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {!scene ? <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff2dc' }}>
        <Pressable accessibilityRole="button" onPress={() => setScene(null)} style={{ minHeight: 32, justifyContent: 'center', paddingHorizontal: 12 }}>
          <Text style={{ color: '#633500', fontSize: 12 }}>VIZUELNA PROBA · bez servera i slanja · meni</Text>
        </Pressable>
      </SafeAreaView> : null}
      {scene ? <Probe key={scene} scene={scene} home={() => setScene(null)} /> :
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: '700' }}>Native UI — paket 1</Text>
          <Text>Probni podaci. Radnje slanja i osvežavanja su isključene.</Text>
          {scenes.map(item => <Pressable key={item} accessibilityRole="button" accessibilityLabel={item}
            onPress={() => setScene(item)} style={{ padding: 18, backgroundColor: '#e8f4ed', borderRadius: 16 }}>
            <Text style={{ fontSize: 18, color: '#005d46' }}>{item}</Text>
          </Pressable>)}
        </ScrollView>}
      {scene ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', backgroundColor: '#fff2dc' }}>
        <Text style={{ fontSize: 10, color: '#633500' }}>VIZUELNA PROBA · bez servera i slanja</Text>
      </View> : null}
    </View>
  </SafeAreaProvider></GestureHandlerRootView>;
}
registerRootComponent(App);
