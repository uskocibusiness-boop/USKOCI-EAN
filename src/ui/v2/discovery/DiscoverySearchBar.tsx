import type { ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { Glyph } from '../../system/Glyph';
import { ChromeIconButton, chrome } from '../../system/ScreenChrome';
import { sys } from '../../system/tokens';

/** The bar's distance from the top of the map. */
export const BAR_TOP = sys.space.md;
/** The search pill's own clear button: a full 48 wide, as high as the pill, at its right end. */
const CLEAR_WIDTH = 48;

/**
 * The top of the Zadaci map (Discovery V47; Airbnb's search bar, USKOČI's look; filters low, UX plan section P variant B). One white
 * search pill, with the magnifier, says the current search in one line — where, then when and the other conditions in quieter
 * words — and opens the search panel. There is no typing field on the map: the words are typed in the panel's own sections (owner,
 * 2026-10-07). The adjacent menu preserves secondary destinations without another header. Search and the menu share one surface.
 * It is the SUMMARY of the search and stays at the top at every height of the list; the filters are not here any more: the row
 * of chips (`DiscoveryChipRow`) comes in `below` it while the list is lowered, and from half height up it is the list's own
 * sticky header, where a thumb reaches it.
 *
 * While the list is narrowed to the map's area or to one point, the pill carries its own "×" at its right end, "Prikaži
 * sve zadatke": the way back to every task is where the narrowing is said, not a chip that would appear under the
 * list's count and move the sheet each time the map moves (review of V47). It lies over the pill's end, so the pill is
 * exactly as tall with it as without it.
 *
 * `onLayout` reports the pill's own lower edge, from the top of the map, and nothing that hangs `below` it: whatever is
 * drawn there floats over the map and never moves the list sheet's stops.
 */
export function DiscoverySearchBar({ where, conditions, onSearch, onMore, onClearWhere, onLayout, below }: {
  /** Line 1: where the search looks. */ where: string;
  /** Line 2: when, and the other conditions (or "Dodaj uslove"). */ conditions: string;
  onSearch: () => void;
  /** Secondary account/publication entries share one menu so the map does not need a second header. */
  onMore?: () => void;
  /** Set while the list is narrowed to the map's area or to one point: the pill's "×" takes that narrowing away. */
  onClearWhere?: () => void;
  /** The pill's lower edge from the top of the map: where the strip under the search begins. */
  onLayout: (bottom: number) => void;
  /** Floats over the map under the pill: the row of chips while the list is lowered, and a notice. Not part of the measured edge. */
  below?: ReactNode;
}) {
  const measure = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    onLayout(Math.ceil(BAR_TOP + y + height));
  };
  return <View pointerEvents="box-none" style={s.bar}>
    <View testID="discovery-search-row" pointerEvents="box-none" style={s.row} onLayout={measure}>
      <View style={s.searchSurface}>
        <View style={s.search}>
          <Press accessibilityRole="button" accessibilityLabel="Pretraži zadatke" accessibilityValue={{ text: `${where}, ${conditions}` }}
            accessibilityHint="Otvara pretragu: gde, kada i uslovi." haptic="select" scaleTo={sys.motion.scale.row} onPress={onSearch}
            style={[s.pill, s.pillWide, onClearWhere && s.pillClearable]}>
            <Glyph name="search" size={20} tone="ink" strong />
            <View style={s.lines}>
              {/* One line, as Airbnb's pill: where, then when and the other conditions in quieter words after it. The full
                  values are spoken (the Pressable's value) and written out in the search panel. */}
              <T variant="bodyStrong" style={s.where} numberOfLines={1}>{where}
                {conditions ? <T variant="body" tone="muted" style={s.rest}>{` · ${conditions}`}</T> : null}</T>
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
      </View>
    </View>
    {below}
  </View>;
}

/**
 * What "U blizini" says when it cannot do its one job (no permission, the location switched off, no answer in time), or while it
 * is asking: a quiet white line under the search, with the way to the settings when that is the remedy. A polite live region, so a
 * screen reader hears it without losing its place.
 */
export function NearbyNotice({ message, onSettings }: { message: string; onSettings?: () => void }) {
  return <View testID="nearby-notice" style={s.notice} accessibilityLiveRegion="polite">
    <T variant="note" style={s.noticeText}>{message}</T>
    {onSettings ? <Press accessibilityRole="button" accessibilityLabel="Podešavanja lokacije" hitSlop={0}
      onPress={onSettings} style={s.settings}><T variant="note" style={s.settingsText}>Podešavanja</T></Press> : null}
  </View>;
}

const s = StyleSheet.create({
  bar: { position: 'absolute', top: BAR_TOP, left: 0, right: 0, gap: sys.space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingHorizontal: sys.space.base },
  search: { flex: 1, minWidth: 0 },
  // One lifted surface owns the search and its controls. The map no longer carries three competing white discs.
  searchSurface: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', paddingRight: 4,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line,
    ...sys.elevation.soft },
  pill: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 56, paddingLeft: sys.space.base,
    paddingRight: sys.space.sm, paddingVertical: sys.space.sm, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.surface },
  // The words end where the clear button begins.
  pillClearable: { paddingRight: CLEAR_WIDTH },
  pillWide: { borderRadius: sys.radius.card },
  lines: { flex: 1, minWidth: 0 },
  where: { lineHeight: 20, color: sys.color.ink },
  // The quieter rest of the one line keeps the first part's line height, so the pill is as tall with it as without it.
  rest: { lineHeight: 20 },
  // Over the pill's right end, from its top edge to its bottom edge: never taller than the pill, never under 48 wide.
  clear: { position: 'absolute', top: 0, bottom: 0, right: 0, width: CLEAR_WIDTH, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  clearCircle: { width: 28, height: 28, borderRadius: sys.radius.pill, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center' },
  tool: { width: chrome.control, height: chrome.control },
  notice: { marginHorizontal: sys.space.base, paddingHorizontal: sys.space.md, paddingVertical: sys.space.sm,
    borderRadius: sys.radius.control, backgroundColor: sys.color.surface, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm },
  noticeText: { color: sys.color.ink, flexGrow: 1, flexBasis: 180 },
  settings: { minHeight: 48, justifyContent: 'center', paddingHorizontal: sys.space.sm },
  settingsText: { color: sys.color.ink, fontWeight: '600' },
});
