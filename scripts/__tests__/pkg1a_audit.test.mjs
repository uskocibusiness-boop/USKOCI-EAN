import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const realRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const paths = [
  'supabase/migrations/MIGRATION_PROVENANCE.json',
  'supabase/operations/dev-alpha/ledger/20261021104742_closure_executor_rollback_probe.sql.txt',
  'supabase/operations/dev-alpha/ledger/20261022_pkg1a_readonly_receipt.json',
  'scripts/pkg1a_audit.mjs',
];
function runWithMutation(mutator) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg1a-test-'));
  try {
    for (const rel of paths) {
      const dst = path.join(tmp, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(path.join(realRoot, rel), dst);
    }
    if (mutator) mutator(tmp);
    return spawnSync(process.execPath, [path.join(tmp, 'scripts/pkg1a_audit.mjs')], {encoding:'utf8'});
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
}
test('original proof succeeds', () => { const p=runWithMutation(); assert.equal(p.status,0,p.stderr); assert.match(p.stdout,/PKG1A PASS/); });
test('archive tampering is detected', () => { const p=runWithMutation(tmp=>fs.appendFileSync(path.join(tmp,paths[1]),'x')); assert.notEqual(p.status,0); });
test('closure cannot be marked ready', () => { const p=runWithMutation(tmp=>{const f=path.join(tmp,paths[2]);const j=JSON.parse(fs.readFileSync(f));j.closure.releaseReady=true;fs.writeFileSync(f,JSON.stringify(j));});assert.notEqual(p.status,0); });
test('historical baseline cannot silently change', () => { const p=runWithMutation(tmp=>{const f=path.join(tmp,paths[0]);const j=JSON.parse(fs.readFileSync(f));j.live_history_snapshot.migration_count=307;fs.writeFileSync(f,JSON.stringify(j));});assert.notEqual(p.status,0); });
test('unproven aliases cannot disappear', () => { const p=runWithMutation(tmp=>{const f=path.join(tmp,paths[0]);const j=JSON.parse(fs.readFileSync(f));j.pkg1a_readonly_reconciliation_20261022.unproven_possible_aliases=[];fs.writeFileSync(f,JSON.stringify(j));});assert.notEqual(p.status,0); });
