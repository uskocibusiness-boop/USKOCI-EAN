import type { DogovorProjekcija } from '../../contracts/projections';
import { groupAgreementTasks } from '../../ui/agreements/agreementListModel';
import { ownerCapacityNeedIds, ownerTaskCapacity } from '../../ui/agreements/ownerTaskCapacity';

const need = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number, requester = true, state = 'CONFIRMED'): DogovorProjekcija => ({
  id: `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  stanje: state, izvor: { zadatakId: need(n), prijavaId: null },
  ucesnici: [{ viSte: true, uloga: requester ? 'narucilac' : 'uskocer' }],
} as DogovorProjekcija);

test('optional owner reads include single collaborations, prefer active tasks and stop at twelve distinct tasks', () => {
  const rows = [row(1, true, 'CANCELLED'), ...Array.from({ length: 14 }, (_, index) => row(index + 2)), row(99, false)];
  const ids = ownerCapacityNeedIds(rows);
  expect(ids).toHaveLength(12);
  expect(ids).not.toContain(need(1));
  expect(ids).not.toContain(need(99));
  expect(ids[0]).toBe(need(2));
});

test('owner coverage requires a matched, internally consistent authoritative task response', () => {
  const group = groupAgreementTasks([row(1)])[0];
  const state = { schemaVersion: 1, authoritative: true, serverAsOf: '2026-10-21T10:00:00Z', needId: need(1),
    revision: 7, status: 'SELECTION', requiredSlots: 3, coveredSlots: 2, missingSlots: 1,
    searchAuthority: 'CLOSED', closedAt: '2026-10-21T09:00:00Z', searchTimeAdmitted: true,
    canReopen: true, reason: 'CAN_REOPEN', nextAction: 'REOPEN_SEARCH', agreementCount: 3,
    activeAgreementCount: 2, awaitingConfirmationCount: 0, openProblemCount: 0 };
  expect(ownerTaskCapacity(group, state as any)?.count).toBe('Potvrđeno 2/3');
  expect(ownerTaskCapacity(group, { ...state, missingSlots: 0 } as any)?.count).toBeNull();
  expect(ownerTaskCapacity(group, { ...state, revision: 0 } as any)?.count).toBeNull();
  expect(ownerTaskCapacity(group, { ...state, needId: need(2) } as any)?.count).toBeNull();
  expect(ownerTaskCapacity(groupAgreementTasks([row(1, false)])[0], state as any)).toBeNull();
});
