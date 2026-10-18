-- The generator precedes these helpers with the reviewed immutable inventory.
CREATE OR REPLACE FUNCTION private.closure_taxonomy_scope_v1(r text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $f01$
DECLARE c jsonb;
BEGIN
 SELECT x INTO c FROM jsonb_array_elements(private.closure_taxonomy_inventory_v1()) x WHERE x->>'relation'=r;
 IF c IS NULL THEN RAISE EXCEPTION 'F01_RELATION_NOT_ADMITTED'; END IF;
 IF c->>'mode'='NEED' THEN
  RETURN format('t.%I in(select id from public.needs where requester_account_id=$1 union select s.id from private.dev_phase1_20261014_needs_snapshot s where s.requester_account_id=$1 and not exists(select 1 from public.needs n where n.id=s.id))',c->>'ownerColumn');
 END IF;
 RETURN format('t.%I=$1',c->>'ownerColumn');
END $f01$;

CREATE OR REPLACE FUNCTION private.closure_taxonomy_owner_immutable_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $f01$
BEGIN
 -- The existing owner guard checks the resulting owner. A second narrow guard
 -- prevents moving a historical copy away from its original closing account.
 IF (to_jsonb(OLD)->TG_ARGV[0]) IS DISTINCT FROM (to_jsonb(NEW)->TG_ARGV[0])
 THEN RAISE EXCEPTION 'F01_OWNER_IMMUTABLE';END IF;
 RETURN NEW;
END $f01$;

CREATE OR REPLACE FUNCTION private.closure_taxonomy_held_v1(r text,t jsonb,a uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $f01$
DECLARE cid uuid;rid uuid;
BEGIN
 IF r='private.work_taxonomy_gemini_turn_hints_v1' THEN cid:=(t->>'conversation_id')::uuid;
 ELSIF t?'source_review_id' THEN
  rid:=(t->>'source_review_id')::uuid;
  SELECT conversation_id INTO cid FROM (
   SELECT conversation_id FROM private.worker_ai_reviews WHERE id=rid AND account_id=a
   UNION SELECT conversation_id FROM private.ai_task_reviews WHERE id=rid AND account_id=a) s;
 ELSIF r IN('private.work_taxonomy_need_skills','private.work_taxonomy_need_snapshots') THEN
  RETURN EXISTS(SELECT 1 FROM private.work_taxonomy_need_bindings_v1 b
   JOIN private.ai_task_reviews v ON v.id=b.source_review_id AND v.account_id=a
   JOIN private.retention_holds h ON h.account_id=a AND h.conversation_id=v.conversation_id AND h.active
   WHERE b.owner_account_id=a AND b.need_id=(t->>'need_id')::uuid AND b.need_revision=(t->>'need_revision')::integer);
 ELSIF r IN('private.work_taxonomy_worker_capabilities','private.worker_execution_mode_choices') THEN
  RETURN EXISTS(SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m
   JOIN private.worker_ai_reviews v ON v.id=m.source_review_id AND v.account_id=a
   JOIN private.retention_holds h ON h.account_id=a AND h.conversation_id=v.conversation_id AND h.active
   WHERE m.worker_account_id=a AND (r='private.worker_execution_mode_choices' OR m.category_id=(t->>'category_id')::uuid));
 END IF;
 RETURN cid IS NOT NULL AND EXISTS(SELECT 1 FROM private.retention_holds h WHERE h.account_id=a AND h.active AND h.conversation_id=cid);
END $f01$;

CREATE OR REPLACE FUNCTION private.closure_taxonomy_patch_v1(r text,t jsonb,a uuid,g uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $f01$
DECLARE p jsonb;h text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(private.closure_taxonomy_inventory_v1()) x WHERE x->>'relation'=r)
 OR t IS NULL OR a IS NULL OR g IS NULL THEN RAISE EXCEPTION 'F01_PATCH_CONTEXT_INVALID';END IF;
 IF private.closure_taxonomy_held_v1(r,t,a) THEN RETURN NULL;END IF;
 h:=encode(extensions.digest(convert_to('AF-D22:F01:'||r||':'||coalesce(t->>'id',t->>'request_key',a::text),'UTF8'),'sha256'),'hex');
 IF r='private.work_taxonomy_review_outbox_v1' THEN
  -- A retained replay tombstone has no plans, result copy, or usable lease.
  p:=jsonb_build_object('plans','[]'::jsonb,'state','REVIEW_REQUIRED','binding_state','REVIEW_REQUIRED',
   'lease_token',null,'lease_until',null,'error_code','CLOSURE_ERASED','binding_error_code','CLOSURE_ERASED',
   'result',jsonb_build_object('erasedBy','AF-D22'),'binding_result',jsonb_build_object('erasedBy','AF-D22'));
 ELSIF r='private.work_taxonomy_review_batches_v1' THEN
  p:=jsonb_build_object('plans','[]'::jsonb,'review_digest',h,'plans_digest',h,'result',jsonb_build_object('erasedBy','AF-D22'));
 ELSIF r='private.work_taxonomy_admissions_v1' THEN
  p:=jsonb_build_object('plan','{}'::jsonb,'source_review_digest',h,'plan_digest',h);
  IF t->'result'<>'null'::jsonb THEN p:=p||jsonb_build_object('result',jsonb_build_object('erasedBy','AF-D22'));END IF;
 ELSIF r='private.work_taxonomy_pending_reviews_v1' THEN
  p:=jsonb_build_object('resolution_state','SUPERSEDED','classification_state','REVIEW_REQUIRED');
 ELSE RETURN jsonb_build_object('operation','DELETE','patch','{}'::jsonb);
 END IF;
 IF t@>p THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('operation','UPDATE','patch',p);
END $f01$;

CREATE OR REPLACE FUNCTION private.closure_taxonomy_try_owner_v1(a uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $f01$
BEGIN
 IF a IS NULL OR NOT pg_try_advisory_xact_lock_shared(private.closure_account_key(a)) THEN RETURN false;END IF;
 RETURN NOT private.closure_account_restricted(a);
END $f01$;

CREATE OR REPLACE FUNCTION private.closure_taxonomy_profile_erasing_v1(a uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $f01$
 SELECT auth.role()='service_role' AND EXISTS(
 SELECT 1 FROM private.closure_redaction_certificate_v5 c
 JOIN private.closure_executions_v5 e ON e.account_id=c.account_id AND e.generation=c.generation
 JOIN private.closure_actions_v5 ac ON ac.id=c.action_id AND ac.generation=e.generation
 WHERE c.backend_pid=pg_backend_pid() AND c.transaction_id=txid_current() AND c.account_id=a
 AND c.relation_oid='public.app_profiles'::regclass AND c.operation='UPDATE'
 AND c.patch@>'{"skills":[]}'::jsonb AND e.state='EXECUTING'
 AND ac.kind='RELATIONAL_REDACT' AND ac.state='DISPATCHED');
$f01$;

CREATE OR REPLACE FUNCTION private.closure_taxonomy_snapshot_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f01$
DECLARE r jsonb;prior jsonb;a uuid;b uuid;
BEGIN
 IF auth.role()='service_role' AND TG_OP IN('UPDATE','DELETE')
 AND private.closure_redaction_allowed_v5(TG_RELID,TG_OP,to_jsonb(OLD),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(NEW) ELSE NULL END)
 THEN IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END IF;
 r:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 SELECT requester_account_id INTO a FROM public.needs WHERE id=(r->>'need_id')::uuid;
 SELECT requester_account_id INTO b FROM private.dev_phase1_20261014_needs_snapshot WHERE id=(r->>'need_id')::uuid;
 IF a IS NOT NULL AND b IS NOT NULL AND a<>b THEN RAISE EXCEPTION 'F01_SNAPSHOT_OWNER_CONFLICT';END IF;
 PERFORM private.closure_assert_open(coalesce(a,b));
 IF TG_OP='UPDATE' AND OLD.need_id IS DISTINCT FROM NEW.need_id THEN RAISE EXCEPTION 'F01_SNAPSHOT_OWNER_IMMUTABLE';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $f01$;

-- Only semantic proposal fields are exported, never opaque server leases/receipts.
CREATE OR REPLACE FUNCTION private.closure_taxonomy_semantic_v1(v jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $f01$
DECLARE answer jsonb;k text;x jsonb;
BEGIN
 IF jsonb_typeof(v)='array' THEN
  SELECT coalesce(jsonb_agg(private.closure_taxonomy_semantic_v1(value) ORDER BY ord),'[]'::jsonb) INTO answer
  FROM jsonb_array_elements(v) WITH ORDINALITY e(value,ord);RETURN answer;
 ELSIF jsonb_typeof(v)='object' THEN
  SELECT coalesce(jsonb_object_agg(key,private.closure_taxonomy_semantic_v1(value)),'{}'::jsonb) INTO answer
  FROM jsonb_each(v) WHERE key=ANY(private.closure_taxonomy_semantic_keys_v1());RETURN answer;
 END IF;
 RETURN v;
END $f01$;

CREATE OR REPLACE FUNCTION private.closure_taxonomy_project_v1(r text,t jsonb,a uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $f01$
DECLARE c jsonb;p jsonb:='{}';k text;semantic_key text;v jsonb;s jsonb;entry jsonb;rowvalue jsonb;projected jsonb;sections jsonb:='{}';owner text;
BEGIN
 SELECT x INTO c FROM jsonb_array_elements(private.closure_taxonomy_inventory_v1()) x WHERE x->>'relation'=r;
 IF c IS NULL THEN RAISE EXCEPTION 'F01_EXPORT_RELATION_INVALID';END IF;
 FOR k IN SELECT jsonb_array_elements_text(c->'fields') LOOP
  v:=t->k;
  IF k IN('proposals','plan','plans','result','binding_result') THEN v:=private.closure_taxonomy_semantic_v1(v);
  ELSIF k='payload' THEN
   FOR s IN SELECT jsonb_build_object('key',key,'fields',value) FROM jsonb_each(private.closure_taxonomy_reset_sections_v1()) LOOP
    entry:=v->(s->>'key');projected:='[]';
    FOR rowvalue IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(entry)='array' THEN entry WHEN jsonb_typeof(entry)='object' THEN jsonb_build_array(entry) ELSE '[]' END) LOOP
     owner:=coalesce(rowvalue->>'account_id',rowvalue->>'owner_account_id',rowvalue->>'worker_account_id');
     -- Snapshot arrays can contain foreign source copies; never trust only the outer owner.
     IF owner IS NOT NULL AND owner<>a::text THEN CONTINUE;END IF;
     SELECT coalesce(jsonb_object_agg(field,rowvalue->field),'{}') INTO entry FROM jsonb_array_elements_text(s->'fields') field;
     IF entry?'candidate' THEN entry:=jsonb_set(entry,'{candidate}',private.data_export_worker_candidate_v5(entry->'candidate'));END IF;
     IF entry?'envelope' THEN entry:=jsonb_set(entry,'{envelope}',jsonb_build_object('profile',private.data_export_worker_candidate_v5(entry#>'{envelope,profile}')));END IF;
     FOR semantic_key IN SELECT unnest(ARRAY['proposals','plan','plans','result','binding_result']) LOOP
      IF entry?semantic_key THEN entry:=jsonb_set(entry,ARRAY[semantic_key],private.closure_taxonomy_semantic_v1(entry->semantic_key));END IF;
     END LOOP;
     projected:=projected||jsonb_build_array(entry);
    END LOOP;
    sections:=sections||jsonb_build_object(s->>'key',projected);
   END LOOP;
   v:=sections;
  END IF;
  p:=p||jsonb_build_object(k,v);
 END LOOP;
 RETURN p;
END $f01$;

CREATE OR REPLACE FUNCTION private.closure_taxonomy_export_rows_v1(a uuid)
RETURNS TABLE(key text,value jsonb) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $f01$
DECLARE c jsonb;r record;
BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'F01_EXPORT_OWNER_REQUIRED';END IF;
 FOR c IN SELECT x FROM jsonb_array_elements(private.closure_taxonomy_inventory_v1()) x LOOP
  FOR r IN EXECUTE format('select to_jsonb(t) value from %s t where (%s)',(c->>'relation')::regclass,private.closure_taxonomy_scope_v1(c->>'relation')) USING a LOOP
   key:=c->>'key';value:=private.closure_taxonomy_project_v1(c->>'relation',r.value,a);RETURN NEXT;
  END LOOP;
 END LOOP;
END $f01$;

CREATE OR REPLACE FUNCTION private.closure_taxonomy_export_catalog_v1()
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $f01$
 SELECT jsonb_agg(jsonb_build_object('key',x->>'key','fields',x->'fields','dataClass',x->>'dataClass',
 'ownershipFilter',private.closure_taxonomy_scope_v1(x->>'relation')) ORDER BY x->>'key')
 FROM jsonb_array_elements(private.closure_taxonomy_inventory_v1()) x;
$f01$;
