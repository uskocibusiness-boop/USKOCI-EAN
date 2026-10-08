import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Press } from '../Press';
import { layout, ruleWidth } from './layout';
import { cardCompact, floating, inset, raisedItem, sys } from './tokens';

/**
 * The one container (composition spec 2026-10-07, section 2 "B" and "U4"). The app had six kinds of container, and the same
 * "record" (a task, a Dogovor, an appointment) looked three ways. There are four now, and what each one MEANS is fixed:
 *
 * - `record`  a thing that is touched: a task, a Dogovor, an application, an appointment, a candidate. White, 24 corners,
 *             16 padding, and the shadow (`raisedItem`). A shadow means "touch me", so nothing that is only read has one.
 * - `panel`   a thing that is only read and wants a frame: an edge of 1 dp (`cardLine`), no shadow.
 * - `float`   what lies over something else (the pills and controls over the map, the composer): `floating`, plus the 1 dp
 *             `line` so it holds its edge over tiles. The caller sets the corner (`sys.radius.pill` for a pill).
 * - `note`    a sentence that has to stand out, as a flat tint (`inset`): `wash` by default, `warn` or `danger` for a
 *             state. It is NOT a card.
 *
 * Never a card inside a card, around a list of rows or around one row. A `Surface` inside a `Surface` speaks in development
 * builds (not under Jest, which also has `__DEV__` on, and not in a store build): the exception is a `note`, which is a tint
 * and may stand in a card. This file is the only one that spells `raisedItem`, `card`, `cardCompact`, `floating` or `inset`
 * (`__tests__/surface-kinds-ratchet.test.ts` holds the files that still do, and the list only shrinks).
 */
export type SurfaceKind = 'record' | 'panel' | 'float' | 'note';
export type SurfaceTone = 'wash' | 'warn' | 'danger';

export type SurfaceProps = {
  kind: SurfaceKind;
  /** Only for a `note`; the tint. `wash` when it is left out. */
  tone?: SurfaceTone;
  /** Only for a `record`: the whole card is one button, and gives under the finger. */
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/** What the nearest enclosing Surface is, so a Surface inside another one can say so. */
const Enclosing = createContext<SurfaceKind | null>(null);

/**
 * The things a Surface is told off for, as words. Pure, so a test can see them without a development build: whether they are
 * SPOKEN is `speaks`.
 */
export function surfaceWarnings({ kind, enclosing, pressed }: { kind: SurfaceKind; enclosing: SurfaceKind | null; pressed: boolean }): string[] {
  const found: string[] = [];
  if (enclosing !== null && kind !== 'note') {
    found.push(`Surface: a ${kind} stands inside a ${enclosing}. A card is never inside a card: use a Section, a ListRow or a note.`);
  }
  if (pressed && kind !== 'record') found.push(`Surface: onPress is ignored on a ${kind}; only a record is touched.`);
  return found;
}

/** Development builds only, and never under Jest (which also has `__DEV__` on): a test must not print, and a store build says nothing. */
export function speaks(env: { dev: boolean; test: boolean }): boolean {
  return env.dev && !env.test;
}
const underTest = () => process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

export function Surface({ kind, tone = 'wash', onPress, children, style, testID, accessibilityLabel, accessibilityHint }: SurfaceProps) {
  const enclosing = useContext(Enclosing);
  const pressed = onPress !== undefined;
  useEffect(() => {
    if (!speaks({ dev: __DEV__, test: underTest() })) return;
    for (const message of surfaceWarnings({ kind, enclosing, pressed })) console.warn(message);
  }, [kind, enclosing, pressed]);

  const look = [s[kind], kind === 'note' ? s[tone] : null, style];
  const body = kind === 'record' && onPress
    ? <Press testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
      onPress={onPress} haptic="select" scaleTo={sys.motion.scale.row} style={look}>{children}</Press>
    : <View testID={testID} accessible={accessibilityLabel ? true : undefined} accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint} style={look}>{children}</View>;
  return <Enclosing.Provider value={kind}>{body}</Enclosing.Provider>;
}

const s = StyleSheet.create({
  record: { ...raisedItem, borderRadius: sys.radius.card, padding: layout.card },
  panel: { ...cardCompact },
  float: { ...floating, backgroundColor: sys.color.surface, borderWidth: ruleWidth, borderColor: sys.color.line, borderRadius: sys.radius.card },
  // `inset` pads 14, which is off the scale; the note keeps its tint and corner and takes 12 over and under, 16 across.
  note: { ...inset, paddingVertical: sys.space.md, paddingHorizontal: sys.space.base },
  wash: { backgroundColor: sys.color.wash },
  warn: { backgroundColor: sys.color.warnSoft },
  danger: { backgroundColor: sys.color.dangerSoft },
});
