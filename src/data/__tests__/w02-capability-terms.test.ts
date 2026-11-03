import { capabilityTerms } from '../../lib/capabilityTerms';

it('shares the existing 50-item/500-codepoint contract without a new vocabulary', () => {
  expect(capabilityTerms(['  Selidbe ', 'SELIDBE', '  bušilica  ', 'Category B'])).toEqual(['Selidbe', 'SELIDBE', 'bušilica', 'Category B']);
  expect(capabilityTerms([])).toEqual([]);
  expect(capabilityTerms(Array(50).fill('tool'))).toHaveLength(50);
  expect(capabilityTerms(['🧰'.repeat(500)])).toEqual(['🧰'.repeat(500)]);
});
it.each([null, {}, [''], ['   '], [1], [null], ['a', false], Array(51).fill('tool'), ['🧰'.repeat(501)]])('refuses malformed capability input: %p', value => {
  expect(capabilityTerms(value)).toBeNull();
});
it('copies input before an asynchronous save rather than retaining a mutable command array', () => {
  const input=['brush']; const result=capabilityTerms(input); input.push('invented');
  expect(result).toEqual(['brush']);
});
