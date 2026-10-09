import { useContext, useEffect, useRef, useState, type Context, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as SafeArea from 'react-native-safe-area-context';
import { T } from '../../Text';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { sheetLift, sys } from '../../system/tokens';
import { SearchBackdrop, type BackdropKind } from './SearchBackdrop';

/** How much of the screen the filters cover when they open; the rest is the blurred screen behind them, and a tap there closes them. */
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
 * The frame of the filters and of the search (UX plan 2.19, 2.20; the owner-approved plan, U4 and U5). The FILTERS are a white sheet that rises over the
 * screen it opened on: the screen behind is blurred when the platform can, and dimmed when it cannot; the sheet rises over `sheetSpring` and leaves on
 * `sheetClose`, and the backdrop fades with it. It rests at `ratio` of the screen (85 % unless the caller says less). The SEARCH is `screen`: it fills the
 * whole window, behind the status bar too, with nothing of the map to show round it, so it has no backdrop, no round corners and no gap above it; its first
 * row is the caller's own (`header`: the way back and the field), and the status bar's room is part of that row. Under reduced motion nothing moves: the
 * sheet is there, and then it is gone.
 *
 * It owns only the frame and its motion. What the panel says and does is the caller's: the title and the close button's meaning, the scrolling
 * sections as `children`, and the pinned `footer`. `closing` starts the exit; `onClosed` is called once the sheet is gone, and only then does the caller
 * unmount it. Android Back calls `onRequestClose`; a tap on the strip of screen above a sheet does what the × does (`onCloseButton`).
 */
export function SearchSheet({ reduced, backdrop, blurTarget, closing, title, closeLabel, closeHint, footer, ratio = SHEET_RATIO, screen = false, header,
  onCloseButton, onRequestClose, onClosed, onShown, children }: {
  reduced: boolean; backdrop: BackdropKind; blurTarget?: RefObject<View | null>;
  closing: boolean;
  title: string; closeLabel: string; closeHint: string;
  /** Pinned under the sections, above the keyboard. */ footer: ReactNode;
  /** How much of the screen a sheet rests at. */ ratio?: number;
  /** The whole window, behind the status bar: no backdrop, no corners, no strip of the screen behind. */ screen?: boolean;
  /** The first row, instead of the title and its close button (a `screen` has its own: the way back and the field). */ header?: ReactNode;
  onCloseButton: () => void; onRequestClose: () => void; onClosed: () => void; onShown?: () => void;
  children: ReactNode;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const top = useTopInset(), bottom = useBottomInset();
  const keyboard = useKeyboardShown();
  const room = measured > 0 ? measured : windowHeight;
  const gap = Math.max(Math.round(room * (1 - ratio)), top + sys.space.base);
  const resting = screen ? room : Math.max(0, room - gap);

  // Motion that only moves a layer (its place and its opacity) runs on the native driver; the height and the corners cannot.
  const rise = useRef(new Animated.Value(reduced ? 0 : windowHeight)).current;
  const fade = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const height = useRef(new Animated.Value(resting)).current;
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
  // (the sheet is rising at that moment and must not also grow). After that, a change of height (a window that turns) is the spring's.
  const placed = useRef(false);
  useEffect(() => {
    if (reduced || !placed.current) { height.setValue(resting); if (measured > 0) placed.current = true; return; }
    const run = Animated.spring(height, { toValue: resting, ...sys.motion.sheetSpring, useNativeDriver: false });
    run.start();
    return () => run.stop();
  }, [resting, reduced, height, measured]);

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

  const corner = screen ? 0 : sys.radius.sheet;

  return <Modal visible transparent hardwareAccelerated animationType="none" statusBarTranslucent onShow={onShown} onRequestClose={onRequestClose}>
    <View testID="search-root" style={s.root} onLayout={event => { const next = Math.round(event.nativeEvent.layout.height); if (next > 0) setMeasured(next); }}>
      {screen ? null : <SearchBackdrop kind={backdrop} blurTarget={blurTarget} fade={fade} onPress={onCloseButton} />}
      {/* The footer rides above the keyboard while words are typed (the app's own keyboard rule). */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.avoider} pointerEvents={closing ? 'none' : 'box-none'}>
        <Animated.View testID="search-sheet-rise" style={[s.rise, { transform: [{ translateY: rise }] }]}>
          <Animated.View testID="search-sheet" accessibilityViewIsModal accessibilityLabel={title}
            style={[s.sheet, { height, borderTopLeftRadius: corner, borderTopRightRadius: corner }]}>
            {header ? <View testID="search-header" style={{ paddingTop: screen ? top : 0 }}>{header}</View> : <View style={[s.top, screen && { paddingTop: top + sys.space.sm }]}>
              <T variant="heading" accessibilityRole="header" style={s.title}>{title}</T>
              <ChromeIconButton glyph="close" label={closeLabel} hint={closeHint} quiet onPress={onCloseButton} />
            </View>}
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
