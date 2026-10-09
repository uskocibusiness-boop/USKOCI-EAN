import { createContext, useCallback, useContext, useLayoutEffect, useRef } from 'react';
import { Animated, Easing, Platform, type ViewStyle } from 'react-native';
import { sys } from '../../system/tokens';

/**
 * The bottom navigation on Zadaci (the owner's phone of 8 Oct 2026): "dok je lista dole, donja navigacija se ne vidi; pojavi se kad se
 * lista digne na pola ili skroz". On this one screen the navigator's bar is drawn over the bottom of the screen instead of under it, and
 * slides away (a translation, never a change of size) while the list rests at its top line or a pin's card stands at the bottom; it comes
 * back with the half and the full stop. On every other screen the bar is where it always was.
 *
 * The layout (`app/(app)/_layout`) owns the bar, so it owns the one value that moves it (`hidden`: 0 the bar is on show, 1 it is away) and
 * says how tall it is (`height`, its own height and the margin under it, which is the system inset or 12). It hands both to the screen
 * through this context. ZadaciNavigationBar moves a separate host; zadaciBarStyle keeps the inner geometry static. The screen drives the value from the
 * list's height (`useZadaciBarMotion`). Without a layout (a gallery, a test) there is no context, and the screen draws and does as it did
 * without a bar: nothing is reserved and nothing moves.
 */
export type ZadaciBar = { hidden: Animated.Value; height: number;
  /** React owns the settled native visibility as well as the animated translation. */ setVisible?: (visible: boolean) => void };
export const ZadaciBarContext = createContext<ZadaciBar | null>(null);
export const useZadaciBar = () => useContext(ZadaciBarContext);

/** What the navigator's own style for a tab is (the layout builds it for every tab; this is the one the Zadaci tab changes). */
export type TabBarBase = ViewStyle & { height: number; marginBottom: number };

/**
 * The inner bar's static style while Zadaci is on show. Its outer host owns the discovery translation. Its margin under it
 * (the system inset or 12) becomes white padding inside it, so the bar still reaches the bottom of the screen and nothing of the map or the
 * list shows through under it; the touch part of the bar keeps its height and its place above that padding.
 */
export function zadaciBarStyle(base: TabBarBase, bar: ZadaciBar): Animated.WithAnimatedValue<ViewStyle> {
  const margin = base.marginBottom;
  return { ...base, position: 'absolute', left: 0, right: 0, bottom: 0, marginBottom: 0, height: bar.height, paddingBottom: margin };
}

/** HALF tolerance must never include PEEK, even when large text leaves only one pixel between stops. */
export function zadaciBarRevealTop(bodyHeight: number, peekHeight: number, halfHeight: number): number {
  return Math.min(bodyHeight - halfHeight + 1, bodyHeight - peekHeight - 0.5);
}

/** The bar's slide: entering is longer than leaving and decelerates (rule R2), on the native driver (only a translation moves). */
function slide(hidden: Animated.Value, shown: boolean): Animated.CompositeAnimation {
  return Animated.timing(hidden, { toValue: shown ? 0 : 1, duration: shown ? sys.motion.enter : sys.motion.exit,
    easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: Platform.OS !== 'web' });
}

/**
 * Drives the bar from the list. `shown` is whether the bar belongs on screen (the list is at half or full and no card stands at the
 * bottom); `active` whether this screen is the one in front. The first answer of a visit (and a return to the screen) puts the bar in place
 * at once, so a screen that opens with its list low never shows the bar for a frame; later answers slide it, or put it in place at once
 * under reduced motion. The navigator also receives settled visibility, so a native animated-props reattachment cannot leave an
 * invisible-state bar intercepting touches over the sheet. Interrupted animations cannot publish an obsolete completion.
 */
export function useZadaciBarMotion({ bar, shown, active, reduced }: { bar: ZadaciBar | null; shown: boolean; active: boolean; reduced: boolean }) {
  const placed = useRef(false), wanted = useRef<boolean | null>(null), running = useRef<Animated.CompositeAnimation | null>(null), generation = useRef(0);
  const drive = useCallback((next: boolean, now: boolean) => {
    if (!bar) return;
    const command = ++generation.current;
    running.current?.stop(); running.current = null;
    wanted.current = next;
    if (now || reduced) { bar.hidden.setValue(next ? 0 : 1); bar.setVisible?.(next); return; }
    if (next) bar.setVisible?.(true);
    running.current = slide(bar.hidden, next);
    running.current.start(({ finished }) => {
      if (finished && generation.current === command) bar.setVisible?.(next);
    });
  }, [bar, reduced]);
  useLayoutEffect(() => {
    if (!bar || !active) { generation.current++; running.current?.stop(); running.current = null; placed.current = false; return; }
    if (placed.current && wanted.current === shown) return;
    drive(shown, !placed.current);
    placed.current = true;
  }, [bar, active, shown, drive]);
  useLayoutEffect(() => () => { generation.current++; running.current?.stop(); running.current = null; }, []);
  /** The sheet starts to move to a stop: the bar follows at once (never before the first answer, and never for a screen that is not in front). */
  const announce = useCallback((next: boolean) => {
    if (!bar || !active || !placed.current || wanted.current === next) return;
    drive(next, false);
  }, [bar, active, drive]);
  return { announce };
}
