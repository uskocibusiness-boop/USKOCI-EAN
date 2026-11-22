import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { T } from '../Text';
import { Press } from '../Press';
import { V2Action } from '../v2/V2Action';
import { Surface } from '../system/Surface';
import { Avatar } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { useReducedMotion } from '../system/motion';
import { sys } from '../system/tokens';
import { ProfilePhoto } from '../media/ContextPhotos';
import { cenaSaOsnovom } from '../../lib/novac';
import type { KandidatProjekcija } from '../../contracts/projections';

const SETTLE = { ...sys.motion.sheetSpring, bounciness: undefined };
const INSTANT = { ...SETTLE, stiffness: sys.motion.sheetSpring.stiffness * 40, damping: sys.motion.sheetSpring.damping * 7 };
const SCROLL_FIRST: [number, number] = [-16, 16];

/**
 * One application on the task's Dogovor screen (owner, 22.11.2026): swipe right accepts (the existing selection review opens,
 * with its own journal and confirmation), swipe left declines after one short confirmation and the application disappears.
 * Swiping is never the only way: the same two commands are buttons for a screen reader and under a long text setting.
 */
export function ApplicationSwipeCard({ candidate, busy, error, onAccept, onDecline }: {
  candidate: KandidatProjekcija; busy: boolean; error: string | null;
  onAccept: () => void; onDecline: () => void;
}) {
  const swipeable = useRef<Swipeable>(null);
  const reduced = useReducedMotion();
  const [confirming, setConfirming] = useState(false);
  const opened = useCallback((direction: 'left' | 'right') => {
    swipeable.current?.close();
    if (busy) return;
    if (direction === 'left') onAccept(); else setConfirming(true);
  }, [busy, onAccept]);
  const price = candidate.cena.prikaz ? cenaSaOsnovom(candidate.cena.prikaz, candidate.osnovaCene) : 'Cena nije navedena';
  const letters = <Avatar initials={candidate.inicijali} size={48} edge />;
  const people = candidate.pokrivaMesta > 1 ? `${candidate.pokrivaMesta} osobe` : '1 osoba';
  return <Swipeable ref={swipeable} failOffsetY={SCROLL_FIRST} overshootLeft={false} overshootRight={false}
    childrenContainerStyle={s.surface} animationOptions={reduced ? INSTANT : SETTLE} onSwipeableOpen={opened}
    renderLeftActions={() => <View style={[s.panel, s.accept]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Glyph name="check" size={24} tone="onGreen" /><T variant="action" style={s.onDark}>Prihvatite</T></View>}
    renderRightActions={() => <View style={[s.panel, s.decline]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Glyph name="close" size={24} tone="onGreen" /><T variant="action" style={s.onDark}>Odbijte</T></View>}>
    <Surface kind="record">
      <View accessible accessibilityLabel={`Prijava: ${candidate.ime}, ${price}, ${people}`}
        accessibilityHint="Prevucite udesno da prihvatite ili ulevo da odbijete prijavu."
        accessibilityActions={[{ name: 'accept', label: 'Prihvatite prijavu' }, { name: 'decline', label: 'Odbijte prijavu' }]}
        onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'accept') onAccept(); else setConfirming(true); }}
        style={s.row}>
        {candidate.radnikProfilId ? <ProfilePhoto profileId={candidate.radnikProfilId} size={48} fallback={letters} /> : letters}
        <View style={s.copy}>
          <T variant="bodyStrong" numberOfLines={1}>{candidate.ime}</T>
          {candidate.ocenaTekst ? <View style={s.fact}><FactArt kind="star" size={16} /><T variant="meta" tone="muted" numberOfLines={1}>{candidate.ocenaTekst}</T></View> : null}
          <View style={s.fact}><FactArt kind="money" size={16} /><T variant="note" style={s.money} numberOfLines={1}>{price}</T></View>
          <View style={s.fact}><FactArt kind="users" size={16} /><T variant="meta" tone="muted">{people}</T></View>
        </View>
      </View>
      {candidate.napomena ? <View style={s.message}><T variant="copy" numberOfLines={6}>{candidate.napomena}</T></View> : null}
      {confirming ? <View style={s.confirm} accessibilityLiveRegion="polite">
        <T variant="bodyStrong">Odbijte prijavu osobe {candidate.ime}?</T>
        <T variant="note" tone="muted">Prijava nestaje sa liste, a osoba dobija obaveštenje da nije izabrana.</T>
        <View style={s.confirmRow}>
          <V2Action tone="neutral" kind="quiet" label="Otkažite" disabled={busy} onPress={() => setConfirming(false)} />
          <V2Action tone="neutral" kind="destructive" label="Odbijte" loading={busy} disabled={busy} onPress={onDecline} />
        </View>
      </View> : <View style={s.hintRow}>
        <Press accessibilityRole="button" accessibilityLabel={`Odbijte prijavu: ${candidate.ime}`} onPress={() => setConfirming(true)}
          disabled={busy} haptic="select" style={s.hint}><Glyph name="caret-left" size={20} tone="danger" /><T variant="meta" tone="danger">Odbijte</T></Press>
        <Press accessibilityRole="button" accessibilityLabel={`Prihvatite prijavu: ${candidate.ime}`} onPress={onAccept}
          disabled={busy} haptic="select" style={s.hint}><T variant="meta" tone="green">Prihvatite</T><Glyph name="caret-right" size={20} tone="green" /></Press>
      </View>}
      {error ? <T variant="note" tone="danger">{error}</T> : null}
    </Surface>
  </Swipeable>;
}

const s = StyleSheet.create({
  surface: { backgroundColor: sys.color.ground },
  panel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.lg, borderRadius: sys.radius.card },
  accept: { backgroundColor: sys.color.green, justifyContent: 'flex-start' },
  decline: { backgroundColor: sys.color.danger, justifyContent: 'flex-end' },
  onDark: { color: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  money: { color: sys.color.money },
  message: { marginTop: sys.space.sm, padding: sys.space.md, borderRadius: sys.radius.control, backgroundColor: sys.color.wash },
  confirm: { marginTop: sys.space.md, gap: sys.space.sm },
  confirmRow: { flexDirection: 'row', gap: sys.space.sm, justifyContent: 'flex-end' },
  hintRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: sys.space.sm },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingHorizontal: 4 },
});
