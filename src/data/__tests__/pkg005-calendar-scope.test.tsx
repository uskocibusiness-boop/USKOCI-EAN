import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockIntent = 'narucilac';
let mockWorker = false;
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
// The app's own reads: the intent the app last had, and the work profile (a person without one has no hours to show).
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, useIzvor: () => ({ mojRadnikProfil: () => mockWorker ? { id: 'profile', stanje: 'ACTIVE' } : null }) }));
jest.mock('../workerCalendarClientService', () => ({ workerCalendarClientService: { readRange: (...args: [string, string]) => mockReadRange(...args) } }));
jest.mock('../agreementClientService', () => ({ agreementClientService: { mojiDogovori: () => mockAgreements() } }));
// Raspored holds the Dogovori and nothing else: it reads no task and no application of mine. It reads the hours a worker keeps, for the shade and the band.
jest.mock('../workerAvailabilityClientService', () => ({ workerAvailabilityClientService: { read: () => mockWorker
  ? { ok: true, podatak: { timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] } } : { ok: false, kod: 'WORKER_PROFILE_REQUIRED', poruka: 'Najpre sačuvaj svoj radni profil.' } } }));
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: (read: () => unknown) => ({ data: read(), loading: false, error: false, refresh: jest.fn() }) }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
// The top bar is the shared one and draws with the real T; render it as the same host node the
// rest of this screen uses, so the scope label it carries is inside what these tests read.
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../ui/calendar/CalendarControls', () => ({
  CalendarAction: (props: Record<string, unknown>) => require('react').createElement('Button', { ...props, accessibilityLabel: props.label }),
  CalendarText: 'T',
  calendarStyles: { screen: {}, header: {}, icon: {}, content: {}, row: {}, note: {}, card: {}, divider: {} },
}));

import Raspored from '../../app/(app)/raspored';

let tree: ReactTestRenderer;
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = (label: string) => tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === label);

beforeEach(() => {
  jest.clearAllMocks();
  mockIntent = 'narucilac'; mockWorker = false;
});
afterEach(async () => { await act(async () => tree?.unmount()); });

async function render() {
  await act(async () => { tree = create(<Raspored />); });
}

// Owner decisions 1 and 6 (2026-09-19). The calendar holds the work I agreed to do; it is mine to open whenever I like. It used to
// explain itself as "the JA MOGU schedule" and hide the editor from a person standing in the other app mode. Since 8 Oct 2026 the way
// into the hours is a worker's: "Moja dostupnost" is there for someone who has a work profile, whatever the app last was, and not
// for someone who has none (their hours live in the work profile, which they have not made).
describe('PKG-005 calendar scope', () => {
  it.each(['narucilac', 'uskocer'])('reads the same calendar and names no app mode, whatever the app last was (%s)', async last => {
    mockIntent = last;
    await render();
    expect(mockReadRange).toHaveBeenCalledTimes(1);
    // The planner is called "Raspored" (owner, 2026-10-07), here and on Početna.
    expect(text()).toContain('Raspored'); expect(text()).not.toContain('Kalendar obaveza');
    // Updated deliberately (plan step 0, 2026-09-23): the subtitle under the week ("… u koje si uskočio", gendered) and
    // the standing disclaimer under the calendar pinned copy that explained the screen; both are gone by the owner's
    // rule. The scope itself is unchanged: one calendar read, no app mode.
    expect(text()).not.toContain('uskočio');
    expect(text()).not.toContain('oni te ovde ne blokiraju');
    // Updated deliberately (owner step 10, 2026-09-24, critique A15/B18): the calendar places the Dogovori about my own
    // tasks and finished ones too, from the exact window the Dogovori list carries (`tacanTermin`, wired in the review
    // of step 10), so a day with none of them is simply empty, in one quiet line, for either side.
    expect(text()).toContain('Ništa nije zakazano za ovaj dan.');
    expect(text()).not.toContain('Dogovori za tvoje zadatke');
    expect(text()).not.toMatch(/JA MOGU|MENI TREBA/);
    // The Arhiva stands under the calendar for everyone, by its visible word.
    expect(presses('Arhiva')).toHaveLength(1);
  });
  it('offers the availability editor to someone with a work profile, by its visible words, and to no one else', async () => {
    await render();
    expect(presses('Moja dostupnost')).toHaveLength(0);
    await act(async () => tree.unmount());
    mockWorker = true;
    await render();
    expect(presses('Moja dostupnost')).toHaveLength(1);
    expect(presses('Arhiva')).toHaveLength(1);
  });
});
