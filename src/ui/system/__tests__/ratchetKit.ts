import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * What the ratchets of the grid share (UI/UX pass 2026-10-08, F8a): where the repository is, every source file under a folder, a
 * source without its comments, and the one rule by which a list "can only shrink". It is not a test (its name has no `.test`), so
 * Jest does not run it; `one-token-source.test.ts` keeps its own copy of the rule, and this is the same rule.
 */
export const repo = join(__dirname, '../../../..');
export const read = (path: string) => readFileSync(join(repo, path), 'utf8');

/** Every source file under a folder, without tests: the walk every ratchet below makes. */
export const sourceFiles = (dir: string): string[] => readdirSync(join(repo, dir), { withFileTypes: true }).flatMap(entry => {
  const path = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
  return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
});

/** Code without its comments: a comment may name a token the code does not use, and a ratchet counts what is drawn. */
export const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/**
 * THE RATCHET RULE: a list names today's offenders so the suite is green now, and it can only shrink. A file that is not on it, or
 * that spells MORE than its entry, fails ("do not raise the entry"); and a file that spells LESS than its entry fails too ("lower the
 * entry"). Both ways are equalities, so an entry made stale by the work it was waiting for cannot sit there green: the change that
 * moves a file is the change that lowers its line. It returns what is wrong, as sentences naming the entry.
 */
export const ratchetOffences = (path: string, found: Record<string, number>, allowed: Record<string, number>): string[] =>
  [...new Set([...Object.keys(found), ...Object.keys(allowed)])].flatMap(key => {
    const have = found[key] ?? 0, want = allowed[key] ?? 0;
    if (have > want) return [`${path}: ${key} ${have}, allowed ${want}: do not raise the entry`];
    if (have < want) return [`${path}: ${key} ${have}, the entry says ${want}: lower the entry${have === 0 ? ' (delete it)' : ''}`];
    return [];
  });
