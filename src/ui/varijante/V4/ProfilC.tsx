import { StyleSheet, View } from 'react-native';
import type { JavniProfilProjekcija } from '../../../contracts/projections';
import type { MyWorkStats, PublicWorkTrust } from '../../../data/workTrustClientService';
import { inicijali } from '../../../lib/inicijali';
import { T } from '../../Text';
import { Surface } from '../../system/Surface';
import { layout } from '../../system/layout';
import { Lice, TriBroja, type Broj } from './parts';
import { Grad, JavniOkvir, OMeni, Potvrde, ProfilGrupe, ProfilScreen, javniBrojevi, mojePotvrde, mojiBrojevi, potvrde, ps, type Potvrda, type Reputation, type Who } from './profilShared';

/**
 * VARIANT C, "Kartica poverenja" (from the object: one shape through the whole flow; pravac B4 + B5, (T)).
 *
 * ONE PANEL (an edge, no shadow: it is read, not touched) holds the identity, the three figures and the confirmations: the face at 56,
 * the name and the city, the figures at 24/700 on the left, the facts under them. The same panel is what the public profile shows and
 * what the task detail would show as "Objavio" (V2), so the eye meets one object wherever a person is judged. Under it, the groups.
 * The pravac itself warns that a panel around the identity goes against "identity is not a card" (AIRBNB P4): the variant tests the
 * opposite on purpose.
 */
export function KarticaPoverenja({ name, initials, place, line, cells, facts }: {
  name: string | null; initials: string | null; place: string | null;
  /** The person's own line under the name (the public "naslov"). */
  line?: string | null;
  cells: readonly [Broj, Broj, Broj]; facts: readonly Potvrda[];
}) {
  return <Surface kind="panel" testID="var-kartica-poverenja" style={s.panel}>
    <View style={ps.row}>
      <Lice initials={initials} size={56} edge />
      <View style={ps.copy}>
        {name ? <T accessibilityRole="header" variant="title" style={ps.ink}>{name}</T> : null}
        {line ? <T variant="note" style={ps.ink}>{line}</T> : null}
        <Grad place={place} />
      </View>
    </View>
    <TriBroja cells={cells} align="left" testID="var-tri-broja" />
    <Potvrde items={facts} size="card" />
  </Surface>;
}

export function ProfilC({ who, stats, reputation }: { who: Who; stats: MyWorkStats; reputation: Reputation }) {
  return <ProfilScreen>
    <KarticaPoverenja name={who.name ?? 'Ime još nije uneto'} initials={who.initials} place={who.place} cells={mojiBrojevi(stats, reputation)} facts={mojePotvrde(stats)} />
    <ProfilGrupe stats={stats} email={who.email} />
  </ProfilScreen>;
}

export function JavniC({ profile, trust }: { profile: JavniProfilProjekcija; trust: PublicWorkTrust | null }) {
  const facts = profile.poverenje;
  // The sheet's title already says the name, so the panel carries the person's own line and the city under the face.
  return <JavniOkvir profile={profile}>
    <KarticaPoverenja name={null} initials={inicijali(profile.ime)} place={profile.grad} line={profile.naslov} cells={javniBrojevi(facts, trust)} facts={potvrde(facts, trust)} />
    <OMeni text={profile.biografija} />
  </JavniOkvir>;
}

const s = StyleSheet.create({
  panel: { gap: layout.group },
});
