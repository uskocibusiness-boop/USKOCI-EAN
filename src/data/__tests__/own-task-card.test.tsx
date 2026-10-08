import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { sys } from '../../ui/system/tokens';

/**
 * One of MY tasks in "Moji zadaci" (plan 2.2 and 3.5, owner 2026-10-07; composition spec 4.5, 2026-10-08): the app's one chip in the owner's
 * eight words, the title, the facts as rows of one kind with their pictures (what it pays, where, when and, only when it is more than one, how many
 * people: the owner's phone of 8 Oct 2026, "0/1" said nothing), and the ONE line of data in grey words. When that line is the way to the applications
 * waiting for my choice ("3 prijave") it is the card's foot, its own press under a line and never inside the body; any other line is quiet text of the
 * body. The card is a `Surface record`.
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
jest.mock('../../ui/system/textScale', () => { const actual = jest.requireActual('../../ui/system/textScale');
  return { ...actual, useTextScale: () => mockScale, useLayoutClass: () => actual.layoutClassFor(411, mockScale) }; });
import { OwnTaskCard } from '../../ui/v2/OwnTaskCard';

const NEED = 'aaaaaaaa-0000-4000-8000-000000000001';
const task = (patch: Record<string, unknown> = {}): PotrebaProjekcija => ({ id: NEED, revizija: 1, naslov: 'Montaža dve police', opis: '', stanje: 'CEKA_PRIJAVE',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: '25. sep · 10:00', podrucjeTekst: 'Grbavica, Novi Sad', uslovi: [],
  brojPrijava: 4, brojPrijavaZaIzbor: 3, rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
  ...patch } as unknown as PotrebaProjekcija);

let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => act(async () => { tree = create(element); });
const T_ = 'T' as React.ElementType, VIEW = 'View' as React.ElementType, PRESS = 'Press' as React.ElementType;
const texts = () => tree.root.findAll(node => node.type === T_).flatMap(node => node.children.filter((child): child is string => typeof child === 'string'));
const presses = () => tree.root.findAll(node => node.type === PRESS);
const chips = () => tree.root.findAll(node => node.type === VIEW && node.props.testID === 'status-chip');
const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const hiddenFromReaders = (node: ReactTestInstance) => { let at: ReactTestInstance | null = node; while (at) { if (at.props.importantForAccessibility === 'no-hide-descendants') return true; at = at.parent; } return false; };
beforeEach(() => { mockScale = 1; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

describe('the state and the one next step', () => {
  it('says "Bira se · 3" first, then the task, and the next step as the foot that opens the applications', async () => {
    const open = jest.fn(), applications = jest.fn();
    await render(<OwnTaskCard item={task()} onOpen={open} onApplications={applications} />);
    expect(texts()[0]).toBe('Bira se · 3');
    expect(chips()).toHaveLength(1); expect(chips()[0].props.accessibilityLabel).toBe('Bira se, 3');
    expect(texts()).toContain('Montaža dve police');
    // The body and the foot are two presses, side by side: the foot is not inside the body.
    const [body, foot] = presses();
    expect(presses()).toHaveLength(2);
    expect(body.findAll(node => node.type === PRESS)).toHaveLength(1);
    // The foot stands beside the body under the record (its own component is one step in between), never inside it. Compared as booleans: a failed comparison of two test instances would try to print both trees.
    expect(foot.parent!.parent === body.parent).toBe(true); expect(body.findAll(node => node === foot)).toHaveLength(0);
    expect(body.props.accessibilityLabel).toBe('Otvori zadatak Montaža dve police');
    expect(foot.props.accessibilityLabel).toBe('Pogledaj prijave, 3 prijave. Zadatak: Montaža dve police');
    expect(foot.props.accessibilityHint).toBe('Otvara prijave za izbor.');
    // The line is in grey words (never green, never the waiting orange), on the quiet foot link of the card system, and it is data: how many.
    const words = foot.findAll(node => node.type === T_)[0];
    expect(words.props.children).toBe('3 prijave'); expect(words.props.tone).toBe('muted');
    await act(async () => foot.props.onPress()); expect(applications).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled();
    await act(async () => body.props.onPress()); expect(open).toHaveBeenCalledTimes(1); expect(applications).toHaveBeenCalledTimes(1);
  });

  it('the chip is not a stop of its own: the body is heard once, as one sentence that starts with the state', async () => {
    await render(<OwnTaskCard item={task()} onOpen={jest.fn()} onApplications={jest.fn()} />);
    expect(hiddenFromReaders(chips()[0])).toBe(true);
    expect(presses()[0].props.accessibilityValue.text).toBe('Bira se, 3, Budžet 2.000 RSD po osobi, Grbavica, Novi Sad, 25. sep · 10:00, Treba 2 osobe');
  });

  it('without a way to the applications the line is still said, as plain text in the body', async () => {
    await render(<OwnTaskCard item={task()} onOpen={jest.fn()} />);
    expect(presses()).toHaveLength(1);
    expect(texts()).toContain('3 prijave');
    expect(presses()[0].props.accessibilityValue.text).toContain('3 prijave');
  });

  it.each([
    ['a draft', { stanje: 'NACRT', brojPrijavaZaIzbor: 0 }, 'Nacrt', null],
    ['a published task nobody applied to', { stanje: 'OBJAVLJENA', brojPrijava: 0, brojPrijavaZaIzbor: 0 }, 'Objavljen', 'Još nema prijava'],
    ['a task with one place of two agreed', { stanje: 'DELIMICNO_POPUNJENA', brojPrijavaZaIzbor: 0, pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } },
      'Dogovoren · 1 od 2', null],
    ['a task with every place agreed', { stanje: 'POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 } }, 'Dogovoren', null],
    ['a finished task', { stanje: 'ZATVORENA', kraj: 'COMPLETED' }, 'Završen', null],
    ['a cancelled task', { stanje: 'ZATVORENA', kraj: 'CANCELLED' }, 'Otkazan', null],
    ['an expired task', { stanje: 'ZATVORENA', kraj: 'EXPIRED' }, 'Istekao', null],
  ] as const)('%s says "%s" and has no foot', async (_name, patch, word, line) => {
    await render(<OwnTaskCard item={task(patch)} onOpen={jest.fn()} onApplications={jest.fn()} />);
    expect(texts()[0]).toBe(word);
    expect(presses()).toHaveLength(1);
    // The chip says the state; what it says is not said again, and no sentence explains anything.
    if (line) expect(texts()).toContain(line); else expect(texts().filter(text => /\.$/.test(text) && text !== 'Montaža dve police')).toEqual([]);
    expect(texts().join(' ')).not.toMatch(/zvonc|Dogovor vidiš|Sva mesta su dogovorena|Nastavi uređivanje|Čekaš|Imaš \d/);
  });

  it('a closed task whose ending was not carried, or an archived one, has no chip and says what is true instead', async () => {
    await render(<OwnTaskCard item={task({ stanje: 'ZATVORENA' })} onOpen={jest.fn()} />);
    expect(chips()).toHaveLength(0); expect(texts()).toContain('Zadatak je zatvoren.'); expect(texts()).not.toContain('Zatvoren');
    await render(<OwnTaskCard item={task({ stanje: 'ZATVORENA', kraj: 'ARCHIVED' })} onOpen={jest.fn()} />);
    expect(chips()).toHaveLength(0); expect(texts()).toContain('Zadatak je u arhivi.');
  });

  it('never says "Čeka prijave", which read as the opposite of what it meant', async () => {
    for (const patch of [{}, { stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 0 }, { stanje: 'NACRT' }]) {
      await render(<OwnTaskCard item={task(patch)} onOpen={jest.fn()} onApplications={jest.fn()} />);
      expect(texts().join(' ')).not.toMatch(/Čeka prijave|čeka izbor|čekaju izbor/);
    }
  });
});

describe('the rest of the row', () => {
  it('keeps the facts of the task as rows of one kind: what it pays, where, when and how many people, each with its picture', async () => {
    await render(<OwnTaskCard item={task({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 0 })} onOpen={jest.fn()} />);
    expect(texts()).toEqual(expect.arrayContaining(['Montaža dve police', '2.000 RSD', 'po osobi', 'Grbavica, Novi Sad', '25. sep · 10:00', 'Treba 2 osobe']));
    expect(texts().join(' ')).not.toMatch(/popunjeno|\d\/\d/);
    // The amount and what it buys stand on ONE line, and the amount is the one thing drawn as money.
    const amount = tree.root.findAll(node => node.type === T_ && node.props.children === '2.000 RSD')[0];
    expect(amount.props.variant).toBe('priceRow');
    const line = amount.parent!;
    expect(line.findAll(node => node.type === T_).map(node => node.props.children)).toEqual(['2.000 RSD', 'po osobi']);
    expect(style(line)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    // What it pays has the picture of money, like where and when have theirs, and how many people has its own.
    expect(tree.root.findAll(node => node.type === ('FactArt' as React.ElementType)).map(node => node.props.kind)).toEqual(['money', 'pin', 'calendar', 'users']);
  });

  it('says how many people only when it is more than one, and how many are agreed once any is', async () => {
    await render(<OwnTaskCard item={task({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 0, pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 } })} onOpen={jest.fn()} />);
    expect(tree.root.findAll(node => node.type === ('FactArt' as React.ElementType)).map(node => node.props.kind)).toEqual(['money', 'pin', 'calendar']);
    expect(texts().join(' ')).not.toMatch(/Treba|dogovoreno|0\/1/);
    await render(<OwnTaskCard item={task({ stanje: 'DELIMICNO_POPUNJENA', brojPrijavaZaIzbor: 0, pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 } })} onOpen={jest.fn()} />);
    expect(texts()).toEqual(expect.arrayContaining(['Treba 3 osobe', '1 dogovoreno']));
  });

  it('a task done remotely says so with the remote picture, and a long title keeps to two lines for the eye and whole for the ear', async () => {
    const long = 'Prenos starog trokrilnog ormara iz stana na petom spratu bez lifta do kombija parkiranog u dvorištu zgrade';
    await render(<OwnTaskCard item={task({ naslov: long, detalji: { rezimLokacije: 'REMOTE', geografija: { mode: 'REMOTE' }, zahtevi: undefined } })} onOpen={jest.fn()} />);
    expect(tree.root.findAll(node => node.type === ('FactArt' as React.ElementType)).map(node => node.props.kind)).toEqual(['money', 'remote', 'calendar', 'users']);
    const title = tree.root.findAll(node => node.type === T_ && node.props.children === long)[0];
    expect(title.props.numberOfLines).toBe(2); expect(title.props.variant).toBe('heading');
    expect(presses()[0].props.accessibilityLabel).toBe(`Otvori zadatak ${long}`);
  });

  it('a task with no price says it in words, beside the picture of a price tag, and never as an amount', async () => {
    await render(<OwnTaskCard item={task({ stanje: 'OBJAVLJENA', rezimCene: 'OFFERS', osnovaCene: null, ponudjenaCena: undefined, brojPrijavaZaIzbor: 0 })} onOpen={jest.fn()} />);
    expect(texts()).toContain('Tražim ponude'); expect(texts().join(' ')).not.toMatch(/popunjeno|Tražiš/);
    expect(tree.root.findAll(node => node.type === ('FactArt' as React.ElementType))[0].props.kind).toBe('offers');
    expect(tree.root.findAll(node => node.type === T_ && node.props.variant === 'priceRow')).toHaveLength(0);
  });

  it('a draft has no places agreed and no applications: it counts neither, in words or aloud, and says nothing about itself the chip does not', async () => {
    await render(<OwnTaskCard item={task({ stanje: 'NACRT', brojPrijava: 0, brojPrijavaZaIzbor: 0 })} onOpen={jest.fn()} />);
    expect(texts().join(' ')).not.toMatch(/popunjeno|dogovoreno|prijav/); expect(texts()).not.toContain('Nacrt nije objavljen. Nastavi uređivanje.');
    expect(presses()[0].props.accessibilityValue.text).not.toMatch(/popunjeno|dogovoreno/);
  });

  it('a price that is not stored never looks like an amount', async () => {
    await render(<OwnTaskCard item={task({ stanje: 'OBJAVLJENA', rezimCene: 'MY_PRICE', osnovaCene: null, ponudjenaCena: undefined })} onOpen={jest.fn()} />);
    expect(texts()).toContain('Cena nije navedena');
    expect(texts().some(text => /RSD/.test(text))).toBe(false);
  });

  it('keeps HITNO beside the chip, a word with a symbol, and says it first when it is heard', async () => {
    const urgency = { level: 'HITNO' as const, expiresAt: '2099-01-01T00:00:00Z' };
    await render(<OwnTaskCard item={task({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 0, urgency })} onOpen={jest.fn()} />);
    expect(texts()).toContain('HITNO'); expect(chips()).toHaveLength(1);
    expect(presses()[0].props.accessibilityValue.text.startsWith('HITNO, Objavljen, ')).toBe(true);
  });

  // "Papir na stolu" (2026-10-08): the list is in groups by phase, and a group's name already says what state its tasks are in, so its cards do not wear the chip
  // a second time (a division said twice). Nothing else about the card changes: HITNO stays, the foot stays, and the card still says its state aloud.
  it('with `sectionSays` draws no chip but says the state aloud as before, and keeps HITNO, the foot and the next step', async () => {
    await render(<OwnTaskCard item={task()} onOpen={jest.fn()} onApplications={jest.fn()} sectionSays />);
    expect(chips()).toHaveLength(0); expect(texts()).not.toContain('Bira se · 3');
    expect(presses()[0].props.accessibilityValue.text).toMatch(/^Bira se, 3, /);
    expect(texts()).toContain('3 prijave'); expect(presses()).toHaveLength(2);
    const urgency = { level: 'HITNO' as const, expiresAt: '2099-01-01T00:00:00Z' };
    await render(<OwnTaskCard item={task({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 0, urgency })} onOpen={jest.fn()} sectionSays />);
    expect(chips()).toHaveLength(0); expect(texts()).toContain('HITNO');
    expect(presses()[0].props.accessibilityValue.text.startsWith('HITNO, Objavljen, ')).toBe(true);
  });

  it('without `sectionSays` (the default, and the lists of finished and all tasks) the chip stands exactly as it did', async () => {
    await render(<OwnTaskCard item={task()} onOpen={jest.fn()} onApplications={jest.fn()} />);
    expect(chips()).toHaveLength(1); expect(texts()).toContain('Bira se · 3');
  });

  it('while a command runs nothing on the row can be pressed, and the row stays readable', async () => {
    await render(<OwnTaskCard item={task()} onOpen={jest.fn()} onApplications={jest.fn()} disabled />);
    for (const node of presses()) { expect(node.props.disabled).toBe(true); expect(node.props.accessibilityState).toEqual({ disabled: true }); }
    for (const node of tree.root.findAll(node => node.type === VIEW)) expect(style(node)).not.toHaveProperty('opacity');
  });

  it('is a raised record with a neutral edge and 24 corners: the state is the chip, never the colour of the frame', async () => {
    await render(<OwnTaskCard item={task()} onOpen={jest.fn()} />);
    const frame = tree.root.findAll(node => node.type === VIEW && style(node).borderColor !== undefined)[0];
    expect(style(frame)).toMatchObject({ borderColor: sys.color.line, borderWidth: 1, borderRadius: sys.radius.card, padding: 0 });
  });

  it('only a task that waits for my decision has a foot, and the foot has one line above it and no other', async () => {
    await render(<OwnTaskCard item={task()} onOpen={jest.fn()} onApplications={jest.fn()} />);
    const lines = () => tree.root.findAll(node => node.type === VIEW && style(node).height === 1 && style(node).backgroundColor === sys.color.line);
    expect(lines()).toHaveLength(1);
    await render(<OwnTaskCard item={task({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 0 })} onOpen={jest.fn()} onApplications={jest.fn()} />);
    expect(lines()).toHaveLength(0); expect(presses()).toHaveLength(1);
  });
});
