'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const candidate = read('scripts/sql/geo_privacy_20261121.candidate.sql');
const rollback = read('scripts/sql/rollback_geo_privacy_preimage_20261121.sql');
const doBlocks = sql => [...sql.matchAll(/DO \$([A-Za-z0-9_]+)\$[\s\S]*?END\s*\$\1\$;/g)];
const blocks = doBlocks(candidate);
const tags = blocks.map(m => m[1]);
const rollbackBlocks = doBlocks(rollback);
const md5 = text => crypto.createHash('md5').update(text, 'utf8').digest('hex');
const sanitizerSql = candidate.slice(candidate.indexOf('-- GEO_PRIVACY_SANITIZER_FUNCTIONS_START'),
  candidate.indexOf('-- GEO_PRIVACY_SANITIZER_FUNCTIONS_END'));

// Read-only DEV snapshot (leqcwgzvjsxugfgzdmth, 2026-11-21): live preimage, proven postimage (md5(replace(prosrc))).
const DEV = {
  patch_normalize_location_point: { sig: 'private.normalize_location_point(jsonb)', pre: '4474c1c9e96f4dd8993992a566fe883e', post: '4f88e8d4655d56227b23d6a576998a8a', acl: '{postgres=X/postgres}', secdef: false },
  patch_resolved_location_binding_grid: { sig: 'private.check_need_resolved_location_binding()', pre: '002e289036ba9e6bce3592c83fb22824', post: '4ff95e9d5235ceb8c688f0de86a6a8da', acl: '{postgres=X/postgres}', secdef: true },
  patch_materialize_grid: { sig: 'private.materialize_resolved_location(uuid,uuid)', pre: 'cee9fed5ae6fecad3de73e1537bbac99', post: '77f9d093b970774413047dd2ebd4780c', acl: '{postgres=X/postgres}', secdef: true },
  patch_worker_location_grid: { sig: 'public.rpc_save_worker_location(text,jsonb,boolean)', pre: '12b4505d1f6a5f97053a48ed72128af3', post: 'fce3b8b96bbf2e0f35bd4dc9f5c8d6dc', acl: '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}', secdef: true },
  patch_worker_ai_position_grid: { sig: 'private.worker_ai_patch(jsonb,jsonb,uuid,uuid,boolean)', pre: '72c241bc11a844f9e5779f046bb56e20', post: '85b617d8d64cc542b452f7129ddc11ae', acl: '{postgres=X/postgres}', secdef: true },
  patch_discovery_point_grid: { sig: 'public.rpc_discovery_v1(jsonb)', pre: 'dc53bf4f14b1e35fdb1e12ff883d1edb', post: '52bbc64250f09bc3287aec07eda3484a', acl: '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}', secdef: false },
  patch_draft_writer_sanitize: { sig: 'public.rpc_save_need_draft_from_review(uuid,uuid,text)', pre: '39a3d39e60e8ab42f7e0269aba965280', post: 'ffa8678d643a72ace3cad2c321a4210b', acl: '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}', secdef: true },
  patch_edit_writer_sanitize: { sig: 'public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)', pre: '4742520f9660b9ecabbe4a165a660eb5', post: '82a6a99c52610f31232461b0e8e19741', acl: '{postgres=X/postgres,service_role=X/postgres}', secdef: true },
  patch_replacement_writer_sanitize: { sig: 'private.stage_task_replacement(uuid,uuid,text,jsonb)', pre: 'fd9e9aae4ed6de23207d0c07c5c41941', post: '0aafb04eceffd3c9d1efbb329028210e', acl: '{postgres=X/postgres}', secdef: true },
};
const block = (list, tag) => list.find(m => m[1] === tag)?.[0] ?? '';

async function sanitizerDb() {
  const db = new PGlite();
  await db.exec(`create schema private; create schema auth;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
    create function private.closure_redaction_allowed_v5(rel oid, op text, b jsonb, a jsonb) returns boolean language sql as $$ select false $$;`);
  await db.exec(sanitizerSql);
  return db;
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

test('geo privacy SQL stays explicitly source-only and fail-closed', () => {
  assert.match(candidate, /SOURCE-ONLY CANDIDATE/);
  assert.equal(tags[0], 'source_only');
  assert.match(blocks[0][0], /GEO_PRIVACY_20261121_SOURCE_ONLY/);
  assert.ok(candidate.indexOf('DO $source_only$') < candidate.indexOf('\nBEGIN;'));
  assert.ok(candidate.trimEnd().endsWith('-- GEO_PRIVACY_20261121_ISOLATED_END'));
  assert.equal(new Set(tags).size, tags.length, 'each guarded block has a unique name');
  for (const tag of ['new_function_guard', 'new_function_postimage', 'geography_sanitize_trigger', 'backfill_existing_rows', 'postflight', ...Object.keys(DEV)])
    assert.ok(tags.includes(tag), `missing block ${tag}`);
  assert.doesNotMatch(candidate, /\bDELETE\s+FROM\b/i, 'existing rows are rewritten, never deleted');
  assert.doesNotMatch(candidate, /\bTRUNCATE\b|\bDROP\s+(TABLE|TRIGGER)\b/i);
  assert.match(rollback, /SOURCE-ONLY/);
  assert.equal(rollbackBlocks[0][1], 'source_only');
  assert.ok(rollback.indexOf('DO $source_only$') < rollback.indexOf('\nBEGIN;'));
});

test('every patch pins the read-only DEV preimage metadata and the proven postimage', () => {
  for (const [tag, dev] of Object.entries(DEV)) {
    const b = block(blocks, tag);
    assert.ok(b.includes(`'${dev.sig}'::regprocedure`), `${tag} target`);
    assert.ok(b.includes(`actual.acl IS DISTINCT FROM '${dev.acl}'`), `${tag} ACL`);
    assert.ok(b.includes(`actual.prosecdef IS DISTINCT FROM ${dev.secdef}`), `${tag} SECURITY DEFINER`);
    assert.ok(b.includes(`actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]`), `${tag} search_path`);
    assert.ok(b.includes(`IS DISTINCT FROM '${dev.pre}' THEN RAISE EXCEPTION`), `${tag} preimage md5`);
    assert.ok(b.includes(`body_md5 = '${dev.post}'`) && b.includes(`IS DISTINCT FROM '${dev.post}'`), `${tag} postimage md5`);
    assert.match(b, /IS DISTINCT FROM 2 THEN\s+RAISE EXCEPTION '[A-Z_]+_ANCHOR_DRIFT'/, `${tag} unique anchor`);
    const rb = block(rollbackBlocks, 'rollback_' + tag);
    assert.ok(rb.includes(`body_md5 = '${dev.pre}'`) && rb.includes(`IS DISTINCT FROM '${dev.post}' THEN RAISE EXCEPTION`),
      `rollback_${tag} must restore the exact DEV preimage`);
  }
  for (const tag of ['patch_draft_writer_sanitize', 'patch_edit_writer_sanitize', 'patch_replacement_writer_sanitize'])
    assert.ok(block(blocks, tag).includes("v_geo:=private.public_topology_sanitize(v_facts->'need.task_geography');"));
  assert.match(block(blocks, 'patch_normalize_location_point'), /return private\.public_location_point_sanitize\(result\);/);
  assert.match(block(blocks, 'patch_materialize_grid'), /approximate_lat=round\(round\(\(anchor->>'latitudeE6'\)::numeric\/2000\)\/500,3\)/);
  assert.match(block(rollbackBlocks, 'rollback_patch_resolved_location_binding_grid'), /GRID_KEPT_FOR_GRID_ROWS/,
    'rollback keeps the tolerant binding check while 0.002-degree rows exist');
});

test('rollback reference preimages are byte-exact DEV definitions', () => {
  const refs = [...rollback.matchAll(/-- (\S+) \| md5=([0-9a-f]{32})[\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/g)];
  assert.equal(refs.length, 4);
  for (const [, sig, pinned, body] of refs) {
    const dev = Object.values(DEV).find(d => d.sig === sig);
    assert.ok(dev, sig);
    assert.equal(pinned, dev.pre);
    assert.equal(md5(body), dev.pre, `${sig} reference text must hash to the DEV preimage`);
  }
});

test('all guarded candidate and rollback blocks parse as PostgreSQL 17 PL/pgSQL', async () => {
  const db = new PGlite();
  const syntaxError = /syntax error|unterminated dollar-quoted|invalid dollar-quoted|mismatched parentheses/i;
  try {
    await db.exec("BEGIN; SET LOCAL lock_timeout = '2s'; SET LOCAL statement_timeout = '60s'; ROLLBACK;");
    await db.exec('create schema private; create schema auth;');
    await db.exec(sanitizerSql);
    for (const [label, list] of [['candidate', blocks], ['rollback', rollbackBlocks]]) {
      for (const b of list) {
        if (b[1] === 'source_only') continue;
        try { await db.exec(b[0]); } catch (error) {
          assert.doesNotMatch(String(error?.message || error), syntaxError, `${label} ${b[1]}`);
        }
      }
    }
  } finally { await db.close(); }
});

test('the four small patches apply and roll back exactly on PG17 from the verbatim DEV preimages', async () => {
  const db = new PGlite();
  try {
    await db.exec(`set check_function_bodies = off; create schema private; create schema auth;
      do $r$ begin create role authenticated; create role service_role; exception when duplicate_object then null; end $r$;`);
    await db.exec(sanitizerSql);
    // Live DEV body of private.location_text_valid(jsonb,integer) (md5 3ec40250cfbe356ee0847c6ecccf157e).
    await db.exec(`create function private.location_text_valid(value jsonb, max_length integer) returns boolean
      language sql immutable set search_path to 'pg_catalog' as $f$
  select jsonb_typeof(value)='string' and length(btrim(value#>>'{}')) between 1 and max_length
    and not (value#>>'{}' ~ '[[:cntrl:]]');
$f$;`);
    const refs = rollback.slice(rollback.indexOf('/* Reference only'));
    for (const m of refs.matchAll(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$[\s\S]*?\$function\$;/g)) await db.exec(m[0]);
    for (const sig of ['private.normalize_location_point(jsonb)', 'private.check_need_resolved_location_binding()', 'private.materialize_resolved_location(uuid,uuid)'])
      await db.exec(`revoke all on function ${sig} from public;`);
    await db.exec(`revoke all on function public.rpc_save_worker_location(text,jsonb,boolean) from public;
      grant execute on function public.rpc_save_worker_location(text,jsonb,boolean) to authenticated;
      grant execute on function public.rpc_save_worker_location(text,jsonb,boolean) to service_role;`);
    const small = ['patch_normalize_location_point', 'patch_resolved_location_binding_grid', 'patch_materialize_grid', 'patch_worker_location_grid'];
    const hash = async tag => (await one(db, `select md5(prosrc) m from pg_proc where oid='${DEV[tag].sig}'::regprocedure`)).m;
    for (const tag of small) assert.equal(await hash(tag), DEV[tag].pre, `${tag} fixture preimage`);
    for (const tag of small) { await db.exec(block(blocks, tag)); assert.equal(await hash(tag), DEV[tag].post, `${tag} postimage`); }
    for (const tag of small) await db.exec(block(blocks, tag)); // idempotent re-run: ALREADY_APPLIED
    assert.equal((await one(db, `select private.normalize_location_point('{"label":"Omladinskih brigada 11","city":"Beograd"}') v`)).v.label, 'Omladinskih brigada');
    for (const tag of small) {
      const rb = block(rollbackBlocks, 'rollback_' + tag).replace(/IF EXISTS \(SELECT 1 FROM public\.needs[\s\S]*?END IF;\n/, '');
      await db.exec(rb);
      assert.equal(await hash(tag), DEV[tag].pre, `rollback_${tag} restores the preimage`);
    }
  } finally { await db.close(); }
});

test('sanitizer removes house numbers and keeps public place names', async () => {
  const db = await sanitizerDb();
  try {
    const cases = [
      ['Omladinskih brigada 11, Beograd', 'Omladinskih brigada, Beograd'],
      ['Omladinskih brigada 11', 'Omladinskih brigada'],
      ['Bulevar oslobođenja 12a', 'Bulevar oslobođenja'],
      ['Novi Sad', 'Novi Sad'],
      ['Ušće, Bulevar Mihajla Pupina 4, 11070 Novi Beograd', 'Ušće, Bulevar Mihajla Pupina, 11070 Novi Beograd'],
      ['Pošta 21000, Novi Sad', 'Pošta 21000, Novi Sad'],
      ['Bulevar 27. marta 15', 'Bulevar 27. marta'],
      ['Blok 45, Novi Beograd', 'Blok 45, Novi Beograd'],
      ['Dositejeva 5-7, Novi Sad', 'Dositejeva, Novi Sad'],
      ['Kralja Petra I 12/3', 'Kralja Petra I'],
      ['Zmaj Jovina br. 5, ulaz 2', 'Zmaj Jovina'],
      ['Улица Краља Милана 4а, Београд', 'Улица Краља Милана, Београд'],
      ['Autoput E-75', 'Autoput E-75'],
      ['Beogradska arena', 'Beogradska arena'],
      ['44.8176, 20.4569', ''],
    ];
    for (const [input, expected] of cases) {
      const { v } = await one(db, 'select private.public_location_text_sanitize($1) v', [input]);
      assert.equal(v, expected, input);
      assert.equal((await one(db, 'select private.public_location_text_sanitize($1) v', [v])).v, v, `idempotent: ${input}`);
    }
    const dev = { mode: 'POINT_TO_POINT',
      start: { area: 'Novi Beograd', city: 'Beograd', label: 'Omladinskih brigada 11' },
      end: { area: 'Novi Beograd', city: 'Beograd', label: 'Omladinskih brigada' } };
    const { t } = await one(db, 'select private.public_topology_sanitize($1::jsonb) t', [JSON.stringify(dev)]);
    assert.deepEqual(t, { ...dev, start: { ...dev.start, label: 'Omladinskih brigada' } }, 'A->B keeps both points');
    assert.deepEqual((await one(db, `select private.public_topology_sanitize('{"mode":"REMOTE"}') t`)).t, { mode: 'REMOTE' });
    const multi = { mode: 'MULTI_STOP', start: { city: 'Novi Sad', label: 'Dositejeva 5' },
      waypoints: [{ label: 'Pošta, Bulevar oslobođenja 100' }, { city: 'Novi Sad' }], end: { label: 'Liman', city: 'Novi Sad' } };
    const m = (await one(db, 'select private.public_topology_sanitize($1::jsonb) t', [JSON.stringify(multi)])).t;
    assert.deepEqual(m.waypoints, [{ label: 'Pošta, Bulevar oslobođenja' }, { city: 'Novi Sad' }]);
    assert.equal(m.start.label, 'Dositejeva');
    assert.deepEqual((await one(db, `select private.public_location_point_sanitize('{"label":"11","city":"Beograd"}') p`)).p, { city: 'Beograd' });
    await assert.rejects(db.query(`select private.public_location_point_sanitize('{"label":"11"}')`), /LOCATION_PUBLIC_LABEL_INVALID/);
  } finally { await db.close(); }
});

test('need_geography trigger sanitizes every writer before the row is stored', async () => {
  const db = await sanitizerDb();
  try {
    await db.exec(`create table public.need_geography(need_id uuid primary key, public_topology jsonb not null, updated_at timestamptz);
      create trigger need_geography_public_topology_sanitize_trg before insert or update of public_topology on public.need_geography
        for each row execute function private.sanitize_need_geography_public_topology();`);
    const id = '2c9ab936-7e9c-49a7-98f3-716ae92001eb';
    await db.query('insert into public.need_geography(need_id, public_topology) values ($1, $2::jsonb)',
      [id, JSON.stringify({ mode: 'STATIONARY', start: { label: 'Omladinskih brigada 11, Beograd', city: 'Beograd' } })]);
    assert.equal((await one(db, 'select public_topology->\'start\'->>\'label\' l from public.need_geography')).l, 'Omladinskih brigada, Beograd');
    await db.query(`insert into public.need_geography(need_id, public_topology) values ($1, $2::jsonb)
      on conflict(need_id) do update set public_topology=excluded.public_topology`,
      [id, JSON.stringify({ mode: 'STATIONARY', start: { label: 'Bulevar oslobođenja 12a', area: 'Liman' } })]);
    assert.deepEqual((await one(db, 'select public_topology t from public.need_geography')).t,
      { mode: 'STATIONARY', start: { label: 'Bulevar oslobođenja', area: 'Liman' } });
  } finally { await db.close(); }
});

test('backfill rewrites existing public labels and the binding copy without deletes, idempotently', async () => {
  const db = await sanitizerDb();
  try {
    await db.exec(`set check_function_bodies = off;
      do $r$ begin create role anon; create role authenticated; create role service_role; exception when duplicate_object then null; end $r$;
      create function private.location_text_valid(value jsonb, max_length integer) returns boolean language sql immutable as $f$
        select jsonb_typeof(value)='string' and length(btrim(value#>>'{}')) between 1 and max_length and not (value#>>'{}' ~ '[[:cntrl:]]') $f$;
      create function private.closure_account_restricted(a uuid) returns boolean language sql as $f$ select false $f$;
      -- Reduced copy of DEV private.normalize_task_geography(jsonb) (md5 988e8443...): same output, mode/shape validation omitted.
      create function private.normalize_task_geography(value jsonb) returns jsonb language plpgsql immutable as $f$
      declare mode text; a jsonb; b jsonb; area jsonb; points jsonb:='[]'; item jsonb; result jsonb;
      begin
        mode:=value->>'mode';
        a:=private.normalize_location_point(value->'start'); b:=private.normalize_location_point(value->'end');
        area:=private.normalize_location_point(value->'serviceArea');
        if value->'waypoints' is not null and value->'waypoints'<>'null'::jsonb then
          for item in select x from jsonb_array_elements(value->'waypoints') x loop
            points:=points||jsonb_build_array(private.normalize_location_point(item)); end loop; end if;
        result:=jsonb_build_object('mode',mode);
        if a is not null then result:=result||jsonb_build_object('start',a); end if;
        if b is not null then result:=result||jsonb_build_object('end',b); end if;
        if area is not null then result:=result||jsonb_build_object('serviceArea',area); end if;
        if points<>'[]'::jsonb then result:=result||jsonb_build_object('waypoints',points); end if;
        return result;
      end $f$;
      create table public.needs(id uuid primary key, requester_account_id uuid);
      create table public.need_geography(need_id uuid primary key, public_topology jsonb not null, updated_at timestamptz);
      create table public.need_sensitive(need_id uuid primary key, resolved_location jsonb);
      create function private.guard_need_resolved_location_write() returns trigger language plpgsql as $f$
        begin raise exception 'LOCATION_REVIEW_NOT_EDITABLE'; end $f$;
      create trigger guard_need_resolved_location_write_trg before insert or update on public.need_sensitive
        for each row execute function private.guard_need_resolved_location_write();
      create trigger need_geography_public_topology_sanitize_trg before insert or update of public_topology on public.need_geography
        for each row execute function private.sanitize_need_geography_public_topology();`);
    // Preimage normalize_location_point (DEV) then the candidate patch, so the binding normalizer sanitizes too.
    const refs = rollback.slice(rollback.indexOf('/* Reference only'));
    await db.exec(refs.match(/CREATE OR REPLACE FUNCTION private\.normalize_location_point[\s\S]*?\$function\$[\s\S]*?\$function\$;/)[0]);
    await db.exec("revoke all on function private.normalize_location_point(jsonb) from public;");
    await db.exec(block(blocks, 'patch_normalize_location_point'));
    const ids = ['2c9ab936-7e9c-49a7-98f3-716ae92001eb', 'bd981b8b-f59b-4235-b2a2-97e71a5e3b6a', '10f41318-103a-4a24-b107-aafd1b2e0d92'];
    const raw = { mode: 'POINT_TO_POINT', end: { area: 'Novi Beograd', city: 'Beograd', label: 'Omladinskih brigada' },
      start: { area: 'Novi Beograd', city: 'Beograd', label: 'Omladinskih brigada 11' } };
    const clean = { ...raw, start: { ...raw.start, label: 'Omladinskih brigada' } };
    const poi = { mode: 'STATIONARY', start: { area: 'Novi Beograd', city: 'Beograd', label: 'Beogradska arena' } };
    const rl = geo => ({ value: { version: 1, binding: { taskCountryCode: 'RS', geography: geo, exactAddress: null },
      points: [{ slot: 'start', latitudeE6: 44812345, longitudeE6: 20401234, origin: { kind: 'MANUAL_PIN' } }] },
      confirmedByAccountId: 'acc', confirmedAt: '2026-11-01T00:00:00Z' });
    await db.exec('alter table public.need_geography disable trigger need_geography_public_topology_sanitize_trg;');
    for (const [id, geo] of [[ids[0], raw], [ids[1], poi], [ids[2], { mode: 'REMOTE' }]]) {
      await db.query('insert into public.needs values ($1, $1)', [id]);
      await db.query('insert into public.need_geography(need_id, public_topology) values ($1, $2)', [id, JSON.stringify(geo)]);
    }
    await db.exec('alter table public.need_geography enable trigger need_geography_public_topology_sanitize_trg;');
    await db.exec('alter table public.need_sensitive disable trigger guard_need_resolved_location_write_trg;');
    await db.query('insert into public.need_sensitive values ($1, $2), ($3, $4)', [ids[0], JSON.stringify(rl(raw)), ids[1], JSON.stringify(rl(poi))]);
    await db.exec('alter table public.need_sensitive enable trigger guard_need_resolved_location_write_trg;');
    const backfill = block(blocks, 'backfill_existing_rows');
    await db.exec(backfill);
    const geo = Object.fromEntries((await db.query('select need_id, public_topology t from public.need_geography')).rows.map(r => [r.need_id, r.t]));
    assert.deepEqual(geo[ids[0]], clean, 'house number removed, A->B keeps both points');
    assert.deepEqual(geo[ids[1]], poi); assert.deepEqual(geo[ids[2]], { mode: 'REMOTE' });
    const sens = Object.fromEntries((await db.query('select need_id, resolved_location r from public.need_sensitive')).rows.map(r => [r.need_id, r.r]));
    assert.deepEqual(sens[ids[0]], rl(clean), 'binding copy follows the sanitized geography; exact points untouched');
    assert.deepEqual(sens[ids[1]], rl(poi));
    const pre = (await db.query('select need_id, public_topology t from private.geo_privacy_20261121_preimage')).rows;
    assert.deepEqual(pre.map(r => r.need_id), [ids[0]]); assert.deepEqual(pre[0].t, raw, 'raw preimage kept privately');
    assert.equal((await one(db, `select count(*)::int c from public.need_geography`)).c, 3, 'no deletes');
    assert.equal((await one(db, `select tgenabled from pg_trigger where tgname='guard_need_resolved_location_write_trg'`)).tgenabled, 'O');
    await db.exec(backfill); // idempotent: nothing left to change
    assert.equal((await db.query('select * from private.geo_privacy_20261121_preimage')).rows.length, 1);
    assert.deepEqual((await one(db, 'select resolved_location r from public.need_sensitive where need_id=$1', [ids[0]])).r, rl(clean));
  } finally { await db.close(); }
});

const modules = new Map();
function load(relative) {
  const file = path.resolve(ROOT, relative + '.ts');
  if (modules.has(file)) return modules.get(file).exports;
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  assert.deepEqual(out.diagnostics, []);
  const mod = { exports: {} }; modules.set(file, mod);
  new Function('require', 'module', 'exports', out.outputText)(require, mod, mod.exports);
  return mod.exports;
}

test('public grid displaces at most ~200 m and is never finer than ~100 m (SQL and client agree)', async () => {
  const { toPublicGrid, isPublicGrid } = load('src/lib/publicGrid');
  const R = 6371008.8, rad = Math.PI / 180;
  const meters = (a, b, c, d) => { const x = (d - b) * rad * Math.cos((a + c) / 2 * rad), y = (c - a) * rad; return Math.hypot(x, y) * R; };
  const db = new PGlite();
  try {
    let worst = 0, seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const samples = [[44.8125, 20.4612], [45.2671, 19.8335], [42.2300, 22.1000], [46.1800, 19.6600]];
    for (let i = 0; i < 400; i++) samples.push([41.8 + rnd() * 4.5, 18.8 + rnd() * 4.3]);
    for (const [lat, lng] of samples) {
      const latE6 = Math.round(lat * 1e6), lngE6 = Math.round(lng * 1e6);
      const row = await one(db, 'select round(round($1::numeric/2000)/500,3)::text a, round(round($2::numeric/2000)/500,3)::text b', [latE6, lngE6]);
      const gl = Number(row.a), gg = Number(row.b);
      assert.equal(gl, toPublicGrid(latE6 / 1e6)); assert.equal(gg, toPublicGrid(lngE6 / 1e6));
      assert.ok(isPublicGrid(gl) && isPublicGrid(gg));
      worst = Math.max(worst, meters(latE6 / 1e6, lngE6 / 1e6, gl, gg));
    }
    assert.ok(worst <= 200, `max displacement ${worst.toFixed(1)} m`);
    assert.ok(worst > 100, 'the grid is coarse enough that the true point is not recoverable');
    for (const lat of [42, 44, 46]) {
      assert.ok(meters(lat, 20, lat + 0.002, 20) >= 100, 'north-south cell ≥ 100 m');
      assert.ok(meters(lat, 20, lat, 20.002) >= 100, 'east-west cell ≥ 100 m');
    }
    assert.ok(isPublicGrid(45.26) && isPublicGrid(19.8) && isPublicGrid(45.256), 'legacy 0.01 points remain valid');
    assert.ok(!isPublicGrid(45.2561) && !isPublicGrid(45.257), 'finer than the grid is rejected');
    const v = await one(db, `select (45.257*500<>round(45.257*500)) finer, (45.26*500<>round(45.26*500)) legacy, (45.256*500<>round(45.256*500)) grid`);
    assert.deepEqual(v, { finer: true, legacy: false, grid: false }, 'server validators use the same grid');
  } finally { await db.close(); }
});

test('client coarse paths use the shared ~200 m grid instead of 2-decimal rounding', () => {
  const files = ['src/data/discoveryV1Contract.ts', 'src/data/discoveryV1SpatialContract.ts', 'src/data/discoveryV1Owner.ts',
    'src/data/discoveryWorkArea.ts', 'src/data/marketplaceView.ts', 'src/data/supabaseIzvor.ts', 'src/data/workerAiClientService.ts',
    'src/lib/location.ts', 'src/ui/location/locationMapLinks.ts', 'src/ui/location/LocationOverviewMap.types.ts', 'src/ui/location/ResolvedPinMap.types.ts'];
  for (const f of files) {
    const s = read(f);
    assert.doesNotMatch(s, /toFixed\(2\)|\*\s*100\)\s*\/\s*100/, `${f} must not re-round public points to 0.01°`);
    assert.match(s, /from '(\.\.\/)+lib\/publicGrid'|from '\.\/publicGrid'/, `${f} uses the shared grid`);
  }
  assert.doesNotMatch(read('src/contracts/projections.ts'), /~1km/);
});
