-- CANCEL-INFO read-only postflight. No write. Expected: newFunctions true, the certificate equal to the preflight value, and the helper
-- answering every cancelled Dogovor (sideKnown = cancelledAgreements on DEV, where every cancellation still has its event).
select jsonb_build_object(
 'newFunctions',(select bool_and(md5(p.prosrc) is not distinct from x.body_md5 and p.proacl::text is not distinct from x.acl and p.prosecdef
    and p.provolatile='s' and p.proconfig=array['search_path=pg_catalog']) from (values
   ('private.agreement_cancellation_facts_v1(uuid)','65eec38f58d81667f14a046f3596a243','{postgres=X/postgres}'),
   ('public.rpc_agreement_cancellation_v1(uuid[])','f54af14827bdd1c0906f512ee8aa9043','{postgres=X/postgres,authenticated=X/postgres}')) x(signature,body_md5,acl) left join pg_proc p on p.oid=to_regprocedure(x.signature)),
 'anonCannotExecute',not has_function_privilege('anon','public.rpc_agreement_cancellation_v1(uuid[])','EXECUTE'),
 'authenticatedCanExecute',has_function_privilege('authenticated','public.rpc_agreement_cancellation_v1(uuid[])','EXECUTE'),
 'dependencyDrift',(select coalesce(jsonb_agg(x.signature order by x.signature),'[]'::jsonb) from (values
   ('public.rpc_cancel_agreement(uuid,text)','e59b8f7d3e14ebbf6f9ddd8dd63b0af7'),
   ('private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamp with time zone)','67413effbbb3fa227397d355e0d4edfb'),
   ('private.set_updated_at()','d2ba7342ae061b491b5ec4bb74fb81c4')) x(signature,body_md5) left join pg_proc p on p.oid=to_regprocedure(x.signature) where md5(p.prosrc) is distinct from x.body_md5),
 'cancelledAgreements',(select count(*) from public.agreements where status='CANCELLED'),
 'withCancellationEvent',(select count(*) from public.agreements a where a.status='CANCELLED' and exists(select 1 from public.user_activity_events e
   where e.dedupe_key='agreement-cancelled:'||a.id::text and e.event_type='AGREEMENT_CANCELLED')),
 'eventAtEqualsUpdatedAt',(select count(*) from public.agreements a join public.user_activity_events e on e.dedupe_key='agreement-cancelled:'||a.id::text
   where a.status='CANCELLED' and e.created_at=a.updated_at),
 'reasonMessageAtCancelInstant',(select count(*) from public.agreements a where a.status='CANCELLED' and exists(select 1 from public.agreement_messages m
   where m.agreement_id=a.id and m.created_at=a.updated_at and left(m.body,27)='Otkazujem Dogovor. Razlog: ')),
 'helperAnswers',(select count(*) from public.agreements a where a.status='CANCELLED' and private.agreement_cancellation_facts_v1(a.id) is not null),
 'sideKnown',(select count(*) from public.agreements a where a.status='CANCELLED' and private.agreement_cancellation_facts_v1(a.id)->>'cancelledBy' is not null),
 'reasonKept',(select count(*) from public.agreements a where a.status='CANCELLED' and private.agreement_cancellation_facts_v1(a.id)->>'reasonState'='KEPT'),
 'closureDigest',private.closure_source_digest_v5(),
 'erasureProgramDigest',private.closure_erasure_program_digest_v5(),
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready()
) as cancel_info_postflight;
