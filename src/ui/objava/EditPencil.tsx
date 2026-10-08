import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { chrome } from '../system/ScreenChrome';
import { useLayoutClass } from '../system/textScale';
import { sys } from '../system/tokens';

/**
 * The pencil of a part of the publish review: what a screen reader calls it ("Izmeni, Naslov"), the word beside the drawing ("Izmeni",
 * or "Dodaj" where the part is still empty) and what it opens. It is a command of the owner and not the screen's one action, so
 * it is ink and a line drawing, never green (the one green of the review is "Objavi zadatak"), and it is a touch of 48 dp at any text size.
 */
export type PartPencil = { label: string; word?: string; onPress: () => void };

/**
 * A pencil at the end of the line it changes. At a large text size or in a narrow window the word goes and the drawing stays, so the
 * words of the part keep their room (the pencil is still named for a screen reader). `pill` is the pencil over a photograph: the same
 * drawing and word on a white capsule that holds its edge over any picture.
 */
export function EditPencil({ pencil, pill = false }: { pencil: PartPencil; pill?: boolean }) {
  const { stacked } = useLayoutClass();
  return <Press accessibilityRole="button" accessibilityLabel={pencil.label} onPress={pencil.onPress} haptic="select"
    scaleTo={sys.motion.scale.button} style={pill ? s.pill : stacked ? s.pencilBare : s.pencil}>
    <Glyph name="edit" size={20} />
    {stacked ? null : <T variant="copy" style={s.word}>{pencil.word ?? 'Izmeni'}</T>}
  </Press>;
}

/** A photograph with the pencil of its part laid over its top right corner. */
export function PencilOverPhoto({ pencil, children }: { pencil?: PartPencil; children: ReactNode }) {
  return <View>
    {children}
    {pencil ? <View style={s.over} pointerEvents="box-none"><EditPencil pencil={pencil} pill /></View> : null}
  </View>;
}

const s = StyleSheet.create({
  pencil: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sys.space.xs, minWidth: layout.touch,
    minHeight: layout.touch, paddingLeft: sys.space.sm },
  // Only the drawing is left (large text, narrow window): nothing to keep apart from the words, so it stands in the middle of its touch.
  pencilBare: { alignItems: 'center', justifyContent: 'center', minWidth: layout.touch, minHeight: layout.touch },
  word: { fontWeight: '600' },
  // The capsule is the chrome's own 44 inside its touch (the press adds the reach to 48 and beyond).
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sys.space.xs, minWidth: chrome.circle,
    minHeight: chrome.circle, paddingHorizontal: sys.space.md, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface,
    borderWidth: 1, borderColor: sys.color.line },
  over: { position: 'absolute', top: sys.space.sm, right: sys.space.sm },
});
