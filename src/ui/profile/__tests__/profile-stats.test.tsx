import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { MyWorkStats } from '../../../data/workTrustClientService';

/**
 * "Moja statistika" on the profile (PROFILE-TRUST, R30): the person's own funnel, as the server returned it, in one section of
 * `KeyValueRow`s. It is there for an account with a work profile only; a percentage that does not exist yet says so and is never
 * drawn as zero; and it reads nothing but `rpc_my_work_stats_v1` through the service. Disposable doubles only.
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
jest.mock('../../system/textScale', () => ({ useLayoutClass: () => ({ cls: 'compact', stacked: false }) }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
import { ProfileStats, ProfileStatsSection } from '../ProfileStats';

const stats = (patch: Partial<MyWorkStats> = {}): MyWorkStats => ({ hasWorkerProfile: true, profileId: PROFILE, profileStatus: 'ACTIVE', applicationsSent: 12, agreementsMade: 8,
  agreementsCompleted: 6, agreementsActive: 1, cancelledByMe: 1, cancelledByRequester: 0, cancelledSideUnknown: 0, reliabilityPercent: 85, reliabilityState: 'AVAILABLE',
  reliabilityMinimum: 5, memberSince: '2026-03-01', asOf: '2026-10-07T18:23:45.123456+00:00', ...patch });

let tree: ReactTestRenderer;
const draw = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const hosts = (name: string) => tree.root.findAll(node => String(node.type) === name);
const texts = () => hosts('T').flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
beforeEach(() => {
  jest.clearAllMocks(); mockLoad = null;
  mockResource = { data: stats(), loading: false, error: false, refresh: jest.fn() };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the section with the figures', () => {
  it('lists the funnel in the order it happens, under a heading, then the reliability, and says what the percentage is made of', async () => {
    await draw(<ProfileStatsSection state={{ kind: 'ready', stats: stats() }} />);
    expect(texts()).toEqual(['Moja statistika', 'Poslate prijave', '12', 'Dogovoreno', '8', 'Završeno', '6', 'Dolazi kako je dogovoreno', '85%',
      'Računa se iz završenih Dogovora i onih koje otkažeš ti. Otkazivanje druge strane se ne računa.']);
    expect(hosts('T').find(node => node.children.includes('Moja statistika'))!.props).toMatchObject({ variant: 'heading', accessibilityRole: 'header' });
  });

  it('does not draw a zero for a percentage that does not exist yet, and says what it waits for with the minimum the server named', async () => {
    await draw(<ProfileStatsSection state={{ kind: 'ready', stats: stats({ reliabilityState: 'TOO_FEW', reliabilityPercent: null, reliabilityMinimum: 5 }) }} />);
    expect(texts()).toContain('Još nema procenta');
    expect(texts()).not.toContain('0%');
    expect(texts()).toContain('Procenat se pokazuje kad bar 5 Dogovora bude završeno ili ih otkažeš ti.');
  });

  it('is not there at all for an account without a work profile: there is no work to count, and zeros would say a thing that is not so', async () => {
    await draw(<ProfileStatsSection state={{ kind: 'ready', stats: stats({ hasWorkerProfile: false, profileId: null, profileStatus: null, applicationsSent: 0 }) }} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('says it is reading, as a progress the screen reader can name, and shows no figure meanwhile', async () => {
    await draw(<ProfileStatsSection state={{ kind: 'loading' }} />);
    expect(texts()).toEqual(['Moja statistika', 'Učitavamo statistiku…']);
    expect(hosts('T').find(node => node.props.accessibilityRole === 'progressbar')!.props.accessibilityLabel).toBe('Učitavanje statistike');
  });

  it('says it could not be read, with a retry beside the title, and shows no figure', async () => {
    const retry = jest.fn();
    await draw(<ProfileStatsSection state={{ kind: 'error', onRetry: retry }} />);
    expect(texts()).toContain('Statistika trenutno nije dostupna.');
    expect(hosts('T').find(node => node.props.accessibilityRole === 'alert')).toBeTruthy();
    const button = hosts('Press').find(node => node.props.accessibilityLabel === 'Pokušaj ponovo: Moja statistika')!;
    await act(async () => button.props.onPress());
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps the wording free of anything it cannot promise', async () => {
    await draw(<ProfileStatsSection state={{ kind: 'ready', stats: stats() }} />);
    expect(texts().join(' ')).not.toMatch(/anonim|garant|sigurno|uvek|nikad/i);
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

  it('draws the figures once they are read, the loading note while they are read, and the retry when they failed', async () => {
    await draw(<ProfileStats />);
    expect(texts()).toContain('85%');
    mockResource = { ...mockResource, data: null, loading: true };
    await act(async () => tree.update(<ProfileStats />));
    expect(texts()).toContain('Učitavamo statistiku…');
    mockResource = { ...mockResource, loading: false, error: true };
    await act(async () => tree.update(<ProfileStats />));
    expect(texts()).toContain('Statistika trenutno nije dostupna.');
    await act(async () => hosts('Press').find(node => node.props.accessibilityLabel === 'Pokušaj ponovo: Moja statistika')!.props.onPress());
    expect(mockResource.refresh).toHaveBeenCalledTimes(1);
  });
});
