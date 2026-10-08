import type { ReactNode } from 'react';
import { Platform, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { LARGE_LAYOUT, LayoutClassOverride } from '../system/textScale';
import { sys } from '../system/tokens';

/** The width of the owner's phone, in dp: the frame of a zoomed scene is this divided by the zoom, so the words are as large against the screen as on the phone. */
const PHONE_WIDTH = 361;

/**
 * For the internal galleries only (`dizajn-*`; UI/UX pass 2026-10-08, F6): a scene drawn at a larger text scale. The default is 1.3, the
 * largest the app is checked at: the layout class is the window's and a gallery cannot change the system's font, so the components are TOLD
 * "large" (`LayoutClassOverride`, which is what `useLayoutClass` answers at 1.3), and in the web design lab, which has no text scale, the frame
 * is also zoomed 1.3 times at the same relative width, so the words are as large against the screen as they are at 1.3 on a 361 dp phone.
 *
 * `scale={1.15}` is the owner's own phone setting (8 Oct 2026: font 1.15, 361 dp): only the zoom is applied, because the layout class at 1.15 is
 * still the regular one. On a phone the real setting is the check: set the font and open any other scene. In a store build no gallery is
 * reachable, and nothing in the app uses this.
 */
export function GalleryLargeText({ children, scale = 1.3 }: { children: ReactNode; scale?: 1.15 | 1.3 }) {
  const { height } = useWindowDimensions();
  const zoomed = Platform.OS === 'web'
    ? <View style={[{ width: Math.round(PHONE_WIDTH / scale), alignSelf: 'center', backgroundColor: sys.color.ground, overflow: 'hidden', height: height / scale, zoom: scale } as ViewStyle]}>{children}</View>
    : children;
  return scale >= 1.3 ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{zoomed}</LayoutClassOverride.Provider> : <>{zoomed}</>;
}
