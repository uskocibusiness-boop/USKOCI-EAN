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
 * through this context, and gives the navigator the style that follows the value (`zadaciBarStyle`). The screen drives the value from the
 * list's height (`useZadaciBarMotion`). Without a layout (a gallery, a test) there is no context, and the screen draws and does as it did
 * without a bar: nothing is reserved and nothing moves.
 */
export type ZadaciBar = { hidden: Animated.Value; height: number };
export const ZadaciBarContext = createContext<ZadaciBar | null>(null);
export const useZadaciBar = () => useContext(ZadaciBarContext);

/** What the navigator's own style for a tab is (the layout builds it for every tab; this is the one the Zadaci tab changes). */
export type TabBarBase = ViewStyle & { height: number; marginBottom: number };

/**
 * The bar's style while Zadaci is the tab on show: the same bar, over the bottom of the screen, translated by `hidden`. Its margin under it
 * (the system inset or 12) becomes white padding inside it, so the bar still reaches the bottom of the screen and nothing of the map or the
 * list shows through under it; the touch part of the bar keeps its height and its place above that padding.
 */
export function zadaciBarStyle(base: TabBarBase, bar: ZadaciBar): Animated.WithAnimatedValue<ViewStyle> {
  const margin = base.marginBottom, away = base.height + margin + 1;
  return { ...base, position: 'absolute', left: 0, right: 0, bottom: 0, marginBottom: 0, height: base.height + margin, paddingBottom: margin,
    transform: [{ translateY: bar.hidden.interpolate({ inputRange: [0, 1], outputRange: [0, away] }) }] } as Animated.WithAnimatedValue<ViewStyle>;
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
 * under reduced motion. `announce` takes the answer one step earlier than the render does: the sheet says where it is going the moment it
 * starts to move (a drag let go of), and the bar leaves or arrives with it instead of after it.
 */
export function useZadaciBarMotion({ bar, shown, active, reduced }: { bar: ZadaciBar | null; shown: boolean; active: boolean; reduced: boolean }) {
  const placed = useRef(false), wanted = useRef<boolean | null>(null), running = useRef<Animated.CompositeAnimation | null>(null);
  const drive = useCallback((next: boolean, now: boolean) => {
    if (!bar) return;
    running.current?.stop(); running.current = null;
    wanted.current = next;
    if (now || reduced) { bar.hidden.setValue(next ? 0 : 1); return; }
    running.current = slide(bar.hidden, next);
    running.current.start();
  }, [bar, reduced]);
  useLayoutEffect(() => {
    if (!bar || !active) { placed.current = false; return; }
    if (placed.current && wanted.current === shown) return;
    drive(shown, !placed.current);
    placed.current = true;
  }, [bar, active, shown, drive]);
  useLayoutEffect(() => () => { running.current?.stop(); running.current = null; }, []);
  /** The sheet starts to move to a stop: the bar follows at once (never before the first answer, and never for a screen that is not in front). */
  const announce = useCallback((next: boolean) => {
    if (!bar || !active || !placed.current || wanted.current === next) return;
    drive(next, false);
  }, [bar, active, drive]);
  return { announce };
}
