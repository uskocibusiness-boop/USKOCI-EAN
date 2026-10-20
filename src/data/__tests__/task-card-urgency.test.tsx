import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { MarketplaceItem } from '../marketplaceView';

/**
 * An expired HITNO left an empty row at the top of a task card (plan step 0, 2026-09-23). The card decided to draw the
 * status row from the raw level, while the badge inside it reads the server's expiry and had already gone. The card
 * now asks the same expiry, on the same clock, before drawing the row.
 */
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Glyph', () => ({ Glyph: 'Glyph' }));
jest.mock('phosphor-react-native', () => ({ Lightning: 'Lightning' }));
import { TaskCard } from '../../ui/v2/TaskCard';
import { NeedUrgencyBadge } from '../../ui/v2/NeedUrgencyBadge';

const task = (patch: Partial<MarketplaceItem> = {}): MarketplaceItem => ({ id: 'need-1', naslov: 'Pomoć pri selidbi', podrucjeTekst: 'Novi Sad',
  vremeTekst: 'Po dogovoru', uslovi: [], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, ...patch } as MarketplaceItem);
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string'));
/** The status row is the first child of the card, a row that holds the status or a spacer and the badge. */
const topRow = () => tree.root.findByType('Press' as React.ElementType).children[0] as ReactTestRenderer['root'];
beforeEach(() => { jest.useFakeTimers({ now: new Date('2026-09-23T10:00:00Z') }); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); });

it('draws no top row for an expired HITNO on a task with no status', async () => {
  await act(async () => { tree = create(<TaskCard item={task({ urgency: { level: 'HITNO', expiresAt: '2026-09-23T09:59:59Z' } })} onOpen={jest.fn()} />); });
  expect(texts()).not.toContain('HITNO');
  // The first child is now the title row, not an empty status row.
  expect(topRow().findAllByType('T' as React.ElementType)[0].props.children).toBe('Pomoć pri selidbi');
});

it('draws the badge while HITNO holds and drops the row the moment it expires', async () => {
  await act(async () => { tree = create(<TaskCard item={task({ urgency: { level: 'HITNO', expiresAt: '2026-09-23T10:00:05Z' } })} onOpen={jest.fn()} />); });
  expect(texts()).toContain('HITNO');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'HITNO' }).length).toBeGreaterThan(0);
  await act(async () => { jest.advanceTimersByTime(6_000); });
  expect(texts()).not.toContain('HITNO');
  expect(topRow().findAllByType('T' as React.ElementType)[0].props.children).toBe('Pomoć pri selidbi');
});

// One clock per card (review of plan step 0, 2026-09-24): the card and its badge each ran a timer, which could leave one
// frame where the row stayed and the badge had gone. The card now hands its clock to the badge.
it('runs one urgency timer per card and hands that clock to the badge', async () => {
  const timers = jest.spyOn(global, 'setTimeout');
  try {
    await act(async () => { tree = create(<TaskCard item={task({ urgency: { level: 'HITNO', expiresAt: '2026-09-23T10:00:05Z' } })} onOpen={jest.fn()} />); });
    expect(tree.root.findByType(NeedUrgencyBadge).props.now).toBe(Date.parse('2026-09-23T10:00:00Z'));
    expect(timers).toHaveBeenCalledTimes(1);
  } finally { timers.mockRestore(); }
});

it('a badge given a clock follows it and runs no timer; without one it keeps its own', async () => {
  const urgency = { level: 'HITNO', expiresAt: '2026-09-23T10:00:05Z' } as const;
  const timers = jest.spyOn(global, 'setTimeout');
  try {
    await act(async () => { tree = create(<NeedUrgencyBadge urgency={urgency} now={Date.parse('2026-09-23T10:00:06Z')} />); });
    expect(tree.toJSON()).toBeNull();
    await act(async () => tree.update(<NeedUrgencyBadge urgency={urgency} now={Date.parse('2026-09-23T10:00:04Z')} />));
    expect(tree.root.findAllByProps({ accessibilityLabel: 'HITNO' }).length).toBeGreaterThan(0);
    expect(timers).not.toHaveBeenCalled();
    // The detail screens pass no clock: the badge runs its own, reads 10:00:00 here, and leaves at the expiry.
    await act(async () => tree.update(<NeedUrgencyBadge urgency={urgency} />));
    expect(tree.root.findAllByProps({ accessibilityLabel: 'HITNO' }).length).toBeGreaterThan(0);
    expect(timers).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(6_000); });
    expect(tree.toJSON()).toBeNull();
  } finally { timers.mockRestore(); }
});

it('keeps a status row when there is a status, with or without HITNO', async () => {
  await act(async () => { tree = create(<TaskCard item={task({ urgency: { level: 'HITNO', expiresAt: '2026-09-23T09:00:00Z' } })} relation="APPLIED" onOpen={jest.fn()} />); });
  expect(texts()).toContain('Prijava poslata'); expect(texts()).not.toContain('HITNO');
});
