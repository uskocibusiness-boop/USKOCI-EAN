import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { Screen } from '../system/Screen';
import { sys } from '../system/tokens';
import { AccountHeader } from '../profile/AccountHeader';
import type { ProfileHubPath } from '../profile/ProfileHubPresentation';
import type { HubWords } from '../profile/hubStates';

/** Figma 2:144: compact account groups. Existing destinations and route admission stay intact. */
export function AccountSettings({ busy, version, words, open, onBack }: {
  busy: boolean; version?: string; words: HubWords;
  open: (path: ProfileHubPath) => void; onBack: () => void;
}) {
  // Owner, 26.11.2026: the app's 3D pictures in every menu, and a second line only where it says a fact (a version, a status, an answer).
  const row = (label: string, art: FactArtKind, path: ProfileHubPath, detail?: string) =>
    <AccountRow label={label} detail={detail} disabled={busy} art={art} onPress={() => open(path)} />;
  return <Screen kind="detail" background="wash" contentStyle={s.content}
    header={<AccountHeader title="Podešavanja" onBack={onBack} disabled={busy} />}>
    <AccountGroup title="Nalog">
      {row('Lični podaci', 'person', '/profil/podaci')}
      {row('Pristup nalogu', 'lock', '/profil/lozinka')}
    </AccountGroup>
    <AccountGroup title="Aplikacija">
      {row('AI razgovori', 'chat', '/ai-istorija')}
      {row('Obaveštenja', 'bell', '/profil/obavestenja')}
      {row('Privatnost i podaci', 'shield', '/profil/privatnost')}
    </AccountGroup>
    <AccountGroup title="Pomoć">
      {row('Kako radi', 'info', '/profil/kako-radi')}
      {row('Pomoć i podrška', 'support', '/podrska', words.support)}
      {row('Prijavite grešku', 'alert', '/profil/prijava-greske')}
      {row('Pravila i saglasnosti', 'document', '/profil/pravna', words.legal)}
      {row('O aplikaciji', 'tasks', '/profil/o-aplikaciji', version)}
    </AccountGroup>
  </Screen>;
}

function AccountGroup({ title, children }: { title: string; children: ReactNode }) {
  return <View style={s.group}>
    <T accessibilityRole="header" tone="muted" style={s.groupTitle}>{title}</T>
    <View style={s.panel}>{children}</View>
  </View>;
}

type SettingsIconTone = 'green' | 'info' | 'violet' | 'orange' | 'muted';
const iconSurface: Record<SettingsIconTone, string> = {
  green: sys.color.greenSoft, info: sys.color.infoSoft, violet: sys.color.violetSoft,
  orange: sys.color.orangeSoft, muted: sys.color.wash,
};

/** The whole row is one target; the leading symbol names its subject and the
 * trailing caret consistently tells the user that another screen opens. */
function AccountRow({ label, detail, art, disabled, onPress }: {
  label: string; detail?: string; art: FactArtKind; disabled: boolean; onPress: () => void;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={detail}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} haptic="select"
    scaleTo={sys.motion.scale.row} style={s.row}>
    <View style={s.iconWell}><FactArt kind={art} size={30} /></View>
    <View style={s.copy}>
      <T tone={disabled ? 'muted' : 'ink'} style={s.title}>{label}</T>
      {detail ? <T tone="muted" style={s.detail}>{detail}</T> : null}
    </View>
    <Glyph name="caret-right" size={16} tone="muted" />
  </Press>;
}

const s = StyleSheet.create({
  content: { gap: 20 },
  group: { gap: 4 },
  groupTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', paddingHorizontal: 4 },
  panel: { padding: 4, borderRadius: 24, backgroundColor: sys.color.surface },
  row: { padding: 12, minHeight: 48, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWell: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0, flexShrink: 1 },
  detail: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0 },
});
