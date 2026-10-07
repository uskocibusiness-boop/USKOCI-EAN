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
  Linking,
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
import { AuthIntentLine } from '../ui/auth/AuthIntentLine';
import { RestrictedAccountScreen } from '../ui/auth/RestrictedAccountPanel';
import { publicSupportMailto } from '../ui/auth/supportContact';
import { Segmented, type SegmentedOption } from '../ui/system/Segmented';

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

/** The two ways in on one screen, in the order of the design proposal (N2): creating an account leads, because the entry's choice opens it. */
const WAYS: readonly SegmentedOption<Rezim>[] = [{ key: 'SIGNUP', label: 'Napravi nalog' }, { key: 'LOGIN', label: 'Prijava' }];
/** Said instead of a tick that recorded nothing (owner rule PKG-031) while the legal documents are not published. */
const LEGAL_LINE = 'Uslovi korišćenja i pravila privatnosti još nisu objavljeni.';

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

  const [ime, setIme] = useState('');
  const [prezime, setPrezime] = useState('');
  const [grad, setGrad] = useState('');
  const [email, setEmail] = useState('');
  // Signing up asks for the password once (design proposal N2): the eye on the field shows it, so a typo can be seen and
  // fixed there, and a second field that had to match the first is gone.
  const [lozinka, setLozinka] = useState('');
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
  const signOutReason = useSesija().signOutReason;
  // Owner decision 2026-10-07: a restricted account is its own screen, not a line of red text under the form. Nobody is signed
  // in then, so there is no private support to open; "Piši podršci" is drawn only when the owner has given a public address.
  const supportUrl = publicSupportMailto();

  // A session the provider ended because the account is restricted shows that screen, once.
  useEffect(() => {
    if (signOutReason?.kind !== 'RESTRICTED_ACCOUNT') return;
    const shown = commands.changeForm(() => {
      setPreparedIntent(null); setRezim('LOGIN'); setFaza('RESTRICTED');
      setLozinka(''); setOtp(''); setGreska(null); setPoruka(null);
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
      setLozinka(''); setGreska(null); setPoruka(null);
      setOtvoren(true);
    });
  }, [params.form, commands.changeForm]);

  // One step back, for the arrow and for the phone's Back: any step after the form returns to the sign-in form, and the form
  // itself, in either mode (they are two sides of one screen), closes the sheet and shows the entry again.
  const retreat = () => commands.changeForm(() => {
    if (faza !== 'EMAIL') { setFaza('EMAIL'); setRezim('LOGIN'); }
    else setOtvoren(false);
    setGreska(null); setPoruka(null);
  });
  useEffect(() => {
    if (!otvoren) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      retreat();
      return true;
    });
    return () => subscription.remove();
    // `retreat` closes over exactly the values listed; the subscription is renewed whenever one of them changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands.changeForm, otvoren, faza]);

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
      setLozinka(''); setOtp(''); setGreska(null); setPoruka(null);
      setFaza('RESTRICTED');
      return;
    }
    setGreska(error instanceof Error ? error.message : 'Zahtev trenutno nije uspeo. Pokušaj ponovo.');
  }

  /**
   * The entry's two halves choose what the person has come to do. A person who has chosen is a person who has no account yet
   * more often than not, so the form opens on creating one (design proposal N2) with the choice kept as one sentence; the
   * switch on the form is one touch away from signing in. `changing` is that sentence's own "Promeni": the same write of the
   * same choice, but it must not move the form, clear what was typed or close anything.
   */
  async function izaberiNameru(intent: 'REQUESTER' | 'WORKER', selection?: EntryIntentSelection, changing = false) {
    const current = () => entryScope.current.focused && entryScope.current.revision === entryRevision &&
      (selection?.isCurrent() ?? true);
    if (!current()) return;
    await commands.run(() => entryIntentClientService.prepare(intent, current), () => {
      if (!current()) return;
      setPreparedIntent({ intent, accountRevision: sesijaSada().accountRevision });
      if (changing) return;
      setRezim('SIGNUP'); setFaza('EMAIL'); setGreska(null); setPoruka(null); setOtvoren(true);
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
      const result = await authClientService.signUp({
        email: email.trim(), password: lozinka,
        firstName: ime.trim(), lastName: prezime.trim(), city: grad.trim(),
      });
      return result.hasSession;
    }, hasSession => {
      if (!hasSession) {
        setLozinka('');
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
      setLozinka(''); setFaza('RECOVERY_SENT');
    }, prijaviGresku);
  }

  // The form step is one calm screen for both ways in (N2): one greeting, the switch under it, nothing else named twice. The
  // other steps keep their own title and one sentence.
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
            : 'Zdravo.';

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
            : undefined;

  const recoveryStage = faza === 'RECOVERY' || faza === 'RECOVERY_SENT';
  const stageComposition = recoveryStage || faza === 'SIGNUP_NEXT_STEP';
  const formStyle = [styles.form, stageComposition && authStageForm];
  // Each way in starts at its own top: the switch scrolls the form back up, so the fields of the longer one are never hidden
  // above where the shorter one had been scrolled to (the form is one surface, so it is the same ScrollView that rewinds).
  const scroller = useRef<ScrollView>(null);
  const switchWay = (next: Rezim) => commands.changeForm(() => {
    setRezim(next); setGreska(null); setPoruka(null);
    scroller.current?.scrollTo?.({ y: 0, animated: false });
  });
  const headerTitle = recoveryStage ? 'Oporavak pristupa' : faza === 'EMAIL' ? null : rezim === 'SIGNUP' ? 'Registracija' : 'Prijava';
  const signUpOffered = faza === 'EMAIL' && !!methods?.emailPassword && !!methods.emailSignup;

  return (
    <><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    {/* While the restricted-account screen stands over it, what lies beneath is neither read aloud nor reachable. */}
    <View style={{ flex: 1 }} importantForAccessibility={faza === 'RESTRICTED' ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={faza === 'RESTRICTED'}>
    {/* The sheet keeps one height while both ways are (or are about to be) offered, so switching between them never moves its edge. */}
    <AuthSheet visible={otvoren} expanded={rezim === 'SIGNUP' || (faza === 'EMAIL' && (!methods || (methods.emailPassword && methods.emailSignup)))}
      backdrop={entrySeen ? <EntryWelcome
      onRequester={selection => izaberiNameru('REQUESTER', selection)} onWorker={selection => izaberiNameru('WORKER', selection)}
      onSignIn={() => otvori('LOGIN')} onSignUp={() => otvori('SIGNUP')} busy={radi || otvoren} error={otvoren ? null : greska} /> : null}>
    <View onLayout={onFormLayout} style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Nazad" disabled={radi}
          onPress={() => { retreat(); }} style={({ pressed }) => [styles.backButton, pressed && styles.methodPressed]}><ArrowLeft size={22} color={authColors.ink} /></Pressable>
        {headerTitle ? <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
        </View> : null}
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView ref={scroller} key={faza} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.sheetScroll, { paddingBottom: Math.max(28, insets.bottom + 16) }]}>
          <View style={styles.formColumn}>
            <AuthIntro composition={stageComposition ? 'stage' : 'hero'} title={naslov} copy={podnaslov} />
            {signUpOffered ? <View style={styles.way}>
              <Segmented options={WAYS} value={rezim} onChange={switchWay} />
            </View> : null}
            {/* What the person came to do stays as one sentence with its one command (N2). It is kept for either way in:
                after signing in they land where they were going. */}
            {faza === 'EMAIL' && selectedIntent ? <View style={styles.way}>
              <AuthIntentLine intent={selectedIntent} disabled={radi} onChange={next => { void izaberiNameru(next, undefined, true); }} />
            </View> : null}
            {faza === 'EMAIL' && rezim === 'SIGNUP' && signUpOffered
              ? <Text style={styles.oneAccount}>Jedan nalog. Možeš i da tražiš pomoć i da uskočiš drugima.</Text> : null}
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
                    newPassword={rezim === 'SIGNUP'}
                    icon={<LockKey size={21} color={authColors.muted} />}
                  />

                  <View style={styles.feedback} accessibilityLiveRegion="polite">
                    {greska ? <Text accessibilityRole="alert" style={styles.bannerErrorText}>{greska}</Text> : null}
                  </View>

                  {rezim === 'LOGIN' ? (
                    <Pressable accessibilityRole="button" disabled={radi} onPress={() => commands.changeForm(() => { setFaza('RECOVERY'); setLozinka(''); setGreska(null); setPoruka(null); })} style={styles.forgot}>
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
                ) : rezim === 'LOGIN' ? (
                  // Said where the other ways in would stand; on the form that makes an account it would only be a second note.
                  <Text style={styles.smallNote}>Za sada se ulazi email adresom i lozinkom.</Text>
                ) : null}


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
                  <Text style={styles.stateCopy}>Otvorićeš link iz emaila i izabrati novu lozinku. Tvoji zadaci i Dogovori ostaju na istom nalogu.</Text>
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
            {/* Deep read 8.2, owner decision 2026-09-21 (PKG-031): the tick asked to accept two documents that are not
                published yet and recorded nothing. The screen says so instead, once, under the command that creates the
                account; the recorded acceptance (profil/pravna) takes over once they are published. */}
            {rezim === 'SIGNUP' && methods.emailSignup ? <Text style={styles.legal}>{LEGAL_LINE}</Text> : null}
          </View>
        </View> : null}
      </View>
    </View>
    </AuthSheet>
    </View>
    {/* N3: a restricted account has a screen of its own, not a window over the entry. There is no bottom bar on /auth, and the
        one way out goes back to the sign-in form (nobody is signed in, so there is nothing to sign out of). */}
    {faza === 'RESTRICTED' ? <RestrictedAccountScreen exitLabel="Nazad na prijavu" onExit={nazadNaEmail} busy={radi}
      onSupport={supportUrl ? () => Linking.openURL(supportUrl) : undefined} /> : null}
    </KeyboardAvoidingView></>
  );
}

const styles = StyleSheet.create({
  authFooter: { borderTopWidth: 1, borderTopColor: authColors.divider, backgroundColor: authColors.surface, paddingTop: 12, paddingHorizontal: 22 },
  footerColumn: { width: '100%', maxWidth: 412, alignSelf: 'center', gap: 8 },
  legal: { ...type.note, fontWeight: '400', color: authColors.muted, textAlign: 'center' },
  screen: { flex: 1, backgroundColor: 'transparent' },
  header: { width: '100%', maxWidth: 460, alignSelf: 'center', flexDirection: 'row', minHeight: 72, alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 12 },
  backButton: { width: 48, height: 48, borderRadius: radius.control, borderWidth: 1, borderColor: authColors.line, backgroundColor: authColors.input, alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1 },
  headerTitle: { ...type.heading, textAlign: 'left', fontWeight: '600', color: authColors.ink },
  sheetScroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 22, paddingTop: 4 },
  formColumn: { width: '100%', maxWidth: 412 },
  way: { marginBottom: 14 },
  oneAccount: { ...type.note, fontWeight: '400', color: authColors.muted, marginBottom: 14 },
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
  backRow: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 48 },
  backText: { ...type.tab, color: authColors.accentLight },
  smallNote: { ...type.meta, color: authColors.muted, marginVertical: 12 },
  stateIcon: { width: 56, height: 56, borderRadius: radius.cardCompact, alignItems: 'center', justifyContent: 'center', backgroundColor: authColors.stateWell },
  stateTitle: { ...type.title, color: authColors.ink },
  stateCopy: { ...type.copy, color: authColors.muted },
  linkButton: { minHeight: 48, justifyContent: 'center' },
  linkText: { ...type.tab, color: authColors.accentLight },
});
