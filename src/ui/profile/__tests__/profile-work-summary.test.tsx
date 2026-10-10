import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * "Završeno" on the profile (the second of the three figures, owner's pick of 8 Oct 2026, "Lice i tri broja"): how many Dogovori the
 * person finished in every role they have, as one figure with its word under it ("9 završenih"). With a way in the figure itself goes to
 * the Dogovori that were finished. A count that could not be read is never added up as if it were zero: the cell says so and offers
 * "Osveži" in the same place. Without a way in it is only a figure.
 */
const WORKER = '11111111-1111-4111-8111-111111111111', REQUESTER = '22222222-2222-4222-8222-222222222222';
type Fact = { role: 'narucilac' | 'uskocer'; count: number | null };
let mockResource: { data: Fact[] | null; loading: boolean; error: boolean; refresh: jest.Mock };
const mockJavniProfil = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../../data/publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: (...args: unknown[]) => mockJavniProfil(...args) } }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
import { FinishedAgreements } from '../ProfileWorkSummary';

function FinishedFixture({ requesterProfileId, workerProfileId, onOpen }: { requesterProfileId: string | null; workerProfileId: string | null; onOpen?: () => void }) {
  if (!requesterProfileId && !workerProfileId) return null;
  const unread: Fact[] = [{ role: 'uskocer', count: null }];
  return <FinishedAgreements view={mockResource.loading ? { kind: 'loading' } : { kind: 'ready', facts: mockResource.error || !mockResource.data ? unread : mockResource.data }}
    onOpen={onOpen} onRefresh={mockResource.refresh} />;
}
let tree: ReactTestRenderer;
const draw = async (onOpen?: () => void, ids: [string | null, string | null] = [REQUESTER, WORKER]) => {
  await act(async () => { tree = create(<FinishedFixture requesterProfileId={ids[0]} workerProfileId={ids[1]} onOpen={onOpen} />); });
};
const hosts = (name: string) => tree.root.findAll(node => String(node.type) === name);
const texts = () => hosts('T').flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
const action = (label: string) => hosts('Press').find(node => node.props.accessibilityLabel === label);
const cell = () => hosts('View').find(node => node.props.testID === 'profile-work-summary')!;
beforeEach(() => {
  mockJavniProfil.mockReset();
  mockResource = { data: [{ role: 'uskocer', count: 4 }, { role: 'narucilac', count: 0 }], loading: false, error: false, refresh: jest.fn() };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the finished figure', () => {
  it('adds up the Dogovori finished in every role the person has, as one figure with its word under it, spoken once', async () => {
    await draw();
    expect(texts()).toEqual(['4', 'završena']);
    expect(hosts('T').find(node => node.children.includes('4'))!.props.variant).toBe('priceLarge');
    expect(cell().props).toMatchObject({ accessible: true, accessibilityRole: 'text', accessibilityLabel: '4 završena' });
    mockResource = { ...mockResource, data: [{ role: 'uskocer', count: 9 }, { role: 'narucilac', count: 3 }] };
    await act(async () => tree.update(<FinishedFixture requesterProfileId={REQUESTER} workerProfileId={WORKER} />));
    expect(texts()).toEqual(['12', 'završenih']);
  });

  it.each([[0, '0', 'završenih'], [1, '1', 'završen'], [2, '2', 'završena'], [4, '4', 'završena'], [5, '5', 'završenih'], [11, '11', 'završenih'],
    [21, '21', 'završen'], [22, '22', 'završena']] as const)('says %i the Serbian way: "%s %s"', async (count, figure, word) => {
    await act(async () => { tree = create(<FinishedAgreements view={{ kind: 'ready', facts: [{ role: 'uskocer', count }] }} onRefresh={jest.fn()} />); });
    expect(texts()).toEqual([figure, word]);
  });

  it('is only a figure without a way in: no button at all, and no arrow', async () => {
    await draw();
    expect(hosts('Press')).toHaveLength(0);
    expect(tree.root.findAll(node => node.props.name === 'caret-right')).toHaveLength(0);
  });

  it('with a way in is the way: the figure opens the finished Dogovori once, says where it goes and ends in the quiet arrow', async () => {
    const open = jest.fn();
    await draw(open);
    expect(hosts('Press')).toHaveLength(1);
    const button = action('4 završena')!;
    expect(button.props).toMatchObject({ accessibilityRole: 'button', accessibilityHint: 'Otvara završene Dogovore.' });
    expect(button.findAll(node => node.props.name === 'caret-right').length).toBeGreaterThan(0);
    await act(async () => button.props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('says a count that could not be read in its own place, offers "Osveži" and no way in until it can be, and adds nothing up', async () => {
    mockResource = { ...mockResource, data: [{ role: 'uskocer', count: null }, { role: 'narucilac', count: 2 }] };
    await draw(jest.fn());
    expect(texts()).toEqual(['Broj završenih trenutno nije dostupan.', 'Osveži']);
    expect(texts()).not.toContain('2');
    expect(action('4 završena')).toBeUndefined();
    const refresh = action('Osveži pregled završenih Dogovora')!;
    await act(async () => refresh.props.onPress());
    expect(mockResource.refresh).toHaveBeenCalledTimes(1);
  });

  it('never turns counts it could not read into a zero', async () => {
    mockResource = { ...mockResource, data: [{ role: 'uskocer', count: null }, { role: 'narucilac', count: null }] };
    await draw();
    expect(texts()).toEqual(['Broj završenih trenutno nije dostupan.', 'Osveži']);
    expect(texts()).not.toContain('0');
  });

  it('while it reads there is nothing to open: no button, the still shape a screen reader can name', async () => {
    mockResource = { ...mockResource, data: null, loading: true };
    await draw(jest.fn());
    expect(hosts('Press')).toHaveLength(0);
    expect(texts()).toEqual([]);
    expect(tree.root.findAll(node => node.props.accessibilityRole === 'progressbar')[0].props.accessibilityLabel).toBe('Učitavanje završenih Dogovora');
  });

  it('says the count could not be read when the whole read failed', async () => {
    mockResource = { ...mockResource, data: null, error: true };
    await draw(jest.fn());
    expect(texts()).toEqual(['Broj završenih trenutno nije dostupan.', 'Osveži']);
  });

  it('draws nothing for an account that has no profile to count', async () => {
    await draw(jest.fn(), [null, null]);
    expect(tree.toJSON()).toBeNull();
  });

  it('draws the figure of the role the account has, and only it', async () => {
    mockResource = { ...mockResource, data: [{ role: 'narucilac', count: 3 }] };
    await draw(undefined, [REQUESTER, null]);
    expect(texts()).toEqual(['3', 'završena']);
  });

  it('is the presentation of a view that is handed to it, with no read of its own', async () => {
    await act(async () => { tree = create(<FinishedAgreements view={{ kind: 'ready', facts: [{ role: 'uskocer', count: 12 }] }} onOpen={jest.fn()} onRefresh={jest.fn()} />); });
    expect(texts()).toEqual(['12', 'završenih']);
    expect(mockJavniProfil).not.toHaveBeenCalled();
  });
});
