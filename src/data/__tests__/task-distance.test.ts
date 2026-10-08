import type { MarketplaceItem } from '../marketplaceView';
import { distanceKm, distanceOf, distanceWords } from '../../ui/v2/discovery/taskDistance';

/**
 * "mesto · udaljenost" on a task card (the owner-approved plan, U2 and U3) is said only when the app really has both ends: the task's PUBLIC point (rounded on purpose,
 * about a kilometre) and the one place the person said they are. Nothing is invented: a person who has not asked for their position is not told how far anything is,
 * and a task that is not on the map has no distance. Whole kilometres, because a finer figure would be false.
 */
const task = (extra: Record<string, unknown> = {}) => ({ id: 't1', naslov: 'Selidba', ...extra }) as unknown as MarketplaceItem;
const NOVI_SAD: readonly [number, number] = [19.8451, 45.2551];
const BEOGRAD = { lat: 44.7866, lng: 20.4489 };

test('the great-circle distance between two points is in kilometres', () => {
  expect(distanceKm(NOVI_SAD, { lat: 45.2551, lng: 19.8451 })).toBe(0);
  const between = distanceKm(NOVI_SAD, BEOGRAD);
  expect(between).toBeGreaterThan(60);
  expect(between).toBeLessThan(80);
  // one degree of latitude is about 111 km, whatever the longitude
  expect(distanceKm([20, 45], { lat: 46, lng: 20 })).toBeCloseTo(111.19, 1);
});

test('under a kilometre it says "manje od 1 km", otherwise whole kilometres with "oko"', () => {
  expect(distanceWords(0)).toBe('manje od 1 km');
  expect(distanceWords(0.99)).toBe('manje od 1 km');
  expect(distanceWords(1)).toBe('oko 1 km');
  expect(distanceWords(2.4)).toBe('oko 2 km');
  expect(distanceWords(2.6)).toBe('oko 3 km');
  expect(distanceWords(12.49)).toBe('oko 12 km');
});

test('a task with a public point is as far as the person who said where they are', () => {
  // Telep is about 4 km from the centre of Novi Sad
  const near = task({ priblizno: { lat: 45.24, lng: 19.8 } });
  expect(distanceOf(NOVI_SAD, near)).toBe('oko 4 km');
  expect(distanceOf(NOVI_SAD, task({ priblizno: { lat: 45.26, lng: 19.85 } }))).toBe('manje od 1 km');
});

test('no position, no point, or a task done remotely: no distance, and nothing is made up', () => {
  const point = { lat: 45.24, lng: 19.8 };
  // the person has not asked for their position
  expect(distanceOf(null, task({ priblizno: point }))).toBeNull();
  // a task placed nowhere
  expect(distanceOf(NOVI_SAD, task())).toBeNull();
  expect(distanceOf(NOVI_SAD, task({ priblizno: null }))).toBeNull();
  // remote work has no place to be far from, even when a point is left on it
  expect(distanceOf(NOVI_SAD, task({ priblizno: point, detalji: { rezimLokacije: 'REMOTE' } }))).toBeNull();
  // a point that is not a place on Earth is not one
  expect(distanceOf(NOVI_SAD, task({ priblizno: { lat: 95, lng: 19.8 } }))).toBeNull();
  expect(distanceOf(NOVI_SAD, task({ priblizno: { lat: Number.NaN, lng: 19.8 } }))).toBeNull();
  expect(distanceOf([Number.NaN, 45], task({ priblizno: point }))).toBeNull();
});
