import type { WorkerCalendarEvent } from '../../../contracts/workerCalendar';
import { agendaClock, agendaCoverage, agendaItems, agendaRole, agendaWindow, agreementsWithoutExactTerm, itemsOnDay, withinDay, withoutExactTerm,
  type AgendaAgreement } from '../agenda';

// Owner step 10 (critique A15): the calendar places the Dogovori of both sides. Jest runs in UTC and Serbian time is two hours
// ahead in September, and since 2026-10-07 a day is a day of SERBIAN time: the phone's own midnight has no say in it.
const from = '2026-09-21T00:00:00.000Z', to = '2026-09-28T00:00:00.000Z';
const event = (id: string, agreementId: string, version: number, startsAt: string, endsAt: string): WorkerCalendarEvent =>
  ({ eventId: id, agreementId, agreementVersion: version, startsAt, endsAt, agreementStatus: 'CONFIRMED', source: 'AGREEMENT' });
const agreement = (id: string, patch: Partial<AgendaAgreement> = {}): AgendaAgreement => ({
  id, verzija: 1, naslov: 'Pomoć oko krečenja stana', stanje: 'CONFIRMED', cena: { iznos: 4000, valuta: 'RSD', prikaz: '4.000 RSD' },
  vremeTekst: '', putanjaTekst: 'Liman, Novi Sad', pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 },
  ucesnici: [{ id: 'me', profilId: null, ime: 'Ti', inicijali: '', uloga: 'narucilac', mesta: null, viSte: true, telefon: null },
    { id: 'other', profilId: null, ime: 'Marko', inicijali: 'M', uloga: 'uskocer', mesta: 1, viSte: false, telefon: null }],
  rezim: 'FIZICKI', kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null,
  izmenaCeka: null, izvor: { zadatakId: null, prijavaId: null }, tacanTermin: null, ...patch,
} as AgendaAgreement);
const worker = (id: string, patch: Partial<AgendaAgreement> = {}) => agreement(id, { ucesnici: [
  { id: 'me', profilId: null, ime: 'Ti', inicijali: '', uloga: 'uskocer', mesta: 1, viSte: true, telefon: null },
  { id: 'other', profilId: null, ime: 'Ana', inicijali: 'A', uloga: 'narucilac', mesta: null, viSte: false, telefon: null }], ...patch });
const window = (pocetak: string, kraj: string) => ({ pocetak, kraj });

describe('agendaItems', () => {
  it('adds a Dogovor for my own task from its exact accepted window, as "Tvoj zadatak"', () => {
    const items = agendaItems({ events: [], agreements: [agreement('a1', { tacanTermin: window('2026-09-24T10:00:00Z', '2026-09-24T17:00:00Z') })], from, to });
    expect(items).toEqual([expect.objectContaining({ agreementId: 'a1', role: 'Tvoj zadatak', state: 'CONFIRMED', title: 'Pomoć oko krečenja stana',
      amount: '4.000 RSD', person: 'Marko', place: 'Liman, Novi Sad', startsAt: '2026-09-24T10:00:00Z' })]);
  });

  it('keeps a finished Dogovor, and never a cancelled one', () => {
    const items = agendaItems({ events: [], from, to, agreements: [
      agreement('done', { stanje: 'COMPLETED', tacanTermin: window('2026-09-24T10:00:00Z', '2026-09-24T17:00:00Z') }),
      agreement('gone', { stanje: 'CANCELLED', tacanTermin: window('2026-09-24T08:00:00Z', '2026-09-24T09:00:00Z') }),
    ] });
    expect(items.map(item => [item.agreementId, item.state])).toEqual([['done', 'COMPLETED']]);
  });

  it('never adds my own confirmed work from the list: the schedule is its one authority', () => {
    const items = agendaItems({ events: [], from, to, agreements: [
      worker('mine', { tacanTermin: window('2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z') }),
      worker('waiting', { stanje: 'AWAITING_REQUESTER', tacanTermin: window('2026-09-23T10:00:00Z', '2026-09-23T12:00:00Z') }),
    ] });
    expect(items.map(item => [item.agreementId, item.role, item.state])).toEqual([['waiting', 'Uskačeš', 'AWAITING_REQUESTER']]);
  });

  it('adds nothing twice when a Dogovor is already in the schedule, whatever the case of its id', () => {
    const items = agendaItems({ from, to, events: [event('e1', 'ABC-1', 1, '2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z')],
      agreements: [worker('abc-1', { stanje: 'AWAITING_REQUESTER', tacanTermin: window('2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z') })] });
    expect(items).toHaveLength(1); expect(items[0].key).toBe('event:e1');
  });

  it('takes a schedule row\'s facts only from the same Dogovor at the same version, still active', () => {
    const events = [event('e1', 'A-1', 2, '2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z')];
    const older = agendaItems({ events, from, to, agreements: [worker('a-1', { verzija: 1, naslov: 'Stari naslov' })] });
    expect(older[0]).toEqual(expect.objectContaining({ title: null, fallbackTitle: 'Potvrđen Dogovor', amount: null, person: null, role: 'Uskačeš' }));
    const same = agendaItems({ events, from, to, agreements: [worker('a-1', { verzija: 2, naslov: 'Selidba', cena: { iznos: 0, valuta: 'RSD', prikaz: '' } })] });
    expect(same[0]).toEqual(expect.objectContaining({ title: 'Selidba', amount: '', person: 'Ana' }));
    const unread = agendaItems({ events, from, to, agreements: null });
    expect(unread[0]).toEqual(expect.objectContaining({ title: null, amount: null }));
  });

  // Review of owner step 10: after I mark my work done the Dogovor waits for the requester, at the same version, and the
  // schedule keeps the event while the Dogovor is agreed. The row said only "Potvrđen Dogovor", untitled.
  it('says that my own work waits for the completion to be confirmed, from the list at the same version', () => {
    const events = [event('e1', 'a-1', 3, '2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z')];
    const waiting = agendaItems({ events, from, to, agreements: [worker('a-1', { verzija: 3, stanje: 'AWAITING_REQUESTER', naslov: 'Selidba' })] });
    expect(waiting).toEqual([expect.objectContaining({ key: 'event:e1', state: 'AWAITING_REQUESTER', title: 'Selidba', person: 'Ana', role: 'Uskačeš' })]);
    // Any other state, or another version, adds nothing to the schedule's row.
    for (const patch of [{ verzija: 3, stanje: 'COMPLETED' as const }, { verzija: 3, stanje: 'CANCELLED' as const }, { verzija: 2, stanje: 'AWAITING_REQUESTER' as const }]) {
      const [row] = agendaItems({ events, from, to, agreements: [worker('a-1', { naslov: 'Selidba', ...patch })] });
      expect(row).toEqual(expect.objectContaining({ state: 'CONFIRMED', title: null, amount: null, fallbackTitle: 'Potvrđen Dogovor' }));
    }
  });

  // Round-5c: an untitled waiting row said "Potvrđen Dogovor" beside "Čeka se potvrda završetka".
  it('does not call an untitled waiting row confirmed', () => {
    const events = [event('e1', 'a-1', 3, '2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z')];
    const [waiting] = agendaItems({ events, from, to, agreements: [worker('a-1', { verzija: 3, stanje: 'AWAITING_REQUESTER', naslov: '' })] });
    expect(waiting).toEqual(expect.objectContaining({ state: 'AWAITING_REQUESTER', title: null, fallbackTitle: 'Dogovor' }));
    const [confirmed] = agendaItems({ events, from, to, agreements: [worker('a-1', { verzija: 3, naslov: '' })] });
    expect(confirmed).toEqual(expect.objectContaining({ state: 'CONFIRMED', title: null, fallbackTitle: 'Potvrđen Dogovor' }));
  });

  it('leaves out a window outside the week and a Dogovor whose window the list did not give', () => {
    const items = agendaItems({ events: [], from, to, agreements: [
      agreement('later', { tacanTermin: window('2026-10-02T10:00:00Z', '2026-10-02T11:00:00Z') }),
      agreement('unsaid', { tacanTermin: undefined }),
    ] });
    expect(items).toEqual([]);
  });

  it('orders the week by start, then by title', () => {
    const items = agendaItems({ from, to, events: [event('e1', 'w', 1, '2026-09-24T12:00:00Z', '2026-09-24T13:00:00Z')], agreements: [
      agreement('b', { naslov: 'Beta', tacanTermin: window('2026-09-24T08:00:00Z', '2026-09-24T09:00:00Z') }),
      agreement('a', { naslov: 'Alfa', tacanTermin: window('2026-09-24T08:00:00Z', '2026-09-24T10:00:00Z') }),
    ] });
    expect(items.map(item => item.agreementId)).toEqual(['a', 'b', 'w']);
  });

  it('says "Na daljinu" for remote work instead of an area', () => {
    const [item] = agendaItems({ events: [], from, to, agreements: [agreement('r', { rezim: 'DALJINSKI', tacanTermin: window('2026-09-24T08:00:00Z', '2026-09-24T09:00:00Z') })] });
    expect(item.place).toBe('Na daljinu');
  });
});

describe('withoutExactTerm and coverage', () => {
  it('counts only active Dogovori known to have no exact window', () => {
    expect(withoutExactTerm([agreement('a', { tacanTermin: null }), agreement('b', { stanje: 'AWAITING_REQUESTER', tacanTermin: null }),
      agreement('c', { stanje: 'COMPLETED', tacanTermin: null }), agreement('d', { stanje: 'CANCELLED', tacanTermin: null }),
      agreement('e', { tacanTermin: undefined }), agreement('f', { tacanTermin: window('2026-09-24T08:00:00Z', '2026-09-24T09:00:00Z') })], [])).toBe(2);
  });
  it('is unknown while a Dogovor the calendar could place does not say whether it has a window', () => {
    expect(agendaCoverage([agreement('a', { tacanTermin: null })], [])).toBe('full');
    expect(agendaCoverage([agreement('a', { tacanTermin: undefined })], [])).toBe('unknown');
    // My own confirmed work is the schedule's; its silence in the list changes nothing.
    expect(agendaCoverage([worker('w', { tacanTermin: undefined })], [])).toBe('full');
    expect(agendaCoverage([agreement('x', { stanje: 'CANCELLED', tacanTermin: undefined })], [])).toBe('full');
  });
});

describe('the day', () => {
  const items = agendaItems({ from, to, events: [], agreements: [
    agreement('done', { stanje: 'COMPLETED', tacanTermin: window('2026-09-24T10:00:00Z', '2026-09-24T17:00:00Z') }),
    agreement('night', { tacanTermin: window('2026-09-25T20:00:00Z', '2026-09-26T04:00:00Z') }),
  ] });
  it('cuts the week into days of Serbian time', () => {
    expect(itemsOnDay(items, '2026-09-24').map(item => item.agreementId)).toEqual(['done']);
    expect(itemsOnDay(items, '2026-09-26').map(item => item.agreementId)).toEqual(['night']);
    expect(itemsOnDay(items, '2026-09-23')).toEqual([]);
  });
  it('writes the window in Serbian time: its clocks on its own day, its days otherwise', () => {
    expect(agendaWindow(items[0], '2026-09-24')).toBe('12:00–19:00');
    expect(withinDay(items[0], '2026-09-24')).toBe(true);
    expect(agendaWindow(items[1], '2026-09-25')).toMatch(/^25\. sep( 2026)? · 22:00 – 26\. sep( 2026)? · 06:00$/);
    expect(withinDay(items[1], '2026-09-25')).toBe(false);
  });
});

// ONE zone for days and hours (owner, 2026-10-07). Before it, the days were cut at the phone's midnight while the clocks were
// written in Serbian time, so a Dogovor at 00:30 Serbian time stood on the day before and said "00:30".
describe('one zone for the days and the hours', () => {
  const only = (agreementWindow: { pocetak: string; kraj: string }) => agendaItems({ from, to, events: [],
    agreements: [agreement('x', { tacanTermin: agreementWindow })] });
  it('puts a Dogovor on the day its Serbian clock says, the clock its row writes', () => {
    const items = only(window('2026-09-24T22:30:00Z', '2026-09-24T23:30:00Z'));
    expect(itemsOnDay(items, '2026-09-24')).toEqual([]);
    expect(itemsOnDay(items, '2026-09-25').map(item => item.agreementId)).toEqual(['x']);
    expect(agendaClock(items[0].startsAt)).toBe('00:30');
    expect(withinDay(items[0], '2026-09-25')).toBe(true);
    expect(withinDay(items[0], '2026-09-24')).toBe(false);
  });
  it('splits at Serbian midnight in winter, UTC+1, as well', () => {
    const winter = { from: '2026-12-06T00:00:00Z', to: '2026-12-14T00:00:00Z' };
    const items = agendaItems({ ...winter, events: [], agreements: [agreement('w', { tacanTermin: window('2026-12-10T23:00:00Z', '2026-12-10T23:30:00Z') })] });
    expect(itemsOnDay(items, '2026-12-10')).toEqual([]);
    expect(itemsOnDay(items, '2026-12-11').map(item => item.agreementId)).toEqual(['w']);
  });
  it('counts a window that ends exactly at Serbian midnight on the day it ends, not the next', () => {
    const items = only(window('2026-09-24T20:00:00Z', '2026-09-24T22:00:00Z'));
    expect(itemsOnDay(items, '2026-09-24').map(item => item.agreementId)).toEqual(['x']);
    expect(itemsOnDay(items, '2026-09-25')).toEqual([]);
  });
  it('keeps the 23-hour day of 2026-03-29 and the 25-hour day of 2026-10-25 whole', () => {
    const spring = { from: '2026-03-22T00:00:00Z', to: '2026-04-05T00:00:00Z' };
    const forward = agendaItems({ ...spring, events: [], agreements: [
      agreement('first', { tacanTermin: window('2026-03-28T23:00:00Z', '2026-03-28T23:30:00Z') }),
      agreement('last', { tacanTermin: window('2026-03-29T21:30:00Z', '2026-03-29T22:00:00Z') }),
      agreement('next', { tacanTermin: window('2026-03-29T22:00:00Z', '2026-03-29T22:30:00Z') })] });
    expect(itemsOnDay(forward, '2026-03-29').map(item => item.agreementId)).toEqual(['first', 'last']);
    expect(itemsOnDay(forward, '2026-03-30').map(item => item.agreementId)).toEqual(['next']);
    const autumn = { from: '2026-10-18T00:00:00Z', to: '2026-11-01T00:00:00Z' };
    const back = agendaItems({ ...autumn, events: [], agreements: [
      agreement('first', { tacanTermin: window('2026-10-24T22:00:00Z', '2026-10-24T22:30:00Z') }),
      agreement('repeat', { tacanTermin: window('2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z') }),
      agreement('last', { tacanTermin: window('2026-10-25T22:30:00Z', '2026-10-25T23:00:00Z') }),
      agreement('next', { tacanTermin: window('2026-10-25T23:00:00Z', '2026-10-25T23:30:00Z') })] });
    expect(itemsOnDay(back, '2026-10-25').map(item => item.agreementId)).toEqual(['first', 'repeat', 'last']);
    expect(itemsOnDay(back, '2026-10-26').map(item => item.agreementId)).toEqual(['next']);
  });
  it('writes a window that holds a clock change with both offsets, and one that does not with the clocks alone', () => {
    // 2026-03-29 02:00 CET becomes 03:00 CEST: 01:30 CET to 03:30 CEST is one hour of real time.
    const items = agendaItems({ from: '2026-03-22T00:00:00Z', to: '2026-04-05T00:00:00Z', events: [],
      agreements: [agreement('shift', { tacanTermin: window('2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z') })] });
    expect(agendaClock(items[0].startsAt)).toBe('01:30');
    expect(agendaClock(items[0].endsAt)).toBe('03:30');
    expect(agendaWindow(items[0], '2026-03-29')).toContain('UTC+01:00');
    expect(agendaWindow(items[0], '2026-03-29')).toContain('UTC+02:00');
  });
});

describe('the Dogovor items and the flags the planner reads', () => {
  it('say which finished Dogovor waits for my rating, and which active one has a problem open', () => {
    const items = agendaItems({ from, to, events: [], agreements: [
      agreement('rate', { stanje: 'COMPLETED', ocenaMoguca: true, tacanTermin: window('2026-09-22T10:00:00Z', '2026-09-22T11:00:00Z') }),
      agreement('rated', { stanje: 'COMPLETED', ocenaMoguca: false, tacanTermin: window('2026-09-22T12:00:00Z', '2026-09-22T13:00:00Z') }),
      agreement('trouble', { problemOtvoren: true, tacanTermin: window('2026-09-23T12:00:00Z', '2026-09-23T13:00:00Z') }),
      agreement('old trouble', { stanje: 'COMPLETED', problemOtvoren: true, tacanTermin: window('2026-09-23T14:00:00Z', '2026-09-23T15:00:00Z') }),
    ] });
    expect(items.map(item => [item.agreementId, item.ratingDue, item.problem])).toEqual([
      ['rate', true, false], ['rated', false, false], ['trouble', false, true], ['old trouble', false, false]]);
  });
  it('carry the problem of the Dogovor the schedule row stands for, at the same version', () => {
    const events = [event('e1', 'w', 1, '2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z')];
    expect(agendaItems({ events, from, to, agreements: [worker('w', { problemOtvoren: true })] })[0].problem).toBe(true);
    expect(agendaItems({ events, from, to, agreements: [worker('w', { verzija: 2, problemOtvoren: true })] })[0].problem).toBe(false);
    expect(agendaItems({ events, from, to, agreements: null })[0].problem).toBe(false);
  });
  it('name my side in the rows\' words', () => {
    expect(agendaRole(agreement('a'))).toBe('Tvoj zadatak');
    expect(agendaRole(worker('a'))).toBe('Uskačeš');
    expect(agendaRole(agreement('a', { ucesnici: [] }))).toBeNull();
  });
});

describe('the Dogovori without an exact term', () => {
  it('are listed in the order the list gave them, and counted by the same rule', () => {
    const list = [agreement('a', { tacanTermin: null }), agreement('b', { stanje: 'AWAITING_REQUESTER', tacanTermin: null }),
      agreement('c', { stanje: 'COMPLETED', tacanTermin: null }), agreement('d', { stanje: 'CANCELLED', tacanTermin: null }),
      agreement('e', { tacanTermin: undefined }), agreement('f', { tacanTermin: window('2026-09-24T08:00:00Z', '2026-09-24T09:00:00Z') })];
    expect(agreementsWithoutExactTerm(list, []).map(item => item.id)).toEqual(['a', 'b']);
    expect(withoutExactTerm(list, [])).toBe(2);
  });
  it('leave out the ones the schedule already places, whatever the case of the id', () => {
    const list = [worker('ABC-1', { tacanTermin: null }), agreement('b', { tacanTermin: null })];
    const events = [event('e', 'abc-1', 1, '2026-09-24T10:00:00Z', '2026-09-24T12:00:00Z')];
    expect(agreementsWithoutExactTerm(list, events).map(item => item.id)).toEqual(['b']);
  });
});
