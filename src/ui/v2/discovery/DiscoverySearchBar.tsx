import type { ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { Glyph } from '../../system/Glyph';
import { ChromeIconButton, chrome } from '../../system/ScreenChrome';
import { Surface } from '../../system/Surface';
import { sys } from '../../system/tokens';
import { FILTERS_HINT, SEARCH_HINT, SEARCH_PLACEHOLDER, filtersSpoken } from './discoveryWords';

/** The bar's distance from the top of the map. */
export const BAR_TOP = sys.space.md;
/** The search pill's own clear button: a full 48 wide, as high as the pill, at its right end. */
const CLEAR_WIDTH = 48;
/** The round filters button: as high as the pill beside it. */
const FILTERS_SIZE = 56;

/**
 * The top of the Zadaci map (Discovery V47; Airbnb's search bar, USKOČI's look; the owner's phone of 7 and 8 Oct 2026, the approved plan U1). One white search
 * pill, with the magnifier, says what is searched in one line (the words, then the place, or "Ova oblast") and opens the SEARCH, which is a word
 * and a place and nothing else; beside it, SEPARATE, the round button of the FILTERS with how many are on, which opens the filters and nothing of the
 * search (`filters`); under them the row of capsules (`chips`, the row `DiscoveryChipRow`). With nothing searched the pill says "Šta tražiš · Gde": a place
 * to start, never a claim about which tasks the list holds. There is no typing field on the map: the words are typed in the search, which fills the
 * screen. The adjacent menu preserves secondary destinations without another header; search and the menu share one surface. The pill, the button and the
 * capsules stand at the top at every height of the list, and the list, when it is all the way up, ends directly under them.
 *
 * While the list is narrowed to what the pill says (a place, words, the map's area or one point), the pill carries its own "×" at its
 * right end, "Prikaži sve zadatke": the way back to every task is where the narrowing is said, not a chip that would appear under the list's
 * count and move the sheet each time the map moves (review of V47). It lies over the pill's end, so the pill is exactly as tall with it as
 * without it.
 *
 * `onLayout` reports the lower edge of the pill and its row of capsules, from the top of the map: what the list stops under when it is up,
 * and what the map's camera keeps clear. Whatever hangs `below` them (a notice) floats over the map and never moves the list sheet's stops.
 */
export function DiscoverySearchBar({ where, onSearch, onMore, onClearWhere, filters, onLayout, chips, below }: {
  /** What is searched, in one line; null when nothing is. */ where: string | null;
  onSearch: () => void;
  /** Secondary account/publication entries share one menu so the map does not need a second header. */
  onMore?: () => void;
  /** Set while the list is narrowed to what the pill says: the pill's "×" takes that narrowing away. */
  onClearWhere?: () => void;
  /** The round button of the filters beside the pill, with how many conditions are on (none: no number). */
  filters?: { count: number; onPress: () => void };
  /** The lower edge of the pill and its capsules from the top of the map: where the list stops when it is all the way up. */
  onLayout: (bottom: number) => void;
  /** The row of capsules, under the pill. It is part of the measured edge. */
  chips?: ReactNode;
  /** Floats over the map under the capsules: a notice. Not part of the measured edge. */
  below?: ReactNode;
}) {
  const measure = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    onLayout(Math.ceil(BAR_TOP + y + height));
  };
  return <View pointerEvents="box-none" style={s.bar}>
    <View testID="discovery-search-stack" pointerEvents="box-none" style={s.stack} onLayout={measure}>
      <View testID="discovery-search-row" pointerEvents="box-none" style={s.row}>
        <Surface kind="float" style={s.searchSurface}>
          <View style={s.search}>
            <Press accessibilityRole="button" accessibilityLabel="Pretraži zadatke" accessibilityValue={where ? { text: where } : undefined}
              accessibilityHint={SEARCH_HINT} haptic="select" scaleTo={sys.motion.scale.row} onPress={onSearch}
              style={[s.pill, s.pillWide, onClearWhere && s.pillClearable]}>
              <Glyph name="search" size={20} tone="ink" strong />
              <View style={s.lines}>
                {/* One line: what is searched, or the place to start. The full words are spoken (the Pressable's value) and written out in the
                    search. */}
                {where ? <T variant="bodyStrong" style={s.where} numberOfLines={1}>{where}</T>
                  : <T variant="body" tone="muted" style={s.placeholder} numberOfLines={1}>{SEARCH_PLACEHOLDER}</T>}
              </View>
            </Press>
            {onClearWhere ? <Press testID="clear-where" accessibilityRole="button" accessibilityLabel="Prikaži sve zadatke"
              haptic="select" scaleTo={sys.motion.scale.button} hitSlop={0} onPress={onClearWhere} style={s.clear}>
              <View style={s.clearCircle}><Glyph name="close" size={16} tone="ink" /></View>
            </Press> : null}
          </View>
          {onMore ? <View testID="discovery-search-tools" style={s.tool}>
            <ChromeIconButton label="Još mogućnosti" hint="Objava zadatka, profil i obaveštenja." glyph="more" quiet onPress={onMore} />
          </View> : null}
        </Surface>
        {filters ? <FiltersButton count={filters.count} onPress={filters.onPress} /> : null}
      </View>
      {chips}
    </View>
    {below}
  </View>;
}

/**
 * The filters, as a round button beside the pill (the approved plan, U1): the same float as the pill, as high as it, with the sliders and, when any
 * condition is on, how many in a small ink disc at its corner (a number, never only a colour). It is the way to the filters and to nothing else.
 */
function FiltersButton({ count, onPress }: { count: number; onPress: () => void }) {
  return <Surface kind="float" style={s.filtersSurface}>
    <Press testID="filters-button" accessibilityRole="button" accessibilityLabel={filtersSpoken(count)} accessibilityHint={FILTERS_HINT}
      accessibilityState={{ selected: count > 0 }} haptic="select" scaleTo={sys.motion.scale.button} hitSlop={0} onPress={onPress} style={s.filtersTouch}>
      <Glyph name="filters" size={22} tone="ink" />
    </Press>
    {count > 0 ? <View testID="filters-count" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.badge}>
      <T variant="label" style={s.badgeText}>{count}</T>
    </View> : null}
  </Surface>;
}

/**
 * A line the map says under the search: a float like the other things over the map (white, one edge, one shadow), and a polite live
 * region, so a screen reader hears it without losing its place.
 */
function MapNotice({ name, stacked = false, children }: { name: string; stacked?: boolean; children: ReactNode }) {
  return <View testID={name} accessibilityLiveRegion="polite" style={s.noticeSlot}>
    <Surface kind="float" style={stacked ? s.noticeStacked : s.notice}>{children}</Surface>
  </View>;
}

/**
 * What "Moja lokacija" says when it cannot do its one job (no permission, the location switched off, no answer in time), or while it
 * is asking: a quiet white line under the search, with the way to the settings when that is the remedy.
 */
export function NearbyNotice({ message, onSettings }: { message: string; onSettings?: () => void }) {
  return <MapNotice name="nearby-notice">
    <T variant="note" style={s.noticeText}>{message}</T>
    {onSettings ? <Press accessibilityRole="button" accessibilityLabel="Podešavanja lokacije" hitSlop={0}
      onPress={onSettings} style={s.settings}><T variant="note" style={s.settingsText}>Podešavanja</T></Press> : null}
  </MapNotice>;
}

/**
 * What "Za mene" says when the server refused it (R28: the person's work profile is not active): the switch is already back off, and this
 * line says why, once, with the one way out and a close of its own. It stays until the person closes it or asks "Za mene" again.
 */
export function ForMeNotice({ message, entry, onEntry, onClose }: { message: string; entry: string; onEntry?: () => void; onClose: () => void }) {
  // The sentence and its close share the first line; the one way out stands under the sentence, at its own left edge.
  return <MapNotice name="for-me-notice" stacked>
    <View style={s.noticeTop}>
      <T variant="note" style={s.noticeSentence}>{message}</T>
      <Press accessibilityRole="button" accessibilityLabel="Zatvori poruku" hitSlop={0} onPress={onClose} style={s.close}>
        <Glyph name="close" size={16} tone="ink" />
      </Press>
    </View>
    {onEntry ? <Press accessibilityRole="button" accessibilityLabel={entry} hitSlop={0} onPress={onEntry} style={s.entry}>
      <T variant="note" style={s.settingsText}>{entry}</T></Press> : null}
  </MapNotice>;
}

const s = StyleSheet.create({
  bar: { position: 'absolute', top: BAR_TOP, left: 0, right: 0, gap: sys.space.sm },
  // The pill and its row of capsules: 8 between them (the capsules carry 2 above and 8 below them for the lift of their shadow).
  stack: { gap: sys.space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.base },
  search: { flex: 1, minWidth: 0 },
  // One float owns the search and its controls: the first of the few things over the map, in the one look of a float.
  searchSurface: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', paddingRight: sys.space.xs, borderRadius: sys.radius.pill },
  pill: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 56, paddingLeft: sys.space.base,
    paddingRight: sys.space.sm, paddingVertical: sys.space.sm, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.surface },
  // The words end where the clear button begins.
  pillClearable: { paddingRight: CLEAR_WIDTH },
  pillWide: { borderRadius: sys.radius.card },
  lines: { flex: 1, minWidth: 0 },
  where: { lineHeight: 20, color: sys.color.ink },
  placeholder: { lineHeight: 20 },
  // Over the pill's right end, from its top edge to its bottom edge: never taller than the pill, never under 48 wide.
  clear: { position: 'absolute', top: 0, bottom: 0, right: 0, width: CLEAR_WIDTH, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  clearCircle: { width: 28, height: 28, borderRadius: sys.radius.pill, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center' },
  tool: { width: chrome.control, height: chrome.control },
  // The round button of the filters: a full float, as high as the pill; the touch fills it. The count is a small ink disc over its upper right.
  filtersSurface: { width: FILTERS_SIZE, height: FILTERS_SIZE, borderRadius: sys.radius.pill, flexShrink: 0 },
  filtersTouch: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill },
  badge: { position: 'absolute', top: sys.space.xs, right: sys.space.xs, minWidth: 20, height: 20, paddingHorizontal: sys.space.xs, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: sys.color.onDark, fontWeight: '700', fontVariant: ['tabular-nums'] },
  noticeSlot: { marginHorizontal: sys.space.base },
  notice: { paddingHorizontal: sys.space.md, paddingVertical: sys.space.xs, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm },
  noticeStacked: { paddingLeft: sys.space.md, paddingRight: sys.space.xs, paddingBottom: sys.space.xs },
  noticeTop: { flexDirection: 'row', alignItems: 'flex-start', columnGap: sys.space.sm },
  noticeSentence: { color: sys.color.ink, flex: 1, minWidth: 0, paddingTop: sys.space.md },
  entry: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingRight: sys.space.sm },
  noticeText: { color: sys.color.ink, flexGrow: 1, flexBasis: 180, paddingVertical: sys.space.sm },
  settings: { minHeight: 48, justifyContent: 'center', paddingHorizontal: sys.space.sm },
  settingsText: { color: sys.color.ink, fontWeight: '600' },
  // The close of a notice: a full 48 square at its end, the glyph at its centre.
  close: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
