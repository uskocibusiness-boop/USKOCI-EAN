-- INBOX-NASLOV read-only postflight. No write. Expected: readerAfter, dependencies, columns, erasureMarkers and certificateReady
-- true, retriedLiteralFunctions 0, the certificate equal to the preflight.
select jsonb_build_object(
 'readerAfter',(select count(*) from pg_proc p where p.oid=to_regprocedure('public.rpc_list_inbox(text,integer,timestamp with time zone,uuid)') and md5(p.prosrc)='f1daee8c0f4f77c24398707644e1d731'
     and md5(pg_get_functiondef(p.oid))='ac85e8179b7e1f46e5b4adb2ed0f17b9' and p.prosecdef and p.provolatile='s'
     and p.proowner='postgres'::regrole and p.prolang=(select oid from pg_language where lanname='plpgsql') and p.prorettype='jsonb'::regtype
     and p.proconfig=array['search_path=pg_catalog'] and p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}' and obj_description(p.oid,'pg_proc') is null)=1,
 'readerAcl',(select proacl::text from pg_proc where oid=to_regprocedure('public.rpc_list_inbox(text,integer,timestamp with time zone,uuid)')),
 'dependencies',(select bool_and(md5(p.prosrc) is not distinct from x.body_md5) from (values
  ('private.category_of_event(text)','85389285506a1f5801ad204f60dfa2a1')) x(signature,body_md5) left join pg_proc p on p.oid=to_regprocedure(x.signature)),
 'columns',(select bool_and(exists(select 1 from pg_attribute a where a.attrelid=to_regclass(x.relation) and a.attname=x.column_name
   and not a.attisdropped and a.attnum>0 and format_type(a.atttypid,a.atttypmod)=x.type_name and a.attnotnull=x.not_null)) from (values
  ('public.user_activity_events','entity_type','text',true),
  ('public.user_activity_events','entity_id','uuid',true),
  ('public.user_activity_events','event_type','text',true),
  ('public.user_activity_events','recipient_user_id','uuid',true),
  ('public.needs','id','uuid',true),
  ('public.needs','title','text',true),
  ('public.needs','category','text',true),
  ('public.needs','requester_account_id','uuid',true),
  ('public.marketplace_responses','id','uuid',true),
  ('public.marketplace_responses','need_id','uuid',true),
  ('public.marketplace_responses','worker_account_id','uuid',true),
  ('public.agreements','id','uuid',true),
  ('public.agreements','need_id','uuid',true),
  ('public.agreements','requester_account_id','uuid',true),
  ('public.agreements','worker_account_id','uuid',true)) x(relation,column_name,type_name,not_null)),
 'erasureMarkers',(select count(*)=1 from pg_proc p where p.oid=to_regprocedure('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)') and strpos(p.prosrc,'elsif r=''public.needs'' then p:=jsonb_build_object(''title'',''Obrisan zadatak'',')>0 and strpos(p.prosrc,',''category'',''OBRISANO'',')>0),
 'retriedLiteralFunctions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc like '%40001%'),
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready(),
 'closureDigest',private.closure_source_digest_v5(),
 'erasureProgramDigest',private.closure_erasure_program_digest_v5()
) as inbox_naslov_postflight;
