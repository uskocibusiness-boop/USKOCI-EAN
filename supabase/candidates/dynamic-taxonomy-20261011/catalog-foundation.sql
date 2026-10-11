-- USKOCI CANDIDATE ONLY, NOT A LIVE MIGRATION. No DEV/PROD writes authorised.
-- Private, default-off catalog foundation. Needs separate risk-admission gateway,
-- user/worker confirmation, dispatcher integration and operator-approved promotion.
-- Test on disposable PostgreSQL first. All objects are additive.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.taxonomy_normalize_v1(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog
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

CREATE TABLE private.work_taxonomy_control (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 auto_registration_enabled boolean NOT NULL DEFAULT false,
 catalog_version bigint NOT NULL DEFAULT 1 CHECK (catalog_version > 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.work_taxonomy_control(singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE private.work_taxonomy_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 canonical_key text NOT NULL UNIQUE,
 label text NOT NULL,
 parent_id uuid REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT,
 state text NOT NULL DEFAULT 'AUTO_PROVISIONAL'
   CHECK (state IN ('AUTO_PROVISIONAL','ESTABLISHED','RETIRED')),
 source text NOT NULL CHECK (source IN ('SYSTEM','AI_REVIEWED','OPERATOR')),
 catalog_version bigint NOT NULL CHECK (catalog_version > 0),
 superseded_by uuid REFERENCES private.work_taxonomy_categories(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (char_length(canonical_key) BETWEEN 3 AND 160),
 CHECK (char_length(label) BETWEEN 3 AND 120),
 CHECK (superseded_by IS NULL OR superseded_by <> id),
 CHECK (parent_id IS NULL OR parent_id <> id),
 CHECK (canonical_key = private.taxonomy_normalize_v1(label))
);
CREATE INDEX work_taxonomy_category_parent_idx
 ON private.work_taxonomy_categories(parent_id,id) WHERE state <> 'RETIRED';

CREATE TABLE private.work_taxonomy_aliases (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 category_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT,
 locale text NOT NULL CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
 label text NOT NULL CHECK (char_length(label) BETWEEN 3 AND 120),
 normalized_key text GENERATED ALWAYS AS (private.taxonomy_normalize_v1(label)) STORED,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (locale,normalized_key)
);
CREATE INDEX work_taxonomy_alias_category_idx ON private.work_taxonomy_aliases(category_id);

CREATE TABLE private.work_taxonomy_relations (
 source_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id),
 target_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id),
 relation text NOT NULL CHECK (relation IN
  ('EQUIVALENT_VERIFIED','RELATED_SUGGESTED','CAPABILITY_CONFIRMED','INCOMPATIBLE')),
 verification text NOT NULL DEFAULT 'PROPOSED'
   CHECK (verification IN ('PROPOSED','VERIFIED','REJECTED')),
 evidence_ref text,
 version bigint NOT NULL CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(source_id,target_id,relation),
 CHECK (source_id <> target_id),
 CHECK (verification <> 'VERIFIED' OR evidence_ref IS NOT NULL),
 CHECK (relation <> 'CAPABILITY_CONFIRMED' OR verification = 'VERIFIED')
);
CREATE INDEX work_taxonomy_relation_target_idx
 ON private.work_taxonomy_relations(target_id,relation,verification);

-- Worker rows can only be marked confirmed by an explicit worker-confirmation flow.
-- No matching RPC consumes these rows yet.
CREATE TABLE private.work_taxonomy_worker_capabilities (
 worker_account_id uuid NOT NULL,
 category_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id),
 confirmed_at timestamptz NOT NULL,
 allow_related_offers boolean NOT NULL DEFAULT false,
 excluded boolean NOT NULL DEFAULT false,
 origin text NOT NULL CHECK (origin IN ('WORKER_CONFIRMED','WORKER_CORRECTED')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(worker_account_id,category_id)
);
CREATE INDEX work_taxonomy_worker_lookup_idx
 ON private.work_taxonomy_worker_capabilities(category_id,worker_account_id)
 WHERE excluded = false;

CREATE TABLE private.work_taxonomy_need_snapshots (
 need_id uuid NOT NULL REFERENCES public.needs(id) ON DELETE RESTRICT,
 need_revision integer NOT NULL CHECK (need_revision > 0),
 category_id uuid REFERENCES private.work_taxonomy_categories(id),
 catalog_version bigint NOT NULL CHECK (catalog_version > 0),
 reviewed_by_requester boolean NOT NULL DEFAULT false,
 source text NOT NULL CHECK (source IN ('AI_PROPOSED','REQUESTER_CORRECTED','SYSTEM_MIGRATED')),
 classification_state text NOT NULL
   CHECK (classification_state IN ('CONFIRMED','NEEDS_CLARIFICATION','SAFETY_REVIEW')),
 original_category text,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(need_id,need_revision),
 CHECK (classification_state <> 'CONFIRMED'
        OR (category_id IS NOT NULL AND reviewed_by_requester))
);
CREATE INDEX work_taxonomy_need_by_category_idx
 ON private.work_taxonomy_need_snapshots(category_id,need_id)
 WHERE classification_state = 'CONFIRMED';

CREATE TABLE private.work_taxonomy_need_skills (
 need_id uuid NOT NULL,
 need_revision integer NOT NULL,
 category_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id),
 PRIMARY KEY(need_id,need_revision,category_id),
 FOREIGN KEY(need_id,need_revision)
   REFERENCES private.work_taxonomy_need_snapshots(need_id,need_revision)
   ON DELETE RESTRICT
);
CREATE INDEX work_taxonomy_need_skill_lookup_idx
 ON private.work_taxonomy_need_skills(category_id,need_id,need_revision);

CREATE TABLE private.work_taxonomy_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 action text NOT NULL CHECK (action IN
  ('AUTO_CREATED','EXISTING_REUSED','ALIAS_COLLISION','CORRECTED','RETIRED','MERGED')),
 category_id uuid REFERENCES private.work_taxonomy_categories(id),
 normalized_key text NOT NULL,
 catalog_version bigint NOT NULL,
 source_ref text,
 at timestamptz NOT NULL DEFAULT now()
);

-- This is a conservative DATA-DRIVEN risk vocabulary, not the work catalog.
-- New types have no fixed ceiling. Unrecognized actions are review-only until
-- a separately validated admission policy is extended.
CREATE TABLE private.work_taxonomy_risk_actions (
 normalized_action text PRIMARY KEY,
 policy_version bigint NOT NULL DEFAULT 1 CHECK (policy_version>0),
 enabled boolean NOT NULL DEFAULT true,
 CHECK (char_length(normalized_action) BETWEEN 3 AND 50)
);
INSERT INTO private.work_taxonomy_risk_actions(normalized_action) VALUES
 ('servis'),('popravka'),('izrada'),('fotografisanje'),
 ('dresiranje'),('3d stampanje'),('stampanje'),('krecenje'),
 ('farbanje'),('ciscenje'),('montaza'),('sivenje'),('setanje'),
 ('prevoz'),('odrzavanje'),('pravljenje'),('pakovanje');

CREATE TABLE private.work_taxonomy_risk_rules (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 pattern text NOT NULL,
 decision text NOT NULL CHECK (decision IN ('BLOCKED','REVIEW_REQUIRED')),
 policy_version bigint NOT NULL DEFAULT 1 CHECK (policy_version>0),
 enabled boolean NOT NULL DEFAULT true,
 CHECK (char_length(pattern) BETWEEN 3 AND 300)
);
-- These rules are intentionally incomplete: conservative CI examples only,
-- NOT a general content safety certificate for every possible task.
INSERT INTO private.work_taxonomy_risk_rules(pattern,decision) VALUES
 ('(oruzj|municij|eksploziv|bomb|droga|narkotik|kokain|heroin|falsifik|hakovanj|prostituc|pornograf)','BLOCKED'),
 ('(elektric|elektroinstal|solarn|gasn|plinsk|dron|baterij|medicin|hirurg|lekov|pesticid|hemij|azbest|visinsk|licenc|vatren|opasn)','REVIEW_REQUIRED');

CREATE OR REPLACE FUNCTION private.taxonomy_risk_triage_v1(p_label text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $risk$
DECLARE v_key text;
BEGIN
 v_key:=private.taxonomy_normalize_v1(p_label);
 IF v_key='' OR char_length(v_key)<6 OR v_key !~ '^[[:alnum:]]'
    OR v_key !~ '[[:space:]]' THEN
   RETURN 'NEEDS_CLARIFICATION';
 END IF;
 IF v_key ~ '(^|[[:space:]])(ostalo|drugo|razno|sve|svasta|poslovi|usluge)($|[[:space:]])'
 THEN RETURN 'NEEDS_CLARIFICATION'; END IF;
 IF EXISTS (SELECT 1 FROM private.work_taxonomy_risk_rules
            WHERE enabled AND decision='BLOCKED' AND v_key ~ pattern)
 THEN RETURN 'BLOCKED'; END IF;
 IF EXISTS (SELECT 1 FROM private.work_taxonomy_risk_rules
            WHERE enabled AND decision='REVIEW_REQUIRED' AND v_key ~ pattern)
 THEN RETURN 'REVIEW_REQUIRED'; END IF;
 IF NOT EXISTS (SELECT 1 FROM private.work_taxonomy_risk_actions
                WHERE enabled AND v_key LIKE normalized_action||' %')
 THEN RETURN 'NEEDS_CLARIFICATION'; END IF;
 RETURN 'LOW_RISK_CANDIDATE';
END
$risk$;

-- All catalog mutations are barred from app roles. Even if this candidate is
-- installed in the future, the feature flag starts OFF. This function only
-- accepts server-admitted, owner-reviewed, low-risk labels. Its caller must
-- independently validate safety; it is NOT an open AI-to-SQL gateway.
CREATE OR REPLACE FUNCTION private.taxonomy_register_low_risk_v1(
 p_label text, p_policy_decision text, p_requester_reviewed boolean
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, private
AS $function$
DECLARE
 v_key text;
 v_id uuid;
 v_version bigint;
 v_inserted integer;
 v_alias_owner uuid;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM private.work_taxonomy_control
                WHERE singleton AND auto_registration_enabled) THEN
   RAISE EXCEPTION 'TAXONOMY_AUTO_REGISTRATION_DISABLED';
 END IF;
 IF p_policy_decision IS DISTINCT FROM 'LOW_RISK_VERIFIED'
    OR p_requester_reviewed IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'TAXONOMY_ADMISSION_REFUSED';
 END IF;
 IF p_label IS NULL OR char_length(btrim(p_label)) NOT BETWEEN 3 AND 120
    OR p_label ~ '[<>{}\\]' OR p_label ~ '[[:cntrl:]]'
    OR p_label !~ '^[[:alpha:][:digit:]]'
 THEN RAISE EXCEPTION 'TAXONOMY_INVALID_LABEL'; END IF;
 v_key := private.taxonomy_normalize_v1(p_label);
 IF v_key IN ('ostalo','drugo','razno') OR char_length(v_key) < 3 THEN
   RAISE EXCEPTION 'TAXONOMY_AMBIGUOUS_LABEL';
 END IF;
 -- A caller-provided risk decision NEVER suffices for admission.
 IF private.taxonomy_risk_triage_v1(p_label) = 'BLOCKED' THEN
   RAISE EXCEPTION 'TAXONOMY_UNSAFE_LABEL';
 ELSIF private.taxonomy_risk_triage_v1(p_label) <> 'LOW_RISK_CANDIDATE' THEN
   RAISE EXCEPTION 'TAXONOMY_REVIEW_REQUIRED';
 END IF;
 -- A short-lived lock prevents duplicate category-version bumps.
 SELECT catalog_version INTO STRICT v_version
 FROM private.work_taxonomy_control WHERE singleton FOR UPDATE;
 -- Reuse a trusted existing alias before creating a new canonical identity.
 SELECT a.category_id INTO v_id FROM private.work_taxonomy_aliases a
 JOIN private.work_taxonomy_categories c ON c.id=a.category_id
 WHERE a.locale='sr' AND a.normalized_key=v_key AND c.state <> 'RETIRED';
 IF v_id IS NOT NULL THEN
   INSERT INTO private.work_taxonomy_audit
     (action,category_id,normalized_key,catalog_version)
   VALUES ('EXISTING_REUSED',v_id,v_key,v_version);
   RETURN jsonb_build_object('action','REUSE_EXISTING','categoryId',v_id,
           'catalogVersion',v_version,'notificationAuthority','NONE');
 END IF;
 INSERT INTO private.work_taxonomy_categories
   (canonical_key,label,source,catalog_version)
 VALUES (v_key,btrim(p_label),'AI_REVIEWED',v_version + 1)
 ON CONFLICT(canonical_key) DO NOTHING
 RETURNING id INTO v_id;
 GET DIAGNOSTICS v_inserted = ROW_COUNT;
 IF v_inserted = 0 THEN
   SELECT id INTO STRICT v_id
   FROM private.work_taxonomy_categories
   WHERE canonical_key=v_key AND state <> 'RETIRED';
 ELSE
   UPDATE private.work_taxonomy_control
     SET catalog_version=v_version + 1,updated_at=now() WHERE singleton;
   v_version := v_version + 1;
 END IF;
 -- Unique alias assignment cannot silently rebind a term to another category.
 INSERT INTO private.work_taxonomy_aliases(category_id,locale,label)
 VALUES (v_id,'sr',btrim(p_label)) ON CONFLICT(locale,normalized_key) DO NOTHING;
 SELECT category_id INTO v_alias_owner FROM private.work_taxonomy_aliases
  WHERE locale='sr' AND normalized_key=v_key;
 IF v_alias_owner IS DISTINCT FROM v_id THEN
   RAISE EXCEPTION 'TAXONOMY_ALIAS_COLLISION';
 END IF;
 INSERT INTO private.work_taxonomy_audit(action,category_id,normalized_key,catalog_version)
 VALUES (CASE WHEN v_inserted=1 THEN 'AUTO_CREATED' ELSE 'EXISTING_REUSED' END,
         v_id,v_key,v_version);
 RETURN jsonb_build_object(
   'action',CASE WHEN v_inserted=1 THEN 'CREATE_AUTO_PROVISIONAL'
                 ELSE 'REUSE_EXISTING' END,
   'categoryId',v_id,'catalogVersion',v_version,
   'notificationAuthority','NONE');
END
$function$;

-- Defense in depth: explicitly enable RLS even though private is non-exposed.
ALTER TABLE private.work_taxonomy_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.work_taxonomy_risk_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.work_taxonomy_risk_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.work_taxonomy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.work_taxonomy_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.work_taxonomy_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.work_taxonomy_worker_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.work_taxonomy_need_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.work_taxonomy_need_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.work_taxonomy_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION private.taxonomy_normalize_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.taxonomy_risk_triage_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.taxonomy_register_low_risk_v1(text,text,boolean) FROM PUBLIC;
REVOKE ALL ON
 private.work_taxonomy_control,private.work_taxonomy_categories,
 private.work_taxonomy_aliases,private.work_taxonomy_relations,
 private.work_taxonomy_worker_capabilities,private.work_taxonomy_need_snapshots,
 private.work_taxonomy_need_skills,private.work_taxonomy_audit,
 private.work_taxonomy_risk_actions,private.work_taxonomy_risk_rules FROM PUBLIC;
-- Installer/operator owns objects. Only service_role gets private catalog access.
GRANT USAGE ON SCHEMA private TO service_role;
-- Service-only runtime can read eligibility inputs but cannot fabricate worker
-- confirmations, evidence-verified relations or reviewed task snapshots.
-- Those writes require separately designed identity-bound authorization APIs.
GRANT SELECT ON
 private.work_taxonomy_control,private.work_taxonomy_categories,
 private.work_taxonomy_aliases,private.work_taxonomy_relations,
 private.work_taxonomy_worker_capabilities,private.work_taxonomy_need_snapshots,
 private.work_taxonomy_need_skills,private.work_taxonomy_audit,
 private.work_taxonomy_risk_actions,private.work_taxonomy_risk_rules TO service_role;
-- The registrar alone needs these minimal underlying DML privileges.
-- The runtime may increment catalog_version but cannot enable auto-registration.
-- Gate flips require the separate owner-approved operator pathway.
GRANT UPDATE (catalog_version,updated_at) ON private.work_taxonomy_control TO service_role;
GRANT INSERT ON
 private.work_taxonomy_categories,private.work_taxonomy_aliases,
 private.work_taxonomy_audit TO service_role;
GRANT USAGE,SELECT ON SEQUENCE
 private.work_taxonomy_aliases_id_seq,private.work_taxonomy_audit_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_normalize_v1(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_risk_triage_v1(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_register_low_risk_v1(text,text,boolean) TO service_role;
COMMIT;
