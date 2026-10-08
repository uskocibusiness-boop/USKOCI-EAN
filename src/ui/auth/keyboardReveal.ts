import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type RefObject } from 'react';
import { Keyboard, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useReducedMotion } from '../system/motion';
import { sys } from '../system/tokens';

/**
 * Keeps the field that is being typed in on the screen (owner, on the phone and on the emulator, 2026-10-07: with the keyboard
 * up, the "Lozinka" field vanished behind the pinned "Prijavi se").
 *
 * WHY IT VANISHED. The sheet is a column: bar, a scroll area, and a foot that is pinned under it and rises with the keyboard.
 * The keyboard shrinks the whole column, so the scroll area gets short, but a scroll area does not move by itself when it gets
 * short: the second field stayed where it had been, now below the part that is still visible, with the green button standing
 * where the field had been. Nothing scrolled it into view.
 *
 * WHAT THIS DOES. When a field takes focus, and again whenever the scroll area changes size (which is what the keyboard coming
 * up does to it) or the keyboard finishes opening, it measures the field and the scroll area in window coordinates and scrolls
 * by exactly what is needed to bring the whole field into view with `sys.space.base` of air around it. Window coordinates
 * make it independent of how the field is nested, and of whether the layout is resized by the system or by
 * KeyboardAvoidingView; the keyboard's own top edge is also taken as the lower limit, so a layout that was NOT resized (the
 * keyboard lying over the bottom of the screen) is covered as well.
 */

/** Anything that can say where it is in the window (a View, a ScrollView). Optional, because a test double or the web may not. */
export type RevealBox = { measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void };
export type RevealScroll = RevealBox & { scrollTo?: (options: { x?: number; y?: number; animated?: boolean }) => void };

/**
 * How far to scroll (positive: down, content moves up) so that the box between `top` and `bottom` is fully inside the box
 * between `viewTop` and `viewBottom`, with `margin` of air. 0 when it is already visible. A field taller than the room shows
 * its top, which is where its label is.
 */
export function revealDelta({ top, bottom, viewTop, viewBottom, margin }: {
  top: number; bottom: number; viewTop: number; viewBottom: number; margin: number;
}): number {
  const room = viewBottom - viewTop;
  if (bottom - top + 2 * margin > room) return top - margin - viewTop;
  if (bottom + margin > viewBottom) return bottom + margin - viewBottom;
  if (top - margin < viewTop) return top - margin - viewTop;
  return 0;
}

/** What a field tells the sheet: it has been focused, or let go. `box` is the view to keep on screen (the whole field). */
export type FocusReveal = {
  focus: (box: RefObject<RevealBox | null>) => void;
  blur: (box: RefObject<RevealBox | null>) => void;
};

const NOTHING: FocusReveal = { focus: () => undefined, blur: () => undefined };
/** A field outside a sheet that keeps fields on screen (a gallery, a test) reveals nothing. */
export const FocusRevealContext = createContext<FocusReveal>(NOTHING);
export const useFocusRevealContext = (): FocusReveal => useContext(FocusRevealContext);

/** The air around the field that is kept in view. */
export const REVEAL_MARGIN = sys.space.base;

export function useFocusReveal(scroll: RefObject<RevealScroll | null>) {
  const offset = useRef(0);
  const focused = useRef<RefObject<RevealBox | null> | null>(null);
  const ticket = useRef(0);
  // The scroll glides unless the person asked the phone for no motion (one source for that: `ui/system/motion`).
  const reduced = useReducedMotion();
  const glide = useRef(!reduced);
  glide.current = !reduced;

  const reveal = useCallback(() => {
    const view = scroll.current, box = focused.current?.current;
    if (!view?.measureInWindow || !box?.measureInWindow) return;
    // A newer request retires an older one, so a slow measure never scrolls to where the field used to be.
    const mine = ++ticket.current;
    view.measureInWindow((_x, viewTop, _width, viewHeight) => {
      if (mine !== ticket.current) return;
      box.measureInWindow?.((_fx, top, _fw, height) => {
        if (mine !== ticket.current) return;
        let viewBottom = viewTop + viewHeight;
        // A keyboard that lies over the screen instead of shrinking it still ends the visible part where it begins.
        const keyboardTop = Keyboard.isVisible?.() ? Keyboard.metrics?.()?.screenY : undefined;
        if (keyboardTop !== undefined && keyboardTop > viewTop && keyboardTop < viewBottom) viewBottom = keyboardTop;
        const delta = revealDelta({ top, bottom: top + height, viewTop, viewBottom, margin: REVEAL_MARGIN });
        if (Math.abs(delta) >= 1) view.scrollTo?.({ y: Math.max(0, offset.current + delta), animated: glide.current });
      });
    });
  }, [scroll]);

  const api = useMemo<FocusReveal>(() => ({
    focus: box => { focused.current = box; reveal(); },
    blur: box => { if (focused.current === box) focused.current = null; },
  }), [reveal]);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', reveal);
    return () => subscription.remove();
  }, [reveal]);

  return {
    api,
    /** For the ScrollView: where it is scrolled to, so a change is relative to it. */
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => { offset.current = event.nativeEvent.contentOffset.y; },
    /** For the ScrollView: it changed size (the keyboard came up or went), so look at the focused field again. */
    onLayout: (_event: LayoutChangeEvent) => { if (focused.current) reveal(); },
  };
}
