import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

// The phone of the owner at ordinary text (361 dp, text scale 1): the window the gallery's `&veliki=1` has to change, because a gallery cannot change the
// system's font. (Under Jest's own window the text scale is 2 and every layout is already stacked, so nothing would show.)
let mockParams: { scene?: string; stanje?: string; veliki?: string } = {};
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 361, height: 800, scale: 3, fontScale: 1 });
    return Reflect.get(target, key);
  } });
});
jest.mock('expo-constants', () => ({ get expoConfig() { return { android: { package: 'rs.uskoci.app.dev' } }; } }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock('../../../data/supabaseClient', () => { throw new Error('The system gallery must not load a data client.'); });
jest.mock('../../../store/uloga', () => { throw new Error('The system gallery must not read account data.'); });

import Gallery from '../../../app/dizajn-sistem';
import { OfflineLine } from '../OfflineLine';
import { Section } from '../Section';

/**
 * `&veliki=1` draws any scene of the system gallery as the phone draws it at text scale 1.3 (UI/UX pass 2026-10-08, F8b): the components are told
 * "large", so a strip puts its word under its sentence and a section its action under its title, which at 361 dp and scale 1 they do not.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const render = async () => { await act(async () => { tree = create(<Gallery />); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const stripLine = () => tree.root.findByType(OfflineLine).findAll(node => typeof node.type === 'string' && node.props.accessibilityLiveRegion === 'polite')[0];

it('draws the strip of "no connection" with its word beside its sentence at ordinary text, and under it with `&veliki=1`', async () => {
  mockParams = { scene: 'stanja', stanje: 'bez-veze-traka' }; await render();
  expect(flat(stripLine()).flexDirection).toBe('row');
  await act(async () => tree.unmount());
  mockParams = { scene: 'stanja', stanje: 'bez-veze-traka', veliki: '1' }; await render();
  expect(flat(stripLine()).flexDirection).toBe('column');
});

it('does the same for a scene that is not a state scene: `?scene=redovi&veliki=1` stacks a section\'s action under its title', async () => {
  const sectionHead = () => tree.root.findAllByType(Section).find(candidate => candidate.props.action)!.findAll(node => typeof node.type === 'string' && flat(node).flexDirection !== undefined)[0];
  mockParams = { scene: 'redovi' }; await render();
  expect(flat(sectionHead()).flexDirection).toBe('row');
  await act(async () => tree.unmount());
  mockParams = { scene: 'redovi', veliki: '1' }; await render();
  expect(flat(sectionHead()).flexDirection).toBe('column');
});

it('takes an address parameter that the router hands over as a list as its first word', async () => {
  (mockParams as Record<string, unknown>) = { scene: ['stanja', 'redovi'], stanje: ['bez-veze-traka'], veliki: ['1'] }; await render();
  expect(flat(stripLine()).flexDirection).toBe('column');
});
