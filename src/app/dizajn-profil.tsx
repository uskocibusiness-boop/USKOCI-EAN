import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler, Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import type { WorkerLocation } from '../contracts/location';
import type { MarketConfig } from '../contracts/market';
import type { JavniProfilProjekcija, StanjeProfila } from '../contracts/projections';
import { passwordChangeMessages } from '../data/passwordChangeClientService';
import type { WorkerAiReview } from '../data/workerAiClientService';
import type { ReviewTag } from '../data/reviewsClientService';
import type { MyWorkStats, PublicWorkTrust, ReceivedReview } from '../data/workTrustClientService';
import { inicijali } from '../lib/inicijali';
import { WorkerLocationForm } from './(app)/profil/lokacija';
import { DisplayNameForm, type NameSaveControl } from '../ui/profile/DisplayNameForm';
import { GalleryLargeText } from '../ui/profile/GalleryLargeText';
import { EDIT_PHOTO, NameSaveButton, ProfileFactRows, ProfilePhotoBlock, VisibilityNote, WorkNameNotice, type AboutView, type CityView } from '../ui/profile/ProfileEditPresentation';
import { hubWords, versionWord, type HubWords } from '../ui/profile/hubStates';
import { RatingLineView } from '../ui/profile/RatingLine';
import { ProfileHub, PROFILE_AVATAR, type ProfileHubIdentity } from '../ui/profile/ProfileHubPresentation';
import { workProfileSummary } from '../ui/profile/workProfileSummary';
import { ReliabilityFigure, type ProfileStatsState } from '../ui/profile/ProfileStats';
import { FinishedAgreements, type FinishedView } from '../ui/profile/ProfileWorkSummary';
import { ProfilePhotoEditor, type ProfilePhotoMode, type ProfilePhotoRunning, type ProfilePhotoStage } from '../ui/profile/ProfilePhotoPresentation';
import { ReputationFigure } from '../ui/reviews/AccountReputation';
import { AgreementReviewPresentation, type ReviewPerson, type ReviewView } from '../ui/reviews/AgreementReviewPresentation';
import { RatingsScreen, ReceivedRatings, GivenRatings, type GivenView, type RatingsTab, type ReceivedView } from '../ui/reviews/RatingsPresentation';
import { ReceivedReviewsList, type ReceivedReviewsView } from '../ui/reviews/ReceivedReviewsList';
import { ChangePasswordView, type ChangePasswordPhase } from '../ui/settings/ChangePasswordPresentation';
import { HeaderInfo } from '../ui/settings/InfoTitle';
import { SettingsScreen } from '../ui/settings/SettingsPresentation';
import { Avatar } from '../ui/system/Avatar';
import { useConfirmSheet } from '../ui/system/ConfirmSheet';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { ListRow } from '../ui/system/ListRow';
import { PublicProfileSheet } from '../ui/system/PublicProfileSheet';
import { Screen } from '../ui/system/Screen';
import { Section } from '../ui/system/Section';
import { StateView } from '../ui/system/StateView';
import { brandAction, sys } from '../ui/system/tokens';
import { V2Action } from '../ui/v2/V2Action';
import { Press } from '../ui/Press';
import { T } from '../ui/Text';
import { WorkerAiActivation, WorkerAiReviewDetails } from '../ui/workerProfile/WorkerAiPresentation';
import { WorkerProfileFooter, WorkerProfileForm, WorkerProfileFrame, WorkerProfileStatus,
  type WorkerActivationChecks } from '../ui/workerProfile/WorkerProfilePresentation';
import { workerDraft, type WorkerDraft } from '../ui/workerProfile/workerProfileDraft';
import { workerProfileInfoLines } from '../ui/workerProfile/workerProfileFacts';
import { BrandSceneReview } from '../ui/entry/BrandSceneReview';

/**
 * Profil, radni profil, fotografija, područje rada, ime (owner's step 9), in every state the lead photographs on the
 * emulator. Reached only by its address (uskociapp://dizajn-profil) in the internal build; the store package shows
 * nothing. The real presentation components draw fixture data: nothing here reads or writes an account, and every
 * command is a no-op (a form edits only its local copy). The first screen lists the scenes by name; every scene has a
 * "Nazad" laid over the top bar's empty right side (and the screen's own arrow, and Android Back) that returns to the
 * list. It floats rather than standing in a strip at the bottom, so the scene keeps the real screen's height and its
 * sticky footer sits where the real one does (review of step 9, 2026-09-24).
 *
 * One thing still comes from outside the phone: the map style and tiles, which load in every "Područje rada" scene that
 * has a country and a city (sačuvano, sa mapom, čuva se, ishod nepoznat, ponovno čitanje), as on the real screen. The
 * countries are fixtures and the area search is a stand-in that answers without a request.
 */
const noop = () => {};
const REVISION = 'a'.repeat(64);
const WORKER_PHOTO = require('../../assets/brand/entry-v49/worker.jpg');

const draft = (patch: Partial<WorkerDraft> = {}): WorkerDraft => ({ ...workerDraft(null), ime: 'Ana Petrović', grad: 'Novi Sad', radius: '20',
  vestine: ['Selidbe', 'Nošenje'], alati: ['Bušilica'], vozila: ['Kombi'], capacity: '2', capacityRevision: REVISION, dostupanOdmah: true, ...patch });
const READY: WorkerActivationChecks = { basics: true, area: true, capacity: true };
// A person with a lot of equipment (the owner's phone: "Alat · 10" and "Vozila · 12").
const KIT_TOOLS = ['Bušilica', 'Aku šrafilica', 'Brusilica', 'Ubodna testera', 'Merdevine', 'Nivelir', 'Čekić', 'Klešta', 'Metar', 'Radna lampa'];
const KIT_VEHICLES = ['Kombi', 'Kombi sa ceradom', 'Mali kamion', 'Kamion do 7,5 t', 'Putničko vozilo', 'Karavan', 'Pikap', 'Prikolica', 'Kolica za prevoz',
  'Bicikl sa prikolicom', 'Skuter za dostavu', 'Električni bicikl'];
const LONG = draft({ ime: 'Aleksandra Stefanović-Radosavljević',
  vestine: ['Selidbe stanova i kancelarija sa pakovanjem', 'Montaža i demontaža nameštaja po meri', 'Administrativna pomoć'],
  alati: ['Transportna kolica sa gumenim točkovima', 'Aku bušilica'], vozila: ['Kombi do 3,5 t sa ceradom'],
  biografija: 'Radim sa bratom već osam godina. Imamo kombi, trake i ćebad za zaštitu nameštaja; dolazimo tačno i ostavljamo čisto.' });

const COUNTRIES = { countries: [
  { countryCode: 'RS', productStatus: 'BUILDING', defaultCurrencyCode: 'RSD', defaultLanguageTag: 'sr-Latn', defaultTimezone: 'Europe/Belgrade' },
  { countryCode: 'BA', productStatus: 'LIVE', defaultCurrencyCode: 'BAM', defaultLanguageTag: 'bs', defaultTimezone: 'Europe/Sarajevo' },
  { countryCode: 'HR', productStatus: 'COMING', defaultCurrencyCode: 'EUR', defaultLanguageTag: 'hr', defaultTimezone: 'Europe/Zagreb' },
] as MarketConfig[], loading: false, error: null, refresh: async () => {} };
/** The area search answers at once, without a request: the stand-in says the provider is not switched on. */
const NO_SEARCH = { search: async () => ({ status: 'PROVIDER_ACTIVATION_BLOCKED' as const }), cancel: noop };
const PLACE = (patch: Partial<WorkerLocation> = {}): WorkerLocation => ({ accountId: 'galerija', profileId: 'galerija-profil', revision: 'galerija-1',
  operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20, approximatePosition: null, ...patch });

const REVIEW = { schemaVersion: 'WORKER_PROFILE_V1', reviewId: 'galerija', conversationId: 'galerija', accountId: 'galerija', profileId: 'galerija',
  revision: 1, activate: false, missingRequired: [], canAccept: true, expiresAt: '2026-09-24T12:00:00Z', displayedContentDigest: 'd'.repeat(64),
  profile: { displayName: 'Ana Petrović', bio: '', skills: ['Selidbe', 'Nošenje'], tools: ['Bušilica'], vehicles: [], licenses: [], teamCapacity: 2,
    location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20, approximatePosition: null },
    availability: { timezone: 'Europe/Belgrade', availableNow: true,
      rules: [{ id: 'r', weekdays: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '16:00', startsOn: '2026-09-24', endsOn: null, label: '', active: true }],
      windows: [{ id: 'w', startsAt: '2026-09-26T08:00:00Z', endsAt: '2026-09-26T12:00:00Z', state: 'AVAILABLE', label: 'Subota' }] } },
} as WorkerAiReview;

type Scene = { key: string; label: string; draw: () => ReactNode;
  /** Drawn at text scale 1.3 (the components are told "large"; the web lab also zooms the frame). */ large?: boolean;
  /** Drawn at the owner's own text scale, 1.15 (the web lab zooms the frame; the layout class stays the regular one). */ owner?: boolean };
type Group = { title: string; scenes: Scene[] };

/** The hub with a stand-in photo and rating; nothing is read. The work profile's line is the real summary function over a fixture. */
function Hub({ identity, capabilityDetail, capabilityNeedsAttention, busy = false, finished, stats, email, viewPublic = true, words = WORDS_A, version = VERSION }: {
  identity: ProfileHubIdentity; capabilityDetail?: string; capabilityNeedsAttention?: boolean; busy?: boolean; finished?: FinishedView; stats?: ProfileStatsState;
  email?: string; viewPublic?: boolean; words?: HubWords; version?: string }) {
  return <ProfileHub identity={identity} capabilityDetail={capabilityDetail} capabilityNeedsAttention={capabilityNeedsAttention} busy={busy}
    email={email} open={noop} onBack={toList.current} onLogout={noop} logoutError={false} onViewPublic={viewPublic ? noop : undefined}
    words={words} version={version}
    workSummary={finished ? <FinishedAgreements view={finished} onOpen={noop} onRefresh={noop} /> : undefined}
    stats={stats ? <ReliabilityFigure state={stats} /> : undefined} />;
}
/** What the server answers for the person's own funnel; the fixtures only vary the parts a scene is about. */
const STATS = (patch: Partial<MyWorkStats> = {}): ProfileStatsState => ({ kind: 'ready', stats: { hasWorkerProfile: true, profileId: 'galerija-profil', profileStatus: 'ACTIVE',
  applicationsSent: 14, agreementsMade: 12, agreementsCompleted: 9, agreementsActive: 1, cancelledByMe: 1, cancelledByRequester: 1, cancelledSideUnknown: 0,
  reliabilityPercent: 90, reliabilityState: 'AVAILABLE', reliabilityMinimum: 5, memberSince: '2026-10-01', asOf: '2026-10-08T09:00:00+00:00', ...patch } });
const FINISHED: FinishedView = { kind: 'ready', facts: [{ role: 'uskocer', count: 9 }, { role: 'narucilac', count: 3 }] };
// What the work profile's row says, from the same function the profile uses; the city is typed as people type it ("Novi sad").
const ACTIVE_LINE = workProfileSummary({ stanje: 'ACTIVE', vestine: ['Moleraj', 'Selidbe', 'Nošenje'], grad: 'Novi sad', radijusKm: 100 });
const DRAFT_LINE = workProfileSummary({ stanje: 'DRAFT', vestine: ['Selidbe stanova i kancelarija sa pakovanjem'], grad: 'sremska kamenica', radijusKm: 20 });
const SUSPENDED_LINE = workProfileSummary({ stanje: 'SUSPENDED', vestine: ['Moleraj'], grad: 'Novi Sad', radijusKm: 20 });
const NO_PROFILE_LINE = workProfileSummary(null);
// What the rows of the profile say about their own state, from the same functions the route uses over fixtures: open requests, blocked people, the export, the legal documents.
const WORDS_A = hubWords({ support: 2, blocked: { count: 0, more: false }, exportPhase: 'NONE', legal: 'UNPUBLISHED' });
const WORDS_B = hubWords({ support: 1, blocked: { count: 2, more: false }, exportPhase: 'READY_AVAILABLE', legal: 'ACCEPTED' });
const VERSION = versionWord('1.0.0');
const face = (name: string | null) => <Avatar initials={inicijali(name)} size={PROFILE_AVATAR} />;
const ready = (name: string | null, place: string | null, reputation: ReactNode, photo: ReactNode = face(name)): ProfileHubIdentity =>
  ({ state: 'ready', name, place, photo, photoReady: true, openPhoto: noop, reputation });
const rating = (state: unknown) => <ReputationFigure state={state} onRetry={noop} onOpen={noop} />;
const RATED = { accountId: 'galerija', reviewCount: 12, averageRating: 4.8, state: 'RATED', authoritative: true };
const UNRATED = { accountId: 'galerija', reviewCount: 0, averageRating: null, state: 'NO_REVIEWS', authoritative: true };

// Ocene (PROFILE-TRUST, R30): what the server returned for the signed-in account; the fixtures only vary the parts a scene is about.
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const reviewer = (n: number, name: string | null, role: 'REQUESTER' | 'WORKER' = 'REQUESTER') => ({ profileId: name ? `galerija-ocenjivac-${n}` : null, role,
  displayName: name, avatarPath: null, masked: name === null });
const got = (n: number, rating: number, patch: Partial<ReceivedReview> = {}): ReceivedReview => ({ reviewId: `galerija-ocena-${n}`, rating, tags: [], createdAt: ago(n * 6),
  agreementId: `galerija-dogovor-${n}`, taskTitle: '', receivedAs: 'WORKER', reviewer: reviewer(n, 'Jelena Ilić'), comment: null, ...patch });
const R1 = got(1, 5, { tags: ['ON_TIME', 'CAREFUL'], taskTitle: 'Selidba garsonjere sa Limana', comment: 'Došli su tačno i pažljivo spakovali sve. Preporuka.' });
const R2 = got(2, 4, { tags: ['AS_AGREED'], taskTitle: 'Unos ormara na treći sprat', reviewer: reviewer(2, null), comment: 'Sve kako smo se dogovorili.' });
const R3 = got(3, 5, { taskTitle: 'Montaža police', reviewer: reviewer(3, 'Aleksandra Stefanović-Radosavljević'),
  comment: 'Radili su brzo i počistili posle sebe. Kad je trebalo, javili su se unapred i pitali gde da ostave alat. Sledeći put opet njih zovem. '.repeat(2) });
const R4 = got(4, 3, { taskTitle: 'Nošenje kutija' });
const R5 = got(5, 5, { receivedAs: 'REQUESTER', tags: ['CLEAR_COMMUNICATION', 'RESPECTFUL'], taskTitle: 'Prevoz stolice', reviewer: reviewer(5, 'Marko Marić', 'WORKER') });
const reviews = (items: ReceivedReview[], patch: Partial<Extract<ReceivedReviewsView, { kind: 'ready' }>> = {}): ReceivedReviewsView =>
  ({ kind: 'ready', mode: 'COMMENTED_ONLY', items, totalCount: items.length, notListedCount: 0, hasMore: false, more: 'idle', onMore: noop, ...patch });
const AVERAGE: ReceivedView = { kind: 'rated', label: '4,8 · 12 ocena' };
/** The ratings screen with its tabs working on a local copy; "Date" is mounted only when a scene gives it. */
function Ratings({ average, view, given, tab: first = 'received' }: { average: ReceivedView; view: ReceivedReviewsView; given?: ReactNode; tab?: RatingsTab }) {
  const [tab, setTab] = useState<RatingsTab>(first);
  return <RatingsScreen tab={tab} onTab={setTab} onBack={toList.current} givenOpened={given !== undefined}
    received={<ReceivedRatings view={average} comments={<ReceivedReviewsList view={view} />} />} given={given ?? null} />;
}
const GIVEN: GivenView = { kind: 'ready', failed: 0, onRetryFailed: noop, older: true, onMore: noop, working: null, rows: [
  { agreementId: 'galerija-1', rating: 5, createdAt: ago(3), title: 'Selidba garsonjere sa Limana na Grbavicu', comment: 'Tačni i pažljivi.',
    person: { name: 'Marko Marić', initials: 'MM', profileId: null }, onOpen: noop },
  { agreementId: 'galerija-2', rating: 4, createdAt: ago(20), title: 'Unos ormara', comment: null, person: { name: null, initials: null, profileId: null }, onOpen: noop }] };

// Javni profil: the trust block as the server answered it for a visitor (HIDDEN is today's default for everyone but the person themself).
const PUBLIC = (patch: Partial<JavniProfilProjekcija> = {}): JavniProfilProjekcija => ({ profilId: 'galerija-radnik', uloga: 'uskocer', ime: 'Marko Marić',
  avatarPutanja: null, grad: 'Novi Sad', naslov: 'Selidbe i montaža nameštaja', biografija: 'Radim sa bratom, imamo kombi i trake. Dolazimo tačno.',
  poverenje: { ocenaProsek: 4.8, brojRecenzija: 12, zavrseniBroj: 14, identitetVerifikovan: true, ocenaDostupna: true, recenzijeDostupne: true,
    verifikacijaIdentitetaDostupna: true }, ...patch } as unknown as JavniProfilProjekcija);
const TRUST = (patch: Partial<PublicWorkTrust> = {}): PublicWorkTrust => ({ profileId: 'galerija-radnik', self: false, visibility: 'PUBLIC', completedCount: 14,
  agreedCount: 16, reliabilityPercent: 88, reliabilityState: 'AVAILABLE', reliabilityMinimum: 5, memberSince: '2026-03-01', ...patch });
const HIDDEN = TRUST({ visibility: 'OWN_ONLY', agreedCount: null, reliabilityPercent: null, reliabilityState: 'HIDDEN', memberSince: null });
const FEW = TRUST({ completedCount: 3, agreedCount: 4, reliabilityPercent: null, reliabilityState: 'TOO_FEW' });
function PublicProfile({ trust, data = PUBLIC() }: { trust: PublicWorkTrust | null; data?: JavniProfilProjekcija }) {
  return <PublicProfileSheet state={{ loading: false, data }} onClose={toList.current} onRetry={noop} trust={trust} safety={{ onPress: noop, busy: false, error: null }} />;
}

// Promeni lozinku (R22): fixture strings only; the fields show dots, never words.
function Password({ phase = 'form', values = { current: '', next: '', repeat: '' }, error = null, reason = null }: { phase?: ChangePasswordPhase;
  values?: { current: string; next: string; repeat: string }; error?: string | null; reason?: string | null }) {
  return <ChangePasswordView email="ana.petrovic@example.com" values={values} onChange={noop} phase={phase} error={error} reason={reason} onSubmit={noop} onBack={toList.current} />;
}
const FILLED = { current: 'primer-stara-1', next: 'primer-nova-22', repeat: 'primer-nova-22' };

/**
 * The worker profile as the route composes it: the form edits a local copy; the footer shows one state. `reading` is the saved profile read, as a
 * finished profile is first drawn; `accountName` is the name of the ACCOUNT (the one name: it is the title, and while the profile carries another
 * the difference is said with its button).
 */
function Worker({ initial, status, checks, readyToActivate = false, disabled = false, footer, reading = false, accountName = null, nameWorking = false,
  switchState = 'idle', rated = true, openSection = null }: {
  initial: WorkerDraft; status: StanjeProfila | null; checks?: WorkerActivationChecks; readyToActivate?: boolean; disabled?: boolean; footer?: ReactNode;
  reading?: boolean; accountName?: string | null; nameWorking?: boolean;
  /** The switch "Mogu odmah" of the read profile: at rest, saving, or the last save failed. */ switchState?: 'idle' | 'busy' | 'failed';
  /** Whether the card shows a rating. */ rated?: boolean;
  /** The editor opened on one part, as a row of the read profile opens it. */ openSection?: 'identity' | 'skills' | 'tools' | 'vehicles' | null }) {
  const [value, setValue] = useState(initial);
  const [now, setNow] = useState(initial.dostupanOdmah);
  const opening = useMemo(() => openSection ? { section: openSection, token: 1 } : null, [openSection]);
  return <WorkerProfileFrame back={toList.current} footer={footer}
    right={<HeaderInfo title="Na šta utiče radni profil" info={workerProfileInfoLines(!reading)} />}>
    <WorkerProfileForm draft={value} change={setValue} disabled={disabled} status={status} navigate={noop} checks={checks}
      readyToActivate={readyToActivate} openConversation={noop} profileExists={status !== null}
      reading={reading} onEditPart={reading ? noop : undefined} openSection={opening}
      face={<Avatar initials={inicijali(accountName ?? value.ime)} size={56} />} rating={rated ? <RatingLineView average={4.8} count={12} /> : undefined}
      availableNow={status === 'ACTIVE' ? { value: now, onChange: setNow, busy: switchState === 'busy', failed: switchState === 'failed' } : undefined}
      accountName={accountName} onUseAccountName={accountName ? noop : undefined} nameWorking={nameWorking} />
  </WorkerProfileFrame>;
}
const primary = (label: string, extra: { disabled?: boolean; loading?: boolean; success?: boolean } = {}) =>
  <V2Action label={label} onPress={noop} style={brandAction} {...extra} />;
const quiet = (label: string) => <V2Action label={label} kind="quiet" onPress={noop} />;

/** The photo screen with the entry photograph standing in for a stored one. */
function Photo({ stage, mode, error = null, notice = null, permission = false, retryable = false, running = null, sending = false, canAct = true,
  hasPhoto = false, initials = null }: {
  stage: ProfilePhotoStage | null; mode: ProfilePhotoMode; error?: string | null; notice?: string | null; permission?: boolean; retryable?: boolean;
  running?: ProfilePhotoRunning; sending?: boolean; canAct?: boolean; hasPhoto?: boolean; initials?: string | null }) {
  const confirm = useConfirmSheet();
  return <ProfilePhotoEditor onBack={toList.current} stage={stage} notice={notice} error={error} permissionDenied={permission} mode={mode} initials={initials}
    retryable={retryable} running={running} sending={sending} canAct={canAct && !running} waiting={!!running} hasPhoto={hasPhoto}
    onLibrary={noop} onCamera={noop} onApply={noop} onDiscard={noop} onRetry={noop} onCheck={noop}
    onRemove={() => confirm.ask({ title: 'Ukloniti fotografiju profila?', message: 'Profil ostaje bez fotografije dok ne izabereš novu.',
      confirmLabel: 'Ukloni fotografiju', tone: 'danger', onConfirm: noop })}
    photo={(_assetId, label) => <Image source={WORKER_PHOTO} accessibilityLabel={label} resizeMode="cover" style={s.photo} />}
    sheet={confirm.sheet} />;
}

/** The work-area form as the route places it: the confirmation (or, right after a save, the saved line) and the save in the sticky footer. */
function Area({ location, busy = false, uncertain = false, reading = false, error = null, saved = false }: { location: WorkerLocation; busy?: boolean;
  uncertain?: boolean; reading?: boolean; error?: string | null; saved?: boolean }) {
  return <WorkerLocationForm location={location} busy={busy} uncertain={uncertain} reading={reading} saved={saved} onSave={noop} error={error}
    onRetry={noop} countryOptions={COUNTRIES} resolver={NO_SEARCH}>
    {({ body, footer }) => <WorkerProfileFrame title="Područje rada" backLabel="Nazad" back={toList.current} footer={footer}>{body}</WorkerProfileFrame>}
  </WorkerLocationForm>;
}
const areaFrame = (children: ReactNode) => <WorkerProfileFrame title="Područje rada" backLabel="Nazad" back={toList.current}>{children}</WorkerProfileFrame>;

function Name({ savedName, uncertain = false, error = null, saved = false, busy = false, reading = false }: { savedName: string; uncertain?: boolean;
  error?: string | null; saved?: boolean; busy?: boolean; reading?: boolean }) {
  return <SettingsScreen title="Lični podaci" onBack={toList.current}>
    <DisplayNameForm savedName={savedName} busy={busy} uncertain={uncertain} saved={saved} error={error} checking={busy || reading} check={noop}
      save={async () => {}} />
  </SettingsScreen>;
}
/**
 * "Lični podaci" as the route lays it out: the photo, the name (its one green action only once the name has changed), "O meni" and the city, and the one
 * sentence on who sees what, with its "ⓘ". `workName` says the name was saved on the account and the work profile did not take it.
 */
const ABOUT_TEXT: AboutView = { kind: 'text', text: 'Radim sa bratom već osam godina. Imamo kombi, trake i ćebad za zaštitu nameštaja; dolazimo tačno i ostavljamo čisto. Selidbe, montaža nameštaja, nošenje.' };
const CITY_NS: CityView = { kind: 'city', city: 'Novi Sad' };
function EditProfile({ name = 'Ana Petrović', about = ABOUT_TEXT, city = CITY_NS, saved = false, workName = null, uncertain = false, error = null, busy = false,
  photo, typed }: { name?: string; about?: AboutView; city?: CityView; saved?: boolean; workName?: 'failed' | 'retrying' | null; uncertain?: boolean; error?: string | null;
  busy?: boolean; photo?: ReactNode; /** The name already typed: the bar then has its "Sačuvaj". */ typed?: string }) {
  const [save, setSave] = useState<NameSaveControl | null>(null);
  return <SettingsScreen title="Lični podaci" onBack={toList.current} right={save ? <NameSaveButton control={save} /> : undefined}>
    <ProfilePhotoBlock ready={!busy} photo={photo ?? <Avatar initials={inicijali(name)} size={EDIT_PHOTO} />} onOpen={noop} />
    <DisplayNameForm savedName={name} typed={typed} busy={busy} uncertain={uncertain} saved={saved} error={error} checking={busy} check={noop} save={async () => {}}
      onSaveControl={setSave} />
    {workName ? <WorkNameNotice retrying={workName === 'retrying'} onRetry={noop} /> : null}
    <ProfileFactRows about={about} city={city} onAbout={noop} onCity={noop} />
    <VisibilityNote />
  </SettingsScreen>;
}

// Ocena saradnje (8 Oct 2026, "Zvezde kao nalepnice" and "Pilula pada, sjaj"): the real presentation on fixtures; the stars and tags answer on a local copy.
const RATED_PERSON: ReviewPerson = { name: 'Marko Jovanović', initials: 'MJ', profileId: null, role: 'Uskače na tvoj zadatak', task: 'Prenos ormana do kombija' };
const LONG_PERSON: ReviewPerson = { name: 'Aleksandra Stefanović-Radosavljević', initials: 'AS', profileId: null, role: 'Uskače na tvoj zadatak',
  task: 'Selidba stanova i kancelarija sa pakovanjem, montažom i odvozom ambalaže' };
const REVIEW_CATALOG = { maxTags: 3, tags: ['AS_AGREED', 'CAREFUL', 'CLEAR_COMMUNICATION', 'ON_TIME', 'RELIABLE', 'RESPECTFUL'] as readonly ReviewTag[] };
const reviewRetry = { label: 'Ponovo učitaj ocenu', disabled: false, onPress: noop };
function Rating({ initial = 4, person = RATED_PERSON }: { initial?: number; person?: ReviewPerson | null }) {
  const [stars, setStars] = useState(initial);
  const [tags, setTags] = useState<ReviewTag[]>(initial ? ['ON_TIME'] : []);
  const view: ReviewView = { kind: 'eligible', catalog: REVIEW_CATALOG, rating: stars, tags, editable: true, attempt: false, onRate: setStars,
    onToggleTag: tag => setTags(values => values.includes(tag) ? values.filter(value => value !== tag) : values.length < REVIEW_CATALOG.maxTags ? [...values, tag] : values),
    save: { label: 'Sačuvaj ocenu', loading: false, disabled: stars < 1, reason: stars < 1 ? 'Izaberi ocenu.' : null, onPress: noop } };
  return <AgreementReviewPresentation backLabel="Nazad na Dogovor" onBack={toList.current} view={view} person={person} notice={null} retry={reviewRetry} />;
}
const savedRating = (view: Extract<ReviewView, { kind: 'saved' }>, person: ReviewPerson | null = RATED_PERSON) =>
  <AgreementReviewPresentation backLabel="Nazad na Dogovor" onBack={toList.current} view={view} person={person} notice={null} retry={reviewRetry} />;

/** The scene list's own back, set while the gallery is mounted, so every scene's arrow returns to the list. */
const toList: { current: () => void } = { current: noop };

const GROUPS: Group[] = [
  { title: 'Identitet', scenes: [{ key: 'brand-dimensional', label: 'USKOČI: dimenzionalni logo i animacija', draw: () => <BrandSceneReview /> }] },
  { title: 'Profil', scenes: [
    { key: 'hub-active', label: 'Profil: aktivan', draw: () => <Hub identity={ready('Ana Petrović', 'Novi Sad', rating(RATED))}
      capabilityDetail={ACTIVE_LINE} finished={FINISHED} stats={STATS()} email="ana.petrovic@example.com" /> },
    // A new account: nothing is known about the rows' states, so no row says a word of its own, and the version is not recorded.
    { key: 'hub-new', label: 'Profil: nov nalog', draw: () => <Hub identity={ready(null, null, rating(UNRATED))} capabilityNeedsAttention viewPublic={false}
      capabilityDetail={NO_PROFILE_LINE} words={{}} version="" email="novi.nalog@example.com" /> },
    { key: 'hub-long', label: 'Profil: dugo ime', draw: () => <Hub identity={ready('Aleksandra Stefanović-Radosavljević', 'Sremska Kamenica, Novi Sad', rating('error'))}
      capabilityNeedsAttention capabilityDetail={DRAFT_LINE} words={WORDS_B}
      finished={{ kind: 'ready', facts: [{ role: 'uskocer', count: null }, { role: 'narucilac', count: 3 }] }}
      stats={STATS({ reliabilityPercent: null, reliabilityState: 'TOO_FEW', agreementsMade: 3, agreementsCompleted: 2, agreementsActive: 1, applicationsSent: 5 })}
      email="aleksandra.stefanovic.radosavljevic@example.com" /> },
    { key: 'hub-photo', label: 'Profil: sa fotografijom', draw: () => <Hub identity={ready('Marko Marić', 'Novi Sad', rating('loading'),
      <Image source={WORKER_PHOTO} accessibilityIgnoresInvertColors resizeMode="cover" style={s.face} />)} capabilityDetail={SUSPENDED_LINE}
      finished={{ kind: 'loading' }} stats={{ kind: 'loading' }} email="marko@example.com" /> },
    { key: 'hub-stats-error', label: 'Profil: statistika nije učitana (tri broja postaju dva)', draw: () => <Hub identity={ready('Ana Petrović', 'Novi Sad', rating(RATED))}
      capabilityDetail={ACTIVE_LINE} finished={FINISHED} stats={{ kind: 'error', onRetry: noop }} /> },
    { key: 'hub-requester', label: 'Profil: samo zadaci (bez radnog profila)', draw: () => <Hub identity={ready('Jelena Ilić', 'Beograd', rating(UNRATED))}
      capabilityNeedsAttention capabilityDetail={NO_PROFILE_LINE}
      finished={{ kind: 'ready', facts: [{ role: 'narucilac', count: 2 }] }} email="jelena.ilic@example.com" /> },
    { key: 'hub-loading', label: 'Profil: učitavanje', draw: () => <Hub identity={{ state: 'loading' }} /> },
    { key: 'hub-error', label: 'Profil: greška', draw: () => <Hub identity={{ state: 'error', retry: noop }} /> },
    { key: 'hub-busy', label: 'Profil: radnja u toku', draw: () => <Hub busy identity={ready('Ana Petrović', 'Novi Sad', rating(RATED))}
      capabilityDetail={ACTIVE_LINE} finished={FINISHED} stats={STATS()} /> },
    { key: 'hub-large', label: 'Profil: veliki tekst (1,3)', large: true, draw: () => <Hub identity={ready('Aleksandra Stefanović-Radosavljević', 'Novi Sad', rating(RATED))}
      capabilityDetail={ACTIVE_LINE} finished={FINISHED} stats={STATS()} email="aleksandra.stefanovic.radosavljevic@example.com" /> },
    { key: 'hub-owner', label: 'Profil: tekst 1,15 (vlasnikov telefon)', owner: true, draw: () => <Hub identity={ready('Ana Petrović', 'Novi Sad', rating(RATED))}
      capabilityDetail={ACTIVE_LINE} finished={FINISHED} stats={STATS()} email="ana.petrovic@example.com" /> },
  ] },
  { title: 'Ocene', scenes: [
    { key: 'ratings-comments', label: 'Ocene: primljene, komentari i zvezdice u proseku', draw: () => <Ratings average={AVERAGE}
      view={reviews([R1, R2, R3], { totalCount: 12, notListedCount: 9 })} /> },
    { key: 'ratings-more', label: 'Ocene: ima još komentara', draw: () => <Ratings average={AVERAGE} view={reviews([R1, R2, R3], { totalCount: 40, notListedCount: 20, hasMore: true })} /> },
    { key: 'ratings-more-loading', label: 'Ocene: učitava se sledeća strana', draw: () => <Ratings average={AVERAGE}
      view={reviews([R1, R2, R3], { totalCount: 40, notListedCount: 20, hasMore: true, more: 'loading' })} /> },
    { key: 'ratings-more-error', label: 'Ocene: sledeća strana nije učitana', draw: () => <Ratings average={AVERAGE}
      view={reviews([R1, R2, R3], { totalCount: 40, notListedCount: 20, hasMore: true, more: 'error' })} /> },
    { key: 'ratings-all', label: 'Ocene: sve ocene jedna po jedna', draw: () => <Ratings average={AVERAGE}
      view={reviews([R1, R4, R2, R5, R3], { mode: 'ALL', totalCount: 5 })} /> },
    { key: 'ratings-stars-only', label: 'Ocene: samo zvezdice, bez komentara', draw: () => <Ratings average={AVERAGE}
      view={reviews([], { totalCount: 3, notListedCount: 3 })} /> },
    { key: 'ratings-none', label: 'Ocene: još nema ocena', draw: () => <Ratings average={{ kind: 'none' }} view={reviews([])} /> },
    { key: 'ratings-loading', label: 'Ocene: učitavanje', draw: () => <Ratings average={{ kind: 'loading' }} view={{ kind: 'loading' }} /> },
    { key: 'ratings-error', label: 'Ocene: greška', draw: () => <Ratings average={{ kind: 'error', onRetry: noop }} view={{ kind: 'error', onRetry: noop }} /> },
    { key: 'ratings-given', label: 'Ocene: date', draw: () => <Ratings average={AVERAGE} view={reviews([])} tab="given" given={<GivenRatings view={GIVEN} />} /> },
    { key: 'ratings-large', label: 'Ocene: veliki tekst (1,3)', large: true, draw: () => <Ratings average={AVERAGE}
      view={reviews([R1, R2, R3], { totalCount: 12, notListedCount: 9 })} /> },
  ] },
  { title: 'Ocena saradnje', scenes: [
    { key: 'rating-choose', label: 'Ocena: izbor (4 zvezde, jedna oznaka)', draw: () => <Rating /> },
    { key: 'rating-empty', label: 'Ocena: bez izbora', draw: () => <Rating initial={0} /> },
    { key: 'rating-long', label: 'Ocena: dugi nazivi', draw: () => <Rating person={LONG_PERSON} /> },
    { key: 'rating-no-person', label: 'Ocena: bez osobe (Dogovor nije pročitan)', draw: () => <Rating person={null} /> },
    { key: 'rating-saved', label: 'Ocena: sačuvana upravo sad (pilula pada, sjaj)', draw: () => savedRating({ kind: 'saved', rating: 4, tags: ['ON_TIME', 'RELIABLE'], fresh: true }) },
    { key: 'rating-saved-again', label: 'Ocena: sačuvana, otvorena ponovo (mirno)', draw: () => savedRating({ kind: 'saved', rating: 4, tags: ['ON_TIME', 'RELIABLE'], fresh: false }) },
    { key: 'rating-saved-long', label: 'Ocena: sačuvana, dugo ime i komentar', draw: () => savedRating({ kind: 'saved', rating: 5, tags: ['AS_AGREED', 'CLEAR_COMMUNICATION', 'RESPECTFUL'], fresh: false,
      comment: 'Sve je proteklo kako treba, došli su na vreme i ostavili čisto.' }, LONG_PERSON) },
    { key: 'rating-saved-no-person', label: 'Ocena: sačuvana, bez osobe', draw: () => savedRating({ kind: 'saved', rating: 2, tags: [], fresh: false }, null) },
    { key: 'rating-large', label: 'Ocena: veliki tekst (1,3)', large: true, draw: () => <Rating person={LONG_PERSON} /> },
    { key: 'rating-saved-large', label: 'Ocena: sačuvana, veliki tekst (1,3)', large: true, draw: () => savedRating({ kind: 'saved', rating: 4, tags: ['ON_TIME', 'RELIABLE'], fresh: false }, LONG_PERSON) },
  ] },
  { title: 'Javni profil: poverenje', scenes: [
    { key: 'public-hidden', label: 'Javni profil: poverenje skriveno (podrazumevano)', draw: () => <PublicProfile trust={HIDDEN} /> },
    { key: 'public-few', label: 'Javni profil: premalo Dogovora za procenat', draw: () => <PublicProfile trust={FEW} /> },
    { key: 'public-available', label: 'Javni profil: procenat i član od', draw: () => <PublicProfile trust={TRUST()} /> },
    { key: 'public-none', label: 'Javni profil: bez ocena, bez poverenja', draw: () => <PublicProfile trust={null}
      data={PUBLIC({ poverenje: { ocenaProsek: null, brojRecenzija: 0, zavrseniBroj: 0, identitetVerifikovan: false, ocenaDostupna: false, recenzijeDostupne: true,
        verifikacijaIdentitetaDostupna: true } as never })} /> },
    { key: 'public-large', label: 'Javni profil: veliki tekst (1,3)', large: true, draw: () => <PublicProfile trust={TRUST()}
      data={PUBLIC({ ime: 'Aleksandra Stefanović-Radosavljević', naslov: 'Selidbe stanova i kancelarija sa pakovanjem' })} /> },
  ] },
  { title: 'Promeni lozinku', scenes: [
    { key: 'password-form', label: 'Lozinka: prazna forma', draw: () => <Password reason="Upiši trenutnu lozinku." /> },
    { key: 'password-ready', label: 'Lozinka: spremno za čuvanje', draw: () => <Password values={FILLED} /> },
    { key: 'password-saving', label: 'Lozinka: čuva se', draw: () => <Password phase="saving" values={FILLED} /> },
    { key: 'password-wrong', label: 'Lozinka: trenutna nije tačna', draw: () => <Password values={FILLED} error={passwordChangeMessages.WRONG_CURRENT} /> },
    { key: 'password-unknown', label: 'Lozinka: ishod nepoznat', draw: () => <Password values={FILLED} error={passwordChangeMessages.UNKNOWN_OUTCOME} /> },
    { key: 'password-done', label: 'Lozinka: promenjena', draw: () => <Password phase="done" /> },
    { key: 'password-large', label: 'Lozinka: veliki tekst (1,3)', large: true, draw: () => <Password values={FILLED} error={passwordChangeMessages.UNKNOWN_OUTCOME} /> },
  ] },
  { title: 'Lični radni profil', scenes: [
    { key: 'worker-loading', label: 'Radni profil: učitavanje', draw: () => <WorkerProfileFrame back={toList.current}>
      <WorkerProfileStatus loading retry={noop} /></WorkerProfileFrame> },
    { key: 'worker-error', label: 'Radni profil: greška', draw: () => <WorkerProfileFrame back={toList.current}>
      <WorkerProfileStatus loading={false} error="Profil nije učitan. Proveri vezu pa pokušaj ponovo." retry={noop} /></WorkerProfileFrame> },
    { key: 'worker-first', label: 'Radni profil: prvi put', draw: () => <Worker initial={workerDraft(null)} status={null}
      checks={{ basics: false, area: false }} footer={<WorkerProfileFooter>{primary('Uredi kroz razgovor')}</WorkerProfileFooter>} /> },
    { key: 'worker-missing', label: 'Radni profil: nacrt, nedostaje', draw: () => <Worker initial={draft({ vestine: [], capacity: '' })} status="DRAFT"
      accountName="Ana Petrović" checks={{ basics: false, area: true, capacity: false }}
      footer={<WorkerProfileFooter error="Pre aktivacije dodaj bar jednu veštinu.">
        {primary('Dopuni osnovne podatke')}{quiet('Sačuvaj kao nacrt')}</WorkerProfileFooter>} /> },
    // The account has no name at all, so the one place it is written is the primary (the name is not typed in the work profile).
    { key: 'worker-no-name', label: 'Radni profil: nacrt, nalog bez imena', draw: () => <Worker initial={draft({ ime: '' })} status="DRAFT"
      checks={{ basics: false, area: true }} footer={<WorkerProfileFooter>{primary('Dodaj ime')}{quiet('Sačuvaj kao nacrt')}</WorkerProfileFooter>} /> },
    { key: 'worker-ready', label: 'Radni profil: spreman za aktivaciju', draw: () => <Worker initial={draft()} status="DRAFT" checks={READY} readyToActivate
      footer={<WorkerProfileFooter>{primary('Proveri i aktiviraj profil')}{quiet('Sačuvaj kao nacrt')}</WorkerProfileFooter>} /> },
    { key: 'worker-active', label: 'Radni profil: aktivan', draw: () => <Worker initial={draft()} status="ACTIVE" checks={READY}
      footer={<WorkerProfileFooter>{primary('Sačuvaj izmene')}</WorkerProfileFooter>} /> },
    { key: 'worker-saved', label: 'Radni profil: sačuvano', draw: () => <Worker initial={draft()} status="ACTIVE" checks={READY}
      footer={<WorkerProfileFooter message="Izmene profila su sačuvane.">{primary('Sačuvaj izmene', { success: true })}</WorkerProfileFooter>} /> },
    { key: 'worker-saving', label: 'Radni profil: čuva se', draw: () => <Worker initial={draft()} status="ACTIVE" checks={READY} disabled
      footer={<WorkerProfileFooter>{primary('Čuvamo profil…', { loading: true })}</WorkerProfileFooter>} /> },
    { key: 'worker-unknown', label: 'Radni profil: ishod nepoznat', draw: () => <Worker initial={draft({ ime: 'Ana P.' })} status="ACTIVE" checks={READY} disabled
      footer={<WorkerProfileFooter error="Čuvanje nije potvrđeno. Pogledaj sačuvani profil pre nego što pokušaš ponovo." held>
        {primary('Pogledaj sačuvani profil')}</WorkerProfileFooter>} /> },
    { key: 'worker-retry', label: 'Radni profil: ponovi čuvanje', draw: () => <Worker initial={draft({ ime: 'Ana P.' })} status="ACTIVE" checks={READY} disabled
      footer={<WorkerProfileFooter held>{primary('Sačuvaj ponovo')}{quiet('Izmeni podatke')}</WorkerProfileFooter>} /> },
    { key: 'worker-suspended', label: 'Radni profil: suspendovan', draw: () => <Worker initial={draft()} status="SUSPENDED" checks={READY}
      footer={<WorkerProfileFooter>{primary('Sačuvaj izmene')}</WorkerProfileFooter>} /> },
    { key: 'worker-full', label: 'Radni profil: puna lista vozila', draw: () => <Worker initial={draft({ vozila: Array.from({ length: 50 }, (_, i) => `Vozilo ${i + 1}`) })}
      status="ACTIVE" checks={READY} footer={<WorkerProfileFooter>{primary('Sačuvaj izmene')}</WorkerProfileFooter>} /> },
    { key: 'worker-long', label: 'Radni profil: dugački nazivi', draw: () => <Worker initial={LONG} status="ACTIVE" checks={READY}
      footer={<WorkerProfileFooter>{primary('Sačuvaj izmene')}</WorkerProfileFooter>} /> },
    { key: 'worker-review', label: 'Radni profil: pregled iz razgovora', draw: () => <WorkerProfileFrame back={toList.current}
      footer={primary('Sačuvaj profil')}>
      <WorkerAiReviewDetails review={REVIEW} /><WorkerAiActivation activate={false} disabled={false} change={noop} />
    </WorkerProfileFrame> },
    // The account has no name: the review says it needs one and leads to the one place it is written (the assistant does not ask for it).
    { key: 'worker-review-no-name', label: 'Radni profil: pregled, nalog bez imena', draw: () => <WorkerProfileFrame back={toList.current}
      footer={primary('Sačuvaj profil', { disabled: true })}>
      <WorkerAiReviewDetails review={{ ...REVIEW, missingRequired: ['Ime'], canAccept: false }} onAddName={noop} />
    </WorkerProfileFrame> },
    // The saved profile, read: one name (the account's), one group of rows, the equipment as rows with a count.
    { key: 'worker-read', label: 'Radni profil: pročitan, aktivan', draw: () => <Worker reading initial={draft({ biografija: 'Radim sa bratom već osam godina. Dolazimo tačno.' })}
      status="ACTIVE" checks={READY} accountName="Ana Petrović" /> },
    { key: 'worker-read-kit', label: 'Radni profil: pročitan, mnogo alata i vozila', draw: () => <Worker reading initial={draft({ alati: KIT_TOOLS, vozila: KIT_VEHICLES })}
      status="ACTIVE" checks={READY} accountName="Ana Petrović" /> },
    { key: 'worker-read-long', label: 'Radni profil: pročitan, dugački nazivi', draw: () => <Worker reading initial={LONG} status="ACTIVE" checks={READY}
      accountName="Aleksandra Stefanović-Radosavljević" /> },
    { key: 'worker-read-none', label: 'Radni profil: pročitan, bez alata i vozila', draw: () => <Worker reading initial={draft({ alati: [], vozila: [], dostupanOdmah: false })}
      status="ACTIVE" checks={READY} accountName="Ana Petrović" /> },
    // A profile that has only just been activated: no kinds of work beyond one, no rating yet, nothing in the lists.
    { key: 'worker-read-new', label: 'Radni profil: pročitan, tek aktiviran', draw: () => <Worker reading rated={false} initial={draft({ vestine: [], alati: [], vozila: [], dostupanOdmah: false, grad: '', radius: '' })}
      status="ACTIVE" checks={READY} accountName="Ana Petrović" /> },
    { key: 'worker-read-no-rating', label: 'Radni profil: pročitan, bez ocene', draw: () => <Worker reading rated={false} initial={draft()}
      status="ACTIVE" checks={READY} accountName="Ana Petrović" /> },
    { key: 'worker-read-switch-busy', label: 'Radni profil: Mogu odmah se čuva', draw: () => <Worker reading switchState="busy" initial={draft()}
      status="ACTIVE" checks={READY} accountName="Ana Petrović" /> },
    { key: 'worker-read-switch-failed', label: 'Radni profil: Mogu odmah nije sačuvano', draw: () => <Worker reading switchState="failed" initial={draft()}
      status="ACTIVE" checks={READY} accountName="Ana Petrović" /> },
    // A row of the read profile opens the editor of its part (no field focused, so no keyboard).
    { key: 'worker-edit-tools', label: 'Radni profil: izmena alata (iz reda „Alat“)', draw: () => <Worker openSection="tools" initial={draft({ alati: KIT_TOOLS })}
      status="ACTIVE" checks={READY} accountName="Ana Petrović" footer={<WorkerProfileFooter>{primary('Sačuvaj izmene')}</WorkerProfileFooter>} /> },
    { key: 'worker-edit-about', label: 'Radni profil: izmena opisa (iz „Lični podaci › O meni“)', draw: () => <Worker openSection="identity" initial={draft({ biografija: 'Radim sa bratom.' })}
      status="ACTIVE" checks={READY} accountName="Ana Petrović" /> },
    { key: 'worker-read-suspended', label: 'Radni profil: pročitan, suspendovan', draw: () => <Worker reading initial={draft()} status="SUSPENDED" checks={READY}
      accountName="Ana Petrović" /> },
    // The name: "Pera peric" on the work profile and "Milos" on the account (the owner's own case, 8 Oct 2026), and what comes of the one button.
    { key: 'worker-name-different', label: 'Radni profil: ime na radnom profilu je drugačije', draw: () => <Worker reading initial={draft({ ime: 'Pera peric' })}
      status="ACTIVE" checks={READY} accountName="Milos" /> },
    { key: 'worker-name-working', label: 'Radni profil: ime se upisuje', draw: () => <Worker reading disabled nameWorking initial={draft({ ime: 'Pera peric' })}
      status="ACTIVE" checks={READY} accountName="Milos"
      footer={<WorkerProfileFooter>{primary('Čuvamo profil…', { loading: true })}</WorkerProfileFooter>} /> },
    { key: 'worker-name-saved', label: 'Radni profil: ime promenjeno', draw: () => <Worker reading initial={draft({ ime: 'Milos' })} status="ACTIVE" checks={READY}
      accountName="Milos" footer={<WorkerProfileFooter message="Ime radnog profila je promenjeno.">{primary('Sačuvaj izmene', { success: true })}</WorkerProfileFooter>} /> },
    { key: 'worker-name-failed', label: 'Radni profil: ime nije upisano', draw: () => <Worker reading disabled initial={draft({ ime: 'Pera peric' })} status="ACTIVE"
      checks={READY} accountName="Milos"
      footer={<WorkerProfileFooter error="Čuvanje nije potvrđeno. Pogledaj sačuvani profil pre nego što pokušaš ponovo." held>
        {primary('Pogledaj sačuvani profil')}</WorkerProfileFooter>} /> },
    { key: 'worker-edit-name-different', label: 'Radni profil: izmena, ime drugačije', draw: () => <Worker initial={draft({ ime: 'Pera peric' })} status="ACTIVE"
      checks={READY} accountName="Milos" footer={<WorkerProfileFooter>{primary('Sačuvaj izmene')}</WorkerProfileFooter>} /> },
    { key: 'worker-read-large', label: 'Radni profil: pročitan, veliki tekst (1,3)', large: true, draw: () => <Worker reading
      initial={draft({ ime: 'Pera peric', alati: KIT_TOOLS, vozila: KIT_VEHICLES })} status="ACTIVE" checks={READY} accountName="Milos" /> },
    { key: 'worker-read-owner', label: 'Radni profil: pročitan, tekst 1,15', owner: true, draw: () => <Worker reading
      initial={draft({ ime: 'Pera peric', alati: KIT_TOOLS, vozila: KIT_VEHICLES })} status="ACTIVE" checks={READY} accountName="Milos" /> },
  ] },
  { title: 'Fotografija profila', scenes: [
    { key: 'photo-loading', label: 'Fotografija: učitavanje', draw: () => <Photo stage={{ kind: 'loading' }} mode="pick" canAct={false} /> },
    { key: 'photo-none', label: 'Fotografija: bez fotografije', draw: () => <Photo stage={{ kind: 'none' }} mode="pick" /> },
    // The letters of the name stand in the circle while the picture is on its way and when there is none (J13), always a circle.
    { key: 'photo-loading-initials', label: 'Fotografija: učitavanje, slovo u krugu', draw: () => <Photo stage={{ kind: 'loading' }} mode="pick" canAct={false} initials="AP" /> },
    { key: 'photo-none-initials', label: 'Fotografija: bez fotografije, slovo u krugu', draw: () => <Photo stage={{ kind: 'none' }} mode="pick" initials="AP" /> },
    { key: 'photo-saved', label: 'Fotografija: sačuvana', draw: () => <Photo stage={{ kind: 'photo', assetId: 'galerija', staged: false }} mode="pick" hasPhoto
      notice="Fotografija profila je sačuvana." /> },
    { key: 'photo-picking', label: 'Fotografija: slanje', draw: () => <Photo stage={{ kind: 'none' }} mode="pick" running="LIBRARY" sending /> },
    { key: 'photo-staged', label: 'Fotografija: izabrana', draw: () => <Photo stage={{ kind: 'photo', assetId: 'galerija', staged: true }} mode="staged" /> },
    { key: 'photo-unresolved', label: 'Fotografija: nepotvrđeno, može ponovo', draw: () => <Photo stage={{ kind: 'photo', assetId: 'galerija', staged: false }}
      mode="unresolved" retryable hasPhoto /> },
    { key: 'photo-unchecked', label: 'Fotografija: nepotvrđeno, pre provere', draw: () => <Photo stage={{ kind: 'photo', assetId: 'galerija', staged: false }}
      mode="unresolved" hasPhoto /> },
    // A refusal on the phone before anything is sent keeps the choice open under its message (review of step 9, 2026-09-24).
    { key: 'photo-denied', label: 'Fotografija: kamera odbijena', draw: () => <Photo stage={{ kind: 'none' }} mode="pick" permission
      error="Dozvoli pristup kameri u podešavanjima ili izaberi fotografiju iz galerije." /> },
    { key: 'photo-large', label: 'Fotografija: prevelika', draw: () => <Photo stage={{ kind: 'none' }} mode="pick" error="Izaberi fotografiju do 10 MB." /> },
    // A write that was not confirmed: the one action is the check its message asks for (round 5c).
    { key: 'photo-check', label: 'Fotografija: čuvanje nije potvrđeno', draw: () => <Photo stage={{ kind: 'none' }} mode="reconcile"
      error="Čuvanje nije potvrđeno. Proveri sačuvano stanje pre novog pokušaja." /> },
    { key: 'photo-unavailable', label: 'Fotografija: nije dostupna', draw: () => <Photo stage={{ kind: 'unavailable' }} mode="reconcile"
      error="Ne znamo da li je fotografija sačuvana. Proveri to." /> },
    { key: 'photo-remove', label: 'Fotografija: uklanjanje (dodirni Ukloni)', draw: () => <Photo stage={{ kind: 'photo', assetId: 'galerija', staged: false }}
      mode="pick" hasPhoto /> },
    { key: 'photo-text-large', label: 'Fotografija: veliki tekst (1,3)', large: true, draw: () => <Photo stage={{ kind: 'photo', assetId: 'galerija', staged: false }}
      mode="pick" hasPhoto notice="Fotografija profila je sačuvana." /> },
    { key: 'photo-owner', label: 'Fotografija: tekst 1,15', owner: true, draw: () => <Photo stage={{ kind: 'photo', assetId: 'galerija', staged: true }} mode="staged" /> },
  ] },
  { title: 'Područje rada', scenes: [
    { key: 'area-loading', label: 'Područje rada: učitavanje', draw: () => areaFrame(<StateView kind="loading" title="Učitavamo područje rada…"
      skeleton={{ count: 2, rows: 1 }} />) },
    { key: 'area-error', label: 'Područje rada: greška', draw: () => areaFrame(<StateView kind="error" title="Područje rada nije učitano"
      body="Podaci nisu učitani. Proveri vezu i pokušaj ponovo." primary={{ label: 'Pokušaj ponovo', onPress: noop }} />) },
    { key: 'area-empty', label: 'Područje rada: prazno', draw: () => <Area location={PLACE({ operatingCountryCode: null, city: '', radiusKm: 15 })} /> },
    { key: 'area-saved', label: 'Područje rada: sačuvano', draw: () => <Area location={PLACE({ radiusKm: 50 })} saved /> },
    // A radius saved earlier that is not among the distances (30 km) gets its own chip: nothing that was saved is hidden.
    { key: 'area-radius-own', label: 'Područje rada: sačuvan radijus 30 km (svoj izbor)', draw: () => <Area location={PLACE({ radiusKm: 30 })} saved /> },
    { key: 'area-map', label: 'Područje rada: sa mapom', draw: () => <Area location={PLACE({ approximatePosition: { latitude: 45.25, longitude: 19.84 } })} /> },
    { key: 'area-saving', label: 'Područje rada: čuva se', draw: () => <Area location={PLACE()} busy /> },
    { key: 'area-reading', label: 'Područje rada: ponovno čitanje (potvrdi)', draw: () => <Area location={PLACE()} reading /> },
    { key: 'area-unknown', label: 'Područje rada: ishod nepoznat', draw: () => <Area location={PLACE()} uncertain
      error="Čuvanje nije potvrđeno. Proveri sačuvano stanje pre novog pokušaja." /> },
    { key: 'area-owner', label: 'Područje rada: tekst 1,15', owner: true, draw: () => <Area location={PLACE({ city: 'Petrovac na mlavi', radiusKm: 30 })} /> },
    { key: 'area-large', label: 'Područje rada: veliki tekst (1,3)', large: true, draw: () => <Area location={PLACE()} /> },
  ] },
  { title: 'Lični podaci', scenes: [
    { key: 'edit-profile', label: 'Lični podaci: sve popunjeno', draw: () => <EditProfile /> },
    { key: 'edit-profile-empty', label: 'Lični podaci: bez opisa i grada', draw: () => <EditProfile about={{ kind: 'empty' }} city={{ kind: 'none' }} /> },
    { key: 'edit-profile-no-work', label: 'Lični podaci: bez radnog profila', draw: () => <EditProfile name="Jelena Ilić" about={{ kind: 'none' }} city={{ kind: 'none' }} /> },
    { key: 'edit-profile-reading', label: 'Lični podaci: čitanje opisa i grada', draw: () => <EditProfile about={{ kind: 'loading' }} city={{ kind: 'loading' }} /> },
    { key: 'edit-profile-error', label: 'Lični podaci: opis i grad nisu dostupni', draw: () => <EditProfile about={{ kind: 'error' }} city={{ kind: 'error' }} /> },
    { key: 'edit-profile-long', label: 'Lični podaci: dugi nazivi', draw: () => <EditProfile name="Aleksandra Stefanović-Radosavljević"
      city={{ kind: 'city', city: 'Sremska Kamenica, Novi Sad' }} /> },
    { key: 'edit-profile-photo', label: 'Lični podaci: sa fotografijom', draw: () => <EditProfile
      photo={<Image source={WORKER_PHOTO} accessibilityIgnoresInvertColors resizeMode="cover" style={s.editFace} />} /> },
    // The bar's "Sačuvaj" is there only once the name has changed; an emptied name cannot be saved and says why under the field.
    { key: 'edit-profile-changed', label: 'Lični podaci: ime promenjeno (Sačuvaj u zaglavlju)', draw: () => <EditProfile typed="Ana Petrović-Ilić" /> },
    { key: 'edit-profile-emptied', label: 'Lični podaci: ime obrisano', draw: () => <EditProfile typed="" /> },
    { key: 'edit-profile-saving', label: 'Lični podaci: ime se čuva', draw: () => <EditProfile typed="Ana Petrović-Ilić" busy /> },
    { key: 'edit-profile-saved', label: 'Lični podaci: ime sačuvano', draw: () => <EditProfile saved /> },
    // The second write: the name is on the account and the work profile did not take it. Said, never silent, with its one way to try again.
    { key: 'edit-profile-work-failed', label: 'Lični podaci: ime nije upisano u radni profil', draw: () => <EditProfile saved workName="failed" /> },
    { key: 'edit-profile-work-retry', label: 'Lični podaci: ime se upisuje ponovo', draw: () => <EditProfile saved workName="retrying" /> },
    { key: 'edit-profile-busy', label: 'Lični podaci: čuva se', draw: () => <EditProfile busy /> },
    { key: 'edit-profile-unknown', label: 'Lični podaci: ishod nepoznat', draw: () => <EditProfile uncertain error="Čuvanje nije potvrđeno." /> },
    { key: 'edit-profile-large', label: 'Lični podaci: veliki tekst (1,3)', large: true, draw: () => <EditProfile name="Aleksandra Stefanović-Radosavljević" saved workName="failed" /> },
    { key: 'edit-profile-owner', label: 'Lični podaci: tekst 1,15', owner: true, draw: () => <EditProfile /> },
    { key: 'name-loading', label: 'Ime: učitavanje', draw: () => <SettingsScreen title="Lični podaci" onBack={toList.current}>
      <StateView kind="loading" title="Učitavamo podatke…" skeleton={{ count: 1, rows: 1 }} /></SettingsScreen> },
    { key: 'name-error', label: 'Ime: greška', draw: () => <SettingsScreen title="Lični podaci" onBack={toList.current}>
      <StateView kind="error" title="Ime nije učitano" body="Profil nije pronađen. Osveži prikaz." primary={{ label: 'Proveri sačuvane podatke', onPress: noop }} />
    </SettingsScreen> },
    { key: 'name-edit', label: 'Ime: izmena', draw: () => <Name savedName="Ana Petrović" /> },
    { key: 'name-empty', label: 'Ime: prazno (obriši polje)', draw: () => <Name savedName="" /> },
    { key: 'name-saved', label: 'Ime: sačuvano', draw: () => <Name savedName="Ana Petrović" saved /> },
    { key: 'name-reading', label: 'Ime: ponovno čitanje (promeni ime)', draw: () => <Name savedName="Ana Petrović" reading /> },
    { key: 'name-unknown', label: 'Ime: ishod nepoznat', draw: () => <Name savedName="Ana Petrović" uncertain error="Čuvanje nije potvrđeno." /> },
  ] },
];
const SCENES = GROUPS.flatMap(group => group.scenes);

export default function DizajnProfil() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  // A scene can be opened by its address too (`?scene=hub-active`, `?scene=hub-large`), so the design lab can draw it without a tap.
  // Such a scene has no "Nazad" laid over the bar: what is drawn is the real screen, with the control that really is at the top right.
  const params = useLocalSearchParams<{ scene?: string | string[] }>();
  const fromAddress = SCENES.find(item => item.key === params.scene)?.key ?? null;
  const [picked, setPicked] = useState<string | null>(fromAddress);
  useEffect(() => { setPicked(fromAddress); }, [fromAddress]);
  const scene = picked;
  toList.current = () => setPicked(null);
  // Android Back inside a scene returns to the list, as the arrow and "Nazad" do.
  useEffect(() => {
    if (!scene) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setPicked(null); return true; });
    return () => subscription.remove();
  }, [scene]);
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  const current = SCENES.find(item => item.key === scene);
  if (current) {
    const drawn = <View style={s.grow}>{current.draw()}</View>;
    return <View style={s.screen}>
      {current.large ? <GalleryLargeText>{drawn}</GalleryLargeText> : current.owner ? <GalleryLargeText scale={1.15}>{drawn}</GalleryLargeText> : drawn}
      {/* Over the top bar's empty right side, not in a strip under the scene: a bottom strip added its own height and a
          second bottom inset, so every sticky footer sat higher than on the real screen. The scene's name is its hint. */}
      {scene !== fromAddress ? <SafeAreaView edges={['top']} pointerEvents="box-none" style={s.overlay}>
        <Press accessibilityRole="button" accessibilityLabel="Nazad na listu scena" accessibilityHint={current.label} haptic="select"
          onPress={() => setPicked(null)} style={s.back}>
          <T variant="action" style={s.backText}>Nazad</T>
        </Press>
      </SafeAreaView> : null}
    </View>;
  }
  return <Screen kind="detail" header={<DetailTopBar title="Galerija profila" onBack={() => router.back()} />}>
    {GROUPS.map(group => <Section key={group.title} title={group.title}>
      {group.scenes.map((item, index) => <ListRow key={item.key} title={item.label} accessibilityLabel={item.label} last={index === group.scenes.length - 1}
        onPress={() => setPicked(item.key)} />)}
    </Section>)}
  </Screen>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  grow: { flex: 1, minWidth: 0 },
  overlay: { position: 'absolute', top: 0, right: 0, paddingTop: sys.space.xs, paddingRight: sys.space.base },
  back: { minHeight: 48, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong,
    backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  backText: { color: sys.color.green },
  photo: { width: 160, height: 160, borderRadius: sys.radius.pill },
  editFace: { width: EDIT_PHOTO, height: EDIT_PHOTO, borderRadius: sys.radius.pill },
  face: { width: PROFILE_AVATAR, height: PROFILE_AVATAR, borderRadius: sys.radius.pill },
});
