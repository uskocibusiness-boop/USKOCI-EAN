import { StyleSheet, View } from 'react-native';
import type { PotrebaProjekcija } from '../../../contracts/projections';
import { needScheduleText } from '../../../data/needDetailPresentation';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { Surface } from '../../system/Surface';
import { useLayoutClass } from '../../system/textScale';
import { sys } from '../../system/tokens';
import { T } from '../../Text';
import { OFFERS_INFO, TaskDecisionValue } from './TaskDecision';

/** A single reading surface for the task's terms. Values come from the route's projection;
 * this composition neither confirms a location nor turns a budget into an agreed payment. */
export function TaskDetailSummary({ need, audience, place, remote, people, peopleNote }: {
  need: Pick<PotrebaProjekcija, 'rezimCene' | 'ponudjenaCena' | 'osnovaCene' | 'pokrivenost' | 'vremeTekst' | 'schedule' | 'taskTimezone'>;
  audience: 'owner' | 'worker'; place: string; remote: boolean;
  people?: string; peopleNote?: string;
}) {
  const { stacked } = useLayoutClass();
  const priced = need.rezimCene !== 'OFFERS' && !!need.ponudjenaCena;
  // Mode already has its own fact. Preserve every typed time bound and the task's timezone,
  // while letting the schedule formatter describe only flexibility for this remote mode.
  const time = remote && need.schedule?.kind === 'REMOTE_ANYTIME'
    ? needScheduleText({ ...need.schedule, kind: 'FLEXIBLE' }, need.taskTimezone)
    : audience === 'worker' && need.schedule ? needScheduleText(need.schedule, need.taskTimezone) : need.vremeTekst;
  return <Surface kind="panel" variant="outlined" density="comfortable" style={s.summary}>
    <View style={s.budget}>
      {priced ? <T variant="meta" tone="muted">Budžet</T> : null}
      <TaskDecisionValue need={need} size="summary" offersInfo={OFFERS_INFO[audience]} />
    </View>
    <View style={[s.facts, stacked && s.stacked]}>
      <SummaryFact stacked={stacked} label={remote ? 'Način rada' : 'Mesto'} art={remote ? 'remote' : 'pin'} value={place} />
      <SummaryFact stacked={stacked} label="Termin" art="calendar" value={time} />
    </View>
    {people ? <View style={s.people} accessible accessibilityLabel={`${people}${peopleNote ? `, ${peopleNote}` : ''}`}>
      <FactArt kind="users" size={28} />
      <View style={s.peopleCopy}>
        <T variant="bodyStrong">{people}</T>
        {peopleNote ? <T variant="note" tone="muted">{peopleNote}</T> : null}
      </View>
    </View> : null}
  </Surface>;
}

function SummaryFact({ label, art, value, stacked }: { label: string; art: FactArtKind; value: string; stacked: boolean }) {
  return <View style={[s.fact, stacked && s.stackedFact]} accessible accessibilityLabel={`${label}: ${value}`}>
    <View style={s.factLabel}>
      <FactArt kind={art} size={32} />
      <T variant="meta" tone="muted" style={s.label}>{label}</T>
    </View>
    <T variant="bodyStrong">{value}</T>
  </View>;
}

const s = StyleSheet.create({
  summary: { gap: sys.space.base },
  budget: { gap: sys.space.xs },
  facts: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.base,
    paddingTop: sys.space.base, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.line },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  fact: { flex: 1, minWidth: 0, gap: sys.space.sm },
  stackedFact: { flex: 0, width: '100%' },
  factLabel: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  label: { flexShrink: 1 },
  people: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  peopleCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
});
