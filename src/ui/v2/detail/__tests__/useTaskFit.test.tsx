import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockAccount = { id: 'account-a', revision: 1 };
jest.mock('../../../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: mockAccount.id }, accountRevision: mockAccount.revision }) }));
const mockRead = jest.fn();
jest.mock('../../../../data/locationClientService', () => ({ workerLocationClientService: { read: (...args: unknown[]) => mockRead(...args) } }));

import type { DogovorProjekcija, PrilikaProjekcija } from '../../../../contracts/projections';
import type { TaskRelation } from '../../../../data/taskRelation';
import { useTaskFit } from '../useTaskFit';
import type { TaskFitContext } from '../taskFit';

/**
 * The reads behind R25 are optional and stand beside the task, never in front of it: this holds that they are made only for a task that is somebody else's and open
 * to me, that a failed read leaves its row out, that a late answer under another account or for another task is dropped, and that nothing is read twice.
 */
const task = (patch: Partial<PrilikaProjekcija> = {}): PrilikaProjekcija => ({
  id: 'task-a', naslov: 'Zadatak', statusTekst: 'Traži ponude', primaNovePrijave: true, rokZaPrijaveIso: null, podrucjeTekst: 'Beograd', vremeTekst: 'Subota',
  pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, uslovi: [], narucilacProfilId: 'p', narucilacIme: '', narucilacOcena: null,
  priblizno: { lat: 44.82, lng: 20.46 }, schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-10-10T08:00:00+02:00', endsAt: '2026-10-10T12:00:00+02:00' }, ...patch });
const held = (title: string): Pick<DogovorProjekcija, 'naslov' | 'stanje' | 'tacanTermin'> =>
  ({ naslov: title, stanje: 'CONFIRMED', tacanTermin: { pocetak: '2026-10-10T09:00:00+02:00', kraj: '2026-10-10T11:00:00+02:00' } });
const location = (patch: Record<string, unknown> = {}) => ({ ok: true, podatak: { accountId: 'account-a', approximatePosition: { latitude: 45.25, longitude: 19.84 }, ...patch } });

const mockAgreements = jest.fn();
let latest: TaskFitContext | undefined;
/** The last thing the hook said (read through a function, so a reset to nothing is not narrowed away). */
const seen = (): TaskFitContext | undefined => latest;
let tree: ReactTestRenderer | undefined;
function Probe(props: { prilika: PrilikaProjekcija | null; relation: TaskRelation; accountId?: string; accountRevision?: number; izvor?: object }) {
  latest = useTaskFit({ prilika: props.prilika, relation: props.relation, izvor: (props.izvor ?? { mojiDogovori: mockAgreements }) as never,
    accountId: 'accountId' in props ? props.accountId : 'account-a', accountRevision: props.accountRevision ?? 1 });
  return null;
}
const NONE: TaskRelation = { kind: 'NONE' };
const deferred = <T,>() => {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 20; i++) await act(async () => { await Promise.resolve(); }); };
const mount = async (props: Parameters<typeof Probe>[0]) => { await act(async () => { tree = create(<Probe {...props} />); }); await flush(); };
const rerender = async (props: Parameters<typeof Probe>[0]) => { await act(async () => { tree!.update(<Probe {...props} />); }); await flush(); };

beforeEach(() => {
  mockAccount = { id: 'account-a', revision: 1 }; latest = undefined; mockRead.mockReset().mockResolvedValue(location());
  mockAgreements.mockReset().mockResolvedValue([held('Montaža police')]);
});
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });

describe('R25 beside the task', () => {
  it('reads my Dogovori (without their ratings) and my saved work area once, and says what they tell about the task', async () => {
    await mount({ prilika: task(), relation: NONE });
    expect(mockAgreements).toHaveBeenCalledTimes(1); expect(mockAgreements).toHaveBeenCalledWith({ includeRatings: false });
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(seen()?.overlapTitle).toBe('Montaža police'); expect(seen()?.distanceKm).toBeGreaterThan(65);
    // The same task drawn again reads nothing more.
    await rerender({ prilika: task(), relation: NONE });
    expect(mockAgreements).toHaveBeenCalledTimes(1); expect(mockRead).toHaveBeenCalledTimes(1);
  });

  it('is silent for a task that is mine, one I have applied to, one that is not known, one closed to applications, and while there is no task', async () => {
    for (const [prilika, relation] of [[task(), { kind: 'OWNER' }], [task(), { kind: 'APPLIED', applicationId: 'x', agreementId: null }], [task(), { kind: 'UNKNOWN' }],
      [task({ primaNovePrijave: false }), NONE], [null, NONE]] as const) {
      await rerender0({ prilika, relation });
      expect([relation.kind, seen()]).toEqual([relation.kind, undefined]);
    }
    expect(mockAgreements).not.toHaveBeenCalled(); expect(mockRead).not.toHaveBeenCalled();
  });

  it('says the facts it has when the other read fails, and nothing when both do', async () => {
    mockAgreements.mockRejectedValue(new Error('net'));
    await mount({ prilika: task(), relation: NONE });
    expect(seen()?.overlapTitle).toBeNull(); expect(seen()?.distanceKm).toBeGreaterThan(65);
    await act(async () => tree!.unmount()); latest = undefined;
    mockRead.mockResolvedValue({ ok: false, kod: 'X', poruka: 'x' }); mockAgreements.mockResolvedValue([]);
    await mount({ prilika: task(), relation: NONE });
    expect(seen()).toBeUndefined();
  });

  it('takes a work area that is not mine, or a source that cannot list the Dogovori, as unknown', async () => {
    mockRead.mockResolvedValue(location({ accountId: 'someone-else' }));
    await mount({ prilika: task(), relation: NONE });
    expect(seen()?.distanceKm).toBeNull(); expect(seen()?.overlapTitle).toBe('Montaža police');
    await act(async () => tree!.unmount()); latest = undefined;
    mockRead.mockResolvedValue(location());
    await mount({ prilika: task(), relation: NONE, izvor: {} });
    expect(seen()?.overlapTitle).toBeNull(); expect(seen()?.distanceKm).toBeGreaterThan(65);
  });

  it('drops an answer that lands after the account changed or the person left', async () => {
    let finish!: (rows: unknown[]) => void;
    mockAgreements.mockReturnValue(new Promise(done => { finish = done; }));
    await mount({ prilika: task(), relation: NONE });
    mockAccount = { id: 'account-a', revision: 2 };
    await act(async () => { finish([held('Montaža police')]); }); await flush();
    expect(seen()).toBeUndefined();
    mockAccount = { id: 'account-a', revision: 1 };
    await act(async () => tree!.unmount()); latest = undefined;
    mockAgreements.mockReturnValue(new Promise(done => { finish = done; }));
    await mount({ prilika: task(), relation: NONE });
    await act(async () => tree!.unmount()); tree = undefined;
    await act(async () => { finish([held('Montaža police')]); }); await flush();
    expect(seen()).toBeUndefined();
  });

  it('reads again for another task, never showing the first one\'s facts on the second', async () => {
    await mount({ prilika: task(), relation: NONE });
    expect(seen()?.overlapTitle).toBe('Montaža police');
    mockAgreements.mockResolvedValue([]);
    await rerender({ prilika: task({ id: 'task-b' }), relation: NONE });
    expect(mockAgreements).toHaveBeenCalledTimes(2);
    expect(seen()?.overlapTitle ?? null).toBeNull(); expect(seen()?.distanceKm).toBeGreaterThan(65);
  });

  it('says nothing for a person who is not signed in', async () => {
    await mount({ prilika: task(), relation: NONE, accountId: undefined });
    expect(seen()).toBeUndefined(); expect(mockAgreements).not.toHaveBeenCalled();
  });
});

describe('SB11 fit input invalidation', () => {
  it.each(['end', 'kind'] as const)('drops an overlap when only the schedule %s changes', async change => {
    const original = task();
    await mount({ prilika: original, relation: NONE });
    expect(seen()?.overlapTitle).toBe('Montaža police');
    const next = deferred<unknown[]>();
    mockAgreements.mockReturnValueOnce(next.promise);
    const schedule = { ...original.schedule!, ...(change === 'end' ? { endsAt: '2026-10-10T09:00:00+02:00' } : { kind: 'FLEXIBLE' as const }) };
    await rerender({ prilika: task({ schedule }), relation: NONE });
    expect(seen()).toBeUndefined();
    await act(async () => { next.resolve([held('Montaža police')]); }); await flush();
    expect(seen()?.overlapTitle).toBeNull(); expect(seen()?.distanceKm).toBeGreaterThan(65);
    expect(mockAgreements).toHaveBeenCalledTimes(2); expect(mockRead).toHaveBeenCalledTimes(2);
  });

  it.each(['lat', 'lng'] as const)('recomputes distance when only the public pin %s changes', async coordinate => {
    await mount({ prilika: task(), relation: NONE });
    expect(seen()?.distanceKm).toBeGreaterThan(65);
    const priblizno = { ...task().priblizno!, [coordinate]: coordinate === 'lat' ? 45.25 : 19.84 };
    await rerender({ prilika: task({ priblizno }), relation: NONE });
    expect(seen()?.distanceKm).toBeGreaterThan(40); expect(seen()?.distanceKm).toBeLessThan(55);
    expect(seen()?.overlapTitle).toBe('Montaža police');
    expect(mockAgreements).toHaveBeenCalledTimes(2); expect(mockRead).toHaveBeenCalledTimes(2);
  });

  it('drops the distance when the public pin is removed', async () => {
    await mount({ prilika: task(), relation: NONE });
    await rerender({ prilika: task({ priblizno: null }), relation: NONE });
    expect(seen()?.distanceKm).toBeNull(); expect(seen()?.overlapTitle).toBe('Montaža police');
    expect(mockRead).toHaveBeenCalledTimes(2);
  });

  it('drops distance for remote work and restores it when the same pin becomes onsite again', async () => {
    const detalji: NonNullable<PrilikaProjekcija['detalji']> = { kategorija: 'Selidbe', geografija: null, rezimLokacije: 'STATIONARY',
      zahtevi: { vestine: [], alati: [], vozila: [], dozvole: [], bitniUslovi: null, iskustvoGodina: null, potvrdjenIdentitet: false } };
    await mount({ prilika: task({ detalji }), relation: NONE });
    expect(seen()?.distanceKm).toBeGreaterThan(65);
    await rerender({ prilika: task({ detalji: { ...detalji, rezimLokacije: 'REMOTE' } }), relation: NONE });
    expect(seen()?.distanceKm).toBeNull(); expect(seen()?.overlapTitle).toBe('Montaža police');
    await rerender({ prilika: task({ detalji }), relation: NONE });
    expect(seen()?.distanceKm).toBeGreaterThan(65); expect(mockRead).toHaveBeenCalledTimes(3);
  });

  it('hides the previous fit while a new task revision reads, but does not reread the same revision', async () => {
    await mount({ prilika: task({ revision: 1 }), relation: NONE });
    const next = deferred<unknown[]>(); mockAgreements.mockReturnValueOnce(next.promise);
    await rerender({ prilika: task({ revision: 2 }), relation: NONE });
    expect(seen()).toBeUndefined();
    await act(async () => { next.resolve([held('Novi dogovor')]); }); await flush();
    expect(seen()?.overlapTitle).toBe('Novi dogovor');
    await rerender({ prilika: task({ revision: 2 }), relation: NONE });
    expect(mockAgreements).toHaveBeenCalledTimes(2); expect(mockRead).toHaveBeenCalledTimes(2);
  });

  it.each(['empty', 'failed'] as const)('does not resurrect a fit after A → null → A with %s optional reads', async result => {
    const original = task();
    await mount({ prilika: original, relation: NONE });
    expect(seen()?.overlapTitle).toBe('Montaža police');
    await rerender({ prilika: null, relation: NONE });
    const agreements = deferred<unknown[]>(), area = deferred<unknown>();
    mockAgreements.mockReturnValueOnce(agreements.promise); mockRead.mockReturnValueOnce(area.promise);
    await rerender({ prilika: original, relation: NONE });
    expect(seen()).toBeUndefined();
    await act(async () => {
      if (result === 'empty') { agreements.resolve([]); area.resolve(location({ approximatePosition: null })); }
      else { agreements.reject(new Error('offline')); area.reject(new Error('offline')); }
    }); await flush();
    expect(seen()).toBeUndefined();
    expect(mockAgreements).toHaveBeenCalledTimes(2); expect(mockRead).toHaveBeenCalledTimes(2);
  });

  it.each(['task revision', 'account'] as const)('ignores the old response after the new %s response has completed', async change => {
    const old = deferred<unknown[]>(), current = deferred<unknown[]>();
    mockAgreements.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await mount({ prilika: task({ revision: 1 }), relation: NONE });
    if (change === 'account') {
      mockAccount = { id: 'account-b', revision: 2 }; mockRead.mockResolvedValue(location({ accountId: 'account-b' }));
      await rerender({ prilika: task({ revision: 1 }), relation: NONE, accountId: 'account-b', accountRevision: 2 });
    } else await rerender({ prilika: task({ revision: 2 }), relation: NONE });
    await act(async () => { current.resolve([held('Aktuelni dogovor')]); }); await flush();
    expect(seen()?.overlapTitle).toBe('Aktuelni dogovor');
    await act(async () => { old.resolve([held('Zastareli dogovor')]); }); await flush();
    expect(seen()?.overlapTitle).toBe('Aktuelni dogovor');
    expect(mockAgreements).toHaveBeenCalledTimes(2);
  });

  it('drops a late answer when the account ID changed before the component rerenders', async () => {
    const old = deferred<unknown[]>(); mockAgreements.mockReturnValueOnce(old.promise);
    await mount({ prilika: task(), relation: NONE });
    mockAccount = { id: 'account-b', revision: 1 };
    await act(async () => { old.resolve([held('Tuđi dogovor')]); }); await flush();
    expect(seen()).toBeUndefined();
  });
});

// A probe for the cases that start from nothing each time.
async function rerender0(props: Parameters<typeof Probe>[0]) {
  if (tree) await rerender(props); else await mount(props);
}
