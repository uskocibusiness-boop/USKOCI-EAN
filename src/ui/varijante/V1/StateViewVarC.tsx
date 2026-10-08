import { StyleSheet, View } from 'react-native';
import { T } from '../../Text';
import { V2Action } from '../../v2/V2Action';
import { BALANCED_LINES, balancedStyle } from '../../system/balanced';
import { FactArt } from '../../system/FactArt';
import { brandAction, sys } from '../../system/tokens';
import { ArriveVar } from './ArriveVar';
import type { Kadar } from './kadar';
import type { StateVarProps } from './StateViewVarA';
import { UskokVar } from './UskokVar';

/**
 * Variant C of the state family, "Scena koja stiže" (V1, creative direction 2026-10-08, B6 + B1): the scene COMPOSES ITSELF in
 * front of the person. The object (120) settles in once through the art arrive (800 ms), the title and the sentence come in from
 * below (the side of the table that is yours, 240 ms), and the green action is on the screen from the FIRST frame, so nothing the
 * finger wants ever waits for a picture (the risk the direction names). The sentence under the title is written to the person
 * ("ti": what you do, what then happens), always with one green and one quiet way. A failure and no connection rest grey, 96,
 * without any of it: calm is the signature of trouble.
 *
 * If the owner chooses C, `StateView` gains `arrive: 'scene'` (object 120 + words from below, actions still); this file goes.
 * `kadar` (lab only) freezes the whole scene at `t` ms.
 */
/** The object of a scene that arrives (C: "predmet 120 kroz Arrive"). */
const HERO = 120;
/** Trouble rests at `StateView`'s own 96. */
const ART = 96;
const MEASURE = 280;

export function StateViewVarC({ kind = 'empty', art, title, body, primary, quiet, kadar = null, testID }: StateVarProps & { kadar?: Kadar }) {
  const trouble = kind !== 'empty';
  const words = <>
    <T variant="title" accessibilityRole={trouble ? 'alert' : 'header'} {...BALANCED_LINES} style={[s.title, balancedStyle]}>{title}</T>
    {body ? <T variant="copy" tone="muted" {...BALANCED_LINES} style={[s.copy, balancedStyle]}>{body}</T> : null}
  </>;
  return <View testID={testID} accessibilityLiveRegion="polite" style={s.frame}>
    <View style={s.above} />
    <View style={s.column}>
      <View style={s.art}>
        {trouble ? <FactArt kind={art} size={ART} muted /> : <ArriveVar kadar={kadar}><FactArt kind={art} size={HERO} /></ArriveVar>}
      </View>
      {trouble ? <View style={s.words}>{words}</View> : <UskokVar from="below" kadar={kadar} style={s.words}>{words}</UskokVar>}
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
  words: { alignSelf: 'stretch', alignItems: 'center' },
  title: { textAlign: 'center', color: sys.color.ink },
  copy: { textAlign: 'center', marginTop: sys.space.sm },
  actions: { alignSelf: 'stretch', marginTop: sys.space.xl, gap: sys.space.sm },
});
