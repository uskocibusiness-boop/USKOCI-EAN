-- Candidate ONLY: verified work-intent identity, separate from task scope.
-- "Krecenje sobe" and "krecenje stana" can reuse one service UUID.
-- No general fuzzy or embedding similarity; unverified object/scope fails closed.
BEGIN;
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
   AND s.normalized_scope =
     substr(private.taxonomy_normalize_v1(p_label),
            char_length(v.normalized_action)+2)
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
COMMIT;
