import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { workerAiClientService as api, type WorkerAiPatch, type WorkerAiSnapshot, type WorkerAiTurnRecovery } from '../../../data/workerAiClientService';
import { workerAiTurnIntentJournal as journal, type WorkerAiTurnIntent } from '../../../data/workerAiTurnIntentJournal';
import type { Ishod } from '../../../data/ports';
import { uuid } from '../../../data/serverReceipt';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { workerAvailabilityPatch } from '../../../lib/workerAiAvailabilityPatch';
import { sesijaSada, useSesija } from '../../../store/sesija';

import { useHoldToTalk } from '../../../features/voice/useHoldToTalk';
import { AiConversationShell } from '../../../ui/aiFirst/AiConversationShell';
import { useAccountName } from '../../../ui/profile/useAccountName';
import { ActionSheet } from '../../../ui/system/ActionSheet';
import { brandAction, sys } from '../../../ui/system/tokens';
import { WorkerProfileFrame, WorkerProfileStatus } from '../../../ui/workerProfile/WorkerProfilePresentation';
import { WorkerAiActivation, WorkerAiCard, WorkerAiManual, WorkerAiNotificationsNote, WorkerAiReviewDetails, type WorkerAiManualDraft, type WorkerAiManualPart } from '../../../ui/workerProfile/WorkerAiPresentation';
import { WORKER_PART_TITLE, type WorkerAiPart } from '../../../ui/workerProfile/workerProfileFacts';
import { AvailabilityForm } from '../../../ui/calendar/AvailabilityForm';
import { CalendarScreen } from '../../../ui/calendar/CalendarControls';
import { T } from '../../../ui/Text';
import { V2Action } from '../../../ui/v2/V2Action';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';

type Panel='chat'|'review'|'manual'|'availability';
type SubmittedDraft={value:string;revision:number};
type Attempt={id:string;text:string|null;submittedDraft:SubmittedDraft|null};
const unavailable=():Ishod<never>=>({ok:false,kod:'WORKER_AI_UNAVAILABLE',poruka:'Ponovo učitaj svoj radni profil.'});
export default function WorkerConversationRoute(){
  const session=useSesija(),params=useLocalSearchParams<{conversationId?:string|string[]}>();
  const cid=typeof params.conversationId==='string'?params.conversationId:undefined;
  return <OwnedWorkerConversation key={`${session.user?.id}:${session.accountRevision}:${cid??''}`}
    initialId={cid} invalid={params.conversationId!==undefined&&(!cid||!uuid(cid))}/>;
}
function OwnedWorkerConversation({initialId,invalid}:{initialId?:string;invalid:boolean}){
  const {user,accountRevision}=useSesija(),accountId=user?.id;
  // ONE NAME (owner, 8 Oct 2026): the profile is saved under the name of the ACCOUNT, whatever the assistant proposed or the profile carried.
  const account=useAccountName(),accountName=account.state==='ready'?account.name:null;
  const cid=useRef<string|null>(initialId??null),[openKey]=useState(noviUuidZahtevId);
  const focus=useRef<object|null>(null),active=useRef(!AppState.currentState||AppState.currentState==='active');
  const [foreground,setForeground]=useState(active.current),[resuming,setResuming]=useState(false);
  const abort=useRef<AbortController|null>(null),refreshRef=useRef<()=>Promise<void>>(async()=>{});
  const [panel,setPanel]=useState<Panel>('chat'),[input,setInput]=useState(''),[stream,setStream]=useState('');
  const panelScope=useRef<object>({}),renderedPanel=panelScope.current,panelWrite=useRef(false);
  const manualEdits=useRef({dirty:false,revision:0,sourceRevision:null as number|null,value:null as WorkerAiManualDraft|null}),manualQuestion=useRef<object|null>(null);
  // A focused editor opens one part (`part`); where it was opened from (`origin`: the conversation, or the review) is where Back and a
  // confirmed discard return. The whole manual form and the week open with no part and return to the conversation.
  const [part,setPart]=useState<WorkerAiManualPart|null>(null),origin=useRef<'chat'|'review'>('chat');
  const showPanel=(next:Panel,opening?:{part?:WorkerAiManualPart;from?:'chat'|'review'})=>{
    manualEdits.current={dirty:false,revision:manualEdits.current.revision+1,sourceRevision:null,value:null};manualQuestion.current=null;
    origin.current=opening?.from??'chat';setPart(opening?.part??null);
    panelScope.current={};setPanel(next);};
  const [leaving,setLeaving]=useState(false);
  const [menu,setMenu]=useState(false),[adding,setAdding]=useState(false);
  const draftText=useRef(input);draftText.current=input;
  const draftRevision=useRef(0);
  const [recovery,setRecovery]=useState<WorkerAiTurnRecovery|null>(null),[,intentChanged]=useState(0);
  const pending=useRef<Attempt|null>(null),saveKey=useRef<{reviewId:string;key:string}|null>(null);
  const [rejectedReviewId,setRejectedReviewId]=useState<string|null>(null);
  // Leaving, or the app going to the background, makes an open question stale (its answer checks canAct), so it goes too.
  const confirmSheet=useConfirmSheet(),retireConfirmation=confirmSheet.close;
  useFocusEffect(useCallback(()=>{const token={};focus.current=token;setLeaving(false);return()=>{
    if(focus.current===token)focus.current=null;manualQuestion.current=null;retireConfirmation();abort.current?.abort();abort.current=null;setStream('');
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
        if(recovered.podatak.turn?.state==='SUCCEEDED'&&submittedDraft)setInput(value=>
          draftRevision.current===submittedDraft.revision&&value===submittedDraft.value?'':value);
        pending.current=null;intentChanged(n=>n+1);setStream('');
      }
    }else if(pending.current){
      // A failed local save did not authorize network I/O. Keep the typed draft.
      pending.current=null;setRecovery(null);intentChanged(n=>n+1);
    }
    const result=cid.current?await api.read(cid.current):await api.open(openKey);
    if(focus.current!==scope||!owns()||!active.current)return unavailable();
    if(result.ok&&!cid.current){cid.current=result.podatak.conversationId;router.setParams({conversationId:cid.current});}
    return result;
  },[invalid,owns,openKey,accountId]);
  const editor=useOwnedEditor(read);refreshRef.current=editor.refresh;
  const data=editor.data,renderedFocus=focus.current;
  const reviewNeedsRestart=!!rejectedReviewId&&data?.review?.reviewId===rejectedReviewId&&!data.saved;
  useEffect(()=>{if(data&&data.review?.reviewId!==rejectedReviewId)setRejectedReviewId(null);},[data?.review?.reviewId,rejectedReviewId]);
  const [,expireReview]=useState(0);
  useEffect(()=>{
    if(!data?.review||data.saved)return;
    const delay=Date.parse(data.review.expiresAt)-Date.now();if(delay<=0)return;
    const timer=setTimeout(()=>expireReview(value=>value+1),delay+1);return()=>clearTimeout(timer);
  },[data?.review?.reviewId,data?.review?.expiresAt,data?.saved]);
  const current=()=>!!renderedFocus&&focus.current===renderedFocus&&owns()&&active.current;
  const canAct=()=>current()&&panelScope.current===renderedPanel&&!resuming&&!editor.busy&&!editor.loading&&!editor.uncertain&&!!data;
  const savePanel=(command:()=>Promise<Ishod<WorkerAiSnapshot>>)=>editor.save(async()=>{
    panelWrite.current=true;try{return await command();}finally{panelWrite.current=false;}
  });
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
  const manualBackBlocked=useRef(false);
  manualBackBlocked.current=editor.busy||editor.loading||editor.uncertain||resuming;
  useEffect(()=>{
    if(manualQuestion.current){manualQuestion.current=null;retireConfirmation();}
  },[editor.busy,editor.loading,editor.uncertain,data?.revision,foreground,retireConfirmation]);
  const manualDraftConflict=manualEdits.current.dirty&&manualEdits.current.sourceRevision!==data?.revision;
  const manualChanged=(value:WorkerAiManualDraft,dirty:boolean)=>{
    if(!current()||panel!=='manual'||panelScope.current!==renderedPanel||panelWrite.current)return;
    // Privacy unmounts the fields, not this owner-scoped draft. A newer server
    // proposal never silently adopts edits made against an older revision.
    if(manualEdits.current.dirty&&manualEdits.current.sourceRevision!==data?.revision)return;
    manualEdits.current={dirty,revision:manualEdits.current.revision+1,sourceRevision:data?.revision??null,value};
    manualQuestion.current=null;retireConfirmation();
  };
  const leave=(navigate:()=>void)=>{
    if(!current()||panelScope.current!==renderedPanel)return;
    // Retire immediately, before navigation emits blur. Aborting the local stream is not a
    // server cancellation: the journal stays owned by this turn for readback on return.
    focus.current=null;setLeaving(true);setMenu(false);setAdding(false);retireConfirmation();
    voice.controller.cancel('navigation');abort.current?.abort();abort.current=null;setStream('');navigate();
  };
  // Where an editor returns to: the review it was opened from (the same proposal, nothing changed), otherwise the conversation.
  const closeEditor=()=>showPanel(origin.current==='review'&&data?.review&&!data.saved?'review':'chat');
  const back=()=>{
    if(!current()||panelScope.current!==renderedPanel)return;
    if(panel==='manual'){
      // An unconfirmed patch is a server outcome to reconcile, never a local
      // draft that a discard confirmation may throw away.
      if(manualBackBlocked.current||panelWrite.current)return;
      if(manualEdits.current.dirty){
        if(manualQuestion.current)return;
        const token={},revision=manualEdits.current.revision;manualQuestion.current=token;
        confirmSheet.ask({title:'Odbaciti izmene?',message:'Ručne izmene neće biti primenjene na predlog profila.',
          confirmLabel:'Odbaci izmene',cancelLabel:'Nastavi uređivanje',tone:'danger',
          onCancel:()=>{if(manualQuestion.current===token)manualQuestion.current=null;},
          onConfirm:()=>{
            if(!current()||panelScope.current!==renderedPanel||manualQuestion.current!==token||manualBackBlocked.current
              ||panelWrite.current||!manualEdits.current.dirty||manualEdits.current.revision!==revision)return;
            closeEditor();
          }});
        return;
      }
      closeEditor();return;
    }
    if(panel!=='chat'){if(!editor.busy&&!panelWrite.current){if(panel==='availability')closeEditor();else showPanel('chat');}return;}
    leave(()=>router.canGoBack()?router.back():router.replace('/profil/radnik'));
  };
  const manualBack=useRef({panel,back});manualBack.current={panel,back};
  useFocusEffect(useCallback(()=>{
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(manualBack.current.panel!=='manual'||!focus.current||!active.current||!owns())return false;
      // Android's keyboard consumes its own Back first; only a delivered JS
      // event asks to leave the form. Processing/unknown outcomes consume it too.
      manualBack.current.back();return true;
    });return()=>subscription.remove();
  },[owns]));
  const refresh=()=>{if(current()&&!editor.busy&&!voiceBusy){
    if(manualQuestion.current){manualQuestion.current=null;retireConfirmation();}
    void editor.refresh();
  }};
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
  const review=async(activate=data?.profileStatus==='DRAFT')=>{
    if(!canAct()||!enabled||!writable||!data)return;
    await savePanel(async()=>{
      // The review is made of the proposal as it stands, so the name goes into the proposal first (one patch, then the same prepare).
      let at={conversationId:data.conversationId,revision:data.revision};
      const name=rename(data);
      if(name){const named=await api.patch(data.conversationId,data.revision,name);
        if(!current())return unavailable();if(!named.ok)return named;
        at={conversationId:named.podatak.conversationId,revision:named.podatak.revision};}
      const prepared=await api.prepare(at.conversationId,at.revision,activate);
      if(!current())return unavailable();if(!prepared.ok)return prepared;
      const next=await read();if(next.ok&&current())showPanel('review');return next;
    });
  };
  // `thenReview`: the change was made from the review. Its frozen content belongs to the old revision, so the change is
  // followed by a fresh review of the new proposal (the same prepare, in the same single flight), and the person lands on it.
  const patch=async(value:WorkerAiPatch,thenReview=false)=>{
    if(!canAct()||!enabled||!writable||!data)return;
    const activate=data.review?.activate??data.profileStatus==='DRAFT';
    // Any change of the proposal puts the account's name into it too, while it carries another.
    const body=value.displayName===undefined?{...value,...rename(data)}:value;
    await savePanel(async()=>{const result=await api.patch(data.conversationId,data.revision,body);
      if(!current())return unavailable();
      if(!result.ok)return result;
      saveKey.current=null;
      if(!thenReview){showPanel('chat');return result;}
      const prepared=await api.prepare(result.podatak.conversationId,result.podatak.revision,activate);
      if(!current())return unavailable();if(!prepared.ok)return prepared;
      const next=await read();if(next.ok&&current())showPanel('review');return next;});
  };
  const save=async()=>{
    const reviewed=data?.review;if(!canAct()||!enabled||!writable||reviewNeedsRestart||!data||!reviewed||!reviewed.canAccept||reviewed.revision!==data.revision||Date.parse(reviewed.expiresAt)<=Date.now())return;
    if(saveKey.current?.reviewId!==reviewed.reviewId)saveKey.current={reviewId:reviewed.reviewId,key:noviUuidZahtevId()};
    const key=saveKey.current.key;
    await savePanel(async()=>{const saved=await api.save(reviewed,key);if(!current())return unavailable();
      const result=await read();if(!current())return unavailable();
      if(result.ok&&result.podatak.saved?.reviewId===reviewed.reviewId)return result;
      // A retired-field review may be rejected although its older source hash
      // still matches. Keep that refusal scoped to this review through a read;
      // never silently alter its frozen content or relax uncertain-write guards.
      if(!saved.ok&&saved.kod==='WORKER_AI_STALE')setRejectedReviewId(reviewed.reviewId);
      return saved.ok?result:saved;});
  };
  const restart=()=>{
    if(!canAct()||voiceBusy||!data)return;
    confirmSheet.ask({title:'Pokrenuti nov razgovor?',message:'Predlog iz ovog razgovora ostaje u istoriji. Novi razgovor kreće od sačuvanog profila.',
      cancelLabel:'Nastavi ovaj razgovor',confirmLabel:'Novi razgovor',onConfirm:()=>{
        // Returned so the confirmation waits on the command it started instead of closing before it is sent.
        if(!canAct()||voiceBusy)return;return editor.save(async()=>{
          // Completed conversations stay completed on the server. Reconcile their
          // journal before leaving, without issuing another abandon command.
          if(data.status==='OPEN'){
            const result=await api.abandon(data.conversationId);if(!current())return unavailable();
            if(!result.ok)return result;
          }
          const confirmed=await read();if(!current())return unavailable();
          if(confirmed.ok&&(confirmed.podatak.status==='ABANDONED'||confirmed.podatak.status==='COMPLETED')&&!pending.current)
            router.replace('/profil/razgovor');return confirmed;});
      }});
  };
  const statusCopy=data?.saved?'Profil je sačuvan.':data?.status!=='OPEN'?'Ovaj razgovor je završen.':data.stale?'Sačuvani profil je promenjen. Novi razgovor će početi od tih podataka.':
    data.safety==='BLOCK'||data.safety==='REVIEW'?'Ovaj predlog trenutno ne može da se sačuva.':awaiting?turn?.state==='UNKNOWN_OUTCOME'?
      'Ne znamo da li je prethodna poruka stigla. Proveri to; poruka se neće poslati dvaput.':'AI još obrađuje poruku. Proveri stanje.':pending.current?'Proveri prethodno slanje. Novi unos i pregled su dostupni kada potvrdimo ishod.':
      recovery?.cancelled&&recovery.providerDispatched?'Odgovor je zaustavljen. Poruka je ipak poslata jer je asistent već počeo da je obrađuje; profil je ostao isti.':null;
  if(leaving||!data||!foreground||resuming)return <WorkerProfileFrame back={back}><WorkerProfileStatus loading={leaving||editor.loading||!foreground||resuming}
    error={leaving?null:editor.error} retry={refresh}/>{!leaving&&foreground&&!resuming?confirmSheet.sheet:null}</WorkerProfileFrame>;
  const busyPanelCopy=editor.busy?<T accessibilityRole="alert" variant="meta" tone="muted">Sačekaj potvrdu pre povratka u razgovor.</T>
    :panel==='manual'&&editor.uncertain?<T accessibilityRole="alert" variant="meta" tone="muted">Prvo proveri ishod izmene, pa se vrati u razgovor.</T>:null;
  // The form owns its scroll and sticky save controls. A scrolling profile frame with a fixed
  // minimum height left those controls below a second scroll on smaller Android screens.
  if(panel==='availability')return <CalendarScreen title="Dostupnost za rad" back={back} scroll={false}
    footer={<>{busyPanelCopy}{editor.error?<T accessibilityRole="alert">{editor.error}</T>:null}
      <V2Action tone="neutral" label="Proveri razgovor" onPress={refresh} disabled={editor.busy}/></>}>
    <AvailabilityForm availability={data.candidate.availability} busy={editor.busy} uncertain={editor.uncertain} refreshing={editor.loading} candidateMode
      onSave={value=>{if(canAct()&&enabled)void patch(workerAvailabilityPatch(data.candidate.availability,value),origin.current==='review');}}/>
  </CalendarScreen>;
  if(panel==='manual')return <WorkerProfileFrame back={back} title={part?WORKER_PART_TITLE[part]:undefined}>
    {manualDraftConflict?<T accessibilityRole="alert">Predlog profila je promenjen. Tvoj unos je zadržan, ali ove izmene više ne mogu da se primene.</T>:null}
    <WorkerAiManual key={`${data.revision}:${part??''}`} profile={data.candidate} only={part??undefined} disabled={!enabled||manualDraftConflict}
      initialDraft={manualEdits.current.dirty?manualEdits.current.value??undefined:undefined}
      apply={value=>{if(!manualDraftConflict)void patch(value,origin.current==='review');}} onDraftChange={manualChanged}/>
    {manualDraftConflict?<V2Action tone="neutral" label="Odbaci izmene i nastavi" kind="quiet" disabled={manualBackBlocked.current||panelWrite.current} onPress={back}/>:null}
    {busyPanelCopy}{editor.error?<T accessibilityRole="alert">{editor.error}</T>:null}
    <V2Action tone="neutral" label="Proveri razgovor" onPress={refresh} disabled={editor.busy}/>{confirmSheet.sheet}</WorkerProfileFrame>;
  if(panel==='review'&&data.review){const frozen=data.review,
    // The account got its name (in "Lični podaci") while this review still says it is missing: a fresh review puts it in.
    nameAdded=frozen.missingRequired.includes('Ime')&&!!accountName,
    expired=Date.parse(frozen.expiresAt)<=Date.now()||frozen.revision!==data.revision||nameAdded;
    // "Izmeni" at a part opens that part's editor and comes back to a fresh review (see `patch`).
    const editPart=(next:WorkerAiPart)=>{
      if(!canAct()||!enabled||!writable||data.saved||expired||reviewNeedsRestart)return;
      if(next==='time')showPanel('availability',{from:'review'});else showPanel('manual',{part:next,from:'review'});
    };
    return <WorkerProfileFrame back={back} title="Tvoj radni profil" footer={data.saved?<V2Action label="Otvori sačuvani profil" onPress={()=>leave(()=>router.replace('/profil/radnik'))} style={brandAction}/>:<>
      <V2Action label={editor.busy?'Čuvamo profil…':frozen.activate?'Sačuvaj i aktiviraj profil':'Sačuvaj profil'}
        disabled={!enabled||!writable||reviewNeedsRestart||!frozen.canAccept||expired} onPress={()=>{void save();}} style={brandAction}/>
      <V2Action tone="neutral" label="Nazad na razgovor" disabled={editor.busy} onPress={back}/>
      {(expired||editor.uncertain||editor.error)?<V2Action tone="neutral" label="Proveri stanje" onPress={refresh} disabled={editor.busy}/>:null}
    </>}>
      {data.saved?<T accessibilityRole="alert" variant="title" style={{color:sys.color.green}}>Profil je sačuvan{data.saved.profileStatus==='ACTIVE'?' i aktivan':''}.</T>:null}
      <WorkerAiReviewDetails review={frozen} onEdit={data.saved?undefined:editPart} editDisabled={!enabled||!writable||expired||reviewNeedsRestart}
        onAddName={data.saved||expired?undefined:()=>leave(()=>router.push('/profil/podaci'))}/>
      {/* Owner 2026-10-07: the interview ends by saying what it is for, as a fixed line (no extra AI call, no server change). */}
      {!data.saved?<WorkerAiNotificationsNote/>:null}
      {busyPanelCopy}
      {/* The save button below is grey for one of these reasons; the details above name a missing field themselves. */}
      {!data.saved&&(expired||!writable)?<T variant="meta" tone="muted">{expired?'Ovaj pregled više ne važi. Učitaj novi pregled pre čuvanja.':statusCopy??'Ovaj predlog trenutno ne može da se sačuva.'}</T>:null}
      {data.profileStatus==='DRAFT'&&!data.saved?<WorkerAiActivation activate={frozen.activate} disabled={!enabled} change={value=>{void review(value);}}/>:null}
      {expired&&!data.saved?<V2Action tone="neutral" label="Učitaj novi pregled" disabled={!enabled} onPress={()=>{void review(frozen.activate);}}/>:null}
      {editor.error?<T accessibilityRole="alert" tone="danger">{editor.error}</T>:null}
      {reviewNeedsRestart?<>
        <T variant="note" tone="muted">{editor.uncertain?'Proveri stanje, pa otvori nov razgovor.':'Ovaj predlog više ne može da se sačuva. Novi razgovor kreće od tvog sačuvanog profila.'}</T>
        <V2Action tone="neutral" label="Novi razgovor" disabled={!enabled} onPress={restart}/>
      </>:null}
      {confirmSheet.sheet}
    </WorkerProfileFrame>;
  }
  // Editing by hand and the week are "sometimes" actions: they live behind "···", not at the end of every conversation.
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
  const hasProfileContent = data.messages.some(message => message.role === 'USER')
    || data.candidate.skills.length > 0 || data.candidate.tools.length > 0
    || data.candidate.vehicles.length > 0 || data.candidate.bio.trim().length > 0;
  // The "+" of the composer (M1): the parts of the profile, each opening its own editor, for a person who would rather give a
  // part directly than say it. It changes nothing by itself; "Primeni na pregled profila" in the editor does (one patch).
  const openPart=(next:WorkerAiPart)=>{
    if(!canAct()||!enabled||!writable)return;
    if(next==='time')showPanel('availability');else if(next!=='identity')showPanel('manual',{part:next});
  };
  return <><AiConversationShell conversationKey={data.conversationId} title="Radni profil" questionFocus
    newConversation={{ onPress: restart, disabled: !canAct() || voiceBusy }}
    closed={!!data.saved || data.status !== 'OPEN'}
    attach={writable?{label:'Dodaj podatke',hint:'Veštine, područje, vreme, alat i vozilo.',disabled:!enabled,
      onPress:()=>{if(current()&&panelScope.current===renderedPanel)setAdding(true);}}:undefined}
    card={compact=>hasProfileContent?<WorkerAiCard profile={data.candidate} compact={compact} disabled={!enabled||!writable}
      showReview={writable&&!data.saved} reviewReason={!enabled?unavailableNow:undefined} review={()=>{void review();}}/>:null}
    messages={data.messages.map(m=>({id:m.id,fromAi:m.role==='ASSISTANT',body:m.body}))}
    welcome={hasProfileContent?'Šta želiš da dopuniš?':'Koje zadatke želiš da preuzimaš?'}
    welcomeDetail={hasProfileContent?'Reci šta želiš da promeniš. Sve izmene pregledaš pre čuvanja.':'Reci šta želiš da radiš — stručne zadatke ili svakodnevnu pomoć, poput dostave i nošenja stvari.'}
    placeholder="Opiši šta radiš"
    value={input} onChange={value=>{if(canAct()&&enabled&&writable){draftRevision.current+=1;draftText.current=value;setInput(value);}}} canEdit={!!enabled&&!!writable&&!pending.current}
    canSend={!!enabled&&!!writable&&!!input.trim()&&!pending.current} pending={!!pending.current} busy={editor.busy} streamingText={stream}
    // What was just sent and is not yet read back stays on screen (review r4 ra item 2): without it, voice mode fell
    // back to the previous exchange and showed the old answer as the reply to what was just said. A recovered intent
    // has no text (storage holds only ids), and then nothing is shown. Once the read holds it, the thread shows it once.
    sentMessage={unread}
    onSend={()=>{if(!voiceBusy)void send(input.trim(),{value:input,revision:draftRevision.current});}} onBack={back} onOptions={writable?()=>{if(current()&&panelScope.current===renderedPanel)setMenu(true);}:undefined}
    // A fragment is truthy even when empty, which drew an empty recovery panel in the thread; the slot is filled only
    // when there is something to say.
    status={statusCopy||editor.error?<>{statusCopy?<T variant="meta" tone="muted">{statusCopy}</T>:null}
      {editor.error?<T accessibilityRole="alert" variant="meta" tone="danger">{editor.error}</T>:null}</>:undefined}
    // The shell draws the microphone, its notice and voice mode from this one controller; every transcript comes back
    // through `onTranscript` above.
    voice={writable?{controller:voice.controller,state:voice.state,disabled:!enabled||!!pending.current,onKeepText:keepTranscript}:undefined}
    actions={<>
      {/* After a save the only next step is the saved profile; a second "check" button beside it read as unfinished. */}
      {(pending.current||awaiting||editor.uncertain||editor.error)&&!data.saved?<V2Action tone="neutral" label="Proveri razgovor" disabled={editor.busy||voiceBusy} onPress={refresh}/>:null}
      {pending.current&&recovery?.canCancel?<>
        <T variant="meta" tone="muted">Ako odustaneš, odgovor asistenta neće promeniti profil. Ako je asistent već počeo da odgovara, poruka je ipak poslata.</T>
        <V2Action tone="neutral" label={recovery.providerDispatched?'Odustani od odgovora':'Otkaži prethodno slanje'} kind="quiet"
          disabled={!canAct()||voiceBusy} onPress={()=>{void cancelPending();}}/>
      </>:null}
      {pending.current?.text&&recovery?.retryAllowed?<V2Action tone="neutral" label="Pošalji ponovo" disabled={!canAct()||voiceBusy} onPress={()=>{if(pending.current?.text)void send(pending.current.text);}}/>:null}
      {data.saved?<V2Action label="Otvori sačuvani profil" onPress={()=>leave(()=>router.replace('/profil/radnik'))} style={brandAction}/>:null}
    </>}/>{confirmSheet.sheet}
    {menu?<ActionSheet label="Opcije profila" onClose={()=>setMenu(false)} actions={[
      {key:'manual',label:'Ručno uredi podatke',icon:'document',disabled:!enabled||!writable,subtitle:unavailableNow,
        onPress:()=>{if(canAct()&&enabled&&writable)showPanel('manual');}},
      {key:'week',label:'Uredi nedelju i posebne datume',icon:'calendar',disabled:!enabled||!writable,subtitle:unavailableNow,
        onPress:()=>{if(canAct()&&enabled&&writable)showPanel('availability');}},
    ]}/>:null}
    {adding?<ActionSheet label="Dodaj podatke" onClose={()=>setAdding(false)} actions={([
      ['skills','tasks'],['area','pin'],['time','clock'],['tools','tool'],
    ] as const).map(([key,icon])=>({key,icon,label:key==='area'?'Područje rada':WORKER_PART_TITLE[key],disabled:!enabled||!writable,subtitle:unavailableNow,
      onPress:()=>openPart(key)}))}/>:null}</>;
}
