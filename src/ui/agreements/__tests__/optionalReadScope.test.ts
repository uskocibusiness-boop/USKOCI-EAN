import type { DogovorProjekcija } from '../../../contracts/projections';
import { ownerCapacityNeedIds } from '../ownerTaskCapacity';
import { cancelledIdsForVisibleAgreementGroups, visibleAgreementTaskGroups, type AgreementOptionalReadView } from '../optionalReadScope';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const agreement = (n: number, task: number | null, state: DogovorProjekcija['stanje'],
  role: 'narucilac' | 'uskocer' = 'narucilac', extra: Partial<DogovorProjekcija> = {}): DogovorProjekcija => ({
  id: id(n), stanje: state, izvor: { zadatakId: task === null ? null : id(task), prijavaId: null },
  ucesnici: [{ viSte: true, uloga: role }], ocenaMoguca: false,
  ...extra,
} as unknown as DogovorProjekcija);
const base: AgreementOptionalReadView = {
  section: 'active', roleFilter: 'all', confirmationOnly: false, historyFilter: 'all',
};
const scope = (rows: DogovorProjekcija[], view: AgreementOptionalReadView = base) => visibleAgreementTaskGroups(rows, view);
const capacities = (rows: DogovorProjekcija[], view: AgreementOptionalReadView = base) =>
  ownerCapacityNeedIds(scope(rows, view).flatMap(group => group.items));

describe('Dogovori optional reads are scoped to visible task groups', () => {
  it('active tab skips history-only task reads, history tab skips active ones', () => {
    const rows = [agreement(1, 101, 'CONFIRMED'), agreement(2, 102, 'COMPLETED'), agreement(3, 103, 'CANCELLED')];
    expect(capacities(rows)).toEqual([id(101)]);
    expect(capacities(rows, { ...base, section: 'history' })).toEqual([id(102), id(103)]);
  });
  it('role chip excludes task-wide reads in the hidden role and worker-only tasks never gain owner reads', () => {
    const rows = [agreement(1, 101, 'CONFIRMED'), agreement(2, 102, 'CONFIRMED', 'uskocer')];
    expect(capacities(rows, { ...base, roleFilter: 'uskocer' })).toEqual([]);
    expect(capacities(rows, { ...base, roleFilter: 'narucilac' })).toEqual([id(101)]);
  });
  it('confirmation chip reads only tasks whose requester actually awaits confirmation', () => {
    const rows = [agreement(1, 101, 'CONFIRMED'), agreement(2, 102, 'AWAITING_REQUESTER'),
      agreement(3, 103, 'AWAITING_REQUESTER', 'uskocer')];
    expect(capacities(rows, { ...base, confirmationOnly: true })).toEqual([id(102)]);
  });
  it('active task retains a cancelled sibling, but no false historical task is fetched', () => {
    const rows = [agreement(1, 101, 'CONFIRMED'), agreement(2, 101, 'CANCELLED'), agreement(3, 102, 'CANCELLED')];
    const groups = scope(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
    expect(capacities(rows)).toEqual([id(101)]);
    expect(cancelledIdsForVisibleAgreementGroups(groups, 'active', 'all')).toEqual([id(2)]);
  });
  it('history outcome chips never fetch invisible cancellation explanations', () => {
    const rows = [agreement(1, 101, 'COMPLETED'), agreement(2, 101, 'CANCELLED'),
      agreement(3, 102, 'CANCELLED')];
    const finished = scope(rows, { ...base, section: 'history', historyFilter: 'completed' });
    expect(finished).toHaveLength(1);
    expect(cancelledIdsForVisibleAgreementGroups(finished, 'history', 'completed')).toEqual([]);
    const cancelled = scope(rows, { ...base, section: 'history', historyFilter: 'cancelled' });
    expect(cancelled).toHaveLength(2);
    expect(cancelledIdsForVisibleAgreementGroups(cancelled, 'history', 'cancelled')).toEqual([id(2), id(3)]);
  });
  it('never invents owner linkage and retains twelve-read safety ceiling for visible groups', () => {
    const rows = Array.from({ length: 15 }, (_, i) => agreement(i + 1, i + 100, 'CONFIRMED'));
    expect(capacities(rows)).toHaveLength(12);
    expect(capacities([agreement(1, null, 'CONFIRMED')])).toEqual([]);
  });
  it('a finished agreement awaiting a rating stays in active groups', () => {
    const rows = [agreement(1, 101, 'COMPLETED', 'narucilac', { ocenaMoguca: true })];
    expect(capacities(rows)).toEqual([id(101)]);
    expect(capacities(rows, { ...base, section: 'history' })).toEqual([]);
  });
});
