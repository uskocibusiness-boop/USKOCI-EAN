import type { DogovorProjekcija } from '../../../contracts/projections';
import { agendaItems } from '../agenda';
import { shiftDate } from '../calendarPresentation';
import {
  ATTENTION_NOTE, EMPTY_DAY, NO_TERM_WORD, PROBLEM_NOTE, ROLE_APPLICANT, applicationEntry, buildPlanner, countsText, dayMarks, dogovorEntry,
  entriesOnDay, entryTitle, filterEntries, looseDogovorEntry, looseOnWeek, markOf, overlapNotes, taskEntry, type PlannerEntry,
} from '../planner';
import { plannerWindow, serbianDayRange } from '../serbianDays';
import { agreementOf as agreement, applicationOf as application, eventOf as event, fixedWindow as fixed, needOf as need, NO_POSAO, taskFacts, windowOf as span,
  workerAgreementOf as asWorker } from './fixtures';

// Jest runs with TZ=UTC, so a day cut at the phone's midnight would differ from the Serbian one by two hours in summer.
const window = plannerWindow('2026-09-24');
const NOW = new Date('2026-09-24T08:00:00Z');

const planner = (input: Partial<Parameters<typeof buildPlanner>[0]> = {}) =>
  buildPlanner({ events: [], agreements: [], needs: [], applications: [], from: window.from, to: window.to, now: NOW, ...input });
const entry = (patch: Partial<PlannerEntry> = {}): PlannerEntry => ({
  key: 'e', kind: 'dogovor', id: 'e', choosing: 0, title: 'Naslov', fallbackTitle: 'Dogovor', startsAt: '2026-09-24T08:00:00Z', endsAt: '2026-09-24T10:00:00Z',
  exact: true, timeWord: null, status: { key: 'task.agreed' }, waits: false, done: false, term: true, commitsMe: true, note: null, role: 'Uskačeš',
  person: null, amount: null, place: '', ...patch,
});
const keys = (entries: readonly PlannerEntry[]) => entries.map(e => e.key);

describe('a Dogovor and where it stands', () => {
  const item = (patch: Partial<DogovorProjekcija> = {}, at = NOW) => {
    const [first] = agendaItems({ events: [], agreements: [agreement('a', { tacanTermin: span('2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z'), ...patch })],
      from: window.from, to: window.to });
    return dogovorEntry(first, at);
  };
  it('is "Dogovoren" before its time and "U toku" while the time holds (the end is not inside)', () => {
    expect(item().status).toEqual({ key: 'task.agreed' });
    expect(item({}, new Date('2026-09-24T09:59:59Z')).status).toEqual({ key: 'task.agreed' });
    expect(item({}, new Date('2026-09-24T10:00:00Z')).status).toEqual({ key: 'task.now' });
    expect(item({}, new Date('2026-09-24T11:59:59Z')).status).toEqual({ key: 'task.now' });
    expect(item({}, new Date('2026-09-24T12:00:00Z')).status).toEqual({ key: 'task.agreed' });
  });
  it('waits for me when it is mine to confirm, and only then (orange for the requester, a quiet ring for the worker)', () => {
    expect(item({ stanje: 'AWAITING_REQUESTER' })).toMatchObject({ waits: true, status: { word: 'Čeka potvrdu', shape: 'dot', tone: 'attention' } });
    const mine = agendaItems({ events: [], from: window.from, to: window.to, agreements: [asWorker('w', { stanje: 'AWAITING_REQUESTER',
      tacanTermin: span('2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z') })] });
    expect(dogovorEntry(mine[0], NOW)).toMatchObject({ waits: false, status: { word: 'Čeka potvrdu', shape: 'ring', tone: 'neutral' } });
  });
  it('is "Završen", and "Završen · oceni" with an orange ring while my rating is due', () => {
    expect(item({ stanje: 'COMPLETED' })).toMatchObject({ done: true, term: false, waits: false, status: { key: 'task.completed' } });
    expect(item({ stanje: 'COMPLETED', ocenaMoguca: true })).toMatchObject({ done: true, waits: true, status: { key: 'task.completed', detail: 'oceni' } });
  });
  it('waits for me, and says why, while a problem is open on it', () => {
    expect(item({ problemOtvoren: true })).toMatchObject({ waits: true, note: PROBLEM_NOTE });
    expect(item({ stanje: 'COMPLETED', problemOtvoren: true })).toMatchObject({ waits: false, note: null });
  });
  it('is work I do only where I "Uskačeš"', () => {
    expect(item().commitsMe).toBe(false);
    const mine = agendaItems({ events: [event('e', 'w', '2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z')], agreements: null, from: window.from, to: window.to });
    expect(dogovorEntry(mine[0], NOW)).toMatchObject({ commitsMe: true, role: 'Uskačeš', exact: true, kind: 'dogovor', id: 'w' });
  });
  it('without an exact window stands in the loose list under its own words, or "Termin nije potvrđen"', () => {
    expect(looseDogovorEntry(agreement('l', { vremeTekst: '12. okt · 10:00 · kraj nije potvrđen' }), NOW))
      .toMatchObject({ exact: false, startsAt: null, endsAt: null, timeWord: '12. okt · 10:00 · kraj nije potvrđen', term: true, kind: 'dogovor', id: 'l' });
    expect(looseDogovorEntry(agreement('l', { vremeTekst: '   ' }), NOW).timeWord).toBe(NO_TERM_WORD);
    expect(looseDogovorEntry(agreement('l', { problemOtvoren: true }), NOW)).toMatchObject({ waits: true, note: PROBLEM_NOTE });
  });
});

describe('my own task', () => {
  it('stands on the day of its fixed window, "Objavljen" while nobody has applied', () => {
    expect(taskEntry(need('n1'))).toMatchObject({ kind: 'zadatak', id: 'n1', exact: true, status: { key: 'task.published' }, waits: false,
      startsAt: '2026-09-24T08:00:00Z', endsAt: '2026-09-24T10:00:00Z', role: 'Tvoj zadatak', term: false, commitsMe: false });
  });
  it('is "Bira se · N" and waits for me while applications wait for a choice', () => {
    expect(taskEntry(need('n2', { stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 3 }))).toMatchObject({ status: { key: 'task.choosing', detail: '3' }, waits: true, choosing: 3 });
  });
  it('says how far a partly filled task is, and still asks for the choice when applications wait', () => {
    const partly = { stanje: 'DELIMICNO_POPUNJENA' as const, pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } };
    expect(taskEntry(need('n3', partly))).toMatchObject({ status: { key: 'task.published', detail: '1 od 2' }, waits: false });
    expect(taskEntry(need('n3', { ...partly, brojPrijavaZaIzbor: 2 }))).toMatchObject({ status: { key: 'task.choosing', detail: '2' }, waits: true });
  });
  it('is not the planner\'s while it is a draft, filled (its Dogovori are) or closed (the archive has it)', () => {
    for (const stanje of ['NACRT', 'POPUNJENA', 'ZATVORENA'] as const) expect([stanje, taskEntry(need('n', { stanje }))]).toEqual([stanje, null]);
  });
  it('keeps one stored bound as one bound, and never invents the other', () => {
    expect(taskEntry(need('s', { schedule: fixed('2026-09-24T12:00:00Z', null) }))).toMatchObject({ exact: true, startsAt: '2026-09-24T12:00:00Z', endsAt: null });
    expect(taskEntry(need('e', { schedule: fixed(null, '2026-09-24T12:00:00Z') }))).toMatchObject({ exact: true, startsAt: null, endsAt: '2026-09-24T12:00:00Z' });
  });
  it('has no term of its own when it is flexible, is missing its schedule, or its bounds are the wrong way round', () => {
    const flexible = taskEntry(need('f', { schedule: { kind: 'WEEK_FLEXIBLE', startsAt: '2026-09-21T22:00:00Z', endsAt: '2026-09-27T22:00:00Z' },
      vremeTekst: 'Fleksibilan raspon · 22. sep – 27. sep' }));
    expect(flexible).toMatchObject({ exact: false, timeWord: 'Fleksibilan raspon · 22. sep – 27. sep', startsAt: '2026-09-21T22:00:00Z' });
    expect(taskEntry(need('m', { schedule: undefined, vremeTekst: 'Po dogovoru' }))).toMatchObject({ exact: false, timeWord: 'Po dogovoru', startsAt: null, endsAt: null });
    expect(taskEntry(need('r', { schedule: fixed('2026-09-24T12:00:00Z', '2026-09-24T10:00:00Z') }))).toMatchObject({ exact: false, startsAt: null, endsAt: null });
  });
});

describe('my application', () => {
  it('says "Prijava poslata" (a ring: it waits for someone else) and "Prijava viđena", so the row needs no mark of its own', () => {
    expect(applicationEntry(application('a1'))).toMatchObject({ kind: 'prijava', id: 'a1', status: { word: 'Prijava poslata', shape: 'ring', tone: 'neutral' },
      role: ROLE_APPLICANT, term: true, commitsMe: true, waits: false, exact: false, timeWord: 'Fleksibilno' });
    expect(applicationEntry(application('a2', { stanje: 'VIEWED' }))?.status).toEqual({ word: 'Prijava viđena', shape: 'dot', tone: 'neutral' });
  });
  it('says "U užem izboru", and "Zadatak je izmenjen" in orange while my review is needed', () => {
    expect(applicationEntry(application('a3', { stanje: 'SHORTLISTED' }))?.status).toEqual({ word: 'U užem izboru', shape: 'dot', tone: 'neutral' });
    for (const patch of [{ stanje: 'STALE_REVIEW_REQUIRED' as const }, { promenjenaPotreba: true }]) {
      expect(applicationEntry(application('a4', patch))).toMatchObject({ waits: true, status: { word: 'Zadatak je izmenjen', shape: 'dot', tone: 'attention' }, note: null });
    }
  });
  it('waits for me, and says so, when the server asks for my attention', () => {
    expect(applicationEntry(application('a5', { traziPaznju: true }))).toMatchObject({ waits: true, note: ATTENTION_NOTE });
  });
  it('is not the planner\'s once it is chosen (a Dogovor), withdrawn or closed (the archive)', () => {
    for (const stanje of ['SELECTED', 'WITHDRAWN', 'CLOSED'] as const) expect([stanje, applicationEntry(application('a', { stanje }))]).toEqual([stanje, null]);
  });
  it('stands on a day only when the read carried the task\'s exact window', () => {
    const withFacts = application('a6', { zadatak: taskFacts(fixed('2026-09-24T08:00:00Z', '2026-09-24T10:00:00Z')) });
    expect(applicationEntry(withFacts)).toMatchObject({ exact: true, startsAt: '2026-09-24T08:00:00Z', timeWord: null });
  });
});

describe('the planner places by exact instants in Serbian time', () => {
  it('puts a Dogovor on the Serbian day it falls on, not on the phone\'s', () => {
    // 22:30Z on the 24th is 00:30 on the 25th in Serbia; at the phone's (UTC) midnight it would still be the 24th.
    const result = planner({ events: [event('e1', 'w1', '2026-09-24T22:30:00Z', '2026-09-24T23:30:00Z')] });
    expect(keys(entriesOnDay(result.placed, '2026-09-24'))).toEqual([]);
    expect(keys(entriesOnDay(result.placed, '2026-09-25'))).toEqual(['event:e1']);
  });
  it('puts a window that crosses Serbian midnight on both days', () => {
    const result = planner({ events: [event('e1', 'w1', '2026-09-24T21:30:00Z', '2026-09-24T22:30:00Z')] });
    expect(keys(entriesOnDay(result.placed, '2026-09-24'))).toEqual(['event:e1']);
    expect(keys(entriesOnDay(result.placed, '2026-09-25'))).toEqual(['event:e1']);
  });
  it('splits at the winter midnight (UTC+1) as well', () => {
    const w = plannerWindow('2026-12-10');
    const result = buildPlanner({ events: [event('e1', 'w1', '2026-12-10T22:30:00Z', '2026-12-10T23:30:00Z')], agreements: [], needs: [], applications: [],
      from: w.from, to: w.to, now: NOW });
    expect(keys(entriesOnDay(result.placed, '2026-12-10'))).toEqual(['event:e1']);
    expect(keys(entriesOnDay(result.placed, '2026-12-11'))).toEqual(['event:e1']);
    const late = buildPlanner({ events: [event('e2', 'w2', '2026-12-10T23:00:00Z', '2026-12-10T23:30:00Z')], agreements: [], needs: [], applications: [],
      from: w.from, to: w.to, now: NOW });
    expect(keys(entriesOnDay(late.placed, '2026-12-10'))).toEqual([]);
    expect(keys(entriesOnDay(late.placed, '2026-12-11'))).toEqual(['event:e2']);
  });
  it('keeps the first and the last minute of 2026-03-29 (23 hours) and of 2026-10-25 (25 hours) on their own day', () => {
    for (const day of ['2026-03-29', '2026-10-25']) {
      const { from, to } = serbianDayRange(day);
      const w = plannerWindow(day);
      const result = buildPlanner({ events: [], agreements: [
        agreement('first', { tacanTermin: span(from, new Date(Date.parse(from) + 60_000).toISOString()) }),
        agreement('last', { tacanTermin: span(new Date(Date.parse(to) - 60_000).toISOString(), to) }),
      ], needs: [], applications: [], from: w.from, to: w.to, now: NOW });
      expect([day, keys(entriesOnDay(result.placed, day))]).toEqual([day, ['agreement:first', 'agreement:last']]);
      // The neighbours start where this day ends and end where it starts: nothing is counted twice or lost.
      expect([day, keys(entriesOnDay(result.placed, shiftDate(day, -1)))]).toEqual([day, []]);
      expect([day, keys(entriesOnDay(result.placed, shiftDate(day, 1)))]).toEqual([day, []]);
    }
  });
  it('puts the first minute of the repeated hour of 2026-10-25 on the 25th, and the minute after the day on the 26th', () => {
    const w = plannerWindow('2026-10-25');
    const result = buildPlanner({ events: [], agreements: [
      agreement('repeat', { tacanTermin: span('2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z') }),
      agreement('after', { tacanTermin: span('2026-10-25T23:00:00Z', '2026-10-25T23:30:00Z') }),
    ], needs: [], applications: [], from: w.from, to: w.to, now: NOW });
    expect(keys(entriesOnDay(result.placed, '2026-10-25'))).toEqual(['agreement:repeat']);
    expect(keys(entriesOnDay(result.placed, '2026-10-26'))).toEqual(['agreement:after']);
  });
  it('places a lone start on its day and a lone end on the day it is over by (an end at midnight belongs to the day before)', () => {
    const result = planner({ needs: [
      need('start-in', { schedule: fixed('2026-09-24T21:59:59Z', null) }), need('start-out', { schedule: fixed('2026-09-24T22:00:00Z', null) }),
      need('end-in', { schedule: fixed(null, '2026-09-24T22:00:00Z') }), need('end-out', { schedule: fixed(null, '2026-09-24T22:00:01Z') }),
    ] });
    expect(keys(entriesOnDay(result.placed, '2026-09-24')).sort()).toEqual(['need:end-in', 'need:start-in']);
    expect(keys(entriesOnDay(result.placed, '2026-09-25')).sort()).toEqual(['need:end-out', 'need:start-out']);
  });
  it('orders a day by start, my tasks and applications among the Dogovori', () => {
    const result = planner({
      agreements: [agreement('d', { tacanTermin: span('2026-09-24T09:00:00Z', '2026-09-24T10:00:00Z') })],
      needs: [need('n', { schedule: fixed('2026-09-24T07:00:00Z', '2026-09-24T08:00:00Z') })],
      applications: [application('a', { zadatak: taskFacts(fixed('2026-09-24T08:30:00Z', '2026-09-24T09:30:00Z')) })],
    });
    expect(keys(entriesOnDay(result.placed, '2026-09-24'))).toEqual(['need:n', 'application:a', 'agreement:d']);
  });
  it('leaves out what lies outside the window, and lists what has no exact term instead of placing it', () => {
    const result = planner({
      agreements: [agreement('far', { tacanTermin: span('2026-12-10T09:00:00Z', '2026-12-10T10:00:00Z') }), agreement('loose', { tacanTermin: null })],
      needs: [need('far-task', { schedule: fixed('2026-12-10T09:00:00Z', '2026-12-10T10:00:00Z') }), need('flex', { schedule: { kind: 'FLEXIBLE', startsAt: null, endsAt: null } })],
      applications: [application('text-only')],
    });
    expect(keys(result.placed)).toEqual([]);
    expect(keys(result.loose)).toEqual(['loose:loose', 'need:flex']);
    expect(keys(result.pending)).toEqual(['application:text-only']);
  });
  it('does not list a Dogovor as loose that the schedule already places, or while the list is silent about its term', () => {
    const own = asWorker('mine', { tacanTermin: null });
    expect(keys(planner({ events: [event('e', 'mine', '2026-09-24T09:00:00Z', '2026-09-24T10:00:00Z')], agreements: [own] }).loose)).toEqual([]);
    expect(keys(planner({ agreements: [agreement('unsaid', { tacanTermin: undefined }), agreement('loose', { tacanTermin: null })] }).loose)).toEqual([]);
    expect(keys(planner({ agreements: null }).loose)).toEqual([]);
  });
  it('never lists a cancelled or finished Dogovor without a term, or a draft, filled or closed task, or an answered application', () => {
    const result = planner({
      agreements: [agreement('c', { stanje: 'CANCELLED' }), agreement('f', { stanje: 'COMPLETED' })],
      needs: [need('d', { stanje: 'NACRT' }), need('p', { stanje: 'POPUNJENA' }), need('z', { stanje: 'ZATVORENA' })],
      applications: [application('s', { stanje: 'SELECTED' }), application('w', { stanje: 'WITHDRAWN' }), application('c', { stanje: 'CLOSED' })],
    });
    expect([result.placed, result.loose, result.pending].map(list => list.length)).toEqual([0, 0, 0]);
  });
});

describe('the "Bez tačnog termina" list of a week', () => {
  const week = { from: serbianDayRange('2026-09-21').from, to: serbianDayRange('2026-09-27').to };
  const built = planner({
    agreements: [agreement('d', { tacanTermin: null })],
    needs: [
      need('this', { schedule: { kind: 'WEEK_FLEXIBLE', startsAt: '2026-09-20T22:00:00Z', endsAt: '2026-09-27T22:00:00Z' } }),
      need('next', { schedule: { kind: 'WEEK_FLEXIBLE', startsAt: '2026-09-27T22:00:00Z', endsAt: '2026-10-04T22:00:00Z' } }),
      need('open-end', { schedule: { kind: 'FLEXIBLE', startsAt: '2026-09-23T22:00:00Z', endsAt: null } }),
      need('open-start', { schedule: { kind: 'FLEXIBLE', startsAt: null, endsAt: '2026-09-20T22:00:00Z' } }),
      need('anytime', { schedule: { kind: 'REMOTE_ANYTIME', startsAt: null, endsAt: null } }),
    ],
  });
  it('holds what has no range and what reaches into the week, and not a range of another week', () => {
    expect(keys(looseOnWeek(built, week, 'all'))).toEqual(['loose:d', 'need:this', 'need:open-end', 'need:anytime']);
  });
  it('follows the chip', () => {
    expect(keys(looseOnWeek(built, week, 'dogovor'))).toEqual(['loose:d']);
    expect(keys(looseOnWeek(built, week, 'zadatak'))).toEqual(['need:this', 'need:open-end', 'need:anytime']);
    expect(looseOnWeek(built, week, 'prijava')).toEqual([]);
  });
});

describe('the week strip\'s marks', () => {
  const on = (patch: Partial<PlannerEntry>) => [entry(patch)];
  it('is an orange ring when something waits for me, over everything else on the day', () => {
    expect(markOf([entry(), entry({ key: 'w', waits: true, kind: 'zadatak' })])).toBe('waiting');
  });
  it('is a green dot for a Dogovor that is not over', () => {
    expect(markOf(on({ kind: 'dogovor' }))).toBe('active');
  });
  it('is a dashed outline for my open task or application alone', () => {
    expect(markOf(on({ kind: 'prijava' }))).toBe('open');
    expect(markOf(on({ kind: 'zadatak', term: false }))).toBe('open');
    expect(markOf([entry({ kind: 'prijava' }), entry({ key: 'd', kind: 'dogovor' })])).toBe('active');
  });
  it('is a grey dot for finished work alone, and nothing for an empty day', () => {
    expect(markOf(on({ done: true, term: false }))).toBe('finished');
    expect(markOf([])).toBeNull();
  });
  it('marks the seven days by the chip that is on', () => {
    const days = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
    const result = planner({
      agreements: [agreement('g', { tacanTermin: span('2026-09-22T09:00:00Z', '2026-09-22T10:00:00Z') }),
        agreement('done', { stanje: 'COMPLETED', tacanTermin: span('2026-09-23T09:00:00Z', '2026-09-23T10:00:00Z') })],
      needs: [need('choose', { stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 2, schedule: fixed('2026-09-24T09:00:00Z', '2026-09-24T10:00:00Z') })],
      applications: [application('mine', { zadatak: taskFacts(fixed('2026-09-25T09:00:00Z', '2026-09-25T10:00:00Z')) })],
    });
    expect(dayMarks(result.placed, days, 'all')).toEqual({ '2026-09-21': null, '2026-09-22': 'active', '2026-09-23': 'finished', '2026-09-24': 'waiting',
      '2026-09-25': 'open', '2026-09-26': null, '2026-09-27': null });
    expect(dayMarks(result.placed, days, 'dogovor')).toMatchObject({ '2026-09-22': 'active', '2026-09-23': 'finished', '2026-09-24': null, '2026-09-25': null });
    expect(dayMarks(result.placed, days, 'prijava')).toMatchObject({ '2026-09-22': null, '2026-09-25': 'open' });
  });
});

describe('two terms that overlap', () => {
  const at = (key: string, from: string, to: string, patch: Partial<PlannerEntry> = {}) =>
    entry({ key, title: `Naslov ${key}`, startsAt: `2026-09-24T${from}:00Z`, endsAt: `2026-09-24T${to}:00Z`, ...patch });
  it('each name the other when one of them is work I do', () => {
    const notes = overlapNotes([at('a', '08:00', '10:00'), at('b', '09:00', '11:00', { kind: 'prijava' })]);
    expect(notes.get('a')).toBe('Preklapa se sa Naslov b');
    expect(notes.get('b')).toBe('Preklapa se sa Naslov a');
  });
  it('do not overlap where one ends as the other starts', () => {
    expect(overlapNotes([at('a', '08:00', '10:00'), at('b', '10:00', '11:00')]).size).toBe(0);
  });
  it('are not a collision when neither is work I do (two helpers coming to my tasks at once)', () => {
    expect(overlapNotes([at('a', '08:00', '10:00', { commitsMe: false }), at('b', '09:00', '11:00', { commitsMe: false })]).size).toBe(0);
    // But my own task\'s helper and my own work in the same hours are one person in two places.
    expect(overlapNotes([at('a', '08:00', '10:00', { commitsMe: false }), at('b', '09:00', '11:00')]).size).toBe(2);
  });
  it('count the rest after naming the first', () => {
    const notes = overlapNotes([at('a', '08:00', '12:00'), at('b', '09:00', '10:00'), at('c', '10:00', '11:00'), at('d', '11:00', '12:00')]);
    expect(notes.get('a')).toBe('Preklapa se sa Naslov b i još 2');
    expect(notes.get('b')).toBe('Preklapa se sa Naslov a');
  });
  it('leave out a task, a finished Dogovor and a term with only one bound', () => {
    expect(overlapNotes([at('a', '08:00', '10:00'), at('t', '09:00', '11:00', { term: false, kind: 'zadatak' })]).size).toBe(0);
    expect(overlapNotes([at('a', '08:00', '10:00'), at('d', '09:00', '11:00', { term: false, done: true })]).size).toBe(0);
    expect(overlapNotes([at('a', '08:00', '10:00'), at('l', '09:00', '11:00', { endsAt: null })]).size).toBe(0);
  });
  it('name a Dogovor without a title by its fallback name', () => {
    const notes = overlapNotes([at('a', '08:00', '10:00'), at('b', '09:00', '11:00', { title: null, fallbackTitle: 'Potvrđen Dogovor' })]);
    expect(notes.get('a')).toBe('Preklapa se sa Potvrđen Dogovor');
    expect(entryTitle(entry({ title: null, fallbackTitle: 'Dogovor' }))).toBe('Dogovor');
  });
});

describe('the chips and the words under them', () => {
  it('filter the entries by kind, and "Sve" keeps all', () => {
    const all = [entry({ key: 'd', kind: 'dogovor' }), entry({ key: 'z', kind: 'zadatak' }), entry({ key: 'p', kind: 'prijava' })];
    expect(keys(filterEntries(all, 'all'))).toEqual(['d', 'z', 'p']);
    expect(keys(filterEntries(all, 'dogovor'))).toEqual(['d']);
    expect(keys(filterEntries(all, 'zadatak'))).toEqual(['z']);
    expect(keys(filterEntries(all, 'prijava'))).toEqual(['p']);
  });
  it('count each kind with the plural its noun needs', () => {
    const many = (kind: PlannerEntry['kind'], count: number) => Array.from({ length: count }, (_, index) => entry({ key: `${kind}${index}`, kind }));
    expect(countsText([...many('dogovor', 1), ...many('zadatak', 2), ...many('prijava', 5)])).toBe('1 Dogovor · 2 zadatka · 5 prijava');
    expect(countsText(many('dogovor', 2))).toBe('2 Dogovora');
    expect(countsText(many('dogovor', 11))).toBe('11 Dogovora');
    expect(countsText(many('dogovor', 21))).toBe('21 Dogovor');
    expect(countsText(many('zadatak', 3))).toBe('3 zadatka');
    expect(countsText(many('zadatak', 12))).toBe('12 zadataka');
    expect(countsText(many('zadatak', 22))).toBe('22 zadatka');
    expect(countsText(many('prijava', 1))).toBe('1 prijava');
    expect(countsText(many('prijava', 4))).toBe('4 prijave');
    expect(countsText(many('prijava', 14))).toBe('14 prijava');
    expect(countsText([])).toBe('');
  });
  it('say an empty day in the words of the chip, never "posao"', () => {
    expect(Object.keys(EMPTY_DAY).sort()).toEqual(['all', 'dogovor', 'prijava', 'zadatak']);
    expect(new Set(Object.values(EMPTY_DAY)).size).toBe(4);
    for (const text of Object.values(EMPTY_DAY)) expect(text).not.toMatch(NO_POSAO);
  });
});
