-- Disposable PG16/17 ONLY: no real accounts, tasks, notifications or tokens.
CREATE SCHEMA private;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
-- Exact canonical normalization copied from read-only current DEV definition.
CREATE OR REPLACE FUNCTION private.taxonomy_normalize_v1(p_value text)
 RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO 'pg_catalog'
AS $function$
 SELECT btrim(regexp_replace(
   translate(
     replace(replace(replace(replace(replace(replace(lower(btrim(coalesce(p_value,''))),
       'ђ','dj'),'љ','lj'),'њ','nj'),'џ','dz'),'đ','dj'),'ß','ss'),
     'абвгдежзијклмнопрстћуфхцчшčćšž',
     'abvgdezzijklmnoprstcufhccsccsz'
   ),
   '[[:space:]]+', ' ', 'g'
 ))
$function$;

CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
CREATE TABLE public.ai_conversations(id uuid PRIMARY KEY,account_id uuid,purpose text);
CREATE TABLE private.worker_ai_sessions(
  conversation_id uuid,account_id uuid,revision integer,candidate jsonb,base_hash text);
CREATE TABLE private.worker_ai_turns(
  turn_id uuid,account_id uuid,conversation_id uuid,client_request_id uuid,
  attempt_id uuid,state text);
CREATE TABLE private.ai_need_turn_commands(
  turn_id uuid,account_id uuid,conversation_id uuid,client_request_id uuid,
  attempt_id uuid,state text);
CREATE FUNCTION private.ai_task_review_source(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('conversationId',c.id,'purpose',c.purpose)
 FROM public.ai_conversations c WHERE c.id=p_id
$$;
INSERT INTO public.ai_conversations VALUES
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NEED_INTAKE');
INSERT INTO private.worker_ai_sessions VALUES
 ('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2,
  '{"skills":["Krecenje zidova","Casovi matematike"]}'::jsonb,'base-fingerprint');
INSERT INTO private.worker_ai_turns VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '99999999-9999-4999-8999-999999999999',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-dddddddddddd','SUCCEEDED'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '99999999-9999-4999-8999-999999999999',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeed','dddddddd-dddd-4ddd-8ddd-dddddddddddd','PROCESSING');
INSERT INTO private.ai_need_turn_commands VALUES
 ('77777777-7777-4777-8777-777777777777','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '66666666-6666-4666-8666-666666666666','55555555-5555-4555-8555-555555555555','SUCCEEDED');

-- A second independently confirmed turn permits testing a new complete snapshot.
INSERT INTO private.worker_ai_turns VALUES(
 'abababab-abab-4bab-8bab-abababababab','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '99999999-9999-4999-8999-999999999999',
 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd','efefefef-efef-4fef-8fef-efefefefefef','SUCCEEDED');
