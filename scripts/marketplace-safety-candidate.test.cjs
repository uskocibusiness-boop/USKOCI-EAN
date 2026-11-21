'use strict';
// marketplace_safety_20261121: source-only guard, PL/pgSQL parse, and functional checks of every guarded block in a
// disposable PGlite fixture built from the md5-verified DEV preimage file. Only tables/helpers the patched paths read
// are modelled; this is SQL contract evidence, not a DEV deploy or live RLS proof.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

const ROOT = path.resolve(__dirname, '..');
const candidate = fs.readFileSync(path.join(__dirname, 'sql', 'marketplace_safety_20261121.candidate.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(__dirname, 'sql', 'rollback_marketplace_safety_preimage_20261121.sql'), 'utf8');
const blocks = [...candidate.matchAll(/DO \$([A-Za-z0-9_]+)\$[\s\S]*?END\s*\$\1\$;/g)];
const block = tag => blocks.find(match => match[1] === tag)?.[0];
const md5 = text => crypto.createHash('md5').update(text).digest('hex');
const ID = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const PREIMAGE = {
  'public.rpc_list_need_candidates': '4096a29c4ef6dbaeb987a58a9c9dba32',
  'public.rpc_list_need_candidates_page': '11b6ca6fa48ac74b76c6e7cd09c25c3c',
  'public.rpc_set_contact_grant': '5a6d710106832c1da7bc147a704f9301',
  'public.rpc_reveal_contact': '358bc1d98aecdd33b4e464ca11a1b401',
  'public.rpc_get_agreement_workspace': '0eb9b60cf7a52bdef85d8dc166690e0b',
  'public.rpc_submit_response': 'ad117da224ba9e4a3f7d70611aeaa6d8',
};
const POSTIMAGE = {
  'public.rpc_list_need_candidates': '754d506f7367b111505972cce43b4b10',
  'public.rpc_list_need_candidates_page': 'f1b2109e7e5d0d751ce30a28c001d6fa',
  'public.rpc_set_contact_grant': '2ccbbc41665d98d14d2fb2de679d047b',
  'public.rpc_reveal_contact': '7432a455a1543ad41b92798e45454b96',
  'public.rpc_get_agreement_workspace': '3884817e3fcc4717f9d3143d715305b5',
  'public.rpc_submit_response': 'dc49b5ad5382f5877644b4b6cddcc119',
};
const DEV_POLICY_QUAL = "((status = ANY (ARRAY['PUBLISHED'::text, 'SELECTION'::text])) AND (( SELECT auth.uid() AS uid) IS NOT NULL) AND ((requester_account_id = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[]))) = (( SELECT auth.uid() AS uid) = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[])))))";

test('marketplace safety SQL stays explicitly source-only and fail-closed', () => {
  assert.match(candidate, /SOURCE-ONLY CANDIDATE/);
  assert.equal(blocks[0][1], 'source_only');
  assert.match(blocks[0][0], /MARKETPLACE_SAFETY_SOURCE_ONLY/);
  assert.ok(candidate.indexOf('DO $source_only$') < candidate.indexOf('BEGIN;'));
  assert.deepEqual(blocks.map(match => match[1]), ['source_only', 'invoker_readers_guard', 'block_helper', 'discovery_policy_block',
    'candidates_block', 'candidates_page_block', 'submit_withdrawn_final', 'phone_grant_closed', 'phone_reveal_closed', 'workspace_phone_null']);
  assert.doesNotMatch(candidate, /POSTIMAGE_(CANDIDATES|SUBMIT|PHONE|WORKSPACE)'/, 'every postimage hash must be filled');
  assert.doesNotMatch(candidate, /\bservice_role\b[^;\n]*GRANT|GRANT[^;\n]*\banon\b/, 'the helper is never granted to anon');
  assert.doesNotMatch(candidate, /fvyqqudqvizjrxaflhex/, 'PROD is never named in a candidate');
  for (const [tag, hash] of [['candidates_block', '4096a29c'], ['candidates_page_block', '11b6ca6f'], ['submit_withdrawn_final', 'ad117da2'],
    ['phone_grant_closed', '5a6d7101'], ['phone_reveal_closed', '358bc1d9'], ['workspace_phone_null', '0eb9b60c']]) {
    assert.match(block(tag), new RegExp(`body_md5 IS DISTINCT FROM '${hash}`), `${tag} guards the DEV preimage`);
    assert.match(block(tag), /prosecdef IS DISTINCT FROM true/);
    assert.match(block(tag), /proconfig IS DISTINCT FROM ARRAY\['search_path=pg_catalog'\]::text\[\]/);
    assert.match(block(tag), /ANCHOR_DRIFT/);
    assert.match(block(tag), /metadata IS DISTINCT FROM original_metadata/);
  }
  assert.match(block('invoker_readers_guard'), /dc53bf4f14b1e35fdb1e12ff883d1edb/);
  assert.match(block('invoker_readers_guard'), /8e8ee643e72c9efab746b6a9e7f6ec08/);
  assert.match(block('invoker_readers_guard'), /6989659ffc9d6445333ab06e6df9c597/);
  assert.match(block('discovery_policy_block'), /7d2b4a721dfb96bc3a5cac893aefe939/);
});

test('rollback preimage bodies are byte-exact DEV captures', () => {
  const bodies = Object.fromEntries([...rollback.matchAll(/CREATE OR REPLACE FUNCTION (\S+?)\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$\n;/g)]
    .map(match => [match[1], md5(match[2])]));
  assert.deepEqual(bodies, PREIMAGE);
  assert.ok(rollback.includes(DEV_POLICY_QUAL), 'policy rollback restores the exact DEV qual');
  assert.equal(md5(DEV_POLICY_QUAL), '7d2b4a721dfb96bc3a5cac893aefe939');
  assert.match(rollback, /DROP FUNCTION IF EXISTS rls_private\.viewer_block_counterparties\(\);/);
  assert.match(rollback, /DROP INDEX IF EXISTS private\.account_blocks_blocked_active_idx;/);
});

test('all guarded blocks parse as PL/pgSQL and stop safely in an empty database', async () => {
  const db = new PGlite();
  const syntaxError = /syntax error|unterminated dollar-quoted|invalid dollar-quoted|mismatched parentheses/i;
  try {
    for (const match of blocks.slice(1)) {
      await assert.rejects(db.exec(match[0]), error => {
        assert.doesNotMatch(String(error?.message), syntaxError, `${match[1]}: ${error?.message}`);
        return true;
      }, `${match[1]} must stop on absent DEV objects`);
    }
  } finally { await db.close(); }
});

const FIXTURE = `
create role authenticated nologin; create role anon nologin; create role service_role nologin;
create schema auth; create schema private; create schema rls_private;
grant usage on schema rls_private to authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
create table private.account_blocks(blocker_account_id uuid not null, blocked_account_id uuid not null, active boolean not null default true,
  revision integer not null default 1, last_blocked_at timestamptz, updated_at timestamptz, primary key (blocker_account_id, blocked_account_id));
CREATE OR REPLACE FUNCTION private.safety_pair_blocked(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$ select exists(select 1 from private.account_blocks x where x.active
 and ((x.blocker_account_id=a and x.blocked_account_id=b) or (x.blocker_account_id=b and x.blocked_account_id=a))); $function$;
revoke all on function private.safety_pair_blocked(uuid,uuid) from public;
create function rls_private.p6_discovery_test_world_accounts() returns uuid[] language sql stable security definer set search_path to 'pg_catalog'
  as $$ select array[]::uuid[] $$;
grant execute on function rls_private.p6_discovery_test_world_accounts() to authenticated;
create table public.needs(id uuid primary key, status text not null, requester_account_id uuid not null, revision integer not null default 1,
  title text default 'Zadatak', approximate_area text default '', approximate_city text default '', required_slots integer default 1,
  starts_at timestamptz, ends_at timestamptz, schedule_kind text default 'FLEXIBLE', response_deadline timestamptz,
  mode text default 'OFFERS', price_basis text, requester_price_rsd integer, published_at timestamptz default now(), task_country_code text default 'RS');
alter table public.needs enable row level security;
create policy needs_owner_select on public.needs for select to authenticated using (requester_account_id = ( select auth.uid()));
create policy needs_public_discovery on public.needs for select to authenticated using (${DEV_POLICY_QUAL});
grant select on public.needs to authenticated;
create table public.marketplace_responses(id uuid primary key, need_id uuid not null, worker_account_id uuid not null, worker_profile_id uuid,
  status text not null, current_version integer default 1, submitted_against_need_revision integer default 1, submitted_at timestamptz,
  created_at timestamptz not null default now(), covered_slots integer, price_rsd integer, price_basis text, proposed_start_at timestamptz,
  proposed_end_at timestamptz, scope_note text, withdrawn_at timestamptz, response_kind text);
create table public.marketplace_response_versions(response_id uuid, version integer, need_revision integer, content_hash text, price_rsd integer,
  price_basis text, covered_slots integer, proposed_start_at timestamptz, proposed_end_at timestamptz, scope_note text);
create table private.response_application_snapshots(response_id uuid, response_version integer, snapshot_schema text, pricing_mode text,
  worker_team_capacity integer, worker_skills text[], worker_tools text[], worker_licenses text[], worker_vehicles text[]);
create table public.app_profiles(id uuid primary key, account_id uuid, kind text default 'WORKER', profile_status text default 'ACTIVE',
  display_name text, city text, skills text[], team_capacity integer, licenses text[]);
create table public.need_selections(need_id uuid, covered_slots integer, status text, worker_account_id uuid);
create table public.agreements(id uuid primary key, need_id uuid, requester_account_id uuid, worker_account_id uuid, requester_profile_id uuid,
  worker_profile_id uuid, status text, current_version integer default 1, selected_response_id uuid, created_at timestamptz default now());
create table public.agreement_versions(agreement_id uuid, version integer, terms jsonb);
create table public.agreement_execution(agreement_id uuid, state text, mode text, requester_deadline_at timestamptz, problem_opened_at timestamptz);
create table public.access_grants(id uuid primary key default gen_random_uuid(), agreement_id uuid, channel text, granted_by_account_id uuid,
  granted_to_account_id uuid, status text, granted_at timestamptz, revoked_at timestamptz, expires_at timestamptz,
  unique (agreement_id, channel, granted_by_account_id, granted_to_account_id));
create table public.app_accounts(id uuid primary key, phone text);
create table public.need_geography(need_id uuid, public_topology jsonb);
create function private.resolved_location_record_valid(jsonb, text, jsonb, text, uuid) returns boolean language sql as $$ select true $$;
create table public.need_sensitive(need_id uuid, exact_address text, resolved_location jsonb, access_notes text, exact_lat numeric, exact_lng numeric);
create table private.response_submit_commands(worker_account_id uuid, client_request_id text, request_hash text, response_id uuid,
  response_version integer, result jsonb);
create function private.accounts_same_world(uuid, uuid) returns boolean language sql as $$ select true $$;
-- A false time admission marks "passed every earlier gate" without modelling the whole submit tail.
create function private.need_search_time_admitted_v1(uuid, timestamptz) returns boolean language sql as $$ select false $$;
create function private.need_candidate_states_v5(uuid) returns table(response_id uuid, candidate_state text) language sql
  as $$ select r.id, 'SELECTABLE'::text from public.marketplace_responses r where r.need_id = $1 $$;
create function private.need_candidate_states_v5(uuid, uuid[]) returns table(response_id uuid, candidate_state text) language sql
  as $$ select r.id, 'SELECTABLE'::text from public.marketplace_responses r where r.need_id = $1 and r.id = any($2) $$;
create function public.rpc_get_public_profile(uuid) returns jsonb language sql as $$ select jsonb_build_object('profileId', $1) $$;
create function private.application_calendar_conflict_v1(uuid) returns boolean language sql as $$ select false $$;
create function private.safety_grant_valid(uuid, uuid, timestamptz) returns boolean language sql as $$ select true $$;
create function private.grant_is_ownable(uuid, text, uuid) returns boolean language sql as $$ select true $$;
create function private.grant_counterparty_ok(uuid, uuid, uuid) returns boolean language sql as $$ select true $$;
create function private.agreement_action_state(uuid, uuid) returns jsonb language sql as $$ select '{}'::jsonb $$;
`;
const ACLS = `
revoke all on function public.rpc_list_need_candidates(uuid) from public;
grant execute on function public.rpc_list_need_candidates(uuid) to authenticated; grant execute on function public.rpc_list_need_candidates(uuid) to service_role;
revoke all on function public.rpc_list_need_candidates_page(uuid,integer,timestamptz,uuid) from public;
grant execute on function public.rpc_list_need_candidates_page(uuid,integer,timestamptz,uuid) to authenticated;
grant execute on function public.rpc_list_need_candidates_page(uuid,integer,timestamptz,uuid) to service_role;
revoke all on function public.rpc_set_contact_grant(uuid,text,boolean) from public;
grant execute on function public.rpc_set_contact_grant(uuid,text,boolean) to service_role; grant execute on function public.rpc_set_contact_grant(uuid,text,boolean) to authenticated;
revoke all on function public.rpc_reveal_contact(uuid,text) from public;
grant execute on function public.rpc_reveal_contact(uuid,text) to service_role; grant execute on function public.rpc_reveal_contact(uuid,text) to authenticated;
revoke all on function public.rpc_get_agreement_workspace(uuid) from public;
grant execute on function public.rpc_get_agreement_workspace(uuid) to service_role; grant execute on function public.rpc_get_agreement_workspace(uuid) to authenticated;
revoke all on function public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text) from public;
grant execute on function public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text) to service_role;
grant execute on function public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text) to authenticated;
`;
const R = ID(1), W = ID(2), W2 = ID(3), OTHER = ID(4), NEED = ID(10), NEED_OTHER = ID(11), AGR = ID(20);
const SUBMIT = 'select public.rpc_submit_response($1,1,$2,1,1000,null,null,null,$3) as r';

async function fixture() {
  const db = new PGlite();
  await db.exec(FIXTURE);
  await db.exec(rollback);
  await db.exec(ACLS);
  const as = async uid => { await db.query("select set_config('request.uid', $1, false)", [uid ?? '']); };
  const fail = async (sql, params, code) => {
    try { await db.query(sql, params); } catch (error) { return { message: error.message, code: error.code, hint: error.hint }; }
    assert.fail(`${sql} was expected to fail with ${code}`);
  };
  const bodies = async () => Object.fromEntries((await db.query(`select n.nspname||'.'||p.proname name, md5(p.prosrc) m from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname = any($1)`, [Object.keys(PREIMAGE).map(name => name.slice(7))])).rows.map(row => [row.name, row.m]));
  return { db, as, fail, bodies };
}
async function applyCandidate(f) {
  await assert.rejects(f.db.exec(block('invoker_readers_guard')), /MARKETPLACE_SAFETY_INVOKER_READER_DRIFT/,
    'the guard refuses to run while the invoker readers are not the DEV bodies');
  for (const match of blocks.slice(2)) await f.db.exec(match[0]);
}

test('fixture reproduces the DEV preimage exactly, and the candidate refuses a drifted preimage', async () => {
  const f = await fixture();
  try {
    assert.deepEqual(await f.bodies(), PREIMAGE);
    const qual = (await f.db.query("select md5(qual) m from pg_policies where policyname='needs_public_discovery'")).rows[0].m;
    assert.equal(qual, '7d2b4a721dfb96bc3a5cac893aefe939', 'policy deparse matches DEV');
    const acl = (await f.db.query("select proacl::text a from pg_proc where proname='rpc_submit_response'")).rows[0].a;
    assert.equal(acl, '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}');
    await f.db.exec("create or replace function public.rpc_reveal_contact(p_agreement_id uuid, p_channel text) returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $$ begin return null; end $$");
    await assert.rejects(f.db.exec(block('phone_reveal_closed')), /MARKETPLACE_SAFETY_PHONE_REVEAL_PREIMAGE_DRIFT/);
  } finally { await f.db.close(); }
});

test('candidate applies with exact postimages, keeps metadata and the rollback restores the preimage', async () => {
  const f = await fixture();
  try {
    await applyCandidate(f);
    assert.deepEqual(await f.bodies(), POSTIMAGE);
    const helper = (await f.db.query(`select proacl::text acl, prosecdef, proconfig::text cfg from pg_proc
      where oid = to_regprocedure('rls_private.viewer_block_counterparties()')`)).rows[0];
    assert.deepEqual(helper, { acl: '{postgres=X/postgres,authenticated=X/postgres}', prosecdef: true, cfg: '{search_path=pg_catalog}' });
    assert.ok((await f.db.query("select 1 from pg_indexes where indexname='account_blocks_blocked_active_idx' and indexdef like '%WHERE active%'")).rows.length);
    await assert.rejects(f.db.exec(block('block_helper')), /BLOCK_HELPER_PREIMAGE_DRIFT/, 'a second run is refused, not duplicated');
    await assert.rejects(f.db.exec(block('submit_withdrawn_final')), /SUBMIT_PREIMAGE_DRIFT/);
    await f.db.exec(rollback);
    assert.deepEqual(await f.bodies(), PREIMAGE);
    assert.equal((await f.db.query("select md5(qual) m from pg_policies where policyname='needs_public_discovery'")).rows[0].m, '7d2b4a721dfb96bc3a5cac893aefe939');
    assert.equal((await f.db.query("select to_regprocedure('rls_private.viewer_block_counterparties()') r")).rows[0].r, null);
  } finally { await f.db.close(); }
});

test('blocked pairs disappear from public task reads in both directions, silently', async () => {
  const f = await fixture();
  try {
    await applyCandidate(f);
    await f.db.query("insert into public.needs(id,status,requester_account_id) values ($1,'PUBLISHED',$2),($3,'SELECTION',$4)", [NEED, R, NEED_OTHER, OTHER]);
    const visible = async uid => {
      await f.as(uid); await f.db.exec('set role authenticated');
      try { return (await f.db.query('select id from public.needs order by id')).rows.map(row => row.id); }
      finally { await f.db.exec('reset role'); }
    };
    assert.deepEqual(await visible(W), [NEED, NEED_OTHER]);
    await f.db.query('insert into private.account_blocks(blocker_account_id, blocked_account_id) values ($1,$2)', [W, R]);
    assert.deepEqual(await visible(W), [NEED_OTHER], 'the blocker no longer sees the blocked requester');
    await f.db.query('update private.account_blocks set blocker_account_id=$2, blocked_account_id=$1', [W, R]);
    assert.deepEqual(await visible(W), [NEED_OTHER], 'the blocked worker no longer sees the blocker');
    assert.deepEqual(await visible(R), [NEED, NEED_OTHER], 'the owner still reads the own task through needs_owner_select');
    await f.db.query('update private.account_blocks set active=false');
    assert.deepEqual(await visible(W), [NEED, NEED_OTHER], 'an inactive block hides nothing');
    // Same rule as private.safety_pair_blocked for every ordered pair.
    await f.db.query('insert into private.account_blocks(blocker_account_id, blocked_account_id) values ($1,$2),($3,$1)', [W, R, W2]);
    for (const viewer of [R, W, W2, OTHER]) for (const other of [R, W, W2, OTHER]) {
      await f.as(viewer);
      const row = (await f.db.query('select $1::uuid = any(rls_private.viewer_block_counterparties()) a, private.safety_pair_blocked($2::uuid,$1::uuid) b', [other, viewer])).rows[0];
      assert.equal(row.a, row.b, `${viewer}->${other}`);
    }
    await f.as(W); await f.db.exec('set role anon');
    try { await assert.rejects(f.db.query('select rls_private.viewer_block_counterparties()'), /permission denied/); }
    finally { await f.db.exec('reset role'); }
  } finally { await f.db.close(); }
});

test('requester candidates omit a blocked worker before paging; cursor and total stay consistent', async () => {
  const f = await fixture();
  try {
    await applyCandidate(f);
    await f.db.query("insert into public.needs(id,status,requester_account_id,required_slots) values ($1,'PUBLISHED',$2,3)", [NEED, R]);
    const workers = [W, W2, OTHER];
    for (const [i, worker] of workers.entries()) {
      await f.db.query(`insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,status,submitted_at)
        values ($1,$2,$3,$4,'SUBMITTED', now() + ($5 || ' minutes')::interval)`, [ID(30 + i), NEED, worker, ID(40 + i), String(i)]);
    }
    await f.db.query('insert into private.account_blocks(blocker_account_id, blocked_account_id) values ($1,$2)', [W2, R]);
    await f.as(R);
    const list = (await f.db.query('select public.rpc_list_need_candidates($1) r', [NEED])).rows[0].r;
    assert.deepEqual(list.map(item => item.responseId), [ID(30), ID(32)]);
    const first = (await f.db.query('select public.rpc_list_need_candidates_page($1,1,null,null) r', [NEED])).rows[0].r;
    assert.deepEqual(first.items.map(item => item.responseId), [ID(30)]);
    assert.equal(first.hasMore, true); assert.equal(first.counts.total, 2);
    const last = first.items[0];
    const second = (await f.db.query('select public.rpc_list_need_candidates_page($1,1,$2,$3) r', [NEED, last.sortAt, last.responseId])).rows[0].r;
    assert.deepEqual(second.items.map(item => item.responseId), [ID(32)]);
    assert.equal(second.hasMore, false); assert.equal(second.counts, null);
    assert.ok(!JSON.stringify([list, first, second]).match(/block/i), 'no block reason is projected');
  } finally { await f.db.close(); }
});

test('a withdrawn application is final; replay, a legacy standing application and others pass the gate', async () => {
  const f = await fixture();
  try {
    await applyCandidate(f);
    await f.db.query("insert into public.needs(id,status,requester_account_id) values ($1,'PUBLISHED',$2)", [NEED, R]);
    await f.as(W);
    const passed = /NEED_EXECUTION_WINDOW_EXPIRED/;
    assert.match((await f.fail(SUBMIT, [NEED, ID(40), 'withdraw-test-1'])).message, passed, 'no application yet');
    await f.db.query("insert into public.marketplace_responses(id,need_id,worker_account_id,status,created_at) values ($1,$2,$3,'WITHDRAWN',now()-interval '1 hour')", [ID(30), NEED, W]);
    const refused = await f.fail(SUBMIT, [NEED, ID(40), 'withdraw-test-2']);
    assert.equal(refused.message, 'APPLICATION_WITHDRAWN_FINAL');
    assert.equal(refused.code, 'P0001');
    assert.equal(refused.hint, 'Povukli ste prijavu za ovaj zadatak. Ponovna prijava nije moguća.');
    assert.equal((await f.db.query('select count(*)::int c from public.marketplace_responses')).rows[0].c, 1, 'no write');
    // A DRAFT never counts as a sent application.
    await f.db.query("insert into public.marketplace_responses(id,need_id,worker_account_id,status,created_at) values ($1,$2,$3,'DRAFT',now())", [ID(31), NEED, W]);
    assert.equal((await f.fail(SUBMIT, [NEED, ID(40), 'withdraw-test-3'])).message, 'APPLICATION_WITHDRAWN_FINAL');
    // The idempotent replay of an earlier command returns before the gate.
    await f.db.query("insert into private.response_submit_commands values ($1,'withdraw-test-4',$2,$3,1,'{\"responseId\":\"x\"}')",
      [W, (await f.db.query(`select encode(sha256(convert_to(jsonb_build_object('needId',$1::uuid,'needRevision',1,'workerProfileId',$2::uuid,
        'coveredSlots',1,'priceRsd',1000,'proposedStartAt',null::timestamptz,'proposedEndAt',null::timestamptz,'scopeNote','')::text,'UTF8')),'hex') h`, [NEED, ID(40)])).rows[0].h, ID(30)]);
    assert.equal((await f.db.query(SUBMIT, [NEED, ID(40), 'withdraw-test-4'])).rows[0].r.idempotentReplay, true);
    // A legacy application sent again after a withdrawal (before this rule) can still be updated.
    await f.db.query("insert into public.marketplace_responses(id,need_id,worker_account_id,status,created_at) values ($1,$2,$3,'SUBMITTED',now()-interval '1 minute')", [ID(32), NEED, W]);
    assert.match((await f.fail(SUBMIT, [NEED, ID(40), 'withdraw-test-5'])).message, passed);
    // Another worker and another task are not affected.
    await f.as(W2);
    assert.match((await f.fail(SUBMIT, [NEED, ID(41), 'withdraw-test-6'])).message, passed);
    // The owner still gets OWN_NEED first.
    await f.as(R);
    assert.equal((await f.fail(SUBMIT, [NEED, ID(42), 'withdraw-test-7'])).message, 'OWN_NEED');
  } finally { await f.db.close(); }
});

test('phone sharing is closed server-side; revoke and EXACT_LOCATION paths are unchanged', async () => {
  const f = await fixture();
  const seed = async () => {
    await f.db.query("insert into public.needs(id,status,requester_account_id,title) values ($1,'SELECTION',$2,'Selidba')", [NEED, R]);
    await f.db.query("insert into public.app_profiles(id,account_id,kind,display_name) values ($1,$2,'REQUESTER','Ana'),($3,$4,'WORKER','Marko')", [ID(50), R, ID(51), W]);
    await f.db.query("insert into public.agreements(id,need_id,requester_account_id,worker_account_id,requester_profile_id,worker_profile_id,status) values ($1,$2,$3,$4,$5,$6,'CONFIRMED')", [AGR, NEED, R, W, ID(50), ID(51)]);
    await f.db.query("insert into public.agreement_versions values ($1,1,'{}')", [AGR]);
    await f.db.query("insert into public.app_accounts values ($1,'+381601111111'),($2,'+381602222222')", [R, W]);
    await f.db.query("insert into public.access_grants(agreement_id,channel,granted_by_account_id,granted_to_account_id,status,granted_at) values ($1,'PHONE',$2,$3,'GRANTED',now())", [AGR, R, W]);
  };
  try {
    await seed();
    await f.as(W);
    const before = (await f.db.query('select public.rpc_get_agreement_workspace($1) r', [AGR])).rows[0].r;
    assert.equal(before.theirPhone, '+381601111111', 'fixture proves the preimage leaked an older grant');
    await applyCandidate(f);
    const after = (await f.db.query('select public.rpc_get_agreement_workspace($1) r', [AGR])).rows[0].r;
    assert.ok(Object.hasOwn(after, 'theirPhone')); assert.equal(after.theirPhone, null);
    assert.equal(after.title, 'Selidba'); assert.deepEqual(after.actionState, {});
    assert.ok(!JSON.stringify(after).includes('+3816'), 'no phone anywhere in the workspace');
    const reveal = await f.fail("select public.rpc_reveal_contact($1,'PHONE')", [AGR]);
    assert.deepEqual([reveal.message, reveal.code], ['PHONE_SHARING_DISABLED', '42501']);
    await f.as(R);
    const grant = await f.fail("select public.rpc_set_contact_grant($1,'PHONE',true)", [AGR]);
    assert.deepEqual([grant.message, grant.code], ['PHONE_SHARING_DISABLED', '42501']);
    const revoke = (await f.db.query("select public.rpc_set_contact_grant($1,'PHONE',false) r", [AGR])).rows[0].r;
    assert.equal(revoke.granted, false); assert.equal(revoke.authoritative, true); assert.ok(revoke.grantId);
    assert.equal((await f.db.query("select status from public.access_grants where channel='PHONE'")).rows[0].status, 'REVOKED');
    // Other grant kinds keep their existing answers.
    assert.equal((await f.fail("select public.rpc_set_contact_grant($1,'EMAIL',true)", [AGR])).message, 'UNSUPPORTED_CHANNEL');
    await f.as(W);
    assert.equal((await f.fail("select public.rpc_set_contact_grant($1,'EXACT_LOCATION',true)", [AGR])).message, 'NOT_LOCATION_OWNER');
    assert.equal((await f.fail("select public.rpc_reveal_contact($1,'EXACT_LOCATION')", [AGR])).message, 'NO_ACTIVE_GRANT');
    await f.as(R);
    assert.equal((await f.fail("select public.rpc_set_contact_grant($1,'EXACT_LOCATION',true)", [AGR])).message, 'LOCATION_NOT_SET');
  } finally { await f.db.close(); }
});

// Client contract: the real adapters with only RPC transport and the session stubbed (same loader as r07 receipt tests).
function loadClient(rpcError) {
  const session = { user: { id: ID(1) }, accountRevision: 1 };
  const calls = [];
  const wire = { rpc: async (name, args) => { calls.push(name); return name.startsWith('rpc_read_') ? { data: null, error: { message: 'offline' } } : { data: null, error: rpcError }; } };
  const stubs = { 'src/data/supabaseClient.ts': { supabaseKlijent: () => wire }, 'src/store/sesija.ts': { sesijaSada: () => session } };
  const cache = new Map();
  function load(relative) {
    if (stubs[relative]) return stubs[relative];
    if (cache.has(relative)) return cache.get(relative).exports;
    const filename = path.join(ROOT, relative);
    const module = { exports: {} }; cache.set(relative, module);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const localRequire = specifier => {
      if (!specifier.startsWith('.')) return require(specifier);
      const base = path.resolve(path.dirname(filename), specifier);
      const resolved = ['', '.ts', '.tsx', '.js', '/index.ts'].map(suffix => base + suffix)
        .find(item => fs.existsSync(item) && fs.statSync(item).isFile());
      assert.ok(resolved, `${relative}: ${specifier}`);
      return load(path.relative(ROOT, resolved).replaceAll(path.sep, '/'));
    };
    new Function('require', 'module', 'exports', compiled.outputText)(localRequire, module, module.exports);
    return module.exports;
  }
  return { service: load('src/data/applicationSelectionClientService.ts'), relation: load('src/data/taskRelation.ts'), calls };
}
const submitCommand = { potrebaId: ID(2), potrebaRevizija: 3, radnikProfilId: ID(3), pokrivenaMesta: 1, cenaRsd: 1200,
  predlozeniPocetak: null, predlozeniKraj: null, napomena: null, clientRequestId: 'marketplace-safety-1' };
const selectCommand = { potrebaId: ID(2), potrebaRevizija: 3, prijavaId: ID(4), prijavaVerzija: 1, prijavaHash: 'a'.repeat(64),
  mesta: 1, clientRequestId: 'marketplace-safety-2' };

test('client settles the withdrawn and the DEV-verified price/window codes as conclusive submit refusals', async () => {
  for (const [kod, code] of [['APPLICATION_WITHDRAWN_FINAL', 'P0001'], ['INVALID_PRICE', '22023'], ['FIXED_PRICE_NOT_READY', 'P0001'],
    ['FIXED_PRICE_MISMATCH', '22023'], ['UNKNOWN_PRICE_BASIS', '22023'], ['FIXED_WINDOW_START_PASSED', '22023']]) {
    const h = loadClient({ message: kod, code });
    const result = await h.service.applicationSelectionClientService.podnesiPrijavu(submitCommand);
    assert.equal(result.ok, false); assert.equal(result.kod, kod, kod);
    assert.equal(h.service.conclusiveApplicationRefusal(result), true, kod);
    assert.deepEqual(h.calls, ['rpc_submit_response'], `${kod} needs no readback`);
    assert.doesNotMatch(result.poruka, /\b(ti|tvoj|tvoja|možeš|pokušaj|osveži)\b/i, `${kod} keeps Vi/Vam/Vas`);
  }
  const h = loadClient({ message: 'APPLICATION_WITHDRAWN_FINAL', code: 'P0001' });
  assert.equal((await h.service.applicationSelectionClientService.podnesiPrijavu(submitCommand)).poruka,
    'Povukli ste prijavu za ovaj zadatak. Ponovna prijava nije moguća.');
  // A matching message without its SQLSTATE stays an unknown outcome.
  const wrong = loadClient({ message: 'APPLICATION_WITHDRAWN_FINAL', code: '22023' });
  const unknown = await wrong.service.applicationSelectionClientService.podnesiPrijavu(submitCommand);
  assert.equal(wrong.service.conclusiveApplicationRefusal(unknown), false);
});

test('client settles RESPONSE_VERSION_NOT_FOUND and RESPONSE_NEED_MISMATCH as conclusive selection refusals', async () => {
  for (const [kod, code] of [['RESPONSE_VERSION_NOT_FOUND', 'P0002'], ['RESPONSE_NEED_MISMATCH', 'P0001']]) {
    const h = loadClient({ message: kod, code });
    const result = await h.service.applicationSelectionClientService.izaberiPrijavu(selectCommand);
    assert.equal(result.kod, kod); assert.equal(h.service.conclusiveSelectionRefusal(result), true);
    assert.ok(result.poruka.length > 0);
    const wrong = loadClient({ message: kod, code: '22023' });
    assert.equal(wrong.service.conclusiveSelectionRefusal(await wrong.service.applicationSelectionClientService.izaberiPrijavu(selectCommand)), false);
  }
});

test('a withdrawn newest application is its own relation, never NONE and never APPLIED', () => {
  const { relation } = loadClient(null);
  const item = state => ({ needId: ID(2), relation: 'APPLIED', applicationId: ID(4), applicationState: state, agreementId: null });
  assert.deepEqual(relation.taskRelationIndex([item('WITHDRAWN')], [ID(2)]).relation(ID(2)), { kind: 'WITHDRAWN', applicationId: ID(4) });
  assert.equal(relation.taskRelationIndex([item('WITHDRAWN')], [ID(2)]).applied.has(ID(2)), false);
  assert.deepEqual(relation.taskRelationIndex([item('CLOSED')], [ID(2)]).relation(ID(2)), { kind: 'NONE' });
  assert.equal(relation.taskRelationIndex([item('SUBMITTED')], [ID(2)]).relation(ID(2)).kind, 'APPLIED');
  const screen = fs.readFileSync(path.join(ROOT, 'src/app/(app)/prilike/[id].tsx'), 'utf8');
  assert.match(screen, /relation\.kind !== 'NONE'\) return;/, 'compose stays closed for anything but NONE');
  assert.match(screen, /canApply=\{[^}]*relation\.kind === 'NONE'\}/);
  const presentation = fs.readFileSync(path.join(ROOT, 'src/ui/v2/PublicNeedPresentation.tsx'), 'utf8');
  assert.match(presentation, /WITHDRAWN_FINAL_TEXT = 'Povukli ste prijavu za ovaj zadatak\. Ponovna prijava nije moguća\.'/);
  assert.match(presentation, /relation\.kind === 'WITHDRAWN'\s*\? <FlowFooter reason=\{WITHDRAWN_FINAL_TEXT\}>/);
});
