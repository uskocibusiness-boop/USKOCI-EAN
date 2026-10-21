import { createActivityApplicationTargetService, decodeOwnedApplicationEvent } from '../activityApplicationTargetService';

const accountId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const needId = '33333333-3333-4333-8333-333333333333';
const responseId = '44444444-4444-4444-8444-444444444444';
let mockSession = { user: { id: accountId }, accountRevision: 1 };
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
const event = () => ({ id: eventId, recipient_user_id: accountId, recipient_role: 'REQUESTER',
  event_type: 'RESPONSE_RECEIVED', entity_type: 'RESPONSE', entity_id: responseId,
  payload: { needId, responseId, responseVersion: 1 } });
const scope = { accountId, accountRevision: 1 };

beforeEach(() => { mockSession = { user: { id: accountId }, accountRevision: 1 }; });

test('owned response event binds the exact response to the Need confirmed by the resolver', async () => {
  const reader = jest.fn().mockResolvedValue({ data: event(), error: null });
  const result = await createActivityApplicationTargetService(reader).resolve(eventId, needId, new AbortController().signal, scope);
  expect(result).toEqual({ ok: true, podatak: { responseId } });
  expect(reader).toHaveBeenCalledWith(eventId, accountId, expect.any(AbortSignal));
});

test.each([
  { recipient_user_id: '55555555-5555-4555-8555-555555555555' },
  { recipient_role: 'WORKER' },
  { event_type: 'MESSAGE_RECEIVED' },
  { entity_type: 'NEED' },
  { entity_id: '55555555-5555-4555-8555-555555555555' },
  { payload: { needId: '55555555-5555-4555-8555-555555555555', responseId } },
  { payload: { needId, responseId: '55555555-5555-4555-8555-555555555555' } },
])('mismatched event fields never choose another application (%o)', patch => {
  expect(decodeOwnedApplicationEvent({ ...event(), ...patch }, eventId, needId, accountId)).toBeNull();
});

test('account replacement during the read cannot return a route', async () => {
  let answer!: (value: unknown) => void;
  const reader = jest.fn().mockReturnValue(new Promise(resolve => { answer = resolve; }));
  const pending = createActivityApplicationTargetService(reader).resolve(eventId, needId, new AbortController().signal, scope);
  mockSession = { user: { id: '55555555-5555-4555-8555-555555555555' }, accountRevision: 2 };
  answer({ data: event(), error: null });
  expect((await pending).ok).toBe(false);
});

test('abandoned visit releases an unanswered read without an application target', async () => {
  const reader = jest.fn().mockReturnValue(new Promise(() => undefined));
  const controller = new AbortController();
  const pending = createActivityApplicationTargetService(reader).resolve(eventId, needId, controller.signal, scope);
  controller.abort();
  expect((await pending).ok).toBe(false);
});
