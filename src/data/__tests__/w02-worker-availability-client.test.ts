import { normalizeWorkerAvailability, sameWorkerAvailability, availabilityTimezone } from '../../lib/workerAvailability';
import { workerAvailabilityClientService } from '../workerAvailabilityClientService';

const A = '11111111-2222-4333-8444-555555555555';
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const P = '22222222-3333-4444-8555-666666666666';
const R = '33333333-4444-4555-8666-777777777777';
const W = '44444444-5555-4666-8777-888888888888';
const revision = 'a'.repeat(64);
let mockOwner: { user: { id: string } | null; accountRevision: number } = { user: { id: A }, accountRevision: 1 };
const mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockOwner }));
const input = () => ({ timezone: 'Europe/Belgrade', availableNow: false,
  rules: [{ id: R, weekdays: [1, 3, 5], startTime: '08:00:00', endTime: '18:00:00',
    startsOn: '2026-09-01', endsOn: null, label: 'Redovno', active: true }],
  windows: [{ id: W, startsAt: '2026-09-16T15:00:00+02:00', endsAt: '2026-09-16T16:00:00+02:00', state: 'UNAVAILABLE' as const, label: 'Privatno' }],
});
const document = () => ({ ...input(), accountId: A, profileId: P, revision });
const response = () => ({ saved: true, idempotentReplay: false, availability: document() });
const command = () => ({ expectedRevision: revision, value: input() });
beforeEach(() => { jest.clearAllMocks(); mockOwner = { user: { id: A }, accountRevision: 1 }; mockRpc.mockResolvedValue({ data: document(), error: null }); });
afterEach(() => jest.useRealTimers());

it('reads own authoritative sources with no user-selected owner', async () => {
  await expect(workerAvailabilityClientService.read()).resolves.toEqual({ ok: true, podatak: document() });
  expect(mockRpc.mock.calls).toEqual([['rpc_get_worker_availability', {}]]);
});
it('sends normalized copied state and the observed revision through the server command', async () => {
  mockRpc.mockResolvedValue({ data: response(), error: null });
  await expect(workerAvailabilityClientService.save(command())).resolves.toMatchObject({ ok: true, podatak: { saved: true, idempotentReplay: false } });
  expect(mockRpc.mock.calls).toEqual([['rpc_save_worker_availability', { p_expected_revision: revision, p_value: input() }]]);
});
it('accepts only matching saved state, including equivalent microsecond UTC offsets', async () => {
  const data = response(); data.availability.windows[0].startsAt = '2026-09-16T13:00:00.000000Z';
  data.availability.windows[0].endsAt = '2026-09-16T14:00:00Z'; data.idempotentReplay = true;
  mockRpc.mockResolvedValue({ data, error: null });
  await expect(workerAvailabilityClientService.save(command())).resolves.toMatchObject({ ok: true, podatak: { idempotentReplay: true } });
});
it('copies the input before async dispatch so subsequent editing cannot alter its receipt expectation', async () => {
  const value = command(); const result = workerAvailabilityClientService.save(value);
  value.value.rules[0].weekdays.push(6); value.value.availableNow = true;
  expect(mockRpc.mock.calls[0][1].p_value.rules[0].weekdays).toEqual([1, 3, 5]);
  await expect(result).resolves.toMatchObject({ ok: false }); // read document is not a save receipt
});
it.each([{}, { saved: false }, { idempotentReplay: undefined }, { availability: null }])('rejects malformed or missing save receipts %p', async patch => {
  mockRpc.mockResolvedValue({ data: Object.keys(patch).length ? { ...response(), ...patch } : {}, error: null });
  await expect(workerAvailabilityClientService.save(command())).resolves.toMatchObject({ ok: false, kod: 'WORKER_AVAILABILITY_INVALID_RESPONSE' });
});
it.each([{ availableNow: true }, { accountId: B }, { revision: '' }, { timezone: 'UTC' }, { rules: [] }, { windows: [] }])('does not claim save of a different material or account %p', async patch => {
  mockRpc.mockResolvedValue({ data: { ...response(), availability: { ...document(), ...patch } }, error: null });
  await expect(workerAvailabilityClientService.save(command())).resolves.toMatchObject({ ok: false, kod: 'WORKER_AVAILABILITY_INVALID_RESPONSE' });
});
it.each([{ accountId: B }, { profileId: 'bad' }, { revision: 7 }, { rules: null }, { availableNow: 'true' }, { timezone: 'No/Zone' }])('rejects invalid read projections %p', async patch => {
  mockRpc.mockResolvedValue({ data: { ...document(), ...patch }, error: null });
  await expect(workerAvailabilityClientService.read()).resolves.toMatchObject({ ok: false, kod: 'WORKER_AVAILABILITY_INVALID_RESPONSE' });
});
it.each(['read', 'save'] as const)('refuses signed-out %s without transport', async method => {
  mockOwner.user = null;
  const result = method === 'read' ? workerAvailabilityClientService.read() : workerAvailabilityClientService.save(command());
  await expect(result).resolves.toMatchObject({ ok: false, kod: 'AUTH_REQUIRED', poruka: 'Prijavite se da uredite dostupnost.' }); expect(mockRpc).not.toHaveBeenCalled();
});
it.each(['read', 'save'] as const)('discards %s after A→B→A without waiting for React', async method => {
  let resolve!: (value: unknown) => void; mockRpc.mockReturnValue(new Promise(done => { resolve = done; }));
  const result = method === 'read' ? workerAvailabilityClientService.read() : workerAvailabilityClientService.save(command());
  mockOwner = { user: { id: B }, accountRevision: 2 }; mockOwner = { user: { id: A }, accountRevision: 3 };
  resolve({ data: method === 'read' ? document() : response(), error: null });
  await expect(result).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvorite dostupnost.' });
});
it.each(['read', 'save'] as const)('bounds unanswered %s without replay or a fabricated result', async method => {
  jest.useFakeTimers(); mockRpc.mockReturnValue(new Promise(() => {}));
  const result = method === 'read' ? workerAvailabilityClientService.read() : workerAvailabilityClientService.save(command());
  await jest.advanceTimersByTimeAsync(15_001); await expect(result).resolves.toMatchObject({ ok: false }); expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('returns a useful version conflict rather than replaying over a newer schedule', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'AVAILABILITY_VERSION_CONFLICT', code: '40001' } });
  const result = await workerAvailabilityClientService.save(command());
  expect(result).toMatchObject({ ok: false, kod: 'AVAILABILITY_VERSION_CONFLICT' }); expect(mockRpc).toHaveBeenCalledTimes(1);
});
it.each(['constructor', '__proto__', 'secret=https://private/token'])('never exposes raw provider text %s', async message => {
  mockRpc.mockResolvedValue({ data: null, error: { message } });
  expect(JSON.stringify(await workerAvailabilityClientService.read())).not.toContain(message);
});
it.each([undefined, false, {}])('does not infer success from invalid error slot %p', async error => {
  mockRpc.mockResolvedValue({ data: document(), error });
  await expect(workerAvailabilityClientService.read()).resolves.toMatchObject({ ok: false });
});

it('normalizes time, weekday order and UUID case without changing the input', () => {
  const value = input(); value.rules[0].weekdays = [5, 1, 3]; value.rules[0].startTime = '08:00';
  value.rules[0].endTime = '24:00';
  const parsed = normalizeWorkerAvailability(value)!;
  expect(parsed.rules[0]).toMatchObject({ weekdays: [1, 3, 5], startTime: '08:00:00', endTime: '24:00:00' });
  expect(value.rules[0].weekdays).toEqual([5, 1, 3]);
});
it.each([null, {}, [], { ...input(), extra: true }, { ...input(), timezone: 'GMT+2' }, { ...input(), availableNow: 1 }])('rejects malformed input %p', value => {
  expect(normalizeWorkerAvailability(value)).toBeNull();
});
it.each([
  { weekdays: [] }, { weekdays: [1, 1] }, { weekdays: [7] }, { weekdays: ['1'] }, { weekdays: [1.5] },
  { startTime: '24:00' }, { endTime: '24:01' }, { endTime: '07:00' }, { startTime: '8:00' }, { startTime: '08:60' },
  { startsOn: '2026-02-30' }, { startsOn: '0000-01-01' }, { endsOn: '2025-09-01' }, { endsOn: undefined },
  { active: 'true' }, { label: 'x'.repeat(257) }, { profileId: B },
])('rejects a malformed weekly rule %p', patch => {
  expect(normalizeWorkerAvailability({ ...input(), rules: [{ ...input().rules[0], ...patch }] })).toBeNull();
});
it.each([
  { startsAt: '2026-02-30T12:00:00Z' }, { startsAt: '2026-09-16T15:00:00' }, { startsAt: 'infinity' },
  { startsAt: '2026-09-16T24:00:00Z' }, { startsAt: '2026-09-16T12:00:60Z' },
  { startsAt: '2026-09-16T12:00:00+16:00' }, { endsAt: '2026-09-16T15:00:00+02:00' },
  { state: 'AGREEMENT' }, { source: 'AGREEMENT' }, { id: 'bad' }, { label: null },
])('rejects an invalid personal window %p', patch => {
  expect(normalizeWorkerAvailability({ ...input(), windows: [{ ...input().windows[0], ...patch }] })).toBeNull();
});
it('keeps microsecond interval identity without rounding away a conflict boundary', () => {
  const value = input(); value.windows[0].startsAt = '2026-09-16T15:00:00.000001+02:00';
  const other = input(); other.windows[0].startsAt = '2026-09-16T13:00:00.000001Z';
  expect(sameWorkerAvailability(normalizeWorkerAvailability(value)!, normalizeWorkerAvailability(other)!)).toBe(true);
  other.windows[0].startsAt = '2026-09-16T13:00:00.000002Z';
  expect(sameWorkerAvailability(normalizeWorkerAvailability(value)!, normalizeWorkerAvailability(other)!)).toBe(false);
});
it.each(['rules', 'windows'] as const)('rejects duplicate %s identifiers', field => {
  const value = input();
  expect(normalizeWorkerAvailability({ ...value, [field]: [value[field][0], value[field][0]] })).toBeNull();
});
it('keeps operational bounds explicit', () => {
  expect(normalizeWorkerAvailability({ ...input(), rules: Array(129).fill(input().rules[0]) })).toBeNull();
  expect(normalizeWorkerAvailability({ ...input(), windows: Array(513).fill(input().windows[0]) })).toBeNull();
});
it('does not confuse separate IANA zones with a selected geocoding provider', () => {
  expect(availabilityTimezone('Europe/Belgrade')).toBe(true); expect(availabilityTimezone('UTC')).toBe(true);
  expect(availabilityTimezone('No/Zone')).toBe(false); expect(availabilityTimezone('CET')).toBe(false);
});


it.each([
  ['WORKER_PROFILE_REQUIRED', 'Najpre sačuvajte svoj radni profil.'],
  ['AVAILABILITY_INPUT_INVALID', 'Proverite unete podatke dostupnosti.'],
  ['AVAILABILITY_ITEM_INVALID', 'Proverite dane, datume i vremenske intervale.'],
  ['AVAILABILITY_TIMEZONE_INVALID', 'Izaberite ispravnu vremensku zonu.'],
  ['AVAILABILITY_INPUT_TOO_LARGE', 'Uneti raspored je prevelik. Sačuvajte manji broj pravila i izuzetaka.'],
  ['AVAILABILITY_VERSION_CONFLICT', 'Dostupnost je u međuvremenu promenjena. Učitajte novo stanje pre čuvanja.'],
])('uses formal actionable copy for %s without changing the code or retrying', async (code, message) => {
  mockRpc.mockResolvedValue({ data: null, error: { message: code, code: 'P0001' } });
  await expect(workerAvailabilityClientService.save(command())).resolves.toMatchObject({ ok: false, kod: code, poruka: message });
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
