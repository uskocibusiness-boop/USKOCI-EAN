import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pictogram, pictogramCatalog } from '../Pictogram';
import { StyleSheet } from 'react-native';
import { PickerGrid, PickerTile } from '../PickerTile';
import { sys } from '../tokens';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), ImpactFeedbackStyle: {} }));
let mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get: (target, key) => key === 'useWindowDimensions' ? () => mockWindow : Reflect.get(target, key) });
});

/**
 * The picker level of the icon language (owner's master directive, step E, 2026-09-23): every pictogram draws, a
 * disabled one turns grey, and a picker tile tells a screen reader what it is, whether it is chosen and why it cannot be.
 */
describe('pictograms', () => {
  let tree: ReactTestRenderer;
  afterEach(async () => { await act(async () => tree?.unmount()); });

  it('draws every kind in the catalog, each with its own gradient', async () => {
    await act(async () => { tree = create(<>{pictogramCatalog.map(p => <Pictogram key={p.kind} kind={p.kind} size={48} />)}</>); });
    expect(pictogramCatalog.length).toBeGreaterThan(0);
    expect(new Set(pictogramCatalog.map(p => p.kind)).size).toBe(pictogramCatalog.length);
    const gradients = tree.root.findAll(node => node.props?.x2 === '0' && node.props?.y2 === '1' && typeof node.props?.id === 'string', { deep: false });
    expect(new Set(gradients.map(node => node.props.id)).size).toBe(gradients.length);
  });

  it('keeps existing choice meanings and readable labels while allowing the catalog to grow', () => {
    const groups = new Set(pictogramCatalog.map(p => p.group));
    expect([...groups]).toEqual(expect.arrayContaining(['alat', 'ljudi', 'usluge', 'vozila']));
    expect(pictogramCatalog.every(p => p.label.trim().length > 1)).toBe(true);
    for (const kind of ['bicikl', 'ebike', 'skuter', 'motor', 'automobil', 'karavan', 'pickup', 'kombi', 'prikolica', 'kamion']) {
      expect(pictogramCatalog.some(p => p.kind === kind && p.group === 'vozila')).toBe(true);
    }
  });

  it('a disabled pictogram is drawn in the muted tone only', async () => {
    await act(async () => { tree = create(<Pictogram kind="kombi" disabled />); });
    const fills = tree.root.findAll(node => typeof node.props?.stopColor === 'string').map(node => node.props.stopColor);
    expect(fills.length).toBeGreaterThan(0);
    const mutedStops: readonly string[] = [sys.pictogram.muted.top, sys.pictogram.muted.front];
    expect(fills).toEqual(expect.arrayContaining(mutedStops));
    expect(fills.every(color => mutedStops.includes(color))).toBe(true);
  });
});

describe('a picker tile', () => {
  let tree: ReactTestRenderer;
  afterEach(async () => { await act(async () => tree?.unmount()); });
  const press = () => tree.root.findAll(node => node.props?.accessibilityRole === 'checkbox' || node.props?.accessibilityRole === 'radio')[0];

  it('says its label and whether it is chosen, and chooses on press', async () => {
    const onPress = jest.fn();
    await act(async () => { tree = create(<PickerTile kind="kombi" label="Kombi" selected onPress={onPress} />); });
    expect(press().props.accessibilityRole).toBe('checkbox');
    expect(press().props.accessibilityLabel).toBe('Kombi');
    expect(press().props.accessibilityState).toEqual({ checked: true, disabled: false });
    await act(async () => { press().props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a single-answer tile is a radio', async () => {
    await act(async () => { tree = create(<PickerTile kind="selidba" label="Selidba" selected={false} mode="single" onPress={() => {}} />); });
    expect(press().props.accessibilityRole).toBe('radio');
    expect(press().props.accessibilityState).toEqual({ checked: false, disabled: false });
  });

  it('a disabled tile says why and cannot be chosen', async () => {
    const onPress = jest.fn();
    await act(async () => { tree = create(<PickerTile kind="kamion" label="Kamion" selected={false} disabled reason="Treba vozačka C" onPress={onPress} />); });
    expect(press().props.accessibilityLabel).toBe('Kamion. Treba vozačka C');
    expect(press().props.accessibilityState).toEqual({ checked: false, disabled: true });
    expect(press().props.disabled).toBe(true);
  });
});

// The medium tile and the one-column list (2026-09-24, the worker profile's quick picks): a step smaller for a grid of
// sixteen, and a 64 px row at 320 dp or large text, where two columns would break a label mid-word.
describe('a picker grid', () => {
  let tree: ReactTestRenderer;
  afterEach(async () => { await act(async () => tree?.unmount()); mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 }; });
  const press = () => tree.root.findAll(node => node.props?.accessibilityRole === 'checkbox')[0];
  const grid = (size: 'large' | 'medium' = 'medium') => <PickerGrid>
    <PickerTile kind="kombi" label="Kombi" size={size} selected onPress={() => {}} />
    <PickerTile kind="kamion" label="Kamion" size={size} selected={false} disabled reason="Najviše 50 stavki" onPress={() => {}} />
  </PickerGrid>;

  it('a medium tile keeps its role, label and state, and sits in two columns on a 390 dp phone', async () => {
    await act(async () => { tree = create(grid()); });
    expect(press().props.accessibilityLabel).toBe('Kombi');
    expect(press().props.accessibilityState).toEqual({ checked: true, disabled: false });
    expect(StyleSheet.flatten(press().props.style).flexDirection).toBeUndefined();
    const disabled = tree.root.findAll(node => node.props?.accessibilityLabel === 'Kamion. Najviše 50 stavki')[0];
    expect(disabled.props.accessibilityState).toEqual({ checked: false, disabled: true });
  });

  it.each([['320 dp', 320, 1], ['Android Large text', 390, 1.2999999523]])('turns every tile into a row at %s', async (_name, width, fontScale) => {
    mockWindow = { width, height: 844, scale: 3, fontScale };
    await act(async () => { tree = create(grid()); });
    expect(StyleSheet.flatten(press().props.style).flexDirection).toBe('row');
    expect(press().props.accessibilityState).toEqual({ checked: true, disabled: false });
  });

  it('a tile outside a grid keeps its label, selection and full touch target', async () => {
    mockWindow = { width: 320, height: 844, scale: 3, fontScale: 1 };
    await act(async () => { tree = create(<PickerTile kind="kombi" label="Kombi" selected onPress={() => {}} />); });
    expect(press().props.accessibilityLabel).toBe('Kombi');
    expect(press().props.accessibilityState.checked).toBe(true);
    expect(StyleSheet.flatten(press().props.style).minHeight).toBeGreaterThanOrEqual(sys.touch.min);
  });
});
