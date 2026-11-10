import { useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore } from 'react';
import { AppState,type ViewToken } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router,useFocusEffect } from 'expo-router';
import { useSesija,sesijaSada } from '../../store/sesija';

import { groupBody,normalizeGroupBody,type GroupMessage } from '../../data/groupConversationService';
import { createGroupConversationDraft } from '../../data/groupConversationDraft';
import { GroupConversationController,initialGroupState } from './GroupConversationController';
import { GroupConversationPresentation } from './GroupConversationPresentation';
import { privateConversationChoices } from './ConversationChannels';
import { ProfilePhoto } from '../media/ContextPhotos';
import { SupportContextEntry } from '../support/SupportContextEntry';
export function GroupConversationScreen({agreementId,fromInbox=false,initialTarget}:{agreementId:string;fromInbox?:boolean;initialTarget?:{groupId:string;messageId:string;sequence:string}}){
 const {user,accountRevision}=useSesija(),accountId=user?.id??'';
 const [state,setState]=useState(initialGroupState),[epoch,setEpoch]=useState(0),[generation,setGeneration]=useState(0),[showPeople,setShowPeople]=useState(false);
 const owner=useRef<object|null>(null),engine=useRef<GroupConversationController|null>(null);
 const draftModel=useMemo(()=>createGroupConversationDraft({accountId,agreementId,storage:AsyncStorage,
  owns:()=>sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===accountRevision}),[accountId,accountRevision,agreementId]);
 useEffect(()=>{draftModel.activate();return()=>draftModel.dispose();},[draftModel]);
 const draftState=useSyncExternalStore(draftModel.subscribe,draftModel.getSnapshot,draftModel.getSnapshot);
 const draft=state.context?.accountId===accountId&&state.context?.group?.groupId===draftState.groupId
  &&state.phase!=='ERROR'&&!['background','inactive'].includes(AppState.currentState)?draftState.text:'';
 useFocusEffect(useCallback(()=>{
  const scope={};owner.current=scope;setGeneration(x=>x+1);setState(initialGroupState);setShowPeople(false);
  const current=()=>owner.current===scope&&!['background','inactive'].includes(AppState.currentState)&&sesijaSada().user?.id===accountId
   &&sesijaSada().accountRevision===accountRevision;
  const controller=new GroupConversationController({agreementId,initialTarget,account:{accountId,accountRevision},current,storage:AsyncStorage,draft:draftModel});engine.current=controller;
  controller.subscribe(()=>{if(current())setState(controller.snapshot());});void controller.load();
  // Focus-scoped reads: no background traffic and no automatic write retries.
  const syncTimer=setInterval(()=>{if(current())void controller.syncLatest();},8000);
  let foreground=!AppState.currentState||AppState.currentState==='active';
  const listener=AppState.addEventListener('change',next=>{
   const nextForeground=next==='active';
   // Repeated native activity notifications are not a return from background.
   // Replacing this owner mid-send would strand its journal and lose the text.
   if(nextForeground===foreground)return;
   foreground=nextForeground;
   if(!foreground){controller.dispose();owner.current=null;setState(initialGroupState);}
   else setEpoch(x=>x+1);
  });
  return()=>{clearInterval(syncTimer);listener.remove();controller.dispose();if(owner.current===scope)owner.current=null;if(engine.current===controller)engine.current=null;setShowPeople(false);setState(initialGroupState);};
 },[agreementId,accountId,accountRevision,draftModel,epoch,initialTarget?.groupId,initialTarget?.messageId,initialTarget?.sequence]));
 const renderedOwner=owner.current,controller=engine.current;
 const current=()=>renderedOwner!==null&&owner.current===renderedOwner&&engine.current===controller&&controller?.snapshot()===state
  &&!['background','inactive'].includes(AppState.currentState)&&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===accountRevision;
 const invoke=(method:'refresh'|'older'|'acknowledge'|'managementNext')=>{if(current())void controller?.[method]();};
 const captured=!!state.journal&&draftState.capture?.clientRequestId===state.journal.clientRequestId
  &&draftState.capture?.bodySha256===state.journal.bodySha256;
 // Before the initial durable capture finishes the original field is held.
 // Once dispatch begins, a newer draft can be edited independently of it.
 const draftEditable=!!state.context?.group?.canSend&&draftState.loaded
  &&(['READY','UNKNOWN','CONFIRMED'].includes(state.phase)||(state.phase==='SENDING'&&captured));
 const change=(value:string)=>{if(current()&&draftEditable)draftModel.change(value);};
 const retry=state.phase==='UNKNOWN'&&state.canRetry;
 const onVisible=useMemo(()=>({viewableItems}:{viewableItems:ViewToken<GroupMessage>[]})=>{
  // The current controller owns the list; blur/background disposal suppresses
  // late callbacks. Only actually viewable message IDs enter the bounded RPC.
  if(renderedOwner!==null&&owner.current===renderedOwner&&engine.current===controller)void controller?.markVisible(viewableItems.filter(x=>x.isViewable).map(x=>x.item.messageId));
 },[renderedOwner,controller]);
 const viewability=useRef({viewAreaCoveragePercentThreshold:60,minimumViewTime:600}).current;
 const allowedPrivate=(id:string)=>current()&&!!state.context&&privateConversationChoices(state.context).some(choice=>choice.id===id);
 const openAgreement=(id:string)=>{if(allowedPrivate(id))router.push({pathname:'/dogovor/[id]',params:{id}});};
 const openPrivate=(id:string)=>{if(allowedPrivate(id))router.push({pathname:'/dogovor/[id]',params:{id,tab:'poruke'}});};
 // The conversation was opened from its Dogovor: back returns there, and only a cold start (no stack) opens it anew.
 const back=()=>{if(!current())return;if(router.canGoBack())router.back();else if(fromInbox)router.replace('/poruke');else router.replace({pathname:'/dogovor/[id]',params:{id:agreementId}});};
 const ready=state.phase==='READY',group=state.context?.group;
 const body=normalizeGroupBody(draft),capture=draftState.capture;
 const retryBody=retry&&capture&&!capture.confirmed&&capture.clientRequestId===state.journal?.clientRequestId
  &&capture.bodySha256===state.journal?.bodySha256?capture.body??undefined:undefined;
 return <GroupConversationPresentation state={state} draft={draft} draftLength={Array.from(body).length} draftSendable={!!groupBody(body)} draftEditable={draftEditable} draftError={draftState.error} draftSaving={draftState.saving} retryBody={retryBody} newerDraft={draftState.newerThanCapture} showPeople={showPeople} listKey={generation} viewability={viewability} onVisible={onVisible}
  onBack={back} backLabel={fromInbox?'Nazad na Poruke':'Nazad na Dogovor'} onTogglePeople={()=>{if(current())setShowPeople(x=>!x);}} onRefresh={()=>invoke('refresh')} onOlder={()=>invoke('older')}
  onManagementNext={()=>invoke('managementNext')} onOpenAgreement={openAgreement} onPrivate={openPrivate} onDraft={change} onAcknowledge={()=>invoke('acknowledge')}
  onSaveDraft={()=>{if(current()&&draftEditable)void draftModel.flush().catch(()=>undefined);}}
  onSend={()=>{if(current()){if(retry)void controller?.retry(draftModel.getSnapshot().text);else void controller?.send(draftModel.getSnapshot().text);}}}
  photo={(member,fallback)=><ProfilePhoto profileId={member.profileId} size={40} fallback={fallback}/>}
  support={group?item=><SupportContextEntry reference={{kind:'GROUP_MESSAGE',id:item.messageId,revision:null}} previewText={item.body}
   label="Izaberite ovu poruku za podršku" disabled={!ready}
   canAct={()=>current()&&ready&&state.messages.some(message=>message.messageId===item.messageId)}
   navigate={action=>{if(current()&&ready){owner.current=null;controller?.dispose();setState(initialGroupState);action();}}}/>:undefined}/>;
}
