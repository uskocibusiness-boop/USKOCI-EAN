import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LARGE_TEXT_SCALE, roundTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { useKeyboardOpen } from './useKeyboardOpen';

/** On a tablet the sheet is one narrow column, centred, the way every other screen is a column (`layout.maxWidth`). */
export const AUTH_SHEET_MAX_WIDTH = 520;

/**
 * The sheet the sign-in steps stand on, over the entry (which is the locked V4.9 composition and is only ever its `backdrop`).
 * Presentation only. AuthScreen retains the real command, recovery and Back guards.
 *
 * Its corners are the system's sheet corner (28, `sys.radius.sheet`; they were 32, a value no scale had), and it keeps one
 * height while it changes what it shows: tall (97 %) for the form, the keyboard and large text, and 76 % otherwise, so the
 * sheet's edge does not move when the person switches between the two ways in.
 */
export function AuthSheet({ visible, expanded, backdrop, children }: {
  visible: boolean; expanded: boolean; backdrop: ReactNode; children: ReactNode;
}) {
  const { height, fontScale } = useWindowDimensions();
  const keyboard = useKeyboardOpen();
  const tall = keyboard || expanded || roundTextScale(fontScale) >= LARGE_TEXT_SCALE || height < 700;
  return <View style={s.root}>
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'none' : 'auto'}
      accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
      {backdrop}
    </View>
    {visible ? <View style={s.overlay} accessibilityViewIsModal>
      <View testID="auth-reference-sheet" style={[s.sheet, { maxHeight: tall ? '97%' : '76%' }]}>
        {children}
      </View>
    </View> : null}
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: sys.color.surface },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: sys.color.scrim, justifyContent: 'flex-end', paddingTop: sys.space.base },
  sheet: { flex: 1, width: '100%', maxWidth: AUTH_SHEET_MAX_WIDTH, alignSelf: 'center', overflow: 'hidden',
    borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet, borderWidth: 1, borderBottomWidth: 0,
    borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
});
