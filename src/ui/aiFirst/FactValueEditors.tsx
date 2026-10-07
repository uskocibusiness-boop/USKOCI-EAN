import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { CivilField } from '../calendar/CalendarControls';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { field, sys } from '../system/tokens';

/**
 * A moment, corrected with the pickers the app already has. The zone is said in words because the
 * review states every moment in it, and a time with no zone beside it reads as the phone's.
 */
export function FactTimestampEditor({ label, date, time, disabled, onChange }: {
  label: string; date: string; time: string; disabled: boolean; onChange: (date: string, time: string) => void;
}) {
  return <View style={s.stack}>
    <CivilField label={`${label}: datum`} mode="date" value={date} disabled={disabled} onChange={value => onChange(value, time)} />
    <CivilField label={`${label}: vreme`} mode="time" value={time} disabled={disabled} onChange={value => onChange(date, value.slice(0, 5))} />
    <T style={s.note}>Vreme u Beogradu.</T>
  </View>;
}

/**
 * A list, corrected item by item. What is typed and not yet added is reported upward as well, so
 * saving with a word still in the box keeps that word instead of dropping it without a sign.
 * The field is the app's one text field (`field`, 2026-09-24): its green outline was the loudest line on the review.
 */
export function FactListEditor({ label, items, disabled, onChange }: {
  label: string; items: readonly string[]; disabled: boolean; onChange: (items: string[], typed: string) => void;
}) {
  const [typed, setTyped] = useState('');
  const add = () => {
    const value = typed.trim();
    setTyped('');
    onChange(value && !items.includes(value) ? [...items, value] : [...items], '');
  };
  const addOff = disabled || !typed.trim();
  return <View style={s.stack}>
    {items.length ? <View style={s.items}>{items.map(item => <View key={item} style={s.item}>
      <T style={s.itemText}>{item}</T>
      <Press accessibilityRole="button" accessibilityLabel={`Ukloni: ${item}`} disabled={disabled} style={s.remove}
        onPress={() => onChange(items.filter(other => other !== item), typed)}>
        <Glyph name="close" tone="muted" />
      </Press>
    </View>)}</View> : <T style={s.note}>Još nema stavki.</T>}
    <View style={s.addRow}>
      <TextInput accessibilityLabel={`Nova stavka: ${label}`} value={typed} editable={!disabled} maxLength={500}
        placeholder="Dodaj stavku" placeholderTextColor={sys.color.muted} returnKeyType="done" onSubmitEditing={add}
        onChangeText={value => { setTyped(value); onChange([...items], value); }} style={s.input} />
      <Press accessibilityRole="button" accessibilityLabel={`Dodaj stavku: ${label}`} accessibilityState={{ disabled: addOff }}
        disabled={addOff} style={[s.add, addOff && s.addOff]} onPress={add}>
        <T style={[s.addLabel, addOff && s.addLabelOff]}>Dodaj</T>
      </Press>
    </View>
  </View>;
}

const s = StyleSheet.create({
  stack: { gap: 10 },
  note: { ...sys.type.meta, color: sys.color.muted },
  items: { gap: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, borderRadius: sys.radius.control,
    backgroundColor: sys.color.wash },
  itemText: { ...sys.type.body, color: sys.color.ink, flex: 1, minWidth: 0, paddingVertical: 10 },
  remove: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { ...field, flex: 1, minWidth: 0 },
  // An action that is not the screen's primary: white with the green label, the field's height beside it.
  add: { minHeight: field.minHeight, minWidth: 72, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
    borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  // Disabled is the quiet wash with muted words, never a faded ghost of the live control.
  addOff: { backgroundColor: sys.color.wash, borderColor: sys.color.line },
  addLabel: { ...sys.type.meta, fontWeight: '600', color: sys.color.green },
  addLabelOff: { color: sys.color.muted },
});
