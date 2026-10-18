SELECT proof.require((SELECT md5(prosrc)='5556d638e3befbe9739344b57d94d46a' AND proacl::text='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
 AND prosecdef AND pg_get_userbyid(proowner)='postgres'
 FROM pg_proc WHERE oid='public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure),'EXACT_SOURCE_AND_ACL_public.rpc_select_response(uuid,integer,uuid,integer,text,text)');
SELECT proof.require((SELECT md5(prosrc)='f92a988e0fa8f01dde6318867e5df9fb' AND proacl::text='{postgres=X/postgres,authenticated=X/postgres}'
 AND prosecdef AND pg_get_userbyid(proowner)='postgres'
 FROM pg_proc WHERE oid='public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamp with time zone,timestamp with time zone,text)'::regprocedure),'EXACT_SOURCE_AND_ACL_public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamp with time zone,timestamp with time zone,text)');
SELECT proof.require((SELECT md5(prosrc)='fde9531de375bd50c6a526c2adee2756' AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'
 AND prosecdef AND pg_get_userbyid(proowner)='postgres'
 FROM pg_proc WHERE oid='public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)'::regprocedure),'EXACT_SOURCE_AND_ACL_public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)');
SELECT proof.require((SELECT md5(prosrc)='f1b07f739d3e256822ded8d2b01b3b11' AND proacl::text='{postgres=X/postgres}'
 AND prosecdef AND pg_get_userbyid(proowner)='postgres'
 FROM pg_proc WHERE oid='private.need_candidate_states_v5(uuid)'::regprocedure),'EXACT_SOURCE_AND_ACL_private.need_candidate_states_v5(uuid)');
SELECT proof.require((SELECT md5(prosrc)='91e873f74c8df477ab846391dfa53add' AND proacl::text='{postgres=X/postgres}'
 AND prosecdef AND pg_get_userbyid(proowner)='postgres'
 FROM pg_proc WHERE oid='private.need_candidate_states_v5(uuid,uuid[])'::regprocedure),'EXACT_SOURCE_AND_ACL_private.need_candidate_states_v5(uuid,uuid[])');
SELECT p.oid::regprocedure::text AS signature,md5(pg_get_functiondef(p.oid)) AS definition_md5,md5(p.prosrc) AS body_md5,p.proacl::text AS acl
FROM pg_proc p WHERE p.oid=ANY(ARRAY['public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure,'public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamp with time zone,timestamp with time zone,text)'::regprocedure,'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)'::regprocedure,'private.need_candidate_states_v5(uuid)'::regprocedure,'private.need_candidate_states_v5(uuid,uuid[])'::regprocedure]) ORDER BY 1;

