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
 * One thing of mine in the planner: a Dogovor, one of my published tasks, or one of my open applications (composition spec 4.10). A
 * `record` - it is touched, so it is a card with the shadow and nothing inside it is a card - that gives under the finger as one
 * object. There is no clock rail and no line beside it: the time is its FIRST line, in Serbian time ("09:00–11:00", "od 14:00", or
 * its own words for a thing without an exact term), and the day heading above says which day. Then the title with the agreed amount
 * beside it (or under it on a narrow screen), the chip with role · the other person, the place, and the orange lines (what waits for
 * you, "Preklapa se sa …"). A missing amount is a word, never "0 RSD"; an amount that is not known here is not drawn at all. A
 * finished thing is drawn quiet. An application says what it is in its chip ("Prijava poslata", a ring: it waits for someone else), so
 * it has no dashed edge of its own and no role line.
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
  const { style: lift, give, settle } = usePressLift();
  // The screen's gutters and the card's padding and edge reduce the space for title + amount. Keep the original 360 dp two-column
  // allowance inside the card, not across the whole phone.
  const contentWidth = width - layout.gutter * 2 - (layout.card + ruleWidth) * 2;
  const beside = contentWidth >= 360 && scale < 1.3;
  const done = entry.done;
  const tone = done ? 'muted' : 'ink';
  const time = timeOf(entry, day);
  // The role is said by the chip for an application ("Prijava poslata" - "Tvoja prijava" would say it twice); it stays in the spoken line.
  const others = [entry.kind === 'prijava' ? null : entry.role, entry.person].filter((part): part is string => !!part).join(' · ');
  const value = entry.amount === null ? null : entry.amount
    ? <T variant="priceRow" style={{ color: done ? sys.color.muted : sys.color.money, maxWidth: '100%', flexShrink: 1 }}>{entry.amount}</T>
    : <T variant="note" tone="muted">{BEZ_IZNOSA}</T>;
  const notes = [entry.note, overlap].filter((line): line is string => !!line);
  const spoken = [statusSpoken(entry.status), entry.role, time && zoneNote ? `${time}, po vremenu u Srbiji` : time, entry.person,
    entry.amount === null ? null : entry.amount || BEZ_IZNOSA, entry.place || null, ...notes]
    .filter((part): part is string => !!part).join(', ');
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
          <PlannerChip status={entry.status} />
          {others ? <T variant="note" style={[s.factText, { color: done ? sys.color.muted : sys.color.fact }]}>{others}</T> : null}
        </View>
        {entry.place ? <T variant="note" style={{ color: done ? sys.color.muted : sys.color.fact }}>{entry.place}</T> : null}
        {notes.map(line => <View key={line} style={s.note}>
          <View style={s.noteDot} />
          <T variant="note" style={s.noteText}>{line}</T>
        </View>)}
      </Press>
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
});
