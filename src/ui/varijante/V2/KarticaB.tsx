import { StyleSheet, View } from 'react-native';
import type { MarketplaceItem } from '../../../data/marketplaceView';
import { T } from '../../Text';
import { FactArt } from '../../system/FactArt';
import { Surface } from '../../system/Surface';
import { useLayoutClass } from '../../system/textScale';
import { sys } from '../../system/tokens';
import { CardStatus, placesText, ratingWords, type TaskCardRelation } from '../../v2/TaskFace';
import { useTaskRecord, type TaskRecordModel } from '../../v2/discovery/TaskRecordBody';
import { Lice, clearOfCloseStyle } from './shared';

/**
 * Varijanta B „Cena vodi“ (iz broja; pravac B5, glas broja). Struktura: iznos 20/700 je PRVI red i vodi (lice 32 na desnom kraju istog reda),
 * naslov 16/600 ispod, činjenice kao JEDAN tekstualni red „Liman, Novi Sad · 12. okt · 10:00–12:00 · Kombi“ uz jednu jedinu nalepnicu 28 za
 * mesto (bez nje bi se izgubio 2.5D koji vlasnik traži), pa jedan tih red osobe: ime · zvezdica i broj · ljudi · starost. Oko 150 dp.
 * Kad cene nema, prvi red je reč („Prima ponude“) u težini 600, nikad u odelu iznosa.
 */
export function KarticaBTelo({ model, clearOfClose = false }: { model: TaskRecordModel; clearOfClose?: boolean }) {
  const { stacked } = useLayoutClass();
  const head = !!model.status || model.urgent;
  const value = model.value;
  const trust = model.person ? ratingWords(model.person.rating, model.person.count) : null;
  const places = placesText(model.places, model.audience, 'fraction');
  const facts = [model.place.text, model.schedule, model.requirement?.text].filter((part): part is string => !!part).join(' · ');
  const quiet = [model.person?.name, trust ? `${trust.star ? '★ ' : ''}${trust.text}` : null, places.text, model.age].filter((part): part is string => !!part);
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.body}>
    {head ? <View style={clearOfClose ? clearOfCloseStyle : undefined}><CardStatus status={model.status} urgency={model.urgency} now={model.urgencyNow} /></View> : null}
    <View style={[s.prvi, !head && clearOfClose ? clearOfCloseStyle : undefined]}>
      {value.kind === 'amount'
        ? <View style={s.iznosRed}>
          <T variant="priceSmall" style={s.money}>{value.amount}</T>
          {value.basis ? <T variant="meta" tone="muted">{value.basis}</T> : null}
        </View>
        : <T variant="bodyStrong" tone="muted" style={s.rec}>{value.kind === 'offers' ? model.offersWord : 'Cena nije navedena'}</T>}
      {model.person && !stacked ? <Lice ime={model.person.name} size={32} /> : null}
    </View>
    <T variant="bodyStrong" style={s.title}>{model.title}</T>
    <View style={s.facts}>
      <View style={s.art}><FactArt kind={model.place.remote ? 'remote' : 'pin'} size={28} /></View>
      <T variant="note" style={s.factsText}>{facts}</T>
    </View>
    <T variant="meta" tone="muted" style={s.quiet}>{quiet.join(' · ')}</T>
  </View>;
}

export function KarticaB({ item, relation, onOpen }: { item: MarketplaceItem; relation?: TaskCardRelation; onOpen: () => void }) {
  const model = useTaskRecord(item, relation);
  return <Surface kind="record" onPress={onOpen} accessibilityLabel={`Otvori zadatak ${model.title}. ${model.spoken}`}>
    <KarticaBTelo model={model} />
  </Surface>;
}

const s = StyleSheet.create({
  body: { gap: sys.space.sm },
  prvi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.md },
  iznosRed: { flexDirection: 'row', alignItems: 'baseline', gap: sys.space.sm, flexShrink: 1, flexWrap: 'wrap' },
  money: { color: sys.color.money },
  rec: { flexShrink: 1 },
  title: { color: sys.color.ink },
  facts: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  art: { width: 28, height: 28 },
  // Prvi red teksta centriran na nalepnicu 28 (20 dp reda): (28 − 20) / 2.
  factsText: { flex: 1, minWidth: 0, color: sys.color.fact, paddingTop: sys.space.xs },
  quiet: { fontVariant: ['tabular-nums'] },
});
