from pathlib import Path
import json
p=Path(__file__).resolve().parent
old=p.parent/'closure-taxonomy-20261018'
baseline=p.parent/'closure-f01-rebase-20261021'
read=lambda f:f.read_text(encoding='utf-8')
cap=json.loads(read(old/'predecessor.json'))
cap['functions']=json.loads(read(p/'functions.readback.json'))+json.loads(read(p/'handoff.readback.json'))
cap['tables']=json.loads(read(p/'tables.readback.json'))
cap['sourceDigest']='e064bf5bd995c9b846495f9f808c2910ba56d21f5fcb56b84ad98514d569bb79'
(p/'predecessor.json').write_text(json.dumps(cap,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for name in ['helpers.sql','manifest.mjs','build.mjs']:(p/name).write_text(read(old/name),encoding='utf-8')
s=read(p/'manifest.mjs').replace('category_id execution_scope source_review_id source_request_key confirmed_at active','category_id execution_scope source_review_id source_request_key confirmed_at active handoff')
s=s.replace("newRoot'.split(' ')","newRoot handoff required shippingCountries localExchange city countryCode'.split(' ')")
(p/'manifest.mjs').write_text(s,encoding='utf-8')
s=read(p/'build.mjs')
s=s.replace("'taxonomy_pending_saved_event_v1','taxonomy_signed_binding_requeue_v1'","'taxonomy_pending_saved_event_v1','taxonomy_signed_binding_requeue_v1','taxonomy_handoff_valid_v1','taxonomy_handoff_display_v1','taxonomy_handoff_compatible_v1','taxonomy_handoff_fit_v1','taxonomy_preserve_review_handoff_v1'")
dataset=json.dumps([{'key':'needRequirements','fields':['needId','criticalConditions','handoff'],'dataClass':'NEED_PUBLIC','ownershipFilter':'n.requester_account_id=REQUEST_ACCOUNT'}],separators=(',',':')).replace('"','\\"')
s=s.replace("'::jsonb || private.closure_taxonomy_export_catalog_v1() $function$", "'::jsonb || private.closure_taxonomy_export_catalog_v1() || '"+dataset+"'::jsonb $function$")
s=s.replace("union all select key,value from private.closure_taxonomy_export_rows_v1(p_account_id)),", "union all select key,value from private.closure_taxonomy_export_rows_v1(p_account_id) union all select \\'needRequirements\\',jsonb_build_object(\\'needId\\',t.need_id,\\'criticalConditions\\',t.critical_conditions,\\'handoff\\',t.handoff) from public.need_requirement_details t join public.needs n on n.id=t.need_id where n.requester_account_id=p_account_id),")
s=s.replace("jsonb_array_length(m->'datasets')<>72","jsonb_array_length(m->'datasets')<>73")
(p/'build.mjs').write_text(s,encoding='utf-8')

# Strong metadata preflight is independent of textual body transforms.
meta=json.loads(read(p/'function-metadata.readback.json'))
for item in meta:
 if '.' not in item['signature'].split('(')[0]: item['signature']='public.'+item['signature']
tablemeta=[{k:t[k] for k in ['name','owner','acl','rls','forceRls']} for t in cap['tables']]
q=lambda value:"'"+json.dumps(value,separators=(',',':')).replace("'","''")+"'::jsonb"
strict="""DO $meta$ DECLARE x jsonb; BEGIN
 FOR x IN SELECT value FROM jsonb_array_elements(__FUNCTION_JSON__) LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
 WHERE p.oid=to_regprocedure(x->>'signature') AND md5(pg_get_functiondef(p.oid))=x->>'definitionMd5'
 AND p.prosecdef=(x->>'definer')::boolean AND p.proisstrict=(x->>'strict')::boolean
 AND p.provolatile::text=x->>'volatility' AND l.lanname=x->>'language') THEN RAISE EXCEPTION 'F01_FUNCTION_METADATA_DRIFT:%',x->>'signature';END IF;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(__TABLE_JSON__) LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=to_regclass(x->>'name') AND c.relkind='r' AND NOT c.relispartition
 AND pg_get_userbyid(c.relowner)=x->>'owner' AND to_jsonb(c.relacl::text) IS NOT DISTINCT FROM x->'acl'
 AND c.relrowsecurity=(x->>'rls')::boolean AND c.relforcerowsecurity=(x->>'forceRls')::boolean) THEN RAISE EXCEPTION 'F01_TABLE_METADATA_DRIFT:%',x->>'name';END IF;
 END LOOP;
END $meta$;
""".replace('__FUNCTION_JSON__',q(meta)).replace('__TABLE_JSON__',q(tablemeta))
(p/'metadata-preflight.sql').write_text(strict,encoding='utf-8')
s=s.replace("'+preflight+'", "'+readFileSync(dir+'metadata-preflight.sql','utf8')+preflight+'").replace("BEGIN;\\nSET LOCAL search_path=pg_catalog;","BEGIN;\\nSET LOCAL lock_timeout=5000;\\nSET LOCAL statement_timeout=120000;\\nSET LOCAL search_path=pg_catalog;")
(p/'build.mjs').write_text(s,encoding='utf-8')
