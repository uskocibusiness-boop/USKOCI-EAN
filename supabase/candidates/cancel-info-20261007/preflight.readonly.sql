-- CANCEL-INFO read-only preflight for canonical DEV leqcwgzvjsxugfgzdmth. No write. Expected: every flag true, the lists empty or exactly as named.
select jsonb_build_object(
 'ledger',(select count(*) from supabase_migrations.schema_migrations),
 'latestVersion',(select max(version) from supabase_migrations.schema_migrations),
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready(),
 'closureDigest',private.closure_source_digest_v5(),
 'erasureProgramDigest',private.closure_erasure_program_digest_v5(),
 'closureNotExecuting',not exists(select 1 from private.closure_executions_v5 where state='EXECUTING'),
 'dependencyDrift',(select coalesce(jsonb_agg(x.signature order by x.signature),'[]'::jsonb) from (values
   ('public.rpc_cancel_agreement(uuid,text)','e59b8f7d3e14ebbf6f9ddd8dd63b0af7'),
   ('private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamp with time zone)','67413effbbb3fa227397d355e0d4edfb'),
   ('private.set_updated_at()','d2ba7342ae061b491b5ec4bb74fb81c4')) x(signature,body_md5) left join pg_proc p on p.oid=to_regprocedure(x.signature) where md5(p.prosrc) is distinct from x.body_md5),
 'newFunctionsAbsent', to_regprocedure('private.agreement_cancellation_facts_v1(uuid)') is null and to_regprocedure('public.rpc_agreement_cancellation_v1(uuid[])') is null
  and not exists(select 1 from pg_proc p where p.pronamespace in ('public'::regnamespace,'private'::regnamespace)
                 and p.proname in ('agreement_cancellation_facts_v1','rpc_agreement_cancellation_v1')),
 'cancelWriters',(select coalesce(jsonb_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text),'[]'::jsonb)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
     and p.prosrc ~* 'update[[:space:]]+(public[.])?agreements[[:space:]]+(as[[:space:]]+)?[a-z_]*[[:space:]]*set[[:space:]]+[^;]*status[[:space:]]*=[[:space:]]*''CANCELLED'''),
 'cancelWriterIsOnlyThePinnedWriter',(select coalesce(array_agg(p.oid order by p.oid),'{}') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
     and p.prosrc ~* 'update[[:space:]]+(public[.])?agreements[[:space:]]+(as[[:space:]]+)?[a-z_]*[[:space:]]*set[[:space:]]+[^;]*status[[:space:]]*=[[:space:]]*''CANCELLED''')=array[to_regprocedure('public.rpc_cancel_agreement(uuid,text)')::oid],
 'cancelledAgreements',(select count(*) from public.agreements where status='CANCELLED'),
 'withCancellationEvent',(select count(*) from public.agreements a where a.status='CANCELLED' and exists(select 1 from public.user_activity_events e
   where e.dedupe_key='agreement-cancelled:'||a.id::text and e.event_type='AGREEMENT_CANCELLED')),
 'eventAtEqualsUpdatedAt',(select count(*) from public.agreements a join public.user_activity_events e on e.dedupe_key='agreement-cancelled:'||a.id::text
   where a.status='CANCELLED' and e.created_at=a.updated_at),
 'reasonMessageAtCancelInstant',(select count(*) from public.agreements a where a.status='CANCELLED' and exists(select 1 from public.agreement_messages m
   where m.agreement_id=a.id and m.created_at=a.updated_at and left(m.body,27)='Otkazujem Dogovor. Razlog: ')),
 'agreementWorkerProfileOfAnotherAccount',(select count(*) from public.agreements a join public.app_profiles p on p.id=a.worker_profile_id where p.account_id<>a.worker_account_id)
) as cancel_info_preflight;
