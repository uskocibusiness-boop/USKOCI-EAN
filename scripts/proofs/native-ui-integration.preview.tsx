/** Local visual harness for production presentation components, never an app route.
 * Fixed demonstration data, no authentication, services, server reads or writes.
 * Web rendering helps catch layout defects; it is not Android/keyboard/performance evidence.
 */
import React, { useState } from 'react';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccountSettings } from '../../src/ui/settings/AccountSettingsPresentation';
import { ProfileHub, PROFILE_AVATAR } from '../../src/ui/profile/ProfileHubPresentation';
import { FigureCell, ratingFigure, finishedFigure } from '../../src/ui/profile/ProfileFigures';
import { ProductSheet } from '../../src/ui/product/ProductSheet';
import { FactArt, type FactArtKind } from '../../src/ui/system/FactArt';
import { Avatar } from '../../src/ui/system/Avatar';
import { V2Action } from '../../src/ui/v2/V2Action';
import { T } from '../../src/ui/Text';
import { useReducedMotionRoot } from '../../src/ui/system/motion';
import { field } from '../../src/ui/system/tokens';
import { HomeLaunchArt } from '../../src/ui/home/HomeLaunchArt';
import { SearchSheet } from '../../src/ui/v2/discovery/SearchSheet';
import { NeedPresentation } from '../../src/ui/v2/NeedPresentation';
import { OwnTaskCard } from '../../src/ui/v2/OwnTaskCard';
import type { PotrebaProjekcija } from '../../src/contracts/projections';

type Scene = 'Podešavanja' | 'Profil' | 'Profil — dugo ime' | 'Profil — učitavanje' | 'Profil — greška' | 'Profil — prazan'
  | 'Prijava — dijalog' | 'Dugi dijalog' | 'Filteri — dijalog' | 'Ikonice' | 'Moj nacrt' | 'Moji zadaci';
const scenes: Scene[] = ['Podešavanja', 'Profil', 'Profil — dugo ime', 'Profil — učitavanje', 'Profil — greška', 'Profil — prazan',
  'Prijava — dijalog', 'Dugi dijalog', 'Filteri — dijalog', 'Ikonice', 'Moj nacrt', 'Moji zadaci'];
const sampleTask: PotrebaProjekcija = {
  id: 'preview-only', revizija: 1, naslov: 'Pomoć pri selidbi', opis: 'Prenos kutija i manjeg nameštaja sa drugog sprata. Kombi je obezbeđen.',
  stanje: 'NACRT', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 },
  vremeTekst: '24. oktobar · 10–13 h', podrucjeTekst: 'Novi Sad', uslovi: [], brojPrijava: 0,
  rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' },
};
const art: FactArtKind[] = ['home', 'pin', 'calendar', 'clock', 'users', 'money', 'map', 'tasks', 'agreements', 'offers', 'applications', 'chat', 'bell', 'document', 'support', 'vehicle', 'tool', 'remote', 'publish'];
function Preview() {
  const [scene, choose] = useState<Scene | null>(null);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const close = () => choose(null);
  useReducedMotionRoot(true);
  const [loaded] = useFonts({
    'Inter-Regular': require('../../assets/fonts/inter/Inter-Regular.ttf'),
    'Inter-Medium': require('../../assets/fonts/inter/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../../assets/fonts/inter/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../../assets/fonts/inter/Inter-Bold.ttf'),
    'Inter-ExtraBold': require('../../assets/fonts/inter/Inter-ExtraBold.ttf'),
  });
  if (!loaded) return <Text>Učitavanje fonta…</Text>;
  const open = (path: string) => setNotice(`Probna navigacija: ${path}`);
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ padding: 6, backgroundColor: '#fff2dc' }}>
        <Pressable onPress={close} accessibilityLabel="Meni vizuelne probe"><Text style={{ fontSize: 11 }}>VIZUELNA PROBA · bez servera · meni</Text></Pressable>
        {notice ? <Text style={{ fontSize: 11 }}>{notice}</Text> : null}
      </View>
      {scene === 'Podešavanja' ? <AccountSettings email="primer@example.test" busy={false} logoutError={false} version="Demo prikaz"
        words={{}} open={open} onBack={close} onLogout={() => setNotice('Demo: nije izvršena odjava.')} />
        : scene?.startsWith('Profil') ? <ProfileHub identity={scene === 'Profil — učitavanje' ? { state: 'loading' }
          : scene === 'Profil — greška' ? { state: 'error', retry: () => choose('Profil') }
          : { state: 'ready', name: scene === 'Profil — prazan' ? null : scene === 'Profil — dugo ime' ? 'Aleksandra Stefanović-Radosavljević' : 'Miloš Petrović',
            place: scene === 'Profil — prazan' ? null : 'Novi Sad',
            photo: <Avatar initials={scene === 'Profil — prazan' ? null : scene === 'Profil — dugo ime' ? 'AS' : 'MP'} size={PROFILE_AVATAR} />,
            photoReady: scene !== 'Profil — prazan', openPhoto: () => open('/profil/fotografija'),
            reputation: scene === 'Profil' || scene === 'Profil — dugo ime' ? <FigureCell figure={ratingFigure(4.8, 12)} onPress={() => open('/profil/ocene')} /> : null }}
          workSummary={scene === 'Profil' || scene === 'Profil — dugo ime' ? <FigureCell figure={finishedFigure(18)} onPress={() => open('/dogovori')} /> : undefined}
          capabilityDetail={scene === 'Profil — prazan' ? 'Još nije podešen' : scene === 'Profil' || scene === 'Profil — dugo ime' ? 'Pomoć pri selidbi · Novi Sad' : undefined}
          capabilityNeedsAttention={scene === 'Profil — prazan'} busy={false} open={open} onBack={close}
          onViewPublic={scene === 'Profil' || scene === 'Profil — dugo ime' ? () => open('/javni-profil') : undefined} />
          : scene === 'Moj nacrt' ? <NeedPresentation need={sampleTask} loading={false} error={null} busy={false} remainingClosed={false}
            readiness={{ kind: 'READY' }} onBack={close} onRefresh={() => {}} onReview={() => open('/pregled-zadatka')}
            onEdit={() => open('/nova')} onCloseRemaining={() => {}} onCandidates={() => {}}
            onDeleteDraft={() => setNotice('Demo: ovde se otvara potvrda, ništa nije obrisano.')} />
          : scene === 'Moji zadaci' ? <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <V2Action label="Nazad" kind="quiet" compact onPress={close} /><T variant="pageTitle">Moji zadaci</T>
            {[0, 1, 2].map(chosen => <OwnTaskCard key={chosen} item={{ ...sampleTask,
              stanje: chosen === 2 ? 'POPUNJENA' : 'CEKA_PRIJAVE', brojPrijava: 8, brojPrijavaZaIzbor: chosen === 2 ? 0 : 8,
              pokrivenost: { ukupno: 2, popunjeno: chosen, preostalo: 2 - chosen, udeo: chosen / 2 } }}
              onOpen={() => open('/potrebe/primer/pregled')} onApplications={() => open('/potrebe/primer/prijave')} />)}
          </ScrollView>
          : scene === 'Ikonice' ? <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <T variant="pageTitle">Nova ikonografija</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
              {art.map(kind => <View key={kind} style={{ width: 80, alignItems: 'center', gap: 8 }}>
                <FactArt kind={kind} size={64} /><FactArt kind={kind} size={32} /><T variant="meta">{kind}</T>
              </View>)}
              <HomeLaunchArt kind="discover" size={64} />
            </View>
          </ScrollView>
          : <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <T variant="pageTitle">Provera rasporeda</T>
            {scenes.map(item => <V2Action key={item} label={item} kind="secondary" onPress={() => { setNote(''); setNotice(''); choose(item); }} />)}
          </ScrollView>}
      {scene === 'Prijava — dijalog' || scene === 'Dugi dijalog' ? <ProductSheet title="Pregled prijave" onClose={close} dirty={!!note}
        footer={() => <><V2Action label="Pošalji prijavu" onPress={() => setNotice('Demo: ništa nije poslato.')} />
          <V2Action kind="quiet" label="Nazad na unos" onPress={close} /></>}>
        {() => <>
          <T variant="title">Unos ormara na treći sprat</T>
          <T>2 osobe · 26. oktobar · Novi Sad</T>
          <T variant="priceHero">12.500 RSD</T>
          <TextInput style={field} placeholder="Kratka poruka" value={note} onChangeText={setNote} multiline />
          {scene === 'Dugi dijalog' ? Array.from({ length: 12 }, (_, i) => <T key={i}>Dugačak uslov {i + 1}: sadržaj skroluje, potvrda i zatvaranje ostaju dostupni.</T>) : null}
        </>}
      </ProductSheet> : null}
      {scene === 'Filteri — dijalog' ? <SearchSheet reduced backdrop="dim" closing={false} title="Filteri" closeLabel="Zatvori filtere"
        closeHint="Zatvara probu." onCloseButton={close} onRequestClose={close} onClosed={close}
        footer={<View style={{ padding: 16 }}><V2Action label="Prikaži 12 zadataka" onPress={close} /></View>}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          <T variant="heading">Način rada</T><V2Action label="Na lokaciji" kind="secondary" onPress={() => {}} />
          <V2Action label="Na daljinu" kind="quiet" onPress={() => {}} />
          <T variant="heading">Kada ti odgovara?</T><T>Danas · Sutra · Vikend · Izaberi datume</T>
          <T variant="heading">Cena</T><T>Određen budžet · Ponude izvršilaca</T>
        </ScrollView>
      </SearchSheet> : null}
    </View>
  </SafeAreaProvider></GestureHandlerRootView>;
}
registerRootComponent(Preview);
