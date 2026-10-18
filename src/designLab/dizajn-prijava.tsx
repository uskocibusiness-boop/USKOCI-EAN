import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import type { PotrebaProjekcija, PrilikaProjekcija } from '../contracts/projections';
import type { ReviewTag } from '../data/reviewsClientService';
import { AUTH_GALLERY_SCENES, AuthGalleryScene, isAuthGalleryScene, type AuthSceneKey } from '../ui/auth/AuthGallery';
import { AgreementReviewPresentation, type ReviewPerson, type ReviewView } from '../ui/reviews/AgreementReviewPresentation';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { sys } from '../ui/system/tokens';
import { ApplicationComposerPresentation, ComposerUnavailable, type ApplicationDraft } from '../ui/v2/ApplicationComposerPresentation';
import { V2Action } from '../ui/v2/V2Action';
import { Press } from '../ui/Press';
import { T } from '../ui/Text';

/**
 * Composing an application and rating a finished collaboration (round 6, unit `prijava`), on the real phone or emulator,
 * in every state the lead photographs. Reached only by its address (uskociapp://dizajn-prijava) in the internal build; the
 * store package shows nothing. The real presentation components draw fixture data: nothing here reads or writes anything.
 * Every command is a no-op; only the draft and the rating on screen follow the fingers, locally, so the fields can be tried.
 *
 * The first group of the list is the sign-in screens ("Ulaz i prijava na nalog", round of 2026-10-08, F7): "prijava" is also the
 * word for signing in, and those scenes are drawn by `ui/auth/AuthGallery` with the real components. A scene can be opened
 * directly by its key: `/dizajn-prijava?scene=ulaz-prijava`.
 */
type Scene = 'ponude-prazno' | 'ponude' | 'neispravna' | 'previse' | 'po-osobi' | 'ukupno' | 'bez-cene' | 'profil' | 'zatvoren'
  | 'pregled' | 'termin' | 'slanje' | 'ishod' | 'ponovi' | 'odbijeno' | 'poslato' | 'ucitavanje' | 'greska' | 'dugacko'
  | 'ocena' | 'ocena-oznake' | 'ocena-cuvanje' | 'ocena-ishod' | 'ocena-sacuvana' | 'ocena-nedostupna' | 'ocena-bez-osobe'
  | 'ocena-ucitavanje' | 'ocena-greska' | AuthSceneKey;
const SCENES: [Scene, string][] = [
  ['ponude-prazno', 'Ponuda: prazna'], ['ponude', 'Ponuda: popunjena'], ['neispravna', 'Ponuda: neispravna cena'],
  ['previse', 'Ponuda: previše ljudi'], ['po-osobi', 'Cena po osobi'], ['ukupno', 'Cena za ceo zadatak'], ['bez-cene', 'Zadatak bez cene'],
  ['profil', 'Radni profil nije aktivan'], ['zatvoren', 'Zadatak ne prima prijave'], ['pregled', 'Pregled pre slanja'],
  ['termin', 'Tačan termin'], ['slanje', 'Slanje'], ['ishod', 'Ishod nepoznat'], ['ponovi', 'Ponovi istu prijavu'],
  ['odbijeno', 'Odbijena ponuda'], ['poslato', 'Prijava poslata'], ['ucitavanje', 'Prijava: učitavanje'], ['greska', 'Prijava: greška'],
  ['dugacko', 'Dugačak naslov'],
  ['ocena', 'Ocena: izbor'], ['ocena-oznake', 'Ocena: tri oznake'], ['ocena-cuvanje', 'Ocena: čuvanje'], ['ocena-ishod', 'Ocena: ishod nepoznat'],
  ['ocena-sacuvana', 'Ocena: sačuvana'], ['ocena-nedostupna', 'Ocena: još nije dostupna'], ['ocena-bez-osobe', 'Ocena: bez osobe'],
  ['ocena-ucitavanje', 'Ocena: učitavanje'], ['ocena-greska', 'Ocena: greška']];

const NEED = { id: 'galerija-zadatak', revizija: 3, naslov: 'Unos ormara na treći sprat', podrucjeTekst: 'Bulevar oslobođenja · Novi Sad',
  vremeTekst: '26. sep · 10:00–12:00', stanje: 'CEKA_PRIJAVE', pokrivenost: { ukupno: 3, popunjeno: 0, preostalo: 3, udeo: 0 },
  rezimCene: 'OFFERS', osnovaCene: null, ponudjenaCena: undefined, taskTimezone: 'Europe/Belgrade',
  schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-26T08:00:00Z', endsAt: '2026-09-26T10:00:00Z' }, uslovi: [] } as unknown as PotrebaProjekcija;
const task = (patch: Partial<PotrebaProjekcija> = {}) => ({ ...NEED, ...patch }) as PotrebaProjekcija;
const opportunity = (need: PotrebaProjekcija, open = true) => ({ ...need, primaNovePrijave: open, rokZaPrijaveIso: null }) as unknown as PrilikaProjekcija;
const PER_PERSON = task({ rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 2500, valuta: 'RSD', prikaz: '2.500 RSD' } } as Partial<PotrebaProjekcija>);
const TOTAL = task({ rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL', ponudjenaCena: { iznos: 18000, valuta: 'RSD', prikaz: '18.000 RSD' } } as Partial<PotrebaProjekcija>);
const UNPRICED = task({ rezimCene: 'MY_PRICE', ponudjenaCena: undefined } as Partial<PotrebaProjekcija>);
const LONG = task({ naslov: 'Pomoć oko selidbe dvosobnog stana sa trećeg sprata bez lifta, uz rasklapanje ormara i kreveta',
  podrucjeTekst: 'Lenke Dunđerski · Novi Sad → Dositejeva · Novi Sad', vremeTekst: 'Fleksibilan raspon · 26. sep – 30. sep',
  schedule: { kind: 'FLEXIBLE', startsAt: '2026-09-26T00:00:00Z', endsAt: '2026-09-30T22:00:00Z' },
  pokrivenost: { ukupno: 4, popunjeno: 1, preostalo: 3, udeo: 0.25 } } as Partial<PotrebaProjekcija>);
const EMPTY: ApplicationDraft = { price: '', people: '1', note: '', start: null, end: null };
const FILLED: ApplicationDraft = { price: '4500', people: '2', note: 'Dolazimo nas dvojica sa trakama i kombijem.', start: null, end: null };

const PERSON: ReviewPerson = { name: 'Nikola Petrović', initials: 'NP', profileId: null, role: 'Traži pomoć', task: 'Unos ormara na treći sprat' };
/** The six tags of the server's catalog (PRE_V3_REVIEW_TAGS_V1), written out so the gallery never loads the review service. */
const CATALOG: { maxTags: number; tags: ReviewTag[] } = { maxTags: 3, tags: ['AS_AGREED', 'CAREFUL', 'CLEAR_COMMUNICATION', 'ON_TIME', 'RELIABLE', 'RESPECTFUL'] };

export default function DizajnPrijava() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string }>();
  const [scene, setScene] = useState<Scene | null>(typeof params.scene === 'string' && isAuthGalleryScene(params.scene) ? params.scene : null);
  const [draft, setDraft] = useState<ApplicationDraft>(EMPTY);
  const [rating, setRating] = useState(0), [tags, setTags] = useState<ReviewTag[]>([]);
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  const noop = () => {};
  const toList = () => setScene(null);
  const show = (next: Scene) => {
    setScene(next);
    setDraft(next === 'ponude-prazno' || next === 'bez-cene' ? EMPTY
      : next === 'neispravna' ? { ...FILLED, price: '4500abc' }
      : next === 'previse' ? { ...FILLED, people: '5' }
      : next === 'po-osobi' ? { ...EMPTY, price: '2500' }
      : next === 'ukupno' ? { ...EMPTY, price: '18000', people: '3' }
      : next === 'pregled' || next === 'termin' ? { ...FILLED, start: '2026-09-26T09:00:00Z', end: '2026-09-26T11:00:00Z' }
      : FILLED);
    setRating(next === 'ocena' || next === 'ocena-bez-osobe' ? 0 : 4);
    setTags(next === 'ocena-oznake' || next === 'ocena-cuvanje' || next === 'ocena-ishod' ? ['ON_TIME', 'RELIABLE', 'CAREFUL'] : []);
  };
  if (!scene) return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar title="Prijava i ocena" onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} />
    <ScrollView contentContainerStyle={s.list}>
      <T variant="bodyStrong" style={s.group}>Ulaz i prijava na nalog</T>
      {AUTH_GALLERY_SCENES.map(([key, label]) => <Press key={key} accessibilityRole="button" accessibilityLabel={`Galerija: ${label}`} haptic="select"
        onPress={() => show(key)} style={s.row}><T variant="body" style={s.ink}>{label}</T></Press>)}
      <T variant="bodyStrong" style={s.group}>Prijava na zadatak i ocena</T>
      {SCENES.map(([key, label]) => <Press key={key} accessibilityRole="button" accessibilityLabel={`Galerija: ${label}`} haptic="select"
        onPress={() => show(key)} style={s.row}><T variant="body" style={s.ink}>{label}</T></Press>)}
    </ScrollView>
  </SafeAreaView>;

  // The sign-in scenes are whole screens of their own (a sheet over its backdrop, or a screen): no strip under them.
  if (isAuthGalleryScene(scene)) return <AuthGalleryScene scene={scene} onBack={toList} />;

  const composer = (need: PotrebaProjekcija, state: { busy?: boolean; pending?: boolean; uncertain?: boolean; error?: string | null; confirmed?: boolean;
    reset?: boolean; canSubmit?: boolean; closed?: boolean; blocked?: { reason: string; actionLabel?: string; onAction?: () => void } | null; sheet?: 'review' | 'time' } = {}) =>
    <ApplicationComposerPresentation need={need} opportunity={opportunity(need, !state.closed)} draft={draft}
      // The per-person total follows the people, as the route's own rule does; nothing leaves the phone.
      change={next => setDraft(need.osnovaCene === 'PER_PERSON' && /^\d+$/.test(next.people) ? { ...next, price: String(2500 * Number(next.people)) } : next)}
      submit={noop} back={toList} busy={!!state.busy} pending={!!state.pending} uncertain={!!state.uncertain} refresh={noop} error={state.error ?? null}
      confirmed={!!state.confirmed} openApplications={noop} canSubmit={state.canSubmit ?? true} reset={state.reset ? noop : undefined}
      blocked={state.blocked ?? null} initialSheet={state.sheet} />;

  const review = (view: ReviewView, person: ReviewPerson | null = PERSON, notice: string | null = null) =>
    <AgreementReviewPresentation backLabel="Nazad na Dogovor" onBack={toList} view={view} person={person} notice={notice}
      retry={{ label: view.kind === 'eligible' && view.attempt ? 'Proveri sačuvanu ocenu' : 'Ponovo učitaj ocenu', disabled: false, onPress: noop }} />;
  const eligible = (patch: Partial<Extract<ReviewView, { kind: 'eligible' }>> = {}): ReviewView => ({ kind: 'eligible', catalog: CATALOG, rating, tags,
    editable: true, attempt: false, onRate: setRating,
    onToggleTag: tag => setTags(values => values.includes(tag) ? values.filter(v => v !== tag) : values.length < 3 ? [...values, tag] : values),
    save: { label: 'Sačuvaj ocenu', loading: false, disabled: rating < 1, reason: rating < 1 ? 'Izaberi ocenu od 1 do 5 pre slanja.' : null, onPress: noop },
    ...patch });

  const body = scene === 'po-osobi' ? composer(PER_PERSON)
    : scene === 'ukupno' ? composer(TOTAL)
    : scene === 'bez-cene' ? composer(UNPRICED)
    : scene === 'profil' ? composer(NEED, { canSubmit: false, blocked: { reason: 'Radni profil još nije aktivan — bez njega ponuda ne može da se pošalje.',
      actionLabel: 'Dopuni radni profil', onAction: noop } })
    : scene === 'zatvoren' ? composer(NEED, { canSubmit: false, closed: true, blocked: { reason: 'Zadatak više ne prima prijave.', actionLabel: 'Pogledaj druge zadatke', onAction: noop } })
    : scene === 'pregled' ? composer(NEED, { sheet: 'review' })
    : scene === 'termin' ? composer(NEED, { sheet: 'time' })
    : scene === 'slanje' ? composer(NEED, { busy: true, pending: true })
    // The three notices are the route's own words (`prilike/[id]/prijava.tsx`), so the gallery shows what it produces.
    : scene === 'ishod' ? composer(NEED, { pending: true, uncertain: true, error: 'Ishod slanja nije potvrđen. Proveri ishod.' })
    : scene === 'ponovi' ? composer(NEED, { pending: true, error: 'Ne znamo da li je prijava stigla. Pošalji istu ponudu još jednom — ako je već stigla, neće se udvostručiti.' })
    : scene === 'odbijeno' ? composer(NEED, { pending: true, reset: true, error: 'Ova ponuda nije primljena. Zadatak je promenjen. Pregledaj aktuelne uslove pre nove prijave.' })
    : scene === 'poslato' ? composer(NEED, { confirmed: true })
    : scene === 'ucitavanje' ? <ComposerUnavailable loading message="" back={toList} />
    : scene === 'greska' ? <ComposerUnavailable loading={false} message="Podatke za prijavu trenutno nije moguće učitati. Proveri vezu i pokušaj ponovo." retry={noop} back={toList} />
    : scene === 'dugacko' ? composer(LONG)
    : scene === 'ocena' ? review(eligible())
    : scene === 'ocena-oznake' ? review(eligible())
    : scene === 'ocena-cuvanje' ? review(eligible({ editable: false, save: { label: 'Sačuvaj ocenu', loading: true, disabled: true, reason: null, onPress: noop } }))
    : scene === 'ocena-ishod' ? review(eligible({ editable: false, attempt: true }), PERSON, 'Ishod čuvanja nije potvrđen. Proveri sačuvanu ocenu.')
    : scene === 'ocena-sacuvana' ? review({ kind: 'saved', rating: 5, tags: ['ON_TIME', 'RELIABLE'], fresh: true })
    : scene === 'ocena-nedostupna' ? review({ kind: 'unavailable' })
    : scene === 'ocena-bez-osobe' ? review(eligible(), null)
    : scene === 'ocena-ucitavanje' ? review({ kind: 'loading' })
    : scene === 'ocena-greska' ? review({ kind: 'error', message: 'Ocenu trenutno nije moguće učitati. Proveri vezu i pokušaj ponovo.' })
    : composer(NEED);
  return <View style={s.screen}>
    <View style={s.grow}>{body}</View>
    <SafeAreaView edges={['bottom']} style={s.strip}>
      <V2Action label="Nazad na listu scena" kind="quiet" compact onPress={toList} />
    </SafeAreaView>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  grow: { flex: 1 },
  ink: { color: sys.color.ink },
  group: { color: sys.color.ink, paddingTop: sys.space.base, paddingBottom: sys.space.xs },
  list: { paddingHorizontal: sys.space.lg, paddingBottom: sys.space.xxl },
  row: { minHeight: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: sys.color.line },
  strip: { borderTopWidth: 1, borderTopColor: sys.color.line, backgroundColor: sys.color.surface, paddingHorizontal: sys.space.base },
});
