import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import type { JavniProfilProjekcija, KandidatProjekcija, PotrebaProjekcija } from '../contracts/projections';
import { PublicProfileSheet } from '../ui/system/PublicProfileSheet';
import { LARGE_LAYOUT, LayoutClassOverride } from '../ui/system/textScale';
import { sys } from '../ui/system/tokens';
import { CandidateListPresentation, CandidateSelectionPresentation, SelectionUnavailable } from '../ui/v2/ApplicationSelectionPresentation';
import { Press } from '../ui/Press';
import { T } from '../ui/Text';

/**
 * Incoming applications and choosing a candidate (owner's step 7), on the real phone or emulator, in every state the lead
 * photographs: the list, empty, loading, error, long names, the large-text layout, the offer sheet in each outcome, the
 * confirmation and the public profile. Reached only by its address (uskociapp://dizajn-kandidati) in the internal build;
 * the store package shows nothing. The real presentation components draw fixture data: nothing here reads or writes
 * anything. Every command is a local stand-in (a choice "runs" for a moment and then says the Dogovor is made; the safety
 * entry "opens" and says the person is not available), so the states can be seen without touching an account.
 */
type Scene = 'lista' | 'prazno' | 'ucitavanje' | 'greska' | 'dugacka' | 'veliki' | 'ponuda' | 'ponuda-veliki' | 'ne-moze' | 'izabrana' | 'ishod' | 'ponovi'
  | 'sklopljen' | 'profil' | 'profil-ucitavanje' | 'profil-greska';
const SCENES: [Scene, string][] = [['lista', 'Lista'], ['prazno', 'Prazno'], ['ucitavanje', 'Učitavanje'], ['greska', 'Greška'],
  ['dugacka', 'Dugačka imena'], ['veliki', 'Veliki tekst (raspored)'], ['ponuda', 'Ponuda'], ['ponuda-veliki', 'Ponuda: veliki tekst'], ['ne-moze', 'Ne može izbor'],
  ['izabrana', 'Izabrana'], ['ishod', 'Ishod nepoznat'], ['ponovi', 'Ponovi izbor'], ['sklopljen', 'Dogovor sklopljen'],
  ['profil', 'Javni profil'], ['profil-ucitavanje', 'Profil: učitavanje'], ['profil-greska', 'Profil: greška']];

const NEED = { id: 'galerija-zadatak', revizija: 3, naslov: 'Unos ormara na treći sprat', podrucjeTekst: 'Liman 2, Novi Sad',
  vremeTekst: '26. sep · 10:00–12:00', stanje: 'CEKA_PRIJAVE', pokrivenost: { ukupno: 3, popunjeno: 0, preostalo: 3, udeo: 0 },
  rezimCene: 'OFFERS', taskTimezone: 'Europe/Belgrade', uslovi: [], brojPrijava: 3, brojPrijavaZaIzbor: 2 } as unknown as PotrebaProjekcija;
const evidence = (patch: Partial<KandidatProjekcija['dokazPrijave']> = {}): KandidatProjekcija['dokazPrijave'] => ({ sema: 'APPLICATION_V1_SELF_DECLARED',
  kapacitetTima: 2, vestine: [], alati: ['Trake za nošenje'], vozila: ['Kombi'], licence: [], ...patch });
const candidate = (patch: Partial<KandidatProjekcija>): KandidatProjekcija => ({ prijavaId: 'galerija-1', radnikProfilId: 'galerija-profil-1', potrebaRevizija: 3,
  verzija: 1, hash: 'a'.repeat(64), ime: 'Milan Petrović', inicijali: 'MP', ocenaTekst: '4,8', recenzijeTekst: '11 recenzija',
  cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' }, pokrivaMesta: 2, preostaloMesta: 3, dolazakTekst: '', prevozTekst: '',
  napomena: 'Dolazimo nas dvojica sa trakama. Kombi može da stane ispred ulaza, ormar nosimo rasklopljen.', stanje: 'SELECTABLE', mozeIzabrati: true,
  predlozeniPocetak: '2026-09-26T08:00:00Z', predlozeniKraj: '2026-09-26T10:00:00Z', dokazPrijave: evidence(), razlogPreporuke: null, ...patch });
const NORMAL: KandidatProjekcija[] = [candidate({}),
  candidate({ prijavaId: 'galerija-2', radnikProfilId: 'galerija-profil-2', ime: 'Ana Jovanović', inicijali: 'AJ', ocenaTekst: '—', recenzijeTekst: '3 završena zadatka',
    cena: { iznos: 3900, valuta: 'RSD', prikaz: '3.900 RSD' }, pokrivaMesta: 1, napomena: '', predlozeniPocetak: null, predlozeniKraj: null,
    dokazPrijave: evidence({ vozila: [], alati: [] }) }),
  candidate({ prijavaId: 'galerija-3', radnikProfilId: 'galerija-profil-3', ime: 'Nikola Ilić', inicijali: 'NI', ocenaTekst: '5', recenzijeTekst: '2 recenzije',
    cena: { iznos: 5200, valuta: 'RSD', prikaz: '5.200 RSD' }, stanje: 'STALE', mozeIzabrati: false, napomena: 'Mogu i posle 16h.' })];
const LONG: KandidatProjekcija[] = [
  candidate({ prijavaId: 'galerija-4', ime: 'Aleksandra Stefanović-Radosavljević', inicijali: 'AS', recenzijeTekst: '128 recenzija',
    cena: { iznos: 125000, valuta: 'RSD', prikaz: '125.000 RSD' }, pokrivaMesta: 3,
    napomena: 'Imamo iskustva sa selidbama stanova i kancelarija, donosimo sav alat, ćebad za zaštitu nameštaja i folije za pod.' }),
  candidate({ prijavaId: 'galerija-5', radnikProfilId: 'galerija-profil-5', ime: 'Konstantin Dimitrijević Mladenović', inicijali: 'KD', ocenaTekst: '—', recenzijeTekst: '',
    cena: { iznos: 18500, valuta: 'RSD', prikaz: '18.500 RSD' }, pokrivaMesta: 1, predlozeniPocetak: '2026-09-26T20:00:00Z', predlozeniKraj: '2026-09-27T06:30:00Z' }),
  candidate({ prijavaId: 'galerija-6', radnikProfilId: 'galerija-profil-6', ime: 'Ime nije dostupno', inicijali: '', ocenaTekst: '—', recenzijeTekst: '0 završenih zadataka',
    stanje: 'OVERFILL', mozeIzabrati: false, dokazPrijave: { sema: 'LEGACY_UNPROVEN', kapacitetTima: null, vestine: null, alati: null, vozila: null, licence: null } })];
const PROFILE = { profilId: 'galerija-profil-1', uloga: 'radnik', ime: 'Milan Petrović', avatarPutanja: null, grad: 'Novi Sad',
  naslov: 'Selidbe i nošenje tereta', biografija: 'Radim sa bratom, imamo kombi i trake. Dolazimo tačno.',
  poverenje: { ocenaProsek: 4.8, brojRecenzija: 11, zavrseniBroj: 14, identitetVerifikovan: true, ocenaDostupna: true, recenzijeDostupne: true,
    verifikacijaIdentitetaDostupna: true } } as unknown as JavniProfilProjekcija;

const isScene = (value: unknown): value is Scene => SCENES.some(([key]) => key === value);

export default function DizajnKandidati() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  // A scene can be opened by its address (`/dizajn-kandidati?scene=dugacka`); the lab moves between them without reloading the page.
  const params = useLocalSearchParams<{ scene?: string | string[] }>();
  const requested = typeof params.scene === 'string' && isScene(params.scene) ? params.scene : undefined;
  const [scene, setScene] = useState<Scene>(requested ?? 'lista');
  // Local stand-ins for the commands, so the busy and outcome states can be seen; nothing leaves the phone.
  const [busy, setBusy] = useState(false), [chosen, setChosen] = useState(false);
  const [safety, setSafety] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  useEffect(() => { if (requested) { setScene(requested); setBusy(false); setChosen(false); setSafety({ busy: false, error: null }); } }, [requested]);
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  const later = (ms: number, run: () => void) => { timers.current.push(setTimeout(run, ms)); };
  const show = (next: Scene) => { setScene(next); setBusy(false); setChosen(false); setSafety({ busy: false, error: null }); };
  const leave = () => router.back();
  const toList = () => show('lista');
  const choose = () => new Promise<void>(resolve => { setBusy(true); later(900, () => { setBusy(false); setChosen(true); resolve(); }); });
  const safetyEntry = { ...safety, onPress: () => { setSafety({ busy: true, error: null });
    later(700, () => setSafety({ busy: false, error: 'Osoba trenutno nije dostupna.' })); } };
  const publicProfile = () => new Promise<JavniProfilProjekcija | null>(resolve => later(500, () => resolve(PROFILE)));
  const offer = (k: KandidatProjekcija, state: { pending?: boolean; uncertain?: boolean; error?: string | null; reset?: boolean; confirmed?: boolean } = {}) =>
    <CandidateSelectionPresentation need={NEED} candidate={k} back={toList} publicProfile={publicProfile} choose={choose} busy={busy}
      pending={!!state.pending} uncertain={!!state.uncertain} refresh={() => {}} error={state.error ?? null} confirmed={!!state.confirmed || chosen}
      openAgreement={() => {}} reset={state.reset ? () => {} : undefined} readAgreement={async () => ({ ok: true, podatak: { dogovorId: 'galerija-dogovor' } })}
      openLinkedAgreement={() => {}} safety={safetyEntry} />;
  const list = (candidates: KandidatProjekcija[], textScale?: number) =>
    <CandidateListPresentation need={NEED} candidates={candidates} open={() => show('ponuda')} back={leave} refresh={() => {}} openTask={() => {}} textScale={textScale} />;
  const body = scene === 'prazno' ? list([])
    : scene === 'ucitavanje' ? <SelectionUnavailable loading message="" back={leave} />
    : scene === 'greska' ? <SelectionUnavailable loading={false} message="Prijave trenutno nije moguće učitati. Proveri vezu i pokušaj ponovo." retry={() => {}} back={leave} />
    : scene === 'dugacka' ? list(LONG)
    : scene === 'veliki' ? list([...NORMAL, ...LONG], 1.3)
    : list(NORMAL);
  const sheet = scene === 'ponuda' || scene === 'ponuda-veliki' ? offer(NORMAL[0])
    : scene === 'ne-moze' ? offer(NORMAL[2])
    : scene === 'izabrana' ? offer({ ...NORMAL[0], stanje: 'SELECTED', mozeIzabrati: false })
    : scene === 'ishod' ? offer(NORMAL[0], { pending: true, uncertain: true, error: 'Ne znamo da li je izbor sačuvan. Izaberi „Proveri da li je izabrano“.' })
    : scene === 'ponovi' ? offer(NORMAL[0], { pending: true, reset: true, error: 'Prijave su osvežene. Ako izbor nije sačuvan, izaberi prijavu ponovo.' })
    : scene === 'sklopljen' ? offer(NORMAL[0], { pending: true, confirmed: true })
    : scene === 'profil' ? <PublicProfileSheet state={{ loading: false, data: PROFILE }} onClose={toList} onRetry={() => {}} safety={safetyEntry} />
    : scene === 'profil-ucitavanje' ? <PublicProfileSheet state={{ loading: true, data: null }} onClose={toList} onRetry={() => {}} />
    : scene === 'profil-greska' ? <PublicProfileSheet state={{ loading: false, data: null }} onClose={toList} onRetry={() => {}} />
    : null;
  // The lab has no system font, so the large-text layout is forced for the scenes that show it, as the other galleries do.
  const large = scene === 'veliki' || scene === 'ponuda-veliki';
  const content = <View style={s.screen}>
    {/* Each scene is mounted fresh, so its comparison and its order start where the scene says. */}
    <View key={scene} style={s.grow}>{body}</View>
    {sheet}
    <SafeAreaView edges={['bottom']} style={s.strip}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {SCENES.map(([key, label]) => <Press key={key} accessibilityRole="button" accessibilityLabel={`Galerija: ${label}`}
          accessibilityState={{ selected: scene === key }} haptic="select" onPress={() => show(key)} style={[s.chip, scene === key && s.chipOn]}>
          <T variant="meta" style={scene === key ? s.chipTextOn : s.chipText}>{label}</T>
        </Press>)}
      </ScrollView>
    </SafeAreaView>
  </View>;
  return large ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{content}</LayoutClassOverride.Provider> : content;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  grow: { flex: 1 },
  strip: { borderTopWidth: 1, borderTopColor: sys.color.line, backgroundColor: sys.color.surface },
  chips: { paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm, gap: sys.space.sm },
  chip: { minHeight: 48, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong,
    alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: sys.color.greenSoft, borderColor: sys.color.green },
  chipText: { color: sys.color.ink },
  chipTextOn: { color: sys.color.green, fontWeight: '700' },
});
