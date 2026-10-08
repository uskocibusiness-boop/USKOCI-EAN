import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PotrebaProjekcija } from '../../../contracts/projections';
import { initialMarketplaceView, isOwnedNeed, marketplaceItems, ownedTaskCounts } from '../../../data/marketplaceView';
import { T } from '../../Text';
import { DetailTopBar } from '../../system/DetailTopBar';
import { zadataka } from '../../system/plural';
import { Screen } from '../../system/Screen';
import { Segmented } from '../../system/Segmented';
import { layout } from '../../system/layout';
import { sys } from '../../system/tokens';
import { ownTaskTabs, type OwnTaskTab } from '../../v2/ownTaskTabs';
import { OwnTaskCardVarB } from './OwnTaskCardVarB';
import { noop } from './PocetnaZajednicko';
import { StateViewVarB } from './StateViewVarB';

/**
 * Moji zadaci, variant B "Dva broja" (V1, creative direction 2026-10-08; starting point: the number).
 *
 * THE FOCUS. Every card leads with its two numbers, "Prijave 3 · Dogovoreno 0 od 2" (see `OwnTaskCardVarB`), so the list reads like a
 * column of figures: how many came, how many are agreed. The three sets stay as today's tabs (B is about the card, not the grouping)
 * and the count of the set is the list's first line. The FIRST ENCOUNTER is one big sentence: "Još nemaš zadatak" in the display
 * type, left-aligned like a page, the object small beside it (see `StateViewVarB`).
 */
export function MojiZadaciB({ items }: { items: PotrebaProjekcija[] }) {
  const [section, setSection] = useState<OwnTaskTab>('active');
  const counts = useMemo(() => ownedTaskCounts(items), [items]);
  const tabs = useMemo(() => ownTaskTabs(counts), [counts]);
  const visible = useMemo(() => marketplaceItems(items, { ...initialMarketplaceView(), section }, true).filter(isOwnedNeed), [items, section]);
  const header = <DetailTopBar title="Moji zadaci" onBack={noop} />;
  if (!items.length) return <Screen kind="detail" scroll={false} header={header}>
    <StateViewVarB art="publish" cause="first" title="Još nemaš zadatak." body="Reci šta ti treba. Nacrt pregledaš pre objave."
      primary={{ label: 'Objavi prvi zadatak', onPress: noop }} quiet={{ label: 'Pogledaj zadatke', onPress: noop }} />
  </Screen>;
  return <Screen kind="detail" header={header}>
    <View style={s.control}><Segmented options={tabs} value={section} onChange={setSection} /></View>
    {visible.length ? <View>
      <T variant="note" tone="muted" style={s.count}>{zadataka(visible.length)}</T>
      <View style={s.cards}>{visible.map(item => <OwnTaskCardVarB key={item.id} item={item} onOpen={noop} onApplications={noop} />)}</View>
    </View> : <StateViewVarB art="publish" cause="filtered"
      title={section === 'drafts' ? 'Nemaš nacrt.' : section === 'history' ? 'Istorija je prazna.' : 'Nema aktivnih zadataka.'}
      body={section === 'drafts' ? 'Nacrt pregledaš pre objave.' : section === 'history' ? 'Ovde su završeni, otkazani i istekli zadaci.' : 'Nacrti i završeni zadaci su pod Nacrti i Istorija.'} />}
  </Screen>;
}

const s = StyleSheet.create({
  // The one control row stands right under the bar; the screen's own 24 to the list follows.
  control: { marginBottom: -sys.space.md },
  count: { paddingBottom: sys.space.sm },
  cards: { gap: layout.group },
});
