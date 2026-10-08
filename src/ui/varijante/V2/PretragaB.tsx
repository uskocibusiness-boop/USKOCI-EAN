import { Fragment, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { layout, ruleWidth } from '../../system/layout';
import { Section } from '../../system/Section';
import { sys } from '../../system/tokens';
import { WHEN, datesWords, quoted, said } from '../../v2/discovery/discoveryWords';
import { SADA } from './fixtures';
import { KORACI, PRAZAN, PretragaList, PretragaPodnozje, SECTION_LABEL, Urednik, brojZadataka, type Izmena, type Korak, type Nacrt } from './pretragaShared';

/**
 * Deo rečenice za jedan korak: reči koje bi asistent rekao, u padežu rečenice („Svuda · bilo kada · bilo šta · bilo koja cena · 1 osoba · bilo
 * gde“). Imena mesta zadržavaju svoj oblik; „Svuda“ i „bilo koja cena“ su reči ove varijante (TEKSTOVI danas kaže „Svi zadaci“ i „Sve“).
 */
export function deoRecenice(step: Korak, n: Nacrt): string {
  switch (step) {
    case 'gde': return n.nearby ? 'u blizini' : n.place ? n.place : n.area ? 'u ovoj oblasti' : 'Svuda';
    case 'kada': return n.dates ? datesWords(n.dates, SADA) : n.when === 'any' ? 'bilo kada' : said(WHEN, n.when).toLocaleLowerCase('sr-Latn-RS');
    case 'sta': return n.query.trim() ? quoted(n.query) : 'bilo šta';
    case 'cena': return n.price === 'all' ? 'bilo koja cena' : n.price === 'MY_PRICE' ? 'navedena cena' : 'prima ponude';
    case 'koliko': return n.places > 1 ? `za ${n.places} i više` : '1 osoba';
    case 'kako': return n.where === 'any' ? 'bilo gde' : n.where === 'onsite' ? 'na licu mesta' : 'na daljinu';
  }
}

/**
 * Varijanta B pretrage „Pilula kao rečenica“ (iz reči; pravac D4 j: jezik asistenta preveden u filter, bez podvlake). Struktura: zatvoreni odeljci
 * su DELOVI JEDNE REČENICE na vrhu panela, svaki deo je čip (kontrola bez predmeta); dodir dela otvara njegov odeljak ispod, uvek tačno jedan.
 * Rečenica se na 361 dp prelama u dva reda (rizik iz nacrta, namerno zadržan da se vidi).
 */
export function PretragaB({ start = 'gde' }: { start?: Korak }) {
  const [n, setN] = useState<Nacrt>(PRAZAN);
  const [open, setOpen] = useState<Korak>(start);
  const [typed, setTyped] = useState('');
  const onChange: Izmena = patch => setN(current => ({ ...current, ...patch }));
  return <PretragaList footer={<PretragaPodnozje count={brojZadataka(n)} onReset={() => { setN(PRAZAN); setTyped(''); }} />}>
    <View style={s.recenica} accessibilityRole="tablist">
      {KORACI.map((step, index) => <Fragment key={step}>
        {index > 0 ? <T variant="note" tone="muted" accessible={false} importantForAccessibility="no">·</T> : null}
        <Press accessibilityRole="tab" accessibilityLabel={`${SECTION_LABEL[step]}: ${deoRecenice(step, n)}`} accessibilityState={{ selected: open === step }}
          onPress={() => { Keyboard.dismiss(); setOpen(step); }} haptic="select" hitSlop={{ top: sys.space.xs, bottom: sys.space.xs }}
          scaleTo={sys.motion.scale.button} style={[s.cip, open === step && s.cipOn]}>
          <T variant="note" style={[s.cipText, open === step && s.cipTextOn]}>{deoRecenice(step, n)}</T>
        </Press>
      </Fragment>)}
    </View>
    <View pointerEvents="none" style={s.rule} />
    <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
      <Section title={SECTION_LABEL[open]}>
        <Urednik step={open} n={n} onChange={onChange} typed={typed} onType={setTyped} />
      </Section>
    </ScrollView>
  </PretragaList>;
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  // Rečenica od čipova: 8 između delova, puna širina panela, 20 od ivice; prelama se kad mora.
  recenica: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: sys.space.base },
  // Čip 40 (D1 P6): kontrola bez predmeta; izabran je utonuo bunar bez boje sa ivicom u mastilu.
  cip: { minHeight: 40, paddingHorizontal: sys.space.md, paddingVertical: sys.space.sm, borderRadius: sys.radius.pill, borderWidth: ruleWidth,
    borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface, justifyContent: 'center', maxWidth: '100%' },
  cipOn: { backgroundColor: sys.color.wash, borderColor: sys.color.ink },
  cipText: { color: sys.color.ink, flexShrink: 1 },
  cipTextOn: { fontWeight: '600' },
  rule: { height: ruleWidth, backgroundColor: sys.color.line, marginHorizontal: layout.gutter },
  body: { paddingHorizontal: layout.gutter, paddingTop: sys.space.base, paddingBottom: sys.space.base },
});
