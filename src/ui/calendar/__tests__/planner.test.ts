import type { DogovorProjekcija } from '../../../contracts/projections';
import { agendaItems } from '../agenda';
import { shiftDate } from '../calendarPresentation';
import {
  EMPTY_DAY, PROBLEM_NOTE, buildPlanner, dayMarks, dogovorEntry, entriesOnDay, entryTitle, looseDogovorEntry, markOf, overlapNotes,
  startOnlyDogovorEntry, termWord, type PlannerEntry,
} from '../planner';
import { plannerWindow, serbianDayRange } from '../serbianDays';
import { agreementOf as agreement, eventOf as event, NO_POSAO, windowOf as span, workerAgreementOf as asWorker } from './fixtures';

// Jest runs with TZ=UTC, so a day cut at the phone's midnight would differ from the Serbian one by two hours in summer.
const window = plannerWindow('2026-09-24');
const NOW = new Date('2026-09-24T08:00:00Z');

const planner = (input: Partial<Parameters<typeof buildPlanner>[0]> = {}) =>
  buildPlanner({ events: [], agreements: [], from: window.from, to: window.to, now: NOW, ...input });
const entry = (patch: Partial<PlannerEntry> = {}): PlannerEntry => ({
  key: 'e', id: 'e', title: 'Naslov', fallbackTitle: 'Dogovor', startsAt: '2026-09-24T08:00:00Z', endsAt: '2026-09-24T10:00:00Z',
  exact: true, timeWord: null, status: { key: 'task.agreed' }, waits: false, done: false, term: true, commitsMe: true, note: null, role: 'Uskačeš',
  person: null, amount: null, place: '', proposesTerm: false, ...patch,
});
const keys = (entries: readonly PlannerEntry[]) => entries.map(e => e.key);
/** A Dogovor with an accepted start and no accepted end, as the Dogovori list gives it. */
const started = (id: string, start: string, patch: Partial<DogovorProjekcija> = {}) =>
  agreement(id, { tacanTermin: null, prihvacenPocetak: start, vremeTekst: 'Od 24. sep · 14:00 · kraj nije potvrđen', ...patch });

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
    expect(dogovorEntry(mine[0], NOW)).toMatchObject({ commitsMe: true, role: 'Uskačeš', exact: true, id: 'w', proposesTerm: false });
  });
  it('without an exact window and without a start stands in the loose list under its own words, or under none', () => {
    expect(looseDogovorEntry(agreement('l', { vremeTekst: 'Do 12. okt · 10:00 · početak nije potvrđen' }), NOW))
      .toMatchObject({ exact: false, startsAt: null, endsAt: null, timeWord: 'Do 12. okt · 10:00 · početak nije potvrđen', term: true, id: 'l', key: 'loose:l' });
    // "Termin nije dogovoren" would only say what the heading over the section says.
    expect(looseDogovorEntry(agreement('l', { vremeTekst: 'Termin nije dogovoren' }), NOW).timeWord).toBeNull();
    expect(looseDogovorEntry(agreement('l', { vremeTekst: '   ' }), NOW).timeWord).toBeNull();
    expect(looseDogovorEntry(agreement('l', { problemOtvoren: true }), NOW)).toMatchObject({ waits: true, note: PROBLEM_NOTE });
  });
});

describe('a Dogovor with an accepted start and no end', () => {
  it('stands on the Serbian day of its start with the one bound it has, and is not listed as a Dogovor without a term', () => {
    const result = planner({ agreements: [started('s', '2026-09-24T12:00:00Z')] });
    expect(result.loose).toEqual([]);
    expect(entriesOnDay(result.placed, '2026-09-24')).toEqual([expect.objectContaining({
      key: 'agreement:s', id: 's', exact: true, startsAt: '2026-09-24T12:00:00Z', endsAt: null, timeWord: null, proposesTerm: false,
      term: true, done: false, commitsMe: false, role: 'Tvoj zadatak', status: { key: 'task.agreed' } })]);
    expect(keys(entriesOnDay(result.placed, '2026-09-25'))).toEqual([]);
  });
  it('is a moment: the last second of a Serbian day is that day\'s, midnight is the next one\'s', () => {
    const result = planner({ agreements: [started('in', '2026-09-24T21:59:59Z'), started('out', '2026-09-24T22:00:00Z')] });
    expect(keys(entriesOnDay(result.placed, '2026-09-24'))).toEqual(['agreement:in']);
    expect(keys(entriesOnDay(result.placed, '2026-09-25'))).toEqual(['agreement:out']);
  });
  it('is my work when I "Uskačeš", and waits for me when it is mine to confirm', () => {
    const mine = planner({ agreements: [started('w', '2026-09-24T12:00:00Z', { ucesnici: asWorker('x').ucesnici })] });
    expect(mine.placed[0]).toMatchObject({ commitsMe: true, role: 'Uskačeš' });
    const waiting = planner({ agreements: [started('c', '2026-09-24T12:00:00Z', { stanje: 'AWAITING_REQUESTER' })] });
    expect(waiting.placed[0]).toMatchObject({ waits: true, status: { word: 'Čeka potvrdu', tone: 'attention' } });
    expect(planner({ agreements: [started('p', '2026-09-24T12:00:00Z', { problemOtvoren: true })] }).placed[0]).toMatchObject({ waits: true, note: PROBLEM_NOTE });
  });
  it('is one bound and no length, so it never overlaps another term', () => {
    const result = planner({ agreements: [started('s', '2026-09-24T09:30:00Z'),
      agreement('d', { tacanTermin: span('2026-09-24T09:00:00Z', '2026-09-24T11:00:00Z') })] });
    expect(keys(entriesOnDay(result.placed, '2026-09-24'))).toEqual(['agreement:d', 'agreement:s']);
    expect(overlapNotes(entriesOnDay(result.placed, '2026-09-24')).size).toBe(0);
  });
  it('stays out of the planner when its start is outside the window read, or when the Dogovor is not active', () => {
    expect(keys(planner({ agreements: [started('far', '2026-12-10T12:00:00Z')] }).placed)).toEqual([]);
    expect(keys(planner({ agreements: [started('far', '2026-12-10T12:00:00Z')] }).loose)).toEqual([]);
    const over = planner({ agreements: [started('f', '2026-09-24T12:00:00Z', { stanje: 'COMPLETED' }), started('c', '2026-09-24T12:00:00Z', { stanje: 'CANCELLED' })] });
    expect([over.placed.length, over.loose.length]).toEqual([0, 0]);
  });
  it('is nothing to place when the read did not say, or says an unreadable start, or the Dogovor has a whole window', () => {
    expect(startOnlyDogovorEntry(agreement('a'), NOW)).toBeNull();
    expect(startOnlyDogovorEntry(agreement('a', { prihvacenPocetak: null }), NOW)).toBeNull();
    expect(startOnlyDogovorEntry(agreement('a', { prihvacenPocetak: 'sutra u podne' }), NOW)).toBeNull();
    expect(startOnlyDogovorEntry(agreement('a', { prihvacenPocetak: '2026-09-24T12:00:00Z', tacanTermin: span('2026-09-24T12:00:00Z', '2026-09-24T13:00:00Z') }), NOW)).toBeNull();
    // The one that is not placed is the loose one: a start the read did not say is not a start.
    expect(keys(planner({ agreements: [agreement('a', { prihvacenPocetak: 'sutra u podne' })] }).loose)).toEqual(['loose:a']);
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
    const result = buildPlanner({ events: [event('e1', 'w1', '2026-12-10T22:30:00Z', '2026-12-10T23:30:00Z')], agreements: [], from: w.from, to: w.to, now: NOW });
    expect(keys(entriesOnDay(result.placed, '2026-12-10'))).toEqual(['event:e1']);
    expect(keys(entriesOnDay(result.placed, '2026-12-11'))).toEqual(['event:e1']);
    const late = buildPlanner({ events: [event('e2', 'w2', '2026-12-10T23:00:00Z', '2026-12-10T23:30:00Z')], agreements: [], from: w.from, to: w.to, now: NOW });
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
      ], from: w.from, to: w.to, now: NOW });
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
    ], from: w.from, to: w.to, now: NOW });
    expect(keys(entriesOnDay(result.placed, '2026-10-25'))).toEqual(['agreement:repeat']);
    expect(keys(entriesOnDay(result.placed, '2026-10-26'))).toEqual(['agreement:after']);
  });
  it('orders a day by start, whatever read a Dogovor came from', () => {
    const result = planner({
      events: [event('e', 'w', '2026-09-24T07:00:00Z', '2026-09-24T08:00:00Z')],
      agreements: [agreement('d', { tacanTermin: span('2026-09-24T09:00:00Z', '2026-09-24T10:00:00Z') }), started('s', '2026-09-24T08:30:00Z')],
    });
    expect(keys(entriesOnDay(result.placed, '2026-09-24'))).toEqual(['event:e', 'agreement:s', 'agreement:d']);
  });
  it('leaves out what lies outside the window, and lists what has no accepted time instead of placing it', () => {
    const result = planner({
      agreements: [agreement('far', { tacanTermin: span('2026-12-10T09:00:00Z', '2026-12-10T10:00:00Z') }), agreement('loose', { tacanTermin: null, prihvacenPocetak: null })],
    });
    expect(keys(result.placed)).toEqual([]);
    expect(keys(result.loose)).toEqual(['loose:loose']);
  });
  it('lists the Dogovori without a term in the order the list gave them', () => {
    expect(keys(planner({ agreements: [agreement('b'), agreement('a'), agreement('c')] }).loose)).toEqual(['loose:b', 'loose:a', 'loose:c']);
  });
  it('does not list a Dogovor as loose that the schedule already places, or while the list is silent about its term', () => {
    const own = asWorker('mine', { tacanTermin: null });
    expect(keys(planner({ events: [event('e', 'mine', '2026-09-24T09:00:00Z', '2026-09-24T10:00:00Z')], agreements: [own] }).loose)).toEqual([]);
    expect(keys(planner({ agreements: [agreement('unsaid', { tacanTermin: undefined }), agreement('loose', { tacanTermin: null })] }).loose)).toEqual([]);
    expect(keys(planner({ agreements: null }).loose)).toEqual([]);
  });
  it('never lists a cancelled or finished Dogovor without a term', () => {
    const result = planner({ agreements: [agreement('c', { stanje: 'CANCELLED' }), agreement('f', { stanje: 'COMPLETED' })] });
    expect([result.placed, result.loose].map(list => list.length)).toEqual([0, 0]);
  });
});

describe('"Predloži termin", asked by the rule Početna asks it by', () => {
  const loose = (patch: Partial<DogovorProjekcija> = {}) => looseDogovorEntry(agreement('l', { prihvacenPocetak: null, ...patch }), NOW);
  it('is offered for an agreed Dogovor that has no accepted start, no window and no change waiting', () => {
    expect(loose().proposesTerm).toBe(true);
    // Whether it is mine or the other side's does not matter: either side may propose.
    expect(looseDogovorEntry(asWorker('l', { prihvacenPocetak: null }), NOW).proposesTerm).toBe(true);
  });
  it('is not offered while a change waits for an answer, while the Dogovor waits for a confirmation, or when the read did not say', () => {
    expect(loose({ izmenaCeka: { predlogId: 'p', mojPredlog: true } }).proposesTerm).toBe(false);
    expect(loose({ stanje: 'AWAITING_REQUESTER' }).proposesTerm).toBe(false);
    expect(looseDogovorEntry(agreement('l'), NOW).proposesTerm).toBe(false);
  });
  it('is never a command of a Dogovor that stands on a day', () => {
    expect(planner({ agreements: [started('s', '2026-09-24T12:00:00Z'), agreement('d', { tacanTermin: span('2026-09-24T09:00:00Z', '2026-09-24T10:00:00Z') })] })
      .placed.map(e => e.proposesTerm)).toEqual([false, false]);
  });
});

describe('the words a Dogovor without a term is listed by', () => {
  it('leave out what the heading over them already says', () => {
    for (const said of ['Termin nije dogovoren', 'Termin nije potvrđen', 'termin nije dogovoren.', '  Termin   nije dogovoren ', '', '   ', null, undefined, 7]) {
      expect([said, termWord(said)]).toEqual([said, null]);
    }
  });
  it('say "Fleksibilno" in the one word, however the task once said it', () => {
    expect(termWord('Fleksibilan termin')).toBe('Fleksibilno');
    expect(termWord('Fleksibilan raspon · 22. sep – 27. sep')).toBe('Fleksibilno · 22. sep – 27. sep');
    expect(termWord('Fleksibilno')).toBe('Fleksibilno');
    expect(termWord('fleksibilno · tokom sledeće nedelje')).toBe('Fleksibilno · tokom sledeće nedelje');
  });
  it('write a day without the zero a phone\'s own date pattern puts in front of it', () => {
    expect(termWord('Do 09. okt · 17:00 · početak nije potvrđen')).toBe('Do 9. okt · 17:00 · početak nije potvrđen');
    expect(termWord('Fleksibilan raspon · 05. okt – 09. okt')).toBe('Fleksibilno · 5. okt – 9. okt');
    expect(termWord('Do 12. okt · 10:00')).toBe('Do 12. okt · 10:00');
    expect(termWord('Do 10. okt · 10:00')).toBe('Do 10. okt · 10:00');
  });
  it('keep every other word as it came', () => {
    expect(termWord('Termin nije dostupan')).toBe('Termin nije dostupan');
    expect(termWord('Do 12. okt · 10:00 · početak nije potvrđen')).toBe('Do 12. okt · 10:00 · početak nije potvrđen');
  });
});

describe('the week strip\'s marks', () => {
  const on = (patch: Partial<PlannerEntry>) => [entry(patch)];
  it('is an orange dot when something waits for me, over everything else on the day', () => {
    expect(markOf([entry(), entry({ key: 'w', waits: true })])).toBe('waiting');
  });
  it('is a green dot for a Dogovor that is not over', () => {
    expect(markOf(on({}))).toBe('active');
  });
  it('is a grey dot for finished work alone, and nothing for an empty day', () => {
    expect(markOf(on({ done: true, term: false }))).toBe('finished');
    expect(markOf([entry({ done: true, term: false }), entry({ key: 'd' })])).toBe('active');
    expect(markOf([])).toBeNull();
  });
  it('marks the seven days, a Dogovor with only a start among them', () => {
    const days = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
    const result = planner({
      agreements: [agreement('g', { tacanTermin: span('2026-09-22T09:00:00Z', '2026-09-22T10:00:00Z') }),
        agreement('done', { stanje: 'COMPLETED', tacanTermin: span('2026-09-23T09:00:00Z', '2026-09-23T10:00:00Z') }),
        agreement('confirm', { stanje: 'AWAITING_REQUESTER', tacanTermin: span('2026-09-24T09:00:00Z', '2026-09-24T10:00:00Z') }),
        started('from', '2026-09-25T09:00:00Z'), agreement('none', { prihvacenPocetak: null })],
    });
    expect(dayMarks(result.placed, days)).toEqual({ '2026-09-21': null, '2026-09-22': 'active', '2026-09-23': 'finished', '2026-09-24': 'waiting',
      '2026-09-25': 'active', '2026-09-26': null, '2026-09-27': null });
  });
});

describe('two terms that overlap', () => {
  const at = (key: string, from: string, to: string, patch: Partial<PlannerEntry> = {}) =>
    entry({ key, title: `Naslov ${key}`, startsAt: `2026-09-24T${from}:00Z`, endsAt: `2026-09-24T${to}:00Z`, ...patch });
  it('each name the other when one of them is work I do', () => {
    const notes = overlapNotes([at('a', '08:00', '10:00'), at('b', '09:00', '11:00')]);
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
  it('leave out a finished Dogovor and a term with only one bound', () => {
    expect(overlapNotes([at('a', '08:00', '10:00'), at('d', '09:00', '11:00', { term: false, done: true })]).size).toBe(0);
    expect(overlapNotes([at('a', '08:00', '10:00'), at('l', '09:00', '11:00', { endsAt: null })]).size).toBe(0);
  });
  it('name a Dogovor without a title by its fallback name', () => {
    const notes = overlapNotes([at('a', '08:00', '10:00'), at('b', '09:00', '11:00', { title: null, fallbackTitle: 'Potvrđen Dogovor' })]);
    expect(notes.get('a')).toBe('Preklapa se sa Potvrđen Dogovor');
    expect(entryTitle(entry({ title: null, fallbackTitle: 'Dogovor' }))).toBe('Dogovor');
  });
});

describe('an empty day', () => {
  it('says so in one line, and never calls anything "posao"', () => {
    expect(EMPTY_DAY).toBe('Ništa nije zakazano za ovaj dan.');
    expect(EMPTY_DAY).not.toMatch(NO_POSAO);
  });
});
