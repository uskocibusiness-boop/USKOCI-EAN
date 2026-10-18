import type { PrilikaProjekcija, PotrebaProjekcija } from '../../contracts/projections';
import { homeOpportunityPreview } from '../homeOpportunityPreview';

const task = (id: string) => ({ id } as PrilikaProjekcija);
const mine = (id: string) => ({ id } as PotrebaProjekcija);

test('Home recommends only other people\'s tasks, even when an own task is public', () => {
  const available = [task('A'), task('B'), task('C')];
  expect(homeOpportunityPreview(available, { kind: 'known', value: [mine('b')] }).map(row => row.id)).toEqual(['A', 'C']);
  expect(homeOpportunityPreview(available, { kind: 'known', value: [mine('a'), mine('b'), mine('c')] })).toEqual([]);
});

test('Home withholds recommendations when the own-task read failed', () => {
  expect(homeOpportunityPreview([task('A')], { kind: 'unavailable' })).toEqual([]);
  expect(homeOpportunityPreview([task('A')], undefined)).toEqual([]);
});
