import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DogovorProjekcija } from '../../contracts/projections';
import { BEZ_IZNOSA } from '../../lib/novac';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return key === 'View' ? 'View' : Reflect.get(target, key); } });
});
jest.mock('phosphor-react-native', () => ({ CaretRight: 'CaretRight', CaretDown: 'CaretDown' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar' }));
jest.mock('../../ui/system/ScreenChrome', () => ({ ScreenChrome: 'ScreenChrome' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Segmented', () => ({ Segmented: 'Segmented' }));

import { AgreementHero, AgreementTaskLink, AgreementTerms } from '../../ui/v2/AgreementPresentation';

const agreement = {
  id: 'agreement', naslov: 'Prenos troseda', verzija: 2, stanje: 'CONFIRMED',
  cena: { iznos: 5500, valuta: 'RSD', prikaz: '5.500 RSD' },
  vremeTekst: '26. sep · 17:00–19:00 (po vremenu u Srbiji)', putanjaTekst: 'Liman, Novi Sad',
  pokrivenost: { ukupno: 4, popunjeno: 2, preostalo: 2, udeo: 0.5 }, rezim: 'FIZICKI',
} as DogovorProjekcija;
let tree: ReactTestRenderer | undefined;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const text = () => tree!.root.findAll(node => String(node.type) === 'T')
  .flatMap(node => node.children.filter(child => typeof child === 'string' || typeof child === 'number')).join(' ').replace(/\s+/g, ' ');
const facts = () => tree!.root.findAll(node => String(node.type) === 'View' && node.props.accessible === true)
  .map(node => node.props.accessibilityLabel);
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });

test('accepted terms retain their values and covered people, separate from source-task context', async () => {
  await render(<AgreementTerms agreement={agreement} />);
  // The terms are the rows of the one list, in this order: the place (its coarse area, never the private address), the term with its
  // zone in one sentence, the one amount, the people.
  expect(facts()).toEqual(['Mesto: Liman, Novi Sad', 'Termin: 26. sep · 17:00–19:00 (po vremenu u Srbiji)', 'Dogovoreno ukupno: 5.500 RSD', 'Ljudi: 2 osobe']);
  expect(text()).toContain('Uslovi su izmenjeni.');
  expect(text()).not.toContain('4 osobe');
  const open = jest.fn();
  await act(async () => tree!.update(<AgreementTaskLink agreement={agreement} onOpenTask={open} disabled />));
  const source = tree!.root.findByProps({ accessibilityRole: 'button' });
  expect(source.props).toMatchObject({ onPress: open, disabled: true, accessibilityState: { disabled: true } });
  expect(source.props.accessibilityLabel).toBe('Otvori zadatak: Prenos troseda');   // the compact link of the chat's context: the overview's own row is in AgreementLinks
  expect(text()).not.toContain('5.500 RSD');
});

test('missing amount and terminal unscheduled terms stay explicit; remote context has no physical address', async () => {
  const missing = { ...agreement, stanje: 'COMPLETED' as const, rezim: 'DALJINSKI' as const,
    cena: { iznos: 0, valuta: 'RSD', prikaz: '' }, vremeTekst: 'Termin nije potvrđen',
    pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 } };
  await render(<><AgreementTaskLink agreement={missing} /><AgreementTerms agreement={missing} /></>);
  expect(facts()).toEqual(['Mesto: Na daljinu', 'Termin: Bez tačnog termina', `Cena: ${BEZ_IZNOSA}`, 'Ljudi: 1 osoba']);
  expect(text()).toContain('Na daljinu');
  expect(text()).not.toContain('Liman');
  expect(text()).not.toContain('0 RSD');
  expect(text()).not.toContain('ukupno');
  expect(tree!.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0);
});

test('the chat context keeps its compact location, time, amount and covered-people order', async () => {
  await render(<AgreementHero agreement={agreement} />);
  expect(facts()).toEqual(['Mesto: Liman, Novi Sad', 'Termin: 26. sep · 17:00–19:00, Po vremenu u Srbiji',
    'Dogovoreno ukupno: 5.500 RSD', 'Ljudi: 2 osobe']);
});

test('short accepted scope is fully visible and spoken within accepted terms', async () => {
  const scope = 'Prenos troseda do drugog sprata, bez lifta.';
  await render(<AgreementTerms agreement={{ ...agreement, prihvacenObim: scope }} />);
  expect(facts()).toContain(`Obim zadatka: ${scope}`);
  const body = tree!.root.findAllByType('T' as React.ElementType).find(node => node.props.children === scope)!;
  expect(body.props.selectable).toBe(true);
  expect(body.props.numberOfLines).toBeUndefined();
  expect(tree!.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0);
});

test.each([false, true])('long accepted scope opens and closes in full with spoken state (compact=%s)', async compact => {
  const scope = `Prenos nameštaja: ${'bez sečenja ili rastavljanja; '.repeat(90)}\nDogovoreni kraj obima.`;
  await render(<AgreementTerms agreement={{ ...agreement, prihvacenObim: scope }} compact={compact} />);
  const toggle = () => tree!.root.findAllByType('Press' as React.ElementType).find(node => node.props.accessibilityLabel === 'Obim zadatka')!;
  expect(toggle().props.accessibilityState).toEqual({ expanded: false });
  expect(text()).not.toContain('Dogovoreni kraj obima.');
  await act(async () => toggle().props.onPress());
  expect(toggle().props.accessibilityState).toEqual({ expanded: true });
  const body = tree!.root.findAllByType('T' as React.ElementType).find(node => node.props.children === scope)!;
  expect(body.props.selectable).toBe(true);
  expect(body.props.numberOfLines).toBeUndefined();
  expect(body.props.children).toBe(scope);
  await act(async () => toggle().props.onPress());
  expect(text()).not.toContain('Dogovoreni kraj obima.');
});

test('multiline scope is deliberate even when short; a later accepted version replaces its full content', async () => {
  await render(<AgreementTerms agreement={{ ...agreement, prihvacenObim: 'Prvi sprat\nBez lifta' }} />);
  const toggle = tree!.root.findAllByType('Press' as React.ElementType).find(node => node.props.accessibilityLabel === 'Obim zadatka')!;
  await act(async () => toggle.props.onPress());
  expect(text()).toContain('Prvi sprat Bez lifta');
  await act(async () => tree!.update(<AgreementTerms agreement={{ ...agreement, verzija: 3, prihvacenObim: 'Drugi sprat\nLift je dostupan' }} />));
  expect(text()).toContain('Drugi sprat Lift je dostupan');
  expect(text()).not.toContain('Prvi sprat');
  await act(async () => tree!.update(<AgreementTerms agreement={{ ...agreement, prihvacenObim: null }} />));
  expect(text()).not.toContain('Obim zadatka');
  expect(tree!.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0);
});
