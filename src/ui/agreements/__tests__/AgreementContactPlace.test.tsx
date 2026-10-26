import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DogovorProjekcija } from '../../../contracts/projections';

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
jest.mock('../../AgreementPrivateLocation', () => ({ AgreementPrivateLocation: 'PrivateLocation' }));

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
  await act(async () => { tree = create(<AgreementContactPlace agreement={item} enabled {...patch} />); });
};
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });
const labels = () => tree.root.findAll(node => String(node.type) === 'Press').map(node => String(node.props.accessibilityLabel));
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');

describe('communication in the Agreement', () => {
  it('opens in-app messages and never exposes a phone number from the projection', async () => {
    const open = jest.fn();
    await draw(agreement({}, { mojTelefonPodeljen: true, njihovTelefon: '+381 64 123-4567' }), { onOpenMessages: open });
    expect(texts()).toContain('Komunikacija i mesto');
    expect(texts()).toContain('Poruke u aplikaciji');
    expect(texts()).not.toContain('+381 64 123-4567');
    expect(labels().join(' ')).not.toMatch(/broj|pozovi/i);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Poruke u aplikaciji' }).props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('keeps phone details hidden while refreshing and after completion', async () => {
    await draw(agreement({}, { njihovTelefon: '064 123 4567' }), { concealed: true });
    expect(texts()).not.toContain('064 123 4567');
    await act(async () => tree.unmount());
    await draw(agreement({ stanje: 'COMPLETED' }, { njihovTelefon: '064 123 4567' }));
    expect(texts()).not.toContain('064 123 4567');
    expect(texts()).toContain('Poruke u aplikaciji');
  });
});

describe('private location remains separate from messages', () => {
  it('renders the private location only for an active physical Agreement', async () => {
    await draw(agreement({}, { lokacijaPostoji: true }));
    expect(tree.root.findAll(node => String(node.type) === 'PrivateLocation')).toHaveLength(1);
  });
  it('does not render a location for remote work', async () => {
    await draw(agreement({ rezim: 'DALJINSKI' }, { lokacijaPostoji: true }));
    expect(texts()).toContain('Komunikacija');
    expect(tree.root.findAll(node => String(node.type) === 'PrivateLocation')).toHaveLength(0);
  });
  it('closes location access when the Agreement ends', async () => {
    await draw(agreement({ stanje: 'CANCELLED' }, { lokacijaPostoji: true }));
    expect(texts()).toContain('Pristup lokaciji je zatvoren kada se Dogovor završi ili otkaže.');
    expect(tree.root.findAll(node => String(node.type) === 'PrivateLocation')).toHaveLength(0);
  });
  it('uses a supplied location slot and preserves the layout callback', async () => {
    const onLayout = jest.fn();
    await draw(agreement({}, { lokacijaPostoji: true }), { locationSlot: <>{React.createElement('T', null, 'mesto iz galerije')}</>, onLayout });
    expect(texts()).toContain('mesto iz galerije');
    expect(tree.root.findAll(node => String(node.type) === 'PrivateLocation')).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'agreement-contact-place' }).props.onLayout).toBe(onLayout);
  });
});
