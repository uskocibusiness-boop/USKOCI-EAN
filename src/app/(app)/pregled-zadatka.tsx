import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SupportContextEntry } from '../../ui/support/SupportContextEntry';
import { aiTaskReviewClientService, type AiTaskReviewEnvelope, type AiTaskReviewFact,
  type AiTaskPublicationCommand } from '../../data/aiTaskReviewClientService';
import { reviewFactProblem } from '../../data/reviewFactProblem';
import { APPLICATION_PROMISE } from '../../data/ownTaskStanding';
import { publishedTaskRoute, rememberPublication } from '../../data/publicationHandoff';
import { readIntakeReviewReturn } from '../../data/intakeReviewReturn';
import { aiNeedV2Izvor, izvor } from '../../data';
import { choiceCorrectionText, editorCorrection, factChoiceValue, factChoices, factCorrectionValue, factEditorKind, factLabel,
  factListItems, factReviewValue, factTimestampFields, listCorrectionText, priceAmountRowValue, timestampCorrectionText } from '../../data/aiNeedV2Ui';
import type { NeedFactV2Key } from '../../contracts/needFactsV2';
import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { IDENTITY_VERIFICATION_UNAVAILABLE_COPY, NEED_FACT_V2_DEFINITIONS } from '../../contracts/needFactsV2';
import type { Ishod } from '../../data/ports';
import { uuid } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';

import { T } from '../../ui/Text';
import { V2Action } from '../../ui/v2/V2Action';
import { NeedLifecycleActions, type NeedLifecycleMenu } from '../../ui/needs/NeedLifecycleActions';
import { DetailTopBar } from '../../ui/system/DetailTopBar';
import { StateView } from '../../ui/system/StateView';
import { useConfirmSheet } from '../../ui/system/ConfirmSheet';
import { useReducedMotion } from '../../ui/system/motion';
import { poruka } from '../../ui/system/Poruka';
import { FlowFooter } from '../../ui/system/FlowFooter';
import { CHECK_SPOKEN, OUTCOME_ACTION, UNCERTAIN_ABOUT, cannotLoad } from '../../ui/system/outcomeCopy';
import { tick } from '../../ui/system/haptics';
import { layout } from '../../ui/system/layout';
import { Surface } from '../../ui/system/Surface';
import { brandAction, sys } from '../../ui/system/tokens';
import { DOGOVORENA_ZONA, dogovorenoVreme } from '../../lib/dogovorenoVreme';
import { NeedLocationForm } from '../../ui/location/NeedLocationForm';
import { needLocationClientService } from '../../data/locationClientService';
import { createProductionLocationResolver } from '../../data/productionLocationResolver';
import type { NeedLocationInput, NeedLocationReview } from '../../contracts/location';
import { FactListEditor, FactTimestampEditor } from '../../ui/aiFirst/FactValueEditors';
import { FactChoiceEditor } from '../../ui/v2/FactChoiceEditor';
import { AmountField, AmountWithOffers } from '../../ui/v2/AmountField';
import { ResponseDeadlineEditor } from '../../ui/aiFirst/ResponseDeadlineEditor';
import { mediaAssetId } from '../../ui/media/AuthorizedPhoto';
import { publicSummary } from '../../ui/v2/draftSummary';
import { SUPPORT_HAS_DUTY_OPERATOR, manualCheckCopy, ownerPlaceLines, privateReviewMap, publicAnchorPoint, publicPlaceLines, reviewRowValue,
  reviewTodos, todoActionLabel } from '../../ui/objava/reviewFacts';
import { PublishedMoment } from '../../ui/objava/PublishedMoment';
import { LocationMapPreview } from '../../ui/location/LocationMapPreview';
import { OwnerPlaces, PrivatePlace, PublicPlace, PublishButton, ReviewDeadline, ReviewEmptyFacts, ReviewFactRow, ReviewPhotos,
  ReviewFrame, ReviewPreview, ReviewSection, ReviewStatus, ReviewTodoList, ReviewWaysOut, reviewStyles as s, type TodoRow } from '../../ui/objava/ReviewPresentation';

type Snapshot = { review: AiTaskReviewEnvelope; command: AiTaskPublicationCommand | null; publishedReadback: boolean; locationConflict: boolean;
  /** The task this review is bound to, when it reads as a private draft that was never published: then the review is its FIRST publication. */
  draftNeed: PotrebaProjekcija | null;
  /** The bound task is (or, once accepted, was) a private draft, so the words are those of a first publication, not of an edit. */
  firstPublication: boolean };
/** `text` is always what `correctionFromText` reads; a picker, a list field, a choice or the amount field only writes it. */
type Edit = { fact: AiNeedV2Fact; text: string; error: string | null; date?: string; time?: string; items?: string[]; choice?: string | null };
const changed = (): Ishod<never> => ({ ok: false, kod: 'REVIEW_CHANGED', poruka: 'Ponovo otvori pregled za trenutni nalog.' });
function displayFact(fact: AiTaskReviewFact): AiNeedV2Fact {
  const definition = NEED_FACT_V2_DEFINITIONS[fact.key];
  return { ...fact, id: fact.id ?? fact.key, valueType: definition.valueType,
    requiredForDraft: definition.requiredForDraft, evidence: null };
}

export default function ReviewedTaskRoute() {
  const params = useLocalSearchParams<{ conversationId?: string | string[]; intakeReturn?: string | string[] }>();
  const { user, accountRevision } = useSesija();
  const conversationId = typeof params.conversationId === 'string' && uuid(params.conversationId) ? params.conversationId : null;
  return <ReviewedTask key={`${user?.id}:${accountRevision}:${conversationId}`} conversationId={conversationId}
    intakeReturn={typeof params.intakeReturn === 'string' ? params.intakeReturn : undefined} />;
}

function ReviewedTask({ conversationId, intakeReturn }: { conversationId: string | null; intakeReturn?: string }) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const pending = useRef<{ review: AiTaskReviewEnvelope; id: string } | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [locationEditor, setLocationEditor] = useState<NeedLocationReview | null>(null);
  // Facts with nothing in them are named in one line rather than given a row each, and that
  // line opens them. Nothing is hidden; a wall of "Nema navedenih stavki" is just not a wall.
  const [showEmpty, setShowEmpty] = useState(false);
  const [deadlineEditor, setDeadlineEditor] = useState(false);
  // True only while the write in flight is the publish itself: every other save (a draft, a corrected fact, the place,
  // the deadline) also makes the editor busy, and "Objavi zadatak" must not spin for those.
  const [publishing, setPublishing] = useState(false);
  // The place is being read before its editor opens: the "Uredi mesto" action says so.
  const [opening, setOpening] = useState(false);
  const locationOpening = useRef<{ active: boolean } | null>(null);
  // A place that could not be read says so beside its button, instead of the button doing nothing.
  const [openError, setOpenError] = useState<string | null>(null);
  // True once a publish or resume started on this screen read back its publication: only that confirms itself with the
  // spring. A published review restored on opening is simply shown (motion only on a real state change).
  const publishedHere = useRef(false);
  // The calm "Objavljeno" moment that follows a publication confirmed on this screen (see `PublishedMoment`). It is shown once per
  // publication, and it ends in the task's own overview.
  const [moment, setMoment] = useState(false);
  const momentShown = useRef(false);
  const deadlineProposal = useRef<string | null | undefined>(undefined);
  // The deadline is a term other people read, so it is set and shown in Serbian time like every
  // agreed time (owner rule 8.27); the facts above it already read in that zone.
  const deadlineTimezone = DOGOVORENA_ZONA;
  const locationProposal = useRef<{ expectedRevision: string; value: NeedLocationInput } | null>(null);
  const resolver = useMemo(() => createProductionLocationResolver(), [accountId, accountRevision, conversationId]);
  // "Obriši nacrt" asks first, in the centred dialog; the question belongs to this focus and goes with it.
  const confirmation = useConfirmSheet(), closeConfirmation = confirmation.close;
  const question = useRef<object | null>(null);
  // A review opened from "Nacrti" is bound to a task that was never published: its deletion is the lifecycle's own (it asks, persists and
  // recovers there), and `lifecycleActive` says that a question or a command of it is on the screen.
  const lifecycleMenu = useRef<NeedLifecycleMenu | null>(null);
  const [lifecycleActive, setLifecycleActive] = useState(false);
  // The bound task that last read as a private draft. Once the review is accepted the next read is of the stored command, no longer of the
  // task, and the screen must go on saying "first publication" (and "Zadatak je objavljen.") until the task is published.
  const firstPublicationOf = useRef<string | null>(null);
  useFocusEffect(useCallback(() => { const scope = {}; focus.current = scope; navigating.current = false;
    return () => { if (focus.current === scope) focus.current = null;
      if (locationOpening.current) locationOpening.current.active = false;
      locationOpening.current = null; setOpening(false);
      question.current = null; closeConfirmation();
      setEdit(null); setLocationEditor(null); setDeadlineEditor(false); resolver.cancel(); };
  }, [accountId, accountRevision, resolver, closeConfirmation]));
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    const scope = focus.current;
    const current = () => scope !== null && scope === focus.current && !!accountId
      && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
    if (!conversationId || !current()) return changed();
    const latest = pending.current
      ? await aiTaskReviewClientService.read(pending.current.review.reviewId)
      : await aiTaskReviewClientService.readLatest(conversationId);
    if (!current()) return changed();
    if (!latest.ok) return latest;
    if (latest.podatak?.command) {
      const { review, command } = latest.podatak;
      let publishedReadback = false;
      if (command.state === 'PUBLISHED') {
        const need = await izvor.potreba(command.needId);
        if (!current()) return changed();
        publishedReadback = need?.id === command.needId && need.revizija === command.needRevision
          && ['OBJAVLJENA', 'CEKA_PRIJAVE', 'DELIMICNO_POPUNJENA', 'POPUNJENA'].includes(need.stanje);
      }
      return { ok: true, podatak: { review, command, publishedReadback, locationConflict: false, draftNeed: null,
        firstPublication: !!review.draftId && firstPublicationOf.current === review.draftId } };
    }
    let locationConflict = false;
    const savedReview = latest.podatak?.review;
    let location = locationProposal.current ?? (savedReview?.location
      ? { expectedRevision: savedReview.geographyRevision, value: savedReview.location } : null);
    if (location) {
      // A manual location is persisted in the immutable review before final
      // acceptance. Recover it against its geographical source, independently
      // of unrelated changes (for example, a corrected title).
      const canonical = await needLocationClientService.read(conversationId);
      if (!current()) return changed();
      if (!canonical.ok) return canonical;
      if (canonical.podatak.revision !== location.expectedRevision) {
        if (locationProposal.current === location) locationProposal.current = null;
        location = null;
        locationConflict = true;
      }
    }
    const prepared = await aiTaskReviewClientService.prepare({ conversationId,
      responseDeadline: deadlineProposal.current !== undefined ? deadlineProposal.current : latest.podatak?.review.responseDeadline ?? null,
      ...(location ? { location } : {}) });
    if (!current()) return changed();
    if (!prepared.ok) return prepared;
    if (locationConflict) setLocationEditor(null);
    pending.current = null;
    // Bound to a task: is it a private draft? A draft opened from "Nacrti" is reviewed for its FIRST publication, so the screen says so
    // and may delete it; anything else bound (or a read that fails) is an edit of a task that exists, and nothing is deleted from here.
    let draftNeed: PotrebaProjekcija | null = null;
    if (prepared.podatak.draftId) {
      try {
        const need = await izvor.potreba(prepared.podatak.draftId);
        draftNeed = need && need.id === prepared.podatak.draftId && need.stanje === 'NACRT' ? need : null;
      } catch { draftNeed = null; }
      if (!current()) return changed();
    }
    firstPublicationOf.current = draftNeed ? draftNeed.id : null;
    return { ok: true, podatak: { review: prepared.podatak, command: null, publishedReadback: false, locationConflict, draftNeed,
      firstPublication: !!draftNeed } };
  }, [conversationId, accountId, accountRevision]);
  const editor = useOwnedEditor(read);
  // The newest render's word on whether the editor is reading, writing or waiting for an outcome, and on whether the lifecycle is asking about
  // or deleting the draft. A press kept from an earlier render sees only that render's state; the exits below are not writes of the editor,
  // so its own single-writer rule does not cover them, and nothing may be sent while the draft is being deleted.
  const busyNow = useRef(false); busyNow.current = editor.busy || editor.loading || editor.uncertain;
  const lifecycleNow = useRef(false); lifecycleNow.current = lifecycleActive;
  const snapshot = editor.data, review = snapshot?.review, command = snapshot?.command;
  // `draftId` is the task this conversation is bound to. It is set exactly when the person came here from a task that exists: a private
  // draft opened from "Nacrti" (`draftNeed`: its FIRST publication, and it can be deleted) or a published task being changed (an edit).
  const bound = !!review?.draftId, draftNeed = snapshot?.draftNeed ?? null;
  const firstPublication = bound && !!snapshot?.firstPublication;
  const revising = bound && !firstPublication;
  const view = useMemo(() => ({}), [snapshot, edit, locationEditor, deadlineEditor, intakeReturn]), currentView = useRef(view); currentView.current = view;
  const renderedFocus = focus.current;
  const current = () => renderedFocus !== null && focus.current === renderedFocus && currentView.current === view
    && !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const canAct = () => current() && !navigating.current && !locationOpening.current && !editor.loading && !editor.busy && !editor.uncertain
    && !lifecycleNow.current;
  const navigate = (fn: () => void) => { if (!current() || navigating.current) return; navigating.current = true; fn(); };
  const back = () => navigate(() => {
    if (!conversationId) { router.replace('/nova'); return; }
    // Keep the original route key: adding the newly assigned conversationId remounted a new
    // intake and erased its unsent text. Direct/restored reviews still open the canonical ID.
    const retained = readIntakeReviewReturn(intakeReturn, conversationId);
    router.replace({ pathname: '/nova', params: retained?.params ?? { conversationId } });
  });
  const refresh = () => { if (current() && !editor.busy && !editor.loading && !navigating.current) void editor.refresh(); };
  const unavailableIdentityFact = review?.publicProjection.find(fact => fact.key === 'need.verified_identity_required' && fact.value === true);
  // How the price works, read as the preview reads it: under "Ponude" the amount row and its editor show no amount.
  const priceModeFact = review?.publicProjection.find(fact => fact.key === 'need.price_mode' && fact.status !== 'UNKNOWN');
  const priceMode = priceModeFact?.value;
  // "Objavi" and "Sačuvaj nacrt" are the same acceptance of the same displayed review, under one
  // retained command identity; they differ only in whether evaluation and publication follow now.
  const accept = async (andPublish: boolean) => {
    if (!canAct() || !review || !review.canAccept || unavailableIdentityFact || edit || locationEditor || deadlineEditor || command || review.accountId !== accountId) return;
    const accepted = pending.current ?? { review, id: noviUuidZahtevId() }; pending.current = accepted;
    // Marked only once the editor has taken the write (the export screen's rule), so a refused second press never
    // clears the first one's spinner.
    let started = false;
    try {
      await editor.save(async () => {
        started = true; if (andPublish) setPublishing(true);
        const request = { review: accepted.review, clientRequestId: accepted.id };
        const result = await (andPublish ? aiTaskReviewClientService.acceptAndPublish(request) : aiTaskReviewClientService.acceptAsDraft(request));
        if (!current()) return changed();
        if (!result.ok) return result;
        return publishedRead(await read());
      });
    } finally { if (started) setPublishing(false); }
  };
  const publish = () => accept(true);
  function publishedRead(next: Ishod<Snapshot>): Ishod<Snapshot> {
    if (next.ok && next.podatak.command?.state === 'PUBLISHED' && next.podatak.publishedReadback) publishedHere.current = true;
    return next;
  }
  const resume = async () => {
    if (!canAct() || !command || !review || unavailableIdentityFact) return;
    await editor.save(async () => {
      const result = await aiTaskReviewClientService.resume(command);
      if (!current()) return changed();
      if (!result.ok) return result;
      return publishedRead(await read());
    });
  };
  const saveEdit = async () => {
    if (!canAct() || !edit || command) return;
    // Under "Ponude" the amount editor offers no save: a number left from before must not be sent as the price.
    if (factEditorKind(edit.fact) === 'amount' && priceMode === 'OFFERS') return;
    const parsed = editorCorrection(edit.fact, edit.text);
    if (!parsed.ok) { setEdit({ ...edit, error: parsed.message }); return; }
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.correctFact(edit.fact.id, parsed.value, parsed.displayValue);
      if (!current()) return changed();
      if (!result.ok) return result;
      setEdit(null); pending.current = null;
      return read();
    });
  };
  const removeUnavailableIdentityRequirement = async () => {
    if (!canAct() || !unavailableIdentityFact?.id || command || edit || locationEditor || deadlineEditor) return;
    const factId = unavailableIdentityFact.id;
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.correctFact(factId, false, 'Ne');
      if (!current()) return changed();
      if (!result.ok) return result;
      pending.current = null;
      return read();
    });
  };
  const openLocation = async () => {
    if (!canAct() || !conversationId || !review || command || edit || deadlineEditor || opening) return;
    const request = { active: true }; locationOpening.current = request;
    setOpening(true); setOpenError(null);
    let result: Awaited<ReturnType<typeof needLocationClientService.read>>;
    try { result = await needLocationClientService.read(conversationId); }
    catch { if (current() && request.active) setOpenError('Mesto trenutno nije učitano. Pokušaj ponovo.'); return; }
    finally { if (locationOpening.current === request) { locationOpening.current = null; setOpening(false); } }
    if (!current() || !request.active) return;
    if (!result.ok) { setOpenError(result.poruka); return; }
    const proposed = locationProposal.current ?? (review.location
      ? { expectedRevision: review.geographyRevision, value: review.location } : null);
    // Never relabel an old place with the freshly read revision: doing so would let
    // a stale A be explicitly accepted as though it were based on current B.
    if (proposed && proposed.expectedRevision !== result.podatak.revision) {
      locationProposal.current = null;
      setOpenError('Mesto se promenilo posle otvaranja pregleda. Proveri novu lokaciju pre izmene.');
      await editor.refresh();
      return;
    }
    setEdit(null);
    setLocationEditor({ ...result.podatak, value: proposed?.value ?? result.podatak.value });
  };
  const proposeLocation = async (value: NeedLocationInput) => {
    if (!canAct() || !locationEditor || !conversationId || command) return;
    locationProposal.current = { expectedRevision: locationEditor.revision, value };
    await editor.save(async () => {
      const result = await read();
      if (current() && result.ok) setLocationEditor(null);
      return result;
    });
  };
  const proposeDeadline = async (value: string | null) => {
    if (!canAct() || !deadlineEditor || command) return;
    deadlineProposal.current = value;
    await editor.save(async () => {
      const result = await read();
      if (current() && result.ok) setDeadlineEditor(false);
      return result;
    });
  };
  const revisePublishedDraft = async () => {
    if (!canAct() || !command) return;
    const supportedEditExit = command.state === 'EVALUATED' && (command.evaluation?.kind === 'NOT_READY'
      || (command.evaluation?.kind === 'DECISION' && command.evaluation.decision.outcome !== 'ALLOW'));
    // The canonical ACCEPTED state has no evaluation dispatch;145 also blocks
    // any later claim for this immutable unsupported review. Unknown stays read-only.
    const unavailableEditExit = !!unavailableIdentityFact && command.authoritative === true
      && (command.state === 'EVALUATED' || command.state === 'ACCEPTED');
    if (!supportedEditExit && !unavailableEditExit) return;
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.openEditConversation(command.needId);
      if (!current()) return changed();
      if (!result.ok) return result;
      navigate(() => router.replace({ pathname: '/nova', params: { conversationId: result.podatak.conversationId } }));
      return { ok: true, podatak: snapshot! };
    });
  };
  // "Izmeni zadatak" before publishing: back to the conversation this review was prepared from, which keeps the draft. It is the same way
  // back as the arrow ("Nazad u razgovor"), with the same retained intake identity, now where the owner can see it (owner, 2026-10-07:
  // "at least I do not see that function easily"). Nothing is sent; an open correction, the place or the deadline holds it like the others.
  const editInConversation = () => { if (!busyNow.current && canAct() && !command && !edit && !locationEditor && !deadlineEditor) back(); };
  // "Obriši nacrt" (owner, 2026-10-07), in the two places a draft can be:
  // - A review that has not been accepted has no task yet: its draft is the conversation it was written in, and the one command the server
  //   has for that is to leave the conversation (`rpc_ai_abandon_need_conversation_v2`, which refuses a conversation bound to a task). The
  //   dialog promises only what that command does: the task is not published and the conversation cannot be continued. There is no way to
  //   undo it, so the outcome bar has no "Vrati".
  // - A review bound to a private draft (opened from "Nacrti") deletes that task through the lifecycle's own command, exactly as the
  //   draft's screen does (`NeedLifecycleActions`: it asks, persists the command, sends it once and recovers an unconfirmed outcome).
  //   A published task being changed offers no deletion here: it is cancelled from its own screen.
  const draftName = () => {
    const title = review?.publicProjection.find(fact => fact.key === 'need.title' && fact.status !== 'UNKNOWN')?.value;
    const name = typeof title === 'string' ? title.trim().replace(/\s+/g, ' ') : '';
    return name.length > 60 ? `${name.slice(0, 59).trimEnd()}…` : name;
  };
  const deleteBoundDraft = () => {
    if (!busyNow.current && canAct() && !command && !edit && !locationEditor && !deadlineEditor) lifecycleMenu.current?.request('DELETE_DRAFT');
  };
  const discardDraft = () => {
    if (busyNow.current || !canAct() || !conversationId || bound || command || edit || locationEditor || deadlineEditor || question.current) return;
    const asked = {}, id: string = conversationId; question.current = asked;
    const name = draftName();
    confirmation.ask({ title: name ? `Obrisati nacrt „${name}“?` : 'Obrisati nacrt?', confirmLabel: 'Obriši nacrt', tone: 'danger',
      message: 'Zadatak se neće objaviti, a razgovor o njemu više ne možeš da nastaviš.',
      onCancel: () => { if (question.current === asked) question.current = null; },
      onConfirm: () => {
        const mine = question.current === asked; question.current = null;
        if (!mine || busyNow.current || !canAct()) return;
        // The sheet waits on the command it started and shows no outcome of its own: the bar and the next screen do.
        return editor.save(async () => {
          const result = await aiNeedV2Izvor.abandonConversation(id);
          if (!current()) return changed();
          if (!result.ok) return result;
          poruka.show({ text: 'Nacrt je obrisan.', confirmed: true });
          navigate(() => router.replace('/'));
          return { ok: true, podatak: snapshot! };
        });
      } });
  };

  const evaluation = command?.evaluation;
  const outcome = evaluation?.kind === 'DECISION' ? evaluation.decision.outcome : null;
  const published = command?.state === 'PUBLISHED' && snapshot?.publishedReadback;
  // Opens the task that was just published: its OWN overview, where the owner sees what it is doing and what comes next, never the
  // Zadaci map (owner, 2026-10-07). Every guard of the hand-off is the same as it was; only where it lands changed.
  // It says whether the way on has started, so that Android Back during the moment is only taken when it leads somewhere.
  const openPublished = (): boolean => {
    if (!canAct() || !published || !review || !command || !accountId
      || AppState.currentState === 'background' || AppState.currentState === 'inactive') return false;
    const handoff = rememberPublication({ review, command, publishedReadback: true }, { accountId, accountRevision });
    if (!handoff) return false;
    publishedHere.current = false;
    navigate(() => router.replace(publishedTaskRoute(handoff)));
    return navigating.current;
  };
  // Only a command completed on this visit shows the "Objavljeno" moment, once, and only after the editor has accepted the canonical
  // read and released its write. The moment continues by itself after `PUBLISHED_MOMENT_MS`, on a tap, and on Android Back. Restoring
  // an older published review shows no moment: it keeps its explicit "Otvori zadatak".
  useEffect(() => {
    if (publishedHere.current && published && !momentShown.current && !editor.busy && !editor.loading && !editor.uncertain) {
      momentShown.current = true; setMoment(true);
    }
  }, [published, command, review, editor.busy, editor.loading, editor.uncertain]); // eslint-disable-line react-hooks/exhaustive-deps
  const openPublishedNow = useRef(openPublished); openPublishedNow.current = openPublished;
  const momentOpen = moment && !!published;
  // Back must not return into a finished conversation: during the moment it goes where the moment goes. If the way on cannot start
  // (a fence refused it), Back is not swallowed: the person is never held on this screen.
  useFocusEffect(useCallback(() => {
    if (!momentOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => openPublishedNow.current());
    return () => subscription.remove();
  }, [momentOpen]));
  // The server already knows the difference between publishing a new task and changing one that exists — accepting a bound review confirms
  // an edit instead of creating a draft — but the screen said "Objavi zadatak" either way, right after the conversation had offered
  // "Pregledaj izmene". The button says what the tap does (`revising`, above): "Potvrdi izmene i objavi" for a published task being changed,
  // and "Objavi zadatak" for a new task AND for a private draft that was never published (owner's phone, 2026-10-07: a draft opened from
  // "Nacrti" read "Pregled izmena" and "Potvrdi izmene i objavi", words of an edit on a first publication).
  const acceptLabel = revising ? 'Potvrdi izmene i objavi' : 'Objavi zadatak';
  // What the server would refuse about the facts themselves: no amount for "Moja cena", a fixed time without
  // both ends, or one that has already begun (deep read 8.5, 5.1).
  const factProblem = review && !published && !command ? reviewFactProblem(review) : null;
  // `canAccept` is false for exactly three server reasons (a safety block, something missing, no place on the map); each
  // is a row of "Još treba" with its way to the fix, and the grey publish says in one line that they come first.
  const todos = review && !published && !command ? reviewTodos(review, factProblem, !!unavailableIdentityFact) : [];
  const resultCopy = published ? (revising ? 'Izmene su objavljene.' : 'Zadatak je objavljen.') : command?.state === 'PUBLISHED'
    ? 'Objava je zabeležena. Ponovo učitaj zadatak da proveriš prikaz.'
    : outcome === 'CLARIFY' ? 'Zadatku je potrebna dopuna. Ispravi ga u razgovoru i pregledaj novu verziju.'
    // Deep read 8.7: support has no operator yet (7.31), so a review request waits; saying so is the honest part, and (owner decision
    // d07, 2026-10-07) the only way offered is "Izmeni zadatak": no request to support stands beside this sentence while nobody is on duty.
    : outcome === 'REVIEW' ? manualCheckCopy()
    : outcome === 'BLOCK' ? 'Zadatak nije odobren za objavu. Pregledaj pravila i izmeni opis zadatka.'
    : evaluation?.kind === 'NOT_READY' ? 'Provera objave trenutno nije spremna. Tvoj zadatak je sačuvan kao privatan nacrt.'
    // ACCEPTED is exactly "the private draft exists and nothing after it has been confirmed", whether
    // the person asked for a draft or a publish stopped here.
    : command?.state === 'ACCEPTED' ? 'Sačuvano kao privatan nacrt. Zadatak nije objavljen.'
    // What the app does not know, in the table's words; the one button under it ("Proveri") is the way to find out, and while it is not known
    // there is no second publish beside it.
    : command ? `${UNCERTAIN_ABOUT.publication.title}.` : null;
  // What the screen itself is doing; the lifecycle (the deletion of a bound draft) is told this, and never its own activity, or its confirm
  // would be refused by the very question it asked.
  const screenBusy = editor.busy || editor.loading || editor.uncertain || opening;
  const disabled = screenBusy || lifecycleActive;
  const publishBlocked = !review || disabled || !review.canAccept || !!factProblem || !!unavailableIdentityFact || !!edit || !!locationEditor || !!deadlineEditor;
  // "Loading = the write this action started": only the publish spins the publish button; while a draft or a fact saves
  // it simply waits grey.
  const publishWorking = editor.busy && publishing;
  // Everything else on the review waits while a save runs, another edit or the deadline is open, or an outcome is not read yet.
  const quietEdit = disabled || !!edit || !!locationEditor || deadlineEditor;
  // One line ABOVE the publish button, in the foot: the first thing in its way, short (the full list is "Još treba" above), or what
  // the tap does. A grey button always says why, and the reason stands over it, not under it, where it read as the next thing.
  const caption = todos.length || unavailableIdentityFact ? 'Prvo uradi ono što piše pod „Još treba“.'
    : edit ? 'Sačuvaj ili otkaži otvorenu izmenu.'
      : deadlineEditor ? 'Sačuvaj ili zatvori rok za prijave.'
        : revising ? 'Objavljuješ izmenjenu verziju zadatka.'
          : 'Objavljuješ ovu verziju zadatka.';
  // A command that fails ticks once with the failure pattern (haptics rule R5), whether it ends in a refusal or in an outcome not known.
  const failedWith = useRef<string | null>(null);
  useEffect(() => { if (editor.error && editor.error !== failedWith.current) tick('error'); failedWith.current = editor.error; }, [editor.error]);
  const reduced = useReducedMotion();
  const EMPTY_VALUE = new Set(['—', 'Nema navedenih stavki', 'Bez fotografija', '']);
  // An open correction scrolls its row into view, so its field is never left under the keyboard or the footer.
  const scroll = useRef<ScrollView>(null), content = useRef<View>(null), rowRefs = useRef(new Map<string, View>());
  useEffect(() => {
    const key = edit?.fact.key, row = key ? rowRefs.current.get(key) : undefined, host = content.current;
    if (!row || !host || typeof row.measureLayout !== 'function') return;
    row.measureLayout(host as never, (_x, y) => scroll.current?.scrollTo({ y: Math.max(0, y - 16), animated: !reduced }), () => undefined);
  }, [edit?.fact.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // The place is its own step: the arrow and Android Back both return to the review, and nothing is saved by leaving.
  // Leaving saves nothing, so only a write in flight holds it: after an unconfirmed outcome the way out stays open.
  const closePlace = () => { if (editor.busy) return; resolver.cancel(); setLocationEditor(null); };
  const closePlaceNow = useRef(closePlace); closePlaceNow.current = closePlace;
  const placeOpen = !!locationEditor;
  useFocusEffect(useCallback(() => {
    if (!placeOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { closePlaceNow.current(); return true; });
    return () => subscription.remove();
  }, [placeOpen]));
  /** `replacing`: the amount's "Izaberi način cene" hands its open editor over to the price mode's, nothing saved. */
  const startEdit = (fact: AiTaskReviewFact, replacing = false) => {
    if (!canAct() || (edit && !replacing) || locationEditor || deadlineEditor || command) return;
    // A place is structured and has its own editor; every other fact is corrected right here.
    const shown = displayFact(fact), kind = factEditorKind(shown);
    if (kind === 'none' || PLACE_KEYS.includes(fact.key)) { void openLocation(); return; }
    // A choice starts on the stored value when it is one of the choices, and on none otherwise (a retired value).
    const choice = kind === 'choice' ? factChoiceValue(shown) : undefined;
    setEdit({ fact: shown, text: kind === 'choice' ? choiceCorrectionText(shown, choice ?? null) : factCorrectionValue(shown), error: null,
      ...(kind === 'timestamp' ? factTimestampFields(shown) : {}), ...(kind === 'list' ? { items: factListItems(shown) } : {}),
      ...(kind === 'choice' ? { choice } : {}) });
  };
  // People never see or choose a category (owner decision 2026-09-21, deep read 9.2). The AI still
  // writes it for the server, which reads a kind of work from it only to match; it is not a row here.
  // Facts with nothing in them are named in one line rather than given a row each, and that line opens them.
  const rows = (all: readonly AiTaskReviewFact[]) => {
    const items = all.filter(fact => fact.key !== 'need.category');
    const blank = items.filter(fact => edit?.fact.id !== fact.id
      && EMPTY_VALUE.has(factReviewValue(displayFact(fact)).trim()));
    const carried = showEmpty ? items : items.filter(fact => !blank.includes(fact));
    const emptyLine = blank.length > 0 && !showEmpty;
    return <>
      {carried.map((fact, index) => row(fact, index === carried.length - 1 && !emptyLine))}
      {emptyLine ? <ReviewEmptyFacts labels={blank.map(fact => factLabel(fact.key))} onOpen={() => setShowEmpty(true)} /> : null}
    </>;
  };
  const row = (fact: AiTaskReviewFact, last = false) => {
    const shown = displayFact(fact), editing = edit?.fact.id === shown.id;
    const kind = editing ? factEditorKind(edit.fact) : null;
    // Under "Ponude" the task carries no amount: its editor shows none and saves none, it only leads to the price mode.
    const amountWithOffers = kind === 'amount' && priceMode === 'OFFERS';
    // While the screen cannot act (a save runs, another edit is open, an outcome is not read yet) a row says no "Izmeni": nothing is
    // drawn that cannot be pressed, and the one open thing is the only thing left to press.
    return <ReviewFactRow key={fact.key} label={factLabel(fact.key)} value={priceAmountRowValue(priceMode, shown) ?? reviewRowValue(shown)}
      system={fact.source === 'SYSTEM'} last={last}
      edit={!command && fact.id && !quietEdit ? () => startEdit(fact) : undefined}
      rowRef={node => { if (node) rowRefs.current.set(fact.key, node); else rowRefs.current.delete(fact.key); }}>
      {editing ? <>
        {kind === 'timestamp' ? <FactTimestampEditor label={factLabel(fact.key)} date={edit.date ?? ''} time={edit.time ?? ''}
          disabled={disabled} onChange={(date, time) => { if (canAct()) setEdit({ ...edit, date, time, error: null,
            text: timestampCorrectionText(edit.fact, date, time) }); }} />
        : kind === 'list' ? <FactListEditor label={factLabel(fact.key)} items={edit.items ?? []} disabled={disabled}
          onChange={(items, typed) => { if (!canAct()) return;
            const pending = typed.trim();
            setEdit({ ...edit, items, error: null,
              text: listCorrectionText(pending && !items.includes(pending) ? [...items, pending] : items) }); }} />
        : kind === 'choice' ? <FactChoiceEditor label={factLabel(fact.key)} options={factChoices(edit.fact)} value={edit.choice ?? null}
          disabled={disabled} onChange={choice => { if (canAct()) setEdit({ ...edit, choice, error: null,
            text: choiceCorrectionText(edit.fact, choice) }); }} />
        : amountWithOffers ? <AmountWithOffers disabled={disabled}
          onChooseMode={priceModeFact?.id ? () => startEdit(priceModeFact, true) : undefined} />
        : kind === 'amount' ? <AmountField label={factLabel(fact.key)} digits={edit.text} disabled={disabled}
          onChange={digits => { if (canAct()) setEdit({ ...edit, text: digits, error: null }); }} />
        : <TextInput accessibilityLabel={`Nova vrednost: ${factLabel(fact.key)}`} value={edit.text} multiline
          onChangeText={text => { if (canAct()) setEdit({ ...edit, text, error: null }); }} editable={!disabled} style={s.input} />}
        {edit.error ? <T accessibilityRole="alert" style={s.error}>{edit.error}</T> : null}
        {amountWithOffers ? null : <V2Action label="Sačuvaj ispravku" disabled={disabled} onPress={saveEdit} />}
        <V2Action label="Odustani od ispravke" kind="quiet" disabled={disabled} onPress={() => setEdit(null)} />
      </> : undefined}
    </ReviewFactRow>;
  };

  // The moment replaces the whole review: a finished publication has nothing left to change here. It continues to the task's own
  // overview by itself, on a tap and on Android Back (see `PublishedMoment`); this route's own fence decides whether it may.
  if (momentOpen && command && review) return <PublishedMoment
    title={revising ? 'Izmene su objavljene.' : 'Zadatak je objavljen.'}
    line={revising ? 'Prijave stižu ovde.' : APPLICATION_PROMISE.published}
    onContinue={openPublished} />;
  // The place mode replaces the whole review (one map at a time, no publish under the editor).
  if (locationEditor && review) return <SafeAreaView edges={['top', 'bottom']} style={frame.canvas}>
    <KeyboardAvoidingView style={frame.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DetailTopBar title="Mesto zadatka" backLabel="Nazad na pregled" disabled={editor.busy} onBack={closePlace} />
      {editor.error || editor.uncertain ? <View style={frame.alert}><Surface kind="note" tone="danger"><View style={frame.alertBody}>
        {editor.error ? <T accessibilityRole="alert" style={s.error}>{editor.error}</T> : null}
        <V2Action label={editor.uncertain ? OUTCOME_ACTION.check : OUTCOME_ACTION.refresh} accessibilityLabel={editor.uncertain ? CHECK_SPOKEN : 'Osveži pregled'}
          disabled={editor.busy || editor.loading} loading={editor.loading} onPress={refresh} />
      </View></Surface></View> : null}
      <NeedLocationForm layout="screen" reviewOnly review={locationEditor}
        resolver={resolver} busy={editor.busy} uncertain={editor.uncertain} onSave={proposeLocation} />
    </KeyboardAvoidingView>
  </SafeAreaView>;

  const summary = review ? publicSummary(review.publicProjection) : null;
  const geography = review?.publicProjection.find(fact => fact.key === 'need.task_geography');
  const privateMap = privateReviewMap(review?.location);
  // What the owner CONFIRMED, in the words of the confirmed points (a pin moved after the first text is what is read), private half only.
  const confirmedPlaces = ownerPlaceLines(review?.location);
  // What a stranger will read of the place once this is published: the stored words, never a point's address. A route names its stops
  // (street and place, never a house number: owner decision 2, 2026-09-24); one place or an area adds a line when its words say
  // something the area line does not, as the published detail does, so what is published no longer appears only after publishing.
  const publicLines = summary ? publicPlaceLines(geography?.value, summary.zone || null) : [];
  const photoPaths = review?.publicProjection.find(fact => fact.key === 'need.public_photo_paths')?.value;
  const photoAssets = (Array.isArray(photoPaths) ? photoPaths.map(path => typeof path === 'string' ? mediaAssetId(path) : null) : [])
    .filter((assetId): assetId is string => !!assetId);
  const hasPhotos = Array.isArray(photoPaths) && photoPaths.length > 0;
  const publicRows = review?.publicProjection.filter(fact => !PUBLIC_ELSEWHERE.includes(fact.key)) ?? [];
  // Each row is a way to its fix and says so in words (owner's phone, 2026-10-07: "Početak termina je već prošao" was a sentence with a faint arrow
  // beside a grey button): the time or the amount opens its editor right there, the place opens the place step, and a fact this screen
  // cannot edit (it has no row to open) goes back to the conversation instead of leaving a row that does nothing.
  const todoRows: TodoRow[] = todos.map(todo => {
    const target = todo.target;
    const fact = target && target !== 'conversation' && target !== 'location'
      ? review?.publicProjection.find(item => item.key === target && item.id) : undefined;
    const viaConversation = target === 'conversation' || (!!target && target !== 'location' && !fact);
    return { key: todo.key, text: todo.text, actionLabel: todoActionLabel(todo, viaConversation),
      onPress: viaConversation ? back : target === 'location' ? () => { void openLocation(); } : fact ? () => startEdit(fact) : undefined };
  });
  const identityBlock = unavailableIdentityFact ? <View style={s.identity}>
    <T variant="meta" tone="muted">{IDENTITY_VERIFICATION_UNAVAILABLE_COPY}</T>
    <T variant="body">Ovaj zadatak traži uslov koji aplikacija ne može da proveri. Ukloni uslov da bi zadatak mogao da se objavi.</T>
    {!command && unavailableIdentityFact.id ? <V2Action label="Ukloni uslov i nastavi" kind="quiet"
      disabled={quietEdit} onPress={removeUnavailableIdentityRequirement} /> : null}
  </View> : null;
  // The place's one word, "Uredi mesto" / "Dodaj mesto", is not drawn while anything else is in flight; while the place itself is being read it
  // says so ("Otvaramo mapu…"), because pressing it is what started that.
  const placeBusy = editor.busy || editor.loading || editor.uncertain || lifecycleActive || !!edit || deadlineEditor;
  // Which green action a stored command offers: its resume, or the way back to the conversation. With neither, the check is the one way forward
  // and wears the green itself.
  const resumeShown = !!command && !unavailableIdentityFact && (command.state === 'ACCEPTED' || (command.state === 'EVALUATED' && outcome === 'ALLOW'));
  const editShown = !!command && ((command.state === 'EVALUATED' && (evaluation?.kind === 'NOT_READY' || (!!outcome && outcome !== 'ALLOW')))
    || (!!unavailableIdentityFact && command.authoritative === true && (command.state === 'EVALUATED' || command.state === 'ACCEPTED')));
  // The table's three words (`system/outcomeCopy`): what is not known is looked at ("Proveri", one button), what may be old is read again
  // ("Osveži"). A screen reader still hears what is read.
  const check = (label: string, primary = false, spoken?: string) => <V2Action label={label} accessibilityLabel={spoken} style={primary ? brandAction : undefined}
    disabled={editor.busy || editor.loading} loading={editor.loading} onPress={refresh} />;
  // The one foot. A review that is read has its reason ABOVE the green button; a stored command has none, because the note at the top says
  // what is known. The one quiet action under the green one is "Sačuvaj nacrt" (or the check, when an outcome is not known).
  const footer = !review ? null : <FlowFooter reason={command ? undefined : caption}>
    {/* A draft opened from "Nacrti" is deleted by the lifecycle's own command, as on the draft's screen: its question, its sending and
        its outcome are drawn here, where the person is looking, and everything else on the screen waits while it is on. */}
    {draftNeed && !command ? <NeedLifecycleActions need={draftNeed} needId={draftNeed.id} menu={lifecycleMenu}
      disabled={screenBusy || !!edit || !!locationEditor || deadlineEditor} onActiveChange={setLifecycleActive} onRefresh={refresh} /> : null}
    {editor.error && !resultCopy ? <T accessibilityRole="alert" style={s.error}>{editor.error}</T> : null}
    {/* After the tap there is one way forward at a time — open the published task, publish the saved draft, or go and change it — and that
        one wears the brand green; what checks the outcome, or leaves for the tasks, stands under it in white. */}
    {published && command ? <V2Action label="Otvori zadatak" style={brandAction} onPress={openPublished} />
      : command ? <>
        {/* Only one of the two green actions is ever drawn, and the editor's write in flight is that one's own. */}
        {resumeShown ? <V2Action label={command.state === 'ACCEPTED' ? 'Objavi ovaj nacrt' : 'Nastavi objavu'} style={brandAction} disabled={disabled}
          loading={editor.busy} onPress={resume} /> : null}
        {editShown ? <V2Action label="Izmeni zadatak" style={brandAction} disabled={disabled} loading={editor.busy} onPress={revisePublishedDraft} /> : null}
        {command.state === 'ACCEPTED' ? <V2Action label="Otvori moje zadatke" kind="quiet" disabled={disabled}
          onPress={() => { if (canAct()) navigate(() => router.replace('/potrebe')); }} /> : check(OUTCOME_ACTION.check, !resumeShown && !editShown, CHECK_SPOKEN)}
      </> : <>
        <PublishButton label={acceptLabel} blocked={publishBlocked} working={publishWorking} reason={caption} onPress={publish} />
        {/* While a write has no outcome yet, or has been refused, the one thing to do is to read what is true now. */}
        {editor.uncertain ? check(OUTCOME_ACTION.check, false, CHECK_SPOKEN) : editor.error ? check(OUTCOME_ACTION.refresh, false, 'Osveži pregled')
          : !bound && review.canAccept && !unavailableIdentityFact
            ? <V2Action label="Sačuvaj nacrt" kind="quiet" disabled={quietEdit} onPress={() => { void accept(false); }} /> : null}
      </>}
  </FlowFooter>;

  return <>
    <ReviewFrame scrollRef={scroll} contentRef={content} footer={footer}
      header={<DetailTopBar backLabel="Nazad u razgovor" onBack={back} title={published ? 'Objavljeno' : revising ? 'Pregled izmena' : 'Pregled zadatka'} />}>
        {!review || !summary ? editor.loading
          ? <StateView kind="loading" title="Pripremamo pregled…" skeleton={{ count: 1, rows: 3, variant: 'preview' }} />
          : <StateView kind="error" art="document" title={cannotLoad('pregled').title} body={editor.error ?? cannotLoad('pregled').copy}
            primary={{ label: OUTCOME_ACTION.retry, onPress: refresh, disabled: editor.busy || editor.loading }} />
        : <>
          {resultCopy ? <ReviewStatus published={!!published} fresh={!!published && publishedHere.current} text={resultCopy}
            action={command?.state === 'ACCEPTED' ? <V2Action label={OUTCOME_ACTION.refresh} accessibilityLabel="Osveži pregled" kind="quiet" style={frame.noteAction}
              disabled={editor.busy || editor.loading} loading={editor.loading} onPress={refresh} /> : undefined} /> : null}
          {SUPPORT_HAS_DUTY_OPERATOR && command?.state === 'EVALUATED' && outcome === 'REVIEW' ? <SupportContextEntry
            reference={{ kind: 'TASK_REVIEW', id: review.reviewId, revision: null }} label="Obrati se podršci"
            disabled={disabled} canAct={canAct} navigate={navigate} /> : null}
          {command ? identityBlock : null}
          <ReviewPreview summary={summary}
            unpriced={review.publicProjection.some(fact => fact.key === 'need.price_mode' && fact.status !== 'UNKNOWN')} />
          {todoRows.length || (!command && unavailableIdentityFact) ? <ReviewTodoList items={todoRows} disabled={disabled || !!edit || deadlineEditor}>
            {identityBlock}
          </ReviewTodoList> : null}
          <ReviewSection title="Mesto" spaced action={!command && !placeBusy
            ? { label: opening ? 'Otvaramo mapu…' : review.location ? 'Uredi mesto' : 'Dodaj mesto', onPress: openLocation } : undefined}>
            {openError ? <Surface kind="note" tone="danger"><T accessibilityRole="alert" style={s.error}>{openError}</T></Surface> : null}
            {snapshot?.locationConflict ? <Surface kind="note" tone="warn"><T accessibilityRole="alert" style={s.warnText}>
              Mesto je promenjeno posle prethodnog pregleda. Prikazano je trenutno mesto; pregledaj ga ili izmeni pre objave.
            </T></Surface> : null}
            <PublicPlace zone={summary.zone || null} lines={publicLines} anchor={publicAnchorPoint(review.location)}
              pointsConfirmed={!!review.location?.resolvedLocation?.points.length}
              scopeKey={`${accountId}:${review.reviewId}:preview`} />
            {review.ownerPrivateProjection.length || privateMap.points.length ? <PrivatePlace>
              <OwnerPlaces places={confirmedPlaces} />
              {privateMap.points.length ? <LocationMapPreview points={privateMap.points} route={privateMap.route}
                scopeKey={`${accountId}:${accountRevision}:${review.reviewId}:private-place`} height={200} /> : null}
              {rows(review.ownerPrivateProjection)}
            </PrivatePlace> : null}
          </ReviewSection>
          {publicRows.length ? <ReviewSection title="Detalji">
            <View>{rows(publicRows)}</View>
          </ReviewSection> : null}
          <ReviewSection title="Fotografije" action={!command && !quietEdit ? { label: hasPhotos ? 'Uredi fotografije' : 'Dodaj fotografije',
            onPress: () => { if (!canAct() || !conversationId || edit || locationEditor || deadlineEditor) return;
              navigate(() => router.push({ pathname: '/fotografije-zadatka', params: { conversationId } })); } } : undefined}>
            <ReviewPhotos assetIds={photoAssets} />
          </ReviewSection>
          <ReviewSection title="Prijave" action={!command && !quietEdit
            ? { label: 'Uredi rok za prijave', onPress: () => { if (canAct()) setDeadlineEditor(true); } } : undefined}>
            {deadlineEditor ? <ResponseDeadlineEditor value={review.responseDeadline} timezone={deadlineTimezone} disabled={disabled}
              apply={value => { void proposeDeadline(value); }} cancel={() => { if (canAct()) setDeadlineEditor(false); }} />
              : <ReviewDeadline text={review.responseDeadline ? dogovorenoVreme(review.responseDeadline) : null} />}
          </ReviewSection>
          {/* The ways out, at the end of everything there is to change and in plain sight (owner, 2026-10-07): "Izmeni zadatak" returns to the
              conversation, which keeps the draft; and, last and in the danger colour, "Obriši nacrt" (a new task, or a private draft opened
              from "Nacrti"; the changes of a published task have no draft to delete). */}
          {!command ? <ReviewWaysOut disabled={quietEdit} onEdit={editInConversation}
            onDelete={!bound ? discardDraft : draftNeed ? deleteBoundDraft : undefined} /> : null}
        </>}
    </ReviewFrame>
    {confirmation.sheet}
  </>;
}

/** Facts whose editor is the place step. */
const PLACE_KEYS: readonly NeedFactV2Key[] = ['need.task_country_code', 'need.task_geography', 'need.exact_address', 'need.access_notes', 'need.resolved_location'];
/** Public facts drawn elsewhere on the review (the value in the preview, the place in Mesto, the photos in Fotografije) or never shown (the
 *  category). The title is a row of "Detalji" like every other fact; its editor is that row's. */
const PUBLIC_ELSEWHERE: readonly NeedFactV2Key[] = ['need.category', 'need.public_photo_paths', 'need.task_geography', 'need.task_country_code'];

/** The place step replaces the review with a whole step of its own (the form holds its scroll and its foot), so it has its own frame. */
const frame = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: sys.color.ground },
  fill: { flex: 1 },
  alert: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm },
  alertBody: { gap: sys.space.sm },
  // Inside the status note the quiet action starts at the note's own edge (no padding of its own); the width keeps the 48 dp target and the label stays at the start of it.
  noteAction: { alignSelf: 'flex-start', paddingHorizontal: 0, minWidth: layout.touch, justifyContent: 'flex-start' },
});
