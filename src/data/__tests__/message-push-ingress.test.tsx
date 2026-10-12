import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useMessagePushIngress } from '../../hooks/useMessagePushIngress';
import { messagePushIntent } from '../../store/messagePushIntent';
import { pendingRoute } from '../../store/pendingRoute';
import { publicPushTarget } from '../../ui/notifications/pushTarget';

const mockResolve = jest.fn(), mockOpportunityResolve = jest.fn(), mockTarget = jest.fn();
let mockFocused = true, mockApp = 'active';
const mockAppListeners = new Set<(state: string) => void>();
const owner = { accountId: '11111111-1111-4111-8111-111111111111', accountRevision: 1, sessionEpoch: 1 };
let mockSession = { user: { id: owner.accountId }, accountRevision: 1, sessionEpoch: 1 };
jest.mock('../../data/activityMessageTargetService', () => ({ activityMessageTargetService: { resolve: (...args: unknown[]) => mockResolve(...args) } }));
jest.mock('../../data/activityOpportunityTargetService', () => ({ activityOpportunityTargetService: { resolve: (...args: unknown[]) => mockOpportunityResolve(...args) } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); const app = { get currentState() { return mockApp; }, addEventListener: (_: string, listener: (state: string) => void) => {
  mockAppListeners.add(listener); return { remove: () => { mockAppListeners.delete(listener); } };
} }; return new Proxy(native, { get(target, key) { return key === 'AppState' ? app : Reflect.get(target, key); } }); });
const event = '22222222-2222-4222-8222-222222222222', next = '33333333-3333-4333-8333-333333333333';
const target = { kind: 'AGREEMENT_MESSAGE', eventId: event, agreementId: '44444444-4444-4444-8444-444444444444', messageId: next };
let ui: ReturnType<typeof useMessagePushIngress>, tree: ReactTestRenderer;
function Screen() { ui = useMessagePushIngress(mockTarget); return null; }
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const mount = async () => { await act(async () => { tree = create(<Screen />); await flush(); }); };
const rerender = async () => { await act(async () => { tree.update(<Screen />); await flush(); }); };
const receive = (id = event, cold = false) => messagePushIntent.remember(id, owner, cold ? pendingRoute.remember('/obavestenja') : null);
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => { jest.clearAllMocks(); mockApp = 'active'; mockFocused = true; mockAppListeners.clear(); messagePushIntent.clear(); pendingRoute.clear();
  mockSession = { user: { id: owner.accountId }, accountRevision: 1, sessionEpoch: 1 }; mockResolve.mockResolvedValue({ ok: true, podatak: target }); });
afterEach(async () => { await act(async () => { tree?.unmount(); }); messagePushIntent.clear(); pendingRoute.clear(); });

it('legacy and exact contracts admit only their fixed fields', () => {
  expect(publicPushTarget({ kind: 'INBOX' })).toEqual({ kind: 'INBOX' });
  expect(publicPushTarget({ kind: 'INBOX', eventType: 'MESSAGE_RECEIVED', eventId: event })).toEqual({ kind: 'MESSAGE_EVENT', eventId: event });
  for (const value of [null, [], { kind: 'INBOX', eventId: event }, { kind: 'INBOX', eventType: 'OTHER', eventId: event },
    { kind: 'INBOX', eventType: 'MESSAGE_RECEIVED', eventId: 'private' }, { kind: 'INBOX', eventType: 'MESSAGE_RECEIVED', eventId: event, url: '/private' }]) expect(publicPushTarget(value)).toBeNull();
});
it('resolves an owned event without needing an Inbox page; no read ACK is sent', async () => {
  receive(); await mount();
  expect(mockResolve).toHaveBeenCalledWith(event, { signal: expect.any(AbortSignal) }, { accountId: owner.accountId, accountRevision: 1 });
  expect(mockTarget).toHaveBeenCalledWith(target); expect(messagePushIntent.snapshot()).toBeNull();
});
it('retires the exact cold return before reading so a later root consumer cannot replace the chat', async () => {
  const wait = deferred(); mockResolve.mockReturnValue(wait.promise); receive(event, true); await mount();
  expect(pendingRoute.takeDecision(owner)).toEqual({ kind: 'DELIVERED' });
  await act(async () => wait.resolve({ ok: true, podatak: target })); expect(mockTarget).toHaveBeenCalledTimes(1);
});
it.each(['cancel', 'blur', 'background', 'account', 'session'] as const)('a late result after %s cannot navigate or survive return', async reason => {
  const wait = deferred(); mockResolve.mockReturnValue(wait.promise); receive(); await mount();
  const signal = mockResolve.mock.calls[0][1].signal as AbortSignal;
  if (reason === 'cancel') act(() => ui.cancel());
  if (reason === 'blur') { mockFocused = false; await rerender(); }
  if (reason === 'background') act(() => { mockApp = 'background'; for (const listener of [...mockAppListeners]) listener(mockApp); });
  if (reason === 'account') { mockSession = { ...mockSession, accountRevision: 3 }; await rerender(); }
  if (reason === 'session') { mockSession = { ...mockSession, sessionEpoch: 2 }; await rerender(); }
  expect(signal.aborted).toBe(true);
  await act(async () => wait.resolve({ ok: true, podatak: target })); expect(mockTarget).not.toHaveBeenCalled();
  mockFocused = true; mockApp = 'active'; await rerender(); expect(mockResolve).toHaveBeenCalledTimes(1);
});
it('a newer event wins and the old cancellation cannot retire it', async () => {
  const old = deferred(); mockResolve.mockReturnValueOnce(old.promise); receive(); await mount();
  mockResolve.mockResolvedValueOnce({ ok: true, podatak: { ...target, eventId: next } });
  await act(async () => { receive(next); await flush(); });
  await act(async () => old.resolve({ ok: true, podatak: target }));
  expect(mockTarget.mock.calls).toEqual([[{ ...target, eventId: next }]]);
});
it('an error remains unread and offers one explicit fresh retry', async () => {
  mockResolve.mockResolvedValueOnce({ ok: false }); receive(); await mount();
  expect(ui.phase).toBe('error'); expect(mockTarget).not.toHaveBeenCalled();
  await act(async () => { ui.retry(); await flush(); });
  expect(mockResolve).toHaveBeenCalledTimes(2); expect(mockTarget).toHaveBeenCalledTimes(1);
});
it('unavailable never opens a guessed Agreement and has no automatic retry', async () => {
  mockResolve.mockResolvedValue({ ok: true, podatak: { kind: 'UNAVAILABLE' } }); receive(); await mount();
  expect(ui.phase).toBe('unavailable'); act(() => ui.retry()); expect(mockResolve).toHaveBeenCalledTimes(1); expect(mockTarget).not.toHaveBeenCalled();
});
it('waits for initial foreground instead of losing a tap during native resume', async () => {
  mockApp = 'background'; receive(); await mount(); expect(mockResolve).not.toHaveBeenCalled();
  await act(async () => { mockApp = 'active'; for (const listener of [...mockAppListeners]) listener(mockApp); await flush(); });
  expect(mockTarget).toHaveBeenCalledTimes(1);
});
it('a foreign-owner intent is retired without any resolver', async () => {
  messagePushIntent.remember(event, { ...owner, accountRevision: 0 }, null); await mount();
  expect(mockResolve).not.toHaveBeenCalled(); expect(messagePushIntent.snapshot()).toBeNull();
});

it('an opportunity event uses the separately authenticated need resolver and never the message resolver', async () => {
 const needId='66666666-6666-4666-8666-666666666666';
 mockOpportunityResolve.mockResolvedValue({ ok:true, podatak:{kind:'OPPORTUNITY', eventId:event, needId} });
 messagePushIntent.rememberOpportunity(event, owner, pendingRoute.remember('/obavestenja'));
 await mount();
 expect(mockResolve).not.toHaveBeenCalled();
 expect(mockOpportunityResolve).toHaveBeenCalledWith(event, { signal: expect.any(AbortSignal) }, { accountId: owner.accountId, accountRevision: 1 });
 expect(mockTarget).toHaveBeenCalledWith({kind:'OPPORTUNITY',eventId:event,needId});
 expect(messagePushIntent.snapshot()).toBeNull();
 expect(pendingRoute.takeDecision(owner)).toEqual({kind:'DELIVERED'});
});
it('a rejected opportunity never guesses a need id and never falls back to message routing', async () => {
 mockOpportunityResolve.mockResolvedValue({ok:true,podatak:{kind:'UNAVAILABLE'}});
 messagePushIntent.rememberOpportunity(event,owner,null); await mount();
 expect(ui.phase).toBe('unavailable'); expect(mockTarget).not.toHaveBeenCalled();
 expect(mockResolve).not.toHaveBeenCalled();
});
