import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BuildIdentity } from '../BuildIdentity';
import { BrandLockup } from '../entry/BrandAssets';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { FactRow } from '../system/FactRow';
import { sys } from '../system/tokens';
import { SettingsGroup, SettingsRow, SettingsScreen } from './SettingsPresentation';

/** The widest the brand mark is drawn; on a narrower screen it takes the width there is. */
const BRAND_MAX = 232;

/**
 * What USKOČI is, the two ways into its rules, and the build detail support may ask for (UI/UX pass 2026-10-08, F6; composition
 * spec 4.15). The bar already names the screen, so the brand is the mark itself, centred (its own label says "USKOČI"), and one
 * sentence under it; then a section whose two facts are the two things one account can do, as `FactRow`s, and a section of rows that
 * lead on to the rules and to privacy, with the same picture the profile gives them. No primary action: nothing here is done.
 * Presentation only: the route owns the navigation.
 */
export function AboutView({ onBack, onRules, onPrivacy }: { onBack: () => void; onRules: () => void; onPrivacy: () => void }) {
  const [brandWidth, setBrandWidth] = useState(BRAND_MAX);
  return <SettingsScreen title="O aplikaciji" onBack={onBack}>
    <View style={s.brand}>
      {/* One focus stop, spoken as the screen's heading "USKOČI": a header role on a plain View is not read at all. */}
      <View accessible accessibilityRole="header" accessibilityLabel="USKOČI" style={s.lockup}
        onLayout={event => { const available = event.nativeEvent.layout.width; if (available > 0) setBrandWidth(Math.min(BRAND_MAX, available)); }}>
        <BrandLockup width={brandWidth} />
      </View>
      <T variant="copy" tone="muted" style={s.tagline}>Pomoć počinje dogovorom.</T>
    </View>
    <SettingsGroup title="Tražiš pomoć ili uskačeš — na istom nalogu">
      <View style={s.facts}>
        <FactRow size="detail" art="publish" value="Objavi zadatak" note="Reci šta ti treba. Izaberi ko će pomoći." />
        <FactRow size="detail" art="map" value="Uskoči i zaradi" note="Pronađi zadatak za svoje veštine." />
      </View>
      <T variant="note" tone="muted" style={s.ai}>AI pomaže da sastaviš zadatak. Ti pregledaš i potvrđuješ.</T>
    </SettingsGroup>
    <SettingsGroup title="Pravila i privatnost">
      <SettingsRow label="Pravila i saglasnosti" detail="Pravni dokumenti i obrada podataka." icon={<FactArt kind="document" size={32} />} onPress={onRules} />
      <SettingsRow label="Privatnost i podaci" detail="Šta je javno, rokovi čuvanja, zatvaranje naloga." icon={<FactArt kind="lock" size={32} />} last onPress={onPrivacy} />
    </SettingsGroup>
    <BuildIdentity />
  </SettingsScreen>;
}

const s = StyleSheet.create({
  brand: { alignItems: 'center', gap: sys.space.base, paddingTop: sys.space.base },
  lockup: { width: '100%', alignItems: 'center' },
  tagline: { textAlign: 'center' },
  facts: { gap: sys.space.base },
  ai: { paddingTop: sys.space.base },
});
