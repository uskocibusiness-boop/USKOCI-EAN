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
  expect(copy).toContain('Jedan nalog, obe mogućnosti');
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
