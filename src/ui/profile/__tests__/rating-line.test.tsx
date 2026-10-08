import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The rating as one short line in the card "Kako te vide kad uskačeš" (the product draft the owner approved on 8 Oct 2026, P3): "★ 4,8 · 12 ocena". It is drawn ONLY for a
 * rating that exists. While it reads, when the read fails and when there are no reviews yet there is no line, because a zero nobody counted, a star over nothing
 * and "Nova ocena" under a name would each say something the app does not know.
 */
const mockReputation = jest.fn();
jest.mock('../../../data/reviewsClientService', () => ({ reviewsClientService: { reputation: (...args: unknown[]) => mockReputation(...args) } }));
jest.mock('../../../hooks/useFocusedResource', () => {
  const { useEffect, useState } = require('react');
  return { useFocusedResource: (load: () => Promise<unknown>) => {
    const [state, setState] = useState({ data: null as unknown, loading: true, error: false });
    useEffect(() => { let live = true; load().then((data: unknown) => { if (live) setState({ data, loading: false, error: false }); }, () => { if (live) setState({ data: null, loading: false, error: true }); }); return () => { live = false; }; }, [load]);
    return state;
  } };
});
jest.mock('../../Text', () => ({ T: 'T' }));
import { RatingLine, RatingLineView } from '../RatingLine';
import { ratingFigure } from '../ProfileFigures';

let tree: ReactTestRenderer;
const line = () => tree.root.findAll(node => node.props.testID === 'rating-line' && typeof node.type === 'string');
const words = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const mount = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); await act(async () => {}); };
const reputation = (averageRating: number | null, reviewCount: number) => ({ ok: true, podatak: { accountId: 'a', averageRating, reviewCount } });
beforeEach(() => { jest.clearAllMocks(); mockReputation.mockReset(); });
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the line, from a rating that exists', () => {
  it('says the average and the count in the words of the figure of the profile, spoken as one thing', async () => {
    await mount(<RatingLineView average={4.8} count={12} />);
    const figure = ratingFigure(4.8, 12);
    expect(line()).toHaveLength(1); expect(words()).toBe(`${figure.value} · ${figure.label}`);
    expect(words()).toMatch(/^4,8 · 12 ocena$/);
    expect(line()[0].props).toMatchObject({ accessible: true, accessibilityLabel: figure.spoken });
  });
  it.each([[NaN, 3], [Infinity, 3], [4.5, 0], [4.5, -1]])('draws nothing for an average of %s over %s reviews', async (average, count) => {
    await mount(<RatingLineView average={average} count={count} />);
    expect(line()).toHaveLength(0);
  });
});

describe('the line that reads the rating of an account', () => {
  it('reads the reputation of THAT account and draws the line once it has real reviews', async () => {
    mockReputation.mockResolvedValue(reputation(4.5, 8));
    await mount(<RatingLine accountId="account-a" />);
    expect(mockReputation).toHaveBeenCalledWith('account-a'); expect(mockReputation).toHaveBeenCalledTimes(1);
    expect(line()).toHaveLength(1); expect(words()).toBe('4,5 · 8 ocena');
  });
  it('draws nothing while it reads', async () => {
    mockReputation.mockReturnValue(new Promise(() => undefined));
    await mount(<RatingLine accountId="account-a" />);
    expect(line()).toHaveLength(0); expect(words()).toBe('');
  });
  it.each([
    ['there are no reviews yet', () => mockReputation.mockResolvedValue(reputation(null, 0))],
    ['the count is zero whatever the average says', () => mockReputation.mockResolvedValue(reputation(4.9, 0))],
    ['the average is not a number', () => mockReputation.mockResolvedValue(reputation(null, 5))],
    ['the read is refused', () => mockReputation.mockResolvedValue({ ok: false, kod: 'X', poruka: 'x' })],
    ['the read throws', () => mockReputation.mockRejectedValue(new Error('offline'))],
  ])('draws nothing when %s: no zero nobody counted, no star over nothing', async (_name, arrange) => {
    arrange(); await mount(<RatingLine accountId="account-a" />);
    expect(line()).toHaveLength(0); expect(words()).toBe('');
  });
});
