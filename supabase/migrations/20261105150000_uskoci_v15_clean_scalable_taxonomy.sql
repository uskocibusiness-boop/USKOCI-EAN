-- Migration: V15 Clean, Modular & Scalable Taxonomy
-- Replaces 155 scattered/test nodes with 54 clean, intuitive, production-grade
-- categories across 8 macro pillars, with Serbian craft aliases and execution scopes.
-- Historical rows are gracefully marked 'RETIRED' and mapped via superseded_by.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- 0. Free canonical keys of legacy non-pillar categories to avoid unique collisions
UPDATE private.work_taxonomy_categories
SET label = substr(label, 1, 95) || ' [arh ' || substr(id::text, 1, 8) || ']',
    canonical_key = private.taxonomy_normalize_v1(substr(label, 1, 95) || ' [arh ' || substr(id::text, 1, 8) || ']'),
    state = 'RETIRED',
    catalog_version = 15
WHERE id NOT IN (
  '00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000011'::uuid,
  '00000000-0000-4000-8000-000000000012'::uuid,
  '00000000-0000-4000-8000-000000000013'::uuid,
  '00000000-0000-4000-8000-000000000014'::uuid,
  '00000000-0000-4000-8000-000000000015'::uuid,
  '00000000-0000-4000-8000-000000000016'::uuid
);

-- 1. Ensure Crown / Root (Nivo 0)
INSERT INTO private.work_taxonomy_categories (
  id, canonical_key, label, parent_id, state, source, catalog_version
) VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  private.taxonomy_normalize_v1('Uskoci zadaci i usluge'),
  'Uskoci zadaci i usluge',
  NULL,
  'ESTABLISHED',
  'SYSTEM',
  15
) ON CONFLICT (id) DO UPDATE SET
  canonical_key = private.taxonomy_normalize_v1('Uskoci zadaci i usluge'),
  label = 'Uskoci zadaci i usluge',
  parent_id = NULL,
  state = 'ESTABLISHED',
  catalog_version = 15;

-- 2. Insert/Update the 8 Macro Pillars (Nivo 1)
INSERT INTO private.work_taxonomy_categories (
  id, canonical_key, label, parent_id, state, source, catalog_version
) VALUES
  ('00000000-0000-4000-8000-000000000011'::uuid, private.taxonomy_normalize_v1('Majstori i zanatski radovi'), 'Majstori i zanatski radovi', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000012'::uuid, private.taxonomy_normalize_v1('Fizicki poslovi, rusenje i gradjevinska ispomoc'), 'Fizički poslovi, rušenje i građevinska ispomoć', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000013'::uuid, private.taxonomy_normalize_v1('Selidbe, transport i vozila'), 'Selidbe, transport i vozila', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000014'::uuid, private.taxonomy_normalize_v1('Tehnika i kucni aparati'), 'Tehnika i kućni aparati', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000015'::uuid, private.taxonomy_normalize_v1('Ciscenje i odrzavanje prostora'), 'Čišćenje i održavanje prostora', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000016'::uuid, private.taxonomy_normalize_v1('Dvoriste, basta i teren'), 'Dvorište, bašta i teren', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000017'::uuid, private.taxonomy_normalize_v1('Potrcko, svakodnevna pomoc i briga'), 'Potrčko, svakodnevna pomoć i briga', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000018'::uuid, private.taxonomy_normalize_v1('Casovi, digitalne i poslovne usluge'), 'Časovi, digitalne i poslovne usluge', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15)
ON CONFLICT (id) DO UPDATE SET
  canonical_key = EXCLUDED.canonical_key,
  label = EXCLUDED.label,
  parent_id = EXCLUDED.parent_id,
  state = 'ESTABLISHED',
  catalog_version = 15;

-- Modes for Pillars
INSERT INTO private.work_taxonomy_category_modes (category_id, execution_scope, source_ref) VALUES
  ('00000000-0000-4000-8000-000000000001'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000001'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000011'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000012'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000013'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000014'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000015'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000016'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000017'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000018'::uuid, 'REMOTE', 'V15_SEED')
ON CONFLICT (category_id, execution_scope) DO NOTHING;

-- 3. Insert the 45 Concrete Categories (Nivo 2)
INSERT INTO private.work_taxonomy_categories (
  id, canonical_key, label, parent_id, state, source, catalog_version
) VALUES
  -- Stub 1: Majstori i zanatski radovi
  ('00000000-0000-4000-8000-000000000101'::uuid, private.taxonomy_normalize_v1('Vodoinstalaterski radovi'), 'Vodoinstalaterski radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000102'::uuid, private.taxonomy_normalize_v1('Elektricarski radovi'), 'Električarski radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000103'::uuid, private.taxonomy_normalize_v1('Krecenje i moleraj'), 'Krečenje i moleraj', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000104'::uuid, private.taxonomy_normalize_v1('Keramicarski radovi'), 'Keramičarski radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000105'::uuid, private.taxonomy_normalize_v1('Bravarski radovi'), 'Bravarski radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000106'::uuid, private.taxonomy_normalize_v1('Stolarski radovi i montaza namestaja'), 'Stolarski radovi i montaža nameštaja', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000107'::uuid, private.taxonomy_normalize_v1('Parketarski i podopolagacki radovi'), 'Parketarski i podopolagački radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000108'::uuid, private.taxonomy_normalize_v1('Zidarski i gipsarski radovi'), 'Zidarski i gipsarski radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000109'::uuid, private.taxonomy_normalize_v1('Krovopokrivacki i limarski radovi'), 'Krovopokrivački i limarski radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000110'::uuid, private.taxonomy_normalize_v1('Sitne kucne popravke (Hausmajstor)'), 'Sitne kućne popravke (Hausmajstor)', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),

  -- Stub 2: Fizički poslovi, rušenje i građevinska ispomoć
  ('00000000-0000-4000-8000-000000000201'::uuid, private.taxonomy_normalize_v1('Univerzalni fizicki radnik (ispomoc na dan)'), 'Univerzalni fizički radnik (ispomoć na dan)', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000202'::uuid, private.taxonomy_normalize_v1('Rusenje, stemovanje i razbijanje'), 'Rušenje, štemovanje i razbijanje', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000203'::uuid, private.taxonomy_normalize_v1('Utovar, istovar i pretovar materijala'), 'Utovar, istovar i pretovar materijala', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000204'::uuid, private.taxonomy_normalize_v1('Nosenje teskog tereta na sprat'), 'Nošenje teškog tereta na sprat', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000205'::uuid, private.taxonomy_normalize_v1('Iznosenje i odvoz suta'), 'Iznošenje i odvoz šuta', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000206'::uuid, private.taxonomy_normalize_v1('Cepanje i unosenje ogreva'), 'Cepanje i unošenje ogreva', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000207'::uuid, private.taxonomy_normalize_v1('Kopanje i zemljani radovi'), 'Kopanje i zemljani radovi', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),

  -- Stub 3: Selidbe, transport i vozila
  ('00000000-0000-4000-8000-000000000301'::uuid, private.taxonomy_normalize_v1('Kombi prevoz tereta i robe'), 'Kombi prevoz tereta i robe', '00000000-0000-4000-8000-000000000013'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000302'::uuid, private.taxonomy_normalize_v1('Kompletne selidbe'), 'Kompletne selidbe', '00000000-0000-4000-8000-000000000013'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000303'::uuid, private.taxonomy_normalize_v1('Slep sluzba i pomoc na putu'), 'Šlep služba i pomoć na putu', '00000000-0000-4000-8000-000000000013'::uuid, 'ESTABLISHED', 'SYSTEM', 15),

  -- Stub 4: Tehnika i kućni aparati
  ('00000000-0000-4000-8000-000000000401'::uuid, private.taxonomy_normalize_v1('Servis bele tehnike'), 'Servis bele tehnike', '00000000-0000-4000-8000-000000000014'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000402'::uuid, private.taxonomy_normalize_v1('Servis i montaza klima uredjaja'), 'Servis i montaža klima uređaja', '00000000-0000-4000-8000-000000000014'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000403'::uuid, private.taxonomy_normalize_v1('Servis grejanja, kotlova i radijatora'), 'Servis grejanja, kotlova i radijatora', '00000000-0000-4000-8000-000000000014'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000404'::uuid, private.taxonomy_normalize_v1('Servis racunara, laptopova i telefona'), 'Servis računara, laptopova i telefona', '00000000-0000-4000-8000-000000000014'::uuid, 'ESTABLISHED', 'SYSTEM', 15),

  -- Stub 5: Čišćenje i održavanje prostora
  ('00000000-0000-4000-8000-000000000501'::uuid, private.taxonomy_normalize_v1('Ciscenje stanova, kuca i lokala'), 'Čišćenje stanova, kuća i lokala', '00000000-0000-4000-8000-000000000015'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000502'::uuid, private.taxonomy_normalize_v1('Ciscenje nakon radova i krecenja'), 'Čišćenje nakon radova i krečenja', '00000000-0000-4000-8000-000000000015'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000503'::uuid, private.taxonomy_normalize_v1('Dubinsko pranje namestaja i tepiha'), 'Dubinsko pranje nameštaja i tepiha', '00000000-0000-4000-8000-000000000015'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000504'::uuid, private.taxonomy_normalize_v1('Pranje prozora i izloga'), 'Pranje prozora i izloga', '00000000-0000-4000-8000-000000000015'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000505'::uuid, private.taxonomy_normalize_v1('Pranje i peglanje vesa'), 'Pranje i peglanje veša', '00000000-0000-4000-8000-000000000015'::uuid, 'ESTABLISHED', 'SYSTEM', 15),

  -- Stub 6: Dvorište, bašta i teren
  ('00000000-0000-4000-8000-000000000601'::uuid, private.taxonomy_normalize_v1('Kosenje trave i odrzavanje travnjaka'), 'Košenje trave i održavanje travnjaka', '00000000-0000-4000-8000-000000000016'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000602'::uuid, private.taxonomy_normalize_v1('Krcenje placeva i seca granja'), 'Krčenje placeva i seča granja', '00000000-0000-4000-8000-000000000016'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000603'::uuid, private.taxonomy_normalize_v1('Sisanje zive ograde i bastovanstvo'), 'Šišanje žive ograde i baštovanstvo', '00000000-0000-4000-8000-000000000016'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000604'::uuid, private.taxonomy_normalize_v1('Ciscenje snega i sakupljanje lisca'), 'Čišćenje snega i sakupljanje lišća', '00000000-0000-4000-8000-000000000016'::uuid, 'ESTABLISHED', 'SYSTEM', 15),

  -- Stub 7: Potrčko, svakodnevna pomoć i briga
  ('00000000-0000-4000-8000-000000000701'::uuid, private.taxonomy_normalize_v1('Potrcko i brza gradska dostava'), 'Potrčko i brza gradska dostava', '00000000-0000-4000-8000-000000000017'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000702'::uuid, private.taxonomy_normalize_v1('Cekanje u redovima i administracija'), 'Čekanje u redovima i administracija', '00000000-0000-4000-8000-000000000017'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000703'::uuid, private.taxonomy_normalize_v1('Cuvanje dece (Bejbisiting)'), 'Čuvanje dece (Bejbisiting)', '00000000-0000-4000-8000-000000000017'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000704'::uuid, private.taxonomy_normalize_v1('Pomoc i nega starijih lica'), 'Pomoć i nega starijih lica', '00000000-0000-4000-8000-000000000017'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000705'::uuid, private.taxonomy_normalize_v1('Briga o kucnim ljubimcima'), 'Briga o kućnim ljubimcima', '00000000-0000-4000-8000-000000000017'::uuid, 'ESTABLISHED', 'SYSTEM', 15),

  -- Stub 8: Časovi, digitalne i poslovne usluge
  ('00000000-0000-4000-8000-000000000801'::uuid, private.taxonomy_normalize_v1('Privatni casovi i poducavanje'), 'Privatni časovi i podučavanje', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000802'::uuid, private.taxonomy_normalize_v1('Casovi stranih jezika'), 'Časovi stranih jezika', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000803'::uuid, private.taxonomy_normalize_v1('Izrada i odrzavanje web sajtova'), 'Izrada i održavanje web sajtova', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000804'::uuid, private.taxonomy_normalize_v1('Graficki dizajn i brending'), 'Grafički dizajn i brending', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000805'::uuid, private.taxonomy_normalize_v1('Video montaza i obrada fotografija'), 'Video montaža i obrada fotografija', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000806'::uuid, private.taxonomy_normalize_v1('Prevodjenje i lektura tekstova'), 'Prevođenje i lektura tekstova', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000807'::uuid, private.taxonomy_normalize_v1('Virtuelna asistencija i unos podataka'), 'Virtuelna asistencija i unos podataka', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15)
ON CONFLICT (id) DO UPDATE SET
  canonical_key = EXCLUDED.canonical_key,
  label = EXCLUDED.label,
  parent_id = EXCLUDED.parent_id,
  state = 'ESTABLISHED',
  catalog_version = 15;

-- 4. Modes for Concrete Categories
INSERT INTO private.work_taxonomy_category_modes (category_id, execution_scope, source_ref) VALUES
  -- Majstori
  ('00000000-0000-4000-8000-000000000101'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000102'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000103'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000104'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000105'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000106'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000107'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000108'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000109'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000110'::uuid, 'ON_SITE', 'V15_SEED'),
  -- Fizički poslovi
  ('00000000-0000-4000-8000-000000000201'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000202'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000203'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000204'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000205'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000206'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000207'::uuid, 'ON_SITE', 'V15_SEED'),
  -- Prevoz i selidbe
  ('00000000-0000-4000-8000-000000000301'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000302'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000303'::uuid, 'ON_SITE', 'V15_SEED'),
  -- Tehnika
  ('00000000-0000-4000-8000-000000000401'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000402'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000403'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000404'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000404'::uuid, 'REMOTE', 'V15_SEED'),
  -- Čišćenje
  ('00000000-0000-4000-8000-000000000501'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000502'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000503'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000504'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000505'::uuid, 'ON_SITE', 'V15_SEED'),
  -- Dvorište
  ('00000000-0000-4000-8000-000000000601'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000602'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000603'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000604'::uuid, 'ON_SITE', 'V15_SEED'),
  -- Potrčko i briga
  ('00000000-0000-4000-8000-000000000701'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000702'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000703'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000704'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000705'::uuid, 'ON_SITE', 'V15_SEED'),
  -- Časovi i digitalno
  ('00000000-0000-4000-8000-000000000801'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000801'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000802'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000802'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000803'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000804'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000805'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000806'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000807'::uuid, 'REMOTE', 'V15_SEED')
ON CONFLICT (category_id, execution_scope) DO NOTHING;

-- 5. Update existing pillar aliases to align with V15 domain names
UPDATE private.work_taxonomy_aliases a
SET label = v.label
FROM (VALUES
  (20, 'Сви задаци и послови'),
  (21, 'Sve usluge i zadaci'),
  (23, 'Мајстори и занати'),
  (24, 'Majstori i zanatski radovi'),
  (25, 'Физички послови и рушење'),
  (26, 'Građevinska ispomoć i fizički rad'),
  (27, 'Селидбе и превоз'),
  (28, 'Kombi transport i selidbe'),
  (29, 'Сервис технике и апарата'),
  (30, 'Servis kućnih aparata'),
  (31, 'Чишћење и одржавање'),
  (32, 'Higijena i čišćenje prostora'),
  (33, 'Двориште, башта и терен'),
  (34, 'Uređenje dvorišta i bašte')
) AS v(id, label)
WHERE a.id = v.id;

-- 6. Insert Rich Serbian Aliases for Concrete Categories
INSERT INTO private.work_taxonomy_aliases (category_id, locale, label) VALUES
  -- Vodoinstalater
  ('00000000-0000-4000-8000-000000000101'::uuid, 'sr-RS', 'vodoinstalater'),
  ('00000000-0000-4000-8000-000000000101'::uuid, 'sr-RS', 'zamena slavine'),
  ('00000000-0000-4000-8000-000000000101'::uuid, 'sr-RS', 'odgusenje odvoda'),
  ('00000000-0000-4000-8000-000000000101'::uuid, 'sr-RS', 'montaza bojlera'),
  -- Električar
  ('00000000-0000-4000-8000-000000000102'::uuid, 'sr-RS', 'elektricar'),
  ('00000000-0000-4000-8000-000000000102'::uuid, 'sr-RS', 'zamena uticnica'),
  ('00000000-0000-4000-8000-000000000102'::uuid, 'sr-RS', 'zamena osiguraca'),
  ('00000000-0000-4000-8000-000000000102'::uuid, 'sr-RS', 'montaza rasvete'),
  -- Krečenje
  ('00000000-0000-4000-8000-000000000103'::uuid, 'sr-RS', 'krecenje'),
  ('00000000-0000-4000-8000-000000000103'::uuid, 'sr-RS', 'moler'),
  ('00000000-0000-4000-8000-000000000103'::uuid, 'sr-RS', 'gletovanje'),
  ('00000000-0000-4000-8000-000000000103'::uuid, 'sr-RS', 'krecenje stana'),
  -- Keramičar
  ('00000000-0000-4000-8000-000000000104'::uuid, 'sr-RS', 'keramicar'),
  ('00000000-0000-4000-8000-000000000104'::uuid, 'sr-RS', 'lepljenje plocica'),
  -- Bravar
  ('00000000-0000-4000-8000-000000000105'::uuid, 'sr-RS', 'bravar'),
  ('00000000-0000-4000-8000-000000000105'::uuid, 'sr-RS', 'otvaranje vrata'),
  ('00000000-0000-4000-8000-000000000105'::uuid, 'sr-RS', 'zamena brave'),
  -- Stolar
  ('00000000-0000-4000-8000-000000000106'::uuid, 'sr-RS', 'montaza namestaja'),
  ('00000000-0000-4000-8000-000000000106'::uuid, 'sr-RS', 'ikea montaza'),
  ('00000000-0000-4000-8000-000000000106'::uuid, 'sr-RS', 'sklapanje ormara'),
  -- Fizički poslovi
  ('00000000-0000-4000-8000-000000000201'::uuid, 'sr-RS', 'fizicki poslovi'),
  ('00000000-0000-4000-8000-000000000201'::uuid, 'sr-RS', 'radnik na dan'),
  ('00000000-0000-4000-8000-000000000201'::uuid, 'sr-RS', 'pomocni radnik'),
  ('00000000-0000-4000-8000-000000000202'::uuid, 'sr-RS', 'rusenje zida'),
  ('00000000-0000-4000-8000-000000000202'::uuid, 'sr-RS', 'stemovanje betona'),
  ('00000000-0000-4000-8000-000000000202'::uuid, 'sr-RS', 'skidanje plocica'),
  ('00000000-0000-4000-8000-000000000203'::uuid, 'sr-RS', 'utovar i istovar'),
  ('00000000-0000-4000-8000-000000000203'::uuid, 'sr-RS', 'pretovar'),
  ('00000000-0000-4000-8000-000000000204'::uuid, 'sr-RS', 'nosenje na sprat'),
  ('00000000-0000-4000-8000-000000000204'::uuid, 'sr-RS', 'prenos teskih stvari'),
  ('00000000-0000-4000-8000-000000000205'::uuid, 'sr-RS', 'odvoz suta'),
  ('00000000-0000-4000-8000-000000000205'::uuid, 'sr-RS', 'iznosenje suta'),
  ('00000000-0000-4000-8000-000000000206'::uuid, 'sr-RS', 'cepanje drva'),
  ('00000000-0000-4000-8000-000000000206'::uuid, 'sr-RS', 'unosenje drva'),
  -- Prevoz i selidbe
  ('00000000-0000-4000-8000-000000000301'::uuid, 'sr-RS', 'kombi prevoz'),
  ('00000000-0000-4000-8000-000000000301'::uuid, 'sr-RS', 'prevoz namestaja'),
  ('00000000-0000-4000-8000-000000000302'::uuid, 'sr-RS', 'selidba'),
  ('00000000-0000-4000-8000-000000000302'::uuid, 'sr-RS', 'selidba stana'),
  -- Košenje i dvorište
  ('00000000-0000-4000-8000-000000000601'::uuid, 'sr-RS', 'kosenje trave'),
  ('00000000-0000-4000-8000-000000000601'::uuid, 'sr-RS', 'kosenje dvorista'),
  ('00000000-0000-4000-8000-000000000602'::uuid, 'sr-RS', 'krcenje placa'),
  -- Potrčko
  ('00000000-0000-4000-8000-000000000701'::uuid, 'sr-RS', 'potrcko'),
  ('00000000-0000-4000-8000-000000000701'::uuid, 'sr-RS', 'dostava lekova'),
  ('00000000-0000-4000-8000-000000000701'::uuid, 'sr-RS', 'kupovina karata'),
  -- Česti kolokvijalni pojmovi i nominativi
  ('00000000-0000-4000-8000-000000000104'::uuid, 'sr-RS', 'plocice'),
  ('00000000-0000-4000-8000-000000000601'::uuid, 'sr-RS', 'trava'),
  ('00000000-0000-4000-8000-000000000106'::uuid, 'sr-RS', 'namestaj'),
  ('00000000-0000-4000-8000-000000000402'::uuid, 'sr-RS', 'klima'),
  ('00000000-0000-4000-8000-000000000102'::uuid, 'sr-RS', 'struja'),
  ('00000000-0000-4000-8000-000000000101'::uuid, 'sr-RS', 'voda'),
  ('00000000-0000-4000-8000-000000000206'::uuid, 'sr-RS', 'drva'),
  ('00000000-0000-4000-8000-000000000205'::uuid, 'sr-RS', 'sut'),
  ('00000000-0000-4000-8000-000000000202'::uuid, 'sr-RS', 'beton'),
  ('00000000-0000-4000-8000-000000000203'::uuid, 'sr-RS', 'pesak'),
  ('00000000-0000-4000-8000-000000000207'::uuid, 'sr-RS', 'zemlja')
ON CONFLICT (locale, normalized_key) DO NOTHING;

-- 7. Link superseded_by for key historical categories to preserve continuity
UPDATE private.work_taxonomy_categories
  SET superseded_by = '00000000-0000-4000-8000-000000000806'::uuid
  WHERE id = '8766e4e3-5a44-4ddf-ab90-1cb607b6de53'::uuid;

UPDATE private.work_taxonomy_categories
  SET superseded_by = '00000000-0000-4000-8000-000000000103'::uuid
  WHERE id IN ('d7c4a865-1532-42cd-8204-a11178c16f67'::uuid, '548c7d65-6c20-4a75-9880-9a0244027624'::uuid);

UPDATE private.work_taxonomy_categories
  SET superseded_by = '00000000-0000-4000-8000-000000000101'::uuid
  WHERE id = '478cb9ed-984d-44d7-885a-0c1cc71369ee'::uuid;

UPDATE private.work_taxonomy_categories
  SET superseded_by = '00000000-0000-4000-8000-000000000301'::uuid
  WHERE id = 'd5ae85ce-4e9a-46c8-a662-c55b0215e2e0'::uuid;

-- 8. Retire all non-canonical old categories gracefully
UPDATE private.work_taxonomy_categories
  SET state = 'RETIRED',
      catalog_version = 15
  WHERE id NOT IN (
    '00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000011'::uuid,
    '00000000-0000-4000-8000-000000000012'::uuid,
    '00000000-0000-4000-8000-000000000013'::uuid,
    '00000000-0000-4000-8000-000000000014'::uuid,
    '00000000-0000-4000-8000-000000000015'::uuid,
    '00000000-0000-4000-8000-000000000016'::uuid,
    '00000000-0000-4000-8000-000000000017'::uuid,
    '00000000-0000-4000-8000-000000000018'::uuid,
    '00000000-0000-4000-8000-000000000101'::uuid,
    '00000000-0000-4000-8000-000000000102'::uuid,
    '00000000-0000-4000-8000-000000000103'::uuid,
    '00000000-0000-4000-8000-000000000104'::uuid,
    '00000000-0000-4000-8000-000000000105'::uuid,
    '00000000-0000-4000-8000-000000000106'::uuid,
    '00000000-0000-4000-8000-000000000107'::uuid,
    '00000000-0000-4000-8000-000000000108'::uuid,
    '00000000-0000-4000-8000-000000000109'::uuid,
    '00000000-0000-4000-8000-000000000110'::uuid,
    '00000000-0000-4000-8000-000000000201'::uuid,
    '00000000-0000-4000-8000-000000000202'::uuid,
    '00000000-0000-4000-8000-000000000203'::uuid,
    '00000000-0000-4000-8000-000000000204'::uuid,
    '00000000-0000-4000-8000-000000000205'::uuid,
    '00000000-0000-4000-8000-000000000206'::uuid,
    '00000000-0000-4000-8000-000000000207'::uuid,
    '00000000-0000-4000-8000-000000000301'::uuid,
    '00000000-0000-4000-8000-000000000302'::uuid,
    '00000000-0000-4000-8000-000000000303'::uuid,
    '00000000-0000-4000-8000-000000000401'::uuid,
    '00000000-0000-4000-8000-000000000402'::uuid,
    '00000000-0000-4000-8000-000000000403'::uuid,
    '00000000-0000-4000-8000-000000000404'::uuid,
    '00000000-0000-4000-8000-000000000501'::uuid,
    '00000000-0000-4000-8000-000000000502'::uuid,
    '00000000-0000-4000-8000-000000000503'::uuid,
    '00000000-0000-4000-8000-000000000504'::uuid,
    '00000000-0000-4000-8000-000000000505'::uuid,
    '00000000-0000-4000-8000-000000000601'::uuid,
    '00000000-0000-4000-8000-000000000602'::uuid,
    '00000000-0000-4000-8000-000000000603'::uuid,
    '00000000-0000-4000-8000-000000000604'::uuid,
    '00000000-0000-4000-8000-000000000701'::uuid,
    '00000000-0000-4000-8000-000000000702'::uuid,
    '00000000-0000-4000-8000-000000000703'::uuid,
    '00000000-0000-4000-8000-000000000704'::uuid,
    '00000000-0000-4000-8000-000000000705'::uuid,
    '00000000-0000-4000-8000-000000000801'::uuid,
    '00000000-0000-4000-8000-000000000802'::uuid,
    '00000000-0000-4000-8000-000000000803'::uuid,
    '00000000-0000-4000-8000-000000000804'::uuid,
    '00000000-0000-4000-8000-000000000805'::uuid,
    '00000000-0000-4000-8000-000000000806'::uuid,
    '00000000-0000-4000-8000-000000000807'::uuid
  );

-- 9. Increment Catalog Version to 15
UPDATE private.work_taxonomy_control
  SET catalog_version = 15,
      updated_at = now()
  WHERE singleton = true;

COMMIT;
