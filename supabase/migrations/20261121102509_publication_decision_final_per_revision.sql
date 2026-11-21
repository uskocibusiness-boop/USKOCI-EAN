-- USKOCI DEV: REVIEW/BLOCK publication decision is final per need revision (owner-approved 2026-11-21).
-- Source: scripts/sql/publication_decision_final_20261121.candidate.sql; rollback: scripts/sql/rollback_publication_decision_preimage_20261121.sql.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $record_decision_final$
DECLARE
  target regprocedure := 'public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  SELECT md5(p.prosrc) body_md5, pg_get_userbyid(p.proowner) owner, p.proacl::text acl,
         p.prosecdef, p.proconfig, p.prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM 'f6c506b0d6f53d4c6c0ffdff0c9121c4'
     OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'PUBLICATION_DECISION_FINAL_RECORD_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d,$old$
  insert into private.need_publication_decisions(
$old$),1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PUBLICATION_DECISION_FINAL_RECORD_ANCHOR_DRIFT';
  END IF;
  d := replace(d,$old$
  insert into private.need_publication_decisions(
$old$,$new$
  -- REVIEW and BLOCK are final for this Need revision. Only the exact replay of
  -- that stored decision is returned; another outcome needs a new revision.
  if exists(select 1 from private.need_publication_decisions final
             where final.need_id=p_need_id and final.need_revision=p_expected_revision
               and final.outcome in('REVIEW','BLOCK') and final.decision_identity<>v_identity) then
    raise exception 'PUBLICATION_DECISION_FINAL' using errcode='P0001';
  end if;

  insert into private.need_publication_decisions(
$new$);
  EXECUTE d;
  SELECT md5(p.prosrc) body_md5, p.proacl::text acl, to_jsonb(p)-'prosrc' metadata INTO actual
    FROM pg_proc p WHERE p.oid=target;
  IF actual.body_md5 IS DISTINCT FROM '567d2d33a4b6f1cec57b1b99c0fc81d7'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
     OR actual.metadata IS DISTINCT FROM original_metadata
     OR position('PUBLICATION_DECISION_FINAL' in (SELECT prosrc FROM pg_proc WHERE oid=target))=0
  THEN RAISE EXCEPTION 'PUBLICATION_DECISION_FINAL_RECORD_POSTIMAGE_DRIFT'; END IF;
END
$record_decision_final$;

DO $publish_rejects_final$
DECLARE
  target regprocedure := 'public.rpc_publish_need_canonical(uuid,integer,bigint,timestamp with time zone,text)'::regprocedure;
  d text;
  original_metadata jsonb;
  actual record;
BEGIN
  SELECT md5(p.prosrc) body_md5, pg_get_userbyid(p.proowner) owner, p.proacl::text acl,
         p.prosecdef, p.proconfig, p.prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM '9d20dbb6063d8025d7255b10affdd566'
     OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'PUBLICATION_DECISION_FINAL_PUBLISH_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d,$old$  if v_decision.outcome <> 'ALLOW' then
    raise exception 'PUBLICATION_DECISION_NOT_ALLOW' using errcode='P0001';
  end if;
$old$),1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PUBLICATION_DECISION_FINAL_PUBLISH_ANCHOR_DRIFT';
  END IF;
  d := replace(d,$old$  if v_decision.outcome <> 'ALLOW' then
    raise exception 'PUBLICATION_DECISION_NOT_ALLOW' using errcode='P0001';
  end if;
$old$,$new$  -- Any REVIEW or BLOCK for this revision is final, including one recorded
  -- before a later ALLOW; only a new revision can be evaluated again.
  if v_decision.outcome <> 'ALLOW'
     or exists (
       select 1
         from private.need_publication_decisions final
        where final.need_id = p_need_id
          and final.need_revision = p_expected_revision
          and final.outcome in ('REVIEW','BLOCK')
     ) then
    raise exception 'PUBLICATION_DECISION_NOT_ALLOW' using errcode='P0001';
  end if;
$new$);
  EXECUTE d;
  SELECT md5(p.prosrc) body_md5, p.proacl::text acl, to_jsonb(p)-'prosrc' metadata INTO actual
    FROM pg_proc p WHERE p.oid=target;
  IF actual.body_md5 IS DISTINCT FROM 'd4b1ebc37183c785dd48a4192ff6de79'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
     OR actual.metadata IS DISTINCT FROM original_metadata
     OR position('final.outcome in (''REVIEW'',''BLOCK'')' in (SELECT prosrc FROM pg_proc WHERE oid=target))=0
  THEN RAISE EXCEPTION 'PUBLICATION_DECISION_FINAL_PUBLISH_POSTIMAGE_DRIFT'; END IF;
END
$publish_rejects_final$;

COMMIT;
