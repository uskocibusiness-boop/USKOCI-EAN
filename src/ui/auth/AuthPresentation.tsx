import { StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '../entry/BrandAssets';
import { authTheme as c } from './authTheme';
import { radius, type } from '../../theme/tokens';

/** V5 premium auth presentation; route supplies real owned Auth state. */
export function AuthIntro({ title, copy, composition = 'hero' }: {
  title: string;
  /** The quiet line under the title. Left out, the title stands alone and the next thing on the screen follows closely. */
  copy?: string; composition?: 'hero' | 'stage';
}) {
  const stage = composition === 'stage';
  return <View>
    {stage ? <>
    <View style={styles.badge} accessible={false} importantForAccessibility="no-hide-descendants">
      <BrandMark size={35} />
    </View>
    </> : <View style={styles.identityRow}><BrandMark size={30} /></View>}
    <View style={stage ? styles.stage : copy ? styles.hero : styles.heroAlone}>
      <Text accessibilityRole="header" style={[styles.title, stage && styles.stageTitle, !copy && styles.titleAlone]}>{title}</Text>
      {copy ? <Text style={[styles.copy, stage && styles.stageCopy]}>{copy}</Text> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, minHeight: 36 },
  hero: { paddingTop: 4, paddingBottom: 20 },
  heroAlone: { paddingTop: 4, paddingBottom: 16 },
  titleAlone: { marginBottom: 0 },
  stage: { marginTop: 4, paddingTop: 2, paddingBottom: 4, marginBottom: 16 },
  stageTitle: { ...type.pageTitle, marginBottom: 10 },
  stageCopy: { ...type.copy, color: c.muted, marginBottom: 8 },
  badge: { width: 58, height: 58, borderRadius: radius.cardCompact, backgroundColor: c.sheet,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { ...type.hero, color: c.ink, marginBottom: 9 },
  copy: { ...type.copy, color: c.muted },
});

/** Forms stay open and readable against the sheet, including larger text. */
export const authStageForm = StyleSheet.create({
  form: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0,
    borderBottomWidth: 1, borderColor: c.divider, paddingHorizontal: 0, paddingTop: 5,
    paddingBottom: 17, marginTop: 0, marginBottom: 17 },
}).form;
