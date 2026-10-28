// Disposable schema admission only. Never link a project or accept a database URL.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {buildManagedDiagnostics} from './managed-diagnostics.mjs';
import {compareEffective} from './platform-effective.mjs';
import {admitCliBuild, cliSource} from './cli-bootstrap-build.mjs';
import {compareManagedNetHook, managedNetHookObservation, validateManagedNetHookBaseline} from './managed-net-hook.mjs';
import {compareNativeNetProvenance, nativeNetObservation, validateNativeNetBaseline} from './native-net-provenance.mjs';
import {compareHostedLoginDependency, hostedLoginObservation, validateHostedLoginBaseline} from './hosted-login-dependency.mjs';
import {adminPathObservation, compareAdminEffectivePath, validateAdminPathBaseline} from './admin-effective-path.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '../../../..');
const privacy = resolve(here, '..');
const files = {
  sql: join(privacy, 'bootstrap/current-application.sql'),
  generation: join(privacy, 'bootstrap/current-generation-manifest.json'),
  expected: join(privacy, 'bootstrap/current-catalog-fingerprints.json'),
  capture: join(privacy, 'r01-capture-bootstrap-metadata.sql'),
  comparator: join(privacy, 'r01-bootstrap-parity.mjs'),
  config: join(here, 'config.toml'),
  extensions: join(here, 'extensions.sql'),
  auth_indexes: join(here, 'auth-search-indexes.sql'),
  effective_query: join(here, 'platform-effective.sql'),
  effective_expected: join(here, 'platform-effective-expected.json'),
  effective_comparator: join(here, 'platform-effective.mjs'),
  managed_net_query: join(here, 'managed-net-hook.sql'),
  managed_net_expected: join(here, 'managed-net-hook-expected.json'),
  managed_net_comparator: join(here, 'managed-net-hook.mjs'),
  native_net_query: join(here, 'native-net-provenance.sql'),
  native_net_expected: join(here, 'native-net-provenance-expected.json'),
  native_net_comparator: join(here, 'native-net-provenance.mjs'),
  hosted_login_query: join(here, 'hosted-login-dependency.sql'),
  hosted_login_expected: join(here, 'hosted-login-dependency-expected.json'),
  hosted_login_comparator: join(here, 'hosted-login-dependency.mjs'),
  admin_path_query: join(here, 'admin-effective-path.sql'),
  admin_path_expected: join(here, 'admin-effective-path-expected.json'),
  admin_path_comparator: join(here, 'admin-effective-path.mjs'),
  pins: join(here, 'pins.json'),
  runner: fileURLToPath(import.meta.url),
  diagnostics: join(here, 'managed-diagnostics.mjs'),
  cli_builder: join(here, 'cli-bootstrap-build.mjs'),
  cli_source: join(here, 'cli-bootstrap-source.json'),
  cli_probe: join(here, 'cli-bootstrap-probe.mjs'),
  cli_compile: join(here, 'cli-bootstrap-compile.mjs'),
  workflow: join(repository, '.github/workflows/r01-disposable-schema.yml'),
};
const sha256 = value => createHash('sha256').update(value).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const pins = json(files.pins);
const orderExtensions = rows => rows.map(({name, schema, version}) => ({name, schema, version}))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));
const excluded = 'studio,postgres-meta,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit';

function required(condition, code) {
  if (!condition) throw new Error(code);
}

export function validateGeneratedInputs(sql, generation, expected) {
  required(generation?.unit === 'R01_BOOTSTRAP_OBJECT_PROVENANCE' && generation.format_version === 1,
    'GENERATION_FORMAT_REFUSED');
  required(generation.status === 'GENERATED_NOT_EXECUTED', 'GENERATION_STATUS_REFUSED');
  required(/^[a-f0-9]{64}$/.test(generation.input_capture_sha256 ?? ''), 'CAPTURE_BINDING_REFUSED');
  required(generation.sql_sha256 === sha256(sql), 'APPLICATION_SOURCE_DRIFT');
  required(generation.pre_request === 'pgrst.db_pre_request=public.rpc_closure_api_guard', 'HOOK_BINDING_REFUSED');
  assert.deepEqual(orderExtensions(generation.prerequisite_extensions), orderExtensions(pins.extensions));
  required(expected?.unit === 'R01_BOOTSTRAP_FINGERPRINTS' && expected.format_version === 1 &&
    expected.server_version_num === pins.postgres_version_num, 'EXPECTED_FORMAT_REFUSED');
  required(sql.includes("current_setting('uskoci.r01.bootstrap', true) IS DISTINCT FROM 'LOCAL_ONLY'") &&
    sql.includes("current_user <> 'postgres'") && sql.includes("current_database() <> 'postgres'"),
  'APPLICATION_LOCAL_GUARD_MISSING');
  required(!/^\s*\\/m.test(sql), 'PSQL_META_COMMAND_REFUSED');
}

export function validatePostgresAdmission(initial) {
  required(initial?.server_version_num === pins.postgres_version_num && initial.user === 'postgres' &&
    initial.database === 'postgres' && initial.socket === true && initial.postgres_superuser === false &&
    initial.supautils_privileged_role === pins.supautils_privileged_role &&
    initial.supautils_privileged_context === 'sighup' && initial.postgres_privileged_usage === true,
  'PG_RUNTIME_REFUSED');
}

export function validateServiceHistory(history) {
  required(Array.isArray(history?.storage) && history.storage.length === 15 &&
    history.storage.every(row => Number.isInteger(row.id) && row.id >= 0 &&
      /^[a-f0-9]{40}$/.test(row.hash)), 'STORAGE_HISTORY_FORMAT_REFUSED');
  required(Array.isArray(history.realtime) && history.realtime.length === 15 &&
    history.realtime.every(version => typeof version === 'string' && /^\d{14}$/.test(version)),
  'REALTIME_HISTORY_FORMAT_REFUSED');
  assert.deepEqual(history, pins.service_history);
}

export function validateEnvironment(env, platform) {
  required(platform === 'linux' && env.RUNNER_OS === 'Linux' && env.GITHUB_ACTIONS === 'true', 'CI_HOST_REFUSED');
  required(env.GITHUB_EVENT_NAME === 'pull_request' && env.GITHUB_BASE_REF === 'feature/uskoci-cisto', 'CI_EVENT_REFUSED');
  required(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') && /^\d+$/.test(env.GITHUB_RUN_ID ?? '') &&
    /^\d+$/.test(env.GITHUB_RUN_ATTEMPT ?? ''), 'CI_IDENTITY_REFUSED');
  required(isAbsolute(env.RUNNER_TEMP ?? '') && isAbsolute(env.GITHUB_WORKSPACE ?? ''), 'CI_PATH_REFUSED');
  for (const key of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD', 'SUPABASE_WORKDIR',
    'SUPABASE_INTERNAL_IMAGE_REGISTRY', 'SUPABASE_SERVICES_HOSTNAME', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'SUPABASE_GO_BINARY']) {
    required(!env[key], 'EXTERNAL_RUNTIME_CONFIGURATION_REFUSED');
  }
}

export function scrubSqlFailure(stderr) {
  return {stderr_sha256: sha256(stderr),
    source_lines: [...new Set([...stderr.matchAll(/^psql:<stdin>:(\d{1,7}):\s+(?:ERROR|FATAL|PANIC):/gm)]
      .map(m => Number(m[1])))].filter(line => line > 0).sort((a, b) => a - b),
    sqlstates: [...new Set([...stderr.matchAll(/\b(?:ERROR|FATAL|PANIC):[ \t]+([0-9A-Z]{5}):/g)].map(m => m[1]))].sort(),
    guards: [...new Set([...stderr.matchAll(/\bR01_[A-Z_]{1,96}\b/g)].map(m => m[0]))].sort()};
}

export function scrubStartupFailure(stdout, stderr) {
  // Only fixed categories leave the runner; never publish a matched log substring.
  const output = stdout + '\n' + stderr;
  const patterns = {
    IMAGE_NOT_FOUND: /manifest unknown|manifest.*not found|failed to resolve reference/i,
    IMAGE_ACCESS_REFUSED: /pull access denied|unauthorized: authentication required/i,
    REGISTRY_RATE_LIMIT: /toomanyrequests|pull rate limit/i,
    SERVICE_UNHEALTHY: /unhealthy|health check failed/i,
    CONNECTION_REFUSED: /connection refused/i,
    TIMEOUT: /timed out|deadline exceeded/i,
    MIGRATION_FAILED: /migration.*failed|failed.*migration/i,
    PERMISSION_DENIED: /permission denied/i,
  };
  return {stdout_sha256: sha256(stdout), stderr_sha256: sha256(stderr),
    categories: Object.entries(patterns).filter(([, pattern]) => pattern.test(output)).map(([name]) => name)};
}

export function scrubComparison(comparison) {
  required(comparison?.unit === 'R01_BOOTSTRAP_METADATA_COMPARISON' &&
    typeof comparison.metadata_equal === 'boolean' && Array.isArray(comparison.differences), 'COMPARISON_FORMAT_REFUSED');
  const differences = comparison.differences.map(difference => {
    required(/^[a-z_]+$/.test(difference.group) && ['added', 'missing', 'changed'].includes(difference.kind) &&
      typeof difference.key === 'string', 'COMPARISON_ROW_REFUSED');
    if (difference.group === 'runtime') {
      required(difference.key === 'server_version_num' && Number.isInteger(difference.expected) &&
        Number.isInteger(difference.observed), 'COMPARISON_RUNTIME_REFUSED');
      return {group: 'runtime', kind: difference.kind, expected: difference.expected, observed: difference.observed};
    }
    required([difference.expected_sha256, difference.observed_sha256].every(value =>
      value === null || /^[a-f0-9]{64}$/.test(value)), 'COMPARISON_HASH_REFUSED');
    required(Array.isArray(difference.fields) && difference.fields.every(field => /^[a-z_][a-z_0-9]*$/.test(field)),
      'COMPARISON_FIELDS_REFUSED');
    return {group: difference.group, key_sha256: sha256(difference.key), kind: difference.kind,
      expected_sha256: difference.expected_sha256, observed_sha256: difference.observed_sha256,
      changed_fields: difference.fields};
  });
  required(comparison.metadata_equal === (differences.length === 0), 'COMPARISON_RESULT_REFUSED');
  return {unit: comparison.unit, metadata_equal: comparison.metadata_equal,
    difference_count: differences.length, differences,
    limitations: 'Strict schema metadata only; no Auth session, HTTP boundary, fixture, candidate, native or deployment proof.'};
}

function sourceCheck() {
  for (const path of Object.values(files)) {
    required(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink(), 'SOURCE_FILE_REFUSED');
    required(!relative(realpathSync(repository), realpathSync(path)).startsWith(`..${sep}`), 'SOURCE_PATH_REFUSED');
  }
  validateGeneratedInputs(readFileSync(files.sql, 'utf8'), json(files.generation), json(files.expected));
  required(readFileSync(files.capture, 'utf8').includes('BEGIN TRANSACTION READ ONLY;'), 'CAPTURE_NOT_READ_ONLY');
  required(readFileSync(files.effective_query, 'utf8').includes('BEGIN TRANSACTION READ ONLY;') &&
    json(files.effective_expected).query_sha256 === sha256(readFileSync(files.effective_query)),
  'EFFECTIVE_QUERY_BINDING_REFUSED');
  required(readFileSync(files.managed_net_query, 'utf8').includes('BEGIN TRANSACTION READ ONLY;'),
    'MANAGED_NET_QUERY_NOT_READ_ONLY');
  validateManagedNetHookBaseline(json(files.managed_net_expected), sha256(readFileSync(files.managed_net_query)));
  required(readFileSync(files.native_net_query, 'utf8').includes('BEGIN TRANSACTION READ ONLY;'),
    'NATIVE_NET_QUERY_NOT_READ_ONLY');
  validateNativeNetBaseline(json(files.native_net_expected), sha256(readFileSync(files.native_net_query)));
  required(readFileSync(files.hosted_login_query, 'utf8').includes('BEGIN TRANSACTION READ ONLY;'),
    'HOSTED_LOGIN_QUERY_NOT_READ_ONLY');
  validateHostedLoginBaseline(json(files.hosted_login_expected), sha256(readFileSync(files.hosted_login_query)));
  required(readFileSync(files.admin_path_query, 'utf8').includes('BEGIN TRANSACTION READ ONLY;'),
    'ADMIN_PATH_QUERY_NOT_READ_ONLY');
  validateAdminPathBaseline(json(files.admin_path_expected), sha256(readFileSync(files.admin_path_query)));
  return Object.fromEntries(Object.entries(files).map(([name, path]) => [name, sha256(readFileSync(path))]));
}

function locations() {
  validateEnvironment(process.env, process.platform);
  const temp = realpathSync(process.env.RUNNER_TEMP);
  required(realpathSync(repository) === realpathSync(process.env.GITHUB_WORKSPACE), 'WORKSPACE_REFUSED');
  const project = join(temp, `uskoci-r01-schema-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`);
  required(dirname(project) === temp, 'TEMP_BOUNDARY_REFUSED');
  return {project, privateDir: join(project, 'private'), publicDir: join(temp, 'r01-schema-public')};
}

function writeJSON(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
}

async function run() {
  const paths = locations();
  required(!existsSync(paths.project) && !existsSync(paths.publicDir), 'DISPOSABLE_DIRECTORY_EXISTS');
  mkdirSync(paths.project, {mode: 0o700});
  mkdirSync(paths.privateDir, {mode: 0o700});
  mkdirSync(paths.publicDir, {mode: 0o700});
  const receipt = {unit: 'R01_DISPOSABLE_SCHEMA_RUNTIME', result: 'FAIL', source_sha: process.env.GITHUB_SHA,
    stages: [], live_access: false, fixtures_run: false, candidate_applied: false, actual_auth_proven: false,
    postgrest_boundary_proven: false, metadata_equal: false,
    native_net_provenance_verified: false, hosted_login_dependency_verified: false,
    admin_effective_path_verified: false};
  let stage = 'SOURCE_ADMISSION';
  function command(label, executable, args, {input, cwd = repository, timeout = 120000, allowed = [0]} = {}) {
    stage = label;
    const result = spawnSync(executable, args, {cwd, input, encoding: 'utf8', timeout,
      maxBuffer: 64 * 1024 * 1024, windowsHide: true});
    writeFileSync(join(paths.privateDir, `${label}.stdout`), result.stdout ?? '', {mode: 0o600});
    writeFileSync(join(paths.privateDir, `${label}.stderr`), result.stderr ?? '', {mode: 0o600});
    const accepted = !result.error && allowed.includes(result.status);
    receipt.stages.push({stage: label, passed: !result.error && result.status === 0,
      accepted_exit: accepted, exit_code: result.status ?? null});
    if (!accepted && label === 'START_STACK') {
      receipt.startup_failure = scrubStartupFailure(result.stdout ?? '', result.stderr ?? '');
    }
    if (!accepted && ['PG_ADMISSION', 'SERVICE_MIGRATION_ADMISSION', 'AUTH_SEARCH_INDEXES', 'PLATFORM_EXTENSIONS', 'EXTENSION_ADMISSION',
      'MANAGED_NET_HOOK_CAPTURE', 'NATIVE_NET_PROVENANCE_CAPTURE', 'HOSTED_LOGIN_DEPENDENCY_CAPTURE', 'ADMIN_EFFECTIVE_PATH_CAPTURE', 'APPLICATION_SCHEMA', 'CURRENT_CATALOG_CAPTURE', 'PLATFORM_EFFECTIVE_CAPTURE'].includes(label)) {
      receipt.sql_failures ??= [];
      receipt.sql_failures.push({stage: label, ...scrubSqlFailure(result.stderr ?? '')});
    }
    required(accepted, 'STAGE_FAILED');
    return result;
  }
  function sql(label, source, role = 'postgres') {
    required(['postgres', 'supabase_admin'].includes(role), 'DATABASE_ROLE_REFUSED');
    return command(label, 'docker', ['exec', '-i', `supabase_db_${pins.project_id}`,
      'psql', '-X', '-qAt', '-U', role, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-f', '-'],
    {input: source, timeout: 300000}).stdout.trim();
  }
  try {
    receipt.source_hashes = sourceCheck();
    const admittedCli = admitCliBuild();
    const cli = admittedCli.binary;
    receipt.cli_build = admittedCli.receipt;
    const head = command('SOURCE_HEAD', 'git', ['rev-parse', 'HEAD']).stdout.trim();
    required(head === process.env.GITHUB_SHA, 'SOURCE_HEAD_REFUSED');
    command('SOURCE_CLEAN', 'git', ['diff', '--exit-code', '--quiet']);
    const version = command('CLI_VERSION', cli, ['--version']).stdout.trim();
    required(version === cliSource.build_version && cliSource.upstream_version === pins.cli, 'CLI_VERSION_REFUSED');
    receipt.cli_version = version;
    command('CLI_START_HELP', cli, ['start', '--help']);
    command('CLI_STOP_HELP', cli, ['stop', '--help']);
    const existing = command('EMPTY_STACK', 'docker', ['ps', '-aq', '--filter',
      `label=com.supabase.cli.project=${pins.project_id}`]).stdout.trim();
    required(existing === '', 'PREEXISTING_STACK_REFUSED');
    mkdirSync(join(paths.project, 'supabase'), {mode: 0o700});
    mkdirSync(join(paths.project, 'supabase/.temp'), {mode: 0o700});
    writeFileSync(join(paths.project, 'supabase/config.toml'), readFileSync(files.config), {mode: 0o600});
    for (const [name, value] of Object.entries(pins.version_files)) {
      writeFileSync(join(paths.project, 'supabase/.temp', name), `${value}\n`, {mode: 0o600});
    }
    // The cleanup marker is written only after the no-preexisting-stack check.
    writeJSON(join(paths.privateDir, 'owned-stack.json'), {project_id: pins.project_id});
    command('SERVICE_PINS', cli, ['services', '--workdir', paths.project]);
    command('START_STACK', cli, ['start', '--workdir', paths.project, '--exclude', excluded], {timeout: 600000});
    const images = [];
    for (const [service, expected] of Object.entries(pins.images)) {
      const container = `supabase_${service}_${pins.project_id}`;
      const observed = JSON.parse(command(`IMAGE_${service}`, 'docker', ['inspect', '--format',
        '{"image":{{json .Config.Image}},"id":{{json .Image}},"running":{{json .State.Running}},"project":{{json (index .Config.Labels "com.supabase.cli.project")}}}', container]).stdout);
      const tail = expected.split('/').at(-1);
      const allowedImages = [expected, `docker.io/${expected}`, `public.ecr.aws/supabase/${tail}`, `ghcr.io/supabase/${tail}`];
      required(allowedImages.includes(observed.image) && observed.running && observed.project === pins.project_id &&
        /^sha256:[a-f0-9]{64}$/.test(observed.id), 'CONTAINER_PIN_REFUSED');
      const repoDigests = JSON.parse(command(`DIGEST_${service}`, 'docker', ['image', 'inspect', '--format', '{{json .RepoDigests}}', observed.id]).stdout);
      required(Array.isArray(repoDigests) && repoDigests.length > 0 &&
        repoDigests.every(value => typeof value === 'string' && /@sha256:[a-f0-9]{64}$/.test(value)), 'IMAGE_DIGEST_REFUSED');
      images.push({service, expected_image: expected, actual_image: observed.image, image_id: observed.id,
        content_digests: [...new Set(repoDigests.map(value => value.slice(value.lastIndexOf('@') + 1)))].sort()});
    }
    writeJSON(join(paths.publicDir, 'images.json'), images);
    const initial = JSON.parse(sql('PG_ADMISSION', `SELECT jsonb_build_object(
      'server_version_num',current_setting('server_version_num')::integer,
      'user',current_user,'database',current_database(),'socket',inet_client_addr() IS NULL,
      'postgres_superuser',(SELECT rolsuper FROM pg_roles WHERE rolname='postgres'),
      'supautils_privileged_role',(SELECT setting FROM pg_settings WHERE name='supautils.privileged_role'),
      'supautils_privileged_context',(SELECT context FROM pg_settings WHERE name='supautils.privileged_role'),
      'postgres_privileged_usage',EXISTS (SELECT 1 FROM pg_settings s JOIN pg_roles r ON r.rolname=s.setting
        WHERE s.name='supautils.privileged_role' AND s.context='sighup'
          AND pg_has_role(current_user,r.oid,'USAGE')));`));
    writeJSON(join(paths.publicDir, 'versions.json'), {cli: version, admission: initial});
    validatePostgresAdmission(initial);
    receipt.postgres_version_num = initial.server_version_num;
    const serviceHistory = JSON.parse(sql('SERVICE_MIGRATION_ADMISSION', `BEGIN TRANSACTION READ ONLY;
      SET LOCAL search_path=pg_catalog;
      SELECT jsonb_build_object(
        'storage',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM
          (SELECT id,hash FROM storage.migrations ORDER BY id DESC LIMIT 15) x),
        'realtime',(SELECT jsonb_agg(version ORDER BY version) FROM
          (SELECT version::text FROM realtime.schema_migrations ORDER BY version DESC LIMIT 15) x));
      ROLLBACK;`, 'supabase_admin'));
    validateServiceHistory(serviceHistory);
    receipt.service_history_verified = true;
    receipt.service_history = serviceHistory;

    required(JSON.stringify(sourceCheck()) === JSON.stringify(receipt.source_hashes), 'SOURCE_CHANGED_DURING_START');
    sql('AUTH_SEARCH_INDEXES', "SET uskoci.r01.bootstrap = 'LOCAL_ONLY';\n" + readFileSync(files.auth_indexes, 'utf8'),
      'supabase_admin');
    sql('PLATFORM_EXTENSIONS', "SET uskoci.r01.bootstrap = 'LOCAL_ONLY';\n" + readFileSync(files.extensions, 'utf8'), 'supabase_admin');
    const extensions = JSON.parse(sql('EXTENSION_ADMISSION', `SELECT jsonb_agg(jsonb_build_object(
      'name',e.extname,'schema',n.nspname,'version',e.extversion) ORDER BY e.extname)
      FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace;`));
    // Extra platform extensions are reported by strict full-catalog parity too.
    writeJSON(join(paths.publicDir, 'versions.json'), {cli: version, admission: initial, extensions});
    assert.deepEqual(orderExtensions(extensions), orderExtensions(pins.extensions));
    const managedNetHook = managedNetHookObservation(JSON.parse(sql('MANAGED_NET_HOOK_CAPTURE',
      readFileSync(files.managed_net_query, 'utf8'), 'supabase_admin')));
    // Publish the actual safe observation before any equality assertion. Legitimate
    // native helper/event presence is checked against DEV after full diagnostics.
    receipt.managed_net_hook_observed = managedNetHook;
    writeJSON(join(paths.publicDir, 'managed-net-hook-observed.json'), managedNetHook);
    console.log('R01_MANAGED_NET_OBSERVED_JSON ' + JSON.stringify(managedNetHook));
    const nativeNet = nativeNetObservation(JSON.parse(sql('NATIVE_NET_PROVENANCE_CAPTURE',
      readFileSync(files.native_net_query, 'utf8'), 'supabase_admin')));
    writeJSON(join(paths.publicDir, 'native-net-provenance-observed.json'), nativeNet);
    console.log('R01_NATIVE_NET_OBSERVED_JSON ' + JSON.stringify(nativeNet));
    writeJSON(join(paths.publicDir, 'versions.json'), {cli: version, postgres_version_num: initial.server_version_num, admission: initial, extensions});
    // Revalidate approved source bytes immediately before executing them.
    required(JSON.stringify(sourceCheck()) === JSON.stringify(receipt.source_hashes), 'SOURCE_CHANGED_DURING_START');
    sql('APPLICATION_SCHEMA', "SET uskoci.r01.bootstrap = 'LOCAL_ONLY';\n" + readFileSync(files.sql, 'utf8'));
    const capture = sql('CURRENT_CATALOG_CAPTURE', readFileSync(files.capture, 'utf8'));
    const capturePath = join(paths.privateDir, 'current-catalog.json');
    writeFileSync(capturePath, `${capture}\n`, {mode: 0o600});
    const comparison = command('STRICT_PARITY', process.execPath,
      [files.comparator, 'compare', files.expected, capturePath], {allowed: [0, 1]});
    const scrubbed = scrubComparison(JSON.parse(comparison.stdout));
    writeJSON(join(paths.publicDir, 'parity-diff.json'), scrubbed);
    console.log('R01_PARITY_JSON ' + JSON.stringify(scrubbed));
    const diagnostics = buildManagedDiagnostics(json(files.expected), JSON.parse(capture));
    required(diagnostics.metadata_equal === scrubbed.metadata_equal &&
      diagnostics.difference_count === scrubbed.difference_count, 'DIAGNOSTIC_BINDING_REFUSED');
    writeJSON(join(paths.publicDir, 'managed-diagnostics.json'), diagnostics);
    const {rows: diagnosticRows, ...diagnosticSummary} = diagnostics;
    console.log('R01_MANAGED_DIAGNOSTICS_JSON ' + JSON.stringify(diagnosticSummary));
    for (const row of diagnosticRows) console.log('R01_MANAGED_ROW_JSON ' + JSON.stringify(row));
    const effectiveCapture = JSON.parse(sql('PLATFORM_EFFECTIVE_CAPTURE', readFileSync(files.effective_query, 'utf8')));
    writeJSON(join(paths.privateDir, 'platform-effective-capture.json'), effectiveCapture);
    const effective = compareEffective(json(files.effective_expected), effectiveCapture,
      receipt.source_hashes.effective_query);
    writeJSON(join(paths.publicDir, 'platform-effective-diff.json'), effective);
    const {differences: effectiveRows, ...effectiveSummary} = effective;
    console.log('R01_EFFECTIVE_JSON ' + JSON.stringify(effectiveSummary));
    for (const row of effectiveRows) console.log('R01_EFFECTIVE_ROW_JSON ' + JSON.stringify(row));
    receipt.effective_diagnostic_equal = effective.equal;
    const hostedLogin = hostedLoginObservation(JSON.parse(sql('HOSTED_LOGIN_DEPENDENCY_CAPTURE',
      readFileSync(files.hosted_login_query, 'utf8'), 'supabase_admin')));
    writeJSON(join(paths.publicDir, 'hosted-login-dependency-observed.json'), hostedLogin);
    const hostedComparison = compareHostedLoginDependency(json(files.hosted_login_expected), hostedLogin,
      receipt.source_hashes.hosted_login_query);
    receipt.hosted_login_dependency_verified = hostedComparison.provenance_verified;
    writeJSON(join(paths.publicDir, 'hosted-login-dependency-diff.json'), hostedComparison);
    console.log('R01_HOSTED_LOGIN_DEPENDENCY_JSON ' + JSON.stringify(hostedComparison));
    // Preserve the admin session's default effective search_path. The proof SQL
    // qualifies catalog references and deliberately does not SET search_path.
    const adminPath = adminPathObservation(JSON.parse(sql('ADMIN_EFFECTIVE_PATH_CAPTURE',
      readFileSync(files.admin_path_query, 'utf8'), 'supabase_admin')));
    writeJSON(join(paths.publicDir, 'admin-effective-path-observed.json'), adminPath);
    const adminPathComparison = compareAdminEffectivePath(json(files.admin_path_expected), adminPath,
      receipt.source_hashes.admin_path_query);
    receipt.admin_effective_path_verified = adminPathComparison.effective_disposable_path_verified;
    writeJSON(join(paths.publicDir, 'admin-effective-path-diff.json'), adminPathComparison);
    console.log('R01_ADMIN_EFFECTIVE_PATH_JSON ' + JSON.stringify(adminPathComparison));
    const managedNetComparison = compareManagedNetHook(json(files.managed_net_expected), managedNetHook,
      receipt.source_hashes.managed_net_query);
    receipt.managed_net_hook_equal = managedNetComparison.equal;
    receipt.managed_net_hook_differences = managedNetComparison.differences;
    writeJSON(join(paths.publicDir, 'managed-net-hook-diff.json'), managedNetComparison);
    console.log('R01_MANAGED_NET_JSON ' + JSON.stringify(managedNetComparison));
    const nativeNetComparison = compareNativeNetProvenance(json(files.native_net_expected), nativeNet,
      receipt.source_hashes.native_net_query);
    receipt.native_net_provenance_verified = nativeNetComparison.provenance_verified;
    writeJSON(join(paths.publicDir, 'native-net-provenance-diff.json'), nativeNetComparison);
    console.log('R01_NATIVE_NET_PROVENANCE_JSON ' + JSON.stringify(nativeNetComparison));
    // The supplemental report never overrides strict catalog admission.
    stage = 'STRICT_PARITY';
    receipt.metadata_equal = scrubbed.metadata_equal;
    required(comparison.status === 0 && scrubbed.metadata_equal, 'METADATA_PARITY_DIFFERENT');
    stage = 'MANAGED_NET_HOOK_ADMISSION';
    required(managedNetComparison.equal, 'MANAGED_NET_HOOK_DIFFERENT');
    stage = 'NATIVE_NET_PROVENANCE_ADMISSION';
    required(nativeNetComparison.provenance_verified, 'NATIVE_NET_PROVENANCE_DIFFERENT');
    stage = 'HOSTED_LOGIN_DEPENDENCY_ADMISSION';
    required(hostedComparison.provenance_verified, 'HOSTED_LOGIN_DEPENDENCY_DIFFERENT');
    stage = 'ADMIN_EFFECTIVE_PATH_ADMISSION';
    required(adminPathComparison.effective_disposable_path_verified, 'ADMIN_EFFECTIVE_PATH_DIFFERENT');
    receipt.result = 'METADATA_EQUAL';
    console.log('R01 disposable schema metadata equality verified; HTTP and candidate proof remain unexecuted.');
  } catch (error) {
    receipt.failure_stage = stage;
    receipt.failure_code = /^[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'UNCLASSIFIED_FAILURE';
    process.exitCode = 1;
    console.error(`R01 disposable schema admission failed at ${stage}; only scrubbed diagnostics are published.`);
  } finally {
    writeJSON(join(paths.publicDir, 'runtime-receipt.json'), receipt);
    console.log('R01_RUNTIME_JSON ' + JSON.stringify(receipt));
    const versions = join(paths.publicDir, 'versions.json');
    if (existsSync(versions)) console.log('R01_VERSIONS_JSON ' + JSON.stringify(json(versions)));
  }
}

function stop() {
  const paths = locations();
  const marker = join(paths.privateDir, 'owned-stack.json');
  if (!existsSync(marker)) {
    console.log('R01 cleanup: no owned stack was started.');
    return;
  }
  required(json(marker).project_id === pins.project_id && existsSync(join(paths.project, 'supabase/config.toml')),
    'CLEANUP_OWNER_REFUSED');
  const {binary} = admitCliBuild();
  const result = spawnSync(binary, ['stop', '--workdir', paths.project, '--no-backup'],
    {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
  writeFileSync(join(paths.privateDir, 'cleanup.stdout'), result.stdout ?? '', {mode: 0o600});
  writeFileSync(join(paths.privateDir, 'cleanup.stderr'), result.stderr ?? '', {mode: 0o600});
  const successful = !result.error && result.status === 0;
  writeJSON(join(paths.publicDir, 'cleanup-receipt.json'), {unit: 'R01_DISPOSABLE_CLEANUP',
    project_id: pins.project_id, successful, exit_code: result.status ?? null});
  required(successful, 'CLEANUP_FAILED');
  console.log('R01 disposable project stopped without retaining its data volumes.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    required(process.argv.length === 3, 'COMMAND_REFUSED');
    if (process.argv[2] === 'check-source') {
      sourceCheck();
      console.log('R01 generated source hashes and local execution contract verified.');
    } else if (process.argv[2] === 'run') await run();
    else if (process.argv[2] === 'stop') stop();
    else throw new Error('COMMAND_REFUSED');
  } catch {
    // Child process logs, source data and environment values never reach public output.
    console.error('R01 runtime admission refused before completion.');
    process.exitCode = 1;
  }
}
