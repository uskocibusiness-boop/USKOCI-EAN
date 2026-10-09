import { fixedApplicationPrice } from '../needDetailPresentation';

const task = { rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL' as const, ponudjenaCena: { iznos: 9000 }, pokrivenost: { ukupno: 3 } };
it('divides the original total by original required people, not the remaining places', () => {
  expect([1, 2, 3].map(n => fixedApplicationPrice(task, n))).toEqual([3000, 6000, 9000]);
  expect(fixedApplicationPrice({ ...task, pokrivenost: { ukupno: 3, preostalo: 2 } } as typeof task, 2)).toBe(6000);
});
it('keeps full-team totals and the other price modes intact', () => {
  for (const amount of [1, 9000, 10000, 2147483647]) for (let count = 1; count <= 50; count++) {
    expect(fixedApplicationPrice({ ...task, ponudjenaCena: { iznos: amount }, pokrivenost: { ukupno: count } }, count)).toBe(amount);
  }
  expect(fixedApplicationPrice({ ...task, osnovaCene: 'PER_PERSON' }, 2)).toBe(18000);
  expect(fixedApplicationPrice({ ...task, osnovaCene: null }, 2)).toBe(9000);
  expect(fixedApplicationPrice({ ...task, rezimCene: 'OFFERS' }, 2)).toBeNull();
});
it('never coerces an invalid headcount or missing original capacity into a quote', () => {
  for (const count of [0, -1, 1.5, NaN, Infinity, 4]) expect(fixedApplicationPrice(task, count)).toBeNull();
  expect(fixedApplicationPrice({ ...task, pokrivenost: undefined }, 1)).toBeNull();
});
