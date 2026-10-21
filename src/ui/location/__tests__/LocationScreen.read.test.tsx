import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'KeyboardAvoidingView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../system/DetailTopBar', () => ({ DetailTopBar: 'DetailTopBar' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'Button' }));

import { LocationScreen } from '../LocationControls';
import { QuietReadState } from '../../v2/QuietReadState';
import { SkeletonList } from '../../system/Skeleton';

let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const words = () => tree.root.findAllByType('T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');

test('location read keeps Back and waits for saved points before showing the confirmation form', async () => {
  const back = jest.fn(), retry = jest.fn();
  await act(async () => { tree = create(<LocationScreen title="Proveri tačke na mapi" onBack={back} loading onRetry={retry}>
    <React.Fragment key="form">location-form</React.Fragment>
  </LocationScreen>); });
  expect(tree.root.findByType('DetailTopBar' as React.ElementType).props.onBack).toBe(back);
  expect(tree.root.findAllByType(QuietReadState)).toHaveLength(1);
  expect(words()).toContain('Učitavamo sačuvanu lokaciju…');
  expect(tree.root.findAllByType(SkeletonList)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('location-form');
  await act(async () => { tree.update(<LocationScreen title="Proveri tačke na mapi" onBack={back} loading={false} onRetry={retry}>
    <React.Fragment key="form">location-form</React.Fragment>
  </LocationScreen>); });
  expect(tree.root.findAllByType(QuietReadState)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('location-form');
});
