-- Prepared operation; NOT applied by this script. Exact preimage guards are mandatory.
-- Does not rewrite closure certificates/readiness, grants, ownership, RLS or user data.
DO $worker_draft_activation_operation$
declare f jsonb;actual jsonb;observed jsonb;expected jsonb;
begin
perform set_config('lock_timeout','5s',true);
perform set_config('statement_timeout','60s',true);
for f in select value from jsonb_array_elements($expected$[{"signature":"private.availability_timezone_valid(text)","oid":22169,"body_md5":"be95520dabe35febd8e9fa15f0ce0309","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"value text","result":"boolean","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.closure_account_key(uuid)","oid":22809,"body_md5":"2dde6ad2462255b188e4f03ffe88edcd","definer":false,"volatility":"i","is_strict":true,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"a uuid","result":"bigint","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.closure_account_restricted(uuid)","oid":22810,"body_md5":"f4999250c315e0253374d4611291c7ad","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"a uuid","result":"boolean","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.closure_assert_open(uuid,uuid)","oid":22811,"body_md5":"dc9bc4c718593850da4fdb49e612dbd2","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"a uuid, b uuid","result":"void","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":"NULL::uuid"},{"signature":"private.complete_worker_profile_v1(uuid,uuid,text)","oid":33213,"body_md5":"2a0a7c10a3671d6cd49fad21fe65d824","definer":false,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_profile_id uuid, p_review_id uuid, p_displayed_digest text","result":"void","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.location_text_valid(jsonb,integer)","oid":22186,"body_md5":"3ec40250cfbe356ee0847c6ecccf157e","definer":false,"volatility":"i","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"value jsonb, max_length integer","result":"boolean","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.normalize_worker_ai_availability(uuid,uuid,jsonb)","oid":23017,"body_md5":"80ab9bc1c1cb1a27567c17068725d93a","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog","TimeZone=UTC","DateStyle=ISO, YMD"],"arguments":"pid uuid, aid uuid, p_value jsonb","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.require_location_country(jsonb)","oid":22217,"body_md5":"e57a66d5644c6652504d59a8bf6b5f2f","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"value jsonb","result":"text","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.taxonomy_preserve_review_handoff_v1(jsonb,uuid,uuid)","oid":31309,"body_md5":"4da6744c56947085f7122b69a1e45cf8","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p jsonb, account_id uuid, conversation_id uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.taxonomy_resolve_turn_catalog_v1(uuid,text,jsonb,text)","oid":35488,"body_md5":"639983846b4f6b51cfe62c91afe4b0d6","definer":false,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_hint_id uuid, p_input_digest text, p_anchors jsonb, p_safety text","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)","oid":31025,"body_md5":"f439455e1d5edb63ae4297a5c922a3c5","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog, private"],"arguments":"p_purpose text, p_services jsonb, p_service_modes jsonb, p_owner_account_id uuid, p_conversation_id uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb)","oid":29336,"body_md5":"7852b9b70555366fe476905badf1b2fc","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog, private"],"arguments":"p_purpose text, p_services jsonb, p_service_modes jsonb","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.validate_worker_areas_v1(jsonb)","oid":32708,"body_md5":"8f1cd592eb48eb9da31e0af02c0bdd2e","definer":false,"volatility":"i","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"areas jsonb","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_area_source_continuity_v1()","oid":32943,"body_md5":"6e8543b28bb11312cb454a946a6c95b3","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"","result":"trigger","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_document(uuid)","oid":23022,"body_md5":"9bca4f2fb9d2631cdea48777e18e7a09","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"cid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_initial(uuid)","oid":23016,"body_md5":"416afcf45c6139a7c68630fb1cc6686c","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"aid uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_service_mode_context_v1(uuid,uuid)","oid":31166,"body_md5":"33a6f4373714490c6d6957cd556df853","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_account_id uuid, p_conversation_id uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_source_hash(uuid)","oid":23015,"body_md5":"416e1e92c90545ff2a3f4c942db793f7","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"aid uuid","result":"text","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_source(uuid)","oid":23014,"body_md5":"5ae2bca9c15a84ab166091dcaa81af6d","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"aid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_turn_document(uuid)","oid":23021,"body_md5":"82daa0a4586b20b8bd4e4c2e781e1bcd","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"tid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_availability_document(uuid)","oid":22170,"body_md5":"fbfe4e849840eaaff4729fec266e1937","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog","TimeZone=UTC","DateStyle=ISO, YMD"],"arguments":"pid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_location_document(uuid)","oid":22198,"body_md5":"8745e96b743bb8104ecc9c20c53c5e30","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"pid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_remote_only_activation_ready_v1(uuid,text[])","oid":33216,"body_md5":"e6b5ddedcf9ab407fdb4cc1290261cff","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_account uuid, p_skills text[]","result":"boolean","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_remote_review_ready_v1(jsonb)","oid":33217,"body_md5":"dbdf2c7a5653cf725f25d6ab2ceacd2c","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_review jsonb","result":"boolean","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_saved_areas_v1(uuid)","oid":32706,"body_md5":"f8bf79ee54bd283d226e607d51e89291","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"aid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_complete_worker_profile(uuid)","oid":20904,"body_md5":"972b73c283ec7036257ac301ff04597a","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_profile_id uuid","result":"void","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_open_worker_ai(uuid)","oid":23023,"body_md5":"cc374cde22e589cb48645cf4fef5e151","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_client_request_id uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)","oid":29395,"body_md5":"d4609b081d71eaeef45310c3bac46cab","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_conversation_id uuid, p_expected_revision integer, p_activate boolean","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":"false"},{"signature":"rpc_save_worker_ai_review(uuid,text,uuid)","oid":23031,"body_md5":"ad4940745638fb0e3b2204763595974f","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_review_id uuid, p_displayed_digest text, p_client_request_id uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_save_worker_availability(text,jsonb)","oid":22176,"body_md5":"e35340586e6e7ea41f4d8b98a000f36f","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog","TimeZone=UTC","DateStyle=ISO, YMD"],"arguments":"p_expected_revision text, p_value jsonb","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_save_worker_location(text,jsonb,boolean)","oid":22200,"body_md5":"12b4505d1f6a5f97053a48ed72128af3","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_expected_revision text, p_value jsonb, p_confirmed boolean","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)","oid":29486,"body_md5":"156107382ec4aea5fda5348a6fc86f2d","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog, private"],"arguments":"p_owner_account_id uuid, p_request_key uuid, p_source_review_id uuid, p_profile_id uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)","oid":29415,"body_md5":"2144b976268327b361b955b267583a48","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog, private"],"arguments":"p_owner_account_id uuid, p_request_key uuid, p_purpose text, p_source_review_id uuid, p_plans jsonb","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null}]$expected$::jsonb) loop
 select jsonb_build_object('signature',f->>'signature','oid',p.oid::bigint,'body_md5',md5(p.prosrc),'definer',p.prosecdef,'volatility',p.provolatile,
 'is_strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,'owner',pg_get_userbyid(p.proowner),
 'acl',p.proacl::text,'config',p.proconfig,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),
 'kind',p.prokind,'language',l.lanname,'cost',p.procost,'rows',p.prorows,'support',p.prosupport::text,'argument_defaults',pg_get_expr(p.proargdefaults,0))
 into actual from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(f->>'signature');
 if actual is distinct from f then raise exception 'WORKER_DRAFT_ACTIVATION_FUNCTION_DRIFT: %',f->>'signature' using errcode='55000'; end if;
end loop;
select jsonb_build_object('relations',(select jsonb_agg(jsonb_build_object(
'name',n.nspname||'.'||c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
'constraints',(select coalesce(jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname),'[]'::jsonb) from pg_constraint k where k.conrelid=c.oid),
'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'roles',p.polroles::text,'permissive',p.polpermissive,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname),'[]'::jsonb) from pg_policy p where p.polrelid=c.oid)) order by n.nspname,c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.oid=any(array['private.taxonomy_confirmed_worker_modes_v1'::regclass,'private.work_taxonomy_aliases'::regclass,'private.work_taxonomy_categories'::regclass,'private.work_taxonomy_category_modes'::regclass,'private.work_taxonomy_gemini_turn_hints_v1'::regclass,'private.work_taxonomy_review_batches_v1'::regclass,'private.work_taxonomy_worker_bindings_v1'::regclass,'private.work_taxonomy_worker_capabilities'::regclass,'private.worker_ai_reviews'::regclass,'private.worker_ai_saves'::regclass,'private.worker_ai_sessions'::regclass,'private.worker_ai_turns'::regclass,'public.ai_conversations'::regclass,'public.app_profiles'::regclass])),
'closure',jsonb_build_object('storedSource',(select sha256 from private.closure_source_v5 where singleton),
'storedErasure',(select sha256 from private.closure_erasure_source_v5 where singleton),
'sourceDigest',private.closure_source_digest_v5(),'schemaDigest',private.closure_schema_digest_v5_139(),
'erasureDigest',private.closure_erasure_program_digest_v5(),
'sourceReady',(select sha256 from private.closure_source_v5 where singleton)=private.closure_source_digest_v5())) into observed;
expected:=$environment${"relations":[{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.taxonomy_confirmed_worker_modes_v1","owner":"postgres","forceRls":false,"policies":[],"constraints":["FOREIGN KEY (worker_account_id, category_id) REFERENCES private.work_taxonomy_worker_capabilities(worker_account_id, category_id) ON DELETE RESTRICT","FOREIGN KEY (category_id, execution_scope) REFERENCES private.work_taxonomy_category_modes(category_id, execution_scope) ON DELETE RESTRICT","CHECK ((execution_scope = ANY (ARRAY['REMOTE'::text, 'ON_SITE'::text])))","PRIMARY KEY (worker_account_id, category_id, execution_scope)","CHECK (((handoff IS NULL) OR ((execution_scope = 'REMOTE'::text) AND private.taxonomy_handoff_valid_v1(handoff))))"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"private.work_taxonomy_aliases","owner":"postgres","forceRls":false,"policies":[],"constraints":["FOREIGN KEY (category_id) REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT","CHECK (((char_length(label) >= 3) AND (char_length(label) <= 120)))","CHECK ((locale ~ '^[a-z]{2}(-[A-Z]{2})?$'::text))","UNIQUE (locale, normalized_key)","PRIMARY KEY (id)"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"private.work_taxonomy_categories","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK (((char_length(canonical_key) >= 3) AND (char_length(canonical_key) <= 160)))","UNIQUE (canonical_key)","CHECK ((catalog_version > 0))","CHECK (((superseded_by IS NULL) OR (superseded_by <> id)))","CHECK (((parent_id IS NULL) OR (parent_id <> id)))","CHECK ((canonical_key = private.taxonomy_normalize_v1(label)))","CHECK (((char_length(label) >= 3) AND (char_length(label) <= 120)))","FOREIGN KEY (parent_id) REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT","PRIMARY KEY (id)","CHECK ((source = ANY (ARRAY['SYSTEM'::text, 'AI_REVIEWED'::text, 'OPERATOR'::text])))","CHECK ((state = ANY (ARRAY['AUTO_PROVISIONAL'::text, 'ESTABLISHED'::text, 'RETIRED'::text])))","FOREIGN KEY (superseded_by) REFERENCES private.work_taxonomy_categories(id)"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"private.work_taxonomy_category_modes","owner":"postgres","forceRls":false,"policies":[],"constraints":["FOREIGN KEY (category_id) REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT","CHECK ((execution_scope = ANY (ARRAY['ON_SITE'::text, 'REMOTE'::text])))","PRIMARY KEY (category_id, execution_scope)","CHECK (((char_length(source_ref) >= 3) AND (char_length(source_ref) <= 120)))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.work_taxonomy_gemini_turn_hints_v1","owner":"postgres","forceRls":false,"policies":[],"constraints":["UNIQUE (purpose, account_id, turn_id)","CHECK (((catalog_resolution IS NULL) OR ((jsonb_typeof(catalog_resolution) = 'object'::text) AND (pg_column_size(catalog_resolution) <= 12000) AND ((catalog_resolution ->> 'state'::text) = ANY (ARRAY['RESOLVED'::text, 'DEFERRED'::text])) AND ((catalog_resolution ->> 'inputDigest'::text) ~ '^[0-9a-f]{64}$'::text))))","CHECK ((catalog_version > 0))","CHECK ((payload_digest ~ '^[a-f0-9]{64}$'::text))","PRIMARY KEY (id)","CHECK (((jsonb_typeof(proposals) = 'array'::text) AND ((jsonb_array_length(proposals) >= 1) AND (jsonb_array_length(proposals) <= 24))))","CHECK ((purpose = ANY (ARRAY['WORKER_CAPABILITY'::text, 'NEED_SERVICE'::text])))","CHECK ((source_fingerprint ~ '^[a-f0-9]{64}$'::text))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":false,"name":"private.work_taxonomy_review_batches_v1","owner":"postgres","forceRls":false,"policies":[],"constraints":["PRIMARY KEY (id)","CHECK ((jsonb_typeof(plans) = 'array'::text))","CHECK ((plans_digest ~ '^[0-9a-f]{64}$'::text))","CHECK ((purpose = ANY (ARRAY['WORKER_CAPABILITY'::text, 'NEED_SERVICE'::text])))","CHECK ((review_digest ~ '^[0-9a-f]{64}$'::text))","UNIQUE (owner_account_id, request_key)"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.work_taxonomy_worker_bindings_v1","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK ((catalog_version > 0))","PRIMARY KEY (owner_account_id, request_key)","UNIQUE (source_review_id)"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"private.work_taxonomy_worker_capabilities","owner":"postgres","forceRls":false,"policies":[],"constraints":["FOREIGN KEY (category_id) REFERENCES private.work_taxonomy_categories(id)","CHECK ((origin = ANY (ARRAY['WORKER_CONFIRMED'::text, 'WORKER_CORRECTED'::text])))","PRIMARY KEY (worker_account_id, category_id)"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_reviews","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK ((octet_length((envelope)::text) <= 524288))","PRIMARY KEY (id)"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_saves","owner":"postgres","forceRls":false,"policies":[],"constraints":["UNIQUE (account_id, client_request_id)","PRIMARY KEY (review_id)","FOREIGN KEY (review_id) REFERENCES private.worker_ai_reviews(id)"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_sessions","owner":"postgres","forceRls":false,"policies":[],"constraints":["UNIQUE (account_id, open_request_id)","CHECK ((octet_length((candidate)::text) <= 524288))","PRIMARY KEY (conversation_id)","CHECK ((revision >= 0))","CHECK ((safety = ANY (ARRAY['ALLOW'::text, 'CLARIFY'::text, 'REVIEW'::text, 'BLOCK'::text])))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_turns","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK (((cancelled_at IS NULL) OR ((state = 'FAILED'::text) AND (completion_hash IS NULL))))","UNIQUE (account_id, client_request_id)","FOREIGN KEY (conversation_id) REFERENCES private.worker_ai_sessions(conversation_id)","PRIMARY KEY (turn_id)","CHECK ((state = ANY (ARRAY['PROCESSING'::text, 'SUCCEEDED'::text, 'FAILED'::text])))"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"name":"public.ai_conversations","owner":"postgres","forceRls":false,"policies":[{"name":"ai_conversations_owner_read","check":null,"roles":"{16485}","using":"(account_id = ( SELECT auth.uid() AS uid))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE","FOREIGN KEY (bound_need_id) REFERENCES needs(id) ON DELETE SET NULL","CHECK ((fact_schema_version = ANY (ARRAY['LEGACY_TEXT_V1'::text, 'NEED_FACT_V2'::text])))","CHECK (((need_edit_base_fingerprint IS NULL) OR (need_edit_base_fingerprint ~ '^[0-9a-f]{64}$'::text)))","PRIMARY KEY (id)","CHECK ((purpose = ANY (ARRAY['NEED_INTAKE'::text, 'APPLICATION'::text, 'PROFILE'::text])))","CHECK ((status = ANY (ARRAY['OPEN'::text, 'COMPLETED'::text, 'ABANDONED'::text])))"]},{"acl":"{postgres=arwdDxtm/postgres,authenticated=arwDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.app_profiles","owner":"postgres","forceRls":false,"policies":[{"name":"app_profiles_insert_own","check":"(( SELECT auth.uid() AS uid) = account_id)","roles":"{16485}","using":null,"command":"a","permissive":true},{"name":"app_profiles_select_own","check":null,"roles":"{16485}","using":"(( SELECT auth.uid() AS uid) = account_id)","command":"r","permissive":true},{"name":"app_profiles_update_own","check":"(( SELECT auth.uid() AS uid) = account_id)","roles":"{16485}","using":"(( SELECT auth.uid() AS uid) = account_id)","command":"w","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["FOREIGN KEY (account_id) REFERENCES app_accounts(id) ON DELETE CASCADE","UNIQUE (account_id, kind)","CHECK ((account_type = ANY (ARRAY['INDIVIDUAL'::text, 'TEAM'::text, 'COMPANY'::text])))","CHECK (((team_capacity >= 1) AND (team_capacity <= 50)))","CHECK ((kind = ANY (ARRAY['REQUESTER'::text, 'WORKER'::text])))","CHECK (((minimum_fee_rsd >= 0) AND (minimum_fee_rsd <= 10000000)))","CHECK (((operating_country_code IS NULL) OR (operating_country_code ~ '^[A-Z]{2}$'::text)))","PRIMARY KEY (id)","CHECK (((radius_km >= 1) AND (radius_km <= 200)))","CHECK ((profile_status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'SUSPENDED'::text, 'CLOSED'::text])))","CHECK ((((worker_dispatch_eligible_since IS NULL) AND (worker_dispatch_clock_source IS NULL)) OR ((kind = 'WORKER'::text) AND (worker_dispatch_eligible_since IS NOT NULL) AND isfinite(worker_dispatch_eligible_since) AND (worker_dispatch_clock_source IS NOT NULL) AND (worker_dispatch_clock_source = ANY (ARRAY['FIRST_ACTIVATION'::text, 'ROLLOUT_ACTIVE_OBSERVED'::text])))))","CHECK (((years_experience >= 0) AND (years_experience <= 80)))"]}],"closure":{"sourceReady":false,"schemaDigest":"7923a76b5add2e56f2ded9a173dd1638baa346a8742877cecb23aaf634229d50","sourceDigest":"acf469c343e33c4126ca96853b4461c8dcdf7271cc22fb36464cc506006dd6ab","storedSource":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","erasureDigest":"24613a2985b790b6fa4445b021861a2bf25e7bb44d907da148900870bdccb11c","storedErasure":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb"}}$environment$::jsonb;
if observed is distinct from expected then raise exception 'WORKER_DRAFT_ACTIVATION_PREIMAGE_ENVIRONMENT_DRIFT' using errcode='55000'; end if;
execute $worker_draft_activation_ddl$CREATE OR REPLACE FUNCTION private.worker_ai_service_mode_context_v1(p_account_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 v_session private.worker_ai_sessions; v_profile_id uuid;
 v_item jsonb; v_projection jsonb; v_hints jsonb; v_source text; v_turn_resolved boolean:=false;
 v_saved_services jsonb:='[]';v_draft_services jsonb:='[]';v_unresolved jsonb:='[]';
 v_prior_review jsonb;v_prior_draft jsonb:='[]';v_prior_valid boolean:=false;

BEGIN
 SELECT * INTO v_session FROM private.worker_ai_sessions
 WHERE account_id=p_account_id AND conversation_id=p_conversation_id;
 IF NOT FOUND OR v_session.base_hash IS DISTINCT FROM private.worker_ai_source_hash(p_account_id)
    OR jsonb_typeof(v_session.candidate->'skills') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'WORKER_AI_NOT_EDITABLE' USING errcode='55000'; END IF;
 v_profile_id:=v_session.profile_id;
 -- Read only durable, active bindings for independently surviving services.
 -- A newer pending addition is not authority to erase an older bound service.
 -- Source hash above still ties this context to the current owned profile.
 WITH names AS (
  SELECT skill AS service,private.taxonomy_normalize_v1(skill) AS service_key
  FROM jsonb_array_elements_text(v_session.candidate->'skills') n(skill)
  WHERE EXISTS(SELECT 1 FROM public.app_profiles p WHERE p.id=v_profile_id
    AND p.account_id=p_account_id AND p.kind='WORKER' AND p.profile_status='ACTIVE'
    AND (SELECT count(*) FROM unnest(p.skills) saved_skill
      WHERE private.taxonomy_normalize_v1(saved_skill)=private.taxonomy_normalize_v1(skill))=1)
 ), saved AS (
  SELECT s.*,r.envelope FROM private.worker_ai_saves s
  JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
  WHERE s.account_id=p_account_id AND s.receipt->>'profileId'=v_profile_id::text
   AND (EXISTS(
    SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m WHERE m.worker_account_id=p_account_id
     AND m.active AND m.source_review_id=s.review_id AND m.source_request_key=s.client_request_id))
   AND s.receipt->>'accountId'=p_account_id::text AND s.receipt->>'reviewId'=r.id::text
   AND s.receipt->'saved'='true'::jsonb AND s.receipt->'authoritative'='true'::jsonb
   AND r.envelope->>'profileId'=v_profile_id::text AND r.envelope->>'accountId'=p_account_id::text
   AND r.envelope->>'reviewId'=r.id::text AND r.envelope->'canAccept'='true'::jsonb
   AND r.created_at<=s.created_at AND s.created_at<=r.expires_at
   AND r.envelope->>'displayedContentDigest'=encode(extensions.digest(
     ((r.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',r.base_hash))::text,'sha256'),'hex')

 ), bound AS (
  SELECT n.service,m.execution_scope AS mode,m.handoff,c.id AS category_id
  FROM names n JOIN private.work_taxonomy_categories c ON c.state='ESTABLISHED'
  JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
  JOIN private.taxonomy_confirmed_worker_modes_v1 m ON m.category_id=c.id AND m.execution_scope=cm.execution_scope
   AND m.worker_account_id=p_account_id AND m.active
  JOIN private.work_taxonomy_worker_capabilities cap ON cap.category_id=c.id AND cap.worker_account_id=p_account_id
   AND NOT cap.excluded AND cap.origin='WORKER_CONFIRMED' AND cap.confirmed_at=m.confirmed_at AND cap.updated_at<=m.confirmed_at
  JOIN saved s ON s.review_id=m.source_review_id AND s.client_request_id=m.source_request_key
   AND s.envelope->>'classificationState'='READY'
  JOIN private.work_taxonomy_worker_bindings_v1 b ON b.owner_account_id=p_account_id
   AND b.profile_id=v_profile_id AND b.source_review_id=s.review_id AND b.request_key=s.client_request_id
   AND b.bound_at=m.confirmed_at AND b.bound_at>=s.created_at
   AND b.result->>'status'='BOUND_WORKER_SERVICES' AND b.result->>'workerProfileId'=v_profile_id::text
  JOIN private.work_taxonomy_review_batches_v1 batch ON batch.owner_account_id=p_account_id
   AND batch.source_review_id=s.review_id AND batch.request_key=s.client_request_id AND batch.purpose='WORKER_CAPABILITY'
   AND batch.result->>'status'='COMMITTED' AND batch.result->'requiresBinding'='true'::jsonb
   AND batch.catalog_version=b.catalog_version AND batch.plans=s.envelope->'classificationCandidates'
   AND batch.review_digest=s.envelope->>'displayedContentDigest'
   AND jsonb_typeof(batch.plans)='array' AND jsonb_typeof(batch.result->'items')='array'
   AND b.result->'serviceModeCount'=to_jsonb(jsonb_array_length(batch.plans))
   AND jsonb_array_length(batch.result->'items')=jsonb_array_length(batch.plans)
   AND jsonb_array_length(s.envelope->'reviewedServiceModes')=jsonb_array_length(batch.plans)
  WHERE m.execution_scope IN ('ON_SITE','REMOTE')
   AND EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
    WHERE choice.worker_profile_id=v_profile_id AND choice.worker_account_id=p_account_id
     AND choice.consent_source='EXPLICIT_PROFILE_REVIEW' AND choice.confirmed_at IS NOT NULL
     AND m.execution_scope=ANY(choice.modes))
   -- Compare the saved service key, preserving n.service for display. Formatting
   -- changes are not a new skill; arbitrary synonyms still require signed IDs.
   AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(s.envelope#>'{profile,skills}') skill(value)
     WHERE private.taxonomy_normalize_v1(skill.value)=n.service_key)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.envelope->'reviewedServiceModes') selected(value)
     WHERE private.taxonomy_normalize_v1(selected.value->>'service')=n.service_key
       AND selected.value->>'mode'=m.execution_scope)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.result->'items') result(value)
     WHERE private.taxonomy_normalize_v1(result.value->>'service')=n.service_key
       AND result.value->>'mode'=m.execution_scope AND result.value->>'categoryId'=c.id::text)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) plan WHERE private.taxonomy_normalize_v1(plan->>'service')=n.service_key
    AND plan->>'mode'=m.execution_scope AND (plan->'handoff') IS NOT DISTINCT FROM m.handoff)
   AND (m.handoff IS NULL OR (m.execution_scope='REMOTE' AND private.taxonomy_handoff_valid_v1(m.handoff)))
   AND (SELECT count(*) FROM names same WHERE same.service_key=n.service_key)=1
   AND (
    -- Preserve exact/registered-alias resolution, including ambiguity refusal.
    ((c.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=c.id AND a.normalized_key=n.service_key))
     AND (SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=1)
    OR
    -- A local signed service may name an already-bound ID without a global alias.
    -- This branch only describes existing active authority; it never grants it.
    ((SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=0
     AND s.receipt->>'profileStatus'='ACTIVE'
     AND private.taxonomy_category_path_valid_v1(c.id)
     AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
       WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) WITH ORDINALITY plan(value,ord)
       WHERE plan.value->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
        AND private.taxonomy_normalize_v1(plan.value->>'service')=n.service_key AND plan.value->>'mode'=m.execution_scope
        AND (plan.value->'handoff') IS NOT DISTINCT FROM m.handoff
        AND plan.value->>'categoryId'=c.id::text
        AND jsonb_typeof(plan.value->'categoryLabel')='string'
        AND c.label IS NOT DISTINCT FROM plan.value->>'categoryLabel'
        AND plan.value ? 'categoryParentId'
        AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)
            IS NOT DISTINCT FROM plan.value->'categoryParentId'
        AND batch.result->'items'->(plan.ord::integer-1)->>'categoryId'=c.id::text
        AND batch.result->'items'->(plan.ord::integer-1)->>'mode'=m.execution_scope
        AND private.taxonomy_normalize_v1(batch.result->'items'->(plan.ord::integer-1)->>'service')=n.service_key))
   )

 ) SELECT coalesce(jsonb_agg(DISTINCT (jsonb_build_object('service',service,'mode',mode,
   'categoryId',category_id)||CASE WHEN handoff IS NOT NULL THEN jsonb_build_object('handoff',handoff)
     ELSE '{}'::jsonb END)),'[]'::jsonb) INTO v_saved_services FROM bound;


 -- Reopen only the latest unchanged owned DRAFT Save as proposals. These rows
 -- stay draftServices: they grant no active capability or notification consent.
 IF v_session.revision=0 AND v_session.candidate=private.worker_ai_initial(p_account_id)
   AND EXISTS(SELECT 1 FROM public.app_profiles p WHERE p.id=v_profile_id
     AND p.account_id=p_account_id AND p.kind='WORKER' AND p.profile_status='DRAFT')
   AND NOT EXISTS(SELECT 1 FROM private.worker_ai_turns t WHERE t.conversation_id=p_conversation_id)
   AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_gemini_turn_hints_v1 h
     WHERE h.account_id=p_account_id AND h.conversation_id=p_conversation_id)
 THEN
   WITH latest AS (
     SELECT s.* FROM private.worker_ai_saves s WHERE s.account_id=p_account_id
       AND s.receipt->>'profileId'=v_profile_id::text
     ORDER BY s.created_at DESC,s.review_id DESC LIMIT 1
   )
   SELECT r.envelope INTO v_prior_review FROM latest s
   JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
   JOIN private.worker_ai_sessions prior ON prior.conversation_id=r.conversation_id
     AND prior.account_id=p_account_id AND prior.profile_id=v_profile_id
   JOIN public.ai_conversations conv ON conv.id=r.conversation_id
     AND conv.account_id=p_account_id AND conv.purpose='PROFILE' AND conv.status='COMPLETED'
   WHERE s.receipt->>'accountId'=p_account_id::text
     AND s.receipt->>'reviewId'=r.id::text AND s.receipt->>'conversationId'=r.conversation_id::text
     AND s.receipt->>'profileStatus'='DRAFT'
     AND s.receipt->'saved'='true'::jsonb AND s.receipt->'authoritative'='true'::jsonb
     AND r.envelope->>'accountId'=p_account_id::text AND r.envelope->>'profileId'=v_profile_id::text
     AND r.envelope->>'reviewId'=r.id::text AND r.envelope->>'conversationId'=r.conversation_id::text
     AND r.envelope->'revision'=to_jsonb(r.revision) AND prior.revision=r.revision
     AND prior.base_hash=v_session.base_hash AND prior.candidate=v_session.candidate
     AND prior.safety NOT IN ('BLOCK','REVIEW')
     AND r.envelope->'profile'=v_session.candidate
     AND r.envelope->'activate'='false'::jsonb AND r.envelope->'canAccept'='true'::jsonb
     AND r.envelope->>'classificationState'='READY'
     AND r.envelope->'classificationCatalogVersion'=
       (SELECT to_jsonb(catalog_version) FROM private.work_taxonomy_control WHERE singleton)
     AND r.envelope->>'classificationCatalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
     AND r.created_at<=s.created_at AND s.created_at<=r.expires_at
     AND r.envelope->>'displayedContentDigest'=encode(extensions.digest(
       ((r.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',r.base_hash))::text,'sha256'),'hex')
     AND NOT EXISTS(SELECT 1 FROM private.worker_ai_saves other WHERE other.account_id=p_account_id
       AND other.receipt->>'profileId'=v_profile_id::text AND other.created_at=s.created_at
       AND other.review_id<>s.review_id);
   IF jsonb_typeof(v_prior_review->'classificationCandidates')='array'
      AND jsonb_typeof(v_prior_review->'reviewedServiceModes')='array'
      AND jsonb_array_length(v_prior_review->'classificationCandidates') BETWEEN 1 AND 12
      AND jsonb_array_length(v_prior_review->'classificationCandidates')=
          jsonb_array_length(v_prior_review->'reviewedServiceModes')
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_session.candidate->'skills') skill
        WHERE (SELECT count(*) FROM jsonb_array_elements_text(v_session.candidate->'skills') other
          WHERE private.taxonomy_normalize_v1(other)=private.taxonomy_normalize_v1(skill))<>1)
   THEN
     v_prior_valid:=true;
     FOR v_item IN SELECT value FROM jsonb_array_elements(v_prior_review->'classificationCandidates') LOOP
       -- Exact/alias plans intentionally omit semantic label/parent witnesses.
       -- Re-run their exact projection; semantic synonyms retain signed IDs.
       v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
         jsonb_build_array(v_item->>'service'),jsonb_build_array(jsonb_build_object(
           'service',v_item->>'service','mode',v_item->>'mode')));
       IF v_item->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
         OR v_item->>'mode' IS NULL OR v_item->>'mode' NOT IN ('ON_SITE','REMOTE')
         OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_session.candidate->'skills') skill
           WHERE skill=v_item->>'service')
         OR (SELECT count(*) FROM jsonb_array_elements(v_prior_review->'classificationCandidates') p
           WHERE p->>'service'=v_item->>'service' AND p->>'mode'=v_item->>'mode')<>1
         OR (SELECT count(*) FROM jsonb_array_elements(v_prior_review->'reviewedServiceModes') m
           WHERE m->>'service'=v_item->>'service' AND m->>'mode'=v_item->>'mode')<>1
         OR private.taxonomy_risk_triage_v1(v_item->>'service') IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
         OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
           JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id AND cm.execution_scope=v_item->>'mode'
           WHERE c.id::text=v_item->>'categoryId' AND c.state='ESTABLISHED'
             AND ((v_projection->>'status'='READY'
               AND v_projection#>>'{classificationCandidates,0,categoryId}'=c.id::text)
              OR (v_item?'categoryParentId' AND c.label=v_item->>'categoryLabel'
               AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)=v_item->'categoryParentId'))
             AND private.taxonomy_risk_triage_v1(c.label)='LOW_RISK_CANDIDATE'
             AND private.taxonomy_category_path_valid_v1(c.id)
             AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
               WHERE child.parent_id=c.id AND child.state='ESTABLISHED'))
         OR (v_item?'handoff' AND (v_item->>'mode'<>'REMOTE'
           OR private.taxonomy_handoff_valid_v1(v_item->'handoff') IS NOT TRUE))
         OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_prior_review->'classificationCandidates') other
           WHERE other->>'categoryId'=v_item->>'categoryId' AND other->>'mode'=v_item->>'mode'
             AND other->'handoff' IS DISTINCT FROM v_item->'handoff')
       THEN v_prior_valid:=false;EXIT; END IF;
       v_prior_draft:=v_prior_draft||jsonb_build_array(jsonb_build_object(
         'service',v_item->>'service','mode',v_item->>'mode','categoryId',v_item->>'categoryId')
         ||CASE WHEN v_item?'handoff' THEN jsonb_build_object('handoff',v_item->'handoff') ELSE '{}'::jsonb END);
     END LOOP;
     IF v_prior_valid AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_session.candidate->'skills') skill
       WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_prior_draft) p WHERE p->>'service'=skill))
     THEN v_draft_services:=v_prior_draft; END IF;
   END IF;
 END IF;

 -- Latest current-source hints are separate proposals. Even an exact category
 -- and mode here are not saved consent and must never replace the baseline.
 v_source:=encode(extensions.digest(convert_to(
   v_session.candidate::text||'|'||v_session.revision::text||'|'||v_session.base_hash,'UTF8'),'sha256'),'hex');
 SELECT h.proposals,coalesce(h.catalog_resolution->>'state'='RESOLVED',false) INTO v_hints,v_turn_resolved FROM private.work_taxonomy_turn_hints_resolved_v1 h
 WHERE h.purpose='WORKER_CAPABILITY' AND h.account_id=p_account_id
   AND h.conversation_id=p_conversation_id AND h.source_fingerprint=v_source
   AND h.catalog_version=(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton=true)
 ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 IF jsonb_typeof(v_hints)='array' THEN
   FOR v_item IN SELECT value FROM jsonb_array_elements(v_hints) LOOP
     IF v_item->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
        OR v_item->>'mode' NOT IN ('ON_SITE','REMOTE')
        OR v_item->>'categoryId' IS NULL
        OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
          WHERE skill.value=to_jsonb(v_item->>'service'))
        OR (SELECT count(*) FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
            WHERE private.taxonomy_normalize_v1(skill.value#>>'{}')=
                  private.taxonomy_normalize_v1(v_item->>'service'))<>1
     THEN CONTINUE; END IF;
     v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
       jsonb_build_array(v_item->>'service'),jsonb_build_array(
         jsonb_build_object('service',v_item->>'service','mode',v_item->>'mode')));
     IF v_turn_resolved OR (v_projection->>'status'='READY'
        AND v_projection#>>'{classificationCandidates,0,categoryId}'=v_item->>'categoryId')
     THEN v_draft_services:=v_draft_services||jsonb_build_array(jsonb_build_object(
       'service',v_item->>'service','mode',v_item->>'mode','categoryId',v_item->>'categoryId')
        ||case when v_item ? 'handoff' then jsonb_build_object('handoff',v_item->'handoff') else '{}'::jsonb end);
     END IF;
   END LOOP;
 END IF;
 SELECT coalesce(jsonb_agg(value ORDER BY value->>'service',value->>'mode',value->>'categoryId'),'[]'::jsonb)
 INTO v_saved_services FROM (SELECT DISTINCT value FROM jsonb_array_elements(v_saved_services)) rows;
 SELECT coalesce(jsonb_agg(value ORDER BY value->>'service',value->>'mode',value->>'categoryId'),'[]'::jsonb)
 INTO v_draft_services FROM (SELECT DISTINCT value FROM jsonb_array_elements(v_draft_services)) rows;
 SELECT coalesce(jsonb_agg(value ORDER BY value#>>'{}'),'[]'::jsonb) INTO v_unresolved
 FROM (SELECT DISTINCT skill.value FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
   WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_saved_services||v_draft_services) known(value)
     WHERE known.value->>'service'=skill.value#>>'{}')) unresolved;
 RETURN jsonb_build_object('schemaVersion','WORKER_SERVICE_MODE_CONTEXT_V1','revision',v_session.revision,
   'savedServices',v_saved_services,'draftServices',v_draft_services,'unresolvedServices',v_unresolved);
END $function$$worker_draft_activation_ddl$;
execute $worker_draft_activation_ddl$CREATE OR REPLACE FUNCTION public.rpc_prepare_worker_ai_review_taxonomy(p_conversation_id uuid, p_expected_revision integer, p_activate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; doc jsonb; missing jsonb:='[]'; expires timestamptz;
 v_source text;v_hints jsonb;v_modes jsonb:='[]'::jsonb;v_item jsonb;v_projection jsonb;
 v_context jsonb;v_retained jsonb:='[]'::jsonb;v_plans jsonb:='[]'::jsonb;v_one jsonb;v_saved_item jsonb;v_plan jsonb;
 v_version bigint;v_fingerprint text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(auth.uid());
 select * into s from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=auth.uid() for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 perform 1 from public.ai_conversations where id=p_conversation_id and status='OPEN' for update;
 if not found or s.safety in ('BLOCK','REVIEW') then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 perform 1 from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
 if s.revision is distinct from p_expected_revision or s.base_hash<>private.worker_ai_source_hash(auth.uid()) then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p_activate is null or exists(select 1 from private.worker_ai_turns where conversation_id=p_conversation_id and state='PROCESSING') then raise exception 'WORKER_AI_TURN_PENDING' using errcode='55000'; end if;
 if p_activate then
  if length(s.candidate->>'displayName')<2 then missing:=missing||'"Ime"'::jsonb; end if;
  -- City readiness follows the signed service projection below.
  if jsonb_array_length(s.candidate->'skills')<1 then missing:=missing||'"Veštine"'::jsonb; end if;
 end if;
 if (s.candidate->'location')<> (private.worker_ai_initial(auth.uid())->'location')
  and (s.candidate#>'{location,operatingCountryCode}'='null'::jsonb or length(s.candidate#>>'{location,city}')<1)
 then missing:=missing||'"Država i mesto rada"'::jsonb; end if;
 if s.candidate->'tools' is distinct from private.worker_ai_initial(auth.uid())->'tools'
  or s.candidate->'vehicles' is distinct from private.worker_ai_initial(auth.uid())->'vehicles'
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 perform private.normalize_worker_ai_availability(s.profile_id,s.account_id,s.candidate->'availability');
 select * into r from private.worker_ai_reviews where conversation_id=p_conversation_id and revision=s.revision
  and envelope->>'equipmentPolicy'='PRESERVE_LEGACY_NO_WRITE_V1'
  and not (p_activate and char_length(btrim(coalesce(s.candidate#>>'{location,city}','')))<2)
  and base_hash=s.base_hash and envelope->'activate'=to_jsonb(p_activate) and expires_at>clock_timestamp()
  and s.revision>0 -- untouched sessions revalidate saved consent on every review
  and envelope->>'classificationState'='READY'
  and envelope->>'classificationCatalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
  order by created_at desc limit 1;
 if found then return r.envelope; end if;
 r.id:=extensions.gen_random_uuid(); expires:=clock_timestamp()+interval '15 minutes';
 doc:=jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','reviewId',r.id,'conversationId',p_conversation_id,'accountId',auth.uid(),
  'profileId',s.profile_id,'revision',s.revision,'profile',s.candidate,'activate',p_activate,'missingRequired',missing,
  'canAccept',jsonb_array_length(missing)=0,'expiresAt',expires);
 -- Use only hints bound to the authenticated worker, this conversation, and
 -- the exact CURRENT candidate/revision/base_hash. They are suggestions only.
 v_source:=encode(extensions.digest(
   convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex');
 select h.proposals into v_hints from private.work_taxonomy_turn_hints_resolved_v1 h
 where h.purpose='WORKER_CAPABILITY' and h.account_id=auth.uid()
   and h.conversation_id=p_conversation_id and h.source_fingerprint=v_source
   and h.catalog_version=(select catalog_version from private.work_taxonomy_control where singleton=true)
 order by h.created_at desc,h.id desc limit 1;
 if jsonb_typeof(v_hints)='array' then
   for v_item in select value from jsonb_array_elements(v_hints) loop
     if v_item->>'mode' in ('ON_SITE','REMOTE')
       and v_item->>'action' in ('REUSE_EXISTING','REUSE_ALIAS','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH') then
       v_modes:=v_modes||jsonb_build_array(jsonb_build_object(
         'service',v_item->>'service','mode',v_item->>'mode'));
     end if;
   end loop;
 end if;

 -- Reuse only independently bound, unchanged services from this owner's
 -- current profile. Any current hint for a service (including invalid/null
 -- modes or actions) takes precedence and prevents silent old-mode fallback.
 perform 1 from private.work_taxonomy_worker_bindings_v1 binding
   where binding.owner_account_id=auth.uid() and binding.profile_id=s.profile_id for share;
 perform 1 from private.worker_execution_mode_choices choice
   where choice.worker_profile_id=s.profile_id for share;
 perform 1 from private.taxonomy_confirmed_worker_modes_v1 mode
   where mode.worker_account_id=auth.uid() for share;
 perform 1 from private.work_taxonomy_worker_capabilities capability
   where capability.worker_account_id=auth.uid() for share;
 v_context:=private.worker_ai_service_mode_context_v1(auth.uid(),p_conversation_id);
 -- An untouched new session may also reuse the current DRAFT Save witness
 -- validated by context. Any user turn/edit or hint excludes this fallback.
 for v_item in select value from jsonb_array_elements((v_context->'savedServices')||
   case when s.revision=0 and s.candidate=private.worker_ai_initial(auth.uid())
     and not exists(select 1 from private.worker_ai_turns t where t.conversation_id=p_conversation_id)
     and not exists(select 1 from private.work_taxonomy_gemini_turn_hints_v1 h
       where h.account_id=auth.uid() and h.conversation_id=p_conversation_id)
   then v_context->'draftServices' else '[]'::jsonb end) loop
   if not exists(select 1 from jsonb_array_elements(coalesce(v_hints,'[]'::jsonb)) h
     where private.taxonomy_normalize_v1(h->>'service')=private.taxonomy_normalize_v1(v_item->>'service'))
   and not exists(
     -- Absence in the newest turn cannot undo a prior explicit change in this
     -- conversation. A stale proposal may prevent fallback, never grant it.
     select 1 from (select h.proposals from private.work_taxonomy_gemini_turn_hints_v1 h
       where h.purpose='WORKER_CAPABILITY' and h.account_id=auth.uid() and h.conversation_id=p_conversation_id
         and h.source_fingerprint is distinct from v_source
         and exists(select 1 from jsonb_array_elements(h.proposals) p
           where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(v_item->>'service'))
       order by h.created_at desc,h.id desc limit 1) previous
     where exists(select 1 from jsonb_array_elements(previous.proposals) p
       where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(v_item->>'service')
       and (p->>'action' is distinct from 'REUSE_EXISTING' or not exists(
         select 1 from jsonb_array_elements(v_context->'savedServices') saved
         where saved->>'service'=v_item->>'service' and saved->>'mode'=p->>'mode'
           and saved->>'categoryId'=p->>'categoryId' and saved->'handoff' is not distinct from p->'handoff')))
     or exists(select 1 from jsonb_array_elements(v_context->'savedServices') saved
       where saved->>'service'=v_item->>'service' and not exists(
         select 1 from jsonb_array_elements(previous.proposals) p
         where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(v_item->>'service')
           and saved->>'mode'=p->>'mode' and saved->>'categoryId'=p->>'categoryId'
           and saved->'handoff' is not distinct from p->'handoff')))
   then
     v_modes:=v_modes||jsonb_build_array(jsonb_build_object('service',v_item->>'service','mode',v_item->>'mode'));
     v_retained:=v_retained||jsonb_build_array(v_item);
   end if;
 end loop;
 select coalesce(jsonb_agg(m.value ORDER BY skill.ord,m.value->>'mode'),'[]'::jsonb) into v_modes
 from jsonb_array_elements(v_modes) m(value) join jsonb_array_elements(s.candidate->'skills') with ordinality skill(value,ord)
   on skill.value=to_jsonb(m.value->>'service');
 v_projection:=private.taxonomy_review_candidate_projection_v2(
   'WORKER_CAPABILITY',s.candidate->'skills',v_modes,auth.uid(),p_conversation_id);
 if v_projection->>'status' in ('READY','PENDING_CLASSIFICATION') and v_retained<>'[]'::jsonb then
   select catalog_version into v_version from private.work_taxonomy_control where singleton;
   v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
   -- Existing per-service projection validates every new plan. Only a verified
   -- saved semantic ID may fill a missing old synonym, without a new model call.
   for v_item in select value from jsonb_array_elements(v_modes) loop
     v_one:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',
       jsonb_build_array(v_item->>'service'),jsonb_build_array(v_item),auth.uid(),p_conversation_id);
     select value into v_saved_item from jsonb_array_elements(v_retained) x(value)
       where value->>'service'=v_item->>'service' and value->>'mode'=v_item->>'mode';
     if v_one->>'status'='READY' then
       v_plan:=v_one#>'{classificationCandidates,0}';
       if v_saved_item is not null and v_plan->>'categoryId' is distinct from v_saved_item->>'categoryId' then
         v_plans:='[]'::jsonb;exit;
       end if;
     elsif v_one->>'status'='PENDING_CLASSIFICATION' and v_saved_item is not null then
       select jsonb_build_object('action','REUSE_EXISTING','service',v_item->>'service','mode',v_item->>'mode',
         'categoryId',c.id,'categoryLabel',c.label,'categoryParentId',c.parent_id,
         'reason','Previously signed and saved service identity','catalogVersion',v_version)
       into v_plan from private.work_taxonomy_categories c where c.id::text=v_saved_item->>'categoryId'
         and c.state='ESTABLISHED' and private.taxonomy_category_path_valid_v1(c.id)
         and private.taxonomy_risk_triage_v1(v_item->>'service')='LOW_RISK_CANDIDATE'
         and private.taxonomy_risk_triage_v1(c.label)='LOW_RISK_CANDIDATE';
       if v_plan is null then v_plans:='[]'::jsonb;exit;end if;
     else v_plans:='[]'::jsonb;exit;end if;
     if v_saved_item ? 'handoff' then v_plan:=v_plan||jsonb_build_object('handoff',v_saved_item->'handoff');end if;
     v_plans:=v_plans||jsonb_build_array(v_plan);
   end loop;
   if jsonb_array_length(v_plans)=jsonb_array_length(v_modes) and pg_column_size(v_plans)<=16000
      and v_version=(select catalog_version from private.work_taxonomy_control where singleton)
      and v_fingerprint=private.taxonomy_admission_fingerprint_v1() then
     v_projection:=v_projection||jsonb_build_object('status','READY','classificationCandidates',v_plans,
       'reviewedServiceModes',v_modes,'visibleServices',v_modes,
       'classificationCatalogVersion',v_version,'classificationCatalogFingerprint',v_fingerprint);
   else v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',s.candidate->'skills','[]'::jsonb);end if;
 end if;
 -- A projected mode is not consent to restore a handoff explicitly changed
 -- earlier in this conversation. A later turn may omit that old service;
 -- only a fresh projected handoff can supersede the last explicit change.
 if v_projection->>'status'='READY' then
   if exists(select 1 from jsonb_array_elements(v_projection->'classificationCandidates') plan
     join jsonb_array_elements(v_context->'savedServices') saved
       on saved->>'service'=plan->>'service' and saved->>'mode'=plan->>'mode'
         and saved->>'categoryId'=plan->>'categoryId'
     cross join lateral (select h.proposals from private.work_taxonomy_gemini_turn_hints_v1 h
       where h.purpose='WORKER_CAPABILITY' and h.account_id=auth.uid() and h.conversation_id=p_conversation_id
         and exists(select 1 from jsonb_array_elements(h.proposals) p
           where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(plan->>'service')
             and p->>'mode'='REMOTE' and p?'handoff')
       order by h.created_at desc,h.id desc limit 1) previous
     where plan->>'mode'='REMOTE' and not(plan?'handoff')
       and exists(select 1 from jsonb_array_elements(previous.proposals) p
         where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(plan->>'service')
           and p->>'mode'='REMOTE' and p?'handoff'
           and p->'handoff' is distinct from saved->'handoff')) then
     v_projection:=jsonb_build_object('status','PENDING_CLASSIFICATION','classificationCandidates','[]'::jsonb,
       'reviewedServiceModes','[]'::jsonb,'visibleServices','[]'::jsonb,
       'classificationCatalogVersion',null,'classificationCatalogFingerprint',null);
   end if;
 end if;
 v_projection:=private.taxonomy_preserve_review_handoff_v1(v_projection,auth.uid(),p_conversation_id);
 doc:=doc||jsonb_build_object('classificationState',v_projection->>'status',
   'classificationCandidates',v_projection->'classificationCandidates',
   'reviewedServiceModes',v_projection->'reviewedServiceModes',
   'classificationCatalogVersion',v_projection->'classificationCatalogVersion',
   'classificationCatalogFingerprint',v_projection->'classificationCatalogFingerprint');

 if p_activate and char_length(btrim(coalesce(s.candidate#>>'{location,city}','')))<2
    and private.worker_remote_review_ready_v1(doc) IS NOT TRUE
    and (doc->>'classificationState'='READY'
      and jsonb_array_length(private.validate_worker_areas_v1(
        coalesce(s.candidate->'workAreas','[]'::jsonb)))>0) IS NOT TRUE then
   if jsonb_typeof(doc->'reviewedServiceModes')='array'
      and jsonb_array_length(doc->'reviewedServiceModes')>0
      and not exists(select 1 from jsonb_array_elements(doc->'reviewedServiceModes') m
        where m->>'mode' is distinct from 'REMOTE') then
     missing:=missing||'"Potvrda usluga za rad na daljinu"'::jsonb;
   else missing:=missing||'"Mesto rada"'::jsonb; end if;
 end if;
 doc:=doc||jsonb_build_object('missingRequired',missing,'canAccept',jsonb_array_length(missing)=0);
 -- Sign BEFORE storing or returning the owner-visible review.

 doc:=doc||jsonb_build_object('equipmentPolicy','PRESERVE_LEGACY_NO_WRITE_V1');
 doc:=doc||jsonb_build_object('displayedContentDigest',encode(extensions.digest((doc||jsonb_build_object('baseHash',s.base_hash))::text,'sha256'),'hex'));
 insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at)
 values(r.id,auth.uid(),p_conversation_id,s.revision,s.base_hash,doc,expires);
 return doc;
end $function$$worker_draft_activation_ddl$;
execute $worker_draft_activation_ddl$CREATE OR REPLACE FUNCTION private.complete_worker_profile_v1(p_profile_id uuid, p_review_id uuid, p_displayed_digest text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_review private.worker_ai_reviews;
  v_session private.worker_ai_sessions;
  v_profile public.app_profiles%rowtype;
  v_previous_token text :=
    coalesce(current_setting('uskoci.profile_mutation', true), '');
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select *
    into v_profile
    from public.app_profiles
   where id = p_profile_id
   for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_profile.account_id <> v_uid or v_profile.kind <> 'WORKER' then
    raise exception 'NOT_WORKER_PROFILE_OWNER' using errcode = '42501';
  end if;

  if v_profile.profile_status = 'ACTIVE' then
    return;
  end if;

  if v_profile.profile_status <> 'DRAFT' then
    raise exception 'PROFILE_NOT_ACTIVATABLE'
      using errcode = 'P0001',
            detail = v_profile.profile_status;
  end if;

  if char_length(btrim(v_profile.display_name)) < 2 then
    raise exception 'DISPLAY_NAME_REQUIRED' using errcode = 'P0001';
  end if;


  if char_length(btrim(v_profile.city)) < 2
    and private.worker_remote_only_activation_ready_v1(v_uid,v_profile.skills) IS NOT TRUE then
    if p_review_id is null or p_displayed_digest is null then
      raise exception 'CITY_REQUIRED' using errcode='P0001';
    end if;
    select * into v_review from private.worker_ai_reviews
     where id=p_review_id and account_id=v_uid;
    if not found or v_review.envelope->>'displayedContentDigest' is distinct from p_displayed_digest then
      raise exception 'WORKER_AI_DENIED' using errcode='42501';
    end if;
    select * into v_session from private.worker_ai_sessions
     where conversation_id=v_review.conversation_id and account_id=v_uid for update;
    -- Save checked the live source hash BEFORE its own writes. Those writes
    -- change the hash: bind to the locked original session, not a new hash.
    if not found or v_session.profile_id is distinct from p_profile_id
      or v_review.revision is distinct from v_session.revision
      or v_review.base_hash is distinct from v_session.base_hash
      or v_review.envelope->'profile' is distinct from v_session.candidate
      or v_review.envelope->>'profileId' is distinct from p_profile_id::text
      or v_review.envelope->>'accountId' is distinct from v_uid::text
      or v_review.envelope->>'reviewId' is distinct from p_review_id::text
      or v_review.envelope->>'conversationId' is distinct from v_session.conversation_id::text
      or v_review.envelope->'revision' is distinct from to_jsonb(v_session.revision)
      or v_review.envelope->'activate' is distinct from 'true'::jsonb
      or v_review.envelope->'canAccept' is distinct from 'true'::jsonb
      or v_review.expires_at<clock_timestamp()
      or v_session.safety in ('BLOCK','REVIEW')
      or v_profile.display_name is distinct from v_session.candidate->>'displayName'
      or to_jsonb(v_profile.skills) is distinct from v_session.candidate->'skills'
      or p_displayed_digest is distinct from encode(extensions.digest(
        ((v_review.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',v_review.base_hash))::text,'sha256'),'hex')
      or exists(select 1 from private.worker_ai_turns where conversation_id=v_session.conversation_id and state='PROCESSING')
    then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
    perform 1 from private.work_taxonomy_control where singleton=true for share;
    if private.worker_remote_review_ready_v1(v_review.envelope) IS NOT TRUE
      and (v_review.envelope->>'classificationState'='READY'
        and v_review.envelope->'classificationCatalogVersion'=
          (select to_jsonb(catalog_version) from private.work_taxonomy_control where singleton)
        and v_review.envelope->>'classificationCatalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
        and jsonb_array_length(private.validate_worker_areas_v1(
          coalesce(v_review.envelope#>'{profile,workAreas}','[]'::jsonb)))>0) IS NOT TRUE then
      raise exception 'WORKER_AI_STALE' using errcode='PT409';
    end if;
  end if;


  if cardinality(v_profile.skills) < 1 then
    raise exception 'SKILL_REQUIRED' using errcode = 'P0001';
  end if;

  perform set_config(
    'uskoci.profile_mutation',
    'COMPLETE_WORKER_PROFILE',
    true
  );

  update public.app_profiles
     set profile_status = 'ACTIVE'
   where id = p_profile_id
     and profile_status = 'DRAFT';

  if not found then
    raise exception 'PROFILE_ACTIVATION_RACE' using errcode = 'P0001';
  end if;

  perform private.requeue_open_needs_for_worker_v5(v_uid);

  perform set_config(
    'uskoci.profile_mutation',
    v_previous_token,
    true
  );
exception
  when others then
    perform set_config(
      'uskoci.profile_mutation',
      v_previous_token,
      true
    );
    raise;
end;
$function$$worker_draft_activation_ddl$;
for f in select value from jsonb_array_elements($expected$[{"signature":"private.availability_timezone_valid(text)","oid":22169,"body_md5":"be95520dabe35febd8e9fa15f0ce0309","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"value text","result":"boolean","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.closure_account_key(uuid)","oid":22809,"body_md5":"2dde6ad2462255b188e4f03ffe88edcd","definer":false,"volatility":"i","is_strict":true,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"a uuid","result":"bigint","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.closure_account_restricted(uuid)","oid":22810,"body_md5":"f4999250c315e0253374d4611291c7ad","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"a uuid","result":"boolean","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.closure_assert_open(uuid,uuid)","oid":22811,"body_md5":"dc9bc4c718593850da4fdb49e612dbd2","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"a uuid, b uuid","result":"void","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":"NULL::uuid"},{"signature":"private.complete_worker_profile_v1(uuid,uuid,text)","oid":33213,"body_md5":"e414dcc307dfebe8b3d86d090c93410f","definer":false,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_profile_id uuid, p_review_id uuid, p_displayed_digest text","result":"void","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.location_text_valid(jsonb,integer)","oid":22186,"body_md5":"3ec40250cfbe356ee0847c6ecccf157e","definer":false,"volatility":"i","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"value jsonb, max_length integer","result":"boolean","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.normalize_worker_ai_availability(uuid,uuid,jsonb)","oid":23017,"body_md5":"80ab9bc1c1cb1a27567c17068725d93a","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog","TimeZone=UTC","DateStyle=ISO, YMD"],"arguments":"pid uuid, aid uuid, p_value jsonb","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.require_location_country(jsonb)","oid":22217,"body_md5":"e57a66d5644c6652504d59a8bf6b5f2f","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"value jsonb","result":"text","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.taxonomy_preserve_review_handoff_v1(jsonb,uuid,uuid)","oid":31309,"body_md5":"4da6744c56947085f7122b69a1e45cf8","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p jsonb, account_id uuid, conversation_id uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.taxonomy_resolve_turn_catalog_v1(uuid,text,jsonb,text)","oid":35488,"body_md5":"639983846b4f6b51cfe62c91afe4b0d6","definer":false,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_hint_id uuid, p_input_digest text, p_anchors jsonb, p_safety text","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)","oid":31025,"body_md5":"f439455e1d5edb63ae4297a5c922a3c5","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog, private"],"arguments":"p_purpose text, p_services jsonb, p_service_modes jsonb, p_owner_account_id uuid, p_conversation_id uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb)","oid":29336,"body_md5":"7852b9b70555366fe476905badf1b2fc","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog, private"],"arguments":"p_purpose text, p_services jsonb, p_service_modes jsonb","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.validate_worker_areas_v1(jsonb)","oid":32708,"body_md5":"8f1cd592eb48eb9da31e0af02c0bdd2e","definer":false,"volatility":"i","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"areas jsonb","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_area_source_continuity_v1()","oid":32943,"body_md5":"6e8543b28bb11312cb454a946a6c95b3","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"","result":"trigger","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_document(uuid)","oid":23022,"body_md5":"9bca4f2fb9d2631cdea48777e18e7a09","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"cid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_initial(uuid)","oid":23016,"body_md5":"416afcf45c6139a7c68630fb1cc6686c","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"aid uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_service_mode_context_v1(uuid,uuid)","oid":31166,"body_md5":"9a73b092724bfdf136a5bbbf45d0361a","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_account_id uuid, p_conversation_id uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_source_hash(uuid)","oid":23015,"body_md5":"416e1e92c90545ff2a3f4c942db793f7","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"aid uuid","result":"text","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_source(uuid)","oid":23014,"body_md5":"5ae2bca9c15a84ab166091dcaa81af6d","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"aid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_ai_turn_document(uuid)","oid":23021,"body_md5":"82daa0a4586b20b8bd4e4c2e781e1bcd","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"tid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_availability_document(uuid)","oid":22170,"body_md5":"fbfe4e849840eaaff4729fec266e1937","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog","TimeZone=UTC","DateStyle=ISO, YMD"],"arguments":"pid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_location_document(uuid)","oid":22198,"body_md5":"8745e96b743bb8104ecc9c20c53c5e30","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"pid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_remote_only_activation_ready_v1(uuid,text[])","oid":33216,"body_md5":"e6b5ddedcf9ab407fdb4cc1290261cff","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_account uuid, p_skills text[]","result":"boolean","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_remote_review_ready_v1(jsonb)","oid":33217,"body_md5":"dbdf2c7a5653cf725f25d6ab2ceacd2c","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_review jsonb","result":"boolean","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"private.worker_saved_areas_v1(uuid)","oid":32706,"body_md5":"f8bf79ee54bd283d226e607d51e89291","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"aid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_complete_worker_profile(uuid)","oid":20904,"body_md5":"972b73c283ec7036257ac301ff04597a","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_profile_id uuid","result":"void","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_open_worker_ai(uuid)","oid":23023,"body_md5":"cc374cde22e589cb48645cf4fef5e151","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_client_request_id uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)","oid":29395,"body_md5":"19be5fcc361ad0b4f79872ac8cd4166d","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_conversation_id uuid, p_expected_revision integer, p_activate boolean","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":"false"},{"signature":"rpc_save_worker_ai_review(uuid,text,uuid)","oid":23031,"body_md5":"ad4940745638fb0e3b2204763595974f","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_review_id uuid, p_displayed_digest text, p_client_request_id uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_save_worker_availability(text,jsonb)","oid":22176,"body_md5":"e35340586e6e7ea41f4d8b98a000f36f","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog","TimeZone=UTC","DateStyle=ISO, YMD"],"arguments":"p_expected_revision text, p_value jsonb","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_save_worker_location(text,jsonb,boolean)","oid":22200,"body_md5":"12b4505d1f6a5f97053a48ed72128af3","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_expected_revision text, p_value jsonb, p_confirmed boolean","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)","oid":29486,"body_md5":"156107382ec4aea5fda5348a6fc86f2d","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog, private"],"arguments":"p_owner_account_id uuid, p_request_key uuid, p_source_review_id uuid, p_profile_id uuid","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"signature":"rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)","oid":29415,"body_md5":"2144b976268327b361b955b267583a48","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog, private"],"arguments":"p_owner_account_id uuid, p_request_key uuid, p_purpose text, p_source_review_id uuid, p_plans jsonb","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null}]$expected$::jsonb) loop
 select jsonb_build_object('signature',f->>'signature','oid',p.oid::bigint,'body_md5',md5(p.prosrc),'definer',p.prosecdef,'volatility',p.provolatile,
 'is_strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,'owner',pg_get_userbyid(p.proowner),
 'acl',p.proacl::text,'config',p.proconfig,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),
 'kind',p.prokind,'language',l.lanname,'cost',p.procost,'rows',p.prorows,'support',p.prosupport::text,'argument_defaults',pg_get_expr(p.proargdefaults,0))
 into actual from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(f->>'signature');
 if actual is distinct from f then raise exception 'WORKER_DRAFT_ACTIVATION_FUNCTION_DRIFT: %',f->>'signature' using errcode='55000'; end if;
end loop;
select jsonb_build_object('relations',(select jsonb_agg(jsonb_build_object(
'name',n.nspname||'.'||c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
'constraints',(select coalesce(jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname),'[]'::jsonb) from pg_constraint k where k.conrelid=c.oid),
'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'roles',p.polroles::text,'permissive',p.polpermissive,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname),'[]'::jsonb) from pg_policy p where p.polrelid=c.oid)) order by n.nspname,c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.oid=any(array['private.taxonomy_confirmed_worker_modes_v1'::regclass,'private.work_taxonomy_aliases'::regclass,'private.work_taxonomy_categories'::regclass,'private.work_taxonomy_category_modes'::regclass,'private.work_taxonomy_gemini_turn_hints_v1'::regclass,'private.work_taxonomy_review_batches_v1'::regclass,'private.work_taxonomy_worker_bindings_v1'::regclass,'private.work_taxonomy_worker_capabilities'::regclass,'private.worker_ai_reviews'::regclass,'private.worker_ai_saves'::regclass,'private.worker_ai_sessions'::regclass,'private.worker_ai_turns'::regclass,'public.ai_conversations'::regclass,'public.app_profiles'::regclass])),
'closure',jsonb_build_object('storedSource',(select sha256 from private.closure_source_v5 where singleton),
'storedErasure',(select sha256 from private.closure_erasure_source_v5 where singleton),
'sourceDigest',private.closure_source_digest_v5(),'schemaDigest',private.closure_schema_digest_v5_139(),
'erasureDigest',private.closure_erasure_program_digest_v5(),
'sourceReady',(select sha256 from private.closure_source_v5 where singleton)=private.closure_source_digest_v5())) into observed;
expected:=$environment${"relations":[{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.taxonomy_confirmed_worker_modes_v1","owner":"postgres","forceRls":false,"policies":[],"constraints":["FOREIGN KEY (worker_account_id, category_id) REFERENCES private.work_taxonomy_worker_capabilities(worker_account_id, category_id) ON DELETE RESTRICT","FOREIGN KEY (category_id, execution_scope) REFERENCES private.work_taxonomy_category_modes(category_id, execution_scope) ON DELETE RESTRICT","CHECK ((execution_scope = ANY (ARRAY['REMOTE'::text, 'ON_SITE'::text])))","PRIMARY KEY (worker_account_id, category_id, execution_scope)","CHECK (((handoff IS NULL) OR ((execution_scope = 'REMOTE'::text) AND private.taxonomy_handoff_valid_v1(handoff))))"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"private.work_taxonomy_aliases","owner":"postgres","forceRls":false,"policies":[],"constraints":["FOREIGN KEY (category_id) REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT","CHECK (((char_length(label) >= 3) AND (char_length(label) <= 120)))","CHECK ((locale ~ '^[a-z]{2}(-[A-Z]{2})?$'::text))","UNIQUE (locale, normalized_key)","PRIMARY KEY (id)"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"private.work_taxonomy_categories","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK (((char_length(canonical_key) >= 3) AND (char_length(canonical_key) <= 160)))","UNIQUE (canonical_key)","CHECK ((catalog_version > 0))","CHECK (((superseded_by IS NULL) OR (superseded_by <> id)))","CHECK (((parent_id IS NULL) OR (parent_id <> id)))","CHECK ((canonical_key = private.taxonomy_normalize_v1(label)))","CHECK (((char_length(label) >= 3) AND (char_length(label) <= 120)))","FOREIGN KEY (parent_id) REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT","PRIMARY KEY (id)","CHECK ((source = ANY (ARRAY['SYSTEM'::text, 'AI_REVIEWED'::text, 'OPERATOR'::text])))","CHECK ((state = ANY (ARRAY['AUTO_PROVISIONAL'::text, 'ESTABLISHED'::text, 'RETIRED'::text])))","FOREIGN KEY (superseded_by) REFERENCES private.work_taxonomy_categories(id)"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"private.work_taxonomy_category_modes","owner":"postgres","forceRls":false,"policies":[],"constraints":["FOREIGN KEY (category_id) REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT","CHECK ((execution_scope = ANY (ARRAY['ON_SITE'::text, 'REMOTE'::text])))","PRIMARY KEY (category_id, execution_scope)","CHECK (((char_length(source_ref) >= 3) AND (char_length(source_ref) <= 120)))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.work_taxonomy_gemini_turn_hints_v1","owner":"postgres","forceRls":false,"policies":[],"constraints":["UNIQUE (purpose, account_id, turn_id)","CHECK (((catalog_resolution IS NULL) OR ((jsonb_typeof(catalog_resolution) = 'object'::text) AND (pg_column_size(catalog_resolution) <= 12000) AND ((catalog_resolution ->> 'state'::text) = ANY (ARRAY['RESOLVED'::text, 'DEFERRED'::text])) AND ((catalog_resolution ->> 'inputDigest'::text) ~ '^[0-9a-f]{64}$'::text))))","CHECK ((catalog_version > 0))","CHECK ((payload_digest ~ '^[a-f0-9]{64}$'::text))","PRIMARY KEY (id)","CHECK (((jsonb_typeof(proposals) = 'array'::text) AND ((jsonb_array_length(proposals) >= 1) AND (jsonb_array_length(proposals) <= 24))))","CHECK ((purpose = ANY (ARRAY['WORKER_CAPABILITY'::text, 'NEED_SERVICE'::text])))","CHECK ((source_fingerprint ~ '^[a-f0-9]{64}$'::text))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":false,"name":"private.work_taxonomy_review_batches_v1","owner":"postgres","forceRls":false,"policies":[],"constraints":["PRIMARY KEY (id)","CHECK ((jsonb_typeof(plans) = 'array'::text))","CHECK ((plans_digest ~ '^[0-9a-f]{64}$'::text))","CHECK ((purpose = ANY (ARRAY['WORKER_CAPABILITY'::text, 'NEED_SERVICE'::text])))","CHECK ((review_digest ~ '^[0-9a-f]{64}$'::text))","UNIQUE (owner_account_id, request_key)"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.work_taxonomy_worker_bindings_v1","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK ((catalog_version > 0))","PRIMARY KEY (owner_account_id, request_key)","UNIQUE (source_review_id)"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"private.work_taxonomy_worker_capabilities","owner":"postgres","forceRls":false,"policies":[],"constraints":["FOREIGN KEY (category_id) REFERENCES private.work_taxonomy_categories(id)","CHECK ((origin = ANY (ARRAY['WORKER_CONFIRMED'::text, 'WORKER_CORRECTED'::text])))","PRIMARY KEY (worker_account_id, category_id)"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_reviews","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK ((octet_length((envelope)::text) <= 524288))","PRIMARY KEY (id)"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_saves","owner":"postgres","forceRls":false,"policies":[],"constraints":["UNIQUE (account_id, client_request_id)","PRIMARY KEY (review_id)","FOREIGN KEY (review_id) REFERENCES private.worker_ai_reviews(id)"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_sessions","owner":"postgres","forceRls":false,"policies":[],"constraints":["UNIQUE (account_id, open_request_id)","CHECK ((octet_length((candidate)::text) <= 524288))","PRIMARY KEY (conversation_id)","CHECK ((revision >= 0))","CHECK ((safety = ANY (ARRAY['ALLOW'::text, 'CLARIFY'::text, 'REVIEW'::text, 'BLOCK'::text])))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_turns","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK (((cancelled_at IS NULL) OR ((state = 'FAILED'::text) AND (completion_hash IS NULL))))","UNIQUE (account_id, client_request_id)","FOREIGN KEY (conversation_id) REFERENCES private.worker_ai_sessions(conversation_id)","PRIMARY KEY (turn_id)","CHECK ((state = ANY (ARRAY['PROCESSING'::text, 'SUCCEEDED'::text, 'FAILED'::text])))"]},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"name":"public.ai_conversations","owner":"postgres","forceRls":false,"policies":[{"name":"ai_conversations_owner_read","check":null,"roles":"{16485}","using":"(account_id = ( SELECT auth.uid() AS uid))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE","FOREIGN KEY (bound_need_id) REFERENCES needs(id) ON DELETE SET NULL","CHECK ((fact_schema_version = ANY (ARRAY['LEGACY_TEXT_V1'::text, 'NEED_FACT_V2'::text])))","CHECK (((need_edit_base_fingerprint IS NULL) OR (need_edit_base_fingerprint ~ '^[0-9a-f]{64}$'::text)))","PRIMARY KEY (id)","CHECK ((purpose = ANY (ARRAY['NEED_INTAKE'::text, 'APPLICATION'::text, 'PROFILE'::text])))","CHECK ((status = ANY (ARRAY['OPEN'::text, 'COMPLETED'::text, 'ABANDONED'::text])))"]},{"acl":"{postgres=arwdDxtm/postgres,authenticated=arwDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.app_profiles","owner":"postgres","forceRls":false,"policies":[{"name":"app_profiles_insert_own","check":"(( SELECT auth.uid() AS uid) = account_id)","roles":"{16485}","using":null,"command":"a","permissive":true},{"name":"app_profiles_select_own","check":null,"roles":"{16485}","using":"(( SELECT auth.uid() AS uid) = account_id)","command":"r","permissive":true},{"name":"app_profiles_update_own","check":"(( SELECT auth.uid() AS uid) = account_id)","roles":"{16485}","using":"(( SELECT auth.uid() AS uid) = account_id)","command":"w","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["FOREIGN KEY (account_id) REFERENCES app_accounts(id) ON DELETE CASCADE","UNIQUE (account_id, kind)","CHECK ((account_type = ANY (ARRAY['INDIVIDUAL'::text, 'TEAM'::text, 'COMPANY'::text])))","CHECK (((team_capacity >= 1) AND (team_capacity <= 50)))","CHECK ((kind = ANY (ARRAY['REQUESTER'::text, 'WORKER'::text])))","CHECK (((minimum_fee_rsd >= 0) AND (minimum_fee_rsd <= 10000000)))","CHECK (((operating_country_code IS NULL) OR (operating_country_code ~ '^[A-Z]{2}$'::text)))","PRIMARY KEY (id)","CHECK (((radius_km >= 1) AND (radius_km <= 200)))","CHECK ((profile_status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'SUSPENDED'::text, 'CLOSED'::text])))","CHECK ((((worker_dispatch_eligible_since IS NULL) AND (worker_dispatch_clock_source IS NULL)) OR ((kind = 'WORKER'::text) AND (worker_dispatch_eligible_since IS NOT NULL) AND isfinite(worker_dispatch_eligible_since) AND (worker_dispatch_clock_source IS NOT NULL) AND (worker_dispatch_clock_source = ANY (ARRAY['FIRST_ACTIVATION'::text, 'ROLLOUT_ACTIVE_OBSERVED'::text])))))","CHECK (((years_experience >= 0) AND (years_experience <= 80)))"]}],"closure":{"sourceReady":false,"schemaDigest":"7923a76b5add2e56f2ded9a173dd1638baa346a8742877cecb23aaf634229d50","sourceDigest":"acf469c343e33c4126ca96853b4461c8dcdf7271cc22fb36464cc506006dd6ab","storedSource":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","erasureDigest":"24613a2985b790b6fa4445b021861a2bf25e7bb44d907da148900870bdccb11c","storedErasure":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb"}}$environment$::jsonb;
if observed is distinct from expected then raise exception 'WORKER_DRAFT_ACTIVATION_POSTIMAGE_ENVIRONMENT_DRIFT' using errcode='55000'; end if;
end $worker_draft_activation_operation$;
select 'WORKER_DRAFT_ACTIVATION_POSTIMAGE_MATCH' as status;
