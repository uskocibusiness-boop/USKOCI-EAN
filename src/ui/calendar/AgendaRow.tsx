import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { BEZ_IZNOSA } from '../../lib/novac';
import { Press } from '../Press';
import { T } from '../Text';
import { useTextScale } from '../system/textScale';
import { cardCompact, sys } from '../system/tokens';
import { SCHEDULE_FALLBACK_TITLE, agendaClock, agendaWindow, withinDay } from './agenda';
import { PlannerChip, statusSpoken } from './PlannerChip';
import { entryTitle, type PlannerEntry } from './planner';

/** The rail's width: the clock column beside a row, at a normal text size. */
const RAIL = 56;

/** The time a row writes for itself: its window, its one stored bound ("od 14:00"), or its own words when it has no exact term. */
function timeOf(entry: PlannerEntry, day: string): string | null {
  if (!entry.exact) return entry.timeWord;
  if (entry.startsAt !== null && entry.endsAt !== null) return agendaWindow({ startsAt: entry.startsAt, endsAt: entry.endsAt }, day);
  return entry.startsAt !== null ? `od ${agendaClock(entry.startsAt)}` : `do ${agendaClock(entry.endsAt ?? '')}`;
}

/**
 * What a row says it opens. An untitled Dogovor names what it is: a term from the schedule is a confirmed one; a Dogovor from the
 * list may be finished or waiting, so it is not called confirmed (review of owner step 10).
 */
function nameOf(entry: PlannerEntry): string {
  if (entry.kind === 'zadatak') return entry.title ? `Otvori zadatak ${entry.title}` : 'Otvori zadatak';
  if (entry.kind === 'prijava') return entry.title ? `Otvori prijavu ${entry.title}` : 'Otvori prijavu';
  return entry.title ? `Otvori Dogovor ${entry.title}`
    : entry.fallbackTitle === SCHEDULE_FALLBACK_TITLE ? 'Otvori Dogovor sa potvrđenim terminom' : 'Otvori Dogovor';
}

/**
 * One thing of mine in the planner: a Dogovor, one of my published tasks, or one of my open applications. On a day, beside it and
 * at a normal text size, the rail with its clocks in Serbian time; at a large text size the rail goes and the time is the card's
 * first line. A thing without an exact term (in "Bez tačnog termina" and "Čekaju odgovor") has no rail: its own words for the time
 * are the first line. The card is the one press that opens it: no caret and no inner line (critique B13/B16). What it says, in fixed
 * lines: the title with the agreed amount beside it (or under it on a narrow screen), then the chip and role · the other person,
 * then the place, then the orange lines (what waits for you, "Preklapa se sa …"). A missing amount is a word, never "0 RSD"; an
 * amount that is not known here is not drawn at all. A finished thing is drawn quiet; an application, which is information and not
 * an obligation, has a dashed edge.
 */
export function AgendaRow({ entry, day, onOpen, overlap = null, zoneNote = false }: {
  entry: PlannerEntry; day: string; onOpen: (entry: PlannerEntry) => void;
  /** "Preklapa se sa …", when another term of the day overlaps this one. */
  overlap?: string | null;
  /** The phone is not in Serbian time: the spoken time says whose clock it is, as the heading does for the eye. */
  zoneNote?: boolean;
}) {
  const scale = useTextScale();
  const { width } = useWindowDimensions();
  const rail = scale <= 1.3 && entry.exact && entry.startsAt !== null;
  // AgendaScreen's gutters, this row's clock rail and the card's inset all reduce the space for title + amount.
  // Keep the original 360dp two-column allowance inside the card, not across the whole phone.
  const contentWidth = width - sys.space.lg * 2 - (rail ? RAIL + sys.space.md : 0)
    - Number(cardCompact.padding) * 2 - Number(cardCompact.borderWidth) * 2;
  const beside = contentWidth >= 360 && scale < 1.3;
  const done = entry.done;
  const tone = done ? 'muted' : 'ink';
  const time = timeOf(entry, day);
  // The rail's two clocks say the whole window only when it lies on this day. Everything else says its time in words: a window over
  // midnight, a lone bound ("od 14:00"), a thing without an exact term, and any row at a large text size, where the rail goes.
  const whole = entry.exact && entry.startsAt !== null && entry.endsAt !== null ? { startsAt: entry.startsAt, endsAt: entry.endsAt } : null;
  const timeLine = !!time && (!whole || !rail || !withinDay(whole, day));
  const others = [entry.role, entry.person].filter((part): part is string => !!part).join(' · ');
  const value = entry.amount === null ? null : entry.amount
    ? <T variant="priceRow" style={{ color: done ? sys.color.muted : sys.color.money, maxWidth: '100%', flexShrink: 1 }}>{entry.amount}</T>
    : <T variant="note" tone="muted">{BEZ_IZNOSA}</T>;
  const notes = [entry.note, overlap].filter((line): line is string => !!line);
  const spoken = [statusSpoken(entry.status), entry.role, time && zoneNote ? `${time}, po vremenu u Srbiji` : time, entry.person,
    entry.amount === null ? null : entry.amount || BEZ_IZNOSA, entry.place || null, ...notes]
    .filter((part): part is string => !!part).join(', ');
  return <View style={{ flexDirection: rail ? 'row' : 'column', gap: sys.space.md, alignItems: 'stretch' }}>
    {rail ? <View style={s.rail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <T variant="meta" tone={tone} style={s.start}>{agendaClock(entry.startsAt ?? '')}</T>
      {entry.endsAt !== null ? <T variant="meta" tone="muted">{agendaClock(entry.endsAt)}</T> : null}
      <View style={s.railLine} />
    </View> : null}
    <Press accessibilityRole="button" accessibilityLabel={nameOf(entry)}
      accessibilityValue={{ text: spoken }} haptic="select" scaleTo={sys.motion.scale.row} onPress={() => onOpen(entry)}
      style={[s.card, entry.kind === 'prijava' && s.application]}>
      {timeLine ? entry.exact ? <T variant="bodyStrong" tone={tone}>{time}</T> : <T variant="note" tone="muted">{time}</T> : null}
      <View style={beside ? s.titleRow : s.titleColumn}>
        <T variant="cardTitleCompact" numberOfLines={scale >= 1.3 ? 3 : 2}
          style={[{ color: done ? sys.color.muted : sys.color.ink }, beside && s.title]}>{entryTitle(entry)}</T>
        {value}
      </View>
      <View style={s.facts}>
        <PlannerChip status={entry.status} />
        {others ? <T variant="note" style={[s.factText, { color: done ? sys.color.muted : sys.color.fact }]}>{others}</T> : null}
      </View>
      {entry.place ? <T variant="note" style={{ color: done ? sys.color.muted : sys.color.fact }}>{entry.place}</T> : null}
      {notes.map(line => <View key={line} style={s.note}>
        <View style={s.noteDot} />
        <T variant="note" style={s.noteText}>{line}</T>
      </View>)}
    </Press>
  </View>;
}

const s = StyleSheet.create({
  rail: { width: RAIL, gap: sys.space.xs, paddingTop: sys.space.base },
  start: { fontWeight: '700' },
  railLine: { width: 1, flex: 1, backgroundColor: sys.color.line, marginTop: sys.space.sm, marginLeft: sys.space.xs },
  card: { ...cardCompact, flex: 1, minWidth: 0, gap: sys.space.xs },
  // An application is information, not an obligation: its edge is dashed.
  application: { borderStyle: 'dashed', borderColor: sys.color.lineStrong },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  titleColumn: { gap: sys.space.xs },
  title: { flex: 1, minWidth: 0 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm, rowGap: sys.space.xs },
  factText: { flexShrink: 1 },
  // What waits for you, and a collision: an orange mark and the words in the ink made for orange on white.
  note: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  noteDot: { width: 6, height: 6, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  noteText: { flexShrink: 1, color: sys.color.attentionInk },
});
