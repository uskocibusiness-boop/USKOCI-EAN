// Run: node --test scripts/f13-skill-cas.test.mjs
// Executes the actual TypeScript service, receipt fence and capability parser
// with the installed Supabase SDK. Only Auth/session/native dependencies and
// fetch are replaced. The HTTP adapter sends decoded SDK filters to real
// PostgreSQL (PGlite); it is not a PostgREST server, RLS or live Auth proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { PGlite } from '@electric-sql/pglite';

const root = fileURLToPath(new URL('../', import.meta.url));
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const P = '33333333-3333-4333-8333-333333333333';
const Q = '44444444-4444-4444-8444-444444444444';
const MISSING = '55555555-5555-4555-8555-555555555555';
const projection = 'id,account_id,kind,skills';
const db = new PGlite();
const traces = [];
let session = { user: { id: A }, accountRevision: 1 };
let beforePatch = async () => {};
let patchResponse;
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const json = value => new Response(JSON.stringify(value), {
  status: 200, headers: { 'content-type': 'application/json' },
});

function equality(url, name) {
  const values = url.searchParams.getAll(name);
  assert.equal(values.length, 1, `one ${name} filter`);
  assert(values[0].startsWith('eq.'), `${name} equality`);
  return values[0].slice(3);
}

async function compareAndSet(request, overrides = {}) {
  const { url, patch } = request;
  const bindings = {
    id: equality(url, 'id'), account: equality(url, 'account_id'),
    kind: equality(url, 'kind'), expected: equality(url, 'skills'), ...overrides,
  };
  return rows(`update app_profiles
    set skills = array(select jsonb_array_elements_text($1::jsonb))
    where id=$2::uuid and account_id=$3::uuid and kind=$4 and skills=$5::text[]
    returning id,account_id,kind,skills`,
  [JSON.stringify(patch.skills), bindings.id, bindings.account, bindings.kind, bindings.expected]);
}

const client = createClient('https://f13.invalid', 'synthetic-f13-key', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: {
    fetch: async (input, options = {}) => {
      const url = new URL(String(input));
      assert.equal(url.origin, 'https://f13.invalid');
      assert.equal(url.pathname, '/rest/v1/app_profiles');
      assert.equal(url.searchParams.get('select'), projection);
      const method = options.method ?? 'GET';
      assert(['GET', 'PATCH'].includes(method), 'no insert, activation or other mutation');
      const request = { url, method, headers: new Headers(options.headers) };
      traces.push(request);
      const id = equality(url, 'id'), account = equality(url, 'account_id'), kind = equality(url, 'kind');
      assert.equal(kind, 'WORKER');
      if (method === 'GET') {
        assert.deepEqual([...url.searchParams.keys()].sort(), ['account_id', 'id', 'kind', 'select']);
        return json(await rows(`select ${projection} from app_profiles
          where id=$1::uuid and account_id=$2::uuid and kind=$3`, [id, account, kind]));
      }
      assert.deepEqual([...url.searchParams.keys()].sort(), ['account_id', 'id', 'kind', 'select', 'skills']);
      assert.match(request.headers.get('prefer') ?? '', /return=representation/);
      request.patch = JSON.parse(options.body);
      assert.deepEqual(Object.keys(request.patch), ['skills']);
      assert(Array.isArray(request.patch.skills));
      request.expected = equality(url, 'skills');
      await beforePatch(request, traces.filter(item => item.method === 'PATCH').length);
      if (patchResponse) return patchResponse();
      request.returned = await compareAndSet(request);
      return json(request.returned);
    },
  },
});
// The task concerns REST request construction and SQL equality; real token
// acquisition/validation is outside this isolated proof.
client.auth.getUser = async () => ({ data: { user: { id: session.user?.id } }, error: null });

function loadService() {
  const allowed = new Set([
    'src/data/workerProfileClientService.ts', 'src/data/serverReceipt.ts',
    'src/lib/capabilityTerms.ts', 'src/contracts/workerCapacity.ts',
  ].map(path => resolve(root, path)));
  const mocks = new Map([
    [resolve(root, 'src/store/sesija.ts'), { sesijaSada: () => session }],
    [resolve(root, 'src/data/supabaseClient.ts'), { supabaseKlijent: () => client }],
    [resolve(root, 'src/data/workerCapacityClientService.ts'), {
      workerCapacityClientService: { save: () => assert.fail('skill addition cannot alter capacity') },
    }],
  ]);
  const cache = new Map();
  function load(filename) {
    if (mocks.has(filename)) return mocks.get(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    assert(allowed.has(filename), `unexpected runtime dependency: ${filename}`);
    const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const module = { exports: {} };
    cache.set(filename, module);
    const requireLocal = specifier => {
      assert(specifier.startsWith('.'), `unexpected external import: ${specifier}`);
      return load(resolve(dirname(filename), `${specifier}.ts`));
    };
    runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })
      (requireLocal, module, module.exports);
    return module.exports;
  }
  return load(resolve(root, 'src/data/workerProfileClientService.ts')).workerProfileClientService;
}
const service = loadService();
const add = (skill, input = {}, stillCurrent = () => true) => service.addSkill({
  accountId: A, accountRevision: 1, profileId: P, skill, ...input,
}, stillCurrent);
const saved = async (id = P) => (await rows('select skills from app_profiles where id=$1::uuid', [id]))[0].skills;
const patches = () => traces.filter(item => item.method === 'PATCH');
async function setSkills(skills, id = P) {
  await rows('update app_profiles set skills=array(select jsonb_array_elements_text($1::jsonb)) where id=$2::uuid', [JSON.stringify(skills), id]);
}
async function reset(skills) {
  await db.exec('truncate app_profiles');
  await rows(`insert into app_profiles(id,account_id,kind,skills) values
    ($1::uuid,$2::uuid,'WORKER',array(select jsonb_array_elements_text($5::jsonb))),
    ($3::uuid,$4::uuid,'WORKER',array['Tuđa veština'])`, [P, A, Q, B, JSON.stringify(skills)]);
  session = { user: { id: A }, accountRevision: 1 };
  traces.length = 0;
  beforePatch = async () => {};
  patchResponse = undefined;
}

test.after(() => db.close());
test('F13 actual SDK filters and PostgreSQL skill compare-and-set', async t => {
  await db.exec('create table app_profiles(id uuid primary key,account_id uuid not null,kind text not null,skills text[] not null)');

  await t.test('quotes, backslashes, newlines, commas, braces, NULL and Serbian text round-trip exactly', async () => {
    const old = ['"navodnici"', 'C:\\alat\\četka', 'prvi\ndrugi', 'zarez,tačka', '{boja}', 'NULL',
      'Ćirilica Ћирилица čćžšđ', '  postojeći razmaci  ', 'duplikat', 'duplikat', "O'Brian"];
    const newSkill = 'Nova "veština", {alat} \\ pravac\nĆirilica Ђ';
    await reset(old);
    assert.deepEqual(await add(`  ${newSkill}  `), { ok: true, podatak: null });
    assert.deepEqual(traces.map(item => item.method), ['GET', 'PATCH']);
    assert.deepEqual(patches()[0].patch, { skills: [...old, newSkill] });
    assert.deepEqual((await rows('select $1::text[] as expected', [patches()[0].expected]))[0].expected, old);
    assert.deepEqual(await saved(), [...old, newSkill]);
    assert.deepEqual(await saved(Q), ['Tuđa veština']);
  });

  await t.test('empty array uses a valid PostgreSQL literal and adds the first skill', async () => {
    await reset([]);
    assert.equal((await add('Prva veština')).ok, true);
    assert.equal(patches()[0].expected, '{}');
    assert.deepEqual(await saved(), ['Prva veština']);
  });

  await t.test('a competing update produces zero rows then a fresh merge preserving both additions', async () => {
    const initial = ['Osnovna'];
    await reset(initial);
    beforePatch = async (_request, attempt) => {
      if (attempt === 1) await setSkills([...initial, 'Paralelna, "veština" \\']);
    };
    assert.deepEqual(await add('Moja veština'), { ok: true, podatak: null });
    assert.deepEqual(traces.map(item => item.method), ['GET', 'PATCH', 'GET', 'PATCH']);
    assert.deepEqual(patches()[0].returned, []);
    assert.equal(patches()[1].returned.length, 1);
    assert.deepEqual(await saved(), [...initial, 'Paralelna, "veština" \\', 'Moja veština']);
    assert.deepEqual((await rows('select $1::text[] as expected', [patches()[1].expected]))[0].expected,
      [...initial, 'Paralelna, "veština" \\']);
  });

  await t.test('two confirmed CAS misses stop with conflict and preserve concurrent writes', async () => {
    await reset(['Osnovna']);
    beforePatch = async (_request, attempt) => setSkills([...(await saved()), `Paralelna ${attempt}`]);
    assert.equal((await add('Moja veština')).kod, 'PROFILE_SKILLS_CHANGED');
    assert.equal(patches().length, 2);
    assert(patches().every(request => request.returned.length === 0));
    assert.deepEqual(await saved(), ['Osnovna', 'Paralelna 1', 'Paralelna 2']);
  });

  await t.test('captured SQL rejects a foreign account, foreign profile and wrong profile kind', async () => {
    await reset(['Osnovna']);
    assert.equal((await add('Moja veština')).ok, true);
    const request = patches()[0];
    await setSkills(['Osnovna']);
    assert.deepEqual(await compareAndSet(request, { account: B }), []);
    assert.deepEqual(await compareAndSet(request, { id: Q }), []);
    assert.deepEqual(await compareAndSet(request, { id: MISSING }), []);
    assert.deepEqual(await compareAndSet(request, { kind: 'REQUESTER' }), []);
    assert.deepEqual(await saved(), ['Osnovna']);
    assert.deepEqual(await saved(Q), ['Tuđa veština']);
  });

  await t.test('foreign profile is absent to the captured owner and cannot be patched', async () => {
    await reset(['Osnovna']);
    assert.equal((await add('Moja veština', { profileId: Q })).kod, 'PROFILE_NOT_FOUND');
    assert.equal(patches().length, 0);
    assert.deepEqual(await saved(Q), ['Tuđa veština']);
    session = { user: { id: B }, accountRevision: 2 };
    assert.equal((await add('Moja veština')).kod, 'AUTH_ACCOUNT_CHANGED');
    assert.equal(patches().length, 0);
  });

  await t.test('ownership changed between read and PATCH yields zero rows without a cross-owner write', async () => {
    await reset(['Osnovna']);
    beforePatch = async () => rows('update app_profiles set account_id=$1::uuid where id=$2::uuid', [B, P]);
    assert.equal((await add('Moja veština')).kod, 'PROFILE_NOT_FOUND');
    assert.deepEqual(patches()[0].returned, []);
    assert.deepEqual(await saved(), ['Osnovna']);
    assert.equal(patches().length, 1);
  });

  await t.test('a server error is not treated as a confirmed CAS miss or retried', async () => {
    await reset(['Osnovna']);
    patchResponse = () => new Response(JSON.stringify({ code: '42501', message: 'permission denied' }), {
      status: 403, headers: { 'content-type': 'application/json' },
    });
    assert.equal((await add('Moja veština')).kod, 'PROFILE_UPDATE_FAILED');
    assert.deepEqual(traces.map(item => item.method), ['GET', 'PATCH']);
    assert.deepEqual(await saved(), ['Osnovna']);
  });
});
