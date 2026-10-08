import { StyleSheet, View } from 'react-native';
import type { HomeAttention, HomeRaspored, HomeRow, HomeSnapshot, HomeTarget } from '../../../data/homeSnapshot';
import { readableTitle } from '../../../data/needDetailPresentation';
import { HowItWorks } from '../../home/HowItWorks';
import { T } from '../../Text';
import { Avatar } from '../../system/Avatar';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { ListRow } from '../../system/ListRow';
import { Screen } from '../../system/Screen';
import { Section } from '../../system/Section';
import { Surface } from '../../system/Surface';
import { useLayoutClass } from '../../system/textScale';
import { layout } from '../../system/layout';
import { sys } from '../../system/tokens';
import { MojeRedovi, Oznaceno, PocetnaTraka, Telefon, VrataVar, joined, noop, oceniDogovore } from './PocetnaZajednicko';

/**
 * Početna, variant B "Danas u 14" (V1, creative direction 2026-10-08; starting point: the number).
 *
 * THE FOCUS. The TIME of the next Dogovor is the largest word under the doors: "Danas · 14:00–16:00" in the voice of money
 * (`priceLarge`, 24/30, 700, tabular), on the Raspored record that now stands FIRST, directly under the doors; the task, the person
 * (face 32) and the one quiet line follow in it, and the calendar object stands at 32 on the right (not 56: it would compete with
 * the time, D1 P10). "Čeka te" comes after, as today's rows with the dot. The doors and the header are locked and untouched.
 *
 * THE RISK, ANSWERED. With no appointment ahead the hero would vanish: the first row of "Čeka te" then takes its place as the one
 * record, its number first ("2 prijave" in `priceLarge`, the task under it), and the Dogovori with no day stay as today's one quiet line.
 */
export function PocetnaB({ home, availableNow }: { home: HomeSnapshot; availableNow?: boolean }) {
  const { stacked } = useLayoutClass();
  const rows: HomeAttention[] = [...home.attention, ...(home.prompts ?? [])];
  const ratings = home.ratingsDue ?? 0;
  const next = home.agreements.kind === 'known' ? home.agreements.value.rows[0] ?? null : null;
  const raspored = next?.raspored ?? null;
  const quietLine = home.agreements.kind === 'known' && !raspored ? home.agreements.value.quietLine : undefined;
  const nothingWaits = !home.firstRun && rows.length === 0 && ratings === 0 && home.agreements.kind === 'known';
  const more = home.attentionMore + (home.promptsMore ?? 0);
  // The hero: the appointment when there is one ahead; the first waiting row when there is not.
  const fallback: HomeAttention | null = raspored ? null : rows[0] ?? null;
  const others = raspored ? rows : rows.slice(1);
  const waiting = <Section title="Čeka te">
    {fallback ? <BrojPrvi row={fallback} /> : null}
    {others.map((row, index) => <Red key={row.id} row={row} last={index === others.length - 1 && !ratings} />)}
    {ratings > 0 ? <ListRow leading={<Oznaceno art="star" />} title={oceniDogovore(ratings)} onPress={noop} last
      accessibilityLabel={oceniDogovore(ratings)} accessibilityHint="Otvara ocenu saradnje." /> : null}
    {nothingWaits ? <ListRow leading={<FactArt kind="check" size={32} />} tone="quiet" title="Ništa ne čeka tvoju odluku." last /> : null}
    {more > 0 ? <T variant="note" tone="muted" style={s.more}>I još {more} u tvojim zadacima, prijavama i Dogovorima.</T> : null}
  </Section>;
  return <Telefon>
    <Screen kind="root" header={<PocetnaTraka />}>
      <VrataVar onPublish={noop} onEarn={noop} />
      {home.firstRun ? <HowItWorks stacked={stacked} /> : null}
      {next && raspored ? <Section title="Raspored" action={{ label: 'Ceo raspored', onPress: noop }}><Vreme row={next} raspored={raspored} /></Section> : null}
      {home.firstRun ? null : waiting}
      {quietLine ? <Section title="Raspored" action={{ label: 'Ceo raspored', onPress: noop }}><T variant="note" tone="muted">{quietLine}</T></Section> : null}
      <MojeRedovi home={home} availableNow={availableNow} />
    </Screen>
  </Telefon>;
}

/** The hero: the time first and largest, then what and with whom, then the one quiet line. The calendar stands small at the end. */
function Vreme({ row, raspored }: { row: HomeRow; raspored: HomeRaspored }) {
  const appointment = row.appointment, title = readableTitle(row.title);
  const name = appointment?.counterpartName ?? '', role = appointment?.roleLabel ?? null;
  const zone = raspored.zone ? `, ${raspored.zone.charAt(0).toLowerCase()}${raspored.zone.slice(1)}` : '';
  const spoken = [`${raspored.spoken}${zone}`, title, [name, role].filter(Boolean).join(', '), raspored.more].filter(Boolean).join('. ');
  return <Surface kind="record" accessibilityLabel={spoken} accessibilityHint="Otvara Dogovor." onPress={noop} style={s.card}>
    <View style={s.head}>
      <View style={s.when}>
        <T variant="priceLarge" style={s.whenText}>{raspored.when}</T>
        {raspored.zone ? <T variant="meta" tone="muted">{raspored.zone}</T> : null}
      </View>
      <FactArt kind="calendar" size={32} />
    </View>
    <T>{title}</T>
    {name || role ? <View style={s.person}>
      <Avatar initials={appointment?.counterpartInitials} size={32} />
      <View style={s.copy}>
        {name ? <T variant="note" style={s.name}>{name}</T> : null}
        {role ? <T variant="meta" tone="muted">{role}</T> : null}
      </View>
    </View> : null}
    {raspored.more ? <T variant="note" tone="muted">{raspored.more}</T> : null}
  </Surface>;
}

/** No appointment ahead: the first waiting row is the hero, its number first ("2 prijave"), the task and the reason under it. */
function BrojPrvi({ row }: { row: HomeAttention }) {
  const title = readableTitle(row.title), task = row.taskTitle ? readableTitle(row.taskTitle) : null;
  const number = /^\d/.test(title);
  return <Surface kind="record" onPress={noop} accessibilityLabel={[title, task, row.detail].filter(Boolean).join('. ')} style={s.card}>
    <View style={s.head}>
      <View style={s.when}>
        <T variant={number ? 'priceLarge' : 'heading'} style={s.whenText}>{title}</T>
        {task ? <T>{task}</T> : null}
        <T variant="note" tone="muted">{row.detail}</T>
      </View>
      <Oznaceno art={artFor(row.target)} />
    </View>
  </Surface>;
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
  card: { gap: layout.group },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  when: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // The time in the voice of money: ink, 700, tabular, so the clocks line up.
  whenText: { color: sys.color.ink },
  person: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  name: { color: sys.color.ink, fontWeight: '600' },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  more: { paddingTop: sys.space.sm },
});
