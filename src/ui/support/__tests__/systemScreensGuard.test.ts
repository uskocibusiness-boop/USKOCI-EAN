import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * The system screens (Podrška, Pravila i saglasnosti, Privatnost i podaci, Izvoz podataka, O aplikaciji, Blokirane osobe,
 * Bezbednost, Zatvaranje naloga) are one family, built from the same pieces as the rest of the app (UI/UX pass 2026-10-07,
 * team T4c). This guards, on the source of exactly those files, the rules a screen of that family must keep:
 *
 *   - no body copy is drawn at a lowered opacity (Podrška once faded a waiting row to .45, which made its words hard to read:
 *     a control that cannot be used now draws its words in the muted ink, which is readable, never a ghost);
 *   - one icon system: the controls ask `Glyph` and the facts ask `FactArt`; no file here imports the Phosphor package or the
 *     Catalog27 stills (the system ratchet in `glyph-import-guard.test.ts` lists the files that still do; none of these may);
 *   - no text is spelled below 12 px;
 *   - the word "posao/poslovi" is never shown (only "zadatak"), nor the internal names of the two sides of a task.
 */
const repo = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(repo, path), 'utf8');
const sourcesIn = (dir: string): string[] => readdirSync(join(repo, dir), { withFileTypes: true }).flatMap(entry => {
  const path = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourcesIn(path);
  return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
});
const FAMILY = [
  ...['support', 'legal', 'privacy', 'closure', 'settings', 'safety'].flatMap(folder => sourcesIn(`src/ui/${folder}`)),
  ...['izvoz', 'o-aplikaciji', 'pravna', 'privatnost', 'blokirani'].map(name => `src/app/(app)/profil/${name}.tsx`),
  'src/app/(app)/bezbednost.tsx',
  ...sourcesIn('src/app/(app)/podrska'),
];
const comment = (line: string) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line);
const code = (path: string) => read(path).split(/\r?\n/).map((line, index) => ({ line, at: `${path}:${index + 1}` })).filter(entry => !comment(entry.line));

describe('the system screens are one family', () => {
  it('lists the files it guards, and every one exists', () => {
    expect(FAMILY.length).toBeGreaterThan(30);
    expect(FAMILY.filter(path => !existsSync(join(repo, path)))).toEqual([]);
  });

  it('draws nothing at a lowered opacity', () => {
    expect(FAMILY.flatMap(code).filter(({ line }) => /\bopacity\s*:/.test(line)).map(({ at }) => at)).toEqual([]);
  });

  it('asks Glyph and FactArt for every icon: no Phosphor import and no Catalog27 still', () => {
    const offenders = FAMILY.filter(path => /from\s*['"]phosphor-react-native|CatalogArt/.test(read(path)));
    expect(offenders).toEqual([]);
  });

  it('spells no text size under 12', () => {
    expect(FAMILY.flatMap(code).filter(({ line }) => /\bfontSize\s*:\s*(?:[0-9]|1[01])(?![0-9.])/.test(line)).map(({ at }) => at)).toEqual([]);
  });

  it('says "zadatak", never "posao" or "poslovi", and never the internal names of the two sides of a task', () => {
    const banned = /\b(?:posao|posla|poslu|poslom|poslovi|poslova|poslovima)\b|Naručilac|Uskočer|naručilac|uskočer/;
    expect(FAMILY.flatMap(code).filter(({ line }) => banned.test(line)).map(({ at }) => at)).toEqual([]);
  });
});
