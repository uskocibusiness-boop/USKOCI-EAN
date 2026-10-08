import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type ScrollView } from 'react-native';
import { T } from '../Text';
import { BrandMark } from '../entry/BrandAssets';
import { PermissionAskDialog } from '../permissions/PermissionAskHost';
import type { PermissionKind } from '../permissions/permissionAsk';
import { sys } from '../system/tokens';
import type { ClosureExecutionState } from '../../data/closureExecutionClientService';
import { RATE_LIMITED_COPY, SIGN_IN_FAILURE_COPY } from '../../data/authFailureClasses';
import { AccountClosingScreen } from './AccountClosingState';
import { PrimaryButton } from './AuthControls';
import { AuthFlowFrame } from './AuthFlowFrame';
import { AuthFormFooter, AuthFormStep, type AuthCheck, type AuthWay } from './AuthFormStep';
import { type AuthIntentName } from './AuthIntentLine';
import { AuthSheet } from './AuthSheet';
import { OtpStep, PhoneStep, RecoverySentStep, RecoveryStep, SignupNextStep } from './AuthStateSteps';
import { RecoveryLinkContent, RecoveryLinkFooter, MISMATCH, type RecoveryLinkPhase, type RecoveryLinkValidation } from './RecoveryLinkSteps';
import { RestrictedAccountScreen } from './RestrictedAccountPanel';
import { authCopy } from './authCopy';
import { authFieldMessages, tidyCity, type AuthFieldErrors, type AuthFormValues } from './authValidation';

/**
 * The gallery of the sign-in screens (round of 2026-10-08, F7), drawn with the REAL components and fixture data: nothing here
 * reads or writes anything, and every command is a no-op. Only what is typed follows the fingers, so the fields can be tried.
 * Reached only through the internal gallery (`/dizajn-prijava`, group "Ulaz i prijava na nalog"), which the store package does not show.
 *
 * The keyboard scene stands the sheet on a column that is a keyboard shorter, with a grey block where the keyboard is: the same
 * shrinking that `KeyboardAvoidingView` does on the phone, so the focused field, the scroll that keeps it in view and the foot that
 * rises can be seen (and tried: tap the password, and the sheet scrolls to it). A large-text check is made on the
 * phone or the emulator with the system's font size; the web has none.
 */
export type AuthSceneKey =
  | 'ulaz-prijava' | 'ulaz-prijava-nedostupna' | 'ulaz-registracija' | 'ulaz-greska-polja' | 'ulaz-greska-polja-registracija' | 'ulaz-pogresna-lozinka'
  | 'ulaz-nema-veze' | 'ulaz-nepotvrdjen-email' | 'ulaz-greska-registracije' | 'ulaz-previse-pokusaja' | 'ulaz-provera-nacina'
  | 'ulaz-ucitavanje' | 'ulaz-tastatura' | 'ulaz-tastatura-registracija' | 'ulaz-oporavak' | 'ulaz-oporavak-greska-polja'
  | 'ulaz-oporavak-nedostupan' | 'ulaz-oporavak-poslat' | 'ulaz-proveri-email' | 'ulaz-kod' | 'ulaz-telefon'
  | 'ulaz-nova-lozinka' | 'ulaz-nova-lozinka-greske' | 'ulaz-nova-lozinka-cuvanje' | 'ulaz-nova-lozinka-link' | 'ulaz-nova-lozinka-provera'
  | 'ulaz-nova-lozinka-uspeh' | 'ulaz-ograniceno' | 'ulaz-zatvaranje' | 'ulaz-dozvola-mikrofon' | 'ulaz-dozvola-lokacija';

export const AUTH_GALLERY_SCENES: readonly (readonly [AuthSceneKey, string])[] = [
  ['ulaz-prijava', 'Ulaz: prijava'], ['ulaz-prijava-nedostupna', 'Ulaz: prijava emailom isključena (dugme sa razlogom)'], ['ulaz-registracija', 'Ulaz: registracija'],
  ['ulaz-greska-polja', 'Ulaz: greške u poljima (prijava)'], ['ulaz-greska-polja-registracija', 'Ulaz: greške u poljima (registracija)'],
  ['ulaz-pogresna-lozinka', 'Ulaz: pogrešna lozinka'], ['ulaz-nema-veze', 'Ulaz: nema veze'], ['ulaz-nepotvrdjen-email', 'Ulaz: email nije potvrđen'],
  ['ulaz-greska-registracije', 'Ulaz: registracija nije prošla'], ['ulaz-previse-pokusaja', 'Ulaz: previše pokušaja'],
  ['ulaz-provera-nacina', 'Ulaz: provera načina prijave nije uspela'], ['ulaz-ucitavanje', 'Ulaz: slanje u toku'],
  ['ulaz-tastatura', 'Ulaz: tastatura otvorena (prijava)'], ['ulaz-tastatura-registracija', 'Ulaz: tastatura otvorena (registracija)'],
  ['ulaz-oporavak', 'Oporavak lozinke: email'], ['ulaz-oporavak-greska-polja', 'Oporavak lozinke: greška u polju'],
  ['ulaz-oporavak-nedostupan', 'Oporavak lozinke: nije dostupan'], ['ulaz-oporavak-poslat', 'Oporavak lozinke: poslato'],
  ['ulaz-proveri-email', 'Posle registracije: proveri email'], ['ulaz-kod', 'Telefon: unesi kod'], ['ulaz-telefon', 'Telefon: broj'],
  ['ulaz-nova-lozinka', 'Link za oporavak: nova lozinka'], ['ulaz-nova-lozinka-greske', 'Link za oporavak: greške u poljima'],
  ['ulaz-nova-lozinka-cuvanje', 'Link za oporavak: čuvanje'], ['ulaz-nova-lozinka-link', 'Link za oporavak: link ne važi'],
  ['ulaz-nova-lozinka-provera', 'Link za oporavak: provera linka'], ['ulaz-nova-lozinka-uspeh', 'Link za oporavak: lozinka promenjena'],
  ['ulaz-ograniceno', 'Ograničen nalog'], ['ulaz-zatvaranje', 'Nalog se zatvara'],
  ['ulaz-dozvola-mikrofon', 'Pitanje pre dozvole: mikrofon'], ['ulaz-dozvola-lokacija', 'Pitanje pre dozvole: lokacija'],
];

export const isAuthGalleryScene = (value: string): value is AuthSceneKey => AUTH_GALLERY_SCENES.some(([key]) => key === value);

const noop = () => undefined;
/** How far a phone's keyboard lifts the sheet: roughly the height of the keyboard of the owner's phone, in dp. */
const KEYBOARD_HEIGHT = 280;

/** What stands behind the sheet in the gallery: the real entry is the locked V4.9 composition and is not drawn here. */
function Backdrop() {
  return <View style={s.backdrop}><BrandMark size={126} /></View>;
}

/** A grey block where the keyboard is, and the sheet shrunk to what is above it. */
function FakeKeyboard() {
  return <View style={s.keyboard} accessible={false}><T variant="meta" tone="muted">tastatura</T></View>;
}

/** The sheet over the backdrop, with the frame every step stands in, optionally a keyboard shorter. */
function SheetStage({ onBack, footer, footerReason, keyboard = false, children }: {
  onBack: () => void; footer?: ReactNode; footerReason?: string; keyboard?: boolean; children: ReactNode;
}) {
  const scroller = useRef<ScrollView>(null);
  const sheet = <AuthSheet visible expanded backdrop={<Backdrop />}>
    <View style={s.fill}>
      <AuthFlowFrame onBack={onBack} scrollRef={scroller} scrollKey="scene" footer={footer} footerReason={footerReason}>{children}</AuthFlowFrame>
    </View>
  </AuthSheet>;
  return keyboard ? <View style={s.fill}><View style={s.fill}>{sheet}</View><FakeKeyboard /></View> : sheet;
}

/** The recovery link's own screen: white, the frame with the flow's name in the bar. */
function ScreenStage({ onBack, footer, children }: { onBack: () => void; footer?: ReactNode; children: ReactNode }) {
  const scroller = useRef<ScrollView>(null);
  return <View style={s.screen}>
    <AuthFlowFrame title={authCopy.recoveryName} onBack={onBack} scrollRef={scroller} scrollKey="scene" footer={footer}>{children}</AuthFlowFrame>
  </View>;
}

type FormFixture = {
  way: AuthWay; values?: Partial<AuthFormValues>; errors?: AuthFieldErrors; failure?: string; next?: 'HAVE_ACCOUNT' | 'RESEND';
  busy?: boolean; check?: AuthCheck; intent?: AuthIntentName; keyboard?: boolean;
};
const FILLED = { ime: 'Ana', prezime: 'Petrović', grad: 'Novi Sad', email: 'ana@example.test', lozinka: 'lozinka-za-probu' };
const FORMS: Partial<Record<AuthSceneKey, FormFixture>> = {
  'ulaz-prijava': { way: 'LOGIN' },
  'ulaz-registracija': { way: 'SIGNUP', intent: 'REQUESTER' },
  'ulaz-greska-polja': { way: 'LOGIN', errors: { email: authFieldMessages.emailMissing, lozinka: authFieldMessages.lozinkaMissing } },
  'ulaz-greska-polja-registracija': { way: 'SIGNUP', values: { ime: 'Ana', email: 'ana@example', lozinka: 'abc' },
    errors: { prezime: authFieldMessages.prezime, grad: authFieldMessages.grad, email: authFieldMessages.emailInvalid, lozinka: authFieldMessages.lozinkaShort } },
  'ulaz-pogresna-lozinka': { way: 'LOGIN', values: { email: FILLED.email, lozinka: FILLED.lozinka }, failure: SIGN_IN_FAILURE_COPY.BAD_CREDENTIALS },
  'ulaz-nema-veze': { way: 'LOGIN', values: { email: FILLED.email, lozinka: FILLED.lozinka }, failure: SIGN_IN_FAILURE_COPY.CONNECTION },
  'ulaz-nepotvrdjen-email': { way: 'LOGIN', values: { email: FILLED.email, lozinka: FILLED.lozinka }, failure: SIGN_IN_FAILURE_COPY.EMAIL_NOT_CONFIRMED, next: 'RESEND' },
  'ulaz-greska-registracije': { way: 'SIGNUP', values: FILLED, failure: 'Registracija trenutno nije uspela. Proveri podatke i pokušaj ponovo.', next: 'HAVE_ACCOUNT' },
  'ulaz-previse-pokusaja': { way: 'LOGIN', values: { email: FILLED.email, lozinka: FILLED.lozinka }, failure: RATE_LIMITED_COPY },
  'ulaz-provera-nacina': { way: 'LOGIN', check: 'failed' },
  'ulaz-ucitavanje': { way: 'LOGIN', values: { email: FILLED.email, lozinka: FILLED.lozinka }, busy: true },
  'ulaz-tastatura': { way: 'LOGIN', values: { email: FILLED.email }, keyboard: true },
  'ulaz-tastatura-registracija': { way: 'SIGNUP', intent: 'WORKER', values: { ime: 'Ana', prezime: 'Petrović' }, keyboard: true },
};

/** The first step with its real component; what is typed follows the fingers, the commands do nothing. */
function FormScene({ fixture, onBack }: { fixture: FormFixture; onBack: () => void }) {
  const [values, setValues] = useState<AuthFormValues>({ ime: '', prezime: '', grad: '', email: '', lozinka: '', ...fixture.values });
  const [way, setWay] = useState<AuthWay>(fixture.way);
  const [intent, setIntent] = useState<AuthIntentName | null>(fixture.intent ?? null);
  const failureAction = fixture.next === 'HAVE_ACCOUNT' ? { note: 'Možda već imaš nalog.', label: authCopy.signIn, onPress: () => setWay('LOGIN') }
    : fixture.next === 'RESEND' ? { label: 'Pošalji ponovo potvrdu', onPress: noop } : null;
  return <SheetStage onBack={onBack} keyboard={fixture.keyboard} footer={<AuthFormFooter way={way} busy={!!fixture.busy} onSubmit={noop} />}>
    <AuthFormStep way={way} onWay={setWay} emailOpen signUpOpen phoneOpen={false} intent={intent} onIntentChange={setIntent}
      values={values} onValue={(name, value) => setValues(current => ({ ...current, [name]: value }))}
      onCityBlur={() => setValues(current => ({ ...current, grad: tidyCity(current.grad) }))}
      errors={fixture.errors ?? {}} failure={fixture.failure ?? null} failureAction={failureAction} notice={null} confirmEmail
      busy={!!fixture.busy} check={fixture.check ?? 'done'} onRetryCheck={noop} onForgot={noop} onPhone={noop} onSubmit={noop} />
  </SheetStage>;
}

/** The link screen's states, with its real pieces. */
function LinkScene({ scene, onBack }: { scene: AuthSceneKey; onBack: () => void }) {
  const [password, setPassword] = useState(scene === 'ulaz-nova-lozinka-greske' ? 'abc' : '');
  const [confirmation, setConfirmation] = useState(scene === 'ulaz-nova-lozinka-greske' ? 'abd' : '');
  const email = 'ana@example.test';
  const phase: RecoveryLinkPhase = scene === 'ulaz-nova-lozinka-provera' ? { kind: 'verifying' }
    : scene === 'ulaz-nova-lozinka-uspeh' ? { kind: 'success' }
      : scene === 'ulaz-nova-lozinka-link' ? { kind: 'error', code: 'INVALID_LINK', message: 'Link je nevažeći ili je istekao. Zatraži novi link.' }
        : { kind: 'form', email, serverError: null };
  const validation: RecoveryLinkValidation = scene === 'ulaz-nova-lozinka-greske' ? { field: 'confirmation', message: MISMATCH } : null;
  const busy = scene === 'ulaz-nova-lozinka-cuvanje';
  return <ScreenStage onBack={onBack} footer={phase.kind === 'verifying' ? null
    : <RecoveryLinkFooter phase={phase} signedIn={false} busy={busy} onSave={noop} onBack={onBack} onNewLink={noop} onRetry={noop} />}>
    <RecoveryLinkContent phase={phase} signedIn={false} busy={busy} password={password} confirmation={confirmation} validation={validation}
      onPassword={setPassword} onConfirmation={setConfirmation} onSave={noop} onNewLink={noop} />
  </ScreenStage>;
}

const CLOSING: ClosureExecutionState = { accountId: 'galerija', requestId: 'galerija', generation: 'galerija', state: 'EXECUTING',
  policySha256: 'galerija', authoritative: true, completedSteps: 3, totalSteps: 8 };

export function AuthGalleryScene({ scene, onBack }: { scene: AuthSceneKey; onBack: () => void }) {
  const [email, setEmail] = useState('ana@example.test');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const toSignIn = <PrimaryButton title={authCopy.backToSignIn} onPress={onBack} />;
  const fixture = FORMS[scene];
  if (fixture) return <FormScene fixture={fixture} onBack={onBack} />;
  if (scene.startsWith('ulaz-nova-lozinka')) return <LinkScene scene={scene} onBack={onBack} />;
  switch (scene) {
    case 'ulaz-prijava-nedostupna': return <SheetStage onBack={onBack} footerReason="Prijava emailom trenutno nije dostupna." footer={<PrimaryButton title={authCopy.signIn} onPress={noop} disabled />}>
      <AuthFormStep way="LOGIN" onWay={noop} emailOpen={false} signUpOpen={false} phoneOpen={false} intent={null} onIntentChange={noop}
        values={{ ime: '', prezime: '', grad: '', email: '', lozinka: '' }} onValue={noop} onCityBlur={noop} errors={{}} failure={null} failureAction={null}
        notice={null} confirmEmail busy={false} check="done" onRetryCheck={noop} onForgot={noop} onPhone={noop} onSubmit={noop} />
    </SheetStage>;
    case 'ulaz-oporavak': case 'ulaz-oporavak-greska-polja': return <SheetStage onBack={onBack} footer={<PrimaryButton title="Pošalji link" onPress={noop} />}>
      <RecoveryStep available email={email} onChange={setEmail} editable failure={null} onSubmit={noop}
        error={scene === 'ulaz-oporavak-greska-polja' ? authFieldMessages.emailInvalid : null} />
    </SheetStage>;
    case 'ulaz-oporavak-nedostupan': return <SheetStage onBack={onBack} footer={toSignIn}>
      <RecoveryStep available={false} email={email} onChange={setEmail} editable failure={null} onSubmit={noop} />
    </SheetStage>;
    case 'ulaz-oporavak-poslat': return <SheetStage onBack={onBack} footer={toSignIn}><RecoverySentStep email={email} onChangeEmail={noop} /></SheetStage>;
    case 'ulaz-proveri-email': return <SheetStage onBack={onBack} footer={toSignIn}>
      <SignupNextStep confirmationRequired email={email} notice={null} failure={null} busy={false} onResend={noop} onChangeEmail={noop} />
    </SheetStage>;
    case 'ulaz-telefon': return <SheetStage onBack={onBack} footer={<PrimaryButton title="Pošalji kod" onPress={noop} />}>
      <PhoneStep signUp={false} phone={phone} onChange={setPhone} editable error={null} failure={null} onSubmit={noop} />
    </SheetStage>;
    case 'ulaz-kod': return <SheetStage onBack={onBack} footer={<PrimaryButton title="Potvrdi kod" onPress={noop} />}>
      <OtpStep code={code} onChange={setCode} editable error={null} notice="Poslali smo ti kod." failure={null} busy={false}
        onSubmit={noop} onResend={noop} onChangePhone={noop} />
    </SheetStage>;
    case 'ulaz-ograniceno': return <RestrictedAccountScreen exitLabel={authCopy.backToSignIn} onExit={onBack} onSupport={noop} />;
    case 'ulaz-zatvaranje': return <AccountClosingScreen execution={CLOSING} working={null} message={null} onCheck={noop} onSupport={noop} onSignOut={onBack} />;
    case 'ulaz-dozvola-mikrofon': case 'ulaz-dozvola-lokacija': {
      const kind: PermissionKind = scene === 'ulaz-dozvola-mikrofon' ? 'microphone' : 'location';
      return <View style={s.screen}><PermissionAskDialog open={{ id: 1, kind }} onAnswer={onBack} /></View>;
    }
    default: return null;
  }
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flex: 1, backgroundColor: sys.color.surface },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.surface },
  keyboard: { height: KEYBOARD_HEIGHT, backgroundColor: sys.color.control, alignItems: 'center', paddingTop: sys.space.base },
});
