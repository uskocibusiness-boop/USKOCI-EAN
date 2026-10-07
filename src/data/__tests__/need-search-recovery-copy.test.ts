import type { NeedSearchState } from '../../contracts/needSearchRecovery';
import { needSearchRecoveryCopy } from '../../ui/needs/needSearchRecoveryCopy';
import type { SearchRecoveryView } from '../../ui/needs/NeedSearchRecoveryController';
import { missingPeople } from '../../ui/v2/ownTaskOverview';

/**
 * The copy of the search-recovery section says how many people a task still needs with the verb that agrees with the number ("Nedostaju još 2
 * osobe."), from the ONE function the own-task page uses (`missingPeople`): the two must never say it two ways. It said "Nedostaje još 2 osobe".
 */
const state = (patch: Partial<NeedSearchState> = {}): NeedSearchState => ({ schemaVersion: 1, authoritative: true, serverAsOf: '2026-10-07T10:00:00.000Z',
  needId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', revision: 3, status: 'ACTIVE', requiredSlots: 3, coveredSlots: 1, missingSlots: 2, searchAuthority: 'CLOSED',
  closedAt: '2026-10-06T10:00:00.000Z', searchTimeAdmitted: true, canReopen: true, reason: 'CAN_REOPEN', nextAction: 'REOPEN_SEARCH', agreementCount: 1,
  activeAgreementCount: 1, awaitingConfirmationCount: 0, openProblemCount: 0, ...patch });
const view = (snapshot: NeedSearchState, patch: Partial<SearchRecoveryView> = {}): SearchRecoveryView => ({ phase: 'READY', snapshot, command: null, result: null,
  error: null, retryAllowed: false, ...patch });

describe('how many people are missing, in the recovery section', () => {
  it.each([1, 2, 3, 4, 5, 11, 12, 21, 22, 25])('a closed search missing %i says it with the verb that agrees, as the own-task page does', missing => {
    const copy = needSearchRecoveryCopy(view(state({ missingSlots: missing })));
    expect(copy?.title).toBe('Potraga je zatvorena');
    expect(copy?.detail).toBe(`${missingPeople(missing)} Ti odlučuješ kada nastavljamo.`);
  });

  it('pins the shapes people read: one person, two to four, five and more', () => {
    expect(needSearchRecoveryCopy(view(state({ missingSlots: 1 })))?.detail).toBe('Nedostaje još jedna osoba. Ti odlučuješ kada nastavljamo.');
    expect(needSearchRecoveryCopy(view(state({ missingSlots: 2 })))?.detail).toBe('Nedostaju još 2 osobe. Ti odlučuješ kada nastavljamo.');
    expect(needSearchRecoveryCopy(view(state({ missingSlots: 5 })))?.detail).toBe('Nedostaje još 5 osoba. Ti odlučuješ kada nastavljamo.');
    expect(needSearchRecoveryCopy(view(state({ missingSlots: 22 })))?.detail).toBe('Nedostaju još 22 osobe. Ti odlučuješ kada nastavljamo.');
  });

  it('a search that was just reopened says it the same way', () => {
    const reopened = state({ searchAuthority: 'OPEN', status: 'SELECTION', missingSlots: 2 });
    const copy = needSearchRecoveryCopy(view(reopened, { phase: 'RESOLVED', result: 'CONFIRMED' }));
    expect(copy).toMatchObject({ title: 'Potraga je ponovo otvorena', detail: 'Nedostaju još 2 osobe.' });
  });

  it('never says "Nedostaje još 2", "Nedostaje još 3" or "Nedostaje još 4": that verb is only for one, five and more', () => {
    for (const missing of [2, 3, 4, 22, 23, 24]) {
      expect(needSearchRecoveryCopy(view(state({ missingSlots: missing })))?.detail).not.toMatch(/^Nedostaje još/);
    }
  });
});
