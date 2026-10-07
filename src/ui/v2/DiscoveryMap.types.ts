import type { WorkAreaCamera } from '../../data/discoveryWorkArea';
import type { SharedValue } from 'react-native-reanimated';
import type { MarketplaceItem, PublicViewport, PublicBounds } from '../../data/marketplaceView';
import type { TaskRelationIndex } from '../../data/taskRelation';
import type { DiscoveryV1MapMarker } from '../../data/discoveryV1MarketplaceAdapter';
/** Ephemeral camera instruction, never a public pin, task location, search filter, or stored location. */
export type NearbyCameraTarget = { key: number; center: [longitude: number, latitude: number] };
export type DiscoveryV1ServerMapSeam = {
  markers: readonly DiscoveryV1MapMarker[];
  selectedKey: string | null;
  wholeBounds: PublicBounds | null;
  onSelect: (marker: DiscoveryV1MapMarker) => void;
  /** The camera settled after a move that is not the person's own; the markers should cover this region. */
  onViewportSettled?: (bounds: PublicBounds) => void;
  onClear?: () => void;
};
export type DiscoveryMapProps = { items: readonly MarketplaceItem[]; selectedId: string | null; viewport: PublicViewport | null;
  /** Quarantined P6 MAP path. When present, server buckets own map geometry; legacy GeoJSON clustering is not mounted. */
  p6Server?: DiscoveryV1ServerMapSeam;
  /** Handled means attempted/retired, not device-render acceptance. */
  initialWorkArea?: WorkAreaCamera | null; onInitialWorkAreaHandled?: (key: string) => void;
  /** Account-owned overlay for rich pins only. Never added to the SDK's public GeoJSON. */
  relations?: TaskRelationIndex;
  /** Opt-in same-account task-detail retention; never revives an old interaction owner. */
  canRetainMap?: () => boolean;
  scopeKey: string; onSelect: (id: string) => void; onViewport: (value: PublicViewport) => void;
  /** Immediate manual interaction, distinct from camera/layout observations. */
  onUserIntent?: () => void;
  /** Legacy fixture entry; publication navigation uses a one-shot token below. */
  focusSelectionOnMount?: boolean;
  /** Pending camera move for the confirmed public task. The screen owns its lifetime across native map remounts. */
  publicationCameraToken?: string | null;
  /** Called only after the native camera method has been invoked for this token. */
  onPublicationCameraConsumed?: (token: string, scopeKey: string) => void;
  /** A gesture or competing camera request cancels an undelivered publication move. */
  onPublicationCameraRetired?: (token: string, scopeKey: string) => void;
  /**
   * The list follows the map (Discovery V47): once a move of the person's own (a drag, a pinch, a zoom button, a cluster
   * tap) has settled and stayed still for `AREA_SETTLE_MS`, the map hands up what the person can see of it (`bounds`: below
   * the search tools, above the sheet or a card) and its whole view (`frame`, which the P6 buckets cover). The camera's own
   * moves (the first fit, a chosen pin brought into view, a fit to a chosen place) never do.
   */
  onArea: (bounds: PublicBounds, frame: PublicBounds) => void;
  onList: () => void;
  /** A tap on the map where there is no pin: whatever pin's card is open closes. */
  onClear?: () => void;
  /**
   * Bring these bounds into view once (a place chosen in the search), keeping `bottom` clear for the list sheet: the
   * camera's own move, so it never becomes an area. `key` says which request it is; `onFitted` hears it was carried out.
   */
  fitTo?: { key: number; bounds: PublicBounds; bottom: number } | null;
  centerNearby?: NearbyCameraTarget | null;
  /** Retire this exact one-shot request after camera dispatch; later remounts restore the remembered viewport. */
  onNearbyConsumed?: (key: number) => void;
  onFitted?: (key: number) => void;
  /** Several tasks on one public point: pressing that point selects the place (its `pointKey`) instead of one task. */
  onSelectPlace?: (key: string) => void;
  /** The chosen place, drawn as the green pill that says how many tasks it holds. */
  selectedPlace?: string | null;
  /**
   * The list sheet's top edge, in pixels from the map's top. The row of controls (the zoom buttons) stands directly above it and
   * moves with it on the UI thread; without a sheet the row stands above the map's bottom edge.
   */
  sheetTop?: SharedValue<number>;
  /**
   * The highest the row of controls may stand, in pixels from the map's top: the strip of map between the search pill and the list
   * sheet at its full height. The row reaches it exactly when the sheet is full, so it is never behind the list. Without it, one gap
   * under `toolsBottom`.
   */
  controlsMinTop?: number;
  /**
   * The list sheet is at its full height and only a strip of map shows above it: the map takes no gesture and a screen reader skips
   * it, and a tap on the strip (not on a control or the credits) asks `onStripPress`.
   */
  locked?: boolean;
  /** A tap on the strip of map above the full list: the list comes down to half. */
  onStripPress?: () => void;
  /** The screen draws "U blizini" at the right end of the row, so the zoom buttons stand one control further in. */
  locateShown?: boolean;
  /** The floating search bar's bottom edge, in pixels from the map's top: fits and the credits keep clear of it. */
  toolsBottom?: number;
  /** Measured fixed attribution strip below search; lower sheet stops and selected previews keep it clear. */
  onCreditsHeight?: (height: number) => void;
  /** How much of the map's bottom a chosen pin's card covers, so the camera brings the pin into the clear band. */
  focusBottom?: number;
  /**
   * How much of the map's bottom the list sheet covers where it starts, so the first fit of the pins keeps them above
   * it (a sheet that starts half open would otherwise hide the pins it was opened for). Without it the fit keeps 56.
   */
  fitBottom?: number;
  /** False until the screen has measured its body and floating tools. Initial bounds fit must not freeze estimates. */
  cameraLayoutReady?: boolean;
  /**
   * The height of a card resting on the sheet's top line (a chosen pin's card), gap included; 0 when there is none. The row of
   * controls stands above the card then, and moves there without a bounce. Attribution keeps its position below search.
   */
  coverBottom?: number };
