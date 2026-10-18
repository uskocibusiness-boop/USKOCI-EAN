// Shared Gemini classification SHADOW projection for both AI interviews.
// No DB writes, user-facing changes, matching or notification authority.
// The existing worker/need typed JSON contract is preserved byte-for-byte
// AFTER removing the optional, never-authoritative classificationShadow field.
import { CLASSIFICATION_ACTIONS, reviewClassificationProposal, normalizedClassificationIdentity } from './classificationEngine.mjs';
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const modes=new Set(['ON_SITE','REMOTE','UNCONFIRMED']);
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sane=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max&&!/[<>\u0000-\u001f]/.test(v);
const maxServices=purpose=>purpose==='WORKER_CAPABILITY'?24:6;
const legacyShadowField='classificationShadow';
const shadowJsonField='classificationShadowJson';
const maxShadowJsonBytes=24576;

/** The old nested classificationShadow array made the already complex
 * interview responseSchema much larger. That experimental provider schema was
 * rejected with HTTP 400 on DEV. Keep the original typed interview contract and
 * request only one OPTIONAL STRING in the provider schema. The string contains
 * JSON metadata, parsed and independently validated below after completion.
 * The raw metadata never becomes an AI fact, owner consent, skill or category.
 * The older array envelope remains accepted for offline compatibility tests.
 */
export function withGeminiClassificationShadowSchema(baseSchema,purpose='NEED_SERVICE') {
  if(!record(baseSchema)||!record(baseSchema.properties)||baseSchema.type!=='OBJECT'
      ||Object.hasOwn(baseSchema.properties,legacyShadowField)
      ||Object.hasOwn(baseSchema.properties,shadowJsonField)
      ||!['NEED_SERVICE','WORKER_CAPABILITY'].includes(purpose))
    throw new Error('SHADOW_SCHEMA_INVALID');
  return {...baseSchema,properties:{...baseSchema.properties,
    [shadowJsonField]:{type:'STRING'}}};
}

export function geminiClassificationShadowInstruction(purpose='NEED_SERVICE') {
  return [
    purpose==='WORKER_CAPABILITY'
      ? 'Additional OPTIONAL classificationShadowJson STRING: serialize a JSON array containing a FULL SNAPSHOT (0 to 24 service+mode proposals, at most 12 services) of what this person currently offers AFTER applying the profile patch. Only propose services in the updated explicit skills; never invent a job.'
      : 'Additional OPTIONAL classificationShadowJson STRING: serialize a JSON array of 0 to 6 SEMANTIC SERVICE proposals for the CURRENT task turn; never fabricate work.',
    'The entire classificationShadowJson field is one JSON STRING, NOT a nested JSON array property. Serialize array entries as JSON inside that string, no markdown. Use the string "[]" when nothing is clear. This field is private metadata and never user consent or catalog write authority.',
    'Do not change assistantMessage, safety, facts, patch, dialogue or the other existing response fields. Never return the older classificationShadow array field.',
    'Each entry inside the serialized JSON array must contain exactly service, mode, action, categoryId, parentId, proposedPath, reason, catalogVersion.',
    'The action value MUST be exactly one of REUSE_EXISTING, REUSE_ALIAS, CREATE_CHILD, CREATE_NEW_BRANCH, PROPOSE_RESTRUCTURE, ASK_CLARIFICATION, NEEDS_REVIEW, REJECT_UNSUPPORTED_OR_UNSAFE. Do not use shorter words such as REUSE, EXISTING, NEW, or CREATE.',
    'Use catalogVersion from provided server context. If an existing category covers the service, use action REUSE_EXISTING, its exact real categoryId, parentId="", proposedPath=[].',
    'For a missing service: CREATE_CHILD with a real parentId from the supplied catalog in the confirmed mode, or CREATE_NEW_BRANCH with parentId="" only when no suitable parent exists. proposedPath contains 1 to 6 NEW labels, ordered from the parent toward the service; its final label must be exactly the service text. Intermediate labels may be included when useful. categoryId="" for either creation action. Give a concrete reason of 10 to 1000 characters; never write or claim a category was created.',
    'Never equate lessons, equipment rental and equipment repair merely because they mention skating.',
    'REUSE_ALIAS is only a suggested semantic candidate; no alias is verified by a model claim. Only aliases listed by the server for that exact category may be reused. Keep service equal to the actual offered skill or task service; do not replace the skill with a broader category label.',
    'Mode ON_SITE/REMOTE only if explicit or inherent to the service; otherwise UNCONFIRMED. Separate every service; both modes must be explicitly confirmed later.',
    purpose==='WORKER_CAPABILITY'
      ? 'After applying the profile patch, compare EACH distinct entry in the resulting skills array with classificationShadowJson. Cover EVERY offered skill with at least one proposal (ON_SITE, REMOTE, or UNCONFIRMED), even if it was added in an earlier turn; never return only the skills newly mentioned by the user. If both modes are explicitly confirmed, represent both modes separately. On a finish/acknowledgement turn with unchanged skills, KEEP a FULL SNAPSHOT of those same skills. When delivery mode for any service is unclear ask ONE short, natural follow-up question and mark that service UNCONFIRMED rather than omitting it or guessing; do not guess mode, create a fake skill or infer consent from city. When more than 12 services are offered, clarify/organize the list before classification instead of silently dropping services. Shadow is a suggestion, never owner consent.'
      : 'If no clear service, no safe classification, or this is an acknowledgement/finish/map reply, return classificationShadowJson as "[]".',
    'Unsafe, regulated, ambiguous and possible duplicates are review-only; classification does not prove worker capability.',
  ].join(' ');
}

/** Private UX-only completeness check after a worker AI turn.
 * Only validated provider hints with explicit modes count as covered. This
 * neither signs consent nor approves taxonomy/push. Preserve user skill order,
 * deduplicate equivalent Serbian scripts, and cap the returned display samples.
 */
export function workerServicesMissingScope(skills,reviewProposals) {
  if(!Array.isArray(skills)||!Array.isArray(reviewProposals))return {count:0,labels:[]};
  const covered=new Set();
  for(const hint of reviewProposals){
    if(!record(hint)||!['ON_SITE','REMOTE'].includes(hint.mode))continue;
    const key=normalizedClassificationIdentity(hint.service);
    if(key)covered.add(key);
  }
  const seen=new Set(), missing=[];
  for(const skill of skills.slice(0,50)){
    const key=normalizedClassificationIdentity(skill);
    if(!key||seen.has(key))continue;
    seen.add(key);
    if(!covered.has(key))missing.push(skill.trim());
  }
  return {count:missing.length,labels:missing.slice(0,2)};
}

/** Finish-only response: reveal incompleteness without forcing another AI
 * turn, promoting provider hints or pretending any consent was stored.
 */
export function workerFinishReviewMessage(skills,reviewProposals,catalogAvailable) {
  if(!catalogAvailable)return 'Otvori pregled profila. Tamo možeš da dopuniš podatke i potvrdiš čuvanje.';
  const unresolved=workerServicesMissingScope(skills,reviewProposals);
  if(!unresolved.count)return 'Otvori pregled profila. Tamo možeš da dopuniš podatke i potvrdiš čuvanje.';
  const examples=unresolved.labels.join(', ');
  const more=unresolved.count-unresolved.labels.length;
  return 'Otvori pregled profila. Za '+examples+
    (more>0?' i još '+more+' usluga':'')+
    ' nije potvrđeno da li radiš na lokaciji, na daljinu ili oba. Možeš to razjasniti u razgovoru, ili sačuvati profil bez automatskog povezivanja za te usluge.';
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
// Diagnostic classes only. Never log model-authored service text, paths or IDs.
function invalidPlanCode(p) {
  if(!record(p))return 'TYPE';
  if(Object.keys(p).length!==8||
     !['service','mode','action','categoryId','parentId','proposedPath','reason','catalogVersion'].every(k=>Object.hasOwn(p,k)))
    return 'FIELDS';
  if(!sane(p.service,3,120))return 'SERVICE';
  if(!modes.has(p.mode))return 'MODE';
  if(!CLASSIFICATION_ACTIONS.includes(p.action))return 'ACTION';
  if(typeof p.categoryId!=='string'||(p.categoryId!==''&&!UUID.test(p.categoryId))||
     typeof p.parentId!=='string'||(p.parentId!==''&&!UUID.test(p.parentId)))return 'ID';
  if(!Array.isArray(p.proposedPath)||p.proposedPath.length>6||
     !p.proposedPath.every(x=>sane(x,3,120)))return 'PATH';
  if(!sane(p.reason,10,1000))return 'REASON';
  if(!Number.isSafeInteger(p.catalogVersion))return 'VERSION';
  return 'ACTION_FIELDS';
}

/** Called BEFORE old strict model parser. Invalid optional shadow is dropped
 * rather than causing an extra paid LLM turn; original answer remains unchanged.
 * The statuses are safe telemetry; never log service text, IDs, review info.
 * reviewProposals are untrusted Gemini HINTS, never signed review consent,
 * admission plans, save receipts, active capabilities or push eligibility.
 */
export function inspectGeminiClassificationShadow(raw,snapshot,purpose) {
  if(!record(raw))return {output:raw,statuses:['MISSING_ENVELOPE'],reviewProposals:[]};
  const {[legacyShadowField]:legacyShadow,[shadowJsonField]:encoded,...output}=raw;
  const oldFormat=Object.hasOwn(raw,legacyShadowField);
  const newFormat=Object.hasOwn(raw,shadowJsonField);
  if(!oldFormat&&!newFormat)return {output,statuses:[],reviewProposals:[]};
  // Never give ambiguous mixed envelopes any classification authority.
  if(oldFormat&&newFormat)return {output,statuses:['AMBIGUOUS_SHADOW_FORMAT'],reviewProposals:[]};
  let shadow=legacyShadow;
  if(newFormat){
    if(typeof encoded!=='string'||new TextEncoder().encode(encoded).byteLength>maxShadowJsonBytes)
      return {output,statuses:['INVALID_SHADOW_JSON'],reviewProposals:[]};
    try { shadow=JSON.parse(encoded); }
    catch { return {output,statuses:['INVALID_SHADOW_JSON'],reviewProposals:[]}; }
  }
  if(!Array.isArray(shadow)||shadow.length>maxServices(purpose))
    return {output,statuses:['INVALID_BATCH'],reviewProposals:[]};
  if(raw.safety==='BLOCK'||raw.safety==='REVIEW')
    return {output,statuses:shadow.length?['SAFETY_INTERVIEW_REVIEW']:[],reviewProposals:[]};
  if(!record(snapshot)||!Array.isArray(snapshot.categories)||!Number.isSafeInteger(snapshot.catalogVersion))
    return {output,statuses:['INVALID_CATALOG'],reviewProposals:[]};
  const seen=new Set(), statuses=[], reviewProposals=[], invalidPlanCodes=[];
  const workerModes=new Map();
  for(const p of shadow){
    if(!validItem(p,snapshot)){
      statuses.push('INVALID_PLAN');invalidPlanCodes.push(invalidPlanCode(p));continue;
    }
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
    else statuses.push(checked.status);
    // A validated hint can be retained for LATER independent source/owner
    // binding, but never becomes an accepted admission plan or worker consent.
    // Only real canonical IDs or an existing reviewed parent may be retained.
    if (p.mode !== 'UNCONFIRMED' &&
        (checked.status === 'REUSE_CANDIDATE' && ['REUSE_EXISTING','REUSE_ALIAS'].includes(p.action) ||
         checked.status === 'ADMISSION_REVIEW_REQUIRED' &&
           ['CREATE_CHILD','CREATE_NEW_BRANCH'].includes(p.action))) {
      reviewProposals.push({
        // SQL captures the existing REUSE_EXISTING wire action. Verification
        // comes from the catalog gate above; the original service stays intact
        // for candidate/source binding and later owner-visible mode confirmation.
        service:p.service,mode:p.mode,action:checked.status==='REUSE_CANDIDATE'?'REUSE_EXISTING':p.action,categoryId:p.categoryId,
        parentId:p.parentId,proposedPath:p.proposedPath.slice(),
        reason:p.reason,catalogVersion:p.catalogVersion,
      });
    }
  }
  return {output,statuses,reviewProposals,invalidPlanCodes};
}
