import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { PotrebaProjekcija } from '../../../contracts/projections';
import { needScheduleText, readableTitle } from '../../../data/needDetailPresentation';
import { ownTaskStanding } from '../../../data/ownTaskStanding';
import { displaysUrgent } from '../../../lib/needUrgency';
import { FactRow } from '../../system/FactRow';
import { STATUS_CHIPS, StatusChip } from '../../system/StatusChip';
import { Surface } from '../../system/Surface';
import { useLayoutClass } from '../../system/textScale';
import { sys } from '../../system/tokens';
import { usePressLift } from '../../system/usePressLift';
import { Press } from '../../Press';
import { T } from '../../Text';
import { NeedUrgencyBadge, useUrgencyClock } from '../../v2/NeedUrgencyBadge';
import { MoneyLine, RecordFoot, recordBody, recordFlush } from '../../v2/offer/RecordParts';
import { VALUE_WORDS, placesText, taskPlace, taskSpoken, taskValue } from '../../v2/TaskFace';
import type { Kadar } from './kadar';
import { PecatVar } from './PecatVar';

/**
 * One of MY tasks in variant C of Moji zadaci, "Noga koja uskače" (V1, creative direction 2026-10-08; starting point: the motion): a
 * LOCAL copy of `OwnTaskCard` with two changes. (1) The foot that opens the applications waiting for my choice is the ORANGE foot
 * (the dot and the words in the waiting ink), and it is the only division of the list: what waits for me stands first and wears it,
 * everything else is quiet. (2) When the state of a task changes while you look (a draft you published becomes "Objavljen"), the
 * chip lands on the card as a stamp (B3: the CONTAINER scales 1,25 → 1 and fades in; the word inside is final from the first frame,
 * never animated as text). Everything else is the production card. `kadar` (lab) freezes the stamp.
 */
export function OwnTaskCardVarC({ item, onOpen, onApplications, stamp = false, kadar = null }: {
  item: PotrebaProjekcija; onOpen: () => void; onApplications?: () => void;
  /** The chip just changed while the person looks: it lands as a stamp. */ stamp?: boolean; kadar?: Kadar;
}) {
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
  const draft = item.stanje === 'NACRT';
  const places = draft ? null : placesText(item.pokrivenost, 'owner');
  const spoken = taskSpoken({ status: chipWords, urgent, value, place: place.text, schedule, requirement: null, places: places?.spoken ?? null, next: sentence });
  const lift = usePressLift();
  return <Animated.View style={lift.style}>
    <Surface kind="record" style={recordFlush}>
      <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak ${title}`} accessibilityValue={{ text: spoken }}
        onPress={onOpen} onPressIn={lift.give} onPressOut={lift.settle} haptic="select" scaleTo={1} style={recordBody}>
        {chip || urgent ? <View style={s.top}>
          {chip ? <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <PecatVar animate={stamp} kadar={kadar}><StatusChip status={chip.status} detail={chip.detail} /></PecatVar>
          </View> : <View style={s.grow} />}
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
      {foot ? <RecordFoot label={foot} tone="waiting" accessibilityLabel={`${foot} Zadatak: ${title}`} accessibilityHint="Otvara prijave za izbor."
        onPress={onApplications!} onPressIn={lift.give} onPressOut={lift.settle} /> : null}
    </Surface>
  </Animated.View>;
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.sm },
  grow: { flex: 1 },
  what: { gap: sys.space.sm },
  facts: { gap: sys.space.sm },
});
