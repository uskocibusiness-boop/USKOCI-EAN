import type { Pokrivenost } from '../../contracts/projections';
import { capacityWords, placesText } from '../../ui/v2/TaskFace';

/**
 * How many places are filled, said the Serbian way (text proposal 2026-10-07, MNOZINA): "popunjeno" agrees with the number of places filled, so "2 od 4 mesta popunjena" and
 * "1 od 4 mesta popunjeno". Only what is HEARD changes (the sentence a screen reader says); the fraction on the card and the words a worker reads are the same.
 */
const covered = (popunjeno: number, ukupno: number): Pokrivenost => ({ ukupno, popunjeno, preostalo: ukupno - popunjeno, udeo: popunjeno / ukupno });

describe('"popunjeno" agrees with the places filled', () => {
  it.each([[0, 'popunjeno'], [1, 'popunjeno'], [2, 'popunjena'], [3, 'popunjena'], [4, 'popunjena'], [5, 'popunjeno'], [11, 'popunjeno'], [12, 'popunjeno'],
    [14, 'popunjeno'], [21, 'popunjeno'], [22, 'popunjena'], [24, 'popunjena'], [25, 'popunjeno']])('%i filled: "%s"', (filled, word) => {
    const total = Math.max(filled, 1) + 3;
    for (const spoken of [placesText(covered(filled, total), 'owner').spoken, placesText(covered(filled, total), 'worker', 'fraction').spoken]) {
      expect(spoken).toBe(`${filled} od ${total} mesta ${word}`);
    }
  });

  it('leaves what is read alone: the owner\'s "0/2 popunjeno", the worker\'s words, and the fraction', () => {
    expect(placesText(covered(2, 4), 'owner')).toEqual({ text: '2/4 popunjeno', spoken: '2 od 4 mesta popunjena' });
    expect(placesText(covered(2, 4), 'worker', 'fraction')).toEqual({ text: '2/4', spoken: '2 od 4 mesta popunjena' });
    expect(placesText(covered(1, 3), 'worker')).toEqual({ text: 'Još 2 od 3 mesta', spoken: 'Još 2 od 3 mesta' });
    expect(placesText(covered(2, 2), 'worker')).toEqual({ text: 'Sva mesta su popunjena', spoken: 'Sva mesta su popunjena' });
  });
});

/**
 * The people a task needs, as the card says it (the owner's phone of 8 Oct 2026: "bez 0/1 — ništa ne znači onome ko traži zadatak"): nothing for a task for one person,
 * "Treba 3 osobe" for a task for several that nobody has taken, and then how many are left (to the one who can come) or how far it is (to the owner).
 */
describe('capacityWords: the people a task needs, in words and only when it is more than one', () => {
  it('says nothing of a task for one person, whoever reads it', () => {
    for (const audience of ['worker', 'owner'] as const) expect(capacityWords(covered(0, 1), audience)).toBeNull();
  });

  it.each([[2, 'Treba 2 osobe'], [3, 'Treba 3 osobe'], [4, 'Treba 4 osobe'], [5, 'Treba 5 osoba'], [12, 'Treba 12 osoba'], [21, 'Treba 21 osobu'], [22, 'Treba 22 osobe']])(
    'says how many are needed when nobody is taken yet (%i): "%s", the same to both readers', (total, words) => {
      for (const audience of ['worker', 'owner'] as const) expect(capacityWords(covered(0, total), audience)).toEqual({ text: words, spoken: words });
    });

  it('tells the one who can come what is left, and the owner how far it is, once some places are taken', () => {
    expect(capacityWords(covered(1, 3), 'worker')).toEqual({ text: 'Još 2 od 3 mesta', spoken: 'Još 2 od 3 mesta' });
    expect(capacityWords(covered(1, 3), 'owner')).toEqual({ text: '1/3 popunjeno', spoken: '1 od 3 mesta popunjeno' });
    expect(capacityWords(covered(2, 4), 'owner')).toEqual({ text: '2/4 popunjeno', spoken: '2 od 4 mesta popunjena' });
  });

  it('says that every place is taken, whatever the size of the task', () => {
    for (const audience of ['worker', 'owner'] as const) {
      expect(capacityWords(covered(3, 3), audience)).toEqual({ text: 'Sva mesta su popunjena', spoken: 'Sva mesta su popunjena' });
      expect(capacityWords(covered(1, 1), audience)).toEqual({ text: 'Sva mesta su popunjena', spoken: 'Sva mesta su popunjena' });
    }
  });
});
