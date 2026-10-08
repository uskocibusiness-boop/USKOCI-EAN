import { StyleSheet, View } from 'react-native';
import type { PotrebaProjekcija } from '../../../contracts/projections';
import { DetailTopBar } from '../../system/DetailTopBar';
import { FactArt } from '../../system/FactArt';
import { ListRow } from '../../system/ListRow';
import { plural, zadataka } from '../../system/plural';
import { Screen } from '../../system/Screen';
import { layout } from '../../system/layout';
import type { Kadar } from './kadar';
import { OwnTaskCardVarC } from './OwnTaskCardVarC';
import { noop } from './PocetnaZajednicko';
import { StateViewVarC } from './StateViewVarC';
import { UskokVar } from './UskokVar';

/**
 * Moji zadaci, variant C "Noga koja uskače" (V1, creative direction 2026-10-08; starting point: the motion).
 *
 * THE FOCUS. No tabs and no group titles: ONE list, in which what waits for me comes FIRST and from ABOVE (an application came from
 * the other side, B1) wearing the orange foot, and everything else follows from BELOW (mine). The orange foot is the only division
 * of the list. Drafts and history are two quiet rows at the end. When a task changes state while you look (a draft you just
 * published), its chip lands as a stamp (B3, `pecat` scene). The FIRST ENCOUNTER is a scene that composes itself (`StateViewVarC`).
 *
 * `kadar` (lab only) freezes the arrival (or the stamp) at `t` ms. `stamp` names the one card whose chip just changed.
 */
export function MojiZadaciC({ items, kadar, stamp = false }: { items: PotrebaProjekcija[]; kadar: Kadar; stamp?: boolean }) {
  const header = <DetailTopBar title="Moji zadaci" onBack={noop} />;
  if (!items.length) return <Screen kind="detail" scroll={false} header={header}>
    <StateViewVarC art="publish" kadar={kadar} title="Još nemaš zadatak" body="Reci šta ti treba. Nacrt pregledaš pre objave."
      primary={{ label: 'Objavi prvi zadatak', onPress: noop }} quiet={{ label: 'Pogledaj zadatke', onPress: noop }} />
  </Screen>;
  const active = items.filter(item => item.stanje !== 'NACRT' && item.stanje !== 'ZATVORENA');
  const waits = (item: PotrebaProjekcija) => item.pokrivenost.preostalo > 0 && typeof item.brojPrijavaZaIzbor === 'number' && item.brojPrijavaZaIzbor > 0;
  const ordered = [...active.filter(waits), ...active.filter(item => !waits(item))];
  // The stamp scene: the cards are already there (no arrival); the first published task's chip has just changed.
  const stamped = stamp ? ordered.find(item => item.stanje === 'OBJAVLJENA')?.id ?? null : null;
  const nacrti = items.filter(item => item.stanje === 'NACRT').length, istorija = items.filter(item => item.stanje === 'ZATVORENA').length;
  return <Screen kind="detail" header={header}>
    <View style={s.cards}>
      {ordered.map((item, index) => <UskokVar key={item.id} from={waits(item) ? 'above' : 'below'} index={index} animate={!stamp} kadar={kadar}>
        <OwnTaskCardVarC item={item} onOpen={noop} onApplications={noop} stamp={item.id === stamped} kadar={kadar} />
      </UskokVar>)}
    </View>
    {nacrti || istorija ? <View>
      {nacrti ? <ListRow leading={<FactArt kind="tasks" size={32} />} title="Nacrti" value={plural(nacrti, 'nacrt', 'nacrta', 'nacrta')} onPress={noop} last={!istorija} /> : null}
      {istorija ? <ListRow leading={<FactArt kind="document" size={32} />} title="Istorija" value={zadataka(istorija)} onPress={noop} last /> : null}
    </View> : null}
  </Screen>;
}

const s = StyleSheet.create({ cards: { gap: layout.group } });
