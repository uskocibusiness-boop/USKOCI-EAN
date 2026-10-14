// Gate A source-only OWNER REVIEW projection. No database / dispatch authority.
// Caller MUST supply authoritative current worker skills or reviewed Need category,
// explicit owner-selected mode per service (never inferred), and full versioned catalog.
// The result is a plan candidate for the canonical server review builder to sign.
// It is NOT consent until the actual UI displays it and the existing Save succeeds.
import { normalizedClassificationIdentity as norm } from './classificationEngine.mjs';
const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const modes=new Set(['ON_SITE','REMOTE']);
const sha=/^[0-9a-f]{32}$/;
const label=v=>typeof v==='string'&&v.length>=3&&v.length<=120&&!/[<>\u0000-\u001f]/.test(v);
function fail(code) {
  return Object.freeze({status:code,classificationCandidates:[],reviewedServiceModes:[],
    visibleServices:[],classificationCatalogVersion:null,classificationCatalogFingerprint:null});
}
function normalizedNames(items) {
  if(!Array.isArray(items)||items.length<1||items.length>12||!items.every(label))return null;
  const keys=items.map(norm);
  if(keys.some(x=>!x)||new Set(keys).size!==keys.length)return null;
  return keys;
}
// The strict batch admission accepts only these minimal plan keys, not the
// raw Gemini categoryId:'' / parentId:'' / proposedPath:[] shape.
function planFor(service,mode,hint,byId,version) {
  const reason=hint?.reason;
  if(!record(hint)||!label(hint.service)||norm(hint.service)!==norm(service)
    ||hint.mode!==mode||hint.catalogVersion!==version
    ||typeof reason!=='string'||reason.length<10||reason.length>1000)return null;
  if(hint.action==='REUSE_EXISTING') {
    const node=byId.get(hint.categoryId);
    if(!node||norm(node.label)!==norm(service)||!node.modes?.includes(mode)
      ||hint.parentId!==''||!Array.isArray(hint.proposedPath)||hint.proposedPath.length!==0)return null;
    return {action:'REUSE_EXISTING',service,mode,categoryId:node.id,reason,catalogVersion:version};
  }
  // Parent existence alone does not clear safety or regulated-service policy;
  // preserve novel proposals but require independent server risk admission.
  return null;
}
/** @param {{
 * purpose:'WORKER_CAPABILITY'|'NEED_SERVICE', visibleServices:string[],
 * explicitServiceModes?:Array<{service:string,mode:'ON_SITE'|'REMOTE'}>,
 * needMode?:'ON_SITE'|'REMOTE',
 * catalog:{catalogVersion:number,categories:Array<{id:string,label:string,modes:string[]}>},
 * catalogFingerprint:string, hints:Array<object>
 * }} request */
export function buildOwnerClassificationProjection(request) {
  if(!record(request)||!['WORKER_CAPABILITY','NEED_SERVICE'].includes(request.purpose))
    return fail('INVALID_SOURCE');
  const names=request.visibleServices,normalized=normalizedNames(names);
  if(!normalized)return fail('INVALID_SERVICE_LIST');
  const c=request.catalog;
  if(!record(c)||!Number.isSafeInteger(c.catalogVersion)||c.catalogVersion<1
    ||!Array.isArray(c.categories)||!sha.test(request.catalogFingerprint))
    return fail('CATALOG_UNAVAILABLE');
  if(!Array.isArray(request.hints)||request.hints.length>30)return fail('HINTS_UNAVAILABLE');
  const byId=new Map(c.categories.map(x=>[x.id,x]));
  const selected=[];
  if(request.purpose==='WORKER_CAPABILITY'){
    if(!Array.isArray(request.explicitServiceModes)||request.explicitServiceModes.length<1
      ||request.explicitServiceModes.length>24)return fail('SERVICE_MODE_CONFIRMATION_REQUIRED');
    const seen=new Set();
    for(const choice of request.explicitServiceModes) {
      if(!record(choice)||!label(choice.service)||!modes.has(choice.mode)
        ||!normalized.includes(norm(choice.service)))return fail('MODE_NOT_IN_PROFILE');
      const key=norm(choice.service)+'|'+choice.mode;
      if(seen.has(key))return fail('DUPLICATE_MODE');
      seen.add(key);
      selected.push({service:names[normalized.indexOf(norm(choice.service))],mode:choice.mode});
    }
    if(normalized.some(key=>!selected.some(ch=>norm(ch.service)===key)))
      return fail('SERVICE_MODE_CONFIRMATION_REQUIRED');
  }else {
    if(names.length!==1||!modes.has(request.needMode))
      return fail('NEED_MODE_UNCONFIRMED');
    selected.push({service:names[0],mode:request.needMode});
  }
  const plans=[];
  for(const {service,mode} of selected){
    const matching=request.hints.filter(h=>record(h)&&label(h.service)&&norm(h.service)===norm(service)&&h.mode===mode);
    // Duplicate model hints for the same meaning are unsafe, not a reason to
    // silently pick the most convenient canonical ID.
    if(matching.length>1)return fail('AMBIGUOUS_CANDIDATES');
    let plan=matching.length===1?planFor(service,mode,matching[0],byId,c.catalogVersion):null;
    if(matching.length===1&&!plan)return fail('SEMANTIC_OR_POLICY_REVIEW_REQUIRED');
    if(!plan){
      // Deterministic exact canonical fallback only, no synonym guess/parent inheritance.
      const exact=c.categories.filter(n=>norm(n.label)===norm(service)&&n.modes?.includes(mode));
      if(exact.length!==1)return fail('PENDING_CLASSIFICATION');
      plan={action:'REUSE_EXISTING',service,mode,categoryId:exact[0].id,
        reason:'Server exact canonical service identity',catalogVersion:c.catalogVersion};
    }
    plans.push(plan);
  }
  return Object.freeze({status:'READY',classificationCandidates:plans,
    reviewedServiceModes:request.purpose==='WORKER_CAPABILITY'?selected:[],
    visibleServices:selected,classificationCatalogVersion:c.catalogVersion,
    classificationCatalogFingerprint:request.catalogFingerprint});
}
