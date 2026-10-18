'use strict';
// Real captured service bodies and real pgcrypto on isolated PostgreSQL/PGlite.
// Reuses the existing owner-review SQL fixtures. Not a full Supabase/Auth/Storage replay.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const {plan, body, md5} = require('../../candidates/home-read-reliability-20261018/package.cjs');
const targets = plan().filter(row => row.security_definer);
const source = file => fs.readFileSync(path.join(root, 'supabase/candidates/dynamic-taxonomy-20261011',file),'utf8')
  .split('\n').filter(line => !line.startsWith('\\')).join('\n');

test('actual taxonomy approval, replay, atomicity and stale conflicts before/after PT409', async t => {
  assert.ok(process.env.PGLITE_MODULE,'PGLITE_MODULE required');
  const {PGlite} = require(process.env.PGLITE_MODULE);
  const {pgcrypto} = require(path.join(process.env.PGLITE_MODULE,'dist/contrib/pgcrypto.cjs'));
  let baseline;
  for (const phase of ['before','after']) await t.test(phase,async t => {
    const db = new PGlite({extensions:{pgcrypto}});
    const expected = phase === 'before' ? '40001' : 'PT409';
    const install = async () => {
      for (const target of targets) {
        // Existing fixtures own the tables/approve function; only these three captured
        // production service bodies replace their old fixture implementations.
        await db.exec(phase === 'before' ? target.definition : target.after);
        const actual = (await db.query('select prosrc from pg_proc where oid=$1::regprocedure',['public.'+target.signature])).rows[0].prosrc;
        assert.equal(md5(actual),phase === 'before' ? target.body_md5 : target.after_md5);
        assert.equal(actual,body(phase === 'before' ? target.definition : target.after));
      }
    };
    try {
      await db.exec(source('disposable-fixture.sql'));
      await db.exec(source('catalog-foundation.sql'));
      await db.exec(source('disposable-owner-admission-fixture.sql'));
      await db.exec(source('owner-reviewed-admission-v1.sql'));
      // Create the batch table before validating the captured batch function's row type.
      await db.exec(source('owner-reviewed-batch-admission-v1.sql'));
      await install();
      await t.test('single-plan review, saved consent, cross-owner refusal, two-level creation and replay',async () => {
        await db.exec(source('disposable-owner-admission-assert.sql'));
      });
      await t.test('stale commit has exact SQLSTATE, no partial category, and unchanged safety/mode refusals',async () => {
        let checks = source('disposable-owner-admission-negative-assert.sql');
        const needle = "IF SQLERRM<>'ADMISSION_STALE_CATALOG_REPLAN' THEN RAISE; END IF;";
        assert.equal(checks.split(needle).length,2);
        checks = checks.replace(needle,needle+" IF SQLSTATE<>'"+expected+"' THEN RAISE EXCEPTION 'COMMIT_STALE_CODE_WRONG'; END IF;");
        await db.exec(checks);
      });
      await db.exec(source('disposable-owner-batch-fixture.sql'));
      await t.test('atomic multi-service batch, ownership/meaning checks, replay and exact stale code',async () => {
        let checks = source('disposable-owner-batch-assert.sql');
        const needle = "IF SQLERRM<>'BATCH_STALE_CATALOG' THEN RAISE; END IF;";
        assert.equal(checks.split(needle).length,2);
        checks = checks.replace(needle,needle+" IF SQLSTATE<>'"+expected+"' THEN RAISE EXCEPTION 'BATCH_STALE_CODE_WRONG'; END IF;");
        await db.exec(checks);
      });
      await t.test('a genuinely signed but stale prepare fails before admission/category writes',async () => {
        await db.exec("DO $check$ DECLARE v_plan jsonb; v_version bigint; v_count bigint; BEGIN "+
          "SELECT catalog_version INTO STRICT v_version FROM private.work_taxonomy_control WHERE singleton; "+
          "SELECT count(*) INTO v_count FROM private.work_taxonomy_admissions_v1; "+
          "INSERT INTO private.worker_ai_reviews(id,account_id,envelope,expires_at) VALUES "+
          "('10000000-0000-4000-8000-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{\"canAccept\":true}',now()+interval '1 hour'); "+
          "v_plan:=jsonb_build_object('action','REUSE_EXISTING','mode','ON_SITE','catalogVersion',v_version+1,"+
          "'categoryId',(SELECT id FROM private.work_taxonomy_categories WHERE label='Molerski radovi'),"+
          "'reason','Explicitly reviewed synthetic stale service plan.'); "+
          "PERFORM private.disposable_bind_classification_review('WORKER_CAPABILITY','10000000-0000-4000-8000-999999999999',v_plan); "+
          "BEGIN PERFORM public.rpc_taxonomy_prepare_admission_service("+
          "'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-999999999999','WORKER_CAPABILITY',"+
          "'10000000-0000-4000-8000-999999999999',v_plan); RAISE EXCEPTION 'STALE_PREPARE_ACCEPTED'; "+
          "EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'ADMISSION_STALE_CATALOG' OR SQLSTATE<>'"+expected+"' THEN RAISE; END IF; END; "+
          "IF (SELECT count(*) FROM private.work_taxonomy_admissions_v1)<>v_count OR "+
          "(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)<>v_version "+
          "THEN RAISE EXCEPTION 'STALE_PREPARE_PARTIAL_WRITE'; END IF; END $check$;");
      });
      const result = (await db.query("select jsonb_build_object("+
        "'version',(select catalog_version from private.work_taxonomy_control where singleton),"+
        "'categories',(select count(*) from private.work_taxonomy_categories),"+
        "'admissions',(select count(*) from private.work_taxonomy_admissions_v1),"+
        "'committed',(select count(*) from private.work_taxonomy_admissions_v1 where status='COMMITTED'),"+
        "'batches',(select count(*) from private.work_taxonomy_review_batches_v1),"+
        "'capabilities',(select count(*) from private.work_taxonomy_worker_capabilities),"+
        "'relations',(select count(*) from private.work_taxonomy_relations)) result")).rows[0].result;
      if (phase === 'before') baseline=result; else assert.deepEqual(result,baseline,'BUSINESS_OUTCOMES_CHANGED');
    } finally { await db.close(); }
  });
});
