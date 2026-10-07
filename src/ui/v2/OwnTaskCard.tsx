import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { needScheduleText, readableTitle } from '../../data/needDetailPresentation';
import { ownTaskStanding } from '../../data/ownTaskStanding';
import { displaysUrgent } from '../../lib/needUrgency';
import { CalendarArt } from '../system/CalendarArt';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { useReducedMotion } from '../system/motion';
import { STATUS_CHIPS, StatusChip } from '../system/StatusChip';
import { useLayoutClass } from '../system/textScale';
import { cardCompact, raisedItem, sys } from '../system/tokens';
import { Press } from '../Press';
import { T } from '../Text';
import { NeedUrgencyBadge, useUrgencyClock } from './NeedUrgencyBadge';
import { CARD_PRESS_SCALE } from './TaskCard';
import { CardDecision, CardFact, CardPlaces, CardRequirement, CardTitle, faceStyles, placesText, taskPlace, taskRequirement, taskSpoken, taskValue } from './TaskFace';

/**
 * One of MY tasks in the "Moji zadaci" list (plan 2.2 and 3.5, owner 2026-10-07). The same facts as the task card, in its order — the
 * title, the value and the places, where, when, a requirement — with the two things this list is for:
 *
 *   1. the state, as the app's one `StatusChip` in the owner's eight words (Nacrt, Objavljen, Bira se · N, Dogovoren, U toku, Završen,
 *      Otkazan, Istekao); every row that has an honest word wears one (`ownTaskStanding` says which, and says nothing it cannot support);
 *   2. the ONE next step, in grey words ("Imaš 3 prijave. Uporedi ih i izaberi."). When it is the way to the applications waiting for my
 *      choice it is the row's foot, its own press beside the body and never inside it: one touch to the applications instead of two.
 *
 * "Čeka prijave" is not a word of this row: it said "has applications" and read as "has none". The body opens the task, as it always did.
 * The frame gives under the finger as one object, as the task card's does, and nothing moves under reduced motion. HITNO keeps its badge
 * beside the chip (a word with a symbol, never a colour alone); it counts only until the server's expiry, on one clock.
 */

const EASE_OUT = Easing.bezier(...sys.motion.easeOut);

function OwnTaskCardBase({ item, onOpen, onApplications, disabled = false }: {
  item: PotrebaProjekcija; onOpen: () => void;
  /** Opens the applications that wait for my choice. Without it the next step is still said, as a plain sentence. */
  onApplications?: () => void;
  disabled?: boolean;
}) {
  // The head and the foot stack only when the room is short (a window under 340 dp, or text scale 1.3 and up), never on an ordinary phone.
  const large = useLayoutClass().stacked;
  const reduced = useReducedMotion();
  const title = readableTitle(item.naslov);
  const standing = ownTaskStanding(item);
  const chip = standing.chip;
  const urgencyNow = useUrgencyClock([item.urgency]);
  const urgent = displaysUrgent(item.urgency, urgencyNow);
  const value = taskValue(item);
  const place = taskPlace(item);
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  const requirement = taskRequirement(item);
  const foot = standing.toApplications && onApplications ? standing.next : null;
  const sentence = foot ? null : standing.next;
  const chipWords = chip ? `${STATUS_CHIPS[chip.status].word}${chip.detail ? `, ${chip.detail}` : ''}` : null;
  // A draft was never published, so it has no places to fill: "0/2 popunjeno" on it would count what does not exist.
  const draft = item.stanje === 'NACRT';
  const spoken = taskSpoken({ status: chipWords, urgent, value, place: place.text, schedule, requirement,
    places: draft ? null : placesText(item.pokrivenost, 'owner').spoken, next: sentence });

  const scale = useSharedValue(1);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const give = () => { if (!reduced) scale.set(withTiming(CARD_PRESS_SCALE, { duration: sys.motion.press, easing: EASE_OUT })); };
  // Put back at once under reduced motion, even if the setting changed mid-press.
  const settle = () => { scale.set(reduced ? 1 : withSpring(1, { ...sys.motion.spring, reduceMotion: ReduceMotion.System })); };

  return <Animated.View style={[s.card, lift]}>
    <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak ${title}`} accessibilityValue={{ text: spoken }}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onOpen} onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1}
      style={s.body}>
      {chip || urgent ? <View style={s.top}>
        {/* The card is heard once, as one sentence (`taskSpoken`); its chip and badge are not stops of their own. */}
        {chip ? <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <StatusChip status={chip.status} detail={chip.detail} /></View> : <View style={s.grow} />}
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><NeedUrgencyBadge urgency={item.urgency} now={urgencyNow} /></View>
      </View> : null}
      <View style={s.summary}>
        <CardTitle title={title} lines={0} style={s.title} />
        <CardDecision value={value} large={large} places={draft ? null : <CardPlaces places={item.pokrivenost} audience="owner" large />} />
      </View>
      <View style={s.facts}>
        <CardFact art={<FactArt kind={place.remote ? 'remote' : 'pin'} size={28} cut="art" role="location" />} text={place.text} lines={0} artSize={28} />
        <CardFact art={<CalendarArt size={28} quiet={disabled || item.stanje === 'ZATVORENA'} />} text={schedule} lines={0} artSize={28} />
        {requirement ? <CardRequirement requirement={requirement} artSize={28} role="skills" /> : null}
      </View>
      {sentence ? <T variant="note" tone="muted">{sentence}</T> : null}
    </Press>
    {/* No hit slop: the hairline is the border between the two targets, and a touch just above it opens the task. */}
    {foot ? <Press accessibilityRole="button" accessibilityLabel={`${foot} Zadatak: ${title}`} accessibilityHint="Otvara prijave za izbor."
      accessibilityState={{ disabled }} disabled={disabled} onPress={onApplications} onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1}
      hitSlop={0} style={faceStyles.footLink}>
      <T variant="note" tone="muted" style={s.footText}>{foot}</T>
      <Glyph name="caret-right" size={20} tone="muted" />
    </Press> : null}
  </Animated.View>;
}
export const OwnTaskCard = memo(OwnTaskCardBase);

const s = StyleSheet.create({
  card: { ...cardCompact, ...raisedItem, padding: 0 },
  body: { padding: sys.space.base, gap: sys.space.base, borderRadius: sys.radius.cardCompact },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.sm },
  grow: { flex: 1 },
  summary: { gap: sys.space.sm },
  title: { fontSize: 18, lineHeight: 24, letterSpacing: -0.3, color: sys.color.ink },
  facts: { gap: sys.space.sm },
  footText: { flex: 1, minWidth: 0 },
});
