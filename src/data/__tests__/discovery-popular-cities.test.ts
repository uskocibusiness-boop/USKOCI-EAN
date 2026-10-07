import { POPULAR_CITIES, cityStanding, foldPlace, placeMatches, placeParts } from '../../ui/v2/discovery/popularCities';
import { BLUR_DP, BLUR_INTENSITY, blurReductionFor, searchBackdropKind } from '../../ui/v2/discovery/SearchBackdrop';

/**
 * The cities offered in "Gde" besides the places that have tasks (owner, 2026-10-07: more cities, not only those with tasks).
 * The server's place filter matches the WHOLE public text of a place, so what a city can honestly say depends on how the
 * tasks name it. These are the four answers, and the typed search over all of them.
 */
describe('the popular cities', () => {
  test('are the sixteen the owner listed, in that order, as plain names', () => {
    expect(POPULAR_CITIES).toEqual(['Beograd', 'Novi Sad', 'Niš', 'Kragujevac', 'Subotica', 'Pančevo', 'Čačak', 'Kraljevo', 'Smederevo',
      'Šabac', 'Valjevo', 'Zrenjanin', 'Leskovac', 'Kruševac', 'Sombor', 'Požarevac']);
  });

  test('a place is found with or without its diacritics, in any case, by any part of its text', () => {
    expect(foldPlace('Niš')).toBe('nis');
    expect(foldPlace('Đakovica, Čačak')).toBe('dakovica cacak');
    expect(placeParts('Vračar, Beograd')).toEqual(['vracar', 'beograd']);
    expect(placeMatches('Niš', 'nis')).toBe(true);
    expect(placeMatches('Čačak', 'CAC')).toBe(true);
    expect(placeMatches('Vračar, Beograd', 'rac')).toBe(true);
    expect(placeMatches('Novi Sad', 'beo')).toBe(false);
    expect(placeMatches('Novi Sad', '')).toBe(true);
    expect(placeMatches('Novi Sad', '  ')).toBe(true);
  });

  describe('stand towards the tasks like this', () => {
    const rows = [{ text: 'Novi Sad', count: 4 }, { text: 'Vračar, Beograd', count: 3 }, { text: 'Zemun, Beograd', count: 2 }, { text: 'Nis', count: 1 }];

    test('tasks naming exactly the city make it an ordinary place (spelled as the tasks spell it)', () => {
      expect(cityStanding('Novi Sad', rows, true)).toEqual({ kind: 'place', text: 'Novi Sad', count: 4 });
      expect(cityStanding('Niš', rows, true)).toEqual({ kind: 'place', text: 'Nis', count: 1 });
    });

    test('tasks only under parts of the city lead to those parts, with the total when everything is known', () => {
      expect(cityStanding('Beograd', rows, true)).toEqual({ kind: 'parts', places: 2, count: 5 });
      // More places than were read: the total is not claimed.
      expect(cityStanding('Beograd', rows, false)).toEqual({ kind: 'parts', places: 2, count: null });
      // A part whose count is not known leaves the total unknown too.
      expect(cityStanding('Beograd', [{ text: 'Vračar, Beograd', count: null }], true)).toEqual({ kind: 'parts', places: 1, count: null });
    });

    test('a city no task names is "none" when every place is known, and "unknown" while more places are to be read', () => {
      expect(cityStanding('Subotica', rows, true)).toEqual({ kind: 'none' });
      expect(cityStanding('Subotica', rows, false)).toEqual({ kind: 'unknown' });
      expect(cityStanding('Subotica', [], true)).toEqual({ kind: 'none' });
    });

    test('a part is a whole part: "Bor" is not inside "Obrenovac"', () => {
      expect(cityStanding('Bor', [{ text: 'Obrenovac', count: 1 }], true)).toEqual({ kind: 'none' });
    });
  });
});

describe('what lies behind the search panel', () => {
  const kind = (patch: Partial<Parameters<typeof searchBackdropKind>[0]> = {}) => searchBackdropKind({ os: 'android', version: 36, hasTarget: true,
    reducedTransparency: false, ...patch });

  test('is blurred on Android 12 and newer (API 31), including Android 16, when there is a target to blur', () => {
    for (const version of [31, 33, 34, 35, 36]) expect([version, kind({ version })]).toEqual([version, 'blur']);
    expect(kind({ version: '34' })).toBe('blur');
  });

  test('is only dimmed on an older Android, without a target, with reduced transparency and on the web', () => {
    for (const version of [24, 28, 30]) expect([version, kind({ version })]).toEqual([version, 'dim']);
    expect(kind({ hasTarget: false })).toBe('dim');
    expect(kind({ reducedTransparency: true })).toBe('dim');
    expect(kind({ os: 'web' })).toBe('dim');
  });

  test('is blurred on iOS unless the person asked for less transparency', () => {
    expect(kind({ os: 'ios', version: '17.0', hasTarget: false })).toBe('blur');
    expect(kind({ os: 'ios', version: '17.0', reducedTransparency: true })).toBe('dim');
  });

  // The native blur takes its radius in pixels (intensity / reduction factor). At the factor of 4 that is 8.75 px, about
  // 2.5 dp on the owner's 560 dpi phone: invisible. The factor follows the density, so the blur is as large to the eye
  // (BLUR_DP) on every phone.
  test('is as soft in dp on every density: the reduction factor follows the screen', () => {
    for (const density of [1.5, 2, 2.75, 3.5, 4]) {
      const radiusPx = BLUR_INTENSITY / blurReductionFor(density);
      expect([density, Math.round(radiusPx / density)]).toEqual([density, BLUR_DP]);
    }
    // A density that is not a number falls back to a common one rather than to NaN.
    expect(blurReductionFor(Number.NaN)).toBe(blurReductionFor(2));
    expect(blurReductionFor(0)).toBe(blurReductionFor(2));
  });
});
