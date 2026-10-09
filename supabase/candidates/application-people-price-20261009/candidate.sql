begin;
-- Application proportional TOTAL price. Existing helper only; no stored business data changes.
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
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)')) is distinct from '66aab6df0d625e24e0073c27bfe2aa91' then raise exception 'PEOPLE_PRICE_CALLER_DRIFT: public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)'; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)')) is distinct from '6a8fd871a60779bc438119b21a900dca' then raise exception 'PEOPLE_PRICE_CALLER_DRIFT: public.rpc_select_response(uuid,integer,uuid,integer,text,text)'; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)')) is distinct from '9634b0333c3bd5dab208286f04d8e556' then raise exception 'PEOPLE_PRICE_CALLER_DRIFT: public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)'; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.need_candidate_states_v5(uuid)')) is distinct from '112ed258e838b2cae22b248ac94ebe7c' then raise exception 'PEOPLE_PRICE_CALLER_DRIFT: private.need_candidate_states_v5(uuid)'; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.need_candidate_states_v5(uuid,uuid[])')) is distinct from '20092ecb2a781776ddb0ce9c46ba8aa5' then raise exception 'PEOPLE_PRICE_CALLER_DRIFT: private.need_candidate_states_v5(uuid,uuid[])'; end if;
end $pre$;
create temporary table people_price_before on commit drop as
 select private.closure_source_digest_v5() as source, private.closure_erasure_program_digest_v5() as program,
 private.closure_erasure_binding_v5() as binding,
 (select to_jsonb(c) from private.closure_source_v5 c where singleton) as source_cert,
 (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) as erasure_cert;
do $replace$
declare o oid; original text; definition text; meta jsonb; note text; replacement text := $body$
begin
  if p_price_rsd is null or p_price_rsd <= 0 then
    raise exception using errcode='22023', message='INVALID_PRICE';
  end if;

  if n.mode = 'MY_PRICE' then
    if n.requester_price_rsd is null or n.requester_price_rsd <= 0 then
      raise exception using errcode='P0001', message='FIXED_PRICE_NOT_READY';
    end if;
    -- pkg025b. A null basis is the rule this product has always had: the application's price is
    -- the task's price, whatever it covers. A basis says what that price is FOR.
    if n.price_basis is null then
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH';
      end if;
    elsif n.price_basis = 'PER_PERSON' then
      if p_price_rsd <> n.requester_price_rsd::bigint * p_covered_slots then
        raise exception using
          errcode='22023',
          message='FIXED_PRICE_MISMATCH',
          detail=format('basis=PER_PERSON,perPerson=%s,covered=%s,expected=%s,sent=%s',
                        n.requester_price_rsd, p_covered_slots,
                        n.requester_price_rsd::bigint * p_covered_slots, p_price_rsd);
      end if;
    elsif n.price_basis = 'TOTAL' then
      -- Owner 2026-10-09: the task total is shared in proportion to this application's headcount.
      -- Use original required_slots, never remaining slots; preserve existing accepted terms.
      if p_price_rsd::numeric is distinct from
         round(n.requester_price_rsd::numeric * p_covered_slots / n.required_slots) then
        raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH',
          detail=format('basis=TOTAL,total=%s,required=%s,covered=%s,sent=%s',
            n.requester_price_rsd,n.required_slots,p_covered_slots,p_price_rsd);
      end if;
    else
      -- Unreachable while the CHECK holds. A basis nobody has reviewed is refused, never guessed.
      raise exception using errcode='22023', message='UNKNOWN_PRICE_BASIS';
    end if;
  end if;

end;
$body$;
begin
 o:=to_regprocedure('private.assert_application_price_v5(public.needs,integer,integer)');
 select prosrc,to_jsonb(p)-'prosrc',obj_description(p.oid,'pg_proc') into strict original,meta,note from pg_proc p where p.oid=o;
 if md5(original) is distinct from 'bd7ef02925c03d99ff7fd549219214cb' then raise exception 'PEOPLE_PRICE_PREIMAGE_DRIFT';end if;
 if md5(replacement) is distinct from '1f6cd7c39d5fc70d82cfa8653737246c' then raise exception 'PEOPLE_PRICE_PAYLOAD_DRIFT';end if;
 definition:=pg_get_functiondef(o);
 if (length(definition)-length(replace(definition,original,'')))<>length(original) then raise exception 'PEOPLE_PRICE_AMBIGUOUS_BODY';end if;
 execute replace(definition,original,replacement);
 if (select md5(prosrc) from pg_proc where oid=o) is distinct from '1f6cd7c39d5fc70d82cfa8653737246c'
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
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)')) is distinct from '66aab6df0d625e24e0073c27bfe2aa91' then raise exception 'PEOPLE_PRICE_CALLER_DRIFT: public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)'; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)')) is distinct from '6a8fd871a60779bc438119b21a900dca' then raise exception 'PEOPLE_PRICE_CALLER_DRIFT: public.rpc_select_response(uuid,integer,uuid,integer,text,text)'; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)')) is distinct from '9634b0333c3bd5dab208286f04d8e556' then raise exception 'PEOPLE_PRICE_CALLER_DRIFT: public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)'; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.need_candidate_states_v5(uuid)')) is distinct from '112ed258e838b2cae22b248ac94ebe7c' then raise exception 'PEOPLE_PRICE_CALLER_DRIFT: private.need_candidate_states_v5(uuid)'; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.need_candidate_states_v5(uuid,uuid[])')) is distinct from '20092ecb2a781776ddb0ce9c46ba8aa5' then raise exception 'PEOPLE_PRICE_CALLER_DRIFT: private.need_candidate_states_v5(uuid,uuid[])'; end if;
end $post$;
commit;
