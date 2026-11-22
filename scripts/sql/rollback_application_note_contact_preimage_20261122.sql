-- Rollback for application_note_contact_20261122: removes the inserted check
-- from rpc_submit_response (back to prosrc md5 dc49b5ad5382f5877644b4b6cddcc119)
-- and drops private.text_has_contact_v1.
BEGIN;

DO $rollback$
DECLARE
  fn regprocedure := 'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)'::regprocedure;
  addition text := E'\n  -- Contacts are exchanged after the Agreement, never in an application note.\n  if private.text_has_contact_v1(p_scope_note) then\n    raise exception using errcode=''22023'', message=''APPLICATION_NOTE_CONTACT'';\n  end if;\n';
  def text;
BEGIN
  def := pg_get_functiondef(fn);
  IF (length(def)-length(replace(def, addition, '')))/length(addition)<>1 THEN RAISE EXCEPTION 'APPLICATION_NOTE_CONTACT_ROLLBACK_ANCHOR'; END IF;
  EXECUTE replace(def, addition, '');
  IF md5((SELECT prosrc FROM pg_proc WHERE oid=fn))<>'dc49b5ad5382f5877644b4b6cddcc119' THEN RAISE EXCEPTION 'APPLICATION_NOTE_CONTACT_ROLLBACK_POSTIMAGE'; END IF;
END $rollback$;

DROP FUNCTION private.text_has_contact_v1(text);

COMMIT;
