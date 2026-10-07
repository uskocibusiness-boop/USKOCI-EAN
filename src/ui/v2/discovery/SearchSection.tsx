import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { TurningCaret } from '../../system/Disclosure';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { sys } from '../../system/tokens';
import { Collapsible } from './Collapsible';

/** The sections of the search panel, in the order the person is walked through them (UX plan 2.19). */
export type SearchStep = 'gde' | 'kada' | 'sta' | 'cena' | 'koliko' | 'kako';
export const SEARCH_STEPS: readonly SearchStep[] = ['gde', 'kada', 'sta', 'cena', 'koliko', 'kako'];

/**
 * One section of the panel, its own card: a row with its name and, while it is closed, what is chosen in it, and under
 * the row the part that opens (one section is open at a time, which the panel decides). The row is a button that says
 * whether it is expanded. The section owns only how it opens; every choice stays in the panel's draft, so closing it
 * loses nothing. At large text the chosen value goes under the name instead of beside it.
 */
export function SearchSection({ step, label, summary, art, open, large, reduced, onToggle, onPosition, onBodyPosition, onSettled, children }: {
  step: SearchStep; label: string; summary: string; art: FactArtKind; open: boolean; large: boolean; reduced: boolean;
  onToggle: (step: SearchStep) => void;
  /** Where the card stands in the scrolling list. */ onPosition: (step: SearchStep, y: number) => void;
  /** Where the opening part stands inside the card. */ onBodyPosition: (step: SearchStep, y: number) => void;
  /** The opening part has arrived (`true`) or left (`false`). */ onSettled: (step: SearchStep, open: boolean) => void;
  children: ReactNode;
}) {
  return <View testID={`search-step-${step}`} style={s.card} onLayout={event => onPosition(step, event.nativeEvent.layout.y)}>
    <Press testID={step === 'gde' ? 'search-place-toggle' : `search-${step}-toggle`} accessibilityRole="button"
      accessibilityLabel={label} accessibilityValue={{ text: summary }} accessibilityState={{ expanded: open }}
      onPress={() => onToggle(step)} haptic="select" hitSlop={0} scaleTo={sys.motion.scale.row} style={s.header}>
      <FactArt kind={art} size={28} cut="art" />
      <View style={[s.copy, !open && s.summary, !open && large && s.summaryStacked]}>
        <T variant={open ? 'bodyStrong' : 'note'} tone={open ? 'ink' : 'muted'} style={s.label}>{label}</T>
        {!open ? <T variant="copy" style={[s.value, large && s.valueStacked]}>{summary}</T> : null}
      </View>
      <TurningCaret open={open} />
    </Press>
    <Collapsible open={open} reduced={reduced} testID={`search-collapse-${step}`} onSettled={isOpen => onSettled(step, isOpen)}
      onLayout={event => onBodyPosition(step, event.nativeEvent.layout.y)}>
      <View testID={`search-body-${step}`} style={s.body}>{children}</View>
    </Collapsible>
  </View>;
}

const s = StyleSheet.create({
  // Each section is a card of its own, on the white sheet: a hairline edge and the card corner, nothing inside it is a card.
  card: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.cardLine },
  header: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 64, paddingHorizontal: sys.space.base, paddingVertical: sys.space.md },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // Short values share a reading line with the name; long values and enlarged text keep their full content.
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.md },
  summaryStacked: { flexDirection: 'column', alignItems: 'stretch' },
  label: { flexShrink: 1 },
  value: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, maxWidth: '100%', textAlign: 'right', fontWeight: '500', color: sys.color.ink },
  valueStacked: { flexGrow: 0, textAlign: 'left' },
  // The grid of days reaches this padding's edge (it undoes `sys.space.md`), so it uses the card's whole width.
  body: { paddingHorizontal: sys.space.md, paddingBottom: sys.space.base, gap: sys.space.md },
});
