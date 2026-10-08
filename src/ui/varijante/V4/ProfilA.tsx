import { StyleSheet, View } from 'react-native';
import type { JavniProfilProjekcija } from '../../../contracts/projections';
import type { MyWorkStats, PublicWorkTrust } from '../../../data/workTrustClientService';
import { inicijali } from '../../../lib/inicijali';
import { T } from '../../Text';
import { Glyph } from '../../system/Glyph';
import { ruleWidth } from '../../system/layout';
import { sys } from '../../system/tokens';
import { Lice, TriBroja } from './parts';
import { Grad, JavniOkvir, OMeni, Potvrde, ProfilGrupe, ProfilScreen, javniBrojevi, mojiBrojevi, potvrde, ps, type Reputation, type Who } from './profilShared';

/**
 * VARIANT A, "Lice i tri broja" (from the person; pravac B4 + B5, C.15, C.16).
 *
 * MY PROFILE: the face at 96, centred, with the sticker edge and the camera badge; the name at 28/33 under it, the city; then the row
 * of three figures at 24/700 with their words at 12 ("4,8 · 12 ocena | 9 završenih | 90 % dolazi kako je dogovoreno"), the one "table"
 * without lines; then the groups of rows. Identity is not a card. PUBLIC PROFILE: the same, the face at 72, the person's own line under
 * it, the three figures, "O meni", and the confirmations as 2.5D facts, only the ones the server returned.
 */
const FACE = 96;
const BADGE = 24;

export function ProfilA({ who, stats, reputation }: { who: Who; stats: MyWorkStats; reputation: Reputation }) {
  return <ProfilScreen>
    <View style={s.identity}>
      <View style={s.faceBox}>
        <Lice initials={who.initials} size={FACE} edge />
        <View style={s.badge}><Glyph name="camera" size={16} /></View>
      </View>
      {who.name ? <T accessibilityRole="header" variant="pageTitle" style={[ps.ink, ps.center]}>{who.name}</T>
        : <T accessibilityRole="header" variant="title" tone="muted" style={ps.center}>Ime još nije uneto</T>}
      <Grad place={who.place} center />
    </View>
    <TriBroja cells={mojiBrojevi(stats, reputation)} testID="var-tri-broja" />
    <ProfilGrupe stats={stats} email={who.email} />
  </ProfilScreen>;
}

export function JavniA({ profile, trust }: { profile: JavniProfilProjekcija; trust: PublicWorkTrust | null }) {
  const facts = profile.poverenje;
  return <JavniOkvir profile={profile}>
    <View style={s.identity}>
      <Lice initials={inicijali(profile.ime)} size={72} edge />
      {profile.naslov ? <T variant="heading" style={[ps.ink, ps.center]}>{profile.naslov}</T> : null}
      <Grad place={profile.grad} center />
    </View>
    <TriBroja cells={javniBrojevi(facts, trust)} testID="var-tri-broja" />
    <OMeni text={profile.biografija} />
    <Potvrde items={potvrde(facts, trust)} />
  </JavniOkvir>;
}

const s = StyleSheet.create({
  identity: { alignItems: 'center', gap: sys.space.sm },
  faceBox: { alignSelf: 'center' },
  badge: { position: 'absolute', right: -sys.space.xs, bottom: -sys.space.xs, width: BADGE, height: BADGE, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.surface, borderWidth: ruleWidth, borderColor: sys.color.cardLine, alignItems: 'center', justifyContent: 'center' },
});
