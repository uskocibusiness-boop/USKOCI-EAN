import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { T } from '../Text';
import { Press } from '../Press';
import { Surface } from '../system/Surface';
import { FactArt } from '../system/FactArt';
import { Avatar, type AvatarSize } from '../system/Avatar';
import { Glyph } from '../system/Glyph';
import { Appear } from '../system/Appear';
import { sys } from '../system/tokens';
import { ruleWidth } from '../system/layout';
import { ProfilePhoto } from '../media/ContextPhotos';
import { usePressLift } from '../system/usePressLift';
import type { DogovorProjekcija } from '../../contracts/projections';
import type { AgreementTaskGroup } from './agreementListModel';
import { agreementTaskSummary, fillText, type AgreementTaskPerson } from './agreementTaskModel';

const FACE: AvatarSize = 32, OVERLAP = 10, MAX_FACES = 3;

function Face({ person, size = FACE }: { person: { profileId: string | null; initials: string }; size?: AvatarSize }) {
  const letters = <Avatar initials={person.initials} size={size} edge />;
  return person.profileId ? <ProfilePhoto profileId={person.profileId} size={size} fallback={letters} /> : letters;
}

/** The chosen people, overlapped, at most three faces and "+n". */
function Faces({ people }: { people: readonly AgreementTaskPerson[] }) {
  const shown = people.slice(0, MAX_FACES), rest = people.length - shown.length;
  return <View style={s.faces} accessible={false} importantForAccessibility="no-hide-descendants">
    {shown.map((person, index) => <View key={person.agreementId + person.accountId} style={index ? s.overlap : undefined}><Face person={person} /></View>)}
    {rest > 0 ? <View style={[s.more, s.overlap]}><T variant="meta" maxFontSizeMultiplier={1.2} style={s.moreText}>+{rest}</T></View> : null}
  </View>;
}

/**
 * One card per task in Dogovori (owner, 22.11.2026): title; coins + price; globe or pin + place; calendar + term. Bottom:
 * the task owner sees the chosen people and "2 od 3 osobe"; a worker sees the task owner on the left and themself on the right.
 * The whole card opens the task's Dogovor screen; something waiting for me is one orange line above the bottom.
 */
export const AgreementTaskCard = memo(function AgreementTaskCard({ group, index, animate, stale = false, onOpen, onRate }: {
  group: AgreementTaskGroup; index: number; animate: boolean; stale?: boolean;
  onOpen: (group: AgreementTaskGroup) => void; onRate?: (item: DogovorProjekcija) => void;
}) {
  const { style: lift, give, settle } = usePressLift();
  const task = agreementTaskSummary(group);
  const attention = stale ? null : task.attention;
  const owner = task.myRole === 'narucilac';
  const fill = owner ? fillText(task) : null;
  const rateItem = attention?.kind === 'rate' && onRate ? group.items.find(item => item.stanje === 'COMPLETED' && item.ocenaMoguca) : undefined;
  const spoken = [task.title, owner ? 'Vaš zadatak' : 'Uskačete', task.priceText, task.placeText, task.whenText,
    owner ? `${fill}${task.people.length ? `: ${task.people.map(p => p.name).join(', ')}` : ''}` : task.owner ? `Objavio: ${task.owner.name}` : null,
    attention ? attention.title : null].filter(Boolean).join(', ');
  return <Appear index={index} animate={animate}><Animated.View style={lift}>
    <Surface kind="record">
      <Press accessibilityRole="button" accessibilityLabel={`Otvorite zadatak ${task.title}`} accessibilityValue={{ text: spoken }}
        accessibilityHint="Otvara Dogovor ovog zadatka: dogovorene osobe, prijave i grupni razgovor."
        onPress={() => onOpen(group)} onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1} style={s.body}>
        <T variant="heading" numberOfLines={2} style={s.title}>{task.title}</T>
        <View style={s.facts}>
          <View style={s.fact}>
            <FactArt kind="money" size={18} />
            <T variant="bodyStrong" style={s.price} numberOfLines={1}>{task.priceText ?? 'Cena po dogovoru'}</T>
          </View>
          <View style={s.fact}>
            <FactArt kind={task.remote ? 'remote' : 'pin'} size={18} />
            <T variant="note" tone="muted" style={s.factText} numberOfLines={1}>{task.placeText}</T>
          </View>
          <View style={s.fact}>
            <FactArt kind="calendar" size={18} />
            <T variant="note" tone="muted" style={s.factText} numberOfLines={1}>{task.whenText}</T>
          </View>
        </View>
        {attention && !rateItem ? <View style={s.attention}>
          <View style={s.dot} /><T variant="note" style={s.attentionText} numberOfLines={2}>{attention.title}</T>
        </View> : null}
        <View style={s.bottom}>
          {owner ? <>
            {task.people.length ? <Faces people={task.people} /> : <T variant="note" tone="muted">Još niko nije izabran</T>}
            <View style={s.fill}><FactArt kind="users" size={16} /><T variant="note" style={s.fillText}>{fill}</T></View>
          </> : <>
            <View style={s.party}>
              {task.owner ? <Face person={task.owner} /> : <Avatar initials={null} size={FACE} />}
              <View style={s.partyText}>
                <T variant="bodyStrong" numberOfLines={1}>{task.owner?.name ?? 'Naručilac'}</T>
                <T variant="meta" tone="muted" numberOfLines={1}>Objavio zadatak</T>
              </View>
            </View>
            <View style={s.me}>
              <T variant="meta" tone="muted">Vi</T>
              <Face person={{ profileId: task.me?.profilId ?? null, initials: task.me?.inicijali ?? '' }} />
            </View>
          </>}
        </View>
      </Press>
      {rateItem ? <Press accessibilityRole="button" accessibilityLabel={`Ocenite saradnju, ${task.title}`} accessibilityHint="Otvara ocenu saradnje."
        onPress={() => onRate?.(rateItem)} onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1} hitSlop={0} style={s.foot}>
        <View style={s.dot} /><T variant="note" style={[s.attentionText, s.footText]}>Ocenite saradnju</T><Glyph name="caret-right" size={20} tone="muted" />
      </Press> : null}
    </Surface>
  </Animated.View></Appear>;
});

const s = StyleSheet.create({
  body: { gap: sys.space.sm },
  title: { fontSize: 17, lineHeight: 22 },
  facts: { gap: 6, marginVertical: 2 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factText: { flex: 1, minWidth: 0 },
  price: { flex: 1, minWidth: 0, color: sys.color.money },
  attention: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  attentionText: { color: sys.color.warn, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: sys.color.warn },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.md,
    paddingTop: sys.space.sm, marginTop: 2, borderTopWidth: ruleWidth, borderTopColor: sys.color.line },
  faces: { flexDirection: 'row', alignItems: 'center' },
  overlap: { marginLeft: -OVERLAP },
  more: { width: FACE, height: FACE, borderRadius: FACE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.wash,
    borderWidth: 2, borderColor: sys.color.surface },
  moreText: { fontWeight: '700' },
  fill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: sys.color.greenSoft },
  fillText: { color: sys.color.green, fontWeight: '700' },
  party: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  partyText: { flex: 1, minWidth: 0, gap: 1 },
  me: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 48, marginTop: sys.space.sm,
    borderTopWidth: ruleWidth, borderTopColor: sys.color.line },
  footText: { flex: 1 },
});
