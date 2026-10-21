import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'android' };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => true }));
import { CalendarScreen, CivilField } from '../CalendarControls';
import { SkeletonList } from '../../system/Skeleton';
import { QuietReadState } from '../../v2/QuietReadState';

/**
 * Round 6 on the emulator (b4531ef4, "Tačan termin" and Izmene step 1): all four fields wore the calendar, so a 2×2 grid
 * of two dates and two times read as four date pickers. Each fact its own picture: the time field wears the clock.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
/** FactArt is memoised, so its drawing is found by what it was asked to draw. */
const art = () => tree.root.findAll(node => typeof node.type !== 'string' && typeof node.props.kind === 'string' && node.props.size === 22);

it.each([['time', 'clock'], ['date', 'calendar']] as const)('a %s field wears the %s', async (mode, kind) => {
  await act(async () => { tree = create(<CivilField label="Polje" mode={mode} value="" onChange={jest.fn()} />); });
  expect(art().map(node => node.props.kind)).toEqual([kind]);
});

it('shows a calm first read under an available Back, then returns the saved form and footer', async () => {
  const back = jest.fn();
  const content = (loading: boolean) => <CalendarScreen title="Moja dostupnost" back={back} loading={loading}
    footer={React.createElement('SaveAction')}>
    {React.createElement('SavedFields')}
  </CalendarScreen>;
  await act(async () => { tree = create(content(true)); });
  expect(tree.root.findAllByType(QuietReadState)).toHaveLength(1);
  expect(tree.root.findAllByType(SkeletonList)).toHaveLength(0);
  expect(tree.root.findAllByType('SavedFields' as React.ElementType)).toHaveLength(0);
  expect(tree.root.findAllByType('SaveAction' as React.ElementType)).toHaveLength(0);
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress());
  expect(back).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(content(false)));
  expect(tree.root.findAllByType(QuietReadState)).toHaveLength(0);
  expect(tree.root.findAllByType('SavedFields' as React.ElementType)).toHaveLength(1);
  expect(tree.root.findAllByType('SaveAction' as React.ElementType)).toHaveLength(1);
});
