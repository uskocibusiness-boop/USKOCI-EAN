-- Forward, additive, service-only. Nothing existing is altered or dropped.
--  1. rpc_taxonomy_fetch_snapshot_v1: the whole established taxonomy tree in ONE read (the background architect
--     used to walk it level by level with many round trips). Computed live, so it is never stale.
--  2. private.classification_turn_hints + store/get/consume RPCs: a clarification question noticed by the background
--     classifier survives an Edge instance restart and is asked exactly once on the next turn.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_fetch_snapshot_v1(p_generation integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path='pg_catalog'
SET statement_timeout='5s'
AS $function$
DECLARE
 v_version bigint; v_fingerprint text; v_items jsonb; v_result jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'TAXONOMY_SNAPSHOT_DENIED' USING errcode='42501'; END IF;
 IF p_generation IS DISTINCT FROM 1 THEN
  RAISE EXCEPTION 'TAXONOMY_SNAPSHOT_INVALID' USING errcode='22023'; END IF;
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control WHERE singleton;
 v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
 IF v_version IS NULL OR v_version<1 OR v_fingerprint IS NULL OR v_fingerprint!~'^[0-9a-f]{32}$' THEN
  RAISE EXCEPTION 'TAXONOMY_SNAPSHOT_CATALOG_UNAVAILABLE' USING errcode='55000'; END IF;

 -- Top-down walk from the roots over ESTABLISHED categories. Ancestry is organisation, not permission to perform a
 -- leaf's mode (the same rule the paged catalogue query states): an item is listed when it has its OWN direct
 -- ON_SITE/REMOTE mode row and an ESTABLISHED chain to a root; ancestors need no mode of their own.
 WITH RECURSIVE modes AS (
   SELECT m.category_id, array_agg(DISTINCT m.execution_scope::text ORDER BY m.execution_scope::text) AS scopes
   FROM private.work_taxonomy_category_modes m
   WHERE m.execution_scope IN('ON_SITE','REMOTE')
   GROUP BY m.category_id
 ), tree(id,label,canonical_key,parent_id,path_labels,path_ids) AS (
   SELECT c.id,c.label,c.canonical_key,c.parent_id,ARRAY[c.label]::text[],ARRAY[c.id]::uuid[]
   FROM private.work_taxonomy_categories c
   WHERE c.state='ESTABLISHED' AND c.parent_id IS NULL
  UNION ALL
   SELECT c.id,c.label,c.canonical_key,c.parent_id,t.path_labels||c.label,t.path_ids||c.id
   FROM tree t
   JOIN private.work_taxonomy_categories c ON c.parent_id=t.id AND c.state='ESTABLISHED'
   WHERE NOT c.id=ANY(t.path_ids)
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'categoryId',t.id,'label',t.label,'parentId',t.parent_id,
   'aliases',coalesce((SELECT jsonb_agg(a.label ORDER BY a.label COLLATE "C")
      FROM (SELECT DISTINCT al.label FROM private.work_taxonomy_aliases al WHERE al.category_id=t.id) a),'[]'::jsonb),
   'modes',to_jsonb(mo.scopes),
   'path',to_jsonb(t.path_labels),'pathIds',to_jsonb(t.path_ids),
   'isLeaf',NOT EXISTS(SELECT 1 FROM tree ch JOIN modes cm ON cm.category_id=ch.id WHERE ch.parent_id=t.id)
  ) ORDER BY t.canonical_key COLLATE "C",t.id),'[]'::jsonb)
 INTO v_items FROM tree t JOIN modes mo ON mo.category_id=t.id;

 v_result:=jsonb_build_object('schemaVersion','TAXONOMY_CATALOG_SNAPSHOT_V1','generation',1,
  'catalogVersion',v_version,'catalogFingerprint',v_fingerprint,
  'count',jsonb_array_length(v_items),'categories',v_items,
  'classificationAuthority','NONE','capabilityAuthority','NONE','notificationAuthority','NONE');
 IF octet_length(v_result::text)>4194304 THEN
  RAISE EXCEPTION 'TAXONOMY_SNAPSHOT_TOO_LARGE' USING errcode='54000'; END IF;
 RETURN v_result;
END $function$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_fetch_snapshot_v1(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_fetch_snapshot_v1(integer) TO service_role;
COMMENT ON FUNCTION public.rpc_taxonomy_fetch_snapshot_v1(integer) IS
 'Read-only, service-only. The whole established taxonomy tree in one read, computed live. Not classification authority; owner-reviewed Save remains the admission boundary.';

CREATE TABLE IF NOT EXISTS private.classification_turn_hints (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL,
 draft_revision bigint,
 service text CHECK (service IS NULL OR char_length(service) BETWEEN 1 AND 200),
 mode text CHECK (mode IS NULL OR mode IN('ON_SITE','REMOTE')),
 ambiguity_prompt text NOT NULL CHECK (char_length(ambiguity_prompt) BETWEEN 1 AND 600),
 reason text CHECK (reason IS NULL OR char_length(reason)<=300),
 created_at timestamptz NOT NULL DEFAULT now(),
 consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS classification_turn_hints_open_idx
 ON private.classification_turn_hints (conversation_id, created_at DESC) WHERE consumed_at IS NULL;
REVOKE ALL ON TABLE private.classification_turn_hints FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_store_classification_turn_hint_service(
 p_conversation_id uuid, p_draft_revision bigint, p_service text, p_mode text, p_ambiguity_prompt text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path='pg_catalog'
AS $function$
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'TAXONOMY_HINT_DENIED' USING errcode='42501'; END IF;
 IF p_conversation_id IS NULL OR p_ambiguity_prompt IS NULL OR char_length(btrim(p_ambiguity_prompt)) NOT BETWEEN 1 AND 600 THEN
  RAISE EXCEPTION 'TAXONOMY_HINT_INVALID' USING errcode='22023'; END IF;
 -- Retention: a hint is only useful for the next turn or two.
 DELETE FROM private.classification_turn_hints WHERE created_at < now() - interval '7 days';
 -- One open hint per conversation and draft revision: the newest replaces the older.
 DELETE FROM private.classification_turn_hints
  WHERE conversation_id=p_conversation_id AND consumed_at IS NULL AND draft_revision IS NOT DISTINCT FROM p_draft_revision;
 INSERT INTO private.classification_turn_hints(conversation_id,draft_revision,service,mode,ambiguity_prompt,reason)
 VALUES (p_conversation_id,p_draft_revision,left(p_service,200),
  CASE WHEN p_mode IN('ON_SITE','REMOTE') THEN p_mode ELSE NULL END,btrim(p_ambiguity_prompt),left(p_reason,300));
 RETURN jsonb_build_object('stored',true);
END $function$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_store_classification_turn_hint_service(uuid,bigint,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_store_classification_turn_hint_service(uuid,bigint,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_get_unconsumed_turn_hint_service(p_conversation_id uuid, p_draft_revision bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path='pg_catalog'
AS $function$
DECLARE v_row private.classification_turn_hints%ROWTYPE;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'TAXONOMY_HINT_DENIED' USING errcode='42501'; END IF;
 SELECT * INTO v_row FROM private.classification_turn_hints
  WHERE conversation_id=p_conversation_id AND consumed_at IS NULL AND created_at > now() - interval '1 day'
  ORDER BY created_at DESC LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('conversationId',v_row.conversation_id,'draftRevision',v_row.draft_revision,
  'service',v_row.service,'mode',v_row.mode,'ambiguityPrompt',v_row.ambiguity_prompt,'reason',v_row.reason);
END $function$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_get_unconsumed_turn_hint_service(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_get_unconsumed_turn_hint_service(uuid,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_consume_turn_hint_service(p_conversation_id uuid, p_service text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path='pg_catalog'
AS $function$
DECLARE v_count integer;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'TAXONOMY_HINT_DENIED' USING errcode='42501'; END IF;
 UPDATE private.classification_turn_hints SET consumed_at=now()
  WHERE conversation_id=p_conversation_id AND consumed_at IS NULL
    AND (p_service IS NULL OR service IS NOT DISTINCT FROM p_service);
 GET DIAGNOSTICS v_count = ROW_COUNT;
 RETURN jsonb_build_object('consumed',v_count);
END $function$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_consume_turn_hint_service(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_consume_turn_hint_service(uuid,text) TO service_role;
COMMIT;
