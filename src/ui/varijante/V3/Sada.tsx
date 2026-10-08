import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { KandidatProjekcija, PotrebaProjekcija } from '../../../contracts/projections';
import { APPLICATION_PROMISE } from '../../../data/ownTaskStanding';
import { HoldToTalkController } from '../../../features/voice/holdToTalk';
import { AiConversationShell, type ConversationMessage } from '../../aiFirst/AiConversationShell';
import type { VoiceInput } from '../../aiFirst/VoiceComposer';
import { PublishedMoment } from '../../objava/PublishedMoment';
import { sys } from '../../system/tokens';
import { ApplicationComposerPresentation, type ApplicationDraft } from '../../v2/ApplicationComposerPresentation';
import { CandidateListPresentation, CandidateSelectionPresentation } from '../../v2/ApplicationSelectionPresentation';
import type { Summary } from '../../v2/draftSummary';
import { DraftCard, TASK_OPENINGS } from '../../v2/IntakePresentation';
import { nazadNaSpisak } from './pomocno';
import { PROFIL, ZADATAK, prilika } from './podaci';

/**
 * „Sada“: današnji proizvodni ekrani sa istim lažnim podacima kao varijante, da vlasnik vidi „pre“ pored „posle“. Samo uvoz postojećih
 * prezentacionih komponenti; ništa ne čita i ne piše. Sve komande su prazne ili vode nazad na spisak scena laboratorije.
 */
const noop = () => undefined;

export function KandidatiSada({ need, candidates }: { need: PotrebaProjekcija; candidates: KandidatProjekcija[] }) {
  return <CandidateListPresentation need={need} candidates={candidates} open={noop} back={nazadNaSpisak} refresh={noop} openTask={noop} />;
}

/** Današnji trenutak: ponuda u panelu, dole „Dogovor je sklopljen.“ sa kvačicom i zeleno dugme. */
export function DogovorenoSada({ need, candidate, candidates }: { need: PotrebaProjekcija; candidate: KandidatProjekcija; candidates: KandidatProjekcija[] }) {
  return <View style={s.ekran}>
    <View style={s.ekran}><KandidatiSada need={need} candidates={candidates} /></View>
    <CandidateSelectionPresentation need={need} candidate={candidate} back={nazadNaSpisak} publicProfile={async () => PROFIL} choose={noop} busy={false}
      pending uncertain={false} refresh={noop} error={null} confirmed openAgreement={nazadNaSpisak}
      readAgreement={async () => ({ ok: true, podatak: { dogovorId: 'var-dogovor' } })} openLinkedAgreement={noop} />
  </View>;
}

/** Mikrofon bez govornog adaptera: može da se pritisne i nikad ne krene (kao u `dizajn-ai`). */
function useNemiGlas(): VoiceInput {
  const controller = useMemo(() => new HoldToTalkController({ adapter: null, getScope: () => null, onTranscript: () => false,
    limits: { permissionMs: 1000, captureMs: 1000, finalizationMs: 1000 } }), []);
  return { controller, state: { phase: 'IDLE', session: null, finalText: '', interimText: '', audioLevel: null, fallbackText: '', error: null }, disabled: false, onKeepText: () => false };
}

export function RazgovorSada({ messages = [], card }: { messages?: readonly ConversationMessage[]; card?: { summary: Summary; stillNeeded: string | null } }) {
  const [value, setValue] = useState('');
  const voice = useNemiGlas();
  return <AiConversationShell conversationKey="var-v3-sada" title="Novi zadatak" welcome="Reci šta ti treba."
    welcomeDetail="Opiši zadatak svojim rečima. Pre objave sve pregledaš." openings={TASK_OPENINGS} placeholder="Opiši šta ti treba"
    card={compact => card ? <DraftCard summary={card.summary} stillNeeded={card.stillNeeded} open busy={false} compact={compact} canReview onReview={noop} note={null} /> : null}
    messages={messages} value={value} onChange={setValue} canEdit canSend={value.trim().length > 0} pending={false} busy={false} onSend={() => setValue('')}
    onBack={nazadNaSpisak} onOptions={messages.length ? noop : undefined} voice={voice} />;
}

export function ObjavljenoSada() {
  // Trenutak sam nastavlja posle 1,5 s; u laboratoriji nastavak ne vodi nikud, da slika ostane.
  return <PublishedMoment title="Zadatak je objavljen." line={APPLICATION_PROMISE.published} onContinue={noop} />;
}

export function PrijavaSada({ need, draft }: { need: PotrebaProjekcija; draft: ApplicationDraft }) {
  const [value, setValue] = useState(draft);
  return <ApplicationComposerPresentation need={need} opportunity={prilika(need)} draft={value} change={setValue} submit={noop} back={nazadNaSpisak}
    busy={false} pending={false} uncertain={false} refresh={noop} error={null} confirmed openApplications={nazadNaSpisak} canSubmit blocked={null} />;
}

export { ZADATAK };
const s = StyleSheet.create({ ekran: { flex: 1, backgroundColor: sys.color.surface } });
