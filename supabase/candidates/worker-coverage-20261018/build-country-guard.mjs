// Generate an exactly scoped patch from the read-only canonical DEV snapshot.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = new URL('./', import.meta.url);
const baseline = readFileSync(new URL('live-worker-need-fit.sql', dir), 'utf8');
const body = (sql) => sql.split('$function$')[1];
const md5 = (value) => createHash('md5').update(value).digest('hex');
if (md5(body(baseline)) !== '74de2072260579799b651aa69f84cecb') throw Error('LIVE_SNAPSHOT_DRIFT');
const before = "else btrim(coalesce(n.approximate_city,''))<>'' and lower(coalesce(n.approximate_city,''))=lower(coalesce(p.city,'')) end,false);";
const after = `else n.task_country_code is not null
        and n.task_country_code=p.operating_country_code
        and btrim(coalesce(n.approximate_city,''))<>'' and lower(coalesce(n.approximate_city,''))=lower(coalesce(p.city,'')) end,false);`;
if (baseline.split(before).length !== 2) throw Error('PATCH_TARGET_NOT_UNIQUE');
const candidate = baseline.replace(before, after);
const baselineHash = md5(body(baseline));
const candidateHash = md5(body(candidate));
function wrap(definition, from, to) {
  return `-- PREPARED candidate/revert. Only the coordinate-free city fallback changes.
-- No profile data, table, grant, dispatch event, push or provider write.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create temporary table coverage_guard_before on commit drop as
select p.prosrc as body, p.proacl::text as acl, p.proowner as owner,
  p.prosecdef as secdef, p.provolatile as volatility, p.proparallel as parallel,
  p.proconfig::text as settings, private.closure_source_digest_v5() as closure_digest
from pg_proc p where p.oid='private.worker_need_fit_v1(uuid,uuid,boolean)'::regprocedure;
do $preflight$
begin
 if (select count(*) from coverage_guard_before)<>1 or
    (select md5(body) from coverage_guard_before) is distinct from '${from}' then
   raise exception 'WORKER_COUNTRY_PREDECESSOR_DRIFT' using errcode='PT409';
 end if;
 if (select closure_digest from coverage_guard_before) is null then
   raise exception 'WORKER_COUNTRY_CLOSURE_UNAVAILABLE' using errcode='PT409';
 end if;
end $preflight$;

${definition}
do $postflight$
declare p record; b record;
begin
 select * into p from pg_proc where oid='private.worker_need_fit_v1(uuid,uuid,boolean)'::regprocedure;
 select * into b from coverage_guard_before;
 if md5(p.prosrc) is distinct from '${to}' or
    row(p.proacl::text,p.proowner,p.prosecdef,p.provolatile,p.proparallel,p.proconfig::text)
      is distinct from row(b.acl,b.owner,b.secdef,b.volatility,b.parallel,b.settings) then
   raise exception 'WORKER_COUNTRY_POSTFLIGHT_DRIFT' using errcode='PT409';
 end if;
 if private.closure_source_digest_v5() is distinct from b.closure_digest then
   raise exception 'WORKER_COUNTRY_CLOSURE_CHANGED' using errcode='PT409';
 end if;
end $postflight$;
commit;
`;
}
writeFileSync(new URL('country-guard.candidate.sql',dir),wrap(candidate,baselineHash,candidateHash));
writeFileSync(new URL('country-guard.revert.sql',dir),wrap(baseline,candidateHash,baselineHash));
writeFileSync(new URL('country-guard.pins.json',dir),JSON.stringify({baselineBodyMd5:baselineHash,candidateBodyMd5:candidateHash},null,2)+'\n');
console.log({baselineHash,candidateHash});
