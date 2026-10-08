import type { PotrebaProjekcija } from '../../contracts/projections';
import { ownTaskPhase, ownTaskPhases } from '../../ui/v2/ownTaskPhases';

const HALF = { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 };
const FULL = { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 };
const task = (patch: Partial<PotrebaProjekcija> & { kraj?: string } = {}): PotrebaProjekcija => ({ id: 't1', revizija: 1, naslov: 'Krečenje zida', opis: '',
  stanje: 'OBJAVLJENA', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: 'Sutra, fleksibilno', podrucjeTekst: 'Novi Sad', uslovi: [],
  brojPrijava: 0, brojPrijavaZaIzbor: 0, ...patch } as PotrebaProjekcija);

// "Papir na stolu" (the owner's pick of 2026-10-08): the list of "Moji zadaci" is in groups by phase, and a task is in exactly one of them, by what it
// is doing now. The group is why the card does not wear its chip a second time, so the two must agree.
describe('the phases of my active tasks', () => {
  type Patch = NonNullable<Parameters<typeof task>[0]>;
  const phase = (patch: Patch) => ownTaskPhase(task(patch));
  it('a task that waits for my choice is "choosing", by the one rule of the app, whatever state it calls itself', () => {
    expect(phase({ stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 3 })).toBe('choosing');
    expect(phase({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 1 })).toBe('choosing');
    expect(phase({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijavaZaIzbor: 2 })).toBe('choosing');
  });

  it('an unknown count is never a choice, and a task with every place agreed has nothing to choose among', () => {
    expect(phase({ stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: undefined })).toBe('published');
    expect(phase({ stanje: 'POPUNJENA', pokrivenost: FULL, brojPrijavaZaIzbor: 4 })).toBe('agreed');
  });

  it('a task that is out and nobody is agreed is "published", and one that has someone agreed is "agreed"', () => {
    expect(phase({ stanje: 'OBJAVLJENA' })).toBe('published');
    expect(phase({ stanje: 'CEKA_PRIJAVE', brojPrijava: 2, brojPrijavaZaIzbor: 0 })).toBe('published');
    expect(phase({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijavaZaIzbor: 0 })).toBe('agreed');
    expect(phase({ stanje: 'POPUNJENA', pokrivenost: FULL })).toBe('agreed');
  });

  it('a draft and a closed task are in no group', () => {
    expect(phase({ stanje: 'NACRT' })).toBeNull();
    for (const kraj of ['COMPLETED', 'CANCELLED', 'EXPIRED', 'ARCHIVED', undefined]) expect(phase({ stanje: 'ZATVORENA', kraj })).toBeNull();
  });

  it('the groups come in the order they are drawn, each keeps the order of the list and an empty one stays in it', () => {
    const list = [task({ id: 'p', stanje: 'OBJAVLJENA' }), task({ id: 'c', stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 2 }), task({ id: 'd', stanje: 'NACRT' }),
      task({ id: 'c2', stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 1 }), task({ id: 'a', stanje: 'POPUNJENA', pokrivenost: FULL })];
    const groups = ownTaskPhases(list);
    expect(groups.map(group => [group.key, group.title, group.items.map(item => item.id)])).toEqual([
      ['choosing', 'Čeka tvoj izbor', ['c', 'c2']], ['published', 'Objavljeno', ['p']], ['agreed', 'Dogovoreno', ['a']]]);
    expect(ownTaskPhases([]).map(group => group.items.length)).toEqual([0, 0, 0]);
  });

  it('agrees with the chip the card used to wear: "Bira se" is "choosing", "Objavljen" is "published" and "Dogovoren" or "U toku" is "agreed" (the group says it now)', () => {
    const cases: [Patch, string][] = [
      [{ stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 3 }, 'task.choosing'], [{ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijavaZaIzbor: 1 }, 'task.choosing'],
      [{ stanje: 'OBJAVLJENA' }, 'task.published'], [{ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijavaZaIzbor: 0 }, 'task.agreed'],
      [{ stanje: 'POPUNJENA', pokrivenost: FULL }, 'task.agreed']];
    const group = { 'task.choosing': 'choosing', 'task.published': 'published', 'task.agreed': 'agreed' } as const;
    for (const [patch, chip] of cases) expect([patch.stanje, phase(patch)]).toEqual([patch.stanje, group[chip as keyof typeof group]]);
  });
});
