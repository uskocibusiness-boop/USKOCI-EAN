import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FactArt } from '../system/FactArt';
import { authTheme as c } from './authTheme';
import { radius, type } from '../../theme/tokens';

/** The two things a person can come to do; the entry's two halves choose one of them. */
export type AuthIntentName = 'REQUESTER' | 'WORKER';

/**
 * The choice made on the entry, kept on the sign-in screen as ONE sentence (design proposal N2, owner 2026-10-07): what the
 * person does, in the app's own words and without grammatical gender. The entry's names ("Objavi zadatak", "Uskoči i zaradi")
 * are the doors; this is what the person is doing once through one.
 */
export const authIntentSentence: Readonly<Record<AuthIntentName, string>> = { REQUESTER: 'Tražiš pomoć', WORKER: 'Uskačeš' };

export const otherAuthIntent = (intent: AuthIntentName): AuthIntentName => intent === 'REQUESTER' ? 'WORKER' : 'REQUESTER';

/** The sentence and its one command, "Promeni", which switches to the other of the two. One row, one touch target. */
export function AuthIntentLine({ intent, disabled = false, onChange }: {
  intent: AuthIntentName; disabled?: boolean; onChange: (next: AuthIntentName) => void;
}) {
  const next = otherAuthIntent(intent);
  return <Pressable testID="auth-intent" accessibilityRole="button" disabled={disabled}
    accessibilityLabel={`${authIntentSentence[intent]}. Promeni`} accessibilityHint={`Prebacuje na „${authIntentSentence[next]}“.`}
    accessibilityState={{ disabled }} onPress={() => onChange(next)}
    style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <FactArt kind={intent === 'REQUESTER' ? 'publish' : 'map'} size={24} />
    </View>
    <Text style={styles.sentence}>{authIntentSentence[intent]}</Text>
    <Text style={styles.change}>Promeni</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingLeft: 14, paddingRight: 6,
    borderRadius: radius.cardCompact, backgroundColor: c.soft },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.65 },
  sentence: { ...type.bodyStrong, flex: 1, minWidth: 0, color: c.ink },
  // The word is the command: a green label inside a 44 dp-high area, not a second button drawn beside the sentence.
  change: { ...type.tab, color: c.accentLight, minHeight: 44, paddingHorizontal: 12, textAlignVertical: 'center', lineHeight: 44 },
});
