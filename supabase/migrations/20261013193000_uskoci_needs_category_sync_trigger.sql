-- USKOCI V5: Automatic synchronization of category_id on public.needs (13 Oct 2026)
-- Canonical DEV: leqcwgzvjsxugfgzdmth

CREATE OR REPLACE FUNCTION private.needs_sync_taxonomy_category_trigger_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
BEGIN
  IF NEW.category IS NOT NULL AND btrim(NEW.category) <> '' THEN
    SELECT id INTO NEW.category_id
    FROM private.work_taxonomy_categories
    WHERE canonical_key = private.taxonomy_normalize_v1(NEW.category)
      AND state <> 'RETIRED'
    ORDER BY (parent_id IS NOT NULL) DESC, created_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS needs_sync_taxonomy_category_trg ON public.needs;
CREATE TRIGGER needs_sync_taxonomy_category_trg
BEFORE INSERT OR UPDATE OF category ON public.needs
FOR EACH ROW EXECUTE FUNCTION private.needs_sync_taxonomy_category_trigger_fn();

-- Backfill any open needs that have category set but null category_id
UPDATE public.needs n
SET category_id = c.id
FROM private.work_taxonomy_categories c
WHERE n.category_id IS NULL
  AND n.category IS NOT NULL
  AND n.status IN ('DRAFT', 'PUBLISHED', 'SELECTION')
  AND c.canonical_key = private.taxonomy_normalize_v1(n.category)
  AND c.state <> 'RETIRED';
