-- Future deadline / no deadline are accepted; ended completion windows are not.
DO $f$
DECLARE kind text;app jsonb;agreement uuid;
BEGIN
 FOREACH kind IN ARRAY ARRAY['FLEXIBLE','REMOTE_ANYTIME','WEEK_FLEXIBLE'] LOOP
  PERFORM proof.reset(kind,statement_timestamp()+interval '1 day');
  app:=proof.submit();
  PERFORM proof.require(app->>'status'='SUBMITTED','FUTURE_COMPLETION_ACCEPTS_APPLICATION');
  PERFORM proof.require((SELECT candidate_state='SELECTABLE' FROM private.need_candidate_states_v5(proof.id(201))
   WHERE response_id=(app->>'responseId')::uuid),'FUTURE_COMPLETION_SELECTABLE');
  agreement:=proof.select_response((app->>'responseId')::uuid);
  PERFORM proof.require(agreement IS NOT NULL,'FUTURE_COMPLETION_ACCEPTS_SELECTION');
  PERFORM proof.reset(kind,statement_timestamp()-interval '1 hour');
  PERFORM proof.expect_error($q$SELECT proof.submit()$q$,'PT409','NEED_EXECUTION_WINDOW_EXPIRED');
  PERFORM proof.require((SELECT count(*)=0 FROM public.marketplace_responses)
   AND (SELECT count(*)=0 FROM private.response_submit_commands),'EXPIRED_NEW_APPLICATION_WRITES_NOTHING');
  PERFORM proof.reset(kind,statement_timestamp()+interval '1 day');
  app:=proof.submit();
  UPDATE public.needs SET ends_at=statement_timestamp()-interval '1 hour' WHERE id=proof.id(201);
  PERFORM proof.expect_error(format('SELECT proof.select_response(%L::uuid)',app->>'responseId'),
    'PT409','NEED_EXECUTION_WINDOW_EXPIRED');
  PERFORM proof.require((SELECT count(*)=0 FROM public.agreements)
   AND (SELECT count(*)=0 FROM private.selection_commands)
   AND (SELECT count(*)=0 FROM private.connection_activations),'EXPIRED_SELECTION_WRITES_NO_AGREEMENT_OR_CHARGE');
  PERFORM proof.require((SELECT candidate_state='CLOSED' FROM private.need_candidate_states_v5(proof.id(201))
   WHERE response_id=(app->>'responseId')::uuid)
   AND (SELECT candidate_state='CLOSED' FROM private.need_candidate_states_v5(proof.id(201),ARRAY[(app->>'responseId')::uuid])),
   'BOTH_READER_OVERLOADS_CLOSE_ONLY_UNSELECTED_EXPIRED_APPLICATION');
 END LOOP;
 FOREACH kind IN ARRAY ARRAY['REMOTE_ANYTIME','FLEXIBLE'] LOOP
  PERFORM proof.reset(kind,null);
  app:=proof.submit();
  PERFORM proof.require(proof.select_response((app->>'responseId')::uuid) IS NOT NULL,
   'UNBOUNDED_REMOTE_OR_FLEXIBLE_NO_INVENTED_DEADLINE');
  -- A FLEXIBLE/REMOTE start alone is not a precise FIXED_WINDOW appointment.
  PERFORM proof.reset(kind,null,statement_timestamp()-interval '1 day');
  PERFORM proof.require(proof.submit()->>'status'='SUBMITTED','NONFIXED_START_DOES_NOT_INVENT_END');
 END LOOP;
END $f$;

-- Completion vs application deadline remain separate fields and error paths.
SELECT proof.reset('FLEXIBLE',statement_timestamp()+interval '1 day',null,statement_timestamp()-interval '1 hour');
SELECT proof.expect_error($q$SELECT proof.submit()$q$,'22023','RESPONSE_WINDOW_EXPIRED');
SELECT proof.reset();
TRUNCATE proof.results;
INSERT INTO proof.results VALUES('app',proof.submit());
UPDATE public.needs SET response_deadline=statement_timestamp()-interval '1 hour';
SELECT proof.expect_error(format('SELECT proof.select_response(%L::uuid)',value->>'responseId'),
 'P0001','RESPONSE_WINDOW_EXPIRED') FROM proof.results WHERE label='app';
SELECT proof.reset('FLEXIBLE',statement_timestamp()-interval '1 hour',null,statement_timestamp()+interval '1 day');
SELECT proof.expect_error($q$SELECT proof.submit()$q$,'PT409','NEED_EXECUTION_WINDOW_EXPIRED');

-- Exact start without end: use the stated instant, never fabricate a finish.
SELECT proof.reset('FIXED_WINDOW',null,statement_timestamp()+interval '1 day');
TRUNCATE proof.results;
INSERT INTO proof.results VALUES('app',proof.submit());
INSERT INTO proof.results SELECT 'agreement',to_jsonb(proof.select_response((value->>'responseId')::uuid))
 FROM proof.results WHERE label='app';
SELECT proof.require(terms->>'declared_start_at' IS NOT NULL
 AND terms->'proposed_start_at'='null'::jsonb AND terms->'proposed_end_at'='null'::jsonb,
 'START_ONLY_AGREEMENT_HAS_DECLARED_START_WITH_NO_INVENTED_DURATION') FROM public.agreement_versions;
SELECT proof.reset('FIXED_WINDOW',null,statement_timestamp()-interval '1 hour');
SELECT proof.expect_error($q$SELECT proof.submit()$q$,'PT409','NEED_EXECUTION_WINDOW_EXPIRED');
SELECT proof.reset('FIXED_WINDOW',null,statement_timestamp()+interval '1 day');
TRUNCATE proof.results;
INSERT INTO proof.results VALUES('app',proof.submit());
UPDATE public.needs SET starts_at=statement_timestamp()-interval '1 hour';
SELECT proof.expect_error(format('SELECT proof.select_response(%L::uuid)',value->>'responseId'),
 'PT409','NEED_EXECUTION_WINDOW_EXPIRED') FROM proof.results WHERE label='app';

-- Real selected agreement + open remaining places; expiration stops only NEW work.
SELECT proof.reset('FLEXIBLE',statement_timestamp()+interval '1 day',null,null,3);
TRUNCATE proof.results;
INSERT INTO proof.results VALUES('first-app',proof.submit('first-application-0001',2));
INSERT INTO proof.results SELECT 'first-agreement',to_jsonb(proof.select_response((value->>'responseId')::uuid,'first-selection-0001'))
 FROM proof.results WHERE label='first-app';
INSERT INTO proof.results VALUES('second-app',proof.submit('second-application-0001',3));
INSERT INTO proof.results SELECT 'agreements-before',jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.agreements a;
INSERT INTO proof.results SELECT 'terms-before',jsonb_agg(to_jsonb(v) ORDER BY agreement_id,version) FROM public.agreement_versions v;
SELECT proof.require((SELECT status='SELECTION' AND required_slots=3 FROM public.needs)
 AND public.fn_need_covered_slots(proof.id(201))=1,'PARTIAL_SELECTION_FIXTURE_HAS_TWO_OPEN_PLACES');
UPDATE public.needs SET ends_at=statement_timestamp()-interval '1 hour';
SELECT proof.expect_error($q$SELECT proof.submit('new-application-after-end',3)$q$,'PT409','NEED_EXECUTION_WINDOW_EXPIRED');
SELECT proof.expect_error(format('SELECT proof.select_response(%L::uuid,%L)',value->>'responseId','new-selection-after-end'),
 'PT409','NEED_EXECUTION_WINDOW_EXPIRED') FROM proof.results WHERE label='second-app';
SELECT proof.require((SELECT candidate_state='SELECTED' FROM private.need_candidate_states_v5(proof.id(201))
 WHERE response_id=(SELECT (value->>'responseId')::uuid FROM proof.results WHERE label='first-app'))
 AND (SELECT candidate_state='CLOSED' FROM private.need_candidate_states_v5(proof.id(201))
 WHERE response_id=(SELECT (value->>'responseId')::uuid FROM proof.results WHERE label='second-app')),
 'EXISTING_AGREEMENT_SELECTED_UNFILLED_PLACES_CLOSED');
SELECT proof.require((SELECT candidate_state='SELECTED' FROM private.need_candidate_states_v5(proof.id(201),
 ARRAY[(SELECT (value->>'responseId')::uuid FROM proof.results WHERE label='first-app')]))
 AND (SELECT candidate_state='CLOSED' FROM private.need_candidate_states_v5(proof.id(201),
 ARRAY[(SELECT (value->>'responseId')::uuid FROM proof.results WHERE label='second-app')])),
 'BATCH_READER_PRESERVES_EXISTING_AGREEMENT');
SELECT proof.require(proof.submit('first-application-0001',2)->'idempotentReplay'='true'::jsonb,
 'COMMITTED_APPLICATION_REPLAY_AFTER_DEADLINE_PRESERVED');
SELECT proof.require(to_jsonb(proof.select_response((SELECT (value->>'responseId')::uuid FROM proof.results WHERE label='first-app'),
 'first-selection-0001'))=(SELECT value FROM proof.results WHERE label='first-agreement'),
 'COMMITTED_SELECTION_REPLAY_AFTER_DEADLINE_PRESERVED');
SELECT proof.require((SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.agreements a)=
 (SELECT value FROM proof.results WHERE label='agreements-before')
 AND (SELECT jsonb_agg(to_jsonb(v) ORDER BY agreement_id,version) FROM public.agreement_versions v)=
 (SELECT value FROM proof.results WHERE label='terms-before')
 AND public.fn_need_covered_slots(proof.id(201))=1
 AND (SELECT status='SELECTION' FROM public.needs),'EXISTING_AGREEMENT_TERMS_STATUS_AND_SLOTS_UNCHANGED');

-- KEEP/UPDATE are new acceptance of a changed task; WITHDRAW must still work.
DO $f$
DECLARE action text;app jsonb;
BEGIN
 FOREACH action IN ARRAY ARRAY['KEEP','UPDATE'] LOOP
  PERFORM proof.reset();app:=proof.submit();
  UPDATE public.needs SET revision=2,ends_at=statement_timestamp()-interval '1 hour';
  UPDATE public.marketplace_responses SET status='STALE_REVIEW_REQUIRED';
  PERFORM proof.expect_error(format('SELECT proof.reconfirm(%L::uuid,%L)',app->>'responseId',action),
   'PT409','NEED_EXECUTION_WINDOW_EXPIRED');
  PERFORM proof.require((SELECT count(*)=1 FROM public.marketplace_response_versions)
   AND (SELECT count(*)=0 FROM private.response_revision_resolution_commands),'EXPIRED_RECONFIRM_NO_NEW_VERSION');
 END LOOP;
 PERFORM proof.require(proof.reconfirm((app->>'responseId')::uuid,'WITHDRAW','withdraw-after-expiry')->>'status'='WITHDRAWN',
  'WITHDRAW_REMAINS_AVAILABLE_AFTER_COMPLETION_DEADLINE');
 PERFORM proof.require(proof.reconfirm((app->>'responseId')::uuid,'WITHDRAW','withdraw-after-expiry')->'idempotentReplay'='true'::jsonb,
  'WITHDRAW_IDEMPOTENT_REPLAY');
 PERFORM proof.reset();app:=proof.submit();
 UPDATE public.needs SET revision=2;UPDATE public.marketplace_responses SET status='STALE_REVIEW_REQUIRED';
 PERFORM proof.require(proof.reconfirm((app->>'responseId')::uuid,'KEEP','keep-before-expiry')->>'status'='SUBMITTED',
  'FUTURE_RECONFIRM_STILL_WORKS');
 UPDATE public.needs SET ends_at=statement_timestamp()-interval '1 hour';
 PERFORM proof.require(proof.reconfirm((app->>'responseId')::uuid,'KEEP','keep-before-expiry')->'idempotentReplay'='true'::jsonb,
  'COMMITTED_KEEP_REPLAY_AFTER_EXPIRY');
END $f$;

-- Relative period with an explicit completion date uses the explicit date.
SELECT proof.reset('WEEK_FLEXIBLE',statement_timestamp()+interval '1 day');
UPDATE public.needs SET published_at=statement_timestamp()-interval '14 days';
SELECT proof.require(proof.submit()->>'status'='SUBMITTED','EXPLICIT_FUTURE_END_OVERRIDES_OLD_PUBLICATION_WEEK');
SELECT proof.reset('TODAY_FLEXIBLE',null);
UPDATE public.needs SET published_at=statement_timestamp()-interval '3 days';
SELECT proof.expect_error($q$SELECT proof.submit()$q$,'PT409','NEED_EXECUTION_WINDOW_EXPIRED');
SELECT proof.reset('FLEXIBLE',statement_timestamp()+interval '1 day');
SELECT proof.require(NOT private.need_search_time_admitted_v1(id,ends_at),'EXACT_DEADLINE_BOUNDARY_IS_CLOSED') FROM public.needs;
SELECT 'task time consistency: all targeted isolated assertions passed' AS result;

