import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { TurningCaret } from '../../system/Disclosure';
import { layout, ruleWidth } from '../../system/layout';
import { Surface } from '../../system/Surface';
import { sys } from '../../system/tokens';
import { Collapsible } from './Collapsible';

/** The sections of the search panel, in the order the person is walked through them (UX plan 2.19). */
export type SearchStep = 'gde' | 'kada' | 'sta' | 'cena' | 'koliko' | 'kako';
export const SEARCH_STEPS: readonly SearchStep[] = ['gde', 'kada', 'sta', 'cena', 'koliko', 'kako'];

/**
 * One section of the panel: a row of the list the panel is (composition spec 2026-10-07, 4.3; UI/UX pass 2026-10-08). Closed it is one
 * row, 56 dp: its name in the row's own type (16, 600) and, beside the caret, what is chosen in it as a quiet `note`; a short inset line parts it from the
 * next. Open, the row keeps its name alone and what it opens stands 12 below it, in a `panel` (the owner's pick of 8 Oct 2026, "Gradovi brojem": what is open
 * is read and chosen from inside a frame of its own, never touched as a whole, so it has an edge and no shadow). One section is open at a time, which the panel decides.
 *
 * The row is a button that says whether it is expanded and what it holds, which is why it is not a `ListRow` yet: `ListRow` draws an arrow that says
 * "opens a screen" and has no `expanded`. The section owns only how it opens; every choice stays in the panel's draft, so closing it loses nothing. At a
 * large text size the chosen value goes under the name instead of beside it.
 */
export function SearchSection({ step, label, summary, open, last = false, large, reduced, onToggle, onPosition, onBodyPosition, onSettled, children }: {
  step: SearchStep; label: string; summary: string; open: boolean; large: boolean; reduced: boolean;
  /** The last section of the list draws no line under it: the foot has its own. */ last?: boolean;
  onToggle: (step: SearchStep) => void;
  /** Where the section stands in the scrolling list. */ onPosition: (step: SearchStep, y: number) => void;
  /** Where the opening part stands inside the section. */ onBodyPosition: (step: SearchStep, y: number) => void;
  /** The opening part has arrived (`true`) or left (`false`). */ onSettled: (step: SearchStep, open: boolean) => void;
  children: ReactNode;
}) {
  return <View testID={`search-step-${step}`} onLayout={event => onPosition(step, event.nativeEvent.layout.y)}>
    <Press testID={step === 'gde' ? 'search-place-toggle' : `search-${step}-toggle`} accessibilityRole="button"
      accessibilityLabel={label} accessibilityValue={{ text: summary }} accessibilityState={{ expanded: open }}
      onPress={() => onToggle(step)} haptic="select" hitSlop={0} scaleTo={sys.motion.scale.row} style={s.header}>
      <View style={[s.copy, !open && s.summary, !open && large && s.summaryStacked]}>
        <T variant="bodyStrong" style={s.label}>{label}</T>
        {!open ? <T variant="note" tone="muted" style={[s.value, large && s.valueStacked]}>{summary}</T> : null}
      </View>
      <TurningCaret open={open} />
    </Press>
    <Collapsible open={open} reduced={reduced} testID={`search-collapse-${step}`} onSettled={isOpen => onSettled(step, isOpen)}
      onLayout={event => onBodyPosition(step, event.nativeEvent.layout.y)}>
      <View testID={`search-body-${step}`} style={s.body}><Surface kind="panel" style={s.panel}>{children}</Surface></View>
    </Collapsible>
    {last ? null : <View pointerEvents="none" style={s.rule} />}
  </View>;
}

const s = StyleSheet.create({
  // The row of a list: 56 dp, 12 over and under, 12 between its parts (`ListRow` plain).
  header: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.rowMinPlain, paddingVertical: sys.space.md },
  copy: { flex: 1, minWidth: 0 },
  // Short values share a reading line with the name; long values and enlarged text keep their full content.
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.md },
  summaryStacked: { flexDirection: 'column', alignItems: 'stretch' },
  label: { flexShrink: 1 },
  value: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, maxWidth: '100%', textAlign: 'right' },
  valueStacked: { flexGrow: 0, textAlign: 'left' },
  // What an open section holds: 12 under its row (the row's own padding), 16 before the line.
  body: { paddingBottom: sys.space.base },
  // Inside the frame the parts of a section stand 12 apart, as they did on the sheet itself.
  panel: { gap: sys.space.md },
  rule: { height: ruleWidth, backgroundColor: sys.color.line },
});
