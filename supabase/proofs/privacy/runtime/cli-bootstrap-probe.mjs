// Run only by the isolated CLI builder, using its pinned upstream checkout.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const upstream = process.argv[2];
const base = join(upstream,'apps/cli/src/legacy/shared/db-bootstrap');
const {legacyBuildPostgresStartContainerSpec} = await import(pathToFileURL(join(base,'postgres.service.ts')).href);
const {LEGACY_START_DB_WEBHOOK_SQL} = await import(pathToFileURL(join(base,'templates/db-webhook.sql.ts')).href);
const spec = legacyBuildPostgresStartContainerSpec({
  db:{port:54322,shadow_port:54320,health_timeout:'2m',major_version:17,
    pooler:{enabled:false,port:54329,pool_mode:'transaction',default_pool_size:20,max_client_conn:100},
    migrations:{enabled:false,schema_paths:[]},seed:{enabled:false,sql_paths:[]},settings:{},
    network_restrictions:{enabled:false,allowed_cidrs:[],allowed_cidrs_v6:[]}},
  experimental:{webhooks:{enabled:false},pgdelta:{enabled:false},inspect:{rules:[]}},
  jwtSecret:'synthetic-container-spec-probe-not-an-auth-session',jwtExpiry:3600,
  projectId:'uskoci-r01-schema-ci',networkId:'supabase_network_uskoci-r01-schema-ci',
  image:'supabase/postgres:17.6.1.165',configImage:'supabase/postgres:17.6.1.165',
});
assert.equal(spec.entrypoint,'sh');
assert.equal(spec.cmd[0],'-c');
const script = spec.cmd[1];
assert.equal(typeof script,'string');
const hash = data => createHash('sha256').update(data).digest('hex');
const {cmd,...rest} = spec;
console.log(JSON.stringify({script_sha256:hash(script),
  without_webhook_sha256:hash(script.replace(LEGACY_START_DB_WEBHOOK_SQL+'\n','')),
  webhook_present:script.includes(LEGACY_START_DB_WEBHOOK_SQL),
  spec_without_script_sha256:hash(JSON.stringify(rest))}));
