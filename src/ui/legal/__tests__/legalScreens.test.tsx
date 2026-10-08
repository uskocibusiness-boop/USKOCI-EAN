import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { LegalBundleStatus } from '../../../contracts/legal';
const mockRead = jest.fn(), mockProcessors = jest.fn(), mockAccept = jest.fn(), mockOutcome = jest.fn(), mockOpen = jest.fn(), mockBack = jest.fn();
let mockOwner = { user: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null, accountRevision: 1 };
let mockFocused = true;
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return new Proxy(actual, { get(target, key) { if (key === 'Linking') return { openURL: (...args: unknown[]) => mockOpen(...args) };
    return ['View', 'ActivityIndicator', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('expo-router', () => ({ router: { back: () => mockBack(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (callback: () => unknown) => require('react').useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../../store/sesija', () => ({ sesijaSada: () => mockOwner, useSesija: () => mockOwner }));
jest.mock('../../../lib/idempotencija', () => ({ noviUuidZahtevId: () => '33333333-3333-4333-8333-333333333333' }));
jest.mock('../../../data/legalClientService', () => ({ legalClientService: {
  readBundle: (...args: unknown[]) => mockRead(...args), acceptReviewedBundle: (...args: unknown[]) => mockAccept(...args), readAcceptance: (...args: unknown[]) => mockOutcome(...args),
} }));
jest.mock('../../../data/processorMapClientService', () => ({ processorMapClientService: { readStatus: (...args: unknown[]) => mockProcessors(...args) } }));
jest.mock('../../settings/SettingsPresentation', () => {
  const element = (name: string) => ({ children, footer, ...props }: any) => require('react').createElement(name, props, children, footer);
  return Object.fromEntries(['SettingsAction', 'SettingsGroup', 'SettingsIntro', 'SettingsPanel', 'SettingsRow', 'SettingsScreen', 'SettingsText', 'SettingsInfo'].map(name => [name, element(name)]));
});
import LegalRoute from '../../../app/(app)/profil/pravna';
import { PublicLegalModal } from '../LegalDocuments';
const ok = <T,>(podatak: T) => ({ ok: true, podatak });
const bundle = (): LegalBundleStatus => ({ ready: true, acceptedCurrentBundle: false, reason: null, documents: [
  { kind: 'TERMS', version: 'RC2', sha256: 'a'.repeat(64), url: 'https://example.test/terms', publishedAt: '', effectiveAt: '' },
  { kind: 'PRIVACY', version: 'V1', sha256: 'b'.repeat(64), url: 'https://example.test/privacy', publishedAt: '', effectiveAt: '' },
] });
const receipt = { accepted: true, idempotentReplay: false, termsVersion: 'RC2', termsSha256: 'a'.repeat(64), privacyVersion: 'V1', privacySha256: 'b'.repeat(64), acceptedAt: '2026-09-13T00:00:00Z' };
let tree: ReactTestRenderer;
const hosts = (type: string) => tree.root.findAll(node => node.type === type);
const renderedCopy = () => tree.root.findAll(node => typeof node.type === 'string').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const action = (label: string) => hosts('SettingsAction').find(node => node.props.label === label)!;
const linkUnconfirmed = 'Otvaranje dokumenta nije potvrđeno. Pokušaj ponovo.';
const deferredOpen = () => {
  let resolve!: () => void, reject!: (reason: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
beforeEach(() => {
  jest.clearAllMocks(); mockOpen.mockReset(); mockFocused = true; mockOwner = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 };
  mockRead.mockResolvedValue(ok(bundle())); mockProcessors.mockResolvedValue(ok({ ready: false, reason: 'PROCESSOR_MAP_NOT_PUBLISHED', missingProviders: [] }));
  mockAccept.mockResolvedValue(ok(receipt)); mockOutcome.mockResolvedValue(ok({ found: true, receipt })); mockOpen.mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });
it('shows only the exact server documents and opens their HTTPS URLs', async () => {
  await act(async () => { tree = create(<LegalRoute />); });
  const rows = hosts('SettingsRow'); expect(rows.map(row => row.props.label)).toEqual(['Uslovi korišćenja', 'Politika privatnosti']);
  await act(async () => rows[0].props.onPress()); expect(mockOpen).toHaveBeenCalledWith('https://example.test/terms');
  expect(renderedCopy()).not.toContain('OpenAI'); expect(renderedCopy()).not.toContain('Gemini');
});
it.each(['resolve', 'reject'] as const)('a stalled document launch becomes retryable after 10 seconds and its late %s cannot release a retry', async outcome => {
  jest.useFakeTimers(); const first = deferredOpen(), retry = deferredOpen();
  mockOpen.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
  await act(async () => { tree = create(<LegalRoute />); });
  await act(async () => { hosts('SettingsRow')[0].props.onPress(); hosts('SettingsRow')[1].props.onPress(); });
  expect(mockOpen).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(9999); }); expect(renderedCopy()).not.toContain(linkUnconfirmed);
  await act(async () => { jest.advanceTimersByTime(1); }); expect(renderedCopy()).toContain(linkUnconfirmed);
  await act(async () => hosts('SettingsRow')[1].props.onPress());
  expect(mockOpen).toHaveBeenCalledTimes(2); expect(renderedCopy()).not.toContain(linkUnconfirmed);
  await act(async () => { if (outcome === 'resolve') first.resolve(); else first.reject(new Error('late')); });
  await act(async () => hosts('SettingsRow')[0].props.onPress());
  expect(mockOpen).toHaveBeenCalledTimes(2); expect(renderedCopy()).not.toContain(linkUnconfirmed);
  await act(async () => retry.reject(new Error('current'))); expect(renderedCopy()).toContain(linkUnconfirmed);
  await act(async () => hosts('SettingsRow')[0].props.onPress()); expect(mockOpen).toHaveBeenCalledTimes(3);
  expect(renderedCopy()).not.toContain(linkUnconfirmed);
});
it.each(['resolve', 'reject'] as const)('blur retires a stalled launch; refocus owns a new attempt despite the old late %s', async outcome => {
  jest.useFakeTimers(); const first = deferredOpen(), next = deferredOpen();
  mockOpen.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
  await act(async () => { tree = create(<LegalRoute />); });
  const retained = hosts('SettingsRow')[0].props.onPress;
  await act(async () => retained());
  await act(async () => { jest.advanceTimersByTime(5000); });
  mockFocused = false; await act(async () => tree.update(<LegalRoute />));
  await act(async () => retained()); expect(mockOpen).toHaveBeenCalledTimes(1);
  mockFocused = true; await act(async () => tree.update(<LegalRoute />));
  await act(async () => { retained(); hosts('SettingsRow')[1].props.onPress(); });
  expect(mockOpen).toHaveBeenCalledTimes(2);
  await act(async () => { jest.advanceTimersByTime(5000); }); expect(renderedCopy()).not.toContain(linkUnconfirmed);
  await act(async () => { if (outcome === 'resolve') first.resolve(); else first.reject(new Error('late')); });
  await act(async () => hosts('SettingsRow')[0].props.onPress());
  expect(mockOpen).toHaveBeenCalledTimes(2); expect(renderedCopy()).not.toContain(linkUnconfirmed);
  await act(async () => next.resolve());
  await act(async () => hosts('SettingsRow')[0].props.onPress()); expect(mockOpen).toHaveBeenCalledTimes(3);
  expect(mockAccept).not.toHaveBeenCalled();
});
it.each(['back', 'unmount', 'account revision'] as const)('%s retires the document deadline and its late rejection', async retirement => {
  jest.useFakeTimers(); const first = deferredOpen(); mockOpen.mockReturnValueOnce(first.promise);
  await act(async () => { tree = create(<LegalRoute />); });
  const schedule = jest.spyOn(global, 'setTimeout'), clear = jest.spyOn(global, 'clearTimeout');
  const retained = hosts('SettingsRow')[0].props.onPress;
  await act(async () => retained());
  const scheduled = schedule.mock.calls.findIndex(([, delay]) => delay === 10000);
  expect(scheduled).toBeGreaterThanOrEqual(0);
  const deadline = schedule.mock.results[scheduled].value;
  await act(async () => {
    if (retirement === 'back') hosts('SettingsScreen')[0].props.onBack();
    else if (retirement === 'unmount') tree.unmount();
    else { mockOwner = { ...mockOwner, accountRevision: 3 }; tree.update(<LegalRoute />); }
  });
  expect(clear).toHaveBeenCalledWith(deadline);
  await act(async () => { first.reject(new Error('retired')); retained(); });
  expect(mockOpen).toHaveBeenCalledTimes(1);
  if (retirement !== 'unmount') expect(renderedCopy()).not.toContain(linkUnconfirmed);
  if (retirement === 'account revision') {
    await act(async () => hosts('SettingsRow')[0].props.onPress()); expect(mockOpen).toHaveBeenCalledTimes(2);
  }
});
it('a synchronous document launch failure reports an unconfirmed outcome and permits retry', async () => {
  jest.useFakeTimers(); mockOpen.mockImplementationOnce(() => { throw new Error('native failure'); });
  await act(async () => { tree = create(<LegalRoute />); });
  const schedule = jest.spyOn(global, 'setTimeout'), clear = jest.spyOn(global, 'clearTimeout');
  await act(async () => hosts('SettingsRow')[0].props.onPress());
  expect(renderedCopy()).toContain(linkUnconfirmed);
  const scheduled = schedule.mock.calls.findIndex(([, delay]) => delay === 10000);
  expect(scheduled).toBeGreaterThanOrEqual(0); expect(clear).toHaveBeenCalledWith(schedule.mock.results[scheduled].value);
  await act(async () => hosts('SettingsRow')[0].props.onPress());
  expect(mockOpen).toHaveBeenCalledTimes(2); expect(renderedCopy()).not.toContain(linkUnconfirmed);
});
it('the single action accepts exact displayed hashes once', async () => {
  await act(async () => { tree = create(<LegalRoute />); });
  await act(async () => action('Prihvati pregledane dokumente').props.onPress());
  expect(mockAccept).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333', 'a'.repeat(64), 'b'.repeat(64));
  expect(action('Prihvati pregledane dokumente')).toBeUndefined(); expect(renderedCopy()).toContain('Prihvaćene su trenutne verzije dokumenata.');
});
it('unknown acceptance offers an owned readback and confirms its exact receipt', async () => {
  mockAccept.mockResolvedValue({ ok: false, kod: 'LEGAL_ACCEPT_OUTCOME_UNKNOWN', poruka: 'Ishod nije potvrđen.' });
  await act(async () => { tree = create(<LegalRoute />); });
  await act(async () => action('Prihvati pregledane dokumente').props.onPress());
  await act(async () => action('Proveri da li je prihvaćeno').props.onPress());
  expect(mockOutcome).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333'); expect(mockAccept).toHaveBeenCalledTimes(1);
});
it('old account callbacks cannot accept, open documents or navigate', async () => {
  await act(async () => { tree = create(<LegalRoute />); });
  const accept = action('Prihvati pregledane dokumente').props.onPress, link = hosts('SettingsRow')[0].props.onPress, back = hosts('SettingsScreen')[0].props.onBack;
  mockOwner = { ...mockOwner, accountRevision: 3 }; await act(async () => { accept(); link(); back(); });
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockOpen).not.toHaveBeenCalled(); expect(mockBack).not.toHaveBeenCalled();
});
it('unpublished documents never display an accept action', async () => {
  mockRead.mockResolvedValue(ok({ ready: false, acceptedCurrentBundle: false, reason: 'LEGAL_DOCUMENTS_NOT_PUBLISHED', documents: [] }));
  await act(async () => { tree = create(<LegalRoute />); });
  expect(hosts('SettingsRow')).toHaveLength(0); expect(action('Prihvati pregledane dokumente')).toBeUndefined();
});
// UI/UX pass 2026-10-07 (team T4c): when the documents are not published the screen says ONE honest sentence and has no dead row.
const unpublished = { ready: false, acceptedCurrentBundle: false, reason: 'LEGAL_DOCUMENTS_NOT_PUBLISHED', documents: [] };
/** The title of a screen that has nothing to read (composition spec T7): the one header of the page, spoken as a heading. */
const centeredTitle = () => hosts('SettingsText').find(node => node.props.accessibilityRole === 'header');
/** The picture of 96 that stands over the one title of such a screen: a `FactArt` is found by what it is asked to draw. */
const art96 = () => [...new Set(tree.root.findAll(node => node.props.size === 96 && typeof node.props.kind === 'string').map(node => node.props.kind as string))];
/** A command of the page body (a `V2Action`), found by its words; the foot's `SettingsAction` and the rows are other things. */
const command = (label: string) => tree.root.findAll(node => node.props.label === label && typeof node.props.onPress === 'function'
  && node.type !== ('SettingsAction' as React.ElementType) && node.type !== ('SettingsRow' as React.ElementType))[0];
it('documents that are not published are ONE sentence and one way to look again: no row, no empty group, no second "not published"', async () => {
  mockRead.mockResolvedValue(ok(unpublished));
  await act(async () => { tree = create(<LegalRoute />); });
  expect(centeredTitle()!.children.join('')).toBe('Uslovi korišćenja i Politika privatnosti još nisu objavljeni.');
  expect(art96()).toEqual(['document']);
  // The one way to look again is quiet; there is no green action on a screen with nothing to do.
  expect(command('Proveri ponovo').props.kind).toBe('quiet'); expect(command('Pokušaj ponovo')).toBeUndefined();
  expect(hosts('SettingsRow')).toHaveLength(0); expect(hosts('SettingsGroup')).toHaveLength(0); expect(hosts('SettingsInfo')).toHaveLength(0);
  expect(renderedCopy()).not.toContain('Mapa obrade'); expect(renderedCopy().match(/još nisu objavljeni/g)).toHaveLength(1);
  expect(action('Prihvati pregledane dokumente')).toBeUndefined();
  mockRead.mockClear(); mockRead.mockResolvedValue(ok(bundle()));
  await act(async () => command('Proveri ponovo').props.onPress());
  expect(mockRead).toHaveBeenCalledTimes(1); expect(hosts('SettingsRow').map(row => row.props.label)).toEqual(['Uslovi korišćenja', 'Politika privatnosti']);
});
it('documents that cannot be read are an error with what happened and one retry, not a row that says "not available"', async () => {
  mockRead.mockResolvedValue({ ok: false, kod: 'LEGAL_READ_UNAVAILABLE', poruka: 'Dokumenti trenutno nisu dostupni. Pokušaj ponovo.' });
  await act(async () => { tree = create(<LegalRoute />); });
  expect(centeredTitle()!.children.join('')).toBe('Dokumenti nisu dostupni');
  expect(hosts('SettingsText').some(node => node.children.join('') === 'Dokumenti trenutno nisu dostupni. Pokušaj ponovo.')).toBe(true);
  expect(art96()).toEqual(['document']);
  // The one green action is the retry; a quiet "Proveri ponovo" is only for documents that are not published.
  expect(command('Pokušaj ponovo').props.kind).toBeUndefined(); expect(command('Proveri ponovo')).toBeUndefined(); expect(hosts('SettingsRow')).toHaveLength(0);
  mockRead.mockClear(); mockRead.mockResolvedValue(ok(bundle()));
  await act(async () => command('Pokušaj ponovo').props.onPress());
  expect(mockRead).toHaveBeenCalledTimes(1); expect(centeredTitle()).toBeUndefined(); expect(hosts('SettingsRow')).toHaveLength(2);
});
it('published documents with no published processor map say it once, as a line, not as a group with a dead row', async () => {
  await act(async () => { tree = create(<LegalRoute />); });
  expect(renderedCopy()).toContain('Podaci o obrađivačima još nisu objavljeni.');
  expect(renderedCopy()).not.toContain('Mapa obrade'); expect(renderedCopy()).not.toContain('Obrađivači podataka'); expect(hosts('SettingsInfo')).toHaveLength(0);
});
it('a re-read keeps the documents on screen under the refresh at work, and nothing can be accepted meanwhile', async () => {
  await act(async () => { tree = create(<LegalRoute />); });
  // One word at the end of the title of the documents: "Osveži", spoken as "Osveži dokumente".
  const refresh = () => hosts('SettingsGroup').find(node => node.props.title === 'Objavljeni dokumenti')!.props.action;
  const footReason = () => hosts('SettingsScreen')[0].props.footerReason;
  expect(refresh()).toMatchObject({ label: 'Osveži', accessibilityLabel: 'Osveži dokumente' }); expect(footReason()).toBeNull();
  let finish!: (value: unknown) => void; mockRead.mockReturnValueOnce(new Promise(done => { finish = done; }));
  await act(async () => { refresh().onPress(); });
  // Still the two rows, no skeleton over them; the refresh says it works, the acceptance waits grey and the foot says why.
  expect(hosts('SettingsRow')).toHaveLength(2); expect(tree.root.findAllByProps({ accessibilityLabel: 'Učitavanje pravnih dokumenata' })).toHaveLength(0);
  expect(refresh().label).toBe('Osvežavamo…');
  expect(action('Prihvati pregledane dokumente').props).toMatchObject({ disabled: true });
  expect(footReason()).toBe('Učitavamo dokumente…');
  await act(async () => action('Prihvati pregledane dokumente').props.onPress()); expect(mockAccept).not.toHaveBeenCalled();
  // A second press while it works asks for nothing more.
  await act(async () => { refresh().onPress(); }); expect(mockRead).toHaveBeenCalledTimes(2);
  await act(async () => finish(ok(bundle())));
  expect(refresh().label).toBe('Osveži'); expect(action('Prihvati pregledane dokumente').props).toMatchObject({ disabled: false }); expect(footReason()).toBeNull();
});
it('the first read is a skeleton and the invitation to read is only said when there is something to read', async () => {
  let finish!: (value: unknown) => void; mockRead.mockReturnValueOnce(new Promise(done => { finish = done; }));
  await act(async () => { tree = create(<LegalRoute />); });
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Učitavanje pravnih dokumenata' }).length).toBeGreaterThan(0); expect(hosts('SettingsRow')).toHaveLength(0);
  await act(async () => finish(ok(bundle()))); expect(hosts('SettingsRow')).toHaveLength(2);
  await act(async () => tree.unmount());
  mockOwner = { user: null, accountRevision: 0 };
  mockRead.mockResolvedValue(ok(unpublished));
  await act(async () => { tree = create(<PublicLegalModal kind="PRIVACY" onClose={jest.fn()} />); });
  expect(renderedCopy()).toContain('još nisu objavljeni'); expect(renderedCopy()).not.toContain('Otvori objavljene dokumente');
  await act(async () => tree.unmount());
  mockRead.mockResolvedValue(ok(bundle()));
  await act(async () => { tree = create(<PublicLegalModal kind="PRIVACY" onClose={jest.fn()} />); });
  expect(renderedCopy()).toContain('Otvori objavljene dokumente');
});
it('the public modal reads anonymously and never offers or records ledger acceptance', async () => {
  mockOwner = { user: null, accountRevision: 0 }; const close = jest.fn();
  await act(async () => { tree = create(<PublicLegalModal kind="PRIVACY" onClose={close} />); });
  await act(async () => hosts('SettingsRow')[1].props.onPress()); expect(mockOpen).toHaveBeenCalledWith('https://example.test/privacy');
  // The public view is a sheet now: its own close control ends it, and closing leaves the form behind it untouched.
  await act(async () => tree.root.findByProps({ accessibilityRole: 'button', accessibilityLabel: 'Zatvori' }).props.onPress()); expect(close).toHaveBeenCalledTimes(1);
  expect(hosts('SettingsScreen')).toHaveLength(0);
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockProcessors).not.toHaveBeenCalled();
});
it('renders actual published processor fields without a local provider fallback', async () => {
  mockProcessors.mockResolvedValue(ok({ ready: true, mapVersion: 'published-1', effectiveAt: '', providers: [{ providerCode: 'SERVER_VALUE', providerDisplayName: 'Objavljeni obrađivač',
    legalEntityName: 'Objavljeno pravno lice', legalRole: 'PROCESSOR', purpose: 'Objavljena svrha', dataCategories: ['Objavljena kategorija'], processingRegions: 'Objavljeni region',
    crossBorderTransfer: true, transferMechanism: 'Objavljeni mehanizam', dpaReference: 'Objavljeni ugovor', privacyNoticeUrl: 'https://example.test/provider',
    retentionDeletionTerms: 'Objavljeni rok', subprocessorTerms: 'Objavljeni podobrađivači', legalBasisReference: 'Objavljeni osnov' }] }));
  await act(async () => { tree = create(<LegalRoute />); });
  // Each provider is folded to its name, its legal entity and role until opened.
  expect(renderedCopy()).toContain('Objavljeno pravno lice · Obrađivač'); expect(renderedCopy()).not.toContain('Objavljeni region');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Objavljeni obrađivač' }).props.onPress());
  expect(renderedCopy()).toContain('Objavljeni region'); expect(renderedCopy()).toContain('Objavljeni rok');
  await act(async () => action('Obaveštenje o privatnosti · Objavljeni obrađivač').props.onPress());
  expect(mockOpen).toHaveBeenCalledWith('https://example.test/provider');
});
it('the screen is named as the entries that open it, and a running acceptance keeps its words', async () => {
  let resolve!: (value: unknown) => void; mockAccept.mockReturnValue(new Promise(done => { resolve = done; }));
  await act(async () => { tree = create(<LegalRoute />); });
  expect(hosts('SettingsScreen')[0].props.title).toBe('Pravila i saglasnosti');
  await act(async () => { action('Prihvati pregledane dokumente').props.onPress(); });
  expect(action('Prihvati pregledane dokumente').props).toMatchObject({ loading: true, disabled: true });
  expect(mockAccept).toHaveBeenCalledTimes(1);
  await act(async () => resolve(ok(receipt)));
  expect(action('Prihvati pregledane dokumente')).toBeUndefined(); expect(renderedCopy()).toContain('Prihvaćene su trenutne verzije dokumenata.');
});
// Round 5 review: the read and the replay keep their own words while they run, as the first acceptance does.
it('a running readback and a running replay each keep their words with a spinner', async () => {
  mockAccept.mockResolvedValueOnce({ ok: false, kod: 'LEGAL_ACCEPT_OUTCOME_UNKNOWN', poruka: 'Ishod nije potvrđen.' });
  let found!: (value: unknown) => void; mockOutcome.mockReturnValueOnce(new Promise(done => { found = done; }));
  await act(async () => { tree = create(<LegalRoute />); });
  await act(async () => action('Prihvati pregledane dokumente').props.onPress());
  await act(async () => { action('Proveri da li je prihvaćeno').props.onPress(); });
  expect(action('Proveri da li je prihvaćeno').props).toMatchObject({ loading: true, disabled: true });
  expect(action('Prihvati ponovo')).toBeUndefined();
  await act(async () => found(ok({ found: false, receipt: null })));
  let accepted!: (value: unknown) => void; mockAccept.mockReturnValueOnce(new Promise(done => { accepted = done; }));
  await act(async () => { action('Prihvati ponovo').props.onPress(); });
  expect(action('Prihvati ponovo').props).toMatchObject({ loading: true, disabled: true });
  expect(action('Proveri da li je prihvaćeno')).toBeUndefined(); expect(mockAccept).toHaveBeenCalledTimes(2);
  await act(async () => accepted(ok(receipt)));
  expect(renderedCopy()).toContain('Prihvaćene su trenutne verzije dokumenata.');
});
it('an acceptance failure is said right above the button that failed', async () => {
  mockAccept.mockResolvedValue({ ok: false, kod: 'LEGAL_ACCEPT_OUTCOME_UNKNOWN', poruka: 'Ishod nije potvrđen.' });
  await act(async () => { tree = create(<LegalRoute />); });
  await act(async () => action('Prihvati pregledane dokumente').props.onPress());
  // Once, as an alert beside the readback it now offers, and not a second time under the intro.
  const alerts = tree.root.findAll(node => node.type === ('SettingsText' as React.ElementType) && [node.props.children].flat().includes('Ishod nije potvrđen.'));
  expect(alerts).toHaveLength(1); expect(alerts[0].props.accessibilityRole).toBe('alert');
  expect(action('Proveri da li je prihvaćeno')).toBeDefined();
});
