import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { STANJA_POTREBE, type NeedDetailProjection, type PotrebaProjekcija } from '../../contracts/projections';
import { hasNeedAttention, type MarketplaceItem } from '../marketplaceView';
import { sys } from '../../ui/system/tokens';

/**
 * One task card (composition spec 2026-10-07, 4.2; 8 Oct 2026). The card is a `Surface record` that is touched, and its face is the
 * one the pin's card on the map draws: [state] -> title -> what it pays (a fact row with the money picture, no word for what it is: the owner's
 * pick of 8 Oct 2026) -> where -> when -> (one condition) -> who posted it, and how long ago, with the count of people at the end of that line.
 * It is heard once, as the card's own sentence ("Budžet 5.500 RSD ukupno"). Four type sizes at most. A word about money never wears the
 * amount's type; nothing is invented. The older card review (r3) is carried by the lines that still describe this card.
 */
let mockScale = 1, mockReduced = false, mockWidth = 411;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: mockWidth, height: 900, scale: 2, fontScale: mockScale });
    return key === 'View' ? 'View' : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar' }));
// The card asks the one layout class (`useLayoutClass`), from the same window this suite stands in for the phone.
jest.mock('../../ui/system/textScale', () => { const actual = jest.requireActual('../../ui/system/textScale');
  return { ...actual, useTextScale: () => mockScale, useLayoutClass: () => actual.layoutClassFor(mockWidth, mockScale) }; });
jest.mock('phosphor-react-native', () => ({ CaretRight: 'CaretRight', CaretDown: 'CaretDown', Lightning: 'Lightning' }));
import { TaskCard, CARD_PRESS_SCALE } from '../../ui/v2/TaskCard';
import { TaskAgeContext } from '../../ui/v2/discovery/taskAge';
import { DistanceFromContext } from '../../ui/v2/discovery/taskDistance';
import { CardPlaces, ownerNext, placesText, scheduleConfirmed, taskStatus } from '../../ui/v2/TaskFace';

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
const T_ = 'T' as React.ElementType, PRESS = 'Press' as React.ElementType, VIEW = 'View' as React.ElementType;
const texts = () => tree.root.findAll(node => node.type === T_).flatMap(node => node.children.filter((child): child is string => typeof child === 'string'));
const textNode = (value: string) => tree.root.find(node => node.type === T_ && node.props.children === value);
const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const presses = () => tree.root.findAll(node => node.type === PRESS);
const facts = () => tree.root.findAll(node => node.type === ('FactArt' as React.ElementType)).map(node => node.props.kind);
beforeEach(() => { mockScale = 1; mockReduced = false; mockWidth = 411; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

describe('the face, in its order', () => {
  it('says title, amount with what it buys, where, when, who and the count of people, in that order, and nothing else', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(texts()).toEqual(['Farbanje dnevne sobe', '5.500 RSD', 'ukupno', 'Liman, Novi Sad', '24. sep · 17:00', 'Nikola Petrović', '4,8 (12)', 'Treba 2 osobe']);
    expect(facts()).toEqual(['money', 'pin', 'calendar', 'star', 'users']);
  });

  // The owner, 8 Oct 2026: not the price on the right but under the title with its picture on the left like everything else, and no word
  // that says what it is (people know what it is); only a screen reader is told it is the budget.
  it('draws the amount as the first fact, under the title, with the money picture and no word for what it is', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(texts().join(' ')).not.toMatch(/cena|budžet|cenovnik/i);
    expect(facts()[0]).toBe('money');
    expect(presses()[0].props.accessibilityLabel).toContain('Budžet 5.500 RSD ukupno');
    await act(async () => tree.update(<TaskCard item={task({ rezimCene: 'OFFERS' })} onOpen={jest.fn()} />));
    expect(texts().join(' ')).not.toMatch(/cena|budžet|cenovnik/i);
    expect(facts()[0]).toBe('offers'); expect(facts()).not.toContain('money');
  });

  it('uses four type roles at most: the title, the amount, the facts and the person, the state', async () => {
    await render(<TaskCard item={task({ urgency: LATER, detalji: detail({}, { vozila: ['Kombi'] }) })} relation="APPLIED" onOpen={jest.fn()} />);
    const roles = new Set(tree.root.findAll(node => node.type === T_).map(node => node.props.variant));
    expect([...roles].sort()).toEqual(['heading', 'label', 'note', 'priceRow']);
  });

  it('is one record that is touched: one press, on the row rung, and a title that is never cut', async () => {
    const open = jest.fn();
    await render(<TaskCard item={task()} onOpen={open} />);
    expect(presses()).toHaveLength(1);
    expect(presses()[0].props).toMatchObject({ accessibilityRole: 'button', scaleTo: sys.motion.scale.row, haptic: 'select' });
    expect(textNode('Farbanje dnevne sobe').props.numberOfLines).toBeUndefined();
    await act(async () => presses()[0].props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
    // The other whole cards (my task, my application, a Dogovor) still press by this number until they stand on Surface too.
    expect(CARD_PRESS_SCALE).toBe(0.986);
  });
});

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

  // A vehicle and a tool are FactArt kinds of their own, drawn at the fact row's 24 (`FactRow`); the picker's Pictogram is not drawn on a card.
  it('then the vehicles with the vehicle fact drawing, then the tools with the tool fact drawing', async () => {
    await render(<TaskCard item={task({ detalji: detail({}, { vestine: ['Selidbe'], vozila: ['Kombi'], alati: ['Bušilica'] }) })} onOpen={jest.fn()} />);
    expect(texts()).toContain('Kombi'); expect(texts()).not.toContain('Bušilica'); expect(facts()).toContain('vehicle'); expect(facts()).not.toContain('tool');
    await act(async () => tree.update(<TaskCard item={task({ detalji: detail({}, { vozila: ['Automobil', 'Prikolica'] }) })} onOpen={jest.fn()} />));
    expect(texts()).toContain('Automobil · Prikolica'); expect(facts()).toContain('vehicle');
    await act(async () => tree.update(<TaskCard item={task({ detalji: detail({}, { alati: ['Bušilica'] }) })} onOpen={jest.fn()} />));
    expect(texts()).toContain('Bušilica'); expect(facts()).toContain('tool'); expect(facts()).not.toContain('vehicle');
    expect(tree.root.findAll(node => String(node.type) === 'Pictogram')).toHaveLength(0);
  });
});

describe('the value slot', () => {
  const cases: [string, MarketplaceItem, string][] = [
    ['amount', task(), '5.500 RSD'],
    ['offers', task({ rezimCene: 'OFFERS', ponudjenaCena: { iznos: 9000, valuta: 'RSD', prikaz: '9.000 RSD' } }), 'Tražim ponude'],
    ['no price', task({ rezimCene: 'MY_PRICE', ponudjenaCena: undefined, osnovaCene: null }), 'Cena nije navedena'],
  ];

  it.each([1, 1.3])('is always filled, and a word is never money-styled (text scale %s)', async scale => {
    mockScale = scale;
    for (const [name, item, shown] of cases) {
      await render(<TaskCard item={item} onOpen={jest.fn()} />);
      const value = textNode(shown);
      if (name === 'amount') {
        // The amount is money: the amount role, tabular figures, never cut.
        expect(value.props.variant).toBe('priceRow');
        expect(style(value)).toMatchObject({ color: sys.color.money });
        expect(value.props.numberOfLines).toBeUndefined();
      } else {
        // A word about money is a note in the fact's type, never the amount's role or colour: it cannot be read as a sum.
        expect(value.props.variant).toBe('note');
        expect(style(value)).not.toMatchObject({ color: sys.color.money });
        // And it stands beside the price tag, never beside the money.
        expect(facts()[0]).toBe('offers');
      }
      // "Tražim ponude" means offers even when an old amount is still stored beside it.
      if (name === 'offers') expect(texts()).not.toContain('9.000 RSD');
      await act(async () => tree.unmount());
    }
  });

  it('says what the amount buys in one or two words beside it, and nothing when the basis is not named', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(texts()).toContain('ukupno'); expect(texts().join(' ')).not.toContain('ukupno za ceo zadatak');
    await act(async () => tree.update(<TaskCard item={task({ osnovaCene: 'PER_PERSON' })} onOpen={jest.fn()} />));
    expect(texts()).toContain('po osobi');
    await act(async () => tree.update(<TaskCard item={task({ osnovaCene: null })} onOpen={jest.fn()} />));
    expect(texts()).not.toContain('ukupno'); expect(texts()).not.toContain('po osobi');
  });

  it('keeps the whole title and the whole amount at larger text, and stacks the count under the person', async () => {
    mockScale = 1.3;
    await render(<TaskCard item={task({ ponudjenaCena: { iznos: 1250000, valuta: 'RSD', prikaz: '1.250.000 RSD' } })} onOpen={jest.fn()} />);
    expect(textNode('Farbanje dnevne sobe').props.numberOfLines).toBeUndefined();
    expect(textNode('1.250.000 RSD').props.numberOfLines).toBeUndefined();
    const foot = () => tree.root.find(node => node.type === VIEW && node.props.testID === 'task-face-foot');
    expect(style(foot()).flexDirection).toBe('column');
    await act(async () => tree.unmount());
    mockScale = 1;
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(style(foot()).flexDirection).toBe('row');
  });

  it('says the same words to the owner of a task found in discovery as to everybody and as the page of the task does ("Tražim ponude"), never "Tražiš ponude"', async () => {
    await render(<TaskCard item={task({ rezimCene: 'OFFERS' })} relation="OWNED" onOpen={jest.fn()} />);
    expect(texts()).toContain('Tražim ponude'); expect(texts()).not.toContain('Tražiš ponude');
    expect(presses()[0].props.accessibilityLabel).toMatch(/Tražim ponude/); expect(presses()[0].props.accessibilityLabel).not.toMatch(/Tražiš/);
  });
});

describe('the places and the person', () => {
  // The owner's phone of 8 Oct 2026: "bez 0/1 — ništa ne znači onome ko traži zadatak". The count of people is said in words, only for a task that needs more than one, and what is
  // read is the same sentence a screen reader hears. For the one who can come: how many places are left; once all are taken, that.
  it.each([[2, 0, 'Treba 2 osobe'], [3, 0, 'Treba 3 osobe'], [5, 0, 'Treba 5 osoba'], [3, 1, 'Još 2 od 3 mesta'], [3, 2, 'Još 1 od 3 mesta'], [3, 3, 'Sva mesta su popunjena']])(
    'say the people a task needs in words (%s total, %s filled): "%s"', async (ukupno, popunjeno, words) => {
      const pokrivenost = { ukupno, popunjeno, preostalo: ukupno - popunjeno, udeo: popunjeno / ukupno };
      await render(<TaskCard item={task({ pokrivenost })} onOpen={jest.fn()} />);
      expect(texts()).toContain(words);
      expect(texts().join(' ')).not.toMatch(/\d\/\d/);
      expect(facts()).toContain('users');
      expect(presses()[0].props.accessibilityLabel).toContain(words);
    });

  it('says nothing of the count for a task for one person ("0/1" meant nothing), and a face with neither a person nor a count has no foot at all', async () => {
    const one = { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 };
    await render(<TaskCard item={task({ pokrivenost: one })} onOpen={jest.fn()} />);
    expect(texts().join(' ')).not.toMatch(/\d\/\d|osob|mesta/); expect(facts()).not.toContain('users');
    expect(presses()[0].props.accessibilityLabel).not.toMatch(/mesta|osob/);
    // the person is still there: the foot is
    expect(tree.root.findAll(node => node.type === VIEW && node.props.testID === 'task-face-foot')).toHaveLength(1);
    await act(async () => tree.update(<TaskCard item={task({ pokrivenost: one, narucilacIme: undefined, narucilacOcena: undefined, narucilacBrojOcena: undefined, narucilacProfilId: undefined })} onOpen={jest.fn()} />));
    expect(tree.root.findAll(node => node.type === VIEW && node.props.testID === 'task-face-foot')).toHaveLength(0);
  });

  it('retains the full audience-specific count in the shared component used by the composer and preview', async () => {
    const places = { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 };
    await render(<CardPlaces places={places} audience="worker" />);
    expect(texts()).toEqual(['Još 2 od 3 mesta']);
    expect(placesText(places, 'worker').spoken).toBe('Još 2 od 3 mesta');
    await act(async () => tree.update(<CardPlaces places={places} audience="owner" />));
    expect(texts()).toEqual(['1/3 popunjeno']);
  });

  it('show the owner the progress on a task of mine met in discovery, with no person', async () => {
    await render(<TaskCard item={task()} relation="OWNED" onOpen={jest.fn()} />);
    expect(texts()).toContain('Tvoj'); expect(texts()).toContain('Treba 2 osobe');
    await act(async () => tree.update(<TaskCard item={task({ pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 } })} relation="OWNED" onOpen={jest.fn()} />));
    expect(texts()).toContain('1/3 popunjeno'); // the owner reads how far it is, the one who can come reads what is left
    expect(texts()).not.toContain('Nikola Petrović'); expect(tree.root.findAllByType('Avatar' as React.ElementType)).toHaveLength(0);
  });

  it('puts the publisher after the terms with the one initials rule and a rating that says how many reviews it stands on', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(tree.root.findByType('Avatar' as React.ElementType).props).toMatchObject({ initials: 'NP', size: 40 });
    expect(texts()).toContain('Nikola Petrović'); expect(texts()).toContain('4,8 (12)'); expect(facts()).toContain('star');
    // The person is heard with the card, with the count its rating stands on.
    expect(presses()[0].props.accessibilityLabel).toContain('Nikola Petrović, ocena 4,8, 12 ocena');
    expect(texts().indexOf('Nikola Petrović')).toBeGreaterThan(texts().indexOf('5.500 RSD'));
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

describe('how old the task is', () => {
  const ageOf = (value: string | null) => (id: string) => id === 'need-1' ? value : null;

  it('comes from the list that read the task, after the rating, and is heard with the card', async () => {
    await render(<TaskAgeContext.Provider value={ageOf('pre 2 dana')}><TaskCard item={task()} onOpen={jest.fn()} /></TaskAgeContext.Provider>);
    expect(texts()).toContain('· pre 2 dana');
    expect(texts().indexOf('· pre 2 dana')).toBeGreaterThan(texts().indexOf('4,8 (12)'));
    expect(presses()[0].props.accessibilityLabel).toContain('Objavljeno: pre 2 dana');
    await act(async () => tree.update(<TaskAgeContext.Provider value={ageOf('Upravo')}><TaskCard item={task()} onOpen={jest.fn()} /></TaskAgeContext.Provider>));
    expect(presses()[0].props.accessibilityLabel).toContain('Objavljeno: upravo');
  });

  it('is said alone when the poster has no rating, and is not invented where the list does not know it', async () => {
    await render(<TaskAgeContext.Provider value={ageOf('juče')}><TaskCard item={task({ narucilacOcena: null, narucilacBrojOcena: null })} onOpen={jest.fn()} /></TaskAgeContext.Provider>);
    expect(texts()).toContain('juče');
    await act(async () => tree.update(<TaskCard item={task()} onOpen={jest.fn()} />));
    expect(texts().join(' ')).not.toMatch(/pre \d|juče|Upravo/);
    expect(presses()[0].props.accessibilityLabel).not.toContain('Objavljeno');
  });
});

describe('what my own task met in discovery still says', () => {
  it('states the draft and the closure of a task, and never repeats the state its section is named for', async () => {
    await render(<TaskCard item={mine({ stanje: 'NACRT' })} onOpen={jest.fn()} />);
    expect(texts()).toContain('Nacrt');
    await act(async () => tree.update(<TaskCard item={mine({ stanje: 'NACRT' })} sectionSays="NACRT" onOpen={jest.fn()} />));
    expect(texts()).not.toContain('Nacrt');
    await act(async () => tree.update(<TaskCard item={mine({ stanje: 'ZATVORENA' })} sectionSays="ZATVORENA" onOpen={jest.fn()} />));
    expect(texts()).not.toContain('Zatvoren');
    await act(async () => tree.update(<TaskCard item={mine({ stanje: 'DELIMICNO_POPUNJENA', brojPrijavaZaIzbor: null })} sectionSays="ZATVORENA" onOpen={jest.fn()} />));
    expect(texts()).not.toContain('Delimično popunjen');
    // A stranger's task has no own state for a section to name.
    expect(taskStatus(task(), 'APPLIED', 'ZATVORENA')).toEqual({ text: 'Prijava poslata', quiet: false });
  });

  // "Waiting" is the list's own rule, so the card's foot (OwnTaskCard) and the Aktivni badge count can never disagree.
  it('waits exactly when the list\'s attention rule says so, for every state, place count and application count', () => {
    for (const stanje of STANJA_POTREBE) for (const preostalo of [0, 1]) for (const count of [null, undefined, 0, 2]) {
      const item = mine({ stanje, brojPrijavaZaIzbor: count, pokrivenost: { ukupno: 2, popunjeno: 2 - preostalo, preostalo, udeo: 0 } }) as PotrebaProjekcija;
      expect([stanje, preostalo, count, ownerNext(item)?.kind === 'waiting']).toEqual([stanje, preostalo, count, hasNeedAttention(item)]);
    }
  });
});

// The approved plan of 8 Oct 2026 (U2, U3): "Tvoj zadatak" is no label above the title any more but a small mark in the amount's row ("Tvoj", "Prijava poslata"); the place says how
// far the task is ("mesto · udaljenost") only when the app really knows where the person is and where the task is; "0/1" is gone, and the count of people is said only above one.
describe('what this account is to the task, and how far it is', () => {
  const mark = () => tree.root.findAll(node => node.type === VIEW && node.props.testID === 'task-face-mark');
  const markWords = () => mark().flatMap(node => node.findAll(child => child.type === T_).flatMap(text => text.children.filter((child): child is string => typeof child === 'string')));

  it.each([
    ['OWNED', 'Tvoj', 'Tvoj zadatak'], ['APPLIED', 'Prijava poslata', 'Prijava poslata'],
    ['UNKNOWN', 'Status nije potvrđen', 'Tvoj status nije potvrđen'], ['PENDING', 'Proveravamo…', 'Proveravamo…'],
  ] as const)('%s is the mark "%s" at the end of the amount\'s row, and the card\'s sentence still says "%s"', async (relation, words, spoken) => {
    await render(<TaskCard item={task()} relation={relation} onOpen={jest.fn()} />);
    expect(markWords()).toEqual([words]);
    // nothing stands above the title: the first words of the face are the title, and the mark comes after the amount
    expect(texts()[0]).toBe('Farbanje dnevne sobe');
    expect(texts().indexOf(words)).toBeGreaterThan(texts().indexOf('5.500 RSD'));
    expect(texts().indexOf(words)).toBeLessThan(texts().indexOf('Liman, Novi Sad'));
    expect(presses()[0].props.accessibilityLabel).toContain(spoken);
    // the mark is the card's own state look: a dot and a word, and a state that is not known is quiet
    expect(mark()[0].findAll(node => node.props.testID === 'card-status-dot')).toHaveLength(1);
  });

  it('is nothing for a task that is not mine and not applied to: no mark, no empty row', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(mark()).toHaveLength(0);
    await act(async () => tree.update(<TaskCard item={task()} relation={undefined} onOpen={jest.fn()} />));
    expect(mark()).toHaveLength(0);
  });

  it('keeps HITNO and the life of a task above the title: a draft or a closed task is a state, not a relation', async () => {
    await render(<TaskCard item={task({ urgency: LATER })} relation="APPLIED" onOpen={jest.fn()} />);
    expect(markWords()).toEqual(['Prijava poslata']);
    expect(texts()).not.toContain('Tvoj zadatak');
    await act(async () => tree.update(<TaskCard item={mine({ stanje: 'NACRT' })} onOpen={jest.fn()} />));
    expect(texts()[0]).toBe('Nacrt'); expect(mark()).toHaveLength(0);
  });

  it('puts the mark under the amount where the window is narrow or the text large', async () => {
    mockWidth = 411; mockScale = 1;
    await render(<TaskCard item={task()} relation="APPLIED" onOpen={jest.fn()} />);
    const line = () => style(tree.root.find(node => node.type === VIEW && node.props.testID === 'task-face-value'));
    expect(line().flexDirection).toBe('row');
    for (const [width, scale] of [[320, 1], [361, 1.3], [411, 2]]) {
      mockWidth = width; mockScale = scale; await act(async () => tree.update(<TaskCard item={task()} relation="OWNED" onOpen={jest.fn()} />));
      expect([width, scale, line().flexDirection]).toEqual([width, scale, 'column']);
      expect(style(mark()[0]).maxWidth).toBe('100%');
    }
  });

  const NEAR: readonly [number, number] = [19.835, 45.255];
  it('says how far the task is after the place, only once the person has said where they are and the task has a public point', async () => {
    const at = (patch: Record<string, unknown> = {}) => task({ priblizno: { lat: 45.24, lng: 19.8 }, ...patch });
    // nobody has asked for the position: no distance, and none is invented
    await render(<TaskCard item={at()} onOpen={jest.fn()} />);
    expect(texts()).toContain('Liman, Novi Sad'); expect(texts().join(' ')).not.toMatch(/ km/);
    expect(presses()[0].props.accessibilityLabel).not.toMatch(/ km/);
    // the person's position is known: "mesto · udaljenost", whole kilometres, and the sentence says it too
    await act(async () => tree.update(<DistanceFromContext.Provider value={NEAR}><TaskCard item={at()} onOpen={jest.fn()} /></DistanceFromContext.Provider>));
    expect(texts()).toContain('Liman, Novi Sad · oko 3 km');
    expect(presses()[0].props.accessibilityLabel).toContain('Liman, Novi Sad, oko 3 km, 24. sep · 17:00');
    expect(facts()).toContain('pin');
    // a task close by says so in words, and one without a point on the map, or done remotely, says nothing of distance
    await act(async () => tree.update(<DistanceFromContext.Provider value={NEAR}><TaskCard item={at({ priblizno: { lat: 45.26, lng: 19.84 } })} onOpen={jest.fn()} /></DistanceFromContext.Provider>));
    expect(texts()).toContain('Liman, Novi Sad · manje od 1 km');
    await act(async () => tree.update(<DistanceFromContext.Provider value={NEAR}><TaskCard item={at({ priblizno: null })} onOpen={jest.fn()} /></DistanceFromContext.Provider>));
    expect(texts()).toContain('Liman, Novi Sad'); expect(texts().join(' ')).not.toMatch(/ km/);
    await act(async () => tree.update(<DistanceFromContext.Provider value={NEAR}><TaskCard item={at({ detalji: detail({ rezimLokacije: 'REMOTE' }) })} onOpen={jest.fn()} /></DistanceFromContext.Provider>));
    expect(texts()).toContain('Na daljinu'); expect(texts().join(' ')).not.toMatch(/ km/);
  });
});

describe('what a screen reader hears', () => {
  // The card is heard once: its command name, then every fact it shows in order. Nothing inside it is a stop of its own.
  it('is one sentence after the command name, in the order the face is drawn', async () => {
    await render(<TaskCard item={task({ urgency: LATER, detalji: detail({}, { vozila: ['Kombi'] }) })} relation="APPLIED" onOpen={jest.fn()} />);
    const [card] = presses();
    expect(card.props.accessibilityLabel).toBe('Otvori zadatak Farbanje dnevne sobe. HITNO, Prijava poslata, Budžet 5.500 RSD ukupno, Liman, Novi Sad, 24. sep · 17:00, '
      + 'Potrebno vozilo: Kombi, Treba 2 osobe, Nikola Petrović, ocena 4,8, 12 ocena');
    await act(async () => tree.update(<TaskCard item={task({ rezimCene: 'OFFERS' })} onOpen={jest.fn()} />));
    expect(presses()[0].props.accessibilityLabel).toMatch(/^Otvori zadatak Farbanje dnevne sobe\. Tražim ponude, /);
  });

  it('has no stop of its own inside: the whole face sits under a subtree hidden from assistive technology', async () => {
    await render(<TaskCard item={task({ urgency: LATER })} onOpen={jest.fn()} />);
    const [card] = presses();
    const hidden = (node: ReactTestInstance): boolean => node !== card && (node.props.importantForAccessibility === 'no-hide-descendants'
      && node.props.accessibilityElementsHidden === true || !!node.parent && hidden(node.parent));
    const stops = card.findAll(node => node !== card && (node.props.accessible === true || typeof node.props.accessibilityLabel === 'string'));
    expect(stops.length).toBeGreaterThan(0);
    for (const stop of stops) expect(hidden(stop)).toBe(true);
  });
});

describe('the time and its picture', () => {
  it('draws the time as a fact with the time picture, and never as a confirmation', async () => {
    await render(<TaskCard item={task({ schedule: { kind: 'FLEXIBLE', startsAt: '2026-09-24T00:00:00Z', endsAt: '2026-09-30T22:00:00Z' } })} onOpen={jest.fn()} />);
    expect(facts()).toContain('calendar'); expect(facts()).not.toContain('check');
  });

  // Item 1 of the older review: "Fleksibilan raspon · 24. sep – 30. sep" lost its end date on one line at 360 dp.
  it.each([1, 1.3])('retains the complete time range at every text size (text scale %s)', async scale => {
    mockScale = scale;
    await render(<TaskCard item={task({ vremeTekst: 'Fleksibilan raspon · 24. sep – 30. sep' })} onOpen={jest.fn()} />);
    expect(textNode('Fleksibilan raspon · 24. sep – 30. sep').props.numberOfLines).toBeUndefined();
  });

  it('keeps the schedule confirmation classifier independent of the artwork', () => {
    const FIXED = { kind: 'FIXED_WINDOW', startsAt: '2026-09-24T15:00:00Z', endsAt: '2026-09-24T17:00:00Z' } as const;
    expect([scheduleConfirmed(undefined), scheduleConfirmed(FIXED), scheduleConfirmed({ kind: 'FLEXIBLE', startsAt: FIXED.startsAt, endsAt: FIXED.endsAt }),
      scheduleConfirmed({ kind: 'FIXED_WINDOW', startsAt: null, endsAt: null })]).toEqual([false, true, false, false]);
  });
});

describe('the face holds under a narrow window and large text', () => {
  it.each([[320, 1], [361.14, 1.15], [411, 1.3], [320, 2]])('keeps the whole title, the whole range and the whole person at %s dp, text scale %s', async (width, scale) => {
    mockWidth = width; mockScale = scale;
    await render(<TaskCard item={task({ naslov: 'Pomoć pri selidbi stana sa trećeg sprata bez lifta i rasklapanje velikog ormara',
      narucilacIme: 'Aleksandra Stojanović-Petrović', vremeTekst: 'Fleksibilan raspon · 24. sep – 30. sep' })} onOpen={jest.fn()} />);
    expect(textNode('Pomoć pri selidbi stana sa trećeg sprata bez lifta i rasklapanje velikog ormara').props.numberOfLines).toBeUndefined();
    expect(textNode('Fleksibilan raspon · 24. sep – 30. sep').props.numberOfLines).toBeUndefined();
    expect(textNode('Aleksandra Stojanović-Petrović').props.numberOfLines).toBe(1);
    expect(textNode('Treba 2 osobe').props.numberOfLines).toBeUndefined();
  });
});

describe('the old frame of the card is gone', () => {
  it('draws no frame of its own: the Surface is the only container and there is no card inside it', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    const containers = tree.root.findAll(node => node.type === VIEW && (style(node).borderWidth ?? 0) > 0);
    expect(containers).toHaveLength(0);
  });
});
