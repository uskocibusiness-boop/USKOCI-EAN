// Paired with the source-only R06 SQL contract. Enable only after its controlled
// promotion. No missing RPC, refusal or uncertain dispatch falls back to legacy.
export const preparedAiInputEnabled = (env: (name: string) => string | undefined): boolean =>
  env('USKOCI_AI_PREPARED_INPUT_ENABLED') === 'true';

type ObjectValue = Record<string, any>;
type RpcResult = { ok: boolean; status: number; data: any };
export type PreparedInputOptions = {
  rpc: (name: string, args: Record<string, unknown>, signal?: AbortSignal, timeout?: number) => Promise<RpcResult>;
  identity: { p_account_id: string; p_conversation_id: string; p_client_request_id: string };
  purpose: 'NEED_SERVICE' | 'WORKER_CAPABILITY'; userText: string; signal?: AbortSignal;
};
export type PreparedInput = { state: 'PREPARED'; inputSha256: string; snapshot: ObjectValue };
export type PreparedRead = PreparedInput | { state: string; inputSha256?: never; snapshot?: never };
const object = (v: any): v is ObjectValue => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: any, names: string[]): boolean => object(v) && Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v,k));
const uuid = (v: any): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const hash = (v: any): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const states = new Set(['ABSENT','CLOSED','READ_ONLY','EXPIRED','STALE','ERASED','NOT_ADMITTED','NOT_DISPATCHED']);
const canonical = (v: any): string => JSON.stringify(v, (_key, value) => object(value)
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k,value[k]])) : value);
const assertActive = (signal?: AbortSignal) => { if (signal?.aborted) throw new Error('R06_INPUT_CANCELLED'); };
const args = (options: PreparedInputOptions) => ({ ...options.identity, p_purpose: options.purpose });

function validInput(input: any, options: PreparedInputOptions): boolean {
  if (!exact(input,['schemaVersion','model','userText','providerRequest','catalog','runtime'])
    || input.schemaVersion !== 'R06_TEXT_INPUT_V1' || input.model !== 'gemini-3.8-flash'
    || input.userText !== options.userText || !input.userText.trim() || input.userText.length > 4000
    || new TextEncoder().encode(JSON.stringify(input)).byteLength > 262144) return false;
  const request = input.providerRequest;
  if (!exact(request,['systemInstruction','contents','generationConfig'])
    || !exact(request.systemInstruction,['parts']) || !Array.isArray(request.systemInstruction.parts)
    || !Array.isArray(request.contents) || !request.contents.length || request.contents.length > 102) return false;
  const textParts = (parts: any) => Array.isArray(parts) && parts.every(p => exact(p,['text']) && typeof p.text === 'string');
  if (!textParts(request.systemInstruction.parts) || !request.contents.every((item: any) =>
    exact(item,['role','parts']) && ['user','model'].includes(item.role) && textParts(item.parts))) return false;
  const config = request.generationConfig;
  if (!exact(config,['temperature','maxOutputTokens','responseMimeType','responseSchema','thinkingConfig'])
    || typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 1
    || config.maxOutputTokens !== 2048 || config.responseMimeType !== 'application/json' || !object(config.responseSchema)
    || !exact(config.thinkingConfig,['thinkingBudget']) || config.thinkingConfig.thinkingBudget !== 0) return false;
  if (input.catalog !== null && (!exact(input.catalog,['catalogVersion','catalogFingerprint','categories'])
    || !Number.isSafeInteger(input.catalog.catalogVersion) || input.catalog.catalogVersion < 1
    || !/^[0-9a-f]{32}$/.test(input.catalog.catalogFingerprint) || !Array.isArray(input.catalog.categories))) return false;
  const runtime = input.runtime;
  const common = ['schemaVersion','sourceContext','singlePassActive','pendingWorkerClarificationHint'];
  const need = ['schemaVersion','sourceContext','singlePassActive','pendingClarificationHint','timeContext','needsTree','maxProposals'];
  if (!exact(runtime, options.purpose === 'NEED_SERVICE' ? need : common) || !object(runtime.sourceContext)
    || typeof runtime.singlePassActive !== 'boolean') return false;
  if (options.purpose === 'NEED_SERVICE') return runtime.schemaVersion === 'R06_NEED_RUNTIME_V1'
    && object(runtime.timeContext) && typeof runtime.needsTree === 'boolean'
    && Number.isSafeInteger(runtime.maxProposals) && runtime.maxProposals > 0
    && (runtime.pendingClarificationHint === null || object(runtime.pendingClarificationHint));
  return runtime.schemaVersion === 'R06_WORKER_RUNTIME_V1'
    && (runtime.pendingWorkerClarificationHint === null || object(runtime.pendingWorkerClarificationHint));
}

function decodePrepared(data: any, options: PreparedInputOptions): PreparedInput {
  if (!exact(data,['state','inputSha256','snapshot']) || data.state !== 'PREPARED' || !hash(data.inputSha256))
    throw new Error('R06_INPUT_RECEIPT_INVALID');
  const s = data.snapshot;
  if (!exact(s,['schemaVersion','purpose','accountId','conversationId','clientRequestId','turnId','attemptId',
    'sourceIdentity','sourceContext','input','reservationId','instructionSha256','schemaSha256','catalogSha256'])
    || s.schemaVersion !== 'R06_PREPARED_TEXT_V1' || s.purpose !== options.purpose
    || s.accountId !== options.identity.p_account_id || s.conversationId !== options.identity.p_conversation_id
    || s.clientRequestId !== options.identity.p_client_request_id || !uuid(s.turnId) || !uuid(s.attemptId)
    || !uuid(s.reservationId) || !hash(s.sourceIdentity) || !hash(s.instructionSha256)
    || !hash(s.schemaSha256) || !hash(s.catalogSha256) || !object(s.sourceContext)
    || !validInput(s.input,options) || canonical(s.sourceContext) !== canonical(s.input.runtime.sourceContext))
    throw new Error('R06_INPUT_SNAPSHOT_INVALID');
  return data;
}

/** A read never grants provider permission. Only the dispatch RPC below can. */
export async function readPreparedInput(options: PreparedInputOptions): Promise<PreparedRead> {
  assertActive(options.signal);
  const result = await options.rpc('rpc_ai_read_prepared_input_service',args(options),options.signal,5000);
  assertActive(options.signal);
  if (!result.ok) throw new Error('R06_INPUT_READ_UNCONFIRMED');
  if (exact(result.data,['state']) && states.has(result.data.state)) return result.data;
  return decodePrepared(result.data,options);
}

/** One atomic prepare/reservation, then owned readback. An ambiguous prepare
 * gets one read, never another reservation or a changed request key. */
export async function prepareAiInput(options: PreparedInputOptions & { attemptId: string; input: ObjectValue }): Promise<PreparedInput> {
  if (!uuid(options.attemptId) || !validInput(options.input,options)) throw new Error('R06_INPUT_INVALID');
  // Freeze before I/O; caller mutation cannot change a replay comparison.
  const input = JSON.parse(JSON.stringify(options.input));
  assertActive(options.signal);
  let result: RpcResult | undefined;
  try { result = await options.rpc('rpc_ai_prepare_input_service', { ...args(options),p_attempt_id:options.attemptId,p_input:input },options.signal,8000); }
  catch { /* Unknown transport: only the existing prepared receipt may recover. */ }
  if (result && !result.ok && !( [408,502,503,504].includes(result.status)
    && !(object(result.data) && typeof result.data.code === 'string'))) throw new Error('R06_INPUT_PREPARE_REFUSED');
  if (result?.ok && (!exact(result.data,['state','replay','inputSha256']) || result.data.state !== 'PREPARED'
    || typeof result.data.replay !== 'boolean' || !hash(result.data.inputSha256))) throw new Error('R06_INPUT_PREPARE_UNCONFIRMED');
  assertActive(options.signal);
  const read = await readPreparedInput(options);
  if (read.state !== 'PREPARED' || !read.snapshot || read.snapshot.attemptId !== options.attemptId
    || canonical(read.snapshot.input) !== canonical(input)
    || (result?.ok && read.inputSha256 !== result.data.inputSha256)) throw new Error('R06_INPUT_PREPARE_UNCONFIRMED');
  return read as PreparedInput;
}

/** Exactly one permission request. Even if its ACK is lost, NEVER repeat it or
 * use the old dispatch path. A subsequent request can read READ_ONLY/outcome. */
export async function dispatchPreparedInput(options: PreparedInputOptions & { prepared: PreparedInput }): Promise<{
  state: string; dispatched: boolean; snapshot?: ObjectValue;
}> {
  const prepared = decodePrepared(options.prepared,options);
  assertActive(options.signal);
  const result = await options.rpc('rpc_ai_dispatch_prepared_input_service',{...args(options),
    p_attempt_id:prepared.snapshot.attemptId,p_input_sha256:prepared.inputSha256},options.signal,8000);
  assertActive(options.signal);
  if (!result.ok || !object(result.data)) throw new Error('R06_INPUT_DISPATCH_UNCONFIRMED');
  const data = result.data;
  if (exact(data,['state','dispatched']) && data.dispatched === false && states.has(data.state))
    return {state:data.state,dispatched:false};
  if (!exact(data,['state','dispatched','inputSha256','snapshot']) || data.state !== 'DISPATCHED' || data.dispatched !== true
    || data.inputSha256 !== prepared.inputSha256 || canonical(data.snapshot) !== canonical(prepared.snapshot))
    throw new Error('R06_INPUT_DISPATCH_UNCONFIRMED');
  return {state:data.state,dispatched:true,snapshot:data.snapshot};
}
