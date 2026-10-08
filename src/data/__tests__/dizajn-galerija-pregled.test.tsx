import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The gallery of the publish review (`/dizajn-objava`, group "Pregled pre objave"), in the states the owner sees on his phone (UI/UX pass of
 * 2026-10-08, wave "Kalendar i pregled", agent V): the review is the task as the others will read it (the real card, then the real page that
 * opens from it) with a pencil on each part and, for the owner alone, the frame of the exact address. Each scene draws the real presentation parts
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

import DizajnObjava from '../../app/dizajn-objava';

let tree: ReactTestRenderer;
const originalDev = __DEV__;
const testRuntime = globalThis as unknown as { __DEV__: boolean };
const text = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
const labels = () => tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => String(node.props.accessibilityLabel));
const count = (word: string) => text().split(word).length - 1;
const GROUP = 'Pregled pre objave';
const open = async (scene: string) => {
  await act(async () => { tree = create(<DizajnObjava />); });
  const row = tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === `${GROUP}: ${scene}`)[0];
  expect(row).toBeDefined();
  await act(async () => row.props.onPress());
};
const PENCILS = ['Izmeni zadatak', 'Izmeni, Naslov', 'Izmeni, Cena', 'Izmeni, Mesto', 'Izmeni, Termin', 'Izmeni, Broj ljudi', 'Izmeni, Opis', 'Izmeni, Alat',
  'Izmeni, Približno mesto', 'Izmeni, Tačna adresa', 'Izmeni, Rok za prijave', 'Izmeni, Fotografije'];
beforeEach(() => { jest.clearAllMocks(); mockPackage = 'rs.uskoci.app.dev'; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = undefined as unknown as ReactTestRenderer; testRuntime.__DEV__ = originalDev; });

it('shows nothing but its refusal in a store build', async () => {
  mockPackage = 'rs.uskoci.app'; testRuntime.__DEV__ = false;
  await act(async () => { tree = create(<DizajnObjava />); });
  expect(text()).toBe('Nije dostupno.');
});

describe('a review that is ready is the task as the others read it, with a pencil on each part', () => {
  it('draws the real card, then the real page, each under its caption, and the owner\'s frame of the exact address at the end of the page', async () => {
    await open('Spremno za objavu');
    const copy = text();
    expect(copy).toContain('Ovako ga vide na mapi i u listi'); expect(copy).toContain('Ovako izgleda kad ga otvore');
    expect(copy.indexOf('Ovako ga vide na mapi i u listi')).toBeLessThan(copy.indexOf('Ovako izgleda kad ga otvore'));
    // The task is drawn twice, in the same words: the card (map and list) and the page that opens from it.
    expect(count('Prenos ormara na treći sprat bez lifta')).toBe(2); expect(count('4.500 RSD')).toBe(2); expect(count('Detelinara, Novi Sad')).toBe(2);
    expect(copy).toContain('Treba 2 osobe'); expect(copy).toContain('Objavio');
    // Who asks is the owner, as the others read him: on the card and on the page.
    expect(count('Miloš P.')).toBe(2); expect(copy).toContain('4,7');
    // The exact address is his alone, in its own frame, with the one sentence of privacy.
    expect(copy).toContain('Tačna adresa'); expect(copy).toContain('Bulevar Evrope 24, Novi Sad'); expect(copy).toContain('Vidiš samo ti. Osoba sa kojom se dogovoriš vidi je u Dogovoru.');
    // No table of facts, no "Detalji", no list of steps.
    for (const gone of ['Detalji', 'Privatni podaci', 'Vide svi', 'Korak']) expect(copy).not.toContain(gone);
  });

  it('every part has its own pencil, named for what it changes, and the only green is the publish', async () => {
    await open('Spremno za objavu');
    const named = labels();
    for (const pencil of PENCILS) expect(named).toContain(pencil);
    expect(named).toContain('Obriši nacrt'); expect(named).toContain('Objavi zadatak');
    const green = tree.root.findAll(node => String(node.type) === 'Press' && node.props.style && JSON.stringify(node.props.style).includes('#00845A'));
    expect(green.map(node => node.props.accessibilityLabel)).toEqual(['Objavi zadatak']);
  });

  it('"Tražim ponude" shows no amount anywhere, and a term nobody fixed is the word "Fleksibilno"', async () => {
    await open('Tražim ponude, bez roka');
    expect(count('Tražim ponude')).toBe(2); expect(count('Fleksibilno')).toBe(2); expect(text()).not.toContain('4.500');
    expect(text()).toContain('Bez posebnog roka');
  });
});

describe('what stands in the way, and the states in which nothing can be changed', () => {
  it('a task without a place or a price says so, draws no map and no frame, and the publish waits grey with its reason', async () => {
    await open('Još treba');
    const copy = text();
    expect(copy).toContain('Još treba'); expect(copy).toContain('Mesto na mapi nije potvrđeno.');
    expect(count('Cena nije navedena')).toBe(2); expect(count('Lokacija nije navedena')).toBe(2);
    expect(copy).not.toContain('Tačna adresa'); expect(copy).not.toContain('Približno mesto');
    expect(labels()).toContain('Dodaj mesto'); expect(labels()).not.toContain('Izmeni, Mesto');
    expect(tree.root.findByProps({ accessibilityLabel: 'Objavi zadatak' }).props.disabled).toBe(true);
    expect(copy).toContain('Prvo uradi ono što piše pod „Još treba“.');
  });

  it('while the publish runs no pencil is drawn and the delete row waits grey', async () => {
    await open('Objavljuje se');
    for (const pencil of PENCILS) expect(labels()).not.toContain(pencil);
    expect(tree.root.findByProps({ accessibilityLabel: 'Obriši nacrt' }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ accessibilityLabel: 'Objavi zadatak' }).props.accessibilityState).toEqual({ disabled: true, busy: true });
  });

  it('a stored command is read only: no pencil, no row of the deletion, no "Dodaj još podataka"', async () => {
    await open('Privatan nacrt');
    for (const pencil of PENCILS) expect(labels()).not.toContain(pencil);
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

  it('remote work says "Na daljinu" twice, and has no map, no frame of an address', async () => {
    await open('Rad na daljinu');
    expect(count('Na daljinu')).toBe(2); expect(text()).not.toContain('Tačna adresa'); expect(text()).not.toContain('Približno mesto');
  });

  it('a draft with no photographs offers the way to add them, and an owner nobody has read is not drawn as the one who asks', async () => {
    await open('Bez fotografija, bez lica');
    expect(labels()).toContain('Dodaj fotografije'); expect(labels()).not.toContain('Izmeni, Fotografije');
    expect(text()).not.toContain('Objavio'); expect(text()).not.toContain('Miloš P.');
  });

  it('long names wrap whole: nothing is cut with an ellipsis, and the page says all of them', async () => {
    await open('Dugi nazivi');
    expect(count('Prenos klavira, dve garderobe i radnog stola')).toBe(2);
    expect(text()).toContain('Pokrivači i zaštitne folije za staklena vrata');
    for (const node of tree.root.findAll(node => String(node.type) === 'T' && String(node.props.children).startsWith('Prenos klavira'))) expect(node.props.numberOfLines).toBeUndefined();
  });

  it('under a large text size the pencils keep their names and lose their word', async () => {
    await open('Spremno za objavu');
    expect(text()).toContain('Izmeni');
    await act(async () => tree.unmount());
    await open('Veliki tekst');
    expect(text()).not.toMatch(/(^| \| )Izmeni( \| |$)/); expect(labels()).toContain('Izmeni, Naslov');
  });
});

describe('a part that is being corrected is its editor, and nothing else can be pressed', () => {
  it('the price is an amount field with the tabs of its facts, and the other pencils are gone', async () => {
    await open('Izmena cene (olovka)');
    expect(labels()).toContain('Iznos u dinarima'); expect(labels()).toEqual(expect.arrayContaining(['Iznos', 'Način cene', 'Osnova cene']));
    expect(tree.root.findAllByProps({ label: 'Sačuvaj ispravku' })).toHaveLength(1); expect(tree.root.findAllByProps({ label: 'Odustani od ispravke' })).toHaveLength(1);
    expect(labels()).not.toContain('Izmeni, Naslov'); expect(labels()).not.toContain('Izmeni zadatak');
  });

  it('the time is the pickers of its start, with the tabs of its facts', async () => {
    await open('Izmena termina (olovka)');
    expect(tree.root.findAllByProps({ label: 'Početak: datum' })).toHaveLength(1); expect(labels()).toEqual(expect.arrayContaining(['Vrsta termina', 'Početak', 'Kraj']));
  });

  it('the deadline is its own editor, in the place of the deadline', async () => {
    await open('Izmena roka za prijave');
    expect(tree.root.findAllByProps({ label: 'Datum roka za prijave' })).toHaveLength(1);
    expect(text()).not.toContain('Prijave do');
  });

  it('what the page does not say yet is one row, which opens the facts as rows with their pencil', async () => {
    await open('Dodaj još podataka (otvoreno)');
    expect(text()).toContain('Dodaj još podataka'); expect(text()).toContain('Veštine · Vozilo · Dozvole · Bitni uslovi');
    expect(labels()).toEqual(expect.arrayContaining(['Izmeni, Veštine', 'Izmeni, Vozilo', 'Izmeni, Dozvole', 'Izmeni, Bitni uslovi']));
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
