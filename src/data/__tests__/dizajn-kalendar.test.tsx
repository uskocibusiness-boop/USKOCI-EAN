import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The calendar gallery (owner step 10) draws every scene from fixtures, reads nothing, and returns to its list.
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Modal', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci.app.dev' } } }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), navigate: jest.fn() } }));
jest.mock('../workerCalendarClientService', () => { throw new Error('the gallery must not reach a data service'); });
jest.mock('../agreementClientService', () => { throw new Error('the gallery must not reach a data service'); });
jest.mock('../workerAvailabilityClientService', () => { throw new Error('the gallery must not reach a data service'); });

import DizajnKalendar from '../../app/dizajn-kalendar';
import { sys } from '../../ui/system/tokens';
import { STATUS_CHIPS, STATUS_TONES } from '../../ui/system/StatusChip';

let tree: ReactTestRenderer;
const pressHost = async (label: string) => {
  await act(async () => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityLabel === label)[0].props.onPress());
};
const text = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

it('opens every scene by its visible label and comes back with "Nazad"', async () => {
  await act(async () => { tree = create(<DizajnKalendar />); });
  const labels = tree.root.findAll(node => node.type === ('Press' as React.ElementType) && /^(Kalendar|Dostupnost|List) · /.test(String(node.props.accessibilityLabel)))
    .map(node => String(node.props.accessibilityLabel));
  // 21 since the review of step 10: the list that does not say the exact time, and availability without a work profile.
  expect(labels).toHaveLength(21);
  for (const label of labels) {
    await pressHost(label);
    expect(text()).not.toContain('Kalendar · galerija');
    await pressHost('Nazad na scene');
    expect(text()).toContain(label);
  }
});

it('draws both sides, a finished Dogovor and the row of Dogovori without an exact time', async () => {
  await act(async () => { tree = create(<DizajnKalendar />); });
  await pressHost('Kalendar · dan sa Dogovorima');
  expect(text()).toContain('Uskačeš · Ana'); expect(text()).toContain('Tvoj zadatak · Marko');
  // The agenda draws the system status words (T3b, 2026-10-07): "Završen" for a finished Dogovor, "Čeka potvrdu" while a completion waits,
  // and the Dogovori without an exact time sit in their own section "Bez tačnog termina" (the former "Svi Dogovori" row is gone).
  expect(text()).toContain('Završen'); expect(text()).toContain('Čeka potvrdu');
  expect(text()).toContain('Bez tačnog termina');
  // My own work, marked done, waits for the other side's confirmation (review of step 10).
  expect(text()).toContain('Uskačeš · Nikola');
  // Round-5c: a finished row's mark is the muted grey (the hairline grey was about 1.4:1). Since T3b the mark is the system StatusMark of the
  // `task.completed` chip (an SVG, not a 6 dp View), so the one status table is what pins the colour.
  expect(STATUS_CHIPS['task.completed'].tone).toBe('grey');
  expect(STATUS_TONES.grey.mark).toBe(sys.color.muted); expect(STATUS_TONES.grey.mark).not.toBe(sys.color.lineStrong);
});

it('draws what a list read without the exact window leaves: only my work, and a line that says so', async () => {
  await act(async () => { tree = create(<DizajnKalendar />); });
  await pressHost('Kalendar · lista ne kaže tačno vreme');
  expect(text()).toContain('Učitani su samo termini u kojima uskačeš.');
  expect(text()).not.toContain('Tvoj zadatak');
  expect(text()).not.toContain('Svi Dogovori'); expect(text()).not.toContain('bez tačnog termina');
});

it('goes home from the list when it was opened cold by its address', async () => {
  const router = jest.requireMock('expo-router').router as { canGoBack: () => boolean; back: jest.Mock; replace: jest.Mock };
  const canGoBack = router.canGoBack;
  router.canGoBack = () => false;
  // Restored whatever the assertions say, so a failure here cannot leak into the next test.
  try {
    await act(async () => { tree = create(<DizajnKalendar />); });
    await pressHost('Nazad');
    expect(router.replace).toHaveBeenCalledWith('/'); expect(router.back).not.toHaveBeenCalled();
  } finally { router.canGoBack = canGoBack; }
});

// Round-5c: a missing work profile is a precondition, drawn as the route draws it; and the "razlog" scene shows the button
// its reason points at.
it('draws a missing work profile as a step to take, not as a failed read', async () => {
  await act(async () => { tree = create(<DizajnKalendar />); });
  await pressHost('Dostupnost · bez radnog profila');
  expect(text()).toContain('Najpre sačuvaj svoj radni profil.'); expect(text()).not.toContain('Dostupnost nije učitana.');
  expect(tree.root.findAll(node => node.props.kind === 'error')).toHaveLength(0);
  expect(tree.root.findAll(node => node.props.label === 'Dopuni radni profil').length).toBeGreaterThan(0);
});

it('shows the conversation check that the reason of the "razlog" scene names', async () => {
  await act(async () => { tree = create(<DizajnKalendar />); });
  await pressHost('Dostupnost · profil, dugme sa razlogom');
  expect(tree.root.findAll(node => node.props.reason === 'Prvo proveri stanje razgovora. Ishod izmene još nije potvrđen.').length).toBeGreaterThan(0);
  expect(tree.root.findAll(node => node.props.label === 'Proveri stanje razgovora').length).toBeGreaterThan(0);
});
