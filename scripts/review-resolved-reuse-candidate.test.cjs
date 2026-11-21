'use strict';
// Need review projection reuses the latest server-RESOLVED decision of the same
// conversation when the current conversation source has no decision (2026-11-21).
// Source-only candidate guard, rollback preimage, PG17 parse and a functional fixture
// running the exact DEV preimage of private.taxonomy_review_candidate_projection_v2
// before and after the candidate. Row shapes are anonymized DEV shapes:
// conversations 48613714-/b44106e3-/f06e4718- (decision in an earlier turn only) and
// 1c4fa742- (only DEFERRED decisions). No DEV/PROD connection is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

const candidate = fs.readFileSync(path.join(__dirname, 'sql', 'review_resolved_reuse_20261121.candidate.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(__dirname, 'sql', 'rollback_review_resolved_reuse_preimage_20261121.sql'), 'utf8');
const blocks = [...candidate.matchAll(/DO \$([A-Za-z0-9_]+)\$[\s\S]*?END\s*\$\1\$;/g)];
const tags = blocks.map(match => match[1]);
const md5 = value => createHash('md5').update(value).digest('hex');
const definition = rollback.match(/CREATE OR REPLACE FUNCTION [\s\S]*?\$function\$\n;/)[0];
const PRE_MD5 = 'f439455e1d5edb63ae4297a5c922a3c5', POST_MD5 = 'a98a0b2228095b1db7236836633d09a7';
const SIG = 'private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)';

test('resolved-decision reuse SQL remains explicitly source-only and fail-closed', () => {
  assert.match(candidate, /SOURCE-ONLY CANDIDATE/);
  assert.deepEqual(tags, ['source_only', 'review_resolved_reuse']);
  assert.match(blocks[0][0], /REVIEW_RESOLVED_REUSE_SOURCE_ONLY/);
  assert.ok(candidate.indexOf('DO $source_only$') < candidate.indexOf('BEGIN;'));
  const main = blocks[1][0];
  for (const guard of ['_PREIMAGE_DRIFT', '_ANCHOR_DRIFT', '_POSTIMAGE_DRIFT']) assert.match(main, new RegExp(guard));
  assert.match(main, new RegExp(`IS DISTINCT FROM '${PRE_MD5}'`));
  assert.match(main, new RegExp(`IS DISTINCT FROM '${POST_MD5}'`));
  assert.match(main, /actual\.acl IS DISTINCT FROM '\{postgres=X\/postgres\}'/);
  assert.match(main, /actual\.prosecdef IS DISTINCT FROM false/);
  assert.match(main, /actual\.proconfig IS DISTINCT FROM ARRAY\['search_path=pg_catalog, private'\]::text\[\]/);
  assert.match(main, /actual\.metadata IS DISTINCT FROM original_metadata/);
  assert.match(main, /p_purpose='NEED_SERVICE'/, 'Worker projection stays unchanged');
  assert.match(main, /catalog_resolution->>'state'='RESOLVED'/, 'only server-resolved decisions are reused');
  assert.doesNotMatch(candidate, /\bgrant\b|\brevoke\b|security definer|security invoker/i, 'no ACL or definer change');
});

test('rollback preimage holds the exact read-only DEV definition', () => {
  const body = definition.split('AS $function$')[1].split('$function$')[0];
  assert.equal(md5(body), PRE_MD5);
  assert.equal(md5(definition.slice(0, -1)), 'aeae6f02c0ef0883dde1e220a396f1a2');
  assert.match(rollback, /REVIEW_RESOLVED_REUSE_ROLLBACK_PREIMAGE_DRIFT/);
  assert.match(rollback, /REVIEW_RESOLVED_REUSE_ROLLBACK_POSTIMAGE_DRIFT/);
  assert.match(rollback, new RegExp(POST_MD5));
});

test('guarded block parses as PostgreSQL 17 PL/pgSQL and stops on an absent function', async () => {
  const db = new PGlite();
  try {
    await assert.rejects(db.exec(blocks[1][0]), error => {
      assert.doesNotMatch(String(error?.message || error), /syntax error|unterminated dollar-quoted|mismatched parentheses/i);
      return true;
    });
  } finally { await db.close(); }
});

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const OWNER = id(1), OTHER = id(9), CONV = id(2), BRANCH = id(800), LEKTURA = id(801), NEW_LEAF = id(802), PARENT = id(17);
const SERVICE = 'Lektura i korektura teksta';
const fixture = `
create schema private; create schema extensions; create schema auth;
create function extensions.digest(text, text) returns bytea language sql immutable as $$select sha256(convert_to($1,'UTF8'))$$;
create function extensions.digest(bytea, text) returns bytea language sql immutable as $$select sha256($1)$$;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
create table public.ai_conversations(id uuid primary key, account_id uuid, purpose text);
create table private.fx_source(cid uuid primary key, doc jsonb);
create function private.ai_task_review_source(cid uuid) returns jsonb language sql stable as $$select doc from private.fx_source where cid=$1$$;
create table private.worker_ai_sessions(account_id uuid, conversation_id uuid, candidate jsonb, revision integer, base_hash text);
create table private.work_taxonomy_control(singleton boolean primary key, catalog_version bigint);
create function private.taxonomy_admission_fingerprint_v1() returns text language sql stable as $$select 'fp-'||catalog_version from private.work_taxonomy_control$$;
create table private.work_taxonomy_categories(id uuid primary key, label text, parent_id uuid, canonical_key text, state text);
create table private.work_taxonomy_category_modes(category_id uuid, execution_scope text);
create table private.work_taxonomy_aliases(category_id uuid, normalized_key text);
create function private.taxonomy_normalize_v1(text) returns text language sql immutable as $$select lower(regexp_replace(btrim($1),'\\s+',' ','g'))$$;
create function private.taxonomy_risk_triage_v1(text) returns text language sql immutable as $$select case when $1 ilike '%oružj%' then 'BLOCKED' else 'LOW_RISK_CANDIDATE' end$$;
create function private.taxonomy_category_path_valid_v1(uuid) returns boolean language sql stable as $$select true$$;
create function private.taxonomy_handoff_valid_v1(jsonb) returns boolean language sql immutable as $$select jsonb_typeof($1)='object' and $1 ? 'required'$$;
create function private.taxonomy_turn_category_identity_v1(uuid) returns text language sql stable as $$select c.id::text||'|'||c.label||'|'||coalesce(c.parent_id::text,'') from private.work_taxonomy_categories c where c.id=$1 and c.state='ESTABLISHED'$$;
-- Exact canonical/alias lookup only (the behaviour the defect falls back to).
create function private.taxonomy_review_exact_projection_v1(p_purpose text, p_services jsonb, p_service_modes jsonb) returns jsonb language sql stable as $$
  with items as (select x.value item, (select c.id from private.work_taxonomy_categories c join private.work_taxonomy_category_modes m on m.category_id=c.id
      and m.execution_scope=x.value->>'mode' where c.state='ESTABLISHED' and (c.canonical_key=private.taxonomy_normalize_v1(x.value->>'service')
      or exists(select 1 from private.work_taxonomy_aliases a where a.category_id=c.id and a.normalized_key=private.taxonomy_normalize_v1(x.value->>'service'))) limit 1) cid
    from jsonb_array_elements(p_service_modes) x)
  select case when exists(select 1 from items where cid is null) then jsonb_build_object('status','PENDING_CLASSIFICATION','classificationCandidates','[]'::jsonb,
      'reviewedServiceModes','[]'::jsonb,'classificationCatalogVersion',null,'classificationCatalogFingerprint',null)
    else jsonb_build_object('status','READY','classificationCandidates',(select jsonb_agg(jsonb_build_object('action','REUSE_EXISTING','service',item->>'service',
      'mode',item->>'mode','categoryId',cid)) from items),'reviewedServiceModes','[]'::jsonb,
      'classificationCatalogVersion',(select catalog_version from private.work_taxonomy_control),'classificationCatalogFingerprint',private.taxonomy_admission_fingerprint_v1()) end $$;
create table private.work_taxonomy_gemini_turn_hints_v1(id uuid primary key, purpose text, account_id uuid, conversation_id uuid, client_request_id uuid,
  turn_id uuid, attempt_id uuid, source_fingerprint text, catalog_version bigint, proposals jsonb, payload_digest text, created_at timestamptz, catalog_resolution jsonb);
-- Live DEV body of private.taxonomy_resolved_turn_proposals_v1 (md5 547d43c7108780d54f3d2d9d90dd12e4 functiondef).
CREATE FUNCTION private.taxonomy_resolved_turn_proposals_v1(h private.work_taxonomy_gemini_turn_hints_v1)
 RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'pg_catalog' AS $function$
DECLARE version bigint;i integer;p jsonb;item jsonb;v_category_id uuid;answer jsonb:='[]'::jsonb;
BEGIN
 IF h.catalog_resolution IS NULL THEN RETURN h.proposals; END IF;
 IF h.catalog_resolution->>'state' IS DISTINCT FROM 'RESOLVED'
 OR jsonb_array_length(h.catalog_resolution->'items') IS DISTINCT FROM jsonb_array_length(h.proposals) THEN RETURN '[]'::jsonb; END IF;
 SELECT catalog_version INTO version FROM private.work_taxonomy_control WHERE singleton;
 IF version IS NULL THEN RETURN '[]'::jsonb; END IF;
 FOR i IN 0..jsonb_array_length(h.proposals)-1 LOOP
  p:=h.proposals->i;item:=h.catalog_resolution->'items'->i;v_category_id:=(item->>'categoryId')::uuid;
  IF private.taxonomy_turn_category_identity_v1(v_category_id) IS DISTINCT FROM item->>'identity'
   OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m WHERE m.category_id=v_category_id AND m.execution_scope=p->>'mode')
   OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories child WHERE child.parent_id=v_category_id AND child.state='ESTABLISHED')
   OR private.taxonomy_risk_triage_v1(p->>'service') IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
   OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c WHERE c.id=v_category_id
      AND private.taxonomy_risk_triage_v1(c.label)='LOW_RISK_CANDIDATE') THEN RETURN '[]'::jsonb; END IF;
  answer:=answer||jsonb_build_array(p||jsonb_build_object('action','REUSE_EXISTING','categoryId',v_category_id,
   'parentId','','proposedPath','[]'::jsonb,'catalogVersion',version));
 END LOOP;
 RETURN answer;
END $function$;
-- Live DEV view definition.
create view private.work_taxonomy_turn_hints_resolved_v1 as select id, purpose, account_id, conversation_id, client_request_id, turn_id, attempt_id,
  source_fingerprint, case when catalog_resolution is not null then (select catalog_version from private.work_taxonomy_control where singleton)
  else catalog_version end as catalog_version, private.taxonomy_resolved_turn_proposals_v1(h.*) as proposals, payload_digest, created_at, catalog_resolution
  from private.work_taxonomy_gemini_turn_hints_v1 h;
insert into private.work_taxonomy_control values (true, 17);
insert into private.work_taxonomy_categories values
  ('${BRANCH}','Pisanje i jezici',null,'pisanje i jezici','ESTABLISHED'),
  ('${LEKTURA}','Lektura tekstova','${BRANCH}','lektura tekstova','ESTABLISHED'),
  ('${PARENT}','Potrčko, svakodnevna pomoć i briga',null,'potrčko, svakodnevna pomoć i briga','ESTABLISHED'),
  ('${NEW_LEAF}','Korektura rukopisa','${BRANCH}','korektura rukopisa','ESTABLISHED');
insert into private.work_taxonomy_category_modes values ('${LEKTURA}','REMOTE'), ('${NEW_LEAF}','REMOTE');
insert into public.ai_conversations values ('${CONV}','${OWNER}','NEED_INTAKE');
insert into private.fx_source values ('${CONV}','{"turn":1}');
`;
let seq = 100;
const identity = category => `${category}|${category === LEKTURA ? 'Lektura tekstova' : 'Korektura rukopisa'}|${BRANCH}`;
const proposal = (service = SERVICE, mode = 'REMOTE', categoryId = LEKTURA) => ({ mode, action: 'REUSE_EXISTING',
  reason: 'Usluga lekture i korekture odgovara postojećoj usluzi.', handoff: { required: false }, service, parentId: '',
  categoryId, proposedPath: [], catalogVersion: 17 });
async function hint(db, { source, resolution, proposals = [proposal()], account = OWNER, purpose = 'NEED_SERVICE', minutes = 0 }) {
  await db.query(`insert into private.work_taxonomy_gemini_turn_hints_v1 values ($1,$2,$3,$4,$5,$6,$7,$8,17,$9,'digest',
    timestamptz '2026-11-02 11:58:00+00' + make_interval(mins => $10),$11)`,
  [id(seq++), purpose, account, CONV, id(seq++), id(seq++), id(seq++), source, JSON.stringify(proposals), minutes,
    resolution === undefined ? null : JSON.stringify(resolution)]);
}
const resolved = (categories = [LEKTURA]) => ({ state: 'RESOLVED', inputDigest: 'a'.repeat(64),
  items: categories.map(categoryId => ({ categoryId, identity: identity(categoryId) })) });
async function nextTurn(db, n) { await db.query(`update private.fx_source set doc=$2 where cid=$1`, [CONV, JSON.stringify({ turn: n })]); }
async function project(db, service = SERVICE, mode = 'REMOTE', { purpose = 'NEED_SERVICE', as = OWNER } = {}) {
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [as]);
  return (await db.query(`select private.taxonomy_review_candidate_projection_v2($1,$2,$3,$4,$5) v`,
    [purpose, JSON.stringify([service]), JSON.stringify([{ service, mode }]), OWNER, CONV])).rows[0].v;
}
async function database({ patched }) {
  const db = new PGlite();
  await db.exec(fixture);
  await db.exec(definition);
  await db.exec(`revoke all on function ${SIG} from public;`);
  assert.equal((await db.query(`select md5(prosrc) m from pg_proc where oid='${SIG}'::regprocedure`)).rows[0].m, PRE_MD5);
  if (patched) await db.exec(candidate.slice(candidate.indexOf('BEGIN;')));
  return { db };
}
async function source(db) { return (await db.query(`select encode(extensions.digest(doc::text,'sha256'),'hex') h from private.fx_source`)).rows[0].h; }

test('before the candidate a RESOLVED decision of an earlier turn is lost after a later turn (reproduces DEV PENDING_CLASSIFICATION)', async () => {
  const { db } = await database({ patched: false });
  try {
    await hint(db, { source: await source(db), resolution: resolved() });
    assert.equal((await project(db)).status, 'READY', 'same source: the decision is used');
    await nextTurn(db, 2); // e.g. "Objavi" / price turn without a decision
    assert.equal((await project(db)).status, 'PENDING_CLASSIFICATION');
  } finally { await db.close(); }
});

test('after the candidate the latest RESOLVED decision of the same conversation, service and mode is reused', async () => {
  const { db } = await database({ patched: true });
  try {
    assert.equal((await db.query(`select md5(prosrc) m, proacl::text a, prosecdef s from pg_proc where oid='${SIG}'::regprocedure`)).rows[0].m, POST_MD5);
    await hint(db, { source: await source(db), resolution: resolved() });
    await nextTurn(db, 2); await nextTurn(db, 3);
    const v = await project(db);
    assert.equal(v.status, 'READY');
    assert.equal(v.classificationCandidates.length, 1);
    assert.equal(v.classificationCandidates[0].categoryId, LEKTURA);
    assert.equal(v.classificationCandidates[0].action, 'REUSE_EXISTING');
    assert.deepEqual(v.classificationCandidates[0].handoff, { required: false });
    assert.equal(v.classificationCatalogVersion, 17);
    // Normalized service identity (case/spacing) is the same service.
    assert.equal((await project(db, '  lektura i  korektura TEKSTA ')).status, 'READY');
  } finally { await db.close(); }
});

test('fail closed: other service, other mode, other owner, unresolved/deferred decisions and Worker purpose stay unchanged', async () => {
  const { db } = await database({ patched: true });
  try {
    // DEV 1c4fa742- shape: only DEFERRED (CATALOG_CONFLICT / SAFETY_UNRESOLVED) and an unresolved capture.
    await hint(db, { source: 'x1', resolution: { state: 'DEFERRED', code: 'CATALOG_CONFLICT', inputDigest: 'b'.repeat(64) } });
    await hint(db, { source: 'x2', resolution: null, minutes: 1 });
    await hint(db, { source: 'x3', resolution: { state: 'DEFERRED', code: 'SAFETY_UNRESOLVED', inputDigest: 'c'.repeat(64) }, minutes: 2 });
    assert.equal((await project(db)).status, 'PENDING_CLASSIFICATION', 'never reuse a decision the server did not resolve');
  } finally { await db.close(); }
  const second = await database({ patched: true });
  try {
    const db = second.db;
    await hint(db, { source: 'earlier', resolution: resolved() });
    assert.equal((await project(db, 'Prevod teksta na nemački')).status, 'PENDING_CLASSIFICATION', 'changed service');
    assert.equal((await project(db, SERVICE, 'ON_SITE')).status, 'PENDING_CLASSIFICATION', 'changed mode');
    await assert.rejects(project(db, SERVICE, 'REMOTE', { as: OTHER }), /TAXONOMY_REVIEW_OWNER_MISMATCH/);
    await db.query(`insert into private.worker_ai_sessions values ($1,$2,'{}',1,'h')`, [OWNER, CONV]);
    await hint(db, { source: 'w-earlier', resolution: resolved(), purpose: 'WORKER_CAPABILITY', minutes: 1 });
    assert.equal((await project(db, SERVICE, 'REMOTE', { purpose: 'WORKER_CAPABILITY' })).status, 'PENDING_CLASSIFICATION', 'Worker unchanged');
  } finally { await second.db.close(); }
  const third = await database({ patched: true });
  try {
    const db = third.db;
    await hint(db, { source: 'other-owner', resolution: resolved(), account: OTHER });
    assert.equal((await project(db)).status, 'PENDING_CLASSIFICATION', 'another account cannot supply the decision');
  } finally { await third.db.close(); }
});

test('fail closed: a later decision for the same service, an ambiguous resolved pair or a revalidation failure', async () => {
  for (const scenario of ['later-deferred', 'ambiguous', 'binding-invalid', 'duplicate-in-hint']) {
    const { db } = await database({ patched: true });
    try {
      if (scenario === 'duplicate-in-hint') {
        await hint(db, { source: 'earlier', resolution: resolved([LEKTURA, LEKTURA]), proposals: [proposal(), proposal()] });
      } else await hint(db, { source: 'earlier', resolution: resolved() });
      if (scenario === 'later-deferred')
        await hint(db, { source: 'later', minutes: 5, resolution: { state: 'DEFERRED', code: 'SAFETY_UNRESOLVED', inputDigest: 'd'.repeat(64) } });
      if (scenario === 'ambiguous')
        await hint(db, { source: 'older', minutes: -5, resolution: resolved([NEW_LEAF]), proposals: [proposal(SERVICE, 'REMOTE', NEW_LEAF)] });
      if (scenario === 'binding-invalid') await db.query(`delete from private.work_taxonomy_category_modes where category_id=$1`, [LEKTURA]);
      assert.equal((await project(db)).status, 'PENDING_CLASSIFICATION', scenario);
    } finally { await db.close(); }
  }
});

test('the current-source decision keeps priority over an older resolved decision', async () => {
  const { db } = await database({ patched: true });
  try {
    await hint(db, { source: 'older', resolution: resolved() });
    await hint(db, { source: await source(db), minutes: 3, resolution: resolved([NEW_LEAF]),
      proposals: [proposal(SERVICE, 'REMOTE', NEW_LEAF)] });
    const v = await project(db);
    assert.equal(v.status, 'READY');
    assert.equal(v.classificationCandidates[0].categoryId, NEW_LEAF);
  } finally { await db.close(); }
});
