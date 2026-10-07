import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NO_AGE, TaskAgeContext, taskAgeOf, useTaskAge } from '../../ui/v2/discovery/taskAge';

/**
 * The age of a task on its card (UX plan 2.14): "Upravo", "pre 25 min", "pre 2 dana" ... only when the list really knows when the task was
 * published. The list knows it from the server's page rows; the card asks (`useTaskAge`), and where nothing is known the answer is null: no age
 * is ever invented, and a task of the person's own lists, a reader that does not read the time or a time that cannot be read has none.
 */
const NOW = new Date('2026-10-07T12:00:00Z'); // 14:00 in Belgrade
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

test('a task has the age of its publication in the words of the app, counted in Serbian days', () => {
  const published = new Map([['a', ago(2 * MIN)], ['b', ago(25 * MIN)], ['c', ago(3 * HOUR)], ['d', ago(DAY + HOUR)], ['e', ago(2 * DAY)],
    ['f', ago(15 * DAY)], ['g', ago(70 * DAY)]]);
  const ageOf = taskAgeOf(published, NOW);
  expect(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(ageOf)).toEqual(['Upravo', 'pre 25 min', 'pre 3 sata', 'juče', 'pre 2 dana', 'pre 2 nedelje', 'pre 2 meseca']);
});

test('a task the page does not know, a time that cannot be read and a time from the future have no age', () => {
  const ageOf = taskAgeOf(new Map([['known', ago(10 * MIN)], ['broken', 'nije vreme'], ['future', new Date(NOW.getTime() + DAY).toISOString()], ['blank', '']]), NOW);
  expect(ageOf('known')).toBe('pre 10 min');
  for (const id of ['unknown', 'broken', 'future', 'blank']) expect([id, ageOf(id)]).toEqual([id, null]);
});

test('without a page that says when tasks were published there is nothing to say', () => {
  expect(taskAgeOf(undefined, NOW)).toBe(NO_AGE);
  expect(taskAgeOf(new Map(), NOW)).toBe(NO_AGE);
  expect(NO_AGE('any')).toBeNull();
});

describe('a card asks, the list around it answers', () => {
  let tree: ReactTestRenderer | undefined;
  const seen: (string | null)[] = [];
  function Card({ id }: { id: string }) { seen.push(useTaskAge(id)); return null; }
  afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; seen.length = 0; });

  test('outside a list that knows, the answer is none', async () => {
    await act(async () => { tree = create(<Card id="a" />); });
    expect(seen).toEqual([null]);
  });

  test('inside the list, the answer is the age of that task', async () => {
    const value = taskAgeOf(new Map([['a', ago(25 * MIN)]]), NOW);
    await act(async () => { tree = create(<TaskAgeContext.Provider value={value}><Card id="a" /><Card id="other" /></TaskAgeContext.Provider>); });
    expect(seen).toEqual(['pre 25 min', null]);
  });
});
