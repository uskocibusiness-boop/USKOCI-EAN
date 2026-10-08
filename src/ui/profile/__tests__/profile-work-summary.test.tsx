import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * "Završeni Dogovori" on the profile (UI/UX pass 2026-10-08, F6; composition spec 4.14): a section with two facts, one per role, as
 * `KeyValueRow`s, and one word at the end of its title ("Pogledaj") that goes to the Dogovori that were finished. A count that could not be
 * read says so in its own row, and the word at the end of the title is then "Osveži". Without a way in it is only a summary.
 */
const WORKER = '11111111-1111-4111-8111-111111111111', REQUESTER = '22222222-2222-4222-8222-222222222222';
type Fact = { role: 'narucilac' | 'uskocer'; count: number | null };
let mockResource: { data: Fact[] | null; loading: boolean; error: boolean; refresh: jest.Mock };
let mockLoad: ((signal: AbortSignal) => Promise<Fact[]>) | null = null;
let mockStacked = false;
const mockJavniProfil = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../../hooks/useFocusedResource', () => ({ useFocusedResource: (load: (signal: AbortSignal) => Promise<Fact[]>) => { mockLoad = load; return mockResource; } }));
jest.mock('../../system/textScale', () => ({ useLayoutClass: () => ({ cls: mockStacked ? 'large' : 'compact', stacked: mockStacked }) }));
jest.mock('../../../data/publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: (...args: unknown[]) => mockJavniProfil(...args) } }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
import { FinishedAgreements, ProfileWorkSummary, roleWords } from '../ProfileWorkSummary';

let tree: ReactTestRenderer;
const draw = async (onOpen?: () => void, ids: [string | null, string | null] = [REQUESTER, WORKER]) => {
  await act(async () => { tree = create(<ProfileWorkSummary requesterProfileId={ids[0]} workerProfileId={ids[1]} onOpen={onOpen} />); });
};
const hosts = (name: string) => tree.root.findAll(node => String(node.type) === name);
const texts = () => hosts('T').flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
const action = (label: string) => hosts('Press').find(node => node.props.accessibilityLabel === label);
beforeEach(() => {
  mockStacked = false; mockLoad = null; mockJavniProfil.mockReset();
  mockResource = { data: [{ role: 'uskocer', count: 4 }, { role: 'narucilac', count: 0 }], loading: false, error: false, refresh: jest.fn() };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the section', () => {
  it('names the two roles the way the app names them everywhere, and says each count in its own row, under one heading', async () => {
    await draw();
    expect(texts()).toEqual(['Završeni Dogovori', 'Kad uskačeš', '4', 'Kad tražiš pomoć', '0']);
    expect(hosts('T').find(node => node.children.includes('Završeni Dogovori'))!.props).toMatchObject({ variant: 'heading', accessibilityRole: 'header' });
    expect(roleWords('uskocer')).toBe('Kad uskačeš');
    expect(roleWords('narucilac')).toBe('Kad tražiš pomoć');
  });

  it('is only a summary without a way in: no button at all', async () => {
    await draw();
    expect(hosts('Press')).toHaveLength(0);
  });

  it('with a way in has one word at the end of its title, "Pogledaj", that opens the finished Dogovori once', async () => {
    const open = jest.fn();
    await draw(open);
    expect(hosts('Press')).toHaveLength(1);
    const button = action('Pogledaj završene Dogovore')!;
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.findAll(node => String(node.type) === 'T' && node.children.includes('Pogledaj'))).toHaveLength(1);
    await act(async () => button.props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('says a count that could not be read in its own row, and offers "Osveži" instead of the way in until it can be', async () => {
    mockResource = { ...mockResource, data: [{ role: 'uskocer', count: null }, { role: 'narucilac', count: 2 }] };
    await draw(jest.fn());
    expect(texts()).toContain('Broj nije dostupan');
    expect(hosts('T').find(node => node.children.includes('Broj nije dostupan'))!.props.tone).toBe('muted');
    expect(action('Pogledaj završene Dogovore')).toBeUndefined();
    const refresh = action('Osveži pregled završenih Dogovora')!;
    await act(async () => refresh.props.onPress());
    expect(mockResource.refresh).toHaveBeenCalledTimes(1);
  });

  it('never turns a count it could not read into a zero', async () => {
    mockResource = { ...mockResource, data: [{ role: 'uskocer', count: null }, { role: 'narucilac', count: null }] };
    await draw();
    expect(texts().filter(text => text === 'Broj nije dostupan')).toHaveLength(2);
    expect(texts()).not.toContain('0');
  });

  it('while it reads there is nothing to open: no button, one quiet sentence a screen reader can name', async () => {
    mockResource = { ...mockResource, data: null, loading: true };
    await draw(jest.fn());
    expect(hosts('Press')).toHaveLength(0);
    expect(texts()).toContain('Učitavamo pregled…');
    expect(hosts('T').find(node => node.props.accessibilityRole === 'progressbar')!.props.accessibilityLabel).toBe('Učitavanje završenih Dogovora');
  });

  it('says every count in the roles the person has could not be read when the whole read failed', async () => {
    mockResource = { ...mockResource, data: null, error: true };
    await draw(jest.fn());
    expect(texts()).toEqual(['Završeni Dogovori', 'Osveži', 'Kad uskačeš', 'Broj nije dostupan', 'Kad tražiš pomoć', 'Broj nije dostupan']);
  });

  it('draws nothing for an account that has no profile to count', async () => {
    await draw(jest.fn(), [null, null]);
    expect(tree.toJSON()).toBeNull();
  });

  it('draws the role the account has, and only it', async () => {
    mockResource = { ...mockResource, data: [{ role: 'narucilac', count: 3 }] };
    await draw(undefined, [REQUESTER, null]);
    expect(texts()).toEqual(['Završeni Dogovori', 'Kad tražiš pomoć', '3']);
  });

  it('keeps the same words when the text is large and the layout stacks', async () => {
    mockStacked = true;
    await draw(jest.fn());
    expect(texts()).toEqual(['Završeni Dogovori', 'Pogledaj', 'Kad uskačeš', '4', 'Kad tražiš pomoć', '0']);
  });

  it('is the presentation of a view that is handed to it, with no read of its own', async () => {
    await act(async () => { tree = create(<FinishedAgreements view={{ kind: 'ready', facts: [{ role: 'uskocer', count: 12 }] }} onOpen={jest.fn()} onRefresh={jest.fn()} />); });
    expect(texts()).toEqual(['Završeni Dogovori', 'Pogledaj', 'Kad uskačeš', '12']);
  });
});

describe('the reading', () => {
  const profile = (id: string, role: string, count: unknown) => ({ profilId: id, uloga: role, poverenje: { zavrseniBroj: count } });

  it('counts the finished Dogovori of each profile in its own role, the worker\'s first', async () => {
    mockJavniProfil.mockImplementation(async (id: string) => id === WORKER ? profile(WORKER, 'uskocer', 4) : profile(REQUESTER, 'narucilac', 0));
    await draw();
    const signal = new AbortController().signal;
    expect(await mockLoad!(signal)).toEqual([{ role: 'uskocer', count: 4 }, { role: 'narucilac', count: 0 }]);
    expect(mockJavniProfil.mock.calls).toEqual([[WORKER, signal], [REQUESTER, signal]]);
  });

  it('counts one profile once when the same profile is both roles', async () => {
    mockJavniProfil.mockImplementation(async (id: string) => profile(id, 'uskocer', 1));
    await draw(undefined, [WORKER, WORKER]);
    expect(await mockLoad!(new AbortController().signal)).toEqual([{ role: 'uskocer', count: 1 }]);
  });

  it.each([
    ['another profile than the one asked', profile(REQUESTER, 'uskocer', 4)], ['another role than the one asked', profile(WORKER, 'narucilac', 4)],
    ['a negative count', profile(WORKER, 'uskocer', -1)], ['a fractional count', profile(WORKER, 'uskocer', 1.5)], ['a count that is not a number', profile(WORKER, 'uskocer', '4')],
    ['no count', { profilId: WORKER, uloga: 'uskocer', poverenje: {} }], ['no profile', null],
  ])('says nothing it is not sure of: %s is a count that could not be read', async (_name, answer) => {
    mockJavniProfil.mockResolvedValue(answer);
    await draw(undefined, [null, WORKER]);
    expect(await mockLoad!(new AbortController().signal)).toEqual([{ role: 'uskocer', count: null }]);
  });

  it('says a read that threw is a count that could not be read, in that role only', async () => {
    mockJavniProfil.mockImplementation(async (id: string) => { if (id === WORKER) throw new Error('network'); return profile(REQUESTER, 'narucilac', 2); });
    await draw();
    expect(await mockLoad!(new AbortController().signal)).toEqual([{ role: 'uskocer', count: null }, { role: 'narucilac', count: 2 }]);
  });
});
