/**
 * CDL-A02 — Agreement mutation override consolidation
 *
 * Pre-deletion old-vs-new equivalence was proven by PRE-P4 run 33953071145.
 * After deletion, these tests lock the canonical request/validation/error
 * contract and prove the migrated mutation methods have one physical owner.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  const mockGetUser = jest.fn();

  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    }),
    __testMocks: { mockRpc, mockGetUser },
  };
});

import { agreementClientService } from '../agreementClientService';
import type { IzmenaKomanda } from '../ports';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

const fullChange: IzmenaKomanda = {
  dogovorId: 'agr-1',
  ocekivanaVerzija: 7,
  razlog: 'Promena termina',
  clientRequestId: 'req-123',
  izmena: {
    cenaIznos: 3200,
    cenaValuta: 'RSD',
    pocetakIso: '2026-09-06T10:00:00.000Z',
    krajIso: '2026-09-06T12:00:00.000Z',
    obim: 'Preuzimanje i dostava dva paketa',
  },
};

describe('CDL-A02 — canonical Agreement mutation contract', () => {
  it('physically eliminates all transitional owners for the three migrated mutations', () => {
    const dataDir = join(__dirname, '..');
    const indexSource = readFileSync(join(dataDir, 'index.ts'), 'utf8');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');

    expect(existsSync(join(dataDir, 'agreementProductionOverrides.ts'))).toBe(false);
    expect(indexSource).not.toContain('agreementProductionOverrides');
    expect(indexSource).toContain('...agreementClientService');

    for (const method of ['predloziIzmenu', 'odgovoriNaIzmenu', 'posaljiPoruku']) {
      expect(baselineSource).not.toContain(`async ${method}(`);
      expect(baselineSource).toContain(`'${method}'`);
    }
  });

  it('retires the unkeyed send instead of inventing a retry key or calling V1', async () => {
    resetRpc({ data: 'msg-1', error: null });
    const result = await agreementClientService.posaljiPoruku('agr-1', '  Stižem u 17h.  ');
    expect(mockRpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, kod: 'MESSAGE_RETRY_KEY_REQUIRED',
      poruka: 'Otvori Poruke u Dogovoru i pošalji poruku iz tog prikaza.' });
  });

  it('posaljiPoruku preserves empty-body validation and makes no RPC call', async () => {
    resetRpc({ data: 'unused', error: null });

    const result = await agreementClientService.posaljiPoruku('agr-1', '   ');

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, kod: 'MESSAGE_REQUIRED', poruka: 'Unesi poruku.' });
  });

  it.each([
    [{ data: null, error: { message: 'CHAT_DENIED', code: '42501' } }, 'CHAT_DENIED'],
    [{ data: null, error: null }, 'MESSAGE_SEND_FAILED'],
  ])('retired send never reaches even a failed or empty V1 response %#', async (rpcResult, code) => {
    resetRpc(rpcResult);

    const result = await agreementClientService.posaljiPoruku('agr-1', 'Poruka');

    expect(result).toMatchObject({ ok: false, kod: 'MESSAGE_RETRY_KEY_REQUIRED' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('predloziIzmenu preserves exact full patch, version, reason and idempotency params', async () => {
    resetRpc({ data: 'proposal-1', error: null });

    const result = await agreementClientService.predloziIzmenu(fullChange);

    expect(mockRpc.mock.calls).toEqual([
      ['rpc_propose_agreement_change_v2', {
        p_agreement_id: 'agr-1',
        p_expected_version: 7,
        p_patch: {
          price_rsd: 3200,
          currency: 'RSD',
          proposed_start_at: '2026-09-06T10:00:00.000Z',
          proposed_end_at: '2026-09-06T12:00:00.000Z',
          scope_note: 'Preuzimanje i dostava dva paketa',
        },
        p_reason: 'Promena termina',
        p_client_request_id: 'req-123',
      }],
    ]);
    expect(result).toEqual({ ok: true, podatak: { predlogId: 'proposal-1' } });
  });

  it('predloziIzmenu preserves partial patch and null reason', async () => {
    const command: IzmenaKomanda = {
      dogovorId: 'agr-2',
      ocekivanaVerzija: 3,
      clientRequestId: 'req-partial',
      izmena: { cenaIznos: 0, obim: '' },
    };
    resetRpc({ data: 'proposal-2', error: null });

    await agreementClientService.predloziIzmenu(command);

    expect(mockRpc.mock.calls).toEqual([
      ['rpc_propose_agreement_change_v2', {
        p_agreement_id: 'agr-2',
        p_expected_version: 3,
        p_patch: { price_rsd: 0, scope_note: '' },
        p_reason: null,
        p_client_request_id: 'req-partial',
      }],
    ]);
  });

  it('predloziIzmenu preserves empty-patch validation and makes no RPC call', async () => {
    const command: IzmenaKomanda = {
      dogovorId: 'agr-1',
      ocekivanaVerzija: 1,
      clientRequestId: 'req-empty',
      izmena: {},
    };
    resetRpc({ data: 'unused', error: null });

    const result = await agreementClientService.predloziIzmenu(command);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      kod: 'CHANGE_PATCH_REQUIRED',
      poruka: 'Izmeni bar jedno polje Dogovora.',
    });
  });

  it.each([
    [{ data: null, error: { message: 'STALE_VERSION', code: 'P0001' } }, 'STALE_VERSION'],
    [{ data: null, error: null }, 'CHANGE_PROPOSAL_FAILED'],
  ])('predloziIzmenu preserves failure semantics %#', async (rpcResult, code) => {
    resetRpc(rpcResult);

    const result = await agreementClientService.predloziIzmenu(fullChange);

    expect(result).toMatchObject({ ok: false, kod: code });
  });

  it.each([true, false])('odgovoriNaIzmenu preserves exact RPC params for accept=%s', async (accept) => {
    resetRpc({ data: null, error: null });

    const result = await agreementClientService.odgovoriNaIzmenu('proposal-1', accept);

    expect(mockRpc.mock.calls).toEqual([
      ['rpc_respond_agreement_change', { p_proposal_id: 'proposal-1', p_accept: accept }],
    ]);
    expect(result).toEqual({ ok: true, podatak: null });
  });

  it('odgovoriNaIzmenu preserves backend error mapping', async () => {
    resetRpc({ data: null, error: { message: 'PROPOSAL_CLOSED', code: 'P0001' } });

    const result = await agreementClientService.odgovoriNaIzmenu('proposal-1', true);

    expect(result).toMatchObject({ ok: false, kod: 'PROPOSAL_CLOSED' });
  });
});
