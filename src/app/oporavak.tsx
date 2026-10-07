import { AuthIntro, authStageForm } from '../ui/auth/AuthPresentation';
import { authTheme as c } from '../ui/auth/authTheme';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'expo-router';
import { passwordRecoveryIntent } from '../store/passwordRecoveryIntent';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';
import { usePasswordRecovery } from '../hooks/usePasswordRecovery';
import { useSesija } from '../store/sesija';
import { AuthField, PrimaryButton } from '../ui/auth/AuthControls';
import { RestrictedAccountScreen } from '../ui/auth/RestrictedAccountPanel';
import { BuildIdentity } from '../ui/BuildIdentity';
import { radius, space, type } from '../theme/tokens';

export default function PasswordRecoveryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSesija();
  const intent = useSyncExternalStore(passwordRecoveryIntent.subscribe, passwordRecoveryIntent.snapshot, passwordRecoveryIntent.serverSnapshot);
  const link = intent?.link ?? null;
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [validation, setValidation] = useState<string | null>(null);
  const recovery = usePasswordRecovery(link, intent?.id ?? null);
  const busy = recovery.state.status === 'saving';
  const back = () => {
    if (intent) passwordRecoveryIntent.clear(intent.id);
    router.replace(user ? '/' : { pathname: '/auth', params: { form: 'login' } });
  };

  useEffect(() => {
    setPassword(''); setConfirmation(''); setValidation(null);
  }, [intent?.id]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) back();
      return true;
    });
    return () => subscription.remove();
  }, [busy, router, user?.id]);

  useEffect(() => {
    if (recovery.state.status === 'success' || recovery.state.status === 'error') {
      setPassword(''); setConfirmation('');
    }
  }, [recovery.state.status]);

  async function save() {
    if (busy) return;
    if (password.length < 6) { setValidation('Lozinka mora imati najmanje 6 znakova.'); return; }
    if (password !== confirmation) { setValidation('Lozinke se ne poklapaju.'); return; }
    setValidation(null);
    await recovery.save(password);
  }

  const state = recovery.state;
  // Owner decision 2026-10-07, design proposal N3: the link of a restricted account is not "expired", and a new link would
  // change nothing, so none is offered. The screen is the restricted-account screen with its one way back, not a state under
  // the greeting of a form that can no longer be used.
  if (state.status === 'error' && state.error.code === 'RESTRICTED_ACCOUNT') {
    return <RestrictedAccountScreen exitLabel={user ? 'Nazad u aplikaciju' : 'Nazad na prijavu'} onExit={back} />;
  }
  return <View style={[styles.screen, { paddingTop: insets.top }]}>
    <StatusBar style="dark" />
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Nazad" disabled={busy} onPress={back} style={styles.back}>
        <ArrowLeft size={22} color={c.ink} />
      </Pressable>
      <Text style={styles.headerLabel}>Oporavak naloga</Text>
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(32, insets.bottom + 24) }]}>
        <View style={styles.column}>
          <AuthIntro composition="stage" title={state.status === 'success' ? 'Lozinka je promenjena.' : 'Postavi novu lozinku.'}
            copy={state.status === 'success' ? 'Isti nalog. Tvoji zadaci i Dogovori.' : 'Bezbedan povratak u isti USKOČI nalog.'} />
          <View accessibilityLiveRegion="polite" style={[styles.content, authStageForm]}>
            {state.status === 'verifying' ? <>
              <ActivityIndicator accessibilityLabel="Provera linka" color={c.muted} />
              <Text style={styles.copy}>Proveravamo link za oporavak…</Text>
            </> : null}
            {state.status === 'ready' || state.status === 'saving' ? <>
              <Text style={styles.copy}>Postavi novu lozinku za nalog:</Text>
              <Text selectable style={styles.email}>{state.identity.email}</Text>
              <AuthField label="Nova lozinka" value={password} onChangeText={value => { setPassword(value); setValidation(null); }}
                placeholder="Unesi novu lozinku" secure newPassword editable={!busy} />
              <AuthField label="Potvrdi novu lozinku" value={confirmation} onChangeText={value => { setConfirmation(value); setValidation(null); }}
                placeholder="Ponovi novu lozinku" secure newPassword editable={!busy} />
              <Text style={styles.note}>Ne menjaju se tvoji zadaci, prijave ni Dogovori. Posle promene prijavi se novom lozinkom.</Text>
              {validation || state.error ? <Text accessibilityRole="alert" style={styles.error}>{validation ?? state.error?.message}</Text> : null}
              <PrimaryButton title="Sačuvaj novu lozinku" onPress={() => void save()} busy={busy} />
            </> : null}
            {state.status === 'success' ? <>
              <Text style={styles.copy}>Možeš da nastaviš. Za ulazak koristiš novu lozinku.</Text>
              <PrimaryButton title="Prijavi se" onPress={back} />
            </> : null}
            {state.status === 'error' ? <>
              <Text accessibilityRole="alert" style={styles.error}>{state.error.message}</Text>
              {state.error.code === 'VERIFY_UNAVAILABLE' ? <PrimaryButton title="Pokušaj ponovo" onPress={recovery.retry} /> : null}
              {!user ? <PrimaryButton title="Zatraži novi link" onPress={() => router.replace({ pathname: '/auth', params: { form: 'recovery' } })} /> : null}
              <Pressable accessibilityRole="button" style={styles.link} onPress={back}>
                <Text style={styles.linkText}>{user ? 'Nazad u aplikaciju' : 'Nazad na prijavu'}</Text>
              </Pressable>
            </> : null}
          </View>
          <View style={styles.versionSurface}><BuildIdentity /></View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surface },
  flex: { flex: 1 },
  header: { width: '100%', maxWidth: 460, alignSelf: 'center', flexDirection: 'row', minHeight: 72, alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 12 },
  back: { width: 48, minHeight: 48, borderRadius: radius.control, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { ...type.title, flex: 1, color: c.ink, textAlign: 'left', fontWeight: '700' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, alignItems: 'center' },
  column: { width: '100%', maxWidth: 412 },
  content: { gap: space.base, backgroundColor: 'transparent', marginTop: 6 },
  copy: { ...type.copy, color: c.muted },
  email: { color: c.ink, ...type.bodyStrong, marginBottom: space.sm },
  note: { color: c.muted, ...type.meta },
  error: { color: c.error, ...type.body },
  link: { minHeight: 48, justifyContent: 'center' },
  linkText: { color: c.accentLight, ...type.action },
  versionSurface: { backgroundColor: c.cream, borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 4, marginTop: 16 },
});
