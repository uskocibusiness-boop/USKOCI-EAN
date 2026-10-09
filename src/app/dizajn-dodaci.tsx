import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import type { OwnerPreselectionQuestion, PublicPreselectionQa } from '../contracts/preselectionQa';
import type { AgreementChangeProposal, AgreementChangeSnapshot } from '../data/agreementClientService';
import type { GroupMessage } from '../data/groupConversationService';
import type { AgreementPhotosController } from '../hooks/useAgreementPhotos';
import { AgreementActionsPresentation, type AgreementActionForm, type AgreementActionsPresentationProps } from '../ui/agreements/AgreementActionsPresentation';
import { GroupConversationPresentation } from '../ui/groups/GroupConversationPresentation';
import type { GroupState } from '../ui/groups/GroupConversationController';
import { AgreementPhotoComposer } from '../ui/media/AgreementPhotoComposer';
import { TaskQaPresentation, type TaskQaPresentationProps } from '../ui/qa/TaskQaPresentation';
import { Press } from '../ui/Press';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { sys } from '../ui/system/tokens';
import { T } from '../ui/Text';
import { V2Action } from '../ui/v2/V2Action';

/**
 * The gallery of the Dogovor additions (round 6, unit dogovor-dodaci): the real presentations of task questions, Dogovor
 * changes and cancellation, the group conversation and the photo tray of Poruke, drawn from
 * fixtures in their main states so the lead can photograph them on the emulator. Reached only by its address
 * (uskociapp://dizajn-dodaci) in the internal build; the store package shows nothing. Nothing here reads or writes data:
 * every command is a no-op, no photo is read (no prepared photo carries a receipt), and the group's people are drawn with
 * their initials. Current-location sharing was retired by the owner on 2026-09-24.
 * Large text is the system's: set the font scale on the device.
 */
const noop = () => {};
const later = async () => {};

const ME = '10000000-0000-4000-8000-000000000001', OTHER = '10000000-0000-4000-8000-000000000002';
const NEED = '20000000-0000-4000-8000-000000000001', AGREEMENT = '30000000-0000-4000-8000-000000000001';

// ——— Pitanja i odgovori ———
const answered = (id: string, questionText: string, answerText: string, edited = false): PublicPreselectionQa =>
  ({ questionId: id, needRevision: 2, questionText, answerVersion: 1, answerText, edited } as PublicPreselectionQa);
const ownerQuestion = (id: string, questionText: string, status: OwnerPreselectionQuestion['status'], answerText: string | null = null, needRevision = 2) =>
  ({ questionId: id, needRevision, questionText, status, createdAt: '2026-09-24T08:00:00Z', answerVersion: answerText ? 1 : null, answerText, edited: false } as unknown as OwnerPreselectionQuestion);
const THREAD = [
  answered('q1', 'Da li zgrada ima lift?', 'Nema lifta, stan je na trećem spratu. Orman je već rasklopljen u dva dela.'),
  answered('q2', 'Da li treba poneti alat?', 'Ne treba, samo rukavice. Kombi čeka ispred ulaza.', true),
];
const qa = (patch: Partial<TaskQaPresentationProps>): TaskQaPresentationProps => ({
  title: 'Prenos ormana do kombija', mode: 'PUBLIC', loaded: true, busy: false, message: '', receipt: '', canRetryRead: true, material: false,
  recovery: null, cannotAsk: null, composer: { answering: null, revisionChanged: false, maxChars: 500 }, text: '', canAnswer: false,
  pending: [], answered: THREAD, set: [], historical: [],
  onBack: noop, onRefresh: noop, onText: noop, onSend: noop, onRetry: noop, onCancel: noop, onChoose: noop, onDispose: noop, onCloseAnswer: noop, onEditTask: noop,
  ...patch });

// ——— Izmene i otkazivanje ———
const terms = { priceRsd: 5500, currency: 'RSD' as const, scopeNote: 'Prenos ormana u dva dela sa trećeg sprata do kombija.',
  startsAt: '2026-09-26T15:00:00Z', endsAt: '2026-09-26T17:00:00Z' };
const proposal = (proposedBy: string): AgreementChangeProposal => ({ proposalId: `predlog-${proposedBy}`, agreementId: AGREEMENT, baseVersion: 3, proposedBy, status: 'PENDING',
  createdAt: '2026-09-24T09:00:00Z', reason: 'Orman je teži nego što je opisano, treba nam još sat vremena.', respondedAt: null, respondedBy: null, termsAvailable: true,
  terms: { ...terms, priceRsd: 6500, endsAt: '2026-09-26T18:00:00Z' } });
const snapshot = (patch: Partial<AgreementChangeSnapshot> = {}, actions: Partial<AgreementChangeSnapshot['actions']> = {}): AgreementChangeSnapshot => ({
  agreementId: AGREEMENT, agreementVersion: 3, agreementStatus: 'CONFIRMED', requesterAccountId: ME, workerAccountId: OTHER, counterpartName: 'Marko Jovanović', terms, proposals: [], ...patch,
  actions: { agreementId: AGREEMENT, agreementVersion: 3, accountId: ME, authoritative: true, canProposeChange: true, canRespondChange: false,
    canWithdrawChange: false, canMarkWorkDone: false, canConfirmCompletion: false, canCancel: true, ...actions } });
const form = (kind: AgreementActionForm['kind'], patch: Partial<AgreementActionForm> = {}): AgreementActionForm => ({ token: {}, kind, reentry: false, key: 'galerija',
  price: '5500', scope: terms.scopeNote, reason: '', zone: 'Europe/Belgrade', startDate: '2026-09-26', startTime: '17:00', endDate: '2026-09-26', endTime: '19:00',
  priceChanged: false, scopeChanged: false, startChanged: false, endChanged: false, ...patch });
const changes = (patch: Partial<AgreementActionsPresentationProps>): AgreementActionsPresentationProps => ({
  phase: 'READY', snapshot: snapshot(), accountId: ME, error: null, message: null, canRetry: false, needsReentry: false, journalKind: null,
  form: null, review: null, proposed: null, onBack: noop, onRefresh: noop, onOpenForm: noop, onEdit: noop, onPrepareForm: noop, onCloseForm: noop,
  onPrepare: noop, onSend: noop, onCloseReview: noop, onRetry: noop, onAcknowledge: noop, ...patch });

// ——— Grupni razgovor ———
const THIRD = '10000000-0000-4000-8000-000000000003';
const person = (accountId: string, displayName: string, role: 'REQUESTER' | 'PARTICIPANT') => ({ accountId, profileId: accountId, displayName, role });
/** As the real read lists them: the requester and every active member, the viewer included (review r6). */
const members = (requester: string) => [
  person(OTHER, 'Marko Jovanović', requester === OTHER ? 'REQUESTER' : 'PARTICIPANT'),
  person(THIRD, 'Stefan Ilić', 'PARTICIPANT'),
  person(ME, 'Jovana Petrović', requester === ME ? 'REQUESTER' : 'PARTICIPANT'),
];
const groupContext = (patch: Record<string, unknown> = {}) => ({ accountId: ME, agreementId: AGREEMENT, needId: NEED, available: true, authoritative: true as const,
  group: { groupId: 'grupa', title: 'Selidba dvosobnog stana', canSend: true, terminal: false, role: 'PARTICIPANT' as const,
    members: members(patch.role === 'REQUESTER' ? ME : OTHER), management: null, managementNextId: null, unreadCount: 0, ...patch } });
const said = (n: number, sender: string, body: string, createdAt: string): GroupMessage =>
  ({ messageId: `poruka-${n}`, sequence: String(n), senderAccountId: sender, body, createdAt, mine: sender === ME });
const MESSAGES = [
  said(1, OTHER, 'Dobro jutro! Kombi dolazi u 9, ulaz je iz dvorišta.', '2026-09-24T06:40:00Z'),
  said(2, OTHER, 'Ključ od podruma je kod komšije na prvom spratu.', '2026-09-24T06:41:00Z'),
  said(3, THIRD, 'Stižem pet minuta ranije.', '2026-09-24T06:52:00Z'),
  said(4, ME, 'I ja. Poneću rukavice za sve.', '2026-09-24T06:55:00Z'),
];
// Inert, bounded history for native scroll/prepend/keyboard checks. No controller, writes or media reads.
const HISTORY = Array.from({ length: 40 }, (_, i) => said(i + 1, [OTHER, THIRD, ME][i % 3],
  `Poruka ${i + 1} · ${['Kombi stiže do ulaza iz dvorišta.', 'Poneću trake i rukavice za nošenje.', 'Sve je spremno. Vidimo se u dogovoreno vreme.'][i % 3]}`,
  new Date(Date.UTC(2026, 8, 24, 6, i)).toISOString()));
const requesterGroup = () => groupContext({ role: 'REQUESTER', management: [
  { agreementId: 'pojedinacni-1', accountId: THIRD, status: 'CONFIRMED', executionState: 'AWAITING_REQUESTER', problemOpened: false },
  { agreementId: 'pojedinacni-2', accountId: OTHER, status: 'CONFIRMED', executionState: 'CONFIRMED', problemOpened: false },
] });
const group = (state: Partial<GroupState>): GroupState => ({ phase: 'READY', context: groupContext(), messages: MESSAGES, before: null, journal: null,
  receipt: null, canRetry: false, message: null, ...state } as GroupState);

// ——— Fotografije uz poruku ———
/** A photo tray that can do nothing: one photo whose sending is not confirmed (so, as the hook has it, the tools are
 *  withheld), one saved earlier; never a picker or an upload. */
const PHOTOS = { agreementId: AGREEMENT, loaded: true, busy: false, ready: false, hasSelection: true, available: false, selected: [], versionConflict: false,
  items: [{ ref: { agreementId: AGREEMENT, agreementVersion: 3, clientRequestId: 'galerija-1' }, receipt: null }],
  saved: [{ clientRequestId: 'galerija-2', photo: { width: 1600, height: 1200 } }], message: null,
  canSubmit: () => false, capture: () => null, refresh: later, pick: later, retry: later, remove: later, restore: later, reserved: () => false, canRetry: () => true,
} as unknown as AgreementPhotosController;

type SceneKey = 'qa-public' | 'qa-owner' | 'qa-answer' | 'qa-empty' | 'qa-loading' | 'qa-error' | 'qa-closed' | 'qa-recovery'
  | 'ch-hub' | 'ch-other' | 'ch-form' | 'ch-cancel' | 'ch-unknown' | 'ch-done' | 'ch-loading'
  | 'gr-thread' | 'gr-history' | 'gr-people' | 'gr-empty' | 'gr-closed' | 'gr-error' | 'photos';
const SCENES: { key: SceneKey; label: string }[] = [
  { key: 'qa-public', label: 'Pitanja · javno' }, { key: 'qa-owner', label: 'Pitanja · moj zadatak' }, { key: 'qa-answer', label: 'Pitanja · odgovaram' },
  { key: 'qa-empty', label: 'Pitanja · prazno' }, { key: 'qa-loading', label: 'Pitanja · učitavanje' }, { key: 'qa-error', label: 'Pitanja · greška' },
  { key: 'qa-closed', label: 'Pitanja · ne može da pita' }, { key: 'qa-recovery', label: 'Pitanja · provera radnje' },
  { key: 'ch-hub', label: 'Izmene · važeći uslovi' }, { key: 'ch-other', label: 'Izmene · predlog druge strane' }, { key: 'ch-form', label: 'Izmene · korak 1' },
  { key: 'ch-cancel', label: 'Izmene · otkazivanje, korak 2' }, { key: 'ch-unknown', label: 'Izmene · nepotvrđeno' }, { key: 'ch-done', label: 'Izmene · potvrđeno' },
  { key: 'ch-loading', label: 'Izmene · učitavanje' },
  { key: 'gr-thread', label: 'Grupa · razgovor' }, { key: 'gr-people', label: 'Grupa · učesnici' }, { key: 'gr-empty', label: 'Grupa · prazno' },
  { key: 'gr-history', label: 'Grupa · duga prepiska i starije poruke' },
  { key: 'gr-closed', label: 'Grupa · završen' }, { key: 'gr-error', label: 'Grupa · greška' },
  { key: 'photos', label: 'Poruke · fotografije uz poruku' },
];

function Scene({ scene, back }: { scene: SceneKey; back: () => void }) {
  const [draft, setDraft] = useState(scene === 'qa-answer' ? 'Ne, parking je besplatan ispred zgrade.' : '');
  const [people, setPeople] = useState(scene === 'gr-people');
  switch (scene) {
    case 'qa-public': return <TaskQaPresentation {...qa({ onBack: back, text: draft, onText: setDraft })} />;
    case 'qa-owner': return <TaskQaPresentation {...qa({ onBack: back, mode: 'OWNER', canAnswer: true, composer: null,
      pending: [ownerQuestion('p1', 'Da li se parking plaća?', 'PENDING_ANSWER'), ownerQuestion('p2', 'Može li u subotu umesto u petak?', 'PENDING_ANSWER')],
      answered: [ownerQuestion('q1', 'Da li zgrada ima lift?', 'ANSWERED_PUBLIC', 'Nema lifta, stan je na trećem spratu.')],
      set: [ownerQuestion('s1', 'Pošalji mi broj telefona.', 'REPORTED')], historical: [ownerQuestion('h1', 'Koliko je ormana?', 'ANSWERED_PUBLIC', 'Jedan.', 1)] })} />;
    case 'qa-answer': return <TaskQaPresentation {...qa({ onBack: back, mode: 'OWNER', canAnswer: true, text: draft, onText: setDraft,
      composer: { answering: 'Da li se parking plaća?', answeringId: 'p1', revisionChanged: false, maxChars: 1000 },
      pending: [ownerQuestion('p1', 'Da li se parking plaća?', 'PENDING_ANSWER')], answered: [] })} />;
    case 'qa-empty': return <TaskQaPresentation {...qa({ onBack: back, answered: [], text: draft, onText: setDraft })} />;
    case 'qa-loading': return <TaskQaPresentation {...qa({ onBack: back, loaded: false, busy: true, title: null, composer: null, answered: [] })} />;
    case 'qa-error': return <TaskQaPresentation {...qa({ onBack: back, loaded: false, title: null, composer: null, answered: [],
      message: 'Proveri vezu i pokušaj ponovo.' })} />;
    case 'qa-closed': return <TaskQaPresentation {...qa({ onBack: back, composer: null,
      cannotAsk: { text: 'Za postavljanje pitanja potreban je aktivan Radni profil.', action: { label: 'Dopuni radni profil', onPress: noop } } })} />;
    case 'qa-recovery': return <TaskQaPresentation {...qa({ onBack: back, composer: null, text: draft, onText: setDraft,
      // A checked text that is not yet published (READY): the screen offers the retry and the cancel together, and says so plainly.
      recovery: { kind: 'TEXT', absent: true, canCancel: true }, messageTone: 'info',
      message: 'Tekst je proveren, ali još nije objavljen. Upiši isti tekst pa pošalji ponovo.' })} />;
    case 'ch-hub': return <AgreementActionsPresentation {...changes({ onBack: back, snapshot: snapshot({ proposals: [proposal(ME)] }, { canWithdrawChange: true, canProposeChange: false }) })} />;
    case 'ch-other': return <AgreementActionsPresentation {...changes({ onBack: back, snapshot: snapshot({ proposals: [proposal(OTHER)] }, { canRespondChange: true }) })} />;
    case 'ch-form': return <AgreementActionsPresentation {...changes({ onBack: back, onCloseForm: back,
      form: form('PROPOSE', { price: '6500', priceChanged: true, endTime: '20:00', endChanged: true, reason: 'Orman je teži nego što je opisano.' }) })} />;
    case 'ch-cancel': return <AgreementActionsPresentation {...changes({ onBack: back, onCloseReview: back,
      review: { kind: 'CANCEL', agreementId: AGREEMENT, version: 3, reason: 'Kombi se pokvario, ne mogu da stignem u dogovoreno vreme.' } })} />;
    case 'ch-unknown': return <AgreementActionsPresentation {...changes({ onBack: back, phase: 'UNKNOWN', error: 'Ishod nije potvrđen. Proveri vezu.',
      canRetry: true, needsReentry: true, journalKind: 'PROPOSE' })} />;
    case 'ch-done': return <AgreementActionsPresentation {...changes({ onBack: back, phase: 'CONFIRMED', journalKind: 'PROPOSE', message: 'Predlog izmene je sačuvan.' })} />;
    case 'ch-loading': return <AgreementActionsPresentation {...changes({ onBack: back, phase: 'LOADING', snapshot: null })} />;
    case 'gr-thread': return <GroupConversationPresentation {...groupProps(group({}), back, draft, setDraft)}
      showPeople={people} onTogglePeople={() => setPeople(value => !value)} />;
    case 'gr-people': return <GroupConversationPresentation {...groupProps(group({ context: requesterGroup() }), back, draft, setDraft)}
      showPeople={people} onTogglePeople={() => setPeople(value => !value)} />;
    case 'gr-history': return <GroupHistoryScene back={back} />;
    case 'gr-empty': return <GroupConversationPresentation {...groupProps(group({ messages: [] }), back, draft, setDraft)} />;
    case 'gr-closed': return <GroupConversationPresentation {...groupProps(group({ context: groupContext({ canSend: false, terminal: true }) }), back, draft, setDraft)} />;
    case 'gr-error': return <GroupConversationPresentation {...groupProps(group({ phase: 'ERROR', context: null, messages: [], message: 'Proveri vezu i pokušaj ponovo.' }),
      back, draft, setDraft)} />;
    case 'photos': return <SafeAreaView edges={['top']} style={s.screen}>
      <DetailTopBar title="Fotografije uz poruku" onBack={back} />
      <ScrollView contentContainerStyle={s.pad}><AgreementPhotoComposer photos={PHOTOS} capturing={false} /></ScrollView>
    </SafeAreaView>;
  }
}

const groupProps = (state: GroupState, back: () => void, draft: string, setDraft: (value: string) => void) => ({ state, draft, showPeople: false, listKey: 0,
  draftLength: Array.from(draft.trim()).length, draftSendable: draft.trim().length > 0,
  viewability: { viewAreaCoveragePercentThreshold: 60, minimumViewTime: 600 }, onVisible: noop, onBack: back, onTogglePeople: noop, onRefresh: noop,
  onOlder: noop, onManagementNext: noop, onOpenAgreement: noop, onPrivate: noop, onDraft: setDraft, onSend: noop, onAcknowledge: noop });

function GroupHistoryScene({ back }: { back: () => void }) {
  const [older, setOlder] = useState(false), [people, setPeople] = useState(false), [draft, setDraft] = useState('');
  const state = useMemo(() => group({ context: requesterGroup(), messages: older ? HISTORY : HISTORY.slice(20), before: older ? null : '21' }), [older]);
  return <GroupConversationPresentation {...groupProps(state, back, draft, setDraft)} showPeople={people}
    onTogglePeople={() => setPeople(value => !value)} onOlder={() => setOlder(true)} onRefresh={() => setOlder(false)} />;
}

export default function DizajnDodaci() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const [scene, setScene] = useState<SceneKey | null>(null);
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  if (!scene) return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    {/* Opened cold by its address there is no history to go back to. */}
    <DetailTopBar title="Dogovor · dodaci · galerija" onBack={() => router.canGoBack() ? router.back() : router.replace('/')} />
    <ScrollView contentContainerStyle={s.list}>
      {SCENES.map(option => <Press key={option.key} accessibilityRole="button" accessibilityLabel={option.label} haptic="select"
        onPress={() => setScene(option.key)} style={s.row}>
        <T variant="bodyStrong" style={s.grow}>{option.label}</T>
        <CaretRight size={18} color={sys.color.muted} />
      </Press>)}
    </ScrollView>
  </SafeAreaView>;
  const back = () => setScene(null);
  return <View style={s.screen}>
    {/* Each scene is mounted fresh, so its draft starts where the scene says. */}
    <View key={scene} style={s.grow}><Scene scene={scene} back={back} /></View>
    <SafeAreaView edges={['bottom']} style={s.strip}>
      <V2Action label="Nazad" accessibilityLabel="Nazad na scene" kind="quiet" onPress={back} />
    </SafeAreaView>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  grow: { flex: 1, minWidth: 0 },
  pad: { padding: sys.space.lg },
  list: { paddingHorizontal: sys.space.lg, paddingBottom: sys.space.xxl },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: sys.space.md, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  strip: { borderTopWidth: 1, borderTopColor: sys.color.line, paddingHorizontal: sys.space.lg, backgroundColor: sys.color.surface },
});
