-- This runs only after prepared rollback in the disposable PostgreSQL instance.
do $$
begin
 if (select md5(prosrc) from pg_proc where oid='public.rpc_begin_push_send(uuid,uuid)'::regprocedure)
   is distinct from '0de54bdd7ddcea92dfa697ade808155f'
 or to_regprocedure('public.rpc_resolve_activity_opportunity_v1(uuid,uuid)') is not null
 or to_regprocedure('private.admit_push_opportunity_single_target_v1(uuid,uuid,uuid,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz)') is not null
 then raise exception 'OPPORTUNITY_ROLLBACK_NOT_RESTORED';end if;
end $$;
select 'DISPOSABLE_OPPORTUNITY_ROLLBACK_PASS' as proof;
