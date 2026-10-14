// USKOCI P1.5: one proposal envelope for MANY reviewed service claims.
// The batch planner NEVER writes to the catalog, worker profile, need or push.
// It is deliberately not an atomic SQL commit implementation.
import { reviewClassificationProposal } from './classificationEngine.mjs';
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const key=x=>typeof x==='string'?x.normalize('NFKC').toLocaleLowerCase('sr').trim().replace(/\s+/g,' '):'';
const purposes=new Set(['WORKER_CAPABILITY','NEED_SERVICE']);
const scopes=new Set(['ON_SITE','REMOTE']);
const safeDefault=Object.freeze({capabilityAuthority:'NONE',notificationAuthority:'NONE',
  commitAuthority:'NONE',requiresOwnerReview:true,requiresAtomicBatch:true});

export function reviewClassificationBatch(entries,snapshot,{maxServices=100}={}){
  if(!record(snapshot)||!Number.isSafeInteger(snapshot.catalogVersion)||snapshot.catalogVersion<1||
    !Array.isArray(snapshot.categories)||!Number.isInteger(maxServices)||maxServices<1||maxServices>100||
    !Array.isArray(entries)||entries.length===0||entries.length>maxServices)
    return {...safeDefault,accepted:false,status:'INVALID_OR_OVERSIZE_BATCH',items:[]};
  const results=[],seenService=new Set(),seenCategory=new Set();let duplicate=false,stale=false,review=false;
  for(let i=0;i<entries.length;i++){
    const entry=entries[i];
    if(!record(entry)||!purposes.has(entry.purpose)||!record(entry.plan)||
      !key(entry.service)||!(entry.mode==null||scopes.has(entry.mode))){
      results.push({index:i,status:'INVALID_ITEM',candidateCategoryId:null});review=true;continue;
    }
    const outcome=reviewClassificationProposal({
      purpose:entry.purpose,service:entry.service,mode:entry.mode??null,
    },snapshot,entry.plan);
    const item={index:i,status:outcome.status,candidateCategoryId:outcome.categoryId||null};
    const serviceKey=entry.purpose+'|'+key(entry.service)+'|'+(entry.mode||'UNCONFIRMED');
    const identityKey=outcome.categoryId&&entry.purpose+'|'+outcome.categoryId+'|'+(entry.mode||'UNCONFIRMED');
    if(seenService.has(serviceKey)||(identityKey&&seenCategory.has(identityKey))){
      item.status='DUPLICATE_SERVICE_OR_IDENTITY';duplicate=true;review=true;
    }
    seenService.add(serviceKey);if(identityKey)seenCategory.add(identityKey);
    if(outcome.status==='STALE_CATALOG')stale=true;
    if(!outcome.accepted||entry.mode==null||entry.plan.action==='REUSE_ALIAS'){
      if(outcome.accepted&&entry.mode==null)item.status='MODE_CONFIRMATION_REQUIRED';
      else if(outcome.accepted&&entry.plan.action==='REUSE_ALIAS')item.status='ALIAS_EVIDENCE_REQUIRED';
      review=true;
    }
    results.push(item);
  }
  const status=stale?'STALE_CATALOG':duplicate?'DUPLICATE_SERVICE_OR_IDENTITY':
    review?'REVIEW_REQUIRED':'CANDIDATES_ONLY';
  // Even all-green semantic candidates are NOT approved catalog/skill/need writes.
  return {...safeDefault,accepted:false,status,catalogVersion:snapshot.catalogVersion,items:results};
}
