jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: 'test-owner' }, accountRevision: 1 }) }));

/**
 * CB1 — RU-4B pre-Dogovor Q&A client contract. Every command carries a uuid
 * request id; server exception names become product language; fail-closed
 * server states read as "not available yet", never as a broken app.
 */

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { preselectionQaClientService } from '../preselectionQaClientService';
import { noviUuidZahtevId } from '../../lib/idempotencija';

const { mockRpc } = (jest.requireMock('../supabaseClient') as { __testMocks: { mockRpc: jest.Mock } }).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

const NEED = '11111111-2222-4333-8444-555555555555';
const Q = '66666666-7777-4888-9999-000000000000';
const REQ = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('CB1 — request ids', () => {
  it('generates a uuid v4 request id the server column type accepts', () => {
    const id = noviUuidZahtevId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(noviUuidZahtevId()).not.toBe(id);
  });

  it('refuses a non-uuid request id before touching the server', async () => {
    resetRpc({ data: null, error: null });
    const result = await preselectionQaClientService.askQuestion(NEED, 3, 'Da li je potreban alat?', 'req_not_a_uuid');
    expect(result).toMatchObject({ ok: false, kod: 'REQUEST_ID_INVALID' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('CB1 — ask / answer / disposition', () => {
  it('asks with the exact server arguments and returns the receipt', async () => {
    resetRpc({ data: { ok: true, questionId: Q, status: 'PENDING_ANSWER', needRevision: 3, idempotentReplay: false }, error: null });
    const result = await preselectionQaClientService.askQuestion(NEED, 3, 'Da li je potreban alat?', REQ);
    expect(mockRpc.mock.calls).toEqual([['rpc_ru4b_ask_preselection_question', { p_need_id: NEED, p_expected_revision: 3, p_question_text: 'Da li je potreban alat?', p_request_id: REQ }]]);
    expect(result).toEqual({ ok: true, podatak: { questionId: Q, status: 'PENDING_ANSWER', needRevision: 3, idempotentReplay: false } });
  });

  it('reads fail-closed server states as not yet available, without exposing codes', async () => {
    for (const name of ['RU4B_BLOCK_AUTHORITY_NOT_READY', 'RU4B_RATE_POLICY_NOT_READY', 'PRESELECTION_QA_POLICY_NOT_READY']) {
      resetRpc({ data: null, error: { code: 'P0001', message: name } });
      const result = await preselectionQaClientService.askQuestion(NEED, 3, 'Pitanje?', REQ);
      expect(result).toMatchObject({ ok: false, kod: name });
      if (!result.ok) {
        expect(result.poruka).toBe('Pitanja o zadatku još nisu dostupna.');
        expect(result.poruka).not.toContain('RU4B');
      }
    }
  });

  it('translates the public floor, stale revision and ownership boundaries', async () => {
    resetRpc({ data: null, error: { code: 'P0001', message: 'PHONE_NOT_PUBLIC' } });
    const floor = await preselectionQaClientService.askQuestion(NEED, 3, 'Zovi 0641234567', REQ);
    if (!floor.ok) expect(floor.poruka).toContain('javni');
    resetRpc({ data: null, error: { code: 'P0001', message: 'QUESTION_STALE_AFTER_NEED_REVISION' } });
    const stale = await preselectionQaClientService.answerQuestion(Q, 'Da.', REQ);
    if (!stale.ok) expect(stale.poruka).toContain('izmenjen');
    resetRpc({ data: null, error: { code: 'P0001', message: 'RU4B_MATERIAL_REQUIRES_RU4_EDIT' } });
    const material = await preselectionQaClientService.answerQuestion(Q, 'Treba i kombi.', REQ);
    if (!material.ok) expect(material.poruka).toContain('Izmeni zadatak');
  });

  it('answers and reports a replayed receipt as replay', async () => {
    resetRpc({ data: { ok: true, questionId: Q, status: 'ANSWERED_PUBLIC', answerVersion: 2, edited: true, idempotentReplay: true }, error: null });
    const result = await preselectionQaClientService.answerQuestion(Q, 'Da, potreban je.', REQ);
    expect(mockRpc.mock.calls).toEqual([['rpc_ru4b_answer_preselection_question', { p_question_id: Q, p_answer_text: 'Da, potreban je.', p_request_id: REQ }]]);
    expect(result).toEqual({ ok: true, podatak: { questionId: Q, status: 'ANSWERED_PUBLIC', answerVersion: 2, edited: true, idempotentReplay: true } });
  });

  it('dispositions with IGNORE or REPORT only and maps the receipt', async () => {
    resetRpc({ data: { ok: true, questionId: Q, status: 'REPORTED', idempotentReplay: false }, error: null });
    const result = await preselectionQaClientService.dispositionQuestion(Q, 'REPORT', REQ);
    expect(mockRpc.mock.calls).toEqual([['rpc_ru4b_disposition_preselection_question', { p_question_id: Q, p_action: 'REPORT', p_request_id: REQ }]]);
    expect(result).toEqual({ ok: true, podatak: { questionId: Q, status: 'REPORTED', idempotentReplay: false } });
    resetRpc({ data: { ok: true, questionId: Q, status: 'WEIRD', idempotentReplay: false }, error: null });
    expect(await preselectionQaClientService.dispositionQuestion(Q, 'IGNORE', REQ)).toMatchObject({ ok: false, kod: 'QUESTION_DISPOSITION_INVALID_RESPONSE' });
  });
});

describe('CB1 — projections', () => {
  it('maps the owner list with unanswered questions and never an asker identity', async () => {
    resetRpc({ data: [
      { question_id: Q, need_revision: 3, question_text: 'Alat?', status: 'PENDING_ANSWER', created_at: '2026-09-08T10:00:00+00:00', answer_version: null, answer_text: null, edited: false },
      { question_id: NEED, need_revision: 3, question_text: 'Kombi?', status: 'ANSWERED_PUBLIC', created_at: '2026-09-08T09:00:00+00:00', answer_version: 1, answer_text: 'Da.', edited: false },
    ], error: null });
    const result = await preselectionQaClientService.ownerQuestions(NEED);
    expect(mockRpc.mock.calls).toEqual([['rpc_ru4b_owner_preselection_questions', { p_need_id: NEED }]]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.podatak.map((q) => [q.status, q.answerText])).toEqual([['PENDING_ANSWER', null], ['ANSWERED_PUBLIC', 'Da.']]);
    expect(JSON.stringify(result.podatak)).not.toMatch(/asker|account/i);
  });

  it('maps the public Q&A and fails closed on an unreadable row', async () => {
    resetRpc({ data: [{ question_id: Q, need_revision: 3, question_text: 'Alat?', answer_version: 2, answer_text: 'Da.', edited: true, answered_at: '2026-09-08T11:00:00+00:00' }], error: null });
    const result = await preselectionQaClientService.publicQa(NEED);
    expect(result).toEqual({ ok: true, podatak: [{ questionId: Q, needRevision: 3, questionText: 'Alat?', answerVersion: 2, answerText: 'Da.', edited: true, answeredAt: '2026-09-08T11:00:00+00:00' }] });
    resetRpc({ data: [{ question_id: Q, question_text: 'Alat?' }], error: null });
    expect(await preselectionQaClientService.publicQa(NEED)).toMatchObject({ ok: false, kod: 'PUBLIC_QA_INVALID_RESPONSE' });
  });
});
