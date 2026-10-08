import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { PotrebaProjekcija } from '../../../contracts/projections';
import { needScheduleText, readableTitle } from '../../../data/needDetailPresentation';
import { ownTaskStanding } from '../../../data/ownTaskStanding';
import { displaysUrgent } from '../../../lib/needUrgency';
import { FactRow } from '../../system/FactRow';
import { Surface } from '../../system/Surface';
import { useLayoutClass } from '../../system/textScale';
import { sys } from '../../system/tokens';
import { usePressLift } from '../../system/usePressLift';
import { Press } from '../../Press';
import { T } from '../../Text';
import { NeedUrgencyBadge, useUrgencyClock } from '../../v2/NeedUrgencyBadge';
import { MoneyLine, RecordFoot, recordBody, recordFlush } from '../../v2/offer/RecordParts';
import { VALUE_WORDS, placesText, taskPlace, taskSpoken, taskValue } from '../../v2/TaskFace';

/**
 * One of MY tasks in variant A of Moji zadaci, "Papir na stolu" (V1, creative direction 2026-10-08): a LOCAL copy of `OwnTaskCard`
 * with ONE change. The list is grouped by phase (Čeka tvoj izbor · Objavljeno · Dogovoreno), so the group's title already says the
 * state, and the card does NOT wear the state chip a second time (the risk the direction names: a division said twice). HITNO keeps
 * its badge. Everything else is the production card: the title, the one line of what it is worth, the two facts, the one next step,
 * and the foot that opens the applications waiting for my choice. If A is chosen, `OwnTaskCard` gains `sectionSays?: boolean`.
 */
export function OwnTaskCardVarA({ item, onOpen, onApplications }: { item: PotrebaProjekcija; onOpen: () => void; onApplications?: () => void }) {
  const large = useLayoutClass().stacked;
  const title = readableTitle(item.naslov);
  const standing = ownTaskStanding(item);
  const urgencyNow = useUrgencyClock([item.urgency]);
  const urgent = displaysUrgent(item.urgency, urgencyNow);
  const value = taskValue(item);
  const place = taskPlace(item);
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  const foot = standing.toApplications && onApplications ? standing.next : null;
  const sentence = foot ? null : standing.next;
  const draft = item.stanje === 'NACRT';
  const places = draft ? null : placesText(item.pokrivenost, 'owner');
  const spoken = taskSpoken({ status: null, urgent, value, place: place.text, schedule, requirement: null, places: places?.spoken ?? null, next: sentence });
  const lift = usePressLift();
  return <Animated.View style={lift.style}>
    <Surface kind="record" style={recordFlush}>
      <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak ${title}`} accessibilityValue={{ text: spoken }}
        onPress={onOpen} onPressIn={lift.give} onPressOut={lift.settle} haptic="select" scaleTo={1} style={recordBody}>
        {urgent ? <View style={s.top}><View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><NeedUrgencyBadge urgency={item.urgency} now={urgencyNow} /></View></View> : null}
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
        onPress={onApplications!} onPressIn={lift.give} onPressOut={lift.settle} /> : null}
    </Surface>
  </Animated.View>;
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: sys.space.sm },
  what: { gap: sys.space.sm },
  facts: { gap: sys.space.sm },
});
