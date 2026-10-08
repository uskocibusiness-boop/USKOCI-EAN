import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import type { DataExportStatus } from '../contracts/dataExport';
import type { LegalBundleStatus } from '../contracts/legal';
import type { DogovorProjekcija } from '../contracts/projections';
import type { RetentionExecutionStatus, RetentionPolicyStatus } from '../contracts/retentionPolicy';
import type { BuildIdentity } from '../data/buildIdentity';
import type { ClosureExecutionReview, ClosureExecutionState } from '../data/closureExecutionClientService';
import type { MyBlockedAccounts } from '../data/safetyClientService';
import type { SupportDetail, SupportInbox } from '../data/supportCaseTypes';
import { ClosureView, type ClosureModel } from '../ui/closure/ClosurePresentation';
import { GalleryLargeText } from '../ui/profile/GalleryLargeText';
import { AboutView } from '../ui/settings/AboutPresentation';
import { BlockedAccountsList } from '../ui/settings/BlockedAccountsList';
import { LegalReviewView, PublicLegalBody } from '../ui/legal/LegalDocuments';
import type { LegalReviewState } from '../ui/legal/legalReview';
import { ExportScreenView, type NoticeTone } from '../ui/privacy/ExportPresentation';
import { PrivacyBody, type PrivacyRead } from '../ui/privacy/PrivacyPresentation';
import { hubWords, type HubWords } from '../ui/profile/hubStates';
import { Press } from '../ui/Press';
import { ProductSheet } from '../ui/product/ProductSheet';
import { SettingsAction, SettingsRow, SettingsScreen } from '../ui/settings/SettingsPresentation';
import { bugReportPreset } from '../ui/support/bugReportPreset';
import { SupportMessagePreviewSheet } from '../ui/support/SupportContextEntry';
import { initialSupportState, type SupportState } from '../ui/support/SupportController';
import { SupportDetailView } from '../ui/support/SupportDetailScreen';
import { SupportInboxView } from '../ui/support/SupportInboxScreen';
import { SupportNewView } from '../ui/support/SupportNewScreen';
import type { useSupportController } from '../ui/support/useSupportController';
import { useConfirmSheet } from '../ui/system/ConfirmSheet';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { ListRow } from '../ui/system/ListRow';
import { Screen } from '../ui/system/Screen';
import { Section } from '../ui/system/Section';
import { sys } from '../ui/system/tokens';
import { T } from '../ui/Text';

/**
 * Privatnost, podaci, pravila, zatvaranje naloga i podrška (owner step 11b) on the emulator, in every state the lead
 * photographs. Reached only by its address (uskociapp://dizajn-privatnost) in the internal build; the store package shows
 * nothing. The real presentation components draw fixture data: nothing here reads or writes anything. Every command is a
 * local stand-in (the support screens get a controller that is absent, so every command is a no-op, and every way out of
 * a support scene, its arrow included, returns to this list; the closure start asks its real question and does nothing
 * when confirmed). The fixture words marked "Primer" are placeholders, never the
 * owner's published legal text.
 */
type Scene = { key: string; group: string; label: string };
const SCENES: Scene[] = [
  // The hub (approved draft of the product, 8 Oct 2026, P5): one list of rows, each with its own state; "Rokovi čuvanja" is a row that opens in place.
  ['privatnost-cvoriste', 'Privatnost', 'Čvorište: redovi sa stanjem'], ['privatnost-cvoriste-stanja', 'Privatnost', 'Čvorište: izvoz spreman, blokirane osobe, pravila prihvaćena'],
  ['privatnost-cvoriste-nepoznato', 'Privatnost', 'Čvorište: stanja nisu pročitana'],
  ['privatnost-ucitavanje', 'Privatnost', 'Rokovi: učitavanje'], ['privatnost-nije-objavljeno', 'Privatnost', 'Rokovi nisu objavljeni'],
  ['privatnost-objavljeno', 'Privatnost', 'Objavljeni rokovi i brisanje'], ['privatnost-greska', 'Privatnost', 'Greška čitanja'],
  ['izvoz-ucitavanje', 'Izvoz', 'Učitavanje'], ['izvoz-bez-zahteva', 'Izvoz', 'Bez zahteva'], ['izvoz-zahtev', 'Izvoz', 'Zahtev zabeležen'],
  ['izvoz-nije-spremno', 'Izvoz', 'Priprema nije dostupna'], ['izvoz-spremno', 'Izvoz', 'Kopija spremna, sačuvana'],
  ['izvoz-kopija-nedostupna', 'Izvoz', 'Kopija nije dostupna'],
  ['izvoz-u-toku', 'Izvoz', 'Čuvanje u toku (onemogućeno)'], ['izvoz-isteklo', 'Izvoz', 'Kopija istekla'], ['izvoz-otkazano', 'Izvoz', 'Zahtev otkazan'],
  ['izvoz-neuspeh', 'Izvoz', 'Priprema nije završena'], ['izvoz-greska', 'Izvoz', 'Greška čitanja'],
  ['pravila-ucitavanje', 'Pravila', 'Učitavanje'], ['pravila-nije-objavljeno', 'Pravila', 'Nisu objavljena'],
  ['pravila-prihvatanje', 'Pravila', 'Za prihvatanje, dugi nazivi'], ['pravila-u-toku', 'Pravila', 'Prihvatanje u toku'],
  ['pravila-ishod', 'Pravila', 'Ishod nepoznat'], ['pravila-prihvaceno', 'Pravila', 'Prihvaćeno'], ['pravila-javno', 'Pravila', 'Javni dokumenti (sheet)'],
  ['zatvaranje-ucitavanje', 'Zatvaranje', 'Učitavanje'], ['zatvaranje-greska', 'Zatvaranje', 'Greška čitanja'],
  ['zatvaranje-obaveze', 'Zatvaranje', 'Obaveze'], ['zatvaranje-priprema', 'Zatvaranje', 'Priprema potrebna'],
  ['zatvaranje-pregled', 'Zatvaranje', 'Pregled spreman'], ['zatvaranje-nepotvrdjeno', 'Zatvaranje', 'Nepotvrđen zahtev'],
  ['zatvaranje-u-toku', 'Zatvaranje', 'Obrada u toku'], ['zatvaranje-zatvoren', 'Zatvaranje', 'Nalog zatvoren'],
  ['podrska-lista', 'Podrška', 'Lista zahteva'], ['podrska-prazno', 'Podrška', 'Prazno'], ['podrska-ucitavanje', 'Podrška', 'Učitavanje'],
  ['podrska-greska', 'Podrška', 'Greška'], ['podrska-operater', 'Podrška', 'Operaterski inbox'],
  ['novi-forma', 'Novi zahtev', 'Forma'], ['novi-dogovor', 'Novi zahtev', 'Tema traži Dogovor'], ['novi-poruka', 'Novi zahtev', 'Sa izabranom porukom'],
  ['novi-greska', 'Novi zahtev', 'Prijava greške u aplikaciji'], ['novi-nepotvrdjeno', 'Novi zahtev', 'Nepotvrđeno slanje'], ['novi-potvrdjeno', 'Novi zahtev', 'Potvrđen'],
  ['novi-nedostupno', 'Novi zahtev', 'Nije dostupno'],
  ['zahtev-razgovor', 'Zahtev', 'Razgovor i odluka'], ['zahtev-operater', 'Zahtev', 'Operater'], ['zahtev-zatvoren', 'Zahtev', 'Zatvoren'],
  ['zahtev-ucitavanje', 'Zahtev', 'Učitavanje'], ['zahtev-greska', 'Zahtev', 'Greška'],
  ['poruka-podrska', 'Poruka', 'Izabrana poruka (sheet)'],
  ['o-aplikaciji', 'O aplikaciji', 'Znak, dve mogućnosti, pravila'],
  ['blokirani-prazno', 'Blokirane osobe', 'Nema nikoga'], ['blokirani-lista', 'Blokirane osobe', 'Tri osobe, jedna bez imena'],
  ['blokirani-dugo', 'Blokirane osobe', 'Dugo ime'], ['blokirani-stranica', 'Blokirane osobe', 'Ima još osoba'],
  ['blokirani-ucitavanje', 'Blokirane osobe', 'Učitavanje'], ['blokirani-greska', 'Blokirane osobe', 'Lista nije učitana'],
  ['blokirani-proveri', 'Blokirane osobe', 'Lista prikazana, provera potrebna'],
  ['privatnost-veliki', 'Veliki tekst (1,3)', 'Privatnost'], ['izvoz-veliki', 'Veliki tekst (1,3)', 'Izvoz: kopija spremna'],
  ['pravila-veliki', 'Veliki tekst (1,3)', 'Pravila: za prihvatanje'], ['o-aplikaciji-veliki', 'Veliki tekst (1,3)', 'O aplikaciji'],
  ['podrska-veliki', 'Veliki tekst (1,3)', 'Podrška: lista zahteva'], ['novi-greska-veliki', 'Veliki tekst (1,3)', 'Prijava greške u aplikaciji'],
  ['blokirani-veliki', 'Veliki tekst (1,3)', 'Blokirane osobe: dugo ime'],
  ['privatnost-vlasnik', 'Tekst 1,15 (vlasnikov telefon)', 'Privatnost'], ['izvoz-vlasnik', 'Tekst 1,15 (vlasnikov telefon)', 'Izvoz: bez zahteva'],
  ['pravila-vlasnik', 'Tekst 1,15 (vlasnikov telefon)', 'Pravila: za prihvatanje'], ['podrska-vlasnik', 'Tekst 1,15 (vlasnikov telefon)', 'Podrška: prazno'],
  ['blokirani-vlasnik', 'Tekst 1,15 (vlasnikov telefon)', 'Blokirane osobe: tri osobe'], ['o-aplikaciji-vlasnik', 'Tekst 1,15 (vlasnikov telefon)', 'O aplikaciji'],
].map(([key, group, label]) => ({ key, group, label }));
/** The groups of scenes, in the order they first appear. */
const GROUPS = [...new Set(SCENES.map(item => item.group))];
/** The scenes drawn at text scale 1.3: the same scene as its twin, with the components told "large". */
const LARGE: Readonly<Record<string, string>> = { 'privatnost-veliki': 'privatnost-cvoriste-stanja', 'izvoz-veliki': 'izvoz-spremno',
  'pravila-veliki': 'pravila-prihvatanje', 'o-aplikaciji-veliki': 'o-aplikaciji', 'podrska-veliki': 'podrska-lista', 'novi-greska-veliki': 'novi-greska',
  'blokirani-veliki': 'blokirani-dugo' };
/** The scenes drawn at the owner's own text scale, 1.15 (his phone, 361 dp): the same scene as its twin, zoomed in the web lab. */
const AT_OWNER_SIZE: Readonly<Record<string, string>> = { 'privatnost-vlasnik': 'privatnost-cvoriste-stanja', 'izvoz-vlasnik': 'izvoz-bez-zahteva',
  'pravila-vlasnik': 'pravila-prihvatanje', 'podrska-vlasnik': 'podrska-prazno', 'blokirani-vlasnik': 'blokirani-lista', 'o-aplikaciji-vlasnik': 'o-aplikaciji' };

/** The build a bug report names: made-up, like every fixture here. */
const BUILD: BuildIdentity = { version: '1.4.2', sourceCommit: 'abcdef0123456789abcdef0123456789abcdef01', sourceDirty: false, backendTarget: 'canonical',
  runtimeVersion: '1.4.2', updateChannel: 'preview' };
const NOW = Date.now(), hour = 3_600_000;
const iso = (offset: number) => new Date(NOW + offset).toISOString();
const noop = () => {};

// Privatnost
const POLICY_UNPUBLISHED: RetentionPolicyStatus = { ready: false, reason: 'RETENTION_POLICY_NOT_PUBLISHED', missingDataClasses: [] };
const rule = (dataClass: string) => ({ dataClass, purpose: 'Primer svrhe čuvanja za prikaz rasporeda.', retentionPeriod: 'Primer roka: dok nalog postoji.',
  deletionTrigger: 'Primer: posle zatvaranja naloga.', exceptionRule: 'Primer izuzetka koji traje duže od jednog reda teksta na uskom ekranu.',
  legalBasis: 'Primer pravnog osnova.' });
const POLICY: RetentionPolicyStatus = { ready: true, policyVersion: 'primer-2026-09', effectiveAt: iso(-48 * hour),
  rules: ['ACCOUNT_IDENTITY', 'PROFILE_DATA', 'AI_VOLATILE', 'MEDIA_OBJECTS', 'AUDIT_SECURITY_LOGS'].map(rule) };
const EXECUTION = (admitted: boolean): RetentionExecutionStatus => ({ engineVersion: 'P3_AI_ABANDONED_UNBOUND_V1', executionAdmitted: admitted,
  policyVersion: admitted ? 'primer-2026-09' : null, unsupportedDataClasses: [], storageCleanup: 'NOT_APPLICABLE',
  datasets: [{ dataset: 'AI_ABANDONED_UNBOUND', dataClass: 'AI_VOLATILE', action: 'DELETE', ready: admitted, reason: admitted ? null : 'POLICY_NOT_READY' }] });
const read = <V,>(data: V | null, loading = false, error = false): PrivacyRead<V> => ({ data, loading, error });
// The state of the hub's rows, from the same functions the route uses over fixtures.
const WORDS_A = hubWords({ blocked: { count: 0, more: false }, exportPhase: 'NONE', legal: 'UNPUBLISHED' });
const WORDS_B = hubWords({ blocked: { count: 2, more: false }, exportPhase: 'READY_AVAILABLE', legal: 'ACCEPTED' });

// Blokirane osobe: the names are made up; one person has no name the server returned (never letters made up for them).
const blockedPerson = (n: number, displayName: string | null): MyBlockedAccounts['items'][number] => ({ accountId: 'galerija', blocked: true, revision: 1,
  authoritative: true, targetAccountId: `00000000-0000-4000-8000-00000000010${n}`, displayName });
const BLOCKS = (items: MyBlockedAccounts['items'], nextCursor: string | null = null): MyBlockedAccounts => ({ accountId: 'galerija', items, nextCursor, authoritative: true });
const THREE = BLOCKS([blockedPerson(1, 'Marko Marić'), blockedPerson(2, null), blockedPerson(3, 'Jelena Ilić')]);

// Izvoz
const exportStatus = (state: 'REQUESTED' | 'READY' | 'CANCELLED' | 'FAILED' | 'EXPIRED' | null, expiresIn?: number): DataExportStatus => ({
  hasRequest: state !== null, downloadAvailable: expiresIn !== undefined && expiresIn > 0, serverFulfillmentRequired: true, externalDsrChannelReady: false,
  fulfillment: expiresIn === undefined ? null : { artifactAvailable: true, artifactGeneration: 'galerija', artifactExpiresAt: iso(expiresIn),
    byteLength: 1_468_006, sha256: 'a'.repeat(64), md5: 'b'.repeat(32) },
  request: state ? { receiptId: 'galerija', clientRequestId: 'galerija', status: state, requestedAt: iso(-2 * hour), updatedAt: iso(-hour),
    cancelledAt: null, completedAt: null, failureCode: null } : null,
});

// Pravila
const BUNDLE: LegalBundleStatus = { ready: true, acceptedCurrentBundle: false, reason: null, documents: [
  { kind: 'TERMS', version: 'RC2', sha256: 'a'.repeat(64), url: 'https://example.com/uslovi', publishedAt: iso(-72 * hour), effectiveAt: iso(-72 * hour) },
  { kind: 'PRIVACY', version: 'V1', sha256: 'b'.repeat(64), url: 'https://example.com/privatnost', publishedAt: iso(-72 * hour), effectiveAt: iso(-72 * hour) },
] };
const provider = (code: string, name: string, entity: string) => ({ providerCode: code, providerDisplayName: name, legalEntityName: entity,
  legalRole: 'PROCESSOR' as const, purpose: 'Primer svrhe obrade.', dataCategories: ['Primer kategorije', 'Druga kategorija'],
  processingRegions: 'Primer regiona', crossBorderTransfer: false, transferMechanism: '', dpaReference: 'Primer ugovora', privacyNoticeUrl: 'https://example.com/obrada',
  retentionDeletionTerms: 'Primer čuvanja i brisanja.', subprocessorTerms: '', legalBasisReference: 'Primer osnova' });
const legal = (patch: Partial<LegalReviewState>): LegalReviewState => ({ bundle: BUNDLE, loading: false, busy: false, error: null, processorError: null,
  pending: null, receipt: null, processors: { ready: true, mapVersion: 'primer-1', effectiveAt: iso(-72 * hour), providers: [
    provider('A', 'Primer obrađivača sa veoma dugim nazivom usluge koji se lomi u dva reda', 'Primer pravnog lica d.o.o. Beograd — Novi Beograd'),
    provider('B', 'Drugi obrađivač', 'Drugo pravno lice')] }, ...patch });

// Zatvaranje
const REVIEW: ClosureExecutionReview = { accountId: 'galerija', requestId: 'galerija', revision: 1, ready: true, policySha256: 'a'.repeat(64),
  blockers: [], code: null, authoritative: true, retainedDatasets: [
    { dataClass: 'ACCOUNT_IDENTITY', action: 'RETAIN_RESTRICTED', retentionSeconds: 30 * 86400, trigger: 'CLOSURE_REQUESTED', ruleSha256: 'c'.repeat(64) },
    { dataClass: 'AUDIT_SECURITY_LOGS', action: 'RETAIN_RESTRICTED', retentionSeconds: 365 * 86400, trigger: 'CLOSURE_REQUESTED', ruleSha256: 'd'.repeat(64) }] };
const closure = (patch: Partial<ClosureModel>): ClosureModel => ({ busy: false, working: null, message: '', review: null, intent: null, state: null, absent: false, ...patch });
const EXECUTING: ClosureExecutionState = { accountId: 'galerija', requestId: 'galerija', generation: 'galerija', state: 'EXECUTING', policySha256: 'a'.repeat(64),
  authoritative: true, adapterVersion: 'OWNER_AF_D22_EVENT_ERASURE_V1', ordinaryContentErased: false, completedSteps: 31, totalSteps: 74,
  exceptions: ['SCOPED_EVIDENCE_REVIEW_REQUIRED'] };
const CLOSED: ClosureExecutionState = { accountId: 'galerija', requestId: 'galerija', generation: 'galerija', state: 'CLOSED', policySha256: 'a'.repeat(64),
  authoritative: true, closedAt: iso(-hour), retainedDatasets: REVIEW.retainedDatasets ?? [] };

// Podrška
const OWNER = { id: 1, accountId: 'galerija', accountRevision: 1, identity: 'GALERIJA' };
// `leave` is where every way out of a support scene goes (the arrow, a row, a link): back to the scene list, never a
// route (round 5c review: the arrow was a dead button).
const supportModel = (leave: () => void) => (patch: Partial<SupportState>) => ({ state: { ...initialSupportState, phase: 'READY', ...patch } as SupportState,
  controller: null, current: () => true, navigate: () => leave(), accountId: 'galerija', accountRevision: 1, incarnation: OWNER, incarnationId: 1,
  focused: true }) as unknown as ReturnType<typeof useSupportController>;
const CAPS = { accountId: 'galerija', operatorAvailable: false, canCreate: true, authoritative: true } as const;
const row = (id: string, topic: SupportInbox['cases'][number]['topic'], status: SupportInbox['cases'][number]['status'], channel: SupportInbox['cases'][number]['channel'],
  unread: boolean, age: number) => ({ id, caseNumber: String(70 + Number(id.slice(-1))), channel, topic, status, revision: 1, lastSequence: '3',
  createdAt: iso(-age), updatedAt: iso(-age / 2), context: null, unread });
const INBOX: SupportInbox = { accountId: 'galerija', mode: 'OWN', operatorAvailable: false, authoritative: true, nextBeforeCaseNumber: '60', cases: [
  row('00000000-0000-4000-8000-000000000001', 'NO_SHOW', 'WAITING_FOR_AUTHOR', 'TASK', true, 3 * hour),
  row('00000000-0000-4000-8000-000000000002', 'TECHNICAL', 'IN_REVIEW', 'SERVICE', false, 26 * hour),
  row('00000000-0000-4000-8000-000000000003', 'SERVICE_COMPLAINT', 'DECIDED', 'SERVICE', true, 70 * hour),
  row('00000000-0000-4000-8000-000000000004', 'PRIVACY_RIGHTS', 'CLOSED', 'LEGAL_PRIVACY', false, 400 * hour)] };
const CASE = '00000000-0000-4000-8000-0000000000aa', DECISION = '00000000-0000-4000-8000-0000000000bb';
const detail = (patch: Partial<SupportDetail> = {}, status: SupportDetail['case']['status'] = 'IN_REVIEW'): SupportDetail => ({ accountId: 'galerija',
  viewerRole: 'AUTHOR', operatorAvailable: false, allowedActions: ['AUTHOR_REPLY', 'APPEAL'], authoritative: true, nextAfterSequence: null,
  // Fixture words without grammatical gender (owner rule): these screenshots go to the owner.
  case: { id: CASE, caseNumber: '71', authorAccountId: 'galerija', title: 'Niko se nije pojavio u dogovorenom terminu, a Dogovor i dalje stoji kao aktivan',
    desiredOutcome: 'Da se Dogovor zatvori bez ocene.', channel: 'TASK', topic: 'NO_SHOW', status, revision: 3, lastSequence: '6',
    createdAt: iso(-30 * hour), updatedAt: iso(-hour), context: {} },
  events: [
    { id: 'e1', caseId: CASE, sequence: '1', kind: 'CREATED', authorRole: 'AUTHOR', body: null, createdAt: iso(-30 * hour), decisionId: null, appealId: null },
    { id: 'e2', caseId: CASE, sequence: '2', kind: 'CLAIM', authorRole: 'OPERATOR', body: null, createdAt: iso(-28 * hour), decisionId: null, appealId: null },
    { id: 'e3', caseId: CASE, sequence: '3', kind: 'REQUEST_INFO', authorRole: 'OPERATOR', body: 'Možeš li da napišeš za koliko sati je bio dogovor i da li je bilo poziva?',
      createdAt: iso(-27 * hour), decisionId: null, appealId: null },
    { id: 'e4', caseId: CASE, sequence: '4', kind: 'AUTHOR_REPLY', authorRole: 'AUTHOR', body: 'Za 10:00. Dva poziva su ostala bez odgovora.', createdAt: iso(-26 * hour), decisionId: null, appealId: null },
    { id: 'e5', caseId: CASE, sequence: '5', kind: 'AUTHOR_REPLY', authorRole: 'AUTHOR', body: 'Čekanje je trajalo do 11.', createdAt: iso(-26 * hour + 60_000), decisionId: null, appealId: null },
    { id: 'e6', caseId: CASE, sequence: '6', kind: 'DECIDE', authorRole: 'OPERATOR', body: null, createdAt: iso(-2 * hour), decisionId: DECISION, appealId: null },
  ],
  decisions: [{ id: DECISION, caseId: CASE, caseRevision: 3, outcome: 'ACCEPTED', reasonCode: 'NO_SHOW_CONFIRMED', explanation: 'Primer obrazloženja odluke.',
    effect: 'NONE', evidenceIds: [], priorDecisionId: null, createdAt: iso(-2 * hour), reviewType: 'INITIAL' }],
  appeals: [], evidence: [], ...patch });
const OPERATOR = detail({ viewerRole: 'OPERATOR', operatorAvailable: true, allowedActions: ['OPERATOR_REPLY', 'REQUEST_INFO', 'DECIDE', 'CLOSE', 'CLAIM_APPEAL'],
  appeals: [{ id: 'a1', caseId: CASE, decisionId: DECISION, status: 'RECEIVED', decisionResultId: null, createdAt: iso(-hour) }] });
const AGREEMENTS = [{ id: '00000000-0000-4000-8000-0000000000c1', verzija: 2, naslov: 'Unos ormara na treći sprat', vremeTekst: '27. sep · 10:00–12:00' },
  { id: '00000000-0000-4000-8000-0000000000c2', verzija: 1, naslov: 'Selidba garsonjere sa Limana na Grbavicu, subota pre podne',
    vremeTekst: '4. okt · 09:00–13:00' }] as unknown as DogovorProjekcija[];

export default function DizajnPrivatnost() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  // A scene can be opened by its address too (`?scene=privatnost-objavljeno`, `?scene=izvoz-veliki`), so the design lab can draw it without a
  // tap; such a scene has no bar under it: what is drawn is the real screen. A "veliki" scene is its twin drawn at text scale 1.3.
  const params = useLocalSearchParams<{ scene?: string | string[] }>();
  const fromAddress = SCENES.find(item => item.key === params.scene)?.key ?? null;
  const [picked, setPicked] = useState<string | null>(fromAddress);
  useEffect(() => { setPicked(fromAddress); }, [fromAddress]);
  const large = picked !== null && picked in LARGE, ownerText = picked !== null && picked in AT_OWNER_SIZE;
  const scene = picked !== null && large ? LARGE[picked] : picked !== null && ownerText ? AT_OWNER_SIZE[picked] : picked;
  const [expanded, setExpanded] = useState<string | null>(null), [retentionOpen, setRetentionOpen] = useState(false);
  const confirm = useConfirmSheet(), closeQuestion = confirm.close;
  // Android Back inside a scene returns to the list, as "Nazad" does (the sibling galleries do the same). An open sheet
  // takes Back first (its own Modal); the "Odbaciti zahtev?" question of a typed Novi zahtev is shown by its arrow.
  useEffect(() => {
    if (!scene) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { closeQuestion(); setExpanded(null); setPicked(null); return true; });
    return () => subscription.remove();
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  const toList = () => { confirm.close(); setExpanded(null); setPicked(null); };
  const model = supportModel(toList);
  if (!scene) return <Screen kind="detail" header={<DetailTopBar title="Galerija: privatnost i podrška" onBack={() => router.back()} />}>
    <T variant="note" tone="muted">Primeri stanja sa izmišljenim podacima. Ništa se ne čita i ne šalje.</T>
    {GROUPS.map(group => <Section key={group} title={group}>
      {SCENES.filter(item => item.group === group).map((item, index, all) => <ListRow key={item.key} title={item.label} accessibilityLabel={`${item.group}: ${item.label}`}
        last={index === all.length - 1} onPress={() => setPicked(item.key)} />)}
    </Section>)}
    <SettingsAction label="Zatvori galeriju" kind="quiet" onPress={() => router.back()} />
  </Screen>;

  // `open`: "Rokovi čuvanja" drawn open (the scenes about the schedule); otherwise the row is the person's own to open, and starts closed.
  const privacy = (policy: PrivacyRead<RetentionPolicyStatus>, execution: PrivacyRead<RetentionExecutionStatus>, admitted = false,
    options: { open?: boolean; words?: HubWords } = {}) =>
    <SettingsScreen title="Privatnost i podaci" onBack={toList}>
      <PrivacyBody policy={policy} execution={execution} admitted={admitted} expandedRule={expanded} onToggle={(key, next) => setExpanded(next ? key : null)}
        onRefresh={noop} retentionOpen={options.open ?? retentionOpen} onToggleRetention={setRetentionOpen} words={options.words ?? WORDS_A} onOpen={noop}
        closure={<SettingsRow compact last label="Zatvaranje naloga" detail="Pregledaj dostupnost, obaveze i pravila čuvanja pre pokretanja zahteva." onPress={noop} />} />
    </SettingsScreen>;
  const exportView = (status: DataExportStatus | null, options: { loading?: boolean; failure?: boolean; busy?: boolean; notReady?: boolean;
    notice?: { text: string; tone: NoticeTone }; primary?: ReactNode } = {}) =>
    <ExportScreenView onBack={toList} loading={!!options.loading} status={status} now={Date.now()} busy={!!options.busy} notice={options.notice ?? null}
      failure={options.failure ? { title: 'Stanje izvoza nije učitano', body: 'Stanje izvoza nije dostupno.' } : null}
      preparation={options.notReady ? { receiptId: 'galerija', kind: 'NOT_READY', code: 'POLICY_NOT_READY' } : null}
      primary={options.primary ?? null} onCancel={noop} onRevoke={noop} onRefresh={noop} refreshDisabled={false} />;
  const blocked = (data: MyBlockedAccounts | null, options: { loading?: boolean; error?: string | null; uncertain?: boolean; cursor?: string | null } = {}) =>
    <SettingsScreen title="Blokirane osobe" onBack={toList}>
      <BlockedAccountsList data={data} loading={!!options.loading} busy={false} error={options.error ?? null} uncertain={!!options.uncertain}
        cursor={options.cursor ?? null} pending={null} onOpen={noop} onUnblock={noop} onRefresh={noop} onPage={noop} />
    </SettingsScreen>;
  const legalView = (state: LegalReviewState, action: ReactNode = null) =>
    <LegalReviewView state={state} onBack={toList} action={action} linkError={null} onOpen={noop} onOpenUrl={noop} onRefresh={noop} />;
  const closureView = (value: ClosureModel) => <ClosureView model={value} commands={{ onClose: toList, onPrepare: noop, onRetry: noop, onRefresh: noop,
    onLogout: noop, onSupport: noop, onBlocker: noop, onExport: noop,
    onAskStart: () => confirm.ask({ title: 'Zatvoriti nalog?', message: 'Posle ovog koraka nalog se zaključava i podaci se uklanjaju. To ne možeš da poništiš.',
      confirmLabel: 'Da, trajno zatvori nalog', cancelLabel: 'Odustani', tone: 'danger', onConfirm: noop }) }} />;

  const body = scene === 'privatnost-cvoriste' ? privacy(read(POLICY_UNPUBLISHED), read(EXECUTION(false)))
    : scene === 'privatnost-cvoriste-stanja' ? privacy(read(POLICY), read(EXECUTION(true)), true, { words: WORDS_B })
    : scene === 'privatnost-cvoriste-nepoznato' ? privacy(read(POLICY_UNPUBLISHED), read(EXECUTION(false)), false, { words: {} })
    : scene === 'privatnost-ucitavanje' ? privacy(read<RetentionPolicyStatus>(null, true), read<RetentionExecutionStatus>(null, true), false, { open: true })
    : scene === 'privatnost-nije-objavljeno' ? privacy(read(POLICY_UNPUBLISHED), read(EXECUTION(false)), false, { open: true })
    : scene === 'privatnost-objavljeno' ? privacy(read(POLICY), read(EXECUTION(true)), true, { open: true })
    : scene === 'privatnost-greska' ? privacy(read<RetentionPolicyStatus>(null, false, true), read<RetentionExecutionStatus>(null, false, true), false, { open: true })
    : scene === 'izvoz-ucitavanje' ? exportView(null, { loading: true })
    : scene === 'izvoz-bez-zahteva' ? exportView(exportStatus(null), { primary: <SettingsAction label="Zatraži izvoz" onPress={noop} /> })
    : scene === 'izvoz-zahtev' ? exportView(exportStatus('REQUESTED'), { notice: { text: 'Zahtev za izvoz je zabeležen.', tone: 'success' },
      primary: <SettingsAction label="Pripremi kopiju" onPress={noop} /> })
    : scene === 'izvoz-nije-spremno' ? exportView(exportStatus('REQUESTED'), { notReady: true, primary: <SettingsAction label="Pripremi kopiju" onPress={noop} /> })
    : scene === 'izvoz-spremno' ? exportView(exportStatus('READY', 20 * hour), { notice: { text: 'Kopija je sačuvana u izabranoj fascikli.', tone: 'success' },
      primary: <SettingsAction label="Preuzmi i sačuvaj" onPress={noop} /> })
    // READY with no verified copy: the last step is stopped and the footer offers a new copy.
    : scene === 'izvoz-kopija-nedostupna' ? exportView(exportStatus('READY'), { primary: <SettingsAction label="Zatraži novu kopiju" onPress={noop} /> })
    : scene === 'izvoz-u-toku' ? exportView(exportStatus('READY', 20 * hour), { busy: true,
      primary: <SettingsAction label="Preuzmi i sačuvaj" loading disabled onPress={noop} /> })
    : scene === 'izvoz-isteklo' ? exportView(exportStatus('READY', -hour), { primary: <SettingsAction label="Zatraži novu kopiju" onPress={noop} /> })
    : scene === 'izvoz-otkazano' ? exportView(exportStatus('CANCELLED'), { notice: { text: 'Zahtev je otkazan.', tone: 'success' },
      primary: <SettingsAction label="Zatraži novu kopiju" onPress={noop} /> })
    : scene === 'izvoz-neuspeh' ? exportView(exportStatus('FAILED'), { notice: { text: 'Preuzeta kopija nije potvrđena. Osveži stanje.', tone: 'danger' },
      primary: <SettingsAction label="Zatraži novu kopiju" onPress={noop} /> })
    : scene === 'izvoz-greska' ? exportView(null, { failure: true })
    : scene === 'pravila-ucitavanje' ? legalView(legal({ loading: true, bundle: null, processors: null }))
    : scene === 'pravila-nije-objavljeno' ? legalView(legal({ bundle: { ready: false, acceptedCurrentBundle: false, reason: 'LEGAL_DOCUMENTS_NOT_PUBLISHED', documents: [] },
      processors: { ready: false, reason: 'PROCESSOR_MAP_NOT_PUBLISHED', missingProviders: [] } }))
    : scene === 'pravila-prihvatanje' ? legalView(legal({}), <SettingsAction label="Prihvati pregledane dokumente" onPress={noop} />)
    : scene === 'pravila-u-toku' ? legalView(legal({ busy: true, pending: 'READ_REQUIRED' }), <SettingsAction label="Prihvati pregledane dokumente" loading disabled onPress={noop} />)
    : scene === 'pravila-ishod' ? legalView(legal({ pending: 'READ_REQUIRED', error: 'Ne znamo da li je prihvatanje sačuvano. Proveri ponovo.' }),
      <SettingsAction label="Proveri da li je prihvaćeno" onPress={noop} />)
    : scene === 'pravila-prihvaceno' ? legalView(legal({ bundle: { ...BUNDLE, acceptedCurrentBundle: true } }))
    : scene === 'pravila-javno' ? <View style={s.screen}>
      <ProductSheet title="Politika privatnosti" onClose={toList}>{() => <PublicLegalBody loading={false} bundle={BUNDLE} error={null} onOpen={noop} onRefresh={noop} />}</ProductSheet>
    </View>
    : scene === 'zatvaranje-ucitavanje' ? closureView(closure({ busy: true }))
    : scene === 'zatvaranje-greska' ? closureView(closure({ message: 'Pregled trenutno nije dostupan. Pokušaj ponovo.' }))
    : scene === 'zatvaranje-obaveze' ? closureView(closure({ review: { ...REVIEW, ready: false, code: 'CLOSURE_BLOCKED', retainedDatasets: null,
      blockers: ['ACTIVE_AGREEMENT', 'OPEN_TASK', 'ACTIVE_APPLICATION', 'MEDIA_UPLOAD_PENDING'] } }))
    : scene === 'zatvaranje-priprema' ? closureView(closure({ review: { ...REVIEW, ready: false, code: 'CLOSURE_PREPARATION_REQUIRED', retainedDatasets: null } }))
    : scene === 'zatvaranje-pregled' ? closureView(closure({ review: REVIEW }))
    : scene === 'zatvaranje-nepotvrdjeno' ? closureView(closure({ review: REVIEW, absent: true,
      message: 'Ne znamo da li je zahtev za zatvaranje poslat. Sačuvan je na telefonu; možeš da ga pošalješ ponovo.',
      intent: { kind: 'START', accountId: 'galerija', clientRequestId: 'galerija', requestId: 'galerija', expectedRevision: 1, policySha256: 'a'.repeat(64) } }))
    : scene === 'zatvaranje-u-toku' ? closureView(closure({ state: EXECUTING }))
    : scene === 'zatvaranje-zatvoren' ? closureView(closure({ state: CLOSED }))
    : scene === 'podrska-lista' ? <SupportInboxView mode="OWN" model={model({ capabilities: CAPS, inbox: INBOX })} />
    : scene === 'podrska-prazno' ? <SupportInboxView mode="OWN" model={model({ capabilities: CAPS, inbox: { ...INBOX, cases: [], nextBeforeCaseNumber: null } })} />
    : scene === 'podrska-ucitavanje' ? <SupportInboxView mode="OWN" model={model({ phase: 'LOADING' })} />
    // The list read failed after the capabilities loaded: the error's own retry is the one green action.
    : scene === 'podrska-greska' ? <SupportInboxView mode="OWN" model={model({ phase: 'ERROR', capabilities: CAPS,
      message: 'Zahtevi trenutno nisu dostupni. Proveri vezu.' })} />
    : scene === 'podrska-operater' ? <SupportInboxView mode="OPERATOR" onMode={noop} model={model({ capabilities: { ...CAPS, operatorAvailable: true },
      inbox: { ...INBOX, mode: 'OPERATOR', operatorAvailable: true } })} />
    : scene === 'novi-forma' ? <SupportNewView reference={null} model={model({ capabilities: CAPS })} readAgreements={async () => AGREEMENTS} />
    : scene === 'novi-greska' ? <SupportNewView reference={null} preset={bugReportPreset(BUILD)} model={model({ capabilities: CAPS })} readAgreements={async () => AGREEMENTS} />
    : scene === 'novi-dogovor' ? <SupportNewView reference={{ kind: 'AGREEMENT', id: AGREEMENTS[0].id, revision: 2 }} model={model({ capabilities: CAPS })}
      readAgreements={async () => AGREEMENTS} />
    : scene === 'novi-poruka' ? <SupportNewView reference={{ kind: 'AGREEMENT_MESSAGE', id: '00000000-0000-4000-8000-0000000000d1', revision: 4 }}
      model={model({ capabilities: CAPS })} readAgreements={async () => AGREEMENTS} />
    : scene === 'novi-nepotvrdjeno' ? <SupportNewView reference={null} readAgreements={async () => AGREEMENTS} model={model({ capabilities: CAPS, absent: true,
      canReplay: true, message: 'Potvrda prethodne radnje još nije pronađena.', pending: { version: 1, accountId: 'galerija', clientRequestId: 'galerija',
        kind: 'CREATE', caseId: null, expectedRevision: null, inputSha256: 'a'.repeat(64) } })} />
    : scene === 'novi-potvrdjeno' ? <SupportNewView reference={null} model={model({ capabilities: CAPS, message: 'Radnja je potvrđena.',
      receipt: { accountId: 'galerija', clientRequestId: 'galerija', kind: 'CREATE', caseId: CASE, caseNumber: '72', expectedRevision: null, inputSha256: 'a'.repeat(64),
        eventId: 'e', sequence: '1', caseRevision: 1, createdAt: iso(-60_000), authoritative: true } })} />
    : scene === 'novi-nedostupno' ? <SupportNewView reference={null} model={model({ capabilities: { ...CAPS, canCreate: false } })} />
    : scene === 'zahtev-razgovor' ? <SupportDetailView caseId={CASE} model={model({ capabilities: CAPS, detail: detail() })} />
    : scene === 'zahtev-operater' ? <SupportDetailView caseId={CASE} model={model({ capabilities: { ...CAPS, operatorAvailable: true }, detail: OPERATOR })} />
    : scene === 'zahtev-zatvoren' ? <SupportDetailView caseId={CASE} model={model({ capabilities: CAPS, detail: detail({ allowedActions: [] }, 'CLOSED') })} />
    : scene === 'zahtev-ucitavanje' ? <SupportDetailView caseId={CASE} model={model({ phase: 'LOADING' })} />
    : scene === 'zahtev-greska' ? <SupportDetailView caseId={CASE} model={model({ phase: 'ERROR', message: 'Zahtev trenutno nije dostupan. Proveri vezu.' })} />
    : scene === 'poruka-podrska' ? <View style={s.screen}>
      <SupportMessagePreviewSheet previewText="U 10:00 niko nije otvorio vrata. Dva poziva su ostala bez odgovora." busy={false} disabled={false} error={null}
        onContinue={noop} onCancel={toList} />
    </View>
    : scene === 'o-aplikaciji' ? <AboutView onBack={toList} onRules={noop} onPrivacy={noop} />
    : scene === 'blokirani-prazno' ? blocked(BLOCKS([]))
    : scene === 'blokirani-lista' ? blocked(THREE)
    : scene === 'blokirani-dugo' ? blocked(BLOCKS([blockedPerson(1, 'Aleksandra Stefanović-Radosavljević'), blockedPerson(2, 'Marko Marić')]))
    : scene === 'blokirani-stranica' ? blocked(BLOCKS([blockedPerson(1, 'Marko Marić'), blockedPerson(2, 'Jelena Ilić')], '00000000-0000-4000-8000-000000000199'))
    : scene === 'blokirani-ucitavanje' ? blocked(null, { loading: true })
    : scene === 'blokirani-greska' ? blocked(null, { error: 'Lista trenutno nije dostupna. Proveri vezu.' })
    : scene === 'blokirani-proveri' ? blocked(THREE, { error: 'Čuvanje nije potvrđeno. Proveri listu pre novog pokušaja.', uncertain: true })
    : null;
  const current = SCENES.find(item => item.key === picked);
  const drawn = <View style={s.grow}>{body}</View>;
  return <View style={s.screen}>
    {large ? <GalleryLargeText>{drawn}</GalleryLargeText> : ownerText ? <GalleryLargeText scale={1.15}>{drawn}</GalleryLargeText> : drawn}
    {confirm.sheet}
    {/* Every scene's arrow returns here (in the support scenes every way out does; their other commands are no-op
        stand-ins). This bar says which scene is shown and is always one tap back. A scene opened by its address has none. */}
    {picked !== fromAddress ? <SafeAreaView edges={['bottom']} style={s.strip}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" haptic="select" onPress={toList} style={s.back}>
        <T variant="action" style={s.backText}>Nazad</T>
      </Press>
      <T variant="meta" tone="muted" numberOfLines={1} style={s.grow}>{current ? `${current.group} · ${current.label}` : ''}</T>
    </SafeAreaView> : null}
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  grow: { flex: 1, minWidth: 0 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingHorizontal: sys.space.base, paddingTop: sys.space.sm,
    backgroundColor: sys.color.wash },
  back: { minHeight: 48, minWidth: 96, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong,
    alignItems: 'center', justifyContent: 'center', marginBottom: sys.space.sm },
  backText: { color: sys.color.green },
});
