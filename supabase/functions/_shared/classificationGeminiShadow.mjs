// Shared Gemini classification SHADOW projection for both AI interviews.
// No DB writes, matching or notification authority. Structured feedback is
// advisory; callers keep the useful answer and control review presentation.
// The existing worker/need typed JSON contract is preserved byte-for-byte
// AFTER removing the private, never-authoritative classificationShadow field.
import { CLASSIFICATION_ACTIONS, reviewClassificationProposal, normalizedClassificationIdentity } from './classificationEngine.mjs';
import { decodeServiceHandoff } from './serviceHandoff.mjs';
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
 * request only one STRING in the provider schema. Worker snapshots are required
 * for both purposes when this catalog-enabled decorator is used.
 * The string contains
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
  return {...baseSchema,
    required:[...(baseSchema.required??[]),shadowJsonField],
    properties:{...baseSchema.properties,
    [shadowJsonField]:{type:'STRING'}}};
}

export function geminiClassificationShadowInstruction(purpose='NEED_SERVICE',phase='research') {
  if(!['direct','research'].includes(phase))throw new Error('SHADOW_PHASE_INVALID');
  return [
    purpose==='WORKER_CAPABILITY'
      ? 'Required classificationShadowJson STRING: serialize a JSON array containing a FULL SNAPSHOT (0 to 24 service+mode proposals, at most 12 services) of what this person currently offers AFTER applying the profile patch. Only propose services in the updated explicit skills; never invent a job.'
      : 'Required classificationShadowJson STRING: serialize a JSON array containing a FULL SNAPSHOT of 0 to 6 SEMANTIC SERVICE proposals for the CURRENT task AFTER applying this turn, including services established in earlier turns; never fabricate work.',
    'Always include this field. Serialize classificationShadowJson as one JSON STRING containing an array, no markdown; never return the older classificationShadow array field. Use "[]" only when there are no currently offered services or safety is BLOCK/REVIEW (for a task, when no task service is known). For unresolved identity use ASK_CLARIFICATION or NEEDS_REVIEW with categoryId="", parentId="", proposedPath=[] and a concrete reason. For unresolved delivery use UNCONFIRMED; Missing identity or mode is never a reason to omit the service. Follow the shared execution/handoff contract.',
    'Preserve all other typed response fields. Each entry contains service, mode, action, categoryId, parentId, proposedPath, reason, catalogVersion. Its ONLY optional ninth field is handoff, only for REMOTE, with the exact shared shape/value of the typed need.handoff or corresponding worker choice; omit unknown handoff. service must match the resulting skills or need.category. Metadata cannot invent fact keys or change unrelated user details.',
    'The action value MUST be exactly one of REUSE_EXISTING, REUSE_ALIAS, EXTEND_MODE, CREATE_CHILD, CREATE_NEW_BRANCH, PROPOSE_RESTRUCTURE, ASK_CLARIFICATION, NEEDS_REVIEW, REJECT_UNSUPPORTED_OR_UNSAFE. Do not use shorter words such as REUSE, EXISTING, NEW, or CREATE.',
    'Use catalogVersion from fresh server context. For BOTH REUSE_EXISTING and REUSE_ALIAS: categoryId must be the exact non-empty UUID; parentId must be the empty string ""; proposedPath must be the empty array []. Do not copy the catalog parentId or path into a reuse entry; do not use null, omit fields or add alias/evidence fields. The action REUSE_EXISTING applies only to the same concrete service in a supported mode.',
    'Current supplied entries are partial evidence, never the full catalog. Never reuse a remembered ID absent from them. Reuse only identical concrete work in a supported mode; canonical naming must preserve the exact meaning and authored bio/description, never broader competence. Metadata must fit 24576 UTF-8 bytes; never truncate paths or omit services. Every reason is concrete, 10 to 1000 characters.',
    ...(phase==='direct' ? [
      'This is the direct reply phase, with no navigation tools. Use current seed identities for reuse; do not invent CREATE/EXTEND plans from partial context. ASK_CLARIFICATION is for a real question when the service is still ambiguous; NEEDS_REVIEW requests same-turn catalog research. The server verifies every identity and freshness; unresolved research can continue in this same turn.',
    ] : [
      'Before CREATE_CHILD read the parent and its semantic place, inspecting relevant ancestors/siblings. Organizational ancestors need not support every child mode: the concrete service own modes are authoritative; use ALL-scope navigation rather than changing the actual execution to fit a parent. Existing parent modes remain server facts, not chat-editable. When the SAME concrete existing service legitimately supports the requested execution but lacks that mode, propose EXTEND_MODE with the same categoryId, parentId="", proposedPath=[] and a concrete feasibility reason. Never create a duplicate or replace physical work with advice to evade modes. Clarify uncertain identity/feasibility. EXTEND_MODE requests independent server admission and signed owner review; it is not a catalog change.',
      'Use taxonomy_catalog to search the whole current catalog and inspect any branch at any depth. Initial pages reference categories by categoryId; page.query contains the exact filters to repeat with nextCursor. Every ID and alias comes from the server. Follow nextCursor until the search is complete; a missing phrase is not proof of a missing service. Before a new service complete an ALL-scope SEARCH with service set to its exact proposed label, search alternate wording and inspect plausible equivalents/branches. Incomplete research is NEEDS_REVIEW, never absence. Reuse a supplied exact service without redundant tool calls; budget/calendar corrections alone do not require another search. If natural wording is EXACTLY the same service, use its precise canonical label consistently in skills/need.category and metadata. Related, broader or narrower work is different. Ask about actual work when ambiguous, never ask the user to choose a taxonomy ID.',
      'For an absent service use CREATE_CHILD with a real appropriate parentId and the NEW service mode, or CREATE_NEW_BRANCH with parentId="" only if no suitable parent exists. A new root must be a meaningful missing domain, not a duplicate with a delivery suffix. Both actions require categoryId="" and proposedPath of one or more NEW labels ordered parent-to-service, final label exactly service. There is no fixed number of new levels: useful intermediates only, no duplicates/padding.',
    ]),
    'Never equate lessons, equipment rental and equipment repair merely because they mention skating.',
    'REUSE_ALIAS requires an alias listed by the server for that exact category; a model claim verifies nothing. An unregistered synonym cannot carry a random categoryId: use canonical naming only for identical meaning; otherwise clarify the distinction or propose the actual new service.',
    purpose==='WORKER_CAPABILITY'
      ? 'After applying the patch, compare EACH distinct entry in the resulting skills array: Cover EVERY offered skill; never return only the skills newly mentioned. Represent ON_SITE/REMOTE separately only when confirmed, otherwise UNCONFIRMED rather than omitting it or guessing; do not guess mode. ON_SITE and REMOTE entries for the SAME concrete service must resolve one canonical leaf: REUSE/EXTEND entries use the same categoryId, and new-service entries use the same parentId and proposedPath; mode and handoff may differ. A finish/acknowledgement keeps the FULL SNAPSHOT. Ask at most ONE necessary question per turn, about one unresolved service or mode; retain the other unresolved services without bundling questions. Do not invent skills or consent from city. More than 12 services needs clarification/organization, never silent dropping.'
      : 'Acknowledgement/finish/map replies KEEP the FULL SNAPSHOT: location, date and price replies do not erase classification. A real task change classifies the updated service, not its predecessor. Ask at most ONE necessary question per turn to clarify unresolved identity or delivery; retain other unresolved issues without bundling questions. Never invent work to fill metadata.',
    'This private metadata and its capture are proposals for signed review and explicit Save, never user consent, never owner consent or capability proof; never write to the catalog. Never claim a category was created or an unverified plan is fully linked/ready to publish. Unsafe, regulated, ambiguous and possible duplicates are review-only.',
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
export function workerFinishReviewMessage(skills,reviewProposals,catalogAvailable,mayOfferBio=false) {
  // An optional writing offer is not a mandatory interview field, saved bio or classification permission.
  const bioOffer=mayOfferBio
    ? ' Ako želite, mogu da sastavim kratak opis Vašeg rada na osnovu potvrđenih podataka. Opis nije uslov za pregled ili čuvanje.'
    : '';
  if(!catalogAvailable)return 'Otvorite pregled profila. Tamo možete da dopunite podatke i potvrdite čuvanje.'+bioOffer;
  const unresolved=workerServicesMissingScope(skills,reviewProposals);
  if(!unresolved.count)return 'Otvorite pregled profila. Tamo možete da dopunite podatke i potvrdite čuvanje.'+bioOffer;
  const examples=unresolved.labels.join(', ');
  const more=unresolved.count-unresolved.labels.length;
  return 'Otvorite pregled profila. Za '+examples+
    (more>0?' i još '+more+' usluga':'')+
    ' nije potvrđeno da li radite na lokaciji, na daljinu ili oba. Možete to razjasniti u razgovoru, ili sačuvati profil bez automatskog povezivanja za te usluge.'+bioOffer;
}

function validItem(p,snapshot) {
  if(!record(p)||Object.keys(p).length!==(Object.hasOwn(p,'handoff')?9:8) ||
    !['service','mode','action','categoryId','parentId','proposedPath','reason','catalogVersion'].every(k=>Object.hasOwn(p,k))
    ||!sane(p.service,3,120)||!modes.has(p.mode)||!CLASSIFICATION_ACTIONS.includes(p.action)
    ||typeof p.categoryId!=='string'||(p.categoryId!==''&&!UUID.test(p.categoryId))
    ||typeof p.parentId!=='string'||(p.parentId!==''&&!UUID.test(p.parentId))
    ||!Array.isArray(p.proposedPath)||
      !p.proposedPath.every(x=>sane(x,3,120))
    ||!sane(p.reason,10,1000)||!Number.isSafeInteger(p.catalogVersion)
    )return false;
  if(Object.hasOwn(p,'handoff')&&(p.mode!=='REMOTE'||!decodeServiceHandoff(p.handoff)))return false;
  if(['REUSE_EXISTING','REUSE_ALIAS','EXTEND_MODE'].includes(p.action))
    return !!p.categoryId&&p.parentId===''&&p.proposedPath.length===0;
  if(p.action==='CREATE_CHILD')return !!p.parentId&&p.categoryId===''&&p.proposedPath.length>0;
  if(p.action==='CREATE_NEW_BRANCH')return p.categoryId===''&&p.parentId===''&&p.proposedPath.length>0;
  if(p.action==='PROPOSE_RESTRUCTURE')return p.categoryId===''&&p.proposedPath.length>0;
  return p.categoryId===''&&p.parentId===''&&p.proposedPath.length===0;
}

/** Syntax validation shared by live hint admission and the provider proof.
 * A syntactically valid plan is STILL an untrusted hint: catalog identity,
 * owner mode/handoff consent and the signed review are checked elsewhere.
 */
export function isValidClassificationPlanShape(plan) {
  return validItem(plan);
}
// Diagnostic classes only. Never log model-authored service text, paths or IDs.
function invalidPlanCode(p) {
  if(!record(p))return 'TYPE';
  if(Object.keys(p).length!==(Object.hasOwn(p,'handoff')?9:8)||
     !['service','mode','action','categoryId','parentId','proposedPath','reason','catalogVersion'].every(k=>Object.hasOwn(p,k)))
    return 'FIELDS';
  if(!sane(p.service,3,120))return 'SERVICE';
  if(!modes.has(p.mode))return 'MODE';
  if(Object.hasOwn(p,'handoff')&&(p.mode!=='REMOTE'||!decodeServiceHandoff(p.handoff)))return 'HANDOFF';
  if(!CLASSIFICATION_ACTIONS.includes(p.action))return 'ACTION';
  if(typeof p.categoryId!=='string'||(p.categoryId!==''&&!UUID.test(p.categoryId))||
     typeof p.parentId!=='string'||(p.parentId!==''&&!UUID.test(p.parentId)))return 'ID';
  if(!Array.isArray(p.proposedPath)||
     !p.proposedPath.every(x=>sane(x,3,120)))return 'PATH';
  if(!sane(p.reason,10,1000))return 'REASON';
  if(!Number.isSafeInteger(p.catalogVersion))return 'VERSION';
  // Fixed reason enums expose which wire constraint failed, never the model's
  // service, UUID, reason or path. The strict validator above stays unchanged.
  if(['REUSE_EXISTING','REUSE_ALIAS','EXTEND_MODE'].includes(p.action)){
    if(!p.categoryId)return 'REUSE_CATEGORY_REQUIRED';
    if(p.parentId!=='')return 'REUSE_PARENT_MUST_BE_EMPTY';
    if(p.proposedPath.length!==0)return 'REUSE_PATH_MUST_BE_EMPTY';
  }else if(p.action==='CREATE_CHILD'){
    if(!p.parentId)return 'CHILD_PARENT_REQUIRED';
    if(p.categoryId!=='')return 'CHILD_CATEGORY_MUST_BE_EMPTY';
    if(p.proposedPath.length===0)return 'CHILD_PATH_REQUIRED';
  }else if(p.action==='CREATE_NEW_BRANCH'){
    if(p.categoryId!=='')return 'BRANCH_CATEGORY_MUST_BE_EMPTY';
    if(p.parentId!=='')return 'BRANCH_PARENT_MUST_BE_EMPTY';
    if(p.proposedPath.length===0)return 'BRANCH_PATH_REQUIRED';
  }else if(p.action==='PROPOSE_RESTRUCTURE'){
    if(p.categoryId!=='')return 'RESTRUCTURE_CATEGORY_MUST_BE_EMPTY';
    if(p.proposedPath.length===0)return 'RESTRUCTURE_PATH_REQUIRED';
  }else{
    if(p.categoryId!=='')return 'REVIEW_CATEGORY_MUST_BE_EMPTY';
    if(p.parentId!=='')return 'REVIEW_PARENT_MUST_BE_EMPTY';
    if(p.proposedPath.length!==0)return 'REVIEW_PATH_MUST_BE_EMPTY';
  }
  return 'ACTION_FIELDS';
}

function crossModeTarget(p) {
  if(['REUSE_EXISTING','REUSE_ALIAS','EXTEND_MODE'].includes(p.action))
    return JSON.stringify(['EXISTING',p.categoryId.toLowerCase()]);
  if(['CREATE_CHILD','CREATE_NEW_BRANCH'].includes(p.action))
    return JSON.stringify(['NEW',p.parentId.toLowerCase(),
      ...p.proposedPath.map(normalizedClassificationIdentity)]);
  return null;
}

// Compare both worker modes before retaining either hint. Independent per-mode
// review can accept two different IDs (or two new paths) for the same service.
function conflictingWorkerIdentities(shadow,snapshot) {
  const byService=new Map();
  for(const p of shadow){
    if(!validItem(p,snapshot)||!['ON_SITE','REMOTE'].includes(p.mode))continue;
    const target=crossModeTarget(p);
    if(!target)continue;
    const service=normalizedClassificationIdentity(p.service);
    if(!service)continue;
    if(!byService.has(service))byService.set(service,{modes:new Set(),targets:new Set()});
    const group=byService.get(service);
    group.modes.add(p.mode);
    group.targets.add(target);
  }
  return new Set([...byService].filter(([,group])=>group.modes.size===2&&group.targets.size>1)
    .map(([service])=>service));
}

// Issues are private, owner-facing context, NOT telemetry: labels may identify
// work. Log only statuses/invalidPlanCodes. Never expose provider reasons/IDs.
function classificationIssue(code,p,purpose) {
  const service=sane(p?.service,3,120)?p.service.trim():null;
  const mode=modes.has(p?.mode)?p.mode:null;
  const action=CLASSIFICATION_ACTIONS.includes(p?.action)?p.action:null;
  let resolution='RETRY',question=null;
  if(code==='MODE_UNCONFIRMED'){
    resolution='ASK_USER';
    question=purpose==='WORKER_CAPABILITY'
      ? `Uslugu „${service}“ nudiš kod klijenta, na daljinu ili na oba načina?`
      : `Da li za „${service}“ neko treba da dođe kod tebe ili posao može da uradi kod sebe, uz slanje ili preuzimanje rezultata?`;
  }else if(code==='ASK_CLARIFICATION'){
    resolution='ASK_USER';
    question=purpose==='WORKER_CAPABILITY'
      ? `Šta tačno obuhvata usluga „${service}“ koju nudiš?`
      : `Šta tačno treba da se uradi u okviru usluge „${service}“?`;
  }else if(['ADMISSION_REVIEW_REQUIRED','NEEDS_REVIEW','AMBIGUOUS_CANONICAL_IDENTITY'].includes(code)){
    resolution='PENDING';
  }else if(['REJECT_UNSUPPORTED_OR_UNSAFE','SAFETY_INTERVIEW_REVIEW'].includes(code)){
    resolution='UNSUPPORTED';
  }
  return {service,mode,code,action,resolution,question};
}

/** Called BEFORE old strict model parser. Invalid shadow is stripped
 * rather than causing an extra paid LLM turn; original answer remains unchanged.
 * The statuses are safe telemetry; never log service text, IDs, review info.
 * reviewProposals are untrusted Gemini HINTS, never signed review consent,
 * admission plans, save receipts, active capabilities or push eligibility.
 */
export function inspectGeminiClassificationShadow(raw,snapshot,purpose) {
  if(!record(raw))return {output:raw,statuses:['MISSING_ENVELOPE'],reviewProposals:[],
    invalidPlanCodes:[],issues:[classificationIssue('MISSING_ENVELOPE',null,purpose)]};
  const {[legacyShadowField]:legacyShadow,[shadowJsonField]:encoded,...output}=raw;
  const empty=statuses=>({output,statuses,reviewProposals:[],invalidPlanCodes:[],
    issues:statuses.map(code=>classificationIssue(code,null,purpose))});
  const oldFormat=Object.hasOwn(raw,legacyShadowField);
  const newFormat=Object.hasOwn(raw,shadowJsonField);
  if(!oldFormat&&!newFormat)return empty(['MISSING_CLASSIFICATION_SHADOW']);
  // Never give ambiguous mixed envelopes any classification authority.
  if(oldFormat&&newFormat)return empty(['AMBIGUOUS_SHADOW_FORMAT']);
  let shadow=legacyShadow;
  if(newFormat){
    if(typeof encoded!=='string'||new TextEncoder().encode(encoded).byteLength>maxShadowJsonBytes)
      return empty(['INVALID_SHADOW_JSON']);
    try { shadow=JSON.parse(encoded); }
    catch { return empty(['INVALID_SHADOW_JSON']); }
  }else{
    // Offline legacy envelopes cannot bypass the same byte bound.
    try {
      if(new TextEncoder().encode(JSON.stringify(shadow)).byteLength>maxShadowJsonBytes)
        return empty(['INVALID_SHADOW_JSON']);
    }catch{return empty(['INVALID_SHADOW_JSON']);}
  }
  if(!Array.isArray(shadow)||shadow.length>maxServices(purpose))
    return empty(['INVALID_BATCH']);
  // Bounded telemetry distinguishes a provider omission from a rejected plan.
  // Never infer a category or delivery mode, retry the provider or alter the turn.
  if(raw.safety==='BLOCK'||raw.safety==='REVIEW')
    return empty(['SAFETY_INTERVIEW_REVIEW']);
  if(shadow.length===0)return empty(['EMPTY_CLASSIFICATION_SHADOW']);
  if(!record(snapshot)||!Array.isArray(snapshot.categories)||!Number.isSafeInteger(snapshot.catalogVersion))
    return empty(['INVALID_CATALOG']);
  const seen=new Set(), statuses=[], reviewProposals=[], invalidPlanCodes=[],issues=[];
  const workerModes=new Map();
  const crossModeConflicts=purpose==='WORKER_CAPABILITY'
    ? conflictingWorkerIdentities(shadow,snapshot):new Set();
  for(const p of shadow){
    if(!validItem(p,snapshot)){
      statuses.push('INVALID_PLAN');invalidPlanCodes.push(invalidPlanCode(p));
      issues.push(classificationIssue('INVALID_PLAN',p,purpose));continue;
    }
    const signature=normalizedClassificationIdentity(p.service);
    // A single offered service can legitimately support BOTH ON_SITE and REMOTE.
    // Two copies of the same service+mode (including Cyrillic/Latin synonyms)
    // are still duplicates. Requester tasks cannot declare multiple modes.
    const identity=purpose==='WORKER_CAPABILITY'?signature+'|'+p.mode:signature;
    const oldModes=workerModes.get(signature)??new Set();
    if(seen.has(identity) || (purpose==='WORKER_CAPABILITY' &&
      ((p.mode==='UNCONFIRMED'&&oldModes.size>0)||oldModes.has('UNCONFIRMED')))){
      statuses.push('DUPLICATE_SERVICE');issues.push(classificationIssue('DUPLICATE_SERVICE',p,purpose));continue;
    }
    seen.add(identity);
    if(purpose==='WORKER_CAPABILITY'){oldModes.add(p.mode);workerModes.set(signature,oldModes);}
    if(crossModeConflicts.has(signature)){
      statuses.push('CROSS_MODE_IDENTITY_CONFLICT');
      issues.push(classificationIssue('CROSS_MODE_IDENTITY_CONFLICT',p,purpose));continue;
    }
    // Some provider outputs label a canonical name as REUSE_ALIAS after
    // translating the user's wording. An exact current label+ID needs no new
    // alias. Normalize that wire action only; all identity/freshness/mode and
    // global collision checks still run in the domain engine below.
    const exactCanonical=p.action==='REUSE_ALIAS' && snapshot.categories.some(node=>
      node.id===p.categoryId && normalizedClassificationIdentity(node.label)===signature);
    const checked=reviewClassificationProposal(
      {purpose,service:p.service,mode:p.mode==='UNCONFIRMED'?null:p.mode},
      snapshot,{action:exactCanonical?'REUSE_EXISTING':p.action,categoryId:p.categoryId||undefined,
        parentId:p.parentId||null,proposedPath:p.proposedPath,
        reason:p.reason,catalogVersion:p.catalogVersion});
    const code=checked.accepted && p.mode==='UNCONFIRMED'?'MODE_UNCONFIRMED':checked.status;
    statuses.push(code);
    if(code!=='REUSE_CANDIDATE')issues.push(classificationIssue(code,p,purpose));
    if(p.mode==='UNCONFIRMED'&&['ADMISSION_REVIEW_REQUIRED','NEEDS_REVIEW'].includes(code))
      issues.push(classificationIssue('MODE_UNCONFIRMED',p,purpose));
    // A validated hint can be retained for LATER independent source/owner
    // binding, but never becomes an accepted admission plan or worker consent.
    // Only real canonical IDs or an existing reviewed parent may be retained.
    if (p.mode !== 'UNCONFIRMED' &&
        (checked.status === 'REUSE_CANDIDATE' && ['REUSE_EXISTING','REUSE_ALIAS'].includes(p.action) ||
         checked.status === 'ADMISSION_REVIEW_REQUIRED' &&
           ['CREATE_CHILD','CREATE_NEW_BRANCH','EXTEND_MODE'].includes(p.action))) {
      reviewProposals.push({
        // SQL captures the existing REUSE_EXISTING wire action. Verification
        // comes from the catalog gate above; the original service stays intact
        // for candidate/source binding and later owner-visible mode confirmation.
        service:p.service,mode:p.mode,action:checked.status==='REUSE_CANDIDATE'?'REUSE_EXISTING':p.action,categoryId:p.categoryId,
        parentId:p.parentId,proposedPath:p.proposedPath.slice(),
        reason:p.reason,catalogVersion:p.catalogVersion,
        ...(Object.hasOwn(p,'handoff')?{handoff:decodeServiceHandoff(p.handoff)}:{}),
      });
    }
  }
  return {output,statuses,reviewProposals,invalidPlanCodes,issues};
}

/** No provider call or output rewriting. The caller keeps the substantive
 * answer/questions, appends an honest status where needed and distinguishes
 * permission to OPEN a review from any permission to save/activate/match.
 * `services` must be the post-turn typed services, not free-text intent guesses.
 * @param {any} inspection
 * @param {{purpose?: string, services?: string[], readyForReview?: boolean,
 *   preservedServices?: string[], catalogAvailable?: boolean}} [options]
 */
export function classificationTurnFeedback(inspection,{purpose,services=[],readyForReview=false,
  preservedServices=[],catalogAvailable=true}={}) {
  const proposals=Array.isArray(inspection?.reviewProposals)?inspection.reviewProposals:[];
  const expected=new Map();
  for(const value of Array.isArray(services)?services:[]){
    const key=normalizedClassificationIdentity(value);
    if(key&&!expected.has(key))expected.set(key,value.trim());
  }
  let issues=Array.isArray(inspection?.issues)?inspection.issues.slice():[];
  const covered=new Set(proposals.map(p=>normalizedClassificationIdentity(p.service)).filter(Boolean));
  // Only the mode guard supplies these labels after returning freshly
  // revalidated SAVED choices. Current provider/draft hints alone cannot erase
  // a contradiction or prove that an earlier question was answered.
  const restored=new Set((Array.isArray(preservedServices)?preservedServices:[])
    .map(normalizedClassificationIdentity).filter(key=>key&&covered.has(key)&&expected.has(key)));
  if(catalogAvailable&&restored.size){
    issues=issues.filter(issue=>issue.resolution==='UNSUPPORTED'||
      !restored.has(normalizedClassificationIdentity(issue.service)));
    if(expected.size&&Array.from(expected.keys()).every(key=>covered.has(key)))
      issues=issues.filter(issue=>!['EMPTY_CLASSIFICATION_SHADOW','MISSING_CLASSIFICATION_SHADOW'].includes(issue.code));
  }
  if(!catalogAvailable)issues.push(classificationIssue('CATALOG_UNAVAILABLE',null,purpose));
  // No service has been supplied yet: an explicit empty snapshot is honest.
  // A missing/invalid envelope still represents a provider problem.
  if(!expected.size&&!readyForReview)
    issues=issues.filter(issue=>issue.code!=='EMPTY_CLASSIFICATION_SHADOW');
  const represented=new Set([...proposals,...issues].map(p=>normalizedClassificationIdentity(p.service)).filter(Boolean));
  for(const [key,service] of expected){
    if(!represented.has(key))issues.push(classificationIssue('MISSING_SERVICE_PROPOSAL',{service},purpose));
  }
  const byResolution=resolution=>issues.filter(issue=>issue.resolution===resolution);
  const state=byResolution('UNSUPPORTED').length?'UNSUPPORTED':byResolution('ASK_USER').length?'ASK_USER':
    byResolution('RETRY').length?'RETRY':byResolution('PENDING').length?'PENDING':'CLEAR';
  const canOfferReview=proposals.length>0&&
    !issues.some(issue=>issue.resolution!=='PENDING'||issue.code!=='ADMISSION_REVIEW_REQUIRED');
  // Keep every unresolved issue, but surface only the next necessary question.
  const questions=[...new Set(byResolution('ASK_USER').map(issue=>issue.question).filter(Boolean))].slice(0,1);
  let notice=null;
  if(state==='ASK_USER')notice='Za povezivanje još treba razjasniti uslugu ili način rada. Uneti podaci ostaju u nacrtu.';
  if(state==='RETRY')notice='Podaci ostaju u nacrtu, ali povezivanje vrste usluge još nije provereno. Nije potrebno da ponavljate već date podatke.';
  if(state==='PENDING')notice=canOfferReview
    ? 'Predlog nove vrste usluge možete da proverite u pregledu. Nije aktivan pre potvrde i čuvanja.'
    : 'Podaci ostaju u nacrtu. Povezivanje vrste usluge još čeka proveru.';
  if(state==='UNSUPPORTED')notice='Podaci nisu potvrđeni za povezivanje zadataka. Za ovu uslugu je potrebna dodatna provera.';
  return {state,canOfferReview,questions,notice,issues};
}
