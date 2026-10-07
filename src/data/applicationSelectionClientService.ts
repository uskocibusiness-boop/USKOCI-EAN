import type { Ishod, IzborKomanda, Izvor, PodnesiPrijavuKomanda } from './ports';
import { calendarFailure } from './calendarErrors';
import { calendarInstant } from '../lib/calendarTime';
import { failure, positiveInteger, readOwnedResult, record, sameId, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';
import { sesijaSada } from '../store/sesija';

export const applicationSelectionErrors: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavi se da nastaviš.',
  OWN_NEED: 'Ne možeš da se prijaviš na svoj zadatak.',
  NOT_REQUESTER: 'Ove prijave vidi samo osoba koja je objavila zadatak.',
  NEED_NOT_FOUND: 'Zadatak više nije dostupan.',
  NEED_NOT_OPEN: 'Zadatak više ne prima prijave i izbore.',
  NEED_REMAINING_SEARCH_CLOSED: 'Zadatak više ne prima nove prijave. Osveži zadatak.',
  RESPONSE_WINDOW_EXPIRED: 'Rok za prijave je istekao.',
  STALE_REVIEW_REQUIRED: 'Zadatak ili prijava su promenjeni. Pregledaj aktuelne podatke pre novog izbora.',
  NEED_REVISION_MISMATCH: 'Zadatak je promenjen. Pregledaj aktuelne uslove pre nove prijave.',
  RESPONSE_NOT_SELECTABLE: 'Ova prijava više nije dostupna za izbor.',
  RESPONSE_NOT_FOUND: 'Prijava više nije dostupna.',
  RESPONSE_ALREADY_SELECTED: 'Ova prijava je već izabrana. Otvori svoje Dogovore.',
  PROFILE_NOT_OWNED_BY_ACCOUNT: 'Ponovo otvori svoj radni profil pre prijave.',
  NEED_FULL: 'Sva mesta na ovom zadatku su popunjena.',
  NEED_REMAINING_CAPACITY_EXCEEDED: 'Broj ljudi premašuje preostala mesta na zadatku.',
  INVALID_COVERED_SLOTS: 'Unesi ceo broj ljudi koje obezbeđuješ.',
  INVALID_PRICE: 'Unesi ceo pozitivan iznos u RSD.',
  FIXED_PRICE_NOT_READY: 'Cena zadatka trenutno nije spremna. Ponovo otvori zadatak.',
  FIXED_PRICE_MISMATCH: 'Cena prijave mora da prati cenu i obračun iz zadatka. Izmeni prijavu prema aktuelnim uslovima.',
  // pkg025b. A task whose price is the price of the WHOLE task is taken by one application that
  // covers all of it. Hiring people separately is what a per-person price is for.
  TOTAL_PRICE_REQUIRES_ALL_SLOTS: 'Cena ovog zadatka važi za ceo zadatak, pa prijava mora da pokrije sva mesta.',
  UNKNOWN_PRICE_BASIS: 'Način obračuna cene na ovom zadatku nije podržan u ovoj verziji aplikacije.',
  INVALID_PROPOSED_INTERVAL: 'Kraj predloženog termina mora biti posle početka.',
  NEED_FIXED_INTERVAL_INVALID: 'Termin zadatka nije potpun. Ponovo otvori zadatak.',
  WORKER_PROFILE_NOT_READY: 'Radni profil još ne ispunjava uslove za ovu prijavu.',
  WORKER_NOT_ELIGIBLE: 'Radni profil ili dostupnost ne ispunjavaju uslove zadatka.',
  WORKER_NO_LONGER_ELIGIBLE: 'Radni profil ili dostupnost su promenjeni. Pregledaj prijave ponovo.',
  TEAM_CAPACITY_EXCEEDED: 'Broj ljudi u prijavi premašuje kapacitet radnog profila.',
  OVERFILL: 'Prijava pokriva više ljudi nego što je još potrebno.',
  CONNECTION_POLICY_NOT_READY: 'Povezivanje trenutno nije dostupno. Pokušaj kasnije.',
  IDEMPOTENCY_KEY_REUSED: 'Ovaj zahtev je već vezan za drugu ponudu. Proveri sačuvano stanje.',
  WORKER_CALENDAR_CONFLICT: 'Termin se preklapa sa potvrđenim Dogovorom. Osveži kalendar i izaberi drugi termin.',
  CALENDAR_RECHECK_REQUIRED: 'Raspored se upravo promenio. Osveži podatke pre ponovnog pokušaja.',
  AGREEMENT_CALENDAR_INTERVAL_INVALID: 'Proveri tačan početak i kraj predloženog termina.',
};
export const APPLICATION_ELIGIBILITY_BLOCKERS = [
  'ACCOUNT_OR_PROFILE_RESTRICTED', 'OWN_NEED', 'IDENTITY_VERIFICATION_NOT_ADMITTED',
  'MISSING_REQUIRED_TOOL', 'MISSING_REQUIRED_LICENSE', 'MISSING_REQUIRED_VEHICLE',
  'INSUFFICIENT_EXPERIENCE', 'PROFILE_EXCLUSION', 'CALENDAR_CONFLICT',
  'NEED_NOT_FOUND', 'WORKER_PROFILE_NOT_FOUND',
] as const;
export type ApplicationEligibilityBlocker = typeof APPLICATION_ELIGIBILITY_BLOCKERS[number];
const blockerCopy: Readonly<Record<ApplicationEligibilityBlocker, string>> = {
  ACCOUNT_OR_PROFILE_RESTRICTED: 'Radni profil trenutno nije aktivan za prijave.',
  OWN_NEED: 'Ne možeš da se prijaviš na sopstveni zadatak.',
  IDENTITY_VERIFICATION_NOT_ADMITTED: 'Ovaj zadatak traži potvrdu identiteta koja trenutno nije dostupna za ovu prijavu.',
  MISSING_REQUIRED_TOOL: 'Radnom profilu nedostaje alat koji ovaj zadatak zahteva.',
  MISSING_REQUIRED_LICENSE: 'Radnom profilu nedostaje licenca koju ovaj zadatak zahteva.',
  MISSING_REQUIRED_VEHICLE: 'Radnom profilu nedostaje vozilo koje ovaj zadatak zahteva.',
  INSUFFICIENT_EXPERIENCE: 'Navedeno iskustvo ne ispunjava minimum ovog zadatka.',
  PROFILE_EXCLUSION: 'Ovaj zadatak je među isključenim vrstama zadataka u radnom profilu.',
  CALENDAR_CONFLICT: 'Termin se preklapa sa već potvrđenim Dogovorom.',
  NEED_NOT_FOUND: 'Zadatak više nije dostupan.',
  WORKER_PROFILE_NOT_FOUND: 'Radni profil više nije dostupan.',
};
const profileBlockers = new Set<ApplicationEligibilityBlocker>([
  'ACCOUNT_OR_PROFILE_RESTRICTED', 'MISSING_REQUIRED_TOOL', 'MISSING_REQUIRED_LICENSE',
  'MISSING_REQUIRED_VEHICLE', 'INSUFFICIENT_EXPERIENCE', 'PROFILE_EXCLUSION', 'WORKER_PROFILE_NOT_FOUND',
]);
/** Exact no-write refusals observed in the deployed rpc_submit_response body.
 * Message text alone is not evidence; ID reuse and concurrency/transport errors are deliberately absent. */
const conclusiveSubmitSqlstate: Readonly<Record<string, string>> = {
  NEED_NOT_FOUND: 'P0002',
  NEED_NOT_OPEN: '22023',
  OWN_NEED: '42501',
  RESPONSE_WINDOW_EXPIRED: '22023',
  STALE_REVIEW_REQUIRED: 'P0001',
  PROFILE_NOT_OWNED_BY_ACCOUNT: '42501',
  WORKER_PROFILE_NOT_READY: 'P0001',
  NEED_FULL: 'P0001',
  INVALID_COVERED_SLOTS: '22023',
  TEAM_CAPACITY_EXCEEDED: '22023',
  NEED_REMAINING_CAPACITY_EXCEEDED: '22023',
  INVALID_PROPOSED_INTERVAL: '22023',
  RESPONSE_ALREADY_SELECTED: 'P0001',
  NEED_FIXED_INTERVAL_INVALID: '22023',
  AGREEMENT_CALENDAR_INTERVAL_INVALID: '22023',
  WORKER_NOT_ELIGIBLE: 'P0001',
};
export type ApplicationSubmitRefusal = {
  ok: false; kod: string; poruka: string; applicationRefusal: true;
  hardBlockers: readonly ApplicationEligibilityBlocker[];
};
function decodeHardBlockers(raw: unknown): ApplicationEligibilityBlocker[] | null {
  if (typeof raw !== 'string' || raw.length > 1000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length < 1 || value.length > APPLICATION_ELIGIBILITY_BLOCKERS.length
      || new Set(value).size !== value.length
      || value.some(code => typeof code !== 'string' || !(APPLICATION_ELIGIBILITY_BLOCKERS as readonly string[]).includes(code))) return null;
    return value as ApplicationEligibilityBlocker[];
  } catch { return null; }
}
function decodeSubmitRefusal(raw: unknown): ApplicationSubmitRefusal | null {
  const error = record(raw);
  const kod = typeof error?.message === 'string' ? error.message : '';
  const sqlstate = typeof error?.code === 'string' ? error.code : '';
  if (!Object.prototype.hasOwnProperty.call(conclusiveSubmitSqlstate, kod)
    || conclusiveSubmitSqlstate[kod] !== sqlstate
    || !Object.prototype.hasOwnProperty.call(applicationSelectionErrors, kod)) return null;
  let hardBlockers: ApplicationEligibilityBlocker[] = [];
  if (kod === 'WORKER_NOT_ELIGIBLE') {
    const decoded = decodeHardBlockers(error?.details);
    if (!decoded) return null;
    hardBlockers = decoded;
  }
  return { ok: false, kod, poruka: applicationSelectionErrors[kod], applicationRefusal: true, hardBlockers };
}
export function conclusiveApplicationRefusal(result: Ishod<unknown>): result is ApplicationSubmitRefusal {
  if (result.ok) return false;
  const value = record(result);
  if (value?.applicationRefusal !== true || !Object.prototype.hasOwnProperty.call(conclusiveSubmitSqlstate, result.kod)
    || !Array.isArray(value.hardBlockers)) return false;
  if (result.kod === 'WORKER_NOT_ELIGIBLE') return decodeHardBlockers(JSON.stringify(value.hardBlockers)) !== null;
  return value.hardBlockers.length === 0;
}
export function applicationRefusalGuidance(result: Ishod<unknown>): {
  messages: string[]; profile: boolean; calendar: boolean;
} | null {
  if (!conclusiveApplicationRefusal(result)) return null;
  const messages = result.hardBlockers.map(code => blockerCopy[code]);
  const profile = result.hardBlockers.some(code => profileBlockers.has(code))
    || ['WORKER_PROFILE_NOT_READY', 'PROFILE_NOT_OWNED_BY_ACCOUNT', 'TEAM_CAPACITY_EXCEEDED'].includes(result.kod);
  const calendar = result.hardBlockers.includes('CALENDAR_CONFLICT');
  if (!messages.length && !profile && !calendar) return null;
  return { messages: messages.length ? messages : [result.poruka], profile, calendar };
}

const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const key = (value: string) => value.trim().length >= 8 && value.trim().length <= 200;
function interval(start: string | null, end: string | null) {
  if (start === null || end === null) return start === null && end === null;
  const from = calendarInstant(start), to = calendarInstant(end);
  return from !== null && to !== null && from < to;
}
const invalid = () => failure('APPLICATION_COMMAND_INVALID', 'Proveri cenu, broj ljudi i termin svoje ponude.');
/** Bounds the two composed screen reads, including legacy SDK readers. The
 * caller's existing focus/account/generation guard owns the result. A deadline
 * stops waiting; it does not claim cancellation of an already issued request. */
export async function boundedApplicationSelectionRead<T>(read: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('APPLICATION_SELECTION_READ_TIMEOUT')), 15_000);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
async function command<T>(rpc: string, args: Record<string, unknown>, decode: (raw: unknown) => T | null): Promise<Ishod<T>> {
  return readOwnedResult({ write: true, errors: applicationSelectionErrors,
    fallback: 'APPLICATION_SELECTION_UNCONFIRMED', invalid: 'APPLICATION_SELECTION_INVALID_RECEIPT', decode,
    request: async () => {
      const result = await supabaseKlijent().rpc(rpc, args);
      const calendar = calendarFailure(result.error);
      return calendar && !calendar.ok ? { data: null, error: { message: calendar.kod } } : result;
    },
  });
}

/** Sole canonical submit/select adapter. Explicit retries reuse the caller's
 * immutable request. Server still owns eligibility, calendar and atomic Agreement. */
export const applicationSelectionClientService: Pick<Izvor, 'podnesiPrijavu' | 'izaberiPrijavu'> = {
  async podnesiPrijavu(k: PodnesiPrijavuKomanda) {
    if (!uuid(k.potrebaId) || !uuid(k.radnikProfilId) || !positiveInteger(k.potrebaRevizija) ||
        !positiveInteger(k.pokrivenaMesta) || !positiveInteger(k.cenaRsd) || !key(k.clientRequestId) ||
        !interval(k.predlozeniPocetak, k.predlozeniKraj) ||
        (k.napomena !== null && (typeof k.napomena !== 'string' || k.napomena.length > 4000))) return invalid();
    const args = {
      p_need_id: k.potrebaId, p_need_revision: k.potrebaRevizija, p_worker_profile_id: k.radnikProfilId,
      p_covered_slots: k.pokrivenaMesta, p_price_rsd: k.cenaRsd,
      p_proposed_start_at: k.predlozeniPocetak, p_proposed_end_at: k.predlozeniKraj,
      p_scope_note: k.napomena, p_client_request_id: k.clientRequestId,
    };
    type Envelope =
      | { kind: 'SUCCESS'; receipt: { prijavaId: string; verzija: number; hash: string } }
      | { kind: 'REFUSAL'; refusal: ApplicationSubmitRefusal };
    const outcome = await readOwnedResult<Envelope>({ write: true, errors: applicationSelectionErrors,
      fallback: 'APPLICATION_SELECTION_UNCONFIRMED', invalid: 'APPLICATION_SELECTION_INVALID_RECEIPT',
      request: async () => {
        const response = await supabaseKlijent().rpc('rpc_submit_response', args);
        const refusal = decodeSubmitRefusal(response.error);
        if (refusal) return { data: { kind: 'REFUSAL', refusal }, error: null };
        const calendar = calendarFailure(response.error);
        if (calendar && !calendar.ok) return { data: null, error: { message: calendar.kod } };
        return response.error ? response : { data: { kind: 'SUCCESS', raw: response.data }, error: null };
      },
      decode(raw) {
        const envelope = record(raw);
        if (envelope?.kind === 'REFUSAL') {
          const refusal = envelope.refusal as Ishod<unknown>;
          return conclusiveApplicationRefusal(refusal) ? { kind: 'REFUSAL', refusal } : null;
        }
        if (envelope?.kind !== 'SUCCESS') return null;
        const value = record(envelope.raw);
        if (!value || !uuid(value.responseId) || !sameId(value.applicationId, value.responseId) ||
            !positiveInteger(value.version) || value.needRevision !== k.potrebaRevizija || !hash(value.contentHash) ||
            !['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(String(value.status)) ||
            !['MY_PRICE', 'OFFERS'].includes(String(value.pricingMode)) || value.coveredSlots !== k.pokrivenaMesta ||
            value.snapshotSchema !== 'APPLICATION_V1_SELF_DECLARED' || value.authoritative !== true ||
            typeof value.idempotentReplay !== 'boolean') return null;
        return { kind: 'SUCCESS', receipt: { prijavaId: value.responseId, verzija: value.version, hash: value.contentHash } };
      },
    });
    if (!outcome.ok) return outcome;
    return outcome.podatak.kind === 'REFUSAL' ? outcome.podatak.refusal : { ok: true as const, podatak: outcome.podatak.receipt };
  },
  izaberiPrijavu(k: IzborKomanda) {
    if (!uuid(k.potrebaId) || !uuid(k.prijavaId) || !positiveInteger(k.potrebaRevizija) ||
        !positiveInteger(k.prijavaVerzija) || !positiveInteger(k.mesta) || !hash(k.prijavaHash) || !key(k.clientRequestId)) {
      return Promise.resolve(failure('SELECTION_COMMAND_INVALID', 'Ponovo otvori konkretnu prijavu pre izbora.'));
    }
    return command('rpc_select_response', { p_need_id: k.potrebaId, p_need_revision: k.potrebaRevizija,
      p_response_id: k.prijavaId, p_response_version: k.prijavaVerzija, p_content_hash: k.prijavaHash,
      p_client_request_id: k.clientRequestId }, raw => uuid(raw) ? { dogovorId: raw } : null);
  },
};

/** Existing requester/participant SELECT policies remain the authority. A null
 * link means no visible matching Agreement; it never proves the selection absent. */
export function readSelectedAgreement(potrebaId: string, prijavaId: string): Promise<Ishod<{ dogovorId: string | null }>> {
  if (!uuid(potrebaId) || !uuid(prijavaId)) return Promise.resolve(failure('SELECTION_LINK_INVALID', 'Ponovo otvori konkretnu prijavu.'));
  const owner = sesijaSada();
  if (!owner.user?.id) return Promise.resolve(failure('AUTH_REQUIRED', 'Prijavi se da otvoriš Dogovor.'));
  const account = { accountId: owner.user.id, accountRevision: owner.accountRevision };
  return readOwnedResult({ account, errors: {}, fallback: 'SELECTION_LINK_UNAVAILABLE', invalid: 'SELECTION_LINK_INVALID',
    request: () => supabaseKlijent().from('need_selections')
      .select('need_id,response_id,status,agreements(id,need_id,selected_response_id)')
      .eq('need_id', potrebaId).eq('response_id', prijavaId).eq('status', 'SELECTED')
      .eq('selected_by_account_id', account.accountId).maybeSingle(),
    decode(raw) {
      if (raw === null) return { dogovorId: null };
      const selection = record(raw);
      if (!selection || selection.status !== 'SELECTED' || !sameId(selection.need_id, potrebaId) || !sameId(selection.response_id, prijavaId)) return null;
      const linked = selection.agreements;
      if (linked === null || (Array.isArray(linked) && linked.length === 0)) return { dogovorId: null };
      if (Array.isArray(linked) && linked.length !== 1) return null;
      const agreement = record(Array.isArray(linked) ? linked[0] : linked);
      return agreement && uuid(agreement.id) && sameId(agreement.need_id, potrebaId) && sameId(agreement.selected_response_id, prijavaId)
        ? { dogovorId: agreement.id } : null;
    },
  });
}
