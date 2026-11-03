import { measureAiPhase } from '../_shared/aiPhaseTiming.mjs';
import { taxonomyIntakeEnabled } from '../_shared/taxonomyRuntimeConfig.mjs';
// New taxonomy operations have a single explicit server-side rollout owner.
import { AI_CREDITS_UNAVAILABLE, AI_DIAGNOSTICS_HEADER, AI_DIAGNOSTICS_VERSION } from '../../../src/contracts/aiAvailability.ts';
import { decodeWorkerAreas } from '../../../src/contracts/workerAreas.ts';
// Distinct owned WORKER_PROFILE_V1 proposals. No task facts or canonical writes.
import { interviewVoiceInstruction } from '../_shared/interviewVoiceInstruction.mjs';
import { AI_TEST_LIMITS, reserveAiTestBudget } from '../_shared/aiTestBudget.ts';
import { GeminiCreditsUnavailableError, streamGeminiTask, type GeminiUsage } from '../_shared/geminiTaskStream.ts';
import { singlePassTaxonomyInstruction, withSinglePassTaxonomySchema, takeSinglePassTaxonomy, singlePassCapturePlan, singlePassCompletion, withUnresolvedSinglePassReply } from '../_shared/singlePassTaxonomy.mjs';
import { completeFirstPlan } from '../_shared/completeFirstPlan.ts';
import { serviceExecutionInstruction } from '../_shared/serviceExecutionInstruction.mjs';
import { createResearchDeadline } from '../_shared/researchDeadline.ts';
import { readWorkerServiceModeContext, workerServiceModeSchema, workerServiceModeInstruction } from '../_shared/workerServiceModeContext.mjs';
import { guardWorkerAreaOutput } from '../_shared/workerAreaAdmission.mjs';
import { workerAreaRequestSchema, parseWorkerAreaRequests, resolveWorkerAreas } from '../_shared/workerAreaResolver.mjs';
import { loadFullCatalogTree, buildWorkerFullTreeTaxonomyProposals, runInBackground, fetchUnconsumedClarificationHint, persistClarificationHint, persistConsumeClarificationHint } from '../_shared/backgroundTaxonomyArchitect.mjs';
declare const Deno: { env: { get(name:string):string|undefined }; serve(handler:(request:Request)=>Promise<Response>):void };

const isLiveTaxonomyIntake = (): boolean => taxonomyIntakeEnabled((key:string)=>Deno.env.get(key));

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status,
  headers: { ...cors, 'Content-Type': 'application/json' } });
const object = (v: unknown): Record<string, any> | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : null;
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const keys = (v: Record<string, any>, names: string[]) => Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));

async function requestText(req:Request):Promise<string>{
  const declared=req.headers.get('content-length');
  if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>20000))throw new Error('WORKER_AI_INPUT_INVALID');
  const reader=req.body?.getReader();if(!reader)throw new Error('WORKER_AI_INPUT_INVALID');
  let expired=false;const timer=setTimeout(()=>{expired=true;void reader.cancel().catch(()=>undefined);},5000);
  let size=0,body='';const decoder=new TextDecoder('utf-8',{fatal:true});
  try{for(;;){const part=await reader.read();if(expired||req.signal.aborted)throw new Error('WORKER_AI_CANCELLED');
    if(part.done)break;size+=part.value.byteLength;if(size>20000)throw new Error('WORKER_AI_INPUT_INVALID');body+=decoder.decode(part.value,{stream:true});}
    body+=decoder.decode();if(declared!==null&&Number(declared)!==size)throw new Error('WORKER_AI_INPUT_INVALID');return body;
  }finally{clearTimeout(timer);void reader.cancel().catch(()=>undefined);}
}

async function boundedJson(url: string, init: RequestInit, maximum: number, timeout: number, signal: AbortSignal) {
  const abort = new AbortController();
  let rejectStopped: (error: Error) => void = () => {};
  const stopped = new Promise<never>((_resolve,reject)=>{rejectStopped=reject;});
  void stopped.catch(()=>undefined);
  const stop = () => { abort.abort(); rejectStopped(new Error('WORKER_AI_CANCELLED')); }, timer = setTimeout(stop, timeout);
  signal.addEventListener('abort', stop, { once: true }); if (signal.aborted) stop();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    if (abort.signal.aborted) throw new Error('WORKER_AI_CANCELLED');
    const response = await Promise.race([fetch(url, { ...init, redirect: 'error', signal: abort.signal }),stopped]);
    if (response.redirected || !response.body) throw new Error('WORKER_AI_UNAVAILABLE');
    reader = response.body.getReader(); let size = 0, body = ''; const decoder = new TextDecoder('utf-8', { fatal: true });
    for (;;) {
      const part = await Promise.race([reader.read(),stopped]); if (abort.signal.aborted) throw new Error('WORKER_AI_CANCELLED');
      if (part.done) break; size += part.value.byteLength;
      if (size > maximum) throw new Error('WORKER_AI_TOO_LARGE'); body += decoder.decode(part.value, { stream: true });
    }
    body += decoder.decode(); return { ok: response.ok, status: response.status, data: JSON.parse(body) };
  } finally { clearTimeout(timer); signal.removeEventListener('abort', stop); abort.abort(); void reader?.cancel().catch(() => undefined); }
}

export function workerProviderSchema() {
  const string = { type: 'STRING' }, integer = { type: 'INTEGER' }, boolean = { type: 'BOOLEAN' };
  const array = (items: unknown, description?: string) => ({ type: 'ARRAY', items, ...(description ? {description} : {}) });
  const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'OBJECT', properties, ...(required.length ? { required } : {}) });
  const nullableString = { type: 'STRING', nullable: true };
  const rule = obj({ startTime: string, endTime: string, startsOn: string, endsOn: nullableString, label: string, active: boolean },
    ['startTime','endTime','startsOn','endsOn','label','active']);
  return obj({ assistantMessage: string, safety: { type: 'STRING', enum: ['ALLOW','CLARIFY','REVIEW','BLOCK'],
    description:'Use shared safety rules. REVIEW means a safety concern, never profile preview.' },
    availabilityChange: obj({ kind: { type: 'STRING', enum: ['NONE','PATCH','CLARIFY'] }, evidence: string }, ['kind','evidence']),
    patch: obj({ displayName: string, bio: string, skills: array(string),
      location: obj({ operatingCountryCode: string, city: string, radiusKm: integer }),
      areaRequests: workerAreaRequestSchema,
      availability: {...obj({ timezone: string, availableNow: boolean,
        ruleChanges: array(obj({ ruleId: nullableString, weekdays: array(integer), value: { ...rule, nullable: true } }, ['ruleId','weekdays','value']),
          'Initial/changed weekly hours: new ruleId=null, otherwise existing ID and targeted weekdays (Sunday=0).'),
        windowsUpsert: array(obj({ id: nullableString, startsAt: string, endsAt: string, state: { type: 'STRING', enum: ['AVAILABLE','UNAVAILABLE'] }, label: string },
          ['id','startsAt','endsAt','state','label'])), windowIdsRemove: array(string) }), nullable:true,
        description:'PATCH requires actual operations; NONE/CLARIFY uses null. REVIEW/BLOCK cannot propose changes.'}
      }, ['availability']) }, ['assistantMessage','safety','patch','availabilityChange']);
}

// A conversational acknowledgement is not a calendar operation. This provider-only
// intent must agree with the patch before the existing DB writer can accept the turn.
function guardAvailabilityChange(output: Record<string,any>, intent: unknown, context: Record<string,any>) {
  const plan=object(intent);
  if (!plan || !keys(plan,['kind','evidence']) || !['NONE','PATCH','CLARIFY'].includes(plan.kind)
      || typeof plan.evidence!=='string' || plan.evidence.length>1000) throw new Error('WORKER_AI_OUTPUT_INVALID');
  if (!['ALLOW','CLARIFY'].includes(output.safety)) return output;
  const av=object(output.patch.availability), prior=context.candidate.availability;
  const hasOperation=!!av && (['ruleChanges','windowsUpsert','windowIdsRemove'].some(k=>Array.isArray(av[k])&&av[k].length>0)
    || ['timezone','availableNow'].some(k=>Object.hasOwn(av,k)&&av[k]!==prior?.[k]));
  // A quote may differ only in formatting, never in words, negation or hours.
  const normalizeQuote=(value:string)=>value.normalize('NFKC').replace(/\s+/gu,' ').trim().toLowerCase();
  const evidence=normalizeQuote(plan.evidence);
  const supportedEvidence=evidence.length>0 && context.messages.some((m:any)=>m.role==='USER'
    && typeof m.body==='string' && normalizeQuote(m.body).includes(evidence));
  if (plan.kind==='NONE' && !hasOperation) return output;
  if (plan.kind==='PATCH' && supportedEvidence && hasOperation) return output;
  if (plan.kind==='CLARIFY' && supportedEvidence && !hasOperation) {
    // Asking for a genuinely missing part is a valid outcome, not a failed
    // calendar write. Keep its targeted question and unrelated area explanation.
    const {availability: _unchanged,...independent}=output.patch;
    return {...output,safety:'CLARIFY',patch:independent};
  }
  const reason=plan.kind!=='PATCH'?'INTENT_MISMATCH':!hasOperation?'OPERATION_MISSING':'EVIDENCE_MISMATCH';
  try {
    console.info('WORKER_AVAILABILITY_GUARD',reason);
    console.info('WORKER_AVAILABILITY_SHAPE',!!av,Array.isArray(av?.ruleChanges)?av.ruleChanges.length:-1,
      Array.isArray(av?.windowsUpsert)?av.windowsUpsert.length:-1,Array.isArray(av?.windowIdsRemove)?av.windowIdsRemove.length:-1);
  } catch { /* diagnostics cannot fail the turn */ }
  const {availability: _availability,...independent}=output.patch;
  return {...output,safety:'CLARIFY',patch:independent,
    assistantMessage:'Samo još da razjasnimo dostupnost: dopunite deo termina koji nedostaje, bez ponavljanja već navedenih dana i sati. Ostale jasne izmene ostaju u nacrtu.'};
}

export function parseWorkerOutput(raw: unknown) {
  const value = object(raw);
  if (!value || !keys(value, ['assistantMessage','safety','patch']) || !text(value.assistantMessage,1200)
    || !['ALLOW','CLARIFY','REVIEW','BLOCK'].includes(value.safety) || !object(value.patch)
    || Object.keys(value.patch).some(k => !['displayName','bio','skills','tools','vehicles','location','availability','areaRequests'].includes(k))
    || new TextEncoder().encode(JSON.stringify(value)).byteLength > 131072) throw new Error('WORKER_AI_OUTPUT_INVALID');
  if (object(value.patch.location) && Object.hasOwn(value.patch.location,'approximatePosition')) throw new Error('WORKER_AI_OUTPUT_INVALID');
  if(Object.hasOwn(value.patch,'areaRequests'))parseWorkerAreaRequests(value.patch.areaRequests);
  return value;
}

// V1 signed Save still writes historical equipment from the whole candidate.
// This bounded recognizer catches explicit ownership/resource edits without
// treating offered work such as "popravljam vozila" as an equipment claim.
const equipmentNoun = '(?:kombi(?:ja|jem|ju)?|vozil(?:o|a|u|om|ima)|auto(?:mobil(?:a|u|om)?|m|u|a)?|kamion(?:a|u|om)?|prikolic(?:a|u|e|om)|alat(?:a|e|i|om)?|busilic(?:a|u|e|om)|kolic(?:a|ima)|merdevin(?:e|a|ama)|tester(?:a|u|e|om)|masin(?:a|u|e|om)|bicikl(?:a|u|om)?|skuter(?:a|u|om)?)';
const equipmentModifier = '(?:(?:i|novi|nova|novo|novu|svoj|svoja|svoje|svojim|moj|moja|moje|mojim|sopstveni|sopstvena|sopstveno|stari|staru|jedan|jednu|jos|dodatni|dodatnu)\\s+){0,4}';
const equipmentOwnership = new RegExp(`(?:^|[^\\p{L}])(?:imam|nemam|posedujem|kupio sam|kupila sam|nabavio sam|nabavila sam|koristim|raspolazem(?: sa)?)\\s+${equipmentModifier}${equipmentNoun}(?=$|[^\\p{L}])`, 'u');
const equipmentEdit = new RegExp(`(?:^|[^\\p{L}])(?:dodaj|dodam|upisi|unesi|ukloni|obrisi|izbrisi|promeni|zameni)\\s+(?:mi\\s+)?(?:(?:u profil|u opremu)\\s+)?${equipmentModifier}${equipmentNoun}(?=$|[^\\p{L}])`, 'u');
const equipmentPossessive = new RegExp(`(?:^|[^\\p{L}])(?:moj|moja|moje|sopstveni|sopstvena|sopstveno)\\s+${equipmentNoun}(?=$|[^\\p{L}])`, 'u');
const cyrillicEquipmentLetters = Object.fromEntries([
  ['а','a'],['б','b'],['в','v'],['г','g'],['д','d'],['ђ','dj'],['е','e'],['ж','z'],['з','z'],['и','i'],['ј','j'],
  ['к','k'],['л','l'],['љ','lj'],['м','m'],['н','n'],['њ','nj'],['о','o'],['п','p'],['р','r'],['с','s'],['т','t'],
  ['ћ','c'],['у','u'],['ф','f'],['х','h'],['ц','c'],['ч','c'],['џ','dz'],['ш','s'],
]);
function workerEquipmentClaim(value: unknown) {
  if (typeof value !== 'string') return false;
  const normalized=value.toLocaleLowerCase('sr').replace(/[\u0400-\u04ff]/gu, letter => cyrillicEquipmentLetters[letter] ?? letter)
    .normalize('NFKD').replace(/\p{M}/gu,'').replace(/\s+/gu,' ').trim();
  return equipmentOwnership.test(normalized) || equipmentEdit.test(normalized) || equipmentPossessive.test(normalized);
}

// Do not admit equipment keys or a new equipment claim hidden in biography.
// The user turn also fences an unstructured false acknowledgement by the model.
function omitWorkerEquipmentEdits(output: Record<string,any>, userText: string) {
  const structured=Object.hasOwn(output.patch,'tools') || Object.hasOwn(output.patch,'vehicles');
  const bioClaim=workerEquipmentClaim(output.patch.bio);
  if (!structured && !bioClaim && !workerEquipmentClaim(userText)) return output;
  const {tools: _tools,vehicles: _vehicles,...withoutEquipment}=output.patch;
  const {bio: _bio,...independent}=withoutEquipment;
  const patch=structured || bioClaim ? independent : withoutEquipment;
  if (output.safety==='REVIEW' || output.safety==='BLOCK') return {...output,patch};
  return {...output,patch,assistantMessage:
    'Alat i vozila ne menjam kroz ovaj razgovor. '+
    (Object.keys(patch).length ? 'Ostale jasne izmene su u nacrtu.' : 'Možete da nastavite sa uslugama i područjem rada.')};
}

function workerRuntimeContext(context: Record<string, any>, now: string) {
  // WORKER_PROFILE_V1 keeps its legacy wire fields for installed clients. They
  // are neither interview inputs nor writable proposals for a personal profile.
  const { displayName, bio, skills, location, availability, workAreas } = context.candidate;
  // The model needs human work constraints, not geocoder/source coordinates or
  // persistence identities. Keep the original context for all server guards.
  const locationForModel = location ? {
    operatingCountryCode: location.operatingCountryCode, city: location.city, radiusKm: location.radiusKm,
  } : location;
  const areasForModel = Array.isArray(workAreas) ? workAreas.map(area => ({
    kind: area.kind, countryCode: area.countryCode, city: area.city, radiusKm: area.radiusKm,
  })) : undefined;
  const availabilityForModel = availability ? {
    timezone: availability.timezone, availableNow: availability.availableNow,
    rules: availability.rules, windows: availability.windows,
  } : availability;
  const personalCandidate = { displayName, bio, skills, location: locationForModel,
    availability: availabilityForModel, ...(areasForModel ? {workAreas: areasForModel} : {}) };
  return `Server UTC now: ${now}. Existing availability timezone is authoritative for relative dates. Server-owned worker profile status: ${context.profileStatus}. Owned candidate (not verified claims): ${JSON.stringify(personalCandidate)}.`;
}

function instruction() {
  return `${interviewVoiceInstruction()}
WORKER INTAKE (WORKER_PROFILE_V1): understand what ONE person actually offers, how, where and when. The phone already introduced the flow. Do not interview them about an imaginary customer task’s size/price/materials/deadline.
patch contains only declared changes; omission preserves data. Required patch.availability=null when unchanged (server removes it); REVIEW/BLOCK or finish-only: patch {availability:null}.
Priorities: offered services, genuinely unclear execution, ON_SITE territory, relevant availability. Calendar detail/bio are optional. Record independent clear corrections while clarifying another. skills is the COMPLETE offered list: preserve unremoved services, omit unchanged list, keep distinct services separate. English knowledge/van ownership do not imply translation/transport. Related-service suggestions require explicit agreement; never add examples as offers or market unrelated errands to a professional.
Modes/handoff use per-service metadata, not extra patch fields/skills. No home city/address/GPS interview; REMOTE-only needs no city. Country is not inferred from language. Do not ask for equipment, licenses, certificates or permanent team capacity. Equipment is read-only/private: omit edits, explain only if requested, continue other changes. Do not present old equipment as review/matching evidence or invent experience, verification, ratings, priority or legal eligibility.
ON_SITE patch.areaRequests is a COMPLETE list (max 5), preserving untouched areas. COUNTRY/RS: query="", radiusKm=null. CITY: nominative locality, radiusKm=null. RADIUS: locality + explicit 1–200 km. Novi Sad i Beograd = two CITY areas; i okolina needs km. Server resolves places: no coordinates/sourceRef/workAreas or simultaneous legacy patch.location. Unsupported region/cross-border scope: explain and ask Serbian cities/all Serbia; never silently narrow or substitute a giant radius. Search radius changes do not remove service areas.
bio holds introduction/limits, not matching filters. If service/mode/territory changes contradict it, fix only that claim in the SAME patch. When routing is clear and bio absent, offer drafting once without delaying review; explicit request/acceptance gets 2–3 sentences from known facts, no invented credentials/equipment/reliability/contact details/promises.
Required availabilityChange: NONE + empty evidence for no change; PATCH + verbatim USER quote + matching availability operation; CLARIFY + USER quote + availability=null for incomplete intent. Retain partial days/times and ask only what is missing. Weekdays 15–19/weekends off = rule [1,2,3,4,5], not another question. Never acknowledge a change without its operation.
Calendar: preserve untouched rules/days/exceptions and separate daily intervals. ruleChanges uses existing ruleId (null=new), targeted weekdays (Sunday=0), value (null=remove those days). Changing Monday in a Mon/Wed rule targets [1] with that ID; server keeps Wednesday. windowsUpsert: dated AVAILABLE/UNAVAILABLE; windowIdsRemove: explicitly removed IDs only. No invented IDs, whole-calendar overwrite or unrequested timezone change. Timestamps need offsets; clarify ambiguity. availableNow requires stated intent; server owns expiry, exceptions do not toggle it.`;
}

// Exact finish-only utterances, not a substring detector: a negation, quoted
// instruction or a sentence containing a correction must still reach the model.
function finishOnly(input: string): boolean {
  const normalized = input.normalize('NFKC').toLowerCase().trim().replace(/[.!?,…]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Thanks is natural conversation framing, not a second command or a correction.
  // Remove only a complete, bounded greeting/farewell; exact finish intents remain
  // anchored so "to je to, ali promenite..." reaches the normal interview.
  const utterance = normalized.replace(/^(?:hvala(?: vam)?|хвала(?: вам)?)\s+/u, '')
    .replace(/\s+(?:hvala(?: vam)?|хвала(?: вам)?)$/u, '');
  return /^(?:to je to|to je sve|gotovo|gotovo to je sve|sačuvaj|sacuvaj|sačuvaj profil|sacuvaj profil|то је то|то је све|готово|сачувај|сачувај профил)$/.test(utterance);
}

export async function handleWorkerInterview(req: Request): Promise<Response> {
  const startedAt = Date.now();
  if (req.method === 'OPTIONS') return new Response(null,{ status:204,headers:cors });
  if (req.method !== 'POST') return json(405,{code:'METHOD_NOT_ALLOWED'});
  const url = Deno.env.get('SUPABASE_URL') ?? '', anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '', service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const key = Deno.env.get('GEMINI_API_KEY') ?? '', model = Deno.env.get('GEMINI_MODEL') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ') || authorization.length>16384) return json(401,{code:'AUTH_REQUIRED'});
  if (!url || !anon || !service) return json(503,{code:'WORKER_AI_UNAVAILABLE'});
  let input: Record<string, any>, account: string;
  try {
    const body = await requestText(req);
    if (new TextEncoder().encode(body).byteLength>20000) return json(413,{code:'WORKER_AI_INPUT_INVALID'});
    const parsed=object(JSON.parse(body));
    if (!parsed || !keys(parsed,['conversationId','clientRequestId','text']) || !id(parsed.conversationId) || !id(parsed.clientRequestId) || !text(parsed.text,4000))
      return json(400,{code:'WORKER_AI_INPUT_INVALID'});
    input=parsed;
  } catch { return json(400,{code:'WORKER_AI_INPUT_INVALID'}); }
  // A failed Auth transport is not malformed user input or proof of an expired session.
  try {
    const authenticated=await boundedJson(url+'/auth/v1/user',{headers:{apikey:anon,Authorization:authorization}},65536,5000,req.signal);
    if (!authenticated.ok && (authenticated.status===401 || authenticated.status===403)) return json(401,{code:'AUTH_REQUIRED'});
    if (!authenticated.ok || !id(authenticated.data?.id)) return json(503,{code:'AUTH_UNAVAILABLE'});
    account=authenticated.data.id;
  } catch { return json(503,{code:'AUTH_UNAVAILABLE'}); }
  const requestRpc=(name:string,args:Record<string,unknown>,signal:AbortSignal,timeout:number)=>
    boundedJson(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify(args)},524288,timeout,signal);
  const rpc=async(name:string,args:Record<string,unknown>,signal=req.signal,timeout=8000)=> {
    const result=await requestRpc(name,args,signal,timeout);
    if (!result.ok) throw new Error('WORKER_AI_RPC_FAILED'); return result.data;
  };
  const identity={p_account_id:account,p_conversation_id:input.conversationId,p_client_request_id:input.clientRequestId};
  let ownedAttempt: string | null = null, retirementStarted = false;
  let research: ReturnType<typeof createResearchDeadline> | null = null;
  const fail=async()=>{
    research?.dispose();
    if(!ownedAttempt||retirementStarted)return;
    retirementStarted=true;
    // SQL locks this exact turn and cannot overwrite success or clear dispatch.
    // Cleanup must not inherit a disconnected client's aborted signal.
    try { await rpc('rpc_fail_worker_ai_turn_service',{...identity,p_attempt_id:ownedAttempt},new AbortController().signal,5000); }
    catch { /* The existing durable sweep handles a lost cleanup acknowledgement. */ }
  };
  let claim: Record<string,any>, context:Record<string,any>;
  let ownedAreas: ReturnType<typeof decodeWorkerAreas> = null;
  try {
    const value=await rpc('rpc_claim_worker_ai_turn_service',{...identity,p_text:input.text});
    if (!object(value) || typeof value.acquired!=='boolean' || !object(value.turn) || !id(value.turn.turnId) || !id(value.turn.attemptId)
      || value.turn.conversationId!==input.conversationId || value.turn.clientRequestId!==input.clientRequestId) throw new Error('WORKER_AI_INVALID');
    claim=value;
    if (!claim.acquired) return json(200,claim.turn);
    ownedAttempt=claim.turn.attemptId;
    context=await rpc('rpc_read_worker_ai_context_service',{p_account_id:account,p_conversation_id:input.conversationId});
    if (!object(context) || context.schemaVersion!=='WORKER_PROFILE_V1' || context.accountId!==account || context.conversationId!==input.conversationId
      || context.status!=='OPEN' || context.stale!==false || !['ALLOW','CLARIFY'].includes(context.safety)
      || !object(context.candidate) || !Array.isArray(context.messages)) throw new Error('WORKER_AI_INVALID');
    if (Object.hasOwn(context.candidate, 'workAreas')) {
      ownedAreas=decodeWorkerAreas(context.candidate.workAreas);
      if (!ownedAreas) throw new Error('WORKER_AI_INVALID');
    }
  } catch { await fail(); return json(409,{code:'WORKER_AI_NOT_CONFIRMED'}); }
  // Configuration and reservations precede provider I/O. Failed admission is a
  // known failure; later settlement keeps dispatch and request identity intact.
  if (Deno.env.get('AI_PROVIDER')!=='gemini' || model!=='gemini-3.8-flash' || !key || Deno.env.get('USKOCI_GEMINI_PAID_TEST_ENABLED')!=='true') {
    try { await fail(); } catch {} return json(503,{code:'WORKER_AI_NOT_CONFIGURED'});
  }
  research = createResearchDeadline(req.signal, startedAt);
  const singlePassActive = isLiveTaxonomyIntake();
  // Historical flag, same scoped rollout. The selected implementation now uses
  // one foreground call and reuses its catalog/decisions for local validation.
  let fullCatalog: Awaited<ReturnType<typeof loadFullCatalogTree>> | null = null;
  let pendingWorkerClarificationHint: any = null;
  if (singlePassActive) {
    [fullCatalog, pendingWorkerClarificationHint] = await Promise.all([
      measureAiPhase('WORKER_FULL_CATALOG', () => loadFullCatalogTree(
        (name: string, args: Record<string, unknown>, sig?: AbortSignal, t?: number) => rpc(name, args, sig ?? research!.signal, t ?? 2500),
        research.signal)).catch(() => null),
      fetchUnconsumedClarificationHint(
        (name: string, args: Record<string, unknown>, sig?: AbortSignal, t?: number) => rpc(name, args, sig ?? req.signal, t ?? 2500),
        input.conversationId,
        context.revision
      ).catch(() => null),
    ]);
  }
  let serviceModeContext: ReturnType<typeof readWorkerServiceModeContext> | null = null;
  if (singlePassActive) {
    try { serviceModeContext=readWorkerServiceModeContext(context); }
    catch { await fail(); return json(503,{code:'WORKER_AI_NOT_CONFIRMED'}); }
  }
  const history=context.messages.slice(-30).map((row:any)=>({role:row.role==='ASSISTANT'?'model':'user',parts:[{text:String(row.body).slice(0,4000)}]}));
  // Keep a stable instruction prefix; current owned data always follows it.
  const stableParts=[{text:instruction()}, {text:serviceExecutionInstruction('WORKER_CAPABILITY')}];
  const modeParts=serviceModeContext ? [{text:workerServiceModeInstruction(serviceModeContext,false,false)}] : [];
  const runtimePart={text:workerRuntimeContext(context,new Date().toISOString())};
  const modeContextParts=serviceModeContext ? [{text:'Server-owned service mode context: '+JSON.stringify({
    savedServices: serviceModeContext.savedServices, draftServices: serviceModeContext.draftServices,
    unresolvedServices: serviceModeContext.unresolvedServices,
  })}] : [];
  const clarificationPart = pendingWorkerClarificationHint?.ambiguityPrompt ? [{
    text: `Ranije je nedostajalo razjašnjenje: „${pendingWorkerClarificationHint.ambiguityPrompt}“. Najpre proveri da li ga je korisnik već dao u ovoj poruci. Pitaj samo ako ta poslovna činjenica još nedostaje.`
  }] : [];
  const systemParts=[...stableParts,
    ...(singlePassActive ? [{text:singlePassTaxonomyInstruction(fullCatalog,'WORKER_CAPABILITY')}] : []),
    ...modeParts,runtimePart,...clarificationPart,...modeContextParts];
  const interviewSchema=singlePassActive ? withSinglePassTaxonomySchema(workerProviderSchema()) : workerProviderSchema();
  const responseSchema=serviceModeContext ? workerServiceModeSchema(interviewSchema) : interviewSchema;
  if (singlePassActive && serviceModeContext)
    responseSchema.required=[...(responseSchema.required ?? []),'serviceModeChangesJson'];
  const body=JSON.stringify({systemInstruction:{parts:systemParts},contents:history,
    generationConfig:{temperature:0.2,maxOutputTokens:AI_TEST_LIMITS.llmMaxOutputTokens,responseMimeType:'application/json',responseSchema}});
  if (new TextEncoder().encode(body).byteLength>AI_TEST_LIMITS.llmRequestBytes) { try { await fail(); } catch {} return json(413,{code:'WORKER_AI_CONTEXT_TOO_LARGE'}); }
  try {
    if (research.signal.aborted || research.remainingMs() <= 0) throw new Error('WORKER_AI_CANCELLED');
    const reserved=await reserveAiTestBudget({supabaseUrl:url,serviceRoleKey:service,accountId:account,operationId:input.clientRequestId,kind:'LLM',signal:research.signal});
    if (!reserved.admitted || reserved.replay) { try { await fail(); } catch {} return json(503,{code:reserved.code}); }
    if (!reserved.reservationId) throw new Error('WORKER_AI_BUDGET_UNAVAILABLE');
  } catch { try { await fail(); } catch {} return json(503,{code:'WORKER_AI_BUDGET_UNAVAILABLE'}); }
  // The database commits this one dispatch before billable I/O under the same
  // account/session/key locks as cancellation. A lost ACK never grants a retry.
  try {
    const dispatched=await rpc('rpc_dispatch_worker_ai_turn_service',{...identity,p_attempt_id:claim.turn.attemptId},research.signal);
    const t=object(dispatched?.turn);
    if (!object(dispatched)||!keys(dispatched,['dispatched','turn'])||typeof dispatched.dispatched!=='boolean'||!t
      ||!keys(t,['turnId','conversationId','clientRequestId','attemptId','state','retryAllowed','authoritative'])
      ||t.turnId!==claim.turn.turnId||t.attemptId!==claim.turn.attemptId||t.conversationId!==input.conversationId
      ||t.clientRequestId!==input.clientRequestId||!['PROCESSING','UNKNOWN_OUTCOME','FAILED','SUCCEEDED'].includes(t.state)
      ||t.retryAllowed!==false||t.authoritative!==true||(dispatched.dispatched&&t.state!=='PROCESSING')) throw new Error('WORKER_AI_INVALID');
    if (!dispatched.dispatched) { research.dispose(); return json(200,t); }
  } catch { await fail(); return json(409,{code:'WORKER_AI_NOT_CONFIRMED'}); }
  const abort=new AbortController(),stop=()=>{abort.abort();research?.dispose();}; req.signal.addEventListener('abort',stop,{once:true}); if(req.signal.aborted)stop();
  const encoder=new TextEncoder(); let sequence=0;
  const stream=new ReadableStream<Uint8Array>({
    start(controller) {
      const work=(async()=>{
      const send=(kind:string,extra:Record<string,unknown>={})=> {
        if (abort.signal.aborted) throw new Error('WORKER_AI_CANCELLED');
        controller.enqueue(encoder.encode('data: '+JSON.stringify({conversationId:input.conversationId,clientRequestId:input.clientRequestId,
          turnId:claim.turn.turnId,attemptId:claim.turn.attemptId,sequence:++sequence,kind,...extra})+'\n\n'));
      };
      const usage:{value:GeminiUsage|null}={value:null};
      const analyzeOutput = (raw: string) => {
        let output:Record<string,any>;
        let serviceModeChangesJson: unknown;
        let taxonomyDecisions: any[] = [];
        try {
          const providerOutput = JSON.parse(raw);
          const extracted = singlePassActive ? takeSinglePassTaxonomy(providerOutput) : {output:providerOutput,decisions:[]};
          taxonomyDecisions = extracted.decisions;
          const {availabilityChange,...parsed} = extracted.output;
          // Provider must explicitly decide about the calendar. Null means no
          // change, not clearing it; the existing database patch stays sparse.
          if (object(parsed.patch)?.availability === null) {
            const {availability: _unchanged,...rest}=parsed.patch;
            parsed.patch=rest;
          }
          let classified = parsed;
          if (serviceModeContext && object(parsed)) {
            const {serviceModeChangesJson:changes,...remaining}=parsed;
            serviceModeChangesJson=changes; classified=remaining;
          }
          output=guardAvailabilityChange(parseWorkerOutput(classified),availabilityChange,context);
          if(!Object.hasOwn(output.patch,'areaRequests'))output=guardWorkerAreaOutput(output,input.text,context);
        } catch { throw new Error('WORKER_AI_INVALID'); }
        if (finishOnly(input.text) && ['ALLOW','CLARIFY'].includes(output.safety)) {
          // Finish adds no profile edits or consent. The model may still ask
          // for a missing business fact; signed readiness owns the final card.
          output={...output,patch:{}};
        }
        return {output,serviceModeChangesJson,taxonomyDecisions};
      };

      try {
        send('accepted');
        // A single provider response carries dialogue, business changes and
        // private classification. Prose is released only after durable completion.
        const raw=await measureAiPhase('PROVIDER', () => streamGeminiTask({url:`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
          key,body,signal:research!.signal,onText:()=>{},onUsage:value=>{usage.value=value;},timeoutMs:30000}));
        const {output: preparedOutput,serviceModeChangesJson,taxonomyDecisions} = analyzeOutput(raw);
        let output = preparedOutput;
        research!.dispose();
        // The answer is complete. A disconnected phone must not cancel its
        // bounded persistence; explicit cancellation is still checked by SQL.
        const completionSignal=new AbortController().signal;
        output=omitWorkerEquipmentEdits(output,input.text);
        if(Object.hasOwn(output.patch,'areaRequests')){
          const {areaRequests,location:_legacyLocation,...independent}=output.patch;
          output={...output,patch:independent};
          if(['ALLOW','CLARIFY'].includes(output.safety)){
            try{
              const workAreas=await resolveWorkerAreas(areaRequests,{token:Deno.env.get('LOCATIONIQ_ACCESS_TOKEN'),requestJson:boundedJson,signal:completionSignal,
                ownedAreas:ownedAreas??[]});
              output={...output,patch:{...independent,workAreas}};
            }catch(error){
              // A proposed biography can already claim the new territory. Keep
              // the previous bio together with the previous areas until both
              // can be saved coherently; independent services/calendar survive.
              const {bio:_unresolvedAreaBio,...areaIndependent}=independent;
              const clarify=error instanceof Error && ['WORKER_AREA_INVALID','WORKER_AREA_UNRESOLVED'].includes(error.message);
              output={...output,safety:'CLARIFY',patch:areaIndependent,
                assistantMessage:clarify
                  ? 'Područje rada nije jednoznačno određeno. Navedite tačan grad u Srbiji ili „cela Srbija“. Prethodno područje i opis ostaju u nacrtu, uz ostale jasne izmene.'
                  : 'Provera područja rada trenutno nije dostupna. Vaša poruka ostaje u razgovoru; prethodno područje i opis ostaju u nacrtu, uz ostale jasne izmene.'};
            }
          }
        }
        // REVIEW/BLOCK freeze the candidate in the database. Provider prose
        // cannot acknowledge a patch that the authoritative writer discards.
        // Preserve the safety decision; never turn a rejection into ALLOW.
        if (output.safety==='REVIEW' || output.safety==='BLOCK') {
          output={...output,patch:{},assistantMessage:output.safety==='REVIEW'
            ? 'Ovaj predlog je označen za dodatnu proveru i ne može da se sačuva. Nacrt nije promenjen.'
            : 'Ovaj zahtev ne mogu da obradim. Nacrt nije promenjen.'};
        }
        let builtTaxonomy: any = null;
        if (singlePassActive && ['ALLOW','CLARIFY'].includes(output.safety)) {
          const effectiveSkills = output.patch.skills ?? context.candidate?.skills ?? [];
          // Classification is already in the one paid reply. Validate it against
          // guarded facts and USER quotes; never start a second model here.
          // Every completed answer advances the draft revision, including a
          // bio-only edit. Carry current owned IDs forward even when no fresh
          // model decision is needed; the pure builder revalidates them against
          // this catalog and never restores removed services or grants consent.
          if (Array.isArray(effectiveSkills) && effectiveSkills.length > 0) {
            // Local validation of the already paid response; no background provider.
            builtTaxonomy = await measureAiPhase('WORKER_TAXONOMY_VALIDATE', () => buildWorkerFullTreeTaxonomyProposals({
              suppliedCatalog: fullCatalog,
              suppliedDecisions: taxonomyDecisions,
              skills: effectiveSkills,
              messages: context.messages,
              serviceModeContext: context.serviceModeContext,
              serviceModeChangesJson,
              conversationId: input.conversationId,
              // The completed turn increments the durable worker candidate once.
              draftRevision: context.revision + 1,
            })).catch(() => null);
          }
        }
        const taxonomyPlan = singlePassCapturePlan(builtTaxonomy, fullCatalog);
        if (singlePassActive && (output.patch.skills ?? context.candidate?.skills ?? []).length > 0)
          output = withUnresolvedSinglePassReply(output, builtTaxonomy, taxonomyPlan);
        if (builtTaxonomy?.proposals?.length && !taxonomyPlan) console.info('WORKER_TAXONOMY_HINT_CAPTURE', 'PAYLOAD_UNAVAILABLE');
        // Requires the paired LOCAL_ONLY SQL candidate's reviewed promotion.
        // An absent RPC/lost ACK never triggers a split write or another model.
        const completionRpc=taxonomyPlan ? 'rpc_complete_worker_ai_turn_with_first_plan_service' : 'rpc_complete_worker_ai_turn_service';
        const completionArgs={...identity,p_attempt_id:claim.turn.attemptId,p_output:output,
          ...(taxonomyPlan ? {p_taxonomy_plan:taxonomyPlan} : {})};
        const decodeCompletion=(envelope:unknown)=>{
          const turn=taxonomyPlan ? singlePassCompletion(envelope) : object(envelope);
          if (!object(turn)||!keys(turn,['turnId','conversationId','clientRequestId','attemptId','state','retryAllowed','authoritative'])
            ||turn.state!=='SUCCEEDED'||turn.retryAllowed!==false||turn.authoritative!==true
            ||turn.turnId!==claim.turn.turnId||turn.attemptId!==claim.turn.attemptId
            ||turn.conversationId!==input.conversationId||turn.clientRequestId!==input.clientRequestId) throw new Error('WORKER_AI_INVALID');
          return turn;
        };
        const turn=await measureAiPhase('WORKER_COMPLETE', async()=>taxonomyPlan
          ? completeFirstPlan({rpc:requestRpc,writer:completionRpc,args:completionArgs,decode:decodeCompletion})
          : decodeCompletion(await rpc(completionRpc,completionArgs,completionSignal)));
        if (turn.state === 'SUCCEEDED' && pendingWorkerClarificationHint?.service) {
          // Consumption belongs to the confirmed turn, not the classifier's budget.
          const consumeSignal = new AbortController().signal;
          void runInBackground(persistConsumeClarificationHint(
            (name: string, args: Record<string, unknown>, sig?: AbortSignal, t?: number) => rpc(name, args, sig ?? consumeSignal, t ?? 2500),
            input.conversationId, context.revision, pendingWorkerClarificationHint.service));
        }
        if (turn.state === 'SUCCEEDED' && builtTaxonomy?.clarifications?.length) {
          const hintSignal = new AbortController().signal;
          void runInBackground(Promise.all(builtTaxonomy.clarifications.slice(0,1).map((hint: any) =>
            persistClarificationHint((name: string,args:Record<string,unknown>,sig?:AbortSignal,t?:number) =>
              rpc(name,args,sig??hintSignal,t??2500),hint).then(stored => {
                if (!stored) { try { console.warn('WORKER_TAXONOMY_HINT_STORE', 'UNAVAILABLE'); } catch { /* Nonfatal diagnostics. */ } }
              }))));
        }
        if(!abort.signal.aborted){send('text_delta',{text:output.assistantMessage});send('final',{turn});}
      } catch (error) { await fail(); if(!abort.signal.aborted) { try { send('safe_error',{code:
        req.headers.get(AI_DIAGNOSTICS_HEADER)===AI_DIAGNOSTICS_VERSION && error instanceof GeminiCreditsUnavailableError
          ? AI_CREDITS_UNAVAILABLE : 'AI_TURN_NOT_CONFIRMED'}); } catch {} } }
      finally {
        research?.dispose();
        // Completed provider usage remains payable after invalid output or a
        // disconnected client. Unknown/incomplete usage retains its reservation.
        if (usage.value) {
          const usageVal = usage.value;
          const recordUsage = async () => {
            try { await rpc('rpc_ai_test_record_usage_service',{p_operation_id:input.clientRequestId,p_model:model,
              p_prompt_tokens:usageVal.promptTokens,p_output_tokens:usageVal.outputTokens,p_total_tokens:usageVal.totalTokens},new AbortController().signal,3000); } catch {}
          };
          void runInBackground(recordUsage());
        }
        req.signal.removeEventListener('abort',stop); if(!abort.signal.aborted) { try {controller.close();}catch{} } abort.abort();
      }
      })();
      void runInBackground(work);
      return work;
    }, cancel(){stop();req.signal.removeEventListener('abort',stop);}
  });
  return new Response(stream,{headers:{...cors,'Content-Type':'text/event-stream; charset=utf-8','X-Accel-Buffering':'no'}});
}
Deno.serve(handleWorkerInterview);
