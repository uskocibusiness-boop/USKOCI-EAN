#!/usr/bin/env node
// Read-only on-disk evidence integrity check. Never connects to DEV or applies SQL.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p));
const parse = (p) => JSON.parse(read(p).toString('utf8'));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const fail = (msg) => { throw new Error('PKG1A FAIL: ' + msg); };
const field = 'pkg1a_readonly_reconciliation_20261022';
const receiptPath = 'supabase/operations/dev-alpha/ledger/20261022_pkg1a_readonly_receipt.json';
const archivePath = 'supabase/operations/dev-alpha/ledger/20261021104742_closure_executor_rollback_probe.sql.txt';
const registry = parse('supabase/migrations/MIGRATION_PROVENANCE.json');
const receipt = parse(receiptPath);
const data = read(archivePath);
const prov = registry[field];
if (!prov || prov.classification !== 'READ_ONLY_DATED_SUPPLEMENT_NOT_MIGRATION') fail('Missing dated append-only registry entry');
if (registry.live_project_ref !== 'leqcwgzvjsxugfgzdmth' || registry.live_history_snapshot.migration_count !== 87) fail('Historic registry baseline changed');
if (prov.project !== receipt.project || receipt.project !== 'leqcwgzvjsxugfgzdmth') fail('Project mismatch');
if (prov.repository_head !== receipt.repository.sourceHead) fail('Pinned source commit differs');
if (prov.evidence !== receiptPath || prov.head_archived_statement_path !== archivePath) fail('Source evidence path mismatch');
if (prov.observed_migration_count !== 307 || prov.version_only_no_statements_count !== 217) fail('Observed counts drift');
if (receipt.migrations.total !== 307 || receipt.migrations.versionOnlyNoNameNoStatements !== 217 || receipt.migrations.withRecordedSQL !== 90) fail('Receipt counts mismatch');
if (prov.closure_release_ready !== false || receipt.closure.releaseReady !== false || receipt.closure.doNotExecute !== true) fail('Closure not fail-closed');
if (receipt.migrations.head.version !== '20261021104742' || receipt.migrations.head.archiveNotExecutable !== true) fail('Recorded SQL archive incorrectly labeled');
if (data.byteLength !== 8583 || receipt.migrations.head.bytes !== data.byteLength) fail('SQL archive byte count differs');
if (sha256(data) !== '160b0bb8101530664ab0422c513fe90429ae078da606aeaea10c8861e1209507' || receipt.migrations.head.sha256 !== sha256(data) || prov.head_archived_statement_sha256 !== sha256(data)) fail('SQL SHA-256 mismatch');
if (crypto.createHash('md5').update(data).digest('hex') !== receipt.migrations.head.md5) fail('SQL MD5 mismatch');
if (!data.toString('utf8').startsWith('-- TEST ONLY.') || !data.toString('utf8').includes('ROLLBACK')) fail('Archive content differs from recorded rollback probe');
if (prov.unproven_possible_aliases?.length !== 2 || receipt.migrations.unprovenAliasPairs?.length !== 2) fail('Unproven-alias classification missing');
console.log('PKG1A PASS: archive byte/hash match, old history preserved, closure blocked, unproven aliases flagged; no SQL executed.');
