// Real SQL against disposable in-memory PostgreSQL 18, not pinned native/hosted proof.
// Unit tests separately exercise the unchanged PostgreSQL 17.6 observation contract.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {uuid_ossp} from '@electric-sql/pglite/contrib/uuid_ossp';
import {pg_stat_statements} from '@electric-sql/pglite/contrib/pg_stat_statements';
import {extensionProvenanceObservation} from './extension-provenance.mjs';

const sql = readFileSync(new URL('./extension-provenance.sql', import.meta.url), 'utf8');
const md5 = value => createHash('md5').update(value).digest('hex');
const capture = async db => {
  const result = await db.exec(sql);
  return result.find(value => value.rows[0]?.capture)?.rows[0].capture;
};

test('actual read-only SQL distinguishes native, created, owner-only, and ACL changes without leaking private names', async () => {
  const db = new PGlite({extensions: {pgcrypto, uuid_ossp, pg_stat_statements}});
  try {
    await db.exec(`CREATE ROLE supabase_admin SUPERUSER;
      CREATE ROLE diagnostic_private_owner;
      CREATE ROLE dashboard_user;
      CREATE SCHEMA extensions;
      CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
      CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
      SET app.settings.jwt_secret = 'PRIVATE_SETTING_MARKER';
      SET ROLE supabase_admin;`);
    const native = await capture(db);
    assert.equal(native.read_only, 'on');
    assert.equal(native.capture_role, 'supabase_admin');
    assert.equal(native.extensions[0].present, false);
    assert.equal(native.extensions[0].owner_md5, null);
    assert.deepEqual(native.extensions[0].routines, []);
    assert.equal(native.extensions[1].owner_md5, md5('postgres'));
    assert.ok(native.extensions[1].routines.length > 0);
    assert.deepEqual(await capture(db), native);
    // Unknown custom settings and missing supautils are never dumped as raw values.
    assert.equal(native.delegation.privileged_role_md5, null);
    assert.equal(native.delegation.privileged_extensions_superuser_md5, null);
    assert.equal(native.delegation.extension_allowlist.every(row => row.listed === null), true);
    assert.equal(JSON.stringify(native).includes('PRIVATE_SETTING_MARKER'), false);

    await db.exec('CREATE EXTENSION pg_stat_statements WITH SCHEMA extensions;');
    const created = await capture(db);
    assert.equal(created.extensions[0].present, true);
    assert.equal(created.extensions[0].owner_md5, md5('supabase_admin'));
    assert.ok(created.extensions[0].routines.length > 0);
    assert.deepEqual(created.extensions.slice(1), native.extensions.slice(1));

    await db.exec('ALTER FUNCTION extensions.gen_random_bytes(integer) OWNER TO diagnostic_private_owner;');
    const owned = await capture(db);
    const ownerChanges = owned.extensions[1].routines.filter((row, index) =>
      row.owner_md5 !== created.extensions[1].routines[index].owner_md5);
    assert.equal(ownerChanges.length, 1);
    assert.equal(ownerChanges[0].owner_md5, md5('diagnostic_private_owner'));
    assert.equal(JSON.stringify(owned).includes('diagnostic_private_owner'), false);
    assert.equal(owned.extensions[1].owner_md5, created.extensions[1].owner_md5);

    await db.exec('GRANT EXECUTE ON FUNCTION extensions.gen_random_bytes(integer) TO dashboard_user;');
    const granted = await capture(db);
    const changedAcls = granted.extensions[1].routines.filter((row, index) =>
      row.acl_md5 !== owned.extensions[1].routines[index].acl_md5);
    assert.equal(changedAcls.length, 1);
    assert.equal(changedAcls[0].key_hash, ownerChanges[0].key_hash);
    assert.deepEqual(granted.extensions[1].routines.map(row => row.owner_md5),
      owned.extensions[1].routines.map(row => row.owner_md5));
    assert.equal(JSON.stringify(granted).includes('dashboard_user'), false);
    assert.deepEqual(await capture(db), granted);
    // This test never passes off PGlite 18 as admitted pinned native PostgreSQL 17.6.
    assert.notEqual(granted.server_version_num, 170006);
    assert.throws(() => extensionProvenanceObservation(granted), /FORMAT_REFUSED/);
  } finally {
    await db.close();
  }
});
