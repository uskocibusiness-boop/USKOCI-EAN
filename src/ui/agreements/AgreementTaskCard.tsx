import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated from 'react-native-reanimated';
import { T } from '../Text';
import { Press } from '../Press';
import { Surface } from '../system/Surface';
import { FactArt } from '../system/FactArt';
import { FACT_ROW_ART, FactRow } from '../system/FactRow';
import { Avatar, type AvatarSize } from '../system/Avatar';
import { Glyph } from '../system/Glyph';
import { Appear } from '../system/Appear';
import { sys } from '../system/tokens';
import { ProfilePhoto } from '../media/ContextPhotos';
import { usePressLift } from '../system/usePressLift';
import { applicationPriceBasisText } from '../../lib/novac';
import type { DogovorProjekcija } from '../../contracts/projections';
import type { AgreementTaskGroup } from './agreementListModel';
import { agreementTaskSummary, isLiveAgreement, type AgreementTaskPerson } from './agreementTaskModel';

const OVERLAP = 12, MAX_FACES = 3;

function Face({ person, size }: { person: { profileId: string | null; initials: string }; size: AvatarSize }) {
  const letters = <Avatar initials={person.initials} size={size} edge />;
  return person.profileId ? <ProfilePhoto profileId={person.profileId} size={size} fallback={letters} /> : letters;
}

/** The chosen people, overlapped: at most three faces, then "···". */
function Faces({ people }: { people: readonly AgreementTaskPerson[] }) {
  const shown = people.slice(0, MAX_FACES);
  return <View style={s.faces}>
    {shown.map((person, index) => <View key={person.agreementId + person.accountId} style={index ? s.overlap : undefined}><Face person={person} size={32} /></View>)}
    {people.length > MAX_FACES ? <T variant="bodyStrong" tone="muted" style={s.dots}>···</T> : null}
  </View>;
}

/**
 * One Dogovor card per task (owner's sketch, 22.11.2026), drawn like the task cards in Zadaci: title; coins with the price and
 * currency; globe ("Na daljinu") or pin with the place; calendar with the date and time or "fleksibilno". At the bottom, left: a
 * circle and a name — me when I posted the task, the task owner when I am the one helping. Right: when the task is mine, the
 * chosen people's faces, "···" and "1/3"; when I help, my own face and how full the task is.
 */
export const AgreementTaskCard = memo(function AgreementTaskCard({ group, index, animate, stale = false, onOpen, onRate }: {
  group: AgreementTaskGroup; index: number; animate: boolean; stale?: boolean;
  onOpen: (group: AgreementTaskGroup) => void; onRate?: (item: DogovorProjekcija) => void;
}) {
  const { style: lift, give, settle } = usePressLift();
  const task = agreementTaskSummary(group);
  const first = group.items[0];
  const attention = stale ? null : task.attention;
  const owner = task.myRole === 'narucilac';
  const fraction = task.total ? `${task.filled}/${task.total}` : null;
  const amount = first.cena.prikaz, basis = amount ? applicationPriceBasisText(first.osnovaCene) : null;
  const priceSame = task.priceText !== 'Različite cene po osobi';
  const left = owner ? { profileId: task.me?.profilId ?? null, initials: task.me?.inicijali ?? '', name: task.me?.ime || 'Vi', line: 'Vaš zadatak' }
    : { profileId: task.owner?.profileId ?? null, initials: task.owner?.initials ?? '', name: task.owner?.name ?? 'Naručilac', line: 'Objavio zadatak' };
  const chosen = task.people.filter(p => isLiveAgreement(p.agreement));
  const rateItem = attention?.kind === 'rate' && onRate ? group.items.find(item => item.stanje === 'COMPLETED' && item.ocenaMoguca) : undefined;
  const spoken = [task.title, task.priceText, task.placeText, task.whenText, owner ? 'Vaš zadatak' : `Objavio: ${left.name}`,
    fraction ? `popunjeno ${fraction}` : null, owner && chosen.length ? `Dogovoreno sa: ${chosen.map(p => p.name).join(', ')}` : null,
    attention ? attention.title : null].filter(Boolean).join(', ');
  return <Appear index={index} animate={animate}><Animated.View style={lift}>
    <Surface kind="record">
      <Press accessibilityRole="button" accessibilityLabel={`Otvorite Dogovor: ${task.title}`} accessibilityValue={{ text: spoken }}
        onPress={() => onOpen(group)} onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1} style={s.body}>
        <T variant="cardTitle" numberOfLines={2} style={s.title}>{task.title}</T>
        <View style={s.facts}>
          <View style={s.valueWithArt}>
            <View style={s.valueArt}><FactArt kind="money" size={FACT_ROW_ART} /></View>
            <View style={s.valueCopy}>
              <T variant="priceRow" style={s.amount}>{priceSame && amount ? amount : task.priceText ?? 'Cena po dogovoru'}</T>
              {priceSame && basis ? <T variant="note" tone="muted">{basis}</T> : null}
            </View>
          </View>
          <FactRow art={task.remote ? 'remote' : 'pin'} value={task.placeText} />
          <FactRow art="calendar" value={task.whenText} />
        </View>
        {attention && !rateItem ? <View style={s.attention}><View style={s.dot} />
          <T variant="note" style={s.attentionText} numberOfLines={2}>{attention.title}</T></View> : null}
        <View style={s.foot}>
          <View style={s.person}>
            <View style={s.face}><Face person={left} size={40} /></View>
            <View style={s.personText}>
              <T variant="note" style={s.name} numberOfLines={1}>{left.name}</T>
              <T variant="note" tone="muted" numberOfLines={1}>{left.line}</T>
            </View>
          </View>
          <View style={s.right}>
            {owner ? <Faces people={chosen} /> : <Face person={{ profileId: task.me?.profilId ?? null, initials: task.me?.inicijali ?? '' }} size={32} />}
            {fraction ? <View style={s.capacity}>
              <Image source={require('../../../assets/illustrations/natural-v1/users.webp')} style={s.capacityIcon} contentFit="contain" />
              <T variant="note" style={s.capacityFraction}>{fraction}</T>
            </View> : null}
          </View>
        </View>
      </Press>
      {rateItem ? <Press accessibilityRole="button" accessibilityLabel={`Ocenite saradnju, ${task.title}`} accessibilityHint="Otvara ocenu saradnje."
        onPress={() => onRate?.(rateItem)} onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1} hitSlop={0} style={s.rateFoot}>
        <View style={s.dot} /><T variant="note" style={[s.attentionText, s.flex]}>Ocenite saradnju</T><Glyph name="caret-right" size={20} tone="muted" />
      </Press> : null}
    </Surface>
  </Animated.View></Appear>;
});

const s = StyleSheet.create({
  // The same rhythm as the task cards in Zadaci (TaskRecordBody): 12 between parts, 4 inside the facts.
  body: { gap: sys.space.md },
  title: { color: sys.color.ink, fontSize: 17, lineHeight: 22 },
  facts: { gap: sys.space.xs },
  valueArt: { width: FACT_ROW_ART, height: FACT_ROW_ART },
  valueWithArt: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: FACT_ROW_ART },
  valueCopy: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.sm },
  amount: { color: sys.color.money, flexShrink: 1 },
  attention: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  attentionText: { color: sys.color.warn, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: sys.color.warn },
  foot: { alignSelf: 'stretch', paddingTop: sys.space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.line,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: sys.space.md },
  person: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  face: { width: 40, height: 40, borderRadius: sys.radius.pill, overflow: 'hidden', flexShrink: 0 },
  personText: { flex: 1, minWidth: 0 },
  name: { color: sys.color.ink, fontWeight: '600' },
  right: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  faces: { flexDirection: 'row', alignItems: 'center' },
  overlap: { marginLeft: -OVERLAP },
  dots: { marginLeft: 4 },
  capacity: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  capacityIcon: { width: 24, height: 24 },
  capacityFraction: { fontWeight: '800', color: sys.color.ink, fontSize: 16 },
  rateFoot: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 48, marginTop: sys.space.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.line },
  flex: { flex: 1 },
});
