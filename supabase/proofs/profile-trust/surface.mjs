// CANCEL-INFO + PROFILE-TRUST: make the disposable chain carry exactly the DEV bodies these packages rely on, and the D12 read surface.
// Disposable only (loopback guard of closure_runtime). Never connects to DEV. Bounded relevant-body fidelity, not global DEV equivalence.
//   1. Every dependency the two candidates pin (live-functions.json, read from DEV 2026-10-07) must equal the DEV body; a differing body of an
//      existing function is replaced by the DEV text with its metadata unchanged and reported (INSTALLED_FROM_DEV_READBACK); a missing one fails.
//   2. The writers the proof drives (selection, completion, cancellation, review, block) are compared with their DEV md5 and REPORTED (not replaced).
//   3. The chain of supabase/proofs/match-v1/chain.mjs does not replay D12 (2026-10-02). The reviews read needs D12's comment relation, so the proof
//      installs a READ-EQUIVALENT surface: a table with DEV's columns and constraints in the uncertified schema proof_d12_surface, a view
//      private.agreement_review_comments_v1 over it (views are outside both closure digests, so the chain certificate stays ready), and the DEV
//      D12 reader public.rpc_list_review_comments_v1 as the reference for the comment rules. Not reproduced: the forbidden-character CHECK, the
//      two triggers and RLS of the DEV table (the proof writes plain ASCII comments as the owner and only READS them through the functions under test).
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assert, sql, rows, q, env} from '../pre_v3/closure_runtime.mjs';

const md5 = s => createHash('md5').update(s).digest('hex');
const out = env.TRUST_ARTIFACT_DIR;
assert.ok(out);
fs.mkdirSync(out, {recursive: true});
const closure = () => rows(`select private.closure_source_digest_v5() as digest,private.closure_erasure_program_digest_v5() as program,
  (select sha256 from private.closure_source_v5 where singleton) as certificate,private.retention_ai_source_ready() as ready`)[0];
const report = {unit: 'PROFILE_TRUST_SURFACE', result: 'RUNNING', sourceSha: env.GITHUB_SHA, liveAccess: false, dependencies: [], writers: [], d12: null};
const write = () => fs.writeFileSync(path.join(out, 'surface-report.json'), JSON.stringify(report, null, 2) + '\n');
const before = closure();
assert.equal(before.ready, true, 'CHAIN_CERTIFICATE_NOT_READY_BEFORE_THE_SURFACE');

// ------------------------------------------------------------ 1. pinned dependencies: DEV text on the chain
const deps = [];
for (const dir of ['supabase/candidates/cancel-info-20261007/', 'supabase/candidates/profile-trust-20261007/']) {
  for (const row of JSON.parse(fs.readFileSync(dir + 'live-functions.json', 'utf8'))) {
    assert.equal(md5(row.body), row.body_md5);
    if (!deps.some(d => d.signature === row.signature)) deps.push(row);
  }
}
for (const dep of deps) {
  const row = rows(`select prosrc,pg_get_functiondef(oid) as definition,(to_jsonb(p)-'prosrc')::text as metadata from pg_proc p where oid=to_regprocedure(${q(dep.signature)})`)[0];
  if (!row) { report.dependencies.push({signature: dep.signature, state: 'MISSING'}); continue; }
  if (md5(row.prosrc) === dep.body_md5) { report.dependencies.push({signature: dep.signature, state: 'EXACT'}); continue; }
  const occurrences = row.definition.split(row.prosrc).length - 1;
  assert.equal(occurrences, 1, 'BODY_ANCHOR_NOT_UNIQUE:' + dep.signature);
  assert.ok(!dep.body.includes('$function$'));
  sql(row.definition.replace(row.prosrc, () => dep.body));
  const now = rows(`select md5(prosrc) as body,(to_jsonb(p)-'prosrc')::text as metadata from pg_proc p where oid=to_regprocedure(${q(dep.signature)})`)[0];
  assert.equal(now.body, dep.body_md5, 'DEV_BODY_NOT_INSTALLED:' + dep.signature);
  assert.equal(now.metadata, row.metadata, 'METADATA_CHANGED:' + dep.signature);
  report.dependencies.push({signature: dep.signature, state: 'INSTALLED_FROM_DEV_READBACK', chainMd5: md5(row.prosrc), devMd5: dep.body_md5});
}
write();
const missing = report.dependencies.filter(d => d.state === 'MISSING');
if (missing.length) { report.result = 'FAIL'; write(); console.error('FAIL PROFILE_TRUST_DEPENDENCY_MISSING ' + JSON.stringify(missing)); process.exit(1); }

// ------------------------------------------------------------ 2. the writers the proof drives (DEV md5, read-only readback 2026-10-07): reported only
const WRITERS = {
  'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)': '66aab6df0d625e24e0073c27bfe2aa91',
  'public.rpc_select_response(uuid,integer,uuid,integer,text,text)': '6a8fd871a60779bc438119b21a900dca',
  'public.rpc_mark_work_done(uuid)': '955e0719a3c0a67b684ee0d28483300c',
  'public.rpc_confirm_completion(uuid)': '658006c318c3847ab7a9f80706ef3003',
  'public.rpc_submit_agreement_review(uuid,uuid,jsonb,jsonb,uuid)': 'ff68b552c4f972e5d58a632672bc359e',
  'public.rpc_set_account_block(uuid,boolean,integer,uuid)': '8700f2abf73d2d9add5e02b32b28c6bc',
  'public.rpc_get_account_block(uuid)': 'b91745f39246ddd60245e32821364dd8',
  'public.rpc_list_my_agreements_page(text,integer,timestamp with time zone,uuid)': '5017f90ff8d9e5cd29ead0f88a6b0106',
  'public.rpc_get_agreement_workspace(uuid)': 'afa60817d35f0efd1317e4b9915aa872',
  'private.account_reputation(uuid)': 'f03e558ff56a31a0b49e394714b628cd',
};
for (const [signature, dev] of Object.entries(WRITERS)) {
  const chain = sql(`select coalesce(md5(prosrc),'') from pg_proc where oid=to_regprocedure(${q(signature)})`);
  report.writers.push({signature, dev, chain: chain || null, equal: chain === dev});
}
write();

// ------------------------------------------------------------ 3. the D12 read surface
const ref = JSON.parse(fs.readFileSync('supabase/proofs/profile-trust/d12-reference.json', 'utf8'));
assert.equal(md5(ref.reader.body), ref.reader.body_md5);
const existing = sql("select coalesce((select relkind::text from pg_class where oid=to_regclass('private.agreement_review_comments_v1')),'')");
if (existing === '') {
  const columns = ref.commentTable.columns.map(([name, type, notNull]) => `${name} ${type}${notNull ? ' not null' : ''}${name === 'created_at' ? ' default clock_timestamp()' : ''}`);
  // DEV's constraints that need no other table (the three foreign keys are left out: they would add internal triggers to certified tables).
  const checks = ref.commentTable.constraints.filter(c => c.startsWith('CHECK') || c.startsWith('PRIMARY KEY'));
  sql(`begin;
create schema proof_d12_surface;
create table proof_d12_surface.agreement_review_comments_v1 (${columns.join(', ')}, ${checks.join(', ')});
create index agreement_review_comments_v1_target_idx on proof_d12_surface.agreement_review_comments_v1 (target_account_id, created_at desc, review_id desc) where hidden_at is null;
create view private.agreement_review_comments_v1 as select ${ref.commentTable.columns.map(c => c[0]).join(', ')} from proof_d12_surface.agreement_review_comments_v1;
revoke all on private.agreement_review_comments_v1 from public, anon, authenticated, service_role;
revoke all on proof_d12_surface.agreement_review_comments_v1 from public, anon, authenticated, service_role;
commit;`);
  report.d12 = {surface: 'VIEW_FIXTURE', base: 'proof_d12_surface.agreement_review_comments_v1', notReproduced: ref.commentTable.notReproduced};
} else {
  report.d12 = {surface: existing === 'r' ? 'REAL_TABLE' : 'OTHER:' + existing, base: 'private.agreement_review_comments_v1'};
}
const readerNow = sql(`select coalesce(md5(prosrc),'') from pg_proc where oid=to_regprocedure(${q(ref.reader.signature)})`);
if (readerNow === '') {
  assert.ok(!ref.reader.body.includes('$d12_reference$'));
  sql(`begin;
create function public.rpc_list_review_comments_v1(${ref.reader.args}) returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $d12_reference$${ref.reader.body}$d12_reference$;
revoke all on function public.rpc_list_review_comments_v1(uuid,integer,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.rpc_list_review_comments_v1(uuid,integer,jsonb) to authenticated;
commit;`);
  report.d12.reader = 'INSTALLED_FROM_DEV_READBACK';
} else {
  report.d12.reader = readerNow === ref.reader.body_md5 ? 'EXACT' : 'DIFFERS:' + readerNow;
}
assert.equal(sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(ref.reader.signature)})`), ref.reader.body_md5);
assert.equal(sql(`select proacl::text from pg_proc where oid=to_regprocedure(${q(ref.reader.signature)})`), ref.reader.acl);
sql("notify pgrst, 'reload schema'");
const after = closure();
report.certificateUnchanged = JSON.stringify(after) === JSON.stringify(before);
report.certificate = after;
assert.equal(report.certificateUnchanged, true, 'THE_SURFACE_MOVED_THE_CHAIN_CERTIFICATE');
report.result = 'PASS';
write();
console.log(`PASS PROFILE_TRUST_SURFACE dependencies ${report.dependencies.map(d => d.state).join(',')}; D12 ${report.d12.surface}/${report.d12.reader}; `
  + `writers equal to DEV ${report.writers.filter(w => w.equal).length}/${report.writers.length}; certificate unchanged`);
