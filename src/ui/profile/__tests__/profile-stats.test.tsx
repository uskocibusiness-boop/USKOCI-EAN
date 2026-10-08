import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { MyWorkStats } from '../../../data/workTrustClientService';

/**
 * "Dolazi kako je dogovoreno" on the profile (PROFILE-TRUST, R30; the third of the three figures, owner's pick of 8 Oct 2026, "Lice i
 * tri broja"): the person's own reliability, as the server returned it, as one cell of the figures' row. It is there for an account with
 * a work profile only; a percentage that does not exist yet says so and is never drawn as zero; what it is made of is said to a screen
 * reader as its hint; and it reads nothing but `rpc_my_work_stats_v1` through the service. Disposable doubles only.
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

  it('does not draw a zero for a percentage that does not exist yet: it says so in words, and says what it waits for with the minimum the server named', async () => {
    await draw(<ReliabilityFigure state={{ kind: 'ready', stats: stats({ reliabilityState: 'TOO_FEW', reliabilityPercent: null, reliabilityMinimum: 5 }) }} />);
    expect(texts()).toEqual(['Još nema procenta', 'dolazi kako je dogovoreno']);
    expect(texts().join(' ')).not.toMatch(/0 ?%/);
    expect(cell().props.accessibilityHint).toBe('Procenat se pokazuje kad bar 5 Dogovora bude završeno ili ih otkažeš ti.');
  });

  it('is not there at all for an account without a work profile: there is no work to count, and zeros would say a thing that is not so', async () => {
    await draw(<ReliabilityFigure state={{ kind: 'ready', stats: stats({ hasWorkerProfile: false, profileId: null, profileStatus: null, applicationsSent: 0 }) }} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('says it is reading, as a progress the screen reader can name, and shows no figure meanwhile', async () => {
    await draw(<ReliabilityFigure state={{ kind: 'loading' }} />);
    expect(texts()).toEqual([]);
    expect(hosts('View').find(node => node.props.accessibilityRole === 'progressbar')!.props.accessibilityLabel).toBe('Učitavanje statistike');
  });

  it('says it could not be read, with one retry in the same place, and shows no figure', async () => {
    const retry = jest.fn();
    await draw(<ReliabilityFigure state={{ kind: 'error', onRetry: retry }} />);
    expect(texts()).toEqual(['Procenat trenutno nije dostupan.', 'Osveži']);
    const button = hosts('Press').find(node => node.props.accessibilityLabel === 'Osveži procenat')!;
    expect(button.props.accessibilityRole).toBe('button');
    await act(async () => button.props.onPress());
    expect(retry).toHaveBeenCalledTimes(1);
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

  it('draws the figure once it is read, the still shape while it is read, and the retry when it failed', async () => {
    await draw(<ProfileStats />);
    expect(texts()).toContain('85 %');
    mockResource = { ...mockResource, data: null, loading: true };
    await act(async () => tree.update(<ProfileStats />));
    expect(hosts('View').some(node => node.props.accessibilityRole === 'progressbar')).toBe(true);
    mockResource = { ...mockResource, loading: false, error: true };
    await act(async () => tree.update(<ProfileStats />));
    expect(texts()).toContain('Procenat trenutno nije dostupan.');
    await act(async () => hosts('Press').find(node => node.props.accessibilityLabel === 'Osveži procenat')!.props.onPress());
    expect(mockResource.refresh).toHaveBeenCalledTimes(1);
  });
});
