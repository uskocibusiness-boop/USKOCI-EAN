import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type TextProps, type ViewStyle } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph, type GlyphName } from './Glyph';
import { useReducedMotion } from './motion';
import { useTextScale } from './textScale';
import { sys } from './tokens';

/**
 * Quiet navigation chrome. Illustrations remain in content; a tab keeps the same open line drawing
 * in both states. The selected marker and label establish location without a second filled card.
 * Existing native-driver selection transitions, measured labels and accessibility semantics remain.
 */
export const TAB_ICON = 24;
export const TAB_LABEL_GAP = 3;
export const TAB_ITEM_PADDING = 3;
export const TAB_ITEM_TOP = 7;
export const TAB_ITEM_BOTTOM = 5;
export const TAB_INDICATOR = { width: 18, height: 2 } as const;
export const TAB_POP = 1.04;
export const TAB_BAR_PADDING = 0;
export const TAB_CAPSULE = 0;
type TabKind = 'home' | 'map' | 'agreements' | 'chat';
const TAB_GLYPH: Record<TabKind, GlyphName> = { home: 'home', map: 'map', agreements: 'agreements', chat: 'messages' };

/** Full-width surface; the navigator owns safe-area space and outer placement. */
export const tabBarSurface = {
  backgroundColor: sys.color.surface,
  borderColor: sys.color.line, borderWidth: 0, borderTopWidth: 1,
  borderRadius: 0, padding: TAB_BAR_PADDING,
  elevation: 0, shadowOpacity: 0,
} satisfies ViewStyle;

/**
 * The navigator reserves a 28dp icon host even though its drawing is 24dp. Include that host,
 * the top hairline and measured text, rather than reducing the formula to the drawing size.
 * Labels remain scalable/untruncated, and their actual second line grows the bar.
 */
export function tabBarHeight(labelHeight: number, barPadding: number): number {
  return Math.max(56, Math.ceil(Math.max(TAB_ICON, 28) + TAB_LABEL_GAP + TAB_ITEM_TOP + TAB_ITEM_BOTTOM + barPadding * 2 + labelHeight + 1));
}

const EASE_OUT = Easing.bezier(...sys.motion.easeOut);

/**
 * 1 while `selected` and 0 while not, and the value follows a change over the toggle token on the native driver. Nothing is
 * started when the component first mounts (the value is already right), and under reduced motion a change is set at once.
 */
function useSelection(selected: boolean): Animated.Value {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(selected ? 1 : 0));
  const mounted = useRef(false);
  useEffect(() => {
    const target = selected ? 1 : 0;
    if (reduced) { value.setValue(target); return; }
    if (!mounted.current) { mounted.current = true; return; }
    const run = Animated.timing(value, { toValue: target, duration: sys.motion.toggle, easing: EASE_OUT, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [selected, reduced, value]);
  return value;
}

/**
 * The chosen tab's capsule: always mounted, an absolute fill of the button that never takes a touch, fading with the selection.
 * `radius` is the capsule corner (`TAB_CAPSULE`), passed in so the bar and its corner agree in one place.
 */
export function TabCapsule({ selected, radius }: { selected: boolean; radius: number }) {
  const shown = useSelection(selected);
  return <Animated.View testID="tab-capsule" pointerEvents="none" style={[s.capsule, { borderRadius: radius, opacity: shown }]}>
    <View testID="tab-indicator" style={s.indicator} />
  </Animated.View>;
}

/**
 * The same outline in muted and brand tones, cross-fading over the toggle token.
 * A small selection response runs only on a rising selection, never on initial display or deselection.
 */
export function TabGlyph({ kind, selected }: { kind: TabKind; selected: boolean }) {
  const name = TAB_GLYPH[kind];
  const reduced = useReducedMotion();
  const sticker = useSelection(selected);
  const mark = useMemo(() => sticker.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), [sticker]);
  const [pop] = useState(() => new Animated.Value(1));
  const was = useRef(selected);
  useEffect(() => {
    const rose = selected && !was.current;
    was.current = selected;
    // Anything that is not a rise puts the scale back at rest (and stops a pop that a quick second tap interrupted).
    if (!rose || reduced) { pop.setValue(1); return; }
    const run = Animated.sequence([
      Animated.timing(pop, { toValue: TAB_POP, duration: sys.motion.press, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: sys.motion.toggle, easing: EASE_OUT, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [selected, reduced, pop]);
  return <Animated.View testID="tab-glyph" style={[s.glyph, { transform: [{ scale: pop }] }]}>
    <Animated.View testID="tab-glyph-mark" style={[s.layer, { opacity: mark }]}>
      <Glyph name={name} size={TAB_ICON} tone="muted" />
    </Animated.View>
    <Animated.View testID="tab-glyph-art" style={[s.layer, { opacity: sticker }]}>
      <Glyph name={name} size={TAB_ICON} tone="green" on />
    </Animated.View>
  </Animated.View>;
}

/**
 * The name under the picture: the `navLabel` variant, green when chosen and muted at rest. Never shrunk and never cut; the person's
 * text size decides, and `onTextLayout` hands the measured lines on so the bar's height can follow.
 */
export function TabLabel({ children, selected, onTextLayout }: { children: ReactNode; selected: boolean; onTextLayout?: TextProps['onTextLayout'] }) {
  return <T variant="navLabel" tone={selected ? 'green' : 'muted'} onTextLayout={onTextLayout} style={s.label}>{children}</T>;
}

const PREVIEW: readonly { kind: TabKind; title: string }[] = [
  { kind: 'home', title: 'Početna' }, { kind: 'map', title: 'Zadaci' }, { kind: 'agreements', title: 'Dogovori' },
  { kind: 'chat', title: 'Poruke' },
];

/**
 * The bar drawn by hand from the same parts, for the design board on the phone (`uskociapp://dizajn-tabla`, internal build): four
 * tabs that can be tapped, so the owner can feel the capsule, the pill, the cross-fade and the pop and compare them with the
 * build already on his phone. It holds no navigation and no data. The real bar's layout is the navigator's; this one mirrors it
 * (the 31 by 28 box the icon stands in, the tab padding and corner), and the height is the same `tabBarHeight`.
 */
export function TabBarPreview() {
  const [chosen, setChosen] = useState(0);
  const labelHeight = sys.type.navLabel.lineHeight * useTextScale();
  return <View style={[tabBarSurface, s.preview, { height: tabBarHeight(labelHeight, TAB_BAR_PADDING) }]}>
    {PREVIEW.map((tab, index) => <Press key={tab.kind} accessibilityRole="tab" accessibilityLabel={tab.title}
      accessibilityState={{ selected: chosen === index }} onPress={() => setChosen(index)} haptic="none" scaleTo={1}
      hitSlop={0} style={s.previewTab}>
      <TabCapsule selected={chosen === index} radius={TAB_CAPSULE} />
      <View style={s.previewIcon}><TabGlyph kind={tab.kind} selected={chosen === index} /></View>
      <TabLabel selected={chosen === index}>{tab.title}</TabLabel>
    </Press>)}
  </View>;
}

const s = StyleSheet.create({
  capsule: { ...StyleSheet.absoluteFill },
  // On the capsule's top edge, centred; a full pill, so its ends are round.
  indicator: { position: 'absolute', top: 0, alignSelf: 'center', width: TAB_INDICATOR.width, height: TAB_INDICATOR.height,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  glyph: { width: TAB_ICON, height: TAB_ICON },
  layer: { ...StyleSheet.absoluteFill },
  label: { textAlign: 'center', marginTop: TAB_LABEL_GAP },
  preview: { flexDirection: 'row' },
  previewTab: { flex: 1, alignItems: 'center', paddingHorizontal: TAB_ITEM_PADDING, paddingTop: TAB_ITEM_TOP, paddingBottom: TAB_ITEM_BOTTOM,
    borderRadius: TAB_CAPSULE, overflow: 'hidden' },
  previewIcon: { width: 31, height: 28, alignItems: 'center', justifyContent: 'center' },
});
