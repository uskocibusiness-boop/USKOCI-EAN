import { composeHome, readHomeOptional, readHomeSection } from '../homeSnapshot';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('does not start an already retired section', async () => {
  const abort = new AbortController(); abort.abort();
  const read = jest.fn();
  expect(await readHomeSection(read, abort.signal)).toEqual({ kind: 'unavailable' });
  expect(read).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});
it.each(['focus', 'timeout'])('settles a stalled read on %s and retires its transport', async reason => {
  const abort = new AbortController();
  let transport!: AbortSignal;
  const read = readHomeSection(signal => { transport = signal; return new Promise(() => {}); }, abort.signal);
  if (reason === 'focus') abort.abort(); else jest.advanceTimersByTime(15_000);
  expect(await read).toEqual({ kind: 'unavailable' });
  expect(transport.aborted).toBe(true); expect(jest.getTimerCount()).toBe(0);
});
it('an optional retired read fails so its resource can preserve the prior successful value', async () => {
  const abort = new AbortController();
  const read = readHomeOptional(() => new Promise(() => {}), abort.signal);
  const failed = expect(read).rejects.toThrow('HOME_OPTIONAL_READ_FAILED');
  abort.abort(); await failed; expect(jest.getTimerCount()).toBe(0);
});
it('preserves a successful value and releases its deadline', async () => {
  expect(await readHomeSection(async () => ['one'])).toEqual({ kind: 'known', value: ['one'] });
  expect(jest.getTimerCount()).toBe(0);
});
it('uses historical application totals for first-run detection even without any application rows', () => {
  const counts = { total: 1500, attention: 0, active: 0, finished: 1500 };
  const home = composeHome({ needs: { kind: 'known', value: [] }, applications: { kind: 'known', value: counts },
    agreements: { kind: 'known', value: [] } }, { kind: 'known', value: { rows: [], more: 0, asOf: '2026-10-18T10:00:00Z' } });
  expect(home.mine.applications).toEqual({ kind: 'known', value: counts });
  expect(home.firstRun).toBe(false); expect(home.partial).toBe(false);
});
