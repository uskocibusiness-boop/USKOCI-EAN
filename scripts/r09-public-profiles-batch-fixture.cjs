'use strict';
// Captured public reader plus the actual wrapper execute in isolated PostgreSQL.
// Auth.uid and closure/safety/world/reputation dependencies are explicit fixture
// seams. This is not a hosted JWT/RLS audit or a database capacity benchmark.
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const ROOT = path.resolve(__dirname, '..');
const preimage = JSON.parse(fs.readFileSync(path.join(__dirname, 'sql/r09_public_profiles_batch_20261108.preimage.json'), 'utf8'));
const candidate = fs.readFileSync(path.join(__dirname, 'sql/r09_public_profiles_batch_20261108.sql'), 'utf8');
const id = n => `90000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ACTOR = id(90001), OTHER = id(90002);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function sqlFixture({ apply = true } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,service_role,anon;
    grant execute on function auth.uid() to authenticated,service_role,anon;
    create table private.fixture_accounts(id uuid primary key, world text not null default 'main', closed boolean not null default false,
      reputation jsonb not null default '{"averageRating":4.5,"reviewCount":2}');
    create table private.fixture_blocks(actor uuid, target uuid);
    create table public.app_profiles(id uuid primary key,account_id uuid,profile_status text,kind text,
      display_name text,avatar_path text,city text,headline text,bio text,private_phone text);
    create table public.agreements(id uuid primary key,requester_profile_id uuid,worker_profile_id uuid,status text);
    alter table public.app_profiles enable row level security;
    grant select on public.app_profiles to authenticated;
    create function private.closure_account_restricted(uuid) returns boolean language sql stable as $$
      select coalesce((select closed from private.fixture_accounts where id=$1),true) $$;
    create function private.safety_pair_blocked(uuid,uuid) returns boolean language sql stable as $$
      select exists(select 1 from private.fixture_blocks where actor=$1 and target=$2 or actor=$2 and target=$1) $$;
    create function private.accounts_same_world(uuid,uuid) returns boolean language sql stable as $$
      select (select world from private.fixture_accounts where id=$1)=(select world from private.fixture_accounts where id=$2) $$;
    create function private.account_reputation(uuid) returns jsonb language sql stable as $$
      select reputation from private.fixture_accounts where id=$1 $$;
    revoke all on schema private from public,anon,authenticated,service_role;
  `);
  await db.exec(preimage.definition);
  await db.exec(`revoke all on function public.rpc_get_public_profile(uuid) from public,anon,authenticated,service_role;
    grant execute on function public.rpc_get_public_profile(uuid) to service_role,authenticated;`);
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const value = async (sql, args = []) => (await query(sql, args))[0]?.value;
  const metadata = signature => value(`select jsonb_build_object('body_md5',md5(prosrc),'definer',prosecdef,'volatility',provolatile,
    'owner',pg_get_userbyid(proowner),'config',proconfig,'acl',proacl::text) as value from pg_proc where oid=to_regprocedure($1)`, [signature]);
  assert.deepEqual(await metadata('public.rpc_get_public_profile(uuid)'), {
    body_md5: preimage.body_md5, definer: preimage.definer, volatility: preimage.volatility,
    owner: preimage.owner, config: preimage.config, acl: preimage.acl,
  });
  await db.query('insert into private.fixture_accounts(id) values($1),($2)', [ACTOR, OTHER]);
  await db.query(`insert into private.fixture_accounts(id)
    select ('90000000-0000-4000-8000-'||lpad((10000+n)::text,12,'0'))::uuid from generate_series(1,105) n`);
  await db.exec(`insert into public.app_profiles(id,account_id,profile_status,kind,display_name,city,headline,bio,private_phone)
    select ('90000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
      ('90000000-0000-4000-8000-'||lpad((10000+n)::text,12,'0'))::uuid,
      'ACTIVE','REQUESTER',' Autor '||n||' ',' Novi Sad ','Private requester headline','Private requester bio','secret'
    from generate_series(1,105) n;
    insert into public.agreements(id,requester_profile_id,worker_profile_id,status)
    select ('90000000-0000-4000-8000-'||lpad((20000+n)::text,12,'0'))::uuid,
      '90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','COMPLETED'
    from generate_series(1,3) n;
  `);
  if (apply) await db.exec(candidate);
  async function asRole(role, actor = ACTOR) {
    assert.ok(['postgres', 'authenticated', 'anon', 'service_role'].includes(role));
    await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? '']);
    await db.exec('set role ' + role);
  }
  const one = profile => value('select public.rpc_get_public_profile($1) as value', [profile]);
  const batch = (ids, expected = ACTOR) => value('select public.rpc_get_public_profiles_batch($1,$2::uuid[]) as value', [expected, ids]);
  return { db, query, value, metadata, asRole, one, batch };
}

const compiled = new Map();
function clientHarness(rpc) {
  const session = { user: { id: ACTOR }, accountRevision: 1 };
  const calls = [], cache = new Map(), state = { override: null };
  const wire = { rpc(name, args) {
    const call = { name, args, signal: null }; calls.push(call);
    let promise;
    const run = () => promise ??= Promise.resolve().then(() => state.override ? state.override(call) : rpc(call));
    return {
      abortSignal(signal) { call.signal = signal; return this; },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
  } };
  const stubs = {
    'src/store/sesija.ts': { sesijaSada: () => session },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => wire },
  };
  function load(name) {
    const filename = ['', '.ts', '.tsx', '.mjs', '/index.ts'].map(ext => path.resolve(ROOT, name + ext))
      .find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    assert.ok(filename, name); name = path.relative(ROOT, filename).replaceAll(path.sep, '/');
    if (stubs[name]) return stubs[name];
    if (cache.has(name)) return cache.get(name).exports;
    const source = fs.readFileSync(filename, 'utf8'), key = name + '\0' + source;
    if (!compiled.has(key)) {
      const result = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
      assert.deepEqual((result.diagnostics ?? []).filter(value => value.category === ts.DiagnosticCategory.Error), []);
      compiled.set(key, result.outputText);
    }
    const module = { exports: {} }; cache.set(name, module);
    new Function('require', 'module', 'exports', compiled.get(key))(request => request.startsWith('.')
      ? load(path.relative(ROOT, path.resolve(path.dirname(filename), request)).replaceAll(path.sep, '/')) : require(request), module, module.exports);
    return module.exports;
  }
  const client = load('src/data/publicProfileClientService.ts').publicProfileClientService;
  const overlay = load('src/data/discoveryV1OverlayOwner.ts');
  const source = { odnosiPremaZadacima: async () => ({ owned: new Set(), applied: new Set(), relation: () => ({ kind: 'NONE' }) }) };
  return { session, calls, state, client, overlay,
    owner(legacy = false, isCurrent = () => true) {
      const loaders = overlay.createDiscoveryV1ExistingOverlayLoaders(source);
      if (legacy) delete loaders.profiles;
      return overlay.createDiscoveryV1OverlayOwner(loaders, isCurrent);
    },
  };
}
const items = ids => ids.map((requesterProfileId, i) => ({ id: id(30000 + i), requesterProfileId, revision: 1, urgent: false }));
const projection = profileId => ({ profileId, role: 'REQUESTER', displayName: 'Autor', avatarPath: null, city: 'Novi Sad',
  publicSummary: { headline: null, bio: null }, trust: { ratingAverage: 4.5, reviewCount: 2, completedCount: 3,
    identityVerified: false, ratingAvailable: true, reviewsAvailable: true, identityVerificationAvailable: false } });
const envelope = ids => ({ schema: 'PUBLIC_PROFILES_BATCH_V1', accountId: ACTOR, profiles: ids.map(profileId => ({ profileId, profile: projection(profileId) })),
  asOf: '2026-11-08T02:00:00.000001Z', authoritative: true });
module.exports = { ROOT, preimage, candidate, id, ACTOR, OTHER, deferred, wait, sqlFixture, clientHarness, items, projection, envelope };
