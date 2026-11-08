'use strict';
// Opt-in, local-only reproduction of the legacy page-walk ceiling. Execute the
// actual otvorenePrilike method and its actual cursor helpers. RPC/Auth and the
// final card-enrichment boundary are synthetic; no hosted or Android claim.
// Usage: node scripts/legacy-discovery-boundary-probe.cjs --run [--source-ref SHA]
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..'), args = process.argv.slice(2);
if (!args.includes('--run')) {
  process.stdout.write('Opt-in only: node scripts/legacy-discovery-boundary-probe.cjs --run [--source-ref SHA]\n');
  process.exit(0);
}
const refAt = args.indexOf('--source-ref'), ref = refAt < 0 ? null : args[refAt + 1];
if (refAt >= 0) assert.match(ref ?? '', /^[a-f0-9]{40}$/i, 'Use an immutable full commit SHA.');
assert.deepEqual(args, ref ? ['--run', '--source-ref', ref] : ['--run']);
const read = name => ref ? execFileSync('git', ['show', `${ref}:${name}`], { cwd: ROOT, encoding: 'utf8' })
  : fs.readFileSync(path.join(ROOT, name), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const file = 'src/data/supabaseIzvor.ts', source = read(file);
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), methods = [];
function visit(node) {
  if (ts.isMethodDeclaration(node) && node.name?.getText(tree) === 'otvorenePrilike') methods.push(node);
  ts.forEachChild(node, visit);
}
visit(tree); assert.equal(methods.length, 1, 'Execute the existing client method, never a rewritten loop.');
const method = methods[0].getText(tree);
const receiptSource = read('src/data/serverReceipt.ts');
const receiptTree = ts.createSourceFile('receipt.ts', receiptSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const helpers = ['record', 'uuid'].map(name => {
  const declaration = receiptTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, name); return declaration.getText(receiptTree);
}).join('\n');
const helperModule = { exports: {} };
new Function('module', 'exports', compile(helpers))(helperModule, helperModule.exports);
const calendarModule = { exports: {} }, calendarSource = read('src/lib/calendarTime.ts');
new Function('module', 'exports', compile(calendarSource))(calendarModule, calendarModule.exports);
const { record, uuid } = helperModule.exports, { calendarInstant } = calendarModule.exports;
const code = compile(`module.exports = ({${method}}).otvorenePrilike;`);
const accountId = '00000000-0000-4000-8000-000000099999';

async function run(total) {
  let calls = 0, offset = 0, projectionBoundaryReached = false;
  const supabase = { rpc: async (name, request) => {
    assert.equal(name, 'rpc_list_open_tasks_v3'); assert.equal(request.p_limit, 200);
    calls++;
    const size = Math.min(200, total - offset);
    const items = Array.from({ length: size }, (_, i) => ({
      id: '00000000-0000-4000-8000-' + String(total - offset - i).padStart(12, '0'),
      sortAt: '2026-11-08T00:00:00.000001Z',
    }));
    offset += size;
    return { data: { items, hasMore: offset < total, asOf: '2026-11-08T00:00:01.000001Z' }, error: null };
  } };
  const module = { exports: {} };
  new Function('module', 'supabase', 'sesijaSada', 'record', 'uuid', 'calendarInstant', 'projectOpenTasks', 'console', code)(
    module, supabase, () => ({ user: { id: accountId }, accountRevision: 1 }), record, uuid, calendarInstant,
    async items => { projectionBoundaryReached = true; return items; }, { warn() {}, error() {} });
  let acceptedCount = null, error = null;
  try { acceptedCount = (await module.exports()).length; } catch (value) { error = value.message; }
  assert.equal(calls, 25);
  assert.equal(error, total > 5000 ? 'OPPORTUNITIES_TOO_MANY_PAGES' : null);
  assert.equal(acceptedCount, total > 5000 ? null : total);
  assert.equal(projectionBoundaryReached, total <= 5000);
  return { total, calls, acceptedCount, error, projectionBoundaryReached };
}
(async () => {
  const results = [];
  for (const count of [4999, 5000, 5001]) results.push(await run(count));
  process.stdout.write(JSON.stringify({
    source: { ref: ref ?? 'WORKTREE', file, fileSha256: hash(source), methodSha256: hash(method),
      cursorHelpersSha256: hash(helpers), calendarHelperSha256: hash(calendarSource) },
    boundary: 'Actual client pagination/cursor code; synthetic RPC/Auth and final card-enrichment seam. No real network, public-card decoder, hosted RLS or Android verification.',
    results,
  }, null, 2) + '\n');
})().catch(error => { process.stderr.write(String(error.stack ?? error) + '\n'); process.exitCode = 1; });
