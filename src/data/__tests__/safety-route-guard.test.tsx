import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The safety route reached with no usable target (a stale link, a hand-typed path) used to call
// router.back() unconditionally: with no history that is a dead end. It now falls back to the hub
// and says where a report or block is actually started from.
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
let mockParams: Record<string, string | undefined> = {};
const mockSession = { user: { id: A }, accountRevision: 1 };
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
const press = (label: string) => tree.root.findAllByType('Press' as React.ElementType).find(node => node.props.accessibilityLabel === label)!;
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession }));
jest.mock('../../ui/safety/SafetyScreen', () => ({ SafetyScreen: 'Safety' }));
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsText: 'T', SettingsScreen: 'Screen' }));
// The fallback is the shared StateView; its words are the same `T` host and its actions press through `Press`.
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import Route from '../../app/(app)/bezbednost';

let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Route />); }); };
const text = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
beforeEach(() => { jest.clearAllMocks(); mockRouter.canGoBack.mockReturnValue(true); mockParams = {}; });
afterEach(async () => { await act(async () => tree?.unmount()); });

it.each([{}, { targetAccountId: A }, { targetAccountId: B, needId: 'not-a-uuid' }])('without a usable target (%j) explains where safety opens from and Back never dead-ends', async params => {
  mockParams = params; await render();
  expect(tree.root.findAllByType('Safety' as React.ElementType)).toHaveLength(0);
  expect(text()).toMatch(/sa profila (druge )?osobe/);
  await act(async () => tree.root.findByType('Screen' as React.ElementType).props.onBack());
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  mockRouter.canGoBack.mockReturnValue(false);
  await act(async () => tree.root.findByType('Screen' as React.ElementType).props.onBack());
  expect(mockRouter.replace).toHaveBeenCalledWith('/profil');
});

it('with a real other account opens the safety screen bound to that target', async () => {
  mockParams = { targetAccountId: B }; await render();
  expect(tree.root.findByType('Safety' as React.ElementType).props).toMatchObject({ targetAccountId: B, needId: null, agreementId: null });
});

// This used to open with the person's own id, which now has its own title (round-5 review, 2026-09-24); the case with no
// target at all keeps "Nije izabrana osoba".
it('without a usable target, offers the one way forward: the people you block', async () => {
  mockParams = {}; await render();
  expect(text()).toContain('Nije izabrana osoba');
  await act(async () => press('Blokirane osobe').props.onPress());
  expect(mockRouter.replace).toHaveBeenCalledWith('/profil/blokirani');
  expect(mockRouter.back).not.toHaveBeenCalled();
});

it('opened with your own account, says that it is yours instead of "Nije izabrana osoba", and opens nothing on it', async () => {
  mockParams = { targetAccountId: A }; await render();
  expect(tree.root.findAllByType('Safety' as React.ElementType)).toHaveLength(0);
  expect(text()).toContain('Ovo je tvoj nalog');
  expect(text()).not.toContain('Nije izabrana osoba');
  expect(press('Blokirane osobe')).toBeDefined();
});
