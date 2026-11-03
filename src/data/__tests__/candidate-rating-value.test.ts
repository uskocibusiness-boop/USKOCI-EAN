import { candidateRatingValue } from '../candidateRating';

it.each([
  ['1', 1], ['5', 5], ['4,8', 4.8], ['4.75', 4.75],
  [' 3.125 ', 3.125], ['1,001', 1.001],
])('admits a complete bounded numeric rating %s', (text, expected) => {
  expect(candidateRatingValue(text)).toBe(expected);
});

it.each([
  '0', '0,0', '5,001', '99', '6', '-1', 'NaN', 'Infinity', '1e3',
  'Ocena 4,8', '4,8 više', '4.9999', '1.0000', '—', '',
  '5.', '4,', '5,5', null, undefined, {}, 4.8,
])('does not turn unsupported or spoofed rating %p into a star', value => {
  expect(candidateRatingValue(value)).toBeNull();
});
