import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { SettingsGroup, SettingsRow, SettingsText as T } from '../settings/SettingsPresentation';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { sys } from '../system/tokens';

/** The photo at the size of the profile's own portrait (the hub draws the same 96). */
export const EDIT_PHOTO = 96;

/**
 * The parts of "Izmeni profil" that sit around the name (T4a, 2026-10-07). The pencil on the profile used to open only the name;
 * it now opens a screen that says what the profile is made of: the photo, the name, "O meni", the city and what other people can
 * see. Each part is only what the app already holds and can already save:
 * - the photo opens the photo screen that already exists (nothing of it is rebuilt here);
 * - the name is the one form with the one green action;
 * - "O meni" is the text of the work profile (the only profile whose save carries a description); it is shown as written, never
 *   made up, and it opens the work profile, where it is written;
 * - the city is the work area's, shown as information, with a way to the screen where it changes;
 * - what is public and what is private is said in the words the privacy screen already uses.
 * Presentation only: the route reads, navigates and owns every guard.
 */

/** The longest stretch of "O meni" shown in a row; the whole text is on the work profile it opens. */
export const ABOUT_CLIP = 140;
export const clipText = (text: string, max = ABOUT_CLIP): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  const letters = Array.from(flat);
  return letters.length <= max ? flat : `${letters.slice(0, max).join('').trimEnd()}…`;
};

export type AboutView = { kind: 'loading' } | { kind: 'error' } | { kind: 'none' } | { kind: 'empty' } | { kind: 'text'; text: string };
export type CityView = { kind: 'loading' } | { kind: 'error' } | { kind: 'none' } | { kind: 'city'; city: string };

/** What the "O meni" row says under its name: the text as written, or the honest reason there is none, and where it is written. */
export function aboutDetail(view: AboutView): string {
  switch (view.kind) {
    case 'loading': return 'Učitavamo…';
    case 'error': return 'Opis trenutno nije dostupan. Piše se u radnom profilu.';
    case 'none': return 'Piše se u radnom profilu.';
    case 'empty': return 'Još nije napisano. Dodaj ga u radnom profilu.';
    case 'text': return clipText(view.text);
  }
}
/** What the "Grad" row says: the city of the work area, or why there is none. */
export function cityDetail(view: CityView): string {
  switch (view.kind) {
    case 'loading': return 'Učitavamo…';
    case 'error': return 'Grad trenutno nije dostupan.';
    case 'none': return 'Još nije podešen.';
    case 'city': return view.city;
  }
}

/** The words about visibility, the second one exactly as the privacy screen has it. */
export const VISIBLE_TO_OTHERS = 'Ime, fotografija, grad, „O meni“ i ocene vide druge osobe.';
export const SHARED_ONLY_BY_RULES = 'Tačna privatna lokacija i kontakt dele se samo kada pravila saradnje daju pristup.';

/** The photo, one control: the picture the way others see it, the camera mark on its edge, and under it what pressing does. */
export function ProfilePhotoBlock({ photo, ready, onOpen }: { photo: ReactNode; ready: boolean; onOpen: () => void }) {
  return <View style={s.photoBlock}>
    <Press accessibilityRole="button" accessibilityLabel="Promeni fotografiju" accessibilityHint="Otvara izbor fotografije profila."
      accessibilityState={{ disabled: !ready }} disabled={!ready} haptic="select" scaleTo={sys.motion.scale.button} onPress={onOpen} style={s.photoPress}>
      <View style={s.photoFrame}>
        {photo}
        {ready ? <View style={s.camera} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><Glyph name="camera" size={16} /></View> : null}
      </View>
      <T variant="bodyStrong" style={[s.photoWord, !ready && s.photoWordOff]}>Promeni fotografiju</T>
    </Press>
  </View>;
}

/** "O meni" and the city: two rows, each to the screen where it is written or changed. Neither is edited here. */
export function ProfileFactRows({ about, city, onAbout, onCity }: { about: AboutView; city: CityView; onAbout: () => void; onCity: () => void }) {
  return <SettingsGroup footer="Grad se menja u području rada.">
    <SettingsRow label="O meni" detail={aboutDetail(about)} onPress={onAbout} />
    <SettingsRow label="Grad" detail={cityDetail(city)} onPress={onCity} last />
  </SettingsGroup>;
}

/** What other people see and what stays private, in one calm block with the way to the whole of it. */
export function VisibilityNote({ onMore }: { onMore: () => void }) {
  return <View style={s.visibility}>
    <View style={s.visibilityRow}>
      <FactArt kind="eye" size={24} />
      <View style={s.visibilityCopy}>
        <T variant="bodyStrong">Javno i privatno</T>
        <T variant="note" tone="muted">{`${VISIBLE_TO_OTHERS} ${SHARED_ONLY_BY_RULES}`}</T>
      </View>
    </View>
    <SettingsRow compact label="Privatnost i podaci" detail="Šta je javno, rokovi čuvanja, zatvaranje naloga." onPress={onMore} last />
  </View>;
}

const s = StyleSheet.create({
  photoBlock: { alignItems: 'center' },
  photoPress: { alignItems: 'center', gap: sys.space.md, minHeight: sys.touch.min },
  photoFrame: { width: EDIT_PHOTO, height: EDIT_PHOTO },
  // The camera mark sits on the edge of the photo and leaves the face visible; it says "this changes the photo" without a second control.
  camera: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface,
    borderWidth: 1, borderColor: sys.color.cardLine, alignItems: 'center', justifyContent: 'center' },
  photoWord: { color: sys.color.green },
  photoWordOff: { color: sys.color.muted },
  visibility: { gap: sys.space.sm },
  visibilityRow: { flexDirection: 'row', gap: sys.space.md, alignItems: 'flex-start' },
  visibilityCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
});
