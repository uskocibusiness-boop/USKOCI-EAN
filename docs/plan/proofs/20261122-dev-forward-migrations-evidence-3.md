# DEV prenos 22.11.2026 — otkazan Dogovor zatvara predlog izmene

Projekat: `leqcwgzvjsxugfgzdmth` (DEV). PROD nije diran. Izdanje: NO-GO.

| Verzija | Naziv | Ledger md5 | Postimage (md5 prosrc) |
|---|---|---|---|
| 20261122113923 | agreement_cancel_closes_pending_proposal | 08c8bb6782a06c7f3433506536eaa573 | rpc_cancel_agreement 29b0b95ac244274ab69d59f210c51107, rpc_list_my_agreements_page 68bc9f48e105852e24c24f36402c25b9, rpc_list_my_agreement_groups_page fe2b116fe123050137830dcf0be25e8b |

- Plan tačka 6 (vlasnik „nastavi“ 22.11.2026): otkazivanje Dogovora u istoj transakciji zatvara predlog izmene na čekanju (SUPERSEDED); liste prikazuju predlog na čekanju samo za potvrđen Dogovor; jednokratno zatvaranje zaostalih (DEV: 0).
- Preimage proveren u migraciji (md5, vlasnik, ACL, SECURITY DEFINER, search_path); postimage = md5 tačne zamene sidra; metapodaci funkcija nepromenjeni.
- Zaštite tabele `pre_v3_closure_proposal` i `pre_v3_safety_proposal` propuštaju prelaz u SUPERSEDED (pročitano pre primene).
- Probni prolaz izmena + rollback + provera tačnog vraćanja preimage-a u jednoj transakciji sa ROLLBACK prošao; zatim primena preko `supabase db query --linked -f` sa upisom u ledger iz istog fajla. Ledger posle: 386.
- Rollback: `scripts/sql/rollback_agreement_cancel_pending_preimage_20261121.sql`.
