import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockPlatform = 'android';
let mockReducedMotion = true;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: mockPlatform };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
// Exercise the production Android seam, not Jest's platform-neutral fallback.
jest.mock('@expo/ui/jetpack-compose', () => ({ Host: 'ComposeHost', TimePickerDialog: 'TimePickerDialog' }));
jest.mock('../../ui/calendar/CivilTimeDialog', () => jest.requireActual('../../ui/calendar/CivilTimeDialog.android'));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('react-native-reanimated', () => ({ ...jest.requireActual('../../../__mocks__/react-native-reanimated'), useReducedMotion: () => mockReducedMotion }));
// Reduced motion is read from the one store (ui/system/motion) since 2026-09-24, no longer from Reanimated.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReducedMotion }));
import { CivilField } from '../../ui/calendar/CalendarControls';
import { ProductSheet } from '../../ui/product/ProductSheet';

let tree: ReactTestRenderer;
const picker = () => tree.root.findByType('DateTimePicker' as React.ElementType);
const timePicker = () => tree.root.findByType('TimePickerDialog' as React.ElementType);
afterEach(async () => { await act(async () => tree?.unmount()); mockPlatform = 'android'; mockReducedMotion = true; });

describe('SDK57 native civil-field adapter', () => {
  it('preserves the Android Material UTC civil date even west of UTC', async () => {
    const onChange = jest.fn();
    await act(async () => { tree = create(<CivilField label="Datum" mode="date" value="2026-09-11" onChange={onChange} />); });
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datum' }).props.onPress());
    expect(picker().props.value.toISOString()).toBe('2026-09-11T12:00:00.000Z');
    const selected = new Date('2026-09-12T00:00:00Z');
    // Material returns UTC midnight; in a western device zone getDate is the prior day.
    selected.getDate = () => 11;
    await act(async () => picker().props.onValueChange({}, selected));
    expect(onChange).toHaveBeenCalledWith('2026-09-12');
    expect(tree.root.findAllByType('DateTimePicker' as React.ElementType)).toHaveLength(0);
  });
  it('cancel does not silently accept the picker seed', async () => {
    const onChange = jest.fn();
    await act(async () => { tree = create(<CivilField label="Vreme" mode="time" value="" onChange={onChange} />); });
    const field = tree.root.findByProps({ accessibilityLabel: 'Vreme' });
    expect(field.props.accessibilityHint).toBe('Izaberi vreme');
    expect(field.props.accessibilityValue).toBeUndefined();
    expect(field.findAllByType('T' as React.ElementType).map(node => node.props.children)).toContain('Izaberi');
    await act(async () => field.props.onPress());
    await act(async () => timePicker().props.onDismissRequest());
    expect(onChange).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('TimePickerDialog' as React.ElementType)).toHaveLength(0);
  });
  it.each([true, false])('requires explicit iOS acceptance with reduced motion %s', async reduced => {
    mockPlatform = 'ios'; mockReducedMotion = reduced;
    const onChange = jest.fn();
    await act(async () => { tree = create(<CivilField label="Vreme" mode="time" value="09:00" onChange={onChange} />); });
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Vreme' }).props.onPress());
    // The iOS spinner is in the one sheet engine since owner step 10 (2026-09-24), not a hand-made slide Modal: the sheet
    // is told the reduced-motion setting and moves (or not) itself.
    expect(tree.root.findByType(ProductSheet).props.reduced).toBe(reduced);
    const selected = new Date('2026-09-12T00:00:00Z'); selected.getHours = () => 17; selected.getMinutes = () => 45;
    await act(async () => picker().props.onValueChange({}, selected));
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => tree.root.findAllByProps({ label: 'Izaberi' })[0].props.onPress());
    expect(onChange).toHaveBeenCalledWith('17:45');
    expect(tree.root.findAllByType('DateTimePicker' as React.ElementType)).toHaveLength(0);
  });

  // Dostupnost on the phone showed "16:00:00" and "2026-09-23" in these fields (2026-09-23). The value stays exact; the
  // field writes minutes and the app's day, and a screen reader now hears it too.
  it.each([['time', '16:00:00.123456', '16:00'], ['date', '2026-09-23', null]] as const)('writes a stored %s the way a person reads it', async (mode, value, expected) => {
    const { civilDay } = require('../../ui/calendar/calendarPresentation') as typeof import('../../ui/calendar/calendarPresentation');
    const shown = expected ?? civilDay(value);
    await act(async () => { tree = create(<CivilField label="Polje" mode={mode} value={value} onChange={jest.fn()} />); });
    const field = tree.root.findByProps({ accessibilityLabel: 'Polje' });
    expect(field.findAllByType('T' as React.ElementType).map(node => node.props.children)).toContain(shown);
    expect(field.props.accessibilityValue).toEqual({ text: shown });
    expect(shown).not.toContain(value);
  });

  it('reads native time picker local hours independently of its instant date', async () => {
    const onChange = jest.fn();
    await act(async () => { tree = create(<CivilField label="Vreme" mode="time" value="09:00" onChange={onChange} />); });
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Vreme' }).props.onPress());
    expect(timePicker().props.is24Hour).toBe(true);
    const seed = new Date(timePicker().props.initialDate);
    expect([seed.getHours(), seed.getMinutes()]).toEqual([9, 0]);
    expect(onChange).not.toHaveBeenCalled();
    const selected = new Date('2026-09-12T00:00:00Z'); selected.getHours = () => 17; selected.getMinutes = () => 45;
    await act(async () => timePicker().props.onDateSelected(selected));
    expect(onChange).toHaveBeenCalledWith('17:45');
    expect(tree.root.findAllByType('TimePickerDialog' as React.ElementType)).toHaveLength(0);
  });
});
