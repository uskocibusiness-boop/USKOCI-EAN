import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, BackHandler } from 'react-native';
import PushSettings from '../../app/(app)/profil/obavestenja';
const mockBack = jest.fn(), mockReplace = jest.fn(), mockCanBack = jest.fn();
let mockIntent = 'narucilac'; let mockOwner = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 };
let mockParams: Record<string, string> = {};
let mockFocused = true;
jest.mock('expo-router', () => ({ router: { back: () => mockBack(), replace: (path: string) => mockReplace(path), canGoBack: () => mockCanBack() }, Stack: { Screen: () => null }, useFocusEffect: (callback: () => void) => require('react').useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]),
 useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: (props: unknown) => require('react').createElement('SafeArea', props) }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockOwner, sesijaSada: () => mockOwner }));
jest.mock('../../ui/Press', () => ({ Press: (props: unknown) => require('react').createElement('Press', props) }));
jest.mock('../../ui/Text', () => ({ T: (props: unknown) => require('react').createElement('Text', props) }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: () => null }));
jest.mock('../../ui/notifications/PushPreferences', () => ({ PushPreferences: (props: unknown) => require('react').createElement('PushPreferences', props) }));
let tree: Renderer.ReactTestRenderer;
// The arrow says "Nazad" (round-5 review, 2026-09-24): the screen also opens from the gear in Obaveštenja, where
// "Nazad na profil" was wrong. This helper pinned the old label.
const back = () => tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress;
beforeEach(() => { jest.resetAllMocks(); mockFocused = true; mockCanBack.mockReturnValue(true); mockIntent = 'narucilac'; mockParams = {}; mockOwner = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 }; act(() => { tree = Renderer.create(<PushSettings />); }); });
afterEach(() => act(() => tree.unmount()));
it('renders both safe-area edges (the tab bar is hidden here since 2026-09-23), the accessible header/back and footer', () => {
 expect(tree.root.findByType('SafeArea' as never).props.edges).toEqual(['top', 'bottom']);
 expect(tree.root.findByProps({ accessibilityRole: 'header' }).props.children).toBe('Podešavanja obaveštenja');
 expect(tree.root.findByType('PushPreferences' as never).props.role).toBe('REQUESTER');
 expect(JSON.stringify(tree.toJSON())).toContain('Obaveštenja o zadacima koje objavljuješ.'); expect(JSON.stringify(tree.toJSON())).not.toMatch(/Meni treba|Ja mogu/);
 act(() => back()()); expect(mockBack).toHaveBeenCalledTimes(1);
});
// T4a (2026-10-07): one name, one set, everywhere. The two sets of settings carry the words of the inbox's filters, and the word "poslovi" is gone.
it('names its two sets as the inbox names its two filters', () => {
 const { INBOX_FILTERS } = require('../../ui/notifications/InboxPresentation');
 const tabs = tree.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel).map(node => node.props.accessibilityLabel as string);
 expect([...new Set(tabs)]).toEqual(['Moji zadaci', 'Moje prijave']);
 expect(INBOX_FILTERS.map((filter: { label: string }) => filter.label).slice(1)).toEqual([...new Set(tabs)]);
 expect(JSON.stringify(tree.toJSON())).not.toMatch(/Poslovi|poslov|Zadaci i prijave/);
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
// Owner decision 1 (2026-09-19). The server keeps two sets of notification settings for one account.
// Which set this screen edited used to follow the app's global mode; it is chosen on this screen now.
it('chooses which of the two server sets to edit here, on the screen, and a flip of the retired app mode changes nothing', () => {
 const old = back(); mockIntent = 'uskocer'; act(() => { tree.update(<PushSettings />); });
 expect(tree.root.findByType('PushPreferences' as never).props.role).toBe('REQUESTER');
 act(() => tree.root.findByProps({ accessibilityLabel: 'Moje prijave' }).props.onPress());
 expect(tree.root.findByType('PushPreferences' as never).props.role).toBe('WORKER');
 expect(JSON.stringify(tree.toJSON())).toContain('Novi zadaci, tvoje prijave i Dogovori.');
 // Selecting another set retires the prior view's callback; the shown arrow still works.
 old(); expect(mockBack).not.toHaveBeenCalled();
 act(() => back()()); expect(mockBack).toHaveBeenCalledTimes(1);
});

// Step 11a (2026-09-24): unsaved changes of one set are no longer thrown away without a word by Back or a set switch.
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
it('switching the set with unsaved changes asks first; "Nastavi uređivanje" keeps the set and its changes', () => {
 makeDirty();
 act(() => tree.root.findByProps({ accessibilityLabel: 'Moje prijave' }).props.onPress());
 expect(shown().props.role).toBe('REQUESTER');
 // The way out of "Odbaci izmene?" says it keeps the changes; "Odustani" could be read as giving them up.
 expect(cancelButton().props.accessibilityLabel).toBe('Nastavi uređivanje');
 act(() => cancelButton().props.onPress());
 expect(shown().props.role).toBe('REQUESTER'); expect(mockBack).not.toHaveBeenCalled();
 act(() => tree.root.findByProps({ accessibilityLabel: 'Moje prijave' }).props.onPress());
 act(() => confirmButton().props.onPress());
 expect(shown().props.role).toBe('WORKER');
 expect(JSON.stringify(tree.toJSON())).toContain('Novi zadaci, tvoje prijave i Dogovori.');
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
// Round-5 review (2026-09-24): a write of the shown set keeps the set until its outcome is read back.
it('while a save of the shown set runs, the set switch waits and nothing is asked; afterwards it switches again', () => {
 const untouchable = () => tree.root.findAll(node => node.props.pointerEvents === 'none').length;
 const before = untouchable();
 act(() => shown().props.onWritingChange(true));
 expect(untouchable()).toBeGreaterThan(before);
 act(() => tree.root.findByProps({ accessibilityLabel: 'Moje prijave' }).props.onPress());
 expect(shown().props.role).toBe('REQUESTER'); expect(confirmButton()).toBeUndefined();
 act(() => shown().props.onWritingChange(false));
 act(() => tree.root.findByProps({ accessibilityLabel: 'Moje prijave' }).props.onPress());
 expect(shown().props.role).toBe('WORKER');
});
// Round 5c (2026-09-24): a screen reader's double tap still reaches a waiting tab; it used to do nothing without a word.
it('a set tab pressed while a write runs says why it waits, and does not switch', () => {
 const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
 try {
  act(() => shown().props.onWritingChange(true));
  act(() => tree.root.findByProps({ accessibilityLabel: 'Moje prijave' }).props.onPress());
  expect(shown().props.role).toBe('REQUESTER');
  expect(announce).toHaveBeenCalledWith('Sačekaj da se čuvanje završi.');
  act(() => shown().props.onWritingChange(false)); announce.mockClear();
  act(() => tree.root.findByProps({ accessibilityLabel: 'Moje prijave' }).props.onPress());
  expect(shown().props.role).toBe('WORKER'); expect(announce).not.toHaveBeenCalled();
 } finally { announce.mockRestore(); }
});
// Round-5 review (2026-09-24): the gear of an inbox filtered to "Moje prijave" used to open "Moji zadaci".
it('opens on the set the inbox names, ignores anything else it is handed, and takes a new name on the next visit', () => {
 act(() => tree.unmount());
 mockParams = { skup: 'WORKER' }; act(() => { tree = Renderer.create(<PushSettings />); });
 expect(shown().props.role).toBe('WORKER');
 expect(JSON.stringify(tree.toJSON())).toContain('Novi zadaci, tvoje prijave i Dogovori.');
 act(() => tree.unmount());
 mockParams = { skup: 'ADMIN' }; act(() => { tree = Renderer.create(<PushSettings />); });
 expect(shown().props.role).toBe('REQUESTER');
 // The screen stays mounted between visits; the next way in that names a set shows it.
 mockParams = { skup: 'WORKER' }; act(() => { tree.update(<PushSettings />); });
 expect(shown().props.role).toBe('WORKER');
});
