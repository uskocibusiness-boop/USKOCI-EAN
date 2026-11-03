/** Existing contact RPC remains the sole production reveal owner; W02 adds strict private receipts. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const mockRpc = jest.fn(), mockSelect = jest.fn();
let mockSession = { user: { id: '22222222-2222-4222-8222-222222222222' }, accountRevision: 1 };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc,
  from: (table: string) => ({ select: (columns: string) => ({ eq: () => ({ eq: () => ({ limit: () => mockSelect(table, columns) }) }) }) }) }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
import { contactClientService } from '../contactClientService';
const agreementId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', needId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ownerId = '11111111-1111-4111-8111-111111111111', workerId = '22222222-2222-4222-8222-222222222222';
const grantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const at = '2026-09-10T12:00:00+00:00';
const pin = { slot: 'start', latitudeE6: 0, longitudeE6: 0, origin: { kind: 'MANUAL_PIN' }, address: 'PRIVATE STOP', accessNotes: 'PRIVATE BELL' };
const envelope = () => ({ value: { version: 1, binding: { taskCountryCode: 'RS', geography: { mode: 'STATIONARY', start: { city: 'Novi Sad' } }, exactAddress: null }, points: [pin] }, confirmedByAccountId: ownerId, confirmedAt: at });
const receipt = () => ({ authoritative: true, channel: 'EXACT_LOCATION', agreementId, needId, needRevision: 2, ownerAccountId: ownerId,
  grantId, grantedAt: at, expiresAt: null, exactAddress: '', accessNotes: null, exactLat: 0, exactLng: 0, resolvedLocation: envelope() });
const grant = () => ({ id: grantId, agreement_id: agreementId, channel: 'EXACT_LOCATION', granted_by_account_id: ownerId,
  granted_to_account_id: workerId, status: 'GRANTED', granted_at: at, expires_at: null });
beforeEach(() => { mockRpc.mockReset(); mockSelect.mockReset(); mockSession = { user: { id: workerId }, accountRevision: 1 }; });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }

describe('canonical private location contract', () => {
  it('has one physical production reveal owner and no exact data in Agreement projection', () => {
    const dir = join(__dirname, '..');
    const baseline = readFileSync(join(dir, 'supabaseIzvor.ts'), 'utf8');
    expect(baseline).not.toContain('async otkrijTacnuLokaciju('); expect(baseline).toContain("'otkrijTacnuLokaciju'");
    const source = readFileSync(join(dir, 'contactClientService.ts'), 'utf8');
    expect(source).toContain('async otkrijTacnuLokaciju('); expect(source).toContain("rpc: 'rpc_reveal_contact'");
    expect(readFileSync(join(dir, 'agreementClientService.ts'), 'utf8')).toContain('tacnaLokacija: null');
  });
  it('accepts coordinate-only confirmed points including zero and private per-stop details', async () => {
    mockRpc.mockResolvedValue({ data: receipt(), error: null });
    const result = await contactClientService.otkrijTacnuLokaciju(agreementId);
    expect(mockRpc.mock.calls).toEqual([['rpc_reveal_contact', { p_agreement_id: agreementId, p_channel: 'EXACT_LOCATION' }]]);
    expect(result).toMatchObject({ ok: true, podatak: { authoritative: true, agreementId, needId, needRevision: 2, grantId,
      adresa: null, exactPosition: { latitude: 0, longitude: 0 }, resolvedLocation: { value: { points: [pin] } } } });
  });
  it('accepts legacy address-only authoritative reveal without fabricated coordinates', async () => {
    mockRpc.mockResolvedValue({ data: { ...receipt(), exactAddress: 'PRIVATE LEGACY', resolvedLocation: null, exactLat: null, exactLng: null }, error: null });
    expect(await contactClientService.otkrijTacnuLokaciju(agreementId)).toMatchObject({ ok: true, podatak: { adresa: 'PRIVATE LEGACY', resolvedLocation: null, exactPosition: null } });
  });
  it.each([
    ['old incomplete response', () => ({ exactAddress: 'PRIVATE OLD' })],
    ['wrong agreement', () => ({ ...receipt(), agreementId: needId })],
    ['wrong owner', () => ({ ...receipt(), ownerAccountId: workerId })],
    ['unattested receipt', () => ({ ...receipt(), authoritative: false })],
    ['invalid revision', () => ({ ...receipt(), needRevision: 0 })],
    ['expired grant', () => ({ ...receipt(), expiresAt: '2000-01-01T00:00:00Z' })],
    ['malformed private record', () => ({ ...receipt(), resolvedLocation: { ...envelope(), confirmedByAccountId: workerId } })],
    ['changed address binding', () => ({ ...receipt(), exactAddress: 'Different' })],
    ['out of range pin', () => ({ ...receipt(), resolvedLocation: { ...envelope(), value: { ...envelope().value, points: [{ ...pin, latitudeE6: 90000001 }] } } })],
    ['mismatched start scalar', () => ({ ...receipt(), exactLat: 1 })],
    ['missing all location', () => ({ ...receipt(), resolvedLocation: null, exactLat: null, exactLng: null })],
  ])('fails closed on %s', async (_name, make) => {
    mockRpc.mockResolvedValue({ data: make(), error: null });
    expect(await contactClientService.otkrijTacnuLokaciju(agreementId)).toMatchObject({ ok: false, kod: 'LOCATION_REVEAL_INVALID' });
  });
  it('shows readable grant rejection and never raw provider/backend errors', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'NO_ACTIVE_GRANT' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'PRIVATE SQL provider details' } });
    const denied = await contactClientService.otkrijTacnuLokaciju(agreementId);
    expect(denied).toMatchObject({ ok: false, kod: 'NO_ACTIVE_GRANT' }); expect(JSON.stringify(denied)).toContain('Dozvola');
    const unknown = await contactClientService.otkrijTacnuLokaciju(agreementId);
    expect(unknown).toMatchObject({ ok: false, kod: 'LOCATION_REVEAL_FAILED' }); expect(JSON.stringify(unknown)).not.toContain('PRIVATE');
  });
  it('rejects late reveal after same-account incarnation changes', async () => {
    const late = deferred<unknown>(); mockRpc.mockReturnValueOnce(late.promise);
    const pending = contactClientService.otkrijTacnuLokaciju(agreementId);
    mockSession = { user: { id: workerId }, accountRevision: 2 }; late.resolve({ data: receipt(), error: null });
    expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  });
  it('reads only existing grant metadata and rejects foreign rows', async () => {
    mockSelect.mockResolvedValueOnce({ data: [grant()], error: null })
      .mockResolvedValueOnce({ data: [{ ...grant(), granted_to_account_id: needId }], error: null });
    expect(await contactClientService.lokacijskaDozvola(agreementId)).toMatchObject({ ok: true, podatak: { accountId: workerId, grants: [{ id: grantId }] } });
    expect(mockSelect.mock.calls[0][0]).toBe('access_grants');
    expect(mockSelect.mock.calls[0][1]).not.toMatch(/exact|resolved|address/);
    expect(await contactClientService.lokacijskaDozvola(agreementId)).toMatchObject({ ok: false, kod: 'LOCATION_GRANT_READ_INVALID' });
  });
  it('shares and revokes EXACT_LOCATION through existing RPC independent of PHONE', async () => {
    mockSession = { user: { id: ownerId }, accountRevision: 1 };
    const response = (granted: boolean) => ({ authoritative: true, channel: 'EXACT_LOCATION', agreementId,
      grantedByAccountId: ownerId, grantedToAccountId: workerId, granted, grantId });
    mockRpc.mockResolvedValueOnce({ data: response(true), error: null }).mockResolvedValueOnce({ data: response(false), error: null });
    expect(await contactClientService.podeliTacnuLokaciju(agreementId)).toEqual({ ok: true, podatak: null });
    expect(await contactClientService.opoziviTacnuLokaciju(agreementId)).toEqual({ ok: true, podatak: null });
    expect(mockRpc.mock.calls).toEqual([true, false].map(allowed => ['rpc_set_contact_grant', { p_agreement_id: agreementId, p_channel: 'EXACT_LOCATION', p_granted: allowed }]));
  });
  it('does not accept an incomplete or late grant write receipt', async () => {
    mockSession = { user: { id: ownerId }, accountRevision: 1 };
    mockRpc.mockResolvedValueOnce({ data: { granted: true }, error: null });
    expect(await contactClientService.podeliTacnuLokaciju(agreementId)).toMatchObject({ ok: false, kod: 'LOCATION_GRANT_INVALID' });
    const late = deferred<unknown>(); mockRpc.mockReturnValueOnce(late.promise);
    const pending = contactClientService.podeliTacnuLokaciju(agreementId);
    mockSession = { user: { id: workerId }, accountRevision: 2 }; late.resolve({ data: receipt(), error: null });
    expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  });
});
