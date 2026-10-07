/**
 * RU-5 / P0C-03 — My Applications client cutover.
 *
 * Locks the canonical RPC/DTO/withdraw binding and ensures the removed RU-4
 * raw-table reader does not reappear as a second production owner.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { applicationClientService } from '../applicationClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

const rawApplication = {
  applicationId: 'response-1',
  needId: 'need-1',
  needRevision: 3,
  submittedNeedRevision: 3,
  version: 2,
  state: 'VIEWED',
  title: 'Preuzmi paket',
  description: 'Preuzimanje u centru',
  approximateCity: 'Novi Sad',
  approximateArea: 'Centar',
  startsAt: '2026-09-06T10:30:00.000Z',
  priceRsd: 2400,
  coveredSlots: 1,
  scopeNote: 'Mogu pre podne',
  agreementId: null,
  requiresStaleReview: false,
  attentionRequired: false,
  canWithdraw: true,
  submittedAt: '2026-09-05T18:00:00.000Z',
};

describe('RU-5 P0C-03 — canonical My Applications client', () => {
  beforeEach(() => mockRpc.mockReset());

  it('has one production read owner and no RU-4 raw My Applications reader', () => {
    const indexSource = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');
    const ru4Source = readFileSync(join(__dirname, '..', 'ru4Production.ts'), 'utf8');
    const productionStart = indexSource.indexOf('const produkcijskiIzvor');
    const productionEnd = indexSource.indexOf('export const izvor');
    const productionComposition = indexSource.slice(productionStart, productionEnd);

    expect(productionComposition).toContain('...applicationClientService');
    expect(ru4Source).not.toContain('async mojePrijave(');
    expect(ru4Source).not.toContain("from('marketplace_responses')");
  });

  it('reads only the canonical list RPC and maps Worker-facing projection', async () => {
    mockRpc.mockResolvedValue({ data: [rawApplication], error: null });

    const result = await applicationClientService.mojePrijave();

    expect(mockRpc.mock.calls).toEqual([['rpc_list_my_applications']]);
    expect(result).toEqual([
      expect.objectContaining({
        prijavaId: 'response-1',
        potrebaId: 'need-1',
        potrebaRevizija: 3,
        prijavaRevizija: 3,
        prijavaVerzija: 2,
        stanje: 'VIEWED',
        naslov: 'Preuzmi paket',
        cena: { iznos: 2400, valuta: 'RSD', prikaz: '2.400 RSD' },
        pokrivaMesta: 1,
        podrucjeTekst: 'Centar, Novi Sad',
        dogovorId: null,
        promenjenaPotreba: false,
        mozePovuci: true,
        traziPaznju: false,
      }),
    ]);
  });

  it('preserves selected Agreement link and disables withdraw from projection', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        ...rawApplication,
        state: 'SELECTED',
        agreementId: 'agreement-1',
        canWithdraw: false,
        attentionRequired: true,
      }],
      error: null,
    });

    const [row] = await applicationClientService.mojePrijave();
    expect(row).toMatchObject({
      stanje: 'SELECTED',
      dogovorId: 'agreement-1',
      mozePovuci: false,
      traziPaznju: true,
    });
  });

  it('fails loudly on unknown server lifecycle state', async () => {
    mockRpc.mockResolvedValue({ data: [{ ...rawApplication, state: 'DELIVERED' }], error: null });
    await expect(applicationClientService.mojePrijave()).rejects.toThrow('MY_APPLICATIONS_INVALID_STATE:DELIVERED');
  });

  it('binds exact response, Need revision, response version and request key to withdraw RPC', async () => {
    mockRpc.mockResolvedValue({
      data: { status: 'WITHDRAWN', version: 2, authoritative: true, idempotentReplay: false },
      error: null,
    });

    const result = await applicationClientService.povuciPrijavu({
      prijavaId: 'response-1',
      potrebaRevizija: 3,
      prijavaVerzija: 2,
      clientRequestId: 'withdraw-request-123',
      razlog: null,
    });

    expect(mockRpc.mock.calls).toEqual([[
      'rpc_withdraw_response',
      {
        p_response_id: 'response-1',
        p_need_revision: 3,
        p_response_version: 2,
        p_client_request_id: 'withdraw-request-123',
        p_reason: null,
      },
    ]]);
    expect(result).toEqual({ ok: true, podatak: { stanje: 'WITHDRAWN', verzija: 2 } });
  });

  it('does not invent success when withdrawal RPC rejects or returns a non-withdrawn state', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'RESPONSE_ALREADY_SELECTED' } });
    const rejected = await applicationClientService.povuciPrijavu({
      prijavaId: 'response-1',
      potrebaRevizija: 3,
      prijavaVerzija: 2,
      clientRequestId: 'withdraw-request-456',
      razlog: null,
    });
    expect(rejected).toMatchObject({ ok: false, kod: 'RESPONSE_ALREADY_SELECTED' });

    mockRpc.mockResolvedValueOnce({ data: { status: 'SUBMITTED', version: 2 }, error: null });
    const invalid = await applicationClientService.povuciPrijavu({
      prijavaId: 'response-1',
      potrebaRevizija: 3,
      prijavaVerzija: 2,
      clientRequestId: 'withdraw-request-789',
      razlog: null,
    });
    expect(invalid).toEqual({
      ok: false,
      kod: 'WITHDRAW_RESPONSE_INVALID_RESULT',
      poruka: 'Povlačenje prijave nije potvrđeno.',
    });
  });

  it('never fills a missing server version with the version the client sent', async () => {
    for (const version of [undefined, null, 0, -1, 2.5, '2', Number.MAX_SAFE_INTEGER + 1]) {
      mockRpc.mockResolvedValueOnce({ data: { status: 'WITHDRAWN', version, authoritative: true }, error: null });
      const result = await applicationClientService.povuciPrijavu({
        prijavaId: 'response-1',
        potrebaRevizija: 3,
        prijavaVerzija: 2,
        clientRequestId: 'withdraw-request-version',
        razlog: null,
      });
      expect(result).toEqual({
        ok: false,
        kod: 'WITHDRAW_RESPONSE_INVALID_RESULT',
        poruka: 'Povlačenje prijave nije potvrđeno.',
      });
    }
  });
});
