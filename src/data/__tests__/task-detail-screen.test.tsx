import React from 'react';
// Catch an unisolated reader before it can create a live client under CI's public app configuration.
const mockUnexpectedClient = jest.fn(() => { throw new Error('UNMOCKED_SCREEN_TRANSPORT'); });
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => mockUnexpectedClient() }));
// Optional work-area/calendar reads have their own useTaskFit suite; here the task has no extra fit hint.
jest.mock('../../ui/v2/detail/useTaskFit', () => ({ useTaskFit: () => undefined }));
// The public Task now shows the requester's photograph in the card that opens their profile, so
// this suite renders `publicPhoto` on every pass instead of only when the profile sheet is open.
jest.mock('../../ui/media/ContextPhotos', () => ({ NeedPhotos: 'NeedPhotos', ProfilePhoto: 'ProfilePhoto' }));
// PKG-047: the screen resolves a safety target through the production client; this suite is about the task detail,
// so the entry stays absent here and the client module is never loaded.
jest.mock('../../ui/safety/useSafetyEntry', () => ({ useSafetyEntry: () => undefined }));
// The questions of the task have their own reader (owner, 2026-10-07: they are drawn on the task now). This suite is about the
// task detail, so the reader is a value the test moves and the transport behind it is never loaded; the reader has its own suite.
const mockQuestionsFor = jest.fn();
let mockQuestions: { state: unknown; retry: () => void } = { state: { phase: 'idle' }, retry: () => undefined };
jest.mock('../../ui/qa/useTaskQaInline', () => ({ useTaskQaInline: (...args: unknown[]) => { mockQuestionsFor(...args); return mockQuestions; } }));
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PrilikaProjekcija } from '../../contracts/projections';
import { buildQaInline } from '../../ui/qa/taskQaInlineModel';

let mockId: string | string[] | undefined = 'task-a';
let mockAccountId: string | undefined = 'account-a';
let mockEpoch = 1;
let mockAccountRevision = 1;
let mockIntent: 'uskocer' | 'narucilac' = 'uskocer';
let mockFocused = true;
import { taskRelationIndex } from '../taskRelation';
const mockLoad = jest.fn(), mockRelations = jest.fn();
// My relation to the task is read beside it, for this task alone (PKG-023b).
const mockSource = { prilika: mockLoad, odnosiPremaZadacima: mockRelations };
// The public work-trust read of the poster is a read of its own (and brings the whole transport with it): this suite is about the task's own lifecycle, so it stands in for it.
jest.mock('../../ui/profile/usePublicWorkTrust', () => ({ usePublicWorkTrust: () => null }));
// The server answers about the ids it was asked and no others, so the double never does either.
const relatesAs = (...rows: { needId: string }[]) => async (ids: readonly string[]) =>
  taskRelationIndex(rows.filter(row => ids.includes(row.needId)), ids);
const owner = (needId: string) => ({ needId, relation: 'OWNER', applicationId: null, applicationState: null, agreementId: null });
const applicant = (needId: string, applicationState: string, agreementId: string | null = null) =>
  ({ needId, relation: 'APPLIED', applicationId: 'application-a', applicationState, agreementId });
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockAppListeners = new Set<(value: string) => void>();

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return { addEventListener: (_event: string, callback: (value: string) => void) => {
      mockAppListeners.add(callback); return { remove: () => mockAppListeners.delete(callback) };
    } };
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]),
}));
jest.mock('../../store/sesija', () => ({
  useSesija: () => ({ user: mockAccountId ? { id: mockAccountId } : null, sessionEpoch: mockEpoch, accountRevision: mockAccountRevision }),
  sesijaSada: () => ({ user: mockAccountId ? { id: mockAccountId } : null, sessionEpoch: mockEpoch, accountRevision: mockAccountRevision }),
}));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent, useIzvor: () => mockSource }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));

import Detail from '../../app/(app)/prilike/[id]';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const detail = (id = 'task-a'): PrilikaProjekcija => ({
  id, naslov: `Zadatak ${id}`, statusTekst: 'Traži ponude', primaNovePrijave: true, rokZaPrijaveIso: null, podrucjeTekst: 'Centar, Novi Sad', vremeTekst: 'Fleksibilno',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: ['Alat'],
  narucilacProfilId: 'requester-a', narucilacIme: '', narucilacOcena: null, priblizno: null,
});
let tree: ReactTestRenderer | undefined;
async function render() { await act(async () => { tree = create(<Detail />); }); }
async function update() { await act(async () => { tree!.update(<Detail />); }); }
const text = () => tree!.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const buttons = (label: string) => tree!.root.findAllByProps({ label });
const back = () => tree!.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress();

beforeEach(() => {
  jest.clearAllMocks(); mockLoad.mockReset(); mockAppListeners.clear();
  mockQuestions = { state: { phase: 'idle' }, retry: () => undefined };
  mockRelations.mockReset().mockImplementation(relatesAs());
  mockId = 'task-a'; mockAccountId = 'account-a'; mockEpoch = 1; mockAccountRevision = 1; mockIntent = 'uskocer'; mockFocused = true;
  mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(async () => {
  await act(async () => { tree?.unmount(); }); tree = undefined; jest.useRealTimers();
  expect(mockUnexpectedClient).not.toHaveBeenCalled();
});

describe('W04 actual screen and focused read lifecycle', () => {
  it('shows recoverable read failure without transport details and serializes retry taps', async () => {
    const retry = deferred<PrilikaProjekcija>();
    mockLoad.mockRejectedValueOnce(new Error('secret transport internals')).mockReturnValueOnce(retry.promise);
    await render();
    expect(text()).toContain('Ne možemo da učitamo zadatak'); expect(text()).not.toContain('secret');
    expect(buttons('Pošalji ponudu')).toHaveLength(0);
    const press = buttons('Pokušaj ponovo')[0].props.onPress;
    await act(async () => { press(); press(); }); expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Učitavamo zadatak');
    await act(async () => retry.resolve(detail()));
    expect(text()).toContain('Zadatak task-a'); expect(buttons('Pošalji ponudu')).toHaveLength(1);
  });

  it('shows where the job is as an approximate pin, and shows no map when there is no point', async () => {
    // Until 2026-09-20 the place was four words of text on the screen where a person decides
    // whether a job is near enough to take. The point is deliberately coarse; the exact address
    // belongs to the Dogovor, so `coarse` must stay on and the pin must not be draggable.
    mockLoad.mockResolvedValue({ ...detail(), priblizno: { lat: 45.2671, lng: 19.8335 } });
    await render();
    // The section is "Mesto" (composition spec 2026-10-07, T3); it was "Mesto zadatka" and, before V41, "Gde je".
    expect(text()).toContain('Mesto');
    expect(text()).toContain('Tačna adresa: samo u Dogovoru'); expect(text()).not.toContain('Približno područje.');
    const map = tree!.root.findByProps({ coarse: true });
    expect(map.props.points).toEqual([{ id: 'area', label: 'Približno mesto', latitude: 45.2671, longitude: 19.8335 }]);
    expect(map.props.coarse).toBe(true);
    expect(map.props.route).toBeUndefined();

    await act(async () => { tree!.unmount(); }); tree = undefined;
    mockLoad.mockResolvedValue(detail());
    await render();
    expect(text()).not.toContain('Približno područje');
    expect(tree!.root.findAllByProps({ coarse: true })).toHaveLength(0);
  });

  it('opens the real composer once and never submits directly', async () => {
    mockLoad.mockResolvedValue(detail()); await render();
    const press = buttons('Pošalji ponudu')[0].props.onPress;
    await act(async () => { press(); press(); });
    expect(mockRouter.navigate.mock.calls).toEqual([[{ pathname: '/prilike/[id]/prijava', params: { id: 'task-a' } }]]);
  });

  it('retains only marked display data after a failed foreground refresh and invalidates old presses immediately', async () => {
    const refresh = deferred<PrilikaProjekcija>();
    mockLoad.mockResolvedValueOnce(detail()).mockReturnValueOnce(refresh.promise).mockResolvedValueOnce(detail());
    await render(); const stalePress = buttons('Pošalji ponudu')[0].props.onPress;
    await act(async () => { mockAppListeners.forEach(listener => listener('active')); stalePress(); });
    expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(buttons('Pošalji ponudu')).toHaveLength(0);
    expect(text()).toContain('Zadatak task-a'); expect(text()).toContain('Vidiš starije podatke');
    await act(async () => refresh.reject(new Error('offline')));
    expect(text()).toContain('Zadatak task-a'); expect(buttons('Pošalji ponudu')).toHaveLength(0);
    await act(async () => buttons('Pokušaj ponovo')[0].props.onPress());
    expect(text()).not.toContain('Vidiš starije podatke'); expect(buttons('Pošalji ponudu')).toHaveLength(1);
  });

  it('removes cached detail when a successful refresh says the row is unavailable', async () => {
    mockLoad.mockResolvedValueOnce(detail()).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline'));
    await render(); await act(async () => mockAppListeners.forEach(listener => listener('active')));
    expect(text()).toContain('Ovaj zadatak više nije dostupan'); expect(text()).not.toContain('Zadatak task-a');
    await act(async () => buttons('Pokušaj ponovo')[0].props.onPress());
    expect(text()).not.toContain('Zadatak task-a'); expect(buttons('Pošalji ponudu')).toHaveLength(0);
  });

  it.each([false, undefined])('fails closed for task-level availability %s', async primaNovePrijave => {
    mockLoad.mockResolvedValue({ ...detail(), primaNovePrijave }); await render();
    expect(text()).toContain('Zadatak task-a'); expect(buttons('Pošalji ponudu')).toHaveLength(0);
    expect(text()).toContain('Nove prijave trenutno nisu dostupne');
  });

  // Owner step 5b (2026-09-24): when applying is not possible the screen says why, from what this route already read, and
  // leads back to the other tasks once, through the same navigation fence as every other press.
  it('says why applying is not possible from the facts it read, and leads back to Zadaci once', async () => {
    mockLoad.mockResolvedValue({ ...detail(), rokZaPrijaveIso: '2000-01-01T00:00:00Z' }); await render();
    expect(buttons('Pošalji ponudu')).toHaveLength(0);
    expect(text()).toMatch(/Rok za prijave je prošao 1\. jan\.? 2000/); expect(text()).not.toContain('Prijave do');
    const other = buttons('Drugi zadaci')[0].props.onPress;
    await act(async () => { other(); other(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/zadaci']]);
    await act(async () => { tree?.unmount(); });
    mockLoad.mockResolvedValue({ ...detail(), primaNovePrijave: false, pokrivenost: { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 } }); await render();
    expect(text()).toContain('Sva mesta su popunjena'); expect(text()).not.toContain('Rok za prijave');
    // An unreadable deadline is not named as one.
    await act(async () => { tree?.unmount(); });
    mockLoad.mockResolvedValue({ ...detail(), rokZaPrijaveIso: 'invalid' }); await render();
    expect(text()).toContain('Nove prijave trenutno nisu dostupne'); expect(text()).not.toContain('Rok za prijave');
  });

  it.each([undefined, 'invalid', '2000-01-01T00:00:00Z'])('never offers the composer for unknown/expired deadline %s', async rokZaPrijaveIso => {
    mockLoad.mockResolvedValue({ ...detail(), rokZaPrijaveIso }); await render();
    expect(buttons('Pošalji ponudu')).toHaveLength(0);
  });

  it('expires the visible CTA without a network call and rejects a press before the timer paints', async () => {
    jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-07T12:00:00Z'));
    mockLoad.mockResolvedValue({ ...detail(), rokZaPrijaveIso: '2026-09-07T12:00:10Z' });
    await render(); const press = buttons('Pošalji ponudu')[0].props.onPress;
    jest.setSystemTime(new Date('2026-09-07T12:00:10Z'));
    await act(async () => press()); expect(mockRouter.navigate).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(10_000));
    expect(buttons('Pošalji ponudu')).toHaveLength(0);
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it('rejects a response that does not match the requested task', async () => {
    mockLoad.mockResolvedValue(detail('other-task')); await render();
    expect(text()).toContain('Ovaj zadatak više nije dostupan'); expect(text()).not.toContain('other-task');
    expect(buttons('Pošalji ponudu')).toHaveLength(0);
  });

  it('clears displayed A detail on id change and rejects A handlers', async () => {
    const b = deferred<PrilikaProjekcija>(); mockLoad.mockResolvedValueOnce(detail()).mockReturnValueOnce(b.promise);
    await render(); const oldPress = buttons('Pošalji ponudu')[0].props.onPress;
    mockId = 'task-b'; await update();
    expect(text()).not.toContain('Zadatak task-a'); expect(buttons('Pošalji ponudu')).toHaveLength(0);
    await act(async () => oldPress()); expect(mockRouter.navigate).not.toHaveBeenCalled();
    await act(async () => b.resolve(detail('task-b'))); expect(text()).toContain('Zadatak task-b');
  });

  it('invalidates a pending account A read when B signs in, even if A completes later', async () => {
    const a = deferred<PrilikaProjekcija>(); const b = deferred<PrilikaProjekcija>();
    mockLoad.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise); await render();
    mockAccountId = 'account-b'; mockEpoch++; await update();
    await act(async () => b.resolve({ ...detail(), naslov: 'Podaci za B' }));
    await act(async () => a.resolve({ ...detail(), naslov: 'Podaci za A' }));
    expect(text()).toContain('Podaci za B'); expect(text()).not.toContain('Podaci za A');
  });

  it('rejects the previous A read and press after A→B→A without rendering B', async () => {
    const oldRead = deferred<PrilikaProjekcija>();
    const currentRead = deferred<PrilikaProjekcija>();
    mockLoad.mockResolvedValueOnce(detail()).mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(currentRead.promise);
    await render(); const oldPress = buttons('Pošalji ponudu')[0].props.onPress;
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    mockAccountId = 'account-b'; mockEpoch++; mockAccountRevision++;
    mockAccountId = 'account-a'; mockEpoch++; mockAccountRevision++;
    await act(async () => oldPress());
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    await update();
    await act(async () => oldRead.resolve({ ...detail(), naslov: 'Prethodna sesija A' }));
    expect(text()).not.toContain('Prethodna sesija A');
    expect(text()).not.toContain('Zadatak task-a');
    expect(buttons('Pošalji ponudu')).toHaveLength(0);
    await act(async () => currentRead.resolve({ ...detail(), naslov: 'Nova sesija A' }));
    expect(text()).toContain('Nova sesija A');
    expect(buttons('Pošalji ponudu')).toHaveLength(1);
  });

  it('preserves W04 content and actions across token refresh for the same identity revision', async () => {
    mockLoad.mockResolvedValueOnce(detail());
    await render(); const oldPress = buttons('Pošalji ponudu')[0].props.onPress;
    mockEpoch++;
    await act(async () => oldPress());
    expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    await update();
    expect(mockAccountRevision).toBe(1);
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Zadatak task-a');
    expect(buttons('Pošalji ponudu')).toHaveLength(1);
  });

  it('blocks pre-render account changes and clears the display cache for a new session', async () => {
    mockLoad.mockResolvedValueOnce(detail()).mockRejectedValueOnce(new Error('offline'));
    await render(); const oldPress = buttons('Pošalji ponudu')[0].props.onPress;
    mockAccountId = 'account-b'; mockEpoch++;
    await act(async () => { oldPress(); back(); });
    expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
    await update(); expect(text()).not.toContain('Zadatak task-a');
  });

  it('does not reuse a detail or press across logout and a new session for the same account', async () => {
    mockLoad.mockResolvedValueOnce(detail()).mockRejectedValueOnce(new Error('offline'));
    await render(); const oldPress = buttons('Pošalji ponudu')[0].props.onPress;
    mockAccountId = undefined; mockEpoch++;
    await act(async () => oldPress()); expect(mockRouter.navigate).not.toHaveBeenCalled();
    await update(); expect(text()).not.toContain('Zadatak task-a');
    mockAccountId = 'account-a'; mockEpoch++; await update();
    expect(text()).not.toContain('Zadatak task-a'); expect(buttons('Pošalji ponudu')).toHaveLength(0);
    expect(mockLoad).toHaveBeenCalledTimes(2);
  });

  // Owner decision 1 (2026-09-19). Whether I may apply used to be decided by the mode of the app: in
  // the requester mode an open task told the person to go and change the mode in Profil. It is decided
  // by what I am to this task, read from my own tasks and my own applications.
  it('a flip of the retired app mode changes nothing: the task stays, and the application action still opens the composer', async () => {
    mockLoad.mockResolvedValue(detail());
    await render(); const oldPress = buttons('Pošalji ponudu')[0].props.onPress;
    mockIntent = 'narucilac'; await update();
    expect(text()).toContain('Zadatak task-a'); expect(buttons('Pošalji ponudu')).toHaveLength(1);
    await act(async () => oldPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/prilike/[id]/prijava', params: { id: 'task-a' } });
  });

  it('the same account opens its own task and then somebody else\u2019s, with no mode in between: one offers my view, the other an application', async () => {
    mockRelations.mockImplementation(relatesAs(owner('task-a'))); mockLoad.mockResolvedValue(detail());
    await render();
    expect(mockRelations).toHaveBeenCalledWith(['task-a']);
    expect(buttons('Pošalji ponudu')).toHaveLength(0); expect(text()).not.toContain('Ovo je tvoj zadatak.'); expect(text()).toContain('Tvoj zadatak');
    await act(async () => buttons('Otvori svoj zadatak')[0].props.onPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/pregled', params: { id: 'task-a' } });
    await act(async () => { tree?.unmount(); });
    mockId = 'task-b'; mockLoad.mockResolvedValue(detail('task-b')); await render();
    expect(text()).not.toContain('Ovo je tvoj zadatak.'); expect(buttons('Pošalji ponudu')).toHaveLength(1);
  });

  it('a task I already applied to offers my application, and my Dogovor once I am chosen; never a second application', async () => {
    mockRelations.mockImplementation(relatesAs(applicant('task-a', 'SUBMITTED'))); mockLoad.mockResolvedValue(detail());
    await render(); expect(buttons('Pošalji ponudu')).toHaveLength(0);
    await act(async () => buttons('Pogledaj svoju prijavu')[0].props.onPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/moje-prijave', params: { prijavaId: 'application-a' } });
    await act(async () => { tree?.unmount(); });
    mockRelations.mockImplementation(relatesAs(applicant('task-a', 'SELECTED', 'agreement-a'))); await render();
    await act(async () => buttons('Otvori Dogovor')[0].props.onPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'agreement-a' } });
  });

  it('a relation that could not be read never becomes a licence to apply', async () => {
    mockRelations.mockRejectedValue(new Error('TASK_RELATIONS_READ_FAILED')); mockLoad.mockResolvedValue(detail());
    await render();
    expect(text()).toContain('Zadatak task-a'); expect(buttons('Pošalji ponudu')).toHaveLength(0); expect(buttons('Proveri ponovo')).toHaveLength(1);
  });

  it('invalidates reads and actions on blur and rereads on focus', async () => {
    const late = deferred<PrilikaProjekcija>();
    mockLoad.mockResolvedValueOnce(detail()).mockReturnValueOnce(late.promise).mockResolvedValueOnce({ ...detail(), naslov: 'Sveži podaci' });
    await render(); const oldPress = buttons('Pošalji ponudu')[0].props.onPress;
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    mockFocused = false; await update(); await act(async () => { oldPress(); late.resolve({ ...detail(), naslov: 'Kasni podaci' }); });
    expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(text()).not.toContain('Kasni podaci');
    expect(mockAppListeners.size).toBe(0);
    mockFocused = true; await update(); expect(text()).toContain('Sveži podaci');
    expect(buttons('Pošalji ponudu')).toHaveLength(1);
  });
  it('makes a successful unavailable read finite, with Back and retry but no application action', async () => {
    mockLoad.mockResolvedValue(null); await render();
    expect(text()).toContain('Ovaj zadatak više nije dostupan');
    expect(text()).not.toContain('Učitavam');
    expect(buttons('Pošalji ponudu')).toHaveLength(0);
    await act(async () => back());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('keeps a malformed route unavailable without querying and falls back to W03', async () => {
    mockId = ['task-a', 'task-b']; mockRouter.canGoBack.mockReturnValue(false); await render();
    expect(mockLoad).not.toHaveBeenCalled(); expect(text()).toContain('Ovaj zadatak više nije dostupan');
    await act(async () => { back(); back(); });
    expect(mockRouter.replace.mock.calls).toEqual([['/zadaci']]);
  });

  it('keeps Back available while loading', async () => {
    mockLoad.mockReturnValue(new Promise(() => {})); await render();
    expect(text()).toContain('Učitavamo zadatak');
    expect(buttons('Pošalji ponudu')).toHaveLength(0);
    await act(async () => back()); expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('bounds a hanging read and ignores the expired result after explicit retry', async () => {
    jest.useFakeTimers();
    const old = deferred<PrilikaProjekcija>();
    mockLoad.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ ...detail(), naslov: 'Sveži Zadatak' });
    await render();
    await act(async () => jest.advanceTimersByTime(15_000));
    expect(text()).toContain('Ne možemo da učitamo zadatak');
    await act(async () => buttons('Pokušaj ponovo')[0].props.onPress());
    expect(text()).toContain('Sveži Zadatak');
    await act(async () => old.resolve({ ...detail(), naslov: 'Istekli Zadatak' }));
    expect(text()).not.toContain('Istekli Zadatak');
  });

  it('clears task A immediately on id B and ignores A finishing after B', async () => {
    const a = deferred<PrilikaProjekcija>(); const b = deferred<PrilikaProjekcija>();
    mockLoad.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise); await render();
    mockId = 'task-b'; await update();
    await act(async () => b.resolve(detail('task-b')));
    expect(text()).toContain('Zadatak task-b');
    await act(async () => a.resolve(detail()));
    expect(text()).not.toContain('Zadatak task-a'); expect(mockLoad.mock.calls).toEqual([['task-a'], ['task-b']]);
  });
});

// Owner, 2026-10-07: "u pregledu zadatka treba da se vidi pitanja koja je neko postavio, a na koja je odgovorio vlasnik zadatka".
// The questions were a link to another screen; they are drawn on the task now, after the work and before the poster, and the
// whole thread (asking, answering, the rest) is still the screen it always was, opened by the same route.
describe('the questions of the task, drawn on it', () => {
  const Q = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
  const answered = (n: number) => ({ questionId: Q(n), needRevision: 2, questionText: `Pitanje ${n}?`, answerVersion: 1, answerText: `Odgovor ${n}.`,
    edited: false, answeredAt: `2026-10-0${n}T09:00:00Z` });
  const waiting = (n: number) => ({ questionId: Q(n), needRevision: 2, questionText: `Pitanje ${n}?`, status: 'PENDING_ANSWER', createdAt: '2026-10-04T08:00:00Z',
    answerVersion: null, answerText: null, edited: false });
  const strangerSees = (rows: unknown[], canAsk = true, retry = jest.fn()) => ({ retry,
    state: { phase: 'ready', ...buildQaInline({ mode: 'PUBLIC', needRevision: 2, canAsk, canComposeAnswer: false }, rows as never[]) } });
  const ownerSees = (rows: unknown[], retry = jest.fn()) => ({ retry,
    state: { phase: 'ready', ...buildQaInline({ mode: 'OWNER', needRevision: 2, canAsk: false, canComposeAnswer: true }, rows as never[]) } });
  const press = (accessibilityLabel: string) => tree!.root.findAll(node => node.props.accessibilityLabel === accessibilityLabel);

  it('is asked about the task it shows once there is one, and never about a task that is not there', async () => {
    mockLoad.mockResolvedValue(detail()); await render();
    expect(mockQuestionsFor.mock.calls[0]).toEqual([null]);
    expect(mockQuestionsFor).toHaveBeenLastCalledWith('task-a');
    await act(async () => { tree?.unmount(); }); mockQuestionsFor.mockClear();
    mockLoad.mockResolvedValue(null); await render();
    expect(mockQuestionsFor.mock.calls.every(call => call[0] === null)).toBe(true);
  });

  it('draws no section while the reader has nothing, and the task is complete without it', async () => {
    mockLoad.mockResolvedValue(detail()); await render();
    expect(text()).not.toContain('Pitanja i odgovori'); expect(buttons('Pošalji ponudu')).toHaveLength(1);
  });

  it('reads the questions and the owner’s answers after the work, which comes after the poster (the owner’s pick of 8 Oct 2026)', async () => {
    mockQuestions = strangerSees([answered(1), answered(2)]);
    mockLoad.mockResolvedValue({ ...detail(), opis: 'Dva sprata bez lifta.', narucilacIme: 'Ana Anić' }); await render();
    const all = text();
    expect(all).toContain('2 pitanja · sva odgovorena'); expect(all).toContain('Pitanje 2?'); expect(all).toContain('Odgovor 2.');
    expect(all).toContain('Odgovor osobe koja je objavila zadatak');
    expect(all.indexOf('Ana Anić')).toBeLessThan(all.indexOf('Dva sprata bez lifta.'));
    expect(all.indexOf('Dva sprata bez lifta.')).toBeLessThan(all.indexOf('Pitanja i odgovori'));
    // The one green action is still the application; the section adds none.
    expect(buttons('Pošalji ponudu')).toHaveLength(1);
  });

  it('"Postavi pitanje" opens the whole thread once, through the screen’s own fence, for a stranger’s task', async () => {
    mockQuestions = strangerSees([answered(1)]);
    mockLoad.mockResolvedValue(detail()); await render();
    const ask = press('Postavi pitanje')[0].props.onPress;
    await act(async () => { ask(); ask(); });
    expect(mockRouter.navigate.mock.calls).toEqual([[{ pathname: '/pitanja-zadatka', params: { needId: 'task-a', own: '0' } }]]);
    expect(mockRouter.navigate).not.toHaveBeenCalledWith({ pathname: '/prilike/[id]/prijava', params: { id: 'task-a' } });
  });

  it('offers no question to a stranger the server does not allow to ask, and the notice stays in the whole thread', async () => {
    mockQuestions = strangerSees([answered(1)], false);
    mockLoad.mockResolvedValue(detail()); await render();
    expect(press('Postavi pitanje')).toHaveLength(0); expect(text()).not.toContain('Radni profil');
  });

  it('"Prikaži sva pitanja" appears with more than three questions and opens the same thread', async () => {
    mockQuestions = strangerSees([1, 2, 3, 4].map(answered), false);
    mockLoad.mockResolvedValue(detail()); await render();
    await act(async () => press('Prikaži sva pitanja (4)')[0].props.onPress());
    expect(mockRouter.navigate.mock.calls).toEqual([[{ pathname: '/pitanja-zadatka', params: { needId: 'task-a', own: '0' } }]]);
  });

  it('a press kept from before the task was read again opens nothing, and the section waits with the task', async () => {
    const again = deferred<PrilikaProjekcija>();
    mockQuestions = strangerSees([answered(1)]);
    mockLoad.mockResolvedValueOnce(detail()).mockReturnValueOnce(again.promise); await render();
    const kept = press('Postavi pitanje')[0].props.onPress;
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    expect(press('Postavi pitanje')).toHaveLength(0); expect(text()).not.toContain('Pitanje 1?');
    await act(async () => kept());
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    await act(async () => again.resolve(detail()));
    expect(text()).toContain('Pitanje 1?'); expect(press('Postavi pitanje')).toHaveLength(1);
  });

  it('a press is refused after the account changed', async () => {
    mockQuestions = strangerSees([answered(1)]);
    mockLoad.mockResolvedValue(detail()); await render();
    const kept = press('Postavi pitanje')[0].props.onPress;
    mockAccountId = 'account-b'; mockEpoch++; mockAccountRevision++;
    await act(async () => kept());
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('a questions read that failed says so on the section, reads again on request, and leaves the task working', async () => {
    const retry = jest.fn();
    mockQuestions = { retry, state: { phase: 'error', message: 'Pitanja trenutno nisu učitana. Proveri vezu i pokušaj ponovo.' } };
    mockLoad.mockResolvedValue(detail()); await render();
    expect(text()).toContain('Pitanja trenutno nisu učitana.'); expect(text()).not.toContain('Još nema pitanja');
    await act(async () => buttons('Učitaj pitanja ponovo')[0].props.onPress());
    expect(retry).toHaveBeenCalledTimes(1); expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(buttons('Pošalji ponudu')).toHaveLength(1);
  });

  it('the owner looking at his own task as others see it is sent to his side of the thread', async () => {
    mockQuestions = ownerSees([waiting(1)]);
    mockRelations.mockImplementation(relatesAs(owner('task-a'))); mockLoad.mockResolvedValue(detail()); await render();
    await act(async () => press('Odgovori na pitanje: Pitanje 1?')[0].props.onPress());
    expect(mockRouter.navigate.mock.calls).toEqual([[{ pathname: '/pitanja-zadatka', params: { needId: 'task-a', own: '1', questionId: waiting(1).questionId } }]]);
  });
});
