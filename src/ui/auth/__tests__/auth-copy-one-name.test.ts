import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { authCopy } from '../authCopy';

/**
 * ONE NAME FOR ONE FUNCTION (TEKSTOVI, 2026-10-07, finding W2 #5; F7, 2026-10-08). Recovering a password had three names on the
 * sign-in screens ("Oporavak pristupa" in the bar, "Vrati pristup nalogu" as the title, "Oporavak naloga" on the link's own screen)
 * and an eyebrow ("Bezbedan povratak"); the first step of the sheet greeted with "Zdravo.", which said nothing. The name is
 * `authCopy.recoveryName`; what the person taps to get there stays the question they ask ("Zaboravljena lozinka?"). The check reads
 * every file of the sign-in screens, comments aside, and the test names of the old words are the only place they may be written.
 */
const repo = join(__dirname, '../../../..');
const sources = (dir: string): string[] => readdirSync(join(repo, dir), { withFileTypes: true }).flatMap(entry => {
  const path = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path);
  return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
});
const FILES = ['src/app/auth.tsx', 'src/app/oporavak.tsx', ...sources('src/ui/auth')];
const codeOf = (path: string) => readFileSync(join(repo, path), 'utf8').split(/\r?\n/).filter(line => !/^\s*(?:\/\/|\*|\/\*)/.test(line)).join('\n');

const OLD_NAMES = ['Oporavak pristupa', 'Oporavak naloga', 'Vrati pristup nalogu', 'Bezbedan povratak', 'BEZBEDAN POVRATAK', 'JEDAN NALOG · OBE MOGUĆNOSTI'];

describe('the sign-in screens say each thing one way', () => {
  it.each(FILES)('%s uses none of the old names of password recovery, and no eyebrow', path => {
    const code = codeOf(path);
    expect(OLD_NAMES.filter(name => code.includes(name))).toEqual([]);
  });

  it('"Zdravo." is not the title of anything, and the first step says what it is for', () => {
    for (const path of FILES) expect(codeOf(path)).not.toMatch(/['"`]Zdravo\.['"`]/);
    expect(authCopy.formTitle).toBe('Prijavi se ili napravi nalog');
  });

  it('password recovery has one name, in the title of its step and in the bar of the link\'s own screen', () => {
    expect(authCopy.recoveryName).toBe('Oporavak lozinke');
    expect(codeOf('src/ui/auth/AuthStateSteps.tsx')).toContain('authCopy.recoveryName');
    expect(codeOf('src/app/oporavak.tsx')).toContain('authCopy.recoveryName');
  });

  it('the legal sentence names the document the way the legal screens do: "Politika privatnosti"', () => {
    expect(authCopy.legal).toBe('Uslovi korišćenja i Politika privatnosti još nisu objavljeni.');
  });

  it('the voice is "ti" without gender: no participle that says who the person is ("nisi prijavljen", "si uneo")', () => {
    const GENDERED = /\b(?:nisi|si)\s+(?:prijavljen|prijavljena|odjavljen|odjavljena|izabran|izabrana|uneo|unela|registrovan|registrovana)\b/i;
    // The check finds what it is for, and lets the neutral words through.
    expect(GENDERED.test('Još nisi prijavljen.')).toBe(true);
    expect(GENDERED.test('Prijava još nije gotova.')).toBe(false);
    for (const path of FILES) expect([path, GENDERED.test(codeOf(path))]).toEqual([path, false]);
  });

  it('the retry button is "Pokušaj ponovo" everywhere ("Probaj" and "Ponovi" are not words of the app)', () => {
    expect(authCopy.retry).toBe('Pokušaj ponovo');
    for (const path of FILES) expect(codeOf(path)).not.toMatch(/Probaj|Ponovi\b/);
  });
});
