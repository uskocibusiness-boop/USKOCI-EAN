import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The application and rating gallery (round 6, unit prijava) draws every scene from fixtures, reads nothing, writes
// nothing, and returns to its list.
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci.app.dev' } } }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
let mockParams: { scene?: string } = {};
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), navigate: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('../reviewsClientService', () => { throw new Error('the gallery must not reach a data service'); });
jest.mock('../applicationSelectionClientService', () => { throw new Error('the gallery must not reach a data service'); });
jest.mock('../applicationCommandJournal', () => { throw new Error('the gallery must not reach a data service'); });
jest.mock('../supabaseClient', () => { throw new Error('the gallery must not reach a data service'); });

import DizajnPrijava from '../../app/dizajn-prijava';
import { AUTH_GALLERY_SCENES } from '../../ui/auth/AuthGallery';

let tree: ReactTestRenderer;
const pressHost = async (label: string) => {
  await act(async () => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityLabel === label)[0].props.onPress());
};
const text = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
afterEach(async () => { if (tree) await act(async () => tree.unmount()); mockParams = {}; });
const AUTH_LABELS = new Set<string>(AUTH_GALLERY_SCENES.map(([, label]) => `Galerija: ${label}`));

it('opens every scene by its visible label and comes back with "Nazad na listu scena"', async () => {
  await act(async () => { tree = create(<DizajnPrijava />); });
  const labels = tree.root.findAll(node => node.type === ('Press' as React.ElementType) && String(node.props.accessibilityLabel).startsWith('Galerija: '))
    .map(node => String(node.props.accessibilityLabel));
  expect(labels).toHaveLength(28 + AUTH_GALLERY_SCENES.length);
  for (const label of labels.filter(label => !AUTH_LABELS.has(label))) {
    await pressHost(label);
    // The scene replaces the list: none of the list's rows is left on screen.
    expect(tree.root.findAll(node => node.type === ('Press' as React.ElementType) && String(node.props.accessibilityLabel).startsWith('Galerija: '))).toHaveLength(0);
    await pressHost('Nazad na listu scena');
    expect(text()).toContain(label.slice('Galerija: '.length));
  }
}, 60000);

it('draws the composer, its review and the sent state, and the rating with its person', async () => {
  await act(async () => { tree = create(<DizajnPrijava />); });
  await pressHost('Galerija: Pregled pre slanja');
  expect(text()).toContain('Ovo šalješ'); expect(text()).toContain('4.500 RSD');
  await pressHost('Nazad na listu scena');
  await pressHost('Galerija: Prijava poslata');
  expect(text()).toContain('Prijava je poslata.');
  await pressHost('Nazad na listu scena');
  await pressHost('Galerija: Ocena: izbor');
  expect(text()).toContain('Nikola Petrović'); expect(text()).toContain('Kako je prošla saradnja?');
  await pressHost('Ocena 4 od 5'); expect(text()).toContain('Vrlo dobro');
  // The scene's own back arrow also returns to the list.
  await pressHost('Nazad na Dogovor'); expect(text()).toContain('Ocena: sačuvana');
});

// --- The sign-in screens (F7, 2026-10-08) -------------------------------------------------------------------------------------
describe('the group "Ulaz i prijava na nalog"', () => {
  /** The ways out a sign-in scene has: the arrow in its bar, the screens' own exits, and the answers of the question before a permission. */
  const EXITS = ['Nazad', 'Nazad na prijavu', 'Odjavi se sa ovog uređaja', 'Ne sada'];
  const exit = async () => {
    const node = tree.root.findAll(candidate => candidate.type === ('Press' as React.ElementType) && EXITS.includes(String(candidate.props.accessibilityLabel)))[0];
    await act(async () => node.props.onPress());
  };
  const rows = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && AUTH_LABELS.has(String(node.props.accessibilityLabel)));
  const inputs = () => tree.root.findAll(node => node.type === ('TextInput' as React.ElementType)).map(node => node.props.accessibilityLabel);
  const open = async (label: string) => { await act(async () => { tree = create(<DizajnPrijava />); }); await pressHost(`Galerija: ${label}`); };

  it('lists the scenes first, under their own heading, and the application and rating scenes after them', async () => {
    await act(async () => { tree = create(<DizajnPrijava />); });
    expect(rows()).toHaveLength(AUTH_GALLERY_SCENES.length);
    expect(AUTH_GALLERY_SCENES.length).toBeGreaterThanOrEqual(26);
    const headings = tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.variant === 'bodyStrong').map(node => node.children.join(''));
    expect(headings).toEqual(['Ulaz i prijava na nalog', 'Prijava na zadatak i ocena']);
  });

  it('draws every sign-in scene with its real components and comes back to the list', async () => {
    await act(async () => { tree = create(<DizajnPrijava />); });
    for (const [, label] of AUTH_GALLERY_SCENES) {
      await pressHost(`Galerija: ${label}`);
      expect([label, rows().length]).toEqual([label, 0]);
      expect([label, text().length > 0]).toEqual([label, true]);
      await exit();
      expect([label, text()]).toEqual([label, expect.stringContaining('Ulaz: prijava')]);
    }
  }, 60000);

  it('the first step in every state: fields with their label, the one green command in the foot, and what is wrong said under the form or the field', async () => {
    await open('Ulaz: prijava');
    expect(inputs()).toEqual(['Email', 'Lozinka']); expect(text()).toContain('Prijavi se ili napravi nalog'); expect(text()).toContain('Zaboravljena lozinka?');
    await exit();
    await pressHost('Galerija: Ulaz: registracija');
    expect(inputs()).toEqual(['Ime', 'Prezime', 'Grad', 'Email', 'Lozinka']); expect(text()).toContain('Tražiš pomoć'); expect(text()).toContain('Najmanje 6 znakova.');
    await exit();
    await pressHost('Galerija: Ulaz: greške u poljima (prijava)');
    expect(text()).toContain('Unesi email.'); expect(text()).toContain('Unesi lozinku.');
    await exit();
    await pressHost('Galerija: Ulaz: pogrešna lozinka');
    expect(text()).toContain('Prijava nije uspela. Proveri email i lozinku i pokušaj ponovo.');
    await exit();
    await pressHost('Galerija: Ulaz: email nije potvrđen');
    expect(text()).toContain('Pošalji ponovo potvrdu');
    await exit();
    await pressHost('Galerija: Ulaz: registracija nije prošla');
    expect(text()).toContain('Možda već imaš nalog.');
  });

  it('a failed check of the available ways in is a quiet note under a form that is all there', async () => {
    await open('Ulaz: provera načina prijave nije uspela');
    expect(inputs()).toEqual(['Email', 'Lozinka']);
    expect(text()).toContain('Dodatne načine prijave nismo uspeli da proverimo.'); expect(text()).toContain('Pokušaj ponovo');
    expect(text()).not.toContain('Ne možemo da proverimo dostupne načine prijave');
  });

  it('the keyboard scene stands the sheet on a column that is a keyboard shorter', async () => {
    await open('Ulaz: tastatura otvorena (prijava)');
    expect(text()).toContain('tastatura'); expect(inputs()).toEqual(['Email', 'Lozinka']); expect(text()).toContain('Prijavi se');
  });

  it('every scene can be opened directly by its key', async () => {
    mockParams = { scene: 'ulaz-nema-veze' };
    await act(async () => { tree = create(<DizajnPrijava />); });
    expect(text()).toContain('Ne možemo da se povežemo, pa prijava nije uspela. Proveri vezu i pokušaj ponovo.');
    mockParams = { scene: 'ponude' };
    await act(async () => { tree.unmount(); tree = create(<DizajnPrijava />); });
    // Only the sign-in scenes are opened by a key: the others keep the list as their way in.
    expect(rows().length).toBe(AUTH_GALLERY_SCENES.length);
  });
});
