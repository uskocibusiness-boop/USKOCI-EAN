jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

let mockAccount: { user: { id: string } | null; accountRevision: number } = {
  user: { id: 'account-a' }, accountRevision: 1,
};
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));

import { workerCalendarClientService } from '../workerCalendarClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as { __testMocks: { mockRpc: jest.Mock } }).__testMocks;
const FROM = '2026-09-10T08:00:00+00:00';
const TO = '2026-09-17T08:00:00+00:00';
const EVENT = '11111111-2222-4333-8444-555555555555';
const AGREEMENT = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const event = (patch: Record<string, unknown> = {}) => ({
  eventId: EVENT,
  agreementId: AGREEMENT,
  agreementVersion: 2,
  startsAt: '2026-09-11T10:00:00+00:00',
  endsAt: '2026-09-11T12:00:00+00:00',
  agreementStatus: 'CONFIRMED',
  source: 'AGREEMENT',
  ...patch,
});
const range = (patch: Record<string, unknown> = {}) => ({
  from: FROM,
  to: TO,
  events: [event()],
  authoritative: true,
  ...patch,
});

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

beforeEach(() => {
  mockAccount = { user: { id: 'account-a' }, accountRevision: 1 };
  resetRpc({ data: range(), error: null });
});
afterEach(() => jest.useRealTimers());

describe('W02 worker calendar read', () => {
  it('reads only through the authoritative calendar RPC', async () => {
    await expect(workerCalendarClientService.readRange(FROM, TO)).resolves.toEqual({
      ok: true,
      podatak: range(),
    });
    expect(mockRpc.mock.calls).toEqual([['rpc_get_worker_calendar', { p_from: FROM, p_to: TO }]]);
  });

  it('accepts an empty authoritative calendar', async () => {
    resetRpc({ data: range({ events: [] }), error: null });
    await expect(workerCalendarClientService.readRange(FROM, TO)).resolves.toMatchObject({
      ok: true, podatak: { events: [], authoritative: true },
    });
  });

  it.each([
    ['', TO],
    [FROM, ''],
    [TO, FROM],
    [FROM, FROM],
    ['not-a-time', TO],
  ])('rejects an invalid range before transport: %s → %s', async (from, to) => {
    mockRpc.mockReset();
    await expect(workerCalendarClientService.readRange(from, to)).resolves.toMatchObject({
      ok: false, kod: 'CALENDAR_RANGE_INVALID',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('maps the server range error to product language', async () => {
    resetRpc({ data: null, error: { message: 'CALENDAR_RANGE_INVALID', code: '22023' } });
    const result = await workerCalendarClientService.readRange(FROM, TO);
    expect(result).toMatchObject({ ok: false, kod: 'CALENDAR_RANGE_INVALID' });
    if (!result.ok) { expect(result.poruka).not.toContain('CALENDAR_RANGE_INVALID'); expect(result.poruka).not.toMatch(/kalendar/i); }
  });

  it.each([
    { authoritative: false },
    { authoritative: undefined },
    { from: '2026-09-10T09:00:00+00:00' },
    { to: '2026-09-17T09:00:00+00:00' },
    { events: null },
  ])('fails closed on an invalid envelope: %p', async patch => {
    resetRpc({ data: range(patch), error: null });
    await expect(workerCalendarClientService.readRange(FROM, TO)).resolves.toMatchObject({
      ok: false, kod: 'WORKER_CALENDAR_INVALID_RESPONSE',
    });
  });

  it.each([
    { eventId: 'bad' },
    { agreementId: 'bad' },
    { agreementVersion: 0 },
    { agreementVersion: 1.5 },
    { startsAt: 'bad' },
    { endsAt: 'bad' },
    { startsAt: '2026-09-11T12:00:00+00:00', endsAt: '2026-09-11T10:00:00+00:00' },
    { agreementStatus: 'CANCELLED' },
    { source: 'MANUAL' },
    { startsAt: '2026-09-18T10:00:00+00:00', endsAt: '2026-09-18T12:00:00+00:00' },
  ])('fails closed on an invalid or out-of-range event: %p', async patch => {
    resetRpc({ data: range({ events: [event(patch)] }), error: null });
    await expect(workerCalendarClientService.readRange(FROM, TO)).resolves.toMatchObject({
      ok: false, kod: 'WORKER_CALENDAR_INVALID_RESPONSE',
    });
  });

  it('accepts back-to-back events and preserves server order', async () => {
    const first = event({ agreementId: '11111111-aaaa-4bbb-8ccc-111111111111', startsAt: '2026-09-11T10:00:00+00:00', endsAt: '2026-09-11T12:00:00+00:00' });
    const second = event({ eventId: '22222222-3333-4444-8555-666666666666', agreementId: '22222222-aaaa-4bbb-8ccc-222222222222', startsAt: '2026-09-11T12:00:00+00:00', endsAt: '2026-09-11T13:00:00+00:00' });
    resetRpc({ data: range({ events: [first, second] }), error: null });
    const result = await workerCalendarClientService.readRange(FROM, TO);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.podatak.events.map(item => item.agreementId)).toEqual([first.agreementId, second.agreementId]);
  });

  it('rejects a server list whose starts are not ordered', async () => {
    const later = event({ agreementId: '11111111-aaaa-4bbb-8ccc-111111111111', startsAt: '2026-09-12T10:00:00+00:00', endsAt: '2026-09-12T12:00:00+00:00' });
    const earlier = event({ eventId: '22222222-3333-4444-8555-666666666666', agreementId: '22222222-aaaa-4bbb-8ccc-222222222222' });
    resetRpc({ data: range({ events: [later, earlier] }), error: null });
    await expect(workerCalendarClientService.readRange(FROM, TO)).resolves.toMatchObject({
      ok: false, kod: 'WORKER_CALENDAR_INVALID_RESPONSE',
    });
  });
});

describe('W02 account-safe receipt boundary', () => {
  it('rejects signed-out reads before transport', async () => {
    mockAccount = { user: null, accountRevision: 2 };
    mockRpc.mockReset();
    // The product word is "Raspored", never "kalendar".
    await expect(workerCalendarClientService.readRange(FROM, TO)).resolves.toMatchObject({
      ok: false, kod: 'AUTH_REQUIRED', poruka: 'Prijavi se da otvoriš svoj Raspored.',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('discards an A→B→A late response', async () => {
    let resolve!: (value: unknown) => void;
    mockRpc.mockReset();
    mockRpc.mockReturnValue(new Promise(done => { resolve = done; }));
    const result = workerCalendarClientService.readRange(FROM, TO);
    mockAccount = { user: { id: 'account-b' }, accountRevision: 2 };
    mockAccount = { user: { id: 'account-a' }, accountRevision: 3 };
    resolve({ data: range(), error: null });
    await expect(result).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvori Raspored.' });
  });

  it('accepts the same account across token refresh', async () => {
    let resolve!: (value: unknown) => void;
    mockRpc.mockReset();
    mockRpc.mockReturnValue(new Promise(done => { resolve = done; }));
    const result = workerCalendarClientService.readRange(FROM, TO);
    mockAccount = { user: { id: 'account-a' }, accountRevision: 1 };
    resolve({ data: range(), error: null });
    await expect(result).resolves.toMatchObject({ ok: true });
  });

  it('bounds an unanswered read without replay', async () => {
    jest.useFakeTimers();
    mockRpc.mockReset();
    mockRpc.mockReturnValue(new Promise(() => {}));
    const result = workerCalendarClientService.readRange(FROM, TO);
    await jest.advanceTimersByTimeAsync(15_001);
    await expect(result).resolves.toMatchObject({ ok: false, kod: 'WORKER_CALENDAR_READ_FAILED' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it.each(['private-token=https://private', 'constructor', 'toString', '__proto__'])('sanitizes arbitrary provider errors: %s', async message => {
    resetRpc({ data: null, error: { message, code: 'private-code' } });
    const result = await workerCalendarClientService.readRange(FROM, TO);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(message);
    expect(JSON.stringify(result)).not.toContain('private-code');
  });
});

it.each([
  [event(), event()],
  [event(), event({ eventId: '22222222-3333-4444-8555-666666666666' })],
  [event(), event({ agreementId: AGREEMENT.toUpperCase(), eventId: '22222222-3333-4444-8555-666666666666' })],
].map(events => [events]))('rejects duplicate event or Agreement identity instead of double-counting occupancy', async events => {
  resetRpc({ data: range({ events }), error: null });
  await expect(workerCalendarClientService.readRange(FROM, TO)).resolves.toMatchObject({
    ok: false, kod: 'WORKER_CALENDAR_INVALID_RESPONSE',
  });
});

it.each(['2026-02-30T10:00:00Z', '2026-02-29T10:00:00Z', '2026-09-10T24:00:00Z'])('refuses normalized nonexistent or ambiguous dates before transport: %s', async from => {
  mockRpc.mockReset();
  await expect(workerCalendarClientService.readRange(from, TO)).resolves.toMatchObject({ ok: false, kod: 'CALENDAR_RANGE_INVALID' });
  expect(mockRpc).not.toHaveBeenCalled();
});

it('preserves valid PostgreSQL microsecond intervals instead of rounding them to an empty interval', async () => {
  const from = '2026-09-11T10:00:00.000001Z';
  const to = '2026-09-11T10:00:00.000003Z';
  resetRpc({ data: range({ from, to, events: [event({ startsAt: from, endsAt: '2026-09-11T10:00:00.000002Z' })] }), error: null });
  await expect(workerCalendarClientService.readRange(from, to)).resolves.toMatchObject({ ok: true });
});
