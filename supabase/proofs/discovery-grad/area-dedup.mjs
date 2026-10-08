// Disposable experiment only. No migration, helper, schema or certificate change.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const md5 = text => createHash('md5').update(text).digest('hex');
const once = (text, before, after) => {
  assert.equal(text.split(before).length, 2, 'AREA_EXPERIMENT_ANCHOR');
  return text.replace(before, after);
};
export function areaExperiment() {
  const source = readFileSync('supabase/candidates/discovery-grad-20261008/candidate.sql', 'utf8').replace(/\r\n/g, '\n');
  const baseline = /new_body text:=\$dg_body\$([\s\S]*?)\$dg_body\$;/.exec(source)?.[1];
  assert.equal(md5(baseline), 'a9b0985991f4ebfe4e95143e5cf57222', 'AREA_BASELINE_PIN');
  let candidate = once(baseline, ' with base as materialized (', ' with base_rows as materialized (');
  candidate = once(candidate, `   case when request_mode='PLACES'
     or query_text<>''
    then public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE')
    else null::text end as area_text,
`, `   case when request_mode='PLACES' or query_text<>'' then
    jsonb_build_array(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE')
    else null::jsonb end as search_place_key,
`);
  candidate = once(candidate, ' ), place_keys as materialized (', ` ), search_locations as materialized (
  select k.search_place_key,
    public.p6_discovery_area(k.search_place_key->>0,k.search_place_key->>1,(k.search_place_key->>2)::boolean) as area_text
  from (select b.search_place_key from base_rows b where b.search_place_key is not null
    group by b.search_place_key offset 0) k
 ), base as materialized (
  select b.*,l.area_text from base_rows b left join search_locations l on l.search_place_key=b.search_place_key
 ), place_keys as materialized (`);
  const hashes = {baseline: md5(baseline), candidate: md5(candidate)};
  const swap = (from, to) => {
    assert.ok(!to.includes('$area_payload$'));
    return `declare o oid; old_body text; meta jsonb; note text; def text;
        payload text:=$area_payload$${to}$area_payload$;
        digest text:=private.closure_source_digest_v5(); program text:=private.closure_erasure_program_digest_v5();
      begin
        if private.retention_ai_source_ready() is distinct from true then raise exception 'AREA_CERT_NOT_READY'; end if;
        o:=to_regprocedure('public.rpc_discovery_v1(jsonb)');
        select prosrc,to_jsonb(p)-'prosrc',obj_description(p.oid,'pg_proc') into strict old_body,meta,note from pg_proc p where p.oid=o;
        if md5(old_body)<>'${md5(from)}' or md5(payload)<>'${md5(to)}' then raise exception 'AREA_BODY_DRIFT'; end if;
        def:=pg_get_functiondef(o);
        if (length(def)-length(replace(def,old_body,'')))/length(old_body)<>1 then raise exception 'AREA_BODY_ANCHOR'; end if;
        execute replace(def,old_body,payload);
        if (select prosrc from pg_proc where oid=o) is distinct from payload
          or (select to_jsonb(p)-'prosrc' from pg_proc p where p.oid=o) is distinct from meta
          or obj_description(o,'pg_proc') is distinct from note then raise exception 'AREA_METADATA_DRIFT'; end if;
        if private.closure_source_digest_v5() is distinct from digest
          or private.closure_erasure_program_digest_v5() is distinct from program
          or private.retention_ai_source_ready() is distinct from true then raise exception 'AREA_CERT_DRIFT'; end if;
      end;`;
  };
  const applyBlock = swap(baseline, candidate), revertBlock = swap(candidate, baseline);
  const wrap = block => `begin; set local lock_timeout='5s'; set local statement_timeout='120s'; set local search_path=pg_catalog; do $area_replace$ ${block} $area_replace$; commit;`;
  return {baseline, candidate, hashes, applyBlock, revertBlock, apply: wrap(applyBlock), revert: wrap(revertBlock)};
}

