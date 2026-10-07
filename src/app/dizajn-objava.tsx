import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import type { MarketConfig } from '../contracts/market';
import type { NeedLocationReview } from '../contracts/location';
import type { createConfiguredLocationResolver } from '../data/configuredLocationResolver';
import { NeedLocationForm } from '../ui/location/NeedLocationForm';
import { LocationMapPreview } from '../ui/location/LocationMapPreview';
import { LocationScreen } from '../ui/location/LocationControls';
import { PrivatePlace, PublicPlace, PublishButton, ReviewDeadline, ReviewEmptyFacts, ReviewFactRow, ReviewPhotos, ReviewPreview,
  ReviewSection, ReviewStatus, ReviewTodoList, reviewStyles, type TodoRow } from '../ui/objava/ReviewPresentation';
import { PhotoGrid, PhotoStatus, PhotoTile, PhotosLoading, PhotosPrivacyNote, type PhotoTileState } from '../ui/objava/TaskPhotosPresentation';
import { SettingsAction, SettingsScreen, SettingsText } from '../ui/settings/SettingsPresentation';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { FactArt } from '../ui/system/FactArt';
import { StateView } from '../ui/system/StateView';
import { useConfirmSheet } from '../ui/system/ConfirmSheet';
import { brandAction, inset, sys } from '../ui/system/tokens';
import type { Summary } from '../ui/v2/draftSummary';
import { V2Action } from '../ui/v2/V2Action';
import { Press } from '../ui/Press';
import { T } from '../ui/Text';

/**
 * The publish review, the task's place and its photos (round 6, unit "objava"), on the real phone or emulator, in every
 * state the lead photographs. Reached only by its address (uskociapp://dizajn-objava) in the internal build; the store
 * package shows nothing. The real presentation parts draw fixture data: nothing here reads or writes anything. Every
 * command is a no-op; the address search answers that it is not activated, and a photo is a quiet stand-in, so no
 * media is read. Only the map's public tiles load, as they do on every map. The saved-point map scenes use the
 * production preview with public fixture coordinates; external map links launch only if explicitly pressed.
 */
type Scene = { key: string; group: string; label: string };
const SCENES: Scene[] = [
  { key: 'pregled-spremno', group: 'Pregled pre objave', label: 'Spremno za objavu' },
  { key: 'pregled-jos-treba', group: 'Pregled pre objave', label: 'Još treba' },
  { key: 'pregled-objavljuje', group: 'Pregled pre objave', label: 'Objavljuje se' },
  { key: 'pregled-objavljeno', group: 'Pregled pre objave', label: 'Objavljeno' },
  { key: 'pregled-nacrt', group: 'Pregled pre objave', label: 'Privatan nacrt' },
  { key: 'pregled-ishod', group: 'Pregled pre objave', label: 'Ishod nije potvrđen' },
  { key: 'pregled-ucitavanje', group: 'Pregled pre objave', label: 'Učitavanje' },
  { key: 'pregled-greska', group: 'Pregled pre objave', label: 'Greška' },
  { key: 'pregled-veliki', group: 'Pregled pre objave', label: 'Veliki tekst (raspored)' },
  { key: 'mesto-forma', group: 'Mesto zadatka', label: 'Izmena mesta' },
  { key: 'mesto-ruta', group: 'Mesto zadatka', label: 'Od mesta do mesta' },
  { key: 'mesto-pregled-rute', group: 'Mesto zadatka', label: 'Pregled potvrđene putanje' },
  { key: 'mesto-pregled-vise', group: 'Mesto zadatka', label: 'Više potvrđenih mesta' },
  { key: 'mesto-daljina', group: 'Mesto zadatka', label: 'Rad na daljinu' },
  { key: 'mesto-zakljucano', group: 'Mesto zadatka', label: 'Nije dostupno za izmene' },
  { key: 'mesto-sacuvano', group: 'Mesto zadatka', label: 'Sačuvano (stari put)' },
  { key: 'mesto-ucitavanje', group: 'Mesto zadatka', label: 'Učitavanje' },
  { key: 'foto-mreza', group: 'Fotografije zadatka', label: 'Mreža i stanja' },
  { key: 'foto-salje', group: 'Fotografije zadatka', label: 'Slanje u toku' },
  { key: 'foto-nepotvrdjeno', group: 'Fotografije zadatka', label: 'Slanje nije potvrđeno' },
  { key: 'foto-puno', group: 'Fotografije zadatka', label: 'Šest fotografija' },
  { key: 'foto-prazno', group: 'Fotografije zadatka', label: 'Prazno' },
  { key: 'foto-ucitavanje', group: 'Fotografije zadatka', label: 'Učitavanje' },
  { key: 'foto-greska', group: 'Fotografije zadatka', label: 'Greška čitanja' },
  { key: 'foto-ukloni', group: 'Fotografije zadatka', label: 'Pitanje pre uklanjanja' },
];

const noop = () => {};
const SUMMARY: Summary = { title: 'Prenos ormara na treći sprat bez lifta', zone: 'Novi Sad · Liman 2',
  schedule: '27. sep · 10:00–12:00', value: { kind: 'amount', amount: '4.500 RSD', basis: 'ukupno' }, people: '2 osobe' };
const ANCHOR = { latitude: 45.24, longitude: 19.84 };
// Public-area fixtures only. These are never written as a task, grant or account location.
const MAP_POINTS = [
  { id: 'start', label: 'Početak: Liman, Novi Sad', latitude: 45.239, longitude: 19.841 },
  { id: 'stop', label: 'Usput: Stari grad, Novi Sad', latitude: 45.255, longitude: 19.847 },
  { id: 'end', label: 'Završetak: Petrovaradin, Novi Sad', latitude: 45.252, longitude: 19.877 },
];
const COUNTRIES = { countries: [
  { countryCode: 'RS', productStatus: 'BUILDING', defaultCurrencyCode: 'RSD', defaultLanguageTag: 'sr-Latn', defaultTimezone: 'Europe/Belgrade' },
  { countryCode: 'HR', productStatus: 'COMING', defaultCurrencyCode: 'EUR', defaultLanguageTag: 'hr', defaultTimezone: 'Europe/Zagreb' },
] as unknown as MarketConfig[], loading: false, error: null, refresh: noop };
/** The address search as it stands for internal testing: not activated (owner decision 8), so nothing is asked of anyone. */
const RESOLVER = { search: async () => ({ status: 'PROVIDER_ACTIVATION_BLOCKED' }), reverse: async () => ({ status: 'PROVIDER_ACTIVATION_BLOCKED' }),
  cancel: noop } as unknown as ReturnType<typeof createConfiguredLocationResolver>;
const place = (patch: Partial<NeedLocationReview['value']> = {}, editable = true): NeedLocationReview => ({ accountId: 'galerija', conversationId: 'galerija',
  editable, confirmed: false, revision: 'galerija', value: { taskCountryCode: 'RS', geography: { mode: 'STATIONARY', start: { city: 'Novi Sad', area: 'Liman 2' } },
    exactAddress: 'Bulevar oslobođenja 12, stan 7', accessNotes: 'Interfon 7, treći sprat', ...patch } });
const FIXED_POINT = { version: 1 as const, binding: { taskCountryCode: 'RS', geography: { mode: 'STATIONARY' as const, start: { city: 'Novi Sad', area: 'Liman 2' } },
  exactAddress: 'Bulevar oslobođenja 12, stan 7' }, points: [{ slot: 'start' as const, latitudeE6: 45243210, longitudeE6: 19842100, origin: { kind: 'MANUAL_PIN' as const } }] };

/** A photo's quiet stand-in: the gallery reads no media. */
function Picture({ size }: { size?: number }) {
  return <View style={[s.picture, size ? { width: size, height: size } : s.fill]}><FactArt kind="photo" size={32} /></View>;
}

export default function DizajnObjava() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const [scene, setScene] = useState<string | null>(null);
  const confirm = useConfirmSheet(), closeQuestion = confirm.close;
  // Android Back inside a scene returns to the list, as "Nazad" does (the sibling galleries do the same).
  useEffect(() => {
    if (!scene) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { closeQuestion(); setScene(null); return true; });
    return () => subscription.remove();
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (scene === 'foto-ukloni') confirm.ask({ title: 'Ukloniti fotografiju?', message: 'Fotografija se uklanja iz nacrta zadatka.',
      confirmLabel: 'Ukloni', tone: 'danger', onConfirm: noop });
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  const toList = () => { confirm.close(); setScene(null); };
  if (!scene) return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ScrollView contentContainerStyle={s.list}>
      <T variant="title" accessibilityRole="header">Galerija: objava zadatka</T>
      <T variant="note" tone="muted">Primeri stanja sa izmišljenim podacima. Ništa se ne čita i ne šalje.</T>
      {SCENES.map((item, index) => <View key={item.key}>
        {index === 0 || SCENES[index - 1].group !== item.group ? <T variant="label" style={s.group}>{item.group}</T> : null}
        <Press accessibilityRole="button" accessibilityLabel={`${item.group}: ${item.label}`} haptic="select" onPress={() => setScene(item.key)} style={s.row}>
          <T variant="bodyStrong">{item.label}</T>
        </Press>
      </View>)}
      <SettingsAction label="Zatvori galeriju" kind="quiet" onPress={() => router.back()} />
    </ScrollView>
  </SafeAreaView>;

  /* ------------------------------------------------------------------------------------------------ the review */
  const review = (options: { todos?: TodoRow[]; status?: { published: boolean; text: string }; command?: ReactNode; working?: boolean;
    large?: boolean; loading?: boolean; failure?: boolean; error?: string }) => {
    const blocked = !!options.todos?.length || !!options.working;
    const body = options.loading ? <StateView kind="loading" title="Pripremamo pregled…" skeleton={{ count: 1, rows: 3, variant: 'preview' }} />
      : options.failure ? <StateView kind="error" art="document" title="Pregled nije učitan" body="Pregled trenutno nije dostupan. Proveri vezu i pokušaj ponovo."
        primary={{ label: 'Učitaj pregled i proveri ishod', onPress: noop }} />
      : <>
        {options.status ? <ReviewStatus published={options.status.published} fresh={options.status.published} text={options.status.text} /> : null}
        <ReviewPreview summary={options.todos?.length ? { ...SUMMARY, value: null } : SUMMARY} unpriced={!!options.todos?.length} large={!!options.large} />
        {options.todos?.length ? <ReviewTodoList items={options.todos} disabled={false} /> : null}
        <ReviewSection title="Mesto" action={options.command ? null : <V2Action label={options.todos?.length ? 'Dodaj mesto' : 'Uredi mesto'} kind="quiet" compact onPress={noop} />}>
          <PublicPlace zone={SUMMARY.zone} lines={[]} anchor={options.todos?.length ? null : ANCHOR} scopeKey="galerija:pregled" pointsConfirmed={!options.todos?.length} />
          <PrivatePlace>
            <ReviewFactRow label="Tačna adresa" value="Bulevar oslobođenja 12, stan 7" large={!!options.large} system={false}
              edit={options.command ? undefined : noop} editDisabled={false} />
            <ReviewFactRow label="Pristup" value="Interfon 7, treći sprat" large={!!options.large} system={false}
              edit={options.command ? undefined : noop} editDisabled={false} />
          </PrivatePlace>
        </ReviewSection>
        <ReviewSection title="Detalji">
          <View>
            <ReviewFactRow label="Opis" value="Orman je rasklopljen, treba ga uneti na treći sprat. Zgrada nema lift, stepenište je široko."
              large={!!options.large} system={false} edit={options.command ? undefined : noop} editDisabled={false} />
            <ReviewFactRow label="Broj ljudi" value="2" large={!!options.large} system={false} edit={options.command ? undefined : noop} editDisabled={false} />
            <ReviewFactRow label="Početak" value="27. sep · 10:00" large={!!options.large} system={false} edit={options.command ? undefined : noop} editDisabled={false} />
            <ReviewFactRow label="Iznos" value="4.500 RSD" large={!!options.large} system={false} edit={options.command ? undefined : noop} editDisabled={false} />
            <ReviewEmptyFacts labels={['Alati', 'Vozila']} onOpen={noop} />
          </View>
        </ReviewSection>
        <ReviewSection title="Fotografije" action={options.command ? null : <V2Action label="Uredi fotografije" kind="quiet" compact onPress={noop} />}>
          <ReviewPhotos assetIds={['a', 'b', 'c', 'd']} picture={(_, size) => <Picture size={size} />} />
        </ReviewSection>
        <ReviewSection title="Prijave" action={options.command ? null : <V2Action label="Uredi rok za prijave" kind="quiet" compact onPress={noop} />}>
          <ReviewDeadline text={null} />
        </ReviewSection>
      </>;
    return <SafeAreaView edges={['top', 'bottom']} style={reviewStyles.canvas}>
      <DetailTopBar backLabel="Nazad" onBack={toList} title={options.status?.published ? 'Objavljeno' : 'Pregled zadatka'} />
      <ScrollView contentContainerStyle={reviewStyles.content}><View style={reviewStyles.stack}>{body}</View></ScrollView>
      {options.loading || options.failure ? null : <View style={reviewStyles.footer}>
        {options.error ? <T accessibilityRole="alert" style={reviewStyles.error}>{options.error}</T> : null}
        {options.command ?? <>
          <PublishButton label="Objavi zadatak" blocked={blocked} working={!!options.working}
            reason={options.todos?.length ? 'Prvo reši ono što još treba.' : null} onPress={noop} />
          <T style={reviewStyles.caption}>{options.todos?.length ? 'Prvo reši ono što još treba.' : 'Ovim prihvataš prikazanu verziju i tražiš objavu.'}</T>
          {options.todos?.length ? null : <V2Action label="Sačuvaj nacrt" kind="quiet" disabled={!!options.working} onPress={noop} />}
        </>}
      </View>}
    </SafeAreaView>;
  };
  const todos: TodoRow[] = [
    { key: 'missing', text: 'Nedostaje: Broj ljudi.', onPress: noop },
    { key: 'location', text: 'Mesto na mapi nije potvrđeno.', onPress: noop },
    { key: 'fact', text: 'Unesi iznos ili izaberi prikupljanje ponuda.', onPress: noop },
  ];

  /* ------------------------------------------------------------------------------------------------ the place */
  const placeStep = (value: NeedLocationReview, options: { saved?: boolean; loading?: boolean } = {}) =>
    <LocationScreen title="Mesto zadatka" onBack={toList} loading={!!options.loading} onRetry={noop} scroll={false}>
      {options.saved ? <View style={s.saved}>
        <T accessibilityRole="alert" variant="body">Lokacija je sačuvana u pregledu zadatka.</T>
        <V2Action label="Nazad na pregled" kind="secondary" onPress={toList} />
      </View> : null}
      <NeedLocationForm layout="screen" reviewOnly={!options.saved} review={value} busy={false} uncertain={false} onSave={noop}
        resolver={RESOLVER} countries={COUNTRIES} />
    </LocationScreen>;

  /* ------------------------------------------------------------------------------------------------ the photos */
  const LIMITS = 'Do 6 fotografija, do 10 MB po slici. Uklanjamo metapodatke i smanjujemo slike. Nacrt vidiš samo ti; fotografije postaju dostupne uz objavljen zadatak.';
  const photos = (tiles: PhotoTileState[], options: { status?: { text: string; tone: 'progress' | 'success' | 'error' | 'info' }; reason?: string | null;
    working?: boolean; unconfirmed?: boolean; body?: ReactNode } = {}) => {
    const addDisabled = !!options.reason || !!options.working;
    const ready = tiles.filter(tile => 'assetId' in tile).length;
    return <SettingsScreen title="Fotografije zadatka" onBack={toList} footer={<>
      <SettingsAction label="Izaberi iz galerije" loading={!!options.working} disabled={addDisabled} reason={options.working ? null : options.reason} onPress={noop} />
      <SettingsAction label="Fotografiši" kind="secondary" disabled={addDisabled} reason={options.working ? null : options.reason} onPress={noop} />
    </>}>
      {options.body ?? <>
        {options.status ? <PhotoStatus text={options.status.text} tone={options.status.tone} /> : null}
        {ready ? <SettingsText variant="meta" tone="muted">{`${ready} ${ready === 1 ? 'fotografija' : ready < 5 ? 'fotografije' : 'fotografija'} od 6`}</SettingsText> : null}
        {tiles.length ? <PhotoGrid>{tile => tiles.map((state, i) => <PhotoTile key={i} index={i} size={tile} state={state}
          removeDisabled={!!options.working || !!options.unconfirmed}
          onRemove={state.kind === 'READY' || state.kind === 'FAILED' ? () => confirm.ask({ title: 'Ukloniti fotografiju?',
            message: 'Fotografija se uklanja iz nacrta zadatka.', confirmLabel: 'Ukloni', tone: 'danger', onConfirm: noop }) : undefined}
          picture={state.kind === 'READY' ? <Picture /> : undefined} />)}</PhotoGrid> : null}
        {options.unconfirmed ? <>
          <SettingsAction label="Nastavi slanje iste fotografije" kind="secondary" onPress={noop} />
          <SettingsAction label="Odustani od nepotvrđenog slanja" kind="quiet" onPress={noop} />
          <SettingsAction label="Osveži i proveri fotografije" kind="quiet" onPress={noop} />
        </> : null}
      </>}
      <PhotosPrivacyNote limits={LIMITS} />
      {confirm.sheet}
    </SettingsScreen>;
  };
  const READY = (n: number): PhotoTileState[] => Array.from({ length: n }, (_, i) => ({ kind: 'READY', assetId: `galerija-${i}` }));

  const body = scene === 'pregled-spremno' ? review({})
    : scene === 'pregled-jos-treba' ? review({ todos })
    : scene === 'pregled-objavljuje' ? review({ working: true })
    : scene === 'pregled-objavljeno' ? review({ status: { published: true, text: 'Zadatak je objavljen.' },
      command: <V2Action label="Otvori zadatak" style={brandAction} onPress={noop} /> })
    : scene === 'pregled-nacrt' ? review({ status: { published: false, text: 'Sačuvano kao privatan nacrt. Zadatak nije objavljen.' }, command: <>
      <V2Action label="Objavi ovaj nacrt" style={brandAction} onPress={noop} />
      <V2Action label="Proveri stanje nacrta" onPress={noop} />
      <V2Action label="Otvori moje zadatke" kind="quiet" onPress={noop} />
    </> })
    : scene === 'pregled-ishod' ? review({ status: { published: false, text: 'Objava još nije potvrđena. Proveri ishod pre novog pokušaja.' },
      error: 'Ishod objave nije potvrđen.', command: <>
        <V2Action label="Učitaj pregled i proveri ishod" onPress={noop} />
        <V2Action label="Proveri objavu" onPress={noop} />
      </> })
    : scene === 'pregled-ucitavanje' ? review({ loading: true })
    : scene === 'pregled-greska' ? review({ failure: true })
    : scene === 'pregled-veliki' ? review({ large: true })
    : scene === 'mesto-pregled-rute' || scene === 'mesto-pregled-vise' ? <SettingsScreen title="Potvrđena mesta · primer" onBack={toList}>
      <SettingsText>Probne tačke za pregled mape. Ništa se ne čuva niti objavljuje.</SettingsText>
      <LocationMapPreview points={MAP_POINTS} scopeKey={`galerija:${scene}`} route={scene === 'mesto-pregled-rute'} />
    </SettingsScreen>
    : scene === 'mesto-forma' ? placeStep(place({ resolvedLocation: FIXED_POINT }))
    : scene === 'mesto-ruta' ? placeStep(place({ geography: { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad', area: 'Liman 2' }, end: { city: 'Beograd', area: 'Vračar' } } }))
    : scene === 'mesto-daljina' ? placeStep(place({ geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null }))
    : scene === 'mesto-zakljucano' ? placeStep(place({}, false))
    : scene === 'mesto-sacuvano' ? placeStep(place({ resolvedLocation: FIXED_POINT }), { saved: true })
    : scene === 'mesto-ucitavanje' ? placeStep(place(), { loading: true })
    : scene === 'foto-mreza' ? photos([...READY(2), { kind: 'PROCESSING', assetId: 'p' }, { kind: 'FAILED', assetId: 'f' }],
      { status: { text: 'Fotografija je dodata privatnom nacrtu.', tone: 'success' } })
    : scene === 'foto-salje' ? photos([...READY(2), { kind: 'SENDING' }], { status: { text: 'Šaljemo fotografiju…', tone: 'progress' }, working: true })
    : scene === 'foto-nepotvrdjeno' ? photos([...READY(2), { kind: 'UNCONFIRMED' }], { unconfirmed: true,
      status: { text: 'Slanje nije primljeno. Možeš da pošalješ istu fotografiju ponovo ili da odustaneš od slanja.', tone: 'error' },
      reason: 'Prvo završi ili otkaži nepotvrđeno slanje.' })
    : scene === 'foto-puno' ? photos(READY(6), { reason: 'Dodato je najviše fotografija. Ukloni jednu da dodaš drugu.' })
    : scene === 'foto-prazno' ? photos([], { body: <StateView kind="empty" art="photo" title="Još nema fotografija" /> })
    : scene === 'foto-ucitavanje' ? photos([], { reason: 'Fotografije još nisu učitane.', body: <PhotosLoading /> })
    : scene === 'foto-greska' ? photos([], { reason: 'Fotografije još nisu učitane.', body: <StateView kind="error" art="photo" title="Fotografije nisu učitane"
      body="Fotografije trenutno nisu dostupne. Proveri vezu i pokušaj ponovo." primary={{ label: 'Osveži i proveri fotografije', onPress: noop }} /> })
    : scene === 'foto-ukloni' ? photos(READY(3))
    : null;
  return <View style={s.screen}>{body}</View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  list: { padding: sys.space.lg, gap: sys.space.sm, paddingBottom: sys.space.huge },
  group: { color: sys.color.muted, marginTop: sys.space.base, marginBottom: sys.space.xs },
  row: { minHeight: 56, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: sys.color.line },
  picture: { backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.control, alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  saved: { ...inset, backgroundColor: sys.color.greenSoft, gap: sys.space.md, marginHorizontal: sys.space.lg, marginTop: sys.space.base },
});
