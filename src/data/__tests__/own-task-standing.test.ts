import type { PotrebaProjekcija } from '../../contracts/projections';
import { STATUS_CHIPS } from '../../ui/system/StatusChip';
import * as standingModule from '../ownTaskStanding';
import { NO_APPLICATIONS, NOTHING_TO_CHOOSE, noApplicationsLine, ownTaskStanding } from '../ownTaskStanding';

/**
 * Where one of MY tasks stands, in the owner's eight words (2026-10-07), and the one line of data under them. Pure, so the list, the tests and a
 * later Arhiva agree on what a task is called; and honest, so a word the read cannot support is simply not said. Since the owner's phone of 8 Oct
 * 2026 the line is data and never an explanation: it says "Još nema prijava" or "3 prijave", and what the chip already says is not said again.
 */
const NOW = new Date('2026-10-07T12:00:00Z');
const task = (patch: Partial<PotrebaProjekcija> & { kraj?: string } = {}): PotrebaProjekcija => ({ id: 't1', revizija: 1, naslov: 'Krečenje zida', opis: '', stanje: 'OBJAVLJENA',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: 'Sutra, fleksibilno', podrucjeTekst: 'Novi Sad', uslovi: [], brojPrijava: 0, brojPrijavaZaIzbor: 0,
  ...patch } as PotrebaProjekcija);
const stands = (patch: Parameters<typeof task>[0] = {}) => ownTaskStanding(task(patch), NOW);
const word = (patch: Parameters<typeof task>[0]) => { const chip = stands(patch).chip; return chip ? STATUS_CHIPS[chip.status].word + (chip.detail ? ` · ${chip.detail}` : '') : null; };

describe('no sentence tells the owner where the applications can be seen', () => {
  it('the promise that said "Vidiš ih ovde i u zvoncu" is gone from the module, and with it the switch that would have turned it into "Javićemo ti"', () => {
    for (const gone of ['APPLICATION_PROMISE', 'applicationPromise', 'PUSH_SENDING_ON', 'applicationsWaitSentence']) expect(standingModule).not.toHaveProperty(gone);
    for (const patch of [{ stanje: 'OBJAVLJENA' as const }, { stanje: 'CEKA_PRIJAVE' as const, brojPrijavaZaIzbor: 3 }, { stanje: 'NACRT' as const }]) {
      expect(JSON.stringify(stands(patch))).not.toMatch(/zvonc|Javićemo|Vidiš ih|Uporedi ih|Čekaš prijave|Imaš \d/);
    }
  });
});

describe('the eight words', () => {
  it('a draft is "Nacrt" and says nothing more: the chip and the one action already say it', () => {
    expect(stands({ stanje: 'NACRT' })).toEqual({ chip: { status: 'task.draft' }, next: null, toApplications: false });
  });

  it('a published task nobody has applied to is "Objavljen" with "Još nema prijava"; an unknown count says nothing, never "none"', () => {
    expect(stands({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 0 })).toEqual({ chip: { status: 'task.published' }, next: NO_APPLICATIONS, toApplications: false });
    expect(NO_APPLICATIONS).toBe('Još nema prijava');
    expect(stands({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: null })).toEqual({ chip: { status: 'task.published' }, next: null, toApplications: false });
    expect(stands({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: undefined }).next).toBeNull();
  });

  it('applications that exist but cannot be chosen are not "no applications": "Nema prijava za izbor"', () => {
    expect(stands({ stanje: 'OBJAVLJENA', brojPrijava: 2, brojPrijavaZaIzbor: 0 }).next).toBe(NOTHING_TO_CHOOSE);
    expect(NOTHING_TO_CHOOSE).toBe('Nema prijava za izbor');
    expect([noApplicationsLine(0, 0), noApplicationsLine(0, 3), noApplicationsLine(2, 3), noApplicationsLine(null, 3)]).toEqual([NO_APPLICATIONS, NOTHING_TO_CHOOSE, null, null]);
  });

  it('applications to choose among make it "Bira se · N", and the line is how many, the way to them', () => {
    expect(stands({ stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 3 })).toEqual({ chip: { status: 'task.choosing', detail: '3' }, next: '3 prijave', toApplications: true });
    expect(word({ stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 3 })).toBe('Bira se · 3');
    // The word is never "Čeka prijave" again: it said "has applications" and read as "has none".
    for (const patch of [{ stanje: 'CEKA_PRIJAVE' as const, brojPrijavaZaIzbor: 3 }, { stanje: 'OBJAVLJENA' as const }]) expect(JSON.stringify(stands(patch))).not.toMatch(/Čeka prijave/);
  });

  it('says the application in the right number', () => {
    const lines = [1, 2, 4, 5, 11, 12, 21, 22, 25].map(count => stands({ stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: count }).next);
    expect(lines).toEqual(['1 prijava', '2 prijave', '4 prijave', '5 prijava', '11 prijava', '12 prijava', '21 prijava', '22 prijave', '25 prijava']);
  });

  it('a task with some places agreed says how many in the chip ("Dogovoren · 1 od 2"); with applications still to choose among it is "Bira se"', () => {
    const half = { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 };
    expect(stands({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: half, brojPrijavaZaIzbor: 2 })).toEqual({ chip: { status: 'task.choosing', detail: '2' },
      next: '2 prijave', toApplications: true });
    expect(stands({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: half, brojPrijavaZaIzbor: 0 })).toEqual({ chip: { status: 'task.agreed', detail: '1 od 2' },
      next: null, toApplications: false });
    expect(stands({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: half, brojPrijavaZaIzbor: null })).toEqual({ chip: { status: 'task.agreed', detail: '1 od 2' },
      next: null, toApplications: false });
  });

  it('every place agreed is "Dogovoren", and the chip is all that is said', () => {
    expect(stands({ stanje: 'POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 } })).toEqual({ chip: { status: 'task.agreed' }, next: null, toApplications: false });
  });
});

describe('"U toku": the agreed time has come', () => {
  const full = { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 };
  const window = (startsAt: string | null, endsAt: string | null) => ({ kind: 'FIXED_WINDOW' as const, startsAt, endsAt });
  const at = (patch: Partial<PotrebaProjekcija>) => stands({ stanje: 'POPUNJENA', pokrivenost: full, ...patch });

  it('is the task\'s own fixed window containing now, while every place is agreed', () => {
    const during = at({ schedule: window('2026-10-07T11:00:00Z', '2026-10-07T13:00:00Z') });
    expect(during).toEqual({ chip: { status: 'task.now' }, next: null, toApplications: false });
    expect(word({ stanje: 'POPUNJENA', pokrivenost: full, schedule: window('2026-10-07T11:00:00Z', '2026-10-07T13:00:00Z') })).toBe('U toku');
    // The start counts (the moment it arrives), the end does not (the moment it is over).
    expect(at({ schedule: window('2026-10-07T12:00:00Z', '2026-10-07T13:00:00Z') }).chip?.status).toBe('task.now');
    expect(at({ schedule: window('2026-10-07T11:00:00Z', '2026-10-07T12:00:00Z') }).chip?.status).toBe('task.agreed');
    // A window with a start and no end has begun and has no end to wait for.
    expect(at({ schedule: window('2026-10-07T11:00:00Z', null) }).chip?.status).toBe('task.now');
  });

  it('is not said before the window, after it, with no start, or for a flexible term: those stay "Dogovoren"', () => {
    expect(at({ schedule: window('2026-10-07T12:00:01Z', '2026-10-07T14:00:00Z') }).chip?.status).toBe('task.agreed');
    expect(at({ schedule: window('2026-10-07T09:00:00Z', '2026-10-07T10:00:00Z') }).chip?.status).toBe('task.agreed');
    expect(at({ schedule: window(null, '2026-10-07T14:00:00Z') }).chip?.status).toBe('task.agreed');
    expect(at({ schedule: window('not a time', null) }).chip?.status).toBe('task.agreed');
    expect(at({ schedule: { kind: 'TODAY_FLEXIBLE', startsAt: '2026-10-07T00:00:00Z', endsAt: '2026-10-08T00:00:00Z' } }).chip?.status).toBe('task.agreed');
    expect(at({ schedule: undefined }).chip?.status).toBe('task.agreed');
  });

  it('is never said for a task that is not fully agreed or not going', () => {
    const during = window('2026-10-07T11:00:00Z', '2026-10-07T13:00:00Z');
    expect(stands({ stanje: 'OBJAVLJENA', schedule: during }).chip?.status).toBe('task.published');
    expect(stands({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 }, schedule: during, brojPrijavaZaIzbor: 0 }).chip?.status).toBe('task.agreed');
    expect(stands({ stanje: 'ZATVORENA', kraj: 'COMPLETED', schedule: during }).chip?.status).toBe('task.completed');
  });
});

// The read folds the server's ACTIVE into POPUNJENA whatever the coverage is, and a search that was closed with places still open ("Ne traži
// više nikoga") is ACTIVE with fewer places agreed than needed. The chip then says how many are agreed; the line says the one thing it cannot.
describe('a search closed with places still open', () => {
  const half = { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 }, full = { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 };
  const during = { kind: 'FIXED_WINDOW' as const, startsAt: '2026-10-07T11:00:00Z', endsAt: '2026-10-07T13:00:00Z' };

  it('says the search is closed and how many places are agreed, never that every place is', () => {
    expect(stands({ stanje: 'POPUNJENA', pokrivenost: half })).toEqual({ chip: { status: 'task.agreed', detail: '1 od 2' }, next: 'Potraga je zatvorena', toApplications: false });
    expect(word({ stanje: 'POPUNJENA', pokrivenost: half })).toBe('Dogovoren · 1 od 2');
    for (const pokrivenost of [half, { ukupno: 5, popunjeno: 3, preostalo: 2, udeo: 0.6 }, { ukupno: 3, popunjeno: 0, preostalo: 3, udeo: 0 }]) {
      expect(JSON.stringify(stands({ stanje: 'POPUNJENA', pokrivenost }))).not.toMatch(/Sva mesta/);
    }
  });

  it('keeps the count when the agreed time has come ("U toku · 1 od 2"), and still says the search is closed', () => {
    expect(stands({ stanje: 'POPUNJENA', pokrivenost: half, schedule: during })).toEqual({ chip: { status: 'task.now', detail: '1 od 2' }, next: 'Potraga je zatvorena', toApplications: false });
    expect(word({ stanje: 'POPUNJENA', pokrivenost: half, schedule: during })).toBe('U toku · 1 od 2');
  });

  it('is told apart from every place agreed by the coverage alone: full coverage has no count and no line', () => {
    expect(stands({ stanje: 'POPUNJENA', pokrivenost: full })).toEqual({ chip: { status: 'task.agreed' }, next: null, toApplications: false });
    expect(stands({ stanje: 'POPUNJENA', pokrivenost: full, schedule: during })).toEqual({ chip: { status: 'task.now' }, next: null, toApplications: false });
  });
});

describe('the ending of a task that ended', () => {
  it.each([['COMPLETED', 'Završen'], ['CANCELLED', 'Otkazan'], ['EXPIRED', 'Istekao']] as const)('%s is "%s", from the ending the server sent, and the chip is all that is said', (kraj, said) => {
    expect(word({ stanje: 'ZATVORENA', kraj })).toBe(said);
    expect(stands({ stanje: 'ZATVORENA', kraj }).next).toBeNull();
    expect(stands({ stanje: 'ZATVORENA', kraj }).toApplications).toBe(false);
  });

  it('an archived task, and a closed one whose ending was not carried, get no chip: the words would be a guess', () => {
    expect(stands({ stanje: 'ZATVORENA', kraj: 'ARCHIVED' })).toEqual({ chip: null, next: 'Zadatak je u arhivi.', toApplications: false });
    expect(stands({ stanje: 'ZATVORENA' })).toEqual({ chip: null, next: 'Zadatak je zatvoren.', toApplications: false });
    expect(stands({ stanje: 'ZATVORENA', kraj: 'WEIRD' })).toEqual({ chip: null, next: 'Zadatak je zatvoren.', toApplications: false });
  });

  it('no state of a task is left without a row that says something: every stanje answers', () => {
    const every: PotrebaProjekcija['stanje'][] = ['NACRT', 'OBJAVLJENA', 'CEKA_PRIJAVE', 'DELIMICNO_POPUNJENA', 'POPUNJENA', 'ZATVORENA'];
    for (const stanje of every) {
      const standing = stands({ stanje, brojPrijavaZaIzbor: 1, pokrivenost: { ukupno: 2, popunjeno: stanje === 'POPUNJENA' ? 2 : 1, preostalo: stanje === 'POPUNJENA' ? 0 : 1, udeo: 0.5 } });
      expect([stanje, standing.chip !== null || standing.next !== null]).toEqual([stanje, true]);
    }
  });
});

it('never uses the words the owner struck out: "posao", "Zatvoren", "Čeka prijave", "Termin je sada"', () => {
  const rows: Parameters<typeof task>[0][] = [{ stanje: 'NACRT' }, { stanje: 'OBJAVLJENA' }, { stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 2 }, { stanje: 'DELIMICNO_POPUNJENA', brojPrijavaZaIzbor: 0 },
    { stanje: 'POPUNJENA' }, { stanje: 'ZATVORENA' }, { stanje: 'ZATVORENA', kraj: 'COMPLETED' }, { stanje: 'ZATVORENA', kraj: 'CANCELLED' }, { stanje: 'ZATVORENA', kraj: 'EXPIRED' },
    { stanje: 'ZATVORENA', kraj: 'ARCHIVED' }];
  for (const row of rows) expect(JSON.stringify(stands(row))).not.toMatch(/posao|poslov|Zatvoren"|Čeka prijave|Termin je sada/i);
});
