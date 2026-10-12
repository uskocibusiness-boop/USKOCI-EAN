import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { T } from '../../../ui/Text';
import { DetailTopBar } from '../../../ui/system/DetailTopBar';
import { V2Action } from '../../../ui/v2/V2Action';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';
import { brandAction, sys } from '../../../ui/system/tokens';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { canonicalWorkerExecutionModes, workerExecutionModeClientService,
  type WorkerExecutionMode, type WorkerExecutionModeReceipt } from '../../../data/workerExecutionModeClientService';

const MODES: { id: WorkerExecutionMode; title: string; detail: string; symbol: string }[] = [
  { id: 'ON_SITE', title: 'Na lokaciji', detail: 'Dolazim na mesto zadatka ili obavljam prevoz i rad na terenu.', symbol: '⌖' },
  { id: 'REMOTE', title: 'Na daljinu', detail: 'Zadatke mogu da završim online, bez fizičkog dolaska.', symbol: '▣' },
];
function bounded<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('WORKER_MODE_TIMEOUT')), ms); })])
    .finally(() => { if (timer !== undefined) clearTimeout(timer); });
}

export default function WorkerModeScreen() {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id ?? '';
  const confirm = useConfirmSheet();
  const [reading, setReading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<WorkerExecutionModeReceipt | null>(null);
  const [choice, setChoice] = useState<WorkerExecutionMode[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  const owns = () => !!accountId && sesijaSada().user?.id === accountId
    && sesijaSada().accountRevision === accountRevision;
  const dirty = !!receipt && choice.join(',') !== receipt.modes.join(',');

  const load = useCallback(async () => {
    const token = ++generation.current;
    setReading(true); setProblem(null); setSaved(false);
    try {
      const result = await bounded(workerExecutionModeClientService.read(accountId, accountRevision));
      if (!mounted.current || token !== generation.current || !owns()) return;
      setReceipt(result); setChoice(result.modes); setProblem(null);
    } catch (error) {
      if (!mounted.current || token !== generation.current || !owns()) return;
      setReceipt(null);
      setProblem(error instanceof Error && error.message === 'WORKER_PROFILE_REQUIRED'
        ? 'Najpre sačuvaj radni profil.' : 'Nismo uspeli da učitamo sačuvan izbor. Proveri vezu.');
    } finally {
      if (mounted.current && token === generation.current && owns()) setReading(false);
    }
  }, [accountId, accountRevision]);

  useFocusEffect(useCallback(() => {
    mounted.current = true; void load();
    return () => { mounted.current = false; generation.current++; confirm.close(); };
  }, [load, confirm.close]));

  const back = () => {
    if (saving) { setProblem('Proveri ishod čuvanja pre izlaska.'); return; }
    if (!owns()) return;
    const leave = () => router.canGoBack() ? router.back() : router.replace('/profil/radnik');
    if (!dirty) leave();
    else confirm.ask({ title: 'Odbaciti izbor?', message: 'Izmene načina rada još nisu sačuvane.',
      confirmLabel: 'Odbaci izmene', cancelLabel: 'Nastavi uređivanje', tone: 'danger', onConfirm: leave });
  };
  const latest = useRef({ back, dirty, saving });
  latest.current = { back, dirty, saving };
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!latest.current.dirty && !latest.current.saving) return false;
      latest.current.back(); return true;
    });
    return () => sub.remove();
  }, []));

  const toggle = (mode: WorkerExecutionMode) => {
    if (saving || reading || !receipt || !owns()) return;
    const next = canonicalWorkerExecutionModes(choice.includes(mode) ? choice.filter(x => x !== mode) : [...choice, mode]);
    if (!next.length) { setProblem('Izaberi najmanje jedan način rada.'); return; }
    setChoice(next); setProblem(null); setSaved(false);
  };
  const save = async () => {
    if (!owns() || saving || !dirty || !choice.length || !receipt) return;
    setSaving(true); setSaved(false); setProblem(null);
    const token = generation.current;
    try {
      const readback = await bounded(workerExecutionModeClientService.save(accountId, accountRevision, choice));
      if (!mounted.current || token !== generation.current || !owns()) return;
      setReceipt(readback); setChoice(readback.modes); setSaved(true);
    } catch {
      if (!mounted.current || token !== generation.current || !owns()) return;
      setProblem('Ishod čuvanja nije potvrđen. Proveri sačuvano stanje pre ponovnog pokušaja.');
    } finally {
      if (mounted.current && token === generation.current && owns()) setSaving(false);
    }
  };

  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <Stack.Screen options={{ headerShown: false }} />
    <DetailTopBar title="Način rada" onBack={back} />
    <ScrollView contentContainerStyle={styles.body}>
      <T variant="title" accessibilityRole="header">Gde želiš da uskačeš?</T>
      <T variant="body" tone="muted">Možeš da izabereš jedan ili oba načina. Izbor važi za tebe, a konkretne usluge potvrđuješ zasebno.</T>
      {reading ? <View style={styles.loading}><ActivityIndicator color={sys.color.green} /><T tone="muted" variant="note">Čitamo sačuvan izbor…</T></View> :
       !receipt ? <View style={styles.loading}>
         <T variant="body" tone="muted">{problem ?? 'Radni profil nije dostupan.'}</T>
         <V2Action label="Pokušaj ponovo" tone="neutral" onPress={() => { void load(); }} />
         <V2Action label="Radni profil" kind="quiet" tone="neutral" onPress={() => router.navigate('/profil/radnik')} />
       </View> : <>
         <View style={styles.group}>
           {MODES.map(item => {
             const selected = choice.includes(item.id);
             return <Pressable key={item.id} testID={'worker-mode-' + item.id}
               accessibilityRole="checkbox" accessibilityState={{ checked: selected }}
               accessibilityLabel={item.title} accessibilityHint={item.detail}
               disabled={saving} onPress={() => toggle(item.id)}
               style={[styles.option, selected && styles.selected]}>
               <View style={[styles.mark, selected && styles.markSelected]}>
                 <T variant="bodyStrong" style={{ color: selected ? sys.color.onGreen : sys.color.muted }}>{selected ? '✓' : item.symbol}</T>
               </View>
               <View style={styles.description}>
                 <T variant="bodyStrong">{item.title}</T>
                 <T variant="note" tone="muted">{item.detail}</T>
               </View>
             </Pressable>;
           })}
         </View>
         <T variant="note" tone="muted">Ovaj izbor sam po sebi ne potvrđuje veštine i ne aktivira obaveštenja. Pravilno povezivanje sa novim zadacima uvodimo nakon dodatnih provera.</T>
         {saved ? <T variant="bodyStrong" style={styles.success}>Izbor je sačuvan i potvrđen na serveru.</T> : null}
         {problem ? <T variant="note" style={styles.problem}>{problem}</T> : null}
       </>}
    </ScrollView>
    {receipt ? <View style={styles.footer}>
      {problem?.startsWith('Ishod čuvanja') ? <V2Action label="Proveri sačuvano stanje" tone="neutral" onPress={() => { if (!saving) void load(); }} /> : null}
      <V2Action label={saving ? 'Čuvamo izbor…' : 'Sačuvaj način rada'} kind="primary" style={brandAction}
        disabled={!dirty || saving || reading} loading={saving} onPress={() => { void save(); }} />
    </View> : null}
    {confirm.sheet}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  body: { padding: sys.space.lg, gap: sys.space.md, paddingBottom: sys.space.xl },
  group: { gap: sys.space.sm, marginTop: sys.space.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, borderWidth: 1,
    borderColor: sys.color.lineStrong, borderRadius: 16, padding: sys.space.md, minHeight: 92, backgroundColor: sys.color.surface },
  selected: { borderColor: sys.color.green, borderWidth: 2 },
  mark: { height: 34, width: 34, borderRadius: 17, backgroundColor: sys.color.iconWell, justifyContent: 'center', alignItems: 'center' },
  markSelected: { backgroundColor: sys.color.green },
  description: { flex: 1, gap: 4 },
  loading: { paddingVertical: sys.space.xl, gap: sys.space.md, alignItems: 'center' },
  footer: { paddingHorizontal: sys.space.lg, paddingVertical: sys.space.sm, borderTopWidth: 1, borderColor: sys.color.line, gap: sys.space.sm },
  success: { color: sys.color.green },
  problem: { color: sys.color.danger },
});