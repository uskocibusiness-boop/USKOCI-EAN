import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { BackHandler } from 'react-native';
import PushSettings from '../../app/(app)/profil/obavestenja';
const mockBack = jest.fn(), mockReplace = jest.fn(), mockCanBack = jest.fn();
let mockOwner = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 };
let mockParams: Record<string, string> = {};
let mockFocused = true;
jest.mock('expo-router', () => ({ router: { back: () => mockBack(), replace: (path: string) => mockReplace(path), canGoBack: () => mockCanBack() }, Stack: { Screen: () => null }, useFocusEffect: (callback: () => void) => require('react').useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]),
 useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: (props: unknown) => require('react').createElement('SafeArea', props) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockOwner, sesijaSada: () => mockOwner }));
jest.mock('../../ui/Press', () => ({ Press: (props: unknown) => require('react').createElement('Press', props) }));
jest.mock('../../ui/Text', () => ({ T: (props: unknown) => require('react').createElement('Text', props) }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: () => null }));
jest.mock('../../ui/notifications/PushPreferences', () => ({ PushPreferences: (props: unknown) => require('react').createElement('PushPreferences', props) }));
let tree: Renderer.ReactTestRenderer;
// The arrow says "Nazad" (round-5 review, 2026-09-24): the screen also opens from the gear in Obaveštenja, where
// "Nazad na profil" was wrong. This helper pinned the old label.
const back = () => tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress;
beforeEach(() => { jest.resetAllMocks(); mockFocused = true; mockCanBack.mockReturnValue(true); mockParams = {}; mockOwner = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 }; act(() => { tree = Renderer.create(<PushSettings />); }); });
afterEach(() => act(() => tree.unmount()));
it('renders both safe-area edges (the tab bar is hidden here since 2026-09-23), and the accessible header/back', () => {
 expect(tree.root.findByType('SafeArea' as never).props.edges).toEqual(['top', 'bottom']);
 // The bar says "Podešavanja": the longer name wrapped to two lines on the owner's phone (8 Oct 2026).
 expect(tree.root.findByProps({ accessibilityRole: 'header' }).props.children).toBe('Podešavanja');
 act(() => back()()); expect(mockBack).toHaveBeenCalledTimes(1);
});
// The approved blueprint of 8 Oct 2026 (P4): ONE screen for both sets of settings. There is no tab to choose, no caption under a tab, and
// no set to remember, so nothing the inbox says about a set (`skup`) is read.
it('is one screen for both sets: no tabs, no caption, and the settings are handed no set to show', () => {
 expect(tree.root.findAll(node => node.props.accessibilityRole === 'tab')).toHaveLength(0);
 expect(JSON.stringify(tree.toJSON())).not.toMatch(/Moji zadaci|Moje prijave|Obaveštenja o zadacima koje objavljuješ|Novi zadaci, tvoje prijave i Dogovori|Poslovi|poslov/);
 expect(tree.root.findByType('PushPreferences' as never).props).not.toHaveProperty('role');
 expect(tree.root.findAll(node => node.props.pointerEvents === 'none')).toHaveLength(0);
});
it('ignores the set the inbox was filtered to: the same one screen opens whatever it names', () => {
 for (const skup of ['WORKER', 'REQUESTER', 'ADMIN']) {
  act(() => tree.unmount());
  mockParams = { skup }; act(() => { tree = Renderer.create(<PushSettings />); });
  expect(tree.root.findAll(node => node.props.accessibilityRole === 'tab')).toHaveLength(0);
  expect(tree.root.findByType('PushPreferences' as never).props).not.toHaveProperty('role');
 }
});
it('direct route opens a known Profile fallback', () => { mockCanBack.mockReturnValue(false); act(() => back()()); expect(mockReplace).toHaveBeenCalledWith('/profil'); });
it.each([true, false])('dispatches Back once before blur, with history=%s, and only a fresh focus can leave again', hasHistory => {
 mockCanBack.mockReturnValue(hasHistory);
 const retained = back();
 act(() => { retained(); retained(); });
 const navigation = hasHistory ? mockBack : mockReplace;
 expect(navigation).toHaveBeenCalledTimes(1);
 expect(hasHistory ? mockReplace : mockBack).not.toHaveBeenCalled();
 mockFocused = false; act(() => tree.update(<PushSettings />));
 act(() => retained()); expect(navigation).toHaveBeenCalledTimes(1);
 mockFocused = true; act(() => tree.update(<PushSettings />));
 act(() => retained()); expect(navigation).toHaveBeenCalledTimes(1);
 act(() => { back()(); back()(); }); expect(navigation).toHaveBeenCalledTimes(2);
});
it('a new account revision gets its own one-shot Back and retires the old callback', () => {
 const retained = back(); act(() => retained());
 mockOwner = { ...mockOwner, accountRevision: 3 }; act(() => tree.update(<PushSettings />));
 act(() => retained()); expect(mockBack).toHaveBeenCalledTimes(1);
 act(() => { back()(); back()(); }); expect(mockBack).toHaveBeenCalledTimes(2);
});
it('retained back after unmount is inert', () => { const old = back(); act(() => tree.unmount()); old(); expect(mockBack).not.toHaveBeenCalled(); });
it('account ABA cannot navigate through an old callback', () => { const old = back(); mockOwner = { ...mockOwner, accountRevision: 3 }; old(); expect(mockBack).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled(); });

// Step 11a (2026-09-24): unsaved changes are no longer thrown away without a word by Back.
const shown = () => tree.root.findByType('PushPreferences' as never);
const confirmButton = () => tree.root.findAll(node => node.props.testID === 'confirm-sheet-confirm')[0];
const cancelButton = () => tree.root.findAll(node => node.props.testID === 'confirm-sheet-cancel')[0];
const makeDirty = () => act(() => shown().props.onDirtyChange(true));
it('Back with unsaved changes asks first, and leaves only after "Odbaci izmene", through the same checks', () => {
 makeDirty();
 act(() => back()());
 expect(mockBack).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
 expect(JSON.stringify(tree.toJSON())).toContain('Izmene vrsta obaveštenja i tihih sati nisu sačuvane.');
 expect(confirmButton().props.accessibilityLabel).toBe('Odbaci izmene');
 act(() => confirmButton().props.onPress());
 expect(mockBack).toHaveBeenCalledTimes(1);
});
it('a confirmed discard still refuses to leave for an account that changed while the question stood', () => {
 makeDirty(); act(() => back()());
 mockOwner = { ...mockOwner, accountRevision: 3 };
 act(() => confirmButton().props.onPress());
 expect(mockBack).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});
it('"Nastavi uređivanje" keeps the screen and its changes', () => {
 makeDirty();
 act(() => back()());
 // The way out of "Odbaci izmene?" says it keeps the changes; "Odustani" could be read as giving them up.
 expect(cancelButton().props.accessibilityLabel).toBe('Nastavi uređivanje');
 act(() => cancelButton().props.onPress());
 expect(mockBack).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
 // Nothing was discarded: the screen still holds its changes, so Back asks again.
 act(() => back()());
 expect(confirmButton()).toBeDefined(); expect(mockBack).not.toHaveBeenCalled();
});
it('Android Back asks the same question only while something is unsaved', () => {
 act(() => tree.unmount());
 const handlers: (() => boolean)[] = [];
 const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_event: string, handler: () => boolean) => {
  handlers.push(handler); return { remove: jest.fn() }; }) as never);
 try {
  act(() => { tree = Renderer.create(<PushSettings />); });
  expect(handlers.at(-1)!()).toBe(false);
  makeDirty();
  let handled = false; act(() => { handled = handlers.at(-1)!(); });
  expect(handled).toBe(true); expect(mockBack).not.toHaveBeenCalled();
  expect(confirmButton()).toBeDefined();
 } finally { spy.mockRestore(); }
});
