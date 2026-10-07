import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, { type BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import type { SharedValue } from 'react-native-reanimated';
import { SHEET_SPRING } from '../../product/ProductSheet';
import { sheetLift, sys } from '../../system/tokens';

/** The sheet's three heights, in this order: its top line only, half the map, the whole list under the search (a strip of map above it). */
export const SNAP = { peek: 0, half: 1, full: 2 } as const;

/**
 * The sheet's surface: white, with its corners, its hairline and its lift at EVERY height. At the full stop a strip of map still shows
 * above it (the zoom buttons and "U blizini" stand there), so the sheet is a sheet over the map to the end and never joins the
 * search surface as it did while it covered the map whole.
 */
const ListBackground = ({ style }: BottomSheetBackgroundProps) => <View testID="discovery-sheet-background" pointerEvents="none"
  accessible={false} importantForAccessibility="no" style={[style, s.background]} />;
/** The sunk sheet draws nothing: its edge and upward shadow would show as a sliver under the pin card. */
const SunkBackground = ({ style }: BottomSheetBackgroundProps) => <View pointerEvents="none" accessible={false}
  importantForAccessibility="no" style={[style, s.background, s.sunk]} />;

/**
 * The list of Zadaci as a sheet over the map (owner step 4, 2026-09-24): the sheet IS the list, so there is no Lista/Mapa
 * switch. It never closes; it rests at one of three heights ("mapa je glavna", half, "lista je glavna") and its top line (the
 * count, which is also the handle: a tap goes to the next height, a drag moves it) is there to take hold of, except while a
 * pin's card covers it: then the screen lowers the lowest height to a sliver behind the card and the sheet is `sunk`: its
 * background is not drawn (no hairline, no shadow peeking out under the card) and nothing in it reaches a screen reader. It
 * sits inside the screen, and the screen ends where the tab bar begins, so the sheet never slides under the bar and the bar
 * shows at every height.
 *
 * Below the top line stands the `sticky` row of chips (from half height up it is what a thumb reaches), and under it the list.
 * It moves on ONE critically damped spring that cannot overshoot (`SHEET_SPRING`: clamped), and a drag past its first or last
 * stop does not stretch it (`enableOverDrag` is off): the sheet stops where its stops are and never bounces or shakes. There is
 * no dimming of the map behind it: the map's buttons stand directly above the sheet and move with it, and a veil over the map
 * would grey them while they rise. Under reduced motion it changes height at once.
 */
export function DiscoveryListSheet({ index, snapPoints, position, reduced, animateOnMount = false, onIndex, onAnimate, header, sticky, sunk = false,
  children }: {
  index: number; snapPoints: readonly (number | string)[];
  /** Where the sheet's top edge is, for the map's controls that ride on it. */ position?: SharedValue<number>;
  reduced: boolean; animateOnMount?: boolean; onIndex: (index: number) => void;
  /** Native spring start; used only to decide whether a focus return can safely retain this exact mount. */
  onAnimate?: (fromIndex: number, toIndex: number) => void;
  /** The top line: always visible, never scrolled away. */ header: ReactNode;
  /** The row of chips under the top line: pinned, never scrolled away with the list. */ sticky?: ReactNode;
  /** A pin's card lies over the sheet's top line: the sheet steps out of sight and out of reach behind it. */ sunk?: boolean;
  /** The list itself (a `BottomSheetFlatList`). */ children: ReactNode;
}) {
  return <BottomSheet index={index} snapPoints={snapPoints as (number | string)[]} enableDynamicSizing={false} enablePanDownToClose={false}
    enableOverDrag={false}
    animateOnMount={animateOnMount} animatedPosition={position} onAnimate={onAnimate} onChange={next => { if (next >= 0) onIndex(next); }}
    animationConfigs={reduced ? { duration: 0 } : SHEET_SPRING} handleComponent={null} backgroundComponent={sunk ? SunkBackground : ListBackground}
    accessible={false} accessibilityRole="none" accessibilityLabel={sunk ? null : 'Lista zadataka'}
    keyboardBehavior="extend" keyboardBlurBehavior="restore">
    <View testID="list-sheet-content" style={s.content} accessibilityElementsHidden={sunk}
      importantForAccessibility={sunk ? 'no-hide-descendants' : 'auto'}>{header}{sticky}{children}</View>
  </BottomSheet>;
}

const s = StyleSheet.create({
  // It floats over the map: the sheet corner, the hairline along its top, a soft lift cast upwards because the sheet
  // rises from the bottom (the system's docked sheet lift, review r3 item 5 and r3b).
  background: { backgroundColor: sys.color.surface, borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet,
    borderWidth: 1, borderBottomWidth: 0, borderColor: sys.color.line, ...sheetLift.docked },
  sunk: { opacity: 0 },
  content: { flex: 1 },
});
