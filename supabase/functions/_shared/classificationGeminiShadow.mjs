// Shared Gemini classification SHADOW projection for both AI interviews.
// No DB writes, user-facing changes, matching or notification authority.
// The existing worker/need typed JSON contract is preserved byte-for-byte
// AFTER removing the optional, never-authoritative classificationShadow field.
import { CLASSIFICATION_ACTIONS, reviewClassificationProposal, normalizedClassificationIdentity } from './classificationEngine.mjs';
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const modes=new Set(['ON_SITE','REMOTE','UNCONFIRMED']);
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sane=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max&&!/[<>\u0000-\u001f]/.test(v);
const maxServices=purpose=>purpose==='WORKER_CAPABILITY'?12:6;
const shadowField='classificationShadow';

/** Extend the existing Gemini JSON schema without changing the old required
 * payload or permitting arbitrary provider fields. OFF => original schema.
 * An empty list is safe and preferable when the speaker did not specify work.
 */
export function withGeminiClassificationShadowSchema(baseSchema,purpose='NEED_SERVICE') {
  if(!record(baseSchema)||!record(baseSchema.properties)||baseSchema.type!=='OBJECT'
      ||Object.hasOwn(baseSchema.properties,shadowField))throw new Error('SHADOW_SCHEMA_INVALID');
  const string={type:'STRING'};
  const item={
    type:'OBJECT',additionalProperties:false,
    properties:{
      service:string,
      mode:{type:'STRING',enum:['ON_SITE','REMOTE','UNCONFIRMED']},
      action:{type:'STRING',enum:CLASSIFICATION_ACTIONS.slice()},
      categoryId:string, // '' for none, never fabricate UUID
      parentId:string, // '' for none; new nodes require review
      proposedPath:{type:'ARRAY',items:string,maxItems:6},
      reason:string,
      catalogVersion:{type:'INTEGER'},
    },
    required:['service','mode','action','categoryId','parentId','proposedPath','reason','catalogVersion'],
  };
  return {...baseSchema,properties:{...baseSchema.properties,
    [shadowField]:{type:'ARRAY',maxItems:maxServices(purpose),items:item}}};
}

export function geminiClassificationShadowInstruction(purpose='NEED_SERVICE') {
  return [
    purpose==='WORKER_CAPABILITY'
      ? 'Additional OPTIONAL output classificationShadow: a FULL SNAPSHOT (0 to 12) of services the person currently offers, after applying your patch to the existing candidate, not just newly-mentioned activities. Use EXACT service strings that the updated skills list contains; never invent work. This is non-authoritative classification metadata.'
      : 'Additional OPTIONAL output field classificationShadow: 0 to 6 SEMANTIC SERVICE proposals for the CURRENT task turn; never fabricate work.',
    'Do not change safety/assistantMessage/facts/patch/dialogue. This extra field is PRIVATE, never user consent or catalog authority.',
    'Each item must have exactly service, mode, action, categoryId, parentId, proposedPath, reason, catalogVersion.',
    'Use catalogVersion from provided server context. For reuse: exact real categoryId, parentId="", proposedPath=[].',
    'For missing service: CREATE_CHILD with verified existing parentId and proposedPath of NEW descendant labels; or CREATE_NEW_BRANCH with parentId=""; never write.',
    'Never equate lessons, equipment rental and equipment repair merely because they mention skating.',
    'REUSE_ALIAS is only a suggested semantic candidate; no alias is verified by a model claim.',
    'Mode ON_SITE/REMOTE only if explicit or inherent to the service; otherwise UNCONFIRMED. Separate every service; both modes must be explicitly confirmed later.',
    purpose==='WORKER_CAPABILITY'
      ? 'On a finish/acknowledgement turn with no changed skills, KEEP classificationShadow for the unchanged services, using earlier EXPLICIT delivery preferences or an inherent physical/online mode. For a service with truly unclear delivery mode, ask ONE natural clarifying question and mark it UNCONFIRMED; do not guess mode, silently omit an existing service, or add it to skills. This is not a new consent step.'
      : 'If no clear service, no safe classification, or the input is an acknowledgement/finish/map reply: return classificationShadow: [].',
    'Questions, unknown modes, unsafe, regulated and possible duplicates are review-only; category membership never proves worker capability.',
  ].join(' ');
}

function validItem(p,snapshot) {
  if(!record(p)||Object.keys(p).length!==8 ||
    !['service','mode','action','categoryId','parentId','proposedPath','reason','catalogVersion'].every(k=>Object.hasOwn(p,k))
    ||!sane(p.service,3,120)||!modes.has(p.mode)||!CLASSIFICATION_ACTIONS.includes(p.action)
    ||typeof p.categoryId!=='string'||(p.categoryId!==''&&!UUID.test(p.categoryId))
    ||typeof p.parentId!=='string'||(p.parentId!==''&&!UUID.test(p.parentId))
    ||!Array.isArray(p.proposedPath)||p.proposedPath.length>6||
      !p.proposedPath.every(x=>sane(x,3,120))
    ||!sane(p.reason,10,1000)||!Number.isSafeInteger(p.catalogVersion)
    )return false;
  if(['REUSE_EXISTING','REUSE_ALIAS'].includes(p.action))
    return !!p.categoryId&&p.parentId===''&&p.proposedPath.length===0;
  if(p.action==='CREATE_CHILD')return !!p.parentId&&p.categoryId===''&&p.proposedPath.length>0;
  if(p.action==='CREATE_NEW_BRANCH')return p.categoryId===''&&p.parentId===''&&p.proposedPath.length>0;
  if(p.action==='PROPOSE_RESTRUCTURE')return p.categoryId===''&&p.proposedPath.length>0;
  return p.categoryId===''&&p.parentId===''&&p.proposedPath.length===0;
}

/** Called BEFORE old strict model parser. Invalid optional shadow is dropped
 * rather than causing an extra paid LLM turn; original answer remains unchanged.
 * The statuses are safe telemetry; never log service text, IDs, review info.
 * reviewProposals are untrusted Gemini HINTS, never signed review consent,
 * admission plans, save receipts, active capabilities or push eligibility.
 */
export function inspectGeminiClassificationShadow(raw,snapshot,purpose) {
  if(!record(raw))return {output:raw,statuses:['MISSING_ENVELOPE'],reviewProposals:[]};
  const {[shadowField]:shadow,...output}=raw;
  if(!Object.hasOwn(raw,shadowField))return {output,statuses:[],reviewProposals:[]};
  if(!Array.isArray(shadow)||shadow.length>maxServices(purpose))return {output,statuses:['INVALID_BATCH'],reviewProposals:[]};
  if(raw.safety==='BLOCK'||raw.safety==='REVIEW')
    return {output,statuses:shadow.length?['SAFETY_INTERVIEW_REVIEW']:[],reviewProposals:[]};
  if(!record(snapshot)||!Array.isArray(snapshot.categories)||!Number.isSafeInteger(snapshot.catalogVersion))
    return {output,statuses:['INVALID_CATALOG'],reviewProposals:[]};
  const seen=new Set(), statuses=[], reviewProposals=[];
  const workerModes=new Map();
  for(const p of shadow){
    if(!validItem(p,snapshot)){statuses.push('INVALID_PLAN');continue;}
    const signature=normalizedClassificationIdentity(p.service);
    // A single offered service can legitimately support BOTH ON_SITE and REMOTE.
    // Two copies of the same service+mode (including Cyrillic/Latin synonyms)
    // are still duplicates. Requester tasks cannot declare multiple modes.
    const identity=purpose==='WORKER_CAPABILITY'?signature+'|'+p.mode:signature;
    const oldModes=workerModes.get(signature)??new Set();
    if(seen.has(identity) || (purpose==='WORKER_CAPABILITY' &&
      ((p.mode==='UNCONFIRMED'&&oldModes.size>0)||oldModes.has('UNCONFIRMED')))){
      statuses.push('DUPLICATE_SERVICE');continue;
    }
    seen.add(identity);
    if(purpose==='WORKER_CAPABILITY'){oldModes.add(p.mode);workerModes.set(signature,oldModes);}
    const checked=reviewClassificationProposal(
      {purpose,service:p.service,mode:p.mode==='UNCONFIRMED'?null:p.mode},
      snapshot,{action:p.action,categoryId:p.categoryId||undefined,
        parentId:p.parentId||null,proposedPath:p.proposedPath,
        reason:p.reason,catalogVersion:p.catalogVersion});
    if(checked.accepted && p.mode==='UNCONFIRMED') statuses.push('MODE_UNCONFIRMED');
    else if(checked.accepted && p.action==='REUSE_ALIAS') statuses.push('ALIAS_NOT_VERIFIED');
    else statuses.push(checked.status);
    // A validated hint can be retained for LATER independent source/owner
    // binding, but never becomes an accepted admission plan or worker consent.
    // Only real canonical IDs or an existing reviewed parent may be retained.
    if (p.mode !== 'UNCONFIRMED' &&
        (checked.status === 'REUSE_CANDIDATE' && p.action === 'REUSE_EXISTING' ||
         checked.status === 'ADMISSION_REVIEW_REQUIRED' && p.action === 'CREATE_CHILD')) {
      reviewProposals.push({
        service:p.service,mode:p.mode,action:p.action,categoryId:p.categoryId,
        parentId:p.parentId,proposedPath:p.proposedPath.slice(),
        reason:p.reason,catalogVersion:p.catalogVersion,
      });
    }
  }
  return {output,statuses,reviewProposals};
}
