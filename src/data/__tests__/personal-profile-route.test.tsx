import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The display-name route (/profil/podaci): one field and one action (2026-09-24). The route had no test at all. These pin
 * what the recomposition must keep: a grey save says why, one save sends one command with the loaded revision, the same
 * name retried after an unknown outcome reuses its request id (an edit issues a new one), and an unknown outcome turns
 * the one action into a read of the saved name.
 *
 * T4a (2026-10-07): the route is "Lični podaci" (it was "Izmeni profil" until the approved draft of the product, 8 Oct 2026, P2) and offers more than the
 * name, each part only from what the app already holds and saves: the photo (the existing photo screen), "O meni" and the city (the work profile's,
 * shown as written and opened where they change) and what is public and private. The name stays the only thing saved here, and its "Sačuvaj" stands in
 * the bar once the name has changed (the draft's "Sačuvaj u zaglavlju tek kad se nešto promeni"); the form on its own (the isolated scenes) draws it under the field.
 *
 * ONE NAME (owner, 8 Oct 2026, "Može, dobro vam jedno ime za sve."): a save writes the name twice, in order: the account's (revision-bound) and, once that is
 * confirmed and if the account has a work profile, the same name into the work profile, read back. A second write that does not take is said, never silent,
 * with a retry that repeats only that write.
 */
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const REVISION = 'a'.repeat(64);
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
let mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
let mockIds: string[] = [];
const mockRead = jest.fn(), mockSave = jest.fn(), mockWork = jest.fn(), mockWorkWrite = jest.fn();
const mockRouter = { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn(), navigate: jest.fn() };
jest.mock('../requesterProfileClientService', () => ({ requesterProfileClientService: {
  read: (...a: unknown[]) => mockRead(...a), save: (...a: unknown[]) => mockSave(...a) } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
// The work profile is read through the data source, exactly as the work profile screen reads it.
const mockIzvor = { mojRadnikProfil: (...a: unknown[]) => mockWork(...a), azurirajRadnikProfil: (...a: unknown[]) => mockWorkWrite(...a) };
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
/** The bar's "Sačuvaj" (a pill with a check, its label "Sačuvaj ime"): there only while the name differs from the saved one. */
const barSave = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Sačuvaj ime')[0];
const press = async (label: string) => { await act(async () => { await (label === 'Sačuvaj ime' ? barSave() : button(label)).props.onPress(); }); };
async function render() { await act(async () => { tree = create(<Route />); }); }
beforeEach(() => {
  jest.clearAllMocks(); mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
  mockIds = ['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
  mockRead.mockReset().mockResolvedValue(ok(identity())); mockSave.mockReset(); mockWork.mockReset().mockResolvedValue(work()); mockWorkWrite.mockReset().mockResolvedValue(ok(null));
});
// The work profile as the server keeps it: a write of the name changes what the next read says (the readback).
function workProfileKeepsWhatIsWritten(initial = 'Ana') {
  let name = initial;
  mockWork.mockImplementation(async () => work({ ime: name }));
  mockWorkWrite.mockImplementation(async (command: { ime?: string }) => { if (command.ime !== undefined) name = command.ime; return ok(null); });
}
afterEach(async () => { await act(async () => tree?.unmount()); });

it('there is no save for the name that is already saved; an emptied name has a grey one in the bar that says why', async () => {
  await render();
  expect(field().props.value).toBe('Ana Petrović');
  // J14: a button that cannot do anything is not drawn, and the paragraph on who sees the name is gone (it is one sentence for the whole screen).
  expect(barSave()).toBeUndefined(); expect(button('Sačuvaj ime')).toBeUndefined();
  expect(texts()).not.toContain('Ovo ime je već sačuvano.'); expect(texts()).not.toContain('Ovo ime vide ljudi sa kojima dogovaraš pomoć za svoje zadatke.');
  await type('  ');
  // The bar's pill is grey (it cannot be pressed) and the line under the field says why; the form draws no action of its own.
  expect(barSave().props.disabled).toBe(true); expect(texts()).toContain('Ime ne može da ostane prazno.'); expect(button('Sačuvaj ime')).toBeUndefined();
  await type('Ana Petrović');
  expect(barSave()).toBeUndefined(); expect(texts()).not.toContain('Ime ne može da ostane prazno.');
});

it('draws "Sačuvaj" in the bar only once the name has changed, enabled, and writes nothing until it is pressed', async () => {
  await render();
  expect(texts()).not.toContain('Sačuvaj');
  await type('Ana P.');
  expect(barSave().props).toMatchObject({ accessibilityRole: 'button', disabled: false });
  expect(texts()).toContain('Sačuvaj'); expect(mockSave).not.toHaveBeenCalled();
  // The bar and the field are one screen: there is exactly one "Sačuvaj ime" and it is not under the field.
  expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Sačuvaj ime' && String(node.type) === 'Press')).toHaveLength(1);
  expect(tree.root.findAll(node => String(node.type) === 'Button')).toHaveLength(0);
});

it('one save sends the trimmed name with its request id and the loaded revision, and says so only after it is saved', async () => {
  mockSave.mockResolvedValue(ok({ saved: true, idempotentReplay: false, clientRequestId: 'x', identity: identity('Ana P.', 'b'.repeat(64)) }));
  workProfileKeepsWhatIsWritten();
  await render(); await type('  Ana P.  '); await press('Sačuvaj ime');
  expect(mockSave.mock.calls).toEqual([[{ displayName: 'Ana P.', clientRequestId: '33333333-3333-4333-8333-333333333333', expectedRevision: REVISION }]]);
  expect(texts()).toContain('Ime je sačuvano.');
  // Right after the save the button is gone: it is drawn only while the name differs from the saved one.
  expect(field().props.value).toBe('Ana P.'); expect(barSave()).toBeUndefined();
});

it('an unknown outcome turns the one action into a read, and the same name retried reuses its request id', async () => {
  mockSave.mockResolvedValueOnce({ ok: false, kod: 'REQUESTER_PROFILE_UNCONFIRMED', poruka: 'Čuvanje nije potvrđeno.' });
  await render(); await type('Ana P.'); await press('Sačuvaj ime');
  expect(barSave()).toBeUndefined(); expect(texts()).toContain('Čuvanje nije potvrđeno.');
  expect(field().props.editable).toBe(false);
  await press('Proveri sačuvane podatke');
  expect(mockRead).toHaveBeenCalledTimes(2);
  mockSave.mockResolvedValueOnce(ok({ saved: true, idempotentReplay: true, clientRequestId: 'x', identity: identity('Ana P.', 'b'.repeat(64)) }));
  workProfileKeepsWhatIsWritten();
  await press('Sačuvaj ime');
  expect(mockSave.mock.calls.map(call => call[0].clientRequestId)).toEqual(['33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333']);
});

it('an edit after an unconfirmed attempt issues a new request id', async () => {
  mockSave.mockResolvedValueOnce({ ok: false, kod: 'REQUESTER_PROFILE_UNCONFIRMED', poruka: 'Čuvanje nije potvrđeno.' });
  await render(); await type('Ana P.'); await press('Sačuvaj ime'); await press('Proveri sačuvane podatke');
  mockSave.mockResolvedValueOnce(ok({ saved: true, idempotentReplay: false, clientRequestId: 'x', identity: identity('Ana Petrović Jović', 'b'.repeat(64)) }));
  workProfileKeepsWhatIsWritten();
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
// T4a (2026-10-07): "Lični podaci" is more than the name.
// ---------------------------------------------------------------------------------------------------------------------
const rowPress = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0];
const detailOf = (label: string) => rowPress(label).props.accessibilityHint as string;
describe('Lični podaci is more than the name', () => {
  it('offers the photo, the name, "O meni", the city and what is public, in that order, with the one green action of the name in the bar', async () => {
    await render();
    const all = texts();
    expect(all).toContain('Lični podaci'); expect(all).not.toContain('Izmeni profil');
    const order = ['Promeni fotografiju', 'Ime za prikaz', 'O meni', 'Područje rada', 'Ime, fotografija, grad'].map(word => all.indexOf(word));
    expect(order.every(at => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The name is the only thing written here: one field, and its action is drawn (in the bar) only once the name has changed, and that action is the name's.
    expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(1);
    expect(barSave()).toBeUndefined();
    await type('Ana P.');
    expect(barSave()).toBeDefined();
    expect(tree.root.findAll(node => String(node.type) === 'Button').map(node => node.props.label)).toEqual([]);
  });

  it('opens the photo screen that already exists, for this profile, once, and draws the photo the way the profile does', async () => {
    await render();
    const photo = tree.root.findByType('ProfilePhoto' as never);
    // It is the person's own face, so the app remembers it in memory (ownPhotoCache) and draws it at once on the next visit.
    expect(photo.props).toMatchObject({ profileId: PROFILE_ID, size: 96, own: true });
    // No photo yet, or one that cannot be read: the profile's own stand-in, the initials of the name.
    expect(photo.props.fallback.type).toBe(Avatar);
    expect(photo.props.fallback.props).toMatchObject({ initials: 'AP', size: 96 });
    const open = rowPress('Promeni fotografiju');
    expect(open.props.accessibilityHint).toBe('Otvara izbor fotografije profila.');
    await act(async () => { open.props.onPress(); open.props.onPress(); });
    expect(mockRouter.push.mock.calls).toEqual([[{ pathname: '/profil/fotografija', params: { profileId: PROFILE_ID } }]]);
  });

  // Normal "O meni" edits belong to the existing AI profile conversation (10 Oct 2026).
  // This tap only navigates; no prompt is sent, no name or worker profile is written.
  it('shows the saved "O meni" and opens AI conversation exactly once for a double tap', async () => {
    await render();
    expect(detailOf('O meni')).toBe('Radim sa bratom, imamo kombi.'); expect(texts()).toContain('Radim sa bratom, imamo kombi.');
    await act(async () => { rowPress('O meni').props.onPress(); rowPress('O meni').props.onPress(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/razgovor']]);
    expect(mockSave).not.toHaveBeenCalled(); expect(mockWorkWrite).not.toHaveBeenCalled();
  });

  it('opens the AI conversation again after a fresh visit, with no legacy editor nonce', async () => {
    await render();
    await act(async () => { rowPress('O meni').props.onPress(); });
    await act(async () => tree.unmount()); await render();
    await act(async () => { rowPress('O meni').props.onPress(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/razgovor'], ['/profil/razgovor']]);
  });

  it('shows the city of the work area as the answer of its row, with no sentence under it, and opens that screen', async () => {
    await render();
    expect(detailOf('Područje rada')).toBe('Novi Sad'); expect(texts()).not.toContain('Grad se menja u području rada.');
    await act(async () => rowPress('Područje rada').props.onPress());
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/lokacija']]);
  });

  it('says what is public in ONE sentence, and what is private behind the "ⓘ" at its end, in the words the privacy screen uses', async () => {
    await render();
    expect(texts()).toContain('Ime, fotografija, grad, „O meni“ i ocene vide drugi.');
    expect(texts()).not.toContain('Tačna privatna lokacija i kontakt dele se samo kada pravila saradnje daju pristup.');
    const info = tree.root.findAllByProps({ testID: 'profile-visibility-info' }).find(node => Array.isArray(node.props.lines))!;
    expect(info.props.title).toBe('Javno i privatno');
    expect(info.props.lines).toEqual(['Ime, fotografija, grad, „O meni“ i ocene vide drugi.',
      'Tačna privatna lokacija i kontakt dele se samo kada pravila saradnje daju pristup.']);
    // Nothing on this screen promises anonymity or speaks as the law, and there is no row of its own to the privacy screen (the profile has it).
    expect(texts()).not.toMatch(/anonim|zakon|GDPR|saglasnost/i);
    expect(rowPress('Privatnost i podaci')).toBeUndefined();
  });

  it('one way onward at a time: a second row pressed while the first is opening opens nothing', async () => {
    await render();
    await act(async () => { rowPress('Područje rada').props.onPress(); rowPress('O meni').props.onPress(); rowPress('Promeni fotografiju').props.onPress(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/lokacija']]); expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('writes nothing but the name: no row, no photo and no link ever reaches the save', async () => {
    await render();
    await act(async () => { rowPress('O meni').props.onPress(); });
    expect(mockSave).not.toHaveBeenCalled(); expect(mockWorkWrite).not.toHaveBeenCalled();
  });

  it('clips a long "O meni" and keeps the full saved text on the work profile that the AI edits', async () => {
    const long = `Radim sa bratom.\n\nImamo kombi i trake. ${'Dolazimo tačno. '.repeat(30)}`;
    mockWork.mockResolvedValue(work({ biografija: long }));
    await render();
    const detail = detailOf('O meni');
    expect(detail.startsWith('Radim sa bratom. Imamo kombi i trake. Dolazimo tačno.')).toBe(true);
    expect(detail.endsWith('…')).toBe(true); expect(Array.from(detail).length).toBeLessThanOrEqual(141);
    expect(detail).not.toMatch(/\n/);
  });

  it.each([
    ['no work profile', null, 'Dodaj opis', 'Još nije podešeno'],
    ['an empty description', work({ biografija: '   ', grad: '' }), 'Dodaj opis', 'Još nije podešeno'],
  ])('says honestly what there is when there is %s, and invents nothing', async (_name, profile, about, city) => {
    mockWork.mockResolvedValue(profile);
    await render();
    expect(detailOf('O meni')).toBe(about); expect(detailOf('Područje rada')).toBe(city);
  });

  it('says that the description and the city are not available when the work profile cannot be read, and the name still works', async () => {
    mockWork.mockRejectedValue(new Error('WORKER_PROFILE_READ_FAILED'));
    await render();
    expect(detailOf('O meni')).toBe('Opis trenutno nije dostupan');
    expect(detailOf('Područje rada')).toBe('Trenutno nedostupno');
    expect(field().props.value).toBe('Ana Petrović'); expect(barSave()).toBeUndefined();
    await type('Ana P.'); expect(barSave()).toBeDefined();
  });

  it('says "Učitavamo…" while the work profile is read, not an empty description', async () => {
    mockWork.mockReturnValue(new Promise(() => undefined));
    await render();
    expect(detailOf('O meni')).toBe('Učitavamo…'); expect(detailOf('Područje rada')).toBe('Učitavamo…');
  });

  it('the photo waits while the name is being saved', async () => {
    let finish!: (value: unknown) => void;
    mockSave.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await render(); await type('Ana P.');
    await act(async () => { void barSave().props.onPress(); });
    expect(rowPress('Promeni fotografiju').props.disabled).toBe(true);
    await act(async () => finish({ ok: true, podatak: { saved: true, idempotentReplay: false, clientRequestId: 'x', identity: identity('Ana P.', 'b'.repeat(64)) } }));
    expect(rowPress('Promeni fotografiju').props.disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// ONE NAME (owner, 8 Oct 2026): the second write, the same name into the work profile.
// ---------------------------------------------------------------------------------------------------------------------
describe('one name: the account\'s name and then the work profile\'s', () => {
  const saved = (name: string) => ok({ saved: true, idempotentReplay: false, clientRequestId: 'x', identity: identity(name, 'b'.repeat(64)) });
  const NOTICE = 'Ime je sačuvano na nalogu, ali nije upisano u radni profil.';
  const notice = () => tree.root.findAllByProps({ testID: 'work-name-notice' }).length;

  it('writes the same name into the work profile after the account\'s is confirmed, reads it back, and says nothing more', async () => {
    mockSave.mockResolvedValue(saved('Ana P.')); workProfileKeepsWhatIsWritten();
    await render(); await type('Ana P.'); await press('Sačuvaj ime');
    expect(mockSave).toHaveBeenCalledTimes(1);
    // Only the name, and it activates nothing: `zavrsi` is false and no other part is sent.
    expect(mockWorkWrite.mock.calls).toEqual([[{ zavrsi: false, ime: 'Ana P.' }]]);
    expect(mockSave.mock.invocationCallOrder[0]).toBeLessThan(mockWorkWrite.mock.invocationCallOrder[0]);
    expect(notice()).toBe(0); expect(texts()).toContain('Ime je sačuvano.'); expect(texts()).not.toContain(NOTICE);
  });

  it('an account without a work profile writes nothing more', async () => {
    mockSave.mockResolvedValue(saved('Ana P.')); mockWork.mockResolvedValue(null);
    await render(); await type('Ana P.'); await press('Sačuvaj ime');
    expect(mockSave).toHaveBeenCalledTimes(1); expect(mockWorkWrite).not.toHaveBeenCalled(); expect(notice()).toBe(0);
  });

  it('a work profile that already carries the name is not written again', async () => {
    mockSave.mockResolvedValue(saved('Ana P.')); mockWork.mockResolvedValue(work({ ime: 'Ana P.' }));
    await render(); await type('Ana P.'); await press('Sačuvaj ime');
    expect(mockWorkWrite).not.toHaveBeenCalled(); expect(notice()).toBe(0);
  });

  it('no second write when the account\'s save is not confirmed', async () => {
    mockSave.mockResolvedValue({ ok: false, kod: 'REQUESTER_PROFILE_UNCONFIRMED', poruka: 'Čuvanje nije potvrđeno.' });
    await render(); await type('Ana P.'); await press('Sačuvaj ime');
    expect(mockWorkWrite).not.toHaveBeenCalled(); expect(notice()).toBe(0); expect(texts()).toContain('Čuvanje nije potvrđeno.');
  });

  it.each([
    ['the write is refused', () => mockWorkWrite.mockResolvedValue({ ok: false, kod: 'PROFILE_UPDATE_FAILED', poruka: 'x' })],
    ['the write throws', () => mockWorkWrite.mockRejectedValue(new Error('offline'))],
    ['the readback does not show the name', () => { /* the default read keeps saying "Ana" */ }],
    ['the work profile cannot be read', () => mockWork.mockRejectedValueOnce(new Error('WORKER_PROFILE_READ_FAILED')).mockRejectedValue(new Error('offline'))],
  ])('when %s the name stays saved on the account and the screen SAYS the work profile did not take it, with a retry', async (_name, arrange) => {
    mockSave.mockResolvedValue(saved('Ana P.')); arrange();
    await render(); await type('Ana P.');
    // The read that draws "O meni" and the city is the first one; only the second write's reads fail in the last case.
    await press('Sačuvaj ime');
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(texts()).toContain('Ime je sačuvano.'); expect(texts()).toContain(NOTICE); expect(notice()).toBe(1);
    expect(button('Pokušaj ponovo')).toBeDefined(); expect(barSave()).toBeUndefined();
  });

  it('"Pokušaj ponovo" repeats ONLY the second write, never the account\'s save, and the notice goes when it takes', async () => {
    mockSave.mockResolvedValue(saved('Ana P.'));
    mockWorkWrite.mockResolvedValueOnce({ ok: false, kod: 'PROFILE_UPDATE_FAILED', poruka: 'x' });
    await render(); await type('Ana P.'); await press('Sačuvaj ime');
    expect(notice()).toBe(1); expect(mockWorkWrite).toHaveBeenCalledTimes(1);
    workProfileKeepsWhatIsWritten();
    await press('Pokušaj ponovo');
    expect(mockSave).toHaveBeenCalledTimes(1); expect(mockRead).toHaveBeenCalledTimes(1);
    expect(mockWorkWrite).toHaveBeenCalledTimes(2); expect(mockWorkWrite).toHaveBeenLastCalledWith({ zavrsi: false, ime: 'Ana P.' });
    expect(notice()).toBe(0); expect(texts()).not.toContain(NOTICE);
  });

  it('a retry that fails again keeps the notice, and a second press while it runs starts nothing', async () => {
    mockSave.mockResolvedValue(saved('Ana P.'));
    mockWorkWrite.mockResolvedValue({ ok: false, kod: 'PROFILE_UPDATE_FAILED', poruka: 'x' });
    await render(); await type('Ana P.'); await press('Sačuvaj ime');
    let finish!: (value: unknown) => void; mockWorkWrite.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await act(async () => { button('Pokušaj ponovo').props.onPress(); button('Pokušaj ponovo').props.onPress(); });
    expect(mockWorkWrite).toHaveBeenCalledTimes(2); expect(button('Pokušaj ponovo').props.loading).toBe(true);
    await act(async () => finish({ ok: false, kod: 'PROFILE_UPDATE_FAILED', poruka: 'x' }));
    expect(notice()).toBe(1); expect(button('Pokušaj ponovo').props.loading).toBe(false);
  });

  it('a new save clears the old notice before it tries again', async () => {
    mockSave.mockResolvedValue(saved('Ana P.'));
    mockWorkWrite.mockResolvedValueOnce({ ok: false, kod: 'PROFILE_UPDATE_FAILED', poruka: 'x' });
    await render(); await type('Ana P.'); await press('Sačuvaj ime');
    expect(notice()).toBe(1);
    mockSave.mockResolvedValue(saved('Ana Petrović Jović')); workProfileKeepsWhatIsWritten('Ana');
    await type('Ana Petrović Jović'); await press('Sačuvaj ime');
    expect(notice()).toBe(0); expect(mockWorkWrite).toHaveBeenLastCalledWith({ zavrsi: false, ime: 'Ana Petrović Jović' });
  });
});
