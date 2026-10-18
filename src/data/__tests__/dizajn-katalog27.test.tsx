import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockPackage: string | undefined = 'rs.uskoci';
let mockFocused = true;
jest.mock('expo-constants', () => ({ __esModule: true, default: {
  get expoConfig() { return { android: { package: mockPackage } }; },
} }));
jest.mock('expo-router', () => ({ router: { canGoBack: () => false, replace: jest.fn(), back: jest.fn() },
  useFocusEffect: (fn: () => unknown) => require('react').useEffect(() => mockFocused ? fn() : undefined, [fn, mockFocused]),
}));
jest.mock('../../ui/system/CatalogArt', () => ({ CatalogArt: 'CatalogArt' }));
jest.mock('../../ui/system/CatalogMoment', () => ({ CatalogMoment: 'CatalogMoment' }));
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsScreen: 'SettingsScreen', SettingsText: 'T', SettingsAction: 'SettingsAction' }));
import DizajnKatalog27 from '../../designLab/dizajn-katalog27';
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });

it.each(['rs.uskoci', 'rs.uskoci.preview', 'unrelated.dev', undefined])(
  'refuses package %s even in a development JavaScript runtime', async packageName => {
  mockPackage = packageName;
  await act(async () => { tree = create(<DizajnKatalog27 />); });
  expect(tree.root.findAllByType('CatalogMoment' as React.ElementType)).toHaveLength(0);
  expect(tree.root.findByType('T' as React.ElementType).props.children).toBe('Nije dostupno.');
});

it('the .dev trial has no event until an explicit tap and owns blur', async () => {
  mockPackage = 'rs.uskoci.dev'; mockFocused = true;
  await act(async () => { tree = create(<DizajnKatalog27 />); });
  const moment = () => tree.root.findByType('CatalogMoment' as React.ElementType).props;
  expect(moment()).toMatchObject({ event: null, focused: true });
  await act(async () => tree.root.findByType('SettingsAction' as React.ElementType).props.onPress());
  expect(moment().event).toBe(1);
  mockFocused = false;
  await act(async () => tree.update(<DizajnKatalog27 />));
  expect(moment()).toMatchObject({ event: 1, focused: false });
});
