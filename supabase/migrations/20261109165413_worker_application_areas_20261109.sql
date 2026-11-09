-- Prepared operation; NOT applied by this script. Exact preimage guards are mandatory.
-- Does not rewrite closure certificates/readiness, grants, ownership, RLS or user data.
DO $worker_application_areas_operation$
declare f jsonb;actual jsonb;observed jsonb;expected jsonb;
begin
perform set_config('lock_timeout','5s',true);
perform set_config('statement_timeout','60s',true);
for f in select value from jsonb_array_elements($expected$[{"oid":24205,"signature":"private.closure_erasure_program_digest_v5()","body_md5":"e6ec1acf0f08f19847b5e342f82f32b2","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"","result":"text","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":23565,"signature":"private.closure_schema_digest_v5_139()","body_md5":"988b9d3ab9c0dc7341cd30a391184e40","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"","result":"text","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":23194,"signature":"private.closure_source_digest_v5()","body_md5":"41e54d223122b58decd25cf66191470a","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"","result":"text","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":32708,"signature":"private.validate_worker_areas_v1(jsonb)","body_md5":"8f1cd592eb48eb9da31e0af02c0bdd2e","definer":false,"volatility":"i","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"areas jsonb","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":33216,"signature":"private.worker_remote_only_activation_ready_v1(uuid,text[])","body_md5":"e6b5ddedcf9ab407fdb4cc1290261cff","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_account uuid, p_skills text[]","result":"boolean","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":32706,"signature":"private.worker_saved_areas_v1(uuid)","body_md5":"f8bf79ee54bd283d226e607d51e89291","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"aid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":21401,"signature":"rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamp with time zone,timestamp with time zone,text)","body_md5":"fb8132db33279190478b5be0480721fa","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_response_id uuid, p_expected_response_version integer, p_expected_need_revision integer, p_client_request_id text, p_action text, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":18060,"signature":"rpc_select_response(uuid,integer,uuid,integer,text,text)","body_md5":"02934f7831db821a7b33fd6d40289b9a","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=public, pg_temp"],"arguments":"p_need_id uuid, p_need_revision integer, p_response_id uuid, p_response_version integer, p_content_hash text, p_client_request_id text","result":"uuid","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":20726,"signature":"rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)","body_md5":"398e85c4420da9c4765ae0ff6197a59e","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_need_id uuid, p_need_revision integer, p_worker_profile_id uuid, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text, p_client_request_id text","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null}]$expected$::jsonb) loop
 select jsonb_build_object('signature',f->>'signature','oid',p.oid::bigint,'body_md5',md5(p.prosrc),'definer',p.prosecdef,'volatility',p.provolatile,
 'is_strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,'owner',pg_get_userbyid(p.proowner),
 'acl',p.proacl::text,'config',p.proconfig,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),
 'kind',p.prokind,'language',l.lanname,'cost',p.procost,'rows',p.prorows,'support',p.prosupport::text,'argument_defaults',pg_get_expr(p.proargdefaults,0))
 into actual from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(f->>'signature');
 if actual is distinct from f then raise exception 'WORKER_APPLICATION_AREAS_FUNCTION_DRIFT: %',f->>'signature' using errcode='55000'; end if;
end loop;
select jsonb_build_object('relations',(select jsonb_agg(jsonb_build_object(
'name',n.nspname||'.'||c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
'constraints',(select coalesce(jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname),'[]'::jsonb) from pg_constraint k where k.conrelid=c.oid),
'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'roles',p.polroles::text,'permissive',p.polpermissive,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname),'[]'::jsonb) from pg_policy p where p.polrelid=c.oid)) order by n.nspname,c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.oid=any(array['private.response_application_snapshots'::regclass,'private.response_revision_resolution_commands'::regclass,'private.response_submit_commands'::regclass,'private.selection_commands'::regclass,'private.worker_ai_reviews'::regclass,'private.worker_ai_saves'::regclass,'public.agreement_versions'::regclass,'public.agreements'::regclass,'public.app_profiles'::regclass,'public.marketplace_response_versions'::regclass,'public.marketplace_responses'::regclass,'public.need_selections'::regclass,'public.needs'::regclass])),
'closure',jsonb_build_object('storedSource',(select sha256 from private.closure_source_v5 where singleton),
'storedErasure',(select sha256 from private.closure_erasure_source_v5 where singleton),
'sourceDigest',private.closure_source_digest_v5(),'schemaDigest',private.closure_schema_digest_v5_139(),
'erasureDigest',private.closure_erasure_program_digest_v5(),
'sourceReady',(select sha256 from private.closure_source_v5 where singleton)=private.closure_source_digest_v5())) into observed;
expected:=$environment${"relations":[{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.response_application_snapshots","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK (((need_remaining_slots_before_submit >= 1) AND (need_remaining_slots_before_submit <= 50)))","CHECK (((need_selected_slots_before_submit >= 0) AND (need_selected_slots_before_submit <= 50)))","FOREIGN KEY (response_id, response_version) REFERENCES marketplace_response_versions(response_id, version) ON DELETE CASCADE","CHECK (((covered_slots >= 1) AND (covered_slots <= 50)))","CHECK (((need_required_slots >= 1) AND (need_required_slots <= 50)))","PRIMARY KEY (response_id, response_version)","CHECK ((pricing_mode = ANY (ARRAY['MY_PRICE'::text, 'OFFERS'::text])))","CHECK (((requester_price_rsd IS NULL) OR (requester_price_rsd > 0)))","CHECK ((response_version >= 1))","CHECK ((snapshot_schema = 'APPLICATION_V1_SELF_DECLARED'::text))","FOREIGN KEY (worker_profile_id) REFERENCES app_profiles(id) ON DELETE RESTRICT","CHECK (((worker_team_capacity >= 1) AND (worker_team_capacity <= 50)))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.response_revision_resolution_commands","owner":"postgres","forceRls":true,"policies":[],"constraints":["PRIMARY KEY (worker_account_id, client_request_id)","FOREIGN KEY (response_id) REFERENCES marketplace_responses(id) ON DELETE RESTRICT","FOREIGN KEY (worker_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text))","CHECK (((char_length(btrim(client_request_id)) >= 8) AND (char_length(btrim(client_request_id)) <= 200)))","CHECK ((jsonb_typeof(result) = 'object'::text))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.response_submit_commands","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK (((char_length(btrim(client_request_id)) >= 8) AND (char_length(btrim(client_request_id)) <= 200)))","PRIMARY KEY (worker_account_id, client_request_id)","CHECK ((char_length(request_hash) = 64))","FOREIGN KEY (response_id, response_version) REFERENCES marketplace_response_versions(response_id, version) ON DELETE CASCADE","CHECK ((response_version >= 1))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.selection_commands","owner":"postgres","forceRls":false,"policies":[],"constraints":["FOREIGN KEY (agreement_id) REFERENCES agreements(id) ON DELETE RESTRICT","UNIQUE (agreement_id)","CHECK (((char_length(btrim(client_request_id)) >= 8) AND (char_length(btrim(client_request_id)) <= 200)))","CHECK (((covered_slots >= 1) AND (covered_slots <= 50)))","FOREIGN KEY (need_id) REFERENCES needs(id) ON DELETE RESTRICT","CHECK ((need_revision >= 1))","PRIMARY KEY (requester_account_id, client_request_id)","CHECK ((char_length(request_hash) = 64))","FOREIGN KEY (requester_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","CHECK ((char_length(response_content_hash) = 64))","CHECK ((response_version >= 1))","FOREIGN KEY (response_id, response_version) REFERENCES marketplace_response_versions(response_id, version) ON DELETE RESTRICT","FOREIGN KEY (selection_id) REFERENCES need_selections(id) ON DELETE RESTRICT","UNIQUE (selection_id)"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_reviews","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK ((octet_length((envelope)::text) <= 524288))","PRIMARY KEY (id)"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_saves","owner":"postgres","forceRls":false,"policies":[],"constraints":["UNIQUE (account_id, client_request_id)","PRIMARY KEY (review_id)","FOREIGN KEY (review_id) REFERENCES private.worker_ai_reviews(id)"]},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.agreement_versions","owner":"postgres","forceRls":false,"policies":[{"name":"agreement_versions_read","check":null,"roles":"{16485}","using":"(EXISTS ( SELECT 1\n   FROM agreements a\n  WHERE ((a.id = agreement_versions.agreement_id) AND ((a.requester_account_id = ( SELECT auth.uid() AS uid)) OR (a.worker_account_id = ( SELECT auth.uid() AS uid))))))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["FOREIGN KEY (agreement_id) REFERENCES agreements(id) ON DELETE CASCADE","CHECK (((supersedes_version IS NULL) OR (supersedes_version < version)))","CHECK ((char_length(content_hash) >= 16))","FOREIGN KEY (created_by_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","PRIMARY KEY (agreement_id, version)","CHECK ((status = ANY (ARRAY['CONFIRMED'::text, 'SUPERSEDED'::text, 'CANCELLED'::text])))","CHECK ((version >= 1))"]},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.agreements","owner":"postgres","forceRls":false,"policies":[{"name":"agreements_parties_read","check":null,"roles":"{16485}","using":"((requester_account_id = ( SELECT auth.uid() AS uid)) OR (worker_account_id = ( SELECT auth.uid() AS uid)))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["CHECK ((current_version >= 1))","FOREIGN KEY (need_id) REFERENCES needs(id) ON DELETE RESTRICT","PRIMARY KEY (id)","FOREIGN KEY (requester_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","FOREIGN KEY (requester_profile_id) REFERENCES app_profiles(id) ON DELETE RESTRICT","TRIGGER DEFERRABLE INITIALLY DEFERRED","FOREIGN KEY (selected_response_id) REFERENCES marketplace_responses(id) ON DELETE RESTRICT","UNIQUE (selected_response_id)","FOREIGN KEY (selection_id) REFERENCES need_selections(id) ON DELETE RESTRICT","UNIQUE (selection_id)","CHECK ((status = ANY (ARRAY['CONFIRMED'::text, 'SUPERSEDED'::text, 'CANCELLED'::text, 'COMPLETED'::text])))","FOREIGN KEY (worker_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","FOREIGN KEY (worker_profile_id) REFERENCES app_profiles(id) ON DELETE RESTRICT"]},{"acl":"{postgres=arwdDxtm/postgres,authenticated=arwDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.app_profiles","owner":"postgres","forceRls":false,"policies":[{"name":"app_profiles_insert_own","check":"(( SELECT auth.uid() AS uid) = account_id)","roles":"{16485}","using":null,"command":"a","permissive":true},{"name":"app_profiles_select_own","check":null,"roles":"{16485}","using":"(( SELECT auth.uid() AS uid) = account_id)","command":"r","permissive":true},{"name":"app_profiles_update_own","check":"(( SELECT auth.uid() AS uid) = account_id)","roles":"{16485}","using":"(( SELECT auth.uid() AS uid) = account_id)","command":"w","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["FOREIGN KEY (account_id) REFERENCES app_accounts(id) ON DELETE CASCADE","UNIQUE (account_id, kind)","CHECK ((account_type = ANY (ARRAY['INDIVIDUAL'::text, 'TEAM'::text, 'COMPANY'::text])))","CHECK (((team_capacity >= 1) AND (team_capacity <= 50)))","CHECK ((kind = ANY (ARRAY['REQUESTER'::text, 'WORKER'::text])))","CHECK (((minimum_fee_rsd >= 0) AND (minimum_fee_rsd <= 10000000)))","CHECK (((operating_country_code IS NULL) OR (operating_country_code ~ '^[A-Z]{2}$'::text)))","PRIMARY KEY (id)","CHECK (((radius_km >= 1) AND (radius_km <= 200)))","CHECK ((profile_status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'SUSPENDED'::text, 'CLOSED'::text])))","CHECK ((((worker_dispatch_eligible_since IS NULL) AND (worker_dispatch_clock_source IS NULL)) OR ((kind = 'WORKER'::text) AND (worker_dispatch_eligible_since IS NOT NULL) AND isfinite(worker_dispatch_eligible_since) AND (worker_dispatch_clock_source IS NOT NULL) AND (worker_dispatch_clock_source = ANY (ARRAY['FIRST_ACTIVATION'::text, 'ROLLOUT_ACTIVE_OBSERVED'::text])))))","CHECK (((years_experience >= 0) AND (years_experience <= 80)))"]},{"acl":"{postgres=arwdDxtm/postgres,anon=rDxtm/postgres,authenticated=rDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.marketplace_response_versions","owner":"postgres","forceRls":false,"policies":[{"name":"response_versions_read","check":null,"roles":"{16485}","using":"(EXISTS ( SELECT 1\n   FROM marketplace_responses r\n  WHERE ((r.id = marketplace_response_versions.response_id) AND ((r.worker_account_id = ( SELECT auth.uid() AS uid)) OR ((r.status <> 'DRAFT'::text) AND (EXISTS ( SELECT 1\n           FROM needs n\n          WHERE ((n.id = r.need_id) AND is_my_task(n.id)))))))))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["CHECK ((char_length(content_hash) >= 16))","CHECK (((covered_slots >= 1) AND (covered_slots <= 50)))","CHECK ((need_revision >= 1))","PRIMARY KEY (response_id, version)","CHECK ((price_basis = ANY (ARRAY['TOTAL'::text, 'HOURLY'::text])))","CHECK ((price_rsd > 0))","FOREIGN KEY (response_id) REFERENCES marketplace_responses(id) ON DELETE CASCADE","CHECK ((version >= 1))"]},{"acl":"{postgres=arwdDxtm/postgres,anon=rDxtm/postgres,authenticated=rDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.marketplace_responses","owner":"postgres","forceRls":false,"policies":[{"name":"responses_requester_read","check":null,"roles":"{16485}","using":"((status <> 'DRAFT'::text) AND (EXISTS ( SELECT 1\n   FROM needs n\n  WHERE ((n.id = marketplace_responses.need_id) AND is_my_task(n.id)))))","command":"r","permissive":true},{"name":"responses_worker_read","check":null,"roles":"{16485}","using":"(worker_account_id = ( SELECT auth.uid() AS uid))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["CHECK ((char_length(bounded_message) <= 1000))","CHECK ((((proposed_start_at IS NULL) AND (proposed_end_at IS NULL)) OR ((proposed_start_at IS NOT NULL) AND (proposed_end_at IS NOT NULL) AND (proposed_start_at < proposed_end_at))))","CHECK (((covered_slots >= 1) AND (covered_slots <= 50)))","CHECK ((current_version >= 1))","FOREIGN KEY (need_id) REFERENCES needs(id) ON DELETE CASCADE","PRIMARY KEY (id)","CHECK ((price_basis = ANY (ARRAY['TOTAL'::text, 'HOURLY'::text])))","CHECK ((price_rsd > 0))","CHECK ((response_kind = ANY (ARRAY['APPLICATION'::text, 'OFFER'::text])))","CHECK ((status = ANY (ARRAY['DRAFT'::text, 'SUBMITTED'::text, 'DELIVERED'::text, 'VIEWED'::text, 'SHORTLISTED'::text, 'SELECTED'::text, 'NOT_SELECTED'::text, 'WITHDRAWN'::text, 'EXPIRED'::text, 'STALE'::text, 'STALE_REVIEW_REQUIRED'::text])))","CHECK ((submitted_against_need_revision >= 1))","FOREIGN KEY (worker_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","FOREIGN KEY (worker_profile_id) REFERENCES app_profiles(id) ON DELETE RESTRICT"]},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.need_selections","owner":"postgres","forceRls":false,"policies":[{"name":"selections_requester","check":null,"roles":"{16485}","using":"(selected_by_account_id = ( SELECT auth.uid() AS uid))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["CHECK (((char_length(btrim(client_request_id)) >= 8) AND (char_length(btrim(client_request_id)) <= 200)))","CHECK (((covered_slots >= 1) AND (covered_slots <= 50)))","UNIQUE (need_id, client_request_id)","FOREIGN KEY (need_id) REFERENCES needs(id) ON DELETE CASCADE","CHECK ((need_revision >= 1))","PRIMARY KEY (id)","FOREIGN KEY (response_id) REFERENCES marketplace_responses(id) ON DELETE RESTRICT","FOREIGN KEY (selected_by_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","CHECK ((selection_mode = ANY (ARRAY['REQUESTER_SELECTS'::text, 'BIDDING'::text])))","CHECK ((status = ANY (ARRAY['SELECTED'::text, 'CANCELLED'::text, 'SUPERSEDED'::text])))","FOREIGN KEY (worker_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","FOREIGN KEY (worker_profile_id) REFERENCES app_profiles(id) ON DELETE RESTRICT"]},{"acl":"{postgres=arwdDxtm/postgres,anon=Dxtm/postgres,authenticated=awDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.needs","owner":"postgres","forceRls":false,"policies":[{"name":"needs_owner_insert","check":"((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = 'DRAFT'::text))","roles":"{16485}","using":null,"command":"a","permissive":true},{"name":"needs_owner_select","check":null,"roles":"{16485}","using":"(requester_account_id = ( SELECT auth.uid() AS uid))","command":"r","permissive":true},{"name":"needs_owner_update","check":"((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = 'DRAFT'::text))","roles":"{16485}","using":"((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = 'DRAFT'::text))","command":"w","permissive":true},{"name":"needs_participant_read","check":null,"roles":"{16485}","using":"rls_private.need_participant_can_read(id)","command":"r","permissive":true},{"name":"needs_public_discovery","check":null,"roles":"{16485}","using":"((status = ANY (ARRAY['PUBLISHED'::text, 'SELECTION'::text])) AND (( SELECT auth.uid() AS uid) IS NOT NULL) AND ((requester_account_id = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[]))) = (( SELECT auth.uid() AS uid) = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[])))))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"( SELECT rpc_storage_account_open() AS rpc_storage_account_open)","command":"r","permissive":false}],"constraints":["CHECK (((char_length(btrim(category)) >= 1) AND (char_length(btrim(category)) <= 120)))","FOREIGN KEY (category_id) REFERENCES private.work_taxonomy_categories(id)","CHECK (((ends_at IS NULL) OR (starts_at IS NULL) OR (ends_at > starts_at)))","CHECK (((char_length(btrim(description)) >= 1) AND (char_length(btrim(description)) <= 6000)))","CHECK ((execution_location_mode = ANY (ARRAY['STATIONARY'::text, 'POINT_TO_POINT'::text, 'MULTI_STOP'::text, 'AREA_BASED'::text, 'REMOTE'::text])))","CHECK (((minimum_experience_years IS NULL) OR ((minimum_experience_years >= 0) AND (minimum_experience_years <= 60))))","CHECK ((mode = ANY (ARRAY['MY_PRICE'::text, 'OFFERS'::text])))","PRIMARY KEY (id)","CHECK (((price_basis IS NULL) OR ((price_basis = ANY (ARRAY['TOTAL'::text, 'PER_PERSON'::text, 'HOURLY'::text])) AND (mode = 'MY_PRICE'::text))))","CHECK (((remaining_search_close_reason IS NULL) OR (char_length(remaining_search_close_reason) <= 500)))","FOREIGN KEY (remaining_search_closed_by_account_id) REFERENCES auth.users(id) ON DELETE SET NULL","FOREIGN KEY (requester_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","CHECK (((requester_price_rsd IS NULL) OR (requester_price_rsd > 0)))","FOREIGN KEY (requester_profile_id) REFERENCES app_profiles(id) ON DELETE RESTRICT","CHECK (((required_slots >= 1) AND (required_slots <= 50)))","CHECK ((revision >= 1))","CHECK ((schedule_kind = ANY (ARRAY['FIXED_WINDOW'::text, 'FLEXIBLE'::text, 'REMOTE_ANYTIME'::text, 'TODAY_FLEXIBLE'::text, 'TOMORROW_FLEXIBLE'::text, 'WEEK_FLEXIBLE'::text])))","CHECK ((status = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text, 'SELECTION'::text, 'ACTIVE'::text, 'COMPLETED'::text, 'CANCELLED'::text, 'EXPIRED'::text, 'ARCHIVED'::text])))","CHECK (((task_country_code IS NULL) OR (task_country_code ~ '^[A-Z]{2}$'::text)))","CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 140)))","CHECK (((NOT urgent) OR ((urgent_activated_at IS NOT NULL) AND (urgent_expires_at IS NOT NULL) AND (urgent_expires_at > urgent_activated_at))))","TRIGGER DEFERRABLE INITIALLY DEFERRED"]}],"closure":{"sourceReady":false,"schemaDigest":"7923a76b5add2e56f2ded9a173dd1638baa346a8742877cecb23aaf634229d50","sourceDigest":"acf469c343e33c4126ca96853b4461c8dcdf7271cc22fb36464cc506006dd6ab","storedSource":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","erasureDigest":"24613a2985b790b6fa4445b021861a2bf25e7bb44d907da148900870bdccb11c","storedErasure":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb"}}$environment$::jsonb;
if observed is distinct from expected then raise exception 'WORKER_APPLICATION_AREAS_PREIMAGE_ENVIRONMENT_DRIFT' using errcode='55000'; end if;
execute $worker_application_areas_ddl$CREATE OR REPLACE FUNCTION public.rpc_submit_response(p_need_id uuid, p_need_revision integer, p_worker_profile_id uuid, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text, p_client_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_location_ready boolean := false;
  u uuid := auth.uid();
  n public.needs;
  v_profile public.app_profiles;
  v_resp public.marketplace_responses;
  v_command private.response_submit_commands;
  v_match jsonb;
  v_content_hash text;
  v_request_hash text;
  v_result jsonb;
  v_version integer;
  v_selected_slots integer := 0;
  v_remaining_slots integer := 0;
begin
  if u is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;

  if p_client_request_id is null
     or char_length(btrim(p_client_request_id)) not between 8 and 200 then
    raise exception using errcode='22023', message='INVALID_CLIENT_REQUEST_ID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(u::text || ':' || p_client_request_id, 7241)
  );

  -- Bind only the semantic client command. Server-derived profile/Need snapshot
  -- intentionally does not enter the request hash, so a retry after a committed
  -- response replays the exact first result even if current context later moves.
  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'needId', p_need_id,
    'needRevision', p_need_revision,
    'workerProfileId', p_worker_profile_id,
    'coveredSlots', p_covered_slots,
    'priceRsd', p_price_rsd,
    'proposedStartAt', p_proposed_start_at,
    'proposedEndAt', p_proposed_end_at,
    'scopeNote', coalesce(p_scope_note, '')
  )::text, 'UTF8')), 'hex');

  select * into v_command
    from private.response_submit_commands c
   where c.worker_account_id = u
     and c.client_request_id = p_client_request_id;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_command.result || jsonb_build_object('idempotentReplay', true);
  end if;

  -- Shared mutation lock order remains Need first.
  select * into n
    from public.needs
   where id = p_need_id
   for update;

  if not found then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;

  if not private.accounts_same_world(n.requester_account_id, u) then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;

  select * into v_command
    from private.response_submit_commands c
   where c.worker_account_id = u
     and c.client_request_id = p_client_request_id
   for update;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_command.result || jsonb_build_object('idempotentReplay', true);
  end if;

  if n.status not in ('PUBLISHED','SELECTION') then
    raise exception using errcode='22023', message='NEED_NOT_OPEN';
  end if;

  if n.requester_account_id = u then
    raise exception using errcode='42501', message='OWN_NEED';
  end if;

  if n.response_deadline is not null
     and n.response_deadline <= statement_timestamp() then
    raise exception using errcode='22023', message='RESPONSE_WINDOW_EXPIRED';
  end if;

  -- New work uses the same actual task-time boundary as search/dispatch.
  -- Replay already returned above; evaluate after the Need lock was acquired.
  if not private.need_search_time_admitted_v1(n.id,clock_timestamp()) then
    raise exception 'NEED_EXECUTION_WINDOW_EXPIRED' using errcode='PT409',
      hint='Vreme za ovaj zadatak je isteklo.';
  end if;

  if n.revision is distinct from p_need_revision then
    raise exception using errcode='P0001', message='STALE_REVIEW_REQUIRED';
  end if;

  -- Lock the current Worker profile after the Need. ACTIVE alone is not enough
  -- for legacy rows: P0C-02 rechecks the exact RU-1 minimum readiness facts.
  select * into v_profile
    from public.app_profiles p
   where p.id = p_worker_profile_id
   for update;

  if not found
     or v_profile.account_id <> u
     or v_profile.kind <> 'WORKER' then
    raise exception using errcode='42501', message='PROFILE_NOT_OWNED_BY_ACCOUNT';
  end if;

  IF v_profile.profile_status='ACTIVE'
    AND char_length(btrim(coalesce(v_profile.display_name,'')))>=2
    AND cardinality(coalesce(v_profile.skills,'{}'))>=1 THEN
  -- An ACTIVE worker can have saved work areas without a legacy city.
  -- Read only the existing owned Save projection; invalid areas fail closed.
  v_location_ready := char_length(btrim(coalesce(v_profile.city,''))) >= 2
    OR private.worker_remote_only_activation_ready_v1(v_profile.account_id,v_profile.skills) IS TRUE;
  IF v_location_ready IS NOT TRUE THEN
    BEGIN
      v_location_ready := jsonb_array_length(private.validate_worker_areas_v1(
        private.worker_saved_areas_v1(v_profile.account_id))) > 0;
    EXCEPTION WHEN SQLSTATE '22023' THEN
      v_location_ready := false;
    END;
  END IF;
  END IF;
  if v_profile.profile_status <> 'ACTIVE'
     or char_length(btrim(v_profile.display_name)) < 2
     or v_location_ready IS NOT TRUE
     or cardinality(v_profile.skills) < 1 then
    raise exception using errcode='P0001', message='WORKER_PROFILE_NOT_READY';
  end if;

  select coalesce(sum(s.covered_slots), 0)::integer
    into v_selected_slots
    from public.need_selections s
   where s.need_id = n.id
     and s.status = 'SELECTED';

  v_remaining_slots := greatest(0, n.required_slots - v_selected_slots);

  if v_remaining_slots < 1 then
    raise exception using errcode='P0001', message='NEED_FULL';
  end if;

  if p_covered_slots is null or p_covered_slots < 1 then
    raise exception using errcode='22023', message='INVALID_COVERED_SLOTS';
  end if;

  -- WPP01: people are committed per offer; the personal profile is not a team limit.
  -- Existing remaining-slot and pricing checks below remain authoritative.

  if p_covered_slots > v_remaining_slots then
    raise exception using
      errcode='22023',
      message='NEED_REMAINING_CAPACITY_EXCEEDED',
      detail=format('covered=%s,remaining=%s', p_covered_slots, v_remaining_slots);
  end if;

  perform private.assert_application_price_v5(n, p_covered_slots, p_price_rsd);

  if (p_proposed_start_at is null) <> (p_proposed_end_at is null)
     or (
       p_proposed_start_at is not null
       and p_proposed_end_at is not null
       and p_proposed_start_at >= p_proposed_end_at
     ) then
    raise exception using errcode='22023', message='INVALID_PROPOSED_INTERVAL';
  end if;

  if exists (
    select 1
      from public.marketplace_responses r
     where r.need_id = p_need_id
       and r.worker_account_id = u
       and (
         r.status = 'SELECTED'
         or exists (
           select 1
             from public.agreements a
            where a.selected_response_id = r.id
              and a.status in ('CONFIRMED','SUPERSEDED','COMPLETED')
         )
       )
  ) then
    raise exception using errcode='P0001', message='RESPONSE_ALREADY_SELECTED';
  end if;

  if p_proposed_start_at is null and n.schedule_kind='FIXED_WINDOW'
    and (n.starts_at is null or not isfinite(n.starts_at)
      or (n.ends_at is not null and (not isfinite(n.ends_at) or n.starts_at>=n.ends_at))) then
    raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
  end if;
  -- Start-only appointment cannot accept a new offer after its start while lifecycle tick catches up.
  if n.schedule_kind='FIXED_WINDOW' and n.ends_at is null
     and n.starts_at is not null and n.starts_at<=statement_timestamp() then
    raise exception 'FIXED_WINDOW_START_PASSED' using errcode='22023';
  end if;
  v_match := private.match_detail_for_calendar_interval(p_need_id, p_worker_profile_id,
    coalesce(p_proposed_start_at,case when n.schedule_kind='FIXED_WINDOW' and n.ends_at is not null then n.starts_at end),
    coalesce(p_proposed_end_at,case when n.schedule_kind='FIXED_WINDOW' and n.ends_at is not null then n.ends_at end));
  if not coalesce((v_match->>'responseAllowed')::boolean, false) then
    raise exception using
      errcode='P0001',
      message='WORKER_NOT_ELIGIBLE',
      detail=coalesce((v_match->'hardBlockers')::text, '[]');
  end if;

  select * into v_resp
    from public.marketplace_responses r
   where r.need_id = p_need_id
     and r.worker_account_id = u
     and r.status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
   order by r.created_at desc
   limit 1
   for update;

  -- Content identity includes the server-derived self-declared capability/team
  -- snapshot. It is not public trust/verification and is never copied into the
  -- global public profile DTO.
  v_content_hash := encode(sha256(convert_to(jsonb_build_object(
    'needRevision', n.revision,
    'pricingMode', n.mode,
    'applicationPriceBasis', (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
    'currency', 'RSD',
    'priceRsd', p_price_rsd,
    'coveredSlots', p_covered_slots,
    'proposedStartAt', p_proposed_start_at,
    'proposedEndAt', p_proposed_end_at,
    'scopeNote', coalesce(btrim(p_scope_note), ''),
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'workerTeamCapacity', v_profile.team_capacity,
    'workerSkills', to_jsonb(v_profile.skills),
    'workerTools', '[]'::jsonb,
    'workerLicenses', to_jsonb(v_profile.licenses),
    'workerVehicles', '[]'::jsonb
  )::text, 'UTF8')), 'hex');

  if v_resp.id is null then
    insert into public.marketplace_responses (
      need_id, worker_account_id, worker_profile_id, response_kind, status,
      submitted_against_need_revision, current_version, covered_slots,
      price_rsd, price_basis, proposed_start_at, proposed_end_at, scope_note, submitted_at
    ) values (
      p_need_id, u, p_worker_profile_id, 'OFFER', 'SUBMITTED', n.revision, 1,
      p_covered_slots, p_price_rsd, (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end), p_proposed_start_at, p_proposed_end_at,
      coalesce(p_scope_note, ''), statement_timestamp()
    )
    returning * into v_resp;
    v_version := 1;
  else
    v_version := v_resp.current_version + 1;
    update public.marketplace_responses
       set current_version = v_version,
           status = 'SUBMITTED',
           submitted_against_need_revision = n.revision,
           covered_slots = p_covered_slots,
           price_rsd = p_price_rsd,
           price_basis = (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
           proposed_start_at = p_proposed_start_at,
           proposed_end_at = p_proposed_end_at,
           scope_note = coalesce(p_scope_note, ''),
           submitted_at = statement_timestamp(),
           withdrawn_at = null
     where id = v_resp.id
     returning * into v_resp;
  end if;

  insert into public.marketplace_response_versions (
    response_id, version, need_revision, covered_slots, price_rsd, price_basis,
    proposed_start_at, proposed_end_at, scope_note, content_hash
  ) values (
    v_resp.id, v_version, n.revision, p_covered_slots, p_price_rsd, (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
    p_proposed_start_at, p_proposed_end_at, coalesce(p_scope_note, ''),
    v_content_hash
  );

  insert into private.response_application_snapshots (
    response_id, response_version, snapshot_schema,
    worker_profile_id, worker_team_capacity, covered_slots,
    need_required_slots, need_selected_slots_before_submit,
    need_remaining_slots_before_submit, pricing_mode, requester_price_rsd,
    worker_skills, worker_tools, worker_licenses, worker_vehicles
  ) values (
    v_resp.id, v_version, 'APPLICATION_V1_SELF_DECLARED',
    v_profile.id, v_profile.team_capacity, p_covered_slots,
    n.required_slots, v_selected_slots, v_remaining_slots,
    n.mode, n.requester_price_rsd,
    v_profile.skills, '{}'::text[], v_profile.licenses, '{}'::text[]
  );

  update public.opportunity_deliveries
     set status = 'RESPONDED',
         responded_at = statement_timestamp()
   where need_id = p_need_id
     and need_revision = n.revision
     and worker_account_id = u
     and status in ('READY','SEEN');

  v_result := jsonb_build_object(
    'responseId', v_resp.id,
    'applicationId', v_resp.id,
    'version', v_version,
    'needRevision', n.revision,
    'contentHash', v_content_hash,
    'status', v_resp.status,
    'pricingMode', n.mode,
    'applicationPriceBasis', (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
    'currency', 'RSD',
    'coveredSlots', p_covered_slots,
    'priceRsd', p_price_rsd,
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'authoritative', true,
    'idempotentReplay', false
  );

  insert into private.response_submit_commands (
    worker_account_id, client_request_id, request_hash,
    response_id, response_version, result
  ) values (
    u, p_client_request_id, v_request_hash,
    v_resp.id, v_version, v_result
  );

  -- PRE-V3: persisted version trigger owns Application semantic events.

  return v_result;
end;
$function$$worker_application_areas_ddl$;
execute $worker_application_areas_ddl$CREATE OR REPLACE FUNCTION public.rpc_select_response(p_need_id uuid, p_need_revision integer, p_response_id uuid, p_response_version integer, p_content_hash text, p_client_request_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_location_ready boolean := false;
  uid uuid := auth.uid();
  v_need public.needs%rowtype;
  v_resp public.marketplace_responses%rowtype;
  v_ver public.marketplace_response_versions%rowtype;
  v_price_snapshot private.response_application_snapshots%rowtype;
  v_requested_ver public.marketplace_response_versions%rowtype;
  v_profile public.app_profiles%rowtype;
  v_command private.selection_commands%rowtype;
  v_policy private.connection_policy_versions%rowtype;
  v_selection_id uuid;
  v_agreement_id uuid;
  v_covered integer;
  v_terms jsonb;
  v_match jsonb;
  v_request_hash text;
  v_legacy_selected_by uuid;
  v_legacy_need_revision integer;
  v_legacy_response_id uuid;
  v_legacy_covered_slots integer;
  v_legacy_agreement_id uuid;
  v_legacy_response_version integer;
  v_legacy_content_hash text;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_client_request_id is null
     or char_length(btrim(p_client_request_id)) not between 8 and 200 then
    raise exception 'INVALID_CLIENT_REQUEST_ID' using errcode = '22023';
  end if;

  select * into v_requested_ver
    from public.marketplace_response_versions
   where response_id = p_response_id
     and version = p_response_version;

  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'requesterAccountId', uid,
    'needId', p_need_id,
    'needRevision', p_need_revision,
    'responseId', p_response_id,
    'responseVersion', p_response_version,
    'contentHash', p_content_hash,
    'coveredSlots', v_requested_ver.covered_slots
  )::text, 'UTF8')), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':' || p_client_request_id, 7242)
  );

  select * into v_command
    from private.selection_commands c
   where c.requester_account_id = uid
     and c.client_request_id = p_client_request_id;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return v_command.agreement_id;
  end if;

  -- Pre-P0D-02/P0D-03 historical rows remain authoritative and are not
  -- retroactively charged or given fabricated activation receipts.
  select s.selected_by_account_id,
         s.need_revision,
         s.response_id,
         s.covered_slots,
         a.id,
         nullif(av.terms->>'response_version','')::integer,
         av.content_hash
    into v_legacy_selected_by,
         v_legacy_need_revision,
         v_legacy_response_id,
         v_legacy_covered_slots,
         v_legacy_agreement_id,
         v_legacy_response_version,
         v_legacy_content_hash
    from public.need_selections s
    join public.agreements a on a.selection_id = s.id
    left join public.agreement_versions av
      on av.agreement_id = a.id and av.version = 1
   where s.need_id = p_need_id
     and s.client_request_id = p_client_request_id;

  if found then
    if v_legacy_selected_by <> uid then
      raise exception 'NOT_REQUESTER' using errcode = '42501';
    end if;
    if v_legacy_need_revision <> p_need_revision
       or v_legacy_response_id is distinct from p_response_id
       or (v_requested_ver.response_id is not null
           and v_legacy_covered_slots <> v_requested_ver.covered_slots)
       or (v_legacy_response_version is not null
           and v_legacy_response_version <> p_response_version)
       or (v_legacy_content_hash is not null
           and v_legacy_content_hash <> p_content_hash) then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return v_legacy_agreement_id;
  end if;

  select * into v_need from public.needs where id = p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_need.requester_account_id <> uid then raise exception 'NOT_REQUESTER' using errcode = '42501'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then
    raise exception 'NEED_NOT_OPEN' using errcode = 'P0001', detail = v_need.status; end if;

  if v_need.response_deadline is not null
     and v_need.response_deadline <= statement_timestamp() then
    raise exception 'RESPONSE_WINDOW_EXPIRED' using errcode = 'P0001', hint = 'Rok za prijave je istekao.';
  end if;

  -- Existing agreements and idempotent selection receipts returned above.
  -- Only a NEW selection is refused after the actual task-time boundary.
  if not private.need_search_time_admitted_v1(v_need.id,clock_timestamp()) then
    raise exception 'NEED_EXECUTION_WINDOW_EXPIRED' using errcode='PT409',
      hint='Vreme za ovaj zadatak je isteklo.';
  end if;

  if v_need.revision <> p_need_revision then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'need_revision',
      hint = 'Potreba je izmenjena. Pogledajte prijave ponovo.'; end if;

  select * into v_resp from public.marketplace_responses where id = p_response_id for update;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_resp.need_id <> p_need_id then raise exception 'RESPONSE_NEED_MISMATCH' using errcode = 'P0001'; end if;
  if v_resp.status not in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then
    raise exception 'RESPONSE_NOT_SELECTABLE' using errcode = 'P0001', detail = v_resp.status; end if;

  if v_resp.current_version <> p_response_version then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'response_version',
      hint = 'Uskocer je izmenio prijavu. Proverite je ponovo.'; end if;

  select * into v_ver from public.marketplace_response_versions
   where response_id = p_response_id and version = p_response_version;
  if not found then raise exception 'RESPONSE_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_ver.content_hash <> p_content_hash then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'content_hash',
      hint = 'Uslovi prijave su izmenjeni.'; end if;
  if v_ver.need_revision <> v_need.revision then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'response_need_revision'; end if;

  select * into v_profile
    from public.app_profiles p
   where p.id = v_resp.worker_profile_id
   for share;

  IF FOUND AND v_profile.kind='WORKER' AND v_profile.account_id=v_resp.worker_account_id AND v_profile.profile_status='ACTIVE'
    AND char_length(btrim(coalesce(v_profile.display_name,'')))>=2
    AND cardinality(coalesce(v_profile.skills,'{}'))>=1 THEN
  -- An ACTIVE worker can have saved work areas without a legacy city.
  -- Read only the existing owned Save projection; invalid areas fail closed.
  v_location_ready := char_length(btrim(coalesce(v_profile.city,''))) >= 2
    OR private.worker_remote_only_activation_ready_v1(v_profile.account_id,v_profile.skills) IS TRUE;
  IF v_location_ready IS NOT TRUE THEN
    BEGIN
      v_location_ready := jsonb_array_length(private.validate_worker_areas_v1(
        private.worker_saved_areas_v1(v_profile.account_id))) > 0;
    EXCEPTION WHEN SQLSTATE '22023' THEN
      v_location_ready := false;
    END;
  END IF;
  END IF;
  if not found
     or v_profile.kind <> 'WORKER'
     or v_profile.account_id <> v_resp.worker_account_id
     or v_profile.profile_status <> 'ACTIVE'
     or char_length(btrim(v_profile.display_name)) < 2
     or v_location_ready IS NOT TRUE
     or cardinality(v_profile.skills) < 1 then
    raise exception 'WORKER_PROFILE_NOT_READY' using errcode = 'P0001',
      hint = 'Uskocer vise nema vazeci spreman profil za izbor.';
  end if;

  -- WPP01: accept the people committed by this offer, subject to the
  -- existing task remaining-slot, calendar and price checks below.

  if (v_ver.proposed_start_at is null)<>(v_ver.proposed_end_at is null) then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  if v_ver.proposed_start_at is null and v_need.schedule_kind='FIXED_WINDOW'
    and (v_need.starts_at is null or not isfinite(v_need.starts_at)
      or (v_need.ends_at is not null and (not isfinite(v_need.ends_at) or v_need.starts_at>=v_need.ends_at))) then
    raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
  end if;
  -- An old start-only task cannot be selected after its precise beginning.
  if v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is null
     and v_need.starts_at is not null and v_need.starts_at<=statement_timestamp() then
    raise exception 'FIXED_WINDOW_START_PASSED' using errcode='22023';
  end if;
  v_match := private.match_detail_for_calendar_interval(p_need_id, v_resp.worker_profile_id,
    coalesce(v_ver.proposed_start_at,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.starts_at end),
    coalesce(v_ver.proposed_end_at,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.ends_at end));
  if not coalesce((v_match->>'responseAllowed')::boolean, false) then
    raise exception 'WORKER_NO_LONGER_ELIGIBLE' using errcode = 'P0001',
      detail = coalesce((v_match->'hardBlockers')::text,'[]'),
      hint = 'Uskocer vise ne ispunjava uslove Potrebe.';
  end if;

  -- Start-only selection must still reject an existing confirmed Dogovor
  -- that blocks the precise declared start. One microsecond is only a
  -- point-overlap probe, NOT a booked duration or task finish.
  if v_ver.proposed_start_at is null and v_need.schedule_kind='FIXED_WINDOW'
     and v_need.ends_at is null and
     private.worker_calendar_conflict(v_resp.worker_profile_id,v_need.starts_at,
       v_need.starts_at+interval '1 microsecond',null) then
    raise exception 'WORKER_CALENDAR_CONFLICT' using errcode='P0001';
  end if;
  v_covered := public.fn_need_covered_slots(p_need_id);
  if v_covered + v_resp.covered_slots > v_need.required_slots then
    raise exception 'OVERFILL' using errcode = 'P0001', hint = 'Ta prijava pokriva vise mesta nego sto je preostalo.'; end if;

  -- PKG-033: historical/reconfirmed offers cannot bypass today's fixed-price rule at selection.
  perform private.assert_application_price_v5(v_need, v_ver.covered_slots, v_ver.price_rsd);
  -- Selection consumes the reviewed immutable application, never a guess
  -- from today's task. Committed old selection receipts already replayed.
  if v_ver.price_basis is null or v_resp.price_basis is null then
    raise exception 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED' using errcode='PT409';
  elsif v_ver.price_basis is distinct from (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end)
     or v_resp.price_basis is distinct from v_ver.price_basis then
    raise exception 'APPLICATION_PRICE_BASIS_CHANGED' using errcode='PT409';
  end if;
  select * into v_price_snapshot from private.response_application_snapshots
    where response_id=v_ver.response_id and response_version=v_ver.version;
  if not found or v_price_snapshot.pricing_mode is distinct from v_need.mode
     or v_price_snapshot.covered_slots is distinct from v_ver.covered_slots
     or v_price_snapshot.need_required_slots is distinct from v_need.required_slots then
    raise exception 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED' using errcode='PT409';
  end if;

  select * into v_policy
    from private.connection_policy_versions
   where policy_key='REQUESTER_SELECTION_V1' and version=1;
  if not found
     or v_policy.beneficiary_role <> 'REQUESTER'
     or v_policy.activation_reason <> 'SELECTION'
     or v_policy.charge_mode <> 'PROMOTIONAL_FREE'
     or v_policy.unit_basis <> 'HEADCOUNT'
     or v_policy.platform_cost_rsd <> 0 then
    raise exception 'CONNECTION_POLICY_NOT_READY' using errcode='55000';
  end if;

  insert into public.need_selections(
    need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,
    response_id,worker_account_id,worker_profile_id,selection_mode,status
  ) values (
    p_need_id,v_need.revision,uid,p_client_request_id,v_resp.covered_slots,
    p_response_id,v_resp.worker_account_id,v_resp.worker_profile_id,
    case when v_need.mode='FASTEST' then 'AUTO_FILL' else 'REQUESTER_SELECTS' end,
    'SELECTED'
  ) returning id into v_selection_id;

  v_terms := jsonb_build_object(
    'price_rsd',v_ver.price_rsd,'priceBasis',v_ver.price_basis,'currency','RSD',
    'pricingMode',v_price_snapshot.pricing_mode,
    'required_slots',v_price_snapshot.need_required_slots,'covered_slots',v_ver.covered_slots,
    -- Agreement calendar terms stay an honest complete pair or BOTH NULL.
    -- A declared start-only moment stays authoritative on the task; it is
    -- not a fabricated booking in private.agreement_calendar_interval().
    'proposed_start_at',coalesce(v_ver.proposed_start_at,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.starts_at end),
    'proposed_end_at',coalesce(v_ver.proposed_end_at,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.ends_at end),
    'schedule_source',case when v_ver.proposed_start_at is not null then 'APPLICATION_PROPOSAL'
      when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then 'NEED_FIXED_WINDOW' else 'UNSCHEDULED' end,
    'scope_note',v_ver.scope_note,'need_revision',v_need.revision,
    'response_version',v_ver.version
  );
  -- Snapshot the requested exact start separately from the calendar reservation.
  -- Calendar interval uses ONLY a complete proposed_start_at/proposed_end_at pair.
  if v_ver.proposed_start_at is null and v_need.schedule_kind='FIXED_WINDOW'
     and v_need.ends_at is null and v_need.starts_at is not null then
    v_terms:=v_terms||jsonb_build_object('declared_start_at',v_need.starts_at);
  end if;

  insert into public.agreements(
    need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,
    worker_account_id,worker_profile_id,current_version,status
  ) values (
    p_need_id,v_selection_id,p_response_id,v_need.requester_account_id,v_need.requester_profile_id,
    v_resp.worker_account_id,v_resp.worker_profile_id,1,'CONFIRMED'
  ) returning id into v_agreement_id;

  insert into public.agreement_versions(
    agreement_id,version,status,terms,content_hash,created_by_account_id
  ) values (v_agreement_id,1,'CONFIRMED',v_terms,v_ver.content_hash,uid);

  insert into public.agreement_execution(agreement_id,agreement_version,mode,state)
  values (
    v_agreement_id,1,
    -- PKG-029b (deep read 12.7): remote or physical follows the place; the schedule decides only for a task
    -- written before the place had a mode.
    case when coalesce(v_need.execution_location_mode = 'REMOTE', v_need.schedule_kind = 'REMOTE_ANYTIME')
      then 'REMOTE' else 'PHYSICAL' end,
    'CONFIRMED'
  );

  insert into private.connection_activations(
    requester_account_id,beneficiary_account_id,client_request_id,request_hash,
    policy_key,policy_version,policy_snapshot,activation_reason,
    need_id,need_revision,selection_id,agreement_id,response_id,response_version,
    response_content_hash,worker_account_id,worker_profile_id,units,platform_cost_rsd,state
  ) values (
    uid,uid,p_client_request_id,v_request_hash,
    v_policy.policy_key,v_policy.version,v_policy.policy_snapshot,'SELECTION',
    p_need_id,p_need_revision,v_selection_id,v_agreement_id,p_response_id,p_response_version,
    p_content_hash,v_resp.worker_account_id,v_resp.worker_profile_id,v_ver.covered_slots,0,'SATISFIED'
  );

  update public.marketplace_responses
     set status='SELECTED',selected_at=statement_timestamp()
   where id=p_response_id;

  perform set_config('uskoci.need_lifecycle','SELECT',true);
  update public.needs
     set status=case when v_covered+v_resp.covered_slots >= v_need.required_slots
                     then 'ACTIVE' else 'SELECTION' end
   where id=p_need_id;

  insert into private.selection_commands(
    requester_account_id,client_request_id,request_hash,
    need_id,need_revision,response_id,response_version,
    response_content_hash,covered_slots,selection_id,agreement_id
  ) values (
    uid,p_client_request_id,v_request_hash,
    p_need_id,p_need_revision,p_response_id,p_response_version,
    p_content_hash,v_ver.covered_slots,v_selection_id,v_agreement_id
  );

  -- N02: domain event shares the Selection/Agreement/activation transaction.
  -- Preferences, suppression and channel dedupe remain owned by emit_event.
  perform private.emit_event(
    v_resp.worker_account_id, 'WORKER', 'RESPONSE_SELECTED',
    'RESPONSE', v_resp.id, v_ver.version,
    'Vaša prijava je izabrana', 'Otvorite Dogovor za detalje zadatka.',
    'response_selected:' || v_selection_id::text,
    'NORMAL', jsonb_build_object('agreement_id', v_agreement_id, 'need_id', v_need.id)
  );

  return v_agreement_id;
end;
$function$$worker_application_areas_ddl$;
execute $worker_application_areas_ddl$CREATE OR REPLACE FUNCTION public.rpc_resolve_stale_response_after_need_edit(p_response_id uuid, p_expected_response_version integer, p_expected_need_revision integer, p_client_request_id text, p_action text, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_location_ready boolean := false;
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id,''));
  v_action text := upper(btrim(coalesce(p_action,'')));
  v_request_hash text;
  v_existing private.response_revision_resolution_commands%rowtype;
  v_need_id uuid;
  v_need public.needs%rowtype;
  v_response public.marketplace_responses%rowtype;
  v_match jsonb;
  v_profile public.app_profiles;
  v_selected_slots integer;
  v_remaining_slots integer;
  v_new_version integer;
  v_covered integer;
  v_price integer;
  v_start timestamptz;
  v_end timestamptz;
  v_note text;
  v_content_hash text;
  v_result jsonb;
  v_price_review boolean := false;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_response_id is null or p_expected_response_version is null or p_expected_response_version < 1
     or p_expected_need_revision is null or p_expected_need_revision < 1 then
    raise exception 'RESPONSE_VERSION_NEED_REVISION_REQUIRED' using errcode='22023';
  end if;
  if char_length(v_request_id) not between 8 and 200 then raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023'; end if;
  if v_action not in ('KEEP','UPDATE','WITHDRAW') then raise exception 'STALE_RESPONSE_ACTION_INVALID' using errcode='22023'; end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'responseId', p_response_id,
        'expectedResponseVersion', p_expected_response_version,
        'expectedNeedRevision', p_expected_need_revision,
        'action', v_action,
        'coveredSlots', p_covered_slots,
        'priceRsd', p_price_rsd,
        'proposedStartAt', p_proposed_start_at,
        'proposedEndAt', p_proposed_end_at,
        'scopeNote', coalesce(p_scope_note,'')
      )::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || E'\n' || v_request_id, 4405));

  select * into v_existing
    from private.response_revision_resolution_commands c
   where c.worker_account_id = v_actor
     and c.client_request_id = v_request_id
   for update;
  if found then
    if v_existing.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  select r.need_id into v_need_id from public.marketplace_responses r where r.id = p_response_id;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode='P0002'; end if;

  select * into v_need from public.needs n where n.id = v_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;

  select * into v_response from public.marketplace_responses r where r.id = p_response_id for update;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode='P0002'; end if;

  if v_response.worker_account_id <> v_actor then raise exception 'RESPONSE_NOT_OWNED' using errcode='42501'; end if;
  if v_response.current_version <> p_expected_response_version then raise exception 'STALE_REVIEW_REQUIRED' using errcode='PT409'; end if;
  if v_need.revision <> p_expected_need_revision then raise exception 'STALE_REVIEW_REQUIRED' using errcode='PT409'; end if;
  -- A missing immutable unit needs an explicit review even when the task
  -- revision did not change. This is a read state, never a data backfill.
  v_price_review := v_response.price_basis is null
    and v_response.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','STALE','STALE_REVIEW_REQUIRED')
    and v_response.submitted_against_need_revision <= v_need.revision;
  if v_response.status <> 'STALE_REVIEW_REQUIRED' and not v_price_review then
    raise exception 'RESPONSE_NOT_AWAITING_REVIEW' using errcode='P0001';
  end if;
  if v_response.submitted_against_need_revision >= v_need.revision and not v_price_review then
    raise exception 'RESPONSE_ALREADY_CURRENT' using errcode='P0001';
  end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then raise exception 'NEED_NOT_OPEN' using errcode='P0001'; end if;
  if exists (select 1 from public.agreements a where a.selected_response_id = v_response.id) then
    raise exception 'RESPONSE_ALREADY_SELECTED' using errcode='P0001';
  end if;

  if v_action = 'WITHDRAW' then
    update public.notification_deliveries d set state='EXPIRED'
      from public.user_activity_events e
      where d.event_id=e.id and e.entity_type='RESPONSE' and e.entity_id=v_response.id
        and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE');
    update public.marketplace_responses
       set status = 'WITHDRAWN', withdrawn_at = statement_timestamp(), selected_at = null
     where id = v_response.id
     returning * into v_response;

    perform private.emit_event(v_need.requester_account_id,'REQUESTER','RESPONSE_WITHDRAWN',
      'RESPONSE',v_response.id,v_response.current_version,
      'Prijava je povučena','Prijava za tvoj zadatak je povučena.',
      'response-withdrawn:'||v_response.id::text||':'||v_response.current_version::text,
      'NORMAL',jsonb_build_object('needId',v_need.id,'needRevision',v_need.revision),null);
    if (v_need.response_deadline is null or v_need.response_deadline > statement_timestamp())
       and public.fn_need_covered_slots(v_need.id) < v_need.required_slots then
      perform private.enqueue_dispatch(v_need.id,statement_timestamp());
    end if;

    v_result := jsonb_build_object(
      'responseId', v_response.id,
      'needId', v_need.id,
      'needRevision', v_need.revision,
      'version', v_response.current_version,
      'status', v_response.status,
      'action', v_action,
      'idempotentReplay', false,
      'authoritative', true
    );
  else
    -- PKG-033: reconfirmation is an application to today's task, not a bypass.
    -- Withdrawal stays possible without a ready profile or matching world.
    if not private.accounts_same_world(v_need.requester_account_id, v_actor) then
      raise exception 'NEED_NOT_FOUND' using errcode='P0002';
    end if;
    if v_need.response_deadline is not null and v_need.response_deadline <= statement_timestamp() then
      raise exception 'RESPONSE_WINDOW_EXPIRED' using errcode='22023';
    end if;
    -- KEEP/UPDATE is a new application to the current task. WITHDRAW and
    -- committed idempotent replays remain outside this admission check.
    if not private.need_search_time_admitted_v1(v_need.id,clock_timestamp()) then
      raise exception 'NEED_EXECUTION_WINDOW_EXPIRED' using errcode='PT409',
        hint='Vreme za ovaj zadatak je isteklo.';
    end if;
    select * into v_profile from public.app_profiles p
      where p.id = v_response.worker_profile_id for update;
    if not found or v_profile.account_id <> v_actor or v_profile.kind <> 'WORKER' then
      raise exception 'PROFILE_NOT_OWNED_BY_ACCOUNT' using errcode='42501';
    end if;
  IF v_profile.profile_status='ACTIVE'
    AND char_length(btrim(coalesce(v_profile.display_name,'')))>=2
    AND cardinality(coalesce(v_profile.skills,'{}'))>=1 THEN
  -- An ACTIVE worker can have saved work areas without a legacy city.
  -- Read only the existing owned Save projection; invalid areas fail closed.
  v_location_ready := char_length(btrim(coalesce(v_profile.city,''))) >= 2
    OR private.worker_remote_only_activation_ready_v1(v_profile.account_id,v_profile.skills) IS TRUE;
  IF v_location_ready IS NOT TRUE THEN
    BEGIN
      v_location_ready := jsonb_array_length(private.validate_worker_areas_v1(
        private.worker_saved_areas_v1(v_profile.account_id))) > 0;
    EXCEPTION WHEN SQLSTATE '22023' THEN
      v_location_ready := false;
    END;
  END IF;
  END IF;
    if v_profile.profile_status is distinct from 'ACTIVE'
       or char_length(btrim(coalesce(v_profile.display_name,''))) < 2
       or v_location_ready IS NOT TRUE
       or cardinality(coalesce(v_profile.skills,'{}')) < 1 then
      raise exception 'WORKER_PROFILE_NOT_READY' using errcode='P0001';
    end if;
    select coalesce(sum(s.covered_slots),0)::integer into v_selected_slots
      from public.need_selections s where s.need_id=v_need.id and s.status='SELECTED';
    v_remaining_slots := greatest(0, v_need.required_slots-v_selected_slots);
    if v_remaining_slots < 1 then raise exception 'NEED_FULL' using errcode='P0001'; end if;

    if v_action = 'KEEP' then
      -- KEEP never interprets an unknown unit or agrees to a changed unit.
      -- UPDATE is a fresh, user-reviewed version of the same application.
      if v_response.price_basis is null then
        raise exception 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED' using errcode='PT409';
      elsif v_response.price_basis is distinct from (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end) then
        raise exception 'APPLICATION_PRICE_BASIS_CHANGED' using errcode='PT409';
      end if;
      v_covered := v_response.covered_slots;
      v_price := v_response.price_rsd;
      v_start := v_response.proposed_start_at;
      v_end := v_response.proposed_end_at;
      v_note := v_response.scope_note;
    else
      v_covered := p_covered_slots;
      v_price := p_price_rsd;
      v_start := p_proposed_start_at;
      v_end := p_proposed_end_at;
      v_note := coalesce(p_scope_note,'');
    end if;

    if v_covered is null or v_covered < 1 then
      raise exception 'INVALID_COVERED_SLOTS' using errcode='22023';
    end if;
    -- WPP01: no personal-profile team limit; keep the task remaining-slot bound.
    if v_covered > v_remaining_slots then
      raise exception 'NEED_REMAINING_CAPACITY_EXCEEDED' using errcode='22023';
    end if;
    perform private.assert_application_price_v5(v_need, v_covered, v_price);
    if (v_start is null) <> (v_end is null)
       or (v_start is not null and v_end is not null and v_start >= v_end) then
      raise exception 'INVALID_PROPOSED_INTERVAL' using errcode='22023';
    end if;
    if char_length(coalesce(v_note,'')) > 1200 then raise exception 'SCOPE_NOTE_TOO_LONG' using errcode='22023'; end if;
    if v_start is null and v_need.schedule_kind='FIXED_WINDOW'
      and (v_need.starts_at is null or not isfinite(v_need.starts_at)
        or (v_need.ends_at is not null and (not isfinite(v_need.ends_at) or v_need.starts_at>=v_need.ends_at))) then
      raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
    end if;
    v_match := private.match_detail_for_calendar_interval(v_need.id, v_response.worker_profile_id,
      coalesce(v_start,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.starts_at end),
      coalesce(v_end,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.ends_at end));
    if not coalesce((v_match->>'responseAllowed')::boolean,false) then
      raise exception 'WORKER_NOT_ELIGIBLE' using errcode='P0001', detail=coalesce((v_match->'hardBlockers')::text,'[]');
    end if;

  v_content_hash := encode(sha256(convert_to(jsonb_build_object(
    'needRevision', v_need.revision,
    'pricingMode', v_need.mode,
    'applicationPriceBasis', (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
    'currency', 'RSD',
    'priceRsd', v_price,
    'coveredSlots', v_covered,
    'proposedStartAt', v_start,
    'proposedEndAt', v_end,
    'scopeNote', coalesce(btrim(v_note), ''),
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'workerTeamCapacity', v_profile.team_capacity,
    'workerSkills', to_jsonb(v_profile.skills),
    'workerTools', '[]'::jsonb,
    'workerLicenses', to_jsonb(v_profile.licenses),
    'workerVehicles', '[]'::jsonb
  )::text, 'UTF8')), 'hex');

    v_new_version := v_response.current_version + 1;

    update public.marketplace_responses
       set current_version = v_new_version,
           status = 'SUBMITTED',
           submitted_against_need_revision = v_need.revision,
           covered_slots = v_covered,
           price_rsd = v_price,
           price_basis = (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
           proposed_start_at = v_start,
           proposed_end_at = v_end,
           scope_note = coalesce(v_note,''),
           submitted_at = statement_timestamp(),
           withdrawn_at = null,
           selected_at = null
     where id = v_response.id
     returning * into v_response;

    insert into public.marketplace_response_versions(
      response_id, version, need_revision, covered_slots, price_rsd, price_basis,
      proposed_start_at, proposed_end_at, scope_note, content_hash
    ) values (
      v_response.id, v_new_version, v_need.revision, v_covered, v_price, (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
      v_start, v_end, coalesce(v_note,''), v_content_hash
    );

  insert into private.response_application_snapshots (
    response_id, response_version, snapshot_schema,
    worker_profile_id, worker_team_capacity, covered_slots,
    need_required_slots, need_selected_slots_before_submit,
    need_remaining_slots_before_submit, pricing_mode, requester_price_rsd,
    worker_skills, worker_tools, worker_licenses, worker_vehicles
  ) values (
    v_response.id, v_new_version, 'APPLICATION_V1_SELF_DECLARED',
    v_profile.id, v_profile.team_capacity, v_covered,
    v_need.required_slots, v_selected_slots, v_remaining_slots,
    v_need.mode, v_need.requester_price_rsd,
    v_profile.skills, '{}'::text[], v_profile.licenses, '{}'::text[]
  );


    v_result := jsonb_build_object(
      'responseId', v_response.id,
      'needId', v_need.id,
      'needRevision', v_need.revision,
      'version', v_new_version,
      'contentHash', v_content_hash,
      'applicationPriceBasis', (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
      'currency', 'RSD',
      'pricingMode', v_need.mode,
      'priceRsd', v_price,
      'coveredSlots', v_covered,
      'status', v_response.status,
      'action', v_action,
      'idempotentReplay', false,
      'authoritative', true
    );
  end if;

  perform private.audit_marketplace(
    v_actor,
    case when v_action='WITHDRAW' then 'STALE_RESPONSE_WITHDRAWN' else 'STALE_RESPONSE_RECONFIRMED' end,
    'RESPONSE',
    v_response.id,
    v_response.current_version,
    jsonb_build_object('needId',v_need.id,'needRevision',v_need.revision,'action',v_action)
  );

  insert into private.response_revision_resolution_commands(
    worker_account_id, client_request_id, request_hash, response_id, result
  ) values (v_actor, v_request_id, v_request_hash, v_response.id, v_result);

  return v_result;
end;
$function$$worker_application_areas_ddl$;
for f in select value from jsonb_array_elements($expected$[{"oid":24205,"signature":"private.closure_erasure_program_digest_v5()","body_md5":"e6ec1acf0f08f19847b5e342f82f32b2","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"","result":"text","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":23565,"signature":"private.closure_schema_digest_v5_139()","body_md5":"988b9d3ab9c0dc7341cd30a391184e40","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"","result":"text","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":23194,"signature":"private.closure_source_digest_v5()","body_md5":"41e54d223122b58decd25cf66191470a","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"","result":"text","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":32708,"signature":"private.validate_worker_areas_v1(jsonb)","body_md5":"8f1cd592eb48eb9da31e0af02c0bdd2e","definer":false,"volatility":"i","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"areas jsonb","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":33216,"signature":"private.worker_remote_only_activation_ready_v1(uuid,text[])","body_md5":"e6b5ddedcf9ab407fdb4cc1290261cff","definer":false,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_account uuid, p_skills text[]","result":"boolean","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":32706,"signature":"private.worker_saved_areas_v1(uuid)","body_md5":"f8bf79ee54bd283d226e607d51e89291","definer":true,"volatility":"s","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"arguments":"aid uuid","result":"jsonb","kind":"f","language":"sql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":21401,"signature":"rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamp with time zone,timestamp with time zone,text)","body_md5":"91bd47ffdb1f0460c28f84815b6f1459","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_response_id uuid, p_expected_response_version integer, p_expected_need_revision integer, p_client_request_id text, p_action text, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":18060,"signature":"rpc_select_response(uuid,integer,uuid,integer,text,text)","body_md5":"44ae50092bad09e66438afec2715c1db","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=public, pg_temp"],"arguments":"p_need_id uuid, p_need_revision integer, p_response_id uuid, p_response_version integer, p_content_hash text, p_client_request_id text","result":"uuid","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null},{"oid":20726,"signature":"rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)","body_md5":"ad117da224ba9e4a3f7d70611aeaa6d8","definer":true,"volatility":"v","is_strict":false,"leakproof":false,"parallel":"u","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":["search_path=pg_catalog"],"arguments":"p_need_id uuid, p_need_revision integer, p_worker_profile_id uuid, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text, p_client_request_id text","result":"jsonb","kind":"f","language":"plpgsql","cost":100,"rows":0,"support":"-","argument_defaults":null}]$expected$::jsonb) loop
 select jsonb_build_object('signature',f->>'signature','oid',p.oid::bigint,'body_md5',md5(p.prosrc),'definer',p.prosecdef,'volatility',p.provolatile,
 'is_strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,'owner',pg_get_userbyid(p.proowner),
 'acl',p.proacl::text,'config',p.proconfig,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),
 'kind',p.prokind,'language',l.lanname,'cost',p.procost,'rows',p.prorows,'support',p.prosupport::text,'argument_defaults',pg_get_expr(p.proargdefaults,0))
 into actual from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(f->>'signature');
 if actual is distinct from f then raise exception 'WORKER_APPLICATION_AREAS_FUNCTION_DRIFT: %',f->>'signature' using errcode='55000'; end if;
end loop;
select jsonb_build_object('relations',(select jsonb_agg(jsonb_build_object(
'name',n.nspname||'.'||c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
'constraints',(select coalesce(jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname),'[]'::jsonb) from pg_constraint k where k.conrelid=c.oid),
'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'roles',p.polroles::text,'permissive',p.polpermissive,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname),'[]'::jsonb) from pg_policy p where p.polrelid=c.oid)) order by n.nspname,c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.oid=any(array['private.response_application_snapshots'::regclass,'private.response_revision_resolution_commands'::regclass,'private.response_submit_commands'::regclass,'private.selection_commands'::regclass,'private.worker_ai_reviews'::regclass,'private.worker_ai_saves'::regclass,'public.agreement_versions'::regclass,'public.agreements'::regclass,'public.app_profiles'::regclass,'public.marketplace_response_versions'::regclass,'public.marketplace_responses'::regclass,'public.need_selections'::regclass,'public.needs'::regclass])),
'closure',jsonb_build_object('storedSource',(select sha256 from private.closure_source_v5 where singleton),
'storedErasure',(select sha256 from private.closure_erasure_source_v5 where singleton),
'sourceDigest',private.closure_source_digest_v5(),'schemaDigest',private.closure_schema_digest_v5_139(),
'erasureDigest',private.closure_erasure_program_digest_v5(),
'sourceReady',(select sha256 from private.closure_source_v5 where singleton)=private.closure_source_digest_v5())) into observed;
expected:=$environment${"relations":[{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.response_application_snapshots","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK (((need_remaining_slots_before_submit >= 1) AND (need_remaining_slots_before_submit <= 50)))","CHECK (((need_selected_slots_before_submit >= 0) AND (need_selected_slots_before_submit <= 50)))","FOREIGN KEY (response_id, response_version) REFERENCES marketplace_response_versions(response_id, version) ON DELETE CASCADE","CHECK (((covered_slots >= 1) AND (covered_slots <= 50)))","CHECK (((need_required_slots >= 1) AND (need_required_slots <= 50)))","PRIMARY KEY (response_id, response_version)","CHECK ((pricing_mode = ANY (ARRAY['MY_PRICE'::text, 'OFFERS'::text])))","CHECK (((requester_price_rsd IS NULL) OR (requester_price_rsd > 0)))","CHECK ((response_version >= 1))","CHECK ((snapshot_schema = 'APPLICATION_V1_SELF_DECLARED'::text))","FOREIGN KEY (worker_profile_id) REFERENCES app_profiles(id) ON DELETE RESTRICT","CHECK (((worker_team_capacity >= 1) AND (worker_team_capacity <= 50)))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.response_revision_resolution_commands","owner":"postgres","forceRls":true,"policies":[],"constraints":["PRIMARY KEY (worker_account_id, client_request_id)","FOREIGN KEY (response_id) REFERENCES marketplace_responses(id) ON DELETE RESTRICT","FOREIGN KEY (worker_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text))","CHECK (((char_length(btrim(client_request_id)) >= 8) AND (char_length(btrim(client_request_id)) <= 200)))","CHECK ((jsonb_typeof(result) = 'object'::text))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.response_submit_commands","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK (((char_length(btrim(client_request_id)) >= 8) AND (char_length(btrim(client_request_id)) <= 200)))","PRIMARY KEY (worker_account_id, client_request_id)","CHECK ((char_length(request_hash) = 64))","FOREIGN KEY (response_id, response_version) REFERENCES marketplace_response_versions(response_id, version) ON DELETE CASCADE","CHECK ((response_version >= 1))"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.selection_commands","owner":"postgres","forceRls":false,"policies":[],"constraints":["FOREIGN KEY (agreement_id) REFERENCES agreements(id) ON DELETE RESTRICT","UNIQUE (agreement_id)","CHECK (((char_length(btrim(client_request_id)) >= 8) AND (char_length(btrim(client_request_id)) <= 200)))","CHECK (((covered_slots >= 1) AND (covered_slots <= 50)))","FOREIGN KEY (need_id) REFERENCES needs(id) ON DELETE RESTRICT","CHECK ((need_revision >= 1))","PRIMARY KEY (requester_account_id, client_request_id)","CHECK ((char_length(request_hash) = 64))","FOREIGN KEY (requester_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","CHECK ((char_length(response_content_hash) = 64))","CHECK ((response_version >= 1))","FOREIGN KEY (response_id, response_version) REFERENCES marketplace_response_versions(response_id, version) ON DELETE RESTRICT","FOREIGN KEY (selection_id) REFERENCES need_selections(id) ON DELETE RESTRICT","UNIQUE (selection_id)"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_reviews","owner":"postgres","forceRls":false,"policies":[],"constraints":["CHECK ((octet_length((envelope)::text) <= 524288))","PRIMARY KEY (id)"]},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"private.worker_ai_saves","owner":"postgres","forceRls":false,"policies":[],"constraints":["UNIQUE (account_id, client_request_id)","PRIMARY KEY (review_id)","FOREIGN KEY (review_id) REFERENCES private.worker_ai_reviews(id)"]},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.agreement_versions","owner":"postgres","forceRls":false,"policies":[{"name":"agreement_versions_read","check":null,"roles":"{16485}","using":"(EXISTS ( SELECT 1\n   FROM agreements a\n  WHERE ((a.id = agreement_versions.agreement_id) AND ((a.requester_account_id = ( SELECT auth.uid() AS uid)) OR (a.worker_account_id = ( SELECT auth.uid() AS uid))))))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["FOREIGN KEY (agreement_id) REFERENCES agreements(id) ON DELETE CASCADE","CHECK (((supersedes_version IS NULL) OR (supersedes_version < version)))","CHECK ((char_length(content_hash) >= 16))","FOREIGN KEY (created_by_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","PRIMARY KEY (agreement_id, version)","CHECK ((status = ANY (ARRAY['CONFIRMED'::text, 'SUPERSEDED'::text, 'CANCELLED'::text])))","CHECK ((version >= 1))"]},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.agreements","owner":"postgres","forceRls":false,"policies":[{"name":"agreements_parties_read","check":null,"roles":"{16485}","using":"((requester_account_id = ( SELECT auth.uid() AS uid)) OR (worker_account_id = ( SELECT auth.uid() AS uid)))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["CHECK ((current_version >= 1))","FOREIGN KEY (need_id) REFERENCES needs(id) ON DELETE RESTRICT","PRIMARY KEY (id)","FOREIGN KEY (requester_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","FOREIGN KEY (requester_profile_id) REFERENCES app_profiles(id) ON DELETE RESTRICT","TRIGGER DEFERRABLE INITIALLY DEFERRED","FOREIGN KEY (selected_response_id) REFERENCES marketplace_responses(id) ON DELETE RESTRICT","UNIQUE (selected_response_id)","FOREIGN KEY (selection_id) REFERENCES need_selections(id) ON DELETE RESTRICT","UNIQUE (selection_id)","CHECK ((status = ANY (ARRAY['CONFIRMED'::text, 'SUPERSEDED'::text, 'CANCELLED'::text, 'COMPLETED'::text])))","FOREIGN KEY (worker_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","FOREIGN KEY (worker_profile_id) REFERENCES app_profiles(id) ON DELETE RESTRICT"]},{"acl":"{postgres=arwdDxtm/postgres,authenticated=arwDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.app_profiles","owner":"postgres","forceRls":false,"policies":[{"name":"app_profiles_insert_own","check":"(( SELECT auth.uid() AS uid) = account_id)","roles":"{16485}","using":null,"command":"a","permissive":true},{"name":"app_profiles_select_own","check":null,"roles":"{16485}","using":"(( SELECT auth.uid() AS uid) = account_id)","command":"r","permissive":true},{"name":"app_profiles_update_own","check":"(( SELECT auth.uid() AS uid) = account_id)","roles":"{16485}","using":"(( SELECT auth.uid() AS uid) = account_id)","command":"w","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["FOREIGN KEY (account_id) REFERENCES app_accounts(id) ON DELETE CASCADE","UNIQUE (account_id, kind)","CHECK ((account_type = ANY (ARRAY['INDIVIDUAL'::text, 'TEAM'::text, 'COMPANY'::text])))","CHECK (((team_capacity >= 1) AND (team_capacity <= 50)))","CHECK ((kind = ANY (ARRAY['REQUESTER'::text, 'WORKER'::text])))","CHECK (((minimum_fee_rsd >= 0) AND (minimum_fee_rsd <= 10000000)))","CHECK (((operating_country_code IS NULL) OR (operating_country_code ~ '^[A-Z]{2}$'::text)))","PRIMARY KEY (id)","CHECK (((radius_km >= 1) AND (radius_km <= 200)))","CHECK ((profile_status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'SUSPENDED'::text, 'CLOSED'::text])))","CHECK ((((worker_dispatch_eligible_since IS NULL) AND (worker_dispatch_clock_source IS NULL)) OR ((kind = 'WORKER'::text) AND (worker_dispatch_eligible_since IS NOT NULL) AND isfinite(worker_dispatch_eligible_since) AND (worker_dispatch_clock_source IS NOT NULL) AND (worker_dispatch_clock_source = ANY (ARRAY['FIRST_ACTIVATION'::text, 'ROLLOUT_ACTIVE_OBSERVED'::text])))))","CHECK (((years_experience >= 0) AND (years_experience <= 80)))"]},{"acl":"{postgres=arwdDxtm/postgres,anon=rDxtm/postgres,authenticated=rDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.marketplace_response_versions","owner":"postgres","forceRls":false,"policies":[{"name":"response_versions_read","check":null,"roles":"{16485}","using":"(EXISTS ( SELECT 1\n   FROM marketplace_responses r\n  WHERE ((r.id = marketplace_response_versions.response_id) AND ((r.worker_account_id = ( SELECT auth.uid() AS uid)) OR ((r.status <> 'DRAFT'::text) AND (EXISTS ( SELECT 1\n           FROM needs n\n          WHERE ((n.id = r.need_id) AND is_my_task(n.id)))))))))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["CHECK ((char_length(content_hash) >= 16))","CHECK (((covered_slots >= 1) AND (covered_slots <= 50)))","CHECK ((need_revision >= 1))","PRIMARY KEY (response_id, version)","CHECK ((price_basis = ANY (ARRAY['TOTAL'::text, 'HOURLY'::text])))","CHECK ((price_rsd > 0))","FOREIGN KEY (response_id) REFERENCES marketplace_responses(id) ON DELETE CASCADE","CHECK ((version >= 1))"]},{"acl":"{postgres=arwdDxtm/postgres,anon=rDxtm/postgres,authenticated=rDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.marketplace_responses","owner":"postgres","forceRls":false,"policies":[{"name":"responses_requester_read","check":null,"roles":"{16485}","using":"((status <> 'DRAFT'::text) AND (EXISTS ( SELECT 1\n   FROM needs n\n  WHERE ((n.id = marketplace_responses.need_id) AND is_my_task(n.id)))))","command":"r","permissive":true},{"name":"responses_worker_read","check":null,"roles":"{16485}","using":"(worker_account_id = ( SELECT auth.uid() AS uid))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["CHECK ((char_length(bounded_message) <= 1000))","CHECK ((((proposed_start_at IS NULL) AND (proposed_end_at IS NULL)) OR ((proposed_start_at IS NOT NULL) AND (proposed_end_at IS NOT NULL) AND (proposed_start_at < proposed_end_at))))","CHECK (((covered_slots >= 1) AND (covered_slots <= 50)))","CHECK ((current_version >= 1))","FOREIGN KEY (need_id) REFERENCES needs(id) ON DELETE CASCADE","PRIMARY KEY (id)","CHECK ((price_basis = ANY (ARRAY['TOTAL'::text, 'HOURLY'::text])))","CHECK ((price_rsd > 0))","CHECK ((response_kind = ANY (ARRAY['APPLICATION'::text, 'OFFER'::text])))","CHECK ((status = ANY (ARRAY['DRAFT'::text, 'SUBMITTED'::text, 'DELIVERED'::text, 'VIEWED'::text, 'SHORTLISTED'::text, 'SELECTED'::text, 'NOT_SELECTED'::text, 'WITHDRAWN'::text, 'EXPIRED'::text, 'STALE'::text, 'STALE_REVIEW_REQUIRED'::text])))","CHECK ((submitted_against_need_revision >= 1))","FOREIGN KEY (worker_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","FOREIGN KEY (worker_profile_id) REFERENCES app_profiles(id) ON DELETE RESTRICT"]},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.need_selections","owner":"postgres","forceRls":false,"policies":[{"name":"selections_requester","check":null,"roles":"{16485}","using":"(selected_by_account_id = ( SELECT auth.uid() AS uid))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"rpc_storage_account_open()","command":"r","permissive":false}],"constraints":["CHECK (((char_length(btrim(client_request_id)) >= 8) AND (char_length(btrim(client_request_id)) <= 200)))","CHECK (((covered_slots >= 1) AND (covered_slots <= 50)))","UNIQUE (need_id, client_request_id)","FOREIGN KEY (need_id) REFERENCES needs(id) ON DELETE CASCADE","CHECK ((need_revision >= 1))","PRIMARY KEY (id)","FOREIGN KEY (response_id) REFERENCES marketplace_responses(id) ON DELETE RESTRICT","FOREIGN KEY (selected_by_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","CHECK ((selection_mode = ANY (ARRAY['REQUESTER_SELECTS'::text, 'BIDDING'::text])))","CHECK ((status = ANY (ARRAY['SELECTED'::text, 'CANCELLED'::text, 'SUPERSEDED'::text])))","FOREIGN KEY (worker_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","FOREIGN KEY (worker_profile_id) REFERENCES app_profiles(id) ON DELETE RESTRICT"]},{"acl":"{postgres=arwdDxtm/postgres,anon=Dxtm/postgres,authenticated=awDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"name":"public.needs","owner":"postgres","forceRls":false,"policies":[{"name":"needs_owner_insert","check":"((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = 'DRAFT'::text))","roles":"{16485}","using":null,"command":"a","permissive":true},{"name":"needs_owner_select","check":null,"roles":"{16485}","using":"(requester_account_id = ( SELECT auth.uid() AS uid))","command":"r","permissive":true},{"name":"needs_owner_update","check":"((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = 'DRAFT'::text))","roles":"{16485}","using":"((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = 'DRAFT'::text))","command":"w","permissive":true},{"name":"needs_participant_read","check":null,"roles":"{16485}","using":"rls_private.need_participant_can_read(id)","command":"r","permissive":true},{"name":"needs_public_discovery","check":null,"roles":"{16485}","using":"((status = ANY (ARRAY['PUBLISHED'::text, 'SELECTION'::text])) AND (( SELECT auth.uid() AS uid) IS NOT NULL) AND ((requester_account_id = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[]))) = (( SELECT auth.uid() AS uid) = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[])))))","command":"r","permissive":true},{"name":"v5_closed_account_visibility","check":null,"roles":"{16485}","using":"( SELECT rpc_storage_account_open() AS rpc_storage_account_open)","command":"r","permissive":false}],"constraints":["CHECK (((char_length(btrim(category)) >= 1) AND (char_length(btrim(category)) <= 120)))","FOREIGN KEY (category_id) REFERENCES private.work_taxonomy_categories(id)","CHECK (((ends_at IS NULL) OR (starts_at IS NULL) OR (ends_at > starts_at)))","CHECK (((char_length(btrim(description)) >= 1) AND (char_length(btrim(description)) <= 6000)))","CHECK ((execution_location_mode = ANY (ARRAY['STATIONARY'::text, 'POINT_TO_POINT'::text, 'MULTI_STOP'::text, 'AREA_BASED'::text, 'REMOTE'::text])))","CHECK (((minimum_experience_years IS NULL) OR ((minimum_experience_years >= 0) AND (minimum_experience_years <= 60))))","CHECK ((mode = ANY (ARRAY['MY_PRICE'::text, 'OFFERS'::text])))","PRIMARY KEY (id)","CHECK (((price_basis IS NULL) OR ((price_basis = ANY (ARRAY['TOTAL'::text, 'PER_PERSON'::text, 'HOURLY'::text])) AND (mode = 'MY_PRICE'::text))))","CHECK (((remaining_search_close_reason IS NULL) OR (char_length(remaining_search_close_reason) <= 500)))","FOREIGN KEY (remaining_search_closed_by_account_id) REFERENCES auth.users(id) ON DELETE SET NULL","FOREIGN KEY (requester_account_id) REFERENCES auth.users(id) ON DELETE RESTRICT","CHECK (((requester_price_rsd IS NULL) OR (requester_price_rsd > 0)))","FOREIGN KEY (requester_profile_id) REFERENCES app_profiles(id) ON DELETE RESTRICT","CHECK (((required_slots >= 1) AND (required_slots <= 50)))","CHECK ((revision >= 1))","CHECK ((schedule_kind = ANY (ARRAY['FIXED_WINDOW'::text, 'FLEXIBLE'::text, 'REMOTE_ANYTIME'::text, 'TODAY_FLEXIBLE'::text, 'TOMORROW_FLEXIBLE'::text, 'WEEK_FLEXIBLE'::text])))","CHECK ((status = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text, 'SELECTION'::text, 'ACTIVE'::text, 'COMPLETED'::text, 'CANCELLED'::text, 'EXPIRED'::text, 'ARCHIVED'::text])))","CHECK (((task_country_code IS NULL) OR (task_country_code ~ '^[A-Z]{2}$'::text)))","CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 140)))","CHECK (((NOT urgent) OR ((urgent_activated_at IS NOT NULL) AND (urgent_expires_at IS NOT NULL) AND (urgent_expires_at > urgent_activated_at))))","TRIGGER DEFERRABLE INITIALLY DEFERRED"]}],"closure":{"sourceReady":false,"schemaDigest":"7923a76b5add2e56f2ded9a173dd1638baa346a8742877cecb23aaf634229d50","sourceDigest":"acf469c343e33c4126ca96853b4461c8dcdf7271cc22fb36464cc506006dd6ab","storedSource":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","erasureDigest":"24613a2985b790b6fa4445b021861a2bf25e7bb44d907da148900870bdccb11c","storedErasure":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb"}}$environment$::jsonb;
if observed is distinct from expected then raise exception 'WORKER_APPLICATION_AREAS_POSTIMAGE_ENVIRONMENT_DRIFT' using errcode='55000'; end if;
end $worker_application_areas_operation$;
select 'WORKER_APPLICATION_AREAS_POSTIMAGE_MATCH' as status;
