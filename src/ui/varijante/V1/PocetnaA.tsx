import { StyleSheet, View } from 'react-native';
import type { HomeSnapshot, HomeTarget } from '../../../data/homeSnapshot';
import { readableTitle } from '../../../data/needDetailPresentation';
import { inicijali } from '../../../lib/inicijali';
import { HowItWorks } from '../../home/HowItWorks';
import { T } from '../../Text';
import { Avatar } from '../../system/Avatar';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { Glyph } from '../../system/Glyph';
import { ListRow } from '../../system/ListRow';
import { Screen } from '../../system/Screen';
import { Section } from '../../system/Section';
import { Surface } from '../../system/Surface';
import { useLayoutClass } from '../../system/textScale';
import { sys } from '../../system/tokens';
import type { Kadar } from './kadar';
import { MojeRedovi, PocetnaTraka, TackaVar, Telefon, VrataVar, joined, noop, oceniDogovore } from './PocetnaZajednicko';
import type { VarAttention } from './podaci';
import { UskokVar } from './UskokVar';

/**
 * Početna, variant A "Lice koje čeka" (V1, creative direction 2026-10-08; starting point: the person and the object).
 *
 * THE FOCUS. The first row of "Čeka te" is the ONLY record on the screen under the doors: a face (40) of the person it came from,
 * a verb ("Marko uskače na tvoj zadatak"), the task under it and the amount at the end, in the voice of money (B5). It carries the
 * one orange dot of the screen (B1: only what waits). Every other row of "Čeka te" is a thin `ListRow` without a dot, and the next
 * appointment is a row too (calendar, the day first), because a second card would make the hero one of two. The doors and the
 * header are locked and untouched. The new row comes in from ABOVE (B1: it came from the other side), once, and its dot pulses once.
 *
 * WHAT IT ASKS OF THE DATA. The server's attention row says "2 prijave · Pomoć pri selidbi · čeka tvoj izbor" and nothing about who or
 * how much; A needs the person (name, profile id for the photo) and the amount of the newest application on that row, or reads them
 * from the candidates the phone lists for the task. Until then the hero is drawn as today's row with the task's own picture.
 */
export function PocetnaA({ home, availableNow, kadar }: { home: HomeSnapshot; availableNow?: boolean; kadar: Kadar }) {
  const { stacked } = useLayoutClass();
  const rows: VarAttention[] = [...home.attention, ...(home.prompts ?? [])];
  const [hero, ...rest] = rows;
  const ratings = home.ratingsDue ?? 0;
  const next = home.agreements.kind === 'known' ? home.agreements.value.rows[0] ?? null : null;
  const raspored = next?.raspored ?? null;
  const quietLine = home.agreements.kind === 'known' && !raspored ? home.agreements.value.quietLine : undefined;
  const nothingWaits = !home.firstRun && rows.length === 0 && ratings === 0 && home.agreements.kind === 'known';
  const more = home.attentionMore + (home.promptsMore ?? 0);
  return <Telefon>
    <Screen kind="root" header={<PocetnaTraka />}>
      <VrataVar onPublish={noop} onEarn={noop} />
      {home.firstRun ? <HowItWorks stacked={stacked} /> : <Section title="Čeka te">
        {hero ? <UskokVar from="above" kadar={kadar}><Lice row={hero} kadar={kadar} /></UskokVar> : null}
        {rest.map((row, index) => <Tanak key={row.id} row={row} last={index === rest.length - 1 && !ratings} />)}
        {ratings > 0 ? <ListRow leading={<FactArt kind="star" size={32} />} title={oceniDogovore(ratings)} onPress={noop} last
          accessibilityLabel={oceniDogovore(ratings)} accessibilityHint="Otvara ocenu saradnje." /> : null}
        {nothingWaits ? <ListRow leading={<FactArt kind="check" size={32} />} tone="quiet" title="Ništa ne čeka tvoju odluku." last /> : null}
        {more > 0 ? <T variant="note" tone="muted" style={s.more}>I još {more} u tvojim zadacima, prijavama i Dogovorima.</T> : null}
      </Section>}
      {next && raspored ? <Section title="Raspored" action={{ label: 'Ceo raspored', onPress: noop }}>
        <ListRow leading={<FactArt kind="calendar" size={32} />} title={raspored.when} subtitle={readableTitle(next.title)}
          meta={[next.appointment?.counterpartName, next.appointment?.roleLabel].filter(Boolean).join(' · ') || undefined} onPress={noop} last
          accessibilityLabel={[raspored.spoken, readableTitle(next.title), next.appointment?.counterpartName].filter(Boolean).join('. ')} accessibilityHint="Otvara Dogovor." />
      </Section> : quietLine ? <Section title="Raspored" action={{ label: 'Ceo raspored', onPress: noop }}>
        <T variant="note" tone="muted">{quietLine}</T>
      </Section> : null}
      <MojeRedovi home={home} availableNow={availableNow} />
    </Screen>
  </Telefon>;
}

/** The picture a kind of waiting row is drawn with when it has no face, as `HomePresentation.artFor`. */
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

/** The person's first name, for the verb line; the whole name is what a screen reader hears. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * The hero: the one record of the screen. With a person: the face, "Marko uskače na tvoj zadatak", the task, the count and the
 * amount at the end. Without one (a term to propose, a draft): the task's own picture, the row's words and a caret.
 */
function Lice({ row, kadar }: { row: VarAttention; kadar: Kadar }) {
  const task = row.taskTitle ? readableTitle(row.taskTitle) : null;
  const person = row.osoba?.ime ?? null;
  const title = person ? `${firstName(person)} uskače na tvoj zadatak` : task ?? readableTitle(row.title);
  const subtitle = person ? task : task ? joined(readableTitle(row.title), row.detail) : row.detail;
  const meta = person ? joined(readableTitle(row.title), row.detail) : null;
  const spoken = [person, title, subtitle, meta, row.iznos].filter(Boolean).join('. ');
  return <Surface kind="record" onPress={noop} accessibilityLabel={spoken} accessibilityHint="Otvara prijave za izbor." style={s.hero}>
    <View style={s.heroRow}>
      <View style={s.face}>
        {person ? <Avatar initials={inicijali(person)} size={40} /> : <FactArt kind={artFor(row.target)} size={40} />}
        <TackaVar pulse kadar={kadar} />
      </View>
      <View style={s.copy}>
        <T variant="bodyStrong">{title}</T>
        {/* The verb takes the whole line; the task and the amount share the second, money at its end, so nothing wraps for the figure. */}
        {subtitle || row.iznos ? <View style={s.line}>
          {subtitle ? <T variant="note" tone="muted" style={s.grow}>{subtitle}</T> : null}
          {row.iznos ? <T variant="priceRow" style={s.amount}>{row.iznos}</T> : null}
        </View> : null}
        {meta ? <T variant="meta" tone="muted">{meta}</T> : null}
      </View>
      {row.iznos ? null : <Glyph name="caret-right" size={20} tone="muted" />}
    </View>
  </Surface>;
}

/** Every other thing that waits: a thin row, the task's picture, no dot (the dot is the hero's alone). */
function Tanak({ row, last }: { row: VarAttention; last: boolean }) {
  const task = row.taskTitle ? readableTitle(row.taskTitle) : null;
  const title = readableTitle(row.title);
  const compact = !!task && row.target.kind === 'CANDIDATES';
  const words = task ? { title: task, subtitle: compact ? joined(title, row.detail) : title, ...(compact ? {} : { meta: row.detail }) } : { title, subtitle: row.detail };
  return <ListRow leading={<FactArt kind={artFor(row.target)} size={32} />} {...words} last={last} onPress={noop}
    accessibilityLabel={[title, task, row.detail].filter(Boolean).join('. ')} />;
}

const s = StyleSheet.create({
  hero: { marginBottom: sys.space.xs },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  face: { width: 40, height: 40, flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: sys.space.md },
  grow: { flex: 1, minWidth: 0 },
  // Money keeps its whole width; the words beside it give way.
  amount: { color: sys.color.money, flexShrink: 0 },
  more: { paddingTop: sys.space.sm },
});
