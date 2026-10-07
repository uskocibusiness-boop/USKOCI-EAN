import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight, Minus, Plus } from 'phosphor-react-native';
import type { PotrebaProjekcija, PrilikaProjekcija } from '../../contracts/projections';
import { fixedApplicationPeople, fixedApplicationPrice, needScheduleText, readableTitle } from '../../data/needDetailPresentation';
import { calendarInstant } from '../../lib/calendarTime';
import { novac } from '../../lib/novac';
import { CivilField } from '../calendar/CalendarControls';
import { civilInstant, zonedParts } from '../calendar/calendarPresentation';
import { Press } from '../Press';
import { ProductHeader } from '../product/ProductDetails';
import { ProductSheet } from '../product/ProductSheet';
import { FactArt } from '../system/FactArt';
import { dolaziOsoba, osoba, plural } from '../system/plural';
import { ChromeIconButton } from '../system/ScreenChrome';
import { StateView } from '../system/StateView';
import { StatusChip } from '../system/StatusChip';
import { SuccessMark } from '../system/SuccessMark';
import { useTextScale } from '../system/textScale';
import { brandAction, fieldBox, inset, sys } from '../system/tokens';
import { T } from '../Text';
import { withInter } from '../interFont';
import { CardFact, placesText, taskSpoken, taskValue, valueSpoken } from './TaskFace';
import { V2Action } from './V2Action';

/**
 * The worker's one application to someone else's task (R13, 2026-09-25): a compact task context, one clear amount,
 * people and time as adjacent terms, then the optional message. The review and confirmed result use the same open
 * receipt, including the exact message. White is the reading surface; ink, fact art and the amount establish hierarchy.
 * ONE green action stays at the foot. The existing explicit review stands before sending.
 *
 * Presentation only. Every guard stays in the route (`app/(app)/prilike/[id]/prijava.tsx`): the task revision, the durable
 * journal, the idempotent request id, the unknown-outcome readback and the exact replay. The reasons drawn beside a grey
 * button here only mirror the route's checks for the eye; the route still refuses on its own.
 *
 * Nothing on this screen moves on its own: the fields appear in their final form. The sheets settle with the one sheet
 * engine (still under reduced motion), the success mark springs once when the send was just confirmed, and a working
 * button shows its spinner.
 */
export type ApplicationDraft = { price: string; people: string; note: string; start: string | null; end: string | null };

/** The largest amount the route accepts (a 32-bit integer), so the eye is told the same limit. */
const MAX_PRICE = 2_147_483_647;
const NOTE_LIMIT = 4000;
/** From here the note says how much room is left. */
const NOTE_COUNTER_FROM = 3500;
const SIDE = sys.space.lg;

/** "Zadatak se upravo promenio. Učitaj Prijave ponovo." → the first sentence and the rest; one sentence stays whole. */
export function splitFirstSentence(message: string): [string, string | null] {
  const match = /^(.+?[.!?])\s+(\S[\s\S]*)$/.exec(message.trim());
  return match ? [match[1], match[2]] : [message.trim(), null];
}

/** A whole number of dinars the route would send, or null. */
function wholePrice(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= MAX_PRICE ? amount : null;
}
function wholePeople(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 1 ? count : null;
}

/**
 * What still stands between this draft and its review, said in the words the grey button carries. It mirrors the
 * route's own validation for the eye (whole price 1..2147483647, people 1..the places left); the route stays the one
 * that refuses. `price` and `people` name the field that is wrong, so it can say so where it is.
 */
export type ComposerDraftIssue = { reason: string | null; price: 'missing' | 'empty' | 'invalid' | null; people: 'invalid' | 'over' | null };
export function composerDraftIssue(draft: ApplicationDraft, need: Pick<PotrebaProjekcija, 'rezimCene' | 'ponudjenaCena' | 'osnovaCene' | 'pokrivenost'>): ComposerDraftIssue {
  const offers = need.rezimCene !== 'MY_PRICE';
  const price = offers ? draft.price === '' ? 'empty' : wholePrice(draft.price) === null ? 'invalid' : null
    // The task names its price: missing only when the task itself has none (the route then leaves the price empty).
    : fixedApplicationPrice(need, 1) === null ? 'missing' : null;
  const count = wholePeople(draft.people);
  const people = count === null ? 'invalid' : count > need.pokrivenost.preostalo ? 'over' : null;
  // A per-person total the route could not send (above its 32-bit limit) is said here too, not only after the tap.
  const total = !offers && price === null && count !== null ? fixedApplicationPrice(need, count) : null;
  const tooMuch = !offers && price === null && count !== null && (total === null || total > MAX_PRICE);
  const locked = fixedApplicationPeople(need) !== null;
  // The reason under the grey button is an instruction in the one wording the field beside it uses (r6: the price field
  // and the button said the same error in two sentences; the stepper's count line and the button said the same count).
  const reason = price === 'missing' ? 'Zadatak nema navedenu cenu. Osveži zadatak.'
    : price === 'empty' ? 'Upiši svoju cenu da pregledaš ponudu.'
    : price === 'invalid' ? 'Upiši ceo iznos u dinarima, bez tačaka i slova.'
    : people === 'invalid' ? 'Upiši koliko ljudi dolazi.'
    // A price for the whole task covers every place, so fewer free places cannot be fixed here, only by a fresh read.
    : people === 'over' ? locked ? 'Zadatak više nema sva mesta slobodna. Osveži zadatak.'
      : need.pokrivenost.preostalo > 0 ? `Smanji broj ljudi na ${need.pokrivenost.preostalo} da pregledaš ponudu.` : 'Sva mesta su popunjena. Osveži zadatak.'
    : tooMuch ? 'Ukupan iznos je veći nego što može da se pošalje. Smanji broj ljudi.'
    : null;
  return { reason, price, people };
}

/** An exact window in the one spelling of a task time (`needScheduleText`), or null when it is not a real window. */
function windowText(start: string | null | undefined, end: string | null | undefined, timezone?: string): string | null {
  const from = calendarInstant(start), to = calendarInstant(end);
  if (from === null || to === null || from >= to) return null;
  return needScheduleText({ kind: 'FIXED_WINDOW', startsAt: start!, endsAt: end! }, timezone);
}

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The screen's frame: the bar that says whose application this is, a keyboard-safe body, and the pinned foot. */
function ComposerFrame({ back, children, footer, revealResult = false }: { back: () => void; children: ReactNode; footer?: ReactNode; revealResult?: boolean }) {
  const scroll = useRef<ScrollView>(null);
  // The confirmation replaces a possibly long draft. Show its outcome, not the old scroll position in the note.
  useEffect(() => { if (revealResult) scroll.current?.scrollTo({ y: 0, animated: false }); }, [revealResult]);
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ProductHeader title="Tvoja prijava" backLabel="Nazad na zadatak" back={back} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.grow}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>{children}</ScrollView>
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/**
 * While the read runs, the shape of the task that is coming stands in for it; a read that failed says so the one way
 * every screen does (`StateView`): its first sentence as the title, the rest under it, and the retry as the green action.
 */
export function ComposerUnavailable({ loading, message, retry, back }: { loading: boolean; message: string; retry?: () => void; back: () => void }) {
  const [title, body] = splitFirstSentence(message);
  return <ComposerFrame back={back}>
    {loading ? <StateView kind="loading" title="Učitavamo aktuelne podatke…" skeleton={{ count: 1, rows: 4, variant: 'face' }} />
      : <StateView kind="error" title={title} body={body ?? undefined} primary={retry ? { label: 'Pokušaj ponovo', onPress: retry } : undefined} />}
  </ComposerFrame>;
}

/**
 * Compact context for the offer, heard once and not pressable (Back returns to the task). A fixed price appears only
 * in its own amount section; an offer-taking task keeps its truthful "Tražim ponude" caption. Place and time retain
 * two lines in the receipt. While editing, time and capacity sit beside their controls rather than repeating here.
 */
function TaskHead({ opportunity, showTerms = true }: { opportunity: PrilikaProjekcija; showTerms?: boolean }) {
  const title = readableTitle(opportunity.naslov), value = taskValue(opportunity);
  const places = placesText(opportunity.pokrivenost, 'worker');
  const priced = opportunity.rezimCene === 'MY_PRICE';
  const spoken = !showTerms ? [title, opportunity.podrucjeTekst, priced ? '' : valueSpoken(value)].filter(part => part.trim().length > 0).join(', ')
    : priced ? [title, opportunity.podrucjeTekst, opportunity.vremeTekst, places.spoken].filter(part => part.trim().length > 0).join(', ')
    : `${title}, ${taskSpoken({ value, place: opportunity.podrucjeTekst, schedule: opportunity.vremeTekst, places: places.spoken })}`;
  return <View accessible accessibilityLabel={spoken} style={s.task}>
    <T accessibilityRole="header" style={s.taskTitle}>{title}</T>
    {!priced ? <T variant="note" tone="muted">{valueSpoken(value)}</T> : null}
    <View style={s.taskFacts}>
      <CardFact art={<FactArt kind="pin" size={24} cut="art" />} text={opportunity.podrucjeTekst} lines={2} />
      {showTerms ? <CardFact art={<FactArt kind="calendar" size={24} cut="art" tone="quiet" />} text={opportunity.vremeTekst} lines={2} /> : null}
    </View>
    {showTerms ? <CardFact art={<FactArt kind="users" size={24} cut="art" tone="quiet" />} text={places.text} lines={0} /> : null}
  </View>;
}

/** A question the composer asks, in the words a person would say it; never a small letter-spaced word above a box. */
function Question({ children, optional }: { children: string; optional?: boolean }) {
  return <View style={s.question}>
    <T variant="bodyStrong" style={s.ink}>{children}</T>
    {optional ? <T variant="note" tone="muted">Opciono</T> : null}
  </View>;
}

/**
 * What was sent (or saved to be checked), as read-only facts: never a greyed form. A time the worker proposed says so,
 * with the task's own window beside it (`proposed`), the same word the composer's Termin row uses; otherwise nothing.
 */
function SentFacts({ price, people, time, flexible, proposed }: { price: string | null; people: string; time: string; flexible: boolean; proposed: string | null }) {
  const timeNote = flexible ? 'Tačan početak i kraj još nisu dogovoreni.' : proposed ? `Tvoj predlog · termin zadatka je ${proposed}` : null;
  return <View style={s.receipt}>
    <View accessible accessibilityLabel={`Ukupna ponuda: ${price ?? 'Proveri unetu cenu'}${price ? ', ukupno za sve ljude koje dovodiš' : ''}`} style={s.receiptAmount}>
      <View style={s.receiptLabel}>
        <FactArt kind="money" size={24} cut="art" />
        <T variant="meta" tone="muted">Ukupna ponuda</T>
      </View>
      <T style={price ? s.receiptMoney : s.unknownPrice}>{price ?? 'Proveri unetu cenu'}</T>
      {price ? <T variant="note" tone="muted">Ukupno za sve ljude koje dovodiš</T> : null}
    </View>
    <View accessible accessibilityLabel={`Ljudi: ${people}`} style={s.receiptRow}>
      <FactArt kind="users" size={24} cut="art" tone="quiet" />
      <View style={s.grow}><T variant="meta" tone="muted">Ljudi</T><T variant="bodyStrong" style={s.ink}>{people}</T></View>
    </View>
    <View accessible accessibilityLabel={`Termin: ${time}${timeNote ? `, ${timeNote}` : ''}`} style={s.receiptRow}>
      <FactArt kind="calendar" size={24} cut="art" tone="quiet" />
      <View style={s.grow}>
        <T variant="meta" tone="muted">Termin</T><T variant="bodyStrong" style={s.ink}>{time}</T>
        {timeNote ? <T variant="note" tone="muted">{timeNote}</T> : null}
      </View>
    </View>
  </View>;
}

/** The review, saved intent and confirmed receipt all expose the same trimmed message the command sends. */
function SentMessage({ note }: { note: string }) {
  const message = note.trim();
  return <View style={s.sentMessage}>
    <T accessibilityRole="header" variant="bodyStrong" style={s.ink}>Poruka</T>
    <T selectable variant="body" tone={message ? 'ink' : 'muted'}>{message || 'Bez dodatne poruke.'}</T>
  </View>;
}

/** The exact time of this application, in the one sheet engine; nothing is applied until "Potvrdi termin". */
function ExactTimeSheet({ draft, timezone, taskTime, close, accept }: {
  draft: ApplicationDraft; timezone: string; taskTime: string; close: () => void; accept: (start: string | null, end: string | null) => void;
}) {
  const { width } = useWindowDimensions();
  const scale = useTextScale();
  const [start, setStart] = useState(() => draft.start ? zonedParts(new Date(draft.start), timezone) : { date: '', time: '' });
  const [end, setEnd] = useState(() => draft.end ? zonedParts(new Date(draft.end), timezone) : { date: '', time: '' });
  const [dirtyStart, setDirtyStart] = useState(false), [dirtyEnd, setDirtyEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apply = () => {
    const from = draft.start && !dirtyStart ? { value: draft.start, error: null } : civilInstant(start.date, start.time, timezone);
    const to = draft.end && !dirtyEnd ? { value: draft.end, error: null } : civilInstant(end.date, end.time, timezone);
    if (!from.value || !to.value) { setError(from.error ?? to.error); return; }
    const a = calendarInstant(from.value), b = calendarInstant(to.value);
    if (a === null || b === null || a >= b) { setError('Kraj termina mora biti posle početka.'); return; }
    accept(from.value, to.value);
  };
  // Two fields side by side while both fit; stacked on a narrow phone or at the owner's Large text.
  const paired = width >= 360 && scale < 1.3;
  const row = paired ? s.pair : s.stack;
  const cell = paired ? s.cell : null;
  return <ProductSheet title="Tačan termin" closeLabel="Zatvori izbor termina" dirty={dirtyStart || dirtyEnd} onClose={close}
    footer={() => <>
      <V2Action label="Potvrdi termin" onPress={apply} style={brandAction} />
      <V2Action label="Koristi termin zadatka" kind="quiet" onPress={() => accept(null, null)} />
    </>}>
    {() => <>
      <T variant="meta" tone="muted">{timezone === 'Europe/Belgrade' ? 'Po vremenu u Srbiji.' : `Vremenska zona: ${timezone}.`}</T>
      <T variant="body" style={s.ink}>{`Termin zadatka: ${taskTime}`}</T>
      <View style={row}>
        <View style={cell}><CivilField label="Datum početka" mode="date" value={start.date} onChange={value => { setStart(v => ({ ...v, date: value })); setDirtyStart(true); }} /></View>
        <View style={cell}><CivilField label="Početak" mode="time" value={start.time} onChange={value => { setStart(v => ({ ...v, time: value })); setDirtyStart(true); }} /></View>
      </View>
      <View style={row}>
        <View style={cell}><CivilField label="Datum kraja" mode="date" value={end.date} onChange={value => { setEnd(v => ({ ...v, date: value })); setDirtyEnd(true); }} /></View>
        <View style={cell}><CivilField label="Kraj" mode="time" value={end.time} onChange={value => { setEnd(v => ({ ...v, time: value })); setDirtyEnd(true); }} /></View>
      </View>
      {error ? <T accessibilityRole="alert" variant="note" tone="danger">{error}</T> : null}
    </>}
  </ProductSheet>;
}

/** Composer of one application: what is offered, how many people come, an optional exact time, a short note, one send. */
export function ApplicationComposerPresentation({ need, opportunity, draft, change, submit, back, busy, pending, uncertain, refresh, error, confirmed, openApplications, canSubmit, reset, blocked, pendingHelp, refreshHelps = true, initialSheet }: {
  need: PotrebaProjekcija; opportunity: PrilikaProjekcija; draft: ApplicationDraft; change: (value: ApplicationDraft) => void;
  submit: () => void; back: () => void; busy: boolean; pending: boolean; uncertain: boolean; refresh: () => void;
  error: string | null; confirmed: boolean; openApplications: () => void; canSubmit: boolean; reset?: () => void;
  /** Why the brand action is grey, said next to it, with the one place that fixes it when there is one. */
  blocked?: { reason: string; actionLabel?: string; onAction?: () => void } | null;
  /** Safe guidance beside a frozen/pending command. It never changes or retires that command. */
  pendingHelp?: { lines: readonly string[]; actions: readonly { label: string; onPress: () => void }[] } | null;
  /** False when the error on screen is one a fresh read of the task cannot fix (the phone could not save the request). */
  refreshHelps?: boolean;
  /** A sheet open from the start. Only the internal gallery sets it; the review it opens is still retired by any change. */
  initialSheet?: 'review' | 'time';
}) {
  // The review only stages presentation. The route still validates, journals and sends the command.
  // A changed draft/task cannot be sent through a retained confirmation from the previous review.
  const reviewKey = JSON.stringify([need.id, need.revizija, need.naslov, need.vremeTekst, need.taskTimezone, need.schedule, draft]);
  const [editingTime, setEditingTime] = useState(initialSheet === 'time');
  const [review, setReview] = useState<{ key: string } | null>(() => initialSheet === 'review' ? { key: reviewKey } : null);
  const large = useTextScale() >= 1.3;
  const { width } = useWindowDimensions();
  const stackPeople = large || width < 390;
  const [focused, setFocused] = useState<'price' | 'note' | null>(null);
  // The success mark springs only when the send was confirmed while this screen was open.
  const confirmedAtMount = useRef(confirmed).current;
  // While the keyboard is up the footer keeps only the action and its reason: at 320 dp and Large text the summary
  // would leave almost no room for the field being typed into.
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);
  const reviewing = !!review && review.key === reviewKey && !busy && !pending && !confirmed && canSubmit;
  const liveReview = useRef<typeof review>(null);
  liveReview.current = reviewing ? review : null;
  const closeReview = () => { liveReview.current = null; setReview(null); };
  const confirmReview = () => {
    if (!review || liveReview.current !== review) return;
    closeReview(); submit();
  };
  // A task that no longer takes applications locks the fields too (r6): an offer that can never be sent is not typed into.
  const closed = opportunity.primaNovePrijave !== true;
  const disabled = busy || pending || confirmed || closed;
  const timezone = need.taskTimezone;
  const exact = windowText(draft.start, draft.end, timezone);
  const fixed = need.schedule?.kind === 'FIXED_WINDOW' ? windowText(need.schedule.startsAt, need.schedule.endsAt, timezone) : null;
  const time = exact ?? fixed ?? need.vremeTekst;
  const proposedTaskTime = exact && exact !== fixed ? fixed ?? need.vremeTekst : null;
  const price = wholePrice(draft.price), count = wholePeople(draft.people);
  const shownPrice = price !== null ? novac(price) : null;
  const issue = composerDraftIssue(draft, need);
  const offers = opportunity.rezimCene !== 'MY_PRICE';
  const peopleLocked = fixedApplicationPeople(need) !== null;
  const left = need.pokrivenost.preostalo;
  const shownBlock = !canSubmit && !confirmed && !pending && blocked ? blocked : null;
  // The footer's last branch: nothing sent, nothing uncertain, nothing in flight, so "Pregledaj ponudu" is the action.
  const reviewAction = !confirmed && !uncertain && !pending && !busy;
  // What was sent, or saved to be checked, is shown as facts; a form is shown only while it can be edited.
  const locked = confirmed || pending || uncertain;
  const reviewReason = shownBlock?.reason ?? issue.reason;
  const openReview = () => {
    if (!disabled && canSubmit && !reviewing && !issue.reason && !editingTime) { Keyboard.dismiss(); setReview({ key: reviewKey }); }
  };
  // Every green action is label-only, as the brand action is drawn everywhere else (r6: two of them carried a glyph).
  const primary = confirmed ? <V2Action label="Otvori moje prijave" onPress={openApplications} style={brandAction} />
    : uncertain ? <V2Action label="Proveri ishod" onPress={refresh} disabled={busy} style={brandAction} />
    // A known refusal cannot be undone by repeating the same command: the one way on is a new offer on fresh terms.
    : reset ? <V2Action label="Sastavi novu ponudu" onPress={reset} disabled={busy} style={brandAction} />
    : pending || busy ? <V2Action label={busy ? 'Slanje…' : 'Pošalji ponovo'} onPress={submit} disabled={busy} loading={busy} style={brandAction} />
    : <V2Action label="Pregledaj ponudu" onPress={openReview} disabled={!canSubmit || reviewing || !!issue.reason}
      reason={reviewAction ? reviewReason : null} style={brandAction} />;
  // A reason that names a fresh read of the task has the read under it: the task without its price, or without the
  // places this application would take (a price for the whole task cannot take fewer).
  const refreshFixes = issue.price === 'missing' || (issue.people === 'over' && (peopleLocked || left < 1));
  const summary = shownPrice ? `${shownPrice} ukupno`
    : offers ? draft.price === '' ? 'Cena još nije upisana' : 'Cena nije ispravna'
    : issue.price === 'missing' ? 'Cena nije navedena' : 'Cena zavisi od broja ljudi';
  /** A count stepped by a button is said aloud: the line under the stepper does not change with it. */
  const step = (next: number) => { change({ ...draft, people: String(next) }); AccessibilityInfo.announceForAccessibility(capitalised(dolaziOsoba(next))); };
  const footer = <>
    {error ? <View style={s.notice}>
      <T accessibilityRole="alert" variant="body" style={s.ink}>{error}</T>
      {!pending && refreshHelps ? <V2Action label="Osveži zadatak" kind="quiet" compact onPress={refresh} disabled={busy} style={s.noticeAction} /> : null}
    </View> : null}
    {!locked && !busy && !keyboard ? <View accessible accessibilityLabel={`${summary}, ${count !== null ? dolaziOsoba(count) : 'broj ljudi nije upisan'}`} style={s.summaryRow}>
      <T style={s.summary}>{summary}</T>
      <T variant="note" tone="muted">{count !== null ? dolaziOsoba(count) : 'broj ljudi nije upisan'}</T>
    </View> : null}
    {primary}
    {pendingHelp && !confirmed ? <View style={s.blocked}>
      {pendingHelp.lines.map((line, index) => <T key={`${index}:${line}`} variant="meta" tone="muted" style={s.center}>{line}</T>)}
      {pendingHelp.actions.map(action => <V2Action key={action.label} kind="quiet" compact label={action.label}
        onPress={action.onPress} disabled={busy} />)}
    </View> : null}
    {/* A task read without its price (or its places) is fixed by a fresh read, so the way to it stands under the grey button. */}
    {reviewAction && !shownBlock && !error && refreshFixes ? <V2Action label="Osveži zadatak" kind="quiet" compact onPress={refresh} /> : null}
    {/* A grey button with nothing beside it is a dead end; the reason stands under it, with the way out. On the review
        button the reason is the button's own line (and its spoken hint); beside the other actions it stands here. */}
    {shownBlock && (!reviewAction || !!(shownBlock.actionLabel && shownBlock.onAction)) ? <View style={s.blocked}>
      {reviewAction ? null : <T accessibilityLiveRegion="polite" variant="meta" tone="muted" style={s.center}>{shownBlock.reason}</T>}
      {shownBlock.actionLabel && shownBlock.onAction ? <V2Action kind="quiet" compact label={shownBlock.actionLabel} onPress={shownBlock.onAction} /> : null}
    </View> : null}
  </>;
  const sentFacts = <SentFacts price={shownPrice} people={count !== null ? osoba(count) : 'Proveri broj ljudi'} time={time} flexible={!exact && !fixed}
    proposed={proposedTaskTime} />;
  const noteLeft = NOTE_LIMIT - draft.note.length;
  return <ComposerFrame back={back} footer={footer} revealResult={confirmed}>
    {/* A real confirmation is the first thing on the resulting screen, not below the old form's task summary. */}
    {confirmed ? <View style={s.section}>
      <View style={s.outcome}>
        <SuccessMark fresh={!confirmedAtMount} size={72} />
        {/* Announced when it has just happened; reopened on a send already confirmed it is the screen's heading. */}
        <T accessibilityRole={confirmedAtMount ? 'header' : 'alert'} style={s.resultTitle}>Prijava je poslata.</T>
        {/* The state the application will wear in "Moje prijave" from now on: the same chip, so the receipt and the list say one word. */}
        <StatusChip status="application.sent" />
        <T variant="copy" tone="muted">Ako tvoja ponuda bude izabrana, odmah nastaje Dogovor. Prijavu pratiš u Mojim prijavama.</T>
      </View>
      <TaskHead opportunity={opportunity} />
      {sentFacts}
      <SentMessage note={draft.note} />
    </View> : <>
    <TaskHead opportunity={opportunity} showTerms={locked} />
    {locked ? <View style={s.section}>
      {/* The receipt names its amount, people and time once, without another summary heading. */}
      {sentFacts}
      <SentMessage note={draft.note} />
      {/* After a known refusal the same offer is not repeated, so the sentence about repeating it is not said. */}
      {!reset ? <T variant="meta" tone="muted">Termin, cena i broj ljudi ostaju isti.</T> : null}
    </View> : <>
      <View style={s.section}>
        {offers ? <>
          <View style={s.amountHeading}>
            <FactArt kind="money" size={24} cut="art" />
            <Question>Tvoja ukupna ponuda</Question>
          </View>
          <View style={[s.priceBox, focused === 'price' && s.fieldFocused, issue.price === 'invalid' && s.fieldDanger]}>
            <TextInput accessibilityLabel="Tvoja ukupna ponuda za ljude koje dovodiš (RSD)" keyboardType="number-pad" maxLength={10} value={draft.price}
              editable={!disabled} style={s.priceInput} placeholder="Iznos" placeholderTextColor={sys.color.muted}
              onFocus={() => setFocused('price')} onBlur={() => setFocused(null)}
              accessibilityHint={issue.price === 'invalid' ? 'Upiši ceo iznos u dinarima, bez tačaka i slova.' : undefined}
              onChangeText={value => { if (!disabled) change({ ...draft, price: value }); }} />
            <T variant="bodyStrong" tone="muted" accessible={false}>RSD</T>
          </View>
          {issue.price === 'invalid' ? <T variant="note" tone="danger">Upiši ceo iznos u dinarima, bez tačaka i slova.</T> : null}
          <T variant="note" tone="muted">Za sve ljude koje dovodiš.</T>
        </> : <FixedPrice need={need} />}
      </View>
      <View style={s.terms}>
      <View style={[s.peopleRow, stackPeople && s.peopleStacked]}>
        <View style={[s.peopleQuestion, stackPeople && s.unflex]}>
          <FactArt kind="users" size={24} cut="art" tone="quiet" />
          <View style={s.grow}>
            <Question>Koliko ljudi dolazi</Question>
            <T variant="note" tone={issue.people === 'over' ? 'danger' : 'muted'} accessibilityLiveRegion="polite">
              {placesText(need.pokrivenost, 'worker').text}</T>
          </View>
        </View>
        {/* A whole-task price fixes the count; show that count as a fact, never an editable control. */}
        {peopleLocked ? <View accessible accessibilityLabel={`Koliko ljudi dolazi: ${capitalised(dolaziOsoba(fixedApplicationPeople(need)!))}, cena važi za ceo zadatak`} style={[s.lockedPeople, stackPeople && s.unflex]}>
          <View style={s.grow}>
            <T variant="bodyStrong" style={s.ink}>{capitalised(dolaziOsoba(fixedApplicationPeople(need)!))}</T>
          </View>
        </View> : <View style={[s.stepper, stackPeople && s.stepperStacked]}>
            <ChromeIconButton label="Jedna osoba manje" icon={Minus} disabled={disabled || count === null || count <= 1}
              onPress={() => { if (!disabled && count !== null && count > 1) step(count - 1); }} />
            <TextInput accessibilityLabel="Koliko ljudi dolazi" keyboardType="number-pad" maxLength={4} value={draft.people} editable={!disabled}
              style={[s.peopleInput, large && s.peopleInputLarge, issue.people === 'over' && s.fieldDanger]}
              onChangeText={value => { if (!disabled) change({ ...draft, people: value }); }} />
            <ChromeIconButton label="Jedna osoba više" icon={Plus} disabled={disabled || (count !== null ? count >= left : left < 1)}
              onPress={() => { const next = count === null ? 1 : count + 1; if (!disabled && next <= left) step(next); }} />
          </View>}
      </View>
        <Press accessibilityRole="button" accessibilityLabel="Termin prijave" accessibilityHint="Otvara izbor tačnog termina"
          accessibilityValue={{ text: proposedTaskTime ? `${time}, termin zadatka: ${proposedTaskTime}` : time }} disabled={disabled} accessibilityState={{ disabled }} haptic="select" scaleTo={0.99}
          onPress={() => { if (!disabled && !reviewing) setEditingTime(true); }} style={s.term}>
          <FactArt kind="calendar" size={24} cut="art" tone="quiet" />
          <View style={s.grow}>
            <T variant="note" tone="muted">{exact ? 'Tvoj predlog termina' : 'Termin zadatka'}</T>
            <T variant="bodyStrong" style={s.ink}>{time}</T>
            {proposedTaskTime ? <T variant="note" tone="muted">{`Termin zadatka: ${proposedTaskTime}`}</T> : null}
          </View>
          <CaretRight size={20} color={sys.color.muted} />
        </Press>
      </View>
      <View style={s.section}>
        <Question optional>Poruka uz prijavu</Question>
        <TextInput accessibilityLabel="Poruka uz prijavu" multiline maxLength={NOTE_LIMIT} value={draft.note} editable={!disabled}
          style={[s.note, focused === 'note' && s.fieldFocused]} placeholder="Npr. šta donosiš ili kada možeš da dođeš." placeholderTextColor={sys.color.muted}
          onFocus={() => setFocused('note')} onBlur={() => setFocused(null)}
          onChangeText={note => { if (!disabled) change({ ...draft, note }); }} />
        {draft.note.length >= NOTE_COUNTER_FROM ? <T variant="meta" tone="muted" accessibilityLiveRegion="polite">{`Još ${noteLeft} ${plural(noteLeft, 'znak', 'znaka', 'znakova')}`}</T> : null}
      </View>
    </>}
    </>}
    {editingTime && !disabled && !reviewing ? <ExactTimeSheet draft={draft} timezone={timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
      taskTime={fixed ?? need.vremeTekst} close={() => setEditingTime(false)}
      accept={(start, end) => { change({ ...draft, start, end }); setEditingTime(false); }} /> : null}
    {reviewing ? <ProductSheet title="Ovo šalješ" closeLabel="Nazad na izmenu ponude" backdropHint="Vraća na izmenu ponude." onClose={closeReview}
      footer={() => <>
        <V2Action label="Pošalji ovu prijavu" onPress={confirmReview} style={brandAction} />
        <V2Action label="Izmeni ponudu" kind="quiet" onPress={closeReview} />
      </>}>
      {() => <>
        <View style={s.reviewTask}>
          <T accessibilityRole="header" style={s.taskTitle}>{readableTitle(opportunity.naslov)}</T>
          <CardFact art={<FactArt kind="pin" size={24} cut="art" />} text={opportunity.podrucjeTekst} lines={0} />
        </View>
        {sentFacts}
        <SentMessage note={draft.note} />
        <T variant="meta" tone="muted">Ako tvoja ponuda bude izabrana, odmah nastaje Dogovor.</T>
      </>}
    </ProductSheet> : null}
  </ComposerFrame>;
}

/** The task's base price stays distinct from the application total in the footer and review. */
function FixedPrice({ need }: { need: PotrebaProjekcija }) {
  const amount = need.ponudjenaCena?.prikaz;
  // An absent legacy basis is an application total, never an inferred whole-task price.
  const basis = need.osnovaCene === 'PER_PERSON' ? 'po osobi'
    : need.osnovaCene === 'TOTAL' ? 'za ceo zadatak' : 'ukupno za tvoju prijavu';
  return <>
    <Question>Cena zadatka</Question>
    <View accessible accessibilityLabel={amount ? `Cena zadatka: ${amount} ${basis}` : 'Cena nije navedena'} style={s.fixed}>
      <FactArt kind="money" size={24} cut="art" />
      {amount ? <View style={s.fixedValue}>
        <T style={s.money}>{amount}</T><T variant="note" tone="muted">{basis}</T>
      </View> : <T variant="bodyStrong" style={s.ink}>Cena nije navedena</T>}
    </View>
  </>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface }, grow: { flex: 1, minWidth: 0 }, ink: { color: sys.color.ink },
  content: { paddingHorizontal: SIDE, paddingTop: sys.space.base, paddingBottom: sys.space.xxl, gap: sys.space.lg },
  // The task is context; the amount and editable terms carry the decision hierarchy.
  task: { gap: sys.space.sm, paddingBottom: sys.space.lg, borderBottomWidth: 1, borderColor: sys.color.line },
  taskTitle: { ...sys.type.cardTitle, color: sys.color.ink },
  taskFacts: { gap: sys.space.xs },
  question: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.sm, rowGap: sys.space.xs, flexShrink: 1 },
  section: { gap: sys.space.md },
  amountHeading: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  priceBox: { ...fieldBox, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm,
    backgroundColor: sys.color.surface, paddingVertical: 0, borderColor: sys.color.lineStrong },
  priceInput: withInter({ ...sys.type.display, fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'], flex: 1, minWidth: 0,
    color: sys.color.ink, paddingVertical: sys.space.md }),
  fieldFocused: { borderColor: sys.color.green },
  fieldDanger: { borderColor: sys.color.danger },
  fixed: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 48 },
  fixedValue: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: sys.space.sm, flex: 1, minWidth: 0 },
  money: { ...sys.type.hero, fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'], color: sys.color.ink, maxWidth: '100%', flexShrink: 1 },
  terms: { borderBottomWidth: 1, borderColor: sys.color.line },
  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingBottom: sys.space.base,
    borderBottomWidth: 1, borderBottomColor: sys.color.line },
  peopleStacked: { flexDirection: 'column', alignItems: 'stretch' },
  peopleQuestion: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, gap: sys.space.md },
  unflex: { flex: 0 },
  lockedPeople: { flex: 1, minWidth: 0 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  stepperStacked: { alignSelf: 'flex-start' },
  peopleInput: withInter({ ...sys.type.price, width: 80, minHeight: 56, textAlign: 'center', color: sys.color.ink,
    paddingHorizontal: sys.space.xs, borderWidth: 1, borderColor: sys.color.lineStrong, borderRadius: sys.radius.control }),
  peopleInputLarge: { width: 88 },
  term: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.base },
  note: withInter({ ...fieldBox, ...sys.type.body, color: sys.color.ink, backgroundColor: sys.color.surface,
    minHeight: 96, textAlignVertical: 'top', padding: sys.space.base }),
  outcome: { gap: sys.space.md, alignItems: 'flex-start', paddingBottom: sys.space.lg },
  resultTitle: { ...sys.type.hero, color: sys.color.ink },
  receipt: { gap: sys.space.md },
  // An amount owns the whole row; its icon must not steal reading width from a long total or enlarged text.
  receiptAmount: { alignItems: 'flex-start', gap: sys.space.xs, paddingVertical: sys.space.base,
    borderBottomWidth: 1, borderColor: sys.color.line },
  receiptLabel: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  receiptMoney: { ...sys.type.display, fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'], color: sys.color.ink, maxWidth: '100%' },
  unknownPrice: { ...sys.type.bodyStrong, color: sys.color.ink },
  receiptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, paddingVertical: sys.space.xs },
  sentMessage: { gap: sys.space.sm, borderTopWidth: 1, borderColor: sys.color.line, paddingTop: sys.space.lg },
  reviewTask: { gap: sys.space.xs },
  footer: { backgroundColor: sys.color.surface, paddingHorizontal: SIDE, paddingVertical: sys.space.md, borderTopWidth: 1, borderColor: sys.color.line, gap: sys.space.sm },
  notice: { ...inset, backgroundColor: sys.color.warnSoft, gap: sys.space.xs },
  noticeAction: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  // One compact offer summary stays beside Review while the keyboard is hidden.
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.sm, rowGap: 2 },
  summary: { ...sys.type.bodyStrong, color: sys.color.ink, flexShrink: 1, fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  blocked: { alignItems: 'center', gap: sys.space.xs, paddingTop: sys.space.xs },
  pair: { flexDirection: 'row', gap: sys.space.md }, stack: { gap: sys.space.md }, cell: { flex: 1, minWidth: 0 },
});
