import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  const React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return (props: any) => React.createElement('FlatList', props,
      props.data.length ? props.data.map((item: any, index: number) => props.renderItem({ item, index })) : props.ListEmptyComponent);
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../InboxBell', () => ({ InboxBell: 'InboxBell' }));

import { ComposerUnavailable } from '../ApplicationComposerPresentation';
import { SelectionUnavailable } from '../ApplicationSelectionPresentation';
import { MyApplicationsPresentation } from '../MyApplicationsPresentation';
import { AgreementCollectionPresentation } from '../AgreementCollectionPresentation';
import { QuietReadState } from '../QuietReadState';
import { SkeletonList } from '../../system/Skeleton';

const none = () => {};
let tree: ReactTestRenderer;
const words = () => tree.root.findAllByType('T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test.each([
  ['worker application', <ComposerUnavailable loading message="" back={none} />, 'Učitavamo podatke za prijavu'],
  ['requester candidates', <SelectionUnavailable loading message="" back={none} />, 'Učitavamo prijave'],
  ['my applications', <MyApplicationsPresentation rows={[]} loading unavailable={false} message={null} notice={null}
    tab="all" onTab={none} expanded={null} draft={null} busy={false} editingLoading={false} pending={false}
    canRetry={false} canReset={false} onRefresh={none} onExplore={none} onProfile={none} onBack={none}
    onReview={none} onClose={none} onEdit={none} onChange={none} onCancelEdit={none} onKeep={none}
    onUpdate={none} onWithdraw={none} onAgreement={none} onRetry={none} onReset={none} onTask={none} />,
  'Učitavamo tvoje prijave'],
  ['agreements', <AgreementCollectionPresentation items={[]} loading error={false} section="active" confirmationOnly={false}
    onSection={none} onConfirmationOnly={none} onRefresh={none} onOpen={none} onCalendar={none}
    onProfile={none} onHome={none} />, 'Učitavamo Dogovore'],
])('%s waits calmly without fake records or a pulsing skeleton', async (_flow, component, title) => {
  await act(async () => { tree = create(component); });
  expect(words()).toContain(title);
  expect(tree.root.findAllByType(QuietReadState)).toHaveLength(1);
  expect(tree.root.findAllByType(SkeletonList)).toHaveLength(0);
  expect(words()).not.toMatch(/Još nema|0 prijava|0 Dogovora|Poslata|Potvrđen/);
});
