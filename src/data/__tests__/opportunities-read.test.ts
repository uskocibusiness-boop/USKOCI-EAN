jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return { supabaseKlijent: () => ({ rpc: mockRpc }), __testMocks: { mockRpc } };
});
jest.mock('../publicProfileClientService', () => ({
  publicProfileClientService: { javniProfil: jest.fn() },
}));

import { supabaseIzvor } from '../supabaseIzvor';
import { publicProfileClientService } from '../publicProfileClientService';
import { NEED_URGENCY_BUDGET_MS } from '../needUrgencyClientService';

let mockSession = { user: { id: 'reader-a' }, accountRevision: 1 };
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));

const { mockRpc } = jest.requireMock('../supabaseClient').__testMocks as { mockRpc: jest.Mock };
const publicProfile = publicProfileClientService.javniProfil as jest.Mock;
const needId = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
const NEED1 = needId(3), NEED2 = needId(2), NEED3 = needId(1);

/** One item as public.rpc_list_open_tasks_v3 builds it (pkg023d + pkg023i). */
const item = (change: Record<string, unknown> = {}) => ({
  id: NEED1, sortAt: '2026-09-18T10:00:00Z', publishedAt: '2026-09-18T10:00:00Z',
  title: 'Pomoć pri selidbi', category: 'Selidbe', status: 'PUBLISHED', urgent: false,
  scheduleKind: 'FLEXIBLE', startsAt: null, endsAt: null, executionLocationMode: null,
  approximateCity: 'Beograd', approximateArea: 'Centar',
  pin: { lat: 44.8, lng: 20.4, precision: 'COARSE_1KM' },
  requiredSlots: 3, coveredSlots: 1,
  requiredSkills: ['Selidbe'], requiredTools: [], requiredVehicles: [], requiredLicenses: [],
  minimumExperienceYears: null, verifiedIdentityRequired: false,
  taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
  priceMode: 'OFFERS', requesterPriceRsd: null, requesterProfileId: 'requester-1',
  responseDeadline: null, acceptsApplications: true, publicTopology: null, criticalConditions: null,
  ...change,
});
const page = (items: unknown[], hasMore = false) => ({ data: { items, hasMore, asOf: '2026-09-19T00:00:00Z' }, error: null });

describe('W03 authoritative discovery read, through the bounded server reader', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRpc.mockReset(); publicProfile.mockReset();
    mockSession = { user: { id: 'reader-a' }, accountRevision: 1 }; });

  it('propagates a failed read so the screen cannot report no tasks', async () => {
    const failure = { code: '08006', message: 'Connection unavailable' };
    mockRpc.mockResolvedValue({ data: null, error: failure });
    await expect(supabaseIzvor.otvorenePrilike()).rejects.toBe(failure);
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it('distinguishes a successful empty page from a missing response', async () => {
    mockRpc.mockResolvedValueOnce(page([]));
    await expect(supabaseIzvor.otvorenePrilike()).resolves.toEqual([]);
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(supabaseIzvor.otvorenePrilike()).rejects.toThrow('OPPORTUNITIES_RESPONSE_INVALID');
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it('walks the pages by keyset and never repeats a row', async () => {
    mockRpc
      .mockResolvedValueOnce(page([item(), item({ id: NEED2, sortAt: '2026-09-18T09:00:00Z' })], true))
      .mockResolvedValueOnce(page([item({ id: NEED3, sortAt: '2026-09-18T08:00:00Z' })]));
    publicProfile.mockResolvedValue(null);
    const result = await supabaseIzvor.otvorenePrilike();
    expect(result.map(row => row.id)).toEqual([NEED1, NEED2, NEED3]);
    expect(mockRpc).toHaveBeenNthCalledWith(1, 'rpc_list_open_tasks_v3', { p_limit: 200, p_before_at: null, p_before_id: null });
    // The cursor is the last row of the page it just read, so the next page starts strictly after it.
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'rpc_list_open_tasks_v3',
      { p_limit: 200, p_before_at: '2026-09-18T09:00:00Z', p_before_id: NEED2 });
  });

  it('refuses rather than silently truncating a list that never ends', async () => {
    let next = 100;
    mockRpc.mockImplementation(() => Promise.resolve(page([item({ id: needId(next--) })], true)));
    await expect(supabaseIzvor.otvorenePrilike()).rejects.toThrow('OPPORTUNITIES_TOO_MANY_PAGES');
  });

  it('preserves the public-safe task projection, and the list carries no description', async () => {
    mockRpc.mockRejectedValueOnce(new Error('offline'));
    await expect(supabaseIzvor.otvorenePrilike()).rejects.toThrow('offline');
    mockRpc.mockResolvedValueOnce(page([item()]));
    publicProfile.mockResolvedValueOnce(null);

    const result = await supabaseIzvor.otvorenePrilike();
    expect(publicProfile).toHaveBeenCalledWith('requester-1', expect.any(AbortSignal));
    expect(result).toEqual([{
      id: NEED1, naslov: 'Pomoć pri selidbi', statusTekst: 'Traži ponude',
      podrucjeTekst: 'Centar, Beograd', vremeTekst: 'Fleksibilno',
      // The description is not in the public list at all; the detail screen reads the one a person opens.
      opis: '',
      taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade', schedule: { kind: 'FLEXIBLE', startsAt: null, endsAt: null },
      detalji: { kategorija: 'Selidbe', geografija: null, rezimLokacije: null,
        zahtevi: { vestine: ['Selidbe'], alati: [], vozila: [], dozvole: [], bitniUslovi: null, iskustvoGodina: null, potvrdjenIdentitet: false } },
      pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 },
      // A failed profile read leaves the review count unknown (null), never zero (step 5a, 2026-09-24).
      uslovi: ['Selidbe'], narucilacProfilId: 'requester-1', narucilacAvatarId: null, narucilacIme: '', narucilacOcena: null, narucilacBrojOcena: null,
      priblizno: { lat: 44.8, lng: 20.4 }, rezimCene: 'OFFERS', osnovaCene: null, ponudjenaCena: undefined,
    }]);
  });

  it('reuses each public profile read for its portrait asset without passing through the storage path', async () => {
    const assetId = '33333333-3333-4333-8333-333333333333';
    const path = `11111111-1111-4111-8111-111111111111/v5/${assetId}/${'a'.repeat(64)}.jpg`;
    mockRpc.mockResolvedValueOnce(page([item(), item({ id: NEED2 })]));
    publicProfile.mockResolvedValueOnce({ ime: 'Nikola', avatarPutanja: path,
      poverenje: { ocenaDostupna: false, recenzijeDostupne: false } });

    const rows = await supabaseIzvor.otvorenePrilike();

    expect(rows.map(row => row.narucilacAvatarId)).toEqual([assetId, assetId]);
    expect(publicProfile).toHaveBeenCalledTimes(1);
    expect(publicProfile).toHaveBeenCalledWith('requester-1', expect.any(AbortSignal));
    expect(JSON.stringify(rows)).not.toContain(path);
    expect(mockRpc.mock.calls.map(([name]) => name)).toEqual(['rpc_list_open_tasks_v3']);
  });

  it.each([null, '', 'https://example.test/avatar.jpg', 'profile-media/requester-1/avatar.jpg',
    `11111111-1111-4111-8111-111111111111/v5/not-an-asset/${'a'.repeat(64)}.jpg`])(
    'leaves the portrait unavailable for a missing or unsupported public reference: %s', async avatarPutanja => {
      mockRpc.mockResolvedValueOnce(page([item()]));
      publicProfile.mockResolvedValueOnce({ ime: 'Nikola', avatarPutanja,
        poverenje: { ocenaDostupna: false, recenzijeDostupne: false } });

      const [row] = await supabaseIzvor.otvorenePrilike();

      expect(row.narucilacAvatarId).toBeNull();
      expect(publicProfile).toHaveBeenCalledTimes(1);
      expect(mockRpc.mock.calls.map(([name]) => name)).toEqual(['rpc_list_open_tasks_v3']);
    });

  it('keeps every task when optional author reads fail, with unknown rather than zero trust', async () => {
    mockRpc.mockResolvedValueOnce(page([item(), item({ id: NEED2, requesterProfileId: 'requester-2' })]));
    publicProfile.mockRejectedValue(new Error('PUBLIC_PROFILE_READ_FAILED'));
    const rows = await supabaseIzvor.otvorenePrilike();
    expect(rows.map(row => row.id)).toEqual([NEED1, NEED2]);
    for (const row of rows) expect(row).toMatchObject({ narucilacIme: '', narucilacOcena: null,
      narucilacBrojOcena: null, narucilacAvatarId: null });
  });

  it('keeps the complete public collection when an optional urgency read stalls, without inventing its badge', async () => {
    jest.useFakeTimers();
    let late!: (value: unknown) => void;
    let urgencySignal!: AbortSignal;
    const observed = { needId: NEED1, level: 'HITNO', activatedAt: '2026-09-19T10:00:00Z',
      expiresAt: '2026-09-19T11:00:00Z', authoritative: true };
    mockRpc.mockImplementation((name: string, args: { p_need_id?: string }) => {
      if (name === 'rpc_list_open_tasks_v3') return Promise.resolve(page([
        item({ urgent: true }), item({ id: NEED2, urgent: true }), item({ id: NEED3 }),
      ]));
      if (args.p_need_id === NEED1) return Promise.resolve({ data: observed, error: null });
      return { abortSignal: (signal: AbortSignal) => {
        urgencySignal = signal; return new Promise(resolve => { late = resolve; });
      } };
    });
    publicProfile.mockResolvedValue(null);
    try {
      const reading = supabaseIzvor.otvorenePrilike();
      await jest.advanceTimersByTimeAsync(NEED_URGENCY_BUDGET_MS);
      const rows = await reading;
      expect(rows.map(row => row.id)).toEqual([NEED1, NEED2, NEED3]);
      expect(rows[0].urgency).toEqual({ level: 'HITNO', expiresAt: observed.expiresAt });
      expect(rows[1].urgency).toBeUndefined(); expect(rows[2].urgency).toBeUndefined();
      expect(rows.every(row => row.pokrivenost.preostalo === 2 && row.taskTimezone === 'Europe/Belgrade')).toBe(true);
      expect(urgencySignal.aborted).toBe(true);
      late({ data: { ...observed, needId: NEED2 }, error: null });
      for (let index = 0; index < 12; index++) await Promise.resolve();
      expect(rows[1].urgency).toBeUndefined(); expect(mockRpc).toHaveBeenCalledTimes(3);
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });

  it('rejects the whole account-owned walk after an A-B-A change during optional enrichment', async () => {
    mockRpc.mockResolvedValueOnce(page([item()]));
    publicProfile.mockImplementationOnce(async () => {
      mockSession = { user: { id: 'reader-b' }, accountRevision: 2 };
      mockSession = { user: { id: 'reader-a' }, accountRevision: 3 };
      return { ime: 'Late name', avatarPutanja: null,
        poverenje: { ocenaDostupna: true, ocenaProsek: 5, brojRecenzija: 2, recenzijeDostupne: true } };
    });
    await expect(supabaseIzvor.otvorenePrilike()).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
  });

  // The rating travels with its actual review count; unavailable metadata is not a guessed zero.
  it('carries the review count the public profile discloses, 0 when there are none and null when it is not disclosed', async () => {
    const trust = (patch: Record<string, unknown>) => ({ profilId: 'requester-1', uloga: 'narucilac', ime: 'Nikola', avatarPutanja: null, grad: null,
      naslov: null, biografija: null, poverenje: { ocenaProsek: null, brojRecenzija: null, zavrseniBroj: 0, identitetVerifikovan: false,
        ocenaDostupna: false, recenzijeDostupne: false, verifikacijaIdentitetaDostupna: false, ...patch } });
    const read = async (profile: unknown) => {
      mockRpc.mockResolvedValueOnce(page([item()])); publicProfile.mockResolvedValueOnce(profile);
      const [row] = await supabaseIzvor.otvorenePrilike();
      return { narucilacOcena: row.narucilacOcena, narucilacBrojOcena: row.narucilacBrojOcena };
    };
    await expect(read(trust({ ocenaProsek: 4.8, brojRecenzija: 12, ocenaDostupna: true, recenzijeDostupne: true })))
      .resolves.toEqual({ narucilacOcena: '4,8', narucilacBrojOcena: 12 });
    await expect(read(trust({ brojRecenzija: 0, recenzijeDostupne: true }))).resolves.toEqual({ narucilacOcena: null, narucilacBrojOcena: 0 });
    await expect(read(trust({}))).resolves.toEqual({ narucilacOcena: null, narucilacBrojOcena: null });
    await expect(read(null)).resolves.toEqual({ narucilacOcena: null, narucilacBrojOcena: null });
  });
});
