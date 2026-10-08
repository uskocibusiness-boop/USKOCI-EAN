import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The internal step-11a board (2026-09-24) is how these screens are checked on the emulator. Every scene has to open
// from its visible name and come back with "Nazad", and none may read or write anything.
const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
const mockData = jest.fn();
let mockParams: Record<string, string> = {};
const mockCall = (...args: unknown[]) => mockData(...args);
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
// The sheet engine needs the native modal and gesture stack; the explanation behind "ⓘ" is its content.
jest.mock('../../ui/product/ProductSheet', () => ({
  ProductSheet: ({ title, children, onClose }: { title: string; children: (dismiss: () => void) => React.ReactNode; onClose: () => void }) =>
    require('react').createElement('Sheet', { title, onClose }, children(() => onClose())),
}));
jest.mock('../notificationPreferencesClientService', () => ({ notificationPreferencesClientService: { read: (...a: unknown[]) => mockCall(...a), save: (...a: unknown[]) => mockCall(...a) } }));
jest.mock('../nativePushDevice', () => ({ nativePushDevice: (...a: unknown[]) => mockCall(...a) }));
jest.mock('../pushDeviceClientService', () => ({ pushDeviceClientService: { read: (...a: unknown[]) => mockCall(...a), set: (...a: unknown[]) => mockCall(...a) } }));
jest.mock('../pushReadinessClientService', () => ({ pushReadinessClientService: { read: (...a: unknown[]) => mockCall(...a) } }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import Gallery from '../../app/dizajn-obavestenja';

let tree: ReactTestRenderer;
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const press = (label: string) => presses().find(node => node.props.accessibilityLabel === label);
const text = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const open = async (label: string) => { await act(async () => press(label)!.props.onPress()); };
beforeEach(() => { mockParams = {}; mockData.mockClear(); Object.values(mockRouter).forEach(fn => fn.mockClear?.()); });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('opens every scene from its visible name, draws it, and comes back with "Nazad" without touching data', async () => {
  await act(async () => { tree = create(<Gallery />); });
  const labels = presses().map(node => node.props.accessibilityLabel as string).filter(label => label.includes(' · '));
  expect(labels.length).toBeGreaterThanOrEqual(25);
  // The states the round-5 review fixes drew for the first time are on the board too.
  expect(labels).toEqual(expect.arrayContaining(['Podešavanja · sačuvano', 'Podešavanja · uključeno, telefon nije povezan',
    'Blokirani · lista nije osvežena']));
  // The states of the one settings screen (the approved blueprint of 8 Oct 2026): off on the phone, one set only, a choice in the middle.
  expect(labels).toEqual(expect.arrayContaining(['Podešavanja · isključeno na telefonu', 'Podešavanja · telefon prima samo „Kad uskačeš“',
    'Podešavanja · vrsta uključena delimično']));
  for (const label of labels) {
    await open(label);
    expect(press(label)).toBeUndefined();
    expect(text()).toContain(label);
    await act(async () => press('Nazad na scene')!.props.onPress());
    expect(press(label)).toBeDefined();
  }
  expect(mockData).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
// It walks every scene (about 30) in one test, as the other boards' suites do: a longer budget than a single screen, so a
// loaded machine does not fail it at Jest's 5 s default (seen twice in the round-5 review).
}, 90_000);
// Round 5c (2026-09-24): the state DEV shows today (the sender off, a set's choice on, on the emulator) is on the board, and
// its two sentences no longer contradict each other: the choice is "obaveštenja na telefon", "slanje" is the send check.
it('draws a device without notifications whose sets are on while sending is not yet on', async () => {
  await act(async () => { tree = create(<Gallery />); });
  await open('Podešavanja · uključeno, slanje još nije uključeno');
  expect(text()).toContain('Nije dostupno na ovom uređaju');
  await act(async () => press('Napredno')!.props.onPress());
  expect(text()).toContain('Obaveštenja na telefon su uključena.');
  expect(text()).toContain('Slanje iz aplikacije trenutno nije uključeno, čak i ako je telefon povezan.');
  expect(text()).not.toContain('Slanje na telefon je uključeno');
  expect(mockData).not.toHaveBeenCalled();
});
// The settings are ONE screen for both sets: the bar and the settings, no tabs and no caption.
it('draws the settings as one screen with no tabs, and each state in its own words', async () => {
  await act(async () => { tree = create(<Gallery />); });
  await open('Podešavanja · uključeno, povezan telefon');
  expect(text()).toContain('Podešavanja'); expect(text()).toContain('Ovaj telefon'); expect(text()).toContain('Kad objavljuješ'); expect(text()).toContain('Kad uskačeš');
  expect(text()).toContain('Tihi sati'); expect(text()).toContain('Obaveštenja su uključena');
  expect(tree.root.findAll(node => node.props.accessibilityRole === 'tab')).toHaveLength(0);
  for (const word of ['Moji zadaci', 'Moje prijave', 'Obaveštenja o zadacima koje objavljuješ', 'Podešavanja obaveštenja']) expect(text()).not.toContain(word);
  await act(async () => press('Nazad na scene')!.props.onPress());
  await open('Podešavanja · isključeno na telefonu');
  // The phone is connected and no set sends to it: the one step is to switch it on, and there is nothing to switch off.
  expect(text()).toContain('Obaveštenja su isključena'); expect(press('Uključi obaveštenja na telefonu')).toBeDefined();
  expect(press('Poveži ovaj telefon')).toBeUndefined(); expect(press('Isključi obaveštenja na telefonu')).toBeUndefined();
  await act(async () => press('Nazad na scene')!.props.onPress());
  await open('Podešavanja · telefon prima samo „Kad uskačeš“');
  expect(text()).toContain('Obaveštenja su delimično uključena');
  await act(async () => press('Nazad na scene')!.props.onPress());
  await open('Podešavanja · vrsta uključena delimično');
  expect(text()).toContain('Delimično uključeno. Pojedinosti su u Naprednom.');
  expect(mockData).not.toHaveBeenCalled();
});
// The web lab has no text scale: `?text=` draws the designed layout (1.15) or the stacked one (1.3), whatever the width says.
it.each(['1.15', '1.3'])('opens a scene by its address at the text size %s and keeps the words', async size => {
  mockParams = { scene: 'push', text: size };
  await act(async () => { tree = create(<Gallery />); });
  expect(text()).toContain('Ovaj telefon'); expect(text()).toContain('Kad uskačeš');
  expect(text()).not.toContain('Tabla obaveštenja i podešavanja');
});
// R11 / R15: the task an event is about, as the inbox draws it the day the read says which one.
it('draws the inbox with the task under the event where the read names it', async () => {
  mockParams = { scene: 'inbox-task' };
  await act(async () => { tree = create(<Gallery />); });
  expect(text()).toContain('Montaža police u hodniku'); expect(text()).toContain('Krečenje stana u belo');
  expect(text()).not.toContain('Otvara');
});
