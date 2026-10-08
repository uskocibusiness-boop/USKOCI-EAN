import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The four galleries of the family "Moji zadaci, Prijave, Kandidati" (UI/UX pass 2026-10-08, F3): the list of my tasks, my applications,
 * the applications that came to my task, and the form of an application. Each draws the real presentation with fixture data, reads and
 * writes nothing, opens a scene by its address (`?scene=`), and refuses to show anything in a store build.
 */
let mockPackage: string | undefined = 'rs.uskoci.app.dev';
let mockParams: { scene?: string | string[] } = {};
const mockRouter = { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn(), navigate: jest.fn() };
jest.mock('expo-constants', () => ({ get expoConfig() { return { android: { package: mockPackage } }; } }));
jest.mock('expo-router', () => ({ router: mockRouter, useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  const Modal = ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  const FlatList = (props: any) => React.createElement('FlatList', props, props.ListHeaderComponent,
    ...(props.data.length ? props.data.map((item: any, index: number) =>
      React.createElement(React.Fragment, { key: props.keyExtractor ? props.keyExtractor(item) : index }, props.renderItem({ item, index }))) : [props.ListEmptyComponent]),
    props.ListFooterComponent);
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'Modal') return Modal;
    if (key === 'FlatList') return FlatList;
    if (key === 'Keyboard') return { dismiss: jest.fn(), addListener: () => ({ remove: () => {} }) };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar' }));
// A gallery never reaches a data service: any of these would throw the moment a scene imported it.
jest.mock('../supabaseClient', () => { throw new Error('a gallery must not load a data client'); });
jest.mock('../applicationSelectionClientService', () => { throw new Error('a gallery must not reach a data service'); });
jest.mock('../applicationCommandJournal', () => { throw new Error('a gallery must not reach a data service'); });
jest.mock('../../store/uloga', () => { throw new Error('a gallery must not read account data'); });

import MojiZadaci from '../../app/dizajn-moji-zadaci';
import Prijave from '../../app/dizajn-prijave';
import Kandidati from '../../app/dizajn-kandidati';
import PrijavaForma from '../../app/dizajn-prijava-forma';

let tree: ReactTestRenderer;
const originalDev = __DEV__;
const testRuntime = globalThis as unknown as { __DEV__: boolean };
const text = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const press = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0];
const scene = async (Gallery: React.ComponentType, key: string) => {
  mockParams = { scene: key };
  if (tree) await act(async () => tree.unmount());
  await act(async () => { tree = create(<Gallery />); });
};
const stripLabels = () => tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith('Galerija: '))
  .map(node => String(node.props.accessibilityLabel).slice('Galerija: '.length));
beforeEach(() => { jest.clearAllMocks(); mockPackage = 'rs.uskoci.app.dev'; mockParams = {}; });
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = undefined as unknown as ReactTestRenderer; testRuntime.__DEV__ = originalDev;
});

it.each([['Moji zadaci', MojiZadaci], ['Moje prijave', Prijave], ['Kandidati', Kandidati], ['Forma prijave', PrijavaForma]] as const)(
  '%s: a store build shows nothing but its refusal, whatever the scene says', async (_name, Gallery) => {
    // The internal build is the development runtime or the package that ends in ".dev"; a store package outside the runtime shows nothing.
    mockPackage = 'rs.uskoci.app'; testRuntime.__DEV__ = false;
    await scene(Gallery, 'lista');
    expect(text()).toBe('Nije dostupno.');
  });

describe('Moji zadaci', () => {
  it.each([
    ['lista', ['Moji zadaci', '5 zadataka', 'Montaža dve police u hodniku', 'Imaš 3 prijave. Uporedi ih i izaberi.']],
    ['puno', ['12 zadataka']],
    ['dugi', ['3 zadatka', 'Prenos starog trokrilnog ormara']],
    ['nacrti', ['Pomoć oko bašte', 'Prenos ormara']],
    ['istorija', ['Farbanje ograde', 'Nošenje peska u dvorište']],
    ['prazno', ['Objavi prvi zadatak']],
    ['ucitavanje', ['Učitavamo zadatke']],
    ['greska', ['Ne možemo da učitamo zadatke']],
    ['veliki', ['Moji zadaci', '8 zadataka']],
    ['stranice', ['Prikaži još']],
  ])('draws the scene %s from its address', async (key, expected) => {
    await scene(MojiZadaci, key);
    for (const words of expected) expect(text()).toContain(words);
  });

  it('opens every scene from its chip and says what a press on a card would do, without doing it', async () => {
    await scene(MojiZadaci, 'lista');
    for (const label of stripLabels()) {
      await act(async () => press(`Galerija: ${label}`).props.onPress());
      expect(press(`Galerija: ${label}`).props.accessibilityState).toEqual({ selected: true });
    }
    expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});

describe('Moje prijave', () => {
  it.each([
    ['lista', ['Moje prijave', 'Montaža police u hodniku', 'Poslata']],
    ['dugi', ['Prenos starog trokrilnog ormara']],
    ['prazno', []],
    ['ucitava', ['Učitavamo tvoje prijave']],
    ['greska', ['Pokušaj ponovo za trenutak.']],
    ['veliki', ['Montaža police u hodniku', 'Selidba kancelarije sa arhivom']],
    ['pregled', ['Trenutni uslovi zadatka']],
  ])('draws the scene %s from its address', async (key, expected) => {
    await scene(Prijave, key);
    for (const words of expected) expect(text()).toContain(words);
  });
});

describe('Kandidati', () => {
  it.each([
    ['lista', ['Milan Petrović', 'Ana Jovanović', '4.500 RSD', 'Ima: Kombi · Trake za nošenje', 'Slobodna mesta: 3 od 3']],
    ['dugacka', ['Aleksandra Stefanović-Radosavljević']],
    ['veliki', ['Milan Petrović']],
    ['prazno', ['Još nema prijava']],
    ['ucitavanje', ['Učitavamo prijave']],
    ['greska', ['Prijave trenutno nije moguće učitati']],
    ['ponuda', ['Izaberi ovu prijavu', 'Poruka', 'Pogledaj profil']],
    ['ponuda-veliki', ['Izaberi ovu prijavu', 'Poruka']],
    ['ne-moze', ['Zadatak je izmenjen. Čekamo da osoba potvrdi prijavu.']],
    ['ishod', ['Proveri da li je izabrano']],
    ['ponovi', ['Pošalji izbor ponovo']],
    ['sklopljen', ['Otvori Dogovor']],
    ['profil', ['Prijavi ili blokiraj osobu']],
  ])('draws the scene %s from its address', async (key, expected) => {
    await scene(Kandidati, key);
    for (const words of expected) expect(text()).toContain(words);
  });
});

describe('Forma prijave', () => {
  it.each([
    ['prazna', ['Tvoja ponuda', 'Koliko vas dolazi', 'Termin', 'Poruka uz prijavu', 'Upiši svoju cenu da pregledaš prijavu.']],
    ['ponuda', ['Pregledaj prijavu', '4.500 RSD ukupno']],
    ['veliko', ['Pregledaj prijavu']],
    ['pregled', ['Ovo šalješ', 'Pošalji ovu prijavu']],
    ['pregled-veliko', ['Ovo šalješ', 'Pošalji ovu prijavu']],
    ['po-osobi', ['Cena zadatka']],
    ['bez-cene', ['Zadatak nema navedenu cenu. Osveži zadatak.']],
    ['profil', ['Radni profil još nije aktivan', 'Dopuni radni profil']],
    ['ishod', ['Proveri da li je poslato']],
    ['poslato', ['Prijava je poslata.']],
    ['dugo', ['Pomoć oko selidbe dvosobnog stana']],
  ])('draws the scene %s from its address', async (key, expected) => {
    await scene(PrijavaForma, key);
    for (const words of expected) expect(text()).toContain(words);
  });
});
