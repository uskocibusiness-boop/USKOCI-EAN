import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { brandAction } from '../../ui/system/tokens';
import type { PotrebaProjekcija } from '../../contracts/projections';
import type { NeedPublicationReadiness } from '../needPublicationReadiness';
import type { OverviewSearch } from '../../ui/v2/ownTaskOverview';
import { ownTaskStanding } from '../ownTaskStanding';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import { NeedPresentation, type NeedPresentationProps } from '../../ui/v2/NeedPresentation';

/**
 * The owner's own task page, state by state (owner, 2026-10-07: the whole life of a task "vidno i lako razumljivo"): ONE chip at the
 * top in the owner's eight words, the name, ONE grey sentence about what happens next, at most ONE green action, and the quiet ways in
 * that the green one does not already offer. The words themselves are the pure model's (own-task-overview.test); this reads them as
 * the screen draws them.
 */
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const HALF = { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 };
const FULL = { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 };
const need = (patch: Partial<PotrebaProjekcija> & { kraj?: string } = {}): PotrebaProjekcija => ({ id: 'need', revizija: 3, naslov: 'Prenos ormara', opis: 'Ormar sa trećeg sprata.',
  stanje: 'OBJAVLJENA', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: 'Sutra', podrucjeTekst: 'Novi Sad, Liman', uslovi: [],
  brojPrijava: 0, brojPrijavaZaIzbor: 0, rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 4000, valuta: 'RSD', prikaz: '4.000 RSD' }, ...patch } as PotrebaProjekcija);
const calls = { review: jest.fn(), edit: jest.fn(), candidates: jest.fn(), agreements: jest.fn(), refresh: jest.fn() };
const draw = async (patch: Parameters<typeof need>[0], extra: Partial<NeedPresentationProps> = {}) => {
  for (const mock of Object.values(calls)) mock.mockClear();
  await act(async () => { tree = create(<NeedPresentation need={need(patch)} loading={false} error={null} busy={false} remainingClosed={false}
    onBack={() => {}} onRefresh={calls.refresh} onReview={calls.review} onEdit={calls.edit} onCloseRemaining={() => {}} onCandidates={calls.candidates}
    onAgreements={calls.agreements} {...extra} />); });
};
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const labels = () => presses().map(node => node.props.accessibilityLabel);
const brand = () => presses().filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor).map(node => node.props.accessibilityLabel);
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
const chips = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'status-chip');
const chipWords = () => chips().map(node => node.props.accessibilityLabel);
const sentence = () => tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.testID === 'own-task-next')[0]?.props.children ?? null;
const press = async (label: string) => { await act(async () => presses().find(node => node.props.accessibilityLabel === label)!.props.onPress()); };
const search = (patch: Partial<OverviewSearch> = {}): OverviewSearch => ({ status: 'PUBLISHED', coveredSlots: 0, searchAuthority: 'OPEN',
  searchTimeAdmitted: true, agreementCount: 0, activeAgreementCount: 0, ...patch });

describe('one chip, one sentence, at most one green action', () => {
  // [what the server read says, the chip as a screen reader hears it, the sentence, the green action]. A sentence the list of "Moji zadaci"
  // says under its card (`ownTaskStanding`) is that sentence here too, so the two cannot disagree; the others are this page's own.
  const FIXED_NOW = { kind: 'FIXED_WINDOW' as const, startsAt: '2020-01-01T08:00:00Z', endsAt: '2099-01-01T08:00:00Z' };
  const listSays = (patch: Parameters<typeof need>[0]) => ownTaskStanding(need(patch)).next as string;
  const table: [string, Parameters<typeof need>[0], string, string | null, string | null][] = [
    ['a draft', { stanje: 'NACRT' }, 'Nacrt', 'Nacrt je privatan. Pregledaj ga i objavi.', 'Pregledaj za objavu'],
    ['a published task nobody applied to', { stanje: 'OBJAVLJENA' }, 'Objavljen', listSays({ stanje: 'OBJAVLJENA' }), null],
    ['applications to choose among', { stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 3 }, 'Bira se, 3', 'Imaš 3 prijave. Uporedi ih i izaberi.', 'Uporedi prijave, 3 prijave za izbor'],
    ['one place agreed of two, applications still waiting', { stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijava: 2, brojPrijavaZaIzbor: 2 }, 'Bira se, 2',
      'Dogovoreno 1 od 2. Imaš 2 prijave. Uporedi ih i izaberi.', 'Uporedi prijave, 2 prijave za izbor'],
    ['one place agreed of two, nobody waiting', { stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijavaZaIzbor: 0 }, 'Dogovoren, 1 od 2',
      listSays({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijavaZaIzbor: 0 }), 'Otvori Dogovor'],
    ['every place agreed', { stanje: 'POPUNJENA', pokrivenost: FULL }, 'Dogovoren', 'Sva mesta su dogovorena.', 'Otvori Dogovor'],
    ['every place agreed and the agreed time has come', { stanje: 'POPUNJENA', pokrivenost: FULL, schedule: FIXED_NOW }, 'U toku', 'Dogovoreni termin je počeo.', 'Otvori Dogovor'],
    ['a task that was completed', { stanje: 'ZATVORENA', kraj: 'COMPLETED', pokrivenost: FULL }, 'Završen', 'Zadatak je završen.', null],
    ['a task that was cancelled', { stanje: 'ZATVORENA', kraj: 'CANCELLED' }, 'Otkazan', listSays({ stanje: 'ZATVORENA', kraj: 'CANCELLED' }), null],
    ['a task that expired', { stanje: 'ZATVORENA', kraj: 'EXPIRED' }, 'Istekao', listSays({ stanje: 'ZATVORENA', kraj: 'EXPIRED' }), null],
  ];

  it.each(table)('%s', async (_name, patch, chip, next, green) => {
    await draw(patch);
    // ONE state, in the owner's words, never "Čeka prijave" and never a dot-and-word line of the page's own.
    expect(chipWords()).toEqual([chip]);
    expect(texts()).not.toContain('Čeka prijave'); expect(texts()).not.toContain('Privatan nacrt'); expect(texts()).not.toContain('Popunjen');
    // ONE grey next step.
    expect(sentence()).toBe(next);
    // At most ONE green action, and none where nothing is the owner's to do.
    expect(brand()).toEqual(green ? [green] : []);
  });

  it('reads top to bottom: the state, the name, the next step, and only then the facts', async () => {
    await draw({ stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 3 });
    const all = texts();
    const at = (value: string) => all.findIndex(text => text.includes(value));
    const order = [at('Bira se'), all.lastIndexOf('Prenos ormara'), at('Imaš 3 prijave'), at('4.000 RSD'), at('Ormar sa trećeg sprata.')];
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('the green action does what it says, once, through the screen\'s own callbacks', async () => {
    await draw({ stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 3 });
    await press('Uporedi prijave, 3 prijave za izbor'); expect(calls.candidates).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
    await draw({ stanje: 'POPUNJENA', pokrivenost: FULL });
    await press('Otvori Dogovor'); expect(calls.agreements).toHaveBeenCalledTimes(1); expect(calls.candidates).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
    await draw({ stanje: 'NACRT' });
    await press('Pregledaj za objavu'); expect(calls.review).toHaveBeenCalledTimes(1); expect(calls.edit).not.toHaveBeenCalled();
  });
});

describe('the quiet ways in', () => {
  it('a row opens the applications only when the green action does not, and never for an empty list', async () => {
    await draw({ stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 3 });
    // Two doors to the same list are one too many.
    expect(labels().filter(label => typeof label === 'string' && label.startsWith('Otvori prijave'))).toEqual([]);
    await act(async () => tree.unmount());
    await draw({ stanje: 'OBJAVLJENA', brojPrijava: 0, brojPrijavaZaIzbor: 0 });
    expect(labels().filter(label => typeof label === 'string' && label.startsWith('Otvori prijave'))).toEqual([]);
    await act(async () => tree.unmount());
    await draw({ stanje: 'OBJAVLJENA', brojPrijava: 4, brojPrijavaZaIzbor: 0 });
    expect(labels()).toContain('Otvori prijave. Trenutno nema prijava za izbor. Ukupno 4 prijave');
    await press('Otvori prijave. Trenutno nema prijava za izbor. Ukupno 4 prijave'); expect(calls.candidates).toHaveBeenCalledTimes(1);
  });

  it('the Dogovori are one row away while the green action chooses among the applications that wait', async () => {
    await draw({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijava: 2, brojPrijavaZaIzbor: 2 });
    expect(brand()).toEqual(['Uporedi prijave, 2 prijave za izbor']);
    expect(labels()).toContain('Moji Dogovori');
    await press('Moji Dogovori'); expect(calls.agreements).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
    // When the green action IS the Dogovor, no second door to it.
    await draw({ stanje: 'POPUNJENA', pokrivenost: FULL });
    expect(labels()).not.toContain('Moji Dogovori');
  });

  it('the search recovery\'s own action replaces the green one and what it replaced is a quiet row', async () => {
    const onPress = jest.fn();
    await draw({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijava: 2, brojPrijavaZaIzbor: 0 },
      { remainingClosed: true, primaryOverride: { label: 'Ponovo traži ljude', onPress } });
    expect(brand()).toEqual(['Ponovo traži ljude']);
    expect(labels()).toContain('Moji Dogovori');
    expect(texts()).toContain('1 od 2 dogovoreno · preostala potraga je zatvorena');
  });
});

describe('the search continues', () => {
  const cancelled = (patch: Partial<OverviewSearch> = {}) => search({ agreementCount: 1, activeAgreementCount: 0, ...patch });

  it('after a Dogovor was cancelled the page says what the task is doing now', async () => {
    await draw({ stanje: 'OBJAVLJENA', brojPrijava: 1, brojPrijavaZaIzbor: 0 }, { search: { state: cancelled(), speaks: false } });
    expect(sentence()).toBe('Dogovor je otkazan. Tvoj zadatak opet prima prijave.');
    expect(chipWords()).toEqual(['Objavljen']); expect(brand()).toEqual([]);
  });

  it('and offers another application where applications still wait', async () => {
    await draw({ stanje: 'CEKA_PRIJAVE', brojPrijava: 2, brojPrijavaZaIzbor: 2 }, { search: { state: cancelled(), speaks: false } });
    expect(brand()).toEqual(['Izaberi drugu prijavu, 2 prijave za izbor']);
    expect(String(sentence())).toMatch(/^Dogovor je otkazan\. Imaš 2 prijave\./);
    await press('Izaberi drugu prijavu, 2 prijave za izbor'); expect(calls.candidates).toHaveBeenCalledTimes(1);
  });

  it('says nothing about a Dogovor it cannot be sure ended', async () => {
    await draw({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijavaZaIzbor: 0 },
      { search: { state: search({ coveredSlots: 1, agreementCount: 2, activeAgreementCount: 1 }), speaks: false } });
    expect(String(sentence())).not.toMatch(/otkazan/);
  });
});

describe('a draft the publication gate holds back', () => {
  const held = (code: string): NeedPublicationReadiness => ({ kind: 'NOT_READY', code, missingSlots: [] });

  it('whose place is missing opens the conversation, and says why where the owner reads first', async () => {
    await draw({ stanje: 'NACRT' }, { readiness: held('LOCATION_INCOMPLETE') });
    expect(texts()).toContain('Fali još mesto na mapi');
    expect(brand()).toEqual(['Otvori razgovor i dopuni']); expect(sentence()).toBeNull();
    await press('Otvori razgovor i dopuni'); expect(calls.edit).toHaveBeenCalledTimes(1); expect(calls.review).not.toHaveBeenCalled();
  });

  it('that only waits has no green action: it says why and offers to read again', async () => {
    await draw({ stanje: 'NACRT' }, { readiness: held('PUBLIC_MEDIA_NOT_READY') });
    expect(texts()).toContain('Fotografije se još obrađuju');
    expect(brand()).toEqual([]);
    expect(tree.root.findAllByProps({ label: 'Pregledaj za objavu' })).toHaveLength(0);
    const again = tree.root.findByProps({ label: 'Osveži zadatak' });
    await act(async () => again.props.onPress()); expect(calls.refresh).toHaveBeenCalledTimes(1);
    // The same for "not your fault": the owner can only look again later.
    await act(async () => tree.unmount());
    await draw({ stanje: 'NACRT' }, { readiness: held('EVALUATOR_UNAVAILABLE') });
    expect(texts()).toContain('Nije do tebe. Nacrt je sačuvan, pokušaj kasnije.'); expect(brand()).toEqual([]);
  });

  it('whose reason the app does not know goes to the review, which lists what is missing', async () => {
    await draw({ stanje: 'NACRT' }, { readiness: held('SOMETHING_ELSE') });
    expect(brand()).toEqual(['Pregledaj za objavu']);
    await press('Pregledaj za objavu'); expect(calls.review).toHaveBeenCalledTimes(1);
  });
});

describe('while an action runs', () => {
  it('the one action says so, is disabled and points nowhere, whatever it was', async () => {
    await draw({ stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 3 }, { busy: true });
    expect(brand()).toEqual(['Radnja je u toku…']);
    const working = presses().find(node => node.props.accessibilityLabel === 'Radnja je u toku…')!;
    expect(working.props.disabled).toBe(true);
    // A task that is waiting for applications and is not busy draws no button at all.
    await act(async () => tree.unmount());
    await draw({ stanje: 'OBJAVLJENA' }, { busy: false });
    expect(brand()).toEqual([]);
  });
});
