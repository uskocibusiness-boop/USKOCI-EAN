import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { PLACES_MAX } from '../../../data/marketplaceView';
import { Press } from '../../Press';
import { T } from '../../Text';
import { withInter } from '../../interFont';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { Glyph } from '../../system/Glyph';
import { osoba } from '../../system/plural';
import { fieldBox, sys } from '../../system/tokens';

/** One set of choices, one of which is chosen (a radio group to a screen reader), with a quiet selected state. */
export function Choice<K extends string>({ label, options, value, compact = false, onChange }: {
  label: string; options: readonly (readonly [K, string])[]; value: K | null; compact?: boolean; onChange: (value: K) => void;
}) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={s.chips}>
    {options.map(([key, words]) => {
      const checked = key === value;
      // The 48 dp minimum and existing hit slop remain; text can wrap at larger system scales.
      return <Press key={key} accessibilityRole="radio" accessibilityLabel={words} accessibilityState={{ checked }} aria-checked={checked}
        haptic="select" scaleTo={sys.motion.scale.button} hitSlop={{ top: sys.space.xs, bottom: sys.space.xs }} onPress={() => onChange(key)} style={[s.chip, checked && s.chipOn]}>
        {checked ? <Glyph name="check" size={16} /> : null}
        <T variant={compact ? 'note' : 'copy'} style={[s.chipText, checked && s.chipTextOn]}>{words}</T>
      </Press>;
    })}
  </View>;
}

/** "Broj ljudi": − n +; minus stops at one person, plus at `PLACES_MAX`. Large text gets the whole row. */
export function Stepper({ value, expanded, onChange }: { value: number; expanded: boolean; onChange: (value: number) => void }) {
  const low = value <= 1, high = value >= PLACES_MAX;
  return <View style={[s.stepper, expanded && s.stepperExpanded]}>
    <Press accessibilityRole="button" accessibilityLabel="Smanji broj osoba" accessibilityHint={low ? 'Najmanje je jedna osoba.' : undefined}
      accessibilityState={{ disabled: low }} disabled={low} haptic={low ? 'none' : 'select'} onPress={() => onChange(value - 1)} style={s.step}>
      <Glyph name="minus" size={24} tone={low ? 'muted' : 'ink'} /></Press>
    <T variant="bodyStrong" accessibilityLiveRegion="polite" style={s.stepValue}>{osoba(value)}</T>
    <Press accessibilityRole="button" accessibilityLabel="Povećaj broj osoba" accessibilityHint={high ? `Najviše ${PLACES_MAX} osoba.` : undefined}
      accessibilityState={{ disabled: high }} disabled={high} haptic={high ? 'none' : 'select'} onPress={() => onChange(value + 1)} style={s.step}>
      <Glyph name="plus" size={24} tone={high ? 'muted' : 'ink'} /></Press>
  </View>;
}

/**
 * The system's one text field, with the search glass before it and a clear button in it. The glass is a hint of what the
 * field does; the field's name is its `label`, spoken, and its placeholder is only the example.
 */
export function SearchField({ value, onChangeText, label, placeholder, clearLabel, returnKeyType, onSubmit, testID, maxLength = 1000 }: {
  value: string; onChangeText: (text: string) => void; label: string; placeholder: string; clearLabel: string;
  returnKeyType?: TextInputProps['returnKeyType']; onSubmit?: () => void; testID?: string; maxLength?: number;
}) {
  return <View style={s.field}>
    <Glyph name="search" tone="muted" />
    <TextInput testID={testID} accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={sys.color.muted}
      value={value} onChangeText={text => onChangeText(text.slice(0, maxLength))} maxLength={maxLength} style={s.input}
      returnKeyType={returnKeyType} onSubmitEditing={onSubmit} />
    {value ? <Press accessibilityRole="button" accessibilityLabel={clearLabel} haptic="select" hitSlop={0} style={s.clear}
      onPress={() => onChangeText('')}><Glyph name="close" size={16} /></Press> : null}
  </View>;
}

/**
 * A row of "Gde": its drawing, the place, one quiet line under it (how many tasks, or why there are none), and a tick when it
 * is the one chosen. The rows touch, so a row takes no touch beyond itself. A row that only leads on to more rows (a city whose
 * tasks are under its parts) is a button and has no tick to show.
 */
export function PlaceRow({ art, text, note, label, hint, role = 'radio', checked = false, onPress }: {
  art: FactArtKind; text: string; note?: string | null;
  /** What a screen reader says: the place and its count in one go. */ label: string; hint?: string;
  role?: 'radio' | 'button'; checked?: boolean; onPress: () => void;
}) {
  return <Press accessibilityRole={role} accessibilityLabel={label} accessibilityHint={hint}
    accessibilityState={role === 'radio' ? { checked } : undefined} aria-checked={role === 'radio' ? checked : undefined}
    haptic="select" scaleTo={sys.motion.scale.row} hitSlop={0} onPress={onPress} style={[s.place, checked && s.placeOn]}>
    <View style={s.well}><FactArt kind={art} size={24} /></View>
    <View style={s.grow}>
      <T variant="bodyStrong" style={s.ink} numberOfLines={2}>{text}</T>
      {note ? <T variant="note" tone="muted">{note}</T> : null}
    </View>
    {checked ? <Glyph name="check" tone="green" /> : role === 'button' ? <Glyph name="caret-right" tone="muted" /> : null}
  </Press>;
}

/** The quiet title of a group of rows ("Popularni gradovi"): the list's own words, never a card. */
export function GroupTitle({ children }: { children: string }) {
  return <T variant="note" tone="muted" accessibilityRole="header" style={s.groupTitle}>{children}</T>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  ink: { color: sys.color.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  // Selection uses a quiet neutral well, ink outline and check; green belongs to the apply action.
  chip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 48, maxWidth: '100%', paddingHorizontal: sys.space.md,
    paddingVertical: sys.space.sm, borderRadius: sys.radius.control,
    borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  chipOn: { backgroundColor: sys.color.wash, borderColor: sys.color.ink },
  chipText: { fontWeight: '500', color: sys.color.ink, flexShrink: 1 },
  chipTextOn: { color: sys.color.ink, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.sm, width: sys.space.huge * 4 },
  stepperExpanded: { width: '100%' },
  step: { width: sys.touch.min, height: sys.touch.min, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong,
    alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: sys.color.ink, fontVariant: ['tabular-nums'], flex: 1, minWidth: 0, textAlign: 'center' },
  // The one text field of the system, with the search glass before it and the clear button in it.
  field: { ...fieldBox, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingVertical: 0, paddingRight: sys.space.xs },
  input: withInter({ ...sys.type.body, color: sys.color.ink, flex: 1, minHeight: 48, paddingVertical: sys.space.sm }),
  clear: { width: 48, height: 48, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  // Place rows read as a list; only the chosen row has a neutral well and a check. The row's picture and words stand at the edge of the list (the
  // section names above them), and the chosen row's well reaches 8 beyond it, so a tint never makes the words step in.
  place: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 56, marginHorizontal: -sys.space.sm, paddingHorizontal: sys.space.sm,
    paddingVertical: sys.space.sm, borderRadius: sys.radius.control },
  placeOn: { backgroundColor: sys.color.greenSoft },
  well: { width: sys.space.xxl, height: sys.space.xxl, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { paddingTop: sys.space.md, fontWeight: '600' },
});
