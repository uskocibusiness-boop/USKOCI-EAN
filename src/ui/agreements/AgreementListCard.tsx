import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { readableTitle } from '../../data/needDetailPresentation';
import type { DogovorProjekcija } from '../../contracts/projections';
import { BEZ_IZNOSA } from '../../lib/novac';
import { Press } from '../Press';
import { T } from '../Text';
import { ProfilePhoto } from '../media/ContextPhotos';
import { Appear } from '../system/Appear';
import { Avatar } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { useReducedMotion } from '../system/motion';
import { raisedItem, sys } from '../system/tokens';
import { agreementPeople, agreementRole, agreementTerm } from '../v2/AgreementPresentation';
import { CARD_PRESS_SCALE } from '../v2/TaskCard';
import { WaitingDot, faceStyles } from '../v2/TaskFace';
import { agreementAttention, agreementChip, agreementWhen, type AgreementAttention } from './agreementListModel';
import { AgreementStatusChip, agreementChipWord } from './AgreementStatusChip';

/** Recognize the person before opening their agreement; photos and fallback share the same footprint. */
export const AVATAR = 40;
const EASE_OUT = Easing.bezier(...sys.motion.easeOut);

/**
 * A real next action follows the accepted facts: an orange dot and verb distinguish it on the white reading surface.
 * The rating remains its own target; the rule makes its boundary clear without another coloured panel.
 */
function AttentionFoot({ attention }: { attention: AgreementAttention }) {
  return <>
    <WaitingDot />
    <View style={s.footCopy}>
      <T style={s.footTitle}>{attention.title}</T>
      <T style={s.footLine}>{attention.line}</T>
    </View>
    <Glyph name="arrow-right" size={20} tone="muted" />
  </>;
}

/**
 * One Dogovor of the list, about four lines (plan 2.6): the other person's face and the work's title (black, two lines) with
 * "ime · uloga" under it; when and where in grey ("Danas 14:00 · Novi Beograd"); the state chip with the accepted total on the
 * right; and the orange foot ONLY when something waits for me. The body is one press that opens the Dogovor, with no caret: the
 * whole row is the target (B16). The rating is a press of its own, beside the body and never inside it, that goes straight to
 * the rating (A2). Nothing is drawn that the list does not carry: no last message, no rating, no date built from the task.
 *
 * The frame gives under the finger as one object, as a task card does, and holds still under reduced motion.
 */
function AgreementCard({ item, now, onOpen, onRate }: { item: DogovorProjekcija; now: number; onOpen: () => void; onRate?: () => void }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const give = () => { if (!reduced) scale.set(withTiming(CARD_PRESS_SCALE, { duration: sys.motion.press, easing: EASE_OUT })); };
  const settle = () => { scale.set(reduced ? 1 : withSpring(1, { ...sys.motion.spring, reduceMotion: ReduceMotion.System })); };

  const other = item.ucesnici.find(person => !person.viSte);
  const attention = agreementAttention(item);
  const title = readableTitle(item.naslov);
  const role = agreementRole(other);
  const name = other?.ime?.trim() || 'Druga strana';
  const at = new Date(now);
  const chip = agreementChip(item, at);
  const term = agreementTerm(item), remote = item.rezim === 'DALJINSKI';
  // The accepted instant, in Serbian time, when the terms carry one; otherwise the adapter's own sentence about the term.
  const when = agreementWhen(item, at) ?? term.line;
  const place = remote ? 'Na daljinu' : item.putanjaTekst || 'Mesto nije navedeno';
  const amount = item.cena.prikaz, people = agreementPeople(item);
  const ownProposal = !!item.izmenaCeka?.mojPredlog;
  const changed = item.verzija > 1 ? 'izmenjeni uslovi' : undefined;
  // The rating foot is its own press only when the route hands over where it goes; otherwise it stays inside the body.
  const rateAside = attention?.kind === 'rate' && onRate ? attention : null;
  const footInside = attention && !rateAside ? attention : null;
  const spoken = [name, role, `${agreementChipWord(chip)}${changed ? `, ${changed}` : ''}`, when, term.zone, amount ? `${amount} ukupno` : BEZ_IZNOSA, place, people,
    ownProposal ? 'Tvoja izmena čeka odgovor' : null, item.problemOtvoren ? 'Prijavljen je problem' : null]
    .filter((part): part is string => !!part).join(', ');
  // The one Avatar: a missing name (an empty string since 2026-09-24) draws the person, never an empty disc or a dash.
  const initials = <Avatar initials={other?.inicijali} size={AVATAR} />;
  return <Animated.View style={[s.agreement, lift]}>
    <Press accessibilityRole="button" accessibilityLabel={`Otvori Dogovor ${title}`} accessibilityValue={{ text: spoken }}
      accessibilityHint={footInside ? `${footInside.title}. ${footInside.line}` : undefined} onPress={onOpen}
      onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1} style={s.body}>
      <View style={s.main}>
        <View style={s.head}>
          {other?.profilId ? <ProfilePhoto profileId={other.profilId} size={AVATAR} fallback={initials} /> : initials}
          <View style={s.headCopy}>
            <T style={s.title} numberOfLines={2}>{title}</T>
            <T variant="note" tone="muted">{role ? `${name} · ${role}` : name}</T>
          </View>
        </View>
        {/* Accepted facts keep the full row width: the time is the adapter's or the accepted instant's, never shortened or parsed from text. */}
        <T variant="note" style={s.when}>{`${when} · ${place}`}</T>
        {term.zone ? <T variant="meta" tone="muted">{term.zone}</T> : null}
        <View style={s.stateRow}>
          <AgreementStatusChip chip={chip} detail={changed} />
          {/* An accepted total is a quiet receipt line, not an advertised price badge; a missing one is said in words. */}
          {amount ? <T style={s.acceptedPrice}><T style={s.amount}>{amount}</T><T style={s.basis}>{` ukupno${people ? ` · ${people}` : ''}`}</T></T>
            : <T style={[s.acceptedPrice, s.noAmount]}>{BEZ_IZNOSA}</T>}
        </View>
        {/* My own proposal waits for the other side: a quiet line, not a task of mine. */}
        {ownProposal ? <View style={s.note}><FactArt kind="clock" size={16} muted />
          <T variant="meta" tone="muted" style={s.noteText}>Tvoja izmena čeka odgovor</T></View> : null}
        {item.problemOtvoren ? <View style={s.problem}><T variant="meta" style={s.problemText}>Prijavljen je problem · pogledaj Dogovor</T></View> : null}
      </View>
      {footInside ? <View style={s.foot}><AttentionFoot attention={footInside} /></View> : null}
    </Press>
    {/* No hit slop: the hairline is the border between the two targets, and a touch just above it opens the Dogovor. */}
    {rateAside ? <Press accessibilityRole="button" accessibilityLabel={`${rateAside.title}, ${title}`} accessibilityHint="Otvara ocenu saradnje."
      onPress={onRate} onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1} hitSlop={0} style={s.foot}>
      <AttentionFoot attention={rateAside} />
    </Press> : null}
  </Animated.View>;
}

/**
 * One row of the list: the arrival animation and the card. Memoised on the row's own object and primitives, so changing the
 * segment or pulling to refresh re-renders the screen and only the rows whose Dogovor actually changed. The closures over `item`
 * are made here, from the list's stable callbacks. `now` is the minute the groups were taken at, as a number, so a parent render
 * inside the same minute does not draw a card again.
 */
export const AgreementRow = memo(function AgreementRow({ item, index, now, animate, onOpen, onRate }: {
  item: DogovorProjekcija; index: number; now: number; animate: boolean; onOpen: (item: DogovorProjekcija) => void;
  onRate?: (item: DogovorProjekcija) => void;
}) {
  const open = useCallback(() => onOpen(item), [onOpen, item]);
  const rate = useCallback(() => onRate?.(item), [onRate, item]);
  return <Appear index={index} animate={animate}><AgreementCard item={item} now={now} onOpen={open} onRate={onRate ? rate : undefined} /></Appear>;
});

/** The name of a group of the Aktivni list: "Čeka tebe", "Danas", "Sutra"… A heading, not a control. */
export function GroupHeader({ title }: { title: string }) {
  return <T accessibilityRole="header" variant="bodyStrong" style={s.groupTitle}>{title}</T>;
}

const s = StyleSheet.create({
  // One raised appointment contains identity, the accepted time and its existing next action.
  agreement: { ...raisedItem, borderRadius: sys.radius.cardCompact, padding: 16 },
  body: { borderRadius: 0 },
  main: { paddingVertical: 2, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...sys.type.cardTitleCompact, color: sys.color.ink },
  when: { color: sys.color.muted, fontVariant: ['tabular-nums'] },
  stateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 6, paddingTop: 2 },
  acceptedPrice: { flexShrink: 1 },
  amount: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: sys.color.money, fontVariant: ['tabular-nums'] },
  basis: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: sys.color.muted },
  noAmount: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: sys.color.muted },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8 }, noteText: { flexShrink: 1 },
  problem: { alignSelf: 'flex-start', backgroundColor: sys.color.dangerSoft, borderRadius: sys.radius.badge, paddingHorizontal: 10, paddingVertical: 6 },
  problemText: { color: sys.color.danger, fontWeight: '600' },
  foot: { ...faceStyles.ownerFoot, backgroundColor: sys.color.surface, paddingHorizontal: 0,
    minHeight: 52, marginTop: 12, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  footCopy: { flex: 1, minWidth: 0, gap: 1 },
  footTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: sys.color.warn },
  footLine: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: sys.color.muted },
  // A name of a group stands a little away from the card above it; the separator under it is the card's own gap.
  groupTitle: { color: sys.color.ink, paddingTop: sys.space.md },
});
