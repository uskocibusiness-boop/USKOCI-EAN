-- SOURCE-ONLY curated catalog seed; not deployed to DEV/PROD.
-- Contains 68 DISTINCT service identities (no synonyms).
-- Scope, city, quantities, urgency and conversational wording remain task attributes.
-- No worker capabilities, task snapshots, legacy matches or push entitlement.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $preflight$
BEGIN
 IF (SELECT count(*) FROM private.work_taxonomy_categories)<>14
 OR (SELECT count(*) FROM private.work_taxonomy_category_modes)<>14
 OR (SELECT count(*) FROM private.work_taxonomy_standard_coverage)<>0
 OR (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)<>2
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities)
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots)
 THEN RAISE EXCEPTION 'CURATED_SERVICE_SEED_REQUIRES_EMPTY_DISABLED_BASELINE'; END IF;
END $preflight$;
UPDATE private.work_taxonomy_control
SET catalog_version=3,updated_at=now()
WHERE singleton AND NOT auto_registration_enabled AND catalog_version=2;

-- New general everyday-help root (not misclassified as physical work).
WITH input(label,parent_label,scope) AS (
 VALUES
  ('Svakodnevna pomoć',NULL,'ON_SITE')
), inserted AS (
 INSERT INTO private.work_taxonomy_categories(canonical_key,label,parent_id,source,catalog_version,state)
 SELECT private.taxonomy_normalize_v1(i.label),i.label,NULL,'OPERATOR',3,'ESTABLISHED'
 FROM input i 
 RETURNING id,label
)
INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
SELECT c.id,i.scope,'CURATED_SOURCE_ONLY_BASELINE'
FROM inserted c JOIN input i ON i.label=c.label;

-- Approved intermediate domains, including two levels of on-site/remote services.
WITH input(label,parent_label,scope) AS (
 VALUES
  ('Nabavka i kupovina','Svakodnevna pomoć','ON_SITE'),
  ('Administrativne obaveze','Svakodnevna pomoć','ON_SITE'),
  ('Pomoć na terenu','Svakodnevna pomoć','ON_SITE'),
  ('Grafički dizajn','Digitalne usluge','REMOTE'),
  ('Izrada i održavanje sajtova','Digitalne usluge','REMOTE')
), inserted AS (
 INSERT INTO private.work_taxonomy_categories(canonical_key,label,parent_id,source,catalog_version,state)
 SELECT private.taxonomy_normalize_v1(i.label),i.label,p.id,'OPERATOR',3,'ESTABLISHED'
 FROM input i JOIN private.work_taxonomy_categories p ON p.canonical_key=private.taxonomy_normalize_v1(i.parent_label)
 RETURNING id,label
)
INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
SELECT c.id,i.scope,'CURATED_SOURCE_ONLY_BASELINE'
FROM inserted c JOIN input i ON i.label=c.label;

-- Explicit, non-duplicate service identities. Avoid location-specific categories.
WITH input(label,parent_label,scope) AS (
 VALUES
  ('Krečenje','Molerski radovi','ON_SITE'),
  ('Gletovanje','Molerski radovi','ON_SITE'),
  ('Priprema zidova','Molerski radovi','ON_SITE'),
  ('Skidanje tapeta','Molerski radovi','ON_SITE'),
  ('Dekorativne molerske tehnike','Molerski radovi','ON_SITE'),
  ('Krečenje zidova','Krečenje','ON_SITE'),
  ('Krečenje plafona','Krečenje','ON_SITE'),
  ('Montaža rasvete','Električarski radovi','ON_SITE'),
  ('Zamena utičnica','Električarski radovi','ON_SITE'),
  ('Zamena prekidača','Električarski radovi','ON_SITE'),
  ('Ispitivanje elektroinstalacija','Električarski radovi','ON_SITE'),
  ('Zamena slavine','Vodoinstalaterski radovi','ON_SITE'),
  ('Otpušavanje odvoda','Vodoinstalaterski radovi','ON_SITE'),
  ('Montaža sifona','Vodoinstalaterski radovi','ON_SITE'),
  ('Popravka vodokotlića','Vodoinstalaterski radovi','ON_SITE'),
  ('Prenošenje stvari','Fizički poslovi','ON_SITE'),
  ('Utovar i istovar','Fizički poslovi','ON_SITE'),
  ('Ispomoć u skladištu','Fizički poslovi','ON_SITE'),
  ('Pakovanje za selidbu','Selidbe i prevoz','ON_SITE'),
  ('Selidba stana','Selidbe i prevoz','ON_SITE'),
  ('Prevoz nameštaja','Selidbe i prevoz','ON_SITE'),
  ('Prevoz manjih stvari','Selidbe i prevoz','ON_SITE'),
  ('Montaža polica','Montaža nameštaja','ON_SITE'),
  ('Sklapanje ormara','Montaža nameštaja','ON_SITE'),
  ('Montaža kreveta','Montaža nameštaja','ON_SITE'),
  ('Zamena kvake','Sitne popravke','ON_SITE'),
  ('Podešavanje šarki','Sitne popravke','ON_SITE'),
  ('Postavljanje držača','Sitne popravke','ON_SITE'),
  ('Čišćenje stana','Čišćenje','ON_SITE'),
  ('Čišćenje kancelarija','Čišćenje','ON_SITE'),
  ('Čišćenje nakon radova','Čišćenje','ON_SITE'),
  ('Pranje veša','Pranje i peglanje','ON_SITE'),
  ('Peglanje veša','Pranje i peglanje','ON_SITE'),
  ('Pranje posteljine','Pranje i peglanje','ON_SITE'),
  ('Košenje trave','Bašta i dvorište','ON_SITE'),
  ('Orezivanje žive ograde','Bašta i dvorište','ON_SITE'),
  ('Sakupljanje lišća','Bašta i dvorište','ON_SITE'),
  ('Preuzimanje paketa','Dostava','ON_SITE'),
  ('Dostava dokumenata','Dostava','ON_SITE'),
  ('Lokalna dostava paketa','Dostava','ON_SITE'),
  ('Kupovina namirnica','Nabavka i kupovina','ON_SITE'),
  ('Kupovina karata','Nabavka i kupovina','ON_SITE'),
  ('Kupovina proizvoda','Nabavka i kupovina','ON_SITE'),
  ('Preuzimanje robe u prodavnici','Nabavka i kupovina','ON_SITE'),
  ('Predaja dokumentacije','Administrativne obaveze','ON_SITE'),
  ('Preuzimanje dokumentacije','Administrativne obaveze','ON_SITE'),
  ('Provera dostupnosti proizvoda','Pomoć na terenu','ON_SITE'),
  ('Kratka praktična ispomoć','Pomoć na terenu','ON_SITE'),
  ('Izrada logotipa','Grafički dizajn','REMOTE'),
  ('Dizajn banera','Grafički dizajn','REMOTE'),
  ('Izrada jednostavnog sajta','Izrada i održavanje sajtova','REMOTE'),
  ('Održavanje sajta','Izrada i održavanje sajtova','REMOTE'),
  ('Montaža video snimka','Digitalne usluge','REMOTE'),
  ('Obrada fotografija','Digitalne usluge','REMOTE'),
  ('3D modelovanje','Digitalne usluge','REMOTE'),
  ('Prevođenje tekstova','Pisanje i jezici','REMOTE'),
  ('Lektura tekstova','Pisanje i jezici','REMOTE'),
  ('Pisanje opisa proizvoda','Pisanje i jezici','REMOTE'),
  ('Transkripcija snimaka','Pisanje i jezici','REMOTE'),
  ('Časovi matematike','Online podučavanje','REMOTE'),
  ('Časovi engleskog jezika','Online podučavanje','REMOTE'),
  ('Časovi programiranja','Online podučavanje','REMOTE')
), inserted AS (
 INSERT INTO private.work_taxonomy_categories(canonical_key,label,parent_id,source,catalog_version,state)
 SELECT private.taxonomy_normalize_v1(i.label),i.label,p.id,'OPERATOR',3,'ESTABLISHED'
 FROM input i JOIN private.work_taxonomy_categories p ON p.canonical_key=private.taxonomy_normalize_v1(i.parent_label)
 RETURNING id,label
)
INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
SELECT c.id,i.scope,'CURATED_SOURCE_ONLY_BASELINE'
FROM inserted c JOIN input i ON i.label=c.label;

-- Approved STANDARD work scope for confirmed professions; NEVER broad physical,
-- electrician specialist, unrelated delivery or the new ticket-purchase service.
WITH approved(parent_label,child_label,reason) AS (
 VALUES
  ('Molerski radovi','Krečenje','Ordinary painting within confirmed painter scope'),
  ('Krečenje','Krečenje zidova','Standard wall painting within confirmed painting'),
  ('Krečenje','Krečenje plafona','Standard ceiling painting within confirmed painting'),
  ('Čišćenje','Čišćenje stana','Ordinary residential cleaning confirmed scope'),
  ('Pranje i peglanje','Peglanje veša','Ordinary ironing confirmed scope'),
  ('Bašta i dvorište','Sakupljanje lišća','Ordinary leaf collection confirmed scope')
)
INSERT INTO private.work_taxonomy_standard_coverage
(parent_category_id,child_category_id,evidence_ref)
SELECT p.id,c.id,('CURATED_BASELINE_V3_' || private.taxonomy_normalize_v1(a.parent_label) || '_' || private.taxonomy_normalize_v1(a.child_label))
FROM approved a
JOIN private.work_taxonomy_categories p ON p.canonical_key=private.taxonomy_normalize_v1(a.parent_label)
JOIN private.work_taxonomy_categories c ON c.canonical_key=private.taxonomy_normalize_v1(a.child_label);
DO $postflight$
DECLARE expected integer := 82;
BEGIN
 IF (SELECT count(*) FROM private.work_taxonomy_categories)<>expected
 OR (SELECT count(*) FROM private.work_taxonomy_category_modes)<>expected
 OR (SELECT count(*) FROM private.work_taxonomy_standard_coverage)<>6
 OR (SELECT count(*) FROM private.work_taxonomy_categories WHERE parent_id IS NULL)<>15
 OR (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)<>3
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities)
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots)
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases)
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_standard_coverage e
   JOIN private.work_taxonomy_categories child ON child.id=e.child_category_id
   WHERE child.parent_id IS DISTINCT FROM e.parent_category_id)
 THEN RAISE EXCEPTION 'CURATED_SERVICE_SEED_INTEGRITY_FAILED'; END IF;
 RAISE NOTICE 'CURATED_SERVICE_BASELINE_PASS categories_%',expected;
END $postflight$;
