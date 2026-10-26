// Read-only inventory. Emits an apply_patch document; never modifies source files.
// Static references are evidence of dependencies, not proof of runtime execution.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {encoding:'utf8'}).trim();
const files = execFileSync('git', ['ls-files', '-z'], {cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).sort();
const tracked = new Set(files);
const dir = 'docs/ai-stabilization/';
const ledgerPath = dir + '01B_FILE_REVIEW_LEDGER.csv';
const graphPath = dir + '01_DEPENDENCY_GRAPH.csv';
const partArgument=process.argv.find(arg=>arg.startsWith('--ledger-part='));
const textExtensions = /\.(?:[cm]?[jt]s|[jt]sx|sql|py|json|ya?ml|md|txt|csv|toml|xml|sh|ps1|gradle|properties)$/i;
const codeExtensions = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const sha = value => createHash('sha256').update(value).digest('hex');
const csv = value => '"' + String(value ?? '').replaceAll('"','""') + '"';
const row = values => values.map(csv).join(',');
const contents = new Map();
const reviewedPath = dir + 'reviewed-files.json';
const reviews = existsSync(path.join(root,reviewedPath)) ? JSON.parse(readFileSync(path.join(root,reviewedPath),'utf8')) : {};
function kind(file) {
  if (/(^|\/)\.env(?:\.|$)|\.(pem|key|keystore|jks)$/i.test(file)) return 'SECRET_RISK';
  if (/\.(png|jpe?g|webp|gif|svg|ico|ttf|otf|woff2?|mp4|webm|mp3|wav)$/i.test(file)) return 'UI_ASSET';
  if (/lock\.(json|yaml)$|package-lock\.json$/.test(file) || /(^|\/)generated\//i.test(file)) return 'GENERATED';
  if (/\.(sql)$/i.test(file)) return 'SQL';
  if (/(__tests__|\/proofs\/|[._]test\.|[._]spec\.)/.test(file)) return 'TEST';
  if (file.startsWith('.github/') || /\.(json|yaml|yml|toml|properties|xml)$/.test(file) || /(?:^|\/)[^.]*config\./.test(file)) return 'CONFIG';
  if (/\.(md|txt|csv)$/.test(file)) return 'DOCUMENTATION';
  if (codeExtensions.test(file) || /\.(?:py|ps1|sh|gradle|kt|java|swift|m|h)$/.test(file)) return 'EXECUTABLE_SOURCE';
  return 'UNKNOWN';
}
const ledger = [row(['path','sha256','bytes','classification','scope_hint','review_status','reviewer','evidence'])];
for (const file of files) {
  const full=path.join(root,file);
  if (!existsSync(full)) { ledger.push(row([file,'',0,kind(file),file.split('/')[0],'MISSING_WORKTREE','',''])); continue; }
  const bytes=readFileSync(full), type=kind(file), digest=sha(bytes);
  const record=reviews[file];
  const reviewed=record?.sha256===digest && !!record.reviewer?.trim() && !!record.evidence?.trim();
  const derived=[ledgerPath,graphPath].includes(file);
  ledger.push(row([file,derived?'DERIVED_REPORT_NO_SELF_HASH':digest,derived?'':bytes.length,type,file.split('/')[0],
    derived?'GENERATED_INVENTORY':reviewed?(record.coverage==='PARTIAL'?'PARTIALLY_REVIEWED':'CONTENT_REVIEWED'):record?'CHANGED_SINCE_REVIEW':'NOT_CONTENT_REVIEWED',
    reviewed?record.reviewer:'',reviewed?record.evidence:'']));
  if (type!=='SECRET_RISK' && textExtensions.test(file) && !bytes.includes(0)) contents.set(file,bytes.toString('utf8'));
}
const edges=new Map();
function edge(from,kind,to,line,status) {
  const values=[from,kind,to,line,status];edges.set(values.join('\0'),row(values));
}
const options={allowJs:true,allowImportingTsExtensions:true,moduleResolution:ts.ModuleResolutionKind.Bundler,
  module:ts.ModuleKind.ESNext,baseUrl:root,paths:{'@/*':['src/*'],'@/assets/*':['assets/*']}};
const sqlDefinitions=new Map();
for(const [file,body] of contents) {
  if(!file.startsWith('supabase/migrations/') || !file.endsWith('.sql')) continue;
  for(const m of body.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+((?:public|private)\.[a-zA-Z0-9_]+)\s*\(/gi)) {
    const name=m[1].toLowerCase(), defs=sqlDefinitions.get(name)??[];
    defs.push({file,line:body.slice(0,m.index).split('\n').length});sqlDefinitions.set(name,defs);
  }
}
const queue=['src/app/(app)/nova.tsx','src/app/(app)/profil/razgovor.tsx','src/app/(app)/pregled-zadatka.tsx',
  'supabase/functions/uskoci-ai-interview/index.ts','supabase/functions/uskoci-worker-interview/index.ts',
  'supabase/functions/uskoci-taxonomy-postsave-worker/index.ts'];
if(partArgument) queue.length=0;
const seen=new Set();
while(queue.length) {
  const file=queue.shift();if(seen.has(file))continue;seen.add(file);
  const body=contents.get(file);if(!body || !codeExtensions.test(file))continue;
  const source=ts.createSourceFile(file,body,ts.ScriptTarget.Latest,true);
  function visit(node) {
    const line=source.getLineAndCharacterOfPosition(node.getStart()).line+1;
    const imports=(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))?node.moduleSpecifier:
      ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||node.expression.getText(source)==='require')?node.arguments[0]:null;
    if(imports&&ts.isStringLiteralLike(imports)) {
      const spec=imports.text;
      // Explicit .mjs/.ts imports point to runtime source, not an adjacent
      // declaration file TypeScript may prefer for type-checking.
      const explicit=spec.startsWith('.') ? path.resolve(path.dirname(path.join(root,file)),spec) : null;
      const resolved=explicit && existsSync(explicit) && codeExtensions.test(explicit) ? explicit
        : ts.resolveModuleName(spec,path.join(root,file),options,ts.sys).resolvedModule?.resolvedFileName;
      const target=resolved?path.relative(root,resolved).split(path.sep).join('/'):spec;
      const local=tracked.has(target);
      const typeOnly=ts.isImportDeclaration(node)&&node.importClause?.isTypeOnly || ts.isExportDeclaration(node)&&node.isTypeOnly;
      edge(file,typeOnly?'IMPORT_TYPE':'IMPORT',target,line,local?'STATIC_LOCAL_REFERENCE':'EXTERNAL_OR_UNRESOLVED');
      if(local)queue.push(target);
    }
    if(ts.isStringLiteralLike(node)&&/^rpc_[a-z0-9_]+$/.test(node.text)) {
      const symbol='public.'+node.text;
      edge(file,'RPC_LITERAL',symbol,line,'STATIC_REFERENCE_NOT_CALL_PROOF');
      for(const def of sqlDefinitions.get(symbol)??[]) edge(symbol,'SQL_DEFINITION_CANDIDATE',def.file,def.line,'HISTORICAL_SOURCE_NOT_LIVE_AUTHORITY');
    }
    ts.forEachChild(node,visit);
  }
  visit(source);
}
function patchFor(file,body) {
  const existing=existsSync(path.join(root,file));
  const removed=existing ? readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n').trimEnd().split('\n').map(line=>'-'+line).join('\n')+'\n' : '';
  return (existing?'*** Update File: '+file+'\n@@\n'+removed:'*** Add File: '+file+'\n')+body.trimEnd().split('\n').map(line=>'+'+line).join('\n')+'\n';
}
const graph=[row(['source','relationship','target','evidence_line','evidence_limit']),...edges.values()].join('\n')+'\n';
let patch;
if(partArgument) {
  const part=Number(partArgument.split('=')[1]), size=256;
  if(!Number.isSafeInteger(part)||part<0||part*size>=ledger.length) throw new Error('Invalid ledger part');
  if(part>0) {
    const prior=readFileSync(path.join(root,ledgerPath),'utf8').trimEnd().split('\n').map(line=>line.replace(/\r$/,''));
    if(prior.length!==part*size || prior.at(-1)!==ledger[part*size-1]) throw new Error('Ledger part is not the next append');
  }
  const lines=ledger.slice(part*size,(part+1)*size);
  patch=part===0 ? patchFor(ledgerPath,lines.join('\n')+'\n')
    : '*** Update File: '+ledgerPath+'\n@@\n '+ledger[part*size-1]+'\n'+lines.map(line=>'+'+line).join('\n')+'\n';
} else patch=process.argv.includes('--graph-only') ? patchFor(graphPath,graph)
  : patchFor(ledgerPath,ledger.join('\n')+'\n')+patchFor(graphPath,graph);
process.stdout.write('*** Begin Patch\n'+patch+'*** End Patch\n');
process.stderr.write(JSON.stringify({tracked:files.length,snapshotHash:sha(ledger.join('\n')),ledgerParts:Math.ceil(ledger.length/256),contentReviewed:ledger.filter(x=>x.includes('"CONTENT_REVIEWED"')).length,staticEdges:edges.size,modulesVisited:seen.size})+'\n');
