import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { civilDay, weekdayOf } from './calendarPresentation';
import { DAY_MARK_SPOKEN, DayMark } from './DayMark';
import type { DayMarkKind } from './planner';

/**
 * The seven days of the week (owner, 2026-10-07). Seven equal columns that always fit, each a day: the weekday, its number, and one DOT
 * for a Dogovor on it (green, orange when something waits for you, grey when only finished work is on it). The owner's phone
 * (8 Oct 2026) showed dashes under the days and a dotted ring that meant nothing, and a thin shade for the hours a worker is free: that
 * is Dostupnost's to show, so the strip has the dot and nothing else. The mark keeps its place whether there is one or not, so
 * choosing another day or another week moves nothing. Unselected days are not filled (B18); today wears a green ring; the chosen day is
 * filled green.
 *
 * Each cell is 44 dp or more across on the owner's phone (361 dp) and no cell's touch overlaps its neighbour's (no hit slop); on a
 * 320 dp phone a cell is about 38 dp wide and 80 tall, the accepted exception to the 44 rule, with the full name spoken. At a very
 * large text size the weekday shrinks to its letter. Every day's name carries what its marks only draw, so nothing is colour or
 * shape alone.
 */
export function WeekStrip({ days, selected, today, now, marks, onSelect }: {
  days: readonly string[]; selected: string; today: string; now?: Date;
  /** The mark of each day. Null while the schedule is still being read: no day is marked then, and none is called empty. */
  marks: Readonly<Record<string, DayMarkKind | null>> | null;
  onSelect: (day: string) => void;
}) {
  const scale = useTextScale();
  return <View style={s.strip}>{days.map(date => {
    const mark = marks?.[date] ?? null;
    const chosen = selected === date, isToday = date === today;
    const weekday = weekdayOf(date);
    const spoken = `${weekday.name}, ${civilDay(date, now)}${isToday ? ', danas' : ''}${mark ? `, ${DAY_MARK_SPOKEN[mark]}` : ''}`;
    return <Press key={date} accessibilityRole="button" haptic="select" hitSlop={0} accessibilityLabel={spoken}
      accessibilityState={{ selected: chosen }} onPress={() => onSelect(date)} style={{ flex: 1, minWidth: 0, minHeight: 72, marginHorizontal: 2,
        paddingVertical: sys.space.sm, gap: sys.space.xs, alignItems: 'center', borderRadius: sys.radius.control, borderWidth: 1,
        backgroundColor: chosen ? sys.color.green : 'transparent', borderColor: isToday && !chosen ? sys.color.green : 'transparent' }}>
      <T variant="meta" tone={chosen ? 'onDark' : 'muted'} numberOfLines={1}>{scale >= 1.5 ? weekday.short.charAt(0) : weekday.short}</T>
      <T variant="heading" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
        style={{ color: chosen ? sys.color.onDark : isToday ? sys.color.green : sys.color.ink }}>{Number(date.slice(-2))}</T>
      <DayMark kind={mark} onGreen={chosen} />
    </Press>;
  })}</View>;
}

const s = StyleSheet.create({
  // The screen gives the strip a little more than its gutters (it reaches 8 dp past them), so each day has the room of a thumb;
  // the chosen pill is inset by the cell's own margin, so its edge still sits close to the gutter.
  strip: { flexDirection: 'row', marginTop: sys.space.md },
});
