// @ts-nocheck
import { AI_CREDITS_UNAVAILABLE, AI_DIAGNOSTICS_HEADER, AI_DIAGNOSTICS_VERSION, AI_AVAILABILITY_HEADER } from '../../../src/contracts/aiAvailability.ts';
// USKOCI server-side AI intake boundary.
// Provider secrets live only in Supabase Edge Function environment. Never expose
// GEMINI_API_KEY / SUPABASE_SERVICE_ROLE_KEY to Expo, source or logs.

import {
  LEGACY_FACT_SCHEMA_V1,
  NEED_FACT_SCHEMA_V2,
  NEED_FACT_V2_DEFINITIONS,
  AI_PROPOSABLE_NEED_FACT_V2_KEYS,
  isAiProposableNeedFactV2Key,
  isNeedFactV2Key,
} from '../../../src/contracts/needFactsV2.ts';

import { validLocationContext, locationProviderSchema, locationInstruction, parseLocationOutput, validLocationEnvelope, type LocationContext, type LocationAction } from '../_shared/locationReply.ts';

import { AI_TEST_LIMITS, reserveAiTestBudget } from '../_shared/aiTestBudget.ts';
import { GeminiCreditsUnavailableError, geminiRequestBody, geminiUsage, streamGeminiTask, type GeminiUsage } from '../_shared/geminiTaskStream.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LEGACY_FACT_KEYS = [
  'naslov', 'opis', 'kategorija', 'datum', 'vreme',
  'polaziste', 'odrediste', 'osoba', 'vozilo', 'uslovi',
] as const;
const legacyFactKeySet = new Set<string>(LEGACY_FACT_KEYS);
// Retired requirements stay readable in historical NEED_FACT_V2 documents, but
// a new interview may only propose conditions the current product enforces.
export const INTERVIEW_NEED_FACT_V2_KEYS = AI_PROPOSABLE_NEED_FACT_V2_KEYS.filter(key => key !== 'need.required_licenses');
const interviewFactKeySet = new Set<string>(INTERVIEW_NEED_FACT_V2_KEYS);
// Manual form witnesses remain in the full registry, but are neither AI input
// nor AI proposals. Keep legacy context during the existing schema transition.
const AI_CONTEXT_FACT_KEYS = [...LEGACY_FACT_KEYS, ...INTERVIEW_NEED_FACT_V2_KEYS];
const aiContextFactKeySet = new Set<string>(AI_CONTEXT_FACT_KEYS);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRICE_MODES = new Set(['MY_PRICE', 'OFFERS']);
const PRICE_BASES = new Set(['TOTAL', 'PER_PERSON']);
const SCHEDULE_KINDS = new Set([
  'FIXED_WINDOW',
  'FLEXIBLE',
  'REMOTE_ANYTIME',
  'TODAY_FLEXIBLE',
  'TOMORROW_FLEXIBLE',
  'WEEK_FLEXIBLE',
]);
const GEOGRAPHY_MODES = new Set(['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED', 'REMOTE']);

type FactSchemaVersion = typeof LEGACY_FACT_SCHEMA_V1 | typeof NEED_FACT_SCHEMA_V2;
type ParsedTurn = {
  safety: 'ALLOW' | 'CLARIFY' | 'REVIEW' | 'BLOCK';
  assistantMessage: string;
  proposals: Array<Record<string, unknown>>;
  locationAction?: LocationAction;
  dialogue?: { next: string; questionKey: string; taskRelation: string; priceUnit: string; schedulePattern: string };
};

const DIALOGUE_VALUES = {
  next: ['ASK', 'CLARIFY', 'REVIEW', 'ACK', 'ANSWER'],
  questionKey: ['', 'need.description', 'need.people_needed', 'need.price_mode', 'need.price_rsd', 'need.price_basis',
    'need.schedule_kind', 'need.starts_at', 'need.ends_at', 'need.task_country_code', 'need.task_geography'],
  taskRelation: ['CONTINUE', 'DIFFERENT_TASK', 'UNCLEAR'],
  priceUnit: ['WHOLE_JOB', 'PER_DAY', 'PER_HOUR', 'UNSPECIFIED'],
  schedulePattern: ['SINGLE', 'REPEATED', 'UNSPECIFIED'],
};

type ServerTimeContext = {
  nowUtc: string;
  timeZone: 'Europe/Belgrade';
  localDate: string;
  localTime: string;
  utcOffset: string;
};

function serverTimeContext(now: Date): ServerTimeContext {
  const timeZone = 'Europe/Belgrade' as const;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return {
    nowUtc: now.toISOString(), timeZone,
    localDate: `${part('year')}-${part('month')}-${part('day')}`,
    localTime: `${part('hour')}:${part('minute')}:${part('second')}`,
    utcOffset: part('timeZoneName').replace(/^GMT/, '') || '+00:00',
  };
}

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      ...(status === 503 && body.code === AI_CREDITS_UNAVAILABLE ? { [AI_AVAILABILITY_HEADER]: AI_CREDITS_UNAVAILABLE, 'Access-Control-Expose-Headers': AI_AVAILABILITY_HEADER } : {}) },
  });
}

const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: string[]) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);
const sameUuid = (value: unknown, expected: string) => isUuid(value) && value.toLowerCase() === expected.toLowerCase();

// What an operator log may say about a failed provider call: the class of the failure, from a closed
// list. Never the thrown text. A JSON parse error quotes the provider output it choked on, a runtime
// network error quotes its request, and a text that is merely shaped like one of our names proves
// nothing about where it came from. A name that is not listed is logged as UNKNOWN.
const OWN_FAILURE_NAMES = new Set([AI_CREDITS_UNAVAILABLE, 'AI_CLAIM_INVALID', 'AI_CONTEXT_INVALID', 'AI_CONTEXT_TOO_LARGE', 'AI_LEGACY_PERSIST_FAILED',
  'AI_MANUAL_ONLY_FACT_REJECTED', 'AI_PAYLOAD_EMPTY', 'AI_PAYLOAD_TOO_LARGE', 'AI_REQUEST_CANCELLED', 'AI_STREAM_INCOMPLETE',
  'AI_STREAM_INVALID', 'AI_STREAM_REJECTED', 'AI_STREAM_STOPPED', 'AI_STREAM_TOO_LARGE', 'AI_STREAM_UNAVAILABLE',
  'AI_TEST_BUDGET_UNAVAILABLE', 'AI_TRANSPORT_STOPPED', 'AI_TURN_RECEIPT_INVALID', 'AI_V2_FACT_INVALID', 'AI_V2_OUTPUT_INVALID',
  'ASSISTANT_MESSAGE_INVALID', 'ASSISTANT_MESSAGE_MISSING', 'PROVIDER_HTTP_FAILED', 'PROVIDER_OUTPUT_MISSING']);
const RUNTIME_FAILURE_CLASSES: Record<string, string> = { SyntaxError: 'OUTPUT_NOT_JSON', TypeError: 'RUNTIME_TYPE_ERROR',
  RangeError: 'RUNTIME_RANGE_ERROR', AbortError: 'ABORTED', TimeoutError: 'TIMED_OUT' };
function providerFailureClass(error: unknown): string {
  const thrown = object(error) ? error : {};
  if (typeof thrown.message === 'string' && OWN_FAILURE_NAMES.has(thrown.message)) return thrown.message;
  return typeof thrown.name === 'string' && Object.hasOwn(RUNTIME_FAILURE_CLASSES, thrown.name) ? RUNTIME_FAILURE_CLASSES[thrown.name] : 'UNKNOWN';
}

/** Bounds both fetch and body consumption. Abort does not prove remote rollback. */
async function boundedJson(input: string | Request, init: RequestInit = {}, limit = 524288, timeout = 8000, parent?: AbortSignal, omitErrorBody = false) {
  const controller = new AbortController();
  let expired = false;
  let timer: ReturnType<typeof setTimeout>;
  let rejectStopped: (reason: Error) => void = () => {};
  const stopped = new Promise<never>((_resolve, reject) => { rejectStopped = reject; });
  const stop = () => { expired = true; controller.abort(); rejectStopped(new Error('AI_TRANSPORT_STOPPED')); };
  if (parent?.aborted) stop();
  else parent?.addEventListener('abort', stop, { once: true });
  timer = setTimeout(stop, timeout);
  const work = async () => {
    if (expired) throw new Error('AI_TRANSPORT_STOPPED');
    const result = typeof input === 'string'
      ? await fetch(input, { ...init, signal: controller.signal, redirect: 'error' }) : input;
    if (expired || result instanceof Response && result.redirected) throw new Error('AI_TRANSPORT_STOPPED');
    if (omitErrorBody && result instanceof Response && !result.ok) {
      void result.body?.cancel().catch(() => {});
      return { ok: false, status: result.status, data: null };
    }
    const size = result.headers.get('content-length');
    if (size !== null && (!/^\d+$/.test(size) || Number(size) > limit)) throw new Error('AI_PAYLOAD_TOO_LARGE');
    const reader = result.body?.getReader();
    if (!reader) throw new Error('AI_PAYLOAD_EMPTY');
    const chunks: Uint8Array[] = []; let count = 0;
    try {
      while (true) {
        const part = await Promise.race([reader.read(), stopped]);
        if (expired) throw new Error('AI_TRANSPORT_STOPPED');
        if (part.done) break;
        count += part.value.byteLength;
        if (count > limit) throw new Error('AI_PAYLOAD_TOO_LARGE');
        chunks.push(part.value);
      }
    } finally { if (expired || count > limit) void reader.cancel().catch(() => {}); }
    const bytes = new Uint8Array(count); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return { ok: result instanceof Response ? result.ok : true, status: result instanceof Response ? result.status : 200, data };
  };
  try { return await Promise.race([work(), stopped]); }
  finally { clearTimeout(timer); parent?.removeEventListener('abort', stop); }
}

const userWindows = new Map<string, { times: number[]; busy: boolean }>();
function admitUser(accountId: string) {
  const now = Date.now();
  for (const [id, value] of userWindows) if (!value.busy && !value.times.some(time => time > now - 60000)) userWindows.delete(id);
  let value = userWindows.get(accountId);
  if (!value) {
    if (userWindows.size >= 2000) return null;
    value = { times: [], busy: false }; userWindows.set(accountId, value);
  }
  value.times = value.times.filter(time => time > now - 60000);
  if (value.busy || value.times.length >= 6) return null;
  value.times.push(now); value.busy = true;
  return () => { value!.busy = false; };
}

function validTurn(value: unknown, conversationId: string, requestId: string) {
  if (!exact(value, ['conversationId', 'clientRequestId', 'state', 'turnId', 'retryAllowed', 'receipt']) ||
    !sameUuid(value.conversationId, conversationId) || !sameUuid(value.clientRequestId, requestId) ||
    !['ABSENT', 'PROCESSING', 'SUCCEEDED', 'FAILED'].includes(value.state) || typeof value.retryAllowed !== 'boolean') return false;
  if (value.state === 'ABSENT') return value.turnId === null && value.receipt === null;
  if (!isUuid(value.turnId)) return false;
  if (value.state !== 'SUCCEEDED') return value.receipt === null && (value.state !== 'PROCESSING' || value.retryAllowed === false);
  const r = value.receipt;
  return !value.retryAllowed && exact(r, ['userMessageId', 'assistantMessageId', 'proposedCount', 'safety', 'schemaVersion', 'authoritative']) &&
    isUuid(r.userMessageId) && isUuid(r.assistantMessageId) && r.userMessageId !== r.assistantMessageId &&
    Number.isSafeInteger(r.proposedCount) && r.proposedCount >= 0 && r.proposedCount <= 12 &&
    ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(r.safety) && r.schemaVersion === NEED_FACT_SCHEMA_V2 && r.authoritative === true &&
    (r.safety !== 'BLOCK' || r.proposedCount === 0);
}
const turnResponse = (turn: any) => response(turn.state === 'SUCCEEDED' ? 200 : turn.state === 'PROCESSING' ? 202 : 409, turn);

function validClaimContext(context: unknown) {
  if (!exact(context, ['schemaVersion', 'history', 'activeFacts']) || context.schemaVersion !== NEED_FACT_SCHEMA_V2 ||
    !Array.isArray(context.history) || context.history.length > 40 || !Array.isArray(context.activeFacts) || context.activeFacts.length > 64) return false;
  return context.history.every((row: unknown) => exact(row, ['role', 'body', 'sequence_no']) &&
    ['USER', 'ASSISTANT', 'SYSTEM'].includes(row.role) && typeof row.body === 'string' && row.body.length <= 6000 &&
    Number.isSafeInteger(row.sequence_no) && row.sequence_no > 0) &&
    context.activeFacts.every((row: unknown) => exact(row, ['fact_key', 'fact_value', 'value_type', 'display_value', 'fact_schema_version', 'status', 'source', 'created_at']) &&
      isAiProposableNeedFactV2Key(row.fact_key) && row.fact_schema_version === NEED_FACT_SCHEMA_V2);
}

function geminiText(payload: any): string | null {
  for (const candidate of payload?.candidates ?? []) {
    for (const part of candidate?.content?.parts ?? []) {
      if (typeof part?.text === 'string' && part.text.trim()) return part.text;
    }
  }
  return null;
}

async function postgrest(
  url: string,
  apiKey: string,
  authorization: string,
  path: string,
  init: RequestInit = {},
) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: apiKey,
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function legacyProviderSchema() {
  return {
    type: 'OBJECT',
    additionalProperties: false,
    properties: {
      safety: { type: 'STRING', enum: ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'] },
      assistantMessage: { type: 'STRING' },
      facts: {
        type: 'ARRAY',
        maxItems: 10,
        items: {
          type: 'OBJECT',
          additionalProperties: false,
          properties: {
            key: { type: 'STRING', enum: LEGACY_FACT_KEYS },
            value: { type: 'STRING' },
            confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
            evidence: { type: 'STRING' },
          },
          required: ['key', 'value', 'confidence', 'evidence'],
        },
      },
    },
    required: ['safety', 'assistantMessage', 'facts'],
  };
}

function v2ProviderSchema() {
  return {
    type: 'OBJECT',
    additionalProperties: false,
    properties: {
      safety: { type: 'STRING', enum: ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'] },
      assistantMessage: { type: 'STRING' },
      dialogue: { type: 'OBJECT', additionalProperties: false,
        // Gemini rejects an empty string enum member. Keep the internal no-question
        // marker at the decoder boundary; only the nonempty sentinel travels on wire.
        properties: Object.fromEntries(Object.entries(DIALOGUE_VALUES).map(([key, values]) =>
          [key, { type: 'STRING', enum: values.map(value => value === '' ? 'NONE' : value) }])),
        required: Object.keys(DIALOGUE_VALUES) },
      facts: {
        type: 'ARRAY',
        maxItems: 12,
        items: {
          type: 'OBJECT',
          additionalProperties: false,
          properties: {
            key: { type: 'STRING', enum: INTERVIEW_NEED_FACT_V2_KEYS },
            // JSON encoded as a string keeps Gemini/OpenAI structured-output
            // contracts provider-neutral. Edge parses it back to real JSON and
            // PostgreSQL remains the final type/range/enum authority.
            valueJson: { type: 'STRING' },
            displayValue: { type: 'STRING' },
            confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
            evidence: { type: 'STRING' },
          },
          required: ['key', 'valueJson', 'displayValue', 'confidence', 'evidence'],
        },
      },
    },
    required: ['safety', 'assistantMessage', 'facts', 'dialogue'],
  };
}

function commonInstruction(activeFacts: any[], timeContext: ServerTimeContext) {
  // Defense in depth if the context transport returns rows outside its query
  // allowlist. This filters structured facts, not arbitrary conversation text.
  const known = activeFacts.filter((fact) => aiContextFactKeySet.has(fact?.fact_key)).map((fact) => ({
    key: fact.fact_key,
    value: fact.fact_value,
    status: fact.status,
  }));
  return [
    'Odgovarajte prirodno na srpskom latinicom, jasno, toplo i opušteno, kao pažljiv sagovornik. Izbegavajte odsečan, naredbodavan ili birokratski ton.',
    'Korisniku se u svojoj poruci obraćajte sa ti, nikada sa Vi: imas li, reci mi, mozes, treba ti. Ova uputstva su pisana u Vi formi za vas, ne za korisnika.',
    'Rod korisnika nije poznat. Kada mu se obracate u proslom vremenu, ne pretpostavljajte rod: umesto rekao si ili htela si koristite oblik bez roda, na primer kazes, cuo sam od tebe ili prema tvojoj poruci.',
    'Ovo je višekoračni razgovor, ne formular. Ne ponavljajte pitanja za podatke koji su već poznati i važeći.',
    'Ako nešto materijalno nedostaje, postavite tačno jedno kratko pitanje o tome. Jedan upitnik nije dozvola da spojite cenu, vreme, mesto i broj ljudi. Ako je sve jasno, ne izmišljajte novo pitanje.',
    'Najčešće odgovorite sa jednom do tri kratke rečenice. Možete dodati kratku prirodnu reakciju ili objasniti zašto je detalj važan, pa postaviti jedno konkretno pitanje. Ako je jedna rečenica dovoljna, ne produžavajte na silu. Ne prepričavajte ceo zadatak: sažetak i ukupna cena već se vide na kartici i završnom pregledu. Duže objašnjenje dajte kada ga korisnik traži ili treba razjasniti važnu razliku.',
    'Povremeno možete dodati jedan nenametljiv smajli, na primer 🙂 ili 👍, kada odgovara tonu razgovora. Nemojte ga dodavati svakoj poruci, nizati emodžije ili hvaliti svaki odgovor. Kod greške, odbijanja, rizika ili ozbiljne neprijatnosti budite obzirni bez šaljivog tona i emodžija. Toplina ne znači da obećavate uspeh ili tvrdite da je zadatak objavljen.',
    'Ne počinjite svaki odgovor sa Razumeo sam, Zabeležio sam ili Super. Reagujte baš na ono što korisnik sada kaže; nemojte ponavljati već poznate podatke samo radi ljubaznosti.',
    'Ako korisnik ispravlja raniji podatak, predložite novu vrednost istog ključa. Server čuva supersession istoriju.',
    'Nikada ne izmišljajte cenu, vreme, lokaciju, sprat, lift, broj ljudi, vozilo, dozvolu ili drugi materijalni uslov.',
    'Licence i sertifikati nisu uslov koji ovaj proizvod proverava ili koristi za izbor osobe. Ne pitajte za njih i ne predlažite need.required_licenses. Ako korisnik traži takav uslov, jasno objasnite da aplikacija ne podržava njegovu proveru; ne prenosite ga u druge uslove, veštine, naslov ili opis kao podržan filter. Ne tvrdite da je neko kvalifikovan ili zakonski ovlašćen. Sačuvani istorijski podaci nisu dozvola da ponovo uvodite taj uslov.',
    `Serverski vremenski kontekst za trenutni unos u Srbiji: ${JSON.stringify(timeContext)}.`,
    'Relativne datume poput danas, sutra i prekosutra tumačite prema ovom serverskom lokalnom datumu, a ne prema sopstvenoj memoriji ili datumu koji klijent tvrdi da je sada. Ako je relevantna druga vremenska zona ili je datum dvosmislen, tražite razjašnjenje.',
    'Ovaj vremenski kontekst je referenca za predlog, nikada potvrđen termin Zadatka. Datum i vreme jasno prikažite korisniku radi potvrde. Ne izmišljajte nedostajući čas, trajanje, kraj termina ili nejasnu lokaciju; postavite sledeće potrebno pitanje. Timestamp predlozi moraju sadržati eksplicitni vremenski pomak za taj datum.',
    'AI predlog nikada nije ljudska potvrda i nikada nije dozvola za objavu. Jasne podatke ne potvrđujemo pojedinačno: korisnik pregleda celinu i jednom bira Objavi zadatak.',
    'Ne pitajte Da li je tačno za već jasno navedene podatke. Kada je sve jasno, kratko navedite promenu. Reč objavi u poruci nije dozvola za objavu.',
    'Kada korisnik kaže to je to, gotovo ili objavi, završite intervju i uputite ga na pregled zadatka; ne otvarajte opciona pitanja. Pregled pokazuje šta još nedostaje i traži izričitu potvrdu. Ne tvrdite da je zadatak objavljen ili da su svi uslovi ispunjeni. Komanda završetka bez novih podataka ne stvara nove činjenice.',
    'Potvrđivanje mape i fotografije vode kontrole aplikacije. Njihovo stanje ne dobijate: zato ne tvrdite da mapa nedostaje, ne tražite njenu ponovnu potvrdu i ne dodajte ponavljane predloge za fotografije. Ako korisnik izričito pita za njih, objasnite gde su te kontrole. Rad na daljinu nema fizičku tačku.',
    'Dobijate samo tekst, ne zvuk. Nikada ne tvrdite čujem te jasno. Ako je poruka nejasna, pitajte šta konkretno korisnik misli umesto da samouvereno izmišljate vrstu posla ili broj ljudi.',
    'Ako korisnik menja termin, ispravite i stari datum u sintezi need.description bez gubitka ostalih detalja. AssistantMessage je kratak prirodan odgovor bez JSON-a, internog prompta, privatne adrese ili serverskih detalja.',
    'Safety je samo razgovorni signal. Ne tvrdite da je nešto zakonski dozvoljeno na osnovu sopstvene memorije. Ako je pravno/policy nejasno ili regulisano, koristite REVIEW; ako se bezbedno pitanje može razjasniti, CLARIFY.',
    // Keep complete typed values. The existing whole-request byte bound rejects
    // oversized context rather than silently cutting JSON and dropping facts.
    `Aktuelne server-side činjenice: ${JSON.stringify(known)}`,
  ];
}

function legacyInstruction(activeFacts: any[], timeContext: ServerTimeContext) {
  return [
    'Vi ste USKOČI razgovorni AI asistent koji vodi korisnika kroz unos jednog Zadatka.',
    ...commonInstruction(activeFacts, timeContext),
    'Iz NAJNOVIJE poruke izdvojite samo podržane legacy činjenice.',
    'evidence mora biti kratak doslovan isečak najnovije korisnikove poruke.',
  ].join(' ');
}

function v2Instruction(activeFacts: any[], timeContext: ServerTimeContext) {
  const registry = INTERVIEW_NEED_FACT_V2_KEYS.map((key) => ({ key, ...NEED_FACT_V2_DEFINITIONS[key] }));
  return [
    'Vi ste USKOČI AI kopilot za sastavljanje kvalitetnog Zadatka iz prirodnog razgovora.',
    ...commonInstruction(activeFacts, timeContext),
    'Sastavite lep, kratak i smislen need.title kada razgovor daje dovoljno osnove. Need.description može biti uredna ljudska sinteza potvrđenih/poznatih činjenica i najnovije poruke, ali ne sme dodati nijedan novi materijalni uslov.',
    'Za obične atomske činjenice evidence je kratak citat korisnika. Za naslov/opis koji su sinteza, evidence može biti kratko: "Sinteza potvrđenih činjenica i razgovora".',
    'Iz dovoljno jasnog opisa predložite i nedostajuću need.category: kratak naziv stvarno opisane vrste zadatka, bez novih uslova i bez opšteg rezervnog naziva poput ostalo. Kategorija je interni podatak; ne pitajte korisnika za kategoriju. Ako opis nije jasan, pitajte šta konkretno treba uraditi. Pre REVIEW proverite i naslov i kategoriju. Ako korisnik samo završava razgovor, a već postoji jasan need.description, možete dopuniti samo nedostajući naslov ili kategoriju uz evidence koji je doslovan isečak tog postojećeg opisa; ne menjajte nijedan postojeći podatak i ne dodajte materijalne uslove iz komande završetka.',
    'dialogue opisuje sledeći korak, nije nova činjenica. next: ASK samo za nedostajući podatak, CLARIFY za stvarnu dvosmislenost, REVIEW za završetak i prelazak na pregled, ACK za izmenu bez pitanja, ANSWER kada korisnik traži objašnjenje. questionKey je tačan ključ pitanja za ASK, inače NONE. Ne birajte ASK za već poznat podatak.',
    'Ako korisnik pita zašto nešto tražite, postavi drugo pitanje o ovom zadatku ili kaže da se ponavljate, prvo odgovorite na tu poruku koristeći ANSWER i questionKey NONE. Nemojte umesto odgovora ponoviti pitanje za nedostajuće polje. Objasnite konkretno šta još nije jasno, bez ponavljanja privatne adrese.',
    'Delimičan podatak nije isto što i nikakav podatak. Kod prenosa razlikujte mesto preuzimanja i odredište: ako je odredište poznato, a grad preuzimanja nije, pitajte samo za grad preuzimanja. Ne izmišljajte ga iz naziva ulice. Ako ponovo tražite istu vrstu podatka, recite koji tačno deo nedostaje; ne ponavljajte isto opšte pitanje. Već navedene detalje sačuvajte u kontekstu i predložite tipizovanu geografiju tek kada imate njene obavezne delove.',
    'dialogue.taskRelation: CONTINUE za isti posao i njegove ispravke, DIFFERENT_TASK za drugi nepovezan posao, UNCLEAR ako to nije jasno. Prvi opis u praznom razgovoru je CONTINUE. Promena broja ljudi, cene ili datuma istog posla nije novi posao. Za DIFFERENT_TASK ne prepisujte ovaj zadatak: aplikacija ima Novi zadatak i čuva prethodni razgovor.',
    'dialogue.priceUnit je WHOLE_JOB samo kada je jasno da se iznos odnosi na ceo obim posla; PER_DAY za dnevnicu, PER_HOUR za satnicu, UNSPECIFIED kada se cena ne obrađuje ili jedinica nije jasna. Navedite stvarnu jedinicu čak i kad umete da izračunate proizvod. dialogue.schedulePattern: SINGLE za jedan neprekidan termin, REPEATED za odvojene smene/dane, UNSPECIFIED kada se termin ne obrađuje. Nedovršeno razjašnjenje ostaje važno i u sledećoj poruci.',
    'Predložite samo nove ili stvarno izmenjene činjenice. Isti podatak ne predlažite ponovo samo zato što ga pominjete. UNKNOWN znači nerazjašnjeno, ne važeći uslov. Promena vrste posla nije dozvola da se stara cena, termin ili uslovi automatski prenesu na novi posao; prvo razjasnite da li je to novi zadatak.',
    'valueJson je JSON tekst stvarne tipizovane vrednosti: tekst/enum/timestamp kao JSON string sa navodnicima, integer kao broj, boolean true/false, niz kao JSON niz stringova, geography kao JSON objekat.',
    'need.price_mode može biti samo MY_PRICE ili OFFERS. Ako je MY_PRICE, need.price_rsd mora biti poznat pre spremnosti za nacrt.',
    'need.price_basis može biti samo TOTAL ili PER_PERSON i postavlja se isključivo uz need.price_mode MY_PRICE. Kada zadatak traži više od jedne osobe i korisnik je naveo svoju cenu, jednom kratko pitajte da li je taj iznos ukupno za ceo zadatak ili po osobi, i postavite činjenicu tek iz odgovora; nemojte pretpostavljati. Ako izabere ukupno, recite mu i da onda jedna prijava pokriva ceo zadatak, a ako želi da angažuje ljude pojedinačno, cena je po osobi. Za jednu osobu ovu činjenicu ne pominjite i ne postavljajte.',
    'Cena se odnosi na ceo obim posla, ukupno ili po osobi. Dnevnica ili satnica nije automatski cena za ceo zadatak. Kada korisnik navede cenu po danu/satu, prvo razjasnite obim i iznos za ceo posao; ne upisujte dnevnicu kao konačnu cenu. Odvojene dnevne smene ne predstavljajte kao neprekidan FIXED_WINDOW. Ne izmišljajte broj dana, trajanje ni ukupan iznos. Kada objašnjavate cenu po osobi, koristite tačan proizvod cene za ceo posao i broja ljudi; ne ponavljajte taj obračun u svakom odgovoru.',
    'need.schedule_kind može biti samo FIXED_WINDOW, FLEXIBLE, REMOTE_ANYTIME, TODAY_FLEXIBLE, TOMORROW_FLEXIBLE ili WEEK_FLEXIBLE. FIXED_WINDOW zahteva i starts_at i ends_at, sa krajem posle početka.',
    'need.task_geography.mode može biti STATIONARY, POINT_TO_POINT, MULTI_STOP, AREA_BASED ili REMOTE. Objekat sme imati samo mode/start/end/waypoints/serviceArea; lokacijske tačke samo label/city/area. REMOTE nema fizičke tačke. AREA_BASED koristi start ili serviceArea. Kada korisnik navede ulicu ili prepoznatljivo mesto za tačku rute, sačuvajte privacy-safe naziv ulice/POI bez kućnog broja u label ili area baš te start/end/waypoint tačke, uz poznati city, da mapa može da uokviri pravi kraj. Tačnu adresu sa kućnim brojem stavljajte isključivo u need.exact_address.',
    'Tačna privatna adresa/access notes nikada se ne prebacuju u javnu geography ili opis. Jedan need.exact_address nije dozvola da se privatna adresa pripiše polazištu druge route tačke; tačne route pinove korisnik potvrđuje na mapi.',
    'U ovoj test verziji identitet je samostalno naveden; provera dokumenta, selfija ili spoljnim KYC servisom nije dostupna. Ne predlažite need.verified_identity_required niti tvrdite da je bilo čiji identitet proveren. Ako korisnik traži provereni identitet, u odgovoru jasno objasnite da ta provera nije dostupna i da može nastaviti običnim Zadatkom. Nedostupni zahtev ne prenosite u naslov, opis, veštine ili bitne uslove kao da je ispunjen ili podržan. Postojeći takav uslov vlasnik uklanja izričitom ručnom ispravkom u pregledu.',
    `Jedini podržani V2 fact registry: ${JSON.stringify(registry)}`,
  ].join(' ');
}

function parseSafety(value: unknown): ParsedTurn['safety'] {
  return ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(String(value))
    ? String(value) as ParsedTurn['safety']
    : 'REVIEW';
}

function rejectManualOnlyFacts(parsed: any): void {
  for (const fact of Array.isArray(parsed?.facts) ? parsed.facts : []) {
    const key = typeof fact?.key === 'string' ? fact.key : '';
    if (isNeedFactV2Key(key) && !interviewFactKeySet.has(key)) {
      // Reject the entire turn before any writer, including BLOCK and legacy
      // replies; silently dropping this fact would still persist the response.
      throw new Error('AI_MANUAL_ONLY_FACT_REJECTED');
    }
  }
}

function parseLegacyOutput(parsed: any): ParsedTurn {
  rejectManualOnlyFacts(parsed);
  const safety = parseSafety(parsed?.safety);
  const assistantMessage = typeof parsed?.assistantMessage === 'string'
    ? parsed.assistantMessage.trim().slice(0, 1200)
    : '';
  if (!assistantMessage) throw new Error('ASSISTANT_MESSAGE_MISSING');
  const proposals: Array<Record<string, unknown>> = [];
  if (safety !== 'BLOCK') {
    for (const fact of Array.isArray(parsed?.facts) ? parsed.facts : []) {
      const key = typeof fact?.key === 'string' ? fact.key : '';
      const value = typeof fact?.value === 'string' ? fact.value.trim().slice(0, 2000) : '';
      const evidence = typeof fact?.evidence === 'string' ? fact.evidence.trim().slice(0, 500) : '';
      const confidence = Number(fact?.confidence);
      if (!legacyFactKeySet.has(key) || !value || !evidence || !Number.isFinite(confidence)) continue;
      proposals.push({ key, value, confidence: Math.max(0, Math.min(1, confidence)), evidence });
    }
  }
  return { safety, assistantMessage, proposals };
}

function valueMatchesType(valueType: string, value: unknown): boolean {
  if (valueType === 'TEXT' || valueType === 'ENUM' || valueType === 'TIMESTAMPTZ') return typeof value === 'string' && value.trim().length > 0;
  if (valueType === 'INTEGER') return typeof value === 'number' && Number.isInteger(value);
  if (valueType === 'BOOLEAN') return typeof value === 'boolean';
  if (valueType === 'TEXT_ARRAY') {
    return Array.isArray(value)
      && value.length <= 50
      && value.every((x) => typeof x === 'string' && x.trim().length > 0 && x.length <= 500);
  }
  if (valueType === 'OBJECT') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  return false;
}

function locationRefValid(value: unknown): boolean {
  if (value == null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !['label', 'city', 'area'].includes(key))) return false;
  const values = ['label', 'city', 'area'].map((key) => typeof record[key] === 'string' ? record[key].trim() : '');
  if (!values.some(Boolean)) return false;
  return values[0].length <= 240 && values[1].length <= 160 && values[2].length <= 160;
}

function geographyValid(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const geo = value as Record<string, unknown>;
  if (Object.keys(geo).some((key) => !['mode', 'start', 'end', 'waypoints', 'serviceArea'].includes(key))) return false;
  const mode = typeof geo.mode === 'string' ? geo.mode : '';
  if (!GEOGRAPHY_MODES.has(mode)) return false;
  const start = geo.start ?? null;
  const end = geo.end ?? null;
  const serviceArea = geo.serviceArea ?? null;
  const waypoints = geo.waypoints ?? [];
  if (!Array.isArray(waypoints) || waypoints.length > 20) return false;
  if (!locationRefValid(start) || !locationRefValid(end) || !locationRefValid(serviceArea) || !waypoints.every(locationRefValid)) return false;

  if (mode === 'REMOTE') return start == null && end == null && serviceArea == null && waypoints.length === 0;
  if (mode === 'STATIONARY') return start != null && end == null && serviceArea == null && waypoints.length === 0;
  if (mode === 'POINT_TO_POINT') return start != null && end != null && serviceArea == null && waypoints.length === 0;
  if (mode === 'MULTI_STOP') return start != null && serviceArea == null && (end != null || waypoints.length > 0);
  if (mode === 'AREA_BASED') return end == null && waypoints.length === 0 && (start != null || serviceArea != null);
  return false;
}

function valueMatchesContract(key: string, value: unknown): boolean {
  if (!isNeedFactV2Key(key)) return false;
  const definition = NEED_FACT_V2_DEFINITIONS[key];
  if (!valueMatchesType(definition.valueType, value)) return false;

  if (key === 'need.title') return (value as string).trim().length <= 140;
  if (key === 'need.description') return (value as string).trim().length <= 6000;
  if (key === 'need.category') return (value as string).trim().length <= 120;
  if (key === 'need.price_mode') return PRICE_MODES.has(String(value));
  // Without this the ENUM falls through to `return true`, the model's word travels all the way to
  // the server, and the person sees V2_PRICE_BASIS_INVALID instead of the AI correcting itself.
  if (key === 'need.price_basis') return PRICE_BASES.has(String(value));
  if (key === 'need.price_rsd') return Number(value) >= 1 && Number(value) <= 100000000;
  if (key === 'need.schedule_kind') return SCHEDULE_KINDS.has(String(value));
  if (key === 'need.people_needed') return Number(value) >= 1 && Number(value) <= 50;
  if (key === 'need.minimum_experience_years') return Number(value) >= 0 && Number(value) <= 60;
  if (key === 'need.exact_address') return (value as string).trim().length <= 1000;
  if (key === 'need.access_notes') return (value as string).trim().length <= 2000;
  if (key === 'need.task_geography') return geographyValid(value);
  return true;
}

function parseV2Output(parsed: any): ParsedTurn {
  rejectManualOnlyFacts(parsed);
  if (!exact(parsed, ['safety', 'assistantMessage', 'facts', 'dialogue']) || !['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(parsed.safety) ||
    !Array.isArray(parsed.facts) || parsed.facts.length > 12) throw new Error('AI_V2_OUTPUT_INVALID');
  if (!exact(parsed.dialogue, Object.keys(DIALOGUE_VALUES))) throw new Error('AI_V2_OUTPUT_INVALID');
  const dialogue = { ...parsed.dialogue, questionKey: parsed.dialogue.questionKey === 'NONE' ? '' : parsed.dialogue.questionKey };
  if (Object.entries(DIALOGUE_VALUES).some(([key, values]) =>
    !values.includes(dialogue[key])) || (dialogue.next === 'ASK') !== (dialogue.questionKey !== ''))
    throw new Error('AI_V2_OUTPUT_INVALID');
  const safety = parseSafety(parsed?.safety);
  const assistantMessage = typeof parsed?.assistantMessage === 'string'
    ? parsed.assistantMessage.trim()
    : '';
  if (!assistantMessage || assistantMessage.length > 1200 || safety === 'BLOCK' && parsed.facts.length) throw new Error('ASSISTANT_MESSAGE_INVALID');
  const proposals: Array<Record<string, unknown>> = [];
  if (safety !== 'BLOCK') {
    const seen = new Set<string>();
    for (const fact of Array.isArray(parsed?.facts) ? parsed.facts : []) {
      const key = typeof fact?.key === 'string' ? fact.key : '';
      if (!exact(fact, ['key', 'valueJson', 'displayValue', 'evidence', 'confidence']) ||
        !interviewFactKeySet.has(key) || seen.has(key) || typeof fact.valueJson !== 'string') throw new Error('AI_V2_FACT_INVALID');
      let value: unknown;
      try { value = JSON.parse(fact.valueJson); } catch { throw new Error('AI_V2_FACT_INVALID'); }
      if (!valueMatchesContract(key, value)) throw new Error('AI_V2_FACT_INVALID');
      const displayValue = typeof fact?.displayValue === 'string' ? fact.displayValue.trim() : '';
      const evidence = typeof fact?.evidence === 'string' ? fact.evidence.trim() : '';
      const confidence = fact?.confidence;
      if (!displayValue || displayValue.length > 1000 || !evidence || evidence.length > 500 ||
        typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('AI_V2_FACT_INVALID');
      seen.add(key);
      proposals.push({
        key,
        value,
        displayValue,
        confidence: Math.max(0, Math.min(1, confidence)),
        evidence,
      });
    }
  }
  return { safety, assistantMessage, proposals, dialogue };
}

async function callGemini(
  key: string,
  model: string,
  schemaVersion: FactSchemaVersion,
  history: any[],
  activeFacts: any[],
  text: string,
  timeContext: ServerTimeContext,
  signal?: AbortSignal,
  onText?: (delta: string) => void,
  onUsage?: (usage: GeminiUsage) => void,
  locationContext?: LocationContext,
) {
  const contents = history.slice(-30).map((row) => ({
    role: row.role === 'ASSISTANT' ? 'model' : 'user',
    parts: [{ text: String(row.body ?? '').slice(0, 4000) }],
  }));
  contents.push({ role: 'user', parts: [{ text }] });
  const parseOutput = (value: any) => locationContext ? parseLocationOutput(value, locationContext, parseV2Output) : parseV2Output(value);
  const instruction = schemaVersion === NEED_FACT_SCHEMA_V2 ? v2Instruction(activeFacts, timeContext) : legacyInstruction(activeFacts, timeContext);
  const payloadBody = JSON.stringify({
    systemInstruction: { parts: [{ text: instruction }, ...(locationContext ? [{ text: locationInstruction(locationContext) }] : [])] },
    contents,
    generationConfig: { temperature: 0.2, maxOutputTokens: AI_TEST_LIMITS.llmMaxOutputTokens,
      responseMimeType: 'application/json', responseSchema: schemaVersion === NEED_FACT_SCHEMA_V2 ? (locationContext ? locationProviderSchema(v2ProviderSchema()) : v2ProviderSchema()) : legacyProviderSchema() },
  });
  if (new TextEncoder().encode(payloadBody).byteLength > AI_TEST_LIMITS.llmRequestBytes) throw new Error('AI_CONTEXT_TOO_LARGE');
  if (onText) {
    const raw = await streamGeminiTask({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      key, body: payloadBody, signal, onText: () => {}, onUsage, timeoutMs: 30000,
    });
    return parseOutput(JSON.parse(raw));
  }
  const providerResponse = await boundedJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: geminiRequestBody(payloadBody) },
    131072, 30000, signal, true,
  );
  if (!providerResponse.ok) {
    console.error('GEMINI_GENERATE_FAILED', providerResponse.status);
    if (providerResponse.status === 402) throw new GeminiCreditsUnavailableError();
    throw new Error('PROVIDER_HTTP_FAILED');
  }
  const payload = providerResponse.data;
  // The non-streaming path reports the same counts on the single response body.
  if (onUsage) { const usage = geminiUsage(payload?.usageMetadata); if (usage) { try { onUsage(usage); } catch { /* accounting never breaks delivery */ } } }
  const raw = geminiText(payload);
  if (!raw) {
    const blocked = Boolean(payload?.promptFeedback?.blockReason)
      || (payload?.candidates ?? []).some((candidate: any) => ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT'].includes(candidate?.finishReason));
    if (blocked) return { safety: 'BLOCK', assistantMessage: 'Ne mogu da pomognem sa tim zahtevom.', proposals: [] };
    throw new Error('PROVIDER_OUTPUT_MISSING');
  }
  const parsed = JSON.parse(raw);
  return schemaVersion === NEED_FACT_SCHEMA_V2 ? parseOutput(parsed) : parseLegacyOutput(parsed);
}

function taskFinishOnly(input: string): boolean {
  const normalized = input.normalize('NFKC').toLowerCase().trim().replace(/[.!?,…]+/g, ' ').replace(/\s+/g, ' ').trim();
  return /^(?:to je to|to je sve|gotovo|gotovo to je sve|objavi|objavi zadatak|sačuvaj|sacuvaj|то је то|то је све|готово|објави|објави задатак|сачувај)$/.test(normalized);
}

// Explicit task publication stays outside map confirmation. This is a publication
// guard, not a vocabulary for recognizing natural affirmative replies.
function explicitPublicationOnly(input: string): boolean {
  return /^(?:objavi(?: zadatak)?|објави(?: задатак)?|sačuvaj zadatak|sacuvaj zadatak|сачувај задатак)[.!?,…\s]*$/i.test(input.trim());
}

function sameFactValue(left: unknown, right: unknown): boolean {
  // Object key order is immaterial; array order and exact typed values are not.
  const ordered = (value: any): any => Array.isArray(value) ? value.map(ordered)
    : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
}

function guardConversationTurn(turn: ParsedTurn, input: string, activeFacts: any[], time: ServerTimeContext, contextualLocation = false): ParsedTurn {
  if (turn.safety === 'BLOCK' || turn.safety === 'REVIEW') return turn;
  if (taskFinishOnly(input) && (!contextualLocation || turn.locationAction !== 'CONFIRM_DISPLAYED')
    || contextualLocation && explicitPublicationOnly(input)) {
    // Ending the interview supplies no new terms. Only missing presentation of an existing
    // description may be completed, with literal evidence from that description. Map replies
    // and task/price/schedule ambiguity never take this exception. Semantic accuracy still
    // belongs to the provider; the final review remains an explicit human decision.
    const known = new Map(activeFacts.filter(f => f.status !== 'UNKNOWN').map(f => [f.fact_key, f.fact_value]));
    const description = known.get('need.description');
    const plainFinish = !contextualLocation && turn.dialogue?.taskRelation === 'CONTINUE'
      && turn.dialogue.priceUnit === 'UNSPECIFIED' && turn.dialogue.schedulePattern === 'UNSPECIFIED';
    const proposals = plainFinish && typeof description === 'string' && description.trim()
      ? turn.proposals.filter(proposal => ['need.title', 'need.category'].includes(proposal.key) && !known.has(proposal.key)
        && typeof proposal.evidence === 'string' && proposal.evidence.trim().length >= 3
        && description.includes(proposal.evidence.trim())) : [];
    return { ...turn, proposals,
      assistantMessage: 'Otvori pregled zadatka. Tamo možeš da dopuniš podatke i potvrdiš objavu.' };
  }
  const clarification = (assistantMessage: string): ParsedTurn => ({ safety: 'CLARIFY', proposals: [], assistantMessage });
  const dialogue = turn.dialogue;
  if (dialogue?.taskRelation === 'DIFFERENT_TASK') return clarification('Za drugi posao izaberi Novi zadatak u opcijama razgovora. Ovaj razgovor čuva prethodni zadatak.');
  if (dialogue?.taskRelation === 'UNCLEAR') return clarification('Da li menjaš ovaj zadatak ili želiš da napraviš novi?');
  if (dialogue?.priceUnit === 'PER_DAY' || dialogue?.priceUnit === 'PER_HOUR')
    return clarification('Koji iznos želiš za ceo posao, uz napomenu da li je ukupno ili po osobi? Dnevnica ili satnica još nije cena celog zadatka.');
  if (dialogue?.schedulePattern === 'REPEATED')
    return clarification('Ovaj unos podržava jedan neprekidan termin. Koji termin želiš za ovaj zadatak?');
  // Deliberately narrow deterministic check. A negation, alternative, quotation
  // or several relative dates must be interpreted in context, never rewritten
  // by a naive keyword replacement. This does not prove arbitrary language true.
  const normalized = input.toLowerCase().replace(/данас/g, 'danas').replace(/прекосутра/g, 'prekosutra').replace(/сутра/g, 'sutra');
  const relative = normalized.match(/^\s*(?:(?:treba mi|termin je|za|треба ми|термин је|за)\s+)?(danas|sutra|prekosutra)[.!?\s]*$/);
  if (relative) {
    const offset = { danas: 0, sutra: 1, prekosutra: 2 }[relative[1]]!;
    const expectedDate = new Date(Date.parse(time.localDate + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
    const expectedKind = offset === 0 ? 'TODAY_FLEXIBLE' : offset === 1 ? 'TOMORROW_FLEXIBLE' : null;
    const kind = turn.proposals.find(p => p.key === 'need.schedule_kind')?.value;
    const start = turn.proposals.find(p => p.key === 'need.starts_at')?.value;
    const wrongKind = typeof kind === 'string' && kind !== 'FIXED_WINDOW' && kind !== expectedKind;
    const wrongStart = typeof start === 'string' && Number.isFinite(Date.parse(start))
      && serverTimeContext(new Date(start)).localDate !== expectedDate;
    if (wrongKind || wrongStart) return { safety: 'CLARIFY', proposals: [],
      assistantMessage: `Da razjasnimo termin: misliš na ${expectedDate.split('-').reverse().join('.')}?` };
  }
  // Validate an explicit source/value contradiction even inside a full sentence.
  // This is evidence consistency, not interpretation of negation or alternatives:
  // on conflict ask for a date; never silently substitute one mentioned word.
  for (const proposal of turn.proposals) {
    if (!['need.schedule_kind', 'need.starts_at'].includes(proposal.key)) continue;
    const evidence = String(proposal.evidence ?? '').toLowerCase().trim()
      .replace(/данас/g, 'danas').replace(/прекосутра/g, 'prekosutra').replace(/сутра/g, 'sutra')
      .replace(/[.!?]+$/g, '').trim();
    if (!['danas', 'sutra', 'prekosutra'].includes(evidence)
      || !new RegExp('(?:^|[^\\p{L}])' + evidence + '(?=$|[^\\p{L}])', 'u').test(normalized)) continue;
    const offset = { danas: 0, sutra: 1, prekosutra: 2 }[evidence]!;
    const date = new Date(Date.parse(time.localDate + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
    const kind = offset === 0 ? 'TODAY_FLEXIBLE' : offset === 1 ? 'TOMORROW_FLEXIBLE' : null;
    const conflict = proposal.key === 'need.schedule_kind'
      ? proposal.value !== 'FIXED_WINDOW' && proposal.value !== kind
      : typeof proposal.value === 'string' && Number.isFinite(Date.parse(proposal.value))
        && serverTimeContext(new Date(proposal.value)).localDate !== date;
    if (conflict) return clarification('Koji je tačan datum početka posla?');
  }
  const proposals = turn.proposals.filter(proposal => !activeFacts.some(fact =>
    fact.fact_key === proposal.key && fact.status !== 'UNKNOWN' && sameFactValue(fact.fact_value, proposal.value)));
  // Contextual map questions remain about the visible place. All safety, task,
  // time, price and typed-fact guards above still run; generic ACK/review prose does not replace them.
  if (contextualLocation) return { ...turn, proposals };
  const facts = new Map(activeFacts.filter(f => f.status !== 'UNKNOWN').map(f => [f.fact_key, f.fact_value]));
  for (const proposal of proposals) facts.set(proposal.key, proposal.value);
  const missing = [...new Set(['need.description', 'need.people_needed', 'need.price_mode',
    ...(facts.get('need.price_mode') === 'MY_PRICE' ? ['need.price_rsd', ...(Number(facts.get('need.people_needed')) > 1 ? ['need.price_basis'] : [])] : []),
    'need.schedule_kind', ...(facts.get('need.schedule_kind') === 'FIXED_WINDOW' ? ['need.starts_at', 'need.ends_at'] : []),
    'need.task_country_code', 'need.task_geography',
    ...Object.entries(NEED_FACT_V2_DEFINITIONS).filter(([, definition]) => definition.requiredForDraft).map(([key]) => key)])]
    .filter(key => !facts.has(key));
  const questions: Record<string, string> = {
    'need.description': 'Šta treba da se uradi?', 'need.people_needed': 'Koliko ljudi ti treba?',
    'need.price_mode': 'Želiš da navedeš cenu ili da dobiješ ponude?', 'need.price_rsd': 'Koju cenu nudiš za ceo posao?',
    'need.price_basis': 'Da li je navedena cena ukupno za ceo posao ili po osobi?', 'need.schedule_kind': 'Kada treba da se uradi?',
    'need.starts_at': 'Kog datuma i u koliko sati posao počinje?', 'need.ends_at': 'Kada se posao završava?',
    'need.task_country_code': 'U kojoj državi je zadatak?', 'need.task_geography': 'Gde treba da se uradi?',
  };
  const incompleteMessage = () => {
    const key = missing.find(key => questions[key]);
    return key ? questions[key] : 'Pregled još nije dovršen. Možeš da dopuniš opis zadatka ili otvoriš pregled.';
  };
  let assistantMessage = turn.assistantMessage;
  if (dialogue?.next === 'ASK') {
    // A missing field may be partly explained in the conversation. Preserve the
    // specific clarification (e.g. pickup city) instead of erasing it with a generic
    // location question. Retarget only when the requested field is already known.
    if (!missing.includes(dialogue.questionKey)) {
      assistantMessage = missing.length ? incompleteMessage() : 'Otvori pregled zadatka. Tamo proveri podatke pre objave.';
    }
  } else if (dialogue?.next === 'REVIEW') assistantMessage = missing.length ? incompleteMessage() : 'Otvori pregled zadatka. Tamo proveri podatke pre objave.';
  else if (dialogue?.next === 'ACK') assistantMessage = proposals.length ? 'Podaci su ažurirani u pregledu.' : 'Možeš da otvoriš pregled ili dopuniš zadatak.';
  return { ...turn, proposals, assistantMessage };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response(405, { code: 'METHOD_NOT_ALLOWED', message: 'Koristite POST.' });
  const authorization = req.headers.get('Authorization') ?? '';
  if (!/^Bearer [^\s]+$/.test(authorization)) return response(401, { code: 'AUTH_REQUIRED', message: 'Prijavite se da biste nastavili.' });
  let body: any;
  try { body = (await boundedJson(req, {}, 18000, 3000, req.signal)).data; }
  catch { return response(400, { code: 'INVALID_JSON', message: 'Zahtev nije ispravan.' }); }
  if (!object(body) || Object.keys(body).some(key => !['conversationId', 'text', 'clientRequestId', 'mode', 'locationContext'].includes(key)))
    return response(400, { code: 'REQUEST_INVALID', message: 'Zahtev nije ispravan.' });
  const locationMode = body.mode === 'locationReply';
  const locationContext: LocationContext | undefined = locationMode && validLocationContext(body.locationContext) ? body.locationContext : undefined;
  if (locationMode && (!locationContext || !exact(body, ['mode', 'conversationId', 'text', 'clientRequestId', 'locationContext']))
    || !locationMode && (Object.hasOwn(body, 'mode') || Object.hasOwn(body, 'locationContext')))
    return response(400, { code: 'LOCATION_CONTEXT_INVALID', message: 'Ponovo otvori prikaz mesta.' });
  if (locationMode && req.headers.get('Accept')?.split(',').some(value => value.trim() === 'text/event-stream'))
    return response(406, { code: 'LOCATION_STREAM_UNSUPPORTED', message: 'Odgovor o mestu koristi potvrđen pojedinačni odgovor.' });
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim().toLowerCase() : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!isUuid(conversationId)) return response(400, { code: 'CONVERSATION_ID_INVALID', message: 'Nacrt Zadatka nije ispravan.' });
  if (!text || text.length > 4000) return response(400, { code: 'MESSAGE_INVALID', message: 'Unesite poruku do 4.000 znakova.' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return response(500, { code: 'SERVER_CONFIG_ERROR', message: 'Serverska konfiguracija nije dostupna.' });
  let accountId: string;
  try {
    // Actual Auth user verification; neither body IDs nor editable JWT metadata
    // are accepted as the account identity used by the service-only completion.
    const verified = await boundedJson(supabaseUrl + '/auth/v1/user', {
      headers: { apikey: anonKey, Authorization: authorization },
    }, 65536, 5000, req.signal, true);
    if (!verified.ok || !isUuid(verified.data?.id)) return response(401, { code: 'AUTH_REQUIRED', message: 'Prijavite se da biste nastavili.' });
    accountId = verified.data.id.toLowerCase();
  } catch { return response(401, { code: 'AUTH_REQUIRED', message: 'Nalog nije mogao da se proveri.' }); }
  const release = admitUser(accountId);
  if (!release) return response(429, { code: 'AI_RATE_LIMITED', message: 'Sačekajte trenutak pre sledeće poruke.' });
  const availabilityDiagnostics = req.headers.get(AI_DIAGNOSTICS_HEADER) === AI_DIAGNOSTICS_VERSION;
  const wantsStream = req.headers.get('Accept')?.split(',').some(value => value.trim() === 'text/event-stream') === true;
  let detachedRelease = false;
  let requestId = '', attemptId: string | null = null, claimedTurnId: string | null = null;
  let retirementStarted = false;
  let serviceRoleKey = '';
  const rpc = (name: string, args: Record<string, unknown>, signal?: AbortSignal, timeout = 8000) => boundedJson(supabaseUrl + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: { apikey: serviceRoleKey, Authorization: 'Bearer ' + serviceRoleKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  }, 524288, timeout, signal);
  const identityArgs = () => ({ p_account_id: accountId, p_conversation_id: conversationId, p_client_request_id: requestId });
  const retireAttempt = async () => {
    if (!attemptId || retirementStarted) return;
    retirementStarted = true;
    try {
      // Independent bounded metadata settlement. PKG-039 SQL only ends the same
      // PROCESSING attempt; SUCCEEDED/cancelled are preserved, dispatch never reset.
      await rpc('rpc_ai_fail_need_turn_v2_service', { ...identityArgs(), p_attempt_id: attemptId }, undefined, 5000);
    } catch { /* Durable sweep remains the fallback; no inference retry/refund. */ }
  };
  try {
    const conversationQuery = await boundedJson(supabaseUrl + '/rest/v1/ai_conversations?id=eq.' + encodeURIComponent(conversationId) +
      '&purpose=eq.NEED_INTAKE&select=id,account_id,fact_schema_version,status&limit=1', {
      headers: { apikey: anonKey, Authorization: authorization },
    }, 8192, 8000, req.signal);
    if (!conversationQuery.ok) return response(502, { code: 'CONVERSATION_READ_FAILED', message: 'Nacrt nije mogao da se proveri.' });
    const rows = conversationQuery.data;
    if (!Array.isArray(rows) || rows.length !== 1 || !sameUuid(rows[0]?.id, conversationId) || !sameUuid(rows[0]?.account_id, accountId))
      return response(404, { code: 'CONVERSATION_NOT_FOUND', message: 'Nacrt nije dostupan ovom nalogu.' });
    const schemaVersion: FactSchemaVersion = rows[0].fact_schema_version === NEED_FACT_SCHEMA_V2 ? NEED_FACT_SCHEMA_V2 : LEGACY_FACT_SCHEMA_V1;
    if (schemaVersion === NEED_FACT_SCHEMA_V2) {
      if (!(locationMode ? exact(body, ['mode', 'conversationId', 'text', 'clientRequestId', 'locationContext']) : exact(body, ['conversationId', 'text', 'clientRequestId'])) || !isUuid(body.clientRequestId))
        return response(400, { code: 'CLIENT_REQUEST_ID_INVALID', message: 'Ponovo otvorite unos pre slanja.' });
      requestId = body.clientRequestId.toLowerCase();
    } else if (!exact(body, ['conversationId', 'text']) || rows[0].status !== 'OPEN') {
      return response(409, { code: 'CONVERSATION_NOT_OPEN', message: 'Ovaj razgovor više nije otvoren.' });
    }
    serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!serviceRoleKey) return response(500, { code: 'SERVER_CONFIG_ERROR', message: 'Serverska konfiguracija nije dostupna.' });
    let history: any[], activeFacts: any[];
    if (schemaVersion === NEED_FACT_SCHEMA_V2) {
      const result = await rpc(locationMode ? 'rpc_ai_claim_need_location_turn_v1_service' : 'rpc_ai_claim_need_turn_v2_service',
        { ...identityArgs(), p_user_message: text, ...(locationContext ? { p_location_context: locationContext } : {}) }, req.signal);
      if (!result.ok) {
        const name = result.data?.message;
        if (name === 'LOCATION_VERSION_CONFLICT' || name === 'LOCATION_CONTEXT_INVALID')
          return response(409, { code: name, message: 'Mesto je promenjeno. Pogledaj trenutni predlog pre odgovora.' });
        if (name === 'AI_RATE_LIMITED') return response(429, { code: 'AI_RATE_LIMITED', message: 'Sačekajte trenutak pre sledeće poruke.' });
        if (name === 'AI_REQUEST_ID_REUSED') return response(409, { code: 'AI_REQUEST_ID_REUSED', message: 'Ovaj pokušaj pripada drugoj poruci. Proverite razgovor.' });
        return response(502, { code: 'AI_TURN_NOT_CONFIRMED', message: 'Proverite ishod poruke pre nastavka.' });
      }
      const value = result.data;
      if (!exact(value, ['turn', 'claim']) || !validTurn(value.turn, conversationId, requestId)) throw new Error('AI_CLAIM_INVALID');
      if (value.claim === null) {
        if (!locationContext) return turnResponse(value.turn);
        const read = await rpc('rpc_ai_read_need_location_turn_v1_service', identityArgs(), req.signal);
        if (!read.ok || !validLocationEnvelope(read.data, locationContext, turn => validTurn(turn, conversationId, requestId))) throw new Error('AI_TURN_RECEIPT_INVALID');
        return response(read.data.turn.state === 'SUCCEEDED' ? 200 : read.data.turn.state === 'PROCESSING' ? 202 : 409, read.data);
      }
      const claim = value.claim;
      if (value.turn.state !== 'PROCESSING' || !exact(claim, ['attemptId', 'leaseExpiresAt', 'context']) || !isUuid(claim.attemptId) ||
        typeof claim.leaseExpiresAt !== 'string' || !Number.isFinite(Date.parse(claim.leaseExpiresAt)) || Date.parse(claim.leaseExpiresAt) <= Date.now())
        throw new Error('AI_CLAIM_INVALID');
      attemptId = claim.attemptId; claimedTurnId = value.turn.turnId;
      if (!validClaimContext(claim.context)) throw new Error('AI_CONTEXT_INVALID');
      history = claim.context.history; activeFacts = claim.context.activeFacts;
    } else {
      const headers = { apikey: anonKey, Authorization: authorization };
      const [messages, facts] = await Promise.all([
        boundedJson(supabaseUrl + '/rest/v1/ai_messages?conversation_id=eq.' + encodeURIComponent(conversationId) +
          '&select=role,body,sequence_no&order=sequence_no.desc&limit=40', { headers }, 262144, 8000, req.signal),
        boundedJson(supabaseUrl + '/rest/v1/ai_structured_facts?conversation_id=eq.' + encodeURIComponent(conversationId) +
          '&fact_key=in.(' + encodeURIComponent(AI_CONTEXT_FACT_KEYS.map(key => JSON.stringify(key)).join(',')) +
          ')&superseded_at=is.null&select=fact_key,fact_value,value_type,display_value,fact_schema_version,status,source,created_at&order=created_at.asc', { headers }, 262144, 8000, req.signal),
      ]);
      if (!messages.ok || !facts.ok || !Array.isArray(messages.data) || !Array.isArray(facts.data)) throw new Error('AI_CONTEXT_INVALID');
      history = [...messages.data].reverse(); activeFacts = facts.data;
    }
    const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? '', geminiModel = Deno.env.get('GEMINI_MODEL') ?? '';
    const provider = Deno.env.get('AI_PROVIDER') ?? '';
    const timeContext = serverTimeContext(new Date());
    const execute = async (onText?: (delta: string) => void, signal: AbortSignal = req.signal) => {
    let aiTurn: ParsedTurn;
    // Counts the provider reports for this call. Recorded only after the turn is
    // confirmed, so accounting can never decide whether an answer is delivered.
    let reportedUsage: GeminiUsage | null = null;
    try {
      if (wantsStream && (schemaVersion !== NEED_FACT_SCHEMA_V2 || provider !== 'gemini' || geminiModel !== 'gemini-3.8-flash')) {
        await retireAttempt();
        return response(503, { code: 'AI_STREAM_NOT_CONFIGURED', message: 'Razgovor uživo još nije podešen.' });
      }
      // Every new inference uses the approved provider and shared reservation,
      // regardless of Accept or historical optional environment flags. Legacy
      // conversations retain their history/manual writers, but have no durable
      // V2 operation identity with which to authorize a new paid attempt.
      if (schemaVersion !== NEED_FACT_SCHEMA_V2 || provider !== 'gemini' || geminiModel !== 'gemini-3.8-flash'
        || !geminiKey || Deno.env.get('USKOCI_GEMINI_PAID_TEST_ENABLED') !== 'true') {
        await retireAttempt();
        return response(503, { code: 'AI_PROVIDER_NOT_CONFIGURED', message: 'AI obrada još nije aktivirana na serveru.' });
      }
      const budget = await reserveAiTestBudget({ supabaseUrl, serviceRoleKey, accountId, operationId: requestId, kind: 'LLM', signal });
      if (!budget.admitted || budget.replay) {
        await retireAttempt();
        return response(503, { code: budget.code, message: 'Probni AI zahtev nije odobren. Proverite prethodni ishod ili test limit.' });
      }
      if (schemaVersion === NEED_FACT_SCHEMA_V2) {
        // Persist dispatch intent before any provider I/O. Lost ACK, timeout or
        // response parsing failure cannot authorize another billable attempt.
        const dispatched = await rpc('rpc_ai_dispatch_need_turn_v2_service', { ...identityArgs(), p_attempt_id: attemptId }, signal);
        if (!dispatched.ok || dispatched.data !== true) {
          await retireAttempt();
          return response(409, { code: 'AI_TURN_NOT_CONFIRMED', message: 'Proverite ishod poruke pre nastavka.' });
        }
      }
      aiTurn = await callGemini(geminiKey, geminiModel, schemaVersion, history, activeFacts, text, timeContext, signal, onText,
        (usage) => { reportedUsage = usage; }, locationContext);
      aiTurn = guardConversationTurn(aiTurn, text, activeFacts, timeContext, !!locationContext);
      if (locationContext) {
        // A validated answer to the shown question (e.g. 'to je to') stays a map
        // confirmation. Explicit task publication can never take that route.
        if (explicitPublicationOnly(text) || taskFinishOnly(text) && aiTurn.locationAction !== 'CONFIRM_DISPLAYED') aiTurn.locationAction = 'CONTINUE';
        else if (!aiTurn.locationAction || aiTurn.safety !== 'ALLOW') aiTurn.locationAction = 'CLARIFY';
      }
    } catch (providerError) {
      // On 2026-09-18 this line was the only trace of two failures that left the person staring at
      // "AI jos obradjuje poruku" for over two hours, and it did not say which failure it was. It
      // says which class of failure it was, from a closed list, and nothing of what was thrown.
      console.error('AI_PROVIDER_FAILED', providerFailureClass(providerError));
      await retireAttempt();
      if (availabilityDiagnostics && providerError instanceof GeminiCreditsUnavailableError) return response(503, { code: AI_CREDITS_UNAVAILABLE });
      return response(502, { code: 'AI_PROVIDER_FAILED', message: 'AI obrada trenutno nije uspela. Proverite ishod pre nastavka.' });
    }
    if (signal.aborted) throw new Error('AI_REQUEST_CANCELLED');
    if (schemaVersion === NEED_FACT_SCHEMA_V2) {
      const result = await rpc(locationContext ? 'rpc_ai_complete_need_location_turn_v1_service' : 'rpc_ai_complete_need_turn_v2_service', { ...identityArgs(), p_attempt_id: attemptId,
        p_user_message: text, p_assistant_message: aiTurn.assistantMessage, p_safety: aiTurn.safety, p_proposals: aiTurn.proposals,
        ...(locationContext ? { p_location_context: locationContext, p_location_action: aiTurn.locationAction } : {}) }, signal);
      const completed = locationContext ? result.data?.turn : result.data;
      if (!result.ok || !validTurn(completed, conversationId, requestId) || completed.turnId !== claimedTurnId
        || locationContext && !validLocationEnvelope(result.data, locationContext, turn => validTurn(turn, conversationId, requestId)))
        throw new Error('AI_TURN_RECEIPT_INVALID');
      if (completed.state === 'SUCCEEDED' && (completed.receipt.proposedCount !== aiTurn.proposals.length || completed.receipt.safety !== aiTurn.safety))
        throw new Error('AI_TURN_RECEIPT_INVALID');
      if (locationContext && completed.state === 'SUCCEEDED' && result.data.location.action !== aiTurn.locationAction) throw new Error('AI_TURN_RECEIPT_INVALID');
      // No raw provider prose escapes before the semantic check and the exact
      // owned completion receipt. The existing stream still reports acceptance.
      if (completed.state === 'SUCCEEDED') onText?.(aiTurn.assistantMessage);
      if (reportedUsage) {
        try {
          await rpc('rpc_ai_test_record_usage_service', { p_operation_id: requestId, p_model: geminiModel,
            p_prompt_tokens: reportedUsage.promptTokens, p_output_tokens: reportedUsage.outputTokens,
            p_total_tokens: reportedUsage.totalTokens }, signal);
        } catch { /* accounting never breaks delivery */ }
      }
      return locationContext ? response(completed.state === 'SUCCEEDED' ? 200 : completed.state === 'PROCESSING' ? 202 : 409, result.data) : turnResponse(completed);
    }
    // Existing LEGACY_TEXT_V1 path remains isolated. V2 never calls this writer.
    const result = await rpc('rpc_ai_apply_legacy_need_turn_service', { p_account_id: accountId, p_conversation_id: conversationId,
      p_user_message: text, p_assistant_message: aiTurn.assistantMessage, p_safety: aiTurn.safety, p_proposals: aiTurn.proposals }, signal);
    if (!result.ok) throw new Error('AI_LEGACY_PERSIST_FAILED');
    const proposedCount = Number(result.data?.proposedCount ?? result.data?.proposed_count ?? aiTurn.proposals.length);
    return response(200, { predlozeno: Number.isFinite(proposedCount) ? Math.max(0, Math.trunc(proposedCount)) : aiTurn.proposals.length,
      assistantMessage: aiTurn.assistantMessage, safety: aiTurn.safety, blocked: aiTurn.safety === 'BLOCK', schemaVersion, provider });
    };
    if (!wantsStream) return await execute();
    detachedRelease = true;
    const abort = new AbortController(), abortFromRequest = () => abort.abort();
    req.signal.addEventListener('abort', abortFromRequest, { once: true });
    if (req.signal.aborted) abort.abort();
    let closed = false;
    const stream = new ReadableStream({
      async start(controller) {
        let sequence = 0;
        const emit = (event: Record<string, unknown>) => {
          if (closed || abort.signal.aborted) return;
          controller.enqueue(new TextEncoder().encode('data: ' + JSON.stringify({
            conversationId, clientRequestId: requestId, turnId: claimedTurnId, attemptId, sequence: ++sequence, ...event,
          }) + '\n\n'));
        };
        emit({ kind: 'accepted' });
        try {
          const result = await execute(text => emit({ kind: 'text_delta', text }), abort.signal);
          const data = await result.json();
          if (result.ok && validTurn(data, conversationId, requestId) && data.state === 'SUCCEEDED') emit({ kind: 'final', turn: data });
          else emit({ kind: 'safe_error', code: availabilityDiagnostics && result.status === 503 && data?.code === AI_CREDITS_UNAVAILABLE ? AI_CREDITS_UNAVAILABLE : 'AI_TURN_NOT_CONFIRMED' });
        } catch {
          await retireAttempt();
          emit({ kind: 'safe_error', code: 'AI_TURN_NOT_CONFIRMED' });
        } finally {
          if (!closed) { closed = true; controller.close(); }
          abort.abort(); req.signal.removeEventListener('abort', abortFromRequest); release();
        }
      },
      cancel() { closed = true; abort.abort(); },
    });
    return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
  } catch {
    await retireAttempt();
    return response(502, { code: 'AI_TURN_NOT_CONFIRMED', message: 'Potvrda nije stigla. Proverite ishod poruke pre nastavka.' });
  } finally { if (!detachedRelease) release(); }
});
