import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { brandAction } from '../../ui/system/tokens';
// The one primary action is the Press whose own surface is the brand surface (last style wins, as in React Native).
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
import type { PotrebaProjekcija } from '../../contracts/projections';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import { ArrowRight } from 'phosphor-react-native';
import { NeedPresentation } from '../../ui/v2/NeedPresentation';

let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const labels = () => presses().map(node => node.props.accessibilityLabel);
const brand = () => presses().filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor).map(node => node.props.accessibilityLabel);
const byLabel = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
// Owner step 5b (2026-09-24): what changes the task is rare, so it moved from the end of the screen into the bar's "···".
// These read the menu the way a person does: open it, then read its rows. No "···" at all means nothing rare to do.
const menuLabels = async (): Promise<string[]> => {
  const more = presses().find(node => node.props.accessibilityLabel === 'Više radnji');
  if (!more) return [];
  await act(async () => more.props.onPress());
  return presses().filter(node => node.props.accessibilityRole === 'menuitem').map(node => node.props.accessibilityLabel);
};
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const need = (patch: Partial<PotrebaProjekcija> = {}): PotrebaProjekcija => ({ id: 'need', revizija: 3, naslov: 'Prenos ormara', opis: 'Ormar sa trećeg sprata.', stanje: 'OBJAVLJENA',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: 'Sutra', podrucjeTekst: 'Novi Sad, Liman', uslovi: ['Trake'], brojPrijava: 3, rezimCene: 'MY_PRICE',
  ponudjenaCena: { iznos: 4000, valuta: 'RSD', prikaz: '4.000 RSD' }, ...patch });
const noop = () => {};

test('PKG-035: task detail retains history without promising an unavailable selection', async () => {
  await act(async () => { tree = create(<Screen value={Object.assign(need({ brojPrijava: 7 }), { brojPrijavaZaIzbor: 0 })} />); });
  expect(texts()).toContain('Trenutno nema prijava za izbor.');
  expect(texts()).toContain('Ukupno 7 prijava');
  expect(texts()).not.toContain('Sledeće: izbor.');
  expect(labels()).toContain('Otvori prijave. Trenutno nema prijava za izbor. Ukupno 7 prijava');
  // Nothing is the owner's to choose, so there is no green action (plan 3.5): the sentence says what the task waits for, and the
  // history of the applications stays one quiet row away.
  expect(texts()).toContain('Trenutno nema prijava za izbor. Nove vidiš ovde i u zvoncu.');
  expect(texts()).not.toContain('Pregledaj prijave · ');
  expect(brand()).toEqual([]);
});
test('PKG-035: when the server has not said how many can be chosen, the page counts the total and says so', async () => {
  await act(async () => { tree = create(<Screen value={need({ brojPrijava: 5 })} />); });
  expect(texts()).toContain('Imaš 5 prijava. Pogledaj ih.');
  expect(brand()).toEqual(['Pogledaj prijave, ukupno 5 prijava']);
});
function Screen({ value, loading = false, error = null, remainingClosed = false }: {
  value: PotrebaProjekcija | null; loading?: boolean; error?: string | null; remainingClosed?: boolean;
  }) {
  return <NeedPresentation need={value} loading={loading} error={error} busy={false} remainingClosed={remainingClosed}
    onBack={noop} onRefresh={noop} onReview={noop} onEdit={noop} onCloseRemaining={noop} onCandidates={noop} />;
}

test('my own draft is mine to act on from wherever I opened it: no way across is needed and none is drawn', async () => {
  // Owner decision 1 (2026-09-19) supersedes the owner decision of 2026-09-18 here. A draft opened
  // while the app stood in the other mode used to be read-only, with a notice offering to switch the
  // whole app. The screen is the view of the owner, read through the owner-only read, so it simply acts.
  await act(async () => { tree = create(<Screen value={need({ stanje: 'NACRT', brojPrijava: 0 })} />); });
  expect(texts()).not.toMatch(/Ovo radiš kao|JA MOGU|MENI TREBA|iz Profila/);
  expect(labels()).not.toContain('Pređi u MENI TREBA'); expect(await menuLabels()).toContain('Izmeni nacrt');
});
test('a published Task leads with its state, title and the applications to choose among, retains work facts, and has one brand action', async () => {
  await act(async () => { tree = create(<Screen value={need({ stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 3 })} />); });
  const copy = texts();
  // ONE state (the chip every list wears, "Bira se · 3": it waits for the owner), the name, ONE grey sentence about what is next.
  expect(copy).toContain('Bira se · 3'); expect(copy).toContain('Prenos ormara'); expect(copy).toContain('4.000 RSD'); expect(copy).not.toContain('2 osobe');
  expect(copy).toContain('Ormar sa trećeg sprata.'); expect(copy).toContain('Imaš 3 prijave. Uporedi ih i izaberi.');
  expect(copy).not.toContain('Čeka prijave');
  // The applications are the one green action; a row that opened the same list would be a second door, so it is not drawn.
  expect(labels()).not.toContain('Otvori prijave. 3 prijave za izbor');
  expect(copy).toContain('Uporedi prijave'); expect(copy).not.toContain('Uporedi prijave · 3');
  expect(brand()).toEqual(['Uporedi prijave, 3 prijave za izbor']);
  // The edit is behind "···" now, and opening the menu adds no second brand action.
  expect(await menuLabels()).toContain('Izmeni zadatak');
  expect(brand()).toEqual(['Uporedi prijave, 3 prijave za izbor']);
  // Recomposed from zero (2026-09-23): the place is one section, never a disclosure that repeats it.
  expect(labels()).not.toContain('Mesto izvršenja');
  // Required equipment is now readable immediately, before any disclosure is opened.
  expect(copy).toContain('Trake');
  // Potrebno says how many places are taken; a price with no stated basis stays the bare amount, with no invented note.
  expect(copy).toContain('0/2');
  // The state is on top, the name under it, the next step under the name (the bar's hidden copy of the name comes first in the tree).
  expect(copy.indexOf('Bira se · 3')).toBeLessThan(copy.lastIndexOf('Prenos ormara'));
  expect(copy.lastIndexOf('Prenos ormara')).toBeLessThan(copy.indexOf('Imaš 3 prijave. Uporedi ih i izaberi.'));
  // The next step is the owner's decision; the retained work facts follow.
  expect(copy.indexOf('Imaš 3 prijave. Uporedi ih i izaberi.')).toBeLessThan(copy.indexOf('4.000 RSD'));
  expect(copy).not.toMatch(/Ukupno za ceo zadatak|Po osobi/);
});
test('V41 facts: the place, Termin as day and hours, Potrebno, and the price with what it covers', async () => {
  const fixed = need({ vremeTekst: '20. sep 2026 · 18:00 – 19:00 (po vremenu u Srbiji)', rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON',
    ponudjenaCena: { iznos: 3000, valuta: 'RSD', prikaz: '3.000 RSD' },
    schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-20T16:00:00Z', endsAt: '2026-09-20T17:00:00Z' } });
  await act(async () => { tree = create(<Screen value={fixed} />); });
  const spoken = tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel);
  // The saved sentence is shown whole as the value of Termin; nothing is reworded, and it is heard whole.
  expect(texts()).toContain('20. sep 2026 · 18:00 – 19:00 (po vremenu u Srbiji)');
  // The facts are the system's `FactRow`: a screen reader hears each as its own sentence (the fact, then its note), the same on this page
  // as on the page of the task somebody else sees; the picture is decoration. What the old page prefixed ("Termin: ", "Lokacija: ") is said by the value.
  expect(spoken).toContain('20. sep 2026 · 18:00 – 19:00 (po vremenu u Srbiji)');
  expect(spoken).toContain('Novi Sad, Liman');
  expect(spoken).toContain('Dogovoreno 0/2');
  // The figure stays large and what it covers goes quietly beside it, in the words the rest of the app uses.
  expect(texts()).toContain('3.000 RSD Po osobi · ukupno 6.000 RSD');
  expect(spoken).toContain('Budžet: 3.000 RSD, Po osobi · ukupno 6.000 RSD');
  await act(async () => tree.unmount());
  // A flexible range is never split into a day and an hour it does not have.
  await act(async () => { tree = create(<Screen value={need({ vremeTekst: 'Fleksibilan raspon · 13. sep 2026 – 14. sep 2026',
    schedule: { kind: 'FLEXIBLE', startsAt: '2026-09-12T22:00:00Z', endsAt: '2026-09-14T22:00:00Z' } })} />); });
  expect(texts()).toContain('Fleksibilan raspon · 13. sep 2026 – 14. sep 2026');
});
test('an open price is a word, not an amount, and the owner is told who names it; a draft has no places to fill yet', async () => {
  await act(async () => { tree = create(<Screen value={need({ stanje: 'NACRT', brojPrijava: 0, rezimCene: 'OFFERS', ponudjenaCena: undefined })} />); });
  const price = tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.children === 'Tražim ponude')[0];
  expect(price.props.children).toBe('Tražim ponude');
  expect(texts()).not.toContain('RSD');
  expect(texts()).not.toContain('NaN');
  expect(texts()).toContain('Svako u prijavi predlaže ukupan iznos.');
  expect(texts()).not.toContain('popunjeno');
});
test('the footer leads somewhere with an arrow; while an action runs it says so, is disabled and points nowhere', async () => {
  await act(async () => { tree = create(<Screen value={need({ stanje: 'CEKA_PRIJAVE', brojPrijavaZaIzbor: 3 })} />); });
  expect(byLabel('Uporedi prijave, 3 prijave za izbor').findAllByType(ArrowRight)).toHaveLength(1);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<NeedPresentation need={need()} loading={false} error={null} busy remainingClosed={false}
    onBack={noop} onRefresh={noop} onReview={noop} onEdit={noop} onCloseRemaining={noop} onCandidates={noop} />); });
  const footer = byLabel('Samo trenutak…');
  expect(footer.props.disabled).toBe(true);
  expect(footer.findAllByType(ArrowRight)).toHaveLength(0);
});
test('a server-authoritative recovery action replaces only the one footer CTA and keeps the existing task reading surface', async () => {
  const onReopen = jest.fn();
  const partial = need({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
  await act(async () => { tree = create(<NeedPresentation need={partial} loading={false} error={null} busy={false} remainingClosed
    onBack={noop} onRefresh={noop} onReview={noop} onEdit={noop} onCloseRemaining={noop} onCandidates={noop} onAgreements={noop}
    primaryOverride={{ label: 'Ponovo traži ljude', onPress: onReopen }} />); });
  expect(texts()).toContain('preostala potraga je zatvorena');
  expect(labels()).toContain('Moji Dogovori');
  expect(brand()).toEqual(['Ponovo traži ljude']);
  await act(async () => byLabel('Ponovo traži ljude').props.onPress());
  expect(onReopen).toHaveBeenCalledTimes(1);
});

test('a private draft explains the next step and leads with the review; a closed remaining search is stated, not offered', async () => {
  await act(async () => { tree = create(<Screen value={need({ stanje: 'NACRT', brojPrijava: 0 })} />); });
  // The state is the chip on top ("Nacrt"), the sentence under the title says it is private and what the one action does.
  expect(texts()).toContain('Nacrt'); expect(texts()).toContain('Nacrt je privatan. Pregledaj ga i objavi.');
  expect(texts()).not.toContain('Privatan nacrt'); expect(texts()).not.toContain('Spremi zadatak za objavu'); expect(brand()).toEqual(['Pregledaj za objavu']);
  const draftMenu = await menuLabels();
  expect(draftMenu).toContain('Izmeni nacrt'); expect(draftMenu).not.toContain('Izmeni zadatak');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Screen value={need({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } })} remainingClosed />); });
  // Owner step 5b (2026-09-24): the closed search is said once, in the state line under the title, not in a note at the end.
  expect(texts()).toContain('preostala potraga je zatvorena'); expect(texts()).not.toContain('Originalni Zadatak');
  const closedMenu = await menuLabels();
  expect(closedMenu).not.toContain('Ne traži više nikoga'); expect(closedMenu).not.toContain('Izmeni zadatak');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Screen value={need({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } })} />); });
  expect(await menuLabels()).toContain('Ne traži više nikoga');
});
test('loading shows placeholder geometry with a spoken status; an error keeps one retry', async () => {
  await act(async () => { tree = create(<Screen value={null} loading />); });
  expect(texts()).toContain('Učitavamo zadatak…'); expect(brand()).toEqual([]);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Screen value={null} error="Zadatak trenutno nije moguće učitati." />); });
  expect(texts()).toContain('Zadatak nije dostupan'); expect(byLabel('Pokušaj ponovo')).toBeTruthy(); expect(brand()).toEqual(['Pokušaj ponovo']);
});
