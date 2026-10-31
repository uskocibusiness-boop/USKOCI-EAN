import { readApplicationCommandState } from '../myApplicationsClientService';

const mockSingle = jest.fn(), mockEq = jest.fn(), mockSelect = jest.fn(), mockFrom = jest.fn();
const mockBuilder = { select: mockSelect, eq: mockEq, maybeSingle: mockSingle };
const owner = '10000000-0000-4000-8000-000000000010';
const subject = { prijavaId: '10000000-0000-4000-8000-000000000001',
  potrebaId: '10000000-0000-4000-8000-000000000002', prijavaVerzija: 2 };
let mockAccount: { user: { id: string } | null; accountRevision: number } = { user: { id: owner }, accountRevision: 1 };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ from: mockFrom }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));
const raw = () => ({ id: subject.prijavaId, need_id: subject.potrebaId, worker_account_id: owner,
  current_version: 3, submitted_against_need_revision: 4, status: 'SUBMITTED', price_rsd: 4500, covered_slots: 2,
  scope_note: 'Sa trakama.', proposed_start_at: '2026-09-20T10:00:00.123456Z', proposed_end_at: '2026-09-20T11:00:00.654321Z' });
const response = (patch = {}) => ({ data: { ...raw(), ...patch }, error: null });
beforeEach(() => {
  jest.resetAllMocks(); mockAccount = { user: { id: owner }, accountRevision: 1 };
  mockFrom.mockReturnValue(mockBuilder); mockSelect.mockReturnValue(mockBuilder); mockEq.mockReturnValue(mockBuilder);
  mockSingle.mockResolvedValue(response());
});
afterEach(() => jest.useRealTimers());

it('reads only the exact own command subject; does not join a possibly hidden task or pin the old version', async () => {
  await expect(readApplicationCommandState(subject)).resolves.toEqual({ ok: true, podatak: {
    applicationId: subject.prijavaId, needId: subject.potrebaId, version: 3, submittedNeedRevision: 4,
    status: 'SUBMITTED', priceRsd: 4500, coveredSlots: 2, scopeNote: 'Sa trakama.',
    proposedStartAt: raw().proposed_start_at, proposedEndAt: raw().proposed_end_at,
  } });
  expect(mockFrom).toHaveBeenCalledWith('marketplace_responses');
  expect(mockEq.mock.calls).toEqual([['id', subject.prijavaId], ['need_id', subject.potrebaId], ['worker_account_id', owner]]);
  expect(mockSelect.mock.calls[0][0]).not.toMatch(/needs|account_profiles|exact_lat|contact|phone|\*/);
});
it.each([
  ['another owner', { worker_account_id: subject.prijavaId }],
  ['another application', { id: subject.potrebaId }], ['another task', { need_id: subject.prijavaId }],
  ['older version', { current_version: 1 }], ['missing submitted revision', { submitted_against_need_revision: undefined }],
  ['unknown status', { status: 'MADE_UP' }], ['draft instead of submitted subject', { status: 'DRAFT' }],
  ['missing offer', { price_rsd: undefined }], ['fractional people', { covered_slots: 1.5 }],
  ['missing note', { scope_note: undefined }], ['missing time', { proposed_start_at: undefined }],
  ['half an interval', { proposed_end_at: null }], ['invalid calendar date', { proposed_start_at: '2026-02-30T10:00:00Z' }],
  ['reversed by a microsecond', { proposed_start_at: '2026-09-20T11:00:00.654322Z' }],
])('never admits %s as a completed owned read', async (_name, patch) => {
  mockSingle.mockResolvedValue(response(patch));
  await expect(readApplicationCommandState(subject)).resolves.toMatchObject({ ok: false, kod: 'APPLICATION_STATE_INVALID' });
});
it('retains exact microseconds, nullable stored intervals and the projection convention for a null note', async () => {
  mockSingle.mockResolvedValue(response({ proposed_start_at: '2026-09-20T10:00:00.000001Z', proposed_end_at: '2026-09-20T10:00:00.000002Z' }));
  await expect(readApplicationCommandState(subject)).resolves.toMatchObject({ ok: true, podatak: { proposedStartAt: '2026-09-20T10:00:00.000001Z' } });
  mockSingle.mockResolvedValue(response({ proposed_start_at: null, proposed_end_at: null, scope_note: null }));
  await expect(readApplicationCommandState(subject)).resolves.toMatchObject({ ok: true, podatak: { proposedStartAt: null, proposedEndAt: null, scopeNote: '' } });
});
it('does not fabricate a withdrawal or allow recovery from an absent/closed-account row or raw database error', async () => {
  mockSingle.mockResolvedValueOnce({ data: null, error: null });
  await expect(readApplicationCommandState(subject)).resolves.toMatchObject({ ok: false });
  mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'private backend account text' } });
  const result = await readApplicationCommandState(subject);
  expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain('private backend');
});
it('does not query when logged out or given a malformed subject', async () => {
  await expect(readApplicationCommandState({ ...subject, prijavaId: 'invalid' })).resolves.toMatchObject({ ok: false });
  mockAccount = { user: null, accountRevision: 2 };
  await expect(readApplicationCommandState(subject)).resolves.toMatchObject({ ok: false });
  expect(mockFrom).not.toHaveBeenCalled();
});
it('rejects a late response after A→B→A, even if the subject still belongs to A', async () => {
  let finish!: (value: unknown) => void;
  mockSingle.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const read = readApplicationCommandState(subject);
  mockAccount = { user: { id: owner }, accountRevision: 3 }; finish(response());
  await expect(read).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it('bounds an unanswered named read and does not treat a late withdrawal as its result', async () => {
  jest.useFakeTimers(); let finish!: (value: unknown) => void;
  mockSingle.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const read = readApplicationCommandState(subject); jest.advanceTimersByTime(15001);
  await expect(read).resolves.toMatchObject({ ok: false, kod: 'APPLICATION_STATE_UNAVAILABLE' });
  finish(response({ status: 'WITHDRAWN' }));
  await expect(read).resolves.toMatchObject({ ok: false }); expect(jest.getTimerCount()).toBe(0);
});

it('reads the persisted price unit independently of current task facts and refuses unsupported units', async () => {
  mockSingle.mockResolvedValue(response({ price_basis: 'HOURLY', price_rsd: 1200 }));
  expect(await readApplicationCommandState(subject)).toMatchObject({ ok: true, podatak: { priceBasis: 'HOURLY', priceRsd: 1200 } });
  expect(mockSelect.mock.calls[0][0]).toContain('price_basis');
  mockSingle.mockResolvedValue(response({ price_basis: 'PER_PERSON' }));
  expect(await readApplicationCommandState(subject)).toMatchObject({ ok: false });
});
