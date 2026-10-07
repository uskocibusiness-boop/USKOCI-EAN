import { readFileSync } from 'fs';
import { join } from 'path';
import { publicSupportMailto } from '../supportContact';

/**
 * "Piši podršci" on a screen where nobody is signed in (a restricted account) needs a public way to write, and the app has none
 * of its own: the private support is account-scoped. No address is invented. It appears only when the owner supplies one at
 * build time, and until then the button, and the sentence that points to it, are not drawn.
 */
describe('the public support address', () => {
  it('is nothing until the owner supplies one: nothing is invented, nothing is shown as "uskoro"', () => {
    expect(publicSupportMailto(undefined)).toBeNull();
    expect(publicSupportMailto('')).toBeNull();
    expect(publicSupportMailto('   ')).toBeNull();
    // The test environment has none either.
    expect(publicSupportMailto()).toBeNull();
  });

  it('becomes a mailto link with a subject that tells support what this is about', () => {
    expect(publicSupportMailto('podrska@example.test'))
      .toBe(`mailto:podrska@example.test?subject=${encodeURIComponent('USKOČI: ograničen nalog')}`);
    expect(publicSupportMailto('  podrska@example.test \n')).toBe(publicSupportMailto('podrska@example.test'));
    expect(publicSupportMailto('ime.prezime+uskoci@pomoc.example.rs')).toContain('mailto:ime.prezime+uskoci@pomoc.example.rs?subject=');
  });

  it.each([
    'podrska', 'podrska@', '@example.test', 'podrska@example', 'podrska @example.test', 'podrska@exam ple.test',
    'a@b@example.test', 'mailto:podrska@example.test', 'https://example.test/pomoc', 'podrska@example.test?cc=x@y.test',
    'podrska@example.test,drugi@example.test', '<podrska@example.test>',
  ])('refuses %j: a value that is not exactly one address never reaches a link', value => {
    expect(publicSupportMailto(value)).toBeNull();
  });

  it('is read from the one build variable, so a store build without it shows nothing', () => {
    expect(readFileSync(join(__dirname, '../supportContact.ts'), 'utf8')).toContain('process.env.EXPO_PUBLIC_SUPPORT_EMAIL');
  });
});
