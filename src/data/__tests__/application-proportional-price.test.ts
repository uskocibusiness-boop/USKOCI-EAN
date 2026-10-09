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
it('rounds each application share to the nearest dinar, with positive halves upward', () => {
  const rounded = { ...task, ponudjenaCena: { iznos: 10000 } };
  expect([1, 2, 3].map(n => fixedApplicationPrice(rounded, n))).toEqual([3333, 6667, 10000]);
  expect(fixedApplicationPrice({ ...task, ponudjenaCena: { iznos: 5 }, pokrivenost: { ukupno: 2 } }, 1)).toBe(3);
  expect(fixedApplicationPrice({ ...task, ponudjenaCena: { iznos: 1 } }, 1)).toBeNull();
  expect(fixedApplicationPrice({ ...task, ponudjenaCena: { iznos: 1 } }, 2)).toBe(1);
});
it('matches the independent integer oracle for all supported group sizes and bounded budget fixtures', () => {
  for (const amount of [1, 3, 5, 1000, 9000, 10000, 2147483647]) for (let required = 1; required <= 50; required++) for (let count = 1; count <= required; count++) {
    const expected = Math.floor((2 * amount * count + required) / (2 * required));
    expect(fixedApplicationPrice({ ...task, ponudjenaCena: { iznos: amount }, pokrivenost: { ukupno: required } }, count)).toBe(expected || null);
  }
});
it('never coerces an invalid headcount or missing original capacity into a quote', () => {
  for (const count of [0, -1, 1.5, NaN, Infinity, 4]) expect(fixedApplicationPrice(task, count)).toBeNull();
  expect(fixedApplicationPrice({ ...task, pokrivenost: undefined }, 1)).toBeNull();
});
