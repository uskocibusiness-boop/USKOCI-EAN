import { StyleSheet, View } from 'react-native';
import type { HomeAttention, HomeSnapshot, HomeTarget } from '../../../data/homeSnapshot';
import { readableTitle } from '../../../data/needDetailPresentation';
import { HowItWorks } from '../../home/HowItWorks';
import { T } from '../../Text';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { ListRow } from '../../system/ListRow';
import { Screen } from '../../system/Screen';
import { Section } from '../../system/Section';
import { useLayoutClass } from '../../system/textScale';
import { layout } from '../../system/layout';
import { sys } from '../../system/tokens';
import type { Kadar } from './kadar';
import { MojeRedovi, Oznaceno, PocetnaTraka, RasporedZapis, Telefon, VrataVar, joined, noop, oceniDogovore } from './PocetnaZajednicko';
import { UskokVar } from './UskokVar';

/**
 * Početna, variant C "Sto se postavlja" (V1, creative direction 2026-10-08; starting point: the motion).
 *
 * THE FOCUS. Calm in the state and one family motion in the change. The composition is today's (the rows, the record of the next
 * appointment, my two lists), and what is different is HOW it comes to be there and how it rests. After the first read the table is
 * laid: what came from the other side ("Čeka te") drops in from ABOVE, what is mine (the Dogovor, my lists) rises from BELOW, one
 * row after another (40 ms), six at most (B1 with direction). "Ništa ne čeka tvoju odluku" is one quiet row with a check of 24, not
 * a picture of 32 in a row of 64. When "Slobodan sam sada" is on, its clock carries the green dot that breathes (B7), the one loop
 * of the screen. The doors and the header are locked and untouched; nothing that states a fact moves.
 *
 * `kadar` (lab only) freezes the whole laying of the table at `t` ms, so the frames 0 / 150 / 400 / 900 can be photographed.
 */
export function PocetnaC({ home, availableNow, kadar }: { home: HomeSnapshot; availableNow?: boolean; kadar: Kadar }) {
  const { stacked } = useLayoutClass();
  const rows: HomeAttention[] = [...home.attention, ...(home.prompts ?? [])];
  const ratings = home.ratingsDue ?? 0;
  const next = home.agreements.kind === 'known' ? home.agreements.value.rows[0] ?? null : null;
  const raspored = next?.raspored ?? null;
  const quietLine = home.agreements.kind === 'known' && !raspored ? home.agreements.value.quietLine : undefined;
  const nothingWaits = !home.firstRun && rows.length === 0 && ratings === 0 && home.agreements.kind === 'known';
  const more = home.attentionMore + (home.promptsMore ?? 0);
  // The order of arrival: theirs first, from above; then mine, from below.
  let at = 0;
  return <Telefon>
    <Screen kind="root" header={<PocetnaTraka />}>
      <VrataVar onPublish={noop} onEarn={noop} />
      {home.firstRun ? <HowItWorks stacked={stacked} /> : <Section title="Čeka te">
        {rows.map((row, index) => <UskokVar key={row.id} from="above" index={at++} kadar={kadar}>
          <Red row={row} last={index === rows.length - 1 && !ratings} />
        </UskokVar>)}
        {ratings > 0 ? <UskokVar from="above" index={at++} kadar={kadar}>
          <ListRow leading={<Oznaceno art="star" />} title={oceniDogovore(ratings)} onPress={noop} last accessibilityLabel={oceniDogovore(ratings)} accessibilityHint="Otvara ocenu saradnje." />
        </UskokVar> : null}
        {nothingWaits ? <Mir /> : null}
        {more > 0 ? <T variant="note" tone="muted" style={s.more}>I još {more} u tvojim zadacima, prijavama i Dogovorima.</T> : null}
      </Section>}
      {next && raspored ? <Section title="Raspored" action={{ label: 'Ceo raspored', onPress: noop }}>
        <UskokVar from="below" index={at++} kadar={kadar}><RasporedZapis row={next} raspored={raspored} /></UskokVar>
      </Section> : quietLine ? <Section title="Raspored" action={{ label: 'Ceo raspored', onPress: noop }}>
        <T variant="note" tone="muted">{quietLine}</T>
      </Section> : null}
      <UskokVar from="below" index={at++} kadar={kadar}><MojeRedovi home={home} availableNow={availableNow} dah kadar={kadar} /></UskokVar>
    </Screen>
  </Telefon>;
}

/** Everything is dealt with: one quiet row of 56 with a flat check of 24 (the mark cut), grey, nothing to press. */
function Mir() {
  return <View accessible accessibilityLabel="Ništa ne čeka tvoju odluku." style={s.mir}>
    <View style={s.mirMark}><FactArt kind="check" size={24} muted /></View>
    <T variant="note" tone="muted">Ništa ne čeka tvoju odluku.</T>
  </View>;
}

function artFor(target: HomeTarget): FactArtKind {
  switch (target.kind) {
    case 'CANDIDATES': return 'users';
    case 'APPLICATION': return 'offers';
    case 'AGREEMENT': case 'AGREEMENT_CHANGE': return 'agreements';
    case 'AGREEMENT_TERM': return 'calendar';
    case 'WORKER_PROFILE': return 'users';
    default: return 'tasks';
  }
}

/** A waiting row as today: the task, the action, the reason, and the dot on the picture. */
function Red({ row, last }: { row: HomeAttention; last: boolean }) {
  const task = row.taskTitle ? readableTitle(row.taskTitle) : null, title = readableTitle(row.title);
  const compact = !!task && row.target.kind === 'CANDIDATES';
  const words = task ? { title: task, subtitle: compact ? joined(title, row.detail) : title, ...(compact ? {} : { meta: row.detail }) } : { title, subtitle: row.detail };
  return <ListRow leading={<Oznaceno art={artFor(row.target)} />} {...words} last={last} onPress={noop} accessibilityLabel={[title, task, row.detail].filter(Boolean).join('. ')} />;
}

const s = StyleSheet.create({
  // The calm row: 56 high (a row with neither picture slot nor second line), the check in the 40 slot so the words start where every row's do.
  mir: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.rowMinPlain, paddingVertical: sys.space.md },
  mirMark: { width: layout.slot, alignItems: 'center' },
  more: { paddingTop: sys.space.sm },
});
