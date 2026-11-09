const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');

const seed = fs.readFileSync(path.join(__dirname, 'system-reference-seed.sql'), 'utf8');

test('clean SYSTEM taxonomy seed installs atomically and refuses a second run', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA private;
      CREATE TABLE private.work_taxonomy_categories (
        id uuid PRIMARY KEY,
        canonical_key text NOT NULL UNIQUE,
        label text NOT NULL,
        parent_id uuid REFERENCES private.work_taxonomy_categories(id),
        state text NOT NULL,
        source text NOT NULL,
        catalog_version bigint NOT NULL
      );
      CREATE TABLE private.work_taxonomy_category_modes (
        category_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id),
        execution_scope text NOT NULL,
        source_ref text NOT NULL,
        PRIMARY KEY (category_id, execution_scope)
      );
      CREATE TABLE private.work_taxonomy_aliases (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        category_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id),
        locale text NOT NULL,
        label text NOT NULL,
        normalized_key text GENERATED ALWAYS AS (lower(label)) STORED
      );
      CREATE TABLE private.work_taxonomy_control (
        singleton boolean PRIMARY KEY,
        auto_registration_enabled boolean NOT NULL,
        max_auto_creates_per_hour integer NOT NULL,
        catalog_version bigint NOT NULL
      );
    `);
    await db.exec(seed);
    const result = await db.query(`
      SELECT
        (SELECT count(*) FROM private.work_taxonomy_categories) AS categories,
        (SELECT count(*) FROM private.work_taxonomy_category_modes) AS modes,
        (SELECT count(*) FROM private.work_taxonomy_aliases) AS aliases,
        (SELECT count(*) FROM private.work_taxonomy_categories WHERE state <> 'ESTABLISHED' OR source <> 'SYSTEM') AS stray,
        (SELECT count(*) FROM private.work_taxonomy_categories c LEFT JOIN private.work_taxonomy_categories p ON p.id=c.parent_id WHERE c.parent_id IS NOT NULL AND p.id IS NULL) AS missing_parents,
        (SELECT count(*) FROM private.work_taxonomy_aliases WHERE normalized_key IS NULL) AS missing_normalized,
        (SELECT catalog_version FROM private.work_taxonomy_control) AS catalog_version
    `);
    assert.deepEqual(result.rows[0], {
      categories: 54,
      modes: 61,
      aliases: 69,
      stray: 0,
      missing_parents: 0,
      missing_normalized: 0,
      catalog_version: 15,
    });
    const next = await db.query(`SELECT nextval('private.work_taxonomy_aliases_id_seq') AS id`);
    assert.equal(Number(next.rows[0].id), 266);
    await assert.rejects(db.exec(seed), /SYSTEM_SEED_TARGET_NOT_EMPTY/);
    await db.exec('ROLLBACK');
    const after = await db.query('SELECT count(*) AS n FROM private.work_taxonomy_categories');
    assert.equal(after.rows[0].n, 54);
  } finally {
    await db.close();
  }
});
