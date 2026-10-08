/**
 * CDL-A01 — Agreement workspace read consolidation
 *
 * The pre-deletion commit proved old-owner/new-owner equivalence in CI.
 * After migration, these tests lock the canonical RPC/auth/mapping/error
 * contract and verify that legacy/transitional Agreement read ownership
 * does not reappear.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: 'requester-1' }, accountRevision: 1 }) }));

jest.mock('../supabaseClient', () => {
  const mockGetUser = jest.fn();
  const mockRpc = jest.fn();

  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    }),
    __testMocks: { mockGetUser, mockRpc },
  };
});

import { agreementClientService } from '../agreementClientService';

const { mockGetUser, mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: {
    mockGetUser: jest.Mock;
    mockRpc: jest.Mock;
  };
}).__testMocks;

const rawAgreement = {
  id: 'agr-1',
  requesterAccountId: 'requester-1',
  workerAccountId: 'worker-1',
  requesterName: 'Miloš',
  workerName: 'Ana',
  title: 'Preuzmi paket',
  status: 'ACTIVE',
  agreementStatus: 'CONFIRMED',
  currentVersion: 4,
  requiredSlots: 3,
  executionMode: 'PICKUP_DELIVERY',
  approximateArea: 'Centar',
  approximateCity: 'Novi Sad',
  startsAt: '2026-09-05T10:30:00.000Z',
  createdAt: '2026-09-05T08:00:00.000Z',
  requesterDeadlineAt: '2026-09-06T08:00:00.000Z',
  myPhoneShared: true,
  theirPhone: '+38160111222',
  problemOpened: false,
  terms: {
    price_rsd: 2400,
    currency: 'RSD',
    covered_slots: 2,
    proposed_start_at: '2026-09-05T10:00:00.000Z',
  },
};

function resetHappyAuth() {
  mockGetUser.mockReset();
  mockRpc.mockReset();
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'requester-1' } },
    error: null,
  });
}

describe('CDL-A01 — canonical Agreement read contract', () => {
  beforeEach(() => resetHappyAuth());

  it('transitional Agreement override file is physically absent after A02 cleanup', () => {
    expect(existsSync(join(__dirname, '..', 'agreementProductionOverrides.ts'))).toBe(false);
  });

  it('legacy baseline physically excludes migrated reads and production has one owner', () => {
    const indexSource = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');
    const baselineSource = readFileSync(join(__dirname, '..', 'supabaseIzvor.ts'), 'utf8');
    const productionStart = indexSource.indexOf('const produkcijskiIzvor');
    const productionEnd = indexSource.indexOf('export const izvor');
    const productionComposition = indexSource.slice(productionStart, productionEnd);

    expect(baselineSource).not.toContain('async mojiDogovori(');
    expect(baselineSource).not.toContain('async dogovor(');
    expect(productionComposition).toContain('...supabaseIzvor');
    expect(productionComposition).toContain('...agreementClientService');
    expect(productionComposition).not.toContain('agreementProductionOverrides');
  });

  it('unbound partial review data cannot establish eligibility or hide completed work in history', async () => {
    mockRpc.mockImplementation((name: string, args: { p_agreement_id?: string }) => Promise.resolve(name === 'rpc_list_my_agreements_page'
      ? { data: { items: [{ ...rawAgreement, id: 'rated', status: 'COMPLETED' }, { ...rawAgreement, id: 'due', status: 'COMPLETED' },
          { ...rawAgreement, id: 'broken', status: 'COMPLETED' }, rawAgreement], hasMore: false }, error: null }
      : args.p_agreement_id === 'due' ? { data: { eligible: true, review: null }, error: null }
      : args.p_agreement_id === 'rated' ? { data: { eligible: false, review: { reviewId: 'r1' } }, error: null }
      : { data: null, error: { code: 'PGRST' } }));
    const result = await agreementClientService.mojiDogovori();
    expect(Object.fromEntries(result.map(row => [row.id, row.ocenaMoguca]))).toEqual({ rated: false, due: false, broken: false, 'agr-1': false });
    expect(result.filter(row => row.stanje === 'COMPLETED').every(row => row.stanjeProvereOcene === 'UNAVAILABLE')).toBe(true);
    // The review read is asked once per finished Dogovor and never for the others.
    expect(mockRpc.mock.calls.filter(([name]) => name === 'rpc_get_my_agreement_review').map(([, args]) => args.p_agreement_id).sort())
      .toEqual(['broken', 'due', 'rated']);
    mockRpc.mockReset();
  });

  it('mojiDogovori uses only the canonical paged list RPC and preserves projection mapping', async () => {
    mockRpc.mockResolvedValue({ data: { items: [rawAgreement], hasMore: false }, error: null });

    const result = await agreementClientService.mojiDogovori();

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls).toEqual([['rpc_list_my_agreements_page',
      { p_scope: 'ALL', p_limit: 100, p_before_at: null, p_before_id: null }]]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'agr-1',
      verzija: 4,
      naslov: 'Preuzmi paket',
      stanje: 'ACTIVE',
      cena: { iznos: 2400, valuta: 'RSD' },
      putanjaTekst: 'Centar, Novi Sad',
      pokrivenost: { ukupno: 3, popunjeno: 2, preostalo: 1, udeo: 2 / 3 },
      rezim: 'PREUZIMANJE_DOSTAVA',
      kontakt: {
        mojTelefonPodeljen: true,
        njihovTelefon: '+38160111222',
        lokacijaPostoji: true,
        tacnaLokacija: null,
        emailNijeDeljen: true,
      },
      chatDostupan: true,
      rokPotvrdeIso: '2026-09-06T08:00:00.000Z',
      problemOtvoren: false,
      ocenaMoguca: false,
    });
    expect(result[0].ucesnici).toEqual([
      expect.objectContaining({ id: 'requester-1', ime: 'Miloš', uloga: 'narucilac', viSte: true }),
      expect.objectContaining({ id: 'worker-1', ime: 'Ana', uloga: 'uskocer', viSte: false, mesta: 2 }),
    ]);
  });

  it('dogovor uses exact canonical workspace RPC params and mapping', async () => {
    mockRpc.mockResolvedValue({ data: rawAgreement, error: null });

    const result = await agreementClientService.dogovor('agr-1');

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls).toEqual([
      ['rpc_get_agreement_workspace', { p_agreement_id: 'agr-1' }],
    ]);
    expect(result).toMatchObject({
      id: 'agr-1',
      verzija: 4,
      naslov: 'Preuzmi paket',
      stanje: 'ACTIVE',
      rezim: 'PREUZIMANJE_DOSTAVA',
    });
  });

  it('mojiDogovori remains fail-loud on backend error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'LIST_DENIED' } });

    await expect(agreementClientService.mojiDogovori()).rejects.toThrow('AGREEMENT_LIST_FAILED');
    expect(mockRpc.mock.calls).toEqual([['rpc_list_my_agreements_page',
      { p_scope: 'ALL', p_limit: 100, p_before_at: null, p_before_id: null }]]);
  });

  it('mojiDogovori remains fail-loud on invalid projection', async () => {
    mockRpc.mockResolvedValue({ data: { unexpected: true }, error: null });

    await expect(agreementClientService.mojiDogovori()).rejects.toThrow(
      'AGREEMENT_LIST_INVALID_PROJECTION',
    );
  });

  it('dogovor preserves null workspace semantics', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(agreementClientService.dogovor('missing')).resolves.toBeNull();
    expect(mockRpc.mock.calls).toEqual([
      ['rpc_get_agreement_workspace', { p_agreement_id: 'missing' }],
    ]);
  });

  it('dogovor remains fail-loud on backend error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'WORKSPACE_DENIED' } });

    await expect(agreementClientService.dogovor('agr-1')).rejects.toThrow('AGREEMENT_READ_FAILED');
  });

  it('AUTH_REQUIRED is preserved and prevents RPC execution', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(agreementClientService.mojiDogovori()).rejects.toThrow('AUTH_REQUIRED');
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

it('uses immutable agreed terms rather than the mutable parent task schedule', async () => {
  resetHappyAuth();
  mockRpc.mockResolvedValue({ data: { ...rawAgreement, startsAt: '2030-01-01T12:00:00Z' }, error: null });
  const result = await agreementClientService.dogovor('agr-1');
  // Serbian time for both parties (owner decision 2026-09-21, deep read 8.27); tests run in UTC, so it is named.
  // One time format: minutes, and the year only when it is not the current one.
  expect(result?.vremeTekst).toMatch(/5\. sep( 2026)? · 12:00/);
  expect(result?.vremeTekst).toContain('po vremenu u Srbiji');
  expect(result?.vremeTekst).not.toContain('zona nije navedena');
  expect(result?.vremeTekst).toContain('kraj nije potvrđen');
  expect(result?.vremeTekst).not.toContain('2030');
});

it('does not turn a missing historical agreed interval into a new obligation from the current task', async () => {
  resetHappyAuth();
  mockRpc.mockResolvedValue({ data: { ...rawAgreement, terms: { ...rawAgreement.terms, proposed_start_at: null } }, error: null });
  const result = await agreementClientService.dogovor('agr-1');
  expect(result?.vremeTekst).toBe('Termin nije dogovoren');
});

it('shows both immutable accepted instants to the minute across midnight', async () => {
  resetHappyAuth();
  mockRpc.mockResolvedValue({ data: { ...rawAgreement, terms: { ...rawAgreement.terms,
    proposed_start_at: '2026-09-05T21:55:01.123456Z', proposed_end_at: '2026-09-05T22:25:02.654321Z' } }, error: null });
  const result = await agreementClientService.dogovor('agr-1');
  expect(result?.vremeTekst).toMatch(/5\. sep( 2026)? · 23:55 – 6\. sep( 2026)? · 00:25/); expect(result?.vremeTekst).not.toContain(':01');
  // The stored instants keep their microseconds; a person reads minutes.
  expect(result?.vremeTekst).not.toContain(':02'); expect(result?.vremeTekst).not.toContain('654321');
});

it('does not conceal a malformed accepted endpoint behind a valid start', async () => {
  resetHappyAuth();
  mockRpc.mockResolvedValue({ data: { ...rawAgreement, terms: { ...rawAgreement.terms, proposed_end_at: 'invalid' } }, error: null });
  expect((await agreementClientService.dogovor('agr-1'))?.vremeTekst).toBe('Termin nije dostupan');
});

// Deliberate contract change (plan step 0, 2026-09-23): the projection used to map a missing amount to novac(0), so
// a Dogovor without a saved price showed "0 RSD" like any other amount. It now keeps the shape with an empty display,
// and the screens say it in words.
it.each([['missing', undefined], ['null', null], ['zero', 0], ['negative', -500], ['unreadable', 'abc']])(
  'never turns a %s agreed amount into "0 RSD"', async (_name, price) => {
    resetHappyAuth();
    mockRpc.mockResolvedValue({ data: { ...rawAgreement, terms: { ...rawAgreement.terms, price_rsd: price } }, error: null });
    const result = await agreementClientService.dogovor('agr-1');
    expect(result?.cena).toEqual({ iznos: 0, valuta: 'RSD', prikaz: '' });
  });

it('keeps a real agreed amount exactly as before', async () => {
  resetHappyAuth();
  mockRpc.mockResolvedValue({ data: rawAgreement, error: null });
  expect((await agreementClientService.dogovor('agr-1'))?.cena).toEqual({ iznos: 2400, valuta: 'RSD', prikaz: '2.400 RSD' });
});

it('attributes accepted coverage to the worker when the viewing account is the worker', async () => {
  resetHappyAuth();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'worker-1' } }, error: null });
  mockRpc.mockResolvedValue({ data: rawAgreement, error: null });
  const result = await agreementClientService.dogovor('agr-1');
  expect(result?.ucesnici).toEqual([
    expect.objectContaining({ id: 'worker-1', uloga: 'uskocer', viSte: true, mesta: 2 }),
    expect.objectContaining({ id: 'requester-1', uloga: 'narucilac', viSte: false, mesta: null }),
  ]);
});

// One way to write initials (lib/inicijali, 2026-09-24): the emulator showed "MI" for "Milos SLJIVIC" here, where every
// other screen said "MS", and a missing name became "TI" or "DS", letters of nobody. A missing name now stays empty and
// the Avatar draws a person; the displayed name keeps its own fallback.
it('writes each side\'s initials from the real name only, and none for a missing name', async () => {
  resetHappyAuth();
  mockRpc.mockResolvedValue({ data: { ...rawAgreement, requesterName: 'Milos SLJIVIC', workerName: 'ana marija' }, error: null });
  expect((await agreementClientService.dogovor('agr-1'))?.ucesnici.map(person => person.inicijali)).toEqual(['MS', 'AM']);
  mockRpc.mockResolvedValue({ data: { ...rawAgreement, requesterName: null, workerName: '' }, error: null });
  const missing = await agreementClientService.dogovor('agr-1');
  expect(missing?.ucesnici.map(person => person.inicijali)).toEqual(['', '']);
  expect(missing?.ucesnici.map(person => person.ime)).toEqual(['Ti', 'Druga strana']);
});
