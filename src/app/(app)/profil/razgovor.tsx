import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { workerAiClientService as api, WORKER_AI_READ_TRANSPORT_UNAVAILABLE, type WorkerAiPatch, type WorkerAiSnapshot, type WorkerAiTurnRecovery } from '../../../data/workerAiClientService';
import { workerAiTurnIntentJournal as journal, type WorkerAiTurnIntent } from '../../../data/workerAiTurnIntentJournal';
import type { Ishod } from '../../../data/ports';
import { uuid } from '../../../data/serverReceipt';
import { rememberAiCorrection, takeAiCorrection, type AiCorrectionIntent } from '../../../data/aiCorrectionIntent';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { inferWorkerExecutionModes, workerExecutionModeClientService } from '../../../data/workerExecutionModeClientService';

import { useHoldToTalk } from '../../../features/voice/useHoldToTalk';
import { AiConversationShell } from '../../../ui/aiFirst/AiConversationShell';
import { workerInterviewOpening } from '../../../ui/aiFirst/aiInterviewWelcome';
import { useAccountName } from '../../../ui/profile/useAccountName';
import { ActionSheet } from '../../../ui/system/ActionSheet';
import { brandAction, sys } from '../../../ui/system/tokens';
import { WorkerProfileFrame, WorkerProfileStatus } from '../../../ui/workerProfile/WorkerProfilePresentation';
import { WorkerAiActivation, WorkerAiNotificationsNote, WorkerAiReviewDetails } from '../../../ui/workerProfile/WorkerAiPresentation';
import { WORKER_PART_TITLE, type WorkerAiPart } from '../../../ui/workerProfile/workerProfileFacts';
import { T } from '../../../ui/Text';
import { V2Action } from '../../../ui/v2/V2Action';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';

type Panel='chat'|'review';
type ReviewActivity='preparing'|'saving'|null;
type SubmittedDraft={value:string;revision:number};
type Attempt={id:string;text:string|null;submittedDraft:SubmittedDraft|null};
const unavailable=():Ishod<never>=>({ok:false,kod:'WORKER_AI_UNAVAILABLE',poruka:'Ponovo učitaj svoj radni profil.'});
export default function WorkerConversationRoute(){
  const session=useSesija(),params=useLocalSearchParams<{conversationId?:string|string[];aiCorrection?:string|string[];entryKey?:string|string[];activationRequest?:string|string[]}>();
  const cid=typeof params.conversationId==='string'?params.conversationId:undefined;
  const entryKey=typeof params.entryKey==='string'&&uuid(params.entryKey)?params.entryKey:undefined;
  const activationRequest=typeof params.activationRequest==='string'&&uuid(params.activationRequest)?params.activationRequest:undefined;
  const owner=`${session.user?.id}:${session.accountRevision}`;
  // A topic-only navigation can replace search params on a retained route. Keep
  // its owned conversation, including an unsent draft; an explicit new ID or
  // account generation still starts a separate boundary.
  const retained=useRef({owner,id:cid,entryKey});
  // Explicit restart must clear the retained ID on the same mounted tab. Merely
  // removing conversationId is also used by topic navigation, so it cannot reset.
  if(retained.current.owner!==owner||(entryKey!==undefined&&entryKey!==retained.current.entryKey))retained.current={owner,id:cid,entryKey};
  else if(cid!==undefined)retained.current.id=cid;
  const conversationId=cid??retained.current.id;
  const invalid=(params.conversationId!==undefined&&cid===undefined)
    ||(params.entryKey!==undefined&&entryKey===undefined)
    ||(params.activationRequest!==undefined&&activationRequest===undefined)
    ||(conversationId!==undefined&&!uuid(conversationId));
  return <OwnedWorkerConversation key={`${owner}:${retained.current.entryKey??''}:${conversationId??''}`}
    initialId={conversationId} invalid={invalid} correctionToken={params.aiCorrection} activationRequest={activationRequest}/>;
}
function OwnedWorkerConversation({initialId,invalid,correctionToken,activationRequest}:{initialId?:string;invalid:boolean;correctionToken?:unknown;activationRequest?:string}){
  const {user,accountRevision}=useSesija(),accountId=user?.id;
  // ONE NAME (owner, 8 Oct 2026): the profile is saved under the name of the ACCOUNT, whatever the assistant proposed or the profile carried.
  const account=useAccountName(),accountName=account.state==='ready'?account.name:null;
  const cid=useRef<string|null>(initialId??null),[openKey]=useState(noviUuidZahtevId);
  const activationEntryRead=useRef<string|null>(null),reviewedActivationRequest=useRef<string|null>(null);
  const focus=useRef<object|null>(null),active=useRef(!AppState.currentState||AppState.currentState==='active');
  const [foreground,setForeground]=useState(active.current),[resuming,setResuming]=useState(false);
  const abort=useRef<AbortController|null>(null),refreshRef=useRef<()=>Promise<void>>(async()=>{});
  const [panel,setPanel]=useState<Panel>('chat'),[input,setInput]=useState(''),[stream,setStream]=useState('');
  const [reviewActivity,setReviewActivity]=useState<ReviewActivity>(null);
  const [correction,setCorrection]=useState<AiCorrectionIntent|null>(null);
  const panelScope=useRef<object>({}),renderedPanel=panelScope.current,panelWrite=useRef(false);
  // Only the conversation and its signed review own a panel. Profile changes
  // come from an explicit AI turn; choosing a correction topic writes nothing.
  const showPanel=(next:Panel)=>{panelScope.current={};setPanel(next);};
  const [leaving,setLeaving]=useState(false);
  const [menu,setMenu]=useState(false),[adding,setAdding]=useState(false);
  const draftText=useRef(input);draftText.current=input;
  const draftRevision=useRef(0);
  const [recovery,setRecovery]=useState<WorkerAiTurnRecovery|null>(null),[,intentChanged]=useState(0);
  const pending=useRef<Attempt|null>(null),saveKey=useRef<{reviewId:string;key:string}|null>(null);
  const [rejectedReviewId,setRejectedReviewId]=useState<string|null>(null);
  // A prepared review is authoritative. Retain its activation choice when a
  // later conversation turn retires the review; returning to review must not
  // silently turn a deliberate "keep draft" back into activation.
  const activationChoice=useRef<{conversationId:string;activate:boolean}|null>(null);
  // Leaving, or the app going to the background, makes an open question stale (its answer checks canAct), so it goes too.
  const confirmSheet=useConfirmSheet(),retireConfirmation=confirmSheet.close;
  useFocusEffect(useCallback(()=>{const token={};focus.current=token;setLeaving(false);return()=>{
    if(focus.current===token)focus.current=null;retireConfirmation();abort.current?.abort();abort.current=null;setStream('');
  };},[retireConfirmation]));
  useEffect(()=>{const subscription=AppState.addEventListener('change',state=>{
    // Duplicate native activity notifications are not a return from background.
    // Refreshing here would abort the current reply and unmount the voice composer.
    if(active.current===(state==='active'))return;
    active.current=state==='active';setForeground(active.current);abort.current?.abort();setStream('');
    if(!active.current)retireConfirmation();
    if(active.current){setResuming(true);void refreshRef.current().finally(()=>{if(active.current)setResuming(false);});}
  });return()=>{subscription.remove();active.current=false;abort.current?.abort();};},[retireConfirmation]);
  const owns=useCallback(()=>!!accountId&&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===accountRevision,
    [accountId,accountRevision]);
  const read=useCallback(async():Promise<Ishod<WorkerAiSnapshot>>=>{
    const scope=focus.current;if(invalid||!scope||!owns()||!active.current)return unavailable();
    // Restore before opening a conversation or sending anything. Storage holds
    // only three IDs; canonical history restores text after an accepted turn.
    let saved:WorkerAiTurnIntent|null;
    try{saved=await journal.load(accountId!);}catch{return {ok:false,kod:'WORKER_AI_LOCAL_INTENT_INVALID',poruka:'Ne možemo da proverimo prethodno slanje. Pokušaj ponovo.'};}
    if(focus.current!==scope||!owns()||!active.current)return unavailable();
    if(saved){
      if(cid.current!==saved.conversationId){cid.current=saved.conversationId;router.setParams({conversationId:saved.conversationId});}
      if(pending.current?.id!==saved.clientRequestId){pending.current={id:saved.clientRequestId,text:null,submittedDraft:null};intentChanged(n=>n+1);}
      const recovered=await api.recoverTurn(saved.conversationId,saved.clientRequestId);
      if(focus.current!==scope||!owns()||!active.current)return unavailable();
      if(!recovered.ok)return recovered;
      setRecovery(recovered.podatak);
      const terminal=recovered.podatak.conversationStatus!=='OPEN'||recovered.podatak.cancelled
        ||recovered.podatak.turn?.state==='SUCCEEDED'||recovered.podatak.turn?.state==='FAILED';
      if(terminal){
        try{await journal.clear(saved);}catch{return {ok:false,kod:'WORKER_AI_LOCAL_INTENT_INVALID',poruka:'Ishod je potvrđen. Ponovi proveru da nastaviš.'};}
        if(focus.current!==scope||!owns()||!active.current)return unavailable();
        // Text equality cannot establish ownership: spoken turns and restored IDs own no typed
        // draft. A typed Send owns only the raw value and edit revision captured at admission.
        const submittedDraft=pending.current?.submittedDraft;
        if(recovered.podatak.turn?.state==='SUCCEEDED'){
          setCorrection(null);
          if(submittedDraft)setInput(value=>draftRevision.current===submittedDraft.revision&&value===submittedDraft.value?'':value);
        }
        pending.current=null;intentChanged(n=>n+1);setStream('');
      }
    }else if(pending.current){
      // A failed local save did not authorize network I/O. Keep the typed draft.
      pending.current=null;setRecovery(null);intentChanged(n=>n+1);
    }
    let result=cid.current?await api.read(cid.current):await api.open(activationRequest??openKey);
    if(focus.current!==scope||!owns()||!active.current)return unavailable();
    // Only the receipt layer's proved no-response read can retain a same-account last-good transcript.
    // Ownership/refusal, malformed server data and unknown results still go through the fail-closed editor path.
    if(!result.ok&&result.kod===WORKER_AI_READ_TRANSPORT_UNAVAILABLE)throw new Error(result.kod);
    // Activation is another explicit review, never a replay of a completed Save.
    // Open preserves a server-side unfinished conversation; the journal above must
    // reconcile first. An existing open conversation also keeps its local typed draft.
    if(result.ok&&activationRequest&&activationEntryRead.current!==activationRequest&&!pending.current){
      if(result.podatak.status==='COMPLETED'){
        result=await api.open(activationRequest);
        if(focus.current!==scope||!owns()||!active.current)return unavailable();
        if(result.ok&&result.podatak.conversationId!==cid.current){
          cid.current=result.podatak.conversationId;router.setParams({conversationId:cid.current});
        }
      }
      if(result.ok)activationEntryRead.current=activationRequest;
    }
    if(result.ok&&!cid.current){cid.current=result.podatak.conversationId;router.setParams({conversationId:cid.current});}
    return result;
  },[invalid,owns,openKey,accountId,activationRequest]);
  const editor=useOwnedEditor(read);refreshRef.current=editor.refresh;
  const data=editor.data,renderedFocus=focus.current;
  useEffect(()=>{
    if(data?.review)activationChoice.current={conversationId:data.conversationId,activate:data.review.activate};
  },[data?.conversationId,data?.review]);
  const reviewNeedsRestart=!!rejectedReviewId&&data?.review?.reviewId===rejectedReviewId&&!data.saved;
  useEffect(()=>{if(data&&data.review?.reviewId!==rejectedReviewId)setRejectedReviewId(null);},[data?.review?.reviewId,rejectedReviewId]);
  const [,expireReview]=useState(0);
  useEffect(()=>{
    if(!data?.review||data.saved)return;
    const delay=Date.parse(data.review.expiresAt)-Date.now();if(delay<=0)return;
    const timer=setTimeout(()=>expireReview(value=>value+1),delay+1);return()=>clearTimeout(timer);
  },[data?.review?.reviewId,data?.review?.expiresAt,data?.saved]);
  const current=()=>!!renderedFocus&&focus.current===renderedFocus&&owns()&&active.current;
  const canAct=()=>current()&&panelScope.current===renderedPanel&&!resuming&&!editor.busy&&!editor.loading&&editor.loaded&&!editor.uncertain&&!!data;
  const savePanel=async(activity:Exclude<ReviewActivity,null>,command:()=>Promise<Ishod<WorkerAiSnapshot>>)=>{
    setReviewActivity(activity);
    try{return await editor.save(async()=>{
      panelWrite.current=true;try{return await command();}finally{panelWrite.current=false;}
    });}finally{setReviewActivity(null);}
  };
  const turn=data?.turn,awaiting=turn?.state==='PROCESSING'||turn?.state==='UNKNOWN_OUTCOME';
  const writable=data?.status==='OPEN'&&!data.stale&&data.safety!=='BLOCK'&&data.safety!=='REVIEW';
  const send=async(body:string,submittedDraft:SubmittedDraft|null=null)=>{
    if(!canAct()||!writable||awaiting||!data||!body.trim()||(pending.current&&!recovery?.retryAllowed))return;
    await editor.save(async()=>{
      const command=pending.current??{id:noviUuidZahtevId(),text:body,submittedDraft};
      if(!command.text)return unavailable();pending.current=command;intentChanged(n=>n+1);setRecovery(null);
      const controller=new AbortController();abort.current=controller;setStream('');
      try{
        await journal.save({accountId:accountId!,conversationId:data.conversationId,clientRequestId:command.id});
        if(!current()||controller.signal.aborted)return unavailable();
        const sent=await api.send(data.conversationId,command.text,command.id,{signal:controller.signal,
          onText:delta=>{if(current()&&!controller.signal.aborted&&pending.current===command)setStream(value=>value+delta);}});
        if(!current())return unavailable();
        // Both success and lost transport response are reconciled through the
        // durable turn. An unknown attempt cannot start a second provider call.
        const result=await read();if(!current())return unavailable();
        return result.ok?result:sent.ok?result:sent;
      }finally{if(abort.current===controller)abort.current=null;if(current())setStream('');}
    });
  };
  const keepTranscript=(text:string)=>{
    if(!canAct()||!writable||awaiting||pending.current)return false;
    const next=[draftText.current.trimEnd(),text.trim()].filter(Boolean).join('\n');
    if(!next||next.length>4000)return false;
    draftRevision.current+=1;draftText.current=next;setInput(next);return true;
  };
  const voice=useHoldToTalk({conversationId:!leaving&&writable&&data?data.conversationId:null,
    onTranscript:payload=>{
      if(!payload.isCurrent())return false;
      // Held microphone: what was said is the message, sent through `send` (the same journal, key and guards as the
      // send button) the moment the finger lifts, as in the task conversation (owner, 2026-09-23). The typed draft stays.
      // The accessible start/stop mode keeps the review: its text lands in the draft, and only Send writes the turn.
      if(payload.session?.mode!=='accessible'){
        const spoken=payload.text.trim();
        if(!spoken||spoken.length>4000||!canAct()||!writable||awaiting||pending.current)return false;
        void send(spoken);return true;
      }
      return keepTranscript(payload.text);
    }});
  const voiceBusy=voice.state.phase!=='IDLE';
  const enabled=canAct()&&!voiceBusy&&!awaiting&&!pending.current;
  useFocusEffect(useCallback(()=>{
    // A retained entry waits for readback instead of interrupting a signed save
    // or consuming its one-use topic while a previous turn is unresolved.
    if(!accountId||!data||data.saved||!writable||!foreground||!focus.current||!enabled)return;
    const next=takeAiCorrection(correctionToken,{accountId,accountRevision},'worker',data.conversationId);
    if(next){setCorrection(next);showPanel('chat');}
  },[correctionToken,accountId,accountRevision,data?.conversationId,data?.saved,writable,foreground,enabled]));
  const correctPart=(next:WorkerAiPart|'details')=>{
    if(!canAct()||!enabled||!writable||!data||data.saved||!accountId)return;
    const hint=rememberAiCorrection({accountId,accountRevision},`worker.${next}`,data.conversationId);
    if(!hint)return;
    const owned=takeAiCorrection(hint.token,{accountId,accountRevision},'worker',data.conversationId);
    if(!owned)return;
    setAdding(false);setMenu(false);setCorrection(owned);showPanel('chat');
  };
  const canRetry=canAct()&&!voiceBusy&&!awaiting&&!!writable&&!!pending.current?.text&&recovery?.retryAllowed===true;
  const leave=(navigate:()=>void)=>{
    if(!current()||panelScope.current!==renderedPanel)return;
    // Retire immediately, before navigation emits blur. Aborting the local stream is not a
    // server cancellation: the journal stays owned by this turn for readback on return.
    focus.current=null;setLeaving(true);setMenu(false);setAdding(false);retireConfirmation();
    voice.controller.cancel('navigation');abort.current?.abort();abort.current=null;setStream('');navigate();
  };
  const back=()=>{
    if(!current()||panelScope.current!==renderedPanel)return;
    if(panel==='review'){if(!editor.busy&&!panelWrite.current)showPanel('chat');return;}
    leave(()=>router.canGoBack()?router.back():router.replace('/profil/radnik'));
  };
  const refresh=()=>{if(current()&&!editor.busy&&!editor.loading&&!voiceBusy)void editor.refresh();};
  const cancelPending=async()=>{
    const command=pending.current;if(!canAct()||voiceBusy||!data||!command||!recovery?.canCancel)return;
    await editor.save(async()=>{const result=await api.cancelTurn(data.conversationId,command.id);
      if(!current())return unavailable();if(!result.ok)return result;
      // Cancellation may lose to completion. Only the canonical read
      // can retire the journal; an abort alone never means cancellation.
      return read();});
  };
  // The proposal takes the account's name while it carries another (the assistant's own, or the profile's old one). Nothing is sent when they agree.
  const rename=(snapshot:WorkerAiSnapshot):WorkerAiPatch|null=>accountName&&snapshot.candidate.displayName.trim()!==accountName?{displayName:accountName}:null;
  const reviewActivation=data?.review?.activate??(activationChoice.current?.conversationId===data?.conversationId
    ?activationChoice.current?.activate:false)??false;
  const review=async(activate=reviewActivation)=>{
    // Native speech can start before React replaces a retained review callback.
    if(!canAct()||!enabled||!writable||!data||voice.controller.getSnapshot().phase!=='IDLE')return;
    await savePanel('preparing',async()=>{
      // The review is made of the proposal as it stands, so the name goes into the proposal first (one patch, then the same prepare).
      let at={conversationId:data.conversationId,revision:data.revision};
      const name=rename(data);
      if(name){const named=await api.patch(data.conversationId,data.revision,name);
        if(!current())return unavailable();if(!named.ok)return named;
        at={conversationId:named.podatak.conversationId,revision:named.podatak.revision};}
      const prepared=await api.prepare(at.conversationId,at.revision,activate);
      if(!current())return unavailable();if(!prepared.ok)return prepared;
      if(activationRequest)reviewedActivationRequest.current=activationRequest;
      const next=await read();if(next.ok&&current())showPanel('review');return next;
    });
  };
  const save=async()=>{
    const reviewed=data?.review;if(!canAct()||!enabled||!writable||reviewNeedsRestart||!data||!reviewed||!reviewed.canAccept||reviewed.revision!==data.revision||Date.parse(reviewed.expiresAt)<=Date.now())return;
    if(saveKey.current?.reviewId!==reviewed.reviewId)saveKey.current={reviewId:reviewed.reviewId,key:noviUuidZahtevId()};
    const key=saveKey.current.key;
    await savePanel('saving',async()=>{const saved=await api.save(reviewed,key);if(!current())return unavailable();
      const result=await read();if(!current())return unavailable();
      if(result.ok&&result.podatak.saved?.reviewId===reviewed.reviewId){
        // Legacy (unsigned) saves retain their historical global-mode bridge.
        // A SIGNED review — READY or PENDING — must not issue a second global
        // mode write here. The post-Save binder atomically persists both the
        // signed per-service modes and global choice after verifying the exact
        // Save receipt. An async client write after Save would set updated_at
        // after the Save timestamp and trigger WORKER_BINDER_NEWER_GLOBAL_MODE.
        if(accountId&&reviewed.classificationState===undefined&&reviewed.profile){
          const modes=inferWorkerExecutionModes(reviewed.profile.skills,reviewed.profile.location);
          if(modes.length)void workerExecutionModeClientService.save(accountId,accountRevision,modes).catch(()=>undefined);
        }
        return result;
      }
      // A retired-field review may be rejected although its older source hash
      // still matches. Keep that refusal scoped to this review through a read;
      // never silently alter its frozen content or relax uncertain-write guards.
      if(!saved.ok&&saved.kod==='WORKER_AI_STALE')setRejectedReviewId(reviewed.reviewId);
      return saved.ok?result:saved;});
  };
  const restart=()=>{
    if(!canAct()||voiceBusy||!data)return;
    confirmSheet.ask({title:'Pokrenuti nov razgovor?',message:'Novi razgovor kreće od sačuvanog profila. Ovaj više nećeš moći da nastaviš; podaci se ne brišu. Neposlati tekst neće biti sačuvan.',
      cancelLabel:'Nastavi ovaj razgovor',confirmLabel:'Novi razgovor',onConfirm:()=>{
        // Returned so the confirmation waits on the command it started instead of closing before it is sent.
        if(!canAct()||voiceBusy)return;return editor.save(async()=>{
          // Completed conversations stay completed on the server. Reconcile their
          // journal before leaving, without issuing another abandon command.
          const previousId=data.conversationId;
          if(data.status==='OPEN'){
            // A lost or rejected write receipt is not proof that abandonment failed.
            // Read the exact owned conversation before opening a new one; a failed
            // read or OPEN state retains this route and its unsent text.
            try{await api.abandon(previousId);}catch{/* Readback below decides the outcome. */}
            if(!current())return unavailable();
          }
          const confirmed=await read();if(!current())return unavailable();
          if(!confirmed.ok)return confirmed;
          if(confirmed.podatak.conversationId!==previousId||pending.current
            ||(confirmed.podatak.status!=='ABANDONED'&&confirmed.podatak.status!=='COMPLETED'))
            return {ok:false,kod:'WORKER_AI_ABANDON_UNCONFIRMED',poruka:'Ne znamo da li je prethodni razgovor završen. Proveri stanje.'};
          router.replace({pathname:'/profil/razgovor',params:{entryKey:noviUuidZahtevId()}});
          return confirmed;
        });
      }});
  };
  const abandon=()=>{
    if(!canAct()||voice.controller.getSnapshot().phase!=='IDLE'||!data||data.status!=='OPEN'||pending.current||awaiting)return;
    confirmSheet.ask({title:'Napustiti razgovor?',
      message:'Ovaj nacrt više nećeš moći da nastaviš. Sačuvani profil ostaje isti, a podaci razgovora se ne brišu trajno. Neposlati tekst neće biti sačuvan.',
      cancelLabel:'Nastavi razgovor',confirmLabel:'Napusti razgovor',tone:'danger',onConfirm:()=>{
        if(!canAct()||voice.controller.getSnapshot().phase!=='IDLE'||!data||data.status!=='OPEN'||pending.current||awaiting)return;
        return editor.save(async()=>{
          // A lost command response is not proof of failure. Read the same owned
          // conversation before leaving; an OPEN or unavailable read keeps this draft.
          try{await api.abandon(data.conversationId);}catch{/* Readback below decides whether the command took effect. */}
          if(!current())return unavailable();
          const confirmed=await read();if(!current())return unavailable();
          if(confirmed.ok&&confirmed.podatak.conversationId===data.conversationId
            &&confirmed.podatak.status==='ABANDONED'&&!pending.current){
            router.replace('/profil/radnik');return confirmed;
          }
          if(!confirmed.ok)return confirmed;
          return {ok:false,kod:'WORKER_AI_ABANDON_UNCONFIRMED',poruka:'Ne znamo da li je razgovor napušten. Proveri stanje.'};
        });
      }});
  };
  const statusCopy=data?.saved?'Profil je sačuvan.':data?.status!=='OPEN'?'Ovaj razgovor je završen.':data.stale?'Sačuvani profil je promenjen. Novi razgovor će početi od tih podataka.':
    data.safety==='BLOCK'||data.safety==='REVIEW'?'Ovaj predlog trenutno ne može da se sačuva.':awaiting?turn?.state==='UNKNOWN_OUTCOME'?
      'Ne znamo da li je prethodna poruka stigla. Proveri to; poruka se neće poslati dvaput.':'AI još obrađuje poruku. Proveri stanje.':pending.current?'Proveri prethodno slanje. Novi unos i pregled su dostupni kada potvrdimo ishod.':
      recovery?.cancelled&&recovery.providerDispatched?'Odgovor je zaustavljen. Poruka je ipak poslata jer je asistent već počeo da je obrađuje; profil je ostao isti.':null;
  const lastGoodUnverified=!!data&&!editor.loaded&&!editor.loading;
  const lastGoodCopy='Prikazan je poslednji učitan razgovor. Slanje i čuvanje su pauzirani dok ne proverimo stanje.';
  if(leaving||!data||!foreground||resuming)return <WorkerProfileFrame back={back} title="Moj radni profil" tone="conversation"><WorkerProfileStatus context="conversation" loading={leaving||editor.loading||!foreground||resuming}
    error={leaving?null:editor.error} retry={refresh}/>{!leaving&&foreground&&!resuming?confirmSheet.sheet:null}</WorkerProfileFrame>;
  const reviewBusyLabel=reviewActivity==='preparing'?'Pripremamo pregled…':reviewActivity==='saving'?'Čuvamo profil…':'Proveravamo stanje…';
  const busyPanelCopy=editor.busy?<T testID="worker-review-progress" accessibilityRole="alert" variant="meta" tone="muted">
    {reviewActivity==='preparing'?'Pripremamo novi pregled. Profil još nije sačuvan.':reviewActivity==='saving'
      ?'Čuvamo profil. Sačekaj potvrdu pre povratka u razgovor.':'Proveravamo stanje razgovora. Sačekaj potvrdu.'}
  </T>:null;
  if(panel==='review'&&data.review){const frozen=data.review,
    catalogNeedsRefresh=frozen.classificationState==='CATALOG_UNAVAILABLE'||frozen.classificationState==='STALE_CATALOG',
    // The account got its name (in "Lični podaci") while this review still says it is missing: a fresh review puts it in.
    nameAdded=frozen.missingRequired.includes('Ime')&&!!accountName,
    expired=Date.parse(frozen.expiresAt)<=Date.now()||frozen.revision!==data.revision||nameAdded;
    // A correction returns to this conversation without sending or replacing its typed draft.
    const editConversation=()=>{
      if(!canAct()||!enabled||!writable||data.saved||expired||reviewNeedsRestart)return;
      correctPart('details');
    };
    return <WorkerProfileFrame back={back} title="Tvoj radni profil" footer={data.saved?<V2Action label="Otvori sačuvani profil" onPress={()=>leave(()=>router.replace('/profil/radnik'))} style={brandAction}/>:<>
      <V2Action label={editor.busy?reviewBusyLabel:frozen.activate?'Sačuvaj i aktiviraj profil':'Sačuvaj profil'}
        disabled={!enabled||!writable||reviewNeedsRestart||!frozen.canAccept||expired} onPress={()=>{void save();}} style={brandAction}/>
      {(expired||editor.uncertain||editor.error)?<V2Action tone="neutral" label="Proveri stanje" onPress={refresh} disabled={editor.busy||editor.loading}/>:null}
    </>}>
      {data.saved?<T accessibilityRole="alert" variant="title" style={{color:sys.color.green}}>Profil je sačuvan{data.saved.profileStatus==='ACTIVE'?' i aktivan':''}.</T>:null}
      {!data.saved&&input.trim()?<T testID="worker-review-unsent-note" variant="note" tone="muted">Neposlati tekst nije deo ovog pregleda. Ostaje u razgovoru.</T>:null}
      <WorkerAiReviewDetails review={frozen} onEdit={data.saved?undefined:editConversation} editDisabled={!enabled||!writable||expired||reviewNeedsRestart}
        onAddName={data.saved||expired||!enabled||!writable||reviewNeedsRestart?undefined:()=>leave(()=>router.push('/profil/podaci'))}/>
      {/* Describe notification readiness honestly: signed pending reviews grant no matching authority. */}
      {!data.saved?<WorkerAiNotificationsNote matchingReady={frozen.classificationState==='READY'}/>:null}
      {busyPanelCopy}
      {/* The save button below is grey for one of these reasons; the details above name a missing field themselves. */}
      {!data.saved&&(expired||!writable)?<T variant="meta" tone="muted">{expired?'Ovaj pregled više ne važi. Učitaj novi pregled pre čuvanja.':statusCopy??'Ovaj predlog trenutno ne može da se sačuva.'}</T>:null}
      {data.profileStatus==='DRAFT'&&!data.saved?<WorkerAiActivation activate={frozen.activate} disabled={!enabled} change={value=>{void review(value);}}/>:null}
      {(expired||catalogNeedsRefresh)&&!data.saved?<V2Action tone="neutral" label="Učitaj novi pregled" disabled={!enabled||reviewNeedsRestart} onPress={()=>{void review(frozen.activate);}}/>:null}
      {editor.error?<T accessibilityRole="alert" tone="danger">{editor.error}</T>:null}
      {lastGoodUnverified?<T accessibilityRole="alert" variant="note" tone="muted">{lastGoodCopy}</T>:null}
      {reviewNeedsRestart?<>
        <T variant="note" tone="muted">{editor.uncertain?'Proveri stanje, pa otvori nov razgovor.':'Ovaj predlog više ne može da se sačuva. Novi razgovor kreće od tvog sačuvanog profila.'}</T>
        <V2Action tone="neutral" label="Novi razgovor" disabled={!enabled} onPress={restart}/>
      </>:null}
      {confirmSheet.sheet}
    </WorkerProfileFrame>;
  }
  // Extra menu actions choose a topic in the same conversation.
  // A grey row says its own reason (review r4 ra item 16): the wait for an answer was named for every cause.
  const unavailableNow=enabled?undefined:voiceBusy?'Dostupno kad završiš govor.'
    :awaiting||pending.current?'Dostupno kad razgovor ne čeka odgovor.'
      :editor.uncertain?'Prvo proveri stanje razgovora.'
        :editor.loading||resuming?'Dostupno kad se razgovor učita.':'Dostupno kad se završi prethodna radnja.';
  // The worker side stores the person's message the moment its turn is claimed, and the read returns every stored
  // message, so a turn that is still processing (a lost answer, a return to the app, "Proveri razgovor") already
  // shows it in the thread. Drawing it again as "šalje se" said the same sentence twice (verify r4b ra item A); it is
  // "not yet read back" only until the thread's last message is that very sentence.
  const sent=pending.current?.text??null,lastMessage=data.messages[data.messages.length-1];
  const unread=sent&&!(lastMessage?.role==='USER'&&lastMessage.body.trim()===sent.trim())?sent:null;
  // Legacy equipment alone is not a configured MVP work profile. The V1 wire
  // still carries it for signed-review compatibility, but the conversation
  // introduces the service, area and availability that actually route tasks.
  const hasProfileContent = data.candidate.skills.length > 0 || data.candidate.bio.trim().length > 0
    || data.candidate.location.city.trim().length > 0 || data.candidate.availability.availableNow
    || data.candidate.availability.rules.length > 0 || data.candidate.availability.windows.length > 0;
  // A past review must not lend its service modes or delivery scope to a newer draft.
  const currentReview=!data.stale&&!reviewNeedsRestart&&data.review?.accountId===data.accountId
    &&data.review.conversationId===data.conversationId&&data.review.profileId===data.profileId
    &&data.review.revision===data.revision&&Date.parse(data.review.expiresAt)>Date.now()?data.review:null;
  // The "+" selects a topic for the same conversation. Only an explicit message changes the proposal.
  const openPart=(next:WorkerAiPart)=>{
    if(!canAct()||!enabled||!writable)return;
    correctPart(next);
  };
  return <><AiConversationShell conversationKey={data.conversationId} title="Moj radni profil" questionFocus initialInputMode="keyboard"
    correction={correction&&writable?{...correction,onDismiss:()=>{if(canAct()&&enabled)setCorrection(null);}}:undefined}
    cardPlacement="end"
    newConversation={{ onPress: restart, disabled: !canAct() || voiceBusy }}
    exitAction={data.status==='OPEN'?<V2Action kind="destructive" compact label="Napusti razgovor"
      disabled={!enabled} reason={enabled?null:unavailableNow} onPress={abandon}/>:undefined}
    closed={!!data.saved || data.status !== 'OPEN'}
    attach={writable?{label:'Šta želiš da izmeniš?',hint:'Izaberi temu i nastavi isti razgovor.',disabled:!enabled,
      onPress:()=>{if(current()&&panelScope.current===renderedPanel)setAdding(true);}}:undefined}
    // Review is a separate full screen, never a second profile card inside the chat.
    // The V1 snapshot has no interview-complete signal: meaningful content grants only
    // a quiet review affordance. Only an owned, current server review can promote it.
    card={()=>null}
    footerAction={hasProfileContent&&writable&&!data.saved?<V2Action label="Pregledaj radni profil"
      kind={currentReview?.canAccept?'primary':'secondary'} tone={currentReview?.canAccept?undefined:'neutral'}
      style={currentReview?.canAccept?brandAction:undefined} disabled={!enabled}
      reason={!enabled?unavailableNow:undefined}
      onPress={()=>{void review(activationRequest&&reviewedActivationRequest.current!==activationRequest?true:reviewActivation);}}/>:undefined}
    messages={data.messages.map(m=>({id:m.id,fromAi:m.role==='ASSISTANT',body:m.body}))}
    // Immediate client introduction; no Gemini call, cost, fake persisted turn or automatic Save.
    // Removed when the real owned conversation begins; re-entry never invents old AI messages.
    introMessage={data.messages.length===0 && !unread ? workerInterviewOpening(hasProfileContent) : undefined}
    showWelcomeArt={!hasProfileContent}
    welcome={hasProfileContent?'Dobar dan! Šta želite da dopunite? 🧡':'Dobar dan! Čime se bavite? 🧡'}
    welcomeDetail=""
    placeholder="Opišite čime se bavite"
    value={input} onChange={value=>{if(canAct()&&enabled&&writable){draftRevision.current+=1;draftText.current=value;setInput(value);}}} canEdit={!!enabled&&!!writable&&!pending.current}
    canSend={canRetry||(!!enabled&&!!writable&&!!input.trim()&&!pending.current)} pending={!!pending.current} busy={editor.busy}
    busyLabel={editor.busy && !abort.current ? 'Proveravamo promenu…' : undefined} streamingText={stream}
    // What was just sent and is not yet read back stays on screen (review r4 ra item 2): without it, voice mode fell
    // back to the previous exchange and showed the old answer as the reply to what was just said. A recovered intent
    // has no text (storage holds only ids), and then nothing is shown. Once the read holds it, the thread shows it once.
    sentMessage={unread}
    onSend={()=>{if(voiceBusy)return;if(pending.current){if(canRetry&&pending.current.text)void send(pending.current.text);return;}
      void send(input.trim(),{value:input,revision:draftRevision.current});}} onBack={back} onOptions={writable?()=>{if(current()&&panelScope.current===renderedPanel)setMenu(true);}:undefined}
    // A fragment is truthy even when empty, which drew an empty recovery panel in the thread; the slot is filled only
    // when there is something to say.
    status={statusCopy||editor.error||activationRequest||lastGoodUnverified?<>{pending.current&&!editor.busy?<T variant="bodyStrong">{canRetry?'Poruka čeka ponovni pokušaj':turn?.state==='PROCESSING'?'Poruka je u obradi':'Ishod nije potvrđen'}</T>:null}
      {statusCopy?<T variant="meta" tone="muted">{statusCopy}</T>:null}
      {pending.current&&!editor.busy?<T variant="note" tone="muted">Provera ne šalje novu poruku.</T>:null}
      {activationRequest&&writable&&!data.saved?<T variant="note" tone="muted">Pregledaj podatke pre aktivacije. Ako imaš nezavršen predlog, i njegove izmene ulaze u pregled. Profil postaje aktivan tek kada potvrdiš.</T>:null}
      {lastGoodUnverified?<T accessibilityRole="alert" variant="note" tone="muted">{lastGoodCopy}</T>:null}
      {editor.error?<T accessibilityRole="alert" variant="meta" tone="danger">{editor.error}</T>:null}</>:undefined}
    // The shell draws the microphone, its notice and voice mode from this one controller; every transcript comes back
    // through `onTranscript` above.
    voice={writable?{controller:voice.controller,state:voice.state,disabled:!enabled||!!pending.current,onKeepText:keepTranscript}:undefined}
    actions={<>
      {/* After a save the only next step is the saved profile; a second "check" button beside it read as unfinished. */}
      {(pending.current||awaiting||editor.uncertain||editor.error)&&!data.saved?<V2Action tone="neutral" label="Proveri razgovor" disabled={editor.busy||editor.loading||voiceBusy} onPress={refresh}/>:null}
      {pending.current&&recovery?.canCancel?<>
        <T variant="meta" tone="muted">Ako odustaneš, odgovor asistenta neće promeniti profil. Ako je asistent već počeo da odgovara, poruka je ipak poslata.</T>
        <V2Action tone="neutral" label={recovery.providerDispatched?'Odustani od odgovora':'Otkaži prethodno slanje'} kind="quiet"
          disabled={!canAct()||voiceBusy} onPress={()=>{void cancelPending();}}/>
      </>:null}
      {data.saved?<V2Action label="Otvori sačuvani profil" onPress={()=>leave(()=>router.replace('/profil/radnik'))} style={brandAction}/>:null}
    </>}/>{confirmSheet.sheet}
    {menu?<ActionSheet label="Izmene kroz razgovor" onClose={()=>setMenu(false)} actions={[
      {key:'identity',label:'O meni',icon:'document',disabled:!enabled||!writable,subtitle:unavailableNow,
        onPress:()=>correctPart('identity')},
      {key:'time',label:'Raspored i dostupnost',icon:'calendar',disabled:!enabled||!writable,subtitle:unavailableNow,
        onPress:()=>correctPart('time')},
    ]}/>:null}
    {adding?<ActionSheet label="Dodaj podatke" onClose={()=>setAdding(false)} actions={([
      ['skills','tasks'],['area','pin'],['time','clock'],
    ] as const).map(([key,icon])=>({key,icon,label:key==='area'?'Područje rada':WORKER_PART_TITLE[key],disabled:!enabled||!writable,subtitle:unavailableNow,
      onPress:()=>openPart(key)}))}/>:null}</>;
}
