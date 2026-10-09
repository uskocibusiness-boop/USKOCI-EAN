import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockScrollTo = jest.fn();
let mockScale = 1.15;
jest.mock('react-native', () => {
  const React = require('react'), native = jest.requireActual('react-native');
  const Scroll = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    return React.createElement('Scroll', props, props.children);
  });
  return new Proxy(native, { get(target, key) {
    if (key === 'ScrollView') return Scroll;
    return key === 'View' ? 'View' : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/system/textScale', () => ({ useTextScale: () => mockScale }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/system/Glyph', () => ({ Glyph: 'Glyph' }));
import { AgreementRoleRail } from '../../ui/agreements/AgreementRoleRail';
import type { AgreementRoleFilter } from '../../ui/agreements/agreementListModel';
let tree: ReactTestRenderer;
const change = jest.fn();
const render = async (value: AgreementRoleFilter = 'all') => act(async () => { tree = create(<AgreementRoleRail value={value} onChange={change} />); });
const width = async (value: number) => act(async () => tree.root.findByType('View' as React.ElementType).props.onLayout({ nativeEvent: { layout: { width: value } } }));
const rail = () => tree.root.findByType('Scroll' as React.ElementType);
const content = async (value: number) => act(async () => rail().props.onContentSizeChange(value, 48));
const observed = async (x: number) => act(async () => rail().props.onScroll({ nativeEvent: { contentOffset: { x } } }));
const measure = async (entries = [[0, 80], [88, 140], [236, 110]]) => act(async () => {
  tree.root.findAllByType('Press' as React.ElementType).forEach((node, i) => {
    const [x, width] = entries[i]; node.props.onLayout({ nativeEvent: { layout: { x, width } } });
  });
});
const select = async (value: AgreementRoleFilter) => act(async () => tree.update(<AgreementRoleRail value={value} onChange={change} />));
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); mockScale = 1.15; mockScrollTo.mockClear(); change.mockClear(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('reveals an initially selected role only after native width and all option measurements arrive', async () => {
  await render('uskocer'); await width(300); await measure(); expect(mockScrollTo).not.toHaveBeenCalled();
  await content(346); expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 46, animated: false });
  await observed(46); mockScrollTo.mockClear(); await select('narucilac'); expect(mockScrollTo).not.toHaveBeenCalled();
  await select('all'); expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 0, animated: false });
});

test('retries a native-clamped request when the content width catches up with the selected geometry', async () => {
  await render('uskocer'); await width(300); await content(310); await measure();
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 10, animated: false });
  await observed(0); await content(346);
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 46, animated: false });
});

test('manual browsing keeps the selected role and is not snapped back by an unrelated render', async () => {
  await render(); await width(300); await content(346); await measure(); await observed(46); mockScrollTo.mockClear();
  await select('all'); expect(mockScrollTo).not.toHaveBeenCalled(); expect(change).not.toHaveBeenCalled();
  const helper = tree.root.findByProps({ accessibilityLabel: 'Uskačem' });
  await act(async () => helper.props.onPress()); expect(change).toHaveBeenCalledWith('uskocer');
  expect(tree.root.findByProps({ accessibilityLabel: 'Sve uloge' }).props.accessibilityState.checked).toBe(true);
});

test('width and font changes discard old geometry before revealing the selected role again', async () => {
  await render('uskocer'); await width(300); await content(346); await measure(); await observed(46); mockScrollTo.mockClear();
  await width(260); await content(346); expect(mockScrollTo).not.toHaveBeenCalled();
  await measure(); expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 86, animated: false });
  mockScrollTo.mockClear(); mockScale = 1.6; await select('uskocer'); await content(500);
  expect(mockScrollTo).not.toHaveBeenCalled();
  await measure([[0, 110], [118, 200], [326, 174]]);
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 240, animated: false });
  for (const text of tree.root.findAllByType('T' as React.ElementType)) {
    expect(text.props.numberOfLines).toBeUndefined(); expect(text.props.allowFontScaling).not.toBe(false);
  }
});
