import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, View } from 'react-native';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { Section } from '../system/Section';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';

/**
 * The existing quiet Home explanation also owns short, contextual explanations (owner, 2026-11-08).
 * No automatic tour or overlay. The same bundled words remain readable from Settings → Kako radi, even offline.
 * These are device presentation preferences, without account data or any business/notification effect.
 * "Razumem" acknowledges this content version; "Ne prikazuj ponovo" also suppresses future versions.
 * A failed device write still holds for this app run. No successful-storage claim is displayed.
 */
/** Preserve the permanent choice made by older APKs; read only for the Home explanation. */
export const HOW_IT_WORKS_KEY = 'uskoci.home.how-it-works-hidden.v1';
export const HOW_IT_WORKS_TOPICS = ['home', 'tasks', 'forMe', 'agreements', 'messages', 'workerProfile'] as const;
export type HowItWorksTopic = typeof HOW_IT_WORKS_TOPICS[number];
export const HOW_IT_WORKS_GUIDES: Readonly<Record<HowItWorksTopic, { version: number; title: string; body: string }>> = {
  home: { version: 2, title: 'Kako radi', body: 'Izaberite „Objavi zadatak“ kada Vam treba pomoć ili „Uskoči i zaradi“ kada želite da pružite uslugu. Isti nalog koristite za obe mogućnosti.' },
  tasks: { version: 1, title: 'Zadaci', body: 'Ovde su dostupni zadaci. Koristite listu, mapu i filtere da pronađete ono što Vam odgovara.' },
  forMe: { version: 1, title: 'Zadaci za Vas', body: 'U prikazu „Za Vas“ su zadaci koji odgovaraju Vašem aktivnom radnom profilu. Pre prijave proverite cenu, termin i uslove zadatka.' },
  agreements: { version: 1, title: 'Dogovori', body: 'Kada autor prihvati prijavu, nastaje Dogovor. U njemu proveravate uslove i termin, razgovarate i potvrđujete završetak saradnje.' },
  messages: { version: 1, title: 'Poruke', body: 'Ovde su razgovori o Vašim saradnjama. Novi razgovor otvarate iz Dogovora, gde su i uslovi saradnje.' },
  workerProfile: { version: 1, title: 'Radni profil', body: 'Ovde kažete šta zaista možete da radite, uživo ili na daljinu, i kada ste dostupni. Pregledajte podatke pre aktivacije.' },
};

/** The key versions the receipt format; changing guide copy does not erase a permanent suppression. */
export const howItWorksReceiptKey = (topic: HowItWorksTopic) => `uskoci.how-it-works.v1.${topic}`;
type Receipt = { seenVersion: number; suppressed: boolean };

function readReceipt(value: string | null): Receipt | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const receipt = parsed as Partial<Receipt>;
    return typeof receipt.seenVersion === 'number' && Number.isSafeInteger(receipt.seenVersion)
      && receipt.seenVersion > 0 && typeof receipt.suppressed === 'boolean'
      ? { seenVersion: receipt.seenVersion, suppressed: receipt.suppressed } : null;
  } catch { return null; }
}

/** A newer acknowledged version also hides an older APK's copy; a revised guide may reappear only without suppression. */
export function howItWorksReceiptHides(value: string | null, version: number): boolean {
  const receipt = readReceipt(value);
  return !!receipt && (receipt.suppressed || receipt.seenVersion >= version);
}

/** The steps, in the order of a task's life. The words are the proposal's own; the pictures are the app's own fact pictures. */
export const HOW_IT_WORKS_STEPS: readonly { art: FactArtKind; title: string; note: string }[] = [
  { art: 'publish', title: 'Objavite ili pronađite', note: 'Zadatak' },
  { art: 'agreements', title: 'Dogovorite se', note: 'Prijava i poruke' },
  { art: 'star', title: 'Ocenite', note: 'Posle završetka' },
];

/** After a slow device read, omit this optional row for the visit rather than flash a previously hidden guide. */
const READ_MS = 500;

/** Small, account-free local choices. Mounted occurrences of the same topic observe one choice immediately. */
const choicesThisRun = new Map<HowItWorksTopic, Receipt>();
const readKnowledgeThisRun = new Map<HowItWorksTopic, 'shown' | 'hidden'>();
const choiceListeners = new Map<HowItWorksTopic, Set<() => void>>();
function remember(topic: HowItWorksTopic, receipt: Receipt) {
  choicesThisRun.set(topic, receipt);
  readKnowledgeThisRun.set(topic, 'hidden');
  choiceListeners.get(topic)?.forEach(listener => listener());
}

/** Exposed for the tests: a fresh run of the app. */
export function forgetHiddenHowItWorks() { choicesThisRun.clear(); readKnowledgeThisRun.clear(); }

type Knowledge = 'unknown' | 'shown' | 'hidden';

/** Device storage cannot block the screen. A topic change cannot flash the previous topic's visible state. */
export function useHowItWorks(topic: HowItWorksTopic = 'home') {
  const [known, setKnown] = useState<{ topic: HowItWorksTopic; state: Knowledge }>(() => ({ topic, state: readKnowledgeThisRun.get(topic) ?? 'unknown' }));
  useEffect(() => {
    let alive = true, settled = false, quietThisVisit = false;
    const hideLocally = () => { if (alive) setKnown({ topic, state: 'hidden' }); };
    const listeners = choiceListeners.get(topic) ?? new Set<() => void>();
    listeners.add(hideLocally); choiceListeners.set(topic, listeners);
    const cached = readKnowledgeThisRun.get(topic);
    if (cached) { setKnown({ topic, state: cached }); return () => { alive = false; listeners.delete(hideLocally); }; }
    setKnown({ topic, state: 'unknown' });
    const settle = (hidden: boolean) => {
      // A late read can prepare the next visit, but cannot pop a guide into a screen after its read deadline.
      if (!alive) return;
      readKnowledgeThisRun.set(topic,
        choicesThisRun.has(topic) || hidden || readKnowledgeThisRun.get(topic) === 'hidden' ? 'hidden' : 'shown');
      if (quietThisVisit || (settled && !hidden)) return;
      settled = true;
      setKnown({ topic, state: choicesThisRun.has(topic) || hidden ? 'hidden' : 'shown' });
    };
    const omitThisVisit = () => {
      if (!alive) return;
      quietThisVisit = true; settled = true;
      setKnown({ topic, state: 'hidden' });
    };
    const timer = setTimeout(() => { if (!settled) omitThisVisit(); }, READ_MS);
    // Independently handle the legacy Home read: even a failed/slow new-format read cannot erase its prior suppression.
    let remaining = topic === 'home' ? 2 : 1, readFailed = false;
    const finishRead = (hidden: boolean, failed = false) => {
      remaining -= 1; readFailed ||= failed;
      if (hidden) settle(true);
      else if (remaining === 0) { if (readFailed) omitThisVisit(); else settle(false); }
    };
    const read = (key: string, decode: (value: string | null) => boolean) => {
      try { Promise.resolve(AsyncStorage.getItem(key)).then(value => finishRead(decode(value)), () => finishRead(false, true)); }
      catch { finishRead(false, true); }
    };
    read(howItWorksReceiptKey(topic), value => howItWorksReceiptHides(value, HOW_IT_WORKS_GUIDES[topic].version));
    if (topic === 'home') read(HOW_IT_WORKS_KEY, value => value === '1');
    return () => { alive = false; listeners.delete(hideLocally); clearTimeout(timer); };
  }, [topic]);
  const choose = useCallback((suppressed: boolean) => {
    // The disappearing controls can still deliver two taps in one native frame. The first explicit choice wins.
    if (choicesThisRun.has(topic)) return;
    const receipt = { seenVersion: HOW_IT_WORKS_GUIDES[topic].version, suppressed };
    remember(topic, receipt);
    try { Promise.resolve(AsyncStorage.setItem(howItWorksReceiptKey(topic), JSON.stringify(receipt))).catch(() => undefined); }
    catch { /* Best effort device preference; it still holds in memory for this app run. */ }
  }, [topic]);
  const acknowledge = useCallback(() => choose(false), [choose]);
  const hide = useCallback(() => choose(true), [choose]);
  return { visible: known.topic === topic && known.state === 'shown' && !choicesThisRun.has(topic), acknowledge, hide };
}

/** One compact inline explanation, never a modal or a requirement before continuing. */
export function HowItWorks({ stacked = false, topic = 'home' }: { stacked?: boolean; topic?: HowItWorksTopic }) {
  const { visible, acknowledge, hide } = useHowItWorks(topic);
  if (!visible) return null;
  return <View style={s.inline}>
    <Section testID={topic === 'home' ? 'how-it-works' : `how-it-works-${topic}`} title={HOW_IT_WORKS_GUIDES[topic].title}>
      <HowItWorksContent topic={topic} stacked={stacked} />
      <View style={s.actions}>
        <Press accessibilityRole="button" accessibilityLabel="Razumem" accessibilityHint="Pamti da ste pročitali ovo uputstvo."
          onPress={acknowledge} haptic="select" style={s.action}><T variant="note" tone="green" style={s.actionText}>Razumem</T></Press>
        <Press accessibilityRole="button" accessibilityLabel="Ne prikazuj ponovo"
          accessibilityHint="Isključuje automatski prikaz ovog uputstva. Ostaje dostupno u Podešavanjima, Kako radi."
          onPress={hide} haptic="select" style={s.action}><T variant="note" tone="muted">Ne prikazuj ponovo</T></Press>
      </View>
    </Section>
  </View>;
}

function HowItWorksContent({ topic, stacked }: { topic: HowItWorksTopic; stacked: boolean }) {
  return <View style={s.content}>
    <T variant="note" tone="muted">{HOW_IT_WORKS_GUIDES[topic].body}</T>
    {topic === 'home' ? <View accessible accessibilityLabel={HOW_IT_WORKS_STEPS.map((step, index) => `${index + 1}. ${step.title}, ${step.note}`).join('. ') + '.'}
      style={[s.steps, stacked && s.stepsStacked]}>
      {HOW_IT_WORKS_STEPS.map(step => <View key={step.title} style={[s.step, stacked && s.stepStacked]}>
        <FactArt kind={step.art} size={32} />
        <View style={[s.words, stacked && s.wordsStacked]}>
          <T variant="note" style={[s.stepTitle, !stacked && s.centred]}>{step.title}</T>
          <T variant="meta" tone="muted" style={stacked ? undefined : s.centred}>{step.note}</T>
        </View>
      </View>)}
    </View> : null}
  </View>;
}

/** Manual reading never consults or clears a dismissal receipt and needs no network access. */
export function HowItWorksReference() {
  return <View style={s.reference}>
    <T variant="body">USKOČI povezuje ljude za svakodnevne zadatke. Jedan nalog i jedna reputacija važe i kada tražite i kada pružate pomoć.</T>
    <T variant="note" tone="muted">Ova uputstva možete pročitati i kada ste isključili njihov automatski prikaz.</T>
    {HOW_IT_WORKS_TOPICS.map(topic => <Section key={topic} title={HOW_IT_WORKS_GUIDES[topic].title}>
      <View style={s.content}>
        <HowItWorksContent topic={topic} stacked />
        {topic === 'home' ? <>
          <T variant="note">Kada Vam treba pomoć, opišite zadatak, pregledajte ono što je AI razumeo i potvrdite objavu.</T>
          <T variant="note">Kada želite da pomognete, aktivirajte radni profil, otvorite odgovarajući zadatak i pošaljite prijavu sa svojim uslovima.</T>
        </> : null}
      </View>
    </Section>)}
  </View>;
}

const s = StyleSheet.create({
  inline: { marginVertical: sys.space.sm },
  content: { gap: sys.space.md },
  reference: { gap: sys.space.xl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: sys.space.base },
  action: { minHeight: 48, minWidth: 48, paddingVertical: sys.space.md, justifyContent: 'center', flexShrink: 1 },
  actionText: { fontWeight: '600' },
  steps: { flexDirection: 'row', gap: sys.space.base },
  stepsStacked: { flexDirection: 'column', gap: sys.space.md },
  step: { flex: 1, alignItems: 'center', gap: sys.space.sm },
  stepStacked: { flex: 0, flexDirection: 'row', gap: sys.space.md, minHeight: 48 },
  words: { alignItems: 'center', gap: sys.space.xs },
  wordsStacked: { alignItems: 'flex-start', flexShrink: 1 },
  stepTitle: { color: sys.color.ink, fontWeight: '600' },
  centred: { textAlign: 'center' },
});
