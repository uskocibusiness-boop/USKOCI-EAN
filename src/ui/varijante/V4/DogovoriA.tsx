import { StyleSheet, View } from 'react-native';
import type { DogovorProjekcija } from '../../../contracts/projections';
import { readableTitle } from '../../../data/needDetailPresentation';
import { AgreementStatusChip } from '../../agreements/AgreementStatusChip';
import { GroupHeader } from '../../agreements/GroupHeader';
import { AgreementTermNote } from '../../agreements/AgreementOverviewParts';
import { agreementAttention, agreementChip, groupActiveAgreements, isActiveAgreement } from '../../agreements/agreementListModel';
import { agreementNextStep, agreementQuietLine, NextStepCard } from '../../agreements/AgreementWorkspace';
import { T } from '../../Text';
import { Avatar } from '../../system/Avatar';
import { FlowFooter } from '../../system/FlowFooter';
import { Glyph } from '../../system/Glyph';
import { ScreenChrome } from '../../system/ScreenChrome';
import { Surface } from '../../system/Surface';
import { brandAction, sys } from '../../system/tokens';
import { agreementRole, agreementTaskPlace, isNoTermText } from '../../v2/AgreementPresentation';
import { V2Action } from '../../v2/V2Action';
import { DetaljFrame, Iznos, ListFrame, Noga, UsloviILinkovi, deadlineOf, leadWhen, meOf, nameOf, otherOf, sh } from './dogovoriShared';
import { NOW } from './fixtures';
import { noop } from './lab';
import { Lice, ParLica, Uskok, type FaceRing } from './parts';
import { StepsVar } from './StepsVar';

/**
 * VARIANT A, "Par u traci" (from the person and the object; pravac B4 + B2 + B5).
 *
 * LIST: the record leads with the person's face (40) and the agreed time as its first line; the title and "ime · uloga" follow; the state
 * chip and the amount stand in a column on the right; the orange foot only when something waits for me. The groups are production's.
 * DETAIL: the bar carries both people (two faces 56 overlapping 12, the other person in front with the ring that says the Dogovor is
 * live), the time 18/700 stands above the steps, the first step is the mark of USKOČI (the seal), the next step is said under the steps.
 * "POTVRĐENO": the line runs to the third mark and the mark becomes a check (StepsVar `moment`), the tick lands with the check, and the
 * record "Kako je prošla saradnja?" comes up from below (mine to do) with the one green word.
 */
export type DetaljPhase = 'ceka' | 'dogovoren' | 'potvrdjeno' | 'bez-termina';
/** The face in a record of the list: 40, as every list face (pravac B4: no pair and no shadow in a list). */
const LIST_FACE = 40;

function KarticaA({ item }: { item: DogovorProjekcija }) {
  const other = otherOf(item), attention = agreementAttention(item), chip = agreementChip(item, NOW);
  const title = readableTitle(item.naslov), role = agreementRole(other), place = agreementTaskPlace(item);
  const spoken = [leadWhen(item), title, nameOf(other), role, place].filter(Boolean).join(', ');
  return <Surface kind="record" onPress={noop} accessibilityLabel={`Otvori Dogovor ${title}`} accessibilityHint={spoken}>
    <View style={s.row}>
      <Avatar initials={other?.inicijali} size={LIST_FACE} />
      <View style={s.copy}>
        <T variant="bodyStrong" style={s.time}>{leadWhen(item)}</T>
        <T variant="body">{title}</T>
        <T variant="note" tone="muted">{[nameOf(other), role].filter(Boolean).join(' · ')}</T>
      </View>
      <View style={s.side}>
        <AgreementStatusChip chip={chip} detail={item.verzija > 1 ? 'izmenjeni uslovi' : undefined} />
        <Iznos item={item} />
      </View>
    </View>
    {attention ? <Noga attention={attention} /> : null}
  </Surface>;
}

export function ListaA({ items }: { items: readonly DogovorProjekcija[] }) {
  const groups = groupActiveAgreements(items.filter(isActiveAgreement), NOW);
  return <ListFrame empty={items.length === 0}>
    {groups.map((group, index) => <View key={group.key} style={sh.group}>
      <GroupHeader title={group.title} first={index === 0} />
      {group.items.map(item => <KarticaA key={item.id} item={item} />)}
    </View>)}
  </ListFrame>;
}

/** The record that comes up once the Dogovor is confirmed: the next thing is mine, so it rises from below (B1) and its one green word is the way. */
function OcenaZapis({ item }: { item: DogovorProjekcija }) {
  const other = otherOf(item);
  return <Surface kind="record" onPress={noop} accessibilityLabel="Oceni saradnju" accessibilityHint="Otvara ocenu saradnje. Ocena pomaže drugima da biraju i ne može da se menja.">
    <View style={s.row}>
      <Lice initials={other?.inicijali} size={LIST_FACE} />
      <View style={s.copy}>
        <T variant="bodyStrong" style={sh.ink}>Kako je prošla saradnja?</T>
        <T variant="note" tone="muted">Ocena pomaže drugima da biraju i ne može da se menja.</T>
      </View>
      <View style={s.go}><T variant="copy" tone="green" style={sh.actionWord}>Oceni</T><Glyph name="caret-right" size={20} tone="green" /></View>
    </View>
  </Surface>;
}

export function DetaljA({ item, phase }: { item: DogovorProjekcija; phase: DetaljPhase }) {
  const other = otherOf(item), me = meOf(item), worker = me?.uloga === 'uskocer';
  const ring: FaceRing = item.stanje === 'COMPLETED' ? 'none' : item.stanje === 'CANCELLED' ? 'over' : 'live';
  const ownRating = phase === 'potvrdjeno' ? 'DUE' : 'NOT_APPLICABLE';
  const step = agreementNextStep({ state: item.stanje, party: true, worker, change: { waits: false, mine: null }, ownRating, problemOpen: item.problemOtvoren,
    deadline: deadlineOf(item) ?? '' });
  const bar = <ScreenChrome variant="detail" onBack={noop} title={nameOf(other)} subtitle={agreementRole(other) || undefined}
    lead={<View style={s.pair}><ParLica other={other?.inicijali} me={me?.inicijali} ring={ring} /></View>} />;
  const footer = phase === 'ceka' ? <FlowFooter><V2Action label="Potvrdi završetak" onPress={noop} style={brandAction} /></FlowFooter>
    : phase === 'potvrdjeno' ? null
      : <FlowFooter><T variant="note" tone="muted" style={sh.quiet}>{agreementQuietLine({ state: item.stanje, party: true, worker, otherName: other?.ime, change: { waits: false, mine: null }, permissionsKnown: true })}</T></FlowFooter>;
  return <DetaljFrame bar={bar} footer={footer}>
    <View style={s.head}>
      <T accessibilityRole="header" variant="pageTitle" style={sh.ink}>{readableTitle(item.naslov)}</T>
      <View style={s.when}>
        <T style={sh.timeLead}>{leadWhen(item)}</T>
        <T variant="note" tone="muted">{agreementTaskPlace(item)}</T>
      </View>
      <StepsVar state={item.stanje} ownRating={ownRating} seal moment={phase === 'potvrdjeno'} />
      <NextStepCard tone={step.tone} title={step.title} body={step.body} />
    </View>
    {phase === 'potvrdjeno' ? <Uskok from="below" delay={sys.motion.enter}><OcenaZapis item={item} /></Uskok> : null}
    {isNoTermText(item.vremeTekst) && item.stanje === 'CONFIRMED' ? <AgreementTermNote onPropose={noop} /> : null}
    <UsloviILinkovi item={item} />
  </DetaljFrame>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  time: { color: sys.color.ink, fontVariant: ['tabular-nums'] },
  // The column of the chip and the amount is as wide as they need and no wider: the words keep the rest.
  side: { alignItems: 'flex-end', gap: sys.space.sm, flexShrink: 0 },
  go: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, alignSelf: 'center' },
  head: { gap: sys.space.md },
  when: { gap: sys.space.xs },
  pair: { marginRight: sys.space.xs },
});
