import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { WorkerAvailabilityView } from '../../hooks/useWorkerAvailability';
import { raspon } from '../../lib/vreme';
import { civilClock, civilDay, scheduleZone, weekdays } from '../calendar/calendarPresentation';
import { T } from '../Text';
import { sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';

/** Facts from a confirmed own-account read, never a draft or inferred free time.
 * Existing Agreement bookings remain authoritative over declared availability. */
export function SavedAvailability({ view, retry, disabled }: {
  view?: WorkerAvailabilityView; retry?: () => void; disabled: boolean;
}) {
  if (!view || view.kind === 'unavailable') return <View style={s.group}>
    <T testID="saved-availability-unavailable" variant="note" tone="muted">Sačuvani raspored trenutno nije dostupan.</T>
    {retry ? <V2Action label="Proverite sačuvani raspored" tone="neutral" kind="quiet" compact disabled={disabled} onPress={retry} /> : null}
  </View>;
  if (view.kind === 'loading') return <T testID="saved-availability-loading" variant="note" tone="muted">Učitavamo sačuvani raspored…</T>;
  return <Schedule key={`${view.value.accountId}:${view.value.profileId}:${view.value.revision}`} value={view.value} />;
}

function Schedule({ value }: { value: Extract<WorkerAvailabilityView, { kind: 'ready' }>['value'] }) {
  const [limit, setLimit] = useState(8);
  const rows = [
    ...value.rules.map(rule => ({ key: `rule:${rule.id}`, title: weekdays.filter(day => rule.weekdays.includes(day.day)).map(day => day.short).join(' · '),
      text: `${civilClock(rule.startTime)}–${civilClock(rule.endTime)} · od ${civilDay(rule.startsOn)}${rule.endsOn ? ' do ' + civilDay(rule.endsOn) : ''}${rule.active ? '' : ' · pauzirano'}${rule.label ? ' · ' + rule.label : ''}` })),
    ...value.windows.map(window => ({ key: `window:${window.id}`, title: window.state === 'AVAILABLE' ? 'Slobodno za rad' : 'Zauzeto',
      text: `${raspon(window.startsAt, window.endsAt, { zona: value.timezone })}${window.label ? ' · ' + window.label : ''}` })),
  ];
  return <View testID="saved-availability-facts" style={s.group}>
    {!value.rules.length ? <T variant="note" tone="muted">Redovni termini nisu podešeni.</T> : null}
    {rows.slice(0, limit).map(row => <View key={row.key} style={s.row}>
      <T variant="bodyStrong">{row.title}</T><T selectable variant="note" tone="muted">{row.text}</T>
    </View>)}
    {rows.length > limit ? <V2Action label="Prikažite još termina" tone="neutral" kind="quiet" compact onPress={() => setLimit(count => count + 8)} /> : null}
    <T variant="note" tone="muted">{scheduleZone(value.timezone)}. Potvrđeni Dogovori ostaju obaveze.</T>
  </View>;
}
const s = StyleSheet.create({ group: { gap: sys.space.md }, row: { gap: sys.space.xs } });
