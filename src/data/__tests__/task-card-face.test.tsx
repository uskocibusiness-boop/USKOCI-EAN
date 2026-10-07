import React from 'react';
import { CalendarArt } from '../../ui/system/CalendarArt';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { STANJA_POTREBE, type NeedDetailProjection, type PotrebaProjekcija } from '../../contracts/projections';
import { hasNeedAttention, type MarketplaceItem } from '../marketplaceView';
import { sys } from '../../ui/system/tokens';

/**
 * One task card (owner's step 5a, 2026-09-24; emulator critique A8, A9, A10, B13, B14). The card is one face with fixed
 * lines: status when it says something, title with a value slot that is never empty, place, time, at most one
 * requirement a worker decides on (never a skill), and a foot with the places and the person. My own task's next step
 * is a target of its own beside the body, never inside it. Card review r3 (items 1–12) is pinned under "review r3".
 */
let mockScale = 1, mockReduced = false, mockWidth = 411;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: mockWidth, height: 900, scale: 2, fontScale: mockScale });
    return key === 'View' ? 'View' : Reflect.get(target, key);
  } });
});
// The shared Jest stand-in, with a shared value that keeps its box across renders and can be read back, so the card's
// press can be seen to move its frame.
const mockShared: { value: number }[] = [];
jest.mock('react-native-reanimated', () => {
  const base = jest.requireActual('../../../__mocks__/react-native-reanimated.js'), React = require('react');
  return { ...base, ReduceMotion: { System: 'system' },
    useSharedValue: (value: number) => {
      const ref = React.useRef(null);
      if (!ref.current) { const box = { value, get: () => box.value, set: (next: number) => { box.value = next; } }; ref.current = box; mockShared.push(box); }
      return ref.current;
    },
    useAnimatedStyle: (factory: () => object) => factory() };
});
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar' }));
// The card asks the one layout class (`useLayoutClass`), from the same window this suite stands in for the phone.
jest.mock('../../ui/system/textScale', () => { const actual = jest.requireActual('../../ui/system/textScale');
  return { ...actual, useTextScale: () => mockScale, useLayoutClass: () => actual.layoutClassFor(mockWidth, mockScale) }; });
jest.mock('phosphor-react-native', () => ({ CaretRight: 'CaretRight', Lightning: 'Lightning' }));
import { TaskCard, CARD_PRESS_SCALE } from '../../ui/v2/TaskCard';
import { CardDecision, CardPlaces, ownerNext, placesText, scheduleConfirmed, taskStatus } from '../../ui/v2/TaskFace';

const needs = (patch: Partial<NeedDetailProjection['zahtevi']> = {}): NeedDetailProjection['zahtevi'] => ({ vestine: [], alati: [], vozila: [], dozvole: [],
  bitniUslovi: null, iskustvoGodina: null, potvrdjenIdentitet: false, ...patch });
const detail = (patch: Partial<NeedDetailProjection> = {}, zahtevi: Partial<NeedDetailProjection['zahtevi']> = {}): NeedDetailProjection =>
  ({ kategorija: 'Krečenje', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: needs(zahtevi), ...patch });
/** A stranger's task as the discovery read maps it: skills stay in `uslovi` and in `vestine`, conditions in `bitniUslovi`. */
const task = (patch: Record<string, unknown> = {}): MarketplaceItem => ({ id: 'need-1', naslov: 'Farbanje dnevne sobe', podrucjeTekst: 'Liman, Novi Sad',
  vremeTekst: '24. sep · 17:00', statusTekst: 'Otvoren', uslovi: ['Krečenje', 'Valjak'], pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 },
  priblizno: null, narucilacProfilId: 'profile-1', narucilacIme: 'Nikola Petrović', narucilacOcena: '4,8', narucilacBrojOcena: 12,
  rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL', ponudjenaCena: { iznos: 5500, valuta: 'RSD', prikaz: '5.500 RSD' },
  detalji: detail({}, { vestine: ['Krečenje'] }), ...patch }) as MarketplaceItem;
/** My own task as the owned read maps it. */
const mine = (patch: Record<string, unknown> = {}): MarketplaceItem => ({ id: 'mine-1', revizija: 1, naslov: 'Montaža dve police', opis: '', stanje: 'CEKA_PRIJAVE',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: '25. sep · 10:00', podrucjeTekst: 'Grbavica, Novi Sad', uslovi: ['Montaža'],
  brojPrijava: 4, brojPrijavaZaIzbor: 3, rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
  detalji: detail({}, { vestine: ['Montaža'] }), ...patch }) as MarketplaceItem;
const LATER = { level: 'HITNO', expiresAt: '2099-01-01T00:00:00Z' } as const;

let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => act(async () => { tree = create(element); });
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter((child): child is string => typeof child === 'string'));
const textNode = (value: string) => tree.root.find(node => node.type === ('T' as React.ElementType) && node.props.children === value);
const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const presses = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType));
const facts = () => tree.root.findAll(node => node.type === ('FactArt' as React.ElementType)).map(node => node.props.kind);
const frame = () => tree.root.findAll(node => node.type === ('View' as React.ElementType))[0];
beforeEach(() => { mockScale = 1; mockReduced = false; mockWidth = 411; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

describe('the requirement line', () => {
  it('never shows a skill, the category or the mixed `uslovi` list: without a condition, vehicle or tool there is no line', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(texts().join(' ')).not.toMatch(/Krečenje|Valjak/);
    for (const kind of ['info', 'vehicle', 'tool']) expect(facts()).not.toContain(kind);
  });

  it('shows the task\'s own conditions first, wrapping every supplied condition with the info art', async () => {
    await render(<TaskCard item={task({ detalji: detail({}, { vestine: ['Krečenje'], vozila: ['Kombi'], alati: ['Bušilica'],
      bitniUslovi: ['Zgrada bez lifta', 'Orman je već rasklopljen'] }) })} onOpen={jest.fn()} />);
    const line = textNode('Zgrada bez lifta · Orman je već rasklopljen');
    expect(line.props.numberOfLines).toBeUndefined();
    expect(facts()).toContain('info');
    expect(texts().join(' ')).not.toMatch(/Kombi|Bušilica|Krečenje/);
    expect(facts()).not.toContain('vehicle'); expect(facts()).not.toContain('tool');
  });

  // Review r3 item 5: a vehicle and a tool are FactArt kinds of their own, drawn at the card's 16 px; the picker's
  // Pictogram (a 32 px-and-up scene, two of whose fallbacks were orange) is no longer drawn on a card at all.
  it('then the vehicles with the vehicle fact drawing, then the tools with the tool fact drawing, at 28 px', async () => {
    await render(<TaskCard item={task({ detalji: detail({}, { vestine: ['Selidbe'], vozila: ['Kombi'], alati: ['Bušilica'] }) })} onOpen={jest.fn()} />);
    expect(texts()).toContain('Kombi'); expect(texts()).not.toContain('Bušilica'); expect(facts()).toContain('vehicle'); expect(facts()).not.toContain('tool');
    await act(async () => tree.update(<TaskCard item={task({ detalji: detail({}, { vozila: ['Automobil', 'Prikolica'] }) })} onOpen={jest.fn()} />));
    expect(texts()).toContain('Automobil · Prikolica'); expect(facts()).toContain('vehicle');
    // A vehicle nobody named in a picker still draws a vehicle, never a guessed kind of work.
    await act(async () => tree.update(<TaskCard item={task({ detalji: detail({}, { vozila: ['Kamionet sa ceradom'] }) })} onOpen={jest.fn()} />));
    expect(facts()).toContain('vehicle');
    await act(async () => tree.update(<TaskCard item={task({ detalji: detail({}, { alati: ['Bušilica'] }) })} onOpen={jest.fn()} />));
    expect(texts()).toContain('Bušilica'); expect(facts()).toContain('tool'); expect(facts()).not.toContain('vehicle');
    const art = tree.root.findAll(node => node.type === ('FactArt' as React.ElementType) && node.props.kind === 'tool');
    expect(art.map(node => node.props.size)).toEqual([28]);
    expect(tree.root.findAll(node => String(node.type) === 'Pictogram')).toHaveLength(0);
  });
});

describe('the value slot', () => {
  const amountOf = (item: MarketplaceItem) => item.rezimCene !== 'OFFERS' && item.ponudjenaCena?.prikaz ? item.ponudjenaCena.prikaz : null;
  const cases: [string, MarketplaceItem, string][] = [
    ['amount', task(), '5.500 RSD'],
    ['offers', task({ rezimCene: 'OFFERS', ponudjenaCena: { iznos: 9000, valuta: 'RSD', prikaz: '9.000 RSD' } }), 'Tražim ponude'],
    ['no price', task({ rezimCene: 'MY_PRICE', ponudjenaCena: undefined, osnovaCene: null }), 'Cena nije navedena'],
  ];

  it.each([1, 1.3])('is always filled, and a word is never money-styled (text scale %s)', async scale => {
    mockScale = scale;
    for (const [, item, shown] of cases) {
      await render(<TaskCard item={item} onOpen={jest.fn()} />);
      const value = textNode(shown);
      if (amountOf(item)) {
        expect(style(value)).toMatchObject({ color: sys.color.money, fontWeight: '700', fontVariant: ['tabular-nums'] });
      } else {
        // Offers have a distinct verbal cue; absence remains quiet. Neither becomes an amount.
        expect(style(value)).toMatchObject(shown === 'Tražim ponude'
          ? { fontSize: 15, lineHeight: 20, fontWeight: '500', color: sys.color.muted }
          : { fontSize: 15, lineHeight: 20, fontWeight: '500', color: sys.color.muted });
      }
      // Numeric amounts retain tabular figures; neutral titles may now share their ink color.
      if (amountOf(item)) expect(style(value).fontVariant).toContain('tabular-nums');
      // "Tražim ponude" means offers even when an old amount is still stored beside it.
      if (shown === 'Tražim ponude') expect(texts()).not.toContain('9.000 RSD');
      await act(async () => tree.unmount());
    }
  });

  it('says what the amount buys in one or two words under it, and nothing when the basis is not named', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(texts()).toContain('ukupno'); expect(texts().join(' ')).not.toContain('ukupno za ceo zadatak');
    await act(async () => tree.update(<TaskCard item={task({ osnovaCene: 'PER_PERSON' })} onOpen={jest.fn()} />));
    expect(texts()).toContain('po osobi');
    await act(async () => tree.update(<TaskCard item={task({ osnovaCene: null })} onOpen={jest.fn()} />));
    expect(texts()).not.toContain('ukupno'); expect(texts()).not.toContain('po osobi');
  });

  it('allows the whole title to wrap and gives it full width at larger text without changing the value', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    let title = textNode('Farbanje dnevne sobe');
    expect(title.props.numberOfLines).toBeUndefined();
    expect(style(title)).toMatchObject({ color: sys.color.ink });
    expect(style(title)).not.toHaveProperty('flex');
    expect(texts()).toContain('5.500 RSD');
    await act(async () => tree.unmount());
    mockScale = 1.3;
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    title = textNode('Farbanje dnevne sobe');
    expect(title.props.numberOfLines).toBeUndefined();
    expect(style(title)).not.toHaveProperty('flex');
    expect(texts()).toContain('5.500 RSD');
  });
});

describe('the places and the person', () => {
  it.each([[2, 0], [3, 1], [3, 2], [3, 3]])('show filled/total only (%s total, %s filled), while explaining it to a screen reader', async (ukupno, popunjeno) => {
    const pokrivenost = { ukupno, popunjeno, preostalo: ukupno - popunjeno, udeo: popunjeno / ukupno };
    await render(<TaskCard item={task({ pokrivenost })} onOpen={jest.fn()} />);
    expect(texts()).toContain(`${popunjeno}/${ukupno}`);
    expect(texts().join(' ')).not.toMatch(/popunjeno|osob|mesta/);
    expect(facts()).toContain('users');
    expect(presses()[0].props.accessibilityValue.text).toContain(`${popunjeno} od ${ukupno} mesta popunjeno`);
  });

  it('retains the full audience-specific count in the shared component used by the composer and preview', async () => {
    const places = { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 };
    await render(<CardPlaces places={places} audience="worker" />);
    expect(texts()).toEqual(['Još 2 od 3 mesta']);
    expect(placesText(places, 'worker').spoken).toBe('Još 2 od 3 mesta');
    await act(async () => tree.update(<CardPlaces places={places} audience="owner" />));
    expect(texts()).toEqual(['1/3 popunjeno']);
  });

  it('show the owner the progress, on the own list and on a task of mine met in discovery, with no person', async () => {
    await render(<TaskCard item={mine()} onOpen={jest.fn()} />);
    expect(texts()).toContain('0/2'); expect(tree.root.findAllByType('Avatar' as React.ElementType)).toHaveLength(0);
    await act(async () => tree.update(<TaskCard item={task()} relation="OWNED" onOpen={jest.fn()} />));
    expect(texts()).toContain('Tvoj zadatak'); expect(texts()).toContain('0/2');
    expect(texts()).not.toContain('Nikola Petrović'); expect(tree.root.findAllByType('Avatar' as React.ElementType)).toHaveLength(0);
  });

  it('puts the publisher after the terms with the one initials rule and a rating that says how many reviews it stands on', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(tree.root.findByType('Avatar' as React.ElementType).props).toMatchObject({ initials: 'NP' });
    expect(texts()).toContain('Nikola Petrović'); expect(texts()).toContain('4,8 (12)'); expect(facts()).toContain('star');
    // The person is heard with the card (review r3 item 4), with the count its rating stands on.
    expect(presses()[0].props.accessibilityValue.text).toContain('Nikola Petrović, ocena 4,8, 12 ocena');
    expect(texts().indexOf('Nikola Petrović')).toBeGreaterThan(texts().indexOf('5.500 RSD'));
    expect(tree.root.findByType('Avatar' as React.ElementType).props.size).toBe(40);
  });

  it('uses caller-supplied media and restores initials when absent without changing the card action or rating', async () => {
    const open = jest.fn();
    await render(<TaskCard item={task()} portrait={React.createElement('Portrait')} onOpen={open} />);
    expect(tree.root.findAllByType('Portrait' as React.ElementType)).toHaveLength(1);
    expect(tree.root.findAllByType('Avatar' as React.ElementType)).toHaveLength(0);
    expect(texts()).toContain('4,8 (12)');
    await act(async () => presses()[0].props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<TaskCard item={task()} onOpen={open} />));
    expect(tree.root.findByType('Avatar' as React.ElementType).props.initials).toBe('NP');
  });

  it.each([
    ['no reviews yet', { narucilacOcena: null, narucilacBrojOcena: 0 }, 'Još nema ocena', false],
    ['one review', { narucilacOcena: '5,0', narucilacBrojOcena: 1 }, '5,0 (1)', true],
    ['an unknown count', { narucilacOcena: '4,6', narucilacBrojOcena: null }, '4,6', true],
    ['an old read without the field', { narucilacOcena: '4,6', narucilacBrojOcena: undefined }, '4,6', true],
  ])('rate honestly with %s', async (_name, patch, shown, star) => {
    await render(<TaskCard item={task(patch)} onOpen={jest.fn()} />);
    expect(texts()).toContain(shown);
    expect(facts().includes('star')).toBe(star);
    if (patch.narucilacBrojOcena !== 1) expect(texts().join(' ')).not.toMatch(/\(\d+\)/);
  });

  it('draw no rating when none is known, and no person without a name', async () => {
    await render(<TaskCard item={task({ narucilacOcena: null, narucilacBrojOcena: null })} onOpen={jest.fn()} />);
    expect(texts()).toContain('Nikola Petrović'); expect(facts()).not.toContain('star'); expect(texts()).not.toContain('Još nema ocena');
    await act(async () => tree.update(<TaskCard item={task({ narucilacIme: '  ' })} onOpen={jest.fn()} />));
    expect(tree.root.findAllByType('Avatar' as React.ElementType)).toHaveLength(0); expect(texts()).not.toContain('4,8 (12)');
  });

  it('shows only the privacy-safe public start street on the discovery card, never house number or destination', async () => {
    const geografija = { mode: 'POINT_TO_POINT', start: { label: 'Beogradska', area: 'Petrovaradin', city: 'Novi Sad' },
      end: { label: 'Kisačka', city: 'Novi Sad' } };
    await render(<TaskCard item={task({ detalji: detail({ geografija, rezimLokacije: 'POINT_TO_POINT' } as Partial<NeedDetailProjection>) })} onOpen={jest.fn()} />);
    expect(texts()).toContain('Beogradska');
    expect(texts()).not.toContain('Petrovaradin'); expect(texts()).not.toContain('Novi Sad');
    expect(texts().join(' ')).not.toContain('→');
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/Beogradska 21|Kisačka/);
    await act(async () => tree.update(<TaskCard item={task({ detalji: detail({ rezimLokacije: 'REMOTE' }) })} onOpen={jest.fn()} />));
    expect(texts()).toContain('Na daljinu'); expect(facts()).toContain('remote');
  });
});

describe('my own task\'s next step', () => {
  const foot = (text: string) => presses().find(node => String(node.props.accessibilityLabel).startsWith(text));

  // Review r3 item 6 (R1 critique B1): the foot is the card's bottom strip on the quiet wash under one hairline, with an
  // 8 px orange dot and the words in `warn` — no longer an orangeSoft fill, which spent the screen's one orange fill on
  // every waiting card of Moji zadaci. This replaces the earlier pins "orangeSoft" and "no hairline over the foot".
  it('goes straight to the applications through its own target, a sibling of the body and never inside it', async () => {
    const open = jest.fn(), applications = jest.fn();
    await render(<TaskCard item={mine()} onOpen={open} onApplications={applications} />);
    expect(presses()).toHaveLength(2);
    const [body, next] = [presses()[0], foot('3 prijave čekaju izbor')!];
    expect(next.props.accessibilityLabel).toBe('3 prijave čekaju izbor, Montaža dve police');
    expect(body.props.accessibilityLabel).toBe('Otvori zadatak Montaža dve police');
    expect(body.findAll(node => node === next)).toHaveLength(0);
    expect(style(next)).toMatchObject({ minHeight: 48, backgroundColor: sys.color.wash, borderTopWidth: 1, borderTopColor: sys.color.line });
    const dots = next.findAll(node => node.type === ('View' as React.ElementType) && style(node).backgroundColor === sys.color.orange);
    expect(dots).toHaveLength(1); expect(style(dots[0])).toMatchObject({ width: 8, height: 8 });
    expect(style(textNode('3 prijave čekaju izbor'))).toMatchObject({ color: sys.color.warn });
    // No orange fill anywhere on the card: orange is the dot only.
    expect(tree.root.findAll(node => typeof node.type === 'string' && style(node).backgroundColor === sys.color.orangeSoft)).toHaveLength(0);
    // The hairline is the edge between the two targets: the foot reaches no further than itself.
    expect(next.props.hitSlop).toBe(0);
    await act(async () => next.props.onPress());
    expect(applications).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled();
  });

  it('counts in Serbian', async () => {
    await render(<TaskCard item={mine({ brojPrijavaZaIzbor: 1 })} onOpen={jest.fn()} onApplications={jest.fn()} />);
    expect(foot('1 prijava čeka izbor')).toBeTruthy();
    await act(async () => tree.update(<TaskCard item={mine({ brojPrijavaZaIzbor: 5 })} onOpen={jest.fn()} onApplications={jest.fn()} />));
    expect(foot('5 prijava čeka izbor')).toBeTruthy();
  });

  it.each([
    ['none to choose', { brojPrijavaZaIzbor: 0 }, 'Još nema prijava za izbor'],
    ['an unknown count', { brojPrijavaZaIzbor: null }, null],
    ['an old read without the count', { brojPrijavaZaIzbor: undefined }, null],
    ['a closed task', { stanje: 'ZATVORENA' }, null],
    ['a full task', { stanje: 'POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 } }, null],
  ])('has no foot target with %s', async (_name, patch, note) => {
    await render(<TaskCard item={mine(patch)} onOpen={jest.fn()} onApplications={jest.fn()} />);
    expect(presses()).toHaveLength(1);
    expect(texts().join(' ')).not.toMatch(/čeka(ju)? izbor/);
    if (note) expect(style(textNode(note))).toMatchObject({ color: sys.color.muted });
    else expect(texts()).not.toContain('Još nema prijava za izbor');
  });

  it('continues a draft through the card itself, with the draft status and no places', async () => {
    const open = jest.fn();
    await render(<TaskCard item={mine({ stanje: 'NACRT' })} onOpen={open} onApplications={jest.fn()} />);
    expect(presses()).toHaveLength(1); expect(texts()).toContain('Nacrt'); expect(texts()).toContain('Nastavi uređivanje');
    expect(texts().join(' ')).not.toMatch(/popunjeno|prijav/);
    await act(async () => presses()[0].props.onPress()); expect(open).toHaveBeenCalledTimes(1);
  });

  it('labels draft and closure while the capacity fraction conveys fullness', async () => {
    const status = async (stanje: string, word: string | null) => {
      await render(<TaskCard item={mine({ stanje, brojPrijavaZaIzbor: null })} onOpen={jest.fn()} />);
      for (const other of ['Nacrt', 'Delimično popunjen', 'Popunjen', 'Zatvoren']) expect(texts().includes(other)).toBe(other === word);
      await act(async () => tree.unmount());
    };
    await status('OBJAVLJENA', null); await status('CEKA_PRIJAVE', null); await status('DELIMICNO_POPUNJENA', null);
    await status('POPUNJENA', null); await status('ZATVORENA', 'Zatvoren');
  });

  it('still says what waits when no route to it was handed over, inside the one body target, with the same dot and words', async () => {
    await render(<TaskCard item={mine()} onOpen={jest.fn()} />);
    expect(presses()).toHaveLength(1); expect(texts()).toContain('3 prijave čekaju izbor');
    expect(style(textNode('3 prijave čekaju izbor'))).toMatchObject({ color: sys.color.warn });
    expect(presses()[0].findAll(node => node.type === ('View' as React.ElementType) && style(node).backgroundColor === sys.color.orange)).toHaveLength(1);
  });
});

describe('the card', () => {
  it.each([1, 1.3])('keeps each fact in its own row with a single soft task-card edge (text scale %s)', async scale => {
    mockScale = scale;
    await render(<TaskCard item={task({ detalji: detail({}, { bitniUslovi: ['Zgrada bez lifta'] }) })} onOpen={jest.fn()} />);
    for (const words of ['Liman, Novi Sad', '24. sep · 17:00', 'Zgrada bez lifta']) {
      expect(style(textNode(words).parent!).flexWrap).not.toBe('wrap');
    }
    expect(style(frame())).toMatchObject({ borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface });
    expect(presses()).toHaveLength(1);
  });

  // Emulator, round 3c: inside a pin's card on the map the task card was a card inside a card. Bare, the face keeps
  // everything it says and its one press, and draws no edge, corner or padding across of its own.
  it('bare, it draws the face without its own frame and keeps its one press, its words and what it says', async () => {
    const onOpen = jest.fn();
    await render(<TaskCard item={task()} onOpen={onOpen} />);
    const framed = { label: presses()[0].props.accessibilityLabel, value: presses()[0].props.accessibilityValue, texts: texts() };
    await act(async () => tree.update(<TaskCard item={task()} onOpen={onOpen} bare />));
    expect(style(frame())).toMatchObject({ borderWidth: 0, borderRadius: 0, elevation: 0, shadowOpacity: 0 });
    expect(style(presses()[0])).toMatchObject({ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 });
    expect(presses()).toHaveLength(1);
    expect(presses()[0].props.accessibilityLabel).toBe('Otvori priliku Farbanje dnevne sobe');
    expect({ label: presses()[0].props.accessibilityLabel, value: presses()[0].props.accessibilityValue, texts: texts() }).toEqual(framed);
    await act(async () => presses()[0].props.onPress()); expect(onOpen).toHaveBeenCalledTimes(1);
    // My own task's waiting foot inside another card is a flat tint at the control corner, not a card's bottom strip.
    await act(async () => tree.update(<TaskCard item={mine()} onOpen={onOpen} onApplications={jest.fn()} bare />));
    expect(presses()).toHaveLength(2);
    expect(style(presses()[1])).toMatchObject({ borderTopWidth: 0, borderRadius: sys.radius.control,
      borderBottomLeftRadius: sys.radius.control, borderBottomRightRadius: sys.radius.control });
  });
});

describe('review r3', () => {
  // Item 1: "Fleksibilan raspon · 24. sep – 30. sep" lost its end date on one line at 360 dp.
  it.each([1, 1.3])('retains the complete time range at every text size (text scale %s)', async scale => {
    mockScale = scale;
    await render(<TaskCard item={task({ vremeTekst: 'Fleksibilan raspon · 24. sep – 30. sep' })} onOpen={jest.fn()} />);
    expect(textNode('Fleksibilan raspon · 24. sep – 30. sep').props.numberOfLines).toBeUndefined();
  });

  // Item 2: at 320 dp "125.000 RSD" read "125.00…" inside a 42% cap. An amount keeps its whole width; the title gives way.
  it('never cuts an amount and gives non-numeric price wording its own full-width row', async () => {
    await render(<TaskCard item={task({ ponudjenaCena: { iznos: 125000, valuta: 'RSD', prikaz: '125.000 RSD' } })} onOpen={jest.fn()} />);
    const amount = textNode('125.000 RSD');
    expect(amount.props.numberOfLines).toBeUndefined();
    expect(style(amount.parent!)).toMatchObject({ flexWrap: 'wrap' }); expect(style(amount.parent!)).not.toHaveProperty('maxWidth');
    await act(async () => tree.update(<TaskCard item={task({ rezimCene: 'OFFERS' })} onOpen={jest.fn()} />));
    const word = textNode('Tražim ponude');
    expect(style(word.parent!)).not.toHaveProperty('maxWidth');
    expect(textNode('Farbanje dnevne sobe').props.numberOfLines).toBeUndefined();
    expect(style(textNode('Farbanje dnevne sobe'))).not.toHaveProperty('flex');
    expect(style(word)).not.toMatchObject({ color: sys.color.money });
  });

  // R19: the full fraction has a stable lower-right anchor, including a stacked narrow/large-text layout.
  it.each([[411, 1], [320, 2]])('keeps the complete count with the value, separate from the person at width %s, text scale %s', async (width, scale) => {
    mockWidth = width; mockScale = scale;
    for (const item of [task({ narucilacIme: 'Aleksandra Stojanović-Petrović' }), mine({ brojPrijavaZaIzbor: 0 })]) {
      await render(<TaskCard item={item} onOpen={jest.fn()} />);
      const count = textNode('0/2');
      expect(count.props.numberOfLines).toBeUndefined();
      expect(style(count)).toMatchObject({ fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] });
      const anchor = tree.root.findByType(CardDecision);
      expect(anchor.findAll(node => node === count)).toHaveLength(1);
      expect(anchor.findAllByType('Avatar' as React.ElementType)).toHaveLength(0);
      if ('stanje' in item) expect(texts()).toContain('Još nema prijava za izbor');
      else expect(textNode('Aleksandra Stojanović-Petrović').props.numberOfLines).toBe(1);
      await act(async () => tree.unmount());
    }
  });

  // Item 4: a screen reader heard only the title; the facts were unreachable on iOS and 3–5 extra stops on Android.
  it('is heard once: the command name, then every fact it shows in order, with no stop of its own inside', async () => {
    await render(<TaskCard item={task({ urgency: LATER, detalji: detail({}, { vozila: ['Kombi'] }) })} relation="APPLIED" onOpen={jest.fn()} />);
    const [body] = presses();
    expect(body.props.accessibilityLabel).toBe('Otvori priliku Farbanje dnevne sobe');
    expect(body.props.accessibilityValue).toEqual({ text: 'HITNO, Prijava poslata, 5.500 RSD ukupno, Liman, Novi Sad, 24. sep · 17:00, '
      + 'Potrebno vozilo: Kombi, 0 od 2 mesta popunjeno, Nikola Petrović, ocena 4,8, 12 ocena' });
    // Every accessible element inside the card sits under a subtree hidden from assistive technology (the HITNO badge).
    const hidden = (node: ReactTestInstance): boolean => node !== body && (node.props.importantForAccessibility === 'no-hide-descendants'
      && node.props.accessibilityElementsHidden === true || !!node.parent && hidden(node.parent));
    const stops = body.findAll(node => node !== body && (node.props.accessible === true || typeof node.props.accessibilityLabel === 'string'));
    expect(stops.length).toBeGreaterThan(0);
    for (const stop of stops) expect(hidden(stop)).toBe(true);
    // My own task: the draft's next step and a waiting count with no route are heard with the card; a routed foot is its own stop.
    await act(async () => tree.update(<TaskCard item={mine({ stanje: 'NACRT' })} onOpen={jest.fn()} />));
    expect(presses()[0].props.accessibilityValue.text).toBe('Nacrt, 2.000 RSD po osobi, Grbavica, Novi Sad, 25. sep · 10:00, Nastavi uređivanje');
    await act(async () => tree.update(<TaskCard item={mine()} onOpen={jest.fn()} />));
    expect(presses()[0].props.accessibilityValue.text).toBe('2.000 RSD po osobi, Grbavica, Novi Sad, 25. sep · 10:00, 0 od 2 mesta popunjeno, 3 prijave čekaju izbor');
    await act(async () => tree.update(<TaskCard item={mine()} onOpen={jest.fn()} onApplications={jest.fn()} />));
    expect(presses()[0].props.accessibilityValue.text).not.toContain('čekaju izbor');
    await act(async () => tree.update(<TaskCard item={task({ rezimCene: 'OFFERS' })} onOpen={jest.fn()} />));
    expect(presses()[0].props.accessibilityValue.text).toMatch(/^Tražim ponude, /);
  });

  // Item 7: "waiting" is the list's own rule, so the card's foot and the Aktivni badge count can never disagree.
  it('waits exactly when the list\'s attention rule says so, for every state, place count and application count', () => {
    for (const stanje of STANJA_POTREBE) for (const preostalo of [0, 1]) for (const count of [null, undefined, 0, 2]) {
      const item = mine({ stanje, brojPrijavaZaIzbor: count, pokrivenost: { ukupno: 2, popunjeno: 2 - preostalo, preostalo, udeo: 0 } }) as PotrebaProjekcija;
      expect([stanje, preostalo, count, ownerNext(item)?.kind === 'waiting']).toEqual([stanje, preostalo, count, hasNeedAttention(item)]);
    }
  });

  // Item 9: the content used to shrink inside a frame that stood still. The frame is what scales, border and all.
  it('gives under the finger as one object, frame and all, from either target; under reduced motion nothing moves', async () => {
    await render(<TaskCard item={mine()} onOpen={jest.fn()} onApplications={jest.fn()} />);
    expect(style(frame())).toMatchObject({ borderWidth: 1, transform: [{ scale: 1 }] });
    const [body, next] = presses();
    expect(body.props.scaleTo).toBe(1); expect(next.props.scaleTo).toBe(1);
    const scale = mockShared[mockShared.length - 1];
    for (const target of [body, next]) {
      await act(async () => target.props.onPressIn()); expect(scale.value).toBe(CARD_PRESS_SCALE);
      await act(async () => target.props.onPressOut()); expect(scale.value).toBe(1);
    }
    expect(CARD_PRESS_SCALE).toBe(0.986);
    await act(async () => tree.unmount()); mockReduced = true;
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    const still = mockShared[mockShared.length - 1];
    await act(async () => presses()[0].props.onPressIn()); expect(still.value).toBe(1);
  });

  // Item 10: every card under Nacrti said "Nacrt" and every card under Istorija said "Zatvoren".
  it('does not repeat the state its section is named for, and still says any other', async () => {
    await render(<TaskCard item={mine({ stanje: 'NACRT' })} sectionSays="NACRT" onOpen={jest.fn()} />);
    expect(texts()).not.toContain('Nacrt'); expect(texts()).toContain('Nastavi uređivanje');
    expect(presses()[0].props.accessibilityValue.text).not.toMatch(/^Nacrt/);
    await act(async () => tree.update(<TaskCard item={mine({ stanje: 'ZATVORENA' })} sectionSays="ZATVORENA" onOpen={jest.fn()} />));
    expect(texts()).not.toContain('Zatvoren');
    await act(async () => tree.update(<TaskCard item={mine({ stanje: 'DELIMICNO_POPUNJENA', brojPrijavaZaIzbor: null })} sectionSays="ZATVORENA" onOpen={jest.fn()} />));
    expect(texts()).not.toContain('Delimično popunjen');
    // A stranger's task has no own state for a section to name.
    expect(taskStatus(task(), 'APPLIED', 'ZATVORENA')).toEqual({ text: 'Prijava poslata', quiet: false });
  });

  // Item 12: beside a word, which can take 42% of the width, a long title was cut at two lines on 320–360 dp.
  it('retains the entire title for every price mode, including a narrow phone', async () => {
    mockWidth = 320;
    await render(<TaskCard item={task({ rezimCene: 'OFFERS' })} onOpen={jest.fn()} />);
    expect(textNode('Farbanje dnevne sobe').props.numberOfLines).toBeUndefined();
    await act(async () => tree.update(<TaskCard item={task({ ponudjenaCena: undefined, osnovaCene: null })} onOpen={jest.fn()} />));
    expect(textNode('Farbanje dnevne sobe').props.numberOfLines).toBeUndefined();
    await act(async () => tree.update(<TaskCard item={task()} onOpen={jest.fn()} />));
    expect(textNode('Farbanje dnevne sobe').props.numberOfLines).toBeUndefined();
  });
});

// Owner takeover: calendar art identifies a time fact; the actual schedule text carries certainty.
describe('calendar artwork does not imply confirmation', () => {
  const FIXED = { kind: 'FIXED_WINDOW', startsAt: '2026-09-24T15:00:00Z', endsAt: '2026-09-24T17:00:00Z' } as const;
  const calendar = () => tree.root.findByType(CalendarArt);

  it('uses time artwork for a fixed window, including an end-only window', async () => {
    await render(<TaskCard item={task({ schedule: FIXED })} onOpen={jest.fn()} />);
    expect(calendar().props).toMatchObject({ size: 28, quiet: false });
    await act(async () => tree.update(<TaskCard item={task({ schedule: { kind: 'FIXED_WINDOW', startsAt: null, endsAt: '2026-09-24T17:00:00Z' } })} onOpen={jest.fn()} />));
    expect(calendar().props).toMatchObject({ size: 28, quiet: false });
  });

  it.each(['FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'] as const)('uses time artwork for a %s term without branding it confirmed', async kind => {
    await render(<TaskCard item={task({ schedule: { kind, startsAt: '2026-09-24T00:00:00Z', endsAt: '2026-09-30T22:00:00Z' } })} onOpen={jest.fn()} />);
    expect(calendar().props).toMatchObject({ size: 28, quiet: false });
  });

  it('keeps fallback words when a schedule is absent and the same neutral time role on owned tasks', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(calendar().props).toMatchObject({ size: 28, quiet: false });
    expect(textNode('24. sep · 17:00')).toBeTruthy();
    await act(async () => tree.update(<TaskCard item={task({ schedule: { kind: 'FIXED_WINDOW', startsAt: null, endsAt: null } })} onOpen={jest.fn()} />));
    expect(calendar().props).toMatchObject({ size: 28, quiet: false });
    // My own task has the same rule.
    await act(async () => tree.update(<TaskCard item={mine({ schedule: FIXED })} onOpen={jest.fn()} />));
    expect(calendar().props).toMatchObject({ size: 28, quiet: false });
    await act(async () => tree.update(<TaskCard item={mine()} onOpen={jest.fn()} />));
    expect(calendar().props).toMatchObject({ size: 28, quiet: false });
  });

  it('keeps the schedule confirmation classifier independent of the artwork', async () => {
    expect([scheduleConfirmed(undefined), scheduleConfirmed(FIXED), scheduleConfirmed({ kind: 'FLEXIBLE', startsAt: FIXED.startsAt, endsAt: FIXED.endsAt }),
      scheduleConfirmed({ kind: 'FIXED_WINDOW', startsAt: null, endsAt: null })]).toEqual([false, true, false, false]);
  });
});
