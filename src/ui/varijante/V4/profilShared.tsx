import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { JavniProfilPoverenje, JavniProfilProjekcija } from '../../../contracts/projections';
import type { MyWorkStats, PublicWorkTrust } from '../../../data/workTrustClientService';
import { ProductSheet } from '../../product/ProductSheet';
import { memberSincePhrase, publicTrustFacts } from '../../profile/workTrustModel';
import { SettingsGroup, SettingsRow, SettingsScreen } from '../../settings/SettingsPresentation';
import { T } from '../../Text';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { FactRow } from '../../system/FactRow';
import { ListRow } from '../../system/ListRow';
import { plural } from '../../system/plural';
import { SAFETY_LABEL } from '../../system/PublicProfileSheet';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { layout } from '../../system/layout';
import { sys } from '../../system/tokens';
import { noop } from './lab';
import type { Broj } from './parts';

/**
 * What the three profile variants share: the three figures from the data (and the words for a figure that does not exist yet), the
 * confirmations a public profile can show from what the server returned, the groups of rows under the identity (production's
 * `SettingsGroup`/`SettingsRow`, shortened to the rows the picture needs), the sheet of the public profile (production's
 * `ProductSheet`) with the safety row at its end. No figure is computed here; every one is the server's or it is a word.
 */
export type Who = { name: string | null; initials: string | null; place: string | null; email: string | null };
export type Reputation = { averageRating: number | null; reviewCount: number };

const ratingText = (value: number) => value.toLocaleString('sr-Latn-RS', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
/** Below three ratings the average is not a figure (pravac C.12, C.15: "ispod 3 ocene = Nova ocena"). */
export const RATINGS_FOR_FIGURE = 3;
export function ocenaBroj(average: number | null, count: number): Broj {
  const counted = plural(count, 'ocena', 'ocene', 'ocena');
  if (average !== null && Number.isFinite(average) && count >= RATINGS_FOR_FIGURE) return { value: ratingText(average), label: counted, star: true };
  return { value: null, word: 'Nova ocena', label: count > 0 ? counted : 'još nema ocena' };
}
export function zavrsenoBroj(count: number): Broj {
  // "9 završenih" → the word alone; the figure stands above it.
  return { value: count.toLocaleString('sr-Latn-RS'), label: plural(count, 'završen', 'završena', 'završenih').replace(/^\S+\s/, '') };
}
export function dolaziBroj(percent: number | null, state: string): Broj {
  return state === 'AVAILABLE' && percent !== null ? { value: `${percent} %`, label: 'dolazi kako je dogovoreno' }
    : { value: null, word: 'Još nema procenta', label: 'dolazi kako je dogovoreno' };
}
export const mojiBrojevi = (stats: MyWorkStats, reputation: Reputation): [Broj, Broj, Broj] =>
  [ocenaBroj(reputation.averageRating, reputation.reviewCount), zavrsenoBroj(stats.agreementsCompleted), dolaziBroj(stats.reliabilityPercent, stats.reliabilityState)];
export const javniBrojevi = (facts: JavniProfilPoverenje, trust: PublicWorkTrust | null): [Broj, Broj, Broj] =>
  [ocenaBroj(facts.ocenaDostupna ? facts.ocenaProsek : null, facts.brojRecenzija ?? 0), zavrsenoBroj(facts.zavrseniBroj),
    dolaziBroj(trust?.reliabilityPercent ?? null, trust?.reliabilityState ?? 'HIDDEN')];

export type Potvrda = { art: FactArtKind; value: string };
/** The confirmations of a public profile, only from what the server returned: identity, agreed, since when (pravac C.16, R1 R-24). */
export function potvrde(facts: JavniProfilPoverenje, trust: PublicWorkTrust | null): Potvrda[] {
  const out: Potvrda[] = [];
  if (facts.verifikacijaIdentitetaDostupna && facts.identitetVerifikovan) out.push({ art: 'shield', value: 'Identitet je potvrđen' });
  const more = publicTrustFacts(trust);
  if (more?.agreed) out.push({ art: 'agreements', value: more.agreed });
  if (more?.since) out.push({ art: 'calendar', value: more.since });
  return out;
}
/** My own confirmations, from my statistics: the work profile's state and since when I am here. */
export function mojePotvrde(stats: MyWorkStats): Potvrda[] {
  const out: Potvrda[] = [];
  if (stats.profileStatus === 'ACTIVE') out.push({ art: 'tool', value: 'Radni profil je aktivan' });
  const since = memberSincePhrase(stats.memberSince);
  if (since) out.push({ art: 'calendar', value: since });
  return out;
}

export function Potvrde({ items, size = 'detail' }: { items: readonly Potvrda[]; size?: 'detail' | 'card' }) {
  if (!items.length) return null;
  return <View testID="var-potvrde" style={s.facts}>{items.map(item => <FactRow key={item.value} size={size} art={item.art} value={item.value} />)}</View>;
}

/** The groups under the identity, production's rows (shortened: the picture needs the shape, not every row). */
export function ProfilGrupe({ stats, email }: { stats: MyWorkStats; email: string | null }) {
  const active = stats.profileStatus === 'ACTIVE';
  const row = (label: string, art: FactArtKind, extra: { detail?: string; last?: boolean; attention?: boolean } = {}) =>
    <SettingsRow label={label} detail={extra.detail} last={extra.last} attention={extra.attention} onPress={noop} icon={<FactArt kind={art} size={32} />} />;
  return <>
    <SettingsGroup title="Kako mogu da uskočim">
      {row('Radni profil', 'tool', { detail: active ? 'Profil je aktivan.' : 'Radni profil još nije podešen. Bez njega ne možeš da se prijaviš na zadatak.', attention: !active })}
      {row('Područje rada', 'pin', { detail: active ? 'Novi Sad' : 'Nije podešeno' })}
      {row('Dostupnost', 'clock', { detail: 'Kada mogu da radim' })}
      {row('Raspored', 'calendar', { detail: 'Dogovoreni termini', last: true })}
    </SettingsGroup>
    <SettingsGroup title="Nalog i pomoć">
      {row('Podešavanja obaveštenja', 'bell')}
      {row('Promeni lozinku', 'lock', { detail: email ?? undefined })}
      {row('Podrška', 'support', { detail: 'Privatni zahtevi, odgovori i ponovni pregled.', last: true })}
    </SettingsGroup>
    <ListRow title="Odjavi se" tone="danger" last onPress={noop} />
  </>;
}

export function ProfilScreen({ children }: { children: ReactNode }) {
  return <SettingsScreen title="Profil" onBack={noop} right={<ChromeIconButton label="Izmeni profil" hint="Otvara izmenu fotografije, imena i opisa." glyph="edit" raised onPress={noop} />}>
    {children}
  </SettingsScreen>;
}

/** The public profile as a sheet over the screen it was opened from (production's `ProductSheet`), the name as its title, the safety row last. */
export function JavniOkvir({ profile, children }: { profile: JavniProfilProjekcija; children: ReactNode }) {
  const name = profile.ime?.trim() || 'Ime nije dostupno';
  return <ProductSheet title={name} closeLabel="Zatvori javni profil" backdropHint="Zatvara javni profil." onClose={noop}>
    {() => <View style={s.sheet}>
      {children}
      <ListRow leading={<FactArt kind="shield" size={32} muted />} title={SAFETY_LABEL} tone="danger" arrow last subtitle="Osoba koju prijavljuješ ne vidi prijavu."
        onPress={noop} accessibilityLabel={`${SAFETY_LABEL}: ${name}`} accessibilityHint="Otvara prijavu ili blokiranje osobe. Osoba koju prijavljuješ ne vidi tvoju prijavu." />
    </View>}
  </ProductSheet>;
}

export function OMeni({ text }: { text: string | null }) {
  if (!text?.trim()) return null;
  return <View style={s.section}>
    <T accessibilityRole="header" variant="heading" style={ps.ink}>O meni</T>
    <T selectable variant="body" style={ps.ink}>{text}</T>
  </View>;
}

/** The city under a name: the flat pin at 16 and the words. */
export function Grad({ place, center = false }: { place: string | null; center?: boolean }) {
  if (!place) return null;
  return <View style={[s.city, center && s.cityCenter]}><FactArt kind="pin" size={16} /><T variant="note" tone="muted" style={ps.shrink}>{place}</T></View>;
}

export const ps = StyleSheet.create({
  ink: { color: sys.color.ink },
  center: { textAlign: 'center' },
  shrink: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.base },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
});

const s = StyleSheet.create({
  facts: { gap: layout.group },
  sheet: { gap: layout.section, paddingTop: sys.space.sm, paddingBottom: sys.space.sm },
  section: { gap: sys.space.md },
  city: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, maxWidth: '100%' },
  cityCenter: { justifyContent: 'center' },
});
