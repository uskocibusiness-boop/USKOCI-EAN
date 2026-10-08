import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockRead = jest.fn();
const mockWrite = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockRead(...args),
  setItem: (...args: unknown[]) => mockWrite(...args),
}));
import { RECENT_MAX, parseRecent, recentAccount, rememberRecent, useRecentSearches, type RecentSearch } from '../../ui/v2/discovery/recentSearches';

/**
 * What a person searched before (the owner-approved plan, U4: "skorašnje pretrage"): the last few searches, each a word and/or a place, newest first, kept on this
 * phone for this account alone. A search of nothing is not a search; the same search again moves up instead of standing twice; the list never holds more than five;
 * and a storage that is empty, broken or full of something else is simply no recent searches.
 */
const search = (query: string, place: string | null = null): RecentSearch => ({ query, place });

describe('rememberRecent', () => {
  test('the newest search is first, and an equal one moves up instead of standing twice', () => {
    let list: RecentSearch[] = [];
    list = rememberRecent(list, search('selidba', 'Novi Sad'));
    list = rememberRecent(list, search('farbanje'));
    list = rememberRecent(list, search('selidba', 'Novi Sad'));
    expect(list).toEqual([search('selidba', 'Novi Sad'), search('farbanje')]);
  });

  test('"equal" does not depend on case or spaces, and the words not on Serbian letters typed without their marks; a place is the exact text the filter takes', () => {
    const list = rememberRecent([search('Šetnja psa', 'Niš')], search('  setnja psa ', ' NIŠ '));
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(search('setnja psa', 'NIŠ'));
    // another place is another search
    expect(rememberRecent([search('setnja psa', 'Niš')], search('setnja psa', 'Nis'))).toHaveLength(2);
  });

  test('a search with neither words nor a place is not a search and is not kept', () => {
    const before = [search('selidba')];
    expect(rememberRecent(before, search('   ', null))).toEqual(before);
    expect(rememberRecent([], search('', '  '))).toEqual([]);
  });

  test('the list never holds more than five, and the oldest goes first', () => {
    let list: RecentSearch[] = [];
    for (const word of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7']) list = rememberRecent(list, search(word));
    expect(RECENT_MAX).toBe(5);
    expect(list.map(entry => entry.query)).toEqual(['g7', 'f6', 'e5', 'd4', 'c3']);
  });

  test('a word or a place is cut to what a search would ever have been typed to be found again', () => {
    const [entry] = rememberRecent([], search('x'.repeat(200), 'y'.repeat(200)));
    expect(entry.query).toHaveLength(60);
    expect(entry.place).toHaveLength(60);
  });
});

describe('parseRecent', () => {
  test('anything that is not a list of searches is no recent searches', () => {
    for (const raw of [null, undefined, '', 'not json', '{}', '"selidba"', '42', 'null']) expect(parseRecent(raw)).toEqual([]);
  });

  test('a stored list keeps its order, and every entry is cut to what the search itself would keep', () => {
    const raw = JSON.stringify([{ query: 'selidba', place: 'Novi Sad' }, { query: 'farbanje' }, { place: 'Beograd' }, 7, null, { query: '', place: '' },
      { query: 'selidba', place: 'novi sad' }]);
    expect(parseRecent(raw)).toEqual([search('selidba', 'Novi Sad'), search('farbanje'), search('', 'Beograd')]);
  });

  test('a stored list longer than five is cut to five, newest first', () => {
    const raw = JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(query => ({ query, place: null })));
    expect(parseRecent(raw).map(entry => entry.query)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

test('the searches belong to the account: a new session of the same account keeps them, another account never sees them', () => {
  expect(recentAccount('account-1:7')).toBe('account-1');
  expect(recentAccount('account-1:8')).toBe('account-1');
  expect(recentAccount('account-2:1')).toBe('account-2');
  expect(recentAccount('')).toBe('anonymous');
});

describe('useRecentSearches', () => {
  let tree: ReactTestRenderer;
  const shown = () => tree.root.findByType('Snapshot' as React.ElementType).props.snapshot as ReturnType<typeof useRecentSearches>;
  function Probe({ scopeKey, enabled }: { scopeKey: string; enabled: boolean }) {
    return React.createElement('Snapshot', { snapshot: useRecentSearches(scopeKey, enabled) });
  }
  const mount = async (scopeKey: string, enabled: boolean) => act(async () => { tree = create(<Probe scopeKey={scopeKey} enabled={enabled} />); });
  beforeEach(() => { jest.clearAllMocks(); mockRead.mockResolvedValue(null); mockWrite.mockResolvedValue(undefined); });
  afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

  test('the phone is not touched until the search is opened', async () => {
    await mount('account-1:1', false);
    expect(mockRead).not.toHaveBeenCalled();
    expect(shown().items).toEqual([]);
    await act(async () => tree.update(<Probe scopeKey="account-1:1" enabled />));
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(mockRead).toHaveBeenCalledWith('uskoci.zadaci.recent.v1.account-1');
  });

  test('what was stored is what the search shows, and a search made is kept for the next time', async () => {
    mockRead.mockResolvedValue(JSON.stringify([search('selidba', 'Novi Sad')]));
    await mount('account-1:1', true);
    expect(shown().items).toEqual([search('selidba', 'Novi Sad')]);
    await act(async () => shown().remember(search('farbanje')));
    expect(shown().items).toEqual([search('farbanje'), search('selidba', 'Novi Sad')]);
    expect(mockWrite).toHaveBeenLastCalledWith('uskoci.zadaci.recent.v1.account-1', JSON.stringify([search('farbanje'), search('selidba', 'Novi Sad')]));
  });

  test('a search made while the list is still being read stays on top of it', async () => {
    let finish: (raw: string | null) => void = () => undefined;
    mockRead.mockReturnValue(new Promise<string | null>(resolve => { finish = resolve; }));
    await mount('account-1:1', true);
    await act(async () => shown().remember(search('nova')));
    await act(async () => finish(JSON.stringify([search('stara')])));
    expect(shown().items).toEqual([search('nova'), search('stara')]);
  });

  test('a storage that fails is no recent searches and no error', async () => {
    mockRead.mockRejectedValue(new Error('storage'));
    mockWrite.mockRejectedValue(new Error('full'));
    await mount('account-1:1', true);
    expect(shown().items).toEqual([]);
    await act(async () => shown().remember(search('selidba')));
    expect(shown().items).toEqual([search('selidba')]); // it stays on screen for this visit
    mockRead.mockImplementation(() => { throw new Error('no module'); });
    await act(async () => tree.update(<Probe scopeKey="account-2:1" enabled />));
    expect(shown().items).toEqual([]);
  });

  test('another account starts from nothing and writes under its own key', async () => {
    mockRead.mockResolvedValueOnce(JSON.stringify([search('selidba')])).mockResolvedValueOnce(null);
    await mount('account-1:1', true);
    expect(shown().items).toEqual([search('selidba')]);
    await act(async () => tree.update(<Probe scopeKey="account-2:1" enabled />));
    expect(shown().items).toEqual([]);
    await act(async () => shown().remember(search('farbanje')));
    expect(mockWrite).toHaveBeenLastCalledWith('uskoci.zadaci.recent.v1.account-2', JSON.stringify([search('farbanje')]));
  });
});
