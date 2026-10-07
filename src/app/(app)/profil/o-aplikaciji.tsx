import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { BuildIdentity } from '../../../ui/BuildIdentity';
import { BrandLockup } from '../../../ui/entry/BrandAssets';
import { HomeLaunchArt } from '../../../ui/home/HomeLaunchArt';
import { useLayoutClass } from '../../../ui/system/textScale';
import { sys } from '../../../ui/system/tokens';
import { SettingsText as T, SettingsScreen, SettingsGroup, SettingsRow } from '../../../ui/settings/SettingsPresentation';

/**
 * What USKOČI is, the two ways into its rules, and the build detail support may ask for. The bar already names the
 * screen, so the brand is the mark itself (its own label says "USKOČI") and not a second 28 px title; the prose sits on
 * the page without a card, and the rules are rows like every other way onward in settings. No primary action.
 */
export default function AboutUskoci() {
  const { stacked } = useLayoutClass();
  const [brandWidth, setBrandWidth] = useState(232);
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [token, setToken] = useState<object | null>(null);
  useFocusEffect(useCallback(() => { const token = {}; focus.current = token; navigating.current = false;
    setToken(token);
    return () => { if (focus.current === token) focus.current = null; };
  }, []));
  const navigate = (action: () => void) => { if (!token || focus.current !== token || navigating.current) return;
    navigating.current = true; action(); };
  return <SettingsScreen title="O aplikaciji" onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/profil'))}>
    <View style={s.brand}>
      {/* One focus stop, spoken as the screen's heading "USKOČI": a header role on a plain View is not read at all. */}
      <View accessible accessibilityRole="header" accessibilityLabel="USKOČI" style={{ width: '100%', alignItems: 'center' }}
        onLayout={event => { const available = event.nativeEvent.layout.width; if (available > 0) setBrandWidth(Math.min(232, available)); }}>
        <BrandLockup width={brandWidth} />
      </View>
      <T variant="copy" tone="muted" style={s.tagline}>Pomoć počinje dogovorom.</T>
    </View>
    <View style={s.section}>
      <T variant="heading" accessibilityRole="header">Jedan nalog, obe mogućnosti</T>
      <View style={[s.path, stacked && s.pathStacked]}>
        <HomeLaunchArt kind="publish" compact />
        <View style={[s.pathCopy, stacked && s.pathCopyStacked]}>
          <T variant="bodyStrong" accessibilityRole="header">Objavi zadatak</T>
          <T variant="copy">Reci šta ti treba. Izaberi ko će pomoći.</T>
        </View>
      </View>
      <View style={[s.path, stacked && s.pathStacked]}>
        <HomeLaunchArt kind="discover" compact />
        <View style={[s.pathCopy, stacked && s.pathCopyStacked]}>
          <T variant="bodyStrong" accessibilityRole="header">Uskoči i zaradi</T>
          <T variant="copy">Pronađi zadatak za svoje veštine.</T>
        </View>
      </View>
      <T variant="note" tone="muted">AI pomaže da sastaviš zadatak. Ti pregledaš i potvrđuješ.</T>
    </View>
    <SettingsGroup title="Pravila i privatnost">
      <SettingsRow compact label="Pravila i saglasnosti" detail="Pravni dokumenti i obrada podataka."
        onPress={() => navigate(() => router.push('/profil/pravna'))} />
      <SettingsRow compact last label="Privatnost i podaci" detail="Šta je javno, rokovi čuvanja, zatvaranje naloga."
        onPress={() => navigate(() => router.push('/profil/privatnost'))} />
    </SettingsGroup>
    <BuildIdentity />
  </SettingsScreen>;
}

const s = StyleSheet.create({
  brand: { paddingTop: 16, paddingBottom: 12, gap: 16, alignItems: 'center' },
  tagline: { textAlign: 'center' },
  section: { gap: sys.space.base },
  path: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  pathStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  pathCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  pathCopyStacked: { flex: 0, alignSelf: 'stretch' },
});
