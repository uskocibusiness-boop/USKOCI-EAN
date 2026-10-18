import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/** Source-reading helpers shared by boundary tests. Historical literal-count
 * enforcement has been retired; ownership and behavior are checked by callers. */
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
