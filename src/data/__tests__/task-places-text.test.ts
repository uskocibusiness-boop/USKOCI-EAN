import type { Pokrivenost } from '../../contracts/projections';
import { placesText } from '../../ui/v2/TaskFace';

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
