import { ScrollView, StyleSheet } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { Glyph } from '../../system/Glyph';
import { plural } from '../../system/plural';
import { Segmented } from '../../system/Segmented';
import { materialControl, sys } from '../../system/tokens';

/** A quick chip: one existing filter, toggled at once, without opening the search. */
export type QuickChip = { key: string; label: string; selected: boolean; onPress: () => void };

/** Which tasks the list is about: every open task, or only the ones that match the person's own work profile. */
export type ScopeKey = 'all' | 'forMe';
export const SCOPE_OPTIONS: readonly { key: ScopeKey; label: string }[] = [
  { key: 'all', label: 'Svi zadaci' }, { key: 'forMe', label: 'Za mene' },
];

/** The filters chip says its name always, and how many are on when any is: "Filteri", "Filteri · 2". */
export const filtersWords = (count: number) => count > 0 ? `Filteri · ${count}` : 'Filteri';
/** The same, spoken: the count as a Serbian plural ("Filteri, 2 aktivna"). */
export const filtersSpoken = (count: number) => count > 0 ? `Filteri, ${plural(count, 'aktivan', 'aktivna', 'aktivnih')}` : 'Filteri';

/**
 * The one row of chips of the Zadaci screen (UX plan 2.13 and section P of the visual proposal, variant B "filteri dole"): the
 * scope first, then "Filteri", then the quick filters. The same row stands in two places and is the same row: over the map under
 * the search pill while the list is lowered, and as the sticky header of the list sheet from half height up, where a thumb reaches
 * it. It never scrolls away with the list.
 *
 * - The scope ("Svi zadaci | Za mene", R28) is drawn only when the build says the server has the filter key (`forMeAvailable`,
 *   DISCOVERY-ZAMENE): a control that does nothing is not shown, so without it the row starts with "Filteri". A scope with a single
 *   option would be a dead control too, so it never stands alone.
 * - "Filteri · N" opens the search at its conditions; N counts the conditions that are on.
 * - A quick chip is offered only for a filter the search really has and the tasks can back (the screen decides which), and it
 *   writes into the same state as the panel, so there are never two sources of truth.
 * - "U blizini" is not a chip: it is not a filter, it only moves the camera, so it stands with the zoom buttons above the list.
 */
export function DiscoveryChipRow({ forMeAvailable = false, scope = 'all', onScope, filtersCount, onFilters, chips, surface = 'map', testID }: {
  forMeAvailable?: boolean;
  scope?: ScopeKey; onScope?: (scope: ScopeKey) => void;
  filtersCount: number; onFilters: () => void;
  chips: readonly QuickChip[];
  /** Over the map the chips lift off the tiles; in the list's header (white) they are flat with a hairline. */
  surface?: 'map' | 'sheet';
  testID?: string;
}) {
  const flat = surface === 'sheet';
  return <ScrollView testID={testID} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
    accessibilityLabel="Brzi filteri" style={s.rail} contentContainerStyle={[s.chips, flat && s.chipsSheet]}>
    {forMeAvailable ? <Segmented<ScopeKey> options={SCOPE_OPTIONS} value={scope} onChange={next => onScope?.(next)} contentSized style={s.scope} /> : null}
    <Press testID="chip-filters" accessibilityRole="button" accessibilityLabel={filtersSpoken(filtersCount)}
      accessibilityHint="Otvara pretragu: gde, kada i uslovi." accessibilityState={{ selected: filtersCount > 0 }}
      haptic="select" scaleTo={sys.motion.scale.button} hitSlop={0} onPress={onFilters}
      style={[s.chip, flat ? s.flat : materialControl.raised, filtersCount > 0 && s.filterOn]}>
      <Glyph name="filters" size={20} tone="ink" />
      <T variant="meta" style={s.chipText} numberOfLines={1}>{filtersWords(filtersCount)}</T>
    </Press>
    {chips.map(chip => <Press key={chip.key} accessibilityRole="button" accessibilityLabel={chip.label} accessibilityState={{ selected: chip.selected }}
      haptic="select" scaleTo={sys.motion.scale.button} hitSlop={0} onPress={chip.onPress}
      style={[s.chip, flat ? s.flat : materialControl.raised, chip.selected && (flat ? s.chipOnFlat : s.chipOn)]}>
      {chip.selected ? <Glyph name="check" size={16} tone="ink" /> : null}
      <T variant="meta" style={[s.chipText, chip.selected && s.chipTextOn]} numberOfLines={1}>{chip.label}</T>
    </Press>)}
  </ScrollView>;
}

const s = StyleSheet.create({
  rail: { flexGrow: 0, alignSelf: 'stretch' },
  // The two tabs of the scope share a track, and in a row that scrolls the track has no width of its own to share: it shrank to the shortest word and broke "Svi zadaci" in
  // two (found in the lab). It is given the width its two names need at the owner's text size; at a larger one the words go to a second line, as the control says.
  scope: { width: 232 },
  // The room the row asks of its parent: one row of 48 high chips with the air a lift needs above and below.
  chips: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.base, paddingTop: 2, paddingBottom: sys.space.sm },
  // In the list's header the row lines up with the cards under it (the list's own side padding).
  chipsSheet: { paddingHorizontal: sys.space.lg },
  // Each control stays readable over map tiles; the selected one has both a check and a recessed well.
  chip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 48, paddingHorizontal: sys.space.md, borderRadius: sys.radius.pill,
    borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  flat: { borderColor: sys.color.lineStrong },
  chipOn: { backgroundColor: sys.color.greenSoft, borderColor: sys.color.lineStrong, ...materialControl.inset },
  chipOnFlat: { backgroundColor: sys.color.greenSoft, borderColor: sys.color.ink },
  filterOn: { backgroundColor: sys.color.wash, borderColor: sys.color.ink },
  chipText: { fontWeight: '500', color: sys.color.ink },
  chipTextOn: { fontWeight: '600' },
});
