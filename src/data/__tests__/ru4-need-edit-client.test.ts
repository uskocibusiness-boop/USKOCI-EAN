/**
 * RU-4 — owner edit of a public Zadatak has one physical client path.
 *
 * R04 "Izmeni Zadatak" used to push a route that does not exist. The live
 * server has owned the edit authority since RU-4 closure; this locks the
 * client contract onto it: open a bound edit conversation, review it, confirm
 * with the exact revision the owner saw. The server decides materiality,
 * staleness and the post-Dogovor lock — the client only translates its
 * answers into product language.
 *
 * R07 was the screen that carried the confirmation in two client steps. V5
 * replaced it with one review that the server routes by itself, so the second
 * test below now reads that decision where it is made rather than in a screen.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
let mockOwner = { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, accountRevision: 1 };
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockOwner }));

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { aiNeedV2Production } from '../aiNeedV2Production';
import { ru4Production } from '../ru4Production';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

const NEED = '11111111-1111-4111-8111-111111111111';
const CONVERSATION = '22222222-2222-4222-8222-222222222222';
const EVENT = '33333333-3333-4333-8333-333333333333';

describe('RU-4 — R04 edit no longer dead-ends', () => {
  it('R04 opens the real server edit flow instead of a route that does not exist', () => {
    const screen = readFileSync(join(__dirname, '..', '..', 'app', '(app)', 'potrebe', '[id]', 'pregled.tsx'), 'utf8');
    expect(screen).not.toContain("'/potrebe/[id]/izmeni'");
    expect(screen).not.toContain('as any');
    expect(screen).toContain('openEditConversation');
    // V5 routes the final draft review directly to its detailed review; manual
    // editing still opens the same owned conversation. The renderer journeys
    // in publication-screen.test.tsx exercise both callbacks and exact IDs.
    expect(screen).toContain("'/nova'");
    expect(screen).toContain("'/pregled-zadatka'");
  });

  it('accepting a bound review confirms an edit through the RU-4 authority, never the DRAFT creator', () => {
    const migration = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'migrations',
      '20260912213702_clean_v5_review_acceptance.sql'), 'utf8');
    const accept = migration.slice(migration.indexOf('create function public.rpc_accept_ai_task_review'));
    // One branch, decided by the server from the conversation's own binding: a conversation with no
    // Need behind it creates a draft, and one that has a Need confirms an edit against the exact
    // revision the owner reviewed. The client cannot pick the wrong one because it does not pick.
    expect(accept).toContain('if c.bound_need_id is null then');
    expect(accept).toContain('rpc_save_need_draft_from_review(c.id');
    expect(accept).toContain("rpc_confirm_need_edit_from_review_v2(c.bound_need_id,(r.envelope->>'draftRevision')::integer");
  });
});

describe('RU-4 — openEditConversation', () => {
  it.each(['DRAFT', 'PUBLISHED', 'SELECTION'])('passes the exact need id and preserves actual %s Need status, separately from conversation OPEN', async status => {
    resetRpc({ data: { conversationId: CONVERSATION, needId: NEED, revision: 3, status, authoritative: true }, error: null });
    const result = await aiNeedV2Production.openEditConversation(NEED);
    expect(mockRpc.mock.calls).toEqual([['rpc_ai_open_need_edit_conversation_v2', { p_need_id: NEED }]]);
    expect(result).toEqual({ ok: true, podatak: { conversationId: CONVERSATION, needId: NEED, revision: 3, needStatus: status, authoritative: true } });
  });

  it.each([
    ['missing need', { needId: undefined }], ['foreign need', { needId: CONVERSATION }], ['invalid conversation', { conversationId: 'bad' }],
    ['string revision', { revision: '3' }], ['unsafe revision', { revision: 2_147_483_648 }], ['missing authority', { authoritative: undefined }],
    ['false authority', { authoritative: false }], ['conversation status used as need status', { status: 'OPEN' }],
    ['unknown need status', { status: 'UNKNOWN' }], ['array status', { status: ['DRAFT'] }],
    ['unexpected private payload', { privateDetails: 'secret server field' }],
  ])('rejects %s without inventing a bound edit receipt', async (_, change) => {
    resetRpc({ data: { conversationId: CONVERSATION, needId: NEED, revision: 3, status: 'DRAFT', authoritative: true, ...change }, error: null });
    const result = await aiNeedV2Production.openEditConversation(NEED);
    expect(result).toMatchObject({ ok: false, kod: 'NEED_EDIT_INVALID_RESPONSE' });
    expect(JSON.stringify(result)).not.toContain('secret server field');
  });

  it('ignores a late open-edit receipt after the account incarnation changes', async () => {
    let resolve!: (value: unknown) => void;
    mockRpc.mockReset(); mockRpc.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = aiNeedV2Production.openEditConversation(NEED);
    mockOwner = { ...mockOwner, accountRevision: mockOwner.accountRevision + 2 };
    resolve({ data: { conversationId: CONVERSATION, needId: NEED, revision: 3, status: 'DRAFT', authoritative: true }, error: null });
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  });

  it('translates the post-Dogovor lock into product language and keeps the server code', async () => {
    resetRpc({ data: null, error: { code: 'P0001', message: 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' } });
    const result = await aiNeedV2Production.openEditConversation(NEED);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kod).toBe('NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR');
    expect(result.poruka).toContain('Dogovor');
    expect(result.poruka).not.toContain('NEED_EDIT');
  });

  it('fails closed on a malformed server answer', async () => {
    resetRpc({ data: { conversationId: CONVERSATION }, error: null });
    const result = await aiNeedV2Production.openEditConversation(NEED);
    expect(result).toMatchObject({ ok: false, kod: 'NEED_EDIT_INVALID_RESPONSE' });
  });
});

describe('RU-4 — confirmEdit', () => {
  it('carries the reviewed revision and a stable request id to the v2 authority', async () => {
    resetRpc({
      data: { needId: NEED, fromRevision: 3, revision: 4, status: 'DRAFT', requiresReadmission: true, idempotentReplay: false, conversationId: CONVERSATION, revisionEventId: EVENT, authoritative: true },
      error: null,
    });
    const result = await aiNeedV2Production.confirmEdit(NEED, 3, CONVERSATION, 'ru4-edit-abc12345');
    expect(mockRpc.mock.calls).toEqual([[
      'rpc_confirm_need_edit_from_review_v2',
      { p_need_id: NEED, p_expected_revision: 3, p_conversation_id: CONVERSATION, p_client_request_id: 'ru4-edit-abc12345' },
    ]]);
    expect(result).toEqual({
      ok: true,
      podatak: { needId: NEED, fromRevision: 3, revision: 4, status: 'DRAFT', requiresReadmission: true, idempotentReplay: false, conversationId: CONVERSATION, revisionEventId: EVENT, authoritative: true },
    });
  });

  it('reports a replayed receipt as such instead of a second edit', async () => {
    resetRpc({ data: { needId: NEED, fromRevision: 3, revision: 4, status: 'DRAFT', idempotentReplay: true, requiresReadmission: true, conversationId: CONVERSATION, revisionEventId: EVENT, authoritative: true }, error: null });
    const result = await aiNeedV2Production.confirmEdit(NEED, 3, CONVERSATION, 'ru4-edit-abc12345');
    expect(result).toMatchObject({ ok: true, podatak: { idempotentReplay: true, revision: 4 } });
  });

  it('turns a moved revision into a re-read instruction, never a silent overwrite', async () => {
    resetRpc({ data: null, error: { code: '40001', message: 'STALE_REVIEW_REQUIRED' } });
    const result = await aiNeedV2Production.confirmEdit(NEED, 3, CONVERSATION, 'ru4-edit-abc12345');
    expect(result).toMatchObject({ ok: false, kod: 'STALE_REVIEW_REQUIRED' });
    if (!result.ok) expect(result.poruka).toContain('u međuvremenu promenjen');
  });

  it('explains an unchanged review and unconfirmed facts in product language', async () => {
    resetRpc({ data: null, error: { code: '22023', message: 'NO_MATERIAL_CHANGE' } });
    const unchanged = await aiNeedV2Production.confirmEdit(NEED, 3, CONVERSATION, 'ru4-edit-abc12345');
    expect(unchanged).toMatchObject({ ok: false, kod: 'NO_MATERIAL_CHANGE', poruka: 'Nijedan podatak nije promenjen.' });

    resetRpc({ data: null, error: { code: 'P0001', message: 'EDIT_FACTS_REQUIRE_HUMAN_CONFIRMATION' } });
    const unconfirmed = await aiNeedV2Production.confirmEdit(NEED, 3, CONVERSATION, 'ru4-edit-abc12345');
    expect(unconfirmed).toMatchObject({ ok: false, kod: 'EDIT_FACTS_REQUIRE_HUMAN_CONFIRMATION' });
    if (!unconfirmed.ok) expect(unconfirmed.poruka).toContain('Potvrdi');
  });
});


describe('R11f/X03 — stale-response resolution receipt', () => {
  const input = { prijavaId: '11111111-1111-4111-8111-111111111111', ocekivanaVerzija: 3, ocekivanaPotrebaRevizija: 4,
    clientRequestId: '22222222-2222-4222-8222-222222222222', akcija: 'UPDATE' as const, cenaRsd: 1200 };

  it('returns the actual confirmed status, version and optional price basis, with no local version fallback', async () => {
    resetRpc({ data: { status: 'SUBMITTED', version: 4, applicationPriceBasis: 'HOURLY' }, error: null });
    await expect(ru4Production.resolveChangedApplication(input)).resolves.toEqual({
      ok: true, podatak: { status: 'SUBMITTED', version: 4, priceBasis: 'HOURLY' },
    });
    expect(mockRpc).toHaveBeenCalledWith('rpc_resolve_stale_response_after_need_edit', expect.objectContaining({
      p_response_id: input.prijavaId, p_expected_response_version: 3, p_expected_need_revision: 4, p_action: 'UPDATE',
    }));
    resetRpc({ data: { status: 'WITHDRAWN', version: 3 }, error: null });
    await expect(ru4Production.resolveChangedApplication({ ...input, akcija: 'WITHDRAW' })).resolves.toMatchObject({
      ok: true, podatak: { status: 'WITHDRAWN', version: 3 },
    });
  });

  it('rejects missing, non-finite, fractional, mismatched and unknown results rather than claiming a successful change', async () => {
    for (const data of [
      null, {}, { status: 'SUBMITTED' }, { status: 'SUBMITTED', version: null },
      { status: 'SUBMITTED', version: '4' }, { status: 'SUBMITTED', version: Number.POSITIVE_INFINITY },
      { status: 'SUBMITTED', version: 3.5 }, { status: '', version: 4 },
      { status: 'WITHDRAWN', version: 4 }, { status: 'SUBMITTED', version: 4, applicationPriceBasis: 'PER_PERSON' },
    ]) {
      resetRpc({ data, error: null });
      await expect(ru4Production.resolveChangedApplication(input)).resolves.toMatchObject({
        ok: false, kod: 'STALE_RESPONSE_RESOLUTION_UNCONFIRMED',
      });
    }
  });
});
