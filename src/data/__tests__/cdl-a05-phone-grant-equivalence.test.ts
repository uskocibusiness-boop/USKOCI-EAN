/**
 * CDL-A05 — canonical PHONE grant/revoke contract.
 *
 * Pre-deletion old-vs-new equivalence was proven by PRE-P4 run 33957532925.
 * Current messages-only policy also prevents new PHONE grants in the client.
 * After deletion these tests lock the canonical RPC/error contract and prove
 * both migrated commands have one physical production owner.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ID = '00000000-0000-4000-8000-000000000002';
const AGREEMENT_ID = '00000000-0000-4000-8000-000000000010';

jest.mock('../../store/sesija', () => ({
  sesijaSada: () => ({
    user: { id: '00000000-0000-4000-8000-000000000001' },
    accountRevision: 1,
  }),
}));

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

  it('podeliTelefon refuses legacy sharing without any server call', async () => {
    resetRpc({ data: null, error: null });

    const result = await contactClientService.podeliTelefon('agr-1');

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      kod: 'PHONE_SHARING_DISABLED',
      poruka: 'Brojevi telefona se ne dele. Koristite poruke u aplikaciji.',
    });
  });

  it('opoziviTelefon keeps the historical revoke RPC and requires an authoritative owned receipt', async () => {
    resetRpc({ data: {
      authoritative: true, channel: 'PHONE', agreementId: AGREEMENT_ID,
      grantedByAccountId: ACCOUNT_ID, grantedToAccountId: OTHER_ID,
      granted: false, grantId: null,
    }, error: null });

    const result = await contactClientService.opoziviTelefon(AGREEMENT_ID);

    expect(mockRpc.mock.calls).toEqual([[
      'rpc_set_contact_grant',
      { p_agreement_id: AGREEMENT_ID, p_channel: 'PHONE', p_granted: false },
    ]]);
    expect(result).toEqual({ ok: true, podatak: null });
  });

  it('cannot claim revoke success from a void or foreign receipt', async () => {
    for (const data of [
      null,
      { authoritative: true, channel: 'PHONE', agreementId: AGREEMENT_ID,
        grantedByAccountId: OTHER_ID, grantedToAccountId: ACCOUNT_ID,
        granted: false, grantId: null },
      { authoritative: true, channel: 'PHONE', agreementId: AGREEMENT_ID,
        grantedByAccountId: ACCOUNT_ID, grantedToAccountId: OTHER_ID,
        granted: true, grantId: null },
      { authoritative: true, channel: 'EXACT_LOCATION', agreementId: AGREEMENT_ID,
        grantedByAccountId: ACCOUNT_ID, grantedToAccountId: OTHER_ID,
        granted: false, grantId: null },
    ]) {
      resetRpc({ data, error: null });
      const result = await contactClientService.opoziviTelefon(AGREEMENT_ID);
      expect(result).toMatchObject({ ok: false, kod: 'PHONE_REVOKE_INVALID' });
    }
  });

  it('preserves known server denial and reports unknown outcome without auto-resend', async () => {
    resetRpc({ data: null, error: { code: '42501', message: 'NOT_PARTY' } });
    expect(await contactClientService.opoziviTelefon(AGREEMENT_ID)).toEqual({
      ok: false, kod: 'NOT_PARTY', poruka: 'Niste učesnik ovog Dogovora.',
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    resetRpc({ data: null, error: { code: '42501', message: 'SERVER_UNKNOWN' } });
    expect(await contactClientService.opoziviTelefon(AGREEMENT_ID)).toMatchObject({
      ok: false, kod: 'PHONE_REVOKE_UNCONFIRMED',
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('blocks malformed Agreement references before any writer', async () => {
    resetRpc({ data: null, error: null });
    expect(await contactClientService.opoziviTelefon('agr-2')).toMatchObject({
      ok: false, kod: 'AGREEMENT_NOT_FOUND',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

});
