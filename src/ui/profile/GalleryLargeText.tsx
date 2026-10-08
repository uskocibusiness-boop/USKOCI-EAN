import type { ReactNode } from 'react';
import { Platform, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { LARGE_LAYOUT, LayoutClassOverride } from '../system/textScale';
import { sys } from '../system/tokens';

/** The relative width of the frame at text scale 1.3: a 361 dp phone is 361 / 1.3 = 278 wide before the zoom. */
const TEXT_ZOOM = 1.3;
const ZOOM_FRAME = 278;

/**
 * For the internal galleries only (`dizajn-*`; UI/UX pass 2026-10-08, F6): a scene drawn at text scale 1.3. The layout class is the
 * window's and a gallery cannot change the system's font, so the components are TOLD "large" (`LayoutClassOverride`, which is what
 * `useLayoutClass` answers at 1.3), and in the web design lab, which has no text scale, the frame is also zoomed 1.3 times at the same
 * relative width, so the words are as large against the screen as they are at 1.3 on a 361 dp phone. On a phone the real setting is
 * the check: set the font to 1.3 and open any other scene. In a store build no gallery is reachable, and nothing in the app uses this.
 */
export function GalleryLargeText({ children }: { children: ReactNode }) {
  const { height } = useWindowDimensions();
  return <LayoutClassOverride.Provider value={LARGE_LAYOUT}>
    {Platform.OS === 'web'
      ? <View style={[{ width: ZOOM_FRAME, alignSelf: 'center', backgroundColor: sys.color.ground, overflow: 'hidden', height: height / TEXT_ZOOM, zoom: TEXT_ZOOM } as ViewStyle]}>{children}</View>
      : children}
  </LayoutClassOverride.Provider>;
}
