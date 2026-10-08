import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { needScheduleText, readableTitle } from '../../data/needDetailPresentation';
import { ownTaskStanding } from '../../data/ownTaskStanding';
import { displaysUrgent } from '../../lib/needUrgency';
import { FactRow } from '../system/FactRow';
import { STATUS_CHIPS, StatusChip } from '../system/StatusChip';
import { Surface } from '../system/Surface';
import { useLayoutClass } from '../system/textScale';
import { sys } from '../system/tokens';
import { usePressLift } from '../system/usePressLift';
import { Press } from '../Press';
import { T } from '../Text';
import { NeedUrgencyBadge, useUrgencyClock } from './NeedUrgencyBadge';
import { MoneyLine, RecordFoot, recordBody, recordFlush } from './offer/RecordParts';
import { VALUE_WORDS, placesText, taskPlace, taskSpoken, taskValue } from './TaskFace';

/**
 * One of MY tasks in the "Moji zadaci" list (plan 2.2 and 3.5, owner 2026-10-07; composition spec 4.5, 2026-10-08). It is a
 * `Surface record` of at most 200 dp where it used to be 304, because it says the same things in one rhythm (16 inside, 12 between
 * the parts) instead of three lines of money, places, place and time each with its own picture:
 *
 *   1. the state, as the app's one `StatusChip` in the owner's eight words (Nacrt, Objavljen, Bira se · N, Dogovoren, U toku, Završen,
 *      Otkazan, Istekao); every row that has an honest word wears one (`ownTaskStanding` says which, and says nothing it cannot
 *      support). HITNO keeps its badge beside the chip (a word with a symbol, never a colour alone); it counts only until the
 *      server's expiry, on one clock;
 *   2. the title (18/24, two lines at most; the whole of it is what a screen reader hears) and, under it, ONE line of what it is
 *      worth: "2.000 RSD po osobi · 0/2 popunjeno", "Tražim ponude · 0/1 popunjeno". A word is never drawn as an amount;
 *   3. the two facts of where and when, as `FactRow`s;
 *   4. the ONE next step in grey words ("Imaš 3 prijave. Uporedi ih i izaberi."). When it is the way to the applications waiting for
 *      my choice it is the card's foot ("noga"), its own target under a line and never inside the body: one touch to the applications
 *      instead of two. Only a task that waits for my decision has a foot; any other next step is a sentence of the body.
 *
 * "Čeka prijave" is not a word of this row: it said "has applications" and read as "has none". The body opens the task, as it always
 * did. The frame gives under the finger as ONE object (`usePressLift`, the row rung, 0.985), and nothing moves under reduced motion.
 * The requirement of the task (a vehicle, a tool) is not drawn here: I wrote it, and the task shows it.
 */
function OwnTaskCardBase({ item, onOpen, onApplications, disabled = false }: {
  item: PotrebaProjekcija; onOpen: () => void;
  /** Opens the applications that wait for my choice. Without it the next step is still said, as a plain sentence. */
  onApplications?: () => void;
  disabled?: boolean;
}) {
  // The money line stacks only when the room is short (a window under 340 dp, or text scale 1.3 and up), never on an ordinary phone.
  const large = useLayoutClass().stacked;
  const title = readableTitle(item.naslov);
  const standing = ownTaskStanding(item);
  const chip = standing.chip;
  const urgencyNow = useUrgencyClock([item.urgency]);
  const urgent = displaysUrgent(item.urgency, urgencyNow);
  const value = taskValue(item);
  const place = taskPlace(item);
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  const foot = standing.toApplications && onApplications ? standing.next : null;
  const sentence = foot ? null : standing.next;
  const chipWords = chip ? `${STATUS_CHIPS[chip.status].word}${chip.detail ? `, ${chip.detail}` : ''}` : null;
  // A draft was never published, so it has no places to fill: "0/2 popunjeno" on it would count what does not exist.
  const draft = item.stanje === 'NACRT';
  const places = draft ? null : placesText(item.pokrivenost, 'owner');
  const spoken = taskSpoken({ status: chipWords, urgent, value, place: place.text, schedule, requirement: null, places: places?.spoken ?? null, next: sentence });
  const lift = usePressLift();

  return <Animated.View style={lift.style}>
    <Surface kind="record" style={recordFlush}>
      <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak ${title}`} accessibilityValue={{ text: spoken }}
        accessibilityState={{ disabled }} disabled={disabled} onPress={onOpen} onPressIn={lift.give} onPressOut={lift.settle} haptic="select" scaleTo={1}
        style={recordBody}>
        {chip || urgent ? <View style={s.top}>
          {/* The card is heard once, as one sentence (`taskSpoken`); its chip and badge are not stops of their own. */}
          {chip ? <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <StatusChip status={chip.status} detail={chip.detail} /></View> : <View style={s.grow} />}
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><NeedUrgencyBadge urgency={item.urgency} now={urgencyNow} /></View>
        </View> : null}
        <View style={s.what}>
          <T variant="heading" numberOfLines={2}>{title}</T>
          <MoneyLine amount={value.kind === 'amount' ? value.amount : null} word={value.kind === 'amount' ? null : VALUE_WORDS[value.kind]}
            basis={value.kind === 'amount' ? value.basis : null} notes={[places?.text]} stacked={large} />
        </View>
        <View style={s.facts}>
          <FactRow art={place.remote ? 'remote' : 'pin'} value={place.text} />
          <FactRow art="calendar" value={schedule} />
        </View>
        {sentence ? <T variant="note" tone="muted">{sentence}</T> : null}
      </Press>
      {foot ? <RecordFoot label={foot} tone="muted" accessibilityLabel={`${foot} Zadatak: ${title}`} accessibilityHint="Otvara prijave za izbor."
        disabled={disabled} onPress={onApplications!} onPressIn={lift.give} onPressOut={lift.settle} /> : null}
    </Surface>
  </Animated.View>;
}
export const OwnTaskCard = memo(OwnTaskCardBase);

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.sm },
  grow: { flex: 1 },
  what: { gap: sys.space.sm },
  facts: { gap: sys.space.sm },
});
