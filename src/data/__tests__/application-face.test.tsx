import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { MojaPrijavaProjekcija, StanjeMojePrijave } from '../../contracts/projections';
import { sys } from '../../ui/system/tokens';

/**
 * The face of my application (owner's step 5c, 2026-09-24; one object for both people since 2026-10-07): the shared
 * `PrijavaCard`. The state as the app's one StatusChip in the owner's five words and never a coloured card edge; the title
 * of the task; then the term, the price ("ukupno" under the amount, or "Iznos nije sačuvan"), the people and my message, in
 * that fixed order; and at most ONE foot action, the one the state allows, as a quiet row link beside the body and never a
 * button inside it.
 */
let mockScale = 1;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return key === 'View' ? 'View' : Reflect.get(target, key); } });
});
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
// The face asks the one layout class (`useLayoutClass`); this suite varies the text scale on a roomy 411 dp window, so only the scale decides.
jest.mock('../../ui/system/textScale', () => { const actual = jest.requireActual('../../ui/system/textScale');
  return { ...actual, useTextScale: () => mockScale, useLayoutClass: () => actual.layoutClassFor(411, mockScale) }; });
import { ApplicationCard, applicationFoot, applicationSpoken, applicationStatus, applicationValue, workerPrijava } from '../../ui/v2/ApplicationFace';
import { PrijavaPriceText } from '../../ui/v2/PrijavaCard';
import { STATUS_CHIPS } from '../../ui/system/StatusChip';
import { faceStyles } from '../../ui/v2/TaskFace';

const row = (patch: Partial<MojaPrijavaProjekcija> = {}): MojaPrijavaProjekcija => ({ prijavaId: 'a1', potrebaId: 'n1', potrebaRevizija: 3,
  prijavaRevizija: 3, prijavaVerzija: 1, stanje: 'SUBMITTED', naslov: 'Unos ormara', opis: '', cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' },
  pokrivaMesta: 2, napomena: 'Donosim trake.', podrucjeTekst: 'Liman, Novi Sad', vremeTekst: '20. sep · 10:00–11:00', dogovorId: null,
  promenjenaPotreba: false, mozePovuci: true, traziPaznju: false, ...patch });
/** The row as the server hands each state over: withdrawal only on an open application, a Dogovor only once chosen. */
const inState = (stanje: StanjeMojePrijave, patch: Partial<MojaPrijavaProjekcija> = {}) => row({ stanje,
  mozePovuci: ['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(stanje), dogovorId: stanje === 'SELECTED' ? 'g1' : null,
  traziPaznju: stanje === 'SELECTED' || stanje === 'STALE_REVIEW_REQUIRED', ...patch });

let tree: ReactTestRenderer;
const handlers = () => ({ onTask: jest.fn(), onAgreement: jest.fn(), onWithdraw: jest.fn(), onReview: jest.fn() });
const render = async (element: React.ReactElement) => act(async () => { tree = create(element); });
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter((child): child is string => typeof child === 'string'));
const textNode = (value: string) => tree.root.find(node => node.type === ('T' as React.ElementType) && node.props.children === value);
const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const presses = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType));
const frame = () => tree.root.findAll(node => node.type === ('View' as React.ElementType))[0];
beforeEach(() => { mockScale = 1; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

describe('the state: the app\'s one chip, in the owner\'s five words', () => {
  const chips = () => tree.root.findAll(node => node.type === ('View' as React.ElementType) && node.props.testID === 'status-chip');
  const WORDS: [StanjeMojePrijave, string][] = [['SUBMITTED', 'Poslata'], ['VIEWED', 'Viđena'], ['SHORTLISTED', 'Viđena'],
    ['SELECTED', 'Izabrana'], ['STALE_REVIEW_REQUIRED', 'Poslata'], ['WITHDRAWN', 'Povučena'], ['CLOSED', 'Nije izabrana']];
  it.each(WORDS)('%s says "%s" first, as a chip, and the raised card retains a neutral edge', async (state, word) => {
    await render(<ApplicationCard row={inState(state)} {...handlers()} />);
    expect(texts()[0]).toBe(word);
    // Every card has a state, and exactly one.
    expect(chips()).toHaveLength(1);
    expect(chips()[0].props.accessibilityLabel).toBe(word);
    // The state is said by the chip, never by a green or orange card edge.
    expect(style(frame())).toMatchObject({ borderColor: sys.color.line, borderWidth: 1 });
    expect(style(frame())).not.toHaveProperty('borderLeftColor');
  });

  it('no application is left without a state: every state of the read has a chip, and the words are exactly the owner\'s five', () => {
    const every: StanjeMojePrijave[] = ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'STALE_REVIEW_REQUIRED', 'WITHDRAWN', 'SELECTED', 'CLOSED'];
    for (const state of every) {
      const { key, text } = applicationStatus(state);
      expect(STATUS_CHIPS[key].word).toBe(text);
      expect(workerPrijava(inState(state)).status).toBe(key);
    }
    expect(new Set(every.map(state => applicationStatus(state).text))).toEqual(new Set(['Poslata', 'Viđena', 'Izabrana', 'Nije izabrana', 'Povučena']));
  });

  it('never says "Odbijena" or "Zatvorena": CLOSED merges not chosen, expired and a closed task, and is "Nije izabrana"', () => {
    expect(applicationStatus('CLOSED').text).toBe('Nije izabrana');
    for (const [state] of WORDS) expect(applicationStatus(state).text).not.toMatch(/Odbijena|Zatvorena|Zadatak/);
  });

  it('a changed task is still the application that was sent: the chip says "Poslata" and one line under it says the task changed; a closed one says what is true of all its causes', async () => {
    await render(<ApplicationCard row={inState('STALE_REVIEW_REQUIRED')} {...handlers()} />);
    expect(texts().slice(0, 2)).toEqual(['Poslata', 'Zadatak je izmenjen.']);
    expect(style(textNode('Zadatak je izmenjen.')).color).toBe(sys.color.warn);
    await render(<ApplicationCard row={inState('CLOSED')} {...handlers()} />);
    expect(texts().slice(0, 2)).toEqual(['Nije izabrana', 'Zadatak više ne prima prijave.']);
    expect(style(textNode('Zadatak više ne prima prijave.')).color).toBe(sys.color.muted);
    // An open, chosen or withdrawn one needs no line: the chip is all there is to say.
    for (const state of ['SUBMITTED', 'VIEWED', 'SELECTED', 'WITHDRAWN'] as const) {
      await render(<ApplicationCard row={inState(state)} {...handlers()} />);
      expect(texts()[1]).toBe('Unos ormara');
    }
  });

  it('a waiting application carries the card\'s one orange dot, in its foot; the chip itself never turns orange', async () => {
    await render(<ApplicationCard row={inState('STALE_REVIEW_REQUIRED')} {...handlers()} />);
    // Review r4 item 6 (was: the status line in warn with an orange dot, and the foot the same again). The foot carries the one
    // orange dot of the card and the warn words (R1 A13, B1); the chip is the neutral "Poslata".
    expect(tree.root.findAll(node => node.type === ('View' as React.ElementType) && style(node).backgroundColor === sys.color.orange)).toHaveLength(1);
    expect(style(textNode('Pregledaj izmene zadatka')).color).toBe(sys.color.warn);
    expect(style(chips()[0]).backgroundColor).toBe(sys.color.wash);
    await render(<ApplicationCard row={inState('SELECTED')} {...handlers()} />);
    expect(style(chips()[0]).backgroundColor).toBe(sys.color.greenSoft);
    await render(<ApplicationCard row={inState('WITHDRAWN')} {...handlers()} />);
    expect(style(textNode('Povučena')).color).toBe(sys.color.muted);
  });
});

describe('the one foot action', () => {
  const CASES: [string, MojaPrijavaProjekcija, boolean, string | null][] = [
    ['sent', inState('SUBMITTED'), false, 'Povuci prijavu: Unos ormara'],
    ['viewed', inState('VIEWED'), false, 'Povuci prijavu: Unos ormara'],
    ['shortlisted', inState('SHORTLISTED'), false, 'Povuci prijavu: Unos ormara'],
    ['sent, but the server no longer lets it be withdrawn', inState('SUBMITTED', { mozePovuci: false }), false, null],
    ['chosen, with its Dogovor', inState('SELECTED'), false, 'Otvori Dogovor: Unos ormara'],
    ['chosen, the Dogovor not yet there', inState('SELECTED', { dogovorId: null }), false, null],
    // Review r4 item 1: the spoken name starts with the visible words (WCAG 2.5.3); it was "Pregledaj izmene: …".
    ['waiting for a new check', inState('STALE_REVIEW_REQUIRED'), false, 'Pregledaj izmene zadatka: Unos ormara'],
    ['waiting for a new check, review already open', inState('STALE_REVIEW_REQUIRED'), true, null],
    ['withdrawn', inState('WITHDRAWN'), false, null],
    ['closed', inState('CLOSED'), false, null],
  ];
  it.each(CASES)('%s: the body opens the task, and the foot holds exactly the one action its state allows', async (_name, application, expanded, foot) => {
    await render(<ApplicationCard row={application} expanded={expanded} {...handlers()} />);
    expect(presses().map(node => node.props.accessibilityLabel)).toEqual(['Otvori zadatak: Unos ormara', ...(foot ? [foot] : [])]);
  });

  it('the foot is a sibling of the body, never a target inside it, and each action reaches its own command only', async () => {
    const each = { sent: handlers(), chosen: handlers(), stale: handlers() };
    await render(<ApplicationCard row={inState('SUBMITTED')} {...each.sent} />);
    const [body, foot] = presses();
    expect(body.findAll(node => node.type === ('Press' as React.ElementType))).toHaveLength(1);
    expect(foot.parent).toBe(body.parent);
    await act(async () => foot.props.onPress());
    expect(each.sent.onWithdraw).toHaveBeenCalledTimes(1);
    expect(each.sent.onTask).not.toHaveBeenCalled(); expect(each.sent.onAgreement).not.toHaveBeenCalled();
    await act(async () => body.props.onPress()); expect(each.sent.onTask).toHaveBeenCalledTimes(1);

    await render(<ApplicationCard row={inState('SELECTED')} {...each.chosen} />);
    await act(async () => presses()[1].props.onPress());
    expect(each.chosen.onAgreement).toHaveBeenCalledTimes(1); expect(each.chosen.onWithdraw).not.toHaveBeenCalled();

    await render(<ApplicationCard row={inState('STALE_REVIEW_REQUIRED')} {...each.stale} />);
    await act(async () => presses()[1].props.onPress());
    expect(each.stale.onReview).toHaveBeenCalledTimes(1); expect(each.stale.onWithdraw).not.toHaveBeenCalled();
  });

  it('is a quiet row link on the card\'s white (the waiting one on the wash strip), with 48 px of touch and no fill of its own', async () => {
    await render(<ApplicationCard row={inState('SUBMITTED')} {...handlers()} />);
    const withdraw = presses()[1];
    expect(withdraw.props.style).toBe(faceStyles.footLink);
    expect(style(withdraw)).not.toHaveProperty('backgroundColor');
    expect(style(withdraw).minHeight).toBeGreaterThanOrEqual(48);
    // Review r4 item 7 (was: danger red on every open card). Withdrawing is rare, so the link is quiet ink; the danger
    // colour stays in the question it opens (the screen's ConfirmSheet, tone "danger").
    expect(style(textNode('Povuci prijavu')).color).toBe(sys.color.ink);
    await render(<ApplicationCard row={inState('SELECTED')} {...handlers()} />);
    expect(style(textNode('Otvori Dogovor')).color).toBe(sys.color.green);
    await render(<ApplicationCard row={inState('STALE_REVIEW_REQUIRED')} {...handlers()} />);
    expect(presses()[1].props.style).toBe(faceStyles.ownerFoot);
    expect(style(textNode('Pregledaj izmene zadatka')).color).toBe(sys.color.warn);
  });

  it('while a command runs nothing can be pressed, and the link turns muted instead of fading the card', async () => {
    await render(<ApplicationCard row={inState('SUBMITTED')} disabled {...handlers()} />);
    for (const node of presses()) { expect(node.props.disabled).toBe(true); expect(node.props.accessibilityState).toEqual({ disabled: true }); }
    expect(style(textNode('Povuci prijavu')).color).toBe(sys.color.muted);
    expect(style(frame())).not.toHaveProperty('opacity');
  });

  it('the rule itself: review first for a changed task, a Dogovor only with its id, withdrawal only on the server\'s flag', () => {
    expect(applicationFoot(inState('STALE_REVIEW_REQUIRED', { mozePovuci: true }))).toBe('review');
    expect(applicationFoot(inState('STALE_REVIEW_REQUIRED'), true)).toBeNull();
    expect(applicationFoot(inState('SELECTED', { mozePovuci: true }))).toBe('agreement');
    expect(applicationFoot(inState('SELECTED', { dogovorId: null, mozePovuci: true }))).toBeNull();
    expect(applicationFoot(inState('CLOSED'))).toBeNull();
    expect(applicationFoot(inState('WITHDRAWN'))).toBeNull();
  });
});

describe('the facts, in one fixed order', () => {
  it('says the task, then the term, the price, the people and my message, and nothing else', async () => {
    await render(<ApplicationCard row={row()} {...handlers()} />);
    // The same order on every card of the list and on the requester's card of the same application (PrijavaCard); the foot, when the
    // state allows one, is the last thing on the card.
    expect(texts()).toEqual(['Poslata', 'Unos ormara', '20. sep · 10:00–11:00', '4.500 RSD', 'ukupno', '2 osobe', '„Donosim trake.“', 'Povuci prijavu']);
    await render(<ApplicationCard row={inState('CLOSED')} {...handlers()} />);
    expect(texts()).toEqual(['Nije izabrana', 'Zadatak više ne prima prijave.', 'Unos ormara', '20. sep · 10:00–11:00', '4.500 RSD', 'ukupno', '2 osobe', '„Donosim trake.“']);
  });

  it('says the amount in ink, bold, with tabular figures and its currency kept, and "ukupno" beside it as a quiet word', async () => {
    await render(<ApplicationCard row={row()} {...handlers()} />);
    expect(style(textNode('4.500 RSD'))).toMatchObject({ color: sys.color.money, fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'left' });
    // What the amount buys is a word: it never wears the amount's weight.
    expect(style(textNode('ukupno'))).toMatchObject({ color: sys.color.muted, fontWeight: '500' });
    expect(textNode('ukupno').parent).toBe(textNode('4.500 RSD').parent);
  });

  it('a missing amount says "Iznos nije sačuvan" as a quiet word, never drawn as money', async () => {
    for (const cena of [{ iznos: 0, valuta: 'RSD', prikaz: '' }, { iznos: Number.NaN, valuta: 'RSD', prikaz: 'NaN RSD' }, { iznos: 3000, valuta: 'RSD', prikaz: ' ' }]) {
      await render(<ApplicationCard row={row({ cena })} {...handlers()} />);
      expect(applicationValue({ cena })).toEqual({ kind: 'unpriced' });
      expect(texts()).not.toContain('ukupno');
      const word = style(textNode('Iznos nije sačuvan'));
      expect(word.color).toBe(sys.color.muted); expect(word.color).not.toBe(sys.color.money); expect(word.fontWeight).not.toBe('700');
      // No figure, no currency, and never "0 RSD".
      expect(texts().some(text => /RSD|NaN|^0/.test(text))).toBe(false);
      expect(texts()).not.toContain('Cena nije navedena');
    }
  });

  it('the people follow Serbian counts, and a short message stays complete in quotes', async () => {
    for (const [places, said] of [[1, '1 osoba'], [2, '2 osobe'], [5, '5 osoba'], [12, '12 osoba']] as const) {
      await render(<ApplicationCard row={row({ pokrivaMesta: places })} {...handlers()} />);
      expect(texts()).toContain(said);
    }
    await render(<ApplicationCard row={row({ napomena: '  Donosim trake.  ' })} {...handlers()} />);
    expect(textNode('„Donosim trake.“').props.numberOfLines).toBeUndefined();
    await render(<ApplicationCard row={row({ napomena: '   ' })} {...handlers()} />);
    expect(texts().some(text => text.startsWith('„'))).toBe(false);
  });

  // The people are a count of what the application offered, in every state: nobody "comes" for one that is over, and the read carries no
  // Dogovor state for a chosen one (verify r4b item A), so the card never promises that anyone is coming.
  it.each([['SUBMITTED', 'Poslata'], ['WITHDRAWN', 'Povučena'], ['CLOSED', 'Nije izabrana'], ['SELECTED', 'Izabrana']] as const)('%s says how many people it offered, never that they are coming', async (state, word) => {
    await render(<ApplicationCard row={inState(state)} {...handlers()} />);
    expect(texts()).toContain('2 osobe');
    expect(texts().some(text => /^Dolaz/i.test(text))).toBe(false);
    const reason = state === 'CLOSED' ? ', Zadatak više ne prima prijave' : '';
    expect(presses()[0].props.accessibilityValue.text).toBe(`${word}${reason}, 20. sep · 10:00–11:00, ponuda 4.500 RSD ukupno, 2 osobe, tvoja poruka: Donosim trake.`);
  });

  it('the price stays on its text column, wraps a long amount and keeps the complete title at large text', async () => {
    mockScale = 1.3;
    await render(<ApplicationCard row={row()} {...handlers()} />);
    const amount = textNode('4.500 RSD');
    expect(style(amount).textAlign).toBe('left');
    expect(style(amount.parent!)).toMatchObject({ flexDirection: 'column', flexWrap: 'wrap' });
    expect(style(amount)).toMatchObject({ flexShrink: 1, maxWidth: '100%' });
    expect(textNode('Unos ormara').props.numberOfLines).toBeUndefined();
    mockScale = 1;
    await render(<ApplicationCard row={row()} {...handlers()} />);
    expect(style(tree.root.findByType(PrijavaPriceText).findAllByType('View' as React.ElementType)[0]).flexDirection).toBe('row');
    expect(textNode('4.500 RSD').parent).toBe(textNode('ukupno').parent);
  });

  it('the people and the message are fact pictures of their own, and the amount is the only thing drawn as money', async () => {
    await render(<ApplicationCard row={row()} {...handlers()} />);
    expect(tree.root.findAll(node => node.type === ('FactArt' as React.ElementType)).map(node => node.props.kind)).toEqual(['users', 'chat']);
  });
});

it('is heard once: the command name, then the state, the term, the offer, the people and my message', async () => {
  await render(<ApplicationCard row={inState('SELECTED')} {...handlers()} />);
  expect(presses()[0].props.accessibilityValue).toEqual({ text: 'Izabrana, 20. sep · 10:00–11:00, ponuda 4.500 RSD ukupno, 2 osobe, tvoja poruka: Donosim trake.' });
  expect(applicationSpoken(inState('SELECTED'))).toBe('Izabrana, 20. sep · 10:00–11:00, ponuda 4.500 RSD ukupno, 2 osobe, tvoja poruka: Donosim trake.');
  // The chip is not a stop of its own: it sits inside the one press and is hidden from a screen reader.
  let node: ReactTestInstance | null = tree.root.findAll(node => node.type === ('View' as React.ElementType) && node.props.testID === 'status-chip')[0];
  let hidden = false;
  while (node) { if (node.props.importantForAccessibility === 'no-hide-descendants') hidden = true; node = node.parent; }
  expect(hidden).toBe(true);
});


describe('reading my complete application message', () => {
  const note = 'Poruka sa stvarnim uslovima prijave. '.repeat(8);
  const messageNode = () => textNode(`„${note.trim()}“`);
  const toggle = () => presses().find(node => /Prikaži celu poruku|Prikaži manje/.test(node.props.accessibilityLabel))!;

  it('expands and collapses without opening the task or running an application command', async () => {
    const callbacks = handlers();
    await render(<ApplicationCard row={row({ napomena: note })} {...callbacks} />);
    const body = presses()[0], control = toggle();
    expect(messageNode().props.numberOfLines).toBe(2);
    expect(control.parent).toBe(body.parent);
    expect(body.findAll(node => node.type === ('Press' as React.ElementType))).toHaveLength(1);
    expect(style(control).minHeight).toBeGreaterThanOrEqual(48);
    await act(async () => control.props.onPress());
    expect(messageNode().props.numberOfLines).toBeUndefined();
    expect(toggle().props.accessibilityState.expanded).toBe(true);
    await act(async () => toggle().props.onPress());
    expect(messageNode().props.numberOfLines).toBe(2);
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
  });

  it('retires expansion and captured callbacks across a revision change and return', async () => {
    const callbacks = handlers(), first = row({ napomena: note });
    await render(<ApplicationCard row={first} {...callbacks} />);
    const oldToggle = toggle().props.onPress;
    await act(async () => oldToggle());
    await act(async () => tree.update(<ApplicationCard row={{ ...first, prijavaVerzija: 2 }} {...callbacks} />));
    expect(messageNode().props.numberOfLines).toBe(2);
    await act(async () => tree.update(<ApplicationCard row={first} {...callbacks} />));
    await act(async () => oldToggle());
    expect(messageNode().props.numberOfLines).toBe(2);
    await act(async () => toggle().props.onPress());
    expect(messageNode().props.numberOfLines).toBeUndefined();
  });

  it('a retained toggle obeys the current disabled state', async () => {
    const callbacks = handlers(), application = row({ napomena: note });
    await render(<ApplicationCard row={application} {...callbacks} />);
    const oldToggle = toggle().props.onPress;
    await act(async () => tree.update(<ApplicationCard row={application} {...callbacks} disabled />));
    expect(toggle().props.accessibilityState.disabled).toBe(true);
    await act(async () => oldToggle());
    expect(messageNode().props.numberOfLines).toBe(2);
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
  });
});

// The place is the task's, not the application's: whatever the read says about the execution mode (a server fact, never parsed from words),
// the card draws no place row.
it.each(['REMOTE', 'STATIONARY', undefined] as const)('draws no place for an application of a task with execution mode %s', async mode => {
  const taskFacts = mode ? { raspored: { kind: 'REMOTE_ANYTIME' as const, startsAt: null, endsAt: null },
    rezimLokacije: mode, vremenskaZona: null, rezimCene: 'OFFERS' as const, osnovaCene: null, potrebnoMesta: 1 } : undefined;
  await render(<ApplicationCard row={row({ zadatak: taskFacts, podrucjeTekst: 'Na daljinu' })} {...handlers()} />);
  expect(tree.root.findAll(node => node.type === ('FactArt' as React.ElementType) && ['pin', 'remote'].includes(node.props.kind))).toHaveLength(0);
  expect(texts()).not.toContain('Na daljinu');
});
