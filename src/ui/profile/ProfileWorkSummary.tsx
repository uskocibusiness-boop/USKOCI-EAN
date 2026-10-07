import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { publicProfileClientService } from '../../data/publicProfileClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { sys } from '../system/tokens';
import { useLayoutClass } from '../system/textScale';

type Role = 'narucilac' | 'uskocer';
type Fact = { role: Role; count: number | null };
const roleWords = (role: Role) => role === 'uskocer' ? 'Kad ti radiš' : 'Kad ti objavljuješ';

/** Existing public projection counts COMPLETED Agreements per role, never tasks or payments.
 * Reads are independent of identity/reputation and fenced by useFocusedResource's account/revision/focus owner.
 *
 * T4a, 2026-10-07: with `onOpen` the sentence is a way in. The whole summary (the title and both counts) is one button that opens
 * the Dogovori, because the numbers mean "these are your finished Dogovori" and the person should be able to go and look at them.
 */
export function ProfileWorkSummary({ requesterProfileId, workerProfileId, onOpen }: {
  requesterProfileId: string | null; workerProfileId: string | null;
  /** Opens the finished Dogovori. Absent: the summary is only a summary. */ onOpen?: () => void;
}) {
  const { stacked } = useLayoutClass();
  const load = useCallback(async (signal: AbortSignal): Promise<Fact[]> => {
    const targets: { id: string; role: Role }[] = [];
    if (workerProfileId) targets.push({ id: workerProfileId, role: 'uskocer' });
    if (requesterProfileId && requesterProfileId !== workerProfileId) targets.push({ id: requesterProfileId, role: 'narucilac' });
    return Promise.all(targets.map(async ({ id, role }) => {
      try {
        const profile = await publicProfileClientService.javniProfil(id, signal);
        const count = profile?.poverenje?.zavrseniBroj;
        return { role, count: profile?.profilId === id && profile.uloga === role &&
          typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null };
      } catch { return { role, count: null }; }
    }));
  }, [requesterProfileId, workerProfileId]);
  const resource = useFocusedResource(load);
  if (!requesterProfileId && !workerProfileId) return null;
  const unavailable = resource.error || resource.data?.some(fact => fact.count === null);
  const heading = <View style={s.heading}>
    <FactArt kind="check" size={24} cut="art" />
    <T variant="bodyStrong" accessibilityRole="header" style={s.title}>Završeni Dogovori</T>
    {onOpen && !resource.loading ? <Glyph name="caret-right" size={20} tone="muted" /> : null}
  </View>;
  const facts = resource.loading ? <T variant="note" tone="muted" accessibilityRole="progressbar"
    accessibilityLabel="Učitavanje završenih Dogovora">Učitavamo pregled…</T>
    : <View style={[s.facts, stacked && s.stacked]}>
      {resource.data?.map(fact => <View key={fact.role} style={[s.fact, stacked && s.factStacked]} accessible
        accessibilityLabel={`${roleWords(fact.role)}, završeni Dogovori: ${fact.count === null ? 'broj nije dostupan' : fact.count}`}>
        <T variant="note" tone="muted" style={stacked ? s.roleStacked : undefined}>{roleWords(fact.role)}</T>
        <T variant={fact.count === null ? 'note' : 'heading'} tone={fact.count === null ? 'muted' : 'ink'}
          style={stacked ? s.valueStacked : undefined}>
          {fact.count === null ? 'Broj nije dostupan' : fact.count.toLocaleString('sr-Latn-RS')}
        </T>
      </View>)}
    </View>;
  // One button for the title and both counts, spoken as one sentence ("Završeni Dogovori. Kad ti radiš: 4. …"). The refresh of
  // a count that could not be read stays outside it: a button inside a button cannot be reached.
  const spoken = ['Završeni Dogovori', ...(resource.data ?? []).map(fact => `${roleWords(fact.role)}: ${fact.count === null ? 'broj nije dostupan' : fact.count}`)].join('. ');
  return <View testID="profile-work-summary" style={s.section}>
    {onOpen && !resource.loading ? <Press accessibilityRole="button" accessibilityLabel={spoken} accessibilityHint="Otvara Dogovore." haptic="select"
      scaleTo={sys.motion.scale.row} onPress={onOpen} style={s.body}>{heading}{facts}</Press>
      : <View style={s.body}>{heading}{facts}</View>}
    {!resource.loading && unavailable ? <Press accessibilityRole="button" accessibilityLabel="Osveži pregled završenih Dogovora"
      onPress={() => { void resource.refresh(); }} haptic="select" style={s.retry}>
      <T variant="note" style={s.retryText}>Osveži pregled</T>
    </Press> : null}
  </View>;
}

const s = StyleSheet.create({
  section: { gap: 14, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  // The title and the counts are one block, whether it is a button or not, so they keep the gap they always had.
  body: { gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: sys.color.ink },
  facts: { flexDirection: 'row', gap: 20 },
  stacked: { flexDirection: 'column', gap: 12 },
  fact: { flexGrow: 1, flexBasis: 0, minWidth: 0, gap: 4 },
  factStacked: { flexGrow: 0, flexBasis: 'auto', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 16, rowGap: 4 },
  roleStacked: { flexGrow: 1, minWidth: 0, maxWidth: '100%' },
  valueStacked: { maxWidth: '100%', flexShrink: 1 },
  retry: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { color: sys.color.ink, fontWeight: '600' },
});
