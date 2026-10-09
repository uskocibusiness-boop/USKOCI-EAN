from pathlib import Path
import json,hashlib,re
ROOT=Path(__file__).parent
REPO=Path('C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN-spoj-20261006')
OUT=REPO/'supabase/candidates/application-people-price-20261009';OUT.mkdir(exist_ok=True)
row=json.loads((ROOT/'people-helper-preimage.json').read_text(encoding='utf-8'))
definition=row['definition']; old=definition.split('AS $function$',1)[1].split('$function$',1)[0]
assert hashlib.md5(old.encode()).hexdigest()==row['md5']=='bd7ef02925c03d99ff7fd549219214cb'
start=old.index("    elsif n.price_basis = 'TOTAL' then");end=old.index('    else',start)
# Owner explicitly approved nearest whole-dinar rounding for each application on 2026-10-09.
new=old[:start]+"""    elsif n.price_basis = 'TOTAL' then
      -- Owner 2026-10-09: the task total is shared in proportion to this application's headcount.
      -- Use original required_slots, never remaining slots; preserve existing accepted terms.
      if p_price_rsd::numeric is distinct from
         round(n.requester_price_rsd::numeric * p_covered_slots / n.required_slots) then
        raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH',
          detail=format('basis=TOTAL,total=%s,required=%s,covered=%s,sent=%s',
            n.requester_price_rsd,n.required_slots,p_covered_slots,p_price_rsd);
      end if;
"""+old[end:]
post=hashlib.md5(new.encode()).hexdigest()
sig='private.assert_application_price_v5(public.needs,integer,integer)'
pins={'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)':'66aab6df0d625e24e0073c27bfe2aa91','public.rpc_select_response(uuid,integer,uuid,integer,text,text)':'6a8fd871a60779bc438119b21a900dca','public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)':'9634b0333c3bd5dab208286f04d8e556','private.need_candidate_states_v5(uuid)':'112ed258e838b2cae22b248ac94ebe7c','private.need_candidate_states_v5(uuid,uuid[])':'20092ecb2a781776ddb0ce9c46ba8aa5'}
checks='\n'.join("if (select md5(prosrc) from pg_proc where oid=to_regprocedure('"+s+"')) is distinct from '"+h+"' then raise exception 'PEOPLE_PRICE_CALLER_DRIFT: "+s+"'; end if;" for s,h in pins.items())
def make(before,after,body):
 return f"""-- Application proportional TOTAL price. Existing helper only; no stored business data changes.
set local lock_timeout='5s';
set local statement_timeout='120s';
set local search_path=pg_catalog;
do $pre$ begin
 if private.retention_ai_source_ready() is distinct from true
  or private.closure_source_digest_v5() is null or private.closure_erasure_program_digest_v5() is null
  or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
  or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
  or private.closure_erasure_binding_v5() is null
  or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from private.closure_source_digest_v5()
 then raise exception 'PEOPLE_PRICE_CERTIFICATE_NOT_READY';end if;
 {checks}
end $pre$;
create temporary table people_price_before on commit drop as
 select private.closure_source_digest_v5() as source, private.closure_erasure_program_digest_v5() as program,
 private.closure_erasure_binding_v5() as binding,
 (select to_jsonb(c) from private.closure_source_v5 c where singleton) as source_cert,
 (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) as erasure_cert;
do $replace$
declare o oid; original text; definition text; meta jsonb; note text; replacement text := $body${body}$body$;
begin
 o:=to_regprocedure('{sig}');
 select prosrc,to_jsonb(p)-'prosrc',obj_description(p.oid,'pg_proc') into strict original,meta,note from pg_proc p where p.oid=o;
 if md5(original) is distinct from '{before}' then raise exception 'PEOPLE_PRICE_PREIMAGE_DRIFT';end if;
 if md5(replacement) is distinct from '{after}' then raise exception 'PEOPLE_PRICE_PAYLOAD_DRIFT';end if;
 definition:=pg_get_functiondef(o);
 if (length(definition)-length(replace(definition,original,'')))<>length(original) then raise exception 'PEOPLE_PRICE_AMBIGUOUS_BODY';end if;
 execute replace(definition,original,replacement);
 if (select md5(prosrc) from pg_proc where oid=o) is distinct from '{after}'
   or (select to_jsonb(p)-'prosrc' from pg_proc p where oid=o) is distinct from meta
   or obj_description(o,'pg_proc') is distinct from note then raise exception 'PEOPLE_PRICE_METADATA_DRIFT';end if;
end $replace$;
do $post$ begin
 if private.retention_ai_source_ready() is distinct from true
  or exists(select 1 from people_price_before b where b.source is distinct from private.closure_source_digest_v5()
    or b.program is distinct from private.closure_erasure_program_digest_v5()
    or b.binding is distinct from private.closure_erasure_binding_v5()
    or b.source_cert is distinct from (select to_jsonb(c) from private.closure_source_v5 c where singleton)
    or b.erasure_cert is distinct from (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton)) then raise exception 'PEOPLE_PRICE_CERTIFICATE_CHANGED';end if;
 {checks}
end $post$;
"""
candidate=make(row['md5'],post,new);revert=make(post,row['md5'],old)
revert=revert.replace('set local search_path=pg_catalog;',"set local search_path=pg_catalog;\nlock table public.needs in access exclusive mode;\nlock table public.marketplace_responses,public.marketplace_response_versions in share row exclusive mode;\ndo $admission$ begin if exists(select 1 from public.marketplace_response_versions v join public.marketplace_responses r on r.id=v.response_id join public.needs n on n.id=r.need_id where n.mode='MY_PRICE' and n.price_basis='TOTAL' and v.covered_slots<n.required_slots) then raise exception 'PEOPLE_PRICE_PARTIAL_ADMISSION_PREVENTS_REVERT';end if;end $admission$;")
(OUT/'candidate.in-transaction.sql').write_text(candidate,encoding='utf-8',newline='\n')
(OUT/'candidate.sql').write_text('begin;\n'+candidate+'commit;\n',encoding='utf-8',newline='\n')
(OUT/'revert-before-admission.sql').write_text('-- Use only before any new partial TOTAL application can have been admitted. Not a live rollback after use.\nbegin;\n'+revert+'commit;\n',encoding='utf-8',newline='\n')
(OUT/'manifest.json').write_text(json.dumps({'mode':'PROPORTIONAL_TOTAL_NEAREST_DINAR_OWNER_APPROVED','signature':sig,'beforeBodyMd5':row['md5'],'afterBodyMd5':post,'candidateSha256':hashlib.sha256(candidate.encode()).hexdigest(),'callerMd5':pins,'applied':False},indent=2)+'\n',encoding='utf-8')
print('candidate prepared',post)
