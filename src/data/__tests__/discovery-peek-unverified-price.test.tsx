import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { MarketplaceItem } from '../marketplaceView';

jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/PeekSheet', () => ({ PEEK_MAX_SHARE: 0.5,
  PeekSheet: ({ children, ...props }: any) => require('react').createElement('PeekSheet', props, typeof children === 'function' ? children() : children) }));
jest.mock('../../ui/system/ScreenChrome', () => ({ ChromeIconButton: 'Close', chrome: { control: 44 } }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Glyph', () => ({ Glyph: 'Glyph' }));
jest.mock('../../ui/v2/TaskPublisherPortrait', () => ({ TaskPublisherPortrait: 'Portrait' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));

import { DiscoveryPeek } from '../../ui/v2/discovery/DiscoveryPeek';

const item = { id: '11111111-1111-4111-8111-111111111111', naslov: 'Selidba', rezimCene: 'MY_PRICE',
  ponudjenaCena: { iznos: 5000, valuta: 'RSD', prikaz: '5.000 RSD' }, osnovaCene: 'TOTAL',
  pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru',
  uslovi: [], narucilacIme: '', detalji: { rezimLokacije: 'STATIONARY' } } as unknown as MarketplaceItem;

test('retained TASK card speaks and shows no old amount until exact confirms the new one', async () => {
  const draw = async (current: MarketplaceItem, priceUnverified: boolean) => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<DiscoveryPeek item={current} place={[]} relation={() => undefined} active bottomInset={0}
      reduced onOpen={() => {}} onShowPlace={() => {}} onClose={() => {}} priceUnverified={priceUnverified} />); });
    const words = tree.root.findAllByType('T' as React.ElementType).map(node => node.children.join(' ')).join(' ');
    const spoken = tree.root.findByType('Press' as React.ElementType).props.accessibilityValue.text as string;
    await act(async () => tree.unmount());
    return { words, spoken };
  };
  const stale = await draw(item, true);
  expect(stale.words).toContain('Cena nije potvrđena');expect(stale.spoken).toContain('Cena nije potvrđena');
  expect(stale.words).not.toContain('5.000 RSD');expect(stale.spoken).not.toContain('5.000 RSD');
  const fresh = await draw({ ...item, ponudjenaCena: { iznos: 6000, valuta: 'RSD', prikaz: '6.000 RSD' } } as MarketplaceItem, false);
  expect(fresh.words).toContain('6.000 RSD');expect(fresh.spoken).toContain('6.000 RSD');
  expect(fresh.words).not.toContain('5.000 RSD');
  const oldOffers = { ...item, rezimCene: 'OFFERS', ponudjenaCena: undefined, osnovaCene: null } as MarketplaceItem;
  const unverifiedOffers = await draw(oldOffers, true);
  expect(unverifiedOffers.words).toContain('Cena nije potvrđena');
  expect(unverifiedOffers.spoken).toContain('Cena nije potvrđena');
  expect(unverifiedOffers.words).not.toContain('Tražim ponude');
  expect(unverifiedOffers.spoken).not.toContain('Tražim ponude');
  const freshOffers = await draw(oldOffers, false);
  expect(freshOffers.words).toContain('Tražim ponude');
  expect(freshOffers.spoken).toContain('Tražim ponude');
});

test('retained PLACE rows suppress old fixed amounts and offer words until POINT_MEMBERS confirms them', async () => {
  const offer = { ...item, id: '33333333-3333-4333-8333-333333333333', rezimCene: 'OFFERS', ponudjenaCena: undefined } as MarketplaceItem;
  const draw = async (priceUnverified: boolean) => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<DiscoveryPeek item={null} place={[item, offer]} relation={() => undefined} active bottomInset={0}
      reduced onOpen={() => {}} onShowPlace={() => {}} onClose={() => {}} priceUnverified={priceUnverified} />); });
    const words = tree.root.findAllByType('T' as React.ElementType).map(node => node.children.join(' ')).join(' ');
    const labels = tree.root.findAllByType('Press' as React.ElementType).map(node => node.props.accessibilityLabel as string).join(' ');
    await act(async () => tree.unmount());
    return { words, labels };
  };
  const stale = await draw(true);
  expect(stale.words).toContain('Uslovi nisu potvrđeni');
  expect(stale.words).not.toContain('5.000 RSD');expect(stale.words).not.toContain('Tražim ponude');
  expect(stale.labels).not.toContain('5.000 RSD');
  const fresh = await draw(false);
  expect(fresh.words).toContain('5.000 RSD ukupno');expect(fresh.words).toContain('Tražim ponude');
});
