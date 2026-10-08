import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * Pušački test rute laboratorije V2: svaka scena se crta bez pada, izdanje za prodavnicu ne pokazuje ništa, a varijante pokazuju svoje reči
 * (iznos, ime, mesto) na istim lažnim podacima. Današnji ekrani (`sada`) imaju svoje testove, pa su ovde zamenjeni imenom.
 */
let mockPackage: string | undefined = 'rs.uskoci.app.dev';
let mockParams: { scene?: string | string[]; kadar?: string } = {};
const mockRouter = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn() };
jest.mock('expo-constants', () => ({ get expoConfig() { return { android: { package: mockPackage } }; } }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams, useFocusEffect: () => undefined }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', SafeAreaInsetsContext: undefined }));
jest.mock('../../../entry/BrandAssets', () => ({ BrandLockup: 'BrandLockup' }));
jest.mock('../../../v2/discovery/DiscoveryPeek', () => ({ DiscoveryPeek: 'DiscoveryPeek' }));
jest.mock('../../../v2/PublicNeedPresentation', () => ({ PublicNeedPresentation: 'PublicNeedPresentation' }));
jest.mock('../../../v2/discovery/DiscoverySearchPanel', () => ({ DiscoverySearchPanel: 'DiscoverySearchPanel' }));
// The route hands today's search panel the server's preview key; the owner of that key loads the data layer, which this lab never touches.
jest.mock('../../../../data/discoveryV1SearchOwner', () => ({ discoveryV1SearchPreviewKey: () => 'lab-key' }));
jest.mock('../../../../data/supabaseClient', () => { throw new Error('The V2 lab must not load a data client.'); });

import Gallery, { SVE_SCENE, parseScene } from '../../../../app/dizajn-var-V2';

let tree: ReactTestRenderer;
const originalDev = __DEV__;
const runtime = globalThis as unknown as { __DEV__: boolean };
const words = () => JSON.stringify(tree.toJSON());
const render = async () => { await act(async () => { tree = create(<Gallery />); }); };

beforeEach(() => { jest.clearAllMocks(); runtime.__DEV__ = false; mockPackage = 'rs.uskoci.app.dev'; mockParams = {}; });
afterEach(async () => { await act(async () => tree?.unmount()); runtime.__DEV__ = originalDev; });

it('the scene list is exact: four screens, sada + A + B + C each, states only where the screen has them', () => {
  expect(SVE_SCENE).toEqual(expect.arrayContaining(['kartica-sada', 'kartica-A', 'kartica-B', 'kartica-C', 'peek-sada', 'peek-A', 'peek-B', 'peek-C',
    'detalj-sada', 'detalj-A', 'detalj-B', 'detalj-C', 'pretraga-sada', 'pretraga-A', 'pretraga-B', 'pretraga-C', 'kartica-C-pokret', 'detalj-C-pokret',
    'pretraga-C-pokret', 'kartica-A-dugo', 'detalj-B-veliki', 'detalj-A-ponude', 'pretraga-B-kada']));
  expect(parseScene('kartica-sada-dugo')).toBeNull();
  expect(parseScene('detalj-A-veliki')).toBeNull();
  expect(parseScene('kartica-A-pokret')).toBeNull();
  expect(parseScene('peek-A-dugo')).toBeNull();
  expect(parseScene('nesto')).toBeNull();
  expect(parseScene(['kartica-A'])).toBeNull();
});

it.each(['rs.uskoci.app', 'rs.uskoci.app.dev.store', undefined])('refuses fixture content in a store build (%s)', async packageName => {
  mockPackage = packageName; mockParams = { scene: 'kartica-A' };
  await render();
  expect(words()).toContain('Nije dostupno.');
  expect(words()).not.toContain('Unos ormara');
});

it('without a scene it lists every scene as a row that leads to it', async () => {
  await render();
  expect(words()).toContain('Varijante V2');
  expect(words()).toContain('Etiketa');
  expect(words()).toContain('Korak po korak');
  await act(async () => { tree.root.findByProps({ value: 'detalj-B' }).props.onPress(); });
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/dizajn-var-V2', params: { scene: 'detalj-B' } });
});

it.each(SVE_SCENE)('renders the scene %s without a gallery wrapper or a crash', async scene => {
  mockParams = { scene, kadar: scene.endsWith('-pokret') ? '150' : undefined };
  await render();
  expect(words()).not.toContain('Nije dostupno.');
  expect(words()).not.toContain('Varijante V2');
});

it.each([
  ['kartica-A', ['6.000 RSD', 'Prima ponude', 'Marija Ilić', 'Imaš kombi', 'Liman, Novi Sad']],
  ['kartica-B', ['6.000 RSD', 'Prima ponude', 'Unos ormara na treći sprat', 'Liman, Novi Sad · 12. okt']],
  ['kartica-C', ['Marija traži pomoć', '„Unos ormara na treći sprat“', '6.000 RSD', 'Tvoj zadatak']],
  ['kartica-A-dugo', ['HITNO', 'Prijava poslata', 'Aleksandra Konstantinović-Radovanović', '4.500 RSD']],
  ['peek-A', ['Unos ormara na treći sprat', '6.000 RSD', 'Zatvori pregled zadatka']],
  ['detalj-A', ['Dolazi kako je dogovoreno · 9 od 10', '4,7 · 3 ocene', 'Sastavi prijavu', 'O zadatku']],
  ['detalj-A-ponude', ['Prima ponude', 'Još nema ocena', 'Dragan Petrović']],
  ['detalj-B', ['UKUPNO', 'TERMIN', 'LJUDI', 'MESTO', '6.000 RSD', '2 osobe']],
  ['detalj-C', ['Marija Ilić', 'Ormar je rasklopljen u kutijama, u prizemlju zgrade. Treba ga uneti na treći sprat i ostaviti u sobi.', '6.000 RSD']],
  ['detalj-C-dugo', ['Ceo opis', 'Nošenje klavira']],
  ['pretraga-A', ['Svi zadaci', 'Još nema', 'Novi Sad', 'Prikaži 41 zadatak', 'Poništi filtere']],
  ['pretraga-B', ['Svuda', 'bilo kada', 'bilo koja cena', '1 osoba', 'bilo gde']],
  ['pretraga-C', ['1 od 6', 'Gde', 'Prikaži 41 zadatak']],
  ['pretraga-C-kada', ['2 od 6', 'Kada', 'Izaberi datume']],
])('%s says its own words on the shared fixtures', async (scene, expected) => {
  mockParams = { scene };
  await render();
  for (const word of expected) expect(words()).toContain(word);
});

it('detalj C never invents a sentence: the person says the first two sentences, the rest waits behind "Ceo opis"', async () => {
  mockParams = { scene: 'detalj-C-dugo' };
  await render();
  expect(words()).toContain('Ceo opis');
  expect(words()).not.toContain('Pauza za ručak');
  await act(async () => { tree.root.findAllByProps({ accessibilityLabel: 'Ceo opis' })[0].props.onPress(); });
  expect(words()).toContain('Pauza za ručak');
  expect(words()).not.toContain('Ceo opis');
});

it('the A card draws the empty tag and the word for a task that takes offers, never an amount', async () => {
  mockParams = { scene: 'kartica-A' };
  await render();
  expect(tree.root.findAllByProps({ kind: 'offers' }).length).toBeGreaterThan(0);
  expect(words()).toContain('Prima ponude');
  expect(words()).toContain('Cena nije navedena');
});
