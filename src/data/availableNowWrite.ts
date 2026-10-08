/**
 * "Mogu odmah": the one way the switch is saved, from Početna and from Radni profil alike (the two screens carried the same code
 * twice; found in the phone round of 8 Oct 2026). The saved week is read first and written back with only `availableNow` changed,
 * against the revision it was read at, exactly as the Dostupnost screen saves it (R06). The data client is loaded when the switch
 * is touched, not with the screen: the screens' suites and their first paint never load it.
 *
 * Returns the value the server kept, or null when the read or the save did not go through (a throw counts as null, never as a
 * change): the caller shows "failed" and keeps the last known value. `bound` lets a screen cap each call (Radni profil does).
 */
export async function writeAvailableNow(value: boolean, bound: <T>(call: () => Promise<T>) => Promise<T> = call => call()): Promise<boolean | null> {
  try {
    const { workerAvailabilityClientService: availability } = require('./workerAvailabilityClientService') as typeof import('./workerAvailabilityClientService');
    const read = await bound(() => availability.read());
    if (!read.ok) return null;
    const { timezone, rules, windows, revision } = read.podatak;
    const result = await bound(() => availability.save({ expectedRevision: revision, value: { timezone, availableNow: value, rules, windows } }));
    return result.ok ? result.podatak.availability.availableNow : null;
  } catch { return null; }
}
