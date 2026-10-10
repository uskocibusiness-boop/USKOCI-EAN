import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockAccountId = '10000000-0000-4000-8000-000000000001';
let mockAccountRevision = 1;
// ONE NAME (owner, 8 Oct 2026): the work profile takes the ACCOUNT's name; the hook is mocked (the real one reads the server).
let mockAccountName: { state: 'loading' } | { state: 'error'; retry: () => void } | { state: 'ready'; name: string | null; profileId?: string | null } = { state: 'ready', name: 'Ana' };
// "Lični podaci" leads here with `uredi=o-meni` and a nonce `n`.
let mockParams: { uredi?: string; n?: string } = {};
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
  useLocalSearchParams: () => mockParams,
}));
// The card's face and rating read their own resources (their own suites); here they are named elements, so the route is tested for what it hands the form.
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
jest.mock('../../ui/profile/RatingLine', () => ({ RatingLine: 'RatingLine' }));
jest.mock('../../store/sesija', () => ({
  useSesija: () => ({ user: { id: mockAccountId }, accountRevision: mockAccountRevision }),
  sesijaSada: () => ({ user: { id: mockAccountId }, accountRevision: mockAccountRevision }),
}));
jest.mock('../../store/uloga', () => ({
  useIzvor: () => mockSource,
}));
jest.mock('../../ui/profile/useAccountName', () => ({ useAccountName: () => mockAccountName }));
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
async function render(legacy = false) { await act(async () => { tree = create(<Profile />); }); await act(async () => {});
  if (legacy) await act(async () => form().props.onEditPart('skills'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountId = '10000000-0000-4000-8000-000000000001'; mockAccountRevision = 1; mockAccountName = { state: 'ready', name: 'Ana' }; mockParams = {};
  readProfile.mockReset(); writeProfile.mockReset().mockResolvedValue({ ok: true, podatak: null });
});
afterEach(async () => { if (tree) await act(async () => tree?.unmount()); tree = undefined; });

describe('PKG-005 progressive Worker onboarding', () => {
  it('a pristine DRAFT has one AI continuation and no direct activation or duplicate draft save', async () => {
    readProfile.mockResolvedValue(readyDraft()); await render();
    expect(form().props.reading).toBe(true);
    expect(form().props.openConversation).toBeUndefined();
    expect(action('Sačuvaj kao nacrt')).toBeUndefined(); expect(action('Proveri i aktiviraj profil')).toBeUndefined();
    await act(async () => action('Nastavi kroz razgovor').props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/profil/razgovor'); expect(writeProfile).not.toHaveBeenCalled();
  });

  it('saves the first canonical draft before exposing any activation attempt, then routes the missing area prerequisite', async () => {
    readProfile.mockResolvedValueOnce(null).mockResolvedValue(readyDraft({ grad: '' }));
    await render(true);

    expect(action('Uredi kroz razgovor')).toBeTruthy();
    expect(action('Sačuvaj profil')).toBeUndefined();
    expect(tree!.root.findAll(node => String(node.type) === 'V2Action' && node.props.label === 'Proveri i aktiviraj profil')).toHaveLength(0);

    // The name is not typed here: the first save is made under the name of the account.
    await act(async () => form().props.change({ ...form().props.draft, vestine: ['Selidbe'] }));
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
    await render(true);

    expect(action('Učitaj kapacitet profila')).toBeUndefined();
    expect(action('Proveri i aktiviraj profil')).toBeTruthy();
    await act(async () => action('Proveri i aktiviraj profil').props.onPress());
    expect(writeProfile).toHaveBeenCalledWith({ zavrsi: true });
  });

  it('exposes activation when canonical draft, area and minimum personal profile facts are present', async () => {
    readProfile.mockResolvedValue(readyDraft());
    await render(true);

    expect(action('Proveri i aktiviraj profil')).toBeTruthy();
    await act(async () => { action('Proveri i aktiviraj profil').props.onPress(); });
    await act(async () => {});
    expect(writeProfile).toHaveBeenCalledWith({ zavrsi: true });
  });

  it('guides an incomplete pristine DRAFT to the missing visible field without calling activation', async () => {
    readProfile.mockResolvedValue(readyDraft({ ime: '', vestine: [] }));
    await render(true);

    expect(action('Dopuni osnovne podatke')).toBeTruthy();
    await act(async () => action('Dopuni osnovne podatke').props.onPress());
    expect(writeProfile).not.toHaveBeenCalled();
    // The name of the account is there, so what is missing is the skill.
    expect(form().props.focusRequest).toMatchObject({ target: 'skill' });
  });

  it('activates under the account\'s name, even when the work profile carries a one-character name of its own', async () => {
    readProfile.mockResolvedValue(readyDraft({ ime: 'A', vestine: ['Selidbe'] }));
    await render(true);

    expect(action('Dopuni osnovne podatke')).toBeUndefined();
    await act(async () => action('Proveri i aktiviraj profil').props.onPress());
    expect(writeProfile).toHaveBeenCalledWith({ ime: 'Ana', zavrsi: true });
  });

  it('leads to "Lični podaci" when neither the account nor the profile has a name, and activates nothing', async () => {
    mockAccountName = { state: 'ready', name: null };
    readProfile.mockResolvedValue(readyDraft({ ime: '' }));
    await render(true);

    expect(action('Dodaj ime')).toBeTruthy(); expect(action('Proveri i aktiviraj profil')).toBeUndefined();
    await act(async () => action('Dodaj ime').props.onPress());
    expect(writeProfile).not.toHaveBeenCalled(); expect(mockNavigate).toHaveBeenCalledWith('/profil/podaci');
  });

  it('hands the form the name of the account and the one action that writes it into the work profile', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' };
    readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE', ime: 'Pera peric' }));
    await render();

    expect(form().props.accountName).toBe('Milos');
    readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE', ime: 'Milos' }));
    await act(async () => form().props.onUseAccountName());
    expect(writeProfile).toHaveBeenCalledTimes(1);
    expect(writeProfile).toHaveBeenCalledWith({ zavrsi: false, ime: 'Milos' });
  });

  // Round 5c: a row tapped with an unsaved draft (the keyboard often still up) refuses into the footer's answer, which the
  // frame keeps on screen while typing; the guide's instruction goes to the same place before the field is focused.
  it('answers a row tapped with an unsaved draft in the footer and does not navigate', async () => {
    readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE' }));
    await render();
    const footer = () => tree!.root.findByType('Footer' as React.ElementType);
    await act(async () => form().props.change({ ...form().props.draft, biografija: 'Radim sa bratom' }));
    await act(async () => form().props.navigate('/profil/lokacija'));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(footer().props.error).toBe('Sačuvaj unos pre otvaranja drugog podešavanja.');
    await act(async () => form().props.navigate('/podrska'));
    expect(footer().props.error).toBe('Sačuvaj unos pre nego što pišeš podršci.');
    await act(async () => form().props.openConversation());
    expect(mockPush).not.toHaveBeenCalled();
    expect(footer().props.error).toBe('Sačuvaj unos pre otvaranja razgovora.');
  });

  it('keeps the guide instruction in the retained editor footer while the field it focuses opens the keyboard', async () => {
    readProfile.mockResolvedValue(readyDraft({ ime: '', vestine: [] }));
    await render(true);
    await act(async () => action('Dopuni osnovne podatke').props.onPress());
    expect(tree!.root.findByType('Footer' as React.ElementType).props.error).toBe('Pre aktivacije dodaj bar jednu veštinu.');
  });

  // The approved draft of the product (8 Oct 2026, P3): a finished profile is read, a row of it opens the editor of ITS part, and the card has a face and a rating.
  describe('the profile read first, and what the route hands the form for it', () => {
    it('reads a clean active or suspended profile, and edits a draft, an edited one and a profile that does not exist yet', async () => {
      for (const [stanje, reading] of [['ACTIVE', true], ['SUSPENDED', true], ['DRAFT', true]] as const) {
        readProfile.mockResolvedValue(readyDraft({ stanje })); await render();
        expect([stanje, form().props.reading]).toEqual([stanje, reading]);
        await act(async () => tree!.unmount()); tree = undefined;
      }
      readProfile.mockResolvedValue(null); await render();
      expect(form().props.reading).toBe(false);
      await act(async () => tree!.unmount()); tree = undefined;
      readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE' })); await render();
      await act(async () => form().props.change({ ...form().props.draft, biografija: 'Radim sa bratom' }));
      expect(form().props.reading).toBe(false);
    });

    it('hands the form a way to open one part, and a tap on it turns the reading into the editor with that part open and nothing written', async () => {
      readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE' })); await render();
      expect(form().props.reading).toBe(true); expect(form().props.openSection).toBeNull();
      await act(async () => form().props.onEditPart('tools'));
      expect(form().props.reading).toBe(false); expect(form().props.openSection).toMatchObject({ section: 'tools', token: 1 });
      expect(writeProfile).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled();
      // Another part is another request.
      await act(async () => form().props.onEditPart('vehicles'));
      expect(form().props.openSection).toMatchObject({ section: 'vehicles', token: 2 });
    });

    it('does not open a part while the screen cannot take a tap: a save is in flight', async () => {
      let finish!: (value: unknown) => void;
      writeProfile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
      readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE', ime: 'Pera peric' })); mockAccountName = { state: 'ready', name: 'Milos' };
      await render();
      await act(async () => { void form().props.onUseAccountName(); });
      await act(async () => form().props.onEditPart('skills'));
      expect(form().props.openSection).toBeNull();
      readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE', ime: 'Milos' }));
      await act(async () => finish({ ok: true, podatak: null }));
    });

    it('keeps the profile read while only the name is being written: the button spins where it stands, the screen does not turn into the editor', async () => {
      let finish!: (value: unknown) => void;
      writeProfile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
      readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE', ime: 'Pera peric' })); mockAccountName = { state: 'ready', name: 'Milos' };
      await render();
      await act(async () => { void form().props.onUseAccountName(); });
      expect(form().props.nameWorking).toBe(true); expect(form().props.reading).toBe(true); expect(form().props.disabled).toBe(true);
      readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE', ime: 'Milos' }));
      await act(async () => finish({ ok: true, podatak: null }));
      expect(form().props.nameWorking).toBe(false); expect(form().props.reading).toBe(true); expect(form().props.disabled).toBe(false);
    });

    it('hands the card the account\'s photo when the account has a profile and its letters otherwise, and the rating of the account', async () => {
      readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE' })); mockAccountName = { state: 'ready', name: 'Ana', profileId: 'p-ana' };
      await render();
      expect(form().props.face.type).toBe('ProfilePhoto'); expect(form().props.face.props).toMatchObject({ profileId: 'p-ana', size: 56 });
      expect(form().props.rating.type).toBe('RatingLine'); expect(form().props.rating.props.accountId).toBe(mockAccountId);
      await act(async () => tree!.unmount()); tree = undefined;
      mockAccountName = { state: 'ready', name: 'Ana', profileId: null }; await render();
      expect(form().props.face.type).not.toBe('ProfilePhoto'); expect(form().props.face.props).toMatchObject({ size: 56 });
    });

    it('hands the form the switch "Mogu odmah" for an active profile only, with the state the profile has', async () => {
      readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE', dostupanOdmah: true })); await render();
      expect(form().props.availableNow).toMatchObject({ value: true, busy: false, failed: false }); expect(typeof form().props.availableNow.onChange).toBe('function');
      await act(async () => tree!.unmount()); tree = undefined;
      for (const stanje of ['DRAFT', 'SUSPENDED'] as const) {
        readProfile.mockResolvedValue(readyDraft({ stanje })); await render();
        expect([stanje, form().props.availableNow]).toEqual([stanje, undefined]);
        await act(async () => tree!.unmount()); tree = undefined;
      }
    });

    it('opens the editor on "O meni" for the link of "Lični podaci", once for each nonce, and for no other link', async () => {
      mockParams = { uredi: 'o-meni', n: '7' }; readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE' })); await render();
      expect(form().props.reading).toBe(false); expect(form().props.openSection).toMatchObject({ section: 'identity', token: 1 });
      // Rendering again with the same link opens nothing new.
      await act(async () => tree!.update(<Profile />));
      expect(form().props.openSection).toMatchObject({ section: 'identity', token: 1 });
      mockParams = { uredi: 'o-meni', n: '8' }; await act(async () => tree!.update(<Profile />));
      expect(form().props.openSection).toMatchObject({ section: 'identity', token: 2 });
      await act(async () => tree!.unmount()); tree = undefined;
      for (const params of [{ uredi: 'o-meni' }, { uredi: 'drugo', n: '1' }, {}]) {
        mockParams = params; await render();
        expect([JSON.stringify(params), form().props.reading, form().props.openSection]).toEqual([JSON.stringify(params), true, null]);
        await act(async () => tree!.unmount()); tree = undefined;
      }
    });
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
