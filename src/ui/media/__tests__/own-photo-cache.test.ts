let mockSession: { user: { id: string } | null; accountRevision: number } = { user: { id: 'account-a' }, accountRevision: 1 };
let mockAppState = 'active';
const mockListeners = new Set<(state: string) => void>();
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const state = {
    get currentState() { return mockAppState; },
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) };
    },
  };
  return new Proxy(actual, { get: (target, key) => key === 'AppState' ? state : Reflect.get(target, key) });
});
jest.mock('../../../store/sesija', () => ({ sesijaSada: () => mockSession }));

import { OWN_PHOTO_FRESH_MS, OWN_PHOTO_KEEP_MS, OWN_PHOTO_MAX_ENTRIES, ownPhotoCache, type OwnPhotoScope } from '../ownPhotoCache';

const A: OwnPhotoScope = { accountId: 'account-a', accountRevision: 1 };
const photo = (assetId: string) => ({ assetId, width: 800, height: 800, contentType: 'image/jpeg' as const });
const minutes = (count: number) => count * 60_000;
let now = 1_000_000;
/** What a visit that read both steps leaves behind. */
const learn = (scope = A, profileId = 'profile-a', assetId = 'asset-a') => {
  const mark = ownPhotoCache.mark();
  ownPhotoCache.rememberDescription(scope, profileId, photo(assetId), mark);
  ownPhotoCache.rememberImage(scope, profileId, assetId, `uri-${assetId}`, mark);
};
/** The operating system tells the app it left, or came back to, the front. */
const appState = (state: string) => { mockAppState = state; mockListeners.forEach(listener => listener(state)); };

beforeEach(() => {
  now = 1_000_000; jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockAppState = 'active';
  ownPhotoCache.forget();
});
afterEach(() => { jest.restoreAllMocks(); });

it('finds what it remembered under the exact account, revision and profile, and nothing under any other', () => {
  learn();
  expect(ownPhotoCache.description(A, 'profile-a')).toEqual({ photo: photo('asset-a'), fresh: true });
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBe('uri-asset-a');
  for (const other of [{ ...A, accountId: 'account-b' }, { ...A, accountRevision: 2 }]) {
    expect(ownPhotoCache.description(other, 'profile-a')).toBeUndefined();
    expect(ownPhotoCache.image(other, 'profile-a', 'asset-a')).toBeUndefined();
  }
  expect(ownPhotoCache.description(A, 'profile-b')).toBeUndefined();
  expect(ownPhotoCache.image(A, 'profile-b', 'asset-a')).toBeUndefined();
  // A new photograph is a new asset, so it is a new key: the old picture is never offered for it.
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-b')).toBeUndefined();
});

it('is fresh for ten minutes, still drawn but asked again up to thirty, and gone after that', () => {
  learn();
  now += OWN_PHOTO_FRESH_MS;
  expect(ownPhotoCache.description(A, 'profile-a')).toMatchObject({ fresh: true });
  now += 1;
  expect(ownPhotoCache.description(A, 'profile-a')).toMatchObject({ photo: photo('asset-a'), fresh: false });
  now = 1_000_000 + OWN_PHOTO_KEEP_MS;
  expect(ownPhotoCache.description(A, 'profile-a')).toBeDefined();
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBe('uri-asset-a');
  now += 1;
  expect(ownPhotoCache.description(A, 'profile-a')).toBeUndefined();
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBeUndefined();
});

it('does not believe a record from the future (the clock was set back)', () => {
  learn(); now -= 1;
  expect(ownPhotoCache.description(A, 'profile-a')).toBeUndefined();
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBeUndefined();
});

it('forgets a profile\'s description and pictures when the answer says it has no photograph, and leaves other profiles alone', () => {
  learn(A, 'profile-a', 'asset-a'); learn(A, 'profile-b', 'asset-b');
  ownPhotoCache.rememberDescription(A, 'profile-a', null, ownPhotoCache.mark());
  expect(ownPhotoCache.description(A, 'profile-a')).toBeUndefined();
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBeUndefined();
  expect(ownPhotoCache.description(A, 'profile-b')).toBeDefined();
  expect(ownPhotoCache.image(A, 'profile-b', 'asset-b')).toBe('uri-asset-b');
});

it('lets another photograph replace the remembered one and take its picture, while the same photograph confirms its picture', () => {
  learn();
  now += minutes(25);
  ownPhotoCache.rememberDescription(A, 'profile-a', photo('asset-a'), ownPhotoCache.mark());
  // Fifty minutes after the picture was read, but twenty-five after the profile last said it is the photograph.
  now += minutes(25);
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBe('uri-asset-a');
  ownPhotoCache.rememberDescription(A, 'profile-a', photo('asset-b'), ownPhotoCache.mark());
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBeUndefined();
  expect(ownPhotoCache.description(A, 'profile-a')?.photo.assetId).toBe('asset-b');
});

it('holds at most four descriptions and four pictures and gives up the least recently used first', () => {
  expect(OWN_PHOTO_MAX_ENTRIES).toBe(4);
  for (const n of [1, 2, 3, 4]) learn(A, `profile-${n}`, `asset-${n}`);
  // Looking at the first one makes the second the least recently used.
  expect(ownPhotoCache.description(A, 'profile-1')).toBeDefined();
  expect(ownPhotoCache.image(A, 'profile-1', 'asset-1')).toBeDefined();
  learn(A, 'profile-5', 'asset-5');
  expect(ownPhotoCache.description(A, 'profile-2')).toBeUndefined();
  expect(ownPhotoCache.image(A, 'profile-2', 'asset-2')).toBeUndefined();
  for (const n of [1, 3, 4, 5]) {
    expect(ownPhotoCache.description(A, `profile-${n}`)).toBeDefined();
    expect(ownPhotoCache.image(A, `profile-${n}`, `asset-${n}`)).toBe(`uri-asset-${n}`);
  }
});

it('does not remember a picture too large to hold', () => {
  const mark = ownPhotoCache.mark();
  ownPhotoCache.rememberImage(A, 'profile-a', 'asset-a', 'x'.repeat(3_000_001), mark);
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBeUndefined();
  ownPhotoCache.rememberImage(A, 'profile-a', 'asset-a', 'x'.repeat(3_000_000), mark);
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toHaveLength(3_000_000);
});

it.each(['background', 'inactive'])('forgets everything when the app goes to %s', state => {
  learn(); appState(state);
  expect(ownPhotoCache.description(A, 'profile-a')).toBeUndefined();
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBeUndefined();
});

it('keeps everything when the app only becomes active', () => {
  learn(); appState('active');
  expect(ownPhotoCache.description(A, 'profile-a')).toBeDefined();
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBe('uri-asset-a');
});

it('lets a read that began before the app left the front remember nothing after it, and a read that begins later remember again', () => {
  const early = ownPhotoCache.mark();
  appState('background'); appState('active');
  ownPhotoCache.rememberDescription(A, 'profile-a', photo('asset-a'), early);
  ownPhotoCache.rememberImage(A, 'profile-a', 'asset-a', 'uri-asset-a', early);
  expect(ownPhotoCache.description(A, 'profile-a')).toBeUndefined();
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBeUndefined();
  learn();
  expect(ownPhotoCache.description(A, 'profile-a')).toBeDefined();
});

it('remembers nothing while the app is not in front, even before the event has arrived', () => {
  const mark = ownPhotoCache.mark(); mockAppState = 'background';
  ownPhotoCache.rememberDescription(A, 'profile-a', photo('asset-a'), mark);
  ownPhotoCache.rememberImage(A, 'profile-a', 'asset-a', 'uri-asset-a', mark);
  mockAppState = 'active';
  expect(ownPhotoCache.description(A, 'profile-a')).toBeUndefined();
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBeUndefined();
});

it('refuses a record for a session that is no longer the signed-in one: another account, a newer revision, or nobody', () => {
  const mark = ownPhotoCache.mark();
  for (const session of [{ user: { id: 'account-b' }, accountRevision: 2 }, { user: { id: 'account-a' }, accountRevision: 3 }, { user: null, accountRevision: 4 }]) {
    mockSession = session;
    ownPhotoCache.rememberDescription(A, 'profile-a', photo('asset-a'), mark);
    ownPhotoCache.rememberImage(A, 'profile-a', 'asset-a', 'uri-asset-a', mark);
  }
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 };
  expect(ownPhotoCache.description(A, 'profile-a')).toBeUndefined();
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBeUndefined();
});

it('throws away what another account left behind as soon as a record of the signed-in one is accepted', () => {
  learn();
  const B: OwnPhotoScope = { accountId: 'account-b', accountRevision: 2 };
  mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  learn(B, 'profile-b', 'asset-b');
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 };
  expect(ownPhotoCache.description(A, 'profile-a')).toBeUndefined();
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBeUndefined();
  expect(ownPhotoCache.description(B, 'profile-b')).toBeDefined();
});

it('forgets everything on request and refuses the reads that began before it', () => {
  const early = ownPhotoCache.mark();
  learn(); ownPhotoCache.forget();
  expect(ownPhotoCache.description(A, 'profile-a')).toBeUndefined();
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBeUndefined();
  ownPhotoCache.rememberDescription(A, 'profile-a', photo('asset-a'), early);
  ownPhotoCache.rememberImage(A, 'profile-a', 'asset-a', 'uri-asset-a', early);
  expect(ownPhotoCache.description(A, 'profile-a')).toBeUndefined();
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBeUndefined();
});

it('drops one picture that could not be drawn and leaves the others', () => {
  learn(A, 'profile-a', 'asset-a'); learn(A, 'profile-b', 'asset-b');
  ownPhotoCache.forgetImage(A, 'profile-a', 'asset-a');
  expect(ownPhotoCache.image(A, 'profile-a', 'asset-a')).toBeUndefined();
  expect(ownPhotoCache.image(A, 'profile-b', 'asset-b')).toBe('uri-asset-b');
});
