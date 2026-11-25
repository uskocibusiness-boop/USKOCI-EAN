import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { ProductSheet } from '../product/ProductSheet';
import { CivilField } from '../calendar/CalendarControls';
import { civilClock, civilInstant, zonedParts } from '../calendar/calendarPresentation';
import { serbianToday } from '../calendar/serbianDays';
import { CHIP_CHOSEN_INSET, chipChosen, sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import { needScheduleText } from '../../data/needDetailPresentation';
import { clearMyAgreementPeriod, setMyAgreementPeriod, type AgreementPeriod } from '../../data/agreementPeriodClientService';

const ZONE = 'Europe/Belgrade';
type Part = 'DAY' | 'MORNING' | 'AFTERNOON' | 'EXACT';
const PARTS: readonly { key: Part; label: string; from?: string; to?: string }[] = [
  { key: 'DAY', label: 'Ceo dan', from: '08:00', to: '16:00' },
  { key: 'MORNING', label: 'Pre podne', from: '08:00', to: '12:00' },
  { key: 'AFTERNOON', label: 'Posle podne', from: '12:00', to: '16:00' },
  { key: 'EXACT', label: 'Tačno vreme' },
];

/** My period as one short line, in Serbian time: "27. nov · 08:00–12:00". */
export function periodLine(period: Pick<AgreementPeriod, 'startsAt' | 'endsAt'>): string {
  return needScheduleText({ kind: 'FIXED_WINDOW', startsAt: period.startsAt, endsAt: period.endsAt }, ZONE).replace(/\s*\(po vremenu u Srbiji\)$/, '');
}

/**
 * "Vaše vreme za ovaj posao" (owner, 25.11.2026): each side marks its own day and time for one Dogovor. Only the author sees
 * it; it fills their schedule, and another Dogovor at the same time is said, never refused. The exact hour is arranged in Poruke.
 */
export function MyPeriodSheet({ agreementId, current, onClose, onSaved }: {
  agreementId: string; current: AgreementPeriod | null; onClose: () => void; onSaved: (period: AgreementPeriod | null) => void;
}) {
  const start = current ? zonedParts(new Date(current.startsAt), ZONE) : null, end = current ? zonedParts(new Date(current.endsAt), ZONE) : null;
  const known = start && end ? PARTS.find(part => part.from === civilClock(start.time) && part.to === civilClock(end.time) && start.date === end.date) : null;
  const [date, setDate] = useState(start?.date ?? serbianToday());
  const [part, setPart] = useState<Part>(current ? known?.key ?? 'EXACT' : 'DAY');
  const [from, setFrom] = useState(start ? civilClock(start.time) : '09:00');
  const [to, setTo] = useState(end ? civilClock(end.time) : '13:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlap, setOverlap] = useState(false);

  const save = async (dismiss: () => void) => {
    const chosen = PARTS.find(p => p.key === part)!;
    const a = civilInstant(date, chosen.from ?? from, ZONE), b = civilInstant(date, chosen.to ?? to, ZONE);
    if (!a.value || !b.value) { setError(a.error ?? b.error); return; }
    if (Date.parse(b.value) <= Date.parse(a.value)) { setError('Kraj mora biti posle početka.'); return; }
    setBusy(true); setError(null);
    const result = await setMyAgreementPeriod(agreementId, new Date(a.value), new Date(b.value));
    setBusy(false);
    if (!result.ok) { setError(result.poruka); return; }
    onSaved({ agreementId, startsAt: result.podatak.startsAt, endsAt: result.podatak.endsAt });
    if (result.podatak.overlaps.length) setOverlap(true); else dismiss();
  };
  const clear = async (dismiss: () => void) => {
    setBusy(true); setError(null);
    const result = await clearMyAgreementPeriod(agreementId);
    setBusy(false);
    if (!result.ok) { setError(result.poruka); return; }
    onSaved(null); dismiss();
  };

  return <ProductSheet title="Vaše vreme za ovaj posao" onClose={onClose}
    footer={dismiss => overlap
      ? <V2Action tone="brand" label="U redu" onPress={dismiss} />
      : <View style={s.foot}>
        <V2Action tone="brand" label="Sačuvajte" disabled={busy} onPress={() => { void save(dismiss); }} />
        {current ? <V2Action tone="neutral" kind="quiet" label="Obrišite moje vreme" disabled={busy} onPress={() => { void clear(dismiss); }} /> : null}
      </View>}>
    {() => <View style={s.stack}>
      {overlap ? <T variant="bodyStrong" style={s.warn} accessibilityRole="alert">Sačuvano. Tada već imate drugi Dogovor.</T> : <>
        <T variant="note" tone="muted">Vidite ga samo Vi, u svom rasporedu.</T>
        <CivilField label="Dan" mode="date" value={date} onChange={setDate} disabled={busy} />
        <View accessibilityRole="radiogroup" style={s.chips}>
          {PARTS.map(p => <Press key={p.key} accessibilityRole="radio" accessibilityLabel={p.label} accessibilityState={{ checked: part === p.key, disabled: busy }}
            disabled={busy} haptic="select" onPress={() => setPart(p.key)} style={[s.chip, part === p.key && s.chipOn]}>
            <T variant="meta" style={[s.chipText, part === p.key && s.chipTextOn]}>{p.label}</T>
          </Press>)}
        </View>
        {part === 'EXACT' ? <View style={s.row}>
          <View style={s.flex}><CivilField label="Od" mode="time" value={from} onChange={setFrom} disabled={busy} /></View>
          <View style={s.flex}><CivilField label="Do" mode="time" value={to} onChange={setTo} disabled={busy} /></View>
        </View> : null}
        {error ? <T variant="note" tone="danger" accessibilityRole="alert">{error}</T> : null}
      </>}
    </View>}
  </ProductSheet>;
}

const s = StyleSheet.create({
  stack: { gap: sys.space.md },
  foot: { gap: sys.space.xs },
  row: { flexDirection: 'row', gap: sys.space.md },
  flex: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  chip: { minHeight: sys.touch.min, justifyContent: 'center', paddingHorizontal: 14, borderRadius: sys.radius.pill, borderWidth: 1,
    borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  chipOn: { ...chipChosen, paddingHorizontal: 14 - CHIP_CHOSEN_INSET },
  chipText: { color: sys.color.ink, fontWeight: '600' },
  chipTextOn: { color: sys.color.green },
  warn: { color: sys.color.warn },
});
