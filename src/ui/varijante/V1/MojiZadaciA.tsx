import { StyleSheet, View } from 'react-native';
import type { PotrebaProjekcija } from '../../../contracts/projections';
import { DetailTopBar } from '../../system/DetailTopBar';
import { FactArt } from '../../system/FactArt';
import { ListRow } from '../../system/ListRow';
import { plural, zadataka } from '../../system/plural';
import { Screen } from '../../system/Screen';
import { Section } from '../../system/Section';
import { layout } from '../../system/layout';
import { OwnTaskCardVarA } from './OwnTaskCardVarA';
import { noop } from './PocetnaZajednicko';
import { StateViewVarA } from './StateViewVarA';

/**
 * Moji zadaci, variant A "Papir na stolu" (V1, creative direction 2026-10-08; starting point: the object).
 *
 * THE FOCUS. The FIRST ENCOUNTER is a promise: the paper with the pin and the pencil at 144 on the middle of the screen, the same
 * object as the door "Objavi zadatak" on Početna (B6: the empty state rhymes with the door that fulfils it), "Još nemaš zadatak",
 * one sentence, one green action and one quiet way. The LIST is grouped by PHASE instead of tabs ("Čeka tvoj izbor", "Objavljeno",
 * "Dogovoreno", each with its count), the cards are the production record (≤ 200 dp) without the state chip (the group says it),
 * and drafts and history are two quiet rows at the end. Either groups or tabs, never both (the risk the direction names): A has groups.
 */
export function MojiZadaciA({ items }: { items: PotrebaProjekcija[] }) {
  const header = <DetailTopBar title="Moji zadaci" onBack={noop} />;
  if (!items.length) return <Screen kind="detail" scroll={false} header={header}>
    <StateViewVarA art="publish" cause="first" title="Još nemaš zadatak" body="Reci šta ti treba. Nacrt pregledaš pre objave."
      primary={{ label: 'Objavi prvi zadatak', onPress: noop }} quiet={{ label: 'Pogledaj zadatke', onPress: noop }} />
  </Screen>;
  const groups = grupePoFazi(items);
  const sections: [string, PotrebaProjekcija[]][] = [['Čeka tvoj izbor', groups.ceka], ['Objavljeno', groups.objavljeno], ['Dogovoreno', groups.dogovoreno]];
  return <Screen kind="detail" header={header}>
    {sections.filter(([, list]) => list.length).map(([name, list]) => <Section key={name} title={`${name} · ${list.length}`}>
      <View style={s.cards}>
        {list.map(item => <OwnTaskCardVarA key={item.id} item={item} onOpen={noop} onApplications={noop} />)}
      </View>
    </Section>)}
    {groups.nacrti.length || groups.istorija.length ? <View>
      {groups.nacrti.length ? <ListRow leading={<FactArt kind="tasks" size={32} />} title="Nacrti" value={plural(groups.nacrti.length, 'nacrt', 'nacrta', 'nacrta')}
        onPress={noop} last={!groups.istorija.length} /> : null}
      {groups.istorija.length ? <ListRow leading={<FactArt kind="document" size={32} />} title="Istorija" value={zadataka(groups.istorija.length)} onPress={noop} last /> : null}
    </View> : null}
  </Screen>;
}

/** The phases of my tasks, by the task's own state and the server's count of applications to choose among. */
export function grupePoFazi(items: readonly PotrebaProjekcija[]) {
  const waiting = (item: PotrebaProjekcija) => typeof item.brojPrijavaZaIzbor === 'number' && item.brojPrijavaZaIzbor > 0;
  return {
    ceka: items.filter(item => (item.stanje === 'CEKA_PRIJAVE' || item.stanje === 'DELIMICNO_POPUNJENA') && item.pokrivenost.preostalo > 0 && waiting(item)),
    objavljeno: items.filter(item => item.stanje === 'OBJAVLJENA' || (item.stanje === 'CEKA_PRIJAVE' && !waiting(item))),
    dogovoreno: items.filter(item => item.stanje === 'POPUNJENA' || (item.stanje === 'DELIMICNO_POPUNJENA' && !(item.pokrivenost.preostalo > 0 && waiting(item)))),
    nacrti: items.filter(item => item.stanje === 'NACRT'),
    istorija: items.filter(item => item.stanje === 'ZATVORENA'),
  };
}

const s = StyleSheet.create({ cards: { gap: layout.group } });
