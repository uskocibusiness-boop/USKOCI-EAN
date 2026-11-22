-- USKOČI application note without contact details — candidate 2026-11-22.
-- Owner decision: a worker's message on an application may not carry a phone
-- number, e-mail, link or social handle; contacts are exchanged in messages
-- after the Agreement. This is format recognition (a run of 8+ digits that is
-- not a date, an e-mail, a link, an @handle), never a word list.
BEGIN;

DO $guard$
BEGIN
  IF md5((SELECT prosrc FROM pg_proc WHERE oid='public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)'::regprocedure))<>'dc49b5ad5382f5877644b4b6cddcc119'
  OR to_regprocedure('private.text_has_contact_v1(text)') IS NOT NULL
  THEN RAISE EXCEPTION 'APPLICATION_NOTE_CONTACT_PREIMAGE_MISMATCH'; END IF;
END $guard$;

CREATE FUNCTION private.text_has_contact_v1(t text)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog' AS $f$
 select t is not null and (
   regexp_replace(t, '[0-9]{1,2}\.\s?[0-9]{1,2}\.(\s?[0-9]{2,4}\.?)?', ' ', 'g') ~ '[0-9]([[:space:]./-]?[0-9]){7,}'
   or t ~* '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+'
   or t ~* '(https?://|www\.)'
   or t ~ '(^|[[:space:]])@[A-Za-z0-9_.]{3,}'
 );
$f$;

DO $patch$
DECLARE
  fn regprocedure := 'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)'::regprocedure;
  anchor text := E'    raise exception using errcode=''22023'', message=''INVALID_CLIENT_REQUEST_ID'';\n  end if;\n';
  addition text := E'\n  -- Contacts are exchanged after the Agreement, never in an application note.\n  if private.text_has_contact_v1(p_scope_note) then\n    raise exception using errcode=''22023'', message=''APPLICATION_NOTE_CONTACT'';\n  end if;\n';
  old_src text; def text; expected text;
BEGIN
  SELECT prosrc INTO old_src FROM pg_proc WHERE oid=fn;
  IF (length(old_src)-length(replace(old_src, anchor, '')))/length(anchor)<>1 THEN RAISE EXCEPTION 'APPLICATION_NOTE_CONTACT_ANCHOR'; END IF;
  expected := md5(replace(old_src, anchor, anchor||addition));
  def := pg_get_functiondef(fn);
  IF (length(def)-length(replace(def, anchor, '')))/length(anchor)<>1 THEN RAISE EXCEPTION 'APPLICATION_NOTE_CONTACT_DEF_ANCHOR'; END IF;
  EXECUTE replace(def, anchor, anchor||addition);
  IF md5((SELECT prosrc FROM pg_proc WHERE oid=fn))<>expected THEN RAISE EXCEPTION 'APPLICATION_NOTE_CONTACT_POSTIMAGE'; END IF;
END $patch$;

DO $post$
BEGIN
  IF NOT private.text_has_contact_v1('Zovite me na 064 123 4567')
  OR NOT private.text_has_contact_v1('+381641234567')
  OR NOT private.text_has_contact_v1('pera.peric@gmail.com')
  OR NOT private.text_has_contact_v1('vidi www.majstor.rs')
  OR NOT private.text_has_contact_v1('instagram @pera_majstor')
  OR private.text_has_contact_v1('Mogu 28.11.2026. od 08:00, cena 120.000 dinara, imam 15 godina iskustva')
  OR private.text_has_contact_v1(null)
  THEN RAISE EXCEPTION 'APPLICATION_NOTE_CONTACT_POSTIMAGE_RULE'; END IF;
END $post$;

COMMIT;
