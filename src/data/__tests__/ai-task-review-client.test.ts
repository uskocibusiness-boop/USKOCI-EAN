import { aiTaskReviewClientService as service, decodeAiTaskReview, reviewFactProblem, type AiTaskReviewEnvelope, type AiTaskPublicationCommand } from '../aiTaskReviewClientService';

const OWNER = '11111111-1111-4111-8111-111111111111', OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONVERSATION = '22222222-2222-4222-8222-222222222222', REVIEW = '33333333-3333-4333-8333-333333333333';
const KEY = '44444444-4444-4444-8444-444444444444', NEED = '55555555-5555-4555-8555-555555555555';
let mockSession = { user: { id: OWNER }, accountRevision: 1 };
const mockRpc = jest.fn(), mockInvoke = jest.fn(), mockGetSession = jest.fn();
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc, functions: { invoke: mockInvoke }, auth: { getSession: mockGetSession } }) }));
const answer = (data: unknown) => ({ data, error: null });
const review = (): AiTaskReviewEnvelope => ({
  reviewId: REVIEW, accountId: OWNER, conversationId: CONVERSATION, schemaVersion: 'NEED_FACT_V2', draftId: null, draftRevision: 0,
  displayedContentDigest: 'a'.repeat(64), factsRevision: 'b'.repeat(64), sourceTurnRevision: 2, geographyRevision: 'c'.repeat(64),
  expiresAt: '2026-10-01T00:00:00Z', responseDeadline: null, publicProjection: [], ownerPrivateProjection: [],
  location: { taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null, resolvedLocation: null },
  missingRequired: [], canAccept: true, safety: 'ALLOW',
});
const accepted = (): AiTaskPublicationCommand => ({ reviewId: REVIEW, clientRequestId: KEY, needId: NEED, needRevision: 1, state: 'ACCEPTED', evaluation: null, published: null, authoritative: true });
it('shows the conditional remote handoff question without treating it as a universal requirement', () => {
  const pending = {...review(), canAccept:false, missingRequired:['need.handoff'],
    classificationState:'PENDING_CLASSIFICATION',classificationCandidates:[],reviewedServiceModes:[],
    classificationCatalogVersion:null,classificationCatalogFingerprint:null};
  expect(decodeAiTaskReview(pending,OWNER)?.missingRequired).toEqual(['need.handoff']);
  expect(decodeAiTaskReview({...pending,canAccept:true},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...pending,location:null},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...pending,missingRequired:['need.tools']},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...pending,classificationCatalogVersion:9,classificationCatalogFingerprint:'a'.repeat(32)},OWNER)).toBeNull();
});
const evaluated = (outcome: 'ALLOW' | 'CLARIFY' | 'REVIEW' | 'BLOCK' = 'ALLOW'): AiTaskPublicationCommand => ({ ...accepted(), state: 'EVALUATED', evaluation: { kind: 'DECISION', decision: {
  decisionId: '66666666-6666-4666-8666-666666666666', decisionSequence: 1, needId: NEED, needRevision: 1,
  canonicalFingerprint: 'd'.repeat(64), policyBundleId: '77777777-7777-4777-8777-777777777777', policyVersion: 1, jurisdiction: 'RS',
  outcome, decisionAt: '2026-09-12T12:00:00Z', ruleIds: ['SYNTHETIC_RULE'], safeReasonCodes: [], publishable: outcome === 'ALLOW', authoritative: true,
} } });
const published = (): AiTaskPublicationCommand => ({ ...evaluated(), state: 'PUBLISHED', published: { needId: NEED, status: 'PUBLISHED', publishedAt: '2026-09-12T12:00:01Z', responseDeadline: null, idempotentReplay: false } });
let stored: AiTaskPublicationCommand | null;
beforeEach(() => {
  delete process.env.EXPO_PUBLIC_USKOCI_TASK_AI_APPLICATION_DEADLINE_V1;
  mockSession = { user: { id: OWNER }, accountRevision: 1 }; stored = null;
  mockRpc.mockReset(); mockInvoke.mockReset(); mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: OWNER }, access_token: 'SYNTHETIC_TOKEN' } }, error: null });
  mockRpc.mockImplementation(async (name: string) => {
    if (name === 'rpc_prepare_ai_task_review') return answer(review());
    if (name === 'rpc_read_ai_task_review' || name === 'rpc_read_latest_ai_task_review') return answer({ review: review(), command: stored });
    if (name === 'rpc_accept_ai_task_review') { stored ??= accepted(); return answer(stored); }
    if (name === 'rpc_publish_accepted_ai_task_review') { stored = published(); return answer(stored); }
    throw new Error('UNEXPECTED_RPC');
  });
  mockInvoke.mockImplementation(async () => { stored = evaluated(); return answer(stored.evaluation); });
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_USKOCI_TASK_AI_APPLICATION_DEADLINE_V1;
});

it('opening review does not accept facts, save a draft, evaluate or publish', async () => {
  await expect(service.prepare({ conversationId: CONVERSATION, responseDeadline: null })).resolves.toEqual({ ok: true, podatak: review() });
  expect(mockRpc).toHaveBeenCalledTimes(1); expect(mockRpc).toHaveBeenCalledWith('rpc_prepare_ai_task_review', { p_conversation_id: CONVERSATION, p_response_deadline: null, p_location: null });
  expect(stored).toBeNull(); expect(mockInvoke).not.toHaveBeenCalled();
});

it('reports the published-edit gate without evaluating, retrying or claiming a saved draft', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'PUBLISHED_TASK_EDIT_NOT_READY' } });
  await expect(service.acceptAndPublish({ review: { ...review(), draftId: NEED, draftRevision: 4 }, clientRequestId: KEY }))
    .resolves.toMatchObject({ ok: false, kod: 'PUBLISHED_TASK_EDIT_NOT_READY', poruka: expect.stringContaining('Postojeća objava nije promenjena') });
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockInvoke).not.toHaveBeenCalled();
});

const replacementReview = (base = 0): AiTaskReviewEnvelope => ({ ...review(), draftId: base ? NEED : OTHER,
  draftRevision: base || 4, replacement: { version: 'TASK_REPLACEMENT_V1', sourceNeedId: OTHER,
    sourceRevision: 4, sourceFingerprint: 'e'.repeat(64), targetNeedId: NEED, targetBaseRevision: base } });

it.each([0, 2])('accepts only the reserved replacement target at base revision %i', async base => {
  const shown = replacementReview(base), receipt = { ...accepted(), needRevision: base + 1 };
  mockRpc.mockResolvedValueOnce(answer(receipt));
  await expect(service.acceptAsDraft({ review: shown, clientRequestId: KEY })).resolves.toEqual({ ok: true, podatak: receipt });
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(mockRpc.mock.calls[0][1]).toEqual({ p_review_id: REVIEW, p_displayed_content_digest: shown.displayedContentDigest, p_client_request_id: KEY });
});

it('evaluates and publishes the replacement candidate after authoritative readback', async () => {
  const shown = replacementReview(), implementation = mockRpc.getMockImplementation()!;
  mockRpc.mockImplementation(async (name: string, ...args: unknown[]) => name === 'rpc_read_ai_task_review'
    ? answer({ review: shown, command: stored }) : implementation(name, ...args));
  await expect(service.acceptAndPublish({ review: shown, clientRequestId: KEY }))
    .resolves.toEqual({ ok: true, podatak: published() });
  expect(mockInvoke.mock.calls[0][1].body).toEqual({ needId: NEED, expectedRevision: 1, acceptedReviewId: REVIEW });
  expect(mockRpc.mock.calls.map(x => x[0])).toEqual(['rpc_accept_ai_task_review', 'rpc_read_ai_task_review',
    'rpc_read_ai_task_review', 'rpc_publish_accepted_ai_task_review']);
});

it.each([
  { needId: OTHER, needRevision: 5 }, // old in-place edit must never pass as a replacement
  { needId: CONVERSATION, needRevision: 1 }, // arbitrary different target
  { needId: NEED, needRevision: 5 }, // original revision + 1 is not the candidate revision
])('rejects a mismatched replacement receipt %j without evaluation', async invalidCommand => {
  mockRpc.mockResolvedValueOnce(answer({ ...accepted(), ...invalidCommand }));
  await expect(service.acceptAndPublish({ review: replacementReview(), clientRequestId: KEY }))
    .resolves.toMatchObject({ ok: false, kod: 'TASK_REVIEW_INVALID_RESPONSE' });
  expect(mockInvoke).not.toHaveBeenCalled();
});

it('requires complete immutable replacement ancestry and preserves strict legacy ID checks', async () => {
  const shown = replacementReview();
  expect(decodeAiTaskReview(shown, OWNER)?.replacement).toEqual(shown.replacement);
  for (const mutation of [
    { replacement: null }, { replacement: { ...shown.replacement, extra: true } },
    { replacement: { ...shown.replacement, sourceNeedId: NEED } },
    { replacement: { ...shown.replacement, sourceFingerprint: 'bad' } },
    { replacement: { ...shown.replacement, targetBaseRevision: -1 } },
    { replacement: { ...shown.replacement, targetBaseRevision: 1.5 } },
    { replacement: { ...shown.replacement, sourceRevision: 3 } },
    { draftId: NEED }, { draftRevision: 3 },
  ]) expect(decodeAiTaskReview({ ...shown, ...mutation }, OWNER)).toBeNull();
  expect(decodeAiTaskReview({ ...replacementReview(2), draftRevision: 1 }, OWNER)).toBeNull();
  const { replacement: _replacement, ...legacy } = shown;
  mockRpc.mockResolvedValueOnce(answer(accepted()));
  await expect(service.acceptAsDraft({ review: legacy, clientRequestId: KEY }))
    .resolves.toMatchObject({ ok: false, kod: 'TASK_REVIEW_INVALID_RESPONSE' });
});

it('recovers replacement acceptance after a lost ACK without recreating the candidate', async () => {
  const shown = replacementReview();
  mockRpc.mockImplementation(async (name: string) => {
    if (name === 'rpc_accept_ai_task_review') { stored = accepted(); throw new Error('LOST_ACK'); }
    if (name === 'rpc_read_latest_ai_task_review') return answer({ review: shown, command: stored });
    throw new Error('UNEXPECTED_RPC');
  });
  await expect(service.acceptAsDraft({ review: shown, clientRequestId: KEY }))
    .resolves.toMatchObject({ ok: false, kod: 'TASK_REVIEW_OUTCOME_UNCONFIRMED' });
  await expect(service.readLatest(CONVERSATION)).resolves.toEqual({ ok: true, podatak: { review: shown, command: accepted() } });
  expect(mockRpc.mock.calls.filter(x => x[0] === 'rpc_accept_ai_task_review')).toHaveLength(1);
  expect(mockInvoke).not.toHaveBeenCalled();
});

it('explains a changed source without publishing or retrying', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'REPLACEMENT_SOURCE_STALE' } });
  await expect(service.acceptAndPublish({ review: replacementReview(), clientRequestId: KEY }))
    .resolves.toMatchObject({ ok: false, kod: 'REPLACEMENT_SOURCE_STALE', poruka: expect.stringContaining('u međuvremenu promenjen') });
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

it('opt-in review derives the deadline from facts through the separate signed prepare RPC', async () => {
  process.env.EXPO_PUBLIC_USKOCI_TASK_AI_APPLICATION_DEADLINE_V1 = 'true';
  mockRpc.mockResolvedValueOnce(answer(review()));
  await expect(service.prepare({ conversationId: CONVERSATION, responseDeadline: null })).resolves.toEqual({ ok: true, podatak: review() });
  expect(mockRpc).toHaveBeenCalledWith('rpc_prepare_ai_task_review_deadline', {
    p_conversation_id: CONVERSATION, p_location: null,
  });
  expect(mockRpc.mock.calls[0][1]).not.toHaveProperty('p_response_deadline');
  expect(mockInvoke).not.toHaveBeenCalled();
});

it('one explicit click accepts exact server digest then publishes only after durable ALLOW readback', async () => {
  await expect(service.acceptAndPublish({ review: review(), clientRequestId: KEY })).resolves.toEqual({ ok: true, podatak: published() });
  expect(mockRpc.mock.calls.map(x => x[0])).toEqual(['rpc_accept_ai_task_review', 'rpc_read_ai_task_review', 'rpc_read_ai_task_review', 'rpc_publish_accepted_ai_task_review']);
  expect(mockRpc.mock.calls[0][1]).toEqual({ p_review_id: REVIEW, p_displayed_content_digest: 'a'.repeat(64), p_client_request_id: KEY });
  expect(mockInvoke).toHaveBeenCalledTimes(1); expect(mockInvoke.mock.calls[0][1].body).toEqual({ needId: NEED, expectedRevision: 1, acceptedReviewId: REVIEW });
});

it('PKG037 waits for a slow accepted-review evaluation then reads authority before publishing', async () => {
  jest.useFakeTimers();
  try {
    mockInvoke.mockImplementation(() => {
      stored = { ...accepted(), state: 'EVALUATING' };
      return new Promise(resolve => setTimeout(() => { stored = evaluated(); resolve(answer(stored.evaluation)); }, 20_000));
    });
    let settled = false;
    const pending = service.acceptAndPublish({ review: review(), clientRequestId: KEY }).then(result => { settled = true; return result; });
    await jest.advanceTimersByTimeAsync(15_001);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toEqual({ ok: true, podatak: published() });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls.filter(x => x[0] === 'rpc_read_ai_task_review')).toHaveLength(2);
  } finally { jest.clearAllTimers(); jest.useRealTimers(); }
});

it('PKG037 an unanswered evaluator remains bounded and is not dispatched again from recovery', async () => {
  jest.useFakeTimers();
  try {
    mockInvoke.mockImplementation(() => { stored = { ...accepted(), state: 'EVALUATING' }; return new Promise(() => {}); });
    let settled = false;
    const pending = service.acceptAndPublish({ review: review(), clientRequestId: KEY }).then(result => { settled = true; return result; });
    await jest.advanceTimersByTimeAsync(54_999); expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toMatchObject({ ok: true, podatak: { state: 'EVALUATING' } });
    await expect(service.resume(stored!)).resolves.toMatchObject({ ok: true, podatak: { state: 'EVALUATING' } });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls.some(x => x[0] === 'rpc_publish_accepted_ai_task_review')).toBe(false);
  } finally { jest.clearAllTimers(); jest.useRealTimers(); }
});

// Deep read 5.1: the server refuses a fixed time that has begun; the client says it before any paid evaluation.
it('a fixed time that has already begun is refused before accepting, evaluating or publishing', async () => {
  const fact = (key: string, value: string) => ({ id: null, key, value, displayValue: value, privacyClass: 'PUBLIC', source: 'EXPLICIT_USER_ANSWER', status: 'CONFIRMED' });
  const at = (start: string) => ({ ...review(), publicProjection: [fact('need.schedule_kind', 'FIXED_WINDOW'), fact('need.starts_at', start)] }) as AiTaskReviewEnvelope;
  await expect(service.acceptAndPublish({ review: at('2020-01-01T08:00:00Z'), clientRequestId: KEY }))
    .resolves.toMatchObject({ ok: false, kod: 'FIXED_WINDOW_START_PASSED', poruka: expect.stringContaining('Početak termina je već prošao') });
  expect(mockRpc).not.toHaveBeenCalled(); expect(mockInvoke).not.toHaveBeenCalled();
  await expect(service.acceptAndPublish({ review: at('2999-01-01T08:00:00Z'), clientRequestId: KEY })).resolves.toEqual({ ok: true, podatak: published() });
});

it.each(['CLARIFY', 'REVIEW', 'BLOCK'] as const)('%s remains a typed stored evaluation without a second confirmation or automatic publish', async outcome => {
  mockInvoke.mockImplementation(async () => { stored = evaluated(outcome); return answer(stored.evaluation); });
  const result = await service.acceptAndPublish({ review: review(), clientRequestId: KEY });
  expect(result).toEqual({ ok: true, podatak: evaluated(outcome) });
  expect(mockRpc.mock.calls.some(x => x[0] === 'rpc_publish_accepted_ai_task_review')).toBe(false);
});

it('saving a draft accepts the exact displayed review and stops: no evaluator, no publish', async () => {
  await expect(service.acceptAsDraft({ review: review(), clientRequestId: KEY })).resolves.toEqual({ ok: true, podatak: accepted() });
  expect(mockRpc.mock.calls.map(x => x[0])).toEqual(['rpc_accept_ai_task_review']);
  expect(mockRpc.mock.calls[0][1]).toEqual({ p_review_id: REVIEW, p_displayed_content_digest: 'a'.repeat(64), p_client_request_id: KEY });
  expect(mockInvoke).not.toHaveBeenCalled();
});

it('lost acceptance response is recovered from durable latest review after app restart without accepting again', async () => {
  const implementation = mockRpc.getMockImplementation()!;
  mockRpc.mockImplementation(async (name: string, ...args: unknown[]) => {
    if (name === 'rpc_accept_ai_task_review') { stored = accepted(); throw new Error('LOST_ACK'); }
    return implementation(name, ...args);
  });
  const unknown = await service.acceptAndPublish({ review: review(), clientRequestId: KEY });
  expect(unknown).toMatchObject({ ok: false, kod: 'TASK_REVIEW_OUTCOME_UNCONFIRMED' }); expect(mockInvoke).not.toHaveBeenCalled();
  const recovered = await service.readLatest(CONVERSATION); expect(recovered).toEqual({ ok: true, podatak: { review: review(), command: accepted() } });
  await expect(service.resume(accepted())).resolves.toEqual({ ok: true, podatak: published() });
  expect(mockRpc.mock.calls.filter(x => x[0] === 'rpc_accept_ai_task_review')).toHaveLength(1);
});

it.each(['EVALUATING', 'UNKNOWN_OUTCOME', 'PUBLISHED'] as const)('durable %s recovery never invokes another provider', async state => {
  stored = state === 'PUBLISHED' ? published() : { ...accepted(), state };
  await expect(service.resume(stored)).resolves.toEqual({ ok: true, podatak: stored });
  expect(mockInvoke).not.toHaveBeenCalled(); expect(mockRpc).toHaveBeenCalledTimes(1);
});

it('stored ALLOW survives app kill and resumes canonical publish without another evaluator', async () => {
  stored = evaluated(); await expect(service.resume(stored)).resolves.toEqual({ ok: true, podatak: published() });
  expect(mockInvoke).not.toHaveBeenCalled();
});

it.each(['ACCEPTED', 'EVALUATED'] as const)('canonical historical true %s is readable but does not resume impossible paid work or publish', async state => {
  stored = state === 'ACCEPTED' ? accepted() : evaluated();
  const historical = { ...review(), publicProjection: [{ id: NEED, key: 'need.verified_identity_required', value: true, displayValue: 'Da',
    privacyClass: 'PUBLIC', source: 'SYSTEM_DERIVED', status: 'CONFIRMED' }] };
  mockRpc.mockResolvedValue(answer({ review: historical, command: stored }));
  expect(decodeAiTaskReview(historical, OWNER)).toMatchObject({ canAccept: true, publicProjection: [{ value: true }] });
  await expect(service.resume(stored)).resolves.toMatchObject({ ok: false, kod: 'IDENTITY_VERIFICATION_UNAVAILABLE' });
  expect(mockRpc.mock.calls.map(c => c[0])).toEqual(['rpc_read_ai_task_review']);
  expect(mockInvoke).not.toHaveBeenCalled(); expect(mockGetSession).not.toHaveBeenCalled();
});

it('late acceptance after an account round trip cannot invoke the evaluator in the new incarnation', async () => {
  mockRpc.mockImplementation(async () => { mockSession = { user: { id: OWNER }, accountRevision: 3 }; return answer(accepted()); });
  await expect(service.acceptAndPublish({ review: review(), clientRequestId: KEY })).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(mockInvoke).not.toHaveBeenCalled(); expect(mockRpc).toHaveBeenCalledTimes(1);
});

it('out-of-scope review and private fact smuggled into public projection are rejected before any write', async () => {
  const foreign = { ...review(), accountId: OTHER };
  expect(decodeAiTaskReview(foreign, OWNER)).toBeNull();
  const leaked = { ...review(), publicProjection: [{ id: null, key: 'need.exact_address', value: 'PRIVATE_ADDRESS', displayValue: 'PRIVATE_ADDRESS', source: 'EXPLICIT_USER_ANSWER', status: 'NEEDS_CONFIRMATION', privacyClass: 'PUBLIC' }] };
  expect(decodeAiTaskReview(leaked, OWNER)).toBeNull();
  await expect(service.acceptAndPublish({ review: foreign, clientRequestId: KEY })).resolves.toMatchObject({ ok: false, kod: 'TASK_REVIEW_INPUT_INVALID' });
  expect(mockRpc).not.toHaveBeenCalled(); expect(mockInvoke).not.toHaveBeenCalled();
});

it('server stale review stays typed and cannot start later stages', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'TASK_REVIEW_STALE', details: 'PRIVATE_SQL_SENTINEL' } });
  const result = await service.acceptAndPublish({ review: review(), clientRequestId: KEY });
  expect(result).toMatchObject({ ok: false, kod: 'TASK_REVIEW_STALE' }); expect(JSON.stringify(result)).not.toContain('PRIVATE_SQL_SENTINEL');
  expect(mockInvoke).not.toHaveBeenCalled();
});

it('late Edge response after account switch causes no read or publish for the new user', async () => {
  mockInvoke.mockImplementation(async () => { stored = evaluated(); mockSession = { user: { id: OTHER }, accountRevision: 2 }; return answer(stored.evaluation); });
  await expect(service.acceptAndPublish({ review: review(), clientRequestId: KEY })).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(mockRpc.mock.calls.map(x => x[0])).toEqual(['rpc_accept_ai_task_review', 'rpc_read_ai_task_review']);
});

it('no previous review is a nullable read success', async () => {
  mockRpc.mockResolvedValue(answer(null)); await expect(service.readLatest(CONVERSATION)).resolves.toEqual({ ok: true, podatak: null });
});

it('bound review admits inherited system facts without relabeling them as defaults', () => {
  const bound = { ...review(), draftId: NEED, draftRevision: 7, publicProjection: [{ id: KEY, key: 'need.title', value: 'Sačuvan naslov', displayValue: 'Sačuvan naslov',
    privacyClass: 'PUBLIC', source: 'SYSTEM_DERIVED', status: 'CONFIRMED' }] };
  expect(decodeAiTaskReview(bound, OWNER)?.publicProjection[0].source).toBe('SYSTEM_DERIVED');
});

it('bound acceptance response cannot change the reviewed Need identity or revision', async () => {
  const bound = { ...review(), draftId: NEED, draftRevision: 7 };
  mockRpc.mockResolvedValue(answer({ ...accepted(), needId: OTHER, needRevision: 8 }));
  await expect(service.acceptAndPublish({ review: bound, clientRequestId: KEY })).resolves.toMatchObject({ ok: false, kod: 'TASK_REVIEW_INVALID_RESPONSE' });
  mockRpc.mockResolvedValue(answer({ ...accepted(), needRevision: 9 }));
  await expect(service.acceptAndPublish({ review: bound, clientRequestId: KEY })).resolves.toMatchObject({ ok: false, kod: 'TASK_REVIEW_INVALID_RESPONSE' });
  expect(mockInvoke).not.toHaveBeenCalled();
});

// Deep read 8.5: what the server would refuse about the facts, said before the tap.
describe('reviewFactProblem', () => {
  const fact = (key: string, value: unknown) => ({ id: null, key, value, displayValue: String(value), privacyClass: 'PUBLIC', source: 'EXPLICIT_USER_ANSWER', status: 'CONFIRMED' });
  const withFacts = (...facts: ReturnType<typeof fact>[]) => ({ ...review(), publicProjection: [
    fact('need.handoff', { required: false }), ...facts,
  ] }) as AiTaskReviewEnvelope;
  const NOW = Date.parse('2026-09-21T12:00:00Z');
  it('names missing price, optional end, invalid given end and passed start', () => {
    expect(reviewFactProblem(withFacts(fact('need.price_mode', 'MY_PRICE')), NOW)).toBe('Unesi iznos ili izaberi prikupljanje ponuda.');
    expect(reviewFactProblem(withFacts(fact('need.price_mode', 'MY_PRICE'), fact('need.price_rsd', 5000)), NOW)).toBeNull();
    expect(reviewFactProblem(withFacts(fact('need.schedule_kind', 'FIXED_WINDOW'), fact('need.starts_at', '2026-09-22T08:00:00Z')), NOW))
      .toBeNull();
    expect(reviewFactProblem(withFacts(fact('need.schedule_kind', 'FIXED_WINDOW'), fact('need.starts_at', '2026-09-22T10:00:00Z'),
      fact('need.ends_at', '2026-09-22T09:00:00Z')), NOW)).toContain('kraj naveden');
    expect(reviewFactProblem(withFacts(fact('need.schedule_kind', 'FIXED_WINDOW'), fact('need.starts_at', '2026-09-21T08:00:00Z'),
      fact('need.ends_at', '2026-09-21T13:00:00Z')), NOW)).toContain('Početak termina je već prošao');
    expect(reviewFactProblem(withFacts(fact('need.schedule_kind', 'FIXED_WINDOW'), fact('need.starts_at', '2026-09-22T08:00:00Z'),
      fact('need.ends_at', '2026-09-22T12:00:00Z')), NOW)).toBeNull();
    expect(reviewFactProblem(withFacts(fact('need.price_mode', 'OFFERS'), fact('need.schedule_kind', 'FLEXIBLE')), NOW)).toBeNull();
  });
});


it('Gate A signed canonical Need category and mode decode without a second acceptance', () => {
  const base = review();
  const signed = {
    ...base,
    publicProjection:[{id:null,key:'need.category',value:'Izrada prezentacija',
      displayValue:'Izrada prezentacija',privacyClass:'PUBLIC',source:'EXPLICIT_USER_ANSWER',status:'CONFIRMED'}],
    classificationState:'READY',
    classificationCandidates:[{action:'REUSE_EXISTING',service:'Izrada prezentacija',mode:'REMOTE',
      categoryId:'22222222-2222-4222-8222-222222222222',catalogVersion:9,
      reason:'Verified existing canonical identity or registered server alias'}],
    classificationCatalogVersion:9,classificationCatalogFingerprint:'f'.repeat(32),reviewedServiceModes:[],
  };
  const checked=decodeAiTaskReview(signed,OWNER);
  expect(checked).not.toBeNull();
  expect(checked?.classificationCandidates?.[0]).toMatchObject({categoryId:'22222222-2222-4222-8222-222222222222'});
  // The category must be visible in the ordinary public task projection.
  expect(checked?.publicProjection.find(x=>x.key==='need.category')?.displayValue).toBe('Izrada prezentacija');
  expect(decodeAiTaskReview({...signed,classificationCandidates:[
    {...signed.classificationCandidates[0],service:'Krečenje zidova'}]},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,classificationCandidates:[
    {...signed.classificationCandidates[0],mode:'ON_SITE'}]},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,classificationCandidates:[
    {...signed.classificationCandidates[0],categoryId:'INVALID'}]},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,classificationCatalogFingerprint:'WRONG'},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,reviewedServiceModes:[{service:'Izrada prezentacija',mode:'REMOTE'}]},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,classificationCatalogVersion:8},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,classificationState:'PENDING_CLASSIFICATION',
    classificationCandidates:[],classificationCatalogVersion:null,classificationCatalogFingerprint:null},OWNER))
    .toMatchObject({classificationState:'PENDING_CLASSIFICATION',canAccept:true});
  // Pre-rollout old review remains readable and Save still passes its original digest.
  expect(decodeAiTaskReview(base,OWNER)).toEqual(base);
  expect(decodeAiTaskReview({...signed,classificationCatalogFingerprint:undefined},OWNER)).toBeNull();
});

it('keeps the signed task handoff and mode extension witness; malformed or on-site candidate handoff is rejected', () => {
  const handoff={required:true,localExchange:{countryCode:'RS',city:'Novi Sad'}};
  const candidate={action:'EXTEND_MODE',service:'Popravka muzičke kutije',mode:'REMOTE',categoryId:NEED,
    categoryLabel:'Popravka muzičke kutije',categoryParentId:null,catalogVersion:9,reason:'Popravka se obavlja kod izvršioca',handoff};
  const signed={...review(),publicProjection:[
    {id:null,key:'need.category',value:candidate.service,displayValue:candidate.service,privacyClass:'PUBLIC',source:'EXPLICIT_USER_ANSWER',status:'CONFIRMED'},
    {id:null,key:'need.handoff',value:handoff,displayValue:'Predaja',privacyClass:'PUBLIC',source:'EXPLICIT_USER_ANSWER',status:'CONFIRMED'}],
    classificationState:'READY',classificationCandidates:[candidate],classificationCatalogVersion:9,
    classificationCatalogFingerprint:'f'.repeat(32),reviewedServiceModes:[]};
  expect(decodeAiTaskReview(signed,OWNER)).toMatchObject({classificationCandidates:[candidate],publicProjection:signed.publicProjection});
  for(const patch of [{categoryLabel:undefined},{categoryParentId:'bad'},{handoff:{...handoff,exactAddress:'PRIVATE 42'}},{mode:'ON_SITE'}])
    expect(decodeAiTaskReview({...signed,classificationCandidates:[{...candidate,...patch}]},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,publicProjection:[signed.publicProjection[0],
    {...signed.publicProjection[1],value:{required:true}}]},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,publicProjection:[signed.publicProjection[0]]},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,publicProjection:[signed.publicProjection[0],
    {...signed.publicProjection[1],value:{required:true,shippingCountries:['RS']}}]},OWNER)).toBeNull();
});
it('accepts a reviewed new child and rejects a different leaf or parent',()=>{
 const base=review();
 const child={action:'CREATE_CHILD',service:'Izrada 3D figurica',mode:'REMOTE',
   parentId:'11111111-1111-4111-8111-111111111111',parentLabel:'Digitalne usluge',
   path:['Izrada 3D figurica'],catalogVersion:9,
   reason:'Owner-reviewed new service under the established parent'};
 const signed={...base,publicProjection:[{id:null,key:'need.category',value:'Izrada 3D figurica',
   displayValue:'Izrada 3D figurica',privacyClass:'PUBLIC',source:'EXPLICIT_USER_ANSWER',status:'CONFIRMED'}],
   classificationState:'READY',classificationCandidates:[child],classificationCatalogVersion:9,
   classificationCatalogFingerprint:'f'.repeat(32),reviewedServiceModes:[]};
 expect(decodeAiTaskReview(signed,OWNER)?.classificationCandidates).toMatchObject([child]);
 const deep={...child,path:[...Array.from({length:9},(_,i)=>'Grana '+i),'Izrada 3D figurica']};
 expect(decodeAiTaskReview({...signed,classificationCandidates:[deep]},OWNER)?.classificationCandidates).toMatchObject([deep]);
 expect(decodeAiTaskReview({...signed,classificationCandidates:[{...child,path:['Druga usluga']}]},OWNER)).toBeNull();
 expect(decodeAiTaskReview({...signed,classificationCandidates:[{...child,parentId:'bad'}]},OWNER)).toBeNull();
});
it('accepts a signed new main branch only with a null parent and visible leaf',()=>{
 const base=review();
 const root={action:'CREATE_NEW_BRANCH',service:'Izrada 3D figurica',mode:'REMOTE',
   parentId:null,parentLabel:null,path:['3D izrada','Izrada 3D figurica'],catalogVersion:9,
   reason:'No established parent correctly describes this confirmed service'};
 const signed={...base,publicProjection:[{id:null,key:'need.category',value:'Izrada 3D figurica',
   displayValue:'Izrada 3D figurica',privacyClass:'PUBLIC',source:'EXPLICIT_USER_ANSWER',status:'CONFIRMED'}],
   classificationState:'READY',classificationCandidates:[root],classificationCatalogVersion:9,
   classificationCatalogFingerprint:'f'.repeat(32),reviewedServiceModes:[]};
 expect(decodeAiTaskReview(signed,OWNER)?.classificationCandidates).toMatchObject([root]);
 expect(decodeAiTaskReview({...signed,classificationCandidates:[{...root,parentId:'11111111-1111-4111-8111-111111111111'}]},OWNER)).toBeNull();
 expect(decodeAiTaskReview({...signed,classificationCandidates:[{...root,path:['Drugi posao']}]},OWNER)).toBeNull();
});

it('explicit preview opt-in routes requester review to signed version without changing user Save',async()=>{
  const prior=process.env.EXPO_PUBLIC_USKOCI_NEED_SIGNED_REVIEW;
  try{
    process.env.EXPO_PUBLIC_USKOCI_NEED_SIGNED_REVIEW='true';
    const signed:AiTaskReviewEnvelope={...review(),classificationState:'PENDING_CLASSIFICATION',
      classificationCandidates:[],classificationCatalogVersion:null,classificationCatalogFingerprint:null,reviewedServiceModes:[]};
    mockRpc.mockImplementation(async (name:string)=>{
      if(name==='rpc_prepare_ai_task_review_taxonomy')return answer(signed);
      if(name==='rpc_accept_ai_task_review')return answer(accepted());
      if(name==='rpc_read_ai_task_review')return answer({review:signed,command:accepted()});
      throw new Error('UNEXPECTED_RPC');
    });
    await expect(service.prepare({conversationId:CONVERSATION,responseDeadline:null})).resolves
      .toMatchObject({ok:true,podatak:{classificationState:'PENDING_CLASSIFICATION',canAccept:true}});
    expect(mockRpc.mock.calls.map(c=>c[0])).toEqual(['rpc_prepare_ai_task_review_taxonomy']);
    // Signed classification is review metadata; accepted Save still uses
    // the immutable original review ID/digest, with no invented permission.
    await expect(service.acceptAsDraft({review:signed as AiTaskReviewEnvelope,clientRequestId:KEY}))
      .resolves.toMatchObject({ok:true});
    expect(mockRpc.mock.calls[1][0]).toBe('rpc_accept_ai_task_review');
    expect(mockRpc.mock.calls[1][1]).toEqual({
      p_review_id:REVIEW,p_displayed_content_digest:'a'.repeat(64),p_client_request_id:KEY});
  }finally{
    if(prior===undefined)delete process.env.EXPO_PUBLIC_USKOCI_NEED_SIGNED_REVIEW;
    else process.env.EXPO_PUBLIC_USKOCI_NEED_SIGNED_REVIEW=prior;
  }
});


it('R04/F05: requester reads signed unapproved meaning without granting a publishable category',()=>{
  const category='Montaža gotovog ormara';
  const row={id:null,key:'need.category',value:category,displayValue:category,
    privacyClass:'PUBLIC',source:'EXPLICIT_USER_ANSWER',status:'CONFIRMED'};
  const proposal={
    service:category,mode:'REMOTE',categoryId:NEED,categoryLabel:'Sklapanje ormara',
    categoryParentId:null,reason:'Isti konkretan posao sklapanja gotovog ormara.',catalogVersion:9
  };
  const signed={...review(),publicProjection:[row],
    classificationState:'REVIEW_REQUIRED',classificationCandidates:[],reviewedServiceModes:[],
    classificationCatalogVersion:9,classificationCatalogFingerprint:'f'.repeat(32),
    semanticReviewCandidates:[proposal]};
  expect(decodeAiTaskReview(signed,OWNER)).toMatchObject({
    classificationState:'REVIEW_REQUIRED',classificationCandidates:[],
    semanticReviewCandidates:[proposal],canAccept:true});
  expect(decodeAiTaskReview({...signed,classificationState:'READY'},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,publicProjection:[]},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,semanticReviewCandidates:[{...proposal,mode:'ON_SITE'}]},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,semanticReviewCandidates:[{...proposal,categoryId:'fake-id'}]},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,semanticReviewCandidates:[{...proposal,catalogVersion:10}]},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,semanticReviewCandidates:[{...proposal,categoryLabel:'Sklapanje ormara',unreviewed:true}]},OWNER)).toBeNull();
  expect(decodeAiTaskReview({...signed,accountId:OTHER},OWNER)).toBeNull();
});
