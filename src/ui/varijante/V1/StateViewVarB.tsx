import { StyleSheet, View } from 'react-native';
import { T } from '../../Text';
import { V2Action } from '../../v2/V2Action';
import { FactArt } from '../../system/FactArt';
import { brandAction, sys } from '../../system/tokens';
import type { StateVarProps } from './StateViewVarA';

/**
 * Variant B of the state family, "Jedna rečenica" (V1, creative direction 2026-10-08, B5 "glas slova"): the SENTENCE is the
 * focus. The title stands in the `display` type (32/37) at weight 700, left-aligned at the screen's edge like a page, the object
 * is small (48) beside it, under them one sentence that teaches, then the one green action and at most one quiet one. Nothing is
 * centred: the eye reads top-left to bottom like text. A failure keeps the quiet `title` type and a grey picture: the big voice is
 * for what the person is about to start, never for trouble.
 *
 * The direction reserves `display` for moments; if B wins, that rule changes ("display and in empty states"). If the owner chooses
 * B, `StateView` gains `layout: 'page'` (left, display title, art 48 beside); this file goes.
 */
/** The object beside the sentence (B: "predmet 48 pored njega"). */
const ART_BESIDE = 48;

export function StateViewVarB({ kind = 'empty', art, title, body, primary, quiet, testID }: StateVarProps) {
  const trouble = kind !== 'empty';
  return <View testID={testID} accessibilityLiveRegion="polite" style={s.frame}>
    <View style={s.above} />
    <View style={s.page}>
      <View style={s.head}>
        {trouble
          ? <T variant="title" accessibilityRole="alert" style={s.quietTitle}>{title}</T>
          : <T variant="display" accessibilityRole="header" style={s.title}>{title}</T>}
        <View style={s.art}><FactArt kind={art} size={ART_BESIDE} muted={trouble} /></View>
      </View>
      {body ? <T variant="copy" tone="muted" style={s.copy}>{body}</T> : null}
      {primary || quiet ? <View style={s.actions}>
        {primary ? <V2Action label={primary.label} onPress={primary.onPress} style={brandAction} /> : null}
        {quiet ? <V2Action label={quiet.label} onPress={quiet.onPress} kind="quiet" /> : null}
      </View> : null}
    </View>
    <View style={s.below} />
  </View>;
}

const s = StyleSheet.create({
  frame: { flexGrow: 1, alignSelf: 'stretch', paddingTop: sys.space.huge, paddingBottom: sys.space.xxl },
  above: { flex: 1 },
  below: { flex: 3 },
  page: { alignSelf: 'stretch' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.base },
  title: { flex: 1, minWidth: 0, color: sys.color.ink, fontWeight: '700' },
  quietTitle: { flex: 1, minWidth: 0, color: sys.color.ink },
  art: { flexShrink: 0, paddingTop: sys.space.xs },
  copy: { marginTop: sys.space.md },
  actions: { alignSelf: 'stretch', marginTop: sys.space.xl, gap: sys.space.sm },
});
