import { StyleSheet, View } from 'react-native';
import type { DogovorProjekcija } from '../../../contracts/projections';
import { readableTitle } from '../../../data/needDetailPresentation';
import { agreementAttention, isActiveAgreement } from '../../agreements/agreementListModel';
import { T } from '../../Text';
import { Avatar } from '../../system/Avatar';
import { Surface } from '../../system/Surface';
import { brandAction, sys } from '../../system/tokens';
import { agreementTaskPlace } from '../../v2/AgreementPresentation';
import { V2Action } from '../../v2/V2Action';
import { DetaljFrame, Iznos, ListFrame, PersonBar, UsloviILinkovi, leadWhen, moveOf, otherOf, sh, type Move } from './dogovoriShared';
import { noop } from './lab';
import { Lice, TackaCeka, Uskok } from './parts';
import { StepsVar } from './StepsVar';
import type { DetaljPhase } from './DogovoriA';

/**
 * VARIANT C, "Potez kao kartica" (from the movement; pravac B1 with a direction + B4).
 *
 * LIST: no day groups and no chips; every record leads with the MOVE, a short sentence to the person with the other person's face
 * beside it ("Potvrdi da je gotovo.", "Čekaš da Marko javi da je gotovo."), the orange dot only before a move that is mine; the
 * title, then the time and the place, the amount on the right. What waits for me stands first and comes into the frame from above
 * (it came from the other side). DETAIL: the screen begins with one record of the next step, the face of whoever is on the move
 * (mine when it is mine) and the ONE green action inside it; the foot has no button; the steps and the rest follow. When the state
 * changes while the person looks, the new record comes down from above. A step that waits for the other side is a `panel`
 * (read), a step that is mine is a `record` (act): the shadow means "yours to do".
 */
const LIST_FACE = 40;
const MOVE_FACE = 56;

function KarticaC({ item, index, arrives }: { item: DogovorProjekcija; index: number; arrives: boolean }) {
  const other = otherOf(item), move = moveOf(item), title = readableTitle(item.naslov);
  const facts = `${leadWhen(item)} · ${agreementTaskPlace(item)}`;
  const card = <Surface kind="record" onPress={noop} accessibilityLabel={`Otvori Dogovor ${title}`} accessibilityHint={[move.sentence, facts].join(', ')}>
    <View style={s.row}>
      <Avatar initials={other?.inicijali} size={LIST_FACE} />
      <View style={s.copy}>
        <View style={s.sentenceRow}>
          {move.mine ? <TackaCeka /> : null}
          <T variant="bodyStrong" style={[sh.ink, move.mine && s.mine, s.sentence]}>{move.sentence}</T>
        </View>
        <T variant="body" numberOfLines={2}>{title}</T>
        <T variant="note" tone="muted">{facts}</T>
      </View>
      <Iznos item={item} style={s.amount} />
    </View>
  </Surface>;
  return arrives ? <Uskok from="above" delay={index * sys.motion.stagger}>{card}</Uskok> : card;
}

export function ListaC({ items }: { items: readonly DogovorProjekcija[] }) {
  const active = items.filter(isActiveAgreement);
  const mine = active.filter(item => agreementAttention(item) !== null), rest = active.filter(item => agreementAttention(item) === null);
  return <ListFrame empty={items.length === 0}>
    {mine.map((item, index) => <KarticaC key={item.id} item={item} index={index} arrives />)}
    {rest.map((item, index) => <KarticaC key={item.id} item={item} index={mine.length + index} arrives={false} />)}
  </ListFrame>;
}

/** The record of the next step: the face of whoever is on the move, the sentence, why, and (when the move is mine) the one green action. */
function Potez({ move, action, arrived = false }: { move: Move; action?: string; arrived?: boolean }) {
  const words = <View style={s.moveRow}>
    <Lice initials={move.who?.inicijali} size={MOVE_FACE} edge={move.mine} />
    <View style={s.copy}>
      <T accessibilityRole="header" variant="heading" style={sh.ink}>{move.sentence}</T>
      {move.detail ? <T variant="note" tone="muted">{move.detail}</T> : null}
    </View>
  </View>;
  const body = move.mine && action ? <Surface kind="record" testID="var-potez">{words}<View style={s.action}><V2Action label={action} onPress={noop} style={brandAction} /></View></Surface>
    : <Surface kind="panel" testID="var-potez">{words}</Surface>;
  return arrived ? <Uskok from="above">{body}</Uskok> : body;
}

export function DetaljC({ item, phase }: { item: DogovorProjekcija; phase: DetaljPhase }) {
  const move = moveOf(item);
  const ownRating = phase === 'potvrdjeno' ? 'DUE' : 'NOT_APPLICABLE';
  const action = phase === 'ceka' ? 'Potvrdi završetak' : phase === 'potvrdjeno' ? 'Oceni saradnju' : phase === 'bez-termina' ? 'Predloži termin' : undefined;
  // A term the two still have to agree is a move of mine as much as the other side's: the record offers the one way to it.
  const step: Move = phase === 'bez-termina' ? { ...move, mine: true, who: otherOf(item) } : move;
  return <DetaljFrame bar={<PersonBar item={item} />}>
    <Potez move={step} action={action} arrived={phase === 'potvrdjeno'} />
    <StepsVar state={item.stanje} ownRating={ownRating} moment={phase === 'potvrdjeno'} />
    <View style={s.head}>
      <T accessibilityRole="header" variant="heading" style={sh.ink}>{readableTitle(item.naslov)}</T>
      <T variant="note" tone="muted">{`${leadWhen(item)} · ${agreementTaskPlace(item)}`}</T>
    </View>
    <UsloviILinkovi item={item} />
  </DetaljFrame>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  sentenceRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  sentence: { flex: 1, minWidth: 0 },
  mine: { color: sys.color.warn },
  amount: { flexShrink: 0, alignSelf: 'flex-start' },
  moveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  action: { paddingTop: sys.space.base },
  head: { gap: sys.space.xs },
});
