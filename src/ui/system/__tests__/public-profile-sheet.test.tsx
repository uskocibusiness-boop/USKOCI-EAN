import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { JavniProfilPoverenje, JavniProfilProjekcija } from '../../../contracts/projections';

/**
 * A person's public profile (T4/T5, 2026-10-07), in every state it can be in. It shows only what the server really carries
 * today: the name, the city, "O meni" when the person wrote one, the rating with the count it stands on, "Završeno N
 * zadataka" and, only when it is true, "Identitet je potvrđen"; the safety entry is last. What the server does not carry
 * yet (the reliability percentage, "Na USKOČI-ju od", the latest ratings, skills) is not drawn, has no control and no
 * placeholder, and waits behind one switch.
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

import { PublicProfileSheet, PUBLIC_PROFILE_SERVER_FACTS_BUILT, SAFETY_LABEL, finishedPhrase, memberSinceFact, publicRating, reliabilityFact } from '../PublicProfileSheet';
import { sys } from '../tokens';

const trust = (patch: Partial<JavniProfilPoverenje> = {}): JavniProfilPoverenje => ({ ocenaProsek: 4.8, brojRecenzija: 12, zavrseniBroj: 14, identitetVerifikovan: false,
  ocenaDostupna: true, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: true, ...patch });
const person = (patch: Partial<JavniProfilProjekcija> = {}, poverenje: Partial<JavniProfilPoverenje> = {}): JavniProfilProjekcija => ({ profilId: 'profile-1', uloga: 'uskocer',
  ime: 'Marija Marić', avatarPutanja: null, grad: 'Beograd', naslov: null, biografija: null, poverenje: trust(poverenje), ...patch } as JavniProfilProjekcija);

let tree: ReactTestRenderer;
const noop = () => {};
const show = async (data: JavniProfilProjekcija | null, extra: Partial<React.ComponentProps<typeof PublicProfileSheet>> = {}) => {
  await act(async () => { tree = create(<PublicProfileSheet state={{ loading: false, data }} onClose={noop} onRetry={noop} {...extra} />); });
};
const textOf = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => textOf(child as ReactTestInstance | string)).join('');
const labelled = (label: string) => tree.root.findAll(node => node.props.accessibilityLabel === label && typeof node.type === 'string');
const all = () => tree.root.findAll(node => String(node.type) === 'T').map(node => textOf(node)).join(' | ');
const facts = () => tree.root.findByProps({ testID: 'public-profile-facts' });
const factLabels = () => facts().findAll(node => node.props.accessible === true).map(node => node.props.accessibilityLabel as string);
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
    expect(photo).toHaveBeenCalledWith('profile-1', 96);
    expect(all()).toContain('Selidbe i montaža'); expect(all()).toContain('Beograd');
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: person({ grad: null, naslov: null }) }} onClose={noop} onRetry={noop} />));
    expect(all()).not.toContain('Beograd'); expect(all()).toContain('MM');
  });
});

describe('the rating', () => {
  it('is the number the Serbian way with the count it stands on: "4,8 · 12 ocena"', async () => {
    await show(person());
    expect(labelled('Ocena: 4,8, 12 ocena')).toHaveLength(1);
    const row = labelled('Ocena: 4,8, 12 ocena')[0];
    expect(textOf(row)).toBe('4,8 · 12 ocena');
    // The row is not a control: no read of another person's ratings exists, so nothing opens.
    expect(row.props.onPress).toBeUndefined(); expect(tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith('Ocena'))).toHaveLength(0);
  });

  it.each([[5, '5,0'], [4.75, '4,75'], [3, '3,0'], [4.8, '4,8']])('writes %s as "%s"', (value, written) => {
    expect(publicRating(trust({ ocenaProsek: value, brojRecenzija: 3 }))).toEqual({ kind: 'rated', value: written, count: '3 ocene' });
  });

  it.each([[1, '1 ocena'], [2, '2 ocene'], [4, '4 ocene'], [5, '5 ocena'], [11, '11 ocena'], [12, '12 ocena'], [21, '21 ocena'], [22, '22 ocene'], [100, '100 ocena']])(
    'counts %s the Serbian way: "%s"', (count, written) => {
      expect(publicRating(trust({ brojRecenzija: count }))).toEqual({ kind: 'rated', value: '4,8', count: written });
    });

  it('says "Još nema ocena" when there are no reviews, without a number or a star in colour', async () => {
    await show(person({}, { ocenaProsek: null, brojRecenzija: 0, ocenaDostupna: false, recenzijeDostupne: true }));
    expect(labelled('Ocena: još nema ocena')).toHaveLength(1); expect(textOf(labelled('Ocena: još nema ocena')[0])).toBe('Još nema ocena');
    const star = labelled('Ocena: još nema ocena')[0].findAllByType('FactArt' as never)[0];
    expect(star.props.kind).toBe('star'); expect(star.props.muted).toBe(true);
  });

  it('says it is not available when the server does not know, and never shows a number it was not given', async () => {
    await show(person({}, { ocenaProsek: 4.9, brojRecenzija: 27, ocenaDostupna: false, recenzijeDostupne: false }));
    expect(labelled('Ocena: nije dostupna')).toHaveLength(1); expect(textOf(labelled('Ocena: nije dostupna')[0])).toBe('Ocena nije dostupna');
    expect(all()).not.toContain('4,9'); expect(all()).not.toContain('27');
  });

  it('shows a rating alone when only the rating is known, never a made-up count', async () => {
    await show(person({}, { brojRecenzija: null, recenzijeDostupne: false }));
    expect(textOf(labelled('Ocena: 4,8')[0])).toBe('4,8');
  });
});

describe('"Završeno N zadataka"', () => {
  it.each([[0, 'Završeno 0 zadataka'], [1, 'Završeno 1 zadatak'], [2, 'Završeno 2 zadatka'], [4, 'Završeno 4 zadatka'], [5, 'Završeno 5 zadataka'],
    [11, 'Završeno 11 zadataka'], [14, 'Završeno 14 zadataka'], [21, 'Završeno 21 zadatak'], [22, 'Završeno 22 zadatka'], [41, 'Završeno 41 zadatak']])(
    'says %s as "%s", in the row and to a screen reader', async (count, written) => {
      expect(finishedPhrase(count)).toBe(written);
      await show(person({}, { zavrseniBroj: count }));
      expect(labelled(written)).toHaveLength(1); expect(textOf(labelled(written)[0])).toBe(written);
    });

  it('replaces "Završeni Dogovori" everywhere, and never names a side of the task', async () => {
    await show(person({ uloga: 'narucilac' as never }, { zavrseniBroj: 3, identitetVerifikovan: true }));
    expect(all()).not.toMatch(/Dogovor|Naručilac|naručilac|Uskočer|uskočer|posao|poslova/);
    expect(all()).not.toContain('Završeni');
  });
});

describe('the identity line', () => {
  it('appears only when the server offers it AND it is true', async () => {
    await show(person({}, { identitetVerifikovan: true, verifikacijaIdentitetaDostupna: true }));
    expect(factLabels()).toContain('Identitet je potvrđen');
    for (const patch of [{ identitetVerifikovan: false, verifikacijaIdentitetaDostupna: true }, { identitetVerifikovan: true, verifikacijaIdentitetaDostupna: false },
      { identitetVerifikovan: false, verifikacijaIdentitetaDostupna: false }]) {
      await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: person({}, patch) }} onClose={noop} onRetry={noop} />));
      expect(factLabels()).not.toContain('Identitet je potvrđen'); expect(all()).not.toContain('Identitet je potvrđen');
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
    await show(person({ biografija: 'Radim brzo.' }), { safety: { onPress, busy: false, error: null } });
    const entry = labelled(`${SAFETY_LABEL}: Marija Marić`)[0];
    expect(textOf(entry)).toContain(SAFETY_LABEL); expect(textOf(entry)).toContain('Osoba koju prijavljuješ ne vidi prijavu.');
    const label = entry.findAll(node => String(node.type) === 'T' && textOf(node) === SAFETY_LABEL)[0];
    expect(StyleSheetFlat(label.props.style).color).toBe(sys.color.danger);
    // Everything else on the sheet is read: the only Press besides the sheet's own close is this entry.
    const presses = tree.root.findAll(node => String(node.type) === 'Press').map(node => node.props.accessibilityLabel);
    expect(presses.filter(label => label !== 'Zatvori javni profil')).toEqual([`${SAFETY_LABEL}: Marija Marić`]);
    // Last: after the facts and "O meni".
    const order = tree.root.findAll(node => String(node.type) === 'T').map(node => textOf(node));
    expect(order.indexOf(SAFETY_LABEL)).toBeGreaterThan(order.indexOf('Radim brzo.')); expect(order.indexOf(SAFETY_LABEL)).toBeGreaterThan(order.indexOf('O meni'));
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

describe('what the server does not carry yet (traži server)', () => {
  it('is not drawn, has no control and no placeholder, by default', async () => {
    expect(PUBLIC_PROFILE_SERVER_FACTS_BUILT).toBe(false);
    await show(person({}, { zavrseniBroj: 41 }), { serverFacts: { agreedCount: 43, memberSince: '2026-10-02' } });
    expect(all()).not.toMatch(/Dolazi kako je dogovoreno|Na USKOČI|procenat|%|Poslednje ocene|Sve ocene|Veštine/);
    expect(factLabels()).toEqual(['Ocena: 4,8, 12 ocena', 'Završeno 41 zadatak']);
  });

  it('draws the reliability and the member-since rows the day the switch is on, and only with data', async () => {
    await show(person({}, { zavrseniBroj: 41 }), { showServerFacts: true, serverFacts: { agreedCount: 43, memberSince: '2026-10-02' } });
    expect(factLabels()).toEqual(['Ocena: 4,8, 12 ocena', 'Završeno 41 zadatak', 'Dolazi kako je dogovoreno: 95%, 41 od 43 dogovorenih', 'Na USKOČI-ju od oktobra 2026']);
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: person({}, { zavrseniBroj: 41 }) }} onClose={noop} onRetry={noop} showServerFacts />));
    expect(factLabels()).toEqual(['Ocena: 4,8, 12 ocena', 'Završeno 41 zadatak']);
  });

  it('gives a new person a quiet sentence, never "0%" or "100%"', async () => {
    await show(person({}, { zavrseniBroj: 3 }), { showServerFacts: true, serverFacts: { agreedCount: 3, memberSince: null } });
    expect(factLabels()).toContain('Još nema dovoljno zadataka za procenat'); expect(all()).not.toMatch(/\d+%/);
    expect(reliabilityFact(0, 0)).toEqual({ kind: 'few' }); expect(reliabilityFact(4, 4)).toEqual({ kind: 'few' });
  });

  it('computes finished over agreed from five Dogovori, and refuses numbers that cannot be true', () => {
    expect(reliabilityFact(5, 5)).toEqual({ kind: 'percent', percent: 100, detail: '5 od 5 dogovorenih' });
    expect(reliabilityFact(41, 43)).toEqual({ kind: 'percent', percent: 95, detail: '41 od 43 dogovorenih' });
    expect(reliabilityFact(0, 10)).toEqual({ kind: 'percent', percent: 0, detail: '0 od 10 dogovorenih' });
    for (const bad of [[3, 2], [-1, 5], [1.5, 5]] as const) expect(reliabilityFact(bad[0], bad[1])).toBeNull();
    expect(reliabilityFact(3, null)).toBeNull(); expect(reliabilityFact(3, undefined)).toBeNull(); expect(reliabilityFact(3, Number.NaN)).toBeNull();
  });

  it('writes "Na USKOČI-ju od" with the Serbian month, and nothing for a date it cannot read', () => {
    expect(memberSinceFact('2026-10-02')).toBe('Na USKOČI-ju od oktobra 2026');
    expect(memberSinceFact('2027-01-15T10:00:00Z')).toBe('Na USKOČI-ju od januara 2027');
    expect(memberSinceFact('2026-03')).toBe('Na USKOČI-ju od marta 2026');
    for (const bad of [null, undefined, '', 'oktobar', '2026-13-01', '2026-00-10']) expect(memberSinceFact(bad)).toBeNull();
  });
});

describe('layout resilience', () => {
  it.each([[320, 1], [361, 1.15], [390, 1.2999999523], [390, 2]])('keeps the facts as full-width rows of at least 52 dp at width %s and scale %s', async (width, scale) => {
    mockWidth = width; mockFontScale = scale;
    await show(person({ naslov: 'Selidbe i montaža u Beogradu i okolini', biografija: 'Radim sa bratom. '.repeat(20) }, { identitetVerifikovan: true }));
    for (const row of facts().findAll(node => node.props.accessible === true)) {
      expect(StyleSheetFlat(row.props.style)).toMatchObject({ flexDirection: 'row' }); expect(StyleSheetFlat(row.props.style).minHeight).toBeGreaterThanOrEqual(52);
    }
    const portrait = tree.root.findByProps({ testID: 'public-profile-portrait' });
    expect(StyleSheetFlat(portrait.props.style)).toMatchObject({ width: 96, height: 96 });
  });

  it('keeps every text at 12 px or more', async () => {
    await show(person({ biografija: 'Radim.' }, { identitetVerifikovan: true }), { safety: { onPress: noop, busy: false, error: null } });
    for (const node of tree.root.findAll(node => String(node.type) === 'T')) {
      const size = StyleSheetFlat(node.props.style).fontSize;
      if (typeof size === 'number') expect(size).toBeGreaterThanOrEqual(12);
    }
  });
});

function FakePhoto() { return <></>; }
function StyleSheetFlat(style: unknown): Record<string, any> { return Object.assign({}, ...[style].flat(4).filter(Boolean)); }
