import React from 'react';
import { Linking } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DogovorProjekcija } from '../../../contracts/projections';

/**
 * "Kontakt i mesto" (composition spec 4.9; ideas R01a and R03): the number of the other side and what can be done with it, the one command
 * that shares or withdraws mine, and the place. Nothing is offered that cannot succeed, and nothing private is drawn while the page is
 * being read again.
 */
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, fontScale: 1, scale: 3 });
    return ['View', 'ScrollView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => true }));
// The place is private and read through its own grant (its suite is `agreement-private-location`); here only that it stands where it should.
jest.mock('../../AgreementPrivateLocation', () => ({ AgreementPrivateLocation: 'PrivateLocation' }));

import { InfoButton } from '../../system/InfoButton';
import { AgreementContactPlace } from '../AgreementContactPlace';

const agreement = (patch: Partial<DogovorProjekcija> = {}, contact: Partial<DogovorProjekcija['kontakt']> = {}): DogovorProjekcija => ({
  id: 'a1', verzija: 1, naslov: 'Pomoć pri selidbi', stanje: 'CONFIRMED', cena: { iznos: 5500, valuta: 'RSD', prikaz: '5.500 RSD' }, vremeTekst: '26. sep · 17:00–19:00',
  putanjaTekst: 'Novi Sad', pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 }, ucesnici: [], rezim: 'FIZICKI',
  kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: false, tacnaLokacija: null, emailNijeDeljen: true, ...contact },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null, izmenaCeka: null,
  izvor: { zadatakId: null, prijavaId: null }, ...patch,
});
let tree: ReactTestRenderer;
type Props = Partial<React.ComponentProps<typeof AgreementContactPlace>>;
const draw = async (item: DogovorProjekcija, patch: Props = {}) => {
  await act(async () => { tree = create(<AgreementContactPlace agreement={item} enabled canShare accountHasNumber onTogglePhone={jest.fn()} {...patch} />); });
};
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });
const labels = () => tree.root.findAll(node => String(node.type) === 'Press').map(node => String(node.props.accessibilityLabel));
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const press = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0];

describe('the number', () => {
  it('says the other side has not shared theirs, and offers mine to an account that has one', async () => {
    await draw(agreement());
    expect(texts()).toContain('Broj druge strane'); expect(texts()).toContain('Još nije podeljen.'); expect(labels()).toContain('Podeli svoj broj');
  });

  it('offers "Opozovi deljenje broja" once mine was shared, and "Kontakt kroz Poruke" to an account with no number', async () => {
    await draw(agreement({}, { mojTelefonPodeljen: true }));
    expect(labels()).toContain('Opozovi deljenje broja'); expect(labels()).not.toContain('Podeli svoj broj');
    await act(async () => tree.unmount());
    const open = jest.fn();
    await draw(agreement(), { accountHasNumber: false, onOpenMessages: open });
    expect(labels()).toContain('Kontakt kroz Poruke'); expect(labels()).not.toContain('Podeli svoj broj');
    await act(async () => press('Kontakt kroz Poruke').props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('calls a number the other side shared - only digits and a leading plus reach the dialler - and still writes a number that cannot be dialled', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await draw(agreement({}, { njihovTelefon: '+381 64 123-4567' }));
    await act(async () => press('Pozovi, +381 64 123-4567').props.onPress());
    expect(open).toHaveBeenCalledWith('tel:+381641234567');
    await act(async () => tree.unmount());
    await draw(agreement({}, { njihovTelefon: '12' }));
    expect(labels()).not.toContain('Pozovi, 12'); expect(texts()).toContain('12');
  });

  it('survives a call that cannot be started: the number stays to be read', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no dialler'));
    await draw(agreement({}, { njihovTelefon: '064 123 4567' }));
    await act(async () => press('Pozovi, 064 123 4567').props.onPress());
    expect(texts()).toContain('064 123 4567');
  });

  it('waits for the fresh read when the page is shown again: no number is drawn, and the command is grey', async () => {
    await draw(agreement({}, { njihovTelefon: '064 123 4567' }), { concealed: true });
    expect(texts()).not.toContain('064 123 4567'); expect(texts()).toContain('Proveravamo broj druge strane…');
  });

  it('offers nothing to someone who is not a side of the Dogovor, and nothing once the Dogovor is over', async () => {
    await draw(agreement(), { canShare: false });
    expect(labels()).not.toContain('Podeli svoj broj');
    await act(async () => tree.unmount());
    await draw(agreement({ stanje: 'COMPLETED' }));
    expect(labels()).not.toContain('Podeli svoj broj');
  });
});

/** The explanation of sharing is behind an "ⓘ" at the end of the title, where the number can be shared or taken back (the coordinator, 8 Oct 2026). */
describe('how sharing the number works', () => {
  const infos = () => tree.root.findAllByType(InfoButton).map(node => node.props.title);

  it('is behind the ⓘ of the title while the number can be shared or taken back, and the rows carry no sentence of it', async () => {
    await draw(agreement());
    expect(infos()).toEqual(['Kako se deli broj']);
    expect(tree.root.findAllByType(InfoButton)[0].props.lines).toEqual(['Deljenje je odvojeno u oba smera.', 'Kad podeliš svoj broj, druga strana ne deli automatski svoj.']);
    expect(texts()).toContain('Kontakt i mesto'); expect(texts()).not.toContain('Deljenje je odvojeno u oba smera.');
    expect(press('Podeli svoj broj').props.accessibilityHint).toBe('Deljenje je odvojeno u oba smera: druga strana ne deli automatski svoj broj.');
    await act(async () => tree.unmount());
    await draw(agreement({}, { mojTelefonPodeljen: true }));
    expect(infos()).toEqual(['Kako se deli broj']); expect(texts()).toContain('Druga strana vidi tvoj broj.');
  });

  it('is not there when there is nothing to share: an account with no number, a finished Dogovor, or someone who is not a side of it', async () => {
    await draw(agreement(), { accountHasNumber: false });
    expect(infos()).toEqual([]); expect(texts()).toContain('Kontakt i mesto'); expect(texts()).toContain('Na tvom nalogu nema broja telefona.');
    await act(async () => tree.unmount());
    await draw(agreement({ stanje: 'COMPLETED' }, { njihovTelefon: '064 123 4567' }));
    expect(infos()).toEqual([]);
    await act(async () => tree.unmount());
    await draw(agreement(), { canShare: false });
    expect(infos()).toEqual([]);
  });
});

describe('the place', () => {
  it('stands under the title of the section for a physical Dogovor, where the private location draws itself', async () => {
    await draw(agreement({}, { lokacijaPostoji: true }));
    expect(texts()).toContain('Kontakt i mesto');
    expect(tree.root.findAll(node => String(node.type) === 'PrivateLocation')).toHaveLength(1);
  });

  it('is a Dogovor by phone: the section is "Kontakt" and has no place', async () => {
    await draw(agreement({ rezim: 'DALJINSKI' }, { lokacijaPostoji: true }));
    expect(texts()).toContain('Kontakt'); expect(texts()).not.toContain('Kontakt i mesto');
    expect(tree.root.findAll(node => String(node.type) === 'PrivateLocation')).toHaveLength(0);
  });

  it('says that access to the place is closed once the Dogovor is over, as a quiet sentence and not as a section with a title of its own', async () => {
    await draw(agreement({ stanje: 'CANCELLED' }, { lokacijaPostoji: true }));
    expect(texts()).toContain('Pristup lokaciji je zatvoren kada se Dogovor završi ili otkaže.');
    expect(texts()).not.toContain('Kontakt i mesto');
    expect(tree.root.findAll(node => String(node.type) === 'PrivateLocation')).toHaveLength(0);
    // A number the other side shared stays on the page of a Dogovor that is over, and then the section keeps its title.
    await act(async () => tree.unmount());
    await draw(agreement({ stanje: 'CANCELLED' }, { lokacijaPostoji: true, njihovTelefon: '064 123 4567' }));
    expect(texts()).toContain('Kontakt i mesto'); expect(texts()).toContain('Pristup lokaciji je zatvoren kada se Dogovor završi ili otkaže.');
  });

  it('draws the slot it was given in place of the private location, and reports where the section stands', async () => {
    const onLayout = jest.fn();
    await draw(agreement({}, { lokacijaPostoji: true }), { locationSlot: <>{React.createElement('T', null, 'mesto iz galerije')}</>, onLayout });
    expect(texts()).toContain('mesto iz galerije');
    expect(tree.root.findAll(node => String(node.type) === 'PrivateLocation')).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'agreement-contact-place' }).props.onLayout).toBe(onLayout);
  });

  it('draws nothing at all when it has nothing to say', async () => {
    await draw(agreement({ stanje: 'COMPLETED' }), { canShare: false });
    expect(tree.toJSON()).toBeNull();
  });
});
