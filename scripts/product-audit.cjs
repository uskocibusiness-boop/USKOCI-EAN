'use strict';
/** Read-only tracked-source inventory. Static reachability is never deletion approval.
 * Uses the project's existing TypeScript parser. Writes only the chosen report directory.
 * Usage: node scripts/product-audit.cjs [--out artifacts/product-audit] [--manifest file.json]
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const ts = require('typescript');
const CODE = /\.(?:[cm]?js|jsx|tsx?|mts|cts)$/i;
const FONT = /\.(?:ttf|otf|woff2?|ttc)$/i;
const ASSET = /\.(?:png|jpe?g|webp|svg|gif|mp[34]|wav|ogg|ttf|otf|woff2?|ttc)$/i;
const suffixes = ['', '.ts', '.tsx', '.mjs', '.cjs', '.js', '.jsx', '.json', '.d.ts', '.d.mts'];
const variants = ['', '.android', '.ios', '.native', '.web'];
const posix = x => x.split(path.sep).join('/');
function group(p) {
  if (p.startsWith('docs/')) return 'documentation';
  if (p.startsWith('supabase/candidates/')) return 'sql_candidate_not_deployment';
  if (p.startsWith('supabase/proofs/')) return 'verification';
  if (p.startsWith('supabase/operations/')) return 'delivery_and_recovery';
  if (p.startsWith('supabase/migrations/')) return 'migration_history_and_checks';
  if (p.includes('/__tests__/') || p.startsWith('__mocks__/') || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(p)) return 'verification';
  if (p.startsWith('src/designLab/')) return 'design_lab';
  if (ASSET.test(p) || p.startsWith('assets/')) return 'assets';
  if (p.startsWith('src/app/')) return 'navigation_entry';
  if (p.startsWith('supabase/functions/')) return 'edge_or_shared_runtime';
  if (p.startsWith('src/')) return 'mobile_runtime_or_contract';
  if (/^(scripts|plugins|modules|patches|vendor|config)\//.test(p) || p.startsWith('.github/')) return 'build_delivery_and_tools';
  if (p.endsWith('.md') || p === 'LICENSE') return 'documentation';
  return 'root_configuration';
}
function safePath(p) {
  return typeof p === 'string' && p.length > 0 && !path.posix.isAbsolute(p)
    && !p.includes('\\') && !p.includes('\0') && !p.split('/').includes('..');
}
function resolveLocal(from, specifier, known) {
  let base;
  if (specifier.startsWith('@/assets/')) base = 'assets/' + specifier.slice('@/assets/'.length);
  else if (specifier.startsWith('@/')) base = 'src/' + specifier.slice(2);
  else if (specifier.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  else return null;
  if (!safePath(base)) return [];
  const found = new Set();
  if (known.has(base)) found.add(base);
  if (path.posix.extname(base)) {
    // Explicit .js/.mjs specifiers may point to TS source under NodeNext.
    for (const [a, b] of [['.js', '.ts'], ['.js', '.tsx'], ['.mjs', '.mts'], ['.cjs', '.cts']]) {
      if (base.endsWith(a) && known.has(base.slice(0, -a.length) + b)) found.add(base.slice(0, -a.length) + b);
    }
  }
  // A dotted basename such as Map.types or File.native still needs .ts/.tsx.
  {
    for (const v of variants) for (const s of suffixes) {
      for (const candidate of [base + v + s, base + '/index' + v + s]) if (known.has(candidate)) found.add(candidate);
    }
  }
  return [...found].sort();
}
function references(filename, text) {
  const sf = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  const refs = [], dynamic = [], declarations = [];
  const add = (node, kind) => {
    if (node && ts.isStringLiteralLike(node)) refs.push({specifier: node.text, kind, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1});
    else if (node) dynamic.push({kind, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1});
  };
  function visit(n) {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) { if (n.moduleSpecifier) add(n.moduleSpecifier, 'import_or_export'); }
    else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument)) add(n.argument.literal, 'type_import');
    else if (ts.isCallExpression(n)) {
      const expr = n.expression.getText(sf);
      if (expr === 'require' || expr === 'import' || /^jest\.(mock|doMock|requireActual|requireMock)$/.test(expr)) add(n.arguments[0], expr);
    } else if (ts.isNewExpression(n) && n.expression.getText(sf) === 'URL'
      && n.arguments?.[1]?.getText(sf) === 'import.meta.url') add(n.arguments[0], 'source_relative_url');
    if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) && n.name)
      declarations.push({name: n.name.text, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, kind: ts.SyntaxKind[n.kind]});
    ts.forEachChild(n, visit);
  }
  visit(sf);
  return {refs, dynamic, declarations, parseDiagnostics: sf.parseDiagnostics.map(d => ({start: d.start, code: d.code}))};
}
function git(root, args) { return cp.execFileSync('git', ['-C', root, ...args], {maxBuffer: 32 * 1024 * 1024}).toString(); }
function tracked(root) {
  return git(root, ['ls-files', '-s', '-z']).split('\0').filter(Boolean).map(row => {
    const [meta, p] = row.split('\t'); const [mode, gitBlob, stage] = meta.split(' ');
    if (stage !== '0') throw Error('UNMERGED_INDEX');
    return {path: p, mode, gitBlob, type: 'blob'};
  });
}
function audit(root, entries) {
  const paths = entries.map(e => e.path);
  if (paths.some(p => !safePath(p)) || new Set(paths).size !== paths.length) throw Error('INVALID_OR_DUPLICATE_PATH');
  const known = new Set(paths), rows = [], edges = [], unresolved = [], dynamic = [], declarations = [], hashes = new Map();
  for (const entry of [...entries].sort((a,b) => a.path.localeCompare(b.path))) {
    const p = entry.path, full = path.join(root, p), exists = fs.existsSync(full), role = group(p);
    const row = {path: p, role, present: exists, gitBlob: entry.gitBlob ?? entry.sha ?? null,
      sourceStatus: 'INVENTORIED_NOT_SEMANTICALLY_REVIEWED', implicitRouteEntry: role === 'navigation_entry', deletionApproved: false};
    if (!exists) { row.reason = FONT.test(p) ? 'FONT_BYTES_EXCLUDED_FROM_REVIEW_ARCHIVE' : 'MISSING_SOURCE'; rows.push(row); continue; }
    const st = fs.lstatSync(full);
    const bytes = st.isSymbolicLink() ? Buffer.from(fs.readlinkSync(full)) : fs.readFileSync(full);
    row.bytes = bytes.length;
    row.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    row.currentGitBlob = crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    row.matchesRecordedBlob = row.gitBlob === null ? null : row.currentGitBlob === row.gitBlob;
    hashes.set(row.sha256, [...(hashes.get(row.sha256) || []), p]);
    if (CODE.test(p) && !st.isSymbolicLink()) {
      const result = references(p, bytes.toString('utf8'));
      row.parseDiagnostics = result.parseDiagnostics;
      for (const ref of result.refs) {
        const targets = resolveLocal(p, ref.specifier, known);
        if (targets === null) continue;
        if (!targets.length) unresolved.push({from: p, ...ref});
        else for (const to of targets) edges.push({from: p, to, kind: ref.kind, line: ref.line});
      }
      for (const x of result.dynamic) dynamic.push({from: p, ...x});
      for (const x of result.declarations) declarations.push({path: p, ...x});
    }
    rows.push(row);
  }
  const incoming = new Map(), outgoing = new Map();
  for (const e of edges) { incoming.set(e.to,(incoming.get(e.to)||0)+1); outgoing.set(e.from,(outgoing.get(e.from)||0)+1); }
  for (const r of rows) { r.staticIncoming = incoming.get(r.path)||0; r.staticOutgoing = outgoing.get(r.path)||0; }
  const byRole = {};
  for (const r of rows) byRole[r.role] = (byRole[r.role]||0)+1;
  const duplicates = [...hashes.entries()].filter(([,p])=>p.length>1).map(([sha256,files])=>({sha256,files,deletionApproved:false}));
  const summary = {trackedFiles:rows.length,presentFiles:rows.filter(x=>x.present).length,missingFiles:rows.filter(x=>!x.present).map(x=>({path:x.path,reason:x.reason})),
    byRole,staticLocalEdges:edges.length,unresolvedLocalReferences:unresolved.length,dynamicReferences:dynamic.length,
    namedDeclarations:declarations.length,byteIdenticalGroups:duplicates.length,semanticReviewComplete:false,
    limitations:['Potential static import edges include platform alternatives, not an exact Metro or Edge bundle.','Dynamic configuration, navigation, SQL, native and historical rollback references require separate review.','Zero static imports or identical bytes never authorize deletion.','No live data, secrets, provider, paid model, deployment or runtime execution.']};
  return {summary,files:rows,edges,unresolved,dynamic,declarations,duplicates};
}
function main(argv) {
  const args = {};
  for (let i=0;i<argv.length;i+=2) {
    if (!['--root','--out','--manifest'].includes(argv[i]) || !argv[i+1]) throw Error('Usage: --root path --out directory [--manifest tracked-tree.json]');
    args[argv[i]] = argv[i+1];
  }
  const root = path.resolve(args['--root'] || process.cwd());
  const out = path.resolve(args['--out'] || path.join(root,'artifacts/product-audit'));
  const entries = args['--manifest'] ? JSON.parse(fs.readFileSync(args['--manifest'],'utf8')) : tracked(root);
  if (!Array.isArray(entries)) throw Error('INVALID_MANIFEST');
  const result = audit(root, entries);
  fs.mkdirSync(out,{recursive:true});
  for (const [name,value] of Object.entries(result)) fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');
  const cols=['path','role','present','bytes','gitBlob','currentGitBlob','matchesRecordedBlob','staticIncoming','staticOutgoing','implicitRouteEntry','sourceStatus','deletionApproved'];
  const csv = value => '"'+String(value ?? '').replaceAll('"','""')+'"';
  fs.writeFileSync(path.join(out,'files.csv'),[cols.join(','),...result.files.map(row=>cols.map(c=>csv(row[c])).join(','))].join('\n')+'\n');
  console.log(JSON.stringify(result.summary,null,2));
}
module.exports={group,safePath,resolveLocal,references,audit};
if (require.main === module) { try { main(process.argv.slice(2)); } catch(e) { console.error(e.message); process.exitCode=1; } }
