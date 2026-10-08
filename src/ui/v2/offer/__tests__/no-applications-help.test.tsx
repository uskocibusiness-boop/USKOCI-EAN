import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return key === 'View' ? 'View' : Reflect.get(target, key); } });
});
jest.mock('../../../Text', () => ({ T: 'T' }));
jest.mock('../../V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../../system/Surface', () => ({ Surface: 'Surface' }));
import { NoApplicationsHelp } from '../NoApplicationsHelp';

/** R16: the card of the owner's task page after a day of silence. It draws what `noApplicationsHelp` decided and presses what the page maps. */
let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const host = (type: string) => tree.root.findAll(node => String(node.type) === type);

it('is one note with the sentence as its heading and one quiet button for each real way, in the order the model gave them', async () => {
  const onAction = jest.fn();
  await render(<NoApplicationsHelp help={{ sentence: 'Nema prijava već 24 sata.', actions: ['PHOTO', 'WIDEN_TERM', 'SHARE', 'EDIT'] }} onAction={onAction} />);
  expect(host('Surface')).toHaveLength(1); expect(host('Surface')[0].props).toMatchObject({ kind: 'note', testID: 'no-applications-help' });
  expect(host('T').map(node => [node.props.accessibilityRole, node.props.children])).toEqual([['header', 'Nema prijava već 24 sata.']]);
  expect(host('Action').map(node => [node.props.label, node.props.kind, node.props.compact])).toEqual([
    ['Dodaj fotografiju', 'quiet', true], ['Proširi termin', 'quiet', true], ['Podeli zadatak', 'quiet', true], ['Izmeni zadatak', 'quiet', true]]);
  for (const [at, action] of (['PHOTO', 'WIDEN_TERM', 'SHARE', 'EDIT'] as const).entries()) { act(() => host('Action')[at].props.onPress()); expect(onAction).toHaveBeenLastCalledWith(action); }
  expect(onAction).toHaveBeenCalledTimes(4);
});

it('draws only the ways it was given', async () => {
  await render(<NoApplicationsHelp help={{ sentence: 'Nema prijava već 24 sata.', actions: ['SHARE', 'EDIT'] }} onAction={() => {}} />);
  expect(host('Action').map(node => node.props.label)).toEqual(['Podeli zadatak', 'Izmeni zadatak']);
});
