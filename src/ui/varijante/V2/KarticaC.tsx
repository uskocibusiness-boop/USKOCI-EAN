import { StyleSheet, View } from 'react-native';
import type { MarketplaceItem } from '../../../data/marketplaceView';
import { T } from '../../Text';
import { FactArt } from '../../system/FactArt';
import { Surface } from '../../system/Surface';
import { useLayoutClass } from '../../system/textScale';
import { sys } from '../../system/tokens';
import { CardStatus, placesText, ratingWords, type TaskCardRelation } from '../../v2/TaskFace';
import { useTaskRecord, type TaskRecordModel } from '../../v2/discovery/TaskRecordBody';
import { Lice, Uskok, clearOfCloseStyle, prvoIme } from './shared';

/**
 * Varijanta C „Osoba govori“ (iz osobe i pokreta; pravac B4 + B1). Struktura: lice 48 i rečenica osobe su PRVI red („Marija traži pomoć“,
 * ispod zvezdica i broj i starost), iznos desno u istom redu; naslov zadatka je NJENA rečenica u navodnicima (tip govora); činjenice jedan
 * tih red bez predmeta. Nova kartica uskače odozgo (ono što stiže od druge strane), 8 dp, 240 ms. U listi su inicijali, fotografija tek u
 * detalju (čitanje fotografija po redu). Prvo ime dolazi iz podataka; kad imena nema (moj zadatak), kartica ne izmišlja rečenicu: stanje kaže
 * „Tvoj zadatak“, a naslov stoji sam.
 */
export function KarticaCTelo({ model, clearOfClose = false }: { model: TaskRecordModel; clearOfClose?: boolean }) {
  const { stacked } = useLayoutClass();
  const head = !!model.status || model.urgent;
  const value = model.value;
  const ime = model.person ? prvoIme(model.person.name) : null;
  const trust = model.person ? ratingWords(model.person.rating, model.person.count) : null;
  const places = placesText(model.places, model.audience, 'words');
  const facts = [model.place.text, model.schedule, places.text, model.requirement?.text].filter((part): part is string => !!part).join(' · ');
  const iznos = value.kind === 'amount'
    ? <View style={[s.iznos, stacked && s.iznosStacked]}>
      <T variant="priceRow" style={s.money}>{value.amount}</T>
      {value.basis ? <T variant="meta" tone="muted">{value.basis}</T> : null}
    </View>
    : <T variant="note" tone="muted" style={[s.rec, stacked && s.recStacked]}>{value.kind === 'offers' ? model.offersWord : 'Cena nije navedena'}</T>;
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.body}>
    {head ? <View style={clearOfClose ? clearOfCloseStyle : undefined}><CardStatus status={model.status} urgency={model.urgency} now={model.urgencyNow} /></View> : null}
    <View style={[s.head, stacked && s.headStacked, !head && clearOfClose ? clearOfCloseStyle : undefined]}>
      {model.person ? <Lice ime={model.person.name} size={48} /> : null}
      <View style={s.osoba}>
        {ime ? <T variant="bodyStrong" style={s.ink}>{`${ime} traži pomoć`}</T> : null}
        {model.person ? <View style={s.trustRow}>
          {trust?.star ? <FactArt kind="star" size={16} /> : null}
          <T variant="meta" tone="muted" style={s.tabular} numberOfLines={1}>{[trust?.text, model.age].filter(Boolean).join(' · ')}</T>
        </View> : null}
        {!model.person ? <T variant="heading" style={s.ink}>{model.title}</T> : null}
      </View>
      {!stacked ? iznos : null}
    </View>
    {model.person ? <T variant="speech" style={s.ink}>{`„${model.title}“`}</T> : null}
    {stacked ? iznos : null}
    <T variant="note" style={s.facts}>{facts}</T>
  </View>;
}

export function KarticaC({ item, relation, onOpen, nova = false, kadar }: {
  item: MarketplaceItem; relation?: TaskCardRelation; onOpen: () => void;
  /** Kartica koja je upravo stigla od druge strane: uskače odozgo. */ nova?: boolean;
  /** Laboratorija: zamrznut kadar pokreta u ms od okidača. */ kadar?: number;
}) {
  const model = useTaskRecord(item, relation);
  return <Uskok from="above" play={nova} kadar={kadar}>
    <Surface kind="record" onPress={onOpen} accessibilityLabel={`Otvori zadatak ${model.title}. ${model.spoken}`}>
      <KarticaCTelo model={model} />
    </Surface>
  </Uskok>;
}

const s = StyleSheet.create({
  body: { gap: sys.space.md },
  ink: { color: sys.color.ink },
  head: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  headStacked: { alignItems: 'flex-start' },
  osoba: { flex: 1, minWidth: 0, gap: sys.space.xs },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  tabular: { fontVariant: ['tabular-nums'], flexShrink: 1 },
  iznos: { alignItems: 'flex-end', flexShrink: 0 },
  iznosStacked: { alignItems: 'flex-start' },
  money: { color: sys.color.money },
  rec: { textAlign: 'right', flexShrink: 0 },
  recStacked: { textAlign: 'left' },
  facts: { color: sys.color.fact },
});
