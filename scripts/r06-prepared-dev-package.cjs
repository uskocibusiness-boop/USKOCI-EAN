'use strict';

// Build a dormant, project-bound operation from the unchanged tested candidate.
// This module never connects to a database, changes an Edge flag or sends a model request.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const PROJECT = 'leqcwgzvjsxugfgzdmth';
const SOURCE = path.join(__dirname, 'sql/r06_pre_provider_input_20261108.sql');
const LIFECYCLE_SOURCE = path.join(__dirname, 'sql/r06_prepared_input_lifecycle_20261110.sql');
const TABLES = ['private.ai_need_turn_commands', 'private.worker_ai_turns'];
const DEPENDENCY_TABLES = ['private.retention_holds', 'public.ai_messages'];
const GUARDED_TABLES = [...TABLES, ...DEPENDENCY_TABLES];
const ADDED_COLUMNS = ['prepared_input', 'prepared_input_sha256', 'prepared_at', 'prepared_reservation_id'];
// Verified by the executing fixture against PostgreSQL's parsed constraint.
const PREPARED_CONSTRAINT_MD5 = '5e2c512104597153b399405de57b9a21';
const NEW_FUNCTIONS = [
  'private.r06_prepared_input_owner_v1(uuid,uuid,uuid,text)',
  'public.rpc_ai_prepare_input_service(uuid,uuid,uuid,uuid,text,jsonb)',
  'public.rpc_ai_read_prepared_input_service(uuid,uuid,uuid,text)',
  'public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text)',
];
const PRIVACY_FUNCTIONS = [
  'private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)',
  'private.data_export_dataset_catalog()',
  'private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)',
  'private.ai_turn_sweep_v5(timestamp with time zone)',
];
const ADDITIONAL_PINS = [
  { signature: 'private.ai_turn_sweep_v5(timestamp with time zone)', body_md5: '9d89b9af2e893bc608e7598d175551b7' },
  { signature: 'private.ai_test_price_microusd(integer,integer)', body_md5: '87ad940334ae78be5a3c0b19983d5981' },
  { signature: 'private.closure_account_key(uuid)', body_md5: '2dde6ad2462255b188e4f03ffe88edcd', security_definer: false },
  { signature: 'private.closure_account_restricted(uuid)', body_md5: 'f4999250c315e0253374d4611291c7ad' },
];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const md5 = value => crypto.createHash('md5').update(value).digest('hex');
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const literal = (value, tag) => {
  const marker = `$r06_${tag}$`;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  assert.ok(!text.includes(marker), `ambiguous ${tag} delimiter`);
  return marker + text + marker;
};
const body = definition => {
  const match = /AS (\$[A-Za-z_0-9]*\$)([\s\S]*)\1\s*;?\s*$/.exec(definition);
  assert.ok(match, 'captured SQL function body is required');
  return match[2];
};

function sourceContract() {
  const source = fs.readFileSync(SOURCE, 'utf8');
  assert.ok(source.includes("RAISE EXCEPTION 'R06_PRE_PROVIDER_SOURCE_ONLY'"));
  const marker = '-- R06_PRE_PROVIDER_ISOLATED_START';
  assert.equal(source.split(marker).length, 2);
  const candidate = source.slice(source.indexOf(marker));
  const guard = candidate.slice(candidate.indexOf('FOR x IN SELECT'), candidate.indexOf(') v(signature,body_md5)'));
  const pins = [...guard.matchAll(/\('([^']+)','([0-9a-f]{32})'\)/g)].map(match => ({ signature: match[1], body_md5: match[2] }));
  assert.equal(pins.length, 9);
  const patches = [...candidate.matchAll(/DO \$patch\$[\s\S]*?old_text text:=\$old\$([\s\S]*?)\$old\$[\s\S]*?pg_get_functiondef\('([^']+)'::regprocedure\)[\s\S]*?EXECUTE replace\(d,old_text,\$new\$([\s\S]*?)\$new\$\);[\s\S]*?END \$patch\$;/g)]
    .map(match => ({ from: match[1], signature: match[2], to: match[3] }));
  assert.equal(patches.length, 5);
  const functions = [...candidate.matchAll(/CREATE FUNCTION ([\s\S]*?)AS \$function\$([\s\S]*?)\$function\$;/g)];
  assert.equal(functions.length, 4);
  const lifecycleSource = fs.readFileSync(LIFECYCLE_SOURCE, 'utf8');
  assert.ok(lifecycleSource.includes("RAISE EXCEPTION 'R06_PREPARED_PRIVACY_SOURCE_ONLY'"));
  const lifecycleMarker = '-- R06_PREPARED_PRIVACY_ISOLATED_START';
  assert.equal(lifecycleSource.split(lifecycleMarker).length, 2);
  const lifecycleCandidate = lifecycleSource.slice(lifecycleSource.indexOf(lifecycleMarker));
  const lifecyclePostimages = [...lifecycleSource.matchAll(/^-- R06_LIFECYCLE_POSTIMAGE (.+) ([a-f0-9]{32})$/gm)]
    .map(match => ({ signature: match[1], body_md5: match[2] }));
  assert.deepEqual(lifecyclePostimages.map(value => value.signature).sort(), [
    'public.rpc_ai_dispatch_prepared_input_service(uuid,uuid,uuid,uuid,text,text)',
    'private.ai_turn_sweep_v5(timestamp with time zone)',
    'private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)',
  ].sort(), 'three verified lifecycle postimage markers are required');
  return { source, candidate, pins: [...pins, ...ADDITIONAL_PINS], patches,
    newBodies: functions.map(match => md5(match[2])), lifecycleSource, lifecycleCandidate, lifecyclePostimages };
}

// Identical query is used by preflight, postflight and the independent fixture.
// OIDs and internal RI trigger names are excluded; foreign keys are checked in constraints.
function tableSql(relationExpression = 'expected->>\'relation\'') {
  return `SELECT jsonb_build_object(
 'relation',n.nspname||'.'||c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
 'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',x.conname,'type',x.contype,'definition',pg_get_constraintdef(x.oid,true),'validated',x.convalidated,'deferrable',x.condeferrable,'deferred',x.condeferred) ORDER BY x.conname),'[]'::jsonb) FROM pg_constraint x WHERE x.conrelid=c.oid),
 'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled,'internal',t.tgisinternal,'function',t.tgfoid::regprocedure::text) ORDER BY t.tgname),'[]'::jsonb) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),
 'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT array_agg(CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END ORDER BY r) FROM unnest(p.polroles) r),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname),'[]'::jsonb) FROM pg_policy p WHERE p.polrelid=c.oid)
 ) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=to_regclass(${relationExpression})`;
}

function functionSql(signatureExpression = "expected->>'signature'") {
  return `SELECT jsonb_build_object('signature',${signatureExpression},'body_md5',md5(p.prosrc),
 'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'security_definer',p.prosecdef,
 'config',p.proconfig,'language',l.lanname,'volatility',p.provolatile,'strict',p.proisstrict,
 'leakproof',p.proleakproof,'parallel',p.proparallel,'kind',p.prokind,'cost',p.procost,'rows',p.prorows,
 'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),
 'argument_defaults',pg_get_expr(p.proargdefaults,0),'definition',pg_get_functiondef(p.oid))
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure(${signatureExpression})`;
}

function normalizeTable(table) {
  return { ...table, triggers: table.triggers.filter(trigger => !trigger.internal) };
}

function buildPackage(capture) {
  const contract = sourceContract();
  assert.equal(capture.projectRef, PROJECT);
  assert.match(capture.system_identifier, /^[0-9]{10,20}$/);
  assert.equal(capture.database, 'postgres');
  const tables = GUARDED_TABLES.map(relation => {
    const table = capture.tables.find(value => value.relation === relation);
    assert.ok(table, `missing table ${relation}`);
    assert.equal(table.owner, 'postgres');
    assert.equal(table.rls, true);
    assert.ok(!table.columns.some(column => ADDED_COLUMNS.includes(column.name)));
    return normalizeTable(table);
  });
  const functions = contract.pins.map(pin => {
    const fn = capture.functions.find(value => value.signature === pin.signature);
    assert.ok(fn, `missing function ${pin.signature}`);
    assert.equal(md5(body(fn.definition)), pin.body_md5, pin.signature);
    assert.equal(fn.body_md5, pin.body_md5, pin.signature);
    assert.equal(fn.owner, 'postgres');
    assert.equal(fn.security_definer, pin.security_definer ?? true);
    // Preserve the current owner metadata. The budget owner intentionally has
    // a different, already-reviewed search_path; this rollout does not unify it.
    assert.ok(Array.isArray(fn.config));
    assert.equal(fn.acl, pin.signature.startsWith('public.') ? '{postgres=X/postgres,service_role=X/postgres}' : '{postgres=X/postgres}');
    return fn;
  });
  const postFunctions = functions.map(fn => {
    let definition = fn.definition;
    for (const patch of contract.patches.filter(value => value.signature === fn.signature)) {
      assert.equal(definition.split(patch.from).length, 2, `unique privacy anchor ${fn.signature}`);
      definition = definition.replace(patch.from, patch.to);
    }
    return { ...fn, definition, body_md5: contract.lifecyclePostimages.find(value => value.signature === fn.signature)?.body_md5 ?? md5(body(definition)) };
  });
  const caption = `-- R06 dormant DEV package. Project ${PROJECT}; source SHA256 ${sha(contract.source)}.\n` +
    `-- Lifecycle companion SHA256 ${sha(contract.lifecycleSource)}.\n` +
    '-- No Edge toggle, secret, budget, Cron, policy certification or provider call.\n' +
    '-- Keep USKOCI_AI_PREPARED_INPUT_ENABLED off until separate hosted/lifecycle acceptance.\n';
  const settings = "SET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='30s';\nSET LOCAL search_path=pg_catalog;\n";
  const identityGuard = `DO $r06_project$ BEGIN
 IF current_user<>'postgres' OR current_database()<>'postgres'
  OR (SELECT system_identifier::text FROM pg_control_system()) IS DISTINCT FROM ${quote(capture.system_identifier)}
 THEN RAISE EXCEPTION 'R06_DEV_PROJECT_MISMATCH' USING errcode='55000'; END IF;
END $r06_project$;\n`;
  const functionGuard = (values, phase) => `DO $r06_functions$ DECLARE expected jsonb; actual jsonb; BEGIN
 FOR expected IN SELECT value FROM jsonb_array_elements(${literal(values.map(({definition, ...metadata}) => metadata), 'function_data')}::jsonb) LOOP
  ${functionSql()} INTO actual;
  IF (actual-'definition') IS DISTINCT FROM (expected-'definition')
  THEN RAISE EXCEPTION 'R06_DEV_${phase}_FUNCTION_DRIFT:%',expected->>'signature' USING errcode='55000'; END IF;
 END LOOP;
END $r06_functions$;\n`;
  const tableGuard = installed => `DO $r06_tables$ DECLARE expected jsonb; actual jsonb; additions jsonb; shape text; BEGIN
 FOR expected IN SELECT value FROM jsonb_array_elements(${literal(tables, 'table_data')}::jsonb) LOOP
  ${tableSql()} INTO actual;
${installed ? `  IF expected->>'relation'=ANY(ARRAY[${TABLES.map(quote).join(',')}]) THEN
  SELECT jsonb_agg(value ORDER BY ordinality) INTO additions FROM jsonb_array_elements(actual->'columns') WITH ORDINALITY WHERE value->>'name'=ANY(ARRAY[${ADDED_COLUMNS.map(quote).join(',')}]);
  IF additions IS DISTINCT FROM ${literal([
    { name: 'prepared_input', type: 'jsonb', not_null: false, default: null, identity: '', generated: '' },
    { name: 'prepared_input_sha256', type: 'text', not_null: false, default: null, identity: '', generated: '' },
    { name: 'prepared_at', type: 'timestamp with time zone', not_null: false, default: null, identity: '', generated: '' },
    { name: 'prepared_reservation_id', type: 'uuid', not_null: false, default: null, identity: '', generated: '' },
  ], 'columns')}::jsonb THEN RAISE EXCEPTION 'R06_DEV_ADDED_COLUMN_DRIFT:%',expected->>'relation'; END IF;
  SELECT pg_get_constraintdef(oid) INTO shape FROM pg_constraint WHERE conrelid=to_regclass(expected->>'relation') AND conname='r06_prepared_input_shape' AND contype='c' AND convalidated;
  IF shape IS NULL OR md5(shape) IS DISTINCT FROM ${quote(PREPARED_CONSTRAINT_MD5)}
  THEN RAISE EXCEPTION 'R06_DEV_CONSTRAINT_DRIFT:%',expected->>'relation'; END IF;
  actual:=jsonb_set(actual,'{columns}',(SELECT jsonb_agg(value ORDER BY ordinality) FROM jsonb_array_elements(actual->'columns') WITH ORDINALITY WHERE NOT(value->>'name'=ANY(ARRAY[${ADDED_COLUMNS.map(quote).join(',')}]))));
  actual:=jsonb_set(actual,'{constraints}',(SELECT coalesce(jsonb_agg(value ORDER BY value->>'name'),'[]'::jsonb) FROM jsonb_array_elements(actual->'constraints') WHERE value->>'name'<>'r06_prepared_input_shape'));
  END IF;` : ''}
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'R06_DEV_TABLE_DRIFT:%',expected->>'relation' USING errcode='55000'; END IF;
 END LOOP;
END $r06_tables$;\n`;
  const absentGuard = `DO $r06_absent$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY[${NEW_FUNCTIONS.map(quote).join(',')}] LOOP
  IF to_regprocedure(signature) IS NOT NULL THEN RAISE EXCEPTION 'R06_DEV_ALREADY_INSTALLED:%',signature; END IF;
 END LOOP;
END $r06_absent$;\n`;
  const newFunctionGuard = `DO $r06_new$ DECLARE item record; p pg_proc%rowtype; BEGIN
 FOR item IN SELECT * FROM (VALUES ${NEW_FUNCTIONS.map((signature, index) => `(${quote(signature)},${quote(contract.lifecyclePostimages.find(value => value.signature === signature)?.body_md5 ?? contract.newBodies[index])},${quote(signature.startsWith('public.') ? '{postgres=X/postgres,service_role=X/postgres}' : '{postgres=X/postgres}')})`).join(',')}) AS x(signature,body_md5,acl) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(item.signature);
  IF NOT FOUND OR md5(p.prosrc) IS DISTINCT FROM item.body_md5 OR pg_get_userbyid(p.proowner)<>'postgres'
   OR p.proacl::text IS DISTINCT FROM item.acl OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
   OR p.proisstrict OR p.proleakproof OR p.proparallel<>'u' OR p.prokind<>'f' OR p.provolatile<>'v'
   OR p.prorettype<>'jsonb'::regtype OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
   OR p.provariadic<>0 OR p.pronargdefaults<>0
  THEN RAISE EXCEPTION 'R06_DEV_NEW_FUNCTION_DRIFT:%',item.signature; END IF;
 END LOOP;
END $r06_new$;\n`;
  const drain = `DO $r06_drain$ BEGIN
 IF EXISTS(SELECT 1 FROM private.ai_need_turn_commands WHERE state='PROCESSING' AND lease_expires_at>clock_timestamp())
  OR EXISTS(SELECT 1 FROM private.worker_ai_turns WHERE state='PROCESSING' AND lease_expires_at>clock_timestamp())
 THEN RAISE EXCEPTION 'R06_DEV_ACTIVE_TURN_DRAIN_REQUIRED' USING errcode='55000'; END IF;
END $r06_drain$;\n`;
  const lock = `LOCK TABLE ${TABLES.join(',')} IN ACCESS EXCLUSIVE MODE;\nLOCK TABLE ${DEPENDENCY_TABLES.join(',')} IN ACCESS SHARE MODE;\n`;
  const before = identityGuard + functionGuard(functions, 'PREIMAGE') + tableGuard(false) + absentGuard;
  const after = identityGuard + functionGuard(postFunctions, 'POSTIMAGE') + tableGuard(true) + newFunctionGuard;
  const candidateBody = contract.candidate.replace(/^-- R06_PRE_PROVIDER_ISOLATED_START\s*BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '');
  assert.ok(!/^BEGIN;|^COMMIT;/m.test(candidateBody));
  const lifecycleBody = contract.lifecycleCandidate.replace(/^-- R06_PREPARED_PRIVACY_ISOLATED_START\s*BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '');
  assert.ok(!/^BEGIN;|^COMMIT;/m.test(lifecycleBody));
  const preflight = caption + 'BEGIN READ ONLY;\n' + settings + before + "SELECT 'R06_DEV_PREFLIGHT_PASS_DORMANT_ONLY' AS status;\nCOMMIT;\n";
  const postflight = caption + 'BEGIN READ ONLY;\n' + settings + after + "SELECT 'R06_DEV_POSTFLIGHT_PASS_DORMANT_ONLY' AS status;\nCOMMIT;\n";
  const install = caption + 'BEGIN;\n' + settings + identityGuard + lock + drain + before + candidateBody + '\n' + lifecycleBody + '\n' + after + "SELECT 'R06_DEV_INSTALLED_DORMANT_ONLY' AS status;\nCOMMIT;\n";
  const used = `DO $r06_unused$ BEGIN
 IF EXISTS(SELECT 1 FROM private.ai_need_turn_commands WHERE prepared_input IS NOT NULL OR prepared_input_sha256 IS NOT NULL OR prepared_at IS NOT NULL OR prepared_reservation_id IS NOT NULL)
  OR EXISTS(SELECT 1 FROM private.worker_ai_turns WHERE prepared_input IS NOT NULL OR prepared_input_sha256 IS NOT NULL OR prepared_at IS NOT NULL OR prepared_reservation_id IS NOT NULL)
 THEN RAISE EXCEPTION 'R06_DEV_ROLLBACK_REQUIRES_UNUSED_PREPARATION' USING errcode='55000'; END IF;
END $r06_unused$;\n`;
  const restore = PRIVACY_FUNCTIONS.map(signature => functions.find(fn => fn.signature === signature).definition.trim().replace(/;?$/, ';')).join('\n');
  const remove = [...NEW_FUNCTIONS].reverse().map(signature => `DROP FUNCTION ${signature};`).join('\n') + '\n' +
    TABLES.map(table => `ALTER TABLE ${table} DROP CONSTRAINT r06_prepared_input_shape,${ADDED_COLUMNS.map(column => `DROP COLUMN ${column}`).join(',')};`).join('\n');
  const rollback = caption + '-- Structural rollback is allowed only before any preparation was retained. Never discard snapshots or receipts.\n' +
    'BEGIN;\n' + settings + identityGuard + lock + drain + after + used + restore + '\n' + remove + '\n' + before +
    "SELECT 'R06_DEV_ROLLBACK_PASS' AS status;\nCOMMIT;\n";
  const outputs = { preflight, install, postflight, rollback };
  const manifest = { schema: 'USKOCI_R06_DORMANT_DEV_PACKAGE_V1', projectRef: PROJECT,
    systemIdentifier: capture.system_identifier, sourceSha256: sha(contract.source), lifecycleSha256: sha(contract.lifecycleSource), captureCanonicalSha256: sha(JSON.stringify(capture)),
    generatorSha256: sha(fs.readFileSync(__filename)),
    originalFunctions: functions.map(({ signature, body_md5 }) => ({ signature, body_md5 })),
    postFunctions: postFunctions.map(({ signature, body_md5 }) => ({ signature, body_md5 })),
    files: Object.fromEntries(Object.entries(outputs).map(([key, sql]) => [key, { bytes: Buffer.byteLength(sql), sha256: sha(sql) }])),
    activation: 'DISABLED_PENDING_SEPARATE_HOSTED_LIFECYCLE_ACCEPTANCE',
    rollback: 'REFUSES_ANY_RETAINED_PREPARATION; runtime flag-off remains separate from structural rollback',
  };
  return { ...outputs, manifest };
}

module.exports = { PROJECT, TABLES, DEPENDENCY_TABLES, GUARDED_TABLES, NEW_FUNCTIONS, PRIVACY_FUNCTIONS, ADDED_COLUMNS, sourceContract, tableSql, functionSql, normalizeTable, buildPackage };

if (require.main === module) {
  const [capturePath, outputPrefix] = process.argv.slice(2);
  if (!capturePath || !outputPrefix) throw new Error('Usage: node scripts/r06-prepared-dev-package.cjs CAPTURE_JSON OUTPUT_PREFIX');
  const result = buildPackage(JSON.parse(fs.readFileSync(capturePath, 'utf8')));
  for (const [name, content] of Object.entries(result)) {
    const output = `${outputPrefix}.${name === 'manifest' ? 'manifest.json' : name + '.sql'}`;
    fs.writeFileSync(output, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
    process.stdout.write(path.resolve(output) + '\n');
  }
}
