import type { OwnedTaskCounts } from '../../data/marketplaceView';
import { plural, zadataka } from '../system/plural';
import type { SegmentedOption } from '../system/Segmented';

/**
 * The tabs of Moji zadaci and the numbers that stand on them (UI/UX pass, plan item 8.1, 2026-10-02; the one control row of
 * the composition spec, 4.5, 2026-10-08).
 *
 * THE ROW. Three tabs are `Segmented`'s equal-width track: each has a third of the width, the words go to a second line at a
 * large text size instead of being cut, and nothing scrolls. (Before, the tabs were content-sized capsules in a scroller, and this
 * file measured, from the bundled Inter, whether the counts fitted beside the words; there is nothing left to measure.)
 *
 * WHAT STANDS ON A TAB. A number is drawn only for what waits for the person: "Aktivni" carries how many of my tasks wait for my
 * choice, in the orange of what waits (the colour-meaning table in `tokens.ts`), spoken as it always was. "Nacrti" and "Istorija"
 * carry how many tasks the set holds, but only SPOKEN (a screen reader hears "2 nacrta"): a quiet number on a control that has to
 * stay readable is noise, and the list says how many it shows under the control ("7 zadataka"). Every number is one the screen
 * already has: the server's counts of a paged build, or the counts of the whole list the other build holds (`ownedTaskCounts`). A
 * set that is empty, and a number that is not known, say nothing: a zero reads as news, and nothing is invented.
 */

/** The three sets that are tabs. A fourth, all of them, is reached from an empty state and has no tab. */
export type OwnTaskTab = 'active' | 'drafts' | 'history';
export const OWN_TASK_TABS: readonly { readonly key: OwnTaskTab; readonly label: string }[] = [
  { key: 'active', label: 'Aktivni' }, { key: 'drafts', label: 'Nacrti' }, { key: 'history', label: 'Istorija' },
];

/**
 * The tabs with the numbers that stand on them. `counts` is what the screen knows (null when it does not know yet: nothing is
 * said for any set, and no orange number is drawn over an unknown).
 */
export function ownTaskTabs(counts: OwnedTaskCounts | null): SegmentedOption<OwnTaskTab>[] {
  const waiting = counts?.waiting ?? 0;
  return OWN_TASK_TABS.map((tab): SegmentedOption<OwnTaskTab> => {
    if (tab.key === 'active' && waiting > 0) return { ...tab, badge: waiting, badgeLabel: `Za tvoj izbor: ${zadataka(waiting)}`, badgeTone: 'attention' };
    if (counts && tab.key === 'drafts' && counts.drafts > 0) return { ...tab, badge: counts.drafts, badgeLabel: plural(counts.drafts, 'nacrt', 'nacrta', 'nacrta') };
    if (counts && tab.key === 'history' && counts.history > 0) return { ...tab, badge: counts.history, badgeLabel: zadataka(counts.history) };
    return { ...tab };
  });
}
