-- Forward migration: Universal Crown Taxonomy (Hierarchy Depth 1-5),
-- STOP LINE Relevance Ceiling for Worker Dispatching,
-- and HOURLY Pricing Basis in needs table and validators.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- ============================================================================
-- 1. HOURLY PRICING SUPPORT
-- ============================================================================

-- 1a. Update check constraint on public.needs
ALTER TABLE public.needs
  DROP CONSTRAINT IF EXISTS needs_price_basis_requires_my_price;

ALTER TABLE public.needs
  ADD CONSTRAINT needs_price_basis_requires_my_price
  CHECK (
    price_basis IS NULL OR (
      price_basis = ANY (ARRAY['TOTAL'::text, 'PER_PERSON'::text, 'HOURLY'::text])
      AND mode = 'MY_PRICE'::text
    )
  );

-- 1b. Update fact validator function private.validate_need_v2_fact_pre_fastest_retirement
CREATE OR REPLACE FUNCTION private.validate_need_v2_fact_pre_fastest_retirement(p_key text, p_value jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_type text;
  v_text text;
  v_num numeric;
  v_item jsonb;
  v_geo jsonb;
  v_mode text;
  v_start jsonb;
  v_end jsonb;
  v_service jsonb;
  v_waypoints jsonb;
  v_key text;
begin
  select value_type into v_type
    from private.need_fact_registry
   where fact_key=p_key and schema_version='NEED_FACT_V2';

  if not found then
    raise exception 'V2_FACT_KEY_INVALID' using errcode='22023',detail=coalesce(p_key,'NULL');
  end if;
  if p_value is null or p_value='null'::jsonb then
    raise exception 'V2_FACT_VALUE_REQUIRED' using errcode='22023',detail=p_key;
  end if;

  if v_type in ('TEXT','ENUM','TIMESTAMPTZ') then
    if jsonb_typeof(p_value)<>'string' then
      raise exception 'V2_FACT_TYPE_INVALID' using errcode='22023',detail=p_key;
    end if;
    v_text:=nullif(btrim(p_value#>>'{}'),'');
    if v_text is null then raise exception 'V2_FACT_VALUE_REQUIRED' using errcode='22023',detail=p_key; end if;
  elsif v_type='INTEGER' then
    if jsonb_typeof(p_value)<>'number' then raise exception 'V2_FACT_TYPE_INVALID' using errcode='22023',detail=p_key; end if;
    begin v_num:=(p_value#>>'{}')::numeric; exception when others then raise exception 'V2_FACT_TYPE_INVALID' using errcode='22023',detail=p_key; end;
    if trunc(v_num)<>v_num then raise exception 'V2_FACT_INTEGER_REQUIRED' using errcode='22023',detail=p_key; end if;
  elsif v_type='BOOLEAN' then
    if jsonb_typeof(p_value)<>'boolean' then raise exception 'V2_FACT_TYPE_INVALID' using errcode='22023',detail=p_key; end if;
  elsif v_type='TEXT_ARRAY' then
    if jsonb_typeof(p_value)<>'array' or jsonb_array_length(p_value)>50 then
      raise exception 'V2_FACT_TYPE_INVALID' using errcode='22023',detail=p_key;
    end if;
    for v_item in select value from jsonb_array_elements(p_value)
    loop
      if jsonb_typeof(v_item)<>'string'
         or coalesce(char_length(btrim(v_item#>>'{}')),0)<1
         or char_length(v_item#>>'{}')>500 then
        raise exception 'V2_FACT_ARRAY_ITEM_INVALID' using errcode='22023',detail=p_key;
      end if;
    end loop;
  elsif v_type='OBJECT' then
    if jsonb_typeof(p_value)<>'object' then raise exception 'V2_FACT_TYPE_INVALID' using errcode='22023',detail=p_key; end if;
  end if;

  case p_key
    when 'need.title' then
      if char_length(v_text)>140 then raise exception 'V2_TITLE_INVALID' using errcode='22023'; end if;
    when 'need.description' then
      if char_length(v_text)>6000 then raise exception 'V2_DESCRIPTION_INVALID' using errcode='22023'; end if;
    when 'need.category' then
      if char_length(v_text)>120 then raise exception 'V2_CATEGORY_INVALID' using errcode='22023'; end if;
    when 'need.price_mode' then
      if v_text not in ('FASTEST','MY_PRICE','OFFERS') then raise exception 'V2_PRICE_MODE_INVALID' using errcode='22023'; end if;
    when 'need.price_basis' then
      -- Support HOURLY alongside TOTAL and PER_PERSON
      if v_text not in ('TOTAL','PER_PERSON','HOURLY') then raise exception 'V2_PRICE_BASIS_INVALID' using errcode='22023'; end if;
    when 'need.price_rsd' then
      if v_num<1 or v_num>100000000 then raise exception 'V2_PRICE_INVALID' using errcode='22023'; end if;
    when 'need.schedule_kind' then
      if v_text not in ('FIXED_WINDOW','FLEXIBLE','REMOTE_ANYTIME','TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') then
        raise exception 'V2_SCHEDULE_KIND_INVALID' using errcode='22023';
      end if;
    when 'need.starts_at','need.ends_at' then
      begin perform v_text::timestamptz; exception when others then raise exception 'V2_TIMESTAMP_INVALID' using errcode='22023',detail=p_key; end;
    when 'need.people_needed' then
      if v_num<1 or v_num>50 then raise exception 'V2_PEOPLE_INVALID' using errcode='22023'; end if;
    when 'need.minimum_experience_years' then
      if v_num<0 or v_num>60 then raise exception 'V2_EXPERIENCE_INVALID' using errcode='22023'; end if;
    when 'need.exact_address' then
      if char_length(v_text)>1000 then raise exception 'V2_EXACT_ADDRESS_INVALID' using errcode='22023'; end if;
    when 'need.access_notes' then
      if char_length(v_text)>2000 then raise exception 'V2_ACCESS_NOTES_INVALID' using errcode='22023'; end if;
    when 'need.task_geography' then
      v_geo:=p_value;
      for v_key in select jsonb_object_keys(v_geo)
      loop
        if v_key not in ('mode','start','end','waypoints','serviceArea') then
          raise exception 'V2_TASK_GEOGRAPHY_KEY_INVALID' using errcode='22023',detail=v_key;
        end if;
      end loop;
      v_mode:=nullif(btrim(v_geo->>'mode'),'');
      if v_mode not in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED','REMOTE') then
        raise exception 'V2_TASK_GEOGRAPHY_MODE_INVALID' using errcode='22023';
      end if;
      v_start:=coalesce(v_geo->'start','null'::jsonb);
      v_end:=coalesce(v_geo->'end','null'::jsonb);
      v_service:=coalesce(v_geo->'serviceArea','null'::jsonb);
      v_waypoints:=coalesce(v_geo->'waypoints','[]'::jsonb);
      if jsonb_typeof(v_waypoints)<>'array' or jsonb_array_length(v_waypoints)>20 then
        raise exception 'V2_TASK_GEOGRAPHY_WAYPOINTS_INVALID' using errcode='22023';
      end if;
      if not private.need_v2_location_ref_valid(v_start)
         or not private.need_v2_location_ref_valid(v_end)
         or not private.need_v2_location_ref_valid(v_service) then
        raise exception 'V2_TASK_GEOGRAPHY_LOCATION_INVALID' using errcode='22023';
      end if;
      for v_item in select value from jsonb_array_elements(v_waypoints)
      loop
        if not private.need_v2_location_ref_valid(v_item) then
          raise exception 'V2_TASK_GEOGRAPHY_LOCATION_INVALID' using errcode='22023';
        end if;
      end loop;
      if v_mode='REMOTE' and (v_start<>'null'::jsonb or v_end<>'null'::jsonb or v_service<>'null'::jsonb or jsonb_array_length(v_waypoints)>0) then
        raise exception 'V2_REMOTE_MUST_HAVE_NO_PHYSICAL_GEOGRAPHY' using errcode='22023';
      elsif v_mode='STATIONARY' and (v_start='null'::jsonb or v_end<>'null'::jsonb or v_service<>'null'::jsonb or jsonb_array_length(v_waypoints)>0) then
        raise exception 'V2_STATIONARY_GEOGRAPHY_INVALID' using errcode='22023';
      elsif v_mode='POINT_TO_POINT' and (v_start='null'::jsonb or v_end='null'::jsonb or v_service<>'null'::jsonb or jsonb_array_length(v_waypoints)>0) then
        raise exception 'V2_POINT_TO_POINT_GEOGRAPHY_INVALID' using errcode='22023';
      elsif v_mode='MULTI_STOP' and (v_start='null'::jsonb or v_service<>'null'::jsonb or (v_end='null'::jsonb and jsonb_array_length(v_waypoints)=0)) then
        raise exception 'V2_MULTI_STOP_GEOGRAPHY_INVALID' using errcode='22023';
      elsif v_mode='AREA_BASED' and (v_end<>'null'::jsonb or jsonb_array_length(v_waypoints)>0 or (v_start='null'::jsonb and v_service='null'::jsonb)) then
        raise exception 'V2_AREA_GEOGRAPHY_INVALID' using errcode='22023';
      end if;
    else null;
  end case;
end;
$function$;

-- ============================================================================
-- 2. UNIVERSAL CROWN TAXONOMY: CROWN (NIVO 0) + 6 SEKTORA (NIVO 1)
-- ============================================================================

-- 2a. Insert Crown: Svi poslovi i zadaci (Nivo 0, parent_id IS NULL)
INSERT INTO private.work_taxonomy_categories (
  id, canonical_key, label, parent_id, state, source, catalog_version
) VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  private.taxonomy_normalize_v1('Svi poslovi i zadaci'),
  'Svi poslovi i zadaci',
  NULL,
  'ESTABLISHED',
  'SYSTEM',
  4
) ON CONFLICT (id) DO UPDATE SET
  canonical_key = private.taxonomy_normalize_v1(EXCLUDED.label),
  label = EXCLUDED.label,
  parent_id = NULL,
  state = 'ESTABLISHED',
  source = 'SYSTEM';

INSERT INTO private.work_taxonomy_category_modes (category_id, execution_scope, source_ref)
VALUES 
  ('00000000-0000-4000-8000-000000000001'::uuid, 'ON_SITE', 'UNIVERSAL_CROWN'),
  ('00000000-0000-4000-8000-000000000001'::uuid, 'REMOTE', 'UNIVERSAL_CROWN')
ON CONFLICT (category_id, execution_scope) DO NOTHING;

INSERT INTO private.work_taxonomy_aliases (category_id, locale, label)
VALUES
  ('00000000-0000-4000-8000-000000000001'::uuid, 'sr', 'Сви послови и задаци'),
  ('00000000-0000-4000-8000-000000000001'::uuid, 'sr', 'Svi zadaci'),
  ('00000000-0000-4000-8000-000000000001'::uuid, 'sr', 'Сви задаци')
ON CONFLICT DO NOTHING;

-- 2b. Insert 6 Macro Sectors (Nivo 1, parent_id = Crown)
-- Sector 1: Majstori i građevina
INSERT INTO private.work_taxonomy_categories (
  id, canonical_key, label, parent_id, state, source, catalog_version
) VALUES (
  '00000000-0000-4000-8000-000000000011'::uuid,
  private.taxonomy_normalize_v1('Majstori i građevina'),
  'Majstori i građevina',
  '00000000-0000-4000-8000-000000000001'::uuid,
  'ESTABLISHED',
  'SYSTEM',
  4
) ON CONFLICT (id) DO UPDATE SET
  parent_id = '00000000-0000-4000-8000-000000000001'::uuid,
  label = EXCLUDED.label,
  canonical_key = private.taxonomy_normalize_v1(EXCLUDED.label),
  source = 'SYSTEM';

INSERT INTO private.work_taxonomy_category_modes (category_id, execution_scope, source_ref)
VALUES ('00000000-0000-4000-8000-000000000011'::uuid, 'ON_SITE', 'SECTOR_1')
ON CONFLICT (category_id, execution_scope) DO NOTHING;

INSERT INTO private.work_taxonomy_aliases (category_id, locale, label)
VALUES
  ('00000000-0000-4000-8000-000000000011'::uuid, 'sr', 'Мајстори и грађевина'),
  ('00000000-0000-4000-8000-000000000011'::uuid, 'sr', 'Građevinski i majstorski radovi')
ON CONFLICT DO NOTHING;

-- Sector 2: Dom i održavanje
INSERT INTO private.work_taxonomy_categories (
  id, canonical_key, label, parent_id, state, source, catalog_version
) VALUES (
  '00000000-0000-4000-8000-000000000012'::uuid,
  private.taxonomy_normalize_v1('Dom i održavanje'),
  'Dom i održavanje',
  '00000000-0000-4000-8000-000000000001'::uuid,
  'ESTABLISHED',
  'SYSTEM',
  4
) ON CONFLICT (id) DO UPDATE SET
  parent_id = '00000000-0000-4000-8000-000000000001'::uuid,
  label = EXCLUDED.label,
  canonical_key = private.taxonomy_normalize_v1(EXCLUDED.label),
  source = 'SYSTEM';

INSERT INTO private.work_taxonomy_category_modes (category_id, execution_scope, source_ref)
VALUES ('00000000-0000-4000-8000-000000000012'::uuid, 'ON_SITE', 'SECTOR_2')
ON CONFLICT (category_id, execution_scope) DO NOTHING;

INSERT INTO private.work_taxonomy_aliases (category_id, locale, label)
VALUES
  ('00000000-0000-4000-8000-000000000012'::uuid, 'sr', 'Дом и одржавање'),
  ('00000000-0000-4000-8000-000000000012'::uuid, 'sr', 'Održavanje kuće i stana')
ON CONFLICT DO NOTHING;

-- Sector 3: Tehnika i vozila
INSERT INTO private.work_taxonomy_categories (
  id, canonical_key, label, parent_id, state, source, catalog_version
) VALUES (
  '00000000-0000-4000-8000-000000000013'::uuid,
  private.taxonomy_normalize_v1('Tehnika i vozila'),
  'Tehnika i vozila',
  '00000000-0000-4000-8000-000000000001'::uuid,
  'ESTABLISHED',
  'SYSTEM',
  4
) ON CONFLICT (id) DO UPDATE SET
  parent_id = '00000000-0000-4000-8000-000000000001'::uuid,
  label = EXCLUDED.label,
  canonical_key = private.taxonomy_normalize_v1(EXCLUDED.label),
  source = 'SYSTEM';

INSERT INTO private.work_taxonomy_category_modes (category_id, execution_scope, source_ref)
VALUES 
  ('00000000-0000-4000-8000-000000000013'::uuid, 'ON_SITE', 'SECTOR_3'),
  ('00000000-0000-4000-8000-000000000013'::uuid, 'REMOTE', 'SECTOR_3')
ON CONFLICT (category_id, execution_scope) DO NOTHING;

INSERT INTO private.work_taxonomy_aliases (category_id, locale, label)
VALUES
  ('00000000-0000-4000-8000-000000000013'::uuid, 'sr', 'Техника и возила'),
  ('00000000-0000-4000-8000-000000000013'::uuid, 'sr', 'Servis bele tehnike i automobila')
ON CONFLICT DO NOTHING;

-- Sector 4: Digitalne i online usluge
INSERT INTO private.work_taxonomy_categories (
  id, canonical_key, label, parent_id, state, source, catalog_version
) VALUES (
  '00000000-0000-4000-8000-000000000014'::uuid,
  private.taxonomy_normalize_v1('Digitalne i online usluge'),
  'Digitalne i online usluge',
  '00000000-0000-4000-8000-000000000001'::uuid,
  'ESTABLISHED',
  'SYSTEM',
  4
) ON CONFLICT (id) DO UPDATE SET
  parent_id = '00000000-0000-4000-8000-000000000001'::uuid,
  label = EXCLUDED.label,
  canonical_key = private.taxonomy_normalize_v1(EXCLUDED.label),
  source = 'SYSTEM';

INSERT INTO private.work_taxonomy_category_modes (category_id, execution_scope, source_ref)
VALUES 
  ('00000000-0000-4000-8000-000000000014'::uuid, 'REMOTE', 'SECTOR_4'),
  ('00000000-0000-4000-8000-000000000014'::uuid, 'ON_SITE', 'SECTOR_4')
ON CONFLICT (category_id, execution_scope) DO NOTHING;

INSERT INTO private.work_taxonomy_aliases (category_id, locale, label)
VALUES
  ('00000000-0000-4000-8000-000000000014'::uuid, 'sr', 'Дигиталне и онлајн услуге'),
  ('00000000-0000-4000-8000-000000000014'::uuid, 'sr', 'IT i digitalne usluge')
ON CONFLICT DO NOTHING;

-- Sector 5: Edukacija, briga i nega
INSERT INTO private.work_taxonomy_categories (
  id, canonical_key, label, parent_id, state, source, catalog_version
) VALUES (
  '00000000-0000-4000-8000-000000000015'::uuid,
  private.taxonomy_normalize_v1('Edukacija, briga i nega'),
  'Edukacija, briga i nega',
  '00000000-0000-4000-8000-000000000001'::uuid,
  'ESTABLISHED',
  'SYSTEM',
  4
) ON CONFLICT (id) DO UPDATE SET
  parent_id = '00000000-0000-4000-8000-000000000001'::uuid,
  label = EXCLUDED.label,
  canonical_key = private.taxonomy_normalize_v1(EXCLUDED.label),
  source = 'SYSTEM';

INSERT INTO private.work_taxonomy_category_modes (category_id, execution_scope, source_ref)
VALUES 
  ('00000000-0000-4000-8000-000000000015'::uuid, 'ON_SITE', 'SECTOR_5'),
  ('00000000-0000-4000-8000-000000000015'::uuid, 'REMOTE', 'SECTOR_5')
ON CONFLICT (category_id, execution_scope) DO NOTHING;

INSERT INTO private.work_taxonomy_aliases (category_id, locale, label)
VALUES
  ('00000000-0000-4000-8000-000000000015'::uuid, 'sr', 'Едукација, брига и нега'),
  ('00000000-0000-4000-8000-000000000015'::uuid, 'sr', 'Časovi, deca i ljubimci')
ON CONFLICT DO NOTHING;

-- Sector 6: Teren, događaji i ugostiteljstvo
INSERT INTO private.work_taxonomy_categories (
  id, canonical_key, label, parent_id, state, source, catalog_version
) VALUES (
  '00000000-0000-4000-8000-000000000016'::uuid,
  private.taxonomy_normalize_v1('Teren, događaji i ugostiteljstvo'),
  'Teren, događaji i ugostiteljstvo',
  '00000000-0000-4000-8000-000000000001'::uuid,
  'ESTABLISHED',
  'SYSTEM',
  4
) ON CONFLICT (id) DO UPDATE SET
  parent_id = '00000000-0000-4000-8000-000000000001'::uuid,
  label = EXCLUDED.label,
  canonical_key = private.taxonomy_normalize_v1(EXCLUDED.label),
  source = 'SYSTEM';

INSERT INTO private.work_taxonomy_category_modes (category_id, execution_scope, source_ref)
VALUES ('00000000-0000-4000-8000-000000000016'::uuid, 'ON_SITE', 'SECTOR_6')
ON CONFLICT (category_id, execution_scope) DO NOTHING;

INSERT INTO private.work_taxonomy_aliases (category_id, locale, label)
VALUES
  ('00000000-0000-4000-8000-000000000016'::uuid, 'sr', 'Терен, догађаји и угоститељство'),
  ('00000000-0000-4000-8000-000000000016'::uuid, 'sr', 'Dostava, fizički poslovi i događaji')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. REPARENT EXISTING 18 ROOTS UNDER THE 6 SECTORS (NIVO 2)
-- ============================================================================
ALTER TABLE private.work_taxonomy_categories
  DISABLE TRIGGER taxonomy_guard_parent_move;

-- Majstori i građevina (Sector 1)
UPDATE private.work_taxonomy_categories
SET parent_id = '00000000-0000-4000-8000-000000000011'::uuid
WHERE label IN (
  'Vodoinstalaterski radovi',
  'Električarski radovi',
  'Molerski radovi',
  'Montaža nameštaja',
  'Zanati i popravke',
  'Sitne popravke'
) AND parent_id IS NULL;

-- Dom i održavanje (Sector 2)
UPDATE private.work_taxonomy_categories
SET parent_id = '00000000-0000-4000-8000-000000000012'::uuid
WHERE label IN (
  'Čišćenje',
  'Pranje i peglanje',
  'Selidbe i prevoz',
  'Transport i selidbe',
  'Bašta i dvorište',
  'Svakodnevna pomoć'
) AND parent_id IS NULL;

-- Digitalne i online usluge (Sector 4)
UPDATE private.work_taxonomy_categories
SET parent_id = '00000000-0000-4000-8000-000000000014'::uuid
WHERE label IN (
  'Digitalne usluge',
  'Pisanje i jezici'
) AND parent_id IS NULL;

-- Edukacija, briga i nega (Sector 5)
UPDATE private.work_taxonomy_categories
SET parent_id = '00000000-0000-4000-8000-000000000015'::uuid
WHERE label IN (
  'Podučavanje',
  'Online podučavanje'
) AND parent_id IS NULL;

-- Teren, događaji i ugostiteljstvo (Sector 6)
UPDATE private.work_taxonomy_categories
SET parent_id = '00000000-0000-4000-8000-000000000016'::uuid
WHERE label IN (
  'Dostava',
  'Fizički poslovi'
) AND parent_id IS NULL;

-- Catch-all for any remaining root that was previously orphan
UPDATE private.work_taxonomy_categories
SET parent_id = '00000000-0000-4000-8000-000000000011'::uuid
WHERE parent_id IS NULL AND id <> '00000000-0000-4000-8000-000000000001'::uuid;

-- ============================================================================
-- 4. CLEAN RE-ASSIGNMENT OF MISPLACED CHILDREN UNDER ZANATI
-- ============================================================================

-- Molerski radovi
UPDATE private.work_taxonomy_categories
SET parent_id = (SELECT id FROM private.work_taxonomy_categories WHERE label = 'Molerski radovi' LIMIT 1)
WHERE label IN ('bojenje zidova', 'Gipsarski radovi', 'Fasaderski radovi', 'Postavljanje tapeta', 'Dekorativne tehnike');

-- Digitalne usluge
UPDATE private.work_taxonomy_categories
SET parent_id = (SELECT id FROM private.work_taxonomy_categories WHERE label = 'Digitalne usluge' LIMIT 1)
WHERE label IN ('izrada web sajtova');

-- Pisanje i jezici
UPDATE private.work_taxonomy_categories
SET parent_id = (SELECT id FROM private.work_taxonomy_categories WHERE label = 'Pisanje i jezici' LIMIT 1)
WHERE label IN ('prevod sa engleskog', 'prevod sa nemačkog');

-- Bašta i dvorište
UPDATE private.work_taxonomy_categories
SET parent_id = (SELECT id FROM private.work_taxonomy_categories WHERE label = 'Bašta i dvorište' LIMIT 1)
WHERE label IN ('krčenje placa');

-- Svakodnevna pomoć
UPDATE private.work_taxonomy_categories
SET parent_id = (SELECT id FROM private.work_taxonomy_categories WHERE label = 'Svakodnevna pomoć' LIMIT 1)
WHERE label IN ('Nošenje kesa i stvari', 'čekanje u redovima');

-- Dostava
UPDATE private.work_taxonomy_categories
SET parent_id = (SELECT id FROM private.work_taxonomy_categories WHERE label = 'Dostava' LIMIT 1)
WHERE label IN ('preuzimanje lekova i paketa');

ALTER TABLE private.work_taxonomy_categories
  ENABLE TRIGGER taxonomy_guard_parent_move;

-- ============================================================================
-- 5. NEW DISCIPLINED SUB-BRANCHES FOR TEHNIKA I VOZILA (SECTOR 3) & EDUKACIJA
-- ============================================================================

INSERT INTO private.work_taxonomy_categories (
  id, canonical_key, label, parent_id, state, source, catalog_version
) VALUES 
  ('00000000-0000-4000-8000-000000000021'::uuid, private.taxonomy_normalize_v1('Bela tehnika i kućni aparati'), 'Bela tehnika i kućni aparati', '00000000-0000-4000-8000-000000000013'::uuid, 'ESTABLISHED', 'SYSTEM', 4),
  ('00000000-0000-4000-8000-000000000022'::uuid, private.taxonomy_normalize_v1('Klima uređaji i grejanje'), 'Klima uređaji i grejanje', '00000000-0000-4000-8000-000000000013'::uuid, 'ESTABLISHED', 'SYSTEM', 4),
  ('00000000-0000-4000-8000-000000000023'::uuid, private.taxonomy_normalize_v1('Auto-mehanika i dijagnostika'), 'Auto-mehanika i dijagnostika', '00000000-0000-4000-8000-000000000013'::uuid, 'ESTABLISHED', 'SYSTEM', 4),
  ('00000000-0000-4000-8000-000000000024'::uuid, private.taxonomy_normalize_v1('Servis računara i telefona'), 'Servis računara i telefona', '00000000-0000-4000-8000-000000000013'::uuid, 'ESTABLISHED', 'SYSTEM', 4),
  ('00000000-0000-4000-8000-000000000025'::uuid, private.taxonomy_normalize_v1('Briga o kućnim ljubimcima'), 'Briga o kućnim ljubimcima', '00000000-0000-4000-8000-000000000015'::uuid, 'ESTABLISHED', 'SYSTEM', 4),
  ('00000000-0000-4000-8000-000000000026'::uuid, private.taxonomy_normalize_v1('Čuvanje dece i nega starijih'), 'Čuvanje dece i nega starijih', '00000000-0000-4000-8000-000000000015'::uuid, 'ESTABLISHED', 'SYSTEM', 4)
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  label = EXCLUDED.label,
  canonical_key = private.taxonomy_normalize_v1(EXCLUDED.label),
  source = 'SYSTEM';

INSERT INTO private.work_taxonomy_category_modes (category_id, execution_scope, source_ref)
VALUES
  ('00000000-0000-4000-8000-000000000021'::uuid, 'ON_SITE', 'BRANCH_SEED'),
  ('00000000-0000-4000-8000-000000000022'::uuid, 'ON_SITE', 'BRANCH_SEED'),
  ('00000000-0000-4000-8000-000000000023'::uuid, 'ON_SITE', 'BRANCH_SEED'),
  ('00000000-0000-4000-8000-000000000024'::uuid, 'ON_SITE', 'BRANCH_SEED'),
  ('00000000-0000-4000-8000-000000000024'::uuid, 'REMOTE', 'BRANCH_SEED'),
  ('00000000-0000-4000-8000-000000000025'::uuid, 'ON_SITE', 'BRANCH_SEED'),
  ('00000000-0000-4000-8000-000000000026'::uuid, 'ON_SITE', 'BRANCH_SEED')
ON CONFLICT (category_id, execution_scope) DO NOTHING;

-- ============================================================================
-- 6. MATCHING & DISPATCHING STOP LINE (RELEVANCE CEILING)
-- ============================================================================
-- Prohibits inheritance to Level 1 (Sector) and Level 0 (Crown).
-- A painter will never inherit plumber tasks, and vice versa!
CREATE OR REPLACE FUNCTION private.taxonomy_requirement_tier_inherited_v1(p_req uuid, p_worker_account_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
 IF p_req IS NULL OR p_worker_account_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM private.work_taxonomy_categories c
  WHERE c.id=p_req AND c.state<>'RETIRED'
 ) THEN RETURN 'NO_SAFE_MATCH'; END IF;

 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  WHERE w.worker_account_id=p_worker_account_id
    AND w.category_id=p_req AND w.excluded
 ) THEN RETURN 'NO_SAFE_MATCH'; END IF;

 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  WHERE w.worker_account_id=p_worker_account_id
    AND w.category_id=p_req AND NOT w.excluded
 ) THEN RETURN 'EXACT'; END IF;

 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  JOIN private.work_taxonomy_relations r
    ON r.source_id=w.category_id AND r.target_id=p_req
  WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded
    AND r.relation='EQUIVALENT_VERIFIED' AND r.verification='VERIFIED'
    AND r.evidence_ref IS NOT NULL AND left(r.evidence_ref,3) <> 'AI_'
 ) THEN RETURN 'EQUIVALENT'; END IF;

 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  JOIN private.work_taxonomy_relations r
    ON r.source_id=w.category_id AND r.target_id=p_req
  JOIN private.work_taxonomy_related_acceptances a
    ON a.worker_account_id=w.worker_account_id
      AND a.source_category_id=w.category_id AND a.target_category_id=p_req
      AND a.relationship_version=r.version
  WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded
    AND w.allow_related_offers AND r.relation='CAPABILITY_CONFIRMED'
    AND r.verification='VERIFIED' AND r.evidence_ref IS NOT NULL AND left(r.evidence_ref,3) <> 'AI_'
 ) THEN RETURN 'RELATED_CONFIRMED'; END IF;

 -- Standard coverage tree walk with strict RELEVANCE CEILING (STOP LINE):
 -- Cannot walk up to Level 0 (Crown) or Level 1 (Macro Sectors).
 IF EXISTS (
  WITH RECURSIVE coverage(ancestor_id,visited,depth) AS (
    SELECT e.parent_category_id,
           ARRAY[e.child_category_id,e.parent_category_id]::uuid[],1
    FROM private.work_taxonomy_standard_coverage e
    JOIN private.work_taxonomy_categories c
      ON c.id=e.child_category_id AND c.parent_id=e.parent_category_id
         AND c.state='ESTABLISHED'
    JOIN private.work_taxonomy_categories p
      ON p.id=e.parent_category_id AND p.state='ESTABLISHED'
    WHERE e.child_category_id=p_req
      AND left(e.evidence_ref,3) <> 'AI_'
      -- RELEVANCE CEILING: Exclude Crown (parent_id IS NULL) and Sectors (parent is Crown)
      AND p.parent_id IS NOT NULL 
      AND p.parent_id <> '00000000-0000-4000-8000-000000000001'::uuid
      AND EXISTS (
        SELECT 1 FROM private.work_taxonomy_category_modes cm
        JOIN private.work_taxonomy_category_modes pm
          ON pm.category_id=p.id AND pm.execution_scope=cm.execution_scope
        WHERE cm.category_id=c.id
      )
    UNION ALL
    SELECT e.parent_category_id,
           coverage.visited || e.parent_category_id,coverage.depth+1
    FROM coverage
    JOIN private.work_taxonomy_standard_coverage e
      ON e.child_category_id=coverage.ancestor_id
    JOIN private.work_taxonomy_categories c
      ON c.id=e.child_category_id AND c.parent_id=e.parent_category_id
        AND c.state='ESTABLISHED'
    JOIN private.work_taxonomy_categories p
      ON p.id=e.parent_category_id AND p.state='ESTABLISHED'
    WHERE coverage.depth<32
      AND left(e.evidence_ref,3) <> 'AI_'
      AND NOT e.parent_category_id=ANY(coverage.visited)
      -- RELEVANCE CEILING: Exclude Crown and Sectors from upward expansion
      AND p.parent_id IS NOT NULL 
      AND p.parent_id <> '00000000-0000-4000-8000-000000000001'::uuid
      AND EXISTS (
        SELECT 1 FROM private.work_taxonomy_category_modes cm
        JOIN private.work_taxonomy_category_modes pm
          ON pm.category_id=p.id AND pm.execution_scope=cm.execution_scope
        WHERE cm.category_id=c.id
      )
  )
  SELECT 1 FROM coverage path
  JOIN private.work_taxonomy_worker_capabilities w
    ON w.category_id=path.ancestor_id
    AND w.worker_account_id=p_worker_account_id AND NOT w.excluded
  WHERE NOT EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities x
    WHERE x.worker_account_id=p_worker_account_id
      AND x.excluded AND x.category_id=ANY(path.visited)
  )
 ) THEN RETURN 'INHERITED_STANDARD'; END IF;

 RETURN 'NO_SAFE_MATCH';
END;
$function$;

-- ============================================================================
-- 7. BUMP CATALOG VERSION TO REFRESH CACHES
-- ============================================================================
UPDATE private.work_taxonomy_control
SET catalog_version = catalog_version + 1, updated_at = now()
WHERE singleton;

COMMIT;
