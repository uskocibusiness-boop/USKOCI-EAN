import React from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { discoveryShown, initialMarketplaceView, pinPlaces, publicPoint, type MarketplaceView } from '../marketplaceView';
import type { DiscoveryPresentationProps } from '../../ui/v2/DiscoveryPresentation';

let mockPackage: string | undefined = 'rs.uskoci.dev';
let mockParams: { count?: unknown; detail?: unknown; discoveryTrace?: unknown; relation?: unknown; scene?: unknown } = {};
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-constants', () => ({ get expoConfig() { return { android: { package: mockPackage } }; } }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/v2/DiscoveryPresentation', () => ({ DiscoveryPresentation: 'Discovery' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
import Gallery from '../../app/dizajn-mapa';

let tree: ReactTestRenderer;
const render = async () => act(async () => { tree = create(<Gallery />); });
const discovery = () => tree.root.findByType('Discovery' as React.ElementType).props as DiscoveryPresentationProps;
const press = async (label: string) => act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress());
const words = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
beforeEach(() => { mockPackage = 'rs.uskoci.dev'; mockParams = {}; jest.clearAllMocks(); mockRouter.canGoBack.mockReturnValue(true); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test.each([undefined, 'rs.uskoci', 'rs.uskoci.app.dev', 'other.dev'])(
  'does not mount the map or fixture dataset outside the exact internal package (%s)', async packageName => {
    mockPackage = packageName; mockParams = { count: '1000' }; await render();
    expect(tree.root.findAllByType('Discovery' as React.ElementType)).toHaveLength(0);
    expect(words()).toContain('Nije dostupno.');
  },
);

test.each([{ count: '1001' }, { count: '01' }, { count: ['1000'] }, { count: '1', detail: '1' },
  { count: '1000', detail: '1000' }, { count: '1000', detail: '-1' }, { count: '1000', detail: '02' }, { detail: ['0'] },
  { relation: 'unknown' }, { relation: ['owned'] }, { scene: 'unknown' }, { scene: ['point-members'] },
  { scene: 'point-members', count: '1000' }, { scene: 'point-members', detail: '0' },
  { scene: 'point-members', relation: 'owned' }])(
  'rejects malformed or out-of-range scene input before rendering Discovery: %j', async params => {
    mockParams = params; await render();
    expect(tree.root.findAllByType('Discovery' as React.ElementType)).toHaveLength(0);
    expect(words()).toContain('Nepoznat prikaz galerije.');
  },
);

test('bounded point-members fixture carries an independent total through the real seam and stays local', async () => {
  mockParams = { scene: 'point-members' }; await render();
  const p = discovery(), seam = p.p6Seam!, marker = seam.map.markers[0];
  expect(p.items).toHaveLength(50); expect(new Set(p.items.map(row => row.id)).size).toBe(50);
  expect(p.items.every(row => publicPoint(row)?.lat === 45.25 && row.detalji?.rezimLokacije === 'STATIONARY'
    && 'narucilacAvatarId' in row && row.narucilacAvatarId === null)).toBe(true);
  expect(seam.peek?.place).toBe(p.items); expect(seam.peek?.placeTotalCount).toBe(4000);
  expect(marker).toMatchObject({ kind: 'PLACE', taskCount: 4000 });
  expect(seam.counts).toMatchObject({ listed: 4000, mapped: 4000, withoutPoint: 0 });
  expect(seam.pageHasMore).toBe(false);
  expect(words()).toContain('DEV · 4.000 ukupno / 50 učitano · bez baze');
  await act(async () => { p.onOpen(p.items[0]); p.onRefresh(); p.onProfile(); seam.onNextPage(); seam.onShowPlace(); });
  expect(discovery().p6Seam?.peek).toBeNull();
  await act(async () => discovery().p6Seam!.map.onSelect(marker));
  expect(discovery().p6Seam?.peek?.placeTotalCount).toBe(4000);
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});

test.each(['rs.uskoci.preview', 'rs.uskoci'])(
  'point-members fixture remains unavailable outside exact DEV package: %s', async packageName => {
    mockPackage = packageName; mockParams = { scene: 'point-members' }; await render();
    expect(tree.root.findAllByType('Discovery' as React.ElementType)).toHaveLength(0);
    expect(words()).toContain('Nije dostupno.');
  },
);

test('one-row entry uses the real component with a public point, no image resource and only local callbacks', async () => {
  mockParams = { count: '1' }; await render();
  const p = discovery(), row = p.items[0];
  expect(p.items).toHaveLength(1); expect(publicPoint(row)).not.toBeNull();
  expect(p.loading).toBe(false); expect(p.error).toBe(false);
  expect(row).toMatchObject({ narucilacAvatarId: null, narucilacOcena: null, narucilacBrojOcena: null });
  expect(p.relations?.relation(row.id)).toEqual({ kind: 'NONE' });
  await act(async () => { p.onProfile(); p.onRefresh(); });
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(words()).toContain('DEV · 1 zadatak · bez baze');
});

test.each([['owned', 'OWNER'], ['applied', 'APPLIED']])('explicit local %s pin scene stays local and preserves the selected relation on detail return', async (relation, kind) => {
  mockParams = { count: '1', relation }; await render();
  const props = discovery(), row = props.items[0];
  expect(props.relations?.relation(row.id).kind).toBe(kind);
  await act(async () => props.onOpen(row));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/dizajn-mapa', params: { count: '1', detail: '0', relation } });
});

test('1,000 deterministic rows cover real local filtering/cluster shapes without media, profiles or invented review scores', async () => {
  mockParams = { count: '1000' }; await render();
  const rows = discovery().items;
  expect(rows).toHaveLength(1000); expect(new Set(rows.map(row => row.id)).size).toBe(1000);
  expect(rows.filter(row => publicPoint(row))).toHaveLength(800);
  expect(rows.filter(row => row.detalji?.rezimLokacije === 'REMOTE')).toHaveLength(100);
  expect(rows.filter(row => !publicPoint(row) && row.detalji?.rezimLokacije !== 'REMOTE')).toHaveLength(100);
  expect([...pinPlaces(rows).values()].some(place => place.ids.length > 1)).toBe(true);
  expect(rows.some(row => row.naslov.length > 80)).toBe(true);
  expect(rows.every(row => 'narucilacAvatarId' in row && row.narucilacAvatarId === null
    && row.narucilacOcena === null && row.narucilacBrojOcena === null)).toBe(true);
  const view: MarketplaceView = { ...initialMarketplaceView(), mode: 'map', area: [19.79, 45.20, 19.89, 45.30] };
  const local = discoveryShown(rows, view, undefined);
  expect(local.inArea).toHaveLength(400); expect(local.withoutPoint).toHaveLength(200); expect(local.listed).toHaveLength(600);
  expect(discoveryShown(rows, { ...view, area: [18.8, 42.9, 22.5, 46] }, undefined).listed).toHaveLength(1000);
  const remote = { ...view, where: 'remote' as const, place: 'Novi Sad', pinPlace: 'stale-local-point' };
  expect(discoveryShown(rows, remote, undefined).listed).toHaveLength(100);
  await act(async () => tree.unmount()); await render();
  expect(discovery().items).toEqual(rows);
});

test('opening a row pushes only its bounded local detail; filters/camera/scroll stay in the retained gallery', async () => {
  mockParams = { count: '1000' }; await render();
  const before = discovery(), selected = before.items[731];
  const kept: MarketplaceView = { ...before.view, query: 'Prenos', sheet: 'full', listOffset: 1240,
    viewport: { center: [19.84, 45.25], zoom: 12, bounds: [19.79, 45.20, 19.89, 45.30] } };
  await act(async () => before.onView(kept));
  await act(async () => discovery().onOpen(selected));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/dizajn-mapa', params: { count: '1000', detail: '731' } });
  expect(discovery().view).toEqual(kept);
  expect(discovery().items).toBe(before.items);
  await act(async () => discovery().onOpen({ ...selected, id: 'not-a-gallery-row' }));
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
  mockParams = { count: '1000', detail: '731' };
  await act(async () => tree.update(<Gallery />));
  expect(tree.root.findAllByType('Discovery' as React.ElementType)).toHaveLength(0);
  expect(words()).toContain(selected.naslov); expect(words()).toContain('LOKALNI PROBNI DETALJ');
  await press('Nazad na probnu mapu'); expect(mockRouter.back).toHaveBeenCalledTimes(1);
  mockRouter.canGoBack.mockReturnValue(false); await press('Nazad na probnu mapu');
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/dizajn-mapa', params: { count: '1000' } });
});

test('has a local safe exit and no direct backend/provider/media dependency or remote fixture source', async () => {
  await render(); mockRouter.canGoBack.mockReturnValue(false); await press('Izađi iz galerije');
  expect(mockRouter.replace).toHaveBeenCalledWith('/dizajn-tabla');
  const code = readFileSync(resolve(__dirname, '../../app/dizajn-mapa.tsx'), 'utf8');
  expect(code).not.toMatch(/(?:import|require).*?(?:supabase|ClientService|AuthorizedPhoto|expo-location|fetch|https?:)/i);
  expect(code).not.toMatch(/\b(?:fetch|rpc|invoke)\s*\(/);
});

test('gallery diagnosis is explicit, numeric-only, bounded and retired when its flag disappears', async () => {
  const logged = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    await render(); expect(discovery().trace).toBeUndefined();
    mockParams = { count: '1000', discoveryTrace: ['1'] }; await act(async () => tree.update(<Gallery />));
    expect(discovery().trace).toBeUndefined();
    mockParams = { count: '1000', discoveryTrace: '1' }; await act(async () => tree.update(<Gallery />));
    const trace = discovery().trace!;
    trace('request', NaN); trace('request', Infinity); trace('request', ...Array(21).fill(1));
    trace('request', 'private text' as unknown as number); trace('route-open', 1);
    expect(logged).not.toHaveBeenCalled();
    for (let i = 0; i < 50; i++) trace('content', i);
    expect(logged).toHaveBeenCalledTimes(32);
    trace('request', 123.456, true);
    expect(logged).toHaveBeenLastCalledWith('[USKOCI_DISCOVERY_TRACE] [33,"request",123.5,true]');
    mockParams = { count: '1000' }; await act(async () => tree.update(<Gallery />));
    expect(discovery().trace).toBeUndefined();
    trace('request', 1); expect(logged).toHaveBeenCalledTimes(33);
    mockParams = { count: '1000', discoveryTrace: '1' }; await act(async () => tree.update(<Gallery />));
    for (let i = 0; i < 200; i++) trace('ack', i);
    expect(logged).toHaveBeenCalledTimes(120);
  } finally { logged.mockRestore(); }
});
