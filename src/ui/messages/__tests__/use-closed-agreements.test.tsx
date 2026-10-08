import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockSource = { mojiDogovori: jest.fn() };
jest.mock('../../../store/uloga', () => ({ useIzvor: () => mockSource }));
// The resource is the screen's own (focus, account and foreground guards have their suites); here it only runs the read it was handed.
jest.mock('../../../hooks/useFocusedResource', () => ({ useFocusedResource: (load: (signal: AbortSignal) => Promise<unknown>) => {
  const react = require('react') as typeof import('react');
  const [state, setState] = react.useState<{ data: unknown; error: boolean }>({ data: null, error: false });
  react.useEffect(() => { let alive = true; load(new AbortController().signal).then(
    data => { if (alive) setState({ data, error: false }); }, () => { if (alive) setState({ data: null, error: true }); }); return () => { alive = false; }; }, [load]);
  return state;
} }));
import { isClosedAgreement, useClosedAgreements } from '../useClosedAgreements';

/**
 * R17 (UI/UX pass, 2026-10-08): which of my Dogovori are over, from the Dogovori read the app already makes. A Dogovor is over when it is
 * completed or cancelled. Null is "not known" (the first read, a failed read), never "none".
 */
const agreement = (id: string, stanje: string) => ({ id, stanje });
let tree: ReactTestRenderer;
let seen: (ReadonlySet<string> | null)[] = [];
function Probe() { seen.push(useClosedAgreements()); return null; }
const mount = async () => { await act(async () => { tree = create(<Probe />); }); await act(async () => { await Promise.resolve(); }); };
beforeEach(() => { jest.clearAllMocks(); seen = []; });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('calls a Dogovor over when it is completed or cancelled, and not when it is confirmed or waits for its completion to be confirmed', () => {
  expect(['CONFIRMED', 'AWAITING_REQUESTER', 'COMPLETED', 'CANCELLED'].map(state => isClosedAgreement(state as never))).toEqual([false, false, true, true]);
});

it('is null until the Dogovori are read, then the ids of the ones that are over, read without the rating checks of finished ones', async () => {
  mockSource.mojiDogovori.mockResolvedValue([agreement('a', 'CONFIRMED'), agreement('b', 'COMPLETED'), agreement('c', 'CANCELLED'), agreement('d', 'AWAITING_REQUESTER')]);
  await mount();
  expect(seen[0]).toBeNull();
  expect([...(seen.at(-1) as ReadonlySet<string>)]).toEqual(['b', 'c']);
  expect(mockSource.mojiDogovori).toHaveBeenCalledWith({ includeRatings: false });
});

it('is an empty set, not null, when none is over: "none" is an answer', async () => {
  mockSource.mojiDogovori.mockResolvedValue([agreement('a', 'CONFIRMED')]);
  await mount();
  expect(seen.at(-1)).toEqual(new Set());
});

it('stays null when the read fails: the list then says nothing about which conversation is active', async () => {
  mockSource.mojiDogovori.mockRejectedValue(new Error('AGREEMENT_LIST_FAILED'));
  await mount();
  expect(seen.every(value => value === null)).toBe(true);
});
