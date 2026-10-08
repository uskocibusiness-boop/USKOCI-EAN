import { createContext, isValidElement, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StanjeProfila } from '../../contracts/projections';
import { T } from '../Text';
import { Press } from '../Press';
import { DetailTopBar } from '../system/DetailTopBar';
import { FactArt } from '../system/FactArt';
import { ClockArt } from '../system/ClockArt';
import { Glyph } from '../system/Glyph';
import { cityLabel } from '../profile/cityLabel';
import { layout, ruleWidth } from '../system/layout';
import { StateView } from '../system/StateView';
import { Surface } from '../system/Surface';
import { sys, field } from '../system/tokens';
import { useLayoutClass } from '../system/textScale';
import { ConversationArt } from '../system/ConversationArt';
import { SettingsGroup, SettingsRow } from '../settings/SettingsPresentation';
import { V2Action } from '../v2/V2Action';
import type { WorkerDraft } from './workerProfileDraft';
import { WorkerProfileSaved, type AvailableNowControl, type SavedProfilePart } from './WorkerProfileSaved';
import { NameDifference, namesDiffer } from './NameDifference';
import { availabilityRowDetail } from './workerProfileFacts';

/**
 * Frame of the worker profile: back, title, keyboard-safe body, sticky footer. `/profil/razgovor` and `/profil/lokacija`
 * draw it too, so the title can be theirs; the back says only "Nazad", because the screen is also opened from an
 * application (prijava) and Back returns there, not to the profile.
 *
 * While the software keyboard is up the sticky footer steps aside (review of step 9, 2026-09-24): on a 320 × 640 phone
 * the footer (status lines, a 54 dp primary, a quiet action or the area confirmation) rose with the keyboard and left
 * under 100 dp for the field being typed. It is hidden, not removed, so a button keeps its state and nothing is announced
 * again; it comes back as soon as the keyboard closes (Back, the return key, a drag of the body, or a tap outside the
 * field). The body keeps what the person needs while typing: the activation checklist and every field's own hint.
 *
 * A `WorkerProfileFooter` keeps its answer on screen while typing and steps aside only with its actions (round 5c): a tap
 * on a row that refuses because the draft is not saved, or a "Dopuni osnovne podatke" that focuses a field, writes its
 * sentence there, and hiding the whole footer made the tap look dead. Any other footer (the area confirmation, the AI
 * review) steps aside whole, because nothing in it answers a tap made while typing.
 */
export function WorkerProfileFrame({ back, children, footer, title = 'Radni profil', backLabel = 'Nazad', scrollRef, onScroll, onScrollBeginDrag, right }: {
  back: () => void; children: ReactNode; footer?: ReactNode; title?: string; backLabel?: string;
  scrollRef?: RefObject<ScrollView | null>; onScroll?: ScrollViewProps['onScroll']; onScrollBeginDrag?: ScrollViewProps['onScrollBeginDrag'];
  /** At most one control in the bar's right place: the "ⓘ" with what the profile does with its data (`HeaderInfo`). */ right?: ReactNode;
}) {
  const typing = useKeyboardShown();
  const keepsStatus = isValidElement(footer) && footer.type === WorkerProfileFooter;
  const aside = typing && !keepsStatus;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar backLabel={backLabel} title={title} onBack={back} right={right} />
    <KeyboardAvoidingView style={s.grow} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* The iOS number pad has no return key and iOS has no Back: dragging the body closes the keyboard (review 5b). */}
      <ScrollView ref={scrollRef} onScroll={onScroll} onScrollBeginDrag={onScrollBeginDrag} scrollEventThrottle={onScroll ? 16 : undefined}
        keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={s.content}>{children}</ScrollView>
      {footer ? <FooterTyping.Provider value={typing}>
        <View testID="worker-profile-footer" style={[s.footer, typing && (keepsStatus ? s.footerTyping : s.footerAside)]}
          accessibilityElementsHidden={aside} importantForAccessibility={aside ? 'no-hide-descendants' : 'auto'}>{footer}</View>
      </FooterTyping.Provider> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/** Whether the frame's footer is drawn while the keyboard is up; only `WorkerProfileFooter` reads it. */
const FooterTyping = createContext(false);

/**
 * Whether the software keyboard is up, from the keyboard's own events (iOS says it before the animation, Android after).
 * It starts false: a footer is never hidden without an event saying the keyboard is there.
 */
function useKeyboardShown() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setShown(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return shown;
}

/** Reading the profile, or why it could not be read: the one state look (StateView). No draft is built from defaults. */
export function WorkerProfileStatus({ loading, error, retry }: { loading: boolean; error?: string | null; retry: () => void }) {
  if (loading) return <StateView kind="loading" title="Učitavamo radni profil…" skeleton={{ count: 3, rows: 2 }} />;
  return <StateView kind="error" title="Radni profil nije dostupan" body={error ?? undefined}
    primary={{ label: 'Ponovo učitaj profil', onPress: retry }} />;
}

/**
 * The answer to the last save, right above the button that made it: Save sits in this footer, often far below the top
 * of a long form, so a line at the top of the scroll was never seen. It is said only once the saved profile has been
 * read back (the route decides that); the button's own check confirms it for a moment.
 *
 * While the keyboard is up only the answer stays (the message and the error, with room of their own); the actions and
 * the held line step aside, mounted, so a button keeps its state and nothing is announced again (round 5c).
 */
export function WorkerProfileFooter({ message, error, held = false, children }: {
  message?: string | null; error?: string | null;
  /** An unconfirmed save is kept and only what is really saved is shown. */ held?: boolean; children: ReactNode;
}) {
  const typing = useContext(FooterTyping);
  return <>
    {message || error ? <View testID="worker-profile-answer" style={[s.answer, typing && s.answerTyping]}>
      {message ? <View style={s.statusLine}><FactArt kind="check" size={20} />
        <T accessibilityRole="alert" variant="body" style={[s.grow, s.ink]}>{message}</T></View> : null}
      {error ? <T accessibilityRole="alert" variant="body" style={s.danger}>{error}</T> : null}
    </View> : null}
    <View testID="worker-profile-actions" style={[s.answer, typing && s.footerAside]} accessibilityElementsHidden={typing}
      importantForAccessibility={typing ? 'no-hide-descendants' : 'auto'}>
      {held ? <T variant="meta" tone="muted">Tvoj tekst nije izgubljen. Ispod je prikazano samo ono što je sačuvano.</T> : null}
      {children}
    </View>
  </>;
}

function Field({ label, value, change, disabled, multiline = false, inputRef }: {
  label: string; value: string; change: (text: string) => void; disabled: boolean; multiline?: boolean;
  inputRef?: RefObject<TextInput | null>;
}) {
  return <View style={s.field}><T variant="meta" tone="muted">{label}</T><TextInput ref={inputRef} accessibilityLabel={label} value={value}
    editable={!disabled} onChangeText={text => { if (!disabled) change(text); }} multiline={multiline}
    maxLength={multiline ? 4000 : 160} style={[s.input, multiline && s.multiline, disabled && s.inputLocked]} /></View>;
}

/** The most a list may hold (`capabilityTerms`). */
const MAX_TERMS = 50;

/** Manual correction stays available after an explicit edit tap. Free text has no finite catalogue. */
function TermsEditor({ label, placeholder, values, pending, setPending, change, disabled, inputRef }: {
  label: string; placeholder: string; values: string[]; pending: string; setPending: (text: string) => void;
  change: (terms: string[], clearPending?: boolean) => void; disabled: boolean; inputRef?: RefObject<TextInput | null>;
}) {
  const { stacked } = useLayoutClass();
  const full = values.length >= MAX_TERMS;
  const add = () => { const term = pending.trim();
    if (disabled || !term || Array.from(term).length > 500 || full) return;
    change([...values, term], true); };
  return <View style={s.section}>
    {values.length ? <View style={s.chips}>{values.map((value, index) => <Press key={index} accessibilityRole="button"
      accessibilityLabel={`Ukloni ${label.toLowerCase()}: ${value}`} accessibilityState={{ disabled }} disabled={disabled}
      haptic="select" hitSlop={0} onPress={() => { if (!disabled) change(values.filter((_, i) => i !== index)); }} style={s.chip}>
      <T variant="note" style={s.chipText}>{value}</T><Glyph name="close" size={16} tone="muted" />
    </Press>)}</View> : null}
    <View style={[s.addRow, stacked && s.addRowStacked]}>
      <TextInput ref={inputRef} accessibilityLabel={`Nova stavka: ${label}`} placeholder={placeholder} placeholderTextColor={sys.color.muted}
        value={pending} editable={!disabled && !full} onChangeText={text => { if (!disabled) setPending(text); }}
        onSubmitEditing={add} maxLength={500} style={[s.input, stacked ? s.addInputStacked : s.grow, (disabled || full) && s.inputLocked]} />
      <V2Action tone="neutral" label="Dodaj" accessibilityLabel={`Dodaj: ${label}`} kind="secondary" compact onPress={add}
        disabled={disabled || !pending.trim() || full} style={[s.add, stacked && s.addStacked]} />
    </View>
    {full ? <T variant="note" tone="muted">Najviše 50 stavki.</T> : null}
  </View>;
}

/**
 * Facts read as a profile, with one clearly labelled edit affordance and no hidden removal gesture: the section's name, and one word at
 * the end of its title ("Izmeni", and "Gotovo" while it is open) that opens the fields. It used to be a picture, a title and a round
 * pencil, and a hairline under it; now it is a `Section`, and the screen's gap of 24 is what parts one section from the next.
 */
function ProfileSection({ title, summary, summaryContent, empty, open, toggle, disabled, children }: {
  title: string; summary: string; empty: string; open: boolean;
  toggle: () => void; disabled: boolean; children: ReactNode; summaryContent?: ReactNode;
}) {
  return <SettingsGroup title={title} action={{ label: open ? 'Gotovo' : 'Izmeni', accessibilityLabel: `${open ? 'Gotovo' : 'Izmeni'}: ${title}`,
    onPress: () => { if (!disabled) toggle(); } }}>
    {open ? <View style={s.editor}>{children}</View> : summaryContent ?? <ProfileSummary text={summary || empty} label={title} muted={!summary} />}
  </SettingsGroup>;
}

/** Long authored lists remain fully available without pushing the work area off several screens. */
function ProfileSummary({ text, label, muted = false }: { text: string; label: string; muted?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 140;
  return <View style={s.summary}>
    <T variant="body" tone={muted ? 'muted' : 'ink'} numberOfLines={long && !expanded ? 3 : undefined}>{text}</T>
    {long ? <Press accessibilityRole="button" accessibilityLabel={`${expanded ? 'Sažmi' : 'Prikaži sve'}: ${label}`}
      accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} haptic="select" style={s.showMore}>
      <T variant="note" style={s.summaryLink}>{expanded ? 'Sažmi' : 'Prikaži sve'}</T>
    </Press> : null}
  </View>;
}

/** Personal profile activation needs identity/capabilities and an area, never a permanent team. */
export type WorkerActivationChecks = { basics: boolean; area: boolean; capacity?: boolean };
// The name is not typed here any more (owner, 8 Oct 2026: one name for everything, and "Lični podaci" is where it is changed), so the first check says
// what is still done here: the skills (and the account's name, which the work profile takes when it is activated).
const CHECKS: [keyof WorkerActivationChecks, string][] = [['basics', 'Veštine i ime naloga'], ['area', 'Područje rada']];
export type WorkerNavigation = '/profil/lokacija' | '/profil/dostupnost' | '/profil/obavestenja' | '/profil/podaci' | '/podrska';

/**
 * Whether tasks can be offered to you, first. Active is one line with a colored check. A draft is an open section with
 * the two things activation waits for, each marked ready or missing; they are not buttons, because the footer's
 * primary already leads to the first missing one. "Ready" is said only when the route's primary really is the
 * activation (both checks can pass while a change still has to be saved). A
 * suspension says so and offers support.
 */
function ActivationStatus({ status, checks, readyToActivate, disabled, navigate }: {
  status: StanjeProfila | null; checks?: WorkerActivationChecks; readyToActivate: boolean; disabled: boolean;
  navigate: (path: WorkerNavigation) => void;
}) {
  if (status === 'ACTIVE') return <View style={s.activeLine}>
    <FactArt kind="check" size={20} /><T variant="note" style={[s.grow, s.ink]}>Profil je aktivan</T>
  </View>;
  // Moderation wording is one word in the whole app: "suspendovan" (owner, 2026-10-07).
  if (status === 'SUSPENDED') return <View style={[s.status, s.suspended]}>
    <T variant="bodyStrong" style={s.danger}>Profil je trenutno suspendovan</T>
    <T variant="note" style={s.ink}>Dok traje suspenzija, zadaci ti se ne nude.</T>
    <V2Action tone="neutral" label="Obrati se podršci" kind="quiet" compact disabled={disabled} onPress={() => navigate('/podrska')} style={s.start} />
  </View>;
  const draft = status === 'DRAFT';
  return <View style={s.status}>
    <View style={s.titleLine}><View style={s.dot} />
      <T variant="bodyStrong" style={[s.grow, s.ink]}>{draft ? 'Radni profil je još nacrt' : 'Radni profil još nije podešen'}</T></View>
    <T variant="note" tone="muted">{draft ? 'Dok je nacrt, zadaci ti se ne nude.' : 'Bez njega ne možeš da se prijaviš na zadatak.'}</T>
    {checks ? <View style={s.checklist}>{CHECKS.map(([key, label]) => <View key={key} accessible
      accessibilityLabel={`${label}: ${checks[key] ? 'spremno' : 'nedostaje'}`} style={s.checkItem}>
      {checks[key] ? <FactArt kind="check" size={20} /> : <View style={s.emptyCheck} />}
      <T variant="note" style={[s.grow, s.ink]}>{label}</T>
    </View>)}</View> : null}
    {draft && readyToActivate ? <T variant="note" tone="muted">Sve je spremno za aktivaciju.</T> : null}
  </View>;
}

export type WorkerProfileFocusRequest = { target: 'skill' | 'tool' | 'vehicle'; token: number };
/**
 * AI is the main setup route. The same owned draft, save/readback and navigation guards govern manual corrections.
 *
 * `reading` (M3; the product draft the owner approved on 8 Oct 2026, P3) draws the saved profile for reading (`WorkerProfileSaved`): the card others see, the
 * rows "Šta radiš", "Gde", "Kada" and "Oprema", and the white "Popuni uz asistenta". A row that changes something answers with `onEditPart`, which the route
 * turns into this form drawn again without `reading`, with that part's section open (`openSection`, which opens it without putting the keyboard up). `face`,
 * `rating` and `availableNow` are the card's face and rating line and the switch "Mogu odmah" (the route saves it).
 *
 * ONE NAME (owner, 8 Oct 2026, "Može, dobro vam jedno ime za sve."): there is no field for the name here any more. The person's name is the
 * account's (`accountName`), which "Lični podaci" changes, and the work profile takes it. It is said where it was typed, as a fact of the account;
 * and while the work profile still carries another name, the difference is said quietly with its one button, "Koristi „<ime naloga>“"
 * (`onUseAccountName`, the person's own action, never automatic), which goes by itself once the two agree.
 */
export function WorkerProfileForm({ draft, change, disabled, status, navigate, focusRequest, checks, readyToActivate = false, openConversation, profileExists = true,
  reading = false, accountName = null, onUseAccountName, nameWorking = false, onEditPart, face, rating, availableNow, openSection }: {
  draft: WorkerDraft; change: (value: WorkerDraft) => void; disabled: boolean; status: StanjeProfila | null;
  navigate: (path: WorkerNavigation) => void; focusRequest?: WorkerProfileFocusRequest | null;
  checks?: WorkerActivationChecks; readyToActivate?: boolean; openConversation?: () => void; profileExists?: boolean;
  reading?: boolean;
  /** Opens the editor of one part (a row of the read profile). */ onEditPart?: (part: SavedProfilePart) => void;
  /** The face in the card of the read profile. */ face?: ReactNode;
  /** The rating line in that card. */ rating?: ReactNode;
  /** The switch "Mogu odmah" of the read profile. */ availableNow?: AvailableNowControl;
  /** Opens one section of the editor, without a field to type in (a row of the read profile led here). */
  openSection?: { section: 'identity' | 'skills' | 'tools' | 'vehicles'; token: number } | null;
  /** The name of the account, when it could be read. */ accountName?: string | null;
  /** Writes the account's name into the work profile; without it the difference is not offered a way out. */ onUseAccountName?: () => void;
  /** That write is in flight. */ nameWorking?: boolean;
}) {
  const [editing, setEditing] = useState<'identity' | 'skills' | 'tools' | 'vehicles' | null>(null);
  const { stacked } = useLayoutClass();
  const skillRef = useRef<TextInput>(null), toolRef = useRef<TextInput>(null), vehicleRef = useRef<TextInput>(null);
  const focusSection = focusRequest ? { skill: 'skills', tool: 'tools', vehicle: 'vehicles' }[focusRequest.target] as NonNullable<typeof editing> : null;
  useEffect(() => {
    if (!focusRequest || disabled) return;
    setEditing(focusSection);
  }, [focusRequest, focusSection, disabled]);
  useEffect(() => { if (openSection) setEditing(openSection.section); }, [openSection]);
  useEffect(() => {
    if (!focusRequest || disabled || editing !== focusSection) return;
    ({ skill: skillRef, tool: toolRef, vehicle: vehicleRef }[focusRequest.target].current)?.focus?.();
  }, [editing, focusRequest, focusSection, disabled]);
  const patch = (value: Partial<WorkerDraft>) => { if (!disabled) change({ ...draft, ...value }); };
  const toggle = (key: NonNullable<typeof editing>) => { if (!disabled) setEditing(editing === key ? null : key); };
  const grad = draft.grad.trim() ? cityLabel(draft.grad) : '';
  const area = grad ? (draft.radius ? `${grad} · ${draft.radius} km` : grad) : 'Izaberi gde želiš da radiš';
  // Before a profile exists, the footer owns the single conversation action.
  // Required activation checks belong to the saved draft, not a warning before setup.
  const firstSetup = !profileExists && status === null && !!openConversation;
  // The name this profile is read under: the account's, and the profile's own only while the account's cannot be read.
  const name = accountName?.trim() || draft.ime.trim();
  const difference = namesDiffer(draft.ime, accountName) && onUseAccountName
    ? <NameDifference workName={draft.ime} accountName={accountName!} disabled={disabled || nameWorking} working={nameWorking} onUse={onUseAccountName} /> : null;
  if (reading && onEditPart) return <WorkerProfileSaved draft={draft} disabled={disabled} navigate={navigate} openConversation={openConversation}
    onEditPart={onEditPart} face={face} rating={rating} availableNow={availableNow}
    accountName={accountName} onUseAccountName={onUseAccountName} nameWorking={nameWorking}
    status={<ActivationStatus status={status} checks={checks} readyToActivate={readyToActivate} disabled={disabled} navigate={navigate} />} />;
  return <View style={s.form}>
    {firstSetup ? <View style={s.setupIntro}>
      <ConversationArt size={96} />
      <T variant="heading" accessibilityRole="header" style={s.ink}>Ispričaj čime se baviš</T>
      <T variant="note" tone="muted">Veštine, oprema i područje rada — kroz razgovor.</T>
    </View> : <ActivationStatus status={status} checks={checks} readyToActivate={readyToActivate} disabled={disabled} navigate={navigate} />}
    {openConversation && !firstSetup ? <Surface kind="record" onPress={disabled ? undefined : openConversation} accessibilityLabel="Uredi profil kroz razgovor"
      accessibilityHint="Razgovor o zadacima, alatu, vozilima i području rada." style={s.conversationEntry}>
      <View style={[s.conversationCopy, stacked && s.conversationCopyStacked]}>
        <ConversationArt size={64} />
        <View style={s.grow}>
          <T variant="heading" tone={disabled ? 'muted' : 'ink'}>Ispričaj čime se baviš</T>
          <T variant="note" tone="muted">Veštine, zadaci i oprema — kroz razgovor.</T>
        </View>
      </View>
      <View style={s.conversationBottom}><T variant="bodyStrong" style={s.ink}>Uredi kroz razgovor</T>
        <View style={s.arrow}><Glyph name="caret-right" /></View></View>
    </Surface> : null}
    {difference}
    <ProfileSection title="O meni" summary={[name, draft.biografija].filter(Boolean).join('\n')}
      summaryContent={name ? <View style={s.identityCopy}><T variant="title" accessibilityRole="header">{name}</T>
        {draft.biografija ? <ProfileSummary text={draft.biografija} label="O meni" muted /> : null}</View> : undefined}
      empty="Dodaj nekoliko reči o svom iskustvu." open={editing === 'identity'} toggle={() => toggle('identity')} disabled={disabled}>
      <Field label="O meni" value={draft.biografija} change={biografija => patch({ biografija })} disabled={disabled} multiline />
    </ProfileSection>
    <ProfileSection title="Veštine i usluge" summary={draft.vestine.join(' · ')}
      empty="Koje zadatke možeš da preuzmeš?" open={editing === 'skills'} toggle={() => toggle('skills')} disabled={disabled}>
      <TermsEditor label="Veštine i usluge" placeholder="Dodaj veštinu ili uslugu" values={draft.vestine} pending={draft.newSkill}
        setPending={newSkill => patch({ newSkill })} change={(vestine, clear) => patch({ vestine, ...(clear ? { newSkill: '' } : {}) })}
        disabled={disabled} inputRef={skillRef} />
    </ProfileSection>
    <SettingsGroup>
      <SettingsRow label="Područje rada" detail={area} icon={<FactArt kind="pin" size={32} />} disabled={disabled}
        onPress={() => navigate('/profil/lokacija')} />
      <SettingsRow label="Dostupnost" icon={<ClockArt size={32} quiet={disabled} />} disabled={disabled} onPress={() => navigate('/profil/dostupnost')}
        detail={availabilityRowDetail(draft.dostupanOdmah)} />
      <SettingsRow label="Obaveštenja o zadacima" icon={<FactArt kind="bell" size={32} />}
        disabled={disabled} last onPress={() => navigate('/profil/obavestenja')} />
    </SettingsGroup>
    <ProfileSection title="Alat i oprema" summary={draft.alati.join(' · ')}
      empty="Dodaj opremu koju možeš da poneseš." open={editing === 'tools'} toggle={() => toggle('tools')} disabled={disabled}>
      <TermsEditor label="Alat i oprema" placeholder="Dodaj alat ili opremu" values={draft.alati} pending={draft.newTool}
        setPending={newTool => patch({ newTool })} change={(alati, clear) => patch({ alati, ...(clear ? { newTool: '' } : {}) })} disabled={disabled} inputRef={toolRef} />
    </ProfileSection>
    <ProfileSection title="Vozila" summary={draft.vozila.join(' · ')}
      empty="Dodaj vozilo ako ga koristiš za zadatke." open={editing === 'vehicles'} toggle={() => toggle('vehicles')} disabled={disabled}>
      <TermsEditor label="Vozila" placeholder="Dodaj vozilo" values={draft.vozila} pending={draft.newVehicle}
        setPending={newVehicle => patch({ newVehicle })} change={(vozila, clear) => patch({ vozila, ...(clear ? { newVehicle: '' } : {}) })} disabled={disabled} inputRef={vehicleRef} />
    </ProfileSection>
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 }, shrink: { flexShrink: 1 },
  ink: { color: sys.color.ink }, danger: { color: sys.color.danger }, center: { textAlign: 'center' },
  start: { alignSelf: 'flex-start' },
  content: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, gap: layout.section, paddingBottom: layout.zone },
  footer: { paddingHorizontal: layout.gutter, paddingVertical: sys.space.md, gap: sys.space.sm, borderTopWidth: ruleWidth, borderColor: sys.color.line,
    backgroundColor: sys.color.surface },
  footerAside: { display: 'none' },
  // While typing, a footer that keeps its answer draws no strip of its own: an empty one would sit on the keyboard.
  footerTyping: { paddingVertical: 0, borderTopWidth: 0, gap: 0 },
  answer: { gap: sys.space.sm }, answerTyping: { paddingVertical: sys.space.md },
  form: { gap: layout.section },
  editor: { gap: sys.space.base },
  setupIntro: { gap: sys.space.md, paddingTop: sys.space.sm, paddingBottom: sys.space.xl },
  conversationEntry: { gap: sys.space.base },
  conversationCopy: { flexDirection: 'row', alignItems: 'center', gap: sys.space.base },
  conversationCopyStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  conversationBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.md },
  arrow: { width: 36, height: 36, borderRadius: sys.radius.pill, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center' },
  identityCopy: { gap: 8 },
  summary: { gap: sys.space.xs },
  showMore: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  summaryLink: { color: sys.color.ink, textDecorationLine: 'underline' },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Activation requirements are an open reading section; suspension keeps its meaningful warning surface.
  status: { gap: sys.space.md },
  suspended: { backgroundColor: sys.color.dangerSoft, padding: sys.space.base, borderRadius: sys.radius.control },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  dot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  checklist: { gap: sys.space.xs },
  checkItem: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  emptyCheck: { width: 20, height: 20, borderRadius: sys.radius.pill, borderWidth: 1.5, borderColor: sys.color.lineStrong },
  section: { gap: sys.space.md },
  field: { gap: sys.space.sm },
  input: { ...field },
  multiline: { minHeight: 96, textAlignVertical: 'top' }, inputLocked: { backgroundColor: sys.color.wash, color: sys.color.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: layout.touch, maxWidth: '100%', paddingHorizontal: sys.space.md, paddingVertical: sys.space.sm,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.wash },
  chipText: { color: sys.color.ink, fontWeight: '500', flexShrink: 1 },
  addRow: { flexDirection: 'row', gap: sys.space.sm, alignItems: 'center' },
  addRowStacked: { flexDirection: 'column', alignItems: 'stretch' },
  addInputStacked: { alignSelf: 'stretch' },
  add: { minWidth: 72 },
  addStacked: { alignSelf: 'flex-end' },
});
