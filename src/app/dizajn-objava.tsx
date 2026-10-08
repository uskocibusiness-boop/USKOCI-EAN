import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import type { MarketConfig } from '../contracts/market';
import type { NeedLocationReview } from '../contracts/location';
import type { PotrebaProjekcija } from '../contracts/projections';
import type { NeedPublicationReadiness } from '../data/needPublicationReadiness';
import type { createConfiguredLocationResolver } from '../data/configuredLocationResolver';
import { NeedLocationForm } from '../ui/location/NeedLocationForm';
import { LocationMapPreview } from '../ui/location/LocationMapPreview';
import { LocationScreen } from '../ui/location/LocationControls';
import { OwnerPlaces, PrivatePlace, PublicPlace, PublishButton, ReviewDeadline, ReviewEmptyFacts, ReviewFactRow, ReviewFrame, ReviewPhotos,
  ReviewPreview, ReviewSection, ReviewStatus, ReviewTodoList, ReviewWaysOut, type TodoRow } from '../ui/objava/ReviewPresentation';
import { PublishedMoment } from '../ui/objava/PublishedMoment';
import { PhotoGrid, PhotoStatus, PhotoTile, PhotosLoading, PhotosPrivacyNote, type PhotoTileState } from '../ui/objava/TaskPhotosPresentation';
import { PHOTO_LIMIT, PHOTO_WORDS, photoCount } from '../ui/media/photoWords';
import { CHECK_SPOKEN, OUTCOME_ACTION, UNCERTAIN_ABOUT, cannotLoad } from '../ui/system/outcomeCopy';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { FactArt } from '../ui/system/FactArt';
import { FlowFooter } from '../ui/system/FlowFooter';
import { ListRow } from '../ui/system/ListRow';
import { layout } from '../ui/system/layout';
import { Screen } from '../ui/system/Screen';
import { Section } from '../ui/system/Section';
import { StateView } from '../ui/system/StateView';
import { SuccessMark } from '../ui/system/SuccessMark';
import { Surface } from '../ui/system/Surface';
import { useConfirmSheet } from '../ui/system/ConfirmSheet';
import { LARGE_LAYOUT, LayoutClassOverride } from '../ui/system/textScale';
import { brandAction, sys } from '../ui/system/tokens';
import type { Summary } from '../ui/v2/draftSummary';
import { NeedPresentation } from '../ui/v2/NeedPresentation';
import { noApplicationsHelp } from '../ui/v2/ownTaskOverview';
import { V2Action } from '../ui/v2/V2Action';
import { T } from '../ui/Text';

/**
 * The publish review, the task's place and its photos, and the moment "Objavljeno", on the real phone or emulator and in the design lab, in
 * every state the lead photographs. Reached only by its address (uskociapp://dizajn-objava) in the internal build; the store
 * package shows nothing. The real presentation parts draw fixture data: nothing here reads or writes anything. Every
 * command is a no-op; the address search answers that it is not activated, and a photo is a quiet stand-in, so no
 * media is read. Only the map's public tiles load, as they do on every map. The saved-point map scenes use the
 * production preview with public fixture coordinates; external map links launch only if explicitly pressed.
 *
 * The review is drawn with the route's own frame (`ReviewFrame`), parts and foot, in the order the route draws them; "Veliki tekst" is the
 * same screen under `LayoutClassOverride` (the lab has no text scale of its own), and "Dugi nazivi" the longest words a task can have.
 */
type Scene = { key: string; group: string; label: string };
const SCENES: Scene[] = [
  { key: 'pregled-spremno', group: 'Pregled pre objave', label: 'Spremno za objavu' },
  { key: 'pregled-jos-treba', group: 'Pregled pre objave', label: 'Još treba' },
  { key: 'pregled-objavljuje', group: 'Pregled pre objave', label: 'Objavljuje se' },
  { key: 'pregled-objavljeno', group: 'Pregled pre objave', label: 'Objavljeno' },
  { key: 'pregled-nacrt', group: 'Pregled pre objave', label: 'Privatan nacrt' },
  { key: 'pregled-ishod', group: 'Pregled pre objave', label: 'Ishod nije potvrđen' },
  { key: 'pregled-izmene', group: 'Pregled pre objave', label: 'Izmena objavljenog zadatka' },
  { key: 'pregled-dugo', group: 'Pregled pre objave', label: 'Dugi nazivi' },
  { key: 'pregled-ucitavanje', group: 'Pregled pre objave', label: 'Učitavanje' },
  { key: 'pregled-greska', group: 'Pregled pre objave', label: 'Greška (bez veze)' },
  { key: 'pregled-veliki', group: 'Pregled pre objave', label: 'Veliki tekst' },
  { key: 'nacrt-spreman', group: 'Nacrt i moj zadatak', label: 'Nacrt spreman za pregled' },
  { key: 'nacrt-mesto', group: 'Nacrt i moj zadatak', label: 'Nacrt kome fali mesto' },
  { key: 'nacrt-ceka', group: 'Nacrt i moj zadatak', label: 'Nacrt čeka obradu fotografija' },
  { key: 'moj-bez-prijava', group: 'Nacrt i moj zadatak', label: 'Objavljen, bez prijava 24 sata' },
  { key: 'moj-nema-prijava', group: 'Nacrt i moj zadatak', label: 'Objavljen, još nema prijava' },
  { key: 'moj-prijave', group: 'Nacrt i moj zadatak', label: 'Objavljen, prijave čekaju izbor' },
  { key: 'moj-ponude', group: 'Nacrt i moj zadatak', label: 'Tražim ponude, dve prijave' },
  { key: 'moj-delimicno', group: 'Nacrt i moj zadatak', label: 'Treba troje, jedan dogovoren' },
  { key: 'moj-zatvorena-potraga', group: 'Nacrt i moj zadatak', label: 'Dogovoreno, potraga zatvorena' },
  // "Objavljen pre 2 sata": the page is ready to say it, but the owner's read of a task does not carry the time yet (TRAŽI SERVER: publishedAt), so on the phone it is not said.
  { key: 'moj-objavljen-pre', group: 'Nacrt i moj zadatak', label: 'Objavljen pre 2 sata (kad server pošalje vreme)' },
  { key: 'moj-dogovoren', group: 'Nacrt i moj zadatak', label: 'Dogovoren' },
  { key: 'moj-dugo', group: 'Nacrt i moj zadatak', label: 'Dugi nazivi' },
  { key: 'moj-ucitavanje', group: 'Nacrt i moj zadatak', label: 'Učitavanje' },
  { key: 'moj-greska', group: 'Nacrt i moj zadatak', label: 'Zadatak nije dostupan' },
  { key: 'moj-veliki', group: 'Nacrt i moj zadatak', label: 'Veliki tekst' },
  { key: 'trenutak', group: 'Objavljeno', label: 'Trenutak posle objave' },
  { key: 'trenutak-izmene', group: 'Objavljeno', label: 'Trenutak posle izmene' },
  { key: 'mesto-forma', group: 'Mesto zadatka', label: 'Izmena mesta' },
  { key: 'mesto-ruta', group: 'Mesto zadatka', label: 'Od mesta do mesta' },
  { key: 'mesto-pregled-rute', group: 'Mesto zadatka', label: 'Pregled potvrđene putanje' },
  { key: 'mesto-pregled-vise', group: 'Mesto zadatka', label: 'Više potvrđenih mesta' },
  { key: 'mesto-daljina', group: 'Mesto zadatka', label: 'Rad na daljinu' },
  { key: 'mesto-zakljucano', group: 'Mesto zadatka', label: 'Nije dostupno za izmene' },
  { key: 'mesto-sacuvano', group: 'Mesto zadatka', label: 'Sačuvano (stari put)' },
  { key: 'mesto-ucitavanje', group: 'Mesto zadatka', label: 'Učitavanje' },
  { key: 'mesto-veliki', group: 'Mesto zadatka', label: 'Veliki tekst' },
  { key: 'foto-mreza', group: 'Fotografije zadatka', label: 'Mreža i stanja' },
  { key: 'foto-salje', group: 'Fotografije zadatka', label: 'Slanje u toku' },
  { key: 'foto-nepotvrdjeno', group: 'Fotografije zadatka', label: 'Slanje nije potvrđeno' },
  { key: 'foto-puno', group: 'Fotografije zadatka', label: 'Šest fotografija' },
  { key: 'foto-prazno', group: 'Fotografije zadatka', label: 'Prazno' },
  { key: 'foto-ucitavanje', group: 'Fotografije zadatka', label: 'Učitavanje' },
  { key: 'foto-greska', group: 'Fotografije zadatka', label: 'Greška čitanja' },
  { key: 'foto-veliki', group: 'Fotografije zadatka', label: 'Veliki tekst' },
  { key: 'foto-ukloni', group: 'Fotografije zadatka', label: 'Pitanje pre uklanjanja' },
];

const noop = () => {};
const SUMMARY: Summary = { title: 'Prenos ormara na treći sprat bez lifta', zone: 'Novi Sad · Liman 2',
  schedule: '27. sep · 10:00–12:00', value: { kind: 'amount', amount: '4.500 RSD', basis: 'ukupno' }, people: '2 osobe' };
const LONG_TITLE = 'Prenos klavira, dve garderobe i radnog stola iz stana na trećem spratu bez lifta u Novom Sadu do kuće u Sremskoj Kamenici';
const LONG_SUMMARY: Summary = { title: LONG_TITLE, zone: 'Novi Sad · Grbavica → Sremska Kamenica',
  schedule: '27. sep · 10:00–12:00 (po vremenu u Srbiji)', value: { kind: 'amount', amount: '18.000 RSD', basis: 'po osobi' }, people: '14 osoba' };
const ANCHOR = { latitude: 45.24, longitude: 19.84 };
/** The owner's own task, as the owner-only read returns it: a private draft by default. */
const OWN_TASK: PotrebaProjekcija = { id: 'galerija-zadatak', revizija: 1, naslov: 'Prenos ormara na treći sprat bez lifta',
  opis: 'Orman je rasklopljen, treba ga uneti na treći sprat. Zgrada nema lift, stepenište je široko.', stanje: 'NACRT',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: '27. sep · 10:00–12:00', podrucjeTekst: 'Novi Sad · Liman 2',
  priblizno: { lat: 45.24, lng: 19.84 }, uslovi: ['Kaiševi za nameštaj', 'Dve osobe'], brojPrijava: 0, brojPrijavaZaIzbor: 0, rezimCene: 'MY_PRICE',
  osnovaCene: 'TOTAL', ponudjenaCena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' } };
const HELD = (code: string): NeedPublicationReadiness => ({ kind: 'NOT_READY', code, missingSlots: ['start'] });
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
const LONG_DESCRIPTION = 'Klavir je uspravni, težak oko 250 kilograma, a garderobe su rasklopljive ali sa staklenim vratima koja moraju posebno da se upakuju. '
  + 'Zgrada nema lift, stepenište je široko i ima dva odmorišta. Parking ispred ulaza je slobodan do podne.';

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
  if (!scene) return <Screen kind="detail" header={<DetailTopBar title="Galerija: objava zadatka" onBack={() => router.back()} backLabel="Zatvori galeriju" />}>
    <T variant="note" tone="muted">Primeri stanja sa izmišljenim podacima. Ništa se ne čita i ne šalje.</T>
    {SCENES.filter((item, index) => index === 0 || SCENES[index - 1].group !== item.group).map(first => <Section key={first.group} title={first.group}>
      {SCENES.filter(item => item.group === first.group).map((item, index, all) => <ListRow key={item.key} title={item.label}
        accessibilityLabel={`${item.group}: ${item.label}`} last={index === all.length - 1} onPress={() => setScene(item.key)} />)}
    </Section>)}
  </Screen>;

  /* ------------------------------------------------------------------------------------------------ the review */
  const review = (options: { todos?: TodoRow[]; status?: { published: boolean; text: string; action?: ReactNode }; command?: ReactNode; working?: boolean;
    loading?: boolean; failure?: boolean; error?: string; summary?: Summary; long?: boolean; revising?: boolean; large?: boolean }) => {
    const todos = options.todos ?? [];
    const blocked = !!todos.length || !!options.working || !!options.error;
    const summary = options.summary ?? SUMMARY;
    const body = options.loading ? <StateView kind="loading" title="Pripremamo pregled…" skeleton={{ count: 1, rows: 3, variant: 'preview' }} />
      : options.failure ? <StateView kind="error" art="document" title={cannotLoad('pregled').title} body={cannotLoad('pregled').copy}
        primary={{ label: OUTCOME_ACTION.retry, onPress: noop }} />
      : <>
        {options.status ? <ReviewStatus published={options.status.published} fresh={false} text={options.status.text} action={options.status.action} /> : null}
        <ReviewPreview summary={todos.length ? { ...summary, value: null } : summary} unpriced={!!todos.length} />
        {todos.length ? <ReviewTodoList items={todos} disabled={false} /> : null}
        <ReviewSection title="Mesto" spaced action={options.command ? undefined : { label: todos.length ? 'Dodaj mesto' : 'Uredi mesto', onPress: noop }}>
          <PublicPlace zone={summary.zone} lines={options.long ? ['Polazište: Grbavica · Novi Sad', 'Odredište: Sremska Kamenica · Novi Sad'] : []}
            anchor={todos.length ? null : ANCHOR} scopeKey="galerija:pregled" pointsConfirmed={!todos.length} />
          <PrivatePlace>
            <OwnerPlaces places={todos.length ? [] : [{ slot: 'start', title: 'Mesto', text: 'Bulevar oslobođenja 12, Novi Sad' }]} />
            <ReviewFactRow label="Tačna adresa" value="Bulevar oslobođenja 12, stan 7" system={false} edit={options.command ? undefined : noop} />
            <ReviewFactRow label="Pristup" value="Interfon 7, treći sprat" system={false} edit={options.command ? undefined : noop} last />
          </PrivatePlace>
        </ReviewSection>
        <ReviewSection title="Detalji">
          <View>
            <ReviewFactRow label="Naslov" value={summary.title ?? ''} system={false} edit={options.command ? undefined : noop} />
            <ReviewFactRow label="Opis" value={options.long ? LONG_DESCRIPTION : 'Orman je rasklopljen, treba ga uneti na treći sprat. Zgrada nema lift, stepenište je široko.'}
              system={false} edit={options.command ? undefined : noop} />
            <ReviewFactRow label="Broj ljudi" value={options.long ? '14' : '2'} system={false} edit={options.command ? undefined : noop} />
            <ReviewFactRow label="Početak" value="27. sep · 10:00" system={false} edit={options.command ? undefined : noop} />
            <ReviewFactRow label="Iznos" value={options.long ? '18.000 RSD' : '4.500 RSD'} system={false} edit={options.command ? undefined : noop} />
            <ReviewEmptyFacts labels={['Alati', 'Vozila']} onOpen={noop} />
          </View>
        </ReviewSection>
        <ReviewSection title="Fotografije" action={options.command ? undefined : { label: 'Uredi fotografije', onPress: noop }}>
          <ReviewPhotos assetIds={['a', 'b', 'c', 'd']} picture={(_, size) => <Picture size={size} />} />
        </ReviewSection>
        <ReviewSection title="Prijave" action={options.command ? undefined : { label: 'Uredi rok za prijave', onPress: noop }}>
          <ReviewDeadline text={null} />
        </ReviewSection>
        {options.command ? null : <ReviewWaysOut disabled={false} onEdit={noop} onDelete={options.revising ? undefined : () => confirm.ask({
          title: `Obrisati nacrt „${summary.title}“?`, confirmLabel: 'Obriši nacrt', tone: 'danger',
          message: 'Zadatak se neće objaviti, a razgovor o njemu više ne možeš da nastaviš.', onConfirm: noop })} />}
      </>;
    const reason = todos.length ? 'Prvo uradi ono što piše pod „Još treba“.' : undefined;
    const footer = options.loading || options.failure ? null : <FlowFooter reason={options.command ? undefined : reason}>
      {options.error ? <T accessibilityRole="alert" style={s.error}>{options.error}</T> : null}
      {options.command ?? <>
        <PublishButton label={options.revising ? 'Potvrdi izmene i objavi' : 'Objavi zadatak'} blocked={blocked} working={!!options.working}
          reason={todos.length ? reason : null} onPress={noop} />
        {options.revising || todos.length ? null : <V2Action label="Sačuvaj nacrt" kind="quiet" disabled={!!options.working} onPress={noop} />}
      </>}
    </FlowFooter>;
    const frame = <ReviewFrame footer={footer}
      header={<DetailTopBar backLabel="Nazad" onBack={toList} title={options.status?.published ? 'Objavljeno' : options.revising ? 'Pregled izmena' : 'Pregled zadatka'} />}>
      {body}
    </ReviewFrame>;
    return <>{options.large ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{frame}</LayoutClassOverride.Provider> : frame}{confirm.sheet}</>;
  };
  const todos: TodoRow[] = [
    { key: 'missing', text: 'Nedostaje: Broj ljudi.', onPress: noop, actionLabel: 'Dopuni u razgovoru' },
    { key: 'location', text: 'Mesto na mapi nije potvrđeno.', onPress: noop, actionLabel: 'Dodaj mesto' },
    { key: 'fact', text: 'Unesi iznos ili izaberi prikupljanje ponuda.', onPress: noop, actionLabel: 'Unesi iznos' },
  ];

  /* ------------------------------------------------------------------------------------------------ the place */
  const placeStep = (value: NeedLocationReview, options: { saved?: boolean; loading?: boolean } = {}) =>
    <LocationScreen title="Mesto zadatka" onBack={toList} loading={!!options.loading} onRetry={noop} scroll={false}>
      {options.saved ? <View style={s.savedFrame}><Surface kind="note" style={s.saved}>
        <View style={s.savedRow}><SuccessMark fresh size={32} />
          <T accessibilityRole="alert" variant="body" style={s.grow}>Mesto je sačuvano u pregledu zadatka.</T></View>
        <V2Action label="Nazad na pregled" kind="secondary" onPress={toList} />
      </Surface></View> : null}
      <NeedLocationForm layout="screen" reviewOnly={!options.saved} review={value} busy={false} uncertain={false} onSave={noop}
        resolver={RESOLVER} countries={COUNTRIES} />
    </LocationScreen>;

  /* ------------------------------------------------------------------------------------------------ the photos */
  const LIMITS = 'Do 6 fotografija, do 10 MB po slici. Uklanjamo metapodatke i smanjujemo slike. Nacrt vidiš samo ti; fotografije postaju dostupne uz objavljen zadatak.';
  const photos = (tiles: PhotoTileState[], options: { status?: { text: string; tone: 'progress' | 'success' | 'error' | 'info' }; reason?: string | null;
    working?: boolean; unconfirmed?: boolean; body?: ReactNode; noFoot?: boolean } = {}) => {
    const addDisabled = !!options.reason || !!options.working;
    const ready = tiles.filter(tile => 'assetId' in tile).length;
    // As in the route: nothing is added to a draft that cannot be read, so its error has no foot.
    const footer = options.noFoot ? undefined : <FlowFooter reason={options.working ? undefined : options.reason ?? undefined}>
      <V2Action label={PHOTO_WORDS.add} style={brandAction} loading={!!options.working} disabled={addDisabled} onPress={noop} />
    </FlowFooter>;
    return <Screen kind="detail" header={<DetailTopBar title="Fotografije zadatka" onBack={toList} />} footer={footer}>
      {options.body ?? <>
        {options.status ? <PhotoStatus text={options.status.text} tone={options.status.tone} /> : null}
        {tiles.length ? <Section title={`${photoCount(ready)} od ${PHOTO_LIMIT}`}>
          <View style={s.block}>
            <PhotoGrid>{tile => tiles.map((state, i) => <PhotoTile key={i} index={i} size={tile} state={state}
              removeDisabled={!!options.working || !!options.unconfirmed}
              onRemove={state.kind === 'READY' || state.kind === 'FAILED' ? () => confirm.ask({ title: 'Ukloniti fotografiju?',
                message: 'Fotografija se uklanja iz nacrta zadatka.', confirmLabel: 'Ukloni', tone: 'danger', onConfirm: noop }) : undefined}
              picture={state.kind === 'READY' ? <Picture /> : undefined} />)}</PhotoGrid>
            {options.unconfirmed ? <View style={s.recovery}>
              <V2Action tone="neutral" kind="secondary" compact label={PHOTO_WORDS.retry} onPress={noop} />
              <V2Action tone="neutral" kind="quiet" compact label={PHOTO_WORDS.cancel} onPress={noop} />
              <V2Action tone="neutral" kind="quiet" compact label={OUTCOME_ACTION.check} accessibilityLabel={PHOTO_WORDS.check} onPress={noop} />
            </View> : null}
          </View>
        </Section> : null}
      </>}
      <PhotosPrivacyNote limits={LIMITS} />
      {confirm.sheet}
    </Screen>;
  };
  const READY = (n: number): PhotoTileState[] => Array.from({ length: n }, (_, i) => ({ kind: 'READY', assetId: `galerija-${i}` }));

  /* ------------------------------------------------------------------------------------------------ the owner's own task */
  const mine = (options: { need?: Partial<PotrebaProjekcija>; readiness?: NeedPublicationReadiness | null; loading?: boolean; missing?: boolean;
    error?: string | null; waiting?: boolean; large?: boolean; closed?: boolean; publishedAt?: string }) => {
    const need: PotrebaProjekcija | null = options.missing ? null : { ...OWN_TASK, ...options.need };
    const draft = need?.stanje === 'NACRT';
    const view = <NeedPresentation need={need} loading={!!options.loading} error={options.error ?? null} busy={false} remainingClosed={!!options.closed}
      onBack={toList} onRefresh={noop} onReview={noop} onEdit={noop} onCloseRemaining={noop} onCandidates={noop} onAgreements={noop}
      readiness={options.readiness ?? (draft ? { kind: 'READY' } : null)} onDeleteDraft={draft ? noop : undefined}
      publishedAt={options.publishedAt ?? null} now={new Date('2026-10-08T12:00:00Z')}
      lifecycleMenu={need && need.stanje !== 'NACRT' && need.stanje !== 'ZATVORENA' && need.pokrivenost.popunjeno === 0
        ? [{ key: 'cancel', label: 'Otkaži zadatak', icon: 'tasks', destructive: true, onPress: noop }] : []}
      waitingHelp={options.waiting && need ? noApplicationsHelp({ need, publishedAt: '2020-01-01T08:00:00Z', photoCount: 0, canShare: true, canEdit: true, on: true }) : null}
      onWaitingHelp={noop}
      map={need?.priblizno ? <LocationMapPreview points={[{ id: 'area', label: 'Približno mesto', latitude: need.priblizno.lat, longitude: need.priblizno.lng }]}
        coarse height={184} scopeKey="galerija:moj-zadatak" /> : undefined} />;
    return options.large ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{view}</LayoutClassOverride.Provider> : view;
  };

  const moment = (revising: boolean) => <PublishedMoment title={revising ? 'Izmene su objavljene.' : 'Zadatak je objavljen.'} onContinue={toList} />;

  const body = scene === 'pregled-spremno' ? review({})
    : scene === 'pregled-jos-treba' ? review({ todos })
    : scene === 'pregled-objavljuje' ? review({ working: true })
    : scene === 'pregled-objavljeno' ? review({ status: { published: true, text: 'Zadatak je objavljen.' },
      command: <V2Action label="Otvori zadatak" style={brandAction} onPress={noop} /> })
    : scene === 'pregled-nacrt' ? review({ status: { published: false, text: 'Sačuvano kao privatan nacrt. Zadatak nije objavljen.',
      action: <V2Action label={OUTCOME_ACTION.refresh} accessibilityLabel="Osveži pregled" kind="quiet" style={s.noteAction} onPress={noop} /> }, command: <>
      <V2Action label="Objavi ovaj nacrt" style={brandAction} onPress={noop} />
      <V2Action label="Otvori moje zadatke" kind="quiet" onPress={noop} />
    </> })
    : scene === 'pregled-ishod' ? review({ status: { published: false, text: `${UNCERTAIN_ABOUT.publication.title}.` },
      command: <V2Action label={OUTCOME_ACTION.check} accessibilityLabel={CHECK_SPOKEN} style={brandAction} onPress={noop} /> })
    : scene === 'pregled-izmene' ? review({ revising: true })
    : scene === 'pregled-dugo' ? review({ summary: LONG_SUMMARY, long: true })
    : scene === 'pregled-ucitavanje' ? review({ loading: true })
    : scene === 'pregled-greska' ? review({ failure: true })
    : scene === 'pregled-veliki' ? review({ large: true, todos: todos.slice(0, 1) })
    : scene === 'nacrt-spreman' ? mine({})
    : scene === 'nacrt-mesto' ? mine({ readiness: HELD('LOCATION_INCOMPLETE') })
    : scene === 'nacrt-ceka' ? mine({ readiness: HELD('PUBLIC_MEDIA_NOT_READY') })
    : scene === 'moj-bez-prijava' ? mine({ waiting: true, need: { stanje: 'OBJAVLJENA', schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-27T10:00:00+02:00', endsAt: '2026-09-27T12:00:00+02:00' } } })
    // One block of state on top and nothing else about it: "Još nema prijava", or the faces and the count with the one green action.
    : scene === 'moj-nema-prijava' ? mine({ need: { stanje: 'OBJAVLJENA' } })
    : scene === 'moj-prijave' ? mine({ need: { stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 3 } })
    // "Tražim ponude" is a fact with its picture, and what it means is behind the small ⓘ, not under the word.
    : scene === 'moj-ponude' ? mine({ need: { stanje: 'CEKA_PRIJAVE', rezimCene: 'OFFERS', osnovaCene: null, ponudjenaCena: undefined, brojPrijava: 2, brojPrijavaZaIzbor: 2 } })
    // How many people the task needs is said only when it is more than one ("Treba 3 osobe"); one is agreed, two are still to choose among four applications.
    : scene === 'moj-delimicno' ? mine({ need: { stanje: 'DELIMICNO_POPUNJENA', pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 },
      osnovaCene: 'PER_PERSON', brojPrijava: 4, brojPrijavaZaIzbor: 2 } })
    : scene === 'moj-objavljen-pre' ? mine({ publishedAt: '2026-10-08T10:00:00Z', need: { stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 3 } })
    // The owner stopped looking for the rest: one place is agreed and the search for the other is closed, said once in one line.
    : scene === 'moj-zatvorena-potraga' ? mine({ closed: true, need: { stanje: 'POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 }, brojPrijava: 2, brojPrijavaZaIzbor: 0 } })
    : scene === 'moj-dogovoren' ? mine({ need: { stanje: 'POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 } } })
    : scene === 'moj-dugo' ? mine({ need: { naslov: LONG_TITLE, podrucjeTekst: 'Novi Sad · Grbavica → Sremska Kamenica', rezimCene: 'OFFERS',
      vremeTekst: '27. sep · 10:00–12:00 (po vremenu u Srbiji)', opis: LONG_DESCRIPTION, uslovi: ['Kombi sa najmanje 12 m³ tovarnog prostora', 'Kaiševi za klavir',
        'Iskustvo sa selidbom osetljivih instrumenata', 'Dve osobe za nošenje'] } })
    : scene === 'moj-ucitavanje' ? mine({ loading: true, missing: true })
    : scene === 'moj-greska' ? mine({ missing: true, error: 'Zadatak trenutno nije moguće učitati. Proveri vezu i pokušaj ponovo.' })
    : scene === 'moj-veliki' ? mine({ large: true, need: { stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 3 } })
    : scene === 'trenutak' ? moment(false)
    : scene === 'trenutak-izmene' ? moment(true)
    : scene === 'mesto-pregled-rute' || scene === 'mesto-pregled-vise' ? <Screen kind="detail" header={<DetailTopBar title="Potvrđena mesta · primer" onBack={toList} />}>
      <T variant="note" tone="muted">Probne tačke za pregled mape. Ništa se ne čuva niti objavljuje.</T>
      <LocationMapPreview points={MAP_POINTS} scopeKey={`galerija:${scene}`} route={scene === 'mesto-pregled-rute'} />
    </Screen>
    : scene === 'mesto-forma' ? placeStep(place({ resolvedLocation: FIXED_POINT }))
    : scene === 'mesto-ruta' ? placeStep(place({ geography: { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad', area: 'Liman 2' }, end: { city: 'Beograd', area: 'Vračar' } } }))
    : scene === 'mesto-daljina' ? placeStep(place({ geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null }))
    : scene === 'mesto-zakljucano' ? placeStep(place({}, false))
    : scene === 'mesto-sacuvano' ? placeStep(place({ resolvedLocation: FIXED_POINT }), { saved: true })
    : scene === 'mesto-ucitavanje' ? placeStep(place(), { loading: true })
    : scene === 'mesto-veliki' ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{placeStep(place({ resolvedLocation: FIXED_POINT }))}</LayoutClassOverride.Provider>
    : scene === 'foto-mreza' ? photos([...READY(2), { kind: 'PROCESSING', assetId: 'p' }, { kind: 'FAILED', assetId: 'f' }],
      { status: { text: 'Fotografija je dodata privatnom nacrtu.', tone: 'success' } })
    : scene === 'foto-salje' ? photos([...READY(2), { kind: 'SENDING' }], { status: { text: 'Šaljemo fotografiju…', tone: 'progress' }, working: true })
    : scene === 'foto-nepotvrdjeno' ? photos([...READY(2), { kind: 'UNCONFIRMED' }], { unconfirmed: true,
      status: { text: 'Slanje još nije primljeno. Možeš da pošalješ istu fotografiju ponovo ili da odustaneš od slanja.', tone: 'error' },
      reason: 'Prvo završi ili otkaži nepotvrđeno slanje.' })
    : scene === 'foto-puno' ? photos(READY(6), { reason: 'Dodato je najviše fotografija. Ukloni jednu da dodaš drugu.' })
    : scene === 'foto-prazno' ? photos([], { body: <StateView kind="empty" art="photo" title="Još nema fotografija" body="Dodaj ih dugmetom ispod." /> })
    : scene === 'foto-ucitavanje' ? photos([], { reason: 'Fotografije još nisu učitane.', body: <PhotosLoading /> })
    : scene === 'foto-greska' ? photos([], { noFoot: true, body: <StateView kind="error" art="photo" title={cannotLoad('fotografije').title}
      body={cannotLoad('fotografije').copy} primary={{ label: OUTCOME_ACTION.retry, onPress: noop }} /> })
    : scene === 'foto-veliki' ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>
      {photos([...READY(2), { kind: 'PROCESSING', assetId: 'p' }, { kind: 'FAILED', assetId: 'f' }], { status: { text: 'Fotografija je dodata privatnom nacrtu.', tone: 'success' } })}
    </LayoutClassOverride.Provider>
    : scene === 'foto-ukloni' ? photos(READY(3))
    : null;
  return <View style={s.screen}>{body}</View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  error: { ...sys.type.meta, color: sys.color.danger },
  // Inside the status note the quiet action starts at the note's own edge (no padding of its own); the width keeps the 48 dp target and the label stays at the start of it.
  noteAction: { alignSelf: 'flex-start', paddingHorizontal: 0, minWidth: layout.touch, justifyContent: 'flex-start' },
  picture: { backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.control, alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  savedFrame: { paddingHorizontal: layout.gutter, paddingTop: sys.space.md },
  saved: { gap: sys.space.md },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  grow: { flex: 1 },
  block: { gap: layout.group },
  recovery: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
});
