import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockIntent = 'narucilac';
const mockReadRange = jest.fn((from: string, to: string) => ({ ok: true, podatak: { from, to, events: [], authoritative: true } }));
const mockAgreements = jest.fn(() => []);
const mockNavigate = jest.fn();

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    return ['View', 'ScrollView', 'ActivityIndicator', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), navigate: (...args: unknown[]) => mockNavigate(...args) } }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent }));
jest.mock('../workerCalendarClientService', () => ({ workerCalendarClientService: { readRange: (...args: [string, string]) => mockReadRange(...args) } }));
jest.mock('../agreementClientService', () => ({ agreementClientService: { mojiDogovori: () => mockAgreements() } }));
// Raspored also reads my tasks, my applications and the availability a worker keeps (Početna's and Dostupnost's own reads).
jest.mock('../needClientService', () => ({ needClientService: { mojePotrebe: () => [] } }));
jest.mock('../applicationClientService', () => ({ applicationClientService: { mojePrijave: () => [] } }));
jest.mock('../workerAvailabilityClientService', () => ({ workerAvailabilityClientService: { read: () => ({ ok: false }) } }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: (read: () => unknown) => ({ data: read(), loading: false, error: false, refresh: jest.fn() }) }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
// The top bar is the shared one and draws with the real T; render it as the same host node the
// rest of this screen uses, so the scope label it carries is inside what these tests read.
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/calendar/CalendarControls', () => ({
  CalendarAction: (props: Record<string, unknown>) => require('react').createElement('Button', { ...props, accessibilityLabel: props.label }),
  CalendarText: 'T',
  calendarStyles: { screen: {}, header: {}, icon: {}, content: {}, row: {}, note: {}, card: {}, divider: {} },
}));

import Raspored from '../../app/(app)/raspored';

let tree: ReactTestRenderer;
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');

beforeEach(() => {
  jest.clearAllMocks();
  mockIntent = 'narucilac';
});
afterEach(async () => { await act(async () => tree?.unmount()); });

async function render() {
  await act(async () => { tree = create(<Raspored />); });
}

// Owner decisions 1 and 6 (2026-09-19). The calendar holds the work I agreed to do; it is mine to open
// and its availability editor is mine to use whenever I like. It used to explain itself as "the JA
// MOGU schedule" and hide the editor from a person standing in the other app mode.
describe('PKG-005 calendar scope', () => {
  it.each(['narucilac', 'uskocer'])('reads the same calendar, offers the availability editor and names no app mode, whatever the app last was (%s)', async last => {
    mockIntent = last;
    await render();
    expect(mockReadRange).toHaveBeenCalledTimes(1);
    // The planner is called "Raspored" (owner, 2026-10-07), here and on Početna.
    expect(text()).toContain('Raspored'); expect(text()).not.toContain('Kalendar obaveza');
    // Updated deliberately (plan step 0, 2026-09-23): the subtitle under the week ("… u koje si uskočio", gendered) and
    // the standing disclaimer under the calendar pinned copy that explained the screen; both are gone by the owner's
    // rule. The scope itself is unchanged: one calendar read, the availability editor, no app mode.
    expect(text()).not.toContain('uskočio');
    expect(text()).not.toContain('oni te ovde ne blokiraju');
    // Updated deliberately (owner step 10, 2026-09-24, critique A15/B18): the calendar places the Dogovori about my own
    // tasks and finished ones too, from the exact window the Dogovori list carries (`tacanTermin`, wired in the review
    // of step 10), so a day with none of them is simply empty, in one quiet line, for either side. Since Raspored (2026-10-07)
    // the planner holds my tasks and applications too, so that line no longer says "Dogovori".
    expect(text()).toContain('Ništa nije zakazano za ovaj dan.');
    expect(text()).not.toContain('Dogovori za tvoje zadatke');
    expect(text()).toContain('Moja dostupnost za rad');
    expect(text()).not.toMatch(/JA MOGU|MENI TREBA/);
    // The availability row is spoken by its visible words since the review of step 10, and the Arhiva stands beside it.
    expect(tree.root.findByProps({ accessibilityLabel: 'Moja dostupnost za rad' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Arhiva' })).toBeTruthy();
  });
});
