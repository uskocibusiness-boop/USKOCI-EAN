import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Exercise the real transitive dependency selected for React DevTools, not a
// Jest mock or a copied implementation. This is a dependency-boundary proof;
// it does not claim an application input reaches a shell execution sink.
const devtoolsRequire = createRequire(require.resolve('react-devtools-core/package.json'));
const shellQuote = devtoolsRequire('shell-quote') as {
  parse(command: string): unknown[];
  quote(tokens: unknown[]): string;
};
const installed = devtoolsRequire('shell-quote/package.json') as { version: string };

const terminators = [
  ['LF', '\n'],
  ['CR', '\r'],
  ['LINE SEPARATOR', '\u2028'],
  ['PARAGRAPH SEPARATOR', '\u2029'],
] as const;

describe('locked shell-quote security boundary (GHSA-pqg4-j6r4-53mv)', () => {
  test.each(terminators)('rejects %s immediately after a comment token', (_name, separator) => {
    expect(() => shellQuote.quote(['echo', { comment: 'note' }, `a${separator}printf probe;#`]))
      .toThrow(expect.objectContaining({ name: 'TypeError' }));
  });

  test.each(terminators)('rejects %s in any later token, including apostrophes', (_name, separator) => {
    expect(() => shellQuote.quote(['echo', { comment: 'note' }, 'ordinary', `it's${separator}printf probe;#`]))
      .toThrow(expect.objectContaining({ name: 'TypeError' }));
  });

  test.each(terminators)('rejects %s after a comment produced by parse', (_name, separator) => {
    const parsed = shellQuote.parse('echo https://example.invalid/#fragment');
    expect(parsed).toContainEqual({ comment: 'fragment' });
    expect(() => shellQuote.quote([...parsed, `a${separator}printf probe;#`]))
      .toThrow(expect.objectContaining({ name: 'TypeError' }));
  });

  test('preserves ordinary and empty arguments, punctuation, quotes and spaces', () => {
    const args = ['editor', '', 'file with spaces.ts', 'quote\'s.ts', 'literal;not-a-command', 'price$5'];
    expect(shellQuote.parse(shellQuote.quote(args))).toEqual(args);
  });

  test('preserves editor command parsing without spawning an editor', () => {
    expect(shellQuote.parse('code --wait "file with spaces.ts"'))
      .toEqual(['code', '--wait', 'file with spaces.ts']);
  });

  test('preserves line terminators before a comment and safe tokens after it', () => {
    for (const [, separator] of terminators) {
      const value = `before${separator}after`;
      expect(shellQuote.parse(shellQuote.quote(['echo', value]))).toEqual(['echo', value]);
      expect(shellQuote.quote(['echo', value, { comment: 'note' }]))
        .toBe(`echo '${value}' #note`);
    }
    expect(shellQuote.quote(['echo', { comment: 'note' }, 'ordinary']))
      .toBe('echo #note ordinary');
  });

  test('tests the same single package version recorded in the dependency lock', () => {
    const lock = JSON.parse(readFileSync(resolve(__dirname, '../../../package-lock.json'), 'utf8')) as {
      packages: Record<string, { version?: string }>;
    };
    const lockedCopies = Object.entries(lock.packages)
      .filter(([path]) => path.endsWith('/shell-quote'))
      .map(([, entry]) => entry.version);
    expect(lockedCopies).toEqual([installed.version]);
  });
});
