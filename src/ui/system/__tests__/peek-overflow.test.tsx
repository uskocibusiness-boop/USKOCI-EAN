import React from 'react';
import { StyleSheet, View } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import type { MarketplaceItem } from '../../../data/marketplaceView';

let mockWindow = { width: 320, height: 640, scale: 2, fontScale: 2 };
const mockBack = new Set<() => boolean>();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => mockWindow;
    if (key === 'BackHandler') return { addEventListener: (_name: string, listener: () => boolean) => {
      mockBack.add(listener); return { remove: () => mockBack.delete(listener) };
    } };
    return ['View', 'ScrollView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../Text', () => ({ T: 'T' }));

import { PeekSheet } from '../PeekSheet';
import { DiscoveryPeek } from '../../v2/discovery/DiscoveryPeek';

/** A stranger's task, as the discovery read maps it (a task of mine would carry its own state and no person to introduce). */
const task = (id = 'one'): MarketplaceItem => ({
  id, naslov: 'Pomoć pri prenošenju i raspoređivanju nameštaja u Novom Sadu', opis: '', statusTekst: 'Otvoren',
  podrucjeTekst: 'Novi Sad, Petrovaradin, Podgrađe', vremeTekst: '25. sep · 12:00–19:00', uslovi: [],
  rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 25_000, valuta: 'RSD', prikaz: '25.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 },
  narucilacProfilId: 'profil-1', narucilacIme: 'Nikola Petrović', narucilacOcena: '4.8', narucilacBrojOcena: 12, priblizno: null,
} as MarketplaceItem);
const onClose = jest.fn(), onOpen = jest.fn(), onHeight = jest.fn(), onShowPlace = jest.fn();
let tree: ReactTestRenderer;
const pin = task();
const render = async (props: Partial<React.ComponentProps<typeof DiscoveryPeek>> = {}) => act(async () => {
  tree = create(<DiscoveryPeek item={pin} place={[]} relation={() => undefined} active bottomInset={12} reduced={false}
    onOpen={onOpen} onClose={onClose} onHeight={onHeight} onShowPlace={onShowPlace} {...props} />);
});
const under = (node: ReactTestInstance, parent: ReactTestInstance) => {
  for (let at = node.parent; at; at = at.parent) if (at === parent) return true;
  return false;
};
const press = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
beforeEach(() => { jest.clearAllMocks(); mockWindow = { width: 320, height: 640, scale: 2, fontScale: 2 }; });
afterEach(async () => { await act(async () => tree?.unmount()); expect(mockBack.size).toBe(0); });

test.each([1, 2])('the pin body can scroll within its existing cap while close stays outside it: fontScale=%s', async fontScale => {
  mockWindow = { ...mockWindow, fontScale }; await render();
  const sheet = tree.root.findByType(BottomSheet), scroll = tree.root.findByType(BottomSheetScrollView);
  const card = press(`Otvori zadatak: ${pin.naslov}`), close = press('Zatvori pregled zadatka');
  const cap = 640 * (fontScale >= 1.3 ? 0.75 : 0.5);
  expect(sheet.props).toMatchObject({ detached: true, enableDynamicSizing: true, enablePanDownToClose: true, maxDynamicContentSize: cap, handleComponent: null });
  expect(tree.root.findAllByType(BottomSheetView)).toHaveLength(0);
  expect(under(card, scroll)).toBe(true); expect(under(close, scroll)).toBe(false);
  expect(StyleSheet.flatten(close.props.style)).toMatchObject({ width: 48, height: 48 });
  const overlay = tree.root.findAll(node => node.props.pointerEvents === 'box-none' && StyleSheet.flatten(node.props.style)?.position === 'absolute');
  expect(overlay).toHaveLength(1); expect(under(close, overlay[0])).toBe(true);
  // The pin card is the list card's face (`TaskRecordBody`): the whole title, the amount, where, when and who, each said once in the scrollable.
  const said = (value: string) => scroll.findAll(node => String(node.type) === 'T' && node.props.children === value);
  expect(said(pin.naslov)).toHaveLength(1); expect(said(pin.naslov)[0].props.numberOfLines).toBeUndefined();
  expect(said('25.000 RSD')).toHaveLength(1); expect(said('25.000 RSD')[0].props.variant).toBe('priceRow');
  expect(said(pin.podrucjeTekst)).toHaveLength(1); expect(said(pin.vremeTekst)).toHaveLength(1);
  expect(said('Nikola Petrović')).toHaveLength(1);
  // Feed an overflow measurement: the map clears the visible cap, while all facts remain in the registered scrollable.
  await act(async () => card.parent!.props.onLayout({ nativeEvent: { layout: { height: 560 } } }));
  expect(onHeight).toHaveBeenLastCalledWith(cap);
  await act(async () => card.props.onPress()); expect(onOpen).toHaveBeenCalledWith(pin); expect(onClose).not.toHaveBeenCalled();
  await act(async () => { close.props.onPress(); close.props.onPress(); }); expect(onClose).toHaveBeenCalledTimes(1);
});

test('a place keeps its bounded rows and whole-list action scrollable with a persistent close', async () => {
  const place = [task('a'), task('b'), task('c'), task('d')]; await render({ item: null, place });
  const scroll = tree.root.findByType(BottomSheetScrollView), close = press('Zatvori pregled zadataka');
  expect(under(close, scroll)).toBe(false);
  const rows = scroll.findAll(node => String(node.type) === 'Press' && /^Pogledaj zadatak /.test(node.props.accessibilityLabel ?? ''));
  expect(rows).toHaveLength(3);
  await act(async () => rows[2].props.onPress()); expect(onOpen).toHaveBeenCalledWith(place[2]);
  const all = press('Prikaži sve u listi'); expect(under(all, scroll)).toBe(true);
  await act(async () => all.props.onPress()); expect(onShowPlace).toHaveBeenCalledTimes(1);
  await act(async () => close.props.onPress()); expect(onClose).toHaveBeenCalledTimes(1);
});

test.each([false, true])('scrollable cards preserve reduced motion and the native swipe completion path: reduced=%s', async reduced => {
  await render({ reduced });
  const sheet = tree.root.findByType(BottomSheet);
  expect(sheet.props.animateOnMount).toBe(!reduced);
  if (reduced) expect(sheet.props.animationConfigs).toEqual({ duration: 0 });
  await act(async () => sheet.props.onClose()); expect(onClose).toHaveBeenCalledTimes(1);
});

test('Back dismisses the focused card once and does not remain registered while its screen is away', async () => {
  await render(); const back = [...mockBack][0];
  await act(async () => { expect(back()).toBe(true); }); expect(onClose).toHaveBeenCalledTimes(1);
  expect(back()).toBe(false);
  await act(async () => tree.update(<DiscoveryPeek item={pin} place={[]} relation={() => undefined} active={false} bottomInset={12} reduced
    onOpen={onOpen} onClose={onClose} onShowPlace={onShowPlace} />));
  expect(mockBack.size).toBe(0);
});

test('generic Peek callers keep the existing static body by default', async () => {
  await act(async () => { tree = create(<PeekSheet label="Pregled" active onClose={onClose}>{() => <View />}</PeekSheet>); });
  expect(tree.root.findAllByType(BottomSheetView)).toHaveLength(1);
  expect(tree.root.findAllByType(BottomSheetScrollView)).toHaveLength(0);
  expect(tree.root.findByType(BottomSheet).props.maxDynamicContentSize).toBe(320);
});
