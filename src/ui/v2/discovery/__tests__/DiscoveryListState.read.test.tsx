import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../../Text', () => ({ T: 'T' }));
jest.mock('../../../Press', () => ({ Press: 'Press' }));
jest.mock('../../../system/FactArt', () => ({ FactArt: 'FactArt' }));

import { DiscoveryListState } from '../DiscoveryListState';
import { QuietReadState } from '../../QuietReadState';
import { SkeletonList } from '../../../system/Skeleton';

let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const words = () => tree.root.findAllByType('T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');

test.each([false, true])('first discovery read has a useful %s map-sheet state without fabricated cards', async compact => {
  await act(async () => { tree = create(<DiscoveryListState compact={compact} state={{ kind: 'loading' }} clearAllLabel="Ukloni filtere" />); });
  expect(words()).toContain('Učitavamo zadatke…');
  expect(tree.root.findAllByType(SkeletonList)).toHaveLength(0);
  expect(tree.root.findAllByType(QuietReadState)).toHaveLength(compact ? 0 : 1);
  expect(tree.root.findAllByProps({ testID: 'discovery-list-reading' })).toHaveLength(compact ? 1 : 0);
  expect(words()).not.toMatch(/Još niko|Nema zadataka|0 zadataka/);
});
