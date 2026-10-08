-- RETIRE-V1 CANDIDATE: SOURCE ONLY. NOT PROVEN. NOT APPLIED. Canonical DEV leqcwgzvjsxugfgzdmth only after the disposable
-- proof is green and revert.sql was generated from DEV (README). Drops four superseded rpc_* functions nothing calls:
-- rpc_ai_open_conversation(text), rpc_confirm_need_edit(uuid,integer,text,jsonb), rpc_get_my_safety_report(uuid),
-- rpc_list_my_agreements(). No table, column, trigger, policy or grant on another object changes; the closure certificate is
-- asserted unchanged. Every refusal is errcode 55000; no 40001 (B24). Pins read on 2026-10-08 (md5 of prosrc).
set local lock_timeout='5s';
set local statement_timeout='60s';
set local search_path=pg_catalog;
create temporary table rv1_certificate on commit drop as
 select private.closure_source_digest_v5() as digest, private.closure_erasure_program_digest_v5() as program;
do $rv1_pre$
declare r record; n int;
begin
 if private.closure_source_digest_v5() is null or private.closure_erasure_program_digest_v5() is null
  or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
  or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
  or private.retention_ai_source_ready() is distinct from true
 then raise exception 'RETIRE_V1_CERTIFICATE_NOT_READY' using errcode='55000'; end if;
 for r in select * from (values
  ('rpc_ai_open_conversation','public.rpc_ai_open_conversation(text)','36b32569'),
  ('rpc_confirm_need_edit','public.rpc_confirm_need_edit(uuid,integer,text,jsonb)','450b6f8d'),
  ('rpc_get_my_safety_report','public.rpc_get_my_safety_report(uuid)','bc347bd8'),
  ('rpc_list_my_agreements','public.rpc_list_my_agreements()','f4c56eca')) pins(name, signature, body_md5) loop
  if to_regprocedure(r.signature) is null then raise exception 'RETIRE_V1_MISSING: %', r.signature using errcode='55000'; end if;
  if (select left(md5(p.prosrc),8) from pg_proc p where p.oid=to_regprocedure(r.signature)) is distinct from r.body_md5
  then raise exception 'RETIRE_V1_BODY_DRIFT: %', r.signature using errcode='55000'; end if;
  -- One overload only: a second function of the same name would survive the drop and hide behind the name.
  if (select count(*) from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname=r.name)<>1
  then raise exception 'RETIRE_V1_OVERLOADS: %', r.name using errcode='55000'; end if;
  select count(*) into n from pg_proc q join pg_namespace qn on qn.oid=q.pronamespace
   where qn.nspname in ('public','private') and q.oid<>to_regprocedure(r.signature) and q.prosrc ~ ('\m'||r.name||'\M');
  if n<>0 then raise exception 'RETIRE_V1_STILL_REFERENCED: % by % function(s)', r.name, n using errcode='55000'; end if;
  if exists(select 1 from pg_trigger t where t.tgfoid=to_regprocedure(r.signature))
  then raise exception 'RETIRE_V1_TRIGGER: %', r.name using errcode='55000'; end if;
  if exists(select 1 from cron.job j where j.command ~ r.name)
  then raise exception 'RETIRE_V1_CRON: %', r.name using errcode='55000'; end if;
  if exists(select 1 from pg_proc q join pg_namespace qn on qn.oid=q.pronamespace where qn.nspname='private' and q.proname like 'closure_%digest%' and q.prosrc ~ r.name)
  then raise exception 'RETIRE_V1_IN_CERTIFICATE: %', r.name using errcode='55000'; end if;
 end loop;
end
$rv1_pre$;
drop function public.rpc_ai_open_conversation(text);
drop function public.rpc_confirm_need_edit(uuid,integer,text,jsonb);
drop function public.rpc_get_my_safety_report(uuid);
drop function public.rpc_list_my_agreements();
do $rv1_post$
begin
 if to_regprocedure('public.rpc_ai_open_conversation(text)') is not null or to_regprocedure('public.rpc_confirm_need_edit(uuid,integer,text,jsonb)') is not null
  or to_regprocedure('public.rpc_get_my_safety_report(uuid)') is not null or to_regprocedure('public.rpc_list_my_agreements()') is not null
 then raise exception 'RETIRE_V1_NOT_DROPPED' using errcode='55000'; end if;
 if private.closure_source_digest_v5() is distinct from (select digest from rv1_certificate)
  or private.closure_erasure_program_digest_v5() is distinct from (select program from rv1_certificate)
 then raise exception 'RETIRE_V1_CERTIFICATE_MOVED' using errcode='55000'; end if;
 if private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
  or private.retention_ai_source_ready() is distinct from true
 then raise exception 'RETIRE_V1_CERTIFICATE_NOT_READY_AFTER' using errcode='55000'; end if;
 if (select count(*) from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname like 'rpc\_%')<>254
 then raise exception 'RETIRE_V1_RPC_COUNT_UNEXPECTED' using errcode='55000'; end if;
end
$rv1_post$;
