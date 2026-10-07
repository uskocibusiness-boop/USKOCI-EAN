import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const React = require('react');
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return ({ data, ListEmptyComponent, ...props }: any) => React.createElement('List', props, data.length ? null : ListEmptyComponent);
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/AgreementPresentation', () => ({ AgreementHero: 'AgreementHero' }));

import { AgreementCollectionPresentation } from '../../ui/v2/AgreementCollectionPresentation';

let tree: ReactTestRenderer | undefined;
const calendar = jest.fn();
async function render() {
  await act(async () => { tree = create(<AgreementCollectionPresentation items={[]} loading={false} error={false}
    section="active" confirmationOnly={false} onSection={() => {}} onConfirmationOnly={() => {}}
    onRefresh={() => {}} onOpen={() => {}} onCalendar={calendar} onProfile={() => {}} onHome={() => {}} />); });
}

afterEach(async () => { if (tree) await act(async () => tree?.unmount()); tree = undefined; calendar.mockClear(); });

// Owner decisions 1 and 6 (2026-09-19): one list of Dogovori for both sides, and the calendar of what
// I agreed to do is mine to open whenever I like. It used to be offered in one app mode only.
describe('PKG-005 calendar navigation from Dogovori', () => {
  it('offers the calendar to every account, names no app mode, and uses the existing callback', async () => {
    await render();
    expect(tree!.root.findAllByProps({ accessibilityLabel: 'Radni raspored (JA MOGU)' })).toHaveLength(0);
    // Plan 2.6: the entry is the pill "Raspored" (the planner's own name), with its word beside the glyph.
    expect(tree!.root.findAllByProps({ accessibilityLabel: 'Kalendar obaveza' })).toHaveLength(0);
    const button = tree!.root.findByProps({ accessibilityLabel: 'Raspored' });
    await act(async () => button.props.onPress());
    expect(calendar).toHaveBeenCalledTimes(1);
  });
});
