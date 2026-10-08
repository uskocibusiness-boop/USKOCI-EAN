import { useCallback, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import { workerAvailabilityClientService } from '../../../data/workerAvailabilityClientService';
import { ownProfileClientService } from '../../../data/ownProfileClientService';
import { useSesija } from '../../../store/sesija';
import { AvailabilityForm } from '../../../ui/calendar/AvailabilityForm';
import { CalendarScreen } from '../../../ui/calendar/CalendarControls';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';
import { StateView } from '../../../ui/system/StateView';
import { sys } from '../../../ui/system/tokens';

const back = () => router.canGoBack() ? router.back() : router.replace('/profil');
/** What the availability read says when there is no saved work profile (WORKER_PROFILE_REQUIRED). */
const PROFILE_REQUIRED = 'Najpre sačuvaj svoj radni profil.';
const s = StyleSheet.create({ pad: { paddingHorizontal: sys.space.lg } });
/** Whether leaving drops something the person could still keep: unsaved changes, with no write running or unconfirmed. */
const asks = (state: { dirty: boolean; busy: boolean; uncertain: boolean }) => state.dirty && !state.busy && !state.uncertain;
function OwnedAvailability() {
  const editor = useOwnedEditor(useCallback(() => workerAvailabilityClientService.read(), []));
  // "Dostupan sada" is the loudest thing on this screen and it can be on while the work profile is
  // still a draft, which is when nothing is offered to you at all. Two screens saying opposite
  // things about the same person. This read is for that one sentence: if it does not arrive, the
  // screen says nothing rather than guessing either way.
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const profile = useFocusedResource(useCallback(() => ownProfileClientService.read(accountId ?? '', 'uskocer'),
    [accountId, accountRevision]));
  const profileDraft = profile.data?.stanje === 'DRAFT';
  // A refresh keeps the loaded week on screen under the pull spinner instead of swapping the whole form for a
  // loading card; only the first read, with nothing yet to show, is a loading screen.
  const refreshing = editor.loading && !!editor.data;
  // Unsaved changes are asked about before they are dropped (critique A17): Back used to throw every edit away. While a
  // save runs there is nothing to ask; the editor settles the write whether the screen stays or not. After a save whose
  // outcome was not confirmed there is nothing to ask either: the changes may already be saved, so "they will not be
  // saved" would be untrue, and the next visit reads the saved state (review of owner step 10).
  const [dirty, setDirty] = useState(false);
  const confirm = useConfirmSheet();
  const leave = () => {
    if (asks({ dirty, busy: editor.busy, uncertain: editor.uncertain })) confirm.ask({ title: 'Odbaciti izmene?',
      message: 'Unete izmene neće biti sačuvane.', confirmLabel: 'Odbaci izmene', cancelLabel: 'Nastavi uređivanje', tone: 'danger', onConfirm: back });
    else back();
  };
  // The (app) navigator is Tabs with a history back behaviour, so a screen being removed is never announced there: the
  // hardware Back is heard directly while this screen has focus. An open sheet's own Modal takes Back before this does.
  const latest = useRef({ dirty, busy: editor.busy, uncertain: editor.uncertain, leave });
  latest.current = { dirty, busy: editor.busy, uncertain: editor.uncertain, leave };
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!asks(latest.current)) return false;
      latest.current.leave();
      return true;
    });
    return () => subscription.remove();
  }, []));
  return <CalendarScreen title="Dostupnost za rad" back={leave} loading={editor.loading && !editor.data} scroll={false}>
    {editor.data ? <AvailabilityForm key={`${editor.data.accountId}:${editor.data.revision}`} availability={editor.data}
      profileDraft={profileDraft} busy={editor.busy} uncertain={editor.uncertain} problem={editor.error} saved={editor.saved}
      onDirtyChange={setDirty} onReconcile={() => void editor.refresh()}
      // Pull to refresh replaced a standing "Osveži dostupnost" button under the form (plan step 0, 2026-09-23); it calls
      // the same read.
      refreshing={refreshing} onRefresh={() => { if (!editor.busy) void editor.refresh(); }} onSave={value => editor.save(async () => {
        const result = await workerAvailabilityClientService.save({ expectedRevision: editor.data!.revision, value });
        return result.ok ? { ok: true, podatak: result.podatak.availability } : result;
      })} />
      : editor.error ? <View style={s.pad}>
        {/* Without a saved work profile there is no availability to read, and reading again cannot help: the one action
            leads to the work profile (review of owner step 10). It is a precondition, not a failure, so it is not drawn as
            an error and does not say the read failed (round-5c); its title is the whole message. */}
        {editor.error === PROFILE_REQUIRED
          ? <StateView kind="empty" art="clock" title={PROFILE_REQUIRED} primary={{ label: 'Dopuni radni profil', onPress: () => router.navigate('/profil/radnik') }} />
          : <StateView kind="error" art="clock" title="Dostupnost nije učitana." body={editor.error}
            primary={{ label: 'Pokušaj ponovo', onPress: () => void editor.refresh(), disabled: editor.loading }} />}
      </View> : null}
    {confirm.sheet}
  </CalendarScreen>;
}
/** When a person can work is theirs to set whenever they like; it used to be reachable in one mode only. */
export default function Dostupnost() {
  return <OwnedAvailability />;
}
