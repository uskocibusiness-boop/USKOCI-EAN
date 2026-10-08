import { StyleSheet, View } from 'react-native';
import type { PrilikaProjekcija } from '../../../contracts/projections';
import { needRequirementRows, needScheduleText, readableTitle } from '../../../data/needDetailPresentation';
import { T } from '../../Text';
import { FactArt } from '../../system/FactArt';
import { FactRow } from '../../system/FactRow';
import { FlowFooter } from '../../system/FlowFooter';
import { Glyph } from '../../system/Glyph';
import { Screen } from '../../system/Screen';
import { Section } from '../../system/Section';
import { Surface } from '../../system/Surface';
import { useLayoutClass } from '../../system/textScale';
import { sys } from '../../system/tokens';
import { DetailDescription, ProductFooterAction, ProductHeader, productPriceParts, useDetailScrollTitle } from '../../product/ProductDetails';
import { TaskDecisionFacts, TaskDecisionPrice, TaskDecisionRequirements, TaskDecisionTitle } from '../../v2/detail/TaskDecision';
import { OFFERS_WORD } from '../../v2/discovery/TaskRecordBody';
import { Lice, poverenje } from './shared';

const noop = () => undefined;

/**
 * Varijanta A detalja „Objavio kao kartica poverenja“ (iz osobe; pravac B4 + B5). Struktura: ime zadatka, iznos 24/700 odmah pod njim, tri
 * činjenice 2.5D kao danas, pa „Objavio“ kao JEDINI zapis sa senkom na ekranu bez kartica: lice 56 kao nalepnica, ime, zvezdica i broj ocena
 * (ispod tri ocene „Nova ocena“), i „Dolazi kako je dogovoreno · 9 od 10“ SAMO kad server to da. Podnožje: iznos i termin levo, jedna zelena
 * radnja desno, pa se odluka donosi bez vraćanja na vrh. Opis, uslovi i mesto ostaju odeljci bez linija.
 */
export function DetaljA({ need, pouzdanost, kadar: _kadar }: { need: PrilikaProjekcija; pouzdanost?: { dosao: number; od: number } | null; kadar?: number }) {
  const { stacked } = useLayoutClass();
  const scrollTitle = useDetailScrollTitle();
  const title = readableTitle(need.naslov);
  const price = productPriceParts(need, 'Ukupan iznos predlažeš u prijavi.');
  const offers = need.rezimCene === 'OFFERS';
  const term = need.schedule ? needScheduleText(need.schedule, need.taskTimezone) : need.vremeTekst;
  const trust = poverenje(need.narucilacOcena, need.narucilacBrojOcena);
  const foot = <FlowFooter>
    <View style={[s.foot, stacked && s.footStacked]}>
      <View style={s.footFacts} accessible accessibilityRole="text" accessibilityLabel={`${offers ? OFFERS_WORD.worker : price.value}, ${term}`}>
        {price.isAmount ? <T variant="priceRow" style={s.money}>{price.value}</T> : <T variant="note" tone="muted">{offers ? OFFERS_WORD.worker : price.value}</T>}
        <T variant="meta" tone="muted" numberOfLines={2}>{term}</T>
      </View>
      <View style={s.footAction}><ProductFooterAction label="Sastavi prijavu" onPress={noop} /></View>
    </View>
  </FlowFooter>;
  return <Screen kind="detail" header={<ProductHeader back={noop} title={title} titleVisible={scrollTitle.titleVisible} />} footer={foot} onScroll={scrollTitle.onScroll}>
    <View style={s.hero} onLayout={scrollTitle.onHeroLayout}>
      <TaskDecisionTitle onLayout={scrollTitle.onTitleLayout}>{title}</TaskDecisionTitle>
      <TaskDecisionPrice price={price} offers={offers} />
      <View style={s.facts}><TaskDecisionFacts need={need} /></View>
    </View>
    <Section title="Objavio">
      <Surface kind="record" onPress={noop} accessibilityLabel={`${need.narucilacIme}${trust ? `, ${trust.text}` : ''}. Otvara javni profil`}>
        <View style={s.osoba}>
          <Lice ime={need.narucilacIme} size={56} senka />
          <View style={s.osobaText}>
            <T variant="bodyStrong" style={s.ink}>{need.narucilacIme}</T>
            {trust ? <View style={s.trustRow}>
              {trust.star ? <FactArt kind="star" size={16} /> : null}
              <T variant="note" tone="muted" style={s.tabular}>{trust.text}</T>
            </View> : null}
            {pouzdanost ? <T variant="note" style={s.pouzdanost}>{`Dolazi kako je dogovoreno · ${pouzdanost.dosao} od ${pouzdanost.od}`}</T> : null}
          </View>
          <Glyph name="caret-right" size={20} tone="muted" />
        </View>
      </Surface>
    </Section>
    {need.opis ? <Section title="O zadatku"><DetailDescription text={need.opis} /></Section> : null}
    <TaskDecisionRequirements rows={needRequirementRows(need)} />
    {need.detalji?.rezimLokacije !== 'REMOTE' ? <Section title="Mesto">
      <FactRow art="lock" value="Približno područje. Tačna adresa se deli tek u Dogovoru." />
    </Section> : null}
  </Screen>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  money: { color: sys.color.money },
  tabular: { fontVariant: ['tabular-nums'] },
  hero: { gap: sys.space.sm },
  facts: { paddingTop: sys.space.sm },
  osoba: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  osobaText: { flex: 1, minWidth: 0, gap: sys.space.xs },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  pouzdanost: { color: sys.color.fact },
  foot: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  footStacked: { flexDirection: 'column', alignItems: 'stretch' },
  footFacts: { flex: 1, minWidth: 0 },
  footAction: { flex: 1, minWidth: 0 },
});
