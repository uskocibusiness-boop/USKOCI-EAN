import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The display-name route (/profil/podaci): one field and one action (2026-09-24). The route had no test at all. These pin
 * what the recomposition must keep: a grey save says why, one save sends one command with the loaded revision, the same
 * name retried after an unknown outcome reuses its request id (an edit issues a new one), and an unknown outcome turns
 * the one action into a read of the saved name.
 *
 * T4a (2026-10-07): the route is "Izmeni profil" and offers more than the name, each part only from what the app already holds and
 * saves: the photo (the existing photo screen), "O meni" and the city (the work profile's, shown as written and opened where they
 * change) and what is public and private. The name stays the only thing saved here.
 */
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const REVISION = 'a'.repeat(64);
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
let mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
let mockIds: string[] = [];
const mockRead = jest.fn(), mockSave = jest.fn(), mockWork = jest.fn();
const mockRouter = { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn(), navigate: jest.fn() };
jest.mock('../requesterProfileClientService', () => ({ requesterProfileClientService: {
  read: (...a: unknown[]) => mockRead(...a), save: (...a: unknown[]) => mockSave(...a) } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
// The work profile is read through the data source, exactly as the work profile screen reads it.
const mockIzvor = { mojRadnikProfil: (...a: unknown[]) => mockWork(...a) };
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockIzvor }));
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => mockIds.shift() ?? 'no-more-ids' }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]) }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Button' }));

import Route from '../../app/(app)/profil/podaci';
import { DisplayNameForm } from '../../ui/profile/DisplayNameForm';
import { Avatar } from '../../ui/system/Avatar';

const identity = (displayName = 'Ana Petrović', revision = REVISION) => ({ schema: 'REQUESTER_IDENTITY_V1', accountId: ACCOUNT,
  profileId: PROFILE_ID, displayName, revision, writableFields: ['displayName'] });
const work = (patch: Record<string, unknown> = {}) => ({ id: 'w', ime: 'Ana', grad: 'Novi Sad', biografija: 'Radim sa bratom, imamo kombi.', vestine: [], alati: [], vozila: [],
  licence: [], stanje: 'ACTIVE', dostupanOdmah: false, radijusKm: 20, ...patch });
const ok = (podatak: unknown) => ({ ok: true, podatak });
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const button = (label: string) => tree.root.findAll(node => String(node.type) === 'Button' && node.props.label === label)[0];
const field = () => tree.root.findByProps({ accessibilityLabel: 'Ime za prikaz' });
const type = async (value: string) => { await act(async () => field().props.onChangeText(value)); };
const press = async (label: string) => { await act(async () => { await button(label).props.onPress(); }); };
async function render() { await act(async () => { tree = create(<Route />); }); }
beforeEach(() => {
  jest.clearAllMocks(); mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
  mockIds = ['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
  mockRead.mockReset().mockResolvedValue(ok(identity())); mockSave.mockReset(); mockWork.mockReset().mockResolvedValue(work());
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('a grey save says why: an empty name, or the name that is already saved', async () => {
  await render();
  expect(field().props.value).toBe('Ana Petrović');
  expect(button('Sačuvaj ime').props.disabled).toBe(true); expect(button('Sačuvaj ime').props.reason).toBe('Ovo ime je već sačuvano.');
  await type('  ');
  expect(button('Sačuvaj ime').props.disabled).toBe(true); expect(button('Sačuvaj ime').props.reason).toBe('Ime ne može da ostane prazno.');
  expect(texts()).toContain('Ovo ime vide ljudi sa kojima dogovaraš pomoć za svoje zadatke.');
});

it('one save sends the trimmed name with its request id and the loaded revision, and says so only after it is saved', async () => {
  mockSave.mockResolvedValue(ok({ saved: true, idempotentReplay: false, clientRequestId: 'x', identity: identity('Ana P.', 'b'.repeat(64)) }));
  await render(); await type('  Ana P.  '); await press('Sačuvaj ime');
  expect(mockSave.mock.calls).toEqual([[{ displayName: 'Ana P.', clientRequestId: '33333333-3333-4333-8333-333333333333', expectedRevision: REVISION }]]);
  expect(texts()).toContain('Ime je sačuvano.');
  // Right after the save the button does not repeat what the line above says.
  expect(field().props.value).toBe('Ana P.'); expect(button('Sačuvaj ime').props.reason).toBeNull();
});

it('an unknown outcome turns the one action into a read, and the same name retried reuses its request id', async () => {
  mockSave.mockResolvedValueOnce({ ok: false, kod: 'REQUESTER_PROFILE_UNCONFIRMED', poruka: 'Čuvanje nije potvrđeno.' });
  await render(); await type('Ana P.'); await press('Sačuvaj ime');
  expect(button('Sačuvaj ime')).toBeUndefined(); expect(texts()).toContain('Čuvanje nije potvrđeno.');
  expect(field().props.editable).toBe(false);
  await press('Proveri sačuvane podatke');
  expect(mockRead).toHaveBeenCalledTimes(2);
  mockSave.mockResolvedValueOnce(ok({ saved: true, idempotentReplay: true, clientRequestId: 'x', identity: identity('Ana P.', 'b'.repeat(64)) }));
  await press('Sačuvaj ime');
  expect(mockSave.mock.calls.map(call => call[0].clientRequestId)).toEqual(['33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333']);
});

it('an edit after an unconfirmed attempt issues a new request id', async () => {
  mockSave.mockResolvedValueOnce({ ok: false, kod: 'REQUESTER_PROFILE_UNCONFIRMED', poruka: 'Čuvanje nije potvrđeno.' });
  await render(); await type('Ana P.'); await press('Sačuvaj ime'); await press('Proveri sačuvane podatke');
  mockSave.mockResolvedValueOnce(ok({ saved: true, idempotentReplay: false, clientRequestId: 'x', identity: identity('Ana Petrović Jović', 'b'.repeat(64)) }));
  await type('Ana Petrović Jović'); await press('Sačuvaj ime');
  expect(mockSave.mock.calls.map(call => call[0].clientRequestId)).toEqual(['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']);
});

// Review of step 9 (2026-09-24): during a read that keeps the form (every return to the screen) the save was live, and
// the editor refused it without a word.
it('while the saved name is read again the save waits and says why', async () => {
  const save = jest.fn(async () => {});
  await act(async () => { tree = create(<DisplayNameForm savedName="Ana Petrović" busy={false} uncertain={false} saved={false} error={null}
    checking check={() => {}} save={save} />); });
  await type('Ana P.');
  expect(button('Sačuvaj ime').props.disabled).toBe(true); expect(button('Sačuvaj ime').props.reason).toBe('Učitavamo sačuvano ime…');
  expect(button('Sačuvaj ime').props.loading).toBe(false);
  await act(async () => tree.update(<DisplayNameForm savedName="Ana Petrović" busy={false} uncertain={false} saved={false} error={null}
    checking={false} check={() => {}} save={save} />));
  expect(button('Sačuvaj ime').props.disabled).toBe(false); expect(button('Sačuvaj ime').props.reason).toBeNull();
});

it('a first read that fails offers the read again, not an empty form', async () => {
  mockRead.mockResolvedValueOnce({ ok: false, kod: 'REQUESTER_PROFILE_REQUIRED', poruka: 'Profil nije pronađen. Osveži prikaz.' });
  await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Ime za prikaz' })).toHaveLength(0);
  expect(texts()).toContain('Profil nije učitan'); expect(texts()).toContain('Profil nije pronađen. Osveži prikaz.');
  // Nothing of the parts that come with a loaded profile stands in a failed state.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Promeni fotografiju' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ label: 'O meni' })).toHaveLength(0);
  await press('Proveri sačuvane podatke');
  expect(mockRead).toHaveBeenCalledTimes(2); expect(field().props.value).toBe('Ana Petrović');
});

// ---------------------------------------------------------------------------------------------------------------------
// T4a (2026-10-07): "Izmeni profil" is more than the name.
// ---------------------------------------------------------------------------------------------------------------------
const rowPress = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0];
const detailOf = (label: string) => rowPress(label).props.accessibilityHint as string;
describe('Izmeni profil is more than the name', () => {
  it('offers the photo, the name, "O meni", the city and what is public, in that order, with the one green action of the name', async () => {
    await render();
    const all = texts();
    expect(all).toContain('Izmeni profil');
    const order = ['Promeni fotografiju', 'Ime za prikaz', 'O meni', 'Grad', 'Javno i privatno'].map(word => all.indexOf(word));
    expect(order.every(at => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The name is the only thing written here: one field, one button, and that button is the name's.
    expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(1);
    expect(tree.root.findAll(node => String(node.type) === 'Button').map(node => node.props.label)).toEqual(['Sačuvaj ime']);
  });

  it('opens the photo screen that already exists, for this profile, once, and draws the photo the way the profile does', async () => {
    await render();
    const photo = tree.root.findByType('ProfilePhoto' as never);
    expect(photo.props).toMatchObject({ profileId: PROFILE_ID, size: 96 });
    // No photo yet, or one that cannot be read: the profile's own stand-in, the initials of the name.
    expect(photo.props.fallback.type).toBe(Avatar);
    expect(photo.props.fallback.props).toMatchObject({ initials: 'AP', size: 96 });
    const open = rowPress('Promeni fotografiju');
    expect(open.props.accessibilityHint).toBe('Otvara izbor fotografije profila.');
    await act(async () => { open.props.onPress(); open.props.onPress(); });
    expect(mockRouter.push.mock.calls).toEqual([[{ pathname: '/profil/fotografija', params: { profileId: PROFILE_ID } }]]);
  });

  it('shows "O meni" as the work profile has it, and opens the work profile where it is written', async () => {
    await render();
    expect(detailOf('O meni')).toBe('Radim sa bratom, imamo kombi.'); expect(texts()).toContain('Radim sa bratom, imamo kombi.');
    await act(async () => { rowPress('O meni').props.onPress(); rowPress('O meni').props.onPress(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/radnik']]);
  });

  it('shows the city of the work area as information, says where it changes, and opens that screen', async () => {
    await render();
    expect(detailOf('Grad')).toBe('Novi Sad'); expect(texts()).toContain('Grad se menja u području rada.');
    await act(async () => rowPress('Grad').props.onPress());
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/lokacija']]);
  });

  it('says what is public and what is private in the words the privacy screen uses, and leads to all of it', async () => {
    await render();
    expect(texts()).toContain('Ime, fotografija, grad, „O meni“ i ocene vide druge osobe.');
    expect(texts()).toContain('Tačna privatna lokacija i kontakt dele se samo kada pravila saradnje daju pristup.');
    // Nothing on this screen promises anonymity or speaks as the law.
    expect(texts()).not.toMatch(/anonim|zakon|GDPR|saglasnost/i);
    await act(async () => rowPress('Privatnost i podaci').props.onPress());
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/privatnost']]);
  });

  it('one way onward at a time: a second row pressed while the first is opening opens nothing', async () => {
    await render();
    await act(async () => { rowPress('Grad').props.onPress(); rowPress('O meni').props.onPress(); rowPress('Promeni fotografiju').props.onPress(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/lokacija']]); expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('writes nothing but the name: no row, no photo and no link ever reaches the save', async () => {
    await render();
    await act(async () => { rowPress('O meni').props.onPress(); });
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('clips a long "O meni" to a stretch of it and the line breaks to spaces; the whole text is on the work profile it opens', async () => {
    const long = `Radim sa bratom.\n\nImamo kombi i trake. ${'Dolazimo tačno. '.repeat(30)}`;
    mockWork.mockResolvedValue(work({ biografija: long }));
    await render();
    const detail = detailOf('O meni');
    expect(detail.startsWith('Radim sa bratom. Imamo kombi i trake. Dolazimo tačno.')).toBe(true);
    expect(detail.endsWith('…')).toBe(true); expect(Array.from(detail).length).toBeLessThanOrEqual(141);
    expect(detail).not.toMatch(/\n/);
  });

  it.each([
    ['no work profile', null, 'Piše se u radnom profilu.', 'Još nije podešen.'],
    ['an empty description', work({ biografija: '   ', grad: '' }), 'Još nije napisano. Dodaj ga u radnom profilu.', 'Još nije podešen.'],
  ])('says honestly what there is when there is %s, and invents nothing', async (_name, profile, about, city) => {
    mockWork.mockResolvedValue(profile);
    await render();
    expect(detailOf('O meni')).toBe(about); expect(detailOf('Grad')).toBe(city);
  });

  it('says that the description and the city are not available when the work profile cannot be read, and the name still works', async () => {
    mockWork.mockRejectedValue(new Error('WORKER_PROFILE_READ_FAILED'));
    await render();
    expect(detailOf('O meni')).toBe('Opis trenutno nije dostupan. Piše se u radnom profilu.');
    expect(detailOf('Grad')).toBe('Grad trenutno nije dostupan.');
    expect(field().props.value).toBe('Ana Petrović'); expect(button('Sačuvaj ime')).toBeDefined();
  });

  it('says "Učitavamo…" while the work profile is read, not an empty description', async () => {
    mockWork.mockReturnValue(new Promise(() => undefined));
    await render();
    expect(detailOf('O meni')).toBe('Učitavamo…'); expect(detailOf('Grad')).toBe('Učitavamo…');
  });

  it('the photo waits while the name is being saved', async () => {
    let finish!: (value: unknown) => void;
    mockSave.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await render(); await type('Ana P.');
    await act(async () => { void button('Sačuvaj ime').props.onPress(); });
    expect(rowPress('Promeni fotografiju').props.disabled).toBe(true);
    await act(async () => finish({ ok: true, podatak: { saved: true, idempotentReplay: false, clientRequestId: 'x', identity: identity('Ana P.', 'b'.repeat(64)) } }));
    expect(rowPress('Promeni fotografiju').props.disabled).toBe(false);
  });
});
