import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ReceivedReview, ReceivedReviewsPage } from '../../../data/workTrustClientService';

/**
 * "Primljene" under the average (PROFILE-TRUST, R30): the reviews the person RECEIVED, page by page. The list draws exactly what the
 * server returned (`mode`, `notListedCount`, a masked face) and promises nothing else; the hook keeps one account's pages and never
 * another's. Disposable doubles only: no network, no DEV, no real account.
 */
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CURSOR = '2026-10-01T10:00:00.000000Z|20000000-0000-4000-8000-000000000003';
let mockUser: { id: string } | null = { id: A }, mockRevision = 1;
const mockReceived = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../../store/sesija', () => ({ useSesija: () => ({ user: mockUser, accountRevision: mockRevision }) }));
jest.mock('../../../data/workTrustClientService', () => ({ RECEIVED_REVIEWS_PAGE_SIZE: 20,
  workTrustClientService: { receivedReviews: (...args: unknown[]) => mockReceived(...args) } }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../settings/SettingsPresentation', () => ({ SettingsGroup: 'SettingsGroup' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'V2Action' }));
jest.mock('../../system/Avatar', () => ({ Avatar: 'Avatar' }));
jest.mock('../../system/StateView', () => ({ StateView: 'StateView' }));
jest.mock('../AgreementReviewPresentation', () => ({ tagLabels: { AS_AGREED: 'Po dogovoru', CAREFUL: 'Pažljivo', CLEAR_COMMUNICATION: 'Jasna komunikacija',
  ON_TIME: 'Na vreme', RELIABLE: 'Pouzdano', RESPECTFUL: 'Uljudno' } }));
jest.mock('../RatingsPresentation', () => ({ StarsRow: 'StarsRow' }));
jest.mock('../ReviewCommentText', () => ({ ReviewCommentText: 'ReviewCommentText' }));
import { notListedNote, ReceivedReviewsList, receivedReviewsTitle, reviewTagsLine, type ReceivedReviewsView } from '../ReceivedReviewsList';
import { ReceivedReviewsSection } from '../ReceivedReviewsSection';
import { useReceivedReviews } from '../useReceivedReviews';
import { trenutak } from '../../../lib/trenutak';

const review = (n: number, patch: Partial<ReceivedReview> = {}): ReceivedReview => ({ reviewId: id(n), rating: 5, tags: ['CAREFUL', 'ON_TIME'], createdAt: '2026-10-01T10:00:00.000000Z',
  agreementId: id(100 + n), taskTitle: 'Kreči stan', receivedAs: 'WORKER', comment: 'Sve kako smo se dogovorili.',
  reviewer: { profileId: id(500 + n), role: 'REQUESTER', displayName: 'Ana P.', avatarPath: null, masked: false }, ...patch });
const masked = (n: number): ReceivedReview => review(n, { comment: 'Bez imena.', reviewer: { profileId: null, role: 'REQUESTER', displayName: null, avatarPath: null, masked: true } });
const page = (items: ReceivedReview[], patch: Partial<ReceivedReviewsPage> = {}): ReceivedReviewsPage => ({ mode: 'COMMENTED_ONLY', items, hasMore: false, nextAfter: null, limit: 20,
  totalCount: items.length, notListedCount: 0, asOf: '2026-10-07T18:23:45.123456+00:00', ...patch });
const ready = (items: ReceivedReview[], patch: Partial<Extract<ReceivedReviewsView, { kind: 'ready' }>> = {}): ReceivedReviewsView => ({ kind: 'ready', mode: 'COMMENTED_ONLY', items,
  totalCount: items.length, notListedCount: 0, hasMore: false, more: 'idle', onMore: jest.fn(), ...patch });

let tree: ReactTestRenderer;
const draw = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const hosts = (name: string) => tree.root.findAll(node => String(node.type) === name);
const texts = () => hosts('T').flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
const group = () => hosts('SettingsGroup')[0];
beforeEach(() => { jest.clearAllMocks(); mockReceived.mockReset(); mockUser = { id: A }; mockRevision = 1; });
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('what stands under the list, said in the words the server\'s numbers allow', () => {
  it('names the mode the server chose', () => {
    expect(receivedReviewsTitle('COMMENTED_ONLY')).toBe('Komentari');
    expect(receivedReviewsTitle('ALL')).toBe('Sve ocene');
  });

  it.each([[1, '1 ocena ulazi u prosek, ali se ne prikazuje pojedinačno.'], [2, '2 ocene ulaze u prosek, ali se ne prikazuje pojedinačno.'],
    [5, '5 ocena ulazi u prosek, ali se ne prikazuje pojedinačno.']])('says %i not listed as "%s"', (count, words) => {
    expect(notListedNote(count)).toBe(words);
  });

  it('says nothing when nothing is left out, and never promises who sees what or that anyone stays unnamed', () => {
    expect(notListedNote(0)).toBeNull();
    expect([1, 2, 5, 21].map(count => notListedNote(count)).join(' ')).not.toMatch(/anonim|nepoznat|niko ne vidi|sakriven|garant/i);
  });

  it('puts the labels the reviewer chose in the words of the rating screen, and drops a label it does not know', () => {
    expect(reviewTagsLine(['AS_AGREED', 'ON_TIME'])).toBe('Po dogovoru · Na vreme');
    expect(reviewTagsLine(['ON_TIME', 'FUNNY'])).toBe('Na vreme');
    expect(reviewTagsLine([])).toBeNull();
  });
});

describe('the list', () => {
  it('stands still while it reads: a bar a screen reader can name, no spinner and no figure', async () => {
    await draw(<ReceivedReviewsList view={{ kind: 'loading' }} />);
    expect(group().props.title).toBe('Komentari');
    expect(tree.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityLabel).toBe('Učitavamo komentare');
    expect(texts()).toHaveLength(0);
  });

  it('says a failed first read failed and offers it again, and never draws an empty list for it', async () => {
    const retry = jest.fn();
    await draw(<ReceivedReviewsList view={{ kind: 'error', onRetry: retry }} />);
    const state = hosts('StateView')[0];
    // The retry is quiet: when the average above failed too, its retry is the screen's one green action.
    expect(state.props).toMatchObject({ kind: 'error', title: 'Komentari trenutno nisu dostupni', quiet: { label: 'Pokušaj ponovo' } });
    expect(state.props.primary).toBeUndefined();
    state.props.quiet.onPress();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(texts()).not.toContain('Još niko nije napisao komentar.');
  });

  it('draws each review as the person who gave it, the stars, the day, the role, the labels, the task and the comment', async () => {
    await draw(<ReceivedReviewsList view={ready([review(1), review(2, { rating: 4, receivedAs: 'REQUESTER', tags: [], taskTitle: '', comment: null })])} />);
    expect(group().props.title).toBe('Komentari');
    const lines = texts();
    expect(lines).toContain('Ana P.');
    expect(lines).toContain(trenutak('2026-10-01T10:00:00.000000Z')!.dan);
    // What it was about and in which role are one quiet line; the task is left out of it (never invented) when the server has no title.
    expect(lines).toContain('Kreči stan · kad uskačeš');
    expect(lines).toContain('kad tražiš pomoć');
    expect(lines).toContain('Pažljivo · Na vreme');
    expect(hosts('ReviewCommentText').map(node => node.props.text)).toEqual(['Sve kako smo se dogovorili.']);
    expect(hosts('StarsRow').map(node => node.props.rating)).toEqual([5, 4]);
    // The second review has no labels, no task and no comment: nothing is drawn in their place.
    expect(lines.filter(line => line.includes('Kreči stan'))).toHaveLength(1);
  });

  it('says the name is not available for a masked face, instead of inventing a name or letters', async () => {
    await draw(<ReceivedReviewsList view={ready([masked(1)])} />);
    expect(texts()).toContain('Ime nije dostupno');
    expect(hosts('Avatar')[0].props.initials).toBeNull();
  });

  it('draws the photo the route gives for a face that is shown and has one, and the stand-in otherwise', async () => {
    const photo = jest.fn((_profileId: string, _size: 40, fallback: React.ReactNode) => <>{fallback}<T_Photo /></>);
    const withPhoto = review(1, { reviewer: { profileId: id(501), role: 'REQUESTER', displayName: 'Ana P.', avatarPath: 'a/b.jpg', masked: false } });
    await draw(<ReceivedReviewsList view={ready([withPhoto, review(2), masked(3)])} photo={photo} />);
    expect(photo).toHaveBeenCalledTimes(1);
    expect(photo.mock.calls[0].slice(0, 2)).toEqual([id(501), 40]);
  });

  it('speaks a review without a comment as one sentence, and leaves a review with a comment to be read line by line', async () => {
    await draw(<ReceivedReviewsList view={ready([review(1, { comment: null }), review(2)])} />);
    const items = tree.root.findAll(node => String(node.type) === 'View' && node.props.accessible === true);
    expect(items.map(node => node.props.accessibilityLabel)).toEqual([
      ['Ocena 5 od 5', 'Ana P.', 'Kreči stan', trenutak('2026-10-01T10:00:00.000000Z')!.dan, 'kad uskačeš'].join('. '), undefined]);
  });

  it('says how many reviews are not listed one by one and that they count in the average, only in the mode that leaves some out', async () => {
    await draw(<ReceivedReviewsList view={ready([review(1)], { totalCount: 4, notListedCount: 3 })} />);
    expect(texts()).toContain('3 ocene ulaze u prosek, ali se ne prikazuje pojedinačno.');
    await act(async () => tree.update(<ReceivedReviewsList view={ready([review(1)], { mode: 'ALL', totalCount: 1 })} />));
    expect(group().props.title).toBe('Sve ocene');
    expect(texts().join(' ')).not.toContain('ulaze u prosek');
  });

  it('draws nothing when there is nothing to say: no reviews and none left out', async () => {
    await draw(<ReceivedReviewsList view={ready([])} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('says no comment was written yet when the only things left are reviews that are not listed', async () => {
    await draw(<ReceivedReviewsList view={ready([], { totalCount: 2, notListedCount: 2 })} />);
    expect(texts()).toContain('Još niko nije napisao komentar.');
    expect(texts()).toContain('2 ocene ulaze u prosek, ali se ne prikazuje pojedinačno.');
  });

  it('offers the next page, shows it is waiting, and keeps the page that is shown when the next one failed', async () => {
    const more = jest.fn();
    await draw(<ReceivedReviewsList view={ready([review(1)], { hasMore: true, onMore: more })} />);
    const action = () => hosts('V2Action')[0];
    expect(action().props).toMatchObject({ label: 'Prikaži još', kind: 'secondary', loading: false });
    action().props.onPress();
    expect(more).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<ReceivedReviewsList view={ready([review(1)], { hasMore: true, more: 'loading', onMore: more })} />));
    expect(action().props.loading).toBe(true);
    await act(async () => tree.update(<ReceivedReviewsList view={ready([review(1)], { hasMore: true, more: 'error', onMore: more })} />));
    expect(action().props.label).toBe('Pokušaj ponovo');
    expect(texts()).toContain('Još ocena trenutno nije učitano.');
    expect(texts()).toContain('Ana P.');
  });

  it('offers no next page when there is none', async () => {
    await draw(<ReceivedReviewsList view={ready([review(1)])} />);
    expect(hosts('V2Action')).toHaveLength(0);
  });
});

function T_Photo() { return React.createElement('Photo'); }

type Probed = ReturnType<typeof useReceivedReviews>;
let probed: Probed;
function Probe() { probed = useReceivedReviews(); return null; }
const deferred = <V,>() => { let resolve!: (value: V) => void; const promise = new Promise<V>(done => { resolve = done; }); return { promise, resolve }; };

describe('the hook', () => {
  it('reads the first page of 20 for the signed-in account when it mounts, and holds what came back', async () => {
    mockReceived.mockResolvedValue({ ok: true, podatak: page([review(1), review(2)], { hasMore: true, nextAfter: CURSOR, totalCount: 9, notListedCount: 2 }) });
    await draw(<Probe />);
    expect(mockReceived.mock.calls).toEqual([[{ limit: 20 }, { accountId: A, accountRevision: 1 }]]);
    expect(probed.state).toMatchObject({ phase: 'ready', mode: 'COMMENTED_ONLY', hasMore: true, cursor: CURSOR, totalCount: 9, notListedCount: 2, more: 'idle' });
    expect(probed.state.items.map(item => item.reviewId)).toEqual([id(1), id(2)]);
  });

  it('is loading, with nothing in it, until the first answer', async () => {
    const first = deferred<unknown>();
    mockReceived.mockReturnValue(first.promise);
    await draw(<Probe />);
    expect(probed.state).toMatchObject({ phase: 'loading', items: [] });
    await act(async () => first.resolve({ ok: true, podatak: page([review(1)]) }));
    expect(probed.state.phase).toBe('ready');
  });

  it('a failed first read is an error and never an empty list, and reading again can recover', async () => {
    mockReceived.mockResolvedValueOnce({ ok: false, kod: 'RECEIVED_REVIEWS_READ_FAILED', poruka: 'x' });
    await draw(<Probe />);
    expect(probed.state).toMatchObject({ phase: 'error', items: [] });
    mockReceived.mockResolvedValueOnce({ ok: true, podatak: page([review(1)]) });
    await act(async () => { await probed.reload(); });
    expect(probed.state).toMatchObject({ phase: 'ready' });
    expect(probed.state.items).toHaveLength(1);
  });

  it('a read that throws is an error too', async () => {
    mockReceived.mockRejectedValue(new Error('network'));
    await draw(<Probe />);
    expect(probed.state.phase).toBe('error');
  });

  it('asks for the next page with the cursor it was given, adds it after the first and shows a review that came twice once', async () => {
    mockReceived.mockResolvedValueOnce({ ok: true, podatak: page([review(1), review(2)], { hasMore: true, nextAfter: CURSOR, totalCount: 3 }) });
    await draw(<Probe />);
    mockReceived.mockResolvedValueOnce({ ok: true, podatak: page([review(2), review(3)], { totalCount: 3 }) });
    await act(async () => { await probed.loadMore(); });
    expect(mockReceived.mock.calls[1]).toEqual([{ limit: 20, after: CURSOR }, { accountId: A, accountRevision: 1 }]);
    expect(probed.state.items.map(item => item.reviewId)).toEqual([id(1), id(2), id(3)]);
    expect(probed.state).toMatchObject({ hasMore: false, cursor: null, more: 'idle' });
  });

  it('asks for the next page once, however many times it is pressed while it is coming', async () => {
    mockReceived.mockResolvedValueOnce({ ok: true, podatak: page([review(1)], { hasMore: true, nextAfter: CURSOR, totalCount: 2 }) });
    await draw(<Probe />);
    const next = deferred<unknown>();
    mockReceived.mockReturnValueOnce(next.promise);
    await act(async () => { void probed.loadMore(); void probed.loadMore(); void probed.loadMore(); });
    expect(mockReceived).toHaveBeenCalledTimes(2);
    expect(probed.state.more).toBe('loading');
    await act(async () => next.resolve({ ok: true, podatak: page([review(2)], { totalCount: 2 }) }));
    expect(probed.state.items).toHaveLength(2);
  });

  it('keeps the page that is shown when the next one failed, and can ask for it again', async () => {
    mockReceived.mockResolvedValueOnce({ ok: true, podatak: page([review(1)], { hasMore: true, nextAfter: CURSOR, totalCount: 2 }) });
    await draw(<Probe />);
    mockReceived.mockResolvedValueOnce({ ok: false, kod: 'RECEIVED_REVIEWS_READ_FAILED', poruka: 'x' });
    await act(async () => { await probed.loadMore(); });
    expect(probed.state).toMatchObject({ phase: 'ready', more: 'error', hasMore: true });
    expect(probed.state.items).toHaveLength(1);
    mockReceived.mockResolvedValueOnce({ ok: true, podatak: page([review(2)], { totalCount: 2 }) });
    await act(async () => { await probed.loadMore(); });
    expect(probed.state.items).toHaveLength(2);
    expect(probed.state.more).toBe('idle');
  });

  it('asks for no next page when there is none', async () => {
    mockReceived.mockResolvedValue({ ok: true, podatak: page([review(1)]) });
    await draw(<Probe />);
    await act(async () => { await probed.loadMore(); });
    expect(mockReceived).toHaveBeenCalledTimes(1);
  });

  it('never shows one account\'s reviews for another: a new account starts from nothing, and a late answer for the old one is thrown away', async () => {
    const late = deferred<unknown>();
    mockReceived.mockReturnValueOnce(late.promise);
    await draw(<Probe />);
    mockUser = { id: B }; mockRevision = 2;
    mockReceived.mockResolvedValueOnce({ ok: true, podatak: page([review(7)]) });
    await act(async () => tree.update(<Probe />));
    expect(probed.state.items.map(item => item.reviewId)).toEqual([id(7)]);
    await act(async () => late.resolve({ ok: true, podatak: page([review(1), review(2)]) }));
    expect(probed.state.items.map(item => item.reviewId)).toEqual([id(7)]);
    expect(mockReceived.mock.calls.map(call => call[1])).toEqual([{ accountId: A, accountRevision: 1 }, { accountId: B, accountRevision: 2 }]);
  });

  it('is an error, and asks nothing, when nobody is signed in', async () => {
    mockUser = null;
    await draw(<Probe />);
    expect(probed.state.phase).toBe('error');
    expect(mockReceived).not.toHaveBeenCalled();
  });
});

describe('the section', () => {
  it('draws what the hook holds: the bar while reading, the retry on an error, the reviews when read', async () => {
    const first = deferred<unknown>();
    mockReceived.mockReturnValueOnce(first.promise);
    await draw(<ReceivedReviewsSection />);
    expect(tree.root.findAllByProps({ accessibilityRole: 'progressbar' }).length).toBeGreaterThan(0);
    await act(async () => first.resolve({ ok: false, kod: 'RECEIVED_REVIEWS_READ_FAILED', poruka: 'x' }));
    expect(hosts('StateView')[0].props.title).toBe('Komentari trenutno nisu dostupni');
    mockReceived.mockResolvedValueOnce({ ok: true, podatak: page([review(1)]) });
    await act(async () => hosts('StateView')[0].props.quiet.onPress());
    expect(texts()).toContain('Ana P.');
  });

  it('asks the next page when "Prikaži još" is pressed', async () => {
    mockReceived.mockResolvedValueOnce({ ok: true, podatak: page([review(1)], { hasMore: true, nextAfter: CURSOR, totalCount: 2 }) });
    await draw(<ReceivedReviewsSection />);
    mockReceived.mockResolvedValueOnce({ ok: true, podatak: page([review(2)], { totalCount: 2 }) });
    await act(async () => hosts('V2Action')[0].props.onPress());
    expect(mockReceived.mock.calls[1][0]).toEqual({ limit: 20, after: CURSOR });
    expect(hosts('StarsRow')).toHaveLength(2);
  });
});
