import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../entry/BrandAssets';
import { FactArt } from '../system/FactArt';
import { PrimaryButton, QuietButton } from './AuthControls';
import { authTheme as c } from './authTheme';
import { radius, type } from '../../theme/tokens';

/**
 * Owner decision 2026-10-07, design proposal N3: signing in to a banned, blocked or closed account gets its own clear
 * message, not the generic sign-in error, and it is one sentence with one way out. Only what is known is said: the provider
 * refused this account, and the ordinary functions of the app cannot be used. No reason, no duration and no address is named,
 * because none is known to the app. The sentence about writing to support is said only together with the button that does it
 * (`supportAction`), so a sentence never promises a way that is not on the screen.
 */
export const restrictedAccountCopy = {
  title: 'Pristup nalogu je ograničen',
  body: 'Trenutno ne možeš da koristiš obične funkcije aplikacije.',
  support: 'Ako misliš da je u pitanju greška, javi nam se.',
  supportAction: 'Piši podršci',
  supportFailed: 'Pošta se nije otvorila. Pokušaj ponovo.',
} as const;

/**
 * The picture, the heading and the fact, with no red and no alert tone, because nothing the person typed was wrong. It is
 * the text of `RestrictedAccountScreen`; the screen owns the exits.
 */
export function RestrictedAccountPanel({ withSupport = false }: { withSupport?: boolean }) {
  return <View testID="restricted-account-panel" style={styles.panel} accessibilityLiveRegion="polite">
    {/* A fact picture, not a control: the words beside it carry the meaning. */}
    <View style={styles.well} accessible={false} importantForAccessibility="no-hide-descendants">
      <FactArt kind="lock" size={48} />
    </View>
    <Text accessibilityRole="header" style={styles.title}>{restrictedAccountCopy.title}</Text>
    <Text style={styles.body}>{withSupport ? `${restrictedAccountCopy.body} ${restrictedAccountCopy.support}` : restrictedAccountCopy.body}</Text>
  </View>;
}

/**
 * A restricted account's own screen (N3): white, no sheet over a backdrop, no bottom bar, because there is nothing to open.
 * The picture and the sentence, then the exits. `onSupport` draws "Piši podršci" as the one green action and the exit becomes
 * the quiet one; without it the exit is the one green action and nothing else is promised. The screen that shows this owns
 * what the exit does (the sign-in screens go back to the sign-in form: the person is not signed in, so there is nothing to
 * sign out of).
 */
export function RestrictedAccountScreen({ exitLabel, onExit, busy = false, onSupport }: {
  exitLabel: string; onExit: () => void; busy?: boolean;
  /** Opens the way to write to support; a rejection is said calmly under the buttons. Left out, there is no such way. */
  onSupport?: () => void | Promise<unknown>;
}) {
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  const asking = useRef(false);
  const support = async () => {
    if (!onSupport || asking.current) return;
    asking.current = true; setFailed(false);
    try { await onSupport(); } catch { setFailed(true); } finally { asking.current = false; }
  };
  return <View testID="restricted-account-screen" accessibilityViewIsModal style={[styles.screen, { paddingTop: insets.top }]}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(28, insets.bottom + 16) }]}>
      <View style={styles.column}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.brand}><BrandMark size={30} /></View>
        {/* The sentence and the way out stand in the middle of what is left, as the design proposal draws them (N3), not at the top. */}
        <View style={styles.middle}>
          <RestrictedAccountPanel withSupport={!!onSupport} />
          {failed ? <Text accessibilityLiveRegion="polite" style={styles.failed}>{restrictedAccountCopy.supportFailed}</Text> : null}
          <View style={styles.actions}>
            {onSupport ? <>
              <PrimaryButton title={restrictedAccountCopy.supportAction} onPress={() => void support()} disabled={busy} />
              <QuietButton title={exitLabel} onPress={onExit} disabled={busy} />
            </> : <PrimaryButton title={exitLabel} onPress={onExit} busy={busy} />}
          </View>
        </View>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: c.surface },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 16, alignItems: 'center' },
  column: { width: '100%', maxWidth: 412, flexGrow: 1 },
  brand: { minHeight: 36, justifyContent: 'center', marginBottom: 12 },
  // Lifted a little above the true middle (the bottom padding), where the eye rests on a screen with nothing else on it.
  middle: { flexGrow: 1, justifyContent: 'center', gap: 14, paddingBottom: 64 },
  // White like the screen (owner: no pale large panels); only the small picture well is a neutral control surface.
  panel: { gap: 10, paddingTop: 4, paddingBottom: 6 },
  well: { width: 80, height: 80, borderRadius: radius.card, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center',
    marginBottom: 4 },
  title: { ...type.title, color: c.ink },
  body: { ...type.copy, color: c.ink },
  failed: { ...type.note, color: c.muted },
  actions: { gap: 4, marginTop: 10 },
});
