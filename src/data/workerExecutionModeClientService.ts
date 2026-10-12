import { sesijaSada } from '../store/sesija';
import { ownProfileClientService } from './ownProfileClientService';
import { supabaseKlijent } from './supabaseClient';

export type WorkerExecutionMode = 'ON_SITE' | 'REMOTE';
export type WorkerExecutionModeReceipt = {
  workerProfileId: string;
  confirmed: boolean;
  modes: WorkerExecutionMode[];
  confirmedAt: string | null;
};

export function canonicalWorkerExecutionModes(modes: readonly WorkerExecutionMode[]): WorkerExecutionMode[] {
  const result: WorkerExecutionMode[] = [];
  if (modes.includes('ON_SITE')) result.push('ON_SITE');
  if (modes.includes('REMOTE')) result.push('REMOTE');
  return result;
}

function scoped(accountId: string, accountRevision: number) {
  const current = sesijaSada();
  if (!accountId || current.user?.id !== accountId || current.accountRevision !== accountRevision) {
    throw new Error('WORKER_MODE_ACCOUNT_CHANGED');
  }
}

function readReceipt(value: unknown, profileId: string): WorkerExecutionModeReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('WORKER_MODE_INVALID_RECEIPT');
  const row = value as Record<string, unknown>;
  if (row.workerProfileId !== profileId || typeof row.confirmed !== 'boolean' || !Array.isArray(row.modes)
    || row.modes.some(mode => mode !== 'ON_SITE' && mode !== 'REMOTE')
    || row.modes.length > 2 || new Set(row.modes).size !== row.modes.length
    || (row.confirmed ? row.modes.length < 1 : row.modes.length !== 0)
    || (row.confirmedAt !== null && typeof row.confirmedAt !== 'string')) throw new Error('WORKER_MODE_INVALID_RECEIPT');
  return { workerProfileId: profileId, confirmed: row.confirmed,
    modes: canonicalWorkerExecutionModes(row.modes as WorkerExecutionMode[]),
    confirmedAt: typeof row.confirmedAt === 'string' ? row.confirmedAt : null };
}

async function ownedWorkerId(accountId: string, accountRevision: number): Promise<string> {
  scoped(accountId, accountRevision);
  const profile = await ownProfileClientService.read(accountId, 'uskocer');
  scoped(accountId, accountRevision);
  if (!profile || profile.kind !== 'WORKER') throw new Error('WORKER_PROFILE_REQUIRED');
  return profile.profileId;
}

export const workerExecutionModeClientService = {
  async read(accountId: string, accountRevision: number): Promise<WorkerExecutionModeReceipt> {
    const profileId = await ownedWorkerId(accountId, accountRevision);
    const { data, error } = await supabaseKlijent().rpc('rpc_get_worker_execution_modes', {
      p_worker_profile_id: profileId,
    });
    scoped(accountId, accountRevision);
    if (error) throw new Error('WORKER_MODE_READ_FAILED');
    return readReceipt(data, profileId);
  },

  async save(accountId: string, accountRevision: number, modes: WorkerExecutionMode[]): Promise<WorkerExecutionModeReceipt> {
    const desired = canonicalWorkerExecutionModes(modes);
    if (!desired.length || desired.length !== modes.length || new Set(modes).size !== modes.length)
      throw new Error('WORKER_MODE_SELECTION_REQUIRED');
    const profileId = await ownedWorkerId(accountId, accountRevision);
    const { error } = await supabaseKlijent().rpc('rpc_set_worker_execution_modes', {
      p_worker_profile_id: profileId, p_modes: desired,
    });
    scoped(accountId, accountRevision);
    // RPC responses (including transient network errors) cannot prove a write
    // did or did not happen. Always read server truth before declaring success.
    const readback = await this.read(accountId, accountRevision);
    scoped(accountId, accountRevision);
    if (error || readback.workerProfileId !== profileId || !readback.confirmed
      || readback.modes.join(',') !== desired.join(',')) throw new Error('WORKER_MODE_SAVE_NOT_CONFIRMED');
    return readback;
  },
};