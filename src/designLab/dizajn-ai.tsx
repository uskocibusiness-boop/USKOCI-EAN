import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import type { AiNeedMessage, AiNeedV2Conversation, AiNeedV2Fact } from '../contracts/aiNeedV2';
import { NEED_FACT_V2_DEFINITIONS, type NeedFactV2Key } from '../contracts/needFactsV2';
import { HoldToTalkController, type VoiceSnapshot } from '../features/voice/holdToTalk';
import type { WorkerAiProfile } from '../data/workerAiClientService';
import { DraftCard, IntakePresentation, IntakeUnavailable, type Summary } from '../ui/v2/IntakePresentation';
import { AiConversationShell } from '../ui/aiFirst/AiConversationShell';
import { VoiceMode, type VoiceInput } from '../ui/aiFirst/VoiceComposer';
import { WorkerAiCard } from '../ui/workerProfile/WorkerAiPresentation';
import { ScreenChrome } from '../ui/system/ScreenChrome';
import { UNCERTAIN_ABOUT } from '../ui/system/outcomeCopy';
import { T } from '../ui/Text';
import { aiDownLine } from '../ui/aiFirst/aiDownLine';
import { layout } from '../ui/system/layout';
import { ListRow } from '../ui/system/ListRow';
import { LARGE_LAYOUT, LayoutClassOverride } from '../ui/system/textScale';
import { sys } from '../ui/system/tokens';

/**
 * The AI conversation gallery (owner step 6, 2026-09-24): the real presentation of `/nova` and `/profil/razgovor` — the
 * shell, the live draft card, the floating composer, the voice notice and voice mode — in their main states, for the
 * emulator photographs. Reached only by its address (uskociapp://dizajn-ai) in the internal build; the store package shows
 * nothing. Every state is fixture props: nothing here reads or writes data, no conversation is opened, and the
 * microphone is an inert controller that never starts (it has no scope and no speech adapter). No fixture carries a map
 * place, so the point editor (which reads the server) is never mounted; the draft cards with a place are drawn directly.
 */
const ID = 'dizajn-ai-0000';
const noop = () => undefined;
const fact = (key: NeedFactV2Key, value: unknown): AiNeedV2Fact => ({ id: key, key, value, displayValue: String(value),
  valueType: NEED_FACT_V2_DEFINITIONS[key].valueType, privacyClass: 'PUBLIC', requiredForDraft: NEED_FACT_V2_DEFINITIONS[key].requiredForDraft,
  status: 'CONFIRMED', source: 'EXPLICIT_USER_ANSWER', evidence: null });
const said = (id: string, fromAi: boolean, body: string): AiNeedMessage => ({ id, fromAi, body, safety: null, proposedFactIds: [] });
const conversation = (patch: Partial<AiNeedV2Conversation> = {}, missing: NeedFactV2Key[] = []): AiNeedV2Conversation => ({
  conversationId: ID, schemaVersion: 'NEED_FACT_V2', status: 'OPEN', messages: [], facts: [], safety: 'ALLOW',
  review: { conversationId: ID, schemaVersion: 'NEED_FACT_V2', boundNeedId: null, canSaveDraft: false, missingRequired: missing, facts: [] },
  ...patch });
const snapshot = (patch: Partial<VoiceSnapshot> = {}): VoiceSnapshot => ({ phase: 'IDLE', session: null, finalText: '', interimText: '',
  audioLevel: null, fallbackText: '', error: null, ...patch });
const HOLD = { accountId: 'dizajn', accountRevision: 0, conversationId: ID, generation: 1, gestureId: 'dizajn', startedAt: 0, mode: 'hold' as const };

const THREAD = [said('u1', false, 'Treba mi pomoć da prenesem orman i nekoliko kutija sa trećeg sprata, zgrada nema lift.'),
  said('a1', true, 'Razumem — orman i kutije, treći sprat bez lifta. Kada bi to trebalo da se uradi, i koliko bi ljudi bilo dovoljno?'),
  said('u2', false, 'Sutra posle podne. Mislim da su dovoljna dvojica.'),
  said('a2', true, 'Beležim: sutra posle podne, dve osobe. Da li imaš cenu na umu, ili da tražiš ponude?')];
const FACTS = [fact('need.title', 'Prenos ormana i kutija sa trećeg sprata'), fact('need.people_needed', 2),
  fact('need.schedule_kind', 'TOMORROW_FLEXIBLE'), fact('need.price_mode', 'MY_PRICE'), fact('need.price_rsd', 5000), fact('need.price_basis', 'TOTAL')];
/** The conversation that changes a published task ("Izmena zadatka"): the thread ends with the server's own fixed closing sentence, which the screen says as what it means here. */
const EDIT_THREAD = [said('e1', false, 'Pomeri na petak posle podne i dodaj da treba još jedna osoba.'),
  said('e2', true, 'Beležim: petak posle podne, dve osobe. Cenu ostavljam kakva je.'),
  said('e3', true, 'Otvori pregled zadatka. Tamo možeš da dopuniš podatke i potvrdiš objavu.')];
const EDIT_FACTS = [fact('need.title', 'Montaža police u hodniku'), fact('need.people_needed', 2), fact('need.schedule_kind', 'WEEK_FLEXIBLE'),
  fact('need.price_mode', 'MY_PRICE'), fact('need.price_rsd', 3000), fact('need.price_basis', 'TOTAL'),
  fact('need.task_geography', { mode: 'STATIONARY', start: { city: 'Beograd', area: 'Vračar' } })];
const editing = (patch: Partial<AiNeedV2Conversation> = {}): AiNeedV2Conversation => {
  const base = conversation({ messages: EDIT_THREAD, facts: EDIT_FACTS, ...patch }); base.review.boundNeedId = 'dizajn-zadatak'; return base;
};
const LONG = 'Selidba kompletnog dvosobnog stana sa klavirom, dve garderobe i radnim stolom iz Novog Sada u Sremsku Kamenicu';

// Review r4 ra items 4, 6, 8 and 9: no category is ever named as missing, a fixed window is written the app's one way in
// Serbian time, the safety note stays on the compact card, and a task being changed says "Izmena".
const DRAFTS: { title: string; summary: Summary; still: string | null; busy?: boolean; compact?: boolean; note?: string; editing?: boolean; ended?: boolean }[] = [
  { title: 'Nacrt sa mestom i cenom', still: 'Opis', summary: { title: 'Prenos ormana i kutija sa trećeg sprata', zone: 'Novi Sad · Liman',
    schedule: 'Sutra', value: { kind: 'amount', amount: '5.000 RSD', basis: 'ukupno' }, people: '2 osobe' } },
  { title: 'Traži ponude, sve uneto', still: null, summary: { title: 'Montaža police u hodniku', zone: 'Beograd · Vračar',
    schedule: '26. sep · 17:00–19:00 (po vremenu u Srbiji)', value: { kind: 'offers' }, people: '1 osoba' } },
  { title: 'Dopunjuje se', still: 'Cena · Ljudi · tačka na mapi', busy: true, summary: { title: 'Čišćenje dvorišta', zone: 'Novi Sad · Detelinara',
    value: null, people: null } },
  { title: 'Zbijeno (tastatura)', still: 'Naslov · Opis · Cena · i još 4', compact: true, summary: { title: null, zone: '', value: null, people: null } },
  { title: 'Dugi naslov', still: 'Opis', summary: { title: LONG, zone: 'Novi Sad · Grbavica → Sremska Kamenica', schedule: 'Ove nedelje',
    value: { kind: 'amount', amount: '18.000 RSD', basis: 'po osobi' }, people: '4 osobe' } },
  { title: 'Provera pre objave', still: null, note: 'Zahtev traži dodatnu proveru pre objavljivanja. Nacrt možeš pregledati i sačuvati.',
    summary: { title: 'Prevoz stvari do vikendice', zone: 'Na daljinu', value: { kind: 'offers' }, people: '2 osobe' } },
  { title: 'Provera pre objave, zbijeno', still: null, compact: true, note: 'Zahtev traži dodatnu proveru pre objavljivanja. Nacrt možeš pregledati i sačuvati.',
    summary: { title: 'Prevoz stvari do vikendice', zone: 'Na daljinu', value: { kind: 'offers' }, people: '2 osobe' } },
  { title: 'Izmena objavljenog zadatka', still: null, editing: true, summary: { title: 'Montaža police u hodniku', zone: 'Beograd · Vračar',
    schedule: 'Ove nedelje', value: { kind: 'amount', amount: '3.000 RSD', basis: 'ukupno' }, people: '1 osoba' } },
  // How many people is said only when it is more than one, in words ("Treba 3 osobe"), never as "0/3".
  { title: 'Treba troje, tražim ponude', still: 'Opis', summary: { title: 'Pomoć oko selidbe', zone: 'Novi Sad · Novo naselje', schedule: '14. okt · 09:00–13:00',
    value: { kind: 'offers' }, people: '3 osobe', peopleCount: 3 } },
  { title: 'Razgovor je završen: činjenice kao redovi, bez dugmeta', still: null, ended: true, summary: { title: 'Montaža police u hodniku', zone: 'Beograd · Vračar',
    schedule: 'Ove nedelje', value: { kind: 'amount', amount: '3.000 RSD', basis: 'ukupno' }, people: '2 osobe', peopleCount: 2 } },
];

const PROFILE: WorkerAiProfile = { displayName: 'Marko', bio: '', skills: ['Selidbe', 'Montaža nameštaja'], tools: ['Bušilica'], vehicles: ['Kombi'],
  licenses: [], teamCapacity: 2, location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 15, approximatePosition: null },
  availability: { timezone: 'Europe/Belgrade', availableNow: true, rules: [], windows: [] } };

export default function DizajnAi() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const [open, setOpen] = useState<string | null>(null);
  const [value, setValue] = useState('');
  // An inert controller: no scope and no speech adapter, so the microphone can be pressed and never starts.
  const controller = useMemo(() => new HoldToTalkController({ adapter: null, getScope: () => null, onTranscript: () => false,
    limits: { permissionMs: 1000, captureMs: 1000, finalizationMs: 1000 } }), []);
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  const back = () => { setOpen(null); setValue(''); };
  const voice = (state: VoiceSnapshot = snapshot(), disabled = false): VoiceInput => ({ controller, state, disabled, onKeepText: () => false });
  const intake = (patch: Partial<Parameters<typeof IntakePresentation>[0]>) => <IntakePresentation conversation={conversation()} value={value}
    busy={false} error={null} canSubmit={!!value.trim()} canEdit canReview={false} reviewLabel="Pregledaj zadatak" pending={false}
    statusCopy={null} showReadback={false} readbackDisabled={false} showAbandon={false} abandonDisabled={false} abandonLabel="Napusti razgovor"
    onBack={back} onChange={setValue} onSend={noop} onReview={noop} onRefresh={noop} onAbandon={noop} voice={voice()} {...patch} />;
  const running = conversation({ messages: THREAD, facts: FACTS }, ['need.description', 'need.category', 'need.task_geography']);
  const STATES: { key: string; title: string; render: () => ReactNode }[] = [
    { key: 'welcome', title: 'Novi zadatak · početak', render: () => intake({ conversation: conversation({ conversationId: '' }) }) },
    { key: 'welcome-large', title: 'Novi zadatak · početak, veliki tekst', render: () => <LayoutClassOverride.Provider value={LARGE_LAYOUT}>
      {intake({ conversation: conversation({ conversationId: '' }) })}</LayoutClassOverride.Provider> },
    { key: 'worker-welcome', title: 'Radni profil · početak', render: () => <AiConversationShell conversationKey="gallery-worker-welcome"
      title="Tvoj radni profil" welcome="Šta umeš da radiš?" welcomeDetail="Reci šta umeš i kakvu opremu imaš. Svoj profil pregledaš pre čuvanja."
      openings={['Radim popravke i montažu', 'Imam vozilo za prevoz', 'Mogu da pomognem oko']} openingArts={['tool', 'vehicle', 'users']}
      placeholder="Opiši šta radiš" card={() => null}
      messages={[]} value={value} onChange={setValue} canEdit canSend={!!value.trim()} pending={false} busy={false} onSend={noop}
      onBack={back} voice={voice()} /> },
    { key: 'thread', title: 'Novi zadatak · razgovor bez prerane kartice', render: () => intake({ conversation: running, canReview: true, showAbandon: true,
      onPhotos: noop }) },
    { key: 'ready', title: 'Spremno za pregled (traži ponude)', render: () => intake({ canReview: true, showAbandon: true, onPhotos: noop,
      conversation: conversation({ messages: [said('ready-user', false, 'Treba mi prevod kratkog uputstva na engleski, do kraja nedelje. Može na daljinu, tražim ponude.'),
        said('ready-assistant', true, 'Sve je tu. Pregledaj zadatak, pa ga objavi kad ti odgovara.')], facts: [fact('need.title', 'Prevod kratkog uputstva na engleski'), fact('need.description', 'Prevod uputstva na engleski.'), fact('need.category', 'Prevod'), fact('need.task_country_code', 'RS'), fact('need.price_mode', 'OFFERS'),
        fact('need.people_needed', 1), fact('need.schedule_kind', 'WEEK_FLEXIBLE'), fact('need.task_geography', { mode: 'REMOTE' })] }) }) },
    { key: 'ready-large', title: 'Spremno za pregled, veliki tekst', render: () => <LayoutClassOverride.Provider value={LARGE_LAYOUT}>
      {intake({ canReview: true, showAbandon: true, onPhotos: noop, conversation: conversation({ messages: [said('rl-user', false, 'Treba mi prevod kratkog uputstva na engleski, do kraja nedelje.'),
        said('rl-assistant', true, 'Sve je tu. Pregledaj zadatak, pa ga objavi kad ti odgovara.')], facts: [fact('need.title', 'Prevod kratkog uputstva na engleski'), fact('need.description', 'Prevod uputstva na engleski.'), fact('need.category', 'Prevod'), fact('need.task_country_code', 'RS'),
        fact('need.price_mode', 'OFFERS'), fact('need.people_needed', 1), fact('need.schedule_kind', 'WEEK_FLEXIBLE'), fact('need.task_geography', { mode: 'REMOTE' })] }) })}
    </LayoutClassOverride.Provider> },
    { key: 'ai-down', title: 'AI nedostupan, nacrt sačuvan', render: () => intake({ conversation: running, canReview: true, onPhotos: noop,
      error: aiDownLine('AI trenutno nije dostupan.', true) }) },
    { key: 'pending', title: 'Čeka odgovor (slanje nije moguće, razlog)', render: () => intake({ conversation: running, pending: true, busy: true,
      value: 'Moja cena je 5.000 ukupno.', canEdit: false, canSubmit: false, sentMessage: 'Moja cena je 5.000 ukupno.', voice: voice(snapshot(), true) }) },
    { key: 'stream', title: 'Stiže odgovor (stvaran tekst)', render: () => intake({ conversation: running, busy: true, pending: true, canEdit: false,
      sentMessage: 'Moja cena je 5.000 ukupno.', streamingText: 'Odlično, 5.000 RSD ukupno za dve osobe. Još mi treba', voice: voice(snapshot(), true) }) },
    { key: 'error', title: 'Poruka možda nije stigla', render: () => intake({ conversation: running, pending: true, canEdit: false, value: 'Sutra posle podne.',
      // A send that may not have arrived is said once: the status line and the one button (the data layer's own sentence is not drawn).
      error: null, statusCopy: `${UNCERTAIN_ABOUT.message.title}.`, showReadback: true,
      onCancelPending: noop, voice: voice(snapshot(), true) }) },
    { key: 'long', title: 'Dugi nazivi i poruke', render: () => intake({ conversation: conversation({ facts: [fact('need.title', LONG), fact('need.people_needed', 14),
      fact('need.price_mode', 'MY_PRICE'), fact('need.price_rsd', 1250000), fact('need.price_basis', 'PER_PERSON')],
      messages: [said('u', false, `${LONG}. Imam i veliku vitrinu sa staklom koja mora posebno da se upakuje i prenese vrlo pažljivo.`),
        said('a', true, 'Razumem: kompletna selidba sa klavirom, garderobama i vitrinom sa staklom. Za klavir obično treba četiri osobe i posebni kaiševi. Da li je klavir uspravni ili klavir sa repom, i na kom je spratu?')] },
      ['need.description', 'need.category', 'need.task_geography', 'need.schedule_kind']), canReview: true }) },
    { key: 'listen', title: 'Mikrofon sluša (drži, nivo glasa)', render: () => intake({ conversation: running,
      voice: voice(snapshot({ phase: 'LISTENING', session: HOLD, audioLevel: 0.6, finalText: 'Moja cena je', interimText: 'pet hiljada ukupno' })) }) },
    { key: 'denied', title: 'Mikrofon nije dozvoljen', render: () => intake({ conversation: running, voice: voice(snapshot({ error: 'MIC_PERMISSION_DENIED' })) }) },
    { key: 'kept', title: 'Govor prekinut, sačuvan tekst', render: () => intake({ conversation: running,
      voice: voice(snapshot({ error: 'CAPTURE_FAILED', fallbackText: 'Moja cena je pet hiljada' })) }) },
    // A conversation that is over takes no more words (the owner's phone, 8 Oct 2026): no field and no microphone, and where they stood is the one green action.
    { key: 'done', title: 'Završen razgovor (bez polja, jedno zeleno dugme)', render: () => intake({ conversation: conversation({ status: 'COMPLETED', messages: THREAD, facts: FACTS }),
      canReview: true, canEdit: false, voice: undefined, statusCopy: 'Razgovor je završen. Sačuvani zadatak možeš otvoriti iz pregleda.', onNewTask: noop }) },
    { key: 'done-large', title: 'Završen razgovor, veliki tekst', render: () => <LayoutClassOverride.Provider value={LARGE_LAYOUT}>
      {intake({ conversation: conversation({ status: 'COMPLETED', messages: THREAD, facts: FACTS }), canReview: true, canEdit: false, voice: undefined,
        statusCopy: 'Razgovor je završen. Sačuvani zadatak možeš otvoriti iz pregleda.', onNewTask: noop })}</LayoutClassOverride.Provider> },
    { key: 'abandoned', title: 'Napušten razgovor (bez polja, novi zadatak na ekranu)', render: () => intake({ conversation: conversation({ status: 'ABANDONED', messages: THREAD, facts: FACTS }),
      canReview: true, canEdit: false, voice: undefined, statusCopy: 'Razgovor je napušten.', onNewTask: noop }) },
    // The conversation about a task that is already published: the title says "Izmena zadatka", the review is "Pregledaj izmene", and the server's closing
    // sentence ("Otvori pregled zadatka. Tamo možeš da dopuniš podatke i potvrdiš objavu.") is said as what it means here, since a change is not a publication.
    { key: 'edit-thread', title: 'Izmena zadatka · razgovor', render: () => intake({ conversation: editing(), canReview: true, reviewLabel: 'Pregledaj izmene', onPhotos: noop }) },
    { key: 'edit-done', title: 'Izmena zadatka · razgovor je završen', render: () => intake({ conversation: editing({ status: 'COMPLETED' }), canReview: true,
      reviewLabel: 'Pregledaj izmene', canEdit: false, voice: undefined, statusCopy: 'Razgovor je završen. Sačuvani zadatak možeš otvoriti iz pregleda.', onNewTask: noop }) },
    { key: 'edit-done-large', title: 'Izmena zadatka · završeno, veliki tekst', render: () => <LayoutClassOverride.Provider value={LARGE_LAYOUT}>
      {intake({ conversation: editing({ status: 'COMPLETED' }), canReview: true, reviewLabel: 'Pregledaj izmene', canEdit: false, voice: undefined,
        statusCopy: 'Razgovor je završen. Sačuvani zadatak možeš otvoriti iz pregleda.', onNewTask: noop })}</LayoutClassOverride.Provider> },
    { key: 'block', title: 'Zaustavljen zahtev (bezbednost)', render: () => intake({ conversation: conversation({ safety: 'BLOCK', messages: THREAD.slice(0, 1) }),
      canEdit: false, voice: undefined, showAbandon: true }) },
    { key: 'voice-idle', title: 'Glasovni režim · početak', render: () => <VoiceMode voice={voice()} prompt="Reci šta ti treba." answer={null} said={null}
      thinking={false} onClose={back} /> },
    { key: 'voice-listen', title: 'Glasovni režim · sluša', render: () => <VoiceMode voice={voice(snapshot({ phase: 'LISTENING', session: HOLD, audioLevel: 0.7,
      finalText: 'Treba mi pomoć oko selidbe', interimText: 'sutra posle podne' }))} prompt="Reci šta ti treba." answer="Razumem — orman i kutije, treći sprat bez lifta. Kada bi to trebalo da se uradi?"
      said={null} thinking={false} onClose={back} /> },
    { key: 'voice-thinking', title: 'Glasovni režim · stiže odgovor', render: () => <VoiceMode voice={voice(snapshot(), true)} prompt="Reci šta ti treba."
      answer={null} said="Sutra posle podne, dvojica su dovoljna." thinking onClose={back} /> },
    { key: 'voice-answer', title: 'Glasovni režim · odgovor', render: () => <VoiceMode voice={voice()} prompt="Reci šta ti treba."
      answer="Beležim: sutra posle podne, dve osobe. Da li imaš cenu na umu, ili da tražiš ponude?" said="Sutra posle podne, dvojica su dovoljna."
      thinking={false} onClose={back} /> },
    { key: 'voice-error', title: 'Glasovni režim · greška', render: () => <VoiceMode voice={voice(snapshot({ error: 'CAPTURE_FAILED', fallbackText: 'Treba mi' }))}
      prompt="Reci šta ti treba." answer={null} said={null} thinking={false} onClose={back} /> },
    { key: 'worker', title: 'Radni profil kroz razgovor', render: () => <AiConversationShell title="Tvoj radni profil" welcome="Šta umeš da radiš?"
      welcomeDetail="Reci šta umeš i kakvu opremu imaš. Svoj profil pregledaš pre čuvanja." placeholder="Opiši šta radiš"
      card={compact => <WorkerAiCard profile={PROFILE} compact={compact} disabled={false} review={noop} />}
      messages={[{ id: 'w1', fromAi: false, body: 'Radim selidbe i montažu nameštaja, imam kombi i bušilicu.' },
        { id: 'w2', fromAi: true, body: 'Odlično. U kom gradu radiš i koliko daleko možeš da ideš?' }]}
      value={value} onChange={setValue} canEdit canSend={!!value.trim()} pending={false} busy={false} onSend={noop} onBack={back} onOptions={noop}
      voice={voice()} /> },
    { key: 'loading', title: 'Otvara se', render: () => <IntakeUnavailable loading error="" back={back} /> },
    { key: 'unavailable', title: 'Nedostupan razgovor', render: () => <IntakeUnavailable loading={false}
      error="Razgovor trenutno nije dostupan. Proveri vezu i učitaj ga ponovo." retry={noop} back={back} /> },
  ];
  const shown = STATES.find(state => state.key === open);
  if (shown) return <View style={s.screen}>{shown.render()}</View>;
  if (open === 'cards') return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ScreenChrome variant="detail" onBack={back} title="Živa kartica nacrta" />
    <ScrollView contentContainerStyle={s.content}>
      {DRAFTS.map(draft => <View key={draft.title} style={s.sample}>
        <T variant="meta" tone="muted">{draft.title}</T>
        <DraftCard summary={draft.summary} stillNeeded={draft.still} open={!draft.ended} busy={!!draft.busy} compact={!!draft.compact}
          canReview={!draft.busy} onReview={noop} note={draft.note ?? null} editing={!!draft.editing} ended={!!draft.ended}
          reviewAtEnd={!draft.still && !draft.busy && !draft.ended}
          reviewLabel={draft.editing ? 'Pregledaj izmene' : 'Pregledaj zadatak'} />
      </View>)}
    </ScrollView>
  </SafeAreaView>;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ScreenChrome variant="detail" onBack={() => router.back()} title="AI razgovor · galerija" />
    <ScrollView contentContainerStyle={s.content}>
      <T variant="note" tone="muted" style={s.note}>Veliki tekst: font_scale 1.3 u sistemu. Širine: wm density 540 / 480 / 443 / 402.</T>
      <View>
        {[{ key: 'cards', title: 'Živa kartica nacrta · sva stanja' }, ...STATES].map((state, index, all) => <ListRow key={state.key} title={state.title}
          accessibilityLabel={state.title} last={index === all.length - 1} onPress={() => setOpen(state.key)} />)}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  content: { paddingHorizontal: layout.gutter, paddingBottom: sys.space.huge, gap: sys.space.sm },
  note: { paddingBottom: sys.space.sm },
  sample: { gap: sys.space.sm, paddingVertical: sys.space.md },
});
