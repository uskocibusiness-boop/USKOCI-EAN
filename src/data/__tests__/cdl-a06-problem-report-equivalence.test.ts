/**
 * CDL-A06 — canonical Agreement problem-report contract.
 *
 * Pre-deletion old-vs-new equivalence was proven by PRE-P4 run 33959818756.
 * The P0E receipt extension keeps this RPC and its single production owner;
 * malformed receipts and arbitrary backend errors no longer imply success.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: '10000000-0000-4000-8000-000000000001' }, accountRevision: 1 }) }));
const agreementId = '20000000-0000-4000-8000-000000000001';

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

describe('CDL-A06 — canonical problem-report contract', () => {
  it('physically eliminates both lower-precedence problem-report owners', () => {
    const dataDir = join(__dirname, '..');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');
    const canonicalSource = readFileSync(join(dataDir, 'agreementClientService.ts'), 'utf8');

    expect(baselineSource).not.toContain('async prijaviProblem(');
    expect(baselineSource).not.toContain('p_description');
    expect(baselineSource).toContain("'prijaviProblem'");
    expect(canonicalSource).toContain('async prijaviProblem(');
    expect(canonicalSource).toContain("p_narrative: narrative");
  });

  it('trims narrative and preserves exact rpc_report_problem params/success', async () => {
    resetRpc({ data: { agreementId, problemOpenedAt: '2026-09-10T12:00:00Z', problemOpenedBy: '10000000-0000-4000-8000-000000000001',
      idempotentReplay: false, authoritative: true, noAutomaticFaultOrDebt: true }, error: null });

    const result = await agreementClientService.prijaviProblem(agreementId, '  Oštećen ormar.  ');

    expect(mockRpc.mock.calls).toEqual([
      ['rpc_report_problem', {
        p_agreement_id: agreementId,
        p_narrative: 'Oštećen ormar.',
      }],
    ]);
    expect(result).toEqual({ ok: true, podatak: null });
  });

  it('rejects blank narrative before any RPC', async () => {
    resetRpc({ data: null, error: null });

    const result = await agreementClientService.prijaviProblem('agr-blank', '   ');

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      kod: 'NARRATIVE_REQUIRED',
      poruka: 'Opiši problem.',
    });
  });

  it.each([{ message: 'PRIVATE_BACKEND_DETAIL', code: '42501' }, { code: '42501' }, {}])('keeps unrecognized errors private %#', async error => {
    resetRpc({ data: null, error });

    const result = await agreementClientService.prijaviProblem(agreementId, 'Problem');

    expect(result).toMatchObject({ ok: false, kod: 'PROBLEM_REPORT_UNCONFIRMED' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_BACKEND_DETAIL');
  });
});
