-- DISCOVERY-GRAD read-only postflight. No write. Expected: every flag true, foldTruthTableMismatches 0, the certificate equal to the preflight.
select jsonb_build_object(
 'readerAfter',(select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)'))='018d25cd87d096ddb696d9af45265ba7',
 'readerAcl',(select proacl::text from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)')),
 'helper',(select md5(p.prosrc)='41353abe05d434d513495ae5974b9802' and p.provolatile='i' and not p.prosecdef and p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}'
   and p.proconfig=array['search_path=pg_catalog'] from pg_proc p where p.oid=to_regprocedure('public.discovery_fold_v1(text)')),
 'foldTruthTableMismatches',(select count(*) from (values
  ((chr(268)||'a'||chr(269)||'ak'),'cacak'),
  ((chr(268)||'A'||chr(268)||'AK'),'cacak'),
  ((chr(272)||'or'||chr(273)||'e'),'djordje'),
  (('Djordje'),'djordje'),
  ((chr(1026)||chr(1086)||chr(1088)||chr(1106)||chr(1077)),'djordje'),
  ((chr(269)||'istim'),'cistim'),
  (('Novi Sad'),'novi sad'),
  ((chr(1053)||chr(1086)||chr(1074)||chr(1080)||' '||chr(1057)||chr(1072)||chr(1076)),'novi sad'),
  ((chr(352)||'abac'),'sabac'),
  ((chr(381)||'abalj'),'zabalj'),
  ((chr(262)||'uprija'),'cuprija'),
  ((chr(1035)||chr(1091)||chr(1087)||chr(1088)||chr(1080)||chr(1112)||chr(1072)),'cuprija'),
  ((chr(1033)||chr(1091)||chr(1073)||chr(1086)||chr(1074)||chr(1080)||chr(1112)||chr(1072)),'ljubovija'),
  ((chr(1034)||chr(1077)||chr(1075)||chr(1086)||chr(1096)),'njegos'),
  ((chr(1039)||chr(1077)||chr(1087)),'dzep'),
  (('D'||chr(382)||'ep'),'dzep'),
  (('  X  '),'  x  '),
  (('ABC-123'),'abc-123'),
  ((chr(1072)||chr(1073)||chr(1074)||chr(1075)||chr(1076)||chr(1106)||chr(1077)||chr(1078)||chr(1079)||chr(1080)||chr(1112)||chr(1082)||chr(1083)||chr(1113)||chr(1084)||chr(1085)||chr(1114)||chr(1086)||chr(1087)||chr(1088)||chr(1089)||chr(1090)||chr(1115)||chr(1091)||chr(1092)||chr(1093)||chr(1094)||chr(1095)||chr(1119)||chr(1096)),'abvgddjezzijklljmnnjoprstcufhccdzs'),
  ((chr(1040)||chr(1041)||chr(1042)||chr(1043)||chr(1044)||chr(1026)||chr(1045)||chr(1046)||chr(1047)||chr(1048)||chr(1032)||chr(1050)||chr(1051)||chr(1033)||chr(1052)||chr(1053)||chr(1034)||chr(1054)||chr(1055)||chr(1056)||chr(1057)||chr(1058)||chr(1035)||chr(1059)||chr(1060)||chr(1061)||chr(1062)||chr(1063)||chr(1039)||chr(1064)),'abvgddjezzijklljmnnjoprstcufhccdzs'),
  (('abc'||chr(269)||chr(263)||'dd'||chr(382)||chr(273)||'efghijklljmnnjoprs'||chr(353)||'tuvz'||chr(382)),'abcccddzdjefghijklljmnnjoprsstuvzz'),
  (''::text,''),
  (null::text,null::text),
  (('Ni'||chr(353)),'nis'),
  (('In'||chr(273)||'ija'),'indjija'),
  ((chr(353)||chr(353)||chr(353)),'sss')) t(input,expected)
  where public.discovery_fold_v1(t.input) is distinct from t.expected),
 'dependencies',(select bool_and(md5(p.prosrc) is not distinct from x.body_md5) from (values
  ('public.p6_discovery_key(text)','ebfe1252f1798d89bbffb35b6eef6167'),
  ('public.p6_discovery_trim(text)','40109e93b620146aa8d536907d28c91b'),
  ('public.p6_discovery_unquote(text)','35706ddc2125e8cacf74ee370f82ff2f'),
  ('public.p6_discovery_area(text,text,boolean)','041441c14c18230a8da05a97c53ab350'),
  ('public.discovery_for_me_state_v1()','bd4dcf16863e7564a5d82ac22aca1418'),
  ('public.discovery_for_me_v1(uuid)','60c104139cebbccfa16a570fc3386c0c')) x(signature,body_md5) left join pg_proc p on p.oid=to_regprocedure(x.signature)),
 'retriedLiteralFunctions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc like '%40001%'),
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready(),
 'closureDigest',private.closure_source_digest_v5(),
 'erasureProgramDigest',private.closure_erasure_program_digest_v5()
) as discovery_grad_postflight;
