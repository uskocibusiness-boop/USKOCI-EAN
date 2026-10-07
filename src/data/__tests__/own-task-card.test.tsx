import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { sys } from '../../ui/system/tokens';

/**
 * One of MY tasks in "Moji zadaci" (plan 2.2 and 3.5, owner 2026-10-07): the app's one chip in the owner's eight words, the facts of
 * the task card in its order, and the ONE next step in grey words. When that step is the way to the applications waiting for my choice
 * it is the row's foot, its own press beside the body and never inside it.
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
    expect(foot.parent).toBe(body.parent);
    expect(body.props.accessibilityLabel).toBe('Otvori zadatak Montaža dve police');
    expect(foot.props.accessibilityLabel).toBe('Imaš 3 prijave. Uporedi ih i izaberi. Zadatak: Montaža dve police');
    expect(foot.props.accessibilityHint).toBe('Otvara prijave za izbor.');
    // The step is in grey words (never green, never the waiting orange), on the quiet foot link of the card system.
    const words = foot.findAll(node => node.type === T_)[0];
    expect(words.props.children).toBe('Imaš 3 prijave. Uporedi ih i izaberi.'); expect(words.props.tone).toBe('muted');
    await act(async () => foot.props.onPress()); expect(applications).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled();
    await act(async () => body.props.onPress()); expect(open).toHaveBeenCalledTimes(1); expect(applications).toHaveBeenCalledTimes(1);
  });

  it('the chip is not a stop of its own: the body is heard once, as one sentence that starts with the state', async () => {
    await render(<OwnTaskCard item={task()} onOpen={jest.fn()} onApplications={jest.fn()} />);
    expect(hiddenFromReaders(chips()[0])).toBe(true);
    expect(presses()[0].props.accessibilityValue.text).toBe('Bira se, 3, 2.000 RSD po osobi, Grbavica, Novi Sad, 25. sep · 10:00, 0 od 2 mesta popunjeno');
  });

  it('without a way to the applications the step is still said, as a plain sentence in the body', async () => {
    await render(<OwnTaskCard item={task()} onOpen={jest.fn()} />);
    expect(presses()).toHaveLength(1);
    expect(texts()).toContain('Imaš 3 prijave. Uporedi ih i izaberi.');
    expect(presses()[0].props.accessibilityValue.text).toContain('Imaš 3 prijave. Uporedi ih i izaberi.');
  });

  it.each([
    ['a draft', { stanje: 'NACRT', brojPrijavaZaIzbor: 0 }, 'Nacrt', 'Nacrt nije objavljen. Nastavi uređivanje.'],
    ['a published task nobody applied to', { stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 0 }, 'Objavljen', 'Čekaš prijave. Javićemo ti.'],
    ['a task with one place of two agreed', { stanje: 'DELIMICNO_POPUNJENA', brojPrijavaZaIzbor: 0, pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } },
      'Dogovoren · 1 od 2', 'Dogovoreno 1 od 2. Čekaš prijave za ostala mesta.'],
    ['a task with every place agreed', { stanje: 'POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 } }, 'Dogovoren',
      'Sva mesta su dogovorena. Dogovor vidiš u Dogovorima.'],
    ['a finished task', { stanje: 'ZATVORENA', kraj: 'COMPLETED' }, 'Završen', null],
    ['a cancelled task', { stanje: 'ZATVORENA', kraj: 'CANCELLED' }, 'Otkazan', 'Otkazan zadatak ne prima prijave.'],
    ['an expired task', { stanje: 'ZATVORENA', kraj: 'EXPIRED' }, 'Istekao', 'Rok za prijave je istekao bez izbora.'],
  ] as const)('%s says "%s" and has no foot', async (_name, patch, word, sentence) => {
    await render(<OwnTaskCard item={task(patch)} onOpen={jest.fn()} onApplications={jest.fn()} />);
    expect(texts()[0]).toBe(word);
    expect(presses()).toHaveLength(1);
    if (sentence) expect(texts()).toContain(sentence); else expect(texts().filter(text => /\.$/.test(text) && text !== 'Montaža dve police')).toEqual([]);
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
  it('keeps the facts of the task card: the value and the places, where, when', async () => {
    await render(<OwnTaskCard item={task({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 0 })} onOpen={jest.fn()} />);
    expect(texts()).toEqual(expect.arrayContaining(['Montaža dve police', '2.000 RSD', 'po osobi', '0/2 popunjeno', 'Grbavica, Novi Sad', '25. sep · 10:00']));
  });

  it('a draft has no places to fill and no applications: it counts neither, in words or aloud', async () => {
    await render(<OwnTaskCard item={task({ stanje: 'NACRT', brojPrijava: 0, brojPrijavaZaIzbor: 0 })} onOpen={jest.fn()} />);
    expect(texts().join(' ')).not.toMatch(/popunjeno|prijav/); expect(texts()).toContain('Nacrt nije objavljen. Nastavi uređivanje.');
    expect(presses()[0].props.accessibilityValue.text).not.toMatch(/popunjeno/);
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

  it('while a command runs nothing on the row can be pressed, and the row stays readable', async () => {
    await render(<OwnTaskCard item={task()} onOpen={jest.fn()} onApplications={jest.fn()} disabled />);
    for (const node of presses()) { expect(node.props.disabled).toBe(true); expect(node.props.accessibilityState).toEqual({ disabled: true }); }
    expect(style(tree.root.findAll(node => node.type === VIEW)[0])).not.toHaveProperty('opacity');
  });

  it('is a raised card with a neutral edge: the state is the chip, never the colour of the frame', async () => {
    await render(<OwnTaskCard item={task()} onOpen={jest.fn()} />);
    expect(style(tree.root.findAll(node => node.type === VIEW)[0])).toMatchObject({ borderColor: sys.color.line, borderWidth: 1 });
  });
});
