import { lazy, Suspense, useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretDown, CaretRight, CaretUp } from 'phosphor-react-native';
import { FactArt } from '../system/FactArt';
import { AuthorizedPhoto } from '../media/AuthorizedPhoto';
import { mediaAssetId } from '../../data/mediaAssetId';
import type { AiNeedV2Conversation, AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { safetyMessage } from '../../data/aiNeedV2Ui';
import { factDisplayLabel } from '../../contracts/needFactsV2';
import { Press } from '../Press';
import { brandAction, cardCompact, sys } from '../system/tokens';
import { useReducedMotion } from '../system/motion';
import { useLayoutClass } from '../system/textScale';
import { ActionSheet, type SheetAction } from '../system/ActionSheet';
import { ScreenChrome } from '../system/ScreenChrome';
import { StateView } from '../system/StateView';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { CardFact, CardTitle, CardValue, valueSpoken } from './TaskFace';
import { normalizeNeedLocation, pointsMissing } from '../../lib/location';
import { AiConversationShell, useAiDraftDisclosure } from '../aiFirst/AiConversationShell';
import type { VoiceInput } from '../aiFirst/VoiceComposer';
import type { LocationReplyPrompt } from '../location/ConversationPointAsk';
import { ConfirmedPlaceLine } from '../location/ConfirmedPlaceLine';
import { confirmedPlaceEntries } from '../location/placeText';
import type { ConfirmedLocationPoint, LocationSlot } from '../../contracts/location';
import { publicSummary, type Summary } from './draftSummary';
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
const fingerprint = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(36);
};
const pointFingerprint = (point: ConfirmedLocationPoint) => fingerprint(JSON.stringify([point.latitudeE6, point.longitudeE6,
  point.address ?? null, point.origin.kind]));
/** `live`: this visit had the place's editor open, so a newly confirmed point was confirmed just now. */
function anchorPlace(conversationId: string, placeKey: string, points: readonly ConfirmedLocationPoint[], after: string | null, live: boolean): PlaceAnchor {
  const identity = fingerprint(placeKey), previous = placeAnchors.get(conversationId);
  if (previous?.identity === identity) return previous;
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
      {loading ? <View style={s.loading}>
        <View style={s.unavailableMark}><FactArt kind="chat" size={36} role="ai" /></View>
        <T accessibilityRole="header" variant="title" style={s.ink}>Otvaramo razgovor</T>
        <ActivityIndicator accessibilityLabel="Učitavamo razgovor" color={sys.color.artRole.ai.front} />
      </View> : <StateView kind="error" art="chat" title="Razgovor nije dostupan" body={error} primary={primary} />}
    </View>
  </SafeAreaView>;
}

/** Three ways in, taken from what people actually opened a conversation to ask for. */

/**
 * The live draft starts compact. Disclosure only shows existing facts; its sibling review action retains the
 * owned editor's guards. Safety stays visible; during point editing, disclosure reveals the full draft.
 */
export function DraftCard({ summary, stillNeeded, open, busy, compact, canReview, onReview, note, reviewLabel = 'Pregledaj zadatak',
  editing = false, hiddenMissing = false, reviewAtEnd = false, locationEditing = false }: {
  summary: Summary; stillNeeded: string | null; open: boolean; busy: boolean; compact: boolean; canReview: boolean;
  onReview: () => void; note: string | null;
  /** The review's own name, the one the "···" menu uses ("Pregledaj izmene" while a published task is being changed). */
  reviewLabel?: string;
  /** The conversation changes a task that already exists (review r4 ra item 9): the card says "Izmena", not "Nacrt". */
  editing?: boolean;
  /** Something the server still needs is one people never see (the category): the card claims nothing is missing. */
  hiddenMissing?: boolean;
  /** A complete draft becomes the final summary in the thread, with review and edit entries inside this one card. */
  reviewAtEnd?: boolean;
  /** Give an active location question room; existing disclosure still opens all draft facts. */
  locationEditing?: boolean;
}) {
  const { stacked } = useLayoutClass();
  const stackValue = stacked || (summary.value?.kind === 'amount' && summary.value.amount.length > 12);
  const { expanded, toggle } = useAiDraftDisclosure();
  const next = !open ? null : stillNeeded ? `Još treba: ${stillNeeded}` : null;
  const ready = open && !stillNeeded && !hiddenMissing;
  // A complete authoritative draft is no longer presented as if it were still being collected. It keeps the same
  // TaskFace language and shows the facts needed for the decision with one guarded primary review action.
  // This is not the published TaskCard/Peek and carries no publication state.
  const readyForReview = ready && reviewAtEnd;
  // The docked summary keeps short terms readable beside one quiet action, without two competing blocks.
  const briefReview = compact && !expanded && !readyForReview && !stackValue;
  const locationSummary = locationEditing && !expanded && !readyForReview;
  const status = `${readyForReview ? editing ? 'Izmena spremna za pregled' : 'Spremno za pregled' : editing ? 'Izmena' : 'Nacrt'}${busy ? ' · dopunjuje se' : ''}`;
  const spoken = [status, summary.title ?? 'Zadatak u nastajanju', summary.zone || null, summary.schedule ?? null,
    summary.people, summary.value ? valueSpoken(summary.value) : null].filter(Boolean).join(', ');
  const DisclosureCaret = expanded ? CaretUp : CaretDown;
  const title = <View style={s.titleSide}>
    <View style={s.statusRow}><View style={[s.dot, busy && s.dotBusy, readyForReview && s.dotReady]} />
      <T variant="label" style={[s.status, readyForReview && s.statusReady]}>{status}</T></View>
    <CardTitle title={summary.title ?? 'Zadatak u nastajanju'} lines={readyForReview || expanded ? 0 : locationSummary ? 1 : 2}
      style={[s.compactTitle, !summary.title && s.titleEmpty]} />
  </View>;
  return <View testID="intake-task-summary"
    style={[s.card, (compact || locationSummary) && s.cardCompact, readyForReview && s.cardReady]}>
    {readyForReview ? <View testID="intake-ready-head" accessible accessibilityLabel={spoken} style={s.disclosure}>
      {title}
    </View> : <Press testID="intake-draft-disclosure" accessibilityRole="button"
      accessibilityLabel={expanded ? 'Sakrij detalje nacrta' : 'Pokaži detalje nacrta'} accessibilityValue={{ text: spoken }}
      accessibilityHint="Prikazuje sažetak unetih podataka u razgovoru." accessibilityState={{ expanded }}
      onPress={toggle} haptic="select" style={s.disclosure}>
      {title}
      <DisclosureCaret size={20} color={sys.color.muted} />
    </Press>}
    {readyForReview || expanded ? <View testID="intake-draft-details" style={s.details}>
      {summary.zone ? <CardFact art={<FactArt kind={summary.zone === 'Na daljinu' ? 'remote' : 'pin'} size={24} cut="art" role="location" />} text={summary.zone} lines={0} />
        : <T variant="note" tone="muted">Lokacija nije određena</T>}
      {summary.schedule ? <CardFact art={<FactArt kind="calendar" size={24} cut="art" role="time" />} text={summary.schedule} lines={0} /> : null}
      {summary.people ? <CardFact art={<FactArt kind="users" size={24} cut="art" role="people" />} text={summary.people} lines={0} /> : null}
    </View> : null}
    {note ? <T variant="note" tone="muted">{note}</T> : null}
    {!locationSummary && (next ? <T variant="note" tone="muted" style={s.next}>{next}</T>
      : ready && !canReview ? <T variant="note" tone="muted" style={s.next}>Sve traženo je uneto.</T> : null)}
    {!locationSummary && (summary.value || !reviewAtEnd || readyForReview) ? <View style={[s.reviewRow, stackValue && s.reviewRowLarge]}>
      {summary.value ? <View testID="intake-draft-value" style={[s.value, stackValue && s.valueStacked]}>
        {briefReview ? <T variant="note" style={s.briefValue}>{valueSpoken(summary.value)}</T>
          : <CardValue value={summary.value} large />}
      </View> : null}
      {!reviewAtEnd || readyForReview ? <Press testID="intake-draft-review" accessibilityRole="button"
        accessibilityLabel={readyForReview ? 'Izmeni podatke zadatka' : reviewLabel}
        accessibilityHint={readyForReview ? 'Otvara pregled u kome možeš da izmeniš podatke pre objave.'
          : editing ? 'Otvara pregled izmena.' : 'Otvara pregled svih podataka pre objave.'}
        accessibilityState={{ disabled: !canReview }} disabled={!canReview}
        onPress={() => { if (canReview) onReview(); }} haptic={canReview ? 'select' : 'none'} style={[s.reviewAction, briefReview && s.reviewActionBrief]}>
        <T variant="note" style={[s.readyText, !canReview && s.muted]}>{readyForReview ? 'Izmeni' : briefReview ? 'Pregledaj' : reviewLabel}</T>
        <CaretRight size={18} color={canReview ? sys.color.ink : sys.color.muted} />
      </Press> : null}
    </View> : null}
    {readyForReview ? <V2Action label={editing ? 'Pregledaj izmene' : 'Pregledaj i objavi'}
      style={brandAction} disabled={!canReview} onPress={() => { if (canReview) onReview(); }} /> : null}
  </View>;
}

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
  const safetyCopy = safetyMessage(conversation.safety);
  const open = conversation.status === 'OPEN';
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
  const anchor = placeComplete ? anchorPlace(conversation.conversationId, placeKey, confirmedPoints,
    conversation.messages.at(-1)?.id ?? null, askSeen.current) : null;
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
  const readyForReview = open && reviewAllowed && conversation.safety !== 'BLOCK'
    && !stillNeededText && !hiddenMissing && !needsPoint && !busy && !pending && !props.error;
  // Current facts belong in the live card and the explicit full review. Decorating
  // old replies with today's fact values repeated the summary and rewrote history.
  const messages = conversation.messages;
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
    cardPlacement={readyForReview ? 'end' : 'top'}
    interactiveContextKey={askOpen && (editingPlace || editingSavedPlace) ? placeKey : undefined}
    // A tap on the line, which may sit far up the thread, opens its editor at the end: that editor is revealed.
    revealInteractiveContext={editingSavedPlace}
    threadNotes={notes.length ? notes : undefined}
    value={value} canEdit={props.canEdit} canSend={props.canSubmit && (!editingPlace || contextualReply)}
    sendBlockedReason={editingPlace ? 'Prvo potvrdi mesto ili zatvori mapu.' : undefined}
    messages={messages} pending={pending} busy={busy} streamingText={props.streamingText}
    sentMessage={props.sentMessage}
    welcome="Reci šta ti treba."
    welcomeDetail="Opiši zadatak svojim rečima. Pre objave sve pregledaš."
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
    // Nothing is pinned until the conversation has said or taken something: an empty card at the
    // top of a fresh screen states a draft that does not exist yet and buries the invitation.
    card={compact => !conversation.facts.length && !messages.length ? null : <DraftCard summary={summary}
      stillNeeded={stillNeededText} open={open} busy={busy} compact={compact} canReview={reviewAllowed}
      onReview={outsidePlace(props.onReview)} note={note} reviewLabel={props.reviewLabel} editing={!!conversation.review.boundNeedId}
      hiddenMissing={hiddenMissing} reviewAtEnd={readyForReview} locationEditing={editingPlace} />}
    actions={(!attach && photoAssets.length) || (safetyCopy && conversation.safety === 'BLOCK') ? <>
      {!attach && photoAssets.length ? <View testID="intake-photos" style={s.photos}>
        {props.onPhotos ? <Press accessibilityRole="button" accessibilityLabel="Pregledaj fotografije zadatka"
          disabled={props.photosDisabled || editingPlace} accessibilityState={{ disabled: !!props.photosDisabled || editingPlace }} onPress={outsidePlace(props.onPhotos)}
          style={s.photoHeader}>
          <T variant="bodyStrong">Fotografije zadatka</T><CaretRight size={20} color={sys.color.muted} />
        </Press> : <T variant="bodyStrong">Fotografije zadatka</T>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoRow}>
          {photoAssets.map((assetId, index) => <AuthorizedPhoto key={assetId} assetId={assetId}
            label={`Fotografija zadatka ${index + 1}`} contentFit="cover" style={s.photoTile} />)}
        </ScrollView>
      </View> : null}
      {safetyCopy && conversation.safety === 'BLOCK' ? <T accessibilityRole="alert" variant="note" style={s.danger}>{safetyCopy}</T> : null}
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
    status={!props.error && !props.statusCopy && !props.onCancelPending && !props.showReadback && !props.retainedLocationSpeech ? undefined : <>
      {props.retainedLocationSpeech ? <View style={{ gap: sys.space.sm }}>
        <T variant="note" tone="muted">Govorna poruka je sačuvana za ponovni unos.</T>
        <T variant="note" selectable>{props.retainedLocationSpeech.text}</T>
        <V2Action tone="neutral" kind="secondary" label="Vrati tekst u polje" disabled={!props.retainedLocationSpeech.canRestore}
          reason={!props.retainedLocationSpeech.canRestore ? 'Završi proveru prethodne poruke i oslobodi mesto u polju za tekst.' : null}
          onPress={props.retainedLocationSpeech.onRestore} />
      </View> : null}
      {props.error ? <T accessibilityRole="alert" variant="note" style={s.danger}>{props.error}</T> : null}
      {props.statusCopy ? <T accessibilityLiveRegion="polite" variant="note" style={s.muted}>{props.statusCopy}</T> : null}
      {props.onCancelPending ? <>
        <T variant="note" style={s.muted}>Odustajanje sprečava da kasniji odgovor promeni podatke. Ako je odgovor već počeo da se sprema, poruka se ipak računa kao poslata.</T>
        <V2Action tone="neutral" kind="quiet" label={props.cancelPendingDispatched ? 'Odustani od odgovora' : 'Otkaži slanje poruke'}
          disabled={props.cancelPendingDisabled} onPress={props.onCancelPending} />
      </> : null}
      {props.showReadback ? <V2Action tone="neutral" label="Proveri ishod" disabled={props.readbackDisabled} onPress={props.onRefresh} /> : null}
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
  ink: { color: sys.color.ink }, muted: { color: sys.color.muted }, danger: { color: sys.color.danger },
  // The living draft is a distinct summary above the thread, with the task card's facts and rhythm.
  card: { ...cardCompact, paddingVertical: 12, gap: 8, backgroundColor: sys.color.surface, borderColor: sys.conversation.edge },
  cardCompact: { paddingVertical: 8 },
  cardReady: { borderColor: sys.color.line },
  disclosure: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  details: { gap: 8, paddingTop: 8, paddingBottom: 4 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  reviewRowLarge: { flexDirection: 'column', alignItems: 'stretch', gap: 0 },
  value: { minWidth: 0, maxWidth: '100%', flexShrink: 1 },
  valueStacked: { width: '100%' },
  briefValue: { color: sys.color.ink, flexShrink: 1, fontVariant: ['tabular-nums'] },
  reviewActionBrief: { flexShrink: 0 },
  reviewAction: { minHeight: 48, flexShrink: 1, marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactTitle: { ...sys.type.cardTitleCompact, color: sys.color.ink },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: sys.radius.pill, backgroundColor: sys.color.muted },
  // While the conversation changes the draft, the dot is the screen's orange accent: a dot, never a fill.
  dotBusy: { backgroundColor: sys.color.orange },
  dotReady: { backgroundColor: sys.color.green },
  status: { flex: 1, color: sys.color.muted, letterSpacing: 0.3 },
  statusReady: { color: sys.color.muted },
  titleSide: { flex: 1, minWidth: 0, gap: 4 },
  titleEmpty: { color: sys.color.muted },
  next: { marginTop: 2 },
  // The card's own fact size (`note`), in the weight of a way forward (verify r4b ra item C: it was a raw 14/19).
  readyText: { flexShrink: 1, fontWeight: '600', color: sys.color.ink },
  unavailable: { flex: 1, paddingHorizontal: sys.space.xl, justifyContent: 'center' },
  loading: { gap: 16, alignItems: 'center' },
  unavailableMark: { width: 80, height: 80, borderRadius: sys.radius.card, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center' },
});
