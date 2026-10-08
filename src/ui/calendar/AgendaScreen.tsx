import { useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { MojaPrijavaProjekcija, PotrebaProjekcija } from '../../contracts/projections';
import type { WorkerAvailability } from '../../contracts/workerAvailability';
import type { WorkerCalendarEvent } from '../../contracts/workerCalendar';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { zonaTelefona } from '../../lib/vreme';
import { Press } from '../Press';
import { T } from '../Text';
import { GroupHeader } from '../agreements/GroupHeader';
import { DetailTopBar } from '../system/DetailTopBar';
import { FactArt } from '../system/FactArt';
import { ClockArt } from '../system/ClockArt';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { Screen } from '../system/Screen';
import { ChromeIconButton } from '../system/ScreenChrome';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import { AgendaRow } from './AgendaRow';
import { agendaCoverage, type AgendaAgreement } from './agenda';
import { dayAvailability } from './availabilityShade';
import { dayHeading, shiftDate, weekDates, weekLabel } from './calendarPresentation';
import { MonthSheet } from './MonthSheet';
import { monthCells } from './months';
import { EMPTY_DAY, PLANNER_FILTERS, buildPlanner, countsText, dayMarks, entriesOnDay, filterEntries, looseOnWeek, overlapNotes,
  type PlannerEntry, type PlannerFilter } from './planner';
import { inWindow, plannerWindow, serbianSpan, type PlannerWindow } from './serbianDays';
import { WeekStrip } from './WeekStrip';
import { useWeekSwipe } from './weekSwipe';

export type AgendaSchedule = { state: 'loading' } | { state: 'error'; message: string | null }
  | { state: 'ready'; events: readonly WorkerCalendarEvent[] };
export type AgendaList = { state: 'loading' } | { state: 'error' } | { state: 'ready'; agreements: readonly AgendaAgreement[] };
/** My own tasks and my applications, read for the planner the way Početna reads them. Left out, the screen shows neither. */
export type AgendaNeeds = { state: 'loading' } | { state: 'error' } | { state: 'ready'; needs: readonly PotrebaProjekcija[] };
export type AgendaApplications = { state: 'loading' } | { state: 'error' } | { state: 'ready'; applications: readonly MojaPrijavaProjekcija[] };
/**
 * What the worker has said they can work, for the shade under the days. `none` draws no shade: the person is not a worker, the read
 * has not come, or it failed. It is never an error of the screen, since the shade is a hint and nothing on the screen depends on it.
 */
export type AgendaAvailability = { state: 'none' } | { state: 'ready'; value: Pick<WorkerAvailability, 'timezone' | 'rules' | 'windows'> };

const NO_EVENTS: readonly WorkerCalendarEvent[] = [];
const NO_NEEDS: AgendaNeeds = { state: 'ready', needs: [] };
const NO_APPLICATIONS: AgendaApplications = { state: 'ready', applications: [] };
const NO_AVAILABILITY: AgendaAvailability = { state: 'none' };
/** How many rows a section under the day shows before "Prikaži još". */
const SECTION_LIMIT = 3;

/**
 * Raspored (until 2026-10-07 "Kalendar obaveza"; the owner named the planner): everything of mine that has a time, in one place.
 * The Dogovori of both sides, with an exact agreed time (finished ones included), my own published tasks and my open
 * applications, day by day in Serbian time (`planner.ts`); what has no exact time stands in sections under the day; the way into
 * Dostupnost and into the Arhiva. A view: it has no primary command.
 *
 * The frame is the system's `Screen` (the edge 20, 24 between one part and the next, 32 under the last). The week and its arrows in one
 * row (its name opens the month, "Danas" stands in the row when today is in another week), the seven days under it with a mark each
 * (swipe sideways to change the week), then at most ONE row of controls: the chips "Sve · Dogovori · Moji zadaci · Moje prijave" - and
 * none at all when everything the person has is of one kind, since there is nothing to choose between. Then the day: its heading and
 * its records by the hour, each a card with the time as its first line. An empty day is one quiet line, never a box and never a
 * minimum height (critique B18). A read that failed is said, never drawn as an empty day.
 * Presentation only: the route owns the reads and every command.
 */
export function AgendaScreen({ selected, today, schedule, list, needs = NO_NEEDS, applications = NO_APPLICATIONS, availability = NO_AVAILABILITY, readWindow,
  refreshing, retrying = false, onSelect, onBack, onRefresh, onRetry, onRetryList, onOpen, onOpenTask, onOpenApplication, onAvailability, onArchive,
  phoneZone = zonaTelefona(), now }: {
  selected: string; today: string; schedule: AgendaSchedule; list: AgendaList;
  needs?: AgendaNeeds; applications?: AgendaApplications; availability?: AgendaAvailability;
  /** The window of weeks the schedule was read for (`plannerWindow`); the month of the chosen day when left out. Everything outside it is unknown, not empty. */
  readWindow?: PlannerWindow;
  /** A pull re-reads every source while what is on screen stays. */ refreshing: boolean;
  /** The schedule is being read again after an error. */ retrying?: boolean;
  onSelect: (day: string) => void; onBack: () => void; onRefresh: () => void;
  /** Read everything again after the schedule failed. */ onRetry: () => void;
  /** Read again what failed besides the schedule: the Dogovori, my tasks, my applications. */ onRetryList: () => void;
  onOpen: (agreementId: string) => void;
  /** A task of mine; `choosing` is how many applications wait for a choice (then the candidates are what it opens). */
  onOpenTask?: (needId: string, choosing: number) => void;
  onOpenApplication?: (applicationId: string) => void;
  onAvailability: () => void;
  /** The way into the Arhiva; the row is not drawn without it (the design gallery has no archive). */
  onArchive?: () => void;
  /** No longer drawn: the Dogovori without an exact term are listed under the day now. Kept only so the design gallery still compiles. */
  onWithoutTerm?: () => void;
  phoneZone?: string; now?: Date;
}) {
  const scale = useTextScale();
  const { width } = useWindowDimensions();
  // At 320 dp or a large text size the week label shares its row with only the two arrows; "Danas" gets its own line
  // under it (review of owner step 10: "28. dec 2026 – 3. jan 2027" was cut off beside "Danas" and the arrows).
  const narrow = width < 360 || scale >= 1.3;
  const [chosen, setFilter] = useState<PlannerFilter>('all');
  const [monthOpen, setMonthOpen] = useState(false);
  const [expanded, setExpanded] = useState({ loose: false, pending: false });
  const swipe = useWeekSwipe(step => onSelect(shiftDate(selected, step * 7)));
  const days = useMemo(() => weekDates(selected), [selected]);
  // The planner draws what the schedule was read for: by default the month the chosen day is in, as whole weeks.
  const month = selected.slice(0, 7);
  const reach = useMemo(() => readWindow ?? plannerWindow(`${month}-01`), [readWindow, month]);
  const events = schedule.state === 'ready' ? schedule.events : NO_EVENTS;
  const agreements = list.state === 'ready' ? list.agreements : null;
  const needRows = needs.state === 'ready' ? needs.needs : null;
  const applicationRows = applications.state === 'ready' ? applications.applications : null;
  // "U toku" is judged at the minute, so the planner is not rebuilt on every render.
  const minute = Math.floor((now ?? new Date()).getTime() / 60_000);
  const clock = useMemo(() => now ?? new Date(minute * 60_000), [now, minute]);
  const planner = useMemo(() => buildPlanner({ events, agreements, needs: needRows, applications: applicationRows, from: reach.from, to: reach.to, now: clock }),
    [events, agreements, needRows, applicationRows, reach.from, reach.to, clock]);
  const ready = schedule.state === 'ready';
  // The chips choose between kinds. With one kind (or none) there is nothing to choose, so there is no row - and no filter is on. The
  // kinds are counted over everything the planner read, not over the week, so the row does not come and go while the weeks are swiped.
  const kinds = useMemo(() => new Set([...planner.placed, ...planner.loose, ...planner.pending].map(entry => entry.kind)), [planner]);
  const chips = ready && kinds.size > 1;
  const filter: PlannerFilter = chips ? chosen : 'all';
  const coverage = agreements ? agendaCoverage(agreements, events) : 'full';
  const zoneNote = phoneZone !== DOGOVORENA_ZONA;
  // Everything on the day decides the overlaps; the chip decides what is drawn.
  const everything = useMemo(() => ready ? entriesOnDay(planner.placed, selected) : [], [ready, planner, selected]);
  const day = useMemo(() => filterEntries(everything, filter), [everything, filter]);
  const overlaps = useMemo(() => overlapNotes(everything), [everything]);
  const loose = ready ? looseOnWeek(planner, serbianSpan(days[0], days[6]), filter) : [];
  const pending = ready && (filter === 'all' || filter === 'prijava') ? planner.pending : [];
  const marks = useMemo(() => ready ? dayMarks(planner.placed, days, filter) : null, [ready, planner, days, filter]);
  const shades = useMemo(() => Object.fromEntries(days.map(date => [date,
    availability.state === 'ready' && date >= today ? dayAvailability(availability.value, date) : null])), [days, availability, today]);
  // What failed, for the chip that is on. A source that failed is said, and a day it could have filled is never called empty.
  const [wantsDogovori, wantsTasks, wantsApplications] = [filter === 'all' || filter === 'dogovor', filter === 'all' || filter === 'zadatak', filter === 'all' || filter === 'prijava'];
  const dogovoriFailed = wantsDogovori && list.state === 'error', dogovoriSilent = wantsDogovori && !!agreements && coverage === 'unknown';
  const tasksFailed = wantsTasks && needs.state === 'error', applicationsFailed = wantsApplications && applications.state === 'error';
  const loading = (wantsDogovori && list.state === 'loading') || (wantsTasks && needs.state === 'loading') || (wantsApplications && applications.state === 'loading');
  const empty = day.length === 0;
  // Only the schedule's work is shown while the Dogovori did not load (it can be retried) or came without saying whether they have
  // an exact time (retrying would not change that).
  const notes = !ready ? [] : [
    ...(dogovoriFailed || dogovoriSilent ? [empty ? 'Nema termina u kojima uskačeš.' : 'Učitani su samo termini u kojima uskačeš.'] : []),
    ...(tasksFailed ? ['Moji zadaci nisu učitani.'] : []), ...(applicationsFailed ? ['Moje prijave nisu učitane.'] : []),
  ];
  const notesView = notes.length ? <View style={s.partial}>
    <View style={s.partialLines}>{notes.map(text => <T key={text} variant="note" tone="muted">{text}</T>)}</View>
    {ready && (dogovoriFailed || tasksFailed || applicationsFailed) ? <V2Action label="Pokušaj ponovo" kind="quiet" compact onPress={onRetryList} /> : null}
  </View> : null;
  const openEntry = (entry: PlannerEntry) => {
    if (entry.kind === 'dogovor') onOpen(entry.id);
    else if (entry.kind === 'zadatak') onOpenTask?.(entry.id, entry.choosing);
    else onOpenApplication?.(entry.id);
  };
  const row = (entry: PlannerEntry) => <AgendaRow key={entry.key} entry={entry} day={selected} onOpen={openEntry} overlap={overlaps.get(entry.key) ?? null} zoneNote={zoneNote} />;
  let content: ReactNode;
  if (schedule.state === 'loading') content = <StateView kind="loading" title="Učitavamo raspored…" skeleton={{ count: 2, rows: 2 }} />;
  else if (schedule.state === 'error') content = <StateView kind="error" art="calendar" title="Raspored nije učitan."
    body={schedule.message ?? 'Proveri vezu pa pokušaj ponovo.'} primary={{ label: 'Pokušaj ponovo', onPress: onRetry, disabled: retrying }} />;
  // Never say a day is empty before every read it depends on has settled.
  else if (empty && loading) content = <StateView kind="loading" title="Učitavamo raspored…" skeleton={{ count: 1, rows: 2 }} />;
  else if (empty) content = notesView ?? <T variant="note" tone="muted">{EMPTY_DAY[filter]}</T>;
  else content = <View style={s.list}>{notesView}{day.map(row)}</View>;
  // The things under the day that have no exact time: the first few, and the rest on a press.
  const section = (key: 'loose' | 'pending', title: string, entries: readonly PlannerEntry[]) => {
    if (!entries.length) return null;
    const all = expanded[key];
    return <View key={key} style={s.section}>
      <GroupHeader title={title} count={countsText(entries)} first />
      <View style={s.list}>{(all ? entries : entries.slice(0, SECTION_LIMIT)).map(row)}</View>
      {entries.length > SECTION_LIMIT ? <View style={s.moreLine}>
        <V2Action label={all ? 'Prikaži manje' : `Prikaži još ${entries.length - SECTION_LIMIT}`} kind="quiet" compact
          onPress={() => setExpanded(current => ({ ...current, [key]: !current[key] }))} />
      </View> : null}
    </View>;
  };
  // The month shows the same marks as the week, for the month the planner has read; any other month is plain numbers.
  const marksFor = (target: string) => {
    const cells = monthCells(target).filter((cell): cell is string => cell !== null);
    return ready && cells.every(cell => inWindow(cell, reach)) ? dayMarks(planner.placed, cells, filter) : null;
  };
  const toToday = days.includes(today) ? null : <V2Action label="Danas" kind="quiet" compact onPress={() => onSelect(today)} />;
  return <>
    <Screen kind="detail" header={<DetailTopBar title="Raspored" onBack={onBack} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}>
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
          <WeekStrip days={days} selected={selected} today={today} now={now} marks={marks} shades={shades} onSelect={onSelect} />
        </View>
        {chips ? <View style={s.chips}>
          <Segmented value={filter} onChange={setFilter} options={PLANNER_FILTERS.map(({ key, label }) => ({ key, label }))} />
        </View> : null}
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
        {section('loose', 'Bez tačnog termina', loose)}
        {section('pending', 'Čekaju odgovor', pending)}
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
  chips: { marginTop: sys.space.md },
  // The day and the sections under it are separated by space, the screen's 24, and by nothing else.
  days: { gap: layout.section },
  heading: { gap: sys.space.xs },
  day: { marginTop: sys.space.sm },
  list: { gap: sys.space.md },
  partial: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm },
  partialLines: { flexShrink: 1, gap: sys.space.xs },
  section: { gap: sys.space.md },
  // The screen's 24 and 8 more: the quiet rows are a zone of their own, 32 from the last record.
  foot: { marginTop: sys.space.sm },
});
