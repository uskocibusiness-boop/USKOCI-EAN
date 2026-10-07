import type { DraftDeletionReceipt, NeedCancellationReceipt, NeedLifecycleCommand, NeedLifecycleReadback } from '../contracts/needLifecycle';
import type { Ishod } from './ports';
import { failure, positiveInteger, readReceipt, record, sameId, uuid } from './serverReceipt';

const LIFECYCLE_COPY: Readonly<Record<string, string>> = {
  ACCOUNT_CLOSING: 'Radnja je zaustavljena zbog postupka zatvaranja naloga. Osveži prikaz.',
  NEED_COMMAND_INVALID_INPUT: 'Ponovo otvori zadatak i pregledaj aktuelne podatke.',
  NEED_CANCELLATION_REQUIRES_AGREEMENT_FLOW: 'Zadatak već ima Dogovor. Otkazivanje ide kroz Dogovor, ne kroz zadatak.',
  NEED_NOT_CANCELLABLE: 'Ovaj zadatak više ne može da se otkaže.',
  NEED_NOT_DELETABLE_DRAFT: 'Samo neobjavljen nacrt može da se obriše.',
  DRAFT_MEDIA_CLEANUP_REQUIRED: 'Ukloni fotografije iz nacrta pre brisanja.',
  DRAFT_HAS_AUTHORITATIVE_HISTORY: 'Ovaj nacrt ima istoriju i ne može da se obriše. Možeš ga otkazati.',
  STALE_REVIEW_REQUIRED: 'Zadatak je u međuvremenu promenjen. Osveži prikaz pa pokušaj ponovo.',
  NEED_NOT_FOUND: 'Zadatak nije pronađen.', FORBIDDEN: 'Ovo nije tvoj zadatak.',
  AUTH_REQUIRED: 'Prijavi se da nastaviš.',
};
export const knownNeedLifecycleRefusal = (kod: string) => Object.prototype.hasOwnProperty.call(LIFECYCLE_COPY, kod);
function invalidInput(needId: string, revision: number, reason: string): Ishod<never> | null {
  return uuid(needId) && positiveInteger(revision) && typeof reason === 'string' && Array.from(reason).length <= 500 ? null
    : failure('NEED_COMMAND_INVALID_INPUT', 'Ponovo otvori zadatak i pregledaj aktuelne podatke.');
}

/** Revision-bound terminal commands. No defaults may manufacture a server outcome. */
export const needLifecycleClientService = {
  /** A missing list item is never a mutation receipt. NOT_CONFIRMED is only this
   * read's observation; an earlier network-timed-out command may still commit. */
  async readCommandReceipt(command: NeedLifecycleCommand): Promise<Ishod<NeedLifecycleReadback>> {
    const invalid = invalidInput(command.needId, command.expectedRevision, command.reason);
    if (invalid) return invalid;
    if (command.action !== 'CANCEL' && command.action !== 'DELETE_DRAFT')
      return failure('NEED_COMMAND_INVALID_INPUT', 'Ponovo otvori zadatak i pregledaj aktuelne podatke.');
    return readReceipt({
      rpc: 'rpc_get_need_lifecycle_receipt',
      args: { p_need_id: command.needId, p_need_revision: command.expectedRevision, p_action: command.action },
      errors: LIFECYCLE_COPY, fallback: 'NEED_RECEIPT_READ_FAILED', invalid: 'NEED_RECEIPT_INVALID_RESPONSE',
      decode(raw): NeedLifecycleReadback | null {
        const data = record(raw);
        if (!data || data.authoritative !== true || data.action !== command.action) return null;
        if (data.state === 'NOT_CONFIRMED') return { state: 'NOT_CONFIRMED' };
        if (data.state !== 'CONFIRMED') return null;
        const receipt = record(data.receipt);
        if (!receipt || !sameId(receipt.needId, command.needId) || !positiveInteger(receipt.revision) ||
          receipt.idempotentReplay !== true) return null;
        if (command.action === 'DELETE_DRAFT') {
          if (receipt.deleted !== true || receipt.revision !== command.expectedRevision) return null;
          return { state: 'CONFIRMED', confirmation: { action: 'DELETE_DRAFT', receipt: {
            needId: receipt.needId, revision: receipt.revision, deleted: true, idempotentReplay: true,
          } } };
        }
        if (receipt.status !== 'CANCELLED' || receipt.affectedResponses !== 0) return null;
        return { state: 'CONFIRMED', confirmation: { action: 'CANCEL', receipt: {
          needId: receipt.needId, revision: receipt.revision, status: 'CANCELLED', affectedResponses: 0, idempotentReplay: true,
        } } };
      },
    });
  },

  async cancelNeed(needId: string, expectedRevision: number, reason = ''): Promise<Ishod<NeedCancellationReceipt>> {
    const invalid = invalidInput(needId, expectedRevision, reason);
    if (invalid) return invalid;
    return readReceipt({
      rpc: 'rpc_cancel_need', args: { p_need_id: needId, p_need_revision: expectedRevision, p_reason: reason },
      errors: LIFECYCLE_COPY, fallback: 'NEED_CANCEL_FAILED', invalid: 'NEED_CANCEL_INVALID_RESPONSE', write: true,
      decode(raw): NeedCancellationReceipt | null {
        const data = record(raw);
        if (!data || data.authoritative !== true || data.status !== 'CANCELLED' || !sameId(data.needId, needId) ||
          !positiveInteger(data.revision) || typeof data.idempotentReplay !== 'boolean' ||
          typeof data.affectedResponses !== 'number' || !Number.isSafeInteger(data.affectedResponses) || data.affectedResponses < 0) return null;
        // The server intentionally returns a current terminal receipt before
        // checking revision on replay. Do not replace that revision with the caller's.
        if (data.idempotentReplay ? data.affectedResponses !== 0 : data.revision !== expectedRevision) return null;
        return { needId: data.needId, status: 'CANCELLED', revision: data.revision,
          affectedResponses: data.affectedResponses, idempotentReplay: data.idempotentReplay };
      },
    });
  },
  async deleteDraftNeed(needId: string, expectedRevision: number, reason = ''): Promise<Ishod<DraftDeletionReceipt>> {
    const invalid = invalidInput(needId, expectedRevision, reason);
    if (invalid) return invalid;
    return readReceipt({
      rpc: 'rpc_delete_draft_need', args: { p_need_id: needId, p_need_revision: expectedRevision, p_reason: reason },
      errors: LIFECYCLE_COPY, fallback: 'DRAFT_DELETE_FAILED', invalid: 'DRAFT_DELETE_INVALID_RESPONSE', write: true,
      decode(raw): DraftDeletionReceipt | null {
        const data = record(raw);
        if (!data || data.authoritative !== true || data.deleted !== true || !sameId(data.needId, needId) ||
          !positiveInteger(data.revision) || data.revision !== expectedRevision || typeof data.idempotentReplay !== 'boolean') return null;
        return { needId: data.needId, revision: data.revision, deleted: true, idempotentReplay: data.idempotentReplay };
      },
    });
  },
};
