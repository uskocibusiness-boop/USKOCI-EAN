import { confirmedDiscoveryMapPlaceKey, parseSettledMapPlace, readSettledMapPlace, settledMapPlaceMatches,
  writeSettledMapPlace, type SettledMapPlace } from '../confirmedDiscoveryMapPlace';

const place: SettledMapPlace = { label: 'Novi Sad, Srbija', position: { latitude: 45.25, longitude: 19.84 },
  area: [19.7, 45.1, 20, 45.4] };

function memory() {
  const entries = new Map<string, string>();
  return { entries, getItem: jest.fn(async (key: string) => entries.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { entries.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { entries.delete(key); }) };
}

test('only a valid confirmed coarse place and its settled area can be restored', () => {
  expect(parseSettledMapPlace(JSON.stringify(place))).toEqual(place);
  for (const value of [null, '{', JSON.stringify({ ...place, label: ' ' }),
    JSON.stringify({ ...place, position: { latitude: 99, longitude: 19.84 } }),
    JSON.stringify({ ...place, area: [20, 45, 19, 46] })]) expect(parseSettledMapPlace(value)).toBeNull();
  expect(settledMapPlaceMatches(place, [...place.area])).toBe(true);
  expect(settledMapPlaceMatches(place, [19.71, 45.1, 20, 45.4])).toBe(false);
  expect(settledMapPlaceMatches(place, null)).toBe(false);
});

test('a valid long provider label survives local restoration', async () => {
  const storage = memory();
  const longPlace = { ...place, label: `Novi Sad, ${'Srbija '.repeat(20).trim()}` };
  expect(longPlace.label.length).toBeGreaterThan(120);
  await writeSettledMapPlace('account-a', longPlace, storage);
  expect(await readSettledMapPlace('account-a', storage)).toEqual(longPlace);
  expect(parseSettledMapPlace(JSON.stringify({ ...longPlace, label: 'Novi\nSad' }))).toBeNull();
});

test('the place is account scoped, and clearing follows an unfinished write', async () => {
  const storage = memory();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  storage.setItem.mockImplementationOnce(async (key, value) => { await gate; storage.entries.set(key, value); });
  const first = writeSettledMapPlace('account-a', place, storage);
  const clear = writeSettledMapPlace('account-a', null, storage);
  release(); await Promise.all([first, clear]);
  expect(await readSettledMapPlace('account-a', storage)).toBeNull();
  await writeSettledMapPlace('account-b', place, storage);
  expect(await readSettledMapPlace('account-b', storage)).toEqual(place);
  expect(storage.entries.has(confirmedDiscoveryMapPlaceKey('account-a'))).toBe(false);
  expect(storage.entries.has(confirmedDiscoveryMapPlaceKey('account-b'))).toBe(true);
});
