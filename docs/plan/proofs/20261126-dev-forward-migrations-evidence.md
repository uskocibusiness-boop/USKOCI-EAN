# DEV prenos 26.11.2026 — sopstveni period rada po Dogovoru

Projekat: `leqcwgzvjsxugfgzdmth` (DEV). PROD nije diran. Izdanje: NO-GO.

| Verzija | Naziv | Ledger md5 | Postimage |
|---|---|---|---|
| 20261125231234 | agreement_personal_periods | 8f4be7826accef6efceed6f45a3b725d | tabela private.agreement_personal_periods (RLS, bez prava klijentima); public.rpc_set_my_agreement_period prosrc 57bb082dc87c33daf5b69b7f3bbd1e59, ACL authenticated+service_role (bez anon); rpc_clear_my_agreement_period, rpc_get_my_agreement_periods |

- Odluka vlasnika 25.11.2026: termin se posle Dogovora ne pregovara kroz aplikaciju. Svaka strana sama označava svoj period rada. Period je privatan, puni sopstveni raspored, a preklapanje samo upozorava.
- Probni prolaz pre primene (cela transakcija vraćena izuzetkom), sa stvarnim vlasnikom kao radnikom:
  - upis na aktivnom Dogovoru `2a689c81` vratio je periode i prazna preklapanja;
  - čitanje je vratilo upisani period;
  - završen Dogovor `3dee9dd0` je odbijen sa `AGREEMENT_NOT_ACTIVE`;
  - brisanje je radilo, a čitanje posle njega vratilo je prazan spisak.
- Posle probe DEV je bio nepromenjen (tabela i funkcije ne postoje, ledger 387).
- Primena: ledger 387 → 388, verzija 20261125231234, jedna izjava; md5 izvora jednak md5 zapisane izjave.
- Rollback: `scripts/sql/rollback_agreement_personal_periods_20261126.sql`.
