import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppState } from 'react-native';

import type { AiNeedTurnRecovery, AiNeedTurnStatus, AiNeedV2Conversation } from '../../contracts/aiNeedV2';
import { aiNeedV2Izvor } from '../../data';
import { aiTurnIntentJournal } from '../../data/aiTurnIntentJournal';
import { locationDialogueEnabled, resolveLocationDialogue } from '../../data/locationDialogueClientService';
import type { LocationDialogueRequest } from '../../contracts/locationDialogue';
import type { LocationReplyLease, LocationReplyPrompt } from '../../ui/location/ConversationPointAsk';
import { rememberIntakeReviewReturn, retireIntakeReviewReturn, type IntakeReviewReturn } from '../../data/intakeReviewReturn';
import type { Ishod } from '../../data/ports';
import { uuid } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';


import { IntakePresentation, IntakeUnavailable } from '../../ui/v2/IntakePresentation';
import type { IntakeTurnRole } from '../../ui/v2/intakeLocationOrder';
import { SEND_UNCONFIRMED_CODE, conversationErrorLine } from '../../ui/aiFirst/aiDownLine';
import { useHoldToTalk } from '../../features/voice/useHoldToTalk';
import { useConfirmSheet } from '../../ui/system/ConfirmSheet';
import { tick } from '../../ui/system/haptics';
import { UNCERTAIN_ABOUT } from '../../ui/system/outcomeCopy';
import type { PhotoSource } from '../../features/media/nativePhotoPicker';
import { useTaskPhotoUploads } from '../../ui/media/useTaskPhotoUploads';

type IntakeSnapshot = { conversation: AiNeedV2Conversation; turn: AiNeedTurnStatus | null; recovery: AiNeedTurnRecovery | null };
type SubmittedDraft = { value: string; revision: number };
type PendingTurn = { id: string; body: string | null; submittedDraft: SubmittedDraft | null; locationContext?: LocationDialogueRequest['locationContext'] };

export default function NovaPotrebaV2() {
  const params = useLocalSearchParams<{ conversationId?: string | string[]; entryKey?: string | string[] }>();
  const { user, accountRevision } = useSesija();
  const resumeId = typeof params.conversationId === 'string' ? params.conversationId : undefined;
  const entryKey = typeof params.entryKey === 'string' ? params.entryKey : undefined;
  const invalidRoute = (params.conversationId !== undefined && (!resumeId || !uuid(resumeId)))
    || (params.entryKey !== undefined && (!entryKey || !uuid(entryKey)));
  return <OwnedIntake key={`${user?.id ?? ''}:${accountRevision}:${resumeId ?? ''}:${entryKey ?? ''}:${invalidRoute}`}
    resumeId={resumeId} entryKey={entryKey} invalidRoute={invalidRoute} />;
}

/** A conversation that has not been started. It is never sent anywhere and never read back. */
const BLANK: AiNeedV2Conversation = { conversationId: '', schemaVersion: 'NEED_FACT_V2', status: 'OPEN',
  messages: [], facts: [], safety: 'ALLOW',
  review: { conversationId: '', schemaVersion: 'NEED_FACT_V2', boundNeedId: null, canSaveDraft: false, missingRequired: [], facts: [] } };

function OwnedIntake({ resumeId, entryKey, invalidRoute }: { resumeId?: string; entryKey?: string; invalidRoute: boolean }) {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const [openRequestId] = useState(noviUuidZahtevId);
  const conversation = useRef<string | null>(resumeId ?? null);
  const request = useRef<PendingTurn | null>(null), abandoning = useRef(false);
  // The data layer's sentence for the last send it could not prove delivered: the status line says that once (`conversationErrorLine`).
  const unconfirmedSend = useRef<string | null>(null);
  const dialogueEnabled = locationDialogueEnabled();
  const locationPrompt = useRef<LocationReplyPrompt | null>(null);
  const locationFlight = useRef<LocationReplyLease | null>(null);
  const turnRoles = useRef<Record<string, IntakeTurnRole>>({});
  const speechPrompt = useRef<{ generation: number; lease: LocationReplyLease | null; blocked: boolean } | null>(null);
  const registerLocationPrompt = useCallback((prompt: LocationReplyPrompt | null) => { locationPrompt.current = prompt; }, []);
  const retireLocation = useCallback(() => {
    speechPrompt.current?.lease?.cancel(); speechPrompt.current = null;
    locationFlight.current?.cancel(); locationFlight.current = null;
  }, []);

  const [unos, setUnos] = useState('');
  const [retainedLocationSpeech, setRetainedLocationSpeech] = useState<string | null>(null);
  const draftText = useRef(unos); draftText.current = unos;
  const draftRevision = useRef(0);
  const [recoveryConversation, setRecoveryConversation] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const streamAbort = useRef<AbortController | null>(null);
  // The send command that is running right now, if any. While it runs its outcome is not unknown, it is not here yet:
  // the owned editor is busy with exactly this command, and only once it settles may the screen say what is uncertain.
  const sendFlight = useRef<object | null>(null);
  const focus = useRef<object | null>(null), navigating = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') return;
      const hadContext = !!locationFlight.current;
      retireLocation();
      if (hadContext) streamAbort.current?.abort();
    });
    return () => subscription.remove();
  }, [retireLocation]);

  const reviewReturn = useRef<IntakeReviewReturn | null>(null);
  useEffect(() => () => retireIntakeReviewReturn(reviewReturn.current), []);
  const confirmation = useConfirmSheet(), retireConfirmation = confirmation.close;
  useFocusEffect(useCallback(() => {
    const scope = {}; focus.current = scope; navigating.current = false;
    // A completed return (including Android Back) cannot be reused by an older review route.
    retireIntakeReviewReturn(reviewReturn.current); reviewReturn.current = null;
    // Leaving retires an open question: its answer checks this focus and would do nothing any more.
    return () => { if (focus.current === scope) focus.current = null; retireLocation(); retireConfirmation();
      streamAbort.current?.abort(); streamAbort.current = null; setStreamingText(''); setPhotoSourceAfterOpen(null); };
  }, [accountId, accountRevision, retireConfirmation]));
  const read = useCallback(async (): Promise<Ishod<IntakeSnapshot>> => {
    const scope = focus.current;
    const current = () => scope !== null && scope === focus.current && !!accountId
      && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
    const unavailable = (): Ishod<never> => ({ ok: false, kod: 'AI_INTAKE_UNAVAILABLE',
      poruka: 'Razgovor trenutno nije dostupan. Proveri vezu i učitaj ga ponovo.' });
    if (invalidRoute || !current()) return unavailable();
    try {
      const stored = await aiTurnIntentJournal.load(accountId!);
      if (!current()) return unavailable();
      if (stored) {
        if (resumeId && resumeId !== stored.conversationId) {
          setRecoveryConversation(stored.conversationId);
          return { ok: false, kod: 'AI_OTHER_TURN_PENDING', poruka: 'Prethodna poruka možda nije stigla. Otvori taj razgovor i proveri je.' };
        }
        if (conversation.current && conversation.current !== stored.conversationId) return unavailable();
        conversation.current = stored.conversationId;
        if (!request.current || request.current.id !== stored.clientRequestId)
          request.current = { id: stored.clientRequestId, body: null, submittedDraft: null };
      }
      // Opening the screen used to open a row: 38 of 62 conversations had no message in them, one
      // for every time someone looked and left. Merely viewing still creates nothing.
      // The first send, or an explicit permitted speech gesture, opens the owned conversation.
      if (!conversation.current) return { ok: true, podatak: { conversation: BLANK, turn: null, recovery: null } };
      const id = conversation.current;
      const pending = request.current;
      let turn: AiNeedTurnStatus | null = null;
      let recovery: AiNeedTurnRecovery | null = null;
      if (pending) {
        const status = await aiNeedV2Izvor.recoverTurn(id, pending.id);
        if (!current()) return unavailable();
        if (!status.ok) return status;
        recovery = status.podatak; turn = recovery.turn;
      }
      const next = await aiNeedV2Izvor.loadConversation(id);
      if (!current() || !next || next.conversationId !== id) return unavailable();
      // Persisted FAILED after dispatch is terminal: SQL cannot reclaim this key
      // or complete a late attempt. PROCESSING (including expired) stays unknown.
      const terminalFailure = turn?.state === 'FAILED' && recovery?.providerDispatched && !turn.retryAllowed;
      if (pending && recovery && (recovery.cancelled || turn?.state === 'SUCCEEDED' || terminalFailure || next.status === 'ABANDONED')) {
        await aiTurnIntentJournal.clear({ accountId: accountId!, conversationId: id, clientRequestId: pending.id });
        if (!current()) return unavailable();
        if (request.current?.id === pending.id) {
          request.current = null;
          // Only a typed Send owns this exact draft revision. Speech and restored IDs own none;
          // retries keep the original ownership, and later edits survive successful readback.
          const submittedDraft = pending.submittedDraft;
          // Contextual held speech has no typed-draft owner. Retain its words on a terminal failure/cancel instead of
          // losing them when the receipt retires the journal. It is restored only by an explicit user action.
          if (pending.locationContext && !submittedDraft && pending.body && (terminalFailure || recovery.cancelled))
            setRetainedLocationSpeech(pending.body);
          if (turn?.state === 'SUCCEEDED' && submittedDraft) setUnos(value =>
            draftRevision.current === submittedDraft.revision && value === submittedDraft.value ? '' : value);
          setStreamingText('');
        }
      }
      return { ok: true, podatak: { conversation: next, turn, recovery } };
    } catch { return unavailable(); }
  }, [accountId, accountRevision, invalidRoute, openRequestId, resumeId]);
  const editor = useOwnedEditor(read);
  // The two controls offered at the worst moment - "Proveri ishod" and "Osveži razgovor" - used to
  // unmount the whole thread and, if the re-read then failed, leave "Razgovor nije dostupan" where
  // the conversation had been. Every word looked deleted by the button meant to save them. This
  // component is keyed by account, revision, intent and conversation id, so what it remembers can
  // only ever belong to the conversation on screen.
  const lastGood = useRef<AiNeedV2Conversation | null>(null);
  if (editor.data?.conversation) lastGood.current = editor.data.conversation;
  const stanje = editor.data?.conversation ?? lastGood.current, turn = editor.data?.turn ?? null;
  const razgovorId = stanje?.conversationId ?? null;
  const radi = editor.busy, greska = editor.error;
  // A command that fails ticks once with the failure pattern (haptics rule R5); the same words showing again do not tick twice.
  const failed = useRef<string | null>(null);
  useEffect(() => { if (greska && greska !== failed.current) tick('error'); failed.current = greska; }, [greska]);
  // The draft's photos (the conversation's "+"): the task photo screen's own upload path and journal, bound to this conversation.
  const photos = useTaskPhotoUploads(razgovorId || null);
  // A source chosen before the conversation existed waits here until opening it is confirmed and its photos are read.
  const [photoSourceAfterOpen, setPhotoSourceAfterOpen] = useState<PhotoSource | null>(null);
  const view = useMemo(() => ({}), [editor.data]), currentView = useRef(view);
  currentView.current = view;
  const renderedFocus = focus.current;
  const isCurrent = () => renderedFocus !== null && focus.current === renderedFocus && currentView.current === view
    && !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const canAct = () => isCurrent() && !navigating.current && !editor.loading && !editor.busy && !editor.uncertain && !!stanje;
  const navigate = (action: () => void) => { if (!isCurrent() || navigating.current) return;
    navigating.current = true; voice.controller.cancel('navigation'); action(); };
  const back = () => navigate(() => router.canGoBack() ? router.back() : router.replace('/potrebe'));
  const pending = request.current;
  const knownRetry = !!pending?.body && (!pending.locationContext || dialogueEnabled) && turn?.clientRequestId === pending.id && turn.retryAllowed;
  const writable = stanje?.status === 'OPEN' && stanje.safety !== 'BLOCK' && !abandoning.current;
  const canSubmit = writable && !editor.loading && !radi && !editor.uncertain && (!pending || knownRetry);

  const submitTurn = async (body: string, submittedDraft: SubmittedDraft | null = null, pointLease: LocationReplyLease | null = null) => {
    if (!canAct() || !canSubmit || !body || (pointLease && !pointLease.isCurrent())) { pointLease?.cancel(); return; }
    // Context remains attached to the original request key, including in-memory safe retries. A restored journal id
    // has no context/lease and can only recover its receipt; it cannot replay a confirmation against a new map.
    locationFlight.current = pointLease;
    // Marked inside the admitted command only: a retained second tap that the editor refuses must not clear the first one.
    const flight = {};
    try { await editor.save(async () => {
      sendFlight.current = flight;
      // The first word is what makes the conversation exist. `openRequestId` is fixed for this
      // screen, so a second tap or a retry asks for the same conversation rather than another one.
      let id = conversation.current;
      if (!id) {
        const opened = await aiNeedV2Izvor.openConversation(openRequestId);
        if (!isCurrent()) return { ok: false, kod: 'AI_INTAKE_CHANGED', poruka: 'Ponovo otvori razgovor.' };
        if (!opened.ok) return opened;
        conversation.current = id = opened.podatak.conversationId;
      }
      const command: PendingTurn = request.current ?? { id: noviUuidZahtevId(), body, submittedDraft,
        ...(pointLease ? { locationContext: pointLease.context } : {}) };
      request.current = command;
      try {
        await aiTurnIntentJournal.save({ accountId: accountId!, conversationId: id, clientRequestId: command.id });
      } catch {
        return { ok: false, kod: 'AI_LOCAL_INTENT_NOT_SAVED', poruka: 'Poruka nije poslata. Pokušaj ponovo.' };
      }
      // Backgrounding can retire the map question while storage is pending, before an HTTP abort
      // controller exists. Returning to the foreground does not revive that confirmation lease.
      if (!isCurrent() || !command.body || (pointLease && !pointLease.isCurrent()))
        return { ok: false, kod: 'AI_INTAKE_CHANGED', poruka: 'Ponovo otvori razgovor.' };
      const abort = new AbortController(); streamAbort.current?.abort(); streamAbort.current = abort;
      setStreamingText('');
      let result: Ishod<AiNeedTurnStatus>;
      try {
        if (command.locationContext) {
          const resolved = await resolveLocationDialogue({ mode: 'locationReply', conversationId: id,
            text: command.body, clientRequestId: command.id, locationContext: command.locationContext }, {
            signal: abort.signal, isCurrent: () => isCurrent() && request.current === command && !abort.signal.aborted,
          });
          if (!resolved.ok) result = resolved;
          else {
            result = { ok: true, podatak: resolved.podatak.turn };
            if (resolved.podatak.turn.state === 'SUCCEEDED' && resolved.podatak.location
              && isCurrent() && request.current === command && !abort.signal.aborted)
              turnRoles.current[resolved.podatak.turn.receipt.assistantMessageId] = resolved.podatak.location.action;
            // A recovered/retried receipt without this live lease updates the conversation but never presses a map button.
            if (resolved.podatak.turn.state === 'SUCCEEDED' && resolved.podatak.location && pointLease
              && isCurrent() && request.current === command && !abort.signal.aborted && pointLease.isCurrent()) {
              await pointLease.apply(resolved.podatak.location);
            }
          }
        } else {
          // The answer can introduce a location AND ask the next question. Wait for its canonical facts before presenting it;
          // otherwise that next question flashes above the map. Worker-profile streaming has no such location phase.
          result = await aiNeedV2Izvor.sendMessage(id, command.body, command.id, { signal: abort.signal, onText: () => {} });
          if (result.ok && result.podatak.state === 'SUCCEEDED' && isCurrent() && request.current === command && !abort.signal.aborted)
            turnRoles.current[result.podatak.receipt.assistantMessageId] = 'ordinary';
        }
      } finally {
        if (streamAbort.current === abort) { streamAbort.current = null; if (isCurrent()) setStreamingText(''); }
      }
      if (!isCurrent()) return { ok: false, kod: 'AI_INTAKE_CHANGED', poruka: 'Ponovo otvori razgovor.' };
      unconfirmedSend.current = !result.ok && result.kod === SEND_UNCONFIRMED_CODE ? result.poruka : null;
      if (!result.ok) return result;
      return read();
    }); } finally {
      if (sendFlight.current === flight) sendFlight.current = null;
      pointLease?.cancel();
      if (locationFlight.current === pointLease) locationFlight.current = null;
    }
  };
  const cancelPendingTurn = () => {
    const command = request.current;
    if (!canAct() || !razgovorId || !command || !editor.data?.recovery?.canCancel) return;
    void editor.save(async () => {
      const result = await aiNeedV2Izvor.cancelTurn(razgovorId, command.id);
      if (!isCurrent()) return { ok: false, kod: 'AI_INTAKE_CHANGED', poruka: 'Ponovo otvori razgovor.' };
      if (!result.ok) return result;
      // Completion may win this race. Only exact canonical readback retires
      // the intent; transport abort or a lost cancel ACK cannot retire it.
      return read();
    });
  };
  const keepTranscript = (text: string) => {
    if (!canAct() || !canSubmit || request.current) return false;
    const next = [draftText.current.trimEnd(), text.trim()].filter(Boolean).join('\n');
    if (!next || next.length > 4000) return false;
    draftRevision.current += 1; draftText.current = next; setUnos(next); return true;
  };
  const voice = useHoldToTalk({
    conversationId: () => writable && !navigating.current ? conversation.current ?? '' : null,
    prepareConversation: async ({ signal, isCurrent: speechCurrent }) => {
      if (!canAct() || !canSubmit || request.current || signal.aborted || !speechCurrent()) return null;
      if (conversation.current) return null; // Existing conversations bypass preparation.
      // Reuse the first-send key. Preparation has no AI turn, draft journal or provider call.
      const opened = await aiNeedV2Izvor.openConversation(openRequestId);
      if (!isCurrent() || navigating.current || signal.aborted || !speechCurrent() || !opened.ok) return null;
      return { conversationId: opened.podatak.conversationId, adopt: () => {
        if (!isCurrent() || navigating.current || signal.aborted || !speechCurrent()) return false;
        conversation.current = opened.podatak.conversationId;
        return true;
      } };
    },
    onTranscript: input => {
      if (!input.isCurrent()) return false;
      // Held microphone: what was said is the message, sent the moment the finger lifts (owner,
      // 2026-09-23). The typed draft stays where it is. The accessible start/stop mode keeps the
      // old hand-off — the text lands in the draft for review — because a person who cannot hold
      // the button cannot pull up to cancel either, so the review IS their cancel.
      if (input.session?.mode !== 'accessible') {
        const spoken = input.text.trim();
        if (!spoken || spoken.length > 4000 || !canAct() || !canSubmit || request.current) return false;
        const bound = speechPrompt.current;
        if (bound && bound.generation === input.session.generation && (bound.blocked || (bound.lease && !bound.lease.isCurrent()))) return false;
        const lease = bound && bound.generation === input.session.generation ? bound.lease : null;
        speechPrompt.current = null; // Ownership transfers to the journalled normal-turn path before speech becomes IDLE.
        void submitTurn(spoken, null, lease);
        return true;
      }
      return keepTranscript(input.text);
    } });

  const speechScope = useRef({ dialogueEnabled, canStart: () => canAct() && !!canSubmit && !request.current });
  speechScope.current = { dialogueEnabled, canStart: () => canAct() && !!canSubmit && !request.current };
  useEffect(() => {
    const changed = () => {
      const snapshot = voice.controller.getSnapshot();
      if (snapshot.phase === 'PERMISSION_PENDING' && snapshot.session && !speechPrompt.current) {
        const prompt = speechScope.current.dialogueEnabled ? locationPrompt.current : null;
        const lease = prompt && speechScope.current.canStart() ? prompt.acquire() : null;
        speechPrompt.current = { generation: snapshot.session.generation, lease, blocked: !!prompt && !lease };
      } else if (snapshot.phase === 'IDLE') {
        speechPrompt.current?.lease?.cancel(); speechPrompt.current = null;
      }
    };
    const unsubscribe = voice.controller.subscribe(changed);
    return () => { unsubscribe(); speechPrompt.current?.lease?.cancel(); speechPrompt.current = null; };
  }, [voice.controller]);
  const voiceBusy = voice.state.phase !== 'IDLE';
  const photosBlocked = () => !canAct() || !writable || !!request.current || voiceBusy;
  /**
   * A source chosen in the conversation's photo sheet. With a conversation it picks at once. Before the first word there is
   * none, and choosing a source is the explicit gesture that opens it (owner, 2026-10-07: "+" works before the first word
   * too), exactly as the first word or the held microphone does: the screen's one opening key, no AI turn and no draft
   * journal. The picker opens once the opened conversation and its (empty) photos are read back.
   */
  const choosePhotoSource = (source: PhotoSource) => {
    if (photosBlocked() || photoSourceAfterOpen) return;
    if (razgovorId) { void photos.pick(source); return; }
    if (!canSubmit) return;
    setPhotoSourceAfterOpen(source);
    void editor.save(async () => {
      if (!conversation.current) {
        const opened = await aiNeedV2Izvor.openConversation(openRequestId);
        if (!isCurrent()) return { ok: false, kod: 'AI_INTAKE_CHANGED', poruka: 'Ponovo otvori razgovor.' };
        if (!opened.ok) return opened;
        conversation.current = opened.podatak.conversationId;
      }
      return read();
    }).finally(() => { if (!conversation.current) setPhotoSourceAfterOpen(null); });
  };
  useEffect(() => {
    if (!photoSourceAfterOpen || !razgovorId) return;
    if (photos.readError) { setPhotoSourceAfterOpen(null); return; }
    if (!photos.loaded || photos.busy) return;
    const source = photoSourceAfterOpen; setPhotoSourceAfterOpen(null);
    if (!photosBlocked()) void photos.pick(source);
  }, [photoSourceAfterOpen, razgovorId, photos.loaded, photos.busy, photos.readError]);
  const posalji = async () => {
    if (voice.controller.getSnapshot().phase !== 'IDLE') return;
    const prompt = dialogueEnabled && !request.current ? locationPrompt.current : null;
    const lease = prompt?.acquire() ?? null;
    if (prompt && !lease) return;
    await submitTurn(request.current?.body ?? unos.trim(), { value: unos, revision: draftRevision.current }, lease);
  };
  const noviZadatak = () => {
    if (!canAct() || request.current || (stanje?.status !== 'COMPLETED' && stanje?.status !== 'ABANDONED')) return;
    // Replace drops the old resume parameter. Keying the retained tab starts a
    // fresh owned opener; it does not delete or reopen the terminal conversation.
    navigate(() => router.replace({ pathname: '/nova', params: { entryKey: noviUuidZahtevId() } }));
  };
  const osvezi = () => { if (!isCurrent() || navigating.current || radi || editor.loading) return;
    voice.controller.cancel('navigation'); void editor.refresh(); };
  const napusti = () => {
    if (!canAct() || !razgovorId || stanje?.status !== 'OPEN' || stanje.review.boundNeedId) return;
    const submit = () => {
      if (!canAct()) return;
      // Stop native capture before the terminal command can hide its controls.
      // Cancellation never finalizes audio or sends a transcript to the AI.
      voice.controller.cancel('navigation');
      // Returned so the confirmation waits on it (a busy confirm) instead of closing before the command is sent.
      return editor.save(async () => {
        abandoning.current = true;
        const result = await aiNeedV2Izvor.abandonConversation(razgovorId);
        if (!isCurrent()) return { ok: false, kod: 'AI_INTAKE_CHANGED', poruka: 'Ponovo otvori razgovor.' };
        if (!result.ok) return result;
        return read();
      });
    };
    if (abandoning.current) { void submit(); return; }
    confirmation.ask({ title: 'Napustiti razgovor?', message: 'Ovaj razgovor više ne možeš da nastaviš. Njegovi podaci se ovim ne brišu.',
      cancelLabel: 'Nastavi razgovor', confirmLabel: 'Napusti razgovor', tone: 'danger', onConfirm: submit });
  };

  if (!stanje) return <IntakeUnavailable loading={editor.loading}
    error={greska ?? 'Proveri vezu i pokušaj ponovo.'} retry={invalidRoute || recoveryConversation ? undefined : osvezi} back={back}
    recover={recoveryConversation ? () => navigate(() => router.replace({ pathname: '/nova', params: { conversationId: recoveryConversation } })) : undefined} />;

  // The send is still running (the answer may be streaming): "Stiže odgovor…" is the whole truth, so no recovery is drawn.
  // Before 2026-10-07 the request was already pending here while the last read held no turn for it, and the copy below fell
  // through to "Ishod slanja nije potvrđen" with a disabled "Proveri ishod" under a reply that was arriving. Every recovery
  // branch below still applies the moment the command settles without a confirmed outcome.
  const sending = radi && sendFlight.current !== null;
  const statusCopy = sending && stanje.status === 'OPEN' ? null : stanje.status !== 'OPEN'
    ? stanje.status === 'ABANDONED' ? 'Razgovor je napušten.'
      : stanje.status === 'COMPLETED' ? 'Razgovor je završen. Sačuvani zadatak možeš otvoriti iz pregleda.'
        : 'Nastavak ovog razgovora nije dostupan.'
    : abandoning.current ? 'Ne znamo da li je razgovor napušten.'
      // A dispatched attempt that can already be cancelled is one whose lease the server has let
      // go: on 2026-09-18 two of these sat at "AI još obrađuje poruku" for over two hours while the
      // function had already logged AI_PROVIDER_FAILED. The server still cannot call the turn
      // failed - it does not know what the provider did with the money - but the screen must stop
      // implying that an answer is on its way, and must name the way out.
      : pending ? turn?.state === 'PROCESSING'
        ? editor.data?.recovery?.canCancel && editor.data.recovery.providerDispatched
          ? 'Asistent još nije odgovorio na ovu poruku. Ako odgovor ne stigne, otkaži slanje pa pošalji ponovo.'
          : 'Asistent još obrađuje poruku. Sačekaj odgovor.'
        : knownRetry ? 'Poruka je sačuvana za ponovni pokušaj. Pošalji ponovo.'
          : editor.data?.recovery?.canCancel ? 'Prethodno slanje nije završeno. Otkaži ga da ponovo uneseš poruku.'
          : `${UNCERTAIN_ABOUT.message.title}.`
        : editor.data?.recovery?.cancelled && editor.data.recovery.providerDispatched
          ? 'Odgovor je zaustavljen. Poruka je ipak poslata jer je asistent već počeo da je obrađuje; zadatak je ostao isti.'
        : turn?.state === 'FAILED' && editor.data?.recovery?.providerDispatched
          ? 'Asistent nije uzeo u obzir prethodnu poruku. Izmeni je i pošalji ponovo.' : null;

  return <><IntakePresentation conversationKey={`${accountId}:${accountRevision}:${resumeId ?? openRequestId}`}
    conversationOwnerKey={`${accountId}:${accountRevision}`}
    turnRoles={turnRoles.current}
    conversation={stanje} value={unos} busy={radi} error={conversationErrorLine(greska, { hasDraft: stanje.facts.length > 0, unconfirmedSend: unconfirmedSend.current, statusCopy })}
    canSubmit={!!canSubmit && !voiceBusy && !!(request.current?.body ?? unos).trim()}
    canEdit={!!canSubmit && !voiceBusy && !request.current} pending={!!request.current} statusCopy={statusCopy}
    locationDialogueEnabled={dialogueEnabled} onLocationPromptReady={registerLocationPrompt}
    retainedLocationSpeech={retainedLocationSpeech ? { text: retainedLocationSpeech,
      canRestore: !!canSubmit && !voiceBusy && !request.current
        && [unos.trimEnd(), retainedLocationSpeech.trim()].filter(Boolean).join('\n').length <= 4000,
      onRestore: () => { if (voice.controller.getSnapshot().phase === 'IDLE' && keepTranscript(retainedLocationSpeech)) setRetainedLocationSpeech(null); },
    } : undefined}
    locationDisabled={dialogueEnabled ? !writable || editor.loading || editor.uncertain
      || (!!request.current && !locationFlight.current) || (radi && !locationFlight.current) || !!greska : undefined}
    sentMessage={request.current?.body ?? null}
    streamingText={streamingText}
    // The "+" opens the photo sheet inside the conversation (no separate screen for adding), before the first word too.
    photosDisabled={photosBlocked() || !!photoSourceAfterOpen}
    photos={writable ? photos : undefined} onPhotoSource={writable ? choosePhotoSource : undefined}
    // The shell draws the microphone, its notice and voice mode from this one controller; every transcript still comes
    // back through `onTranscript` above, so each guard on sending stays here.
    voice={stanje.status === 'OPEN' ? { controller: voice.controller, state: voice.state, disabled: !canSubmit || !!request.current,
      onKeepText: keepTranscript } : undefined}
    canReview={!!razgovorId && stanje.facts.length > 0 && !radi && !editor.loading && !editor.uncertain && !request.current}
    reviewLabel={stanje.review.boundNeedId ? 'Pregledaj izmene' : 'Pregledaj zadatak'}
    showReadback={!sending && !!(editor.uncertain || ((request.current || abandoning.current) && stanje.status === 'OPEN') || greska)}
    readbackDisabled={radi || editor.loading}
    onCancelPending={!sending && pending && editor.data?.recovery?.canCancel ? cancelPendingTurn : undefined}
    cancelPendingDisabled={!canAct()}
    cancelPendingDispatched={editor.data?.recovery?.providerDispatched}
    showAbandon={!!razgovorId && stanje.status === 'OPEN' && !stanje.review.boundNeedId}
    abandonDisabled={radi || editor.loading || editor.uncertain}
    abandonLabel={abandoning.current ? 'Pokušaj ponovo da napustiš razgovor' : 'Napusti razgovor'}
    onNewTask={stanje.status === 'COMPLETED' || stanje.status === 'ABANDONED' ? noviZadatak : undefined}
    newTaskDisabled={!canAct() || !!request.current}
    onBack={back} onSend={posalji} onRefresh={osvezi} onAbandon={napusti}
    onChange={value => { if (canAct() && writable && !request.current) {
      draftRevision.current += 1; draftText.current = value; setUnos(value);
    } }}
    onReview={() => {
      if (!canAct() || !razgovorId || request.current) return;
      const handoff = rememberIntakeReviewReturn({ accountId: accountId!, accountRevision }, razgovorId,
        { ...(resumeId ? { conversationId: resumeId } : {}), ...(entryKey ? { entryKey } : {}) });
      if (!handoff) return;
      reviewReturn.current = handoff;
      navigate(() => router.push({ pathname: '/pregled-zadatka', params: { conversationId: razgovorId, intakeReturn: handoff.token } }));
    }} />{confirmation.sheet}</>;
}
