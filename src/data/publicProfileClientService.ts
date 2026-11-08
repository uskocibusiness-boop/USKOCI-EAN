import type { JavniProfilProjekcija } from '../contracts/projections';
import type { Izvor } from './ports';
import { sesijaSada } from '../store/sesija';
import { readOwnedResult, record, sameId, timestamp, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type PublicProfileService = {
  javniProfil(profileId: string, signal?: AbortSignal): ReturnType<Izvor['javniProfil']>;
  javniProfili(profileIds: readonly string[], signal?: AbortSignal): Promise<ReadonlyMap<string, JavniProfilProjekcija | null>>;
};
export const PUBLIC_PROFILES_BATCH_LIMIT = 100;
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

function decodePublicProfiles(raw: unknown, accountId: string, profileIds: readonly string[]): ReadonlyMap<string, JavniProfilProjekcija | null> | null {
  const value = record(raw);
  if (!value || !exact(value, ['schema', 'accountId', 'profiles', 'asOf', 'authoritative'])
    || value.schema !== 'PUBLIC_PROFILES_BATCH_V1' || !sameId(value.accountId, accountId)
    || value.authoritative !== true || !timestamp(value.asOf) || !Array.isArray(value.profiles)
    || value.profiles.length !== profileIds.length) return null;
  const profiles = new Map<string, JavniProfilProjekcija | null>();
  for (let i = 0; i < profileIds.length; i++) {
    const entry = record(value.profiles[i]), expected = profileIds[i];
    if (!entry || !exact(entry, ['profileId', 'profile']) || !sameId(entry.profileId, expected)) return null;
    if (entry.profile === null) { profiles.set(expected, null); continue; }
    const profile = record(entry.profile);
    if (!profile || !sameId(profile.profileId, expected)) return null;
    // The existing public reader owns the projection and reputation rules. Keep
    // the request's spelling of the same UUID so overlay keys remain exact.
    profiles.set(expected, { ...mapPublicProfile(profile), profilId: expected });
  }
  return profiles;
}

function mapPublicProfile(raw: any): JavniProfilProjekcija {
  if (!raw || typeof raw !== 'object') throw new Error('PUBLIC_PROFILE_INVALID_PROJECTION');
  if (typeof raw.profileId !== 'string' || !raw.profileId) throw new Error('PUBLIC_PROFILE_ID_MISSING');
  if (raw.role !== 'REQUESTER' && raw.role !== 'WORKER') throw new Error('PUBLIC_PROFILE_ROLE_UNSUPPORTED');

  const trust = raw.trust;
  if (!trust || typeof trust !== 'object') throw new Error('PUBLIC_PROFILE_TRUST_INVALID');

  const completedCount = trust.completedCount;
  if (typeof completedCount !== 'number' || !Number.isSafeInteger(completedCount) || completedCount < 0) {
    throw new Error('PUBLIC_PROFILE_COMPLETED_COUNT_INVALID');
  }

  const reviewsAvailable = trust.reviewsAvailable === true;
  const count = trust.reviewCount, average = trust.ratingAverage;
  if (reviewsAvailable) {
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 ||
        (count === 0 ? average !== null || trust.ratingAvailable !== false
          : typeof average !== 'number' || !Number.isFinite(average) || average < 1 || average > 5 || trust.ratingAvailable !== true)) {
      throw new Error('PUBLIC_PROFILE_RATING_INVALID');
    }
  } else if (count !== null || average !== null || trust.ratingAvailable !== false) {
    throw new Error('PUBLIC_PROFILE_RATING_INVALID');
  }

  return {
    profilId: raw.profileId,
    uloga: raw.role === 'REQUESTER' ? 'narucilac' : 'uskocer',
    ime: typeof raw.displayName === 'string' ? raw.displayName : null,
    avatarPutanja: typeof raw.avatarPath === 'string' ? raw.avatarPath : null,
    grad: typeof raw.city === 'string' ? raw.city : null,
    naslov: typeof raw.publicSummary?.headline === 'string' ? raw.publicSummary.headline : null,
    biografija: typeof raw.publicSummary?.bio === 'string' ? raw.publicSummary.bio : null,
    poverenje: {
      ocenaProsek: typeof trust.ratingAverage === 'number' ? trust.ratingAverage : null,
      brojRecenzija: Number.isInteger(trust.reviewCount) && trust.reviewCount >= 0 ? trust.reviewCount : null,
      zavrseniBroj: completedCount,
      identitetVerifikovan: trust.identityVerified === true,
      ocenaDostupna: trust.ratingAvailable === true,
      recenzijeDostupne: trust.reviewsAvailable === true,
      verifikacijaIdentitetaDostupna: trust.identityVerificationAvailable === true,
    },
  };
}

/**
 * RU-5 / P0C-01 typed read boundary.
 *
 * The server owns the public/private cut. This client never reads another
 * account's raw app_profiles row and never reconstructs rating, review,
 * verification, completed-work, availability, radius, tool or vehicle truth.
 */
export const publicProfileClientService: PublicProfileService = {
  async javniProfili(profileIds, signal) {
    if (!Array.isArray(profileIds) || profileIds.length > PUBLIC_PROFILES_BATCH_LIMIT || profileIds.some(id => !uuid(id)))
      throw new Error('PUBLIC_PROFILE_BATCH_INPUT_INVALID');
    const seen = new Set<string>();
    const ids = profileIds.filter(id => { const key = id.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
    if (!ids.length) return new Map();
    const session = sesijaSada();
    if (!session.user) throw new Error('AUTH_REQUIRED');
    const account = { accountId: session.user.id, accountRevision: session.accountRevision };
    const result = await readOwnedResult({ account, signal,
      errors: { AUTH_REQUIRED: 'Prijavite se da nastavite.', AUTH_CONTEXT_CHANGED: 'Nalog je promenjen. Ponovo otvorite prikaz.',
        PUBLIC_PROFILE_BATCH_INPUT_INVALID: 'Javni profili trenutno nisu dostupni.' },
      fallback: 'PUBLIC_PROFILE_READ_FAILED', invalid: 'PUBLIC_PROFILE_BATCH_INVALID_RECEIPT',
      decode: raw => decodePublicProfiles(raw, account.accountId, ids),
      request: ownedSignal => {
        const request = supabase.rpc('rpc_get_public_profiles_batch', { p_expected_user_id: account.accountId, p_profile_ids: ids });
        return typeof request.abortSignal === 'function' ? request.abortSignal(ownedSignal) : request;
      },
    });
    if (!result.ok) throw new Error(result.kod);
    return result.podatak;
  },
  async javniProfil(profileId, signal) {
    const id = profileId.trim();
    if (!id) return null;

    let result;
    try {
      if (signal?.aborted) throw new Error('PUBLIC_PROFILE_READ_ABORTED');
      const request = supabase.rpc('rpc_get_public_profile', { p_profile_id: id });
      result = await (signal && typeof request.abortSignal === 'function' ? request.abortSignal(signal) : request);
      if (signal?.aborted) throw new Error('PUBLIC_PROFILE_READ_ABORTED');
    }
    catch { throw new Error('PUBLIC_PROFILE_READ_FAILED'); }
    const { data, error } = result;
    if (error) throw new Error(error.message === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'PUBLIC_PROFILE_READ_FAILED');
    return data ? mapPublicProfile(data) : null;
  },
};
