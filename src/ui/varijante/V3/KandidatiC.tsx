import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { KandidatProjekcija, PotrebaProjekcija } from '../../../contracts/projections';
import { readableTitle } from '../../../data/needDetailPresentation';
import { ProductHeader } from '../../product/ProductDetails';
import { FactRow } from '../../system/FactRow';
import { FlowFooter } from '../../system/FlowFooter';
import { layout } from '../../system/layout';
import { osoba } from '../../system/plural';
import { StateView } from '../../system/StateView';
import { brandAction, sys } from '../../system/tokens';
import { T } from '../../Text';
import { V2Action } from '../../v2/V2Action';
import { candidateHas, candidateStatus, candidateTerm, candidateValue, UNPRICED } from '../../v2/CandidateFace';
import { Screen } from '../../system/Screen';
import { Lice, Ocena, nazadNaSpisak, naScenu } from './pomocno';
import { razdvojIznos } from './podaci';

/**
 * Kandidati · varijanta C „Jedan po jedan“ (iz pokreta; pravac B4 Susret + B1).
 *
 * Šta vodi: JEDNA osoba u kadru, kao da sedi preko stola: lice 72 sa belom ivicom, ime, zvezdica, njena poruka u navodnicima
 * krupno (govor 16/26), pa iznos 24/700 i termin ispod kao odgovor na pitanje „koliko i kada“. Brojač „1 od 3“ i „Sledeća
 * prijava“ listaju; prelaz je prirodno listanje stranica (samo pomak i providnost, bez JS layout animacije). Izbor je u
 * podnožju: jedna zelena „Izaberi ovu prijavu“ sa razlogom iznad kad se ne može. Poređenje ostaje na dohvat: „Uporedi“
 * u traci vodi na tabelu (varijanta B), jer pager krije poređenje.
 *
 * Ovde se ništa ne animira samo od sebe: lice i brojevi stoje. U laboratoriji „Izaberi“ vodi na `dogovoreno-C`.
 */
export function KandidatiC({ need, candidates }: { need: PotrebaProjekcija; candidates: readonly KandidatProjekcija[] }) {
  const [sirina, setSirina] = useState(0);
  const [na, setNa] = useState(0);
  const pager = useRef<ScrollView>(null);
  const k = candidates[na];
  const naStranu = (index: number) => { const next = Math.max(0, Math.min(candidates.length - 1, index)); setNa(next); pager.current?.scrollTo({ x: next * sirina, animated: true }); };
  const prati = (event: NativeSyntheticEvent<NativeScrollEvent>) => { if (sirina) setNa(Math.round(event.nativeEvent.contentOffset.x / sirina)); };
  const razlog = k ? candidateStatus(k) : null;
  const footer = k ? <FlowFooter reason={razlog ? `${razlog.text.replace(/\.$/, '')}. Ovu prijavu sada ne možeš da izabereš.` : undefined}>
    <V2Action label="Izaberi ovu prijavu" style={brandAction} disabled={!k.mozeIzabrati} onPress={() => naScenu('dogovoreno-C')} />
    {na < candidates.length - 1 ? <V2Action label="Sledeća prijava" kind="quiet" onPress={() => naStranu(na + 1)} />
      : na > 0 ? <V2Action label="Prva prijava" kind="quiet" onPress={() => naStranu(0)} /> : null}
  </FlowFooter> : undefined;
  return <Screen kind="detail" scroll={false} footer={footer}
    header={<ProductHeader title="Prijave" backLabel="Nazad na zadatak" back={nazadNaSpisak} subtitle={readableTitle(need.naslov)}
      right={candidates.length > 1 ? <V2Action label="Uporedi" kind="quiet" compact onPress={() => naScenu('kandidati-B')} /> : undefined} />}>
    {!candidates.length ? <StateView kind="empty" art="offers" title="Još nema prijava" body="Kad neko pošalje prijavu za ovaj zadatak, videćeš je ovde."
      quiet={{ label: 'Osveži prijave', onPress: () => undefined }} />
      : <View style={s.okvir} onLayout={event => setSirina(Math.round(event.nativeEvent.layout.width))}>
        <T variant="meta" tone="muted" style={s.brojac} accessibilityLiveRegion="polite">{`${na + 1} od ${candidates.length}`}</T>
        {sirina ? <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={prati}
          contentContainerStyle={{ width: sirina * candidates.length }} style={s.pager}>
          {candidates.map(c => <View key={c.prijavaId} style={[s.strana, { width: sirina }]}><Osoba candidate={c} need={need} /></View>)}
        </ScrollView> : null}
      </View>}
  </Screen>;
}

/** Jedna strana: osoba, njena rečenica, pa iznos i termin kao odgovor. */
function Osoba({ candidate: k, need }: { candidate: KandidatProjekcija; need: PotrebaProjekcija }) {
  const value = candidateValue(k), has = candidateHas(k);
  const poruka = k.napomena?.trim();
  return <ScrollView contentContainerStyle={s.osoba} showsVerticalScrollIndicator={false}>
    <Lice inicijali={k.inicijali} size={72} istaknuto />
    <View style={s.identitet}>
      <T variant="title" accessibilityRole="header" style={s.ime}>{k.ime}</T>
      <Ocena candidate={k} />
    </View>
    {poruka ? <T variant="speech" style={s.govor}>{`„${poruka}“`}</T> : <T variant="note" tone="muted">Bez poruke.</T>}
    <View style={s.odgovor}>
      {value.kind === 'amount' ? <>
        <T variant="priceLarge" style={s.novac}>{razdvojIznos(value.amount)[0]}</T>
        <T variant="note" tone="muted">{`${razdvojIznos(value.amount)[1]} ${value.basis} · ${osoba(k.pokrivaMesta)}`.trim()}</T>
      </> : <T variant="bodyStrong" tone="muted">{`${UNPRICED} · ${osoba(k.pokrivaMesta)}`}</T>}
    </View>
    <View style={s.cinjenice}>
      <FactRow art="calendar" value={candidateTerm(k, need.taskTimezone, need.vremeTekst)} size="detail" />
      {has ? <FactRow art={has.art} value={has.text} size="detail" /> : null}
    </View>
  </ScrollView>;
}

const s = StyleSheet.create({
  okvir: { flex: 1 },
  brojac: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  pager: { flex: 1, marginHorizontal: -layout.gutter },
  strana: { flex: 1, paddingHorizontal: layout.gutter },
  osoba: { alignItems: 'center', gap: sys.space.base, paddingTop: sys.space.base, paddingBottom: layout.section },
  identitet: { alignItems: 'center', gap: sys.space.xs },
  ime: { color: sys.color.ink, textAlign: 'center' },
  govor: { color: sys.color.ink, textAlign: 'center', maxWidth: 300 },
  odgovor: { alignItems: 'center', gap: sys.space.xs, paddingTop: sys.space.sm },
  novac: { color: sys.color.money },
  cinjenice: { alignSelf: 'stretch', gap: sys.space.md, paddingTop: sys.space.sm },
});
