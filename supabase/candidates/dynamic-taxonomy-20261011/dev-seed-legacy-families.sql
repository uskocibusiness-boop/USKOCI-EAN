-- USKOCI PRIVATE taxonomy — existing 11 kinds as NO-AUTHORITY families.
-- Source-only prepared for disposable acceptance. NOT a frontend routing migration.
-- Inserts ONLY SYSTEM family anchor rows, never task/worker history or push.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$
DECLARE actual text[];
BEGIN
 IF NOT EXISTS (SELECT 1 FROM private.work_taxonomy_control WHERE singleton AND NOT auto_registration_enabled)
 OR (SELECT count(*) FROM private.work_taxonomy_categories)<>0
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities)
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots)
 THEN RAISE EXCEPTION 'TAXONOMY_FAMILY_SEED_REQUIRES_EMPTY_DISABLED_CATALOG'; END IF;
 IF to_regclass('private.work_taxonomy_legacy_kind_map') IS NOT NULL THEN
  RAISE EXCEPTION 'TAXONOMY_LEGACY_FAMILY_MAP_ALREADY_EXISTS'; END IF;
END $guard$;

CREATE TABLE private.work_taxonomy_legacy_kind_map (
 legacy_kind text PRIMARY KEY,
 category_id uuid NOT NULL UNIQUE REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT,
 authority text NOT NULL DEFAULT 'NONE' CHECK(authority='NONE'),
 family_only boolean NOT NULL DEFAULT true CHECK(family_only=true),
 source_ref text NOT NULL DEFAULT 'WORK_KINDS_HEAD_V1',
 mapped_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.work_taxonomy_legacy_kind_map ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_taxonomy_legacy_kind_map FROM PUBLIC;
GRANT SELECT ON private.work_taxonomy_legacy_kind_map TO service_role;
-- No service_role DML. Mapping is reference only and NOT read by current matcher.

WITH src(legacy_kind,label) AS (
 VALUES
 ('SELIDBE_PREVOZ','Selidbe i prevoz'),
 ('FIZICKI_POSLOVI','Fizički poslovi'),
 ('MONTAZA_NAMESTAJA','Montaža nameštaja'),
 ('SITNE_POPRAVKE','Sitne popravke'),
 ('MOLERSKI_RADOVI','Molerski radovi'),
 ('ELEKTRO','Električarski radovi'),
 ('VODOINSTALATER','Vodoinstalaterski radovi'),
 ('CISCENJE','Čišćenje'),
 ('PRANJE_PEGLANJE','Pranje i peglanje'),
 ('BASTA_DVORISTE','Bašta i dvorište'),
 ('DOSTAVA','Dostava')
), inserted AS (
 INSERT INTO private.work_taxonomy_categories
 (canonical_key,label,source,catalog_version,state)
 SELECT private.taxonomy_normalize_v1(label),label,
 'SYSTEM',1,'ESTABLISHED'
 FROM src RETURNING id,label
)
INSERT INTO private.work_taxonomy_legacy_kind_map(legacy_kind,category_id)
SELECT src.legacy_kind,i.id FROM src JOIN inserted i USING(label);

DO $postcheck$
DECLARE c int; m int;
BEGIN
 SELECT count(*) INTO c FROM private.work_taxonomy_categories;
 SELECT count(*) INTO m FROM private.work_taxonomy_legacy_kind_map;
 IF c<>11 OR m<>11 OR
   (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities)
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots)
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases)
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_legacy_kind_map WHERE authority<>'NONE' OR NOT family_only)
 OR has_table_privilege('service_role','private.work_taxonomy_legacy_kind_map','INSERT')
 OR has_table_privilege('authenticated','private.work_taxonomy_legacy_kind_map','SELECT')
 THEN RAISE EXCEPTION 'TAXONOMY_FAMILY_SEED_POSTCHECK_FAILED_categories_%_map_%',c,m; END IF;
END $postcheck$;
