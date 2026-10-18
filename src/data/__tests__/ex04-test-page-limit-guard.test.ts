import fs from 'fs';
import path from 'path';
import { CANDIDATES_PAGE_LIMIT } from '../candidatesPage';
import { EX04_TEST_PAGE_LIMIT_MAX, EX04_TEST_PAGE_LIMIT_MIN, ex04TestCandidatesPageLimit, ex04TestPageLimit } from '../ex04TestPageLimit';
import { OWN_APPLICATIONS_PAGE_LIMIT } from '../ownApplicationsPage';
import { OWN_TASKS_PAGE_LIMIT } from '../ownTasksPage';

/**
 * EX-04 page-boundary TEST INSTRUMENT (owner decision 2026-10-01, option A). `EXPO_PUBLIC_EX04_TEST_PAGE_LIMIT` is a test value, never a product value:
 *  - without it every pager keeps its product limit;
 *  - anything but a whole number 1..10 is ignored;
 *  - it appears in NO release profile, in `eas.json`, `app.json`, `app.config.js`, package scripts, env files or any workflow except the DEV APK workflow (and there only as the one
 *    value the owner approved, inside the workflow-level `env:` block, while the check runs; after it the line is gone).
 */
const NAME = 'EXPO_PUBLIC_EX04_TEST_PAGE_LIMIT';
const { PAGED_READ_ENV } = require('../../../scripts/build-contract.cjs');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
const exists = (file: string) => fs.existsSync(path.join(ROOT, file));

describe('the test page limit is a test instrument and nothing else', () => {
  it('is not set while the suite runs, so every limit is the product limit', () => {
    expect(process.env[NAME]).toBeUndefined();
    expect(ex04TestPageLimit()).toBeUndefined();
    expect(ex04TestCandidatesPageLimit()).toBeUndefined();
    expect([OWN_TASKS_PAGE_LIMIT, OWN_APPLICATIONS_PAGE_LIMIT, CANDIDATES_PAGE_LIMIT]).toEqual([30, 30, 50]);
  });

  it('accepts only a whole number from the closed range and ignores everything else', () => {
    expect([EX04_TEST_PAGE_LIMIT_MIN, EX04_TEST_PAGE_LIMIT_MAX]).toEqual([1, 10]);
    for (const good of ['1', '2', '9', '10']) expect(ex04TestPageLimit(good)).toBe(Number(good));
    for (const bad of [undefined, null, 2, '', '0', '11', '00', '02', '2.5', '-2', ' 2', '2 ', '2x', 'two', '١٢', '1e1', '0x2', '100']) expect(ex04TestPageLimit(bad)).toBeUndefined();
  });

  it('reads the candidate list one page smaller (never below one), because no task of the test data has more than two candidates', () => {
    expect(ex04TestCandidatesPageLimit('2')).toBe(1);
    expect(ex04TestCandidatesPageLimit('1')).toBe(1);
    expect(ex04TestCandidatesPageLimit('10')).toBe(9);
    expect(ex04TestCandidatesPageLimit('0')).toBeUndefined();
    expect(ex04TestCandidatesPageLimit(undefined)).toBeUndefined();
  });

  it('every pager hook hands the instrument to its pager and nothing else changes the limit', () => {
    expect(read('src/hooks/useOwnTasksPager.ts')).toContain('limit: ex04TestPageLimit()');
    expect(read('src/hooks/useOwnApplicationsPager.ts')).toContain('limit: ex04TestPageLimit()');
    expect(read('src/hooks/useCandidatesPager.ts')).toContain('limit: ex04TestCandidatesPageLimit()');
  });
});

describe('the variable reaches no release profile and no file but the DEV APK workflow', () => {
  const files = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir)).map(name => `${dir}/${name}`);

  it('is absent from eas.json, app.json, app.config.js, package.json and every env file', () => {
    for (const file of ['eas.json', 'app.json', 'app.config.js', 'app.config.ts', 'package.json', '.env', '.env.local', '.env.production', '.env.development', '.env.example'].filter(exists)) {
      expect(`${file}: ${read(file).includes(NAME)}`).toBe(`${file}: false`);
    }
    const eas = JSON.parse(read('eas.json')) as { build?: Record<string, { env?: Record<string, string> }> };
    for (const [profile, value] of Object.entries(eas.build ?? {})) {
      // Product pagination gates are required; the tiny test-page instrument is not.
      // The former prefix-wide ban accidentally prohibited the real bounded readers too.
      expect(Object.keys(value.env ?? {}).filter(key => key.startsWith('EXPO_PUBLIC_EX04')).sort())
        .toEqual(Object.keys(PAGED_READ_ENV).sort());
      expect(`${profile}: ${JSON.stringify(value).includes(NAME)}`).toBe(`${profile}: false`);
    }
  });

  it('is in no workflow but build-android-dev-apk.yml, and in no other .github or scripts file', () => {
    const everyFile = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
      .flatMap(entry => (entry.isDirectory() ? everyFile(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]));
    const others = [...everyFile('.github'), ...(exists('scripts') ? everyFile('scripts') : [])].filter(file => file !== '.github/workflows/build-android-dev-apk.yml');
    expect(others.length).toBeGreaterThan(10);
    for (const file of others) expect(`${file}: ${read(file).includes(NAME)}`).toBe(`${file}: false`);
    expect(files('.github/workflows').filter(name => /\.ya?ml$/.test(name)).length).toBeGreaterThan(10);
  });

  it('is, in the DEV APK workflow, either absent or exactly the approved test value in the workflow-level env block', () => {
    const text = read('.github/workflows/build-android-dev-apk.yml');
    const hits = text.split('\n').filter(line => line.includes(NAME) && !line.trim().startsWith('#'));
    expect(hits.length).toBeLessThanOrEqual(1);
    if (hits.length === 0) return;
    expect(hits[0]).toBe(`  ${NAME}: '2'`);
    const start = text.indexOf('\nenv:\n');
    const end = text.indexOf('\njobs:\n');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(text.slice(start, end)).toContain(`\n  ${NAME}: '2'\n`);
    // the three EX-04 flags sit in the same block: the instrument is part of the same DEV-only test configuration
    expect(text.slice(start, end)).toContain("\n  EXPO_PUBLIC_EX04_CANDIDATES_PAGED: '1'\n");
  });

  it('is read in exactly one source file', () => {
    const readers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) { if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(rel); continue; }
        if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && read(rel).includes(NAME)) readers.push(rel);
      }
    };
    walk('src');
    expect(readers).toEqual(['src/data/ex04TestPageLimit.ts']);
  });
});
