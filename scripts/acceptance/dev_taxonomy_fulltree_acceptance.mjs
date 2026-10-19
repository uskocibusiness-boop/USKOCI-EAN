#!/usr/bin/env node
/**
 * Isolated taxonomy acceptance, deliberately dry by default.
 * Conversation and Save are separate invocations. Neither can publish a task,
 * activate a worker, invoke matching/push, patch facts or resume a user draft.
 * Private catalog/binding evidence comes from an independent READ ONLY observer;
 * the authenticated client has no service-role credential or invented claims.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TARGET = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
export const MILOS = '0640a1bd-5e0a-4462-9dca-f49420582c8a';
const MILOS_PROFILE = 'ab577158-b930-43f4-9376-52bedccc4cfe';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ATTEMPTS = 12, RESERVATION_MICROUSD = 250000, RUN_CAP_MICROUSD = 3000000;
const ROLES = new Set(['DEV_ACCEPTANCE_QA', 'SYNTHETIC_ACCEPTANCE_FIXTURE']);
const STATES = new Set(['READY', 'PENDING_CLASSIFICATION', 'REVIEW_REQUIRED',
  'SERVICE_MODE_CONFIRMATION_REQUIRED', 'CATALOG_UNAVAILABLE', 'STALE_CATALOG']);
const RPCS = new Set(['rpc_open_worker_ai', 'rpc_read_worker_ai_taxonomy',
  'rpc_prepare_worker_ai_review_taxonomy', 'rpc_read_worker_ai_turn_recovery',
  'rpc_ai_open_need_conversation_owned_v2', 'rpc_ai_read_need_turn_v2',
  'rpc_prepare_ai_task_review_taxonomy', 'rpc_read_ai_task_review',
  'rpc_accept_ai_task_review', 'rpc_save_worker_ai_review']);
const STANDARD_CASES = Object.freeze({
  'need-existing': { flow: 'need', expectation: 'EXACT_EXISTING_REUSE', messages: [
    'Treba mi izrada male figurice na 3D štampaču prema gotovom STL fajlu. Izrađuje se kod izvršioca i šalje mi se, ne radi se kod mene. Rad na daljinu, jedan izvršilac, fleksibilan termin, cenu dogovaramo.',
    'To je to. Otvori pregled; još ništa ne objavljuj.'] },
  'need-novel': { flow: 'need', expectation: 'SEMANTIC_REVIEW_NO_FORCED_NOVELTY', messages: [
    'Treba mi autorska izrada taktilne reljefne karte zvezdanog neba za slepu osobu: prilagoditi raspored zvezda dodiru i dodati Brajevo pismo. Ne samo odštampati gotov model. Radi se kod izvršioca i šalje mi se. Na daljinu, jedan izvršilac, termin fleksibilan, cena po dogovoru.',
    'To je cela usluga. Otvori pregled bez objave.'] },
  'need-clarify': { flow: 'need', expectation: 'CLARIFY_NOT_READY', messages: [
    'Treba mi pomoć oko jedne stvari, ali još nisam rekao kakav posao treba uraditi.'] },
  'worker-existing': { flow: 'worker', expectation: 'EXACT_EXISTING_REUSE', messages: [
    'Nudim izradu figurica na 3D štampaču prema gotovim STL fajlovima. Radim isključivo kod sebe i šaljem izrađeno, bez dolaska kod naručioca. Samo rad na daljinu. Grad profila Novi Sad, Srbija. Dostupnost po dogovoru.',
    'To je to. Otvori pregled. Profil ne aktiviraj.'] },
  'worker-novel': { flow: 'worker', expectation: 'SEMANTIC_REVIEW_NO_FORCED_NOVELTY', messages: [
    'Nudim autorsku izradu taktilnih reljefnih karata zvezdanog neba za slepe: prilagođavam raspored zvezda dodiru i dodajem Brajevo pismo. Ne nudim samo štampanje gotovih modela. Izrađujem kod sebe i šaljem, isključivo na daljinu. Grad profila Novi Sad, Srbija. Dostupnost po dogovoru.',
    'To je to. Otvori pregled bez aktiviranja profila.'] },
  'worker-clarify': { flow: 'worker', expectation: 'CLARIFY_NOT_READY', messages: [
    'Želim da radim nešto, ali još nisam rekao koje konkretne usluge nudim.'] },
});
const CASES = Object.freeze({ ...STANDARD_CASES,
  'need-budget-correction-execution': {flow:'need',expectation:'PHYSICAL_HANDOFF',messages:[
    'Treba mi izrada jedne male 3D figurice prema gotovom STL fajlu. Izrađuje se kod izvršioca i šalje kurirskom službom u Srbiji. Nema dolaska kod mene ni ličnog preuzimanja. Jedan izvršilac, termin potpuno fleksibilan, tražim ponude.',
    'Menjam samo budžet: nudim ukupno 5000 dinara za ceo zadatak. Sve ostalo ostaje isto.']},
  'need-pickup-execution': {flow:'need',expectation:'PHYSICAL_HANDOFF',messages:[
    'Treba mi izrada jedne male 3D figurice prema gotovom STL fajlu. Izrađuje se kod izvršioca, bez dolaska kod mene. Samo lično preuzimanje u Novom Sadu, Srbija, ne želim slanje. Jedan izvršilac, termin potpuno fleksibilan, tražim ponude.']},
  'need-shipping-execution': {flow:'need',expectation:'PHYSICAL_HANDOFF',messages:[
    'Treba mi izrada jedne male 3D figurice prema gotovom STL fajlu. Izrađuje se kod izvršioca i šalje kurirskom službom na adresu u Srbiji. Nema dolaska kod mene ni ličnog preuzimanja. Jedan izvršilac, termin potpuno fleksibilan, tražim ponude.']},
  'need-digital-execution': {flow:'need',expectation:'DIGITAL_HANDOFF',messages:[
    'Treba mi izrada prezentacije od 10 slajdova iz teksta koji ću dostaviti. Sve je digitalno, gotov PowerPoint fajl preuzimam onlajn. Srbija, jedan izvršilac, potpuno fleksibilan termin, tražim ponude.']},
  'need-impossible-execution': {flow:'need',expectation:'IMPOSSIBLE_REMOTE_NOT_READY',messages:[
    'Treba mi da neko fizički okreči zidove mog stana u Novom Sadu, ali hoću da to uradi na daljinu bez dolaska. Ne želim savetovanje niti uputstva, nego stvarno okrečene zidove. Jedan izvršilac, fleksibilno, tražim ponude.']},
  'need-rare-execution': {flow:'need',expectation:'PHYSICAL_HANDOFF',messages:[
    'Treba mi restauracija stare mehaničke muzičke kutije: čišćenje, popravka opružnog mehanizma i podešavanje metalnog češlja. Šaljem predmet majstoru kurirskom službom unutar Srbije, radi kod sebe i vraća mi ga dostavom u Srbiji. Jedan izvršilac, potpuno fleksibilan termin, tražim ponude.']},
  // Optional live precondition: this existing service still supports ON_SITE only.
  // After a successful signed Save adds REMOTE, a rerun should reuse it instead.
  'need-typewriter-shipping-execution': {flow:'need',expectation:'PHYSICAL_HANDOFF',
    expectedCategoryId:'11e218ed-e072-4609-bcee-9576aa4c2e16',expectedAction:'EXTEND_MODE',messages:[
    'Treba mi popravka ručne mehaničke pisaće mašine: zaglavljuju se tipke, potrebno je čišćenje i podešavanje mehaničkog sklopa. Mašina nije električna i nema elektronskih delova. Šaljem je kurirskom službom u radionicu majstora unutar Srbije, tamo je popravlja i vraća mi je kurirskom službom u Srbiji. Nema dolaska kod mene ni ličnog preuzimanja. Jedan izvršilac, termin potpuno fleksibilan, tražim ponude.']},
  'worker-shipping-execution': {flow:'worker',expectation:'PHYSICAL_HANDOFF',requiresHandoffClarification:true,messages:[
    'Nudim 3D štampanje figurica prema gotovom STL fajlu. Izrađujem kod sebe u radionici, bez dolaska kod naručioca. Grad profila Novi Sad, Srbija. Dostupnost po dogovoru.',
    'Šaljem izrađene figurice kurirskom službom samo u Srbiji. Ne nudim lično preuzimanje niti dolazak kod naručioca.']},
  ...Object.fromEntries(['need-existing','worker-existing','need-novel'].map(name => [name+'-tools',
    {...STANDARD_CASES[name],messages:[STANDARD_CASES[name].messages[0]]}])),
  'need-rare-tools': {flow:'need',expectation:'SEMANTIC_REVIEW_NO_FORCED_NOVELTY',messages:[
    'Treba mi restauracija stare mehaničke muzičke kutije: čišćenje, popravka opružnog mehanizma i podešavanje metalnog češlja da ponovo pravilno svira. Predmet šaljem izvršiocu, rad se obavlja kod njega i vraća mi se dostavom. Na daljinu, jedan izvršilac, fleksibilan termin, tražim ponude.']},
});
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const assert = (condition, code) => { if (!condition) throw new Error(code); };
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const readJson = path => JSON.parse(readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, ''));

export function configuration(env, argv) {
  const execute = argv.includes('--execute');
  const phase = argv.find(x => x.startsWith('--phase='))?.slice(8) ?? 'conversation';
  const names = (env.USKOCI_QA_CASES ?? 'need-existing,need-novel,need-clarify,worker-existing').split(',');
  const toolRun = names.some(name => name.endsWith('-tools'));
  const executionRun = names.some(name => name.endsWith('-execution'));
  const maxAttempts = Number(env.USKOCI_QA_MAX_ATTEMPTS ?? (toolRun ? 3 : MAX_ATTEMPTS));
  const accountId = (env.USKOCI_QA_EXPECTED_ACCOUNT_ID ?? '').toLowerCase();
  assert((env.USKOCI_QA_URL ?? TARGET) === TARGET, 'CANONICAL_DEV_ONLY');
  assert(['conversation', 'save-fixture'].includes(phase), 'INVALID_PHASE');
  assert(names.length > 0 && new Set(names).size === names.length && names.every(x => Object.hasOwn(CASES, x)), 'INVALID_CASES');
  assert(!toolRun || names.every(name => name.endsWith('-tools')) && phase === 'conversation', 'TOOLS_CONVERSATION_ONLY');
  assert(!toolRun || maxAttempts <= 3, 'MAX_3_LOGICAL_REQUESTS');
  assert(!executionRun || names.every(name => name.endsWith('-execution')) && maxAttempts <= 8, 'EXECUTION_MAX_8_LOGICAL_REQUESTS');
  assert(names.filter(x => CASES[x].flow === 'worker').length <= 1, 'ONE_NEW_WORKER_CONVERSATION_PER_ACCOUNT');
  assert(Number.isInteger(maxAttempts) && maxAttempts > 0 && maxAttempts <= MAX_ATTEMPTS, 'MAX_12_ATTEMPTS');
  assert(names.reduce((n, name) => n + CASES[name].messages.length, 0) <= maxAttempts || phase === 'save-fixture', 'CASE_BUDGET_EXCEEDED');
  if (execute) {
    assert(UUID.test(accountId) && !same(accountId, MILOS), 'ISOLATED_EXPECTED_ACCOUNT_REQUIRED');
    assert(env.USKOCI_QA_ACCESS_TOKEN || env.DEV_ACCEPTANCE_EMAIL && env.DEV_ACCEPTANCE_PASSWORD, 'QA_AUTH_REQUIRED');
    assert(env.USKOCI_QA_ATTESTATION_FILE, 'READ_ONLY_ISOLATION_ATTESTATION_REQUIRED');
    assert(env.USKOCI_QA_SOURCE_SHA && /^[a-f0-9]{40}$/.test(env.USKOCI_QA_SOURCE_SHA), 'EXACT_SOURCE_SHA_REQUIRED');
    if (phase === 'save-fixture') assert(env.USKOCI_QA_PREPARED_REPORT, 'PREPARED_REPORT_REQUIRED');
  }
  return { execute, phase, names, maxAttempts, accountId, url: TARGET, toolRun, executionRun,
    providerAttemptsPerRequest: toolRun || executionRun ? 4 : 1,
    runReservationCapMicrousd: toolRun || executionRun ? maxAttempts * 4 * RESERVATION_MICROUSD : RUN_CAP_MICROUSD };
}

/** Correlation only: these IDs are possible attempts, not proof they were billed
 * or even dispatched. The independent server observer reads reservations/usage. */
export function expectedProviderOperations(accountId, conversationId, operationId, count = 4) {
  assert([accountId,conversationId,operationId].every(value => UUID.test(value)) && Number.isInteger(count) && count >= 1 && count <= 4,
    'PROVIDER_OPERATION_ID_INPUT');
  return Array.from({length:count}, (_unused,index) => {
    const attempt = index + 1;
    if (attempt === 1) return { attempt, operationId };
    const bytes = createHash('sha256').update(['USKOCI_TAXONOMY_PROVIDER_ROUND_V1',accountId,conversationId,operationId,String(attempt)].join('|')).digest();
    bytes[6] = (bytes[6] & 15) | 128; bytes[8] = (bytes[8] & 63) | 128;
    const h = bytes.subarray(0,16).toString('hex');
    return {attempt,operationId:`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`};
  });
}

/** Only an owned successful readback authorizes recording reply text as confirmed.
 * V2 JSON normally carries a message receipt rather than the assistant body. */
export function confirmedAssistantEvidence(response, identity, currentTurn, messageRows = null, workerSnapshot = null) {
  const owns = value => value && same(value.conversationId,identity.conversationId) && same(value.clientRequestId,identity.clientRequestId)
    && same(value.turnId,currentTurn?.turnId);
  assert(owns(currentTurn) && UUID.test(currentTurn.turnId) && currentTurn.state === 'SUCCEEDED', 'TURN_NOT_CONFIRMED_STOP_NO_RETRY');
  const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1500;
  const lines = response.raw.split(/\r?\n/).filter(line => line.startsWith('data:'));
  const events = lines.map(line => {
    try { return JSON.parse(line.slice(5).trim()); } catch { throw new Error('SSE_EVENT_INVALID'); }
  });
  let assistantText = '', assistantTextSource = 'UNAVAILABLE';
  const responseFormat = events.length ? 'SSE' : 'JSON';
  if (events.length) {
    let attemptId;
    for (const [index,event] of events.entries()) {
      assert(owns(event) && UUID.test(event.attemptId) && (!attemptId || same(event.attemptId,attemptId)), 'SSE_IDENTITY_MISMATCH');
      attemptId = event.attemptId;
      assert(event.sequence === index+1 && ['accepted','text_delta','final','safe_error'].includes(event.kind), 'SSE_EVENT_INVALID');
      if (event.kind === 'text_delta') assert(typeof event.text === 'string', 'SSE_TEXT_INVALID');
      if (event.kind === 'final') assert(owns(event.turn) && event.turn.state === 'SUCCEEDED', 'SSE_FINAL_IDENTITY_MISMATCH');
    }
    assert(events[0].kind === 'accepted', 'SSE_ACCEPTANCE_MISSING');
    if (events.at(-1).kind === 'final') {
      assistantText = events.filter(event=>event.kind==='text_delta').map(event=>event.text).join('');
      if (text(assistantText)) assistantTextSource = 'SSE_CONFIRMED';
      else assistantText = '';
    }
  } else {
    const value = response.value, envelope = value?.turn ?? value;
    assert(owns(envelope), 'JSON_TURN_IDENTITY_MISMATCH');
    if (envelope.state === 'SUCCEEDED' && text(value?.assistantMessage)) {
      assistantText = value.assistantMessage; assistantTextSource = 'JSON_CONFIRMED';
    }
  }
  if (!assistantText && messageRows !== null) {
    const messageId=currentTurn.receipt?.assistantMessageId;
    assert(UUID.test(messageId) && currentTurn.receipt?.authoritative === true && Array.isArray(messageRows) && messageRows.length===1,
      'ASSISTANT_MESSAGE_RECEIPT_INVALID');
    const row=messageRows[0];
    assert(same(row.id,messageId) && same(row.account_id,identity.accountId) && same(row.conversation_id,identity.conversationId)
      && row.role==='ASSISTANT' && text(row.body), 'ASSISTANT_MESSAGE_OWNER_MISMATCH');
    assistantText=row.body; assistantTextSource='OWNED_MESSAGE_READBACK';
  }
  if (!assistantText && workerSnapshot) {
    assert(same(workerSnapshot.accountId,identity.accountId) && same(workerSnapshot.conversationId,identity.conversationId)
      && owns(workerSnapshot.turn) && workerSnapshot.turn.state==='SUCCEEDED' && Array.isArray(workerSnapshot.messages), 'WORKER_REPLY_OWNER_MISMATCH');
    const message=workerSnapshot.messages.at(-1);
    assert(message?.role==='ASSISTANT' && UUID.test(message.id) && text(message.body), 'WORKER_REPLY_UNAVAILABLE');
    assistantText=message.body; assistantTextSource='OWNED_WORKER_SNAPSHOT';
  }
  return {assistantText,assistantTextSource,responseFormat,eventKinds:[...new Set(events.map(event=>event.kind))]};
}

export function checkAttestation(a, accountId, now = Date.now()) {
  assert(a?.schema === 'USKOCI_QA_READ_ONLY_V1' && a.projectRef === 'leqcwgzvjsxugfgzdmth', 'INVALID_OBSERVER_TARGET');
  const age = now - Date.parse(a.checkedAt);
  assert(Number.isFinite(age) && age >= -30000 && age <= 3600000, 'OBSERVER_STALE');
  assert(same(a.accountId, accountId) && !same(a.accountId, MILOS) && ROLES.has(a.lineage)
    && a.discoveryTestWorld === true && a.aiAdmitted === true && a.emailConfirmed === true, 'QA_ISOLATION_NOT_CONFIRMED');
  assert(a.workerProfileId === null || UUID.test(a.workerProfileId) && !same(a.workerProfileId, MILOS_PROFILE), 'WORKER_PROFILE_DENIED');
  assert(a.workerStatus === null || ['DRAFT', 'ACTIVE'].includes(a.workerStatus), 'WORKER_STATUS_INVALID');
  assert(a.snapshot && typeof a.snapshot.catalogFingerprint === 'string' && /^[a-f0-9]{32}$/.test(a.snapshot.catalogFingerprint), 'OBSERVER_SNAPSHOT_REQUIRED');
  return a;
}

export function compareNoPreSaveChanges(before, after) {
  for (const key of ['catalogFingerprint', 'workerBindingsDigest', 'needBindingsDigest', 'workerCanonicalDigest', 'needsCanonicalDigest']) {
    assert(typeof before?.[key] === 'string' && before[key] === after?.[key], `PRESAVE_CHANGED_${key}`);
  }
}

/** Acceptance assertion only: never substitutes a category or repairs the review. */
export function checkExistingModeExtension(review, expectedCategoryId) {
  assert(UUID.test(expectedCategoryId) && review?.classificationState === 'READY'
    && review.canAccept === true && review.location?.geography?.mode === 'REMOTE', 'MODE_EXTENSION_REVIEW_NOT_READY');
  const plans = review.classificationCandidates;
  assert(Array.isArray(plans) && plans.length === 1 && plans[0]?.action === 'EXTEND_MODE'
    && plans[0].mode === 'REMOTE' && same(plans[0].categoryId, expectedCategoryId), 'MODE_EXTENSION_DID_NOT_PRESERVE_CATEGORY');
  assert(plans[0].handoff?.required === true && !plans[0].handoff.localExchange
    && JSON.stringify(plans[0].handoff.shippingCountries) === '["RS"]', 'MODE_EXTENSION_SHIPPING_SCOPE_CHANGED');
}

/** Authority is checked structurally; the question signal is only a QA aid.
 * The retained owned reply must still be inspected for a useful, honest question. */
export function checkWorkerHandoffClarification(review, evidence) {
  assert(evidence?.outcome === 'OWNED_SUCCEEDED_READBACK'
    && ['SSE_CONFIRMED','JSON_CONFIRMED','OWNED_WORKER_SNAPSHOT'].includes(evidence.assistantTextSource)
    && typeof evidence.assistantText === 'string' && evidence.assistantText.trim(), 'WORKER_HANDOFF_REPLY_NOT_CONFIRMED');
  assert(Array.isArray(review?.classificationCandidates)
    && review.classificationCandidates.every(plan => plan && !Object.hasOwn(plan,'handoff')),
    'WORKER_HANDOFF_INVENTED_BEFORE_ANSWER');
  const questionSignal = evidence.assistantText.split('?').slice(0,-1)
    .some(part => /predaj|preuzim|slanj|šalj|salj|dostav|kurir|предај|преузим|слањ|шаљ|достав|курир/iu.test(part));
  return { classificationState:review.classificationState,canAccept:review.canAccept,
    handoffSpecified:false,questionSignalDetected:questionSignal,questionMeaning:'HUMAN_REVIEW_REQUIRED',
    assistantText:evidence.assistantText,assistantTextSource:evidence.assistantTextSource,
    clientRequestId:evidence.clientRequestId };
}

function checkReview(review, accountId, cid) {
  assert(review && UUID.test(review.reviewId) && same(review.accountId, accountId)
    && same(review.conversationId, cid) && /^[a-f0-9]{64}$/.test(review.displayedContentDigest)
    && Date.parse(review.expiresAt) > Date.now(), 'INVALID_OR_EXPIRED_OWNED_REVIEW');
  assert(STATES.has(review.classificationState) && Array.isArray(review.classificationCandidates), 'SIGNED_CLASSIFICATION_REQUIRED');
  if (review.classificationState === 'READY') {
    assert(review.classificationCandidates.length > 0 && Number.isSafeInteger(review.classificationCatalogVersion)
      && /^[a-f0-9]{32}$/.test(review.classificationCatalogFingerprint), 'READY_CATALOG_REQUIRED');
  }
  return review;
}

/** This SQL is evidence collection only. It cannot grant authority or execute Save. */
export function observerSql(accountId) {
  assert(UUID.test(accountId) && !same(accountId, MILOS), 'OBSERVER_ACCOUNT_DENIED');
  return `-- READ ONLY; output contains no email, token, messages or address.
select jsonb_build_object(
 'schema','USKOCI_QA_READ_ONLY_V1','projectRef','leqcwgzvjsxugfgzdmth',
 'checkedAt',clock_timestamp(),'accountId',u.id,'emailConfirmed',u.email_confirmed_at is not null,
 'lineage',l.lineage,'discoveryTestWorld',u.id=any(rls_private.p6_discovery_test_world_accounts()),
 'aiAdmitted',exists(select 1 from private.ai_test_accounts_v5 t where t.account_id=u.id and t.retired_at is null),
 'workerProfileId',w.id,'workerStatus',w.profile_status,
 'snapshot',jsonb_build_object(
  'catalogFingerprint',private.taxonomy_admission_fingerprint_v1(),
  'workerBindingsDigest',md5(coalesce((select jsonb_agg(to_jsonb(b) order by b.source_review_id)::text from private.work_taxonomy_worker_bindings_v1 b where b.owner_account_id=u.id),'[]')),
  'needBindingsDigest',md5(coalesce((select jsonb_agg(to_jsonb(b) order by b.source_review_id)::text from private.work_taxonomy_need_bindings_v1 b where b.owner_account_id=u.id),'[]')),
  'workerCanonicalDigest',md5(coalesce(to_jsonb(w)::text,'null')),
  'needsCanonicalDigest',md5(coalesce((select jsonb_agg(to_jsonb(n) order by n.id)::text from public.needs n where n.requester_account_id=u.id),'[]'))),
 'workerBindings',coalesce((select jsonb_agg(jsonb_build_object('reviewId',b.source_review_id,'profileId',b.profile_id,'result',b.result) order by b.source_review_id) from private.work_taxonomy_worker_bindings_v1 b where b.owner_account_id=u.id),'[]'),
 'needBindings',coalesce((select jsonb_agg(jsonb_build_object('reviewId',b.source_review_id,'needId',b.need_id,'categoryId',b.category_id,'result',b.result) order by b.source_review_id) from private.work_taxonomy_need_bindings_v1 b where b.owner_account_id=u.id),'[]'),
 'needs',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'status',n.status,'revision',n.revision,'publishedAt',n.published_at) order by n.id) from public.needs n where n.requester_account_id=u.id),'[]')
) as observation
from auth.users u
join private.account_lineage_v5 l on l.account_id=u.id
left join public.app_profiles w on w.account_id=u.id and w.kind='WORKER'
where u.id='${accountId}';
`;
}

export async function run(env = process.env, argv = process.argv.slice(2)) {
  const config = configuration(env, argv);
  if (!config.execute) return { result: 'DRY_RUN_NO_IO', ...config, maxReservationMicrousd: config.runReservationCapMicrousd,
    maxLogicalRequests: config.maxAttempts, maxProviderAttempts: config.maxAttempts * config.providerAttemptsPerRequest,
    cases: config.names.map(name => ({ name, ...CASES[name] })),
    note: config.toolRun
      ? 'No authentication, AI, database writes or Save. Provider attempt IDs and reservation ceilings are possible bounds, never observed calls or actual billing.'
      : 'No authentication, AI, database writes or Save. Seven-level branching is a deterministic proof, never forced fake live taxonomy.' };
  const attestation = checkAttestation(readJson(env.USKOCI_QA_ATTESTATION_FILE), config.accountId);
  const output = resolve(env.USKOCI_QA_OUT ?? 'artifacts/taxonomy-fulltree', randomUUID());
  mkdirSync(output, { recursive: true });
  let token = env.USKOCI_QA_ACCESS_TOKEN ?? '';
  const secrets = [token, env.DEV_ACCEPTANCE_PASSWORD].filter(Boolean);
  const scrub = value => {
    let result = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    for (const secret of secrets) if (secret) result = result.split(secret).join('<secret>');
    return result.replace(/eyJ[A-Za-z0-9._-]{20,}/g, '<jwt>');
  };
  const report = { schema: 'USKOCI_TAXONOMY_QA_V1', sourceSha: env.USKOCI_QA_SOURCE_SHA,
    phase: config.phase, target: TARGET, accountId: config.accountId, startedAt: new Date().toISOString(),
    isolation: attestation, attemptCeiling: config.maxAttempts, reservationCeilingMicrousd: config.runReservationCapMicrousd,
    reservationPerAttemptMicrousd: RESERVATION_MICROUSD, attemptedProviderRequests: config.providerAttemptsPerRequest > 1 ? null : 0,
    attemptedLogicalRequests: 0, providerAttemptsPerRequest: config.providerAttemptsPerRequest,
    providerAttemptUpperBound: 0, providerAttemptsObserved: null,
    conservativeReservationMicrousd: 0, actualProviderBilling: 'READ_SERVER_LEDGER_SEPARATELY',
    providerAttempts: [], operations: [], cases: [], result: 'RUNNING',
    publicationAttempted: false, matchingInvoked: false, pushInvoked: false, serviceRoleUsed: false };
  const reportPath = resolve(output, 'report.json');
  const persist = () => writeFileSync(reportPath, scrub(report) + '\n', 'utf8');
  persist();
  writeFileSync(resolve(output, 'read-only-observer.sql'), observerSql(config.accountId));
  const key = env.USKOCI_QA_PUBLISHABLE_KEY ?? 'sb_publishable_o_I-YOn57oPCrIboF0OjPQ_c3DHmOZW';
  async function api(path, body, { auth = true, timeout = 55000 } = {}) {
    assert(path.startsWith('/auth/v1/') || path.startsWith('/rest/v1/') ||
      ['/functions/v1/uskoci-ai-interview', '/functions/v1/uskoci-worker-interview'].includes(path), 'NETWORK_PATH_DENIED');
    const response = await fetch(TARGET + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      signal: AbortSignal.timeout(timeout), headers: { apikey: key, ...(auth ? { Authorization: 'Bearer ' + token } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const raw = await response.text();
    let value; try { value = JSON.parse(raw); } catch { value = null; }
    assert(response.ok, `HTTP_${response.status}_${typeof value?.code === 'string' ? value.code.replace(/[^A-Z0-9_]/g, '').slice(0, 70) : 'FAILED'}`);
    return { value, raw };
  }
  async function rpc(name, args, write = false) {
    assert(RPCS.has(name), 'RPC_NOT_ALLOWLISTED');
    if (write) { report.operations.push({ name, at: new Date().toISOString(), args, outcome: 'ATTEMPTED_NO_RETRY' }); persist(); }
    const value = (await api('/rest/v1/rpc/' + name, args)).value;
    if (write) { report.operations.at(-1).outcome = 'HTTP_CONFIRMED'; persist(); }
    return value;
  }
  async function ownConversations() {
    const rows = (await api(`/rest/v1/ai_conversations?account_id=eq.${config.accountId}&select=id,account_id,purpose,status&limit=1000`)).value;
    assert(Array.isArray(rows) && rows.length < 1000 && rows.every(row => UUID.test(row.id) && same(row.account_id, config.accountId)), 'OWN_CONVERSATION_SNAPSHOT_INVALID');
    return rows;
  }
  async function review(flow, cid, revision) {
    const result = flow === 'worker'
      ? await rpc('rpc_prepare_worker_ai_review_taxonomy', { p_conversation_id: cid, p_expected_revision: revision, p_activate: false }, true)
      : await rpc('rpc_prepare_ai_task_review_taxonomy', { p_conversation_id: cid, p_response_deadline: null, p_location: null }, true);
    checkReview(result, config.accountId, cid);
    assert(flow !== 'worker' || result.activate === false, 'WORKER_ACTIVATION_FORBIDDEN');
    return result;
  }
  async function turn(flow, cid, text) {
    const requestReservation = RESERVATION_MICROUSD * config.providerAttemptsPerRequest;
    assert(report.attemptedLogicalRequests < config.maxAttempts && report.conservativeReservationMicrousd + requestReservation <= config.runReservationCapMicrousd, 'RUN_BUDGET_EXHAUSTED');
    const attempt = { conversationId: cid, clientRequestId: randomUUID(), flow, text,
      at: new Date().toISOString(), outcome: 'ATTEMPTED_UNKNOWN_NO_RETRY' };
    attempt.expectedProviderOperations = expectedProviderOperations(config.accountId,cid,attempt.clientRequestId,config.providerAttemptsPerRequest);
    report.providerAttempts.push(attempt); report.attemptedLogicalRequests++;
    if (config.providerAttemptsPerRequest === 1) report.attemptedProviderRequests++;
    report.providerAttemptUpperBound += config.providerAttemptsPerRequest;
    report.conservativeReservationMicrousd += requestReservation; persist(); // BEFORE network, even claim failure consumes the run allowance.
    const startedAt = Date.now();
    try {
      const response = await api('/functions/v1/' + (flow === 'worker' ? 'uskoci-worker-interview' : 'uskoci-ai-interview'),
        { conversationId: cid, clientRequestId: attempt.clientRequestId, text });
      const snapshot = flow === 'worker'
        ? await rpc('rpc_read_worker_ai_taxonomy', { p_conversation_id: cid })
        : await rpc('rpc_ai_read_need_turn_v2', { p_conversation_id: cid, p_client_request_id: attempt.clientRequestId });
      const currentTurn = flow === 'worker' ? snapshot?.turn : snapshot;
      assert(same(currentTurn?.conversationId, cid) && same(currentTurn?.clientRequestId, attempt.clientRequestId) && currentTurn.state === 'SUCCEEDED', 'TURN_NOT_CONFIRMED_STOP_NO_RETRY');
      const identity={accountId:config.accountId,conversationId:cid,clientRequestId:attempt.clientRequestId};
      let evidence=confirmedAssistantEvidence(response,identity,currentTurn,null,flow==='worker'?snapshot:null);
      if (!evidence.assistantText && flow==='need') {
        const messageId=currentTurn.receipt?.assistantMessageId;
        assert(UUID.test(messageId) && currentTurn.receipt?.authoritative === true, 'ASSISTANT_MESSAGE_RECEIPT_INVALID');
        const rows=(await api(`/rest/v1/ai_messages?id=eq.${messageId}&account_id=eq.${config.accountId}&conversation_id=eq.${cid}&role=eq.ASSISTANT&select=id,account_id,conversation_id,role,body&limit=2`)).value;
        evidence=confirmedAssistantEvidence(response,identity,currentTurn,rows);
      }
      assert(evidence.assistantText.length>0,'CONFIRMED_ASSISTANT_TEXT_UNAVAILABLE');
      Object.assign(attempt,evidence);
      attempt.outcome = 'OWNED_SUCCEEDED_READBACK'; persist(); return snapshot;
    } catch (error) { attempt.failure = error.message; persist(); throw error; }
    finally { attempt.elapsedMs = Date.now() - startedAt; persist(); }
  }
  try {
    if (!token) {
      const authenticated = (await api('/auth/v1/token?grant_type=password',
        { email: env.DEV_ACCEPTANCE_EMAIL, password: env.DEV_ACCEPTANCE_PASSWORD }, { auth: false })).value;
      assert(authenticated?.access_token, 'QA_LOGIN_FAILED'); token = authenticated.access_token;
      secrets.push(token, authenticated.refresh_token ?? '');
    }
    const me = (await api('/auth/v1/user')).value;
    assert(same(me?.id, config.accountId) && me?.role === 'authenticated' && me?.email_confirmed_at, 'AUTH_EXPECTED_ACCOUNT_MISMATCH');
    report.auth = { expectedAccountVerified: true, emailConfirmed: true };
    const baseline = await ownConversations();
    report.baselineConversations = baseline;
    if (config.phase === 'conversation') {
      if (config.names.some(name => CASES[name].flow === 'worker'))
        assert(!baseline.some(row => row.purpose === 'PROFILE' && row.status === 'OPEN'), 'EXISTING_WORKER_DRAFT_DO_NOT_TOUCH');
      const knownIds = new Set(baseline.map(x => x.id));
      for (const name of config.names) {
        const c = CASES[name], item = { name, flow: c.flow, expectation: c.expectation, saveRequestId: randomUUID(), reviews: [] };
        report.cases.push(item); persist();
        const openId = randomUUID();
        const opened = await rpc(c.flow === 'worker' ? 'rpc_open_worker_ai' : 'rpc_ai_open_need_conversation_owned_v2', { p_client_request_id: openId }, true);
        assert(UUID.test(opened?.conversationId) && !knownIds.has(opened.conversationId), 'OPEN_REUSED_EXISTING_DRAFT_STOP');
        const cid = opened.conversationId; knownIds.add(cid); item.conversationId = cid;
        const owned = (await ownConversations()).find(row => same(row.id, cid));
        assert(owned && owned.status === 'OPEN' && owned.purpose === (c.flow === 'worker' ? 'PROFILE' : 'NEED_INTAKE'), 'NEW_CONVERSATION_OWNERSHIP_NOT_CONFIRMED');
        for (const [messageIndex,message] of c.messages.entries()) {
          const snapshot = await turn(c.flow, cid, message);
          item.reviews.push(await review(c.flow, cid, snapshot.revision)); persist();
          if (c.requiresHandoffClarification && messageIndex === 0) {
            item.firstHandoffClarification = checkWorkerHandoffClarification(item.reviews.at(-1),report.providerAttempts.at(-1));
            persist();
          }
        }
        const final = item.reviews.at(-1);
        if (c.expectation === 'CLARIFY_NOT_READY')
          assert(final.classificationState !== 'READY' && final.classificationCandidates.length === 0, 'VAGUE_INTENT_FALSE_READY');
        if (c.expectation === 'EXACT_EXISTING_REUSE')
          assert(final.classificationState === 'READY' && final.classificationCandidates.every(plan => plan.action === 'REUSE_EXISTING'), 'KNOWN_SERVICE_NOT_REUSED');
        if (c.expectation === 'IMPOSSIBLE_REMOTE_NOT_READY')
          assert(final.canAccept === false && !final.classificationCandidates.some(plan => plan.mode === 'REMOTE'), 'IMPOSSIBLE_PHYSICAL_REMOTE_ACCEPTED');
        if (['PHYSICAL_HANDOFF','DIGITAL_HANDOFF'].includes(c.expectation)) {
          assert(final.classificationState === 'READY' && final.canAccept === true, 'EXECUTION_REVIEW_NOT_READY');
          assert(final.classificationCandidates.every(plan => plan.mode === 'REMOTE'
            && plan.handoff?.required === (c.expectation === 'PHYSICAL_HANDOFF')), 'EXECUTION_HANDOFF_MISSING_OR_WRONG');
          if (c.flow === 'need') assert(final.location?.geography.mode === 'REMOTE', 'HANDOFF_BECAME_WORK_PIN');
          if (name === 'need-pickup-execution') assert(final.classificationCandidates.every(plan => !plan.handoff.shippingCountries
            && plan.handoff.localExchange?.countryCode === 'RS' && plan.handoff.localExchange.city === 'Novi Sad'), 'PICKUP_SCOPE_CHANGED');
          if (name.includes('shipping-execution')) assert(final.classificationCandidates.every(plan => !plan.handoff.localExchange
            && JSON.stringify(plan.handoff.shippingCountries) === '["RS"]'), 'SHIPPING_SCOPE_CHANGED');
        }
        if (c.expectedAction === 'EXTEND_MODE') checkExistingModeExtension(final, c.expectedCategoryId);
        if (item.reviews.length > 1) {
          const first = item.reviews[0];
          if (first.classificationState === 'READY') {
            assert(final.classificationState === 'READY', 'FINISH_LOST_CLASSIFICATION');
            // A substantive handoff answer adds a constraint; a finish-only turn cannot change it.
            const semanticPlans = r => r.classificationCandidates.map(({ reason, ...rest }) => {
              if (!c.requiresHandoffClarification) return rest;
              const { handoff, ...serviceAndMode } = rest;
              return serviceAndMode;
            });
            assert(hash(semanticPlans(first)) === hash(semanticPlans(final)), 'FINISH_CHANGED_CLASSIFICATION');
          }
        }
      }
      report.result = 'CONVERSATIONS_RECORDED_AWAITING_READ_ONLY_PRESAVE_PROOF';
    } else {
      const preparedText = readFileSync(resolve(env.USKOCI_QA_PREPARED_REPORT), 'utf8');
      const prepared = JSON.parse(preparedText.replace(/^\uFEFF/, ''));
      assert(prepared.schema === 'USKOCI_TAXONOMY_QA_V1' && prepared.phase === 'conversation'
        && same(prepared.accountId, config.accountId) && prepared.target === TARGET
        && prepared.sourceSha === env.USKOCI_QA_SOURCE_SHA
        && prepared.result === 'CONVERSATIONS_RECORDED_AWAITING_READ_ONLY_PRESAVE_PROOF', 'PREPARED_REPORT_INVALID');
      assert(attestation.preparedReportSha256 === hash(preparedText), 'OBSERVER_REPORT_DIGEST_MISMATCH');
      compareNoPreSaveChanges(prepared.isolation.snapshot, attestation.snapshot);
      const selected = (env.USKOCI_QA_SAVE_CASES ?? '').split(',').filter(Boolean);
      assert(selected.length > 0 && new Set(selected).size === selected.length && selected.every(name => prepared.cases.some(c => c.name === name)), 'EXPLICIT_SAVE_CASES_REQUIRED');
      const lock = resolve(dirname(env.USKOCI_QA_PREPARED_REPORT), 'save-fixture-attempt.lock');
      assert(!existsSync(lock), 'SAVE_ALREADY_ATTEMPTED_READ_RECEIPT_NO_RETRY');
      writeFileSync(lock, JSON.stringify({ at: new Date().toISOString(), reportSha256: hash(preparedText), selected }), { flag: 'wx' });
      report.preSaveUnchanged = true;
      for (const original of prepared.cases.filter(c => selected.includes(c.name))) {
        const frozen = original.reviews.at(-1);
        checkReview(frozen, config.accountId, original.conversationId);
        assert(frozen.canAccept === true && frozen.classificationState === 'READY' && UUID.test(original.saveRequestId), 'SAVE_REQUIRES_COMPLETE_READY_SIGNED_REVIEW');
        const current = original.flow === 'worker'
          ? (await rpc('rpc_read_worker_ai_taxonomy', { p_conversation_id: original.conversationId }))?.review
          : (await rpc('rpc_read_ai_task_review', { p_review_id: frozen.reviewId }))?.review;
        assert(current && same(current.reviewId, frozen.reviewId) && current.displayedContentDigest === frozen.displayedContentDigest, 'FROZEN_REVIEW_CHANGED');
        if (original.flow === 'worker') assert(frozen.activate === false && attestation.workerStatus !== 'ACTIVE', 'ONLY_NONACTIVE_WORKER_SAVE_IN_THIS_HARNESS');
        const item = { name: original.name, flow: original.flow, conversationId: original.conversationId,
          reviewId: frozen.reviewId, saveRequestId: original.saveRequestId, result: 'SAVE_ATTEMPTED_NO_RETRY' };
        report.cases.push(item); persist();
        item.receipt = await rpc(original.flow === 'worker' ? 'rpc_save_worker_ai_review' : 'rpc_accept_ai_task_review',
          original.flow === 'worker'
            ? { p_review_id: frozen.reviewId, p_displayed_digest: frozen.displayedContentDigest, p_client_request_id: original.saveRequestId }
            : { p_review_id: frozen.reviewId, p_displayed_content_digest: frozen.displayedContentDigest, p_client_request_id: original.saveRequestId }, true);
        if (original.flow === 'worker') {
          assert(item.receipt?.saved === true && item.receipt.profileStatus === 'DRAFT', 'WORKER_MUST_REMAIN_DRAFT');
          item.bindingExpectation = 'DRAFT_WORKER_HAS_NO_ACTIVE_BINDING_AUTHORITY';
        } else {
          assert(item.receipt?.state === 'ACCEPTED' && item.receipt.authoritative === true
            && same(item.receipt.reviewId, frozen.reviewId) && same(item.receipt.clientRequestId, original.saveRequestId)
            && item.receipt.published === null && UUID.test(item.receipt.needId), 'OWNED_ACCEPT_RECEIPT_REQUIRED');
          // needs is deliberately not a client table reader. The immutable owner
          // command proves acceptance; a separate observer proves DRAFT + UUID binding.
          // A client SELECT refusal after a successful accept must not hide that receipt
          // or tempt the runner to submit a second Save.
          item.readback = { required: true, source: 'READ_ONLY_OBSERVER', expectedStatus: 'DRAFT',
            expectedPublishedAt: null, needId: item.receipt.needId, verified: false };
          item.bindingExpectation = 'READ_PRIVATE_UUID_BINDING_WITH_OBSERVER';
        }
        item.result = 'SAVE_RECEIPT_CONFIRMED'; persist();
      }
      report.result = 'SAVE_RECORDED_AWAITING_PRIVATE_UUID_BINDING_PROOF';
    }
  } catch (error) { report.result = 'STOPPED_NO_AUTOMATIC_RETRY'; report.failure = scrub(error instanceof Error ? error.message : 'UNKNOWN'); }
  finally { report.finishedAt = new Date().toISOString(); persist(); token = ''; }
  return { result: report.result, reportPath, attemptedProviderRequests: report.attemptedProviderRequests,
    attemptedLogicalRequests: report.attemptedLogicalRequests, providerAttemptUpperBound: report.providerAttemptUpperBound,
    conservativeReservationMicrousd: report.conservativeReservationMicrousd, failure: report.failure ?? null };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run().then(result => { console.log(JSON.stringify(result, null, 2)); if (result.failure) process.exitCode = 1; })
    .catch(error => { console.error(error instanceof Error ? error.message : 'HARNESS_FAILED'); process.exitCode = 1; });
}
