import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Platform, KeyboardAvoidingView, Keyboard, BackHandler, TextInput, AppState, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { DogovorProjekcija } from '../../contracts/projections';
import type { Ishod } from '../../data/ports';
import { T } from '../../ui/Text';
import { sys, field } from '../../ui/system/tokens';
import { SkeletonCard } from '../../ui/system/Skeleton';
import { ActionSheet } from '../../ui/system/ActionSheet';
import { useReducedMotion } from '../../ui/system/motion';
import { PorukaHost, poruka } from '../../ui/system/Poruka';
import { ChromeIconButton } from '../../ui/system/ScreenChrome';
import { V2Action } from '../../ui/v2/V2Action';
import { AgreementTabs, AgreementTaskLink, AgreementTerms, AgreementPeople, AgreementPersonBar, AgreementSection, isGroupAgreement, type AgreementTab } from '../../ui/v2/AgreementPresentation';
import { NextStepCard, WorkspaceCard, WorkspaceFooter, WorkspaceRow, WorkspaceRows, agreementNextStep, agreementQuietLine, agreementWaitsForMe } from '../../ui/agreements/AgreementWorkspace';
import { AgreementCompletionReview } from '../../ui/agreements/AgreementCompletionReview';
import { AgreementContactPlace } from '../../ui/agreements/AgreementContactPlace';
import { AgreementSteps } from '../../ui/agreements/AgreementSteps';
import { agreementMenuActions } from '../../ui/agreements/agreementMenu';
import type { OwnRating } from '../../ui/agreements/agreementStepsModel';
import { ProductHeader } from '../../ui/product/ProductDetails';
import { useIzvor } from '../../store/uloga';
import { useAgreementHistory } from '../../hooks/useAgreementHistory';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { useAgreementOutbox } from '../../hooks/useAgreementOutbox';
import { useAgreementPhotos } from '../../hooks/useAgreementPhotos';
import { useAgreementIncomingRefresh } from '../../hooks/useAgreementIncomingRefresh';
import type { AgreementReadingPosition } from '../../ui/AgreementChat';
import { agreementMessageHistoryService } from '../../data/agreementMessageHistoryService';
import { useSesija, sesijaSada } from '../../store/sesija';
import { AgreementThreadPresentation } from '../../ui/v2/AgreementThreadPresentation';
import { GroupConversationEntry } from '../../ui/groups/GroupConversationEntry';
import { needScheduleText } from '../../data/needDetailPresentation';
import { agreementProblemService, knownProblemRefusal, type AgreementProblemSnapshot } from '../../data/agreementClientService';
import { reviewsClientService } from '../../data/reviewsClientService';
import { knownLegacyRefusal } from '../../data/legacyRpcFailure';
import { completionDenial } from '../../data/agreementCompletion';
import { calendarInstant } from '../../lib/calendarTime';
import { vreme } from '../../lib/vreme';

/**
 * My rating of a finished Dogovor, from the review read the rating screen itself uses. `DUE` and `UNKNOWN` both keep
 * "Oceni saradnju" on offer (a read that did not answer must not hide the only way to rate); `GIVEN` and `CLOSED` are
 * the review read saying there is nothing left to rate, and the footer says the state in words (the type lives with the step bar).
 */
type ProblemWorkspace = DogovorProjekcija & {
  problemReport: AgreementProblemSnapshot['report'];
  problemReportState: AgreementProblemSnapshot['state'] | 'UNAVAILABLE';
  ownRating: OwnRating;
};
type CompletionReview = { agreement: ProblemWorkspace; focus: object; readEpoch: number };
async function bounded<T>(operation: () => Promise<T>, ms = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Caller timeout does not claim that the server cancelled or rejected a write.
    return await Promise.race([operation(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('AGREEMENT_REQUEST_UNCONFIRMED')), ms);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
function backToAgreements() { if (router.canGoBack()) router.back(); else router.replace('/dogovori'); }
function AgreementStatus({ loading = false, error = false, retry }: { loading?: boolean; error?: boolean; retry?: () => void }) {
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ProductHeader subtitle={loading ? 'Učitavamo' : error ? 'Nije učitano' : 'Nije dostupno'} title="Dogovor" back={backToAgreements} />
    <View style={s.status} accessibilityLiveRegion="polite">
      {loading ? <><SkeletonCard rows={2} /><T accessibilityLabel="Učitavanje Dogovora" variant="meta" tone="muted" style={s.center}>Učitavamo Dogovor…</T></> : <>
        <T accessibilityRole="header" variant="title" style={s.ink}>{error ? 'Dogovor nije učitan' : 'Dogovor nije dostupan'}</T>
        <T variant="body" tone="muted">{error ? 'Proveri internet vezu i pokušaj ponovo.' : 'Veza je zastarela ili nemaš pristup ovom Dogovoru.'}</T>
        {retry ? <V2Action label="Ponovo učitaj Dogovor" onPress={retry} /> : null}
      </>}
    </View>
  </SafeAreaView>;
}
export default function Dogovor() {
  // A notification about a message opens the conversation itself, not the overview it lives behind.
  const { id, tab, messageId, from } = useLocalSearchParams<{ id: string | string[]; tab?: string | string[]; messageId?: string | string[]; from?: string | string[] }>();
  const session = useSesija(), accountId = session.user?.id;
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !accountId) return <AgreementStatus />;
  if (messageId !== undefined && (typeof messageId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId))) return <AgreementStatus />;
  return <DogovorContent key={`${accountId}:${session.accountRevision}:${id}`} id={id} accountId={accountId} accountRevision={session.accountRevision}
    fromInbox={from === 'poruke'} requestedTab={tab === 'poruke' ? 'poruke' : 'pregled'} requestedMessageId={tab === 'poruke' ? messageId?.toLowerCase() : undefined} />;
}
function DogovorContent({ id, accountId, accountRevision, requestedTab, requestedMessageId, fromInbox }: {
  id: string; accountId: string; accountRevision: number; requestedTab: AgreementTab; requestedMessageId?: string; fromInbox: boolean;
}) {
  const izvor = useIzvor();
  const [tab, updateTab] = useState<AgreementTab>(requestedTab);
  // A retained geometry callback from a prior Poruke visit cannot acknowledge a later visit.
  const chatVisit = useRef<object>({}), tabRef = useRef(tab);
  const setTab = useCallback((next: AgreementTab) => {
    if (next !== tabRef.current) { chatVisit.current = {}; tabRef.current = next; }
    updateTab(next);
  }, []);
  // The router may retain this account/Agreement while changing its tab intent.
  // Consume that change once; later renders/focus must preserve the user's tab.
  useEffect(() => { setTab(requestedTab); }, [requestedTab, requestedMessageId, setTab]);
  const renderedChatVisit = chatVisit.current;
  // Survives the foreground freshness gate and the Pregled/Poruke switch, but not
  // a different account incarnation or Agreement (the route content is keyed above).
  // An arriving P4 target creates a fresh bounded B3 window/geometry owner. It does
  // not remount the Agreement, workspace, photo intents or persistent send journal.
  // The router ID is only an intent: B3 must independently authorize the exact row.
  const chatReadingPosition = useMemo<{ current: AgreementReadingPosition }>(() => ({ current: requestedMessageId
    ? { following: false, offset: 0, anchor: { messageId: requestedMessageId, within: 0 } }
    : { following: true, offset: 0 } }), [requestedMessageId]);
  const [problemOpen, setProblemOpen] = useState(false), [problemText, setProblemText] = useState('');
  const [problemAttempt, setProblemAttempt] = useState<string | null>(null);
  const problemAttemptRef = useRef<string | null>(null);
  const [completionReview, setCompletionReview] = useState<CompletionReview | null>(null);
  const [completing, setCompleting] = useState(false);
  // The "···" menu, and where the page's own sections stand so a menu entry can take the person to them.
  const [menuOpen, setMenuOpen] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const anchors = useRef<{ problem: number | null; place: number | null }>({ problem: null, place: null });
  // A menu entry chosen in the conversation names a section of the overview: it waits here until the overview has been laid out.
  const waitingAnchor = useRef<'problem' | 'place' | null>(null);
  // The footer's height, so the outcome bar (Poruka) floats above it.
  const [footerHeight, setFooterHeight] = useState(0);
  const reducedMotion = useReducedMotion();
  // The latest commands, for a bar whose "Vrati" is pressed after the render that showed it.
  const later = useRef<{ sharePhone: (share: boolean, undoable?: boolean) => Promise<void> }>({ sharePhone: async () => {} });
  const completionDisplay = useRef<object | null>(null);
  const completionReviewRef = useRef<CompletionReview | null>(null), completionReadEpoch = useRef(0);
  const closeCompletionReview = useCallback(() => {
    completionReviewRef.current = null; setCompletionReview(null);
  }, []);
  const formFocus = useRef<object | null>(null);
  const [renderedFormFocus, setRenderedFormFocus] = useState<object | null>(null);
  useFocusEffect(useCallback(() => {
    const focus = {}; formFocus.current = focus;
    // Focus must reach effects and callbacks even before either independent read settles.
    setRenderedFormFocus(focus);
    return () => { if (formFocus.current === focus) {
      formFocus.current = null; closeCompletionReview();
      completionDisplay.current = null; setCompleting(false);
    } };
  }, [accountId, accountRevision, closeCompletionReview]));
  const ownsAccount = useCallback(() => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision, [accountId, accountRevision]);
  const read = useCallback(async (): Promise<Ishod<ProblemWorkspace | null>> => {
    // A review belongs to one exact read. Invalidate synchronously, before a refresh
    // can yield: neither a retained confirm nor a retained opener may reuse its terms.
    completionReadEpoch.current++; closeCompletionReview();
    if (!ownsAccount()) return { ok: false, kod: 'ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvori Dogovor.' };
    try {
      const data = await bounded(() => izvor.dogovor(id));
      if (!ownsAccount()) return { ok: false, kod: 'ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvori Dogovor.' };
      if (data && data.id !== id) return { ok: false, kod: 'INVALID_RESPONSE', poruka: 'Dogovor nije dostupan.' };
      if (!data) return { ok: true, podatak: null };
      // "Oceni saradnju" stayed on the footer after the rating was saved (phone, 2026-09-23): the workspace read does
      // not say whether MY review exists. The existing own-review read does; it is asked only for a finished Dogovor
      // I am a party of, inside this same guarded read, and like the problem details below it can never erase the
      // Agreement it describes: a read that fails leaves the rating on offer.
      let ownRating: OwnRating = 'NOT_APPLICABLE';
      if (data.stanje === 'COMPLETED' && data.ucesnici.some(party => party.viSte && party.id === accountId)) {
        // It runs after the workspace read, before the Dogovor first shows; a failed read changes nothing (the rating
        // stays on offer), so it gets 5 s rather than the 15 s a command gets.
        const review = await bounded(() => reviewsClientService.context(id, { accountId, accountRevision }), 5_000).catch(() => null);
        if (!ownsAccount()) return { ok: false, kod: 'ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvori Dogovor.' };
        ownRating = !review?.ok ? 'UNKNOWN' : review.podatak.review ? 'GIVEN' : review.podatak.eligible ? 'DUE' : 'CLOSED';
      }
      if (data.problemOtvoren) {
        const result = await agreementProblemService.read(id, data.verzija, data.ucesnici.map(party => party.id), { accountId, accountRevision })
          .catch(() => null);
        if (!ownsAccount()) return { ok: false, kod: 'ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvori Dogovor.' };
        if (result?.ok && result.podatak.state === 'AVAILABLE') {
          return { ok: true, podatak: { ...data, problemReport: result.podatak.report, problemReportState: 'AVAILABLE', ownRating } };
        }
        // Optional report details cannot erase an independently read Agreement.
        // The base open flag remains authoritative; absent/conflicting detail is unknown.
        return { ok: true, podatak: { ...data, problemReport: null,
          problemReportState: result?.ok && result.podatak.state === 'LEGACY_UNAVAILABLE' ? 'LEGACY_UNAVAILABLE' : 'UNAVAILABLE', ownRating } };
      }
      return { ok: true, podatak: { ...data, problemReport: null, problemReportState: 'ABSENT', ownRating } };
    } catch { return { ok: false, kod: 'AGREEMENT_READ_FAILED', poruka: 'Dogovor nije učitan. Proveri vezu i pokušaj ponovo.' }; }
  }, [izvor, id, accountId, accountRevision, ownsAccount, closeCompletionReview]);
  const workspace = useOwnedEditor(read);
  const renderedCompletionRead = completionReadEpoch.current;
  const activeRef = useRef(!AppState.currentState || AppState.currentState === 'active');
  const freshRef = useRef(activeRef.current), resumeGeneration = useRef(0);
  const [foreground, setForeground] = useState(activeRef.current);
  const [resumeRequired, setResumeRequired] = useState(!activeRef.current);
  const [resumeEpoch, setResumeEpoch] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      // Android may repeat active without leaving the foreground (for example around microphone access).
      // It is not a new visit: keep chat controls and the current workspace until a real lifecycle edge.
      if (state === 'active' && activeRef.current) return;
      closeCompletionReview();
      chatVisit.current = {};
      activeRef.current = state === 'active';
      freshRef.current = false;
      resumeGeneration.current++;
      setResumeEpoch(resumeGeneration.current);
      setForeground(activeRef.current); setResumeRequired(true);
    });
    return () => { subscription.remove(); activeRef.current = false; freshRef.current = false; resumeGeneration.current++; };
  }, [closeCompletionReview]);
  useEffect(() => {
    // Wait for an in-flight mutation, then replace the pre-background snapshot.
    // A retained callback remains fenced throughout the resume read.
    if (!foreground || !resumeRequired || workspace.busy) return;
    let current = true;
    const generation = resumeGeneration.current;
    void workspace.refresh().then(() => {
      if (!current || !activeRef.current || generation !== resumeGeneration.current) return;
      freshRef.current = true; setResumeRequired(false);
    });
    return () => { current = false; };
  }, [foreground, resumeRequired, resumeEpoch, workspace.busy, workspace.refresh]);
  const messages = useAgreementHistory(accountId, accountRevision, id, chatReadingPosition);
  const dogovor = workspace.data;
  // The adapter can only say "Ja" or "Sagovornik"; the workspace knows who the other person is, and a bubble
  // carries that name the way the header above it already does.
  const namedMessages = useMemo(() => (messages.data ?? []).map(message => {
    if (message.moja || !message.posiljalacAccountId) return message;
    const who = dogovor?.ucesnici.find(person => person.id === message.posiljalacAccountId)?.ime;
    return who ? { ...message, posiljalacIme: who } : message;
  }), [messages.data, dogovor?.ucesnici]);
  const enabled = foreground && !resumeRequired && !workspace.loading && !workspace.error && !workspace.busy && !workspace.uncertain;
  const writable = enabled && dogovor?.chatDostupan === true;
  const refreshIncoming = useCallback(() => messages.refresh('silent'), [messages.refresh]);
  useAgreementIncomingRefresh({ accountId, accountRevision, agreementId: id, source: izvor,
    enabled: enabled && tab === 'poruke' && dogovor?.chatDostupan === true
      && dogovor.ucesnici.some(party => party.viSte && party.id === accountId),
    refresh: refreshIncoming });
  const { model: outbox, state: outboxState } = useAgreementOutbox(accountId, id, writable);
  const photos = useAgreementPhotos(accountId, id, dogovor?.verzija ?? null, writable, outbox);
  const osvezi = workspace.refresh;
  useEffect(() => {
    if (messages.data && !messages.error) void outbox.reconcile(messages.data
      .filter(message => !!message.clientMessageId && !!message.posiljalacAccountId)
      .map(message => ({ clientMessageId: message.clientMessageId!, senderAccountId: message.posiljalacAccountId!, messageId: message.id, body: message.telo,
        ...(message.fotografije?.length ? { photos: { agreementVersion: message.dogovorVerzija!, assetIds: message.fotografije.map(photo => photo.assetId) } } : {}) })));
  }, [messages.data, messages.error, outbox, outboxState.phase]);
  const deniedAttempt = outboxState.entries.filter(entry => entry.error === 'READ_ONLY' || entry.error === 'NOT_AVAILABLE')
    .map(entry => `${entry.command.clientMessageId}:${entry.attempt}`).join('|');
  useEffect(() => { if (deniedAttempt) void osvezi(); }, [deniedAttempt, osvezi]);
  // A page/window read never implies display. Only the current measured incoming rows
  // may reach B3a, with exact history/workspace/visit identity checked again at dispatch.
  const messageReadReady = tab === 'poruke' && !!dogovor && !workspace.loading && !workspace.error && !workspace.uncertain
    && dogovor.ucesnici.some(party => party.viSte && party.id === accountId)
    && foreground && !resumeRequired && !messages.loading && !messages.error && !!messages.data?.length;
  const chatAdmitted = !!dogovor && !workspace.loading && !workspace.error && !workspace.uncertain && foreground && !resumeRequired;
  const currentChat = useRef({ rows: messages.data, dogovor, ready: messageReadReady, admitted: chatAdmitted });
  currentChat.current = { rows: messages.data, dogovor, ready: messageReadReady, admitted: chatAdmitted };
  const displayedAcks = useRef<{ focus: object | null; visit: object; rows: typeof messages.data; ids: Set<string> }>(
    { focus: null, visit: renderedChatVisit, rows: null, ids: new Set() });
  const chatCurrent = () => tabRef.current === 'poruke' && chatVisit.current === renderedChatVisit
    && renderedFormFocus !== null && formFocus.current === renderedFormFocus && ownsAccount()
    && activeRef.current && freshRef.current && currentChat.current.dogovor === dogovor
    && currentChat.current.admitted
    && !workspace.loading && !workspace.error && !workspace.uncertain && !!dogovor
    && dogovor.ucesnici.some(party => party.viSte && party.id === accountId)
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const onDisplayedMessageIds = (ids: readonly string[]) => {
    const rows = messages.data;
    if (!chatCurrent() || !messageReadReady || !currentChat.current.ready || currentChat.current.rows !== rows || !rows) return;
    let acknowledged = displayedAcks.current;
    if (acknowledged.focus !== renderedFormFocus || acknowledged.visit !== renderedChatVisit || acknowledged.rows !== rows) {
      acknowledged = { focus: renderedFormFocus, visit: renderedChatVisit, rows, ids: new Set() };
      displayedAcks.current = acknowledged;
    }
    const displayed = [...new Set(ids)].filter(messageId => !acknowledged.ids.has(messageId) && rows.some(message => message.id === messageId
      && !message.moja && !!message.posiljalacAccountId && message.posiljalacAccountId !== accountId
      && dogovor!.ucesnici.some(party => party.id === message.posiljalacAccountId)));
    // Bound each write exactly as the server contract requires. No loaded-page sweep.
    void (async () => {
      for (let index = 0; index < displayed.length; index += 50) {
        if (!chatCurrent() || !currentChat.current.ready || currentChat.current.rows !== rows || displayedAcks.current !== acknowledged) return;
        const batch = displayed.slice(index, index + 50).filter(messageId => !acknowledged.ids.has(messageId));
        if (!batch.length) continue;
        batch.forEach(messageId => acknowledged.ids.add(messageId));
        const result = await agreementMessageHistoryService.markDisplayed(id, batch, { accountId, accountRevision }).catch(() => null);
        if (!result?.ok) batch.forEach(messageId => acknowledged.ids.delete(messageId));
      }
    })();
  };
  const refreshMessages = async () => { if (chatCurrent()) await messages.refresh(); };
  const loadOlderMessages = async () => { if (chatCurrent() && currentChat.current.rows === messages.data) await messages.loadOlder(); };
  const loadNewerMessages = async () => { if (chatCurrent() && currentChat.current.rows === messages.data) await messages.loadNewer(); };
  const showLatestMessages = async () => { if (chatCurrent() && currentChat.current.rows === messages.data) await messages.showLatest(); };
  const chatVisible = tab === 'poruke' && !!dogovor && foreground && !resumeRequired;
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android' || !chatVisible) return;
    let current = true;
    const focus = formFocus.current;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!current || !focus || formFocus.current !== focus || !ownsAccount() || !activeRef.current || !freshRef.current) return false;
      // Android normally lets the IME consume Back first. If it reaches JS while
      // the keyboard is still visible, keep that same keyboard-only first step.
      if (Keyboard.isVisible()) { Keyboard.dismiss(); return true; }
      // Poruke is an inner view of this route, not another navigator entry.
      // Returning to its overview must retain pending/unknown command owners.
      if (fromInbox) { if (router.canGoBack()) router.back(); else router.replace('/poruke'); }
      else setTab('pregled');
      return true;
    });
    return () => { current = false; subscription.remove(); };
  }, [chatVisible, ownsAccount, fromInbox]));
  // Back from the background the overview keeps its last content, read-only, with a quiet "Osvežavamo…" line, instead of a full
  // skeleton (plan 2.6). Nothing private stays on it until the fresh read lands (the contact section waits, the place is gone),
  // every command is fenced as before, and in the background itself nothing is drawn. The conversation, with its composer and
  // its outbox, waits for the fresh read in a skeleton as it always did.
  const keepsContent = foreground && resumeRequired && !!dogovor && tab === 'pregled';
  if (!foreground || (resumeRequired && !keepsContent)) return <AgreementStatus loading />;
  if (!dogovor) return <AgreementStatus loading={workspace.loading} error={!!workspace.error} retry={() => void osvezi()} />;

  // Party identity comes from the Agreement, not the user's currently selected intent.
  const me = dogovor.ucesnici.find(party => party.viSte && party.id === accountId);
  const worker = me?.uloga === 'uskocer', requester = me?.uloga === 'narucilac';
  const active = dogovor.stanje === 'CONFIRMED' || dogovor.stanje === 'AWAITING_REQUESTER';
  // PKG-007: the server's actionState (already excluding a pending change) is the only
  // completion authority; status and party stay a necessary display condition, never a
  // substitute. Missing or unconfirmed permissions fail closed until an explicit readback.
  const radnje = dogovor.radnje ?? null;
  const canComplete = active && !!me && !!radnje && (worker ? radnje.mozeOznacitiZavrsetak : requester && radnje.mozePotvrditiZavrsetak);
  const other = dogovor.ucesnici.find(party => !party.viSte);
  const formCurrent = () => enabled && !!me && ownsAccount() && activeRef.current && freshRef.current &&
    renderedFormFocus !== null && formFocus.current === renderedFormFocus;
  const report = dogovor.problemReport;
  const reportProblem = async () => {
    if (!formCurrent() || !active || dogovor.problemOtvoren || !(problemAttempt ?? problemText.trim())) return;
    await workspace.save(async () => {
      // Keep the original description after an unknown outcome. Only explicit
      // readback may reopen writes; a retry cannot silently replace this intent.
      const narrative = problemAttempt ?? problemText.trim();
      problemAttemptRef.current = narrative;
      setProblemAttempt(narrative);
      const receipt = await agreementProblemService.submit(id, narrative, { accountId, accountRevision });
      if (!receipt.ok) return knownProblemRefusal(receipt.kod) ? receipt
        : { ok: false, kod: 'PROBLEM_REPORT_UNCONFIRMED', poruka: 'Prijava nije potvrđena. Proveri status Dogovora pre ponovnog pokušaja.' };
      const next = await read();
      if (!next.ok) return next;
      const stored = next.podatak?.problemReport;
      if (!stored || stored.openedBy !== receipt.podatak.problemOpenedBy || calendarInstant(stored.openedAt) !== calendarInstant(receipt.podatak.problemOpenedAt)) {
        return { ok: false, kod: 'PROBLEM_REPORT_UNCONFIRMED', poruka: 'Sačuvana prijava nije potvrđena. Osveži status Dogovora.' };
      }
      return next;
    });
  };
  /** Runs one command and reads the Dogovor back. True only when the command went through AND the readback confirmed it. */
  const mutate = async (command: () => Promise<Ishod<unknown>>): Promise<boolean> => {
    if (!enabled || !me || !ownsAccount() || !activeRef.current || !freshRef.current) return false;
    let confirmed = false;
    await workspace.save(async () => {
      const result = await bounded(command);
      // A known refusal keeps its own sentence (deep read 8.4: "Podeli svoj broj" said only "nije potvrđena").
      if (!result.ok) return knownLegacyRefusal(result.kod) ? { ok: false as const, kod: result.kod, poruka: result.poruka }
        : { ok: false as const, kod: 'AGREEMENT_ACTION_UNCONFIRMED', poruka: 'Promena nije potvrđena. Osveži Dogovor pre novog pokušaja.' };
      const next = await read();
      confirmed = next.ok;
      return next;
    });
    return confirmed;
  };
  /**
   * Shares my number, or withdraws it. No question first (plan 2.3): the outcome bar says what happened, once the server has
   * confirmed it, and offers "Vrati" - the opposite command - for a few seconds. Undoing is not undoable in turn.
   */
  const sharePhone = async (share: boolean, undoable = true) => {
    const done = await mutate(() => share ? izvor.podeliTelefon(id) : izvor.opoziviTelefon(id));
    if (!done) return;
    // A name is never declined here ("sa Markom" cannot be written for every name): it stands as the subject of its sentence.
    poruka.show({ text: share ? `Broj je podeljen. ${other?.ime?.trim() || 'Druga strana'} ga sada vidi.` : 'Deljenje broja je opozvano.', confirmed: true,
      ...(undoable ? { action: { label: 'Vrati', onPress: () => { void later.current.sharePhone(!share, false); } } } : {}) });
  };
  later.current = { sharePhone };
  /** Takes the person to a section of this page (the menu's way to the problem form and to the place). */
  const scrollToAnchor = (name: 'problem' | 'place') => {
    // Chosen from the conversation (its bar has the same "···"): the section lives in the overview, so go there first and
    // scroll when that section reports its place.
    if (tabRef.current !== 'pregled') { waitingAnchor.current = name; setTab('pregled'); return; }
    const y = anchors.current[name];
    if (y !== null) scroller.current?.scrollTo({ y: Math.max(0, y - sys.space.sm), animated: !reducedMotion });
  };
  const flushAnchor = (name: 'problem' | 'place') => {
    if (waitingAnchor.current !== name) return;
    waitingAnchor.current = null;
    scrollToAnchor(name);
  };
  const complete = async () => {
    if (!canComplete || !enabled || !me || !ownsAccount() || !activeRef.current || !freshRef.current) return;
    const display = {};
    try { await workspace.save(async () => {
      // Display ownership only: the existing editor still decides whether this write can start.
      completionDisplay.current = display; setCompleting(true);
      const result = await bounded<Ishod<unknown>>(() => worker ? izvor.oznaciZavrsetak(id) : izvor.potvrdiZavrsetak(id));
      // A known server denial keeps its own copy; anything else is an unconfirmed outcome.
      if (!result.ok) return { ok: false as const, kod: result.kod, poruka: completionDenial(result.kod) ?? 'Promena nije potvrđena. Osveži Dogovor pre novog pokušaja.' };
      const next = await read();
      if (!next.ok) return next;
      // Only the server's own terminal readback confirms; an unchanged state stays unconfirmed.
      const state = next.podatak?.stanje;
      const confirmed = worker ? state === 'AWAITING_REQUESTER' || state === 'COMPLETED' : state === 'COMPLETED';
      // Said as what did not get written, never as the normal wait for the other side ("čeka potvrdu"; review r3b).
      if (!confirmed) return { ok: false as const, kod: 'COMPLETION_NOT_CONFIRMED', poruka: worker
        ? 'Oznaka da je zadatak gotov nije upisana. Osveži status Dogovora.' : 'Potvrda završetka nije upisana. Osveži status Dogovora.' };
      return next;
    }); } finally {
      if (completionDisplay.current === display) { completionDisplay.current = null; setCompleting(false); }
    }
  };
  // This is presentation staging only. The existing completion command still
  // owns every permission, serialization, timeout and readback rule.
  const openCompletionReview = () => {
    if (!canComplete || !formCurrent() || completionReviewRef.current ||
      completionReadEpoch.current !== renderedCompletionRead) return;
    const review = { agreement: dogovor, focus: renderedFormFocus!, readEpoch: renderedCompletionRead };
    completionReviewRef.current = review; setCompletionReview(review);
  };
  const reviewingCompletion = completionReview !== null && completionReviewRef.current === completionReview &&
    completionReview.agreement === dogovor && completionReview.focus === formFocus.current &&
    completionReview.readEpoch === completionReadEpoch.current && canComplete && formCurrent();
  const confirmCompletionReview = () => {
    if (!reviewingCompletion || completionReviewRef.current !== completionReview || !formCurrent() ||
      completionReview!.readEpoch !== completionReadEpoch.current || completionReview!.focus !== formFocus.current) return;
    // Consume before the async command starts, so two taps cannot reuse this review.
    closeCompletionReview(); void complete();
  };
  const dismissCompletionReview = () => {
    if (completionReviewRef.current === completionReview) closeCompletionReview();
  };
  const deadline = dogovor.rokPotvrdeIso ? needScheduleText({ kind: 'FIXED_WINDOW', startsAt: null, endsAt: dogovor.rokPotvrdeIso }, 'Europe/Belgrade') : 'Rok trenutno nije dostupan';

  // ---- presentation (state above is untouched by PKG-011) ----
  // The words of the one action, and of the one that is its result: "Zadatak je gotov" is the worker's, "Potvrdi završetak" the
  // requester's - on the button, in the review it opens and in the sentences around them.
  const completeLabel = worker ? 'Zadatak je gotov' : 'Potvrdi završetak';
  // A quiet line, never a skeleton: the page is being read again (back from the background, or "Osveži") or is saving.
  const footerStatus = resumeRequired || workspace.loading ? 'Osvežavamo…'
    : workspace.busy && !completing ? 'Čuvamo promenu…' : null;
  const review = () => { if (formCurrent()) router.navigate({ pathname: '/oceni-dogovor', params: { agreementId: id } }); };
  // At most one brand action per state, and it is the only green thing on the screen: completion when the server allows it,
  // answering a proposal, or the rating. When nothing waits for the person there is NO button - the footer says the state in
  // one grey sentence. The conversation is not offered again: it is the Poruke tab at the top of the same screen.
  // A change proposal waiting for my answer blocks both completions, so answering it is the step.
  const pendingChange = active && me && radnje?.izmenaNaCekanju ? radnje.predlogIzmene : null;
  const changeWaits = active && me && !!radnje?.izmenaNaCekanju;
  const openChanges = () => { if (formCurrent()) router.push({ pathname: '/dogovor/[id]/izmene', params: { id } }); };
  // The rating is offered only while it can still be given: once the review read says it is saved (or closed), nothing waits
  // for the person and the footer says so. A read that did not answer keeps the offer; the rating screen re-reads.
  const ratingOpen = dogovor.ownRating === 'DUE' || dogovor.ownRating === 'UNKNOWN';
  const brand = canComplete ? { label: completeLabel, disabled: !enabled, onPress: openCompletionReview }
    : pendingChange?.mozeOdgovoriti ? { label: 'Odgovori na predlog', disabled: !enabled, onPress: openChanges }
      : dogovor.stanje === 'COMPLETED' && me && ratingOpen ? { label: 'Oceni saradnju', disabled: !enabled, onPress: review }
        : null;
  // The one place the state is said (round-1 critique A13); the words live beside the step card.
  const stepChange = { waits: !!changeWaits, mine: pendingChange ? pendingChange.moj : null };
  const quiet = brand ? null : agreementQuietLine({ state: dogovor.stanje, party: !!me, worker, otherName: other?.ime, change: stepChange, permissionsKnown: !!radnje });
  // The "···" menu: the rare actions, each under the condition of its row on the page below.
  const canChange = active && !!me && !(requester && dogovor.stanje === 'AWAITING_REQUESTER');
  const toChanges = (start: 'propose' | 'cancel') => { if (formCurrent()) router.push({ pathname: '/dogovor/[id]/izmene', params: { id, start } }); };
  const menuActions = agreementMenuActions({ party: !!me, hasOther: !!other, active, requester, canChange,
    phoneShared: dogovor.kontakt.mojTelefonPodeljen, hasLocation: dogovor.rezim !== 'DALJINSKI' && dogovor.kontakt.lokacijaPostoji,
    problemFree: !dogovor.problemOtvoren && !report, enabled }, {
    onChange: () => toChanges('propose'), onCancel: () => toChanges('cancel'),
    onPhone: () => { void sharePhone(!dogovor.kontakt.mojTelefonPodeljen); },
    onLocation: () => scrollToAnchor('place'),
    onProblem: () => { if (!formCurrent()) return; setProblemOpen(true); scrollToAnchor('problem'); },
    onSafety: () => { if (other && formCurrent()) router.navigate({ pathname: '/bezbednost', params: { targetAccountId: other.id, agreementId: id } }); },
  });
  const nextStep = agreementNextStep({ state: dogovor.stanje, party: !!me, worker, change: stepChange,
    ownRating: dogovor.ownRating, problemOpen: dogovor.problemOtvoren, deadline });
  // The same step, said at the head of Poruke only when it is mine (review r4 rd): words, never an action.
  const waitingForMe = me ? agreementWaitsForMe({ state: dogovor.stanje, requester, change: stepChange, ownRating: dogovor.ownRating }) : null;
  const problemPanel = report ? <WorkspaceCard tone="warn">
    <T accessibilityRole="header" variant="bodyStrong" style={s.ink}>Problem je prijavljen</T>
    <T variant="meta" tone="muted">{report.openedBy === accountId ? 'Prijava je tvoja.' : 'Prijavila je druga strana.'}</T>
    <T variant="meta" tone="muted">{vreme(report.openedAt)}</T>
    <T variant="body" style={s.ink}>{report.narrative}</T>
    <T variant="meta" tone="muted">Ovaj opis vide oba učesnika i sačuvan je u Porukama.</T>
    {problemAttempt && problemAttempt !== report.narrative ? <T variant="meta" tone="muted">Sačuvan je prvi opis prijave. Tvoj novi opis nije dodat. Za dopunu koristiš Poruke.</T> : null}
    {active ? <T variant="meta" tone="muted">Automatski završetak je zaustavljen. Završetak se i dalje može potvrditi. Prijava sama ne određuje krivicu ili dug.</T> : null}
  </WorkspaceCard> : dogovor.problemOtvoren ? <WorkspaceCard tone="warn">
    <T accessibilityRole="header" variant="bodyStrong" style={s.ink}>Problem je prijavljen</T>
    <T variant="meta" tone="muted">{dogovor.problemReportState === 'LEGACY_UNAVAILABLE'
      ? 'Detalji starije prijave nisu dostupni u ovom prikazu. Postojeća prijava ostaje sačuvana.'
      : 'Detalji prijave trenutno nisu učitani. Osveži status Dogovora da pokušaš ponovo.'}</T>
    {active ? <T variant="meta" tone="muted">Automatski završetak je zaustavljen. Završetak se i dalje može potvrditi. Prijava sama ne određuje krivicu ili dug.</T> : null}
    {dogovor.problemReportState === 'UNAVAILABLE' ? <V2Action label="Osveži detalje prijave" kind="quiet" disabled={!enabled} onPress={() => void osvezi()} /> : null}
  </WorkspaceCard> : active && me ? <WorkspaceCard>
    {!problemOpen ? <>
      <T variant="bodyStrong" style={s.ink}>Nešto nije u redu?</T>
      <T variant="meta" tone="muted">Prijava problema zaustavlja automatski završetak i vidi je druga strana.</T>
      <V2Action label="Prijavi problem" kind="quiet" disabled={!enabled} onPress={() => { if (formCurrent()) setProblemOpen(true); }} />
    </> : <>
      <T accessibilityRole="header" variant="bodyStrong" style={s.ink}>Problem u Dogovoru</T>
      <T variant="meta" tone="muted">Opis će videti druga strana u Porukama. Ovo nije poverljiva prijava podršci.</T>
      <TextInput accessibilityLabel="Opiši problem" value={problemText}
        onChangeText={value => { if (formCurrent() && !problemAttemptRef.current) setProblemText(value); }} multiline maxLength={4000}
        editable={enabled && !problemAttempt} placeholder="Šta je ostalo nerešeno?" placeholderTextColor={sys.color.muted} style={s.input} />
      <V2Action label={workspace.busy ? 'Čuvamo prijavu…' : problemAttempt ? 'Pošalji ponovo' : 'Pošalji prijavu problema'}
        disabled={!enabled || !(problemAttempt ?? problemText.trim())} onPress={() => { void reportProblem(); }} />
      {!problemAttempt ? <V2Action label="Odustani od prijave problema" kind="quiet" disabled={!enabled}
        onPress={() => { if (formCurrent() && !problemAttemptRef.current) setProblemOpen(false); }} /> : <T variant="meta" tone="muted">Opis je sačuvan na ovom ekranu. Pre ponavljanja osveži stanje Dogovora.</T>}
    </>}
  </WorkspaceCard> : null;

  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    {reviewingCompletion ? <AgreementCompletionReview agreement={completionReview!.agreement} worker={worker}
      confirm={confirmCompletionReview} back={dismissCompletionReview} /> : null}
    {/* Keyboard screenY and this full-screen parent share the same origin. */}
    <KeyboardAvoidingView style={s.screen} enabled={tab === 'poruke' || problemOpen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {tab === 'poruke' ? <AgreementThreadPresentation key={requestedMessageId ?? 'history'} agreement={dogovor} person={other}
        waiting={waitingForMe} onOverview={() => setTab('pregled')}
        // The same "···" as the overview's bar, so "Prijavi ili blokiraj osobu" and the rest are reachable while Poruke is shown.
        onMore={menuActions.length ? () => { if (ownsAccount()) setMenuOpen(true); } : undefined}
        onBack={fromInbox ? () => {
          if (renderedFormFocus !== null && formFocus.current === renderedFormFocus && ownsAccount() && activeRef.current && freshRef.current) {
            if (router.canGoBack()) router.back(); else router.replace('/poruke');
          }
        } : undefined}
        chat={{ messages: namedMessages, loading: messages.loading,
          error: messages.error, refreshing: messages.refreshing, refreshError: messages.refreshError,
          writable, terminal: !dogovor.chatDostupan, refresh: refreshMessages, refreshWorkspace: workspace.refresh, readingPosition: chatReadingPosition,
          hasOlder: !!messages.olderCursor, hasNewer: !!messages.newerCursor,
          loadingOlder: messages.loadingOlder, loadingNewer: messages.loadingNewer,
          historyError: !!messages.historyErrorDirection, historyErrorDirection: messages.historyErrorDirection,
          onLoadOlder: loadOlderMessages, onLoadNewer: loadNewerMessages, onShowLatest: showLatestMessages, onDisplayedMessageIds,
          outbox, state: outboxState, photos,
          voiceScope: { accountId, accountRevision, agreementId: id, version: dogovor.verzija, isCurrent: chatCurrent },
          support: { canAct: formCurrent, navigate: action => { if (formCurrent()) { formFocus.current = null; action(); } } } }} /> : <>
        {other ? <AgreementPersonBar person={other} back={backToAgreements}
          right={menuActions.length ? <ChromeIconButton glyph="more" label="Više radnji" hint="Izmena uslova, deljenje broja, prijava problema i otkazivanje"
            onPress={() => { if (ownsAccount()) setMenuOpen(true); }} /> : undefined} />
          : <ProductHeader back={backToAgreements} title="Dogovor" />}
        <View style={s.tabs}><AgreementTabs tab={tab} onChange={setTab} /></View>
        <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          {/* Where the Dogovor stands, from its state: Dogovoreno, Zadatak je gotov, Potvrđeno, Ocena. */}
          <AgreementSteps state={dogovor.stanje} ownRating={dogovor.ownRating} deadlineIso={dogovor.rokPotvrdeIso} problemOpen={dogovor.problemOtvoren} />
          <AgreementTaskLink agreement={dogovor} disabled={!enabled}
            onOpenTask={me && dogovor.izvor?.zadatakId ? () => {
              const needId = dogovor.izvor?.zadatakId;
              if (!needId || !formCurrent()) return;
              router.push(requester ? { pathname: '/potrebe/[id]/pregled', params: { id: needId } }
                : { pathname: '/prilike/[id]', params: { id: needId } });
            } : undefined} />
          {/* Identify the task first, then the next step, then the accepted snapshot. */}
          <NextStepCard tone={nextStep.tone} title={nextStep.title} body={nextStep.body}>
            {active && me && !radnje ? <View style={s.stack}>
              <T variant="meta" tone="muted">Još ne možemo da potvrdimo da je završetak dozvoljen. Osveži status Dogovora pre završetka.</T>
              <V2Action label="Osveži dozvole za završetak" kind="quiet" disabled={!enabled} onPress={() => void osvezi()} />
            </View> : null}
            {changeWaits ? <View style={s.stack}>
              {pendingChange?.izmene.map(change => <View key={change.polje} style={s.change}>
                <T variant="meta" tone="muted">{change.polje}</T>
                <T variant="body" style={s.ink}>{change.sada} → {change.predlog}</T>
              </View>)}
              {pendingChange?.razlog ? <T variant="meta" tone="muted">Razlog: {pendingChange.razlog}</T> : null}
              {pendingChange?.mozeOdgovoriti ? null
                : <V2Action label="Pogledaj predlog" kind="quiet" disabled={!enabled} onPress={openChanges} />}
            </View> : null}
          </NextStepCard>
          <AgreementTerms agreement={dogovor} />
          {/* A 1:1 Dogovor names its one other person in the bar; the list of both sides is kept for a group (A13). */}
          {isGroupAgreement(dogovor) ? <AgreementPeople agreement={dogovor} /> : null}
          {me && enabled && dogovor.pokrivenost.ukupno > 1 ? <GroupConversationEntry agreementId={id} /> : null}
          {/* One open section for the number and the place (it was a closed "Kontakt" and a closed "Lokacija i pristup"). */}
          <View onLayout={event => { anchors.current.place = event.nativeEvent.layout.y; flushAnchor('place'); }}>
            <AgreementContactPlace agreement={dogovor} enabled={enabled} concealed={resumeRequired} canShare={!!me}
              onTogglePhone={() => { void sharePhone(!dogovor.kontakt.mojTelefonPodeljen); }} />
          </View>
          {me ? <WorkspaceRows>
            {/* PKG-048 task source now belongs to the opening card; no duplicate destination row. */}
            {/* The requester has no screen that opens one Prijava by its id, so no "Prijava" row is drawn for them. */}
            {worker && dogovor.izvor?.prijavaId ? <WorkspaceRow art="offers" label="Tvoja prijava" disabled={!enabled}
              onPress={() => { const prijavaId = dogovor.izvor?.prijavaId; if (!prijavaId || !formCurrent()) return;
                router.push({ pathname: '/moje-prijave', params: { prijavaId } }); }} /> : null}
            {/* Once the worker says done, the requester confirms or reports a problem (owner decision 2026-09-21);
                there is nothing left behind this row for them, so it is not offered. */}
            {/* A finished or cancelled Dogovor has nothing left to change or cancel: the row opened a screen with no
                possible action (emulator sweep, 2026-09-23). */}
            {!active || (requester && dogovor.stanje === 'AWAITING_REQUESTER') ? null
              : <WorkspaceRow art="document" label="Izmene i otkazivanje Dogovora" visibleLabel="Izmene i otkazivanje" quiet hint="Cena, obim, termin ili otkazivanje uz razlog" disabled={!enabled}
                onPress={() => { if (formCurrent()) router.push({ pathname: '/dogovor/[id]/izmene', params: { id } }); }} />}
            {other ? <WorkspaceRow art="shield" label="Bezbednost i privatna prijava" visibleLabel="Bezbednost i prijava" quiet hint="Blokiranje i poverljiva prijava podršci" disabled={!enabled}
              onPress={() => { if (formCurrent())
                router.navigate({ pathname: '/bezbednost', params: { targetAccountId: other.id, agreementId: id } }); }} /> : null}
          </WorkspaceRows> : null}
          {dogovor.hronologija.length ? <AgreementSection art="clock" label="Tok Dogovora" summary="Sačuvani događaji">
            {dogovor.hronologija.map((event, index) => <View key={index} style={s.event}>
              <View style={s.eventLine} /><View style={s.eventCopy}><T variant="body" style={s.ink}>{event.tekst}</T><T variant="meta" tone="muted">{event.vremeTekst}</T></View>
            </View>)}
          </AgreementSection> : null}
          {problemPanel ? <View onLayout={event => { anchors.current.problem = event.nativeEvent.layout.y; flushAnchor('problem'); }}>{problemPanel}</View> : null}
        </ScrollView>
        <WorkspaceFooter brand={brand} quiet={quiet} loading={canComplete && workspace.busy && completing} statusText={footerStatus}
          onLayout={event => setFooterHeight(Math.round(event.nativeEvent.layout.height))}
          notice={workspace.error || workspace.uncertain ? {
            message: workspace.error ?? 'Proveravamo ishod prethodne radnje.',
            refresh: () => void osvezi(), refreshing: workspace.busy || workspace.loading,
          } : null} />
      </>}
    </KeyboardAvoidingView>
    {/* This screen covers the navigator that hosts the outcome bar, so it carries its own host, above its footer. Only the
        overview: the conversation has a composer in that place. */}
    {tab === 'pregled' ? <PorukaHost clearance={brand || quiet || footerStatus || workspace.error || workspace.uncertain ? footerHeight : 0} /> : null}
    {menuOpen && menuActions.length ? <ActionSheet label="Radnje Dogovora" actions={menuActions} onClose={() => setMenuOpen(false)} /> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  status: { padding: 24, gap: 16 }, center: { textAlign: 'center' },
  ink: { color: sys.color.ink }, danger: { color: sys.color.danger },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 16 },
  tabs: { paddingHorizontal: sys.space.lg, paddingBottom: sys.space.md },
  stack: { gap: 8, marginTop: 4 }, change: { gap: 2 },
  input: { ...field, minHeight: 100, textAlignVertical: 'top' },
  event: { flexDirection: 'row', gap: 12 }, eventLine: { width: 2, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, marginVertical: 4 }, eventCopy: { flex: 1, gap: 2 },
});
