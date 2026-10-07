import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { SuccessMark } from '../system/SuccessMark';
import { sys } from '../system/tokens';

/**
 * "Objavljeno": the one calm moment right after a publication the server has confirmed (plan 2.9, owner 2026-10-07). Until now the
 * success was replaced by the jump to the map in the same breath, so nobody ever saw it. The moment is a mark that settles in with
 * its one success tick (`SuccessMark fresh`; under reduced motion it keeps the tick and drops the movement), what happened, one
 * grey line about what comes next, and ONE green way on. Nothing else moves and nothing else is said.
 *
 * It holds `PUBLISHED_MOMENT_MS` when left alone and then continues by itself; a tap on the green action, or Android Back (the
 * route wires that), continues at once. It never blocks the way on. A screen reader is not hurried: while one is on, the moment
 * waits for the person to continue, because a sentence that is still being read must not be cut off by a screen change.
 *
 * The green action sits in the middle, under the words, and not at the foot where "Objavi zadatak" was: a second tap meant for
 * the publish button must not land on the way on and skip the moment before it was seen.
 */
export const PUBLISHED_MOMENT_MS = 1500;

/** True while a screen reader is on. The answer comes asynchronously; until then (and where there is no such API) it is off. */
function useScreenReaderOn(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    try { void AccessibilityInfo.isScreenReaderEnabled?.()?.then(value => { if (alive) setOn(value === true); }, () => undefined); } catch { /* none here */ }
    let subscription: { remove?: () => void } | undefined;
    try { subscription = AccessibilityInfo.addEventListener?.('screenReaderChanged', value => { if (alive) setOn(value === true); }) as typeof subscription; } catch { /* none here */ }
    return () => { alive = false; subscription?.remove?.(); };
  }, []);
  return on;
}

export function PublishedMoment({ title, line, actionLabel = 'Otvori zadatak', onContinue }: {
  /** What happened, as a sentence: "Zadatak je objavljen." */
  title: string;
  /** What happens next, in one grey sentence that is true: "Prijave stižu ovde. Javićemo ti." */
  line: string;
  actionLabel?: string;
  /** Goes on to the task. Called at most once per tap or timer; the route's own fence decides whether it may. */
  onContinue: () => void;
}) {
  const screenReader = useScreenReaderOn();
  // The timer runs the newest `onContinue`, which holds the route's newest guards, never the one of the render that started it.
  const latest = useRef(onContinue); latest.current = onContinue;
  useEffect(() => {
    if (screenReader) return;
    const timer = setTimeout(() => latest.current(), PUBLISHED_MOMENT_MS);
    return () => clearTimeout(timer);
  }, [screenReader]);
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <View style={s.center}>
      <SuccessMark fresh size={64} />
      <View style={s.words}>
        <T accessibilityRole="header" accessibilityLiveRegion="polite" variant="title" style={s.title}>{title}</T>
        <T variant="copy" tone="muted" style={s.line}>{line}</T>
      </View>
      <V2Action kind="primary" label={actionLabel} onPress={onContinue} style={s.action} />
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: sys.space.xl, paddingHorizontal: sys.space.xl },
  words: { alignItems: 'center', gap: sys.space.sm },
  title: { color: sys.color.ink, textAlign: 'center' },
  line: { textAlign: 'center' },
  action: { alignSelf: 'stretch', maxWidth: 320, width: '100%' },
});
