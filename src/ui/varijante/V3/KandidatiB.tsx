import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { KandidatProjekcija, PotrebaProjekcija } from '../../../contracts/projections';
import { readableTitle } from '../../../data/needDetailPresentation';
import { Press } from '../../Press';
import { ProductHeader } from '../../product/ProductDetails';
import { layout, ruleWidth } from '../../system/layout';
import { ListRow } from '../../system/ListRow';
import { osoba, prijava } from '../../system/plural';
import { Screen } from '../../system/Screen';
import { StateView } from '../../system/StateView';
import { sys } from '../../system/tokens';
import { T } from '../../Text';
import { V2Action } from '../../v2/V2Action';
import { candidateRatingFigure as figure } from '../../v2/ApplicationSelectionPresentation';
import { candidateHas, candidateTerm, candidateTrust, candidateValue, CandidateCard, UNPRICED } from '../../v2/CandidateFace';
import { Lice, nazadNaSpisak, naScenu } from './pomocno';
import { razdvojIznos } from './podaci';

/**
 * Kandidati · varijanta B „Tabela odmah“ (iz broja; pravac C.13 „Uporedi = prava tabela“, B5 glas broja + B3).
 *
 * Šta vodi: POREĐENJE je podrazumevani prikaz, ne drugi. Dve kolone, redovi Cena / Termin / Ljudi / Ima / Poruka, broj 20/700
 * tabular je najveća reč u ćeliji; tihi marker najbolje MERLJIVE vrednosti (tačka + reč „najniža“, „najviša“) stoji pod brojem,
 * nikad „najbolji“. Treća prijava je na dohvat bočnim skrolom i rečenica iznad tabele to kaže. „Lista“ je drugi prikaz i to su
 * današnje kartice (`CandidateCard`), neizmenjene. Bez ikona u ćelijama: tabela govori brojem i rečju.
 *
 * Nema pokreta pri učitavanju: brojevi se ne animiraju (tokeni R1–R8). Dodir kolone u laboratoriji vodi na `dogovoreno-B`.
 */
export function KandidatiB({ need, candidates }: { need: PotrebaProjekcija; candidates: readonly KandidatProjekcija[] }) {
  const [prikaz, setPrikaz] = useState<'tabela' | 'lista'>('tabela');
  const [sirina, setSirina] = useState(0);
  const places = need.pokrivenost.preostalo > 0 ? `Slobodna mesta: ${need.pokrivenost.preostalo} od ${need.pokrivenost.ukupno}` : 'Sva mesta su popunjena';
  const tabela = prikaz === 'tabela' && candidates.length > 1;
  // Dve kolone u širini ekrana; sa tri i više prijava kolone su malo uže, pa se treća vidi kao ivica i zove na skrol.
  const RAZMAK = sys.space.md;
  const kolona = sirina ? Math.floor((sirina - RAZMAK * 2) / (candidates.length > 2 ? 2.15 : 2)) : 0;
  const najniza = Math.min(...candidates.filter(k => k.stanje === 'SELECTABLE' && candidateValue(k).kind === 'amount').map(k => k.cena.iznos));
  const ocene = candidates.map(figure).filter((f): f is { rating: number; count: number } => !!f && f.count > 0).map(f => f.rating);
  const najvisa = ocene.length ? Math.max(...ocene) : null;
  return <Screen kind="detail" scroll={candidates.length > 0}
    header={<ProductHeader title={tabela ? 'Uporedi prijave' : 'Prijave'} backLabel="Nazad na zadatak" back={nazadNaSpisak}
      right={candidates.length > 1 ? <V2Action label={tabela ? 'Lista' : 'Tabela'} kind="quiet" compact onPress={() => setPrikaz(tabela ? 'lista' : 'tabela')} /> : undefined} />}>
    <View style={s.glava}>
      <ListRow title={readableTitle(need.naslov)} subtitle={places} last accessibilityLabel={`Zadatak: ${readableTitle(need.naslov)}. ${places}`} />
      {candidates.length ? <T variant="note" tone="muted">{`${prijava(candidates.length)}${tabela && candidates.length > 2 ? ' · prevuci ulevo za treću' : ''}`}</T> : null}
    </View>
    {!candidates.length ? <StateView kind="empty" art="offers" title="Još nema prijava" body="Kad neko pošalje prijavu za ovaj zadatak, videćeš je ovde."
      quiet={{ label: 'Osveži prijave', onPress: () => undefined }} />
      : tabela ? <View onLayout={event => setSirina(Math.round(event.nativeEvent.layout.width))}>
        {kolona ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabela}>
          <View>
            <View style={s.red}>
              {candidates.map(k => <Press key={k.prijavaId} accessibilityRole="button" accessibilityLabel={`Otvori prijavu: ${k.ime}, ${candidateTrust(k).spoken}`}
                accessibilityHint="Otvara celu prijavu." haptic="select" scaleTo={sys.motion.scale.row} onPress={() => naScenu('dogovoreno-B')} style={[s.celija, s.osoba, { width: kolona }]}>
                <Lice inicijali={k.inicijali} size={40} />
                <T variant="bodyStrong" style={s.ime}>{k.ime}</T>
                <Ocena k={k} najvisa={najvisa} />
              </Press>)}
            </View>
            <View style={s.linija} />
            <Red naziv="Cena" kolona={kolona} candidates={candidates} render={k => {
              const value = candidateValue(k);
              return <>
                {value.kind === 'amount' ? <T variant="priceSmall" style={s.novac}>{razdvojIznos(value.amount)[0]}</T> : <T variant="note" tone="muted">{UNPRICED}</T>}
                {value.kind === 'amount' ? <T variant="meta" tone="muted">{`${razdvojIznos(value.amount)[1]} ${value.basis}`.trim()}</T> : null}
                {value.kind === 'amount' && k.stanje === 'SELECTABLE' && k.cena.iznos === najniza ? <Marker rec="najniža" /> : null}
              </>; }} />
            <Red naziv="Termin" kolona={kolona} candidates={candidates} render={k => <T variant="note">{candidateTerm(k, need.taskTimezone, need.vremeTekst)}</T>} />
            <Red naziv="Ljudi" kolona={kolona} candidates={candidates} render={k => <T variant="bodyStrong">{osoba(k.pokrivaMesta)}</T>} />
            <Red naziv="Ima" kolona={kolona} candidates={candidates} render={k => { const has = candidateHas(k);
              return <T variant="note" tone={has ? 'ink' : 'muted'}>{has ? has.text.replace(/^Ima: /, '') : 'Nije navedeno'}</T>; }} />
            <Red naziv="Poruka" kolona={kolona} candidates={candidates} render={k => { const poruka = k.napomena?.trim();
              return <T variant="note" tone="muted" numberOfLines={3}>{poruka ? `„${poruka}“` : 'Bez poruke.'}</T>; }} />
            <Red naziv="Može se izabrati" kolona={kolona} candidates={candidates} render={k => <T variant="note" tone={k.mozeIzabrati ? 'green' : 'muted'}>{k.mozeIzabrati ? 'Da' : 'Sada ne'}</T>} last />
          </View>
        </ScrollView> : null}
      </View>
      : <View style={s.lista}>
        {candidates.map(k => <CandidateCard key={k.prijavaId} candidate={k} timezone={need.taskTimezone} fallbackTime={need.vremeTekst} onOpen={() => naScenu('dogovoreno-B')} large={false} />)}
      </View>}
  </Screen>;
}

/** Ocena u zaglavlju kolone: broj uz zvezdicu kao svuda; marker „najviša“ ispod kad je to merljivo. */
function Ocena({ k, najvisa }: { k: KandidatProjekcija; najvisa: number | null }) {
  const trust = candidateTrust(k), f = figure(k);
  return <View style={s.ocena}>
    <T variant="note" tone="muted" numberOfLines={2}>{trust.star ? `★ ${trust.text}` : trust.text}</T>
    {f && f.count > 0 && najvisa !== null && f.rating === najvisa ? <Marker rec="najviša" /> : null}
  </View>;
}

/** Tihi marker najbolje vrednosti: zelena tačka i reč, nikad superlativ o osobi. */
function Marker({ rec }: { rec: string }) {
  return <View style={s.marker}><View style={s.tacka} /><T variant="meta" tone="green" style={s.markerRec}>{rec}</T></View>;
}

/** Jedan red tabele: naziv iznad, pa ista ćelija u svakoj koloni, 12 između. */
function Red({ naziv, kolona, candidates, render, last = false }: { naziv: string; kolona: number; candidates: readonly KandidatProjekcija[];
  render: (k: KandidatProjekcija) => ReactNode; last?: boolean }) {
  return <View style={[s.blok, last && s.poslednji]}>
    <T variant="label" tone="muted" accessibilityRole="header">{naziv}</T>
    <View style={s.red}>{candidates.map(k => <View key={k.prijavaId} style={[s.celija, { width: kolona }]}>{render(k)}</View>)}</View>
  </View>;
}

const s = StyleSheet.create({
  glava: { gap: sys.space.sm },
  tabela: { paddingBottom: sys.space.sm },
  red: { flexDirection: 'row', gap: sys.space.md, alignItems: 'flex-start' },
  celija: { minWidth: 0, gap: sys.space.xs },
  osoba: { paddingBottom: sys.space.md, minHeight: layout.touch },
  ime: { color: sys.color.ink },
  ocena: { gap: sys.space.xs },
  linija: { height: ruleWidth, backgroundColor: sys.color.line, marginBottom: sys.space.md },
  blok: { gap: sys.space.sm, marginBottom: layout.section },
  poslednji: { marginBottom: 0 },
  novac: { color: sys.color.money },
  marker: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, marginTop: sys.space.xs },
  tacka: { width: sys.space.sm, height: sys.space.sm, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  markerRec: { fontWeight: '600' },
  lista: { gap: layout.group },
});
