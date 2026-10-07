/**
 * PKG-007 / GAP-0033 — requester completion confirmation receipt.
 *
 * The production composition spreads supabaseIzvor before agreementClientService
 * (src/data/index.ts), so this binds to whichever adapter physically owns
 * potvrdiZavrsetak. A void ACK, a foreign Agreement or a non-terminal state must
 * never read as completion; the already-completed replay is the same outcome.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const ID = '20000000-0000-4000-8000-000000000001';
let mockAccount = A, mockRevision = 1;
const mockRpc = jest.fn(), mockFrom = jest.fn(), mockGetUser = jest.fn();
jest.mock('../supabaseClient', () => ({
  supabaseKonfigurisan: () => true,
  supabaseKlijent: () => ({ rpc: mockRpc, from: mockFrom, auth: { getUser: mockGetUser } }),
}));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }) }));

import { supabaseIzvor } from '../supabaseIzvor';
import { agreementClientService } from '../agreementClientService';

const production = { ...supabaseIzvor, ...agreementClientService } as { potvrdiZavrsetak: (id: string) => Promise<any> };
const confirm = (id: string) => production.potvrdiZavrsetak(id);
const ok = (data: unknown) => ({ data, error: null });
const receipt = { agreementId: ID, state: 'COMPLETED', completedAt: '2026-09-16T10:00:00.123456+00:00',
  needCompleted: false, problemWasPreviouslyReported: false, idempotentReplay: false, authoritative: true };
const { authoritative: _dropped, ...withoutAuthority } = receipt;

beforeEach(() => { mockRpc.mockReset(); mockFrom.mockReset(); mockGetUser.mockReset(); mockAccount = A; mockRevision = 1; });

describe('PKG-007 — requester confirmation receipt', () => {
  it('sends the exact RPC and accepts the original authoritative COMPLETED receipt', async () => {
    mockRpc.mockResolvedValue(ok(receipt));
    expect(await confirm(ID)).toEqual({ ok: true, podatak: { zavrsenoIso: receipt.completedAt, ponovljeno: false } });
    expect(mockRpc.mock.calls).toEqual([['rpc_confirm_completion', { p_agreement_id: ID }]]);
  });
  it('accepts the already-completed replay as the same terminal outcome', async () => {
    mockRpc.mockResolvedValue(ok({ agreementId: ID, state: 'COMPLETED', completedAt: '2026-09-16T10:00:00Z', idempotentReplay: true, authoritative: true }));
    expect(await confirm(ID)).toEqual({ ok: true, podatak: { zavrsenoIso: '2026-09-16T10:00:00Z', ponovljeno: true } });
  });
  it.each([
    ['void legacy ACK', null],
    ['scalar', 'COMPLETED'],
    ['empty object', {}],
    ['foreign Agreement', { ...receipt, agreementId: B }],
    ['non-terminal state', { ...receipt, state: 'AWAITING_REQUESTER' }],
    ['cancelled state', { ...receipt, state: 'CANCELLED' }],
    ['missing instant', { ...receipt, completedAt: null }],
    ['unreadable instant', { ...receipt, completedAt: 'juče' }],
    ['non-boolean replay flag', { ...receipt, idempotentReplay: 'false' }],
    ['non-authoritative', { ...receipt, authoritative: false }],
    ['missing authority', withoutAuthority],
  ])('rejects a %s receipt without claiming completion', async (_label, data) => {
    mockRpc.mockResolvedValue(ok(data));
    const result = await confirm(ID);
    expect(result).toMatchObject({ ok: false, kod: 'COMPLETION_RECEIPT_INVALID' });
    expect(result.poruka).not.toContain('AWAITING');
  });
  it.each([
    ['AGREEMENT_CHANGE_PENDING', 'Najpre odgovori na postojeći predlog izmene.'],
    ['COMPLETION_NOT_CONFIRMABLE', 'Dogovor trenutno nije u stanju za potvrdu završetka. Osveži njegov status.'],
    ['ONLY_REQUESTER_CAN_CONFIRM_COMPLETION', 'Završetak potvrđuje osoba koja je objavila zadatak.'],
    ['AGREEMENT_CANCELLED', 'Dogovor je otkazan. Završetak više nije moguć.'],
    ['EXECUTION_VERSION_MISMATCH', 'Dogovor je promenjen. Osveži važeće uslove pre završetka.'],
  ])('maps the known server denial %s to its own copy without leaking details', async (name, copy) => {
    mockRpc.mockResolvedValue({ data: null, error: { message: name, details: 'private detail', hint: 'http://internal', code: 'P0001' } });
    expect(await confirm(ID)).toEqual({ ok: false, kod: name, poruka: copy });
  });
  it('does not turn an unknown failure into a public message or a completion', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'SQLSTATE P0001 http://internal/detail', code: 'P0001' } });
    const result = await confirm(ID);
    expect(result).toMatchObject({ ok: false, kod: 'COMPLETION_UNCONFIRMED' });
    expect(result.poruka).not.toContain('http');
    expect(result.poruka).not.toContain('P0001');
  });
  it('treats a thrown transport error as unconfirmed, never as completed', async () => {
    mockRpc.mockRejectedValue(new Error('offline'));
    expect(await confirm(ID)).toMatchObject({ ok: false, kod: 'COMPLETION_UNCONFIRMED' });
  });
  it('refuses an invalid Agreement id before any RPC', async () => {
    expect(await confirm('agr-1')).toMatchObject({ ok: false, kod: 'COMPLETION_COMMAND_INVALID' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it('denies a receipt that arrives after the account changed', async () => {
    mockRpc.mockImplementation(async () => { mockAccount = B; return ok(receipt); });
    expect(await confirm(ID)).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  });
  it('has one physical production owner for the confirmation adapter', () => {
    const dataDir = join(__dirname, '..');
    const baseline = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');
    const canonical = readFileSync(join(dataDir, 'agreementClientService.ts'), 'utf8');
    const authority = readFileSync(join(dataDir, 'productionAuthorityOverrides.ts'), 'utf8');
    expect(baseline).not.toContain('async potvrdiZavrsetak(');
    expect(baseline).not.toContain("rpc('rpc_confirm_completion'");
    expect(baseline).toContain("'potvrdiZavrsetak'");
    expect(authority).not.toContain('potvrdiZavrsetak');
    expect(canonical).toContain('async potvrdiZavrsetak(');
    expect(canonical).toContain("supabase.rpc('rpc_confirm_completion'");
  });
});
