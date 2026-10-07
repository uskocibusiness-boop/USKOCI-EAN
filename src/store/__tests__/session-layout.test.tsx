import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { Session } from '@supabase/supabase-js';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockClosingRead = jest.fn();
const mockJournalLoad = jest.fn();
const mockSignOut = jest.fn();
let mockPath = '/';
const mockSegments = ['(app)'];
const mockConsume = jest.fn();
const mockRole = jest.fn();
const mockPushListener = jest.fn((..._args: unknown[]) => ({ remove: jest.fn() }));
const mockNotificationHandler = jest.fn();
const mockSession = { user: { id: 'account-a' } } as Session;
let mockStackMounts = 0;
let mockRendered: { isLoaded: boolean; session: Session | null; user: Session['user'] | null; sessionEpoch: number; accountRevision: number; returnTargetRevision: number } =
  { isLoaded: true, session: mockSession, user: mockSession.user, sessionEpoch: 1, accountRevision: 1, returnTargetRevision: 0 };
let mockCurrent = mockRendered;
let mockMotionPreference: ((value: boolean) => void) | undefined;

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AccessibilityInfo') return {
      isReduceMotionEnabled: () => new Promise<boolean>(() => {}),
      addEventListener: (_name: string, callback: (value: boolean) => void) => {
        mockMotionPreference = callback;
        return { remove: () => { if (mockMotionPreference === callback) mockMotionPreference = undefined; } };
      },
    };
    return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => {
  const React = require('react');
  const { Screen } = require('expo-router/build/views/Screen');
  const { Protected } = require('expo-router/build/views/Protected');
  const { useFilterScreenChildren } = require('expo-router/build/layouts/withLayoutContext');
  const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');
  const Stack = ({ children, initialRouteName, screenOptions }: {
    children?: React.ReactNode; initialRouteName?: string; screenOptions?: { animation?: string };
  }) => {
    const filtered = useFilterScreenChildren(children);
    const [instance] = React.useState(() => ++mockStackMounts);
    const screens = filtered.screens.map((screen: { name: string }) => screen.name);
    const config = { routeNames: screens, routeParamList: {}, routeGetIdList: {} };
    const router = StackRouter({ initialRouteName });
    const cold = router.getInitialState(config);
    const linked = router.getRehydratedState({ stale: true, index: 0, routes: [{ name: mockSegments[0] }] }, config);
    return React.createElement('Stack', {
      instance,
      screens,
      screenOptions,
      screenOptionsByName: Object.fromEntries(filtered.screens.map((screen: { name: string; options?: unknown }) => [screen.name, screen.options])),
      coldRoute: cold.routes[cold.index].name,
      linkedRoute: linked.routes[linked.index].name,
      protectedScreens: Array.from(filtered.protectedScreens),
    });
  };
  Stack.Screen = Screen;
  Stack.Protected = Protected;
  return { Stack, useRouter: () => mockRouter, useSegments: () => mockSegments, usePathname: () => mockPath };
});
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
// Keep the actual PushRuntime in the root render. Only native transports and
// the separately tested device RPC are isolated from this navigation test.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: (...args: unknown[]) => mockNotificationHandler(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) => mockPushListener(...args),
  addPushTokenListener: () => ({ remove: jest.fn() }),
  getLastNotificationResponseAsync: async () => null,
  clearLastNotificationResponseAsync: async () => undefined,
}));
jest.mock('../../data/pushDeviceClientService', () => ({
  pushDeviceClientService: { sessionDevice: async () => ({ ok: true, podatak: { kind: 'NONE' } }) },
  revokePushBeforeLogout: jest.fn(),
}));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'GestureHandlerRootView' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: 'SafeAreaProvider',
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
// The closing check is required lazily by the root; these stand in for its data modules (tested on their own).
jest.mock('../../data/accountClosingStanding', () => ({ readAccountClosingStanding: (...args: unknown[]) => mockClosingRead(...args) }));
jest.mock('../../ui/closure/closureIntent', () => ({ closureIntentJournal: { load: (...args: unknown[]) => mockJournalLoad(...args) } }));
jest.mock('../../data/authClientService', () => ({ authClientService: { signOutLocal: (...args: unknown[]) => mockSignOut(...args) } }));
jest.mock('../sesija', () => ({ useSesija: () => mockRendered, sesijaSada: () => mockCurrent }));
jest.mock('../povratniCilj', () => ({ povratniCilj: { consumeCompleted: (...args: unknown[]) => mockConsume(...args) } }));
// Owner decision 1 (2026-09-19): the app has no global mode. The spy stays so that a root layout which
// started setting one again would be caught here: a completed choice is a destination and nothing else.
jest.mock('../uloga', () => ({ postaviUlogu: (role: string) => mockRole(role) }));

import RootLayout from '../../app/_layout';
import { pendingRoute } from '../pendingRoute';

let tree: ReactTestRenderer;
beforeEach(() => {
  // A bounce remembers where the person was going; each test starts with nobody going anywhere.
  pendingRoute.clear();
  jest.clearAllMocks(); mockPath = '/';
  mockSegments.splice(0, mockSegments.length, '(app)');
  mockStackMounts = 0;
  mockRendered = { isLoaded: true, session: mockSession, user: mockSession.user, sessionEpoch: 1, accountRevision: 1, returnTargetRevision: 0 };
  mockCurrent = mockRendered;
  mockConsume.mockResolvedValue(null);
  mockClosingRead.mockResolvedValue({ ok: true, podatak: { closing: false } }); mockJournalLoad.mockResolvedValue(null);
  mockSignOut.mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => { tree?.unmount(); }); });
async function render() { await act(async () => { tree = create(<RootLayout />); }); }

it.each(['before-consumer', 'during-consumer'])('an owned cold Inbox delivery cannot be replaced by an older fallback: %s', async timing => {
  const old = { intent: { intent: 'WORKER', returnTarget: { kind: 'NONE' } } };
  let resolve!: (value: unknown) => void;
  if (timing === 'before-consumer') {
    pendingRoute.delivered(pendingRoute.remember('/obavestenja'), { accountId: 'account-a', accountRevision: 1, sessionEpoch: 1 });
    mockConsume.mockResolvedValueOnce(old); await render();
  } else {
    mockConsume.mockReturnValueOnce(new Promise(done => { resolve = done; })); await render();
    pendingRoute.delivered(pendingRoute.remember('/obavestenja'), { accountId: 'account-a', accountRevision: 1, sessionEpoch: 1 });
    await act(async () => resolve(old));
  }
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it.each([false, true])('root pushes follow live reduced motion without replacing the navigator: signedIn=%s', async signedIn => {
  if (!signedIn) mockRendered = { ...mockRendered, session: null, user: null };
  mockCurrent = mockRendered;
  await render();
  const stack = () => tree.root.findByType('Stack' as React.ElementType).props;
  const instance = stack().instance;
  expect(stack().screenOptions.animation).toBe('slide_from_right');
  await act(async () => { mockMotionPreference!(true); });
  expect(stack().screenOptions.animation).toBe('none');
  expect(stack().instance).toBe(instance);
  expect(stack().screenOptionsByName.oporavak.animation).toBe('none');
  if (!signedIn) expect(stack().screenOptionsByName.auth.animation).toBe('none');
  await act(async () => { mockMotionPreference!(false); });
  expect(stack().screenOptions.animation).toBe('slide_from_right');
  expect(stack().instance).toBe(instance);
});

it('keeps the current motion preference when session restoration finishes', async () => {
  mockRendered = { ...mockRendered, isLoaded: false }; mockCurrent = mockRendered;
  await render();
  expect(tree.root.findAllByType('Stack' as React.ElementType)).toHaveLength(0);
  await act(async () => { mockMotionPreference!(true); });
  mockRendered = { ...mockRendered, isLoaded: true }; mockCurrent = mockRendered;
  await act(async () => { tree.update(<RootLayout />); });
  expect(tree.root.findByType('Stack' as React.ElementType).props.screenOptions.animation).toBe('none');
});

describe('session-owned root return navigation', () => {
  it.each([false, true])('cold launch selects the admitted entry route instead of recovery: signedIn=%s', async signedIn => {
    mockSegments.splice(0, mockSegments.length);
    if (!signedIn) mockRendered = { ...mockRendered, session: null, user: null };
    mockCurrent = mockRendered; await render();
    const stack = tree.root.findByType('Stack' as React.ElementType);
    expect(stack.props.coldRoute).toBe(signedIn ? '(app)' : 'auth');
    expect(stack.props.coldRoute).not.toBe('oporavak');
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
  it('replaces private navigation state after batched A→B→A even when the rendered account id matches', async () => {
    await render();
    const before = tree.root.findByType('Stack' as React.ElementType).props.instance;
    mockCurrent = { ...mockRendered, user: { ...mockSession.user, id: 'account-b' }, accountRevision: 2, sessionEpoch: 2 };
    mockCurrent = { ...mockRendered, accountRevision: 3, sessionEpoch: 3 };
    mockRendered = mockCurrent;
    await act(async () => tree.update(<RootLayout />));
    expect(tree.root.findByType('Stack' as React.ElementType).props.instance).not.toBe(before);
  });

  it('retains private navigation state across a same-account token refresh', async () => {
    await render();
    const before = tree.root.findByType('Stack' as React.ElementType).props.instance;
    mockRendered = { ...mockRendered, sessionEpoch: 2, session: { ...mockSession, access_token: 'refreshed' } };
    mockCurrent = mockRendered;
    await act(async () => tree.update(<RootLayout />));
    expect(tree.root.findByType('Stack' as React.ElementType).props.instance).toBe(before);
  });

  it('exposes only Auth at cold signed-out startup and excludes every private root route', async () => {
    mockRendered = { ...mockRendered, session: null, user: null };
    mockCurrent = mockRendered;
    await render();
    const stack = tree.root.findByType('Stack' as React.ElementType);
    expect(stack.props.screens.sort()).toEqual(['auth', 'oporavak']);
    expect(stack.props.protectedScreens.sort()).toEqual(['(app)', 'dogovor/[id]', 'obavestenja', 'prijave']);
  });

  it('exposes the four private root routes only after authentication and excludes Auth', async () => {
    await render();
    const stack = tree.root.findByType('Stack' as React.ElementType);
    expect(stack.props.screens.sort()).toEqual(['(app)', 'dogovor/[id]', 'obavestenja', 'oporavak', 'prijave']);
    expect(stack.props.protectedScreens).toEqual(['auth']);
  });

  it.each([
    [{ kind: 'REQUESTER_DRAFT', draftKey: 'draft-1' }, { pathname: '/nova', params: { conversationId: 'draft-1' } }],
    [{ kind: 'NEED', needId: 'need-1' }, { pathname: '/potrebe/[id]/pregled', params: { id: 'need-1' } }],
    [{ kind: 'DOGOVOR', agreementId: 'agreement-1' }, { pathname: '/dogovor/[id]', params: { id: 'agreement-1' } }],
  ])('rechecks a newly completed intent and opens its typed destination without setting any mode first', async (returnTarget, destination) => {
    mockConsume.mockResolvedValueOnce(null).mockResolvedValue({
      completedByUserId: 'account-a', intent: { intent: 'WORKER', returnTarget },
    });
    await render();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    mockRendered = { ...mockRendered, returnTargetRevision: 1 };
    mockCurrent = mockRendered;
    await act(async () => tree.update(<RootLayout />));
    expect(mockConsume).toHaveBeenCalledTimes(2);
    expect(mockRole).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith(destination);
  });

  it.each(['account-b', 'account-a'])('rejects stale A completion before React cleanup when current account is %s in a newer epoch', async accountId => {
    let resolve!: (record: unknown) => void;
    mockConsume.mockImplementation(() => new Promise(done => { resolve = done; }));
    await render();
    mockCurrent = { ...mockRendered, user: { ...mockSession.user, id: accountId }, sessionEpoch: 2 };
    expect(mockConsume.mock.calls[0][1]()).toBe(false);
    await act(async () => resolve({ intent: { intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'old-private-need' } } }));
    expect(mockRole).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('handles failed local consumption without a navigation or unhandled rejection', async () => {
    mockConsume.mockRejectedValueOnce(new Error('storage unavailable'));
    await render();
    expect(mockRole).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('does not leave Auth from a stale signed-in render after logout', async () => {
    mockSegments.splice(0, mockSegments.length, 'auth');
    mockCurrent = { ...mockRendered, session: null, user: null, sessionEpoch: 2 };
    await render();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('does not open Auth from a stale signed-out render after a new sign-in', async () => {
    mockRendered = { ...mockRendered, session: null, user: null };
    mockCurrent = { ...mockRendered, session: mockSession, user: mockSession.user, sessionEpoch: 2 };
    await render();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

it('bypasses the decorative intro for an unauthenticated deep route', async () => {
  mockPath = '/dogovor/example';
  mockRendered = { ...mockRendered, session: null, user: null }; mockCurrent = mockRendered;
  await render();
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/auth', params: { form: 'login' } });
});
// "Uskoči i zaradi" leads to Zadaci and "Objavi zadatak" to the conversation: two destinations in the one
// shell, not two modes of it.
it.each([['WORKER', '/zadaci'], ['REQUESTER', '/nova']])('continues the completed %s entry shortcut once, as a destination in the one shell', async (intent, destination) => {
  mockConsume.mockResolvedValueOnce({ intent: { intent, returnTarget: { kind: 'NONE' } } });
  await render();
  expect(mockRouter.replace).toHaveBeenCalledWith(destination);
  expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  expect(mockRole).not.toHaveBeenCalled();
});


it.each([true, false])('keeps the recovery route public without consuming a saved intention: signedIn=%s', async signedIn => {
  mockSegments.splice(0, mockSegments.length, 'oporavak'); mockPath = '/oporavak';
  if (!signedIn) mockRendered = { ...mockRendered, session: null, user: null };
  mockCurrent = mockRendered;
  await render();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(mockConsume).not.toHaveBeenCalled();
  const stack = tree.root.findByType('Stack' as React.ElementType);
  expect(stack.props.linkedRoute).toBe('oporavak');
  expect(stack.props.screens).toContain('oporavak');
  if (!signedIn) expect(stack.props.screens).not.toContain('(app)');
});

it.each(['auth', 'oporavak'])('does not overwrite an unresolved cold native %s link while Auth restores', async destination => {
  mockSegments.splice(0, mockSegments.length);
  mockRendered = { ...mockRendered, session: null, user: null };
  mockCurrent = mockRendered;
  await render();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(mockConsume).not.toHaveBeenCalled();
  mockSegments.push(destination); mockPath = '/' + destination;
  await act(async () => tree.update(<RootLayout />));
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('does not consume a saved user action before the native destination is resolved', async () => {
  mockSegments.splice(0, mockSegments.length);
  await render();
  expect(mockConsume).not.toHaveBeenCalled();
  mockSegments.push('oporavak'); mockPath = '/oporavak';
  await act(async () => tree.update(<RootLayout />));
  expect(mockConsume).not.toHaveBeenCalled();
});


it('resumes unauthenticated access protection once a private native destination resolves', async () => {
  mockSegments.splice(0, mockSegments.length);
  mockRendered = { ...mockRendered, session: null, user: null }; mockCurrent = mockRendered;
  await render();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(tree.root.findByType('Stack' as React.ElementType).props.screens.sort()).toEqual(['auth', 'oporavak']);
  mockSegments.push('dogovor'); mockPath = '/dogovor/private-id';
  await act(async () => tree.update(<RootLayout />));
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/auth', params: { form: 'login' } });
  expect(mockConsume).not.toHaveBeenCalled();
});

it.each(['auth', 'oporavak', 'unresolved'])('starts push listeners only after %s has left the protected routing boundary', async destination => {
  mockSegments.splice(0, mockSegments.length, ...(destination === 'unresolved' ? [] : [destination]));
  mockPath = destination === 'unresolved' ? '/' : '/' + destination;
  await render();
  expect(mockPushListener).not.toHaveBeenCalled();
  expect(mockNotificationHandler).not.toHaveBeenCalled();
  mockSegments.splice(0, mockSegments.length, '(app)'); mockPath = '/potrebe';
  await act(async () => tree.update(<RootLayout />));
  expect(mockPushListener).toHaveBeenCalledTimes(1);
  expect(mockNotificationHandler).toHaveBeenLastCalledWith(expect.objectContaining({ handleNotification: expect.any(Function) }));
  mockSegments.splice(0, mockSegments.length, 'oporavak'); mockPath = '/oporavak';
  await act(async () => tree.update(<RootLayout />));
  expect(mockNotificationHandler).toHaveBeenLastCalledWith(null);
});

it('consumes the completed intention after a signed-in native app destination resolves', async () => {
  mockSegments.splice(0, mockSegments.length);
  mockConsume.mockResolvedValueOnce({ intent: { intent: 'WORKER', returnTarget: { kind: 'NONE' } } });
  await render();
  expect(mockConsume).not.toHaveBeenCalled();
  mockSegments.push('(app)');
  await act(async () => tree.update(<RootLayout />));
  expect(mockConsume).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).toHaveBeenCalledWith('/zadaci');
  expect(mockRole).not.toHaveBeenCalled();
});

// Audit 2026-10-07: an account in its closing stage signed in to a Početna whose every read the guard refuses, and saw only
// "Pregled trenutno nije učitan.". The root now asks once per account incarnation and, only on a confirmed answer, shows
// "Nalog se zatvara" over the still-mounted navigator.
describe('an account in its closing stage', () => {
  const closingScreen = () => tree.root.findAll(node => node.props.testID === 'account-closing-screen' && typeof node.type === 'string');
  const textOf = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : textOf(child)).join(' ');
  const text = () => textOf(tree.root);
  const button = (label: string) => tree.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label
    && typeof node.props.onPress === 'function')[0];
  // The host View the root wraps the navigator in; only its two accessibility props are compared, never its children.
  const stackCover = () => tree.root.findAll(node => node.type === ('View' as unknown) && node.props.importantForAccessibility !== undefined
    && node.findAll(inner => inner.type === ('Stack' as unknown)).length > 0)[0];
  const executing = { accountId: 'account-a', requestId: 'r', generation: 'g', state: 'EXECUTING', policySha256: 'a'.repeat(64),
    completedSteps: 3, totalSteps: 8, authoritative: true };
  const closing = (execution: unknown = null) => ({ ok: true, podatak: { closing: true, execution } });

  it('an open account shows nothing, is asked once per incarnation, and not again on a token refresh', async () => {
    await render();
    expect(mockClosingRead.mock.calls.map(call => call[0])).toEqual([{ accountId: 'account-a', accountRevision: 1 }]);
    expect(closingScreen()).toHaveLength(0);
    expect(stackCover().props.importantForAccessibility).toBe('auto');
    mockRendered = { ...mockRendered, sessionEpoch: 2, session: { ...mockSession, access_token: 'refreshed' } }; mockCurrent = mockRendered;
    await act(async () => tree.update(<RootLayout />));
    expect(mockClosingRead).toHaveBeenCalledTimes(1);
  });

  it.each([['signed out', { session: null, user: null }], ['on the public recovery link', {}]])('is not asked %s', async (label, patch) => {
    if (label !== 'signed out') { mockSegments.splice(0, mockSegments.length, 'oporavak'); mockPath = '/oporavak'; }
    mockRendered = { ...mockRendered, ...patch }; mockCurrent = mockRendered;
    await render();
    expect(mockClosingRead).not.toHaveBeenCalled();
  });

  it('a failed or unclear read shows nothing and blocks nothing', async () => {
    mockClosingRead.mockResolvedValueOnce({ ok: false, kod: 'CLOSURE_READ_UNAVAILABLE', poruka: 'x' });
    await render();
    expect(closingScreen()).toHaveLength(0);
    expect(tree.root.findByType('Stack' as React.ElementType)).toBeDefined();
  });

  it('a confirmed closing stage covers the navigator, hides it from screen readers, and holds push back', async () => {
    mockClosingRead.mockResolvedValueOnce(closing());
    await render();
    expect(closingScreen()).toHaveLength(1);
    expect(text()).toContain('Nalog se zatvara.');
    expect(text()).toContain('Zatvaranje ovog naloga je pokrenuto. Pristup je ograničen dok se zatvaranje proverava i završava.');
    expect(text()).toContain('Zadaci, Prijave i Dogovori nisu dostupni dok traje zatvaranje.');
    expect(text()).not.toContain('Provereni koraci');
    expect(text()).not.toMatch(/server|Pregled trenutno nije učitan/i);
    expect([stackCover().props.importantForAccessibility, stackCover().props.accessibilityElementsHidden]).toEqual(['no-hide-descendants', true]);
    // The navigator stays mounted underneath: leaving the closing state keeps the stack.
    expect(tree.root.findAllByType('Stack' as React.ElementType)).toHaveLength(1);
    expect(mockNotificationHandler).toHaveBeenLastCalledWith(null);
  });

  it('shows the progress this device can read, and a closed account as closed', async () => {
    mockClosingRead.mockResolvedValueOnce(closing(executing));
    await render();
    expect(text()).toContain('Provereni koraci: 3 od 8.');
    await act(async () => tree.unmount());
    mockClosingRead.mockResolvedValueOnce(closing({ ...executing, state: 'CLOSED', closedAt: '2026-10-07T09:30:00Z' }));
    await render();
    expect(text()).toContain('Nalog je zatvoren.');
    expect(text()).toContain('Pristup nalogu je ugašen. Podaci za prijavu su uklonjeni i sesije su završene.');
    expect(text()).toMatch(/Završeno: 7\. okt/);
    expect(text()).not.toContain('Zadaci, Prijave i Dogovori nisu dostupni');
    expect(button('Proveri stanje')).toBeUndefined();
    expect(button('Otvori privatnu podršku')).toBeUndefined();
    expect(button('Odjavi se sa ovog uređaja')).toBeDefined();
  });

  it('"Proveri stanje" asks again: a failure says so, an open answer lifts the state', async () => {
    mockClosingRead.mockResolvedValueOnce(closing());
    await render();
    mockClosingRead.mockResolvedValueOnce({ ok: false, kod: 'CLOSURE_READ_UNAVAILABLE', poruka: 'x' });
    await act(async () => button('Proveri stanje').props.onPress());
    expect(mockClosingRead).toHaveBeenCalledTimes(2);
    expect(closingScreen()).toHaveLength(1);
    expect(text()).toContain('Stanje trenutno nije provereno. Pokušaj ponovo.');
    mockClosingRead.mockResolvedValueOnce({ ok: true, podatak: { closing: false } });
    await act(async () => button('Proveri stanje').props.onPress());
    expect(closingScreen()).toHaveLength(0);
  });

  it('private support, which the guard still admits, opens with the closing state out of its way', async () => {
    mockClosingRead.mockResolvedValueOnce(closing());
    await render();
    await act(async () => button('Otvori privatnu podršku').props.onPress());
    expect(mockRouter.push).toHaveBeenCalledWith('/podrska');
    mockPath = '/podrska/novi';
    await act(async () => tree.update(<RootLayout />));
    expect(closingScreen()).toHaveLength(0);
    mockPath = '/';
    await act(async () => tree.update(<RootLayout />));
    expect(closingScreen()).toHaveLength(1);
    expect(mockClosingRead).toHaveBeenCalledTimes(1);
  });

  it('signs this device out of the same account incarnation, and says so when it could not', async () => {
    mockClosingRead.mockResolvedValueOnce(closing());
    await render();
    mockSignOut.mockRejectedValueOnce(new Error('AUTH_ACCOUNT_CHANGED'));
    await act(async () => button('Odjavi se sa ovog uređaja').props.onPress());
    expect(mockSignOut).toHaveBeenCalledWith({ accountId: 'account-a', accountRevision: 1 });
    expect(text()).toContain('Odjava trenutno nije uspela. Pokušaj ponovo.');
    await act(async () => button('Odjavi se sa ovog uređaja').props.onPress());
    expect(mockSignOut).toHaveBeenCalledTimes(2);
  });

  it('reads this device\'s saved closure start, and only a START', async () => {
    mockClosingRead.mockResolvedValueOnce(closing());
    await render();
    const savedStart = mockClosingRead.mock.calls[0][1] as () => Promise<string | null>;
    mockJournalLoad.mockResolvedValueOnce({ kind: 'START', accountId: 'account-a', clientRequestId: 'k', requestId: 'r', expectedRevision: 1, policySha256: 'a' });
    expect(await savedStart()).toBe('k');
    mockJournalLoad.mockResolvedValueOnce({ kind: 'PREPARE', accountId: 'account-a', clientRequestId: 'p', expectedRevision: 0 });
    expect(await savedStart()).toBeNull();
    expect(mockJournalLoad).toHaveBeenCalledWith('account-a');
  });
});
