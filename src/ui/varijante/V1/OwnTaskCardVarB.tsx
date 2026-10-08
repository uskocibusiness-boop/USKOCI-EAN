import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { PotrebaProjekcija } from '../../../contracts/projections';
import { needScheduleText, readableTitle } from '../../../data/needDetailPresentation';
import { endingOf } from '../../../data/needEnding';
import { ownTaskStanding } from '../../../data/ownTaskStanding';
import { displaysUrgent } from '../../../lib/needUrgency';
import { STATUS_CHIPS } from '../../system/StatusChip';
import { Surface } from '../../system/Surface';
import { sys } from '../../system/tokens';
import { usePressLift } from '../../system/usePressLift';
import { Press } from '../../Press';
import { T } from '../../Text';
import { NeedUrgencyBadge, useUrgencyClock } from '../../v2/NeedUrgencyBadge';
import { RecordFoot, recordBody, recordFlush } from '../../v2/offer/RecordParts';
import { VALUE_WORDS, taskPlace, taskValue } from '../../v2/TaskFace';

/**
 * One of MY tasks in variant B of Moji zadaci, "Dva broja" (V1, creative direction 2026-10-08; starting point: the number, B5).
 *
 * The card LEADS WITH TWO NUMBERS, in the voice of money (`priceSmall` 20/26, 700, tabular) with their words small and grey before
 * them: "Prijave 3 · Dogovoreno 0 od 2". The title (16/600) follows, with the amount at its end (`priceRow`) or the word that stands
 * for no amount, and the two facts are ONE grey line of text ("Grbavica, Novi Sad · 24. okt · 10:00–12:00"), no pictures. The foot
 * that opens the applications waiting for my choice stays. About 150–170 dp.
 *
 * TRUTH. "Prijave" is drawn only when the server gave the count (`brojPrijavaZaIzbor`); unknown says nothing, never 0. "Dogovoreno
 * 0 od 2" are the agreed places of the task's own coverage, in WORDS ("od"), never "0/2" (the public card says "0/2 mesta": the two
 * must not collide, the risk the direction names). A draft has no numbers (nothing was published) and says "Nacrt · nije objavljen";
 * a closed task says its ending in the owner's word (Završen, Otkazan, Istekao).
 */
export function OwnTaskCardVarB({ item, onOpen, onApplications }: { item: PotrebaProjekcija; onOpen: () => void; onApplications?: () => void }) {
  const title = readableTitle(item.naslov);
  const standing = ownTaskStanding(item);
  const urgencyNow = useUrgencyClock([item.urgency]);
  const urgent = displaysUrgent(item.urgency, urgencyNow);
  const value = taskValue(item);
  const place = taskPlace(item);
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  const foot = standing.toApplications && onApplications ? standing.next : null;
  const numbers = brojevi(item);
  const spokenNumbers = numbers.kind === 'word' ? numbers.word : numbers.parts.map(part => `${part.label} ${part.value}`).join(', ');
  const spoken = [urgent ? 'HITNO' : null, spokenNumbers, value.kind === 'amount' ? `${value.amount}${value.basis ? ` ${value.basis}` : ''}` : VALUE_WORDS[value.kind],
    place.text, schedule, foot ? null : standing.next].filter(Boolean).join(', ');
  const lift = usePressLift();
  return <Animated.View style={lift.style}>
    <Surface kind="record" style={recordFlush}>
      <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak ${title}`} accessibilityValue={{ text: spoken }}
        onPress={onOpen} onPressIn={lift.give} onPressOut={lift.settle} haptic="select" scaleTo={1} style={recordBody}>
        <View style={s.numbers} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {numbers.kind === 'word' ? <T variant="note" tone="muted">{numbers.word}</T>
            : numbers.parts.map((part, index) => <View key={part.label} style={s.part}>
              {index > 0 ? <T variant="meta" tone="muted" style={s.dot}>·</T> : null}
              <T variant="meta" tone="muted">{part.label}</T>
              <T variant="priceSmall" style={s.number}>{part.value}</T>
            </View>)}
          {urgent ? <View style={s.urgent}><NeedUrgencyBadge urgency={item.urgency} now={urgencyNow} /></View> : null}
        </View>
        <View style={s.head}>
          <T variant="bodyStrong" numberOfLines={2} style={s.title}>{title}</T>
          {value.kind === 'amount'
            ? <View style={s.value}><T variant="priceRow" style={s.amount}>{value.amount}</T>{value.basis ? <T variant="meta" tone="muted">{value.basis}</T> : null}</View>
            : <T variant="note" tone="muted" style={s.word}>{VALUE_WORDS[value.kind]}</T>}
        </View>
        <T variant="note" tone="muted">{place.text} · {schedule}</T>
      </Press>
      {foot ? <RecordFoot label={foot} tone="muted" accessibilityLabel={`${foot} Zadatak: ${title}`} accessibilityHint="Otvara prijave za izbor."
        onPress={onApplications!} onPressIn={lift.give} onPressOut={lift.settle} /> : null}
    </Surface>
  </Animated.View>;
}

type Brojevi = { kind: 'word'; word: string } | { kind: 'parts'; parts: { label: string; value: string }[] };

/** The two numbers of a task, or the one word when numbers would lie (a draft, a closed task, a count the server did not give). */
export function brojevi(item: PotrebaProjekcija): Brojevi {
  if (item.stanje === 'NACRT') return { kind: 'word', word: 'Nacrt · nije objavljen' };
  if (item.stanje === 'ZATVORENA') {
    const ending = endingOf(item);
    const word = ending === 'COMPLETED' ? STATUS_CHIPS['task.completed'].word : ending === 'CANCELLED' ? STATUS_CHIPS['task.cancelled'].word
      : ending === 'EXPIRED' ? STATUS_CHIPS['task.expired'].word : 'Zatvoren';
    return { kind: 'word', word: `${word} · ${item.vremeTekst}` };
  }
  const count = item.brojPrijavaZaIzbor;
  const known = typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
  const parts = [...(known ? [{ label: 'Prijave', value: String(count) }] : []), { label: 'Dogovoreno', value: `${item.pokrivenost.popunjeno} od ${item.pokrivenost.ukupno}` }];
  return { kind: 'parts', parts };
}

const s = StyleSheet.create({
  numbers: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.sm, rowGap: sys.space.xs },
  part: { flexDirection: 'row', alignItems: 'baseline', columnGap: sys.space.xs },
  dot: { paddingRight: sys.space.xs },
  number: { color: sys.color.ink },
  urgent: { marginLeft: 'auto' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  title: { flex: 1, minWidth: 0 },
  value: { alignItems: 'flex-end', flexShrink: 0 },
  amount: { color: sys.color.money },
  word: { flexShrink: 0, textAlign: 'right' },
});
