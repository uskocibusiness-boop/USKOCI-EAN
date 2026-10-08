import { decodeMyWorkStats, decodePublicWorkTrust, decodeReceivedReviews, RECEIVED_REVIEWS_PAGE_MAX, RECEIVED_REVIEWS_PAGE_SIZE, workTrustClientService } from '../workTrustClientService';

/**
 * PROFILE-TRUST client (server applied to canonical DEV 2026-10-07, ledger 230): `rpc_public_work_trust_v1`, `rpc_my_work_stats_v1`
 * and `rpc_list_received_reviews_v1`, read as the contract in `supabase/candidates/profile-trust-20261007/README.md` states them.
 * Disposable doubles only: no network, no DEV, no real account.
 */
const A = '10000000-0000-4000-8000-000000000001';
const PROFILE = '30000000-0000-4000-8000-000000000001';
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let mockAccount: string | undefined = A, mockRevision = 1;
const mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: mockAccount ? { id: mockAccount } : null, accountRevision: mockRevision }) }));

const AT = '2026-10-07T18:23:45.123456+00:00';
const CURSOR = '2026-10-01T10:00:00.000000Z|20000000-0000-4000-8000-000000000003';
const account = { accountId: A, accountRevision: 1 };

const trust = (patch: Record<string, unknown> = {}) => ({ schema: 'PUBLIC_WORK_TRUST_V1', profileId: PROFILE, role: 'WORKER', self: false, visibility: 'PUBLIC',
  completedCount: 7, agreedCount: 9, reliabilityPercent: 88, reliabilityState: 'AVAILABLE', reliabilityMinimum: 5, memberSince: '2026-03-01',
  definition: 'WORK_TRUST_V1', authoritative: true, ...patch });
const hidden = (patch: Record<string, unknown> = {}) => trust({ visibility: 'OWN_ONLY', agreedCount: null, reliabilityPercent: null, reliabilityState: 'HIDDEN', memberSince: null, ...patch });
const tooFew = (patch: Record<string, unknown> = {}) => trust({ completedCount: 3, agreedCount: 4, reliabilityPercent: null, reliabilityState: 'TOO_FEW', ...patch });

const stats = (patch: Record<string, unknown> = {}) => ({ schema: 'MY_WORK_STATS_V1', hasWorkerProfile: true, profileId: PROFILE, profileStatus: 'ACTIVE',
  applicationsSent: 12, agreementsMade: 8, agreementsCompleted: 6, agreementsActive: 1, cancelledByMe: 1, cancelledByRequester: 0, cancelledSideUnknown: 0,
  reliabilityPercent: 85, reliabilityState: 'AVAILABLE', reliabilityMinimum: 5, memberSince: '2026-03-01', definition: 'WORK_TRUST_V1', asOf: AT,
  authoritative: true, ...patch });
const noProfile = (patch: Record<string, unknown> = {}) => stats({ hasWorkerProfile: false, profileId: null, profileStatus: null, applicationsSent: 0, agreementsMade: 0,
  agreementsCompleted: 0, agreementsActive: 0, cancelledByMe: 0, cancelledByRequester: 0, cancelledSideUnknown: 0, reliabilityPercent: null, reliabilityState: 'TOO_FEW',
  memberSince: null, ...patch });

const face = (patch: Record<string, unknown> = {}) => ({ profileId: id(500), role: 'REQUESTER', displayName: 'Ana P.', avatarPath: null, masked: false, ...patch });
const maskedFace = () => ({ profileId: null, role: 'REQUESTER', displayName: null, avatarPath: null, masked: true });
const review = (n: number, patch: Record<string, unknown> = {}) => ({ reviewId: id(n), rating: 5, tags: ['ON_TIME', 'CAREFUL'], createdAt: '2026-10-01T10:00:00.000000Z',
  agreementId: id(100 + n), taskTitle: 'Kreči stan', receivedAs: 'WORKER', reviewer: face(), comment: 'Sve kako smo se dogovorili.', ...patch });
const page = (items: unknown[], patch: Record<string, unknown> = {}) => ({ schema: 'RECEIVED_REVIEWS_V1', mode: 'COMMENTED_ONLY', items, hasMore: false, nextAfter: null,
  limit: RECEIVED_REVIEWS_PAGE_SIZE, totalCount: items.length, notListedCount: 0, asOf: AT, authoritative: true, ...patch });

beforeEach(() => { mockRpc.mockReset(); mockAccount = A; mockRevision = 1; });

describe('decodePublicWorkTrust', () => {
  it('keeps the server\'s "nothing here" as nothing, and does not call it a failure', () => {
    expect(decodePublicWorkTrust(null, PROFILE)).toEqual({ trust: null });
  });

  it('reads an AVAILABLE block of a PUBLIC profile with all of its facts', () => {
    expect(decodePublicWorkTrust(trust(), PROFILE)).toEqual({ trust: { profileId: PROFILE, self: false, visibility: 'PUBLIC', completedCount: 7, agreedCount: 9,
      reliabilityPercent: 88, reliabilityState: 'AVAILABLE', reliabilityMinimum: 5, memberSince: '2026-03-01' } });
  });

  it('reads TOO_FEW as a count and a month with no percentage', () => {
    expect(decodePublicWorkTrust(tooFew(), PROFILE)?.trust).toMatchObject({ reliabilityState: 'TOO_FEW', reliabilityPercent: null, agreedCount: 4, memberSince: '2026-03-01' });
  });

  it('reads HIDDEN as no figure at all, and keeps the always-there completed count', () => {
    expect(decodePublicWorkTrust(hidden(), PROFILE)?.trust).toEqual({ profileId: PROFILE, self: false, visibility: 'OWN_ONLY', completedCount: 7, agreedCount: null,
      reliabilityPercent: null, reliabilityState: 'HIDDEN', reliabilityMinimum: 5, memberSince: null });
  });

  it('opens an OWN_ONLY block for the person themself, and only then', () => {
    expect(decodePublicWorkTrust(trust({ self: true, visibility: 'OWN_ONLY' }), PROFILE)?.trust).toMatchObject({ self: true, reliabilityState: 'AVAILABLE', reliabilityPercent: 88 });
    expect(decodePublicWorkTrust(trust({ self: false, visibility: 'OWN_ONLY' }), PROFILE)).toBeNull();
  });

  it('matches the profile by its lower-case id, however the server cased it', () => {
    expect(decodePublicWorkTrust(trust({ profileId: PROFILE.toUpperCase() }), PROFILE)?.trust?.profileId).toBe(PROFILE.toUpperCase());
  });

  it.each([
    ['not an object', 'x'], ['an array', []], ['a wrong schema', trust({ schema: 'PUBLIC_WORK_TRUST_V2' })], ['a wrong definition', trust({ definition: 'OTHER' })],
    ['not authoritative', trust({ authoritative: false })], ['an unknown key', trust({ extra: 1 })], ['a missing key', (() => { const { memberSince, ...rest } = trust(); return rest; })()],
    ['another profile than the one asked', trust({ profileId: id(77) })], ['a requester block', trust({ role: 'REQUESTER' })], ['a "self" that is not a boolean', trust({ self: 'da' })],
    ['a visibility nobody knows', trust({ visibility: 'FRIENDS' })], ['a negative count', trust({ completedCount: -1 })], ['a fractional count', trust({ completedCount: 1.5 })],
    ['a minimum of zero', trust({ reliabilityMinimum: 0 })], ['a state nobody knows', trust({ reliabilityState: 'GREAT' })],
    ['a HIDDEN block that carries a figure', hidden({ agreedCount: 3 })], ['a HIDDEN block with a percentage', hidden({ reliabilityPercent: 90 })],
    ['a HIDDEN block with a month', hidden({ memberSince: '2026-03-01' })], ['a HIDDEN block of a PUBLIC profile', hidden({ visibility: 'PUBLIC' })],
    ['a HIDDEN block of the person themself', hidden({ self: true })],
    ['an AVAILABLE block without a percentage', trust({ reliabilityPercent: null })], ['an AVAILABLE block with a percentage above 100', trust({ reliabilityPercent: 101 })],
    ['a TOO_FEW block with a percentage', tooFew({ reliabilityPercent: 50 })], ['an agreed count below the completed one', trust({ agreedCount: 6 })],
    ['a month that is not the first of a month', trust({ memberSince: '2026-03-15' })], ['no month on an open block', trust({ memberSince: null })],
  ])('is a malformed answer: %s', (_name, raw) => {
    expect(decodePublicWorkTrust(raw, PROFILE)).toBeNull();
  });
});

describe('decodeMyWorkStats', () => {
  it('reads the funnel of a person with a work profile', () => {
    expect(decodeMyWorkStats(stats())).toEqual({ hasWorkerProfile: true, profileId: PROFILE, profileStatus: 'ACTIVE', applicationsSent: 12, agreementsMade: 8,
      agreementsCompleted: 6, agreementsActive: 1, cancelledByMe: 1, cancelledByRequester: 0, cancelledSideUnknown: 0, reliabilityPercent: 85,
      reliabilityState: 'AVAILABLE', reliabilityMinimum: 5, memberSince: '2026-03-01', asOf: AT });
  });

  it('reads an account without a work profile as zeros and nulls, and says so', () => {
    expect(decodeMyWorkStats(noProfile())).toMatchObject({ hasWorkerProfile: false, profileId: null, applicationsSent: 0, reliabilityPercent: null, reliabilityState: 'TOO_FEW' });
  });

  it('reads TOO_FEW without a percentage', () => {
    expect(decodeMyWorkStats(stats({ reliabilityState: 'TOO_FEW', reliabilityPercent: null, agreementsCompleted: 2 }))).toMatchObject({ reliabilityState: 'TOO_FEW', reliabilityPercent: null });
  });

  it.each([
    ['null', null], ['a wrong schema', stats({ schema: 'MY_WORK_STATS_V2' })], ['not authoritative', stats({ authoritative: false })], ['a wrong definition', stats({ definition: 'x' })],
    ['no time of its own', stats({ asOf: 'jucer' })], ['a time that is not a day', stats({ asOf: '2026-02-30T12:00:00Z' })], ['an unknown key', stats({ extra: 1 })],
    ['a state HIDDEN (it is the person\'s own)', stats({ reliabilityState: 'HIDDEN' })], ['a count that is not a count', stats({ applicationsSent: -2 })],
    ['more Dogovori inside than agreed', stats({ agreementsMade: 5 })], ['a TOO_FEW with a percentage', stats({ reliabilityState: 'TOO_FEW' })],
    ['an AVAILABLE without a percentage', stats({ reliabilityPercent: null })], ['a profile without its id', stats({ profileId: null })],
    ['a profile without its status', stats({ profileStatus: '' })], ['a profile without its month', stats({ memberSince: null })],
    ['no profile but a count', noProfile({ applicationsSent: 1 })], ['no profile but an id', noProfile({ profileId: PROFILE })], ['no profile but AVAILABLE', noProfile({ reliabilityState: 'AVAILABLE', reliabilityPercent: 90 })],
  ])('is a malformed answer: %s', (_name, raw) => {
    expect(decodeMyWorkStats(raw)).toBeNull();
  });
});

describe('decodeReceivedReviews', () => {
  it('reads a page with its reviews, their tags in one order, and a masked reviewer without a name', () => {
    const found = decodeReceivedReviews(page([review(1), review(2, { reviewer: maskedFace(), comment: null, tags: [] })], { totalCount: 5, notListedCount: 3 }), 20)!;
    expect(found).toMatchObject({ mode: 'COMMENTED_ONLY', hasMore: false, nextAfter: null, limit: 20, totalCount: 5, notListedCount: 3, asOf: AT });
    expect(found.items.map(item => item.reviewId)).toEqual([id(1), id(2)]);
    expect(found.items[0]).toMatchObject({ rating: 5, tags: ['CAREFUL', 'ON_TIME'], taskTitle: 'Kreči stan', receivedAs: 'WORKER', comment: 'Sve kako smo se dogovorili.',
      reviewer: { profileId: id(500), displayName: 'Ana P.', masked: false } });
    expect(found.items[1].reviewer).toEqual({ profileId: null, role: 'REQUESTER', displayName: null, avatarPath: null, masked: true });
  });

  it('keeps the cursor of the next page exactly as it came', () => {
    expect(decodeReceivedReviews(page([review(1), review(2)], { hasMore: true, nextAfter: CURSOR, totalCount: 9 }), 20)).toMatchObject({ hasMore: true, nextAfter: CURSOR });
  });

  it('tolerates a task without a title as an empty line, not as an invented one, and trims what it keeps', () => {
    const found = decodeReceivedReviews(page([review(1, { taskTitle: null, comment: '  Dobro.  ' })]), 20)!;
    expect(found.items[0]).toMatchObject({ taskTitle: '', comment: 'Dobro.' });
  });

  it('lists everything in the ALL mode, with nothing left out', () => {
    expect(decodeReceivedReviews(page([review(1, { comment: null })], { mode: 'ALL' }), 20)).toMatchObject({ mode: 'ALL', notListedCount: 0 });
  });

  it.each([
    ['null', null], ['a wrong schema', page([], { schema: 'RECEIVED_REVIEWS_V2' })], ['not authoritative', page([], { authoritative: false })], ['no time of its own', page([], { asOf: 'x' })],
    ['an unknown key', page([], { extra: 1 })], ['a mode nobody knows', page([], { mode: 'NONE' })], ['items that are not a list', page('x' as never)],
    ['a limit other than the one asked', page([], { limit: 50 })], ['more items than the limit', page(Array.from({ length: 21 }, (_, n) => review(n + 1)))],
    ['a review twice', page([review(1), review(1)])], ['a review that is not an object', page([null])], ['a review with a foreign key', page([{ ...review(1), secret: 'x' }])],
    ['a rating of zero', page([review(1, { rating: 0 })])], ['a rating of six', page([review(1, { rating: 6 })])], ['a rating of 4.5', page([review(1, { rating: 4.5 })])],
    ['a tag nobody has', page([review(1, { tags: ['FUNNY'] })])], ['four tags', page([review(1, { tags: ['ON_TIME', 'CAREFUL', 'RELIABLE', 'RESPECTFUL'] })])],
    ['a tag twice', page([review(1, { tags: ['ON_TIME', 'ON_TIME'] })])], ['an empty comment', page([review(1, { comment: '   ' })])], ['a side nobody has', page([review(1, { receivedAs: 'ADMIN' })])],
    ['a time that is not a time', page([review(1, { createdAt: '2026-02-30T12:00:00Z' })])], ['a review id that is not an id', page([review(1, { reviewId: 'x' })])],
    ['a masked face that still carries a name', page([review(1, { reviewer: { ...maskedFace(), displayName: 'Ana' } })])],
    ['a shown face without a profile', page([review(1, { reviewer: face({ profileId: null }) })])],
    ['a reviewer with a foreign key', page([review(1, { reviewer: { ...face(), email: 'a@b.rs' } })])],
    ['more is coming, without a cursor', page([review(1)], { hasMore: true, nextAfter: null })], ['more is coming, with an empty page', page([], { hasMore: true, nextAfter: CURSOR })],
    ['a cursor that is not the function\'s own', page([review(1)], { hasMore: true, nextAfter: 'abc' })], ['a cursor with nothing more coming', page([review(1)], { hasMore: false, nextAfter: CURSOR })],
    ['more listed than the total', page([review(1), review(2)], { totalCount: 1 })], ['more not listed than the total', page([], { totalCount: 1, notListedCount: 2 })],
    ['listed and not listed adding up to more than the total', page([review(1), review(2)], { totalCount: 3, notListedCount: 2 })],
    ['ALL with reviews left out', page([review(1)], { mode: 'ALL', totalCount: 3, notListedCount: 2 })],
  ])('is a malformed answer: %s', (_name, raw) => {
    expect(decodeReceivedReviews(raw, 20)).toBeNull();
  });
});

describe('workTrustClientService.publicTrust', () => {
  it('asks the function once for the profile and returns the block', async () => {
    mockRpc.mockResolvedValue({ data: trust(), error: null });
    const result = await workTrustClientService.publicTrust(PROFILE, account);
    expect(mockRpc.mock.calls).toEqual([['rpc_public_work_trust_v1', { p_profile_id: PROFILE }]]);
    expect(result).toMatchObject({ ok: true, podatak: { trust: { profileId: PROFILE, reliabilityPercent: 88 } } });
  });

  it('returns the server\'s "nothing here" as a successful read of nothing', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect(await workTrustClientService.publicTrust(PROFILE, account)).toEqual({ ok: true, podatak: { trust: null } });
  });

  it('asks nothing for something that is not a profile id', async () => {
    expect(await workTrustClientService.publicTrust('x', account)).toMatchObject({ ok: false, kod: 'PROFILE_ID_REQUIRED' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('turns a malformed answer into a failed read and a refusal the function names into its sentence', async () => {
    mockRpc.mockResolvedValue({ data: trust({ authoritative: false }), error: null });
    expect(await workTrustClientService.publicTrust(PROFILE, account)).toMatchObject({ ok: false, kod: 'WORK_TRUST_READ_INVALID' });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'ACCOUNT_CLOSING' } });
    expect(await workTrustClientService.publicTrust(PROFILE, account)).toEqual({ ok: false, kod: 'ACCOUNT_CLOSING', poruka: 'Ovo ne možeš da vidiš dok se tvoj nalog zatvara.' });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom: stack trace', code: '40001' } });
    expect(await workTrustClientService.publicTrust(PROFILE, account)).toMatchObject({ ok: false, kod: 'WORK_TRUST_READ_FAILED' });
  });

  it('keeps nothing of an account that is gone', async () => {
    mockRpc.mockImplementation(async () => { mockAccount = '10000000-0000-4000-8000-000000000009'; return { data: trust(), error: null }; });
    expect(await workTrustClientService.publicTrust(PROFILE, account)).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  });
});

describe('workTrustClientService.myStats', () => {
  it('asks the function with no arguments and returns the funnel', async () => {
    mockRpc.mockResolvedValue({ data: stats(), error: null });
    const result = await workTrustClientService.myStats(account);
    expect(mockRpc.mock.calls).toEqual([['rpc_my_work_stats_v1', {}]]);
    expect(result).toMatchObject({ ok: true, podatak: { hasWorkerProfile: true, agreementsMade: 8 } });
  });

  it('turns a malformed answer into a failed read, and says nothing when nobody is signed in', async () => {
    mockRpc.mockResolvedValue({ data: stats({ agreementsMade: 1 }), error: null });
    expect(await workTrustClientService.myStats(account)).toMatchObject({ ok: false, kod: 'WORK_STATS_READ_INVALID' });
    mockAccount = undefined;
    expect(await workTrustClientService.myStats()).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
  });
});

describe('workTrustClientService.receivedReviews', () => {
  it('asks for the first page with the default size and no cursor', async () => {
    mockRpc.mockResolvedValue({ data: page([review(1)]), error: null });
    const result = await workTrustClientService.receivedReviews({}, account);
    expect(mockRpc.mock.calls).toEqual([['rpc_list_received_reviews_v1', { p_limit: RECEIVED_REVIEWS_PAGE_SIZE, p_after: null }]]);
    expect(result).toMatchObject({ ok: true, podatak: { items: [{ reviewId: id(1) }] } });
  });

  it('hands the cursor back as it came, and clamps the page size to what the function accepts', async () => {
    mockRpc.mockResolvedValue({ data: page([review(1)], { limit: RECEIVED_REVIEWS_PAGE_MAX }), error: null });
    await workTrustClientService.receivedReviews({ limit: 500, after: CURSOR }, account);
    expect(mockRpc.mock.calls[0][1]).toEqual({ p_limit: RECEIVED_REVIEWS_PAGE_MAX, p_after: CURSOR });
    mockRpc.mockResolvedValue({ data: page([], { limit: 1 }), error: null });
    await workTrustClientService.receivedReviews({ limit: 1 }, account);
    expect(mockRpc.mock.calls[1][1]).toEqual({ p_limit: 1, p_after: null });
  });

  it('refuses a cursor that is not the function\'s own before asking anything', async () => {
    expect(await workTrustClientService.receivedReviews({ after: 'abc' }, account)).toMatchObject({ ok: false, kod: 'INVALID_PAGE' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('a page that does not match what was asked is a failed read, never a half-trusted list', async () => {
    mockRpc.mockResolvedValue({ data: page([review(1)], { limit: 5 }), error: null });
    expect(await workTrustClientService.receivedReviews({}, account)).toMatchObject({ ok: false, kod: 'RECEIVED_REVIEWS_READ_INVALID' });
  });
});
