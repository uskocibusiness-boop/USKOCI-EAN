import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerDraft } from '../workerProfileDraft';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'TextInput', 'ScrollView', 'Switch'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'Action' }));

import { SKILL_CHIPS_MAX, WorkerProfileSaved } from '../WorkerProfileSaved';
import { RatingLineView } from '../../profile/RatingLine';
import { FOR_ME_SWITCH_EXISTS, PEOPLE_COUNT_NOTE, SKILLS_IN_CARD, profileEffects, skillsLine, toolsAndVehiclesNote, workerProfileInfoLines } from '../workerProfileFacts';
import { brandAction, sys } from '../../system/tokens';

/**
 * The saved work profile: one account identity, readable services and confirmed mode,
 * area, availability and optional equipment. One main conversation action; section edits stay contextual.
 * It draws no state of its own; the route decides when a profile is read and what the status line says.
 *
 * Owner's phone, 8 Oct 2026: the block of sentences "Na šta utiče" is behind the "ⓘ" in the bar (`workerProfileInfoLines`),
 * and the name is the ACCOUNT's (one name for everything). The MVP reading omits legacy equipment rows.
 */
const draft = (patch: Partial<WorkerDraft> = {}): WorkerDraft => ({ ime: 'Ana Petrović', grad: 'Novi Sad', biografija: 'Radim sa bratom.', vestine: ['Selidbe', 'Nošenje'],
  alati: ['Bušilica'], vozila: ['Kombi'], licence: [], capacity: '', capacityRevision: null, radius: '20', dostupanOdmah: true,
  newSkill: '', newTool: '', newVehicle: '', newLicense: '', ...patch });
let tree: ReactTestRenderer;
const textOf = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => textOf(child as ReactTestInstance | string)).join('');
const all = () => tree.root.findAll(node => String(node.type) === 'T').map(node => textOf(node));
const action = (label: string) => tree.root.findAll(node => String(node.type) === 'Action' && node.props.label === label)[0];
const press = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0];
const toggle = () => tree.root.findAll(node => String(node.type) === 'Switch')[0];
const show = async (patch: Partial<React.ComponentProps<typeof WorkerProfileSaved>> = {}, value: WorkerDraft = draft()) => {
  const spies = { navigate: jest.fn(), openConversation: jest.fn() };
  const props = { draft: value, status: <></>, disabled: false,
    executionModes: { kind: 'confirmed' as const, modes: ['ON_SITE' as const] }, ...spies, ...patch };
  await act(async () => { tree = create(<WorkerProfileSaved {...props} />); });
  return spies;
};
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('what the saved profile shows', () => {
  it('keeps map confirmation separate from the AI area edit and from the primary action', async () => {
    const confirmMap = jest.fn();
    const { openConversation, navigate } = await show({ confirmMap });
    await act(async () => press('Područje dolaska').props.onPress());
    expect(openConversation).toHaveBeenCalledWith('area');
    expect(action('Potvrdi tačku na mapi').props.kind).toBe('quiet');
    await act(async () => action('Potvrdi tačku na mapi').props.onPress());
    expect(confirmMap).toHaveBeenCalledWith(); expect(navigate).not.toHaveBeenCalled();
  });

  it.each(['remote', 'unconfirmed', 'loading', 'unavailable', 'suspended', 'disabled'])(
    '%s cannot request a map confirmation', async state => {
      const confirmMap = jest.fn();
      await show({ confirmMap, readOnly: state === 'suspended', disabled: state === 'disabled',
        executionModes: state === 'remote' ? { kind: 'confirmed', modes: ['REMOTE'] }
          : ['unconfirmed', 'loading', 'unavailable'].includes(state) ? { kind: state as 'unconfirmed' | 'loading' | 'unavailable' }
            : { kind: 'confirmed', modes: ['ON_SITE'] } });
      if (state === 'disabled') {
        expect(action('Potvrdi tačku na mapi').props.disabled).toBe(true);
        await act(async () => action('Potvrdi tačku na mapi').props.onPress());
      } else expect(action('Potvrdi tačku na mapi')).toBeUndefined();
      expect(confirmMap).not.toHaveBeenCalled();
    });

  it('shows confirmed remote work with the profile city, never an inherited on-site radius or location editor', async () => {
    const spies = await show({ executionModes: { kind: 'confirmed', modes: ['REMOTE'] } },
      draft({ vestine: ['3D štampa'], biografija: 'Izrada kod mene uz slanje.' }));
    expect(all()).toContain('Na daljinu'); expect(all()).toContain('Grad profila'); expect(all()).toContain('Novi Sad');
    expect(all().join(' ')).not.toMatch(/20 km|Područje dolaska/);
    expect(press('Područje dolaska')).toBeUndefined(); expect(spies.navigate).not.toHaveBeenCalled();
  });

  it('names the visit area separately from confirmed remote work and keeps its edit in the same AI topic', async () => {
    const { openConversation, navigate } = await show({ executionModes: { kind: 'confirmed', modes: ['REMOTE', 'ON_SITE'] } });
    expect(all()).toEqual(expect.arrayContaining(['Na lokaciji i na daljinu', 'Područje dolaska', 'Novi Sad · do 20 km']));
    await act(async () => press('Područje dolaska').props.onPress());
    expect(openConversation).toHaveBeenCalledTimes(1);
    expect(openConversation).toHaveBeenCalledWith('area');
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(['loading', 'unavailable', 'unconfirmed'] as const)('%s modes cannot infer on-site work from the city or remote work from skill text', async kind => {
    await show({ executionModes: { kind } }, draft({ vestine: ['3D štampa'], biografija: 'Radim na daljinu.' }));
    const mode = tree.root.findAll(node => node.props.title === 'Način rada')[0];
    expect(mode.props.subtitle).not.toMatch(/^Na lokaciji|^Na daljinu/);
    expect(all().join(' ')).not.toContain('20 km'); expect(press('Područje dolaska')).toBeUndefined();
  });

  it('shows the account, services and availability once, with one main AI edit action', async () => {
    await show({ rating: <RatingLineView average={4.8} count={12} /> });
    const copy = all();
    for (const part of ['Ana Petrović', '4,8 · 12 ocena', 'Šta radiš', 'Selidbe', 'Nošenje', 'Područje dolaska', 'Novi Sad · do 20 km',
      'Kada', 'Mogu odmah', 'Nedeljni raspored']) expect(copy).toContain(part);
    expect(copy.join(' ')).not.toMatch(/Oprema|Bušilica|Kombi/);
    expect(copy.filter(text => text === 'Selidbe')).toHaveLength(1);
    expect(copy).not.toContain('Tvoj radni profil'); expect(copy).not.toContain('Selidbe · Nošenje');
    expect(action('Uredi kroz razgovor')).toBeTruthy();
    // 8 Oct 2026 (owner's phone): "Mogu odmah · dostupnost" said the same thing twice; the profile of the old design said it, and so did "samo informacija" and a row of notifications.
    expect(copy).not.toContain('Mogu odmah · dostupnost'); expect(copy.join(' ')).not.toMatch(/Izmeni razgovorom|Izmeni ručno|Obaveštenja o zadacima|Na šta utiče|samo informacija/);
    expect(tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Izmeni: '))).toHaveLength(0);
    expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
  });

  it('uses the account name as the identity heading without repeating the screen title', async () => {
    await show({ accountName: 'Milos' }, draft({ ime: 'Milos' }));
    expect(all()).not.toContain('Tvoj radni profil'); expect(all().join(' ')).not.toMatch(/radnik|radnica/i);
    const title = tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header')[0];
    expect(textOf(title)).toBe('Milos');
  });

  it('draws the face it is given in the card, and the rating line it is given, and no rating when it has none', async () => {
    await show({ face: React.createElement('Face', { testID: 'the-face' }), rating: <RatingLineView average={4.8} count={12} /> });
    expect(tree.root.findAllByProps({ testID: 'the-face' }).length).toBeGreaterThan(0); expect(tree.root.findAllByProps({ testID: 'rating-line' }).length).toBeGreaterThan(0);
    await act(async () => tree.update(<WorkerProfileSaved draft={draft()} status={<></>} disabled={false} navigate={jest.fn()} />));
    expect(tree.root.findAllByProps({ testID: 'rating-line' })).toHaveLength(0); expect(all().join(' ')).not.toMatch(/ocena|★/);
  });

  it('opens only the area, week and conversation; saved lists are facts, not hidden editors', async () => {
    const { navigate, openConversation } = await show();
    await act(async () => { press('Područje dolaska').props.onPress(); press('Nedeljni raspored').props.onPress(); });
    expect(navigate).not.toHaveBeenCalled();
    expect(press('Šta radiš')).toBeUndefined(); expect(press('Alat')).toBeUndefined(); expect(press('Vozila')).toBeUndefined();
    expect(openConversation.mock.calls).toEqual([['area'],['time']]);
  });

  it('opens the generic conversation without treating a native press event as a correction topic', async () => {
    const { openConversation } = await show();
    await act(async () => action('Uredi kroz razgovor').props.onPress({ nativeEvent: { target: 1 } }));
    expect(openConversation).toHaveBeenCalledWith();
  });

  it('keeps area and schedule corrections in AI when the generic conversation action is supplied by the route footer', async () => {
    const { navigate, openConversation } = await show({ showConversationAction: false });
    expect(action('Uredi kroz razgovor')).toBeUndefined();
    await act(async () => { press('Područje dolaska').props.onPress(); press('Nedeljni raspored').props.onPress(); });
    expect(openConversation.mock.calls).toEqual([['area'], ['time']]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('says what is missing in one plain sentence each, and invents nothing', async () => {
    await show({}, draft({ ime: '', biografija: '', vestine: [], alati: [], vozila: [], grad: '', radius: '', dostupanOdmah: false }));
    const copy = all();
    expect(copy).toContain('Nema sačuvanih veština.'); expect(copy).toContain('Reci gde dolaziš na zadatak');
    // A list with nothing in it is "Dodaj", never a zero; with neither a name nor a kind of work the card is not drawn.
    expect(copy.filter(text => text === 'Nije navedeno')).toHaveLength(0); expect(copy.join(' ')).not.toMatch(/\b0\b/);
    expect(tree.root.findAllByProps({ testID: 'worker-profile-kit' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'worker-profile-card' })).toHaveLength(0); expect(copy).not.toContain('Tvoj radni profil');
    expect(copy).not.toContain('Pogledaj i uredi dostupnost'); expect(copy.join(' ')).not.toMatch(/undefined|null|NaN/);
  });

  it(`shows up to ${SKILL_CHIPS_MAX} services and reveals the rest without an edit or write`, async () => {
    const skills = Array.from({ length: 11 }, (_, index) => `Veština ${index + 1}`);
    const { navigate, openConversation } = await show({}, draft({ vestine: skills }));
    const chips = tree.root.findByProps({ testID: 'worker-profile-skills' });
    const words = chips.findAll(node => String(node.type) === 'T').map(node => textOf(node));
    expect(words).toEqual(skills.slice(0, SKILL_CHIPS_MAX));
    expect(press('Prikaži sve: Veštine').props.accessibilityState.expanded).toBe(false);
    await act(async () => press('Prikaži sve: Veštine').props.onPress());
    expect(all()).toContain('Veština 11');
    await act(async () => press('Prikaži manje: Veštine').props.onPress());
    expect(all()).not.toContain('Veština 11');
    expect(all().filter(text => text === 'Veština 1')).toHaveLength(1);
    expect(navigate).not.toHaveBeenCalled(); expect(openConversation).not.toHaveBeenCalled();
  });
});

describe('the card\'s line of the kinds of work', () => {
  it(`names the first ${SKILLS_IN_CARD} and counts the rest, clips a long one, and says nothing when there are none`, () => {
    expect(skillsLine([])).toBe(''); expect(skillsLine(['Moleraj'])).toBe('Moleraj');
    expect(skillsLine(['Moleraj', 'Selidbe', 'Nošenje'])).toBe('Moleraj · Selidbe · Nošenje');
    expect(skillsLine(['Moleraj', 'Selidbe', 'Nošenje', 'Farbanje', 'Čišćenje'])).toBe('Moleraj · Selidbe · Nošenje +2');
    expect(skillsLine(['  Moleraj  ', '', '   '])).toBe('Moleraj');
    const long = skillsLine(['Selidbe stanova i kancelarija sa pakovanjem i odvozom']);
    expect(Array.from(long).length).toBeLessThanOrEqual(28); expect(long.endsWith('…')).toBe(true);
  });
});
describe('availability is edited through AI', () => {
  it('shows the saved state and opens a topic without a switch or optimistic change', async () => {
    const onEdit = jest.fn(); await show({ availableNow: { value: true, onEdit } });
    expect(toggle()).toBeUndefined(); expect(all()).toContain('Mogu odmah');
    await act(async () => press('Dostupnost').props.onPress());
    expect(onEdit).toHaveBeenCalledTimes(1); expect(all()).toContain('Mogu odmah');
  });
  it('does not run a retained action while disabled', async () => {
    const onEdit = jest.fn(); await show({ disabled: true, availableNow: { value: false, onEdit } });
    expect(press('Dostupnost').props.disabled).toBe(true);
    await act(async () => press('Dostupnost').props.onPress()); expect(onEdit).not.toHaveBeenCalled();
  });
  it('keeps suspended availability read-only', async () => {
    await show({ readOnly: true }, draft({ dostupanOdmah: true }));
    expect(toggle()).toBeUndefined(); expect(all()).toContain('Uključeno');
  });
});


// "Na šta utiče" was a group of three rows on this screen. It is the sentences behind the "ⓘ" in the bar now: the screen keeps the fact, the
// explanation is one tap away (analysis rule J5).
describe('what the data does today is behind the "ⓘ", not on the screen', () => {
  it('draws no block of sentences about the effects', async () => {
    await show();
    const copy = all().join(' | ');
    expect(copy).not.toContain('Na šta utiče'); expect(copy).not.toContain('Javni profil'); expect(copy).not.toContain('Zadaci · Za mene');
    expect(copy).not.toContain('Novi i već otvoreni zadaci koji ti odgovaraju');
    expect(tree.root.findAllByProps({ testID: 'worker-effect-public' })).toHaveLength(0);
  });

  it('names the notifications, the public profile and the "Za mene" list now that the server has it, as sentences that stand on their own', () => {
    expect(FOR_ME_SWITCH_EXISTS).toBe(true);
    expect(workerProfileInfoLines()).toEqual([
      'Obaveštenja: novi i već otvoreni zadaci koji ti odgovaraju.',
      'Javni profil: ime, „O meni“ i grad vide osobe koje otvore tvoj profil.',
      'Zadaci · Za mene: lista po tvom području i vremenu.']);
  });

  it('adds the equipment note and the people count only while the profile is edited by hand, and leaves "Za mene" out for a server without it', () => {
    expect(workerProfileInfoLines(true).slice(3)).toEqual([toolsAndVehiclesNote(), PEOPLE_COUNT_NOTE]);
    expect(PEOPLE_COUNT_NOTE).toBe('Ako za neki zadatak obezbeđuješ više ljudi, njihov broj navodiš u toj ponudi.');
    expect(workerProfileInfoLines(false, false)).toEqual([
      'Obaveštenja: novi i već otvoreni zadaci koji ti odgovaraju.', 'Javni profil: ime, „O meni“ i grad vide osobe koje otvore tvoj profil.']);
    expect(workerProfileInfoLines(true, true, false)[3]).toBe('Ako zadatak traži alat ili vozilo koje nemaš na spisku, taj zadatak ti se ne nudi i ne možeš da se prijaviš na njega.');
  });

  it('has the "Za mene" effect while the build has the switch, and only then', () => {
    expect(profileEffects().map(row => row.key)).toEqual(['notifications', 'public', 'forMe']);
    expect(profileEffects(false).map(row => row.key)).toEqual(['notifications', 'public']);
    const withSwitch = profileEffects(true);
    expect(withSwitch.map(row => row.key)).toEqual(['notifications', 'public', 'forMe']);
    expect(withSwitch[2]).toMatchObject({ title: 'Zadaci · Za mene', detail: 'Lista po tvom području i vremenu' });
    expect(withSwitch[2].opens).toBeUndefined();
  });

  it('does not expose an equipment section in the MVP profile reading', async () => {
    await show();
    expect(tree.root.findAllByProps({ testID: 'worker-kit-info' })).toHaveLength(0);
    expect(all().join(' ')).not.toMatch(/Oprema|Bušilica|Kombi/);
  });
});

it('keeps legacy equipment data out of the saved MVP reading without mutating it', async () => {
  const withEquipment = draft({ alati: ['Bušilica', 'Merdevine'], vozila: ['Kombi'] });
  await show({}, withEquipment);
  expect(all().join(' ')).not.toMatch(/Bušilica|Merdevine|Kombi|Oprema/);
  expect(withEquipment.alati).toEqual(['Bušilica', 'Merdevine']);
  expect(withEquipment.vozila).toEqual(['Kombi']);
});

// ONE NAME (owner, 8 Oct 2026, "Može, dobro vam jedno ime za sve."): the work profile is read under the account's name; the difference is said quietly
// with one button that is the person's own action.
describe('one name', () => {
  const header = () => tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header')[0];

  it('reads under the account\'s name, and under the profile\'s own only while the account\'s cannot be read', async () => {
    await show({ accountName: 'Milos' }, draft({ ime: 'Pera peric' }));
    expect(textOf(header())).toBe('Milos');
    await act(async () => tree.update(<WorkerProfileSaved draft={draft({ ime: 'Pera peric' })} status={<></>} disabled={false} navigate={jest.fn()}
      accountName={null} />));
    expect(textOf(header())).toBe('Pera peric');
  });

  it('says the difference under the card with its one button, and the button is the person\'s own action', async () => {
    const onUse = jest.fn();
    await show({ accountName: 'Milos', onUseAccountName: onUse }, draft({ ime: 'Pera peric' }));
    expect(all()).toContain('Na radnom profilu piše „Pera peric“.');
    expect(action('Koristi „Milos“').props).toMatchObject({ kind: 'secondary', disabled: false, loading: false });
    // Name reconciliation remains secondary to the single conversation action.
    expect(action('Uredi kroz razgovor').props.style).toBe(brandAction);
    expect(tree.root.findAll(node => String(node.type) === 'Action' && node.props.style === brandAction)).toHaveLength(1);
    await act(async () => { action('Koristi „Milos“').props.onPress(); }); expect(onUse).toHaveBeenCalledTimes(1);
  });

  it('spins its own button while the write runs, and waits while the screen is busy', async () => {
    await show({ accountName: 'Milos', onUseAccountName: jest.fn(), nameWorking: true, disabled: true }, draft({ ime: 'Pera peric' }));
    expect(action('Koristi „Milos“').props).toMatchObject({ loading: true, disabled: true });
  });

  it('says nothing about the name when the two agree, when there is no way to write it, or when one of them is missing', async () => {
    await show({ accountName: 'Ana Petrović', onUseAccountName: jest.fn() });
    expect(tree.root.findAllByProps({ testID: 'worker-name-difference' })).toHaveLength(0);
    await act(async () => tree.update(<WorkerProfileSaved draft={draft({ ime: 'Pera peric' })} status={<></>} disabled={false} navigate={jest.fn()}
      accountName="Milos" />));
    expect(tree.root.findAllByProps({ testID: 'worker-name-difference' })).toHaveLength(0);
    await act(async () => tree.update(<WorkerProfileSaved draft={draft({ ime: '' })} status={<></>} disabled={false} navigate={jest.fn()}
      accountName="Milos" onUseAccountName={jest.fn()} />));
    expect(tree.root.findAllByProps({ testID: 'worker-name-difference' })).toHaveLength(0);
    expect(textOf(header())).toBe('Milos');
  });
});

describe('the assistant', () => {
  it('offers one primary conversation action, refuses a disabled callback and hides it without a route', async () => {
    const { openConversation } = await show();
    expect(action('Uredi kroz razgovor').props.style).toBe(brandAction); expect(action('Uredi kroz razgovor').props.disabled).toBe(false);
    await act(async () => { action('Uredi kroz razgovor').props.onPress(); }); expect(openConversation).toHaveBeenCalledTimes(1);
    openConversation.mockClear();
    await act(async () => tree.update(<WorkerProfileSaved draft={draft()} status={<></>} disabled navigate={jest.fn()} openConversation={openConversation} />));
    expect(action('Uredi kroz razgovor').props.disabled).toBe(true);
    await act(async () => action('Uredi kroz razgovor').props.onPress());
    expect(openConversation).not.toHaveBeenCalled();
    await act(async () => tree.update(<WorkerProfileSaved draft={draft()} status={<></>} disabled={false} navigate={jest.fn()} />));
    expect(action('Uredi kroz razgovor')).toBeUndefined();
  });
});


describe('saved biography and suspended state', () => {
  it('shows the complete short biography and permits expansion of a long one without writing', async () => {
    await show(); expect(all()).toContain('Radim sa bratom.');
    const bio = 'Dugo iskustvo u montaži i prevozu. '.repeat(20) + 'Poslednja rečenica.';
    await act(async () => tree.update(<WorkerProfileSaved draft={draft({ biografija: bio })} status={<></>} disabled={false} navigate={jest.fn()} />));
    const copy = () => tree.root.findAll(node => String(node.type) === 'T' && textOf(node) === bio)[0];
    expect(copy().props.numberOfLines).toBe(4);
    await act(async () => press('Prikaži sve: O meni').props.onPress());
    expect(copy().props.numberOfLines).toBeUndefined(); expect(textOf(copy())).toBe(bio);
    await act(async () => press('Prikaži manje: O meni').props.onPress()); expect(copy().props.numberOfLines).toBe(4);
  });
  it('keeps facts readable while a suspended profile has no editing or availability entry', async () => {
    const onEdit = jest.fn();
    const { navigate, openConversation } = await show({ readOnly: true, accountName: 'Milos', onUseAccountName: jest.fn(), availableNow: { value: true, onEdit } },
      draft({ alati: Array.from({ length: 5 }, (_, index) => `Alat ${index}`) }));
    expect(action('Uredi kroz razgovor')).toBeUndefined(); expect(press('Područje dolaska')).toBeUndefined();
    expect(action('Koristi „Milos“').props.disabled).toBe(true);
    expect(press('Nedeljni raspored')).toBeUndefined(); expect(toggle()).toBeUndefined();
    expect(all().join(' ')).not.toContain('Alat 4');
    expect(onEdit).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled(); expect(openConversation).not.toHaveBeenCalled();
  });
});

it('does not hide a saved biography when the name and skills are missing', async () => {
  await show({}, draft({ ime: '', vestine: [], biografija: 'Moj opis iskustva.' }));
  expect(all()).toContain('Moj opis iskustva.'); expect(all()).not.toContain('Tvoj radni profil');
});
