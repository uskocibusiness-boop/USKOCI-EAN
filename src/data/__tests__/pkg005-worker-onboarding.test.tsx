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
// Mode loading has its own ownership/revision suite; this route harness must not start Auth or native storage.
jest.mock('../../hooks/useWorkerExecutionModes', () => ({
  useWorkerExecutionModes: () => ({ view: { kind: 'confirmed', modes: ['ON_SITE'] }, refresh: jest.fn() }),
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
import { takeAiCorrection } from '../aiCorrectionIntent';

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
async function render() { await act(async () => { tree = create(<Profile />); }); await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountId = '10000000-0000-4000-8000-000000000001'; mockAccountRevision = 1; mockAccountName = { state: 'ready', name: 'Ana' }; mockParams = {};
  readProfile.mockReset(); writeProfile.mockReset().mockResolvedValue({ ok: true, podatak: null });
});
afterEach(async () => { if (tree) await act(async () => tree?.unmount()); tree = undefined; });

describe('PKG-005 progressive Worker onboarding', () => {
  it('a pristine DRAFT has one AI continuation and contextual AI edits without direct activation or draft save', async () => {
    readProfile.mockResolvedValue(readyDraft()); await render();
    expect(form().props.reading).toBe(true);
    expect(form().props.openConversation).toEqual(expect.any(Function));
    expect(form().props.showConversationAction).toBe(false);
    expect(tree!.root.findAll(node => String(node.type) === 'V2Action' && node.props.label === 'Nastavi kroz razgovor')).toHaveLength(1);
    expect(action('Sačuvaj kao nacrt')).toBeUndefined(); expect(action('Proveri i aktiviraj profil')).toBeUndefined();
    await act(async () => action('Nastavi kroz razgovor').props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('/profil/razgovor'); expect(writeProfile).not.toHaveBeenCalled();
    mockNavigate.mockClear();
    await act(async () => form().props.openConversation('area'));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenLastCalledWith({ pathname: '/profil/razgovor', params: { aiCorrection: expect.any(String) } });
    const token = mockNavigate.mock.calls[0][0].params.aiCorrection;
    expect(takeAiCorrection(token, { accountId: mockAccountId, accountRevision: mockAccountRevision }, 'worker',
      '30000000-0000-4000-8000-000000000001')).toMatchObject({ target: 'worker.area' });
    expect(form().props.reading).toBe(true); expect(form().props.openSection).toBeUndefined();
    expect(writeProfile).not.toHaveBeenCalled();
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
it('opens contextual AI edits without exposing manual fields or writing', async () => {
 readProfile.mockResolvedValue(readyDraft({stanje:'ACTIVE'})); await render(); expect(form().props.aiOnly).toBe(true);
 for(const part of ['tools','vehicles']) { await act(async()=>form().props.onEditPart(part));
 const route=mockNavigate.mock.calls.at(-1)![0]; expect(takeAiCorrection(route.params.aiCorrection,{accountId:mockAccountId,accountRevision:mockAccountRevision},'worker','30000000-0000-4000-8000-000000000001')?.target).toBe('worker.tools'); }
 expect(form().props.reading).toBe(true); expect(writeProfile).not.toHaveBeenCalled();
});


    it('does not open a part while the screen cannot take a tap: a save is in flight', async () => {
      let finish!: (value: unknown) => void;
      writeProfile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
      readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE', ime: 'Pera peric' })); mockAccountName = { state: 'ready', name: 'Milos' };
      await render();
      await act(async () => { void form().props.onUseAccountName(); });
      await act(async () => form().props.onEditPart('skills'));
      expect(form().props.openSection).toBeUndefined();
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

    it('hands the form saved availability and an AI edit action only for an active profile', async () => {
      readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE', dostupanOdmah: true })); await render();
      expect(form().props.availableNow).toMatchObject({ value: true }); expect(typeof form().props.availableNow.onEdit).toBe('function');
      await act(async () => tree!.unmount()); tree = undefined;
      for (const stanje of ['DRAFT', 'SUSPENDED'] as const) {
        readProfile.mockResolvedValue(readyDraft({ stanje })); await render();
        expect([stanje, form().props.availableNow]).toEqual([stanje, undefined]);
        await act(async () => tree!.unmount()); tree = undefined;
      }
    });

    it('returns the legacy "O meni" link to the AI conversation once per nonce without opening or saving a manual editor', async () => {
      mockParams = { uredi: 'o-meni', n: '7' }; readProfile.mockResolvedValue(readyDraft({ stanje: 'ACTIVE' })); await render();
      expect(form().props.reading).toBe(true); expect(form().props.openSection).toBeUndefined();
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenLastCalledWith({ pathname: '/profil/razgovor', params: { aiCorrection: expect.any(String) } });
      // Rendering again with the same link must not consume a second correction intent.
      await act(async () => tree!.update(<Profile />));
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      mockParams = { uredi: 'o-meni', n: '8' }; await act(async () => tree!.update(<Profile />));
      expect(mockNavigate).toHaveBeenCalledTimes(2);
      expect(form().props.reading).toBe(true); expect(writeProfile).not.toHaveBeenCalled();
      await act(async () => tree!.unmount()); tree = undefined;
      for (const params of [{ uredi: 'o-meni' }, { uredi: 'drugo', n: '1' }, {}]) {
        mockNavigate.mockClear();
        mockParams = params; await render();
        expect([JSON.stringify(params), form().props.reading, form().props.openSection]).toEqual([JSON.stringify(params), true, undefined]);
        expect(mockNavigate).not.toHaveBeenCalled();
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
