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
