import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { JavniProfilPoverenje, JavniProfilProjekcija } from '../../contracts/projections';
import { inicijali } from '../../lib/inicijali';
import { ProductSheet } from '../product/ProductSheet';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt, type FactArtKind } from './FactArt';
import { plural, zadataka } from './plural';
import { StateView } from './StateView';
import { useTextScale } from './textScale';
import { sys } from './tokens';

export type PublicProfileState = { loading: boolean; data: JavniProfilProjekcija | null } | null;
/** PKG-047 (F05): the one entry into report/block from a profile. The screen owns the read that turns
 *  this profile into the person behind it; the sheet only offers it and shows what came back. */
export type SafetyEntry = { onPress: () => void; busy: boolean; error: string | null };
/** The label of the safety entry, the same words as the "···" row of a task (review of step 5b). */
export const SAFETY_LABEL = 'Prijavi ili blokiraj osobu';

/**
 * TRAŽI SERVER (T5, owner 2026-10-07): three facts of the designed public profile have no source yet, so none is drawn,
 * and no control or placeholder stands in for them:
 *  - "Dolazi kako je dogovoreno N%" (finished ÷ agreed, only from 5 Dogovora; never a percentage for a new person);
 *  - "Na USKOČI-ju od <mesec godina>";
 *  - the person's latest ratings with "Sve ocene" (no read of ANOTHER person's ratings exists), and the skills chips
 *    (the public projection deliberately carries no capability inventory).
 * The first two are written below as `reliabilityFact` / `memberSinceFact`, tested and switched off. The day the server
 * carries `agreedCount` and `memberSince`: add them to `JavniProfilProjekcija` and its mapper, pass them as `serverFacts`,
 * and turn this on, which is the whole change.
 */
export const PUBLIC_PROFILE_SERVER_FACTS_BUILT = false;
/** What the server does not carry yet (see above): how many Dogovori were made, and since when the person is here. */
export type PublicProfileServerFacts = { agreedCount?: number | null; memberSince?: string | null };

/** A rating the Serbian way: "4,8", "5,0", and two decimals only when the average really has two. */
const ratingText = (value: number) => value.toLocaleString('sr-Latn-RS', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
/** How the rating of a person reads: a number with the count it stands on, "no ratings yet", or not available. */
export type PublicRating = { kind: 'rated'; value: string; count: string | null } | { kind: 'none' } | { kind: 'unavailable' };
export function publicRating(trust: JavniProfilPoverenje): PublicRating {
  if (trust.recenzijeDostupne && trust.brojRecenzija === 0) return { kind: 'none' };
  if (trust.ocenaDostupna && typeof trust.ocenaProsek === 'number' && Number.isFinite(trust.ocenaProsek)) {
    const counted = trust.recenzijeDostupne && typeof trust.brojRecenzija === 'number' && trust.brojRecenzija > 0;
    return { kind: 'rated', value: ratingText(trust.ocenaProsek), count: counted ? plural(trust.brojRecenzija as number, 'ocena', 'ocene', 'ocena') : null };
  }
  return { kind: 'unavailable' };
}
/** "Završeno 14 zadataka": the one phrase for what a person has finished, everywhere. Zero is said as zero. */
export const finishedPhrase = (count: number) => `Završeno ${zadataka(count)}`;

/** From how many Dogovori a percentage is shown: a new person gets a quiet sentence, never "0%" or "100%". */
const RELIABILITY_FROM = 5;
export type ReliabilityFact = { kind: 'percent'; percent: number; detail: string } | { kind: 'few' };
export function reliabilityFact(completed: number, agreed: number | null | undefined): ReliabilityFact | null {
  if (typeof agreed !== 'number' || !Number.isSafeInteger(agreed) || agreed < 0 || !Number.isSafeInteger(completed) || completed < 0 || completed > agreed) return null;
  if (agreed < RELIABILITY_FROM) return { kind: 'few' };
  return { kind: 'percent', percent: Math.round(100 * completed / agreed), detail: `${completed} od ${agreed} dogovorenih` };
}
const MONTHS_FROM = ['januara', 'februara', 'marta', 'aprila', 'maja', 'juna', 'jula', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];
/** "Na USKOČI-ju od oktobra 2026", from an ISO date; anything that is not a date says nothing. */
export function memberSinceFact(memberSince: string | null | undefined): string | null {
  const match = typeof memberSince === 'string' ? /^(\d{4})-(\d{2})(?:-\d{2}.*)?$/.exec(memberSince) : null;
  const month = match ? Number(match[2]) : 0;
  return match && month >= 1 && month <= 12 ? `Na USKOČI-ju od ${MONTHS_FROM[month - 1]} ${match[1]}` : null;
}

/**
 * A person's public profile as a sheet over the screen it was opened from (owner decision 3, 2026-09-16; moved onto the
 * one sheet engine in step 7, 2026-09-24, where it was a hand-made page modal). The person's name is the sheet's title —
 * nothing above it says "Javni profil" once the name is known (owner rule, 2026-09-23: say who they are, not where you
 * are). Presentation over the existing `javniProfil` read: a rating, a review count or a verified identity appear solely
 * when the server marks them available, and a missing one says it is missing. The caller owns the read and its guards.
 *
 * T4/T5 (2026-10-07): under the name and the city, the person's own "O meni" when they wrote one, then the facts as rows
 * with their pictures: the rating ("4,8 · 12 ocena", or "Još nema ocena"), "Završeno N zadataka" and, only when it is
 * true, "Identitet je potvrđen". Nothing here is a control except the safety entry, which is last and red: no row opens
 * another person's ratings, because no read of them exists (see PUBLIC_PROFILE_SERVER_FACTS_BUILT).
 *
 * Reporting and blocking are rare, so they close the sheet's content, under a hairline: one row that names the person's
 * action ("Prijavi ili blokiraj osobu") and says the report is private. The row keeps the entry's busy and error states.
 */
export function PublicProfileSheet({ state, onClose, onRetry, photo, safety, serverFacts, showServerFacts = PUBLIC_PROFILE_SERVER_FACTS_BUILT }: {
  state: PublicProfileState; onClose: () => void; onRetry: () => void;
  /** The public portrait and its initials stand-in both keep the larger 96 dp profile size. */
  photo?: (profileId: string, size?: number) => ReactNode;
  safety?: SafetyEntry;
  /** Not carried by the server yet (see PUBLIC_PROFILE_SERVER_FACTS_BUILT): drawn only when `showServerFacts` is on. */
  serverFacts?: PublicProfileServerFacts; showServerFacts?: boolean;
}) {
  const { width } = useWindowDimensions();
  const textScale = useTextScale();
  const stacked = width < 360 || textScale >= 1.3;
  if (!state) return null;
  const profile = state.loading ? null : state.data, trust = profile?.poverenje;
  const name = profile ? profile.ime?.trim() || 'Ime nije dostupno' : null;
  const initials = profile ? inicijali(profile.ime) : null;
  // Present only when the person wrote something; shown exactly as written.
  const about = profile?.biografija && profile.biografija.trim() ? profile.biografija : null;
  return <ProductSheet title={name ?? 'Javni profil'} closeLabel="Zatvori javni profil" backdropHint="Zatvara javni profil." onClose={onClose}>
    {() => state.loading ? <StateView kind="loading" title="Učitavamo javni profil…" skeleton={{ count: 1, rows: 2 }} />
      : !profile ? <StateView kind="error" title="Javni profil trenutno nije dostupan." body="Proveri vezu i pokušaj ponovo."
        primary={{ label: 'Pokušaj ponovo', onPress: onRetry }} />
      : <View style={s.content}>
        <View style={[s.identity, stacked && s.identityStack]}>
          <View testID="public-profile-portrait" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.face}>
            {photo?.(profile.profilId, 96) ?? (initials
              ? <T maxFontSizeMultiplier={1} numberOfLines={1} style={s.initials}>{initials}</T>
              : <FactArt kind="person" size={48} />)}
          </View>
          <View style={[s.identityCopy, stacked && s.identityCopyStack]}>
            {profile.naslov ? <T variant="heading" style={s.ink}>{profile.naslov}</T> : null}
            {profile.grad ? <View style={s.place}><FactArt kind="pin" size={18} /><T variant="body" tone="muted" style={s.grow}>{profile.grad}</T></View> : null}
          </View>
        </View>
        {about ? <View style={s.section}>
          <T accessibilityRole="header" variant="heading" style={s.ink}>O meni</T>
          <T selectable variant="body" style={s.ink}>{about}</T>
        </View> : null}
        {trust ? <TrustFacts trust={trust} serverFacts={showServerFacts ? serverFacts : undefined} /> : null}
        {safety ? <View style={s.safety}>
          <Press accessibilityRole="button" accessibilityLabel={`${SAFETY_LABEL}: ${name}`}
            accessibilityHint="Otvara prijavu ili blokiranje. Osoba koju prijavljuješ ne vidi prijavu."
            accessibilityState={safety.busy ? { disabled: true, busy: true } : { disabled: false }} disabled={safety.busy}
            haptic={safety.busy ? 'none' : 'medium'} scaleTo={0.99} onPress={safety.onPress} style={s.safetyRow}>
            <View style={s.safetyArt}><FactArt kind="shield" size={26} muted /></View>
            <View style={s.grow}>
              <T variant="bodyStrong" style={s.danger}>{safety.busy ? 'Otvaramo…' : SAFETY_LABEL}</T>
              <T variant="note" tone="muted">Osoba koju prijavljuješ ne vidi prijavu.</T>
            </View>
          </Press>
          {safety.error ? <T accessibilityRole="alert" accessibilityLiveRegion="polite" variant="note" tone="danger">{safety.error}</T> : null}
        </View> : null}
      </View>}
  </ProductSheet>;
}

/** One fact of the profile beside its picture, as one spoken sentence (`label`); a quiet fact draws its picture in the quiet set. */
function FactRow({ art, quiet = false, label, children }: { art: FactArtKind; quiet?: boolean; label: string; children: ReactNode }) {
  return <View accessible accessibilityLabel={label} style={s.fact}>
    <FactArt kind={art} size={24} muted={quiet} />
    <View style={s.factText}>{children}</View>
  </View>;
}

/**
 * The facts of a person, one per row on an open white section: the rating written the Serbian way ("4,8") with the count it
 * stands on, or "Još nema ocena", or not available; "Završeno N zadataka" (zero too, as zero); and a verified identity
 * only when the server reports it. Neither the number of applications nor anything the server does not carry is here.
 */
function TrustFacts({ trust, serverFacts }: { trust: JavniProfilPoverenje; serverFacts?: PublicProfileServerFacts }) {
  const rating = publicRating(trust), finished = zadataka(trust.zavrseniBroj);
  const verified = trust.verifikacijaIdentitetaDostupna && trust.identitetVerifikovan;
  const reliability = serverFacts ? reliabilityFact(trust.zavrseniBroj, serverFacts.agreedCount) : null;
  const since = serverFacts ? memberSinceFact(serverFacts.memberSince) : null;
  return <View testID="public-profile-facts" style={s.facts}>
    <FactRow art="star" quiet={rating.kind !== 'rated'}
      label={`Ocena: ${rating.kind === 'none' ? 'još nema ocena' : rating.kind === 'unavailable' ? 'nije dostupna' : `${rating.value}${rating.count ? `, ${rating.count}` : ''}`}`}>
      {rating.kind === 'rated'
        ? <T variant="body" style={s.ink}><T variant="bodyStrong" style={s.ink}>{rating.value}</T>{rating.count ? ` · ${rating.count}` : ''}</T>
        : rating.kind === 'none' ? <T variant="body" style={s.ink}>Još nema ocena</T>
          : <T variant="body" tone="muted">Ocena nije dostupna</T>}
    </FactRow>
    <FactRow art="check" label={finishedPhrase(trust.zavrseniBroj)}>
      <T variant="body" style={s.ink}>Završeno <T variant="bodyStrong" style={s.ink}>{String(trust.zavrseniBroj)}</T>{finished.slice(String(trust.zavrseniBroj).length)}</T>
    </FactRow>
    {verified ? <FactRow art="shield" label="Identitet je potvrđen"><T variant="bodyStrong" style={s.ink}>Identitet je potvrđen</T></FactRow> : null}
    {reliability?.kind === 'percent'
      ? <FactRow art="agreements" label={`Dolazi kako je dogovoreno: ${reliability.percent}%, ${reliability.detail}`}>
        <View style={s.reliability}>
          <View style={s.grow}><T variant="body" style={s.ink}>Dolazi kako je dogovoreno</T><T variant="note" tone="muted">{reliability.detail}</T></View>
          <T variant="bodyStrong" style={s.ink}>{`${reliability.percent}%`}</T>
        </View></FactRow>
      : reliability?.kind === 'few'
        ? <FactRow art="agreements" quiet label="Još nema dovoljno zadataka za procenat"><T variant="body" tone="muted">Još nema dovoljno zadataka za procenat</T></FactRow> : null}
    {since ? <FactRow art="calendar" label={since}><T variant="body" style={s.ink}>{since}</T></FactRow> : null}
  </View>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink }, danger: { color: sys.color.danger },
  grow: { flex: 1, minWidth: 0 },
  content: { gap: sys.space.lg, paddingTop: sys.space.sm, paddingBottom: sys.space.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: sys.space.base },
  identityStack: { flexDirection: 'column', alignItems: 'flex-start' },
  face: { width: 96, height: 96, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
    borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, overflow: 'hidden' },
  initials: { ...sys.type.display, color: sys.color.green, letterSpacing: 0, textAlign: 'center' },
  identityCopy: { flexShrink: 1, minWidth: 0, gap: sys.space.sm },
  identityCopyStack: { width: '100%', flexShrink: 0 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The facts are rows on the open sheet, a hairline above each one and below the last; no tinted inner card.
  facts: { backgroundColor: sys.color.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  fact: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.line },
  factText: { flex: 1, minWidth: 0 },
  reliability: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  section: { gap: sys.space.md },
  safety: { gap: sys.space.sm, paddingTop: sys.space.lg, borderTopWidth: 1, borderTopColor: sys.color.line },
  safetyRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 56, paddingVertical: sys.space.xs },
  safetyArt: { width: 40, height: 40, borderRadius: sys.radius.chip, backgroundColor: sys.color.dangerSoft, alignItems: 'center', justifyContent: 'center' },
});
