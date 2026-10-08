import { View } from 'react-native';
import type { JavniProfilProjekcija } from '../../../contracts/projections';
import type { MyWorkStats, PublicWorkTrust } from '../../../data/workTrustClientService';
import { T } from '../../Text';
import { Lice, TriBroja } from './parts';
import { Grad, JavniOkvir, OMeni, Potvrde, ProfilGrupe, ProfilScreen, javniBrojevi, mojiBrojevi, potvrde, ps, type Reputation, type Who } from './profilShared';

/**
 * VARIANT B, "Brojevi vode" (from the number; pravac B5 in the spirit of R2 f3, without sharing).
 *
 * MY PROFILE: the three figures at 32/700 stand FIRST, before the face, on the left edge; the face (56) and the name (21) follow in one
 * row; then the groups. Three display figures are three focal points (the risk the pravac names): the blur test is the owner's to judge.
 * PUBLIC PROFILE: the three figures, the person's own line and the city, "O meni", the confirmations.
 */
export function ProfilB({ who, stats, reputation }: { who: Who; stats: MyWorkStats; reputation: Reputation }) {
  return <ProfilScreen>
    <TriBroja cells={mojiBrojevi(stats, reputation)} size="display" align="left" testID="var-tri-broja" />
    <View style={ps.row}>
      <Lice initials={who.initials} size={56} />
      <View style={ps.copy}>
        {who.name ? <T accessibilityRole="header" variant="title" style={ps.ink}>{who.name}</T>
          : <T accessibilityRole="header" variant="title" tone="muted">Ime još nije uneto</T>}
        <Grad place={who.place} />
      </View>
    </View>
    <ProfilGrupe stats={stats} email={who.email} />
  </ProfilScreen>;
}

export function JavniB({ profile, trust }: { profile: JavniProfilProjekcija; trust: PublicWorkTrust | null }) {
  const facts = profile.poverenje;
  return <JavniOkvir profile={profile}>
    <TriBroja cells={javniBrojevi(facts, trust)} size="display" align="left" testID="var-tri-broja" />
    <View style={ps.copy}>
      {profile.naslov ? <T variant="heading" style={ps.ink}>{profile.naslov}</T> : null}
      <Grad place={profile.grad} />
    </View>
    <OMeni text={profile.biografija} />
    <Potvrde items={potvrde(facts, trust)} />
  </JavniOkvir>;
}
