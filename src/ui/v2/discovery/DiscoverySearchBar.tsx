import type { ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { Glyph } from '../../system/Glyph';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { Surface } from '../../system/Surface';
import { sys } from '../../system/tokens';
import { FILTERS_HINT, SEARCH_HINT, filtersSpoken } from './discoveryWords';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { capsuleCollapse, chromeJoin } from './discoveryChrome';

/** The bar's distance from the top of the map. */
export const BAR_TOP = sys.space.md;
/** Filter touch and its count stay together inside the toolbar. */
const FILTERS_SIZE = 56;

/** Compact map controls: Back, search, filters and the existing secondary menu share one white surface.
 * A real active query/place is shown in its own clearable row; there is no permanently empty search field.
 * Both rows stay above the scrolling capsules and are included in the compact FULL measurement.
 * Notices remain outside that measurement so permission/error feedback never moves the sheet stops.
 */
export function DiscoverySearchBar({ where, onBack, onSearch, onMore, onClearWhere, filters, onLayout, onSearchLayout, motion, chips, below }: {
  /** Active search/area, in one line; null when nothing is. */ where: string | null;
  onSearch: () => void;
  onBack?: () => void;
  /** Secondary account/publication entries share one menu so the map does not need a second header. */
  onMore?: () => void;
  /** Set while the list is narrowed to what the pill says: the summary's "×" takes that narrowing away. */
  onClearWhere?: () => void;
  /** The round button of the filters beside the pill, with how many conditions are on (none: no number). */
  filters?: { count: number; onPress: () => void };
  /** The lower edge of the pill and its capsules from the top of the map: where the list stops when it is all the way up. */
  onLayout: (bottom: number) => void;
  onSearchLayout?: (bottom: number) => void;
  motion?: { sheetTop: SharedValue<number>; offset: SharedValue<number>; compactTop: number; capsules: number; hidden: boolean };
  /** The row of capsules, under the pill. It is part of the measured edge. */
  chips?: ReactNode;
  /** Floats over the map under the capsules: a notice. Not part of the measured edge. */
  below?: ReactNode;
}) {
  const measure = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    onLayout(Math.ceil(BAR_TOP + y + height));
  };
  const backing = useAnimatedStyle(() => {
    if (!motion) return { opacity: 0 };
    const joined = chromeJoin(motion.sheetTop.value, motion.compactTop, motion.capsules);
    return { opacity: joined, transform: [{ translateY: -capsuleCollapse(motion.offset.value, motion.capsules) * joined }] };
  });
  const capsules = useAnimatedStyle(() => {
    if (!motion) return {};
    const collapse = capsuleCollapse(motion.offset.value, motion.capsules)
      * chromeJoin(motion.sheetTop.value, motion.compactTop, motion.capsules);
    return { transform: [{ translateY: -collapse }] };
  });
  return <>
    {motion ? <Animated.View testID="discovery-chrome-backing" pointerEvents="none" accessible={false}
      style={[s.backing, { height: motion.compactTop + motion.capsules }, backing]} /> : null}
    <View pointerEvents="box-none" style={s.bar}>
    <View testID="discovery-search-stack" pointerEvents="box-none" style={s.stack} onLayout={measure}>
      <View testID="discovery-search-row" pointerEvents="box-none" style={s.row}
        onLayout={event => onSearchLayout?.(Math.ceil(BAR_TOP + event.nativeEvent.layout.y + event.nativeEvent.layout.height))}>
        <Surface kind="float" style={s.searchSurface}>
          <View style={s.controls}>
            {onBack ? <ChromeIconButton label="Nazad" glyph="back" quiet onPress={onBack} /> : null}
            <T variant="bodyStrong" numberOfLines={1} style={s.title}>Zadaci</T>
            <Press accessibilityRole="button" accessibilityLabel="Pretraži zadatke" accessibilityValue={where ? { text: where } : undefined}
              accessibilityHint={SEARCH_HINT} haptic="select" scaleTo={sys.motion.scale.row} onPress={onSearch}
              hitSlop={0} style={s.searchButton}>
              <Glyph name="search" size={20} tone="ink" strong />
            </Press>
            {filters ? <FiltersButton count={filters.count} onPress={filters.onPress} /> : null}
            {onMore ? <ChromeIconButton label="Još mogućnosti" hint="Objava zadatka, profil i obaveštenja." glyph="more" quiet onPress={onMore} /> : null}
          </View>
          {where ? <View testID="discovery-search-context" style={s.context}>
            <Press accessibilityRole="button" accessibilityLabel="Aktivna pretraga" accessibilityValue={{ text: where }} accessibilityHint={SEARCH_HINT}
              haptic="select" onPress={onSearch} hitSlop={0} style={s.contextText}>
              <T variant="meta" numberOfLines={1} style={s.where}>{where}</T>
            </Press>
            {onClearWhere ? <Press testID="clear-where" accessibilityRole="button" accessibilityLabel="Prikaži sve zadatke"
              haptic="select" scaleTo={sys.motion.scale.button} hitSlop={0} onPress={onClearWhere} style={s.clear}>
              <Glyph name="close" size={16} tone="ink" />
            </Press> : null}
          </View> : null}
        </Surface>
      </View>
      <View testID="discovery-chips-clip" collapsable={false} style={s.chipsClip}
        pointerEvents={motion?.hidden ? 'none' : 'box-none'} accessibilityElementsHidden={!!motion?.hidden}
        importantForAccessibility={motion?.hidden ? 'no-hide-descendants' : 'auto'}>
        <Animated.View testID="discovery-collapsing-chips" style={capsules}>{chips}</Animated.View>
      </View>
    </View>
    {below}
  </View></>;
}

/** The filter count stays visible and spoken; the shared header owns the surface and shadow. */
function FiltersButton({ count, onPress }: { count: number; onPress: () => void }) {
  return <View style={s.filtersSurface}>
    <Press testID="filters-button" accessibilityRole="button" accessibilityLabel={filtersSpoken(count)} accessibilityHint={FILTERS_HINT}
      accessibilityState={{ selected: count > 0 }} haptic="select" scaleTo={sys.motion.scale.button} hitSlop={0} onPress={onPress} style={s.filtersTouch}>
      <Glyph name="filters" size={24} tone="ink" />
    </Press>
    {count > 0 ? <View testID="filters-count" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.badge}>
      <T variant="label" style={s.badgeText}>{count}</T>
    </View> : null}
  </View>;
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
  backing: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: sys.color.surface },
  chipsClip: { overflow: 'hidden' },
  bar: { position: 'absolute', top: BAR_TOP, left: 0, right: 0, gap: sys.space.sm },
  // The header and quick filters share the established measured gap.
  stack: { gap: sys.space.sm },
  row: { paddingHorizontal: sys.space.base },
  searchSurface: { minWidth: 0, borderRadius: sys.radius.card },
  controls: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: sys.space.xs, minHeight: 56 },
  title: { flex: 1, minWidth: 0, paddingHorizontal: sys.space.xs },
  searchButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill },
  context: { flexDirection: 'row', alignItems: 'center', paddingLeft: sys.space.base, paddingRight: sys.space.xs },
  contextText: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center', paddingRight: sys.space.sm },
  where: { lineHeight: 20, color: sys.color.ink },
  clear: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  // The touch fills this control; its count sits at the upper right.
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
