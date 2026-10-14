-- Require real privileged service session, not merely SECURITY DEFINER.
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
SELECT public.rpc_taxonomy_capture_gemini_turn_hints_service(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '99999999-9999-4999-8999-999999999999',
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd','WORKER_CAPABILITY',3,
 '[{"service":"Krecenje zidova","mode":"ON_SITE","action":"REUSE_EXISTING",
   "categoryId":"11111111-1111-4111-8111-111111111111","parentId":"",
   "proposedPath":[],"reason":"Exact existing canonical service label","catalogVersion":3}]'::jsonb);
-- Exact retry is an ACK and must not create a second row.
SELECT public.rpc_taxonomy_capture_gemini_turn_hints_service(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '99999999-9999-4999-8999-999999999999',
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd','WORKER_CAPABILITY',3,
 '[{"service":"Krecenje zidova","mode":"ON_SITE","action":"REUSE_EXISTING",
   "categoryId":"11111111-1111-4111-8111-111111111111","parentId":"",
   "proposedPath":[],"reason":"Exact existing canonical service label","catalogVersion":3}]'::jsonb);
SELECT public.rpc_taxonomy_capture_gemini_turn_hints_service(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '66666666-6666-4666-8666-666666666666',
 '77777777-7777-4777-8777-777777777777',
 '55555555-5555-4555-8555-555555555555','NEED_SERVICE',3,
 '[{"service":"Krecenje zidova","mode":"ON_SITE","action":"REUSE_EXISTING",
   "categoryId":"11111111-1111-4111-8111-111111111111","parentId":"",
   "proposedPath":[],"reason":"Exact existing canonical service label","catalogVersion":3}]'::jsonb);
DO $test$
DECLARE p jsonb:='[{"service":"Krecenje zidova","mode":"ON_SITE",
 "action":"REUSE_EXISTING","categoryId":"11111111-1111-4111-8111-111111111111",
 "parentId":"","proposedPath":[],"reason":"Exact existing canonical service label",
 "catalogVersion":3}]'::jsonb;
BEGIN
 IF (SELECT count(*) FROM private.work_taxonomy_gemini_turn_hints_v1) <> 2
 THEN RAISE EXCEPTION 'HINT_CAPTURE_DUPLICATED_OR_OMITTED'; END IF;
 -- A forged owner may not use an otherwise valid turn identifier.
 BEGIN
  PERFORM public.rpc_taxonomy_capture_gemini_turn_hints_service(
   'ffffffff-ffff-4fff-8fff-ffffffffffff',
   '99999999-9999-4999-8999-999999999999',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd','WORKER_CAPABILITY',3,p);
  RAISE EXCEPTION 'FORGED_OWNER_ACCEPTED';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 -- A leased but not completed attempt must not be captured.
 BEGIN
  PERFORM public.rpc_taxonomy_capture_gemini_turn_hints_service(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '99999999-9999-4999-8999-999999999999',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeed',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccd',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd','WORKER_CAPABILITY',3,p);
  RAISE EXCEPTION 'UNCOMPLETED_TURN_ACCEPTED';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 -- A changed payload must never silently overwrite the original turn evidence.
 BEGIN
  PERFORM public.rpc_taxonomy_capture_gemini_turn_hints_service(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '99999999-9999-4999-8999-999999999999',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd','WORKER_CAPABILITY',3,
   jsonb_set(p,'{0,service}','"Krecenje plafona"'));
  RAISE EXCEPTION 'CONFLICTING_REPLAY_ACCEPTED';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 -- The service key must not be callable by an ordinary authenticated JWT.
 PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
 BEGIN
  PERFORM public.rpc_taxonomy_capture_gemini_turn_hints_service(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '99999999-9999-4999-8999-999999999999',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd','WORKER_CAPABILITY',3,p);
  RAISE EXCEPTION 'ORDINARY_JWT_ACCEPTED';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 -- Missing explicit mode must not survive.
 BEGIN
  PERFORM public.rpc_taxonomy_capture_gemini_turn_hints_service(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '99999999-9999-4999-8999-999999999999',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd','WORKER_CAPABILITY',3,
   jsonb_set(p,'{0,mode}','"UNCONFIRMED"'));
  RAISE EXCEPTION 'UNKNOWN_MODE_ACCEPTED';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 IF (SELECT count(*) FROM private.work_taxonomy_gemini_turn_hints_v1) <> 2
 THEN RAISE EXCEPTION 'INVALID_REQUEST_CHANGED_DURABLE_ROWS'; END IF;
END $test$;
