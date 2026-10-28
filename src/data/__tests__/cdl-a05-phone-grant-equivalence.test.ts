/**
 * CDL-A05 — canonical PHONE grant/revoke contract.
 *
 * Pre-deletion old-vs-new equivalence was proven by PRE-P4 run 33957532925.
 * After deletion these tests lock the canonical RPC/error contract and prove
 * both migrated commands have one physical production owner.
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

import { contactClientService } from '../contactClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

describe('CDL-A05 — canonical phone grant contract', () => {
  it('physically eliminates both transitional PHONE grant owners', () => {
    const dataDir = join(__dirname, '..');
    const indexSource = readFileSync(join(dataDir, 'index.ts'), 'utf8');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');

    expect(indexSource).toContain("import { contactClientService } from './contactClientService'");
    expect(indexSource).toContain('...contactClientService');
    expect(baselineSource).not.toContain('async podeliTelefon(');
    expect(baselineSource).not.toContain('async opoziviTelefon(');
    expect(baselineSource).toContain("'podeliTelefon'");
    expect(baselineSource).toContain("'opoziviTelefon'");
  });

  it('podeliTelefon preserves exact RPC, PHONE channel, granted=true and success', async () => {
    resetRpc({ data: null, error: null });

    const result = await contactClientService.podeliTelefon('agr-1');

    expect(mockRpc.mock.calls).toEqual([
      ['rpc_set_contact_grant', {
        p_agreement_id: 'agr-1',
        p_channel: 'PHONE',
        p_granted: true,
      }],
    ]);
    expect(result).toEqual({ ok: true, podatak: null });
  });

  it('opoziviTelefon preserves exact RPC, PHONE channel, granted=false and success', async () => {
    resetRpc({ data: null, error: null });

    const result = await contactClientService.opoziviTelefon('agr-2');

    expect(mockRpc.mock.calls).toEqual([
      ['rpc_set_contact_grant', {
        p_agreement_id: 'agr-2',
        p_channel: 'PHONE',
        p_granted: false,
      }],
    ]);
    expect(result).toEqual({ ok: true, podatak: null });
  });

  it.each([
    ['grant message', 'podeliTelefon', { message: 'GRANT_DENIED', code: '42501' }, { ok: false, kod: 'PHONE_GRANT_FAILED', poruka: 'Broj telefona nije podeljen.' }],
    ['grant code', 'podeliTelefon', { code: '42501' }, { ok: false, kod: 'PHONE_GRANT_FAILED', poruka: 'Broj telefona nije podeljen.' }],
    ['grant fallback', 'podeliTelefon', {}, { ok: false, kod: 'PHONE_GRANT_FAILED', poruka: 'Broj telefona nije podeljen.' }],
    ['revoke message', 'opoziviTelefon', { message: 'REVOKE_DENIED', code: '42501' }, { ok: false, kod: 'PHONE_REVOKE_FAILED', poruka: 'Deljenje telefona nije opozvano.' }],
    ['revoke code', 'opoziviTelefon', { code: '42501' }, { ok: false, kod: 'PHONE_REVOKE_FAILED', poruka: 'Deljenje telefona nije opozvano.' }],
    ['revoke fallback', 'opoziviTelefon', {}, { ok: false, kod: 'PHONE_REVOKE_FAILED', poruka: 'Deljenje telefona nije opozvano.' }],
  ])('preserves active error mapping: %s', async (_label, method, error, expected) => {
    resetRpc({ data: null, error });

    const result = method === 'podeliTelefon'
      ? await contactClientService.podeliTelefon('agr-error')
      : await contactClientService.opoziviTelefon('agr-error');

    expect(result).toEqual(expected);
  });
});
