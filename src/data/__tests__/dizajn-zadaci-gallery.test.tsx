import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockParams: Record<string, string> = {};
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  const Modal = ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  const Keyboard = { dismiss: () => undefined, isVisible: () => false };
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return Modal;
    if (key === 'Keyboard') return Keyboard;
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', SafeAreaInsetsContext: require('react').createContext(null) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useIsFocused: () => true }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
// The whole screen is the presentation's own suite (`discovery-presentation`); the gallery's part is what it hands to it.
jest.mock('../../ui/v2/DiscoveryPresentation', () => ({ DiscoveryPresentation: 'Discovery' }));
jest.mock('../../ui/v2/TaskPublisherPortrait', () => ({ TaskPublisherPortrait: 'TaskPublisherPortrait' }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: async () => null, setItem: async () => undefined }));
import DizajnZadaci from '../../app/dizajn-zadaci';
import { publicPoint } from '../marketplaceView';
import type { DiscoveryPresentationProps } from '../../ui/v2/DiscoveryPresentation';

/**
 * The gallery of Zadaci (`/dizajn-zadaci?scene=...`) is what the design lab and the internal build photograph, so every scene of the map, the list, the search and the filters
 * has to mount, say what it is for, and not take the others down. The detail scenes belong to the task's page and are looked at there.
 */
let tree: ReactTestRenderer;
const render = async (params: Record<string, string>) => { mockParams = params; await act(async () => { tree = create(<DizajnZadaci />); }); };
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter((child): child is string => typeof child === 'string')).join(' | ');
const labels = () => tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => String(node.props.accessibilityLabel));
const discovery = () => tree.root.findByType('Discovery' as React.ElementType).props as DiscoveryPresentationProps;
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => undefined); jest.spyOn(console, 'warn').mockImplementation(() => undefined); mockParams = {}; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

describe('the cards', () => {
  test('every state of the list card, with the small mark of what the account is to the task and no label above the title', async () => {
    await render({ scene: 'kartice' });
    expect(texts()).toContain('Unos ormara na treći sprat'); expect(texts()).toContain('Tražim ponude');
    expect(texts()).toContain('Prijava poslata'); expect(texts()).toContain('Tvoj');
    expect(texts()).not.toContain('Tvoj zadatak');
    // nobody has said where they are: no distance
    expect(texts()).not.toMatch(/ km/);
  });

  test('with the person\'s position known each card on the map says how far the task is, and a task done remotely says none', async () => {
    await render({ scene: 'kartice', near: '1' });
    expect(texts()).toMatch(/Liman, Novi Sad · manje od 1 km/); expect(texts()).toMatch(/Grbavica, Novi Sad · oko 2 km/); expect(texts()).toMatch(/Telep, Novi Sad · oko 3 km/);
    expect(texts()).toContain('Na daljinu');
    expect(texts().match(/ km/g)).toHaveLength(5);
  });

  test('the same cards at large text, and the card of a chosen pin with and without the distance', async () => {
    await render({ scene: 'kartice-veliki' });
    expect(texts()).toContain('Tvoj');
    await act(async () => tree.unmount());
    await render({ scene: 'kartica-na-mapi' });
    expect(labels().some(label => /^Otvori zadatak: Unos ormara/.test(label))).toBe(true); expect(texts()).not.toMatch(/ km/);
    await act(async () => tree.unmount());
    await render({ scene: 'kartica-na-mapi', near: '1' });
    expect(texts()).toMatch(/Liman, Novi Sad · manje od 1 km/);
    await act(async () => tree.unmount());
    await render({ scene: 'kartica-na-mapi-dugo', near: '1' });
    expect(texts()).toContain('Prijava poslata'); expect(texts()).toMatch(/Grbavica, Novi Sad · oko 2 km/);
  });
});

describe('the map and the list', () => {
  test('lista hands the whole screen a list of the shapes the real one meets: mapped, remote and placed nowhere', async () => {
    await render({ scene: 'lista', n: '8' });
    const props = discovery();
    expect(props.items).toHaveLength(8); expect(props.loading).toBe(false); expect(props.error).toBe(false);
    // "a list of eight has three that are not on the map"
    expect(props.items.filter(item => !publicPoint(item))).toHaveLength(3);
    expect(props.forMeAvailable).toBe(true); expect(props.view.forMe).toBeUndefined();
    await act(async () => tree.unmount());
    await render({ scene: 'lista' });
    expect(discovery().items).toHaveLength(6);
  });

  test.each([['lista-prazno', { items: 0, loading: false, error: false }], ['lista-ucitavanje', { items: 0, loading: true, error: false }],
    ['lista-greska', { items: 0, loading: false, error: true }]])('%s is the state of the list that it names', async (scene, expected) => {
    await render({ scene });
    const props = discovery();
    expect({ items: props.items.length, loading: props.loading, error: props.error }).toEqual(expected);
  });

  test('"Za mene" is on in lista-za-mene, and refused in lista-za-mene-odbijeno (no active work profile)', async () => {
    await render({ scene: 'lista-za-mene' });
    expect(discovery().view.forMe).toBe(true); expect(discovery().forMeRefused).toBeFalsy();
    await act(async () => tree.unmount());
    await render({ scene: 'lista-za-mene-odbijeno' });
    expect(discovery().forMeRefused).toBe(true);
  });

  test('lista takes the height of the sheet and the pin whose card stands at the bottom; a pin or a height that is not one is ignored', async () => {
    await render({ scene: 'lista', n: '8', sheet: 'half' });
    expect(discovery().view.sheet).toBe('half'); expect(discovery().view.selectedId).toBeNull();
    await act(async () => tree.unmount());
    await render({ scene: 'lista', n: '8', pin: 'm1' });
    expect(discovery().view).toMatchObject({ selectedId: 'm1', sheet: 'peek' });
    await act(async () => tree.unmount());
    await render({ scene: 'lista', n: '8', pin: 'drop table', sheet: 'huge' });
    expect(discovery().view.selectedId).toBeNull(); expect(discovery().view.sheet).toBeUndefined();
  });
});

describe('the search and the filters', () => {
  test('pretraga is the search that fills the screen: the field, the cities with their counts and what was searched before, and none of the filters', async () => {
    await render({ scene: 'pretraga' });
    expect(labels()).toContain('Zatvori pretragu'); expect(labels()).toContain('Šta tražiš');
    expect(texts()).toContain('Skorašnje pretrage');
    expect(labels()).toContain('Novi Sad, 23 zadatka'); expect(labels()).toContain('Na daljinu');
    expect(texts()).not.toMatch(/Kada|Iznos/);
  });

  test('pretraga-sta has a word typed already', async () => {
    await render({ scene: 'pretraga-sta' });
    const field = tree.root.find(node => String(node.type) === 'TextInput');
    expect(field.props.value).toBe('selidba');
  });

  test.each(['filteri', 'pretraga-kada'])('%s is the sheet of the filters: Kada, Iznos and the foot with the real number', async scene => {
    await render({ scene });
    expect(labels()).toContain('Zatvori filtere'); expect(texts()).toContain('Kada'); expect(texts()).toContain('Iznos');
    expect(tree.root.findAllByType('Action' as React.ElementType).map(action => action.props.label)).toEqual(['Očisti', 'Prikaži 41 zadatak']);
  });

  test('filteri-izabrano has a day and an amount chosen', async () => {
    await render({ scene: 'filteri-izabrano' });
    const chosen = tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'radio' && node.props.accessibilityState?.checked)
      .map(node => node.props.accessibilityLabel);
    expect(chosen).toEqual(expect.arrayContaining(['Ovaj vikend', 'Sa iznosom']));
  });
});
