import { applicationRefusalGuidance, applicationSelectionClientService as client, conclusiveApplicationRefusal, readSelectedAgreement } from '../applicationSelectionClientService';
import { candidateClientService } from '../candidateClientService';
import type { IzborKomanda, PodnesiPrijavuKomanda } from '../ports';
const mockRpc = jest.fn();
const mockSingle = jest.fn(), mockEq = jest.fn(), mockSelect = jest.fn(), mockFrom = jest.fn();
const mockBuilder = { select: mockSelect, eq: mockEq, maybeSingle: mockSingle };
let mockAccount = { user: { id: '10000000-0000-4000-8000-000000000010' }, accountRevision: 1 };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc, from: mockFrom }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));
const need = '10000000-0000-4000-8000-000000000001', worker = '10000000-0000-4000-8000-000000000002';
const application = '10000000-0000-4000-8000-000000000003', agreement = '10000000-0000-4000-8000-000000000004';
const submit = (): PodnesiPrijavuKomanda => ({ potrebaId: need, potrebaRevizija: 3, radnikProfilId: worker, pokrivenaMesta: 2,
  cenaRsd: 4500, predlozeniPocetak: '2026-09-20T08:00:00.123456Z', predlozeniKraj: '2026-09-20T09:00:00.654321Z',
  napomena: 'Dolazimo zajedno.', clientRequestId: 'stable-application' });
const select = (): IzborKomanda => ({ potrebaId: need, potrebaRevizija: 3, prijavaId: application,
  prijavaVerzija: 2, prijavaHash: 'a'.repeat(64), mesta: 2, clientRequestId: 'stable-selection' });
const receipt = () => ({ responseId: application, applicationId: application, version: 2, needRevision: 3, contentHash: 'a'.repeat(64),
  status: 'SUBMITTED', pricingMode: 'OFFERS', coveredSlots: 2, snapshotSchema: 'APPLICATION_V1_SELF_DECLARED', authoritative: true, idempotentReplay: false });
beforeEach(() => { jest.clearAllMocks(); mockAccount = { user: { id: worker }, accountRevision: 1 };
  mockFrom.mockReturnValue(mockBuilder); mockSelect.mockReturnValue(mockBuilder); mockEq.mockReturnValue(mockBuilder);
});
it('sends the exact reviewed interval/key/Need revision and validates the canonical receipt', async () => {
  mockRpc.mockResolvedValue({ data: receipt(), error: null });
  await expect(client.podnesiPrijavu(submit())).resolves.toEqual({ ok: true, podatak: { prijavaId: application, verzija: 2, hash: 'a'.repeat(64) } });
  expect(mockRpc).toHaveBeenCalledWith('rpc_submit_response', { p_need_id: need, p_need_revision: 3, p_worker_profile_id: worker,
    p_covered_slots: 2, p_price_rsd: 4500, p_proposed_start_at: submit().predlozeniPocetak, p_proposed_end_at: submit().predlozeniKraj,
    p_scope_note: 'Dolazimo zajedno.', p_client_request_id: 'stable-application' });
});
it.each([{ authoritative: false }, { responseId: 'bad' }, { applicationId: agreement }, { needRevision: 4 }, { version: 2.5 },
  { contentHash: 'short' }, { coveredSlots: 1 }, { status: 'SELECTED' }, { snapshotSchema: 'LEGACY_UNPROVEN' }, { idempotentReplay: null }])(
  'rejects malformed/mismatched success %p', async delta => {
    mockRpc.mockResolvedValue({ data: { ...receipt(), ...delta }, error: null });
    expect(await client.podnesiPrijavu(submit())).toMatchObject({ ok: false, kod: 'APPLICATION_SELECTION_INVALID_RECEIPT' });
  });
it.each([{ cenaRsd: 1.2 }, { pokrivenaMesta: 0 }, { predlozeniKraj: null }, { predlozeniKraj: '2026-09-20T08:00:00.123455Z' },
  { predlozeniPocetak: '2026-02-30T08:00:00Z' }, { clientRequestId: 'short' }])('rejects invalid command before dispatch %p', async delta => {
  expect(await client.podnesiPrijavu({ ...submit(), ...delta })).toMatchObject({ ok: false, kod: 'APPLICATION_COMMAND_INVALID' });
  expect(mockRpc).not.toHaveBeenCalled();
});
it('keeps authored copy for an allowlisted message without treating message text alone as terminal refusal evidence', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'NEED_REMAINING_SEARCH_CLOSED', details: 'private trigger detail' } });
  const result = await client.podnesiPrijavu(submit());
  expect(result).toMatchObject({ ok: false, kod: 'NEED_REMAINING_SEARCH_CLOSED' });
  expect(conclusiveApplicationRefusal(result)).toBe(false);
  expect(JSON.stringify(result)).not.toContain('private trigger detail');
});
it('binds a worker eligibility refusal to exact SQLSTATE and allowlisted hard blockers, with authored guidance only', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'WORKER_NOT_ELIGIBLE',
    details: '["MISSING_REQUIRED_TOOL","CALENDAR_CONFLICT"]', hint: 'private hint' } });
  const result = await client.podnesiPrijavu(submit());
  expect(result).toMatchObject({ ok: false, kod: 'WORKER_NOT_ELIGIBLE', applicationRefusal: true,
    hardBlockers: ['MISSING_REQUIRED_TOOL', 'CALENDAR_CONFLICT'] });
  expect(conclusiveApplicationRefusal(result)).toBe(true);
  expect(applicationRefusalGuidance(result)).toEqual({
    messages: ['Radnom profilu nedostaje alat koji ovaj zadatak zahteva.', 'Termin se preklapa sa već potvrđenim Dogovorom.'],
    profile: true, calendar: true,
  });
  expect(JSON.stringify(result)).not.toContain('private hint');
});
it.each([
  ['wrong SQLSTATE', { code: '22023', message: 'WORKER_NOT_ELIGIBLE', details: '["MISSING_REQUIRED_TOOL"]' }],
  ['malformed blocker detail', { code: 'P0001', message: 'WORKER_NOT_ELIGIBLE', details: 'private worker detail' }],
  ['unknown blocker detail', { code: 'P0001', message: 'WORKER_NOT_ELIGIBLE', details: '["PRIVATE_NAME"]' }],
  ['reused key', { code: '22023', message: 'IDEMPOTENCY_KEY_REUSED', details: 'different command' }],
] as const)('does not certify %s as a terminal application refusal', async (_label, error) => {
  mockRpc.mockResolvedValueOnce({ data: null, error });
  const result = await client.podnesiPrijavu(submit());
  expect(result.ok).toBe(false);
  expect(conclusiveApplicationRefusal(result)).toBe(false);
  expect(JSON.stringify(result)).not.toContain('private worker detail');
  expect(JSON.stringify(result)).not.toContain('different command');
});
it('keeps flexible null/null distinct from an exact interval', async () => {
  mockRpc.mockResolvedValue({ data: receipt(), error: null });
  await client.podnesiPrijavu({ ...submit(), predlozeniPocetak: null, predlozeniKraj: null });
  expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_proposed_start_at: null, p_proposed_end_at: null });
});
it('selects exact application bytes and accepts only the server Agreement UUID', async () => {
  mockRpc.mockResolvedValue({ data: agreement, error: null });
  expect(await client.izaberiPrijavu(select())).toEqual({ ok: true, podatak: { dogovorId: agreement } });
  expect(mockRpc).toHaveBeenCalledWith('rpc_select_response', { p_need_id: need, p_need_revision: 3, p_response_id: application,
    p_response_version: 2, p_content_hash: 'a'.repeat(64), p_client_request_id: 'stable-selection' });
  mockRpc.mockResolvedValue({ data: { id: agreement, status: 'CONFIRMED' }, error: null });
  expect(await client.izaberiPrijavu(select())).toMatchObject({ ok: false });
});
it('keeps account ABA fenced after asynchronous receipt', async () => {
  let finish!: (value: unknown) => void;
  mockRpc.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const promise = client.izaberiPrijavu(select());
  mockAccount = { ...mockAccount, accountRevision: 3 };
  finish({ data: agreement, error: null });
  expect(await promise).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it('never replays a timed-out write automatically; explicit retry uses identical args', async () => {
  jest.useFakeTimers();
  try {
    mockRpc.mockReturnValueOnce(new Promise(() => {}));
    const promise = client.podnesiPrijavu(submit());
    await jest.advanceTimersByTimeAsync(15001);
    expect(await promise).toMatchObject({ ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    mockRpc.mockResolvedValue({ data: { ...receipt(), idempotentReplay: true }, error: null });
    expect(await client.podnesiPrijavu(submit())).toMatchObject({ ok: true });
    expect(mockRpc.mock.calls[0]).toEqual(mockRpc.mock.calls[1]);
  } finally { jest.useRealTimers(); }
});
it('shows allowlisted calendar conflict and never provider/database private details', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'WORKER_NO_LONGER_ELIGIBLE', details: '["PRIVATE","CALENDAR_CONFLICT"]' } });
  expect(await client.izaberiPrijavu(select())).toMatchObject({ ok: false, kod: 'WORKER_CALENDAR_CONFLICT' });
  mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'private address and token' } });
  const result = await client.izaberiPrijavu(select());
  expect(JSON.stringify(result)).not.toContain('private address'); expect(result).toMatchObject({ ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED' });
});
const candidate = () => ({ responseId: application, workerProfileId: worker, needRevision: 3, version: 2, contentHash: 'a'.repeat(64),
  state: 'SELECTABLE', canSelect: true, priceRsd: 4500, coveredSlots: 2, remainingSlots: 2, proposedStartAt: submit().predlozeniPocetak,
  proposedEndAt: submit().predlozeniKraj, scopeNote: 'Ponuda', publicProfile: { displayName: 'Milan' },
  applicationEvidence: { schema: 'APPLICATION_V1_SELF_DECLARED', teamCapacity: 2, skills: [], tools: [], licenses: [], vehicles: ['Kombi'] } });
it('candidate read retains exact end/start and Need revision while omitting raw private extras', async () => {
  mockRpc.mockResolvedValue({ data: [{ ...candidate(), privatePhone: 'private' }], error: null });
  const rows = await candidateClientService.prijaveZaPotrebu(need);
  expect(rows[0]).toMatchObject({ potrebaRevizija: 3, predlozeniPocetak: submit().predlozeniPocetak, predlozeniKraj: submit().predlozeniKraj });
  expect(JSON.stringify(rows)).not.toContain('privatePhone');
});
// Review r4 rk item 4: a count the read did not carry is unknown, never "0 završenih poslova".
it('says no count the read did not carry, and the server’s own count when it did', async () => {
  mockRpc.mockResolvedValue({ data: [candidate()], error: null });
  expect((await candidateClientService.prijaveZaPotrebu(need))[0]).toMatchObject({ ocenaTekst: '—', recenzijeTekst: '' });
  mockRpc.mockResolvedValue({ data: [{ ...candidate(), publicProfile: { displayName: 'Milan', trust: { completedCount: 0 } } }], error: null });
  expect((await candidateClientService.prijaveZaPotrebu(need))[0].recenzijeTekst).toBe('0 završenih zadataka');
  mockRpc.mockResolvedValue({ data: [{ ...candidate(), publicProfile: { displayName: 'Milan', trust: { ratingAverage: 4.8, reviewCount: 3, completedCount: 7 } } }], error: null });
  expect((await candidateClientService.prijaveZaPotrebu(need))[0]).toMatchObject({ ocenaTekst: '4,8', recenzijeTekst: '3 recenzije' });
});
it('keeps canonical current Need revision on STALE snapshot and selectable rows together', async () => {
  mockRpc.mockResolvedValue({ data: [
    { ...candidate(), responseId: agreement, version: 1, state: 'STALE', canSelect: false, needRevision: 3, responseNeedRevision: 2 },
    { ...candidate(), needRevision: 3, responseNeedRevision: 3 },
  ], error: null });
  const rows = await candidateClientService.prijaveZaPotrebu(need);
  expect(rows.map(row => ({ id: row.prijavaId, revision: row.potrebaRevizija, state: row.stanje, selectable: row.mozeIzabrati }))).toEqual([
    { id: agreement, revision: 3, state: 'STALE', selectable: false },
    { id: application, revision: 3, state: 'SELECTABLE', selectable: true },
  ]);
});
it.each([{ needRevision: null }, { proposedEndAt: null }, { proposedEndAt: '2026-09-20T07:00:00Z' }, { contentHash: 'bad' }])(
  'candidate malformed authority throws instead of false empty/safe-looking offer %p', async delta => {
    mockRpc.mockResolvedValue({ data: [{ ...candidate(), ...delta }], error: null });
    await expect(candidateClientService.prijaveZaPotrebu(need)).rejects.toThrow('Prijave trenutno');
  });
const link = () => ({ need_id: need, response_id: application, status: 'SELECTED', agreements: { id: agreement, need_id: need, selected_response_id: application } });
it('reads an exact selected application link through existing owner RLS and minimal columns', async () => {
  mockSingle.mockResolvedValue({ data: link(), error: null });
  expect(await readSelectedAgreement(need, application)).toEqual({ ok: true, podatak: { dogovorId: agreement } });
  expect(mockFrom).toHaveBeenCalledWith('need_selections'); expect(mockSelect).toHaveBeenCalledWith('need_id,response_id,status,agreements(id,need_id,selected_response_id)');
  expect(mockEq.mock.calls).toEqual([['need_id', need], ['response_id', application], ['status', 'SELECTED'], ['selected_by_account_id', worker]]);
  expect(mockRpc).not.toHaveBeenCalled();
});
it.each([null, { ...link(), agreements: null }, { ...link(), agreements: [] }])('does not invent an Agreement from missing visible link %p', async data => {
  mockSingle.mockResolvedValue({ data, error: null }); expect(await readSelectedAgreement(need, application)).toEqual({ ok: true, podatak: { dogovorId: null } });
});
it.each([{ ...link(), need_id: agreement }, { ...link(), response_id: agreement },
  { ...link(), status: 'CANCELLED' }, { ...link(), status: 'SUPERSEDED' },
  { ...link(), agreements: { ...link().agreements, selected_response_id: worker } },
  { ...link(), agreements: { id: agreement, need_id: application } }, { ...link(), agreements: [{ id: agreement, need_id: need }, { id: worker, need_id: need }] }])(
  'rejects mismatched or ambiguous joined link %p', async data => {
    mockSingle.mockResolvedValue({ data, error: null }); expect(await readSelectedAgreement(need, application)).toMatchObject({ ok: false, kod: 'SELECTION_LINK_INVALID' });
  });
it('fences late link across account incarnation and performs an actual read on retry', async () => {
  let finish!: (value: unknown) => void;
  mockSingle.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const first = readSelectedAgreement(need, application); mockAccount = { ...mockAccount, accountRevision: 3 };
  finish({ data: link(), error: null }); expect(await first).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  mockSingle.mockResolvedValueOnce({ data: null, error: null });
  expect(await readSelectedAgreement(need, application)).toEqual({ ok: true, podatak: { dogovorId: null } });
  expect(mockSingle).toHaveBeenCalledTimes(2);
});
