import type { Ishod } from './ports';
import { failure, record, sameId, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

/**
 * My own working period on one Dogovor (owner, 25.11.2026): a day and from–to, half or whole day, marked by each side for
 * itself. Private to me, it fills my schedule; an overlap with another of my periods only warns. Server:
 * rpc_set_my_agreement_period / rpc_clear_my_agreement_period / rpc_get_my_agreement_periods (DEV 20261125231234).
 */
export type AgreementPeriod = { agreementId: string; startsAt: string; endsAt: string };
export type AgreementPeriodSaved = AgreementPeriod & { overlaps: string[] };

const MESSAGES: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavite se da nastavite.',
  ACCOUNT_CLOSING: 'Ovo nije dostupno dok se Vaš nalog zatvara.',
  PERIOD_INVALID: 'Kraj mora biti posle početka, najviše 14 dana kasnije.',
  AGREEMENT_NOT_FOUND: 'Dogovor više nije dostupan.',
  AGREEMENT_NOT_ACTIVE: 'Ovaj Dogovor je završen.',
};
const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const code = (error: { message?: unknown }) => typeof error.message === 'string' ? error.message : '';

export async function setMyAgreementPeriod(agreementId: string, startsAt: Date, endsAt: Date): Promise<Ishod<AgreementPeriodSaved>> {
  if (!uuid(agreementId) || !(endsAt > startsAt)) return failure('PERIOD_INVALID', MESSAGES.PERIOD_INVALID);
  try {
    const { data, error } = await supabaseKlijent().rpc('rpc_set_my_agreement_period', {
      p_agreement_id: agreementId, p_starts_at: startsAt.toISOString(), p_ends_at: endsAt.toISOString() });
    if (error) {
      const kod = code(error);
      return Object.hasOwn(MESSAGES, kod) ? failure(kod, MESSAGES[kod]) : failure('PERIOD_UNCONFIRMED', 'Ne znamo da li je vreme sačuvano. Pokušajte ponovo.');
    }
    const r = record(data);
    if (!r || r.authoritative !== true || !sameId(r.agreementId, agreementId) || !iso(r.startsAt) || !iso(r.endsAt) || !Array.isArray(r.overlaps))
      return failure('PERIOD_UNCONFIRMED', 'Ne znamo da li je vreme sačuvano. Pokušajte ponovo.');
    return { ok: true, podatak: { agreementId, startsAt: r.startsAt, endsAt: r.endsAt, overlaps: r.overlaps.filter(uuid) } };
  } catch {
    return failure('PERIOD_UNCONFIRMED', 'Veza je prekinuta. Ne znamo da li je vreme sačuvano.');
  }
}

export async function clearMyAgreementPeriod(agreementId: string): Promise<Ishod<true>> {
  if (!uuid(agreementId)) return failure('PERIOD_INVALID', MESSAGES.PERIOD_INVALID);
  try {
    const { data, error } = await supabaseKlijent().rpc('rpc_clear_my_agreement_period', { p_agreement_id: agreementId });
    const r = record(data);
    if (error || !r || r.authoritative !== true || r.cleared !== true) return failure('PERIOD_UNCONFIRMED', 'Ne znamo da li je vreme obrisano. Pokušajte ponovo.');
    return { ok: true, podatak: true };
  } catch {
    return failure('PERIOD_UNCONFIRMED', 'Veza je prekinuta. Ne znamo da li je vreme obrisano.');
  }
}

export async function readMyAgreementPeriods(from: Date, to: Date): Promise<Ishod<AgreementPeriod[]>> {
  try {
    const { data, error } = await supabaseKlijent().rpc('rpc_get_my_agreement_periods', { p_from: from.toISOString(), p_to: to.toISOString() });
    const r = record(data);
    if (error || !r || r.authoritative !== true || !Array.isArray(r.periods)) return failure('PERIODS_UNAVAILABLE', 'Vaša vremena trenutno nisu učitana.');
    const periods = r.periods.map(record).filter((p): p is Record<string, unknown> => !!p)
      .filter(p => uuid(p.agreementId) && iso(p.startsAt) && iso(p.endsAt))
      .map(p => ({ agreementId: p.agreementId as string, startsAt: p.startsAt as string, endsAt: p.endsAt as string }));
    return { ok: true, podatak: periods };
  } catch {
    return failure('PERIODS_UNAVAILABLE', 'Vaša vremena trenutno nisu učitana.');
  }
}
