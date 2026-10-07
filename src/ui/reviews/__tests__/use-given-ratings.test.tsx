import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DogovorProjekcija } from '../../../contracts/projections';
import type { Ishod } from '../../../data/ports';
import type { ReviewContext } from '../../../data/reviewsClientService';

/**
 * The walk behind "Date" (T4a, 2026-10-07): it starts when the screen mounts the hook, keeps what it has across a refresh that
 * returns the same finished Dogovori, starts over when the set really changed, throws away a step that was overtaken, and never
 * runs two steps at once.
 */
let mockResource: { data: DogovorProjekcija[] | null; loading: boolean; error: boolean; refresh: jest.Mock };
jest.mock('../../../hooks/useFocusedResource', () => ({ useFocusedResource: () => mockResource }));
jest.mock('../../../data/agreementClientService', () => ({ agreementClientService: { mojiDogovori: jest.fn() } }));
jest.mock('../../../data/reviewCommentsClientService', () => ({ reviewCommentsClientService: { context: jest.fn() } }));
import { useGivenRatings, type GivenRatingsView } from '../useGivenRatings';

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', THEM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const agreement = (id: string, stanje = 'COMPLETED') => ({ id, naslov: `Zadatak ${id}`, stanje,
  ucesnici: [{ id: THEM, profilId: 'p', ime: 'Marko', inicijali: 'M', uloga: 'uskocer' }] }) as unknown as DogovorProjekcija;
const rated = (id: string, rating = 5): Ishod<ReviewContext> => ({ ok: true, podatak: { accountId: ME, agreementId: id, targetAccountId: THEM, eligible: false,
  review: { reviewId: id, rating, createdAt: '2025-05-01T10:00:00Z', tags: [] }, authoritative: true } as unknown as ReviewContext });
const reads: string[] = [];
let answer: (id: string) => Promise<Ishod<ReviewContext>> = async id => rated(id);
const readContext = (id: string) => { reads.push(id); return answer(id); };
let view: GivenRatingsView, tree: ReactTestRenderer;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function Probe() { view = useGivenRatings(async () => [], readContext); return null; }
const mount = async () => { await act(async () => { tree = create(<Probe />); await flush(); }); };
const remount = async () => { await act(async () => { tree.update(<Probe />); await flush(); }); };
const settled = (ids: string[], extra: Partial<typeof mockResource> = {}) => { mockResource = { data: ids.map(id => agreement(id)), loading: false, error: false, refresh: jest.fn(), ...extra }; };
beforeEach(() => { reads.length = 0; answer = async id => rated(id); settled(['a', 'b']); });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('is loading until the list of Dogovori is read, then ready with the ratings of the first step', async () => {
  mockResource = { data: null, loading: true, error: false, refresh: jest.fn() };
  await mount();
  expect(view.phase).toBe('loading'); expect(view.rows).toEqual([]);
  settled(['a', 'b']); await remount();
  expect(view.phase).toBe('ready'); expect(view.rows.map(row => row.agreementId).sort()).toEqual(['a', 'b']);
});

it('reports an error of the list itself, and offers to read it again', async () => {
  mockResource = { data: null, loading: false, error: true, refresh: jest.fn() };
  await mount();
  expect(view.phase).toBe('error');
  view.refresh();
  expect(mockResource.refresh).toHaveBeenCalledWith('load');
});

it('keeps what it has when a refresh returns the same finished Dogovori, even in a new array, and reads nothing again', async () => {
  await mount();
  expect(reads.sort()).toEqual(['a', 'b']);
  settled(['a', 'b']); await remount();
  expect(reads).toHaveLength(2); expect(view.phase).toBe('ready');
});

it('starts over when the set of finished Dogovori really changed, and a Dogovor that is not finished changes nothing', async () => {
  await mount();
  mockResource = { ...mockResource, data: [agreement('a'), agreement('b'), agreement('c', 'CONFIRMED')] }; await remount();
  expect(reads).toHaveLength(2);
  settled(['a', 'b', 'd']); await remount();
  expect(reads.sort()).toEqual(['a', 'a', 'b', 'b', 'd']);
  expect(view.rows).toHaveLength(3);
});

it('reads fifteen Dogovori in a step and the next fifteen on request, one step at a time', async () => {
  settled(Array.from({ length: 40 }, (_, index) => `d${index}`));
  await mount();
  expect(reads).toHaveLength(15); expect(view.older).toBe(true); expect(view.working).toBeNull();
  const waiting: (() => void)[] = [];
  answer = id => new Promise<Ishod<ReviewContext>>(resolve => { waiting.push(() => resolve(rated(id))); });
  await act(async () => { view.more(); view.more(); await flush(); });
  expect(view.working).toBe('more');
  // Two requests while one runs read one step, not two: four receipts start at once and the others wait for them.
  expect(reads).toHaveLength(15 + 4);
  answer = async id => rated(id);
  await act(async () => { waiting.splice(0).forEach(release => release()); await flush(); await flush(); await flush(); });
  expect(reads).toHaveLength(30); expect(view.older).toBe(true); expect(view.working).toBeNull();
  await act(async () => { view.more(); await flush(); await flush(); });
  expect(reads).toHaveLength(40); expect(view.older).toBe(false); expect(view.rows).toHaveLength(40);
});

it('remembers the receipts it could not read, and the second try reads exactly those', async () => {
  answer = async id => id === 'b' ? { ok: false, kod: 'REVIEW_READ_UNAVAILABLE', poruka: 'x' } as Ishod<ReviewContext> : rated(id);
  await mount();
  expect(view.failedCount).toBe(1); expect(view.rows.map(row => row.agreementId)).toEqual(['a']);
  answer = async id => rated(id, 2); reads.length = 0;
  await act(async () => { view.retryFailed(); await flush(); await flush(); });
  expect(reads).toEqual(['b']); expect(view.failedCount).toBe(0); expect(view.rows.map(row => row.agreementId).sort()).toEqual(['a', 'b']);
});

it('throws away a step that was overtaken by another set of Dogovori', async () => {
  let release!: () => void;
  answer = id => new Promise<Ishod<ReviewContext>>(resolve => { release = () => resolve(rated(id)); });
  await mount();
  expect(view.phase).toBe('loading');
  answer = async id => rated(id, 1); settled(['x']); await remount();
  expect(view.rows.map(row => row.agreementId)).toEqual(['x']);
  await act(async () => { release(); await flush(); });
  expect(view.rows.map(row => row.agreementId)).toEqual(['x']);
});

it('has no ratings given when nothing is finished, and says nothing is left to read', async () => {
  settled([]);
  await mount();
  expect(view.phase).toBe('ready'); expect(view.rows).toEqual([]); expect(view.older).toBe(false); expect(reads).toEqual([]);
});
