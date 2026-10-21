import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockSession = { user: { id: 'account-a', email: 'ana@example.rs' }, accountRevision: 1 };
let mockFocused = true;
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockSignOut = jest.fn();
jest.mock('expo-router', () => ({
  get router() { return mockRouter; },
  useFocusEffect: (effect: () => void) => require('react').useEffect(
    () => mockFocused ? effect() : undefined, [effect, mockFocused]),
}));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../authClientService', () => ({ authClientService: { signOutLocal: (...args: unknown[]) => mockSignOut(...args) } }));
jest.mock('../buildIdentity', () => ({ readBuildIdentity: () => ({ version: '1.0.0' }) }));
jest.mock('../../ui/profile/useHubStates', () => ({ useHubStates: () => ({}) }));
jest.mock('../../ui/settings/AccountSettingsPresentation', () => ({ AccountSettings: 'AccountSettings' }));
import Settings from '../../app/(app)/profil/podesavanja';

let tree: ReactTestRenderer;
const props = () => tree.root.findByType('AccountSettings' as React.ElementType).props;
const render = async () => { await act(async () => { tree = create(<Settings />); }); };
const update = async () => { await act(async () => tree.update(<Settings />)); };
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  jest.clearAllMocks(); mockSignOut.mockReset(); mockSignOut.mockResolvedValue(undefined);
  mockSession = { user: { id: 'account-a', email: 'ana@example.rs' }, accountRevision: 1 };
  mockFocused = true; mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(async () => { await act(async () => tree?.unmount()); });

test('navigation is single-flight, then becomes available on the next visit', async () => {
  await render(); const old = props();
  await act(async () => { old.open('/profil/privatnost'); old.open('/profil/podaci'); old.onLogout(); });
  expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
  expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/privatnost');
  expect(mockSignOut).not.toHaveBeenCalled();
  mockFocused = false; await update(); mockFocused = true; await update();
  await act(async () => old.open('/profil/podaci'));
  expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
  await act(async () => props().open('/profil/obavestenja'));
  expect(mockRouter.navigate).toHaveBeenLastCalledWith('/profil/obavestenja');
});

test.each([true, false])('Back uses the previous context or profile when canGoBack=%s', async canGoBack => {
  mockRouter.canGoBack.mockReturnValue(canGoBack); await render();
  await act(async () => props().onBack());
  expect(mockRouter.back).toHaveBeenCalledTimes(canGoBack ? 1 : 0);
  if (!canGoBack) expect(mockRouter.replace).toHaveBeenCalledWith('/profil');
  expect(mockSignOut).not.toHaveBeenCalled();
});

test('logout failure retains the account, announces a safe error and permits a deliberate retry', async () => {
  const pending = deferred(); mockSignOut.mockReturnValueOnce(pending.promise);
  await render(); const old = props().onLogout;
  await act(async () => { old(); old(); });
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(mockSignOut).toHaveBeenCalledWith({ accountId: 'account-a', accountRevision: 1 });
  expect(props().busy).toBe(true);
  await act(async () => pending.reject(new Error('private transport detail')));
  expect(props()).toMatchObject({ busy: false, logoutError: true });
  expect(props().email).toBe('ana@example.rs');
  await act(async () => props().onLogout());
  expect(mockSignOut).toHaveBeenCalledTimes(2);
  expect(props()).toMatchObject({ busy: false, logoutError: false });
});

test.each(['blur', 'account', 'same-account-new-session'])('old callbacks and late logout errors cannot affect %s', async change => {
  const pending = deferred(); mockSignOut.mockReturnValueOnce(pending.promise);
  await render(); const old = props();
  await act(async () => old.onLogout());
  if (change === 'blur') mockFocused = false;
  else mockSession = {
    user: { id: change === 'account' ? 'account-b' : 'account-a', email: 'new@example.rs' },
    accountRevision: 3,
  };
  await update();
  await act(async () => { old.open('/profil/podaci'); old.onBack(); old.onLogout(); });
  await act(async () => pending.reject(new Error('late failure')));
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(mockRouter.navigate).not.toHaveBeenCalled();
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(props().logoutError).toBe(false);
});
