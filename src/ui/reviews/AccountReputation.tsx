import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { accountReputationLabel, reviewsClientService, type AccountReputation as Reputation } from '../../data/reviewsClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';

/**
 * Only a real aggregate is drawn: anything without a numeric count (a read that is not this one) draws nothing, and a
 * count of reviews without a numeric average draws nothing either, because its label would read "undefined · 3 ocene".
 */
const isReputation = (value: unknown): value is Reputation => {
  if (!value || typeof value !== 'object') return false;
  const { reviewCount, averageRating } = value as { reviewCount?: unknown; averageRating?: unknown };
  return typeof reviewCount === 'number' && (reviewCount === 0 || (typeof averageRating === 'number' && Number.isFinite(averageRating)));
};

/**
 * One account reputation in both intents; an unavailable read is not zero reviews.
 *
 * T4a, 2026-10-07: the line is a way in. With `onOpen` it is a row that opens "Ocene" (the ratings the person received and gave);
 * the written comments of D12 live there too, no longer under the rating on the profile. Without `onOpen` it is the line alone.
 */
export function AccountReputation({ accountId, onOpen, centered = false }: {
  accountId: string;
  /** Center only the rating summary in an identity passport. */
  centered?: boolean;
  /** Opens the ratings. Absent: the line is only a line. */
  onOpen?: () => void;
}) {
  const load = useCallback(async () => {
    const result = await reviewsClientService.reputation(accountId);
    if (!result.ok) throw new Error('REPUTATION_NOT_AVAILABLE');
    return result.podatak;
  }, [accountId]);
  const reputation = useFocusedResource(load);
  return <View style={centered ? s.centered : undefined}><ReputationLine state={reputation.loading ? 'loading' : reputation.error ? 'error' : reputation.data}
    onRetry={() => { void reputation.refresh(); }} onOpen={onOpen} /></View>;
}

/**
 * The reputation as one line under the name in the profile's identity column (2026-09-24). While it reads: a still bar where
 * the line will be (no spinner, nothing moves). With reviews: the star and "4,8 · 12 ocena". With none: "Još nema ocena" and
 * no star. When the read fails: one 48 dp row that says so and offers "Osveži" in the same line, instead of a full-width button
 * under the name. Anything else draws nothing, never "undefined". With `onOpen` a line that has an answer (ratings or none) is
 * a 48 dp button that says where it goes ("Otvara ocene.") and ends in the quiet arrow every row onward ends in.
 */
export function ReputationLine({ state, onRetry, onOpen }: { state: 'loading' | 'error' | unknown; onRetry: () => void; onOpen?: () => void }) {
  if (state === 'loading') return <View accessibilityRole="progressbar" accessibilityLabel="Učitavanje reputacije" style={s.bar} />;
  if (state === 'error') return <Press accessibilityRole="button" accessibilityLabel="Osveži ocene" accessibilityHint="Ocene trenutno nisu dostupne."
    haptic="select" scaleTo={0.99} onPress={onRetry} style={s.retry}>
    <T variant="note" tone="muted" style={s.shrink}>Ocene trenutno nisu dostupne.</T>
    <T variant="note" style={s.action}>Osveži</T>
  </Press>;
  if (!isReputation(state)) return null;
  const none = state.reviewCount === 0, label = accountReputationLabel(state);
  const words = none ? <T variant="note" tone="muted">{label}</T>
    : <View style={s.line}><FactArt kind="star" size={18} /><T variant="note" style={s.value}>{label}</T></View>;
  if (!onOpen) return words;
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Otvara ocene." haptic="select"
    scaleTo={sys.motion.scale.row} onPress={onOpen} style={s.open}>
    {words}
    <Glyph name="caret-right" size={16} tone="muted" />
  </Press>;
}

const s = StyleSheet.create({
  centered: { alignItems: 'center', maxWidth: '100%' },
  bar: { width: 112, height: 16, borderRadius: sys.radius.control, backgroundColor: sys.color.skeleton, marginVertical: 2 },
  retry: { minHeight: 48, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, alignSelf: 'flex-start' },
  // No alignSelf: in the identity passport the wrapper centres it, elsewhere it starts at the edge like the words it replaces.
  open: { minHeight: 48, flexDirection: 'row', alignItems: 'center', columnGap: sys.space.xs },
  shrink: { flexShrink: 1 },
  action: { color: sys.color.green, fontWeight: '600' },
  line: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  value: { color: sys.color.ink, fontWeight: '600' },
});
