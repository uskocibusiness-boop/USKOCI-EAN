'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const candidate = fs.readFileSync(path.join(__dirname, 'sql', 'dispatch_retire_urgency_20261119.candidate.sql'), 'utf8');
const blocks = [...candidate.matchAll(/DO \$([A-Za-z0-9_]+)\$[\s\S]*?END\s*\$\1\$;/g)];
const tags = blocks.map(match => match[1]);

test('urgency retirement SQL remains explicitly source-only and fail-closed', () => {
  assert.match(candidate, /SOURCE-ONLY CANDIDATE/);
  assert.doesNotMatch(candidate, /\$new\$new\$/);
  assert.equal(tags.length, 17);
  assert.equal(tags[0], 'source_only');
  assert.match(blocks[0][0], /DISPATCH_URGENCY_RETIREMENT_SOURCE_ONLY/);
  assert.ok(candidate.indexOf('DO $source_only$') < candidate.indexOf('BEGIN;'));
  assert.ok(tags.includes('retire_lifecycle_urgent_expiry'));
  assert.ok(tags.includes('retire_urgent_activation_preview'));
  assert.equal(new Set(tags).size, tags.length, 'each guarded patch must have a unique block name');
});

test('retirement preimage metadata guards match the read-only DEV snapshot', () => {
  const expected = {
    retire_worker_notify_cap: { acl: '{postgres=X/postgres}', secdef: 'true', config: 'search_path=pg_catalog' },
    retire_push_quiet_bypass: { acl: '{postgres=X/postgres}', secdef: 'true', config: 'search_path=pg_catalog' },
    retire_same_day_urgent_match_gate: { acl: '{postgres=X/postgres}', secdef: 'true', config: 'search_path=pg_catalog' },
    retire_event_priority: { acl: '{postgres=X/postgres}', secdef: 'true', config: 'search_path=public, pg_temp' },
    retire_push_priority_order: { acl: '{postgres=X/postgres,service_role=X/postgres}', secdef: 'true', config: 'search_path=pg_catalog' },
    retire_push_priority_projection: { acl: '{postgres=X/postgres,service_role=X/postgres}', secdef: 'true', config: 'search_path=pg_catalog' },
    retire_open_task_urgency_filter: { acl: '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}', secdef: 'false', config: 'search_path=pg_catalog' },
    retire_discovery_urgency_projection: { acl: '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}', secdef: 'false', config: 'search_path=pg_catalog' },
    retire_task_urgency_projection: { acl: '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}', secdef: 'false', config: 'search_path=pg_catalog' },
    retire_profile_available_now_projection: { acl: '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}', secdef: 'true', config: 'search_path=pg_catalog' },
    retire_need_urgency_read: { acl: '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}', secdef: 'false', config: 'search_path=pg_catalog' },
    retire_urgent_activation_rpc: { acl: '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}', secdef: 'true', config: 'search_path=pg_catalog' },
  };
  for (const [tag, guard] of Object.entries(expected)) {
    const block = blocks.find(match => match[1] === tag)?.[0];
    assert.ok(block, `missing guarded block ${tag}`);
    assert.ok(block.includes(`actual.acl IS DISTINCT FROM '${guard.acl}'`), `${tag} ACL must match the current DEV preimage`);
    assert.ok(block.includes(`actual.prosecdef IS DISTINCT FROM ${guard.secdef}`), `${tag} SECURITY DEFINER state must match DEV`);
    assert.ok(block.includes(`actual.proconfig IS DISTINCT FROM ARRAY['${guard.config}']::text[]`), `${tag} search_path must match DEV`);
  }
  const main = blocks.find(match => match[1] === 'main')?.[0] ?? '';
  assert.doesNotMatch(main, /\\$old\\$\s*urg := 'NORMAL';\\$old\\$/, 'do not retain a patch anchor absent from the live function');
  assert.match(main, /IS DISTINCT FROM 'e6ef0105afda31ce120a0cde6626b0d6'/, 'main postimage hash must reflect the corrected removal of the urgency assignment');
  assert.doesNotMatch(main, /urg\s*:=\s*'NORMAL'/, 'retired urgency local must not be assigned after its declaration is removed');
  assert.doesNotMatch(main, /urg\s+text/, 'retired urgency local must not be reintroduced');
  const openTasks = blocks.find(match => match[1] === 'retire_open_task_urgency_filter')?.[0] ?? '';
  assert.match(openTasks, /RETIRE_OPEN_TASK_URGENCY_SELECT_ANCHOR_DRIFT/);
  assert.match(openTasks, /RETIRE_OPEN_TASK_URGENCY_META_ANCHOR_DRIFT/);
  assert.match(openTasks, /RETIRE_OPEN_TASK_URGENCY_FILTER_PREDICATE_DRIFT/);
  assert.match(openTasks, /IS DISTINCT FROM 4/, 'the two urgency projection anchors must cover all three SELECT projections');
  assert.match(openTasks, /IS DISTINCT FROM 3/, 'the urgent-only filter anchor must cover both query branches');
  assert.match(openTasks, /IS DISTINCT FROM '8e8ee643e72c9efab746b6a9e7f6ec08'/, 'open-task postimage must match the full projection cleanup');
});

test('all guarded retirement blocks parse as PostgreSQL 17 PL/pgSQL', async () => {
  const db = new PGlite();
  const syntaxError = /syntax error|unterminated dollar-quoted|invalid dollar-quoted|mismatched parentheses/i;
  const runtimeStops = [];
  try {
    await db.exec("BEGIN; SET LOCAL lock_timeout = '2s'; SET LOCAL statement_timeout = '30s'; ROLLBACK;");
    for (const block of blocks) {
      if (block[1] === 'source_only') continue;
      try {
        await db.exec(block[0]);
      } catch (error) {
        const message = String(error?.message || error);
        assert.doesNotMatch(message, syntaxError, `${block[1]} must be syntactically valid: ${message}`);
        runtimeStops.push(block[1]);
      }
    }
    assert.equal(runtimeStops.length, blocks.length - 1,
      'each non-guard block should parse and then stop safely on absent DEV-only objects in this empty fixture');
  } finally {
    await db.close();
  }
});
