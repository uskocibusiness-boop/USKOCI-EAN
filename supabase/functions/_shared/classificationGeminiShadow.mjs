// Shared Gemini classification SHADOW projection for both AI interviews.
// No DB writes, matching or notification authority. Structured feedback is
// advisory; callers keep the useful answer and control review presentation.
// The existing worker/need typed JSON contract is preserved byte-for-byte
// AFTER removing the private, never-authoritative classificationShadow field.
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

export function geminiClassificationShadowInstruction(purpose='NEED_SERVICE') {
  return [
    purpose==='WORKER_CAPABILITY'
      ? 'Required classificationShadowJson STRING: serialize a JSON array containing a FULL SNAPSHOT (0 to 24 service+mode proposals, at most 12 services) of what this person currently offers AFTER applying the profile patch. Only propose services in the updated explicit skills; never invent a job.'
      : 'Required classificationShadowJson STRING: serialize a JSON array containing a FULL SNAPSHOT of 0 to 6 SEMANTIC SERVICE proposals for the CURRENT task AFTER applying this turn, including services established in earlier turns; never fabricate work.',
    'The entire classificationShadowJson field is one JSON STRING, NOT a nested JSON array property. Serialize array entries as JSON inside that string, no markdown. This field is private metadata and never user consent or catalog write authority.',
    purpose==='WORKER_CAPABILITY'
      ? 'Always include this field. Use "[]" only when there are no currently offered services or safety is BLOCK/REVIEW. For an offered service with unresolved identity use ASK_CLARIFICATION or NEEDS_REVIEW with categoryId="", parentId="", proposedPath=[] and a concrete reason; for unresolved delivery mode use UNCONFIRMED. Missing identity or mode is a proposal with an explicit unresolved state, never a reason to omit the service. When the person explicitly offers work at the customer, propose ON_SITE for that service; when explicitly remote, propose REMOTE. Catalog modes only limit supported scopes and never establish what this worker offers.'
      : 'Always include this field. Use "[]" only when no task service is known yet or safety is BLOCK/REVIEW. For a known service with unresolved identity use ASK_CLARIFICATION or NEEDS_REVIEW with categoryId="", parentId="", proposedPath=[] and a concrete reason; for unresolved delivery mode use UNCONFIRMED. Missing identity or mode is an explicit unresolved proposal, never a reason to drop a known service.',
    'Keep the existing typed contracts for assistantMessage, safety, facts, patch, dialogue and the other response fields. Naming proposals must be consistent with those normal typed fields; metadata must not inject new fact keys or change unrelated user details. Never return the older classificationShadow array field.',
    'Each entry inside the serialized JSON array must contain exactly service, mode, action, categoryId, parentId, proposedPath, reason, catalogVersion.',
    'The action value MUST be exactly one of REUSE_EXISTING, REUSE_ALIAS, CREATE_CHILD, CREATE_NEW_BRANCH, PROPOSE_RESTRUCTURE, ASK_CLARIFICATION, NEEDS_REVIEW, REJECT_UNSUPPORTED_OR_UNSAFE. Do not use shorter words such as REUSE, EXISTING, NEW, or CREATE.',
    'Use catalogVersion from provided server context. If an existing category covers the service, use action REUSE_EXISTING, its exact real categoryId, parentId="", proposedPath=[].',
    'Before CREATE_CHILD, read the proposed parent and verify that its modes contain the actual service mode. ON_SITE-only parents cannot receive REMOTE children, even for a related craft. Do not change shipping/provider-workshop work into ON_SITE to fit the tree. Inspect appropriate ancestors and other relevant branches. When no semantically appropriate parent supports the mode and the service is genuinely absent, propose CREATE_NEW_BRANCH with a meaningful domain root and the necessary path, keeping parentId="". A new root must describe a real missing service family, never merely duplicate an existing root with a delivery suffix to evade its modes. Existing parent modes are server facts; chat cannot extend them. If the appropriate existing structure needs a mode change, use NEEDS_REVIEW with that concrete reason. Never present an unverified plan as ready to publish or fully linked.',
    'For BOTH REUSE_EXISTING and REUSE_ALIAS: categoryId must be the exact non-empty UUID of that existing category; parentId must be the empty string ""; proposedPath must be the empty array []. Do not copy the catalog parentId or path into a reuse entry. Do not use null, omit these fields, or add alias/evidence fields. The service field must match the concrete service in the resulting skills or need.category.',
    'Use the fresh server catalog context, parent relationships and registered aliases. When catalogAccess provides navigation tools, initial pages are NOT the full catalog: search globally, open relevant branches, follow nextCursor and read additional pages as needed. Before proposing a new service, complete an ALL-scope SEARCH with service set to that exact proposed label; inspect plausible equivalents and parent branches. If the person describes EXACTLY an existing concrete service in natural language, use its precise canonical label consistently in the resulting skills or need.category and classification proposal; preserve their authored scope and details in bio/description. This is a user-reviewable naming proposal, not a new global alias or evidence of broader competence. A related, broader, narrower or different service is NOT the same service: clarify the actual distinction or propose a fitting new branch instead of choosing a convenient broad ID. Incomplete research is NEEDS_REVIEW, never evidence that a category is absent.',
    'For a missing service: CREATE_CHILD with a real parentId from the supplied catalog in the confirmed mode, or CREATE_NEW_BRANCH with parentId="" only when no suitable parent exists. proposedPath contains one or more NEW labels, ordered from the parent toward the service; its final label must be exactly the service text. There is no fixed number of new levels: include useful intermediate labels only, without duplicates or arbitrary padding. The entire serialized metadata must fit within 24576 UTF-8 bytes; never truncate a path or silently omit a service to fit. categoryId="" for either creation action. Give a concrete reason of 10 to 1000 characters; never write or claim a category was created.',
    'Never equate lessons, equipment rental and equipment repair merely because they mention skating.',
    'REUSE_ALIAS is only a suggested semantic candidate; no alias is verified by a model claim. Only aliases listed by the server for that exact category may be reused. An unregistered synonym cannot carry a random existing categoryId: use the exact concrete canonical naming rule above only when meanings are identical; otherwise ask the necessary distinction or propose the actual new service. Never replace a service with a broader category label.',
    purpose==='WORKER_CAPABILITY'
      ? 'Mode ON_SITE/REMOTE only when the worker explicitly offers that mode for that service; otherwise UNCONFIRMED. Separate every service; catalog membership or a profession does not infer mode. The owner must confirm offered modes in the signed review.'
      : 'Mode ON_SITE/REMOTE only if explicit or inherent to the actual task; otherwise UNCONFIRMED. Fabrication at the provider with shipping or pickup does not imply work at the customer. Separate every service; mode remains part of the owner-reviewed task.',
    purpose==='WORKER_CAPABILITY'
      ? 'After applying the profile patch, compare EACH distinct entry in the resulting skills array with classificationShadowJson. Cover EVERY offered skill with at least one proposal (ON_SITE, REMOTE, or UNCONFIRMED), even if it was added in an earlier turn; never return only the skills newly mentioned by the user. If both modes are explicitly confirmed, represent both modes separately. On a finish/acknowledgement turn with unchanged skills, KEEP a FULL SNAPSHOT of those same skills. When delivery mode for any service is unclear ask a short, natural follow-up within the interview limit of up to THREE related questions; ask only about unresolved services and mark each such service UNCONFIRMED rather than omitting it or guessing; do not guess mode, create a fake skill or infer consent from city. When more than 12 services are offered, clarify/organize the list before classification instead of silently dropping services. Shadow is a suggestion, never owner consent.'
      : 'On an acknowledgement/finish/map reply KEEP the FULL SNAPSHOT of the unchanged known task service. A location confirmation, date answer or price answer does not erase its classification. On a real task change classify the updated current service, not the superseded one. Unresolved identity or delivery needs a short natural clarification within the interview limit of THREE semantic questions; do not invent a task to fill the metadata.',
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
    ||!Array.isArray(p.proposedPath)||
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
  if(!Array.isArray(p.proposedPath)||
     !p.proposedPath.every(x=>sane(x,3,120)))return 'PATH';
  if(!sane(p.reason,10,1000))return 'REASON';
  if(!Number.isSafeInteger(p.catalogVersion))return 'VERSION';
  // Fixed reason enums expose which wire constraint failed, never the model's
  // service, UUID, reason or path. The strict validator above stays unchanged.
  if(['REUSE_EXISTING','REUSE_ALIAS'].includes(p.action)){
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
    const checked=reviewClassificationProposal(
      {purpose,service:p.service,mode:p.mode==='UNCONFIRMED'?null:p.mode},
      snapshot,{action:p.action,categoryId:p.categoryId||undefined,
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
  return {output,statuses,reviewProposals,invalidPlanCodes,issues};
}

/** No provider call or output rewriting. The caller keeps the substantive
 * answer/questions, appends an honest status where needed and distinguishes
 * permission to OPEN a review from any permission to save/activate/match.
 * `services` must be the post-turn typed services, not free-text intent guesses.
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
  const canOfferReview=proposals.length>0&&Array.from(expected.keys()).every(key=>covered.has(key))&&
    !issues.some(issue=>issue.resolution!=='PENDING'||issue.code!=='ADMISSION_REVIEW_REQUIRED');
  const questions=[...new Set(byResolution('ASK_USER').map(issue=>issue.question).filter(Boolean))].slice(0,3);
  let notice=null;
  if(state==='ASK_USER')notice='Za povezivanje još treba razjasniti uslugu ili način rada. Uneti podaci ostaju u nacrtu.';
  if(state==='RETRY')notice='Podaci ostaju u nacrtu, ali povezivanje vrste usluge još nije provereno. Nije potrebno da ponavljaš već date podatke.';
  if(state==='PENDING')notice=canOfferReview
    ? 'Predlog nove vrste usluge možeš da proveriš u pregledu. Nije aktivan pre potvrde i čuvanja.'
    : 'Podaci ostaju u nacrtu. Povezivanje vrste usluge još čeka proveru.';
  if(state==='UNSUPPORTED')notice='Podaci nisu potvrđeni za povezivanje zadataka. Za ovu uslugu je potrebna dodatna provera.';
  return {state,canOfferReview,questions,notice,issues};
}
