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
