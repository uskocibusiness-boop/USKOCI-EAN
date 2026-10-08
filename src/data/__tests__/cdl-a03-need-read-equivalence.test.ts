/**
 * CDL-A03 — canonical Need read contract after deletion.
 *
 * Pre-deletion equivalence was proven by PRE-P4 run 33954247260. These tests
 * now lock the canonical request/mapping/error behavior and prove the old Need
 * read owners are physically absent.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../supabaseClient', () => {
  const mockGetUser = jest.fn();
  const mockFrom = jest.fn();
  const mockSelect = jest.fn();
  const mockEq = jest.fn();
  const mockOrder = jest.fn();
  const mockMaybeSingle = jest.fn();
  const mockRpc = jest.fn((name: string) => name === 'rpc_list_my_tasks' ? mockOrder() : mockMaybeSingle());

  const builder = {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    maybeSingle: mockMaybeSingle,
  };

  mockFrom.mockImplementation(() => builder);
  mockSelect.mockImplementation(() => builder);
  mockEq.mockImplementation(() => builder);

  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({
      auth: { getUser: mockGetUser },
      from: mockFrom,
      rpc: mockRpc,
    }),
    __testMocks: {
      mockRpc,
      mockGetUser,
      mockFrom,
      mockSelect,
      mockEq,
      mockOrder,
      mockMaybeSingle,
    },
  };
});

import { needClientService } from '../needClientService';
import { osoba } from '../../ui/system/plural';
import { needGeographyRows, needRequirementRows, needScheduleText, needPriceBasisNote, needPriceText, readableTitle } from '../needDetailPresentation';

const mocks = (jest.requireMock('../supabaseClient') as {
  __testMocks: {
    mockRpc: jest.Mock;
    mockGetUser: jest.Mock;
    mockFrom: jest.Mock;
    mockSelect: jest.Mock;
    mockEq: jest.Mock;
    mockOrder: jest.Mock;
    mockMaybeSingle: jest.Mock;
  };
}).__testMocks;

function reset() {
  Object.values(mocks).forEach((mock) => mock.mockClear());
  mocks.mockGetUser.mockResolvedValue({
    data: { user: { id: 'requester-1' } },
    error: null,
  });
  mocks.mockOrder.mockResolvedValue({ data: [], error: null });
  mocks.mockMaybeSingle.mockResolvedValue({ data: null, error: null });
}

const rawNeed = {
  id: 'need-1',
  revision: 4,
  title: 'Preuzmi paket',
  description: 'Preuzmi paket u centru i donesi na Liman.',
  status: 'PUBLISHED', category: 'Dostava', schedule_kind: 'FIXED_WINDOW', ends_at: '2026-09-06T11:00:00.000Z',
  task_country_code: 'RS', task_timezone: 'Europe/Belgrade', execution_location_mode: 'STATIONARY',
  need_geography: null, need_requirement_details: null, required_licenses: [], minimum_experience_years: null, verified_identity_required: false,
  starts_at: '2026-09-06T10:00:00.000Z',
  approximate_area: 'Centar',
  approximate_city: 'Novi Sad',
  required_slots: 2,
  required_skills: ['dostava'],
  required_tools: ['kolica'],
  required_vehicles: ['automobil'],
  covered_slots: 1,
  selectable_application_count: 1,
  mode: 'MY_PRICE',
  requester_price_rsd: 2500,
  marketplace_responses: [{ id: 'response-1' }],
};

describe('CDL-A03 — canonical Need read contract', () => {
  beforeEach(reset);

  it('PKG-045: reads selectable count in the explicit document and preserves the historical total', async () => {
    mocks.mockOrder.mockResolvedValue({ error: null, data: [{ ...rawNeed, selectable_application_count: 0 }] });
    const [row] = await needClientService.mojePotrebe();
    expect(row).toMatchObject({ brojPrijava: 1, brojPrijavaZaIzbor: 0, stanje: 'OBJAVLJENA' });
    expect(mocks.mockRpc).toHaveBeenCalledWith('rpc_list_my_tasks');
    expect(mocks.mockFrom).not.toHaveBeenCalled();
  });
  it.each([undefined, -1, 1.5, '2', Number.NaN])('rejects an invalid count instead of substituting history: %p', async count => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, selectable_application_count: count } });
    await expect(needClientService.potreba(rawNeed.id)).rejects.toThrow('NEED_ACTIONABLE_COUNT_INVALID');
  });
  it('preserves null when the server does not disclose the owner count', async () => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, selectable_application_count: null } });
    expect((await needClientService.potreba(rawNeed.id))?.brojPrijavaZaIzbor).toBeNull();
  });

  it('transitional Need override is deleted and baseline no longer owns migrated reads', () => {
    const dataDir = join(__dirname, '..');
    const baseline = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');
    const indexSource = readFileSync(join(dataDir, 'index.ts'), 'utf8');
    const productionStart = indexSource.indexOf('const produkcijskiIzvor');
    const productionEnd = indexSource.indexOf('export const izvor');
    const composition = indexSource.slice(productionStart, productionEnd);

    expect(existsSync(join(dataDir, 'needProductionOverrides.ts'))).toBe(false);
    expect(baseline).not.toContain('async mojePotrebe(');
    expect(baseline).not.toContain('async potreba(');
    expect(composition).toContain('...needClientService');
    expect(composition).not.toContain('needProductionOverrides');
  });

  it('mojePotrebe preserves auth, owner-scoped RPC and mapped projection', async () => {
    mocks.mockOrder.mockResolvedValue({ data: [rawNeed], error: null });

    const result = await needClientService.mojePotrebe();

    expect(mocks.mockGetUser).toHaveBeenCalledTimes(1);
    expect(mocks.mockRpc).toHaveBeenCalledWith('rpc_list_my_tasks');
    expect(mocks.mockFrom).not.toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({
        id: 'need-1',
        revizija: 4,
        naslov: 'Preuzmi paket',
        stanje: 'CEKA_PRIJAVE',
        pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 },
        podrucjeTekst: 'Centar, Novi Sad',
        uslovi: ['dostava', 'kolica', 'automobil'],
        brojPrijava: 1,
        brojPrijavaZaIzbor: 1,
        rezimCene: 'MY_PRICE',
        ponudjenaCena: expect.objectContaining({ iznos: 2500, valuta: 'RSD' }),
      }),
    ]);
  });

  it('mojePotrebe remains fail-loud for auth error and unauthenticated state', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'AUTH_BROKEN' } });
    await expect(needClientService.mojePotrebe()).rejects.toThrow('AUTH_BROKEN');
    expect(mocks.mockFrom).not.toHaveBeenCalled();

    reset();
    mocks.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(needClientService.mojePotrebe()).rejects.toThrow('AUTH_REQUIRED');
    expect(mocks.mockFrom).not.toHaveBeenCalled();
  });

  it('mojePotrebe remains fail-loud for backend, invalid projection and unsupported status', async () => {
    mocks.mockOrder.mockResolvedValue({ data: null, error: { message: 'NEEDS_DENIED' } });
    await expect(needClientService.mojePotrebe()).rejects.toThrow('NEEDS_DENIED');

    reset();
    mocks.mockOrder.mockResolvedValue({ data: { invalid: true }, error: null });
    await expect(needClientService.mojePotrebe()).rejects.toThrow('NEED_LIST_INVALID_PROJECTION');

    reset();
    mocks.mockOrder.mockResolvedValue({
      data: [{ ...rawNeed, status: 'UNKNOWN_STATE' }],
      error: null,
    });
    await expect(needClientService.mojePotrebe()).rejects.toThrow(
      'NEED_STATUS_UNSUPPORTED:UNKNOWN_STATE',
    );
  });

  it('potreba preserves trim, detail RPC and mapped projection', async () => {
    mocks.mockMaybeSingle.mockResolvedValue({
      data: { ...rawNeed, status: 'SELECTION' },
      error: null,
    });

    const result = await needClientService.potreba('  need-1  ');

    expect(mocks.mockRpc).toHaveBeenCalledWith('rpc_read_task', { p_need_id: 'need-1' });
    expect(mocks.mockFrom).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      id: 'need-1',
      stanje: 'DELIMICNO_POPUNJENA',
      pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 },
    }));
  });

  it('potreba preserves blank-id, missing-row and backend-error semantics', async () => {
    await expect(needClientService.potreba('   ')).resolves.toBeNull();
    expect(mocks.mockFrom).not.toHaveBeenCalled();

    reset();
    mocks.mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(needClientService.potreba('missing')).resolves.toBeNull();

    reset();
    mocks.mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'NEED_DENIED' } });
    await expect(needClientService.potreba('need-1')).rejects.toThrow('NEED_DENIED');
  });
});


describe('V2 saved Need detail uses the existing public relations', () => {
  beforeEach(reset);
  const geo = { mode: 'MULTI_STOP', start: { city: 'Novi Sad', area: 'Liman' },
    waypoints: [{ city: 'Petrovaradin', label: 'Prvo preuzimanje' }, { city: 'Beočin', area: 'Druga stanica' }],
    end: { city: 'Sremska Kamenica', area: 'Odredište' } };
  it('reads full public topology, category and both instants in one scoped existing query', async () => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed,
      execution_location_mode: 'MULTI_STOP', need_geography: { public_topology: geo },
      need_sensitive: { exact_address: 'SECRET address', resolved_location: { exact_lat: 45.123456 } } } });
    const result = (await needClientService.potreba(rawNeed.id))!;
    expect(result.detalji).toMatchObject({ kategorija: 'Dostava', geografija: geo });
    expect(result.schedule).toEqual({ kind: 'FIXED_WINDOW', startsAt: rawNeed.starts_at, endsAt: rawNeed.ends_at });
    const rows = needGeographyRows(result);
    expect(rows.map(row => row.label)).toEqual(['Način izvršenja', 'Polazište', 'Stanica 1', 'Stanica 2', 'Odredište']);
    expect(rows[4].value).toBe('Sremska Kamenica · Odredište');
    expect(result.vremeTekst).toContain('12:00'); expect(result.vremeTekst).toContain('13:00');
    expect(result.vremeTekst).toContain('po vremenu u Srbiji');
    expect(JSON.stringify(result)).not.toMatch(/SECRET|exact_address|resolved_location|exact_lat/);
    expect(mocks.mockRpc).toHaveBeenCalledWith('rpc_read_task', { p_need_id: rawNeed.id });
    expect(mocks.mockFrom).not.toHaveBeenCalled();
  });
  it('says what a price is for, and says nothing new about a task that never declared one', () => {
    const money = (iznos: number) => ({ iznos, valuta: 'RSD' as const, prikaz: `${iznos.toLocaleString('sr-Latn-RS')} RSD` });
    const six = { pokrivenost: { ukupno: 6 } };

    // A null basis is every task that exists today. It must read exactly as it always has.
    expect(needPriceText({ rezimCene: 'MY_PRICE', ponudjenaCena: money(3000), osnovaCene: null, ...six })).toBe('3.000 RSD');
    expect(needPriceText({ rezimCene: 'MY_PRICE', ponudjenaCena: money(3000), ...six }, { withTotal: true })).toBe('3.000 RSD');
    expect(needPriceText({ rezimCene: 'OFFERS', ...six })).toBe('Tražim ponude');
    expect(needPriceText({ rezimCene: 'MY_PRICE', ...six })).toBe('Cena nije navedena');

    // The owner's own example, 2026-09-19: six people, 3000 per person, 18000 for the task.
    expect(needPriceText({ rezimCene: 'MY_PRICE', ponudjenaCena: money(3000), osnovaCene: 'PER_PERSON', ...six }))
      .toBe('3.000 RSD po osobi');
    expect(needPriceText({ rezimCene: 'MY_PRICE', ponudjenaCena: money(3000), osnovaCene: 'PER_PERSON', ...six }, { withTotal: true }))
      .toBe('3.000 RSD po osobi · ukupno 18.000 RSD');
    // For one person a per-person price IS the total, so the arithmetic is not spelled out.
    expect(needPriceText({ rezimCene: 'MY_PRICE', ponudjenaCena: money(3000), osnovaCene: 'PER_PERSON', pokrivenost: { ukupno: 1 } }, { withTotal: true }))
      .toBe('3.000 RSD po osobi');

    expect(needPriceText({ rezimCene: 'MY_PRICE', ponudjenaCena: money(18000), osnovaCene: 'TOTAL', ...six })).toBe('18.000 RSD ukupno');
  });
  // The draft card in the interview is built around one big green number, so the combined string
  // does not fit it. The owner saw that card read 5.000 for a three-person task costing 15.000 and
  // refused it. The note is what goes under the number instead, and it must never contradict the
  // sentence above, which is why the two live in one file.
  it('states what a price is for under a big number, without repeating the number', () => {
    const three = { pokrivenost: { ukupno: 3 } };
    expect(needPriceBasisNote({ osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 5000 }, ...three }))
      .toBe('po osobi · ukupno 15.000 RSD');
    expect(needPriceBasisNote({ osnovaCene: 'TOTAL', ponudjenaCena: { iznos: 15000 }, ...three }))
      .toBe('ukupno za ceo zadatak');

    // Nothing to disambiguate: one person, an unknown headcount, or no basis at all. A task written
    // before 2026-09-20 has no basis and its card must look exactly as it always has.
    expect(needPriceBasisNote({ osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 5000 }, pokrivenost: { ukupno: 1 } })).toBe('po osobi');
    expect(needPriceBasisNote({ osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 5000 } })).toBe('po osobi');
    expect(needPriceBasisNote({ osnovaCene: null, ponudjenaCena: { iznos: 5000 }, ...three })).toBeNull();
    expect(needPriceBasisNote({ ponudjenaCena: { iznos: 5000 }, ...three })).toBeNull();

    // It never states a total it cannot compute.
    expect(needPriceBasisNote({ osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: Number.NaN }, ...three })).toBe('po osobi');
    expect(needPriceBasisNote({ osnovaCene: 'PER_PERSON', ...three })).toBe('po osobi');

    // The note and the sentence agree about the same price.
    const input = { rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 5000, prikaz: '5.000 RSD' }, osnovaCene: 'PER_PERSON' as const, ...three };
    expect(needPriceText(input, { withTotal: true })).toBe(`${input.ponudjenaCena.prikaz} ${needPriceBasisNote(input)}`);
  });
  it('shows a title without the quotation marks the interview wrapped it in, and keeps the stored value', async () => {
    // Six of seventeen tasks on canonical DEV are stored as `"Hitno prenošenje troseda"`. The repair
    // belongs in the prompt that writes them; until then the screens tidy it the way the category is
    // already tidied. Only a matched pair goes, so a title that genuinely quotes something keeps it.
    expect(readableTitle('"Hitno prenošenje troseda"')).toBe('Hitno prenošenje troseda');
    expect(readableTitle('„Hitno prenošenje troseda“')).toBe('Hitno prenošenje troseda');
    expect(readableTitle('  Prevoz   i   montaža  ')).toBe('Prevoz i montaža');
    expect(readableTitle('Prevoz "Sahara" tehnikom')).toBe('Prevoz "Sahara" tehnikom');
    expect(readableTitle('Citat na kraju"')).toBe('Citat na kraju"');
    expect(readableTitle(null)).toBe('');

    // The projection itself is untouched: the stored value is the server's.
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, title: '"Hitno prenošenje troseda"' } });
    expect((await needClientService.potreba(rawNeed.id))!.naslov).toBe('"Hitno prenošenje troseda"');
  });
  it('names one day once, and keeps the exact instant it was given', async () => {
    // On a phone this read "20. sep 2026 · 06:38:53 – 20. sep 2026 · 09:38:53". The second date says
    // nothing the first did not. The seconds stay: for a Dogovor the exact instant is the thing
    // being agreed, and my-applications-native pins it to the microsecond.
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, task_timezone: 'Europe/Belgrade',
      starts_at: '2026-09-20T04:38:53.000000Z', ends_at: '2026-09-20T07:38:53.000000Z' } });
    const sameDay = (await needClientService.potreba(rawNeed.id))!.vremeTekst;
    // One time format: minutes only, the two hours of one day joined, the day named once.
    expect(sameDay).toContain('06:38–09:38'); expect(sameDay).not.toContain(':53');
    expect(sameDay.split('2026').length - 1).toBeLessThanOrEqual(1);

    // Across two days both are named, because then the second one is the news.
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, task_timezone: 'Europe/Belgrade',
      starts_at: '2026-09-20T20:00:00.000000Z', ends_at: '2026-09-21T04:00:00.000000Z' } });
    const across = (await needClientService.potreba(rawNeed.id))!.vremeTekst;
    expect(across).toMatch(/20\. sep( 2026)? · 22:00 – 21\. sep( 2026)? · 06:00/);
  });
  it('reads the coarse point the owner never asked for, and never a precise one', async () => {
    // The public reader hands `approximate_lat/lng` to every signed-in viewer as `pin`; the owner's
    // own read did not select them, so a stranger saw the Task on a map and its owner did not. The
    // column type is the coarseness — numeric(6,2)/(7,2), about a kilometre — so there is nothing
    // to round here, and nothing precise is reachable from this query at all.
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, approximate_lat: 45.25, approximate_lng: 19.83 } });
    expect((await needClientService.potreba(rawNeed.id))!.priblizno).toEqual({ lat: 45.25, lng: 19.83 });
    expect(mocks.mockRpc).toHaveBeenCalledWith('rpc_read_task', { p_need_id: rawNeed.id });
    expect(mocks.mockFrom).not.toHaveBeenCalled();

    // PostgREST may hand a numeric back as a string; a task without a point stays without one.
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, approximate_lat: '45.25', approximate_lng: '19.83' } });
    expect((await needClientService.potreba(rawNeed.id))!.priblizno).toEqual({ lat: 45.25, lng: 19.83 });
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, approximate_lat: null, approximate_lng: null } });
    expect((await needClientService.potreba(rawNeed.id))!.priblizno).toBeNull();
  });
  it('preserves every requirement group without treating a requirement as earned verification', async () => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, required_licenses: ['B', 'B'],
      minimum_experience_years: 0, verified_identity_required: true, need_requirement_details: { critical_conditions: ['Bez lifta', 'Pristup sa dvorišta'] } } });
    const result = (await needClientService.potreba(rawNeed.id))!;
    expect(needRequirementRows(result)).toEqual([
      { label: 'Veštine', value: '• dostava' }, { label: 'Alat', value: '• kolica' }, { label: 'Vozilo', value: '• automobil' },
      { label: 'Dozvole', value: '• B\n• B' }, { label: 'Bitni uslovi', value: '• Bez lifta\n• Pristup sa dvorišta' },
      { label: 'Najmanje iskustva', value: '0 god.' }, { label: 'Identitet', value: 'Potreban je potvrđen identitet' },
    ]);
  });
  it('preserves historical null geography/country/zone without inferring Serbia or a single start', async () => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, task_country_code: null, task_timezone: null, execution_location_mode: null } });
    const result = (await needClientService.potreba(rawNeed.id))!;
    expect(result.taskCountryCode).toBeUndefined(); expect(result.taskTimezone).toBeUndefined();
    expect(result.detalji?.geografija).toBeNull(); expect(result.detalji?.rezimLokacije).toBeNull();
    expect(needGeographyRows(result)).toEqual([{ label: 'Približno područje', value: 'Centar, Novi Sad' }]);
    expect(result.vremeTekst).toContain('10:00'); expect(result.vremeTekst).toContain('UTC · zona nije navedena');
  });
  it('keeps Remote explicit and does not display physical fallback cities', async () => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, execution_location_mode: 'REMOTE',
      need_geography: { public_topology: { mode: 'REMOTE' } }, schedule_kind: 'REMOTE_ANYTIME', starts_at: null, ends_at: null } });
    const result = (await needClientService.potreba(rawNeed.id))!;
    expect(needGeographyRows(result)).toEqual([{ label: 'Način izvršenja', value: 'Na daljinu' }]);
    expect(result.vremeTekst).toBe('Na daljinu, fleksibilno');
  });
  it.each([
    { need_geography: [{ public_topology: geo }] },
    { need_geography: { public_topology: null } },
    { need_geography: { public_topology: 'malformed' } },
    { need_requirement_details: { critical_conditions: ['Valid', 4] } },
    { ends_at: '2026-09-06T09:00:00.000Z' }, { ends_at: '2026-02-30T10:00:00Z' },
    { category: undefined }, { task_country_code: 'rs' }, { task_timezone: 'Invented/Zone' },
  ])('rejects unreadable/mismatched detail rather than silently removing it: %o', async patch => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, ...patch } });
    await expect(needClientService.potreba(rawNeed.id)).rejects.toThrow('NEED_DETAIL_INVALID_PROJECTION');
  });
});


describe('saved Need schedule and people presentation', () => {
  it('labels flexible endpoints as a preference rather than a fixed booking', () => {
    const value = needScheduleText({ kind: 'WEEK_FLEXIBLE', startsAt: '2026-09-10T16:00:00Z', endsAt: '2026-09-12T17:00:00Z' }, 'Europe/Belgrade');
    expect(value).toContain('Fleksibilno'); expect(value).toContain('10.'); expect(value).toContain('12.');
    expect(value).toContain('18:00'); expect(value).toContain('19:00');
  });
  it('distinguishes repeated civil times at the autumn DST boundary', () => {
    const value = needScheduleText({ kind: 'FIXED_WINDOW', startsAt: '2026-10-25T00:30:00Z', endsAt: '2026-10-25T01:30:00Z' }, 'Europe/Belgrade');
    expect(value.match(/02:30/g)).toHaveLength(2); expect(value).toContain('UTC+02:00'); expect(value).toContain('UTC+01:00');
  });
  it('writes minutes, never seconds, and never fabricates an unknown fixed endpoint', () => {
    const value = needScheduleText({ kind: 'FIXED_WINDOW', startsAt: '2026-09-10T16:00:00.123456Z', endsAt: null }, 'Europe/Belgrade');
    expect(value).toContain('Od '); expect(value).toContain('18:00'); expect(value).not.toContain('18:00:00'); expect(value).not.toContain(' – ');
    expect(needScheduleText({ kind: 'FIXED_WINDOW', startsAt: null, endsAt: null })).toBe('Tačan termin nije potpun');
  });
  it('an end of day is a date, not "23:59:59" (seen on the phone 2026-09-23: "Do 31. dec 2026 · 23:59:59")', () => {
    const now = new Date('2026-09-23T12:00:00Z');
    const at = (schedule: Parameters<typeof needScheduleText>[0]) => needScheduleText(schedule, 'Europe/Belgrade', now);
    expect(at({ kind: 'FLEXIBLE', startsAt: null, endsAt: '2026-12-31T22:59:59.999999Z' })).toBe('Fleksibilno · Do 31. dec (po vremenu u Srbiji)');
    expect(at({ kind: 'FLEXIBLE', startsAt: '2026-09-11T22:00:00Z', endsAt: '2026-09-12T21:59:59Z' })).toBe('Fleksibilno · 12. sep (po vremenu u Srbiji)');
    expect(at({ kind: 'FLEXIBLE', startsAt: '2026-09-12T06:00:00Z', endsAt: '2026-09-12T21:59:59Z' })).toBe('Fleksibilno · 12. sep · 08:00 – kraj dana (po vremenu u Srbiji)');
    // A flexible range that ends at midnight ends with the day before it (review of 2026-09-23: it read a day too long).
    expect(at({ kind: 'FLEXIBLE', startsAt: '2026-09-12T06:00:00Z', endsAt: '2026-09-13T22:00:00Z' })).toBe('Fleksibilno · 12. sep · 08:00 – 13. sep (po vremenu u Srbiji)');
    expect(at({ kind: 'FLEXIBLE', startsAt: null, endsAt: '2026-09-13T22:00:00Z' })).toBe('Fleksibilno · Do 13. sep (po vremenu u Srbiji)');
    expect(at({ kind: 'FLEXIBLE', startsAt: '2026-09-11T22:00:00Z', endsAt: '2026-09-12T22:00:00Z' })).toBe('Fleksibilno · 12. sep (po vremenu u Srbiji)');
    // A fixed window keeps every instant it names, to the minute; one day is named once and its hours are joined.
    expect(at({ kind: 'FIXED_WINDOW', startsAt: '2026-09-11T18:00:00Z', endsAt: '2026-09-12T21:59:59Z' })).toBe('11. sep · 20:00 – 12. sep · 23:59 (po vremenu u Srbiji)');
    expect(at({ kind: 'FIXED_WINDOW', startsAt: '2026-09-11T22:00:00Z', endsAt: '2026-09-12T00:00:00Z' })).toBe('12. sep · 00:00–02:00 (po vremenu u Srbiji)');
    // Another year is written out.
    expect(needScheduleText({ kind: 'FIXED_WINDOW', startsAt: '2027-01-05T09:00:00Z', endsAt: '2027-01-05T11:00:00Z' }, 'Europe/Belgrade', now)).toBe('5. jan 2027 · 10:00–12:00 (po vremenu u Srbiji)');
  });
  it.each([[1, 'osoba'], [2, 'osobe'], [5, 'osoba'], [11, 'osoba'], [12, 'osoba'], [14, 'osoba'], [22, 'osobe']])('labels %s people', (count, word) => {
    expect(osoba(count as number)).toBe(`${count} ${word}`);
  });
});


describe('schema-compatible historical Need detail', () => {
  beforeEach(reset);
  it.each([' '.repeat(200) + '😀'.repeat(120) + ' '.repeat(200), '\t'])('uses actual SQL ASCII btrim/codepoint category bounds without overwriting the value', async category => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, category } });
    expect((await needClientService.potreba(rawNeed.id))!.detalji!.kategorija).toBe(category);
  });
  it.each([null, '', '   ', '😀'.repeat(121)])('rejects category impossible under the current NOT NULL/check schema', async category => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, category } });
    await expect(needClientService.potreba(rawNeed.id)).rejects.toThrow('NEED_DETAIL_INVALID_PROJECTION');
  });
  it.each([
    { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad' }, end: { city: 'Beočin' } },
    { mode: 'STATIONARY', start: { city: 42 } },
    { mode: 'STATIONARY', start: { city: 'Novi Sad', exactAddress: 'SECRET' } },
    {},
  ])('keeps schema-legal pre-normalizer or mode-mismatched topology readable as unknown: %o', async public_topology => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, need_geography: { public_topology } } });
    const result = (await needClientService.potreba(rawNeed.id))!;
    expect(result.naslov).toBe(rawNeed.title); expect(result.detalji!.geografija).toBeNull();
    expect(result.detalji!.rezimLokacije).toBe('STATIONARY');
    expect(needGeographyRows(result)).toEqual([{ label: 'Približno područje', value: 'Centar, Novi Sad' }]);
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it.each(['FIXED_WINDOW','FLEXIBLE','REMOTE_ANYTIME','TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE'])('keeps required existing schedule enum %s with nullable endpoints', async schedule_kind => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, schedule_kind, starts_at: null, ends_at: null } });
    expect((await needClientService.potreba(rawNeed.id))!.schedule).toEqual({ kind: schedule_kind, startsAt: null, endsAt: null });
  });
  it.each([null, undefined, 'DATE_RANGE'])('rejects a missing or noncanonical schedule kind', async schedule_kind => {
    mocks.mockMaybeSingle.mockResolvedValue({ error: null, data: { ...rawNeed, schedule_kind } });
    await expect(needClientService.potreba(rawNeed.id)).rejects.toThrow('NEED_DETAIL_INVALID_PROJECTION');
  });
});
