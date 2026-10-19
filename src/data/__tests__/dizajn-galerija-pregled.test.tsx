import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The gallery of the publish review (`/dizajn-objava`, group "Pregled pre objave"), in the states the owner sees on his phone (UI/UX pass of
 * the review includes the task as others will read it, one ordinary AI correction action, and owner-only exact location controls. Each scene draws the real presentation parts
 * from the fixtures the route makes the same task from (`reviewAsTask`), reads and writes nothing, and a store build shows nothing at all.
 */
let mockPackage: string | undefined = 'rs.uskoci.app.dev';
const mockRouter = { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn(), navigate: jest.fn() };
jest.mock('expo-constants', () => ({ get expoConfig() { return { android: { package: mockPackage } }; } }));
jest.mock('expo-router', () => ({ router: mockRouter, useRouter: () => mockRouter, useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => effect(), [effect]) }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'useWindowDimensions') return () => ({ width: 361, height: 780, scale: 3, fontScale: 1 });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar', FaceEdge: 'FaceEdge', FACE_EDGE: 2 }));
// The native map and the place form are drawn by their own suites; the pickers are the calendar's.
jest.mock('../../ui/location/LocationMapPreview', () => ({ LocationMapPreview: 'MapPreview' }));
jest.mock('../../ui/location/NeedLocationForm', () => ({ NeedLocationForm: 'NeedLocationForm' }));
jest.mock('../../ui/location/LocationControls', () => ({ LocationScreen: 'LocationScreen' }));
jest.mock('../../ui/calendar/CalendarControls', () => ({ CivilField: 'CivilField' }));
// A gallery never reaches a data service: the photo component that would read one is a stand-in, and the client throws if anything asks it for a connection.
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../supabaseClient', () => ({ supabaseKonfigurisan: () => false, supabaseKlijent: () => { throw new Error('a gallery must not reach the data client'); } }));

import DizajnObjava from '../../designLab/dizajn-objava';
import { brandAction } from '../../ui/system/tokens';

let tree: ReactTestRenderer;
const originalDev = __DEV__;
const testRuntime = globalThis as unknown as { __DEV__: boolean };
const text = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
const labels = () => tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => String(node.props.accessibilityLabel));
const GROUP = 'Pregled pre objave';
const open = async (scene: string) => {
  await act(async () => { tree = create(<DizajnObjava />); });
  const row = tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === `${GROUP}: ${scene}`)[0];
  expect(row).toBeDefined();
  await act(async () => row.props.onPress());
};
const ACTIONS = ['Izmeni zadatak', 'Proveri tačke na mapi', 'Izmeni, Fotografije'];
const RETIRED_LOCATION_EDITORS = ['Izmeni, Mesto', 'Izmeni, Približno mesto', 'Izmeni, Tačna adresa', 'Dodaj mesto'];
const press = async (label: string) => {
  const button = tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0];
  expect(button).toBeDefined();
  await act(async () => button.props.onPress());
};
const expectNoManualFactEditor = () => {
  expect(tree.root.findAll(node => ['TextInput', 'CivilField'].includes(String(node.type)))).toHaveLength(0);
  expect(labels()).not.toContain('Sačuvaj ispravku');
  expect(labels()).not.toContain('Izmeni, Rok za prijave');
};
beforeEach(() => { jest.clearAllMocks(); mockPackage = 'rs.uskoci.app.dev'; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = undefined as unknown as ReactTestRenderer; testRuntime.__DEV__ = originalDev; });

it('shows nothing but its refusal in a store build', async () => {
  mockPackage = 'rs.uskoci.app'; testRuntime.__DEV__ = false;
  await act(async () => { tree = create(<DizajnObjava />); });
  expect(text()).toBe('Nije dostupno.');
});

describe('a ready review presents facts, one AI correction entry and explicit map/media controls', () => {
  it('shows the task facts and explains who can see the owner\'s exact address', async () => {
    await open('Spremno za objavu');
    const copy = text();
    expect(copy).toContain('Prenos ormara na treći sprat bez lifta'); expect(copy).toContain('4.500 RSD'); expect(copy).toContain('Detelinara, Novi Sad');
    expect(copy).toContain('Treba 2 osobe'); expect(copy).toContain('Naručilac'); expect(copy).not.toContain('Objavio');
    expect(copy).toContain('Miloš P.'); expect(copy).toContain('4,7');
    // The exact address is his alone, in its own frame, with the one sentence of privacy.
    expect(copy).toContain('Tačna adresa'); expect(copy).toContain('Bulevar Evrope 24, Novi Sad'); expect(copy).toContain('Vidiš samo ti. Tačna lokacija se deli tek uz tvoju dozvolu u Dogovoru.');
  });

  it('names supported corrections and gives publication the shared primary-action role', async () => {
    await open('Spremno za objavu');
    const named = labels();
    for (const pencil of ACTIONS) expect(named).toContain(pencil);
    for (const label of RETIRED_LOCATION_EDITORS) expect(named).not.toContain(label);
    expect(named.filter(label => label === 'Proveri tačke na mapi')).toHaveLength(1);
    expect(named).toContain('Obriši nacrt'); expect(named).toContain('Objavi zadatak');
    const publish = tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Objavi zadatak');
    expect(publish).toHaveLength(1);
    expect(StyleSheet.flatten(publish[0].props.style)).toMatchObject({ backgroundColor: brandAction.backgroundColor, minHeight: brandAction.minHeight });
    expectNoManualFactEditor();
  });

  it('"Tražim ponude" shows no amount anywhere, and a term nobody fixed is the word "Fleksibilno"', async () => {
    await open('Tražim ponude, bez roka');
    expect(text()).toContain('Tražim ponude'); expect(text()).toContain('Fleksibilno'); expect(text()).not.toContain('4.500');
    expect(text()).toContain('Bez posebnog roka');
  });
});

describe('what stands in the way, and the states in which nothing can be changed', () => {
  it('a task without a place or a price says so, draws no map and no frame, and the publish waits grey with its reason', async () => {
    await open('Još treba');
    const copy = text();
    expect(copy).toContain('Još treba'); expect(copy).toContain('Mesto na mapi nije potvrđeno.');
    expect(copy).toContain('Cena nije navedena'); expect(copy).toContain('Lokacija nije navedena');
    expect(copy).not.toContain('Tačna adresa'); expect(copy).not.toContain('Približno mesto');
    expect(labels()).not.toContain('Proveri tačke na mapi');
    expect(tree.root.findByProps({ accessibilityLabel: 'Mesto na mapi nije potvrđeno.' }).props.accessibilityHint).toBe('Potvrdi tačke na mapi');
    for (const label of RETIRED_LOCATION_EDITORS) expect(labels()).not.toContain(label);
    expect(tree.root.findByProps({ accessibilityLabel: 'Objavi zadatak' }).props.disabled).toBe(true);
    expect(copy).toContain('Prvo uradi ono što piše pod „Još treba“.');
  });

  it('while publication runs semantic editors are absent and map/deletion actions are disabled', async () => {
    await open('Objavljuje se');
    for (const label of ['Izmeni zadatak', 'Izmeni, Fotografije', ...RETIRED_LOCATION_EDITORS]) expect(labels()).not.toContain(label);
    expect(tree.root.findByProps({ accessibilityLabel: 'Proveri tačke na mapi' }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ accessibilityLabel: 'Obriši nacrt' }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ accessibilityLabel: 'Objavi zadatak' }).props.accessibilityState).toEqual({ disabled: true, busy: true });
  });

  it('a stored command is read only: no pencil, no row of the deletion, no "Dodaj još podataka"', async () => {
    await open('Privatan nacrt');
    for (const pencil of ACTIONS) expect(labels()).not.toContain(pencil);
    expect(labels()).not.toContain('Obriši nacrt'); expect(text()).not.toContain('Dodaj još podataka');
    expect(text()).toContain('Sačuvano kao privatan nacrt.');
  });

  it('the changes of a task that exists are confirmed, not published, and there is no draft to delete', async () => {
    await open('Izmena objavljenog zadatka');
    expect(text()).toContain('Pregled izmena'); expect(labels()).toContain('Potvrdi izmene'); expect(labels()).not.toContain('Objavi zadatak');
    expect(labels()).not.toContain('Obriši nacrt'); expect(labels()).toContain('Izmeni zadatak');
  });
});

describe('the other shapes of a task', () => {
  it('a route names its stops on the page, the two places in the frame, and the points to be confirmed are not counted when all are', async () => {
    await open('Od mesta do mesta');
    const copy = text();
    expect(copy).toContain('Polazište'); expect(copy).toContain('Odredište'); expect(copy).toContain('Bulevar oslobođenja 12, Novi Sad'); expect(copy).toContain('Rade Končara 5, Sremska Kamenica');
    expect(copy).not.toContain('Potvrđeno tačaka');
  });

  it('identifies remote work and shows no location map or exact address', async () => {
    await open('Rad na daljinu');
    expect(text()).toContain('Na daljinu'); expect(text()).not.toContain('Tačna adresa'); expect(text()).not.toContain('Približno mesto');
    expect(tree.root.findAllByType('MapPreview' as React.ElementType)).toHaveLength(0);
    expect(tree.root.findAllByType('NeedLocationForm' as React.ElementType)).toHaveLength(0);
    for (const label of [...RETIRED_LOCATION_EDITORS, 'Proveri tačke na mapi', 'Potvrdi tačke na mapi']) expect(labels()).not.toContain(label);
  });

  it('a draft with no photographs offers the way to add them, and an owner nobody has read is not drawn as the one who asks', async () => {
    await open('Bez fotografija, bez lica');
    expect(labels()).toContain('Dodaj fotografije'); expect(labels()).not.toContain('Izmeni, Fotografije');
    expect(text()).not.toContain('Naručilac'); expect(text()).not.toContain('Objavio'); expect(text()).not.toContain('Miloš P.');
  });

  it('long names wrap whole: nothing is cut with an ellipsis, and the page says all of them', async () => {
    await open('Dugi nazivi');
    expect(text()).toContain('Prenos klavira, dve garderobe i radnog stola');
    expect(text()).toContain('Pokrivači i zaštitne folije za staklena vrata');
    for (const node of tree.root.findAll(node => String(node.type) === 'T' && String(node.props.children).startsWith('Prenos klavira'))) expect(node.props.numberOfLines).toBeUndefined();
  });

  it('keeps correction actions named at normal and large text', async () => {
    await open('Spremno za objavu');
    expect(labels()).toContain('Izmeni zadatak'); expect(labels()).not.toContain('Izmeni, Naslov');
    await act(async () => tree.unmount());
    await open('Veliki tekst');
    expect(labels()).toContain('Izmeni zadatak'); expect(labels()).not.toContain('Izmeni, Naslov');
  });
});

describe('fact corrections demonstrate the AI topic handoff without pretending to save anything', () => {
  it.each([['Cena kroz AI razgovor', 'Cena'], ['Termin kroz AI razgovor', 'Termin']])('%s is a clearly marked local conversation example', async (scene, topic) => {
    await open(scene);
    expect(text()).toContain('Izmena kroz razgovor');
    expect(tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => node.props.children)).toContain(topic);
    expect(text()).toContain('isti AI razgovor');
    expect(text()).toContain('AI se ne poziva i ništa se ne menja niti šalje.');
    expectNoManualFactEditor();
    expect(labels()).not.toContain('Objavi zadatak');
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('the single AI edit action returns without changing the fixture', async () => {
    await open('Spremno za objavu');
    const original = text();
    expect(tree.root.findAll(node=>String(node.type)==='Press'&&node.props.accessibilityLabel==='Izmeni zadatak')).toHaveLength(1);
    for(const topic of ['Naslov','Cena','Termin','Broj ljudi','Opis','Alat']) expect(labels()).not.toContain(`Izmeni, ${topic}`);
    await press('Izmeni zadatak');
    expect(tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => node.props.children)).toContain('Zadatak');
    expectNoManualFactEditor();
    await press('Nazad na pregled');
    expect(text()).toBe(original);
  });

  it('an existing application deadline is read-only until an actual correction contract exists', async () => {
    await open('Rok za prijave (samo pregled)');
    expect(text()).toMatch(/Prijave do 12\. okt( \d{4})? · 12:15 \(po vremenu u Srbiji\)/);
    expectNoManualFactEditor();
    expect(tree.root.findAllByProps({ label: 'Datum roka za prijave' })).toHaveLength(0);
  });

  it('keeps map confirmation and photographs as dedicated local gallery steps', async () => {
    await open('Spremno za objavu');
    await press('Proveri tačke na mapi');
    expect(tree.root.findByType('NeedLocationForm' as React.ElementType).props.reviewOnly).toBe(true);
    expect(tree.root.findByType('NeedLocationForm' as React.ElementType).props.review.value.resolvedLocation).toBeDefined();
    await act(async () => tree.root.findByType('NeedLocationForm' as React.ElementType).props.onEditInConversation());
    expect(text()).toContain('Izmena kroz razgovor');
    expect(mockRouter.push).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
    await open('Spremno za objavu');
    await press('Izmeni, Fotografije');
    expect(text()).toContain('Fotografije zadatka');
    expect(text()).not.toContain('Izmena kroz razgovor');
  });

  it('omitted facts remain readable without per-fact editors', async () => {
    await open('Dodaj još podataka (otvoreno)');
    expect(text()).toContain('Dodaj još podataka'); expect(text()).toContain('Veštine · Vozilo · Dozvole · Bitni uslovi');
    for(const topic of ['Veštine','Vozilo','Dozvole','Bitni uslovi']) expect(labels()).not.toContain(`Izmeni, ${topic}`);
    expect(labels()).toContain('Izmeni zadatak');
    expect(text()).toMatch(/Prijave do 12\. okt( \d{4})? · 12:15 \(po vremenu u Srbiji\)/);
  });
});

describe('loading and failure', () => {
  it('loading is the skeleton of the card and no foot; failure is the one way to try again', async () => {
    await open('Učitavanje');
    expect(text()).toContain('Pripremamo pregled…'); expect(labels()).not.toContain('Objavi zadatak');
    await act(async () => tree.unmount());
    await open('Greška (bez veze)');
    expect(labels()).toContain('Pokušaj ponovo'); expect(labels()).not.toContain('Objavi zadatak');
  });
});
