import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { needLocationClientService } from '../../data/locationClientService';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { NeedLocationForm } from '../../ui/location/NeedLocationForm';
import { LocationScreen } from '../../ui/location/LocationControls';
import { StateView } from '../../ui/system/StateView';
import { layout } from '../../ui/system/layout';
import { SuccessMark } from '../../ui/system/SuccessMark';
import { Surface } from '../../ui/system/Surface';
import { sys } from '../../ui/system/tokens';
import { T } from '../../ui/Text';
import { V2Action as Button } from '../../ui/v2/V2Action';
import { createProductionLocationResolver } from '../../data/productionLocationResolver';
import { uuid } from '../../data/serverReceipt';

export default function MestoZadatka() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const id = typeof params.conversationId === 'string' ? params.conversationId : '';
  // An address without a valid conversation cannot be read; it says so instead of offering a retry that never works.
  const valid = uuid(id);
  const read = useCallback(() => valid ? needLocationClientService.read(id)
    : Promise.resolve({ ok: false as const, kod: 'LOCATION_ROUTE_INVALID', poruka: 'Otvori mesto iz pregleda zadatka.' }), [id, valid]);
  const editor = useOwnedEditor(read);
  const resolver = useMemo(() => createProductionLocationResolver(), [id, editor.data?.accountId, editor.data?.revision]);
  // A direct/deep entry must return to the current complete review, never the
  // retired per-fact draft review. A real back stack is still preserved.
  const back = () => router.canGoBack() ? router.back() : router.replace({ pathname: '/pregled-zadatka', params: { conversationId: id } });
  const retry = () => { void editor.refresh(); };
  // A failed first read is the app's one error state; a failed save keeps the form and says so above it.
  const unread = !editor.data && !editor.loading && !!editor.error;
  return <LocationScreen title="Mesto zadatka" onBack={back} loading={editor.loading} error={unread ? null : editor.error} onRetry={retry} uncertain={editor.uncertain}
    scroll={unread}>
    {unread ? <StateView kind="error" art="pin" title={valid ? 'Mesto nije učitano' : 'Mesto nije dostupno'} body={editor.error ?? undefined}
      primary={valid ? { label: 'Pokušaj ponovo', onPress: retry } : undefined} /> : null}
    {/* Saved: a white way back; the form's own save stays the screen's one green action for a new change. */}
    {editor.saved ? <View style={s.savedFrame}><Surface kind="note" style={s.saved}>
      <View style={s.savedRow}><SuccessMark fresh size={32} />
        <T accessibilityRole="alert" variant="body" style={s.grow}>Mesto je sačuvano u pregledu zadatka.</T></View>
      <Button label="Nazad na pregled" kind="secondary" onPress={back} />
    </Surface></View> : null}
    {editor.data ? <NeedLocationForm key={editor.data.revision} layout="screen" review={editor.data} busy={editor.busy} uncertain={editor.uncertain}
      resolver={resolver}
      onSave={value => { const review = editor.data; if (!review) return;
        void editor.save(async () => { const result = await needLocationClientService.save({ conversationId: id,
          expectedRevision: review.revision, confirmed: true, value });
        return result.ok ? { ok: true, podatak: result.podatak.review } : result; });
      }} /> : null}
  </LocationScreen>;
}

const s = StyleSheet.create({
  // The confirmation is a note of the system, on the form's own edge.
  savedFrame: { paddingHorizontal: layout.gutter, paddingTop: sys.space.md },
  saved: { gap: sys.space.md },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  grow: { flex: 1 },
});
