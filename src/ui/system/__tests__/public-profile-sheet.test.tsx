import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { JavniProfilPoverenje, JavniProfilProjekcija } from '../../../contracts/projections';

/**
 * A person's public profile (T4/T5, 2026-10-07; UI/UX pass 2026-10-08, F6), in every state it can be in. It shows only what the server really
 * carries: the name, the city, "O meni" when the person wrote one, the facts as the system's `FactRow`s (the rating with the count it stands
 * on, "Završeno N zadataka" and, only when it is true, "Identitet je potvrđen"), then what the trust read (PROFILE-TRUST, R30) returned for
 * this viewer; the safety entry is last. What the server does not return - a HIDDEN trust block, a part it left out - is not drawn: no row, no
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
import { PublicProfileSheet, SAFETY_LABEL, finishedPhrase, memberSinceFact, publicRating } from '../PublicProfileSheet';

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
const facts = () => tree.root.findByProps({ testID: 'public-profile-facts' });
/** The fact rows of the sheet, in the order they are drawn: each is a `FactRow` (a host view with a test id), spoken as its sentence. */
const factRows = () => facts().findAll(node => typeof node.type === 'string' && typeof node.props.testID === 'string' && node.props.testID.startsWith('public-profile-fact-'));
const factLabels = () => factRows().map(node => node.props.accessibilityLabel as string);
const factIds = () => factRows().map(node => (node.props.testID as string).replace('public-profile-fact-', ''));
const factRow = (name: string) => facts().findAll(node => node.props.testID === `public-profile-fact-${name}` && typeof node.type === 'string')[0];
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
    const row = factRow('rating');
    expect(row.props.accessibilityLabel).toBe('4,8 · 12 ocena'); expect(textOf(row)).toBe('4,8 · 12 ocena');
    expect(row.findAllByType('FactArt' as never)[0].props.kind).toBe('star');
    // The row is not a control: no read of another person's ratings exists, so nothing opens.
    expect(row.props.onPress).toBeUndefined(); expect(tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith('4,8'))).toHaveLength(0);
  });

  it.each([[5, '5,0'], [4.75, '4,75'], [3, '3,0'], [4.8, '4,8']])('writes %s as "%s"', (value, written) => {
    expect(publicRating(trust({ ocenaProsek: value, brojRecenzija: 3 }))).toEqual({ kind: 'rated', value: written, count: '3 ocene' });
  });

  it.each([[1, '1 ocena'], [2, '2 ocene'], [4, '4 ocene'], [5, '5 ocena'], [11, '11 ocena'], [12, '12 ocena'], [21, '21 ocena'], [22, '22 ocene'], [100, '100 ocena']])(
    'counts %s the Serbian way: "%s"', (count, written) => {
      expect(publicRating(trust({ brojRecenzija: count }))).toEqual({ kind: 'rated', value: '4,8', count: written });
    });

  it('says "Još nema ocena" when there are no reviews, without a number and without the star that stands for a rating', async () => {
    await show(person({}, { ocenaProsek: null, brojRecenzija: 0, ocenaDostupna: false, recenzijeDostupne: true }));
    expect(textOf(factRow('rating'))).toBe('Još nema ocena');
    expect(factRow('rating').findAllByType('FactArt' as never)[0].props.kind).toBe('info');
  });

  it('says it is not available when the server does not know, and never shows a number it was not given', async () => {
    await show(person({}, { ocenaProsek: 4.9, brojRecenzija: 27, ocenaDostupna: false, recenzijeDostupne: false }));
    expect(textOf(factRow('rating'))).toBe('Ocena nije dostupna');
    expect(all()).not.toContain('4,9'); expect(all()).not.toContain('27');
  });

  it('shows a rating alone when only the rating is known, never a made-up count', async () => {
    await show(person({}, { brojRecenzija: null, recenzijeDostupne: false }));
    expect(textOf(factRow('rating'))).toBe('4,8');
  });
});

describe('"Završeno N zadataka"', () => {
  it.each([[0, 'Završeno 0 zadataka'], [1, 'Završeno 1 zadatak'], [2, 'Završeno 2 zadatka'], [4, 'Završeno 4 zadatka'], [5, 'Završeno 5 zadataka'],
    [11, 'Završeno 11 zadataka'], [14, 'Završeno 14 zadataka'], [21, 'Završeno 21 zadatak'], [22, 'Završeno 22 zadatka'], [41, 'Završeno 41 zadatak']])(
    'says %s as "%s", in the row and to a screen reader', async (count, written) => {
      expect(finishedPhrase(count)).toBe(written);
      await show(person({}, { zavrseniBroj: count }));
      expect(factRow('finished').props.accessibilityLabel).toBe(written); expect(textOf(factRow('finished'))).toBe(written);
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
    // A command with red words that does open the report: it keeps its arrow.
    const label = entry.findAll(node => String(node.type) === 'T' && textOf(node) === SAFETY_LABEL)[0];
    expect(label.props.tone).toBe('danger');
    expect(entry.findAll(node => node.props.name === 'caret-right').length).toBeGreaterThan(0);
    expect(entry.props.accessibilityHint).toContain('Otvara prijavu ili blokiranje osobe.');
    // Everything else on the sheet is read: the only Press besides the sheet's own close is this entry.
    const presses = tree.root.findAll(node => String(node.type) === 'Press').map(node => node.props.accessibilityLabel);
    expect(presses.filter(label => label !== 'Zatvori javni profil')).toEqual([`${SAFETY_LABEL}: Marija Marić`]);
    // Last: after the facts and "O meni".
    const order = tree.root.findAll(node => String(node.type) === 'T').map(node => textOf(node));
    expect(order.indexOf(SAFETY_LABEL)).toBeGreaterThan(order.indexOf('Radim brzo.')); expect(order.indexOf(SAFETY_LABEL)).toBeGreaterThan(order.indexOf('O meni'));
    expect(order.indexOf(SAFETY_LABEL)).toBeGreaterThan(order.indexOf('Završeno 14 zadataka'));
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

  it('is not drawn without a trust read: the sheet is what it was', async () => {
    await show(person({}, { zavrseniBroj: 41 }));
    expect(factIds()).toEqual(base); expect(factLabels()).toEqual(['4,8 · 12 ocena', 'Završeno 41 zadatak']);
    expect(all()).not.toMatch(/Dolazi kako je dogovoreno|Na USKOČI|procenat|%|Dogovoreno/);
  });

  it.each([['a HIDDEN block (the default for a visitor today)', hiddenTrust()], ['a "nothing here" answer', null], ['no answer at all', undefined]])(
    'draws NOTHING for %s: no row, no placeholder, no word about what is hidden', async (_name, value) => {
      await show(person({}, { zavrseniBroj: 41 }), { trust: value });
      expect(factIds()).toEqual(base);
      expect(all()).not.toMatch(/skriven|sakriven|privatn|nije vidljiv|samo ti|samo on|Dogovoreno|Dolazi kako je dogovoreno|Na USKOČI|procenat|%/i);
    });

  it('adds the agreed tasks, the reliability and the month, in that order after what the profile already carries, when the server lets this viewer have them', async () => {
    await show(person({}, { zavrseniBroj: 14 }), { trust: workTrust() });
    expect(factIds()).toEqual([...base, 'agreed', 'reliability', 'since']);
    expect(factLabels()).toEqual(['4,8 · 12 ocena', 'Završeno 14 zadataka', 'Dogovoreno 16 zadataka', 'Dolazi kako je dogovoreno: 88%', 'Na USKOČI-ju od marta 2026']);
  });

  it('says there are not enough Dogovori for a percentage, as a sentence about the person, and never draws "0%" or "100%"', async () => {
    await show(person({}, { zavrseniBroj: 3 }), { trust: workTrust({ completedCount: 3, agreedCount: 4, reliabilityPercent: null, reliabilityState: 'TOO_FEW' }) });
    expect(factLabels()).toEqual(['4,8 · 12 ocena', 'Završeno 3 zadatka', 'Dogovoreno 4 zadatka', 'Još nema dovoljno Dogovora za procenat', 'Na USKOČI-ju od marta 2026']);
    expect(all()).not.toMatch(/\d+%/);
  });

  it('leaves out a part the server did not return, and a month it cannot read', async () => {
    await show(person({}, { zavrseniBroj: 14 }), { trust: workTrust({ agreedCount: null, memberSince: null }) });
    expect(factIds()).toEqual([...base, 'reliability']);
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: person({}, { zavrseniBroj: 14 }) }} onClose={noop} onRetry={noop}
      trust={workTrust({ memberSince: 'oktobar' })} />));
    expect(factIds()).toEqual([...base, 'agreed', 'reliability']);
  });

  it('shows the person themself what the server returns for them, on the same rows', async () => {
    await show(person({}, { zavrseniBroj: 14 }), { trust: workTrust({ self: true, visibility: 'OWN_ONLY' }) });
    expect(factIds()).toEqual([...base, 'agreed', 'reliability', 'since']);
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
  it.each([[320, 1], [361, 1.15], [390, 1.2999999523], [390, 2]])('keeps the facts as full-width rows that wrap, and the safety entry a touch of 48 dp, at width %s and scale %s', async (width, scale) => {
    mockWidth = width; mockFontScale = scale;
    await show(person({ naslov: 'Selidbe i montaža u Beogradu i okolini', biografija: 'Radim sa bratom. '.repeat(20) }, { identitetVerifikovan: true }),
      { trust: workTrust(), safety: { onPress: noop, busy: false, error: null } });
    for (const row of factRows()) {
      expect(StyleSheetFlat(row.props.style)).toMatchObject({ flexDirection: 'row' });
      // The fact is the line and it wraps: no ellipsis anywhere in it.
      for (const line of row.findAll(node => String(node.type) === 'T')) expect(line.props.numberOfLines).toBeUndefined();
    }
    const entry = labelled(`${SAFETY_LABEL}: Marija Marić`)[0];
    expect(StyleSheetFlat(entry.props.style).minHeight).toBeGreaterThanOrEqual(48);
    const portrait = tree.root.findByProps({ testID: 'public-profile-portrait' });
    expect(StyleSheetFlat(portrait.props.style)).toMatchObject({ width: 96, height: 96 });
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
