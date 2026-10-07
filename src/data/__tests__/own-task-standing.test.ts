import type { PotrebaProjekcija } from '../../contracts/projections';
import { STATUS_CHIPS } from '../../ui/system/StatusChip';
import { applicationsWaitSentence, ownTaskStanding } from '../ownTaskStanding';

/**
 * Where one of MY tasks stands, in the owner's eight words (2026-10-07), and the one next step in grey words. Pure, so the list, the
 * tests and a later Arhiva agree on what a task is called; and honest, so a word the read cannot support is simply not said.
 */
const NOW = new Date('2026-10-07T12:00:00Z');
const task = (patch: Partial<PotrebaProjekcija> & { kraj?: string } = {}): PotrebaProjekcija => ({ id: 't1', revizija: 1, naslov: 'Krečenje zida', opis: '', stanje: 'OBJAVLJENA',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: 'Sutra, fleksibilno', podrucjeTekst: 'Novi Sad', uslovi: [], brojPrijava: 0, brojPrijavaZaIzbor: 0,
  ...patch } as PotrebaProjekcija);
const stands = (patch: Parameters<typeof task>[0] = {}) => ownTaskStanding(task(patch), NOW);
const word = (patch: Parameters<typeof task>[0]) => { const chip = stands(patch).chip; return chip ? STATUS_CHIPS[chip.status].word + (chip.detail ? ` · ${chip.detail}` : '') : null; };

describe('the eight words', () => {
  it('a draft is "Nacrt" and says what to do with it', () => {
    expect(stands({ stanje: 'NACRT' })).toEqual({ chip: { status: 'task.draft' }, next: 'Nacrt nije objavljen. Nastavi uređivanje.', toApplications: false });
  });

  it('a published task nobody has applied to is "Objavljen" and says it waits; an unknown count says nothing, never "none"', () => {
    expect(stands({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 0 })).toEqual({ chip: { status: 'task.published' }, next: 'Čekaš prijave. Javićemo ti.', toApplications: false });
    expect(stands({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: null })).toEqual({ chip: { status: 'task.published' }, next: null, toApplications: false });
    expect(stands({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: undefined }).next).toBeNull();
  });

  it('applications to choose among make it "Bira se · N", and the next step is the way to them', () => {
    expect(stands({ stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 3 })).toEqual({ chip: { status: 'task.choosing', detail: '3' },
      next: 'Imaš 3 prijave. Uporedi ih i izaberi.', toApplications: true });
    expect(word({ stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 3 })).toBe('Bira se · 3');
    // The word is never "Čeka prijave" again: it said "has applications" and read as "has none".
    for (const patch of [{ stanje: 'CEKA_PRIJAVE' as const, brojPrijavaZaIzbor: 3 }, { stanje: 'OBJAVLJENA' as const }]) expect(JSON.stringify(stands(patch))).not.toMatch(/Čeka prijave/);
  });

  it('says the application in the right case and number, and one application is read and chosen, not compared', () => {
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25].map(applicationsWaitSentence)).toEqual([
      'Imaš 1 prijavu. Pogledaj je i izaberi.', 'Imaš 2 prijave. Uporedi ih i izaberi.', 'Imaš 4 prijave. Uporedi ih i izaberi.',
      'Imaš 5 prijava. Uporedi ih i izaberi.', 'Imaš 11 prijava. Uporedi ih i izaberi.', 'Imaš 12 prijava. Uporedi ih i izaberi.',
      // 21 takes the singular noun but is still many to compare: only exactly one is read and chosen without comparing.
      'Imaš 21 prijavu. Uporedi ih i izaberi.', 'Imaš 22 prijave. Uporedi ih i izaberi.', 'Imaš 25 prijava. Uporedi ih i izaberi.']);
  });

  it('a task with some places agreed says how many; with applications still to choose among it is "Bira se", otherwise "Dogovoren · 1 od 2"', () => {
    const half = { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 };
    expect(stands({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: half, brojPrijavaZaIzbor: 2 })).toEqual({ chip: { status: 'task.choosing', detail: '2' },
      next: 'Dogovoreno 1 od 2. Imaš 2 prijave. Uporedi ih i izaberi.', toApplications: true });
    expect(stands({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: half, brojPrijavaZaIzbor: 0 })).toEqual({ chip: { status: 'task.agreed', detail: '1 od 2' },
      next: 'Dogovoreno 1 od 2. Čekaš prijave za ostala mesta.', toApplications: false });
    expect(stands({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: half, brojPrijavaZaIzbor: null })).toEqual({ chip: { status: 'task.agreed', detail: '1 od 2' },
      next: 'Dogovoreno 1 od 2.', toApplications: false });
  });

  it('every place agreed is "Dogovoren"', () => {
    expect(stands({ stanje: 'POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 } })).toEqual({ chip: { status: 'task.agreed' },
      next: 'Sva mesta su dogovorena. Dogovor vidiš u Dogovorima.', toApplications: false });
  });
});

describe('"U toku": the agreed time has come', () => {
  const full = { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 };
  const window = (startsAt: string | null, endsAt: string | null) => ({ kind: 'FIXED_WINDOW' as const, startsAt, endsAt });
  const at = (patch: Partial<PotrebaProjekcija>) => stands({ stanje: 'POPUNJENA', pokrivenost: full, ...patch });

  it('is the task\'s own fixed window containing now, while every place is agreed', () => {
    const during = at({ schedule: window('2026-10-07T11:00:00Z', '2026-10-07T13:00:00Z') });
    expect(during).toEqual({ chip: { status: 'task.now' }, next: 'Dogovoreni termin je počeo. Dogovor vidiš u Dogovorima.', toApplications: false });
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
// više nikoga") is ACTIVE with fewer places agreed than needed. "Sva mesta su dogovorena" is a fact only of full coverage.
describe('a search closed with places still open', () => {
  const half = { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 }, full = { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 };
  const during = { kind: 'FIXED_WINDOW' as const, startsAt: '2026-10-07T11:00:00Z', endsAt: '2026-10-07T13:00:00Z' };

  it('says the search is closed and how many places are agreed, never that every place is', () => {
    expect(stands({ stanje: 'POPUNJENA', pokrivenost: half })).toEqual({ chip: { status: 'task.agreed', detail: '1 od 2' },
      next: 'Potraga je zatvorena. Dogovoreno 1 od 2.', toApplications: false });
    expect(word({ stanje: 'POPUNJENA', pokrivenost: half })).toBe('Dogovoren · 1 od 2');
    for (const pokrivenost of [half, { ukupno: 5, popunjeno: 3, preostalo: 2, udeo: 0.6 }, { ukupno: 3, popunjeno: 0, preostalo: 3, udeo: 0 }]) {
      expect(JSON.stringify(stands({ stanje: 'POPUNJENA', pokrivenost }))).not.toMatch(/Sva mesta/);
    }
  });

  it('keeps the count when the agreed time has come ("U toku · 1 od 2"), and still says the search is closed', () => {
    expect(stands({ stanje: 'POPUNJENA', pokrivenost: half, schedule: during })).toEqual({ chip: { status: 'task.now', detail: '1 od 2' },
      next: 'Dogovoreni termin je počeo. Potraga je zatvorena. Dogovoreno 1 od 2.', toApplications: false });
    expect(word({ stanje: 'POPUNJENA', pokrivenost: half, schedule: during })).toBe('U toku · 1 od 2');
  });

  it('is told apart from every place agreed by the coverage alone: full coverage keeps "Sva mesta su dogovorena" and has no count', () => {
    expect(stands({ stanje: 'POPUNJENA', pokrivenost: full })).toEqual({ chip: { status: 'task.agreed' },
      next: 'Sva mesta su dogovorena. Dogovor vidiš u Dogovorima.', toApplications: false });
    expect(stands({ stanje: 'POPUNJENA', pokrivenost: full, schedule: during })).toEqual({ chip: { status: 'task.now' },
      next: 'Dogovoreni termin je počeo. Dogovor vidiš u Dogovorima.', toApplications: false });
  });
});

describe('the ending of a task that ended', () => {
  it.each([['COMPLETED', 'Završen', null], ['CANCELLED', 'Otkazan', 'Otkazan zadatak ne prima prijave.'], ['EXPIRED', 'Istekao', 'Rok za prijave je istekao bez izbora.']] as const)
  ('%s is "%s", from the ending the server sent', (kraj, said, next) => {
    expect(word({ stanje: 'ZATVORENA', kraj })).toBe(said);
    expect(stands({ stanje: 'ZATVORENA', kraj }).next).toBe(next);
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
