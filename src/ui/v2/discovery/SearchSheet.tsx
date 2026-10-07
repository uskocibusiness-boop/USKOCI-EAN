import { useContext, useEffect, useMemo, useRef, useState, type Context, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as SafeArea from 'react-native-safe-area-context';
import { T } from '../../Text';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { sheetLift, sys } from '../../system/tokens';
import { SearchBackdrop, type BackdropKind } from './SearchBackdrop';

/** How much of the screen the panel covers when it opens; the rest is the blurred screen behind it, and a tap there closes it. */
export const SHEET_RATIO = 0.85;

/**
 * The window's insets, read from the provider's context and never from a native SafeAreaView inside the moving sheet: a
 * SafeAreaView pads by where it sits on screen at that moment, and inside a sheet that slides and changes height every move
 * changed the padding, which moved the sheet again (the "shaking" of the other sheets, owner 2026-10-07). A test double that
 * leaves the context out reads 0.
 */
const InsetsContext = (SafeArea as { SafeAreaInsetsContext?: Context<{ top: number; bottom: number } | null> }).SafeAreaInsetsContext;
const useTopInset: () => number = InsetsContext ? () => useContext(InsetsContext)?.top ?? 0 : () => 0;
const useBottomInset: () => number = InsetsContext ? () => useContext(InsetsContext)?.bottom ?? 0 : () => 0;

/** Whether the keyboard is up: the bottom inset is under it then, and the footer must not be padded twice. */
function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener?.(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener?.(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setShown(false));
    return () => { show?.remove?.(); hide?.remove?.(); };
  }, []);
  return shown;
}

const easeOut = Easing.bezier(...sys.motion.easeOut);

/**
 * The search panel's frame: a tall white sheet over the screen it opened on (UX plan 2.19, 2.20). The screen behind is
 * blurred when the platform can, and dimmed when it cannot; the sheet rises over `sheetSpring` and leaves on `sheetClose`,
 * and the backdrop fades with it. It rests at 85 % of the screen. `expanded` grows it to the full height below the status
 * bar (the place list filling the screen) and `false` brings it back, over the same spring; its top corners square off as it
 * fills the screen. Under reduced motion nothing moves: the sheet is there, and then it is gone.
 *
 * It owns only the frame and its motion. What the panel says and does is the caller's: the title and the close button's
 * meaning (it closes the panel, or brings an expanded sheet back), the scrolling sections as `children`, and the pinned
 * `footer`. `closing` starts the exit; `onClosed` is called once the sheet is gone, and only then does the caller unmount it.
 * Android Back calls `onRequestClose`; a tap on the strip of screen above the sheet does what the × does (`onCloseButton`).
 */
export function SearchSheet({ reduced, backdrop, blurTarget, expanded, closing, title, closeLabel, closeHint, footer,
  onCloseButton, onRequestClose, onClosed, children }: {
  reduced: boolean; backdrop: BackdropKind; blurTarget?: RefObject<View | null>;
  expanded: boolean; closing: boolean;
  title: string; closeLabel: string; closeHint: string;
  /** Pinned under the sections, above the keyboard. */ footer: ReactNode;
  onCloseButton: () => void; onRequestClose: () => void; onClosed: () => void;
  children: ReactNode;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const top = useTopInset(), bottom = useBottomInset();
  const keyboard = useKeyboardShown();
  const room = measured > 0 ? measured : windowHeight;
  const gap = Math.max(Math.round(room * (1 - SHEET_RATIO)), top + sys.space.base);
  const resting = Math.max(0, room - gap), full = Math.max(resting, room - top);

  // Motion that only moves a layer (its place and its opacity) runs on the native driver; the height and the corners cannot.
  const rise = useRef(new Animated.Value(reduced ? 0 : windowHeight)).current;
  const fade = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const height = useRef(new Animated.Value(expanded ? full : resting)).current;
  const now = useRef({ onClosed, room, reduced });
  now.current = { onClosed, room, reduced };

  useEffect(() => {
    if (reduced) { rise.setValue(0); fade.setValue(1); return; }
    const run = Animated.parallel([
      Animated.spring(rise, { toValue: 0, ...sys.motion.sheetSpring, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: sys.motion.enter, easing: easeOut, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Until the screen's real size is known the height is only an estimate from the window, so it is put in place, not moved
  // (the sheet is rising at that moment and must not also grow). After that, every change of height is the spring's.
  const placed = useRef(false);
  useEffect(() => {
    const target = expanded ? full : resting;
    if (reduced || !placed.current) { height.setValue(target); if (measured > 0) placed.current = true; return; }
    const run = Animated.spring(height, { toValue: target, ...sys.motion.sheetSpring, useNativeDriver: false });
    run.start();
    return () => run.stop();
  }, [expanded, full, resting, reduced, height, measured]);

  useEffect(() => {
    if (!closing) return;
    if (now.current.reduced) { now.current.onClosed(); return; }
    let done = false;
    const finish = () => { if (!done) { done = true; now.current.onClosed(); } };
    const run = Animated.parallel([
      Animated.timing(rise, { toValue: now.current.room, duration: sys.motion.sheetClose, easing: easeOut, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: sys.motion.sheetClose, easing: easeOut, useNativeDriver: true }),
    ]);
    run.start(({ finished }) => { if (finished) finish(); });
    // The way out must not depend on an animation callback: the panel is closed whatever the driver does.
    const guard = setTimeout(finish, sys.motion.sheetClose + 250);
    return () => { run.stop(); clearTimeout(guard); };
  }, [closing, rise, fade]);

  const corner = useMemo(() => full > resting
    ? height.interpolate({ inputRange: [resting, full], outputRange: [sys.radius.sheet, 0], extrapolate: 'clamp' }) : sys.radius.sheet,
  [height, resting, full]);

  return <Modal visible transparent hardwareAccelerated animationType="none" statusBarTranslucent onRequestClose={onRequestClose}>
    <View testID="search-root" style={s.root} onLayout={event => { const next = Math.round(event.nativeEvent.layout.height); if (next > 0) setMeasured(next); }}>
      <SearchBackdrop kind={backdrop} blurTarget={blurTarget} fade={fade} onPress={onCloseButton} />
      {/* The footer rides above the keyboard while words are typed (the app's own keyboard rule). */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.avoider} pointerEvents={closing ? 'none' : 'box-none'}>
        <Animated.View testID="search-sheet-rise" style={[s.rise, { transform: [{ translateY: rise }] }]}>
          <Animated.View testID="search-sheet" accessibilityViewIsModal accessibilityLabel={title}
            style={[s.sheet, { height, borderTopLeftRadius: corner, borderTopRightRadius: corner }]}>
            <View style={s.top}>
              <T variant="heading" accessibilityRole="header" style={s.title}>{title}</T>
              <ChromeIconButton glyph="close" label={closeLabel} hint={closeHint} quiet onPress={onCloseButton} />
            </View>
            {children}
            <View testID="search-footer-slot" style={{ paddingBottom: keyboard ? 0 : bottom }}>{footer}</View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  // The layer that rises carries nothing but its place; the frame inside carries the height. The two never share a node,
  // because a node cannot be moved by the native driver and the JS driver at once.
  rise: { width: '100%', flexShrink: 1 },
  sheet: { flexShrink: 1, overflow: 'hidden', backgroundColor: sys.color.surface, ...sheetLift.docked },
  top: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingLeft: sys.space.lg, paddingRight: sys.space.base,
    paddingTop: sys.space.sm, paddingBottom: sys.space.xs },
  title: { flex: 1, minWidth: 0, color: sys.color.ink },
});
