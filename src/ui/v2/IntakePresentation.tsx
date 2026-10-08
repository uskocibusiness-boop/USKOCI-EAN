import { lazy, Suspense, useCallback, useRef, useState, type ReactNode } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appear, useAppear, type AppearList } from '../system/Appear';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { FactRow } from '../system/FactRow';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { osoba } from '../system/plural';
import { Surface } from '../system/Surface';
import { AuthorizedPhoto } from '../media/AuthorizedPhoto';
import { mediaAssetId } from '../../data/mediaAssetId';
import type { AiNeedV2Conversation, AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { safetyMessage } from '../../data/aiNeedV2Ui';
import { factDisplayLabel } from '../../contracts/needFactsV2';
import { Press } from '../Press';
import { brandAction, sys } from '../system/tokens';
import { useReducedMotion } from '../system/motion';
import { ActionSheet, type SheetAction } from '../system/ActionSheet';
import { OUTCOME_ACTION } from '../system/outcomeCopy';
import { ScreenChrome } from '../system/ScreenChrome';
import { StateView } from '../system/StateView';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { CardTitle, valueSpoken } from './TaskFace';
import { normalizeNeedLocation, pointsMissing } from '../../lib/location';
import { AiConversationShell } from '../aiFirst/AiConversationShell';
import type { VoiceInput } from '../aiFirst/VoiceComposer';
import type { LocationReplyPrompt } from '../location/ConversationPointAsk';
import { ConfirmedPlaceLine } from '../location/ConfirmedPlaceLine';
import { confirmedPlaceEntries } from '../location/placeText';
import type { ConfirmedLocationPoint, LocationSlot } from '../../contracts/location';
import { completeDraftProposal, publicSummary, type Summary } from './draftSummary';
import { intakeLocationMemory, orderIntakeLocation, type IntakeTurnRole } from './intakeLocationOrder';
import type { PhotoSource } from '../../features/media/nativePhotoPicker';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { PhotoAttachSheet } from '../media/PhotoAttachSheet';
import { TaskPhotoLine } from '../media/TaskPhotoLine';
import type { TaskPhotoItem, TaskPhotosController } from '../media/useTaskPhotoUploads';
import { PHOTO_WORDS, TASK_PHOTO_NOTICE, photoLimits } from '../media/photoWords';

// The point sheet reaches the native map through the point editor, so it loads only when opened.
const ConversationPointAsk = lazy(() => import('../location/ConversationPointAsk'));

/**
 * Where the confirmed-place line sits in the thread: after the message that was last when this place was first seen
 * confirmed, so later messages scroll it up (owner, 2026-10-07). Kept per conversation for the life of the app, so a return
 * to the conversation keeps that order; only fingerprints and message ids are held, never an address or a coordinate.
 * A place first seen already confirmed (a cold start) sits after the last message loaded.
 */
type PlaceAnchor = Readonly<{ identity: string; after: string | null; points: Readonly<Record<string, string>>; acknowledged: readonly LocationSlot[] }>;
const placeAnchors = new Map<string, PlaceAnchor>();
let anchorGeneration: number | null = null;
const fingerprint = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(36);
};
const pointFingerprint = (point: ConfirmedLocationPoint) => fingerprint(JSON.stringify([point.latitudeE6, point.longitudeE6,
  point.address ?? null, point.origin.kind]));
/** `live`: this visit had the place's editor open, so a newly confirmed point was confirmed just now. */
function anchorPlace(conversationId: string, placeKey: string, points: readonly ConfirmedLocationPoint[], after: string | null, live: boolean, ordered = false): PlaceAnchor {
  const identity = fingerprint(placeKey), previous = placeAnchors.get(conversationId);
  if (previous?.identity === identity) {
    if (!ordered || previous.after === after) return previous;
    const next = { ...previous, after }; placeAnchors.set(conversationId, next); return next;
  }
  const ids = Object.fromEntries(points.map(point => [point.slot, pointFingerprint(point)]));
  // A pin the person placed or moved by hand and confirmed in this visit is acknowledged as the new place.
  const acknowledged = live ? points.filter(point => point.origin.kind === 'MANUAL_PIN' && previous?.points[point.slot] !== ids[point.slot])
    .map(point => point.slot) : [];
  const next: PlaceAnchor = { identity, after, points: ids, acknowledged };
  placeAnchors.delete(conversationId); placeAnchors.set(conversationId, next);
  if (placeAnchors.size > 50) { const oldest = placeAnchors.keys().next().value; if (oldest !== undefined) placeAnchors.delete(oldest); }
  return next;
}

/**
 * Where the photos of one moment sit in the thread: after the message that was last when each was first seen (owner,
 * 2026-10-07: nothing stays docked at the bottom), the same rule as the confirmed place. Kept per conversation for the life
 * of the app; only request identities and message ids are held, never a picture. A photo added before the first word sits
 * right after that first message, where the conversation it belongs to begins.
 */
const photoAnchors = new Map<string, Map<string, string | null>>();
function anchorPhotos(conversationId: string, items: readonly TaskPhotoItem[], last: string | null): Map<string, string | null> {
  let anchors = photoAnchors.get(conversationId);
  if (!anchors) {
    anchors = new Map(); photoAnchors.set(conversationId, anchors);
    if (photoAnchors.size > 50) { const oldest = photoAnchors.keys().next().value; if (oldest !== undefined) photoAnchors.delete(oldest); }
  }
  for (const item of items) if (!anchors.has(item.requestId)) anchors.set(item.requestId, last);
  return anchors;
}
/** Consecutive photos with one anchor are one line; the line of the newest moment also says what is happening now. */
type PhotoGroup = { key: string; after: string | null; items: TaskPhotoItem[] };
function groupPhotos(items: readonly TaskPhotoItem[], anchors: Map<string, string | null>, first: string | null): PhotoGroup[] {
  const groups: PhotoGroup[] = [];
  for (const item of items) {
    const anchor = anchors.get(item.requestId) ?? null, after = anchor ?? first;
    const previous = groups.at(-1);
    if (previous && previous.after === after) previous.items.push(item);
    else groups.push({ key: `photos:${anchor ?? 'start'}:${groups.length}`, after, items: [item] });
  }
  return groups;
}

type Props = {
  /** Stable through first-send server ID assignment; replaced only when the owned route changes. */
  conversationKey?: string;
  conversationOwnerKey?: string;
  turnRoles?: Readonly<Record<string, IntakeTurnRole>>;
  conversation: AiNeedV2Conversation; value: string; busy: boolean; error: string | null;
  canSubmit: boolean; canEdit: boolean; canReview: boolean; reviewLabel: string;
  /** Separate route authority from the temporary speech/semantic interaction lock. */
  locationDisabled?: boolean;
  locationDialogueEnabled?: boolean;
  retainedLocationSpeech?: { text: string; canRestore: boolean; onRestore: () => void };
  onLocationPromptReady?: (prompt: LocationReplyPrompt | null) => void;
  pending: boolean; statusCopy: string | null; showReadback: boolean; readbackDisabled: boolean;
  /** The sentence that was sent and is waiting for its answer. */
  sentMessage?: string | null;
  showAbandon: boolean; abandonDisabled: boolean; abandonLabel: string;
  onBack: () => void; onChange: (value: string) => void; onSend: () => void;
  onReview: () => void; onRefresh: () => void; onAbandon: () => void;
  onNewTask?: () => void; newTaskDisabled?: boolean; voice?: VoiceInput; streamingText?: string;
  onPhotos?: () => void; photosDisabled?: boolean;
  /** The draft's photos. With them the "+" opens the shared attach sheet inside the conversation (Galerija, Kamera), and
   *  added photos are lines of the thread, where they were added; `onPhotos` stays the route for the design gallery only. */
  photos?: TaskPhotosController;
  /** The source the person chose; the screen opens the conversation first when there is none yet. */
  onPhotoSource?: (source: PhotoSource) => void;
  onCancelPending?: () => void; cancelPendingDisabled?: boolean; cancelPendingDispatched?: boolean;
};

// The live card's public summary is the shared pure one (src/ui/v2/draftSummary.ts), also used by the publish review.
export type { Summary } from './draftSummary';

export function IntakeUnavailable({ loading, error, retry, back, recover }: {
  loading: boolean; error: string; retry?: () => void; back: () => void; recover?: () => void;
}) {
  const primary = recover ? { label: 'Otvori prethodni razgovor', onPress: recover } : retry ? { label: 'Pokušaj ponovo', onPress: retry } : undefined;
  return <SafeAreaView edges={['top', 'bottom']} style={s.canvas}>
    <ScreenChrome variant="detail" tone="conversation" onBack={back} />
    <View style={s.unavailable}>
      {loading ? <StateView kind="loading" title="Otvaramo razgovor" skeleton={{ variant: 'thread', count: 3 }} />
        : <StateView kind="error" art="chat" title="Razgovor nije dostupan" body={error} primary={primary} />}
    </View>
  </SafeAreaView>;
}

/**
 * Three ways in (R18), as whole sentences a person might say, not names of categories. Each carries what, when, where, how many or
 * how to pay in a different mix, so the first message already has something in it. One tap puts the sentence in the field; nothing is
 * sent, and no assistant call is made until the person sends it.
 */
export const TASK_OPENINGS = ['Treba mi pomoć oko selidbe u subotu, 2 osobe, Novi Sad.', 'Treba mi neko da sastavi ormar u petak popodne.',
  'Treba mi neko da okreči sobu, tražim ponude.'] as const;

/**
 * "Sličice slete u nacrt" (owner's pick of 2026-10-08, A): a fact the assistant has understood is a small picture (a pin, a calendar,
 * people, a price tag) that LANDS in the draft, arriving from above, 8 dp over its place, as what somebody else brings does (`Appear
 * from="above"`, rule B1), WITH its words beside it (the owner, 8 Oct 2026: four pictures with no text said nothing). A fact it has not
 * understood is not drawn at all: unknown stays quiet, and nothing is invented. Only the picture's container moves, once, for a fact that
 * arrives while the person is looking; a draft that was already there when the screen opened is simply there, and so is every fact under
 * reduced motion. The words of a fact are never animated.
 */
export type DraftSticker = 'zone' | 'schedule' | 'people' | 'value';
const STICKER_ORDER: readonly DraftSticker[] = ['value', 'zone', 'schedule', 'people'];
/** How many people the draft needs, as a number: how many is a fact only when it is more than one ("Treba 3 osobe"; one person says nothing). */
const peopleMany = (summary: Summary): number | null => {
  const count = summary.peopleCount ?? (summary.people ? Number(/^\d+/.exec(summary.people)?.[0]) : NaN);
  return Number.isFinite(count) && count > 1 ? count : null;
};
/** The stickers the draft has a fact for, in the one order they stand (what it pays, where, when, who). */
export function draftStickers(summary: Summary): DraftSticker[] {
  return STICKER_ORDER.filter(kind => kind === 'zone' ? !!summary.zone : kind === 'schedule' ? !!summary.schedule : kind === 'people' ? peopleMany(summary) !== null : !!summary.value);
}
const stickerArt = (kind: DraftSticker, summary: Summary): FactArtKind => kind === 'zone' ? summary.zone === 'Na daljinu' ? 'remote' : 'pin'
  : kind === 'schedule' ? 'calendar' : kind === 'people' ? 'users' : summary.value?.kind === 'amount' ? 'money' : 'offers';
/** The words of each sticker: the sum with what it buys, or the price tag's words; the place and the time as the draft has them; how many people. */
const stickerWords = (kind: DraftSticker, summary: Summary): string => kind === 'zone' ? summary.zone : kind === 'schedule' ? summary.schedule ?? ''
  : kind === 'people' ? `Treba ${osoba(peopleMany(summary) ?? 0)}` : summary.value ? valueSpoken(summary.value) : '';

/**
 * The living draft, a panel above the thread: the name of the task and, under it, what the assistant has understood, each fact as its picture with
 * its words (where it can, in one wrapping line; as rows once the draft is ready). It names no state: no "Nacrt" and no "Izmena" stands over the
 * name (the owner, 8 Oct 2026: an eyebrow that only said where the person is), the chrome's title already says it. What is still needed is one
 * quiet line, the way to the review is a quiet word at the end while something is missing, and, once nothing is, the one green action of the
 * screen with the review's own name ("Pregledaj zadatak", "Pregledaj izmene"). `appear` is the conversation's memory of which pictures have
 * already landed (the presentation keeps it, so moving the card from the top to the end of the thread never lands them again); without it
 * nothing moves.
 */
export function DraftCard({ summary, stillNeeded, open, busy, compact, canReview, onReview, note, reviewLabel = 'Pregledaj zadatak',
  editing = false, hiddenMissing = false, reviewAtEnd = false, locationEditing = false, ended = false, appear }: {
  summary: Summary; stillNeeded: string | null; open: boolean; busy: boolean; compact: boolean; canReview: boolean;
  onReview: () => void; note: string | null;
  /** The review's own name, the one the "···" menu uses ("Pregledaj izmene" while a published task is being changed). */
  reviewLabel?: string;
  /** The conversation changes a task that already exists: the card says it to a screen reader, never over the name. */
  editing?: boolean;
  /** Something the server still needs is one people never see (the category): the card claims nothing is missing. */
  hiddenMissing?: boolean;
  /** A complete draft becomes the final summary in the thread, with the one green action inside this one card. */
  reviewAtEnd?: boolean;
  /** Give an active location question room: the card shows only its name. */
  locationEditing?: boolean;
  /** The conversation is over: the card is the final summary and has no review of its own (the screen's one green action stands where the composer was). */
  ended?: boolean;
  /** Which pictures have already landed; a picture that is new to it lands, once. Left out, nothing moves. */
  appear?: AppearList;
}) {
  const next = !open ? null : stillNeeded ? `Još treba: ${stillNeeded}` : null;
  const ready = open && !stillNeeded && !hiddenMissing;
  // A complete authoritative draft is no longer presented as if it were still being collected: it keeps the same TaskFace language, shows its facts as
  // rows and carries the one guarded review action. This is not the published TaskCard/Peek and carries no publication state.
  const readyForReview = ready && reviewAtEnd;
  // The facts are rows when the draft is final (ready, or the conversation is over) and a line of pictures with their words while it is being made.
  const final = readyForReview || ended;
  const stickers = draftStickers(summary);
  // A question about the place has the room while it is asked: the card shows only its name then. Every fact is read once: by its own row when they are rows,
  // and in the one sentence with the name when they are a line of pictures (that line is decoration for a screen reader).
  const facts = stickers.length > 0 && !locationEditing;
  const spoken = [editing ? 'Izmena zadatka' : null, summary.title ?? 'Zadatak u nastajanju', ...(facts && !final ? stickers.map(kind => stickerWords(kind, summary)) : [])].filter(Boolean).join(', ');
  // The pictures the draft has facts for, and where each lands: a picture that is new to the conversation's memory arrives once, in its place.
  const lands = (kind: DraftSticker, index: number, child: ReactNode) => <Appear key={kind} index={index} animate={!!appear && appear.isNew(kind)} from="above">{child}</Appear>;
  return <Surface kind="panel" testID="intake-task-summary" style={[s.card, compact && s.cardCompact]}>
    <View testID="intake-draft-head" accessible accessibilityLabel={spoken}>
      <CardTitle title={summary.title ?? 'Zadatak u nastajanju'} lines={final ? 0 : compact || locationEditing ? 1 : 2}
        style={[s.compactTitle, !summary.title && s.titleEmpty]} />
    </View>
    {facts ? final
      ? <View testID="intake-draft-details" style={s.details}>
        {stickers.map((kind, index) => lands(kind, index, <FactRow art={stickerArt(kind, summary)} value={stickerWords(kind, summary)} />))}
      </View>
      : <View testID="intake-draft-stickers" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.stickers}>
        {stickers.map((kind, index) => lands(kind, index, <View style={s.sticker}>
          <FactArt kind={stickerArt(kind, summary)} size={28} /><T variant="note" style={s.stickerWords}>{stickerWords(kind, summary)}</T>
        </View>))}
      </View> : null}
    {note ? <T variant="note" tone="muted">{note}</T> : null}
    {!locationEditing && next ? <T variant="note" tone="muted">{next}</T> : null}
    {readyForReview ? <V2Action label={reviewLabel} style={brandAction} disabled={!canReview} onPress={() => { if (canReview) onReview(); }} />
      : !locationEditing && !ended ? <Press testID="intake-draft-review" accessibilityRole="button" accessibilityLabel={reviewLabel}
        accessibilityHint={editing ? 'Otvara pregled izmena.' : 'Otvara pregled svih podataka pre objave.'}
        accessibilityState={{ disabled: !canReview }} disabled={!canReview}
        onPress={() => { if (canReview) onReview(); }} haptic={canReview ? 'select' : 'none'} style={s.reviewAction}>
        <T variant="note" style={[s.readyText, !canReview && s.muted]}>{reviewLabel}</T>
        <Glyph name="caret-right" tone={canReview ? 'ink' : 'muted'} />
      </Press> : null}
  </Surface>;
}

/**
 * What the assistant's fixed closing sentences say about a task that is being CHANGED (not published): "Otvori pregled zadatka. Tamo možeš da dopuniš podatke i
 * potvrdiš objavu." is the server's own line for the end of any conversation (`supabase/functions/uskoci-ai-interview/index.ts`), and a change is not an
 * objava. Only these exact sentences are said otherwise; whatever the assistant wrote in its own words is shown as it came.
 * TRAŽI SERVER (not changed here): the edit conversation's REVIEW step should answer "Otvori pregled izmena. Tamo ih potvrđuješ." itself.
 */
const SERVER_REVIEW_ENDINGS: ReadonlySet<string> = new Set(['Otvori pregled zadatka. Tamo možeš da dopuniš podatke i potvrdiš objavu.',
  'Otvori pregled zadatka. Tamo proveri podatke pre objave.']);
export const EDIT_ENDING = 'Otvori pregled izmena. Tamo ih potvrđuješ.';
export const editEnding = (body: string): string => SERVER_REVIEW_ENDINGS.has(body.trim()) ? EDIT_ENDING : body;

/**
 * Presentation only. The owned editor retains command, focus and receipt authority.
 */
export function IntakePresentation(props: Props) {
  const { conversation, busy, value, pending } = props;
  const [panel, setPanel] = useState<'options' | 'photos' | null>(null);
  // Asked inline, so the map sits beside the words. Dismissing it leaves a way back.
  const [hiddenPlace, setHiddenPlace] = useState<string | null>(null);
  // A confirmed place reopens its editor only on an explicit tap of its line; this is the place that tap was for.
  const [savedPlaceEdit, setSavedPlaceEdit] = useState<string | null>(null);
  const askSeen = useRef(false);
  const [editingPlace, setEditingPlace] = useState(false);
  const editingPlaceNow = useRef(false);
  const closePlace = useRef<(() => void) | null>(null);
  const registerPlaceClose = useCallback((close: (() => void) | null) => { closePlace.current = close; }, []);
  const promptChanged = useRef(props.onLocationPromptReady); promptChanged.current = props.onLocationPromptReady;
  const [promptToken, setPromptToken] = useState<string | null>(null);
  const registerPlacePrompt = useCallback((prompt: LocationReplyPrompt | null) => {
    promptChanged.current?.(prompt);
    setPromptToken(previous => previous === (prompt?.context.promptToken ?? null) ? previous : prompt?.context.promptToken ?? null);
  }, []);
  const reportEditingPlace = useCallback((editing: boolean) => {
    editingPlaceNow.current = editing; setEditingPlace(editing);
  }, []);
  const outsidePlace = (action: () => void) => () => { if (!editingPlaceNow.current) action(); };
  const reduced = useReducedMotion();
  const photoConfirm = useConfirmSheet({ reduced });
  const summary = publicSummary(conversation.facts);
  // Which pictures of the draft have landed (A, "Sličice slete u nacrt"). A conversation that began empty in this visit is news from its first fact, so
  // the first pictures land; one that was opened with something in it is what was already there, and its pictures are simply in place. The memory
  // lives here, not in the card: the card moves from the top of the screen to the end of the thread when the draft is ready, and must not land them again.
  const landed = useAppear();
  const beganEmpty = useRef(!conversation.facts.length && !conversation.messages.length);
  landed.settle(draftStickers(summary), undefined, { afterLoading: beganEmpty.current });
  const safetyCopy = safetyMessage(conversation.safety);
  const open = conversation.status === 'OPEN';
  // A conversation that is over takes no more words: the field and the microphone are gone (the owner's phone, 8 Oct 2026: "Razgovor je završen" over a field
  // that still said "Opiši šta ti treba"), and where they stood is the one green action, the review, with its own name. It needs no sentence of its own.
  const ended = conversation.status === 'COMPLETED' || conversation.status === 'ABANDONED';
  const completed = conversation.status === 'COMPLETED';
  const hasConversation = !!conversation.conversationId;
  // The map point is the one thing publishing cannot do without and the AI may not propose, so
  // the conversation asks for it rather than leaving it to be discovered. Read from the facts
  // the conversation already holds, including the owner-private one; no extra server call.
  const held = (key: AiNeedV2Fact['key']) => conversation.facts.find(fact => fact.key === key)?.value;
  const photoPaths = held('need.public_photo_paths');
  const photoAssets = [...new Set((Array.isArray(photoPaths) ? photoPaths : [])
    .map(path => typeof path === 'string' ? mediaAssetId(path) : null).filter((id): id is string => !!id))];
  // A saved point belongs to this geography, country and address, not merely a slot
  // with the same name. A new city must not inherit the previous city's confirmation.
  const placeFacts = { taskCountryCode: held('need.task_country_code') ?? null,
    geography: held('need.task_geography') ?? null, exactAddress: held('need.exact_address') ?? null,
    accessNotes: held('need.access_notes') ?? null, resolvedLocation: held('need.resolved_location') ?? null };
  const place = normalizeNeedLocation(placeFacts);
  const requestedPlace = normalizeNeedLocation({ ...placeFacts, resolvedLocation: null });
  const placeKey = `${conversation.conversationId}:${JSON.stringify(placeFacts)}`;
  const pointAskHidden = hiddenPlace === placeKey;
  const gap = pointsMissing(placeFacts.geography, place?.resolvedLocation);
  const needsPoint = open && gap.total > 0 && gap.done < gap.total;
  const showPlace = open && hasConversation && conversation.safety !== 'BLOCK' && gap.total > 0;
  const placeDisabled = props.locationDisabled ?? (busy || pending || !props.canEdit || !!props.error);
  const placeLocked = useRef(placeDisabled); placeLocked.current = placeDisabled;
  // Owner, phone test 2026-10-07: once the place is confirmed the conversation simply continues. The confirmation becomes
  // one line of the thread (`threadNotes` below) instead of a block docked above the composer; its editor is mounted only
  // while the place is still missing, or after an explicit tap on that line.
  const confirmedPoints = place?.resolvedLocation?.points ?? [];
  const placeComplete = showPlace && !needsPoint && confirmedPoints.length > 0;
  const editingSavedPlace = placeComplete && savedPlaceEdit === placeKey;
  const askOpen = showPlace && (placeComplete ? editingSavedPlace : !pointAskHidden);
  if (askOpen) askSeen.current = true;
  // Arrival animation keeps the route's stable key; retained history uses the durable ID after the first send.
  const orderScope = conversation.conversationId || props.conversationKey || '';
  const orderMemory = intakeLocationMemory(props.conversationOwnerKey ?? orderScope);
  if (anchorGeneration !== orderMemory.generation) {
    placeAnchors.clear(); photoAnchors.clear(); anchorGeneration = orderMemory.generation;
  }
  const geographyId = conversation.facts.find(fact => fact.key === 'need.task_geography')?.id;
  const ordered = orderIntakeLocation(orderMemory.read(orderScope), {
    scope: orderScope, messages: conversation.messages, roles: props.turnRoles ?? {},
    causalMessageId: geographyId ? [...conversation.messages].reverse().find(message => message.fromAi && message.proposedFactIds.includes(geographyId))?.id : undefined,
    pendingLocation: needsPoint && !!requestedPlace,
    confirmedLocation: !!place && gap.done === gap.total,
    canRelease: !busy && !pending && !props.error,
    preserveHistory: !open || conversation.safety === 'BLOCK', confirmationKey: fingerprint(placeKey),
  });
  orderMemory.write(orderScope, ordered.state);
  const anchor = placeComplete && ordered.state.active === null ? anchorPlace(conversation.conversationId, placeKey, confirmedPoints,
    ordered.placement ? ordered.placement.after : conversation.messages.at(-1)?.id ?? null, askSeen.current, !!ordered.placement) : null;
  const contextualReply = !!props.locationDialogueEnabled && askOpen && !!promptToken && !placeDisabled;
  const send = () => { if (!editingPlaceNow.current || contextualReply) props.onSend(); };
  const reviewAllowed = props.canReview && !editingPlace;
  // What is still missing, counted where the person is, including the map point (the server's required list cannot
  // contain it, because the AI is not allowed to propose it). A required fact the AI has already proposed is not listed:
  // confirming what it proposed is the review screen's job, and the card's heading already shows it.
  const proposed = new Set(conversation.facts.filter(fact => fact.status !== 'UNKNOWN').map(fact => fact.key));
  const missing = conversation.review.missingRequired.filter(key => !proposed.has(key));
  // People never see a category (owner, PKG-031; the review screen leaves it out too): the AI writes it for matching only,
  // so it is never named as "still needed" (review r4 ra item 4). While it is missing the card claims nothing is.
  const hiddenMissing = missing.includes('need.category');
  const stillNeeded = [...missing.filter(key => key !== 'need.category').map(factDisplayLabel),
    ...(needsPoint ? ['tačka na mapi'] : [])];
  // At the start nothing is filled, so the full list is eight items long; the card names the first few and counts the rest.
  const stillNeededText = !stillNeeded.length ? null : stillNeeded.length <= 3 ? stillNeeded.join(' · ')
    : `${stillNeeded.slice(0, 3).join(' · ')} · i još ${stillNeeded.length - 3}`;
  const completeProposal = completeDraftProposal(conversation.facts) && !!place && gap.done === gap.total;
  const readyForReview = completeProposal && open && reviewAllowed && conversation.safety !== 'BLOCK'
    && !stillNeededText && !hiddenMissing && !needsPoint && !busy && !pending && !props.error;
  const showSummary = readyForReview || (completed && completeProposal && conversation.safety !== 'BLOCK' && !busy && !pending && !props.error);
  // Current facts belong in the live card and the explicit full review. Decorating
  // old replies with today's fact values repeated the summary and rewrote history.
  // The assistant's own end of a conversation about a task that already exists says "objava", which an edit is not (the owner's phone, 8 Oct 2026).
  // The words are the server's fixed ones (`uskoci-ai-interview`, the answer of its REVIEW step), and they are said as what they mean here; the stored message is not touched.
  const messages = conversation.review.boundNeedId ? ordered.messages.map(message => message.fromAi ? { ...message, body: editEnding(message.body) } : message) : ordered.messages;
  // The "···" of this conversation. Each row runs once the menu has gone, so a navigation or the next sheet never starts
  // underneath it. Photos are the composer's "+", not a row here. Before the first word there is no conversation to act
  // on, so there is no menu either.
  const menu: SheetAction[] = [];
  if (props.canReview) menu.push({ key: 'review', label: props.reviewLabel, icon: 'document', disabled: !reviewAllowed, onPress: outsidePlace(props.onReview) });
  // A missing point put away with "Kasnije" comes back from here. Hiding affects only its current location identity, never
  // the next place; a confirmed place is its own line in the thread and needs no menu row.
  if (showPlace && !placeComplete && pointAskHidden) menu.push({ key: 'place', label: 'Mesto na mapi', icon: 'pin', onPress: () => setHiddenPlace(null) });
  if (hasConversation) menu.push({ key: 'refresh', label: 'Osveži razgovor', icon: 'check', disabled: props.readbackDisabled || editingPlace, onPress: outsidePlace(props.onRefresh) });
  if (props.onNewTask) menu.push({ key: 'new', label: 'Novi zadatak', icon: 'tasks', disabled: props.newTaskDisabled, onPress: props.onNewTask });
  if (props.showAbandon) menu.push({ key: 'abandon', label: props.abandonLabel, icon: 'chat', destructive: true,
    disabled: props.abandonDisabled, subtitle: 'Povratak čuva razgovor. Napušten razgovor više ne možeš da nastaviš.', onPress: props.onAbandon });
  const note = safetyCopy && conversation.safety !== 'BLOCK' ? safetyCopy : null;
  // The one way on from a conversation that is over, and it is on the screen (rule J15: a "···" is never the only road): the review while there is one
  // (green), otherwise a new task (quiet). The same "Novi zadatak" stays in the menu for the rare case.
  const footerAction = completed && props.canReview
    ? <V2Action label={props.reviewLabel} style={brandAction} disabled={!reviewAllowed} onPress={outsidePlace(props.onReview)} />
    : ended && props.onNewTask
      ? <V2Action label="Novi zadatak" kind="secondary" tone="neutral" disabled={props.newTaskDisabled} onPress={props.onNewTask} /> : undefined;
  // "Razgovor je završen. Sačuvani zadatak možeš otvoriti iz pregleda." said what the green action beside it now says by being there.
  const statusCopy = completed && props.canReview ? null : props.statusCopy;
  // One line, built locally from the confirmed point (no AI call): street and number, the place, and the way back to the map.
  const placeLine = placeComplete && anchor && place ? <ConfirmedPlaceLine testID="intake-place-line"
    entries={confirmedPlaceEntries(confirmedPoints, { geography: place.geography, exactAddress: place.exactAddress }, new Set(anchor.acknowledged))}
    onEdit={!placeDisabled && !editingSavedPlace && !editingPlace ? () => {
      if (editingPlaceNow.current || placeLocked.current) return;
      Keyboard.dismiss(); setSavedPlaceEdit(placeKey);
    } : undefined} /> : null;
  // The photos: the controller's own list when it has one, otherwise what the conversation's facts already hold (read only).
  const attach = props.photos && props.onPhotoSource ? props.photos : null;
  const photoItems: TaskPhotoItem[] = attach && (attach.items.length || attach.loaded) ? [...attach.items]
    : photoAssets.map((assetId): TaskPhotoItem => ({ key: assetId, requestId: assetId, assetId, state: { kind: 'READY', assetId }, exit: null, retry: null }));
  const photosOff = !!props.photosDisabled || editingPlace;
  const notes: { key: string; afterMessageId: string | null; node: ReactNode }[] = [];
  if (placeLine && anchor) notes.push({ key: 'place', afterMessageId: anchor.after, node: placeLine });
  if (attach) {
    const last = messages.at(-1)?.id ?? null, first = messages[0]?.id ?? null;
    const groups = groupPhotos(photoItems, anchorPhotos(conversation.conversationId || props.conversationKey || '', photoItems, last), first);
    // What is happening now (a send, an error, a denied camera) belongs to the newest moment, even before its first photo.
    const live = !!attach.message && attach.tone !== 'success';
    if (!groups.length && live) groups.push({ key: 'photos:now', after: last, items: [] });
    groups.forEach((group, index) => notes.push({ key: group.key, afterMessageId: group.after,
      node: <TaskPhotoLine photos={attach} items={group.items} total={photoItems.length} latest={index === groups.length - 1} ask={photoConfirm.ask}
        disabled={photosOff} onGallery={() => props.onPhotoSource?.('LIBRARY')} /> }));
  }
  return <AiConversationShell conversationKey={props.conversationKey ?? conversation.conversationId} title={conversation.review.boundNeedId ? 'Izmena zadatka' : 'Novi zadatak'}
    cardPlacement="end" closed={ended}
    footerAction={footerAction}
    interactiveContextKey={askOpen && (editingPlace || editingSavedPlace) ? placeKey : undefined}
    // A tap on the line, which may sit far up the thread, opens its editor at the end: that editor is revealed.
    revealInteractiveContext={editingSavedPlace}
    threadNotes={notes.length ? notes : undefined}
    value={value} canEdit={props.canEdit} canSend={props.canSubmit && (!editingPlace || contextualReply)}
    sendBlockedReason={editingPlace ? 'Prvo potvrdi mesto ili zatvori mapu.' : undefined}
    messages={messages} pending={pending} busy={busy} streamingText={props.streamingText}
    sentMessage={props.sentMessage}
    // The assistant and the one line the draft asks for (R1): the three examples under it show what to say, so no sentence explains it.
    welcome="Reci šta ti treba."
    welcomeDetail=""
    openings={TASK_OPENINGS}
    placeholder="Opiši šta ti treba"
    onBack={() => { if (editingPlaceNow.current && closePlace.current) closePlace.current(); else props.onBack(); }}
    onChange={props.onChange} onSend={send}
    onOptions={menu.length ? () => { Keyboard.dismiss(); setPanel('options'); } : undefined} voice={editingPlace && !contextualReply ? undefined : props.voice}
    // The "+" opens the photo sheet here, in the conversation, before the first word too: choosing a source is what opens
    // the conversation then, as the first word or the held microphone does.
    attach={attach ? { label: PHOTO_WORDS.add, hint: 'Galerija ili kamera.',
      onPress: outsidePlace(() => { Keyboard.dismiss(); setPanel('photos'); }), disabled: photosOff }
      : props.onPhotos ? { label: 'Fotografije zadatka', hint: 'Dodaj ili pregledaj fotografije zadatka.',
        onPress: outsidePlace(props.onPhotos), disabled: props.photosDisabled || editingPlace } : undefined}
    // The conversation gathers facts; only the complete proposal becomes a card at its end (owner, 9 Oct).
    // Partial and abandoned drafts remain reachable through the existing review menu, never a premature card.
    card={compact => !showSummary ? null : <DraftCard summary={summary}
      stillNeeded={stillNeededText} open={open} busy={busy} compact={compact} canReview={reviewAllowed}
      onReview={outsidePlace(props.onReview)} note={note} reviewLabel={props.reviewLabel} editing={!!conversation.review.boundNeedId}
      hiddenMissing={hiddenMissing} reviewAtEnd={readyForReview} locationEditing={editingPlace} ended={ended} appear={landed} />}
    actions={(!attach && photoAssets.length) || (safetyCopy && (!showSummary || conversation.safety === 'BLOCK')) ? <>
      {!attach && photoAssets.length ? <View testID="intake-photos" style={s.photos}>
        {props.onPhotos ? <Press accessibilityRole="button" accessibilityLabel="Pregledaj fotografije zadatka"
          disabled={props.photosDisabled || editingPlace} accessibilityState={{ disabled: !!props.photosDisabled || editingPlace }} onPress={outsidePlace(props.onPhotos)}
          style={s.photoHeader}>
          <T variant="bodyStrong">Fotografije zadatka</T><Glyph name="caret-right" tone="muted" />
        </Press> : <T variant="bodyStrong">Fotografije zadatka</T>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoRow}>
          {photoAssets.map((assetId, index) => <AuthorizedPhoto key={assetId} assetId={assetId}
            label={`Fotografija zadatka ${index + 1}`} contentFit="cover" style={s.photoTile} />)}
        </ScrollView>
      </View> : null}
      {safetyCopy && (!showSummary || conversation.safety === 'BLOCK') ? <T accessibilityRole="alert" variant="note"
        style={conversation.safety === 'BLOCK' ? s.danger : s.muted}>{safetyCopy}</T> : null}
    </> : undefined}
    // The point being asked for (or explicitly reopened) is task context on the white reading surface, at the end of the
    // thread. A confirmed place is not context: it is the line above. Nothing is passed when there is nothing to show, so no
    // empty block is drawn. Recovery keeps its own distinct status well.
    context={askOpen ? <Suspense fallback={<T accessibilityLiveRegion="polite" tone="muted">Otvaramo mapu…</T>}>
      <ConversationPointAsk key={placeKey} conversationId={conversation.conversationId} disabled={placeDisabled}
        startEditing={editingSavedPlace}
        onEditingChange={reportEditingPlace} onCloseRequestReady={registerPlaceClose}
        onPromptReady={props.locationDialogueEnabled ? registerPlacePrompt : undefined}
        // A reopened saved place is done once its save is confirmed: the editor closes into the line, also when the same
        // place was confirmed again (its identity, and so this visit's key, would not change). A missing point keeps its ask
        // until the readback shows it complete.
        onSaved={editingSavedPlace ? () => { setSavedPlaceEdit(null); props.onRefresh(); } : props.onRefresh} onClose={() => {
          reportEditingPlace(false);
          // Closing a reopened saved place returns to its line; a missing point that is put away leaves its way back.
          if (editingSavedPlace) setSavedPlaceEdit(null); else setHiddenPlace(placeKey);
        }} />
    </Suspense>
      : showPlace && !placeComplete && pointAskHidden
        ? <V2Action tone={needsPoint ? 'brand' : 'neutral'} label="Pokaži mesto na mapi" kind={needsPoint ? 'primary' : 'quiet'} style={needsPoint ? brandAction : undefined}
          onPress={() => { Keyboard.dismiss(); setHiddenPlace(null); }} /> : undefined}
    // A fragment is truthy even when every branch inside it is null, which drew an empty
    // panel in the thread. The slot is filled only when there is something to act on.
    status={!props.error && !statusCopy && !props.onCancelPending && !props.showReadback && !props.retainedLocationSpeech ? undefined : <>
      {props.retainedLocationSpeech ? <View style={{ gap: sys.space.sm }}>
        <T variant="note" tone="muted">Glasovna poruka je sačuvana. Možeš je ponovo poslati.</T>
        <T variant="note" selectable>{props.retainedLocationSpeech.text}</T>
        <V2Action tone="neutral" kind="secondary" label="Vrati tekst u polje" disabled={!props.retainedLocationSpeech.canRestore}
          reason={!props.retainedLocationSpeech.canRestore ? 'Prvo proveri prethodnu poruku; tek onda možeš da upišeš novu.' : null}
          onPress={props.retainedLocationSpeech.onRestore} />
      </View> : null}
      {props.error ? <T accessibilityRole="alert" variant="note" style={s.danger}>{props.error}</T> : null}
      {statusCopy ? <T accessibilityLiveRegion="polite" variant="note" style={s.muted}>{statusCopy}</T> : null}
      {/* What can be done, most likely first: read what happened ("Proveri", the app's one word for it), and only then the rarer way out, with
          what it costs written right above it. */}
      {props.showReadback ? <V2Action tone="neutral" label={OUTCOME_ACTION.check} accessibilityLabel={`${OUTCOME_ACTION.check} da li je poruka poslata`}
        disabled={props.readbackDisabled} onPress={props.onRefresh} /> : null}
      {props.onCancelPending ? <>
        <T variant="note" style={s.muted}>Ako odustaneš, odgovor asistenta neće promeniti zadatak. Ako je asistent već počeo da odgovara, poruka je ipak poslata.</T>
        <V2Action tone="neutral" kind="quiet" label={props.cancelPendingDispatched ? 'Odustani od odgovora' : 'Otkaži slanje poruke'}
          disabled={props.cancelPendingDisabled} onPress={props.onCancelPending} />
      </> : null}
    </>}>
    {panel === 'options' ? <ActionSheet label="Opcije razgovora" actions={menu} reduced={reduced} onClose={() => setPanel(null)} /> : null}
    {panel === 'photos' && attach ? <PhotoAttachSheet remaining={attach.remaining} disabledReason={attach.addReason}
      limits={photoLimits('TASK')} notice={TASK_PHOTO_NOTICE} reduced={reduced}
      onPick={source => { if (!editingPlaceNow.current) props.onPhotoSource?.(source); }} onClose={() => setPanel(null)} /> : null}
    {photoConfirm.sheet}
  </AiConversationShell>;
}

const s = StyleSheet.create({
  photos: { gap: sys.space.sm },
  photoHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoRow: { gap: sys.space.sm },
  photoTile: { width: 104, height: 104, aspectRatio: 1 },
  canvas: { flex: 1, backgroundColor: sys.conversation.ground },
  muted: { color: sys.color.muted }, danger: { color: sys.color.danger },
  // The living draft is a panel above the thread (a thing that is read, in a frame, with no shadow); only its padding is its own.
  card: { paddingVertical: sys.space.md, gap: sys.space.sm },
  cardCompact: { paddingVertical: sys.space.sm },
  // Final, the facts are rows of one kind, 8 apart; while the draft is made they are pictures with their words in a line that wraps by whole facts.
  details: { gap: sys.space.sm },
  stickers: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.md, rowGap: sys.space.sm },
  sticker: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, flexShrink: 1, maxWidth: '100%' },
  stickerWords: { color: sys.color.fact, flexShrink: 1 },
  // The way to the review while something is missing is a quiet word at the start of its own line, as high as a finger.
  reviewAction: { minHeight: layout.touch, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  compactTitle: { ...sys.type.cardTitleCompact, color: sys.color.ink },
  titleEmpty: { color: sys.color.muted },
  // The card's own fact size (`note`), in the weight of a way forward (verify r4b ra item C: it was a raw 14/19).
  readyText: { flexShrink: 1, fontWeight: '600', color: sys.color.ink },
  unavailable: { flex: 1, paddingHorizontal: layout.gutter },
});
