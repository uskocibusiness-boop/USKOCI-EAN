import { useEffect, useRef } from 'react';
import { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { sys } from '../../system/tokens';
import { controlsTop, sheetEdge } from './mapClearBand';

/**
 * How the map's controls ride the list sheet (UX plan section P). The row of controls (zoom, "U blizini") stands directly above the
 * sheet's top edge and goes up and down with it, on the UI thread: the sheet's position is a shared value, the row's place is a
 * pure function of it (`controlsTop`), and React renders nothing while the sheet moves. A pin's card that lies over the map's bottom
 * lifts the row above the card instead (`cover`).
 *
 * Nothing here overshoots. The cover follows the card on the system's one sheet settle (critically damped, clamped: it cannot go past
 * where it is going) when the card comes up, and on the short decelerating close timing when it goes, as the card itself does; under
 * reduced motion it is simply there.
 */

/**
 * How much of the map's bottom a pin's card covers, moving to a new value without a bounce. `coverBottom` is 0 when there is no card.
 * Both screens that draw a control read it, so the zoom buttons (in the map) and "U blizini" (beside the list) move as one row.
 */
export function useCoverValue(coverBottom: number, reduced: boolean): SharedValue<number> {
  const cover = useSharedValue(Math.max(0, coverBottom));
  // What the cover is moving to. A card that has not changed asks for no motion (not even on the first render).
  const target = useRef(Math.max(0, coverBottom));
  useEffect(() => {
    const next = Math.max(0, coverBottom);
    if (reduced) { target.current = next; cover.value = next; return; }
    if (next === target.current) return;
    const rising = next > target.current;
    target.current = next;
    cover.value = rising
      ? withSpring(next, sys.motion.sheetSpring)
      : withTiming(next, { duration: sys.motion.sheetClose, easing: Easing.bezier(...sys.motion.easeOut) });
  }, [coverBottom, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  return cover;
}

/**
 * The style of the row's layer: it moves down from the top of the map to `controlsTop` of the sheet's edge. The layer is as tall as
 * the row and as wide as the map; the controls are placed inside it. Without a sheet (a map drawn alone) the row stands at the
 * map's bottom edge.
 */
export function useRidingStyle({ sheetTop, cover, height, rowHeight, gap, minTop }: {
  sheetTop?: SharedValue<number>; cover: SharedValue<number>;
  /** The map's own height in pixels. */ height: number;
  rowHeight: number; gap: number;
  /** The highest the row may stand: the strip under the search pill (the sheet is full when the row is there). */ minTop: number;
}) {
  return useAnimatedStyle(() => {
    const edge = sheetEdge(sheetTop ? sheetTop.value : height, height, cover.value);
    return { transform: [{ translateY: controlsTop(edge, rowHeight, gap, minTop) }] };
  }, [sheetTop, cover, height, rowHeight, gap, minTop]);
}
