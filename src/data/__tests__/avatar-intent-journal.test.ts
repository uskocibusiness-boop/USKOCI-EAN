const mockValues = new Map<string, string>();
const mockGet = jest.fn(), mockSet = jest.fn(), mockRemove = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (...args: unknown[]) => mockGet(...args), setItem: (...args: unknown[]) => mockSet(...args),
  removeItem: (...args: unknown[]) => mockRemove(...args),
} }));
import { replaceAvatarIntent } from '../avatarIntentJournal';

const key = 'uskoci:media-upload:owner:AVATAR:profile', current = () => true;
beforeEach(() => {
  mockValues.clear();
  mockGet.mockReset().mockImplementation(async (k: string) => mockValues.get(k) ?? null);
  mockSet.mockReset().mockImplementation(async (k: string, value: string) => { mockValues.set(k, value); });
  mockRemove.mockReset().mockImplementation(async (k: string) => { mockValues.delete(k); });
});
it('serializes competing mounted editors so only one can claim the empty avatar slot', async () => {
  await expect(Promise.all([
    replaceAvatarIntent(key, null, 'first', current), replaceAvatarIntent(key, null, 'second', current),
  ])).resolves.toEqual([true, false]);
  expect(mockValues.get(key)).toBe('first'); expect(mockSet).toHaveBeenCalledTimes(1);
});
it('an old clear queued behind a newer phase cannot erase it', async () => {
  mockValues.set(key, 'UPLOAD');
  await expect(Promise.all([
    replaceAvatarIntent(key, 'UPLOAD', 'DISCARD', current), replaceAvatarIntent(key, 'UPLOAD', null, current),
  ])).resolves.toEqual([true, false]);
  expect(mockValues.get(key)).toBe('DISCARD'); expect(mockRemove).not.toHaveBeenCalled();
});
it('does not write when ownership changes during the storage read, including A→B→A', async () => {
  let revision = 1;
  mockGet.mockImplementationOnce(async () => { revision = 3; return null; });
  await expect(replaceAvatarIntent(key, null, 'UPLOAD', () => revision === 1)).resolves.toBe(false);
  expect(mockSet).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled();
});
it('does not turn a storage failure into success and the queue remains usable afterward', async () => {
  mockValues.set(key, 'DISCARD'); mockRemove.mockRejectedValueOnce(new Error('disk unavailable'));
  await expect(replaceAvatarIntent(key, 'DISCARD', null, current)).rejects.toThrow('disk unavailable');
  expect(mockValues.get(key)).toBe('DISCARD');
  await expect(replaceAvatarIntent(key, 'DISCARD', null, current)).resolves.toBe(true);
  expect(mockValues.has(key)).toBe(false);
});
it('never overwrites an unseen malformed journal as though it were an empty slot', async () => {
  mockValues.set(key, '{broken');
  await expect(replaceAvatarIntent(key, null, 'UPLOAD', current)).resolves.toBe(false);
  expect(mockValues.get(key)).toBe('{broken'); expect(mockSet).not.toHaveBeenCalled();
});
