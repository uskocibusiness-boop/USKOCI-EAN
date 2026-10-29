/** @jest-environment node */
import { readOwnedResult } from '../serverReceipt';

const accountId = '11111111-1111-4111-8111-111111111111';
let mockRevision = 4;
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: accountId }, accountRevision: mockRevision }) }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
const base = { account: { accountId, accountRevision: 4 }, errors: {}, fallback: 'UNCONFIRMED', invalid: 'INVALID' };
beforeEach(() => { mockRevision = 4; jest.useFakeTimers(); });
afterEach(() => jest.useRealTimers());

it('keeps the ordinary 15s bound and aborts a timed-out request without decoding a late ACK or replaying', async () => {
  let finish!: (value: unknown) => void;
  const request = jest.fn((_signal: AbortSignal) => new Promise(resolve => { finish = resolve; }));
  const decode = jest.fn((value: unknown) => value);
  const pending = readOwnedResult({ ...base, write: true, request, decode });
  let settled = false; void pending.then(() => { settled = true; });
  await jest.advanceTimersByTimeAsync(14_999);
  expect(settled).toBe(false);
  expect(request.mock.calls[0][0].aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(1);
  expect(await pending).toMatchObject({ ok: false, kod: 'UNCONFIRMED' });
  expect(request.mock.calls[0][0].aborted).toBe(true);
  finish({ data: { saved: true }, error: null }); await Promise.resolve();
  expect(decode).not.toHaveBeenCalled(); expect(request).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it('caller abort settles a non-cooperative write, keeps it unconfirmed, and removes its listener and timer', async () => {
  const caller = new AbortController(); const removed = jest.spyOn(caller.signal, 'removeEventListener');
  const request = jest.fn((_signal: AbortSignal) => new Promise(() => {}));
  const pending = readOwnedResult({ ...base, write: true, signal: caller.signal, request, decode: () => null });
  await Promise.resolve();
  caller.abort();
  expect(await pending).toMatchObject({ ok: false, kod: 'UNCONFIRMED' });
  expect(request.mock.calls[0][0].aborted).toBe(true);
  expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(jest.getTimerCount()).toBe(0);
});

it('a pre-aborted caller never dispatches', async () => {
  const caller = new AbortController(); caller.abort(); const request = jest.fn();
  expect(await readOwnedResult({ ...base, signal: caller.signal, request, decode: () => null })).toMatchObject({ ok: false, kod: 'UNCONFIRMED' });
  expect(request).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});

it('preserves synchronous request start before returning the owned promise', async () => {
  const caller = new AbortController(); const request = jest.fn(() => new Promise(() => {}));
  const pending = readOwnedResult({ ...base, signal: caller.signal, request, decode: () => null });
  expect(request).toHaveBeenCalledTimes(1);
  caller.abort();
  expect(await pending).toMatchObject({ ok: false, kod: 'UNCONFIRMED' });
  expect(jest.getTimerCount()).toBe(0);
});

it('an already changed account incarnation prevents dispatch', async () => {
  const request = jest.fn();
  mockRevision = 5;
  const pending = readOwnedResult({ ...base, request, decode: () => null });
  expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(request).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});

it('synchronous abort followed by a throwing request is contained without an unhandled cancellation', async () => {
  const caller = new AbortController(); const decode = jest.fn();
  const request = jest.fn((_signal: AbortSignal) => { caller.abort(); throw new Error('PRIVATE_TRANSPORT_DETAIL'); });
  expect(await readOwnedResult({ ...base, write: true, signal: caller.signal, request, decode })).toMatchObject({ ok: false, kod: 'UNCONFIRMED' });
  await jest.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledTimes(1); expect(request.mock.calls[0][0].aborted).toBe(true);
  expect(decode).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});

it('retains the same-account incarnation fence after cancellation', async () => {
  const caller = new AbortController(); const decode = jest.fn();
  const pending = readOwnedResult({ ...base, signal: caller.signal, request: () => new Promise(() => {}), decode });
  mockRevision = 5; caller.abort();
  expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(decode).not.toHaveBeenCalled();
});

it('accepts a valid success once and leaves no timer or caller abort listener behind', async () => {
  const caller = new AbortController(); const request = jest.fn(async (_signal: AbortSignal) => ({ data: 42, error: null }));
  const decode = jest.fn((raw: unknown) => raw === 42 ? 42 : null);
  expect(await readOwnedResult({ ...base, signal: caller.signal, request, decode })).toEqual({ ok: true, podatak: 42 });
  caller.abort(); await jest.advanceTimersByTimeAsync(60_000);
  expect(request.mock.calls[0][0].aborted).toBe(false);
  expect(decode).toHaveBeenCalledTimes(1); expect(request).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it('keeps explicit caller cancellation distinct from the opt-in read transport timeout code', async () => {
  const caller = new AbortController();
  const options = { ...base, readTransportUnavailable: 'READ_TRANSPORT_UNAVAILABLE', request: () => new Promise(() => {}), decode: () => null };
  const cancelled = readOwnedResult({ ...options, signal: caller.signal }); caller.abort();
  expect(await cancelled).toMatchObject({ ok: false, kod: 'UNCONFIRMED' });
  const expired = readOwnedResult(options); await jest.advanceTimersByTimeAsync(15_000);
  expect(await expired).toMatchObject({ ok: false, kod: 'READ_TRANSPORT_UNAVAILABLE' });
});
