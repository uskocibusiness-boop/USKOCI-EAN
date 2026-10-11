-- USKOČI — CURRENT DEV deploy inventory; READ ONLY.
-- No writes, tokens, secret values, triggers, cron or push sends.
-- Run only against the explicitly identified expected project; the caller
-- must independently verify the project_ref before opening SQL editor.
-- This is a source-body snapshot, NOT proof of actual app/HTTP/FCM behavior.
WITH expected(label,signature,expected_md5) AS (
  VALUES
   ('PRIMARY_MATCHER','private.worker_need_fit_v1(uuid,uuid,boolean)','d511b48f7f3b38f52aaffee420108f8a'),
   ('WORKER_TIME','private.worker_need_time_tier_v1(uuid,uuid)','34c977e537ce731587a37a0bc1562296'),
   ('NEED_SEARCH_DEADLINE','private.need_search_time_admitted_v1(uuid,timestamptz)','0fd72e91c11eeac2c2501f3a8f753734'),
   ('PUSH_IDLE_TICK','private.edge_worker_tick_v5(timestamptz)','7d03dc2c31a629785b5f222786bf4dd9'),
   ('PUSH_BEGIN_SEND','public.rpc_begin_push_send(uuid,uuid)','380a2f203da2a7ad344bd80f061abd13'),
   ('PUSH_TARGET_RESOLVER','public.rpc_resolve_activity_opportunity_v1(uuid,uuid)','ac72682ce0b16066e726b374586923ca'),
   ('PUSH_TARGET_ADMISSION','private.admit_push_opportunity_single_target_v1(uuid,uuid,uuid,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz)','fca73a3a992b6dd3e9830d8baf0ff866'),
   ('NEED_REVIEW_SAVE','public.rpc_save_need_draft_from_review(uuid,uuid,text)','559c9d81ee97caec2ccd9ec19b3e95ca'),
   ('NEED_REVIEW_EDIT','public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)','8a94e2b748485f0850e477369c3de3d2'),
   ('SUBMIT_RESPONSE','public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)','b058ee01fc16a6f3018969ac911afbe4'),
   ('SELECT_RESPONSE','public.rpc_select_response(uuid,integer,uuid,integer,text,text)','faab1bde1460e904e9a083d2a8382b18'),
   ('REVALIDATE_RESPONSE','public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)','5d8e51d8dbb8d92528d794bd83233dd3'),
   ('CANDIDATE_STATE','private.need_candidate_states_v5(uuid)','3f24c4533d63cefdb6f8421443faf150'),
   ('CANDIDATE_STATE_BATCH','private.need_candidate_states_v5(uuid,uuid[])','28e1422d1a74b24911242fd4577e4450')
), functions AS (
 SELECT e.label,e.signature,e.expected_md5,md5(p.prosrc) AS live_md5,
        CASE WHEN p.oid IS NULL THEN 'MISSING'
             WHEN md5(p.prosrc)=e.expected_md5 THEN 'MATCHES_SOURCE'
             ELSE 'SOURCE_DRIFT' END AS verdict
 FROM expected e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
)
SELECT jsonb_pretty(jsonb_build_object(
 'scope','READ_ONLY_CURRENT_CONNECTION',
 'expected_dev_ref','leqcwgzvjsxugfgzdmth',
 'note','SQL cannot attest which project is connected. Check Supabase UI project ref and Edge source separately.',
 'migration_head',(SELECT max(version) FROM supabase_migrations.schema_migrations),
 'migration_count',(SELECT count(*) FROM supabase_migrations.schema_migrations),
 'active_kind_count',(SELECT jsonb_array_length(value->'kinds') FROM private.marketplace_config WHERE key='work_kinds_head'),
 'taxonomy_table_count',(SELECT count(*) FROM pg_tables WHERE schemaname='private' AND tablename LIKE 'work_taxonomy%'),
 'taxonomy_function_count',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname LIKE 'taxonomy_%'),
 'rpc_source_counts',(SELECT jsonb_build_object('matched',count(*) FILTER(WHERE verdict='MATCHES_SOURCE'),'drift',count(*) FILTER(WHERE verdict='SOURCE_DRIFT'),'missing',count(*) FILTER(WHERE verdict='MISSING')) FROM functions),
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',label,'status',verdict,'expected',expected_md5,'live',live_md5) ORDER BY label) FROM functions)
)) AS inventory;
