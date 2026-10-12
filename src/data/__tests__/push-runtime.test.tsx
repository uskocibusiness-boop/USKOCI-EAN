import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import type { Notification, NotificationHandler } from 'expo-notifications';
import { execFileSync } from 'node:child_process';
import { pendingRoute } from '../../store/pendingRoute';
import { messagePushIntent } from '../../store/messagePushIntent';
import { PushRuntime } from '../../ui/notifications/PushRuntime';
import { PLANNED_PUBLIC_INBOX_COPIES } from '../../ui/notifications/publicInboxCopy';
const mockPush = jest.fn(), mockCold = jest.fn(), mockClear = jest.fn(), mockSession = jest.fn(), mockRotate = jest.fn(), mockRevoke = jest.fn(), mockNative = jest.fn();
const mockNavigate = jest.fn();
const mockSetHandler = jest.fn();
let mockHandler: NotificationHandler | null = null;
let mockActivity: AppStateStatus | null = 'active';
let mockTap: (value: unknown) => void, mockToken: () => void, mockActive: (value: AppStateStatus) => void;
let mockState: { user: { id: string } | null; accountRevision: number; sessionEpoch: number } = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1, sessionEpoch: 1 };
jest.mock('../../store/sesija', () => ({ useSesija: () => mockState, sesijaSada: () => mockState }));
jest.mock('react-native', () => {
 const native = jest.requireActual('react-native');
 const appState = { get currentState() { return mockActivity; }, addEventListener: jest.fn() };
 return new Proxy(native, { get(target, key) { return key === 'AppState' ? appState : Reflect.get(target, key); } });
});
jest.mock('expo-router', () => ({ router: { push: (path: string) => mockPush(path), navigate: (path: string) => mockNavigate(path) } }));
jest.mock('expo-notifications', () => ({
 setNotificationHandler: (handler: NotificationHandler | null) => { mockHandler = handler; mockSetHandler(handler); },
 addNotificationResponseReceivedListener: (callback: (x: unknown) => void) => { mockTap = callback; return { remove: jest.fn() }; },
 addPushTokenListener: (callback: () => void) => { mockToken = callback; return { remove: jest.fn() }; },
 getLastNotificationResponseAsync: () => mockCold(), clearLastNotificationResponseAsync: () => mockClear(),
}));
jest.mock('../nativePushDevice', () => ({ nativePushDevice: (...args: unknown[]) => mockNative(...args) }));
jest.mock('../pushDeviceClientService', () => ({ pushDeviceClientService: { sessionDevice: (...args: unknown[]) => mockSession(...args), rotate: (...args: unknown[]) => mockRotate(...args) }, revokePushBeforeLogout: (...args: unknown[]) => mockRevoke(...args) }));
const device = { kind: 'DEVICE', id: '22222222-2222-4222-8222-222222222222', revision: 3, token: 'ExpoPushToken[old]', platform: 'ANDROID' };
const response = (identifier = 'one', data: unknown = { kind: 'INBOX' }) => ({ notification: { request: { identifier, content: { data } } } });
let tree: Renderer.ReactTestRenderer;
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function mount(ready = true) { await act(async () => { tree = Renderer.create(<PushRuntime ready={ready} />); await flush(); }); }
beforeEach(() => { jest.useRealTimers(); jest.resetAllMocks(); mockHandler = null; mockActivity = 'active'; jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, callback) => { mockActive = callback; return { remove: jest.fn() }; }); mockState = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1, sessionEpoch: 1 }; mockCold.mockResolvedValue(null); mockClear.mockResolvedValue(undefined); mockSession.mockResolvedValue({ ok: true, podatak: { kind: 'NONE' } }); mockNative.mockResolvedValue({ kind: 'READY', token: 'ExpoPushToken[new]', platform: 'ANDROID' }); mockRotate.mockResolvedValue({ ok: true }); mockRevoke.mockResolvedValue(true); });
afterEach(() => { expect(mockPush).not.toHaveBeenCalled(); act(() => tree?.unmount()); messagePushIntent.clear(); pendingRoute.clear(); jest.useRealTimers(); jest.restoreAllMocks(); });
it('no registered session never acquires a token, requests permission, or auto-registers', async () => { await mount(); expect(mockNative).not.toHaveBeenCalled(); expect(mockRotate).not.toHaveBeenCalled(); });
it('cold response and same live tap navigate once to the fixed owned Inbox', async () => { mockCold.mockResolvedValue(response()); await mount(); act(() => mockTap(response())); expect(mockNavigate.mock.calls).toEqual([['/obavestenja']]); expect(mockClear).toHaveBeenCalledTimes(1); });
it('distinct live Inbox taps reuse its route rather than stacking new Inbox screens', async () => {
 await mount();
 act(() => { mockTap(response('first')); mockTap(response('second')); mockTap(response('second')); });
 expect(mockNavigate.mock.calls).toEqual([['/obavestenja'], ['/obavestenja']]);
 expect(mockPush).not.toHaveBeenCalled();
 expect(mockClear).toHaveBeenCalledTimes(2);
});
it('a cold Inbox tap also reuses navigation while preserving the startup destination', async () => {
 pendingRoute.clear(); mockCold.mockResolvedValue(response()); await mount();
 expect(mockNavigate).toHaveBeenCalledWith('/obavestenja'); expect(mockPush).not.toHaveBeenCalled();
 expect(pendingRoute.take()).toBe('/obavestenja');
});
it('exact message metadata creates an owned memory intent and still navigates only to the fixed Inbox', async () => {
 const eventId = '33333333-3333-4333-8333-333333333333';
 mockCold.mockResolvedValue(response('exact', { kind: 'INBOX', eventType: 'MESSAGE_RECEIVED', eventId })); await mount();
 expect(mockNavigate.mock.calls).toEqual([['/obavestenja']]);
 expect(messagePushIntent.snapshot()).toEqual(expect.objectContaining({ eventId, accountId: mockState.user!.id, accountRevision: 1, sessionEpoch: 1, coldRoute: expect.any(Number) }));
 act(() => mockTap(response('newer-legacy'))); expect(messagePushIntent.snapshot()).toBeNull();
});
it('a newer warm tap consumes the older owned cold return before replacing its intent', async () => {
 const a = '33333333-3333-4333-8333-333333333333', b = '44444444-4444-4444-8444-444444444444';
 mockCold.mockResolvedValue(response('cold-a', { kind: 'INBOX', eventType: 'MESSAGE_RECEIVED', eventId: a })); await mount();
 act(() => mockTap(response('warm-b', { kind: 'INBOX', eventType: 'MESSAGE_RECEIVED', eventId: b })));
 expect(messagePushIntent.snapshot()?.eventId).toBe(b);
 expect(pendingRoute.takeDecision({ accountId: mockState.user!.id, accountRevision: 1, sessionEpoch: 1 })).toEqual({ kind: 'DELIVERED' });
});
it('a delayed last-response read cannot replace a more recent accepted live tap', async () => {
 let resolve!: (value: unknown) => void; mockCold.mockReturnValue(new Promise(done => { resolve = done; })); await mount();
 const data = { kind: 'INBOX', eventType: 'MESSAGE_RECEIVED', eventId: '44444444-4444-4444-8444-444444444444' };
 act(() => mockTap(response('fresh', data)));
 await act(async () => resolve(response('older', { ...data, eventId: '33333333-3333-4333-8333-333333333333' })));
 expect(messagePushIntent.snapshot()?.eventId).toBe(data.eventId); expect(mockNavigate).toHaveBeenCalledTimes(1);
});
it('a cold tap leaves the Inbox where the layout looks for a destination, and a live tap does not', async () => {
  // The root layout resolves a stored return intent on the same cold start and replaces the route
  // when it finishes, which would land on top of the Inbox. Both now mean the same place.
  pendingRoute.clear(); mockCold.mockResolvedValue(response()); await mount();
  expect(pendingRoute.take()).toBe('/obavestenja');
  act(() => mockTap(response()));
  expect(pendingRoute.take()).toBeNull();
});
it.each([{ kind: 'INBOX', url: 'https://evil.test' }, { kind: 'AGREEMENT', id: 'private' }, [], null])('untrusted payload cannot select a route', async data => { await mount(); act(() => mockTap(response('one', data))); expect(mockNavigate).not.toHaveBeenCalled(); });
it('late cold response after account ABA is discarded, without a new-account cold replay', async () => {
 let done!: (value: unknown) => void; mockCold.mockReturnValue(new Promise(r => { done = r; })); await mount();
 mockState = { ...mockState, accountRevision: 3, sessionEpoch: 3 }; act(() => tree.update(<PushRuntime ready />)); await act(flush); done(response()); await act(flush);
 expect(mockNavigate).not.toHaveBeenCalled(); expect(mockCold).toHaveBeenCalledTimes(1);
});
it('retained listener after unmount cannot navigate', async () => { await mount(); const previous = mockTap; act(() => tree.unmount()); act(() => previous(response())); expect(mockNavigate).not.toHaveBeenCalled(); });
it('same explicit bound device rotates once and never enables preferences', async () => {
 mockSession.mockResolvedValue({ ok: true, podatak: device }); await mount();
 expect(mockNative).toHaveBeenCalledWith(false, expect.any(Function)); expect(mockRotate).toHaveBeenCalledWith({ accountId: mockState.user!.id, accountRevision: 1 }, device, 'ExpoPushToken[new]', 'ANDROID');
});
it('ambiguous registrations are never guessed by order', async () => { mockSession.mockResolvedValue({ ok: true, podatak: { kind: 'AMBIGUOUS' } }); await mount(); expect(mockNative).not.toHaveBeenCalled(); expect(mockRotate).not.toHaveBeenCalled(); });
it('OS denial revokes the current session and does not attempt rotation', async () => { mockSession.mockResolvedValue({ ok: true, podatak: device }); mockNative.mockResolvedValue({ kind: 'DENIED' }); await mount(); expect(mockRevoke).toHaveBeenCalledTimes(1); expect(mockRotate).not.toHaveBeenCalled(); });
it('unknown rotation only reads back; repeated activation or token event cannot replay it', async () => {
 mockSession.mockResolvedValue({ ok: true, podatak: device }); mockRotate.mockResolvedValue({ ok: false }); await mount(); expect(mockSession).toHaveBeenCalledTimes(2);
 await act(async () => { mockToken(); await flush(); mockActive('active'); await flush(); }); expect(mockRotate).toHaveBeenCalledTimes(1);
});
it('deferred device read across account/session refresh cannot invoke native token or write', async () => {
 let done!: (value: unknown) => void; mockSession.mockReturnValueOnce(new Promise(r => { done = r; })); await mount();
 mockState = { ...mockState, sessionEpoch: 2 }; act(() => tree.update(<PushRuntime ready />)); await act(flush); done({ ok: true, podatak: device }); await act(flush); expect(mockNative).not.toHaveBeenCalled(); expect(mockRotate).not.toHaveBeenCalled();
});
it('a stuck native read times out and its late result cannot rotate', async () => {
 jest.useFakeTimers(); mockSession.mockResolvedValue({ ok: true, podatak: device }); let done!: (value: unknown) => void; mockNative.mockReturnValue(new Promise(r => { done = r; })); await mount();
 await act(async () => { await jest.advanceTimersByTimeAsync(20000); }); done({ kind: 'READY', token: 'ExpoPushToken[new]', platform: 'ANDROID' }); await act(flush); expect(mockRotate).not.toHaveBeenCalled();
});
it('waits for router/auth readiness, then picks up cold tap once without remount', async () => {
 mockCold.mockResolvedValue(response()); await mount(false); expect(mockCold).not.toHaveBeenCalled(); expect(mockSession).not.toHaveBeenCalled();
 act(() => tree.update(<PushRuntime ready />)); await act(flush); expect(mockNavigate).toHaveBeenCalledTimes(1);
 act(() => tree.update(<PushRuntime ready={false} />)); act(() => tree.update(<PushRuntime ready />)); await act(flush); expect(mockCold).toHaveBeenCalledTimes(1);
});
it('web never invokes unsupported notification listener or native APIs', async () => {
 jest.replaceProperty(Platform, 'OS', 'web'); await mount(); expect(mockCold).not.toHaveBeenCalled(); expect(mockSession).not.toHaveBeenCalled(); expect(mockNative).not.toHaveBeenCalled(); expect(mockSetHandler).not.toHaveBeenCalled();
});

const notification = (content: Record<string, unknown> = {}) => ({ date: 1, request: { identifier: 'foreground', trigger: { type: 'push' },
 content: { title: 'Nova poruka u Dogovoru', subtitle: null, body: 'Imaš novu poruku.', data: { kind: 'INBOX' },
  categoryIdentifier: null, sound: 'default', ...content } } });
const hidden = { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
const visible = { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
const present = (value: unknown = notification()) => mockHandler!.handleNotification(value as Notification);
it('only neutral message copy may present the exact event metadata; extra routing/text remains refused', async () => {
 await mount(); const data = { kind: 'INBOX', eventType: 'MESSAGE_RECEIVED', eventId: '33333333-3333-4333-8333-333333333333' };
 expect(await present(notification({ data }))).toEqual(visible);
 expect(await present(notification({ data: { ...data, body: 'private' } }))).toEqual(hidden);
 expect(await present(notification({ data, title: 'Nova prijava', body: 'Stigla je nova prijava na tvoj zadatak.' }))).toEqual(hidden);
});

// Execute the actual dependency-free Edge formatter through Node's native ESM
// loader: the Expo Jest transform does not include .mjs. This checks its entire
// public contract rather than parsing an obsolete literal in the worker source.
type PublicCopy = { title: string; body: string };
const transportContract = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
 import { PUSH_EVENT_TYPES, notificationPushCopy } from './supabase/functions/_shared/pushNotificationCopy.mjs';
 process.stdout.write(JSON.stringify({
  eventTypes: PUSH_EVENT_TYPES,
  copies: PUSH_EVENT_TYPES.flatMap(eventType => ['NORMAL', 'HITNO'].map(urgency => ({
   eventType, urgency, ...notificationPushCopy(eventType, urgency),
  }))),
  generic: notificationPushCopy('UNKNOWN_EVENT'),
 }));
`], { cwd: process.cwd(), encoding: 'utf8', timeout: 15000 })) as {
 eventTypes: string[];
 copies: (PublicCopy & { eventType: string; urgency: string })[];
 generic: PublicCopy;
};
const legacyCopies: PublicCopy[] = [
 { title: 'USKOČI', body: 'Imate novo obaveštenje. Otvorite aplikaciju.' },
 { title: 'USKOČI', body: 'Imaš novo obaveštenje. Otvori aplikaciju.' },
];
const allPublicCopies = [...transportContract.copies, transportContract.generic, ...legacyCopies];

it('loads all A1 event types and both provider priority variants from the actual formatter', () => {
 expect(transportContract.eventTypes).toHaveLength(24);
 expect(transportContract.copies).toHaveLength(48);
 expect(transportContract.copies.find(copy => copy.eventType === 'OPPORTUNITY_AVAILABLE' && copy.urgency === 'HITNO')?.title).toBe('HITNO — nova prilika');
});
it.each((['android', 'ios'] as const).flatMap(platform => transportContract.copies.map(copy => ({ platform, ...copy }))))(
 'presents actual $eventType/$urgency copy on $platform without relaxing payload privacy', async ({ platform, title, body }) => {
 jest.replaceProperty(Platform, 'OS', platform); await mount();
 mockSession.mockClear();
 expect(await present(notification({ title, body }))).toEqual(visible);
 expect(await present(notification({ title, body, data: { kind: 'INBOX', privateText: 'not allowed' } }))).toEqual(hidden);
 expect(await present(notification({ title, body: body + ' Private detail' }))).toEqual(hidden);
 expect(await present(notification({ title: title + ' Private detail', body }))).toEqual(hidden);
 expect(mockSession).not.toHaveBeenCalled(); expect(mockNative).not.toHaveBeenCalled(); expect(mockRotate).not.toHaveBeenCalled();
 expect(mockRevoke).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled(); expect(mockClear).not.toHaveBeenCalled();
});
it.each(['android', 'ios'] as const)('keeps generic fallback and both queued legacy copies compatible on %s', async platform => {
 jest.replaceProperty(Platform, 'OS', platform); await mount();
 for (const copy of [transportContract.generic, ...legacyCopies]) expect(await present(notification(copy))).toEqual(visible);
});
it.each(['android', 'ios'] as const)('keeps the two legacy internal-role copies suppressed on %s', async platform => {
 jest.replaceProperty(Platform, 'OS', platform); await mount();
 for (const copy of [
  { title: 'Prijava je pregledana', body: 'Naručilac je pregledao tvoju prijavu.' },
  { title: 'Prijava je završena', body: 'Za ovaj zadatak je izabran drugi uskočer.' },
 ]) expect(await present(notification(copy))).toEqual(hidden);
});
it.each(['android', 'ios'] as const)('requires an exact public title/body tuple on %s', async platform => {
 jest.replaceProperty(Platform, 'OS', platform); await mount();
 const titles = [...new Set(allPublicCopies.map(copy => copy.title))], bodies = [...new Set(allPublicCopies.map(copy => copy.body))];
 for (const title of titles) for (const body of bodies) {
  const approved = allPublicCopies.some(copy => copy.title === title && copy.body === body);
  expect(await present(notification({ title, body }))).toEqual(approved ? visible : hidden);
 }
});

// Copy-v2: current Edge source uses these three replacements; already queued older copy remains accepted.
// The fourth planned opportunity body is separate and is not part of this source package.
const LEGACY_EDGE_COPIES = [
 { title: 'Izabran si', body: 'Tvoja prijava je prihvaćena. Otvori Dogovor.' },
 { title: 'Potvrdi završetak', body: 'Druga strana je označila posao kao završen.' },
 { title: 'Oporavak naloga', body: 'Otvoren je postupak oporavka naloga.' },
];
it('the active Edge source uses the three neutral pairs already accepted by the client', () => {
 const changed = ['RESPONSE_SELECTED', 'COMPLETION_REQUIRED', 'RECOVERY_OPENED'];
 for (const [index, eventType] of changed.entries()) {
  const copies = transportContract.copies.filter(copy => copy.eventType === eventType);
  expect(copies).toHaveLength(2);
  for (const copy of copies) {
   expect({ title: copy.title, body: copy.body }).toEqual(PLANNED_PUBLIC_INBOX_COPIES[index]);
   expect(LEGACY_EDGE_COPIES).not.toContainEqual({ title: copy.title, body: copy.body });
  }
 }
 expect(PLANNED_PUBLIC_INBOX_COPIES).toHaveLength(4);
 for (const copy of PLANNED_PUBLIC_INBOX_COPIES) {
  expect(`${copy.title} ${copy.body}`).not.toMatch(/posa[ol]|poslov|Izabran si|označila|Oporavak naloga|Naručilac|Uskočer|prilik/i);
  expect(`${copy.title} ${copy.body}`).not.toMatch(/[{}$]/);
 }
 expect(PLANNED_PUBLIC_INBOX_COPIES[3]).toEqual({ title: 'Novi zadatak za tebe', body: 'Pojavio se novi zadatak koji može da ti odgovara.' });
 expect(transportContract.copies.some(copy => copy.title === 'Novi zadatak za tebe' && copy.body.includes('prilika'))).toBe(true);
});
it.each(['android', 'ios'] as const)('shows the planned copy while the app is open on %s, exactly as a pair and nothing around it', async platform => {
 jest.replaceProperty(Platform, 'OS', platform); await mount();
 for (const copy of PLANNED_PUBLIC_INBOX_COPIES) {
  expect(await present(notification({ title: copy.title, body: copy.body }))).toEqual(visible);
  expect(await present(notification({ title: copy.title, body: copy.body + ' Private detail' }))).toEqual(hidden);
  expect(await present(notification({ title: copy.title + ' Private detail', body: copy.body }))).toEqual(hidden);
  expect(await present(notification({ title: copy.title, body: copy.body, data: { kind: 'INBOX', privateText: 'not allowed' } }))).toEqual(hidden);
 }
 // A planned title with a body of another pair is not a pair.
 expect(await present(notification({ title: 'Tvoja prijava je izabrana', body: 'Zadatak je označen kao gotov.' }))).toEqual(hidden);
 // Both current source and historical queued Edge pairs remain visible in either rollout order.
 for (const copy of [...transportContract.copies, ...LEGACY_EDGE_COPIES]) {
  expect(await present(notification({ title: copy.title, body: copy.body }))).toEqual(visible);
  expect(await present(notification({ title: copy.title, body: copy.body + ' Private detail' }))).toEqual(hidden);
 }
});
it.each(['android', 'ios'] as const)('foreground public copy is immediate local presentation only on %s; a later tap still opens Inbox once', async platform => {
 jest.replaceProperty(Platform, 'OS', platform); await mount();
 mockSession.mockClear(); mockCold.mockClear();
 expect(await present(platform === 'ios' ? notification({ attachments: [], launchImageName: '', threadIdentifier: '', summaryArgument: '', badge: null, interruptionLevel: 'active' }) : notification())).toEqual(visible);
 expect(mockSession).not.toHaveBeenCalled(); expect(mockNative).not.toHaveBeenCalled(); expect(mockRotate).not.toHaveBeenCalled(); expect(mockRevoke).not.toHaveBeenCalled();
 expect(mockCold).not.toHaveBeenCalled(); expect(mockClear).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled();
 act(() => { mockTap({ notification: notification() }); mockTap({ notification: notification() }); });
 expect(mockNavigate.mock.calls).toEqual([['/obavestenja']]); expect(mockClear).toHaveBeenCalledTimes(1);
});
it.each([
 { title: 'Private person' }, { body: 'Private address' }, { title: null }, { body: null }, { title: ['Nova poruka u Dogovoru'] },
 { body: { text: 'Imaš novu poruku.' } }, { subtitle: 'Private summary' },
 { data: { kind: 'INBOX', url: '/private' } }, { data: { kind: 'AGREEMENT' } }, { data: [] }, { data: null },
 { attachments: [{ url: 'https://private.example/image' }] }, { attachments: {} }, { summaryArgument: 'Private person' },
 { categoryIdentifier: 'ACCEPT' }, { launchImageName: 'private' }, { targetContentIdentifier: 'private' }, { threadIdentifier: 'private' },
 { sound: 'defaultCritical' }, { interruptionLevel: 'critical' },
])('foreground rejects noncanonical visible content or payload: %j', async content => {
 await mount(); expect(await present(notification(content))).toEqual(hidden); expect(mockNavigate).not.toHaveBeenCalled(); expect(mockClear).not.toHaveBeenCalled();
});
it.each([null, {}, { request: null }, { request: { identifier: '', content: notification().request.content, trigger: { type: 'push' } } },
 { request: { ...notification().request, trigger: { type: 'timeInterval' } } },
 { request: { ...notification().request, trigger: { type: 'push', remoteMessage: { notification: { imageUrl: 'https://private.example/image' } } } } },
])('foreground malformed/local/image notifications fail closed: %j', async value => {
 await mount(); expect(await present(value)).toEqual(hidden);
});
it('foreground does not wait for a hanging device RPC or acquire a token', async () => {
 mockSession.mockReturnValue(new Promise(() => undefined)); await mount();
 expect(await present()).toEqual(visible); expect(mockNative).not.toHaveBeenCalled(); expect(mockSession).toHaveBeenCalledTimes(1);
});
it.each(['background', 'inactive'] as AppStateStatus[])('foreground presentation closes in %s and resumes only on active', async state => {
 await mount(); act(() => mockActive(state)); expect(await present()).toEqual(hidden);
 act(() => mockActive('active')); expect(await present()).toEqual(visible);
});
it('unknown initial native activity state cannot display a notification', async () => {
 mockActivity = null; await mount(); expect(await present()).toEqual(hidden);
});
it.each(['different-account', 'account-ABA', 'session-refresh', 'logout'])('retained foreground callback rejects %s before React cleanup', async change => {
 await mount();
 mockState = { ...mockState, ...(change === 'different-account' ? { user: { id: 'other-account' }, accountRevision: 2 }
  : change === 'account-ABA' ? { accountRevision: 3 } : change === 'session-refresh' ? { sessionEpoch: 2 } : { user: null, accountRevision: 2 }) };
 expect(await present()).toEqual(hidden); expect(mockNavigate).not.toHaveBeenCalled();
});
it('Auth/recovery readiness removes the handler and a retained callback remains closed after a new owner resumes', async () => {
 await mount(); const previous = mockHandler!;
 act(() => tree.update(<PushRuntime ready={false} />)); expect(mockHandler).toBeNull(); expect(await previous.handleNotification(notification() as Notification)).toEqual(hidden);
 act(() => tree.update(<PushRuntime ready />)); await act(flush);
 expect(await present()).toEqual(visible); expect(await previous.handleNotification(notification() as Notification)).toEqual(hidden);
});
it('unmounted foreground callback cannot show or acknowledge anything', async () => {
 await mount(); const previous = mockHandler!; act(() => tree.unmount());
 expect(mockSetHandler).toHaveBeenLastCalledWith(null); expect(await previous.handleNotification(notification() as Notification)).toEqual(hidden);
 expect(mockNavigate).not.toHaveBeenCalled(); expect(mockClear).not.toHaveBeenCalled();
});
it('signed-out runtime never installs a foreground handler', async () => {
 mockState = { ...mockState, user: null }; await mount(); expect(mockSetHandler).not.toHaveBeenCalled();
});

it('an opportunity hint remains only an owned event until the visible Inbox resolves it', async () => {
 const eventId='33333333-3333-4333-8333-333333333333';
 mockCold.mockResolvedValue(response('opportunity',{kind:'INBOX',eventType:'OPPORTUNITY_AVAILABLE',eventId})); await mount();
 expect(messagePushIntent.snapshot()).toEqual(expect.objectContaining({eventId,eventType:'OPPORTUNITY_AVAILABLE',accountId:mockState.user!.id,coldRoute:expect.any(Number)}));
 expect(mockNavigate.mock.calls).toEqual([['/obavestenja']]);
 expect(mockPush).not.toHaveBeenCalled();
});
it('opportunity metadata presents only with public opportunity text', async () => {
 await mount(); const data={kind:'INBOX',eventType:'OPPORTUNITY_AVAILABLE',eventId:'33333333-3333-4333-8333-333333333333'};
 expect(await present(notification({data,title:'Novi zadatak za tebe',body:'Pojavila se nova prilika koja može da ti odgovara.'}))).toEqual(visible);
 expect(await present(notification({data,title:'Nova poruka u Dogovoru',body:'Imaš novu poruku.'}))).toEqual(hidden);
 expect(await present(notification({data:{...data,needId:'private'},title:'Novi zadatak za tebe',body:'Pojavila se nova prilika koja može da ti odgovara.'}))).toEqual(hidden);
});
