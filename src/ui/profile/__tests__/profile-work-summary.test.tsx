import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * "Završeni Dogovori" on the profile (T4a, 2026-10-07): the sentence that says how many finished Dogovori the person has is a way
 * in to them. With a way in, the title and both counts are ONE button spoken as one sentence; the refresh of a count that could
 * not be read stays outside it. Without one it is only a summary, as it always was.
 */
const WORKER = '11111111-1111-4111-8111-111111111111', REQUESTER = '22222222-2222-4222-8222-222222222222';
let mockResource: { data: { role: 'narucilac' | 'uskocer'; count: number | null }[] | null; loading: boolean; error: boolean; refresh: jest.Mock };
let mockStacked = false;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../../hooks/useFocusedResource', () => ({ useFocusedResource: () => mockResource }));
jest.mock('../../system/textScale', () => ({ useLayoutClass: () => ({ cls: mockStacked ? 'large' : 'compact', stacked: mockStacked }) }));
jest.mock('../../../data/publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: jest.fn() } }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
import { ProfileWorkSummary } from '../ProfileWorkSummary';

let tree: ReactTestRenderer;
const draw = async (onOpen?: () => void, ids: [string | null, string | null] = [REQUESTER, WORKER]) => {
  await act(async () => { tree = create(<ProfileWorkSummary requesterProfileId={ids[0]} workerProfileId={ids[1]} onOpen={onOpen} />); });
};
const hosts = (name: string) => tree.root.findAll(node => String(node.type) === name);
const texts = () => hosts('T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
beforeEach(() => {
  mockStacked = false;
  mockResource = { data: [{ role: 'uskocer', count: 4 }, { role: 'narucilac', count: 0 }], loading: false, error: false, refresh: jest.fn() };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('says the title and both counts as they always did', async () => {
  await draw();
  expect(texts()).toContain('Završeni Dogovori'); expect(texts()).toContain('Kad ti radiš'); expect(texts()).toContain('4');
  expect(texts()).toContain('Kad ti objavljuješ'); expect(texts()).toContain('0');
});

it('without a way in it is no button at all', async () => {
  await draw();
  expect(hosts('Press')).toHaveLength(0);
});

it('with a way in the whole summary is one button, spoken as one sentence, that opens the Dogovori once', async () => {
  const open = jest.fn();
  await draw(open);
  const [button] = hosts('Press');
  expect(hosts('Press')).toHaveLength(1);
  expect(button.props).toMatchObject({ accessibilityRole: 'button', accessibilityHint: 'Otvara Dogovore.',
    accessibilityLabel: 'Završeni Dogovori. Kad ti radiš: 4. Kad ti objavljuješ: 0' });
  // The title and both counts stand inside it.
  expect(button.findAll(node => String(node.type) === 'T' && node.children.includes('Završeni Dogovori'))).toHaveLength(1);
  expect(button.findAll(node => String(node.type) === 'T' && node.children.includes('Kad ti radiš'))).toHaveLength(1);
  await act(async () => button.props.onPress());
  expect(open).toHaveBeenCalledTimes(1);
});

it('a count that cannot be read is said as such inside the button, and its refresh stays outside it', async () => {
  mockResource = { ...mockResource, data: [{ role: 'uskocer', count: null }, { role: 'narucilac', count: 2 }] };
  await draw(jest.fn());
  const button = hosts('Press').find(node => node.props.accessibilityHint === 'Otvara Dogovore.')!;
  expect(button.props.accessibilityLabel).toBe('Završeni Dogovori. Kad ti radiš: broj nije dostupan. Kad ti objavljuješ: 2');
  expect(texts()).toContain('Broj nije dostupan');
  const refresh = hosts('Press').find(node => node.props.accessibilityLabel === 'Osveži pregled završenih Dogovora')!;
  expect(refresh).toBeDefined();
  expect(button.findAll(node => node === refresh)).toHaveLength(0);
  await act(async () => refresh.props.onPress());
  expect(mockResource.refresh).toHaveBeenCalledTimes(1);
});

it('while it reads there is nothing to open: no button, no arrow, one quiet sentence', async () => {
  mockResource = { ...mockResource, data: null, loading: true };
  await draw(jest.fn());
  expect(hosts('Press')).toHaveLength(0); expect(texts()).toContain('Učitavamo pregled…');
});

it('draws nothing for an account that has no profile to count', async () => {
  await draw(jest.fn(), [null, null]);
  expect(tree.toJSON()).toBeNull();
});

it('keeps the same sentence when the text is large and the counts stack', async () => {
  mockStacked = true;
  await draw(jest.fn());
  expect(hosts('Press')[0].props.accessibilityLabel).toBe('Završeni Dogovori. Kad ti radiš: 4. Kad ti objavljuješ: 0');
});
