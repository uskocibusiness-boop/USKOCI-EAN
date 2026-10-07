import type { MojaPrijavaProjekcija, NeedScheduleProjection, PotrebaProjekcija } from '../../contracts/projections';
import type { WorkerCalendarEvent } from '../../contracts/workerCalendar';
import { calendarInstant } from '../../lib/calendarTime';
import { dogovora, prijava, zadataka } from '../system/plural';
import type { StatusKey, StatusShape, StatusTone } from '../system/StatusChip';
import { ROLE_REQUESTER, ROLE_WORKER, agendaCoverage, agendaFacts, agendaItems, agendaRole, agreementsWithoutExactTerm,
  type AgendaAgreement, type AgendaItem, type AgendaState } from './agenda';
import { overlapsInterval } from './calendarPresentation';
import { instantMs, serbianDayRange } from './serbianDays';

/**
 * "Raspored" (owner, 2026-10-07): ONE planner over everything of mine that has a time. The Dogovori (both sides, from the
 * worker schedule and the Dogovori list, `agenda.ts`), my own published tasks, and my open applications are brought to one
 * shape here, `PlannerEntry`, so the week strip, the day, the sections under it and the overlap line all read one list.
 *
 * Nothing is invented. An entry is placed on a day only by exact instants the read gave (a Dogovor's accepted window, a task's
 * fixed window, an application's task window); a thing without them is listed in a section under its OWN words for its time
 * ("Fleksibilan raspon · …", "Termin nije potvrđen"), never parsed from a sentence and never put on a day. A task with one stored
 * bound keeps one bound, as Početna's "Raspored" does. Every day is a day of Serbian time (`serbianDays.ts`).
 *
 * Pure and dependency-light on purpose: no React and no native module, so the screens' pure helpers load in every suite.
 */

export type PlannerKind = 'dogovor' | 'zadatak' | 'prijava';
/** The chips under the week: "Sve · Dogovori · Moji zadaci · Moje prijave". */
export type PlannerFilter = 'all' | PlannerKind;
export const PLANNER_FILTERS: readonly { key: PlannerFilter; label: string }[] = [
  { key: 'all', label: 'Sve' }, { key: 'dogovor', label: 'Dogovori' }, { key: 'zadatak', label: 'Moji zadaci' }, { key: 'prijava', label: 'Moje prijave' },
];

/**
 * Where a thing stands, said by the shared chip (`ui/system/StatusChip`). A state the chip's table has a word for is its key; the
 * few that it has not ("Čeka potvrdu", "U užem izboru", "Zadatak je izmenjen", "Zatvoren", "Zatvorena") carry their own word with
 * the shape and the tone the chip would give them, and are drawn by the same marks.
 */
export type PlannerStatus =
  | Readonly<{ key: StatusKey; detail?: string }>
  | Readonly<{ word: string; shape: StatusShape; tone: StatusTone; detail?: string }>;

export const ROLE_APPLICANT = 'Tvoja prijava';
export const PROBLEM_NOTE = 'Prijavljen je problem u Dogovoru';
export const ATTENTION_NOTE = 'Prijava traži tvoju pažnju';
export const NO_TERM_WORD = 'Termin nije potvrđen';
export const TASK_FALLBACK_TITLE = 'Zadatak';
export const APPLICATION_FALLBACK_TITLE = 'Prijava';

export type PlannerEntry = Readonly<{
  key: string;
  kind: PlannerKind;
  /** What the row opens: the Dogovor's, the task's or the application's id. */
  id: string;
  /** A task: how many applications wait for a choice (the row then opens the candidates). */
  choosing: number;
  title: string | null;
  fallbackTitle: string;
  /**
   * The stored bounds. With `exact` they are the term itself (both for a window, one for a lone bound, as stored); without it
   * they are the flexible range the thing may happen in, or null when it names none.
   */
  startsAt: string | null;
  endsAt: string | null;
  /** The thing has an exact term, so it stands on a day. */
  exact: boolean;
  /** Its own words for its time, when it has no exact term to draw. */
  timeWord: string | null;
  status: PlannerStatus;
  /** Something waits for me here: the orange ring in the week. */
  waits: boolean;
  /** Over: drawn quiet, and a grey mark in the week. */
  done: boolean;
  /** A term of mine that can collide with another one: an active Dogovor or an application. */
  term: boolean;
  /** The term is work I do (a Dogovor where I "Uskačeš", an application): the one kind that cannot be in two places. */
  commitsMe: boolean;
  /** An orange line about it other than the overlap ("Prijavljen je problem u Dogovoru"). */
  note: string | null;
  role: string | null;
  person: string | null;
  amount: string | null;
  place: string;
}>;

const tidy = (value: unknown): string | null => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') || null : null;
/** The name a row goes by. */
export const entryTitle = (entry: Pick<PlannerEntry, 'title' | 'fallbackTitle'>): string => entry.title ?? entry.fallbackTitle;

/* ------------------------------------------------------------------------------------------------------------------ */
/* One entry from each kind of read                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * Where a Dogovor stands. "U toku" is the agreed time having arrived (owner decision d01): an agreed Dogovor whose window holds
 * `now`. A Dogovor waiting for the completion to be confirmed is "Čeka potvrdu", orange for the person who has to confirm it.
 */
function dogovorStatus(state: AgendaState, role: string | null, ratingDue: boolean, startsAt: string | null, endsAt: string | null, now: Date):
  { status: PlannerStatus; waits: boolean } {
  if (state === 'COMPLETED') return { status: ratingDue ? { key: 'task.completed', detail: 'oceni' } : { key: 'task.completed' }, waits: ratingDue };
  if (state === 'AWAITING_REQUESTER') {
    const mine = role === ROLE_REQUESTER;
    return { status: { word: 'Čeka potvrdu', shape: mine ? 'dot' : 'ring', tone: mine ? 'attention' : 'neutral' }, waits: mine };
  }
  const [from, to, at] = [instantMs(startsAt), instantMs(endsAt), now.getTime()];
  return { status: { key: from !== null && to !== null && from <= at && at < to ? 'task.now' : 'task.agreed' }, waits: false };
}

/** A Dogovor with an exact window, from the planner's Dogovor item. */
export function dogovorEntry(item: AgendaItem, now: Date = new Date()): PlannerEntry {
  const { status, waits } = dogovorStatus(item.state, item.role, item.ratingDue, item.startsAt, item.endsAt, now);
  const done = item.state === 'COMPLETED';
  return { key: item.key, kind: 'dogovor', id: item.agreementId, choosing: 0, title: item.title, fallbackTitle: item.fallbackTitle,
    startsAt: item.startsAt, endsAt: item.endsAt, exact: true, timeWord: null, status, waits: waits || item.problem, done, term: !done,
    commitsMe: item.role === ROLE_WORKER, note: item.problem ? PROBLEM_NOTE : null,
    role: item.role, person: item.person, amount: item.amount, place: item.place };
}

/** An active Dogovor that has no exact window: it stands in a section under its own words for the term. */
export function looseDogovorEntry(agreement: AgendaAgreement, now: Date = new Date()): PlannerEntry {
  const facts = agendaFacts(agreement), role = agendaRole(agreement);
  const { status, waits } = dogovorStatus(agreement.stanje as AgendaState, role, false, null, null, now);
  const problem = agreement.problemOtvoren === true;
  return { key: `loose:${agreement.id}`, kind: 'dogovor', id: agreement.id, choosing: 0, title: facts.title, fallbackTitle: 'Dogovor',
    startsAt: null, endsAt: null, exact: false, timeWord: tidy(agreement.vremeTekst) ?? NO_TERM_WORD, status, waits: waits || problem,
    done: false, term: true, commitsMe: role === ROLE_WORKER, note: problem ? PROBLEM_NOTE : null,
    role, person: facts.person, amount: facts.amount, place: facts.place };
}

/** The stored bounds of a schedule and whether they are an exact term (a fixed window, whole or with one bound as stored). */
function readBounds(schedule: NeedScheduleProjection | null | undefined): { startsAt: string | null; endsAt: string | null; exact: boolean } {
  const read = (value: string | null | undefined) => calendarInstant(value) !== null ? value as string : null;
  const [startsAt, endsAt] = [read(schedule?.startsAt), read(schedule?.endsAt)];
  if (startsAt !== null && endsAt !== null && calendarInstant(startsAt)! >= calendarInstant(endsAt)!) return { startsAt: null, endsAt: null, exact: false };
  return { startsAt, endsAt, exact: schedule?.kind === 'FIXED_WINDOW' && (startsAt !== null || endsAt !== null) };
}

const TASK_OPEN: readonly PotrebaProjekcija['stanje'][] = ['OBJAVLJENA', 'CEKA_PRIJAVE', 'DELIMICNO_POPUNJENA'];
/**
 * One of my own tasks that is still looking for people. A draft is private, a filled task is its Dogovori, and a closed one is
 * in the archive, so none of those is here (null). "Bira se · N" waits for me; a partly filled task says how far it is.
 */
export function taskEntry(row: PotrebaProjekcija): PlannerEntry | null {
  if (!TASK_OPEN.includes(row.stanje)) return null;
  const choosing = Math.max(0, row.brojPrijavaZaIzbor ?? 0);
  const status: PlannerStatus = choosing > 0 ? { key: 'task.choosing', detail: String(choosing) }
    : row.stanje === 'DELIMICNO_POPUNJENA' ? { key: 'task.published', detail: `${row.pokrivenost.popunjeno} od ${row.pokrivenost.ukupno}` }
      : { key: 'task.published' };
  const bounds = readBounds(row.schedule);
  return { key: `need:${row.id}`, kind: 'zadatak', id: row.id, choosing, title: tidy(row.naslov), fallbackTitle: TASK_FALLBACK_TITLE,
    ...bounds, timeWord: bounds.exact ? null : tidy(row.vremeTekst), status, waits: choosing > 0, done: false, term: false, commitsMe: false,
    note: null, role: ROLE_REQUESTER, person: null, amount: null, place: row.podrucjeTekst ?? '' };
}

const APPLICATION_OPEN: readonly MojaPrijavaProjekcija['stanje'][] = ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'STALE_REVIEW_REQUIRED'];
/**
 * One of my applications that has not been answered. Selected ones are Dogovori, withdrawn and closed ones are in the archive
 * (null). It is information, not an obligation, until it is chosen: it is a term only so that two of my terms can be seen to collide.
 */
export function applicationEntry(row: MojaPrijavaProjekcija): PlannerEntry | null {
  if (!APPLICATION_OPEN.includes(row.stanje)) return null;
  const stale = row.stanje === 'STALE_REVIEW_REQUIRED' || row.promenjenaPotreba;
  const status: PlannerStatus = stale ? { word: 'Zadatak je izmenjen', shape: 'dot', tone: 'attention' }
    : row.stanje === 'SHORTLISTED' ? { word: 'U užem izboru', shape: 'dot', tone: 'neutral' }
      : { key: row.stanje === 'VIEWED' ? 'application.seen' : 'application.sent' };
  const bounds = readBounds(row.zadatak?.raspored);
  return { key: `application:${row.prijavaId}`, kind: 'prijava', id: row.prijavaId, choosing: 0, title: tidy(row.naslov), fallbackTitle: APPLICATION_FALLBACK_TITLE,
    ...bounds, timeWord: bounds.exact ? null : tidy(row.vremeTekst), status, waits: stale || row.traziPaznju, done: false, term: true, commitsMe: true,
    note: !stale && row.traziPaznju ? ATTENTION_NOTE : null, role: ROLE_APPLICANT, person: null, amount: null, place: row.podrucjeTekst ?? '' };
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The planner: everything, placed or listed                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

export type Planner = Readonly<{
  /** Entries with an exact term that touches the window, in start order. They stand on days. */
  placed: readonly PlannerEntry[];
  /** Dogovori and tasks without an exact term: "Bez tačnog termina". */
  loose: readonly PlannerEntry[];
  /** My open applications that cannot be put on a day: "Čekaju odgovor". */
  pending: readonly PlannerEntry[];
}>;

/** The instant an entry is ordered by: its start, or its end when only that is stored. */
const startOf = (entry: PlannerEntry): bigint => calendarInstant(entry.startsAt ?? entry.endsAt) ?? 0n;

/** Whether an exact term touches the span [from, to). A lone start is a moment, a lone end is the moment the thing is over by. */
function touches(entry: Pick<PlannerEntry, 'startsAt' | 'endsAt'>, from: string, to: string): boolean {
  if (entry.startsAt !== null && entry.endsAt !== null) return overlapsInterval(entry.startsAt, entry.endsAt, from, to);
  const [moment, begin, end] = [calendarInstant(entry.startsAt ?? entry.endsAt), calendarInstant(from), calendarInstant(to)];
  if (moment === null || begin === null || end === null) return false;
  return entry.startsAt !== null ? moment >= begin && moment < end : moment > begin && moment <= end;
}
/** Whether a flexible range reaches into the span; a range with one bound is open on the other side, one with none is always. */
function reaches(entry: Pick<PlannerEntry, 'startsAt' | 'endsAt'>, from: string, to: string): boolean {
  const [start, end, begin, over] = [calendarInstant(entry.startsAt), calendarInstant(entry.endsAt), calendarInstant(from), calendarInstant(to)];
  if (begin === null || over === null) return false;
  return (start === null || start < over) && (end === null || end > begin);
}

/**
 * Everything of mine that has a time, as the window sees it. `from` and `to` are the instants of the window the schedule was read
 * for. The Dogovori are the planner's own (`agendaItems`: the worker schedule is the authority for the work I do), a task or an
 * application with an exact term overlapping the window is placed, and the rest is listed. The Dogovori without an exact term are
 * listed only when the list says enough to know which they are (`agendaCoverage`): nothing is listed that is not known.
 */
export function buildPlanner({ events, agreements, needs, applications, from, to, now = new Date() }: {
  events: readonly WorkerCalendarEvent[]; agreements: readonly AgendaAgreement[] | null;
  needs: readonly PotrebaProjekcija[] | null; applications: readonly MojaPrijavaProjekcija[] | null;
  from: string; to: string; now?: Date;
}): Planner {
  const placed: PlannerEntry[] = agendaItems({ events, agreements, from, to }).map(item => dogovorEntry(item, now));
  const loose: PlannerEntry[] = [];
  const pending: PlannerEntry[] = [];
  if (agreements && agendaCoverage(agreements, events) === 'full') {
    loose.push(...agreementsWithoutExactTerm(agreements, events).map(agreement => looseDogovorEntry(agreement, now)));
  }
  for (const entry of (needs ?? []).map(taskEntry)) {
    if (!entry) continue;
    if (!entry.exact) loose.push(entry);
    else if (touches(entry, from, to)) placed.push(entry);
  }
  for (const entry of (applications ?? []).map(applicationEntry)) {
    if (!entry) continue;
    if (!entry.exact) pending.push(entry);
    else if (touches(entry, from, to)) placed.push(entry);
  }
  // Stable: the Dogovori came in start order and title order, and what shares a start keeps the order it was given.
  placed.sort((a, b) => startOf(a) < startOf(b) ? -1 : startOf(a) > startOf(b) ? 1 : 0);
  return { placed, loose, pending };
}

export const filterEntries = (entries: readonly PlannerEntry[], filter: PlannerFilter): PlannerEntry[] =>
  filter === 'all' ? [...entries] : entries.filter(entry => entry.kind === filter);

/** Every entry that stands on a day of Serbian time, in start order. */
export function entriesOnDay(placed: readonly PlannerEntry[], day: string): PlannerEntry[] {
  const { from, to } = serbianDayRange(day);
  return placed.filter(entry => entry.exact && touches(entry, from, to));
}

/** The "Bez tačnog termina" list for the week being looked at: what has no range, or a range that reaches into the week. */
export function looseOnWeek(planner: Planner, week: { from: string; to: string }, filter: PlannerFilter): PlannerEntry[] {
  return filterEntries(planner.loose, filter).filter(entry => reaches(entry, week.from, week.to));
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The week strip                                                                                                       */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * The one mark of a day, by what matters most: something waits for me (an orange ring), a Dogovor is on it (a green dot), an open
 * task or application of mine is on it (a dashed outline), only finished work is on it (a grey dot).
 */
export type DayMarkKind = 'waiting' | 'active' | 'open' | 'finished';

export function markOf(entriesOfDay: readonly PlannerEntry[]): DayMarkKind | null {
  if (entriesOfDay.some(entry => entry.waits)) return 'waiting';
  if (entriesOfDay.some(entry => entry.kind === 'dogovor' && !entry.done)) return 'active';
  if (entriesOfDay.some(entry => !entry.done)) return 'open';
  return entriesOfDay.length ? 'finished' : null;
}

/** The mark of each of the given days; what the chip hides is not marked either, so the strip answers what the list will show. */
export function dayMarks(placed: readonly PlannerEntry[], days: readonly string[], filter: PlannerFilter): Record<string, DayMarkKind | null> {
  return Object.fromEntries(days.map(day => [day, markOf(filterEntries(entriesOnDay(placed, day), filter))]));
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The day                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * "Preklapa se sa {naslov}": for each entry of the day whose exact window overlaps another's, the line to draw under it. Two
 * terms collide only when one of them is work I do (a worker cannot be in two places; a person with two helpers coming at once
 * is not double-booked), neither is finished, and both have a whole window (a lone bound has no length to overlap with). With
 * several, the first is named and the rest counted: "Preklapa se sa A i još 2".
 */
export function overlapNotes(entriesOfDay: readonly PlannerEntry[]): ReadonlyMap<string, string> {
  const terms = entriesOfDay.filter(entry => entry.term && entry.startsAt !== null && entry.endsAt !== null);
  const notes = new Map<string, string>();
  for (const entry of terms) {
    const others = terms.filter(other => other !== entry && (entry.commitsMe || other.commitsMe)
      && overlapsInterval(entry.startsAt!, entry.endsAt!, other.startsAt!, other.endsAt!));
    if (others.length) notes.set(entry.key, `Preklapa se sa ${entryTitle(others[0])}${others.length > 1 ? ` i još ${others.length - 1}` : ''}`);
  }
  return notes;
}

/** What an empty day says, by the chip that is on. */
export const EMPTY_DAY: Readonly<Record<PlannerFilter, string>> = {
  all: 'Ništa nije zakazano za ovaj dan.', dogovor: 'Nema Dogovora za ovaj dan.',
  zadatak: 'Nema tvojih zadataka za ovaj dan.', prijava: 'Nema prijava za ovaj dan.',
};

/** How many of each kind: "1 Dogovor · 2 zadatka", each count with the plural its noun needs, and a kind with none left out. */
export function countsText(entries: readonly PlannerEntry[]): string {
  const of = (kind: PlannerKind) => entries.filter(entry => entry.kind === kind).length;
  const counts: [number, (count: number) => string][] = [[of('dogovor'), dogovora], [of('zadatak'), zadataka], [of('prijava'), prijava]];
  return counts.filter(([count]) => count > 0).map(([count, say]) => say(count)).join(' · ');
}
