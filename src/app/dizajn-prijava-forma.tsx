import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import type { PotrebaProjekcija, PrilikaProjekcija } from '../contracts/projections';
import { Press } from '../ui/Press';
import { LARGE_LAYOUT, LayoutClassOverride } from '../ui/system/textScale';
import { sys } from '../ui/system/tokens';
import { T } from '../ui/Text';
import { ApplicationComposerPresentation, type ApplicationDraft } from '../ui/v2/ApplicationComposerPresentation';

/**
 * The form of an application ("Prijava na zadatak") on fixtures, for the design lab and for the internal build:
 * uskociapp://dizajn-prijava-forma?scene=ponuda. Nothing here reads or writes anything: the real presentation draws example data, every
 * command is inert, and only the draft follows the fingers so the fields can be tried. A store build shows nothing.
 *
 * Scenes: `prazna` an empty form, `ponuda` a filled one, `veliko` the same at the large-text layout (the lab has no system font, so the
 * layout class is forced, as the other galleries do), `pregled` and `pregled-veliko` the review sheet that stands before the send,
 * `po-osobi` a task priced per person, `bez-cene` a task whose price was not named, `profil` a worker profile that is not active, `ishod`
 * an outcome that is not known, `poslato` the receipt ("Prijava je poslata": the tag has gone and the row stays, the last frame), `poslato-dugo` the same with a long
 * title and a long message, `dugo` a long title. (The rest of the states of this screen and the rating are in
 * `dizajn-prijava`, which is another family's.)
 */
const SCENES = ['prazna', 'ponuda', 'veliko', 'pregled', 'pregled-veliko', 'po-osobi', 'bez-cene', 'profil', 'ishod', 'poslato', 'poslato-dugo', 'dugo'] as const;
type Scene = typeof SCENES[number];
const LABELS: Record<Scene, string> = { prazna: 'Prazna', ponuda: 'Popunjena', veliko: 'Veliki tekst', pregled: 'Pregled', 'pregled-veliko': 'Pregled: veliki tekst',
  'po-osobi': 'Po osobi', 'bez-cene': 'Bez cene', profil: 'Profil nije aktivan', ishod: 'Ishod nepoznat', poslato: 'Poslato', 'poslato-dugo': 'Poslato: dugi nazivi', dugo: 'Dugačak naslov' };
const isScene = (value: unknown): value is Scene => typeof value === 'string' && (SCENES as readonly string[]).includes(value);
const noop = () => {};

const NEED = { id: 'galerija-zadatak', revizija: 3, naslov: 'Unos ormara na treći sprat', podrucjeTekst: 'Bulevar oslobođenja, Novi Sad',
  vremeTekst: '26. okt · 09:00–11:00', stanje: 'CEKA_PRIJAVE', pokrivenost: { ukupno: 3, popunjeno: 0, preostalo: 3, udeo: 0 },
  rezimCene: 'OFFERS', osnovaCene: null, ponudjenaCena: undefined, taskTimezone: 'Europe/Belgrade',
  schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-10-26T08:00:00Z', endsAt: '2026-10-26T10:00:00Z' }, uslovi: [] } as unknown as PotrebaProjekcija;
const task = (patch: Partial<PotrebaProjekcija> = {}) => ({ ...NEED, ...patch }) as PotrebaProjekcija;
const opportunity = (need: PotrebaProjekcija) => ({ ...need, primaNovePrijave: true, rokZaPrijaveIso: null }) as unknown as PrilikaProjekcija;
const PER_PERSON = task({ rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 2500, valuta: 'RSD', prikaz: '2.500 RSD' } } as Partial<PotrebaProjekcija>);
const UNPRICED = task({ rezimCene: 'MY_PRICE', ponudjenaCena: undefined } as Partial<PotrebaProjekcija>);
const LONG = task({ naslov: 'Pomoć oko selidbe dvosobnog stana sa trećeg sprata bez lifta, uz rasklapanje ormara i kreveta',
  podrucjeTekst: 'Lenke Dunđerski, Novi Sad → Dositejeva, Novi Sad', vremeTekst: 'Fleksibilan raspon · 26. okt – 30. okt',
  schedule: { kind: 'FLEXIBLE', startsAt: '2026-10-26T00:00:00Z', endsAt: '2026-10-30T22:00:00Z' },
  pokrivenost: { ukupno: 4, popunjeno: 1, preostalo: 3, udeo: 0.25 } } as Partial<PotrebaProjekcija>);
const EMPTY: ApplicationDraft = { price: '', people: '1', note: '', start: null, end: null };
const FILLED: ApplicationDraft = { price: '4500', people: '2', note: 'Dolazimo nas dvojica sa trakama i kombijem.', start: null, end: null };

const LONG_NOTE = 'Imamo iskustva sa selidbama stanova i kancelarija, donosimo sav alat, ćebad za zaštitu nameštaja i folije za pod. Klavir nosimo sa posebnim kaiševima.';
function draftOf(scene: Scene): ApplicationDraft {
  return scene === 'prazna' || scene === 'bez-cene' ? EMPTY : scene === 'po-osobi' ? { ...EMPTY, price: '2500' }
    : scene === 'poslato-dugo' ? { ...FILLED, price: '125000', people: '3', note: LONG_NOTE } : FILLED;
}

function Form({ scene }: { scene: Scene }) {
  const [draft, setDraft] = useState<ApplicationDraft>(() => draftOf(scene));
  const need = scene === 'po-osobi' ? PER_PERSON : scene === 'bez-cene' ? UNPRICED : scene === 'dugo' || scene === 'poslato-dugo' ? LONG : NEED;
  const state = scene === 'profil' ? { canSubmit: false, blocked: { reason: 'Radni profil još nije aktivan — bez njega ponuda ne može da se pošalje.', actionLabel: 'Dopuni radni profil', onAction: noop } }
    : scene === 'ishod' ? { pending: true, uncertain: true, error: 'Ne znamo da li je prijava stigla. Izaberi „Proveri da li je poslato“.' }
    : scene === 'poslato' || scene === 'poslato-dugo' ? { confirmed: true }
    : scene === 'pregled' || scene === 'pregled-veliko' ? { sheet: 'review' as const }
    : {};
  const body = <ApplicationComposerPresentation need={need} opportunity={opportunity(need)} draft={draft}
    // The per-person total follows the people, as the route's own rule does; nothing leaves the phone.
    change={next => setDraft(need.osnovaCene === 'PER_PERSON' && /^\d+$/.test(next.people) ? { ...next, price: String(2500 * Number(next.people)) } : next)}
    submit={noop} back={() => router.back()} busy={false} pending={!!(state as { pending?: boolean }).pending} uncertain={!!(state as { uncertain?: boolean }).uncertain}
    refresh={noop} error={(state as { error?: string }).error ?? null} confirmed={!!(state as { confirmed?: boolean }).confirmed} openApplications={noop}
    canSubmit={(state as { canSubmit?: boolean }).canSubmit ?? true} blocked={(state as { blocked?: never }).blocked ?? null}
    initialSheet={(state as { sheet?: 'review' }).sheet} />;
  return scene === 'veliko' || scene === 'pregled-veliko' ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{body}</LayoutClassOverride.Provider> : body;
}

export default function DizajnPrijavaForma() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string | string[] }>();
  const requested = typeof params.scene === 'string' && isScene(params.scene) ? params.scene : undefined;
  const [scene, setScene] = useState<Scene>(requested ?? 'ponuda');
  // An address that names another scene (the lab moves between them without reloading the page) moves the strip with it.
  useEffect(() => { if (requested) setScene(requested); }, [requested]);
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  return <View style={s.screen}>
    {/* Each scene is mounted fresh, so its draft and its sheet start where the scene says. */}
    <View key={scene} style={s.fill}><Form scene={scene} /></View>
    <View style={s.rule} />
    <SafeAreaView edges={['bottom']} style={s.strip}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {SCENES.map(key => <Press key={key} accessibilityRole="button" accessibilityLabel={`Galerija: ${LABELS[key]}`} accessibilityState={{ selected: scene === key }}
          haptic="select" onPress={() => setScene(key)} style={[s.chip, scene === key && s.chipOn]}>
          <T variant="meta" style={scene === key ? s.chipTextOn : s.chipText}>{LABELS[key]}</T>
        </Press>)}
      </ScrollView>
    </SafeAreaView>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  fill: { flex: 1 },
  rule: { height: sys.rule.width, backgroundColor: sys.rule.color },
  strip: { backgroundColor: sys.color.surface },
  chips: { paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm, gap: sys.space.sm },
  chip: { minHeight: 48, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: sys.color.greenSoft, borderColor: sys.color.green },
  chipText: { color: sys.color.ink },
  chipTextOn: { color: sys.color.green, fontWeight: '700' },
});
