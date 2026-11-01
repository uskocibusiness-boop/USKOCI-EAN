// Exact captured/current SQL test for R04 semantic admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { generate, preimage, originals, postimages, signatures, acceptance } from './build.mjs';

const hash = (s, kind = 'sha256') => createHash(kind).update(s).digest('hex');

const account = '11111111-1111-4111-8111-111111111111';
const conversation = '44444444-4444-4444-8444-444444444444';
const category = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ddl = images => Object.values(images).map(f => f.definition.trimEnd() + ';\n').join('');

async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA private;
    CREATE SCHEMA auth;
    CREATE SCHEMA extensions;
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    GRANT USAGE ON SCHEMA public, private, auth TO anon, authenticated, service_role;

    CREATE TABLE private.work_taxonomy_risk_rules(
      id bigint generated always as identity primary key,
      pattern text not null,
      decision text not null,
      policy_version bigint not null default 1,
      enabled boolean not null default true
    );
    INSERT INTO private.work_taxonomy_risk_rules (pattern, decision) VALUES
      ('(^|[[:space:]])(oruzje|droga|narkotici)($|[[:space:]])', 'BLOCKED'),
      ('(^|[[:space:]])(lekarski|lekar|terapija|stomatolog)($|[[:space:]])', 'REVIEW_REQUIRED');

    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$SELECT nullif(current_setting('test.uid', true), '')::uuid$$;

    CREATE FUNCTION extensions.digest(text, text) RETURNS bytea LANGUAGE sql IMMUTABLE AS
      $$SELECT decode(md5($1), 'hex')$$;

    CREATE TABLE private.work_taxonomy_control(singleton boolean primary key, catalog_version bigint);
    INSERT INTO private.work_taxonomy_control VALUES(true, 17);

    CREATE TABLE private.work_taxonomy_categories(
      id uuid primary key, parent_id uuid, label text, canonical_key text, state text, created_at timestamptz default now()
    );
    INSERT INTO private.work_taxonomy_categories (id, parent_id, label, canonical_key, state) VALUES
      ('${category}', null, 'Lektura i korektura', 'lektura i korektura', 'ESTABLISHED'),
      ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', null, 'Zanatske usluge', 'zanatske usluge', 'ESTABLISHED');

    CREATE TABLE private.work_taxonomy_aliases(category_id uuid references private.work_taxonomy_categories, normalized_key text);
    INSERT INTO private.work_taxonomy_aliases (category_id, normalized_key) VALUES
      ('${category}', 'lektura teksta na srpskom jeziku');

    CREATE TABLE private.work_taxonomy_category_modes(category_id uuid, execution_scope text);
    INSERT INTO private.work_taxonomy_category_modes VALUES ('${category}', 'REMOTE'), ('${category}', 'ON_SITE');

    CREATE TABLE public.ai_conversations(
      id uuid primary key, account_id uuid, purpose text
    );
    INSERT INTO public.ai_conversations (id, account_id, purpose) VALUES
      ('${conversation}', '${account}', 'NEED_INTAKE');

    CREATE FUNCTION private.ai_task_review_source(uuid) RETURNS jsonb LANGUAGE sql STABLE AS
      $$SELECT jsonb_build_object('conversationId', $1)$$;

    CREATE TABLE private.work_taxonomy_gemini_turn_hints_v1(
      id uuid, created_at timestamptz, purpose text, account_id uuid, conversation_id uuid,
      client_request_id uuid, source_fingerprint text, catalog_version bigint, proposals jsonb
    );

    CREATE TABLE public.needs(
      id uuid primary key, category text, category_id uuid references private.work_taxonomy_categories
    );

    CREATE TABLE private.closure_source_v5(singleton boolean primary key default true, sha256 text not null);
    INSERT INTO private.closure_source_v5 (singleton, sha256) VALUES (true, '0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb');

    CREATE FUNCTION private.taxonomy_normalize_v1(text) RETURNS text LANGUAGE sql IMMUTABLE AS
      $$SELECT lower(btrim(regexp_replace($1, '[[:space:]]+', ' ', 'g')))$$;

    CREATE FUNCTION private.taxonomy_category_path_valid_v1(uuid) RETURNS boolean LANGUAGE sql STABLE AS
      $$SELECT EXISTS(SELECT 1 FROM private.work_taxonomy_categories WHERE id=$1 AND state='ESTABLISHED')$$;

    CREATE FUNCTION private.taxonomy_admission_fingerprint_v1() RETURNS text LANGUAGE sql STABLE AS
      $$SELECT repeat('a', 32)$$;

    CREATE FUNCTION private.taxonomy_handoff_valid_v1(jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS
      $$SELECT true$$;

    CREATE FUNCTION private.taxonomy_review_exact_projection_v1(text, jsonb, jsonb) RETURNS jsonb LANGUAGE sql STABLE AS
      $$SELECT jsonb_build_object('status', 'PENDING_CLASSIFICATION', 'semanticReviewCandidates', '[]'::jsonb)$$;

    CREATE FUNCTION private.closure_source_digest_v5() RETURNS text LANGUAGE sql IMMUTABLE AS
      $$SELECT '0c03679b287ed6d726b0b6845bedf54c1463d3fe0efcaf9cd8a947997e160b56'::text$$;

    CREATE FUNCTION private.closure_schema_digest_v5_139() RETURNS text LANGUAGE sql IMMUTABLE AS
      $$SELECT 'df82c2cb19edfa86ee092fb6fdc97528b82a2482f05ae64c45939268346af84c'::text$$;

    CREATE FUNCTION private.closure_erasure_program_digest_v5() RETURNS text LANGUAGE sql IMMUTABLE AS
      $$SELECT '5e121db0bd932accd4b007f80098db67ebc97e99f29e0b76f06378de0f9c4d96'::text$$;

    CREATE FUNCTION private.retention_ai_source_ready() RETURNS boolean LANGUAGE sql IMMUTABLE AS
      $$SELECT false$$;

    CREATE FUNCTION private.closure_erasure_binding_v5() RETURNS text LANGUAGE sql IMMUTABLE AS
      $$SELECT NULL::text$$;

    CREATE FUNCTION private.data_export_policy_binding() RETURNS text LANGUAGE sql IMMUTABLE AS
      $$SELECT NULL::text$$;
  `);

  // Load original functions
  await db.exec(ddl(originals));
  return db;
}

test('frozen package preserves signatures, attributes and closure; changes three bodies only', () => {
  const outputs = generate();
  for (const [name, s] of Object.entries(outputs)) {
    assert.equal(readFileSync(new URL(name, import.meta.url), 'utf8'), s, name);
  }
  assert.equal(preimage.closure.source_ready, false);
  assert.equal(preimage.closure.export_binding, null);
  assert.equal(preimage.closure.erasure_binding, null);
  for (const key of Object.keys(originals)) {
    assert.equal(hash(postimages[key].definition, 'md5'), postimages[key].definition_md5);
  }
  assert.equal((outputs['forward.sql'].match(/CREATE OR REPLACE FUNCTION /g) || []).length, 3);
  assert.match(outputs['forward.sql'], /R04_SEMANTIC_DEV_CLOSURE_STATE_CHANGED/);
  assert.match(outputs['forward.sql'], /R04_SEMANTIC_DEV_UNRELATED_FUNCTION_DELTA/);
});

test('preimage reproduces single-word block ("Lektura" -> NEEDS_CLARIFICATION)', async t => {
  const db = await setup();
  t.after(() => db.close());

  const triage = await db.query("SELECT private.taxonomy_risk_triage_v1('Lektura') AS res");
  assert.equal(triage.rows[0].res, 'NEEDS_CLARIFICATION');
});

test('forward DDL unblocks single-word triage ("Lektura" -> LOW_RISK_CANDIDATE) and preserves screening', async t => {
  const db = await setup();
  t.after(() => db.close());

  // Apply forward DDL
  await db.exec(ddl(postimages));

  // 1. Single word low-risk passes
  const triage = await db.query("SELECT private.taxonomy_risk_triage_v1('Lektura') AS res");
  assert.equal(triage.rows[0].res, 'LOW_RISK_CANDIDATE');

  // 2. Length < 3 fails
  const shortTriage = await db.query("SELECT private.taxonomy_risk_triage_v1('ab') AS res");
  assert.equal(shortTriage.rows[0].res, 'NEEDS_CLARIFICATION');

  // 3. Ambiguous broad terms fail
  for (const ambiguous of ['ostalo', 'drugo', 'razno', 'sve', 'svasta', 'bilo sta']) {
    const r = await db.query("SELECT private.taxonomy_risk_triage_v1($1) AS res", [ambiguous]);
    assert.equal(r.rows[0].res, 'NEEDS_CLARIFICATION', ambiguous);
  }

  // 4. Prohibited/blocked fails
  const blocked = await db.query("SELECT private.taxonomy_risk_triage_v1('oruzje') AS res");
  assert.equal(blocked.rows[0].res, 'BLOCKED');

  // 5. Regulated fails
  const regulated = await db.query("SELECT private.taxonomy_risk_triage_v1('lekarski pregled') AS res");
  assert.equal(regulated.rows[0].res, 'REVIEW_REQUIRED');
});

test('projection produces READY with candidate plan for low-risk single-word proposal', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(ddl(postimages));

  // Set auth context
  await db.query("SELECT set_config('test.uid', $1, false)", [account]);

  // Insert Gemini turn hint with proposal for 'Lektura'
  const turnHintId = '99999999-9999-4999-8999-999999999999';
  const proposals = [
    {
      action: 'REUSE_EXISTING',
      categoryId: category,
      service: 'Lektura',
      mode: 'REMOTE',
      parentId: '',
      proposedPath: [],
      reason: 'Model predlaze postojecu uslugu lekture teksta na srpskom jeziku.',
      catalogVersion: 17
    }
  ];

  await db.query(`
    INSERT INTO private.work_taxonomy_gemini_turn_hints_v1
    (id, created_at, purpose, account_id, conversation_id, client_request_id, source_fingerprint, catalog_version, proposals)
    SELECT $1, clock_timestamp(), 'NEED_SERVICE', $2, $3, $4,
      encode(extensions.digest(private.ai_task_review_source(c.id)::text, 'sha256'), 'hex'),
      17, $5
    FROM public.ai_conversations c WHERE c.id = $3
  `, [turnHintId, account, conversation, '88888888-8888-4888-8888-888888888888', JSON.stringify(proposals)]);

  const result = await db.query(`
    SELECT private.taxonomy_review_candidate_projection_v2(
      'NEED_SERVICE',
      '["Lektura"]'::jsonb,
      '[{"service":"Lektura","mode":"REMOTE"}]'::jsonb,
      $1::uuid,
      $2::uuid
    ) AS proj
  `, [account, conversation]);

  const proj = result.rows[0].proj;
  assert.equal(proj.status, 'READY');
  assert.ok(proj.classificationCandidates.length > 0);
  assert.equal(proj.classificationCandidates[0].service, 'Lektura');
  assert.equal(proj.classificationCandidates[0].action, 'REUSE_EXISTING');
});

test('needs category trigger resolves both canonical key and registered alias', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(ddl(postimages));

  // Create trigger
  await db.exec(`
    CREATE TRIGGER needs_sync_taxonomy_category_trg
    BEFORE INSERT OR UPDATE OF category ON public.needs
    FOR EACH ROW EXECUTE FUNCTION private.needs_sync_taxonomy_category_trigger_fn();
  `);

  // 1. Insert with canonical key
  const n1 = '00000000-0000-4000-8000-000000000001';
  await db.query("INSERT INTO public.needs (id, category) VALUES ($1, 'Lektura i korektura')", [n1]);
  const row1 = (await db.query("SELECT category_id FROM public.needs WHERE id=$1", [n1])).rows[0];
  assert.equal(row1.category_id, category);

  // 2. Insert with alias
  const n2 = '00000000-0000-4000-8000-000000000002';
  await db.query("INSERT INTO public.needs (id, category) VALUES ($1, 'Lektura teksta na srpskom jeziku')", [n2]);
  const row2 = (await db.query("SELECT category_id FROM public.needs WHERE id=$1", [n2])).rows[0];
  assert.equal(row2.category_id, category);
});

test('rollback restores exact preimage behavior and re-apply is idempotent', async t => {
  const db = await setup();
  t.after(() => db.close());

  // Apply forward
  await db.exec(ddl(postimages));
  const t1 = await db.query("SELECT private.taxonomy_risk_triage_v1('Lektura') AS res");
  assert.equal(t1.rows[0].res, 'LOW_RISK_CANDIDATE');

  // Apply rollback
  await db.exec(ddl(originals));
  const t2 = await db.query("SELECT private.taxonomy_risk_triage_v1('Lektura') AS res");
  assert.equal(t2.rows[0].res, 'NEEDS_CLARIFICATION');

  // Re-apply forward
  await db.exec(ddl(postimages));
  const t3 = await db.query("SELECT private.taxonomy_risk_triage_v1('Lektura') AS res");
  assert.equal(t3.rows[0].res, 'LOW_RISK_CANDIDATE');
});
