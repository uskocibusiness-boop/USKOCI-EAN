import { agreementCancellationService, cancellationOf, decodeAgreementCancellations, CANCELLATION_BATCH } from '../agreementCancellationClientService';

/**
 * CANCEL-INFO client (server applied to canonical DEV 2026-10-07): `rpc_agreement_cancellation_v1(uuid[])`, read as the
 * contract in `supabase/candidates/cancel-info-20261007/README.md` states it. Disposable doubles only: no network, no DEV.
 */
const A = '10000000-0000-4000-8000-000000000001';
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let mockAccount: string | undefined = A, mockRevision = 1;
const mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: mockAccount ? { id: mockAccount } : null, accountRevision: mockRevision }) }));

const AT = '2026-10-07T18:23:45.123456+00:00';
const cancelled = (agreementId: string, patch: Record<string, unknown> = {}) => ({ agreementId, cancelled: true, cancelledAt: AT,
  cancelledBy: 'WORKER', cancelledByMe: true, reason: 'Promenio sam plan.', reasonState: 'KEPT', ...patch });
const open = (agreementId: string) => ({ agreementId, cancelled: false, cancelledAt: null, cancelledBy: null, cancelledByMe: null, reason: null, reasonState: null });
const answer = (items: unknown[], patch: Record<string, unknown> = {}) => ({ schema: 'AGREEMENT_CANCELLATION_V1', items, asOf: AT, authoritative: true, ...patch });
const account = { accountId: A, accountRevision: 1 };

beforeEach(() => { mockRpc.mockReset(); mockAccount = A; mockRevision = 1; });

describe('decodeAgreementCancellations', () => {
  it('keeps only the cancelled Dogovori, by their lower-case id, with what the server said', () => {
    const found = decodeAgreementCancellations(answer([cancelled(id(1)), open(id(2))]), [id(1), id(2)]);
    expect([...found!.keys()]).toEqual([id(1)]);
    expect(found!.get(id(1))).toEqual({ agreementId: id(1), cancelledAt: AT, by: 'WORKER', byMe: true, reason: 'Promenio sam plan.', reasonState: 'KEPT' });
    expect(cancellationOf(found, id(1).toUpperCase())).toMatchObject({ by: 'WORKER' });
    expect(cancellationOf(found, id(2))).toBeNull();
    expect(cancellationOf(null, id(1))).toBeNull();
  });

  it('says what became of a reason that is not there, and never invents one', () => {
    const found = decodeAgreementCancellations(answer([
      cancelled(id(1), { reason: null, reasonState: 'NOT_KEPT' }),
      cancelled(id(2), { reason: null, reasonState: 'REMOVED', cancelledBy: 'REQUESTER', cancelledByMe: false }),
    ]), [id(1), id(2)])!;
    expect(found.get(id(1))).toMatchObject({ reason: null, reasonState: 'NOT_KEPT' });
    expect(found.get(id(2))).toMatchObject({ reason: null, reasonState: 'REMOVED', by: 'REQUESTER', byMe: false });
  });

  it('never guesses the side: when the server no longer has it, both facts stay null', () => {
    const found = decodeAgreementCancellations(answer([cancelled(id(1), { cancelledBy: null, cancelledByMe: null, reason: null, reasonState: 'NOT_KEPT' })]), [id(1)])!;
    expect(found.get(id(1))).toMatchObject({ by: null, byMe: null });
  });

  it('trims the reason and treats an answer that leaves a Dogovor out as nothing to say about it', () => {
    const found = decodeAgreementCancellations(answer([cancelled(id(1), { reason: '  Ujutru je mokro.  ' })]), [id(1), id(2)])!;
    expect(found.get(id(1))?.reason).toBe('Ujutru je mokro.');
    expect(found.has(id(2))).toBe(false);
  });

  it.each([
    ['null', null], ['not an object', 'x'], ['wrong schema', answer([], { schema: 'AGREEMENT_CANCELLATION_V2' })],
    ['not authoritative', answer([], { authoritative: false })], ['no time of its own', answer([], { asOf: 'jucer' })],
    ['an unknown key', answer([], { extra: 1 })], ['items that are not a list', answer('x' as never)],
    ['an id that was not asked', answer([cancelled(id(9))])], ['an id twice', answer([cancelled(id(1)), cancelled(id(1))])],
    ['an item that is not an object', answer([null])], ['an item with a foreign key', answer([{ ...cancelled(id(1)), secret: 'x' }])],
    ['a time that is not a time', answer([cancelled(id(1), { cancelledAt: '2026-02-30T12:00:00Z' })])],
    ['a side nobody has', answer([cancelled(id(1), { cancelledBy: 'SYSTEM', cancelledByMe: null })])],
    ['a side without its "mine"', answer([cancelled(id(1), { cancelledByMe: null })])],
    ['a "mine" without its side', answer([cancelled(id(1), { cancelledBy: null })])],
    ['a "mine" that is not a boolean', answer([cancelled(id(1), { cancelledByMe: 'yes' })])],
    ['a kept reason that is empty', answer([cancelled(id(1), { reason: '   ' })])],
    ['a kept reason that is missing', answer([cancelled(id(1), { reason: null })])],
    ['a reason that was not kept but is there', answer([cancelled(id(1), { reasonState: 'NOT_KEPT' })])],
    ['a reason state nobody knows', answer([cancelled(id(1), { reasonState: 'HIDDEN' })])],
    ['an open Dogovor that says something', answer([{ ...open(id(1)), cancelledBy: 'WORKER' }])],
  ])('is a malformed answer: %s', (_name, raw) => {
    expect(decodeAgreementCancellations(raw, [id(1)])).toBeNull();
  });
});

describe('agreementCancellationService.read', () => {
  it('asks once, with the ids as the function wants them, and returns only what is cancelled', async () => {
    mockRpc.mockResolvedValue({ data: answer([cancelled(id(1)), open(id(2))]), error: null });
    const result = await agreementCancellationService.read([id(1), id(2)], account);
    expect(mockRpc.mock.calls).toEqual([['rpc_agreement_cancellation_v1', { p_agreement_ids: [id(1), id(2)] }]]);
    expect(result.ok && [...result.podatak.keys()]).toEqual([id(1)]);
  });

  it('asks each id once, in the order it first came, lower-cased', async () => {
    mockRpc.mockResolvedValue({ data: answer([]), error: null });
    await agreementCancellationService.read([id(2), id(1).toUpperCase(), id(2), id(1)], account);
    expect(mockRpc.mock.calls[0][1]).toEqual({ p_agreement_ids: [id(2), id(1)] });
  });

  it('asks nothing for nothing', async () => {
    expect(await agreementCancellationService.read([], account)).toEqual({ ok: true, podatak: new Map() });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('refuses an id that is not an id before asking anything', async () => {
    expect(await agreementCancellationService.read([id(1), 'x'], account)).toMatchObject({ ok: false, kod: 'CANCELLATION_INVALID_IDS' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('asks a hundred at a time and joins the answers', async () => {
    const ids = Array.from({ length: CANCELLATION_BATCH + 5 }, (_, n) => id(n + 1));
    mockRpc.mockImplementation(async (_name: string, args: { p_agreement_ids: string[] }) => ({
      data: answer(args.p_agreement_ids.map(one => one === ids[0] || one === ids[CANCELLATION_BATCH] ? cancelled(one) : open(one))), error: null }));
    const result = await agreementCancellationService.read(ids, account);
    expect(mockRpc.mock.calls.map(call => call[1].p_agreement_ids.length)).toEqual([CANCELLATION_BATCH, 5]);
    expect(result.ok && [...result.podatak.keys()]).toEqual([ids[0], ids[CANCELLATION_BATCH]]);
  });

  it('maps a refusal the function names to its sentence, and anything else to an unconfirmed read', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'ACCOUNT_CLOSING', details: 'private' } });
    expect(await agreementCancellationService.read([id(1)], account)).toEqual({ ok: false, kod: 'ACCOUNT_CLOSING', poruka: 'Ovo ne možeš da vidiš dok se tvoj nalog zatvara.' });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom: stack trace', code: '40001' } });
    expect(await agreementCancellationService.read([id(1)], account)).toMatchObject({ ok: false, kod: 'CANCELLATION_READ_FAILED' });
  });

  it('a malformed answer is a failure of the whole read, never a half-trusted line', async () => {
    mockRpc.mockResolvedValue({ data: answer([cancelled(id(1))], { authoritative: false }), error: null });
    expect(await agreementCancellationService.read([id(1)], account)).toMatchObject({ ok: false, kod: 'CANCELLATION_READ_INVALID' });
  });

  it('a read that belongs to an account that is gone says so and keeps nothing', async () => {
    mockRpc.mockImplementation(async () => { mockAccount = '10000000-0000-4000-8000-000000000009'; return { data: answer([cancelled(id(1))]), error: null }; });
    expect(await agreementCancellationService.read([id(1)], account)).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  });
});
