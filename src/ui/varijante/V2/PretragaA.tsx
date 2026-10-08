import { useState, type ReactNode } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { TurningCaret } from '../../system/Disclosure';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { Glyph } from '../../system/Glyph';
import { layout, ruleWidth } from '../../system/layout';
import { Surface } from '../../system/Surface';
import { sys } from '../../system/tokens';
import { PLACE_WORDS } from '../../v2/discovery/PlacePicker';
import { foldPlace } from '../../v2/discovery/popularCities';
import { GroupTitle, SearchField } from '../../v2/discovery/SearchParts';
import { DELOVI_LIMAN, GRADOVI, OBLAST_BROJ, SVUDA_BROJ } from './fixtures';
import { GRADOVI_BEZ, KORACI, PRAZAN, PretragaList, PretragaPodnozje, SECTION_LABEL, Urednik, brojZadataka, rezime, slovaPogadjaju, type Izmena, type Korak, type Nacrt } from './pretragaShared';

/** Širina vodeće kolone: u nju staje troctifren broj 16/700 ili reč „Još nema“ u 13/500; ista za sve redove, da se imena poravnaju. */
const VODECI = layout.slotFace;

/**
 * Varijanta A pretrage „Gradovi brojem“ (iz broja; pravac B5, odluka D1 P5). Struktura: redovi gradova BEZ pina: broj zadataka 16/700 tabular je
 * vodeći element reda, ime grada pored; pin 2.5D 28 samo uz „Ova oblast“ (mapa) i „U blizini“ (pin); grad bez zadataka ima „Još nema“ umesto
 * broja; redosled po broju pa po imenu. Otvoren odeljak stoji u `panel` okviru (čita se, ne dodiruje), zatvoreni su redovi kao danas. Uklanja
 * simptom „ista ikona tri puta“.
 */
export function PretragaA({ start = 'gde' }: { start?: Korak }) {
  const [n, setN] = useState<Nacrt>(PRAZAN);
  const [open, setOpen] = useState<Korak | null>(start);
  const [typed, setTyped] = useState('');
  const onChange: Izmena = patch => setN(current => ({ ...current, ...patch }));
  return <PretragaList footer={<PretragaPodnozje count={brojZadataka(n)} onReset={() => { setN(PRAZAN); setTyped(''); }} />}>
    <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.sections}>
      {KORACI.map((step, index) => <OdeljakA key={step} label={SECTION_LABEL[step]} summary={rezime(step, n)} open={open === step}
        last={index === KORACI.length - 1} onToggle={() => { Keyboard.dismiss(); setOpen(open === step ? null : step); }}>
        {step === 'gde' ? <GdeBrojem n={n} onChange={onChange} typed={typed} onType={setTyped} />
          : <Urednik step={step} n={n} onChange={onChange} typed={typed} onType={setTyped} />}
      </OdeljakA>)}
    </ScrollView>
  </PretragaList>;
}

/** Red odeljka: ime i, dok je zatvoren, šta je izabrano; otvoren drži svoj deo u panelu. Linija 1 dp deli odeljke, osim pod poslednjim. */
function OdeljakA({ label, summary, open, last, onToggle, children }: { label: string; summary: string; open: boolean; last: boolean; onToggle: () => void; children: ReactNode }) {
  return <View>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: summary }} accessibilityState={{ expanded: open }}
      onPress={onToggle} haptic="select" hitSlop={0} scaleTo={sys.motion.scale.row} style={s.header}>
      <View style={[s.copy, !open && s.summary]}>
        <T variant="bodyStrong" style={s.label}>{label}</T>
        {!open ? <T variant="note" tone="muted" style={s.value}>{summary}</T> : null}
      </View>
      <TurningCaret open={open} />
    </Press>
    {open ? <Surface kind="panel" style={s.panel}>{children}</Surface> : null}
    {last ? null : <View pointerEvents="none" style={s.rule} />}
  </View>;
}

/** „Gde“ kao brojevi: polje, pa redovi u kojima broj vodi; predmet samo tamo gde broja nema a mesto nije grad (oblast, blizina). */
function GdeBrojem({ n, onChange, typed, onType }: { n: Nacrt; onChange: Izmena; typed: string; onType: (text: string) => void }) {
  const typing = foldPlace(typed) !== '';
  const gradovi = [...GRADOVI].filter(grad => slovaPogadjaju(grad.text, typed))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.text.localeCompare(b.text, 'sr-Latn-RS'));
  const delovi = typing ? DELOVI_LIMAN.filter(deo => slovaPogadjaju(deo.text, typed)) : [];
  const bez = GRADOVI_BEZ.filter(city => slovaPogadjaju(city, typed));
  const svuda = !n.place && !n.area && !n.nearby;
  const pick = (patch: Partial<Nacrt>) => { onType(''); onChange({ place: null, area: false, nearby: false, ...patch }); };
  return <View style={s.urednik}>
    <SearchField value={typed} onChangeText={onType} label={PLACE_WORDS.field} placeholder={PLACE_WORDS.placeholder} clearLabel={PLACE_WORDS.clear}
      returnKeyType="search" onSubmit={Keyboard.dismiss} />
    <View accessibilityRole="radiogroup" accessibilityLabel="Mesta" style={s.lista}>
      {typing ? null : <>
        <RedBrojem count={SVUDA_BROJ} text="Svi zadaci" checked={svuda} onPress={() => pick({})} />
        <RedBrojem art="map" count={OBLAST_BROJ} text="Ova oblast" checked={n.area} onPress={() => pick({ area: true })} />
        <RedBrojem art="pin" count={null} text="U blizini" note={PLACE_WORDS.nearbyNote} checked={n.nearby} onPress={() => pick({ nearby: true })} />
      </>}
      {gradovi.length ? <GroupTitle>{PLACE_WORDS.citiesWithTasks}</GroupTitle> : null}
      {gradovi.map(grad => <RedBrojem key={grad.text} count={grad.count} text={grad.text} checked={n.place === grad.text} onPress={() => pick({ place: grad.text })} />)}
      {delovi.length ? <GroupTitle>{PLACE_WORDS.parts}</GroupTitle> : null}
      {delovi.map(deo => <RedBrojem key={deo.text} count={deo.count} text={deo.text} checked={n.place === deo.text} onPress={() => pick({ place: deo.text })} />)}
      {bez.length ? <GroupTitle>{PLACE_WORDS.popular}</GroupTitle> : null}
      {bez.map(city => <RedBrojem key={city} count={null} text={city} checked={n.place === city} onPress={() => pick({ place: city })} />)}
    </View>
  </View>;
}

/**
 * Red mesta sa brojem napred. Broj je u tipu `priceRow` (16/700 tabular): to nije novac, nego ista odluka glasa broja (B5), jedini 700 tabular 16
 * koji sistem ima; ako varijanta pobedi, dobija svoje ime u tokenima. Bez broja i bez predmeta stoji „Još nema“.
 */
function RedBrojem({ count, art, text, note, checked, onPress }: { count: number | null; art?: FactArtKind; text: string; note?: string; checked: boolean; onPress: () => void }) {
  const said = art ? (note ?? (count !== null ? `${count}` : '')) : count === null ? PLACE_WORDS.noTasksYet : `${count}`;
  return <Press accessibilityRole="radio" accessibilityLabel={`${text}${said ? `, ${said}` : ''}`} accessibilityState={{ checked }} aria-checked={checked}
    haptic="select" scaleTo={sys.motion.scale.row} hitSlop={0} onPress={onPress} style={[s.red, checked && s.redOn]}>
    <View style={s.vodeci}>
      {art ? <FactArt kind={art} size={28} />
        : count === null ? <T variant="meta" tone="muted" style={s.jos}>Još nema</T>
          : <T variant="priceRow" style={s.broj}>{count}</T>}
    </View>
    <View style={s.grow}>
      <T variant="body" style={s.ink}>{text}</T>
      {note ? <T variant="note" tone="muted">{note}</T> : null}
    </View>
    {checked ? <Glyph name="check" tone="green" /> : null}
  </Press>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  ink: { color: sys.color.ink },
  scroll: { flex: 1 },
  sections: { paddingHorizontal: layout.gutter, paddingBottom: sys.space.base },
  header: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.rowMinPlain, paddingVertical: sys.space.md },
  copy: { flex: 1, minWidth: 0 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.md },
  label: { flexShrink: 1 },
  value: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, maxWidth: '100%', textAlign: 'right' },
  panel: { marginBottom: sys.space.base },
  rule: { height: ruleWidth, backgroundColor: sys.color.line },
  urednik: { gap: sys.space.md },
  lista: { gap: sys.space.xs },
  // Red: 56 visok, broj desno poravnat u vodećoj koloni, ime posle; izabran = tih bunar bez boje.
  red: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.rowMinPlain, marginHorizontal: -sys.space.sm, paddingHorizontal: sys.space.sm,
    paddingVertical: sys.space.sm, borderRadius: sys.radius.control },
  redOn: { backgroundColor: sys.color.greenSoft },
  vodeci: { width: VODECI, alignItems: 'flex-end', justifyContent: 'center' },
  broj: { color: sys.color.ink, textAlign: 'right' },
  jos: { textAlign: 'right' },
});
