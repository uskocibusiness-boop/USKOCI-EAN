import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The calendar gallery (owner step 10) draws every scene from fixtures, reads nothing, and returns to its list.
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    // The Arhiva is a list: one that draws every item, its header, its empty state and its footer, so what the gallery puts in them can be read.
    if (key === 'FlatList') return ({ data, renderItem, keyExtractor, ListHeaderComponent, ListEmptyComponent, ListFooterComponent, ItemSeparatorComponent, ...props }: any) => {
      const react = require('react');
      return react.createElement('List', props, ListHeaderComponent, data.length
        ? data.map((item: unknown, index: number) => react.createElement(react.Fragment, { key: keyExtractor(item, index) }, renderItem({ item, index })))
        : ListEmptyComponent, ListFooterComponent, ItemSeparatorComponent ? react.createElement(ItemSeparatorComponent) : null);
    };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Modal', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci.app.dev' } } }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), navigate: jest.fn() }, useLocalSearchParams: () => ({}) }));
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
  const labels = tree.root.findAll(node => node.type === ('Press' as React.ElementType) && /^(Kalendar|Dostupnost|List|Arhiva) · /.test(String(node.props.accessibilityLabel)))
    .map(node => String(node.props.accessibilityLabel));
  // 21 since the review of step 10 (the list that does not say the exact time, availability without a work profile); 27 since the UI pass of 2026-10-08:
  // the day with Dogovori, an empty day (with and without Dogovori on other days), the section "Termin još nije dogovoren", the owner's phone
  // (one Dogovor without a term) and the Arhiva in three states. The scenes with chips are gone with the chips.
  expect(labels).toHaveLength(27);
  for (const label of labels) {
    await pressHost(label);
    expect(text()).not.toContain('Kalendar · galerija');
    await pressHost('Nazad na scene');
    expect(text()).toContain(label);
  }
});

it('draws both sides, a finished Dogovor, one with only a start, and the section of Dogovori without a term', async () => {
  await act(async () => { tree = create(<DizajnKalendar />); });
  await pressHost('Kalendar · dan sa Dogovorima');
  expect(text()).toContain('Uskačeš · Ana'); expect(text()).toContain('Tvoj zadatak · Marko');
  // The agenda draws the system status words (T3b, 2026-10-07): "Završen" for a finished Dogovor, "Čeka potvrdu" while a completion waits,
  // and the Dogovori without a term sit in their own section "Termin još nije dogovoren" (the former "Svi Dogovori" row is gone, and so
  // is "Bez tačnog termina": a heading that denied the date of a Dogovor with an accepted start).
  expect(text()).toContain('Završen'); expect(text()).toContain('Čeka potvrdu');
  expect(text()).toContain('Termin još nije dogovoren'); expect(text()).not.toContain('Bez tačnog termina');
  // A Dogovor with an accepted start and no end stands on its day with the one bound it has, not under the heading.
  expect(text()).toContain('Šišanje živice'); expect(text()).toContain('od 15:30');
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
  expect(text()).not.toContain('Svi Dogovori'); expect(text()).not.toContain('Termin još nije dogovoren');
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
  expect(tree.root.findAll(node => node.props.reason === 'Prvo proveri stanje razgovora. Ne znamo da li je izmena sačuvana.').length).toBeGreaterThan(0);
  expect(tree.root.findAll(node => node.props.label === 'Proveri stanje razgovora').length).toBeGreaterThan(0);
});

// The owner's phone of 8 Oct 2026: Raspored is the Dogovori and nothing else, so no scene has a chip, a task or an application of mine.
it('draws no chips and no task or application in any scene, and the section under the day with its command', async () => {
  const chips = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityRole === 'tab').map(node => node.props.accessibilityLabel);
  const proposals = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && /^Predloži termin\. /.test(String(node.props.accessibilityLabel)))
    .map(node => String(node.props.accessibilityLabel));
  await act(async () => { tree = create(<DizajnKalendar />); });
  await pressHost('Kalendar · dan sa Dogovorima');
  expect(chips()).toEqual([]);
  await pressHost('Nazad na scene'); await pressHost('Kalendar · prazan dan, Dogovori na drugim danima');
  expect(chips()).toEqual([]); expect(text()).toContain('Ništa nije zakazano za ovaj dan.');
  await pressHost('Nazad na scene'); await pressHost('Kalendar · termin još nije dogovoren');
  // Three without an accepted start: none at all, an end only (its own words), one waiting for a confirmation (no command).
  expect(text()).toContain('Termin još nije dogovoren'); expect(text()).toContain('Do 10. okt · 18:00 · početak nije potvrđen');
  expect(proposals()).toEqual(['Predloži termin. Krečenje stana od 80 m² u belo', 'Predloži termin. Čišćenje stana na Petrovaradinu']);
  for (const word of ['Čekaju odgovor', 'Prijava poslata', 'Prijava viđena', 'Moji zadaci', 'Moje prijave', 'Bira se']) expect(text()).not.toContain(word);
  await pressHost('Nazad na scene'); await pressHost('Kalendar · kako ga je video vlasnik (jedan Dogovor bez termina)');
  expect(text()).toContain('Krečenje stana od 80 m² u belo'); expect(text()).toContain('Ništa nije zakazano za ovaj dan.');
  expect(proposals()).toEqual(['Predloži termin. Krečenje stana od 80 m² u belo']);
});

it('draws the Arhiva in its states from the same fixtures, with its records under the group headings', async () => {
  await act(async () => { tree = create(<DizajnKalendar />); });
  await pressHost('Arhiva · završeno i otkazano');
  expect(text()).toContain('Dogovori'); expect(text()).toContain('Zadaci'); expect(text()).toContain('Prijave');
  expect(text()).toContain('Završen'); expect(text()).toContain('Otkazan'); expect(text()).toContain('Zatvoren'); expect(text()).toContain('Povučena');
  await pressHost('Nazad na scene'); await pressHost('Arhiva · prazna');
  expect(text()).toContain('Arhiva je prazna.');
  await pressHost('Nazad na scene'); await pressHost('Arhiva · greška');
  expect(text()).toContain('Arhiva nije učitana.');
});
