import { StyleSheet, View } from 'react-native';
import type { PotrebaProjekcija } from '../../../contracts/projections';
import { needScheduleText } from '../../../data/needDetailPresentation';
import { FactRow } from '../../system/FactRow';
import { Surface } from '../../system/Surface';
import { sys } from '../../system/tokens';
import { OFFERS_INFO, TaskDecisionValue } from './TaskDecision';
import { TaskCapacity } from './TaskCapacity';

/** The task's capacity, budget and labeled facts. Values come from the route's projection;
 * this composition neither confirms a location nor turns a budget into an agreed payment. */
export function TaskDetailSummary({ need, audience, place, remote, people, peopleNote, draft = false }: {
  need: Pick<PotrebaProjekcija, 'rezimCene' | 'ponudjenaCena' | 'osnovaCene' | 'pokrivenost' | 'vremeTekst' | 'schedule' | 'taskTimezone'>;
  audience: 'owner' | 'worker'; place: string; remote: boolean;
  people?: string; peopleNote?: string;
  /** A draft describes its requirement; no selection has happened yet. */
  draft?: boolean;
}) {
  const priced = need.rezimCene !== 'OFFERS' && !!need.ponudjenaCena;
  // Mode already has its own fact. Preserve every typed time bound and the task's timezone,
  // while letting the schedule formatter describe only flexibility for this remote mode.
  const time = remote && need.schedule?.kind === 'REMOTE_ANYTIME'
    ? needScheduleText({ ...need.schedule, kind: 'FLEXIBLE' }, need.taskTimezone)
    : audience === 'worker' && need.schedule ? needScheduleText(need.schedule, need.taskTimezone) : need.vremeTekst;
  const value = <TaskDecisionValue need={need} size="summary" offersInfo={OFFERS_INFO[audience]} />;
  return <View style={s.summary}>
    {draft ? <FactRow art="users" value={people ?? 'Potrebni izvršioci'} note={peopleNote} />
      : <TaskCapacity capacity={need.pokrivenost} note={[people, peopleNote].filter(Boolean).join(' · ')} />}
    {priced ? value : <Surface kind="panel" variant="tinted" tone="info" density="comfortable">{value}</Surface>}
    <Surface kind="panel" variant="outlined" density="comfortable" style={s.facts}>
      <FactRow size="detail" label="Termin" art="calendar" value={time} />
      <FactRow size="detail" label={remote ? 'Način rada' : audience === 'worker' ? 'Približno mesto' : 'Mesto'}
        art={remote ? 'remote' : 'pin'} value={place} />
    </Surface>
  </View>;
}

const s = StyleSheet.create({
  summary: { gap: sys.space.base },
  facts: { flexDirection: 'column', gap: sys.space.lg },
});
