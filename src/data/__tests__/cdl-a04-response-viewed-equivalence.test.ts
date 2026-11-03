/**
 * CDL-A04 — canonical response-viewed command contract.
 *
 * Pre-deletion old-vs-new equivalence was proven by PRE-P4 run 33956936388.
 * After deletion, these tests retain the canonical RPC and single-owner proof.
 * V5 adds checked void receipts, account fences and safe error translation;
 * historical raw-error forwarding is intentionally superseded.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
let mockAccount: { user: { id: string } | null; accountRevision: number };
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();

  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { responseClientService } from '../responseClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}
const responseId = '10000000-0000-4000-8000-000000000001';
beforeEach(() => { mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 }; mockRpc.mockReset(); });
afterEach(() => jest.useRealTimers());

describe('CDL-A04 — canonical response viewed contract', () => {
  it('physically eliminates the transitional response-viewed owners', () => {
    const dataDir = join(__dirname, '..');
    const indexSource = readFileSync(join(dataDir, 'index.ts'), 'utf8');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');

    expect(indexSource).toContain("import { responseClientService } from './responseClientService'");
    expect(indexSource).toContain('...responseClientService');
    expect(baselineSource).not.toContain('async oznaciPrijavuVidjenom(');
    expect(baselineSource).toContain("'oznaciPrijavuVidjenom'");
  });

  it('preserves exact RPC name, params and success result', async () => {
    resetRpc({ data: null, error: null });

    const result = await responseClientService.oznaciPrijavuVidjenom(responseId);

    expect(mockRpc.mock.calls).toEqual([
      ['rpc_mark_response_viewed', { p_response_id: responseId }],
    ]);
    expect(result).toEqual({ ok: true, podatak: null });
  });

  it.each(['NOT_REQUESTER', 'RESPONSE_NOT_FOUND', 'RESPONSE_NOT_SUBMITTED', 'AUTH_REQUIRED', 'ACCOUNT_CLOSURE_RESTRICTED'])(
    'translates canonical %s without exposing SQL details', async code => {
      resetRpc({ data: null, error: { message: code, details: 'private SQL detail' } });
      const result = await responseClientService.oznaciPrijavuVidjenom(responseId);
      expect(result).toMatchObject({ ok: false, kod: code });
      expect(result.ok ? '' : result.poruka).not.toContain(code);
      expect(JSON.stringify(result)).not.toContain('private SQL detail');
    });
  it.each([{ message: 'private SQL / token / address', code: '42501' }, { code: '42501' }, {}])(
    'never exposes unknown transport errors %#', async error => {
      resetRpc({ data: null, error });
      const result = await responseClientService.oznaciPrijavuVidjenom(responseId);
      expect(result).toMatchObject({ ok: false, kod: 'RESPONSE_VIEW_UNCONFIRMED' });
      expect(JSON.stringify(result)).not.toMatch(/private SQL|42501|address/);
    });
  it.each([undefined, {}, true, { viewed: true }])('rejects non-void successful receipt %#', async data => {
    resetRpc({ data, error: null });
    expect(await responseClientService.oznaciPrijavuVidjenom(responseId)).toMatchObject({ ok: false, kod: 'RESPONSE_VIEW_INVALID_RECEIPT' });
  });
  it('rejects an invalid target and a signed-out owner before dispatch', async () => {
    expect(await responseClientService.oznaciPrijavuVidjenom('response-1')).toMatchObject({ ok: false, kod: 'RESPONSE_ID_INVALID' });
    mockAccount.user = null;
    expect(await responseClientService.oznaciPrijavuVidjenom(responseId)).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it('discards an old account receipt including A→B→A', async () => {
    let finish!: (value: unknown) => void;
    mockRpc.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const result = responseClientService.oznaciPrijavuVidjenom(responseId);
    mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 };
    finish({ data: null, error: null });
    expect(await result).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  });
  it('bounds an unknown write at15s and never automatically resends it', async () => {
    jest.useFakeTimers();
    let finish!: (value: unknown) => void;
    mockRpc.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const result = responseClientService.oznaciPrijavuVidjenom(responseId);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(await result).toMatchObject({ ok: false, kod: 'RESPONSE_VIEW_UNCONFIRMED' });
    finish({ data: null, error: null });
    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});
