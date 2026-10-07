/**
 * CDL-A07 — canonical Agreement completion-mark contract.
 *
 * Pre-deletion old-vs-new equivalence was proven by PRE-P4 run 33961448582.
 * After deletion these tests lock the canonical RPC/result/error contract and
 * prove oznaciZavrsetak has one physical production owner.
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

import { agreementClientService } from '../agreementClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

describe('CDL-A07 — canonical completion-mark contract', () => {
  it('physically eliminates both lower-precedence completion-mark owners', () => {
    const dataDir = join(__dirname, '..');
    const authoritySource = readFileSync(join(dataDir, 'productionAuthorityOverrides.ts'), 'utf8');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');
    const canonicalSource = readFileSync(join(dataDir, 'agreementClientService.ts'), 'utf8');

    expect(authoritySource).not.toContain('oznaciZavrsetak');
    expect(baselineSource).not.toContain('async oznaciZavrsetak(');
    expect(baselineSource).not.toContain('rokPotvrdeIso: new Date().toISOString()');
    expect(baselineSource).toContain("'oznaciZavrsetak'");
    expect(canonicalSource).toContain('async oznaciZavrsetak(');
    expect(canonicalSource).toContain("supabase.rpc('rpc_mark_work_done'");
    expect(canonicalSource).toContain('rokPotvrdeIso: data');
  });

  it('preserves exact rpc_mark_work_done params and server deadline result', async () => {
    const deadline = '2026-09-07T10:00:00.000Z';
    resetRpc({ data: deadline, error: null });

    const result = await agreementClientService.oznaciZavrsetak('agr-1');

    expect(mockRpc.mock.calls).toEqual([
      ['rpc_mark_work_done', { p_agreement_id: 'agr-1' }],
    ]);
    expect(result).toEqual({
      ok: true,
      podatak: { rokPotvrdeIso: deadline },
    });
  });

  it.each([
    ['message wins', { message: 'NOT_WORKER', code: '42501' }, { ok: false, kod: 'NOT_WORKER', poruka: 'Ovu radnju može da izvrši samo radnik iz ovog Dogovora.' }],
    ['code fallback', { code: '42501' }, { ok: false, kod: 'COMPLETION_FAILED', poruka: 'Završetak nije mogao da se označi.' }],
    ['full fallback', {}, { ok: false, kod: 'COMPLETION_FAILED', poruka: 'Završetak nije mogao da se označi.' }],
  ])('preserves active error mapping: %s', async (_label, error, expected) => {
    resetRpc({ data: null, error });

    const result = await agreementClientService.oznaciZavrsetak('agr-error');

    expect(result).toEqual(expected);
  });

  it('preserves fail-closed behavior when RPC returns no deadline and no error', async () => {
    resetRpc({ data: null, error: null });

    const result = await agreementClientService.oznaciZavrsetak('agr-no-data');

    expect(result).toEqual({
      ok: false,
      kod: 'COMPLETION_FAILED',
      poruka: 'Završetak nije mogao da se označi.',
    });
  });
});
