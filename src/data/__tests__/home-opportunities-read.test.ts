jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return { supabaseKlijent: () => ({ rpc: mockRpc }), __testMocks: { mockRpc } };
});
jest.mock('../publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: jest.fn() } }));
import { supabaseIzvor } from '../supabaseIzvor';
import { publicProfileClientService } from '../publicProfileClientService';
let mockSession = { user: { id: 'reader-a' }, accountRevision: 1 };
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
const { mockRpc } = jest.requireMock('../supabaseClient').__testMocks as { mockRpc: jest.Mock };
const profile = publicProfileClientService.javniProfil as jest.Mock;
const id = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
const item = (change: Record<string, unknown> = {}) => ({
  id: id(3), revision: 2, sortAt: '2026-10-18T10:00:00.000003Z', publishedAt: '2026-10-18T10:00:00.000003Z',
  title: 'Pomoć pri selidbi', category: 'Selidbe', status: 'PUBLISHED', urgent: false,
  scheduleKind: 'FLEXIBLE', startsAt: null, endsAt: null, executionLocationMode: null,
  approximateCity: 'Novi Sad', approximateArea: 'Centar', pin: { lat: 45.26, lng: 19.83, precision: 'COARSE_1KM' },
  requiredSlots: 3, coveredSlots: 1, requiredSkills: ['Selidbe'], requiredTools: [], requiredVehicles: [], requiredLicenses: [],
  minimumExperienceYears: null, verifiedIdentityRequired: false, taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
  priceMode: 'OFFERS', requesterPriceRsd: null, requesterProfileId: id(99),
  responseDeadline: null, acceptsApplications: true, publicTopology: null, criticalConditions: null, ...change,
});
const page = (items: unknown[], hasMore = false) => ({ data: { items, hasMore, asOf: '2026-10-18T12:00:00Z' }, error: null });

describe('bounded optional public Home preview', () => {
  beforeEach(() => {
    jest.clearAllMocks(); mockRpc.mockReset(); profile.mockReset().mockResolvedValue(null);
    mockSession = { user: { id: 'reader-a' }, accountRevision: 1 };
  });
  it('uses one public request for three, even when there are more, without a list walk', async () => {
    mockRpc.mockResolvedValue(page([item(), item({ id: id(2) }), item({ id: id(1) })], true));
    const rows = await supabaseIzvor.prilikeZaPocetnu();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('rpc_list_open_tasks_v3', {
      p_bbox: null, p_filters: { homePreview: true }, p_limit: 3, p_before_at: null, p_before_id: null,
    });
    expect(rows.map(row => row.id)).toEqual([id(3), id(2), id(1)]);
    expect(rows.every(row => row.primaNovePrijave === true && row.opis === '')).toBe(true);
    expect(profile).toHaveBeenCalledTimes(1);
  });
  it('keeps sub-millisecond ordering and normalizes IDs', async () => {
    const later = item({ id: id(1), sortAt: '2026-10-18T10:00:00.000004Z', publishedAt: '2026-10-18T10:00:00.000004Z' });
    mockRpc.mockResolvedValue(page([later, item()]));
    await expect(supabaseIzvor.prilikeZaPocetnu()).resolves.toHaveLength(2);
  });
  it('keeps a real empty response separate from offline and old-server refusal; no fallback', async () => {
    mockRpc.mockResolvedValueOnce(page([]));
    await expect(supabaseIzvor.prilikeZaPocetnu()).resolves.toEqual([]);
    const error = { code: '22023', message: 'INVALID_FILTER' };
    mockRpc.mockResolvedValueOnce({ data: null, error });
    await expect(supabaseIzvor.prilikeZaPocetnu()).rejects.toBe(error);
    mockRpc.mockRejectedValueOnce(new Error('offline'));
    await expect(supabaseIzvor.prilikeZaPocetnu()).rejects.toThrow('offline');
    expect(mockRpc).toHaveBeenCalledTimes(3); expect(profile).not.toHaveBeenCalled();
  });
  it.each([
    null, { data: null, error: null }, { data: { items: [], hasMore: true, asOf: '2026-10-18T12:00:00Z' }, error: null },
    page([item(), item({ id: id(2) }), item({ id: id(1) }), item({ id: id(0) })]),
    { data: { items: [], hasMore: false, asOf: 'invalid' }, error: null },
    { data: page([]).data },
  ])('refuses malformed envelope before enrichment: %j', async response => {
    mockRpc.mockResolvedValue(response);
    await expect(supabaseIzvor.prilikeZaPocetnu()).rejects.toThrow('HOME_OPPORTUNITIES_RESPONSE_INVALID');
    expect(profile).not.toHaveBeenCalled();
  });
  it.each([
    { id: 'invalid' }, { revision: 0 }, { publishedAt: '2026-10-18T09:00:00Z' }, { status: 'DRAFT' },
    { title: ' ' }, { urgent: 'false' }, { requiredSlots: 0 }, { coveredSlots: -1 }, { coveredSlots: 3 },
    { acceptsApplications: false }, { requesterProfileId: 'invalid' }, { priceMode: 'unknown' },
    { pin: { lat: 45, lng: 19, precision: 'EXACT' } }, { pin: { lat: 91, lng: 19, precision: 'COARSE_1KM' } },
  ])('refuses malformed/closed public row before enrichment: %j', async change => {
    mockRpc.mockResolvedValue(page([item(change)]));
    await expect(supabaseIzvor.prilikeZaPocetnu()).rejects.toThrow('HOME_OPPORTUNITIES_RESPONSE_INVALID');
    expect(profile).not.toHaveBeenCalled();
  });
  it.each([{ rows: [item(), item()] }, { rows: [item({ id: id(1) }), item()] }])('refuses duplicate or unordered rows', async ({ rows }) => {
    mockRpc.mockResolvedValue(page(rows));
    await expect(supabaseIzvor.prilikeZaPocetnu()).rejects.toThrow('HOME_OPPORTUNITIES_RESPONSE_INVALID');
    expect(profile).not.toHaveBeenCalled();
  });
  it('bounds distinct author reads to three and never copies private fields', async () => {
    mockRpc.mockResolvedValue(page([3, 2, 1].map(n => item({ id: id(n), requesterProfileId: id(n + 10),
      privateAddress: 'DO_NOT_COPY', phone: 'DO_NOT_COPY' }))));
    profile.mockRejectedValue(new Error('optional profile offline'));
    const rows = await supabaseIzvor.prilikeZaPocetnu();
    expect(rows).toHaveLength(3); expect(profile).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(rows)).not.toContain('DO_NOT_COPY');
    expect(rows.every(row => row.narucilacOcena === null)).toBe(true);
  });
  it('rejects aborted work before IO and forwards active cancellation', async () => {
    const abort = new AbortController(); abort.abort();
    await expect(supabaseIzvor.prilikeZaPocetnu({ signal: abort.signal })).rejects.toThrow('HOME_OPPORTUNITIES_READ_ABORTED');
    expect(mockRpc).not.toHaveBeenCalled();
    const current = new AbortController(), attach = jest.fn(async (signal: AbortSignal) => {
      expect(signal).toBe(current.signal); current.abort(); return page([]);
    });
    mockRpc.mockReturnValue({ abortSignal: attach });
    await expect(supabaseIzvor.prilikeZaPocetnu({ signal: current.signal })).rejects.toThrow('HOME_OPPORTUNITIES_READ_ABORTED');
    expect(attach).toHaveBeenCalledTimes(1);
  });
  it.each(['response', 'enrichment'])('rejects A-B-A retirement during %s', async phase => {
    const retire = () => { mockSession = { user: { id: 'reader-a' }, accountRevision: 3 }; };
    mockRpc.mockImplementation(async () => { if (phase === 'response') retire(); return page([item()]); });
    profile.mockImplementation(async () => { retire(); return null; });
    await expect(supabaseIzvor.prilikeZaPocetnu()).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
    if (phase === 'response') expect(profile).not.toHaveBeenCalled();
  });
});
