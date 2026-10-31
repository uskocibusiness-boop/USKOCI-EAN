jest.mock('../supabaseClient', () => {
  const maybeSingle = jest.fn();
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  const rpc = jest.fn(() => maybeSingle());
  return { supabaseKlijent: () => ({ from, rpc }), __testMocks: { maybeSingle, eq, select, from, rpc } };
});
jest.mock('../publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: jest.fn() } }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: 'reader-a' }, accountRevision: 1 }) }));

import { supabaseIzvor } from '../supabaseIzvor';
import { publicProfileClientService } from '../publicProfileClientService';
const { maybeSingle, eq, select, from, rpc } = jest.requireMock('../supabaseClient').__testMocks as Record<string, jest.Mock>;
const publicProfile = publicProfileClientService.javniProfil as jest.Mock;
const row = () => ({
  id: 'task-a', title: 'Pomoć pri selidbi', status: 'PUBLISHED', starts_at: null,
  approximate_area: 'Centar', approximate_city: 'Novi Sad', approximate_lat: 45.2, approximate_lng: 19.8,
  required_slots: 2, covered_slots: 0, required_skills: ['Alat'], required_tools: [], required_vehicles: [],
  requester_profile_id: 'requester-a', mode: 'MY_PRICE', requester_price_rsd: 5000, response_deadline: null,
  remaining_search_closed_at: null,
  description: 'Prenos kutija', category: 'Selidbe', schedule_kind: 'FLEXIBLE', ends_at: null,
  task_country_code: 'RS', task_timezone: 'Europe/Belgrade', execution_location_mode: null,
  required_licenses: [], minimum_experience_years: null, verified_identity_required: false,
  need_geography: null, need_requirement_details: null,
});
beforeEach(() => { jest.clearAllMocks(); maybeSingle.mockReset(); publicProfile.mockResolvedValue(null); });

describe('V2 complete public task context', () => {
  it.each([1, 42, Number.MAX_SAFE_INTEGER])('preserves task revision %s for optional fit invalidation', async revision => {
    maybeSingle.mockResolvedValue({ data: { ...row(), revision }, error: null });
    expect(await supabaseIzvor.prilika('task-a')).toMatchObject({ id: 'task-a', revision });
  });
  it.each([undefined, null, 0, -1, 1.5, '2', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('keeps an unavailable task revision %p unknown without losing the task', async revision => {
    maybeSingle.mockResolvedValue({ data: { ...row(), revision }, error: null });
    const result = await supabaseIzvor.prilika('task-a');
    expect(result?.id).toBe('task-a'); expect(result?.revision).toBeUndefined();
  });
  it.each([[0, 0], [0, 19], [45, 0], [45.25456, 19.83456]])('keeps legitimate public coordinates (%s,%s) coarse', async (lat, lng) => {
    maybeSingle.mockResolvedValue({ data: { ...row(), approximate_lat: lat, approximate_lng: lng }, error: null });
    expect((await supabaseIzvor.prilika('task-a'))?.priblizno).toEqual({ lat: Number(lat.toFixed(2)), lng: Number(lng.toFixed(2)) });
  });
  it.each([null, undefined, '45', NaN, Infinity, 181])('ignores malformed coordinate %p without losing the public task', async value => {
    for (const column of ['approximate_lat', 'approximate_lng']) {
      maybeSingle.mockResolvedValue({ data: { ...row(), [column]: value }, error: null });
      expect(await supabaseIzvor.prilika('task-a')).toMatchObject({ id: 'task-a', priblizno: null });
    }
  });
  it('Remote suppresses stale physical fields and exposes only the typed public context', async () => {
    maybeSingle.mockResolvedValue({ data: { ...row(), execution_location_mode: 'REMOTE',
      need_geography: { public_topology: { mode: 'REMOTE' } }, approximate_area: 'Old address', approximate_city: 'Old city' }, error: null });
    const result = await supabaseIzvor.prilika('task-a');
    expect(result).toMatchObject({ podrucjeTekst: 'Na daljinu', priblizno: null, detalji: { rezimLokacije: 'REMOTE' } });
    expect(JSON.stringify(result)).not.toContain('Old');
  });
  it('shows the complete public schedule and requirements without granting access to a private witness', async () => {
    maybeSingle.mockResolvedValue({ data: { ...row(), schedule_kind: 'FIXED_WINDOW',
      starts_at: '2026-09-12T10:05:01.123456Z', ends_at: '2026-09-12T11:35:02.654321Z',
      required_licenses: ['Dozvola'], need_requirement_details: { critical_conditions: ['Teške kutije'] },
      exact_address: 'PRIVATE_ADDRESS', resolved_location: { privateAddress: 'PRIVATE_ADDRESS' } }, error: null });
    const result = await supabaseIzvor.prilika('task-a');
    expect(result?.vremeTekst).toMatch(/12\. sep( 2026)? · 12:05–13:35/); expect(result?.vremeTekst).not.toContain('12:05:01');
    expect(result?.vremeTekst).not.toContain('13:35:02');
    expect(result?.vremeTekst).toContain('po vremenu u Srbiji');
    expect(result?.detalji?.zahtevi).toMatchObject({ dozvole: ['Dozvola'], bitniUslovi: ['Teške kutije'] });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_ADDRESS');
  });
});

describe('W04 public-safe detail read', () => {
  it('separates failed transport/permission reads from a successful missing row', async () => {
    const failure = { code: '42501', message: 'private policy internals' };
    maybeSingle.mockResolvedValueOnce({ data: null, error: failure });
    await expect(supabaseIzvor.prilika('task-a')).rejects.toBe(failure);
    maybeSingle.mockRejectedValueOnce(new Error('offline'));
    await expect(supabaseIzvor.prilika('task-a')).rejects.toThrow('offline');
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(supabaseIzvor.prilika('task-a')).resolves.toBeNull();
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it('recovers with the existing narrow projection and no private task columns', async () => {
    maybeSingle.mockResolvedValue({ data: { ...row(), exact_address: 'PRIVATE', requester_account_id: 'PRIVATE', private_terms: 'PRIVATE' }, error: null });
    const result = await supabaseIzvor.prilika('task-a');
    expect(rpc).toHaveBeenCalledWith('rpc_read_task', { p_need_id: 'task-a' });
    expect(from).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'task-a', naslov: 'Pomoć pri selidbi', primaNovePrijave: true,
      podrucjeTekst: 'Centar, Novi Sad', narucilacIme: '', narucilacOcena: null, ponudjenaCena: { iznos: 5000, valuta: 'RSD' } });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(publicProfile).toHaveBeenCalledWith('requester-a', expect.any(AbortSignal));
    expect(result?.rokZaPrijaveIso).toBeNull();
    // A failed profile read leaves the review count unknown, never zero (step 5a, 2026-09-24).
    expect(result?.narucilacBrojOcena).toBeNull();
    expect(result?.narucilacAvatarId).toBeNull();
  });

  it('carries the review count and authorized portrait reference from the same requester public profile', async () => {
    const assetId = '33333333-3333-4333-8333-333333333333';
    const path = `11111111-1111-4111-8111-111111111111/v5/${assetId}/${'a'.repeat(64)}.jpg`;
    maybeSingle.mockResolvedValue({ data: row(), error: null });
    publicProfile.mockResolvedValueOnce({ profilId: 'requester-a', uloga: 'narucilac', ime: 'Ana', avatarPutanja: path, grad: null, naslov: null, biografija: null,
      poverenje: { ocenaProsek: 5, brojRecenzija: 1, zavrseniBroj: 1, identitetVerifikovan: false, ocenaDostupna: true, recenzijeDostupne: true,
        verifikacijaIdentitetaDostupna: false } });
    const result = await supabaseIzvor.prilika('task-a');
    expect(result).toMatchObject({ narucilacIme: 'Ana', narucilacOcena: '5,0', narucilacBrojOcena: 1, narucilacAvatarId: assetId });
    expect(JSON.stringify(result)).not.toContain(path);
    expect(publicProfile).toHaveBeenCalledTimes(1);
  });

  it.each(['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'ARCHIVED', 'DRAFT', 'UNKNOWN'])('keeps readable %s tasks read-only', async status => {
    maybeSingle.mockResolvedValue({ data: { ...row(), status }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).resolves.toMatchObject({ primaNovePrijave: false, statusTekst: 'Prijave zatvorene' });
  });

  it('does not offer a composer for a full task, while selection with remaining seats stays open', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { ...row(), status: 'SELECTION', covered_slots: 2 }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).resolves.toMatchObject({ primaNovePrijave: false });
    maybeSingle.mockResolvedValueOnce({ data: { ...row(), status: 'SELECTION', covered_slots: 1 }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).resolves.toMatchObject({ primaNovePrijave: true });
  });

  it('closes the public CTA when remaining search is closed even with capacity and an open status', async () => {
    maybeSingle.mockResolvedValue({ data: { ...row(), status: 'SELECTION', covered_slots: 1,
      remaining_search_closed_at: '2026-09-15T12:00:00Z' }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).resolves.toMatchObject({
      primaNovePrijave: false,
      statusTekst: 'Prijave zatvorene',
      pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1 },
    });
  });

  it.each([undefined, '', 'invalid', '9999', 1])('fails closed for unknown or malformed remaining-search state %p', async remaining_search_closed_at => {
    maybeSingle.mockResolvedValue({ data: { ...row(), remaining_search_closed_at }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).rejects.toThrow('TASK_REMAINING_SEARCH_STATE_INVALID');
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it.each([
    { required_slots: null }, { required_slots: undefined }, { required_slots: 0 }, { required_slots: -1 },
    { required_slots: 1.5 }, { required_slots: '2' }, { required_slots: Number.NaN },
    { covered_slots: null }, { covered_slots: undefined }, { covered_slots: -1 }, { covered_slots: 0.5 },
    { covered_slots: '0' }, { covered_slots: Number.NaN }, { covered_slots: Number.POSITIVE_INFINITY },
  ])('fails the read closed for malformed capacity %j', async malformed => {
    maybeSingle.mockResolvedValue({ data: { ...row(), ...malformed }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).rejects.toThrow('TASK_CAPACITY_INVALID');
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'invalid', '9999', 1])('fails closed for unknown or malformed deadline %s', async response_deadline => {
    maybeSingle.mockResolvedValue({ data: { ...row(), response_deadline }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).rejects.toThrow('TASK_DEADLINE_INVALID');
  });

  it('suppresses expired published tasks before the status-expiry cron runs', async () => {
    const expired = new Date(Date.now() - 1_000).toISOString();
    maybeSingle.mockResolvedValueOnce({ data: { ...row(), response_deadline: expired }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).resolves.toMatchObject({ primaNovePrijave: false, rokZaPrijaveIso: expired });
    const future = new Date(Date.now() + 60_000).toISOString();
    maybeSingle.mockResolvedValueOnce({ data: { ...row(), response_deadline: future }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).resolves.toMatchObject({ primaNovePrijave: true, rokZaPrijaveIso: future });
  });
});
