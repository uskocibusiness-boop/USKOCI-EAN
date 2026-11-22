import type { Ishod } from './ports';
import { failure, positiveInteger, record, sameId, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

/** The task owner declines one application (swipe left on the task's Dogovor screen, owner 22.11.2026).
 * Server: rpc_decline_response (DEV migration 20261122162908). A repeated request with the same id replays. */
export type DeclineCommand = { prijavaId: string; potrebaRevizija: number; verzija: number; clientRequestId: string };

const MESSAGES: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavite se da nastavite.',
  ACCOUNT_CLOSING: 'Ovo nije dostupno dok se Vaš nalog zatvara.',
  NOT_REQUESTER: 'Prijave odbija samo osoba koja je objavila zadatak.',
  RESPONSE_NOT_FOUND: 'Prijava više nije dostupna.',
  NEED_NOT_FOUND: 'Zadatak više nije dostupan.',
  RESPONSE_ALREADY_SELECTED: 'Ova prijava je već izabrana. Pogledajte Dogovorene.',
  APPLICATION_WITHDRAWN_FINAL: 'Radnik je već povukao ovu prijavu.',
  RESPONSE_NOT_DECLINABLE: 'Ova prijava više ne može da se odbije.',
  STALE_REVIEW_REQUIRED: 'Zadatak ili prijava su se promenili. Osvežite prijave pa pokušajte ponovo.',
};

export async function declineApplication(k: DeclineCommand): Promise<Ishod<{ status: 'NOT_SELECTED' }>> {
  if (!uuid(k.prijavaId) || !positiveInteger(k.potrebaRevizija) || !positiveInteger(k.verzija)
    || k.clientRequestId.trim().length < 8 || k.clientRequestId.length > 200) return failure('DECLINE_INVALID', 'Osvežite prijave pa pokušajte ponovo.');
  try {
    const { data, error } = await supabaseKlijent().rpc('rpc_decline_response', {
      p_response_id: k.prijavaId, p_need_revision: k.potrebaRevizija, p_response_version: k.verzija, p_client_request_id: k.clientRequestId });
    if (error) {
      const kod = typeof error.message === 'string' ? error.message : '';
      return Object.hasOwn(MESSAGES, kod) ? failure(kod, MESSAGES[kod])
        : failure('DECLINE_UNCONFIRMED', 'Ne znamo da li je prijava odbijena. Osvežite prijave pre novog pokušaja.');
    }
    const receipt = record(data);
    if (!receipt || receipt.authoritative !== true || receipt.status !== 'NOT_SELECTED' || !sameId(receipt.responseId, k.prijavaId))
      return failure('DECLINE_UNCONFIRMED', 'Ne znamo da li je prijava odbijena. Osvežite prijave pre novog pokušaja.');
    return { ok: true, podatak: { status: 'NOT_SELECTED' } };
  } catch {
    return failure('DECLINE_UNCONFIRMED', 'Veza je prekinuta. Ne znamo da li je prijava odbijena; osvežite prijave.');
  }
}
