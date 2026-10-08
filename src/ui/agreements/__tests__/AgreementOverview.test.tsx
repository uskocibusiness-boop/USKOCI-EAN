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

import { AgreementOverview, type AgreementOverviewProps } from '../AgreementOverview';
import { agreementNextStep } from '../AgreementWorkspace';

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

describe('the order of the overview', () => {
  it('is the work\'s name, where the Dogovor stands, its terms, and the contact - parted by space, with no title of its own for the rows that lead elsewhere', async () => {
    await draw(props({}, { openTask: noop, openChange: noop, openProblem: noop, openSafety: noop }));
    expect(headers()).toEqual(['Prenos ormana do kombija', 'Dogovoreno', 'Uslovi', 'Kontakt i mesto']);
    // The links come last, in the order of the route's own rows.
    expect(labels().filter(label => /^(Otvori zadatak|Izmene i otkazivanje|Prijavi problem|Bezbednost)/.test(label)))
      .toEqual(['Otvori zadatak: Prenos ormana do kombija. Liman, Novi Sad', 'Izmene i otkazivanje Dogovora', 'Prijavi problem', 'Bezbednost i privatna prijava']);
  });

  it('puts the note for a missing term and a reported problem under the head, before the terms', async () => {
    await draw(props({ problem: { note: <T2>Problem je prijavljen</T2>, exits: <T2>Šta dalje</T2> } }, { proposeTerm: noop }));
    const order = tree.root.findAll(node => String(node.type) === 'T').map(node => node.children.join(''));
    const at = (word: string) => order.indexOf(word);
    expect(at('Dogovoreno')).toBeLessThan(at('Termin još nije dogovoren'));
    expect(at('Termin još nije dogovoren')).toBeLessThan(at('Problem je prijavljen'));
    expect(at('Šta dalje')).toBeLessThan(at('Uslovi'));
  });
});

describe('a row is drawn only for a command the route gave it', () => {
  it('draws none of the links without commands, and a group Dogovor lists its people', async () => {
    await draw(props({ agreement: agreement({ pokrivenost: { ukupno: 3, popunjeno: 2, preostalo: 1, udeo: 2 / 3 } }) }));
    expect(labels().some(label => /^(Otvori zadatak|Izmene|Prijavi problem|Bezbednost|Tvoja prijava)/.test(label))).toBe(false);
    expect(headers()).toContain('Ko je u Dogovoru');
  });

  it('puts "Izmeni" at the end of the title of the terms only with a command to change them, and the note for a missing term only with one to propose', async () => {
    await draw(props({}, { changeTerms: noop }));
    expect(labels()).toContain('Izmeni uslove'); expect(texts()).not.toContain('Predloži termin');
    await act(async () => tree.unmount());
    await draw(props({}, { proposeTerm: noop }));
    expect(labels()).toContain('Predloži termin'); expect(labels()).not.toContain('Izmeni uslove');
  });

  it('greys every row while the page cannot take a command', async () => {
    await draw(props({ enabled: false }, { openTask: noop, openChange: noop, openSafety: noop, togglePhone: noop }));
    const disabled = tree.root.findAll(node => String(node.type) === 'Press' && node.props.disabled === true).map(node => node.props.accessibilityLabel);
    expect(disabled).toEqual(expect.arrayContaining(['Izmene i otkazivanje Dogovora', 'Bezbednost i privatna prijava', 'Podeli svoj broj']));
  });

  it('draws the form that reports a problem last, in a view that reports where it stands', async () => {
    const layout = jest.fn();
    await draw(props({ problem: { form: <T2>forma</T2> } }, { problemLayout: layout }));
    const holder = tree.root.findAll(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function' && node.props.onLayout === layout)[0];
    expect(holder).toBeDefined(); expect(holder.findAll(node => String(node.type) === 'T').map(node => node.children.join(''))).toContain('forma');
  });
});

/** A word on the screen, for the slots that take any node. */
function T2({ children }: { children: string }) { return React.createElement('T', null, children); }
