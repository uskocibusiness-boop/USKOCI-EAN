import { Linking, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { Press } from '../../Press';
import { T } from '../../Text';
import { ActionSheet } from '../../system/ActionSheet';
import { Glyph } from '../../system/Glyph';
import { sys } from '../../system/tokens';
import { CONTROL_SIZE, controlsReserve } from './mapClearBand';
import { useCoverValue, useRidingStyle } from './mapControls';

/** The sources a map of OpenStreetMap data and OpenMapTiles drawn by OpenFreeMap has to name (their licences ask for it). */
export const CREDITS = [
  { text: '© OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' },
  { text: '© OpenMapTiles', url: 'https://www.openmaptiles.org/' },
  { text: 'OpenFreeMap', url: 'https://openfreemap.org/' },
] as const;

/** The row's inset from the map's left edge, and the air between a word and its (i). */
const INSET = sys.space.base;

/**
 * The map's sources (the owner's phone of 8 Oct 2026: "mali, jedna linija, u donjem levom uglu iznad liste, bez velike bele kutije"). One
 * line of 12 px words and an (i), at the bottom left of the row that stands directly above the list sheet, riding it like "moja lokacija"
 * on the right of the same row (`useRidingStyle`): the sheet's position is a shared value, the row follows it on the UI thread, lifts above
 * a pin's card (`coverBottom`) and fades where the list leaves no map. The row is 44 high and every part of it is touch (the (i) too), but the
 * words sit at its bottom edge, the nearest the map gets to the list. No box: a soft halo of the map's own white keeps the words readable over
 * a street, a park or the water. `locate` says whether "moja lokacija" stands at the right end of the row, which the words keep clear of.
 */
export function MapCredits({ sheetTop, coverBottom, height, minTop, locate, reduced, onPress }: {
  sheetTop?: SharedValue<number>;
  /** How much of the map's bottom a card covers (its gap to the screen included); 0 when there is no card. */ coverBottom: number;
  /** The map's own height in pixels. */ height: number;
  /** The highest the row may stand: one gap under the tools. */ minTop: number;
  locate: boolean; reduced: boolean; onPress: () => void;
}) {
  const cover = useCoverValue(coverBottom, reduced);
  const ride = useRidingStyle({ sheetTop, cover, height, rowHeight: CONTROL_SIZE, gap: sys.space.md, minTop });
  return <Animated.View testID="discovery-map-credits-layer" pointerEvents="box-none" style={[s.layer, ride]}>
    <View testID="discovery-map-credits" pointerEvents="box-none" style={[s.attribution, { right: INSET + controlsReserve(locate) }]}>
      <Press accessibilityRole="button" accessibilityLabel="Izvori mape: © OpenStreetMap, © OpenMapTiles, OpenFreeMap"
        accessibilityHint="Otvara izvore i licence mape." hitSlop={0} style={s.link} onPress={onPress}>
        <T variant="label" style={s.credit} numberOfLines={1}>© OpenStreetMap · © OpenMapTiles</T><Glyph name="info" size={16} tone="muted" />
      </Press>
    </View>
  </Animated.View>;
}

/** The sources, as the licences ask them to be reachable: each opens its own page. */
export function MapSources({ reduced, onClose }: { reduced: boolean; onClose: () => void }) {
  return <ActionSheet title="Izvori mape" reduced={reduced} onClose={onClose} actions={CREDITS.map(credit => ({
    key: credit.url, label: credit.text, icon: 'map' as const, hint: 'Otvara izvor u pregledaču.',
    onPress: () => { void Linking.openURL(credit.url).catch(() => {}); },
  }))} />;
}

const s = StyleSheet.create({
  // The row's layer: as wide as the map and as tall as its row; the UI thread moves it.
  layer: { position: 'absolute', left: 0, right: 0, top: 0, height: CONTROL_SIZE },
  attribution: { position: 'absolute', left: INSET, top: 0, bottom: 0, alignItems: 'flex-start', justifyContent: 'flex-end' },
  link: { maxWidth: '100%', minHeight: CONTROL_SIZE, flexDirection: 'row', alignItems: 'flex-end', gap: sys.space.xs, paddingBottom: sys.space.xs },
  credit: { fontWeight: '400', letterSpacing: 0, color: sys.color.muted, flexShrink: 1,
    textShadowColor: sys.color.surface, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
});
