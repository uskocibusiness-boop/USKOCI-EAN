// DISCOVERY-GRAD disposable runtime proof: real Auth, real PostgREST, real database; loopback only (never DEV).
// BEFORE (the DEV body = DISCOVERY-ZAMENE postimage): the place filter compares only the whole place text and words depend on
// Serbian letters -> drift and order refusals leave nothing behind -> APPLY -> AFTER: city-aware place filter, Serbian fold for words
// and places, requests without the new key byte-identical, filterKeys unchanged -> exact REVERT -> the BEFORE answers again, byte for byte.
// Tasks are direct-insert fixtures under the publish token, labelled "DG <tag>" (the text and place readers only read rows).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {createFixtures} from '../ex06/lib/fixtures.mjs';

const {assert, sql, rows, q, randomUUID, ok, env} = rt;
const DB = env.DB_URL;
assert.equal(DB, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const G = 'supabase/candidates/discovery-grad-20261008/';
const manifest = JSON.parse(fs.readFileSync(G + 'manifest.json', 'utf8'));
const READER = manifest.functions[0].signature, FOLD = manifest.newFunctions[0].signature;
const out = env.DISCOVERY_GRAD_ARTIFACT_DIR;
assert.ok(out);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = {unit: 'DISCOVERY-GRAD', result: 'RUNNING', sourceSha: env.GITHUB_SHA, disposableOnly: true, actualAuth: true, actualPostgrest: true,
  actualDatabase: true, liveAccess: false, providerCalls: 0, pushSends: 0, checks: [], observations: {}};
const write = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const pass = (name, detail) => { report.checks.push({name, result: 'PASS', ...(detail === undefined ? {} : {detail})}); write(); console.log('PASS ' + name); };
const psqlFile = file => execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', file], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000});
const psqlText = text => execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At'], {input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 180000}).trim();
function refused(text, expected) {
  let error;
  try { execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1'], {input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 180000}); }
  catch (e) { error = e; }
  assert.ok(error, 'NOT_REFUSED:' + expected);
  assert.ok(String(error.stderr).includes(expected), 'WRONG_REFUSAL ' + expected + ': ' + String(error.stderr).slice(-700));
}
const replaceFirst = (text, from, to) => { const at = text.indexOf(from); assert.ok(at >= 0, 'NO_ANCHOR:' + from); return text.slice(0, at) + to + text.slice(at + from.length); };
const catalog = () => sql(`select md5(string_agg(p.oid::regprocedure::text||':'||md5(p.prosrc)||':'||((to_jsonb(p)-'prosrc'-'oid')::text)||':'||coalesce(obj_description(p.oid,'pg_proc'),''),E'\\n' order by p.oid::regprocedure::text))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')`);
const closure = () => rows(`select private.closure_source_digest_v5() as digest,private.closure_erasure_program_digest_v5() as program,
  (select sha256 from private.closure_source_v5 where singleton) as certificate,(select sha256 from private.closure_erasure_source_v5 where singleton) as erasure,
  private.retention_ai_source_ready() as ready`)[0];
const conflicts40001 = () => Number(sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc like '%400' || '01%'`));
const bodyMd5 = signature => sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(signature)})`);

const fx = createFixtures(rt, {needPath: 'direct'});
const FILTER = {text: '', price: 'all', where: 'any', places: 1, when: 'any', dates: null, place: null};
const SLOTS = 8;                                  // every DG task has 8 open places: "places: 8" isolates them from the chain's own tasks
const ISO = {...FILTER, places: SLOTS};
const WIDE = [18, 42, 23, 47];
const P = {NS: {lat: 45.27, lng: 19.83}, NS2: {lat: 45.26, lng: 19.81}, NS3: {lat: 45.24, lng: 19.84}, PV: {lat: 45.25, lng: 19.87}, CA: {lat: 43.89, lng: 20.35},
  BG: {lat: 44.82, lng: 20.46}, BG2: {lat: 44.80, lng: 20.48}, NI: {lat: 43.32, lng: 21.90}, NOWHERE: {lat: 44.50, lng: 20.50}};
async function withRetry(make) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    last = await make();
    if (!(last?.error && /fetch failed/i.test(String(last.error.message ?? last.error)))) return last;
    await sleep(2500);
  }
  return last;
}
let V;                                            // the viewer: a TEST-world account with an ACTIVE worker profile (needed by forMe)
const disc = request => withRetry(() => V.client.rpc('rpc_discovery_v1', {p_request: request}));
const strip = response => { const copy = structuredClone(response); delete copy.asOf; if (copy.counts) delete copy.counts.observedAt; return copy; };
const page = (filter, scope = {kind: 'ALL'}, anchor = null) => ({mode: 'PAGE', filter, anchor, scope, limit: 100, after: null});
const map = (filter, anchor = null) => ({mode: 'MAP', filter, anchor, bounds: WIDE, grid: 12});
const places = (filter, prefix = '', extra = {}, anchor = null) => ({mode: 'PLACES', filter, anchor, prefix, facetArea: null, limit: 30, after: null, ...extra});

// ---------------------------------------------------------------- the tasks
const tag = randomUUID().slice(0, 6);
const T = {};
let R;
const textList = list => `array[${list.map(item => q(item)).join(',')}]::text[]`;
// The labelled direct insert of supabase/proofs/ex06/lib/fixtures.mjs directPath (both lifecycle tokens), with the place columns written as given:
// any area / city text (also empty, quoted or Cyrillic) and a coarse point or none. No public.need_geography row (Discovery reads it only for
// the publicTopology field, which is then null for these rows before and after).
function task(key, {title, city = '', area = '', point = null, mode = 'STATIONARY', skills = [], kind = 'FLEXIBLE'}) {
  const id = randomUUID();
  sql(`begin; select set_config('uskoci.need_lifecycle','PUBLISH',true); select set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
    insert into public.needs(id, requester_account_id, requester_profile_id, status, title, description, category, required_skills, required_tools, required_vehicles,
      required_licenses, minimum_experience_years, verified_identity_required, approximate_city, approximate_area, approximate_lat, approximate_lng, mode, required_slots,
      schedule_kind, execution_location_mode, task_country_code, task_timezone, response_deadline, published_at)
    values (${q(id)}::uuid, ${q(R.id)}::uuid, ${q(R.profileId)}::uuid, 'PUBLISHED', ${q(`DG ${tag} ${title}`)}, 'Sinteticki zadatak DISCOVERY-GRAD dokaza.', 'DG dokaz',
      ${textList(skills)}, '{}', '{}', '{}', 0, false, ${q(city)}, ${q(area)}, ${point ? point.lat : 'null'}, ${point ? point.lng : 'null'}, 'OFFERS', ${SLOTS},
      ${q(kind)}, ${q(mode)}, 'RS', 'Europe/Belgrade', statement_timestamp() + interval '2 days', clock_timestamp());
    commit;`);
  T[key] = id;
}
const NAME = () => new Map(Object.entries(T).map(([k, id]) => [id, k]));
const names = ids => { const m = NAME(); return ids.filter(id => m.has(id)).map(id => m.get(id)).sort(); };
async function pageAll(filter, scope = {kind: 'ALL'}) {
  let anchor = null, after = null, first = null;
  const items = [];
  for (let i = 0; i < 100; i++) {
    const r = await ok(disc({mode: 'PAGE', filter, anchor, scope, limit: 100, after}));
    first ??= r; anchor = r.anchor; items.push(...r.items);
    if (!r.hasMore) break;
    after = r.nextCursor;
  }
  return {first, items, ids: items.map(item => item.id)};
}
const ours = async (filter, scope) => names((await pageAll(filter, scope)).ids);
const set = (...keys) => keys.sort();

// The text and place cases. Each entry: [label, filter patch, BEFORE set, AFTER set]. BEFORE = the DEV body; AFTER = DISCOVERY-GRAD.
const NS_ALL = set('nsCistim', 'nsGaraza', 'nsLiman', 'nsPetro', 'nsNoPoint', 'nsCyr');
const BG_ALL = set('bgDj', 'bgNoPt', 'bgQuoted');
const CASES = [
  ['text cistim', {text: 'cistim'}, set('nsGaraza'), set('nsCistim', 'nsGaraza')],
  ['text Čistim', {text: 'Čistim'}, set('nsCistim'), set('nsCistim', 'nsGaraza')],
  ['text CISTIM', {text: 'CISTIM'}, set('nsGaraza'), set('nsCistim', 'nsGaraza')],
  ['text čIsTiM', {text: 'čIsTiM'}, set('nsCistim'), set('nsCistim', 'nsGaraza')],
  ['text garazu', {text: 'garazu'}, set(), set('nsGaraza')],
  ['text djordj', {text: 'djordj'}, set('bgNoPt'), set('bgDj', 'bgNoPt')],
  ['text Đorđ', {text: 'Đorđ'}, set('bgDj'), set('bgDj', 'bgNoPt')],
  ['text ĐORĐ', {text: 'ĐORĐ'}, set('bgDj'), set('bgDj', 'bgNoPt')],
  ['text ђорђ (Cyrillic)', {text: 'ђорђ'}, set(), set('bgDj', 'bgNoPt')],
  ['text basti', {text: 'basti'}, set(), set('nsCyr')],
  ['text башти (Cyrillic)', {text: 'башти'}, set('nsCyr'), set('nsCyr')],
  ['text elektricne (a needed skill)', {text: 'elektricne'}, set(), set('elektro')],
  ['text Električne (a needed skill)', {text: 'Električne'}, set('elektro'), set('elektro')],
  ['text novi sad (the place text)', {text: 'novi sad'}, set('nsCistim', 'nsGaraza', 'nsLiman', 'nsPetro', 'nsNoPoint'), NS_ALL],
  ['text beograd (title of a remote task too)', {text: 'beograd'}, set('bgDj', 'bgNoPt', 'bgQuoted', 'remote'), set('bgDj', 'bgNoPt', 'bgQuoted', 'remote')],
  ['place Novi Sad', {place: 'Novi Sad'}, set('nsCistim', 'nsNoPoint'), NS_ALL],
  ['place novi sad', {place: 'novi sad'}, set('nsCistim', 'nsNoPoint'), NS_ALL],
  ['place NOVI  SAD (case, double space)', {place: 'NOVI  SAD'}, set('nsCistim', 'nsNoPoint'), NS_ALL],
  ['place Нови Сад (Cyrillic)', {place: 'Нови Сад'}, set('nsCyr'), NS_ALL],
  ['place Čačak', {place: 'Čačak'}, set('caDia'), set('caDia', 'caAscii')],
  ['place Cacak', {place: 'Cacak'}, set('caAscii'), set('caDia', 'caAscii')],
  ['place ČAČAK', {place: 'ČAČAK'}, set('caDia'), set('caDia', 'caAscii')],
  ['place Beograd', {place: 'Beograd'}, set('bgNoPt'), BG_ALL],
  ['place Београд (Cyrillic)', {place: 'Београд'}, set(), BG_ALL],
  ['place Petrovaradin (a town of its own)', {place: 'Petrovaradin'}, set('pvTown'), set('pvTown')],
  ['place Detelinara, Novi Sad (a whole place text)', {place: 'Detelinara, Novi Sad'}, set('nsGaraza'), set('nsGaraza')],
  ['place detelinara,  NOVI sad', {place: 'detelinara,  NOVI sad'}, set('nsGaraza'), set('nsGaraza')],
  ['place Vracar, Beograd (quoted area, no city)', {place: 'Vracar, Beograd'}, set(), set('bgQuoted')],
  ['place Nis', {place: 'Nis'}, set(), set('elektro')],
  ['place Lokacija nije navedena (never a place)', {place: 'Lokacija nije navedena'}, set(), set()],
  ['place Na daljinu (never a place)', {place: 'Na daljinu'}, set(), set()],
  ['place Beograd + where remote (place ignored, as before)', {place: 'Beograd', where: 'remote'}, set('remote'), set('remote')],
  ['place Beograd + where onsite', {place: 'Beograd', where: 'onsite'}, set('bgNoPt'), BG_ALL],
  ['place Novi Sad + text cistim', {place: 'Novi Sad', text: 'cistim'}, set(), set('nsCistim', 'nsGaraza')],
];
async function runCases(phase) {
  const got = {};
  for (const [label, patch, before, after] of CASES) {
    const found = await ours({...ISO, ...patch});
    got[label] = found;
    assert.deepEqual(found, phase === 'AFTER' ? after : before, `${phase} ${label}: ${JSON.stringify(found)}`);
  }
  report.observations['cases' + phase] = got; write();
  return got;
}

// ---------------------------------------------------------------- PLACES helpers
const keyOf = text => sql(`select public.p6_discovery_key(${q(text)})`);
function decoderInvariants(response, label) {
  // the client decoder (src/data/discoveryV1SpatialContract.ts): exact item shape, key = placeKey(text), unique keys, order, sum <= everywhere
  const keys = new Set();
  let previous = null, sum = 0;
  for (const item of response.items) {
    assert.deepEqual(Object.keys(item).sort(), ['count', 'key', 'text'], label + ' ITEM_SHAPE');
    assert.equal(item.key, keyOf(item.text), label + ' KEY_IS_P6_KEY_OF_TEXT ' + item.text);
    assert.ok(!keys.has(item.key), label + ' DUPLICATE_KEY ' + item.key); keys.add(item.key);
    if (previous) assert.ok(item.count < previous.count || item.count === previous.count && sql(`select ${q(previous.text)} collate "sr-Latn-RS-x-icu" <= ${q(item.text)} collate "sr-Latn-RS-x-icu"`) === 't', label + ' ORDER');
    previous = item; sum += Number(item.count);
  }
  assert.ok(sum <= Number(response.counts.everywhere), label + ' SUM_OVER_EVERYWHERE');
  assert.deepEqual(Object.keys(response).sort(), ['anchor', 'asOf', 'counts', 'filterKey', 'hasMore', 'items', 'mode', 'nextCursor', 'version'], label + ' SHAPE');
}
const rowsOf = response => Object.fromEntries(response.items.map(item => [item.text, Number(item.count)]));

try {
  const paused = fx.pauseSchedulers();
  report.observations.schedulers = paused;
  assert.equal(bodyMd5(READER), manifest.functions[0].before_md5, 'READER_IS_NOT_THE_DEV_BODY');
  for (const pin of manifest.dependencyPins) assert.equal(bodyMd5(pin.signature), pin.body_md5, 'DEPENDENCY:' + pin.signature);
  assert.equal(sql(`select to_regprocedure(${q(FOLD)}) is null`), 't');
  const baseCatalog = catalog(), baseClosure = closure(), base40001 = conflicts40001();
  assert.equal(baseClosure.ready, true);
  report.observations.chain = fx.chainCounts();
  pass('DISCOVERY_GRAD_PREDECESSOR_IS_THE_DEV_READER_AND_CERTIFICATE_READY', {reader: manifest.functions[0].before_md5, certificate: baseClosure.certificate});

  R = await fx.createRequester({label: 'dg-requester', world: 'TEST'});
  const skillV = `dg-${tag}-ciscenje`;
  V = await fx.createWorker({label: 'dg-viewer', world: 'TEST', skills: [skillV], radiusKm: 15, location: {city: 'Novi Sad'},
    availability: {timezone: 'Europe/Belgrade', availableNow: true, rules: [], windows: []}});
  // group 1: no two place texts differ only by Serbian letters or case
  task('nsCistim', {title: 'Čistim stan posle selidbe', city: 'Novi Sad', point: P.NS, skills: [skillV]});
  task('nsGaraza', {title: 'cistim garažu', city: 'Novi Sad', area: 'Detelinara', point: P.NS2, skills: [skillV]});
  task('nsLiman', {title: 'Farbanje stana', city: 'Novi Sad', area: 'Liman', point: P.NS3});
  task('nsPetro', {title: 'Prozori', city: 'Novi Sad', area: 'Petrovaradin', point: P.PV});
  task('pvTown', {title: 'Ograda', city: 'Petrovaradin', area: 'Petrovaradin', point: P.PV});
  task('nsNoPoint', {title: 'Montaža police', city: 'Novi Sad'});
  task('caDia', {title: 'Košenje trave', city: 'Čačak', point: P.CA});
  task('bgDj', {title: 'Pomoć za Đorđa', city: 'Beograd', area: 'Centar', point: P.BG});
  task('bgNoPt', {title: 'Posao kod Djordja', city: 'Beograd'});
  task('bgQuoted', {title: 'Vrt na Vračaru', area: '"Vračar, Beograd"', city: '', point: P.BG2});
  task('remote', {title: 'Prevod teksta za Beograd', mode: 'REMOTE', kind: 'REMOTE_ANYTIME', skills: ['prevođenje']});
  task('noPlace', {title: 'Nepoznato mesto', point: P.NOWHERE});
  task('elektro', {title: 'Instalacije', city: 'Niš', point: P.NI, skills: ['Električne instalacije']});
  fx.retireFixtures({needs: Object.values(T)});
  await fx.reloadSchema();
  // S1: requests WITHOUT a new key whose answer must not change, with their anchors (the anchor fixes the moment: tasks published
  // later are outside it, so the replays after the apply read exactly these rows)
  const s1Requests = {
    pageDefault: page(FILTER), pageIso: page(ISO), mapDefault: map(FILTER), mapIso: map(ISO), placesDefault: places(FILTER), placesIso: places(ISO),
    placesIsoPrefixNov: places(ISO, 'nov'), placesIsoPrefixBeo: places(ISO, 'Beo'), pageTextFarbanje: page({...ISO, text: 'farbanje'}),
    pageTextBeograd: page({...ISO, text: 'beograd'}), pagePlaceDetelinara: page({...ISO, place: 'Detelinara, Novi Sad'}),
    pagePlacePetrovaradin: page({...ISO, place: 'Petrovaradin'}), pageForMe: page({...FILTER, forMe: true}),
    pageAreaBeograd: page(ISO, {kind: 'AREA', bounds: [20.3, 44.7, 20.6, 44.9]}), pagePointNoviSad: page(ISO, {kind: 'POINT_MEMBERS', point: P.NS}),
    pageWhenToday: page({...ISO, when: 'today'}), pagePlacesTwo: page({...FILTER, places: 2}),
  };
  const s1 = {};
  for (const [k, request] of Object.entries(s1Requests)) s1[k] = await ok(disc(request));
  const exactBefore = await ok(disc({mode: 'EXACT_PUBLIC', needId: T.nsCistim}));
  // group 2: the spellings that differ only by Serbian letters or script ("Cacak" next to "Čačak", Cyrillic "Нови Сад" next to "Novi Sad")
  task('caAscii', {title: 'Selidba kancelarije', city: 'Cacak', point: P.CA});
  task('nsCyr', {title: 'Помоћ у башти', city: 'Нови Сад', point: P.NS});
  fx.retireFixtures({needs: [T.caAscii, T.nsCyr]});
  const isoRaw = await pageAll(ISO), isoAll = names(isoRaw.ids);
  assert.deepEqual(isoAll, Object.keys(T).sort(), 'ISO_FILTER_MUST_LIST_EVERY_DG_TASK:' + JSON.stringify(isoAll));
  assert.equal(isoRaw.ids.length, Object.keys(T).length, 'ISO_FILTER_MUST_LIST_ONLY_DG_TASKS');
  report.observations.tasks = {tag, count: Object.keys(T).length, ids: T};
  pass('DISCOVERY_GRAD_FIXTURES_ISOLATED_BY_PLACES_8', {tasks: isoAll.length});

  // ---------------------------------------------------------------- BEFORE (the DEV body): fails the owner's cases
  const before = await runCases('BEFORE');
  pass('DISCOVERY_GRAD_BEFORE_PLACE_IS_ONLY_THE_WHOLE_PLACE_TEXT_AND_WORDS_DEPEND_ON_SERBIAN_LETTERS', {
    placeNoviSad: before['place Novi Sad'], textCistim: before['text cistim'], placeCacak: before['place Cacak'], textDjordj: before['text djordj']});
  const placesBefore = await ok(disc(places(ISO)));
  decoderInvariants(placesBefore, 'BEFORE_PLACES');
  const rowsBefore = rowsOf(placesBefore);
  assert.equal(rowsBefore['Čačak'], 1); assert.equal(rowsBefore['Cacak'], 1); assert.equal(rowsBefore['Novi Sad'], 2); assert.equal(rowsBefore['Нови Сад'], 1);
  const prefixCacBefore = (await ok(disc(places(ISO, 'cac')))).items.map(i => i.text);
  const prefixCyrBefore = (await ok(disc(places(ISO, 'ЧАЧ')))).items.map(i => i.text);
  assert.deepEqual(prefixCacBefore, ['Cacak']); assert.deepEqual(prefixCyrBefore, []);
  const cityBefore = await disc(places(ISO, '', {groupBy: 'CITY'}));
  assert.equal(cityBefore.error?.message, 'P6_INVALID_REQUEST');
  report.observations.placesBefore = {rows: rowsBefore, prefixCac: prefixCacBefore, prefixCyrillic: prefixCyrBefore};
  pass('DISCOVERY_GRAD_BEFORE_PLACES_SPLITS_SPELLINGS_PREFIX_NEEDS_THE_LETTERS_GROUPBY_UNKNOWN', report.observations.placesBefore);
  // the BEFORE answers, kept with their anchors: the exact revert must give them back byte for byte
  const beforeRequests = {placeNoviSad: page({...ISO, place: 'Novi Sad'}), textCistim: page({...ISO, text: 'cistim'}), placesIso: places(ISO),
    placesCac: places(ISO, 'cac'), mapPlaceNoviSad: map({...ISO, place: 'Novi Sad'}), forMeText: page({...FILTER, forMe: true, text: 'cistim'})};
  const beforeAnswers = {};
  for (const [k, request] of Object.entries(beforeRequests)) beforeAnswers[k] = await ok(disc(request));
  const forMeTextBefore = names(beforeAnswers.forMeText.items.map(i => i.id));
  assert.deepEqual(forMeTextBefore, ['nsGaraza']);
  const filterKeysBefore = Object.fromEntries(Object.entries(beforeAnswers).map(([k, v]) => [k, v.filterKey]));

  // ---------------------------------------------------------------- refusals leave nothing behind
  const candidate = fs.readFileSync(G + 'candidate.sql', 'utf8');
  refused(fs.readFileSync(G + 'revert.sql', 'utf8'), 'DISCOVERY_GRAD_REVERT_PREIMAGE_DRIFT');
  refused(replaceFirst(candidate, `'${manifest.functions[0].before_md5}'`, `'${'0'.repeat(32)}'`), 'DISCOVERY_GRAD_PREDECESSOR_DRIFT');
  refused(replaceFirst(candidate, `'${manifest.dependencyPins[0].body_md5}'`, `'${'0'.repeat(32)}'`), 'DISCOVERY_GRAD_DEPENDENCY_DRIFT');
  // the helper is created and the body replaced, then the fold truth table refuses: everything rolls back
  refused(replaceFirst(candidate, ",'cacak'),", ",'xacak'),"), 'DISCOVERY_GRAD_FOLD_TRUTH_TABLE');
  // a payload that is not the generated body is refused before anything is replaced
  refused(replaceFirst(candidate, ' fold_text text; fold_place text;', ' fold_text text;  fold_place text;'), 'DISCOVERY_GRAD_PAYLOAD_DRIFT');
  assert.equal(catalog(), baseCatalog); assert.deepEqual(closure(), baseClosure); assert.equal(sql(`select to_regprocedure(${q(FOLD)}) is null`), 't');
  pass('DISCOVERY_GRAD_DRIFT_ORDER_TRUTH_TABLE_AND_PAYLOAD_REFUSALS_ARE_ATOMIC');
  // the wrapper variant (no begin/commit of its own) inside a transaction that is rolled back: it applies, checks itself, and leaves nothing
  const inTx = psqlText(`begin;\n${fs.readFileSync(G + 'candidate.in-transaction.sql', 'utf8')}\nselect md5(prosrc) from pg_proc where oid=to_regprocedure(${q(READER)});\nrollback;`);
  assert.equal(inTx.split('\n').filter(Boolean).at(-1), manifest.functions[0].after_md5);
  assert.equal(catalog(), baseCatalog);
  pass('DISCOVERY_GRAD_IN_TRANSACTION_VARIANT_APPLIES_INSIDE_A_WRAPPER_AND_ROLLS_BACK_WHOLE');

  // ---------------------------------------------------------------- APPLY
  psqlFile(G + 'candidate.sql');
  assert.equal(bodyMd5(READER), manifest.functions[0].after_md5);
  assert.equal(bodyMd5(FOLD), manifest.newFunctions[0].body_md5);
  assert.equal(sql(`select proacl::text from pg_proc where oid=to_regprocedure(${q(FOLD)})`), manifest.newFunctions[0].acl);
  assert.equal(sql(`select proacl::text from pg_proc where oid=to_regprocedure(${q(READER)})`), manifest.functions[0].acl);
  assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001);
  refused(candidate, 'DISCOVERY_GRAD_ALREADY_OR_PARTIALLY_APPLIED');
  const post = JSON.parse(psqlText(fs.readFileSync(G + 'postflight.readonly.sql', 'utf8')).split('\n').filter(Boolean).at(-1));
  assert.equal(post.readerAfter, true); assert.equal(post.helper, true); assert.equal(post.foldTruthTableMismatches, 0); assert.equal(post.dependencies, true);
  assert.equal(post.certificateReady, true); assert.equal(post.closureDigest, baseClosure.digest); assert.equal(post.retriedLiteralFunctions, base40001);
  await fx.reloadSchema();
  pass('DISCOVERY_GRAD_APPLIED_EXACT_BODIES_CERTIFICATE_UNCHANGED_NO_NEW_RETRIED_LITERAL_POSTFLIGHT_GREEN', {reader: manifest.functions[0].after_md5, helper: manifest.newFunctions[0].body_md5, postflight: post});

  // ---------------------------------------------------------------- AFTER
  for (const [k, request] of Object.entries(s1Requests)) assert.deepEqual(strip(await ok(disc({...request, ...(request.mode === 'EXACT_PUBLIC' ? {} : {anchor: s1[k].anchor})}))), strip(s1[k]), 'S1_CHANGED:' + k);
  assert.deepEqual(strip(await ok(disc({mode: 'EXACT_PUBLIC', needId: T.nsCistim}))), strip(exactBefore));
  pass('DISCOVERY_GRAD_REQUESTS_WITHOUT_THE_NEW_KEY_BYTE_IDENTICAL_WITH_THEIR_ANCHORS', {requests: Object.keys(s1Requests).length + 1});
  for (const [k, request] of Object.entries(beforeRequests)) {
    const now = await ok(disc(request));
    assert.equal(now.filterKey, filterKeysBefore[k], 'FILTER_KEY_CHANGED:' + k);
    // an anchor handed out before the apply is still accepted (same filterKey): no refusal for a person whose session spans the apply
    assert.ok(!(await disc({...request, anchor: beforeAnswers[k].anchor})).error, 'BEFORE_ANCHOR_REFUSED:' + k);
  }
  const explicitArea = await ok(disc(places(ISO, '', {groupBy: 'AREA'})));
  assert.equal(explicitArea.filterKey, filterKeysBefore.placesIso);
  pass('DISCOVERY_GRAD_FILTER_KEYS_AND_ANCHORS_UNCHANGED_GROUPBY_AREA_IS_THE_DEFAULT', filterKeysBefore);

  const after = await runCases('AFTER');
  pass('DISCOVERY_GRAD_AFTER_PLACE_FINDS_THE_CITY_AND_WORDS_IGNORE_SERBIAN_LETTERS_CASE_AND_SCRIPT', {
    placeNoviSad: after['place Novi Sad'], placeBeograd: after['place Beograd'], textCistim: after['text cistim'], textDjordj: after['text djordj'], textBasti: after['text basti']});
  // a task without a point but with a city is found by the place and listed in its own section of an area; a remote task never is
  const area = await ok(disc(page({...ISO, place: 'Beograd'}, {kind: 'AREA', bounds: [20.3, 44.7, 20.6, 44.9]})));
  const sections = Object.fromEntries(area.items.map(i => [NAME().get(i.id), i.pin ? 0 : 1]));
  assert.deepEqual(sections, {bgDj: 0, bgQuoted: 0, bgNoPt: 1});
  assert.deepEqual({listed: Number(area.counts.listed), inArea: Number(area.counts.inArea), withoutPoint: Number(area.counts.withoutPoint), mapped: Number(area.counts.mapped)},
    {listed: 3, inArea: 2, withoutPoint: 1, mapped: 3});
  const mapNs = await ok(disc(map({...ISO, place: 'Novi Sad'})));
  const bucketTasks = mapNs.buckets.reduce((sum, b) => sum + (b.kind === 'TASK' ? 1 : Number(b.taskCount)), 0);
  assert.equal(Number(mapNs.counts.mapped), 6); assert.equal(Number(mapNs.counts.withoutPoint), 1); assert.equal(bucketTasks, 5);
  assert.ok(mapNs.buckets.every(b => b.point.lat >= 45.2 && b.point.lat <= 45.3 && b.point.lng >= 19.8 && b.point.lng <= 19.9), 'MAP_SHOWS_A_POINT_OUTSIDE_NOVI_SAD');
  pass('DISCOVERY_GRAD_TASK_WITHOUT_A_POINT_FOUND_BY_ITS_CITY_IN_ITS_OWN_SECTION_REMOTE_NEVER_A_PLACE_MAP_FOLLOWS', {sections, mapCounts: mapNs.counts, buckets: mapNs.buckets.length});

  // PLACES, AREA (the default): spellings merge into one row; CITY: one row per city, and each row's number is what the place filter lists
  const placesArea = await ok(disc(places(ISO)));
  decoderInvariants(placesArea, 'AFTER_PLACES_AREA');
  const rowsArea = rowsOf(placesArea);
  const caRow = placesArea.items.find(i => ['Čačak', 'Cacak'].includes(i.text)), nsRow = placesArea.items.find(i => ['Novi Sad', 'Нови Сад'].includes(i.text));
  assert.equal(Number(caRow.count), 2); assert.equal(Number(nsRow.count), 3);
  assert.equal(placesArea.items.filter(i => ['Čačak', 'Cacak', 'Novi Sad', 'Нови Сад'].includes(i.text)).length, 2, 'SPELLINGS_NOT_MERGED');
  assert.equal(Object.keys(rowsArea).length, Object.keys(rowsBefore).length - 2);
  assert.equal(placesArea.filterKey, filterKeysBefore.placesIso);
  const placesCity = await ok(disc(places(ISO, '', {groupBy: 'CITY'})));
  decoderInvariants(placesCity, 'AFTER_PLACES_CITY');
  assert.notEqual(placesCity.filterKey, placesArea.filterKey);
  const rowsCity = rowsOf(placesCity);
  const cityCounts = {NoviSad: rowsCity['Novi Sad'] ?? rowsCity['Нови Сад'], Beograd: rowsCity['Beograd'], Cacak: rowsCity['Čačak'] ?? rowsCity['Cacak'], Petrovaradin: rowsCity['Petrovaradin'], Nis: rowsCity['Niš']};
  assert.deepEqual(cityCounts, {NoviSad: 6, Beograd: 3, Cacak: 2, Petrovaradin: 1, Nis: 1});
  assert.equal(placesCity.items.length, 5);
  const consistency = {};
  for (const item of placesCity.items) {
    const listed = Number((await ok(disc(page({...ISO, place: item.text})))).counts.listed);
    consistency[item.text] = {row: Number(item.count), placeFilterLists: listed};
    assert.equal(listed, Number(item.count), 'CITY_ROW_IS_NOT_WHAT_THE_PLACE_FILTER_LISTS:' + item.text);
  }
  for (const item of placesArea.items) {
    const listed = Number((await ok(disc(page({...ISO, place: item.text})))).counts.listed);
    consistency['AREA ' + item.text] = {row: Number(item.count), placeFilterLists: listed};
    assert.ok(listed >= Number(item.count), 'AREA_ROW_MORE_THAN_THE_FILTER:' + item.text);
    if (item.text.includes(',')) assert.equal(listed, Number(item.count), 'WHOLE_PLACE_TEXT_ROW_DIFFERS:' + item.text);
  }
  report.observations.places = {area: rowsArea, city: rowsCity, consistency}; write();
  pass('DISCOVERY_GRAD_PLACES_SPELLINGS_ONE_ROW_CITY_ROWS_EQUAL_THE_PLACE_FILTER_DECODER_INVARIANTS_HOLD', {city: rowsCity});
  const prefix = {};
  for (const [label, p, extra] of [['cac', 'cac', {}], ['ЧАЧ (Cyrillic)', 'ЧАЧ', {}], ['novi', 'novi', {}], ['vrac', 'vrac', {}], ['nov CITY', 'nov', {groupBy: 'CITY'}], ['beo CITY', 'beo', {groupBy: 'CITY'}]]) {
    prefix[label] = (await ok(disc(places(ISO, p, extra)))).items.map(i => `${i.text}:${i.count}`).sort();
  }
  assert.deepEqual(prefix['cac'], [`${caRow.text}:2`]); assert.deepEqual(prefix['ЧАЧ (Cyrillic)'], [`${caRow.text}:2`]);
  assert.deepEqual(prefix['vrac'], ['Vračar, Beograd:1']);
  assert.equal(prefix['novi'].length, 4); assert.ok(prefix['novi'].includes(`${nsRow.text}:3`));
  assert.deepEqual(prefix['nov CITY'].map(x => x.split(':')[1]), ['6']); assert.deepEqual(prefix['beo CITY'], ['Beograd:3']);
  report.observations.placesPrefix = prefix; write();
  pass('DISCOVERY_GRAD_PLACES_PREFIX_IGNORES_SERBIAN_LETTERS_CASE_AND_SCRIPT', prefix);

  // "Za mene" (DISCOVERY-ZAMENE) still narrows by the rule; with words it is the rule set AND the folded words
  const forMeAll = names((await ok(disc(page({...FILTER, forMe: true})))).items.map(i => i.id));
  const forMeText = names((await ok(disc(page({...FILTER, forMe: true, text: 'cistim'})))).items.map(i => i.id));
  assert.deepEqual(forMeAll, ['nsCistim', 'nsGaraza']); assert.deepEqual(forMeText, ['nsCistim', 'nsGaraza']);
  pass('DISCOVERY_GRAD_FOR_ME_UNCHANGED_AND_COMBINES_WITH_FOLDED_WORDS', {forMeAll, forMeTextBefore, forMeText});

  // refusals of the new key
  for (const [label, request] of [['groupBy city (lower case)', places(ISO, '', {groupBy: 'city'})], ['groupBy 5', places(ISO, '', {groupBy: 5})],
    ['groupBy null', places(ISO, '', {groupBy: null})], ['groupBy on PAGE', {...page(ISO), groupBy: 'CITY'}], ['groupBy on MAP', {...map(ISO), groupBy: 'CITY'}]]) {
    const r = await disc(request);
    assert.equal(r.error?.message, 'P6_INVALID_REQUEST', label); assert.equal(r.error?.code, '22023', label);
  }
  const crossAnchor = await disc(places(ISO, '', {groupBy: 'CITY'}, placesArea.anchor));
  assert.equal(crossAnchor.error?.message, 'P6_INVALID_ANCHOR');
  pass('DISCOVERY_GRAD_GROUPBY_REFUSALS_AND_AN_AREA_ANCHOR_NEVER_SERVES_CITY');

  // the fold: monotone (every word found before is still found), Serbian letters, case and script ignored, nothing else changed
  const monotone = JSON.parse(psqlText(`with words(w) as (values ('Čistim stan'),('čišćenje'),('Đorđe'),('Djordje'),('Ђорђе'),('Novi Sad'),('Нови Сад'),('Šabac'),
      ('košenje trave'),('Garaža'),('džak'),('Ljubovija'),('Његош'),('podjednako'),('odjava'),('Inđija'),('Indjija'),('ćevapi'),('Žabalj'),('MONTAŽA police'),
      ('električne instalacije'),('Selidba'),('VRAČAR'),('Čačak'),('Cacak'),('Помоћ у башти'),('Zemun - Beograd'),('ČIŠĆENJE STANA'),('Ödön Müller'),('x  y'),('Ђ'),('đ'))
    , titles(t) as (select w from words union select upper(w collate "sr-Latn-RS-x-icu") from words union select lower(w collate "sr-Latn-RS-x-icu") from words)
    , queries(x) as (select distinct substr(t, i, n) from titles, generate_series(1, 24) i, generate_series(1, 7) n where substr(t, i, n) <> ''
        union select w from words union select 'cistim' union select 'djordj' union select 'basti' union select 'cacak' union select 'nis' union select 'dj' union select 'j')
    , pairs as (select t, lower(public.p6_discovery_trim(x) collate "sr-Latn-RS-x-icu") as qt from titles, queries)
    select jsonb_build_object('pairs', count(*), 'lost', count(*) filter (where old and not new), 'gained', count(*) filter (where new and not old),
      'example', (select jsonb_agg(jsonb_build_object('title', t, 'query', qt)) from (select t, qt from pairs where qt <> ''
        and strpos(public.discovery_fold_v1(t), public.discovery_fold_v1(qt)) > 0 and strpos(lower(t collate "sr-Latn-RS-x-icu"), qt) = 0 limit 5) e))
    from (select t, qt, strpos(lower(t collate "sr-Latn-RS-x-icu"), qt) > 0 as old, strpos(public.discovery_fold_v1(t), public.discovery_fold_v1(qt)) > 0 as new
      from pairs where qt <> '') x;`).split('\n').filter(Boolean).at(-1));
  assert.ok(monotone.pairs > 10000, 'TOO_FEW_PAIRS'); assert.equal(monotone.lost, 0, 'A_WORD_FOUND_BEFORE_IS_LOST'); assert.ok(monotone.gained > 0);
  report.observations.monotone = monotone; write();
  pass('DISCOVERY_GRAD_FOLD_IS_MONOTONE_NO_WORD_FOUND_BEFORE_IS_LOST', {pairs: monotone.pairs, gained: monotone.gained});
  // the helper is a plain function of the signed-in person (EXECUTE authenticated only)
  assert.equal(await ok(withRetry(() => V.client.rpc('discovery_fold_v1', {value: 'Čačak Ђорђе'}))), 'cacak djordje');
  const anon = await withRetry(() => rt.anon.rpc('discovery_fold_v1', {value: 'x'}));
  assert.ok(anon.error, 'ANON_MUST_NOT_EXECUTE_THE_HELPER');
  pass('DISCOVERY_GRAD_HELPER_EXECUTE_AUTHENTICATED_ONLY', {anon: anon.error?.code ?? anon.error?.message});

  // ---------------------------------------------------------------- exact revert
  sql(`create function public.dg_probe_uses_fold() returns text language sql as $p$ select public.discovery_fold_v1('x') $p$`);
  refused(fs.readFileSync(G + 'revert.sql', 'utf8'), 'DISCOVERY_GRAD_REVERT_HELPER_IN_USE');
  sql(`drop function public.dg_probe_uses_fold()`);
  psqlFile(G + 'revert.sql');
  assert.equal(bodyMd5(READER), manifest.functions[0].before_md5);
  assert.equal(catalog(), baseCatalog); assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001);
  await fx.reloadSchema();
  pass('DISCOVERY_GRAD_EXACT_REVERT_CATALOG_AND_CERTIFICATE_RESTORED_HELPER_IN_USE_REFUSED');
  for (const [k, request] of Object.entries(beforeRequests)) {
    assert.deepEqual(strip(await ok(disc({...request, anchor: beforeAnswers[k].anchor}))), strip(beforeAnswers[k]), 'REVERTED_ANSWER_DIFFERS:' + k);
  }
  await runCases('BEFORE');
  pass('DISCOVERY_GRAD_REVERTED_GIVES_THE_BEFORE_ANSWERS_BYTE_FOR_BYTE');

  report.observations.auth = fx.authStats();
  report.result = 'PASS'; write();
  console.log('PASS DISCOVERY_GRAD_RUNTIME');
} catch (error) {
  report.result = 'FAIL'; report.failure = String(error?.stack ?? error).slice(0, 3000);
  try { report.observations.backendsAtFailure = fx.diagnoseActiveBackends({terminate: false}); } catch { /* diagnostics are best effort */ }
  write();
  console.error('FAIL DISCOVERY_GRAD ' + report.failure);
  process.exitCode = 1;
}
