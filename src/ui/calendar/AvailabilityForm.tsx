import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, RefreshControl, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import type { AvailabilityRule, AvailabilityWindow, WorkerAvailabilityInput } from '../../contracts/workerAvailability';
import { calendarInstant } from '../../lib/calendarTime';
import { normalizeWorkerAvailability, sameWorkerAvailability } from '../../lib/workerAvailability';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { raspon, zonaTelefona } from '../../lib/vreme';
import { brandAction, card, sys } from '../system/tokens';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { Disclosure, TurningCaret } from '../system/Disclosure';
import { ProductSheet } from '../product/ProductSheet';
import { Glyph } from '../system/Glyph';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { urgentBuilt } from '../../lib/needUrgency';
import { useReducedMotion } from '../system/motion';
import { useTextScale } from '../system/textScale';
import { CalendarField, CivilField, calendarStyles } from './CalendarControls';
import { civilClock, civilDay, civilInstant, scheduleZone, shiftDate, showScheduleZone, weekdays, zonedParts } from './calendarPresentation';
import { copyDay, copyTakesAway, nightContinuation } from './weekCopy';

type Weekday = (typeof weekdays)[number];
const WORKDAYS = [1, 2, 3, 4, 5];

/** A slot as a person reads it: minutes only ("09:00", never "09:00:00.123456"); the stored value stays exact. */
const clocks = (rule: AvailabilityRule) => `${civilClock(rule.startTime)}–${civilClock(rule.endTime)}`;
const range = (rule: AvailabilityRule) => `${clocks(rule)}${!rule.active ? ' · Pauzirano' : ''}`;
const validity = (rule: Pick<AvailabilityRule, 'startsOn' | 'endsOn'>) =>
  `Od ${civilDay(rule.startsOn)}${rule.endsOn ? ` do ${civilDay(rule.endsOn)}` : ' · bez završnog datuma'}`;
/** "Zajednički termin: Pon, Sre" for the eye; the spoken form names the days in full ("ponedeljak, sreda"). */
const shared = (rule: AvailabilityRule, spoken = false) => `Zajednički termin: ${weekdays.filter(item => rule.weekdays.includes(item.day))
  .map(item => spoken ? item.name.toLowerCase() : item.short).join(', ')}`;
/** Everything a slot's row shows, as one spoken value (the row's label is the command, "Uredi Ponedeljak 09:00"). */
const ruleFacts = (rule: AvailabilityRule) => [clocks(rule), rule.label || null, validity(rule),
  rule.weekdays.length > 1 ? shared(rule, true) : null, rule.active ? null : 'Pauzirano'].filter((part): part is string => !!part).join(', ');
/**
 * Days as they open a Serbian sentence: "Utorak", "Utorak i sreda", "Utorak, sreda i četvrtak". Inside a sentence a
 * weekday is lower-case; only the first word takes a capital.
 */
const names = (days: readonly Weekday[]) => {
  const words = days.map((day, index) => index ? day.name.toLowerCase() : day.name);
  return words.length < 2 ? words[0] ?? '' : `${words.slice(0, -1).join(', ')} i ${words[words.length - 1]}`;
};
/**
 * A copied night goes on past midnight onto the day after each chosen day, which the day's own summary ("22:00–24:00")
 * does not show (round-5c), so the copy says it.
 */
const nightNote = (rules: readonly AvailabilityRule[], day: number) => {
  const after = nightContinuation(rules, day);
  return after ? `Noćni termin se nastavlja do ${civilClock(after.endTime)} sledećeg dana.` : null;
};
const dayOf = (value: number) => weekdays.find(day => day.day === value) ?? weekdays[0];
function seconds(value: string) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}(?:\.\d{1,6})?))?$/.exec(value);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0) : NaN;
}
/** The four fields the form edits, without the account, profile and revision a saved value carries. */
const fields = (value: WorkerAvailabilityInput): WorkerAvailabilityInput =>
  ({ timezone: value.timezone, availableNow: value.availableNow, rules: value.rules, windows: value.windows });

/**
 * The one switch look: green track when on, the muted grey when off (the hairline grey was about 1.4:1 on white, round-5c),
 * and a white thumb in both (B19: not teal).
 */
function FormSwitch({ label, value, change, disabled }: {
  label: string; value: boolean; change: (value: boolean) => void; disabled?: boolean;
}) {
  return <Switch accessibilityLabel={label} value={value} onValueChange={change} disabled={disabled}
    trackColor={{ true: sys.color.green, false: sys.color.muted }} thumbColor={sys.color.surface} ios_backgroundColor={sys.color.muted} />;
}
/**
 * A switch with its words beside it. The words are part of the touch area (the switch alone was a small target), and a
 * screen reader hears the switch once, by its name: the label beside it is hidden. The explanation under the label is read
 * as its own line (round-5c: as the switch's hint it went unheard with hints off, and TalkBack reads a hint only as a
 * usage tip), so the switch carries no hint and nothing is said twice.
 */
function SwitchRow({ label, hint, strong = false, value, change, disabled }: {
  label: string; hint?: string; strong?: boolean; value: boolean; change: (value: boolean) => void; disabled?: boolean;
}) {
  const row = <View style={s.toggleRow}>
    <Press accessible={false} importantForAccessibility="no" disabled={disabled}
      scaleTo={1} haptic="select" onPress={() => change(!value)} style={s.switchCopy}>
      <T variant={strong ? 'bodyStrong' : 'body'} accessibilityElementsHidden importantForAccessibility="no">{label}</T>
    </Press>
    <FormSwitch label={label} value={value} change={change} disabled={disabled} />
  </View>;
  return hint ? <View style={s.switchGroup}>{row}<T variant="note" tone="muted">{hint}</T></View> : row;
}
/** Two fields side by side where they fit, one under the other on a narrow screen or at a large text size. */
function Pair({ children, minimumWidth = 360 }: { children: [ReactNode, ReactNode]; minimumWidth?: number }) {
  const { width } = useWindowDimensions(), scale = useTextScale();
  const side = width >= minimumWidth && scale < 1.3;
  return <View style={side ? s.pair : s.stack}>{children.map((child, index) => <View key={index} style={side ? s.grow : null}>{child}</View>)}</View>;
}
/**
 * The footer of a sheet: the one primary, with its error drawn under it by the button itself (announced as it appears),
 * and a quiet way out that discards.
 */
function SheetFooter({ error, primary, onPrimary, cancel, onCancel, disabled, reason }: {
  error?: string | null; primary: string; onPrimary: () => void; cancel: string; onCancel: () => void; disabled?: boolean; reason?: string | null;
}) {
  return <>
    <V2Action label={primary} style={brandAction} onPress={onPrimary} disabled={disabled} reason={reason} error={error} />
    <V2Action label={cancel} kind="quiet" onPress={onCancel} />
  </>;
}

/**
 * Novi / Izmeni termin: the days, the two times, and the rarely changed dates, name and pause behind "Više podešavanja".
 * Nothing is saved here: "Primeni termin" changes the draft, and the screen's Save writes it. An end before the start is
 * work over midnight, stored as two intervals on adjacent days.
 */
export function RuleSheet({ rule, isNew, timezone, phoneZone, close, accept }: {
  rule: AvailabilityRule; isNew: boolean; timezone: string; phoneZone: string | undefined;
  close: () => void; accept: (rules: readonly AvailabilityRule[]) => void;
}) {
  const reduced = useReducedMotion();
  // At a very large text size a 48 px circle holds one letter ("P", "U"), as the calendar's week strip does; the spoken
  // name stays whole.
  const scale = useTextScale();
  const [draft, setDraft] = useState(rule);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof AvailabilityRule>(key: K, value: AvailabilityRule[K]) => { setError(null); setDraft(current => ({ ...current, [key]: value })); };
  const submit = (dismiss: () => void) => {
    const startSeconds = seconds(draft.startTime), endSeconds = seconds(draft.endTime);
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || startSeconds === endSeconds) {
      setError('Izaberi različito vreme početka i kraja.'); return;
    }
    const overnight = endSeconds < startSeconds;
    let rules: AvailabilityRule[] = [draft];
    if (overnight) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.startsOn) || (draft.endsOn && !/^\d{4}-\d{2}-\d{2}$/.test(draft.endsOn))) {
        setError('Proveri početni i završni datum.'); return;
      }
      try {
        rules = [{ ...draft, endTime: '24:00' }];
        if (endSeconds !== 0) rules.push({ ...draft, id: noviUuidZahtevId(),
          weekdays: draft.weekdays.map(day => (day + 1) % 7), startTime: '00:00',
          startsOn: shiftDate(draft.startsOn, 1), endsOn: draft.endsOn ? shiftDate(draft.endsOn, 1) : null });
      } catch { setError('Proveri početni i završni datum.'); return; }
    }
    const valid = normalizeWorkerAvailability({ timezone, availableNow: false, rules, windows: [] });
    if (!valid) { setError('Izaberi dane, datume i vremenski interval sa različitim početkom i krajem.'); return; }
    accept(valid.rules); dismiss();
  };
  const startSeconds = seconds(draft.startTime), endSeconds = seconds(draft.endTime);
  const overnight = Number.isFinite(startSeconds) && Number.isFinite(endSeconds) && endSeconds < startSeconds;
  const toggleDay = (day: number) => set('weekdays', draft.weekdays.includes(day) ? draft.weekdays.filter(value => value !== day) : [...draft.weekdays, day]);
  const circle = (day: Weekday) => {
    const on = draft.weekdays.includes(day.day);
    return <Press key={day.day} accessibilityRole="checkbox" accessibilityLabel={day.name} accessibilityState={{ checked: on }}
      haptic="select" onPress={() => toggleDay(day.day)} style={[s.circle, on ? s.circleOn : s.circleOff]}>
      <T variant="tab" numberOfLines={1} style={{ color: on ? sys.color.onDark : sys.color.ink }}>{scale >= 1.5 ? day.short.charAt(0) : day.short}</T>
    </Press>;
  };
  return <ProductSheet title={isNew ? 'Novi termin' : 'Izmeni termin'} closeButton={false} reduced={reduced} dirty={draft !== rule} onClose={close}
    footer={dismiss => <SheetFooter error={error} primary="Primeni termin" onPrimary={() => submit(dismiss)} cancel="Odustani od termina" onCancel={dismiss} />}>
    {() => <>
      <View style={s.days}>
        <T variant="meta" tone="muted">Dani</T>
        <View style={s.circles}>{weekdays.slice(0, 5).map(circle)}</View>
        <View style={s.circles}>{weekdays.slice(5).map(circle)}</View>
      </View>
      <Pair>{[<CivilField key="start" label="Početak termina" mode="time" value={draft.startTime} onChange={value => set('startTime', value)} />,
        <CivilField key="end" label="Kraj termina" mode="time" value={draft.endTime} onChange={value => set('endTime', value)} />]}</Pair>
      {overnight ? <T variant="note" tone="muted">Kraj pre početka znači rad preko ponoći. Čuva se kao dva intervala u susednim danima.</T> : null}
      {showScheduleZone(timezone, phoneZone) ? <T variant="note" tone="muted">{`${scheduleZone(timezone)}.`}</T> : null}
      <Disclosure label="Više podešavanja" hint={`${validity(draft)}${draft.active ? '' : ' · Pauzirano'}`} divider>
        <CivilField label="Važi od" mode="date" value={draft.startsOn} onChange={value => set('startsOn', value)} />
        <SwitchRow label="Bez završnog datuma" value={draft.endsOn === null} change={value => set('endsOn', value ? null : draft.startsOn)} />
        {draft.endsOn !== null ? <CivilField label="Važi do, uključujući datum" mode="date" value={draft.endsOn} onChange={value => set('endsOn', value)} /> : null}
        <CalendarField label="Naziv termina (opciono)" value={draft.label} onChange={value => set('label', value)} />
        <SwitchRow label="Termin je aktivan" value={draft.active} change={value => set('active', value)} />
      </Disclosure>
    </>}
  </ProductSheet>;
}

/**
 * Poseban datum: busy or free for a stretch of time, which takes precedence over the regular week. Editing one end keeps
 * the other end's exact saved instant (fractional seconds, and which of two repeated clock times it was).
 */
export function WindowSheet({ window, timezone, phoneZone, close, accept, candidateMode = false }: {
  window: AvailabilityWindow | null; timezone: string; phoneZone: string | undefined; candidateMode?: boolean;
  close: () => void; accept: (value: AvailabilityWindow) => void;
}) {
  const reduced = useReducedMotion();
  const initialStart = window ? zonedParts(new Date(window.startsAt), timezone) : { date: '', time: '' };
  const initialEnd = window ? zonedParts(new Date(window.endsAt), timezone) : { date: '', time: '' };
  const [start, setStart] = useState(initialStart), [end, setEnd] = useState(initialEnd);
  const [changedStart, setChangedStart] = useState(false);
  const [changedEnd, setChangedEnd] = useState(false);
  const [state, setState] = useState<AvailabilityWindow['state']>(window?.state ?? 'UNAVAILABLE');
  const [label, setLabel] = useState(window?.label ?? '');
  const [error, setError] = useState<string | null>(null);
  const dirty = changedStart || changedEnd || state !== (window?.state ?? 'UNAVAILABLE') || label !== (window?.label ?? '');
  const submit = (dismiss: () => void) => {
    // Editing one endpoint must preserve the other endpoint's exact saved instant,
    // including fractional seconds and its chosen occurrence of a repeated DST time.
    const from = window && !changedStart ? { value: window.startsAt, error: null } : civilInstant(start.date, start.time, timezone);
    const to = window && !changedEnd ? { value: window.endsAt, error: null } : civilInstant(end.date, end.time, timezone);
    if (!from.value || !to.value) { setError(from.error ?? to.error); return; }
    const item = { id: window?.id ?? noviUuidZahtevId(), startsAt: from.value, endsAt: to.value, state, label };
    const valid = normalizeWorkerAvailability({ timezone, availableNow: false, rules: [], windows: [item] });
    if (!valid) { setError('Kraj posebnog termina mora biti posle početka.'); return; }
    accept(valid.windows[0]); dismiss();
  };
  const startDate = (value: string) => {
    setError(null); setStart(current => ({ ...current, date: value })); setChangedStart(true);
    // A new special date usually ends the day it starts: the end date takes the same day while it is still empty.
    if (!window) setEnd(current => current.date ? current : { ...current, date: value });
  };
  const option = (value: AvailabilityWindow['state']) => {
    const chosen = state === value, text = value === 'AVAILABLE' ? 'Slobodno za rad' : 'Zauzeto';
    return <Press key={value} accessibilityRole="radio" accessibilityLabel={text} accessibilityState={{ checked: chosen }} haptic="select"
      onPress={() => { setError(null); setState(value); }} style={[calendarStyles.option, s.grow, chosen && s.optionOn]}>
      <T variant={chosen ? 'bodyStrong' : 'body'} style={s.optionText}>{text}</T>
    </Press>;
  };
  return <ProductSheet title="Poseban datum" closeButton={false} reduced={reduced} dirty={dirty} onClose={close}
    footer={dismiss => <>
      <T variant="meta" tone="muted">{candidateMode ? 'Čuva se tek sa profilom.' : 'Čuva se tek uz „Sačuvaj dostupnost“.'}</T>
      <SheetFooter error={error} primary="Primeni datum" onPrimary={() => submit(dismiss)} cancel="Odustani od datuma" onCancel={dismiss} />
    </>}>
    {() => <>
      <T variant="note" tone="muted">Poseban datum ima prednost nad redovnom nedeljom i ne otkazuje postojeće Dogovore. Potvrđen termin ostaje obaveza.</T>
      <T variant="note" tone="muted">{`Redovni termini ostaju sačuvani.${showScheduleZone(timezone, phoneZone) ? ` ${scheduleZone(timezone)}.` : ''}`}</T>
      <View style={s.options}>{option('UNAVAILABLE')}{option('AVAILABLE')}</View>
      <Pair minimumWidth={420}>{[<CivilField key="date" label="Datum početka" mode="date" value={start.date} onChange={startDate} />,
        <CivilField key="time" label="Vreme početka" mode="time" value={start.time}
          onChange={value => { setError(null); setStart(current => ({ ...current, time: value })); setChangedStart(true); }} />]}</Pair>
      <Pair minimumWidth={420}>{[<CivilField key="date" label="Datum kraja" mode="date" value={end.date}
        onChange={value => { setError(null); setEnd(current => ({ ...current, date: value })); setChangedEnd(true); }} />,
        <CivilField key="time" label="Vreme kraja" mode="time" value={end.time}
          onChange={value => { setError(null); setEnd(current => ({ ...current, time: value })); setChangedEnd(true); }} />]}</Pair>
      <CalendarField label="Naziv (opciono)" value={label} onChange={value => { setError(null); setLabel(value); }} />
    </>}
  </ProductSheet>;
}

/** Kopiraj termine: one day's slots onto the chosen days, which lose their own. Nothing is saved here either. */
export function CopySheet({ source, rules, close, apply }: {
  source: Weekday; rules: readonly AvailabilityRule[]; close: () => void; apply: (targets: number[]) => void;
}) {
  const reduced = useReducedMotion();
  const [chosen, setChosen] = useState<number[]>([]);
  const summary = rules.filter(rule => rule.weekdays.includes(source.day)).map(range).join(' · ');
  const night = nightNote(rules, source.day);
  // Read from the copy itself: the part after midnight of the source's own night is not a chosen day's own slot.
  const replacing = copyTakesAway(rules, source.day, chosen);
  const toggle = (day: number) => setChosen(list => list.includes(day) ? list.filter(value => value !== day) : [...list, day]);
  return <ProductSheet title="Kopiraj termine" closeButton={false} reduced={reduced} dirty={chosen.length > 0} onClose={close}
    footer={dismiss => <SheetFooter primary="Kopiraj" disabled={!chosen.length} reason={chosen.length ? null : 'Izaberi bar jedan dan.'}
      onPrimary={() => { if (!chosen.length) return; apply(chosen); dismiss(); }} cancel="Odustani" onCancel={dismiss} />}>
    {() => <>
      <T variant="note" tone="muted">{`${source.name}: ${summary}`}</T>
      {night ? <T variant="note" tone="muted">{night}</T> : null}
      <View>{weekdays.filter(day => day.day !== source.day).map(day => {
        const on = chosen.includes(day.day);
        return <Press key={day.day} accessibilityRole="checkbox" accessibilityLabel={day.name} accessibilityState={{ checked: on }}
          haptic="select" onPress={() => toggle(day.day)} style={s.check}>
          <View style={[s.box, on && s.boxOn]}>{on ? <Glyph name="check" size={16} tone="onGreen" /> : null}</View>
          <T style={s.grow}>{day.name}</T>
        </Press>;
      })}</View>
      {replacing ? <T variant="note" tone="muted">Postojeći termini izabranih dana se zamenjuju.</T> : null}
    </>}
  </ProductSheet>;
}

/** The footer arrives with a short rise on a real change of state, and at once under reduced motion; it leaves at once. */
function FooterIn({ reduced, children }: { reduced: boolean; children: ReactNode }) {
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    const run = Animated.timing(progress, { toValue: 1, duration: sys.motion.enter, easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [progress, reduced]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return <Animated.View style={[calendarStyles.footer, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/**
 * Dostupnost za rad: the manual "Mogu odmah" status, the regular week and the special dates, saved as ONE whole
 * document with the expected revision. The screen's one primary is Save, and it exists only while something has
 * changed: the footer appears with the first change and goes when the change is undone. The sheets change the draft.
 * The "Mogu odmah" switch saves on its own (owner decision 2026-09-24) when nothing else is unsaved; in the profile
 * conversation (`candidateMode`), where the whole profile is saved in one final step, it changes the draft as before.
 */
export function AvailabilityForm({ availability, busy, uncertain, onSave, candidateMode = false, profileDraft = false, refreshing = false,
  onRefresh, problem = null, onReconcile, saved = false, onDirtyChange, phoneZone = zonaTelefona() }: {
  availability: WorkerAvailabilityInput; busy: boolean; uncertain: boolean;
  /** Starts the save. A returned promise settles when the write has settled (the switch's own save waits for it). */
  onSave: (value: WorkerAvailabilityInput) => void | Promise<unknown>;
  candidateMode?: boolean;
  /** The work profile is still a draft, so nothing here changes what is offered yet. */
  profileDraft?: boolean;
  /** Pull to read the saved state again (it replaced a standing "Osveži dostupnost" button). Edits wait while it reads. */
  refreshing?: boolean; onRefresh?: () => void;
  /** What went wrong with the last read or write, in the owner's words (the route's editor error). */
  problem?: string | null;
  /** Read the saved state after an unconfirmed outcome; without it the form only says that it must be read first. */
  onReconcile?: () => void;
  /** The last write was confirmed by its receipt: the footer says so for a moment. */
  saved?: boolean;
  /** Told whether there are unsaved changes, so the screen can ask before they are dropped. */
  onDirtyChange?: (dirty: boolean) => void;
  /** The phone's zone; the schedule's zone is said only when it or the phone is outside Serbian time. */
  phoneZone?: string;
}) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions(), scale = useTextScale();
  const stacked = width < 360 || scale >= 1.3;
  const baseline = useMemo(() => fields(availability), [availability]);
  const [draft, setDraft] = useState<WorkerAvailabilityInput>(baseline);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ rule: AvailabilityRule; isNew: boolean; day: number | null } | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [windowEditor, setWindowEditor] = useState<{ value: AvailabilityWindow | null } | null>(null);
  const [copySource, setCopySource] = useState<Weekday | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const confirmation = useConfirmSheet({ reduced });
  useEffect(() => {
    // An idempotent accepted receipt can keep the same revision while ending this edit.
    setDraft(fields(availability));
    setError(null); setEditing(null); setWindowEditor(null); setCopySource(null);
  }, [availability]);
  // Derived, not a sticky flag: a change that is undone is no change, and the footer goes with it. Both sides are
  // compared in their normal form (rules and windows sorted by id), as the save would send them.
  const dirty = useMemo(() => !sameWorkerAvailability(normalizeWorkerAvailability(draft) ?? draft,
    normalizeWorkerAvailability(baseline) ?? baseline), [draft, baseline]);
  // Unsaved edits other than the status itself: while there are any, the switch joins them instead of saving alone.
  const otherDirty = useMemo(() => {
    const rest = { ...draft, availableNow: baseline.availableNow };
    return !sameWorkerAvailability(normalizeWorkerAvailability(rest) ?? rest, normalizeWorkerAvailability(baseline) ?? baseline);
  }, [draft, baseline]);
  const instant = !candidateMode;
  const [statusSaving, setStatusSaving] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const blocked = busy || uncertain || refreshing;
  // A confirmation or editor owns the exact draft it displayed. In the AI
  // profile this component survives a new server revision; an old callback must
  // never replace that fresh schedule with its captured rules/windows array.
  const editScope = useRef({ availability, draft, blocked, editing, windowEditor, copySource });
  if (editScope.current.availability !== availability || editScope.current.draft !== draft || editScope.current.blocked !== blocked
    || editScope.current.editing !== editing || editScope.current.windowEditor !== windowEditor || editScope.current.copySource !== copySource) {
    editScope.current = { availability, draft, blocked, editing, windowEditor, copySource };
  }
  const renderedEdit = editScope.current;
  const canEdit = () => alive.current && editScope.current === renderedEdit && !renderedEdit.blocked;
  // Retire before scheduling state, including a second native callback in the
  // same turn. A later loading→editable transition cannot revive the old scope.
  const retireEdit = () => { editScope.current = { ...editScope.current }; };
  const closeConfirmation = confirmation.close;
  useEffect(() => { closeConfirmation(); }, [renderedEdit, closeConfirmation]);
  const report = useRef(onDirtyChange); report.current = onDirtyChange;
  useEffect(() => { report.current?.(dirty); }, [dirty]);
  useEffect(() => () => report.current?.(false), []);
  useEffect(() => {
    if (!saved) { setShowSaved(false); return; }
    setShowSaved(true);
    // The focused Save leaves with the footer it stood in, and a role alone is not read on Android: the outcome is said.
    AccessibilityInfo.announceForAccessibility('Dostupnost je sačuvana.');
    const timer = setTimeout(() => setShowSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);
  const sheetOpen = !!editing || !!windowEditor || !!copySource;
  const update = (value: Partial<WorkerAvailabilityInput>) => {
    if (!canEdit()) return;
    retireEdit();
    setDraft(current => ({ ...current, ...value })); setError(null);
  };
  const deleteItem = (kind: 'rules' | 'windows', id: string) => {
    if (!canEdit()) return;
    // One word for one thing (UX plan 3.8): a slot of the week is a "termin", a special date is a "datum".
    confirmation.ask({ title: kind === 'windows' ? 'Ukloniti datum?' : 'Ukloniti termin?', message: 'Promena će se sačuvati tek kada sačuvaš dostupnost. Dogovori ostaju nepromenjeni.',
      cancelLabel: 'Odustani', confirmLabel: 'Ukloni', tone: 'danger', onConfirm: () => update({ [kind]: draft[kind].filter(item => item.id !== id) }) });
  };
  const save = () => {
    if (!canEdit() || !dirty || sheetOpen) return;
    const normalized = normalizeWorkerAvailability(draft);
    if (!normalized) { setError('Proveri unetu vremensku zonu i raspored.'); return; }
    onSave(normalized);
  };
  const discard = () => { if (!canEdit()) return; retireEdit(); setDraft({ ...baseline }); setError(null); };
  // The status saves on its own: it sends the SAVED week with only the status changed, so it never carries other edits
  // along. While other edits are unsaved it joins them (the screen keys this form by revision, so a save of its own
  // would drop them). Every guard of the save stays with the editor; an outcome that is not confirmed ends in the same
  // "Učitaj sačuvano stanje" as a Save.
  const changeStatus = (value: boolean) => {
    if (!canEdit()) return;
    if (!instant || otherDirty) { update({ availableNow: value }); return; }
    const next = { ...baseline, availableNow: value };
    retireEdit();
    setDraft(next); setError(null);
    if (value === baseline.availableNow) return;
    const normalized = normalizeWorkerAvailability(next);
    if (!normalized) { setError('Proveri unetu vremensku zonu i raspored.'); return; }
    setStatusSaving(true);
    void Promise.resolve(onSave(normalized)).finally(() => { if (alive.current) setStatusSaving(false); });
  };
  const editRule = (rule?: AvailabilityRule, day?: number) => {
    if (!canEdit()) return;
    retireEdit();
    setEditing(rule ? { rule, isNew: false, day: null } : { isNew: true, day: day ?? null, rule: { id: noviUuidZahtevId(),
      weekdays: day === undefined ? [] : [day], startTime: '', endTime: '', startsOn: zonedParts(new Date(), draft.timezone).date,
      endsOn: null, label: '', active: true } });
  };
  const copy = (source: Weekday, targets: readonly number[], announce: string) => {
    if (!canEdit()) return;
    const night = nightNote(draft.rules, source.day);
    update({ rules: copyDay(draft.rules, source.day, targets) });
    AccessibilityInfo.announceForAccessibility(night ? `${announce} ${night}` : announce);
  };
  const sameForWorkdays = (source: Weekday) => {
    if (!canEdit()) return;
    const targets = WORKDAYS.filter(day => day !== source.day);
    const apply = () => copy(source, targets, 'Termini su kopirani na radne dane.');
    if (!copyTakesAway(draft.rules, source.day, targets)) { apply(); return; }
    const night = nightNote(draft.rules, source.day);
    confirmation.ask({ title: 'Zameniti termine?', confirmLabel: 'Zameni', cancelLabel: 'Odustani', onConfirm: apply,
      message: `${names(targets.map(dayOf))} ${targets.length === 1 ? 'dobija' : 'dobijaju'} iste termine kao ${source.name.toLowerCase()}.${night ? ` ${night}` : ''} Promena će se sačuvati tek kada sačuvaš dostupnost.` });
  };
  // A pull reads the saved state again, and the new value resets the form (the effect above). With unsaved edits, a
  // pull made while scrolling up would throw them away unasked, so it does nothing until they are saved or discarded.
  // The control stays mounted (removing it re-creates the Android scroll view and loses the position): `enabled`
  // stops the Android gesture, the check in reload() stops an iOS pull. A screen reader reaches the same read as an
  // action on the "Redovna nedelja" heading, since the standing refresh button is gone (round-5c: on the ScrollView the
  // action was never offered: Android's scroll view keeps its own accessibility delegate, and VoiceOver does not focus it).
  const canReload = !!onRefresh && !dirty;
  const reload = () => { if (canEdit() && !dirty) onRefresh?.(); };
  // The hint says when the status starts to count: at once on its own, with the other edits while there are any, or with
  // the profile in the profile conversation.
  const hint = profileDraft
    ? 'Radni profil je nacrt. Aktiviraj ga da ovaj status počne da važi.'
    : candidateMode ? 'Važi kada sačuvaš profil, dok ga ne promeniš.'
    : otherDirty ? 'Sačuvaće se zajedno sa ostalim izmenama.'
    : 'Čuva se odmah. Važi dok ga ne promeniš.';
  const now = BigInt(Date.now()) * 1000n;
  const past = (window: AvailabilityWindow) => (calendarInstant(window.endsAt) ?? 0n) <= now;
  const start = (window: AvailabilityWindow) => calendarInstant(window.startsAt) ?? 0n;
  // Current and coming dates first, soonest first; then the past ones, latest first. Presentation only.
  const windows = [...draft.windows].sort((a, b) => past(a) !== past(b) ? (past(a) ? 1 : -1)
    : past(a) ? (start(a) < start(b) ? 1 : start(a) > start(b) ? -1 : 0) : (start(a) < start(b) ? -1 : start(a) > start(b) ? 1 : 0));
  const saveLabel = candidateMode ? 'Primeni na pregled profila' : 'Sačuvaj dostupnost';
  const footer = uncertain && onReconcile ? <FooterIn key="reconcile" reduced={reduced}>
    <T variant="note" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">{problem ?? 'Ne znamo da li je izmena sačuvana.'}</T>
    {/* The explicit read bypasses the unsaved-changes gate on purpose: until it answers, nothing here can be trusted. */}
    <V2Action label="Učitaj sačuvano stanje" kind="secondary" disabled={busy || refreshing} onPress={onReconcile} />
  </FooterIn> : uncertain ? <FooterIn key="uncertain" reduced={reduced}>
    {/* Without a read of its own here, the reason names the way forward the surrounding screen offers: in the profile
        conversation that is its own check of the conversation (review of owner step 10). */}
    <V2Action label={saveLabel} style={brandAction} disabled onPress={save} reason={candidateMode
      ? 'Prvo proveri stanje razgovora. Ne znamo da li je izmena sačuvana.' : 'Prvo učitaj sačuvano stanje. Ne znamo da li je izmena sačuvana.'} />
  </FooterIn> : statusSaving ? null : dirty || busy ? <FooterIn key="form" reduced={reduced}>
    {dirty ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">Imaš nesačuvane izmene.</T> : null}
    <V2Action label={saveLabel} style={brandAction} loading={busy} disabled={blocked || sheetOpen} error={error} onPress={save} />
    <V2Action label="Odustani od izmena" kind="quiet" disabled={blocked} onPress={discard} />
  </FooterIn> : showSaved ? <FooterIn key="saved" reduced={reduced}>
    <View style={s.saved}><Glyph name="check" tone="green" />
      <T variant="bodyStrong" accessibilityRole="alert" style={{ color: sys.color.green }}>Dostupnost je sačuvana.</T></View>
  </FooterIn> : null;
  return <View style={s.fill}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}
      refreshControl={onRefresh ? <RefreshControl enabled={!dirty} refreshing={refreshing} onRefresh={reload} tintColor={sys.color.green} colors={[sys.color.green]} /> : undefined}>
      <View style={s.group}>
        {candidateMode ? <T variant="note" tone="muted">Promene ulaze u pregled profila. Profil čuvaš jednim završnim korakom.</T> : null}
        {/* A failed read says "…pokušaj ponovo", so the way to do it stands beside it while nothing is unsaved. */}
        {problem && !uncertain ? <View style={s.problem}>
          <T variant="note" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.problemText}>{problem}</T>
          {canReload ? <V2Action label="Pokušaj ponovo" kind="quiet" compact disabled={refreshing} onPress={reload} /> : null}
        </View> : null}
        {/* A flat row, not a box (B19): the status, what it means, and the switch. While its own save runs, the line
            under it says so; the footer's Save does not appear for it. */}
        <SwitchRow label="Mogu odmah" hint={hint} strong value={draft.availableNow} disabled={blocked} change={changeStatus} />
        <T variant="meta" tone="muted">{urgentBuilt() ? 'Ne uključuje HITNO i ne potvrđuje novi Dogovor.' : 'Ne potvrđuje novi Dogovor.'}</T>
        {statusSaving && busy ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">Čuvamo status…</T> : null}
      </View>
      <View style={s.section}>
        <View style={s.sectionHead}>
          <T variant="heading" accessibilityRole="header"
            accessibilityActions={canReload ? [{ name: 'refresh', label: 'Učitaj sačuvano stanje' }] : undefined}
            onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'refresh') reload(); }}>Redovna nedelja</T>
          {showScheduleZone(draft.timezone, phoneZone) ? <T variant="note" tone="muted">{`${scheduleZone(draft.timezone)}.`}</T> : null}
        </View>
        <View style={s.list}>{weekdays.map((day, index) => {
          const rules = draft.rules.filter(rule => rule.weekdays.includes(day.day));
          const expanded = expandedDay === day.day && rules.length > 0;
          const summary = rules.map(range).join(' · ');
          return <View key={day.day} style={index ? s.divided : null}>
            {/* The day is the row's name and its slots are its value, whether it is open or not (a hint can be turned
                off, and "Prikaži termine" was wrong once the day was open); `expanded` says the rest. */}
            {rules.length ? <Press accessibilityRole="button" accessibilityLabel={day.name} accessibilityValue={{ text: summary }}
              accessibilityState={{ expanded }} haptic="select" scaleTo={0.99} onPress={() => setExpandedDay(expanded ? null : day.day)} style={s.dayRow}>
              <View style={stacked ? s.dayStack : s.dayLine}>
                <T variant="body" style={s.dayName}>{day.name}</T>
                <T variant="bodyStrong" numberOfLines={expanded ? undefined : 2} style={[s.summary, stacked && s.summaryStacked]}>{summary}</T>
              </View>
              <TurningCaret open={expanded} />
            </Press> : <Press accessibilityRole="button" accessibilityLabel={`Dodaj — ${day.name}`} accessibilityState={{ disabled: blocked }}
              disabled={blocked} haptic="select" scaleTo={0.99} onPress={() => editRule(undefined, day.day)} style={s.dayRow}>
              <View style={stacked ? s.dayStack : s.dayLine}>
                <T variant="body" style={s.dayName}>{day.name}</T>
                <View style={[s.add, stacked && s.addStacked]}><Glyph name="plus" tone={blocked ? 'muted' : 'ink'} />
                  <T variant="note" style={{ color: blocked ? sys.color.muted : sys.color.ink }}>Dodaj</T></View>
              </View>
            </Press>}
            {expanded ? <View style={s.expanded}>
              {rules.map(rule => <View key={rule.id} style={s.ruleRow}>
                {/* The label names the command; every fact the row shows is its spoken value. */}
                <Press accessibilityRole="button" accessibilityLabel={`Uredi ${day.name} ${civilClock(rule.startTime)}`} accessibilityState={{ disabled: blocked }}
                  accessibilityValue={{ text: ruleFacts(rule) }}
                  disabled={blocked} haptic="select" scaleTo={0.99} onPress={() => editRule(rule)} style={s.ruleBody}>
                  <T variant="bodyStrong" tone={rule.active ? 'ink' : 'muted'}>{clocks(rule)}</T>
                  {rule.label ? <T variant="note" tone="muted">{rule.label}</T> : null}
                  <T variant="note" tone="muted">{validity(rule)}</T>
                  {rule.weekdays.length > 1 ? <T variant="note" tone="muted">{shared(rule)}</T> : null}
                  {!rule.active ? <T variant="note" tone="muted">Pauzirano</T> : null}
                </Press>
                <Press accessibilityRole="button" accessibilityLabel={`Ukloni ${day.name} ${civilClock(rule.startTime)}`} accessibilityState={{ disabled: blocked }}
                  disabled={blocked} haptic="select" onPress={() => deleteItem('rules', rule.id)} style={calendarStyles.icon}>
                  <Glyph name="trash" tone={blocked ? 'muted' : 'danger'} /></Press>
              </View>)}
              <View style={s.dayActions}>
                <V2Action label="Dodaj termin" accessibilityLabel={`Dodaj — ${day.name}`} kind="quiet" disabled={blocked}
                  onPress={() => editRule(undefined, day.day)} />
              </View>
              {/* Copying is secondary to editing this day. A changed source/read starts closed; closing the day
                  unmounts this disclosure. Its state never becomes part of the availability draft. */}
              <Disclosure key={JSON.stringify([availability, day.day, rules])} label="Kopiraj termine…">
                <View style={s.dayActions}>
                  <V2Action label="Isto za sve radne dane" accessibilityLabel={`Isto za sve radne dane kao ${day.name}`} kind="quiet" tone="neutral" disabled={blocked}
                    onPress={() => sameForWorkdays(day)} />
                  <V2Action label="Kopiraj na…" accessibilityLabel={`Kopiraj ${day.name} na druge dane`} kind="quiet" tone="neutral" disabled={blocked}
                    onPress={() => { if (canEdit()) { retireEdit(); setCopySource({ ...day }); } }} />
                </View>
              </Disclosure>
            </View> : null}
          </View>;
        })}</View>
      </View>
      <View style={s.section}>
        <T variant="heading" accessibilityRole="header">Posebni datumi</T>
        {windows.length ? <View style={s.list}>{windows.map((window, index) => {
          // In the schedule's own zone, written the one way the app writes a moment ("11. sep · 09:30–12:00").
          const day = civilDay(zonedParts(new Date(window.startsAt), draft.timezone).date);
          const over = past(window);
          const line = [over ? 'Prošlo' : null, window.state === 'AVAILABLE' ? 'Slobodno za rad' : 'Zauzeto', window.label || null]
            .filter((part): part is string => !!part).join(' · ');
          const when = raspon(window.startsAt, window.endsAt, { zona: draft.timezone });
          return <View key={window.id} style={[s.windowRow, index ? s.divided : null]}>
            <Press accessibilityRole="button" accessibilityLabel={`Uredi datum ${day}`} accessibilityState={{ disabled: blocked }} disabled={blocked}
              accessibilityValue={{ text: `${when}, ${line}` }}
              haptic="select" scaleTo={0.99} onPress={() => { if (canEdit()) { retireEdit(); setWindowEditor({ value: window }); } }} style={s.windowBody}>
              <T variant="bodyStrong" tone={over ? 'muted' : 'ink'}>{when}</T>
              <T variant="note" tone="muted">{line}</T>
            </Press>
            <Press accessibilityRole="button" accessibilityLabel={`Ukloni datum ${day}`} accessibilityState={{ disabled: blocked }} disabled={blocked}
              haptic="select" onPress={() => deleteItem('windows', window.id)} style={calendarStyles.icon}>
              <Glyph name="trash" tone={blocked ? 'muted' : 'danger'} /></Press>
          </View>;
        })}</View> : <T variant="note" tone="muted">Nema posebnih datuma.</T>}
        <V2Action label="Dodaj datum" kind="secondary" disabled={blocked} onPress={() => { if (canEdit()) { retireEdit(); setWindowEditor({ value: null }); } }} />
      </View>
    </ScrollView>
    {footer}
    {editing && !blocked ? <RuleSheet rule={editing.rule} isNew={editing.isNew} timezone={draft.timezone} phoneZone={phoneZone}
      close={() => { if (alive.current && editScope.current.editing === editing) { retireEdit(); setEditing(null); } }} accept={rules => {
        if (!canEdit()) return;
        update({ rules: [...draft.rules.filter(rule => rule.id !== editing.rule.id), ...rules] });
        // The day just filled stays open, with its copy options available below the new term.
        const first = rules[0]?.weekdays ?? [];
        const open = editing.day !== null && first.includes(editing.day) ? editing.day : weekdays.find(day => first.includes(day.day))?.day;
        if (open !== undefined) setExpandedDay(open);
      }} /> : null}
    {windowEditor && !blocked ? <WindowSheet window={windowEditor.value} timezone={draft.timezone} phoneZone={phoneZone} candidateMode={candidateMode}
      close={() => { if (alive.current && editScope.current.windowEditor === windowEditor) { retireEdit(); setWindowEditor(null); } }}
      accept={window => update({ windows: [...draft.windows.filter(item => item.id !== window.id), window] })} /> : null}
    {copySource && !blocked ? <CopySheet source={copySource} rules={draft.rules}
      close={() => { if (alive.current && editScope.current.copySource === copySource) { retireEdit(); setCopySource(null); } }}
      apply={targets => copy(copySource, targets, 'Termini su kopirani.')} /> : null}
    {confirmation.sheet}
  </View>;
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  // Every inset, gap and margin is a step of sys.space (4 is the smallest); the 48 and 56 below are touch heights.
  content: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.sm, paddingBottom: sys.space.xxl, gap: sys.space.xxl },
  group: { gap: sys.space.sm },
  switchGroup: { gap: sys.space.xs },
  switchCopy: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center', gap: sys.space.xs },
  section: { gap: sys.space.md },
  sectionHead: { gap: sys.space.xs },
  // One card for the list, rows divided by a hairline; every inset is 16 (B19: the uneven bottom gap).
  list: { ...card, padding: 0, overflow: 'hidden' },
  divided: { borderTopWidth: 1, borderTopColor: sys.color.line },
  dayRow: { minHeight: 56, paddingVertical: sys.space.md, paddingHorizontal: sys.space.base, flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  dayLine: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  dayStack: { flex: 1, minWidth: 0, gap: sys.space.xs },
  dayName: { flexShrink: 0 },
  summary: { flex: 1, minWidth: 0, textAlign: 'right', color: sys.color.ink, fontVariant: ['tabular-nums'] },
  summaryStacked: { flex: 0, textAlign: 'left' },
  add: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: sys.space.xs },
  addStacked: { flex: 0, justifyContent: 'flex-start' },
  expanded: { paddingHorizontal: sys.space.base, paddingBottom: sys.space.md },
  ruleRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  ruleBody: { flex: 1, minWidth: 0, paddingVertical: sys.space.sm, gap: sys.space.xs },
  // A quiet action's own inset is pulled back, so its words line up with the slots above it.
  dayActions: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -sys.space.base, marginTop: sys.space.xs },
  windowRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingLeft: sys.space.base, paddingRight: sys.space.xs },
  windowBody: { flex: 1, minWidth: 0, paddingVertical: sys.space.md, gap: sys.space.xs },
  problem: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm },
  problemText: { flexShrink: 1 },
  saved: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  toggleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  pair: { flexDirection: 'row', gap: sys.space.md },
  stack: { gap: sys.space.md },
  days: { gap: sys.space.sm },
  circles: { flexDirection: 'row', gap: sys.space.sm },
  circle: { width: 48, height: 48, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  circleOn: { backgroundColor: sys.color.green, borderColor: sys.color.green },
  circleOff: { backgroundColor: sys.color.surface, borderColor: sys.color.lineStrong },
  options: { flexDirection: 'row', gap: sys.space.sm },
  optionOn: { borderColor: sys.color.ink, backgroundColor: sys.color.wash },
  optionText: { color: sys.color.ink },
  check: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  box: { width: 24, height: 24, borderRadius: sys.radius.check, borderWidth: 1.5, borderColor: sys.color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: sys.color.green, borderColor: sys.color.green },
});
