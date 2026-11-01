// Build an executable rollback-only proof, not a deploy migration. The candidate
// admission block is deliberately NOT executed against this reduced fixture.
import {readFileSync} from 'node:fs';
import {schemaSql,helperSql,readerSql,boundarySql,indexedSource,patch,countryArea,cityArea,radiusArea,uid,task,near,far,acct} from './saved_area_fixture.mjs';
export const pins=JSON.parse(readFileSync(new URL('../privacy/runtime/pins.json',import.meta.url),'utf8'));
const literal=s=>`'${String(s).replaceAll("'","''")}'`;
const json=x=>`${literal(JSON.stringify(x))}::jsonb`;
const envelope=areas=>json({profile:{workAreas:areas}});
const helperStart=indexedSource.indexOf('CREATE FUNCTION private.worker_saved_area_candidates_v1(');
const helperBody=indexedSource.slice(helperStart).split('AS $f$')[1].split('$f$;')[0];
export const physicalQuery=helperBody.replace(/\bcountry\b/g,"'RS'").replace(/\bcity\b/g,"'Novi Sad'").replace(/\blat\b/g,'45.25::numeric').replace(/\blng\b/g,'19.83::numeric');
export function buildPostgisProof(){
 return String.raw`\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='180s';
SET LOCAL lock_timeout='3s';
DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer<>${pins.postgres_version_num}
 OR inet_server_addr() IS NOT NULL OR to_regrole('cli_login_postgres') IS NOT NULL
 OR to_regclass('public.needs') IS NOT NULL OR to_regnamespace('private') IS NOT NULL
 THEN RAISE EXCEPTION 'R05_DISPOSABLE_EMPTY_SOCKET_DATABASE_REQUIRED'; END IF;
END; $guard$;
CREATE SCHEMA private; CREATE SCHEMA extensions;
CREATE EXTENSION postgis WITH SCHEMA extensions VERSION '${pins.extensions.find(e=>e.name==='postgis').version}';
${schemaSql.replace('CREATE SCHEMA private; CREATE SCHEMA extensions;','')}
${helperSql}
${boundarySql}
${readerSql}
CREATE FUNCTION pg_temp.check_true(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'R05_PROOF_FAILED: %',label; END IF; END; $f$;
CREATE TEMP TABLE proof_results(label text PRIMARY KEY,result jsonb);
INSERT INTO public.needs VALUES('${task}','STATIONARY',extensions.ST_SetSRID(extensions.ST_MakePoint(19.83,45.25),4326)::extensions.geography,'RS','Novi Sad',45.25,19.83);
INSERT INTO public.app_profiles VALUES('${near}','${acct(11)}','WORKER','ACTIVE'),('${far}','${acct(12)}','WORKER','ACTIVE');
INSERT INTO public.worker_match_preferences VALUES
 ('${near}','${acct(11)}',extensions.ST_SetSRID(extensions.ST_MakePoint(19.83,45.25),4326)::extensions.geography),
 ('${far}','${acct(12)}',extensions.ST_SetSRID(extensions.ST_MakePoint(22.30,42.40),4326)::extensions.geography);
INSERT INTO private.worker_ai_reviews VALUES('${uid(300001)}','${acct(12)}',${envelope([countryArea()])},'2026-10-01');
INSERT INTO private.worker_ai_saves VALUES('${uid(300001)}','${acct(12)}','2026-11-01');
SELECT pg_temp.check_true((SELECT array_agg(worker_profile_id) FROM private.candidate_profile_ids('${task}',10))=ARRAY['${near}'::uuid],'real 390km baseline omits signed country worker');
-- Invalid/erased history predates index build; neither helper may throw.
INSERT INTO private.worker_ai_reviews VALUES('${uid(300002)}','${acct(12)}','{"profile":{"workAreas":[{"kind":"RADIUS","latitude":"NaN"}]}}',null);
${indexedSource}
${patch}
SELECT pg_temp.check_true((SELECT array_agg(worker_profile_id) FROM private.candidate_profile_ids('${task}',10))=ARRAY['${near}'::uuid,'${far}'::uuid],'real far country rescue');
SELECT pg_temp.check_true((SELECT array_agg(worker_profile_id) FROM private.candidate_profile_ids_v1b('${task}',10,null))=ARRAY['${near}'::uuid,'${far}'::uuid],'null cap delegates');
SELECT pg_temp.check_true((SELECT array_agg(worker_profile_id) FROM private.candidate_profile_ids_v1b('${task}',1,1))=ARRAY['${far}'::uuid],'numeric cap preserves replacement');
INSERT INTO proof_results VALUES('retrieval_real_postgis','{"baselineFarOmitted":true,"rescuedCountry":true,"nullCap":true,"numericCap":true}');

-- No mutable projection: failed/rolled-back Save leaves the same authority.
SAVEPOINT rejected_save;
INSERT INTO private.worker_ai_reviews VALUES('${uid(300003)}','${acct(12)}',${envelope([])},null);
INSERT INTO private.worker_ai_saves VALUES('${uid(300003)}','${acct(12)}','2026-11-02');
SELECT pg_temp.check_true(NOT EXISTS(SELECT 1 FROM private.worker_saved_area_candidates_v1('RS','Novi Sad',45.25,19.83)),'latest empty Save supersedes history');
ROLLBACK TO SAVEPOINT rejected_save;
SELECT pg_temp.check_true(EXISTS(SELECT 1 FROM private.worker_saved_area_candidates_v1('RS','Novi Sad',45.25,19.83)),'rollback restores original authority');

-- CITY and RADIUS become two additional current owned saves.
INSERT INTO private.worker_ai_reviews VALUES
 ('${uid(300010)}','${acct(20)}',${envelope([cityArea('НОВИ   САД')])},null),
 ('${uid(300011)}','${acct(21)}',${envelope([radiusArea(1,0,0,1),radiusArea(1,10,10,2),radiusArea(1,-10,-10,3),radiusArea(1,20,20,4),radiusArea(10)])},null);
INSERT INTO private.worker_ai_saves VALUES('${uid(300010)}','${acct(20)}','2026-11-01'),('${uid(300011)}','${acct(21)}','2026-11-01');
SELECT pg_temp.check_true((SELECT count(*) FROM private.worker_saved_area_candidates_v1('RS','Novi Sad',45.25,19.83))=3,'country/canonical city/fifth radius all included');
SELECT pg_temp.check_true((SELECT count(*) FROM private.worker_saved_area_candidates_v1('ME','Novi Sad',45.25,19.83))=0,'country boundary');
SELECT pg_temp.check_true(private.worker_area_fit_v1(${json([radiusArea(1,45.7,19.83)])},'STATIONARY','RS','Novi Sad',45.25,19.83)=false,'exact radius rejects broad false positive');
SELECT pg_temp.check_true(extensions.ST_DWithin(private.worker_area_radius_centers_v1(${json([radiusArea(1,45.7,19.83)])}),extensions.ST_SetSRID(extensions.ST_MakePoint(19.83,45.25),4326)::extensions.geography,201000,false),'broad spatial retrieval intentionally contains that false positive');
SELECT pg_temp.check_true((SELECT count(*) FROM private.worker_saved_area_candidates_v1('RS','unknown','NaN'::numeric,'Infinity'::numeric))=1,'invalid task coordinates do not manufacture radius location');

-- Real sphere vs existing rounded haversine at the maximum accepted boundary.
-- Includes antimeridian/polar centers because the pinned validator accepts them.
CREATE TEMP TABLE radius_boundary AS
WITH centers AS (SELECT lat::numeric lat,lng::numeric lng FROM unnest(ARRAY[-89.99,0,43.32,45.25,89.99]) lat CROSS JOIN unnest(ARRAY[-179.99,0,19.83,179.99]) lng),
 angles AS (SELECT c.*,r.radius,b.bearing,radians(c.lat::float8) phi,radians(c.lng::float8) lam,(r.radius+0.0049)/6371.0 delta,radians(b.bearing::float8) theta
 FROM centers c CROSS JOIN unnest(ARRAY[1,200]) r(radius) CROSS JOIN generate_series(0,345,15) b(bearing)),
 destination AS (SELECT *,asin(sin(phi)*cos(delta)+cos(phi)*sin(delta)*cos(theta)) dest_phi FROM angles),
 points AS (SELECT *,degrees(dest_phi)::numeric target_lat,(degrees(lam+atan2(sin(theta)*sin(delta)*cos(phi),cos(delta)-sin(phi)*sin(dest_phi)))+540)::numeric%360-180 target_lng FROM destination)
SELECT *,private.haversine_km(lat,lng,target_lat,target_lng)<=radius exact_accept,
 extensions.ST_DWithin(extensions.ST_SetSRID(extensions.ST_MakePoint(lng::float8,lat::float8),4326)::extensions.geography,
 extensions.ST_SetSRID(extensions.ST_MakePoint(target_lng::float8,target_lat::float8),4326)::extensions.geography,201000,false) indexed_accept
FROM points;
SELECT pg_temp.check_true((SELECT count(*) FROM radius_boundary)=960,'full boundary matrix');
SELECT pg_temp.check_true(NOT EXISTS(SELECT 1 FROM radius_boundary WHERE exact_accept AND NOT indexed_accept),'201km superset loses no accepted rounded-radius edge');
SELECT pg_temp.check_true((SELECT count(*) FROM radius_boundary WHERE exact_accept)>900,'boundary positive controls actually pass exact matcher');
INSERT INTO proof_results SELECT 'radius_boundary',jsonb_build_object('cases',count(*),'exactAccepted',count(*) FILTER(WHERE exact_accept),'lostAccepted',count(*) FILTER(WHERE exact_accept AND NOT indexed_accept)) FROM radius_boundary;

-- A realistic selective set; do not disable sequential scans to force a plan.
INSERT INTO private.worker_ai_reviews(id,account_id,envelope)
SELECT md5('r05-review'||g)::uuid,md5('r05-owner'||g)::uuid,
 jsonb_build_object('profile',jsonb_build_object('workAreas',jsonb_build_array(
 ${json(cityArea())}||jsonb_build_object('city','City'||g,'label','City'||g),${json(radiusArea(10,0,0,2))})))
FROM generate_series(1,4000) g;
INSERT INTO private.worker_ai_saves SELECT id,account_id,'2026-11-01'::timestamptz FROM private.worker_ai_reviews WHERE account_id NOT IN('${acct(12)}','${acct(20)}','${acct(21)}');
ANALYZE private.worker_ai_reviews; ANALYZE private.worker_ai_saves;
DO $plans$
DECLARE p jsonb;
BEGIN
 EXECUTE ${literal('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+physicalQuery)} INTO p;
 PERFORM pg_temp.check_true(jsonb_path_exists(p,'$.**."Index Name" ? (@ == "r05_worker_review_area_keys_idx")'),'real GIN selected in full actual superset SQL');
 PERFORM pg_temp.check_true(jsonb_path_exists(p,'$.**."Index Name" ? (@ == "r05_worker_review_radius_centers_idx")'),'real GiST selected in full actual superset SQL');
 PERFORM pg_temp.check_true(jsonb_path_exists(p,'$.**."Index Name" ? (@ == "r05_worker_saves_latest_idx")'),'latest Save index selected');
 PERFORM pg_temp.check_true((p#>>'{0,Plan,Actual Rows}')::integer=3,'full superset query returns exact three current accounts');
 INSERT INTO proof_results VALUES('actual_superset_plan',p);
 EXECUTE ${literal('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+physicalQuery.replaceAll("'Novi Sad'","'No such city'").replaceAll('45.25::numeric','70::numeric').replaceAll('19.83::numeric','100::numeric'))} INTO p;
 PERFORM pg_temp.check_true((p#>>'{0,Plan,Actual Rows}')::integer=1,'country still matches while spatial/city branches have no match');
 INSERT INTO proof_results VALUES('sparse_other_location_plan',p);
END; $plans$;
SELECT jsonb_build_object('unit','R05_POSTGIS_INDEXED_SAVED_AREA_PROOF','postgresVersion',current_setting('server_version_num')::integer,'postgisVersion',extensions.postgis_lib_version(),'checks',jsonb_object_agg(label,result),'scope','real PostGIS/index/retrieval on synthetic owned Save records; final dispatch gate stubbed; no Auth/DEV/current-schema acceptance') FROM proof_results;
ROLLBACK;
`;
}
