import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockRead = jest.fn(), mockWithdraw = jest.fn(), mockResolve = jest.fn(), mockInterval = jest.fn(), mockCommandState = jest.fn();
const mockSource = { mojePrijave: mockRead, povuciPrijavu: mockWithdraw };
const mockRouter = { navigate: jest.fn(), push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
let mockFocused = true, mockRole = 'uskocer';
let mockParams: { prijavaId?: string; nova?: string } = {};
let mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 };
let mockState = 'active';
const mockListeners = new Set<(state: string) => void>();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'AppState') return { currentState: mockState, addEventListener: (_: string, listener: any) => {
      mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) };
    } };
    if (key === 'FlatList') return (props: any) => require('react').createElement('FlatList', props, props.ListHeaderComponent,
      ...(props.data.length ? props.data.slice(0, props.initialNumToRender).map((item: any) => require('react').createElement(require('react').Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item }))) : [props.ListEmptyComponent]));
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, useUloga: () => mockRole, ulogaSada: () => mockRole }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockAccount, sesijaSada: () => mockAccount }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'Bell' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
jest.mock('../ru4Production', () => ({ ru4Production: { resolveChangedApplication: (...args: any[]) => mockResolve(...args) } }));
jest.mock('../myApplicationsClientService', () => ({ readExistingApplicationInterval: (...args: any[]) => mockInterval(...args),
  readApplicationCommandState: (...args: any[]) => mockCommandState(...args) }));
import Screen from '../../app/(app)/moje-prijave';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';
import { poruka } from '../../ui/system/Poruka';
const row = (overrides: any = {}) => ({ prijavaId: '10000000-0000-4000-8000-000000000001', potrebaId: '10000000-0000-4000-8000-000000000002',
  potrebaRevizija: 4, prijavaRevizija: 4, prijavaVerzija: 2, stanje: 'SUBMITTED', naslov: 'Unos ormara', opis: 'Dvoje ljudi i trake.',
  cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' }, pokrivaMesta: 2, napomena: 'Sa trakama.', podrucjeTekst: 'Liman, Novi Sad',
  vremeTekst: '20. septembar · 10–11h', dogovorId: null, promenjenaPotreba: false, mozePovuci: true, traziPaznju: false, ...overrides });
const stale = () => row({ stanje: 'STALE_REVIEW_REQUIRED', prijavaRevizija: 3, promenjenaPotreba: true, mozePovuci: false, traziPaznju: true });
const pricing = { rezimCene: 'OFFERS', pokrivenost: { ukupno: 3 } };
const interval = { start: '2026-09-20T10:00:00.123456Z', end: '2026-09-20T11:00:00.654321Z', pricing };
const commandState = (p = row(), extra = {}) => ({ applicationId: p.prijavaId, needId: p.potrebaId,
  version: p.prijavaVerzija, submittedNeedRevision: p.prijavaRevizija, status: p.stanje,
  priceRsd: p.cena.iznos, coveredSlots: p.pokrivaMesta, scopeNote: p.napomena,
  proposedStartAt: interval.start, proposedEndAt: interval.end, ...extra });
let mockRows: any[] = [], tree: ReactTestRenderer | undefined;
// What the person reads: the screen, and the app's one bar (Poruka). The outcome of a withdrawal or a keep is said there, not on the screen: the
// (app) layout's host draws it over this screen, and the store it reads is the same one these tests ask.
const text = () => tree!.root.findAll(n => String(n.type) === 'T').flatMap(n => n.children.filter(c => typeof c === 'string')).concat(poruka.current()?.text ?? []).join(' ');
const press = (label: string) => tree!.root.findAll(n => String(n.type) === 'Press' && n.props.accessibilityLabel === label)[0]?.props.onPress;
const tap = async (label: string) => { const f = press(label); expect(f).toBeDefined(); await act(async () => f()); };
const edit = async (label: string, value: string) => { await act(async () => tree!.root.findAll(n => String(n.type) === 'TextInput' && n.props.accessibilityLabel === label)[0].props.onChangeText(value)); };
const render = async () => { await act(async () => { tree = create(<Screen />); }); };
const update = async () => { await act(async () => tree!.update(<Screen />)); };
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { resolve, promise }; };
// The withdrawal question was Alert.alert and is an in-app ConfirmSheet now. `confirm()` is the sheet's confirm button, so a
// test presses what a person presses; `retained()` is the screen's own answer as the sheet holds it (the same closure the
// Alert used to get), for the tests that fire an answer after the screen has retired its question.
const sheet = () => tree!.root.findByType(ConfirmSheet);
const sheets = () => tree!.root.findAllByType(ConfirmSheet);
const confirm = () => { const open = sheet(); expect(open.props).toMatchObject({ title: 'Povući prijavu?', confirmLabel: 'Povuci prijavu', cancelLabel: 'Odustani', tone: 'danger' });
  return open.findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress; };
const cancel = () => sheet().findByProps({ testID: 'confirm-sheet-cancel' }).props.onPress;
const retained = () => sheet().props.onConfirm;
const background = async (state: string) => { await act(async () => { mockState = state; mockListeners.forEach(f => f(state)); }); };
// Review r4 item 1: the review foot's spoken name starts with its visible words (WCAG 2.5.3). It was
// "Pregledaj izmene: Unos ormara"; the same foot, the same guarded command.
const REVIEW_FOOT = 'Pregledaj izmene zadatka: Unos ormara';
async function review() { mockRows = [stale()]; await render(); await tap(REVIEW_FOOT); }
async function editing() { await review(); await tap('Izmeni prijavu'); }
beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true; mockState = 'active'; mockRole = 'uskocer'; mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 };
  mockParams = {};
  mockRows = [row()]; mockRead.mockImplementation(async () => mockRows);
  mockWithdraw.mockImplementation(async () => { mockRows = [row({ stanje: 'WITHDRAWN', mozePovuci: false })]; return { ok: true, podatak: { stanje: 'WITHDRAWN', verzija: 2 } }; });
  mockResolve.mockImplementation(async () => { mockRows = [row({ prijavaVerzija: 3 })]; return { ok: true, podatak: { status: 'SUBMITTED', version: 3 } }; });
  mockInterval.mockResolvedValue({ ok: true, podatak: interval });
  mockCommandState.mockImplementation(async (p: any) => {
    const found = mockRows.find(r => r.prijavaId === p.prijavaId && r.potrebaId === p.potrebaId);
    return found ? { ok: true, podatak: commandState(found) } : { ok: false, kod: 'APPLICATION_STATE_UNAVAILABLE', poruka: 'unavailable' };
  });
});
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; jest.useRealTimers(); poruka.hide(); });
it('renders the real empty state and uses the existing discovery route', async () => {
  // Step 5c: the old title "Tvoja sledeća prilika." was the pinned look; the first run is now the one StateView.
  mockRows = []; await render(); expect(text()).toContain('Još nemaš prijavu'); await tap('Pronađi zadatak'); expect(mockRouter.navigate).toHaveBeenCalledWith('/zadaci');
  // The first encounter ("Predmet vrata", the owner's pick of 2026-10-08): the price tag at the size of a door and the one way on (the approved draft U8:
  // an object and "Pronađi zadatak"; the sentence that taught is gone).
  expect(text()).not.toContain('Kad se prijaviš na zadatak');
  expect(tree!.root.findAll(node => typeof node.type !== 'string' && node.props.kind === 'offers' && node.props.size === 144)).toHaveLength(1);
});


it('reconfirmation calculates the task per-person price for the current headcount and locks manual price edits', async () => {
  mockInterval.mockResolvedValue({ ok: true, podatak: { ...interval, pricing: {
    rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 5000 }, pokrivenost: { ukupno: 3 },
  } } });
  await editing();
  const field = () => tree!.root.findAll(n => String(n.type) === 'TextInput' && n.props.accessibilityLabel === 'Cena ponude (RSD)')[0];
  expect(field().props.editable).toBe(false); expect(field().props.value).toBe('10000');
  await edit('Broj ljudi', '3'); expect(field().props.value).toBe('15000');
  // Even an old retained text callback cannot override the server-bound fixed price.
  await edit('Cena ponude (RSD)', '1'); expect(field().props.value).toBe('15000');
  await tap('Sačuvaj izmenjenu prijavu');
  expect(mockResolve.mock.calls[0][0]).toMatchObject({ akcija: 'UPDATE', cenaRsd: 15000, pokrivenaMesta: 3,
    ocekivanaPotrebaRevizija: 4, predlozeniPocetak: interval.start, predlozeniKraj: interval.end });
});
it('reconfirmation shares a total-price task by the chosen headcount', async () => {
  mockInterval.mockResolvedValue({ ok: true, podatak: { ...interval, pricing: {
    rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL', ponudjenaCena: { iznos: 9000 }, pokrivenost: { ukupno: 3 },
  } } });
  await editing();
  const people = tree!.root.findAll(n => String(n.type) === 'TextInput' && n.props.accessibilityLabel === 'Broj ljudi')[0];
  expect(people.props.editable).toBe(true); expect(people.props.value).toBe('2');
  await tap('Jedna osoba manje'); await edit('Cena ponude (RSD)', '1');
  await tap('Sačuvaj izmenjenu prijavu');
  expect(mockResolve.mock.calls[0][0]).toMatchObject({ akcija: 'UPDATE', cenaRsd: 3000, pokrivenaMesta: 1 });
});
it('keeps an uncomputable fixed-price edit unsent and recovers with a valid headcount', async () => {
  mockInterval.mockResolvedValue({ ok: true, podatak: { ...interval, pricing: {
    rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL', ponudjenaCena: { iznos: 1 }, pokrivenost: { ukupno: 3 },
  } } });
  await editing(); await edit('Broj ljudi', '1');
  const save = () => tree!.root.findAll(n => String(n.type) === 'Press' && n.props.accessibilityLabel === 'Sačuvaj izmenjenu prijavu')[0];
  expect(save().props.disabled).toBe(true);
  await act(async () => save().props.onPress());
  expect(mockResolve).not.toHaveBeenCalled();
  expect(text()).toContain('Cena za ovaj broj ljudi mora biti najmanje 1 RSD. Proveri broj ljudi.');
  await edit('Broj ljudi', '3'); expect(save().props.disabled).toBe(false);
  await tap('Sačuvaj izmenjenu prijavu');
  expect(mockResolve.mock.calls[0][0]).toMatchObject({ akcija: 'UPDATE', cenaRsd: 1, pokrivenaMesta: 3 });
});
it('a definite price refusal leads to review after readback, without treating the result as a network loss', async () => {
  mockResolve.mockResolvedValueOnce({ ok: false, kod: 'FIXED_PRICE_MISMATCH', poruka: 'hidden backend detail' });
  await review(); await tap('Zadrži prijavu');
  expect(text()).toContain('Cena prijave mora da prati cenu zadatka i broj ljudi koje obezbeđuješ');
  expect(text()).not.toContain('hidden backend detail'); expect(text()).not.toContain('Ne znamo da li je radnja uspela');
  await tap('Proveri da li je poslato'); expect(press('Pošalji ponovo')).toBeUndefined();
  await tap('Pregledaj trenutnu prijavu'); await tap(REVIEW_FOOT); await tap('Izmeni prijavu');
  expect(press('Sačuvaj izmenjenu prijavu')).toBeDefined();
});
it('parts the applications into Čeka odgovor, Izabrana and Završene without changing their status, and draws no tabs', async () => {
  mockRows = [stale(), row({ prijavaId: 'closed', naslov: 'Završena ponuda', stanje: 'CLOSED', mozePovuci: false }),
    row({ prijavaId: 'chosen', naslov: 'Izabrana ponuda', stanje: 'SELECTED', dogovorId: 'agreement-9', mozePovuci: false })];
  mockRows[0].prijavaId = 'stale'; await render();
  // The groups, in the draft's order, each with its count.
  const heads = tree!.root.findAll(n => String(n.type) === 'T' && n.props.accessibilityRole === 'header').map(n => n.props.children).filter(c => / · \d+$/.test(String(c)));
  expect(heads).toEqual(['Čeka odgovor · 1', 'Izabrana · 1', 'Završene · 1']);
  expect(tree!.root.findAll(n => n.props.accessibilityRole === 'tab')).toHaveLength(0);
  const copy = text();
  expect(copy).toContain('Zadatak je izmenjen.'); expect(copy.indexOf('Čeka odgovor')).toBeLessThan(copy.indexOf('Izabrana'));
  expect(copy.indexOf('Izabrana ponuda')).toBeLessThan(copy.indexOf('Završene')); expect(copy).toContain('Završena ponuda');
  expect(copy).not.toMatch(/Čeka te|Aktivne/);
});
it('opens the one application a notification names, and keeps it closed once closed', async () => {
  // "Zadatak je izmenjen" landed on the list and stopped there. The event knows which application
  // it is about, so the row it means is open on arrival — with its review, not just its summary.
  mockRows = [row({ prijavaId: 'other', naslov: 'Druga ponuda' }), stale()];
  mockParams = { prijavaId: stale().prijavaId };
  await render();
  expect(text()).toContain('Dvoje ljudi i trake.');
  expect(press('Zadrži prijavu')).toBeDefined();

  // Closing it is the person's decision; the next read does not reopen it.
  await tap('Zatvori pregled izmena');
  expect(press('Zadrži prijavu')).toBeUndefined();
  await act(async () => { mockListeners.forEach(f => f('active')); });
  expect(press('Zadrži prijavu')).toBeUndefined();
});

it('a named submitted application is immediately visible beyond the initial viewport without stale commands', async () => {
  mockRows = [...Array.from({ length: 15 }, (_, i) => row({ prijavaId: `other-${i}`, naslov: `Druga ponuda ${i}` })), row({ naslov: 'Baš poslata ponuda' })];
  mockParams = { prijavaId: row().prijavaId }; await render();
  expect(text()).toContain('Baš poslata ponuda'); expect(text()).toContain('Sa trakama.');
  expect(press('Zadrži prijavu')).toBeUndefined(); expect(press('Izmeni prijavu')).toBeUndefined();
  expect(press('Povuci izmenjenu prijavu')).toBeUndefined();
  expect(mockResolve).not.toHaveBeenCalled(); expect(mockWithdraw).not.toHaveBeenCalled();
});
it('a new application destination opens its review in the list that is already there, without a new read, and closing it is the person\'s decision', async () => {
  mockRows = [row({ prijavaId: 'other', naslov: 'Druga ponuda' }), stale()];
  await render();
  expect(press('Zadrži prijavu')).toBeUndefined();
  const reads = mockRead.mock.calls.length;
  mockParams = { prijavaId: stale().prijavaId }; await update();
  expect(text()).toContain('Zadatak je izmenjen.'); expect(press('Zadrži prijavu')).toBeDefined();
  expect(mockRead).toHaveBeenCalledTimes(reads);
  await tap('Zatvori pregled izmena'); await update();
  expect(press('Zadrži prijavu')).toBeUndefined();
  expect(mockResolve).not.toHaveBeenCalled(); expect(mockWithdraw).not.toHaveBeenCalled();
});

// The approved draft U8: the application that has just been sent is marked once, from its receipt, and a notification marks nothing.
it('marks the application that was just sent ("Poslata · upravo") when the list is opened from its receipt, first in its group, and not when a notification names it', async () => {
  mockRows = [row({ prijavaId: 'other', naslov: 'Druga ponuda' }), row({ naslov: 'Baš poslata ponuda' })];
  mockParams = { prijavaId: row().prijavaId, nova: '1' }; await render();
  const chips = () => tree!.root.findAll(n => String(n.type) === 'View' && n.props.testID === 'status-chip').map(n => n.props.accessibilityLabel);
  expect(chips()).toEqual(['Poslata, upravo', 'Poslata']);
  expect(text().indexOf('Baš poslata ponuda')).toBeLessThan(text().indexOf('Druga ponuda'));
  expect(tree!.root.findAll(n => String(n.type) === 'Press' && n.props.accessibilityLabel === 'Otvori zadatak: Baš poslata ponuda')[0].props.accessibilityValue.text).toContain('Poslata, upravo');
  await act(async () => tree!.unmount()); tree = undefined;
  mockParams = { prijavaId: row().prijavaId }; await render();
  expect(chips()).toEqual(['Poslata', 'Poslata']); expect(text()).not.toContain('upravo');
});
it('waits for the current read before consuming a named application destination', async () => {
  const late = deferred();
  mockRows = [row({ prijavaId: 'other', naslov: 'Druga ponuda' }), stale()];
  await render();
  mockRead.mockReturnValueOnce(late.promise);
  await background('background'); await background('active');
  mockParams = { prijavaId: stale().prijavaId }; await update();
  expect(press('Zadrži prijavu')).toBeUndefined();
  await act(async () => late.resolve(mockRows));
  expect(press('Zadrži prijavu')).toBeDefined();
  expect(mockResolve).not.toHaveBeenCalled(); expect(mockWithdraw).not.toHaveBeenCalled();
});
it('a missing named application gives an honest refresh path without opening a different row', async () => {
  mockRows = [row({ prijavaId: 'other', naslov: 'Druga ponuda' })]; mockParams = { prijavaId: row().prijavaId };
  await render(); expect(text()).toContain('Ova prijava trenutno nije dostupna');
  expect(press('Zadrži prijavu')).toBeUndefined(); await tap('Osveži prijave');
  expect(mockRead).toHaveBeenCalledTimes(2); expect(mockResolve).not.toHaveBeenCalled();
});
it('routes only a selected row to its exact existing Agreement', async () => {
  mockRows = [row({ stanje: 'SELECTED', dogovorId: 'agreement-123', mozePovuci: false, traziPaznju: true })]; await render();
  const old = press('Otvori Dogovor: Unos ormara'); await tap('Otvori Dogovor: Unos ormara'); expect(mockRouter.push).toHaveBeenCalledWith('/dogovor/agreement-123');
  mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 }; await update(); await act(async () => old()); expect(mockRouter.push).toHaveBeenCalledTimes(1);
});
// Step 5c: the card's one foot action is a quiet row link beside its body. These pin that the new link still reaches the
// screen's own confirmation and guards, not a shortcut around them.
it('the withdraw foot link still reaches its confirmation; nothing is sent until it is confirmed', async () => {
  await render(); expect(sheets()).toHaveLength(0);
  await tap('Povuci prijavu: Unos ormara');
  expect(sheets()).toHaveLength(1); expect(mockWithdraw).not.toHaveBeenCalled();
  await act(async () => confirm()());
  expect(mockWithdraw).toHaveBeenCalledTimes(1); expect(mockWithdraw.mock.calls[0][0]).toMatchObject({ prijavaId: row().prijavaId, prijavaVerzija: 2 });
});
it('the Dogovor foot link uses the existing guard: refused while another command waits for its readback, then opens its own Dogovor', async () => {
  const held = deferred(); mockWithdraw.mockReturnValueOnce(held.promise);
  mockRows = [row({ prijavaId: 'chosen', naslov: 'Izabrani posao', stanje: 'SELECTED', dogovorId: 'agreement-9', mozePovuci: false, traziPaznju: true }), row()];
  await render(); await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  // The command is in flight: the link is drawn disabled, and even its handler, called anyway, is refused by the screen.
  const link = tree!.root.findAll(n => String(n.type) === 'Press' && n.props.accessibilityLabel === 'Otvori Dogovor: Izabrani posao')[0];
  expect(link.props.disabled).toBe(true);
  await act(async () => link.props.onPress()); expect(mockRouter.push).not.toHaveBeenCalled();
  await act(async () => { mockRows = [mockRows[0], row({ stanje: 'WITHDRAWN', mozePovuci: false })]; held.resolve({ ok: true, podatak: { stanje: 'WITHDRAWN', verzija: 2 } }); });
  await tap('Otvori Dogovor: Izabrani posao'); expect(mockRouter.push).toHaveBeenCalledWith('/dogovor/agreement-9');
  // A chosen application whose Dogovor the read did not name offers no link at all.
  mockRows = [row({ stanje: 'SELECTED', dogovorId: null, mozePovuci: false, traziPaznju: true })];
  await act(async () => tree!.root.findByType('FlatList' as any).props.onRefresh());
  expect(press('Otvori Dogovor: Unos ormara')).toBeUndefined();
});
it('requires a visible stale review, then KEEP preserves null-ignored fields and exact versions', async () => {
  mockRows = [stale()]; await render(); expect(press('Zadrži prijavu')).toBeUndefined(); await tap(REVIEW_FOOT);
  expect(text()).toContain('Dvoje ljudi i trake.'); expect(text()).toContain('20. septembar');
  const keep = press('Zadrži prijavu'); await act(async () => { keep(); keep(); }); expect(mockResolve).toHaveBeenCalledTimes(1);
  expect(mockResolve.mock.calls[0][0]).toMatchObject({ akcija: 'KEEP', ocekivanaVerzija: 2, ocekivanaPotrebaRevizija: 4, cenaRsd: null, napomena: null });
  expect(mockRead).toHaveBeenCalledTimes(2); expect(text()).toContain('Prijava je ažurirana');
});
it('updates price, people and note while preserving the exact existing interval including microseconds', async () => {
  await editing(); expect(mockInterval).toHaveBeenCalledWith(stale()); expect(text()).toContain('Ponuđeni termin ostaje nepromenjen');
  await edit('Cena ponude (RSD)', '5600'); await edit('Broj ljudi', '3'); await edit('Napomena uz ponudu', '  Donosimo nove trake.  ');
  await tap('Sačuvaj izmenjenu prijavu'); expect(mockResolve.mock.calls[0][0]).toMatchObject({ akcija: 'UPDATE', cenaRsd: 5600, pokrivenaMesta: 3,
    napomena: 'Donosimo nove trake.', predlozeniPocetak: interval.start, predlozeniKraj: interval.end });
});
it('shows an interval inside one minute as one time, with an honest unknown timezone and the existing people plural', async () => {
  mockRows = [stale()]; mockRows[0].pokrivaMesta = 12;
  mockInterval.mockResolvedValue({ ok: true, podatak: { start: '2026-09-20T10:00:00.000001Z', end: '2026-09-20T10:00:00.000009Z', pricing } });
  await render(); await tap(REVIEW_FOOT); await tap('Izmeni prijavu');
  expect(text()).toMatch(/20\. sep( 2026)? · 10:00/); expect(text()).not.toContain('10:00–10:00'); expect(text()).not.toContain('10:00:00');
  expect(text()).not.toContain('zona nije navedena'); expect(text()).toContain('12 osoba'); expect(text()).not.toContain('12 osobe');
});
it('does not infer a missing interval as null and refuses editing after an interval read failure', async () => {
  mockInterval.mockResolvedValue({ ok: false, kod: 'CHANGED', poruka: 'private raw error' }); await editing();
  expect(press('Sačuvaj izmenjenu prijavu')).toBeUndefined(); expect(text()).toContain('Ne možemo da prikažemo termin i cenu prijave'); expect(text()).not.toContain('private raw'); expect(mockResolve).not.toHaveBeenCalled();
});
it('accepts an explicitly read null interval without inventing a time', async () => {
  mockInterval.mockResolvedValue({ ok: true, podatak: { start: null, end: null, pricing } }); await editing(); await tap('Sačuvaj izmenjenu prijavu');
  expect(mockResolve.mock.calls[0][0]).toMatchObject({ predlozeniPocetak: null, predlozeniKraj: null, napomena: 'Sa trakama.' });
});
it('rejects trailing price garbage and fractional people instead of silently coercing', async () => {
  await editing(); await edit('Cena ponude (RSD)', '5000x'); await tap('Sačuvaj izmenjenu prijavu'); expect(mockResolve).not.toHaveBeenCalled();
  await edit('Cena ponude (RSD)', '5000'); await edit('Broj ljudi', '1.5'); await tap('Sačuvaj izmenjenu prijavu'); expect(mockResolve).not.toHaveBeenCalled();
});
it('withdraws only after explicit confirmation, fences double taps, and reads before success', async () => {
  await render(); await tap('Povuci prijavu: Unos ormara'); expect(mockWithdraw).not.toHaveBeenCalled(); const send = confirm();
  // The question names the task and says what follows, for the other person and for the worker (plan 2.3); it asks for no reason, because the command takes none.
  expect(sheet().props.message).toBe('Osoba koja je objavila zadatak više ne vidi tvoju ponudu za „Unos ormara”. Ako zadatak i dalje prima prijave, možeš da pošalješ novu.');
  // No internal name of a side of a task is ever shown (V3 rule): not "Naručilac", not "Uskočer".
  expect(sheet().props.message).not.toMatch(/Naruči|naruči|Uskočer|uskočer/);
  expect(sheet().props.form).toBeUndefined(); expect(sheet().props.extra).toBeUndefined();
  expect(poruka.current()).toBeNull();
  await act(async () => { send(); send(); }); expect(mockWithdraw).toHaveBeenCalledTimes(1); expect(mockWithdraw.mock.calls[0][0]).toMatchObject({ potrebaRevizija: 4, prijavaVerzija: 2, razlog: null });
  expect(mockRead).toHaveBeenCalledTimes(2); expect(text()).toContain('Prijava je povučena.');
  // Said once, in the app's one bar, after the readback confirmed it, as a confirmed outcome; nothing undoes a withdrawal, so no "Vrati".
  expect(poruka.current()).toMatchObject({ text: 'Prijava je povučena.', confirmed: true }); expect(poruka.current()?.action).toBeUndefined();
});
it('the screen\'s own answer, fired twice in one tick, withdraws once: the screen\'s idle check and the editor\'s write lock', async () => {
  // Pressing the sheet's confirm twice is stopped by the sheet itself. This calls the answer the screen handed the sheet
  // twice. This screen has no dialog token: the second call is refused because the first one already made the screen
  // busy (`idle()` sees its pending command) and holds the editor's write lock.
  const held = deferred(); mockWithdraw.mockReturnValueOnce(held.promise);
  await render(); await tap('Povuci prijavu: Unos ormara'); const answer = retained();
  await act(async () => { answer(); answer(); }); expect(mockWithdraw).toHaveBeenCalledTimes(1);
  await act(async () => { mockRows = [row({ stanje: 'WITHDRAWN', mozePovuci: false })]; held.resolve({ ok: true, podatak: { stanje: 'WITHDRAWN', verzija: 2 } }); });
  expect(mockWithdraw).toHaveBeenCalledTimes(1);
});
it('stale WITHDRAW uses its actual revision-resolution authority', async () => {
  mockResolve.mockResolvedValue({ ok: true, podatak: { status: 'WITHDRAWN', version: 2 } }); await review(); await tap('Povuci izmenjenu prijavu'); await act(async () => confirm()());
  expect(mockWithdraw).not.toHaveBeenCalled(); expect(mockResolve.mock.calls[0][0]).toMatchObject({ akcija: 'WITHDRAW', ocekivanaVerzija: 2, ocekivanaPotrebaRevizija: 4 });
});
it('cancelling the withdrawal question sends nothing and leaves the application as it was', async () => {
  await render(); await tap('Povuci prijavu: Unos ormara'); await act(async () => cancel()());
  expect(sheets()).toHaveLength(0); expect(mockWithdraw).not.toHaveBeenCalled(); expect(mockRead).toHaveBeenCalledTimes(1);
  // The question can be asked again, and then answered.
  await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()()); expect(mockWithdraw).toHaveBeenCalledTimes(1);
});
it.each(['blur', 'account', 'background', 'refresh'])('retires an open withdrawal confirmation after %s', async change => {
  await render(); await tap('Povuci prijavu: Unos ormara'); const old = retained();
  if (change === 'blur') { mockFocused = false; await update(); mockFocused = true; await update(); }
  if (change === 'account') { mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 }; await update(); }
  if (change === 'background') { await background('background'); expect(text()).not.toContain('Unos ormara'); await background('active'); }
  if (change === 'refresh') { await act(async () => tree!.root.findByType('FlatList' as any).props.onRefresh()); }
  // The question leaves the screen with the review it belonged to, and its retained answer still does nothing.
  expect(sheets()).toHaveLength(0);
  await act(async () => old()); expect(mockWithdraw).not.toHaveBeenCalled();
});
// Owner decision 1 (2026-09-19): the app has no global mode. This used to be a row of the table above.
it('a flip of the retired app mode leaves an open withdrawal confirmation standing', async () => {
  await render(); await tap('Povuci prijavu: Unos ormara'); const old = confirm();
  mockRole = 'narucilac'; await update(); await act(async () => old()); expect(mockWithdraw).toHaveBeenCalledTimes(1);
});
it('retires retained review actions when that review is closed and reopened', async () => {
  await review(); const old = press('Zadrži prijavu'); await tap('Zatvori pregled izmena'); await tap(REVIEW_FOOT); await act(async () => old()); expect(mockResolve).not.toHaveBeenCalled();
});
it('unknown UPDATE requires readback then retries the identical immutable payload and key', async () => {
  mockResolve.mockResolvedValue({ ok: false, kod: 'NETWORK', poruka: 'secret backend text' }); await editing(); await edit('Cena ponude (RSD)', '5600');
  const oldSave = press('Sačuvaj izmenjenu prijavu'); await tap('Sačuvaj izmenjenu prijavu'); expect(press('Pošalji ponovo')).toBeUndefined();
  expect(text()).not.toContain('secret backend text'); await act(async () => oldSave()); expect(mockResolve).toHaveBeenCalledTimes(1);
  mockRows = [stale()]; mockRows[0].potrebaRevizija = 5; await tap('Proveri da li je poslato'); await tap('Pošalji ponovo');
  expect(mockResolve.mock.calls[1][0]).toEqual(mockResolve.mock.calls[0][0]); expect(mockResolve.mock.calls[1][0].ocekivanaPotrebaRevizija).toBe(4);
});
it('known stale rejection permits a new reviewed intent only after readback', async () => {
  mockResolve.mockResolvedValueOnce({ ok: false, kod: 'STALE_REVIEW_REQUIRED', poruka: 'raw data' }); await review(); await tap('Zadrži prijavu');
  expect(press('Pregledaj trenutnu prijavu')).toBeUndefined(); await tap('Proveri da li je poslato'); await tap('Pregledaj trenutnu prijavu');
  await tap(REVIEW_FOOT); await tap('Zadrži prijavu'); expect(mockResolve.mock.calls[1][0].clientRequestId).not.toBe(mockResolve.mock.calls[0][0].clientRequestId);
});
it('a malformed receipt cannot fabricate success or unlock a changed command', async () => {
  mockResolve.mockResolvedValue({ ok: true, podatak: { status: 'SUBMITTED', version: 2 } }); await review(); await tap('Zadrži prijavu');
  expect(text()).toContain('Ne znamo da li je radnja uspela'); expect(text()).not.toContain('Prijava je ažurirana'); expect(mockRead).toHaveBeenCalledTimes(1);
});
it('a valid receipt plus failed readback says refresh is needed without an optimistic card', async () => {
  await render(); mockRead.mockRejectedValueOnce(new Error('private server path')); await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  expect(text()).toContain('Radnja je uspela, ali se lista nije osvežila'); expect(text()).not.toContain('Prijava je povučena.'); expect(text()).not.toContain('private server');
  await tap('Proveri da li je poslato'); expect(text()).toContain('Prijava je povučena.');
});
it('bounds a hanging initial read; retry works and its late result cannot replace the current list', async () => {
  jest.useFakeTimers(); const d = deferred(); mockRead.mockReturnValueOnce(d.promise); await render(); await act(async () => jest.advanceTimersByTime(15001));
  expect(text()).toContain('Prijave trenutno nisu dostupne'); expect(text()).toContain('Pokušaj ponovo za trenutak.'); await tap('Pokušaj ponovo'); await act(async () => d.resolve([row({ naslov: 'Retired private row' })]));
  expect(text()).toContain('Unos ormara'); expect(text()).not.toContain('Retired private row');
});
it('bounds a hanging write, discards its late completion and reuses the same key after owned read', async () => {
  jest.useFakeTimers(); const d = deferred(); mockWithdraw.mockReturnValueOnce(d.promise); await render(); await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  await act(async () => jest.advanceTimersByTime(15001)); expect(text()).toContain('Ne znamo da li je radnja uspela');
  await tap('Proveri da li je poslato'); await act(async () => d.resolve({ ok: true, podatak: { stanje: 'WITHDRAWN', verzija: 2 } }));
  expect(text()).not.toContain('Prijava je povučena.'); await tap('Pošalji ponovo'); expect(mockWithdraw.mock.calls[1][0]).toEqual(mockWithdraw.mock.calls[0][0]);
});
it('late interval read after blur cannot reopen the editor', async () => {
  const d = deferred(); mockInterval.mockReturnValueOnce(d.promise); await review(); await tap('Izmeni prijavu'); mockFocused = false; await update(); mockFocused = true; await update();
  await act(async () => d.resolve({ ok: true, podatak: interval })); expect(press('Sačuvaj izmenjenu prijavu')).toBeUndefined();
});
it('refocus while a write is pending waits for settlement and then permits explicit readback', async () => {
  const d = deferred(); mockWithdraw.mockReturnValueOnce(d.promise); await render(); await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  mockFocused = false; await update(); mockFocused = true; await update(); await tap('Proveri da li je poslato'); expect(mockRead).toHaveBeenCalledTimes(2);
  mockRows = [row({ stanje: 'WITHDRAWN', mozePovuci: false })]; await act(async () => d.resolve({ ok: true, podatak: { stanje: 'WITHDRAWN', verzija: 2 } }));
  await tap('Proveri da li je poslato'); expect(mockRead).toHaveBeenCalledTimes(3); expect(text()).toContain('Prijava je povučena.');
});
it('a late read from the prior account incarnation never reveals its rows', async () => {
  const d = deferred(); mockRead.mockReturnValueOnce(d.promise); await render(); mockRows = [row({ naslov: 'Current account' })];
  mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 }; await update(); await act(async () => d.resolve([row({ naslov: 'Private old account' })]));
  expect(text()).toContain('Current account'); expect(text()).not.toContain('Private old account');
});
it('a pending write from the prior account incarnation cannot replace the current list or issue a read', async () => {
  const d = deferred(); mockWithdraw.mockReturnValueOnce(d.promise); await render(); await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  mockRows = [row({ naslov: 'Current account' })]; mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 }; await update();
  await act(async () => d.resolve({ ok: true, podatak: { stanje: 'WITHDRAWN', verzija: 2 } }));
  expect(mockRead).toHaveBeenCalledTimes(2); expect(text()).toContain('Current account'); expect(text()).not.toContain('Prijava je povučena.');
});
it('a confirmed command with a different fresh offer shows actual state and allows explicit review without claiming a matching offer', async () => {
  mockResolve.mockImplementationOnce(async () => { mockRows = [row({ prijavaVerzija: 3, cena: { iznos: 6000, valuta: 'RSD', prikaz: '6.000 RSD' } })]; return { ok: true, podatak: { status: 'SUBMITTED', version: 3 } }; });
  await review(); await tap('Zadrži prijavu'); expect(text()).not.toContain('Prijava je ažurirana'); expect(text()).toContain('6.000 RSD');
  await tap('Pregledaj trenutnu prijavu'); expect(press('Proveri da li je poslato')).toBeUndefined(); expect(mockResolve).toHaveBeenCalledTimes(1);
});

it('confirms withdrawal from its named row even when the displayed list omits it', async () => {
  mockWithdraw.mockImplementationOnce(async () => { mockRows = []; return { ok: true, podatak: { stanje: 'WITHDRAWN', verzija: 2 } }; });
  mockCommandState.mockResolvedValue({ ok: true, podatak: commandState(row({ stanje: 'WITHDRAWN' })) });
  await render(); expect(mockCommandState).not.toHaveBeenCalled();
  await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  expect(mockCommandState).toHaveBeenCalledWith(row());
  expect(text()).toContain('Prijava je povučena.');
  expect(press('Proveri da li je poslato')).toBeUndefined();
});
it('a missing or unreadable named row cannot be replaced by a matching list row', async () => {
  mockCommandState.mockResolvedValue({ ok: false, kod: 'APPLICATION_STATE_INVALID', poruka: 'private backend detail' });
  await render(); await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  expect(text()).not.toContain('Prijava je povučena.'); expect(text()).not.toContain('private backend');
  expect(press('Pregledaj trenutnu prijavu')).toBeUndefined();
  expect(press('Pošalji ponovo')).toBeUndefined();
  mockCommandState.mockResolvedValue({ ok: true, podatak: commandState(row({ stanje: 'WITHDRAWN' })) });
  await tap('Proveri da li je poslato'); expect(text()).toContain('Prijava je povučena.');
});
it('an unchanged named row outside the list permits only the identical unknown command retry', async () => {
  mockWithdraw.mockImplementationOnce(async () => { mockRows = []; return { ok: false, kod: 'NETWORK', poruka: 'unknown' }; });
  mockCommandState.mockResolvedValue({ ok: true, podatak: commandState() });
  await render(); await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  expect(press('Pošalji ponovo')).toBeUndefined(); await tap('Proveri da li je poslato'); await tap('Pošalji ponovo');
  expect(mockCommandState).toHaveBeenCalled(); expect(mockWithdraw.mock.calls[1][0]).toEqual(mockWithdraw.mock.calls[0][0]);
});
it('a named row resembling KEEP without a receipt still requires replay of the same key', async () => {
  mockResolve.mockResolvedValue({ ok: false, kod: 'NETWORK', poruka: 'unknown' });
  mockCommandState.mockResolvedValue({ ok: true, podatak: commandState(row({ prijavaVerzija: 3 })) });
  await review(); await tap('Zadrži prijavu'); mockRows = []; await tap('Proveri da li je poslato');
  expect(text()).not.toContain('Prijava je ažurirana'); await tap('Pošalji ponovo');
  expect(mockCommandState).toHaveBeenCalled(); expect(mockResolve.mock.calls[1][0]).toEqual(mockResolve.mock.calls[0][0]);
});
it('confirmed KEEP remains saved against its reviewed revision when the task changes again', async () => {
  mockResolve.mockImplementationOnce(async () => { mockRows = [row({ stanje: 'STALE_REVIEW_REQUIRED', potrebaRevizija: 5, prijavaVerzija: 3, traziPaznju: true })];
    return { ok: true, podatak: { status: 'SUBMITTED', version: 3 } }; });
  await review(); await tap('Zadrži prijavu');
  expect(text()).toContain('Prijava je ažurirana prema izmenjenom zadatku.');
  expect(text()).toContain('Zadatak je izmenjen.'); expect(press('Proveri da li je poslato')).toBeUndefined();
});
it('an UPDATE receipt cannot confirm an interval with a different microsecond', async () => {
  mockCommandState.mockResolvedValue({ ok: true, podatak: commandState(row({ prijavaVerzija: 3 }), { proposedEndAt: '2026-09-20T11:00:00.654322Z' }) });
  await editing(); await tap('Sačuvaj izmenjenu prijavu');
  expect(text()).not.toContain('Prijava je ažurirana'); expect(press('Pregledaj trenutnu prijavu')).toBeDefined();
});
it('UPDATE readback compares exact instants across timestamp offsets without losing microseconds', async () => {
  mockCommandState.mockResolvedValue({ ok: true, podatak: commandState(row({ prijavaVerzija: 3 }), {
    proposedStartAt: '2026-09-20T12:00:00.123456+02:00', proposedEndAt: '2026-09-20T13:00:00.654321+02:00',
  }) });
  await editing(); await tap('Sačuvaj izmenjenu prijavu'); expect(text()).toContain('Prijava je ažurirana');
});
it('a successful named read is retired when the next read fails, keeping retry locked', async () => {
  mockWithdraw.mockResolvedValue({ ok: false, kod: 'NETWORK', poruka: 'unknown' });
  await render(); await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  await tap('Proveri da li je poslato'); const oldRetry = press('Pošalji ponovo'); expect(oldRetry).toBeDefined();
  mockCommandState.mockResolvedValue({ ok: false, kod: 'APPLICATION_STATE_UNAVAILABLE' });
  await tap('Proveri da li je poslato'); expect(press('Pošalji ponovo')).toBeUndefined();
  await act(async () => oldRetry()); expect(mockWithdraw).toHaveBeenCalledTimes(1);
});
it.each(['blur', 'account', 'background'])('a late named-row confirmation after %s cannot settle the current screen', async change => {
  const d = deferred(); mockCommandState.mockReturnValueOnce(d.promise);
  await render(); await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  if (change === 'blur') { mockFocused = false; await update(); }
  if (change === 'account') { mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 }; mockRows = [row({ naslov: 'Current account' })]; await update(); }
  if (change === 'background') await background('background');
  await act(async () => d.resolve({ ok: true, podatak: commandState(row({ stanje: 'WITHDRAWN' })) }));
  expect(mockCommandState).toHaveBeenCalled(); expect(text()).not.toContain('Prijava je povučena.');
});


it('steps an edited application and sends exactly that headcount with its preserved interval', async () => {
  await editing();
  const people = () => tree!.root.findAll(n => String(n.type) === 'TextInput' && n.props.accessibilityLabel === 'Broj ljudi')[0];
  expect(people().props.value).toBe('2');
  await tap('Jedna osoba manje'); expect(people().props.value).toBe('1');
  await tap('Jedna osoba manje'); expect(people().props.value).toBe('1');
  await tap('Jedna osoba više'); await tap('Jedna osoba više');
  await tap('Jedna osoba više'); expect(people().props.value).toBe('3');
  await tap('Sačuvaj izmenjenu prijavu');
  expect(mockResolve.mock.calls[0][0]).toMatchObject({ akcija: 'UPDATE', pokrivenaMesta: 3, cenaRsd: 4500,
    predlozeniPocetak: interval.start, predlozeniKraj: interval.end });
});


it('does not send an edited headcount over the known task total even through a retained callback', async () => {
  await editing();
  await edit('Broj ljudi', '4');
  const save = tree!.root.findAll(n => String(n.type) === 'Press' && n.props.accessibilityLabel === 'Sačuvaj izmenjenu prijavu')[0];
  expect(save.props.disabled).toBe(true);
  await act(async () => save.props.onPress());
  expect(mockResolve).not.toHaveBeenCalled();
  expect(text()).toContain('Možeš da prijaviš najviše 3.');
});
