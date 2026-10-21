import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ProductSheet } from '../../product/ProductSheet';
import { sys } from '../tokens';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), mockReact = require('react');
  const Modal = ({ visible, children, ...props }: any) => visible ? mockReact.createElement('Modal', props, children) : null;
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return Modal;
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView',
  SafeAreaInsetsContext: require('react').createContext({ top: 0, right: 0, bottom: 24, left: 0 }) }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../motion', () => ({ useReducedMotion: () => false }));

/** Window insets bound the modal viewport; no moving SafeAreaView or measured footer overlap. */
let tree: ReactTestRenderer;
const flat = (style: unknown) => Object.assign({}, ...[style].flat(3).filter(Boolean));
afterEach(async () => { await act(async () => tree?.unmount()); });
it('applies the window inset once outside the centered surface', async () => {
  await act(async () => { tree = create(<ProductSheet title="Filteri" onClose={jest.fn()} footer={() => <Text>Primeni</Text>}>
    {() => <Text>Sadržaj</Text>}</ProductSheet>); });
  expect(tree.root.findAll(node => node.type === ('SafeAreaView' as unknown as React.ElementType))).toHaveLength(0);
  expect(flat(tree.root.findByProps({ testID: 'product-modal-viewport' }).props.style).paddingBottom).toBe(sys.space.base + 24);
  expect(tree.root.findByProps({ testID: 'product-sheet-footer' }).props.onLayout).toBeUndefined();
  expect(tree.root.findByProps({ testID: 'product-sheet-content' }).props.contentContainerStyle.paddingBottom).toBeUndefined();
});
