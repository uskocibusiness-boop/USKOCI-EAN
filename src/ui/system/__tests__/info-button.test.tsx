import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { InfoButton } from '../InfoButton';
import { Glyph } from '../Glyph';
import { layout } from '../layout';
import { Press } from '../../Press';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), mockReact = require('react');
  const Modal = ({ visible, children, ...props }: any) => visible ? mockReact.createElement('Modal', props, children) : null;
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return Modal;
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../motion', () => ({ useReducedMotion: () => true }));

// The owner's "too much text" (8 Oct 2026): an explanation is one tap away behind "ⓘ", not a paragraph on the screen.
let tree: ReactTestRenderer;
const texts = (root: ReactTestInstance = tree.root) => root.findAll(node => node.type === ('T' as unknown as React.ElementType))
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const modals = () => tree.root.findAll(node => node.type === ('Modal' as unknown as React.ElementType));

describe('InfoButton', () => {
  beforeEach(async () => {
    await act(async () => { tree = create(<InfoButton testID="info" title="Ko vidi adresu" lines={['Tačnu adresu vidi samo osoba sa kojom se dogovoriš.', 'Do Dogovora drugi vide samo deo grada.']} />); });
  });
  afterEach(() => act(() => tree.unmount()));

  it('draws only the mark until it is touched, and names what it explains', () => {
    expect(modals()).toHaveLength(0);
    expect(texts()).toBe('');
    const button = tree.root.findByType(Press);
    expect(button.props.accessibilityLabel).toBe('Objašnjenje: Ko vidi adresu');
    expect(button.findByType(Glyph).props.name).toBe('info');
    // A 20 dp mark that reaches to the 48 dp a control needs.
    expect(20 + 2 * button.props.hitSlop).toBe(layout.touch);
  });

  it('opens the explanation in a sheet with its title and lines', async () => {
    await act(async () => { tree.root.findByType(Press).props.onPress(); });
    expect(modals()).toHaveLength(1);
    expect(texts()).toContain('Tačnu adresu vidi samo osoba sa kojom se dogovoriš.');
    expect(texts()).toContain('Do Dogovora drugi vide samo deo grada.');
  });
});
