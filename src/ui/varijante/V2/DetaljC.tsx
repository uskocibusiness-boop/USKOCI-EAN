import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PrilikaProjekcija } from '../../../contracts/projections';
import { needRequirementRows, needScheduleText, readableTitle } from '../../../data/needDetailPresentation';
import { Press } from '../../Press';
import { T } from '../../Text';
import { FactArt } from '../../system/FactArt';
import { FactRow } from '../../system/FactRow';
import { FlowFooter } from '../../system/FlowFooter';
import { Glyph } from '../../system/Glyph';
import { layout } from '../../system/layout';
import { osoba } from '../../system/plural';
import { Screen } from '../../system/Screen';
import { Section } from '../../system/Section';
import { sys } from '../../system/tokens';
import { ProductFooterAction, ProductHeader, productPriceParts, useDetailScrollTitle } from '../../product/ProductDetails';
import { TaskDecisionPrice, TaskDecisionRequirements } from '../../v2/detail/TaskDecision';
import { placesText, taskPlace } from '../../v2/TaskFace';
import { Lice, Uskok, poverenje } from './shared';

const noop = () => undefined;

/** Prve dve rečenice opisa i da li ima još; bez opisa nema rečenice (ništa se ne izmišlja). */
export function prveRecenice(opis: string | undefined): { prve: string; jos: boolean } | null {
  const text = (opis ?? '').trim();
  if (!text) return null;
  const parts = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)?.map(part => part.trim()).filter(Boolean) ?? [text];
  return { prve: parts.slice(0, 2).join(' '), jos: parts.length > 2 };
}

/**
 * Varijanta C detalja „Prvo osoba, pa odgovor“ (iz pokreta i osobe; pravac B4 + B1). Struktura: ekran POČINJE osobom (lice 56 kao nalepnica, ime,
 * zvezdica i broj) i njenom rečenicom, prve dve rečenice opisa u tipu govora, „Ceo opis“ kad ih ima više; odmah ispod iznos i termin kao ODGOVOR
 * na to; tek onda ime zadatka sa mestom i ljudima, uslovi i mesto. Podnožje sa jednom zelenom radnjom uskače jednom odozdo (ono što ti polažeš)
 * kad stigne puno čitanje; pod smanjenim pokretom stoji odmah. Bez opisa osoba „kaže“ ime zadatka u navodnicima: to je njen tekst, ne izmišljen.
 */
export function DetaljC({ need, kadar }: { need: PrilikaProjekcija; kadar?: number }) {
  const scrollTitle = useDetailScrollTitle();
  const title = readableTitle(need.naslov);
  const price = productPriceParts(need, 'Ukupan iznos predlažeš u prijavi.');
  const offers = need.rezimCene === 'OFFERS';
  const term = need.schedule ? needScheduleText(need.schedule, need.taskTimezone) : need.vremeTekst;
  const place = taskPlace(need);
  const capacity = placesText(need.pokrivenost, 'worker', 'fraction');
  const trust = poverenje(need.narucilacOcena, need.narucilacBrojOcena);
  const recenice = prveRecenice(need.opis);
  const [ceo, setCeo] = useState(false);
  const govor = recenice ? (ceo ? (need.opis ?? '').trim() : recenice.prve) : `„${title}“`;
  const foot = <Uskok from="below" kadar={kadar}><FlowFooter><ProductFooterAction label="Sastavi prijavu" onPress={noop} /></FlowFooter></Uskok>;
  return <Screen kind="detail" header={<ProductHeader back={noop} title={title} titleVisible={scrollTitle.titleVisible} />} footer={foot} onScroll={scrollTitle.onScroll}>
    <View style={s.osobaBlok}>
      <Press accessibilityRole="button" accessibilityLabel={`${need.narucilacIme}${trust ? `, ${trust.text}` : ''}`} accessibilityHint="Otvara javni profil"
        onPress={noop} haptic="select" scaleTo={sys.motion.scale.row} style={s.osoba}>
        <Lice ime={need.narucilacIme} size={56} senka />
        <View style={s.osobaText}>
          <T variant="bodyStrong" style={s.ink}>{need.narucilacIme}</T>
          {trust ? <View style={s.trustRow}>
            {trust.star ? <FactArt kind="star" size={16} /> : null}
            <T variant="note" tone="muted" style={s.tabular}>{trust.text}</T>
          </View> : null}
        </View>
        <Glyph name="caret-right" size={20} tone="muted" />
      </Press>
      <T variant="speech" style={s.govor} selectable>{govor}</T>
      {recenice?.jos && !ceo ? <Press accessibilityRole="button" accessibilityLabel="Ceo opis" onPress={() => setCeo(true)} haptic="select"
        scaleTo={sys.motion.scale.button} style={s.ceo}><T variant="bodyStrong" tone="green">Ceo opis</T></Press> : null}
    </View>
    <View style={s.odgovor}>
      <TaskDecisionPrice price={price} offers={offers} />
      <FactRow size="detail" art="calendar" value={term} />
    </View>
    <View style={s.zadatak} onLayout={scrollTitle.onHeroLayout}>
      <T variant="heading" accessibilityRole="header" onLayout={scrollTitle.onTitleLayout} style={s.ink}>{title}</T>
      <View style={s.facts}>
        <FactRow size="detail" art={place.remote ? 'remote' : 'pin'} value={place.text} />
        <FactRow size="detail" art="users" value={osoba(need.pokrivenost.ukupno)} note={`${capacity.text} popunjeno`} />
      </View>
    </View>
    <TaskDecisionRequirements rows={needRequirementRows(need)} />
    {need.detalji?.rezimLokacije !== 'REMOTE' ? <Section title="Mesto">
      <FactRow art="lock" value="Približno područje. Tačna adresa se deli tek u Dogovoru." />
    </Section> : null}
  </Screen>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  tabular: { fontVariant: ['tabular-nums'] },
  osobaBlok: { gap: sys.space.md },
  osoba: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.rowMin },
  osobaText: { flex: 1, minWidth: 0, gap: sys.space.xs },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  govor: { color: sys.color.ink },
  ceo: { alignSelf: 'flex-start', minHeight: layout.touch, justifyContent: 'center' },
  odgovor: { gap: sys.space.md },
  zadatak: { gap: sys.space.md },
  facts: { gap: layout.group },
});
