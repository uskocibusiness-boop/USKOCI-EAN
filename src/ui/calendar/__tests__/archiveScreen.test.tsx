import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    // A list that draws every item, its header, its empty state and its footer, so what a screen puts in them can be read.
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
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press', PRESS_DELAY: 60 }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => true }));

import { ArchiveScreen, type ArchiveSource } from '../ArchiveScreen';
import { NO_POSAO, agreementOf, applicationOf, needOf } from './fixtures';

let tree: ReactTestRenderer;
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAll(node => node.type === 'Press' as React.ElementType);
const tab = (label: string) => presses().find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label)!;
const rows = () => presses().filter(node => /^Otvori (Dogovor|zadatak|prijavu)/.test(String(node.props.accessibilityLabel))).map(node => node.props.accessibilityLabel);
const button = (label: string) => tree.root.findAll(node => node.props.label === label || node.props.accessibilityLabel === label)[0];
const ready = <Row,>(rows: readonly Row[]): ArchiveSource<Row> => ({ state: 'ready', rows });

const over = {
  agreements: ready([
    agreementOf('done', { stanje: 'COMPLETED', naslov: 'Krečenje stana', vremeTekst: '24. sep · 12:00–19:00' }),
    agreementOf('gone', { stanje: 'CANCELLED', naslov: 'Selidba ormara', vremeTekst: '20. sep · 09:00–12:00' }),
    agreementOf('live', { stanje: 'CONFIRMED', naslov: 'Još traje' }),
  ]),
  needs: ready([needOf('closed', { stanje: 'ZATVORENA', naslov: 'Odvoz šuta', vremeTekst: '10. sep · 09:00–12:00' }), needOf('open', { naslov: 'Još traži' })]),
  applications: ready([applicationOf('closed', { stanje: 'CLOSED', naslov: 'Košenje trave' }), applicationOf('back', { stanje: 'WITHDRAWN', naslov: 'Pomoć oko računara' }),
    applicationOf('sent', { naslov: 'Još čeka' })]),
};
const draw = async (patch: Partial<React.ComponentProps<typeof ArchiveScreen>> = {}) => {
  const handlers = { onBack: jest.fn(), onRefresh: jest.fn(), onRetry: jest.fn(), onOpen: jest.fn() };
  await act(async () => { tree = create(<ArchiveScreen {...over} refreshing={false} {...handlers} {...patch} />); });
  return handlers;
};
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('what is over, for both sides', () => {
  it('lists the finished and cancelled Dogovori, the closed tasks and the closed and withdrawn applications, and nothing that still lives', async () => {
    await draw();
    expect(rows()).toEqual(['Otvori Dogovor Krečenje stana', 'Otvori Dogovor Selidba ormara', 'Otvori zadatak Odvoz šuta',
      'Otvori prijavu Košenje trave', 'Otvori prijavu Pomoć oko računara']);
    for (const alive of ['Još traje', 'Još traži', 'Još čeka']) expect(text()).not.toContain(alive);
  });
  it('groups them as Dogovori, Zadaci and Prijave, each counted in its own plural, and names the screen "Arhiva"', async () => {
    await draw();
    // The bar names the screen; the three groups are headings under it.
    const headings = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.accessibilityRole === 'header');
    expect(headings.map(node => node.props.children)).toEqual(['Arhiva', 'Dogovori', 'Zadaci', 'Prijave']);
    expect(text()).toContain('2 Dogovora'); expect(text()).toContain('1 zadatak'); expect(text()).toContain('2 prijave');
  });
  it('says each in the shared chip\'s words: Završen, Otkazan, Zatvoren, Zatvorena, Povučena', async () => {
    await draw();
    for (const word of ['Završen', 'Otkazan', 'Zatvoren', 'Zatvorena', 'Povučena']) expect([word, text().includes(word)]).toEqual([word, true]);
  });
  it('writes when and where in the thing\'s own words, and who with, and speaks it all with the chip', async () => {
    await draw();
    expect(text()).toContain('24. sep · 12:00–19:00'); expect(text()).toContain('Tvoj zadatak · Marko'); expect(text()).toContain('Liman, Novi Sad');
    const spoken = presses().find(node => node.props.accessibilityLabel === 'Otvori Dogovor Krečenje stana')!.props.accessibilityValue.text as string;
    expect(spoken).toContain('Završen'); expect(spoken).toContain('Tvoj zadatak'); expect(spoken).toContain('24. sep · 12:00–19:00'); expect(spoken).toContain('Marko');
  });
  it('opens the detail each row belongs to', async () => {
    const handlers = await draw();
    for (const label of ['Otvori Dogovor Krečenje stana', 'Otvori zadatak Odvoz šuta', 'Otvori prijavu Košenje trave']) {
      await act(async () => presses().find(node => node.props.accessibilityLabel === label)!.props.onPress());
    }
    expect(handlers.onOpen.mock.calls.map(([entry]) => [entry.kind, entry.id])).toEqual([['dogovor', 'done'], ['zadatak', 'closed'], ['prijava', 'closed']]);
  });
  it('is read-only: no row has a command but to open it', async () => {
    await draw();
    const commands = presses().filter(node => node.props.accessibilityRole === 'button' && !/^Otvori /.test(String(node.props.accessibilityLabel)));
    expect(commands.map(node => node.props.accessibilityLabel)).toEqual(['Nazad']);
  });
  it('says in one quiet sentence under the list that a deleted draft is not kept', async () => {
    await draw();
    expect(text()).toContain('Obrisani nacrti se ne čuvaju.');
  });
});

describe('the quiet chips "Sve · Otkazani · Istekli · Završeni"', () => {
  it('are those four, as the tabs of one list, "Sve" first', async () => {
    await draw();
    const labels = presses().filter(node => node.props.accessibilityRole === 'tab').map(node => node.props.accessibilityLabel);
    expect(labels).toEqual(['Sve', 'Otkazani', 'Istekli', 'Završeni']);
    expect(tab('Sve').props.accessibilityState).toEqual({ selected: true });
  });
  it('narrow the list: the cancelled are a Dogovor and an application I took back; the finished are the finished ones', async () => {
    await draw();
    await act(async () => tab('Otkazani').props.onPress());
    expect(rows()).toEqual(['Otvori Dogovor Selidba ormara', 'Otvori prijavu Pomoć oko računara']);
    await act(async () => tab('Završeni').props.onPress());
    expect(rows()).toEqual(['Otvori Dogovor Krečenje stana']);
    await act(async () => tab('Sve').props.onPress());
    expect(rows()).toHaveLength(5);
  });
  it('say that some things have no kept reason, and where to find them, while a chip other than "Sve" is on', async () => {
    await draw();
    expect(text()).not.toContain('razlog zatvaranja');
    await act(async () => tab('Otkazani').props.onPress());
    expect(text()).toContain('Neke stavke nemaju zabeležen razlog zatvaranja. Vidiš ih pod „Sve“.');
  });
  it('say "none" for a chip with nothing in it, in its own word, and keep the sentence about the reasons', async () => {
    await draw();
    await act(async () => tab('Istekli').props.onPress());
    expect(rows()).toEqual([]);
    expect(text()).toContain('Nema isteklih.'); expect(text()).toContain('razlog zatvaranja');
    await act(async () => tab('Završeni').props.onPress());
    await draw({ agreements: ready([]) });
    await act(async () => tab('Završeni').props.onPress());
    expect(text()).toContain('Nema završenih.');
  });
});

describe('an archive with nothing in it, one still loading, and one that failed', () => {
  it('says it is empty only when all three reads have answered and found nothing', async () => {
    await draw({ agreements: ready([]), needs: ready([]), applications: ready([]) });
    expect(text()).toContain('Arhiva je prazna.'); expect(text()).toContain('Ovde će stajati završeni, otkazani i istekli zadaci, prijave i Dogovori.');
    expect(text()).toContain('Obrisani nacrti se ne čuvaju.');
    expect(tab('Sve')).toBeDefined();
  });
  it('shows a loading list, never an empty archive, while a read is still going', async () => {
    await draw({ agreements: ready([]), needs: { state: 'loading' }, applications: ready([]) });
    expect(text()).toContain('Učitavamo arhivu…'); expect(text()).not.toContain('Arhiva je prazna.');
    await act(async () => tab('Otkazani').props.onPress());
    expect(text()).toContain('Učitavamo arhivu…'); expect(text()).not.toContain('Nema otkazanih.');
  });
  it('draws what has come while another read is still going', async () => {
    await draw({ needs: { state: 'loading' } });
    expect(rows()).toEqual(['Otvori Dogovor Krečenje stana', 'Otvori Dogovor Selidba ormara', 'Otvori prijavu Košenje trave', 'Otvori prijavu Pomoć oko računara']);
  });
  it('says the archive could not be read when every read failed, and offers to read it again', async () => {
    const handlers = await draw({ agreements: { state: 'error' }, needs: { state: 'error' }, applications: { state: 'error' } });
    expect(text()).toContain('Arhiva nije učitana.'); expect(text()).not.toContain('Arhiva je prazna.'); expect(text()).not.toContain('Obrisani nacrti');
    await act(async () => button('Pokušaj ponovo').props.onPress());
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });
  it('says which read failed and keeps the rest, never calling the archive short', async () => {
    const handlers = await draw({ needs: { state: 'error' } });
    expect(text()).toContain('Moji zadaci nisu učitani.');
    expect(rows()).toEqual(['Otvori Dogovor Krečenje stana', 'Otvori Dogovor Selidba ormara', 'Otvori prijavu Košenje trave', 'Otvori prijavu Pomoć oko računara']);
    await act(async () => button('Pokušaj ponovo').props.onPress());
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });
  it('claims no "Nema …" and no empty archive while a read is missing', async () => {
    await draw({ agreements: { state: 'error' }, needs: ready([]), applications: ready([]) });
    expect(text()).toContain('Dogovori nisu učitani.'); expect(text()).not.toContain('Arhiva je prazna.');
    await act(async () => tab('Otkazani').props.onPress());
    expect(text()).toContain('Dogovori nisu učitani.'); expect(text()).not.toContain('Nema otkazanih.');
  });
  it('says each of the three failures in its own words', async () => {
    await draw({ agreements: { state: 'error' }, needs: { state: 'error' }, applications: ready([]) });
    expect(text()).toContain('Dogovori nisu učitani.'); expect(text()).toContain('Moji zadaci nisu učitani.');
    await act(async () => tree.unmount());
    await draw({ agreements: ready([]), needs: ready([]), applications: { state: 'error' } });
    expect(text()).toContain('Moje prijave nisu učitane.');
  });
});

describe('the pull and the words', () => {
  it('re-reads on a pull and goes back by the arrow', async () => {
    const handlers = await draw({ refreshing: true });
    const list = tree.root.findByType('List' as React.ElementType);
    expect(list.props.refreshing).toBe(true); expect(list.props.onRefresh).toBe(handlers.onRefresh);
    await act(async () => button('Nazad').props.onPress());
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
  });
  it('never says "posao", in any state', async () => {
    const states: Partial<React.ComponentProps<typeof ArchiveScreen>>[] = [{}, { agreements: ready([]), needs: ready([]), applications: ready([]) },
      { agreements: { state: 'error' }, needs: { state: 'error' }, applications: { state: 'error' } }, { needs: { state: 'loading' } }];
    for (const patch of states) {
      await draw(patch);
      for (const label of ['Otkazani', 'Istekli', 'Završeni', 'Sve']) {
        await act(async () => tab(label).props.onPress());
        expect(text()).not.toMatch(NO_POSAO);
        expect(rows().join(' ')).not.toMatch(NO_POSAO);
      }
      await act(async () => tree.unmount());
    }
  });
});
