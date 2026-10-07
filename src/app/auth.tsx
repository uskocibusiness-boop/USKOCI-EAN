import { AuthIntro, authStageForm } from '../ui/auth/AuthPresentation';
import { AuthSheet } from '../ui/auth/AuthSheet';
import { authTheme as authColors } from '../ui/auth/authTheme';
import { radius, type } from '../theme/tokens';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  EnvelopeSimple,
  LockKey,
  MapPin,
  Phone,
  User,
} from 'phosphor-react-native';

import { AuthField, PrimaryButton } from '../ui/auth/AuthControls';
import { RestrictedAccountPanel, type RestrictedAccountContext } from '../ui/auth/RestrictedAccountPanel';

import { authClientService } from '../data/authClientService';
import { isRestrictedAccountFailure } from '../data/authFailureClasses';
import { useAuthAvailability } from '../hooks/useAuthAvailability';
import { useAuthFormCommand } from '../hooks/useAuthFormCommand';
import { EntryWelcome, type EntryIntentSelection } from '../ui/entry/EntryWelcome';
import { entryIntentClientService } from '../data/entryIntentClientService';
import { potvrdiRazlogOdjave, sesijaSada, useSesija } from '../store/sesija';
import { useEntrySplashReady } from '../hooks/useEntrySplashReady';

type Rezim = 'LOGIN' | 'SIGNUP';
type Faza = 'EMAIL' | 'PHONE' | 'OTP' | 'RECOVERY' | 'SIGNUP_NEXT_STEP' | 'RECOVERY_SENT' | 'RESTRICTED';

/** Only ways in that work are drawn, so there is no unavailable state left to draw. */
function MethodButton({ title, icon, onPress, disabled }: {
  title: string;
  icon: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.method, pressed && !disabled && styles.methodPressed]}
    >
      <View style={styles.methodIcon} accessible={false} importantForAccessibility="no-hide-descendants">{icon}</View>
      <View style={styles.methodCopy}>
        <Text style={styles.methodText}>{title}</Text>
      </View>
    </Pressable>
  );
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ form?: string }>();
  const [, refreshEntryFocus] = useState(0);
  const entryScope = useRef({ focused: true, revision: 0, form: params.form });
  if (entryScope.current.form !== params.form) {
    entryScope.current.form = params.form;
    entryScope.current.revision++;
  }
  const entryRevision = entryScope.current.revision;
  useFocusEffect(useCallback(() => {
    entryScope.current.focused = true;
    refreshEntryFocus(value => value + 1);
    return () => { entryScope.current.focused = false; entryScope.current.revision++; };
  }, []));
  const [otvoren, setOtvoren] = useState(params.form === 'login' || params.form === 'recovery');
  const [entrySeen, setEntrySeen] = useState(!otvoren);
  useEffect(() => { if (!otvoren) setEntrySeen(true); }, [otvoren]);
  const { onLayout: onFormLayout } = useEntrySplashReady({ enabled: otvoren });
  const [rezim, setRezim] = useState<Rezim>('LOGIN');
  const [faza, setFaza] = useState<Faza>(params.form === 'recovery' ? 'RECOVERY' : 'EMAIL');
  // Presentation only: a choice becomes visible after its owned prepare succeeds.
  const [preparedIntent, setPreparedIntent] = useState<{ intent: 'REQUESTER' | 'WORKER'; accountRevision: number } | null>(null);
  const session = sesijaSada();
  const selectedIntent = !session.user && preparedIntent?.accountRevision === session.accountRevision ? preparedIntent.intent : null;
  const intentLabel = selectedIntent === 'REQUESTER' ? 'Objavi zadatak' : selectedIntent === 'WORKER' ? 'Uskoči i zaradi' : null;

  const [ime, setIme] = useState('');
  const [prezime, setPrezime] = useState('');
  const [grad, setGrad] = useState('');
  const [email, setEmail] = useState('');
  const [lozinka, setLozinka] = useState('');
  const [potvrda, setPotvrda] = useState('');
  const [telefon, setTelefon] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationRequired, setConfirmationRequired] = useState(true);

  const commands = useAuthFormCommand();
  const radi = commands.busy;
  // Gated on `otvoren` alone, this 10-second read only started once the sheet had finished opening,
  // after the 760ms doorway and after up to 5s of writing the chosen intent — so the worst case
  // between the tap and a field you could type in was about sixteen seconds of spinner. It now
  // starts the moment an intent is chosen, so it overlaps the doorway and the write instead of
  // queueing behind them. Someone who never touches the entry still causes no read.
  const availability = useAuthAvailability(otvoren || !!preparedIntent);
  const methods = availability.status === 'ready' ? availability.data : null;
  const [greska, setGreska] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<string | null>(null);
  // Owner decision 2026-10-07: a restricted account is its own state, not a line of red text under the form.
  const [ograniceno, setOgraniceno] = useState<RestrictedAccountContext>('SIGN_IN');
  const signOutReason = useSesija().signOutReason;

  // A session the provider ended because the account is restricted opens the sign-in sheet on that panel, once.
  useEffect(() => {
    if (signOutReason?.kind !== 'RESTRICTED_ACCOUNT') return;
    const shown = commands.changeForm(() => {
      setPreparedIntent(null); setRezim('LOGIN'); setOgraniceno('SESSION'); setFaza('RESTRICTED');
      setLozinka(''); setPotvrda(''); setOtp(''); setGreska(null); setPoruka(null);
      setOtvoren(true);
    });
    // While an Auth command runs the form cannot change; `radi` re-runs this once it has settled.
    if (shown) potvrdiRazlogOdjave(signOutReason.revision);
  }, [signOutReason?.kind, signOutReason?.revision, commands.changeForm, radi]);

  const handledRouteForm = useRef(params.form);
  useEffect(() => {
    if (handledRouteForm.current === params.form) return;
    handledRouteForm.current = params.form;
    if (params.form !== 'login' && params.form !== 'recovery') return;
    // Native query parameters may arrive after mount; warm links also reuse
    // this screen. Consume each change once, without interrupting an Auth write
    // or replaying the parameter over a form the person selected themselves.
    commands.changeForm(() => {
      setPreparedIntent(null);
      setRezim('LOGIN');
      setFaza(params.form === 'recovery' ? 'RECOVERY' : 'EMAIL');
      setLozinka(''); setPotvrda(''); setGreska(null); setPoruka(null);
      setOtvoren(true);
    });
  }, [params.form, commands.changeForm]);

  useEffect(() => {
    if (!otvoren) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      commands.changeForm(() => {
        if (faza !== 'EMAIL' || rezim !== 'LOGIN') { setFaza('EMAIL'); setRezim('LOGIN'); }
        else setOtvoren(false);
        setGreska(null); setPoruka(null);
      });
      return true;
    });
    return () => subscription.remove();
  }, [commands.changeForm, otvoren, faza, rezim]);

  function otvori(mode: Rezim = 'LOGIN') {
    commands.changeForm(() => {
      setPreparedIntent(null);
      setRezim(mode);
      setFaza('EMAIL');
      setGreska(null);
      setPoruka(null);
      setOtvoren(true);
    });
  }

  function nazadNaEmail() {
    commands.changeForm(() => {
      setRezim('LOGIN');
      setFaza('EMAIL');
      setGreska(null);
      setPoruka(null);
    });
  }

  function prijaviGresku(error: unknown) {
    if (isRestrictedAccountFailure(error)) {
      // Nothing typed was wrong, and typing it again changes nothing: the secrets are cleared, the email stays.
      setOgraniceno(faza === 'PHONE' || faza === 'OTP' ? 'PHONE' : faza === 'RECOVERY' ? 'RECOVERY' : 'SIGN_IN');
      setLozinka(''); setPotvrda(''); setOtp(''); setGreska(null); setPoruka(null);
      setFaza('RESTRICTED');
      return;
    }
    setGreska(error instanceof Error ? error.message : 'Zahtev trenutno nije uspeo. Pokušaj ponovo.');
  }

  async function izaberiNameru(intent: 'REQUESTER' | 'WORKER', selection?: EntryIntentSelection) {
    const current = () => entryScope.current.focused && entryScope.current.revision === entryRevision &&
      (selection?.isCurrent() ?? true);
    if (!current()) return;
    await commands.run(() => entryIntentClientService.prepare(intent, current), () => {
      if (!current()) return;
      setPreparedIntent({ intent, accountRevision: sesijaSada().accountRevision });
      setRezim('LOGIN'); setFaza('EMAIL'); setGreska(null); setPoruka(null); setOtvoren(true);
    }, () => { if (current()) setGreska('Izbor nije sačuvan. Pokušaj ponovo.'); });
  }

  async function emailAkcija() {
    const ready = availability.current();
    if (!ready || !(rezim === 'SIGNUP' ? ready.emailSignup : ready.emailPassword)) return;
    await commands.run(async () => {
      setGreska(null);
      setPoruka(null);
      if (!email.trim() || !lozinka) throw new Error('Unesi email i lozinku.');
      if (rezim === 'LOGIN') {
        await authClientService.signInWithPassword({ email: email.trim(), password: lozinka });
        return true;
      }
      if (!ime.trim() || !prezime.trim() || !grad.trim()) throw new Error('Unesi ime, prezime i grad.');
      if (lozinka.length < 6) throw new Error('Lozinka mora imati najmanje 6 znakova.');
      if (lozinka !== potvrda) throw new Error('Lozinke se ne poklapaju.');
      const result = await authClientService.signUp({
        email: email.trim(), password: lozinka,
        firstName: ime.trim(), lastName: prezime.trim(), city: grad.trim(),
      });
      return result.hasSession;
    }, hasSession => {
      if (!hasSession) {
        setLozinka('');
        setPotvrda('');
        setConfirmationRequired(ready.emailConfirmationRequired);
        setFaza('SIGNUP_NEXT_STEP');
      }
    }, prijaviGresku);
  }

  async function ponoviPotvrduEmaila() {
    if (!confirmationRequired || !email.trim()) return;
    await commands.run(async () => {
      setGreska(null); setPoruka(null);
      await authClientService.resendSignupConfirmation(email.trim());
    }, () => setPoruka('Zahtev za novu potvrdu je prihvaćen. Proveri email i neželjenu poštu.'), prijaviGresku);
  }

  async function posaljiTelefon() {
    if (!availability.current()?.phoneOtp) return;
    await commands.run(async () => {
      setGreska(null);
      setPoruka(null);
      await authClientService.sendPhoneOtp({ phone: telefon.trim() });
    }, () => {
      setFaza('OTP');
      setPoruka('Zahtev za kod je prihvaćen.');
    }, prijaviGresku);
  }

  async function potvrdiOtp() {
    if (!availability.current()?.phoneOtp) return;
    await commands.run(async () => {
      setGreska(null);
      await authClientService.verifyPhoneOtp({ phone: telefon.trim(), token: otp.trim() });
    }, () => {}, prijaviGresku);
  }

  async function zatraziOporavak() {
    if (!availability.current()?.passwordRecovery) return;
    await commands.run(async () => {
      setGreska(null); setPoruka(null);
      await authClientService.requestPasswordRecovery(email);
    }, () => {
      setLozinka(''); setPotvrda(''); setFaza('RECOVERY_SENT');
    }, prijaviGresku);
  }

  const naslov =
    faza === 'PHONE'
      ? rezim === 'SIGNUP' ? 'Napravi nalog telefonom' : 'Prijavi se telefonom'
      : faza === 'OTP'
        ? 'Unesi kod'
        : faza === 'RECOVERY'
          ? 'Vrati pristup nalogu.'
          : faza === 'RECOVERY_SENT' ? 'Proveri email'
          : faza === 'SIGNUP_NEXT_STEP'
            ? confirmationRequired ? 'Proveri email' : 'Nastavi prijavu'
            : rezim === 'SIGNUP'
              ? 'Napravi nalog'
              : 'Prijavi se emailom';

  const podnaslov =
    faza === 'PHONE'
      ? 'Unesi broj telefona.'
      : faza === 'OTP'
        ? 'Unesi kod kada stigne na tvoj broj.'
        : faza === 'RECOVERY'
          ? methods?.passwordRecovery ? 'Unesi email koji koristiš za USKOČI.' : 'Ova mogućnost još nije dostupna u aplikaciji.'
          : faza === 'RECOVERY_SENT' ? 'Zahtev za oporavak je prihvaćen.'
          : faza === 'SIGNUP_NEXT_STEP'
            ? confirmationRequired ? 'Prati uputstvo za potvrdu registracije.' : 'Vrati se na prijavu.'
            : rezim === 'SIGNUP'
              ? 'Unesi osnovne podatke za nalog.'
              : 'Unesi email i lozinku.';

  const recoveryStage = faza === 'RECOVERY' || faza === 'RECOVERY_SENT';
  const stageComposition = recoveryStage || (rezim === 'SIGNUP' && (faza === 'EMAIL' || faza === 'SIGNUP_NEXT_STEP'));
  const formStyle = [styles.form, stageComposition && authStageForm];

  return (
    <><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <AuthSheet visible={otvoren} expanded={rezim === 'SIGNUP'} backdrop={entrySeen ? <EntryWelcome
      onRequester={selection => izaberiNameru('REQUESTER', selection)} onWorker={selection => izaberiNameru('WORKER', selection)}
      onSignIn={() => otvori('LOGIN')} onSignUp={() => otvori('SIGNUP')} busy={radi || otvoren} error={otvoren ? null : greska} /> : null}>
    <View onLayout={onFormLayout} style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Nazad" disabled={radi}
          onPress={() => commands.changeForm(() => {
            if (faza !== 'EMAIL' || rezim !== 'LOGIN') { setFaza('EMAIL'); setRezim('LOGIN'); }
            else setOtvoren(false);
            setGreska(null); setPoruka(null);
          })} style={({ pressed }) => [styles.backButton, pressed && styles.methodPressed]}><ArrowLeft size={22} color={authColors.ink} /></Pressable>
        <View style={styles.headerTitles}>
          {faza === 'EMAIL' && rezim === 'LOGIN' && intentLabel ? <Text style={styles.headerEyeline}>{intentLabel}</Text> : null}
          <Text style={styles.headerTitle}>{recoveryStage ? 'Oporavak pristupa' : rezim === 'SIGNUP' ? 'Registracija' : 'Prijava'}</Text>
        </View>
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView key={`${rezim}:${faza}`} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.sheetScroll, { paddingBottom: Math.max(28, insets.bottom + 16) }]}>
          <View style={styles.formColumn}>
            {faza === 'RESTRICTED' ? (
              // The panel is the whole answer: no greeting above it and no form under it, one way back.
              <View style={styles.form}>
                <RestrictedAccountPanel context={ograniceno} />
                <PrimaryButton title="Nazad na prijavu" onPress={nazadNaEmail} busy={radi} />
              </View>
            ) : <AuthIntro composition={stageComposition ? 'stage' : 'hero'} title={faza === 'EMAIL' && rezim === 'LOGIN' ? 'Zdravo.' : naslov}
              copy={faza === 'EMAIL' && rezim === 'LOGIN' ? selectedIntent === 'WORKER' ? 'Nastavi do Prijava, Zadataka i Dogovora.' : 'Nastavi do svojih Zadataka i Dogovora.' : podnaslov}
              eyebrow={faza === 'RECOVERY' || faza === 'RECOVERY_SENT' ? 'BEZBEDAN POVRATAK' : faza === 'EMAIL' && rezim === 'LOGIN' && intentLabel ? `${intentLabel.toUpperCase()} · ISTI NALOG` : undefined} />}
            {poruka ? <View style={[styles.banner, styles.bannerOk]}><Text style={styles.bannerOkText}>{poruka}</Text></View> : null}

            {faza === 'RESTRICTED' ? null : availability.status === 'loading' ? (
              <View accessibilityRole="progressbar" style={formStyle}>
                <ActivityIndicator color={authColors.muted} />
                <Text style={styles.stateCopy}>Proveravamo dostupne načine prijave…</Text>
              </View>
            ) : availability.status === 'error' ? (
              <View style={formStyle}>
                <Text style={styles.stateCopy}>Ne možemo da proverimo dostupne načine prijave. Proveri vezu i pokušaj ponovo.</Text>
                <PrimaryButton title="Pokušaj ponovo" busy={radi} onPress={() => void availability.retry()} />
              </View>
            ) : null}

            {faza === 'EMAIL' && methods ? (
              <>
                {methods.emailPassword ? <View style={formStyle}>
                  {rezim === 'SIGNUP' && methods.emailSignup ? (
                    <>
                      <AuthField
                        label="Ime"
                        value={ime}
                        onChangeText={(value) => commands.changeForm(() => setIme(value))}
                        editable={!radi}
                        autoCapitalize="words"
                        placeholder="Ime"
                        icon={<User size={21} color={authColors.muted} />}
                      />
                      <AuthField
                        label="Prezime"
                        value={prezime}
                        onChangeText={(value) => commands.changeForm(() => setPrezime(value))}
                        editable={!radi}
                        autoCapitalize="words"
                        placeholder="Prezime"
                        icon={<User size={21} color={authColors.muted} />}
                      />
                      <AuthField
                        label="Grad"
                        value={grad}
                        onChangeText={(value) => commands.changeForm(() => setGrad(value))}
                        editable={!radi}
                        autoCapitalize="words"
                        placeholder="Tvoj grad"
                        icon={<MapPin size={21} color={authColors.muted} />}
                      />
                    </>
                  ) : null}

                  <AuthField
                    label="Email"
                    value={email}
                    onChangeText={(value) => commands.changeForm(() => setEmail(value))}
                    editable={!radi}
                    keyboardType="email-address"
                    placeholder="ime@primer.rs"
                    icon={<EnvelopeSimple size={21} color={authColors.muted} />}
                  />
                  <AuthField
                    key={`password:${rezim}`}
                    label="Lozinka"
                    value={lozinka}
                    onChangeText={(value) => commands.changeForm(() => setLozinka(value))}
                    editable={!radi}
                    placeholder="Unesi lozinku"
                    secure
                    icon={<LockKey size={21} color={authColors.muted} />}
                  />

                  {rezim === 'SIGNUP' && methods.emailSignup ? (
                    <>
                      <AuthField
                        label="Potvrdi lozinku"
                        value={potvrda}
                        onChangeText={(value) => commands.changeForm(() => setPotvrda(value))}
                        editable={!radi}
                        placeholder="Ponovi lozinku"
                        secure
                        icon={<LockKey size={21} color={authColors.muted} />}
                      />
                      {/* Deep read 8.2, owner decision 2026-09-21: the tick asked to accept two documents that
                          are not published yet and recorded nothing. While testing, the screen says so
                          instead; the recorded acceptance (profil/pravna) takes over once they are published. */}
                      <View style={styles.consent}>
                        <Text style={styles.consentText}>
                          Ovo je test verzija. Uslovi korišćenja i Politika privatnosti biće objavljeni pre javnog pokretanja.
                        </Text>
                      </View>
                    </>
                  ) : null}

                  <View style={styles.feedback} accessibilityLiveRegion="polite">
                    {greska ? <Text accessibilityRole="alert" style={styles.bannerErrorText}>{greska}</Text> : null}
                  </View>

                  {rezim === 'LOGIN' ? (
                    <Pressable accessibilityRole="button" disabled={radi} onPress={() => commands.changeForm(() => { setFaza('RECOVERY'); setLozinka(''); setPotvrda(''); setGreska(null); setPoruka(null); })} style={styles.forgot}>
                      <Text style={styles.forgotText}>Zaboravljena lozinka?</Text>
                    </Pressable>
                  ) : null}
                </View> : <Text style={styles.stateCopy}>Prijava emailom trenutno nije dostupna.</Text>}



                {methods.emailPassword && !methods.emailSignup ? (
                  <Text style={styles.smallNote}>Otvaranje novih naloga trenutno nije dostupno.</Text>
                ) : null}
                {rezim === 'SIGNUP' && !methods.emailSignup ? (
                  <PrimaryButton title="Nazad na prijavu" onPress={nazadNaEmail} busy={radi} />
                ) : null}
                {rezim === 'SIGNUP' && methods.emailSignup && methods.emailConfirmationRequired ? (
                  <Text style={styles.smallNote}>Pre prve prijave potrebno je da potvrdiš email.</Text>
                ) : null}
                {/* Owner decision, 2026-09-18: a way in that does not work is not shown. Google and
                    Apple wait on an OAuth client that server settings alone cannot make ready, and
                    Telefon appears only when the server says it is on. Three dead buttons under
                    "Drugi načini prijave" read as an app that is broken, not one that is early. */}
                {methods.phoneOtp ? (
                  <View style={styles.methods}>
                    <Text style={styles.methodHeading}>Drugi načini prijave</Text>
                    <MethodButton
                      title="Telefon"
                      icon={<Phone size={23} color={authColors.methodIcon} />}
                      disabled={radi}
                      onPress={() => commands.changeForm(() => { setFaza('PHONE'); setGreska(null); setPoruka(null); })}
                    />
                  </View>
                ) : (
                  <Text style={styles.smallNote}>Za sada se ulazi email adresom i lozinkom.</Text>
                )}


              </>
            ) : null}

            {faza === 'PHONE' && methods?.phoneOtp ? (
              <View style={formStyle}>
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: radi }} disabled={radi} onPress={nazadNaEmail} style={styles.backRow}>
                  <ArrowLeft size={16} color={authColors.muted} />
                  <Text style={styles.backText}>Nazad na prijavu</Text>
                </Pressable>
                <AuthField
                  label="Broj telefona"
                  value={telefon}
                  onChangeText={(value) => commands.changeForm(() => setTelefon(value))}
                  editable={!radi}
                  keyboardType="phone-pad"
                  placeholder="+381 6x xxx xxxx"
                  icon={<Phone size={21} color={authColors.muted} />}
                />
                <Text style={styles.smallNote}>Poslaćemo ti jednokratni kod.</Text>
                <PrimaryButton title="Pošalji kod" onPress={() => void posaljiTelefon()} busy={radi} />
              </View>
            ) : null}

            {faza === 'OTP' && methods?.phoneOtp ? (
              <View style={formStyle}>
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: radi }} disabled={radi} onPress={() => commands.changeForm(() => setFaza('PHONE'))} style={styles.backRow}>
                  <ArrowLeft size={16} color={authColors.muted} />
                  <Text style={styles.backText}>Promeni broj</Text>
                </Pressable>
                <View style={styles.stateIcon}><Phone size={28} color={authColors.muted} /></View>
                <Text style={styles.stateTitle}>Unesi kod</Text>
                <Text style={styles.stateCopy}>Unesi primljeni kod. Ako ne stigne, možeš zatražiti novi.</Text>
                <AuthField
                  label="Kod"
                  value={otp}
                  onChangeText={(value) => commands.changeForm(() => setOtp(value))}
                  editable={!radi}
                  keyboardType="number-pad"
                  placeholder="123456"
                  icon={<LockKey size={21} color={authColors.muted} />}
                />
                <PrimaryButton title="Potvrdi kod" onPress={() => void potvrdiOtp()} busy={radi} />
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: radi }} disabled={radi} onPress={() => void posaljiTelefon()} style={styles.linkButton}>
                  <Text style={styles.linkText}>Pošalji novi kod</Text>
                </Pressable>
              </View>
            ) : null}

            {(faza === 'PHONE' || faza === 'OTP') && methods && !methods.phoneOtp ? (
              <View style={formStyle}>
                <Text style={styles.stateCopy}>Prijava telefonom trenutno nije dostupna.</Text>
                <PrimaryButton title="Nazad na prijavu" onPress={nazadNaEmail} busy={radi} />
              </View>
            ) : null}

            {faza === 'RECOVERY' && methods ? (
              <View style={formStyle}>
                <View style={styles.stateIcon}><LockKey size={28} color={authColors.muted} /></View>
                {methods.passwordRecovery ? <>
                  <AuthField label="Email" value={email} onChangeText={value => commands.changeForm(() => setEmail(value))}
                    editable={!radi} keyboardType="email-address" placeholder="ime@primer.rs" />
                  <Text style={styles.stateCopy}>Otvorićeš link iz emaila i izabrati novu lozinku. Tvoji Zadaci i Dogovori ostaju na istom nalogu.</Text>
                  <PrimaryButton title="Pošalji link" busy={radi} onPress={() => void zatraziOporavak()} />
                </> : <Text style={styles.stateCopy}>Oporavak lozinke još nije dostupan u aplikaciji. Možeš se vratiti na prijavu.</Text>}
                <Pressable accessibilityRole="button" disabled={radi} style={styles.linkButton} onPress={nazadNaEmail}>
                  <Text style={styles.linkText}>Nazad na prijavu</Text>
                </Pressable>
              </View>
            ) : null}

            {faza === 'RECOVERY_SENT' ? <View style={formStyle}>
              <View style={styles.stateIcon}><EnvelopeSimple size={28} color={authColors.muted} /></View>
              <Text style={styles.stateCopy}>Ako nalog sa ovim emailom postoji, dobićeš link za novu lozinku. Proveri i neželjenu poštu.</Text>
              <Text style={styles.smallNote}>{email.trim()}</Text>
              <PrimaryButton title="Nazad na prijavu" onPress={nazadNaEmail} />
              <Pressable accessibilityRole="button" style={styles.linkButton} onPress={() => commands.changeForm(() => {
                setFaza('RECOVERY'); setGreska(null); setPoruka(null);
              })}><Text style={styles.linkText}>Izmeni email ili ponovi zahtev</Text></Pressable>
            </View> : null}

            {faza === 'SIGNUP_NEXT_STEP' ? (
              <View style={formStyle}>
                <View style={styles.stateIcon}><EnvelopeSimple size={28} color={authColors.muted} /></View>
                <Text style={styles.stateTitle}>{confirmationRequired ? 'Proveri email' : 'Nastavi prijavu'}</Text>
                <Text style={styles.stateCopy}>{confirmationRequired
                  ? 'Ako je registracija prihvaćena, potvrdi email preko poruke koju dobiješ. Link te vraća na USKOČI prijavu.'
                  : 'Nalog još nije prijavljen. Vrati se na prijavu. Ako ti je stigla poruka za potvrdu emaila, prvo prati njeno uputstvo.'}</Text>
                <PrimaryButton title="Nazad na prijavu" onPress={nazadNaEmail} busy={radi} />
                {confirmationRequired ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: radi }} disabled={radi}
                  onPress={() => void ponoviPotvrduEmaila()} style={styles.linkButton}>
                  <Text style={styles.linkText}>Pošalji ponovo potvrdu</Text>
                </Pressable> : null}
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: radi }} disabled={radi} onPress={() => commands.changeForm(() => {
                  setRezim('SIGNUP'); setFaza('EMAIL'); setGreska(null); setPoruka(null);
                })} style={styles.linkButton}>
                  <Text style={styles.linkText}>Izmeni email</Text>
                </Pressable>
              </View>
            ) : null}
            {faza !== 'EMAIL' && greska ? <Text accessibilityRole="alert" style={styles.bannerErrorText}>{greska}</Text> : null}
            {faza === 'EMAIL' && rezim === 'LOGIN' ? <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Jedan nalog.</Text>
              <Text style={styles.noticeCopy}>Možeš i da tražiš pomoć i da uskočiš drugima.</Text>
            </View> : null}
          </View>
        </ScrollView>
        {faza === 'EMAIL' && methods?.emailPassword ? <View style={[styles.authFooter, { paddingBottom: Math.max(16, insets.bottom) }]}>
          <View style={styles.footerColumn}>
            <PrimaryButton
              title={rezim === 'SIGNUP' ? 'Napravi nalog' : 'Prijavi se'}
              disabled={rezim === 'SIGNUP' && !methods.emailSignup}
              onPress={() => void emailAkcija()}
              busy={radi}
            />
            {methods.emailSignup ? <Pressable accessibilityRole="button"
              accessibilityState={{ disabled: radi }} disabled={radi}
              onPress={() => commands.changeForm(() => { setRezim(rezim === 'LOGIN' ? 'SIGNUP' : 'LOGIN'); setGreska(null); setPoruka(null); })}
              style={styles.alternateAction}>
              <Text style={styles.alternateLabel}>{rezim === 'LOGIN' ? 'Napravi nalog' : 'Već imaš nalog? Prijavi se'}</Text>
            </Pressable> : null}
          </View>
        </View> : null}
      </View>
    </View>
    </AuthSheet>
    </KeyboardAvoidingView></>
  );
}

const styles = StyleSheet.create({
  authFooter: { borderTopWidth: 1, borderTopColor: authColors.divider, backgroundColor: authColors.surface, paddingTop: 12, paddingHorizontal: 22 },
  footerColumn: { width: '100%', maxWidth: 412, alignSelf: 'center' },
  screen: { flex: 1, backgroundColor: 'transparent' },
  header: { width: '100%', maxWidth: 460, alignSelf: 'center', flexDirection: 'row', minHeight: 72, alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 12 },
  backButton: { width: 48, height: 48, borderRadius: radius.control, borderWidth: 1, borderColor: authColors.line, backgroundColor: authColors.input, alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1 },
  headerEyeline: { ...type.label, fontWeight: '600', letterSpacing: 0.4, color: authColors.accentLight, marginBottom: 3 },
  headerTitle: { ...type.heading, textAlign: 'left', fontWeight: '600', color: authColors.ink },
  sheetScroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 22, paddingTop: 4 },
  formColumn: { width: '100%', maxWidth: 412 },
  alternateAction: { minHeight: 48, paddingVertical: 10, paddingHorizontal: 2, justifyContent: 'center', alignSelf: 'center' },
  alternateLabel: { ...type.tab, color: authColors.accentLight, textAlign: 'center' },
  form: { gap: 14, backgroundColor: 'transparent', borderWidth: 0, padding: 0, marginTop: 0 },
  feedback: { marginTop: -6 },
  banner: { marginBottom: 12, borderRadius: radius.control, padding: 12 },
  bannerOk: { backgroundColor: authColors.soft },
  bannerOkText: { ...type.note, color: authColors.ink },
  bannerErrorText: { ...type.note, color: authColors.error },
  forgot: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-end', marginTop: -6 },
  forgotText: { ...type.tab, color: authColors.accentLight },
  methods: { marginTop: 20, gap: 10 },
  methodHeading: { ...type.meta, fontWeight: '600', color: authColors.muted, marginBottom: 2 },
  method: { minHeight: 56, borderRadius: radius.control, borderWidth: 1, borderColor: authColors.methodLine, backgroundColor: authColors.methodSurface, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', padding: 14 },
  methodPressed: { opacity: 0.76 },
  methodIcon: { width: 24, height: 24, flexShrink: 0 },
  methodCopy: { flex: 1, minWidth: 0, gap: 3 },
  methodText: { ...type.bodyStrong, color: authColors.methodInk },
  consent: { flexDirection: 'row', gap: 12, minHeight: 48, paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.control, backgroundColor: authColors.input },
  consentText: { ...type.meta, flex: 1, color: authColors.muted },
  backRow: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 48 },
  backText: { ...type.tab, color: authColors.accentLight },
  smallNote: { ...type.meta, color: authColors.muted, marginVertical: 12 },
  stateIcon: { width: 56, height: 56, borderRadius: radius.cardCompact, alignItems: 'center', justifyContent: 'center', backgroundColor: authColors.stateWell },
  stateTitle: { ...type.title, color: authColors.ink },
  stateCopy: { ...type.copy, color: authColors.muted },
  linkButton: { minHeight: 48, justifyContent: 'center' },
  linkText: { ...type.tab, color: authColors.accentLight },
  notice: { backgroundColor: authColors.soft, padding: 16, borderRadius: radius.control, marginTop: 16, gap: 6 },
  noticeTitle: { ...type.tab, color: authColors.ink },
  noticeCopy: { ...type.meta, color: authColors.muted },
});
