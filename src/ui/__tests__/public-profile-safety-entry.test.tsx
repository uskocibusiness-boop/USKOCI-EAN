import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { JavniProfilProjekcija } from '../../contracts/projections';
const P = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', N = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const mockNavigate = jest.fn();
const mockReadTarget = jest.fn();
let mockFocused = true;
jest.mock('expo-router', () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(
    () => mockFocused ? effect() : undefined, [effect, mockFocused]),
}));
jest.mock('../../data/safetyClientService', () => ({ safetyClientService: { readTarget: (...args: unknown[]) => mockReadTarget(...args) } }));
import { PublicProfileSheet } from '../system/PublicProfileSheet';
import { useSafetyEntry } from '../safety/useSafetyEntry';

const profile = (): JavniProfilProjekcija => ({ profilId: P, uloga: 'narucilac', ime: 'Marko', avatarPutanja: null, grad: 'Novi Sad',
  naslov: null, biografija: null, poverenje: { ocenaProsek: null, brojRecenzija: 0, zavrseniBroj: 0, identitetVerifikovan: false,
    ocenaDostupna: false, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: false } });
// The sheet is presentation; the entry it offers belongs to the screen, so the test wires the real hook.
function Harness({ profileId = P, needId = N }: { profileId?: string; needId?: string } = {}) {
  const safety = useSafetyEntry(profileId, { needId });
  return <PublicProfileSheet state={{ loading: false, data: profile() }} onClose={() => {}} onRetry={() => {}} safety={safety} />;
}
const find = (tree: ReactTestRenderer, label: string) => tree.root.findAll(node =>
  typeof node.type !== 'string' && node.props?.accessibilityRole === 'button' && String(node.props?.accessibilityLabel ?? '').includes(label))[0];
const alerts = (tree: ReactTestRenderer) => tree.root.findAll(n => n.props?.accessibilityRole === 'alert')
  .map(n => JSON.stringify(n.props.children)).join(' ');

beforeEach(() => { mockFocused = true; mockNavigate.mockReset(); mockReadTarget.mockReset(); });

it('offers one entry from the profile and opens bezbednost with the person the server resolved', async () => {
  mockReadTarget.mockResolvedValue({ ok: true, podatak: { profileId: P, available: true,
    target: { accountId: 'me', targetAccountId: B, blocked: false, revision: 2, authoritative: true } } });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Harness />); });
  const press = find(tree, 'Prijavi ili blokiraj');
  expect(press).toBeTruthy();
  await act(async () => { press.props.onPress(); });
  expect(mockReadTarget).toHaveBeenCalledWith(P);
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/bezbednost', params: { targetAccountId: B, needId: N } });
});

it('says plainly that there is no target instead of opening a screen that cannot act', async () => {
  mockReadTarget.mockResolvedValue({ ok: true, podatak: { profileId: P, available: false, target: null } });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Harness />); });
  await act(async () => { find(tree, 'Prijavi ili blokiraj').props.onPress(); });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(alerts(tree)).toContain('Osoba trenutno nije dostupna');
});

it('carries the server refusal without inventing a navigation', async () => {
  mockReadTarget.mockResolvedValue({ ok: false, kod: 'SAFETY_TARGET_READ_UNAVAILABLE', poruka: 'Podaci trenutno nisu dostupni.' });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Harness />); });
  await act(async () => { find(tree, 'Prijavi ili blokiraj').props.onPress(); });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(alerts(tree)).toContain('Podaci trenutno nisu dostupni');
});

it('does not send a second read while the first is still open', async () => {
  let resolve!: (value: unknown) => void;
  mockReadTarget.mockImplementation(() => new Promise(r => { resolve = r; }));
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Harness />); });
  const press = () => find(tree, 'Prijavi ili blokiraj').props.onPress();
  await act(async () => { press(); press(); });
  expect(mockReadTarget).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ ok: true, podatak: { profileId: P, available: false, target: null } }); });
});

const allowed = () => ({ ok: true, podatak: { profileId: P, available: true,
  target: { accountId: 'me', targetAccountId: B, blocked: false, revision: 2, authoritative: true } } });
const deferred = () => { let resolve!: (value: unknown) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

it('a delayed safety target cannot navigate after the screen unmounts', async () => {
  const pending = deferred(); mockReadTarget.mockReturnValue(pending.promise);
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Harness />); });
  await act(async () => { find(tree, 'Prijavi ili blokiraj').props.onPress(); });
  await act(async () => { tree.unmount(); });
  await act(async () => { pending.resolve(allowed()); });
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('blur retires a lookup even if the same screen is focused again before it answers', async () => {
  const first = deferred(); mockReadTarget.mockReturnValueOnce(first.promise).mockResolvedValue(allowed());
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Harness />); });
  await act(async () => { find(tree, 'Prijavi ili blokiraj').props.onPress(); });
  mockFocused = false; await act(async () => { tree.update(<Harness />); });
  mockFocused = true; await act(async () => { tree.update(<Harness />); });
  await act(async () => { first.resolve(allowed()); });
  expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => { find(tree, 'Prijavi ili blokiraj').props.onPress(); });
  expect(mockReadTarget).toHaveBeenCalledTimes(2);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  await act(async () => { tree.unmount(); });
});

it.each(['profile', 'context'] as const)('changing the %s retires both the old result and its retained press handler', async changed => {
  const pending = deferred(); mockReadTarget.mockReturnValue(pending.promise);
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Harness />); });
  const previousPress = find(tree, 'Prijavi ili blokiraj').props.onPress;
  await act(async () => { previousPress(); });
  const profileId = changed === 'profile' ? 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' : P;
  const needId = changed === 'context' ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : N;
  await act(async () => { tree.update(<Harness profileId={profileId} needId={needId} />); });
  await act(async () => { pending.resolve(allowed()); previousPress(); });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockReadTarget).toHaveBeenCalledTimes(1);
  mockReadTarget.mockResolvedValue(allowed());
  await act(async () => { find(tree, 'Prijavi ili blokiraj').props.onPress(); });
  expect(mockReadTarget).toHaveBeenLastCalledWith(profileId);
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/bezbednost', params: { targetAccountId: B, needId } });
  await act(async () => { tree.unmount(); });
});

it('a retired rejection cannot clear a newer lookup or add an old error', async () => {
  const first = deferred(), second = deferred(); mockReadTarget.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Harness />); });
  await act(async () => { find(tree, 'Prijavi ili blokiraj').props.onPress(); });
  mockFocused = false; await act(async () => { tree.update(<Harness />); });
  mockFocused = true; await act(async () => { tree.update(<Harness />); });
  await act(async () => { find(tree, 'Prijavi ili blokiraj').props.onPress(); });
  await act(async () => { first.reject(new Error('retired')); });
  expect(alerts(tree)).not.toContain('Nismo uspeli');
  expect(find(tree, 'Prijavi ili blokiraj').props.disabled).toBe(true);
  expect(mockReadTarget).toHaveBeenCalledTimes(2);
  await act(async () => { second.resolve(allowed()); });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  await act(async () => { tree.unmount(); });
});
