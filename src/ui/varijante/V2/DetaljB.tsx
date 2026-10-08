import { StyleSheet, View } from 'react-native';
import type { PrilikaProjekcija } from '../../../contracts/projections';
import { needRequirementRows, needScheduleText, readableTitle } from '../../../data/needDetailPresentation';
import { inicijali } from '../../../lib/inicijali';
import { T } from '../../Text';
import { FactRow } from '../../system/FactRow';
import { FlowFooter } from '../../system/FlowFooter';
import { ruleWidth } from '../../system/layout';
import { osoba } from '../../system/plural';
import { Screen } from '../../system/Screen';
import { Section } from '../../system/Section';
import { Surface } from '../../system/Surface';
import { useLayoutClass } from '../../system/textScale';
import { sys } from '../../system/tokens';
import { DetailDescription, ProductFooterAction, ProductHeader, productPriceParts, useDetailScrollTitle } from '../../product/ProductDetails';
import { TaskDecisionPublisher, TaskDecisionRequirements, TaskDecisionTitle, publisherRatingLine } from '../../v2/detail/TaskDecision';
import { OFFERS_WORD } from '../../v2/discovery/TaskRecordBody';
import { placesText, taskPlace } from '../../v2/TaskFace';

const noop = () => undefined;

type Celija = { label: string; value: string; money: boolean; note?: string };

/**
 * Varijanta B detalja „Traka činjenica“ (iz broja; pravac B5). Struktura: pod imenom zadatka stoji traka od četiri ćelije UKUPNO · TERMIN ·
 * LJUDI · MESTO (oznaka 12/600, vrednost 700), bez ikona; ostalo su odeljci kao danas. Odstupanje od nacrta: četiri ćelije u JEDNOM redu na
 * 361 dp dobijaju po ~71 dp, u šta ne staje ni „6.000 RSD“ ni „12. okt · 10:00–12:00“, pa je traka 2 × 2 pri običnom tekstu i jedna kolona
 * pri velikom (nacrt je i predvideo dva reda na 1,3). Traka je lokalni View u `panel` okviru (čita se, ne dodiruje), ne nov primitiv; ćelije
 * deli jedna linija 1 dp (`ruleWidth`), nikad ivica samo s jedne strane.
 */
export function DetaljB({ need, kadar: _kadar }: { need: PrilikaProjekcija; kadar?: number }) {
  const { stacked } = useLayoutClass();
  const scrollTitle = useDetailScrollTitle();
  const title = readableTitle(need.naslov);
  const price = productPriceParts(need, 'Ukupan iznos predlažeš u prijavi.');
  const offers = need.rezimCene === 'OFFERS';
  const term = need.schedule ? needScheduleText(need.schedule, need.taskTimezone) : need.vremeTekst;
  const place = taskPlace(need);
  const capacity = placesText(need.pokrivenost, 'worker', 'fraction');
  const cells: Celija[] = [
    { label: 'UKUPNO', value: offers ? OFFERS_WORD.worker : price.value, money: price.isAmount, note: price.note ?? undefined },
    { label: 'TERMIN', value: term, money: false },
    { label: 'LJUDI', value: osoba(need.pokrivenost.ukupno), money: false, note: `${capacity.text} popunjeno` },
    { label: 'MESTO', value: place.text, money: false },
  ];
  const rows: Celija[][] = stacked ? cells.map(cell => [cell]) : [cells.slice(0, 2), cells.slice(2)];
  const foot = <FlowFooter><ProductFooterAction label="Sastavi prijavu" onPress={noop} /></FlowFooter>;
  return <Screen kind="detail" header={<ProductHeader back={noop} title={title} titleVisible={scrollTitle.titleVisible} />} footer={foot} onScroll={scrollTitle.onScroll}>
    <View style={s.hero} onLayout={scrollTitle.onHeroLayout}>
      <TaskDecisionTitle onLayout={scrollTitle.onTitleLayout}>{title}</TaskDecisionTitle>
      <Surface kind="panel" style={s.traka} accessibilityLabel={cells.map(cell => `${cell.label}: ${cell.value}${cell.note ? `, ${cell.note}` : ''}`).join('. ')}>
        {rows.map((row, at) => <View key={row[0].label}>
          {at > 0 ? <View style={s.linija} /> : null}
          <View style={s.red}>
            {row.map((cell, index) => <View key={cell.label} style={[s.celija, index > 0 && s.celijaDesno]}>
              <T variant="label" tone="muted">{cell.label}</T>
              {cell.money ? <T variant="priceRow" style={s.money}>{cell.value}</T> : <T variant="bodyStrong" style={s.ink}>{cell.value}</T>}
              {cell.note ? <T variant="meta" tone="muted">{cell.note}</T> : null}
            </View>)}
          </View>
        </View>)}
      </Surface>
    </View>
    {need.opis ? <Section title="O zadatku"><DetailDescription text={need.opis} /></Section> : null}
    <TaskDecisionRequirements rows={needRequirementRows(need)} />
    <TaskDecisionPublisher name={need.narucilacIme || 'Ime trenutno nije dostupno'} rating={publisherRatingLine(need.narucilacOcena, need.narucilacBrojOcena)}
      initials={inicijali(need.narucilacIme)} onPress={noop} />
    {need.detalji?.rezimLokacije !== 'REMOTE' ? <Section title="Mesto">
      <FactRow art="lock" value="Približno područje. Tačna adresa se deli tek u Dogovoru." />
    </Section> : null}
  </Screen>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  money: { color: sys.color.money },
  hero: { gap: sys.space.md },
  // Panel nosi padding 16; traka ga briše da linije ćelija stignu do okvira, a svaka ćelija nosi svojih 12.
  traka: { padding: 0, overflow: 'hidden' },
  red: { flexDirection: 'row' },
  celija: { flex: 1, minWidth: 0, padding: sys.space.md, gap: sys.space.xs },
  // Druga ćelija reda: leva linija 1 dp, ista boja kao svaka linija sistema.
  celijaDesno: { borderLeftWidth: ruleWidth, borderLeftColor: sys.color.line },
  linija: { height: ruleWidth, backgroundColor: sys.color.line },
});
