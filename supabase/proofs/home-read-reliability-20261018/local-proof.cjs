'use strict';
// Isolated PostgreSQL only. No remote URL, credentials or real accounts.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const candidate = path.resolve(__dirname, '../../candidates/home-read-reliability-20261018');
const { plan, sql, migrationSql, body, md5, replaceOnce } = require(path.join(candidate, 'package.cjs'));
const targets = plan(), reader = targets.find(row => row.signature.startsWith('rpc_list_open_tasks_v3('));

test('pinned candidates are reproducible, surgical and byte-for-byte reversible', () => {
  for (const direction of ['forward', 'revert']) assert.equal(fs.readFileSync(path.join(candidate, direction + '.sql'), 'utf8'), sql(direction));
  for (const target of targets) {
    assert.equal(md5(body(target.definition)), target.body_md5);
    let restored = target.after;
    for (const [a, b] of [...target.changes].reverse()) restored = replaceOnce(restored, b, a);
    assert.equal(restored, target.definition);
    if (target !== reader) {
      assert.equal(body(target.definition).split("'40001'").length - 1, 1);
      assert.equal(target.after, target.definition.replace("errcode='40001'", "errcode='PT409'"));
      assert.equal(body(target.after).includes("'40001'"), false);
    }
  }
  assert.throws(() => replaceOnce('one one', 'one', 'two'), /PATCH_SITE_DRIFT/);
  assert.throws(() => replaceOnce('zero', 'one', 'two'), /PATCH_SITE_DRIFT/);
  assert.equal(/^(begin|commit);$/mi.test(migrationSql()),false,'HOSTED_TRANSACTION_MUST_OWN_COMMIT');
});

test('disposable PostgreSQL: captured bodies, invoker/RLS read, metadata, rollback and drift refusal', async t => {
  if (!process.env.PGLITE_MODULE) throw new Error('Set PGLITE_MODULE to an isolated @electric-sql/pglite@0.5.10 installation, not an app dependency.');
  const { PGlite } = require(process.env.PGLITE_MODULE);
  const db = new PGlite();
  const uid = n => '11111111-1111-4111-8111-' + String(n).padStart(12, '0');
  const READER = uid(999), OTHER = uid(888);
  const as = async (role, statement, params = [], account = READER) => {
    await db.exec('begin; set local role ' + role + ';');
    try {
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [account]);
      return (await db.query(statement, params)).rows;
    } finally { await db.exec('rollback'); }
  };
  const read = async (filters, limit = 3, role = 'authenticated') =>
    (await as(role, 'select public.rpc_list_open_tasks_v3(null,$1::jsonb,$2,null,null) result', [JSON.stringify(filters), limit]))[0].result;
  const metadata = async () => (await db.query(
    "select p.oid::regprocedure::text signature,to_jsonb(p) metadata,obj_description(p.oid,'pg_proc') comment " +
    "from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in " +
    "('rpc_list_open_tasks_v3','rpc_taxonomy_prepare_admission_service','rpc_taxonomy_commit_admission_service'," +
    "'rpc_taxonomy_commit_reviewed_batch_service') order by p.proname")).rows;
  const bboxQuery = "select public.rpc_list_open_tasks_v3(" +
    "'{\"west\":19.7,\"south\":45.1,\"east\":20,\"north\":45.4}'::jsonb,'{}'::jsonb,20,null,null) result";
  try {
    await db.exec(fs.readFileSync(path.join(__dirname, 'fixture.sql'), 'utf8'));
    // Taxonomy schemas are not replayed. Store opaque REAL captured bodies without compiling
    // their dependencies; their business operations are NOT executed or certified here.
    await db.exec('set check_function_bodies=off');
    for (const target of targets) {
      await db.exec(target.definition);
      await db.exec('revoke all on function public.' + target.signature + ' from public; grant execute on function public.' +
        target.signature + ' to ' + (target.security_definer ? 'service_role' : 'authenticated'));
    }
    await db.exec('set check_function_bodies=on');
    for (const n of [10,9,8,7,6,5,4,3,2,1]) {
      await db.query('insert into public.needs ' +
        '(id,requester_account_id,requester_profile_id,published_at,_covered,response_deadline,_visible,remaining_search_closed_at,status)' +
        ' values ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
        uid(n), n === 10 ? READER : OTHER, uid(777), '2026-10-18T' + String(n).padStart(2,'0') + ':00:00Z',
        n === 9 ? 2 : 0, n === 8 ? '2000-01-01T00:00:00Z' : '2099-01-01T00:00:00Z',
        n !== 7, n === 3 ? '2026-10-18T00:00:00Z' : null, n === 2 ? 'DRAFT' : 'PUBLISHED',
      ]);
    }
    const original = await metadata();
    const rowsBefore = (await db.query('select to_jsonb(n) row from public.needs n order by id')).rows;
    const ordinaryBefore = await read({},20), exactBefore = await read({ needId: uid(10) },1);
    const bboxBefore = await as('authenticated',bboxQuery);
    await db.exec('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key, statements text[] not null);');
    const hosted = text => 'begin;\n'+text+
      "\ninsert into supabase_migrations.schema_migrations values ('local-proof',array['proof-only']);\ncommit;";

    await t.test('before-image reproduces the unsupported preview and the three serialization-coded raises', async () => {
      await assert.rejects(() => read({ homePreview:true }),/INVALID_FILTER/);
      for (const target of targets.filter(row => row !== reader)) {
        const raises = body(target.definition).match(/RAISE EXCEPTION '[A-Z_]+' USING errcode='40001';/g);
        assert.equal(raises?.length,1);
        await assert.rejects(() => db.exec('do $$ begin '+raises[0]+' end $$'),error => error.code === '40001');
      }
    });

    await t.test('strict forward applies once, preserving all pg_proc metadata other than prosrc', async () => {
      await db.exec('set check_function_bodies=off');
      await db.exec(hosted(migrationSql()));
      assert.equal((await db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,1);
      await db.exec('set check_function_bodies=on');
      const changed = await metadata();
      for (let i=0; i<original.length; i++) {
        const before = structuredClone(original[i]), after = structuredClone(changed[i]);
        const target = targets.find(row => after.signature === row.signature);
        assert.equal(md5(after.metadata.prosrc),target.after_md5);
        delete before.metadata.prosrc; delete after.metadata.prosrc; assert.deepEqual(after,before);
      }
      await assert.rejects(() => db.exec(sql()),/LOCAL_RELIABILITY_PREIMAGE_OR_AUTHORITY_DRIFT/);
      await db.exec('rollback');
    });
    await t.test('own, full, expired, closed, draft and RLS-hidden tasks cannot consume the preview limit', async () => {
      const result = await read({ homePreview:true });
      assert.deepEqual(result.items.map(row => row.id),[uid(6),uid(5),uid(4)]);
      assert.equal(result.hasMore,true);
      assert.equal(result.items.every(row => row.acceptsApplications === true),true);
      for (const secret of ['PRIVATE_ADDRESS','PRIVATE_DESCRIPTION','PRIVATE_PHONE',READER,OTHER])
        assert.equal(JSON.stringify(result).includes(secret),false);
      for (const key of ['requester_account_id','privateAddress','phone','description']) assert.equal(key in result.items[0],false);
    });
    await t.test('ordinary list, exact public landing, cursor and bbox fixtures stay unchanged', async () => {
      const ordinary = await read({},20), exact = await read({ needId:uid(10) },1);
      assert.deepEqual(ordinary.items,ordinaryBefore.items); assert.equal(ordinary.hasMore,ordinaryBefore.hasMore);
      assert.deepEqual(exact.items,exactBefore.items); assert.equal(exact.items[0].id,uid(10));
      const bbox = await as('authenticated',bboxQuery);
      assert.deepEqual(bbox[0].result.items,bboxBefore[0].result.items);
      const cursor = ordinary.items[2];
      const next = await as('authenticated','select public.rpc_list_open_tasks_v3(null,$1::jsonb,20,$2,$3) result',['{}',cursor.sortAt,cursor.id]);
      assert.deepEqual(next[0].result.items,ordinary.items.slice(3));
    });
    await t.test('mixed preview filters, bad limits, bbox/cursor, anonymous and missing auth fail closed', async () => {
      for (const filters of [{ homePreview:false },{ homePreview:null },{ homePreview:'true' },
        { homePreview:true,remote:'ONLY' },{ homePreview:true,needId:uid(6) }])
        await assert.rejects(() => read(filters),/INVALID_FILTER/);
      for (const limit of [1,2,4,200]) await assert.rejects(() => read({ homePreview:true },limit),/INVALID_FILTER/);
      await assert.rejects(() => as('authenticated',"select public.rpc_list_open_tasks_v3('{}','{\"homePreview\":true}',3,null,null)"),/INVALID_FILTER/);
      await assert.rejects(() => as('authenticated',"select public.rpc_list_open_tasks_v3(null,'{\"homePreview\":true}',3,now(),$1)",[uid(6)]),/INVALID_FILTER/);
      await assert.rejects(() => read({ homePreview:true },3,'anon'),/permission denied/);
      await assert.rejects(() => as('authenticated',"select public.rpc_list_open_tasks_v3(null,'{\"homePreview\":true}',3,null,null)",[],''),/AUTH_REQUIRED/);
    });
    await t.test('the three extracted deterministic raises return PT409, retaining service-only access', async () => {
      for (const target of targets.filter(row => row !== reader)) {
        const source = (await db.query('select prosrc from pg_proc where oid=$1::regprocedure',['public.'+target.signature])).rows[0].prosrc;
        const raises = source.match(/RAISE EXCEPTION '[A-Z_]+' USING errcode='PT409';/g);
        assert.equal(raises?.length,1);
        await assert.rejects(() => db.exec('do $$ begin '+raises[0]+' end $$'),error => error.code === 'PT409');
        const grants = (await db.query("select has_function_privilege('authenticated',$1,'EXECUTE') authenticated,"+
          "has_function_privilege('service_role',$1,'EXECUTE') service",['public.'+target.signature])).rows[0];
        assert.deepEqual(grants,{ authenticated:false,service:true });
      }
      assert.deepEqual((await db.query('select to_jsonb(n) row from public.needs n order by id')).rows,rowsBefore);
    });
    await t.test('revert is byte-for-byte; source and ACL drift refuse atomically, leaving no partial edits', async () => {
      await db.exec('set check_function_bodies=off');
      await db.exec(sql('revert')); assert.deepEqual(await metadata(),original);
      const last = targets[targets.length-1];
      await db.exec(last.definition.replace("'ADMISSION_INPUT_INVALID'","'ADMISSION_INPUT_DRIFT'"));
      const drift = await metadata();
      await assert.rejects(() => db.exec(sql()),/LOCAL_RELIABILITY_PREIMAGE_OR_AUTHORITY_DRIFT/);
      await db.exec('rollback'); assert.deepEqual(await metadata(),drift);
      await db.exec(last.definition);
      await db.exec('grant execute on function public.'+reader.signature+' to anon');
      const widened = await metadata();
      await assert.rejects(() => db.exec(sql()),/LOCAL_RELIABILITY_PREIMAGE_OR_AUTHORITY_DRIFT/);
      await db.exec('rollback'); assert.deepEqual(await metadata(),widened);
      await db.exec('revoke execute on function public.'+reader.signature+' from anon');
      assert.deepEqual(await metadata(),original);
    });
  } finally { await db.close(); }
});
