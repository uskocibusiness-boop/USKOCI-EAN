// A disposable-only derivative of the pinned CLI. No database repair SQL.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, 'cli-bootstrap-source.json');
export const cliSource = JSON.parse(readFileSync(manifestPath, 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
function need(value, code) { if (!value) throw new Error(code); }
export const startupSourceLinks = [
  ['apps/cli/src/legacy/main.ts','import "./cli/main.ts";'],
  ['apps/cli/src/legacy/cli/main.ts','import { legacyRoot } from "./root.ts";'],
  ['apps/cli/src/legacy/cli/root.ts','import { legacyStartCommand } from "../commands/start/start.command.ts";'],
  ['apps/cli/src/legacy/commands/start/start.command.ts','legacyStart(flags).pipe('],
  ['apps/cli/src/legacy/commands/start/start.handler.ts','const dbBootstrapResult = yield* legacyStartDatabase(spawner, {'],
  ['apps/cli/src/legacy/shared/db-bootstrap/start-database.ts','const postgresSpec = legacyBuildPostgresStartContainerSpec({'],
  ['apps/cli/src/legacy/shared/db-bootstrap/postgres.service.ts',': legacyPostgresEntrypointScriptPg15(postgresConfig);'],
];
export function validateStartupSourceChain(readSource) {
  for (const [path, token] of startupSourceLinks) need(readSource(path).includes(token), 'CLI_ACTIVE_STARTUP_PATH_REFUSED');
}

export function applyPinnedOmission(source, contract) {
  need(hash(source) === contract.source_sha256, 'CLI_SOURCE_DRIFT');
  const text = source.toString('utf8');
  need(typeof contract.omitted_expression === 'string' && contract.omitted_expression.length > 0 &&
    text.split(contract.omitted_expression).length === 2, 'CLI_PATCH_CARDINALITY');
  const patched = Buffer.from(text.replace(contract.omitted_expression, ''), 'utf8');
  need(hash(patched) === contract.patched_sha256, 'CLI_PATCH_DRIFT');
  return patched;
}

export function omitLegacyWebhook(source) {
  return applyPinnedOmission(source, {source_sha256:cliSource.source_files[cliSource.patch_path],
    omitted_expression:cliSource.omitted_expression,patched_sha256:cliSource.patched_sha256});
}

export function cliLocations(env = process.env) {
  need(/^\d+$/.test(env.GITHUB_RUN_ID ?? '') && /^\d+$/.test(env.GITHUB_RUN_ATTEMPT ?? ''), 'CLI_RUN_ID_REFUSED');
  const temp = realpathSync(env.RUNNER_TEMP);
  const project = join(temp, `uskoci-r01-cli-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`);
  return {project, binary: join(project, 'bin/supabase'), sidecar:join(project,'bin/supabase-go'),
    receipt: join(project, 'build-receipt.json'), publicDir: join(temp, 'r01-cli-build-public')};
}

export function validateCliReceipt(receipt, binaryHash, sourceHash, sidecarHash) {
  need(receipt?.unit === 'R01_CLI_BOOTSTRAP_BUILD' && receipt.result === 'BUILT' &&
    receipt.upstream_commit === cliSource.upstream_commit &&
    receipt.upstream_version === cliSource.upstream_version &&
    receipt.build_version === cliSource.build_version &&
    receipt.go_version === cliSource.go_version && receipt.go_archive_sha256 === cliSource.go_archive_sha256 &&
    receipt.bun_version === cliSource.bun_version && receipt.bun_archive_sha256 === cliSource.bun_archive_sha256 &&
    receipt.pnpm_version === cliSource.pnpm_version && receipt.pnpm_archive_integrity === cliSource.pnpm_archive_integrity &&
    receipt.source_manifest_sha256 === sourceHash &&
    receipt.patched_source_sha256 === cliSource.patched_sha256 &&
    receipt.binary_sha256 === binaryHash && /^[a-f0-9]{64}$/.test(binaryHash) &&
    receipt.sidecar_sha256 === sidecarHash && /^[a-f0-9]{64}$/.test(sidecarHash ?? '') &&
    receipt.source_clean_before_patch === true && receipt.exact_patch_only === true &&
    receipt.modules_verified === true && receipt.managed_object_rewrites === false &&
    receipt.active_startup_path_verified === true && receipt.actual_container_spec_verified === true &&
    receipt.frozen_dependencies === true && receipt.start_stop_services_help_verified === true,
  'CLI_BUILD_RECEIPT_REFUSED');
  assert.deepEqual(receipt.upstream_source_hashes, cliSource.source_files);
}

export function admitCliBuild(env = process.env) {
  const paths = cliLocations(env);
  for (const path of [paths.binary,paths.sidecar]) need(lstatSync(path).isFile() &&
    !lstatSync(path).isSymbolicLink() && realpathSync(path) === path, 'CLI_BINARY_PATH_REFUSED');
  const receipt = JSON.parse(readFileSync(paths.receipt, 'utf8'));
  validateCliReceipt(receipt, hash(readFileSync(paths.binary)), hash(readFileSync(manifestPath)),hash(readFileSync(paths.sidecar)));
  return {binary: paths.binary, receipt};
}

async function build() {
  need(process.platform === 'linux' && process.arch === 'x64' && process.env.RUNNER_OS === 'Linux' &&
    process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_EVENT_NAME === 'pull_request' &&
    process.env.GITHUB_BASE_REF === 'feature/uskoci-cisto', 'CLI_BUILD_HOST_REFUSED');
  for (const key of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','SUPABASE_WORKDIR',
    'GIT_CONFIG_COUNT','GIT_CONFIG_SYSTEM','GIT_CONFIG_GLOBAL','GIT_CONFIG_PARAMETERS','SUPABASE_GO_BINARY']) {
    need(!process.env[key], 'CLI_BUILD_CONFIGURATION_REFUSED');
  }
  const paths = cliLocations();
  need(!existsSync(paths.project) && !existsSync(paths.publicDir), 'CLI_BUILD_DIRECTORY_EXISTS');
  mkdirSync(paths.project, {mode: 0o700});
  mkdirSync(paths.publicDir, {mode: 0o700});
  const upstream = join(paths.project, 'upstream');
  const privateDir = join(paths.project, 'private');
  mkdirSync(privateDir, {mode: 0o700});
  mkdirSync(join(paths.project, 'bin'), {mode: 0o700});
  const receipt = {unit:'R01_CLI_BOOTSTRAP_BUILD', result:'FAIL',
    upstream_commit:cliSource.upstream_commit, upstream_version:cliSource.upstream_version,
    build_version:cliSource.build_version, source_manifest_sha256:hash(readFileSync(manifestPath)),
    managed_object_rewrites:false, stages:[]};
  let stage = 'ADMISSION';
  function command(label, program, args, cwd = paths.project, extraEnv = {}, timeout = 180000) {
    stage = label;
    const result = spawnSync(program, args, {cwd, encoding:'utf8', windowsHide:true, timeout,
      env:{...process.env, GIT_CONFIG_NOSYSTEM:'1', GIT_CONFIG_GLOBAL:'/dev/null', ...extraEnv},
      maxBuffer:64 * 1024 * 1024});
    writeFileSync(join(privateDir, `${label}.stdout`), result.stdout ?? '', {mode:0o600});
    writeFileSync(join(privateDir, `${label}.stderr`), result.stderr ?? '', {mode:0o600});
    receipt.stages.push({stage:label, passed:!result.error && result.status === 0,
      exit_code:result.status ?? null});
    need(!result.error && result.status === 0, 'CLI_BUILD_STAGE_FAILED');
    return result.stdout.trim();
  }
  try {
    command('SOURCE_INIT', 'git', ['-c','core.autocrlf=false','init',upstream]);
    command('SOURCE_REMOTE', 'git', ['remote','add','origin',cliSource.repository], upstream);
    command('SOURCE_FETCH', 'git', ['-c','core.autocrlf=false','fetch','--depth=1','origin',cliSource.upstream_commit], upstream);
    command('SOURCE_CHECKOUT', 'git', ['-c','core.autocrlf=false','checkout','--detach',cliSource.upstream_commit], upstream);
    need(command('SOURCE_IDENTITY','git',['rev-parse','HEAD'],upstream) === cliSource.upstream_commit, 'CLI_COMMIT_DRIFT');
    need(command('SOURCE_CLEAN','git',['status','--porcelain','--untracked-files=all'],upstream) === '', 'CLI_SOURCE_NOT_CLEAN');
    receipt.source_clean_before_patch = true;
    receipt.upstream_source_hashes = Object.fromEntries(Object.keys(cliSource.source_files)
      .map(path => [path,hash(readFileSync(join(upstream,path)))]));
    assert.deepEqual(receipt.upstream_source_hashes, cliSource.source_files);
    validateStartupSourceChain(path => readFileSync(join(upstream,path),'utf8'));
    receipt.active_startup_path_verified = true;
    async function downloadPinned(url, expected, label, algorithm='sha256', encoding='hex') {
      stage = label;
      const download = await fetch(url,{signal:AbortSignal.timeout(180000)});
      need(download.ok,'TOOLCHAIN_DOWNLOAD_FAILED');
      const data = Buffer.from(await download.arrayBuffer());
      need(createHash(algorithm).update(data).digest(encoding) === expected,'TOOLCHAIN_ARCHIVE_DRIFT');
      const path = join(privateDir,label);
      writeFileSync(path,data,{mode:0o600});
      return path;
    }
    const bunArchive = await downloadPinned(cliSource.bun_archive,cliSource.bun_archive_sha256,'BUN_DOWNLOAD.zip');
    command('BUN_EXTRACT','unzip',['-q',bunArchive,'-d',paths.project]);
    const bun = join(paths.project,'bun-linux-x64-baseline/bun');
    need(command('BUN_VERSION',bun,['--version']) === cliSource.bun_version,'BUN_VERSION_DRIFT');
    receipt.bun_version = cliSource.bun_version;
    receipt.bun_archive_sha256 = cliSource.bun_archive_sha256;
    const pnpmArchive = await downloadPinned(cliSource.pnpm_archive,
      cliSource.pnpm_archive_integrity.slice('sha512-'.length),'PNPM_DOWNLOAD.tgz','sha512','base64');
    const pnpmDir = join(paths.project,'pnpm'); mkdirSync(pnpmDir,{mode:0o700});
    command('PNPM_EXTRACT','tar',['-xzf',pnpmArchive,'-C',pnpmDir]);
    const pnpm = join(pnpmDir,'package/bin/pnpm.cjs');
    need(command('PNPM_VERSION',process.execPath,[pnpm,'--version']) === cliSource.pnpm_version,'PNPM_VERSION_DRIFT');
    receipt.pnpm_version = cliSource.pnpm_version;
    receipt.pnpm_archive_integrity = cliSource.pnpm_archive_integrity;
    command('FROZEN_DEPENDENCIES',process.execPath,[pnpm,'--filter','supabase...','install',
      '--frozen-lockfile','--ignore-scripts','--store-dir',join(paths.project,'pnpm-store')],upstream,{},600000);
    receipt.frozen_dependencies = true;
    const before = JSON.parse(command('STARTUP_SPEC_BEFORE',bun,[join(here,'cli-bootstrap-probe.mjs'),upstream],upstream));
    writeFileSync(join(upstream,cliSource.patch_path), omitLegacyWebhook(readFileSync(join(upstream,cliSource.patch_path))));
    need(command('PATCH_FILES','git',['diff','--name-only'],upstream) === cliSource.patch_path, 'CLI_PATCH_FILES_REFUSED');
    receipt.patched_source_sha256 = hash(readFileSync(join(upstream,cliSource.patch_path)));
    receipt.exact_patch_only = true;
    const after = JSON.parse(command('STARTUP_SPEC_AFTER',bun,[join(here,'cli-bootstrap-probe.mjs'),upstream],upstream));
    need(before.webhook_present === true && after.webhook_present === false &&
      before.without_webhook_sha256 === after.script_sha256 &&
      before.spec_without_script_sha256 === after.spec_without_script_sha256,'CLI_ACTUAL_STARTUP_SPEC_REFUSED');
    receipt.actual_container_spec_verified = true;
    receipt.container_spec_proof = {before,after};
    stage = 'GO_DOWNLOAD';
    const download = await fetch(cliSource.go_archive, {signal:AbortSignal.timeout(180000)});
    need(download.ok, 'GO_DOWNLOAD_FAILED');
    const archive = Buffer.from(await download.arrayBuffer());
    need(hash(archive) === cliSource.go_archive_sha256, 'GO_ARCHIVE_DRIFT');
    receipt.go_archive_sha256 = hash(archive);
    const archivePath = join(privateDir,'go.tar.gz');
    writeFileSync(archivePath,archive,{mode:0o600});
    command('GO_EXTRACT','tar',['-xzf',archivePath,'-C',paths.project]);
    const go = join(paths.project,'go/bin/go');
    const goEnv = {GOTOOLCHAIN:'local',GOWORK:'off',GOOS:'linux',GOARCH:'amd64',CGO_ENABLED:'0',
      GOFLAGS:'-mod=readonly',GOPROXY:'https://proxy.golang.org',GOSUMDB:'sum.golang.org',
      GONOPROXY:'',GONOSUMDB:'',GOPRIVATE:'',GOINSECURE:'',GOENV:'off',
      GOPATH:join(paths.project,'go-work'),GOCACHE:join(paths.project,'go-cache')};
    need(command('GO_VERSION',go,['version'],paths.project,goEnv) === `go version ${cliSource.go_version} linux/amd64`, 'GO_VERSION_DRIFT');
    receipt.go_version = cliSource.go_version;
    const moduleDir = join(upstream,'apps/cli-go');
    command('BUILD',go,['build','-trimpath','-ldflags',
      `-s -w -X github.com/supabase/cli/internal/utils.Version=${cliSource.build_version}`,
      '-o',paths.sidecar,'.'],moduleDir,goEnv,1200000);
    command('VERIFY_MODULES',go,['mod','verify'],moduleDir,goEnv);
    receipt.modules_verified = true;
    command('BUILD_ACTIVE_SHELL',bun,[join(here,'cli-bootstrap-compile.mjs'),upstream,paths.binary,
      cliSource.build_version],upstream,{},600000);
    need(command('FINAL_CHANGED_FILES','git',['status','--porcelain','--untracked-files=all'],upstream) === `M ${cliSource.patch_path}`,
      'CLI_UNREVIEWED_BUILD_MUTATION');
    for (const path of Object.keys(cliSource.source_files)) {
      need(hash(readFileSync(join(upstream,path))) === (path === cliSource.patch_path ? cliSource.patched_sha256 : cliSource.source_files[path]),
        'CLI_FINAL_SOURCE_DRIFT');
    }
    need(command('BINARY_VERSION',paths.binary,['--version']) === cliSource.build_version, 'CLI_BINARY_VERSION_REFUSED');
    for (const name of ['start','stop','services']) command(`BINARY_${name.toUpperCase()}_HELP`,paths.binary,[name,'--help']);
    receipt.start_stop_services_help_verified = true;
    receipt.binary_sha256 = hash(readFileSync(paths.binary));
    receipt.sidecar_sha256 = hash(readFileSync(paths.sidecar));
    receipt.result = 'BUILT';
    validateCliReceipt(receipt, receipt.binary_sha256, hash(readFileSync(manifestPath)),receipt.sidecar_sha256);
  } catch (error) {
    receipt.failure_stage = stage;
    receipt.failure_code = /^[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'CLI_BUILD_UNCLASSIFIED_FAILURE';
    process.exitCode = 1;
  } finally {
    const output = JSON.stringify(receipt,null,2) + '\n';
    writeFileSync(paths.receipt,output,{mode:0o600});
    writeFileSync(join(paths.publicDir,'cli-build-receipt.json'),output,{mode:0o600});
    console.log('R01_CLI_BUILD_JSON ' + JSON.stringify(receipt));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    need(process.argv.length === 3 && process.argv[2] === 'build', 'CLI_BUILD_COMMAND_REFUSED');
    await build();
  } catch {
    console.error('R01 disposable CLI build refused before completion.');
    process.exitCode = 1;
  }
}
