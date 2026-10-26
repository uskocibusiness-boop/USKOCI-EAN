import fs from 'fs';
import path from 'path';
import { SAFETY_TARGET_NAME_BUILT, SAFETY_TARGET_NAME_FLAG, safetyTargetNameBuilt } from '../safetyTargetNameGate';
import { candidatesPagedBuilt } from '../candidatesPagedGate';
import { voiceMessagesBuilt } from '../voiceMessagesGate';

/**
 * EX-07 S06: the displayed name of a safety target is read only in a build compiled with ONE flag; any other value, a missing value or a look-alike keeps the
 * safety screen exactly as it was, so a build that meets a backend without the candidate never asks for a name. Recompiling without the flag is the kill switch.
 */
const NAME = 'EXPO_PUBLIC_EX07_SAFETY_TARGET_NAME';
const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
const exists = (file: string) => fs.existsSync(path.join(ROOT, file));

describe('the build flag of the displayed name of a safety target', () => {
  const original = process.env[NAME];
  const restore = () => { if (original === undefined) delete process.env[NAME]; else process.env[NAME] = original; };
  afterEach(restore);

  it('is named exactly as the approval block names it and is on for exactly the compiled value', () => {
    expect(SAFETY_TARGET_NAME_FLAG).toBe(NAME);
    expect(SAFETY_TARGET_NAME_BUILT).toBe('1');
    expect(safetyTargetNameBuilt('1')).toBe(true);
  });

  it.each([undefined, null, '', '0', 'true', 'TRUE', ' 1', '1 ', 'on', 'yes', 1, true, false])('is off for %p', value => {
    expect(safetyTargetNameBuilt(value)).toBe(false);
  });

  it('reads the build environment when no value is given, and is off by default (Jest, web, every build before the backend has the candidate)', () => {
    delete process.env[NAME];
    expect(safetyTargetNameBuilt()).toBe(false);
    process.env[NAME] = '1';
    expect(safetyTargetNameBuilt()).toBe(true);
    process.env[NAME] = 'yes';
    expect(safetyTargetNameBuilt()).toBe(false);
  });

  it('is its own flag: another package flag does not switch it, and it switches no other package', () => {
    const others = ['EXPO_PUBLIC_EX04_CANDIDATES_PAGED', 'EXPO_PUBLIC_VOICE_MESSAGES'];
    const saved = Object.fromEntries(others.map(key => [key, process.env[key]]));
    try {
      delete process.env[NAME];
      others.forEach(key => { process.env[key] = '1'; });
      expect(safetyTargetNameBuilt()).toBe(false);
      others.forEach(key => { delete process.env[key]; });
      process.env[NAME] = '1';
      expect(safetyTargetNameBuilt()).toBe(true);
      expect(candidatesPagedBuilt()).toBe(false);
      expect(voiceMessagesBuilt()).toBe(false);
    } finally {
      for (const key of others) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
    }
  });

  it('is not set while the suite runs', () => {
    expect(original).toBeUndefined();
  });
});

describe('the variable reaches no release profile and is read in one file only', () => {
  it('is absent from eas.json, app.json, app.config.js, package.json and every env file', () => {
    for (const file of ['eas.json', 'app.json', 'app.config.js', 'app.config.ts', 'package.json', '.env', '.env.local', '.env.production', '.env.development', '.env.example'].filter(exists)) {
      expect(`${file}: ${read(file).includes(NAME)}`).toBe(`${file}: false`);
    }
    const eas = JSON.parse(read('eas.json')) as { build?: Record<string, { env?: Record<string, string> }> };
    for (const [profile, value] of Object.entries(eas.build ?? {})) {
      expect(`${profile}: ${Object.keys(value.env ?? {}).includes(NAME)}`).toBe(`${profile}: false`);
    }
  });

  it('is in no workflow but the DEV APK workflow, and there only as the compiled value in the workflow-level env block', () => {
    const everyFile = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
      .flatMap(entry => (entry.isDirectory() ? everyFile(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]));
    const dev = '.github/workflows/build-android-dev-apk.yml';
    for (const file of everyFile('.github').filter(item => item !== dev)) expect(`${file}: ${read(file).includes(NAME)}`).toBe(`${file}: false`);
    // The clean branch has no APK workflow. Absence is the safest DEV default;
    // any future workflow must still use the approved value only.
    if (!exists(dev)) return;
    const text = read(dev);
    const hits = text.split('\n').filter(line => line.includes(NAME) && !line.trim().startsWith('#'));
    expect(hits.length).toBeLessThanOrEqual(1);
    if (hits.length === 0) return;
    expect(hits[0]).toBe(`  ${NAME}: '1'`);
    const start = text.indexOf('\nenv:\n'), end = text.indexOf('\njobs:\n');
    expect(start).toBeGreaterThan(-1);
    expect(text.slice(start, end)).toContain(`\n  ${NAME}: '1'\n`);
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
    expect(readers).toEqual(['src/data/safetyTargetNameGate.ts']);
  });
});
