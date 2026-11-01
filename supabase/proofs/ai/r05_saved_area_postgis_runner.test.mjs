import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRuntime,dockerStartArgs} from '../r05/run_saved_area_postgis_proof.mjs';
import {buildPostgisProof,physicalQuery} from '../r05/saved_area_postgis_proof.mjs';
import {indexedSource,patch,radiusIndex,makeDb,applyIndexed} from '../r05/saved_area_fixture.mjs';

test('PostGIS runner accepts only its pinned isolated Docker container and rejects external connections',()=>{
 validateRuntime({});
 for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','PGHOST','PGSERVICE','DATABASE_URL','SUPABASE_DB_URL'])
  assert.throws(()=>validateRuntime({[key]:'external'}),/R05_EXTERNAL_RUNTIME_REFUSED/);
 const args=dockerStartArgs('uskoci-r05-00000000-0000-4000-8000-000000000000');
 assert.ok(args.includes('supabase/postgres:17.6.1.165'));
 assert.equal(args[args.indexOf('--network')+1],'none');
 assert.ok(args.at(-1).includes('--locale=C.UTF-8'),'canonical Cyrillic city lowercasing must not run in ASCII-only C locale');
 assert.ok(args.includes('--rm'));assert.ok(!args.includes('--volume'));assert.ok(!args.includes('--publish'));
 assert.throws(()=>dockerStartArgs('existing-container'));
});
test('generated rollback proof embeds exact candidate expressions/patch and executes actual plans',()=>{
 const proof=buildPostgisProof();
 assert.ok(proof.includes(indexedSource));assert.ok(proof.includes(patch));assert.ok(proof.includes(radiusIndex));
 assert.match(proof,/CREATE EXTENSION postgis WITH SCHEMA extensions VERSION '3\.3\.7'/);
 assert.match(proof,/EXPLAIN \(ANALYZE,BUFFERS,FORMAT JSON\)/);
 assert.match(proof,/generate_series\(1,4000\)/);
 assert.doesNotMatch(proof,/enable_seqscan|enable_indexscan|enable_bitmapscan|DROP |TRUNCATE /);
 assert.ok(proof.trimEnd().endsWith('ROLLBACK;'));
 assert.ok(physicalQuery.includes('201000.0,false'));
});
test('actual superset SQL used by EXPLAIN is executable and equivalent to candidate helper',async t=>{
 const db=await makeDb();t.after(()=>db.close());await applyIndexed(db);
 const inline=(await db.query(physicalQuery)).rows;
 const call=(await db.query("SELECT * FROM private.worker_saved_area_candidates_v1('RS','Novi Sad',45.25,19.83)")).rows;
 assert.deepEqual(inline.map(r=>r.account_id),call.map(r=>r.worker_account_id));
 const badCoordinates=(await db.query("SELECT * FROM private.worker_saved_area_candidates_v1('RS','unknown','NaN'::numeric,'Infinity'::numeric)")).rows;
 assert.equal(badCoordinates.length,1,'only COUNTRY can match invalid coordinates; no fabricated RADIUS');
});
