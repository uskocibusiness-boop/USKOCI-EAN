/**
 * CDL-A11 — canonical AI conversation open/read contract after shadow deletion.
 *
 * Pre-deletion proof run 33966439120 was green while the stale NEW_NEED open
 * path and null conversation-read shadow still existed. The retained read adapter remains; unkeyed opens are retired by owner stabilization.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { aiProductionOverrides } from '../aiProductionOverrides';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

describe('CDL-A11 — canonical AI conversation owner after shadow deletion', () => {
  beforeEach(() => mockRpc.mockReset());

  it('physically eliminates both lower production owners and preserves the winner', () => {
    const dataDir = join(__dirname, '..');
    const indexSource = readFileSync(join(dataDir, 'index.ts'), 'utf8');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');
    const winnerSource = readFileSync(join(dataDir, 'aiProductionOverrides.ts'), 'utf8');

    expect(indexSource.indexOf('...aiProductionOverrides')).toBeGreaterThan(indexSource.indexOf('...supabaseIzvor'));

    expect(baselineSource).not.toContain('async otvoriRazgovor()');
    expect(baselineSource).not.toContain("p_purpose: 'NEW_NEED'");
    expect(baselineSource).not.toContain('async razgovor(razgovorId: string) { return null; }');
    expect(baselineSource).toContain("'otvoriRazgovor'");
    expect(baselineSource).toContain("'razgovor'");

    expect(winnerSource).toContain("type AiOverrides = Pick<Izvor, 'otvoriRazgovor' | 'razgovor'>;");
    expect(winnerSource).toContain('async otvoriRazgovor()');
    expect(winnerSource).toContain("'OWNED_CONVERSATION_REQUIRED'");
    expect(winnerSource).not.toContain("rpc('rpc_ai_open_conversation'");
    expect(winnerSource).toContain('async razgovor(razgovorId)');
    expect(winnerSource).toContain(".from('ai_conversations')");
    expect(winnerSource).toContain(".from('ai_structured_facts')");
    expect(winnerSource).toContain(".from('ai_messages')");
    expect(winnerSource).toContain('spremnoZaObjavu: false');
  });

  it('retires the unkeyed opener without creating a conversation', async () => {
    mockRpc.mockResolvedValue({ data: 'conv-1', error: null });
    const result = await aiProductionOverrides.otvoriRazgovor();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, kod: 'OWNED_CONVERSATION_REQUIRED',
      poruka: 'Otvori novi zadatak da započneš razgovor.' });
  });

  it('repeated legacy opens remain non-writing rather than creating duplicate records', async () => {
    const a = await aiProductionOverrides.otvoriRazgovor();
    const b = await aiProductionOverrides.otvoriRazgovor();
    expect(a).toEqual(b);
    expect(a.ok).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
