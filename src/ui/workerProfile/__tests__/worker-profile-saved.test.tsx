import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerDraft } from '../workerProfileDraft';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'TextInput', 'ScrollView'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'Action' }));

import { WorkerProfileSaved } from '../WorkerProfileSaved';
import { FOR_ME_SWITCH_EXISTS, profileEffects } from '../workerProfileFacts';
import { brandAction } from '../../system/tokens';

/**
 * The saved work profile, read (T4b1, 2026-10-07, M3): the same facts as the editor without a pencil on every line, what the
 * data really does ("Na šta utiče": only effects that exist today), and the two ways to change it. It draws no state of its
 * own; the route decides when a profile is read and what the status line says.
 */
const draft = (patch: Partial<WorkerDraft> = {}): WorkerDraft => ({ ime: 'Ana Petrović', grad: 'Novi Sad', biografija: 'Radim sa bratom.', vestine: ['Selidbe', 'Nošenje'],
  alati: ['Bušilica'], vozila: ['Kombi'], licence: [], capacity: '', capacityRevision: null, radius: '20', dostupanOdmah: true,
  newSkill: '', newTool: '', newVehicle: '', newLicense: '', ...patch });
let tree: ReactTestRenderer;
const textOf = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => textOf(child as ReactTestInstance | string)).join('');
const all = () => tree.root.findAll(node => String(node.type) === 'T').map(node => textOf(node));
const action = (label: string) => tree.root.findAll(node => String(node.type) === 'Action' && node.props.label === label)[0];
const press = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0];
const show = async (patch: Partial<React.ComponentProps<typeof WorkerProfileSaved>> = {}, value: WorkerDraft = draft()) => {
  const spies = { navigate: jest.fn(), openConversation: jest.fn(), onManual: jest.fn() };
  const props = { draft: value, status: <></>, disabled: false, ...spies, ...patch };
  await act(async () => { tree = create(<WorkerProfileSaved {...props} />); });
  return spies;
};
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('what the saved profile shows', () => {
  it('reads the name and "O meni", the skills as words, the area, the week, the tools and the vehicle, without a pencil', async () => {
    await show();
    const copy = all();
    for (const part of ['Ana Petrović', 'Radim sa bratom.', 'Selidbe', 'Nošenje', 'Bušilica', 'Kombi', 'Područje rada', 'Novi Sad · 20 km', 'Dostupnost', 'Mogu odmah · dostupnost']) expect(copy).toContain(part);
    expect(tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Izmeni: '))).toHaveLength(0);
    expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
  });

  it('opens the area and the week from their rows, and nothing else on the screen changes the profile', async () => {
    const { navigate } = await show();
    await act(async () => { press('Područje rada').props.onPress(); });
    await act(async () => { press('Dostupnost').props.onPress(); });
    expect(navigate.mock.calls).toEqual([['/profil/lokacija'], ['/profil/dostupnost']]);
  });

  it('says what is missing in one plain sentence each, and invents nothing', async () => {
    await show({}, draft({ ime: '', biografija: '', vestine: [], alati: [], vozila: [], grad: '', radius: '', dostupanOdmah: false }));
    const copy = all();
    expect(copy).toContain('Koje zadatke možeš da preuzmeš?'); expect(copy).toContain('Alat i vozilo nisu navedeni.');
    expect(copy).toContain('Izaberi gde želiš da radiš'); expect(copy).toContain('Pogledaj i uredi dostupnost');
    expect(tree.root.findAllByProps({ testID: 'worker-profile-identity' })).toHaveLength(0);
    expect(copy.join(' ')).not.toMatch(/undefined|null|NaN/);
  });

  it('keeps a long "O meni" readable behind "Prikaži sve"', async () => {
    const bio = 'Radim sa bratom već osam godina. '.repeat(8);
    await show({}, draft({ biografija: bio }));
    const text = () => tree.root.findAll(node => String(node.type) === 'T' && node.props.children === bio)[0];
    expect(text().props.numberOfLines).toBe(3);
    await act(async () => { press('Prikaži sve: O meni').props.onPress(); });
    expect(text().props.numberOfLines).toBeUndefined(); expect(press('Sažmi: O meni').props.accessibilityState).toEqual({ expanded: true });
  });
});

describe('what the data does today (Na šta utiče)', () => {
  it('names the notifications and the public profile, and no "Za mene" list while the server has none', async () => {
    expect(FOR_ME_SWITCH_EXISTS).toBe(false);
    await show();
    const copy = all();
    expect(copy).toContain('Na šta utiče');
    expect(copy).toContain('Obaveštenja'); expect(copy).toContain('Novi i već otvoreni zadaci koji ti odgovaraju');
    expect(copy).toContain('Javni profil'); expect(copy).toContain('Ime, „O meni“ i grad vide osobe koje otvore tvoj profil');
    expect(copy.join(' ')).not.toMatch(/Za mene|Lista po tvom području/);
  });

  it('the notifications row opens the notification settings; the public-profile row is a sentence, not a control', async () => {
    const { navigate } = await show();
    await act(async () => { press('Obaveštenja').props.onPress(); });
    expect(navigate).toHaveBeenCalledWith('/profil/obavestenja');
    expect(tree.root.findByProps({ testID: 'worker-effect-public' }).props.onPress).toBeUndefined();
    expect(tree.root.findByProps({ testID: 'worker-effect-public' }).props.accessibilityLabel).toBe('Javni profil. Ime, „O meni“ i grad vide osobe koje otvore tvoj profil');
  });

  it('knows the "Za mene" row for the day the server has the switch, and only then', () => {
    expect(profileEffects().map(row => row.key)).toEqual(['notifications', 'public']);
    const withSwitch = profileEffects(true);
    expect(withSwitch.map(row => row.key)).toEqual(['notifications', 'public', 'forMe']);
    expect(withSwitch[2]).toMatchObject({ title: 'Zadaci · Za mene', detail: 'Lista po tvom području i vremenu' });
    expect(withSwitch[2].opens).toBeUndefined();
  });

  it('says what the tools and vehicles do today, and the tag only when they are information', async () => {
    await show();
    expect(tree.root.findByProps({ testID: 'worker-profile-kit-note' }).children.join('')).toBe('Ako zadatak traži alat ili vozilo koje nemaš na spisku, taj zadatak ti se ne nudi i ne možeš da se prijaviš na njega.');
    expect(all()).not.toContain('samo informacija');
  });
});

describe('the two ways to change it', () => {
  it('"Izmeni razgovorom" is the one green primary, "Izmeni ručno" is white', async () => {
    const { openConversation, onManual } = await show();
    expect(action('Izmeni razgovorom').props.style).toBe(brandAction); expect(action('Izmeni razgovorom').props.tone).toBe('brand');
    expect(action('Izmeni ručno').props.style).toBeUndefined(); expect(action('Izmeni ručno').props.tone).toBe('neutral');
    await act(async () => { action('Izmeni razgovorom').props.onPress(); }); expect(openConversation).toHaveBeenCalledTimes(1);
    await act(async () => { action('Izmeni ručno').props.onPress(); }); expect(onManual).toHaveBeenCalledTimes(1);
  });

  it('is white on both when the route already shows a footer with the green primary', async () => {
    await show({ primaryTaken: true });
    expect(action('Izmeni razgovorom').props.style).toBeUndefined(); expect(action('Izmeni razgovorom').props.tone).toBe('neutral');
    expect(action('Izmeni ručno').props.style).toBeUndefined();
  });

  it('offers only the manual way when there is no conversation to open, and nothing when busy', async () => {
    await show({ openConversation: undefined });
    expect(action('Izmeni razgovorom')).toBeUndefined(); expect(action('Izmeni ručno')).toBeTruthy();
    await act(async () => tree.update(<WorkerProfileSaved draft={draft()} status={<></>} disabled navigate={jest.fn()} openConversation={jest.fn()} onManual={jest.fn()} />));
    expect(action('Izmeni razgovorom').props.disabled).toBe(true); expect(action('Izmeni ručno').props.disabled).toBe(true);
    expect(press('Obaveštenja').props.disabled).toBe(true); expect(press('Područje rada').props.disabled).toBe(true);
  });
});
