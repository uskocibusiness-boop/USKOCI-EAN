-- USKOCI DEV: additive DARK LAUNCH for private work taxonomy. OWNER-APPROVED
-- NO AI/APP/DISPATCH/PUSH/USER INTEGRATION. NO existing rows rewritten.
-- Auto registration is OFF. Explicit service_role DML grants from candidate
-- are revoked before commit. This is non-operational server groundwork.
-- Single atomic migration. Drop nothing on rollback without distinct review.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';
DO $precheck$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='needs') THEN
  RAISE EXCEPTION 'USKOCI_TAXONOMY_NEEDS_TABLE_MISSING';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='private' AND c.relname LIKE 'work_taxonomy%')
 OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private' AND p.proname LIKE 'taxonomy_%') THEN
  RAISE EXCEPTION 'USKOCI_TAXONOMY_PARTIALLY_PRESENT_NO_AUTOMATIC_UPGRADE';
 END IF;
END $precheck$;

-- CANDIDATE COMPONENT: catalog-foundation.sql
-- USKOCI CANDIDATE ONLY, NOT A LIVE MIGRATION. No DEV/PROD writes authorised.
-- Private, default-off catalog foundation. Needs separate risk-admission gateway,
-- user/worker confirmation, dispatcher integration and operator-approved promotion.
-- Test on disposable PostgreSQL first. All objects are additive.

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
 max_auto_creates_per_hour integer NOT NULL DEFAULT 100
   CHECK (max_auto_creates_per_hour BETWEEN 1 AND 10000),
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
CREATE INDEX work_taxonomy_category_created_idx
 ON private.work_taxonomy_categories(created_at);
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
-- A locale-agnostic preview must not scan the complete synonym collection.
CREATE INDEX work_taxonomy_alias_lookup_idx
 ON private.work_taxonomy_aliases(normalized_key,category_id);

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
 v_hourly_cap integer;
 v_inserted integer;
 v_alias_owner uuid;
 v_existing_ids uuid[];
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
 -- A short-lived lock serializes admission, version and rate budget.
 SELECT catalog_version,max_auto_creates_per_hour
 INTO STRICT v_version,v_hourly_cap
 FROM private.work_taxonomy_control WHERE singleton FOR UPDATE;
 -- Identity reuse MUST be consistent with cross-locale preview. Never
 -- create a new ID when an alias in another script/locale already identifies it.
 SELECT array_agg(DISTINCT t.category_id) INTO v_existing_ids FROM (
   SELECT c.id AS category_id FROM private.work_taxonomy_categories c
    WHERE c.canonical_key=v_key AND c.state<>'RETIRED'
   UNION
   SELECT a.category_id FROM private.work_taxonomy_aliases a
   JOIN private.work_taxonomy_categories c ON c.id=a.category_id
    WHERE a.normalized_key=v_key AND c.state<>'RETIRED'
   UNION
   SELECT unnest(private.taxonomy_service_meaning_ids_v1(p_label))
 ) t;
 IF coalesce(cardinality(v_existing_ids),0)>1 THEN
   RAISE EXCEPTION 'TAXONOMY_ALIAS_COLLISION';
 END IF;
 v_id:=v_existing_ids[1];
 IF v_id IS NOT NULL THEN
   INSERT INTO private.work_taxonomy_audit
     (action,category_id,normalized_key,catalog_version)
   VALUES ('EXISTING_REUSED',v_id,v_key,v_version);
   RETURN jsonb_build_object('action','REUSE_EXISTING','categoryId',v_id,
           'catalogVersion',v_version,'notificationAuthority','NONE');
 END IF;
 -- The task may mention a different ROOM/PROJECT SCOPE for a known
 -- service. An unverified scope is NOT automatically a new work kind.
 -- Refuse and request clarification, rather than pollute the category catalog.
 IF private.taxonomy_service_needs_disambiguation_v1(p_label) THEN
   RAISE EXCEPTION 'TAXONOMY_POSSIBLE_EXISTING_SERVICE';
 END IF;
 -- Reusing aliases is always allowed; only new identities consume budget.
 -- The lock above makes concurrent rate accounting serial and deterministic.
 IF (SELECT count(*) FROM private.work_taxonomy_categories
     WHERE created_at > now() - interval '1 hour') >= v_hourly_cap THEN
   RAISE EXCEPTION 'TAXONOMY_AUTO_RATE_LIMITED';
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


-- CANDIDATE COMPONENT: service-meaning.sql
-- Candidate ONLY: verified work-intent identity, separate from task scope.
-- "Krecenje sobe" and "krecenje stana" can reuse one service UUID.
-- No general fuzzy or embedding similarity; unverified object/scope fails closed.

CREATE TABLE private.work_taxonomy_service_meanings (
 category_id uuid PRIMARY KEY REFERENCES private.work_taxonomy_categories(id),
 canonical_action text NOT NULL,
 canonical_object text NOT NULL,
 source_ref text NOT NULL CHECK (char_length(source_ref) BETWEEN 3 AND 200),
 verified_at timestamptz NOT NULL,
 UNIQUE(canonical_action,canonical_object),
 CHECK (canonical_action = private.taxonomy_normalize_v1(canonical_action)),
 CHECK (canonical_object = private.taxonomy_normalize_v1(canonical_object)),
 CHECK (char_length(canonical_action) BETWEEN 3 AND 80),
 CHECK (char_length(canonical_object) BETWEEN 3 AND 120)
);
CREATE TABLE private.work_taxonomy_service_verbs (
 category_id uuid NOT NULL REFERENCES private.work_taxonomy_service_meanings(category_id),
 normalized_action text NOT NULL,
 source_ref text NOT NULL,
 PRIMARY KEY(category_id,normalized_action),
 CHECK (normalized_action = private.taxonomy_normalize_v1(normalized_action)),
 CHECK (normalized_action ~ '^[[:alnum:]]+$')
);
CREATE INDEX work_taxonomy_service_verbs_lookup
 ON private.work_taxonomy_service_verbs(normalized_action,category_id);

-- Scope phrases are *modifiers*, not distinct service categories.
-- Each mapping is curated/confirmed; no AI-suggested phrase is trusted directly.
CREATE TABLE private.work_taxonomy_service_scopes (
 category_id uuid NOT NULL REFERENCES private.work_taxonomy_service_meanings(category_id),
 normalized_scope text NOT NULL,
 scope_role text NOT NULL CHECK (scope_role IN ('PLACE','SIZE','TARGET')),
 source_ref text NOT NULL,
 PRIMARY KEY(category_id,normalized_scope),
 CHECK (normalized_scope = private.taxonomy_normalize_v1(normalized_scope)),
 CHECK (char_length(normalized_scope) BETWEEN 3 AND 120)
);
CREATE INDEX work_taxonomy_service_scopes_lookup
 ON private.work_taxonomy_service_scopes(category_id,normalized_scope);

-- This is a *bounded verified language grammar*. It refuses non-exact tails:
-- "krecenje sobe i instalacija uticnice" cannot match "krecenje sobe".
CREATE OR REPLACE FUNCTION private.taxonomy_service_meaning_ids_v1(p_label text)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $function$
 SELECT coalesce(array_agg(DISTINCT v.category_id),ARRAY[]::uuid[])
 FROM private.work_taxonomy_service_verbs v
 JOIN private.work_taxonomy_service_scopes s
   ON s.category_id=v.category_id
 JOIN private.work_taxonomy_service_meanings m
   ON m.category_id=v.category_id
 JOIN private.work_taxonomy_categories c
   ON c.id=v.category_id
 WHERE c.state<>'RETIRED'
   AND v.normalized_action =
     split_part(private.taxonomy_normalize_v1(p_label),' ',1)
   -- A numeric quantity (e.g. "2 sobe") is task SCOPE, not a work kind.
   -- Strip it only when the remaining complete phrase is VERIFIED in the
   -- trusted scope registry; "2 automobila" cannot become "sobe".
   AND s.normalized_scope =
     regexp_replace(
       substr(private.taxonomy_normalize_v1(p_label),
              char_length(v.normalized_action)+2),
       '^[1-9][0-9]{0,2}[[:space:]]+', ''
     )
$function$;

-- Used only when no exact verified meaning has matched. Prevent accidental
-- duplicate service creation for an unfamiliar place/object qualifier.
-- It is *not* proof that the work is equivalent.
CREATE OR REPLACE FUNCTION private.taxonomy_service_needs_disambiguation_v1(p_label text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $function$
 SELECT EXISTS (
   SELECT 1 FROM private.work_taxonomy_service_verbs v
   JOIN private.work_taxonomy_categories c ON c.id=v.category_id
   WHERE c.state<>'RETIRED'
     AND v.normalized_action=split_part(private.taxonomy_normalize_v1(p_label),' ',1)
 )
$function$;

ALTER TABLE private.work_taxonomy_service_meanings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.work_taxonomy_service_verbs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.work_taxonomy_service_scopes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_taxonomy_service_meanings,
  private.work_taxonomy_service_verbs,private.work_taxonomy_service_scopes FROM PUBLIC;
REVOKE ALL ON FUNCTION private.taxonomy_service_meaning_ids_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.taxonomy_service_needs_disambiguation_v1(text) FROM PUBLIC;
GRANT SELECT ON private.work_taxonomy_service_meanings,
  private.work_taxonomy_service_verbs,private.work_taxonomy_service_scopes TO service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_service_meaning_ids_v1(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_service_needs_disambiguation_v1(text) TO service_role;
-- Only a separately identity-bound, audited and trusted operator/classifier
-- workflow may insert verified semantic grammar; runtime service can't invent it.


-- CANDIDATE COMPONENT: capability-tier.sql
-- USKOCI SQL CANDIDATE, NOT CONNECTED TO LIVE DISPATCH.
-- A purely capability-level tier, not full dispatch eligibility. Never sends.

CREATE TABLE private.work_taxonomy_related_acceptances (
 worker_account_id uuid NOT NULL,
 source_category_id uuid NOT NULL,
 target_category_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id),
 explicitly_confirmed_at timestamptz NOT NULL,
 relationship_version bigint NOT NULL CHECK (relationship_version > 0),
 PRIMARY KEY(worker_account_id,source_category_id,target_category_id),
 FOREIGN KEY(worker_account_id,source_category_id)
  REFERENCES private.work_taxonomy_worker_capabilities(worker_account_id,category_id),
 CHECK (source_category_id<>target_category_id)
);
CREATE INDEX work_taxonomy_related_target_idx
 ON private.work_taxonomy_related_acceptances(target_category_id,worker_account_id);
ALTER TABLE private.work_taxonomy_related_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_taxonomy_related_acceptances FROM PUBLIC;
-- Verified related acceptance must be written only through a later identity-bound flow.
GRANT SELECT ON private.work_taxonomy_related_acceptances TO service_role;

CREATE OR REPLACE FUNCTION private.taxonomy_capability_tier_v1(
 p_need_id uuid, p_need_revision integer, p_worker_account_id uuid
) RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, private
AS $function$
DECLARE
 req uuid;
 found_requirement boolean := false;
 match_rank integer;
 overall_rank integer := 3;
BEGIN
 IF p_worker_account_id IS NULL OR p_need_id IS NULL OR p_need_revision IS NULL THEN
  RETURN 'NO_SAFE_MATCH';
 END IF;
 -- A snapshot is never an entitlement unless explicitly confirmed by publisher.
 IF NOT EXISTS (
  SELECT 1 FROM private.work_taxonomy_need_snapshots s
  WHERE s.need_id=p_need_id AND s.need_revision=p_need_revision
    AND s.classification_state='CONFIRMED' AND s.reviewed_by_requester
    AND s.category_id IS NOT NULL
 ) THEN RETURN 'NO_SAFE_MATCH'; END IF;
 -- The primary work type is always mandatory. Explicit additional
 -- competencies are conjunctive; they never replace the primary service.
 -- This is a capability check only and grants no notification entitlement.
 FOR req IN
  SELECT s.category_id FROM private.work_taxonomy_need_snapshots s
  WHERE s.need_id=p_need_id AND s.need_revision=p_need_revision
  UNION ALL
  SELECT x.category_id FROM private.work_taxonomy_need_skills x
  WHERE x.need_id=p_need_id AND x.need_revision=p_need_revision
 LOOP
  found_requirement := true;
  -- A worker's explicit opt-out for the requested work always wins over
  -- equivalent or related grants from a *different* confirmed skill.
  IF EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities e
    WHERE e.worker_account_id=p_worker_account_id
      AND e.category_id=req AND e.excluded
  ) THEN RETURN 'NO_SAFE_MATCH'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.work_taxonomy_categories c
                 WHERE c.id=req AND c.state<>'RETIRED') THEN
   RETURN 'NO_SAFE_MATCH';
  END IF;
  match_rank := 0;
  -- EXACT: the worker personally confirmed the canonical skill.
  IF EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities w
    WHERE w.worker_account_id=p_worker_account_id
      AND w.category_id=req AND NOT w.excluded
  ) THEN match_rank := 3;
  -- EQUIVALENT: a trusted, verified directed equivalence, not fuzzy AI proximity.
  ELSIF EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities w
    JOIN private.work_taxonomy_relations r
      ON r.source_id=w.category_id AND r.target_id=req
    WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded
      AND r.relation='EQUIVALENT_VERIFIED'
      AND r.verification='VERIFIED' AND r.evidence_ref IS NOT NULL
  ) THEN match_rank := 2;
  -- RELATED: BOTH a verified competence relationship AND THIS worker's
  -- explicit acceptance of this exact source -> target work, with opt-in.
  ELSIF EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities w
    JOIN private.work_taxonomy_relations r
      ON r.source_id=w.category_id AND r.target_id=req
    JOIN private.work_taxonomy_related_acceptances a
      ON a.worker_account_id=w.worker_account_id
     AND a.source_category_id=w.category_id AND a.target_category_id=req
     AND a.relationship_version=r.version
    WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded
      AND w.allow_related_offers
      AND r.relation='CAPABILITY_CONFIRMED'
      AND r.verification='VERIFIED' AND r.evidence_ref IS NOT NULL
  ) THEN match_rank := 1;
  END IF;
  IF match_rank=0 THEN RETURN 'NO_SAFE_MATCH'; END IF;
  overall_rank := LEAST(overall_rank,match_rank);
 END LOOP;
 IF NOT found_requirement THEN RETURN 'NO_SAFE_MATCH'; END IF;
 RETURN CASE overall_rank WHEN 3 THEN 'EXACT'
                           WHEN 2 THEN 'EQUIVALENT'
                           WHEN 1 THEN 'RELATED_CONFIRMED'
                           ELSE 'NO_SAFE_MATCH' END;
END
$function$;
REVOKE ALL ON FUNCTION private.taxonomy_capability_tier_v1(uuid,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.taxonomy_capability_tier_v1(uuid,integer,uuid) TO service_role;


-- CANDIDATE COMPONENT: catalog-preview.sql
-- READ-ONLY server-side classification preview. No event, push or INSERT.
-- This is a candidate. Never expose it as an unrestricted public RPC.

CREATE OR REPLACE FUNCTION private.taxonomy_preview_v1(p_label text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $preview$
DECLARE
 v_key text;
 v_risk text;
 v_ids uuid[];
 v_version bigint;
 v_auto_enabled boolean;
BEGIN
 IF p_label IS NULL OR char_length(btrim(p_label)) NOT BETWEEN 3 AND 120
    OR p_label ~ '[<>{}\\]' OR p_label ~ '[[:cntrl:]]'
 THEN RETURN jsonb_build_object('action','CLARIFY','reason','INVALID_LABEL',
                                'notificationAuthority','NONE'); END IF;
 v_key:=private.taxonomy_normalize_v1(p_label);
 v_risk:=private.taxonomy_risk_triage_v1(p_label);
 IF v_risk='BLOCKED' THEN
  RETURN jsonb_build_object('action','REJECT','reason','PROHIBITED_WORK',
                            'notificationAuthority','NONE');
 ELSIF v_risk='REVIEW_REQUIRED' THEN
  RETURN jsonb_build_object('action','SAFETY_REVIEW','reason','REGULATED_OR_RISKY_WORK',
                            'notificationAuthority','NONE');
 ELSIF v_risk<>'LOW_RISK_CANDIDATE' THEN
  RETURN jsonb_build_object('action','CLARIFY','reason','WORK_MEANING_UNCLEAR',
                            'notificationAuthority','NONE');
 END IF;
 SELECT catalog_version,auto_registration_enabled
 INTO v_version,v_auto_enabled
 FROM private.work_taxonomy_control WHERE singleton=true;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('action','UNAVAILABLE','reason','CATALOG_UNAVAILABLE',
                            'notificationAuthority','NONE');
 END IF;
 SELECT array_agg(DISTINCT t.category_id)
 INTO v_ids FROM (
   SELECT c.id AS category_id FROM private.work_taxonomy_categories c
    WHERE c.canonical_key=v_key AND c.state<>'RETIRED'
   UNION
   SELECT a.category_id FROM private.work_taxonomy_aliases a
   JOIN private.work_taxonomy_categories c
     ON c.id=a.category_id
   WHERE a.normalized_key=v_key AND c.state<>'RETIRED'
   UNION
   SELECT unnest(private.taxonomy_service_meaning_ids_v1(p_label))
 ) t;
 IF coalesce(cardinality(v_ids),0)>1 THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','AMBIGUOUS_ALIAS_COLLISION',
                             'catalogVersion',v_version,'notificationAuthority','NONE');
 END IF;
 IF coalesce(cardinality(v_ids),0)=1 THEN
   RETURN jsonb_build_object('action','REUSE_EXISTING','categoryId',v_ids[1],
                             'catalogVersion',v_version,'requiresRequesterReview',true,
                             'notificationAuthority','NONE');
 END IF;
 IF private.taxonomy_service_needs_disambiguation_v1(p_label) THEN
   RETURN jsonb_build_object('action','CLARIFY',
                             'reason','POSSIBLE_EXISTING_SERVICE',
                             'catalogVersion',v_version,
                             'notificationAuthority','NONE');
 END IF;
 -- Candidate ID is never invented by the model or this preview.
 -- This preview cannot commit even if the operator enables auto-registration.
 RETURN jsonb_build_object(
   'action','PROPOSE_AUTO_PROVISIONAL',
   'normalizedKey',v_key,'catalogVersion',v_version,
   'requiresRequesterReview',true,'requiresServerAdmission',true,
   'registrationEnabled',v_auto_enabled,'notificationAuthority','NONE');
END
$preview$;
REVOKE ALL ON FUNCTION private.taxonomy_preview_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.taxonomy_preview_v1(text) TO service_role;


-- CANDIDATE COMPONENT: natural-task-preview.sql
-- SOURCE-ONLY candidate: narrowly verified natural task parsing (read-only).
-- No LLM inference, no category writes, no worker eligibility, no dispatch.
-- Action/scope and sentence prefixes come from separate reviewed data.

CREATE TABLE private.work_taxonomy_sentence_prefixes (
 normalized_prefix text PRIMARY KEY,
 provenance_ref text NOT NULL CHECK (char_length(provenance_ref) BETWEEN 3 AND 200),
 CHECK (char_length(normalized_prefix) BETWEEN 6 AND 120),
 CHECK (normalized_prefix = private.taxonomy_normalize_v1(normalized_prefix))
);
ALTER TABLE private.work_taxonomy_sentence_prefixes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_taxonomy_sentence_prefixes FROM PUBLIC;
GRANT SELECT ON private.work_taxonomy_sentence_prefixes TO service_role;

-- This bounded grammar intentionally prefers CLARIFY over semantic guessing.
-- Risk scan covers the FULL sentence before trimming a conversational prefix.
CREATE OR REPLACE FUNCTION private.taxonomy_natural_task_preview_v1(p_task text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $natural$
DECLARE
 v_raw text;
 v_body text;
 v_prefix text;
 v_area_txt text;
 v_area integer;
 v_subject text;
 v_ids uuid[];
 v_version bigint;
 v_action text;
 v_scope text;
BEGIN
 IF p_task IS NULL OR char_length(btrim(p_task)) NOT BETWEEN 7 AND 1000
    OR p_task ~ '[<>{}\\]' OR p_task ~ '[[:cntrl:]]'
 THEN RETURN jsonb_build_object('action','CLARIFY','reason','INVALID_TEXT',
                                'notificationAuthority','NONE'); END IF;
 -- Trim only terminal sentence punctuation. Retain all actual work clauses.
 v_raw:=regexp_replace(
   private.taxonomy_normalize_v1(p_task),
   '[[:space:]]*[.!?]+[[:space:]]*$',''
 );
 IF EXISTS (
   SELECT 1 FROM private.work_taxonomy_risk_rules r
   WHERE r.enabled AND r.decision='BLOCKED' AND v_raw ~ r.pattern
 ) THEN RETURN jsonb_build_object('action','REJECT','reason','PROHIBITED_CONTENT',
                                   'notificationAuthority','NONE'); END IF;
 IF EXISTS (
   SELECT 1 FROM private.work_taxonomy_risk_rules r
   WHERE r.enabled AND r.decision='REVIEW_REQUIRED' AND v_raw ~ r.pattern
 ) THEN RETURN jsonb_build_object('action','SAFETY_REVIEW',
                                   'reason','POSSIBLY_REGULATED_CONTENT',
                                   'notificationAuthority','NONE'); END IF;

 -- Prefixes are vetted, non-user-editable data. Prefer longest matching one.
 SELECT x.normalized_prefix INTO v_prefix
 FROM private.work_taxonomy_sentence_prefixes x
 WHERE v_raw LIKE x.normalized_prefix||' %'
 ORDER BY char_length(x.normalized_prefix) DESC
 LIMIT 1;
 IF v_prefix IS NOT NULL THEN
   v_body:=substr(v_raw,char_length(v_prefix)+2);
 ELSE
   v_body:=v_raw;
 END IF;
 -- Only one explicit area format is safe to extract automatically here.
 -- Do NOT discard other tails, conjunctions, prices or qualifications.
 v_area_txt:=substring(v_body FROM
   '[[:space:]]+od[[:space:]]+([1-9][0-9]{0,3})[[:space:]]*(kvadrata|m2|m²)$');
 IF v_area_txt IS NOT NULL THEN
   v_area:=v_area_txt::integer;
   v_body:=regexp_replace(v_body,
     '[[:space:]]+od[[:space:]]+[1-9][0-9]{0,3}[[:space:]]*(kvadrata|m2|m²)$','');
 END IF;
 v_subject:=v_body;
 v_action:=split_part(v_subject,' ',1);
 v_scope:=substr(v_subject,char_length(v_action)+2);
 -- Avoid a bare "paint" action matching all kinds of objects.
 IF v_scope IS NULL OR char_length(v_scope)<3 THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','MISSING_VERIFIED_SCOPE',
                             'notificationAuthority','NONE'); END IF;
 SELECT catalog_version INTO v_version
 FROM private.work_taxonomy_control WHERE singleton=true;
 IF v_version IS NULL THEN RETURN jsonb_build_object('action','UNAVAILABLE',
   'reason','CATALOG_UNAVAILABLE','notificationAuthority','NONE'); END IF;

 -- Shared exact service resolver; no model-proposed IDs or freeform similarity.
 v_ids:=private.taxonomy_service_meaning_ids_v1(v_subject);
 IF coalesce(cardinality(v_ids),0)>1 THEN
  RETURN jsonb_build_object('action','CLARIFY','reason','AMBIGUOUS_SERVICE',
                            'catalogVersion',v_version,
                            'notificationAuthority','NONE');
 END IF;
 IF coalesce(cardinality(v_ids),0)=1 THEN
  RETURN jsonb_build_object(
   'action','REUSE_EXISTING','categoryId',v_ids[1],
   'normalizedAction',v_action,'normalizedScope',v_scope,
   'areaSqm',v_area,'catalogVersion',v_version,
   'requiresRequesterReview',true,'requiresFullEligibility',true,
   'proofType','VERIFIED_GRAMMAR','notificationAuthority','NONE');
 END IF;
 RETURN jsonb_build_object(
   'action','CLARIFY','reason','UNVERIFIED_SERVICE_OR_COMPOUND_TASK',
   'normalizedAction',v_action,'catalogVersion',v_version,
   'notificationAuthority','NONE');
END
$natural$;
REVOKE ALL ON FUNCTION private.taxonomy_natural_task_preview_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.taxonomy_natural_task_preview_v1(text) TO service_role;


-- CANDIDATE COMPONENT: ai-claim-review.sql
-- SOURCE-ONLY guard for an eventual AI extraction proposal.
-- AI suggestions are NEVER allowed to confer category, worker or push authority.
-- Verify the candidate against independently recognized user text and a trusted
-- action/object/scope grammar; final action is still requester's review, not save.

CREATE OR REPLACE FUNCTION private.taxonomy_ai_claim_review_v1(
 p_original_task text, p_claim jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $review$
DECLARE
 v_server jsonb;
 v_decision text;
BEGIN
 -- Always inspect the actual original task FIRST, even for malformed AI JSON.
 v_server:=private.taxonomy_natural_task_preview_v1(p_original_task);
 v_decision:=v_server->>'action';
 IF v_decision <> 'REUSE_EXISTING' THEN
   RETURN jsonb_build_object(
    'action',v_decision,'reason',coalesce(v_server->>'reason','NOT_VERIFIED'),
    'publishAuthority','NONE','notificationAuthority','NONE');
 END IF;
 IF p_claim IS NULL OR jsonb_typeof(p_claim)<>'object'
 OR NOT (p_claim ? 'categoryId')
 OR NOT (p_claim ? 'normalizedAction')
 OR NOT (p_claim ? 'normalizedScope')
 OR NOT (p_claim ? 'areaSqm')
 OR p_claim->>'categoryId' IS DISTINCT FROM v_server->>'categoryId'
 OR p_claim->>'normalizedAction' IS DISTINCT FROM v_server->>'normalizedAction'
 OR p_claim->>'normalizedScope' IS DISTINCT FROM v_server->>'normalizedScope'
 OR p_claim->>'areaSqm' IS DISTINCT FROM v_server->>'areaSqm'
 OR jsonb_typeof(p_claim->'categoryId') <> 'string'
 OR jsonb_typeof(p_claim->'normalizedAction') <> 'string'
 OR jsonb_typeof(p_claim->'normalizedScope') <> 'string'
 OR jsonb_typeof(p_claim->'areaSqm') NOT IN ('number','null') THEN
   RETURN jsonb_build_object('action','CLARIFY',
       'reason','AI_CLAIM_NOT_VERIFIED','publishAuthority','NONE',
       'notificationAuthority','NONE');
 END IF;
 RETURN jsonb_build_object(
   'action','READY_FOR_REQUESTER_REVIEW',
   'categoryId',v_server->>'categoryId',
   'normalizedAction',v_server->>'normalizedAction',
   'normalizedScope',v_server->>'normalizedScope',
   'areaSqm',v_server->'areaSqm',
   'catalogVersion',(v_server->>'catalogVersion')::bigint,
   'proofType','INDEPENDENT_SERVER_GRAMMAR',
   'requiresRequesterReview',true,
   'requiresFullEligibility',true,
   'publishAuthority','NONE','notificationAuthority','NONE');
END
$review$;
REVOKE ALL ON FUNCTION private.taxonomy_ai_claim_review_v1(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.taxonomy_ai_claim_review_v1(text,jsonb) TO service_role;


-- CANDIDATE COMPONENT: existing-ai-category-bridge.sql
-- SOURCE ONLY: a read-only adapter for the EXISTING Gemini NEED_FACT_V2
-- interview's need.category + need.description, NOT a second chatbot.
-- Never trusts a model category ID or invents worker skills. NOT DEPLOYED.

CREATE OR REPLACE FUNCTION private.taxonomy_existing_ai_category_preview_v1(
 p_ai_category text, p_public_description text, p_explicit_required_skills text[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $adapter$
DECLARE
 v_result jsonb;
 v_description text;
 v_label text;
 v_normalized_description text;
 v_category_ids uuid[];
 v_category_id uuid;
 v_version bigint;
 v_kind text;
BEGIN
 -- The existing interview can compose long, natural-language descriptions.
 -- Their grammar is NOT re-parsed as a fixed short sentence template.
 IF p_ai_category IS NULL OR char_length(btrim(p_ai_category)) NOT BETWEEN 3 AND 120
 OR p_public_description IS NULL
 OR char_length(btrim(p_public_description)) NOT BETWEEN 3 AND 6000
 OR p_ai_category ~ '[<>{}\\]' OR p_ai_category ~ '[[:cntrl:]]'
 OR p_public_description ~ '[<>{}\\]' OR p_public_description ~ '[[:cntrl:]]'
 THEN RETURN jsonb_build_object(
   'action','CLARIFY','reason','AI_CATEGORY_OR_DESCRIPTION_INVALID',
   'classificationAuthority','NONE','notificationAuthority','NONE'
 ); END IF;
 -- The model can only suggest a label, never a confirmed category UUID.
 -- Do not manufacture an array of requirements if the owner did not set it.
 IF p_explicit_required_skills IS NULL THEN
  RETURN jsonb_build_object(
   'action','CLARIFY','reason','EXPLICIT_REQUIREMENTS_UNKNOWN',
   'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 IF cardinality(p_explicit_required_skills)>40
 OR EXISTS(SELECT 1 FROM unnest(p_explicit_required_skills) AS skill
           WHERE skill IS NULL OR char_length(btrim(skill)) NOT BETWEEN 2 AND 120)
 THEN RETURN jsonb_build_object(
   'action','CLARIFY','reason','EXPLICIT_REQUIREMENTS_INVALID',
   'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 v_label:=btrim(p_ai_category);
 v_description:=btrim(p_public_description);
 v_normalized_description:=private.taxonomy_normalize_v1(v_description);
 -- A short label must never hide unsafe or regulated meaning from the
 -- original full AI-synthesized PUBLIC description.
 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_risk_rules r
  WHERE r.enabled AND r.decision='BLOCKED'
    AND (v_normalized_description ~ r.pattern
         OR private.taxonomy_normalize_v1(v_label) ~ r.pattern)
 ) THEN RETURN jsonb_build_object(
   'action','REJECT','reason','POSSIBLY_PROHIBITED_CONTENT',
   'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_risk_rules r
  WHERE r.enabled AND r.decision='REVIEW_REQUIRED'
    AND (v_normalized_description ~ r.pattern
         OR private.taxonomy_normalize_v1(v_label) ~ r.pattern)
 ) THEN RETURN jsonb_build_object(
   'action','SAFETY_REVIEW','reason','POSSIBLY_REGULATED_CONTENT',
   'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 -- Resolve the proposed *kind of work* using the trusted, shared canonical
 -- catalog. It can reuse 11 legacy kinds once backfilled/verified, or
 -- new validated service IDs. No "one category per room" proliferation.
 v_result:=private.taxonomy_preview_v1(v_label);
 v_kind:=v_result->>'action';
 IF v_kind='REJECT' OR v_kind='SAFETY_REVIEW' THEN
  RETURN jsonb_build_object(
    'action',v_kind,
    'reason',coalesce(v_result->>'reason','CATALOG_RISK_POLICY'),
    'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 IF v_kind='CLARIFY' THEN
  RETURN jsonb_build_object(
    'action','CLARIFY','reason',coalesce(v_result->>'reason','UNVERIFIED_WORK_MEANING'),
    'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 IF v_kind='REUSE_EXISTING' THEN
  -- This is ONLY a candidate for confirmation, NEVER "worker matched".
  -- Explicit owner requirements MUST still be checked independently by
  -- the canonical matcher. Do not copy category to required_skills.
  RETURN jsonb_build_object(
    'action','SUGGEST_EXISTING_SERVICE',
    'categoryId',v_result->'categoryId',
    'catalogVersion',v_result->'catalogVersion',
    'requiresRequesterReview',true,
    'requiresTaskRevisionBinding',true,
    'requiresFullEligibility',true,
    'explicitRequiredSkillsPresent',cardinality(p_explicit_required_skills)>0,
    'descriptionSemanticallyVerified',false,
    'classificationAuthority','NONE',
    'notificationAuthority','NONE');
 END IF;
 -- A novel "AI.category" can be an entirely new legitimate service, but a
 -- model's asserted novelty MUST NOT automatically become a DB or send event.
 IF v_kind='PROPOSE_AUTO_PROVISIONAL' THEN
  RETURN jsonb_build_object(
    'action','NOVEL_SERVICE_REVIEW',
    'reason','SERVER_SEMANTIC_ADMISSION_PENDING',
    'normalizedKey',v_result->'normalizedKey',
    'catalogVersion',v_result->'catalogVersion',
    'requiresRequesterReview',true,
    'requiresSemanticDeduplication',true,
    'requiresSafetyReview',true,
    'classificationAuthority','NONE',
    'notificationAuthority','NONE');
 END IF;
 RETURN jsonb_build_object(
  'action','CLARIFY','reason','CATALOG_LOOKUP_UNAVAILABLE',
  'classificationAuthority','NONE','notificationAuthority','NONE');
END
$adapter$;
REVOKE ALL ON FUNCTION private.taxonomy_existing_ai_category_preview_v1(text,text,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.taxonomy_existing_ai_category_preview_v1(text,text,text[]) TO service_role;

-- Extra DARK-LAUNCH privilege boundary: do NOT let service runtime mutate taxonomy
-- until actor/revision-bound authorization has an independent reviewed API.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON
 private.work_taxonomy_control,private.work_taxonomy_categories,
 private.work_taxonomy_aliases,private.work_taxonomy_relations,
 private.work_taxonomy_worker_capabilities,private.work_taxonomy_need_snapshots,
 private.work_taxonomy_need_skills,private.work_taxonomy_audit,
 private.work_taxonomy_risk_actions,private.work_taxonomy_risk_rules,
 private.work_taxonomy_service_meanings,private.work_taxonomy_service_verbs,
 private.work_taxonomy_service_scopes,private.work_taxonomy_related_acceptances,
 private.work_taxonomy_sentence_prefixes
 FROM service_role;
REVOKE ALL ON SEQUENCE
 private.work_taxonomy_aliases_id_seq,private.work_taxonomy_audit_id_seq
 FROM service_role;
-- New tables are PRIVATE, RLS on; public app roles cannot read or mutate them.
DO $postcheck$
DECLARE n_tables integer; n_functions integer;
BEGIN
 SELECT count(*) INTO n_tables FROM pg_tables
 WHERE schemaname='private' AND tablename LIKE 'work_taxonomy%';
 SELECT count(*) INTO n_functions FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
 WHERE ns.nspname='private' AND p.proname LIKE 'taxonomy_%';
 IF n_tables<>17 OR n_functions<>10 THEN
  RAISE EXCEPTION 'TAXONOMY_DARK_INSTALL_OBJECT_COUNT_UNEXPECTED_tables_%_functions_%',n_tables,n_functions;
 END IF;
 IF (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 OR EXISTS (SELECT 1 FROM private.work_taxonomy_categories)
 OR has_table_privilege('service_role','private.work_taxonomy_categories','INSERT')
 OR has_table_privilege('service_role','private.work_taxonomy_control','UPDATE')
 OR has_table_privilege('authenticated','private.work_taxonomy_categories','SELECT')
 OR has_function_privilege('authenticated','private.taxonomy_preview_v1(text)','EXECUTE')
 OR has_function_privilege('anon','private.taxonomy_preview_v1(text)','EXECUTE')
 THEN
  RAISE EXCEPTION 'TAXONOMY_DARK_INSTALL_ACCESS_OR_FLAG_VIOLATION';
 END IF;
END $postcheck$;
