import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return key === 'View' ? 'View' : Reflect.get(target, key); } });
});
jest.mock('../../Text', () => ({ T: 'T' }));

import { GroupHeader } from '../GroupHeader';

/**
 * The name of a group in a list of records (composition spec 4.8, 4.10): the Dogovori, the Raspored and the Arhiva draw it one way - the
 * `bodyStrong` type in ink, 24 above it (the 12 between two cards and its own 12), what it holds under it when there is something to count.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const draw = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const frame = () => StyleSheet.flatten(tree.root.findByType('View' as unknown as React.ElementType).props.style) ?? {};

it('is one heading with the type of a group title, and 12 of its own above it', async () => {
  await draw(<GroupHeader title="Čeka tebe" />);
  const title = tree.root.findByType('T' as unknown as React.ElementType);
  expect(title.props).toMatchObject({ accessibilityRole: 'header', variant: 'bodyStrong' });
  expect(title.children).toEqual(['Čeka tebe']);
  expect(frame().paddingTop).toBe(12);
});

it('has nothing above it when it is the first of the list, which has its own space under the controls', async () => {
  await draw(<GroupHeader title="Čeka tebe" first />);
  expect(frame().paddingTop).toBeUndefined();
});

it('says what the group holds in a quiet line under the title, and draws no line when it has no count', async () => {
  await draw(<GroupHeader title="Bez tačnog termina" count="1 Dogovor · 2 zadatka" />);
  expect(tree.root.findAllByType('T' as unknown as React.ElementType).map(node => node.children.join(''))).toEqual(['Bez tačnog termina', '1 Dogovor · 2 zadatka']);
  await act(async () => tree.unmount());
  await draw(<GroupHeader title="Danas" />);
  expect(tree.root.findAllByType('T' as unknown as React.ElementType)).toHaveLength(1);
});
