import { StyleSheet, View } from 'react-native';
import type { MarketplaceItem } from '../../../data/marketplaceView';
import { T } from '../../Text';
import { FactArt } from '../../system/FactArt';
import { FactRow } from '../../system/FactRow';
import { Surface } from '../../system/Surface';
import { useLayoutClass } from '../../system/textScale';
import { sys } from '../../system/tokens';
import { CardStatus, placesText, ratingWords, REQUIREMENT_ART, type TaskCardRelation } from '../../v2/TaskFace';
import { useTaskRecord, type TaskRecordModel } from '../../v2/discovery/TaskRecordBody';
import { Lice, PraznaEtiketa, Razlog, clearOfCloseStyle } from './shared';

/**
 * Varijanta A „Etiketa“ (iz predmeta; pravac B5 + B4). Struktura: iznos GORE DESNO u naslovnom redu kao na etiketi (20/700 tabular,
 * najveći tekst u kartici), a kad cene nema, na tom mestu stoji prazna etiketa 28 i „Prima ponude“; dve činjenice 2.5D 28 (mesto, vreme,
 * i treća samo kad zadatak ima uslov); lice 40 kao nalepnica + ime + zvezdica 16 i broj; jedan red razloga iz podataka („Imaš kombi“).
 * Činjenice i reči dolaze iz istog modela kao danas (`useTaskRecord`), pa kartica ne menja istinu, samo raspored.
 */
export function KarticaATelo({ model, razlog, clearOfClose = false }: { model: TaskRecordModel; razlog: string | null; clearOfClose?: boolean }) {
  const { stacked } = useLayoutClass();
  const head = !!model.status || model.urgent;
  const value = model.value;
  const trust = model.person ? ratingWords(model.person.rating, model.person.count) : null;
  const places = placesText(model.places, model.audience, 'fraction');
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.body}>
    {head ? <View style={clearOfClose ? clearOfCloseStyle : undefined}><CardStatus status={model.status} urgency={model.urgency} now={model.urgencyNow} /></View> : null}
    <View style={[s.head, stacked && s.headStacked, !head && clearOfClose ? clearOfCloseStyle : undefined]}>
      <T variant="heading" style={[s.title, !stacked && s.titleBeside]}>{model.title}</T>
      {value.kind === 'amount'
        ? <View style={[s.iznos, stacked && s.iznosStacked]}>
          <T variant="priceSmall" style={s.money}>{value.amount}</T>
          {value.basis ? <T variant="meta" tone="muted">{value.basis}</T> : null}
        </View>
        : <PraznaEtiketa rec={value.kind === 'offers' ? model.offersWord : 'Cena nije navedena'} align={stacked ? 'start' : 'end'} />}
    </View>
    <View style={s.facts}>
      <FactRow art={model.place.remote ? 'remote' : 'pin'} value={model.place.text} />
      <FactRow art="calendar" value={model.schedule} />
      {model.requirement ? <FactRow art={REQUIREMENT_ART[model.requirement.kind]} value={model.requirement.text} /> : null}
    </View>
    <View style={[s.foot, stacked && s.footStacked]}>
      {model.person ? <View style={s.person}>
        <Lice ime={model.person.name} size={40} />
        <View style={s.personText}>
          <T variant="note" style={s.name} numberOfLines={1}>{model.person.name}</T>
          <View style={s.trustRow}>
            {trust?.star ? <FactArt kind="star" size={16} /> : null}
            {trust ? <T variant="note" tone="muted" style={s.tabular}>{trust.text}</T> : null}
            {model.age ? <T variant="note" tone="muted">{trust ? `· ${model.age}` : model.age}</T> : null}
          </View>
        </View>
      </View> : <View style={s.grow} />}
      <View style={s.places}>
        <FactArt kind="users" size={16} tone="quiet" />
        <T variant="note" tone="muted" style={s.fraction}>{places.text}</T>
      </View>
    </View>
    {razlog ? <Razlog text={razlog} /> : null}
  </View>;
}

export function KarticaA({ item, relation, razlog, onOpen }: { item: MarketplaceItem; relation?: TaskCardRelation; razlog: string | null; onOpen: () => void }) {
  const model = useTaskRecord(item, relation);
  return <Surface kind="record" onPress={onOpen} accessibilityLabel={`Otvori zadatak ${model.title}. ${model.spoken}${razlog ? `, ${razlog}` : ''}`}>
    <KarticaATelo model={model} razlog={razlog} />
  </Surface>;
}

const s = StyleSheet.create({
  body: { gap: sys.space.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  headStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: sys.space.sm },
  title: { color: sys.color.ink },
  titleBeside: { flex: 1, minWidth: 0 },
  iznos: { alignItems: 'flex-end', flexShrink: 0 },
  iznosStacked: { alignItems: 'flex-start' },
  money: { color: sys.color.money },
  facts: { gap: sys.space.xs },
  foot: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  footStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: sys.space.sm },
  grow: { flex: 1 },
  person: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  personText: { flex: 1, minWidth: 0 },
  name: { color: sys.color.ink, fontWeight: '600' },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  places: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, flexShrink: 0 },
  fraction: { fontWeight: '600', fontVariant: ['tabular-nums'] },
});
