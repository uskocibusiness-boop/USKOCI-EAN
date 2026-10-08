import { useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { WorkerCalendarEvent } from '../../contracts/workerCalendar';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { zonaTelefona } from '../../lib/vreme';
import { Press } from '../Press';
import { T } from '../Text';
import { DetailTopBar } from '../system/DetailTopBar';
import { FactArt } from '../system/FactArt';
import { ClockArt } from '../system/ClockArt';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { Screen } from '../system/Screen';
import { ChromeIconButton } from '../system/ScreenChrome';
import { Section } from '../system/Section';
import { StateView } from '../system/StateView';
import { useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { usePullRefresh } from '../system/usePullRefresh';
import { V2Action } from '../v2/V2Action';
import { AgendaRow } from './AgendaRow';
import { agendaCoverage, type AgendaAgreement } from './agenda';
import { dayHeading, shiftDate, weekDates, weekLabel } from './calendarPresentation';
import { MonthSheet } from './MonthSheet';
import { monthCells } from './months';
import { EMPTY_DAY, buildPlanner, dayMarks, entriesOnDay, overlapNotes, type PlannerEntry } from './planner';
import { inWindow, plannerWindow, type PlannerWindow } from './serbianDays';
import { WeekStrip } from './WeekStrip';
import { useWeekSwipe } from './weekSwipe';

export type AgendaSchedule = { state: 'loading' } | { state: 'error'; message: string | null }
  | { state: 'ready'; events: readonly WorkerCalendarEvent[] };
export type AgendaList = { state: 'loading' } | { state: 'error' } | { state: 'ready'; agreements: readonly AgendaAgreement[] };

const NO_EVENTS: readonly WorkerCalendarEvent[] = [];
/** How many rows the section under the day shows before "Prikaži još". */
const SECTION_LIMIT = 3;

/**
 * Raspored (until 2026-10-07 "Kalendar obaveza"; the owner named the planner): the DOGOVORI, both sides, with their time. Since the owner's
 * phone of 8 Oct 2026 it is that and nothing else: the screen used to mix my published tasks, my applications and my Dogovori ("1 Dogovor ·
 * 6 zadataka"), under four chips, three words for "flexible" and marks under the days that meant nothing. My tasks are in "Moji zadaci", my
 * applications in "Moje prijave"; a schedule says WHEN something is agreed.
 *
 * Day by day in Serbian time (`planner.ts`): the Dogovori with an exact agreed time (finished ones included) stand on their day; the ones with
 * none stand in "Termin još nije dogovoren", each with "Predloži termin" where a term may be proposed; then the way into Dostupnost and into the
 * Arhiva. A view: it has no primary command.
 *
 * The frame is the system's `Screen` (the edge 20, 24 between one part and the next, 32 under the last). The week and its arrows in one
 * row (its name opens the month, "Danas" stands in the row when today is in another week), the seven days under it with a dot each for a
 * Dogovor on it (swipe sideways to change the week), no row of chips, then the day: its heading and its records by the hour, each a card
 * with the time as its first line. An empty day is one quiet line, never a box and never a minimum height (critique B18). A read that
 * failed is said, never drawn as an empty day. Presentation only: the route owns the reads and every command.
 */
export function AgendaScreen({ selected, today, schedule, list, readWindow, refreshing, retrying = false, onSelect, onBack, onRefresh, onRetry, onRetryList,
  onOpen, onProposeTerm, onAvailability, onArchive, phoneZone = zonaTelefona(), now }: {
  selected: string; today: string; schedule: AgendaSchedule; list: AgendaList;
  /** The window of weeks the schedule was read for (`plannerWindow`); the month of the chosen day when left out. Everything outside it is unknown, not empty. */
  readWindow?: PlannerWindow;
  /** A pull re-reads every source while what is on screen stays. */ refreshing: boolean;
  /** The schedule is being read again after an error. */ retrying?: boolean;
  onSelect: (day: string) => void; onBack: () => void; onRefresh: () => void;
  /** Read everything again after the schedule failed. */ onRetry: () => void;
  /** Read the Dogovori again after they failed (the schedule did not). */ onRetryList: () => void;
  onOpen: (agreementId: string) => void;
  /** "Predloži termin" under a Dogovor that has none: the form of Izmene Dogovora that proposes one. Without it the card has no such command. */
  onProposeTerm?: (agreementId: string) => void;
  onAvailability: () => void;
  /** The way into the Arhiva; the row is not drawn without it (the design gallery has no archive). */
  onArchive?: () => void;
  phoneZone?: string; now?: Date;
}) {
  const scale = useTextScale();
  const { width } = useWindowDimensions();
  // At 320 dp or a large text size the week label shares its row with only the two arrows; "Danas" gets its own line
  // under it (review of owner step 10: "28. dec 2026 – 3. jan 2027" was cut off beside "Danas" and the arrows).
  const narrow = width < 360 || scale >= 1.3;
  const [monthOpen, setMonthOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const swipe = useWeekSwipe(step => onSelect(shiftDate(selected, step * 7)));
  const days = useMemo(() => weekDates(selected), [selected]);
  // The planner draws what the schedule was read for: by default the month the chosen day is in, as whole weeks.
  const month = selected.slice(0, 7);
  const reach = useMemo(() => readWindow ?? plannerWindow(`${month}-01`), [readWindow, month]);
  const events = schedule.state === 'ready' ? schedule.events : NO_EVENTS;
  const agreements = list.state === 'ready' ? list.agreements : null;
  // "U toku" is judged at the minute, so the planner is not rebuilt on every render.
  const minute = Math.floor((now ?? new Date()).getTime() / 60_000);
  const clock = useMemo(() => now ?? new Date(minute * 60_000), [now, minute]);
  const planner = useMemo(() => buildPlanner({ events, agreements, from: reach.from, to: reach.to, now: clock }),
    [events, agreements, reach.from, reach.to, clock]);
  const ready = schedule.state === 'ready';
  const coverage = agreements ? agendaCoverage(agreements, events) : 'full';
  const zoneNote = phoneZone !== DOGOVORENA_ZONA;
  // Everything on the day decides the overlaps.
  const day = useMemo(() => ready ? entriesOnDay(planner.placed, selected) : [], [ready, planner, selected]);
  const overlaps = useMemo(() => overlapNotes(day), [day]);
  const loose = ready ? planner.loose : [];
  const marks = useMemo(() => ready ? dayMarks(planner.placed, days) : null, [ready, planner, days]);
  // What failed. A source that failed is said, and a day it could have filled is never called empty.
  const dogovoriFailed = list.state === 'error', dogovoriSilent = !!agreements && coverage === 'unknown';
  const empty = day.length === 0;
  // Only the schedule's work is shown while the Dogovori did not load (it can be retried) or came without saying whether they have
  // an exact time (retrying would not change that).
  const note = ready && (dogovoriFailed || dogovoriSilent) ? empty ? 'Nema termina u kojima uskačeš.' : 'Učitani su samo termini u kojima uskačeš.' : null;
  const notesView = note ? <View style={s.partial}>
    <View style={s.partialLines}><T variant="note" tone="muted">{note}</T></View>
    {dogovoriFailed ? <V2Action label="Pokušaj ponovo" kind="quiet" compact onPress={onRetryList} /> : null}
  </View> : null;
  const propose = onProposeTerm ? (entry: PlannerEntry) => onProposeTerm(entry.id) : undefined;
  const row = (entry: PlannerEntry) => <AgendaRow key={entry.key} entry={entry} day={selected} onOpen={item => onOpen(item.id)} onProposeTerm={propose}
    overlap={overlaps.get(entry.key) ?? null} zoneNote={zoneNote} />;
  let content: ReactNode;
  if (schedule.state === 'loading') content = <StateView kind="loading" title="Učitavamo raspored…" skeleton={{ count: 2, rows: 2 }} />;
  else if (schedule.state === 'error') content = <StateView kind="error" art="calendar" title="Raspored nije učitan."
    body={schedule.message ?? 'Proveri vezu pa pokušaj ponovo.'} primary={{ label: 'Pokušaj ponovo', onPress: onRetry, disabled: retrying }} />;
  // Never say a day is empty before every read it depends on has settled.
  else if (empty && list.state === 'loading') content = <StateView kind="loading" title="Učitavamo raspored…" skeleton={{ count: 1, rows: 2 }} />;
  else if (empty) content = notesView ?? <T variant="note" tone="muted">{EMPTY_DAY}</T>;
  else content = <View style={s.list}>{notesView}{day.map(row)}</View>;
  // The Dogovori that have no exact time: the first few, and the rest on a press.
  const section = loose.length ? <Section title="Termin još nije dogovoren">
    <View style={s.list}>{(expanded ? loose : loose.slice(0, SECTION_LIMIT)).map(row)}</View>
    {loose.length > SECTION_LIMIT ? <View style={s.moreLine}>
      <V2Action label={expanded ? 'Prikaži manje' : `Prikaži još ${loose.length - SECTION_LIMIT}`} kind="quiet" compact onPress={() => setExpanded(open => !open)} />
    </View> : null}
  </Section> : null;
  // The month shows the same marks as the week, for the month the planner has read; any other month is plain numbers.
  const marksFor = (target: string) => {
    const cells = monthCells(target).filter((cell): cell is string => cell !== null);
    return ready && cells.every(cell => inWindow(cell, reach)) ? dayMarks(planner.placed, cells) : null;
  };
  const toToday = days.includes(today) ? null : <V2Action label="Danas" kind="quiet" compact onPress={() => onSelect(today)} />;
  // The spinner of a pull is a pull's: every read the screen starts for another reason leaves it alone.
  const pull = usePullRefresh(onRefresh, refreshing);
  return <>
    <Screen kind="detail" header={<DetailTopBar title="Raspored" onBack={onBack} />}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}>
      {/* The controls: the week names itself, and its name opens the month; "Danas" only when today is in another week; the two arrows
          stay together. The label is never cut: it wraps, and on a narrow row "Danas" moves under it. */}
      <View>
        <View style={s.weekRow}>
          <Press accessibilityRole="button" accessibilityLabel={weekLabel(days, now)} accessibilityHint="Otvara mesec" haptic="select"
            scaleTo={sys.motion.scale.row} onPress={() => setMonthOpen(true)} style={s.weekTitle}>
            <T variant="bodyStrong" style={s.weekLabel}>{weekLabel(days, now)}</T>
            <Glyph name="caret-down" size={16} tone="muted" />
          </Press>
          {narrow ? null : toToday}
          <View style={s.arrows}>
            <ChromeIconButton label="Prethodna nedelja" glyph="caret-left" haptic="select" onPress={() => onSelect(shiftDate(selected, -7))} />
            <ChromeIconButton label="Sledeća nedelja" glyph="caret-right" haptic="select" onPress={() => onSelect(shiftDate(selected, 7))} />
          </View>
        </View>
        {narrow && toToday ? <View style={s.todayLine}>{toToday}</View> : null}
        {/* A finger moving sideways over the week or the day changes the week; the arrows do the same. The view that holds the
            week reaches past the gutters by a little, so each day has the room of a thumb and every touch lands inside its bounds. */}
        <View {...swipe} style={s.stripSwipe}>
          <WeekStrip days={days} selected={selected} today={today} now={now} marks={marks} onSelect={onSelect} />
        </View>
      </View>
      <View {...swipe} style={s.days}>
        <View>
          <View style={s.heading}>
            {/* A screen reader reaches the same read as the pull as an action of the day's heading (round-5c: an action on the
                ScrollView was never offered, since Android's scroll view keeps its own accessibility delegate and VoiceOver does
                not focus a scroll view). A named action, not "activate", so the heading does not become a button. */}
            <T variant="heading" accessibilityRole="header" accessibilityActions={[{ name: 'refresh', label: 'Osveži raspored' }]}
              onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'refresh') onRefresh(); }}>{dayHeading(selected, now)}</T>
            {zoneNote ? <T variant="note" tone="muted">Po vremenu u Srbiji</T> : null}
          </View>
          <View testID="day-block" style={s.day}>{content}</View>
        </View>
        {section}
      </View>
      {/* Set once in a while, read every time: the quiet rows stand under the day, not before it. Two rows of the one list. */}
      <View style={s.foot}>
        <ListRow leading={<ClockArt size={32} />} title="Moja dostupnost za rad" accessibilityLabel="Moja dostupnost za rad" last={!onArchive} onPress={onAvailability} />
        {onArchive ? <ListRow leading={<FactArt kind="document" size={32} />} title="Arhiva" accessibilityLabel="Arhiva" last onPress={onArchive} /> : null}
      </View>
    </Screen>
    {monthOpen ? <MonthSheet selected={selected} today={today} now={now} marksFor={marksFor} onPick={onSelect} onClose={() => setMonthOpen(false)} /> : null}
  </>;
}

const s = StyleSheet.create({
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  // The week's name is the press that opens the month: it takes the row's room, 48 dp high.
  weekTitle: { flex: 1, minWidth: 0, minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  weekLabel: { flexShrink: 1, minWidth: 0 },
  arrows: { flexDirection: 'row', gap: sys.space.xs },
  // A quiet action's own inset is pulled back, so "Danas" lines up with the week label above it (as dayActions does).
  todayLine: { flexDirection: 'row', marginLeft: -sys.space.base },
  moreLine: { flexDirection: 'row', marginLeft: -sys.space.base },
  stripSwipe: { marginHorizontal: -sys.space.sm },
  // The day and the section under it are separated by space, the screen's 24, and by nothing else.
  days: { gap: layout.section },
  heading: { gap: sys.space.xs },
  day: { marginTop: sys.space.sm },
  list: { gap: sys.space.md },
  partial: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm },
  partialLines: { flexShrink: 1, gap: sys.space.xs },
  // The screen's 24 and 8 more: the quiet rows are a zone of their own, 32 from the last record.
  foot: { marginTop: sys.space.sm },
});
