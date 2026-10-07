import { act, create } from 'react-test-renderer';
import { displaysUrgent, urgentBuilt } from '../../lib/needUrgency';
import { NeedUrgencyBadge } from '../../ui/v2/NeedUrgencyBadge';

// Owner 2026-10-07: no separate HITNO in the first release. Jest compiles HITNO in (jest.urgent-env.cjs); a real build
// has no EXPO_PUBLIC_URGENT, which these cases reproduce by clearing it.
const saved = process.env.EXPO_PUBLIC_URGENT;
const live = { level: 'HITNO', expiresAt: new Date(Date.now() + 3_600_000).toISOString() } as never;
afterEach(() => { if (saved === undefined) delete process.env.EXPO_PUBLIC_URGENT; else process.env.EXPO_PUBLIC_URGENT = saved; });

it('a build without the flag never shows HITNO, even for a live HITNO task', () => {
  delete process.env.EXPO_PUBLIC_URGENT;
  expect(urgentBuilt()).toBe(false);
  expect(displaysUrgent(live)).toBe(false);
});

it('only the exact flag value compiles HITNO in', () => {
  expect(urgentBuilt('1')).toBe(true);
  for (const value of [null, '', '0', 'true', 1]) expect(urgentBuilt(value)).toBe(false);
  process.env.EXPO_PUBLIC_URGENT = '1';
  expect(displaysUrgent(live)).toBe(true);
});

it('the HITNO badge draws nothing in a V1 build', () => {
  delete process.env.EXPO_PUBLIC_URGENT;
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(<NeedUrgencyBadge urgency={live} now={Date.now()} />); });
  expect(tree.toJSON()).toBeNull();
  act(() => tree.unmount());
});
