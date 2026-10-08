import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// O aplikaciji (step 11a, 2026-09-24): the bar names the screen and the brand is its mark, not a second 28 px
// "USKOČI" title; the rules and privacy are rows with a chevron like every other way onward in settings, and a
// navigation fires once per focus.
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/BuildIdentity', () => ({ BuildIdentity: 'BuildIdentity' }));
jest.mock('../../ui/home/HomeLaunchArt', () => ({ HomeLaunchArt: 'HomeLaunchArt' }));
jest.mock('../../ui/entry/BrandAssets', () => ({ BrandLockup: 'BrandLockup', BrandMark: 'BrandMark' }));
import About from '../../app/(app)/profil/o-aplikaciji';

let tree: ReactTestRenderer;
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const byLabel = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
const texts = () => tree.root.findAllByType('T' as React.ElementType);
const render = async () => { await act(async () => { tree = create(<About />); }); };
beforeEach(() => { jest.clearAllMocks(); mockRouter.canGoBack.mockReturnValue(true); });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('names the brand with its mark, not with a second title, and keeps the words', async () => {
  await render();
  expect(texts().some(node => node.children.includes('USKOČI'))).toBe(false);
  expect(tree.root.findAllByType('BrandLockup' as React.ElementType)).toHaveLength(1);
  // The mark is one focus stop spoken as the heading: a header role on a View that is not `accessible` was not read.
  const heading = tree.root.findAll(node => node.props.accessibilityRole === 'header' && node.props.accessibilityLabel === 'USKOČI');
  expect(heading.length).toBeGreaterThan(0); expect(heading[0].props.accessible).toBe(true);
  expect(heading[0].findAllByType('BrandLockup' as React.ElementType)).toHaveLength(1);
  const copy = texts().flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
  expect(copy).toContain('Pomoć počinje dogovorom.');
  expect(copy).toContain('Tražiš pomoć ili uskačeš — na istom nalogu');
  expect(copy).toContain('Objavi zadatak');
  expect(copy).toContain('Izaberi ko će pomoći.');
  expect(copy).toContain('Uskoči i zaradi');
  expect(copy).toContain('Pronađi zadatak za svoje veštine.');
  expect(copy).toContain('AI pomaže da sastaviš zadatak. Ti pregledaš i potvrđuješ.');
  expect(tree.root.findAllByType('BuildIdentity' as React.ElementType)).toHaveLength(1);
});

it.each([['Pravila i saglasnosti', '/profil/pravna'], ['Privatnost i podaci', '/profil/privatnost']])(
  '"%s" is a row that opens %s once per focus', async (label, path) => {
    await render();
    const row = byLabel(label);
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.findAllByType('CaretRight' as React.ElementType)).toHaveLength(1);
    await act(async () => { row.props.onPress(); row.props.onPress(); });
    expect(mockRouter.push.mock.calls).toEqual([[path]]);
    // Back is ignored too while that navigation is under way.
    await act(async () => byLabel('Nazad').props.onPress());
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

it('Back with no history goes to the profile hub', async () => {
  mockRouter.canGoBack.mockReturnValue(false); await render();
  await act(async () => byLabel('Nazad').props.onPress());
  expect(mockRouter.replace).toHaveBeenCalledWith('/profil');
});

// UI/UX pass 2026-10-08 (F6, composition spec 4.15): the mark centred, one sentence under it, a section of two facts (`FactRow`s) and a section of
// two rows that lead on; no primary action, because nothing here is done.
describe('the composition', () => {
  const headings = () => texts().filter(node => node.props.accessibilityRole === 'header').map(node => node.children.join(''));
  const factRows = () => tree.root.findAll(node => typeof node.props.value === 'string' && typeof node.props.art === 'string');

  it('names two sections after the brand, in the order a person reads them', async () => {
    await render();
    expect(headings().filter(title => title !== 'O aplikaciji')).toEqual(['Tražiš pomoć ili uskačeš — na istom nalogu', 'Pravila i privatnost']);
  });

  it('says the two things one account can do as two facts with their pictures, and the sentence about the AI once', async () => {
    await render();
    expect(factRows().map(row => [row.props.art, row.props.value, row.props.note, row.props.size])).toEqual([
      ['publish', 'Objavi zadatak', 'Reci šta ti treba. Izaberi ko će pomoći.', 'detail'], ['map', 'Uskoči i zaradi', 'Pronađi zadatak za svoje veštine.', 'detail']]);
    const copy = texts().flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
    expect(copy.match(/AI pomaže da sastaviš zadatak\. Ti pregledaš i potvrđuješ\./g)).toHaveLength(1);
  });

  it('gives the two rows that lead on the same pictures the profile gives them, and nothing else on the screen is pressable but Back', async () => {
    await render();
    const rows = presses().filter(node => node.props.accessibilityLabel !== 'Nazad');
    expect(rows.map(node => node.props.accessibilityLabel)).toEqual(['Pravila i saglasnosti', 'Privatnost i podaci']);
    const art = (row: typeof rows[number]) => row.findAll(node => typeof node.props.kind === 'string' && node.props.size === 32).map(node => node.props.kind);
    expect(art(rows[0])).toContain('document'); expect(art(rows[1])).toContain('lock');
    expect(tree.root.findAll(node => node.props.kind === 'primary')).toHaveLength(0);
  });

  it('draws the mark at its own width and takes the width there is on a narrower screen, never more than the mark can have', async () => {
    await render();
    const lockup = () => tree.root.findByType('BrandLockup' as React.ElementType);
    expect(lockup().props.width).toBe(232);
    const frame = tree.root.findAll(node => node.props.accessibilityRole === 'header' && node.props.accessibilityLabel === 'USKOČI')[0];
    await act(async () => frame.props.onLayout({ nativeEvent: { layout: { width: 200 } } }));
    expect(lockup().props.width).toBe(200);
    await act(async () => frame.props.onLayout({ nativeEvent: { layout: { width: 400 } } }));
    expect(lockup().props.width).toBe(232);
    await act(async () => frame.props.onLayout({ nativeEvent: { layout: { width: 0 } } }));
    expect(lockup().props.width).toBe(232);
  });

  it('ends with the build detail support may ask for, after everything else', async () => {
    await render();
    const order = tree.root.findAll(node => ['BuildIdentity', 'BrandLockup'].includes(String(node.type))).map(node => String(node.type));
    expect(order).toEqual(['BrandLockup', 'BuildIdentity']);
  });
});
