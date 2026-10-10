import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const folder=dirname(fileURLToPath(import.meta.url));
const sqlDir=join(folder,'../../candidates/match-category-fallback-20261010');
const candidate=readFileSync(join(sqlDir,'candidate.sql'),'utf8');
const revert=readFileSync(join(sqlDir,'revert.sql'),'utf8');
const before=readFileSync(join(folder,'before.prosrc.sql'),'utf8');
const md5=s=>createHash('md5').update(s).digest('hex');
const body=s=>{const m=s.match(/AS \$function\$([\s\S]*?)\$function\$/); assert.ok(m,'PL/pgSQL function must retain its body');return m[1];};
// PostgreSQL pg_get_functiondef renders the original body verbatim between dollar tags.
const after=body(candidate),beforeFromRevert=body(revert);
test('forward and revert DDL are executable terminated function statements',()=>{
 for (const sql of [candidate,revert]) {
   assert.match(sql,/end;\n\$function\$;\n\ndo \$postflight\$/);
   assert.equal((sql.match(/CREATE OR REPLACE FUNCTION private\.worker_need_fit_v1\(/g)||[]).length,1);
 }
});

test('the exact live predecessor is retained for a safe revert',()=>{
 assert.equal(md5(before),'ab221f0091d78856bb42f702ddecd016');
 assert.equal(beforeFromRevert,before);
 assert.equal(md5(after),'d18c47226723ffbbec474aa4547e1af1');
});
test('only the three approved anchors change, never output/blocker/area/clock policy',()=>{
 let expected=before;
 const anchors=[["  hard text[]:='{}'; svc boolean; area boolean; dist numeric; radius numeric; tier integer;","  hard text[]:='{}'; svc boolean; area boolean; dist numeric; radius numeric; tier integer;\n  effective_skills text[];"],["  -- Kind of work, first the same words: the task names none, or worker and task share a word.\n  svc:=coalesce(coalesce(cardinality(n.required_skills),0)=0\n       or private.lower_arr(p.skills) && private.lower_arr(n.required_skills),false);","  -- Match on explicitly requested skills. If absent, match the AI-confirmed\n  -- category, never treat an empty skills array as \"every worker matches\".\n  -- A missing or unrecognized category is not a wildcard.\n  effective_skills := case when coalesce(cardinality(n.required_skills),0)>0 then n.required_skills\n    else array_remove(array[n.category]::text[],null) end;\n  svc:=coalesce(private.lower_arr(p.skills) && private.lower_arr(effective_skills),false);"],["  -- Kind of work in other words: the same hidden kind (PKG-031b / EX-06b), read only when no word is shared.\n  if not svc then\n    svc:=coalesce(private.work_kinds_v5(p.skills) && private.work_kinds_v5(n.required_skills),false);\n  end if;","  -- Existing canonical 11-kind vocabulary covers spelling differences for\n  -- both explicit requirements and the fallback task category.\n  if not svc then\n    svc:=coalesce(private.work_kinds_v5(p.skills) && private.work_kinds_v5(effective_skills),false);\n  end if;"]];
 for(const [a,b] of anchors){assert.equal(expected.split(a).length,2);expected=expected.replace(a,b);}
 assert.equal(after,expected);
 assert.match(after,/effective_skills := case when coalesce\(cardinality\(n\.required_skills\),0\)>0 then n\.required_skills/);
 assert.match(after,/array_remove\(array\[n\.category\]::text\[\],null\)/);
 assert.doesNotMatch(after,/svc:=coalesce\(coalesce\(cardinality\(n\.required_skills\),0\)=0/);
});
test('rollbacks have drift/closure/ACL gates and contain no dispatch, device or event writes',()=>{
 for(const s of [candidate,revert]) {
   for(const bit of ['MATCH_CATEGORY_PREDECESSOR_DRIFT','MATCH_CATEGORY_POSTFLIGHT_MISMATCH','closure_source_digest_v5','proacl::text','prosecdef','begin;','commit;'])assert.ok(s.includes(bit));
   assert.doesNotMatch(s,/\b(?:insert|update|delete|truncate)\s+(?:into\s+|from\s+)?(?:public\.|private\.)?(?:needs|user_activity_events|notification_deliveries|opportunity_deliveries)\b/i);
 }
});


test('disposable dispatch prefilter pins byte-exact canonical helper bodies',()=>{
 const defs=readFileSync(join(folder,'live-dispatch-prefilter.sql'),'utf8');
 const captured=[
  ['dispatch_cheap_candidate_admitted','cec5c0a2c13af6718af53b7a80245f28'],
  ['worker_need_match_v1','ef94ef7de07a347824ace68789f08c41']
 ];
 for(const [name,expected] of captured){
  const re=new RegExp('CREATE OR REPLACE FUNCTION private\\.'+name+'\\([\\s\\S]*?AS \\$function\\$([\\s\\S]*?)\\$function\\$;');
  const m=defs.match(re);
  assert.ok(m,'Missing canonical function source: '+name);
  assert.equal(md5(m[1]),expected,'Live-sourced function drift: '+name);
 }
 assert.match(defs,/and private\.worker_need_match_v1\(n\.id, p\.id\)/);
 assert.match(defs,/coalesce\(pref\.proactive_notifications, true\) = true/);
 assert.match(defs,/od\.need_revision = n\.revision/);
 const fixture=readFileSync(join(folder,'disposable-schema.sql'),'utf8');
 assert.match(fixture,/CREATE TABLE public\.opportunity_deliveries/);
 const cases=readFileSync(join(folder,'dispatch-prefilter-assert.sql'),'utf8');
 for(const label of ['qualified_cleaning','unrelated_delivery','own_need','proactive_paused',
  'suspended_worker','calendar_stub_rejected','same_worker_same_need_revision_already_delivered',
  'new_revision_does_not_hit_old_dedupe','petrovaradin_without_center',
  'explicit_moving_skill_overrides_cleaning_category']){
  assert.ok(cases.includes(label),'Missing dispatch assertion '+label);
 }
 assert.match(cases,/ROLLBACK TO SAVEPOINT dispatch_prefilter_cases;/);
 assert.match(cases,/ROLLBACK;\s*$/);
});


test('captured exact DEV calendar SQL bodies and isolated-only staging',()=>{
 const calendar=readFileSync(join(folder,'live-calendar-helpers.sql'),'utf8');
 const hashes=[
  ['availability_timezone_valid','be95520dabe35febd8e9fa15f0ce0309'],
  ['availability_is_future','3a1aee763e9fe3d0f06d6ba04ef21aac'],
  ['worker_calendar_conflict','417c9db16bbe70ed9ad652380790900c'],
  ['worker_available_periods','5107af3020a3beb7bb45e6e90e7a203b'],
  ['schedule_fit','e29a7bade1437e3f2067924b5179ddfd'],
  ['worker_need_time_tier_v1','753027749309ccc110f486cbfb4866e4']
 ];
 for(const [name,expected] of hashes) {
  const re=new RegExp('CREATE OR REPLACE FUNCTION private\\.'+name+'\\([\\s\\S]*?AS \\$function\\$([\\s\\S]*?)\\$function\\$;');
  const m=calendar.match(re);
  assert.ok(m,'Missing canonical calendar body '+name);
  assert.equal(md5(m[1]),expected,'Calendar source changed '+name);
 }
 const caseSql=readFileSync(join(folder,'calendar-live-assert.sql'),'utf8');
 for(const marker of [
  'fixed_future_without_availability','fixed_future_with_available_window',
  'blocked_agreement_intersects_fixed','unblocked_agreement_recovers',
  'unavailable_window_overrides_available','belgrade_weekly_rule_covers_fixed',
  'disabled_weekly_rule_refuses','unknown_worker_timezone_refuses',
  'today_available_now_tier1','today_blocked_by_agreement']){
   assert.ok(caseSql.includes(marker),'Missing real-calendar case '+marker);
 }
 assert.match(caseSql,/ROLLBACK TO SAVEPOINT true_calendar_cases;/);
 assert.match(caseSql,/ROLLBACK;\s*$/);
 const workflow=readFileSync(join(folder,'../../../.github/workflows/match-category-fallback-proof.yml'),'utf8');
 assert.match(workflow,/STAGE 7: real DEV timezone\/availability\/calendar/);
 assert.match(workflow,/run_pg < "\$root\/live-calendar-helpers\.sql"/);
 assert.match(workflow,/run_pg < "\$root\/calendar-live-assert\.sql"/);
});


test('isolated wave executes pinned server function with local-only delivery adapter',()=>{
 const src=readFileSync(join(folder,'live-wave-entry.sql'),'utf8');
 for(const [name,hash] of [
  ['need_search_time_admitted_v1','b830cd07c2a5db101a3a28096256a75b'],
  ['dispatch_config_v1b','7aa34ff0b5f4a3637c433bec317c1c13'],
  ['dispatch_next_wave','d3cdfe2bdd6e5d40a74e6029793c89c5']
 ]){
  const re=new RegExp('CREATE OR REPLACE FUNCTION private\\.'+name+'\\([\\s\\S]*?AS \\$function\\$([\\s\\S]*?)\\$function\\$;');
  const matched=src.match(re);
  assert.ok(matched,'Missing live wave function '+name);
  assert.equal(md5(matched[1]),hash,'Wave function source drift '+name);
 }
 const fixture=readFileSync(join(folder,'wave-disposable-fixture.sql'),'utf8');
 assert.match(fixture,/CREATE FUNCTION private\.emit_event\(/);
 assert.match(fixture,/CREATE TABLE public\.user_activity_events/);
 assert.match(fixture,/CREATE FUNCTION private\.candidate_profile_ids_v1b\(/);
 assert.match(fixture,/CREATE FUNCTION private\.match_detail\(/);
 assert.doesNotMatch(fixture,/\b(?:http_post|net\.http|pg_notify|pg_cron|expo\.dev)\b/i);
 const assertions=readFileSync(join(folder,'wave-live-assert.sql'),'utf8');
 for(const marker of [
  'LIVE_WAVE_SIM_FIRST_SEND','LIVE_WAVE_SIM_DUPLICATE',
  'LIVE_WAVE_SIM_UNRELATED','LIVE_WAVE_SIM_NEW_REVISION','LIVE_WAVE_SIM_OWN_TASK',
  'LIVE_WAVE_SIM_PROACTIVE_DISABLED','LIVE_WAVE_SIM_SUSPENDED',
  'LIVE_WAVE_SIM_CLOSED_SEARCH']){
   assert.ok(assertions.includes(marker),'Missing wave case '+marker);
 }
 assert.match(assertions,/ROLLBACK TO SAVEPOINT synthetic_wave_cases;/);
 assert.match(assertions,/ROLLBACK;\s*$/);
 const yml=readFileSync(join(folder,'../../../.github/workflows/match-category-fallback-proof.yml'),'utf8');
 for(const name of ['wave-disposable-fixture.sql','live-wave-entry.sql','wave-live-assert.sql']){
  assert.ok(yml.includes('run_pg < "$root/'+name+'"'),'Missing CI stage for '+name);
 }
});


test('exact SQL event emission and preference gates remain local-only',()=>{
 const source=readFileSync(join(folder,'live-notification-builder.sql'),'utf8');
 for(const [name,hash] of [
  ['category_of_event','85389285506a1f5801ad204f60dfa2a1'],
  ['notification_copy_v5','e725df74604d4b52c0a3fad90b748c51'],
  ['in_quiet_hours','386e00eb4a7645addffac95fde09bea7'],
  ['emit_event','67413effbbb3fa227397d355e0d4edfb']
 ]){
  const re=new RegExp('CREATE OR REPLACE FUNCTION private\\.'+name+'\\([\\s\\S]*?AS \\$function\\$([\\s\\S]*?)\\$function\\$;');
  const found=source.match(re);
  assert.ok(found,'Missing live notification helper '+name);
  assert.equal(md5(found[1]),hash,'Unexpected event source drift '+name);
 }
 const fixture=readFileSync(join(folder,'notification-disposable-fixture.sql'),'utf8');
 assert.match(fixture,/CREATE TABLE public\.notification_preferences/);
 assert.match(fixture,/CREATE TABLE public\.notification_deliveries/);
 const fixtureSql=fixture.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
 assert.doesNotMatch(fixtureSql,/\b(?:http_post|net\.http|expo\.dev|firebase|push_token|pg_notify)\b/i);
 const scenarios=readFileSync(join(folder,'notification-live-assert.sql'),'utf8');
 for(const marker of ['REAL_NOTIFICATION_FIRST_WAVE',
  'REAL_NOTIFICATION_DUPLICATE_DETECTED','REAL_NOTIFICATION_OPPORTUNITIES_OFF',
  'REAL_NOTIFICATION_PUSH_OFF','REAL_NOTIFICATION_QUIET_HOURS',
  'REAL_NOTIFICATION_URGENT_OVERRIDE']){
  assert.ok(scenarios.includes(marker),'Missing local event case '+marker);
 }
 assert.match(scenarios,/ROLLBACK TO SAVEPOINT real_notification_cases;/);
 assert.match(scenarios,/ROLLBACK;\s*$/);
 const ci=readFileSync(join(folder,'../../../.github/workflows/match-category-fallback-proof.yml'),'utf8');
 for(const name of ['notification-disposable-fixture.sql','live-notification-builder.sql',
  'notification-live-assert.sql']){
  assert.ok(ci.includes('run_pg < "$root/'+name+'"'),'Missing CI event stage '+name);
 }
});


test('canonical detailed scoring source and calendar/score wave proof are pinned',()=>{
 const src=readFileSync(join(folder,'live-match-detail.sql'),'utf8');
 const bodies=[
  ['match_detail_without_calendar','efd50886ff898f45129d33231761d189'],
  ['match_detail_for_calendar_interval','781956cab666befab216b3ce2334ca1d'],
  ['match_detail','38c7894a8cf43a8f32bd5a30bc2cbd09']
 ];
 for(const [name,digest] of bodies){
  const re=new RegExp('CREATE OR REPLACE FUNCTION private\\.'+name+'\\([\\s\\S]*?AS \\$function\\$([\\s\\S]*?)\\$function\\$;');
  const found=src.match(re);
  assert.ok(found,'Missing exact server function '+name);
  assert.equal(md5(found[1]),digest,'Scoring source drift '+name);
 }
 const fixture=readFileSync(join(folder,'match-detail-disposable-fixture.sql'),'utf8');
 for(const input of ['rating_worker','same_day_urgent_notifications','created_at']){
  assert.ok(fixture.includes(input),'Required local-only scoring input '+input);
 }
 const assertions=readFileSync(join(folder,'match-detail-live-assert.sql'),'utf8');
 for(const scenario of ['REAL_SCORE_CLEANER_BASELINE','REAL_SCORE_RATING_WEIGHTS',
 'REAL_SCORE_EXPOSURE_FAIRNESS','REAL_SCORE_EXCLUSION_HARD_REFUSAL',
 'REAL_SCORE_OWN_NEED_HARD_REFUSAL','REAL_SCORE_CALENDAR_INTERVAL_CONFLICT',
 'REAL_SCORING_IN_WAVE']){
  assert.ok(assertions.includes(scenario),'Missing real scoring assertion '+scenario);
 }
 assert.match(assertions,/ROLLBACK TO SAVEPOINT real_scoring_cases;/);
 assert.match(assertions,/ROLLBACK;\s*$/);
 const ci=readFileSync(join(folder,'../../../.github/workflows/match-category-fallback-proof.yml'),'utf8');
 for(const name of ['match-detail-disposable-fixture.sql','live-match-detail.sql','match-detail-live-assert.sql']){
  assert.ok(ci.includes('run_pg < "$root/'+name+'"'),'Missing isolated scoring job '+name);
 }
});


test('exact candidate source and fake-geometry boundary are explicit',()=>{
 const src=readFileSync(join(folder,'live-candidate-stream.sql'),'utf8');
 for(const [name,digest] of [
 ['worker_notify_room_v1b','9aac9da0479327fdf82b2f9298e47719'],
 ['candidate_profile_ids','5414fa5a122e2055c71dd37993a6ad83'],
 ['candidate_profile_ids_v1b','9a2437fd9d6bed07c8338d12501e5cba']
 ]){
  const re=new RegExp('CREATE OR REPLACE FUNCTION private\\.'+name+'\\([\\s\\S]*?AS \\$function\\$([\\s\\S]*?)\\$function\\$;');
  const found=src.match(re);
  assert.ok(found,'Missing captured candidate source '+name);
  assert.equal(md5(found[1]),digest,'Candidate source drift: '+name);
 }
 const spatial=readFileSync(join(folder,'candidate-spatial-disposable-fixture.sql'),'utf8');
 assert.match(spatial,/CREATE DOMAIN extensions\.geography AS numeric/);
 assert.match(spatial,/CREATE OPERATOR extensions\.<->/);
 assert.match(spatial,/CREATE FUNCTION extensions\.ST_DWithin/);
 assert.match(spatial,/-- Synthetic, reversible stand-in/);
 const assertions=readFileSync(join(folder,'candidate-live-assert.sql'),'utf8');
 for(const caseName of [
 'CANDIDATE_TWO_NEAREST_IN_ORDER','CANDIDATE_LIMIT_ONE',
 'CANDIDATE_CAP_ONE_SKIPS_PRIMARY','CANDIDATE_URGENT_NOT_EXEMPT',
 'CANDIDATE_CAP_REJECTS_BOTH','CANDIDATE_GEO_PREFILTER',
 'CANDIDATE_UNRELATED_SKILL_NOT_BLOCKED','CANDIDATE_FULL_LOCAL_WAVE']){
  assert.ok(assertions.includes(caseName),'Missing real candidate test '+caseName);
 }
 assert.match(assertions,/ROLLBACK TO SAVEPOINT candidate_loop_cases;/);
 assert.match(assertions,/ROLLBACK;\s*$/);
 const workflow=readFileSync(join(folder,'../../../.github/workflows/match-category-fallback-proof.yml'),'utf8');
 for(const name of ['candidate-spatial-disposable-fixture.sql','live-candidate-stream.sql','candidate-live-assert.sql'])
  assert.ok(workflow.includes('run_pg < "$root/'+name+'"'),'Missing CI file '+name);
});


test('separate real PostGIS service never points to DEV/PROD',()=>{
 const workflow=readFileSync(join(folder,'../../../.github/workflows/match-category-fallback-proof.yml'),'utf8');
 assert.match(workflow,/spatial-postgis:[\s\S]*?image: postgis\/postgis:16-3\.5/);
 assert.match(workflow,/CREATE DATABASE geo_proof TEMPLATE template0/);
 assert.match(workflow,/CREATE EXTENSION postgis WITH SCHEMA extensions/);
 assert.match(workflow,/REAL_POSTGIS_PROOF_PASS; synthetic coordinates/);
 const fixture=readFileSync(join(folder,'spatial-postgis-fixture.sql'),'utf8');
 assert.match(fixture,/ADD COLUMN approx_geog extensions\.geography/);
 assert.match(fixture,/ADD COLUMN approximate_geog extensions\.geography/);
 assert.doesNotMatch(fixture,/CREATE DOMAIN extensions\.geography/);
 const testSql=readFileSync(join(folder,'spatial-postgis-assert.sql'),'utf8');
 for(const marker of [
  'REAL_POSTGIS_NEAREST_FIRST','REAL_POSTGIS_LIMIT_ONE',
  'REAL_POSTGIS_DAILY_CAP_NEXT_WORKER','REAL_POSTGIS_300KM_GATE',
  'REAL_POSTGIS_NO_CENTER_CITY_FALLBACK','REAL_POSTGIS_UNRELATED_SERVICE_ADMITTED']){
  assert.ok(testSql.includes(marker),'Missing actual spatial assertion '+marker);
 }
 assert.match(testSql,/ROLLBACK TO SAVEPOINT postgis_real_search;/);
 assert.match(testSql,/ROLLBACK;\s*$/);
});


test('DEV E2E operator preflight contains only a read-only SELECT and fails closed', () => {
 const s=readFileSync(join(folder,'dev-e2e-readiness.sql'),'utf8');
 const executable=s.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'').trim();
 assert.match(executable,/^WITH\s+source\s+AS\s*\(/i);
 assert.match(executable,/\bSELECT\s+[\s\S]*\bFROM\s+checks\s*;/i);
 assert.doesNotMatch(executable,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|CALL|PERFORM|EXECUTE|COPY)\b/i);
 assert.match(executable,/live_matcher_md5\s*=\s*'d18c47226723ffbbec474aa4547e1af1'/);
 for (const gate of ['active_marketplace_crons = 0','queued_needs = 0','active_session_bound_devices >= 1',
   "'MANUAL_GATES_STILL_REQUIRED'","'BLOCKED'"]) assert.ok(executable.includes(gate),gate);
});
