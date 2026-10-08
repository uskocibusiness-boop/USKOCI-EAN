import { needPublicationReadiness, readinessCopy } from '../needPublicationReadiness';

/**
 * A draft is told why it cannot be published, by the gate that decides it.
 *
 * The danger in a reader like this is the opposite of the one it fixes: a screen that turns an
 * answer it did not understand into "ready" would send someone to a publish that refuses them,
 * which is exactly the dead end this replaces. So an unrecognised answer is UNKNOWN, never READY.
 */

const mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 }) }));

const NEED = '55555555-5555-4555-8555-555555555555';
const answer = (data: unknown) => ({ data, error: null });

describe('reading the publish gate', () => {
  beforeEach(() => { mockRpc.mockReset(); });

  it('asks the gate for this exact need and revision', async () => {
    mockRpc.mockResolvedValue(answer({ kind: 'NOT_READY', code: 'LOCATION_INCOMPLETE', missingSlots: ['start', 'end'] }));
    await needPublicationReadiness.read(NEED, 3);
    expect(mockRpc).toHaveBeenCalledWith('rpc_get_need_publication_context', { p_need_id: NEED, p_expected_revision: 3 });
  });

  it('carries the refusal and the missing slots through', async () => {
    mockRpc.mockResolvedValue(answer({ kind: 'NOT_READY', code: 'LOCATION_INCOMPLETE', missingSlots: ['start', 'end'] }));
    await expect(needPublicationReadiness.read(NEED, 1)).resolves.toEqual({
      ok: true, podatak: { kind: 'NOT_READY', code: 'LOCATION_INCOMPLETE', missingSlots: ['start', 'end'] } });
  });

  it.each([
    ['an answer with no kind at all', { code: 'LOCATION_INCOMPLETE' }],
    ['a kind nobody has seen before', { kind: 'SOMETHING_NEW' }],
    ['an authoritative decision that is not a readiness answer', { kind: 'DECISION', decision: { outcome: 'ALLOW' } }],
  ])('reports %s as unknown rather than as ready', async (_why, payload) => {
    mockRpc.mockResolvedValue(answer(payload));
    await expect(needPublicationReadiness.read(NEED, 1)).resolves.toEqual({ ok: true, podatak: { kind: 'UNKNOWN' } });
  });

  it('refuses a refusal that carries no code, instead of inventing one', async () => {
    mockRpc.mockResolvedValue(answer({ kind: 'NOT_READY', missingSlots: ['start'] }));
    await expect(needPublicationReadiness.read(NEED, 1)).resolves.toMatchObject({ ok: false });
  });

  it('keeps only the slot names that are actually strings', async () => {
    mockRpc.mockResolvedValue(answer({ kind: 'NOT_READY', code: 'LOCATION_INCOMPLETE', missingSlots: ['start', 7, null] }));
    const result = await needPublicationReadiness.read(NEED, 1);
    expect(result.ok && result.podatak).toEqual({ kind: 'NOT_READY', code: 'LOCATION_INCOMPLETE', missingSlots: ['start'] });
  });

  it.each([
    ['a need that is not a need', '', 1],
    ['a revision that is not whole', NEED, 1.5],
    ['a negative revision', NEED, -1],
  ])('refuses %s without calling the server', async (_why, needId, revision) => {
    await expect(needPublicationReadiness.read(needId as string, revision)).resolves.toMatchObject({ ok: false });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('what the person is told', () => {
  it('says nothing when the gate is not refusing', () => {
    expect(readinessCopy({ kind: 'READY' })).toBeNull();
    expect(readinessCopy({ kind: 'UNKNOWN' })).toBeNull();
  });

  it('names the map point, and speaks of one or both ends', () => {
    expect(readinessCopy({ kind: 'NOT_READY', code: 'LOCATION_INCOMPLETE', missingSlots: ['start', 'end'] }))
      .toEqual({ title: 'Još nedostaje mesto na mapi',
        detail: 'Ime ulice nije dovoljno da neko dođe. Otvori razgovor i potvrdi obe tačke na mapi.' });
    expect(readinessCopy({ kind: 'NOT_READY', code: 'LOCATION_INCOMPLETE', missingSlots: ['start'] })?.detail)
      .toContain('potvrdi tačku na mapi');
  });

  it('does not blame the person for something that is not theirs', () => {
    expect(readinessCopy({ kind: 'NOT_READY', code: 'EVALUATOR_UNAVAILABLE', missingSlots: [] })?.detail)
      .toContain('Nije do tebe');
    expect(readinessCopy({ kind: 'NOT_READY', code: 'POLICY_NOT_READY', missingSlots: [] })?.detail)
      .toContain('Nije do tebe');
  });

  it('still says something useful for a refusal it has no words for', () => {
    const copy = readinessCopy({ kind: 'NOT_READY', code: 'A_CODE_ADDED_LATER', missingSlots: [] });
    expect(copy?.title).toBe('Zadatak još ne može da se objavi');
    expect(copy?.detail).toContain('Otvori pregled');
  });
});
