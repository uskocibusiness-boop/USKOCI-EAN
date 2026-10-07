import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockCanGoBack = true;
const mockRefreshes: jest.Mock[] = [];

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    // A list that draws every item, its header, its empty state and its footer.
    if (key === 'FlatList') return ({ data, renderItem, keyExtractor, ListHeaderComponent, ListEmptyComponent, ListFooterComponent, ItemSeparatorComponent, ...props }: any) => {
      const react = require('react');
      return react.createElement('List', props, ListHeaderComponent, data.length
        ? data.map((item: unknown, index: number) => react.createElement(react.Fragment, { key: keyExtractor(item, index) }, renderItem({ item, index })))
        : ListEmptyComponent, ListFooterComponent, ItemSeparatorComponent ? react.createElement(ItemSeparatorComponent) : null);
    };
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => mockCanGoBack, replace: jest.fn(), navigate: jest.fn() } }));
jest.mock('../agreementClientService', () => ({ agreementClientService: { mojiDogovori: jest.fn() } }));
jest.mock('../needClientService', () => ({ needClientService: { mojePotrebe: jest.fn() } }));
jest.mock('../applicationClientService', () => ({ applicationClientService: { mojePrijave: jest.fn() } }));
// A read that throws is the resource's error state; one that answers null has not settled yet. Every resource hands out its own
// refresh, recorded in the order the route asks for them, so a test can tell which were called.
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: (read: () => unknown) => {
  const refresh = jest.fn();
  mockRefreshes.push(refresh);
  try { return { data: read(), loading: false, error: false, refreshing: false, refresh }; }
  catch { return { data: null, loading: false, error: true, refreshing: false, refresh }; }
} }));
jest.mock('../../ui/Press', () => ({ Press: 'Press', PRESS_DELAY: 60 }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));

import Arhiva from '../../app/(app)/arhiva';
import { agreementOf, applicationOf, needOf } from '../../ui/calendar/__tests__/fixtures';
import { agreementClientService } from '../agreementClientService';
import { applicationClientService } from '../applicationClientService';
import { needClientService } from '../needClientService';

let tree: ReactTestRenderer;
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const press = (label: string) => tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === label)[0];
const button = (label: string) => tree.root.findAll(node => node.props.label === label || node.props.accessibilityLabel === label)[0];
const router = () => jest.requireMock('expo-router').router as { back: jest.Mock; replace: jest.Mock; navigate: jest.Mock };
const render = async () => { await act(async () => { tree = create(<Arhiva />); }); };

beforeEach(() => {
  jest.clearAllMocks(); mockCanGoBack = true; mockRefreshes.length = 0;
  (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([agreementOf('done', { stanje: 'COMPLETED', naslov: 'Krečenje stana' })]);
  (needClientService.mojePotrebe as jest.Mock).mockReturnValue([needOf('closed', { stanje: 'ZATVORENA', naslov: 'Odvoz šuta' })]);
  (applicationClientService.mojePrijave as jest.Mock).mockReturnValue([applicationOf('back', { stanje: 'WITHDRAWN', naslov: 'Košenje trave' })]);
});
afterEach(async () => { await act(async () => tree?.unmount()); });

// Arhiva (owner, 2026-10-07): read-only, from the reads the planner and Početna already make.
describe('Arhiva', () => {
  it('reads my Dogovori, my tasks and my applications the way Raspored does, each once, and draws what is over', async () => {
    await render();
    expect(agreementClientService.mojiDogovori).toHaveBeenCalledTimes(1);
    expect(agreementClientService.mojiDogovori).toHaveBeenCalledWith({ includeRatings: false });
    expect(needClientService.mojePotrebe).toHaveBeenCalledTimes(1);
    expect(needClientService.mojePotrebe).toHaveBeenCalledWith({ includeUrgency: false });
    expect(applicationClientService.mojePrijave).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Arhiva'); expect(text()).toContain('Krečenje stana'); expect(text()).toContain('Odvoz šuta'); expect(text()).toContain('Košenje trave');
    expect(text()).toContain('Završen'); expect(text()).toContain('Zatvoren'); expect(text()).toContain('Povučena');
  });
  it('opens the Dogovor, the task and the application each row belongs to', async () => {
    await render();
    for (const label of ['Otvori Dogovor Krečenje stana', 'Otvori zadatak Odvoz šuta', 'Otvori prijavu Košenje trave']) await act(async () => press(label).props.onPress());
    expect(router().navigate.mock.calls).toEqual([[{ pathname: '/dogovor/[id]', params: { id: 'done' } }],
      [{ pathname: '/potrebe/[id]/pregled', params: { id: 'closed' } }], [{ pathname: '/moje-prijave', params: { prijavaId: 'back' } }]]);
  });
  it('is empty only when all three reads answered with nothing, and loading while one has not answered', async () => {
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([]);
    (needClientService.mojePotrebe as jest.Mock).mockReturnValue([]);
    (applicationClientService.mojePrijave as jest.Mock).mockReturnValue([]);
    await render();
    expect(text()).toContain('Arhiva je prazna.'); expect(text()).toContain('Obrisani nacrti se ne čuvaju.');
    await act(async () => tree.unmount());
    (needClientService.mojePotrebe as jest.Mock).mockReturnValue(null);
    await render();
    expect(text()).toContain('Učitavamo arhivu…'); expect(text()).not.toContain('Arhiva je prazna.');
  });
  it('says which read failed and keeps the rest, and reads again only what failed', async () => {
    (needClientService.mojePotrebe as jest.Mock).mockImplementation(() => { throw new Error('NEED_LIST_FAILED'); });
    await render();
    expect(text()).toContain('Moji zadaci nisu učitani.'); expect(text()).toContain('Krečenje stana'); expect(text()).toContain('Košenje trave');
    expect(text()).not.toContain('Arhiva je prazna.');
    const [agreements, needs, applications] = mockRefreshes.slice(-3);
    await act(async () => button('Pokušaj ponovo').props.onPress());
    expect(needs).toHaveBeenCalledWith('keep');
    expect(agreements).not.toHaveBeenCalled(); expect(applications).not.toHaveBeenCalled();
  });
  it('says the archive could not be read when every read failed', async () => {
    for (const read of [agreementClientService.mojiDogovori, needClientService.mojePotrebe, applicationClientService.mojePrijave]) {
      (read as jest.Mock).mockImplementation(() => { throw new Error('READ_FAILED'); });
    }
    await render();
    expect(text()).toContain('Arhiva nije učitana.'); expect(text()).not.toContain('Arhiva je prazna.');
  });
  it('reads all three again on a pull, keeping what is on screen', async () => {
    await render();
    const latest = mockRefreshes.slice(-3);
    await act(async () => tree.root.findByType('List' as React.ElementType).props.onRefresh());
    for (const refresh of latest) expect(refresh).toHaveBeenCalledWith('keep');
  });
  it('goes back by the arrow, and to Raspored when it was opened cold and there is nothing behind it', async () => {
    await render();
    await act(async () => button('Nazad').props.onPress());
    expect(router().back).toHaveBeenCalledTimes(1); expect(router().replace).not.toHaveBeenCalled();
    mockCanGoBack = false;
    await act(async () => button('Nazad').props.onPress());
    expect(router().replace).toHaveBeenCalledWith('/raspored');
  });
});
