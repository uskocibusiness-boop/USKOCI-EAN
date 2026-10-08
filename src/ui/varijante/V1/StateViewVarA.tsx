import { StyleSheet, View } from 'react-native';
import { T } from '../../Text';
import { V2Action } from '../../v2/V2Action';
import { Arrive } from '../../system/Arrive';
import { BALANCED_LINES, balancedStyle } from '../../system/balanced';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import type { StateAction } from '../../system/StateView';
import { brandAction, sys } from '../../system/tokens';

/**
 * Variant A of the state family, "Predmet vrata" (V1, creative direction 2026-10-08, B6 "Pozornica koja se rimuje"): a LOCAL copy of
 * `StateView` for the lab, with the one change the variant is about. The picture of a FIRST encounter is 144 (the size of a door of
 * Početna, and the SAME object as the door or the row that fulfils the state: the paper with the pin for Moji zadaci, the tag for
 * Moje prijave, the link for Dogovori, the two panels for Poruke, the bell for Obaveštenja, the map for Zadaci), so an empty screen
 * is a promise of the action. Filtered, done, error and offline keep 96, as today. Everything else is `StateView`: the column of
 * 280, the block about 38 % down, one green action and at most one quiet one, a failure grey and still.
 *
 * If the owner chooses A, the change to the primitive is one prop: `StateView` gains `hero?: boolean` (or `cause: 'first'`) that
 * draws the picture at 144; this file goes.
 */
export type StateVarProps = {
  kind?: 'empty' | 'error' | 'offline';
  art: FactArtKind;
  /** Why the list is empty: only `first` is the hero size. */
  cause?: 'first' | 'filtered' | 'done';
  title: string; body?: string; primary?: StateAction; quiet?: StateAction; testID?: string;
};

/** The first encounter: the door's own size (A). */
const HERO = 144;
/** Every other state: `StateView`'s own 96. */
const ART = 96;
/** The measure of the words, as `StateView` (T7: copy at most 280 wide). */
const MEASURE = 280;

export function StateViewVarA({ kind = 'empty', art, cause = 'first', title, body, primary, quiet, testID }: StateVarProps) {
  const trouble = kind !== 'empty';
  const size = !trouble && cause === 'first' ? HERO : ART;
  const picture = <FactArt kind={art} size={size} muted={trouble} />;
  return <View testID={testID} accessibilityLiveRegion="polite" style={s.frame}>
    <View style={s.above} />
    <View style={s.column}>
      <View style={s.art}>{trouble ? picture : <Arrive>{picture}</Arrive>}</View>
      <T variant="title" accessibilityRole={trouble ? 'alert' : 'header'} {...BALANCED_LINES} style={[s.title, balancedStyle]}>{title}</T>
      {body ? <T variant="copy" tone="muted" {...BALANCED_LINES} style={[s.copy, balancedStyle]}>{body}</T> : null}
      {primary || quiet ? <View style={s.actions}>
        {primary ? <V2Action label={primary.label} onPress={primary.onPress} style={brandAction} /> : null}
        {quiet ? <V2Action label={quiet.label} onPress={quiet.onPress} kind="quiet" /> : null}
      </View> : null}
    </View>
    <View style={s.below} />
  </View>;
}

const s = StyleSheet.create({
  frame: { flexGrow: 1, alignItems: 'center', paddingTop: sys.space.huge, paddingBottom: sys.space.xxl },
  above: { flex: 1 },
  below: { flex: 4 },
  column: { width: '100%', maxWidth: MEASURE, alignItems: 'center' },
  art: { marginBottom: sys.space.base },
  title: { textAlign: 'center', color: sys.color.ink },
  copy: { textAlign: 'center', marginTop: sys.space.sm },
  actions: { alignSelf: 'stretch', marginTop: sys.space.xl, gap: sys.space.sm },
});
