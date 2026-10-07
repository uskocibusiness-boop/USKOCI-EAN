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

/**
 * Owner 2026-10-07: everything that comes up from the bottom "shakes all the time". A native SafeAreaView inside the
 * sheet padded by where it sat on screen at that moment; the sheet slides and sizes itself to its content, so every move
 * changed the padding, the new height moved the sheet again, and it never settled. The sheet now reads the window's
 * bottom inset once and holds a footer height within a pixel.
 */
let tree: ReactTestRenderer;
const flat = (style: unknown) => Object.assign({}, ...[style].flat(3).filter(Boolean));
const byTestId = (testID: string) => tree.root.findByProps({ testID });
const scroll = () => tree.root.findByType('ScrollView' as unknown as React.ElementType);
afterEach(async () => { await act(async () => tree?.unmount()); });

it('draws no SafeAreaView inside a sheet and pads its pinned actions by the window inset', async () => {
  await act(async () => { tree = create(<ProductSheet title="Filteri" onClose={jest.fn()} footer={() => <Text>Primeni</Text>}>
    {() => <Text>Sadržaj</Text>}</ProductSheet>); });
  expect(tree.root.findAll(node => node.type === ('SafeAreaView' as unknown as React.ElementType))).toHaveLength(0);
  expect(flat(byTestId('product-sheet-footer').props.style).paddingBottom).toBe(sys.space.md + 24);
});

it('a sheet without pinned actions keeps the inset under its own content', async () => {
  await act(async () => { tree = create(<ProductSheet title="Meni" onClose={jest.fn()}>{() => <Text testID="body">Sadržaj</Text>}</ProductSheet>); });
  const stack = byTestId('body').parent!;
  expect(flat(stack.props.style).paddingBottom).toBe(24);
});

it('a re-measure within one pixel does not size the sheet again', async () => {
  await act(async () => { tree = create(<ProductSheet title="Filteri" onClose={jest.fn()} footer={() => <Text>Primeni</Text>}>
    {() => <Text>Sadržaj</Text>}</ProductSheet>); });
  await act(async () => { byTestId('product-sheet-footer').props.onLayout({ nativeEvent: { layout: { height: 96 } } }); });
  expect(flat(scroll().props.contentContainerStyle).paddingBottom).toBe(96 + sys.space.sm);
  // 96.4 rounds up to 97: the same footer, not a new height.
  await act(async () => { byTestId('product-sheet-footer').props.onLayout({ nativeEvent: { layout: { height: 96.4 } } }); });
  expect(flat(scroll().props.contentContainerStyle).paddingBottom).toBe(96 + sys.space.sm);
  await act(async () => { byTestId('product-sheet-footer').props.onLayout({ nativeEvent: { layout: { height: 120 } } }); });
  expect(flat(scroll().props.contentContainerStyle).paddingBottom).toBe(120 + sys.space.sm);
});
