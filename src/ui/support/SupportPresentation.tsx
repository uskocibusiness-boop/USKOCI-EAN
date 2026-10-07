import type { ReactElement, ReactNode, Ref } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type RefreshControlProps,
  type ScrollView as ScrollViewType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SupportChannel, SupportStatus } from '../../data/supportCaseTypes';
import { vreme } from '../../lib/vreme';
import { InlineNote, QuietLine } from '../privacy/InlineNote';
import { Press } from '../Press';
import { withInter } from '../interFont';
import { SettingsAction, SettingsScreen, SettingsText as T } from '../settings/SettingsPresentation';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { TurningCaret } from '../system/Disclosure';
import { ScreenChrome } from '../system/ScreenChrome';
import { StateView } from '../system/StateView';
import { STATUS_TONES, StatusMark, type StatusShape, type StatusTone } from '../system/StatusChip';
import { cardCompact, field, inset, sys } from '../system/tokens';

const supportLabels = {
  // The five states of a request, in the words of its chip (the same on the list and on the request). A request nobody has taken
  // up yet "čeka pregled": it says no more than is true, and it does not say that somebody is already working on it.
  RECEIVED: 'Čeka pregled', IN_REVIEW: 'U obradi', WAITING_FOR_AUTHOR: 'Čeka tvoju dopunu',
  DECIDED: 'Odgovoreno', CLOSED: 'Zatvoren',
  SERVICE: 'USKOČI podrška', TASK: 'Pomoć oko zadatka', LEGAL_PRIVACY: 'Sadržaj i privatnost', SAFETY: 'Privatna bezbednosna prijava',
  TECHNICAL: 'Tehnička pomoć', SERVICE_COMPLAINT: 'Reklamacija na USKOČI uslugu', OTHER: 'Drugo',
  COLLABORATION: 'Pomoć oko saradnje', NO_SHOW: 'Prijava nedolaska', PUBLICATION_REVIEW: 'Pregled odluke o objavi',
  CONTENT_NOTICE: 'Prijava sadržaja ili recenzije', PRIVACY_RIGHTS: 'Privatnost i prava', SAFETY_REPORT: 'Bezbednost',
  AUTHOR: 'Podnosilac', OPERATOR: 'Operater', SYSTEM: 'USKOČI',
  CREATED: 'Zahtev je primljen', CREATE: 'Zahtev je primljen', AUTHOR_REPLY: 'Dopuna zahteva',
  CLAIM: 'Predmet je preuzet', OPERATOR_REPLY: 'Odgovor operatera', REQUEST_INFO: 'Zahtev za dopunu',
  DECIDE: 'Odluka o zahtevu', APPEAL: 'Zahtev za ponovni pregled', CLAIM_APPEAL: 'Ponovni pregled je preuzet',
  DECIDE_APPEAL: 'Odluka posle ponovnog pregleda', CLOSE: 'Predmet je zatvoren',
  ACCEPTED: 'Zahtev je prihvaćen', REJECTED: 'Zahtev je odbijen',
} as const;
export const supportLabel = (value: string) => supportLabels[value as keyof typeof supportLabels] ?? 'Događaj u predmetu';
export function supportTime(value: string) {
  return vreme(value, { inace: 'Vreme nije dostupno' });
}

export function SupportFrame({ title, onBack, children, footer }: {
  title: string; onBack: () => void; children: ReactNode; footer?: ReactNode;
}) {
  return <KeyboardAvoidingView style={supportStyles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SettingsScreen title={title} onBack={onBack} footer={footer}>{children}</SettingsScreen>
  </KeyboardAvoidingView>;
}

/**
 * The conversation frame of one case: the detail chrome (arrow, the case's own title, its number under it), a strip with
 * its state, the thread, and the composer area pinned under it. The keyboard lifts the composer as on Poruke.
 */
export function SupportThreadFrame({ title, subtitle, onBack, strip, refresh, scrollRef, onContentSizeChange, composer, children }: {
  title: string; subtitle?: string; onBack: () => void; strip?: ReactNode;
  refresh?: ReactElement<RefreshControlProps>; scrollRef?: Ref<ScrollViewType>;
  onContentSizeChange?: (width: number, height: number) => void; composer?: ReactNode; children: ReactNode;
}) {
  return <SafeAreaView edges={['top', 'bottom']} style={supportStyles.screen}>
    <KeyboardAvoidingView style={supportStyles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenChrome variant="detail" onBack={onBack} title={title} subtitle={subtitle} />
      {strip ? <View style={supportStyles.strip}>{strip}</View> : null}
      <ScrollView ref={scrollRef} style={supportStyles.fill} contentContainerStyle={supportStyles.thread} keyboardShouldPersistTaps="handled"
        refreshControl={refresh} onContentSizeChange={onContentSizeChange}>{children}</ScrollView>
      {composer ? <View style={supportStyles.composerArea}>{composer}</View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/** A note in the flow. `info` is the quiet wash, `warn` waits for the person, `danger` failed. Never a card. */
export function SupportNote({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'danger'; children: ReactNode }) {
  return <InlineNote tone={tone === 'info' ? 'neutral' : tone} alert={tone !== 'info'}>{children}</InlineNote>;
}
/** The older name of the same note, kept for the callers that say `error`. */
export function SupportNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <SupportNote tone={error ? 'danger' : 'info'}>{children}</SupportNote>;
}
export function SupportLoading() {
  return <StateView kind="loading" title="Učitavamo sačuvano stanje…" skeleton={{ count: 3, rows: 2 }} />;
}
export function SupportPrivacy({ safety = false }: { safety?: boolean }) {
  return <QuietLine art="shield">{safety
    ? 'Ovaj predmet je privatan. Prijavljena osoba i grupa ne dobijaju sadržaj tvoje prijave.'
    : 'Zahtev vide podnosilac i posebno ovlašćeni operater. Sadržaj se ne prosleđuje drugoj strani u saradnji.'}</QuietLine>;
}
export function SupportField({ label, value, onChange, maximum, disabled = false, multiline = false, optional = false }: {
  label: string; value: string; onChange: (value: string) => void; maximum: number; disabled?: boolean; multiline?: boolean; optional?: boolean;
}) {
  const count = Array.from(value).length, invalid = count > maximum;
  // The count is noise until it matters: it appears from 80% of the limit, and always when the text is too long.
  const counted = invalid || count >= maximum * 0.8;
  return <View style={supportStyles.field}>
    <T variant="bodyStrong">{label}{optional ? ' (opciono)' : ''}</T>
    <TextInput accessibilityLabel={label} accessibilityHint={`Najviše ${maximum} znakova`} value={value}
      onChangeText={onChange} editable={!disabled} multiline={multiline} maxLength={maximum * 2}
      autoCapitalize="sentences" textAlignVertical={multiline ? 'top' : 'center'} placeholderTextColor={sys.color.muted}
      style={[supportStyles.input, multiline && supportStyles.multiline, invalid && supportStyles.invalid, disabled && supportStyles.inputDisabled]} />
    {counted ? <T variant="meta" tone={invalid ? 'danger' : 'muted'} accessibilityLiveRegion={invalid ? 'polite' : 'none'}>
      {count} / {maximum}{invalid ? ' · Skrati tekst pre slanja.' : ''}
    </T> : null}
  </View>;
}
/** Which of the three recovery commands runs now, so only its own button shows the spinner (round 5c review). */
export type SupportRecoveryWorking = 'read' | 'cancel' | 'replay' | null;
export function SupportRecovery({ busy, absent, working = null, onRead, onCancel, onReplay }: {
  busy: boolean; absent: boolean; working?: SupportRecoveryWorking; onRead: () => void; onCancel: () => void; onReplay?: () => void;
}) {
  return <View style={supportStyles.recovery}>
    <InlineNote tone="warn" alert>
      <T variant="bodyStrong" accessibilityRole="header">Najpre proveri prethodno slanje</T>
      <T variant="note">{absent ? 'Potvrda još nije pronađena. Prethodni zahtev i dalje može da stigne.'
        : 'Ishod prethodne radnje nije potvrđen. Novo slanje je zaustavljeno dok ne proveriš stanje.'}</T>
      <T variant="note" tone="muted">Provera ne šalje ponovo tekst. Zaustavljanje važi samo za ovu radnju; ne briše ranije primljen predmet.</T>
    </InlineNote>
    <View style={supportStyles.recoveryActions}>
      <SettingsAction kind="secondary" label="Proveri ishod" disabled={busy} loading={working === 'read'} onPress={onRead} />
      <SettingsAction label="Zaustavi prethodno slanje" kind="quiet" disabled={busy} loading={working === 'cancel'} onPress={onCancel} />
      {onReplay || working === 'replay' ? <SettingsAction label="Pošalji ponovo" kind="quiet" disabled={busy || !onReplay}
        loading={working === 'replay'} onPress={onReplay ?? (() => {})} /> : null}
    </View>
  </View>;
}

/**
 * The state of a request as the app's one kind of chip (plan 2.2: a mark and a word, never colour alone): the shape says
 * the phase, the tone says whose move it is. Waiting for the person is the one orange tone (it asks something of them);
 * a request that is being looked at goes green; a received one waits for someone else and a closed one is grey. DECIDED
 * does not say whether the request was accepted or rejected, so it is a settled mark in the neutral tone. The shared
 * `StatusChip` has no key for a support request (its table is for tasks and applications), so this draws the same chip
 * from the same mark and the same tones, with the request's own five words.
 */
const chipLook: Record<SupportStatus, { shape: StatusShape; tone: StatusTone }> = {
  RECEIVED: { shape: 'ring', tone: 'neutral' }, IN_REVIEW: { shape: 'dot', tone: 'green' },
  WAITING_FOR_AUTHOR: { shape: 'dot', tone: 'attention' }, DECIDED: { shape: 'check', tone: 'neutral' },
  CLOSED: { shape: 'dash', tone: 'grey' },
};
export function SupportStatusChip({ status }: { status: SupportStatus }) {
  const look = chipLook[status] ?? chipLook.RECEIVED, palette = STATUS_TONES[look.tone], word = supportLabel(chipLook[status] ? status : 'RECEIVED');
  return <View testID="status-chip" accessible accessibilityRole="text" accessibilityLabel={word}
    style={[supportStyles.chip, { backgroundColor: palette.ground }]}>
    <StatusMark shape={look.shape} tone={look.tone} />
    <T variant="label" style={[supportStyles.chipText, { color: palette.word }]}>{word}</T>
  </View>;
}

const channelArt: Record<SupportChannel, FactArtKind> = { SERVICE: 'support', TASK: 'support', LEGAL_PRIVACY: 'lock', SAFETY: 'shield' };
/**
 * One request in the list: what it is about (the name), its state, when it last moved and its number. The number is
 * shown before the time (round 5 review): two requests on the same topic differ by it, and it is the number the
 * confirmation ("Potvrđen zahtev #12") and the request's own screen ("Zahtev #12") name. News is an orange dot, a shape
 * that is there or not (never a colour change alone); a screen reader hears it as the word "novo".
 */
export function SupportCaseRow({ topic, status, channel, time, caseNumber, unread, disabled, last, onPress }: {
  topic: string; status: SupportStatus; channel: SupportChannel; time: string; caseNumber: string; unread: boolean;
  disabled: boolean; last: boolean; onPress: () => void;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={`${topic}, ${supportLabel(status)}${unread ? ', novo' : ''}, ${time}, zahtev #${caseNumber}`}
    accessibilityState={{ disabled }} disabled={disabled} haptic={disabled ? 'none' : 'select'} scaleTo={0.99} onPress={onPress}
    style={[supportStyles.caseRow, !last && supportStyles.rowLine]}>
    <View style={supportStyles.caseArt}><FactArt kind={channelArt[channel] ?? 'support'} size={24} cut="art" muted={disabled} /></View>
    <View style={supportStyles.caseCopy}>
      {/* A row that cannot be opened now (a read is running) draws its words in the muted ink, readable at 5:1, never as a faded ghost. */}
      <T variant="bodyStrong" tone={disabled ? 'muted' : 'ink'} numberOfLines={2}>{topic}</T>
      <View style={supportStyles.caseMeta}>
        <SupportStatusChip status={status} />
        {/* The number first: the time already holds a " · " of its own, so "#71 · 24. sep · 12:00" reads as two parts. */}
        <T variant="meta" tone="muted" style={supportStyles.tabular}>{`#${caseNumber} · ${time}`}</T>
      </View>
    </View>
    <View style={supportStyles.caseEnd}>
      {unread ? <View style={supportStyles.unread} /> : null}
      <Glyph name="caret-right" tone="muted" />
    </View>
  </Press>;
}

/** The selected topic stays visible; its existing radio choices open only on explicit request. */
export function SupportTopicDisclosure({ selectedLabel, expanded, disabled, onToggle, children }: {
  selectedLabel: string; expanded: boolean; disabled: boolean; onToggle: () => void; children: ReactNode;
}) {
  return <View>
    <Press accessibilityRole="button" accessibilityLabel="Tema zahteva" accessibilityValue={{ text: selectedLabel }}
      accessibilityHint={expanded ? 'Zatvori izbor teme.' : 'Prikaži teme zahteva.'}
      accessibilityState={{ expanded, disabled }} disabled={disabled} haptic={disabled ? 'none' : 'select'} scaleTo={sys.motion.scale.row}
      onPress={() => { if (!disabled) onToggle(); }}
      style={[supportStyles.topicToggle, expanded && supportStyles.rowLine]}>
      <T variant="bodyStrong" tone={disabled ? 'muted' : 'ink'} style={supportStyles.grow}>{selectedLabel}</T>
      <TurningCaret open={expanded} />
    </Press>
    {expanded ? children : null}
  </View>;
}

/**
 * One choice among several: a radio (one topic, one outcome) or a checkbox (which evidence). The control is drawn, the
 * state is spoken, and the whole row is the touch target (at least 56 high).
 */
export function SupportChoiceRow({ kind, label, detail, selected, disabled = false, last = false, onPress }: {
  kind: 'radio' | 'check'; label: string; detail?: string; selected: boolean; disabled?: boolean; last?: boolean; onPress: () => void;
}) {
  const radio = kind === 'radio';
  return <Press accessibilityRole={radio ? 'radio' : 'checkbox'} accessibilityLabel={label} accessibilityHint={detail}
    accessibilityState={{ checked: selected, disabled }} disabled={disabled} haptic={disabled ? 'none' : 'select'} scaleTo={0.99}
    onPress={onPress} style={[supportStyles.choice, !last && supportStyles.rowLine]}>
    <View style={[radio ? supportStyles.radio : supportStyles.check, selected && (radio ? supportStyles.radioOn : supportStyles.checkOn)]}>
      {selected ? radio ? <View style={supportStyles.radioDot} /> : <Glyph name="check" size={16} tone="onGreen" /> : null}
    </View>
    <View style={supportStyles.choiceCopy}>
      <T variant={selected ? 'bodyStrong' : 'body'} tone={disabled ? 'muted' : 'ink'}>{label}</T>
      {detail ? <T variant="note" tone="muted">{detail}</T> : null}
    </View>
  </Press>;
}

/**
 * One message of the case. Mine sits on the right on the pale green, the other side's on the left on white with the
 * card's edge, as on Poruke; a run of one author keeps close, a turn opens a little air.
 */
export function SupportBubble({ mine, sender, kindLabel, body, time, first, children }: {
  mine: boolean; sender?: string; kindLabel?: string; body: string; time: string; first: boolean; children?: ReactNode;
}) {
  return <View style={[supportStyles.bubbleColumn, mine ? supportStyles.mineColumn : supportStyles.theirsColumn, { marginTop: first ? 12 : 4 }]}>
    {sender && !mine && first ? <T variant="meta" tone="muted" style={supportStyles.sender}>{sender}</T> : null}
    <View style={[supportStyles.bubble, mine ? supportStyles.mine : supportStyles.theirs]}>
      {kindLabel ? <T variant="meta" tone="muted">{kindLabel}</T> : null}
      <T selectable style={supportStyles.bubbleText}>{body}</T>
      <T variant="meta" tone="muted" style={supportStyles.bubbleTime}>{time}</T>
    </View>
    {children}
  </View>;
}
/** A change of state in the thread, said once and quietly in the middle. */
export function SupportSystemLine({ children }: { children: string }) {
  return <T variant="meta" tone="muted" style={supportStyles.system}>{children}</T>;
}
/** A decision where it happened: a block across the thread, its outcome in words, and what it does not change. */
export function SupportDecisionBlock({ reconsideration, outcome, explanation, time, children }: {
  reconsideration: boolean; outcome: string; explanation: string; time: string; children?: ReactNode;
}) {
  return <View style={supportStyles.decision}>
    <View style={supportStyles.decisionHead}><FactArt kind="document" size={22} />
      <T variant="bodyStrong" accessibilityRole="header" style={supportStyles.grow}>{reconsideration ? 'Odluka posle ponovnog pregleda' : 'Odluka o zahtevu'}</T></View>
    <T variant="bodyStrong">{supportLabel(outcome)}</T>
    <T selectable>{explanation}</T>
    <T variant="note" tone="muted">{time}</T>
    {reconsideration ? <T variant="note" tone="muted">Ponovni pregled u okviru podrške. Originalna odluka ostaje u istoriji.</T> : null}
    <T variant="note" tone="muted">Ova odluka o zahtevu sama ne menja zadatak, Dogovor, novčani iznos ili ocenu.</T>
    {children}
  </View>;
}

/**
 * The reply field of a case: the pill of Poruke (copied, not imported: the conversation belongs to another unit) with
 * the text and a 48 px send area. The send is green only when there is something to send; otherwise a grey well that
 * says why: an empty field, or the caller's `reason` (a text over the limit). The field takes at most `maxLength`
 * characters, so a huge paste is cut before it is counted on every render (the old field's cap, twice the limit).
 */
export function SupportComposer({ value, onChange, placeholder, editable, canSend, sending, onSend, reason, maxLength }: {
  value: string; onChange: (value: string) => void; placeholder: string; editable: boolean; canSend: boolean; sending: boolean; onSend: () => void;
  /** Why a written text cannot be sent now, spoken as the send area's hint. */ reason?: string | null; maxLength?: number;
}) {
  const empty = !value.trim();
  // The caller's reason wins: a locked, empty field (an unconfirmed reply) is not told to type (round 5c review).
  const why = sending || canSend ? undefined : reason ?? (empty ? 'Unesi tekst pre slanja.' : undefined);
  return <View style={supportStyles.pill}>
    <TextInput accessibilityLabel="Tekst poruke" placeholder={placeholder} placeholderTextColor={sys.color.muted} value={value}
      onChangeText={onChange} editable={editable} multiline textAlignVertical="center" maxLength={maxLength} style={supportStyles.pillInput} />
    <Press accessibilityRole="button" accessibilityLabel="Pošalji poruku" accessibilityHint={why}
      accessibilityState={{ disabled: !canSend || sending, busy: sending }} disabled={!canSend || sending} haptic={canSend ? 'light' : 'none'}
      onPress={onSend} style={supportStyles.sendArea}>
      <View style={[supportStyles.send, canSend || sending ? supportStyles.sendOn : supportStyles.sendOff]}>
        {sending ? <ActivityIndicator size="small" color={sys.color.onGreen} />
          : <Glyph name="send" on tone={canSend ? 'onGreen' : 'muted'} />}
      </View>
    </Press>
  </View>;
}

export const supportStyles = StyleSheet.create({
  fill: { flex: 1 }, grow: { flex: 1, minWidth: 0 }, center: { textAlign: 'center' },
  screen: { flex: 1, backgroundColor: sys.color.ground },
  strip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  thread: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexGrow: 1, justifyContent: 'flex-end', gap: 0 },
  composerArea: { paddingHorizontal: sys.space.md, paddingTop: sys.space.sm, paddingBottom: sys.space.md, gap: sys.space.sm,
    backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line },
  field: { gap: 8, marginBottom: 20 },
  input: { ...field },
  inputDisabled: { backgroundColor: sys.color.wash },
  multiline: { minHeight: 144 }, invalid: { borderColor: sys.color.danger },
  recovery: { gap: 8 },
  recoveryActions: { gap: 4 },
  // The shared chip's measure (StatusChip): the mark, then the word, on the tone's soft ground; never a touch target.
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingVertical: sys.space.xs,
    paddingLeft: sys.space.sm, paddingRight: sys.space.md, borderRadius: sys.radius.pill },
  chipText: { letterSpacing: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  caseRow: { minHeight: 72, paddingVertical: sys.space.md, flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  rowLine: { borderBottomWidth: 1, borderBottomColor: sys.color.line },
  caseArt: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  caseCopy: { flex: 1, minWidth: 0, gap: sys.space.sm },
  // Topic, current state, then reference/time: each has a stable reading line instead of an accidental wrap.
  caseMeta: { alignItems: 'flex-start', gap: sys.space.xs },
  caseEnd: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  unread: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  topicToggle: { minHeight: 56, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  choice: { minHeight: 56, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  choiceCopy: { flex: 1, minWidth: 0, gap: 2 },
  radio: { width: 22, height: 22, borderRadius: sys.radius.pill, borderWidth: 2, borderColor: sys.color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: sys.color.green },
  radioDot: { width: 10, height: 10, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  check: { width: 22, height: 22, borderRadius: sys.radius.check, borderWidth: 2, borderColor: sys.color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: sys.color.green, borderColor: sys.color.green },
  bubbleColumn: { maxWidth: '82%', gap: 4 },
  mineColumn: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirsColumn: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  sender: { paddingHorizontal: 4 },
  bubble: { borderRadius: sys.radius.card, paddingHorizontal: sys.space.md, paddingTop: sys.space.sm, paddingBottom: sys.space.sm, gap: sys.space.xs },
  mine: { backgroundColor: sys.color.greenSoft, borderBottomRightRadius: 8 },
  theirs: { backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.cardLine, borderBottomLeftRadius: 8 },
  bubbleText: { ...sys.type.body, color: sys.color.ink, lineHeight: 22 },
  // The meta token (13 px), not a raw size: the time is a one-word label (round 5 review).
  bubbleTime: { ...sys.type.meta, alignSelf: 'flex-end', fontVariant: ['tabular-nums'] },
  system: { textAlign: 'center', marginVertical: 8 },
  decision: { ...cardCompact, gap: 8, marginTop: 12 },
  decisionHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  summary: { ...inset, backgroundColor: sys.color.wash, gap: 8, marginBottom: 4 },
  pill: { flexDirection: 'row', alignItems: 'flex-end', padding: 4, borderRadius: sys.radius.sheet, backgroundColor: sys.color.wash },
  pillInput: withInter({ flex: 1, minHeight: 48, maxHeight: 140, paddingHorizontal: sys.space.md, paddingTop: sys.space.md, paddingBottom: sys.space.md,
    ...sys.type.body, lineHeight: 22, color: sys.color.ink }),
  sendArea: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  send: { width: 40, height: 40, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  sendOn: { backgroundColor: sys.color.green },
  sendOff: { backgroundColor: sys.color.control },
  pager: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  list: { borderTopWidth: 1, borderTopColor: sys.color.line },
});
