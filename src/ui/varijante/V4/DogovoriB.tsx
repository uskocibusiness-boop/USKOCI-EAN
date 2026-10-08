import { StyleSheet, View } from 'react-native';
import type { DogovorProjekcija } from '../../../contracts/projections';
import { readableTitle } from '../../../data/needDetailPresentation';
import { AgreementStatusChip } from '../../agreements/AgreementStatusChip';
import { GroupHeader } from '../../agreements/GroupHeader';
import { AgreementTermNote } from '../../agreements/AgreementOverviewParts';
import { agreementAttention, agreementChip, groupActiveAgreements, isActiveAgreement, type AgreementGroupKey } from '../../agreements/agreementListModel';
import { agreementQuietLine } from '../../agreements/AgreementWorkspace';
import { T } from '../../Text';
import { FlowFooter } from '../../system/FlowFooter';
import { Surface } from '../../system/Surface';
import { brandAction, sys } from '../../system/tokens';
import { AgreementTaskLink, agreementRole, agreementTaskPlace, isNoTermText } from '../../v2/AgreementPresentation';
import { V2Action } from '../../v2/V2Action';
import { DetaljFrame, Iznos, ListFrame, Noga, PersonBar, UsloviILinkovi, clockOnly, deadlineOf, leadWhen, meOf, nameOf, otherOf, sh } from './dogovoriShared';
import { NOW } from './fixtures';
import { noop } from './lab';
import { StepsVar } from './StepsVar';
import type { DetaljPhase } from './DogovoriA';

/**
 * VARIANT B, "Vreme vodi" (from the number; pravac B5, R2 a1 and b2).
 *
 * LIST: the groups are the days (Čeka tebe · Danas · Sutra · Ove nedelje · Bez tačnog termina) and the record leads with the TIME at
 * 18/700 tabular: under a day heading only the clock ("14:00–16:00"), under "Čeka tebe" the whole date; no face. The title is 16, the
 * people and the place one grey line, the chip and the amount the last line. A record with no term says so in its first line and
 * carries "Predloži termin". DETAIL: the sentence of the move (21) stands first, the agreed time at 24/700 under it as the one figure
 * the screen is built around, then the steps; the bar is production's. "POTVRĐENO": the sentence is "Potvrđeno." and does not move;
 * the line runs to the check; the terms under it are the receipt.
 */
const DAY_GROUPS: readonly AgreementGroupKey[] = ['today', 'tomorrow'];

function KarticaB({ item, dayGroup }: { item: DogovorProjekcija; dayGroup: boolean }) {
  const other = otherOf(item), attention = agreementAttention(item), chip = agreementChip(item, NOW);
  const title = readableTitle(item.naslov), noTerm = isNoTermText(item.vremeTekst) && item.stanje === 'CONFIRMED';
  const lead = noTerm ? null : dayGroup ? clockOnly(item) : leadWhen(item);
  const people = [nameOf(other), agreementRole(other), agreementTaskPlace(item)].filter(Boolean).join(' · ');
  return <Surface kind="record" onPress={noop} accessibilityLabel={`Otvori Dogovor ${title}`} accessibilityHint={[lead ?? 'Termin nije dogovoren', people].join(', ')}>
    <View style={s.body}>
      {lead ? <T style={sh.timeLead}>{lead}</T> : <View style={s.noTerm}>
        <T variant="bodyStrong" tone="muted">Termin nije dogovoren</T>
        <T variant="copy" tone="green" style={sh.actionWord}>Predloži termin</T>
      </View>}
      <T variant="body" numberOfLines={2}>{title}</T>
      <T variant="note" tone="muted">{people}</T>
      <View style={s.stateRow}>
        <AgreementStatusChip chip={chip} detail={item.verzija > 1 ? 'izmenjeni uslovi' : undefined} />
        <Iznos item={item} />
      </View>
    </View>
    {attention ? <Noga attention={attention} /> : null}
  </Surface>;
}

export function ListaB({ items }: { items: readonly DogovorProjekcija[] }) {
  const groups = groupActiveAgreements(items.filter(isActiveAgreement), NOW);
  return <ListFrame empty={items.length === 0}>
    {groups.map((group, index) => <View key={group.key} style={sh.group}>
      <GroupHeader title={group.title} first={index === 0} />
      {group.items.map(item => <KarticaB key={item.id} item={item} dayGroup={DAY_GROUPS.includes(group.key)} />)}
    </View>)}
  </ListFrame>;
}

/** The sentence of the move, to the person, by phase (R2 b1): it changes with the state and never moves. */
function sentenceOf(item: DogovorProjekcija, phase: DetaljPhase): string {
  const name = nameOf(otherOf(item));
  if (phase === 'ceka') return 'Potvrdi da je gotovo.';
  if (phase === 'potvrdjeno') return 'Potvrđeno. Hvala na saradnji.';
  if (phase === 'bez-termina') return 'Dogovorite termin.';
  return meOf(item)?.uloga === 'uskocer' ? 'Kad završiš, javi da je gotovo.' : `Čekaš da ${name} javi da je gotovo.`;
}

export function DetaljB({ item, phase }: { item: DogovorProjekcija; phase: DetaljPhase }) {
  const other = otherOf(item), me = meOf(item), worker = me?.uloga === 'uskocer';
  const ownRating = phase === 'potvrdjeno' ? 'DUE' : 'NOT_APPLICABLE';
  const deadline = phase === 'ceka' ? deadlineOf(item) : null;
  const footer = phase === 'ceka' ? <FlowFooter><V2Action label="Potvrdi završetak" onPress={noop} style={brandAction} /></FlowFooter>
    : phase === 'potvrdjeno' ? <FlowFooter><V2Action label="Oceni saradnju" onPress={noop} style={brandAction} /></FlowFooter>
      : <FlowFooter><T variant="note" tone="muted" style={sh.quiet}>{phase === 'bez-termina' ? 'Dogovorite tačno vreme u Porukama, pa ga upišite.'
        : agreementQuietLine({ state: item.stanje, party: true, worker, otherName: other?.ime, change: { waits: false, mine: null }, permissionsKnown: true })}</T></FlowFooter>;
  return <DetaljFrame bar={<PersonBar item={item} />} footer={footer}>
    <View style={s.head}>
      <T accessibilityRole="header" variant="title" style={sh.ink}>{sentenceOf(item, phase)}</T>
      <View style={s.when}>
        <T style={sh.timeHero}>{leadWhen(item)}</T>
        <T variant="note" tone="muted">{agreementTaskPlace(item)}</T>
        {deadline ? <T variant="note" tone="muted">{`${deadline} · bez odgovora se Dogovor zatvara sam.`}</T> : null}
      </View>
      <StepsVar state={item.stanje} ownRating={ownRating} moment={phase === 'potvrdjeno'} />
    </View>
    {phase === 'bez-termina' ? <AgreementTermNote onPropose={noop} /> : null}
    <AgreementTaskLink agreement={item} onOpenTask={noop} />
    <UsloviILinkovi item={item} />
  </DetaljFrame>;
}

const s = StyleSheet.create({
  body: { gap: sys.space.xs },
  noTerm: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.md, rowGap: sys.space.xs },
  stateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: sys.space.md, rowGap: sys.space.sm, paddingTop: sys.space.xs },
  head: { gap: sys.space.md },
  when: { gap: sys.space.xs },
});
