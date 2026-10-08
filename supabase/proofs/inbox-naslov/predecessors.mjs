// INBOX-NASLOV: admit the disposable chain only when everything the package replaces or reads equals canonical DEV (read read-only on
// 2026-10-08, ledger 234). The established chain of the DISCOVERY-GRAD proof (live79 -> source147 -> PKG027..PKG050 -> ... -> EX06e R3,
// then ZONE-PERF, MATCH-V1 and DISCOVERY-ZAMENE with their DEV files) brings rpc_list_inbox to its DEV body through the replay of PKG-027c.
// MATCH-V1B (ledger 233) and DISCOVERY-GRAD (234) touch none of the bodies, columns or indexes pinned here and are not replayed.
// Bounded relevant-body fidelity, never global DEV equivalence. Never connects to DEV.
import fs from 'node:fs';
import path from 'node:path';
import * as C from './common.mjs';

const {assert, sql, rows, q, manifest, INBOX} = C;
const f = manifest.functions[0];
const pins = {
  reader: {signature: INBOX, devBodyMd5: f.before_md5, devDefinitionMd5: f.before_definition_md5,
    chainBodyMd5: C.bodyMd5(INBOX), chainDefinitionMd5: C.definitionMd5(INBOX),
    chainMeta: rows(`select p.prosecdef, p.provolatile, p.proconfig, p.proacl::text as acl, p.proowner::regrole::text as owner, l.lanname,
      obj_description(p.oid,'pg_proc') as comment from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(${q(INBOX)})`)[0]},
  dependencies: manifest.dependencyPins.map(d => ({...d, chainMd5: C.bodyMd5(d.signature)})),
  columns: manifest.columns.map(c => ({...c, chain: rows(`select format_type(a.atttypid,a.atttypmod) as type, a.attnotnull as "notNull" from pg_attribute a
    where a.attrelid=to_regclass(${q(c.relation)}) and a.attname=${q(c.column)} and a.attnum>0 and not a.attisdropped`)[0] ?? null})),
  erasureMarkers: manifest.erasureMarkers.substrings.map(s => ({substring: s,
    present: sql(`select strpos(prosrc, ${q(s)})>0 from pg_proc where oid=to_regprocedure(${q(manifest.erasureMarkers.function)})`) === 't'})),
};
// The indexes of the five tables on DEV (read-only, 2026-10-08). The ones the old and new reader use are REQUIRED (the load figures mean
// nothing on other indexes); the rest is recorded so a difference is visible.
const DEV_INDEXES = {
  agreements_pkey: ['CREATE UNIQUE INDEX agreements_pkey ON public.agreements USING btree (id)', true],
  agreements_need_worker_participant_idx: ["CREATE INDEX agreements_need_worker_participant_idx ON public.agreements USING btree (need_id, worker_account_id) WHERE (status = ANY (ARRAY['CONFIRMED'::text, 'COMPLETED'::text]))", false],
  agreements_requester_idx: ['CREATE INDEX agreements_requester_idx ON public.agreements USING btree (requester_account_id, created_at DESC)', false],
  agreements_worker_idx: ['CREATE INDEX agreements_worker_idx ON public.agreements USING btree (worker_account_id, created_at DESC)', false],
  marketplace_responses_pkey: ['CREATE UNIQUE INDEX marketplace_responses_pkey ON public.marketplace_responses USING btree (id)', true],
  marketplace_responses_need_idx: ['CREATE INDEX marketplace_responses_need_idx ON public.marketplace_responses USING btree (need_id, status, created_at DESC)', true],
  marketplace_responses_worker_idx: ["CREATE INDEX marketplace_responses_worker_idx ON public.marketplace_responses USING btree (worker_account_id, created_at DESC, id DESC) WHERE (status <> 'DRAFT'::text)", false],
  needs_pkey: ['CREATE UNIQUE INDEX needs_pkey ON public.needs USING btree (id)', true],
  needs_requester_idx: ['CREATE INDEX needs_requester_idx ON public.needs USING btree (requester_account_id, created_at DESC)', false],
  activity_inbox_page_idx: ['CREATE INDEX activity_inbox_page_idx ON public.user_activity_events USING btree (recipient_user_id, created_at DESC, id DESC)', true],
  activity_inbox_unread_idx: ['CREATE INDEX activity_inbox_unread_idx ON public.user_activity_events USING btree (recipient_user_id, recipient_role) WHERE (read_at IS NULL)', true],
  activity_recipient_idx: ['CREATE INDEX activity_recipient_idx ON public.user_activity_events USING btree (recipient_user_id, recipient_role, created_at DESC)', false],
  user_activity_events_pkey: ['CREATE UNIQUE INDEX user_activity_events_pkey ON public.user_activity_events USING btree (id)', true],
  delivery_inbox_copy_idx: ["CREATE INDEX delivery_inbox_copy_idx ON public.notification_deliveries USING btree (event_id, created_at, id) WHERE (channel = 'IN_APP'::text)", true],
  notification_recipient_idx: ['CREATE INDEX notification_recipient_idx ON public.notification_deliveries USING btree (recipient_user_id, recipient_role, state, created_at DESC)', false],
};
const chainIndexes = Object.fromEntries(rows(`select c.relname as name, pg_get_indexdef(c.oid) as def from pg_index i join pg_class c on c.oid=i.indexrelid
  where i.indrelid in ('public.agreements'::regclass,'public.marketplace_responses'::regclass,'public.needs'::regclass,'public.user_activity_events'::regclass,
    'public.notification_deliveries'::regclass)`).map(r => [r.name, r.def]));
const indexes = Object.fromEntries(Object.entries(DEV_INDEXES).map(([name, [def, required]]) => [name, {required, equal: chainIndexes[name] === def, chain: chainIndexes[name] ?? null}]));
// Observed, not admitted: the writer of events the behaviour proof calls (private.emit_event), the copy table it uses and the reader of a
// single event; DEV md5 of 2026-10-08 beside the chain md5, so a difference is visible.
const observed = Object.fromEntries([
  ['private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamp with time zone)', '67413effbbb3fa227397d355e0d4edfb'],
  ['private.notification_copy_v5(text)', 'e725df74604d4b52c0a3fad90b748c51'],
  ['private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)', '3891fe77d38af04e06cfe4c9e4abb96f'],
  ['public.rpc_mark_activity_event_read(uuid)', '89729d590c7e402a45a2ac60d516cae3'],
  ['public.rpc_resolve_activity_event(uuid)', 'e5dc05773da08471db572194caf467e2'],
].map(([signature, devMd5]) => [signature, {devMd5, chainMd5: C.bodyMd5(signature) || null}]));

const mismatched = [];
const meta = pins.reader.chainMeta;
if (pins.reader.chainBodyMd5 !== f.before_md5 || pins.reader.chainDefinitionMd5 !== f.before_definition_md5) mismatched.push({what: 'reader body', ...pins.reader});
if (!meta || meta.prosecdef !== true || meta.provolatile !== 's' || JSON.stringify(meta.proconfig) !== JSON.stringify(f.config) || meta.acl !== f.acl
  || meta.owner !== f.owner || meta.lanname !== 'plpgsql' || meta.comment !== null) mismatched.push({what: 'reader metadata', meta});
for (const d of pins.dependencies) if (d.chainMd5 !== d.body_md5) mismatched.push({what: 'dependency', ...d});
for (const c of pins.columns) if (!c.chain || c.chain.type !== c.type || c.chain.notNull !== c.notNull) mismatched.push({what: 'column', ...c});
for (const m of pins.erasureMarkers) if (!m.present) mismatched.push({what: 'erasure marker', ...m});
for (const [name, x] of Object.entries(indexes)) if (x.required && !x.equal) mismatched.push({what: 'index', name, ...x});
const certificate = C.closure();
if (certificate.ready !== true || certificate.digest !== certificate.certificate || certificate.digest !== certificate.erasure) mismatched.push({what: 'certificate', certificate});
const report = {result: mismatched.length ? 'FAIL' : 'PASS', pins, indexes, observed, certificate, mismatched,
  ledger: Number(sql('select count(*) from supabase_migrations.schema_migrations')),
  scope: 'The reader rpc_list_inbox (body and definition md5, metadata), private.category_of_event, the 15 columns and the required indexes the '
    + 'reader uses, and the erasure markers equal canonical DEV of 2026-10-08 on the disposable chain; certificate self-consistent. Not global DEV equivalence.'};
fs.writeFileSync(path.join(C.out, 'predecessor-fidelity.json'), JSON.stringify(report, null, 2) + '\n');
if (mismatched.length) { console.error('FAIL INBOX_NASLOV_PREDECESSOR_FIDELITY ' + JSON.stringify(mismatched).slice(0, 3000)); process.exit(1); }
console.log(`PASS INBOX_NASLOV_PREDECESSOR_FIDELITY reader ${f.before_md5} (definition ${f.before_definition_md5}), ${pins.dependencies.length} dependency, `
  + `${pins.columns.length} columns, ${Object.values(indexes).filter(x => x.required).length} required indexes, erasure markers; observed equal: `
  + JSON.stringify(Object.fromEntries(Object.entries(observed).map(([k, v]) => [k.split('(')[0], v.chainMd5 === v.devMd5]))));
