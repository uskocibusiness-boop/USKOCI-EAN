import type { WorkAreaCamera } from '../../data/discoveryWorkArea';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated as NativeAnimated, BackHandler, Easing, Keyboard, Platform, StyleSheet, View, useWindowDimensions, type ListRenderItemInfo,
  type CellRendererProps, type NativeScrollEvent, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurTargetView } from 'expo-blur';
import { useIsFocused } from 'expo-router';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { State as GestureState } from 'react-native-gesture-handler';
import { ANIMATION_STATUS, BottomSheetFlatList, SCROLLABLE_STATUS, SHEET_STATE, useBottomSheetInternal, useScrollEventsHandlersDefault,
  type BottomSheetFlatListMethods, type ScrollEventsHandlersHookType } from '@gorhom/bottom-sheet';
import { Crosshair } from 'phosphor-react-native';
import { atLeast, dateRange, discoveryConditions, discoveryFiltered, discoveryMapScope, discoveryShown, discoveryStartSnap, initialMarketplaceView, openPlaces,
  pinPlaces, placeKey, pointKey, publicInitialBounds, publicPoint, remoteDiscoveryScope, sameBounds, saysWhen, saysWorkMode, undatedCount, workMode, type DiscoveryShown,
  type DiscoverySnap, type MarketplaceItem, type MarketplaceView, type PublicBounds, type WhenFilter } from '../../data/marketplaceView';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { Appear, useAppear } from '../system/Appear';
import { ActionSheet } from '../system/ActionSheet';
import { useReducedMotion } from '../system/motion';
import { zadataka } from '../system/plural';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { DiscoveryMap } from './DiscoveryMap';
import type { DiscoveryV1ServerMapSeam } from './DiscoveryMap.types';
import type { DiscoveryV1Availability, DiscoveryV1Counts } from '../../data/discoveryV1Contract';
import { DiscoveryListSheet, SNAP } from './discovery/DiscoveryListSheet';
import { DiscoveryPeek } from './discovery/DiscoveryPeek';
import { DiscoveryListState, type DiscoveryListStateKind } from './discovery/DiscoveryListState';
import { BAR_TOP, DiscoverySearchBar, ForMeNotice, NearbyNotice } from './discovery/DiscoverySearchBar';
import { DiscoveryChipRow, type QuickChip, type ScopeKey } from './discovery/DiscoveryChipRow';
import { CONTROL_SIZE, fullSheetTop } from './discovery/mapClearBand';
import { useCoverValue, useRidingStyle } from './discovery/mapControls';
import { handleHint, listViewport, nextSheetIndex, snapHeights } from './discovery/sheetSnaps';
import { TaskAgeContext, taskAgeOf, type PublishedAt } from './discovery/taskAge';
import { useNearbyMap } from './discovery/useNearbyMap';
import { DiscoverySearchPanel, type DiscoveryV1SearchPanelSeam, type SearchApplyOptions, type SearchDraft, type SearchReadiness, type SearchStep } from './discovery/DiscoverySearchPanel';
import { CLEAR_ALL, FOR_ME_REFUSED, NEWEST_FIRST, PRICE, QUICK_WHEN, WHEN, WHERE, WORK_PROFILE_ENTRY, conditionsWords, countLineWords, countWords, datesWords, placesWords,
  quoted, removeWords, said, undatedWords, whereWords } from './discovery/discoveryWords';
import { TaskCard } from './TaskCard';
import type { TaskCardRelation } from './TaskFace';
import type { TaskRelationIndex } from '../../data/taskRelation';
import { TaskPublisherPortrait } from './TaskPublisherPortrait';

/** Internal DEV diagnosis. Route owns the exact package/query gate, numeric validation and 120-event limit. */
export type DiscoveryTrace = (event: 'route-trace' | 'route-focus' | 'route-blur' | 'route-open' | 'route-view' | 'focus' | 'blur'
  | 'preopen' | 'write-offset' | 'seed' | 'ready' | 'geometry' | 'index' | 'content' | 'layout' | 'restore-check'
  | 'clamp0' | 'request' | 'ack' | 'scroll0' | 'scroll' | 'scroll-reject' | 'search-change' | 'drag' | 'refresh' | 'kick' | 'stall' | 'want' | 'fit',
  ...values: (number | boolean)[]) => void;

export type DiscoveryV1PresentationSeam = {
  /** Server MAP geometry; legacy client GeoJSON clustering is bypassed only while this quarantined seam is supplied. */
  map: Omit<DiscoveryV1ServerMapSeam, 'onClear'>;
  /** Exact TASK or bounded POINT_MEMBERS rows already owned by the P6 screen session. */
  peek: { key: string; item: MarketplaceItem | null; place: readonly MarketplaceItem[] } | null;
  /** Exact live PAGE counts; loaded rows may be only the first bounded pages. */
  counts: DiscoveryV1Counts | null;
  /**
   * What the server says about every published task (not the loaded page): whether any names its work mode or its days, and which price modes exist.
   * The quick chips are offered from it, so they do not come and go as the map moves. Null until a page has been read.
   */
  availability?: DiscoveryV1Availability | null;
  /**
   * When each task of the loaded page was published, by id (the page rows' own `publishedAt`). The list is ordered by it, newest first, and a card
   * may ask how old its task is (`useTaskAge`); a task not in it has no age.
   */
  published?: PublishedAt;
  /** Server-owned draft count/locality facets. Loaded PAGE rows are never used as its fallback. */
  search?: DiscoveryV1SearchPanelSeam;
  pageHasMore: boolean;
  loadingMore?: boolean;
  /** A settled move of the person's own: `bounds` is what they can see (the list's area), `frame` the map's whole view (its buckets). */
  onArea: (bounds: PublicBounds, frame?: PublicBounds) => void;
  onClearPeek: () => void;
  onShowPlace: () => void;
  onShowAll: () => void;
  onNextPage: () => void;
  /** The list shows rows `first` to `last` (indexes of `items`), so their optional details can be read. */
  onVisibleRange?: (first: number, last: number) => void;
};

export type DiscoveryPresentationProps = { items: readonly MarketplaceItem[]; loading: boolean; refreshing?: boolean; error: boolean;
  /** An exact published row can be shown while the independent collection is incomplete. */
  collectionStatus?: 'loading' | 'error';
  /** One-shot locality fallback, never a filter, task point or GPS marker. */
  initialWorkArea?: WorkAreaCamera | null; onInitialWorkAreaHandled?: (key: string) => void;
  /** P6 task-detail return only. Native map still requires ready state and a retired interaction lease. */
  canRetainMap?: () => boolean;
  scopeKey: string; view: MarketplaceView; onView: (value: MarketplaceView) => void; onRefresh: () => void;
  /** Explicit interaction supersedes an automatic publication landing still waiting for its read. */
  onUserIntent?: () => void;
  onOpen: (item: MarketplaceItem) => void; onProfile: () => void; onNew?: () => void; onNotifications?: () => void;
  /** A confirmed publication, resolved against a fresh public list by the route. */
  publicationFocus?: { token: string; id: string; kind: 'map' | 'list' };
  publicationUnavailable?: 'missing' | 'error'; onOpenPublishedTask?: () => void;
  /** Account-owned answers, only for the IDs the read covered. Missing coverage remains UNKNOWN. */
  relations?: TaskRelationIndex;
  /** These labels do not delay public rows, counts, map fit or the sheet's initial position. */
  relationsPending?: boolean; relationsError?: boolean;
  /** P6-only presentation seam. No production route supplies this until rollout/native gates explicitly close. */
  p6Seam?: DiscoveryV1PresentationSeam;
  /**
   * "Za mene" (the tasks that match the person's own work profile; R28): the server has the filter key (DISCOVERY-ZAMENE), and the switch "Svi zadaci | Za mene"
   * is drawn only when the route says it exists in this build (`forMeAvailable`), because a control that does nothing is not shown. The scope is the view's own
   * `forMe` unless the route owns one (`scope` and `onScope`). `forMeRefused` is set when the server refused it (no active work profile): the switch is already
   * back off, and a line under the search says why, with `onWorkProfile` as the way out and `onDismissForMeRefused` as its close.
   */
  forMeAvailable?: boolean; scope?: ScopeKey; onScope?: (scope: ScopeKey) => void;
  forMeRefused?: boolean; onWorkProfile?: () => void; onDismissForMeRefused?: () => void;
  /**
   * M-02 (UI/UX pass 2026-10-08): the list is drawn for the first time after a skeleton, so its first rows are news: the first few (at most six) arrive once, and a warm return
   * (rows kept from the last visit) or a filter that changes the rows stays still. When the route does not say, a presentation that mounted while it was still reading is the one.
   */
  arriveAfterLoading?: boolean;
  trace?: DiscoveryTrace };

const GAP = sys.space.md;
/** The search pill's lower edge before it has been measured: its distance from the top and its one row. */
const TOOLS_ESTIMATE = BAR_TOP + 56;
/** The room the row of chips takes over the map (list lowered) before it is measured: one row of chips and the gap above it. */
const CHIPS_ROOM_ESTIMATE = sys.space.sm + 48;
/** The row of chips as the list sheet's sticky header, before it is measured: a 48 chip with the air it needs above and below. */
const CHIP_BAR_ESTIMATE = 58;
/**
 * How far the list has to rise from its lowest stop before the chips over the map are gone and only the ones in the sheet's header
 * are left: on the UI thread, from the sheet's own position, so the two rows never show together for long.
 */
const CHIPS_HANDOFF = 48;
/** The sheet's top line before it has been measured: the grab bar and one line of count. */
const PEEK_ESTIMATE = 68;
/**
 * While a pin's card covers the bottom of the map, the list sheet sinks to this sliver behind it (Discovery V47): its top
 * line is not a second strip under the card. Closing the card brings the top line back.
 */
export const HIDDEN = 1;
/** The pin card's gap above the bottom of the screen, which ends where the tab bar begins: it sits just above the bar. */
const CARD_BOTTOM = sys.space.md;
/** The list scrolled at least this far is scrolled (said in the diagnosis only: the chips never fold away, they are the sheet's sticky header). */
const SCROLLED = 8;
/** How long after the list stops moving its offset is written into the route's view, to be found again on return. */
export const OFFSET_SETTLE_MS = 250;
/** How long the list's area stays still before iOS VoiceOver hears the new count (Android hears it by the live region). */
export const AREA_ANNOUNCE_MS = 1000;
const Separator = () => <View style={s.separator} />;
/** What the list says while the next page is read (UX plan 2.16: a list of a thousand tasks is read page by page). */
export const PAGING_WORDS = 'Učitavamo još zadataka…';
const keyOf = (item: MarketplaceItem) => item.id;
/** Cells scrolled out of view are detached on Android; iOS gains nothing from it. Rows here hold no text input. */
const CLIP_OFFSCREEN = Platform.OS === 'android';
const INDEX = { peek: SNAP.peek, half: SNAP.half, full: SNAP.full } as const;
/** When the P6 sheet is nudged after it mounts (the last one is an even count, so it rests on its exact snap points), and by how much. */
const SHEET_KICKS_MS = [400, 1_200, 2_600, 5_000, 8_000, 12_000] as const;
const SHEET_KICK_PX = 0.01;
/**
 * A restore that has not been acknowledged is given this long to see the list grow or to hear the native list. Then, in this order: the same request again (React Native's
 * layout can be ahead of the native content, and a scroll past the native end lands there without any later event, also for the last exact request), the tail (`scrollToEnd`
 * renders the rows the estimate stops short of; asked only while the target is NOT reachable, since it would overshoot a reachable saved offset), and finally it settles: on
 * the saved offset when it was reachable, else where the list is.
 */
export const RESTORE_STALL_MS = 4_000;
const RESTORE_STALL_RETRIES = 2;
const SNAP_NAME: readonly DiscoverySnap[] = ['peek', 'half', 'full'];
/** Nothing to show yet (reading) or at all (a failed read). */
const NOTHING: DiscoveryShown = { mapped: [], inArea: [], withoutPoint: [], listed: [] };
type ListSection = { kind: 'map' | 'remote' | 'unlocated'; label: string; count: number };
const listKind = (item: MarketplaceItem): ListSection['kind'] => publicPoint(item) ? 'map' : workMode(item) === 'remote' ? 'remote' : 'unlocated';

const DiscoveryRow = memo(function DiscoveryRow({ item, index, animate, relation, onOpen, section, portraitVisible }: {
  item: MarketplaceItem; index: number; animate: boolean; relation?: TaskCardRelation; onOpen: (item: MarketplaceItem) => void;
  portraitVisible: boolean;
  /** A real work/location group; missing public geography is not a claim of remote work. */
  section?: ListSection;
}) {
  const open = useCallback(() => onOpen(item), [onOpen, item]);
  return <>
    {section ? <View testID={`section-${section.kind}`} accessible accessibilityRole="header"
      accessibilityLabel={`${section.label}, ${zadataka(section.count)}`} style={s.section}>
      <T variant="bodyStrong" style={s.sectionTitle}>{section.label}</T><T variant="meta" style={s.sectionCount}>{section.count}</T>
    </View> : null}
    <Appear index={index} animate={animate}><TaskCard item={item} onOpen={open} relation={relation}
      portrait={portraitVisible ? <TaskPublisherPortrait item={item} size={40} /> : undefined} /></Appear>
  </>;
});

/**
 * Zadaci as one screen (owner step 4, 2026-09-24; critique A5–A7, B8–B12; Discovery V47, Airbnb's interaction in
 * USKOČI's look). Search is the screen's header. Over the map floats one white pill that says
 * the search in two lines and opens the search panel, "Uslovi pretrage", a menu of secondary destinations, and quick chips that
 * toggle real filters at once (they fold away while the whole list is up and scrolled well past them).
 *
 * The list is a sheet over the map with three heights, and it follows the map: after the person's own move settles, the
 * list holds what the map shows, then, under a quiet "Bez tačke na mapi", every task that has no point at all, which an
 * area can never leave out. The camera's own moves never change what is listed. A place's "Prikaži sve u listi" narrows
 * the list to exactly that point instead. The search pill says either narrowing and carries its "×" back to every task.
 * The sheet's top line says honestly how many tasks there are (never blank: while the list is read it says so) and is
 * itself the button that opens the list; at the full height a floating "Mapa" brings the same map back, as does Android
 * Back. It starts half open when the map cannot show most of the tasks or there are few, and at its top line otherwise;
 * where it rests, how far the list is scrolled and where the camera stands are kept in the route's view. Choosing a pin
 * opens one floating card for it, over the sheet's top line, which steps out of sight (and out of a screen reader's
 * reach) behind it. An empty list under the map rests at half the screen at most, so its own green action and the green
 * "Mapa" are never on screen together.
 *
 * Own tasks remain visible with "Tvoj zadatak"; applied and unknown relationships are labeled distinctly.
 * Presentation only: every callback is the route's own guarded command.
 */
// Observe the newly mounted sheet's own state, not the previous visit's exported position or a requested index.
// Gorhom 5.2.14 locks scroll to zero until EXTENDED/FILL_PARENT; issuing scrollToOffset earlier loses the restore.
type NativeScrollWitness = { extent: number; offset: number; dragging: boolean; momentum: boolean };
type NativeListSnapshot = { ready: boolean; canRestore: boolean; gestureStarted: boolean; state: number; settledIndex: number; offset: number; command: number };
const NativeScrollContext = createContext<{ extent: number; witness: SharedValue<NativeScrollWitness> } | null>(null);
const useDiscoveryScrollEvents: ScrollEventsHandlersHookType = (ref, contentOffset) => {
  const defaults = useScrollEventsHandlersDefault(ref, contentOffset);
  const probe = useContext(NativeScrollContext)!;
  const { extent, witness } = probe;
  const { animatedSheetState, animatedScrollableStatus } = useBottomSheetInternal();
  const observe = useCallback((event: NativeScrollEvent, dragging?: boolean, momentum?: boolean) => {
    'worklet';
    const ready = animatedSheetState.value === SHEET_STATE.EXTENDED || animatedSheetState.value === SHEET_STATE.FILL_PARENT;
    const y = event.contentOffset.y;
    // A LOCKED handler may itself scroll to another position: its incoming y is not evidence of that result.
    witness.value = { extent, offset: ready && animatedScrollableStatus.value === SCROLLABLE_STATUS.UNLOCKED && Number.isFinite(y)
      ? Math.max(0, y) : -1, dragging: dragging ?? witness.value.dragging, momentum: momentum ?? witness.value.momentum };
  }, [extent, witness, animatedSheetState, animatedScrollableStatus]);
  // Preserve every Gorhom handler and its context. This witness reads actual native deliveries, including hidden
  // ones; animatedScrollableState.contentOffsetY is only updated at drag/momentum boundaries in Gorhom 5.2.14.
  return useMemo<ReturnType<ScrollEventsHandlersHookType>>(() => ({
    handleOnScroll: (event, context) => { 'worklet'; defaults.handleOnScroll?.(event, context); observe(event); },
    handleOnBeginDrag: (event, context) => { 'worklet'; defaults.handleOnBeginDrag?.(event, context); observe(event, true, false); },
    handleOnEndDrag: (event, context) => { 'worklet'; defaults.handleOnEndDrag?.(event, context); observe(event, false); },
    handleOnMomentumBegin: (event, context) => { 'worklet'; defaults.handleOnMomentumBegin?.(event, context); observe(event, false, true); },
    handleOnMomentumEnd: (event, context) => { 'worklet'; defaults.handleOnMomentumEnd?.(event, context); observe(event, false, false); },
  }), [defaults, observe]);
};

function DiscoveryScrollReadiness({ owner, extent, command, requestedIndex, pendingRequest, onReady, children }: {
  owner: number; extent: number; command: number; requestedIndex: number; pendingRequest: boolean;
  onReady: (snapshot: NativeListSnapshot) => void; children: ReactNode;
}) {
  // This provider is inside the keyed sheet: a native replacement can never inherit the previous list's witness.
  const witness = useSharedValue<NativeScrollWitness>({ extent: -1, offset: -1, dragging: false, momentum: false });
  const context = useMemo(() => ({ extent, witness }), [extent, witness]);
  const { animatedSheetState, animatedIndex, animatedPosition, animatedDetentsState, animatedAnimationState,
    animatedContentGestureState, animatedHandleGestureState, isInTemporaryPosition, animatedScrollableStatus } = useBottomSheetInternal();
  useAnimatedReaction(() => {
    const state = animatedSheetState.value;
    const unlocked = animatedScrollableStatus.value === SCROLLABLE_STATUS.UNLOCKED;
    const ready = unlocked && (state === SHEET_STATE.EXTENDED || state === SHEET_STATE.FILL_PARENT);
    const index = animatedIndex.value, detent = animatedDetentsState.value.detents?.[index];
    const status = animatedAnimationState.value.status;
    const content = animatedContentGestureState.value, handle = animatedHandleGestureState.value;
    const gesture = content === GestureState.BEGAN || content === GestureState.ACTIVE || handle === GestureState.BEGAN || handle === GestureState.ACTIVE;
    const idle = (status === ANIMATION_STATUS.STOPPED || status === ANIMATION_STATUS.UNDETERMINED)
      && !gesture && !isInTemporaryPosition.value;
    const settled = idle && Number.isInteger(index) && index >= 0 && detent !== undefined && Number.isFinite(detent)
      && Number.isFinite(animatedPosition.value) && Math.abs(animatedPosition.value - detent) <= 0.5;
    const observed = witness.value;
    const canRestore = ready && idle && !observed.dragging && !observed.momentum;
    return { owner, extent, command, requestedIndex, pendingRequest, state, ready, canRestore, gesture, unlocked, settledIndex: settled ? index : -1,
      offset: canRestore && settled && observed.extent === extent ? observed.offset : -1 };
  }, (next, previous) => {
    if ((!next.ready || !next.unlocked || witness.value.extent !== extent) && witness.value.offset >= 0) {
      witness.value = { ...witness.value, offset: -1 };
    }
    // Sample on focus/geometry/native settlement, not every scroll frame or React index request. Otherwise an
    // old physical stop could undo a new button command before its native animation begins.
    // Only a new native gesture observed after this exact command can supersede its explicit target.
    const gestureStarted = !!previous && next.gesture && !previous.gesture && next.command === previous.command
      && next.owner === previous.owner && next.extent === previous.extent;
    if (gestureStarted || next.ready !== previous?.ready || next.owner !== previous?.owner || next.extent !== previous?.extent
      || next.canRestore !== previous?.canRestore || next.settledIndex !== previous?.settledIndex
      || (next.command !== previous?.command && next.settledIndex >= 0 && (!next.pendingRequest || next.settledIndex === next.requestedIndex))
      || (next.offset >= 0) !== ((previous?.offset ?? -1) >= 0)) runOnJS(onReady)({ ...next, gestureStarted });
  }, [owner, extent, command, requestedIndex, pendingRequest, onReady, witness, animatedSheetState, animatedIndex, animatedPosition, animatedDetentsState,
    animatedAnimationState, animatedContentGestureState, animatedHandleGestureState, isInTemporaryPosition, animatedScrollableStatus]);
  return <NativeScrollContext.Provider value={context}>{children}</NativeScrollContext.Provider>;
}

// Keep the native cell type stable across focus owners. Context refreshes its layout handler without
// replacing the host View; a handler already queued still carries its original owner's guard.
const CellLayoutContext = createContext<{ sequence: number; receiveLayout: (index: number, bottom: number) => void } | null>(null);
function DiscoveryCell({ cellKey: _key, index, item: _item, onLayout, ...nativeProps }: CellRendererProps<MarketplaceItem>) {
  const layout = useContext(CellLayoutContext);
  return <View key={layout?.sequence} {...nativeProps} onLayout={event => {
    onLayout?.(event); // Preserve RN's own cell metrics, window expansion and viewability.
    layout?.receiveLayout(index, event.nativeEvent.layout.y + event.nativeEvent.layout.height);
  }} />;
}

/**
 * The fade of the "Mapa" pill (M-06, UI/UX pass 2026-10-08): in over `enter` and out over `exit` on the decelerating curve, with React Native's own Animated on the native driver (opacity only).
 * It used a Reanimated layout animation (`entering` and `exiting`), which the motion rules (R4, B22) keep out of everything that sits over a list. The pill stays mounted
 * while it fades out and is gone after; under reduced motion it is simply there, and simply gone.
 */
function usePillFade(shown: boolean, reduced: boolean) {
  const opacity = useRef(new NativeAnimated.Value(shown ? 1 : 0)).current;
  const [leaving, setLeaving] = useState(false);
  const was = useRef(shown);
  useEffect(() => {
    // Only a change of state is animated: a pill that is there when the screen opens is simply there, and one that is not there leaves nothing behind.
    const changed = was.current !== shown; was.current = shown;
    if (reduced || !changed) { opacity.setValue(shown ? 1 : 0); setLeaving(false); return; }
    setLeaving(!shown);
    const run = NativeAnimated.timing(opacity, { toValue: shown ? 1 : 0, duration: shown ? sys.motion.enter : sys.motion.exit,
      easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    run.start(({ finished }) => { if (finished && !shown) setLeaving(false); });
    return () => run.stop();
  }, [shown, reduced, opacity]);
  return { opacity, mounted: shown || leaving };
}

export function DiscoveryPresentation(props: DiscoveryPresentationProps) {
  const { items, loading, error } = props, view = remoteDiscoveryScope(props.view), reduced = useReducedMotion(), focused = useIsFocused();
  const userIntent = props.onUserIntent;
  const traceRef = useRef(props.trace); traceRef.current = props.trace;
  const trace = useCallback<DiscoveryTrace>((...args) => traceRef.current?.(...args), []);
  const traceState = useRef({ scrolled: false, index: -1 });
  const [more, setMore] = useState(false);
  useEffect(() => { setMore(false); }, [props.scopeKey]);
  useEffect(() => { if (!focused) setMore(false); }, [focused]);
  const nearby = useNearbyMap(props.scopeKey, focused);
  const { width: windowWidth, height: windowHeight, fontScale } = useWindowDimensions();
  const relations = props.relations;
  const pending = !!props.relationsPending;
  // Every change goes through the route's latest guarded `onView`, and two changes in one turn (a chip that also closes a
  // pin's card) build on each other, not on the same render's view.
  const latestView = useRef(view); latestView.current = view;
  const onViewRef = useRef(props.onView); onViewRef.current = props.onView;
  const change = useCallback((patch: Partial<MarketplaceView>) => {
    const next = remoteDiscoveryScope({ ...latestView.current, ...patch });
    latestView.current = next;
    onViewRef.current(next);
  }, []);
  // The list's scroll offset, written into the route's view a moment after the list stops (see the list below).
  const offset = useRef(view.listOffset ?? 0), offsetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeOffset = useCallback(() => {
    offsetTimer.current = null;
    const at = Math.round(offset.current);
    trace('write-offset', latestView.current.listOffset ?? 0, at);
    if (Math.abs((latestView.current.listOffset ?? 0) - at) > 1) change({ listOffset: at });
  }, [change, trace]);
  // The route hands down a fresh `onOpen` closure on every render (its guards read the latest read); rows get one
  // stable function that calls whatever is current at press time. A scroll that is not written yet is written first:
  // once the task is open, this screen is not in front and the route takes no more changes of its view.
  const openRef = useRef(props.onOpen); openRef.current = props.onOpen;
  const openItem = useCallback((item: MarketplaceItem) => {
    trace('preopen', latestView.current.listOffset ?? 0, offset.current, traceState.current.scrolled, traceState.current.index, !!offsetTimer.current);
    if (offsetTimer.current) { clearTimeout(offsetTimer.current); writeOffset(); }
    openRef.current(item);
  }, [writeOffset, trace]);

  // The search panel, opened at "Gde" from the pill and at "Kada" from "Uslovi pretrage".
  const [search, setSearch] = useState<SearchStep | null>(null);
  const searchBlurTarget = useRef<View | null>(null);
  // The list is read from what filters it and nothing else: moving the map or choosing a pin changes the view, and must
  // not hand the map a new list (the native source would be set again on every pan). The map's own set leaves the area
  // out, so a move of the map never takes a pin away; only the list follows the area. "Now" is read again with every new
  // read, every time choice and every opening of the panel, so "Danas" and the past days of its grid are today's.
  const { query, price, area, when, where, places: freePlaces, place: chosenPlace, dates, pinPlace } = view;
  // The screen outlives each native MapSession. Keep the publication camera's acknowledgement here so returning from
  // a task detail restores the saved viewport instead of treating the same publication as a fresh camera command.
  const cameraFilterKey = JSON.stringify([query, price, area, when, where, freePlaces, chosenPlace, dates, pinPlace, view.forMe === true]);
  const [cameraIntent, setCameraIntent] = useState<{ token: string; scopeKey: string; filterKey: string;
    status: 'pending' | 'consumed' | 'retired' } | null>(null);
  const publicationToken = props.publicationFocus?.kind === 'map' ? props.publicationFocus.token : null;
  const cameraOwner = useRef({ token: publicationToken, scopeKey: props.scopeKey, filterKey: cameraFilterKey,
    selected: !!publicationToken && props.publicationFocus?.id === view.selectedId, focused });
  cameraOwner.current = { token: publicationToken, scopeKey: props.scopeKey, filterKey: cameraFilterKey,
    selected: !!publicationToken && props.publicationFocus?.id === view.selectedId, focused };
  useEffect(() => {
    setCameraIntent(current => {
      const owner = cameraOwner.current;
      if (owner.token !== publicationToken || owner.scopeKey !== props.scopeKey) return current;
      return publicationToken ? current?.token === publicationToken && current.scopeKey === props.scopeKey ? current
        : { token: publicationToken, scopeKey: props.scopeKey, filterKey: owner.filterKey, status: 'pending' } : null;
    });
  }, [publicationToken, props.scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const retireCameraIntent = useCallback((token?: string, sourceScopeKey?: string) => {
    const owner = cameraOwner.current, target = token ?? owner.token;
    if (!target || target !== owner.token || (sourceScopeKey && sourceScopeKey !== owner.scopeKey)) return;
    setCameraIntent(current => {
      const live = cameraOwner.current;
      if (live.token !== target || live.scopeKey !== owner.scopeKey) return current;
      if (current?.token === target && current.scopeKey === live.scopeKey) return current.status === 'pending'
        ? { ...current, status: 'retired' } : current;
      return { token: target, scopeKey: live.scopeKey, filterKey: live.filterKey, status: 'retired' };
    });
  }, []);
  useEffect(() => {
    if (!focused || (cameraIntent?.token === publicationToken && cameraIntent.scopeKey === props.scopeKey
      && cameraIntent.filterKey !== cameraFilterKey)) retireCameraIntent(publicationToken ?? undefined, props.scopeKey);
  }, [focused, props.scopeKey, cameraFilterKey, cameraIntent, publicationToken, retireCameraIntent]);
  // A newly arrived token is already actionable on this render: the native map's effect can run before this screen's
  // initializing effect. Its acknowledgement below still wins whichever state updater runs first.
  const activeIntent = cameraIntent?.token === publicationToken && cameraIntent.scopeKey === props.scopeKey ? cameraIntent : null;
  const cameraRequestToken = focused && publicationToken && props.publicationFocus?.id === view.selectedId
    && (!activeIntent || (activeIntent.status === 'pending' && activeIntent.filterKey === cameraFilterKey))
    ? publicationToken : null;
  const consumeCameraIntent = useCallback((token: string, sourceScopeKey: string) => {
    const owner = cameraOwner.current;
    if (token !== owner.token || sourceScopeKey !== owner.scopeKey || !owner.selected || !owner.focused) return;
    setCameraIntent(current => {
      const live = cameraOwner.current;
      if (live.token !== token || live.scopeKey !== owner.scopeKey || !live.selected || !live.focused) return current;
      if (current?.token === token && current.scopeKey === live.scopeKey) return current.status === 'pending'
        ? { ...current, status: 'consumed' } : current;
      return { token, scopeKey: live.scopeKey, filterKey: live.filterKey, status: 'consumed' };
    });
  }, []);
  const now = useMemo(() => new Date(), [items, when, dates, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const sharedFilters = useMemo(() => ({ ...initialMarketplaceView(), query, price, when, where, places: freePlaces, place: chosenPlace, dates }),
    [query, price, when, where, freePlaces, chosenPlace, dates]);
  const filters = useMemo(() => ({ ...sharedFilters, area, pinPlace: pinPlace ?? null }), [sharedFilters, area, pinPlace]);
  const mapped = useMemo(() => loading || error ? NOTHING.mapped
    : props.p6Seam ? [...items] : discoveryShown(items, sharedFilters, undefined, now).mapped,
    [loading, error, items, sharedFilters, now, props.p6Seam]);
  const { inArea, withoutPoint, listed: ordinaryList } = useMemo(() => props.p6Seam
    ? { inArea: mapped.filter(item => !!publicPoint(item)), withoutPoint: mapped.filter(item => !publicPoint(item)), listed: mapped }
    : discoveryMapScope(mapped, { area, pinPlace, where }),
    [mapped, area, pinPlace, where, props.p6Seam]);
  const [retiredListFocus, setRetiredListFocus] = useState<{ token: string; scopeKey: string } | null>(null);
  const retireListFocus = () => {
    const request = props.publicationFocus;
    if (request?.kind === 'list') setRetiredListFocus(current => current?.token === request.token && current.scopeKey === props.scopeKey
      ? current : { token: request.token, scopeKey: props.scopeKey });
  };
  // A published task without a public point cannot be selected on the map. Put its existing
  // public row first in the open list; membership and the count remain exactly those of the read.
  // A later map-area choice restores the usual area-first / point-free section order.
  const listFocusId = props.publicationFocus?.kind === 'list' && !view.area && !view.pinPlace
    && (retiredListFocus?.token !== props.publicationFocus.token || retiredListFocus.scopeKey !== props.scopeKey)
    ? props.publicationFocus.id : null;
  const listed = useMemo(() => {
    if (!listFocusId) return ordinaryList;
    const chosen = ordinaryList.find(item => item.id === listFocusId);
    return chosen ? [chosen, ...ordinaryList.filter(item => item.id !== listFocusId)] : ordinaryList;
  }, [ordinaryList, listFocusId]);
  const p6WholeList = !!props.p6Seam && !area && !pinPlace;
  const sections = useMemo(() => {
    const result = new Map<number, ListSection>();
    // The server orders a whole-list P6 page by time, so the three kinds interleave: a heading for every run of a kind would cut
    // the list into one-card sections, and each card already names its own place ("Na daljinu", "Bez tačke"). Headings return where
    // the server itself puts the mapped section first, that is, once an area or a place is chosen.
    if (p6WholeList) return result;
    // Publication remains the first, highlighted row; its temporary promotion does not turn
    // following map tasks into remote work or create a duplicate remote section above it.
    let at = listFocusId && listed[0]?.id === listFocusId ? 1 : 0;
    while (at < listed.length) {
      const kind = listKind(listed[at]);
      let end = at + 1;
      while (end < listed.length && listKind(listed[end]) === kind) end++;
      if (kind !== 'map' || withoutPoint.length) result.set(at, { kind, count: end - at,
        label: kind === 'remote' ? 'Na daljinu' : kind === 'unlocated' ? 'Bez označenog mesta'
          : pinPlace ? 'Na ovom mestu' : area ? 'U ovoj oblasti' : 'Na mapi' });
      at = end;
    }
    return result;
  }, [listed, listFocusId, withoutPoint.length, pinPlace, area, p6WholeList]);
  const sectionsSignature = JSON.stringify([...sections]);
  const mappedWithoutPin = useMemo(() => mapped.filter(item => !publicPoint(item)).length, [mapped]);
  const groups = useMemo(() => pinPlaces(mapped), [mapped]);
  const byId = useMemo(() => new Map(mapped.map(item => [item.id, item] as const)), [mapped]);
  const relation = useCallback((item: MarketplaceItem): TaskCardRelation | undefined => {
    const answer = relations?.relation(item.id);
    return answer?.kind === 'OWNER' ? 'OWNED' : answer?.kind === 'APPLIED' ? 'APPLIED'
      : answer?.kind === 'NONE' ? undefined : pending ? 'PENDING' : 'UNKNOWN';
  }, [relations, pending]);
  const undated = useMemo(() => loading || error ? 0 : props.p6Seam?.counts?.undated
    ?? undatedCount(items, filters, undefined, now), [loading, error, items, filters, now, props.p6Seam?.counts?.undated]);
  const conditionCount = discoveryConditions(view);
  // "Za mene" is on: the list is narrowed to the tasks that fit the person's work profile (the switch is drawn only when the route says it exists).
  const scope: ScopeKey = props.scope ?? (view.forMe ? 'forMe' : 'all');
  const forMeOn = !!props.forMeAvailable && scope === 'forMe';
  // Over the map the row of chips stands only while something is applied: with nothing applied the one search pill is the way in, and the map is left to itself.
  const chipsOverMapShown = conditionCount > 0 || forMeOn;
  // Ownership only labels rows: counts describe the same public subset before and after the overlay arrives.
  const readiness: SearchReadiness = loading || props.collectionStatus === 'loading' ? 'loading'
    : error || props.collectionStatus === 'error' ? 'error' : 'ready';

  // Where the sheet rests is remembered in the route's view; a view that has one is where the sheet starts again.
  // A ready cold screen must give native its actual first detent at mount. Previously it mounted at half, then the
  // effect requested peek before Android had drawn the sheet; native reported index 0 while its header stayed absent.
  const [sheet, applySheet] = useState(() => ({ index: view.sheet ? INDEX[view.sheet] as number
    : !loading && !error ? INDEX[discoveryStartSnap(mapped.length, mappedWithoutPin)] as number : SNAP.half,
  sequence: 0, pending: false }));
  const sheetIndex = sheet.index, sheetCommand = useRef(sheet);
  const setSheetIndex = useCallback((index: number) => {
    if (sheetCommand.current.index === index) return;
    trace('want', index, sheetCommand.current.index);
    const next = { index, sequence: sheetCommand.current.sequence + 1, pending: true };
    sheetCommand.current = next; applySheet(next);
  }, [trace]);
  const appliedPublication = useRef<string | null>(null);
  useEffect(() => {
    const request = props.publicationFocus;
    if (!focused || !request || loading || error || appliedPublication.current === request.token) return;
    appliedPublication.current = request.token;
    setSheetIndex(request.kind === 'map' ? SNAP.peek : SNAP.full);
  }, [focused, props.publicationFocus, loading, error, setSheetIndex]);
  const acceptSheetIndex = useCallback((index: number) => {
    const command = sheetCommand.current;
    // Native observations may reconcile a drag, but cannot cancel an explicit target before its spring starts.
    if (command.pending && command.index !== index) return false;
    if (command.index !== index) {
      const next = { index, sequence: command.sequence + 1, pending: false };
      sheetCommand.current = next; applySheet(next);
    } else if (command.pending) {
      // Matching settlement fulfills the command without recommitting the unchanged native subtree.
      // A later changed index or retired gesture still renders its new command ownership.
      sheetCommand.current = { ...command, pending: false };
    }
    return true;
  }, []);
  // Requested React index and physically settled native index are deliberately separate.
  // This lets a quiet return keep native FlatList geometry, while an interrupted spring still forces a fresh mount.
  const nativeSettledIndex = useRef(sheetIndex), nativeSpringMoving = useRef(false);
  const started = useRef(!!view.sheet);
  useEffect(() => {
    if (!started.current) return;
    const name = SNAP_NAME[sheetIndex];
    if (name && latestView.current.sheet !== name) change({ sheet: name });
  }, [sheetIndex, change]);
  // Where the sheet starts is decided once from public pin coverage; labels cannot move it afterward.
  useEffect(() => {
    if (started.current || loading || error) return;
    started.current = true;
    const start = discoveryStartSnap(mapped.length, mappedWithoutPin);
    setSheetIndex(INDEX[start]);
    // Remembered at once: a start equal to the height the sheet already had changes no state to remember it by later.
    if (latestView.current.sheet !== start) change({ sheet: start });
  }, [loading, error, mapped.length, mappedWithoutPin, change]);
  // What is found must be seen. A sheet resting at its top line rises to show why nothing is found; and when nothing found
  // has a point on the map (a filter left only "Na daljinu"), it takes the screen, over a map with nothing on it. The map's
  // area is not a reason: moving the map never moves the sheet the person is looking past.
  useEffect(() => {
    if (!loading && where === 'remote') { setSheetIndex(SNAP.full); return; }
    if (!started.current || loading) return;
    if (mapped.length > 0 && mappedWithoutPin === mapped.length) setSheetIndex(SNAP.full);
    else if (!mapped.length && sheetIndex === SNAP.peek) setSheetIndex(SNAP.half);
  }, [loading, mapped.length, mappedWithoutPin, where, sharedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // The map is shown once the read has landed and it has something to show (or a place the person already looked at).
  // Relations never remove a public pin, so the first map fit does not wait for the account overlay.
  const mapShown = where !== 'remote' && !loading && !error && (props.p6Seam
    ? props.p6Seam.map.markers.length > 0 || !!props.p6Seam.map.wholeBounds || !!view.viewport || nearby.mapRequested
    : mapped.length - mappedWithoutPin > 0 || !!view.viewport || nearby.mapRequested);
  // An empty full list keeps its own recovery action and a quiet, gesture-free return to the map.
  const emptyOverMap = !loading && !error && !props.collectionStatus && !listed.length && mapShown;

  // A chosen pin: one task, or a place several tasks share, of what the map shows. The list's area never takes it away;
  // a new read that no longer has it does.
  const selectedPoint = useRef<{ id: string; key: string } | null>(null);
  const pointWitnessOwner = useRef<{ scopeKey: string; token: string | null }>({ scopeKey: props.scopeKey, token: null });
  useEffect(() => {
    if (props.p6Seam || loading || error) return;
    const publication = props.publicationFocus?.token ?? null;
    if (pointWitnessOwner.current.scopeKey !== props.scopeKey
      || (publication && pointWitnessOwner.current.token !== publication)) {
      selectedPoint.current = null;
      pointWitnessOwner.current = { scopeKey: props.scopeKey, token: publication };
    }
    const { selectedId, selectedPlace } = latestView.current;
    const item = selectedId ? byId.get(selectedId) : null;
    const point = item ? publicPoint(item) : null;
    const key = point ? pointKey(point) : null;
    const prior = selectedPoint.current;
    const lostTask = !!selectedId && (!key || (prior?.id === selectedId && prior.key !== key));
    selectedPoint.current = !lostTask && selectedId && key ? { id: selectedId, key } : null;
    const lostPlace = !!selectedPlace && !groups.has(selectedPlace);
    if (lostTask || lostPlace) change({ ...(lostTask ? { selectedId: null } : {}), ...(lostPlace ? { selectedPlace: null } : {}) });
  }, [loading, error, byId, groups, change, props.scopeKey, props.publicationFocus?.token, view.selectedId, view.selectedPlace, props.p6Seam]);
  const selectedItem = view.selectedId ? byId.get(view.selectedId) ?? null : null;
  const place = view.selectedPlace ? groups.get(view.selectedPlace) : undefined;
  const legacyPlaceTasks = useMemo(() => place && place.ids.length > 1 ? place.ids.flatMap(id => byId.get(id) ?? []) : [], [place, byId]);
  const legacyChosen = selectedItem && publicPoint(selectedItem) ? selectedItem : null;
  const placeTasks = props.p6Seam?.peek?.place ?? legacyPlaceTasks;
  const chosen = props.p6Seam ? props.p6Seam.peek?.item ?? null : legacyChosen;
  const select = (id: string) => {
    const item = byId.get(id), point = item && publicPoint(item);
    if (!point) return;
    userIntent?.(); retireCameraIntent();
    const shared = groups.get(pointKey(point));
    change(shared && shared.ids.length > 1 ? { selectedId: null, selectedPlace: shared.key } : { selectedId: id, selectedPlace: null });
    setSheetIndex(SNAP.peek);
  };
  const selectPlace = (key: string) => {
    const shared = groups.get(key);
    if (!shared) return;
    userIntent?.(); retireCameraIntent();
    change(shared.ids.length > 1 ? { selectedId: null, selectedPlace: key } : { selectedId: shared.ids[0], selectedPlace: null });
    setSheetIndex(SNAP.peek);
  };
  // P6: a touch on a server task or place is the same choice as a legacy pin, so the list sinks to its top line the same way (the coordinator
  // remembers `sheet: 'peek'` for it; a card over a half-height sheet and a return to another sheet were found by the independent review).
  // A cluster is navigation only: the map's camera goes into it and the sheet stays where it is.
  const selectServerMarker: DiscoveryV1ServerMapSeam['onSelect'] = marker => {
    const seam = props.p6Seam;
    if (!seam) return;
    if (marker.kind === 'CLUSTER') { seam.map.onSelect(marker); return; }
    userIntent?.(); retireCameraIntent();
    seam.map.onSelect(marker);
    setSheetIndex(SNAP.peek);
  };
  const clearSelection = () => {
    if (props.p6Seam) { retireCameraIntent(); props.p6Seam.onClearPeek(); return; }
    if (latestView.current.selectedId || latestView.current.selectedPlace) {
      retireCameraIntent(); change({ selectedId: null, selectedPlace: null });
    }
  };
  // "Prikaži sve u listi": the mapped part narrows to this one public point; tasks without a
  // point remain below in their own section. The search pill names the chosen point and clears it.
  const showPlace = () => {
    if (props.p6Seam) {
      if (!props.p6Seam.peek?.place.length) return;
      userIntent?.(); retireCameraIntent(); retireListFocus(); props.p6Seam.onShowPlace(); setSheetIndex(SNAP.full); return;
    }
    if (!place) return;
    userIntent?.(); retireCameraIntent(); retireListFocus();
    change({ pinPlace: place.key, selectedId: null, selectedPlace: null });
    setSheetIndex(SNAP.full);
  };
  // Every task again: the map's area and the one point are gone (the pill's "×", or an empty list's way back).
  const showAll = () => {
    userIntent?.(); retireCameraIntent(); retireListFocus();
    if (props.p6Seam) props.p6Seam.onShowAll(); else change({ area: null, pinPlace: null });
  };
  const onIndex = (index: number) => {
    trace('index', index, sheetIndex, currentSheet());
    // A spring completion can already be queued when this screen loses focus. It belongs to that visit,
    // not to the requested stop or selected pin restored when the person comes back.
    if (!currentSheet() || !acceptSheetIndex(index)) return;
    nativeSettledIndex.current = index; nativeSpringMoving.current = false;
    // Pulling the list up is looking at the list: a pin's card does not stay over it.
    if (index > SNAP.peek) clearSelection();
  };
  // The list follows the map: a settled move of the person's own hands up the bounds it shows, and it is a new "where",
  // so the one point a place's list was narrowed to is let go.
  const followArea = (bounds: PublicBounds, frame?: PublicBounds) => {
    userIntent?.(); retireListFocus();
    if (props.p6Seam) { props.p6Seam.onArea(bounds, frame); return; }
    const current = latestView.current;
    if (!sameBounds(bounds, current.area) || current.pinPlace) change({ area: bounds, pinPlace: null });
  };

  // Layout: the body under the chrome, the search pill's lower edge, the sheet's measured top line and its row of chips.
  const [bodyHeight, setBodyHeight] = useState(0), [toolsBottom, setToolsBottom] = useState(TOOLS_ESTIMATE), [peek, setPeek] = useState(PEEK_ESTIMATE);
  const [toolsMeasured, setToolsMeasured] = useState(false);
  const [creditsHeight, setCreditsHeight] = useState(Platform.OS === 'web' ? 0 : 48);
  const creditsRoom = mapShown && creditsHeight ? creditsHeight + GAP : 0;
  const [headerLeadHeight, setHeaderLeadHeight] = useState(PEEK_ESTIMATE);
  const [chipsRoom, setChipsRoom] = useState(CHIPS_ROOM_ESTIMATE), [chipBarHeight, setChipBarHeight] = useState(CHIP_BAR_ESTIMATE);
  // The list at its full height leaves a thin STRIP of map between the search pill and itself (UX plan section P, B3): the map's
  // credits stand in it on the left, the zoom buttons and "U blizini" on the right, one row high. With neither a map nor "U blizini"
  // there is no strip, and the list stands one gap under the pill. Lower stops and pin previews keep that row clear above them.
  // A tall count header joins the list scroll instead of pinning it.
  const canLocate = where !== 'remote';
  const footerRow = Math.max(creditsHeight, CONTROL_SIZE);
  const listTop = fullSheetTop(toolsBottom, GAP, footerRow, mapShown || canLocate);
  const availableSheet = bodyHeight ? Math.max(3, bodyHeight - listTop) : 0;
  const mapClearSheet = bodyHeight ? Math.max(3, availableSheet - GAP) : 0;
  const scrollHeader = !!mapClearSheet && peek + 2 > mapClearSheet;
  // A chosen pin's card: the list's top line steps out of sight behind it; the row of map controls stands above the card.
  const cardShown = mapShown && (!!chosen || placeTasks.length > 1) && search === null;
  const [cardHeight, setCardHeight] = useState(0);
  const coverBottom = cardShown && cardHeight ? cardHeight + CARD_BOTTOM + GAP : 0;
  // Android: Reanimated writes a view's opacity and transform by a synchronous update that is lost when Fabric has not mounted the view yet, and nothing
  // writes it again: a freshly mounted Gorhom body then stays at its hidden mount props (opacity 0 / off-screen) while the shared index and position already
  // report the requested stop (found on the CI emulator after returns from a task: a dimmed empty screen with only the "Mapa" pill). The P6 screen is rebuilt
  // on every return, so its sheet is nudged by a hundredth of a pixel a few times after it mounts: Gorhom re-evaluates the position and Reanimated writes
  // the body's style again, this time to a view that is there. The other logic of this screen reads the unnudged snap points.
  const [kick, setKick] = useState(0);
  // A hand on the list ends the nudging: a later nudge would move the sheet under the scroll (Gorhom locks the list while the sheet moves).
  const interacted = useRef(false);
  // The list's top line as it stands with no card over it. With a card it steps out of sight (HIDDEN) and only that one line changes.
  const collapsedSnap = scrollHeader ? Math.min(headerLeadHeight, mapClearSheet - 2) : peek;
  const snapPoints = useMemo(() => snapHeights({ bodyHeight, fullTop: listTop, collapsed: collapsedSnap, hidden: HIDDEN, cardShown, margin: GAP }),
    [bodyHeight, listTop, collapsedSnap, cardShown]);
  const sheetSnapPoints = useMemo(() => kick % 2 === 1
    ? snapPoints.map((value, at) => at === sheetIndex && typeof value === 'number' ? value - SHEET_KICK_PX : value) : snapPoints, [snapPoints, kick, sheetIndex]);
  // Empty results use the same full-height recovery surface, with a secondary map return.
  const highest = SNAP.full;
  // Match the native sheet's initial off-screen position; zero before its first layout would mean falsely covered.
  const position = useSharedValue(windowHeight);
  const expanded = sheetIndex === SNAP.full;
  const lowered = sheetIndex === SNAP.peek;
  // The row of chips over the map (list lowered) gives way to the one in the sheet's header as the sheet rises: from the sheet's own
  // position on the UI thread, over the first `CHIPS_HANDOFF` of its travel, so the two rows are never on show together for long.
  // Gone is out of reach as well: a hidden chip takes no touch (an instant removal, never a travelling control).
  const lowTop = bodyHeight - (typeof snapPoints[0] === 'number' ? snapPoints[0] : 0);
  const chipsOverMap = useAnimatedStyle(() => {
    if (!bodyHeight) return { opacity: 1 };
    const gone = Math.max(0, Math.min(1, (lowTop - position.value) / CHIPS_HANDOFF));
    return { opacity: 1 - gone, transform: [{ translateY: gone >= 1 ? -2 * bodyHeight : 0 }] };
  }, [bodyHeight, lowTop, position]);
  // "U blizini" stands at the right end of the map's row of controls, directly above the list, and moves with it: the same arithmetic as
  // the zoom buttons (`mapControls`), drawn here because it must also be there while no map is mounted.
  const locateCover = useCoverValue(coverBottom, reduced);
  const locateRide = useRidingStyle({ sheetTop: position, cover: locateCover, height: bodyHeight, rowHeight: footerRow, gap: GAP, minTop: toolsBottom + GAP });
  // Requested index is not physical coverage: a button's spring can return to its old stop without onChange.
  // Only crossing the actual full-height boundary reaches JS. New scope/focus owners reject already queued work.
  const coverageSequence = useRef(0);
  const coverageOwner = useMemo(() => ({ sequence: ++coverageSequence.current, active: true }), [props.scopeKey, focused]);
  const currentCoverageOwner = useRef(coverageOwner); currentCoverageOwner.current = coverageOwner;
  useEffect(() => { coverageOwner.active = true; return () => { coverageOwner.active = false; }; }, [coverageOwner]);
  const currentSheet = useCallback(() => focused && coverageOwner.active && currentCoverageOwner.current === coverageOwner,
    [focused, coverageOwner]);
  const contentHeight = useRef(0), listHeight = useRef(0), listReady = useRef(false), listRestoreReady = useRef(false);
  const restore = useRef<number | null>(null), restoreTarget = useRef<number | null>(null), restoreAttempted = useRef(false);
  // A fresh focus owner retires stale callbacks, but it no longer automatically replaces the native list.
  // Retain the exact BottomSheet/FlatList mount only when departure was physically settled and account scope,
  // row layout facts and viewport geometry are unchanged. That keeps RN's measured-cell cache for deep returns.
  // Interrupted springs, scope changes, changed rows or changed layout still remount fail-closed.
  const rowMountSignature = useMemo(() => JSON.stringify(listed.map(item => [item, relation(item)])), [listed, relation]);
  const snapSignature = (points: ReadonlyArray<number | string>) => points.map(value => typeof value === 'number' ? Math.round(value * 10) / 10 : value);
  const layoutMountSignature = [
    windowWidth, windowHeight, fontScale, bodyHeight, toolsBottom, peek, scrollHeader, headerLeadHeight, chipBarHeight, cardShown,
    undated, sectionsSignature,
    ...snapSignature(snapPoints),
  ].join(':');
  // EX-03: what keys the native rows (through the measurement owner below) is the geometry that sizes and places them. Whether a pin's card has sunk the list's top line is not part of it:
  // the rows keep their size and place, and the viewport is the full stop. Keyed by the signature above, every card that opened or closed re-created every row, a burst of native views
  // and Reanimated tags that died at once (measured on the HONOR). The signature above still guards a native sheet that comes back after a departure.
  const rowGeometrySignature = [
    windowWidth, windowHeight, fontScale, bodyHeight, toolsBottom, peek, scrollHeader, headerLeadHeight, chipBarHeight,
    undated, sectionsSignature,
    ...snapSignature([collapsedSnap, ...snapPoints.slice(1)]),
  ].join(':');
  const sheetMount = useRef({
    key: 1, focused, scopeKey: props.scopeKey, rows: rowMountSignature, layout: layoutMountSignature, reusable: true,
  });
  const previousFocused = sheetMount.current.focused;
  const unchangedMount = sheetMount.current.scopeKey === props.scopeKey
    && sheetMount.current.rows === rowMountSignature && sheetMount.current.layout === layoutMountSignature;
  if (previousFocused && !focused) {
    // Round31 proved a retained FULL Android sheet can come back with its native body reset to Gorhom's hidden
    // mount props (alpha 0 / off-screen translation) while shared index/position and the saved list offset still
    // report the correct FULL state. Retire only that native FULL mount on route departure. The logical view,
    // viewport, filters, selection and listOffset live above this keyed boundary; the existing bounded restore
    // rebuilds the list at the saved offset after the fresh native sheet becomes unlocked. Peek/half mounts may
    // still be retained when their physical state is settled. Do not replace this with a global Reanimated flag.
    const nativeMountMaySurviveReturn = sheetIndex !== SNAP.full;
    sheetMount.current.reusable = nativeMountMaySurviveReturn && unchangedMount && !nativeSpringMoving.current
      && nativeSettledIndex.current === sheetIndex && restore.current === null
      && Math.abs(offset.current - (latestView.current.listOffset ?? 0)) <= 1;
  } else if (!previousFocused && focused) {
    const reusable = sheetMount.current.reusable && unchangedMount;
    if (!reusable) {
      sheetMount.current.key++;
      nativeSettledIndex.current = sheetIndex; nativeSpringMoving.current = false;
    }
  } else if (focused && sheetMount.current.scopeKey !== props.scopeKey) {
    sheetMount.current.key++;
    nativeSettledIndex.current = sheetIndex; nativeSpringMoving.current = false;
  }
  // A changed-away-and-back dataset has already disturbed native cell geometry while hidden.
  if (!focused && !unchangedMount) sheetMount.current.reusable = false;
  sheetMount.current.focused = focused;
  if (focused) {
    sheetMount.current.scopeKey = props.scopeKey;
    sheetMount.current.rows = rowMountSignature;
    sheetMount.current.layout = layoutMountSignature;
  }
  const nativeMountKey = sheetMount.current.key;
  const kickable = !!props.p6Seam && Platform.OS === 'android' && focused && bodyHeight > 0;
  useEffect(() => {
    if (!kickable) return;
    interacted.current = false;
    const timers = SHEET_KICKS_MS.map((ms, at) => setTimeout(() => {
      if (interacted.current) return;
      trace('kick', at + 1, ms); setKick(at + 1);
    }, ms));
    return () => { timers.forEach(clearTimeout); setKick(0); };
  }, [kickable, nativeMountKey, trace]);
  const onSheetAnimate = useCallback((_fromIndex: number, _toIndex: number) => {
    if (!currentSheet()) return;
    nativeSpringMoving.current = true; // A same-index geometry spring can also be interrupted.
  }, [currentSheet]);
  const [coverage, setCoverage] = useState<{ owner: typeof coverageOwner; covered: boolean } | null>(null);
  const receiveCoverage = useCallback((covered: boolean) => {
    if (!focused || !coverageOwner.active || currentCoverageOwner.current !== coverageOwner) return;
    setCoverage(previous => previous?.owner === coverageOwner && previous.covered === covered ? previous : { owner: coverageOwner, covered });
  }, [coverageOwner, focused]);
  const coverageSequenceValue = coverageOwner.sequence;
  useAnimatedReaction(() => ({ covered: mapShown && bodyHeight > 0 && position.value <= listTop + 0.5, owner: coverageSequenceValue }),
    (next, previous) => {
      if (next.covered !== previous?.covered || next.owner !== previous?.owner) runOnJS(receiveCoverage)(next.covered);
    }, [position, mapShown, bodyHeight, listTop, coverageSequenceValue, receiveCoverage]);
  const mapCovered = coverage?.owner === coverageOwner && coverage.covered;
  // The floating "Mapa" stands over the end of the list at the full height.
  const pillShown = expanded && mapShown;
  const pillFade = usePillFade(pillShown, reduced);
  // The first fit of the pins keeps them above where the sheet starts: its top line, or half the map (review r3 item 3).
  const halfSheet = typeof snapPoints[1] === 'number' ? snapPoints[1] : Math.round(windowHeight / 2);
  // Attribution occupies camera headroom now, so it must not also inflate the bottom padding.
  const fitBottom = (discoveryStartSnap(mapped.length, mappedWithoutPin) === 'peek' ? snapPoints[0] as number : halfSheet) + GAP + footerRow;
  // The map's own top edge for its clear band, fits and credits: the pill, and under it the chips while they stand over the map.
  const mapToolsBottom = toolsBottom + (lowered && chipsOverMapShown ? chipsRoom : 0);
  const previewMaxHeight = bodyHeight ? Math.max(48, bodyHeight - toolsBottom - creditsRoom - CARD_BOTTOM - 2 * GAP - HIDDEN) : undefined;
  // Android Back with the whole list up over the map lowers it to its top line, as the card and the panel close on Back.
  useEffect(() => {
    if (!focused || !expanded || !mapShown || cardShown || search !== null) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { userIntent?.(); setSheetIndex(SNAP.peek); return true; });
    return () => back.remove();
  }, [focused, expanded, mapShown, cardShown, search, userIntent]);

  // The search panel's draft applies all at once; a newly chosen place brings its pins into view (the camera's own
  // move, never an area).
  const openSearch = (step: SearchStep) => { userIntent?.(); Keyboard.dismiss(); setSearch(step); };
  const [fit, setFit] = useState<{ key: number; bounds: PublicBounds; bottom: number } | null>(null);
  const findNearby = () => {
    if (!nearby.start()) return;
    userIntent?.(); Keyboard.dismiss(); clearSelection(); setFit(null); setSheetIndex(SNAP.peek);
  };
  const fits = useRef(0);
  const apply = (draft: SearchDraft, options?: SearchApplyOptions) => {
    const before = latestView.current.place;
    userIntent?.(); retireCameraIntent(); retireListFocus();
    change({ ...draft, selectedId: null, selectedPlace: null });
    // "U blizini" chosen in the panel is the same command as its chip: the map goes to the person once, and no filter is set by it.
    if (options?.nearby) { findNearby(); return; }
    if (!draft.place || (before && placeKey(before) === placeKey(draft.place))) return;
    const bounds = publicInitialBounds(discoveryShown(items, latestView.current, undefined, now).mapped);
    trace('fit', sheetIndex, bounds ? 1 : 0, sheetIndex === SNAP.peek ? peek : halfSheet);
    if (bounds) setFit({ key: ++fits.current, bounds, bottom: (sheetIndex === SNAP.peek ? peek : halfSheet) + GAP });
  };
  // "Poništi filtere" takes the conditions away, not the scope: "Za mene" is a choice of which tasks the list is about, so it stays.
  const reset = () => { userIntent?.(); retireCameraIntent(); retireListFocus();
    props.onView({ ...initialMarketplaceView(), mode: view.mode, viewport: view.viewport, sheet: view.sheet, ...(view.forMe ? { forMe: true } : {}) }); };

  // Quick chips: each toggles one existing filter at once, and is offered only when the tasks carry the fact it reads (or it is
  // already on and must be removable). The legacy reader holds every task, so its loaded rows say it. P6 holds one area's pages,
  // which change with every move of the map, so a chip read from them came and went while the person panned: there the server's
  // whole-filter availability says it (kept through a read that has not answered yet), and "N+ mesta", which the server does not
  // report, stays once any read in this account's visit showed a task with room for two (a server availability key would end this).
  const p6 = props.p6Seam;
  const lastAvailability = useRef<{ scopeKey: string; value: DiscoveryV1Availability } | null>(null);
  if (p6?.availability) lastAvailability.current = { scopeKey: props.scopeKey, value: p6.availability };
  const availability = p6 && lastAvailability.current?.scopeKey === props.scopeKey ? lastAvailability.current.value : null;
  const roomSeen = useRef<string | null>(null);
  const loadedRoom = useMemo(() => items.some(item => (openPlaces(item) ?? 0) >= 2), [items]);
  if (loadedRoom) roomSeen.current = props.scopeKey;
  const timed = useMemo(() => p6 ? !!availability?.hasKnownSchedule : saysWhen(items, now), [p6, availability, items, now]);
  const workModes = useMemo(() => p6 ? !!availability?.hasKnownWorkMode : saysWorkMode(items), [p6, availability, items]);
  const priceSaid = (key: 'MY_PRICE' | 'OFFERS') => p6 ? !!availability?.priceModes.includes(key) : items.some(item => item.rezimCene === key);
  const roomSaid = p6 ? roomSeen.current === props.scopeKey : loadedRoom;
  const toggle = (patch: Partial<MarketplaceView>) => { userIntent?.(); retireCameraIntent(); retireListFocus(); change({ ...patch, selectedId: null, selectedPlace: null }); };
  // The scope is the route's when it owns one; otherwise it is the view's own `forMe`, which the server reader sends as the filter's one optional key.
  const chooseScope = (next: ScopeKey) => { if (props.onScope) props.onScope(next); else toggle({ forMe: next === 'forMe' }); };
  const currentWhen = dateRange(view.dates) ? 'any' : view.when ?? 'any';
  const chips: QuickChip[] = [
    // Remote work remains a direct way in, ahead of the optional date/price rail. It has no stale map scope.
    ...(['remote', 'onsite'] as const).filter(key => workModes || view.where === key).map(key => ({ key: `where:${key}`, label: said(WHERE, key),
      selected: view.where === key, onPress: () => toggle({ where: view.where === key ? 'any' : key }) })),
    ...QUICK_WHEN.filter(key => timed || currentWhen === key).map(key => ({ key: `when:${key}`, label: said(WHEN, key), selected: currentWhen === key,
      onPress: () => toggle({ when: currentWhen === key ? 'any' : key as WhenFilter, dates: null }) })),
    ...(['MY_PRICE', 'OFFERS'] as const).filter(key => view.price === key || priceSaid(key)).map(key => ({
      key: `price:${key}`, label: said(PRICE, key), selected: view.price === key, onPress: () => toggle({ price: view.price === key ? 'all' : key }) })),
    ...(atLeast(freePlaces) > 1 || roomSaid ? [{ key: 'places',
      label: atLeast(freePlaces) > 1 ? placesWords(freePlaces) : placesWords(2), selected: atLeast(freePlaces) > 1,
      onPress: () => toggle({ places: atLeast(freePlaces) > 1 ? 1 : 2 }) }] : []),
  ];

  // The one row of chips: over the map under the search pill while the list is lowered, and the list sheet's sticky header from half
  // height up (UX plan section P, variant B). "Svi zadaci | Za mene" is not in it until `forMeAvailable`; "Filteri · N" opens the
  // search at its conditions; the quick chips write into the same state as the panel.
  const chipRow = (surface: 'map' | 'sheet') => <DiscoveryChipRow surface={surface} forMeAvailable={props.forMeAvailable} scope={scope}
    onScope={chooseScope} filtersCount={conditionCount} onFilters={() => openSearch('kada')} chips={chips} />;

  // The list's scroll offset: remembered in the route's view a moment after the list stops, found again when the list
  // is read anew (a return after a while, or after the app was away), and back at the top when the search changes. A
  // restore still waiting for the rows is dropped the moment the person takes hold of the list or refreshes it.
  const listRef = useRef<BottomSheetFlatListMethods | null>(null);
  const scrolledRef = useRef((view.listOffset ?? 0) > SCROLLED);
  // Gorhom's BottomSheetContent sizes its mask from the highest detent at every stop.
  // Give the native list that exact viewport, less our pinned header (a scrolling header
  // is inside the list). Otherwise Android's refresh wrapper can leave FlatList content-
  // sized on remount; EXTENDED then arrives without another bounded list onLayout.
  const listWindow = typeof snapPoints[2] === 'number' ? listViewport(snapPoints[2], scrollHeader ? 0 : peek, chipBarHeight) : 0;
  const restoreAck = useRef<number | null>(null);
  // The last scroll position the native list reported (a pending restore ignores events that are not its target), for a restore that has to settle.
  const observedY = useRef(0), stalls = useRef(0), stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armStallRef = useRef<() => void>(() => {});
  const clearStall = useCallback(() => { if (stallTimer.current) { clearTimeout(stallTimer.current); stallTimer.current = null; } }, []);
  const retainedRestoreOwner = useRef<number | null>(null);
  const restoreFrame = useRef(0);
  const restoreCommand = useRef(-1);
  const hasRows = listed.length > 0;
  // RN limits the unmeasured tail spacer to measured cells. Content size alone cannot
  // prove that an offset is unreachable: only the actual final cell and footer can.
  const extentSequence = useRef(0);
  const extent = useMemo(() => ({ sequence: ++extentSequence.current, bottom: null as number | null, footer: undated ? null as number | null : 0 }),
    [rowMountSignature, nativeMountKey, rowGeometrySignature, undated]);
  const currentExtent = useRef(extent);
  if (currentExtent.current !== extent) {
    // Keep this mount's last native content height as a provisional bound: unchanged dimensions produce no
    // new content-size event. Fresh final-cell/footer geometry must agree before it can certify a shorter end.
    // A previous data/layout owner's scroll acknowledgement cannot settle the new restore.
    restoreTarget.current = null; restoreAck.current = null; restoreAttempted.current = false;
    retainedRestoreOwner.current = null;
    currentExtent.current = extent;
  }
  const currentList = useCallback(() => currentSheet() && currentExtent.current === extent, [currentSheet, extent]);
  const endPadding = pillShown ? sys.space.huge + sys.space.xxl : sys.space.xxl;
  const hasMeasuredEnd = useCallback(() => {
    if (extent.bottom === null || extent.footer === null) return false;
    const end = extent.bottom + extent.footer + endPadding;
    return contentHeight.current >= end - 1
      && (contentHeight.current <= listWindow || Math.abs(contentHeight.current - end) <= 1);
  }, [extent, endPadding, listWindow]);
  const restoreVisit = useRef<number | null>(null), restoreMount = useRef<number | null>(null), restoreHadRows = useRef(hasRows);
  traceState.current = { scrolled: scrolledRef.current, index: sheetIndex };
  const tracedScroll = useRef<number | null>(null);
  const tracedRejectedScroll = useRef<string | null>(null);
  const tracedZero = useRef<string | null>(null);
  // Seed before mounting children: initial native scroll/layout events may precede the parent's effect.
  // A newly empty loading surface must not replace a retained logical offset with its synthetic zero either.
  if (focused && (restoreVisit.current !== coverageOwner.sequence || (restoreHadRows.current && !hasRows))) {
    if (restoreVisit.current !== coverageOwner.sequence) { listReady.current = false; listRestoreReady.current = false; }
    retainedRestoreOwner.current = restoreMount.current === nativeMountKey && sheetMount.current.reusable && hasRows ? coverageOwner.sequence : null;
    if (restoreMount.current !== nativeMountKey || !hasRows) { listHeight.current = 0; contentHeight.current = 0; }
    restoreVisit.current = coverageOwner.sequence; restoreMount.current = nativeMountKey;
    const at = latestView.current.listOffset ?? 0;
    trace('seed', coverageOwner.sequence, at, offset.current, hasRows, scrolledRef.current, sheetIndex);
    offset.current = at; restore.current = at > 0 ? at : null;
    restoreTarget.current = null; restoreAck.current = null; restoreAttempted.current = false; stalls.current = 0;
  }
  if (hasRows && !restoreHadRows.current) contentHeight.current = 0; // the loading/empty view's height is not row geometry
  restoreHadRows.current = hasRows;
  const tryRestore = useCallback(() => {
    const at = restore.current;
    if (at !== null) trace('restore-check', currentSheet(), hasRows, listReady.current, at, restoreAttempted.current, !!listRef.current,
      listHeight.current, contentHeight.current);
    if (!currentList() || at === null) return;
    if (!hasRows && !loading && !error) {
      restore.current = null; restoreTarget.current = null; offset.current = 0;
      scrolledRef.current = false; writeOffset();
      return;
    }
    if (!hasRows || !listReady.current || !listRestoreReady.current || nativeSettledIndex.current !== sheetIndex || !listRef.current
      || listWindow <= 0 || contentHeight.current <= 0) return;
    const target = Math.min(at, Math.max(0, contentHeight.current - listWindow));
    const terminal = hasMeasuredEnd();
    if (restoreTarget.current !== target) restoreAck.current = null;
    restoreTarget.current = target;
    if (target === 0) {
      if (!terminal) return;
      trace('clamp0', at, contentHeight.current, listWindow, latestView.current.listOffset ?? 0);
      // The measured current list fits in its window: there can be no offset event to acknowledge.
      restore.current = null; restoreTarget.current = null; offset.current = 0;
      scrolledRef.current = false; writeOffset();
      return;
    }
    // A provisional scroll may have arrived before the last cell's layout. Once its
    // matching extent is known, that acknowledgement is enough; scrolling to the same
    // offset again need not produce another native event.
    if (terminal && restoreCommand.current === sheetCommand.current.sequence && restoreAck.current !== null && Math.abs(restoreAck.current - target) <= 1) {
      trace('ack', restoreAck.current, at, target);
      offset.current = restoreAck.current; restore.current = null; restoreTarget.current = null;
      restoreAttempted.current = false; writeOffset();
      return;
    }
    if (restoreAttempted.current && restoreFrame.current === listWindow && restoreCommand.current === sheetCommand.current.sequence) return;
    restoreAttempted.current = true;
    restoreFrame.current = listWindow;
    restoreCommand.current = sheetCommand.current.sequence;
    trace('request', at, target, contentHeight.current, listWindow);
    listRef.current.scrollToOffset({ offset: target, animated: false });
    if (props.p6Seam) armStallRef.current();
  }, [currentSheet, currentList, hasRows, loading, error, listWindow, hasMeasuredEnd, writeOffset, trace, sheetIndex]);
  const retryRestore = useRef(tryRestore); retryRestore.current = tryRestore;
  const armStall = useCallback(() => {
    clearStall();
    stallTimer.current = setTimeout(() => {
      stallTimer.current = null;
      if (!currentList() || restore.current === null || !listRef.current) return;
      // A list that cannot restore (locked under a sheet that is not at its stop, or not settled there) was asked for nothing, so nothing has stalled. Counting it would end the
      // restore, or ask the locked list for its tail (which resets it to the top), without the list ever having been where it was saved. Its next request arms this again.
      if (!listReady.current || !listRestoreReady.current || nativeSettledIndex.current !== sheetCommand.current.index) return;
      const wanted = restore.current;
      const reachable = restoreTarget.current !== null && restoreTarget.current >= wanted;
      stalls.current += 1;
      trace('stall', stalls.current, wanted, restoreTarget.current ?? -1, contentHeight.current, observedY.current, extent.bottom ?? -1, extent.footer ?? -1);
      if (stalls.current <= RESTORE_STALL_RETRIES) {
        restoreAttempted.current = false;
        if (stalls.current === 1 || reachable) retryRestore.current(); else listRef.current.scrollToEnd?.({ animated: false });
        armStallRef.current();
        return;
      }
      const reached = reachable ? wanted : Math.round(observedY.current);
      restore.current = null; restoreTarget.current = null; restoreAck.current = null; restoreAttempted.current = false;
      trace('ack', reached, reached, reached, false);
      offset.current = reached; writeOffset();
    }, RESTORE_STALL_MS);
  }, [clearStall, currentList, extent, trace, writeOffset]);
  armStallRef.current = armStall;
  useEffect(() => clearStall, [coverageOwner, clearStall]);
  const receiveCellLayout = useCallback((index: number, bottom: number) => {
    if (!currentSheet() || currentExtent.current !== extent || index !== listed.length - 1) return;
    extent.bottom = bottom;
    retryRestore.current();
  }, [currentSheet, extent, listed.length]);
  const cellLayoutContext = useMemo(() => ({ sequence: extent.sequence, receiveLayout: receiveCellLayout }), [extent, receiveCellLayout]);
  const receiveListReady = useCallback(({ ready, canRestore, gestureStarted, state, settledIndex, offset: observed, command }: NativeListSnapshot) => {
    trace('ready', ready, state, currentSheet(), restore.current ?? -1, offset.current, position.value,
      focused, coverageOwner.active, currentCoverageOwner.current === coverageOwner, listHeight.current, contentHeight.current, listWindow, settledIndex, observed, canRestore);
    if (!currentList() || command !== sheetCommand.current.sequence) return;
    if (gestureStarted) { interacted.current = true; userIntent?.(); }
    if (gestureStarted && sheetCommand.current.pending) {
      const next = { ...sheetCommand.current, sequence: command + 1, pending: false };
      sheetCommand.current = next; applySheet(next); // Retire queued observations of the interrupted request too.
    }
    if (sheetCommand.current.pending && settledIndex !== sheetCommand.current.index) {
      listReady.current = ready; listRestoreReady.current = false;
      restoreAttempted.current = false; restoreAck.current = null;
      return;
    }
    if (settledIndex >= 0 && settledIndex <= highest) {
      acceptSheetIndex(settledIndex);
      nativeSettledIndex.current = settledIndex; nativeSpringMoving.current = false;
    }
    listReady.current = ready; listRestoreReady.current = canRestore;
    if (!canRestore) { restoreAttempted.current = false; restoreAck.current = null; }
    else {
      const at = restore.current;
      // No scroll event is emitted when the retained native list already sits at the saved target. Only this
      // mount/extent's actual unlocked, idle native event witness can confirm that exact original offset.
      // A lower provisional target still needs command acknowledgement and measured final-cell/footer proof.
      if (retainedRestoreOwner.current === coverageOwner.sequence && at !== null && observed >= 0 && Math.abs(observed - at) <= 1) {
        trace('ack', observed, at, at, true);
        offset.current = observed; restore.current = null; restoreTarget.current = null; restoreAck.current = null;
        restoreAttempted.current = false; retainedRestoreOwner.current = null; writeOffset();
      } else tryRestore();
    }
  }, [currentSheet, currentList, tryRestore, trace, position, focused, coverageOwner, listWindow, highest, writeOffset, acceptSheetIndex, userIntent]);
  const onScroll = useCallback((event: { nativeEvent: NativeScrollEvent }) => {
    const y = Math.max(0, event?.nativeEvent?.contentOffset?.y ?? 0);
    observedY.current = y;
    if (y === 0) {
      const values = [currentSheet(), listReady.current, restore.current ?? -1, restoreTarget.current ?? -1,
        restoreAttempted.current, offset.current, scrolledRef.current, focused, coverageOwner.active, currentCoverageOwner.current === coverageOwner];
      const signature = values.join(':');
      if (signature !== tracedZero.current) { tracedZero.current = signature; trace('scroll0', ...values); }
    } else tracedZero.current = null;
    if (!currentList() || !listReady.current) {
      const rejected = [Math.floor(y / 64), focused, coverageOwner.active, currentCoverageOwner.current === coverageOwner, listReady.current].join(':');
      if (rejected !== tracedRejectedScroll.current) {
        tracedRejectedScroll.current = rejected;
        trace('scroll-reject', y, focused, coverageOwner.active, currentCoverageOwner.current === coverageOwner, listReady.current);
      }
      return;
    }
    tracedRejectedScroll.current = null;
    // Native mount/layout and locked-scroll resets can emit zero after content was measured. Only the
    // acknowledged target completes restoration; these synthetic events must never overwrite the saved view.
    if (restore.current !== null) {
      if (!listRestoreReady.current || !restoreAttempted.current || restoreCommand.current !== sheetCommand.current.sequence
        || restoreTarget.current === null || Math.abs(y - restoreTarget.current) > 1) return;
      restoreAck.current = y;
      // Reaching the current rendered window drives RN to render more cells. Keep the
      // original logical target until it is reached or the actual data end is measured.
      if (restoreTarget.current < restore.current && !hasMeasuredEnd()) return;
      trace('ack', y, restore.current, restoreTarget.current);
      restore.current = null; restoreTarget.current = null; restoreAttempted.current = false;
    }
    offset.current = y;
    if (y > 0 && (tracedScroll.current === null || Math.abs(y - tracedScroll.current) >= 64)) {
      trace('scroll', y, latestView.current.listOffset ?? 0, scrolledRef.current); tracedScroll.current = y;
    }
    scrolledRef.current = y > SCROLLED;
    if (offsetTimer.current) clearTimeout(offsetTimer.current);
    // An accepted user scroll still belongs to this visit if folding the chips changes the viewport before saving.
    offsetTimer.current = setTimeout(() => { if (currentSheet()) writeOffset(); }, OFFSET_SETTLE_MS);
  }, [writeOffset, currentSheet, currentList, hasMeasuredEnd, trace, focused, coverageOwner]);
  // Opening a row flushes deliberately before navigation; background scroll deliveries and a pending
  // debounce from the retired visit must not overwrite the position restored on the next visit.
  useEffect(() => () => {
    if (offsetTimer.current) { clearTimeout(offsetTimer.current); offsetTimer.current = null; }
  }, [coverageOwner]);
  // gorhom 5.2.14 takes `onScroll` and calls it on the JS thread with `{ nativeEvent }` (useScrollHandler, runOnJS), but its
  // list types leave the prop out; it is handed over as the library reads it.
  const scrollProps = { onScroll } as object;
  useEffect(() => {
    trace(focused ? 'focus' : 'blur', coverageOwner.sequence, latestView.current.listOffset ?? 0, offset.current,
      traceState.current.scrolled, traceState.current.index, hasRows, loading, error);
    if (!focused) {
      restore.current = null; restoreTarget.current = null; restoreAttempted.current = false; listReady.current = false;
      // Keep settled native geometry for a possible retained return; a new mount clears it before children render.
    } else tryRestore();
  }, [hasRows, focused, tryRestore, trace]);
  useEffect(() => {
    trace('geometry', bodyHeight, toolsBottom, listTop, peek, chipsRoom, scrolledRef.current, sheetIndex, listHeight.current, contentHeight.current);
  }, [bodyHeight, toolsBottom, listTop, peek, chipsRoom, sheetIndex, trace]);
  const onContentSizeChange = (_width: number, height: number) => {
    trace('content', currentSheet(), height, contentHeight.current, listHeight.current, restore.current ?? -1);
    if (!currentList()) return;
    if (contentHeight.current !== height) { restoreAttempted.current = false; stalls.current = 0; clearStall(); }
    contentHeight.current = height;
    tryRestore();
  };
  const refreshList = () => { trace('refresh', currentSheet(), restore.current ?? -1); if (currentList()) { restore.current = null; props.onRefresh(); } };
  const searchKey = JSON.stringify([query, price, area, when, where, freePlaces, chosenPlace, dates, pinPlace ?? null]);
  const lastSearch = useRef(searchKey);
  useEffect(() => {
    if (lastSearch.current === searchKey) return;
    trace('search-change', latestView.current.listOffset ?? 0, offset.current, restore.current ?? -1);
    lastSearch.current = searchKey;
    restore.current = null; offset.current = 0; scrolledRef.current = false;
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
    if ((latestView.current.listOffset ?? 0) !== 0) change({ listOffset: 0 });
  }, [searchKey, change, trace]);

  // How old the tasks are, as of this read of the list: the moment is fixed with the page, so a card does not change its words while it is on screen.
  const published = props.p6Seam?.published;
  const ageOf = useMemo(() => taskAgeOf(published, new Date()), [published]);
  const appear = useAppear();
  const cameFromSkeleton = useRef(props.arriveAfterLoading ?? props.loading).current;
  appear.settle(listed.map(keyOf), searchKey, { afterLoading: cameFromSkeleton });
  const appearRef = useRef(appear); appearRef.current = appear;
  const sectionsRef = useRef(sections); sectionsRef.current = sections;
  // The render window is wider than the visible list. Start authorized photo reads only for settled visible rows,
  // and unmount them when the sheet is hidden or this route loses focus; AuthorizedPhoto aborts on unmount.
  // Gorhom sizes its content to the highest detent even at half height, so native viewability is trusted only at full.
  const [portraitIds, setPortraitIds] = useState<ReadonlySet<string>>(() => new Set());
  const portraitViewability = useRef({ itemVisiblePercentThreshold: 30, minimumViewTime: 180 }).current;
  const visibleRangeRef = useRef(props.p6Seam?.onVisibleRange); visibleRangeRef.current = props.p6Seam?.onVisibleRange;
  // One function for the life of the list: React Native refuses a FlatList whose `onViewableItemsChanged` changes on the fly ("Changing
  // onViewableItemsChanged on the fly is not supported", in development builds and on the web), so the current guard is read through a ref.
  const currentListRef = useRef(currentList); currentListRef.current = currentList;
  const onVisibleRows = useCallback(({ viewableItems }: { viewableItems: ViewToken<MarketplaceItem>[] }) => {
    if (!currentListRef.current()) return;
    const shown = viewableItems.filter(token => token.isViewable);
    const next = new Set(shown.slice(0, 6).map(token => token.item.id));
    setPortraitIds(current => current.size === next.size && [...next].every(id => current.has(id)) ? current : next);
    // P6: the rows on screen get their optional details (relation, publisher), not only the first hundred of the list.
    const indexes = shown.map(token => token.index).filter((index): index is number => typeof index === 'number' && index >= 0);
    if (indexes.length) visibleRangeRef.current?.(Math.min(...indexes), Math.max(...indexes));
  }, []);
  useEffect(() => { setPortraitIds(new Set()); }, [props.scopeKey]);
  const showPortraits = focused && !cardShown && sheetIndex === SNAP.full;
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<MarketplaceItem>) =>
    <DiscoveryRow item={item} index={index} animate={appearRef.current.isNew(keyOf(item))} relation={relation(item)} onOpen={openItem}
      portraitVisible={showPortraits && portraitIds.has(item.id)}
      section={sectionsRef.current.get(index)} />, [relation, openItem, showPortraits, portraitIds]);

  // The one state view: reading, not read, nothing here, nothing for these conditions, nothing at all. The map and the list always show every
  // published task (owner, 2026-10-07): an empty list is never about the person's profile, only about where the map stands and what is searched.
  // Tasks under these conditions exist elsewhere when the legacy read holds them, or when P6's whole-filter count says so.
  const elsewhere = props.p6Seam ? (props.p6Seam.counts?.mapped ?? 0) > 0 : mapped.length > 0;
  const conditionsOn = !!view.query.trim() || discoveryFiltered(view) || !!view.place;
  // "Za mene" on, and nothing else narrowing the list: what the person asked for is what leaves nothing, and the way on is every task again.
  const listState: DiscoveryListStateKind = loading || props.collectionStatus === 'loading' ? { kind: 'loading' }
    : error || props.collectionStatus === 'error' ? { kind: 'error', onRetry: refreshList }
      // Only the map's area or its one point leaves nothing: the tasks are elsewhere on the map, one move or one tap away.
      : (pinPlace || area) && elsewhere ? { kind: 'place', point: !!pinPlace, onShowAll: showAll }
        : forMeOn && !conditionsOn ? { kind: 'forMe', onShowAll: () => chooseScope('all') }
          : conditionsOn ? { kind: 'filtered', onClear: reset }
            : { kind: 'none', onRefresh: refreshList, onNew: props.onNew };
  const empty = <View style={s.empty}><DiscoveryListState state={listState} clearAllLabel={CLEAR_ALL} /></View>;
  // A time choice leaves out the tasks whose schedule names no day; the list says how many instead of hiding them silently.
  const footer = undated ? <View key={extent.sequence} onLayout={event => {
    if (!currentSheet() || currentExtent.current !== extent) return;
    extent.footer = event.nativeEvent.layout.height; tryRestore();
  }}><T variant="note" tone="muted" style={s.undated}>{undatedWords(undated)}</T></View> : null;

  // What is on and has no quick chip of its own says itself once, under the count, and removes itself: the place, the
  // searched words and the time choices the chips do not carry. A quick chip removes its own filter. The map's area and
  // the one point are said by the search pill and taken away by its "×": a chip here that came and went with every move
  // of the map changed the height of the sheet's top line, and the sheet jumped with it.
  const range = dateRange(view.dates);
  const appliedChips: { key: string; label: string; clear: Partial<MarketplaceView> }[] = [
    ...(view.place ? [{ key: 'place', label: view.place, clear: { place: null } }] : []),
    ...(view.query.trim() ? [{ key: 'query', label: quoted(view.query), clear: { query: '' } }] : []),
    ...(range ? [{ key: 'dates', label: datesWords(range, now), clear: { dates: null } }]
      : currentWhen !== 'any' && !QUICK_WHEN.includes(currentWhen) ? [{ key: 'when', label: said(WHEN, currentWhen), clear: { when: 'any' as const } }] : []),
  ];
  // The count says what is listed, honestly: under a map area, the area's tasks and, apart, those with no point at all;
  // on one point, that point's tasks. It is independent of the account overlay.
  const p6Counts = props.p6Seam?.counts;
  const exactListed = p6Counts?.listed ?? listed.length;
  const exactInArea = p6Counts?.inArea ?? inArea.length;
  const exactWithoutPoint = p6Counts?.withoutPoint ?? withoutPoint.length;
  const exactPinless = view.where === 'remote' ? 0 : p6Counts?.withoutPoint ?? mappedWithoutPin;
  const line = countLineWords({ status: loading ? 'loading' : error ? 'error' : 'ready', listed: exactListed, inArea: exactInArea,
    withoutPoint: exactWithoutPoint, pinless: exactPinless, area: !!area, pinPlace: !!pinPlace });
  const collectionWords = props.collectionStatus === 'loading' ? 'Učitavamo ostale zadatke…'
    : props.collectionStatus === 'error' ? 'Ostali zadaci nisu učitani' : null;
  const spoken = collectionWords ?? `${line.words}${line.extra}`;
  // The top edge is a glanceable count of the actual list. Area and pinless context remain in its
  // accessible name, the search summary and the list's own section heading.
  const count = <T variant="note" style={s.count}>
    {collectionWords ?? (loading || error ? line.words : exactListed ? countWords(exactListed) : 'Nema zadataka')}
  </T>;
  // The server reads the open tasks newest first (UX plan 2.14), and says so over the list: only a P6 page that holds more than one.
  const sorted = !!props.p6Seam && !loading && !error && !collectionWords && exactListed > 1;
  // iOS has no live region: a screen reader hears the new count once the list's area has stayed still for a second.
  const spokenRef = useRef(spoken); spokenRef.current = spoken;
  const whereKey = JSON.stringify([area ?? null, pinPlace ?? null]), lastWhere = useRef(whereKey);
  useEffect(() => {
    if (lastWhere.current === whereKey) return;
    lastWhere.current = whereKey;
    if (Platform.OS !== 'ios' || !focused) return;
    const timer = setTimeout(() => { AccessibilityInfo.announceForAccessibility?.(spokenRef.current); }, AREA_ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, [whereKey, focused]);
  // The top line is the sheet's handle: a tap goes to the next height (lowered, half, full, and round again); a drag of it, of the header
  // or of the list moves the same sheet, and the sheet never overshoots.
  // Another page of the server's list is being read, and the person is looking at the list (not at the map under a lowered sheet).
  const paging = !!props.p6Seam?.loadingMore && !loading && !error && hasRows && sheetIndex > SNAP.peek;
  const cycleSheet = () => { userIntent?.(); Keyboard.dismiss(); clearSelection(); setSheetIndex(nextSheetIndex(sheetIndex)); };
  const header = <View testID="discovery-list-header" style={s.header}
    onLayout={event => { const next = Math.ceil(event.nativeEvent.layout.height); if (next > 0) setPeek(current => current === next ? current : next); }}>
    <View testID="discovery-list-header-lead" onLayout={event => {
      const next = Math.ceil(event.nativeEvent.layout.height) + sys.space.sm;
      if (next > sys.space.sm) setHeaderLeadHeight(current => current === next ? current : next);
    }}>
    <View style={s.grab} />
    {/* A polite live region: TalkBack hears the count when it changes (a new area, a new read), without moving its focus. */}
    <Press testID="list-count" accessibilityRole="button" accessibilityLabel={spoken} accessibilityValue={sorted ? { text: NEWEST_FIRST } : undefined}
      accessibilityState={{ expanded: sheetIndex > SNAP.peek }} accessibilityHint={handleHint(sheetIndex)} accessibilityLiveRegion="polite"
      haptic="select" scaleTo={sys.motion.scale.row} onPress={cycleSheet} style={s.countRow}>
      {count}{sorted ? <T variant="note" tone="muted" style={s.sortedBy}>{NEWEST_FIRST}</T> : null}
    </Press>
    </View>
    {props.collectionStatus === 'error' ? <View style={s.relationsRecovery}>
      <T variant="note" style={s.relationsMessage}>Tvoj zadatak je objavljen. Osveži listu da vidiš i ostale.</T>
      <Press accessibilityRole="button" accessibilityLabel="Osveži ostale zadatke" onPress={refreshList}
        style={s.relationsRetry}><T variant="action" style={s.relationsRetryText}>Osveži</T></Press>
    </View> : null}
    {props.publicationUnavailable ? <View style={s.relationsRecovery}>
      <T variant="note" style={s.relationsMessage}>{props.publicationUnavailable === 'missing'
        ? 'Objavljen zadatak trenutno nije dostupan u pretrazi.' : 'Prikaz objavljenog zadatka nije potvrđen.'}</T>
      {props.onOpenPublishedTask ? <Press accessibilityRole="button" accessibilityLabel="Otvori moj objavljen zadatak"
        onPress={props.onOpenPublishedTask} style={s.relationsRetry}><T variant="action" style={s.relationsRetryText}>Otvori moj zadatak</T></Press> : null}
    </View> : null}
    {!loading && !error && items.length > 0 && props.relationsError ? <View style={s.relationsRecovery}>
      <T variant="note" tone="muted" style={s.relationsMessage}>Tvoj status uz zadatke nije učitan.</T>
      <Press accessibilityRole="button" accessibilityLabel="Proveri status zadataka" onPress={refreshList}
        style={s.relationsRetry}><T variant="action" style={s.relationsRetryText}>Proveri</T></Press>
    </View> : null}
    {appliedChips.length ? <View style={s.applied}>{appliedChips.map(chip => <Press key={chip.key} accessibilityRole="button"
      accessibilityLabel={removeWords(chip.label)} haptic="select" hitSlop={{ top: sys.space.xs, bottom: sys.space.xs }}
      onPress={() => toggle(chip.clear)} style={s.appliedChip}>
      <T variant="meta" style={s.appliedText} numberOfLines={1}>{chip.label}</T><Glyph name="close" size={16} tone="green" />
    </Press>)}</View> : null}
  </View>;

  return <TaskAgeContext.Provider value={ageOf}><SafeAreaView edges={['top']} style={s.screen}>
    {/* Search is this screen's header. Identity belongs to Home; the existing account/publication entries stay in Još. */}
    <BlurTargetView ref={searchBlurTarget} testID="discovery-body" style={s.body} onLayout={event => { const next = Math.round(event.nativeEvent.layout.height); if (next > 0) setBodyHeight(next); }}>
      {/* The map stays on show at every height of the list (at the full one it is a strip above the sheet); the map itself locks and a
          tap on the strip lowers the list to half. */}
      <View testID="discovery-map-layer" style={StyleSheet.absoluteFill}>
        {mapShown ? <DiscoveryMap canRetainMap={props.canRetainMap} items={mapped} selectedId={props.p6Seam ? null : chosen?.id ?? null}
          selectedPlace={props.p6Seam ? null : placeTasks.length > 1 ? place!.key : null}
          p6Server={props.p6Seam ? { ...props.p6Seam.map, onSelect: selectServerMarker, onClear: props.p6Seam.onClearPeek } : undefined}
          relations={relations}
          onUserIntent={userIntent}
          publicationCameraToken={cameraRequestToken && props.publicationFocus?.id === chosen?.id ? cameraRequestToken : null}
          onPublicationCameraConsumed={consumeCameraIntent} onPublicationCameraRetired={retireCameraIntent}
          initialWorkArea={props.initialWorkArea} onInitialWorkAreaHandled={props.onInitialWorkAreaHandled}
          viewport={view.viewport} scopeKey={props.scopeKey} onSelect={select} onSelectPlace={selectPlace} onClear={clearSelection}
          onViewport={viewport => change({ viewport })} onArea={followArea} fitTo={fit} centerNearby={nearby.target} onNearbyConsumed={nearby.consume}
          onFitted={key => setFit(current => current?.key === key ? null : current)}
          onList={() => { userIntent?.(); setSheetIndex(SNAP.full); }} sheetTop={position} toolsBottom={mapToolsBottom} fitBottom={fitBottom}
          controlsMinTop={toolsBottom + GAP} locked={mapCovered} locateShown={canLocate}
          onStripPress={() => { userIntent?.(); setSheetIndex(SNAP.half); }}
          cameraLayoutReady={bodyHeight > 0 && toolsMeasured}
          onCreditsHeight={next => setCreditsHeight(current => current === next ? current : next)}
          coverBottom={coverBottom}
          focusBottom={CARD_BOTTOM + GAP + Math.min(360, Math.round(windowHeight / 2))} />
          : <View style={s.ground} />}
      </View>
      {/* "U blizini": the right end of the map's row of controls, directly above the list sheet, riding it like the zoom buttons. */}
      {canLocate && bodyHeight ? <Animated.View testID="discovery-locate-layer" pointerEvents="box-none" style={[s.locateLayer, { height: footerRow }, locateRide]}>
        {/* Everything over the map is a float: white, one line, one shadow. */}
        <Surface kind="float" style={[s.locate, { top: Math.round((footerRow - CONTROL_SIZE) / 2) }]}>
          <Press testID="locate" accessibilityRole="button" accessibilityLabel="U blizini"
            accessibilityHint="Jednom koristi lokaciju da centrira mapu. Ne čuva je i ne menja uslove pretrage."
            accessibilityState={{ disabled: nearby.busy, busy: nearby.busy }} disabled={nearby.busy}
            haptic="select" scaleTo={sys.motion.scale.button} hitSlop={2} onPress={findNearby} style={s.locateTouch}>
            {nearby.busy ? <ActivityIndicator size="small" color={sys.color.ink} /> : <Crosshair size={22} color={sys.color.ink} />}
          </Press>
        </Surface>
      </Animated.View> : null}
      <DiscoverySearchBar where={whereWords(view)} conditions={conditionsWords(view, now)}
        onSearch={() => openSearch('gde')} onMore={() => { Keyboard.dismiss(); setMore(true); }}
        onClearWhere={area || pinPlace ? showAll : undefined}
        onLayout={bottom => { setToolsBottom(current => current === bottom ? current : bottom); setToolsMeasured(true); }}
        below={<>
          {lowered && chipsOverMapShown ? <Animated.View testID="discovery-chips-over-map" style={chipsOverMap} onLayout={event => {
            const next = Math.ceil(event.nativeEvent.layout.height) + sys.space.sm;
            if (next > sys.space.sm) setChipsRoom(current => current === next ? current : next);
          }}>{chipRow('map')}</Animated.View> : null}
          {canLocate && nearby.message ? <NearbyNotice message={nearby.message} onSettings={nearby.settings} /> : null}
          {props.forMeRefused ? <ForMeNotice message={FOR_ME_REFUSED} entry={WORK_PROFILE_ENTRY} onEntry={props.onWorkProfile}
            onClose={() => props.onDismissForMeRefused?.()} /> : null}
        </>} />
      <DiscoveryListSheet key={nativeMountKey} index={sheetIndex} snapPoints={sheetSnapPoints} position={position} reduced={reduced}
        // Gorhom's `index` effect returns early while `animateOnMount` is set and its mount animation has not FINISHED (an interrupted one never
        // sets `didAnimateOnMount`), and nothing re-runs it: a later request for another detent is lost, React says FULL and the native sheet stays
        // where it is (a dimmed empty screen with only the "Mapa" pill; found on the emulator, on the first open of the list and after a return).
        // The P6 screen is rebuilt on every return and started while the map is still initialising, so it never depends on that animation.
        animateOnMount={nativeMountKey === 1 && !props.p6Seam}
        onIndex={onIndex} onAnimate={onSheetAnimate} header={scrollHeader ? null : header}
        sticky={<View testID="discovery-sheet-chips" accessibilityElementsHidden={lowered}
          importantForAccessibility={lowered ? 'no-hide-descendants' : 'auto'} onLayout={event => {
            const next = Math.ceil(event.nativeEvent.layout.height);
            if (next > 0) setChipBarHeight(current => current === next ? current : next);
          }}>{chipRow('sheet')}</View>}
        sunk={cardShown}>
        <DiscoveryScrollReadiness owner={coverageOwner.sequence} extent={extent.sequence} command={sheetCommand.current.sequence}
          requestedIndex={sheetIndex} pendingRequest={sheetCommand.current.pending} onReady={receiveListReady}>
        {/* Pull to refresh belongs to the list at its full height (review r3 item 10, checked in gorhom 5.2.14: its
            refresh control is enabled only while the list may scroll, which is at the top height). At the lower heights
            a pull down lowers the sheet, as in the map apps people know; the list is read again on every return to
            the screen, and the error and empty states carry their own "Pokušaj ponovo" / "Osveži zadatke". */}
        <CellLayoutContext.Provider value={cellLayoutContext}>
        <BottomSheetFlatList<MarketplaceItem> ref={listRef} data={listed} keyExtractor={keyOf} renderItem={renderItem} CellRendererComponent={DiscoveryCell}
          scrollEventsHandlersHook={useDiscoveryScrollEvents}
          style={listWindow > 0 ? { height: listWindow, flexGrow: 0, flexShrink: 0 } : undefined}
          viewabilityConfig={portraitViewability} onViewableItemsChanged={onVisibleRows}
          ListHeaderComponent={scrollHeader ? <View testID="discovery-scrolling-header" style={s.scrollingHeader}>{header}</View> : null}
          extraData={sectionsSignature}
          refreshing={!!props.refreshing && !loading} onRefresh={refreshList}
          onEndReached={props.p6Seam?.pageHasMore && !props.p6Seam.loadingMore ? () => { if (currentList()) props.p6Seam?.onNextPage(); } : undefined}
          onEndReachedThreshold={props.p6Seam?.pageHasMore ? 0.4 : undefined}
          {...scrollProps} onContentSizeChange={onContentSizeChange}
          onLayout={event => {
            trace('layout', currentSheet(), event.nativeEvent.layout.height, listHeight.current, contentHeight.current, restore.current ?? -1);
            if (!currentList()) return;
            const height = event.nativeEvent.layout.height;
            listHeight.current = height; tryRestore();
          }}
          onScrollBeginDrag={() => { interacted.current = true; trace('drag', currentSheet(), listReady.current, restore.current ?? -1, offset.current); tracedScroll.current = null; if (currentList()) { userIntent?.(); restore.current = null; } }}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
          // The floating "Mapa" stands over the list's end at the full height; the end scrolls clear of it.
          contentContainerStyle={pillShown ? s.listUnderPill : s.list}
          // Six cards are more than one phone screen of this card; the window stays modest so a fast
          // scroll fills in quickly without holding the whole list mounted.
          initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
          ItemSeparatorComponent={Separator} ListEmptyComponent={empty} ListFooterComponent={footer} />
        </CellLayoutContext.Provider>
        </DiscoveryScrollReadiness>
      </DiscoveryListSheet>
      {/* At the full height the same map is one tap away: a floating dark-green "Mapa" that lowers the list to its top line.
          It fades in and out only when motion is allowed; under reduced motion it is simply there. */}
      {pillFade.mounted ? <NativeAnimated.View pointerEvents={pillShown ? 'box-none' : 'none'} style={[s.mapPillRow, { opacity: pillFade.opacity }]}
        accessibilityElementsHidden={!pillShown} importantForAccessibility={pillShown ? 'auto' : 'no-hide-descendants'}>
        <Surface kind="float" style={[s.mapPillSurface, emptyOverMap && s.mapPillQuiet]}>
          <Press accessibilityRole="button" accessibilityLabel="Mapa" accessibilityHint="Spušta listu i prikazuje mapu." haptic="select" scaleTo={sys.motion.scale.button}
            onPress={() => { userIntent?.(); setSheetIndex(SNAP.peek); }} style={s.mapPill}>
            <Glyph name="map" size={20} tone={emptyOverMap ? 'green' : 'onGreen'} on />
            <T variant="action" style={[s.mapPillText, emptyOverMap && s.mapPillQuietText]}>Mapa</T>
          </Press>
        </Surface>
      </NativeAnimated.View> : null}
      {/* The next page of a long list is on its way. It is said over the list's end and not inside it, so the end the list measures (and the
          place a return restores to) never moves; a quiet line, since a spinner lives only inside a button. */}
      {paging ? <View pointerEvents="none" accessible accessibilityLabel={PAGING_WORDS} accessibilityLiveRegion="polite"
        style={[s.pagingRow, pillShown && s.pagingAbovePill]}>
        <Surface kind="float" style={s.paging}><T variant="note" style={s.pagingText}>{PAGING_WORDS}</T></Surface>
      </View> : null}
      {cardShown ? <DiscoveryPeek key={props.p6Seam?.peek?.key ?? (chosen ? `task:${chosen.id}` : `place:${place!.key}`)}
        item={chosen} place={placeTasks} relation={relation} active={focused} bottomInset={CARD_BOTTOM} reduced={reduced}
        maxHeight={previewMaxHeight}
        onOpen={openItem} onShowPlace={showPlace} onClose={clearSelection}
        onHeight={next => setCardHeight(current => current === next ? current : next)} /> : null}
    </BlurTargetView>
    {search ? <DiscoverySearchPanel blurTarget={searchBlurTarget} items={items} view={view} mine={relations?.owned} now={now} mapArea={view.viewport?.bounds ?? null}
      start={search} reduced={reduced} readiness={readiness} p6Search={props.p6Seam?.search} canNearby={Platform.OS !== 'web'}
      onApply={apply} onClose={() => setSearch(null)} /> : null}
    {more && focused ? <ActionSheet title="Još mogućnosti" reduced={reduced} onClose={() => setMore(false)} actions={[
      ...(props.onNew ? [{ key: 'new', label: 'Objavi zadatak', icon: 'tasks' as const, onPress: props.onNew }] : []),
      { key: 'profile', label: 'Moj profil', icon: 'person', onPress: props.onProfile },
      ...(props.onNotifications ? [{ key: 'notifications', label: 'Obaveštenja', icon: 'bell' as const, onPress: props.onNotifications }] : []),
    ]} /> : null}
  </SafeAreaView></TaskAgeContext.Provider>;
}

const s = StyleSheet.create({
  relationsRecovery: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.md },
  relationsMessage: { flex: 1 },
  relationsRetry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: sys.space.sm },
  relationsRetryText: { color: sys.color.green },
  screen: { flex: 1, backgroundColor: sys.color.ground },
  body: { flex: 1 },
  separator: { height: sys.space.md },
  ground: { flex: 1, backgroundColor: sys.color.ground },
  // The layer of "U blizini": as wide as the map and as tall as the row of controls; the UI thread moves it with the sheet.
  locateLayer: { position: 'absolute', left: 0, right: 0, top: 0 },
  locate: { position: 'absolute', right: sys.space.base, width: CONTROL_SIZE, height: CONTROL_SIZE, borderRadius: sys.radius.pill },
  // The touch fills the float (its line takes 1 dp each side) and keeps the round shape.
  locateTouch: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill },
  header: { paddingHorizontal: sys.space.lg, paddingBottom: sys.space.sm },
  // Cancel the list's side inset so the moved header keeps the same measured width and cannot oscillate between modes.
  scrollingHeader: { marginHorizontal: -sys.space.lg },
  grab: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: sys.space.sm, marginBottom: 0, backgroundColor: sys.color.lineStrong },
  // The honest count on the sheet's top line, and how the list is ordered beside it: the whole line is the handle's button.
  countRow: { minHeight: 48, paddingVertical: sys.space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: sys.space.md, borderRadius: sys.radius.control },
  count: { color: sys.color.ink, fontWeight: '600', flexShrink: 1 },
  sortedBy: { textAlign: 'right' },
  applied: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: sys.space.sm, paddingBottom: sys.space.xs },
  // 40 high and 4 more above and under it: 48 to a finger, and two rows of chips 8 apart never share a touch.
  appliedChip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 40, maxWidth: '100%', paddingHorizontal: sys.space.md,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft },
  appliedText: { fontWeight: '600', color: sys.color.green, flexShrink: 1 },
  list: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.xs, paddingBottom: sys.space.xxl, flexGrow: 1 },
  // The pill is 48 high and 16 above the bottom: the list's end keeps 80 clear under it.
  listUnderPill: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.xs, paddingBottom: sys.space.huge + sys.space.xxl, flexGrow: 1 },
  empty: { flex: 1, paddingVertical: sys.space.sm },
  undated: { paddingTop: sys.space.base, textAlign: 'center' },
  // The heading of a group of tasks (on the map, remote, with no point): the list's own words, never a card. 24 above it (12 of the gap between cards and 12 of its own), 12 under it.
  section: { flexDirection: 'row', alignItems: 'baseline', gap: sys.space.sm, paddingTop: sys.space.md, paddingBottom: sys.space.md },
  sectionTitle: { fontWeight: '600', color: sys.color.ink },
  sectionCount: { color: sys.color.muted, fontVariant: ['tabular-nums'] },
  // Bottom-centre, just above the tab bar (the screen ends where the bar begins).
  mapPillRow: { position: 'absolute', left: 0, right: 0, bottom: sys.space.base, alignItems: 'center' },
  // The quiet note while the next page is read: where the "Mapa" pill stands, or just above it when that is on show.
  pagingRow: { position: 'absolute', left: 0, right: 0, bottom: sys.space.base, alignItems: 'center' },
  pagingAbovePill: { bottom: sys.space.base + 48 + sys.space.sm },
  paging: { paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm, borderRadius: sys.radius.pill },
  pagingText: { color: sys.color.ink },
  // The green pill is a float like the rest: its own colour for ground and line, the system's shadow.
  mapPillSurface: { borderRadius: sys.radius.pill, backgroundColor: sys.color.green, borderColor: sys.color.green },
  mapPill: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 48 - 2, paddingHorizontal: sys.space.xl, borderRadius: sys.radius.pill },
  mapPillText: { color: sys.color.onGreen },
  mapPillQuiet: { backgroundColor: sys.color.surface, borderColor: sys.color.lineStrong },
  mapPillQuietText: { color: sys.color.green },
});
