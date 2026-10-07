import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import * as Haptics from 'expo-haptics';
import { forgetTicks, tick, type Tick } from '../haptics';
import { sys } from '../tokens';

/**
 * The one place a haptic tick is made (motion pass, M-03; spec A6). What is pinned here is what the phone is asked for:
 * on iOS the system generators, on Android the system's own haptic constants through `performAndroidHapticsAsync`, with the
 * vibrator waveforms as the fallback and silence at the end of the chain; that nothing throws or rejects; that two ticks closer
 * than `sys.motion.tickGap` are one; and that every tick in the app goes through this file. How it FEELS is for the HONOR: the
 * Android mapping is the spec's table, a hypothesis until it has been felt (spec A6).
 *
 * `expo-haptics` is replaced by recorders; its enums are the package's own, so a constant the package does not have fails here.
 */
jest.mock('expo-haptics', () => ({
  __esModule: true,
  ...jest.requireActual('expo-haptics'),
  selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(), performAndroidHapticsAsync: jest.fn(),
}));
let mockOs: 'ios' | 'android' = 'ios';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get: (target, key) => key === 'Platform' ? { ...target.Platform, OS: mockOs } : Reflect.get(target, key) });
});

/** The package as the wrapper sees it (the mock object itself), so a test can take a function away from it and put it back. */
const pkg = Haptics as unknown as Record<string, unknown>;
const VIBRATOR = ['selectionAsync', 'impactAsync', 'notificationAsync'];
const NAMES = ['performAndroidHapticsAsync', ...VIBRATOR];
/** The four recorders, taken once, before any test takes a function away from the package. */
const MOCKS = Object.fromEntries(NAMES.map(name => [name, pkg[name] as jest.Mock])) as Record<string, jest.Mock>;
const android = MOCKS.performAndroidHapticsAsync;
/** Every call the phone was asked for, by function name. */
const calls = () => Object.fromEntries(Object.entries(MOCKS).map(([name, mock]) => [name, mock.mock.calls]));
const played = () => Object.values(calls()).reduce((sum, list) => sum + list.length, 0);
/** Lets the promises a tick starts settle: the fallbacks of a refused constant are a few microtasks behind it. */
const flush = async () => { for (let turn = 0; turn < 25; turn++) await Promise.resolve(); };

let now = 100_000;
let clock: jest.SpyInstance;
beforeEach(() => {
  mockOs = 'ios';
  now = 100_000;
  clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
  forgetTicks();
  for (const mock of Object.values(MOCKS)) mock.mockReset().mockImplementation(() => Promise.resolve());
});
afterEach(() => { clock.mockRestore(); });

/** Every kind, what iOS plays for it, and the arguments (the system generators; nothing of Android's). */
const IOS: [Tick, string, unknown[]][] = [
  ['select', 'selectionAsync', []], ['toggleOn', 'selectionAsync', []], ['toggleOff', 'selectionAsync', []],
  ['light', 'impactAsync', ['light']], ['medium', 'impactAsync', ['medium']],
  ['success', 'notificationAsync', ['success']], ['error', 'notificationAsync', ['error']],
  ['gestureStart', 'impactAsync', ['light']], ['gestureEnd', 'impactAsync', ['light']], ['cancel', 'notificationAsync', ['warning']],
];
/** Every kind and the one system constant Android is asked for first (the spec's table, A6). */
const ANDROID: [Tick, string][] = [
  ['select', 'segment-tick'], ['toggleOn', 'toggle-on'], ['toggleOff', 'toggle-off'],
  ['light', 'virtual-key'], ['medium', 'long-press'], ['success', 'confirm'], ['error', 'reject'],
  ['gestureStart', 'gesture-start'], ['gestureEnd', 'gesture-end'], ['cancel', 'reject'],
];

describe('iOS plays the system generators', () => {
  it.each(IOS)('%s is %s(%j), once, and nothing of Android\'s', async (kind, name, args) => {
    tick(kind);
    await flush();
    const seen = calls();
    expect(seen[name]).toEqual([args]);
    for (const other of NAMES.filter(candidate => candidate !== name)) expect([other, seen[other]]).toEqual([other, []]);
  });

  it('the two tables cover the same ten kinds, each once', () => {
    const kinds = IOS.map(([kind]) => kind).sort();
    expect(kinds).toEqual(ANDROID.map(([kind]) => kind).sort());
    expect(new Set(kinds).size).toBe(10);
  });
});

describe('Android asks the system for its own haptic constant', () => {
  beforeEach(() => { mockOs = 'android'; });

  it.each(ANDROID)('%s is the system\'s %s, once, with no vibrator waveform', async (kind, constant) => {
    tick(kind);
    await flush();
    const seen = calls();
    expect(seen.performAndroidHapticsAsync).toEqual([[constant]]);
    for (const name of VIBRATOR) expect([name, seen[name]]).toEqual([name, []]);
  });

  it('names constants the installed package really has, by their own values', () => {
    const own = Haptics.AndroidHaptics as unknown as Record<string, string>;
    const wanted = ['Segment_Tick', 'Toggle_On', 'Toggle_Off', 'Virtual_Key', 'Long_Press', 'Confirm', 'Reject', 'Gesture_Start', 'Gesture_End', 'Context_Click'];
    expect(wanted.map(name => own[name])).toEqual(['segment-tick', 'toggle-on', 'toggle-off', 'virtual-key', 'long-press', 'confirm', 'reject',
      'gesture-start', 'gesture-end', 'context-click']);
  });

  it('asks in the same turn as the tick: it keeps pace with the picture, nothing waits for a promise first', () => {
    tick('light');
    expect(android).toHaveBeenCalledTimes(1);
    mockOs = 'ios';
    forgetTicks();
    tick('light');
    expect(MOCKS.impactAsync).toHaveBeenCalledTimes(1);
  });

  describe('a phone that does not have the constant (the module refuses what an older Android lacks)', () => {
    /** The system refuses these constants, as `HapticsNotSupportedException` does, and accepts every other. */
    const refuse = (...refused: string[]) => android.mockImplementation((constant: string) =>
      refused.includes(constant) ? Promise.reject(new Error('A haptics engine is not available on this device')) : Promise.resolve());

    it('a choice falls back from Segment_Tick to Context_Click, and stops there', async () => {
      refuse('segment-tick');
      tick('select');
      await flush();
      expect(calls().performAndroidHapticsAsync).toEqual([['segment-tick'], ['context-click']]);
      expect(calls().selectionAsync).toEqual([]);
    });

    it('a confirmed outcome falls back from Confirm to Virtual_Key, and stops there', async () => {
      refuse('confirm');
      tick('success');
      await flush();
      expect(calls().performAndroidHapticsAsync).toEqual([['confirm'], ['virtual-key']]);
      expect(calls().notificationAsync).toEqual([]);
    });

    it('a switch tries its own constant, then the choice tick, then the plain click (Toggle_On came with Android 14)', async () => {
      refuse('toggle-on', 'segment-tick');
      tick('toggleOn');
      await flush();
      expect(calls().performAndroidHapticsAsync).toEqual([['toggle-on'], ['segment-tick'], ['context-click']]);
      expect(calls().selectionAsync).toEqual([]);
    });

    it.each(IOS)('%s: when every constant is refused it plays what it played before this wrapper, the vibrator form %s(%j)', async (kind, name, args) => {
      android.mockImplementation(() => Promise.reject(new Error('refused')));
      tick(kind);
      await flush();
      expect(calls()[name]).toEqual([args]);
    });

    it('a package without the function, or a build whose JS is newer than its native half, plays the vibrator form', async () => {
      pkg.performAndroidHapticsAsync = undefined;
      try {
        tick('success');
        await flush();
        expect(calls().notificationAsync).toEqual([['success']]);
        // The native half is old: the call itself fails with "is not a function", which is one more refusal.
        pkg.performAndroidHapticsAsync = jest.fn(() => { throw new TypeError('ExpoHaptics.performHapticsAsync is not a function'); });
        forgetTicks();
        tick('error');
        await flush();
        expect(calls().notificationAsync).toEqual([['success'], ['error']]);
      } finally { pkg.performAndroidHapticsAsync = android; }
    });
  });
});

describe('a tick is never worth a crash or a lost tap', () => {
  /** A promise-like that rejects, and records that someone took the rejection: a fire-and-forget call would never be asked. */
  const rejecting = () => {
    const taken = jest.fn();
    return { taken, thenable: { then: (_resolve: unknown, reject: (error: Error) => void) => { taken(); reject(new Error('no haptics engine')); } } };
  };

  it.each(['ios', 'android'] as const)('%s: a rejected promise is taken, and a throw at the call is caught; nothing comes out of tick()', async platform => {
    mockOs = platform;
    const system = rejecting(), vibrator = rejecting();
    android.mockImplementation(() => system.thenable);
    for (const name of VIBRATOR) MOCKS[name].mockImplementation(() => vibrator.thenable);
    expect(() => tick('select')).not.toThrow();
    await flush();
    // Android's refusals are each taken, and then the vibrator form is tried and its refusal is taken too.
    expect(system.taken.mock.calls.length > 0).toBe(platform === 'android');
    expect(vibrator.taken).toHaveBeenCalledTimes(1);

    forgetTicks();
    for (const mock of Object.values(MOCKS)) mock.mockImplementation(() => { throw new Error('thrown at the call'); });
    expect(() => tick('error')).not.toThrow();
    await flush();
  });

  it.each(['ios', 'android'] as const)('%s: with no haptics function at all it is silence, not an error', async platform => {
    mockOs = platform;
    for (const name of NAMES) pkg[name] = undefined;
    const enums = pkg.AndroidHaptics;
    pkg.AndroidHaptics = undefined;
    try {
      for (const [kind] of IOS) { forgetTicks(); expect(() => tick(kind)).not.toThrow(); }
      await flush();
    } finally { for (const name of NAMES) pkg[name] = MOCKS[name]; pkg.AndroidHaptics = enums; }
    expect(played()).toBe(0);
  });

  it('is silence for a kind it does not know (a caller from plain JavaScript)', async () => {
    expect(() => tick('shake' as Tick)).not.toThrow();
    await flush();
    expect(played()).toBe(0);
  });
});

describe('two ticks closer than sys.motion.tickGap are one: "less is more"', () => {
  const at = (ms: number) => { now = 100_000 + ms; };

  it('the gap is 120 ms: a second tick of the same kind at 119 ms is dropped and at 120 ms it plays', async () => {
    expect(sys.motion.tickGap).toBe(120);
    tick('select'); at(119); tick('select'); await flush();
    expect(played()).toBe(1);
    at(120); tick('select'); await flush();
    expect(played()).toBe(2);
  });

  it('a lighter tick or an equal one right after a heavier one is dropped', async () => {
    tick('success'); at(10); tick('select'); at(20); tick('light'); at(30); tick('error'); await flush();
    expect(calls().notificationAsync).toEqual([['success']]);
    expect(played()).toBe(1);
  });

  it('a HEAVIER tick right after a lighter one plays: an outcome is never held back by the touch that caused it', async () => {
    tick('select'); at(10); tick('light'); at(20); tick('medium'); at(30); tick('success'); await flush();
    expect(calls().selectionAsync).toEqual([[]]);
    expect(calls().impactAsync).toEqual([['light'], ['medium']]);
    expect(calls().notificationAsync).toEqual([['success']]);
  });

  it('a dropped tick does not push the window on: the gap is counted from the last tick that PLAYED', async () => {
    tick('select'); at(100); tick('select'); at(130); tick('select'); await flush();
    expect(played()).toBe(2);
  });

  it('a clock that went backwards (the device\'s time was changed) is not "just now"', async () => {
    tick('select'); at(-60_000); tick('select'); await flush();
    expect(played()).toBe(2);
  });

  it('forgetTicks() lets the next tick through at once, for tests whose clocks do not share a past', async () => {
    tick('select'); forgetTicks(); tick('select'); await flush();
    expect(played()).toBe(2);
  });
});

describe('every tick in the app goes through this file', () => {
  const repo = join(__dirname, '../../../..');
  const sourceFiles = (dir: string): string[] => readdirSync(join(repo, dir), { withFileTypes: true }).flatMap(entry => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
  const read = (path: string) => readFileSync(join(repo, path), 'utf8');

  /**
   * TODAY'S direct callers of `expo-haptics` besides the wrapper: the outcome bar and the success mark tick the success tick
   * on their own, so on Android they still buzz as a vibrator waveform. They move onto `tick('success')` with their own items
   * (spec M-05 and the outcome bar's) and then lose their entry. A CEILING, not an equality: a file that has moved may go on
   * being listed here, so moving it never needs a change to this file; a file that is not listed and calls the package fails.
   */
  const DIRECT = new Set(['src/ui/system/haptics.ts', 'src/ui/system/Poruka.tsx', 'src/ui/system/SuccessMark.tsx']);

  it('no other file imports the haptics package: a new tick is `tick(kind)`, not a call of its own', () => {
    const callers = sourceFiles('src').filter(path => /['"]expo-haptics['"]/.test(read(path)));
    expect(callers.filter(path => !DIRECT.has(path)).map(path => `${path}: imports expo-haptics; use tick() from ui/system/haptics`)).toEqual([]);
    expect(callers).toContain('src/ui/system/haptics.ts');
    expect([...DIRECT].filter(path => !existsSync(join(repo, path)))).toEqual([]);
  });

  it('Press ticks through it, and does not know the package', () => {
    expect(read('src/ui/Press.tsx')).toMatch(/from '\.\/system\/haptics'/);
    expect(read('src/ui/Press.tsx')).not.toMatch(/expo-haptics/);
  });

  it('does not read the reduced-motion store: a tick is not movement, and a person who asked for less motion has not asked for less feedback (R5, R7)', () => {
    expect(read('src/ui/system/haptics.ts')).not.toMatch(/useReducedMotion|from '\.\/motion'|AccessibilityInfo/);
  });
});
