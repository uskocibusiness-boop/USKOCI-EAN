import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import type { MojaPrijavaProjekcija } from '../contracts/projections';
import { novac } from '../lib/novac';
import { useConfirmSheet } from '../ui/system/ConfirmSheet';
import { Segmented } from '../ui/system/Segmented';
import { LARGE_LAYOUT, LayoutClassOverride } from '../ui/system/textScale';
import { sys } from '../ui/system/tokens';
import { T } from '../ui/Text';
import { MyApplicationsPresentation, type ApplicationsTab, type OfferEdit } from '../ui/v2/MyApplicationsPresentation';

/**
 * Moje prijave in its main states, for the lead to photograph on the emulator (owner's step 5c, 2026-09-24). Reached only
 * by its address (uskociapp://dizajn-prijave) in the internal build; the store package shows nothing. It draws the real
 * presentation (`MyApplicationsPresentation`) and the real card (`ApplicationCard`) with fixture rows: nothing here reads
 * or writes data, no command is sent, and no press navigates anywhere but back. The scene is chosen in the strip at the
 * bottom, so the top of every scene is exactly the screen.
 */
type Scene = 'lista' | 'dugi' | 'pregled' | 'izmena' | 'ceka' | 'ucitava' | 'greska' | 'prazno' | 'prazanSkup' | 'veliki';
const SCENES: { key: Scene; label: string }[] = [{ key: 'lista', label: 'Lista' }, { key: 'dugi', label: 'Dugi nazivi' },
  { key: 'pregled', label: 'Pregled izmena' }, { key: 'izmena', label: 'Izmena ponude' }, { key: 'ceka', label: 'Na čekanju' },
  { key: 'ucitava', label: 'Učitava' }, { key: 'greska', label: 'Greška' }, { key: 'prazno', label: 'Prazno' },
  { key: 'prazanSkup', label: 'Prazan prikaz' }, { key: 'veliki', label: 'Veliki tekst' }];

const offer = (id: string, patch: Partial<MojaPrijavaProjekcija>): MojaPrijavaProjekcija => ({ prijavaId: id, potrebaId: `n-${id}`,
  potrebaRevizija: 3, prijavaRevizija: 3, prijavaVerzija: 1, stanje: 'SUBMITTED', naslov: 'Prenos ormara do kombija',
  opis: 'Orman je rasklopljen. Treba ga spustiti sa trećeg sprata bez lifta i utovariti u kombi ispred zgrade.',
  cena: { iznos: 4500, valuta: 'RSD', prikaz: novac(4500) }, pokrivaMesta: 2, napomena: '', podrucjeTekst: 'Liman, Novi Sad',
  vremeTekst: '24. sep · 17:00–19:00', dogovorId: null, promenjenaPotreba: false, mozePovuci: true, traziPaznju: false, ...patch });
const price = (value: number) => ({ iznos: value, valuta: 'RSD', prikaz: novac(value) });
/** Every state the read hands over, as the server sets its flags: withdrawal only while open, a Dogovor once chosen. */
const LIST: MojaPrijavaProjekcija[] = [
  offer('stale', { stanje: 'STALE_REVIEW_REQUIRED', naslov: 'Montaža police u hodniku', cena: price(2000), pokrivaMesta: 1, prijavaRevizija: 2,
    promenjenaPotreba: true, mozePovuci: false, traziPaznju: true, podrucjeTekst: 'Grbavica, Novi Sad', vremeTekst: '26. sep · 10:00' }),
  offer('chosen', { stanje: 'SELECTED', dogovorId: 'g-chosen', mozePovuci: false, traziPaznju: true, napomena: 'Donosim trake i kolica.' }),
  offer('sent', { naslov: 'Košenje trave u dvorištu', cena: price(3000), pokrivaMesta: 1, podrucjeTekst: 'Telep, Novi Sad', vremeTekst: 'Fleksibilno' }),
  offer('viewed', { stanje: 'VIEWED', naslov: 'Čišćenje stana posle krečenja', cena: price(6000), podrucjeTekst: 'Detelinara, Novi Sad',
    vremeTekst: '27. sep · 09:00–13:00', napomena: 'Imam svoja sredstva za čišćenje.' }),
  offer('short', { stanje: 'SHORTLISTED', naslov: 'Pomoć pri selidbi', cena: price(12000), pokrivaMesta: 3, podrucjeTekst: 'Novo naselje, Novi Sad' }),
  offer('withdrawn', { stanje: 'WITHDRAWN', naslov: 'Farbanje ograde', cena: price(5000), mozePovuci: false, vremeTekst: '20. sep · 08:00' }),
  offer('closed', { stanje: 'CLOSED', naslov: 'Nošenje peska u dvorište', cena: price(2500), mozePovuci: false, pokrivaMesta: 1 }),
];
const LONG: MojaPrijavaProjekcija[] = [
  offer('long', { naslov: 'Prenos starog trokrilnog ormara iz stana na petom spratu bez lifta do kombija parkiranog u dvorištu zgrade',
    podrucjeTekst: 'Novo naselje, Bulevar Evrope, Novi Sad, blizu Ekonomske škole', vremeTekst: 'Fleksibilan raspon · 24. sep – 30. sep, radnim danima posle 17:00',
    cena: price(125000), pokrivaMesta: 12,
    napomena: 'Dolazimo ekipom od dvanaest ljudi sa dva kombija, trakama, kolicima i zaštitnom folijom za stepenište i vrata; možemo i da rastavimo i ponovo sastavimo orman.' }),
  offer('long-chosen', { stanje: 'SELECTED', dogovorId: 'g-long', mozePovuci: false, traziPaznju: true,
    naslov: 'Selidba kancelarije sa arhivom i nameštajem na drugi kraj grada', cena: price(98500), pokrivaMesta: 4 }),
  // The read never hands over an application without an amount today; the scene shows the word the card says if it did.
  offer('unpriced', { naslov: 'Pomoć oko bašte', cena: { iznos: 0, valuta: 'RSD', prikaz: '' }, pokrivaMesta: 1 }),
];
const DRAFT: OfferEdit = { price: '2000', people: '1', note: 'Donosim bušilicu i tiple.', start: '2026-09-26T08:00:00Z', end: '2026-09-26T10:00:00Z',
  pricing: { rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 2000 }, pokrivenost: { ukupno: 2 } } };
const noop = () => {};

const isScene = (value: unknown): value is Scene => SCENES.some(({ key }) => key === value);

export default function DizajnPrijave() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  // A scene can be opened by its address (`/dizajn-prijave?scene=dugi`); the lab moves between them without reloading the page.
  const params = useLocalSearchParams<{ scene?: string | string[] }>();
  const requested = typeof params.scene === 'string' && isScene(params.scene) ? params.scene : undefined;
  const [scene, setScene] = useState<Scene>(requested ?? 'lista');
  const [tab, setTab] = useState<ApplicationsTab>(requested === 'prazanSkup' ? 'attention' : 'all');
  const [expanded, setExpanded] = useState<string | null>(requested === 'pregled' || requested === 'izmena' ? 'stale' : null);
  const [draft, setDraft] = useState<OfferEdit | null>(requested === 'izmena' ? DRAFT : null);
  const confirmation = useConfirmSheet();
  const choose = (next: Scene) => {
    setScene(next); setTab(next === 'prazanSkup' ? 'attention' : 'all'); setDraft(next === 'izmena' ? DRAFT : null);
    setExpanded(next === 'pregled' || next === 'izmena' ? 'stale' : null);
  };
  useEffect(() => { if (requested) choose(requested); }, [requested]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  // "Prazan prikaz": applications exist, but nothing waits for me, and "Čeka te" is the chosen tab.
  const rows = scene === 'dugi' ? LONG : scene === 'veliki' ? [...LIST, ...LONG] : scene === 'prazno' || scene === 'ucitava' || scene === 'greska' ? []
    : scene === 'prazanSkup' ? LIST.filter(p => !p.traziPaznju) : LIST;
  // The withdrawal question is the real sheet; its answer does nothing here.
  const ask = (p: MojaPrijavaProjekcija) => confirmation.ask({ title: 'Povući prijavu?', message: `Prijava za „${p.naslov}” više neće biti aktivna.`,
    cancelLabel: 'Odustani', confirmLabel: 'Povuci', tone: 'danger', onConfirm: noop });
  return <SafeAreaView edges={['bottom']} style={s.screen}>
    <View style={s.stage}>
      {/* The lab has no system font, so the layout the owner's large text takes (scale 1.3: the parts stand under each other) is forced. */}
      <LayoutClassOverride.Provider value={scene === 'veliki' ? LARGE_LAYOUT : null}>
        <MyApplicationsPresentation rows={rows} loading={scene === 'ucitava'} unavailable={scene === 'greska'}
          message={scene === 'greska' ? 'Pokušaj ponovo za trenutak.' : null}
          notice={scene === 'ceka' ? 'Radnja je potvrđena. Sačuvana prijava sada ima drugačije stanje; pregledaj je ponovo.' : null}
          tab={tab} onTab={setTab} expanded={expanded} draft={draft}
          busy={false} editingLoading={false} pending={scene === 'ceka'} canRetry={scene === 'ceka'} canReset={false}
          onRefresh={noop} onExplore={noop} onProfile={noop} onBack={() => router.back()}
          onReview={p => setExpanded(p.prijavaId)} onClose={() => { setExpanded(null); setDraft(null); }} onEdit={() => setDraft(DRAFT)}
          onChange={setDraft} onCancelEdit={() => setDraft(null)} onKeep={noop} onUpdate={noop} onWithdraw={ask}
          onAgreement={noop} onTask={noop} onRetry={noop} onReset={noop} />
      </LayoutClassOverride.Provider>
    </View>
    <View style={s.strip}>
      <Segmented scroll value={scene} onChange={choose} options={SCENES} />
    </View>
    {confirmation.sheet}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  stage: { flex: 1 },
  strip: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: sys.color.line, backgroundColor: sys.color.surface },
});
