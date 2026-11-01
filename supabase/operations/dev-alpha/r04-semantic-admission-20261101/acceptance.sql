-- No existing account, business/Auth fixture, provider or push call.
DO $triage$ BEGIN
 IF private.taxonomy_risk_triage_v1('Lektura') IS DISTINCT FROM 'LOW_RISK_CANDIDATE' THEN
   RAISE EXCEPTION 'R04_TRIAGE_LEKTURA_FAILED';
 END IF;
 IF private.taxonomy_risk_triage_v1('ostalo') IS DISTINCT FROM 'NEEDS_CLARIFICATION' THEN
   RAISE EXCEPTION 'R04_TRIAGE_OSTALO_FAILED';
 END IF;
 IF private.taxonomy_risk_triage_v1('bilo sta') IS DISTINCT FROM 'NEEDS_CLARIFICATION' THEN
   RAISE EXCEPTION 'R04_TRIAGE_BILO_STA_FAILED';
 END IF;
END;$triage$;
