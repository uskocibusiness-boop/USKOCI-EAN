import { createActivityApplicationPushTargetService, decodeActivityApplicationPushTarget } from '../activityApplicationPushTargetService';

const accountId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const needId = '33333333-3333-4333-8333-333333333333';
const responseId = '44444444-4444-4444-8444-444444444444';
let mockSession = { user: { id: accountId }, accountRevision: 1 };
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
const valid = { schema: 'ACTIVITY_APPLICATION_TARGET_V1', accountId, authoritative: true, kind: 'APPLICATION',
  eventId, eventType: 'RESPONSE_RECEIVED', needId, responseId, role: 'REQUESTER' };
const unavailable = { schema: 'ACTIVITY_APPLICATION_TARGET_V1', accountId, authoritative: true, kind: 'UNAVAILABLE' };

beforeEach(() => { mockSession = { user: { id: accountId }, accountRevision: 1 }; });

test('strict recipient event receipt carries only the exact response route', () => {
  expect(decodeActivityApplicationPushTarget(valid, accountId, eventId, 'RESPONSE_RECEIVED')).toEqual(valid);
  expect(decodeActivityApplicationPushTarget(unavailable, accountId, eventId, 'RESPONSE_RECEIVED')).toEqual(unavailable);
  for (const wrong of [
    { ...valid, accountId: needId }, { ...valid, eventId: needId }, { ...valid, eventType: 'RESPONSE_UPDATED' },
    { ...valid, role: 'WORKER' }, { ...valid, needId: 'bad' }, { ...valid, responseId: 'bad' },
    { ...valid, url: '/potrebe/private' }, { ...valid, authoritative: false },
    { ...unavailable, responseId },
  ]) expect(decodeActivityApplicationPushTarget(wrong, accountId, eventId, 'RESPONSE_RECEIVED')).toBeNull();
});

test.each(['RESPONSE_RECEIVED', 'RESPONSE_UPDATED'] as const)('%s resolves through one fixed owner-scoped RPC', async eventType => {
  const rpc = jest.fn().mockResolvedValue({ data: { ...valid, eventType }, error: null });
  const result = await createActivityApplicationPushTargetService(rpc).resolve(eventId, eventType, {}, { accountId, accountRevision: 1 });
  expect(result).toEqual({ ok: true, podatak: { ...valid, eventType } });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('rpc_resolve_activity_application_v1',
    { p_expected_user_id: accountId, p_event_id: eventId }, expect.any(AbortSignal));
});

test('missing RPC, foreign account or mismatched event never yields a route', async () => {
  for (const output of [{ data: null, error: { message: 'missing' } },
    { data: { ...valid, accountId: needId }, error: null },
    { data: { ...valid, eventType: 'RESPONSE_UPDATED' }, error: null }]) {
    const result = await createActivityApplicationPushTargetService(jest.fn().mockResolvedValue(output)).resolve(eventId, 'RESPONSE_RECEIVED');
    expect(result.ok).toBe(false);
  }
});

test('abort releases a transport that never resolves, and account ABA refuses a late receipt', async () => {
  let answer!: (value: unknown) => void;
  const rpc = jest.fn().mockImplementation(() => new Promise(resolve => { answer = resolve; }));
  const service = createActivityApplicationPushTargetService(rpc);
  const controller = new AbortController();
  const abandoned = service.resolve(eventId, 'RESPONSE_RECEIVED', { signal: controller.signal });
  await Promise.resolve();
  const signal = rpc.mock.calls[0][2] as AbortSignal;
  controller.abort();
  expect((await abandoned).ok).toBe(false);
  expect(signal.aborted).toBe(true);
  answer({ data: valid, error: null });

  const late = service.resolve(eventId, 'RESPONSE_RECEIVED');
  await Promise.resolve();
  mockSession = { user: { id: accountId }, accountRevision: 2 };
  answer({ data: valid, error: null });
  expect((await late).ok).toBe(false);
});
