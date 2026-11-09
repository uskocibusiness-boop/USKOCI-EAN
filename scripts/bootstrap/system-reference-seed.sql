-- SOURCE CANDIDATE ONLY: frozen SYSTEM taxonomy from read-only DEV snapshot 2026-11-10.
-- Applies only after an independently verified empty production application schema install.
-- Excludes 148 retired and 2 AI-reviewed test/user branches. Does not deploy itself.
-- Review platform prerequisites, complete installer, and policy seed separately before execution.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
DO $seed_guard$ BEGIN
  IF to_regclass('private.work_taxonomy_categories') IS NULL
     OR to_regclass('private.work_taxonomy_category_modes') IS NULL
     OR to_regclass('private.work_taxonomy_aliases') IS NULL
     OR to_regclass('private.work_taxonomy_control') IS NULL
     OR to_regclass('private.location_market_configs') IS NULL
     OR to_regclass('private.connection_policy_versions') IS NULL THEN
    RAISE EXCEPTION 'SYSTEM_SEED_SCHEMA_MISSING';
  END IF;
  IF EXISTS (SELECT 1 FROM private.work_taxonomy_categories)
     OR EXISTS (SELECT 1 FROM private.work_taxonomy_category_modes)
     OR EXISTS (SELECT 1 FROM private.work_taxonomy_aliases)
     OR EXISTS (SELECT 1 FROM private.work_taxonomy_control)
     OR EXISTS (SELECT 1 FROM private.location_market_configs)
     OR EXISTS (SELECT 1 FROM private.connection_policy_versions) THEN
    RAISE EXCEPTION 'SYSTEM_SEED_TARGET_NOT_EMPTY';
  END IF;
END $seed_guard$;

INSERT INTO private.work_taxonomy_categories
  (id, canonical_key, label, parent_id, state, source, catalog_version)
VALUES
  ('00000000-0000-4000-8000-000000000001'::uuid, 'uskoci zadaci i usluge', 'Uskoci zadaci i usluge', NULL, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000011'::uuid, 'majstori i zanatski radovi', 'Majstori i zanatski radovi', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000012'::uuid, 'fizicka pomoc, rusenje i gradjevinska ispomoc', 'Fizička pomoć, rušenje i građevinska ispomoć', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000013'::uuid, 'selidbe, transport i vozila', 'Selidbe, transport i vozila', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000014'::uuid, 'tehnika i kucni aparati', 'Tehnika i kućni aparati', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000015'::uuid, 'ciscenje i odrzavanje prostora', 'Čišćenje i održavanje prostora', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000016'::uuid, 'dvoriste, basta i teren', 'Dvorište, bašta i teren', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000017'::uuid, 'potrcko, svakodnevna pomoc i briga', 'Potrčko, svakodnevna pomoć i briga', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000018'::uuid, 'casovi, digitalne i administrativne usluge', 'Časovi, digitalne i administrativne usluge', '00000000-0000-4000-8000-000000000001'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000101'::uuid, 'vodoinstalaterski radovi', 'Vodoinstalaterski radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000102'::uuid, 'elektricarski radovi', 'Električarski radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000103'::uuid, 'krecenje i moleraj', 'Krečenje i moleraj', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000104'::uuid, 'keramicarski radovi', 'Keramičarski radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000105'::uuid, 'bravarski radovi', 'Bravarski radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000106'::uuid, 'stolarski radovi i montaza namestaja', 'Stolarski radovi i montaža nameštaja', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000107'::uuid, 'parketarski i podopolagacki radovi', 'Parketarski i podopolagački radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000108'::uuid, 'zidarski i gipsarski radovi', 'Zidarski i gipsarski radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000109'::uuid, 'krovopokrivacki i limarski radovi', 'Krovopokrivački i limarski radovi', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000110'::uuid, 'sitne kucne popravke (hausmajstor)', 'Sitne kućne popravke (Hausmajstor)', '00000000-0000-4000-8000-000000000011'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000201'::uuid, 'univerzalni fizicki pomocnik (ispomoc na dan)', 'Univerzalni fizički pomoćnik (ispomoć na dan)', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000202'::uuid, 'rusenje, stemovanje i razbijanje', 'Rušenje, štemovanje i razbijanje', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000203'::uuid, 'utovar, istovar i pretovar materijala', 'Utovar, istovar i pretovar materijala', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000204'::uuid, 'nosenje teskog tereta na sprat', 'Nošenje teškog tereta na sprat', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000205'::uuid, 'iznosenje i odvoz suta', 'Iznošenje i odvoz šuta', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000206'::uuid, 'cepanje i unosenje ogreva', 'Cepanje i unošenje ogreva', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000207'::uuid, 'kopanje i zemljani radovi', 'Kopanje i zemljani radovi', '00000000-0000-4000-8000-000000000012'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000301'::uuid, 'kombi prevoz tereta i robe', 'Kombi prevoz tereta i robe', '00000000-0000-4000-8000-000000000013'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000302'::uuid, 'kompletne selidbe', 'Kompletne selidbe', '00000000-0000-4000-8000-000000000013'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000303'::uuid, 'slep sluzba i pomoc na putu', 'Šlep služba i pomoć na putu', '00000000-0000-4000-8000-000000000013'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000401'::uuid, 'servis bele tehnike', 'Servis bele tehnike', '00000000-0000-4000-8000-000000000014'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000402'::uuid, 'servis i montaza klima uredjaja', 'Servis i montaža klima uređaja', '00000000-0000-4000-8000-000000000014'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000403'::uuid, 'servis grejanja, kotlova i radijatora', 'Servis grejanja, kotlova i radijatora', '00000000-0000-4000-8000-000000000014'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000404'::uuid, 'servis racunara, laptopova i telefona', 'Servis računara, laptopova i telefona', '00000000-0000-4000-8000-000000000014'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000501'::uuid, 'ciscenje stanova, kuca i lokala', 'Čišćenje stanova, kuća i lokala', '00000000-0000-4000-8000-000000000015'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000502'::uuid, 'ciscenje nakon radova i krecenja', 'Čišćenje nakon radova i krečenja', '00000000-0000-4000-8000-000000000015'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000503'::uuid, 'dubinsko pranje namestaja i tepiha', 'Dubinsko pranje nameštaja i tepiha', '00000000-0000-4000-8000-000000000015'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000504'::uuid, 'pranje prozora i izloga', 'Pranje prozora i izloga', '00000000-0000-4000-8000-000000000015'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000505'::uuid, 'pranje i peglanje vesa', 'Pranje i peglanje veša', '00000000-0000-4000-8000-000000000015'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000601'::uuid, 'kosenje trave i odrzavanje travnjaka', 'Košenje trave i održavanje travnjaka', '00000000-0000-4000-8000-000000000016'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000602'::uuid, 'krcenje placeva i seca granja', 'Krčenje placeva i seča granja', '00000000-0000-4000-8000-000000000016'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000603'::uuid, 'sisanje zive ograde i bastovanstvo', 'Šišanje žive ograde i baštovanstvo', '00000000-0000-4000-8000-000000000016'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000604'::uuid, 'ciscenje snega i sakupljanje lisca', 'Čišćenje snega i sakupljanje lišća', '00000000-0000-4000-8000-000000000016'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000701'::uuid, 'potrcko i brza gradska dostava', 'Potrčko i brza gradska dostava', '00000000-0000-4000-8000-000000000017'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000702'::uuid, 'cekanje u redovima i administracija', 'Čekanje u redovima i administracija', '00000000-0000-4000-8000-000000000017'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000703'::uuid, 'cuvanje dece (bejbisiting)', 'Čuvanje dece (Bejbisiting)', '00000000-0000-4000-8000-000000000017'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000704'::uuid, 'pomoc i nega starijih lica', 'Pomoć i nega starijih lica', '00000000-0000-4000-8000-000000000017'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000705'::uuid, 'briga o kucnim ljubimcima', 'Briga o kućnim ljubimcima', '00000000-0000-4000-8000-000000000017'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000801'::uuid, 'privatni casovi i poducavanje', 'Privatni časovi i podučavanje', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000802'::uuid, 'casovi stranih jezika', 'Časovi stranih jezika', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000803'::uuid, 'izrada i odrzavanje web sajtova', 'Izrada i održavanje web sajtova', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000804'::uuid, 'graficki dizajn i brending', 'Grafički dizajn i brending', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000805'::uuid, 'video montaza i obrada fotografija', 'Video montaža i obrada fotografija', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000806'::uuid, 'prevodjenje i lektura tekstova', 'Prevođenje i lektura tekstova', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15),
  ('00000000-0000-4000-8000-000000000807'::uuid, 'virtuelna asistencija i unos podataka', 'Virtuelna asistencija i unos podataka', '00000000-0000-4000-8000-000000000018'::uuid, 'ESTABLISHED', 'SYSTEM', 15);

INSERT INTO private.work_taxonomy_category_modes
  (category_id, execution_scope, source_ref)
VALUES
  ('00000000-0000-4000-8000-000000000001'::uuid, 'ON_SITE', 'UNIVERSAL_CROWN'),
  ('00000000-0000-4000-8000-000000000001'::uuid, 'REMOTE', 'UNIVERSAL_CROWN'),
  ('00000000-0000-4000-8000-000000000011'::uuid, 'ON_SITE', 'SECTOR_1'),
  ('00000000-0000-4000-8000-000000000012'::uuid, 'ON_SITE', 'SECTOR_2'),
  ('00000000-0000-4000-8000-000000000013'::uuid, 'ON_SITE', 'SECTOR_3'),
  ('00000000-0000-4000-8000-000000000013'::uuid, 'REMOTE', 'SECTOR_3'),
  ('00000000-0000-4000-8000-000000000014'::uuid, 'ON_SITE', 'SECTOR_4'),
  ('00000000-0000-4000-8000-000000000014'::uuid, 'REMOTE', 'SECTOR_4'),
  ('00000000-0000-4000-8000-000000000015'::uuid, 'ON_SITE', 'SECTOR_5'),
  ('00000000-0000-4000-8000-000000000015'::uuid, 'REMOTE', 'SECTOR_5'),
  ('00000000-0000-4000-8000-000000000016'::uuid, 'ON_SITE', 'SECTOR_6'),
  ('00000000-0000-4000-8000-000000000017'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000018'::uuid, 'REMOTE', 'V15_SEED'),
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
  ('00000000-0000-4000-8000-000000000201'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000202'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000203'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000204'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000205'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000206'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000207'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000301'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000302'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000303'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000401'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000402'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000403'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000404'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000404'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000501'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000502'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000503'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000504'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000505'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000601'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000602'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000603'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000604'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000701'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000702'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000703'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000704'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000705'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000801'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000801'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000802'::uuid, 'ON_SITE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000802'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000803'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000804'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000805'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000806'::uuid, 'REMOTE', 'V15_SEED'),
  ('00000000-0000-4000-8000-000000000807'::uuid, 'REMOTE', 'V15_SEED');

INSERT INTO private.work_taxonomy_aliases
  (id, category_id, locale, label)
OVERRIDING SYSTEM VALUE
VALUES
  (20, '00000000-0000-4000-8000-000000000001'::uuid, 'sr', 'Сви задаци и послови'),
  (21, '00000000-0000-4000-8000-000000000001'::uuid, 'sr', 'Sve usluge i zadaci'),
  (23, '00000000-0000-4000-8000-000000000011'::uuid, 'sr', 'Мајстори и занати'),
  (24, '00000000-0000-4000-8000-000000000011'::uuid, 'sr', 'Majstori i zanatski radovi'),
  (25, '00000000-0000-4000-8000-000000000012'::uuid, 'sr', 'Физички послови и рушење'),
  (26, '00000000-0000-4000-8000-000000000012'::uuid, 'sr', 'Građevinska ispomoć i fizički rad'),
  (27, '00000000-0000-4000-8000-000000000013'::uuid, 'sr', 'Селидбе и превоз'),
  (28, '00000000-0000-4000-8000-000000000013'::uuid, 'sr', 'Kombi transport i selidbe'),
  (29, '00000000-0000-4000-8000-000000000014'::uuid, 'sr', 'Сервис технике и апарата'),
  (30, '00000000-0000-4000-8000-000000000014'::uuid, 'sr', 'Servis kućnih aparata'),
  (31, '00000000-0000-4000-8000-000000000015'::uuid, 'sr', 'Чишћење и одржавање'),
  (32, '00000000-0000-4000-8000-000000000015'::uuid, 'sr', 'Higijena i čišćenje prostora'),
  (33, '00000000-0000-4000-8000-000000000016'::uuid, 'sr', 'Двориште, башта и терен'),
  (34, '00000000-0000-4000-8000-000000000016'::uuid, 'sr', 'Uređenje dvorišta i bašte'),
  (211, '00000000-0000-4000-8000-000000000101'::uuid, 'sr-RS', 'vodoinstalater'),
  (212, '00000000-0000-4000-8000-000000000101'::uuid, 'sr-RS', 'zamena slavine'),
  (213, '00000000-0000-4000-8000-000000000101'::uuid, 'sr-RS', 'odgusenje odvoda'),
  (214, '00000000-0000-4000-8000-000000000101'::uuid, 'sr-RS', 'montaza bojlera'),
  (215, '00000000-0000-4000-8000-000000000102'::uuid, 'sr-RS', 'elektricar'),
  (216, '00000000-0000-4000-8000-000000000102'::uuid, 'sr-RS', 'zamena uticnica'),
  (217, '00000000-0000-4000-8000-000000000102'::uuid, 'sr-RS', 'zamena osiguraca'),
  (218, '00000000-0000-4000-8000-000000000102'::uuid, 'sr-RS', 'montaza rasvete'),
  (219, '00000000-0000-4000-8000-000000000103'::uuid, 'sr-RS', 'krecenje'),
  (220, '00000000-0000-4000-8000-000000000103'::uuid, 'sr-RS', 'moler'),
  (221, '00000000-0000-4000-8000-000000000103'::uuid, 'sr-RS', 'gletovanje'),
  (222, '00000000-0000-4000-8000-000000000103'::uuid, 'sr-RS', 'krecenje stana'),
  (223, '00000000-0000-4000-8000-000000000104'::uuid, 'sr-RS', 'keramicar'),
  (224, '00000000-0000-4000-8000-000000000104'::uuid, 'sr-RS', 'lepljenje plocica'),
  (225, '00000000-0000-4000-8000-000000000105'::uuid, 'sr-RS', 'bravar'),
  (226, '00000000-0000-4000-8000-000000000105'::uuid, 'sr-RS', 'otvaranje vrata'),
  (227, '00000000-0000-4000-8000-000000000105'::uuid, 'sr-RS', 'zamena brave'),
  (228, '00000000-0000-4000-8000-000000000106'::uuid, 'sr-RS', 'montaza namestaja'),
  (229, '00000000-0000-4000-8000-000000000106'::uuid, 'sr-RS', 'ikea montaza'),
  (230, '00000000-0000-4000-8000-000000000106'::uuid, 'sr-RS', 'sklapanje ormara'),
  (231, '00000000-0000-4000-8000-000000000201'::uuid, 'sr-RS', 'fizicki poslovi'),
  (232, '00000000-0000-4000-8000-000000000201'::uuid, 'sr-RS', 'radnik na dan'),
  (233, '00000000-0000-4000-8000-000000000201'::uuid, 'sr-RS', 'pomocni radnik'),
  (234, '00000000-0000-4000-8000-000000000202'::uuid, 'sr-RS', 'rusenje zida'),
  (235, '00000000-0000-4000-8000-000000000202'::uuid, 'sr-RS', 'stemovanje betona'),
  (236, '00000000-0000-4000-8000-000000000202'::uuid, 'sr-RS', 'skidanje plocica'),
  (237, '00000000-0000-4000-8000-000000000203'::uuid, 'sr-RS', 'utovar i istovar'),
  (238, '00000000-0000-4000-8000-000000000203'::uuid, 'sr-RS', 'pretovar'),
  (239, '00000000-0000-4000-8000-000000000204'::uuid, 'sr-RS', 'nosenje na sprat'),
  (240, '00000000-0000-4000-8000-000000000204'::uuid, 'sr-RS', 'prenos teskih stvari'),
  (241, '00000000-0000-4000-8000-000000000205'::uuid, 'sr-RS', 'odvoz suta'),
  (242, '00000000-0000-4000-8000-000000000205'::uuid, 'sr-RS', 'iznosenje suta'),
  (243, '00000000-0000-4000-8000-000000000206'::uuid, 'sr-RS', 'cepanje drva'),
  (244, '00000000-0000-4000-8000-000000000206'::uuid, 'sr-RS', 'unosenje drva'),
  (245, '00000000-0000-4000-8000-000000000301'::uuid, 'sr-RS', 'kombi prevoz'),
  (246, '00000000-0000-4000-8000-000000000301'::uuid, 'sr-RS', 'prevoz namestaja'),
  (247, '00000000-0000-4000-8000-000000000302'::uuid, 'sr-RS', 'selidba'),
  (248, '00000000-0000-4000-8000-000000000302'::uuid, 'sr-RS', 'selidba stana'),
  (249, '00000000-0000-4000-8000-000000000601'::uuid, 'sr-RS', 'kosenje trave'),
  (250, '00000000-0000-4000-8000-000000000601'::uuid, 'sr-RS', 'kosenje dvorista'),
  (251, '00000000-0000-4000-8000-000000000602'::uuid, 'sr-RS', 'krcenje placa'),
  (252, '00000000-0000-4000-8000-000000000701'::uuid, 'sr-RS', 'potrcko'),
  (253, '00000000-0000-4000-8000-000000000701'::uuid, 'sr-RS', 'dostava lekova'),
  (254, '00000000-0000-4000-8000-000000000701'::uuid, 'sr-RS', 'kupovina karata'),
  (255, '00000000-0000-4000-8000-000000000104'::uuid, 'sr-RS', 'plocice'),
  (256, '00000000-0000-4000-8000-000000000601'::uuid, 'sr-RS', 'trava'),
  (257, '00000000-0000-4000-8000-000000000106'::uuid, 'sr-RS', 'namestaj'),
  (258, '00000000-0000-4000-8000-000000000402'::uuid, 'sr-RS', 'klima'),
  (259, '00000000-0000-4000-8000-000000000102'::uuid, 'sr-RS', 'struja'),
  (260, '00000000-0000-4000-8000-000000000101'::uuid, 'sr-RS', 'voda'),
  (261, '00000000-0000-4000-8000-000000000206'::uuid, 'sr-RS', 'drva'),
  (262, '00000000-0000-4000-8000-000000000205'::uuid, 'sr-RS', 'sut'),
  (263, '00000000-0000-4000-8000-000000000202'::uuid, 'sr-RS', 'beton'),
  (264, '00000000-0000-4000-8000-000000000203'::uuid, 'sr-RS', 'pesak'),
  (265, '00000000-0000-4000-8000-000000000207'::uuid, 'sr-RS', 'zemlja');

INSERT INTO private.work_taxonomy_control
  (singleton, auto_registration_enabled, max_auto_creates_per_hour, catalog_version)
VALUES (true, false, 100, 15);

-- First release is Serbia-only and free. BUILDING does not declare legal/release readiness.
INSERT INTO private.location_market_configs
  (country_code, product_status, default_currency_code, default_language_tag, default_timezone)
VALUES ('RS', 'BUILDING', 'RSD', 'sr-Latn-RS', 'Europe/Belgrade');

INSERT INTO private.connection_policy_versions
  (policy_key, version, beneficiary_role, activation_reason, charge_mode,
   unit_basis, platform_cost_rsd, policy_snapshot)
VALUES (
  'REQUESTER_SELECTION_V1', 1, 'REQUESTER', 'SELECTION', 'PROMOTIONAL_FREE',
  'HEADCOUNT', 0,
  '{"schema":"CONNECTION_POLICY_V1","version":1,"policyKey":"REQUESTER_SELECTION_V1","unitBasis":"HEADCOUNT","chargeMode":"PROMOTIONAL_FREE","beneficiaryRole":"REQUESTER","platformCostRsd":0,"activationReason":"SELECTION"}'::jsonb
);

SELECT setval('private.work_taxonomy_aliases_id_seq'::regclass,
  (SELECT max(id) FROM private.work_taxonomy_aliases), true);

DO $seed_postflight$ BEGIN
  IF (SELECT count(*) FROM private.work_taxonomy_categories) <> 54
     OR (SELECT count(*) FROM private.work_taxonomy_category_modes) <> 61
     OR (SELECT count(*) FROM private.work_taxonomy_aliases) <> 69
     OR (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton) <> 15
     OR (SELECT count(*) FROM private.location_market_configs WHERE country_code='RS' AND product_status='BUILDING' AND default_currency_code='RSD') <> 1
     OR (SELECT count(*) FROM private.connection_policy_versions WHERE policy_key='REQUESTER_SELECTION_V1' AND version=1 AND charge_mode='PROMOTIONAL_FREE' AND platform_cost_rsd=0) <> 1
     OR EXISTS (SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.parent_id IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM private.work_taxonomy_categories p WHERE p.id=c.parent_id)) THEN
    RAISE EXCEPTION 'SYSTEM_SEED_POSTFLIGHT_FAILED';
  END IF;
END $seed_postflight$;
COMMIT;
