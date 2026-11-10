'use strict';

// A terminal prepared Need request owns one immutable attempt/reservation.
// The legacy retry branch must not rotate its attempt behind that snapshot.
// Build a status-only increment over the exact installed R06 terminal package.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const terminal=require('./r06-terminal-dev-package.cjs');
const dormant=require('./r06-prepared-dev-package.cjs');
const preimage=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/r06_pre_provider_input_20261108.preimage.json'),'utf8'));
const signature='private.ai_need_turn_status(uuid,uuid,uuid)';
const claimSignature='private.ai_claim_need_turn_context_v1(uuid,uuid,uuid,text,jsonb)';
const before=preimage.functions.find(f=>f.identity===signature);
const claim=preimage.functions.find(f=>f.identity===claimSignature);
const anchor="state_value='FAILED' and not t.provider_dispatched and t.cancelled_at is null";
const md5=value=>crypto.createHash('md5').update(value).digest('hex');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const body=definition=>definition.split('AS $function$')[1].split('$function$')[0];
assert.equal(md5(body(before.definition)),before.body_md5);
assert.equal(md5(body(claim.definition)),claim.body_md5);
assert.equal(before.definition.split(anchor).length,2,'one retry admission owner');
const definition=before.definition.replace(anchor,anchor+' and t.prepared_at is null');
const afterHash=md5(body(definition));

function ownerGuard(statusHash){
 return `DO $r06_retry_owner$ DECLARE expected record;p pg_proc%rowtype; BEGIN
 FOR expected IN SELECT * FROM (VALUES
  ('${signature}','${statusHash}',false),
  ('${claimSignature}','${claim.body_md5}',true)
 ) v(signature,body_md5,definer) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(expected.signature);
  IF NOT FOUND OR md5(p.prosrc) IS DISTINCT FROM expected.body_md5
   OR pg_get_userbyid(p.proowner)<>'postgres' OR p.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
   OR p.prosecdef IS DISTINCT FROM expected.definer OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
   OR p.provolatile<>'v' OR p.proisstrict OR p.proleakproof OR p.prokind<>'f'
   OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
  THEN RAISE EXCEPTION 'R06_RETRY_OWNER_DRIFT:%',expected.signature USING errcode='55000';END IF;
 END LOOP;
END $r06_retry_owner$;\n`;
}

function inner(sql){
 assert.equal(sql.split('BEGIN READ ONLY;\n').length,2);
 assert.equal(sql.split('COMMIT;\n').length,2);
 return sql.split('BEGIN READ ONLY;\n')[1].split('COMMIT;\n')[0]
  .replace("SELECT 'R06_TERMINAL_DEV_POSTFLIGHT_PASS' AS status;\n",'');
}

function mutation(nextDefinition){
 // CREATE OR REPLACE must retain every catalog attribute, not just ACL.
 return `CREATE TEMP TABLE r06_retry_metadata(metadata jsonb) ON COMMIT DROP;
 INSERT INTO pg_temp.r06_retry_metadata SELECT to_jsonb(p)-'prosrc' FROM pg_proc p
  WHERE oid='${signature}'::regprocedure;
 ${nextDefinition.trim()};
 DO $r06_retry_metadata$ BEGIN
  IF (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE oid='${signature}'::regprocedure)
   IS DISTINCT FROM (SELECT metadata FROM pg_temp.r06_retry_metadata)
  THEN RAISE EXCEPTION 'R06_RETRY_METADATA_CHANGED';END IF;
 END $r06_retry_metadata$;\n`;
}

function buildPackage(capture,dependencies){
 const base=terminal.buildPackage(capture,dependencies);
 const baseline=inner(base.postflight);
 const identity=baseline.match(/DO \$r06_project\$[\s\S]*?END \$r06_project\$;\n/)?.[0];
 assert.ok(identity,'physical project identity must precede locks');
 const prior=baseline+ownerGuard(before.body_md5),after=baseline+ownerGuard(afterHash);
 const settings="SET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='30s';\nSET LOCAL search_path=pg_catalog;\n";
 const lock=`LOCK TABLE ${dormant.TABLES.join(',')} IN SHARE ROW EXCLUSIVE MODE;\n`;
 const drain=`DO $r06_retry_drain$ BEGIN
  IF EXISTS(SELECT 1 FROM private.ai_need_turn_commands WHERE state='PROCESSING' AND lease_expires_at>clock_timestamp())
  THEN RAISE EXCEPTION 'R06_RETRY_ACTIVE_TURN_DRAIN_REQUIRED' USING errcode='55000';END IF;
 END $r06_retry_drain$;\n`;
 const caption=`-- R06 prepared Need retry fence; DEV ${dormant.PROJECT} only.\n`+
  '-- Changes only retry admission in the existing status owner. No data, attempt, budget, policy or runtime changes.\n';
 const outputs={
  preflight:caption+'BEGIN READ ONLY;\n'+prior+"SELECT 'R06_RETRY_DEV_PREFLIGHT_PASS' AS status;\nCOMMIT;\n",
  install:caption+'BEGIN;\n'+settings+identity+lock+drain+prior+mutation(definition)+after+"SELECT 'R06_RETRY_DEV_INSTALLED' AS status;\nCOMMIT;\n",
  postflight:caption+'BEGIN READ ONLY;\n'+after+"SELECT 'R06_RETRY_DEV_POSTFLIGHT_PASS' AS status;\nCOMMIT;\n",
  rollback:caption+'BEGIN;\n'+settings+identity+lock+drain+after+mutation(before.definition)+prior+"SELECT 'R06_RETRY_DEV_ROLLBACK_PASS' AS status;\nCOMMIT;\n",
 };
 return {...outputs,manifest:{schema:'USKOCI_R06_PREPARED_RETRY_DEV_PACKAGE_V1',projectRef:dormant.PROJECT,
  systemIdentifier:capture.system_identifier,signature,beforeHash:before.body_md5,afterHash,
  unchangedClaim:{signature:claimSignature,bodyMd5:claim.body_md5},
  baselinePostflightSha256:sha(base.postflight),generatorSha256:sha(fs.readFileSync(__filename)),
  files:Object.fromEntries(Object.entries(outputs).map(([key,sql])=>[key,{bytes:Buffer.byteLength(sql),sha256:sha(sql)}])),
  scope:'Terminal prepared requests cannot receive a new attempt under the same request identity. Active same-attempt recovery and legacy unprepared retry remain unchanged.',
  rollback:'CODE_ONLY; restores legacy retry admission and preserves all data/identities/reservations; the original retry defect would return.',
  limitations:'Does not activate R06, change policy/retention/erasure gates, prove provider outcomes, or complete Android acceptance.',
 }};
}

module.exports={buildPackage,signature,claimSignature,definition,beforeHash:before.body_md5,afterHash};
if(require.main===module){
 const [capturePath,prefix]=process.argv.slice(2);
 if(!capturePath||!prefix)throw new Error('Usage: node scripts/r06-prepared-retry-dev-package.cjs BASELINE_CAPTURE_JSON OUTPUT_PREFIX');
 for(const [key,value]of Object.entries(buildPackage(JSON.parse(fs.readFileSync(capturePath,'utf8'))))){
  const output=`${prefix}.${key==='manifest'?'manifest.json':key+'.sql'}`;
  fs.writeFileSync(output,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
  process.stdout.write(path.resolve(output)+'\n');
 }
}
