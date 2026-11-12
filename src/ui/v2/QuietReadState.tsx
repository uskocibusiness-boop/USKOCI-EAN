import { StyleSheet, View } from 'react-native';
import type { FactArtKind } from '../system/FactArt';
import { sys } from '../system/tokens';

/** A read has no result yet. Render calm skeleton placeholders while preserving accessibility and testID. */
export function QuietReadState({ title }: { title: string; body: string; art: FactArtKind }) {
  return <View testID="quiet-read-state" accessibilityLabel={title} accessibilityLiveRegion="polite" style={s.frame}>
    {[0, 1, 2].map(i => (
      <View key={i} style={s.card}>
        <View style={s.row}>
          <View style={s.titleBar} />
          <View style={s.badgeBar} />
        </View>
        <View style={s.metaBar} />
        <View style={s.subBar} />
      </View>
    ))}
  </View>;
}

const s = StyleSheet.create({
  frame: { flexGrow: 1, width: '100%', paddingVertical: sys.space.xs, gap: sys.space.sm },
  card: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.cardLine, padding: sys.space.base, gap: sys.space.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: sys.space.sm },
  titleBar: { width: '58%', height: 18, borderRadius: sys.radius.pill, backgroundColor: sys.color.wash },
  badgeBar: { width: 72, height: 22, borderRadius: sys.radius.pill, backgroundColor: sys.color.wash },
  metaBar: { width: '42%', height: 14, borderRadius: sys.radius.pill, backgroundColor: sys.color.wash },
  subBar: { width: '74%', height: 14, borderRadius: sys.radius.pill, backgroundColor: sys.color.wash },
});

