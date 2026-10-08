import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { workTrustClientService, type MyWorkStats } from '../../data/workTrustClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { T } from '../Text';
import { KeyValueRow } from '../system/KeyValueRow';
import { Section } from '../system/Section';
import { sys } from '../system/tokens';
import { statsView } from './workTrustModel';

/** What "Moja statistika" holds: it is still reading, it could not be read, or it is read (`MyWorkStats` of the server). */
export type ProfileStatsState = { kind: 'loading' } | { kind: 'error'; onRetry: () => void } | { kind: 'ready'; stats: MyWorkStats };

/**
 * "Moja statistika" (PROFILE-TRUST, R30; composition spec 4.14): the person's own work funnel in the order it happens - applications
 * sent, agreed, finished - then how reliably they come as agreed and since when they are here, as `KeyValueRow`s of one section, with
 * one quiet line that says what the percentage is made of (or what it waits for). Only for an account that has a work profile: without
 * one there is no work to count and the section is not there at all. Every figure is the server's; nothing is computed or filled in
 * here, and a percentage that does not exist yet says so instead of being drawn as 0.
 *
 * Presentation only; `ProfileStats` below reads it.
 */
export function ProfileStatsSection({ state }: { state: ProfileStatsState }) {
  if (state.kind === 'loading') return <Section title="Moja statistika" testID="profile-stats">
    <T variant="note" tone="muted" accessibilityRole="progressbar" accessibilityLabel="Učitavanje statistike">Učitavamo statistiku…</T>
  </Section>;
  if (state.kind === 'error') return <Section title="Moja statistika" testID="profile-stats"
    action={{ label: 'Pokušaj ponovo', accessibilityLabel: 'Pokušaj ponovo: Moja statistika', onPress: state.onRetry }}>
    <T variant="note" tone="muted" accessibilityRole="alert">Statistika trenutno nije dostupna.</T>
  </Section>;
  const view = statsView(state.stats);
  if (!view) return null;
  return <Section title="Moja statistika" testID="profile-stats">
    {view.rows.map((row, index) => <KeyValueRow key={row.key} label={row.label} value={row.value} last={index === view.rows.length - 1} />)}
    <T variant="note" tone="muted" style={s.note}>{view.note}</T>
  </Section>;
}

/** Reads the person's own statistics. The route draws it only when the account has a work profile. */
export function ProfileStats() {
  const load = useCallback(async (): Promise<MyWorkStats> => {
    const result = await workTrustClientService.myStats();
    if (!result.ok) throw new Error(result.kod);
    return result.podatak;
  }, []);
  const stats = useFocusedResource(load);
  const state: ProfileStatsState = stats.loading ? { kind: 'loading' }
    : stats.error || !stats.data ? { kind: 'error', onRetry: () => { void stats.refresh(); } } : { kind: 'ready', stats: stats.data };
  return <ProfileStatsSection state={state} />;
}

const s = StyleSheet.create({
  note: { paddingTop: sys.space.sm },
});
