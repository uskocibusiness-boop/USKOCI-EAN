'use strict';
/**
 * CLEANROOM EVIDENCE. No deletion, no file moves, no DB/Edge calls.
 * Enumerates every tracked file and independently labels integrity, static
 * syntax, direct references and semantic review status.
 *
 * npm ci; node scripts/cleanroom-file-ledger.cjs [absolute-output-directory]
 * The existing product-audit.cjs is the sole import-graph inventory engine.
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const SOURCE = /\.(?:tsx?|jsx?|[cm]js|mts|cts)$/i;
const JSON_FILE = /\.json$/i;
const PYTHON_FILE = /\.py$/i;

function areaOf(filename) {
  const p = filename.replaceAll('\\', '/');
  if (p.startsWith('src/features/ai/') || /^src\/(?:data\/)?(?:.*[aA]i.*|.*[iI]ntake.*)$/.test(p)
      || p.startsWith('src/ui/aiFirst/') || p.startsWith('src/ui/aiHistory/')) return 'AI_INTERVIEW';
  if (p.startsWith('src/app/')) return 'NAVIGATION';
  if (p.startsWith('src/ui/system/') || p.startsWith('src/theme/') || p.startsWith('assets/')) return 'DESIGN_ASSETS';
  if (/agreement|dogovor|cancellation/i.test(p)) return 'AGREEMENTS';
  if (/message|poruk|inbox|push|notification/i.test(p)) return 'COMMUNICATION';
  if (/worker|profil|profile/i.test(p)) return 'WORKER_PROFILE';
  if (/task|need|discovery|zadaci|application|prijav/i.test(p)) return 'TASKS_MATCHING';
  if (/supabase\/(?:functions|migrations|operations|candidates|proofs)/.test(p)) return 'BACKEND_AND_PROOFS';
  if (p.startsWith('src/')) return 'SHARED_RUNTIME';
  if (p.startsWith('docs/')) return 'DOCUMENTATION';
  return 'BUILD_AND_TOOLING';
}

function checkSource(p, contents) {
  if (JSON_FILE.test(p)) {
    try { JSON.parse(contents.toString('utf8')); return 'JSON_PARSED'; }
    catch (_) { return 'INVALID_JSON'; }
  }
  if (SOURCE.test(p)) return 'TYPESCRIPT_AST_SCANNED';
  if (PYTHON_FILE.test(p)) return 'PYTHON_COMPILE_IN_CI';
  if (/\.(?:png|jpg|jpeg|webp|gif)$/i.test(p)) {
    if (p.toLowerCase().endsWith('.png')) return contents.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'PNG_SIGNATURE_OK' : 'INVALID_PNG_SIGNATURE';
    if (p.toLowerCase().endsWith('.webp')) return contents.toString('ascii',0,4)==='RIFF' && contents.toString('ascii',8,12)==='WEBP' ? 'WEBP_SIGNATURE_OK' : 'INVALID_WEBP_SIGNATURE';
    if (/\.(?:jpg|jpeg)$/i.test(p)) return contents[0]===255 && contents[1]===216 ? 'JPEG_SIGNATURE_OK' : 'INVALID_JPEG_SIGNATURE';
    return 'MEDIA_PRESENT';
  }
  if (/\.sql$/i.test(p)) return 'SQL_NOT_PARSED_WITH_DATABASE';
  if (/\.svg$/i.test(p)) return 'SVG_SOURCE_PRESENT_NOT_RENDERED';
  if (/\.md$/i.test(p)) return 'DOC_SOURCE_PRESENT';
  return 'FILE_PRESENT';
}
function csvCell(s) { return '"'+String(s??'').replaceAll('"','""').replaceAll('\r',' ').replaceAll('\n',' ')+'"'; }
function ensureDestination(base) {
  const p = path.resolve(base);
  if (p===path.resolve('.') || !p.includes(path.sep)) throw Error('INVALID_OUTPUT');
  fs.mkdirSync(p,{recursive:true});
  return p;
}
function reviewFlags(row, unresolved, dynamics) {
  const flags=[];
  if (row.present===false) flags.push('FILE_UNAVAILABLE');
  if (row.matchesRecordedBlob===false) flags.push('GIT_BLOB_MISMATCH');
  if (row.staticIncoming===0) flags.push('ZERO_DIRECT_STATIC_IMPORTS_NOT_DELETION_PERMISSION');
  if (row.implicitRouteEntry) flags.push('EXPO_ROUTE_IS_ENTRY_WITHOUT_IMPORT');
  if ((row.parseDiagnostics||[]).length) flags.push('AST_SYNTAX_DIAGNOSTICS');
  if (unresolved) flags.push('UNRESOLVED_LOCAL_REFERENCE');
  if (dynamics) flags.push('DYNAMIC_REFERENCE_REQUIRES_MANUAL_CHECK');
  if (row.bytes>45000 && /\.(?:tsx?|jsx?)$/.test(row.path)) flags.push('LARGE_SOURCE_REVIEW_PERFORMANCE_AND_OWNERSHIP');
  if (row.role==='migration_history_and_checks') flags.push('HISTORIC_DB_MIGRATION_DO_NOT_REMOVE');
  if (row.role==='sql_candidate_not_deployment') flags.push('SQL_CANDIDATE_MUST_CHECK_LEDGER_DEPENDENCIES');
  if (row.role==='delivery_and_recovery') flags.push('ROLLBACK_DELIVERY_EVIDENCE_CHECK_BEFORE_RETIRING');
  return flags;
}
function run(outputDir) {
  const destination=ensureDestination(outputDir || path.join(process.cwd(),'artifacts/cleanroom-file-ledger'));
  const originalOut=path.join(destination,'source-audit');
  cp.execFileSync(process.execPath,[path.join(__dirname,'product-audit.cjs'),'--out',originalOut],
    {cwd:path.resolve(__dirname,'..'),encoding:'utf8',maxBuffer:32*1024*1024});
  const load=name=>JSON.parse(fs.readFileSync(path.join(originalOut,name+'.json'),'utf8'));
  const raw=load('files'), summary=load('summary'), edges=load('edges'), unresolved=load('unresolved'), dynamic=load('dynamic'), duplicates=load('duplicates');
  const wrong=raw.filter(x=>x.matchesRecordedBlob===false || !x.present);
  if (wrong.length) throw Error('SOURCE_INTEGRITY_FAILED '+JSON.stringify(wrong.map(x=>x.path).slice(0,20)));
  if (new Set(raw.map(x=>x.path)).size!==raw.length) throw Error('DUPLICATED_SOURCE_PATHS');
  const unresolvedBy=new Map(), dynamicBy=new Map();
  for(const e of unresolved)unresolvedBy.set(e.from,(unresolvedBy.get(e.from)||0)+1);
  for(const e of dynamic)dynamicBy.set(e.from,(dynamicBy.get(e.from)||0)+1);
  const ledger=[],invalid=[];
  const roles={},areas={},bytesByArea={};
  for(const row of raw){
    const src=fs.readFileSync(path.resolve(process.cwd(),row.path));
    const check=checkSource(row.path,src);
    const area=areaOf(row.path);
    const flags=reviewFlags(row,unresolvedBy.get(row.path)||0,dynamicBy.get(row.path)||0);
    if(check.startsWith('INVALID_')) invalid.push({path:row.path,check});
    ledger.push({
      path:row.path,area,role:row.role,bytes:row.bytes,
      sha256:row.sha256,gitBlob:row.gitBlob,gitBlobMatches:true,integrity:'VERIFIED',
      staticSyntax:check,staticIncoming:row.staticIncoming,staticOutgoing:row.staticOutgoing,
      unresolvedLocalRefs:unresolvedBy.get(row.path)||0,dynamicRefs:dynamicBy.get(row.path)||0,
      requires:flags,semanticCodeReview:'PENDING',runtimeE2E:'NOT_PROVEN_PER_FILE',
      deletionApproved:false
    });
    roles[row.role]=(roles[row.role]||0)+1;
    areas[area]=(areas[area]||0)+1;
    bytesByArea[area]=(bytesByArea[area]||0)+(row.bytes||0);
  }
  const total=ledger.length;
  if(total!==summary.trackedFiles)throw Error('FILE_COVERAGE_MISMATCH');
  const report={
    kind:'USKOCI_CLEANROOM_FILE_LEDGER_V1',sourceSha:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    countedTracked:total,verifiedSourceFiles:ledger.filter(x=>x.integrity==='VERIFIED').length,
    semanticFilesReviewed:0,semanticReviewComplete:false,
    executableSyntaxCheckedElsewhere:'TypeScript --noEmit, Jest, Python compile, Node AI contracts and Android Metro in accompanying CI',
    staticParsedSource:ledger.filter(x=>x.staticSyntax==='TYPESCRIPT_AST_SCANNED').length,
    jsonParsed:ledger.filter(x=>x.staticSyntax==='JSON_PARSED').length,
    jsonInvalid:invalid,
    staticEdges:edges.length,unresolvedStaticReferences:unresolved.length,dynamicReferences:dynamic.length,
    duplicateByteGroups:duplicates.length,
    byRole:roles,byArea:areas,bytesByArea,
    largestSource:ledger.filter(x=>SOURCE.test(x.path)).sort((a,b)=>b.bytes-a.bytes).slice(0,35)
      .map(x=>({path:x.path,bytes:x.bytes,staticIncoming:x.staticIncoming,flags:x.requires})),
    attention:ledger.filter(x=>x.requires.includes('AST_SYNTAX_DIAGNOSTICS')||x.requires.includes('GIT_BLOB_MISMATCH')||x.requires.includes('FILE_UNAVAILABLE'))
      .map(x=>({path:x.path,flags:x.requires})).slice(0,100),
    restrictions:[
      'Completeness means every tracked source file has an integrity and inventory row, NOT that its business logic has been manually verified.',
      'TS AST static imports do not capture dynamic Expo Router, native, SQL, config, providers or every code-generation dependency.',
      'Zero incoming imports, exact duplicate bytes, large file size or green Jest results NEVER authorize deletion.',
      'SQL, dynamic references, AI live providers, Auth, DEV, EAS native and user UX require independent focused acceptance.',
      'No writes to user data, Edge, DEV, OTA, production, provider or any source file.',
    ]
  };
  fs.writeFileSync(path.join(destination,'REPORT.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(destination,'FILE_LEDGER.json'),JSON.stringify(ledger,null,2)+'\n');
  const cols=['path','area','role','bytes','integrity','staticSyntax','staticIncoming','staticOutgoing','unresolvedLocalRefs','dynamicRefs','semanticCodeReview','runtimeE2E','deletionApproved','requires','sha256'];
  fs.writeFileSync(path.join(destination,'FILE_LEDGER.csv'),[cols.join(','),...ledger.map(row=>cols.map(k=>csvCell(Array.isArray(row[k])?row[k].join(';'):row[k])).join(','))].join('\n')+'\n');
  const runtime=ledger.filter(x=>['mobile_runtime_or_contract','navigation_entry','edge_or_shared_runtime'].includes(x.role));
  fs.writeFileSync(path.join(destination,'RUNTIME_REVIEW_QUEUE.json'),JSON.stringify(runtime.sort((a,b)=>b.bytes-a.bytes),null,2)+'\n');
  if(invalid.length)throw Error('INVALID_FILE_HEADER_OR_JSON '+JSON.stringify(invalid.slice(0,16)));
  console.log('CLEANROOM_INVENTORY '+JSON.stringify({source:report.sourceSha,tracked:total,matched:report.verifiedSourceFiles,staticEdges:report.staticEdges,unresolved:report.unresolvedStaticReferences,codeReviewComplete:false,largestCodeFile:report.largestSource[0]?.path}));
  return report;
}
module.exports={areaOf,checkSource,reviewFlags,run};
if(require.main===module){try{run(process.argv[2]);}catch(error){console.error(error.message);process.exitCode=1;}}
