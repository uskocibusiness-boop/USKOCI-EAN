import { useCallback, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { INBOX_SET_LABEL } from '../../../ui/notifications/inboxCopy';
import { PushPreferences } from '../../../ui/notifications/PushPreferences';
import { useSesija, sesijaSada } from '../../../store/sesija';
import { T } from '../../../ui/Text';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';
import { DetailTopBar } from '../../../ui/system/DetailTopBar';
import { Segmented } from '../../../ui/system/Segmented';
import { sys } from '../../../ui/system/tokens';
// The two sets carry the names the inbox gives its two filters ("Zadaci", "Moje prijave"): one name, one set, everywhere.
const SETS = [{ key: 'REQUESTER', label: INBOX_SET_LABEL.REQUESTER }, { key: 'WORKER', label: INBOX_SET_LABEL.WORKER }] as const;
type SetKey = typeof SETS[number]['key'];
type ActionScope = { accountId: string; revision: number; leaving: boolean };
const CAPTION: Record<SetKey, string> = {
 REQUESTER: 'Obaveštenja o zadacima koje objavljuješ.',
 WORKER: 'Novi zadaci, tvoje prijave i Dogovori.',
};
const WAIT_FOR_WRITE = 'Sačekaj da se čuvanje završi.';
export default function PushSettings() {
 const { user, accountRevision } = useSesija(); const accountId = user?.id;
 // The server keeps two sets of notification settings for one account: one for the tasks it
 // publishes and one for the work it applies to. Which set this screen edits used to follow the
 // mode the whole app was in; it is now chosen here, on the screen that edits it.
 // The inbox filtered to one set opens this screen on that set (`skup`); Profil names none, and anything else is ignored.
 const { skup } = useLocalSearchParams<{ skup?: string }>();
 const asked: SetKey | null = skup === 'REQUESTER' || skup === 'WORKER' ? skup : null;
 const [role, setRole] = useState<SetKey>(asked ?? 'REQUESTER');
 // This screen stays mounted between visits, so the named set is taken on every focus. Nothing unsaved is lost by it:
 // every focus starts the settings again from what was saved.
 useFocusEffect(useCallback(() => { if (asked) setRole(asked); }, [asked]));
 // Unsaved changes of the shown set. Switching the set or going back used to throw them away without a word.
 const [dirty, setDirty] = useState(false);
 // A save, or the phone switched on or off, is running for the shown set: the set stays until its outcome is read back.
 const [writing, setWriting] = useState(false);
 const confirm = useConfirmSheet();
 const owner = useRef<ActionScope | null>(null);
 const [renderedOwner, setRenderedOwner] = useState<ActionScope | null>(null);
 const view = useMemo(() => ({ role, dirty, writing }), [role, dirty, writing]);
 const latestView = useRef(view); latestView.current = view;
 const closeConfirm = confirm.close;
 useFocusEffect(useCallback(() => {
  const scope = accountId ? { accountId, revision: accountRevision, leaving: false } : null; owner.current = scope;
  setRenderedOwner(scope);
  // A question left open when the screen loses focus is retired, never answered later.
  return () => { if (owner.current === scope) owner.current = null; closeConfirm(); };
 }, [accountId, accountRevision, closeConfirm]));
 function current() {
  return renderedOwner !== null && !renderedOwner.leaving && owner.current === renderedOwner && latestView.current === view
   && renderedOwner.accountId === accountId && renderedOwner.revision === accountRevision
   && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
 }
 function back() {
  if (!current() || !renderedOwner) return;
  // Native blur may follow another press: this visit dispatches its exit only once.
  renderedOwner.leaving = true;
  if (router.canGoBack()) router.back(); else router.replace('/profil');
 }
 /** Asks before unsaved changes are thrown away; the step itself runs its own checks when it is confirmed. */
 function discardThen(proceed: () => void) {
  if (!current()) return;
  if (!dirty) { proceed(); return; }
  // "Odustani" could be read as giving up the changes; the way out of this question keeps them (as on Dostupnost).
  confirm.ask({ title: 'Odbaciti izmene?', message: 'Izmene kategorija i tihih sati nisu sačuvane.', confirmLabel: 'Odbaci izmene',
   cancelLabel: 'Nastavi uređivanje', tone: 'danger', onConfirm: () => { if (current()) proceed(); } });
 }
 const requestBack = () => discardThen(back);
 const requestRole = (next: SetKey) => {
  if (!current() || next === role) return;
  // A finger cannot reach the tabs while a write runs (they wait under `pointerEvents`), but a screen reader's double tap
  // still does; it used to do nothing without a word. `Segmented` has no disabled state to draw yet.
  if (writing) { AccessibilityInfo.announceForAccessibility(WAIT_FOR_WRITE); return; }
  discardThen(() => { setDirty(false); setWriting(false); setRole(next); });
 };
 // Android's own Back asks the same question while something is unsaved; with nothing unsaved it leaves as always.
 const latestBack = useRef({ dirty, requestBack }); latestBack.current = { dirty, requestBack };
 useFocusEffect(useCallback(() => {
  const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
   if (!latestBack.current.dirty) return false;
   latestBack.current.requestBack(); return true;
  });
  return () => subscription?.remove();
 }, []));
 return <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
  <Stack.Screen options={{ headerShown: false }} />
  {/* The arrow says only "Nazad": this screen is opened from Profil and from the gear in Obaveštenja, so naming one of
      them would be wrong for the other. */}
  <DetailTopBar title="Podešavanja obaveštenja" onBack={requestBack} />
  {/* While a write of the shown set runs, its tabs wait with every other control (the Save spinner says why). */}
  <View style={s.sets} pointerEvents={writing ? 'none' : 'auto'}>
   <Segmented appearance="underline" options={SETS} value={role} onChange={requestRole} />
   <T variant="note" tone="muted">{CAPTION[role]}</T>
  </View>
  <PushPreferences key={role} role={role} onDirtyChange={setDirty} onWritingChange={setWriting} />
  {confirm.sheet}
 </SafeAreaView>;
}
const s = StyleSheet.create({
 screen: { flex: 1, backgroundColor: sys.color.ground },
 sets: { paddingHorizontal: 20, paddingTop: 4, gap: 8 },
});
