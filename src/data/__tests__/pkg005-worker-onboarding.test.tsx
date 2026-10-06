import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockAccountId = '10000000-0000-4000-8000-000000000001';
let mockAccountRevision = 1;
const readProfile = jest.fn();
const writeProfile = jest.fn();
const mockNavigate = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockSource = { mojRadnikProfil: readProfile, azurirajRadnikProfil: writeProfile };

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const appState = { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) };
  return new Proxy(actual, { get: (target, key) => key === 'AppState' ? appState : Reflect.get(target, key) });
});
jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args), back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args), push: (...args: unknown[]) => mockPush(...args), canGoBack: () => true },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('../../store/sesija', () => ({
  useSesija: () => ({ user: { id: mockAccountId }, accountRevision: mockAccountRevision }),
  sesijaSada: () => ({ user: { id: mockAccountId }, accountRevision: mockAccountRevision }),
}));
jest.mock('../../store/uloga', () => ({
  useIzvor: () => mockSource,
}));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'V2Action' }));
jest.mock('../../ui/workerProfile/WorkerProfilePresentation', () => ({
  WorkerProfileFrame: ({ children, footer }: { children: unknown; footer?: unknown }) => require('react').createElement('Frame', null, children, footer),
  WorkerProfileStatus: (props: Record<string, unknown>) => require('react').createElement('Status', props),
  WorkerProfileForm: (props: Record<string, unknown>) => require('react').createElement('WorkerProfileForm', props),
  // The save status stands above the footer actions since 2026-09-24; its actions are the route's own, drawn as they are.
  WorkerProfileFooter: ({ children, ...props }: { children?: unknown }) => require('react').createElement('Footer', props, children),
}));

import Profile from '../../app/(app)/profil/radnik';

const REV = 'a'.repeat(64);
const readyDraft = (change: Record<string, unknown> = {}) => ({
  id: '20000000-0000-4000-8000-000000000001',
  ime: 'Ana', grad: 'Novi Sad', biografija: '', vestine: ['Selidbe'], alati: [], vozila: [], licence: [],
  stanje: 'DRAFT', dostupanOdmah: false, radijusKm: 15, kapacitetTima: 1, capacityRevision: REV,
  ...change,
});

let tree: ReactTestRenderer | undefined;
const action = (label: string) => tree!.root.findAll(node => String(node.type) === 'V2Action' && node.props.label === label)[0];
const form = () => tree!.root.findByType('WorkerProfileForm' as React.ElementType);
async function render() { await act(async () => { tree = create(<Profile />); }); await act(async () => {}); }

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountId = '10000000-0000-4000-8000-000000000001'; mockAccountRevision = 1;
  readProfile.mockReset(); writeProfile.mockReset().mockResolvedValue({ ok: true, podatak: null });
});
afterEach(async () => { if (tree) await act(async () => tree?.unmount()); tree = undefined; });

describe('PKG-005 progressive Worker onboarding', () => {
  it('saves the first canonical draft before exposing any activation attempt, then routes the missing area prerequisite', async () => {
    readProfile.mockResolvedValueOnce(null).mockResolvedValue(readyDraft({ grad: '' }));
    await render();

    expect(action('Uredi kroz razgovor')).toBeTruthy();
    expect(action('Sačuvaj profil')).toBeUndefined();
    expect(tree!.root.findAll(node => String(node.type) === 'V2Action' && node.props.label === 'Proveri i aktiviraj profil')).toHaveLength(0);

    await act(async () => form().props.change({ ...form().props.draft, ime: 'Ana', vestine: ['Selidbe'] }));
    await act(async () => { action('Sačuvaj profil').props.onPress(); });
    await act(async () => {});

    expect(writeProfile).toHaveBeenCalledWith({ ime: 'Ana', vestine: ['Selidbe'], zavrsi: false });
    expect(action('Podesi područje rada')).toBeTruthy();
    expect(tree!.root.findAll(node => String(node.type) === 'V2Action' && node.props.label === 'Proveri i aktiviraj profil')).toHaveLength(0);

    await act(async () => action('Podesi područje rada').props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('/profil/lokacija');
  });

  it('activates a ready personal profile without requiring legacy capacityRevision', async () => {
    readProfile.mockResolvedValue(readyDraft({ capacityRevision: null }));
    await render();

    expect(action('Učitaj kapacitet profila')).toBeUndefined();
    expect(action('Proveri i aktiviraj profil')).toBeTruthy();
    await act(async () => action('Proveri i aktiviraj profil').props.onPress());
    expect(writeProfile).toHaveBeenCalledWith({ zavrsi: true });
  });

  it('exposes activation when canonical draft, area and minimum personal profile facts are present', async () => {
    readProfile.mockResolvedValue(readyDraft());
    await render();

    expect(action('Proveri i aktiviraj profil')).toBeTruthy();
    await act(async () => { action('Proveri i aktiviraj profil').props.onPress(); });
    await act(async () => {});
    expect(writeProfile).toHaveBeenCalledWith({ zavrsi: true });
  });

  it('guides an incomplete pristine DRAFT to the missing visible field without calling activation', async () => {
    readProfile.mockResolvedValue(readyDraft({ ime: '', vestine: [] }));
    await render();

    expect(action('Dopuni osnovne podatke')).toBeTruthy();
    await act(async () => action('Dopuni osnovne podatke').props.onPress());
    expect(writeProfile).not.toHaveBeenCalled();
    expect(form().props.focusRequest).toMatchObject({ target: 'name' });
  });

  it('focuses the invalid one-character name before a skill that is already present', async () => {
    readProfile.mockResolvedValue(readyDraft({ ime: 'A', vestine: ['Selidbe'] }));
    await render();

    expect(action('Dopuni osnovne podatke')).toBeTruthy();
    await act(async () => action('Dopuni osnovne podatke').props.onPress());
    expect(writeProfile).not.toHaveBeenCalled();
    expect(form().props.focusRequest).toMatchObject({ target: 'name' });
  });

  // Round 5c: a row tapped with an unsaved draft (the keyboard often still up) refuses into the footer's answer, which the
  // frame keeps on screen while typing; the guide's instruction goes to the same place before the field is focused.
  it('answers a row tapped with an unsaved draft in the footer and does not navigate', async () => {
    readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE' }));
    await render();
    const footer = () => tree!.root.findByType('Footer' as React.ElementType);
    await act(async () => form().props.change({ ...form().props.draft, ime: 'Ana Anić' }));
    await act(async () => form().props.navigate('/profil/lokacija'));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(footer().props.error).toBe('Sačuvaj unos pre otvaranja drugog podešavanja.');
    await act(async () => form().props.navigate('/podrska'));
    expect(footer().props.error).toBe('Sačuvaj unos pre nego što pišeš podršci.');
    await act(async () => form().props.openConversation());
    expect(mockPush).not.toHaveBeenCalled();
    expect(footer().props.error).toBe('Sačuvaj unos pre otvaranja razgovora.');
  });

  it('keeps the guide instruction in the footer answer while the field it focuses opens the keyboard', async () => {
    readProfile.mockResolvedValue(readyDraft({ ime: '', vestine: [] }));
    await render();
    await act(async () => action('Dopuni osnovne podatke').props.onPress());
    expect(tree!.root.findByType('Footer' as React.ElementType).props.error).toBe('Pre aktivacije unesi ime od najmanje 2 znaka i bar jednu veštinu.');
  });

  // Round 5c: a saved profile whose state is unknown is still a saved profile; the capacity note keys on that, not on status.
  it('tells the form a profile exists even when its state is unknown', async () => {
    readProfile.mockResolvedValue(readyDraft({ stanje: null }));
    await render();
    expect(form().props.status).toBeNull(); expect(form().props.profileExists).toBe(true);
    await act(async () => tree!.unmount()); tree = undefined;
    readProfile.mockResolvedValue(null);
    await render();
    expect(form().props.profileExists).toBe(false);
  });
});
