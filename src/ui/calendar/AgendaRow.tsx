import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { BEZ_IZNOSA } from '../../lib/novac';
import { Press } from '../Press';
import { T } from '../Text';
import { layout, ruleWidth } from '../system/layout';
import { Surface } from '../system/Surface';
import { useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { usePressLift } from '../system/usePressLift';
import { SCHEDULE_FALLBACK_TITLE, agendaClock, agendaWindow } from './agenda';
import { PlannerChip, statusSpoken } from './PlannerChip';
import { entryTitle, type PlannerEntry } from './planner';

/** The command a Dogovor with no term offers, in its own words. */
export const PROPOSE_TERM_LABEL = 'Predloži termin';

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
  return entry.title ? `Otvori Dogovor ${entry.title}`
    : entry.fallbackTitle === SCHEDULE_FALLBACK_TITLE ? 'Otvori Dogovor sa potvrđenim terminom' : 'Otvori Dogovor';
}

/**
 * One Dogovor of mine in the planner (composition spec 4.10; Raspored holds the Dogovori and nothing else since 8 Oct 2026). A `record` - it
 * is touched, so it is a card with the shadow and nothing inside it is a card - that gives under the finger as one object. There is no
 * clock rail and no line beside it: the time is its FIRST line, in Serbian time ("09:00–11:00", "od 14:00", or its own words for a Dogovor
 * without an exact term, when they say more than the heading over it), and the day heading above says which day. Then the title with the
 * agreed amount beside it (or under it on a narrow screen), the chip with role · the other person, the place, and the orange lines (what
 * waits for you, "Preklapa se sa …"). A missing amount is a word, never "0 RSD"; an amount that is not known here is not drawn at all. A
 * finished thing is drawn quiet.
 *
 * A Dogovor under "Termin još nije dogovoren" is the same card, with two differences: it does not wear the plain chip "Dogovoren" (the
 * heading over it says the term is not agreed, and "Dogovoren" under it read as a contradiction on the owner's phone), and one that may ask
 * for a term ends with "Predloži termin", its own press under the body (a sibling of it, never inside it).
 */
export function AgendaRow({ entry, day, onOpen, onProposeTerm, overlap = null, zoneNote = false }: {
  entry: PlannerEntry; day: string; onOpen: (entry: PlannerEntry) => void;
  /** "Predloži termin": drawn under a Dogovor that has no term and may ask for one; without it the card has no such command. */
  onProposeTerm?: (entry: PlannerEntry) => void;
  /** "Preklapa se sa …", when another term of the day overlaps this one. */
  overlap?: string | null;
  /** The phone is not in Serbian time: the spoken time says whose clock it is, as the heading does for the eye. */
  zoneNote?: boolean;
}) {
  const scale = useTextScale();
  const { width } = useWindowDimensions();
  const { style: lift, give, settle } = usePressLift();
  // The screen's gutters and the card's padding and edge reduce the space for title + amount. Keep the original 360 dp two-column
  // allowance inside the card, not across the whole phone.
  const contentWidth = width - layout.gutter * 2 - (layout.card + ruleWidth) * 2;
  const beside = contentWidth >= 360 && scale < 1.3;
  const done = entry.done;
  const tone = done ? 'muted' : 'ink';
  const time = timeOf(entry, day);
  // Under "Termin još nije dogovoren" the plain "Dogovoren" is left out; every other word of standing ("Čeka potvrdu") is information.
  const agreedOnly = !entry.exact && 'key' in entry.status && entry.status.key === 'task.agreed';
  const others = [entry.role, entry.person].filter((part): part is string => !!part).join(' · ');
  const value = entry.amount === null ? null : entry.amount
    ? <T variant="priceRow" style={{ color: done ? sys.color.muted : sys.color.money, maxWidth: '100%', flexShrink: 1 }}>{entry.amount}</T>
    : <T variant="note" tone="muted">{BEZ_IZNOSA}</T>;
  const notes = [entry.note, overlap].filter((line): line is string => !!line);
  const spoken = [agreedOnly ? null : statusSpoken(entry.status), entry.role, time && zoneNote ? `${time}, po vremenu u Srbiji` : time, entry.person,
    entry.amount === null ? null : entry.amount || BEZ_IZNOSA, entry.place || null, ...notes]
    .filter((part): part is string => !!part).join(', ');
  const propose = entry.proposesTerm && onProposeTerm ? onProposeTerm : null;
  return <Animated.View style={lift}>
    <Surface kind="record">
      <Press accessibilityRole="button" accessibilityLabel={nameOf(entry)} accessibilityValue={{ text: spoken }} haptic="select"
        scaleTo={1} onPressIn={give} onPressOut={settle} onPress={() => onOpen(entry)} style={s.body}>
        {time ? <T variant="note" tone={entry.exact ? tone : 'muted'} style={s.time}>{time}</T> : null}
        <View style={beside ? s.titleRow : s.titleColumn}>
          <T variant="cardTitleCompact" numberOfLines={scale >= 1.3 ? 3 : 2}
            style={[{ color: done ? sys.color.muted : sys.color.ink }, beside && s.title]}>{entryTitle(entry)}</T>
          {value}
        </View>
        <View style={s.facts}>
          {agreedOnly ? null : <PlannerChip status={entry.status} />}
          {others ? <T variant="note" style={[s.factText, { color: done ? sys.color.muted : sys.color.fact }]}>{others}</T> : null}
        </View>
        {entry.place ? <T variant="note" style={{ color: done ? sys.color.muted : sys.color.fact }}>{entry.place}</T> : null}
        {notes.map(line => <View key={line} style={s.note}>
          <View style={s.noteDot} />
          <T variant="note" style={s.noteText}>{line}</T>
        </View>)}
      </Press>
      {propose ? <Press accessibilityRole="button" accessibilityLabel={`${PROPOSE_TERM_LABEL}. ${entryTitle(entry)}`} haptic="select"
        scaleTo={sys.motion.scale.button} onPress={() => propose(entry)} style={s.action}>
        <T variant="copy" tone="green" style={s.actionText}>{PROPOSE_TERM_LABEL}</T>
      </Press> : null}
    </Surface>
  </Animated.View>;
}

const s = StyleSheet.create({
  body: { gap: sys.space.xs },
  time: { fontVariant: ['tabular-nums'] },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  titleColumn: { gap: sys.space.xs },
  title: { flex: 1, minWidth: 0 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm, rowGap: sys.space.xs },
  factText: { flexShrink: 1 },
  // What waits for you, and a collision: an orange mark and the words in the ink made for orange on white.
  note: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  noteDot: { width: 6, height: 6, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  noteText: { flexShrink: 1, color: sys.color.attentionInk },
  // The command is a 48 dp touch under the body; it reaches into the card's own padding below, so the words keep the card's 16 around them.
  action: { alignSelf: 'flex-start', minHeight: layout.touch, justifyContent: 'center', marginTop: sys.space.xs, marginBottom: -sys.space.md },
  actionText: { fontWeight: '600' },
});
