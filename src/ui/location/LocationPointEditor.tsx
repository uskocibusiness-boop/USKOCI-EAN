import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ConfirmedLocationPoint, LocationPinOrigin, LocationSlot } from '../../contracts/location';
import { createConfiguredLocationResolver, type ConfiguredLocationResolution, type LocationResolverCandidate } from '../../data/configuredLocationResolver';
import { locationPrivateText } from '../../lib/location';
import { captureCurrentLocation } from '../../data/nativeCurrentLocation';
import { sesijaSada } from '../../store/sesija';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import type { LocationDialogueRequest } from '../../contracts/locationDialogue';
import { V2Action as Button } from '../v2/V2Action';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt } from '../system/FactArt';
import { brandAction, sys } from '../system/tokens';
import { LocationDetails, LocationField } from './LocationControls';
import { ResolvedPinMap, type ResolvedPinPosition } from './ResolvedPinMap';

type DialogueContext = LocationDialogueRequest['locationContext'];
export type PointPromptLease = { isCurrent: () => boolean; confirm: () => boolean; correct: () => boolean; cancel: () => void };
export type PointPrompt = {
  context: Omit<DialogueContext, 'reviewRevision' | 'slot'>;
  acquire: () => PointPromptLease | null;
};

// Serbian Cyrillic to Latin. OSM / LocationIQ labels for Serbia are often Cyrillic ("Булевар ослобођења") while people
// type or speak Latin; matching and the shown address both use Latin.
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm',
  н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č', џ: 'dž', ш: 'š',
};
export const toSerbianLatin = (value: string): string => value.replace(/[Ѐ-ӿ]/g, letter => {
  const lower = letter.toLowerCase(), latin = CYRILLIC[lower];
  if (latin === undefined) return letter;
  return letter === lower ? latin : latin.charAt(0).toUpperCase() + latin.slice(1);
});

const searchTokens = (value: string): readonly string[] => {
  const normalized = toSerbianLatin(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sr-Latn-RS').replace(/đ/g, 'd');
  return [...new Set(normalized.split(/[^a-z0-9\u0400-\u04ff]+/g).filter(token => token.length > 1 || /^\d+$/.test(token)))];
};

/** A single provider result is only an automatic pin when it still describes what the person asked for.
 * City/region fallbacks are useful camera context, but must never masquerade as a street/house point. */
const candidateFitsSeed = (query: string, label: string): boolean => {
  const wanted = searchTokens(query), offered = new Set(searchTokens(label));
  if (!wanted.length || !offered.size) return false;
  const numbers = wanted.filter(token => /^\d+$/.test(token));
  if (numbers.some(token => !offered.has(token))) return false;
  const words = wanted.filter(token => !/^\d+$/.test(token));
  if (!words.length) return numbers.length > 0;
  const matched = words.filter(token => offered.has(token)).length;
  // A bare city/short locality is camera context only. A short explicit "street, locality"
  // seed is different: the comma is inserted by our slot seed builder and both words must
  // survive in the provider label. That may propose the street position for human adjustment,
  // but it still never confirms or saves anything automatically.
  if (!numbers.length && words.length <= 2) {
    const explicitStreetAndLocality = query.includes(',') && words.length === 2 && matched === 2;
    return explicitStreetAndLocality;
  }
  const required = words.length <= 2 ? words.length : Math.ceil(words.length * 0.75);
  return matched >= required;
};

/** Several provider rows for one house (the building and a shop in it) are one place when every row describes
 * what was asked for and all lie within a few metres of the first. Rows that are really different stay ambiguous. */
const SAME_PLACE_METRES = 50;
const metresBetween = (a: ResolvedPinPosition, b: ResolvedPinPosition): number => {
  const dLat = (a.latitude - b.latitude) * 111_320;
  const dLon = (a.longitude - b.longitude) * 111_320 * Math.cos(((a.latitude + b.latitude) / 2) * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
};
const samePlaceCandidates = <C extends { label: string; position: ResolvedPinPosition }>(query: string, candidates: readonly C[]): readonly C[] =>
  candidates.length > 1 && candidates.every(item => candidateFitsSeed(query, item.label)
    && metresBetween(item.position, candidates[0].position) <= SAME_PLACE_METRES) ? [candidates[0]] : candidates;

/** A weak provider result may still identify the right street even when it cannot prove the house number.
 * That is enough to zoom the camera to the street, never enough to create or confirm a pin. */
const candidateProvidesStreetContext = (query: string, label: string): boolean => {
  const primary = query.split(',')[0]?.trim() ?? '';
  const wanted = searchTokens(primary), offered = new Set(searchTokens(label));
  const words = wanted.filter(token => !/^\d+$/.test(token));
  const hasNumber = wanted.some(token => /^\d+$/.test(token));
  if (words.length < 2 || (!query.includes(',') && !hasNumber && words.length <= 2)) return false;
  const matched = words.filter(token => offered.has(token)).length;
  return matched >= Math.max(2, Math.ceil(words.length * 0.75));
};

type Props = {
  slot: LocationSlot; title: string; point?: ConfirmedLocationPoint; scopeKey: string; disabled: boolean;
  countryCode: string; initialQuery?: string; resolver?: ReturnType<typeof createConfiguredLocationResolver>;
  /** Look the seeded query up once, so a caller that already knows the address can show the pin
   *  standing on it instead of asking the person to search for what they just said. Opt-in: a
   *  lookup leaves a proposal pending confirmation. Only the long form treats automatic lookup as an unsaved change. */
  autoLocate?: boolean;
  /** The chat proposes one pin first; the full manual form retains all controls. */
  presentation?: 'form' | 'conversation';
  /** Visible selected-role summary above this editor; omit only its exact repeated text. */
  conversationSummary?: { title: string; description: string };
  onCorrectInConversation?: () => void;
  onPromptReady?: (prompt: PointPrompt | null) => void;
  /** Confirming the point is the primary action where nothing else saves (the conversation's point sheet); in the long
   *  form the footer's save is, so there the confirmation is white. */
  confirmAsPrimary?: boolean;
  onInvalidate: () => void; onConfirm: (point: ConfirmedLocationPoint) => void;
};
/** One visible point proposal. Only the explicit confirmation emits a saved value. */
export function LocationPointEditor(props: Props) {
  // A new point/country/account incarnation owns a fresh editor, including A-B-A.
  return <ScopedPointEditor key={JSON.stringify([props.scopeKey, props.countryCode, props.slot])} {...props} />;
}
function ScopedPointEditor({ slot, title, point, scopeKey, countryCode, initialQuery = '', resolver: injectedResolver,
  autoLocate = false, presentation = 'form', conversationSummary, onCorrectInConversation, onPromptReady, confirmAsPrimary = true, disabled, onInvalidate, onConfirm }: Props) {
  const conversation = presentation === 'conversation';
  const [defaultResolver] = useState(() => createConfiguredLocationResolver());
  const resolver = injectedResolver ?? defaultResolver;
  const [position, setPosition] = useState<ResolvedPinPosition | null>(point
    ? { latitude: point.latitudeE6 / 1e6, longitude: point.longitudeE6 / 1e6 } : null);
  const [origin, setOrigin] = useState<LocationPinOrigin>(point?.origin ?? { kind: 'MANUAL_PIN' });
  const [address, setAddress] = useState(point?.address ?? '');
  const [notes, setNotes] = useState(point?.accessNotes ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  // With no point the map opens at [0,0] zoom 1 - a hemisphere of empty ocean, which reads as
  // broken. Where the address is already known the map has no job until something resolves,
  // so it waits. Opt-in with autoLocate; the long form still shows it from the start.
  const [placeByHand, setPlaceByHand] = useState(false);
  // Camera context is never a selected point. Keep only this editor's actual resolver positions.
  const [cameraHint, setCameraHint] = useState<readonly ResolvedPinPosition[] | undefined>();
  // "The work starts where I am" is the shortest path to a point, and it was missing. The
  // permission is requested only when this is pressed, never on opening; one foreground
  // observation, no geocoder and no background listener. Opt-in with autoLocate, so the long
  // form gains no permission prompt it did not have.
  const [here, setHere] = useState<null | 'BUSY' | 'DENIED' | 'UNAVAILABLE'>(null);
  const hereRequest = useRef<AbortController | null>(null);
  useEffect(() => () => hereRequest.current?.abort(), []);
  const [searchText, setSearchText] = useState(initialQuery);
  const [lookup, setLookup] = useState<ConfiguredLocationResolution | { status: 'IDLE' | 'LOADING' }>({ status: 'IDLE' });
  const [lookupMode, setLookupMode] = useState<'search' | 'reverse'>('search');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [expandedMap, setExpandedMap] = useState(false);
  const [candidatePage, setCandidatePage] = useState(0);
  const [focused, setFocused] = useState(false);
  const [replyLocked, setReplyLocked] = useState(false);
  const replyLease = useRef<object | null>(null);
  const controlDisabled = disabled || replyLocked;

  const focus = useRef(false), requestEpoch = useRef(0), renderEpoch = useRef(0);
  const rendered = ++renderEpoch.current;
  const located = useRef(false);
  const alive = useRef(true);
  const current = useRef({ disabled, point }); current.current = { disabled, point };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    focus.current = true; setFocused(true);
    return () => {
      focus.current = false; replyLease.current = null; setReplyLocked(false); renderEpoch.current++; requestEpoch.current++; resolver.cancel();
      hereRequest.current?.abort(); hereRequest.current = null; setHere(null);
      const saved = current.current.point;
      // Clearing the search text on blur left the point ask seedless for the rest of the session:
      // the address the conversation worked to obtain was gone, the field empty and "Pronađi na
      // mapi" greyed out. Coming back restores the seed and lets the automatic lookup run again.
      setCameraHint(undefined); if (conversation) setPlaceByHand(false);
      setFocused(false); setLookup({ status: 'IDLE' }); setSelectedLabel(null); setCorrectionOpen(false); setExpandedMap(false); setSearchText(initialQuery); located.current = false; setError(false);
      setPosition(saved ? { latitude: saved.latitudeE6 / 1e6, longitude: saved.longitudeE6 / 1e6 } : null);
      setOrigin(saved?.origin ?? { kind: 'MANUAL_PIN' });setAddress(saved?.address ?? '');setNotes(saved?.accessNotes ?? '');
    };
  }, [resolver]));
  useEffect(() => {
    if (!disabled) return;
    replyLease.current = null; setReplyLocked(false);
    requestEpoch.current++; resolver.cancel(); setLookup({ status: 'IDLE' }); setSelectedLabel(null); setCorrectionOpen(false); setExpandedMap(false);
    setCameraHint(undefined); if (conversation) setPlaceByHand(false);
    hereRequest.current?.abort(); hereRequest.current = null; setHere(null);
    const saved = current.current.point;
    // Recovery retires the unsaved proposal. Allow its normal guarded lookup again
    // when editing resumes; a confirmed point still always wins below.
    located.current = false;
    setPosition(saved ? { latitude: saved.latitudeE6 / 1e6, longitude: saved.longitudeE6 / 1e6 } : null);
    setOrigin(saved?.origin ?? { kind: 'MANUAL_PIN' });
    if (conversation) setAddress(saved?.address ?? '');
  }, [disabled, resolver, conversation]);
  const owns = () => alive.current && focus.current && !current.current.disabled && !replyLease.current && rendered === renderEpoch.current;
  const retireSearch = (clearCandidatePin = false) => {
    renderEpoch.current++; requestEpoch.current++; resolver.cancel(); setLookup({ status: 'IDLE' }); setSelectedLabel(null);
    setCandidatePage(0); setCameraHint(undefined);
    hereRequest.current?.abort(); hereRequest.current = null; setHere(null);
    if (clearCandidatePin && origin.kind === 'PROVIDER_CANDIDATE') { setPosition(null); setOrigin({ kind: 'MANUAL_PIN' }); }
  };
  const invalidate = (notifyEdit = true) => { setPending(true); setError(false); if (notifyEdit) onInvalidate(); };
  const lookupAddress = async (next: ResolvedPinPosition, adoptProposal: boolean) => {
    const epoch = requestEpoch.current, owner = sesijaSada();
    const ownsRequest = () => alive.current && focus.current && !current.current.disabled && epoch === requestEpoch.current
      && sesijaSada().user?.id === owner.user?.id && sesijaSada().accountRevision === owner.accountRevision;
    setLookupMode('reverse'); setLookup({ status: 'LOADING' });
    try {
      const result = await resolver.reverse({ position: next, countryCode, scopeKey });
      if (!ownsRequest()) return;
      setLookup(result.status === 'CANCELLED' ? { status: 'IDLE' } : result);
      // The reverse contract admits at most one address. It labels the user's pin;
      // the provider's nearest coordinates must never replace that exact selection.
      if (adoptProposal && result.status === 'PROPOSALS' && result.candidates.length === 1) {
        setAddress(result.candidates[0].label); setSelectedLabel(result.candidates[0].label);
      }
    } catch {
      if (ownsRequest()) setLookup({ status: 'UNAVAILABLE' });
    }
  };
  const choose = (next: ResolvedPinPosition) => {
    if (!owns()) return;
    retireSearch(); setCorrectionOpen(false);
    setPosition(next); setOrigin({ kind: 'MANUAL_PIN' }); invalidate();
    if (conversation) {
      // Conversation: a completed drag/map tap updates the draft address too.
      // Clear the old address now; a newer edit/point/visit retires this lookup.
      setAddress('');
      void lookupAddress(next, true);
    }
  };
  const changeSearch = (value: string) => {
    if (!owns()) return;
    retireSearch(); setSearchText(value); setPosition(null); setOrigin({ kind: 'MANUAL_PIN' }); invalidate();
    if (conversation) setAddress('');
  };
  const runSearch = async (notifyEdit: boolean) => {
    if (!owns() || lookup.status === 'LOADING') return;
    retireSearch(); setLookupMode('search'); setPosition(null); setOrigin({ kind: 'MANUAL_PIN' }); invalidate(notifyEdit); setLookup({ status: 'LOADING' });
    if (conversation) { setAddress(''); setPlaceByHand(false); setCorrectionOpen(false); }
    const epoch = requestEpoch.current;
    try {
      const raw = await resolver.search({ text: searchText, countryCode, scopeKey });
      if (!alive.current || !focus.current || current.current.disabled || epoch !== requestEpoch.current) return;
      const result = raw.status === 'PROPOSALS' ? { ...raw, candidates: samePlaceCandidates(searchText, raw.candidates) } : raw;
      setLookup(result.status === 'CANCELLED' ? { status: 'IDLE' } : result);
      // One result can be shown for human confirmation. Multiple results are unresolved:
      // their labels contain no structured city authority, and rank is not a choice.
      // The full form retains its separate explicit candidate selection.
      if (conversation && result.status === 'PROPOSALS' && result.candidates.length === 1) {
        const candidate = result.candidates[0];
        if (candidateFitsSeed(searchText, candidate.label)) {
          const shown = toSerbianLatin(candidate.label);
          setPosition(candidate.position); setOrigin(candidate.origin); setSelectedLabel(shown);
          setAddress(shown);
          setCorrectionOpen(false);
        }
      }
    } catch {
      if (alive.current && focus.current && !current.current.disabled && epoch === requestEpoch.current) setLookup({ status: 'UNAVAILABLE' });
    }
  };
  const search = () => runSearch(true);
  // Automatic chat suggestions are not user edits. They still require explicit confirmation,
  // but dismissing an untouched suggestion must not claim an unsaved manual change.
  // A saved point wins: nothing here may move a point the person already confirmed.
  useEffect(() => {
    if (!autoLocate || located.current || !focused || disabled || point || !searchText.trim()) return;
    located.current = true;
    void runSearch(!conversation);
  }, [autoLocate, focused, disabled, point, searchText]); // eslint-disable-line react-hooks/exhaustive-deps
  const useHere = async () => {
    if (!owns() || hereRequest.current) return;
    retireSearch();
    const request = new AbortController();
    const epoch = requestEpoch.current, owner = sesijaSada();
    hereRequest.current = request;
    setHere('BUSY');
    // The BUSY render must not retire its own observation. The request's intent,
    // focus and account own it; another edit or lookup advances the epoch.
    const ownsRequest = () => alive.current && focus.current && !current.current.disabled && !request.signal.aborted
      && hereRequest.current === request && requestEpoch.current === epoch
      && sesijaSada().user?.id === owner.user?.id && sesijaSada().accountRevision === owner.accountRevision;
    try {
      const result = await captureCurrentLocation(request.signal, ownsRequest);
      if (!ownsRequest()) return;
      hereRequest.current = null;
      if (result.kind === 'POINT') {
        retireSearch(); setPlaceByHand(true);
        // Apply a manual proposal under the live request, not the pre-await render's choose callback.
        // Nothing confirms or saves it until the person presses the existing confirmation.
        setPosition({ latitude: result.point.latitude, longitude: result.point.longitude });
        setOrigin({ kind: 'MANUAL_PIN' }); invalidate();
        return;
      }
      setHere(result.kind === 'CANCELLED' ? null : result.kind === 'DENIED' ? 'DENIED' : 'UNAVAILABLE');
    } finally {
      if (hereRequest.current === request) { hereRequest.current = null; if (alive.current) setHere(null); }
    }
  };
  const reverse = async () => {
    if (!owns() || !position || lookup.status === 'LOADING') return;
    // The full form still requires explicit address adoption. The conversation's
    // retry uses the same draft-only lookup as a completed manual pin movement.
    retireSearch();
    await lookupAddress(position, conversation);
  };
  const selectCandidate = (candidate: LocationResolverCandidate) => {
    if (!owns()) return;
    if (lookupMode === 'reverse') {
      // Selecting the proposed address does not move or confirm the manual pin.
      retireSearch(); setAddress(candidate.label); setSelectedLabel(candidate.label); invalidate(); return;
    }
    const alternatives = conversation && lookup.status === 'PROPOSALS' ? lookup : null;
    retireSearch(); setPosition(candidate.position); setOrigin(candidate.origin); setSelectedLabel(candidate.label); setCorrectionOpen(false);
    if (conversation) setAddress(candidate.label);
    if (alternatives) setLookup(alternatives);
    invalidate();
  };
  const useCandidateAddress = () => {
    if (!owns() || !selectedLabel || !position) return;
    const label = selectedLabel;
    retireSearch(); setAddress(label); invalidate();
  };
  const cancelSearch = () => { if (owns()) { retireSearch(lookupMode === 'search'); if (lookupMode === 'search') invalidate(); } };
  const confirm = () => {
    if (!owns() || !position || lookup.status === 'LOADING') return false;
    const privateAddress = address.trim() ? locationPrivateText(address, 1000) : null;
    const accessNotes = notes.trim() ? locationPrivateText(notes, 2000) : null;
    if (privateAddress === undefined || accessNotes === undefined) { setError(true); return false; }
    const latitudeE6 = Math.round(position.latitude * 1e6), longitudeE6 = Math.round(position.longitude * 1e6);
    if (!Number.isSafeInteger(latitudeE6) || !Number.isSafeInteger(longitudeE6)
      || Math.abs(latitudeE6) > 90e6 || Math.abs(longitudeE6) > 180e6) { setError(true); return false; }
    retireSearch();
    onConfirm({ slot, latitudeE6, longitudeE6, origin,
      ...(privateAddress !== null ? { address: privateAddress } : {}), ...(accessNotes !== null ? { accessNotes } : {}) });
    setPending(false); setError(false); return true;
  };
  const correct = () => {
    if (!owns() || lookup.status === 'LOADING') return false;
    // Retire a second activation synchronously, without cancelling the pin or lookup results.
    renderEpoch.current++; setCorrectionOpen(true); return true;
  };
  const alternatives = lookup.status === 'PROPOSALS' ? lookup.candidates : [];
  const weakSingleProposal = !position && lookupMode === 'search' && alternatives.length === 1
    && !candidateFitsSeed(searchText, alternatives[0].label);
  const promptLabel = address.trim() || selectedLabel || point?.address || 'Tačka izabrana na mapi';
  const phase: DialogueContext['phase'] = position ? 'PROPOSAL'
    : lookupMode === 'search' && alternatives.length > 1 ? 'AMBIGUOUS' : 'UNRESOLVED';
  const pointQuestion = `Da li je ovo ${title.toLocaleLowerCase()}?`;
  const clarificationQuestion = `Gde tačno je ${title.toLocaleLowerCase()}? Dopuni opis ili označi tačku na mapi.`;
  const promptAlternatives = phase === 'AMBIGUOUS' ? alternatives.slice(0, 3) : [];
  // Incarnations, not coordinate equality: A→B→A cannot revive a reply to an older pin.
  const promptToken = useMemo(noviUuidZahtevId, [scopeKey, position, origin, address, notes, searchText, lookup, candidatePage]);
  const proposalId = useMemo(noviUuidZahtevId, [scopeKey, position, origin, address, notes]);
  const currentPrompt = useRef(promptToken); currentPrompt.current = promptToken;
  const latestActions = useRef({ confirm, correct }); latestActions.current = { confirm, correct };
  const acquire = (): PointPromptLease | null => {
    if (!conversation || !owns() || lookup.status === 'LOADING' || hereRequest.current) return null;
    const owner = sesijaSada(), lease = {};
    replyLease.current = lease; setReplyLocked(true);
    const isCurrent = () => alive.current && focus.current && !current.current.disabled && replyLease.current === lease
      && currentPrompt.current === promptToken && sesijaSada().user?.id === owner.user?.id
      && sesijaSada().accountRevision === owner.accountRevision;
    const cancel = () => {
      if (replyLease.current !== lease) return;
      replyLease.current = null; if (alive.current) setReplyLocked(false);
    };
    const act = (kind: 'confirm' | 'correct') => {
      if (!isCurrent() || (kind === 'confirm' && !position)) return false;
      cancel(); // Release only this lock; the normal latest-render action retains every existing validation.
      return latestActions.current[kind]();
    };
    return { isCurrent, cancel, confirm: () => act('confirm'), correct: () => {
      if (!isCurrent()) return false;
      // The decision can open correction while the normal-turn readback still holds interaction locked.
      setCorrectionOpen(true); return true;
    } };
  };
  const promptChanged = useRef(onPromptReady); promptChanged.current = onPromptReady;
  useEffect(() => {
    promptChanged.current?.(conversation && focused && !disabled && lookup.status !== 'LOADING' ? {
      context: { version: 1, promptToken, phase,
        question: phase === 'PROPOSAL' ? pointQuestion : phase === 'AMBIGUOUS' ? clarificationQuestion : `Gde je ${title.toLocaleLowerCase()}?`,
        query: searchText.slice(0, 1000),
        proposal: position ? { id: proposalId, label: promptLabel.slice(0, 1000) } : null,
        alternatives: promptAlternatives.map((candidate, index) => ({ id: `${promptToken}:${index}`, label: candidate.label.slice(0, 1000) })) },
      acquire,
    } : null);
  });
  useEffect(() => () => { replyLease.current = null; promptChanged.current?.(null); }, []);
  if (conversation) {
    const loading = lookup.status === 'LOADING';
    const alternatives = lookup.status === 'PROPOSALS' ? lookup.candidates : [];
    const ambiguous = !position && lookupMode === 'search' && alternatives.length > 1;
    const contextOnly = weakSingleProposal;
    const streetContextOnly = contextOnly && alternatives.length === 1
      && candidateProvidesStreetContext(searchText, alternatives[0].label);
    // Ambiguous results and a weak single fallback are camera context only. A street-level
    // fallback may zoom close enough to read the street name, but still draws no pin and grants
    // no confirmation until the person touches/moves the point.
    const providerCameraHint = ambiguous || contextOnly ? alternatives.map(candidate => ({ ...candidate.position })) : undefined;
    const shownCameraHint = position ? undefined : cameraHint ?? providerCameraHint;
    const lastCandidatePage = Math.max(0, Math.ceil(alternatives.length / 3) - 1);
    const visibleCandidates = alternatives.slice(candidatePage * 3, candidatePage * 3 + 3);
    const expandedPlace = address.trim() || selectedLabel || initialQuery.trim() || 'Tačka na mapi';
    const lookupMessage = contextOnly
      ? 'Nismo našli dovoljno preciznu tačku za opis iz razgovora. Mapa je samo orijentir — dodirni tačno mesto ili ispravi opis.'
      : lookup.status === 'PROPOSALS' ? 'Mesto nije pronađeno. Obeleži ga na mapi ili ispravi opis u razgovoru.'
      : lookup.status === 'RATE_LIMITED' ? 'Previše pretraga za kratko vreme. Obeleži mesto na mapi ili probaj kasnije.'
        : lookup.status === 'INVALID_QUERY' ? 'Mesto iz razgovora nije dovoljno jasno. Obeleži ga na mapi ili ispravi opis.'
          : lookup.status === 'PROVIDER_ACTIVATION_BLOCKED' ? 'Pretraga mesta nije dostupna. Obeleži mesto na mapi.'
            : 'Pretraga mesta nije uspela. Obeleži ga na mapi ili ispravi opis u razgovoru.';
    return <View style={{ gap: sys.space.sm }}>
      {!position ? <View style={{ gap: sys.space.xs }}>
        {conversationSummary?.title === title ? null : <T variant="meta" tone="muted">{title}</T>}
        <T variant="note" tone="muted" accessibilityLiveRegion="polite">{loading
          ? 'Tražimo mesto iz razgovora…' : ambiguous
            ? clarificationQuestion : contextOnly
              ? 'Tačna tačka nije pronađena. Dodirni pravo mesto na mapi ili ispravi opis.'
              : 'Dopuni opis mesta ili ga označi na mapi.'}</T>
        {initialQuery && conversationSummary?.description !== initialQuery
          ? <T variant="note" tone="muted">Opis iz razgovora: {initialQuery}</T> : null}
      </View> : null}
      {!position && !loading && !ambiguous && !contextOnly && lookup.status !== 'IDLE' ? <T variant="meta" tone="muted">
        {lookupMessage}
      </T> : null}
      {ambiguous && onCorrectInConversation ? <Button tone="neutral" label="Dopuni mesto u razgovoru" kind="secondary"
        disabled={controlDisabled || !focused} onPress={() => { if (owns()) onCorrectInConversation(); }} /> : null}
      {!position && !placeByHand && !loading && !ambiguous && !contextOnly ? <Button tone="neutral" label="Označi na mapi" kind="quiet"
        disabled={controlDisabled || !focused} onPress={() => {
          if (!owns()) return;
          const context = lookupMode === 'search' && lookup.status === 'PROPOSALS'
            ? lookup.candidates.map(candidate => ({ ...candidate.position })) : undefined;
          retireSearch(); setCameraHint(context?.length ? context : undefined); setPlaceByHand(true);
        }} /> : null}
      {position || placeByHand || ambiguous || contextOnly ? <>
        <ResolvedPinMap position={position} cameraHint={shownCameraHint}
          cameraHintZoom={streetContextOnly ? 16.5 : undefined} onChoose={choose} scopeKey={scopeKey}
          disabled={controlDisabled || !focused} height={156} compact />
        <Button tone="neutral" label="Uvećaj mapu" accessibilityLabel={`Uvećaj mapu za: ${title}`} kind="quiet"
          disabled={controlDisabled || !focused} onPress={() => { if (owns()) setExpandedMap(true); }} />
        <Modal visible={expandedMap} animationType="slide" onRequestClose={() => { if (owns()) setExpandedMap(false); }}>
          <SafeAreaView style={editorStyles.fullScreen} edges={['top', 'bottom']} accessibilityViewIsModal>
            <View style={editorStyles.fullHeader}>
              <View style={editorStyles.fullHeaderCopy}>
                <T variant="meta" tone="muted">{title}</T>
                <T accessibilityRole="header" variant="title" style={editorStyles.fullTitle}>Podesi tačno mesto</T>
              </View>
              <Button tone="neutral" label="Zatvori" kind="quiet" onPress={() => { if (owns()) setExpandedMap(false); }} />
            </View>
            <View style={editorStyles.fullMap}>
              <ResolvedPinMap position={position} cameraHint={shownCameraHint}
                cameraHintZoom={streetContextOnly ? 16.5 : undefined} onChoose={choose} scopeKey={`${scopeKey}:expanded`}
                disabled={controlDisabled || !focused} compact fill />
            </View>
            <View style={editorStyles.fullFooter}>
              {position ? <>
                <T variant="bodyStrong" style={editorStyles.fullTitle}>{pointQuestion}</T>
                <T variant="note" tone="muted" accessibilityLiveRegion="polite">{lookup.status === 'LOADING' && lookupMode === 'reverse'
                  ? 'Čitamo adresu za izabrani pin…' : expandedPlace}</T>
                <T variant="note" tone="muted">Dodirni mapu ili prevuci pin ako želiš preciznije mesto.</T>
                <Button tone="neutral" label={`Da, ovo je ${title.toLocaleLowerCase()}`} accessibilityLabel={`Potvrdi tačku: ${title}`}
                  kind="secondary" style={brandAction} disabled={controlDisabled || !focused || lookup.status === 'LOADING'}
                  onPress={() => { if (confirm()) setExpandedMap(false); }} />
              </> : <>
                <T variant="bodyStrong" style={editorStyles.fullTitle}>Označi tačno mesto</T>
                <T variant="note" tone="muted">Uvećaj ulicu po potrebi i dodirni mesto na mapi. Pin ostaje privatan dok ga ne potvrdiš.</T>
              </>}
            </View>
          </SafeAreaView>
        </Modal>
      </> : null}
      {position ? <>
        <T variant="bodyStrong" accessibilityLiveRegion="polite" style={{ color: sys.color.ink }}>{pointQuestion}</T>
        {loading && lookupMode === 'reverse' ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">Tražimo adresu za izabrani pin…</T> : null}
        {!loading && lookupMode === 'reverse' && lookup.status !== 'IDLE'
          && (lookup.status !== 'PROPOSALS' || lookup.candidates.length === 0) ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">
          Adresa nije određena. Tačka je ostala tamo gde je izabrana.
        </T> : null}
        {correctionOpen ? <LocationField label={`${title} — adresa za ovaj pin (opciono)`} value={address} maxLength={1000}
          editable={!controlDisabled && focused} onChangeText={value => {
            if (owns()) { retireSearch(); setAddress(value); invalidate(); }
          }} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sys.space.sm }}>
          <Button tone="neutral" label={`Da, ovo je ${title.toLocaleLowerCase()}`} accessibilityLabel={`Potvrdi tačku: ${title}`} kind="secondary"
            style={confirmAsPrimary ? { ...brandAction, flex: 1 } : { flex: 1 }} disabled={controlDisabled || !focused || loading} onPress={confirm} />
          <Button tone="neutral" label={correctionOpen ? 'Završi izmenu' : 'Nije tu'} kind="quiet"
            disabled={controlDisabled || !focused} onPress={() => {
              if (correctionOpen) { if (owns()) setCorrectionOpen(false); }
              else if (correct()) setExpandedMap(true);
            }} />
        </View>
      </> : null}
      {correctionOpen ? <>
        <T variant="note" tone="muted">Pomeri pin ili dodirni tačno mesto, pa potvrdi.</T>
        {alternatives.length > 1 ? visibleCandidates.map((candidate, index) => <Button tone="neutral"
          key={`${candidate.origin.candidateHint ?? 'candidate'}:${candidatePage * 3 + index}`} label={candidate.label}
          accessibilityLabel={`Izaberi predlog: ${candidate.label}`} kind="secondary"
          disabled={controlDisabled || !focused} onPress={() => selectCandidate(candidate)} />) : null}
        {alternatives.length > 3 ? <View style={{ gap: sys.space.xs }}>
          <T variant="meta" tone="muted" accessibilityLiveRegion="polite">Predlozi {candidatePage * 3 + 1}–{Math.min(alternatives.length, candidatePage * 3 + 3)} od {alternatives.length}</T>
          {candidatePage > 0 ? <Button tone="neutral" label="Prethodni predlozi" kind="quiet" disabled={controlDisabled || !focused}
            onPress={() => { if (owns()) setCandidatePage(page => Math.max(0, page - 1)); }} /> : null}
          {candidatePage < lastCandidatePage ? <Button tone="neutral" label="Još predloga" kind="quiet" disabled={controlDisabled || !focused}
            onPress={() => { if (owns()) setCandidatePage(page => Math.min(lastCandidatePage, page + 1)); }} /> : null}
        </View> : null}
      </> : null}
      {!ambiguous && (correctionOpen || !position) && onCorrectInConversation ? <Button tone="neutral" label="Ispravi u razgovoru" kind="quiet"
        disabled={controlDisabled || !focused} onPress={() => { if (owns()) onCorrectInConversation(); }} /> : null}
      {lookup.status === 'PROPOSALS' ? <Press accessibilityRole="link" accessibilityLabel="Pretraga: LocationIQ · izvori podataka"
        onPress={() => { void Linking.openURL('https://locationiq.com/attribution').catch(() => {}); }}
        style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <T variant="meta" tone="muted">Pretraga: LocationIQ · izvori podataka</T>
      </Press> : null}
      {error ? <T accessibilityRole="alert" tone="danger">Proveri izabranu tačku i privatne podatke.</T> : null}
    </View>;
  }
  // No box of its own: the point sits in the form's "Samo u Dogovoru" group, and the conversation's sheet is already a
  // surface (a card here was a card in a card).
  return <View style={{ gap: sys.space.md }}>
    <T variant="bodyStrong">{title} na mapi</T>
    <T variant="meta" tone="muted">Izaberi tačno mesto i potvrdi ga. Tačka i detalji ispod ostaju privatni.</T>
    <LocationField label={`${title} — pronađi mesto`} value={searchText} maxLength={1000} editable={!controlDisabled && focused} onChangeText={changeSearch} />
    <Button label={lookup.status === 'LOADING' ? 'Tražimo mesto…' : lookup.status === 'UNAVAILABLE' ? 'Pokušaj ponovo' : 'Pronađi na mapi'}
      kind="secondary" disabled={controlDisabled || !focused || !searchText.trim() || !countryCode || lookup.status === 'LOADING'} onPress={search} />
    {autoLocate ? <Button label={here === 'BUSY' ? 'Tražimo gde si…' : 'Koristi gde sam'} kind="quiet"
      disabled={controlDisabled || !focused || here === 'BUSY'} onPress={useHere} /> : null}
    {here === 'DENIED' ? <T variant="meta" accessibilityRole="alert">Pristup lokaciji nije dozvoljen. Možeš ga dozvoliti u podešavanjima ili upisati mesto iznad.</T> : null}
    {here === 'UNAVAILABLE' ? <T variant="meta" accessibilityRole="alert">Ne mogu da očitam gde si. Upiši mesto iznad ili izaberi tačku na mapi.</T> : null}
    {lookup.status === 'LOADING' ? <T variant="meta" accessibilityLiveRegion="polite">Tražimo predloge za uneto mesto…</T> : null}
    {lookup.status === 'PROVIDER_ACTIVATION_BLOCKED' ? <T variant="meta" accessibilityLiveRegion="polite">Pretraga mesta još nije aktivirana. Tačku izaberi dodirom na mapi.</T> : null}
    {lookup.status === 'UNAVAILABLE' ? <T variant="meta" accessibilityRole="alert">Predlozi trenutno nisu dostupni. Pokušaj ponovo ili izaberi tačku na mapi.</T> : null}
    {lookup.status === 'RATE_LIMITED' ? <T variant="meta" accessibilityRole="alert">Previše pretraga za kratko vreme. Sačekaj pa pokušaj ponovo ili izaberi tačku na mapi.</T> : null}
    {lookup.status === 'INVALID_QUERY' ? <T variant="meta" accessibilityRole="alert">Unesi mesto i proveri izabranu državu.</T> : null}
    {lookup.status === 'PROPOSALS' && lookup.candidates.length === 0 ? <T variant="meta" accessibilityLiveRegion="polite">{lookupMode === 'reverse'
      ? 'Adresa za ovu tačku nije pronađena. Upiši je ručno.' : 'Nema predloga za uneti tekst. Preciziraj mesto ili izaberi tačku na mapi.'}</T> : null}
    {/* Each proposal is the address itself, on a white row with a pin; what the tap does is its spoken name. */}
    {lookup.status === 'PROPOSALS' ? lookup.candidates.map((candidate, index) => <Button
      key={`${candidate.origin.candidateHint ?? 'candidate'}:${index}`} label={candidate.label}
      accessibilityLabel={`${lookupMode === 'reverse' ? 'Koristi privatnu adresu' : 'Izaberi predlog'}: ${candidate.label}`}
      icon={<FactArt kind="pin" size={18} />} style={{ justifyContent: 'flex-start' }}
      kind="secondary" disabled={controlDisabled || !focused} onPress={() => selectCandidate(candidate)} />) : null}
    {lookup.status === 'PROPOSALS' ? <Press accessibilityRole="link" accessibilityLabel="Pretraga: LocationIQ · izvori podataka"
      onPress={() => { void Linking.openURL('https://locationiq.com/attribution').catch(() => {}); }}
      style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <T variant="meta" tone="muted">Pretraga: LocationIQ · izvori podataka</T>
    </Press> : null}
    {/* The address the person is about to confirm is content, not a caption: body size, readable. */}
    {selectedLabel ? <T variant="body">Predlog za proveru: <T variant="bodyStrong">{selectedLabel}</T></T> : null}
    {selectedLabel && selectedLabel !== address.trim() ? <Button label="Koristi predlog kao privatnu adresu" kind="quiet"
      disabled={controlDisabled || !focused} onPress={useCandidateAddress} /> : null}
    {/* After a suggestion is applied there is no search in flight, so "Otkaži pretragu" was really
        "delete the pin I just chose", under a name that promised the opposite. */}
    {lookup.status !== 'IDLE' ? <Button label="Otkaži pretragu" kind="quiet" disabled={controlDisabled || !focused} onPress={cancelSearch} /> : null}
    {lookup.status === 'IDLE' && selectedLabel ? <Button label="Ukloni izabranu tačku" kind="quiet" disabled={controlDisabled || !focused} onPress={cancelSearch} /> : null}
    {!autoLocate || position || placeByHand
      ? <ResolvedPinMap position={position} onChoose={choose} scopeKey={scopeKey} disabled={controlDisabled || !focused} />
      : <Button label="Izaberi tačku na mapi" kind="quiet" disabled={controlDisabled || !focused}
        onPress={() => setPlaceByHand(true)} />}
    {position ? <Button label={lookupMode === 'reverse' && lookup.status === 'LOADING' ? 'Tražimo adresu…' : 'Pronađi adresu za ovaj pin'}
      kind="quiet" disabled={controlDisabled || !focused || lookup.status === 'LOADING'} onPress={reverse} /> : null}
    <LocationDetails label={`${title} — privatni detalji tačke`} disabled={controlDisabled || !focused}
      summary={[address, notes].filter(value => value.trim()).join(' · ') || 'Dodaj adresu ili napomenu po potrebi'}>
    <LocationField label={`${title} — privatna adresa (opciono)`} value={address} maxLength={1000} editable={!controlDisabled && focused}
      onChangeText={value => { if (owns()) { retireSearch(); setAddress(value); invalidate(); } }} />
    <LocationField label={`${title} — privatne napomene za pristup (opciono)`} value={notes} maxLength={2000} multiline editable={!controlDisabled && focused}
      onChangeText={value => { if (owns()) { retireSearch(); setNotes(value); invalidate(); } }} />
    </LocationDetails>
    {error ? <T accessibilityRole="alert" tone="danger">Proveri izabranu tačku i privatne podatke.</T> : null}
    {/* The line beside the confirm button says why it is grey while there is no point to confirm. */}
    <T variant="meta" tone={point && !pending ? 'success' : 'muted'}>
      {point && !pending ? 'Tačka je potvrđena u ovom obrascu.'
        : pending ? `Izmena tačke još nije potvrđena.${position ? '' : ' Izaberi tačku na mapi ili predlog iz pretrage.'}`
          : position ? 'Tačka još nije potvrđena.' : 'Izaberi tačku na mapi ili predlog iz pretrage, pa je potvrdi.'}
    </T>
    <Button label={`Potvrdi tačku: ${title}`} kind="secondary" style={confirmAsPrimary ? brandAction : undefined} disabled={controlDisabled || !focused || !position || lookup.status === 'LOADING'} onPress={confirm} />
  </View>;
}

const editorStyles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: sys.color.surface },
  fullHeader: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingHorizontal: sys.space.lg,
    paddingVertical: sys.space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  fullHeaderCopy: { flex: 1, minWidth: 0, gap: 2 },
  fullTitle: { color: sys.color.ink },
  fullMap: { flex: 1, paddingHorizontal: sys.space.sm, paddingTop: sys.space.sm },
  fullFooter: { gap: sys.space.sm, paddingHorizontal: sys.space.lg, paddingTop: sys.space.md, paddingBottom: sys.space.base,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.line, backgroundColor: sys.color.surface },
});
