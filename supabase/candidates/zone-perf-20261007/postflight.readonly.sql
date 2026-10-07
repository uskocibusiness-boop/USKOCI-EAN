-- ZONE-PERF read-only postflight. No write. Expected: every flag true, truthTableMismatches empty, and the certificate equal to the preflight value.
with probes as (select t.v, t.i from unnest(array[null,'','UTC','Europe/Belgrade','Europe/Paris','America/New_York','EST5EDT','posix/Europe/Belgrade','right/UTC','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','Not/AZone','europe/belgrade',' Europe/Belgrade','Europe/Belgrade ','UTC ','utc','Etc/GMT+1','Etc/UTC','Asia/Kolkata','Europe/Zagreb','Europe/Sarajevo','GMT','Zulu','Etc/Zulu','Europe/','/','Europe/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']::text[]) with ordinality t(v,i))
select jsonb_build_object(
 'helperIsPostimage',(select md5(p.prosrc) from pg_proc p where p.oid=to_regprocedure('private.availability_timezone_valid(text)'))='be95520dabe35febd8e9fa15f0ce0309',
 'helperMetadata',(select jsonb_build_object('language',l.lanname,'volatility',p.provolatile,'securityDefiner',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text)
   from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure('private.availability_timezone_valid(text)')),
 'catalogHasFastPathNames',(select count(*) from pg_catalog.pg_timezone_names where name in ('Europe/Belgrade','UTC'))=2,
 'probes',(select count(*) from probes),
 'truthTableMismatches',(select coalesce(jsonb_agg(jsonb_build_object('value',v,'old',old_answer,'new',new_answer) order by i),'[]'::jsonb) from (
   select v,i,(v is not null and length(v)<=100 and (v='UTC' or position('/' in v)>0) and v not like 'posix/%' and v not like 'right/%'
     and exists(select 1 from pg_catalog.pg_timezone_names z where z.name=v)) as old_answer, private.availability_timezone_valid(v) as new_answer from probes) x
   where old_answer is distinct from new_answer),
 'closureDigest',private.closure_source_digest_v5(),
 'erasureProgramDigest',private.closure_erasure_program_digest_v5(),
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready()
) as zone_perf_postflight;
