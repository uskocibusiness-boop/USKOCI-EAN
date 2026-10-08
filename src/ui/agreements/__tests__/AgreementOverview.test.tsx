import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DogovorProjekcija } from '../../../contracts/projections';

/**
 * The overview of a Dogovor, composed once for the route and the gallery (composition spec 4.9, template T3): its order, and that a row
 * is drawn only for a command the route handed it. It decides nothing and reads nothing, so it is drawn here from props alone.
 */
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, fontScale: 1, scale: 3 });
    return ['View', 'ScrollView', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
jest.mock('../../v2/icons', () => ({ V2Icon: 'V2Icon' }));

import { InfoButton } from '../../system/InfoButton';
import { AgreementOverview, type AgreementOverviewProps } from '../AgreementOverview';
import { AgreementProblemNote } from '../AgreementOverviewParts';
import { agreementNextStep, agreementStepsInfo } from '../AgreementWorkspace';

const agreement = (patch: Partial<DogovorProjekcija> = {}): DogovorProjekcija => ({
  id: 'a1', verzija: 1, naslov: 'Prenos ormana do kombija', stanje: 'CONFIRMED', cena: { iznos: 5500, valuta: 'RSD', prikaz: '5.500 RSD' },
  vremeTekst: '26. sep · 17:00–19:00', putanjaTekst: 'Liman, Novi Sad', pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 },
  ucesnici: [{ id: 'ja', profilId: null, ime: 'Ana', inicijali: 'AN', uloga: 'narucilac', mesta: null, viSte: true, telefon: null },
    { id: 'on', profilId: null, ime: 'Marko', inicijali: 'MA', uloga: 'uskocer', mesta: 1, viSte: false, telefon: null }],
  rezim: 'FIZICKI', kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: false, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null, izmenaCeka: null,
  izvor: { zadatakId: 'z1', prijavaId: 'p1' }, ...patch,
});
const noop = () => undefined;
const props = (patch: Partial<AgreementOverviewProps> = {}, over: Partial<AgreementOverviewProps['on']> = {}): AgreementOverviewProps => {
  const item = patch.agreement ?? agreement();
  return { agreement: item, party: true, enabled: true, accountHasNumber: true,
    step: agreementNextStep({ state: item.stanje, party: true, worker: false, change: { waits: false, mine: null }, ownRating: 'NOT_APPLICABLE', problemOpen: false, deadline: '' }),
    steps: { state: item.stanje }, ...patch, on: { togglePhone: noop, openMessages: noop, ...over } };
};
let tree: ReactTestRenderer;
const draw = async (value: AgreementOverviewProps) => { await act(async () => { tree = create(<AgreementOverview {...value} />); }); };
afterEach(async () => { await act(async () => tree?.unmount()); });
const headers = () => tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => node.children.join(''));
const labels = () => tree.root.findAll(node => String(node.type) === 'Press').map(node => String(node.props.accessibilityLabel));
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
/** What stands on the page, in the order it stands: a press by its spoken label, a word by itself. */
const order = () => tree.root.findAll(node => ['Press', 'T'].includes(String(node.type)))
  .map(node => String(node.type) === 'Press' ? `press:${node.props.accessibilityLabel}` : `word:${node.children.filter(child => typeof child === 'string').join('')}`);
const ACTIONS = ['Izmeni uslove', 'Prijavi problem', 'Otkaži Dogovor', 'Prijavi ili blokiraj osobu'];
const everything = { openTask: noop, openChange: noop, openProblem: noop, openCancel: noop, openSafety: noop };

describe('the order of the overview', () => {
  it('is the work\'s name, where the Dogovor stands, its terms, and the contact - parted by space, with no title of its own for the rows that lead elsewhere or for the actions', async () => {
    await draw(props({}, everything));
    expect(headers()).toEqual(['Prenos ormana do kombija', 'Dogovoreno', 'Uslovi', 'Kontakt i mesto']);
    // The rows that lead elsewhere come first, then the actions in the order of the page: the calm ones, the two that end something last.
    expect(labels().filter(label => /^(Otvori zadatak|Izmeni uslove|Prijavi problem|Otkaži Dogovor|Prijavi ili blokiraj)/.test(label)))
      .toEqual(['Otvori zadatak: Prenos ormana do kombija. Liman, Novi Sad', ...ACTIONS]);
  });

  it('puts the note for a missing term and a reported problem under the head, before the terms', async () => {
    await draw(props({ problem: { note: <T2>Problem je prijavljen</T2>, exits: <T2>Šta dalje</T2> } }, { proposeTerm: noop }));
    const words = tree.root.findAll(node => String(node.type) === 'T').map(node => node.children.join(''));
    const at = (word: string) => words.indexOf(word);
    expect(at('Dogovoreno')).toBeLessThan(at('Termin još nije dogovoren'));
    expect(at('Termin još nije dogovoren')).toBeLessThan(at('Problem je prijavljen'));
    expect(at('Šta dalje')).toBeLessThan(at('Uslovi'));
  });
});

describe('a row is drawn only for a command the route gave it', () => {
  it('draws none of the links or actions without commands, and a group Dogovor lists its people', async () => {
    await draw(props({ agreement: agreement({ pokrivenost: { ukupno: 3, popunjeno: 2, preostalo: 1, udeo: 2 / 3 } }) }));
    expect(labels().some(label => /^(Otvori zadatak|Izmeni|Prijavi|Otkaži|Tvoja prijava)/.test(label))).toBe(false);
    expect(headers()).toContain('Ko je u Dogovoru');
  });

  it('has "Izmeni uslove" once, as a row of the actions: the title of the terms carries no second "Izmeni"', async () => {
    await draw(props({}, { openChange: noop }));
    expect(labels().filter(label => label === 'Izmeni uslove')).toHaveLength(1);
    expect(labels()).not.toContain('Izmeni');
  });

  it('puts the note for a missing term only with a command to propose one, and says only what is missing and what to do', async () => {
    await draw(props({}, { openChange: noop }));
    expect(labels()).not.toContain('Predloži termin'); expect(texts()).not.toContain('Termin još nije dogovoren');
    await act(async () => tree.unmount());
    await draw(props({}, { proposeTerm: noop }));
    expect(labels()).toContain('Predloži termin'); expect(labels()).not.toContain('Izmeni uslove');
    // The title and the button say it (J3, J5): no sentence in between.
    expect(texts()).toContain('Termin još nije dogovoren'); expect(texts()).not.toContain('Dogovorite');
  });

  it('greys every row while the page cannot take a command', async () => {
    await draw(props({ enabled: false }, { ...everything, togglePhone: noop }));
    const disabled = tree.root.findAll(node => String(node.type) === 'Press' && node.props.disabled === true).map(node => node.props.accessibilityLabel);
    expect(disabled).toEqual(expect.arrayContaining([...ACTIONS, 'Podeli svoj broj']));
  });

  it('draws the form that reports a problem in the place of its row, in a view that reports where it stands', async () => {
    const layout = jest.fn();
    await draw(props({ problem: { form: <T2>forma</T2> } }, { openChange: noop, openCancel: noop, openSafety: noop, problemLayout: layout }));
    const holder = tree.root.findAll(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function' && node.props.onLayout === layout)[0];
    expect(holder).toBeDefined(); expect(holder.findAll(node => String(node.type) === 'T').map(node => node.children.join(''))).toContain('forma');
    // Its row is not drawn (the route gives none while the form is open); the calm action stands above the form and the red ones below it.
    expect(labels()).not.toContain('Prijavi problem');
    const sequence = order();
    expect(sequence.indexOf('press:Izmeni uslove')).toBeLessThan(sequence.indexOf('word:forma'));
    expect(sequence.indexOf('word:forma')).toBeLessThan(sequence.indexOf('press:Otkaži Dogovor'));
  });
});

describe('the actions are on the page (J15) and say themselves by their title alone', () => {
  it('draws the two that end something or report someone in red, apart from the calm ones and last', async () => {
    await draw(props({}, everything));
    const red = tree.root.findAll(node => String(node.type) === 'T' && node.props.tone === 'danger').map(node => node.children.join(''));
    expect(red).toEqual(['Otkaži Dogovor', 'Prijavi ili blokiraj osobu']);
    const sequence = order();
    expect(sequence.indexOf('press:Prijavi problem')).toBeLessThan(sequence.indexOf('press:Otkaži Dogovor'));
    // Last on the page: nothing but them after "Prijavi ili blokiraj osobu".
    expect(sequence.slice(sequence.indexOf('press:Prijavi ili blokiraj osobu') + 1)).toEqual(['word:Prijavi ili blokiraj osobu']);
  });

  it('has no line under an action that explains it: what each does is in its spoken hint, not in a grey sentence', async () => {
    await draw(props({}, everything));
    for (const sentence of ['Cena, obim, termin ili otkazivanje uz razlog', 'Zaustavlja automatski završetak, a druga strana vidi prijavu', 'Blokiranje i poverljiva prijava podršci',
      'Uz razlog.', 'Otvara']) expect(texts()).not.toContain(sentence);
    const hints = tree.root.findAll(node => String(node.type) === 'Press' && ACTIONS.includes(node.props.accessibilityLabel)).map(node => typeof node.props.accessibilityHint);
    expect(hints).toEqual(['string', 'string', 'string', 'string']);
  });

  it('keeps the arrow of a way onward on the red rows, since each opens a flow of its own', async () => {
    await draw(props({}, everything));
    // A row that is touched draws a caret; the red rows have to ask for it (`arrow`), and do.
    const press = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0];
    for (const label of ['Otkaži Dogovor', 'Prijavi ili blokiraj osobu']) {
      expect(press(label).findAll(node => String(node.type) === 'CaretRight').length).toBeGreaterThan(0);
    }
  });

  it('leaves "Otkaži Dogovor" to the ways on after a problem while they stand: one place for one action (J1)', async () => {
    await draw(props({ problem: { note: <T2>Problem je prijavljen</T2>, exits: <T2>Šta dalje</T2> } }, everything));
    expect(labels()).not.toContain('Otkaži Dogovor');
    expect(labels()).toEqual(expect.arrayContaining(['Izmeni uslove', 'Prijavi ili blokiraj osobu']));
  });
});

/**
 * The explanations stand behind an "ⓘ" (the coordinator, 8 Oct 2026): the page says one sentence or nothing, and what else a person may want
 * to know - how a Dogovor goes, what sharing a number means, what a reported problem changes - is one tap away, next to what it explains.
 */
describe('the explanations stand behind an "ⓘ"', () => {
  const infos = () => tree.root.findAllByType(InfoButton);
  const titles = () => infos().map(node => node.props.title);

  it('puts how a Dogovor goes at the end of the state\'s own line, once, and the one sentence of the page does not repeat it', async () => {
    await draw(props({ info: agreementStepsInfo({ worker: true }) }));
    expect(titles()).toContain('Kako ide Dogovor');
    const info = infos().find(node => node.props.title === 'Kako ide Dogovor')!;
    expect(info.props.lines).toEqual(agreementStepsInfo({ worker: true }).lines);
    expect(labels()).toContain('Objašnjenje: Kako ide Dogovor');
    const sequence = order();
    expect(sequence.indexOf('word:Dogovoreno')).toBeLessThan(sequence.indexOf('press:Objašnjenje: Kako ide Dogovor'));
    // None of its lines is also a line of the page.
    for (const line of info.props.lines as string[]) expect(texts()).not.toContain(line);
  });

  it('is not drawn when the route gives none: a finished or cancelled Dogovor, or one read for someone who is not a side of it', async () => {
    await draw(props({}, { openTask: noop }));
    expect(titles()).not.toContain('Kako ide Dogovor');
  });

  it('puts how sharing the number works at the end of the title of the contact, where the number can be shared or taken back, and nowhere else', async () => {
    await draw(props());
    expect(titles()).toContain('Kako se deli broj');
    expect(headers()).toContain('Kontakt i mesto');
    expect(infos().find(node => node.props.title === 'Kako se deli broj')!.props.lines).toEqual(['Deljenje je odvojeno u oba smera.', 'Kad podeliš svoj broj, druga strana ne deli automatski svoj.']);
    // Said by the ⓘ and not by a line under the row.
    expect(texts()).not.toContain('Deljenje je odvojeno u oba smera.');
    await act(async () => tree.unmount());
    await draw(props({ accountHasNumber: false }));
    expect(titles()).not.toContain('Kako se deli broj'); expect(headers()).toContain('Kontakt i mesto');
    await act(async () => tree.unmount());
    await draw(props({ agreement: agreement({ stanje: 'COMPLETED' }) }));
    expect(titles()).not.toContain('Kako se deli broj');
  });

  it('puts what a reported problem changes behind the ⓘ of its note while the Dogovor is open, and none on a Dogovor that is over', async () => {
    await act(async () => { tree = create(<AgreementProblemNote mine={false} openedAt="2026-09-25T16:40:00Z" narrative="Deo teksta nije bio u dogovorenom obimu." active />); });
    expect(titles()).toEqual(['Šta znači prijavljen problem']);
    expect(infos()[0].props.lines).toEqual(['Automatski završetak je zaustavljen.', 'Završetak se i dalje može potvrditi.', 'Opis je sačuvan u Porukama.']);
    // The note itself keeps its one sentence: who reads the words, and that a problem decides nobody's guilt or debt.
    expect(texts()).toContain('Opis vide oba učesnika, a problem sam po sebi ne određuje krivicu ili dug.');
    expect(texts()).not.toContain('Automatski završetak je zaustavljen.');
    await act(async () => tree.unmount());
    await act(async () => { tree = create(<AgreementProblemNote mine openedAt="2026-09-25T16:40:00Z" narrative="Nije stigao." />); });
    expect(titles()).toEqual([]);
  });
});

describe('the history of the Dogovor is a row of the same list, opened in place', () => {
  const events = [{ vremeTekst: 'juče', tekst: 'Dogovor je potvrđen' }, { vremeTekst: 'danas', tekst: 'Termin je dogovoren' }];

  it('says nothing about itself until it is asked, and then lists its events under the row in the words they were saved in', async () => {
    await draw(props({ agreement: agreement({ hronologija: events }) }, { openTask: noop }));
    expect(labels()).toContain('Tok Dogovora');
    expect(texts()).not.toContain('Dogovor je potvrđen');
    const row = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Tok Dogovora')[0];
    expect(row().props.accessibilityState).toEqual({ disabled: false, expanded: false });
    await act(async () => row().props.onPress());
    expect(row().props.accessibilityState).toEqual({ disabled: false, expanded: true });
    expect(texts()).toContain('Dogovor je potvrđen'); expect(texts()).toContain('juče'); expect(texts()).toContain('Termin je dogovoren');
    // No line of explanation: the row is its title, and its events are the fact.
    expect(texts()).not.toContain('Događaji u Dogovoru');
  });

  it('is not drawn for a Dogovor that has no events', async () => {
    await draw(props({}, { openTask: noop }));
    expect(labels()).not.toContain('Tok Dogovora');
  });
});

/** A word on the screen, for the slots that take any node. */
function T2({ children }: { children: string }) { return React.createElement('T', null, children); }
