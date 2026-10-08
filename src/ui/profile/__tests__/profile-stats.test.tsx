import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { MyWorkStats } from '../../../data/workTrustClientService';

/**
 * "Dolazi kako je dogovoreno" on the profile (PROFILE-TRUST, R30; the third of the three figures, owner's pick of 8 Oct 2026, "Lice i
 * tri broja"): the person's own reliability, as the server returned it, as one cell of the figures' row. It is there for an account with
 * a work profile only; a percentage that does not exist yet is NOT DRAWN (owner's phone, 8 Oct 2026: "Još nema procenta" stood there in two
 * big lines, out of line with the other two figures; what is not there is not drawn, and the other two stand together in the middle), and
 * neither is it drawn as zero; what it is made of is said to a screen reader as its hint; and it reads nothing but `rpc_my_work_stats_v1`
 * through the service. Disposable doubles only.
 */
const PROFILE = '30000000-0000-4000-8000-000000000001';
let mockResource: { data: MyWorkStats | null; loading: boolean; error: boolean; refresh: jest.Mock };
let mockLoad: (() => Promise<MyWorkStats>) | null = null;
const mockMyStats = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../../hooks/useFocusedResource', () => ({ useFocusedResource: (load: () => Promise<MyWorkStats>) => { mockLoad = load; return mockResource; } }));
jest.mock('../../../data/workTrustClientService', () => ({ workTrustClientService: { myStats: (...args: unknown[]) => mockMyStats(...args) } }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
import { ProfileStats, ReliabilityFigure } from '../ProfileStats';

const stats = (patch: Partial<MyWorkStats> = {}): MyWorkStats => ({ hasWorkerProfile: true, profileId: PROFILE, profileStatus: 'ACTIVE', applicationsSent: 12, agreementsMade: 8,
  agreementsCompleted: 6, agreementsActive: 1, cancelledByMe: 1, cancelledByRequester: 0, cancelledSideUnknown: 0, reliabilityPercent: 85, reliabilityState: 'AVAILABLE',
  reliabilityMinimum: 5, memberSince: '2026-03-01', asOf: '2026-10-07T18:23:45.123456+00:00', ...patch });

let tree: ReactTestRenderer;
const draw = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const hosts = (name: string) => tree.root.findAll(node => String(node.type) === name);
const texts = () => hosts('T').flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
const cell = () => hosts('View').find(node => node.props.testID === 'profile-stats')!;
beforeEach(() => {
  jest.clearAllMocks(); mockLoad = null;
  mockResource = { data: stats(), loading: false, error: false, refresh: jest.fn() };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the reliability figure', () => {
  it('is the percentage with its words under it, as one text a screen reader says once, and says what the percentage is made of as its hint', async () => {
    await draw(<ReliabilityFigure state={{ kind: 'ready', stats: stats() }} />);
    expect(texts()).toEqual(['85 %', 'dolazi kako je dogovoreno']);
    expect(cell().props).toMatchObject({ accessible: true, accessibilityRole: 'text', accessibilityLabel: '85 % dolazi kako je dogovoreno',
      accessibilityHint: 'Računa se iz završenih Dogovora i onih koje otkažeš ti. Otkazivanje druge strane se ne računa.' });
    expect(hosts('T').find(node => node.children.includes('85 %'))!.props.variant).toBe('priceLarge');
  });

  it('draws the funnel nowhere any more: the section "Moja statistika" and its rows are replaced by the figures', async () => {
    await draw(<ReliabilityFigure state={{ kind: 'ready', stats: stats() }} />);
    expect(texts().join(' ')).not.toMatch(/Moja statistika|Poslate prijave|Dogovoreno|Završeno/);
  });

  it('draws nothing for a percentage that does not exist yet: not a zero, not "Još nema procenta", not an empty cell that takes room', async () => {
    await draw(<ReliabilityFigure state={{ kind: 'ready', stats: stats({ reliabilityState: 'TOO_FEW', reliabilityPercent: null, reliabilityMinimum: 5 }) }} />);
    expect(tree.toJSON()).toBeNull();
    await act(async () => tree.update(<ReliabilityFigure state={{ kind: 'ready', stats: stats({ reliabilityState: 'HIDDEN' as never, reliabilityPercent: null }) }} />));
    expect(tree.toJSON()).toBeNull();
    // A state that says "available" without a figure is not a figure either.
    await act(async () => tree.update(<ReliabilityFigure state={{ kind: 'ready', stats: stats({ reliabilityState: 'AVAILABLE', reliabilityPercent: null }) }} />));
    expect(tree.toJSON()).toBeNull();
  });

  it('draws a percentage of zero when the server counted zero: a figure that exists is drawn, whatever it is', async () => {
    await draw(<ReliabilityFigure state={{ kind: 'ready', stats: stats({ reliabilityPercent: 0 }) }} />);
    expect(texts()).toEqual(['0 %', 'dolazi kako je dogovoreno']);
  });

  it('is not there at all for an account without a work profile: there is no work to count, and zeros would say a thing that is not so', async () => {
    await draw(<ReliabilityFigure state={{ kind: 'ready', stats: stats({ hasWorkerProfile: false, profileId: null, profileStatus: null, applicationsSent: 0 }) }} />);
    expect(tree.toJSON()).toBeNull();
  });

  // The figure that may not exist takes no room while it reads and when it could not be read: the row of figures does not jump when the answer lands
  // (most accounts have no percentage for a long time), and a figure with nothing to say is not drawn.
  it('takes no room while it is reading, and draws no placeholder, no progress and no figure', async () => {
    await draw(<ReliabilityFigure state={{ kind: 'loading' }} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('takes no room when it could not be read, and draws no error, no retry and no figure: the other two figures say what they know', async () => {
    await draw(<ReliabilityFigure state={{ kind: 'error', onRetry: jest.fn() }} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('keeps the wording free of anything it cannot promise', async () => {
    await draw(<ReliabilityFigure state={{ kind: 'ready', stats: stats() }} />);
    expect(texts().join(' ') + cell().props.accessibilityHint).not.toMatch(/anonim|garant|sigurno|uvek|nikad/i);
  });
});

describe('the reading', () => {
  it('asks the service for the person\'s own statistics, and nothing else, and hands over what it returned', async () => {
    mockMyStats.mockResolvedValue({ ok: true, podatak: stats() });
    await draw(<ProfileStats />);
    expect(await mockLoad!()).toEqual(stats());
    expect(mockMyStats.mock.calls).toEqual([[]]);
  });

  it('fails the reading, with the code the service gave, instead of drawing a half-known figure', async () => {
    mockMyStats.mockResolvedValue({ ok: false, kod: 'WORK_STATS_READ_INVALID', poruka: 'x' });
    await draw(<ProfileStats />);
    await expect(mockLoad!()).rejects.toThrow('WORK_STATS_READ_INVALID');
  });

  it('draws the figure once it is read, and nothing while it is read or when it failed', async () => {
    await draw(<ProfileStats />);
    expect(texts()).toContain('85 %');
    mockResource = { ...mockResource, data: null, loading: true };
    await act(async () => tree.update(<ProfileStats />));
    expect(tree.toJSON()).toBeNull();
    mockResource = { ...mockResource, loading: false, error: true };
    await act(async () => tree.update(<ProfileStats />));
    expect(tree.toJSON()).toBeNull();
    mockResource = { ...mockResource, data: stats({ reliabilityState: 'TOO_FEW', reliabilityPercent: null }), error: false };
    await act(async () => tree.update(<ProfileStats />));
    expect(tree.toJSON()).toBeNull();
  });
});
