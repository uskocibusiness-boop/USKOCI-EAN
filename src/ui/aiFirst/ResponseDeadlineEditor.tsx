import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CivilField } from '../calendar/CalendarControls';
import { civilInstant, zonedParts } from '../calendar/calendarPresentation';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { sys } from '../system/tokens';

export function ResponseDeadlineEditor(p: { value: string | null; timezone: string; disabled: boolean; apply: (value: string | null) => void; cancel: () => void }) {
  const initial = p.value ? zonedParts(new Date(p.value), p.timezone) : { date: '', time: '' };
  const [date, setDate] = useState(initial.date), [time, setTime] = useState(initial.time), [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const apply = () => {
    if (p.disabled) return;
    const parsed = p.value && !changed ? { value: p.value, error: null } : civilInstant(date, time, p.timezone);
    if (!parsed.value) { setError(parsed.error); return; }
    if (Date.parse(parsed.value) <= Date.now()) { setError('Rok mora biti u budućnosti.'); return; }
    p.apply(parsed.value);
  };
  return <View style={s.stack}>
    {/* Serbian time is named the way the owner's rule says it (deep read 8.27); other zones keep their name. */}
    <T style={s.note}>{p.timezone === 'Europe/Belgrade' ? 'Datum i vreme po vremenu u Srbiji' : `Vremenska zona: ${p.timezone}`}</T>
    <CivilField label="Datum roka za prijave" mode="date" value={date} disabled={p.disabled} onChange={v => { setChanged(true); setError(null); setDate(v); }} />
    <CivilField label="Vreme roka za prijave" mode="time" value={time} disabled={p.disabled} onChange={v => { setChanged(true); setError(null); setTime(v); }} />
    {error ? <T accessibilityRole="alert" style={s.error}>{error}</T> : null}
    <V2Action label="Primeni rok na pregled" disabled={p.disabled || !date || !time} onPress={apply} />
    <V2Action label="Bez posebnog roka" kind="quiet" disabled={p.disabled} onPress={() => { if (!p.disabled) p.apply(null); }} />
    <V2Action label="Odustani od izmene roka" kind="quiet" disabled={p.disabled} onPress={p.cancel} />
  </View>;
}

// Read from `sys`, the one token surface (the conversation's own token file is a view onto it and is not needed here).
const s = StyleSheet.create({
  stack: { gap: sys.space.md },
  note: { ...sys.type.meta, color: sys.color.muted },
  error: { ...sys.type.meta, color: sys.color.danger },
});
