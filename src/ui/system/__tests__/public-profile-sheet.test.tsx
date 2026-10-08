import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { JavniProfilPoverenje, JavniProfilProjekcija } from '../../../contracts/projections';

/**
 * A person's public profile (T4/T5, 2026-10-07; UI/UX pass 2026-10-08, F6; the owner's pick of 8 Oct 2026, "Lice i tri broja"), in every
 * state it can be in. It shows only what the server really carries: the face (72, centred, with its sticker edge), the person's own line
 * and the city, then the three figures in one row (the rating with the count it stands on or "Nova ocena", "završenih", and how reliably
 * they come as agreed, each only when the server returned it), "O meni" when the person wrote one, the confirmations as the system's
 * `FactRow`s ("Identitet je potvrđen" only when it is true, and what the trust read, PROFILE-TRUST R30, returned for this viewer); the
 * safety entry is last. What the server does not return - a HIDDEN trust block, a part it left out - is not drawn: no figure, no row, no
 * control, no placeholder and no word about what is hidden.
 */
let mockWidth = 390, mockFontScale = 1;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  const Modal = ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return Modal;
    if (key === 'useWindowDimensions') return () => ({ width: mockWidth, height: 800, scale: 2, fontScale: mockFontScale });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../FactArt', () => ({ FactArt: 'FactArt' }));

import type { PublicWorkTrust } from '../../../data/workTrustClientService';
import { PublicProfileSheet, SAFETY_LABEL, memberSinceFact, publicRatingFigure } from '../PublicProfileSheet';

const trust = (patch: Partial<JavniProfilPoverenje> = {}): JavniProfilPoverenje => ({ ocenaProsek: 4.8, brojRecenzija: 12, zavrseniBroj: 14, identitetVerifikovan: false,
  ocenaDostupna: true, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: true, ...patch });
const person = (patch: Partial<JavniProfilProjekcija> = {}, poverenje: Partial<JavniProfilPoverenje> = {}): JavniProfilProjekcija => ({ profilId: 'profile-1', uloga: 'uskocer',
  ime: 'Marija Marić', avatarPutanja: null, grad: 'Beograd', naslov: null, biografija: null, poverenje: trust(poverenje), ...patch } as JavniProfilProjekcija);

const PROFILE = '30000000-0000-4000-8000-000000000001';
const workTrust = (patch: Partial<PublicWorkTrust> = {}): PublicWorkTrust => ({ profileId: PROFILE, self: false, visibility: 'PUBLIC', completedCount: 14, agreedCount: 16,
  reliabilityPercent: 88, reliabilityState: 'AVAILABLE', reliabilityMinimum: 5, memberSince: '2026-03-01', ...patch });
const hiddenTrust = (): PublicWorkTrust => workTrust({ visibility: 'OWN_ONLY', agreedCount: null, reliabilityPercent: null, reliabilityState: 'HIDDEN', memberSince: null });

let tree: ReactTestRenderer;
const noop = () => {};
const show = async (data: JavniProfilProjekcija | null, extra: Partial<React.ComponentProps<typeof PublicProfileSheet>> = {}) => {
  await act(async () => { tree = create(<PublicProfileSheet state={{ loading: false, data }} onClose={noop} onRetry={noop} {...extra} />); });
};
const textOf = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => textOf(child as ReactTestInstance | string)).join('');
const labelled = (label: string) => tree.root.findAll(node => node.props.accessibilityLabel === label && typeof node.type === 'string');
const all = () => tree.root.findAll(node => String(node.type) === 'T').map(node => textOf(node)).join(' | ');
/** The three figures, in the order they are drawn: each is a host view with a test id, spoken as its figure and its words. */
const figureCells = () => tree.root.findAll(node => typeof node.type === 'string' && typeof node.props.testID === 'string' && node.props.testID.startsWith('public-profile-figure-'));
const figureIds = () => figureCells().map(node => (node.props.testID as string).replace('public-profile-figure-', ''));
const figure = (name: string) => figureCells().find(node => node.props.testID === `public-profile-figure-${name}`)!;
/** What a figure says, as the texts it draws in order: the figure (or its words) and what it is. */
const said = (name: string) => figure(name).findAll(node => String(node.type) === 'T').map(node => textOf(node));
/** The confirmations of the sheet, in the order they are drawn: each is a `FactRow` (a host view with a test id), spoken as its sentence. */
const factRows = () => tree.root.findAll(node => typeof node.type === 'string' && typeof node.props.testID === 'string' && node.props.testID.startsWith('public-profile-fact-'));
const factLabels = () => factRows().map(node => node.props.accessibilityLabel as string);
const factIds = () => factRows().map(node => (node.props.testID as string).replace('public-profile-fact-', ''));
afterEach(async () => { await act(async () => tree?.unmount()); mockWidth = 390; mockFontScale = 1; });

describe('the states of the sheet', () => {
  it('draws nothing without a state, a skeleton while loading, and a way to try again when the read failed', async () => {
    await act(async () => { tree = create(<PublicProfileSheet state={null} onClose={noop} onRetry={noop} />); });
    expect(tree.toJSON()).toBeNull();
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: true, data: null }} onClose={noop} onRetry={noop} />));
    expect(all()).toContain('Učitavamo javni profil…');
    const retry = jest.fn();
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: null }} onClose={noop} onRetry={retry} />));
    expect(all()).toContain('Javni profil trenutno nije dostupan.');
    await act(async () => { labelled('Pokušaj ponovo')[0].props.onPress(); });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('is titled with the person\'s name, and says when there is none', async () => {
    await show(person());
    expect(all()).toContain('Marija Marić'); expect(all()).not.toContain('Javni profil');
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: person({ ime: '  ' }) }} onClose={noop} onRetry={noop} />));
    expect(all()).toContain('Ime nije dostupno');
  });

  it('shows the portrait, the headline and the city only when they are there', async () => {
    const photo = jest.fn((_id: string, _size?: number) => <FakePhoto />);
    await show(person({ naslov: 'Selidbe i montaža' }), { photo });
    expect(photo).toHaveBeenCalledWith('profile-1', 72);
    expect(all()).toContain('Selidbe i montaža'); expect(all()).toContain('Beograd');
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: person({ grad: null, naslov: null }) }} onClose={noop} onRetry={noop} />));
    expect(all()).not.toContain('Beograd'); expect(all()).toContain('MM');
  });

  it('stands the face, the headline and the city in one centred column, the face at 72 inside its sticker edge', async () => {
    await show(person({ naslov: 'Selidbe i montaža' }));
    const portrait = tree.root.findByProps({ testID: 'public-profile-portrait' });
    expect(portrait.props).toMatchObject({ accessible: false, importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true });
    expect(StyleSheetFlat(portrait.parent!.props.style)).toMatchObject({ alignItems: 'center' });
    expect(portrait.findAll(node => StyleSheetFlat(node.props.style).width === 72 && StyleSheetFlat(node.props.style).height === 72).length).toBeGreaterThan(0);
    expect(portrait.findAll(node => StyleSheetFlat(node.props.style).padding === 2).length).toBeGreaterThan(0);
  });
});

describe('the three figures', () => {
  it('are the rating, finished and reliability, in one row, the rating first', async () => {
    await show(person(), { trust: workTrust() });
    expect(figureIds()).toEqual(['rating', 'finished', 'reliability']);
    const row = tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'public-profile-figures')[0];
    expect(StyleSheetFlat(row.props.style)).toMatchObject({ flexDirection: 'row' });
    expect(figureCells().every(cell => cell.parent === row || cell.parent!.parent === row)).toBe(true);
  });

  it('says the rating the Serbian way with the count under it: "4,8" and "12 ocena", with the star', async () => {
    await show(person());
    expect(said('rating')).toEqual(['4,8', '12 ocena']);
    expect(figure('rating').props.accessibilityLabel).toBe('Ocena 4,8, 12 ocena');
    expect(figure('rating').findAllByType('FactArt' as never)[0].props.kind).toBe('star');
    // The figure is not a control: no read of another person's ratings exists, so nothing opens.
    expect(figure('rating').props.onPress).toBeUndefined();
    expect(tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith('Ocena'))).toHaveLength(0);
  });

  it.each([[5, '5,0'], [4.75, '4,75'], [3, '3,0'], [4.8, '4,8']])('writes %s as "%s"', (value, written) => {
    expect(publicRatingFigure(trust({ ocenaProsek: value, brojRecenzija: 3 }))).toMatchObject({ value: written, label: '3 ocene', star: true });
  });

  it.each([[1, '1 ocena'], [2, '2 ocene'], [4, '4 ocene'], [5, '5 ocena'], [11, '11 ocena'], [12, '12 ocena'], [21, '21 ocena'], [22, '22 ocene'], [100, '100 ocena']])(
    'counts %s the Serbian way: "%s"', (count, written) => {
      expect(publicRatingFigure(trust({ brojRecenzija: count }))).toMatchObject({ value: '4,8', label: written });
    });

  it('says "Nova ocena" and "još nema ocena" when there are no reviews, without a number and without the star that stands for a rating', async () => {
    await show(person({}, { ocenaProsek: null, brojRecenzija: 0, ocenaDostupna: false, recenzijeDostupne: true }));
    expect(said('rating')).toEqual(['Nova ocena', 'još nema ocena']);
    expect(figure('rating').findAllByType('FactArt' as never)).toHaveLength(0);
    expect(all()).not.toMatch(/0,0|\b0 ocena/);
  });

  it('draws no rating when the server does not know it, and never shows a number it was not given', async () => {
    await show(person({}, { ocenaProsek: 4.9, brojRecenzija: 27, ocenaDostupna: false, recenzijeDostupne: false }));
    expect(figureIds()).toEqual(['finished']);
    expect(all()).not.toContain('4,9'); expect(all()).not.toContain('27');
    expect(publicRatingFigure(trust({ ocenaDostupna: false, recenzijeDostupne: false }))).toBeNull();
  });

  it('shows a rating alone when only the rating is known, never a made-up count', async () => {
    await show(person({}, { brojRecenzija: null, recenzijeDostupne: false }));
    expect(said('rating')).toEqual(['4,8', 'ocena']);
  });

  it.each([[0, '0', 'završenih'], [1, '1', 'završen'], [2, '2', 'završena'], [4, '4', 'završena'], [5, '5', 'završenih'], [11, '11', 'završenih'],
    [14, '14', 'završenih'], [21, '21', 'završen'], [22, '22', 'završena'], [41, '41', 'završen']])(
    'says finished %s the Serbian way: "%s %s", zero too, as zero', async (count, written, word) => {
      await show(person({}, { zavrseniBroj: count }));
      expect(said('finished')).toEqual([written, word]);
      expect(figure('finished').props.accessibilityLabel).toBe(`${written} ${word}`);
    });

  it('replaces "Završeno N zadataka" and never names a side of the task', async () => {
    await show(person({ uloga: 'narucilac' as never }, { zavrseniBroj: 3, identitetVerifikovan: true }));
    expect(all()).not.toMatch(/Dogovor|Naručilac|naručilac|Uskočer|uskočer|posao|poslova/);
    expect(all()).not.toContain('Završeno');
  });
});

describe('the identity line', () => {
  it('appears only when the server offers it AND it is true', async () => {
    await show(person({}, { identitetVerifikovan: true, verifikacijaIdentitetaDostupna: true }));
    expect(factLabels()).toEqual(['Identitet je potvrđen']);
    for (const patch of [{ identitetVerifikovan: false, verifikacijaIdentitetaDostupna: true }, { identitetVerifikovan: true, verifikacijaIdentitetaDostupna: false },
      { identitetVerifikovan: false, verifikacijaIdentitetaDostupna: false }]) {
      await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: person({}, patch) }} onClose={noop} onRetry={noop} />));
      expect(factLabels()).toEqual([]); expect(all()).not.toContain('Identitet je potvrđen');
    }
  });
});

describe('"O meni"', () => {
  it('is there only when the person wrote one, exactly as they wrote it, and is not clamped', async () => {
    const bio = 'Radim sa bratom. '.repeat(35);
    await show(person({ biografija: bio }));
    // The sheet's own title is the name; "O meni" is the one heading of the content.
    const headings = tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => textOf(node));
    expect(headings).toEqual(['Marija Marić', 'O meni']);
    const text = tree.root.findAll(node => node.props.children === bio)[0];
    expect(text.props.selectable).toBe(true); expect(text.props.numberOfLines).toBeUndefined();
    expect(all()).not.toContain('O sebi');
  });

  it.each([[null], [''], ['   \n ']])('has no heading and no text when there is nothing written (%j)', async value => {
    await show(person({ biografija: value }));
    expect(tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => textOf(node))).toEqual(['Marija Marić']);
    expect(all()).not.toContain('O meni');
  });
});

describe('the safety entry', () => {
  it('is the last thing on the sheet and the only control in it, and says what it does', async () => {
    const onPress = jest.fn();
    await show(person({ biografija: 'Radim brzo.' }, { identitetVerifikovan: true }), { safety: { onPress, busy: false, error: null } });
    const entry = labelled(`${SAFETY_LABEL}: Marija Marić`)[0];
    expect(textOf(entry)).toContain(SAFETY_LABEL); expect(textOf(entry)).toContain('Osoba koju prijavljuješ ne vidi prijavu.');
    // A command with red words that does open the report: it keeps its arrow.
    const label = entry.findAll(node => String(node.type) === 'T' && textOf(node) === SAFETY_LABEL)[0];
    expect(label.props.tone).toBe('danger');
    expect(entry.findAll(node => node.props.name === 'caret-right').length).toBeGreaterThan(0);
    expect(entry.props.accessibilityHint).toContain('Otvara prijavu ili blokiranje osobe.');
    // Everything else on the sheet is read: the only Press besides the sheet's own close is this entry.
    const presses = tree.root.findAll(node => String(node.type) === 'Press').map(node => node.props.accessibilityLabel);
    expect(presses.filter(label => label !== 'Zatvori javni profil')).toEqual([`${SAFETY_LABEL}: Marija Marić`]);
    // Last: after the figures, "O meni" and the confirmations.
    const order = tree.root.findAll(node => String(node.type) === 'T').map(node => textOf(node));
    expect(order.indexOf(SAFETY_LABEL)).toBeGreaterThan(order.indexOf('Radim brzo.')); expect(order.indexOf(SAFETY_LABEL)).toBeGreaterThan(order.indexOf('O meni'));
    expect(order.indexOf(SAFETY_LABEL)).toBeGreaterThan(order.indexOf('završenih'));
    expect(order.indexOf(SAFETY_LABEL)).toBeGreaterThan(order.indexOf('Identitet je potvrđen'));
    await act(async () => { entry.props.onPress(); }); expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps its busy and error states, and is absent when the screen offers no way to report', async () => {
    await show(person(), { safety: { onPress: noop, busy: true, error: 'Korisnik trenutno nije dostupan.' } });
    expect(labelled(`${SAFETY_LABEL}: Marija Marić`)[0].props.disabled).toBe(true); expect(all()).toContain('Otvaramo…');
    expect(tree.root.findAll(node => node.props.accessibilityRole === 'alert' && node.props.children === 'Korisnik trenutno nije dostupan.')).toHaveLength(1);
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: person() }} onClose={noop} onRetry={noop} />));
    expect(all()).not.toContain(SAFETY_LABEL);
  });
});

// PROFILE-TRUST (R30): the sheet draws exactly what the server returned for this viewer, and nothing about what it did not.
describe('the trust block of a worker profile', () => {
  const base = ['rating', 'finished'];

  it('is not drawn without a trust read: the sheet is what it was, two figures and no confirmation', async () => {
    await show(person({}, { zavrseniBroj: 41 }));
    expect(figureIds()).toEqual(base); expect(said('finished')).toEqual(['41', 'završen']); expect(factIds()).toEqual([]);
    expect(all()).not.toMatch(/dolazi kako je dogovoreno|Na USKOČI|procenat|%|Dogovoreno/i);
  });

  it.each([['a HIDDEN block (the default for a visitor today)', hiddenTrust()], ['a "nothing here" answer', null], ['no answer at all', undefined]])(
    'draws NOTHING for %s: no figure, no row, no placeholder, no word about what is hidden', async (_name, value) => {
      await show(person({}, { zavrseniBroj: 41 }), { trust: value });
      expect(figureIds()).toEqual(base); expect(factIds()).toEqual([]);
      expect(all()).not.toMatch(/skriven|sakriven|privatn|nije vidljiv|samo ti|samo on|Dogovoreno|dolazi kako je dogovoreno|Na USKOČI|procenat|%/i);
    });

  it('adds the reliability as the third figure, and the agreed tasks and the month as confirmations, when the server lets this viewer have them', async () => {
    await show(person({}, { zavrseniBroj: 14 }), { trust: workTrust() });
    expect(figureIds()).toEqual([...base, 'reliability']);
    expect(said('reliability')).toEqual(['88 %', 'dolazi kako je dogovoreno']);
    expect(factIds()).toEqual(['agreed', 'since']);
    expect(factLabels()).toEqual(['Dogovoreno 16 zadataka', 'Na USKOČI-ju od marta 2026']);
  });

  it('says in words that there is no percentage yet, as a statement about the person, and never draws "0%" or "100%"', async () => {
    await show(person({}, { zavrseniBroj: 3 }), { trust: workTrust({ completedCount: 3, agreedCount: 4, reliabilityPercent: null, reliabilityState: 'TOO_FEW' }) });
    expect(said('reliability')).toEqual(['Još nema procenta', 'dolazi kako je dogovoreno']);
    expect(factLabels()).toEqual(['Dogovoreno 4 zadatka', 'Na USKOČI-ju od marta 2026']);
    expect(all()).not.toMatch(/\d+ ?%/);
  });

  it('leaves out a part the server did not return, and a month it cannot read', async () => {
    await show(person({}, { zavrseniBroj: 14 }), { trust: workTrust({ agreedCount: null, memberSince: null }) });
    expect(figureIds()).toEqual([...base, 'reliability']); expect(factIds()).toEqual([]);
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: person({}, { zavrseniBroj: 14 }) }} onClose={noop} onRetry={noop}
      trust={workTrust({ memberSince: 'oktobar' })} />));
    expect(figureIds()).toEqual([...base, 'reliability']); expect(factIds()).toEqual(['agreed']);
  });

  it('shows the person themself what the server returns for them, in the same places', async () => {
    await show(person({}, { zavrseniBroj: 14 }), { trust: workTrust({ self: true, visibility: 'OWN_ONLY' }) });
    expect(figureIds()).toEqual([...base, 'reliability']); expect(factIds()).toEqual(['agreed', 'since']);
  });

  it('puts the identity first among the confirmations, then the agreed tasks, then the month', async () => {
    await show(person({}, { identitetVerifikovan: true }), { trust: workTrust() });
    expect(factIds()).toEqual(['verified', 'agreed', 'since']);
  });

  it('promises nothing about who sees what, and never names a side of the task', async () => {
    await show(person({}, { zavrseniBroj: 14 }), { trust: workTrust() });
    expect(all()).not.toMatch(/anonim|garant|sigurno|Naručilac|naručilac|Uskočer|uskočer|posao|poslova/);
  });

  it('writes "Na USKOČI-ju od" with the Serbian month, and nothing for a date it cannot read', () => {
    expect(memberSinceFact('2026-10-02')).toBe('Na USKOČI-ju od oktobra 2026');
    expect(memberSinceFact('2027-01-15T10:00:00Z')).toBe('Na USKOČI-ju od januara 2027');
    expect(memberSinceFact('2026-03')).toBe('Na USKOČI-ju od marta 2026');
    for (const bad of [null, undefined, '', 'oktobar', '2026-13-01', '2026-00-10']) expect(memberSinceFact(bad)).toBeNull();
  });
});

describe('layout resilience', () => {
  it.each([[320, 1], [361, 1.15], [390, 1.2999999523], [390, 2]])('keeps the confirmations as full-width rows that wrap, and the safety entry a touch of 48 dp, at width %s and scale %s', async (width, scale) => {
    mockWidth = width; mockFontScale = scale;
    await show(person({ naslov: 'Selidbe i montaža u Beogradu i okolini', biografija: 'Radim sa bratom. '.repeat(20) }, { identitetVerifikovan: true }),
      { trust: workTrust(), safety: { onPress: noop, busy: false, error: null } });
    expect(factRows().length).toBeGreaterThan(0);
    for (const row of factRows()) {
      expect(StyleSheetFlat(row.props.style)).toMatchObject({ flexDirection: 'row' });
      // The fact is the line and it wraps: no ellipsis anywhere in it.
      for (const line of row.findAll(node => String(node.type) === 'T')) expect(line.props.numberOfLines).toBeUndefined();
    }
    // The figures share the row and wrap their words: no ellipsis in them either.
    expect(figureIds()).toEqual(['rating', 'finished', 'reliability']);
    for (const cell of figureCells()) for (const line of cell.findAll(node => String(node.type) === 'T')) expect(line.props.numberOfLines).toBeUndefined();
    const entry = labelled(`${SAFETY_LABEL}: Marija Marić`)[0];
    expect(StyleSheetFlat(entry.props.style).minHeight).toBeGreaterThanOrEqual(48);
  });

  it('keeps every text at 12 px or more', async () => {
    await show(person({ biografija: 'Radim.' }, { identitetVerifikovan: true }), { trust: workTrust(), safety: { onPress: noop, busy: false, error: null } });
    for (const node of tree.root.findAll(node => String(node.type) === 'T')) {
      const size = StyleSheetFlat(node.props.style).fontSize;
      if (typeof size === 'number') expect(size).toBeGreaterThanOrEqual(12);
    }
  });
});

function FakePhoto() { return <></>; }
function StyleSheetFlat(style: unknown): Record<string, any> { return Object.assign({}, ...[style].flat(4).filter(Boolean)); }
