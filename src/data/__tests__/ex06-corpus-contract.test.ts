// EX-06 slice S02: offline validator for the SYNTHETIC contract corpus
// (supabase/proofs/ai/corpus/ex06_contract_corpus_v1.json).
//
// This proves the corpus is well formed and anchored to the real contracts (fact registry, Edge enums, matcher
// reason codes, the eleven hidden work kinds). It proves nothing about model obedience and nothing about the live
// matcher: no provider, database or network is touched, and the corpus carries no pass rate.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeServiceHandoff } from '../../contracts/serviceHandoff';

type Obj = Record<string, any>;

const repoRoot = join(__dirname, '..', '..', '..');
// Contract sources come from this checkout. EX06_SOURCE_ROOT lets a caller check the same corpus against another
// checkout of the repository; leave it unset in normal runs.
const sourceRoot = process.env.EX06_SOURCE_ROOT ? process.env.EX06_SOURCE_ROOT : repoRoot;
const CORPUS_PATH = 'supabase/proofs/ai/corpus/ex06_contract_corpus_v1.json';
const lf = (text: string) => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const readFrom = (base: string, path: string) => lf(readFileSync(join(base, path), 'utf8'));
const readOptional = (path: string): string | null => (existsSync(join(sourceRoot, path)) ? readFrom(sourceRoot, path) : null);

// ---------------------------------------------------------------- the contracts, read from source text
type FactDefinition = { valueType: string; privacyClass: string; requiredForDraft: boolean; manualOnly: boolean };
type Sources = {
  registry: Map<string, FactDefinition>; declaredFactKeys: number;
  priceModes: string[]; priceBases: string[]; scheduleKinds: string[]; geographyModes: string[];
  dialogue: Record<string, string[]>; askOrder: string[]; taskEdge: string; workerEdge: string; workerClient: string; matcher: string;
  kindsSql: string | null;
};

const quoted = (text: string): string[] => [...text.matchAll(/'([^']*)'/g)].map((match) => match[1]);
function setFrom(text: string, name: string): string[] {
  const start = text.indexOf(`const ${name} = new Set([`);
  if (start < 0) throw new Error(`NOT_FOUND_${name}`);
  return quoted(text.slice(start, text.indexOf(']);', start)));
}
function loadSources(): Sources {
  const needFacts = readFrom(sourceRoot, 'src/contracts/needFactsV2.ts');
  const registry = new Map<string, FactDefinition>();
  for (const match of needFacts.matchAll(/'(need\.[a-z_]+)':\s*\{\s*valueType:\s*'([A-Z_]+)',\s*privacyClass:\s*'(PUBLIC|PRIVATE)',\s*requiredForDraft:\s*(true|false),(\s*manualOnly:\s*true,)?/g)) {
    registry.set(match[1], { valueType: match[2], privacyClass: match[3], requiredForDraft: match[4] === 'true', manualOnly: !!match[5] });
  }
  const taskEdge = readFrom(sourceRoot, 'supabase/functions/uskoci-ai-interview/index.ts');
  const dialogueStart = taskEdge.indexOf('const DIALOGUE_VALUES = {');
  const dialogueText = taskEdge.slice(dialogueStart, taskEdge.indexOf('};', dialogueStart));
  const dialogue: Record<string, string[]> = {};
  for (const key of ['next', 'questionKey', 'taskRelation', 'priceUnit', 'schedulePattern']) {
    const match = new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`).exec(dialogueText);
    dialogue[key] = match ? quoted(match[1]) : [];
  }
  const askStart = taskEdge.indexOf('const missing = [');
  // The conditional handoff guard extends the filter. Bound this read to the
  // next declaration, so question copy cannot leak optional ends_at into askOrder.
  const askEnd = taskEdge.indexOf('const questions:', askStart);
  if (askStart < 0 || askEnd < 0) throw new Error('ASK_ORDER_SOURCE_NOT_FOUND');
  const askText = taskEdge.slice(askStart, askEnd);
  const matcher = ['supabase/migrations/20260829211632_clean_dispatch_engine.sql',
    'supabase/migrations/20260909120000_clean_w02_calendar_interval_integrity.sql',
    'supabase/migrations/20260906010000_clean_ru5_selection_eligibility_revalidation.sql'].map((path) => readFrom(sourceRoot, path)).join('\n');
  return {
    registry, declaredFactKeys: (needFacts.match(/'need\.[a-z_]+':\s*\{/g) ?? []).length, taskEdge, matcher,
    priceModes: setFrom(taskEdge, 'PRICE_MODES'), priceBases: setFrom(taskEdge, 'PRICE_BASES'),
    scheduleKinds: setFrom(taskEdge, 'SCHEDULE_KINDS'), geographyModes: setFrom(taskEdge, 'GEOGRAPHY_MODES'),
    dialogue, askOrder: [...new Set([...askText.matchAll(/'(need\.[a-z_]+)'/g)].map((match) => match[1]))],
    workerEdge: readFrom(sourceRoot, 'supabase/functions/uskoci-worker-interview/index.ts'),
    workerClient: readFrom(sourceRoot, 'src/data/workerAiClientService.ts'),
    kindsSql: readOptional('supabase/candidates/pkg031b_work_kinds_for_matching.sql'),
  };
}

// ---------------------------------------------------------------- fixed vocabulary of the corpus
// The eleven hidden kinds of work (PKG-031b, owner decision 2026-09-21) and their word stems. The stems are a port of
// private.work_kinds_v5; when the candidate SQL is present the test pins the port to it.
const STEMS: Record<string, string> = {
  SELIDBE_PREVOZ: '(selid|prevoz|transport|kombi|moving|removal)',
  FIZICKI_POSLOVI: '(fizick|nosenj|nosac|utovar|istovar|iznosenj|unosenj|labou?r|loading)',
  MONTAZA_NAMESTAJA: '(montaz|sklapanj|namestaj|ikea|furniture|assembl)',
  SITNE_POPRAVKE: '(popravk|majstor|handyman|repair)',
  MOLERSKI_RADOVI: '(moler|krecenj|farbanj|gletovanj|painting|painter)',
  ELEKTRO: '(elektr|electr|struj|uticnic|prekidac|rasvet|sijalic)',
  VODOINSTALATER: '(vodoinst|vodovod|slavin|odvod|bojler|plumb)',
  CISCENJE: '(cisc|odrzavanj|clean|usisav)',
  PRANJE_PEGLANJE: '(pegl|pranje vesa|laundry|ironing)',
  BASTA_DVORISTE: '(bast|dvorist|kosenj|travnjak|garden|lawn)',
  DOSTAVA: '(dostav|kurir|delivery|courier)',
};
const KINDS = Object.keys(STEMS);
const FOLD: Record<string, string> = { 'č': 'c', 'ć': 'c', 'š': 's', 'đ': 'd', 'ž': 'z' };
const kindsOf = (values: string[]): string[] => {
  const found = new Set<string>();
  for (const value of values) {
    const folded = value.trim().toLowerCase().replace(/[čćšđž]/g, (character) => FOLD[character]);
    for (const [kind, pattern] of Object.entries(STEMS)) if (new RegExp(pattern).test(folded)) found.add(kind);
  }
  return [...found].sort();
};

const CONSUMER_CLASSES = ['HARD', 'SOFT', 'SCORE', 'APPLICATION_TIME', 'NONE'];
const SAFETY = ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'];
const GUARDS = ['NONE', 'WITHHOLD_PER_DAY', 'WITHHOLD_PER_HOUR', 'WITHHOLD_REPEATED', 'WITHHOLD_DIFFERENT_TASK', 'FINISH_ONLY'];
const SHAPES = ['FITS', 'DOES_NOT_FIT', 'UNKNOWN_CAPABILITY'];
const AVAILABILITY = ['AVAILABLE_NOW_AND_SCHEDULED', 'SCHEDULED_ONLY', 'AVAILABLE_NOW_ONLY', 'NONE_DECLARED'];
const HARD_CODES = ['ACCOUNT_OR_PROFILE_RESTRICTED', 'OWN_NEED', 'IDENTITY_VERIFICATION_NOT_ADMITTED', 'MISSING_REQUIRED_TOOL', 'MISSING_REQUIRED_LICENSE',
  'MISSING_REQUIRED_VEHICLE', 'INSUFFICIENT_EXPERIENCE', 'PROFILE_EXCLUSION', 'CALENDAR_CONFLICT'];
const SOFT_CODES = ['CURRENT_AVAILABILITY_PAUSED', 'AVAILABILITY_FRESHNESS_EXPIRED', 'PROACTIVE_NOTIFICATIONS_PAUSED', 'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED',
  'SERVICE_NOT_IN_WORK_PROFILE', 'OUTSIDE_AVAILABILITY', 'OUTSIDE_PREFERRED_RADIUS', 'BELOW_MINIMUM_FEE'];
const APPLICATION_CODES = ['TEAM_CAPACITY_EXCEEDED'];
const FREE_TEXT_KEYS = ['need.title', 'need.description', 'need.category', 'need.exact_address', 'need.access_notes'];
const INTEGER_RANGES: Record<string, [number, number]> = { 'need.price_rsd': [1, 100000000], 'need.people_needed': [1, 50], 'need.minimum_experience_years': [0, 60] };
const WORKER_PATCH_KEYS = ['displayName', 'bio', 'skills', 'tools', 'vehicles', 'licenses', 'teamCapacity', 'location', 'availability'];
const WORKER_LOCATION_KEYS = ['operatingCountryCode', 'city', 'radiusKm'];
const WORKER_AVAILABILITY_KEYS = ['timezone', 'availableNow', 'ruleChanges', 'windowsUpsert', 'windowIdsRemove'];
const WORKER_REQUIRED_LABELS = ['Ime', 'Mesto rada', 'Veštine', 'Država i mesto rada'];
const POLICY_OUTCOMES = ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'];

// The plan test lists this corpus must cover (LIVE master plan 12.5 and 12.6, runbook P5 item 1, registry A02).
const REQUIRED_PLAN_ITEMS = [
  'P125-01', 'P125-02', 'P125-03', 'P125-04', 'P125-05', 'P125-06', 'P125-07', 'P125-08', 'P125-09', 'P125-10', 'P125-11', 'P125-12', 'P125-13',
  'P126-01', 'P126-02', 'P126-03', 'P126-04', 'P126-05', 'P126-06', 'P126-07', 'P126-08', 'P126-09', 'P126-10',
  'A02-painting-no-category',
  'RB-category_subcategory', 'RB-free_text', 'RB-slang_typos', 'RB-dates_timezone_duration', 'RB-price_vs_offers', 'RB-people',
  'RB-equipment_tools_vehicle', 'RB-urgency', 'RB-remote_onsite', 'RB-access_constraints', 'RB-multiple_stops',
  'WK-skills', 'WK-tools', 'WK-vehicle', 'WK-availability', 'WK-radius', 'WK-licence_self_declared', 'WK-draft_not_active',
];

// ---------------------------------------------------------------- small checks
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value);
const isStr = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isStrList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isStr);
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const PHONE_LIKE = [/\b\d{7,}\b/, /(?:\d[\s./()-]*){8,}/, /(?:^|\s)(?:\+|00)\d[\d\s()./-]{6,}\d/];
const EMAIL_LIKE = /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/;
const URL_LIKE = /https?:\/\/|www\./i;
const STREET_NUMBER_LIKE = /\b(?:ulic[aeiu]|ul\.|bulevar(?:u|a)?|bul\.|trg(?:u|a)?)\s+[\p{L}.]+(?:\s+[\p{L}.]+)?\s+(?:br\.?\s*)?\d+[a-z]?\b/iu;

function locationRefValid(value: unknown): boolean {
  if (value == null) return true;
  if (!isObj(value) || Object.keys(value).some((key) => !['label', 'city', 'area'].includes(key))) return false;
  const parts = ['label', 'city', 'area'].map((key) => (typeof value[key] === 'string' ? value[key].trim() : ''));
  return parts.some(Boolean) && parts[0].length <= 240 && parts[1].length <= 160 && parts[2].length <= 160;
}
// Port of geographyValid in the task interview Edge function.
function geographyValid(value: unknown, modes: string[]): boolean {
  if (!isObj(value) || Object.keys(value).some((key) => !['mode', 'start', 'end', 'waypoints', 'serviceArea'].includes(key))) return false;
  if (!modes.includes(value.mode)) return false;
  const waypoints = value.waypoints ?? [];
  if (!Array.isArray(waypoints) || waypoints.length > 20) return false;
  if (!locationRefValid(value.start) || !locationRefValid(value.end) || !locationRefValid(value.serviceArea) || !waypoints.every(locationRefValid)) return false;
  const { start = null, end = null, serviceArea = null } = value;
  switch (value.mode) {
    case 'REMOTE': return start == null && end == null && serviceArea == null && waypoints.length === 0;
    case 'STATIONARY': return start != null && end == null && serviceArea == null && waypoints.length === 0;
    case 'POINT_TO_POINT': return start != null && end != null && serviceArea == null && waypoints.length === 0;
    case 'MULTI_STOP': return start != null && serviceArea == null && (end != null || waypoints.length > 0);
    case 'AREA_BASED': return end == null && waypoints.length === 0 && (start != null || serviceArea != null);
    default: return false;
  }
}
const locationSlots = (geography: Obj | undefined): string[] => (!geography || geography.mode === 'REMOTE' ? []
  : [...(geography.start ? ['start'] : []), ...(geography.waypoints ?? []).map((_: unknown, index: number) => `waypoints/${index}`),
    ...(geography.end ? ['end'] : []), ...(geography.serviceArea ? ['serviceArea'] : [])]);

// Port of the "still missing" derivation: the registry requirement list plus the price rule, and the order in which the
// interview asks (pinned to the Edge source below).
function reviewOf(facts: Obj, publication: Obj | undefined, src: Sources) {
  if (publication?.outcome === 'BLOCK') return { state: 'BLOCKED', humanConfirmationRequired: true, canPublishFromAiAlone: false };
  if (publication?.outcome === 'REVIEW') return { state: 'NEEDS_POLICY_REVIEW', humanConfirmationRequired: true, canPublishFromAiAlone: false };
  const required = [...src.registry.entries()].filter(([, definition]) => definition.requiredForDraft).map(([key]) => key);
  const missingRequired = required.filter((key) => !(key in facts));
  if (facts['need.price_mode'] === 'MY_PRICE' && !('need.price_rsd' in facts)) missingRequired.push('need.price_rsd');
  const remote = facts['need.task_geography']?.mode === 'REMOTE';
  if (remote && !decodeServiceHandoff(facts['need.handoff'])) missingRequired.push('need.handoff');
  const people = Number(facts['need.people_needed']);
  const askableMissing = src.askOrder.filter((key) => {
    if (key === 'need.handoff') return remote && !decodeServiceHandoff(facts[key]);
    if (key in facts) return false;
    if (key === 'need.price_rsd') return facts['need.price_mode'] === 'MY_PRICE';
    if (key === 'need.price_basis') return facts['need.price_mode'] === 'MY_PRICE' && people > 1;
    if (key === 'need.starts_at' || key === 'need.ends_at') return facts['need.schedule_kind'] === 'FIXED_WINDOW';
    return true;
  });
  return { state: missingRequired.length === 0 && askableMissing.length === 0 ? 'READY_FOR_REVIEW' : 'COLLECTING', missingRequired, askableMissing,
    mapPointsToConfirm: locationSlots(facts['need.task_geography']), humanConfirmationRequired: true, canPublishFromAiAlone: false };
}

function workerReview(profile: Obj) {
  const missing: string[] = [];
  if ((profile.displayName ?? '').length < 2) missing.push('Ime');
  if ((profile.location?.city ?? '').length < 2) missing.push('Mesto rada');
  if ((profile.skills ?? []).length < 1) missing.push('Veštine');
  const location = profile.location ?? {};
  if (Object.keys(location).length > 0 && ((location.operatingCountryCode ?? null) === null || (location.city ?? '').length < 1)) missing.push('Država i mesto rada');
  return missing;
}

// ---------------------------------------------------------------- the validator
function validateFact(id: string, key: string, value: unknown, src: Sources, errors: string[]) {
  const definition = src.registry.get(key);
  if (!definition) { errors.push(`${id}: unknown fact key ${key} (not in the need fact registry)`); return; }
  if (definition.manualOnly) { errors.push(`${id}: ${key} is manual-only and may never be an expected AI fact`); return; }
  const fail = (message: string) => errors.push(`${id}: ${key} ${message}`);
  if (definition.valueType === 'TEXT' && FREE_TEXT_KEYS.includes(key)) {
    if (!isObj(value) || value.free !== true) fail('must be a free-text spec {free:true,...}');
    else {
      if (key === 'need.category' && !(isStr(value.canonicalText) && value.canonicalText.length <= 120)) fail('needs a canonicalText of at most 120 characters');
      if (value.mustMentionAnyOf !== undefined && !isStrList(value.mustMentionAnyOf)) fail('mustMentionAnyOf must be a list of strings');
    }
  } else if (definition.valueType === 'TEXT') {
    if (typeof value !== 'string' || !/^[A-Z]{2}$/.test(value)) fail('(TEXT) must be a two-letter country code');
  } else if (definition.valueType === 'TEXT_ARRAY') {
    if (!isObj(value) || value.free !== true || !isStrList(value.canonicalItems) || value.canonicalItems.length < 1 || value.canonicalItems.length > 50
      || value.canonicalItems.some((item: string) => item.length > 500)) fail('(TEXT_ARRAY) needs {free:true, canonicalItems:[1..50 strings]}');
  } else if (definition.valueType === 'INTEGER') {
    const range = INTEGER_RANGES[key];
    if (typeof value !== 'number' || !Number.isInteger(value)) fail('(INTEGER) must be an integer');
    else if (range && (value < range[0] || value > range[1])) fail(`(INTEGER) out of range ${range[0]}..${range[1]}`);
  } else if (definition.valueType === 'ENUM') {
    const allowed = key === 'need.price_mode' ? src.priceModes : key === 'need.price_basis' ? src.priceBases : key === 'need.schedule_kind' ? src.scheduleKinds : [];
    if (typeof value !== 'string' || !allowed.includes(value)) fail(`(ENUM) value ${JSON.stringify(value)} is not one of ${allowed.join('/')}`);
  } else if (definition.valueType === 'TIMESTAMPTZ') {
    if (typeof value !== 'string' || !TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value))) fail('(TIMESTAMPTZ) must be an ISO instant with an explicit offset');
  } else if (definition.valueType === 'BOOLEAN') {
    if (typeof value !== 'boolean') fail('(BOOLEAN) must be a boolean');
  } else if (definition.valueType === 'OBJECT') {
    if (key === 'need.handoff') {
      if (!decodeServiceHandoff(value)) fail('(OBJECT) is not a valid service handoff');
    } else if (key !== 'need.task_geography' || !geographyValid(value, src.geographyModes)) fail('(OBJECT) is not a valid task geography');
  }
}

function validateFacts(id: string, facts: unknown, src: Sources, errors: string[], optional: boolean) {
  if (!isObj(facts)) { errors.push(`${id}: expected.facts must be an object`); return; }
  for (const [key, value] of Object.entries(facts)) validateFact(id, key, value, src, errors);
  if (optional) return;
  const kind = facts['need.schedule_kind'];
  const has = (key: string) => key in facts;
  if ((has('need.starts_at') || has('need.ends_at')) && kind !== 'FIXED_WINDOW') errors.push(`${id}: a start or end time without schedule_kind FIXED_WINDOW`);
  if (kind === 'FIXED_WINDOW' && has('need.starts_at') && has('need.ends_at')
    && !(Date.parse(facts['need.ends_at']) > Date.parse(facts['need.starts_at']))) errors.push(`${id}: FIXED_WINDOW end must be after start`);
  if ((has('need.price_rsd') || has('need.price_basis')) && facts['need.price_mode'] !== 'MY_PRICE') errors.push(`${id}: a price amount or basis without price_mode MY_PRICE`);
  if (has('need.price_basis') && !(Number(facts['need.people_needed']) > 1)) errors.push(`${id}: price_basis is only set for a task needing more than one person`);
  const geography = facts['need.task_geography'];
  if (isObj(geography) && geography.mode === 'REMOTE' && (has('need.exact_address') || has('need.access_notes'))) errors.push(`${id}: a remote task has no address or access notes`);
}

function scanText(id: string, label: string, text: string, errors: string[]) {
  const clean = text.replace(/<(?:TELEFON|ADRESA)_PLACEHOLDER>/g, '');
  if (EMAIL_LIKE.test(clean)) errors.push(`${id}: ${label} contains an e-mail-like pattern`);
  if (PHONE_LIKE.some((pattern) => pattern.test(clean))) errors.push(`${id}: ${label} contains a phone-number-like pattern`);
  if (URL_LIKE.test(clean)) errors.push(`${id}: ${label} contains a URL`);
  if (STREET_NUMBER_LIKE.test(clean)) errors.push(`${id}: ${label} contains a street-and-number-like pattern`);
}

function priorFacts(turns: Obj[]): Obj {
  const prior: Obj = {};
  for (const turn of turns.slice(0, -1)) if (turn.role === 'ASSISTANT' && isObj(turn.proposedFacts)) Object.assign(prior, turn.proposedFacts);
  return prior;
}

const FINISH_TASK = /^(?:to je to|to je sve|gotovo|gotovo to je sve|objavi|objavi zadatak|sačuvaj|sacuvaj|то је то|то је све|готово|објави|објави задатак|сачувај)$/;
const FINISH_WORKER = /^(?:to je to|to je sve|gotovo|gotovo to je sve|sačuvaj|sacuvaj|sačuvaj profil|sacuvaj profil|то је то|то је све|готово|сачувај|сачувај профил)$/;
const normalizeFinish = (text: string) => text.normalize('NFKC').toLowerCase().trim().replace(/[.!?,…]+/g, ' ').replace(/\s+/g, ' ').trim();

function validateTurns(id: string, turns: unknown, errors: string[], family: string, src: Sources) {
  if (!Array.isArray(turns) || turns.length < 1) { errors.push(`${id}: turns must be a non-empty list`); return; }
  turns.forEach((turn: Obj, index: number) => {
    if (!isObj(turn) || !['USER', 'ASSISTANT'].includes(turn.role)) { errors.push(`${id}: turn ${index} has no valid role`); return; }
    if (turn.role === 'USER') {
      if (!isStr(turn.text) || turn.text.length > 4000) errors.push(`${id}: turn ${index} needs a text of at most 4000 characters`);
      else scanText(id, `turn ${index}`, turn.text, errors);
    } else {
      if (turn.scripted !== true) errors.push(`${id}: assistant turn ${index} must be marked scripted (the corpus never records a model reply)`);
      if (family === 'TASK') {
        if (!isObj(turn.proposedFacts)) errors.push(`${id}: scripted assistant turn ${index} needs proposedFacts`);
        else for (const [key, value] of Object.entries(turn.proposedFacts)) validateFact(`${id}#scripted`, key, value, src, errors);
      }
      if (turn.note !== undefined) scanText(id, `turn ${index} note`, String(turn.note), errors);
    }
  });
  if (turns[turns.length - 1]?.role !== 'USER') errors.push(`${id}: the last turn must be a person's message`);
}

function validateKind(id: string, kind: Obj, probeTexts: string[], expectedLabel: 'single' | 'set', refused: boolean, errors: string[]) {
  if (!isObj(kind)) { errors.push(`${id}: kind block missing`); return; }
  const allowed = [...KINDS, 'unclassified', 'refused'];
  if (expectedLabel === 'single') {
    if (!allowed.includes(kind.expected)) errors.push(`${id}: work kind ${JSON.stringify(kind.expected)} is not one of the eleven, unclassified or refused`);
    if ((kind.expected === 'refused') !== refused) errors.push(`${id}: kind refused must go with a BLOCK or REVIEW publication outcome`);
  } else if (!Array.isArray(kind.expectedSet) || !(same(kind.expectedSet, ['unclassified']) || kind.expectedSet.every((entry: string) => KINDS.includes(entry)))) {
    errors.push(`${id}: work kind set ${JSON.stringify(kind.expectedSet)} is not made of the eleven kinds (or exactly unclassified)`);
  }
  if (!same(kind.probeTexts, probeTexts)) errors.push(`${id}: kind.probeTexts do not match the canonical wording of the expected facts`);
  if (!same(kind.currentStemsYield, kindsOf(probeTexts))) errors.push(`${id}: kind.currentStemsYield differs from the PKG-031b stems on the probe texts`);
  for (const probe of kind.rawProbes ?? []) {
    if (!isStr(probe?.text) || !same(probe.currentStemsYield, kindsOf([probe.text]))) errors.push(`${id}: a raw probe does not match the stems`);
    else scanText(id, 'raw probe', probe.text, errors);
  }
}

function validateReferenceWorkers(id: string, workers: unknown, state: string, errors: string[]) {
  if (!Array.isArray(workers) || workers.length !== 3 || !same(workers.map((worker: Obj) => worker?.shape), SHAPES)) {
    errors.push(`${id}: a task case needs exactly three reference workers (${SHAPES.join(', ')})`); return;
  }
  const wantEligibility = state === 'READY_FOR_REVIEW' ? ['ELIGIBLE', 'MANUAL_ONLY', 'HARD_BLOCKED'] : state === 'COLLECTING' ? ['NO_PUBLISHED_NEED'] : ['NOT_PUBLISHABLE'];
  for (const worker of workers as Obj[]) {
    const tag = `${id}/${worker.shape}`;
    const profile = worker.profile;
    if (!isObj(profile) || !['skills', 'tools', 'vehicles', 'licenses', 'exclusions'].every((key) => isStrList(profile[key]) || (Array.isArray(profile[key]) && profile[key].length === 0))
      || !Number.isInteger(profile.teamCapacity) || profile.teamCapacity < 1 || profile.teamCapacity > 50 || !isStr(profile.city)
      || !Number.isInteger(profile.radiusKm) || profile.radiusKm < 1 || profile.radiusKm > 200 || !AVAILABILITY.includes(profile.availability)
      || !['NONE', 'OVERLAPS_TASK_WINDOW'].includes(profile.busy) || !['ACTIVE', 'DRAFT'].includes(profile.profileStatus) || !Number.isInteger(profile.yearsExperience)) {
      errors.push(`${tag}: malformed reference worker profile`); continue;
    }
    for (const licence of profile.licenses) if (/verifik|proveren|verified/i.test(licence)) errors.push(`${tag}: a licence is only ever self-declared, it must not read as verified`);
    const expect = worker.expect;
    if (!isObj(expect) || !wantEligibility.includes(expect.eligibility)) { errors.push(`${tag}: expected eligibility must be one of ${wantEligibility.join('/')} for state ${state}`); continue; }
    if (!isStrList(worker.unknownCapability) && !(Array.isArray(worker.unknownCapability) && worker.unknownCapability.length === 0)) errors.push(`${tag}: unknownCapability must be a list`);
    if (worker.shape === 'UNKNOWN_CAPABILITY' && !(worker.unknownCapability?.length > 0)) errors.push(`${tag}: an unknown-capability worker must name what is unknown`);
    if (worker.shape !== 'UNKNOWN_CAPABILITY' && worker.unknownCapability?.length) errors.push(`${tag}: only the unknown-capability worker lists unknown fields`);
    if (state !== 'READY_FOR_REVIEW') continue;
    const codes = (name: string, allowed: string[]) => {
      const list = expect[name];
      if (!Array.isArray(list) || list.some((code: string) => !allowed.includes(code))) errors.push(`${tag}: ${name} must hold only real matcher codes (${allowed.join(', ')})`);
      return Array.isArray(list) ? list : [];
    };
    const hard = codes('hardBlockers', HARD_CODES), soft = codes('dispatchBlockers', SOFT_CODES), application = codes('applicationTimeBlockers', APPLICATION_CODES);
    const consistent = expect.eligibility === 'HARD_BLOCKED' ? hard.length > 0 && expect.responseAllowed === false && expect.dispatchEligible === false
      : expect.eligibility === 'MANUAL_ONLY' ? hard.length === 0 && soft.length > 0 && expect.responseAllowed === true && expect.dispatchEligible === false
        : hard.length === 0 && soft.length === 0 && expect.responseAllowed === true && expect.dispatchEligible === true;
    if (!consistent) errors.push(`${tag}: eligibility ${expect.eligibility} disagrees with its blocker lists`);
    if (worker.shape === 'FITS' && !(expect.eligibility === 'ELIGIBLE' && application.length === 0)) errors.push(`${tag}: the fitting worker must be eligible`);
    if (worker.shape !== 'FITS' && expect.eligibility === 'ELIGIBLE' && application.length === 0 && !worker.sourceReadingPrediction) {
      errors.push(`${tag}: a worker that does not fit, or whose capability is unknown, must never be plainly eligible`);
    }
  }
}

function validateTaskCase(c: Obj, src: Sources, errors: string[]) {
  const id = c.id as string;
  validateTurns(id, c.turns, errors, 'TASK', src);
  const e = c.expected;
  if (!isObj(e) || !isObj(e.turn) || !isObj(e.kind)) { errors.push(`${id}: expected block incomplete`); return; }
  const turn = e.turn;
  if (!Array.isArray(turn.safetyAnyOf) || !turn.safetyAnyOf.length || turn.safetyAnyOf.some((entry: string) => !SAFETY.includes(entry))) errors.push(`${id}: safetyAnyOf must use ${SAFETY.join('/')}`);
  const dialogueChecks: [string, unknown, string[]][] = [['taskRelation', turn.taskRelation, src.dialogue.taskRelation], ['priceUnit', turn.priceUnit, src.dialogue.priceUnit],
    ['schedulePattern', turn.schedulePattern, src.dialogue.schedulePattern]];
  for (const [name, value, allowed] of dialogueChecks) if (!allowed.includes(value as string)) errors.push(`${id}: dialogue.${name} ${JSON.stringify(value)} is not an Edge dialogue value`);
  if (!Array.isArray(turn.nextAnyOf) || !turn.nextAnyOf.length || turn.nextAnyOf.some((entry: string) => !src.dialogue.next.includes(entry))) errors.push(`${id}: nextAnyOf must use the Edge dialogue.next values`);
  if (!GUARDS.includes(turn.guard)) errors.push(`${id}: unknown guard ${turn.guard}`);

  const facts = e.facts;
  const policyGated = ['BLOCK', 'REVIEW'].includes(e.publicationOutcome?.outcome);
  validateFacts(id, facts, src, errors, e.factsOptional === true);
  if (!isObj(facts)) return;
  if (e.publicationOutcome !== undefined) {
    const publication = e.publicationOutcome;
    if (!POLICY_OUTCOMES.includes(publication.outcome) || !/^RS-MIN-0(0[1-9]|1[0-6])$/.test(publication.rule ?? '') || !isStr(publication.policyStatus)) errors.push(`${id}: publicationOutcome needs an outcome, an RS-MIN rule id and a policy status`);
  }
  if (policyGated && Object.keys(facts).length > 0) errors.push(`${id}: a policy-gated case carries no expected facts`);
  for (const key of e.softFacts ?? []) if (!(key in facts)) errors.push(`${id}: softFact ${key} is not among the expected facts`);
  for (const key of e.unknownFacts ?? []) {
    if (!src.registry.has(key)) errors.push(`${id}: unknown fact key ${key} in unknownFacts`);
    else if (key in facts) errors.push(`${id}: ${key} is listed both as expected and as unknown`);
  }
  for (const key of e.mustNotFacts ?? []) {
    if (!src.registry.has(key)) errors.push(`${id}: unknown fact key ${key} in mustNotFacts`);
    else if (key in facts) errors.push(`${id}: ${key} is expected although it is in mustNotFacts`);
  }
  const prior = priorFacts(c.turns);
  for (const key of e.correctedKeys ?? []) if (!(key in prior) || same(prior[key], facts[key]) || !(key in facts)) errors.push(`${id}: corrected key ${key} must differ from the scripted earlier proposal`);
  if (turn.guard.startsWith('WITHHOLD') || turn.guard === 'FINISH_ONLY') {
    if (!same(prior, facts)) errors.push(`${id}: guard ${turn.guard} must leave the facts exactly as they were before the last turn`);
  }
  if (turn.guard === 'FINISH_ONLY' && !FINISH_TASK.test(normalizeFinish(c.turns[c.turns.length - 1].text))) errors.push(`${id}: FINISH_ONLY needs an exact finish command as the last message`);
  const guardOk = turn.guard === 'WITHHOLD_PER_DAY' ? turn.priceUnit === 'PER_DAY' : turn.guard === 'WITHHOLD_PER_HOUR' ? turn.priceUnit === 'PER_HOUR'
    : turn.guard === 'WITHHOLD_REPEATED' ? turn.schedulePattern === 'REPEATED' : turn.guard === 'WITHHOLD_DIFFERENT_TASK' ? turn.taskRelation === 'DIFFERENT_TASK'
      : !['PER_DAY', 'PER_HOUR'].includes(turn.priceUnit) && turn.schedulePattern !== 'REPEATED' && turn.taskRelation === 'CONTINUE';
  if (!guardOk) errors.push(`${id}: dialogue values disagree with guard ${turn.guard}`);
  if (turn.guard.startsWith('WITHHOLD') && !same(turn.safetyAnyOf, ['CLARIFY'])) errors.push(`${id}: a withheld turn is a CLARIFY`);

  const review = reviewOf(facts, e.publicationOutcome, src);
  if (!same(e.review, review)) errors.push(`${id}: expected.review differs from the derivation (${JSON.stringify(review)})`);
  if (e.review?.humanConfirmationRequired !== true || e.review?.canPublishFromAiAlone !== false) errors.push(`${id}: the AI is never the confirmation`);
  if (turn.nextAnyOf.includes('ASK')) {
    const keys = turn.questionKeyAnyOf;
    if (!Array.isArray(keys) || !keys.length || keys.some((key: string) => !(review as Obj).askableMissing?.includes(key) || !src.dialogue.questionKey.includes(key))) errors.push(`${id}: ASK needs question keys the interview would still ask for`);
  } else if (!same(turn.questionKeyAnyOf, [])) errors.push(`${id}: questionKeyAnyOf is only used with ASK`);

  const category = facts['need.category']?.canonicalText;
  const probeTexts = e.kind.probeTexts !== undefined && Object.keys(facts).length === 0 ? e.kind.probeTexts
    : [category, ...(facts['need.required_skills']?.canonicalItems ?? [])].filter(Boolean);
  validateKind(id, e.kind, probeTexts, 'single', policyGated, errors);
  validateReferenceWorkers(id, c.referenceWorkers, review.state, errors);
}

function validateWorkerCase(c: Obj, src: Sources, errors: string[]) {
  const id = c.id as string;
  validateTurns(id, c.turns, errors, 'WORKER', src);
  const e = c.expected;
  if (!isObj(e) || !isObj(e.patch) || !isObj(e.kind) || !isObj(e.review)) { errors.push(`${id}: expected block incomplete`); return; }
  const patch = e.patch;
  for (const key of Object.keys(patch)) if (!WORKER_PATCH_KEYS.includes(key)) errors.push(`${id}: ${key} is not a worker patch field`);
  for (const key of ['skills', 'tools', 'vehicles', 'licenses']) {
    if (key in patch && !(Array.isArray(patch[key]) && patch[key].length <= 50 && patch[key].every((item: unknown) => isStr(item) && (item as string).length <= 500))) errors.push(`${id}: patch.${key} must be a list of strings`);
  }
  for (const licence of patch.licenses ?? []) if (/verifik|proveren|verified/i.test(licence)) errors.push(`${id}: a licence is only ever self-declared, it must not read as verified`);
  if ('teamCapacity' in patch && !(Number.isInteger(patch.teamCapacity) && patch.teamCapacity >= 1 && patch.teamCapacity <= 50)) errors.push(`${id}: patch.teamCapacity out of range 1..50`);
  if ('displayName' in patch && !isStr(patch.displayName)) errors.push(`${id}: patch.displayName must be text`);
  if ('location' in patch) {
    const location = patch.location;
    if (!isObj(location) || Object.keys(location).some((key) => !WORKER_LOCATION_KEYS.includes(key))) errors.push(`${id}: patch.location uses fields outside country/city/radius`);
    else {
      if ('operatingCountryCode' in location && !(typeof location.operatingCountryCode === 'string' && /^[A-Z]{2}$/.test(location.operatingCountryCode))) errors.push(`${id}: patch.location.operatingCountryCode must be a country code`);
      if ('radiusKm' in location && !(Number.isInteger(location.radiusKm) && location.radiusKm >= 1 && location.radiusKm <= 200)) errors.push(`${id}: patch.location.radiusKm out of range 1..200`);
    }
  }
  if ('availability' in patch) {
    const availability = patch.availability;
    if (!isObj(availability) || Object.keys(availability).some((key) => !WORKER_AVAILABILITY_KEYS.includes(key))) errors.push(`${id}: patch.availability uses fields outside the worker schema`);
    else {
      for (const change of availability.ruleChanges ?? []) {
        const value = change?.value;
        const valueOk = value === null || (isObj(value) && /^\d{2}:\d{2}$/.test(value.startTime) && /^\d{2}:\d{2}$/.test(value.endTime) && /^\d{4}-\d{2}-\d{2}$/.test(value.startsOn)
          && (value.endsOn === null || /^\d{4}-\d{2}-\d{2}$/.test(value.endsOn)) && typeof value.active === 'boolean');
        if (!isObj(change) || !(change.ruleId === null || isStr(change.ruleId)) || !Array.isArray(change.weekdays) || !change.weekdays.length
          || change.weekdays.some((day: unknown) => !Number.isInteger(day) || (day as number) < 0 || (day as number) > 6) || !valueOk) errors.push(`${id}: malformed availability rule change`);
      }
      for (const window of availability.windowsUpsert ?? []) {
        if (!isObj(window) || !(window.id === null || isStr(window.id)) || !TIMESTAMP.test(window.startsAt) || !TIMESTAMP.test(window.endsAt) || !['AVAILABLE', 'UNAVAILABLE'].includes(window.state)) errors.push(`${id}: malformed availability window`);
      }
    }
  }
  const start = c.startingCandidate ?? {};
  const merged: Obj = JSON.parse(JSON.stringify(start));
  for (const key of ['displayName', 'bio', 'skills', 'tools', 'vehicles', 'licenses', 'teamCapacity']) if (key in patch) merged[key] = patch[key];
  if ('location' in patch) merged.location = { ...(merged.location ?? {}), ...patch.location };
  const after = { displayName: merged.displayName ?? null, skills: merged.skills ?? [], tools: merged.tools ?? [], vehicles: merged.vehicles ?? [], licenses: merged.licenses ?? [],
    teamCapacity: merged.teamCapacity ?? null, location: merged.location ?? {} };
  if (!same(e.profileAfterTurn, after)) errors.push(`${id}: profileAfterTurn differs from startingCandidate plus the patch`);
  const missing = workerReview(after);
  if (!same(e.review.missingRequired, missing) || e.review.canAccept !== (missing.length === 0)) errors.push(`${id}: review.missingRequired differs from the derivation (${JSON.stringify(missing)})`);
  if (e.review.missingRequired.some((label: string) => !WORKER_REQUIRED_LABELS.includes(label))) errors.push(`${id}: review labels must be the four the client decodes`);
  if (e.review.profileStatusAfterAiTurn !== 'DRAFT' || e.review.activationRequiresExplicitSave !== true) errors.push(`${id}: an AI turn never activates a profile: it stays DRAFT until the person saves`);
  if (!SAFETY.includes((e.turn?.safetyAnyOf ?? [])[0]) || !GUARDS.includes(e.turn?.guard)) errors.push(`${id}: turn block needs safety and guard`);
  if (e.turn?.guard === 'FINISH_ONLY') {
    if (Object.keys(patch).length > 0) errors.push(`${id}: a finish-only command needs an empty patch`);
    if (!FINISH_WORKER.test(normalizeFinish(c.turns[c.turns.length - 1].text))) errors.push(`${id}: FINISH_ONLY needs an exact finish command as the last message`);
  }
  const unknownPaths = ['displayName', 'bio', 'skills', 'tools', 'vehicles', 'licenses', 'teamCapacity', 'location.operatingCountryCode', 'location.city', 'location.radiusKm',
    'availability.timezone', 'availability.availableNow', 'availability.ruleChanges', 'availability.windowsUpsert'];
  for (const path of e.unknownFields ?? []) {
    if (!unknownPaths.includes(path)) errors.push(`${id}: unknown profile path ${path}`);
    const [head, tail] = path.split('.');
    const stated = tail ? patch[head] && typeof patch[head] === 'object' && tail in patch[head] : head in patch;
    if (stated) errors.push(`${id}: ${path} is listed as unknown but the patch states it`);
  }
  validateKind(id, e.kind, after.skills, 'set', false, errors);
  const tasks = c.referenceTasks;
  if (!Array.isArray(tasks) || tasks.length < 2) { errors.push(`${id}: a worker case needs at least two reference tasks`); return; }
  for (const task of tasks as Obj[]) {
    const expect = task.expect;
    if (!isObj(expect) || !['ELIGIBLE', 'MANUAL_ONLY', 'HARD_BLOCKED'].includes(expect.eligibility) || !AVAILABILITY.includes(task.workerAvailabilityForThisTask)) { errors.push(`${id}/${task.label}: malformed reference task`); continue; }
    const bad = (name: string, allowed: string[]) => !Array.isArray(expect[name]) || expect[name].some((code: string) => !allowed.includes(code));
    if (bad('hardBlockers', HARD_CODES) || bad('dispatchBlockers', SOFT_CODES) || bad('applicationTimeBlockers', APPLICATION_CODES)) errors.push(`${id}/${task.label}: real matcher codes only`);
  }
}

function validateCorpus(corpus: Obj, src: Sources): string[] {
  const errors: string[] = [];
  if (corpus.corpusId !== 'EX06_CONTRACT_CORPUS' || !Number.isInteger(corpus.corpusVersion) || corpus.corpusVersion < 1) errors.push('header: corpusId/corpusVersion');
  if (corpus.synthetic !== true || corpus.providerCalls !== 0 || corpus.runAgainstProvider !== false || corpus.runAgainstMatcher !== false) errors.push('header: the corpus must declare itself synthetic and never run against a provider or the matcher');
  if (!/NOT_A_MODEL_QUALITY_SCORE/.test(corpus.kind ?? '')) errors.push('header: kind must say the corpus is not a model quality score');
  if ('passRate' in corpus || 'threshold' in corpus) errors.push('header: no pass rate or threshold is canonical');
  if (!same(corpus.workKinds, KINDS)) errors.push('header: workKinds must be exactly the eleven PKG-031b kinds');
  if (!same(corpus.kindOutcomeValues, [...KINDS, 'unclassified', 'refused'])) errors.push('header: kindOutcomeValues');
  if (!isObj(corpus.clock) || corpus.clock.timeZone !== 'Europe/Belgrade') errors.push('header: clock must be a Belgrade server clock');
  if (!Array.isArray(corpus.cases) || corpus.cases.length === 0) { errors.push('header: no cases'); return errors; }
  const cases: Obj[] = corpus.cases;

  const seen = new Set<string>();
  for (const c of cases) {
    if (!isStr(c.id) || !/^(T|W)-\d{3}$/.test(c.id)) { errors.push(`bad case id ${JSON.stringify(c.id)}`); continue; }
    if (seen.has(c.id)) errors.push(`duplicate case id ${c.id}`);
    seen.add(c.id);
    if (!(c.family === 'TASK' || c.family === 'WORKER') || c.id[0] !== (c.family === 'TASK' ? 'T' : 'W')) errors.push(`${c.id}: family must be TASK for T- and WORKER for W- ids`);
    if (!isStr(c.title)) errors.push(`${c.id}: title missing`); else scanText(c.id, 'title', c.title, errors);
    if (!isStrList(c.planRefs) || !c.planRefs.length) errors.push(`${c.id}: planRefs missing`);
    if (!Array.isArray(c.matcherConsumerClasses) || !c.matcherConsumerClasses.length || c.matcherConsumerClasses.some((entry: string) => !CONSUMER_CLASSES.includes(entry))) errors.push(`${c.id}: matcherConsumerClasses must use ${CONSUMER_CLASSES.join('/')}`);
    if (!isStrList(c.mustNot) || !c.mustNot.length) errors.push(`${c.id}: a mustNot list is required`);
    else for (const line of c.mustNot) scanText(c.id, 'mustNot', line, errors);
    if (c.family === 'TASK') validateTaskCase(c, src, errors); else if (c.family === 'WORKER') validateWorkerCase(c, src, errors);
  }

  // plan coverage, both directions
  const coverage = corpus.planCoverage;
  for (const item of REQUIRED_PLAN_ITEMS) {
    const entry = coverage?.[item];
    if (!entry || !Array.isArray(entry.cases) || !entry.cases.length) { errors.push(`plan coverage: ${item} has no case`); continue; }
    for (const caseId of entry.cases) {
      const found = cases.find((c) => c.id === caseId);
      if (!found) errors.push(`plan coverage: ${item} names missing case ${caseId}`);
      else if (!found.planRefs?.includes(item)) errors.push(`plan coverage: ${caseId} does not list ${item} in its planRefs`);
    }
  }
  for (const c of cases) for (const ref of c.planRefs ?? []) if (!coverage?.[ref]) errors.push(`plan coverage: ${c.id} uses ${ref}, which planCoverage does not declare`);

  // groups: same meaning, same outcome
  const group = (field: string) => {
    const groups = new Map<string, Obj[]>();
    for (const c of cases) if (c[field]) groups.set(c[field], [...(groups.get(c[field]) ?? []), c]);
    return groups;
  };
  for (const [name, members] of group('concurrencyGroup')) {
    if (members.length < 2) errors.push(`concurrency group ${name} needs at least two cases`);
    const kinds = new Set(members.map((member) => member.expected?.kind?.expected));
    const categories = new Set(members.map((member) => member.expected?.facts?.['need.category']?.canonicalText));
    if (kinds.size !== 1 || categories.size !== 1) errors.push(`concurrency group ${name}: every writer must land in the same group`);
  }
  for (const [name, members] of group('synonymGroup')) {
    if (members.filter((member) => member.family === 'TASK').length < 2) errors.push(`synonym group ${name} needs at least two task cases`);
    const kinds = new Set(members.map((member) => (member.family === 'TASK' ? member.expected?.kind?.expected : (member.expected?.kind?.expectedSet ?? []).join('+'))));
    if (kinds.size !== 1) errors.push(`synonym group ${name}: the members must resolve to the same hidden kind`);
  }
  for (const c of cases.filter((member) => member.variantOf)) {
    const origin = cases.find((member) => member.id === c.variantOf);
    if (!origin) { errors.push(`${c.id}: variantOf ${c.variantOf} is missing`); continue; }
    for (const key of ['need.price_rsd', 'need.starts_at', 'need.ends_at', 'need.people_needed', 'need.task_geography', 'need.schedule_kind']) {
      if (!same(c.expected?.facts?.[key], origin.expected?.facts?.[key])) errors.push(`${c.id}: variant of ${origin.id} must expect the same ${key}`);
    }
  }

  const counts = { total: cases.length, task: cases.filter((c) => c.family === 'TASK').length, worker: cases.filter((c) => c.family === 'WORKER').length };
  if (!same(corpus.caseCount, counts)) errors.push(`header: caseCount ${JSON.stringify(corpus.caseCount)} differs from ${JSON.stringify(counts)}`);
  return errors;
}

// ---------------------------------------------------------------- the tests
describe('EX-06 S02 synthetic contract corpus', () => {
  const sources = loadSources();
  const corpus = JSON.parse(readFrom(repoRoot, CORPUS_PATH)) as Obj;
  const clone = (): Obj => JSON.parse(JSON.stringify(corpus));

  describe('anchored to the real contract sources', () => {
    it('reads the full fact registry and the Edge enums from source text', () => {
      expect(sources.registry.size).toBe(sources.declaredFactKeys);
      expect(sources.registry.size).toBeGreaterThanOrEqual(23);
      expect([...sources.registry.keys()]).toEqual(expect.arrayContaining(['need.title', 'need.category', 'need.price_basis', 'need.task_geography', 'need.resolved_location']));
      expect(sources.priceModes).toEqual(['MY_PRICE', 'OFFERS']);
      expect(sources.priceBases).toEqual(['TOTAL', 'PER_PERSON']);
      expect(sources.scheduleKinds).toHaveLength(6);
      expect(sources.geographyModes).toHaveLength(5);
      expect(sources.dialogue.next).toEqual(['ASK', 'CLARIFY', 'REVIEW', 'ACK', 'ANSWER']);
      expect(sources.dialogue.priceUnit).toContain('PER_DAY');
      expect(sources.dialogue.schedulePattern).toContain('REPEATED');
    });

    it('pins the asking order used by the review derivation to the Edge guard', () => {
      expect(sources.askOrder).toEqual(['need.description', 'need.people_needed', 'need.price_mode', 'need.price_rsd', 'need.price_basis', 'need.schedule_kind',
        'need.starts_at', 'need.task_country_code', 'need.task_geography', 'need.handoff']);
      expect(sources.registry.get('need.ends_at')?.requiredForDraft).toBe(false);
      expect(sources.registry.get('need.handoff')?.requiredForDraft).toBe(false);
    });

    it('pins compatible worker fields and current personal-profile proposals to their respective sources', () => {
      // The corpus remains V1/history-compatible; WPP01 retired two provider inputs.
      for (const key of WORKER_PATCH_KEYS) expect(sources.workerClient).toMatch(new RegExp(`\\b${key}\\b`));
      const personalKeys = WORKER_PATCH_KEYS.filter(key => !['licenses', 'teamCapacity'].includes(key));
      for (const key of [...personalKeys, ...WORKER_LOCATION_KEYS, ...WORKER_AVAILABILITY_KEYS]) expect(sources.workerEdge).toMatch(new RegExp(`\\b${key}\\b`));
      expect(sources.workerEdge).toContain("['displayName','bio','skills','tools','vehicles','location','availability'].includes(k)");
      for (const label of WORKER_REQUIRED_LABELS) expect(sources.workerClient).toContain(label);
      expect(sources.workerEdge).toContain('to je to|to je sve|gotovo');
      expect(sources.taskEdge).toContain('to je to|to je sve|gotovo');
    });

    it('uses only matcher reason codes that exist in the matcher source', () => {
      for (const code of [...HARD_CODES, ...SOFT_CODES, ...APPLICATION_CODES].filter((entry) => !['AVAILABILITY_FRESHNESS_EXPIRED'].includes(entry))) expect(sources.matcher).toContain(code);
    });

    const pinned = sources.kindsSql ? it : it.skip;
    pinned('keeps the stem port equal to private.work_kinds_v5 in the PKG-031b candidate', () => {
      const found: Record<string, string> = {};
      for (const match of (sources.kindsSql as string).matchAll(/case when t ~ '(\([^']*\))' then '([A-Z_]+)' end/g)) found[match[2]] = match[1];
      expect(found).toEqual(STEMS);
    });
  });

  describe('the corpus', () => {
    it('is a valid synthetic contract corpus with no errors', () => {
      expect(validateCorpus(corpus, sources)).toEqual([]);
    });

    it('does not call a REMOTE case ready when its explicit handoff is removed', () => {
      const altered = clone();
      delete altered.cases.find((entry: Obj) => entry.id === 'T-008').expected.facts['need.handoff'];
      expect(validateCorpus(altered, sources)).toEqual(expect.arrayContaining([
        expect.stringContaining('T-008: expected.review differs from the derivation'),
      ]));
    });

    it('declares itself synthetic, unrun and score-free', () => {
      expect(corpus.synthetic).toBe(true);
      expect(corpus.providerCalls).toBe(0);
      expect(corpus.runAgainstProvider).toBe(false);
      expect(corpus.runAgainstMatcher).toBe(false);
      expect(corpus.kind).toMatch(/NOT_A_MODEL_QUALITY_SCORE/);
    });

    it('has unique ids, both families and three reference workers on every task case', () => {
      const cases = corpus.cases as Obj[];
      expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
      expect(cases.some((c) => c.family === 'TASK')).toBe(true);
      expect(cases.some((c) => c.family === 'WORKER')).toBe(true);
      for (const c of cases.filter((entry) => entry.family === 'TASK')) expect(c.referenceWorkers.map((w: Obj) => w.shape)).toEqual(SHAPES);
    });

    it('covers every plan 12.5 case, every plan 12.6 case, the A02 defect, the runbook topics and the worker topics', () => {
      const missing = REQUIRED_PLAN_ITEMS.filter((item) => !(corpus.planCoverage?.[item]?.cases?.length > 0));
      expect(missing).toEqual([]);
      expect(REQUIRED_PLAN_ITEMS.filter((item) => item.startsWith('P125-'))).toHaveLength(13);
      expect(REQUIRED_PLAN_ITEMS.filter((item) => item.startsWith('P126-'))).toHaveLength(10);
    });

    it('expects only the eleven hidden kinds, unclassified or refused', () => {
      for (const c of (corpus.cases as Obj[]).filter((entry) => entry.family === 'TASK')) {
        expect([...KINDS, 'unclassified', 'refused']).toContain(c.expected.kind.expected);
      }
    });
  });

  describe('the validator rejects broken corpora', () => {
    const errorsFor = (mutate: (copy: Obj) => void): string[] => { const copy = clone(); mutate(copy); return validateCorpus(copy, sources); };
    const firstReady = (copy: Obj) => (copy.cases as Obj[]).find((c) => c.family === 'TASK' && c.expected.review.state === 'READY_FOR_REVIEW')!;

    it('rejects an unknown fact key', () => {
      expect(errorsFor((copy) => { firstReady(copy).expected.facts['need.invented_field'] = 1; }).some((e) => /unknown fact key need\.invented_field/.test(e))).toBe(true);
    });
    it('rejects a wrong value type', () => {
      expect(errorsFor((copy) => { firstReady(copy).expected.facts['need.price_rsd'] = '4000'; }).some((e) => /need\.price_rsd.*INTEGER/.test(e))).toBe(true);
    });
    it('rejects an enum value outside the Edge enum', () => {
      expect(errorsFor((copy) => { firstReady(copy).expected.facts['need.schedule_kind'] = 'SOMETIME'; }).some((e) => /need\.schedule_kind.*ENUM/.test(e))).toBe(true);
    });
    it('rejects a manual-only fact as an expected AI fact', () => {
      expect(errorsFor((copy) => { firstReady(copy).expected.facts['need.verified_identity_required'] = true; }).some((e) => /manual-only/.test(e))).toBe(true);
    });
    it('rejects an e-mail, a phone number and a street with a number in a message', () => {
      expect(errorsFor((copy) => { firstReady(copy).turns[0].text += ' Pisite na ime.prezime@primer.rs'; }).some((e) => /e-mail-like/.test(e))).toBe(true);
      expect(errorsFor((copy) => { firstReady(copy).turns[0].text += ' Moj broj je 0641234567.'; }).some((e) => /phone-number-like/.test(e))).toBe(true);
      expect(errorsFor((copy) => { firstReady(copy).turns[0].text += ' Dolazite u ulici Primerna 12.'; }).some((e) => /street-and-number-like/.test(e))).toBe(true);
    });
    it('rejects a duplicate id', () => {
      expect(errorsFor((copy) => { copy.cases[1].id = copy.cases[0].id; }).some((e) => /duplicate case id/.test(e))).toBe(true);
    });
    it('rejects a work kind outside the eleven', () => {
      expect(errorsFor((copy) => { firstReady(copy).expected.kind.expected = 'ZIDARSKI_RADOVI'; }).some((e) => /not one of the eleven/.test(e))).toBe(true);
    });
    it('rejects a task case without three reference workers', () => {
      expect(errorsFor((copy) => { firstReady(copy).referenceWorkers.pop(); }).some((e) => /exactly three reference workers/.test(e))).toBe(true);
    });
    it('rejects an invented matcher reason code', () => {
      expect(errorsFor((copy) => { firstReady(copy).referenceWorkers[1].expect.hardBlockers = ['NOT_A_REAL_CODE']; }).some((e) => /real matcher codes/.test(e))).toBe(true);
    });
    it('rejects a fitting worker that is not eligible', () => {
      expect(errorsFor((copy) => { Object.assign(firstReady(copy).referenceWorkers[0].expect, { eligibility: 'MANUAL_ONLY', dispatchEligible: false, dispatchBlockers: ['OUTSIDE_AVAILABILITY'] }); }).length).toBeGreaterThan(0);
    });
    it('rejects an incomplete plan coverage list', () => {
      expect(errorsFor((copy) => { delete copy.planCoverage['P125-09']; }).some((e) => /plan coverage: P125-09 has no case/.test(e))).toBe(true);
    });
    it('rejects a worker patch field the profile schema does not have', () => {
      expect(errorsFor((copy) => { (copy.cases as Obj[]).find((c) => c.family === 'WORKER')!.expected.patch.exclusions = ['selidbe']; }).some((e) => /exclusions is not a worker patch field/.test(e))).toBe(true);
    });
    it('rejects a profile that an AI turn would activate', () => {
      expect(errorsFor((copy) => { (copy.cases as Obj[]).find((c) => c.family === 'WORKER')!.expected.review.profileStatusAfterAiTurn = 'ACTIVE'; }).some((e) => /never activates a profile/.test(e))).toBe(true);
    });
    it('rejects a stale kind probe', () => {
      expect(errorsFor((copy) => { firstReady(copy).expected.kind.currentStemsYield = ['ELEKTRO']; }).some((e) => /currentStemsYield differs/.test(e))).toBe(true);
    });
    it('rejects a score or threshold in the header', () => {
      expect(errorsFor((copy) => { copy.passRate = 0.9; }).some((e) => /no pass rate/.test(e))).toBe(true);
    });
  });
});
