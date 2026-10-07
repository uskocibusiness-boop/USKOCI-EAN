import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { ProductSheet } from '../product/ProductSheet';
import { ChromeIconButton } from '../system/ScreenChrome';
import { sys } from '../system/tokens';
import { dayHeading, weekdays } from './calendarPresentation';
import { DAY_MARK_SPOKEN, DayMark } from './DayMark';
import { addMonths, monthCells, monthName } from './months';
import type { DayMarkKind } from './planner';

/**
 * A cell is the whole day's touch: the circle of the number and the mark under it, 64 high and a seventh of the width across,
 * the cells touching so a tap never falls between two days.
 */
const CELL = 48;
/** The filled circle of the chosen day. */
const CHOSEN = 40;

/**
 * One month, Monday first, for jumping to a day (tap on the week's name). Unlike the date picker of the search it goes back as well
 * as forward, because a planner is also where you look at last week; and a day carries the same mark as in the week strip, so the
 * month is a map of what is on. Marks are drawn only for a month the planner has read (`marksFor` answers null for any other), never
 * guessed. The month's name is a polite live region, so a screen reader hears the month change.
 */
export function MonthGrid({ selected, today, now, marksFor, onPick }: {
  selected: string; today: string; now?: Date;
  /** The mark of each day of a month, or null when the planner has not read that month. */
  marksFor: (month: string) => Readonly<Record<string, DayMarkKind | null>> | null;
  onPick: (day: string) => void;
}) {
  const [month, setMonth] = useState(() => selected.slice(0, 7));
  const marks = marksFor(month);
  const cells = monthCells(month);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  return <View testID="month-grid" style={s.grid}>
    <View style={s.head}>
      <ChromeIconButton label="Prethodni mesec" glyph="caret-left" quiet onPress={() => setMonth(addMonths(month, -1))} />
      <T variant="bodyStrong" accessibilityRole="header" accessibilityLiveRegion="polite" style={s.month}>{monthName(month)}</T>
      <ChromeIconButton label="Sledeći mesec" glyph="caret-right" quiet onPress={() => setMonth(addMonths(month, 1))} />
    </View>
    {/* Every day's own name says its weekday, so the column heads are for the eye only. */}
    <View style={s.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {weekdays.map(day => <T key={day.short} variant="meta" tone="muted" style={s.weekday}>{day.short}</T>)}
    </View>
    {weeks.map((week, row) => <View key={`week-${row}`} style={s.week}>
      {week.map((day, index) => {
        if (day === null) return <View key={`blank-${index}`} style={s.cell} />;
        const chosen = day === selected, mark = marks?.[day] ?? null;
        return <Press key={day} accessibilityRole="button" haptic="select" scaleTo={1} hitSlop={0}
          accessibilityLabel={`${dayHeading(day, now)}${day === today ? ', danas' : ''}${mark ? `, ${DAY_MARK_SPOKEN[mark]}` : ''}`}
          accessibilityState={{ selected: chosen }} onPress={() => onPick(day)} style={s.cell}>
          <View testID={chosen ? 'month-chosen' : undefined} style={[s.circle, chosen && s.circleChosen]}>
            <T variant="body" style={[s.number, day === today && s.today, chosen && s.onChosen]}>{Number(day.slice(8, 10))}</T>
          </View>
          <DayMark kind={mark} />
        </Press>;
      })}
    </View>)}
  </View>;
}

/**
 * The month in a panel from below (the one sheet engine), opened by the week's name. Choosing a day closes it: the day is the answer.
 * Dismissing it any other way changes nothing.
 */
export function MonthSheet({ selected, today, now, marksFor, onPick, onClose }: {
  selected: string; today: string; now?: Date;
  marksFor: (month: string) => Readonly<Record<string, DayMarkKind | null>> | null;
  onPick: (day: string) => void; onClose: () => void;
}) {
  return <ProductSheet label="Izbor dana" onClose={onClose}>
    {dismiss => <MonthGrid selected={selected} today={today} now={now} marksFor={marksFor} onPick={day => { onPick(day); dismiss(); }} />}
  </ProductSheet>;
}

const s = StyleSheet.create({
  grid: { paddingBottom: sys.space.base },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sys.space.xs },
  month: { flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: sys.space.xs },
  cell: { flex: 1, height: CELL + sys.space.base, alignItems: 'center', justifyContent: 'center', gap: sys.space.xs },
  circle: { width: CHOSEN, height: CHOSEN, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  circleChosen: { backgroundColor: sys.color.green },
  number: { fontVariant: ['tabular-nums'] },
  today: { fontWeight: '700', color: sys.color.green },
  onChosen: { color: sys.color.onDark, fontWeight: '700' },
});
