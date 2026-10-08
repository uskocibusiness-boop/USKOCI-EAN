import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { sys } from '../../ui/system/tokens';

/**
 * PrijavaCard (plan 2.12, owner 2026-10-07; composition spec 4.7, 2026-10-08): an application as ONE recognisable object for both people
 * who see it. One anatomy — the state as the app's one chip, who it is about, what it is worth on ONE line (the offer and the people), the
 * term, what the person has and the message — and only the head differs: the TASK for the worker, the PERSON for the requester. The worker's
 * term stands before the offer (it says which job this is), the requester's after it. This suite holds the anatomy alone; the worker's shell
 * (`application-face`) and the requester's (`candidate-face`) hold their own.
 */
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return key === 'View' ? 'View' : Reflect.get(target, key); } });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
import { PRICE_NOT_STORED, PrijavaCard, PrijavaPriceText, PrijavaState, prijavaSpoken, prijavaStatusWord, type PrijavaModel, type PrijavaStatus } from '../../ui/v2/PrijavaCard';
import { STATUS_CHIPS } from '../../ui/system/StatusChip';

const model = (patch: Partial<PrijavaModel> = {}): PrijavaModel => ({ status: 'application.sent', who: { kind: 'task', title: 'Krečenje zida' }, term: 'Sutra, fleksibilno',
  price: { kind: 'amount', amount: '350 RSD', basis: 'ukupno' }, people: '1 osoba', message: null, ...patch });
const person = (name = 'Marko Petrović'): PrijavaModel['who'] => ({ kind: 'person', name, avatar: <React.Fragment />, trust: <React.Fragment /> });

let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => act(async () => { tree = create(element); });
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter((child): child is string => typeof child === 'string'));
const chips = () => tree.root.findAll(node => node.type === ('View' as React.ElementType) && node.props.testID === 'status-chip');
const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

const FIVE: PrijavaStatus[] = ['application.sent', 'application.seen', 'application.selected', 'application.notSelected', 'application.withdrawn'];

describe('the state', () => {
  it('is exactly the owner\'s five words, each a key of the one chip table, and every card wears one', async () => {
    expect(FIVE.map(prijavaStatusWord)).toEqual(['Poslata', 'Viđena', 'Izabrana', 'Nije izabrana', 'Povučena']);
    expect(Object.keys(STATUS_CHIPS).filter(key => key.startsWith('application.')).sort()).toEqual([...FIVE].sort());
    for (const status of FIVE) {
      await render(<PrijavaCard model={model({ status })} large={false} />);
      expect(chips()).toHaveLength(1); expect(texts()[0]).toBe(prijavaStatusWord(status));
    }
  });

  it('adds a reason line under the chip only when the model has one, never a second chip, in the warn colour only for a warning', async () => {
    await render(<PrijavaState status="application.sent" reason={{ text: 'Zadatak je izmenjen.', tone: 'warn' }} />);
    expect(texts()).toEqual(['Poslata', 'Zadatak je izmenjen.']); expect(chips()).toHaveLength(1);
    expect(style(tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.children === 'Zadatak je izmenjen.')[0]).color).toBe(sys.color.warn);
    await render(<PrijavaState status="application.notSelected" reason={{ text: 'Zadatak je zatvoren', tone: 'muted' }} />);
    expect(style(tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.children === 'Zadatak je zatvoren')[0]).color).toBe(sys.color.muted);
    await render(<PrijavaState status="application.sent" />);
    expect(texts()).toEqual(['Poslata']);
  });

  it('is read on a sheet and silent inside a card that is one press', async () => {
    const hidden = () => { let at: ReactTestInstance | null = chips()[0]; while (at) { if (at.props.importantForAccessibility === 'no-hide-descendants') return true; at = at.parent; } return false; };
    await render(<PrijavaState status="application.sent" />); expect(hidden()).toBe(false);
    await render(<PrijavaState status="application.sent" silent />); expect(hidden()).toBe(true);
    await render(<PrijavaCard model={model()} large={false} />); expect(hidden()).toBe(true);
  });
});

describe('who it is about', () => {
  it('the worker meets the TASK, the requester the PERSON, and neither meets the other\'s head', async () => {
    await render(<PrijavaCard model={model()} large={false} />);
    expect(texts()).toEqual(['Poslata', 'Krečenje zida', 'Sutra, fleksibilno', '350 RSD', 'ukupno', '·', '1 osoba']);
    await render(<PrijavaCard model={model({ who: person() })} large={false} />);
    expect(texts()).toEqual(['Poslata', 'Marko Petrović', '350 RSD', 'ukupno', '·', '1 osoba', 'Sutra, fleksibilno']);
  });

  it('keeps a long title whole and lets the head carry one quiet mark of its own', async () => {
    const title = 'Prevoz i prenos četiri torbe sa Petrovaradina do centra Novog Sada, uz pomoć dve osobe';
    await render(<PrijavaCard model={model({ who: { kind: 'task', title } })} large trailing={<React.Fragment />} />);
    expect(tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.children === title)[0].props.numberOfLines).toBeUndefined();
  });
});

describe('the facts, in one order for each view', () => {
  it('the worker reads the term, then the offer and the people on one line, then the message; the requester the offer, then the term, then the message', async () => {
    await render(<PrijavaCard model={model({ message: '„Donosim trake.“' })} large={false} />);
    expect(texts().slice(-6)).toEqual(['Sutra, fleksibilno', '350 RSD', 'ukupno', '·', '1 osoba', '„Donosim trake.“']);
    await render(<PrijavaCard model={model({ who: person(), message: '„Donosim trake.“' })} large={false} />);
    expect(texts().slice(-6)).toEqual(['350 RSD', 'ukupno', '·', '1 osoba', 'Sutra, fleksibilno', '„Donosim trake.“']);
  });

  it("the requester's list says the term only when the person proposed one, and says what the person has before the message", async () => {
    await render(<PrijavaCard model={model({ who: person(), showTerm: false, has: { art: 'vehicle', text: 'Ima: Kombi · Trake' }, message: '„Donosim trake.“' })} large={false} />);
    expect(texts()).toEqual(['Poslata', 'Marko Petrović', '350 RSD', 'ukupno', '·', '1 osoba', 'Ima: Kombi · Trake', '„Donosim trake.“']);
    expect(texts()).not.toContain('Sutra, fleksibilno');
  });

  it('draws a fact picture beside the term and beside what the person has, and nowhere else: the offer and the people are one line of words', async () => {
    await render(<PrijavaCard model={model({ message: 'Poruka.' })} large={false} />);
    expect(tree.root.findAll(node => node.type === ('FactArt' as React.ElementType)).map(node => node.props.kind)).toEqual(['calendar']);
    await render(<PrijavaCard model={model({ who: person(), has: { art: 'tool', text: 'Ima: Trake' } })} large={false} />);
    expect(tree.root.findAll(node => node.type === ('FactArt' as React.ElementType)).map(node => node.props.kind)).toEqual(['calendar', 'tool']);
  });

  it('a price that was not stored says "Cena nije navedena" in plain regular grey words, with no figure, no currency and no "ukupno"', async () => {
    await render(<PrijavaCard model={model({ price: { kind: 'unpriced' } })} large={false} />);
    expect(PRICE_NOT_STORED).toBe('Cena nije navedena');
    expect(texts()).toEqual(['Poslata', 'Krečenje zida', 'Sutra, fleksibilno', 'Cena nije navedena', '·', '1 osoba']);
    const word = tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.children === 'Cena nije navedena')[0];
    // The words of a price that is not stored are the quiet `note` type in the muted tone: never the amount's `priceRow` weight, ink or figures.
    expect(word.props).toMatchObject({ variant: 'note', tone: 'muted' }); expect(word.props.variant).not.toBe('priceRow');
    expect(style(word)).not.toHaveProperty('fontVariant');
  });

  it('an amount is ink, bold and tabular, never cut; at large text its basis stacks under it', async () => {
    await render(<PrijavaPriceText price={{ kind: 'amount', amount: '1.250.000 RSD', basis: 'ukupno' }} large={false} />);
    const amount = tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.children === '1.250.000 RSD')[0];
    // The weight and the figures are the `priceRow` type's (a money figure, 16/700, tabular); the colour and the room are the line's.
    expect(amount.props.variant).toBe('priceRow');
    expect(style(amount)).toMatchObject({ color: sys.color.money, textAlign: 'left', maxWidth: '100%', flexShrink: 1 });
    expect(amount.props.numberOfLines).toBeUndefined();
    expect(style(tree.root.findAllByType('View' as React.ElementType)[0])).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    await render(<PrijavaPriceText price={{ kind: 'amount', amount: '1.250.000 RSD', basis: 'ukupno' }} large />);
    expect(style(tree.root.findAllByType('View' as React.ElementType)[0]).flexDirection).toBe('column');
  });

  it('puts the people on the same line as the offer, after a dot, and without the dot when the parts stand under each other', async () => {
    await render(<PrijavaPriceText price={{ kind: 'amount', amount: '350 RSD', basis: 'ukupno' }} large={false} people="2 osobe" />);
    expect(texts()).toEqual(['350 RSD', 'ukupno', '·', '2 osobe']);
    await render(<PrijavaPriceText price={{ kind: 'amount', amount: '350 RSD', basis: 'ukupno' }} large people="2 osobe" />);
    expect(texts()).toEqual(['350 RSD', 'ukupno', '2 osobe']);
  });

  it('clamps a long message only when asked, and the people and the term are never clamped', async () => {
    const message = '„' + 'Donosim trake i zaštitu za nameštaj. '.repeat(6).trim() + '“';
    await render(<PrijavaCard model={model({ message })} large={false} noteLines={2} />);
    const lines = (text: string) => tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.children === text)[0].props.numberOfLines;
    expect(lines(message)).toBe(2); expect(lines('Sutra, fleksibilno')).toBeUndefined(); expect(lines('1 osoba')).toBeUndefined();
    await render(<PrijavaCard model={model({ message })} large={false} />);
    expect(lines(message)).toBeUndefined();
  });

  it('an application that is over keeps its words as readable as any: the chip says it is over, and nothing is faded', async () => {
    await render(<PrijavaCard model={model({ quiet: true, status: 'application.withdrawn' })} large={false} disabled />);
    for (const node of tree.root.findAll(node => node.type === ('View' as React.ElementType))) expect(style(node)).not.toHaveProperty('opacity');
    const title = tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.children === 'Krečenje zida')[0];
    expect(title.props.tone).toBeUndefined();
  });
});

describe('what is heard', () => {
  it('is one sentence in the order it is drawn: the state, the reason, the term, the offer, the people, the message', () => {
    expect(prijavaSpoken(model())).toBe('Poslata, Sutra, fleksibilno, ponuda 350 RSD ukupno, 1 osoba');
    expect(prijavaSpoken(model({ status: 'application.notSelected', reason: { text: 'Zadatak više ne prima prijave.', tone: 'muted' }, message: 'Hvala.' })))
      .toBe('Nije izabrana, Zadatak više ne prima prijave, Sutra, fleksibilno, ponuda 350 RSD ukupno, 1 osoba, poruka: Hvala.');
    expect(prijavaSpoken(model({ price: { kind: 'unpriced' } }))).toBe('Poslata, Sutra, fleksibilno, ponuda Cena nije navedena, 1 osoba');
  });

  it('lets the adapter say the message its own way (the worker\'s own words, a bounded preview) or not at all', () => {
    const spoken = model({ message: '„Donosim trake.“' });
    expect(prijavaSpoken(spoken, { message: 'Donosim trake.', messageLabel: 'tvoja poruka' })).toBe('Poslata, Sutra, fleksibilno, ponuda 350 RSD ukupno, 1 osoba, tvoja poruka: Donosim trake.');
    expect(prijavaSpoken(spoken, { message: null })).toBe('Poslata, Sutra, fleksibilno, ponuda 350 RSD ukupno, 1 osoba');
  });
});
