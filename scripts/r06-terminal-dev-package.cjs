'use strict';

// Increment the installed dormant R06 package; do not reinstall or enable it.
// Reuse its exact postflight as the dependency contract, including table RLS,
// constraints, grants, closure/export owners and the physical DEV identity.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dormant=require('./r06-prepared-dev-package.cjs');
const sourcePath=path.join(__dirname,'sql/r06_prepared_terminal_input_20261110.sql');
const rollbackPath=path.join(__dirname,'sql/r06_prepared_terminal_input_20261110.rollback.sql');
const dependencyPath=path.join(__dirname,'sql/r06_terminal_dev_20261110.dependencies.json');
const signature='private.ai_turn_sweep_v5(timestamp with time zone)';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const md5=value=>crypto.createHash('md5').update(value).digest('hex');

function innerTransaction(sql,start,end){
 assert.equal(sql.split(start).length,2,'one reviewed transaction start');
 const value=sql.slice(sql.indexOf(start)+start.length);
 assert.equal(value.split(end).length,2,'one reviewed transaction end');
 const inner=value.slice(0,value.lastIndexOf(end));
 assert.ok(!/^BEGIN;|^COMMIT;/m.test(inner),'nested transactions are not permitted');
 return inner;
}

function buildPackage(capture,dependencies=JSON.parse(fs.readFileSync(dependencyPath,'utf8'))){
 const base=dormant.buildPackage(capture);
 const source=fs.readFileSync(sourcePath,'utf8'),rollbackSource=fs.readFileSync(rollbackPath,'utf8');
 assert.ok(source.includes("RAISE EXCEPTION 'R06_TERMINAL_INPUT_SOURCE_ONLY'"));
 assert.ok(rollbackSource.includes("RAISE EXCEPTION 'R06_TERMINAL_ROLLBACK_SOURCE_ONLY'"));
 const beforeHash=base.manifest.postFunctions.find(x=>x.signature===signature)?.body_md5;
 const post=source.match(/^-- R06_TERMINAL_POSTIMAGE (.+) ([a-f0-9]{32})$/m);
 assert.equal(post?.[1],signature);const afterHash=post[2];
 const sourceBody=source.split('AS $function$')[1]?.split('$function$')[0];
 const rollbackBody=rollbackSource.split('AS $function$')[1]?.split('$function$')[0];
 assert.equal(md5(sourceBody),afterHash,'postimage must match executable source');
 assert.equal(md5(rollbackBody),beforeHash,'rollback must restore installed owner');
 assert.ok(source.includes(`md5(p.prosrc) IS DISTINCT FROM '${beforeHash}'`));
 assert.ok(rollbackSource.includes(`md5(p.prosrc) IS DISTINCT FROM '${afterHash}'`));
 const oldStatus="SELECT 'R06_DEV_POSTFLIGHT_PASS_DORMANT_ONLY' AS status;\n";
 let before=innerTransaction(base.postflight,'BEGIN READ ONLY;\n','COMMIT;\n');
 assert.equal(before.split(oldStatus).length,2);before=before.replace(oldStatus,'');
 assert.equal(dependencies.projectRef,dormant.PROJECT);assert.equal(dependencies.tables.length,1);
 const qa=dependencies.tables[0];assert.equal(qa.relation,'private.qa_ai_commands');
 assert.equal(qa.owner,'postgres');assert.equal(qa.rls,true);
 assert.ok(qa.constraints.some(c=>c.type==='p'&&c.definition==='PRIMARY KEY (id)'));
 const qaJson=JSON.stringify(qa);assert.ok(!qaJson.includes('$r06_qa_table$'));
 before+=`DO $r06_qa_dependency$ DECLARE actual jsonb; BEGIN
 ${dormant.tableSql("'private.qa_ai_commands'")} INTO actual;
 IF actual IS DISTINCT FROM $r06_qa_table$${qaJson}$r06_qa_table$::jsonb
 THEN RAISE EXCEPTION 'R06_TERMINAL_DEV_QA_DEPENDENCY_DRIFT' USING errcode='55000'; END IF;
END $r06_qa_dependency$;\n`;
 assert.equal(before.split(beforeHash).length,2,'only the installed sweep digest may change');
 const after=before.replace(beforeHash,afterHash);
 const identity=before.match(/DO \$r06_project\$[\s\S]*?END \$r06_project\$;\n/)?.[0];
 assert.ok(identity,'physical DEV identity must be checked before taking locks');
 const forward=innerTransaction(source,'-- R06_TERMINAL_INPUT_ISOLATED_START\nBEGIN;\n','COMMIT;\n');
 const reverse=innerTransaction(rollbackSource,'-- R06_TERMINAL_ROLLBACK_ISOLATED_START\nBEGIN;\n','COMMIT;\n');
 const caption=`-- R06 terminal-input incremental DEV operation for ${dormant.PROJECT}.\n`+
  '-- Changes only the existing sweep; no activation, policy pin, budget or provider operation.\n'+
  '-- Rollback restores code and preserves every retained input and command marker.\n';
 const lock=`LOCK TABLE ${dormant.TABLES.join(',')} IN SHARE ROW EXCLUSIVE MODE;\n`+
  `LOCK TABLE ${[...dormant.DEPENDENCY_TABLES,qa.relation].join(',')} IN ACCESS SHARE MODE;\n`;
 const drain=`DO $r06_terminal_drain$ BEGIN
 IF EXISTS(SELECT 1 FROM private.ai_need_turn_commands WHERE state='PROCESSING' AND lease_expires_at>clock_timestamp())
  OR EXISTS(SELECT 1 FROM private.worker_ai_turns WHERE state='PROCESSING' AND lease_expires_at>clock_timestamp())
 THEN RAISE EXCEPTION 'R06_TERMINAL_DEV_ACTIVE_TURN_DRAIN_REQUIRED' USING errcode='55000'; END IF;
END $r06_terminal_drain$;\n`;
 const settings="SET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='30s';\nSET LOCAL search_path=pg_catalog;\n";
 const preflight=caption+'BEGIN READ ONLY;\n'+before+"SELECT 'R06_TERMINAL_DEV_PREFLIGHT_PASS' AS status;\nCOMMIT;\n";
 const postflight=caption+'BEGIN READ ONLY;\n'+after+"SELECT 'R06_TERMINAL_DEV_POSTFLIGHT_PASS' AS status;\nCOMMIT;\n";
 const install=caption+'BEGIN;\n'+settings+identity+lock+drain+before+forward+after+"SELECT 'R06_TERMINAL_DEV_INSTALLED' AS status;\nCOMMIT;\n";
 const rollback=caption+'BEGIN;\n'+settings+identity+lock+drain+after+reverse+before+"SELECT 'R06_TERMINAL_DEV_ROLLBACK_PASS' AS status;\nCOMMIT;\n";
 const outputs={preflight,install,postflight,rollback};
 const manifest={schema:'USKOCI_R06_TERMINAL_DEV_PACKAGE_V1',projectRef:dormant.PROJECT,
  systemIdentifier:capture.system_identifier,baselineCaptureCanonicalSha256:sha(JSON.stringify(capture)),
  baselinePostflightSha256:sha(base.postflight),generatorSha256:sha(fs.readFileSync(__filename)),
  qaDependencyCanonicalSha256:sha(JSON.stringify(dependencies)),
  sourceSha256:sha(source),rollbackSourceSha256:sha(rollbackSource),signature,beforeHash,afterHash,
  files:Object.fromEntries(Object.entries(outputs).map(([key,sql])=>[key,{bytes:Buffer.byteLength(sql),sha256:sha(sql)}])),
  activation:'UNCHANGED; runtime flag, hosted recovery, retention policy and Android acceptance are separate',
  rollback:'CODE_ONLY; preserves retained user text and original request/provider/reservation markers',
 };
 return {...outputs,manifest};
}
module.exports={buildPackage};
if(require.main===module){
 const [capturePath,prefix]=process.argv.slice(2);
 if(!capturePath||!prefix)throw new Error('Usage: node scripts/r06-terminal-dev-package.cjs BASELINE_CAPTURE_JSON OUTPUT_PREFIX');
 for(const [name,value] of Object.entries(buildPackage(JSON.parse(fs.readFileSync(capturePath,'utf8'))))){
  const output=`${prefix}.${name==='manifest'?'manifest.json':name+'.sql'}`;
  fs.writeFileSync(output,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
  process.stdout.write(path.resolve(output)+'\n');
 }
}
