import { createContext, useCallback, useContext, useEffect, useRef, useState, type Context, type ReactNode } from 'react';
import { Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SafeArea from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetBackdrop, BottomSheetFooter, BottomSheetScrollView, type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps, type BottomSheetFooterProps } from '@gorhom/bottom-sheet';
import { X } from 'phosphor-react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { brandAction, sys } from '../system/tokens';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';

const SheetBackground = ({ style }: BottomSheetBackgroundProps) => <View pointerEvents="none" accessible={false}
  importantForAccessibility="no" style={[style, s.background]} />;
const SheetHandle = () => <View accessible={false} importantForAccessibility="no" style={s.handleArea}><View style={s.handle} /></View>;

/** Every command in a sheet is an important one: a full 48 even where the shared minimum is smaller. */
export const SHEET_TOUCH = Math.max(48, sys.touch.min);
/**
 * The one settle for every sheet: critically damped, no bounce. Reduced motion replaces it with no motion at all. The
 * value is `sys.motion.sheetSpring` (rule R3); this name stays only so the two other sheets that import it keep working
 * until they read the token directly.
 */
export const SHEET_SPRING = sys.motion.sheetSpring;
/** What the tap-outside area says it does on a sheet that simply closes. */
export const SHEET_BACKDROP_HINT = 'Zatvara pregled bez primene izbora.';
/** What the tap-outside area says on a sheet with unsaved input: a tap there asks first, it does not close. */
export const SHEET_BACKDROP_DIRTY_HINT = 'Pita pre nego što odbaci izmene.';
/**
 * The pinned actions' height before their first layout: a confirmation's primary (54), the gap (4), its quiet way out
 * (48) and the footer's padding above and below (12 + 12). Starting from 0 opened every confirmation short, with the
 * actions over its sentence, and then grew it; the real measurement replaces this on the first layout.
 */
export const FOOTER_ESTIMATE = (brandAction.minHeight as number) + sys.space.xs + SHEET_TOUCH + 2 * sys.space.md;

/**
 * What the pinned footer shows, handed to it through context. Gorhom renders `footerComponent` as a component, so the
 * component must be one stable function: a function rebuilt on every render (it closed over the footer's JSX) made
 * React throw the footer away and mount it again on every change — a busy confirm, a streamed token — and a screen
 * reader lost its place on the button just pressed.
 */
const FooterSlot = createContext<{ content: ReactNode; measure: (height: number) => void }>({ content: null, measure: () => undefined });

/**
 * The window's bottom inset, read from the provider's context — never a native SafeAreaView inside the sheet. A
 * SafeAreaView pads by where it sits on screen at that moment; inside a sheet that slides and sizes itself to its content,
 * every move changed that padding, the new height moved the sheet again, and the sheet shook without end (owner
 * 2026-10-07: "trese se sve vreme"). The context consumer answers null without a provider (the `useSafeAreaInsets` hook
 * throws there), and a test double that leaves the context out reads 0. The context either exists for the whole life of
 * the process or never does, so the hook order of this function never changes.
 */
const InsetsContext = (SafeArea as { SafeAreaInsetsContext?: Context<{ bottom: number } | null> }).SafeAreaInsetsContext;
const useBottomInset: () => number = InsetsContext
  ? () => useContext(InsetsContext)?.bottom ?? 0
  : () => 0;

function PinnedFooter(props: BottomSheetFooterProps) {
  const { content, measure } = useContext(FooterSlot);
  const bottom = useBottomInset();
  return <BottomSheetFooter {...props}>
    <View testID="product-sheet-footer" style={[s.footer, { paddingBottom: sys.space.md + bottom }]}
      onLayout={event => measure(Math.ceil(event.nativeEvent.layout.height))}>{content}</View>
  </BottomSheetFooter>;
}

export type ProductSheetProps = {
  /** The visible title. A sheet without one (a menu) names itself through `label`. */
  title?: string;
  /** What assistive technology calls a sheet that has no visible title. */
  label?: string;
  /** The × and the backdrop say this. */
  closeLabel?: string;
  /** What a screen reader says a tap outside does, when it simply closes the sheet; `null` takes the tap-outside area out
   *  of what a screen reader visits. Unsaved input says it asks first instead; while a command runs (not dismissible) a
   *  tap outside does nothing, so the area is not visited at all. */
  backdropHint?: string | null;
  /** The caller's own reading of the system setting; the sheet reads it itself when this is left out. */
  reduced?: boolean;
  /** Called once the sheet is gone, whatever closed it. */
  onClose: () => void;
  children: (dismiss: () => void) => ReactNode;
  /** Actions pinned under the content. They never scroll away, however long the content or large the text. */
  footer?: (dismiss: () => void) => ReactNode;
  /** Unsaved input. Every way out the person can take (×, Back, backdrop) asks before throwing it away, and a drag
   *  down no longer closes. `dismiss`, handed to the content, is the caller's own commit and never asks. */
  dirty?: boolean;
  /** False while something the sheet started is still running: nothing the person does closes it until it settles. */
  dismissible?: boolean;
  /** A sheet whose own buttons already close it (a confirmation) leaves the × out. */
  closeButton?: boolean;
};

/**
 * The one sheet engine. The native Modal owns focus and Android Back; Gorhom owns the drag, the scrolling and the
 * settling motion. The caller commits a draft explicitly, and every dismissal route only invokes onClose.
 */
export function ProductSheet({ title, label, closeLabel = 'Zatvori', backdropHint = SHEET_BACKDROP_HINT, reduced: callerReduced,
  onClose, children, footer, dirty = false, dismissible = true, closeButton = true }: ProductSheetProps) {
  const systemReduced = useSystemReducedMotion();
  const reduced = callerReduced ?? systemReduced;
  const sheet = useRef<BottomSheet>(null), closing = useRef(false);
  const { height } = useWindowDimensions();
  const [asking, setAsking] = useState(false);
  const [footerHeight, setFooterHeight] = useState(FOOTER_ESTIMATE);
  const bottom = useBottomInset();
  // A re-measure within one pixel (the rounding up of a sub-pixel layout) is not a new height: settling on it would size
  // the sheet again for nothing, and two such heights alternating is a loop.
  const measureFooter = useCallback((next: number) => setFooterHeight(now => Math.abs(now - next) <= 1 ? now : next), []);
  // The guard reads the newest values: Back and the backdrop call it from outside this render.
  const state = useRef({ dirty, dismissible, asking }); state.current = { dirty, dismissible, asking };
  useEffect(() => { if (!dirty) setAsking(false); }, [dirty]);
  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (sheet.current) sheet.current.close(); else onClose();
  }, [onClose]);
  /** Every way out the person takes: ×, Android Back, the backdrop. */
  const requestClose = useCallback(() => {
    const now = state.current;
    if (!now.dismissible) return;
    // Back or a tap outside while the question is open means "no, keep editing".
    if (now.asking) { setAsking(false); return; }
    if (now.dirty) { setAsking(true); return; }
    dismiss();
  }, [dismiss]);
  const guarded = dirty || !dismissible;
  // Gorhom substitutes its own English hint for a missing or empty one ("Tap to close the bottom sheet"): always pass a
  // true Serbian sentence, and take the backdrop out of the accessibility tree while a tap on it does nothing.
  // While the discard question stands, a tap outside is its "no": editing goes on.
  const backdropSays = !dismissible ? null : asking ? 'Nastavlja uređivanje.' : dirty ? SHEET_BACKDROP_DIRTY_HINT : backdropHint;
  const backdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props}
    appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.3}
    // A tap outside a guarded sheet stays where it is (snap to the open index) and asks the guard instead.
    pressBehavior={guarded ? 0 : 'close'} onPress={guarded ? requestClose : undefined}
    accessible={backdropSays !== null} accessibilityLabel={closeLabel} accessibilityHint={backdropSays ?? closeLabel} />,
  [backdropSays, closeLabel, guarded, requestClose]);
  const pinned = asking ? <View style={s.discard} accessibilityLiveRegion="polite">
    <T accessibilityRole="alert" variant="heading" style={s.discardTitle}>Odbaciti izmene?</T>
    <T variant="copy" tone="muted">Unete izmene neće biti sačuvane.</T>
    <Press accessibilityRole="button" accessibilityLabel="Odbaci izmene" testID="product-sheet-discard" haptic="medium"
      onPress={dismiss} style={[s.command, s.danger]}>
      <T variant="action" style={s.onFilled}>Odbaci izmene</T></Press>
    <Press accessibilityRole="button" accessibilityLabel="Nastavi uređivanje" testID="product-sheet-keep" haptic="select"
      onPress={() => setAsking(false)} style={s.command}>
      <T variant="action" style={s.quiet}>Nastavi uređivanje</T></Press>
  </View> : footer ? footer(dismiss) : null;
  // A new value on every render on purpose: the footer re-renders with the newest actions; only its component is stable.
  const slot = { content: pinned, measure: measureFooter };
  return <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={requestClose}>
    <GestureHandlerRootView style={s.root}>
      <FooterSlot.Provider value={slot}>
        <BottomSheet ref={sheet} index={0} enableDynamicSizing enablePanDownToClose={!guarded}
          accessible={false} accessibilityRole="none" accessibilityLabel={title ?? label}
          maxDynamicContentSize={height * 0.85} animateOnMount={!reduced} onClose={onClose}
          animationConfigs={reduced ? { duration: 0 } : SHEET_SPRING}
          backdropComponent={backdrop} backgroundComponent={SheetBackground} handleComponent={SheetHandle}
          footerComponent={pinned ? PinnedFooter : undefined}
          keyboardBehavior="interactive" keyboardBlurBehavior="restore" enableBlurKeyboardOnGesture>
          <BottomSheetScrollView keyboardShouldPersistTaps="handled"
            // The title and its × stay at the top while a long content scrolls under them (verify r4c: the × of a long
            // offer scrolled away). The heading stays inside the content, so the sheet's dynamic height still counts it.
            stickyHeaderIndices={title ? [0] : undefined}
            // The pinned actions sit over the end of the content; the content makes room for them, so the last line
            // is never hidden under a button.
            contentContainerStyle={[s.content, pinned ? { paddingBottom: footerHeight + sys.space.sm } : null]}>
            {/* The row lives one level INSIDE the sticky element (round 6 on the emulator, b4531ef4: the × sat under the
                title on every titled sheet). RN's ScrollViewStickyHeader moves the sticky child's own style onto its
                wrapper and re-clones the child with {flex: 1} alone, so a row direction on the sticky View is lost and
                its children stack; the outer View carries only what the wrapper may take (the white, the padding). */}
            {title ? <View style={s.heading}><View style={s.headingRow}>
              <T accessibilityRole="header" variant="title" style={s.title}>{title}</T>
              {closeButton ? <Press accessibilityRole="button" accessibilityLabel={closeLabel} accessibilityState={{ disabled: !dismissible }}
                disabled={!dismissible} onPress={requestClose} haptic="select" style={s.close}>
                <X size={22} color={sys.color.ink} /></Press> : null}
            </View></View> : null}
            <View style={[s.stack, pinned ? null : { paddingBottom: bottom }]}>
              {children(dismiss)}
            </View>
          </BottomSheetScrollView>
        </BottomSheet>
      </FooterSlot.Provider>
    </GestureHandlerRootView>
  </Modal>;
}
const s = StyleSheet.create({
  root: { flex: 1 }, background: { backgroundColor: sys.color.surface, borderRadius: sys.radius.sheet },
  handleArea: { height: 24, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: sys.color.lineStrong },
  content: { paddingHorizontal: sys.space.lg, paddingBottom: sys.space.base }, stack: { gap: sys.space.md },
  // On the sheet's white, so what scrolls under the pinned title does not show through it; the padding is the stack's gap.
  // Nothing about direction here: this style is moved onto RN's sticky wrapper (see the heading above).
  heading: { paddingBottom: sys.space.md, backgroundColor: sys.color.surface },
  // One row: the title takes the width and wraps in its column; the 48 × keeps its measure at the right end.
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md }, title: { flex: 1, minWidth: 0, color: sys.color.ink },
  close: { width: SHEET_TOUCH, height: SHEET_TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill, backgroundColor: sys.color.wash },
  footer: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.md, paddingBottom: sys.space.md, gap: sys.space.sm, backgroundColor: sys.color.surface },
  discard: { gap: sys.space.sm }, discardTitle: { color: sys.color.ink },
  command: { minHeight: SHEET_TOUCH, borderRadius: sys.radius.primary, paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm,
    flexDirection: 'row', gap: sys.space.sm, alignItems: 'center', justifyContent: 'center' },
  // The one filled command in the question: the primary's measure, in the danger colour.
  danger: { ...brandAction, backgroundColor: sys.color.danger },
  onFilled: { color: sys.color.onGreen, textAlign: 'center' }, quiet: { color: sys.color.green, textAlign: 'center' },
});
