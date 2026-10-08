import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { JavniProfilPoverenje, JavniProfilProjekcija } from '../../contracts/projections';
import type { PublicWorkTrust } from '../../data/workTrustClientService';
import { inicijali } from '../../lib/inicijali';
import { tidyPlaceLabel } from '../location/placeText';
import { memberSincePhrase, publicTrustFacts, RELIABILITY_FEW, RELIABILITY_LABEL } from '../profile/workTrustModel';
import { ProductSheet } from '../product/ProductSheet';
import { T } from '../Text';
import { FactArt } from './FactArt';
import { FactRow } from './FactRow';
import { layout } from './layout';
import { ListRow } from './ListRow';
import { plural, zadataka } from './plural';
import { StateView } from './StateView';
import { useLayoutClass } from './textScale';
import { sys } from './tokens';

export type PublicProfileState = { loading: boolean; data: JavniProfilProjekcija | null } | null;
/** PKG-047 (F05): the one entry into report/block from a profile. The screen owns the read that turns
 *  this profile into the person behind it; the sheet only offers it and shows what came back. */
export type SafetyEntry = { onPress: () => void; busy: boolean; error: string | null };
/** The label of the safety entry, the same words as the "···" row of a task (review of step 5b). */
export const SAFETY_LABEL = 'Prijavi ili blokiraj osobu';

/**
 * The trust block of a worker profile (PROFILE-TRUST, 2026-10-07; R30), as the SERVER answered it (`rpc_public_work_trust_v1`):
 * how many Dogovori the person made and finished, how reliably they come as agreed (a percentage from five Dogovori) and since when
 * they are here. Who may read the last three is the owner's privacy decision, and the server answers it: for a visitor it is `HIDDEN`
 * today (only the person themself reads them), and the sheet then draws NOTHING about them: no row, no placeholder, no word about what
 * is hidden. The caller reads it (`usePublicWorkTrust`) and hands it in; without it the sheet is exactly what it was.
 */
export type PublicProfileTrust = PublicWorkTrust | null | undefined;

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
/** "Na USKOČI-ju od oktobra 2026", from an ISO date; anything that is not a date says nothing. */
export const memberSinceFact = memberSincePhrase;

/**
 * A person's public profile as a sheet over the screen it was opened from (owner decision 3, 2026-09-16; moved onto the
 * one sheet engine in step 7, 2026-09-24, where it was a hand-made page modal). The person's name is the sheet's title —
 * nothing above it says "Javni profil" once the name is known (owner rule, 2026-09-23: say who they are, not where you
 * are). Presentation over the existing `javniProfil` read: a rating, a review count or a verified identity appear solely
 * when the server marks them available, and a missing one says it is missing. The caller owns the read and its guards.
 *
 * T4/T5 (2026-10-07): under the name and the city, the person's own "O meni" when they wrote one, then the facts as `FactRow`s
 * (UI/UX pass 2026-10-08, F6): the rating ("4,8 · 12 ocena", or "Još nema ocena"), "Završeno N zadataka", only when it is true
 * "Identitet je potvrđen", and what the trust read adds when the server lets this viewer have it. Nothing here is a control except
 * the safety entry, which is last and red: no row opens another person's ratings, because no read of them exists.
 *
 * Reporting and blocking are rare, so they close the sheet's content, apart from the facts by the sheet's own spacing and not by a
 * line: one row that names the person's action ("Prijavi ili blokiraj osobu") and says the report is private. The row keeps the
 * entry's busy and error states.
 */
export function PublicProfileSheet({ state, onClose, onRetry, photo, safety, trust }: {
  state: PublicProfileState; onClose: () => void; onRetry: () => void;
  /** The public portrait and its initials stand-in both keep the larger 96 dp profile size. */
  photo?: (profileId: string, size?: number) => ReactNode;
  safety?: SafetyEntry;
  /** The trust read of this person (see `PublicProfileTrust`). Left out, or HIDDEN: nothing of it is drawn. */
  trust?: PublicProfileTrust;
}) {
  const { stacked } = useLayoutClass();
  if (!state) return null;
  const profile = state.loading ? null : state.data, facts = profile?.poverenje;
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
            {profile.grad ? <View style={s.place}><FactArt kind="pin" size={16} /><T variant="body" tone="muted" style={s.grow}>{tidyPlaceLabel(profile.grad)}</T></View> : null}
          </View>
        </View>
        {about ? <View style={s.section}>
          <T accessibilityRole="header" variant="heading" style={s.ink}>O meni</T>
          <T selectable variant="body" style={s.ink}>{about}</T>
        </View> : null}
        {facts ? <TrustFacts facts={facts} trust={trust} /> : null}
        {safety ? <View>
          {/* A command with its words in red and its arrow: it opens the report, so the row says where it goes. */}
          <ListRow leading={<FactArt kind="shield" size={32} muted />} title={safety.busy ? 'Otvaramo…' : SAFETY_LABEL} tone="danger" arrow last
            subtitle="Osoba koju prijavljuješ ne vidi prijavu." disabled={safety.busy} onPress={safety.onPress}
            accessibilityLabel={`${SAFETY_LABEL}: ${name}`}
            accessibilityHint="Otvara prijavu ili blokiranje osobe. Osoba koju prijavljuješ ne vidi tvoju prijavu." />
          {safety.error ? <T accessibilityRole="alert" accessibilityLiveRegion="polite" variant="note" tone="danger">{safety.error}</T> : null}
        </View> : null}
      </View>}
  </ProductSheet>;
}

/**
 * The facts of a person, one `FactRow` each, in a group with the screen's own spacing between them (no line, no box): the rating written
 * the Serbian way ("4,8") with the count it stands on, or "Još nema ocena", or not available; "Završeno N zadataka" (zero too, as zero); a
 * verified identity only when the server reports it; and what the trust read returned for a viewer it lets read it ("Dogovoreno N
 * zadataka", "Dolazi kako je dogovoreno: N%" or that there are not enough Dogovori for a percentage, "Na USKOČI-ju od ..."). Neither the
 * number of applications nor anything the server does not carry is here.
 */
function TrustFacts({ facts, trust }: { facts: JavniProfilPoverenje; trust?: PublicProfileTrust }) {
  const rating = publicRating(facts);
  const verified = facts.verifikacijaIdentitetaDostupna && facts.identitetVerifikovan;
  const more = publicTrustFacts(trust);
  return <View testID="public-profile-facts" style={s.facts}>
    {/* The star is the sign of a rating that exists; a person without one gets the quiet sign of information, not a star in colour. */}
    <FactRow size="detail" art={rating.kind === 'rated' ? 'star' : 'info'} testID="public-profile-fact-rating"
      value={rating.kind === 'rated' ? `${rating.value}${rating.count ? ` · ${rating.count}` : ''}` : rating.kind === 'none' ? 'Još nema ocena' : 'Ocena nije dostupna'} />
    <FactRow size="detail" art="check" testID="public-profile-fact-finished" value={finishedPhrase(facts.zavrseniBroj)} />
    {verified ? <FactRow size="detail" art="shield" testID="public-profile-fact-verified" value="Identitet je potvrđen" /> : null}
    {more?.agreed ? <FactRow size="detail" art="agreements" testID="public-profile-fact-agreed" value={more.agreed} /> : null}
    {more?.reliability ? <FactRow size="detail" art="agreements" testID="public-profile-fact-reliability"
      value={more.reliability.kind === 'percent' ? `${RELIABILITY_LABEL}: ${more.reliability.percent}%` : RELIABILITY_FEW} /> : null}
    {more?.since ? <FactRow size="detail" art="calendar" testID="public-profile-fact-since" value={more.since} /> : null}
  </View>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  grow: { flex: 1, minWidth: 0 },
  content: { gap: layout.section, paddingTop: sys.space.sm, paddingBottom: sys.space.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: sys.space.base },
  identityStack: { flexDirection: 'column', alignItems: 'flex-start' },
  face: { width: 96, height: 96, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
    borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, overflow: 'hidden' },
  initials: { ...sys.type.display, color: sys.color.green, letterSpacing: 0, textAlign: 'center' },
  identityCopy: { flexShrink: 1, minWidth: 0, gap: sys.space.sm },
  identityCopyStack: { width: '100%', flexShrink: 0 },
  place: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  facts: { gap: layout.group },
  section: { gap: sys.space.md },
});
