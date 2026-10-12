-- Synthetic PostgreSQL service-intent contract. No real DEV, AI provider or push.
-- Requested work meaning is a skill; room/size is a qualifier, not a work kind.
DO $proof$
DECLARE
 painting uuid;
 parent_work uuid;
 gletovanje uuid;
 before_version bigint;
 before_count bigint;
 registered jsonb;
 p jsonb;
 label text;
BEGIN
 SELECT id INTO STRICT painting FROM private.work_taxonomy_categories
 WHERE canonical_key='krecenje zidova';

 INSERT INTO private.work_taxonomy_categories
   (canonical_key,label,source,catalog_version,state)
 SELECT private.taxonomy_normalize_v1('Molerski radovi'),
        'Molerski radovi','SYSTEM',catalog_version,'ESTABLISHED'
 FROM private.work_taxonomy_control WHERE singleton
 RETURNING id INTO parent_work;

 UPDATE private.work_taxonomy_categories SET parent_id=parent_work
 WHERE id=painting;
 INSERT INTO private.work_taxonomy_service_meanings
 (category_id,canonical_action,canonical_object,source_ref,verified_at)
 VALUES (painting,'krecenje','unutrasnji zidovi','synthetic-reviewed-v1',now());
 INSERT INTO private.work_taxonomy_service_verbs
 (category_id,normalized_action,source_ref)
 VALUES (painting,'krecenje','synthetic-reviewed-v1'),
        (painting,'farbanje','synthetic-reviewed-v1');

 INSERT INTO private.work_taxonomy_service_scopes
 (category_id,normalized_scope,scope_role,source_ref)
 VALUES
 (painting,'sobe','PLACE','synthetic-reviewed-v1'),
 (painting,'sobu','PLACE','synthetic-reviewed-v1'),
 (painting,'stana','PLACE','synthetic-reviewed-v1'),
 (painting,'trosobnog stana','SIZE','synthetic-reviewed-v1'),
 (painting,'zidova','TARGET','synthetic-reviewed-v1'),
 (painting,'dnevne sobe','PLACE','synthetic-reviewed-v1'),
 (painting,'soba','PLACE','synthetic-reviewed-v1'),
 (painting,'stanova','PLACE','synthetic-reviewed-v1');

 SELECT count(*) INTO before_count FROM private.work_taxonomy_categories;
 SELECT catalog_version INTO before_version FROM private.work_taxonomy_control;
 UPDATE private.work_taxonomy_control SET auto_registration_enabled=true;

 FOREACH label IN ARRAY ARRAY[
  'Krečenje sobe',
  'Krečenje stana',
  'Krečenje trosobnog stana',
  'Krečenje dnevne sobe',
  'Кречење собе',
  'Krečenje 2 sobe',
  'Krečenje 5 soba',
  'Krečenje stanova',
  'Farbanje zidova'
 ] LOOP
  p:=private.taxonomy_preview_v1(label);
  IF p->>'action'<>'REUSE_EXISTING'
    OR (p->>'categoryId')::uuid<>painting THEN
   RAISE EXCEPTION 'ROOM_SIZE_WAS_SEPARATE_SERVICE: % => %',label,p;
  END IF;
  registered:=private.taxonomy_register_low_risk_v1(
    label,'LOW_RISK_VERIFIED',true);
  IF registered->>'action'<>'REUSE_EXISTING'
    OR (registered->>'categoryId')::uuid<>painting
    OR registered->>'notificationAuthority'<>'NONE' THEN
   RAISE EXCEPTION 'REGISTRATION_DUPLICATED_SERVICE: % => %',label,registered;
  END IF;
 END LOOP;

 IF (SELECT count(*) FROM private.work_taxonomy_categories)<>before_count
 OR (SELECT catalog_version FROM private.work_taxonomy_control)<>before_version THEN
  RAISE EXCEPTION 'ROOM_OR_SIZE_CAUSED_CATEGORY_GROWTH';
 END IF;
 IF (SELECT parent_id FROM private.work_taxonomy_categories WHERE id=painting)
     IS DISTINCT FROM parent_work THEN
  RAISE EXCEPTION 'PAINTING_NOT_IN_MOLERSKI_RADOVI';
 END IF;

 -- An unknown scope for a KNOWN service does not create a new category.
 p:=private.taxonomy_preview_v1('Krečenje kupatila');
 IF p->>'action'<>'CLARIFY'
    OR p->>'reason'<>'POSSIBLE_EXISTING_SERVICE' THEN
  RAISE EXCEPTION 'UNKNOWN_PAINTING_SCOPE_WAS_AUTO_CLASSIFIED: %',p;
 END IF;
 BEGIN
  PERFORM private.taxonomy_register_low_risk_v1(
    'Krečenje kupatila','LOW_RISK_VERIFIED',true);
  RAISE EXCEPTION 'UNKNOWN_PAINTING_SCOPE_CREATED_DUPLICATE_CATEGORY';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'TAXONOMY_POSSIBLE_EXISTING_SERVICE' THEN RAISE; END IF;
 END;
 -- A verified new phrase expands expressiveness WITHOUT a new category.
 INSERT INTO private.work_taxonomy_service_scopes
 (category_id,normalized_scope,scope_role,source_ref)
 VALUES (painting,'kupatila','PLACE','synthetic-reviewed-v2');
 p:=private.taxonomy_preview_v1('Krečenje kupatila');
 IF p->>'action'<>'REUSE_EXISTING'
    OR (p->>'categoryId')::uuid<>painting THEN
  RAISE EXCEPTION 'ADDED_SCOPE_FAILED_TO_REUSE_SERVICE';
 END IF;

 -- Different work with a similar token may require a distinct skill.
 -- A known "farbanje" verb NEVER proves ability to paint furniture/cars.
 FOREACH label IN ARRAY ARRAY[
 'Farbanje stolarije', 'Farbanje automobila',
 'Krečenje 2 automobila', 'Krečenje broda',
 'Krečenje sobe i zamena utičnice'
 ] LOOP
  p:=private.taxonomy_preview_v1(label);
  IF p->>'action'='REUSE_EXISTING' THEN
    RAISE EXCEPTION 'UNRELATED_WORK_MERGED_AS_WALL_PAINTING: %',label;
  END IF;
 END LOOP;

 -- A genuinely different confirmed service may be created and keep its own ID,
 -- instead of being forcibly folded under another worker capability.
 INSERT INTO private.work_taxonomy_risk_actions(normalized_action)
 VALUES ('gletovanje');
 p:=private.taxonomy_preview_v1('Gletovanje zidova');
 IF p->>'action'<>'PROPOSE_AUTO_PROVISIONAL' THEN
   RAISE EXCEPTION 'GLETOVANJE_WRONGLY_CLASSIFIED_AS_KRECENJE: %',p;
 END IF;
 registered:=private.taxonomy_register_low_risk_v1(
    'Gletovanje zidova','LOW_RISK_VERIFIED',true);
 gletovanje:=(registered->>'categoryId')::uuid;
 IF registered->>'action'<>'CREATE_AUTO_PROVISIONAL'
    OR gletovanje IS NULL OR gletovanje=painting THEN
   RAISE EXCEPTION 'GLETOVANJE_WAS_MERGED_WITH_KRECENJE';
 END IF;
 UPDATE private.work_taxonomy_control SET auto_registration_enabled=false;
 RAISE NOTICE 'DISPOSABLE_SERVICE_MEANING_SCOPE_PASS';
END
$proof$;
