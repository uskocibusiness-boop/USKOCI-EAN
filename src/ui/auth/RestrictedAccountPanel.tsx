import { StyleSheet, Text, View } from 'react-native';
import { FactArt } from '../system/FactArt';
import { authTheme as c } from './authTheme';
import { radius, type } from '../../theme/tokens';

/** Where the restriction was met: an email or phone sign-in, a password-recovery link, or a session the provider ended. */
export type RestrictedAccountContext = 'SIGN_IN' | 'PHONE' | 'RECOVERY' | 'SESSION';

/**
 * Owner decision 2026-10-07: signing in to a banned, blocked or closed account gets its own clear message, not the generic
 * sign-in error. Only what is known is said: the provider refused this account as restricted. No reason, no duration and no
 * contact is named, because none is known to the app (there is no support entry on the signed-out screens). The second
 * sentence answers the one thing a person would try next, so a refused account is not retried in a loop.
 */
export const restrictedAccountCopy: { readonly title: string; readonly body: Readonly<Record<RestrictedAccountContext, string>> } = {
  title: 'Pristup nalogu je ograničen',
  body: {
    SIGN_IN: 'Prijava na ovaj nalog trenutno nije moguća. Ponovni pokušaj sa drugom lozinkom to neće promeniti.',
    PHONE: 'Prijava na ovaj nalog trenutno nije moguća. Novi kod to neće promeniti.',
    RECOVERY: 'Oporavak lozinke za ovaj nalog trenutno nije moguć. Novi link za oporavak to neće promeniti.',
    SESSION: 'Ovaj uređaj je odjavljen sa naloga jer je pristup nalogu ograničen. Prijava na ovaj nalog trenutno nije moguća.',
  },
};

/**
 * A calm state on the sign-in surfaces' own white sheet: a picture, a heading and the fact, with no red and no alert tone,
 * because nothing the person typed was wrong. Presentation only; the screen that shows it owns the one way back.
 */
export function RestrictedAccountPanel({ context }: { context: RestrictedAccountContext }) {
  return <View testID="restricted-account-panel" style={styles.panel} accessibilityLiveRegion="polite">
    {/* A fact picture, not a control: the words beside it carry the meaning. */}
    <View style={styles.well} accessible={false} importantForAccessibility="no-hide-descendants">
      <FactArt kind="lock" size={48} />
    </View>
    <Text accessibilityRole="header" style={styles.title}>{restrictedAccountCopy.title}</Text>
    <Text style={styles.body}>{restrictedAccountCopy.body[context]}</Text>
  </View>;
}

const styles = StyleSheet.create({
  // White like the sheet (owner: no pale large panels); only the small picture well is a neutral control surface.
  panel: { gap: 10, paddingTop: 4, paddingBottom: 6 },
  well: { width: 80, height: 80, borderRadius: radius.card, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center',
    marginBottom: 4 },
  title: { ...type.title, color: c.ink },
  body: { ...type.copy, color: c.ink },
});
